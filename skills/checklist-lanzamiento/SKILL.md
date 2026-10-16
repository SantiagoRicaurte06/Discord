---
name: checklist-lanzamiento
description: Revisa que un sitio web esté listo para producción antes de deployar con los 15 puntos que suelen faltar en páginas hechas con IA (privacidad, términos, sitemap, títulos, imágenes, formularios, contacto, cookies, alt, 404, gracias, móvil, analíticas, favicon, Open Graph). Úsala cuando digan "antes de deployar", "checklist de lanzamiento", "¿está lista la página?", "revisa el sitio para producción" o al terminar una landing.
---

# Checklist de lanzamiento web

Una página hecha con IA se ve completa, pero le suelen faltar cosas que una página real necesita. Esta skill revisa los 15 puntos, arregla lo que falte y entrega un reporte.

## Flujo

1. **Detecta el stack**: Next.js (App o Pages Router), Astro, Vite/React, SvelteKit, Nuxt o HTML plano. Mira `package.json` y la estructura de carpetas.
2. **Compila** el sitio con su comando habitual (`npm run build`) e identifica la carpeta de salida (`out/`, `dist/`, `build/`, `.next/` no sirve: usa `next build` con `output: 'export'` o revisa el código fuente).
3. **Corre el revisor automático** sobre esa carpeta:
   ```bash
   node <ruta-de-esta-skill>/scripts/revisar.mjs dist
   ```
   Imprime cada punto como ✅ / ⚠️ / ❌ y termina con código 1 si hay errores.
4. **SPA (React/Vite sin prerender)**: el HTML compilado es un solo `index.html`, así que títulos, Open Graph y páginas como 404 o gracias se resuelven en el router. Revisa el código fuente además del script.
5. **Arregla** cada ❌ y ⚠️ con la guía de abajo, usando la forma idiomática del framework. No inventes datos legales ni de contacto: si faltan, deja un `TODO` visible y avisa.
6. **Revisión manual** de lo que el script no puede comprobar (ver "Lo que hay que mirar a mano").
7. **Reporte final**: tabla con los 15 puntos, estado y qué se hizo. Lista los pendientes que necesitan decisión humana (textos legales, dirección real, proveedor de analíticas).

## Los 15 puntos y cómo arreglarlos

