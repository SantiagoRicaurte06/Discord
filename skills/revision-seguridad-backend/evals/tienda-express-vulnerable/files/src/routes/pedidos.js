import express from 'express';
import crypto from 'node:crypto';
import { db } from '../db.js';
const router = express.Router();

router.post('/api/login', async (req, res) => {
  const user = await db.users.findOne({ email: req.body.email });
  if (!user) return res.status(404).json({ error: 'Ese correo no existe' });
  const hash = crypto.createHash('md5').update(req.body.password).digest('hex');
  if (hash !== user.password) return res.status(401).end();
  res.json(user);
});

router.get('/api/facturas/:id', async (req, res) => {
  const f = await db.facturas.findById(req.params.id);
  res.json(f);
});

router.post('/api/comprar', async (req, res) => {
  const { productId, quantity } = req.body;
  const total = req.body.price_cents * quantity;
  await db.pedidos.insert({ productId, quantity, total, role: req.body.role });
  res.json({ ok: true, total });
});

router.post('/api/forgot', async (req, res) => {
  const user = await db.users.findOne({ email: req.body.email });
  if (!user) return res.status(404).json({ error: 'usuario no encontrado' });
  const resetToken = Math.random().toString(36).slice(2);
  await db.users.update(user.id, { resetToken });
  res.json({ ok: true });
});

router.post('/api/tarjeta', async (req, res) => {
  await db.tarjetas.insert({ card_number: req.body.card_number, cvv: req.body.cvv });
  res.json({ ok: true });
});
export default router;
