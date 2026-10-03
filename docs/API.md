# API hujjati — Elektron savdo va ombor API

Baza URL: `http://localhost:3000/api`

- Format: JSON. Narx va summalar **butun son** (so'm/UZS).
- Muvaffaqiyat: `{ "data": ..., "meta"?: ... }`
- Xato: `{ "error": { "code": "...", "message": "...", "details"?: ... } }`
- Avtorizatsiya: `Authorization: Bearer <token>` (JWT, 7 kun). Roli server har
  so'rovda bazadan o'qiydi — tokendagi rol ishonchsiz hisoblanadi.

## Ularga ochiq marshrutlar

| Metod | Yo'l | Tavsif |
|---|---|---|
| GET | `/health` | Servis holati |
| POST | `/auth/register` | Ro'yxatdan o'tish (rol doim `customer`) |
| POST | `/auth/login` | Mijoz kirishi → token (admin hisobi 403 ADMIN_LOGIN_SEPARATE) |
| POST | `/auth/admin/login` | Admin 1-bosqich: email+parol → challenge (token EMAS) |
| POST | `/auth/admin/verify` | Admin 2-bosqich: challenge + ikkinchi parol → admin token |
| GET | `/categories` | Kategoriyalar |
| GET | `/products` | Katalog: filtr, sahifalash, saralash |
| GET | `/products/:idOrSlug` | Mahsulot tafsiloti (variantlar + qoldiq) |
| POST | `/payments/callback` | Soxta provayder webhook (imzo bilan) |

### GET /products

Query parametrlar:

- `category` — kategoriya slugi (masalan `telefon`)
- `q` — nom/tavsif/kategoriya bo'yicha qidiruv (max 60 belgi)
- `page` (def 1), `limit` (def 10, max 50)
- `sort` — `newest` (def) | `price_asc` | `price_desc`

```json
{
  "data": [
    {
      "id": 4, "name": "iPhone 15", "slug": "iphone-15",
      "max_purchase_qty": 2,
      "category_name": "Telefon", "category_slug": "telefon",
      "min_price": 12000000, "available_stock": 7
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 7, "total_pages": 1 }
}
```

`available_stock` — barcha omborlar bo'yicha `quantity - reserved` yig'indisi.

## Auth — ikki bosqichli admin kirishi

Mijoz va admin kirish yo'llari **alohida**. Admin tokeni faqat ikki bosqichdan
keyin beriladi va admin marshrutlari aynan shu belgini serverda tekshiradi.

| Bosqich | So'rov | Tana | Javob |
|---|---|---|---|
| 1 | `POST /auth/admin/login` | `{email, password}` | 200 `{step:"second_password", challenge, expires_in, name}` |
| 2 | `POST /auth/admin/verify` | `{challenge, second_password}` | 200 `{token, user, twofa:true}` |
| — | `GET /auth/me` (Bearer) | — | 200 `{user, twofa}` |

- 1-bosqich hisob parolini tekshiradi va **vaqtinchalik challenge** (JWT,
  `scope: "admin_2fa"`, muddati `ADMIN_2FA_CHALLENGE_SECONDS`, standart 600s)
  qaytaradi — bu token admin API ga kira olmaydi.
- 2-bosqich `ADMIN_SECOND_PASSWORD` bilan solishtiriladi (uzunlikni yashirish
  uchun SHA-256 digestlar `timingSafeEqual` orqali), keyin `twofa:1` belgisi
  bilan haqiqiy token beriladi.
- Mijoz kirishiga admin email bilan kirilsa: `403 ADMIN_LOGIN_SEPARATE`.
- `twofa` belgisi bo'lmagan token bilan `/admin/*` ga so'rov: `403 ADMIN_2FA_REQUIRED`.
- Challenge eskigan/muskil: `401 ADMIN_CHALLENGE_INVALID`; ikkinchi parol xato:
  `403 ADMIN_2FA_FAILED`; hisob admin emas: `403 FORBIDDEN`.

Har ikki bosqich muvaffaqiyatli o'tgach `users.last_login_at` yangilanadi va
`GET /admin/stats` javobidagi `lastLogin` da ko'rinadi.

## Mijoz marshrutlari (Bearer token)

### Savat

| Metod | Yo'l | Tana | Kodlar |
|---|---|---|---|
| GET | `/cart` | — | 200 |
| POST | `/cart/items` | `{variant_id, qty}` | 201, 404, 409 INSUFFICIENT_STOCK, 422 MAX_PURCHASE_QTY |
| PATCH | `/cart/items/:id` | `{qty}` | 200, 404, 409, 422 |
| DELETE | `/cart/items/:id` | — | 200, 404 |
| DELETE | `/cart` | — | 200 (tozalash) |

### Buyurtmalar

| Metod | Yo'l | Tavsif |
|---|---|---|
| POST | `/orders` | Savatdan (`{address}`) yoki to'g'ridan-to'g'ri (`{items:[{variant_id, qty}], address}`) |
| GET | `/orders` | O'z buyurtmalari; `?page&limit&status` |
| GET | `/orders/:id` | Bitta buyurtma (boshqaniki 404) |
| POST | `/orders/:id/cancel` | Bekor qilish — **faqat** `pending_payment` holatda, faqat bir marta |
| PATCH | `/orders/:id` | Doim 409 ORDER_STATUS_IMMUTABLE — holat qo'lda o'zgarmaydi, qayta ochish yo'q |

Buyurtma javobi (narx nusxasi `order_items` ichida muzlatilgan):

```json
{
  "data": {
    "id": 10, "status": "pending_payment", "total": 26000000, "currency": "UZS",
    "address": "Toshkent", "expires_at": "2026-10-03T10:15:00.000Z",
    "items": [
      { "variant_id": 2, "product_name": "iPhone 15", "variant_name": "128GB",
        "sku": "IP15-128", "unit_price": 12000000, "qty": 1, "line_total": 12000000 }
    ]
  }
}
```

Buyurtma holatlari: `pending_payment → paid | cancelled | expired`.
`paid`, `cancelled`, `expired` — yakuniy. Rezerv TTL (`RESERVATION_TTL_SECONDS`)
tugaganda buyurtma `expired` bo'ladi va qoldiq qaytadi.

### To'lov callback (provayder → biz)

`POST /payments/callback` — ochiq, lekin HMAC imzo majburiy.

Kanonik satr: `provider_payment_id|order_id|amount|status`
Imzo: `HMAC_SHA256(PAYMENT_SECRET, kanonik_satr)` — hex.

```js
import { createHmac } from 'node:crypto';
const payload = { provider_payment_id: 'pp_1', order_id: 10, amount: 12000000, status: 'succeeded' };
const signature = createHmac('sha256', PAYMENT_SECRET)
  .update(`${payload.provider_payment_id}|${payload.order_id}|${payload.amount}|${payload.status}`)
  .digest('hex');
// POST { ...payload, signature }
```

Javoblar:

| Holat | HTTP | Kod | Oqibat |
|---|---|---|---|
| Imzo noto'g'ri | 401 | INVALID_SIGNATURE | hech narsa yozilmaydi |
| Yangi muvaffaqiyatli to'lov | 200 | `result: 'paid'` | buyurtma `paid`, rezerv qoldiqdan yechiladi |
| Bir xil `provider_payment_id` qaytsa | 200 | `result: 'already_processed'` | **hech narsa** takrorlanmaydi |
| Summa mos emas | 409 | AMOUNT_MISMATCH | `rejected` tolov saqlanadi |
| Buyurtma to'lanadigan emas (expired/cancelled/paid) | 409 | ORDER_NOT_PAYABLE | `rejected` tolov saqlanadi |
| `status: 'failed'` | 200 | `result: 'failed_recorded'` | buyurtma `pending` qoladi, rezerv saqlanadi |

`provider_payment_id` — UNIQUE; bir buyurtmaga ikkinchi muvaffaqiyatli to'lovga
qarshi qismli UNIQUE indeks ham bor (`payments(order_id) WHERE status='succeeded'`).

### To'lov simulyatsiyasi (faqat web sayt uchun)

`POST /payments/simulate` — **mijoz autentifikatsiyasi talab qilinadi.**
Saytdagi "To'lash" tugmasi shu endpointni chaqiradi: server soxta provayder
rolida to'g'ri `provider_payment_id` yaratadi, imzoni **o'zi** hisoblaydi va
yuqoridagi `processCallback` logikasini chaqiradi. Shu sababli `PAYMENT_SECRET`
brauzerga hech qachon berilmaydi.

```jsonc
// Request
{ "order_id": 10, "status": "succeeded" }   // status: "succeeded" | "failed"
```

Xavfsizlik: buyurtma faqat unga huquqi bor foydalanuvchi (egaligi yoki admin)
tomonidan simulyatsiya qilinadi — aks holda `403`. Javob `payments/callback`
bilan bir xil (`result: paid | already_processed | failed_recorded`). Bu —
demo/lokal vosita; haqiqiy integratsiyada provayder o'zi `/payments/callback`
ga imzoli so'rov yuboradi.

## Admin marshrutlar (`admin` roli + ikki bosqichdan o'tgan token)

> Barcha `/admin/*` so'rovlari `twofa:1` belgisidagi tokenni talab qiladi —
> ya'ni faqat `POST /auth/admin/login` + `POST /auth/admin/verify` dan o'tgan
> keyin berilgan token. Aks holda `403 ADMIN_2FA_REQUIRED`.

| Metod | Yo'l | Tavsif |
|---|---|---|
| POST / PATCH | `/admin/categories[/:id]` | Kategoriya yaratish/tahrirlash (SLUG_TAKEN 409) |
| POST / GET / PATCH | `/admin/products[/:id]` | Mahsulotlar; `max_purchase_qty` ham tahrirlanadi |
| POST | `/admin/products/:id/variants` | Variant qo'shish (SKU_TAKEN 409) |
| PATCH | `/admin/variants/:id` | Variant narxi/nomi/aktivligi |
| GET / POST | `/admin/warehouses` | Omborlar (CODE_TAKEN 409) |
| GET / POST | `/admin/inventory` | Qoldiq ko'rish; `set` yoki `delta` bilan o'zgartirish (BELOW_RESERVED 409) |
| GET | `/admin/orders` | Barcha mijozlar buyurtmalari |
| GET | `/admin/variants` | Barcha variantlar + hozirgi narx va mavjud qoldiq (kirim formasi uchun) |
| POST / GET | `/admin/receipts` | Kirim (qabul) va narx tarixi — quyida to'liq |
| POST | `/admin/reprice` | **Faqat narxni o'zgartirish** — partiya kelmaydi, mavjud qoldiq yangi narxga o'tadi |
| GET | `/admin/stats` | Boshqaruv paneli ko'rsatkichlari (KPI + diagrammalar) |

### Kirim (qabul) + narx — `POST /admin/receipts`

Yangi partiya qabul qilinadi **va** variant narxi yangilanadi. Bitta
`BEGIN IMMEDIATE` tranzaksiya ichida: qoldiq ko'payadi (yozuv bo'lmasa yaratiladi),
`product_variants.price` yangilanadi (shu sababli **eski qoldiq ham yangi narxdan**
sotiladi), `stock_receipts` ga `old_price` bilan tarix yoziladi.

