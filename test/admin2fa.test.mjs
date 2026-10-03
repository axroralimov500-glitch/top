import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers/test-server.mjs';
import { api, login, adminLogin, register, ADMIN_SECOND_PASSWORD } from './helpers/api.mjs';
import { seedFixtures } from './helpers/fixtures.mjs';

// Admin — alohida ikki bosqichli kirish. Bu qoida SERVER da tekshiriladi.
let s, a, fx;

beforeEach(async () => {
  s = await startTestServer();
  fx = seedFixtures(s.db);
  a = api(s.baseUrl);
});

afterEach(async () => {
  await s.close();
});

test('admin oddiy /auth/login orqali kira olmaydi', async () => {
  const res = await a.post('/auth/login', { email: 'admin@test.uz', password: 'AdminPass1' });
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'ADMIN_LOGIN_SEPARATE');
});

test('1-bosqich token bermaydi — faqat challenge qaytadi', async () => {
  const res = await a.post('/auth/admin/login', { email: 'admin@test.uz', password: 'AdminPass1' });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.step, 'second_password');
  assert.ok(res.body.data.challenge.length > 20);
  assert.equal(res.body.data.token, undefined);
});

test('1-bosqichda xato parol 401, mijoz uchun 403', async () => {
  const bad = await a.post('/auth/admin/login', { email: 'admin@test.uz', password: 'Xato' });
  assert.equal(bad.status, 401);

  const notAdmin = await a.post('/auth/admin/login', { email: 'c1@test.uz', password: 'CustPass1' });
  assert.equal(notAdmin.status, 403);
});

test('2-bosqich: noto‘g‘ri ikkinchi parol 403, to‘g‘risi admin token beradi', async () => {
  const first = await a.post('/auth/admin/login', { email: 'admin@test.uz', password: 'AdminPass1' });
  const challenge = first.body.data.challenge;

  const wrong = await a.post('/auth/admin/verify', { challenge, second_password: 'boshqa-parol' });
  assert.equal(wrong.status, 403);
  assert.equal(wrong.body.error.code, 'ADMIN_2FA_FAILED');

  const ok = await a.post('/auth/admin/verify', { challenge, second_password: ADMIN_SECOND_PASSWORD });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.twofa, true);

  const me = await a.get('/auth/me', ok.body.data.token);
  assert.equal(me.body.data.twofa, true);

  const created = await a.post('/admin/categories', { name: 'Ikki bosqich' }, ok.body.data.token);
  assert.equal(created.status, 201);
});

test('challenge bo‘lmasa yoki noto‘g‘ri bo‘lsa 2-bosqich 401', async () => {
  const missing = await a.post('/auth/admin/verify', { second_password: ADMIN_SECOND_PASSWORD });
  assert.equal(missing.status, 400);

  const junk = await a.post('/auth/admin/verify', { challenge: 'sal.to.noto', second_password: ADMIN_SECOND_PASSWORD });
  assert.equal(junk.status, 401);
});

test('mijoz tokeni admin API ga kira olmaydi (twofa belgisi yo‘q)', async () => {
  const c1 = await login(a, 'c1@test.uz', 'CustPass1');
  const res = await a.get('/admin/stats', c1.token);
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN');
});

test('to‘liq kirishdan keyin dashboard statistikasi ishlaydi', async () => {
  const admin = await adminLogin(a, 'admin@test.uz', 'AdminPass1');
  const res = await a.get('/admin/stats', admin.token);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.kpi.customers, 2);
  assert.ok(Array.isArray(res.body.data.activity));
  assert.equal(res.body.data.lastLogin !== null, true);
});
