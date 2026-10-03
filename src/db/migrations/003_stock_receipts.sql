-- Kirim (omborga qabul qilingan partiya) va narx tarixi.
-- Har bir kirim: qaysi variant, qaysi ombor, qancha, qaysi narxda keldi,
-- va kirimdan OLDINGI narx (qayta-narxlash tarixi uchun).
CREATE TABLE stock_receipts (
  id           INTEGER PRIMARY KEY,
  variant_id   INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  qty          INTEGER NOT NULL CHECK (qty > 0),
  unit_price   INTEGER NOT NULL CHECK (unit_price >= 0),  -- yangi sotish narxi (barcha qoldiqqa qo'llanadi)
  old_price    INTEGER NOT NULL CHECK (old_price >= 0),   -- kirimdan oldingi narx
  note         TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL
);

CREATE INDEX idx_receipts_variant ON stock_receipts (variant_id, created_at);
CREATE INDEX idx_receipts_created ON stock_receipts (created_at);
