# Formato de las notas de video

La misma estructura sirve para una nota en `Videos/` y para cada bloque de `referencias-limpias.md`. Va solo lo interesante y accionable: nada de saludos, patrocinios, "dale like" ni repeticiones. Si una sección no tiene nada, se omite.

| Sección | Qué va |
|---|---|
| **Idea clave** | 1–2 frases con lo esencial |
| **Puntos útiles** | Conceptos, técnicas, flujos o estrategias que explica |
| **Herramientas / recursos** | `Nombre — para qué sirve — link si lo dan` |
| **Pasos concretos** | Si enseña a hacer algo, el paso a paso exacto, numerado |
| **Prompts, comandos, código** | Todo lo literal que se muestre o dicte, en bloques de código, en su idioma original. Revisa los fotogramas: a veces el código solo aparece en pantalla |
| **Datos y cifras** | Precios, límites, métricas, comparativas |
| **Advertencias** | Lo que el autor dice que NO hay que hacer |
| **Aplicación práctica** | 1–3 líneas sobre cómo usarlo directamente (en nuestros proyectos, el bot o una skill) |
| **Marcas de tiempo** | `mm:ss` de las partes más valiosas |

## Propiedades de una nota de video

```yaml
tipo: video
titulo: "Título original"
url: https://...
plataforma: tiktok          # youtube, instagram, x…
autor: "@usuario"
duracion: "01:59"
fecha_publicado: 2026-11-03
fecha_visto: 2026-11-04
estado: procesado           # por-procesar | procesado | sin-transcripcion
valor: 4                    # 1–5: qué tan útil fue (mueve los tableros)
temas: [backend, sistemas-distribuidos]
herramientas: ["[[Claude Code]]", "[[Obsidian]]"]
skills: ["[[skill-creator]]"]
lote: "2026-11-04-tiktok"
```

**Valor**: 5 = cambia cómo trabajamos o da algo listo para usar; 4 = técnica concreta y aplicable; 3 = buena idea general; 2 = poco nuevo; 1 = relleno o publicidad.

## Marcar dudas

Si Whisper entendió mal un nombre propio, un comando o una cifra y no se puede confirmar con los fotogramas, se copia tal cual y se marca `[verificar]`. Nunca se "corrige" adivinando.
