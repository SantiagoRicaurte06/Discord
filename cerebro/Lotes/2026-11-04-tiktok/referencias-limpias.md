---
tipo: lote
fecha: 2026-11-04
videos: 29
plataforma: tiktok
---

# Referencias limpias · lote 2026-11-04 (TikTok)

29 links ([[enlaces]]): 28 videos y 1 carrusel de fotos. Cada video se transcribió completo con Whisper `small` y se revisaron sus fotogramas cuando mostraban código, una lista o una tabla. Lo marcado `[verificar]` no se pudo confirmar con el audio ni con la imagen.

---

### 01. [Así llega tu mensaje de Slack a todo el mundo en 500 ms](https://vt.tiktok.com/ZSpFNgTtt/)
**Canal:** @tech.autopsy · **Duración:** 01:59 · **Tema principal:** cómo Slack reparte millones de canales entre servidores sin una tabla central.

**Idea clave:** en vez de un directorio central (que es un punto único de falla), Slack usa *hashing consistente*. El ID del canal se pasa por un hash, cae en un punto de un anillo, y el servidor que está en ese tramo es el dueño del canal.

**Puntos útiles:**
- Arquitectura en piezas:
  - **Gateway Server**: mantiene el WebSocket con el cliente, hay en varias regiones y se suscribe a tus canales.
  - **Admin Server**: recibe el mensaje que entra por la API.
  - **Channel Server**: dueño del canal en el anillo; lo tiene en memoria y lo reenvía a cada Gateway suscrito.
- Cualquiera que haga la misma cuenta llega al mismo servidor, sin consultar a nadie.
- Si un Channel Server falla, los gestores del anillo (Whisper entendió "Charms" `[verificar]`) lo reemplazan en menos de 20 s, y solo cambia de dueño su tramo.
- Principio: **separar quién guarda los datos de quién tiene la conexión**.

**Herramientas / recursos mencionados:**
- Blog de ingeniería de Slack: artículo de Samira Tangudio (nombre según Whisper `[verificar]`).
- Implementación en Go en el GitHub del autor (no da el link).

**Datos y cifras:** entrega en unos 500 ms a todo el mundo. En hora pico un solo servidor atiende unos 16 millones de canales. El reemplazo tarda menos de 20 s.

**Advertencias / errores comunes:**
- Una tabla central hace que cada mensaje la consulte; si se cae, se cae todo.
- El costo del anillo: mientras se reemplaza un servidor, sus canales notan más latencia, y todo depende de tener los canales en memoria.
- Con 3 servidores, una tabla basta.

**Aplicación práctica:** es un patrón a considerar solo si un sistema con estado (chats, salas) crece a muchos nodos. Para el bot de Discord actual no aplica.

**Marca de tiempo relevante:** `00:40` recorrido de un mensaje · `01:04` caída y reemplazo · `01:40` regla final.

---

### 02. [Cómo un deploy hizo perder a Knight Capital más de 440 millones de dólares](https://vt.tiktok.com/ZSpFNxsR1/)
**Canal:** @iterixs · **Duración:** 01:12 · **Tema principal:** desastre de un deploy manual con código muerto.

**Idea clave:** reutilizaron un *flag* que antes activaba "Power Peg", un código muerto. Además, el deploy manual dejó 1 de los 8 servidores con el código viejo. Ese servidor disparó órdenes sin freno, y la empresa terminó vendida.

**Puntos útiles:**
- Cadena de errores:
  1. Reutilizar un flag.
  2. Código muerto todavía instalado.
  3. Deploy a mano en 8 servidores, con uno olvidado.
  4. Sin botón de apagado.
  5. Al intentar apagarlo, quitaron el código nuevo de los otros 7, y entonces los 8 leyeron el flag como Power Peg.
- La descripción agrega que antes de abrir la bolsa hubo 97 correos automáticos de error que nadie trató como alarma.

**Datos y cifras:** más de 440 millones de dólares perdidos en 45 minutos. Power Peg llevaba 9 años sin usarse; en el audio se dice "desde 2003".

**Advertencias / errores comunes:** no reutilizar flags viejos, no hacer deploys a mano y no ignorar las alertas automáticas.

**Aplicación práctica:** regla para cualquier proyecto: **borra el código muerto, automatiza el deploy y ten un botón de apagado** (kill switch). Encaja con `git-workflow` y con el CI.

**Marca de tiempo relevante:** `00:50` la regla final.

---

### 03. [¿Dónde guardas el CVV de tus clientes?](https://vt.tiktok.com/ZSpFN5rDM/)
**Canal:** @caliche.tech · **Duración:** 01:03 · **Tema principal:** qué datos de tarjeta nunca se guardan.

**Idea clave:** el CVV no se guarda nunca, ni cifrado (lo prohíbe la norma de tarjetas). El número completo se cambia por un **token** y solo se guardan los últimos 4 dígitos.

**Puntos útiles:**
- El CVV se usa una vez para autorizar el pago y se descarta. Guardarlo "un ratico" ya es una falta.
- Se cobra contra el token: si roban la base, se llevan basura.
- **Cuatro datos que nunca tocan tu base:** el número completo, el CVV, la banda magnética y el PIN.

**Herramientas / recursos mencionados:**
- **AWS Payment Cryptography**: guarda las llaves en un "cofre" que ni tú ves sin cifrar.

