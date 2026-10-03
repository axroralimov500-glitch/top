import { badRequest, notFound, conflict, invalidEntity } from '../lib/errors.js';
import { tx } from '../db/connection.js';
import { nowIso, isoAfterSeconds } from '../lib/time.js';
import { config } from '../config.js';
import { emptyCartForOrder, clearCartItems } from './cart.service.js';

export const ORDER_STATUSES = ['pending_payment', 'paid', 'cancelled', 'expired'];

// ---------- Yordamchi so'rovlar ----------

function availableInWarehouse(db, inventoryId) {
  return db
    .prepare('SELECT quantity - reserved AS avail FROM inventory WHERE id = ?')
    .get(inventoryId).avail;
}

function warehouseRowsForVariant(db, variantId) {
  return db
    .prepare(`
      SELECT id, warehouse_id, quantity - reserved AS avail
      FROM inventory
      WHERE variant_id = ? AND quantity - reserved > 0
      ORDER BY (quantity - reserved) DESC, id
    `)
    .all(variantId);
}

// Qoldiqni bir nechta ombordan ixtiyoriy (greedy) ajratadi.
// Faqat tranzaksiya ICHIDA chaqirilishi kerak.
function allocateReservation(db, orderId, variantId, qty) {
  for (const row of warehouseRowsForVariant(db, variantId)) {
    if (qty <= 0) break;
    const take = Math.min(row.avail, qty);
    if (take <= 0) continue;
    db.prepare(
      'INSERT INTO reservations (order_id, variant_id, warehouse_id, qty, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(orderId, variantId, row.warehouse_id, take, nowIso());
    db.prepare('UPDATE inventory SET reserved = reserved + ? WHERE id = ?').run(take, row.id);
    qty -= take;
  }
  if (qty > 0) {
    throw conflict('INSUFFICIENT_STOCK', 'Omborda yetarli qoldiq yo‘q', { variant_id: variantId });
  }
}

// Rezervlarni qaytaradi (bekor yoki muddat tugaganda). Tranzaksiya ichida.
function releaseReservations(db, orderId) {
  const rows = db
    .prepare('SELECT id, variant_id, warehouse_id, qty FROM reservations WHERE order_id = ? AND released_at IS NULL')
    .all(orderId);
  for (const r of rows) {
    db.prepare('UPDATE inventory SET reserved = reserved - ? WHERE variant_id = ? AND warehouse_id = ?')
      .run(r.qty, r.variant_id, r.warehouse_id);
    db.prepare('UPDATE reservations SET released_at = ? WHERE id = ?').run(nowIso(), r.id);
  }
  return rows.length;
}

// To'lov tugagach qoldiqni ombordan yechadi. Tranzaksiya ichida.
export function consumeReservations(db, orderId) {
  const rows = db
    .prepare('SELECT id, variant_id, warehouse_id, qty FROM reservations WHERE order_id = ? AND released_at IS NULL AND consumed_at IS NULL')
    .all(orderId);
  for (const r of rows) {
    db.prepare('UPDATE inventory SET quantity = quantity - ?, reserved = reserved - ? WHERE variant_id = ? AND warehouse_id = ?')
      .run(r.qty, r.qty, r.variant_id, r.warehouse_id);
    db.prepare('UPDATE reservations SET consumed_at = ? WHERE id = ?').run(nowIso(), r.id);
  }
  return rows.length;
}

// ---------- Buyurtma yaratish ----------

function validateAndPriceItems(db, rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw badRequest('items bo‘sh bo‘lmasligi kerak');

  const perVariant = new Map();
  for (const it of rawItems) {
    const variantId = Number(it?.variant_id);
    const qty = Number(it?.qty);
    if (!Number.isInteger(variantId) || variantId < 1) throw badRequest('variant_id butun son bo‘lishi kerak');
    if (!Number.isInteger(qty) || qty < 1) throw badRequest('qty musbat butun son bo‘lishi kerak');
    perVariant.set(variantId, (perVariant.get(variantId) ?? 0) + qty);
  }

  const lines = [];
  const productQty = new Map();
  for (const [variantId, qty] of perVariant) {
    const v = db
      .prepare(`
        SELECT v.id, v.sku, v.name AS variant_name, v.price, v.is_active AS variant_active,
               p.id AS product_id, p.name AS product_name, p.is_active AS product_active, p.max_purchase_qty
        FROM product_variants v JOIN products p ON p.id = v.product_id
        WHERE v.id = ?
      `)
      .get(variantId);
    if (!v) throw notFound(`Variant topilmadi: ${variantId}`);
    if (!v.product_active || !v.variant_active) {
      throw conflict('VARIANT_UNAVAILABLE', `Sotuvda emas: ${v.product_name} (${v.variant_name})`);
    }
    productQty.set(v.product_id, (productQty.get(v.product_id) ?? 0) + qty);
    lines.push({ variant: v, qty });
  }

  for (const line of lines) {
    const totalQty = productQty.get(line.variant.product_id);
    if (totalQty > line.variant.max_purchase_qty) {
      throw invalidEntity('MAX_PURCHASE_QTY',
        `${line.variant.product_name}: ko'pi bilan ${line.variant.max_purchase_qty} dona sotib olish mumkin`,
        { product_id: line.variant.product_id, max_purchase_qty: line.variant.max_purchase_qty });
    }
  }
  return lines;
}

// Buyurtma bitta tranzaksiyada yaratiladi: narx nusxasi + qoldiq rezervi.
// items berilsa — to'g'ridan-to'g'ri xarid, aks holda savatdan.
export function createOrder(db, userId, { items, address = '' }) {
  return tx(db, () => {
    let lines;
    let cartId = null;
    if (items !== undefined) {
      lines = validateAndPriceItems(db, items);
    } else {
      const cartItems = emptyCartForOrder(db, userId);
      if (cartItems.length === 0) throw badRequest('Savat bo‘sh');
      cartId = db.prepare('SELECT id FROM carts WHERE user_id = ?').get(userId).id;
      lines = validateAndPriceItems(db, cartItems.map((ci) => ({ variant_id: ci.variant_id, qty: ci.qty })));
    }

    // Qoldiqni oldindan tekshirish (aniq xabar uchun) — asosiy himoya tranzaksiyada.
    for (const line of lines) {
      const available = db
        .prepare('SELECT COALESCE(SUM(quantity - reserved), 0) AS a FROM inventory WHERE variant_id = ?')
        .get(line.variant.id).a;
      if (line.qty > available) {
        throw conflict('INSUFFICIENT_STOCK', `Qoldiq yetarli emas: ${line.variant.product_name} (${line.variant.variant_name})`, {
          variant_id: line.variant.id,
          requested: line.qty,
          available,
        });
      }
    }

    // Narx nusxasi: unit_price buyurtma paytidagi narx bilan muzlatiladi.
    const total = lines.reduce((s, l) => s + l.variant.price * l.qty, 0);
    const orderInfo = db
      .prepare(`
        INSERT INTO orders (user_id, status, total, currency, address, expires_at, created_at)
        VALUES (?, 'pending_payment', ?, 'UZS', ?, ?, ?)
      `)
      .run(userId, total, String(address ?? ''), isoAfterSeconds(config.reservationTtlSec), nowIso());
    const orderId = Number(orderInfo.lastInsertRowid);

    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, variant_id, product_name, variant_name, sku, unit_price, qty, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const line of lines) {
      const { variant: v, qty } = line;
      insertItem.run(orderId, v.id, v.product_name, v.variant_name, v.sku, v.price, qty, v.price * qty);
      allocateReservation(db, orderId, v.id, qty);
    }

    if (cartId !== null) clearCartItems(db, cartId);

    return getOrder(db, userId, orderId, { forAdmin: false, skipSweep: true });
  });
}

