import { notFound, conflict, invalidEntity } from '../lib/errors.js';
import { tx } from '../db/connection.js';
import { nowIso } from '../lib/time.js';

const CART_VIEW_SQL = `
  SELECT ci.id AS cart_item_id,
         ci.qty,
         ci.qty * v.price AS line_total,
         v.id AS variant_id, v.name AS variant_name, v.sku, v.price AS unit_price,
         p.id AS product_id, p.name AS product_name, p.slug AS product_slug, p.max_purchase_qty,
         c.slug AS category_slug,
         COALESCE((SELECT SUM(i.quantity - i.reserved) FROM inventory i WHERE i.variant_id = v.id), 0) AS available_stock
  FROM cart_items ci
  JOIN product_variants v ON v.id = ci.variant_id
  JOIN products p ON p.id = v.product_id
  JOIN categories c ON c.id = p.category_id`;

function getOrCreateCart(db, userId) {
  let cart = db.prepare('SELECT id, user_id FROM carts WHERE user_id = ?').get(userId);
  if (!cart) {
    const info = db.prepare('INSERT INTO carts (user_id, created_at) VALUES (?, ?)').run(userId, nowIso());
    cart = { id: Number(info.lastInsertRowid), user_id: userId };
  }
  return cart;
}

function cartView(db, cartId) {
  const items = db.prepare(`${CART_VIEW_SQL} WHERE ci.cart_id = ? ORDER BY ci.id`).all(cartId);
  return {
    id: cartId,
    items,
    total: items.reduce((s, it) => s + it.line_total, 0),
    currency: 'UZS',
  };
}

export function getCart(db, userId) {
  return cartView(db, getOrCreateCart(db, userId).id);
}

function getActiveVariant(db, variantId) {
  return db
    .prepare(`
      SELECT v.id, v.product_id, v.sku, v.name, v.price,
             p.is_active AS product_active, v.is_active AS variant_active,
             p.max_purchase_qty, p.name AS product_name
      FROM product_variants v JOIN products p ON p.id = v.product_id
      WHERE v.id = ?
    `)
    .get(variantId);
}

function availableForVariant(db, variantId) {
  return db
    .prepare('SELECT COALESCE(SUM(quantity - reserved), 0) AS avail FROM inventory WHERE variant_id = ?')
    .get(variantId).avail;
}

function qtyOfProductInCart(db, cartId, productId) {
  return db
    .prepare(`
      SELECT COALESCE(SUM(ci.qty), 0) AS qty
      FROM cart_items ci JOIN product_variants v ON v.id = ci.variant_id
      WHERE ci.cart_id = ? AND v.product_id = ?
    `)
    .get(cartId, productId).qty;
}

function assertProductLimit(variant, productQtyAfter) {
  if (productQtyAfter > variant.max_purchase_qty) {
    throw invalidEntity('MAX_PURCHASE_QTY', `Bu mahsulotdan ko'pi bilan ${variant.max_purchase_qty} dona sotib olish mumkin`, {
      product_id: variant.product_id,
      max_purchase_qty: variant.max_purchase_qty,
    });
  }
}

function assertStock(db, variantId, finalVariantQty) {
  const available = availableForVariant(db, variantId);
  if (finalVariantQty > available) {
    throw conflict('INSUFFICIENT_STOCK', 'Omborda yetarli qoldiq yo‘q', { variant_id: variantId, available });
  }
}

export function addCartItem(db, userId, { variant_id, qty }) {
  return tx(db, () => {
    const cart = getOrCreateCart(db, userId);
    const variant = getActiveVariant(db, variant_id);
    if (!variant) throw notFound('Variant topilmadi');
    if (!variant.product_active || !variant.variant_active) {
      throw conflict('VARIANT_UNAVAILABLE', 'Mahsulot yoki variant hozir sotuvda emas');
    }

    assertProductLimit(variant, qtyOfProductInCart(db, cart.id, variant.product_id) + qty);

    const sameVariant = db
      .prepare('SELECT id, qty FROM cart_items WHERE cart_id = ? AND variant_id = ?')
      .get(cart.id, variant_id);
    assertStock(db, variant_id, (sameVariant?.qty ?? 0) + qty);

    if (sameVariant) {
      db.prepare('UPDATE cart_items SET qty = qty + ? WHERE id = ?').run(qty, sameVariant.id);
    } else {
      db.prepare('INSERT INTO cart_items (cart_id, variant_id, qty) VALUES (?, ?, ?)').run(cart.id, variant_id, qty);
    }
    return cartView(db, cart.id);
  });
}

export function updateCartItem(db, userId, itemId, { qty }) {
  return tx(db, () => {
    const cart = getOrCreateCart(db, userId);
    const item = db
      .prepare(`
        SELECT ci.id, ci.qty, ci.variant_id, v.product_id FROM cart_items ci
        JOIN product_variants v ON v.id = ci.variant_id
        WHERE ci.id = ? AND ci.cart_id = ?
      `)
      .get(itemId, cart.id);
    if (!item) throw notFound('Savat elementi topilmadi');

    const variant = getActiveVariant(db, item.variant_id);
    if (!variant.product_active || !variant.variant_active) {
      throw conflict('VARIANT_UNAVAILABLE', 'Mahsulot yoki variant hozir sotuvda emas');
    }

    assertProductLimit(variant, qtyOfProductInCart(db, cart.id, item.product_id) - item.qty + qty);
    assertStock(db, item.variant_id, qty);

    db.prepare('UPDATE cart_items SET qty = ? WHERE id = ?').run(qty, itemId);
    return cartView(db, cart.id);
  });
}

export function removeCartItem(db, userId, itemId) {
  const cart = getOrCreateCart(db, userId);
  const info = db.prepare('DELETE FROM cart_items WHERE id = ? AND cart_id = ?').run(itemId, cart.id);
  if (info.changes === 0) throw notFound('Savat elementi topilmadi');
  return cartView(db, cart.id);
}

export function clearCart(db, userId) {
  const cart = getOrCreateCart(db, userId);
  db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cart.id);
  return cartView(db, cart.id);
}

export function emptyCartForOrder(db, userId) {
  const cart = getOrCreateCart(db, userId);
  return db.prepare(`${CART_VIEW_SQL} WHERE ci.cart_id = ? ORDER BY ci.id`).all(cart.id);
}

export function clearCartItems(db, cartId) {
  db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cartId);
}
