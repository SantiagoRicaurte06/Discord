# Los 12 puntos: qué buscar y cómo arreglarlo

Contenido: [1 Sesión](#1-sesión-en-el-servidor) · [2 Esquema](#2-entrada-validada-con-esquema) · [3 IDOR](#3-dueño-del-recurso-idor) · [4 Servidor calcula](#4-lo-crítico-se-calcula-en-el-servidor) · [5 Respuesta mínima](#5-respuesta-mínima) · [6 RLS](#6-rls-y-llaves) · [7 Rate limiting](#7-rate-limiting-por-capas) · [8 Contraseñas](#8-contraseñas) · [9 Recuperación](#9-recuperación-de-cuenta) · [10 Tokens](#10-tokens-y-sesiones) · [11 Tarjetas](#11-datos-de-tarjeta) · [12 Deploy](#12-deploy-seguro)

---

## 1. Sesión en el servidor

**El error:** confiar en que, como el botón solo aparece con sesión iniciada, la función está protegida. Una Server Action de Next.js es un **endpoint POST público** que se puede llamar sin la interfaz, y lo mismo pasa con cualquier ruta de la API.

**Qué buscar:** acciones con `'use server'`, `route.ts` y rutas de Express sin `auth()`, `getServerSession`, `requireUser`, `getUser` ni un middleware de autenticación.

**Arreglo en una Server Action (Next.js)**, con el patrón de 4 pasos:
```ts
'use server'
const Input = z.object({ id: z.string().uuid() })
export async function borrar(raw: unknown) {
  const user = await requireUser()                 // 1. sesión dentro de la acción
  const { id } = Input.parse(raw)                  // 2. valida con un esquema
  const f = await db.factura.find(id)
  if (f?.ownerId !== user.id) throw forbidden()    // 3. ¿es dueño del recurso?
  await db.factura.delete(id)
  return { ok: true }                              // 4. devuelve solo lo necesario
}
```
**Express:** un middleware `requireAuth` en el router (`router.use(requireAuth)`) en vez de verificar ruta por ruta.

Mantén Next.js al día: las Server Actions han tenido parches de seguridad.

## 2. Entrada validada con esquema

**El error:** usar `req.body.x` o `formData.get('x')` directo. Llegan tipos y valores inesperados: negativos, decimales, strings larguísimos u objetos donde se esperaba un número.

**Arreglo:** un esquema por endpoint, con `parse` al inicio. La cantidad va como entero positivo con tope (`z.number().int().min(1).max(99)`), los IDs con su formato (`uuid()`) y los strings con largo máximo. Python: Pydantic en FastAPI o serializers en Django.

## 3. Dueño del recurso (IDOR)

**El error:** `GET /api/facturas/1623` funciona, y `1620` también, porque el servidor **nunca verificó que fuera tuyo**. Con el mismo fallo se lee, se modifica (PUT o PATCH) y se borra lo ajeno, y si el endpoint genera **URLs firmadas** (S3, Supabase Storage), se descargan archivos ajenos.

**Qué buscar:** `findById(req.params.id)`, `where: { id }` sin `userId`, `update` o `delete` por ID solo, y `getSignedUrl` o `createSignedUrl` sin comprobar el dueño.

**Arreglo:** filtra por dueño en la misma consulta. Si no es tuyo, responde 404 para no confirmar que existe:
```ts
const f = await db.factura.findFirst({ where: { id, ownerId: user.id } })
if (!f) return notFound()
```
Con roles (admin, miembro de un equipo), la regla de acceso va en una sola función reutilizable, como `puedeVer(user, recurso)`.

## 4. Lo crítico se calcula en el servidor

**El error:** el cliente manda `{ productId: 11, price_cents: 299, quantity: 5 }` y el servidor cobra `price × quantity`. Con `quantity: 0.0001` o `-1` la compra cuesta 0, o devuelve dinero, y repitiendo la petición los pedidos gratis no tienen fin. Lo mismo pasa con `role`, `isAdmin`, `discount` y `total`.

**Arreglo:** del cliente solo se aceptan **IDs y cantidades validadas**. El precio sale de la base, el total se calcula en el servidor y el rol nunca viene en el body. Si hace falta, revalida el total justo antes de cobrar.

## 5. Respuesta mínima

**El error:** `res.json(user)` devuelve el hash de la contraseña, el correo y los tokens. `select('*')` en Supabase expone columnas internas.

**Arreglo:** elige los campos (`select: { id: true, nombre: true }` o `.select('id,nombre')`) o usa un esquema de salida. Los errores al cliente van genéricos y el detalle queda en el log.

## 6. RLS y llaves

**El error (Supabase):** la llave `anon` va en el navegador, que es lo normal, pero **sin RLS cualquiera lee y escribe las tablas** con esa llave. En 2025 más de 170 apps hechas con Lovable quedaron expuestas por esto (CVE-2025-48757).

**Qué buscar:** migraciones con `create table` sin `alter table … enable row level security`, tablas sin `create policy`, y la `service_role` o `SUPABASE_SERVICE_ROLE_KEY` en código del cliente o en variables `NEXT_PUBLIC_*` o `VITE_*`.

**Arreglo:**
```sql
alter table public.facturas enable row level security;
create policy "dueño lee" on public.facturas for select using (auth.uid() = owner_id);
create policy "dueño escribe" on public.facturas for insert with check (auth.uid() = owner_id);
```
La `service_role` solo se usa en el servidor; si estuvo expuesta, hay que rotarla.

## 7. Rate limiting por capas

**El error:** bloquear solo por IP no frena una botnet (miles de IPs) y bloquea a toda una universidad que comparte la misma IP. Bloquear la cuenta tras 5 fallos deja que cualquiera bloquee la cuenta de otro con solo escribir su correo.

**Arreglo:** un *token bucket* por IP y otro por cuenta, y cada intento gasta de los dos. Ejemplo: IP con 100 fichas y recarga de 100 por minuto; cuenta con 5 fichas y recarga de 1 cada 2 s. Si cualquiera se vacía, se responde **429** con `Retry-After`. El usuario real ni lo nota, y el bot pasa de 10.000 intentos por minuto a unos 5 por cuenta.
Librerías: `express-rate-limit` con `rate-limit-redis`, `rate-limiter-flexible`, `@upstash/ratelimit` (Next o edge), `slowapi` (FastAPI).
Aplica a login, registro, recuperación, verificación de códigos y cualquier endpoint caro.

## 8. Contraseñas

**El error:** cifrarlas (es reversible: con la llave salen todas), o usar MD5, SHA-1 o SHA-256, que son tan rápidos que se prueban millones por segundo.

**Arreglo:** **argon2id** (preferido), bcrypt (costo ≥ 12) o scrypt, con salt por usuario (las librerías lo hacen solas). Al entrar se compara con `verify`; nunca se guarda el original. Lo lento es a propósito.
```ts
import argon2 from 'argon2'
const hash = await argon2.hash(password)       // al registrar
const ok = await argon2.verify(hash, intento)  // al entrar
```

## 9. Recuperación de cuenta

Es la segunda puerta de la cuenta y casi siempre la más floja.

| Error | Arreglo |
|---|---|
| El token no expira o sirve más de una vez | Token aleatorio (`crypto.randomBytes(32)`), guardado **hasheado**, de un solo uso y con expiración en minutos (15–30) |
| "Ese correo no existe" | La misma respuesta **y el mismo tiempo** exista o no la cuenta ("Si existe, te enviamos un correo") |
| El aviso llega cuando ya entraron | Al cambiar la contraseña: cerrar todas las sesiones, invalidar los tokens y avisar al instante al correo |

## 10. Tokens y sesiones

**El error:** guardar el JWT o el token de sesión en `localStorage`, donde lo lee cualquier script (XSS, una extensión, una librería comprometida).

**Arreglo:** una cookie `HttpOnly; Secure; SameSite=Lax` (o `Strict`), con expiración razonable y rotación. Si usas cookies, protege contra CSRF los métodos que modifican (SameSite o un token CSRF). Cierra sesión de verdad: hay que invalidar en el servidor, no solo borrar la cookie.

## 11. Datos de tarjeta

**Nunca tocan tu base:** el número completo, el CVV, la banda magnética ni el PIN. El CVV no se guarda nunca, ni cifrado ni "un ratico" (lo prohíbe la norma PCI DSS).

**Arreglo:** usa la tokenización de la pasarela (Stripe, Wompi, Mercado Pago, PayU, o AWS Payment Cryptography si es propio). Guardas el token y los últimos 4, cobras contra el token, y si roban la base se llevan basura. Si encuentras columnas `cvv`, `cvc`, `card_number` o `numero_tarjeta`: ❌, se migran y se borran.

## 12. Deploy seguro

El caso Knight Capital: un flag reutilizado activó código muerto en el único servidor de 8 al que no le llegó el deploy manual, y se perdieron 440 millones de dólares en 45 minutos. Había 97 correos de error que nadie trató como alarma.

- **Borra el código muerto** y no reutilices flags viejos.
- **El deploy es automático e igual en todos los servidores** (CI), nunca a mano.
- **Hay botón de apagado** (kill switch o feature flag) para lo que mueve dinero o datos.
- **Las alertas automáticas tienen dueño**: alguien las lee.
- **Dependencias y framework al día**: `npm audit`, `pnpm audit` o `pip-audit`, y Next.js, Express o Django en su último parche.
