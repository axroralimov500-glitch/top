ALTER TABLE products ADD COLUMN max_purchase_qty INTEGER NOT NULL DEFAULT 10 CHECK (max_purchase_qty > 0);
