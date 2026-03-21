import * as cheerio from 'cheerio';

export interface ProductData {
  title: string;
  description: string | null;
  price: number | null;
  sale_price: number | null;
  images: string[];
  sku: string | null;
  in_stock: boolean;
  raw_data: any;
}

/**
 * Lightweight product scraper using fetch + cheerio.
 * No Playwright/Chromium needed — works on any server.
 */
export const scrapeProduct = async (url: string, retries = 3): Promise<ProductData> => {
  let response;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Upgrade-Insecure-Requests': '1'
        },
        signal: AbortSignal.timeout(20000),
      });

      if (response.ok) break;
      if (response.status === 404) throw new Error('HTTP 404 Not Found');
      
      console.warn(`[SCRAPE] HTTP ${response.status} on ${url}. Retrying... (${attempt + 1}/${retries})`);
    } catch (err: any) {
      if (attempt === retries - 1) throw err;
      console.warn(`[SCRAPE] Fetch error on ${url}: ${err.message}. Retrying... (${attempt + 1}/${retries})`);
    }
    
    // Exponential backoff waiting: 3s, 6s, 9s etc.
    await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
  }

  if (!response || !response.ok) {
    throw new Error(`HTTP ${response?.status || 'Unknown'} from ${url} after ${retries} retries`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const origin = new URL(url).origin;
  const rawData: any = { url };

  // --- LD+JSON (most e-commerce sites use this) ---
  let jsonLd: any = null;
  $('script[type="application/ld+json"]').each((_i: number, el: any) => {
    try {
      const data = JSON.parse($(el).html() || '{}');
      if (data['@type'] === 'Product') {
        jsonLd = data;
      } else if (Array.isArray(data['@graph'])) {
        const product = data['@graph'].find((item: any) => item['@type'] === 'Product');
        if (product) jsonLd = product;
      }
    } catch {}
  });
  rawData.jsonLd = jsonLd;

  // --- Title ---
  let title = jsonLd?.name
    || $('h1').first().text().trim()
    || $('meta[property="og:title"]').attr('content')?.trim()
    || $('title').text().trim()
    || 'Unknown Product';

  // --- Description ---
  let description = jsonLd?.description
    || $('meta[property="og:description"]').attr('content')?.trim()
    || $('[class*="description"]').first().text().trim()
    || null;

  // --- Price ---
  let priceStr: string | null = null;
  if (jsonLd?.offers) {
    const offers = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers;
    priceStr = offers?.price?.toString() || null;
  }
  if (!priceStr) {
    priceStr = $('meta[property="product:price:amount"]').attr('content')
      || $('[class*="price"]').first().text().trim()
      || null;
  }
  const price = priceStr ? parseFloat(priceStr.replace(/[^0-9.,]/g, '').replace(',', '.')) : null;

  // --- Sale Price ---
  let salePriceStr: string | null = null;
  if (jsonLd?.offers) {
    const offers = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers;
    if (offers?.price && offers?.highPrice && offers.price !== offers.highPrice) {
      salePriceStr = offers.price.toString();
    }
  }
  const sale_price = salePriceStr ? parseFloat(salePriceStr.replace(/[^0-9.,]/g, '').replace(',', '.')) : null;

  // --- Images ---
  let images: string[] = [];
  if (jsonLd?.image) {
    images = Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image];
  }
  if (images.length === 0) {
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) images.push(ogImage);

    $('[class*="product"] img[src], [class*="gallery"] img[src], img[data-src]').each((_i: number, el: any) => {
      const src = $(el).attr('data-src') || $(el).attr('src');
      if (src && !images.includes(src)) images.push(src);
    });
  }
  // Ensure absolute URLs and max 10
  images = images
    .map(img => (img.startsWith('http') ? img : new URL(img, origin).href))
    .slice(0, 10);

  // --- SKU ---
  let sku = jsonLd?.sku
    || $('meta[name="product-id"]').attr('content')
    || $('[itemprop="sku"]').text().trim()
    || $('[class*="sku"]').first().text().trim()
    || null;

  // --- Stock ---
  let inStock = true;
  if (jsonLd?.offers) {
    const offers = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers;
    const availability = offers?.availability || '';
    if (typeof availability === 'string') {
      inStock = availability.includes('InStock');
    }
  }

  return {
    title,
    description: description || null,
    price: isNaN(price as number) ? null : price,
    sale_price: isNaN(sale_price as number) ? null : sale_price,
    images,
    sku: sku ? sku.trim() : null,
    in_stock: inStock,
    raw_data: rawData,
  };
};
