import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { asInt, oneOf } from '../lib/validate.js';
import { notFound } from '../lib/errors.js';
import { createOrder, getOrder, listOrders, cancelOrder } from './orders.service.js';

export function ordersRoutes(db) {
  const router = Router();

  router.use('/orders', requireAuth);

  router.post('/orders', (req, res) => {
    const hasItems = req.body.items !== undefined;
    const order = createOrder(db, req.user.id, {
      items: hasItems ? req.body.items : undefined,
      address: typeof req.body.address === 'string' ? req.body.address : '',
    });
    res.status(201).json({ data: order });
  });

  router.get('/orders', (req, res) => {
    const page = asInt(req.query.page, 'page', { min: 1, optional: true, def: 1 });
    const limit = asInt(req.query.limit, 'limit', { min: 1, max: 50, optional: true, def: 10 });
    const status = req.query.status
      ? oneOf(req.query.status, 'status', ['pending_payment', 'paid', 'cancelled', 'expired'])
      : undefined;
    const { items, meta } = listOrders(db, req.user.id, { page, limit, status });
    res.json({ data: items, meta });
  });

  router.get('/orders/:id', (req, res) => {
    const id = asInt(req.params.id, 'id', { min: 1 });
    res.json({ data: getOrder(db, req.user.id, id, { forAdmin: req.user.role === 'admin' }) });
  });

  router.post('/orders/:id/cancel', (req, res) => {
    const id = asInt(req.params.id, 'id', { min: 1 });
    const order = cancelOrder(db, req.user.id, id, { forAdmin: req.user.role === 'admin' });
    res.json({ data: order });
  });

  // Buyurtma holati faqat biznes-operatsiyalar orqali o'zgaradi:
  // to'lov callback, bekor qilish, muddat tugashi.
  // Bekor qilingan/yopilgan buyurtmani API orqali qayta ochish yo'q.
  router.patch('/orders/:id', (req, res) => {
    const id = asInt(req.params.id, 'id', { min: 1 });
    const order = db.prepare('SELECT id, user_id FROM orders WHERE id = ?').get(id);
    if (!order || (req.user.role !== 'admin' && order.user_id !== req.user.id)) {
      throw notFound('Buyurtma topilmadi');
    }
    res.status(409).json({
      error: {
        code: 'ORDER_STATUS_IMMUTABLE',
        message: 'Buyurtma holatini qo‘lda o‘zgartirish (jumladan, qayta ochish) mumkin emas',
      },
    });
  });

  return router;
}
