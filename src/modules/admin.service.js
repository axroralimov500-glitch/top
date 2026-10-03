import { notFound, conflict, badRequest } from '../lib/errors.js';
import { tx } from '../db/connection.js';
import { nowIso } from '../lib/time.js';
import { slugify } from '../lib/slug.js';

// 6000 -> "6 000" (o'zbekcha ajratgich bilan, frontend matnlarida ishlatiladi)
const fmtMoney = (n) => String(Number(n) || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

// ---------- Kategoriyalar ----------

export function adminCreateCategory(db, { name, slug }) {
  const finalSlug = slug ? slugify(slug) : slugify(name);
  if (!finalSlug) throw badRequest('slug hosil qilinmadi — name yoki slug kiriting');
  const dup = db.prepare('SELECT 1 FROM categories WHERE slug = ?').get(finalSlug);
  if (dup) throw conflict('SLUG_TAKEN', 'Bu slug band');
  const info = db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)').run(name, finalSlug);
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(Number(info.lastInsertRowid));
}

export function adminUpdateCategory(db, id, fields) {
  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  if (!cat) throw notFound('Kategoriya topilmadi');
  const name = fields.name ?? cat.name;
  const slug = fields.slug ? slugify(fields.slug) : cat.slug;
  db.prepare('UPDATE categories SET name = ?, slug = ? WHERE id = ?').run(name, slug, id);
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
}

// ---------- Mahsulotlar ----------

export function adminCreateProduct(db, body) {
  return tx(db, () => {
    const categoryId = Number(body.category_id);
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);
    if (!cat) throw notFound('Kategoriya topilmadi');

    const slug = body.slug ? slugify(body.slug) : slugify(body.name);
    if (!slug) throw badRequest('slug hosil qilinmadi');
    const dup = db.prepare('SELECT 1 FROM products WHERE slug = ?').get(slug);
    if (dup) throw conflict('SLUG_TAKEN', 'Bu slug band');

    const maxQty = body.max_purchase_qty === undefined ? 10 : Number(body.max_purchase_qty);
    if (!Number.isInteger(maxQty) || maxQty < 1) throw badRequest('max_purchase_qty musbat butun son bo‘lishi kerak');

    const info = db
      .prepare('INSERT INTO products (category_id, name, slug, description, max_purchase_qty, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(categoryId, body.name, slug, body.description ?? '', maxQty, nowIso());
    const productId = Number(info.lastInsertRowid);

    for (const v of body.variants ?? []) {
      createVariantInternal(db, productId, v);
    }
    return db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  });
}

export function adminUpdateProduct(db, id, fields) {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!product) throw notFound('Mahsulot topilmadi');

  if (fields.max_purchase_qty !== undefined) {
    const maxQty = Number(fields.max_purchase_qty);
    if (!Number.isInteger(maxQty) || maxQty < 1) throw badRequest('max_purchase_qty musbat butun son bo‘lishi kerak');
  }
  db.prepare(`
    UPDATE products SET
      name = ?, description = ?, is_active = ?, max_purchase_qty = ?,
      category_id = COALESCE(?, category_id)
    WHERE id = ?
  `).run(
    fields.name ?? product.name,
    fields.description ?? product.description,
    fields.is_active === undefined ? product.is_active : (fields.is_active ? 1 : 0),
    fields.max_purchase_qty === undefined ? product.max_purchase_qty : Number(fields.max_purchase_qty),
    fields.category_id ?? null,
    id
  );
  return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
}

// ---------- Variantlar ----------

function createVariantInternal(db, productId, { sku, name, price, stock = 0, warehouse_id }) {
  const dup = db.prepare('SELECT 1 FROM product_variants WHERE sku = ?').get(sku);
  if (dup) throw conflict('SKU_TAKEN', 'Bu SKU band');
  const priceInt = Number(price);
  if (!Number.isInteger(priceInt) || priceInt < 0) throw badRequest('price manfiy bo‘lmagan butun son bo‘lishi kerak');

  const info = db
    .prepare('INSERT INTO product_variants (product_id, sku, name, price) VALUES (?, ?, ?, ?)')
    .run(productId, sku, name, priceInt);
  const variantId = Number(info.lastInsertRowid);

  if (warehouse_id !== undefined || stock > 0) {
    const whId = warehouse_id !== undefined ? Number(warehouse_id) : defaultWarehouseId(db);
    setInventoryQuantity(db, variantId, whId, Number(stock));
  }
  return variantId;
}

