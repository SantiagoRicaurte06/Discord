#!/usr/bin/env node
// Busca señales de los 10 puntos de rendimiento en el código fuente (JS/TS, Python, SQL, Prisma) y en las imágenes.
// Uso: node revisar.mjs <carpeta> [--json]
// Sin dependencias (Node 18+). Termina con código 1 si algún punto falla (❌).
// Son SEÑALES, no mediciones: confirma con el log de consultas, EXPLAIN ANALYZE, Lighthouse o una prueba de carga.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const args = process.argv.slice(2);
const raiz = args.find((a) => !a.startsWith('--'));
const comoJson = args.includes('--json');
if (!raiz || !existsSync(raiz) || !statSync(raiz).isDirectory()) {
  console.error('Uso: node revisar.mjs <carpeta-del-codigo> [--json]');
  process.exit(2);
}

// ---------- archivos ----------
const IGNORAR = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'out', 'coverage', '.venv', 'venv', '__pycache__', '.turbo', '.vercel', 'skills', 'evals', '.claude', '.agents', 'cerebro']);
const EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.sql', '.prisma', '.vue', '.svelte', '.astro']);
const EXT_IMG = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif']);
const archivos = [];
const imagenes = [];
(function recorrer(dir) {
  for (const nombre of readdirSync(dir)) {
    if (IGNORAR.has(nombre) || nombre.startsWith('.')) continue;
    const ruta = join(dir, nombre);
    const st = statSync(ruta);
    const rel = relative(raiz, ruta).replaceAll('\\', '/');
    const ext = extname(nombre).toLowerCase();
    if (st.isDirectory()) recorrer(ruta);
    else if (EXT_IMG.has(ext)) imagenes.push({ rel, ext, tam: st.size });
    else if (EXT.has(ext) && st.size < 1_500_000 && !/(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[jt]sx?$/i.test(rel)) {
      const src = readFileSync(ruta, 'utf8');
      archivos.push({ rel, ext, src, lineas: src.split(/\r?\n/) });
    }
  }
})(raiz);

const codigo = archivos.filter((f) => !['.sql', '.prisma'].includes(f.ext));
const front = codigo.filter((f) => ['.tsx', '.jsx', '.vue', '.svelte', '.astro'].includes(f.ext) || /(^|\/)(components|app|pages|src\/(components|pages|hooks|features))\//.test(f.rel));
const todo = archivos.map((f) => f.src).join('\n');
const pkg = (() => { try { return readFileSync(join(raiz, 'package.json'), 'utf8'); } catch { return ''; } })();
const pyreq = ['requirements.txt', 'pyproject.toml'].map((n) => { try { return readFileSync(join(raiz, n), 'utf8'); } catch { return ''; } }).join('\n');
const deps = `${pkg}\n${pyreq}`;

const lista = (xs, n = 6) => xs.slice(0, n).join(', ') + (xs.length > n ? ` y ${xs.length - n} más` : '');
const unir = (...p) => p.filter(Boolean).join(' · ');
const kb = (b) => `${Math.round(b / 1024)} KB`;
const donde = (re, fs = codigo) => fs.flatMap((f) => f.lineas.flatMap((l, i) => (re.test(l) ? [`${f.rel}:${i + 1}`] : [])));

// Llamadas a la base de datos (lectura y escritura) en varios ORMs
const LEE = /\b(await|yield)\b[^;\n]*\.(findUnique|findFirst|findOne|findById|findByPk|findMany|findAll|find|get|query|select|raw|execute|fetch)\s*\(|\.objects\.(get|filter)\(|session\.(query|get|execute)\(|\bfrom\(\s*['"][\w.]+['"]\s*\)\s*\.select/;
const ESCRIBE = /\b(await|yield)\b[^;\n]*\.(create|insert|insertOne|save|update|updateOne|upsert|put|add)\s*\(|\.objects\.create\(|session\.add\(|INSERT\s+INTO/i;
const BUCLE = /\bfor\s*\(|\bfor\s+\w+\s+in\b|\bwhile\s*\(|\.forEach\(\s*async|\.map\(\s*async|\bfor await\b/;

// Busca llamadas dentro del cuerpo de un bucle (ventana de 12 líneas o hasta que baja la indentación)
function dentroDeBucles(re) {
  const hits = [];
  for (const f of codigo) {
    f.lineas.forEach((l, i) => {
      if (!BUCLE.test(l)) return;
      const ind = l.match(/^\s*/)[0].length;
      for (let j = i + 1; j < Math.min(f.lineas.length, i + 13); j++) {
        const lj = f.lineas[j];
        if (lj.trim() && lj.match(/^\s*/)[0].length <= ind && !/^\s*[)}\]]/.test(lj)) break;
        if (re.test(lj)) { hits.push(`${f.rel}:${j + 1}`); break; }
      }
      if (re.test(l.slice(l.search(BUCLE)))) hits.push(`${f.rel}:${i + 1}`);
    });
  }
  return [...new Set(hits)];
}

const usaBD = /prisma|drizzle|sequelize|typeorm|mongoose|knex|kysely|@supabase|pg\b|mysql|sqlite|sqlalchemy|django|psycopg|asyncpg/i.test(deps) || /\.(findMany|findUnique)\(|SELECT\s|\.objects\./.test(todo);
const r = [];
const punto = (n, nombre, estado, detalle) => r.push({ n, nombre, estado, detalle });

// 1. N+1
const n1 = dentroDeBucles(LEE);
const conInclude = /include\s*:|select_related|prefetch_related|joinedload|selectinload|DataLoader|\bin\s*:\s*\[|\.in\(\s*['"]\w+['"]|IN\s*\(/i.test(todo);
punto(1, 'Consultas N+1', !usaBD ? 'ok' : n1.length ? 'error' : 'ok',
  !usaBD ? 'No aplica: no se detectó base de datos.'
    : n1.length ? `Consultas dentro de un bucle (una por elemento): ${lista(n1)}. Junta los IDs o usa include/select_related.`
      : `No se vieron consultas dentro de bucles${conInclude ? '; se usan include/IN para traer relaciones' : ''}.`);

// 2. Escrituras en lote
const unaPorUna = dentroDeBucles(ESCRIBE);
punto(2, 'Escrituras en lote', !usaBD ? 'ok' : unaPorUna.length ? 'error' : 'ok',
  !usaBD ? 'No aplica.' : unaPorUna.length ? `Escrituras una por una dentro de un bucle: ${lista(unaPorUna)}. Usa createMany/insertMany/bulk_create.`
    : 'No se vieron escrituras dentro de bucles.');

// 3. Índices
const sqls = archivos.filter((f) => f.ext === '.sql');
const prisma = archivos.filter((f) => f.ext === '.prisma');
const nIndices = (todo.match(/create\s+(unique\s+)?index|@@index|@@unique|@unique|index\s*:\s*true|db_index\s*=\s*True|Index\(|\.index\(/gi) ?? []).length;
const nTablas = (todo.match(/create\s+table|^\s*model\s+\w+\s*\{|class\s+\w+\((models\.Model|Base)\)/gim) ?? []).length;
const likes = donde(/LIKE\s+['"`]%|ilike\s*\(|\.ilike\(|contains\s*:\s*|icontains|\.like\(\s*['"]\w+['"]\s*,\s*['"`]%/i, archivos);
punto(3, 'Índices', !usaBD ? 'ok' : nTablas && !nIndices ? 'aviso' : likes.length ? 'aviso' : 'ok',
  !usaBD ? 'No aplica.' : unir(nTablas ? `${nTablas} tabla(s)/modelo(s) y ${nIndices} índice(s) declarados` : 'Sin esquema en el repo (¿migraciones en otro lado?)',
    nTablas && !nIndices ? 'ningún índice además de las llaves primarias: indexa las columnas por las que buscas, filtras u ordenas' : '',
    likes.length ? `Búsquedas con LIKE/contains '%…%' (no usan índice normal): ${lista(likes, 4)}` : '',
    'Confirma con EXPLAIN ANALYZE en la consulta más lenta'));

// 4. Interfaz optimista
const mutaciones = donde(/useMutation\(|useSWRMutation|mutate\(|startTransition|action=\{|formAction/, front);
const optimista = /useOptimistic|onMutate|optimisticData|optimisticResponse/.test(todo);
punto(4, 'Interfaz optimista', !front.length ? 'ok' : !mutaciones.length ? 'ok' : optimista ? 'ok' : 'aviso',
  !front.length ? 'No aplica: no se detectó frontend.' : !mutaciones.length ? 'No se detectaron mutaciones en el frontend.'
    : optimista ? 'Hay actualizaciones optimistas (useOptimistic/onMutate).' : `Mutaciones sin actualización optimista: ${lista(mutaciones, 4)}. Para acciones reversibles, muestra el cambio al instante.`);

// 5. Tareas largas asíncronas
const largas = donde(/^(?!\s*(import|from|const\s+\w+\s*=\s*require)\b).*(?:sendMail\(|\.emails\.send\(|sgMail\.send|nodemailer|puppeteer|playwright\.|pdfkit|PDFDocument|@react-pdf|messages\.create\(|chat\.completions\.create\(|generateText\(|sharp\(|ffmpeg|send_mail\(|EmailMessage)/);
const cola = /bullmq|bull\b|pg-boss|inngest|@trigger\.dev|graphile-worker|agenda|bee-queue|celery|rq\b|dramatiq|waitUntil|\bafter\(|setImmediate|queueMicrotask|@vercel\/functions|Cloud Tasks|SQS|kafka|rabbitmq|amqplib/i.test(`${deps}\n${todo}`);
punto(5, 'Tareas largas asíncronas', !largas.length ? 'ok' : cola ? 'aviso' : 'error',
  !largas.length ? 'No se vieron tareas largas (correos, PDFs, IA, video) en el código.'
    : unir(`Tareas largas en: ${lista(largas, 5)}`, cola ? 'hay cola/segundo plano: confirma que estas no bloquean la respuesta' : 'sin cola ni segundo plano: el usuario espera a que terminen'));

// 6. Páginas estáticas o cacheadas
const dinamicas = donde(/force-dynamic|cache:\s*['"]no-store['"]|revalidate\s*=\s*0\b|getServerSideProps|export\s+const\s+dynamic\s*=\s*['"]force-dynamic/);
const esNext = /"next"/.test(pkg);
punto(6, 'Páginas estáticas o cacheadas', dinamicas.length ? 'aviso' : 'ok',
  dinamicas.length ? `Páginas forzadas a renderizar en cada visita: ${lista(dinamicas, 5)}. Si el contenido es igual para todos, usa SSG o revalidate.`
    : esNext ? 'No se vieron páginas forzadas a dinámicas.' : 'No aplica o no se detectó renderizado en el servidor.');

// 7. Compresión y caché HTTP
const express = /"(express|fastify|koa|hono)"/.test(pkg);
const compresion = /"(compression|@fastify\/compress|koa-compress)"|compress\(\)|GZipMiddleware|gzip on|brotli/i.test(`${deps}\n${todo}`);
const cacheHttp = /Cache-Control|cache-control|s-maxage|stale-while-revalidate|maxAge|max-age/.test(todo) || existsSync(join(raiz, 'vercel.json')) || existsSync(join(raiz, '_headers'));
const redis = /redis|ioredis|@upstash\/redis|memcached|lru-cache|node-cache|@vercel\/kv|functools\.lru_cache|django\.core\.cache/i.test(`${deps}\n${todo}`);
punto(7, 'Compresión y caché HTTP', express && !compresion ? 'error' : !cacheHttp ? 'aviso' : 'ok',
  unir(express ? (compresion ? 'Hay compresión' : 'Servidor Node sin compresión (app.use(compression()))') : 'Sin servidor Node propio (el hosting suele comprimir)',
    cacheHttp ? 'hay cabeceras de caché' : 'no se vieron cabeceras Cache-Control',
    redis ? 'hay caché de datos (Redis/LRU)' : ''));

// 8. Imágenes y carga diferida
const pesadas = imagenes.filter((i) => i.tam > 200 * 1024).sort((a, b) => b.tam - a.tam);
const viejas = imagenes.filter((i) => ['.png', '.jpg', '.jpeg'].includes(i.ext) && i.tam > 100 * 1024);
const sinLazy = front.reduce((n, f) => n + (f.src.match(/<img\b(?![^>]*loading=)[^>]*>/gi) ?? []).length, 0);
const sinPaginar = donde(/\.findMany\(\s*\)|\.findAll\(\s*\)|\.objects\.all\(\)|\.select\(\s*['"]\*['"]\s*\)(?![^;\n]*\.(range|limit))/);
punto(8, 'Imágenes y carga diferida', pesadas.some((i) => i.tam > 1024 * 1024) ? 'error' : pesadas.length || sinLazy || sinPaginar.length ? 'aviso' : 'ok',
  unir(pesadas.length ? `Imágenes de más de 200 KB: ${lista(pesadas.map((i) => `${i.rel} (${kb(i.tam)})`), 4)}` : `${imagenes.length} imagen(es) en el repo`,
    viejas.length ? `${viejas.length} en PNG/JPG: pásalas a WebP/AVIF` : '',
    sinLazy ? `${sinLazy} <img> sin loading="lazy"` : '',
    sinPaginar.length ? `Consultas que traen la tabla completa (sin take/limit): ${lista(sinPaginar, 4)}` : ''));

// 9. Un solo cuello de botella
const enSerie = codigo.flatMap((f) => f.lineas.flatMap((l, i) => {
  const a = /^\s*(const|let)\s+\w+\s*=\s*await\s+/;
  return a.test(l) && a.test(f.lineas[i + 1] ?? '') && a.test(f.lineas[i + 2] ?? '') && !a.test(f.lineas[i - 1] ?? '') ? [`${f.rel}:${i + 1}`] : [];
}));
const sinTimeout = codigo.filter((f) => /fetch\(\s*['"`]https?:|axios\.(get|post)\(\s*['"`]https?:/.test(f.src) && !/AbortSignal|timeout|AbortController/.test(f.src)).map((f) => f.rel);
punto(9, 'Un solo cuello de botella', 'aviso',
  unir(enSerie.length ? `3+ await seguidos (¿podrían ir en paralelo con Promise.all?): ${lista(enSerie, 4)}` : '',
    sinTimeout.length ? `Llamadas a APIs externas sin timeout: ${lista(sinTimeout, 4)}` : '',
    'Mide a mano: DevTools › Network ordenado por tiempo; si una acción se lleva el 90 %, ese es el problema'));

// 10. Prueba de carga
const carga = archivos.some((f) => /from ['"]k6|import http from ['"]k6\/http|from locust import|HttpUser/.test(f.src)) || /"(artillery|k6|autocannon)"|locust/i.test(deps) || existsSync(join(raiz, 'artillery.yml'));
punto(10, 'Prueba de carga', carga ? 'ok' : 'aviso',
  carga ? 'Hay pruebas de carga: revisa que midan p95 y p99 y corran contra staging.'
    : 'No hay pruebas de carga. Si esperas tráfico, adapta scripts/carga-k6.js al endpoint principal (solo local o staging).');

// ---------- salida ----------
r.sort((a, b) => a.n - b.n);
if (comoJson) {
  console.log(JSON.stringify({ carpeta: raiz, archivos: archivos.length, imagenes: imagenes.length, resultados: r }, null, 2));
} else {
  const ic = { ok: '✅', aviso: '⚠️ ', error: '❌' };
  console.log(`\nRevisión de rendimiento · ${raiz} · ${archivos.length} archivo(s) · ${imagenes.length} imagen(es)\n`);
  for (const x of r) console.log(`${ic[x.estado]} ${String(x.n).padStart(2)}. ${x.nombre}\n      ${x.detalle}`);
  const c = (e) => r.filter((x) => x.estado === e).length;
  console.log(`\nResultado: ${c('ok')} ✅ · ${c('aviso')} ⚠️  · ${c('error')} ❌`);
  console.log('Son señales: mide antes y después (log de consultas, EXPLAIN ANALYZE, Lighthouse, k6). El 9 siempre se confirma a mano.\n');
}
process.exit(r.some((x) => x.estado === 'error') ? 1 : 0);
