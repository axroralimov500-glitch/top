# Sinov adapteri (tashqi foydalanish uchun)

Tashqi baholovchi API ni o'z skriptlaridan chaqirishi uchun yengil klient va
jonli demo. Ikki fayl, dependentlik yo'q (Node >= 18, global `fetch`).

- `api-client.mjs` — `OmborClient` klassi: auth, katalog, savat, buyurtma,
  to'lov callback (HMAC imzolash bilan). Xatolarda `ApiError(status, code, ...)` otadi.
- `demo.mjs` — uchta qabul mezonini ketma-ket bajaruvchi jonli senariy.

## Ishga tushirish

```bash
# 1) server ( alohida terminalda )
npm install
npm run migrate
npm run seed
npm run dev          # http://localhost:3000

# 2) demo ( boshqa terminalda, loyiha ildizidan )
node adapter/demo.mjs http://localhost:3000/api "dev-payment-secret-ozgartiring"
# yoki PAYMENT_SECRET env o'zgaruvchisi bilan:
PAYMENT_SECRET=... node adapter/demo.mjs
```

Demo o'z mijozlarini ro'yxatdan o'tkazadi va seed dagi `jbl-tune-520bt`
(qoldiq 1) mahsuloti ustida uchta qabul mezonini ko'rsatadi.

Klientni o'z skriptingizda:

```js
import { OmborClient } from './adapter/api-client.mjs';

const api = new OmborClient('http://localhost:3000/api');
const { token } = await api.login('aziz@example.com', 'Aziz123!');
const m = api.with(token);

const p = await m.product('iphone-15');
const order = await m.buyNow([{ variant_id: p.variants[0].id, qty: 1 }]);
await m.paymentCallback({ order }, process.env.PAYMENT_SECRET);
```

### Admin marshrutlari (ikki bosqichli kirish)

Admin tokeni faqat ikki bosqichdan keyin beriladi:

```js
const api = new OmborClient('http://localhost:3000/api');
// 1-bosqich: email + hisob paroli -> vaqtinchalik challenge
// 2-bosqich: ikkinchi (alik) parol -> haqiqiy admin tokeni (twofa=1)
const { token } = await api.adminLogin('admin@shop.uz', 'devament11', 'devament');
const A = api.with(token);
const stats = await A.me(); // yoki to'g'ridan-to'g'ri: GET /api/admin/stats
```

Ikki bosqichdan o'tmagan token (masalan `login()` orqali olingan yoki
faqat 1-bosqichdan olingan challenge) bilan `/api/admin/*` so'rovlari
server tomonda **403 ADMIN_2FA_REQUIRED** bilan rad etiladi.
Ikkinchi parol `.env` dagi `ADMIN_SECOND_PASSWORD` qiymati (standart: `devament`),
challenge muddati `ADMIN_2FA_CHALLENGE_SECONDS` (standart: 600 soniya).

Katalog qidiruvi: `api.products({ q: 'suv', sort: 'price_asc', page: 1 })`.

### Ombor: ikki rejim (partiya / faqat narx)

```js
const list = await A.adminVariants();               // variant_id, narx, qoldiq
const v = list.find((x) => x.sku === 'SUV-05L');

// 1) yangi partiya keldi — qoldiq oshadi, narx yangilanadi
await A.adminReceipt({ variant_id: v.id, warehouse_id: 1, qty: 200, unit_price: 5000, note: 'birinchi partiya' });

// 2) partiya keldi-yu narx qimmatlashdi — eski qoldiq ham 6 000 bo'ladi
await A.adminReceipt({ variant_id: v.id, warehouse_id: 1, qty: 100, unit_price: 6000, note: 'yangi partiya qimmatroq' });

// 3) partiya KELMADI, lekin narx o'zgardi — faqat narx rejimi
const r = await A.adminReprice({ variant_id: v.id, unit_price: 6500, note: 'yetkazib beruvchi narxni ko\'tardi' });
// r.repriced_units — narxi o'zgargan dona soni; inventory o'zgarmaydi

const history = await A.adminReceipts(20);          // kind: 'receipt' | 'reprice'
```

