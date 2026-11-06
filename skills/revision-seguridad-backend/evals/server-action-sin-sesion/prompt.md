---
tags: [revision-seguridad-backend]
max_turns: 20
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

tengo esta server action en next, el botón de eliminar solo lo ven los usuarios logueados así que supongo que está bien no? arréglala si hace falta

```ts
'use server'
import { db } from '@/lib/db'
export async function eliminarProyecto(formData: FormData) {
  const id = formData.get('id') as string
  await db.proyecto.delete({ where: { id } })
  return await db.proyecto.findMany()
}
```
