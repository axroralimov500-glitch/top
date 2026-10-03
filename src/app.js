import express from 'express';
import { fileURLToPath } from 'node:url';
import { AppError } from './lib/errors.js';
import { attachUser } from './auth/middleware.js';
import { authRoutes } from './modules/auth.routes.js';
import { catalogRoutes } from './modules/catalog.routes.js';
import { cartRoutes } from './modules/cart.routes.js';
import { ordersRoutes } from './modules/orders.routes.js';
import { paymentsRoutes } from './modules/payments.routes.js';
import { adminRoutes } from './modules/admin.routes.js';

export function buildApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use((req, res, next) => {
    req.body ??= {};
    next();
  });

  app.get('/api/health', (req, res) => {
    res.json({ data: { status: 'ok', time: new Date().toISOString() } });
  });

  app.use(attachUser(db));
  app.use('/api/auth', authRoutes(db));
  app.use('/api', catalogRoutes(db));
  app.use('/api', cartRoutes(db));
  app.use('/api', ordersRoutes(db));
  app.use('/api', paymentsRoutes(db));
  app.use('/api', adminRoutes(db));

  // Web sayt (statik fayllar) — API marshrutlaridan KEYIN ulashiladi,
  // shuning uchun /api/* hamma vaqtda birinchi ishlaydi.
  const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
  app.use(express.static(publicDir));

  app.use((req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: `Marshrut topilmadi: ${req.method} ${req.path}` } });
  });

  app.use((err, req, res, next) => {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'BAD_JSON', message: 'JSON tanasi noto‘g‘ri' } });
    }
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Ichki server xatosi' } });
  });

  return app;
}
