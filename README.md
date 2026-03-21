# SmartScraper Dashboard 🚀

Otonom ve yapılandırılabilir E-Ticaret veri toplama (scraping) ve yönetim motoru. Özelleştirilebilir arayüzü sayesinde dilediğiniz e-ticaret sitelerindeki kategorileri bulup, ürün verilerini ve yüksek çözünürlüklü ürün resimlerini eşleştirip otomatik olarak çekmenizi sağlar.

## 🏗️ Mimari

Proje, **Turborepo** kullanılarak Monorepo şeklinde tasarlanmıştır.

1. **`packages/web` (Next.js 14 App Router)**
   - Vercel'de çalışmaya %100 uyumludur. UI (Shadcn + Zustand) ve Supabase Realtime ile canlı istatistikleri sunar.
   - İndirme (Excel ve Zip resim eşleştirme) işlemlerini barındırır.
2. **`packages/scraper` (Express.js + Playwright)**
   - Bağımsız arka plan Node.js servisidir. Render.com, Fly.io veya VPS gibi ortamlarda kesintisiz çalışmalıdır. (Playwright, Vercel Sunucusuz (Serverless) fonksiyon limitlerini aştığı için ayrılmıştır.)

## 📦 Kurulum

1. Repoyu klonlayın ve kök klasöre girin:
   ```bash
   cd "Scraper Dashboard"
   ```
2. Bağımlılıkları tek seferde kurun:
   ```bash
   npm install
   ```

## 🛢️ Supabase & Veritabanı Yapılandırması

1. Supabase'de yeni bir proje oluşturun.
2. `supabase/migrations/001_initial_schema.sql` dosyasındaki SQL kodunu kopyalayıp Supabase tarafında **SQL Editor** kısmına yapıştırın ve çalıştırın.
3. Supabase **Storage** menüsüne gidin ve `product-images` isimli bir public bucket (kova) oluşturun.

## 🔑 Ortam Değişkenleri (.env)

Kök dizinde veya servislerin içerisinde bulunan `.env.example` dosyasının ismini `.env` olarak değiştirin ve Supabase API Key'lerinizi ekleyin:

```env
# /packages/web ve /packages/scraper ortak ayarları
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Güvenlik Token'ı (API rotalarının izinsiz çağrılmasını engeller)
SCRAPER_SECRET_TOKEN=rastgele_ve_zor_bir_sifre_belirleyin
```

## 🚀 Çalıştırma (Lokal Ortam)

İki farklı terminal açmanızı öneririz.

**Terminal 1 (Scraper Servisi):**
```bash
cd packages/scraper
npm run dev
```

**Terminal 2 (Web Arayüzü):**
```bash
cd packages/web
npm run dev
```

Tarayıcınızdan `http://localhost:3000` adresine gidin. Vercel tarzı muazzam karanlık temalı dashboard açılacaktır!

## ☁️ Üretime (Production) Alma

1. **Web (Next.js)**: Direkt olarak [Vercel](https://vercel.com)'e kodu bağlayıp `/packages/web` root directory'si seçilerek yayınlanabilir. Vercel projenizin Environment Variables ekranına `.env` içindeki verileri girmeyi unutmayın.
2. **Scraper (Node.js)**: Playwright çalıştırabilecek bir sunucuda (DigitalOcean, AWS, Render) başlatmalısınız. Yayınladığınız scraper projesinin URL'sini Vercel'deki Env ayarlarına `SCRAPER_SERVICE_URL=https://yayinlanan-scraper-url.com` olarak ekleyin.

## ✨ Öne Çıkan Özellikler & İşlemler
- **Canlı (Realtime)**: Her scraper logu arayüze saniyesinde düşer. F5 (yenileme) yapmanıza gerek yoktur.
- **Excel Dökümü İndirme**: O ana kadar kazınmış ürünleri `.xlsx` formatında stok durumu, SKU vb. detaylarla indirirsiniz.
- **Toplu Resim ZIP İndirme**: Sistem resimleri sizin için arkaplanda indirerek SKU kodlarıyla isimlendirip paketleyip `.zip` arşivi sunar. Excel ile tamamen senkronizedir!
