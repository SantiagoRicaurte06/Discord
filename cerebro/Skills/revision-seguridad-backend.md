---
tipo: skill
nombre: revision-seguridad-backend
repo: SantiagoRicaurte06/Discord
estado: creada
categoria: seguridad
origen: ["[[referencias-limpias]]"]
instalar: npx skills add santiagoricaurte06/discord --skill revision-seguridad-backend
fecha: 2026-11-04
---

# revision-seguridad-backend

**Qué hace:** revisa 12 puntos de seguridad del backend, con un script que busca señales en el código (`scripts/revisar.mjs`).

**De dónde salió:** es el tema más repetido del lote del 2026-11-04 (TikTok):
- 04 precio y cantidad del cliente
- 11 IDOR
- 17 Server Actions
- 25 Supabase sin RLS
- 09 rate limiting
- 18 contraseñas
- 19 recuperación de cuenta
- 03 tarjetas
- 02 deploy (Knight Capital)

## Decisión
- [x] Aprobada por el usuario (2026-11-04)
- [x] Agregada a `catalogo.json`, `guia-skills` e `instalar.sh`
