# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado [SemVer](https://semver.org/lang/es/).

## [1.1.0] - 2026-11-05

### Añadido
- **Repositorio inicial del equipo**: el README es la guía para empezar un proyecto. Explica qué skill usar, cuándo y por qué (grill-me → git-workflow → construir → revisar → lanzar → entregar). La documentación del bot pasa a `docs/bot-discord.md`. (#1)
- **Git workflow aplicado al repo**: ramas `main` y `develop` protegidas, `GIT_WORKFLOW.md`, `CLAUDE.md`, hooks locales, CI de commits y pruebas, y plantilla de PR. (#1)
- **Cerebro**: vault de Obsidian en `cerebro/` y skill `cerebro`, que saca datos, transcripción (Whisper si no hay subtítulos) y fotogramas de TikTok, YouTube, Instagram y X, y procesa lotes de links. Incluye los lotes del 2026-11-04 (29 videos) y del 2026-11-05 (43 links). (#1, #2)
- **Skill `revision-seguridad-backend`**: 12 puntos de seguridad del backend con un script de señales. (#1)
- **Skill `revision-rendimiento`**: 10 puntos de rendimiento con un script de señales y una plantilla de prueba de carga con k6. (#2)
- **Skill `entrega-al-cliente`**: checklist y plantillas para entregar proyectos a clientes (accesos, manuales, legal, acta). (#2)
- **Skills de terceros adoptadas**: `skill-creator` (Anthropic), `obsidian` (kepano, solo en este repo) y `security-audit` (Cloudflare). (#1, #2)

### Cambiado
- **`checklist-lanzamiento`** pasa de 24 a 36 puntos: casillas de consentimiento separadas y registro trazable, reembolsos y retracto, derechos de imágenes, borrar la cuenta, señales de app hecha con IA, Microsoft Clarity, Meta Pixel y WordPress. (#1)
- **`guia-skills`** y su instalador registran las skills nuevas. `cerebro` y `obsidian` ya no se instalan en cada proyecto. (#1, #2)

## [1.0.0]

- Bot organizador de proyectos para Discord, con skills del equipo (`grill-me`, `caveman`, RTK, `anti-slop`, `thermos`, `checklist-lanzamiento`, `git-workflow`, `proteccion`, `guia-skills`).
