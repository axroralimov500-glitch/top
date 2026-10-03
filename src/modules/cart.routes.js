import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { asInt } from '../lib/validate.js';
import { getCart, addCartItem, updateCartItem, removeCartItem, clearCart } from './cart.service.js';

export function cartRoutes(db) {
  const router = Router();

  router.use('/cart', requireAuth);

  router.get('/cart', (req, res) => {
    res.json({ data: getCart(db, req.user.id) });
  });

  router.post('/cart/items', (req, res) => {
    const variant_id = asInt(req.body.variant_id, 'variant_id', { min: 1 });
    const qty = asInt(req.body.qty, 'qty', { min: 1, max: 1000 });
    res.status(201).json({ data: addCartItem(db, req.user.id, { variant_id, qty }) });
  });

  router.patch('/cart/items/:id', (req, res) => {
    const itemId = asInt(req.params.id, 'id', { min: 1 });
    const qty = asInt(req.body.qty, 'qty', { min: 1, max: 1000 });
    res.json({ data: updateCartItem(db, req.user.id, itemId, { qty }) });
  });

  router.delete('/cart/items/:id', (req, res) => {
    const itemId = asInt(req.params.id, 'id', { min: 1 });
    res.json({ data: removeCartItem(db, req.user.id, itemId) });
  });

  router.delete('/cart', (req, res) => {
    res.json({ data: clearCart(db, req.user.id) });
  });

  return router;
}
