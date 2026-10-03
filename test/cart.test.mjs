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

test('savatga qoshish, korish va jami summa', async () => {
  const v = fx.products.phone.variants.std;
  const res = await a.post('/cart/items', { variant_id: v.id, qty: 2 }, c1.token);
  assert.equal(res.status, 201);
  assert.equal(res.body.data.items.length, 1);
  assert.equal(res.body.data.items[0].qty, 2);
  assert.equal(res.body.data.items[0].line_total, v.price * 2);
  assert.equal(res.body.data.total, v.price * 2);
});

test('bir xil variant qayta qoshilsa qty yigilib boradi', async () => {
  const v = fx.products.phone.variants.std;
  await a.post('/cart/items', { variant_id: v.id, qty: 1 }, c1.token);
  const res = await a.post('/cart/items', { variant_id: v.id, qty: 2 }, c1.token);
  assert.equal(res.status, 201);
  assert.equal(res.body.data.items.length, 1);
  assert.equal(res.body.data.items[0].qty, 3);
});

test('savat elementini yangilash va ochirish', async () => {
  const v = fx.products.phone.variants.std;
  const added = (await a.post('/cart/items', { variant_id: v.id, qty: 2 }, c1.token)).body.data;
  const itemId = added.items[0].cart_item_id;

  const upd = await a.patch(`/cart/items/${itemId}`, { qty: 5 }, c1.token);
  assert.equal(upd.status, 200);
  assert.equal(upd.body.data.items[0].qty, 5);

  const del = await a.del(`/cart/items/${itemId}`, c1.token);
  assert.equal(del.status, 200);
  assert.equal(del.body.data.items.length, 0);
});

test('savatni toliq tozalash', async () => {
  await a.post('/cart/items', { variant_id: fx.products.phone.variants.std.id, qty: 1 }, c1.token);
  await a.post('/cart/items', { variant_id: fx.products.split.variants.sp.id, qty: 1 }, c1.token);
  const res = await a.del('/cart', c1.token);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.items.length, 0);
});

test('max_purchase_qty: limitli mahsulotga 3 dona 422', async () => {
  const v = fx.products.limited.variants.one; // max = 2
  const res = await a.post('/cart/items', { variant_id: v.id, qty: 3 }, c1.token);
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'MAX_PURCHASE_QTY');
  assert.equal(res.body.error.details.max_purchase_qty, 2);
});

test('max_purchase_qty: yigindi limitdan oshsa ham 422', async () => {
  const v = fx.products.limited.variants.one; // max = 2
  await a.post('/cart/items', { variant_id: v.id, qty: 2 }, c1.token);
  const res = await a.post('/cart/items', { variant_id: v.id, qty: 1 }, c1.token);
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'MAX_PURCHASE_QTY');
});

test('qoldiqdan kop savatga qoshish 409 INSUFFICIENT_STOCK', async () => {
  const v = fx.products.scarce.variants.only; // stock 1
  const res = await a.post('/cart/items', { variant_id: v.id, qty: 2 }, c1.token);
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'INSUFFICIENT_STOCK');
});

test('foydalanuvchi savatlari izolyatsiyalangan', async () => {
  const added = (await a.post('/cart/items', { variant_id: fx.products.phone.variants.std.id, qty: 1 }, c1.token)).body.data;
  const itemId = added.items[0].cart_item_id;

  const other = await a.get('/cart', c2.token);
  assert.equal(other.status, 200);
  assert.equal(other.body.data.items.length, 0);

  const patchOther = await a.patch(`/cart/items/${itemId}`, { qty: 3 }, c2.token);
  assert.equal(patchOther.status, 404);
});

test('token savat uchun majburiy', async () => {
  const res = await a.get('/cart');
  assert.equal(res.status, 401);
  const add = await a.post('/cart/items', { variant_id: 1, qty: 1 });
  assert.equal(add.status, 401);
});