| # | Punto | Qué debe existir | Cómo arreglarlo |
|---|---|---|---|
| 1 | **Política de privacidad** | Página `/privacidad` enlazada desde el footer | Página con qué datos se recogen, para qué, cookies, terceros (analíticas, formularios), derechos y contacto. Si hay usuarios en la UE o Colombia, menciona GDPR / Ley 1581 de 2012. |
| 2 | **Compresión de imágenes** | Imágenes < 200 KB, en WebP/AVIF, con tamaño declarado | Next: `next/image`. Astro: `<Image />`. Otros: `npx sharp-cli` o `squoosh-cli` a WebP/AVIF, `width`/`height` y `loading="lazy"` fuera de la primera pantalla. |
| 3 | **Términos y condiciones** | Página `/terminos` enlazada desde el footer | Uso del servicio, responsabilidades, pagos o reembolsos si aplica, ley aplicable, contacto. |
| 4 | **sitemap.xml** (+ `robots.txt`) | `/sitemap.xml` con todas las URLs públicas y `robots.txt` que lo apunte | Next: `app/sitemap.ts` y `app/robots.ts`. Astro: `@astrojs/sitemap`. Otros: generarlo en el build. Necesita el dominio real. |
| 5 | **Título en cada página** | `<title>` único y descriptivo por página + `meta description` | Next: `export const metadata` o `generateMetadata`. Astro: en el layout con props. React SPA: `react-helmet-async` o `document.title` por ruta. Formato: `Página · Marca`, ≤ 60 caracteres. |
| 6 | **Estado de error en formularios** | Mensaje claro por campo, en el lugar del error, accesible | Validar en cliente y servidor, mostrar el error junto al campo, `aria-invalid="true"` y `aria-describedby` apuntando al mensaje, un resumen con `role="alert"`, conservar lo escrito, estado de carga en el botón y manejo del fallo de red. |
| 7 | **Dirección de contacto real** | Correo, teléfono o dirección reales, visibles | `mailto:`/`tel:` con datos verdaderos en el footer o en `/contacto`. Nunca `example.com`, `123 Main St` ni `+1 555`. |
| 8 | **Banner de cookies** | Aviso con aceptar y rechazar antes de cargar cookies no esenciales | Si hay analíticas o publicidad con cookies: banner con *Aceptar* y *Rechazar* del mismo peso visual, enlace a privacidad, y cargar los scripts solo tras aceptar. Si solo usas analíticas sin cookies (Plausible, Umami, Vercel Analytics) puede no hacer falta: dilo en la política. |
| 9 | **Texto alternativo** | `alt` descriptivo en cada `<img>` con contenido; `alt=""` solo en decorativas | Describe qué muestra la imagen y para qué está. Nada de `alt="image"` ni el nombre del archivo. |
| 10 | **404 personalizada** | Página 404 con la marca, mensaje claro y enlace al inicio | Next: `app/not-found.tsx`. Astro: `src/pages/404.astro`. Hosting estático: `404.html`. SPA: ruta comodín `*` y configurar el hosting para servir `index.html`. |
| 11 | **Página de "Gracias"** | Página o estado de confirmación tras enviar un formulario o comprar | Redirigir a `/gracias` tras el envío exitoso, decir qué pasa ahora (respuesta en X horas, correo de confirmación) y ofrecer un siguiente paso. Sirve también para medir conversiones. |
| 12 | **Breakpoints para móvil** | `meta viewport` y diseño que funcione en 375, 768 y 1024 px | `<meta name="viewport" content="width=device-width, initial-scale=1">`, media queries o utilidades responsive, botones de al menos 44×44 px, sin scroll horizontal. |
| 13 | **Analíticas** | Herramienta instalada y midiendo visitas y conversiones | Plausible, Umami, Vercel Analytics o Google Analytics 4. Marca la página de gracias o el envío como conversión. Respeta el banner de cookies (punto 8). |
| 14 | **Favicon personalizado** | Favicon propio, no el del template (`vite.svg`, logo de React, Next) | `favicon.ico` 32×32, `icon.svg`, `apple-touch-icon.png` 180×180. Next: `app/icon.png` y `app/apple-icon.png`. |
| 15 | **Imagen Open Graph** | `og:image` de 1200×630 en cada página importante | `og:title`, `og:description`, `og:image` (URL absoluta), `og:url` y `twitter:card=summary_large_image`. Next: `app/opengraph-image.png` o `.tsx`. Prueba con opengraph.xyz. |

## Lo que hay que mirar a mano

El script detecta señales, pero no puede confirmar:
- **Formularios (6)**: envía uno vacío y uno con datos inválidos. ¿El error aparece junto al campo y se entiende? ¿Qué pasa sin conexión?
- **Contacto real (7)**: que el correo o teléfono existan y alguien los responda.
- **Móvil (12)**: abre el sitio en 375 px (iPhone SE) y 768 px. Sin scroll horizontal, texto legible, menú usable.
- **Textos legales (1, 3)**: que no sean genéricos copiados y que mencionen la empresa real.
- **Analíticas (13)**: que la visita aparezca de verdad en el panel después de deployar.

## Reglas

- No inventes datos legales, direcciones, teléfonos ni IDs de analíticas. Pregunta o deja un `TODO` visible.
- No agregues un banner de cookies si el sitio no usa cookies no esenciales; explícalo en la política.
- Arregla con las herramientas del framework antes que con librerías nuevas.
- Termina siempre con el reporte de los 15 puntos, aunque todo esté bien.
