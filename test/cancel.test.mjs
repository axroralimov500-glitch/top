import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers/test-server.mjs';
import { api, login, adminLogin } from './helpers/api.mjs';
import { seedFixtures } from './helpers/fixtures.mjs';
import { signCallback, newProviderPaymentId } from '../src/modules/payments.service.js';
import { config } from '../src/config.js';

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

function inventoryOf(variantId) {
  const row = s.db
    .prepare('SELECT COALESCE(SUM(quantity), 0) AS qty, COALESCE(SUM(reserved), 0) AS reserved FROM inventory WHERE variant_id = ?')
    .get(variantId);
  return JSON.parse(JSON.stringify(row));
}

function payBody(order) {
  const payload = {
    provider_payment_id: newProviderPaymentId(),
    order_id: order.id,
    amount: order.total,
    status: 'succeeded',
  };
  return { ...payload, signature: signCallback(config.paymentSecret, payload) };
}

// QABUL MEZONI 3: bekor qilingan buyurtma API orqali qayta ochilmaydi,
// bekor qilish faqat bir marta mumkin.
test('pending buyurtmani bekor qilish: rezerv qaytadi', async () => {
  const only = fx.products.scarce.variants.only;
  const order = (await a.post('/orders', { items: [{ variant_id: only.id, qty: 1 }] }, c1.token)).body.data;
  assert.deepEqual(inventoryOf(only.id), { qty: 1, reserved: 1 });

  const res = await a.post(`/orders/${order.id}/cancel`, {}, c1.token);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, 'cancelled');
  assert.deepEqual(inventoryOf(only.id), { qty: 1, reserved: 0 });
});

test('ikkinchi marta bekor qilish 409 (faqat bir marta)', async () => {
  const order = (await a.post('/orders', { items: [{ variant_id: fx.products.phone.variants.std.id, qty: 1 }] }, c1.token)).body.data;
  const first = await a.post(`/orders/${order.id}/cancel`, {}, c1.token);
  assert.equal(first.status, 200);

  const second = await a.post(`/orders/${order.id}/cancel`, {}, c1.token);
  assert.equal(second.status, 409);
  assert.equal(second.body.error.code, 'ORDER_NOT_CANCELLABLE');
});

test('bekor qilingan buyurtma qayta ochilmaydi (PATCH 409)', async () => {
  const order = (await a.post('/orders', { items: [{ variant_id: fx.products.phone.variants.std.id, qty: 1 }] }, c1.token)).body.data;
  await a.post(`/orders/${order.id}/cancel`, {}, c1.token);

  const res = await a.patch(`/orders/${order.id}`, { status: 'pending_payment' }, c1.token);
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'ORDER_STATUS_IMMUTABLE');

  // admin uchun ham qayta ochish yo'q
  const asAdmin = await a.patch(`/orders/${order.id}`, { status: 'pending_payment' }, admin.token);
  assert.equal(asAdmin.status, 409);
  assert.equal(asAdmin.body.error.code, 'ORDER_STATUS_IMMUTABLE');
});

test('bekor qilingan buyurtmaga tolov kelib tushsa 409', async () => {
  const order = (await a.post('/orders', { items: [{ variant_id: fx.products.phone.variants.std.id, qty: 1 }] }, c1.token)).body.data;
  await a.post(`/orders/${order.id}/cancel`, {}, c1.token);

  const res = await a.post('/payments/callback', payBody(order));
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'ORDER_NOT_PAYABLE');

  const got = await a.get(`/orders/${order.id}`, c1.token);
  assert.equal(got.body.data.status, 'cancelled');
});

test('boshqa mijozning buyurtmasini bekor qilish 404', async () => {
  const order = (await a.post('/orders', { items: [{ variant_id: fx.products.phone.variants.std.id, qty: 1 }] }, c1.token)).body.data;
  const res = await a.post(`/orders/${order.id}/cancel`, {}, c2.token);
  assert.equal(res.status, 404);
  const got = await a.get(`/orders/${order.id}`, c1.token);
  assert.equal(got.body.data.status, 'pending_payment');
});

test('admin mijoz buyurtmasini bekor qiladi, lekin faqat bir marta', async () => {
  const order = (await a.post('/orders', { items: [{ variant_id: fx.products.phone.variants.std.id, qty: 1 }] }, c1.token)).body.data;
  const first = await a.post(`/orders/${order.id}/cancel`, {}, admin.token);
  assert.equal(first.status, 200);
  assert.equal(first.body.data.status, 'cancelled');

  const second = await a.post(`/orders/${order.id}/cancel`, {}, admin.token);
  assert.equal(second.status, 409);
});

test('tolangan buyurtmani bekor qilish mumkin emas', async () => {
  const order = (await a.post('/orders', { items: [{ variant_id: fx.products.phone.variants.std.id, qty: 1 }] }, c1.token)).body.data;
  const paid = await a.post('/payments/callback', payBody(order));
  assert.equal(paid.status, 200);

  const res = await a.post(`/orders/${order.id}/cancel`, {}, c1.token);
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'ORDER_NOT_CANCELLABLE');
});
