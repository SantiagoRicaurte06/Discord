---
tipo: skill
nombre: security-audit
repo: cloudflare/security-audit-skill
estado: adoptada
categoria: seguridad
origen: ["[[2026-11-05-tiktok/referencias-limpias|lote 2026-11-05 #28]]"]
instalar: npx skills add https://github.com/cloudflare/security-audit-skill --skill security-audit
licencia: MIT
fecha: 2026-11-05
---

# security-audit (Cloudflare)

**Qué hace:** hace una auditoría de seguridad en 6 fases con agentes aislados:
1. reconocimiento;
2. búsqueda guiada por un registro de cobertura;
3. validación de cada candidato por un agente nuevo que intenta desmentirlo;
4. `findings.json` validado con un esquema;
5. verificación independiente;
6. reporte.

**Cuándo la usamos:** antes de un lanzamiento grande o con datos sensibles, o cuando piden una auditoría completa. Para revisiones rápidas: [[revision-seguridad-backend]].

## Evaluación (2026-11-05)
- **Repo oficial de Cloudflare**, MIT, mantenido (último cambio: 2026-09-14), no archivado. El video decía "33.000 estrellas"; tiene más de 60.000.
- **Qué ejecuta:** sus dos scripts (`validate-findings.cjs`, `validate-coverage-ledger.cjs`) solo leen y validan archivos locales. No usan red, no ejecutan comandos y no tienen dependencias.
- **Seguridad del método:**
  - por defecto solo da orientación;
  - el modo de auditoría completa hay que pedirlo;
  - no modifica el código;
  - no prueba contra producción ni servicios desplegados;
  - si va a ejecutar código del proyecto, exige sandbox sin red;
  - el reporte va fuera del repo (`~/security-audit-skill/<repo>/run-N`).
- **Costo:** lanza muchos subagentes. Según sus autores, una sola pasada encuentra más o menos la mitad de lo que encuentran varias.
- **Veredicto:** adoptada. Complementa `revision-seguridad-backend`, no la reemplaza.

## Decisión
- [x] Aprobada por el usuario (2026-11-05)
- [x] Agregada a `catalogo.json`, `guia-skills`, `instalar.sh` y README
