# Elektron savdo va ombor API

8 kunlik individual loyiha: do'kon bir nechta mahsulotni bir vaqtda xarid
qilganda ham qoldiqni to'g'ri saqlaydigan savdo + ombor API.

- **Stack:** Node.js (>=22.5, ichki `node:sqlite` bazi), Express 5,
  `jsonwebtoken` — boshqa tashqi dependentlik YO'Q (takrorlanuvchi lokal ishga
  tushirish uchun ataylab).
- **Arxitektura:** tranzaksiyaviy rezerv (`inventory.reserved`), narx nusxasi
  (`order_items.unit_price`), soxta to'lov provayderi webhook (HMAC imzo +
  idempotentlik), rezerv TTL, mijoz/admin rollari.

## Tez ishga tushirish

```bash
npm install
cp .env.example .env      # ixtiyoriy — o'rnatilgan qiymatlar dev uchun ishlaydi
npm run migrate           # baza + migratsiyalar (data/app.db)
npm run seed              # demo ma'lumotlar (idempotent)
npm run dev               # http://localhost:3000/  (sayt) va /api/health (API)
```

`.env.example`: `PORT`, `DB_PATH`, `JWT_SECRET`, `PAYMENT_SECRET`,
`RESERVATION_TTL_SECONDS` (def 900), `SWEEP_INTERVAL_SECONDS` (def 30),
`ADMIN_SECOND_PASSWORD` (def `devament`), `ADMIN_2FA_CHALLENGE_SECONDS` (def 600).

## Web sayt (mijoz + admin interfeysi)

Bitta `npm run dev` API bilan birga **web saytni** ham ko'taradi — qo'shimcha
bundler, framework yoki dependentlik talab qilmaydi (`public/` papkasidagi
soddа HTML/CSS/vanilla-JS SPA, Express `express.static` orqali beriladi).

Sayt manzili: **http://localhost:3000/**

Imkoniyatlar:
- **Katalog** — qidiruv (sahifaning yuqori-chizigidagi qidiruv oynasi,
  `GET /api/products?q=`), kategoriya filtri, narx bo'yicha saralash,
  sahifalash, real qoldiq va `max_purchase_qty` belgilari.
- **Mahsulot** — variantlar, har bir variantning ombordagi mavjud qoldig'i,
  miqdor tanlash (limit va qoldiq chegarasi bilan), "Savatga" / "Darhol xarid".
- **Savat** — miqdorni o'zgartirish, o'chirish, manzil, buyurtma berish.
- **Buyurtma va to'lov** — narx nusxasi ko'rsatiladi, rezerv TTL bo'yicha
  jonli **hisoblagich**, "To'lovni tasdiqlash" tugmasi soxta provayder rolida
  serverda imzolangan callback yuboradi, bekor qilish (faqat bir marta).
