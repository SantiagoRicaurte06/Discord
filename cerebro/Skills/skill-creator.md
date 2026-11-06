---
tipo: skill
nombre: skill-creator
repo: anthropics/skills
estado: adoptada
categoria: crear skills
origen: []
instalar: npx skills add anthropics/skills --skill skill-creator
licencia: ver repo
fecha: 2026-11-04
---

# skill-creator

**Qué hace:** es la skill oficial de Anthropic para crear skills nuevas y mejorar las que ya existen.

**Cuándo la usamos:** cuando una idea o técnica del cerebro merece ser una skill del equipo, o cuando una skill no se activa cuando debería.

## Cómo trabaja
1. Entrevista: qué debe hacer la skill, cuándo se activa y qué entrega.
2. Escribe `SKILL.md` con su `description`, que es lo que decide cuándo se activa. Conviene que sea algo "insistente" para que no se quede sin usar.
3. **Carga por niveles** ([[Progressive disclosure]]): siempre está cargada solo la descripción; `SKILL.md` se lee cuando la skill se activa, y `scripts/` y `referencias/` solo cuando hacen falta.
4. Crea casos de prueba en `evals/<caso>/` y corre cada uno con la skill y sin ella para comparar.
5. Itera con tu revisión y, al final, optimiza la descripción.

## Decisión
- [x] Adoptada: el usuario pidió una skill para crear skills de forma profesional (2026-11-04)
- [x] Agregada a `catalogo.json`, `guia-skills` e `instalar.sh`
