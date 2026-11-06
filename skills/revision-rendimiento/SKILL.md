---
name: revision-rendimiento
description: Revisa el rendimiento de una app con 10 puntos que el código generado por IA casi nunca hace bien en la primera versión. Cubre consultas N+1, escrituras una por una en vez de en lote, consultas sin índice, la interfaz que espera al backend (sin actualización optimista), tareas largas síncronas, HTML que se reconstruye en cada visita, respuestas sin comprimir ni caché, imágenes pesadas y sin lazy loading, el cuello de botella de una sola dependencia y las pruebas de carga (k6, mirando p95 y p99). Úsala cuando digan "la app está lenta", "se demora", "optimiza", "¿aguanta mil usuarios?", "prueba de carga", "rendimiento" o "performance", antes de lanzar algo que espera tráfico, o al revisar un PR que toca consultas, listados o imágenes.
---

# Revisión de rendimiento

Con un solo usuario todo se siente rápido. Con cien o mil aparecen los mismos problemas, y casi siempre son los mismos 10. Esta skill los busca en el código, los mide y propone el arreglo, empezando por los que más se notan.

## Flujo

1. **Detecta el stack**: ORM o acceso a datos (Prisma, Drizzle, Sequelize, TypeORM, Supabase, SQLAlchemy, Django), framework web y frontend.
2. **Corre el buscador de señales**:
   ```bash
   node <ruta-de-esta-skill>/scripts/revisar.mjs <carpeta> [--json]
   ```
   Marca cada punto como ✅, ⚠️ o ❌, con `archivo:línea`. Son **señales**: confírmalas leyendo el código.
3. **Mide antes de arreglar.** Usa el reporte de Lighthouse (DevTools › Lighthouse; exporta el JSON y léelo), la pestaña Network para ver qué petición tarda más, `EXPLAIN ANALYZE` para las consultas lentas y el log de consultas del ORM para contar cuántas hace una pantalla. Sin una medición, "optimizar" es adivinar.
4. **Arregla de mayor a menor impacto** con la guía de [`referencias/puntos.md`](referencias/puntos.md). Propón el cambio con el diff y explica qué mejora y cómo comprobarlo.
5. **Prueba de carga** si el sistema espera tráfico: adapta [`scripts/carga-k6.js`](scripts/carga-k6.js) al endpoint principal y córrelo **solo contra local o staging**, nunca contra producción ni contra servicios de terceros. Lee p95 y p99, no el promedio.
6. **Reporte final**: tabla con los 10 puntos, qué se encontró, qué se hizo y la medición de antes y después.

## Los 10 puntos

| # | Punto | La pregunta |
|---|---|---|
| 1 | **Consultas N+1** | ¿Una pantalla hace 1 consulta para la lista y 1 más por cada elemento? (100 pedidos = 101 consultas) |
| 2 | **Escrituras en lote** | ¿Se insertan o actualizan filas una por una en un bucle? |
| 3 | **Índices** | ¿Las columnas por las que se busca, filtra u ordena tienen índice? ¿Búsquedas con `LIKE '%x%'` sobre tablas grandes? |
| 4 | **Interfaz optimista** | ¿Cada clic espera al backend antes de mostrar el cambio? |
| 5 | **Tareas largas asíncronas** | ¿Enviar correos, generar PDFs o llamar a una IA bloquea la respuesta? Van a una cola o a segundo plano |
| 6 | **Páginas estáticas o cacheadas** | ¿El HTML que es igual para todos se reconstruye en cada visita? |
| 7 | **Compresión y caché HTTP** | ¿Las respuestas viajan sin gzip o brotli? ¿Los estáticos no tienen `Cache-Control`? ¿Lo que se lee mucho podría ir a una caché (Redis)? |
| 8 | **Imágenes y carga diferida** | ¿Imágenes de más de 200 KB, en PNG o JPG, sin `loading="lazy"`? ¿Listas enormes sin paginar? |
| 9 | **Un solo cuello de botella** | ¿Una petición o dependencia se lleva el 90 % del tiempo? |
| 10 | **Prueba de carga** | ¿Se sabe cuánto aguanta? ¿Se mira p95 y p99? |

## Reglas

- **Medir antes y después.** Cada arreglo lleva su número: consultas por pantalla, ms en p95, KB de la imagen o puntaje de Lighthouse.
- **No optimizar lo que no duele.** Un N+1 en una pantalla de 3 elementos o un índice en una tabla de 50 filas puede esperar. Primero el endpoint más usado o más lento.
- **No sacrificar la corrección por velocidad.** Una caché que muestra datos de otro usuario es un fallo de seguridad. Antes de cachear, define cuándo se invalida y que la clave incluya al usuario si los datos son por usuario.
- **Pruebas de carga solo contra local o staging**, con datos de prueba. Nunca contra producción, servicios de terceros o APIs que cobran por uso.
- Lo que no aplica (sin base de datos, sitio estático) se marca "no aplica".

## Cuándo no usarla

- Un sitio estático antes de lanzar: imágenes, velocidad y Lighthouse ya están en `checklist-lanzamiento` (puntos 11 y 12).
- Seguridad: usa `revision-seguridad-backend`. El rate limiting está allá, aunque también protege el rendimiento.
