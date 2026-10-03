import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers/test-server.mjs';
import { api, login } from './helpers/api.mjs';
import { seedFixtures } from './helpers/fixtures.mjs';
import { signCallback, newProviderPaymentId } from '../src/modules/payments.service.js';
import { config } from '../src/config.js';

let s, a, c1, fx;

beforeEach(async () => {
  s = await startTestServer();
  fx = seedFixtures(s.db);
  a = api(s.baseUrl);
  c1 = await login(a, 'c1@test.uz', 'CustPass1');
});

afterEach(async () => {
  await s.close();
});

// payloadOverrides — imzo hisoblanishidan OLDIN payloadga qoshiladi (masalan, summani buzish).
// bodyOverrides — imzodan KEYIN tana ustiga yoziladi (masalan, imzoni buzish).
function callbackBody(order, payloadOverrides = {}, bodyOverrides = {}) {
  const payload = {
    provider_payment_id: newProviderPaymentId(),
    order_id: order.id,
    amount: order.total,
    status: 'succeeded',
    ...payloadOverrides,
  };
  return { ...payload, signature: signCallback(config.paymentSecret, payload), ...bodyOverrides };
}

async function createOrder(variantId, qty = 1) {
  return (await a.post('/orders', { items: [{ variant_id: variantId, qty }] }, c1.token)).body.data;
}

function paymentCount() {
  return s.db.prepare('SELECT COUNT(*) AS c FROM payments').get().c;
}

function inventoryOf(variantId) {
  const row = s.db
    .prepare('SELECT COALESCE(SUM(quantity), 0) AS qty, COALESCE(SUM(reserved), 0) AS reserved FROM inventory WHERE variant_id = ?')
    .get(variantId);
  return JSON.parse(JSON.stringify(row));
}

test('muvaffaqiyatli callback: buyurtma toladi, qoldiq yechiladi', async () => {
  const only = fx.products.scarce.variants.only;
  const order = await createOrder(only.id);
  assert.equal(order.status, 'pending_payment');
  assert.deepEqual(inventoryOf(only.id), { qty: 1, reserved: 1 });

  const res = await a.post('/payments/callback', callbackBody(order));
  assert.equal(res.status, 200);
  assert.equal(res.body.data.result, 'paid');

  const got = await a.get(`/orders/${order.id}`, c1.token);
  assert.equal(got.body.data.status, 'paid');
  // rezerv sarflandi: quantity kamaydi, reserved nolga qaytdi
  assert.deepEqual(inventoryOf(only.id), { qty: 0, reserved: 0 });
  assert.equal(paymentCount(), 1);
});

// QABUL MEZONI 2: takroriy callback to'lov ham, qoldiq yechishni ham takrorlamaydi.
test('takroriy callback hech narsani ozgartirmaydi', async () => {
  const only = fx.products.scarce.variants.only;
  const order = await createOrder(only.id);
  const body = callbackBody(order);

  const first = await a.post('/payments/callback', body);
  assert.equal(first.status, 200);
  assert.equal(first.body.data.result, 'paid');
  const qtyAfterFirst = inventoryOf(only.id).qty;

  const dup = await a.post('/payments/callback', body);
  assert.equal(dup.status, 200);
  assert.equal(dup.body.data.result, 'already_processed');

  assert.equal(paymentCount(), 1, 'yangi tolov yozuvi yaratilmasligi kerak');
  assert.equal(inventoryOf(only.id).qty, qtyAfterFirst, 'qoldiq qayta yechilmasligi kerak');

  const got = await a.get(`/orders/${order.id}`, c1.token);
  assert.equal(got.body.data.status, 'paid');
});

test('notogri imzo 401 va tolov yozuvi yaratilmaydi', async () => {
  const order = await createOrder(fx.products.phone.variants.std.id);
  const body = callbackBody(order, {}, { signature: 'deadbeef' });

  const res = await a.post('/payments/callback', body);
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_SIGNATURE');
  assert.equal(paymentCount(), 0);

  const got = await a.get(`/orders/${order.id}`, c1.token);
  assert.equal(got.body.data.status, 'pending_payment');
});

test('imzosiz yoki maydoni yetshmay qolgan callback 400', async () => {
  const order = await createOrder(fx.products.phone.variants.std.id);
  const { signature, ...noSig } = callbackBody(order);
  const res = await a.post('/payments/callback', noSig);
  assert.equal(res.status, 400);

  const bad = await a.post('/payments/callback', { provider_payment_id: 'x' });
  assert.equal(bad.status, 400);
});

test('summa mos kelmasa 409 AMOUNT_MISMATCH va rejected tolov saqlanadi', async () => {
  const order = await createOrder(fx.products.phone.variants.std.id);
  const res = await a.post('/payments/callback', callbackBody(order, { amount: order.total + 1 }));
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'AMOUNT_MISMATCH');

  assert.equal(paymentCount(), 1);
  const p = s.db.prepare('SELECT status, reason FROM payments').get();
  assert.equal(p.status, 'rejected');
  assert.equal(p.reason, 'amount_mismatch');

  const got = await a.get(`/orders/${order.id}`, c1.token);
  assert.equal(got.body.data.status, 'pending_payment');
  assert.deepEqual(inventoryOf(fx.products.phone.variants.std.id), { qty: 10, reserved: 1 });
});

test('tolanilgan buyurtmaga ikkinchi muvaffaqiyatli tolov 409', async () => {
  const order = await createOrder(fx.products.phone.variants.std.id);
  await a.post('/payments/callback', callbackBody(order));

  const res = await a.post('/payments/callback', callbackBody(order)); // boshqa provider_payment_id
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'ORDER_NOT_PAYABLE');

  const p = s.db.prepare('SELECT status, reason FROM payments WHERE order_id = ? ORDER BY id DESC').get(order.id);
  assert.equal(p.status, 'rejected');
  assert.equal(p.reason, 'order_paid');
  assert.equal(s.db.prepare("SELECT COUNT(*) AS c FROM payments WHERE status = 'succeeded'").get().c, 1);
});

test('failed callback: buyurtma pending qoladi, rezerv saqlanadi', async () => {
  const only = fx.products.scarce.variants.only;
  const order = await createOrder(only.id);

  const res = await a.post('/payments/callback', callbackBody(order, { status: 'failed' }));
  assert.equal(res.status, 200);
  assert.equal(res.body.data.result, 'failed_recorded');

  const got = await a.get(`/orders/${order.id}`, c1.token);
  assert.equal(got.body.data.status, 'pending_payment');
  assert.deepEqual(inventoryOf(only.id), { qty: 1, reserved: 1 });
});

test('mavjud bolmagan buyurtmaga callback 404', async () => {
  const res = await a.post('/payments/callback', callbackBody({ id: 99999, total: 1000 }));
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'ORDER_NOT_FOUND');
});