function defaultWarehouseId(db) {
  const wh = db.prepare('SELECT id FROM warehouses ORDER BY id LIMIT 1').get();
  if (!wh) throw notFound('Ombor topilmadi — avval ombor yarating');
  return wh.id;
}

export function adminCreateVariant(db, productId, body) {
  return tx(db, () => {
    const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
    if (!product) throw notFound('Mahsulot topilmadi');
    const variantId = createVariantInternal(db, productId, body);
    return db.prepare('SELECT * FROM product_variants WHERE id = ?').get(variantId);
  });
}

export function adminUpdateVariant(db, id, fields) {
  const v = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(id);
  if (!v) throw notFound('Variant topilmadi');
  if (fields.price !== undefined) {
    const priceInt = Number(fields.price);
    if (!Number.isInteger(priceInt) || priceInt < 0) throw badRequest('price manfiy bo‘lmagan butun son bo‘lishi kerak');
  }
  db.prepare('UPDATE product_variants SET name = ?, price = ?, is_active = ? WHERE id = ?').run(
    fields.name ?? v.name,
    fields.price === undefined ? v.price : Number(fields.price),
    fields.is_active === undefined ? v.is_active : (fields.is_active ? 1 : 0),
    id
  );
  return db.prepare('SELECT * FROM product_variants WHERE id = ?').get(id);
}

// ---------- Omborlar va qoldiq ----------

export function adminCreateWarehouse(db, { code, name }) {
  const finalCode = slugify(code).toUpperCase();
  const dup = db.prepare('SELECT 1 FROM warehouses WHERE code = ?').get(finalCode);
  if (dup) throw conflict('CODE_TAKEN', 'Bu ombor kodi band');
  const info = db.prepare('INSERT INTO warehouses (code, name) VALUES (?, ?)').run(finalCode, name);
  return db.prepare('SELECT * FROM warehouses WHERE id = ?').get(Number(info.lastInsertRowid));
}

export function listWarehouses(db) {
  return db.prepare('SELECT * FROM warehouses ORDER BY id').all();
}

export function listVariants(db) {
  return db
    .prepare(`
      SELECT v.id, v.sku, v.name AS variant_name, v.price,
             p.id AS product_id, p.name AS product_name, p.max_purchase_qty,
             COALESCE((SELECT SUM(i.quantity - i.reserved) FROM inventory i WHERE i.variant_id = v.id), 0) AS available,
             COALESCE((SELECT SUM(i.quantity) FROM inventory i WHERE i.variant_id = v.id), 0) AS on_hand
      FROM product_variants v
      JOIN products p ON p.id = v.product_id
      WHERE v.is_active = 1 AND p.is_active = 1
      ORDER BY p.name, v.id
    `)
    .all();
}

export function listInventory(db, { variant_id }) {
  const sql = `
    SELECT i.id, i.variant_id, i.warehouse_id, i.quantity, i.reserved,
           i.quantity - i.reserved AS available,
           v.sku, v.name AS variant_name, v.price,
           w.code AS warehouse_code, w.name AS warehouse_name
    FROM inventory i
    JOIN product_variants v ON v.id = i.variant_id
    JOIN warehouses w ON w.id = i.warehouse_id
    ${variant_id ? 'WHERE i.variant_id = ?' : ''}
    ORDER BY i.variant_id, i.warehouse_id`;
  return variant_id ? db.prepare(sql).all(variant_id) : db.prepare(sql).all();
}

