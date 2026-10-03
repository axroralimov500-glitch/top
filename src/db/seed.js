import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { config } from '../config.js';
import { openDb, tx } from './connection.js';
import { migrate } from './migrate.js';
import { hashPassword } from '../auth/passwords.js';
import { nowIso } from '../lib/time.js';

export function seed(db, { log = () => {} } = {}) {
  return tx(db, () => {
    const existing = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
    if (existing > 0) {
      log('Seed o‘tkazib yuborildi — bazada foydalanuvchilar bor.');
      return false;
    }

    const insertUser = db.prepare('INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)');
    insertUser.run('Administrator', 'admin@shop.uz', hashPassword('devament11'), 'admin', nowIso());
    insertUser.run('Aziz Karimov', 'aziz@example.com', hashPassword('Aziz123!'), 'customer', nowIso());
    insertUser.run('Malika Yusupova', 'malika@example.com', hashPassword('Malika123!'), 'customer', nowIso());

    const insertCat = db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)');
    const cats = {
      telefon: insertCat.run('Telefonlar', 'telefon').lastInsertRowid,
      noutbuk: insertCat.run('Noutbuklar', 'noutbuk').lastInsertRowid,
      audio: insertCat.run('Audio', 'audio').lastInsertRowid,
      ichimlik: insertCat.run('Ichimliklar', 'ichimliklar').lastInsertRowid,
    };

    const insertWh = db.prepare('INSERT INTO warehouses (code, name) VALUES (?, ?)');
    const whMain = insertWh.run('WH-TASHKENT', 'Asosiy ombor (Toshkent)').lastInsertRowid;
    const whSam = insertWh.run('WH-SAMARKAND', 'Samarqand filiali').lastInsertRowid;

    const insertProduct = db.prepare(
      'INSERT INTO products (category_id, name, slug, description, max_purchase_qty, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const insertVariant = db.prepare('INSERT INTO product_variants (product_id, sku, name, price) VALUES (?, ?, ?, ?)');
    const insertInv = db.prepare('INSERT INTO inventory (variant_id, warehouse_id, quantity, reserved) VALUES (?, ?, ?, 0)');

    function product(catId, name, slug, description, maxQty, variants) {
      const pid = insertProduct.run(catId, name, slug, description, maxQty, nowIso()).lastInsertRowid;
      for (const [sku, vName, price, qtyMain, qtySam] of variants) {
        const vid = insertVariant.run(pid, sku, vName, price).lastInsertRowid;
        if (qtyMain > 0) insertInv.run(vid, whMain, qtyMain);
        if (qtySam > 0) insertInv.run(vid, whSam, qtySam);
      }
      return pid;
    }

    product(cats.telefon, 'iPhone 15', 'iphone-15', 'Apple iPhone 15, A16 chip, Dynamic Island.', 2, [
      ['IP15-128-BLK', '128GB, Qora', 12990000, 5, 0],
      ['IP15-256-BLK', '256GB, Qora', 14490000, 3, 2],
    ]);
    product(cats.telefon, 'Samsung Galaxy S24', 'samsung-galaxy-s24', 'Samsung Galaxy S24, 8/256GB.', 3, [
      ['SGS24-256-GRY', '256GB, Kulrang', 10990000, 10, 4],
    ]);
    product(cats.telefon, 'Redmi Note 13', 'redmi-note-13', 'Xiaomi Redmi Note 13, 8/256GB.', 5, [
      ['RN13-256-BLU', '256GB, Ko‘k', 3290000, 15, 10],
    ]);
    product(cats.noutbuk, 'MacBook Air M3', 'macbook-air-m3', 'Apple MacBook Air 13" M3, 8/256GB.', 2, [
      ['MBA13-M3-256', '13", 8/256GB', 18990000, 4, 0],
    ]);
    product(cats.noutbuk, 'ASUS Vivobook 15', 'asus-vivobook-15', 'ASUS Vivobook 15, Ryzen 5, 8/512GB.', 3, [
      ['AVB15-R5-512', '15.6", 8/512GB', 7490000, 6, 2],
    ]);
    product(cats.audio, 'AirPods Pro 2', 'airpods-pro-2', 'Apple AirPods Pro (2-avlod), USB-C.', 5, [
      ['APP2-USBC', 'USB-C quti', 4290000, 15, 5],
    ]);
    // Demo uchun kam qoldiq: parallel xarid sinovi qulay bo'lishi uchun.
    product(cats.audio, 'JBL Tune 520BT', 'jbl-tune-520bt', 'JBL Tune 520BT wireless quloqchin. Qoldiq cheklangan.', 1, [
      ['JBL520-BLK', 'Qora', 790000, 1, 0],
    ]);
    // Kirim/qayta-narxlash uchun demo: 200 dona 5 000 so'mdan keldi, ertasi 6 000 bo'ldi.
    product(cats.ichimlik, 'Suv 0.5L', 'suv-0-5l', 'Ichimlik suvi 0.5L. Narx oshsa eski qoldiqqa ham qo‘llanadi.', 24, [
      ['SUV-05L', '0.5L butilka', 5000, 200, 0],
    ]);

    return true;
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const db = openDb(config.dbPath);
  try {
    migrate(db);
    const created = seed(db, { log: console.log });
    if (created) {
      console.log('Seed yakunlandi.');
      console.log('  Admin   : admin@shop.uz / devament11  (2-bosqich paroli: devament)');
      console.log('  Mijoz 1 : aziz@example.com / Aziz123!');
      console.log('  Mijoz 2 : malika@example.com / Malika123!');
    }
  } finally {
    db.close();
  }
}
