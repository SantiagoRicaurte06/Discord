# Lote: procesar una lista de links

Este es el procedimiento que definió el usuario. Síguelo completo y en orden.

Carpeta del lote: `cerebro/Lotes/<yyyy-mm-dd>-<plataforma o tema>/`, con:

```
enlaces.md                 # todos los links, numerados, con su estado
referencias-limpias.md     # lo útil de cada video + síntesis final
transcripciones/NN-titulo-corto.txt
estado.json                # lo escribe el script; permite retomar
```

## 1. Bajar todo con el script

Guarda los links, uno por línea y en el orden en que llegaron, sin quitar duplicados. Después:

```bash
python <ruta-de-esta-skill>/scripts/lote.py <links.txt> <carpeta-del-lote> --fotos <scratchpad>/fotos
```

- Por cada link corre `transcripcion.py`. Primero intenta subtítulos del autor, luego automáticos, luego `youtube-transcript-api` y, si nada funciona, Whisper `small` sobre el audio. Además saca 4 fotogramas.
- Con unos 30 videos de TikTok tarda entre 25 y 30 minutos si hay GPU; córrelo en segundo plano.
- Si un video falla, lo anota con el motivo y sigue con el siguiente. Si se corta, vuelve a correrlo: retoma donde quedó.
- Al final escribe `enlaces.md`: tabla `# | Enlace | Plataforma | Estado`, con los duplicados marcados (mismo ID de video) pero sin borrarlos.

### Problemas conocidos (aprendidos en el lote de 2026-11-04)

| Señal | Qué pasa | Qué hacer |
|---|---|---|
| `transcripcion: eng-US` en un video en español | TikTok solo entrega una **traducción automática** al inglés | Repetir con `transcripcion.py <url> -o <archivo> --solo-whisper` para tener el audio original |
| Transcripción vacía, o "Amara.org" / "Gracias por ver" | Video sin voz (solo música), o Whisper inventando sobre música | Ya se filtra y se reintenta solo. Si sigue vacía, sacar más fotogramas (`--fotogramas 8`) y leerlos |
| `formato: carrusel de fotos` | Publicación de imágenes: no hay voz y las imágenes no se pueden bajar | Usar la descripción y pedirle capturas al usuario si el contenido está en las imágenes |
| Términos raros ("una spline", "la CIC", "esta tierese") | Whisper entiende mal tecnicismos y nombres | Confirmar con los fotogramas; si no se puede, `[verificar]` |
| Links en los títulos de `referencias-limpias.md` | Es fácil cruzarlos a mano | Tomar cada link de `estado.json` por su número, nunca de memoria |

## 2. Leer cada video

Para cada video, en orden: lee **la transcripción completa** y los fotogramas (Read sobre cada `.jpg`). Los fotogramas importan sobre todo cuando el autor muestra código, comandos, una página o una lista en pantalla. No resumas solo con el título o la descripción.

## 3. Escribir `referencias-limpias.md`

Arriba, una línea con la fecha, cuántos videos hay y el enlace a `[[enlaces]]`. Después, un bloque por video:

```markdown
### NN. [Título del video](enlace)
**Canal:** @autor · **Duración:** mm:ss · **Tema principal:** una línea

**Idea clave:** …
**Puntos útiles:** …
**Herramientas / recursos mencionados:** …
**Pasos o procesos concretos:** …
**Prompts, comandos, código o configuraciones:** (bloques de código)
**Datos y cifras:** …
**Advertencias / errores comunes:** …
**Aplicación práctica:** …
**Marca de tiempo relevante:** `mm:ss` …
```

Lo que va en cada sección está en [`notas.md`](notas.md). Omite las secciones vacías. Un video duplicado lleva solo "Duplicado de NN".

## 4. Síntesis final, al pie de `referencias-limpias.md`

- **Herramientas más repetidas**: tabla `Herramienta | Nº de videos | Uso`.
- **Ideas que se repiten o se contradicen** entre videos.
- **Top 10 hallazgos** más útiles del conjunto.
- **Videos de mayor valor**: los 3–5 mejores y por qué.
- **Videos con poco valor o fallidos**, para descartar.

## 5. Pasarlo al cerebro

Cuando el usuario apruebe el lote, o si te lo pidió desde el inicio:

- Cada video con valor 3 o más pasa a `Videos/` como nota propia, con `lote:` apuntando a la carpeta.
- Las herramientas o skills mencionadas en 2 o más videos se vuelven notas en `Skills/` como `candidata`.
- Las ideas accionables van a `Ideas/`.

## 6. Reportar y esperar

Muestra el total procesado, el total fallido y la ruta de los dos archivos. Después **espera la revisión del usuario** antes de seguir con el paso 5 o crear skills.
