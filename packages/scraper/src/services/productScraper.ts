import { Page } from 'playwright';

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

export const scrapeProduct = async (url: string, page: Page): Promise<ProductData> => {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  const rawData: any = { url };

  // Helper to get LD+JSON
  const getJsonLd = async () => {
    return await page.$$eval('script[type="application/ld+json"]', (scripts: any[]) => {
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent || '{}');
          if (data['@type'] === 'Product' || (Array.isArray(data['@graph']) && data['@graph'].some((item: any) => item['@type'] === 'Product'))) {
            return Array.isArray(data['@graph']) ? data['@graph'].find((item: any) => item['@type'] === 'Product') : data;
          }
        } catch (e) {}
      }
      return null;
    });
  };

  const jsonLd = await getJsonLd();
  rawData.jsonLd = jsonLd;

  // Title
  let title = await page.evaluate(() => {
    return document.querySelector('h1')?.textContent?.trim() ||
           document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() ||
           document.title.trim();
  });

  // Description
  let description = await page.evaluate(() => {
    return document.querySelector('meta[property="og:description"]')?.getAttribute('content')?.trim() ||
           (document.querySelector('[class*="description"]') as HTMLElement)?.innerText?.trim() ||
           Array.from(document.querySelectorAll('[class*="product-detail"] p')).map(p => (p as HTMLElement).innerText).join('\n') || null;
  });

  // Price
  let priceStr: string | null = null;
  if (jsonLd && jsonLd.offers) {
    priceStr = jsonLd.offers.price || (jsonLd.offers[0] && jsonLd.offers[0].price);
  }
  if (!priceStr) {
    priceStr = await page.evaluate(() => {
      return document.querySelector('meta[property="product:price:amount"]')?.getAttribute('content') ||
             (document.querySelector('[class*="price"][class*="sale"]') as HTMLElement)?.innerText ||
             (document.querySelector('[class*="price-new"]') as HTMLElement)?.innerText ||
             (document.querySelector('[class*="price"]') as HTMLElement)?.innerText || null;
    });
  }
  
  const price = priceStr ? parseFloat(priceStr.replace(/[^0-9.,]/g, '').replace(',', '.')) : null;

  // Images
  let images: string[] = [];
  if (jsonLd && jsonLd.image) {
    images = Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image];
  }
  if (images.length === 0) {
    images = await page.evaluate(() => {
      const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
      const imgElements = Array.from(document.querySelectorAll<HTMLImageElement>('[class*="product"] img[src], img[data-src]'));
      
      const extracted = imgElements
        .filter(img => img.width >= 300 || img.naturalWidth >= 300 || !img.naturalWidth)
        .map(img => img.getAttribute('data-src') || img.src)
        .filter(Boolean) as string[];

      if (ogImage) extracted.unshift(ogImage);
      return Array.from(new Set(extracted)).slice(0, 10);
    });
  }

  // Ensure absolute URLs
  const origin = new URL(url).origin;
  images = images.map(img => (img.startsWith('http') ? img : new URL(img, origin).href));

  // SKU
  let skuStr: string | null = null;
  if (jsonLd && jsonLd.sku) skuStr = jsonLd.sku;
  if (!skuStr) {
    skuStr = await page.evaluate(() => {
      return document.querySelector('meta[name="product-id"]')?.getAttribute('content') ||
             (document.querySelector('[class*="sku"]') as HTMLElement)?.innerText ||
             document.querySelector('[data-sku]')?.getAttribute('data-sku') ||
             document.querySelector('[itemprop="sku"]')?.textContent || null;
    });
  }

  // Stock
  let inStock = true;
  if (jsonLd && jsonLd.offers) {
    const availability = jsonLd.offers.availability || (jsonLd.offers[0] && jsonLd.offers[0].availability);
    if (availability && typeof availability === 'string') {
      inStock = availability.includes('InStock');
    }
  } else {
    const isOutOfStock = await page.$('[class*="out-of-stock"]');
    if (isOutOfStock) inStock = false;
  }

  return {
    title: title || 'Bilinmeyen Ürün',
    description: description || null,
    price: price || null,
    sale_price: null,
    images,
    sku: skuStr ? skuStr.trim() : null,
    in_stock: inStock,
    raw_data: rawData
  };
};
