import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function signToken(user, extra = {}) {
  return jwt.sign({ sub: String(user.id), role: user.role, ...extra }, config.jwtSecret, { expiresIn: '7d' });
}

// Ikki bosqichli admin kirishining oraliq belgisi (10 daqiqa yashaydi).
export function signChallenge(user) {
  return jwt.sign({ sub: String(user.id), scope: 'admin_2fa' }, config.jwtSecret, {
    expiresIn: `${config.adminChallengeTtlSec}s`,
  });
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}