// ---------- Ko'rish ----------

export function getOrder(db, userId, orderId, { forAdmin = false, skipSweep = false } = {}) {
  if (!skipSweep) sweepExpiredOrders(db);
  const order = db
    .prepare(`
      SELECT o.*, u.email AS user_email, u.name AS user_name
      FROM orders o JOIN users u ON u.id = o.user_id
      WHERE o.id = ?
    `)
    .get(orderId);
  if (!order || (!forAdmin && order.user_id !== userId)) throw notFound('Buyurtma topilmadi');

  order.items = db
    .prepare('SELECT id, variant_id, product_name, variant_name, sku, unit_price, qty, line_total FROM order_items WHERE order_id = ? ORDER BY id')
    .all(orderId);
  return order;
}

export function listOrders(db, userId, { page = 1, limit = 10, status, forAdmin = false }) {
  sweepExpiredOrders(db);
  const where = forAdmin ? [] : ['o.user_id = ?'];
  const params = forAdmin ? [] : [userId];
  if (status) {
    where.push('o.status = ?');
    params.push(status);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM orders o ${whereSql}`).get(...params);
  const rows = db
    .prepare(`
      SELECT o.id, o.user_id, o.status, o.total, o.currency, o.expires_at, o.created_at,
             (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
      FROM orders o ${whereSql}
      ORDER BY o.id DESC
      LIMIT ? OFFSET ?
    `)
    .all(...params, limit, (page - 1) * limit);
  return { items: rows, meta: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) } };
}

// ---------- Muddati tugagan rezervlar ----------

// pending_payment buyurtmalar rezervini qaytaradi. O'z tx ichida ishlaydi.
export function sweepExpiredOrders(db) {
  return tx(db, () => {
    const expired = db
      .prepare("SELECT id FROM orders WHERE status = 'pending_payment' AND expires_at IS NOT NULL AND expires_at <= ?")
      .all(nowIso());
    for (const o of expired) {
      releaseReservations(db, o.id);
      db.prepare("UPDATE orders SET status = 'expired', expired_at = ? WHERE id = ?").run(nowIso(), o.id);
    }
    return expired.length;
  });
}

// ---------- Bekor qilish (faqat bir marta) ----------

export function cancelOrder(db, userId, orderId, { forAdmin = false } = {}) {
  return tx(db, () => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order || (!forAdmin && order.user_id !== userId)) throw notFound('Buyurtma topilmadi');

    if (order.status !== 'pending_payment') {
      throw conflict('ORDER_NOT_CANCELLABLE', `Buyurtma bekor qilinmaydi, holat: ${order.status}`, {
        status: order.status,
        // "Faqat bir marta bekor qilish": cancelled/expired/paid — yakuniy holatlar.
      });
    }

    releaseReservations(db, orderId);
    db.prepare("UPDATE orders SET status = 'cancelled', cancelled_at = ? WHERE id = ?").run(nowIso(), orderId);
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  });
}
