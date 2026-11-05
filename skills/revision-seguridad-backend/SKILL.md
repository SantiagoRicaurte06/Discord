---
name: revision-seguridad-backend
description: Revisa la seguridad del backend de una app con 12 puntos que las apps hechas con IA suelen fallar. Cubre sesión verificada en cada endpoint o Server Action, validación con esquema, dueño del recurso (IDOR), precios y roles calculados en el servidor, respuesta mínima, RLS en Supabase, rate limiting, hash de contraseñas, recuperación de cuenta, tokens en cookies HttpOnly, datos de tarjeta y deploy seguro. Úsala antes de mergear o deployar algo que toque login, registro, endpoints, API, Server Actions, Supabase, pagos, permisos o datos de usuarios; también cuando digan "revisa la seguridad", "¿es seguro?", "¿me pueden hackear?", "audita el backend" o "revisa los endpoints", aunque no digan "seguridad".
---

# Revisión de seguridad del backend

Cada punto de esta skill viene de un fallo real que se repite en apps hechas con IA. Un usuario normal, con las herramientas del navegador o un proxy, cambia el ID, el precio o la cantidad de una petición, o llama a una función "oculta" sin pasar por la interfaz. **El servidor tiene que comportarse bien aunque el cliente mienta.** Esa es la idea que une los 12 puntos.

## Flujo

1. **Detecta el stack**: Express, Fastify o Hono, Next.js (Route Handlers y Server Actions), Supabase, FastAPI o Django, y dónde vive el acceso a datos (ORM, SQL, Supabase). Mira `package.json`, `requirements.txt` o `pyproject.toml` y las carpetas.
2. **Corre el buscador de señales** sobre la carpeta del código:
   ```bash
   node <ruta-de-esta-skill>/scripts/revisar.mjs <carpeta> [--json]
   ```
   Hace un inventario de endpoints y Server Actions y marca cada punto como ✅, ⚠️ o ❌, con `archivo:línea`. Termina con código 1 si hay ❌. **Son señales, no pruebas**: un ⚠️ puede estar bien y un ✅ no garantiza nada. El script orienta la lectura, no la reemplaza.
3. **Lee el código** de cada endpoint que maneje datos de usuarios, pagos o permisos. Para cada uno, contesta los 12 puntos con la guía de [`referencias/puntos.md`](referencias/puntos.md), que tiene qué buscar, cómo se ve el error y cómo se arregla en cada stack.
4. **Arregla con aprobación**: propone el cambio con el diff y explica el ataque concreto que evita ("cambiando el ID 1623 por 1620 cualquiera lee la factura de otro"). Usa las herramientas del framework (middleware, Zod o Pydantic, RLS) antes que librerías nuevas.
5. **Reporte final**: tabla con los 12 puntos, su estado, dónde y qué se hizo, más los pendientes que necesitan decisión humana. Ordena primero lo que deja leer o modificar datos ajenos.

## Los 12 puntos

| # | Punto | La pregunta |
|---|---|---|
| 1 | **Sesión en el servidor** | ¿Cada endpoint y cada Server Action verifica la sesión *dentro*, aunque el botón solo se vea con sesión? |
| 2 | **Entrada validada con esquema** | ¿Todo lo que llega (body, params, query, FormData) pasa por Zod, Pydantic o similar antes de usarse? |
| 3 | **Dueño del recurso (IDOR)** | Si cambio el ID en la URL o el body, ¿el servidor comprueba que el recurso es mío? También las URLs firmadas de S3 o Storage |
| 4 | **Lo crítico se calcula en el servidor** | ¿Precio, total, cantidad, descuento, rol o `isAdmin` vienen del cliente? Deben salir de la base |
| 5 | **Respuesta mínima** | ¿Se devuelven objetos completos (`select *`, el usuario con su hash) en vez de solo los campos necesarios? |
| 6 | **RLS y llaves (Supabase o BD expuesta)** | ¿Cada tabla tiene RLS con políticas? ¿La `service_role` está fuera del frontend? |
| 7 | **Rate limiting por capas** | ¿Login, registro, recuperación y envío de códigos limitan por IP **y** por cuenta y responden 429, sin bloquear cuentas de forma fija? |
| 8 | **Contraseñas** | ¿argon2id, bcrypt o scrypt con salt? Nunca cifradas, nunca MD5 o SHA, nunca en texto plano |
| 9 | **Recuperación de cuenta** | Token aleatorio de un solo uso que expira en minutos, la misma respuesta exista o no la cuenta, y al cambiar se cierran las sesiones y se avisa |
| 10 | **Tokens y sesiones** | ¿El token vive en una cookie `HttpOnly` + `Secure` + `SameSite` y no en `localStorage`? |
| 11 | **Datos de tarjeta** | ¿Se guarda el CVV, el número completo, la banda o el PIN? Solo el token de la pasarela y los últimos 4 |
| 12 | **Deploy seguro** | ¿Hay código muerto o flags reutilizados? ¿El deploy es automático? ¿Hay botón de apagado? ¿Framework y dependencias al día (`npm audit`)? |

## Reglas

- **Explica el ataque, no solo la regla.** "Falta validar" no convence; "con `quantity: 0.0001` la compra cuesta 0" sí.
- **No rompas el login de nadie**: los cambios de sesión, cookies o RLS pueden dejar a todos afuera. Propónlos, pruébalos en local y pide aprobación antes de aplicarlos.
- **No ataques sistemas reales.** Reproduce los fallos en local, con tests o con `curl` contra `localhost`, nunca contra producción ni contra servicios de terceros.
- **Sin secretos en el reporte**: si encuentras llaves o tokens en el código, di dónde están y que hay que rotarlos, sin copiarlos.
- Si no aplica (no hay login, no hay pagos, no usa Supabase), márcalo "no aplica" en vez de forzarlo.
- Termina siempre con la tabla de los 12 puntos.

## Cuándo no usarla

- Sitios estáticos sin backend ni formularios propios: usa `checklist-lanzamiento`.
- Una revisión general de un PR (bugs, calidad): usa `thermos`. Esta skill es la parte de seguridad del backend y se puede correr junto con thermos.
- No reemplaza a `proteccion`: proteccion frena comandos destructivos en tu máquina, y esta revisa el código de la app.
