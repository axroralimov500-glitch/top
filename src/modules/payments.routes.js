import { Router } from 'express';
import { config } from '../config.js';
import { requireAuth } from '../auth/middleware.js';
import { notFound, forbidden } from '../lib/errors.js';
import { asInt } from '../lib/validate.js';
import { processCallback, signCallback, newProviderPaymentId } from './payments.service.js';

// Soxta to'lov provayderi webhook — ochiq marshrut, o'rniga HMAC imzo tekshiriladi.
export function paymentsRoutes(db) {
  const router = Router();

  router.post('/payments/callback', (req, res) => {
    const { http, body } = processCallback(db, config.paymentSecret, req.body);
    res.status(http).json(body);
  });

  // Web sayt uchun qulaylik: mijoz "To'lash" tugmasini bosganda soxta provayder
  // rol'iga tushib, imzoni SERVER tomonida hisoblaymiz va callback yuboramiz.
  // SHART: bu — demo/lokal simulyatsiya. Haqiqiy provayderda imzo mijozga
  // HECH QACHON berilmaydi; bu endpoint faqat buyurtma egaliga (yoki admin) ruxsat beradi.
  router.post('/payments/simulate', requireAuth, (req, res) => {
    const orderId = asInt(req.body.order_id, 'order_id', { min: 1 });
    const status = req.body.status === 'failed' ? 'failed' : 'succeeded';

    const order = db.prepare('SELECT id, user_id, total, status FROM orders WHERE id = ?').get(orderId);
    if (!order) throw notFound('Buyurtma topilmadi');
    if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
      throw forbidden('Bu buyurtma sizga tegishli emas');
    }

    const payload = {
      provider_payment_id: newProviderPaymentId(),
      order_id: order.id,
      amount: order.total,
      status,
    };
    payload.signature = signCallback(config.paymentSecret, payload);

    const { http, body } = processCallback(db, config.paymentSecret, payload);
    res.status(http).json(body);
  });

  return router;
}
