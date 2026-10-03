import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers/test-server.mjs';
import { api, register, login } from './helpers/api.mjs';

let ctx, app;

beforeEach(async () => {
  ctx = await startTestServer();
  app = api(ctx.baseUrl);
});

afterEach(async () => {
  if (ctx) await ctx.close();
});

test('register: yangi mijoz yaratadi va token qaytaradi', async () => {
  const { status, body } = await app.post('/auth/register', {
    name: 'Yangi Mijoz', email: 'new@x.uz', password: 'Parol123',
  });
  assert.equal(status, 201);
  assert.equal(body.data.user.role, 'customer');
  assert.ok(body.data.token.length > 20);

  const me = await app.get('/auth/me', body.data.token);
  assert.equal(me.status, 200);
  assert.equal(me.body.data.user.email, 'new@x.uz');
});

test('register: takroriy email 409', async () => {
  await register(app, 'Bir', 'dup@x.uz', 'Parol123');
  const { status, body } = await app.post('/auth/register', { name: 'Ikki', email: 'dup@x.uz', password: 'Parol123' });
  assert.equal(status, 409);
  assert.equal(body.error.code, 'EMAIL_TAKEN');
});

test('login: to‘g‘ri / xato parol', async () => {
  await register(app, 'Aziz', 'a@x.uz', 'Parol123');
  const ok = await login(app, 'a@x.uz', 'Parol123');
  assert.ok(ok.token);

  const bad = await app.post('/auth/login', { email: 'a@x.uz', password: 'XatoParol' });
  assert.equal(bad.status, 401);
});

test('token bo‘lmaganicha /auth/me 401', async () => {
  const { status } = await app.get('/auth/me');
  assert.equal(status, 401);
});

test('noto‘g‘ri token 401', async () => {
  const { status } = await app.get('/auth/me', 'not.a.token');
  assert.equal(status, 401);
});

test('mijoz admin marshrutiga kira olmaydi (server tomonda tekshiriladi)', async () => {
  const { token } = await register(app, 'Mijoz', 'm@x.uz', 'Parol123');
  const { status, body } = await app.post('/admin/categories', { name: 'X' }, token);
  assert.equal(status, 403);
  assert.equal(body.error.code, 'FORBIDDEN');
});

test('adminsiz admin marshruti 401', async () => {
  const { status } = await app.post('/admin/categories', { name: 'X' });
  assert.equal(status, 401);
});
