import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers/test-server.mjs';
import { api, login, adminLogin } from './helpers/api.mjs';
import { seedFixtures } from './helpers/fixtures.mjs';

// Kirim (omborga qabul) + qayta-narxlash: yangi partiya kelganda narx o'zgarsa,
// eski qoldiq ham yangi narxga o'tadi.
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

async function inv(variantId) {
  const res = await a.get(`/admin/inventory?variant_id=${variantId}`, admin.token);
  return res.body.data;
}

test('kirim: qoldiq oshadi va eski qoldiq ham yangi narxga o‘tadi', async () => {
  const v = fx.products.phone.variants.std; // TX-STD, narx 1 000 000, omborda 10 dona
  const before = await inv(v.id);
  assert.equal(before[0].quantity, 10);
  assert.equal(v.price, 1000000);

  // 2-kun: narx 6000 ga chiqdi, yana 200 dona keldi
  const res = await a.post(
    '/admin/receipts',
    { variant_id: v.id, warehouse_id: fx.whMain, qty: 200, unit_price: 6000, note: 'narx ko‘tarildi' },
    admin.token
  );
  assert.equal(res.status, 201);
  assert.equal(res.body.data.receipt.old_price, 1000000);
  assert.equal(res.body.data.receipt.unit_price, 6000);
  assert.equal(res.body.data.inventory.quantity, 210); // 10 + 200
  assert.equal(res.body.data.variant.price, 6000);

  // Butun qoldiq (eski + yangi) endi yangi narxda — katalog shuni ko‘rsatadi
  const after = await inv(v.id);
  assert.equal(after[0].quantity, 210);
  const product = await a.get('/products/telefon-x');
  assert.equal(product.body.data.variants.find((x) => x.id === v.id).price, 6000);
});

test('kirim: mavjud qoldiq bo‘lmasa — yangi inventory yozuvi yaratiladi', async () => {
  const v = fx.products.phone.variants.pro; // TX-PRO whMain=4, whSecond=6
  const res = await a.post(
    '/admin/receipts',
    { variant_id: v.id, warehouse_id: fx.whSecond, qty: 50, unit_price: 2500000 },
    admin.token
  );
  assert.equal(res.status, 201);
  assert.equal(res.body.data.inventory.quantity, 56); // 6 + 50
});

test('kirim tarixi GET /admin/receipts orqali qaytadi', async () => {
  const v = fx.products.phone.variants.std;
  await a.post('/admin/receipts', { variant_id: v.id, warehouse_id: fx.whMain, qty: 100, unit_price: 6000 }, admin.token);
  await a.post('/admin/receipts', { variant_id: v.id, warehouse_id: fx.whMain, qty: 100, unit_price: 7000 }, admin.token);

  const res = await a.get(`/admin/receipts?variant_id=${v.id}`, admin.token);
  assert.equal(res.status, 200);
  const rows = res.body.data;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].unit_price, 7000); // eng yangi tepada
  assert.equal(rows[0].old_price, 6000);
});

test('kirim: narx o‘zgarmasa ham old_price yoziladi va qoldiq oshadi', async () => {
  const v = fx.products.phone.variants.std;
  const res = await a.post('/admin/receipts', { variant_id: v.id, warehouse_id: fx.whMain, qty: 5, unit_price: 1000000 }, admin.token);
  assert.equal(res.status, 201);
  assert.equal(res.body.data.receipt.old_price, 1000000);
  assert.equal(res.body.data.receipt.unit_price, 1000000);
  assert.equal(res.body.data.inventory.quantity, 15);
});

test('kirim validatsiya: noto‘g‘ri qty / narx / maydonlar 400', async () => {
  const v = fx.products.phone.variants.std;
  const cases = [
    { variant_id: v.id, warehouse_id: fx.whMain, qty: 0, unit_price: 6000 },
    { variant_id: v.id, warehouse_id: fx.whMain, qty: -5, unit_price: 6000 },
    { variant_id: v.id, warehouse_id: fx.whMain, qty: 2.5, unit_price: 6000 },
    { variant_id: v.id, warehouse_id: fx.whMain, qty: 10, unit_price: -1 },
    { variant_id: v.id, warehouse_id: fx.whMain, qty: 10 }, // unit_price yo‘q
  ];
  for (const body of cases) {
    const res = await a.post('/admin/receipts', body, admin.token);
    assert.equal(res.status, 400, JSON.stringify(body));
  }
});

test('kirim: mavjud bo‘lmagan variant / ombor 404', async () => {
  const badV = await a.post('/admin/receipts', { variant_id: 999999, warehouse_id: fx.whMain, qty: 1, unit_price: 100 }, admin.token);
  assert.equal(badV.status, 404);
  const badW = await a.post('/admin/receipts', { variant_id: fx.products.phone.variants.std.id, warehouse_id: 999999, qty: 1, unit_price: 100 }, admin.token);
  assert.equal(badW.status, 404);
});

test('mijoz kiral olmaydi (403) va adminsiz 401', async () => {
  const v = fx.products.phone.variants.std;
  const asCust = await a.post('/admin/receipts', { variant_id: v.id, warehouse_id: fx.whMain, qty: 1, unit_price: 100 }, c1.token);
  assert.equal(asCust.status, 403);
  const noAuth = await a.post('/admin/receipts', { variant_id: v.id, warehouse_id: fx.whMain, qty: 1, unit_price: 100 });
  assert.equal(noAuth.status, 401);
});

