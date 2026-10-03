import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers/test-server.mjs';
import { api, adminLogin } from './helpers/api.mjs';
import { seedFixtures } from './helpers/fixtures.mjs';

let ctx, app, fx;

beforeEach(async () => {
  ctx = await startTestServer();
  app = api(ctx.baseUrl);
  fx = seedFixtures(ctx.db);
});

afterEach(async () => {
  if (ctx) await ctx.close();
});

test('ro‘yxat: sahifalash va meta', async () => {
  // yana 3 mahsulot qo'shamiz
  const { token } = await loginAsAdmin();
  for (const n of ['P1', 'P2', 'P3']) {
    await app.post('/admin/products', { category_id: fx.catId, name: n }, token);
  }
  const { status, body } = await app.get('/products?page=1&limit=3');
  assert.equal(status, 200);
  assert.equal(body.data.length, 3);
  assert.equal(body.meta.total, 7);
  assert.equal(body.meta.total_pages, 3);

  const page3 = await app.get('/products?page=3&limit=3');
  assert.equal(page3.body.data.length, 1);
});

test('kategoriya filtri', async () => {
  const { token } = await loginAsAdmin();
  const other = await app.post('/admin/categories', { name: 'Boshqa' }, token);
  await app.post('/admin/products', { category_id: other.body.data.id, name: 'Boshqa mahsulot' }, token);

  const { body } = await app.get('/products?category=boshqa');
  assert.equal(body.meta.total, 1);
  assert.equal(body.data[0].category_slug, 'boshqa');
});

test('narx bo‘yicha saralash: price_asc va price_desc', async () => {
  const asc = await app.get('/products?sort=price_asc&limit=50');
  const pricesAsc = asc.body.data.map((p) => p.min_price);
  assert.deepEqual([...pricesAsc].sort((a, b) => a - b), pricesAsc);

  const desc = await app.get('/products?sort=price_desc&limit=50');
  const pricesDesc = desc.body.data.map((p) => p.min_price);
  assert.deepEqual([...pricesDesc].sort((a, b) => b - a), pricesDesc);
  assert.equal(pricesAsc[0], pricesDesc[pricesDesc.length - 1]);
});

test('qoldiq ko‘rinadi va rezerv hisobga olinadi', async () => {
  const { token } = await loginAsCustomer();
  // scarce product qoldig'i 1
  const before = await app.get('/products?category=test-kat&limit=50');
  const scarce = before.body.data.find((p) => p.slug === 'kam-qoldiq');
  assert.equal(scarce.available_stock, 1);

  const order = await app.post('/orders', { items: [{ variant_id: fx.products.scarce.variants.only.id, qty: 1 }] }, token);
  assert.equal(order.status, 201);

  const after = await app.get('/products?category=test-kat&limit=50');
  const scarceAfter = after.body.data.find((p) => p.slug === 'kam-qoldiq');
  assert.equal(scarceAfter.available_stock, 0);
});

test('mahsulot tafsiloti: variantlar, qoldiq, max_purchase_qty', async () => {
  const { body } = await app.get(`/products/${fx.products.limited.id}`);
  assert.equal(body.data.max_purchase_qty, 2);
  assert.equal(body.data.variants.length, 1);
  assert.equal(body.data.variants[0].available_stock, 20);
  assert.equal(body.data.variants[0].sku, 'LM-1');
});

test('qidiruv: nom bo‘yicha qismiy moslik (q parametri)', async () => {
  const { token } = await loginAsAdmin();
  await app.post('/admin/products', { category_id: fx.catId, name: 'Chiroq lampa' }, token);

  const hit = await app.get('/products?q=lamp');
  assert.equal(hit.status, 200);
  assert.equal(hit.body.meta.total, 1);
  assert.equal(hit.body.data[0].name, 'Chiroq lampa');

  const none = await app.get('/products?q=undaymahsulot');
  assert.equal(none.body.meta.total, 0);
});

test('nodan mahsulot 404', async () => {
  const { status } = await app.get('/products/bunday-mahsulot-yuq');
  assert.equal(status, 404);
});

async function loginAsAdmin() {
  return { token: (await adminLogin(app, 'admin@test.uz', 'AdminPass1')).token };
}

async function loginAsCustomer() {
  const { status, body } = await app.post('/auth/login', { email: 'c1@test.uz', password: 'CustPass1' });
  assert.equal(status, 200);
  return { token: body.data.token };
}
