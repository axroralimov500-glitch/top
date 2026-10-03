import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { startTestServer } from './helpers/test-server.mjs';
import { api, login } from './helpers/api.mjs';
import { seedFixtures } from './helpers/fixtures.mjs';
import { signCallback, newProviderPaymentId } from '../src/modules/payments.service.js';
import { config } from '../src/config.js';

// TTL qisqa (1 sekund) — muddat tugashi tez tekshiriladi.
let s, a, c1, fx;

beforeEach(async () => {
  s = await startTestServer({ ttlSec: 1 });
  fx = seedFixtures(s.db);
  a = api(s.baseUrl);
  c1 = await login(a, 'c1@test.uz', 'CustPass1');
});

afterEach(async () => {
  await s.close();
});

function callbackBody(order) {
  const payload = {
    provider_payment_id: newProviderPaymentId(),
    order_id: order.id,
    amount: order.total,
    status: 'succeeded',
  };
  return { ...payload, signature: signCallback(config.paymentSecret, payload) };
}

function inventoryOf(variantId) {
  const row = s.db
    .prepare('SELECT COALESCE(SUM(quantity), 0) AS qty, COALESCE(SUM(reserved), 0) AS reserved FROM inventory WHERE variant_id = ?')
    .get(variantId);
  return JSON.parse(JSON.stringify(row));
}

test('TTL tugagach: buyurtma expired, rezerv qaytadi', async () => {
  const only = fx.products.scarce.variants.only;
  const order = (await a.post('/orders', { items: [{ variant_id: only.id, qty: 1 }] }, c1.token)).body.data;
  assert.deepEqual(inventoryOf(only.id), { qty: 1, reserved: 1 });

  await sleep(1400);

  const got = await a.get(`/orders/${order.id}`, c1.token);
  assert.equal(got.body.data.status, 'expired');
  assert.deepEqual(inventoryOf(only.id), { qty: 1, reserved: 0 });

  // qoldiq qaytgach boshqa mijoz xarid qilishi mumkin
  const c2 = await login(a, 'c2@test.uz', 'CustPass2');
  const again = await a.post('/orders', { items: [{ variant_id: only.id, qty: 1 }] }, c2.token);
  assert.equal(again.status, 201);
});

test('expired buyurtmaga kechikkan tolov 409 ORDER_NOT_PAYABLE', async () => {
  const order = (await a.post('/orders', { items: [{ variant_id: fx.products.phone.variants.std.id, qty: 1 }] }, c1.token)).body.data;
  await sleep(1400);
  await a.get(`/orders/${order.id}`, c1.token); // sweep ishlaydi

  const res = await a.post('/payments/callback', callbackBody(order));
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'ORDER_NOT_PAYABLE');
  assert.equal(res.body.error.details.order_status, 'expired');

  const p = s.db.prepare('SELECT status, reason FROM payments').get();
  assert.equal(p.status, 'rejected');
  assert.equal(p.reason, 'order_expired');
});

test('kechikkan tolovning takroriy callbacki ham xavfsiz (already_processed)', async () => {
  const order = (await a.post('/orders', { items: [{ variant_id: fx.products.phone.variants.std.id, qty: 1 }] }, c1.token)).body.data;
  await sleep(1400);
  await a.get(`/orders/${order.id}`, c1.token);

  const body = callbackBody(order);
  const first = await a.post('/payments/callback', body);
  assert.equal(first.status, 409);

  const dup = await a.post('/payments/callback', body);
  assert.equal(dup.status, 200);
  assert.equal(dup.body.data.result, 'already_processed');

  const got = await a.get(`/orders/${order.id}`, c1.token);
  assert.equal(got.body.data.status, 'expired');
  assert.equal(s.db.prepare("SELECT COUNT(*) AS c FROM payments WHERE status = 'succeeded'").get().c, 0);
});

test('expired buyurtmani bekor qilish ham mumkin emas', async () => {
  const order = (await a.post('/orders', { items: [{ variant_id: fx.products.phone.variants.std.id, qty: 1 }] }, c1.token)).body.data;
  await sleep(1400);
  await a.get(`/orders/${order.id}`, c1.token);

  const res = await a.post(`/orders/${order.id}/cancel`, {}, c1.token);
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'ORDER_NOT_CANCELLABLE');
});
