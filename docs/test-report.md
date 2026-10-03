# Test hisoboti

- Sana: 2026-10-03T13:13:09.638Z
- Node.js: v24.18.0 (win32-x64)
- Buyruq: `npm run test:report` (node --test --test-reporter=tap test/*.test.mjs)
- Yakuniy holat: **MUVAFFAQIYATLI**

## Xulosa

| Ko'rsatkich | Qiymat |
|---|---|
| Jami testlar | 78 |
| Muvaffaqiyatli | 78 |
| Muvaffaqiyatsiz | 0 |
| O'tkazib yuborilgan | 0 |

Qamrov asosiy biznes qoidalarini berkitadi:

1. **Parallel rezerv** — qoldiq 1 bo'lganda ikki parallel HTTP xarid va 6 ta
   alohida DB ulanish (worker_threads) raqobatida aynan bittasi rezerv oladi
   (test/concurrency.test.mjs).
2. **Callback idempotentligi** — takroriy callback to'lov yozuvini ham,
   qoldiq yechishni ham takrorlamaydi (test/payments.test.mjs).
3. **Faqat bir marta bekor qilish** — ikkinchi bekor 409, PATCH orqali
   qayta ochish 409 ORDER_STATUS_IMMUTABLE (test/cancel.test.mjs).
4. Rezerv TTL tugashi va kechikkan to'lov rad etilishi (test/expiry.test.mjs).
5. Narx nusxasi buyurtmada muzlatiladi (test/orders.test.mjs).
6. max_purchase_qty savat va buyurtmada (test/maxqty.test.mjs).
7. Rollar: mijoz admin marshrutlariga kira olmaydi (test/auth.test.mjs).
8. Kirim + qayta-narxlash: yangi partiya eski qoldiq narxini ham yangilaydi,
   tarix yoziladi, lekin eski buyurtma narx nusxasi o'zgarmaydi
   (test/receipts.test.mjs).
9. **Ikki bosqichli admin kirishi** — admin /auth/login da rad etiladi,
   1-bosqich challenge token bermaydi, ikkinchi parol xato bo'lsa 403,
   twofa belgisisiz token /admin/* ga kira olmaydi, eskigan challenge 401
   (test/admin2fa.test.mjs).
10. Katalog qidiruvi — GET /products?q= nom bo'yicha qismiy moslikni
    qaytaradi, mos bo'lmasa 0 natija (test/catalog.test.mjs).
11. **Faqat narxni o'zgartirish** (POST /admin/reprice) — partiya kelmaydi,
    qoldiq o'zgarmaydi, lekin butun mavjud qoldiq (eski partiya ham) yangi
    narxda sotiladi; tarixda "faqat narx" (kind='reprice', omborsiz) qator
    bo'ladi; eski buyurtma narx nusxasi o'zgarmaydi; bir xil narx / noto'g'ri
    qiymat 400, variant yo'q bo'lsa 404, mijoz 403, token siz 401
    (test/receipts.test.mjs).

## To'liq TAP natijasi

```tap
TAP version 13
# [ogoh]: .env dagi standart sirlar ishlatilmoqda — faqat lokal/dev uchun.
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: admin oddiy /auth/login orqali kira olmaydi
ok 1 - admin oddiy /auth/login orqali kira olmaydi
  ---
  duration_ms: 992.0234
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: 1-bosqich token bermaydi — faqat challenge qaytadi
ok 2 - 1-bosqich token bermaydi — faqat challenge qaytadi
  ---
  duration_ms: 780.2047
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: 1-bosqichda xato parol 401, mijoz uchun 403
ok 3 - 1-bosqichda xato parol 401, mijoz uchun 403
  ---
  duration_ms: 781.4154
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: 2-bosqich: noto‘g‘ri ikkinchi parol 403, to‘g‘risi admin token beradi
ok 4 - 2-bosqich: noto‘g‘ri ikkinchi parol 403, to‘g‘risi admin token beradi
  ---
  duration_ms: 667.846
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: challenge bo‘lmasa yoki noto‘g‘ri bo‘lsa 2-bosqich 401
ok 5 - challenge bo‘lmasa yoki noto‘g‘ri bo‘lsa 2-bosqich 401
  ---
  duration_ms: 410.0051
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: mijoz tokeni admin API ga kira olmaydi (twofa belgisi yo‘q)
ok 6 - mijoz tokeni admin API ga kira olmaydi (twofa belgisi yo‘q)
  ---
  duration_ms: 546.2903
  type: 'test'
  ...
# Subtest: to‘liq kirishdan keyin dashboard statistikasi ishlaydi
ok 7 - to‘liq kirishdan keyin dashboard statistikasi ishlaydi
  ---
  duration_ms: 464.5967
  type: 'test'
  ...
# [ogoh]: .env dagi standart sirlar ishlatilmoqda — faqat lokal/dev uchun.
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: register: yangi mijoz yaratadi va token qaytaradi
ok 8 - register: yangi mijoz yaratadi va token qaytaradi
  ---
  duration_ms: 543.4182
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: register: takroriy email 409
ok 9 - register: takroriy email 409
  ---
  duration_ms: 299.4493
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: login: to‘g‘ri / xato parol
ok 10 - login: to‘g‘ri / xato parol
  ---
  duration_ms: 647.5764
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: token bo‘lmaganicha /auth/me 401
ok 11 - token bo‘lmaganicha /auth/me 401
  ---
  duration_ms: 80.7006
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: noto‘g‘ri token 401
ok 12 - noto‘g‘ri token 401
  ---
  duration_ms: 87.7666
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: mijoz admin marshrutiga kira olmaydi (server tomonda tekshiriladi)
ok 13 - mijoz admin marshrutiga kira olmaydi (server tomonda tekshiriladi)
  ---
  duration_ms: 237.0744
  type: 'test'
  ...
# Subtest: adminsiz admin marshruti 401
ok 14 - adminsiz admin marshruti 401
  ---
  duration_ms: 75.8056
  type: 'test'
  ...
# [ogoh]: .env dagi standart sirlar ishlatilmoqda — faqat lokal/dev uchun.
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: pending buyurtmani bekor qilish: rezerv qaytadi
ok 15 - pending buyurtmani bekor qilish: rezerv qaytadi
  ---
  duration_ms: 1497.5149
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: ikkinchi marta bekor qilish 409 (faqat bir marta)
ok 16 - ikkinchi marta bekor qilish 409 (faqat bir marta)
  ---
  duration_ms: 961.3304
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: bekor qilingan buyurtma qayta ochilmaydi (PATCH 409)
ok 17 - bekor qilingan buyurtma qayta ochilmaydi (PATCH 409)
  ---
  duration_ms: 906.9115
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: bekor qilingan buyurtmaga tolov kelib tushsa 409
ok 18 - bekor qilingan buyurtmaga tolov kelib tushsa 409
  ---
  duration_ms: 753.3758
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: boshqa mijozning buyurtmasini bekor qilish 404
ok 19 - boshqa mijozning buyurtmasini bekor qilish 404
  ---
  duration_ms: 674.6538
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: admin mijoz buyurtmasini bekor qiladi, lekin faqat bir marta
ok 20 - admin mijoz buyurtmasini bekor qiladi, lekin faqat bir marta
  ---
  duration_ms: 614.6203
  type: 'test'
  ...
# Subtest: tolangan buyurtmani bekor qilish mumkin emas
ok 21 - tolangan buyurtmani bekor qilish mumkin emas
  ---
  duration_ms: 540.391
  type: 'test'
  ...
# [ogoh]: .env dagi standart sirlar ishlatilmoqda — faqat lokal/dev uchun.
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: savatga qoshish, korish va jami summa
ok 22 - savatga qoshish, korish va jami summa
  ---
  duration_ms: 1565.355
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: bir xil variant qayta qoshilsa qty yigilib boradi
ok 23 - bir xil variant qayta qoshilsa qty yigilib boradi
  ---
  duration_ms: 966.6248
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: savat elementini yangilash va ochirish
ok 24 - savat elementini yangilash va ochirish
  ---
  duration_ms: 900.9165
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: savatni toliq tozalash
ok 25 - savatni toliq tozalash
  ---
  duration_ms: 747.7003
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: max_purchase_qty: limitli mahsulotga 3 dona 422
ok 26 - max_purchase_qty: limitli mahsulotga 3 dona 422
  ---
  duration_ms: 610.1639
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: max_purchase_qty: yigindi limitdan oshsa ham 422
ok 27 - max_purchase_qty: yigindi limitdan oshsa ham 422
  ---
  duration_ms: 576.6281
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: qoldiqdan kop savatga qoshish 409 INSUFFICIENT_STOCK
ok 28 - qoldiqdan kop savatga qoshish 409 INSUFFICIENT_STOCK
  ---
  duration_ms: 516.1536
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: foydalanuvchi savatlari izolyatsiyalangan
ok 29 - foydalanuvchi savatlari izolyatsiyalangan
  ---
  duration_ms: 515.3458
  type: 'test'
  ...
# Subtest: token savat uchun majburiy
ok 30 - token savat uchun majburiy
  ---
  duration_ms: 478.2463
  type: 'test'
  ...
# [ogoh]: .env dagi standart sirlar ishlatilmoqda — faqat lokal/dev uchun.
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: ro‘yxat: sahifalash va meta
ok 31 - ro‘yxat: sahifalash va meta
  ---
  duration_ms: 1110.1555
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: kategoriya filtri
ok 32 - kategoriya filtri
  ---
  duration_ms: 805.9204
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: narx bo‘yicha saralash: price_asc va price_desc
ok 33 - narx bo‘yicha saralash: price_asc va price_desc
  ---
  duration_ms: 535.5292
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: qoldiq ko‘rinadi va rezerv hisobga olinadi
ok 34 - qoldiq ko‘rinadi va rezerv hisobga olinadi
  ---
  duration_ms: 641.8523
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: mahsulot tafsiloti: variantlar, qoldiq, max_purchase_qty
ok 35 - mahsulot tafsiloti: variantlar, qoldiq, max_purchase_qty
  ---
  duration_ms: 418.318
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: qidiruv: nom bo‘yicha qismiy moslik (q parametri)
ok 36 - qidiruv: nom bo‘yicha qismiy moslik (q parametri)
  ---
  duration_ms: 570.1792
  type: 'test'
  ...
# Subtest: nodan mahsulot 404
ok 37 - nodan mahsulot 404
  ---
  duration_ms: 376.5965
  type: 'test'
  ...
# [ogoh]: .env dagi standart sirlar ishlatilmoqda — faqat lokal/dev uchun.
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: ikki parallel HTTP xariddan faqat bittasi rezerv oladi
ok 38 - ikki parallel HTTP xariddan faqat bittasi rezerv oladi
  ---
  duration_ms: 1292.5695
  type: 'test'
  ...
# [ogoh]: .env dagi standart sirlar ishlatilmoqda — faqat lokal/dev uchun.
# [ogoh]: .env dagi standart sirlar ishlatilmoqda — faqat lokal/dev uchun.
# [ogoh]: .env dagi standart sirlar ishlatilmoqda — faqat lokal/dev uchun.
# [ogoh]: .env dagi standart sirlar ishlatilmoqda — faqat lokal/dev uchun.
# [ogoh]: .env dagi standart sirlar ishlatilmoqda — faqat lokal/dev uchun.
# [ogoh]: .env dagi standart sirlar ishlatilmoqda — faqat lokal/dev uchun.
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: 6 ta alohida ulanish raqobatida faqat bittasi rezerv oladi
ok 39 - 6 ta alohida ulanish raqobatida faqat bittasi rezerv oladi
  ---
  duration_ms: 1065.9184
  type: 'test'
  ...
# Subtest: yetarli qoldiqda parallel xaridlar hammasi otadi
ok 40 - yetarli qoldiqda parallel xaridlar hammasi otadi
  ---
  duration_ms: 748.1334
  type: 'test'
  ...
# [ogoh]: .env dagi standart sirlar ishlatilmoqda — faqat lokal/dev uchun.
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: TTL tugagach: buyurtma expired, rezerv qaytadi
ok 41 - TTL tugagach: buyurtma expired, rezerv qaytadi
  ---
  duration_ms: 2671.2491
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: expired buyurtmaga kechikkan tolov 409 ORDER_NOT_PAYABLE
ok 42 - expired buyurtmaga kechikkan tolov 409 ORDER_NOT_PAYABLE
  ---
  duration_ms: 2020.2967
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: kechikkan tolovning takroriy callbacki ham xavfsiz (already_processed)
ok 43 - kechikkan tolovning takroriy callbacki ham xavfsiz (already_processed)
  ---
  duration_ms: 1867.7623
  type: 'test'
  ...
# Subtest: expired buyurtmani bekor qilish ham mumkin emas
ok 44 - expired buyurtmani bekor qilish ham mumkin emas
  ---
  duration_ms: 1742.2287
  type: 'test'
  ...
# [ogoh]: .env dagi standart sirlar ishlatilmoqda — faqat lokal/dev uchun.
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: mahsulot tafsilotida max_purchase_qty korinadi
ok 45 - mahsulot tafsilotida max_purchase_qty korinadi
  ---
  duration_ms: 1263.0547
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: yangi mahsulotda standart limit 10, kiritilgan qiymat saqlanadi
ok 46 - yangi mahsulotda standart limit 10, kiritilgan qiymat saqlanadi
  ---
  duration_ms: 843.5552
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: notogri max_purchase_qty 400
ok 47 - notogri max_purchase_qty 400
  ---
  duration_ms: 870.7618
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: admin limitni oshirsa chegara kengayadi
ok 48 - admin limitni oshirsa chegara kengayadi
  ---
  duration_ms: 694.1595
  type: 'test'
  ...
# Subtest: limit savat va buyurtmada bir xil kuchga ega
ok 49 - limit savat va buyurtmada bir xil kuchga ega
  ---
  duration_ms: 627.8425
  type: 'test'
  ...
# [ogoh]: .env dagi standart sirlar ishlatilmoqda — faqat lokal/dev uchun.
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: savatdan buyurtma: holat, narx nusxasi, rezerv va savat tozalanishi
ok 50 - savatdan buyurtma: holat, narx nusxasi, rezerv va savat tozalanishi
  ---
  duration_ms: 1510.5601
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: narx nusxasi: narx ozgarganda eski buyurtma summasi ozgarmaydi
ok 51 - narx nusxasi: narx ozgarganda eski buyurtma summasi ozgarmaydi
  ---
  duration_ms: 1000.7694
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: items rejimi buyurtma savatni buzmaydi
ok 52 - items rejimi buyurtma savatni buzmaydi
  ---
  duration_ms: 893.8934
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: qoldiq yetmasa 409 INSUFFICIENT_STOCK va buyurtma yaratilmaydi
ok 53 - qoldiq yetmasa 409 INSUFFICIENT_STOCK va buyurtma yaratilmaydi
  ---
  duration_ms: 694.6401
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: buyurtma limiti: max_purchase_qty dan oshsa 422
ok 54 - buyurtma limiti: max_purchase_qty dan oshsa 422
  ---
  duration_ms: 602.8327
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: buyurtmalar royxati faqat oz buyurtmalarni beradi
ok 55 - buyurtmalar royxati faqat oz buyurtmalarni beradi
  ---
  duration_ms: 616.7731
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: status boyicha filtrlash
ok 56 - status boyicha filtrlash
  ---
  duration_ms: 544.4233
  type: 'test'
  ...
# Subtest: rezerv bir nechta ombordan greedy ajratiladi
ok 57 - rezerv bir nechta ombordan greedy ajratiladi
  ---
  duration_ms: 475.4116
  type: 'test'
  ...
# [ogoh]: .env dagi standart sirlar ishlatilmoqda — faqat lokal/dev uchun.
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: muvaffaqiyatli callback: buyurtma toladi, qoldiq yechiladi
ok 58 - muvaffaqiyatli callback: buyurtma toladi, qoldiq yechiladi
  ---
  duration_ms: 1215.6763
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: takroriy callback hech narsani ozgartirmaydi
ok 59 - takroriy callback hech narsani ozgartirmaydi
  ---
  duration_ms: 744.0592
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: notogri imzo 401 va tolov yozuvi yaratilmaydi
ok 60 - notogri imzo 401 va tolov yozuvi yaratilmaydi
  ---
  duration_ms: 693.459
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: imzosiz yoki maydoni yetshmay qolgan callback 400
ok 61 - imzosiz yoki maydoni yetshmay qolgan callback 400
  ---
  duration_ms: 604.2659
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: summa mos kelmasa 409 AMOUNT_MISMATCH va rejected tolov saqlanadi
ok 62 - summa mos kelmasa 409 AMOUNT_MISMATCH va rejected tolov saqlanadi
  ---
  duration_ms: 477.7306
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: tolanilgan buyurtmaga ikkinchi muvaffaqiyatli tolov 409
ok 63 - tolanilgan buyurtmaga ikkinchi muvaffaqiyatli tolov 409
  ---
  duration_ms: 494.3171
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: failed callback: buyurtma pending qoladi, rezerv saqlanadi
ok 64 - failed callback: buyurtma pending qoladi, rezerv saqlanadi
  ---
  duration_ms: 438.4646
  type: 'test'
  ...
# Subtest: mavjud bolmagan buyurtmaga callback 404
ok 65 - mavjud bolmagan buyurtmaga callback 404
  ---
  duration_ms: 384.564
  type: 'test'
  ...
# [ogoh]: .env dagi standart sirlar ishlatilmoqda — faqat lokal/dev uchun.
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: kirim: qoldiq oshadi va eski qoldiq ham yangi narxga o‘tadi
ok 66 - kirim: qoldiq oshadi va eski qoldiq ham yangi narxga o‘tadi
  ---
  duration_ms: 1313.5331
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: kirim: mavjud qoldiq bo‘lmasa — yangi inventory yozuvi yaratiladi
ok 67 - kirim: mavjud qoldiq bo‘lmasa — yangi inventory yozuvi yaratiladi
  ---
  duration_ms: 839.524
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: kirim tarixi GET /admin/receipts orqali qaytadi
ok 68 - kirim tarixi GET /admin/receipts orqali qaytadi
  ---
  duration_ms: 773.4433
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: kirim: narx o‘zgarmasa ham old_price yoziladi va qoldiq oshadi
ok 69 - kirim: narx o‘zgarmasa ham old_price yoziladi va qoldiq oshadi
  ---
  duration_ms: 645.1509
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: kirim validatsiya: noto‘g‘ri qty / narx / maydonlar 400
ok 70 - kirim validatsiya: noto‘g‘ri qty / narx / maydonlar 400
  ---
  duration_ms: 650.5907
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: kirim: mavjud bo‘lmagan variant / ombor 404
ok 71 - kirim: mavjud bo‘lmagan variant / ombor 404
  ---
  duration_ms: 496.8757
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: mijoz kiral olmaydi (403) va adminsiz 401
ok 72 - mijoz kiral olmaydi (403) va adminsiz 401
  ---
  duration_ms: 467.2731
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: qayta-narxlash eski buyurtma narx nusxasini o‘zgartirmaydi
ok 73 - qayta-narxlash eski buyurtma narx nusxasini o‘zgartirmaydi
  ---
  duration_ms: 461.3436
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: reprice: partiya kelmaydi, lekin butun qoldiq yangi narxga o‘tadi
ok 74 - reprice: partiya kelmaydi, lekin butun qoldiq yangi narxga o‘tadi
  ---
  duration_ms: 458.4443
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: reprice: narx tarixida "faqat narx" yozuvi sifatida ko‘rinadi
ok 75 - reprice: narx tarixida "faqat narx" yozuvi sifatida ko‘rinadi
  ---
  duration_ms: 413.1456
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: reprice: qayta-narxlangan narx ham eski buyurtmaga tegizmaydi
ok 76 - reprice: qayta-narxlangan narx ham eski buyurtmaga tegizmaydi
  ---
  duration_ms: 448.4769
  type: 'test'
  ...
# [migrate] qo'llandi: 001_init.sql
# [migrate] qo'llandi: 002_product_max_purchase_qty.sql
# [migrate] qo'llandi: 003_stock_receipts.sql
# [migrate] qo'llandi: 004_user_last_login.sql
# [migrate] qo'llandi: 005_receipt_reprice_mode.sql
# Subtest: reprice validatsiya: bir xil narx / noto‘g‘ri qiymat 400, variant 404
ok 77 - reprice validatsiya: bir xil narx / noto‘g‘ri qiymat 400, variant 404
  ---
  duration_ms: 368.9877
  type: 'test'
  ...
# Subtest: reprice: mijoz kiral olmaydi (403), token siz 401
ok 78 - reprice: mijoz kiral olmaydi (403), token siz 401
  ---
  duration_ms: 345.6789
  type: 'test'
  ...
1..78
# tests 78
# suites 0
# pass 78
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 9267.3615
```
