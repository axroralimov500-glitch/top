import { hashPassword } from '../../src/auth/passwords.js';
import { nowIso } from '../../src/lib/time.js';

// Test uchun bazaviy ma'lumotlar: foydalanuvchilar, kategoriya, ombor, mahsulotlar.
export function seedFixtures(db) {
  const t = nowIso();
  const users = {};
  const insertUser = db.prepare('INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)');
  users.admin = { id: Number(insertUser.run('Admin', 'admin@test.uz', hashPassword('AdminPass1'), 'admin', t).lastInsertRowid) };
  users.customer = { id: Number(insertUser.run('C1', 'c1@test.uz', hashPassword('CustPass1'), 'customer', t).lastInsertRowid) };
  users.customer2 = { id: Number(insertUser.run('C2', 'c2@test.uz', hashPassword('CustPass2'), 'customer', t).lastInsertRowid) };

  const catId = db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)').run('Test Kategoriya', 'test-kat').lastInsertRowid;
  const whMain = db.prepare('INSERT INTO warehouses (code, name) VALUES (?, ?)').run('WH-MAIN', 'Asosiy').lastInsertRowid;
  const whSecond = db.prepare('INSERT INTO warehouses (code, name) VALUES (?, ?)').run('WH-2', 'Filial').lastInsertRowid;

  function product(name, slug, maxQty, variants) {
    const pid = db.prepare('INSERT INTO products (category_id, name, slug, max_purchase_qty, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(catId, name, slug, maxQty, t).lastInsertRowid;
    const out = {};
    for (const [key, sku, price, qtyMain, qtySecond] of variants) {
      const vid = db.prepare('INSERT INTO product_variants (product_id, sku, name, price) VALUES (?, ?, ?, ?)')
        .run(pid, sku, key, price).lastInsertRowid;
      if (qtyMain > 0) db.prepare('INSERT INTO inventory (variant_id, warehouse_id, quantity, reserved) VALUES (?, ?, ?, 0)').run(vid, whMain, qtyMain);
      if (qtySecond > 0) db.prepare('INSERT INTO inventory (variant_id, warehouse_id, quantity, reserved) VALUES (?, ?, ?, 0)').run(vid, whSecond, qtySecond);
      out[key] = { id: vid, price, sku };
    }
    return { id: pid, variants: out };
  }

  // oddiy mahsulot: yetarli qoldiq
  const phone = product('Telefon X', 'telefon-x', 5, [
    ['std', 'TX-STD', 1000000, 10, 0],
    ['pro', 'TX-PRO', 2000000, 4, 6],
  ]);
  // qoldig'i 1 bo'lgan mahsulot — parallel xarid testi
  const scarce = product('Kam Qoldiq', 'kam-qoldiq', 5, [
    ['only', 'KQ-1', 500000, 1, 0],
  ]);
  // max_purchase_qty=2
  const limited = product('Limitli', 'limitli', 2, [
    ['one', 'LM-1', 300000, 20, 0],
  ]);
  // ikki omborga bo'lingan qoldiq — greedy ajratish testi
  const split = product('Bo‘lingan', 'bolingan', 10, [
    ['sp', 'SP-1', 700000, 3, 4],
  ]);

  return { users, catId, whMain, whSecond, products: { phone, scarce, limited, split } };
}
