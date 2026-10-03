import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { asString, asInt, oneOf, requireFields } from '../lib/validate.js';
import { tx } from '../db/connection.js';
import { nowIso } from '../lib/time.js';
import { consumeReservations } from './orders.service.js';

// Kanonik satr: provider_payment_id|order_id|amount|status
// Imzo: HMAC-SHA256(PAYMENT_SECRET, kanonik satr), hex.
export function callbackCanonicalString({ provider_payment_id, order_id, amount, status }) {
  return `${provider_payment_id}|${order_id}|${amount}|${status}`;
}

export function signCallback(secret, payload) {
  return createHmac('sha256', secret).update(callbackCanonicalString(payload)).digest('hex');
}

export function verifyCallbackSignature(secret, payload, signature) {
  const expected = Buffer.from(signCallback(secret, payload), 'hex');
  const given = Buffer.from(String(signature || ''), 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Soxta provayder uchun yangi to'lov identifikatori.
export function newProviderPaymentId() {
  return `pp_${randomUUID().replace(/-/g, '')}`;
}

function parseCallbackBody(body) {
  requireFields(body, ['provider_payment_id', 'order_id', 'amount', 'status', 'signature']);
  return {
    provider_payment_id: asString(body.provider_payment_id, 'provider_payment_id', { max: 100 }),
    order_id: asInt(body.order_id, 'order_id', { min: 1 }),
    amount: asInt(body.amount, 'amount', { min: 0 }),
    status: oneOf(body.status, 'status', ['succeeded', 'failed']),
    signature: asString(body.signature, 'signature', { max: 128 }),
  };
}

// Callback markaziy nuqta. Qaytaradi: { http, body } — marshrut shuni yuboradi.
//
// Idempotentlik: provider_payment_id — UNIQUE. Takroriy callback hech qanday
// to'lov yozuvi yoki qoldiq o'zgarishini qayta yaratmaydi.
export function processCallback(db, secret, rawBody) {
  const payload = parseCallbackBody(rawBody);
  if (!verifyCallbackSignature(secret, payload, payload.signature)) {
    return { http: 401, body: { error: { code: 'INVALID_SIGNATURE', message: 'Callback imzosi noto‘g‘ri' } } };
  }

  return tx(db, () => {
    const existing = db
      .prepare('SELECT * FROM payments WHERE provider_payment_id = ?')
      .get(payload.provider_payment_id);
    if (existing) {
      const order = db.prepare('SELECT id, status, total FROM orders WHERE id = ?').get(existing.order_id);
      return {
        http: 200,
        body: {
          data: {
            result: 'already_processed',
            payment: { id: existing.id, status: existing.status, reason: existing.reason },
            order_id: existing.order_id,
            order_status: order?.status ?? null,
          },
        },
      };
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(payload.order_id);
    if (!order) {
      return { http: 404, body: { error: { code: 'ORDER_NOT_FOUND', message: 'Buyurtma topilmadi' } } };
    }

    const now = nowIso();

    if (payload.status === 'succeeded') {
      if (order.status !== 'pending_payment') {
        const info = db
          .prepare("INSERT INTO payments (order_id, provider_payment_id, amount, status, reason, created_at) VALUES (?, ?, ?, 'rejected', ?, ?)")
          .run(order.id, payload.provider_payment_id, payload.amount, `order_${order.status}`, now);
        return {
          http: 409,
          body: {
            error: {
              code: 'ORDER_NOT_PAYABLE',
              message: `Buyurtma to'lanadigan holatda emas (${order.status})`,
              details: { order_status: order.status, payment_id: Number(info.lastInsertRowid) },
            },
          },
        };
      }

      if (payload.amount !== order.total) {
        const info = db
          .prepare("INSERT INTO payments (order_id, provider_payment_id, amount, status, reason, created_at) VALUES (?, ?, ?, 'rejected', 'amount_mismatch', ?)")
          .run(order.id, payload.provider_payment_id, payload.amount, now);
        return {
          http: 409,
          body: {
            error: {
              code: 'AMOUNT_MISMATCH',
              message: 'To‘lov summasi buyurtma summasiga teng emas',
              details: { expected: order.total, received: payload.amount, payment_id: Number(info.lastInsertRowid) },
            },
          },
        };
      }

      // partial UNIQUE index (order_id WHERE status='succeeded')
      // bir buyurtmaga ikkinchi muvaffaqiyatli to'lovni taqiqlaydi.
      const info = db
        .prepare("INSERT INTO payments (order_id, provider_payment_id, amount, status, created_at) VALUES (?, ?, ?, 'succeeded', ?)")
        .run(order.id, payload.provider_payment_id, payload.amount, now);
      db.prepare("UPDATE orders SET status = 'paid', paid_at = ? WHERE id = ?").run(now, order.id);
      consumeReservations(db, order.id);

      return {
        http: 200,
        body: {
          data: {
            result: 'paid',
            payment_id: Number(info.lastInsertRowid),
            order_id: order.id,
            order_status: 'paid',
          },
        },
      };
    }

    // failed hodisasi: holat o'zgarmaydi, qoldiq bandlanganicha qoladi.
    const info = db
      .prepare("INSERT INTO payments (order_id, provider_payment_id, amount, status, reason, created_at) VALUES (?, ?, ?, 'rejected', 'provider_failed', ?)")
      .run(order.id, payload.provider_payment_id, payload.amount, now);
    return {
      http: 200,
      body: {
        data: {
          result: 'failed_recorded',
          payment_id: Number(info.lastInsertRowid),
          order_id: order.id,
          order_status: order.status,
        },
      },
    };
  });
}
