import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { startTestServer } from './helpers/test-server.mjs';
import { api, login } from './helpers/api.mjs';
import { seedFixtures } from './helpers/fixtures.mjs';

const workerPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'concurrency-worker.mjs');

let s, a, c1, c2, fx;

beforeEach(async () => {
  s = await startTestServer();
  fx = seedFixtures(s.db);
  a = api(s.baseUrl);
  c1 = await login(a, 'c1@test.uz', 'CustPass1');
  c2 = await login(a, 'c2@test.uz', 'CustPass2');
});

afterEach(async () => {
  await s.close();
});

function stockRow(variantId) {
  return s.db
    .prepare('SELECT COALESCE(SUM(quantity), 0) AS qty, COALESCE(SUM(reserved), 0) AS reserved FROM inventory WHERE variant_id = ?')
    .get(variantId);
}

// QABUL MEZONI 1: qoldiq 1 bo'lganda ikki parallel xaridning faqat bittasi rezerv oladi.
test('ikki parallel HTTP xariddan faqat bittasi rezerv oladi', async () => {
  const only = fx.products.scarce.variants.only;
  const body = { items: [{ variant_id: only.id, qty: 1 }] };

  const [r1, r2] = await Promise.all([
    a.post('/orders', body, c1.token),
    a.post('/orders', body, c2.token),
  ]);

  const statuses = [r1.status, r2.status].sort();
  assert.deepEqual(statuses, [201, 409]);

  const winner = r1.status === 201 ? r1 : r2;
  const loser = r1.status === 201 ? r2 : r1;
  assert.equal(loser.body.error.code, 'INSUFFICIENT_STOCK');

  // g'olibda aynan bitta rezerv, yo'qotuvchida buyurtma yo'q
  const row = stockRow(only.id);
  assert.equal(row.qty, 1);
  assert.equal(row.reserved, 1);
  const reservations = s.db.prepare('SELECT COUNT(*) AS c FROM reservations WHERE variant_id = ?').get(only.id).c;
  assert.equal(reservations, 1);

  // faqat bitta pending buyurtma mavjud
  const pendings = s.db.prepare("SELECT COUNT(*) AS c FROM orders WHERE status = 'pending_payment'").get().c;
  assert.equal(pendings, 1);
  assert.equal(winner.body.data.status, 'pending_payment');
});

// QABUL MEZONI 1 (kuchaytirilgan): 6 ta alohida ulanish (worker_threads)
// bir vaqtda raqobat qiladi — baribir aynan bittasi yutadi.
test('6 ta alohida ulanish raqobatida faqat bittasi rezerv oladi', async () => {
  const only = fx.products.scarce.variants.only;
  const N = 6;

  const workers = Array.from({ length: N }, (_, i) =>
    new Promise((resolve, reject) => {
      const w = new Worker(workerPath, {
        workerData: { dbPath: s.dbPath, variantId: only.id, userId: fx.users.customer.id },
      });
      w.on('message', resolve);
      w.on('error', reject);
    })
  );

  const results = await Promise.all(workers);
  const winners = results.filter((r) => r.ok);
  const losers = results.filter((r) => !r.ok);

  assert.equal(winners.length, 1, `natijalar: ${JSON.stringify(results)}`);
  assert.equal(losers.length, N - 1);
  for (const l of losers) assert.equal(l.code, 'INSUFFICIENT_STOCK');

  const row = stockRow(only.id);
  assert.equal(row.reserved, 1);
  assert.equal(s.db.prepare('SELECT COUNT(*) AS c FROM reservations').get().c, 1);
  assert.equal(s.db.prepare("SELECT COUNT(*) AS c FROM orders").get().c, 1);
});

test('yetarli qoldiqda parallel xaridlar hammasi otadi', async () => {
  const std = fx.products.phone.variants.std; // stock 10
  const body = { items: [{ variant_id: std.id, qty: 2 }] };
  const results = await Promise.all([
    a.post('/orders', body, c1.token),
    a.post('/orders', body, c2.token),
  ]);
  for (const r of results) assert.equal(r.status, 201);
  const row = stockRow(std.id);
  assert.equal(row.qty, 10);
  assert.equal(row.reserved, 4);
});
