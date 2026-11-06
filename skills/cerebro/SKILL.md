---
name: cerebro
description: Segundo cerebro del equipo en Obsidian (carpeta cerebro/ del repo). Úsala siempre que el usuario pase links de videos (TikTok, YouTube, Instagram, X) o una lista de links para "procesar", "resumir", "sacar lo útil", "meter al cerebro" o "extraer info"; cuando cuente una idea para guardar; cuando pregunte qué aprendimos o qué dijo un video; o cuando un video mencione una skill, herramienta o repo que valga la pena evaluar o convertir en skill del equipo. También para crear notas, tableros (.base) o enlaces dentro del vault, aunque no diga "cerebro" ni "Obsidian".
---

# Cerebro

El cerebro es un vault de Obsidian dentro del repo: `cerebro/` (se ubica buscando `cerebro/Inicio.md`). Las notas son Markdown con propiedades YAML, enlazadas con `[[wikilinks]]`. Obsidian solo las muestra, así que tú escribes los archivos directamente.

Su propósito: que lo que se ve en videos termine en **skills** y **proyectos**, no solo en notas. Cada vez que proceses algo, pregúntate qué se puede usar y deja eso a la vista.

## Reglas del usuario

- **Todo en español**, aunque el video esté en inglés. Prompts, comandos y código van en su idioma original.
- **El usuario trae los links.** No salgas a buscar videos ni skills por tu cuenta. Si un video menciona un repo concreto, sí puedes abrir *ese* repo para evaluarlo.
- **No inventes.** Lo que no se entienda en la transcripción va marcado `[verificar]`.
- **Las skills nuevas esperan su OK**: quedan como `candidata` o `evaluada` hasta que el usuario apruebe.

## Qué hacer según lo que llegue

| Llega… | Flujo |
|---|---|
| Uno o pocos links | **Video suelto**: nota en `Videos/` |
| Una lista de links, o el usuario pide `enlaces.md` / `referencias-limpias.md` | **Lote**: lee [`referencias/lote.md`](referencias/lote.md) y síguelo completo |
| Una idea en texto | Nota en `Ideas/` con la plantilla, enlazada a lo relacionado |
| "¿Qué aprendimos de X?" o "¿qué dijo el video de…?" | Busca con Grep en `cerebro/` (propiedades y texto) y responde citando las `[[notas]]` |
| Un video menciona una skill o repo útil | **Skill candidata** (abajo) |
| "Haz una skill de esto", o una idea que se repite en varias notas | **Skill propia** (abajo) |

### Video suelto

1. Saca el contenido:
   ```bash
   python <ruta-de-esta-skill>/scripts/transcripcion.py "<url>" -o <scratchpad>/NN.txt --whisper small --fotogramas 4 --carpeta-fotos <scratchpad>/fotos/NN
   ```
   Imprime título, autor, duración, hashtags y la ruta de cada fotograma. El archivo trae la descripción del autor y la transcripción con `[mm:ss]`. Código de salida 2 significa que no hubo transcripción.
2. **Lee la transcripción completa**, y también los fotogramas (con Read) cuando el video muestre pantalla, código o texto escrito. Un resumen hecho solo con el título o la descripción no sirve.
3. Escribe `Videos/<Título corto>.md` siguiendo `cerebro/Plantillas/Video.md`. El formato de cada sección está en [`referencias/notas.md`](referencias/notas.md). Omite las secciones vacías en vez de rellenarlas.
4. Enlaza: herramientas y conceptos con `[[...]]`. Crea una nota en `Conceptos/` solo si el concepto aparece en 2 o más videos. Si se menciona una skill, crea o actualiza su nota en `Skills/`.

Si falta alguna dependencia, el script lo dice. Instálalas con `pip install youtube-transcript-api yt-dlp curl_cffi truststore faster-whisper`, y además `ffmpeg` para los fotogramas.

### Skill candidata

1. Crea `Skills/<nombre>.md` con la plantilla, `estado: candidata` y `origen: ["[[video]]"]`.
2. Evalúala. Revisa si el repo existe y cuándo se actualizó (`curl -s https://api.github.com/repos/<dueño>/<repo>`), lee su `SKILL.md` y busca qué ejecuta o instala. Mira si se solapa con `skills/catalogo.json` o `skills/guia-skills/SKILL.md`. Escribe el veredicto en la nota y pasa a `estado: evaluada`.
3. Propónsela al usuario en 2–3 líneas: qué hace, para qué nos sirve y qué riesgo tiene.
4. **Solo con su OK**:
   - agrégala a `skills/catalogo.json`, a la tabla de `skills/guia-skills/SKILL.md` y al `CATALOGO` de `skills/guia-skills/scripts/instalar.sh`;
   - deja la nota en `estado: adoptada`.
   Si la rechaza, `estado: descartada` con el motivo.

### Skill propia

Cuando una idea o técnica merece ser una skill del equipo:

1. Usa la skill **skill-creator** de Anthropic. Si no está instalada: `npx skills add anthropics/skills --skill skill-creator`. Sigue su proceso: entrevista, borrador, casos de prueba e iteración.
2. Créala en `skills/<nombre>/` siguiendo el estilo del repo: en español, `SKILL.md` con la descripción en tercera persona y los disparadores, y `scripts/` para lo repetitivo.
3. Agrégala a `catalogo.json` con `"repo": "SantiagoRicaurte06/Discord"` y `"adjuntar": true`, y a `guia-skills`.
4. Nota en `Skills/` con `estado: creada` y `origen` apuntando a los videos o ideas que la inspiraron.
5. Para los commits, sigue la skill `git-workflow`: rama `feature/…` y Conventional Commits en español.

## Formato de las notas de Obsidian

- Propiedades YAML arriba. Las listas van como `[a, b]`, y los enlaces dentro de propiedades van entre comillas: `"[[Nota]]"`.
- Enlaces internos con `[[Nota]]` o `[[Nota|texto]]`; para incrustar, `![[Nota]]`.
- Callouts: `> [!tip]`, `> [!warning]`, `> [!abstract]`.
- Los tableros de `Tableros/*.base` filtran por la propiedad `tipo` (`video`, `idea`, `skill`, `concepto`). Si no la pones, la nota no aparece en ningún tablero.
- Si están instaladas las skills `obsidian-markdown` y `obsidian-bases` (de kepano), consúltalas para sintaxis avanzada.
