# Repositorio inicial del equipo

Es el punto de partida de cada proyecto nuevo. Aquí están las **skills** del equipo, que son instrucciones para Claude Code, con **cuándo y por qué usar cada una**, las normas de **Git**, el **hook de protección** y el **cerebro**, que guarda lo que aprendemos de videos e ideas.

También vive aquí el bot de Discord que organiza los proyectos. Cada repo que crea ya trae todo lo de este repo instalado ([docs del bot](docs/bot-discord.md)).

```
cerebro/          vault de Obsidian: videos, ideas y skills candidatas
skills/           skills del equipo (cada una con su SKILL.md) + catalogo.json
GIT_WORKFLOW.md   normas de ramas, commits, PRs y releases
CLAUDE.md         reglas para Claude Code en este repo
.claude/          hook de protección activo
.githooks/        hooks de Git (formato de commits, sin commits a main/develop)
.github/          CI de commits y pruebas, plantilla de PR
src/  docs/       el bot de Discord
```

## Empezar un proyecto, paso a paso

```
 1. instalar     2. idea        3. repo           4. construir              5. revisar                           6. lanzar                   7. entregar
 skills     ──► grill-me ──►  git-workflow ──►  caveman · RTK      ──►  anti-slop                     ──►  checklist-lanzamiento ──► entrega-al-cliente
 proteccion                                     git-workflow (siempre)   revision-seguridad-backend          (security-audit si es
                                                                         revision-rendimiento                 grande o sensible)
                                                                         thermos
                          cerebro + skill-creator: lo que aprendemos se vuelve skill nueva
```

1. **Instala las skills en el proyecto**, una sola vez. Los repos que crea el bot ya las traen.
   ```bash
   npx skills@latest add santiagoricaurte06/discord --skill guia-skills
   bash .claude/skills/guia-skills/scripts/instalar.sh --instalar     # todas, más el hook de protección
   ```
   Con `--global` quedan para todos tus proyectos. Sin `--instalar` solo muestra qué falta.
2. **Antes de construir: `/grill-me`.** Claude te entrevista hasta que no quede ninguna decisión abierta.
3. **Prepara el repo con `git-workflow`.** Se encarga de `develop`, hooks, CI y plantilla de PR (`bash .claude/skills/git-workflow/scripts/configurar.sh`, y `--aplicar` para que haga los cambios). Después de clonar, cada persona corre una vez `git config core.hooksPath .githooks`.
4. **Construye.** git-workflow en cada rama y commit, y `proteccion` siempre activa. Si la sesión es larga, `caveman` y RTK ahorran tokens.
5. **Antes del PR**:
   - `anti-slop` para textos y código;
   - `revision-seguridad-backend` si el cambio toca login, datos o pagos;
   - `revision-rendimiento` si toca consultas, listados o imágenes, o si la app está lenta;
   - `/thermos` si el PR es importante.
6. **Antes de deployar un sitio: `checklist-lanzamiento`.** Antes de un lanzamiento grande o con datos sensibles, una auditoría completa con `security-audit` (Cloudflare).
7. **Al entregar a un cliente: `entrega-al-cliente`.** Cuentas a su nombre, accesos, manuales, legal y acta firmada.

No hace falta acordarse de todo esto: la skill **`guia-skills`** le dice a Claude cuál aplicar en cada momento.

## Las skills: cuándo y por qué