- **Boshqaruv paneli (admin)** — rasm uslubidagi panel: gradient rangli
  yuqori chiziq, fillik (teal) sahifa chizig'i qidiruv bilan, to'q ko'mur-yashil
  yon panel va ohangli kulfon fon. 5 ta stat kartochka (bugungi tushum +
  kechagiga nisbatan %, buyurtmalar, kutilayotgan to'lovlar, ombordagi dona,
  mijozlar) sparkline diagrammalar bilan; ikki seriyali **tushum dinamikasi**
  (so'nggi 7 kun ↔ oldingi 7 kun, silliq maydon diagramma), kategoriyalar
  bo'yicha **halqa** diagramma, kunlik buyurtmalar ustunlari, eng ko'p sotilgan
  gorizontal ustunlar, kam qolgan mahsulotlar va narx o'zgarishlari jadvallari.
  **Do'konda nima bo'layapti** — jonli lentasi: buyurtma, to'lov, bekor,
  muddati tugan, kirim, yangi mijoz hodisalarini ko'rsatadi va 15 soniyada
  bir marta qayta tortadi. Ma'lumot `GET /api/admin/stats` dan.
- **Mijoz paneli** — o'z buyurtmalari bo'yicha xarid tarixi va holat diagrammasi.
- **Kirim va narx** — ikki rejim: yangi partiya qabul qilish (qoldiq + narx)
  yoki **faqat narxni o'zgartirish** (partiya kelmaydi, mavjud qoldiq yangi
  narxga o'tadi) — quyida to'liq.
- **Narx tarixi** — har bir amal: sana, mahsulot, "kirim"/"faqat narx", ombor,
  eski → yangi narx, izoh.
- **Admin panel** — qoldiqni real vaqtda ko'rish va delta bilan sozlash,
  barcha mijozlar buyurtmalari, yangi mahsulot (variantlar + boshlang'ich
  qoldiq bir tranzaksiyada), ombor yaratish.

> **Xavfsizlik:** sayt brauzerda `PAYMENT_SECRET` ni HECH QACHON ko'rsatmaydi.
> To'lov tugmasi `POST /api/payments/simulate` orqali imzoni server tomonida
> hisoblaydi va faqat buyurtma egaliga (yoki admin) ruxsat beradi. Rol
> tekshiruvi serverda — UI da tugmani yashirish uning o'rnini bosmaydi.

## Admin kirishi — alohida va ikki bosqichli

Admin panelga kirish mijoz kirishidan **alohida**: `http://localhost:3000/#/admin-login`.

1. **1-bosqich** — email + hisob paroli (`POST /api/auth/admin/login`).
   Server faqat vaqtinchalik **challenge** qaytaradi (600 soniya yashaydi),
   admin tokeni hali berilmaydi.
2. **2-bosqich** — ikkinchi (alik) parol (`POST /api/auth/admin/verify`).
   Faqat shu bosqichdan o'tgach `twofa:1` belgisi bilan haqiqiy admin tokeni
   beriladi.

**Server majburiyati:** `/api/admin/*` marshrutlari tokenda `twofa` belgisini
tekshiradi — 1-bosqich challenge'i yoki oddiy `login()` tokeni bilan so'rov
yuborilsa **403 ADMIN_2FA_REQUIRED** qaytadi. Mijoz hisobi bilan `/api/auth/login`
orqali admin email kiritilsa **403 ADMIN_LOGIN_SEPARATE** qaytadi va sayt
avtomatik admin kirish sahifasiga o'tkazadi. Ya'ni ikki bosqich — UI o'yini
emas, server tomonidagi tekshiruv (`src/auth/middleware.js`, test:
`test/admin2fa.test.mjs`).

Sozlash `.env` orqali: `ADMIN_SECOND_PASSWORD` (standart `devament`) va
`ADMIN_2FA_CHALLENGE_SECONDS` (standart `600`). Ikkinchi parol brauzer kodi
ichida saqlanmaydi — uni faqat foydalanuvchi kiritadi.

## Kirim va narxni yangilash (ikki rejim)

Vaziyat: do'konga birinchi kuni **200 dona suv 5 000 so'm** dan keldi.
Ertasi xarid narxi ko'tarilib suv **6 000 so'm** bo'ldi — do'kon eski qoldiqni
ham 6 000 dan sotishi kerak. Buning uchun omborda **ikki alohida amal** bor:

**1-rejim — yangi partiya keldi:** `POST /api/admin/receipts`
bitta `BEGIN IMMEDIATE` tranzaksiyasida uch ish qiladi:

1. `inventory.quantity` ga yangi partiya qo'shiladi (yozuv bo'lmasa — yaratiladi);
2. `product_variants.price` yangi narxga o'zgartiriladi — savat, katalog va
   yangi buyurtmalar avtomatik yangi narxni oladi, chunki qoldiq variant
   narxidan hisoblanadi;
3. `stock_receipts` ga miqdor, `old_price` va izoh yoziladi (tarix).

**2-rejim — partiya kelmedi, faqat narx o'zgardi:** `POST /api/admin/reprice`
(tranzaksiyada):

1. `product_variants.price` yangi narxga o'zgartiriladi — **butun mavjud
   qoldiq**, shu jumladon 5 000 dan kelgan donalar ham endi 6 000 dan sotiladi;
2. qoldiqqa hech narsa qo'shilmaydi (`inventory` o'zgarmaydi);
3. `stock_receipts` ga `qty = 0`, `warehouse_id = NULL` yozuv tushadi — tarixda
   **"Faqat narx"** deb ko'rinadi va qaysi omborga tegishli emasligi shu
   belgidan ko'rinadi (narx variantga tegishli, bitta omborga emas).

Ikki rejimda ham eski **buyurtmalarning narx nusxasi** (`order_items.unit_price`)
o'zgarmaydi — u muzlatilgan, tekshirilgan (`test/receipts.test.mjs`).

Manzil: saytda **Ombor → Kirim va narx** — tepada ikki rejimli tugma, forma
ostida "bu amal qoldiqqa qanday ta'sir qiladi" jonli hisob-kitobi turadi.
Seed'da **Suv 0.5L** (200 dona × 5 000 so'm) tayyor turadi — yuqoridagi misolni
shu mahsulotda bir zumda takrorlash mumkin.

## Demo akkauntlar

| Rol | Email | Parol | Qayerdan kiriladi |
|---|---|---|---|
| Admin | admin@shop.uz | `devament11` → ikkinchi parol `devament` | `#/admin-login` (2 bosqich) |
| Mijoz | aziz@example.com | Aziz123! | `#/login` |
| Mijoz | malika@example.com | Malika123! | `#/login` |

