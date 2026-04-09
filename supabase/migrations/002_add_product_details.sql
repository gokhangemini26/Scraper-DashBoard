-- =============================================================
-- Migration 002: Ürün detay kolonları ekleniyor
-- =============================================================

ALTER TABLE products
  -- Marka & Kategori (zaten vardı, emin olalım)
  ADD COLUMN IF NOT EXISTS brand         TEXT,
  ADD COLUMN IF NOT EXISTS category      TEXT,

  -- Ürün kimliği
  ADD COLUMN IF NOT EXISTS barcode       TEXT,          -- GTIN / EAN / UPC

  -- Detaylar
  ADD COLUMN IF NOT EXISTS ingredients   TEXT,          -- Ürün içeriği / bileşenler

  -- Fiziksel özellikler
  ADD COLUMN IF NOT EXISTS color         TEXT,          -- Renk
  ADD COLUMN IF NOT EXISTS sizes         TEXT[] DEFAULT '{}',  -- Beden listesi ["S","M","L","XL"]
  ADD COLUMN IF NOT EXISTS material      TEXT,          -- Kumaş / materyal
  ADD COLUMN IF NOT EXISTS gender        TEXT,          -- Erkek / Kadın / Unisex
  ADD COLUMN IF NOT EXISTS collection    TEXT,          -- Koleksiyon adı
  ADD COLUMN IF NOT EXISTS country_of_origin TEXT,      -- Made In (üretim yeri)

  -- Para birimi (zaten vardı ama default EUR idi, TRY yapıyoruz)
  ADD COLUMN IF NOT EXISTS weight        TEXT,          -- Ağırlık bilgisi
  ADD COLUMN IF NOT EXISTS dimensions    TEXT;          -- Boyutlar

-- currency kolonunun default değerini güncelle
ALTER TABLE products ALTER COLUMN currency SET DEFAULT 'TRY';

-- Yeni kolonlara index ekle (sık filtrelenen alanlar)
CREATE INDEX IF NOT EXISTS idx_products_brand    ON products (brand);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);
CREATE INDEX IF NOT EXISTS idx_products_color    ON products (color);
CREATE INDEX IF NOT EXISTS idx_products_gender   ON products (gender);
CREATE INDEX IF NOT EXISTS idx_products_country  ON products (country_of_origin);