function getInventoryRow(db, variantId, warehouseId) {
  return db
    .prepare('SELECT * FROM inventory WHERE variant_id = ? AND warehouse_id = ?')
    .get(variantId, warehouseId);
}

function setInventoryQuantity(db, variantId, warehouseId, quantity) {
  if (!Number.isInteger(quantity) || quantity < 0) throw badRequest('quantity manfiy bo‘lmagan butun son bo‘lishi kerak');
  const existing = getInventoryRow(db, variantId, warehouseId);
  if (existing) {
    if (quantity < existing.reserved) {
      throw conflict('BELOW_RESERVED', `Qoldiq rezervdan kichik bo'lolmaydi (rezerv: ${existing.reserved})`);
    }
    db.prepare('UPDATE inventory SET quantity = ? WHERE id = ?').run(quantity, existing.id);
    return existing.id;
  }
  const wh = db.prepare('SELECT id FROM warehouses WHERE id = ?').get(warehouseId);
  if (!wh) throw notFound('Ombor topilmadi');
  const v = db.prepare('SELECT id FROM product_variants WHERE id = ?').get(variantId);
  if (!v) throw notFound('Variant topilmadi');
  const info = db
    .prepare('INSERT INTO inventory (variant_id, warehouse_id, quantity, reserved) VALUES (?, ?, ?, 0)')
    .run(variantId, warehouseId, quantity);
  return Number(info.lastInsertRowid);
}

export function adminAdjustInventory(db, { variant_id, warehouse_id, delta, set }) {
  return tx(db, () => {
    if (set !== undefined) {
      setInventoryQuantity(db, Number(variant_id), Number(warehouse_id), Number(set));
    } else {
      const d = Number(delta);
      if (!Number.isInteger(d) || d === 0) throw badRequest('delta nolga teng bo‘lmagan butun son bo‘lishi kerak');
      const row = getInventoryRow(db, Number(variant_id), Number(warehouse_id));
      if (!row) throw notFound('Qoldiq yozuvi topilmadi');
      setInventoryQuantity(db, Number(variant_id), Number(warehouse_id), row.quantity + d);
    }
    return db
      .prepare('SELECT * FROM inventory WHERE variant_id = ? AND warehouse_id = ?')
      .get(Number(variant_id), Number(warehouse_id));
  });
}