test('qayta-narxlash eski buyurtma narx nusxasini o‘zgartirmaydi', async () => {
  const v = fx.products.phone.variants.std; // 1 000 000
  const order = await a.post('/orders', { items: [{ variant_id: v.id, qty: 2 }] }, c1.token);
  assert.equal(order.status, 201);
  assert.equal(order.body.data.total, 2000000);

  // Narx 6000 ga chiqdi
  await a.post('/admin/receipts', { variant_id: v.id, warehouse_id: fx.whMain, qty: 100, unit_price: 6000 }, admin.token);

  const old = await a.get(`/orders/${order.body.data.id}`, c1.token);
  assert.equal(old.body.data.total, 2000000, 'eski buyurtma summasi o‘zgarmasligi kerak');

  const newOrder = await a.post('/orders', { items: [{ variant_id: v.id, qty: 1 }] }, c1.token);
  assert.equal(newOrder.status, 201);
  assert.equal(newOrder.body.data.total, 6000, 'yangi buyurtma yangi narxda');
});

// ---------- Faqat narxni yangilash (reprice) ----------

test('reprice: partiya kelmaydi, lekin butun qoldiq yangi narxga o‘tadi', async () => {
  const v = fx.products.phone.variants.std; // 1 000 000, omborda 10 dona
  const before = await inv(v.id);
  assert.equal(before[0].quantity, 10);

  const res = await a.post('/admin/reprice', { variant_id: v.id, unit_price: 6000, note: 'narx ko‘tarildi' }, admin.token);
  assert.equal(res.status, 201);
  assert.equal(res.body.data.variant.price, 6000);
  assert.equal(res.body.data.receipt.qty, 0);
  assert.equal(res.body.data.receipt.old_price, 1000000);
  assert.equal(res.body.data.receipt.unit_price, 6000);
  assert.equal(res.body.data.repriced_units, 10);

  // Qoldiq o‘zgarmadi
  const after = await inv(v.id);
  assert.equal(after[0].quantity, 10);

  // Katalog yangi narxni ko‘rsatadi — eski partiya ham 6 000 da
  const product = await a.get('/products/telefon-x');
  assert.equal(product.body.data.variants.find((x) => x.id === v.id).price, 6000);
});

test('reprice: narx tarixida "faqat narx" yozuvi sifatida ko‘rinadi', async () => {
  const v = fx.products.phone.variants.std;
  await a.post('/admin/receipts', { variant_id: v.id, warehouse_id: fx.whMain, qty: 100, unit_price: 6000 }, admin.token);
  await a.post('/admin/reprice', { variant_id: v.id, unit_price: 7000 }, admin.token);

  const rows = (await a.get(`/admin/receipts?variant_id=${v.id}`, admin.token)).body.data;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].kind, 'reprice');
  assert.equal(rows[0].qty, 0);
  assert.equal(rows[0].warehouse_code, null);
  assert.equal(rows[1].kind, 'receipt');
  assert.equal(rows[1].warehouse_code, 'WH-MAIN');
});

test('reprice: qayta-narxlangan narx ham eski buyurtmaga tegizmaydi', async () => {
  const v = fx.products.phone.variants.std;
  const order = await a.post('/orders', { items: [{ variant_id: v.id, qty: 3 }] }, c1.token);
  assert.equal(order.body.data.total, 3000000);

  const reprice = await a.post('/admin/reprice', { variant_id: v.id, unit_price: 1200000 }, admin.token);
  assert.equal(reprice.status, 201);

  const old = await a.get(`/orders/${order.body.data.id}`, c1.token);
  assert.equal(old.body.data.total, 3000000, 'narx nusxasi muzlangan');

  const fresh = await a.post('/orders', { items: [{ variant_id: v.id, qty: 1 }] }, c1.token);
  assert.equal(fresh.body.data.total, 1200000);
});

test('reprice validatsiya: bir xil narx / noto‘g‘ri qiymat 400, variant 404', async () => {
  const v = fx.products.phone.variants.std; // 1 000 000
  const cases = [
    { variant_id: v.id, unit_price: 1000000 }, // o‘zgarish yo‘q
    { variant_id: v.id, unit_price: -5 },
    { variant_id: v.id, unit_price: 6000.5 },
    { variant_id: v.id }, // maydon yo‘q
  ];
  for (const body of cases) {
    const res = await a.post('/admin/reprice', body, admin.token);
    assert.equal(res.status, 400, JSON.stringify(body));
  }
  const missing = await a.post('/admin/reprice', { variant_id: 999999, unit_price: 6000 }, admin.token);
  assert.equal(missing.status, 404);

  const price = await a.get('/products/telefon-x');
  assert.equal(price.body.data.variants.find((x) => x.id === v.id).price, 1000000, 'xato urinishlar narxni buzmasligi kerak');
});

test('reprice: mijoz kiral olmaydi (403), token siz 401', async () => {
  const v = fx.products.phone.variants.std;
  const asCust = await a.post('/admin/reprice', { variant_id: v.id, unit_price: 6000 }, c1.token);
  assert.equal(asCust.status, 403);
  const noAuth = await a.post('/admin/reprice', { variant_id: v.id, unit_price: 6000 });
  assert.equal(noAuth.status, 401);
});
