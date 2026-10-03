import { AppError, unauthorized, forbidden } from '../lib/errors.js';
import { verifyToken } from './tokens.js';

function extractToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

// Tokenni tekshiradi va foydalanuvchini bazadan yangilab req.user ga qo'yadi.
// Rol bazadan olinadi — token ichidagi eskirgan rolga ishonmaymiz.
export function attachUser(db) {
  const findUser = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?');
  return (req, res, next) => {
    req.user = null;
    req.twofa = false;
    const token = extractToken(req);
    if (!token) return next();
    try {
      const payload = verifyToken(token);
      req.user = findUser.get(Number(payload.sub)) ?? null;
      req.twofa = req.user ? payload.twofa === 1 : false;
    } catch {
      req.user = null;
    }
    next();
  };
}

export function requireAuth(req, res, next) {
  if (!req.user) throw unauthorized('Bearer token kerak');
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) throw unauthorized('Bearer token kerak');
  if (req.user.role !== 'admin') throw forbidden('Bu amal faqat administrator uchun');
  if (!req.twofa) {
    throw new AppError(403, 'ADMIN_2FA_REQUIRED', 'Admin API ga faqat ikki bosqichli kirish (/auth/admin/verify) tokeni kira oladi');
  }
  next();
}
