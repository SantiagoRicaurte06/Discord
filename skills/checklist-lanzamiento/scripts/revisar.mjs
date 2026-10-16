#!/usr/bin/env node
// Revisa la carpeta compilada de un sitio (dist/, out/, build/…) contra los 15 puntos de lanzamiento.
// Uso: node revisar.mjs <carpeta> [--json]
// Sin dependencias (Node 18+). Termina con código 1 si algún punto falla (❌).
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname, basename } from 'node:path';

const args = process.argv.slice(2);
const raiz = args.find((a) => !a.startsWith('--'));
const comoJson = args.includes('--json');
if (!raiz || !existsSync(raiz) || !statSync(raiz).isDirectory()) {
  console.error('Uso: node revisar.mjs <carpeta-compilada> [--json]   (ej: dist, out, build)');
  process.exit(2);
}

// ---------- archivos ----------
const archivos = [];
(function recorrer(dir) {
  for (const nombre of readdirSync(dir)) {
    if (nombre === 'node_modules' || nombre.startsWith('.')) continue;
    const ruta = join(dir, nombre);
    const st = statSync(ruta);
    if (st.isDirectory()) recorrer(ruta);
    else archivos.push({ ruta, rel: relative(raiz, ruta).replaceAll('\\', '/'), ext: extname(nombre).toLowerCase(), tam: st.size });
  }
})(raiz);