**Aplicación práctica:** si algún proyecto cobra con tarjeta, usar la tokenización de la pasarela (Stripe, Wompi, Mercado Pago) y guardar solo el token y los últimos 4.

**Marca de tiempo relevante:** `00:25` tokenizar · `00:50` los 4 datos prohibidos.

---

### 04. [Vulnerabilidad en tiendas online: manipular la cantidad](https://vt.tiktok.com/ZSpFNmfmm/)
**Canal:** @elpinguinodemario · **Duración:** 01:42 · **Tema principal:** el servidor confía en la cantidad y el precio que manda el cliente.

**Idea clave:** interceptando la petición de compra se cambia `quantity` por un valor ínfimo, y el servidor recalcula el precio en proporción. Resultado: pedidos que cuestan 0 €, repetibles sin límite.

**Puntos útiles:**
- El cuerpo de la petición que se ve en pantalla manda incluso el precio desde el cliente:
  ```json
  { "productId": 11, "price_cents": 299, "quantity": 5 }
  ```
- El autor dice "mucho menos de una unidad" y luego que "no procesa los datos negativos". No queda claro si usó un decimal o un negativo `[verificar]`.
- Con varias peticiones iguales en secuencia, la compra gratis se vuelve ilimitada.

**Herramientas / recursos mencionados:** un proxy de interceptación de peticiones; por la interfaz parece Burp Suite `[verificar]`.

**Pasos o procesos concretos:**
1. Interceptar la petición de compra.
2. Cambiar `quantity`.
3. Reenviar la petición.
4. Repetirla en lote.

**Advertencias / errores comunes:** nunca calcular el precio con datos del cliente; validar que la cantidad sea un entero ≥ 1.

**Aplicación práctica:** en cualquier checkout, el servidor recalcula el precio desde la base y valida la cantidad con un esquema (por ejemplo Zod, como en el video 17).

**Marca de tiempo relevante:** `00:35` la petición · `01:09` por qué es vulnerable.

---

### 05. [Le pedí a Codex "un Uber pero de tacos"](https://vt.tiktok.com/ZSpFNA2pM/)
**Canal:** @iadeguardiadev · **Duración:** 00:53 · **Tema principal:** cómo escribir el pedido a un agente de código.

**Idea clave:** un prompt de una línea hace que el agente adivine, y adivina mal. Hace falta una fórmula de 4 partes y las reglas guardadas en `AGENTS.md`.

**Pasos o procesos concretos:**
1. **Qué hace.**
2. **Para quién es.**
3. **Con qué lo hago y qué no debo tocar.**
4. **Cómo sabes que ya quedó** (criterio de aceptación; "la que nadie pone").
5. Guarda tus reglas en `AGENTS.md` para no repetirlas cada vez.

**Prompts, comandos, código o configuraciones:**
```text
Pedidos, el repartidor en el mapa y que se pague con tarjeta.
```
Es el ejemplo de criterio de "ya quedó": algo que se puede construir y probar.

**Aplicación práctica:** usar la fórmula al pedir cualquier feature; equivale a `CLAUDE.md` en Claude Code. Encaja con `grill-me`: es la versión corta de la entrevista.

---

### 06. [5 errores al crear apps con Claude o ChatGPT](https://vt.tiktok.com/ZSpFNPtLw/) · *carrusel de fotos*
**Canal:** @chavescerrejon · **Duración:** carrusel con música · **Tema principal:** errores habituales del vibe coding.

> [!warning] Las imágenes del carrusel no se pudieron bajar
> Esto sale solo de la descripción del autor. Los "ejemplos de prompts para Claude" están en las imágenes: si los quieres, mándame capturas.

**Puntos útiles:** los 5 errores son:
1. Empezar con prompts demasiado genéricos.
2. Programar sin definir las pantallas y funcionalidades.
3. Confundir una interfaz bonita con una aplicación funcional.
4. Pedir demasiados cambios al mismo tiempo.
5. Publicar sin comprobar que todo funciona.

**Aplicación práctica:** coincide con el 05 (definir antes de pedir) y con `checklist-lanzamiento` (probar antes de publicar).

---

### 07. [Product Photo Studio: fotos de estudio de toda tu tienda desde Claude](https://vt.tiktok.com/ZSpFNQ71e/)
**Canal:** @geradevtech · **Duración:** 01:33 · **Tema principal:** skill que convierte fotos de celular en fotos de producto.

**Idea clave:** la skill de Beatra mantiene la forma, el color, la etiqueta y las proporciones del producto, y solo cambia el fondo, la luz y las sombras. Antes de generar muestra el costo y espera aprobación.

