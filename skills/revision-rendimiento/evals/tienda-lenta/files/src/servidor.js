import express from 'express';
import nodemailer from 'nodemailer';
import { db } from './db.js';
const app = express();

app.get('/api/pedidos', async (req, res) => {
  const pedidos = await db.pedido.findMany();
  for (const p of pedidos) {
    p.cliente = await db.cliente.findUnique({ where: { id: p.clienteId } });
  }
  res.json(pedidos);
});

app.post('/api/importar', async (req, res) => {
  for (const fila of req.body.filas) {
    await db.pedido.create({ data: fila });
  }
  res.json({ ok: true });
});

app.post('/api/registro', async (req, res) => {
  const user = await db.cliente.create({ data: req.body });
  await nodemailer.createTransport({}).sendMail({ to: user.correo, subject: 'Bienvenido' });
  res.json(user);
});

app.get('/api/buscar', async (req, res) => {
  res.json(await db.$queryRaw`SELECT * FROM "Cliente" WHERE nombre LIKE '%' || ${req.query.q} || '%'`);
});
app.listen(3000);