| Momento | Skill | Por qué | Cómo se usa |
|---|---|---|---|
| Antes de construir algo nuevo o con requisitos vagos | **grill-me** ([mattpocock/skills](https://github.com/mattpocock/skills)) | Evita construir algo distinto a lo que se quería: Claude entrevista hasta cerrar todas las decisiones | Escribe `/grill-me`. Claude usa la variante `grilling` por su cuenta |
| Al crear ramas, commits, PRs, releases o hotfixes | **git-workflow** (propia) | Historial limpio y las mismas normas en todos los proyectos: Git Flow simplificado, Conventional Commits, SemVer | Automática al hacer commits o PRs. En un repo nuevo: `configurar.sh --aplicar`. Normas en [GIT_WORKFLOW.md](GIT_WORKFLOW.md) |
| Siempre, desde que se abre el repo | **proteccion** (propia) | Un hook frena **antes de ejecutarse** lo que rompe todo: borrar la base de datos, `rm -rf` del proyecto, force push a main o develop, `--no-verify` | Funciona sola si está activa en `.claude/settings.json` (`activar.sh`). Si bloquea algo que sí querías, córrelo tú con `!comando` |
| Antes de mergear o deployar algo con login, endpoints, Server Actions, Supabase, pagos o permisos | **revision-seguridad-backend** (propia) | Las apps hechas con IA repiten 12 fallos: sesión, validación, dueño del recurso (IDOR), precios del cliente, RLS, rate limiting, contraseñas, recuperación de cuenta, tokens, tarjetas y deploy | "Revisa la seguridad". Corre `scripts/revisar.mjs <carpeta>` y revisa cada endpoint con `referencias/puntos.md` |
| Auditoría de seguridad completa antes de un lanzamiento grande o con datos sensibles | **security-audit** ([cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill)) | Seis fases con agentes aislados: el agente que encuentra un fallo nunca es el que lo confirma, otro intenta desmentirlo. No toca tu código ni prueba contra producción | "Haz una auditoría de seguridad de este repo". Es lenta y costosa (muchos subagentes): úsala para lo grande |
| La app está lenta, antes de lanzar algo con tráfico, o un PR que toca consultas, listados o imágenes | **revision-rendimiento** (propia) | El código generado repite 10 problemas: N+1, escrituras una por una, índices, interfaz que espera al backend, tareas largas síncronas, HTML dinámico, compresión y caché, imágenes, cuello de botella y sin prueba de carga | "La app está lenta". Corre `scripts/revisar.mjs <carpeta>`, mide antes y después, y prueba la carga con `scripts/carga-k6.js` (solo local o staging) |
| Antes de mergear un PR importante (seguridad, pagos, permisos, PR grande) | **thermos** ([cursor/plugins](https://github.com/cursor/plugins)) | Dos revisores en paralelo: uno busca bugs y seguridad, el otro calidad de código | Escribe `/thermos` |
| Al terminar textos, READMEs, landings o código generado | **anti-slop** ([rand/cc-polymath](https://github.com/rand/cc-polymath)) | Quita frases de relleno, nombres genéricos y diseño de plantilla | Automática al cerrar textos o código |
| Antes de deployar un sitio web | **checklist-lanzamiento** (propia) | 36 cosas que una página hecha con IA suele olvidar: legal y consentimiento, SEO, imágenes, 404, spam, WhatsApp, Clarity, señales de IA y WordPress | "¿Está lista la página?". Compila y corre `scripts/revisar.mjs dist` |
| Al entregar un proyecto a un cliente | **entrega-al-cliente** (propia) | Que el cliente sea dueño de sus cuentas, pueda operar sin llamarte y quede claro qué cubre la garantía | "Voy a entregar el proyecto". Genera inventario de accesos (sin contraseñas), manuales, legal y acta desde `plantillas/` |
| Sesiones largas o cuando quieres gastar menos | **caveman** ([JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman)) | Respuestas cortas con el mismo contenido técnico: menos tokens | Claude te la propone. La versión fuerte es `/ultracave` |
| Comandos con salidas largas (tests, builds, logs) | **RTK** ([rtk-ai/rtk](https://github.com/rtk-ai/rtk)) | Comprime lo que Claude lee de la terminal (entre 40 y 90 % menos) | Es un programa, no una skill: `instalar.sh --con-rtk` |
| Hay que crear o mejorar una skill | **skill-creator** ([anthropics/skills](https://github.com/anthropics/skills)) | El método oficial de Anthropic: entrevista, borrador, casos de prueba y mejora de la descripción para que se active cuando debe | "Crea una skill para…". Las del equipo van en `skills/<nombre>/`, en español |
| Para saber cuál usar | **guia-skills** (propia) | Claude elige la skill correcta sin que tengas que acordarte | Automática al empezar cualquier tarea |

Cuándo **no** usarlas:
- **grill-me** no va con cambios pequeños ni obvios.
- **thermos** y **revision-seguridad-backend** no van con un typo ni con sitios estáticos.
- **security-audit** no va en el día a día: es una auditoría completa y costosa.
- **revision-rendimiento** no va en apps pequeñas sin tráfico: no se optimiza lo que no duele.
- **checklist-lanzamiento** no aplica a APIs, CLIs ni bots.
- **caveman** no conviene cuando quieres aprender o el texto es para otras personas.

El detalle está en [`skills/guia-skills/SKILL.md`](skills/guia-skills/SKILL.md).

### Solo en este repo: el cerebro

| Momento | Skill | Por qué | Cómo se usa |
|---|---|---|---|
| Ves un video útil (TikTok, YouTube, Instagram, X) o tienes una idea | **cerebro** (propia) | Lo útil de cada video queda en el vault y termina en skills o proyectos, no en el olvido | Pásale los links a Claude: "procesa estos videos". Saca la transcripción (Whisper si no hay subtítulos), escribe `enlaces.md` y `referencias-limpias.md`, y propone skills |
| Escribes notas o tableros en `cerebro/` | **obsidian** ([kepano/obsidian-skills](https://github.com/kepano/obsidian-skills)) | Sintaxis correcta de Obsidian: wikilinks, callouts, Bases y canvas | La usa Claude al tocar el vault |

Para abrir el vault: *Obsidian → Abrir carpeta como vault → `cerebro/`*. El primer lote, con 29 TikTok, está en [`cerebro/Lotes/2026-11-04-tiktok/`](cerebro/Lotes/2026-11-04-tiktok/referencias-limpias.md).

El cerebro necesita en tu equipo:
```bash
pip install youtube-transcript-api yt-dlp curl_cffi truststore faster-whisper   # y ffmpeg
```

## Cómo crece este repo

1. Ves un video o tienes una idea, y se lo pasas a Claude, que lo guarda en el **cerebro**.
2. Las skills de terceros que aparecen quedan como **candidatas** en `cerebro/Skills/`. Solo con tu OK se agregan al catálogo.
3. Las ideas que se repiten se vuelven **skills propias** con **skill-creator**, en `skills/<nombre>/`.
4. Cada skill nueva se registra en tres lugares:
   - [`skills/catalogo.json`](skills/catalogo.json): el bot la publica y vigila sus cambios cada día;
   - la tabla de `guia-skills`;
   - el instalador `instalar.sh`.

Las skills que salieron del cerebro son:
- del lote del 2026-11-04: `revision-seguridad-backend` y la ampliación de `checklist-lanzamiento`;
- del lote del 2026-11-05: `revision-rendimiento`, `entrega-al-cliente` y la adopción de `security-audit` de Cloudflare.

## Reglas del repo

- Ramas `tipo/descripcion` desde `develop`, sin commits directos a `main` ni `develop`, y commits en Conventional Commits. Ver [GIT_WORKFLOW.md](GIT_WORKFLOW.md).
- Nada de `.env` ni llaves en el repo: el hook `pre-commit` los rechaza.
- Si `🛡️ proteccion` bloquea algo, no se rodea: se explica y se busca la alternativa segura.

## El bot de Discord

Organiza proyectos, ideas, videos, archivos y links de Drive en el servidor. Además crea el repo de cada proyecto con las skills de aquí ya instaladas. Puesta en marcha, comandos y deploy: [docs/bot-discord.md](docs/bot-discord.md).