**Herramientas / recursos mencionados:**
- **Product Photo Studio**: fotos de producto con IA ([github.com/beatra-ai/ai-product-photography-skill](https://github.com/beatra-ai/ai-product-photography-skill)). Funciona con Claude Code, Cursor, Codex y otros agentes.

**Pasos o procesos concretos:**
1. Instalar con los comandos de abajo.
2. La primera vez, conectar una cuenta de Beatra (600 créditos de regalo, sin tarjeta).
3. Pasarle las fotos: *"conviértelas en fotos de producto con fondo blanco para mi tienda"*.
4. Revisar el costo y aprobar.
5. Si algo cambia, pedir que corrija solo esa zona.

**Prompts, comandos, código o configuraciones:**
```bash
claude plugin marketplace add beatra-ai/ai-product-photography-skill
claude plugin install product-photo-studio@ai-product-photography-skill
```

**Datos y cifras:** cerca de 150 créditos por imagen; 600 créditos alcanzan para unas 4 fotos. En la demo, 3 fotos y 1 corrección gastaron los 600.

**Advertencias / errores comunes:** la skill es gratis pero cada imagen gasta créditos de pago. Revisar el resultado: en la demo le cambió la cabeza a una figura.

**Aplicación práctica:** útil si un proyecto tiene tienda o catálogo. → **Skill candidata.**

**Marca de tiempo relevante:** `00:40` demo · `01:03` costos.

---

### 08. [TOP 7 tecnologías backend en 2026](https://vt.tiktok.com/ZSpFNWXyG/)
**Canal:** @softcraft562 · **Duración:** 01:17 · **Tema principal:** ranking opinado de stacks backend.

**Puntos útiles:** el ranking, confirmado con los fotogramas:

| # | Stack | A favor | En contra |
|---|---|---|---|
| 7 | PHP + Laravel | despliegue barato, arranque rapidísimo | sufre con alta concurrencia |
| 6 | Ruby on Rails | productividad brutal para startups | consume muchos recursos |
| 5 | Rust | rendimiento, cero fugas de memoria | difícil de aprender |
| 4 | Python + FastAPI | rey para IA y APIs rápidas | flojo en CPU pura |
| 3 | TypeScript + NestJS | un solo lenguaje front y back, ecosistema gigante | no bloquear su único hilo |
| 2 | Go | concurrencia perfecta, ligero | algo verboso |
| 1 | Java/Kotlin + Spring Boot | robusto a largo plazo, escala seguro | más configuración inicial |

**Advertencias / errores comunes:** es la opinión de una agencia (su estándar es Spring Boot), no una medición.

**Aplicación práctica:** poca; sirve como referencia rápida para elegir stack.

---

### 09. [Rate limiting: ¿cómo detienes un bot que prueba 10.000 contraseñas por minuto?](https://vt.tiktok.com/ZSpFNs5J2/)
**Canal:** @cuaspro · **Duración:** 01:18 · **Tema principal:** limitar intentos de login por capas.

**Idea clave:** bloquear por IP falla con botnets y con IPs compartidas, y bloquear la cuenta tras 5 fallos permite que cualquiera bloquee cuentas ajenas. La solución es un **token bucket por capas**: uno por IP y otro por cuenta.

**Puntos útiles:**
- Cada intento gasta una ficha de las dos cubetas, que se rellenan solas.
- Si cualquiera de las dos se vacía, la API responde **429 Too Many Requests**.
- El usuario real que se equivoca 2 veces ni lo nota.

**Datos y cifras:**
- IP: 100 fichas, con recarga de 100 por minuto.
- Cuenta: 5 fichas, con recarga de 1 cada 2 s.
- Resultado: el bot pasa de 10.000 intentos por minuto a unos 5 por minuto en cada cuenta.

**Advertencias / errores comunes:** no bloquear la cuenta de forma fija (se vuelve un ataque de denegación de servicio contra usuarios) y no bloquear solo por IP (afecta, por ejemplo, a toda una universidad que comparte la misma IP).

**Aplicación práctica:** cualquier login o endpoint sensible de nuestros proyectos.

**Marca de tiempo relevante:** `00:35` la solución por capas.

---

### 10. [Mismo millón de pedidos: JSON vs Parquet](https://vt.tiktok.com/ZSpFF13WV/)
**Canal:** @noxhound.col · **Duración:** 00:39 · **Tema principal:** formato para guardar datos.

**Idea clave:** **JSON sirve para intercambiar datos y Parquet para guardarlos.** Parquet escribe el nombre de cada campo una vez, guarda por columnas y comprime.

**Datos y cifras:**

| | JSON | Parquet |
|---|---|---|
| Tamaño en disco | casi 130 MB | 6,9 MB (casi 19 veces menos) |
| Lectura con Pandas | 2,5 s | 0,03 s |
| Lectura de solo 2 columnas | — | menos de 0,01 s |

**Herramientas / recursos mencionados:** Pandas, Parquet.

**Aplicación práctica:** para análisis o históricos grandes. Nuestro `db.json` es pequeño, así que no aplica.

---

### 11. [¿Tu API confía en el ID que manda el cliente? (IDOR)](https://vt.tiktok.com/ZSpFF1sHF/)
**Canal:** @ederr.tech · **Duración:** 01:16 · **Tema principal:** Insecure Direct Object Reference.

**Idea clave:** cambiar `1623` por `1620` en la URL bastó para leer datos ajenos porque el servidor **nunca verificó que el recurso fuera del usuario**. El mismo fallo deja leer, modificar y descargar archivos ajenos.

**Pasos o procesos concretos (cómo lo encontró):**
1. Se registró como usuario normal.
2. Revisó el bundle de JavaScript: el token estaba en `localStorage` y todos los endpoints quedaban expuestos.
3. Llamó a su propio recurso y luego cambió el ID.
4. Automatizó el recorrido de IDs y extrajo los datos de todos los usuarios.
5. Con POST y PUT modificó recursos ajenos.
6. Un endpoint de reportes devolvía una URL firmada de S3 sin validar el dueño, y con ella descargó archivos del bucket.

**Advertencias / errores comunes:**
- Todo endpoint debe verificar que el recurso pertenece al usuario autenticado.
- Los tokens van en **cookies HttpOnly**, no en `localStorage`.

**Aplicación práctica:** revisarlo en cada API de nuestros proyectos. Es el mismo principio que el 04, el 17 y el 25.

**Marca de tiempo relevante:** `00:25` el cambio de ID · `00:50` URL firmada de S3 · `01:01` recomendación.

---

### 12. [Qué es un índice y por qué tu consulta revisa un millón de filas](https://vt.tiktok.com/ZSpFN3Q3g/)
**Canal:** @edicoder27 · **Duración:** 00:53 · **Tema principal:** índices de bases de datos.

**Idea clave:** sin índice, la base revisa las filas una por una. Con un índice salta directo a la fila: es como el índice de un libro.

**Puntos útiles:**
- Cada índice ocupa espacio y vuelve más lentas las escrituras, porque se actualiza en cada `INSERT`.
- Regla: indexar las columnas por las que buscas, filtras o haces JOIN a menudo.
- Usar `EXPLAIN` para ver si la consulta usa el índice (Whisper entendió "una spline" `[verificar]`; casi seguro es `EXPLAIN`).

**Datos y cifras:** buscar por correo en un millón de filas pasó de 3 s a 2 ms con una sola línea.

**Prompts, comandos, código o configuraciones:** el video no muestra la línea exacta. La forma típica sería `CREATE INDEX ... ON usuarios(correo);` `[verificar]`.

---

### 13. [20 cosas para que no demanden tu app (versión México)](https://vt.tiktok.com/ZSpFFdqbb/)
**Canal:** @iadeguardiadev · **Duración:** 00:46 · **Tema principal:** checklist legal que Claude genera para una app.

**Puntos útiles:** las 20 cosas, en orden:
1. Aviso de privacidad.
2. Términos y condiciones.
3. Política de reembolsos.
4. Aviso de cookies.
5. Botón para rechazar las cookies.
6. Casillas sin marcar por defecto.
7. Pedir solo los datos que usas.
8. Revisar qué datos se llevan tus librerías.
9. Nada de trampas para cancelar.
10. Precio final sin cargos sorpresa.
11. Cero reseñas falsas.
12. No prometer lo que no cumples.
13. Texto alternativo en las imágenes.
14. Colores legibles.
15. Que funcione con teclado.
16. Tu nombre legal y un contacto.
17. Permiso de los papás si hay menores.
18. Botón para darse de baja.
19. Imágenes con licencia.
20. Botón para borrar la cuenta.

La descripción menciona además derechos ARCO y Profeco (México).

**Prompts, comandos, código o configuraciones:**
```text
Claude, mi app sale mañana. ¿Qué le falta para que no me demanden?
```

**Advertencias / errores comunes:** Claude hace casi todo, pero el aviso de privacidad lo debe revisar un abogado.

**Aplicación práctica:** `checklist-lanzamiento` ya cubre 1–4, 13, 14 y 16. **Faltan** en la skill: 6, 8, 9, 10, 17, 18, 19 y 20.

---

### 14. [5 maneras de mejorar la rapidez de tu app hecha con Claude](https://vt.tiktok.com/ZSpFNGySC/)
**Canal:** @sebas.soto222 · **Duración:** 00:53 · **Tema principal:** rendimiento que el código generado suele olvidar.

**Puntos útiles:** las 5 cosas que el código generado suele olvidar:
1. La interfaz espera la respuesta del backend antes de actualizarse. Lo que hace falta es una **actualización optimista**.
2. El JSON viaja **sin comprimir**; falta gzip o brotli.
3. El servidor genera el HTML en cada visita, cuando podría **cachearse o generarse estático**.
4. Las filas se escriben una por una en la base; deberían ir en **lote**.
5. Hay un cuello de botella en una sola dependencia. Para encontrarlo, mide el tiempo de ida y vuelta por evento de red: si una acción se lleva el 90 % del tiempo, ahí está el problema.

**Advertencias / errores comunes:** con un solo usuario no se nota; con mil, sí.

**Aplicación práctica:** son 5 preguntas para hacerle a Claude al revisar el rendimiento de una app.

---

### 15. [¿Qué es Clean Code?](https://vt.tiktok.com/ZSpFFLujx/)
**Canal:** @davidev.tech · **Duración:** 02:01 · **Tema principal:** principios del libro de Robert C. Martin (Uncle Bob).

**Idea clave:** leer código toma más de 10 veces lo que toma escribirlo, así que se optimiza para quien lo lee.

**Puntos útiles:**
- **Nombres** que revelen la intención: `p` pasa a `pedido` y `t` a `total`. Si un nombre necesita comentario, está mal.
- Una función **hace una sola cosa**: sumar, aplicar el descuento y facturar se parten en tres funciones.
- **Argumento bandera** (`true` suelto): mejor dos funciones, `facturar` y `facturarConDescuento`.
- No se comenta el código malo, se reescribe. Los comentarios quedan para el *porqué* o para advertencias.
- **Regla del Boy Scout:** cada archivo que tocas queda un poco más limpio que como lo encontraste.

**Advertencias / errores comunes:**
- John Ousterhout critica que tantas funciones diminutas obligan a saltar entre muchas para entender una idea.
- Casey Muratori mostró que algunos ejemplos del libro sacrifican rendimiento.
- Conclusión del video: tomarlo como guía, no como ley.

**Aplicación práctica:** encaja con `anti-slop` en la revisión de código.

---

### 16. [4 señales obvias de que tu app fue hecha con IA](https://vt.tiktok.com/ZSpFNtBk8/)
**Canal:** @juanjimenezsieber · **Duración:** 01:11 · **Tema principal:** marcas del vibe coding y cómo quitarlas.

**Puntos útiles:**
1. **Textos escritos por IA**, con frases tipo "no es esto, sino lo otro". Mejor escribirlos uno mismo y usar la IA solo para pulir.
2. **Degradado morado y azul** (o cualquier par de colores fuertes): toda la IA hace lo mismo.
3. **Sin favicon.**
4. **Malos estados de carga**: pantalla en blanco o spinner infinito. La solución son *skeleton loaders*.

**Prompts, comandos, código o configuraciones:** pásale este video a tu agente y pídele que arregle estas 4 cosas.

**Aplicación práctica:**
- El 1 ya lo cubre `anti-slop`.
- El 3 ya lo cubre `checklist-lanzamiento`.
- El 2 y el 4 **no están** en ninguna skill del equipo.

---

### 17. [Una Server Action es un endpoint público](https://vt.tiktok.com/ZSpFNskK6/)
**Canal:** @pivelcode · **Duración:** 00:43 · **Tema principal:** seguridad de Server Actions en Next.js.

**Idea clave:** que el botón solo se vea con sesión iniciada no protege nada. Una Server Action es un **endpoint POST** que cualquiera en internet puede llamar sin pasar por la interfaz.

**Pasos o procesos concretos:**
1. Verificar la sesión **dentro** de la acción.
2. Validar la entrada con un esquema.
3. Comprobar que el usuario sea dueño del recurso.
4. Devolver solo lo necesario y mantener Next.js actualizado.

**Prompts, comandos, código o configuraciones:** código mostrado en pantalla (`actions.ts`):
```ts
'use server'
const Input = z.object({ id: z.string().uuid() })
export async function borrar(raw: unknown) {
  const user = await requireUser()
  const { id } = Input.parse(raw)
  const f = await db.factura.find(id)
  if (f?.ownerId !== user.id) throw forbidden()
  await db.factura.delete(id)
}
```

**Datos y cifras:** según el autor, el 14 de octubre salió un parche de Next.js para las Server Actions.

**Aplicación práctica:** es una plantilla directa para revisar código en cualquier proyecto con Next.js. → idea de skill propia: *revision-seguridad-backend* (propuesta, esperando tu OK).

**Marca de tiempo relevante:** `00:13` "es un endpoint POST" · `00:29` el código.

---

### 18. [Si puedes descifrar una contraseña, el atacante también](https://vt.tiktok.com/ZSpFFFkHb/)
**Canal:** @caliche.tech · **Duración:** 01:29 · **Tema principal:** hashear contraseñas en vez de cifrarlas.

**Idea clave:** cifrar es reversible: si roban la base y la llave, se llevan todo. Las contraseñas se **hashean** con un hash lento y con salt.

**Puntos útiles:**
- MD5 o SHA son tan rápidos que un atacante prueba millones por segundo. Lo correcto es **bcrypt, scrypt o argon2**.
- El salt es único por usuario: dos personas con la misma contraseña quedan con hashes distintos.
- Lo lento es a propósito: a ti te cuesta milisegundos y al atacante, años.
- "No guardas contraseñas: guardas una prueba de que la conocen."

**Aplicación práctica:** regla fija para cualquier login propio.

---

### 19. [El "olvidé mi contraseña" es donde más gente se cae](https://vt.tiktok.com/ZSpFNwp3y/)
**Canal:** @caliche.tech · **Duración:** 01:17 · **Tema principal:** diseño seguro de la recuperación de cuenta.

**Idea clave:** la recuperación es la segunda puerta de la cuenta y casi siempre la más floja. **Tu seguridad la define la puerta más débil.**

**Advertencias / errores comunes:**
- Un token que no expira o sirve dos veces es una llave tirada.
- Responder "ese correo no existe" le regala al atacante la lista de cuentas.
- Avisar del cambio cuando ya entraron llega tarde.

**Pasos o procesos concretos (diseño correcto):**
1. Token aleatorio, de un solo uso y que expire en minutos.
2. La misma respuesta, y el mismo tiempo de respuesta, exista o no la cuenta.
3. Al cambiar la contraseña, cerrar todas las sesiones y avisar al instante.

**Aplicación práctica:** va directo a la skill propuesta *revision-seguridad-backend*.

---

### 20. [SkillSpector: revisa las skills antes de instalarlas](https://vt.tiktok.com/ZSpFNvhSR/)
**Canal:** @migue.baena · **Duración:** 00:44 · **Tema principal:** seguridad de las skills de terceros.

**Idea clave:** las skills de terceros pueden traer instrucciones maliciosas o robo de datos. Un escáner sirve si se integra **en el proceso de instalación**, no si se instala y se olvida.

**Herramientas / recursos mencionados:**
- **SkillSpector**: el video dice que es de NVIDIA y que analiza agentes y skills. Link dado: `https://skill-spectre-secure.base44.app/`.

**Pasos o procesos concretos:** pedirle a Claude Code un flujo que revise cada skill nueva y **detenga la instalación** si hay riesgos graves, mostrando un informe para decidir.

> [!warning] Verificar antes de usar
> El link es de `base44.app` (una plataforma para crear apps), no de un dominio de NVIDIA. Que sea de NVIDIA y que ese sea su sitio oficial queda `[verificar]` antes de instalar nada.

**Advertencias / errores comunes:** ningún escáner garantiza seguridad total, y el escáner no se activa solo por instalarlo.

**Aplicación práctica:** muy relevante para nosotros. `guia-skills/instalar.sh` instala skills de terceros sin revisarlas. Idea: un paso de revisión antes de instalar (idea propuesta, esperando tu OK).

---

### 21. [Cómo se hacen los motion graphics con Claude](https://vt.tiktok.com/ZSpFF25SV/)
**Canal:** @agustin.paulise · **Duración:** 01:05 · **Tema principal:** animaciones con prompts ya hechos.

**Herramientas / recursos mencionados:**
- **prompt-motion.com**: galería de motion graphics con su prompt, el modelo recomendado y las iteraciones sugeridas.

**Pasos o procesos concretos:**
1. Entrar a prompt-motion.com, elegir un motion y copiar su prompt.
2. En Claude, usar el modelo que recomienda el motion, o el más alto que tengas. La calidad varía mucho según el modelo.
3. Pegar el prompt **junto con tu sistema de diseño**: colores, tipografía y estilo de marca.

**Advertencias / errores comunes:** sin tu sistema de diseño, el resultado es el mismo motion que usa todo el mundo.

**Aplicación práctica:** para contenido de redes de los proyectos.

---

### 22. [Animation Performance (Emil Kowalski): tus animaciones van lentas](https://vt.tiktok.com/ZSpFFY8q9/)
**Canal:** @geradevtech · **Duración:** 01:41 · **Tema principal:** skill que detecta y corrige animaciones costosas.

**Idea clave:** animar ancho, alto o posición obliga al navegador a recalcular la página y se pierden fotogramas. Con `transform` (translate y scale) y `opacity` la animación es fluida.

**Herramientas / recursos mencionados:**
- **animation-performance**, de Emil Kowalski ([github.com/emilkowalski/skills](https://github.com/emilkowalski/skills)).

**Pasos o procesos concretos:**
1. Instalar con el comando de abajo y elegir `animation-performance` y tu agente.
2. Pedir: *"Usa la skill animation-performance y analiza las animaciones de esta app"*.
3. Devuelve cada animación con su causa y el antes y después (`width`/`left` → `transform`, `box-shadow` → `opacity`).
4. Pedir *"aplica los arreglos"* y revisar que la app se vea igual.
5. Comprobar con DevTools › Performance, mejor en un teléfono real.

**Prompts, comandos, código o configuraciones:**
```bash
npx skills@latest add emilkowalski/skills
```

**Datos y cifras:** en la demo (panel de 240 pedidos, Chrome con CPU ×6, mediana de 3 mediciones) pasó de 47 a 58 fps.

**Advertencias / errores comunes:** más animaciones no es mejor experiencia; cada una debe tener un propósito.

**Aplicación práctica:** → **Skill candidata** para frontends con animaciones.

---

### 23. [Evolución del vibe coding: del neón al SaaS minimalista](https://vt.tiktok.com/ZSpFNscex/)
**Canal:** @100dayvibecoding · **Duración:** 00:09 · **Tema principal:** estética de interfaces (video en vietnamita, sin voz).

**Idea clave:** según la descripción traducida, el paso de interfaces de neón morado llamativo a un estilo SaaS minimalista y cuidado al píxel. Quitar efectos sobrantes hace que la interfaz se vea profesional. En pantalla se ve un dashboard oscuro y sobrio ("Ember").

**Aplicación práctica:** confirma el punto 2 del video 16 (evitar los degradados morados).

---

### 24. [10 animaciones que le puedes pedir a Claude](https://vt.tiktok.com/ZSpFN3UYC/)
**Canal:** @sebas.soto222 · **Duración:** 00:17 · **Tema principal:** palabras clave de estilos visuales.

**Prompts, comandos, código o configuraciones:** las palabras clave para usar en el prompt:
```text
Liquid Morph, Glassmorphism, Kinetic Type, ASCII Art, Isometric,
Gradient Mesh, Comic Book, Blueprint, Pixel Art, Particles
```

**Aplicación práctica:** vocabulario para pedir estilos sin describirlos largo.

---

### 25. [¿Por qué la IA siempre te mete Supabase?](https://vt.tiktok.com/ZSpFNcde4/)
**Canal:** @explicandobugabug · **Duración:** 01:35 · **Tema principal:** Supabase y su riesgo principal.

**Idea clave:** la IA elige Supabase por 4 razones, y tiene un peligro: la llave pública va en el navegador, así que **sin RLS cualquiera lee tus datos**.

**Puntos útiles:** las 4 razones:
1. Todo en uno (Postgres, login, archivos y tiempo real): menos piezas son menos errores.
2. Sin servidor: el frontend habla directo con la base.
3. Viene integrado en Lovable y Bolt.
4. Es Postgres, muy documentado, y tiene plan gratis.

**Datos y cifras:** en 2025, más de 170 apps hechas con Lovable quedaron expuestas por no tener RLS (CVE-2025-48757, según la descripción).

**Prompts, comandos, código o configuraciones:**
```text
Activa RLS en cada tabla y revisa quién puede leer y escribir.
```

**Aplicación práctica:** regla fija si algún proyecto usa Supabase.

---

### 26. [Archify: tu proyecto convertido en diagrama interactivo](https://vt.tiktok.com/ZSpFN3LRf/)
**Canal:** @geradevtech · **Duración:** 01:42 · **Tema principal:** skill que genera diagramas de arquitectura.

**Idea clave:** Claude analiza el repo y Archify genera un HTML interactivo con los componentes y sus conexiones. También sirve para planificar funciones nuevas.

**Herramientas / recursos mencionados:**
- **Archify** ([github.com/tt-a1i/archify](https://github.com/tt-a1i/archify)).

**Pasos o procesos concretos:**
1. Instalar con el comando de abajo y elegir Claude Code u otro agente.
2. Pedir: *"Analiza este repositorio y usa archify para crear un diagrama de arquitectura"*.
3. Para planificar: *"usa archify para representar <la función> como diagrama de flujo de trabajo"*.
4. Abrir el `.html` y exportarlo a PNG, SVG o WebM.
5. Revisar que coincida con el código antes de compartirlo.

**Prompts, comandos, código o configuraciones:**
```bash
npx skills add tt-a1i/archify -g
```

**Advertencias / errores comunes:** el diagrama depende de lo que el agente analizó, así que hay que verificarlo.

**Aplicación práctica:** documentar este repo (bot, skills y cerebro) y los proyectos nuevos. → **Skill candidata.**

---

### 27. [10 cosas de seguridad antes de lanzar una web (WordPress)](https://vt.tiktok.com/ZSpFNcd7d/)
**Canal:** @luisalvarezweb · **Duración:** 00:23 · **Tema principal:** checklist de seguridad para WordPress.

**Puntos útiles:**
1. HTTPS en todas las páginas.
2. Cortafuegos.
3. reCAPTCHA en los formularios.
4. Bloquear a quien prueba contraseñas sin parar.
5. Escáner de virus diario.
6. WordPress, plugins y tema actualizados.
7. Ningún plugin pirata.
8. Copia automática guardada **fuera del hosting**.
9. Otra dirección de acceso en vez de `wp-admin`.
10. Verificación en dos pasos.

**Aplicación práctica:**
- `checklist-lanzamiento` ya cubre HTTPS y la protección contra spam.
- Para sitios WordPress **faltan** 2, 4, 5, 6, 7, 8, 9 y 10.

---

### 28. [Ranking de lo que tienes que hacer después de publicar tu web](https://vt.tiktok.com/ZSpFNTjmS/)
**Canal:** @tomyespinosa · **Duración:** 00:48 · **Tema principal:** tier list de herramientas tras el lanzamiento.

**Puntos útiles:** tier list confirmada con los fotogramas:

| Tier | Qué | Para qué |
|---|---|---|
| **S** | Google Search Console | decirle a Google que el sitio existe y aparecer en búsquedas |
| **S** | Microsoft Clarity | mapas de calor y grabaciones de sesión: dónde se traban los visitantes |
| **A** | Google Analytics | cuántos visitan, de dónde vienen y qué páginas abren |
| **A** | Meta Pixel | instalarlo ya aunque no hagas anuncios, para no perder audiencia de retargeting |
| **B** | Probar el formulario tú mismo | si el dato no llega en segundos, nada de lo anterior sirve |

**Aplicación práctica:** `checklist-lanzamiento` tiene Search Console (8) y analítica (22). **Falta** Microsoft Clarity.

---

### 29. [Hacer tu web con IA toma una tarde; que sea legal toma 9 prompts](https://vt.tiktok.com/ZSpFFp6Sg/)
**Canal:** @cami.el.abogado · **Duración:** 01:23 · **Tema principal:** prompt legal para webs (Colombia), dado por un abogado de startups.

**Idea clave:** la parte legal es la que después sale cara, y lo que más se salta es el **registro trazable del consentimiento**.

**Prompts, comandos, código o configuraciones:**
```text
Hola Claude, no quiero que mi sitio web sea demandado. Por favor:
1. Añade términos y condiciones.
2. Añade una política de privacidad.
3. Añade una política de cookies y revisa si necesito pedir consentimiento para usarlas.
4. En cada formulario, dos casillas separadas: una para términos y condiciones y otra para la política de privacidad (nada de una sola casilla para todo), con un link al lado de cada una.
5. Guarda un registro de cuándo y cómo cada persona aceptó, que sea trazable.
6. Añade una política de reembolso.
7. Pide al usuario y usa solo los datos que de verdad necesito.
8. Verifica que tengo los derechos de cada imagen usada en la página.
9. Revisa las leyes locales que aplican y asegúrate de que mi página las cumpla.
```
Es una reconstrucción del dictado; la redacción exacta puede variar.

**Datos y cifras:**
- En Colombia no basta con que la persona haya dicho que sí: hay que poder probarlo ante la SIC (Whisper entendió "la CIC" `[verificar]`).
- Derecho de retracto: 5 días hábiles desde la compra en ventas online.

**Advertencias / errores comunes:** Claude arma todo en dos minutos, pero no sabe qué datos recoges, a quién le vendes ni qué le prometiste al cliente. Eso lo tienes que decir tú.

**Aplicación práctica:** los puntos 4, 5, 6 y 8 **no están** en `checklist-lanzamiento`; agregarlos (junto con el 13).

---

## Síntesis final

### Herramientas más repetidas

| Herramienta | Nº de videos | Uso |
|---|---|---|
| Claude / Claude Code | 12 (06, 07, 13, 14, 16, 20, 21, 22, 24, 26, 29, y 05 con Codex) | construir, revisar y generar con skills |
| Skills de terceros (`npx skills add`, `claude plugin install`) | 4 (07, 20, 22, 26) | darle capacidades nuevas al agente |
| Validar con un esquema / verificar el dueño del recurso (Zod, RLS) | 4 (04, 11, 17, 25) | no confiar en lo que manda el cliente |
| AWS (Payment Cryptography, S3) | 3 (03, 11, 18) | llaves de pago y archivos |
| Google Search Console y Analytics | 1 (28), y ya están en `checklist-lanzamiento` | presencia y medición |
| bcrypt / scrypt / argon2 | 1 (18) | hash de contraseñas |
| `AGENTS.md` / reglas del agente | 1 (05) | no repetir instrucciones |

### Ideas que se repiten

- **No confiar en el cliente:** precio y cantidad (04), ID del recurso (11), la Server Action "oculta" (17) y la llave pública de Supabase sin RLS (25). Es el patrón más repetido del lote.
- **Login y cuentas:** rate limiting por capas (09), hash lento con salt (18), recuperación de cuenta (19), 2FA y bloqueo de fuerza bruta (27).
- **Checklist legal antes de lanzar:** 13 y 29 coinciden en términos, privacidad, cookies, reembolsos, datos mínimos y derechos de imagen.
- **Definir bien antes de pedirle a la IA:** 05 y 06.
- **Señales de app hecha con IA:** degradados morados (16 y 23), textos de IA (16) y "bonita pero no funciona" (06).
- **Skills de terceros: útiles pero riesgosas.** 07, 22 y 26 las recomiendan; 20 advierte que hay que revisarlas antes.

### Ideas que se contradicen

- **Bloquear tras intentos fallidos:** el 27 recomienda "bloquear a quien prueba contraseñas sin parar", y el 09 advierte que bloquear la cuenta deja a cualquiera bloquear cuentas ajenas. Se reconcilian con el 09: limitar por IP y por cuenta con token bucket, sin bloqueo fijo.
- **Clean Code (15)** frente a sus críticos (Ousterhout y Muratori), citados en el mismo video: funciones diminutas contra legibilidad y rendimiento.
- **Ranking backend (08):** es opinión de una agencia; no se contradice con otro video, pero no está medido.

### Top 10 hallazgos

1. **Toda acción del servidor verifica sesión, esquema y dueño, y devuelve lo mínimo** (17, con código listo para copiar).
2. **El servidor recalcula precios**; nunca acepta `price` ni `quantity` sin validar (04).
3. **Supabase sin RLS = datos públicos**: activar RLS en cada tabla (25).
4. **Rate limiting por capas con token bucket** (IP 100/min, cuenta 5 con 1 cada 2 s, responde 429) (09).
5. **Recuperación de cuenta:** token de un uso que expira en minutos, la misma respuesta exista o no la cuenta, y cerrar sesiones al cambiar (19).
6. **Contraseñas:** argon2 o bcrypt con salt; nunca cifradas, nunca MD5 o SHA (18).
7. **El prompt legal de 9 puntos, con registro trazable del consentimiento** (29), más los puntos 6, 8–10 y 17–20 del 13.
8. **La fórmula de 4 partes para pedirle algo a un agente**, más `AGENTS.md` (05).
9. **Revisar las skills de terceros antes de instalarlas** y frenar la instalación si hay riesgo (20).
10. **Borrar el código muerto, automatizar el deploy y tener un botón de apagado** (02).

### Videos de mayor valor

1. **17 · Server Actions**: código real y 4 reglas aplicables hoy mismo.
2. **29 · Prompt legal**: prompt completo, explicado por un abogado y con datos de Colombia.
3. **11 · IDOR**: un ataque real paso a paso y su solución.
4. **09 · Rate limiting**: diseño concreto con cifras.
5. **19 · Recuperar contraseña**: errores típicos y diseño correcto.

### Videos con poco valor o fallidos

- **23**: sin voz, 9 segundos, solo estética.
- **24**: una lista de palabras clave; útil como vocabulario y nada más.
- **08**: ranking de opinión.
- **10**: interesante pero no aplica a nuestros proyectos por ahora.
- **06**: carrusel de fotos; solo se obtuvo la descripción. Los prompts están en las imágenes (pide capturas).
- **Ninguno falló del todo.**
