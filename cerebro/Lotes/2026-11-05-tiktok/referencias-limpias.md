---
tipo: lote
fecha: 2026-11-05
videos: 43
plataforma: tiktok
---

# Referencias limpias · lote 2026-11-05 (TikTok)

43 links ([[enlaces]]):
- 17 ya se procesaron en el [[2026-11-04-tiktok/referencias-limpias|lote 2026-11-04]] y llevan un bloque corto.
- 26 son nuevos.
- De los nuevos, 23 son videos transcritos completos con Whisper `small` sobre el audio original, y 3 son carruseles de fotos de los que solo hay descripción.

Lo marcado `[verificar]` no se pudo confirmar con el audio ni con la imagen.

---

## Ya procesados en el lote anterior

| # | Video | Lote 2026-11-04 | Idea clave |
|---|---|---|---|
| 01 | [20 cosas para que no demanden tu app](https://vt.tiktok.com/ZSpFFdqbb/) | #13 | checklist legal de 20 puntos (versión México) |
| 02 | [5 maneras de mejorar la rapidez de tu app](https://vt.tiktok.com/ZSpFNGySC/) | #14 | actualización optimista, comprimir JSON, HTML estático, escrituras en lote, cuello de botella |
| 03 | [¿Qué es Clean Code?](https://vt.tiktok.com/ZSpFFLujx/) | #15 | nombres claros, una función hace una cosa, regla del Boy Scout; tomarlo como guía |
| 04 | [4 señales de que tu app fue hecha con IA](https://vt.tiktok.com/ZSpFNtBk8/) | #16 | textos de IA, degradado morado, sin favicon, sin estados de carga |
| 05 | [Una Server Action es un endpoint público](https://vt.tiktok.com/ZSpFNskK6/) | #17 | verificar sesión, validar con esquema, comprobar dueño y devolver lo mínimo |
| 06 | [Si puedes descifrar una contraseña…](https://vt.tiktok.com/ZSpFFFkHb/) | #18 | hashear con argon2 o bcrypt y salt; nunca cifrar |
| 07 | [El "olvidé mi contraseña"…](https://vt.tiktok.com/ZSpFNwp3y/) | #19 | token de un uso que expira, la misma respuesta, cerrar sesiones |
| 08 | [SkillSpector: revisa las skills antes de instalarlas](https://vt.tiktok.com/ZSpFNvhSR/) | #20 | revisar skills de terceros antes de instalarlas (link sin verificar) |
| 09 | [Motion graphics con Claude](https://vt.tiktok.com/ZSpFF25SV/) | #21 | prompt-motion.com con el sistema de diseño de tu marca |
| 10 | [Animation Performance (Emil Kowalski)](https://vt.tiktok.com/ZSpFFY8q9/) | #22 | animar `transform` y `opacity`, no ancho ni posición |
| 11 | [Del neón al SaaS minimalista](https://vt.tiktok.com/ZSpFNscex/) | #23 | estética, sin voz |
| 12 | [10 animaciones para pedirle a Claude](https://vt.tiktok.com/ZSpFN3UYC/) | #24 | vocabulario de estilos visuales |
| 13 | [¿Por qué la IA siempre mete Supabase?](https://vt.tiktok.com/ZSpFNcde4/) | #25 | sin RLS, cualquiera lee tus datos |
| 14 | [Archify: diagrama interactivo](https://vt.tiktok.com/ZSpFN3LRf/) | #26 | diagrama de arquitectura del repo |
| 15 | [10 cosas de seguridad (WordPress)](https://vt.tiktok.com/ZSpFNcd7d/) | #27 | checklist de WordPress |
| 16 | [Ranking después de publicar tu web](https://vt.tiktok.com/ZSpFNTjmS/) | #28 | Search Console y Clarity (S), Analytics y Pixel (A) |
| 43 | [Que tu web sea legal: 9 prompts](https://vt.tiktok.com/ZSpFFp6Sg/) | #29 | prompt legal y registro trazable del consentimiento |

---

## Videos nuevos

### 17. [¿Qué es la arquitectura basada en características (feature-based)?](https://vt.tiktok.com/ZSpFF9npT/)
**Canal:** @davidev.tech · **Duración:** 01:56 · **Tema principal:** organizar el código por funcionalidad en vez de por tipo de archivo.

**Idea clave:** si organizas por tipo de archivo (controladores, servicios, repositorios), un cambio pequeño, como agregar un cupón a los pedidos, te obliga a tocar cinco carpetas. Por características, cada carpeta es una parte del negocio con todo lo que necesita adentro.

**Puntos útiles:**
- **Backend (NestJS):** `pedidos/` tiene su controlador, servicio, repositorio y un módulo que los une. Las capas siguen existiendo, pero dentro de la característica.
- **Regla clave:** pedidos nunca toca el repositorio de usuarios; le pide los datos a `UsuariosService`, que es lo único que ese módulo exporta.
- **Frontend (React):** `features/pedidos/` tiene sus componentes, hooks y llamadas a la API. El `index` es la puerta de entrada: la página importa desde ahí, nunca de un archivo interno.
- Una característica no importa a otra; se juntan en la página.
- Lo compartido, como los botones, va en una carpeta aparte.

**Advertencias / errores comunes:** en una app pequeña puede ser demasiada estructura. Brilla cuando el proyecto crece y hay varios equipos.

**Aplicación práctica:** el bot de este repo (`src/`) está organizado por tipo de archivo. Si crece, conviene pasarlo a `features/`.

---

### 18. [5 razones por las que tu app hecha con IA es lenta](https://vt.tiktok.com/ZSpFFD4BT/)
**Canal:** @juanjimenezsieber · **Duración:** 01:19 · **Tema principal:** rendimiento que el agente no hace en la primera versión.

**Puntos útiles:**
1. **Escrituras una por una** en la base de datos, en vez de en lote.
2. **Sin renderizado optimista:** cada acción espera la respuesta del backend.
3. **La página no es estática:** el HTML se reconstruye para cada usuario.
4. **Cuello de botella en una dependencia:** se encuentra auditando las peticiones de red del frontend y viendo cuál tiene más latencia.
5. **Todas las peticiones son síncronas:** las tareas largas deberían ser asíncronas (cola o trabajo en segundo plano).

**Aplicación práctica:** casi idéntico al #02 (mismo guion, otro autor); este agrega el punto 5. Junto con el 25, el 31 y el 38 forman una revisión de rendimiento (ver la síntesis).

---

### 19. [Confirmaciones con fricción progresiva (UX)](https://vt.tiktok.com/ZSpFFHe4a/)
**Canal:** @liberman_ux · **Duración:** 00:50 · **Tema principal:** evitar borrados por error sin abusar del "¿Estás seguro?".

**Idea clave:** si todo pide confirmación, el usuario aprende a darle "Aceptar" sin mirar y la confirmación deja de proteger. La fricción se dosifica según el riesgo de la acción.

**Pasos o procesos concretos:**
1. **Bajo impacto** (descartar un borrador): se ejecuta al instante y deja una barra para **deshacer**.
2. **Riesgo medio** (eliminar un archivo): el botón se transforma en su lugar y pide un **segundo toque en rojo**, sin ventana emergente.
3. **Crítico e irreversible** (borrar un proyecto): hay que **escribir el nombre exacto**. Por inercia cualquiera hace clic, pero nadie escribe un nombre completo por accidente.

**Aplicación práctica:** aplicable a nuestras apps. En el bot, el botón "Eliminar proyecto" podría pedir escribir el nombre del proyecto `[verificar cómo está hoy]`.

---

### 20. [¿Redis o PostgreSQL?](https://vt.tiktok.com/ZSpFFP878/)
**Canal:** @davidev.tech · **Duración:** 01:01 · **Tema principal:** para qué sirve cada uno y cómo se combinan.

**Idea clave:** **Postgres es tu fuente de verdad y Redis tu memoria rápida.** En producción se usan juntos.

**Puntos útiles:**

| | Redis | PostgreSQL |
|---|---|---|
| Dónde guarda | En memoria, como clave y valor | En disco, en tablas relacionadas |
| Cómo se consulta | Por clave directa | SQL: filtros, joins y agregaciones |
| Si se va la luz | Snapshots o AOF; según la configuración puede perder las últimas escrituras | Registra cada transacción antes de confirmarla |
| Para qué | Caché, sesiones y contadores | Pedidos, pagos y todo lo que no puedes perder |

- **Patrón cache-aside:** la app pregunta primero a Redis; si no está, lee de Postgres y guarda el dato en Redis.

**Datos y cifras:** Redis responde en menos de 1 ms.

---

### 21. [Qué debe tener una página web para tu negocio](https://vt.tiktok.com/ZSpFFrSUH/) · *carrusel de fotos*
**Canal:** @jeanlucasbm · **Tema principal:** lo que exigir al contratar una web.

> [!warning] Carrusel: las imágenes no se pudieron bajar
> Esto sale solo de la descripción del autor.

**Puntos útiles:** según la descripción, son 20 cosas.
- **Básico:** dominio propio, hosting confiable, SSL, WordPress o un CMS que puedas editar tú, diseño responsive y buena velocidad.
- **Lo que casi nadie pide:** backups automáticos, **acceso de administrador**, correo profesional, Google Analytics, Search Console, sitemap.xml, robots.txt y SEO on-page.
- **Para traer clientes:** formulario de contacto, botón de WhatsApp, aviso de cookies, seguridad y mantenimiento.

**Aplicación práctica:** `checklist-lanzamiento` ya cubre casi todo. **No cubre** lo que es de entrega al cliente: dominio a su nombre, acceso de administrador y correo profesional (ver el 39).

---

### 22. [El patrón Mediator (el que usa Chrome)](https://vt.tiktok.com/ZSpFFmaNG/)
**Canal:** @linkfydev · **Duración:** 02:06 · **Tema principal:** centralizar la comunicación entre componentes.

**Idea clave:** si todos los componentes se conocen entre sí (reproductor, anuncios, cola, interfaz), el código se vuelve una red de dependencias. Con un **mediador**, cada componente solo avisa (`notify`) y el mediador decide quién actúa y en qué orden.

**Prompts, comandos, código o configuraciones:** en pantalla se ve esto; el resto se reconstruye de la explicación:
```python
class Mediator:
    def notify(self, event):
        ...

# el botón solo conoce al mediador
boton.on_click = lambda: mediator.notify("next")
```

**Pasos o procesos concretos:** ejemplo con "siguiente canción":
1. El mediador consulta si hay un anuncio sonando.
2. Revisa la cola de reproducción.
3. Le dice al reproductor qué canción sigue, según si está en bucle.
4. Actualiza la interfaz.

**Advertencias / errores comunes:**
- El mediador puede volverse un **objeto Dios**. Que coordine, pero que la lógica de negocio la delegue.
- Si coordina cosas independientes, mejor usar mediadores especializados.

**Datos y cifras:** Chrome para Android tiene un `TabListMediator` y su código está en Chromium.

---

### 23. [5 cosas legales que tu web o app debe tener](https://vt.tiktok.com/ZSpFFQC5a/) · *carrusel de fotos*
**Canal:** @sebas.soto222 · **Tema principal:** legal antes de lanzar.

> [!warning] Carrusel: solo hay descripción
> Dice que son "5 cosas" que pueden costar demandas de miles de dólares y que hay que verificar la app con un abogado. Las 5 están en las imágenes, que no se pudieron bajar: mándame capturas si las quieres.

---

### 24. [6 prompts para revisar la seguridad de una app hecha con IA](https://vt.tiktok.com/ZSpFFU5PG/) · *carrusel de fotos*
**Canal:** @sebas.soto222 · **Tema principal:** prompts de seguridad.

> [!warning] Carrusel: los prompts están en las imágenes
> Solo se tienen los temas, sacados de la descripción.

**Puntos útiles:** los 6 temas que revisan los prompts:
1. Inputs sin validar.
2. Falta de rate limiting.
3. Errores que exponen información sensible.
4. Sesiones mal manejadas.
5. **CORS mal configurado.**
6. Rutas de API sin protección.

**Aplicación práctica:** `revision-seguridad-backend` cubre 1, 2, 4 y 6. **No cubre CORS ni los mensajes de error que filtran información** (este último solo está de pasada en el punto 5).

---

### 25. [No lances tu app sin estas 3 cosas (rendimiento)](https://vt.tiktok.com/ZSpFF6ayb/)
**Canal:** @sebas.soto222 · **Duración:** 00:46 · **Tema principal:** imágenes, lazy loading y Lighthouse.

**Pasos o procesos concretos:**
1. **Comprime las imágenes:** si pesan más de 1 MB, conviértelas a un formato moderno con una web gratis de Google. No se dice cuál; probablemente WebP y Squoosh `[verificar]`.
2. **Lazy loading:** no cargues datos que no se necesitan; las imágenes se cargan a medida que el usuario hace scroll.
3. **Lighthouse:** F12 → Lighthouse → analizar rendimiento, accesibilidad, SEO y buenas prácticas. **Exporta el resultado y pásaselo a Claude Code** para que te dé los pasos para corregir.

**Aplicación práctica:** el paso 3 es un buen complemento de `checklist-lanzamiento` (puntos 11 y 12): el reporte de Lighthouse le da a Claude una lista concreta de qué arreglar.

---

### 26. [Vocabulario de startups, de la idea a la bolsa](https://vt.tiktok.com/ZSpFFMnXB/)
**Canal:** @jaimejjat · **Duración:** 02:46 · **Tema principal:** términos de startups en el orden en que se viven.

**Puntos útiles:**

| Término | Qué es |
|---|---|
| **ICP** | Perfil de cliente ideal, con nombre y apellido: "clínicas dentales con 2 a 5 sillas", no "pymes" |
| **MVP** | Lo más pequeño que puedes lanzar para aprender si alguien lo quiere (Airbnb: 3 colchones inflables) |
| **Product-Market Fit** | Prueba de Sean Ellis: más del 40 % de usuarios estaría *muy decepcionado* sin tu producto |
| **Pivotar** | Cambiar de producto o cliente sin cambiar de empresa (Instagram empezó como Burbn) |
| **Bootstrapping / VC** | Crecer con lo que vendes, o con fondos que compran un pedazo (equity) |
| **Pitch deck / term sheet** | Unas 10 láminas; la hoja con precio y condiciones |
| **Rondas y dilución** | Pre-seed, seed, serie A, B y C; tu porcentaje baja aunque el pastel crezca |
| **Vesting** | Lo estándar: 4 años con *cliff* de 1 (si te vas antes de 12 meses, te vas sin nada) |
| **Burn rate / runway** | Cuánto quemas al mes / cuántos meses te quedan (1 M en caja ÷ 100 k al mes = 10 meses) |
| **MRR / ARR** | Ingreso recurrente mensual; ×12 es el anual |
| **Churn** | Porcentaje de clientes que se va cada mes |
| **CAC / LTV** | Lo que cuesta conseguir un cliente / lo que deja en toda su vida. Regla: LTV ≥ 3 × CAC |
| **Unicornio / exit / IPO** | Más de 1.000 millones de dólares; venta o salida a bolsa |

**Datos y cifras:**
- 2 de cada 3 rondas no devuelven lo invertido (Correlation Ventures).
- Seed mediana de este año: unos 4 millones de dólares, con el 18 % para el inversionista (Carta).
- Con 5 % de churn mensual se pierde casi la mitad de los clientes en un año.
- Hay unos 1.840 unicornios (Crunchbase).
- Nubank salió a bolsa en 2021 valiendo cerca de 52.000 millones.

**Aplicación práctica:** el ICP y el MVP sirven para la entrevista de `grill-me` en proyectos que son producto.

---

### 27. [Cosas que decirle a Claude antes de lanzar tu web](https://vt.tiktok.com/ZSpFFMkNH/)
**Canal:** @mike.dev1 · **Duración:** 00:30 · **Tema principal:** checklist rápida de una web de negocio.

**Puntos útiles:** las cosas que menciona, en orden:
1. 404 personalizada.
2. Llamada a la acción visible sin hacer scroll.
3. Enlaces internos.
4. Página de agradecimiento.
5. **Breadcrumbs.**
6. **Casos de éxito.**
7. **5 preguntas frecuentes.**
8. **Promesa de tiempo de respuesta.**
9. **Llamada a la acción fija en el móvil.**
10. robots.txt.
11. Títulos únicos.
12. Meta descripciones.
13. Imagen para redes.
14. Mapas y dirección.
15. **Reseñas reales.**
16. Texto alternativo.
17. Esquema local.
18. Política de privacidad.
19. Google Analytics.
20. **Foto del equipo.**

**Aplicación práctica:** `checklist-lanzamiento` cubre casi todo. Los puntos de **confianza y conversión** (en negrita) no están; podrían ir como recomendaciones opcionales.

---

### 28. [Cloudflare: auditoría de seguridad del código que escribe tu IA](https://vt.tiktok.com/ZSpFFaas9/)
**Canal:** @luatech.ia · **Duración:** 01:25 · **Tema principal:** skill de auditoría de seguridad con agentes que se verifican entre sí.

**Idea clave:** el agente que **encuentra** un fallo nunca es el que lo **confirma**: otro agente intenta desmentirlo, y solo llega al reporte lo que sobrevive.

**Herramientas / recursos mencionados:**
- Herramienta de código abierto de Cloudflare que se instala en el agente de código. El nombre dictado suena a "Cloudflare security-audit-skill" `[verificar nombre y repo]`.

**Pasos o procesos concretos:** la auditoría tiene 6 fases. El video solo detalla estas:
1. Mapear el proyecto y sus puntos delicados.
2. Varios agentes buscan fallos.
3. Otro agente intenta desmentir cada hallazgo.
4. Reporte con lo que sobrevive.

**Datos y cifras:** según el video, más de 33.000 estrellas en GitHub `[verificar]`.

**Advertencias / errores comunes:** que no encuentre nada no significa que la app sea segura.

**Aplicación práctica:** muy relacionado con `revision-seguridad-backend`. La idea de **un segundo agente que intenta refutar cada hallazgo** se podría copiar en nuestra skill. → **Skill candidata** (evaluar el repo real).

---

### 29. [Google Maps Scraper Kit: listas de prospectos con Claude Code](https://vt.tiktok.com/ZSpFFQuf7/)
**Canal:** @migue.baena · **Duración:** 00:53 · **Tema principal:** prospección B2B desde Google Maps.

**Herramientas / recursos mencionados:**
- **Google Maps Scraper Kit**: herramienta de código abierto que corre en tu equipo y se controla desde Claude Code. Link dado: `https://miguebaena-ia.com/maps`, que es del creador y no un repo.

**Pasos o procesos concretos:**
1. Pedir, por ejemplo: *"busca clínicas dentales en Madrid"*.
2. Devuelve un CSV con nombre, dirección, teléfono, web, valoraciones y, si hay, el correo.
3. Opción extra: visita las webs para encontrar perfiles de Instagram, Facebook o LinkedIn.

> [!warning] Riesgos legales y técnicos
> - Hacer scraping de Google Maps va contra sus condiciones de uso, y Google puede bloquear tu IP (el mismo video lo advierte).
> - Usar correos y teléfonos para prospección está sujeto a la ley de datos personales (Ley 1581 en Colombia).
> - No lo recomiendo como skill del equipo sin antes revisar eso.

---

### 30. [¿Programar bonito todavía sirve? (debate)](https://vt.tiktok.com/ZSpFFPvoX/)
**Canal:** @sssssamu_ · **Duración:** 01:41 · **Tema principal:** si SOLID y Clean Architecture siguen teniendo sentido cuando "el equipo es tú con la IA".

**Puntos útiles:**
- **La tesis:** esas prácticas existen para que otras personas lean el código; si ya casi solo lo lee la IA, ¿para qué?
- **Ejemplo citado:** DeepMind puso a la IA a programar en ensamblador y logró un resultado "70 % más eficiente" `[verificar: la descripción no da la cifra]`.
- **Las preocupaciones del autor:** si la IA se encarece o no puede ayudar, alguien tiene que meter la mano; si nos volvemos analfabetas de lo que escribe, perdemos el control.

**Aplicación práctica:** es un debate, no una técnica. Contrasta con el 03, el 17 y el 33 (ver la síntesis).

---

### 31. [Pruebas de carga: tu API responde en 100 ms… hasta que entran mil usuarios](https://vt.tiktok.com/ZSpFFf2Lr/)
**Canal:** @andercdev · **Duración:** 01:36 · **Tema principal:** descubrir cuánto aguanta tu sistema antes que tus usuarios.

**Herramientas / recursos mencionados:**
- **k6** (JavaScript; tiene integraciones para que un agente de código cree y ejecute pruebas).
- **Locust** (Python).
- **Artillery**.

**Puntos útiles:**
- Probar picos de tráfico, el límite del sistema y el comportamiento tras varias horas.
- **No mirar el promedio: mirar p95 y p99.** Mientras unas peticiones tardan milisegundos, otras pueden tardar segundos.
- Una prueba de carga no demuestra que el sistema funciona: **descubre cuándo deja de funcionar**.

**Aplicación práctica:** antes de lanzar algo con tráfico esperado, una prueba de k6 sobre el endpoint principal.

---

### 32. [4 cosas que le prohibí a Claude para que mis guiones no suenen a IA](https://vt.tiktok.com/ZSpFFucJD/)
**Canal:** @morfeoacademy · **Duración:** 00:44 · **Tema principal:** reglas de estilo para escribir con IA.

**Prompts, comandos, código o configuraciones:** las 4 reglas:
```text
1. No decir lo que algo NO es antes de decir lo que es ("no es esto, es aquello").
2. Nada de listas de tres adjetivos ("rápido, fácil y barato").
3. No cerrar cada párrafo con una frase corta que repite lo que ya dijiste.
4. Que suene como yo (si escribe "tienes" o "puedes" y yo digo "tenés" o "podés", se nota).
```

**Pasos o procesos concretos:**
1. Junta las frases que te molestan de lo que corriges.
2. Explícale a Claude **por qué** te molestan.
3. Pídele que revise cada texto contra esa lista **antes de mostrártelo**.
4. Prueba final: léelo en voz alta; si te trabas, se reescribe.

**Aplicación práctica:** las reglas 1–3 coinciden con `anti-slop` y con el #04. La 4 (la voz propia) y el método de juntar las correcciones son nuevos: podrían ser una guía de estilo del equipo en `CLAUDE.md`.

---

### 33. [El patrón Singleton](https://vt.tiktok.com/ZSpFFxxEn/)
**Canal:** @davidev.tech · **Duración:** 01:51 · **Tema principal:** una sola instancia compartida, y cuándo no usarla.

**Idea clave:** sirve para objetos que deben ser únicos (configuración, logger, pool de conexiones). Si cada parte del código hace `new`, con 100 usuarios tienes 100 conexiones y el servidor se satura.

**Prompts, comandos, código o configuraciones:** código mostrado en pantalla (`db/Database.ts`):
```ts
class Database {
  private static instance?: Database;

  private constructor() {
    // abre la conexión una sola vez
  }

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }
}
```

**Advertencias / errores comunes:**
- Es **estado global disfrazado**: oculta dependencias y contamina las pruebas.
- Con hilos, dos pueden crear dos instancias si no se sincroniza la creación.
- Si el framework tiene inyección de dependencias, deja que el contenedor cree la instancia única.

**Aplicación práctica:** el bot ya usa algo parecido para la base (`getDb()` en `store.js`).

---

### 34. [Crear una app con IA no es fácil (sketch)](https://vt.tiktok.com/ZSpFYekWr/)
**Canal:** @sebas.soto222 · **Duración:** 01:11 · **Tema principal:** lo que falta revisar después de que "funciona".

**Puntos útiles:** lo que le falta a la app "de 3 días":
1. Pruebas de flujo: cuando cambies algo, algo se va a romper.
2. Seguridad: "no se resuelve con un mensaje a Claude".
3. Saber dónde están las llaves secretas.
4. Validar los inputs.
5. RLS.
6. Revisar dependencias peligrosas.
7. Un diseño que no sea igual al de otras 20 apps.
8. Pruebas de carga.

**Aplicación práctica:** es casi exactamente el recorrido de nuestras skills:
- `revision-seguridad-backend` cubre las llaves (en parte), los inputs, RLS y las dependencias;
- `checklist-lanzamiento` cubre el diseño;
- **faltan** las pruebas de flujo y las de carga.

---

### 35. [Tus términos y condiciones copiados de otra página (SaaS)](https://vt.tiktok.com/ZSpFFs8kP/)
**Canal:** @cami.el.abogado · **Duración:** 01:09 · **Tema principal:** 3 cláusulas que un SaaS no puede omitir (Colombia).

**Puntos útiles:**
1. **Datos personales:** política de privacidad que diga qué datos recoges, para qué y con quién los compartes, aceptada en una **casilla aparte** de los términos. Sin esto, la SIC puede multar "hasta unos 2.500 millones de pesos" `[verificar cifra]`.
2. **Propiedad intelectual:** el software es tuyo y solo lo licencias. Si no, el cliente que te pidió una función puede reclamarla como suya.
3. **Límite de responsabilidad y SLA:** define hasta dónde respondes si la plataforma se cae. Si tu cliente factura 100.000 dólares al mes y deja de facturar, te puede cobrar todo.

**Aplicación práctica:** `checklist-lanzamiento` tiene términos (1) y casillas separadas (25). **No tiene** propiedad intelectual, límite de responsabilidad ni SLA; agregarlos para productos SaaS (con el 42).

---

### 36. [Deja de guardar tus API keys en un .env](https://vt.tiktok.com/ZSpFYeRX4/)
**Canal:** @armelix.dev · **Duración:** 01:47 · **Tema principal:** cómo se filtran los secretos y qué usar en su lugar.

**Puntos útiles:** tres maneras en que se filtra un `.env`:
1. **El historial de Git:** borrarlo en el commit siguiente no lo saca del commit viejo.
2. **El frontend:** las variables que usa el navegador terminan en el JavaScript que descarga cualquiera.
3. **Tu equipo:** cualquier programa que corres puede leer el archivo.

Quién las encuentra son **bots**, no personas: leen cada commit público y prueban las claves.

**Herramientas / recursos mencionados:**
- Gestores de secretos: **OpenBao**, **Infisical** y **Doppler**.
- Escáneres antes de cada push: **Gitleaks** y **TruffleHog**.

**Pasos o procesos concretos:**
1. Usa un gestor de secretos: las claves viven en un lugar, cada persona ve solo lo que necesita y se inyectan al correr la app.
2. Pon un escáner antes de cada push.
3. **Si una clave se filtró, rótala ya**: borrar el commit no alcanza.

**Datos y cifras:**
- En un experimento de Unit 42, una clave de AWS publicada en GitHub se usó en **menos de 5 minutos**.
- Hubo paquetes de npm infectados que buscaban secretos en el equipo del desarrollador y los publicaban.

**Aplicación práctica:**
- El `pre-commit` de `git-workflow` solo bloquea **archivos** `.env`, no claves pegadas dentro del código. Agregar Gitleaks al hook o al CI.
- En `revision-seguridad-backend`, el punto de secretos en el frontend existe solo para Supabase; convendría generalizarlo.

---

### 37. [Diseñar un buscador que escale (de LIKE a Elasticsearch)](https://vt.tiktok.com/ZSpFFT51w/)
**Canal:** @cuaspro · **Duración:** 01:27 · **Tema principal:** la evolución de la búsqueda de una tienda en línea.

**Pasos o procesos concretos:** las etapas:
1. `LIKE` directo a la base: revisa fila por fila y se vuelve lento al crecer el catálogo.
2. **Índice** en la columna: rápido, pero exige el texto exacto (un error de dedo da cero resultados).
3. **Índice full-text** nativo de SQL: tolera errores y palabras separadas, pero con millones de búsquedas se come el CPU y afecta otras operaciones, como los pagos.
4. **Motor aparte con índice invertido (Elasticsearch):** sinónimos, tolerancia a errores ortográficos y autocompletado, con la base transaccional libre.
5. **Sincronización por eventos en segundo plano** para que el catálogo se actualice al llegar inventario.

**Aplicación práctica:** referencia de diseño. Para catálogos pequeños, la etapa 3 suele bastar.

---

### 38. [El problema N+1: ocho viajes al súper por una sopa](https://vt.tiktok.com/ZSpFFthEj/)
**Canal:** @torticodeyt · **Duración:** 01:15 · **Tema principal:** consultas en bucle.

**Idea clave:** una pantalla con 100 pedidos hace 1 consulta para los pedidos y 1 más por cada cliente: **101 consultas**. Se arregla juntando los 100 IDs y pidiendo los clientes de una vez: **2 consultas**.

**Advertencias / errores comunes:** con 3 pedidos no se nota; con 100, la pantalla se arrastra.

**Aplicación práctica:** el código generado por IA cae mucho en esto. La solución es `WHERE id IN (...)`, `include` o `select_related`, o un *dataloader*. Va a la revisión de rendimiento.

---

### 39. [Qué se le entrega a un cliente con un sistema](https://vt.tiktok.com/ZSpFFqSSv/)
**Canal:** @pulso.software · **Duración:** 00:49 · **Tema principal:** paquete de entrega de un desarrollo a medida.

**Puntos útiles:** lo que entrega el autor:
- **URLs** para que el cliente pruebe todo.
- **El código**, si lo compró, en una carpeta o Drive. No un GitHub: "el cliente no sabe lo que es".
- Si hay mantenimiento: **links y accesos**, **manuales para el dueño** y **para los empleados**.
- **Asistente de IA** dentro del panel de administración y del de usuarios.
- **Videos de capacitación** para el equipo.
- **Sistema de tickets** para soporte.

**Aplicación práctica:** podría ser una checklist de **entrega al cliente** junto con el 21 (dominio a su nombre, acceso de administrador) y el 42 (documentos).

---

### 40. [Kafka: si envíos está caído, ¿qué pasa con tu pedido?](https://vt.tiktok.com/ZSpFY1Pa4/)
**Canal:** @torticodeyt · **Duración:** 01:03 · **Tema principal:** comunicación por eventos.

**Idea clave:** si la tienda llama una por una a cocina, envíos y facturación y una está caída, el pedido falla o queda esperando. Con un **evento** ("pedido creado") escrito en Kafka, cada servicio lo lee cuando puede, y si envíos estuvo caído una hora, al volver sigue donde quedó sin perder pedidos.

**Datos y cifras:** Kafka nació en LinkedIn. Según el proyecto, lo usa más del 80 % de las 100 empresas más grandes de Estados Unidos.

**Advertencias / errores comunes:** el video es un adelanto: "cuándo no te conviene" está en el video completo del canal, que no está aquí.

---

### 41. [10 automatizaciones con IA para vender esta semana](https://vt.tiktok.com/ZSpFFv6Lx/)
**Canal:** @soydiegoosorio · **Duración:** 01:45 · **Tema principal:** ideas de servicios de automatización para negocios.

**Puntos útiles:**
1. **Clínica:** confirmar exámenes y recordar 24 h antes.
2. **Gimnasio:** reactivar a quien no va hace 15 días.
3. **Tienda de muebles:** encuesta y cupón 15 días después de comprar.
4. **Suscripciones:** alerta de vencimiento por WhatsApp o correo.
5. **Venta de carros:** un agente califica al interesado (carro en parte de pago, cuota inicial, crédito) antes del vendedor.
6. **Concesionario:** el interesado agenda solo la prueba de manejo.
7. **Colegio:** cobro de la mensualidad con recordatorios 3 días antes, el día del vencimiento y dos más si sigue atrasado.
8. **Curso online:** certificado automático al terminar.
9. **Veterinaria:** clasificar síntomas en urgencia, consulta u orientación.
10. **Imprenta:** recuperar cotizaciones abandonadas a las 24 h con un descuento.

**Aplicación práctica:** son ideas de proyectos. Pueden pasar a `Ideas/` del cerebro o a `/idea` del bot.

**Advertencias / errores comunes:** el 9 clasifica síntomas médicos de mascotas, así que necesita un aviso claro de que no reemplaza al veterinario `[criterio propio]`.

---

### 42. [4 documentos antes de que un cliente te pague](https://vt.tiktok.com/ZSpFFTnye/)
**Canal:** @sebas.soto222 · **Duración:** 01:04 · **Tema principal:** documentos legales de un producto que cobra.

**Puntos útiles:**
1. **Términos de servicio:** qué pueden hacer los usuarios, qué **no** garantizas, cuándo puedes suspender una cuenta y hasta dónde llega tu responsabilidad. Claude los puede redactar si le explicas bien qué hace el producto.
2. **Política de privacidad:** qué datos recoges, cómo los usas y cómo se borran. **Si la política dice una cosa y la app hace otra, estás engañando a tus usuarios.**
3. **DPA (acuerdo de procesamiento de datos):** necesario si procesas datos en nombre de otro negocio, por ejemplo los de los clientes de tus clientes.
4. **Política de reembolsos:** los procesadores de pago la piden.

**Aplicación práctica:** el 1, el 2 y el 4 ya están en `checklist-lanzamiento`. El **DPA** y la regla de que **la política coincida con lo que la app hace** no están. Va con el 35.

---

## Síntesis final

### Herramientas más repetidas

| Herramienta | Nº de videos | Uso |
|---|---|---|
| Claude / Claude Code | 9 nuevos (24, 25, 27, 28, 29, 32, 34, 41, 42), más los del lote anterior | construir, auditar, redactar documentos |
| PostgreSQL / SQL | 4 (20, 37, 38, 13) | fuente de verdad, índices, N+1, RLS |
| Lighthouse / DevTools | 2 (25, 18) | medir rendimiento y encontrar cuellos de botella |
| Gestores y escáneres de secretos (Infisical, Doppler, OpenBao, Gitleaks, TruffleHog) | 1 (36) | sacar claves del `.env` y del repo |
| k6, Locust, Artillery | 1 (31) | pruebas de carga |
| Redis, Elasticsearch, Kafka | 1 cada uno (20, 37, 40) | caché, búsqueda, eventos |

### Ideas que se repiten

- **Rendimiento de apps hechas con IA:** 02, 18, 25, 31 y 38. Las escrituras en lote, las respuestas optimistas, el HTML estático, la asincronía, las imágenes y el lazy loading, el N+1 y las pruebas de carga con p95 y p99 no están juntos en ninguna skill. Es el tema nuevo más repetido.
- **Legal de un producto que cobra:** 01, 23, 35, 42 y 43. Términos, privacidad aceptada aparte, reembolsos, **propiedad intelectual, límite de responsabilidad y SLA, DPA**, y que la política coincida con lo que la app hace.
- **Seguridad después de "funciona":** 24, 28, 34 y 36. Validar, rate limiting, sesiones, CORS, errores que filtran datos, secretos y dependencias, y un auditor que se verifica a sí mismo.
- **Entrega al cliente:** 21 y 39. Accesos, manuales, capacitación y soporte.
- **Escribir sin que suene a IA:** 04 y 32.

### Ideas que se contradicen

- **Código para humanos o para la IA:** el 30 cuestiona SOLID y Clean Architecture si "el equipo es tú con la IA". El 03, el 17 y el 33 defienden estructura y legibilidad, y el propio 30 admite el riesgo de perder el control. Conclusión práctica: legibilidad para cuando haya que meter la mano.
- **Más estructura o menos:** el 17 (feature-based) y el 33 (Singleton) advierten que en apps pequeñas son demasiado. Coincide con el 30 en no sobrediseñar.

### Top 10 hallazgos

1. **Si una clave se filtró, rótala ya**: borrar el commit no alcanza. Además, un escáner (Gitleaks) antes de cada push (36).
2. **Un auditor que intenta refutar cada hallazgo** antes de reportarlo: menos falsos positivos (28).
3. **Confirmaciones por nivel de riesgo**: deshacer, segundo toque o escribir el nombre (19).
4. **El N+1**: juntar los IDs y hacer 2 consultas en vez de 101 (38).
5. **Pruebas de carga mirando p95 y p99**, no el promedio (31).
6. **Términos de un SaaS**: propiedad intelectual, límite de responsabilidad y SLA (35).
7. **DPA** si procesas datos de los clientes de tus clientes, y que la política coincida con lo que la app hace (42).
8. **Lighthouse exportado a Claude Code** para tener una lista concreta de arreglos (25).
9. **Postgres como verdad y Redis como caché**, con el patrón cache-aside (20).
10. **Reglas de estilo propias** sacadas de tus correcciones, que Claude revisa antes de mostrarte el texto (32).

### Videos de mayor valor

1. **36 · API keys**: riesgo real, cifras y una solución concreta que podemos poner en nuestro hook.
2. **35 · Términos de un SaaS**: tres cláusulas que no están en ninguna de nuestras skills.
3. **19 · Fricción progresiva**: patrón de UX claro y aplicable hoy.
4. **38 · N+1**: el error de rendimiento más común en código generado, bien explicado.
5. **28 · Auditoría de Cloudflare**: una técnica para mejorar `revision-seguridad-backend`.

### Videos con poco valor o fallidos

- **23 y 24**: carruseles; el contenido está en las imágenes. El 24 vale la pena si me mandas capturas: son 6 prompts de seguridad.
- **21**: carrusel; solo la lista de la descripción.
- **26**: bueno como vocabulario, pero no es técnico ni accionable para nuestros proyectos.
- **30**: opinión o debate.
- **40**: adelanto de un video más largo.
- **29**: útil, pero con riesgo legal (scraping y datos personales).
- **Ninguno falló del todo.**
