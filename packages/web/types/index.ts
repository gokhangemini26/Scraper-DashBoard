export interface ProductData {
  id?: string;
  created_at?: string;
  updated_at?: string;
  source_url: string;
  sku?: string | null;
  barcode?: string | null;
  title: string;
  description?: string | null;
  brand?: string | null;
  category?: string | null;
  made_in?: string | null;
  price?: number | null;
  sale_price?: number | null;
  currency?: string;
  in_stock?: boolean;
  images?: string[];
  variants?: any[];
  raw_data?: any;
  scrape_session_id?: string | null;
}

export interface ScrapeSession {
  id: string;
  created_at: string;
  finished_at?: string | null;
  target_url: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  total_found: number;
  total_saved: number;
  total_failed: number;
  config: {
    maxProducts?: number;
    downloadImages?: boolean;
    [key: string]: any;
  };
}

export interface FailedJob {
  id: string;
  created_at: string;
  session_id: string;
  url: string;
  error_message?: string | null;
  retry_count: number;
}

export interface ScrapeLog {
  id: string;
  created_at: string;
  session_id: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

export interface Link {
  url: string;
  label: string;
  depth: number;
}