`GET /api/admin/receipts` javobidagi `kind` maydoni — `receipt` (partiya qabul
qilindi) yoki `reprice` (faqat narx). `reprice` qatorlarida `warehouse_code`
`null` bo'ladi, chunki narx variantga tegishli, bitta omborga emas.

## Chegaralar (muhim!)

1. **PAYMENT_SECRET kerak.** To'lov callback demo imzolash uchun serverdagi
   `.env` bilan bir xil sirni bilishi shart. Sirsiz faqat auth/katalog/savat/
   buyurtma/bekor qilish qismlari sinovdan o'tadi.
2. **Soxta provayder.** Haqiqiy to'lov tizimi yo'q — callback siz o'zingiz
   yuborasiz. Pullik test qilinmaydi, karta/pul oqimi yo'q.
3. **Seed ma'lumotlariga bog'liqlik.** Demo `jbl-tune-520bt` slugi va
   qoldiq=1 holatiga tayanadi. Seed qayta ishga tushirilsa idempotent
   (mavjud bo'lsa o'tkazib yuboradi), lekin mahsulot o'chirilsa demo topolmaydi.
   Demo o'zi ikki yangi mijoz yaratadi — qayta ishga tushirish xavfsiz.
4. **Parallel mezoni bir martalik.** JBL qoldig'i 1: birinchi demo ishga
   tushirilgandan keyin qoldiq tugaydi (to'lov qilingan bo'lsa) — demo qayta
   ishga tushirish uchun bazani tozalab qayta seed qilish kerak:
   `data/app.db*` fayllarini o'chirib, `npm run migrate && npm run seed`.
5. **Mahalliy HTTP.** Klient HTTPS, tokendan tashqari avtorizatsiya
   (cookie/API-key), rate-limit va retry siyosatlarini bilmaydi.
6. **TTL testlash** adapter orqali emas — rezerv muddati `.env` dagi
   `RESERVATION_TTL_SECONDS` bilan sozlanadi; avtomatik tekshiruv
   `npm test` dagi `test/expiry.test.mjs` da qisqa TTL bilan bajariladi.
7. **Vaqt sinkronizatsiyasi.** JWT 7 kun yashaydi; demo bir sessiyada
   tugashi kerak (uzoq pauzada TTL rezervlarni qaytaradi).
8. **Admin ikkinchi paroli** adapterda `adminLogin()` imzasining uchinchi
   argumenti sifatida uzatiladi — u brauzerda yoki koddan "yashirilmaydi",
   lekin serverda `ADMIN_SECOND_PASSWORD` bilan solishtiriladi. Standart
   qiymat faqat lokal uchun; sinovdan oldin `.env` da almashtirish tavsiya
   etiladi (aks holda `/api/admin/*` ga kirish qayd etilgan parol bilan ochiladi).
9. **Narx ombor bo'yicha emas, variant bo'yicha.** `POST /admin/reprice` bitta
   `product_variants.price` ni o'zgartiradi — mahsulot ikki omborga bo'lingan
   bo'lsa, ikkala ombordagi qoldiq ham yangi narxdan sotiladi. Shuning uchun
   "faqat narx" yozuvida ombor ko'rsatilmaydi (`warehouse_id = NULL`). Narxni
   alohida ombor bo'yicha saqlash talab qilingan holda `inventory` sxemasiga
   narx ustuni qo'shish va eski buyurtma nusxalarini shunga moslab o'zgartirish
   kerak bo'ladi (hozirgi versiyada bunday maydon yo'q).
10. **Qayta-narxlash tarixi taxminiy qiymat ko'rsatmaydi.** `repriced_units` —
    amal paytidagi joriy qoldiq; kirim tarixidagi `old_price`/`unit_price`
    haqiqiy, lekin "shu narxda nechta dona sotildi" hisobi qayta-narxlashdan
    keyingi savdolarni hisobga olmaydi.