Seed qilingan katalog: 8 mahsulot, 4 kategoriya, 2 ombor. Maxsus holatlar:
**JBL Tune 520BT** — qoldiq 1 (parallel xarid demo uchun), iPhone 15 —
`max_purchase_qty=2`, Redmi Note 13 — qoldiq ikki omborga bo'lingan (15+10),
**Suv 0.5L** — 200 dona × 5 000 so'm (kirim + qayta-narxlash demo uchun).

## Biznes qoidalari va qabul mezonlari

1. **Qoldiq 1 — ikki parallel xarid, faqat bittasi rezerv oladi.**
   Buyurtma bitta `BEGIN IMMEDIATE` tranzaksiyada yaratiladi: qoldiq qayta
   tekshiriladi va rezerv shu tranzaksiya ichida ajratiladi. SQLite yozuvchilarni
   seriyalaydi — Postgres da xuddi shu naqsh `SELECT ... FOR UPDATE` bilan
   bajariladi. Tekshirish: `npm test` → `test/concurrency.test.mjs`
   (2 parallel HTTP + 6 ta alohida DB ulanish `worker_threads` da) yoki
   `node adapter/demo.mjs`.
2. **Takroriy callback to'lov/qoldiq yechishni takrorlamaydi.**
   `payments.provider_payment_id` UNIQUE + bir buyurtmaga bitta muvaffaqiyatli
   to'lovga qismli UNIQUE indeks. Tekshirish: `test/payments.test.mjs`.
3. **Bekor qilingan buyurtma qayta ochilmaydi.**
   Bekor faqat `pending_payment` holatda, faqat bir marta (`cancelled` — yakuniy).
   `PATCH /api/orders/:id` har doim `409 ORDER_STATUS_IMMUTABLE` — holat faqat
   biznes-operatsiyalar orqali o'zgaradi, server tomonda tekshiriladi (UI emas).
   Tekshirish: `test/cancel.test.mjs`.

Qolgan qoidalar: narx nusxasi buyurtmada muzlatiladi (`test/orders.test.mjs`),
rezerv TTL tugasa qoldiq qaytadi va kechikkan to'lov rad etiladi
(`test/expiry.test.mjs`), `max_purchase_qty` savat va buyurtmada
(`test/maxqty.test.mjs`), rollar har so'rovda server tomonda
(`test/auth.test.mjs`).

## Testlar

```bash
npm test            # 73 ta test (node --test, har fayl izolyatsiyalangan baza)
npm run test:report # docs/test-report.md ga yangilangan hisobot yozadi
```

## Hujjatlar

- **API:** [docs/API.md](docs/API.md) — barcha marshrutlar, xato kodlari,
  callback imzolash namunasi.
- **Sinov adapteri:** [adapter/README.md](adapter/README.md) — tashqi
  baholovchi uchun klient (`adapter/api-client.mjs`) va jonli demo
  (`adapter/demo.mjs`), chegaralari bilan.
- **Test hisoboti:** [docs/test-report.md](docs/test-report.md).

## Tuzilma

```
src/
  config.js            # .env konfiguratsiyasi
  server.js            # migratsiya + app + sweeper + graceful shutdown
  sweeper.js           # muddati tugagan rezervlarni periodik qaytarish
  app.js               # marshrutlar, xato ishlovchi
  auth/                # scrypt parol, JWT, rol middleware
  db/                  # ulanish (WAL, busy_timeout), migratsiyalar, seed
  lib/                 # xatolar, validatsiya, vaqt, slug
  modules/
    auth.routes.js     # register/login/me
    catalog.*          # kategoriyalar, katalog (filtr/sahifalash/saralash)
    cart.*             # savat + max_purchase_qty/qoldiq chegaralari
    orders.*           # tranzaksiyaviy buyurtma, rezerv, TTL, bekor qilish
    payments.*         # HMAC callback, idempotentlik, qoldiq yechish
    admin.*            # kategoriya/mahsulot/ombor/qoldiq + kirim/narx/statistika
test/                  # 73 test, helpers/ (vaqtinchalik baza + fixtures)
adapter/               # tashqi sinov adapteri + demo
public/                # web sayt (index.html, styles.css, app.js — vanilla SPA)
scripts/               # test hisobot generatori
```

## Eslatmalar

- `npm run dev` / `start` `--env-file-if-exists=.env` bilan ishlaydi — `.env`
  bo'lmasa ham o'rnatilgan dev qiymatlari bilan ko'tariladi.
- Rezerv TTL ikki yo'l bilan ishlaydi: o'qish paytida "lazy" tekshiruv va
  `SWEEP_INTERVAL_SECONDS` bilan periodik sweep.
- Barcha narxlar butun son (so'm). Javob konverti: `{data, meta?}` /
  `{error:{code,message,details?}}`.