const leer = (f) => readFileSync(f.ruta, 'utf8');
const html = archivos.filter((f) => f.ext === '.html');
const css = archivos.filter((f) => f.ext === '.css');
const js = archivos.filter((f) => ['.js', '.mjs'].includes(f.ext));
const imagenes = archivos.filter((f) => ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg'].includes(f.ext));
const paginas = html.map((f) => ({ ...f, src: leer(f) }));
const textoHtml = paginas.map((p) => p.src).join('\n');
const textoJs = js.filter((f) => f.tam < 3_000_000).map(leer).join('\n');
const todo = `${textoHtml}\n${textoJs}`;

const existe = (patron) => archivos.some((f) => patron.test(f.rel));
const enlaza = (patron) => patron.test(textoHtml) || patron.test(textoJs);
const kb = (b) => `${Math.round(b / 1024)} KB`;
const lista = (xs, n = 5) => xs.slice(0, n).join(', ') + (xs.length > n ? ` y ${xs.length - n} más` : '');

// ---------- puntos ----------
const r = [];
const punto = (n, nombre, estado, detalle) => r.push({ n, nombre, estado, detalle });

// 1. Privacidad
const privacidad = existe(/(privac|privacy)[^/]*(\/index)?\.html$/i) || enlaza(/href=["'][^"']*(privac|privacy)/i);
punto(1, 'Política de privacidad', privacidad ? 'ok' : 'error',
  privacidad ? 'Hay página o enlace de privacidad: revisa que el texto sea real.' : 'Falta una página o enlace /privacidad (o /privacy).');

// 2. Imágenes
const pesadas = imagenes.filter((f) => f.ext !== '.svg' && f.tam > 200 * 1024);
const viejas = imagenes.filter((f) => ['.png', '.jpg', '.jpeg'].includes(f.ext) && f.tam > 100 * 1024);
const soloViejas = viejas.filter((f) => !pesadas.includes(f));
punto(2, 'Compresión de imágenes',
  pesadas.length ? 'error' : soloViejas.length ? 'aviso' : 'ok',
  [pesadas.length ? `Más de 200 KB: ${lista(pesadas.map((f) => `${f.rel} (${kb(f.tam)})`))}` : '',
    soloViejas.length ? `Pasar a WebP/AVIF: ${lista(soloViejas.map((f) => `${f.rel} (${kb(f.tam)})`))}` : '']
    .filter(Boolean).join(' · ') || `${imagenes.length} imagen(es) revisadas.`);

// 3. Términos
const terminos = existe(/(termin|terms|condicion|legal)[^/]*(\/index)?\.html$/i) || enlaza(/href=["'][^"']*(termin|terms|condicion)/i);
punto(3, 'Términos y condiciones', terminos ? 'ok' : 'error',
  terminos ? 'Hay página o enlace de términos.' : 'Falta una página o enlace /terminos (o /terms).');

// 4. Sitemap y robots
const sitemap = archivos.find((f) => /^sitemap[\w-]*\.xml$/i.test(f.rel));
const robots = archivos.find((f) => f.rel === 'robots.txt');
let det4 = sitemap ? `${sitemap.rel} con ${(leer(sitemap).match(/<loc>/g) ?? []).length} URL(s)` : 'Falta sitemap.xml en la raíz';
det4 += robots ? (/sitemap:/i.test(leer(robots)) ? ' · robots.txt lo apunta' : ' · robots.txt no menciona el sitemap') : ' · falta robots.txt';
punto(4, 'sitemap.xml', !sitemap ? 'error' : !robots ? 'aviso' : 'ok', det4);

// 5. Títulos
const titulos = paginas.map((p) => ({ rel: p.rel, t: (p.src.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim(), desc: /<meta[^>]+name=["']description["']/i.test(p.src) }));
const sinTitulo = titulos.filter((x) => !x.t).map((x) => x.rel);
const repetidos = [...new Set(titulos.map((x) => x.t).filter((t, i, a) => t && a.indexOf(t) !== i))];
const sinDesc = titulos.filter((x) => !x.desc).map((x) => x.rel);
let est5 = 'ok';
const det5 = [];
if (sinTitulo.length) { est5 = 'error'; det5.push(`Sin <title>: ${lista(sinTitulo)}`); }
if (repetidos.length && paginas.length > 1) { est5 = est5 === 'error' ? est5 : 'aviso'; det5.push(`Títulos repetidos: ${lista(repetidos.map((t) => `"${t}"`))}`); }
if (sinDesc.length) { est5 = est5 === 'error' ? est5 : 'aviso'; det5.push(`Sin meta description: ${lista(sinDesc)}`); }
if (paginas.length === 1) det5.push('Un solo HTML (¿SPA?): revisa los títulos por ruta en el código.');
punto(5, 'Título en cada página', est5, det5.join(' · ') || `${paginas.length} página(s) con título único.`);

// 6. Formularios
const hayForm = /<form[\s>]/i.test(textoHtml) || /onSubmit|handleSubmit|<form/i.test(textoJs);
const senalesError = /aria-invalid|role=["']alert["']|aria-live|aria-errormessage|setCustomValidity|\berror(Message|s)?\b/i.test(todo);
punto(6, 'Estado de error en formularios',
  !hayForm ? 'ok' : senalesError ? 'aviso' : 'error',
  !hayForm ? 'No se detectaron formularios.' : senalesError ? 'Hay señales de manejo de errores: pruébalo a mano (vacío, inválido, sin red).' : 'Hay formularios sin señales de errores accesibles (aria-invalid, role="alert").');

// 7. Contacto real
const contacto = [...new Set(todo.match(/mailto:[^"'\s>]+|tel:[^"'\s>]+/gi) ?? [])];
const falso = contacto.filter((c) => /example\.|tudominio|yourdomain|test@|\b555\b|1234567/i.test(c));
punto(7, 'Dirección de contacto real',
  !contacto.length ? (existe(/contact/i) ? 'aviso' : 'error') : falso.length ? 'error' : 'aviso',
  !contacto.length ? 'No hay mailto: ni tel:. Agrega un correo o teléfono real.'
    : falso.length ? `Datos de ejemplo: ${lista(falso)}` : `Encontrado: ${lista(contacto, 3)}. Confirma que alguien responde.`);

// 13 (se calcula antes porque el 8 depende de él). Analíticas
const analiticas = [
  ['Google Analytics', /googletagmanager\.com|gtag\(|google-analytics\.com/i], ['Plausible', /plausible\.io/i],
  ['Umami', /umami/i], ['PostHog', /posthog/i], ['Vercel Analytics', /@vercel\/analytics|_vercel\/insights|va\.vercel-scripts/i],
  ['Microsoft Clarity', /clarity\.ms/i], ['Meta Pixel', /connect\.facebook\.net|fbq\(/i], ['Hotjar', /hotjar/i],
].filter(([, re]) => re.test(todo)).map(([n]) => n);
const conCookies = analiticas.some((n) => ['Google Analytics', 'Meta Pixel', 'Hotjar', 'Microsoft Clarity', 'PostHog'].includes(n));

// 8. Cookies
const banner = /cookie[\s-]?(banner|consent|notice)|consentimiento|aceptar cookies|accept (all )?cookies|cookieconsent|cookiebot|onetrust|klaro/i.test(todo);
punto(8, 'Banner de cookies',
  banner ? 'ok' : conCookies ? 'error' : 'aviso',
  banner ? 'Se detectó un aviso de cookies: verifica que tenga Rechazar y bloquee scripts antes de aceptar.'
    : conCookies ? `Usas ${lista(analiticas)} (con cookies) y no hay banner.` : 'No se detectó banner. Si no usas cookies no esenciales, decláralo en la política.');

// 9. Alt
const sinAlt = [];
const altPobre = [];
for (const p of paginas) {
  for (const img of p.src.match(/<img\b[^>]*>/gi) ?? []) {
    const alt = img.match(/\balt=["']([^"']*)["']/i);
    const src = img.match(/\bsrc=["']([^"']+)["']/i)?.[1] ?? '?';
    if (!alt) sinAlt.push(`${p.rel}: ${basename(src)}`);
    else if (/^(image|imagen|img|foto|photo|picture|logo)$|\.(png|jpe?g|webp|svg)$/i.test(alt[1].trim())) altPobre.push(`${p.rel}: alt="${alt[1]}"`);
  }
}
punto(9, 'Texto alternativo en imágenes',
  sinAlt.length ? 'error' : altPobre.length ? 'aviso' : 'ok',
  [sinAlt.length ? `Sin alt: ${lista(sinAlt)}` : '', altPobre.length ? `Alt poco descriptivo: ${lista(altPobre)}` : '']
    .filter(Boolean).join(' · ') || 'Todas las <img> del HTML tienen alt.');

// 10. 404
punto(10, 'Página 404 personalizada',
  existe(/(^|\/)(404|not-found)(\/index)?\.html$/i) ? 'ok' : paginas.length === 1 ? 'aviso' : 'error',
  existe(/(^|\/)(404|not-found)(\/index)?\.html$/i) ? 'Existe 404.html.' : paginas.length === 1 ? 'SPA: revisa que el router tenga ruta "*" y el hosting sirva index.html.' : 'Falta 404.html.');

// 11. Gracias
const gracias = existe(/(gracias|thank|success|exito|confirm)[^/]*(\/index)?\.html$/i) || enlaza(/\/(gracias|thank-?you|thanks|success)/i);
punto(11, 'Página de "Gracias"', gracias ? 'ok' : hayForm ? 'error' : 'aviso',
  gracias ? 'Hay página de confirmación: que diga qué pasa ahora y ofrezca un siguiente paso.'
    : hayForm ? 'Tras enviar un formulario debe haber una página o estado de confirmación.' : 'Sin formularios: solo hace falta si hay registros o compras.');

// 12. Móvil
const sinViewport = paginas.filter((p) => !/<meta[^>]+name=["']viewport["']/i.test(p.src)).map((p) => p.rel);
const media = css.map(leer).join('\n').match(/@media[^{]*\(\s*(min|max)-width/gi)?.length ?? 0;
const tailwind = /\b(sm|md|lg|xl):[a-z]/.test(textoHtml);
punto(12, 'Breakpoints para móvil',
  sinViewport.length ? 'error' : media || tailwind ? 'ok' : 'aviso',
  sinViewport.length ? `Sin meta viewport: ${lista(sinViewport)}` : `${media} media queries${tailwind ? ' + clases responsive' : ''}. Pruébalo en 375 y 768 px.`);

// 13. Analíticas
punto(13, 'Analíticas', analiticas.length ? 'ok' : 'error',
  analiticas.length ? `Detectado: ${lista(analiticas)}` : 'No se detectó ninguna herramienta de analíticas.');

// 14. Favicon
const icono = archivos.filter((f) => /(favicon|icon|apple-touch)[^/]*\.(ico|png|svg)$/i.test(f.rel));
const plantilla = archivos.filter((f) => /(^|\/)(vite|react|next|vercel|astro|svelte|nuxt)\.svg$/i.test(f.rel)).map((f) => f.rel);
const usaPlantilla = /href=["'][^"']*\/(vite|react|next|vercel)\.svg/i.test(textoHtml);
punto(14, 'Favicon personalizado',
  usaPlantilla || !icono.length ? 'error' : plantilla.length ? 'aviso' : 'ok',
  usaPlantilla ? 'El favicon es el del template (vite.svg / react / next).'
    : !icono.length ? 'No hay favicon.' : plantilla.length ? `Quedan logos del template: ${lista(plantilla)}` : `Encontrado: ${lista(icono.map((f) => f.rel))}`);

// 15. Open Graph
const sinOg = paginas.filter((p) => !/property=["']og:image["']/i.test(p.src)).map((p) => p.rel);
const ogRelativa = paginas.filter((p) => /property=["']og:image["'][^>]+content=["']\/(?!\/)/i.test(p.src) || /content=["']\/(?!\/)[^"']*["'][^>]+property=["']og:image["']/i.test(p.src)).map((p) => p.rel);
punto(15, 'Imagen Open Graph',
  sinOg.length === paginas.length ? 'error' : sinOg.length || ogRelativa.length ? 'aviso' : 'ok',
  sinOg.length === paginas.length ? 'Ninguna página tiene og:image.'
    : [sinOg.length ? `Sin og:image: ${lista(sinOg)}` : '', ogRelativa.length ? `og:image con URL relativa (debe ser absoluta): ${lista(ogRelativa)}` : ''].filter(Boolean).join(' · ') || 'Todas las páginas tienen og:image.');

// ---------- salida ----------
r.sort((a, b) => a.n - b.n);
if (comoJson) {
  console.log(JSON.stringify({ carpeta: raiz, paginas: paginas.length, resultados: r }, null, 2));
} else {
  const icono2 = { ok: '✅', aviso: '⚠️ ', error: '❌' };
  console.log(`\nChecklist de lanzamiento · ${raiz} · ${paginas.length} página(s) HTML\n`);
  for (const x of r) console.log(`${icono2[x.estado]} ${String(x.n).padStart(2)}. ${x.nombre}\n      ${x.detalle}`);
  const c = (e) => r.filter((x) => x.estado === e).length;
  console.log(`\nResultado: ${c('ok')} ✅ · ${c('aviso')} ⚠️  · ${c('error')} ❌`);
  console.log('Lo marcado con ⚠️ y los puntos 6, 7 y 12 necesitan una revisión manual.\n');
}
process.exit(r.some((x) => x.estado === 'error') ? 1 : 0);
