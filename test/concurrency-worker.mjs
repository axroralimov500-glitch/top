import { parentPort, workerData } from 'node:worker_threads';
import { openDb } from '../src/db/connection.js';
import { createOrder } from '../src/modules/orders.service.js';

// Har bir ishchi o'z alohida DB ulanishini ochadi va qoldiq 1 variantga
// buyurtma beradi. Natija: { ok, orderId?, code? }
const db = openDb(workerData.dbPath);
try {
  const order = createOrder(db, workerData.userId, {
    items: [{ variant_id: workerData.variantId, qty: 1 }],
  });
  parentPort.postMessage({ ok: true, orderId: order.id });
} catch (err) {
  parentPort.postMessage({ ok: false, code: err.code ?? err.name, message: err.message });
} finally {
  db.close();
}
