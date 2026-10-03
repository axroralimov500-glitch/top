import { sweepExpiredOrders } from './modules/orders.service.js';

// Rezerv muddati tugagan buyurtmalarni davriy tozalaydi.
// Marshrutlar ham lazviy tozalashni chaqiradi — test/himoya uchun aniq natija.
export function startSweeper(db, intervalSec, onRelease) {
  const tick = () => {
    try {
      const released = sweepExpiredOrders(db);
      if (released > 0 && onRelease) onRelease(released);
    } catch (err) {
      console.error('[sweeper] xato:', err.message);
    }
  };
  tick();
  const timer = setInterval(tick, Math.max(1, intervalSec) * 1000);
  return () => clearInterval(timer);
}
