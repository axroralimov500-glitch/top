import { notFound } from '../lib/errors.js';

const AVAILABLE_SQL = `
  (SELECT COALESCE(SUM(i.quantity - i.reserved), 0)
     FROM inventory i
     JOIN product_variants v ON v.id = i.variant_id
     WHERE v.product_id = p.id AND v.is_active = 1)`;

const MIN_PRICE_SQL = `
  (SELECT MIN(v.price) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1)`;

export function listCategories(db) {
  return db
    .prepare('SELECT id, name, slug FROM categories ORDER BY name')
    .all();
}

export function listProducts(db, { category, q, page = 1, limit = 10, sort = 'newest' }) {
  const where = ['p.is_active = 1'];
  const params = [];
  if (category) {
    where.push('c.slug = ?');
    params.push(category);
  }
  if (q) {
    where.push('(p.name LIKE ? OR p.description LIKE ? OR c.name LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  const whereSql = where.join(' AND ');

  const { total } = db
    .prepare(`SELECT COUNT(*) AS total FROM products p JOIN categories c ON c.id = p.category_id WHERE ${whereSql}`)
    .get(...params);

  const orderBy = {
    price_asc: 'min_price ASC, p.id ASC',
    price_desc: 'min_price DESC, p.id DESC',
    newest: 'p.id DESC',
  }[sort] || 'p.id DESC';

  const rows = db
    .prepare(`
      SELECT p.id, p.name, p.slug, p.description, p.max_purchase_qty,
             c.name AS category_name, c.slug AS category_slug,
             ${MIN_PRICE_SQL} AS min_price,
             ${AVAILABLE_SQL} AS available_stock
      FROM products p
      JOIN categories c ON c.id = p.category_id
      WHERE ${whereSql}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `)
    .all(...params, limit, (page - 1) * limit);

  return { items: rows, meta: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) } };
}

export function getProductBySlugOrId(db, idOrSlug) {
  const asId = Number(idOrSlug);
  const product = Number.isInteger(asId) && String(asId) === String(idOrSlug)
    ? db.prepare(`
        SELECT p.*, c.name AS category_name, c.slug AS category_slug,
               ${MIN_PRICE_SQL} AS min_price, ${AVAILABLE_SQL} AS available_stock
        FROM products p JOIN categories c ON c.id = p.category_id
        WHERE p.id = ? AND p.is_active = 1
      `).get(asId)
    : db.prepare(`
        SELECT p.*, c.name AS category_name, c.slug AS category_slug,
               ${MIN_PRICE_SQL} AS min_price, ${AVAILABLE_SQL} AS available_stock
        FROM products p JOIN categories c ON c.id = p.category_id
        WHERE p.slug = ? AND p.is_active = 1
      `).get(String(idOrSlug));

  if (!product) throw notFound('Mahsulot topilmadi');

  product.variants = db
    .prepare(`
      SELECT v.id, v.sku, v.name, v.price,
             COALESCE((SELECT SUM(i.quantity - i.reserved) FROM inventory i WHERE i.variant_id = v.id), 0) AS available_stock
      FROM product_variants v
      WHERE v.product_id = ? AND v.is_active = 1
      ORDER BY v.id
    `)
    .all(product.id);

  return product;
}