// ---------- Kirim (qabul) va qayta-narxlash ----------
//
// Kirim omborga yangi partiya qo'shadi VA variant narxini yangi narxga
// o'tkazadi. Variant narxi yagona bo'lgani uchun bu ESKI qoldiqqa ham
// qo'llanadi — masalan 5 000 kelgan 200 dona ham 6 000 bo'lib qoladi.
// Hammasi bitta tranzaksiyada (qoldiq + narx + tarix yozuvi).
export function adminStockReceipt(db, { variant_id, warehouse_id, qty, unit_price, note }) {
  return tx(db, () => {
    const vId = Number(variant_id);
    const wId = Number(warehouse_id);
    const v = db.prepare('SELECT id, price FROM product_variants WHERE id = ?').get(vId);
    if (!v) throw notFound('Variant topilmadi');
    const wh = db.prepare('SELECT id FROM warehouses WHERE id = ?').get(wId);
    if (!wh) throw notFound('Ombor topilmadi');

    const q = Number(qty);
    const price = Number(unit_price);
    if (!Number.isInteger(q) || q <= 0) throw badRequest('qty musbat butun son bo‘lishi kerak');
    if (!Number.isInteger(price) || price < 0) throw badRequest('unit_price manfiy bo‘lmagan butun son bo‘lishi kerak');

    const oldPrice = v.price;

    const row = getInventoryRow(db, vId, wId);
    if (row) {
      db.prepare('UPDATE inventory SET quantity = quantity + ? WHERE id = ?').run(q, row.id);
    } else {
      db.prepare('INSERT INTO inventory (variant_id, warehouse_id, quantity, reserved) VALUES (?, ?, ?, 0)').run(vId, wId, q);
    }

    // Qayta-narxlash: barcha qoldiq (eski + yangi) endi shu narxda sotiladi.
    db.prepare('UPDATE product_variants SET price = ? WHERE id = ?').run(price, vId);

    const info = db
      .prepare('INSERT INTO stock_receipts (variant_id, warehouse_id, qty, unit_price, old_price, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(vId, wId, q, price, oldPrice, String(note ?? ''), nowIso());

    return {
      receipt: db.prepare('SELECT * FROM stock_receipts WHERE id = ?').get(Number(info.lastInsertRowid)),
      inventory: db.prepare('SELECT * FROM inventory WHERE variant_id = ? AND warehouse_id = ?').get(vId, wId),
      variant: db.prepare('SELECT * FROM product_variants WHERE id = ?').get(vId),
    };
  });
}

// Faqat narxni yangilash (reprice): omborga hech narsa kirmaydi, lekin mavjud
// butun qoldiq (eski partiyalar ham) yangi narxga o'tadi. Tarixga qty = 0,
// warehouse_id = NULL yozuv tushadi — shunda narx tarixi to'liq ko'rinadi.
export function adminReprice(db, { variant_id, unit_price, note }) {
  return tx(db, () => {
    const vId = Number(variant_id);
    const v = db.prepare('SELECT id, price FROM product_variants WHERE id = ?').get(vId);
    if (!v) throw notFound('Variant topilmadi');

    const price = Number(unit_price);
    if (!Number.isInteger(price) || price < 0) throw badRequest('unit_price manfiy bo‘lmagan butun son bo‘lishi kerak');
    if (price === v.price) throw badRequest('Yangi narx mavjud narx bilan bir xil');

    db.prepare('UPDATE product_variants SET price = ? WHERE id = ?').run(price, vId);

    const info = db
      .prepare('INSERT INTO stock_receipts (variant_id, warehouse_id, qty, unit_price, old_price, note, created_at) VALUES (?, NULL, 0, ?, ?, ?, ?)')
      .run(vId, price, v.price, String(note ?? ''), nowIso());

    const stock = db
      .prepare('SELECT COALESCE(SUM(quantity),0) AS on_hand, COALESCE(SUM(quantity - reserved),0) AS available FROM inventory WHERE variant_id = ?')
      .get(vId);

    return {
      receipt: db.prepare('SELECT * FROM stock_receipts WHERE id = ?').get(Number(info.lastInsertRowid)),
      variant: db.prepare('SELECT * FROM product_variants WHERE id = ?').get(vId),
      repriced_units: stock.on_hand,
      repriced_available: stock.available,
    };
  });
}

export function listStockReceipts(db, { variant_id, limit = 50 } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const where = variant_id ? 'WHERE r.variant_id = ?' : '';
  const params = variant_id ? [Number(variant_id)] : [];
  return db
    .prepare(`
      SELECT r.*, v.sku, v.name AS variant_name, p.name AS product_name,
             w.code AS warehouse_code,
             CASE WHEN r.qty = 0 THEN 'reprice' ELSE 'receipt' END AS kind
      FROM stock_receipts r
      JOIN product_variants v ON v.id = r.variant_id
      JOIN products p ON p.id = v.product_id
      LEFT JOIN warehouses w ON w.id = r.warehouse_id
      ${where}
      ORDER BY r.id DESC
      LIMIT ?
    `)
    .all(...params, lim);
}

// ---------- Dashboard statistika ----------
export function dashboardStats(db, actorUserId) {
  const kpi = {
    revenue: db.prepare("SELECT COALESCE(SUM(total),0) AS s FROM orders WHERE status='paid'").get().s,
    orders: db.prepare('SELECT COUNT(*) AS c FROM orders').get().c,
    pending: db.prepare("SELECT COUNT(*) AS c FROM orders WHERE status='pending_payment'").get().c,
    customers: db.prepare("SELECT COUNT(*) AS c FROM users WHERE role='customer'").get().c,
    products: db.prepare('SELECT COUNT(*) AS c FROM products WHERE is_active=1').get().c,
    stockUnits: db.prepare('SELECT COALESCE(SUM(quantity - reserved),0) AS s FROM inventory').get().s,
    stockValue: db
      .prepare('SELECT COALESCE(SUM((i.quantity - i.reserved) * v.price),0) AS s FROM inventory i JOIN product_variants v ON v.id = i.variant_id')
      .get().s,
  };

  const salesByCategory = db
    .prepare(`
      SELECT c.name AS name, COALESCE(SUM(oi.line_total),0) AS total, COUNT(DISTINCT o.id) AS orders
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id AND o.status = 'paid'
      JOIN product_variants v ON v.id = oi.variant_id
      JOIN products p ON p.id = v.product_id
      JOIN categories c ON c.id = p.category_id
      GROUP BY c.id ORDER BY total DESC
    `)
    .all();

  const ordersByStatus = db
    .prepare('SELECT status, COUNT(*) AS count, COALESCE(SUM(total),0) AS total FROM orders GROUP BY status')
    .all();

  const topProducts = db
    .prepare(`
      SELECT oi.product_name AS name, SUM(oi.qty) AS qty, SUM(oi.line_total) AS revenue
      FROM order_items oi JOIN orders o ON o.id = oi.order_id AND o.status = 'paid'
      GROUP BY oi.product_name ORDER BY revenue DESC LIMIT 6
    `)
    .all();

  const lowStock = db
    .prepare(`
      SELECT p.name AS product_name, v.name AS variant_name, v.sku,
             COALESCE(SUM(i.quantity - i.reserved),0) AS available
      FROM product_variants v
      JOIN products p ON p.id = v.product_id
      LEFT JOIN inventory i ON i.variant_id = v.id
      WHERE v.is_active = 1 AND p.is_active = 1
      GROUP BY v.id HAVING available <= 3 ORDER BY available ASC LIMIT 8
    `)
    .all();

  const priceChanges = db
    .prepare(`
      SELECT r.id, r.old_price, r.unit_price, r.qty, r.created_at,
             CASE WHEN r.qty = 0 THEN 'reprice' ELSE 'receipt' END AS kind,
             p.name AS product_name, v.name AS variant_name
      FROM stock_receipts r
      JOIN product_variants v ON v.id = r.variant_id
      JOIN products p ON p.id = v.product_id
      WHERE r.old_price <> r.unit_price
      ORDER BY r.id DESC LIMIT 8
    `)
    .all();

  const revenueByMonth = db
    .prepare(`
      SELECT substr(created_at,1,7) AS ym, SUM(total) AS total, COUNT(*) AS orders
      FROM orders WHERE status='paid'
      GROUP BY ym ORDER BY ym ASC LIMIT 12
    `)
    .all();

  // Oxirgi 7 kun — bo'sq kunlar ham 0 bilan ko'rsatiladi (ustunlar tekis chiqsin).
  const dayRows = db
    .prepare(`
      SELECT substr(paid_at,1,10) AS d, COUNT(*) AS orders, COALESCE(SUM(total),0) AS total
      FROM orders WHERE status='paid' AND paid_at IS NOT NULL
      GROUP BY d
    `)
    .all();
  const byDay = new Map(dayRows.map((r) => [r.d, r]));
  const daySeries = (offset) => {
    const out = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(Date.now() - (i + offset) * 86400000).toISOString().slice(0, 10);
      const row = byDay.get(d);
      out.push({ day: d, orders: row?.orders ?? 0, total: row?.total ?? 0 });
    }
    return out;
  };
  const revenueByDay = daySeries(0);
  const revenueByDayPrev = daySeries(7);

  const today = nowIso().slice(0, 10);
  const todayRow = db
    .prepare("SELECT COUNT(*) AS orders, COALESCE(SUM(total),0) AS total FROM orders WHERE status='paid' AND substr(paid_at,1,10)=?")
    .get(today);
  const yesterdayTotal = revenueByDay[6]?.day === today ? revenueByDay[5]?.total ?? 0 : revenueByDay[6]?.total ?? 0;

  return {
    kpi,
    salesByCategory,
    ordersByStatus,
    topProducts,
    lowStock,
    priceChanges,
    revenueByMonth,
    revenueByDay,
    revenueByDayPrev,
    today: { orders: todayRow.orders, total: todayRow.total, prev_total: yesterdayTotal },
    activity: shopActivity(db),
    lastLogin: actorUserId
      ? db.prepare('SELECT last_login_at FROM users WHERE id = ?').get(actorUserId)?.last_login_at ?? null
      : null,
  };
}

