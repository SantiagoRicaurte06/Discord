---
tipo: skill
nombre: cerebro
repo: SantiagoRicaurte06/Discord
estado: creada
categoria: conocimiento
origen: []
instalar: npx skills add santiagoricaurte06/discord --skill cerebro
fecha: 2026-11-04
---

# cerebro

**Qué hace:** convierte links de videos e ideas en notas de este vault, y lo útil en skills candidatas.

- `scripts/transcripcion.py`: con un link saca datos, descripción, subtítulos y fotogramas. Si el video no tiene subtítulos, transcribe el audio con Whisper. Funciona con TikTok, YouTube, Instagram y X.
- `scripts/lote.py`: procesa una lista completa de links y escribe `enlaces.md`. Si se corta, retoma donde quedó.
- `referencias/lote.md`: el procedimiento del usuario para lotes (enlaces, referencias limpias y síntesis).

## Pendiente
- [ ] Correr los casos de prueba de `skills/cerebro/evals/` con skill-creator
- [ ] Opcional: importar al vault las publicaciones del foro `/idea-video` de Discord