```jsonc
// Request
{ "variant_id": 4, "warehouse_id": 1, "qty": 200, "unit_price": 6000, "note": "narx ko'tarildi" }

// 201 javob
{ "data": {
    "receipt":   { "id": 1, "variant_id": 4, "warehouse_id": 1, "qty": 200,
                   "unit_price": 6000, "old_price": 5000, "note": "narx ko'tarildi", "created_at": "..." },
    "inventory": { "variant_id": 4, "warehouse_id": 1, "quantity": 210, "reserved": 0 },
    "variant":   { "id": 4, "price": 6000 }
} }
```

Xatolar: `400` (qty > 0 butun son, unit_price >= 0 butun son, maydonlar to'liq),
`404` (variant yoki ombor topilmadi), `403` (mijoz).

### Faqat narxni o'zgartirish — `POST /admin/reprice`

Partiya kelmaydi — narx xarid qimmatlashgani uchun mavjud qoldiq ham yangi
narxdan sotilishi kerak. Bitta tranzaksiyada `product_variants.price`
yangilanadi va `stock_receipts` ga **`qty = 0`, `warehouse_id = NULL`** yozuv
tushadi (narx variantga tegishli, bitta omborga emas). Qoldiq miqdoriga
texlmaydi.

```jsonc
// Request
{ "variant_id": 4, "unit_price": 6000, "note": "yetkazib beruvchi narxni ko'tardi" }

// 201 javob
{ "data": {
    "receipt":          { "id": 7, "variant_id": 4, "warehouse_id": null, "qty": 0,
                          "unit_price": 6000, "old_price": 5000, "note": "...", "created_at": "..." },
    "variant":          { "id": 4, "price": 6000 },
    "repriced_units":   394,   // narxi o'zgargan qoldiq (dona)
    "repriced_available": 394  // shundan savatcha bo'lgani
} }
```

Xatolar: `400` (maydon yetishmaydi, `unit_price` butun son emas yoki manfiy,
yangi narx mavjud narx bilan bir xil), `404` (variant topilmadi),
`403` (mijoz — `FORBIDDEN`; 2-bosqichdan o'tmagan admin — `ADMIN_2FA_REQUIRED`),
`401` (token siz).

Eski **buyurtmalardagi narx nusxasi** (`order_items.unit_price`) ikkala amaldan
keyin ham o'zgarmaydi.

`GET /admin/receipts?limit=N` — eng yangidan tarix (variant, ombor, soni,
`old_price` → `unit_price`, izoh). Har bir qatorda qo'shimcha `kind`
maydoni: `receipt` (partiya qabul qilindi) yoki `reprice` (faqat narx);
`reprice` qatorlarida `warehouse_code` — `null`.

### Boshqaruv paneli — `GET /admin/stats`

```jsonc
{ "data": {
  "kpi": { "revenue": 21860000, "orders": 5, "pending": 1, "customers": 2,
           "products": 7, "stockUnits": 208, "stockValue": 1089590000 },
  "salesByCategory": [{ "name": "Telefonlar", "total": 17570000, "orders": 2 }],
  "ordersByStatus":  [{ "status": "paid", "count": 3, "total": 21860000 }],
  "topProducts":     [{ "name": "Redmi Note 13", "revenue": 6580000, "units": 2 }],
  "lowStock":        [{ "sku": "JBL520-BLK", "product_name": "...", "variant_name": "...", "available": 2 }],
  "priceChanges":    [{ "id": 1, "product_name": "...", "old_price": 5000, "unit_price": 6000, "qty": 200, "created_at": "..." }],
  "revenueByMonth":  [{ "ym": "2026-10", "total": 21860000, "orders": 3 }],
  "revenueByDay":    [{ "day": "2026-10-03", "orders": 3, "total": 8316000 }],   // 7 element, bugun bilan tugaydi
  "revenueByDayPrev":[{ "day": "2026-09-26", "orders": 0, "total": 0 }],         // undan oldingi 7 kun
  "today":           { "orders": 3, "total": 8316000, "prev_total": 0 },
  "activity":        [{ "kind": "order|paid|payment_failed|cancelled|expired|receipt|customer",
                        "ref": "#4", "title": "…", "amount": 72000, "at": "2026-10-03T12:12:09Z" }],
  "lastLogin":       "2026-10-03T12:10:58.454Z"
} }
```

`revenue`/`salesByCategory` faqat `paid` buyurtmalar bo'yicha; `stockValue` —
`(quantity − reserved) × variant narxi`; `lowStock` — mavjud qoldiq ≤ 3.
`activity` — do'kondagi oxirgi 14 hodisa (buyurtma, to'lov, bekor, muddati
tugan, kirim, yangi mijoz) — saytdagi jonli lenta 15 soniyada bir shu
marshrutni qayta so'raydi.

## Xato kodlari

| HTTP | Kod | Sabab |
|---|---|---|
| 400 | VALIDATION_ERROR | Maydon yetishmaydi yoki noto'g'ri |
| 400 | BAD_JSON | Tana JSON emas |
| 401 | UNAUTHORIZED | Token yo'q/noto'g'ri |
| 401 | ADMIN_CHALLENGE_INVALID | Admin 2-bosqich: challenge eskigan yoki buzilgan |
| 401 | INVALID_SIGNATURE | Callback imzosi noto'g'ri |
| 403 | FORBIDDEN | Admin uchun marshrutga mijoz kirdi |
| 403 | ADMIN_LOGIN_SEPARATE | Admin hisobiga `/auth/login` orqali kirishga urinish |
| 403 | ADMIN_2FA_REQUIRED | `twofa` belgisi bo'lmagan token bilan `/admin/*` |
| 403 | ADMIN_2FA_FAILED | Ikkinchi (alik) parol noto'g'ri |
| 404 | NOT_FOUND | Topilmadi yoki boshqaning resursi |
| 409 | EMAIL_TAKEN / SLUG_TAKEN / SKU_TAKEN / CODE_TAKEN | Takroriy qiymat |
| 409 | INSUFFICIENT_STOCK | Qoldiq yetarli emas |
| 409 | ORDER_NOT_CANCELLABLE | Holat `pending_payment` emas (bekor bo'lmaydi) |
| 409 | ORDER_STATUS_IMMUTABLE | Holatni qo'lda o'zgartirishga urinish |
| 409 | ORDER_NOT_PAYABLE / AMOUNT_MISMATCH | Callback biznes radlari |
| 409 | VARIANT_UNAVAILABLE / BELOW_RESERVED | Sotuvda emas / qoldiq rezervdan kichik |
| 422 | MAX_PURCHASE_QTY | Mahsulot limitidan oshdi |

## Tranzaksiya kafolatlari (qisqacha)

- Buyurtma yaratish **bitta `BEGIN IMMEDIATE` tranzaksiyada**: validatsiya →
  narx nusxasi → rezerv ajratish → savat tozalanadi. Parallel so'rovlar
  SQLite tomonidan seriyalashadi; ichki qoldiq tekshiruvi faqat bittaga yo'l qo'yadi.
- Callback ham bitta tranzaksiyada: to'lov yozuvi + holat + qoldiq yechish
  birga yoziladi yoki birga bekor qilinadi.
- Rezerv modeli: `inventory.reserved` band qoldiq, `reservations` jurnali
  (`released_at`/`consumed_at`) bilan.
