-- "Faqat narxni yangilash" (reprice) qo'shimcha rejimi: kirim yozuvi endi
-- qty = 0 va warehouse_id = NULL bo'lishi mumkin — ya'ni partiya kelmagan,
-- faqat mavjud butun qoldiqning narxiga o'zgartirish kiritilgan.
-- SQLite CHECK tizim-paqasini o'chirishga imkon bermagani uchun jadval
-- qayta quriladi (ma'lumotlar saqlanadi).
ALTER TABLE stock_receipts RENAME TO stock_receipts__old;

CREATE TABLE stock_receipts (
  id           INTEGER PRIMARY KEY,
  variant_id   INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  warehouse_id INTEGER REFERENCES warehouses(id),  -- NULL => butun qoldiqqa oid narx o'zgarishi
  qty          INTEGER NOT NULL DEFAULT 0 CHECK (qty >= 0),  -- 0 => faqat narx yangilandi
  unit_price   INTEGER NOT NULL CHECK (unit_price >= 0),  -- yangi sotish narxi (barcha qoldiqqa qo'llanadi)
  old_price    INTEGER NOT NULL CHECK (old_price >= 0),   -- o'zgarishdan oldingi narx
  note         TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL
);

INSERT INTO stock_receipts (id, variant_id, warehouse_id, qty, unit_price, old_price, note, created_at)
  SELECT id, variant_id, warehouse_id, qty, unit_price, old_price, note, created_at
  FROM stock_receipts__old;

DROP TABLE stock_receipts__old;

CREATE INDEX idx_receipts_variant ON stock_receipts (variant_id, created_at);
CREATE INDEX idx_receipts_created ON stock_receipts (created_at);
