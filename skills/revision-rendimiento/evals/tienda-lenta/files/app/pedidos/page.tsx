export const dynamic = 'force-dynamic'
export default async function Page() {
  const r = await fetch('https://api.ejemplo.com/pedidos')
  const pedidos = await r.json()
  return <div><img src="/banner.png" />{pedidos.map((p) => <p key={p.id}>{p.total}</p>)}</div>
}
