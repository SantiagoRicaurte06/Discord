'use server'
import { db } from '@/lib/db'

export async function borrarFactura(id: string) {
  await db.factura.delete({ where: { id } })
}