// Do'konda nima bo'layotgani — buyurtma, to'lov, bekor qilish, kirim, yangi mijoz.
function shopActivity(db) {
  const orders = db
    .prepare(`
      SELECT o.id, o.status, o.total, o.created_at, u.name AS customer
      FROM orders o JOIN users u ON u.id = o.user_id
      ORDER BY o.id DESC LIMIT 15
    `)
    .all()
    .map((o) => ({
      kind: 'order',
      ref: `#${o.id}`,
      title: `${o.customer} buyurtma berdi`,
      amount: o.total,
      at: o.created_at,
    }));

  const payments = db
    .prepare(`
      SELECT p.status, p.amount, p.created_at, p.order_id, u.name AS customer
      FROM payments p JOIN orders o ON o.id = p.order_id JOIN users u ON u.id = o.user_id
      ORDER BY p.id DESC LIMIT 15
    `)
    .all()
    .map((p) => ({
      kind: p.status === 'succeeded' ? 'paid' : 'payment_failed',
      ref: `#${p.order_id}`,
      title: p.status === 'succeeded' ? `${p.customer} to'lovi qabul qilindi` : `${p.customer} to'lovi rad etildi`,
      amount: p.amount,
      at: p.created_at,
    }));

  const closed = db
    .prepare(`
      SELECT id, status, cancelled_at AS at, total FROM orders WHERE status='cancelled' AND cancelled_at IS NOT NULL
      UNION ALL
      SELECT id, status, expired_at AS at, total FROM orders WHERE status='expired' AND expired_at IS NOT NULL
      ORDER BY at DESC LIMIT 10
    `)
    .all()
    .map((o) => ({
      kind: o.status,
      ref: `#${o.id}`,
      title: o.status === 'cancelled' ? `Buyurtma ${o.id} bekor qilindi` : `Buyurtma ${o.id} muddati tugadi`,
      amount: o.total,
      at: o.at,
    }));

  const receipts = db
    .prepare(`
      SELECT r.id, r.qty, r.unit_price, r.old_price, r.created_at, p.name AS product_name, w.code AS warehouse_code
      FROM stock_receipts r
      JOIN product_variants v ON v.id = r.variant_id
      JOIN products p ON p.id = v.product_id
      LEFT JOIN warehouses w ON w.id = r.warehouse_id
      ORDER BY r.id DESC LIMIT 15
    `)
    .all()
    .map((r) => ({
      kind: r.qty === 0 ? 'reprice' : 'receipt',
      ref: `#${r.id}`,
      title:
        r.qty === 0
          ? `${r.product_name}: narx ${fmtMoney(r.old_price)} → ${fmtMoney(r.unit_price)} (faqat narx)`
          : `${r.product_name}: +${r.qty} dona ${r.warehouse_code}${r.old_price !== r.unit_price ? ` · narx ${fmtMoney(r.old_price)} → ${fmtMoney(r.unit_price)}` : ''}`,
      amount: r.qty === 0 ? null : r.qty * r.unit_price,
      at: r.created_at,
    }));

  const customers = db
    .prepare("SELECT id, name, created_at FROM users WHERE role='customer' ORDER BY id DESC LIMIT 10")
    .all()
    .map((u) => ({ kind: 'customer', ref: `#${u.id}`, title: `Yangi mijoz: ${u.name}`, amount: null, at: u.created_at }));

  return [...orders, ...payments, ...closed, ...receipts, ...customers]
    .filter((e) => e.at)
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, 14);
}
