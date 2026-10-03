import { Router } from 'express';
import { requireAdmin } from '../auth/middleware.js';
import { asInt, oneOf, asString, requireFields } from '../lib/validate.js';
import { listOrders } from './orders.service.js';
import {
  adminCreateCategory, adminUpdateCategory,
  adminCreateProduct, adminUpdateProduct,
  adminCreateVariant, adminUpdateVariant,
  adminCreateWarehouse, listWarehouses,
  listInventory, adminAdjustInventory,
  adminStockReceipt, adminReprice, listStockReceipts, dashboardStats, listVariants,
} from './admin.service.js';
import { getProductBySlugOrId } from './catalog.service.js';

export function adminRoutes(db) {
  const router = Router();

  router.use('/admin', requireAdmin);

  // Kategoriyalar
  router.post('/admin/categories', (req, res) => {
    requireFields(req.body, ['name']);
    res.status(201).json({ data: adminCreateCategory(db, req.body) });
  });

  router.patch('/admin/categories/:id', (req, res) => {
    const id = asInt(req.params.id, 'id', { min: 1 });
    res.json({ data: adminUpdateCategory(db, id, req.body) });
  });

  // Mahsulotlar
  router.post('/admin/products', (req, res) => {
    requireFields(req.body, ['category_id', 'name']);
    res.status(201).json({ data: adminCreateProduct(db, req.body) });
  });

  router.get('/admin/products/:id', (req, res) => {
    res.json({ data: getProductBySlugOrId(db, req.params.id) });
  });

  router.patch('/admin/products/:id', (req, res) => {
    const id = asInt(req.params.id, 'id', { min: 1 });
    res.json({ data: adminUpdateProduct(db, id, req.body) });
  });

  // Variantlar
  router.post('/admin/products/:id/variants', (req, res) => {
    const id = asInt(req.params.id, 'id', { min: 1 });
    requireFields(req.body, ['sku', 'name', 'price']);
    res.status(201).json({ data: adminCreateVariant(db, id, req.body) });
  });

  router.patch('/admin/variants/:id', (req, res) => {
    const id = asInt(req.params.id, 'id', { min: 1 });
    res.json({ data: adminUpdateVariant(db, id, req.body) });
  });

  // Omborlar va qoldiq
  router.get('/admin/warehouses', (req, res) => {
    res.json({ data: listWarehouses(db) });
  });

  router.get('/admin/variants', (req, res) => {
    res.json({ data: listVariants(db) });
  });

  router.post('/admin/warehouses', (req, res) => {
    requireFields(req.body, ['code', 'name']);
    res.status(201).json({ data: adminCreateWarehouse(db, req.body) });
  });

  router.get('/admin/inventory', (req, res) => {
    const variantId = req.query.variant_id ? asInt(req.query.variant_id, 'variant_id', { min: 1 }) : undefined;
    res.json({ data: listInventory(db, { variant_id: variantId }) });
  });

  router.post('/admin/inventory', (req, res) => {
    requireFields(req.body, ['variant_id', 'warehouse_id']);
    if (req.body.set === undefined) requireFields(req.body, ['delta']);
    res.json({ data: adminAdjustInventory(db, req.body) });
  });

  // Kirim (qabul) — qoldiqni oshiradi va narxni barcha qoldiqqa qayta-narxlaydi
  router.post('/admin/receipts', (req, res) => {
    requireFields(req.body, ['variant_id', 'warehouse_id', 'qty', 'unit_price']);
    res.status(201).json({ data: adminStockReceipt(db, req.body) });
  });

  // Faqat narxni yangilash — partiya kelmaydi, mavjud qoldiq yangi narxga o'tadi
  router.post('/admin/reprice', (req, res) => {
    requireFields(req.body, ['variant_id', 'unit_price']);
    res.status(201).json({ data: adminReprice(db, req.body) });
  });

  router.get('/admin/receipts', (req, res) => {
    const variantId = req.query.variant_id ? asInt(req.query.variant_id, 'variant_id', { min: 1 }) : undefined;
    res.json({ data: listStockReceipts(db, { variant_id: variantId }) });
  });

  // Dashboard statistika
  router.get('/admin/stats', (req, res) => {
    res.json({ data: dashboardStats(db, req.user.id) });
  });

  // Buyurtmalar (barcha mijozlar)
  router.get('/admin/orders', (req, res) => {
    const page = asInt(req.query.page, 'page', { min: 1, optional: true, def: 1 });
    const limit = asInt(req.query.limit, 'limit', { min: 1, max: 50, optional: true, def: 10 });
    const status = req.query.status
      ? oneOf(req.query.status, 'status', ['pending_payment', 'paid', 'cancelled', 'expired'])
      : undefined;
    const { items, meta } = listOrders(db, null, { page, limit, status, forAdmin: true });
    res.json({ data: items, meta });
  });

  return router;
}
