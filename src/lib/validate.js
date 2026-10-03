import { badRequest } from './errors.js';

export function requireFields(body, fields) {
  const missing = fields.filter((f) => body[f] === undefined || body[f] === null || body[f] === '');
  if (missing.length) throw badRequest(`Maydonlar to'ldirilishi shart: ${missing.join(', ')}`, { missing });
}

export function asString(value, name, { min = 1, max = 255, optional = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (optional) return undefined;
    throw badRequest(`${name} maydoni kerak`);
  }
  if (typeof value !== 'string') throw badRequest(`${name} satr bo'lishi kerak`);
  const v = value.trim();
  if (v.length < min) throw badRequest(`${name} kamida ${min} belgi bo'lishi kerak`);
  if (v.length > max) throw badRequest(`${name} ko'pi bilan ${max} belgi bo'lishi kerak`);
  return v;
}

export function asInt(value, name, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER, optional = false, def } = {}) {
  if (value === undefined || value === null || value === '') {
    if (optional) return def;
    throw badRequest(`${name} maydoni kerak`);
  }
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n)) throw badRequest(`${name} butun son bo'lishi kerak`);
  if (n < min || n > max) throw badRequest(`${name} ${min}..${max} oralig'ida bo'lishi kerak`);
  return n;
}

export function oneOf(value, name, values, { optional = false, def } = {}) {
  if (value === undefined || value === null || value === '') {
    if (optional) return def;
    throw badRequest(`${name} maydoni kerak`);
  }
  if (!values.includes(value)) throw badRequest(`${name} quyidagilardan biri bo'lishi kerak: ${values.join(', ')}`);
  return value;
}

export function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
