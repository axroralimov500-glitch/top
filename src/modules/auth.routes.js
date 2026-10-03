import { Router } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { AppError, badRequest, conflict, unauthorized, forbidden } from '../lib/errors.js';
import { isEmail, asString, requireFields } from '../lib/validate.js';
import { nowIso } from '../lib/time.js';
import { config } from '../config.js';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import { signToken, signChallenge, verifyToken } from '../auth/tokens.js';
import { requireAuth } from '../auth/middleware.js';

// Uzunlikni yashirish uchun ikkala tomonni ham hash qilib solishtiramiz.
function sameSecret(given, expected) {
  const a = createHash('sha256').update(String(given)).digest();
  const b = createHash('sha256').update(String(expected)).digest();
  return timingSafeEqual(a, b);
}

export function authRoutes(db) {
  const router = Router();
  const touchLogin = db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?');

  router.post('/register', (req, res) => {
    requireFields(req.body, ['name', 'email', 'password']);
    const name = asString(req.body.name, 'name', { min: 2, max: 80 });
    const email = asString(req.body.email, 'email', { max: 120 }).toLowerCase();
    const password = asString(req.body.password, 'password', { min: 6, max: 100 });
    if (!isEmail(email)) throw badRequest('Email formati noto‘g‘ri');

    const exists = db.prepare('SELECT 1 FROM users WHERE email = ?').get(email);
    if (exists) throw conflict('EMAIL_TAKEN', 'Bu email allaqachon ro‘yxatdan o‘tgan');

    const info = db
      .prepare('INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(name, email, hashPassword(password), 'customer', nowIso());

    const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(Number(info.lastInsertRowid));
    res.status(201).json({ data: { token: signToken(user), user } });
  });

  // Oddiy kirish — FAQAT mijozlar uchun. Admin alohida ikki bosqichli yo'ldan kiradi.
  router.post('/login', (req, res) => {
    requireFields(req.body, ['email', 'password']);
    const email = asString(req.body.email, 'email').toLowerCase();
    const password = asString(req.body.password, 'password');

    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!row || !verifyPassword(password, row.password_hash)) {
      throw unauthorized('Email yoki parol xato');
    }
    if (row.role === 'admin') {
      throw new AppError(403, 'ADMIN_LOGIN_SEPARATE', 'Admin hisobi uchun ikki bosqichli kirish sahifasidan foydalaning');
    }
    const user = { id: row.id, name: row.name, email: row.email, role: row.role };
    touchLogin.run(nowIso(), user.id);
    res.json({ data: { token: signToken(user), user } });
  });

  // 1-bosqich: email + hisob paroli. To‘g‘ri bo‘lsa vaqtinchalik challenge qaytadi,
  // hali admin token berilmaydi.
  router.post('/admin/login', (req, res) => {
    requireFields(req.body, ['email', 'password']);
    const email = asString(req.body.email, 'email').toLowerCase();
    const password = asString(req.body.password, 'password');

    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!row || !verifyPassword(password, row.password_hash)) {
      throw unauthorized('Email yoki parol xato');
    }
    if (row.role !== 'admin') throw forbidden('Bu hisob administrator emas');

    res.json({
      data: {
        step: 'second_password',
        challenge: signChallenge(row),
        expires_in: config.adminChallengeTtlSec,
        name: row.name,
      },
    });
  });

  // 2-bosqich: ikkinchi parol. Faqat shu bosqichdan keyin twofa=1 token beriladi —
  // admin marshrutlari aynan shu belgini talab qiladi.
  router.post('/admin/verify', (req, res) => {
    requireFields(req.body, ['challenge', 'second_password']);
    const challenge = asString(req.body.challenge, 'challenge', { max: 2000 });
    const second = asString(req.body.second_password, 'second_password', { max: 200 });

    let payload;
    try {
      payload = verifyToken(challenge);
    } catch {
      throw new AppError(401, 'ADMIN_CHALLENGE_INVALID', 'Sessiya muddati tugagan — kirishni boshidan boshlang');
    }
    if (payload.scope !== 'admin_2fa') throw unauthorized('Challenge noto‘g‘ri');

    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(payload.sub));
    if (!row || row.role !== 'admin') throw unauthorized('Hisob topilmadi yoki admin emas');
    if (!sameSecret(second, config.adminSecondPassword)) {
      throw new AppError(403, 'ADMIN_2FA_FAILED', 'Ikkinchi parol noto‘g‘ri');
    }

    const user = { id: row.id, name: row.name, email: row.email, role: row.role };
    touchLogin.run(nowIso(), user.id);
    res.json({ data: { token: signToken(user, { twofa: 1 }), user, twofa: true } });
  });

  router.get('/me', requireAuth, (req, res) => {
    res.json({ data: { user: req.user, twofa: Boolean(req.twofa) } });
  });

  return router;
}
