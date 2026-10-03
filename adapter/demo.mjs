// Tashqi foydalanuvchi uchun jonli demo: uchta qabul mezonini HTTP orqali ko'rsatadi.
// Ishga tushirish: server ishlab turishi kerak (npm run dev), keyin:
//   node adapter/demo.mjs [baseUrl] [PAYMENT_SECRET]
import { OmborClient } from './api-client.mjs';

const baseUrl = process.argv[2] ?? 'http://localhost:3000/api';
const paymentSecret = process.argv[3] ?? process.env.PAYMENT_SECRET;
if (!paymentSecret) {
  console.error("XATO: PAYMENT_SECRET topilmadi — to'lov callbackni imzolash uchun u serverdagi .env bilan bir xil bo'lishi shart.");
  console.error('  node adapter/demo.mjs http://localhost:3000/api "<PAYMENT_SECRET>"');
  console.error('  yoki: PAYMENT_SECRET=... node adapter/demo.mjs');
  process.exit(1);
}

const say = (t) => console.log(`\n=== ${t} ===`);
const show = (v) => console.log(typeof v === 'string' ? v : JSON.stringify(v, null, 2));

const assert = (cond, msg) => {
  if (!cond) {
    console.error(`XATO: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`OK: ${msg}`);
  }
};

// Seed qilingan demo ma'lumotlariga tayanadi (npm run seed):
// jbl-tune-520bt — qoldiq 1, max_purchase_qty 1.
const base = new OmborClient(baseUrl);
const a = await base.register('Demo Bir', `demo1-${Date.now()}@example.com`, 'Demo123!');
const b = await base.register('Demo Ikki', `demo2-${Date.now()}@example.com`, 'Demo123!');
const A = base.with(a.token);
const B = base.with(b.token);

say('1. Katalog: qoldiq 1 bo‘lgan mahsulot');
const jbl = await A.product('jbl-tune-520bt');
show(`${jbl.name}: available_stock=${jbl.available_stock}, max_purchase_qty=${jbl.max_purchase_qty}`);
if (jbl.available_stock < 1) {
  console.error('\nXATO: bu mahsulotning qoldig‘i tugagan — demo uchun kamida 1 dona kerak.');
  console.error('Bazani tozalab qayta seed qiling: data/app.db* fayllarini o‘chiring, keyin:');
  console.error('  npm run migrate && npm run seed');
  process.exit(1);
}

say('2. QABUL MEZONI 1: ikki parallel xarid — faqat bittasi rezerv oladi');
const items = [{ variant_id: jbl.variants[0].id, qty: 1 }];
const [r1, r2] = await Promise.allSettled([A.buyNow(items), B.buyNow(items)]);
const results = [r1, r2];
const oks = results.filter((r) => r.status === 'fulfilled');
const fails = results.filter((r) => r.status === 'rejected');
assert(oks.length === 1 && fails.length === 1,
  `natija: ${oks.length} muvaffaqiyatli, ${fails.length} rad (${fails[0]?.reason?.code})`);

const winner = oks[0].value;
show({ id: winner.id, status: winner.status, total: winner.total, items: winner.items });

say('3. Narx nusxasi buyurtmada muzlatilgan');
const mine = await A.order(winner.id);
show({ unit_price: mine.items[0].unit_price, line_total: mine.items[0].line_total, order_total: mine.total });
const cart = await A.cart();
show(`buyurtmadan keyin savat elementlari: ${cart.items.length}`);

say('4. QABUL MEZONI 2: to‘lov callback + takroriy callback idempotent');
const ppid = `pp_demo_${Date.now()}`;
const pay1 = await A.paymentCallback({ order: winner, providerPaymentId: ppid }, paymentSecret);
const pay2 = await A.paymentCallback({ order: winner, providerPaymentId: ppid }, paymentSecret);
show({ birinchi: pay1.result, takroriy: pay2.result });
assert(pay1.result === 'paid' && pay2.result === 'already_processed',
  'takroriy callback hech narsani takrorlamadi');

const afterPay = await A.order(winner.id);
const stockAfter = await A.product('jbl-tune-520bt');
assert(afterPay.status === 'paid', 'buyurtma paid holatida');
assert(stockAfter.available_stock === 0, 'qoldiq 0 — rezerv bir marta yechildi');

say('5. QABUL MEZONI 3: bekor qilish faqat bir marta, qayta ochish yo‘q');
const lateCancel = await A.cancelOrder(winner.id).catch((e) => e);
assert(lateCancel.code === 'ORDER_NOT_CANCELLABLE', `tolangan buyurtma bekor qilinmaydi (${lateCancel.code})`);

const nextBuy = await B.buyNow(items).catch((e) => e);
show(`yangi xarid urinishi: ${nextBuy.code} — qoldiq tugagan (kutilgan)`);

console.log('\nDemo tugadi.');
