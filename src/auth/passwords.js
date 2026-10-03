import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEYLEN = 64;

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, KEYLEN).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [alg, salt, hash] = String(stored).split(':');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const calc = scryptSync(password, salt, KEYLEN);
  const orig = Buffer.from(hash, 'hex');
  return calc.length === orig.length && timingSafeEqual(calc, orig);
}
