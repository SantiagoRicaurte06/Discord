
## Git workflow

Este repositorio sigue `GIT_WORKFLOW.md`. Reglas obligatorias para asistentes de IA:

- Ramas `tipo/descripcion-corta` (feature, fix, refactor, docs, chore, release, hotfix) desde `develop` (hotfix desde `main`). Nunca commit directo a `main` ni `develop`.
- Commits en Conventional Commits: `<tipo>(<scope>): <descripción>`, imperativo, minúscula, sin punto final, ≤ 72 caracteres.
- **No añadir coautorías** (`Co-Authored-By`) ni firmas de generación automática en commits, PRs, tags o releases.
- No modificar `user.name` ni `user.email`.
- No hacer `push`, `force-push`, reescritura de historial, merges a `main`/`develop` ni crear tags sin aprobación explícita.
- Proponer el mensaje del commit y el diff antes de ejecutar cuando el cambio no sea trivial.
- Antes de reescribir historial: `git branch backup/<descripcion>-<yyyymmdd>`.

## Skills del equipo

Este es el repositorio inicial del equipo: las skills viven en `skills/<nombre>/SKILL.md` (aunque no estén instaladas en `.claude/skills`, léelas de ahí).

- Al empezar cualquier tarea, consulta `skills/guia-skills/SKILL.md` para decidir qué skill aplicar: grill-me antes de construir, git-workflow en cada commit, revision-seguridad-backend y thermos antes de mergear lo sensible, checklist-lanzamiento antes de deployar un sitio.
- Para crear o mejorar una skill usa **skill-creator** y regístrala en `skills/catalogo.json`, la tabla de `guia-skills` y `skills/guia-skills/scripts/instalar.sh`.
- Links de videos o ideas → skill `cerebro` (vault en `cerebro/`). El usuario trae los links; no busques por tu cuenta. Las skills de terceros quedan como candidatas hasta su OK.
- Si el hook `🛡️ proteccion` bloquea un comando, no lo rodees: explica y propón una alternativa segura.
- Todo en español.
