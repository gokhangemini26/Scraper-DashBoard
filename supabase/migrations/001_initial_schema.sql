-- ÜRÜNLER TABLOSU
CREATE TABLE IF NOT EXISTS products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Kimlik bilgileri
  source_url    TEXT NOT NULL UNIQUE,
  sku           TEXT,
  barcode       TEXT,
  
  -- İçerik
  title         TEXT NOT NULL,
  description   TEXT,
  brand         TEXT,
  category      TEXT,
  
  -- Fiyat (her zaman numeric kullan, float değil)
  price         NUMERIC(10,2),
  sale_price    NUMERIC(10,2),
  currency      TEXT DEFAULT 'EUR',
  in_stock      BOOLEAN DEFAULT TRUE,
  
  -- Görseller (Supabase Storage'daki public URL'ler)
  images        TEXT[] DEFAULT '{}',
  
  -- Varyantlar (beden, renk vb.)
  variants      JSONB DEFAULT '[]',
  
  -- Meta
  raw_data      JSONB DEFAULT '{}',  -- Ham çekilen veri
  scrape_session_id UUID,             -- Hangi oturumdan çekildi
  
  -- Constraint
  CONSTRAINT source_url_not_empty CHECK (source_url <> '')
);

-- TARAMA OTURUMLARI TABLOSU
CREATE TABLE IF NOT EXISTS scrape_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at   TIMESTAMPTZ,
  
  target_url    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  -- status değerleri: 'pending', 'running', 'completed', 'failed'
  
  total_found   INT DEFAULT 0,
  total_saved   INT DEFAULT 0,
  total_failed  INT DEFAULT 0,
  
  config        JSONB DEFAULT '{}'  -- Kullanıcının seçtiği ayarlar
);

-- BAŞARISIZ İŞLER TABLOSU
CREATE TABLE IF NOT EXISTS failed_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_id    UUID REFERENCES scrape_sessions(id),
  url           TEXT NOT NULL,
  error_message TEXT,
  retry_count   INT DEFAULT 0
);

-- CANLI LOG TABLOSU (Realtime için)
CREATE TABLE IF NOT EXISTS scrape_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_id    UUID REFERENCES scrape_sessions(id),
  level         TEXT DEFAULT 'info',  -- 'info', 'warn', 'error', 'success'
  message       TEXT NOT NULL
);

-- Realtime'ı aç
ALTER PUBLICATION supabase_realtime ADD TABLE scrape_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE scrape_sessions;

-- Updated_at otomatik güncelle
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
