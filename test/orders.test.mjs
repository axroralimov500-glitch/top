import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers/test-server.mjs';
import { api, login, adminLogin } from './helpers/api.mjs';
import { seedFixtures } from './helpers/fixtures.mjs';

let s, a, admin, c1, c2, fx;

beforeEach(async () => {
  s = await startTestServer();
  fx = seedFixtures(s.db);
  a = api(s.baseUrl);
  admin = await adminLogin(a, 'admin@test.uz', 'AdminPass1');
  c1 = await login(a, 'c1@test.uz', 'CustPass1');
  c2 = await login(a, 'c2@test.uz', 'CustPass2');
});

afterEach(async () => {
  await s.close();
});

function availableOf(product, variantKey) {
  const p = s.db
    .prepare('SELECT COALESCE(SUM(quantity - reserved), 0) AS a FROM inventory WHERE variant_id = ?')
    .get(product.variants[variantKey].id);
  return p.a;
}

test('savatdan buyurtma: holat, narx nusxasi, rezerv va savat tozalanishi', async () => {
  const std = fx.products.phone.variants.std;
  const pro = fx.products.phone.variants.pro;
  await a.post('/cart/items', { variant_id: std.id, qty: 2 }, c1.token);
  await a.post('/cart/items', { variant_id: pro.id, qty: 1 }, c1.token);

  const res = await a.post('/orders', { address: 'Toshkent, Amir Temur 1' }, c1.token);
  assert.equal(res.status, 201);
  const order = res.body.data;
  assert.equal(order.status, 'pending_payment');
  assert.equal(order.currency, 'UZS');
  assert.equal(order.total, std.price * 2 + pro.price);
  assert.equal(order.items.length, 2);
  // narx nusxasi order_items ichida
  const stdLine = order.items.find((i) => i.sku === std.sku);
  assert.equal(stdLine.unit_price, std.price);
  assert.equal(stdLine.line_total, std.price * 2);

  // rezerv: mavjud qoldiq kamaydi
  assert.equal(availableOf(fx.products.phone, 'std'), 8);
  assert.equal(availableOf(fx.products.phone, 'pro'), 9);

  // savat tozalandi
  const cart = await a.get('/cart', c1.token);
  assert.equal(cart.body.data.items.length, 0);
});

test('narx nusxasi: narx ozgarganda eski buyurtma summasi ozgarmaydi', async () => {
  const std = fx.products.phone.variants.std;
  const before = (await a.post('/orders', { items: [{ variant_id: std.id, qty: 1 }] }, c1.token)).body.data;
  assert.equal(before.total, 1000000);

  const upd = await a.patch(`/admin/variants/${std.id}`, { price: 1500000 }, admin.token);
  assert.equal(upd.status, 200);

  const after = await a.get(`/orders/${before.id}`, c1.token);
  assert.equal(after.status, 200);
  assert.equal(after.body.data.total, 1000000);
  assert.equal(after.body.data.items[0].unit_price, 1000000);

  // yangi buyurtma yangi narx bilan
  const next = (await a.post('/orders', { items: [{ variant_id: std.id, qty: 1 }] }, c1.token)).body.data;
  assert.equal(next.total, 1500000);
});

test('items rejimi buyurtma savatni buzmaydi', async () => {
  await a.post('/cart/items', { variant_id: fx.products.phone.variants.std.id, qty: 1 }, c1.token);
  await a.post('/orders', { items: [{ variant_id: fx.products.scarce.variants.only.id, qty: 1 }] }, c1.token);
  const cart = await a.get('/cart', c1.token);
  assert.equal(cart.body.data.items.length, 1);
});

test('qoldiq yetmasa 409 INSUFFICIENT_STOCK va buyurtma yaratilmaydi', async () => {
  const before = s.db.prepare('SELECT COUNT(*) AS c FROM orders').get().c;
  const res = await a.post('/orders', { items: [{ variant_id: fx.products.scarce.variants.only.id, qty: 2 }] }, c1.token);
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'INSUFFICIENT_STOCK');
  assert.equal(s.db.prepare('SELECT COUNT(*) AS c FROM orders').get().c, before);
});

test('buyurtma limiti: max_purchase_qty dan oshsa 422', async () => {
  const res = await a.post('/orders', { items: [{ variant_id: fx.products.limited.variants.one.id, qty: 3 }] }, c1.token);
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'MAX_PURCHASE_QTY');
});

test('buyurtmalar royxati faqat oz buyurtmalarni beradi', async () => {
  const o1 = (await a.post('/orders', { items: [{ variant_id: fx.products.phone.variants.std.id, qty: 1 }] }, c1.token)).body.data;
  await a.post('/orders', { items: [{ variant_id: fx.products.phone.variants.std.id, qty: 1 }] }, c2.token);

  const mine = await a.get('/orders', c1.token);
  assert.equal(mine.status, 200);
  assert.equal(mine.body.meta.total, 1);
  assert.equal(mine.body.data[0].id, o1.id);

  // boshqa foydalanuvchi buyurtmasini oqish 404
  const foreign = await a.get(`/orders/${mine.body.data[0].id + 1}`, c1.token);
  assert.equal(foreign.status, 404);

  // admin esa koradi
  const asAdmin = await a.get(`/orders/${o1.id}`, admin.token);
  assert.equal(asAdmin.status, 200);

  // admin royxati hammasini koradi
  const all = await a.get('/admin/orders', admin.token);
  assert.equal(all.body.meta.total, 2);

  // mijozga admin royxati taqiqlangan
  const blocked = await a.get('/admin/orders', c1.token);
  assert.equal(blocked.status, 403);
});

test('status boyicha filtrlash', async () => {
  await a.post('/orders', { items: [{ variant_id: fx.products.phone.variants.std.id, qty: 1 }] }, c1.token);
  const list = await a.get('/orders?status=pending_payment', c1.token);
  assert.equal(list.body.meta.total, 1);
  const empty = await a.get('/orders?status=paid', c1.token);
  assert.equal(empty.body.meta.total, 0);
});

test('rezerv bir nechta ombordan greedy ajratiladi', async () => {
  const sp = fx.products.split.variants.sp; // WH-MAIN: 3, WH-2: 4
  const res = await a.post('/orders', { items: [{ variant_id: sp.id, qty: 5 }] }, c1.token);
  assert.equal(res.status, 201);

  const rows = s.db
    .prepare('SELECT warehouse_id, qty FROM reservations WHERE order_id = ? ORDER BY qty DESC')
    .all(res.body.data.id);
  assert.equal(rows.length, 2);
  // katta qoldiq birinchi (WH-2: 4), keyin qolgan 1
  assert.deepEqual(rows.map((r) => r.qty), [4, 1]);
});
