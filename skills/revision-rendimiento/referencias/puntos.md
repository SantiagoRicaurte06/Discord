# Los 10 puntos: cómo medir y cómo arreglar

Contenido: [1 N+1](#1-consultas-n1) · [2 Lote](#2-escrituras-en-lote) · [3 Índices](#3-índices) · [4 Optimista](#4-interfaz-optimista) · [5 Asíncrono](#5-tareas-largas-asíncronas) · [6 Estático](#6-páginas-estáticas-o-cacheadas) · [7 Compresión y caché](#7-compresión-y-caché-http) · [8 Imágenes](#8-imágenes-y-carga-diferida) · [9 Cuello de botella](#9-un-solo-cuello-de-botella) · [10 Carga](#10-prueba-de-carga)

---

## 1. Consultas N+1

**Cómo se ve:** "ocho viajes al súper por una sopa". Una consulta trae 100 pedidos y luego, dentro de un bucle o un `map`, otra por cada pedido para traer su cliente: 101 consultas. Con 3 pedidos no se nota; con 100, la pantalla se arrastra.

**Cómo medirlo:** activa el log de consultas del ORM (Prisma `log: ['query']`, Django Debug Toolbar, `DEBUG=knex:query`) y cuenta cuántas hace una pantalla.

**Arreglo:** junta los IDs y pide todo de una vez (2 consultas en vez de 101):
```ts
// ❌ N+1
for (const p of pedidos) p.cliente = await db.cliente.findUnique({ where: { id: p.clienteId } })

// ✅ incluir la relación (1 consulta con join, o 2 consultas)
const pedidos = await db.pedido.findMany({ include: { cliente: true } })

// ✅ o juntar los IDs a mano
const ids = [...new Set(pedidos.map((p) => p.clienteId))]
const clientes = await db.cliente.findMany({ where: { id: { in: ids } } })
```
Django: `select_related` y `prefetch_related`. GraphQL: *DataLoader*. Supabase: `select('*, cliente(*)')`.

## 2. Escrituras en lote

**Cómo se ve:** `for (const fila of filas) await db.insert(fila)`. Cada escritura es un viaje y una transacción.

**Arreglo:** `createMany` o `insertMany`, `INSERT ... VALUES (...), (...)` o `bulk_create`. Para cientos de miles de filas, en tandas de 500 a 1.000. Si tienen que ser todas o ninguna, dentro de una transacción.

## 3. Índices

**Cómo se ve:** buscar un usuario por correo en un millón de filas tarda 3 s; con un índice tarda 2 ms. Sin índice, la base revisa las filas una por una.

**Cómo medirlo:** `EXPLAIN ANALYZE` en la consulta lenta. Si dice *Seq Scan* sobre una tabla grande, falta un índice.

**Arreglo:**
```sql
create index concurrently idx_usuarios_correo on usuarios (correo);
create index idx_pedidos_cliente_fecha on pedidos (cliente_id, creado_en desc);  -- filtro + orden
```
- Indexa las columnas por las que buscas, filtras, haces JOIN u ordenas a menudo, no todas: cada índice ocupa espacio y vuelve más lentas las escrituras.
- Las búsquedas de texto escalan por etapas:
  1. Índice normal: exige el texto exacto.
  2. Full-text de Postgres (`tsvector` + GIN) o `pg_trgm` para tolerar errores.
  3. Un motor aparte (Elasticsearch, Meilisearch, Typesense), sincronizado por eventos, cuando la búsqueda empieza a quitarle CPU a la base transaccional.

## 4. Interfaz optimista

**Cómo se ve:** al dar "me gusta" o marcar una tarea, el botón se queda pensando hasta que responde el servidor.

**Arreglo:** muestra el cambio al instante y revierte si el servidor falla. React: `useOptimistic`; TanStack Query: `onMutate` con rollback en `onError`; SWR: `mutate(datos, { optimisticData, rollbackOnError: true })`. Va bien en acciones reversibles y de bajo riesgo, no en pagos.

## 5. Tareas largas asíncronas

**Cómo se ve:** el endpoint de registro envía el correo, genera un PDF o llama a una IA **antes** de responder, y el usuario espera 5 segundos o más.

**Arreglo:** responde rápido y haz el trabajo en segundo plano:
- una cola (BullMQ con Redis, Cloud Tasks, SQS, `pg-boss`, Celery);
- `waitUntil` o `after()` en Vercel o Next;
- o un evento ("pedido creado") que otros servicios leen cuando pueden, como Kafka o una cola.

Si el resultado hace falta, devuelve un ID y consulta el estado, o notifica cuando esté.

Cuando un servicio llama a varios otros (cocina, envíos, facturación) y uno está caído, un evento evita perder el pedido.

## 6. Páginas estáticas o cacheadas

**Cómo se ve:** la página de inicio, el blog o el catálogo, que son iguales para todos, se generan en el servidor en cada visita.

**Arreglo:** genéralas en el build (SSG) o con revalidación (Next.js `export const revalidate = 3600`, ISR; Astro estático). Lo que es por usuario se carga aparte en el cliente o con *streaming*.

## 7. Compresión y caché HTTP

**Cómo se ve:** la respuesta JSON de 500 KB viaja tal cual, y los JS, CSS e imágenes se vuelven a bajar en cada visita.

**Arreglo:**
- **Compresión:** gzip o brotli. Express: `app.use(compression())`. Nginx: `gzip on; brotli on;`. Vercel, Netlify y Cloudflare lo hacen solos.
- **Estáticos con hash en el nombre:** `Cache-Control: public, max-age=31536000, immutable`.
- **HTML y APIs:** `no-cache`, o `s-maxage` con `stale-while-revalidate` si se puede cachear en la CDN.
- **Datos que se leen mucho y cambian poco:** caché en Redis con *cache-aside*. La app pregunta primero a Redis; si no está, lee de Postgres y lo guarda con TTL. Postgres sigue siendo la fuente de verdad. La clave lleva el ID de usuario si el dato es por usuario.

## 8. Imágenes y carga diferida

**Cómo se ve:** imágenes de más de 1 MB, en PNG o JPG, que se cargan todas al abrir; listas de 5.000 elementos renderizadas de una vez.

**Arreglo:**
- **Imágenes:** WebP o AVIF de menos de 200 KB, con `width` y `height`, y `loading="lazy"` fuera de la primera pantalla. Next: `next/image`. Para convertir: `sharp`, `squoosh` o la web de Squoosh (de Google).
- **Datos:** pagina (cursor o `limit`/`offset`) y carga al hacer scroll (*infinite scroll* o virtualización con `react-window` o TanStack Virtual).
- **Código:** divide el bundle con `import()` dinámico en lo que no se ve al inicio.

## 9. Un solo cuello de botella

**Cómo encontrarlo:** en DevTools › Network ordena por tiempo. En el backend, mide cada paso de la acción lenta (`console.time`, OpenTelemetry o el APM del hosting). Si una acción se lleva el 90 % del tiempo, **ese** es el problema y lo demás puede esperar.

**Arreglos típicos:**
- Llamadas en serie que podrían ir en paralelo (`Promise.all`).
- Una API externa lenta: cachéala, muévela a segundo plano o ponle timeout.
- Una consulta sin índice (punto 3).
- Una librería pesada que se puede reemplazar.

## 10. Prueba de carga

Una prueba de carga no demuestra que el sistema funciona: **descubre cuándo deja de funcionar**. Mejor encontrarlo tú que tus usuarios.

**Herramientas:** **k6** (JavaScript, con plantilla en `scripts/carga-k6.js`), **Locust** (Python), **Artillery**.

**Qué probar:**
- **Carga normal:** los usuarios esperados.
- **Pico** (*spike*): tráfico de golpe.
- **Estrés:** subir hasta que falle.
- **Resistencia** (*soak*): varias horas, para ver fugas de memoria.

**Cómo leerla:**
- **Nunca el promedio: p95 y p99.** El promedio esconde que 1 de cada 20 usuarios espera varios segundos.
- La tasa de errores (`http_req_failed`) también cuenta.
- Mira CPU, memoria y conexiones de la base mientras corre.

**Reglas:** solo contra local o staging con datos de prueba. Nunca contra producción, APIs de terceros o servicios que cobran por petición.
