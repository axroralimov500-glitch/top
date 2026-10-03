import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers/test-server.mjs';
import { api, login, adminLogin } from './helpers/api.mjs';
import { seedFixtures } from './helpers/fixtures.mjs';

// Jonli himoyadagi o'zgarish: bir mahsulotga maksimal xarid miqdori (max_purchase_qty).
let s, a, admin, c1, fx;

beforeEach(async () => {
  s = await startTestServer();
  fx = seedFixtures(s.db);
  a = api(s.baseUrl);
  admin = await adminLogin(a, 'admin@test.uz', 'AdminPass1');
  c1 = await login(a, 'c1@test.uz', 'CustPass1');
});

afterEach(async () => {
  await s.close();
});

test('mahsulot tafsilotida max_purchase_qty korinadi', async () => {
  const res = await a.get('/products/limitli');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.max_purchase_qty, 2);
});

test('yangi mahsulotda standart limit 10, kiritilgan qiymat saqlanadi', async () => {
  const def = (await a.post('/admin/products', { category_id: fx.catId, name: 'Standart Limit' }, admin.token)).body.data;
  assert.equal(def.max_purchase_qty, 10);

  const custom = (await a.post(
    '/admin/products',
    { category_id: fx.catId, name: 'Maxsus Limit', max_purchase_qty: 3 },
    admin.token
  )).body.data;
  assert.equal(custom.max_purchase_qty, 3);
});

test('notogri max_purchase_qty 400', async () => {
  for (const bad of [0, -1, 2.5, 'ko‘p']) {
    const res = await a.post('/admin/products', { category_id: fx.catId, name: `X-${bad}`, max_purchase_qty: bad }, admin.token);
    assert.equal(res.status, 400, `max=${bad}`);
  }
});

test('admin limitni oshirsa chegara kengayadi', async () => {
  const limitedId = fx.products.limited.id;
  const v = fx.products.limited.variants.one;

  const before = await a.post('/orders', { items: [{ variant_id: v.id, qty: 3 }] }, c1.token);
  assert.equal(before.status, 422);

  const upd = await a.patch(`/admin/products/${limitedId}`, { max_purchase_qty: 5 }, admin.token);
  assert.equal(upd.status, 200);
  assert.equal(upd.body.data.max_purchase_qty, 5);

  const after = await a.post('/orders', { items: [{ variant_id: v.id, qty: 3 }] }, c1.token);
  assert.equal(after.status, 201);
});

test('limit savat va buyurtmada bir xil kuchga ega', async () => {
  const v = fx.products.limited.variants.one;
  const cartRes = await a.post('/cart/items', { variant_id: v.id, qty: 2 }, c1.token);
  assert.equal(cartRes.status, 201);
  const orderRes = await a.post('/orders', {}, c1.token);
  assert.equal(orderRes.status, 201);
});
