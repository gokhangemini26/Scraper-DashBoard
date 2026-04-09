import * as cheerio from 'cheerio';

export interface ProductData {
  title: string;
  description: string | null;
  ingredients: string | null;
  price: number | null;
  sale_price: number | null;
  currency: string | null;
  images: string[];

  // Identity
  sku: string | null;
  barcode: string | null;

  // Stock
  in_stock: boolean;

  // Physical attributes
  brand: string | null;
  category: string | null;
  color: string | null;
  sizes: string[];
  material: string | null;
  gender: string | null;
  collection: string | null;
  country_of_origin: string | null;
  weight: string | null;
  dimensions: string | null;

  variants: any[];
  raw_data: any;
}

export const scrapeProduct = async (url: string, retries = 3): Promise<ProductData> => {
  let response;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Upgrade-Insecure-Requests': '1',
        },
        signal: AbortSignal.timeout(20000),
      });

      if (response.ok) break;
      if (response.status === 404) throw new Error('HTTP 404 Not Found');
      console.warn(`[SCRAPE] HTTP ${response.status} on ${url}. Retrying... (${attempt + 1}/${retries})`);
    } catch (err: any) {
      if (attempt === retries - 1) throw err;
      console.warn(`[SCRAPE] Fetch error: ${err.message}. Retrying... (${attempt + 1}/${retries})`);
    }
    await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
  }

  if (!response || !response.ok) {
    throw new Error(`HTTP ${response?.status || 'Unknown'} from ${url} after ${retries} retries`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const origin = new URL(url).origin;
  const rawData: any = { url };

  // ── LD+JSON ──────────────────────────────────────────────────────────────
  let jsonLd: any = null;
  $('script[type="application/ld+json"]').each((_i: number, el: any) => {
    try {
      const data = JSON.parse($(el).html() || '{}');
      if (data['@type'] === 'Product') { jsonLd = data; }
      else if (Array.isArray(data['@graph'])) {
        const p = data['@graph'].find((d: any) => d['@type'] === 'Product');
        if (p) jsonLd = p;
      }
    } catch {}
  });
  rawData.jsonLd = jsonLd;

  const meta = (name: string) =>
    $(`meta[property="${name}"]`).attr('content')?.trim() ||
    $(`meta[name="${name}"]`).attr('content')?.trim() || null;

  // ── Offers ────────────────────────────────────────────────────────────────
  const offers = jsonLd?.offers
    ? (Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers)
    : null;

  // ── Title ─────────────────────────────────────────────────────────────────
  const title = jsonLd?.name || meta('og:title') || $('h1').first().text().trim() || 'Unknown Product';

  // ── Description ───────────────────────────────────────────────────────────
  const description = (
    jsonLd?.description || meta('og:description') || meta('description') ||
    $('[itemprop="description"]').first().text().trim() ||
    $('[class*="description"]').first().text().trim() || null
  );

  // ── Price ────────────────────────────────────────────────────────────────
  const priceStr = offers?.price?.toString() || meta('product:price:amount') ||
    $('[class*="price"]').first().text().trim() || null;
  const price = priceStr ? parseFloat(priceStr.replace(/[^0-9.,]/g, '').replace(',', '.')) || null : null;

  let salePriceStr: string | null = null;
  if (offers?.price && offers?.highPrice && offers.price !== offers.highPrice) {
    salePriceStr = offers.price.toString();
  }
  const sale_price = salePriceStr ? parseFloat(salePriceStr.replace(/[^0-9.,]/g, '').replace(',', '.')) || null : null;

  const currency = offers?.priceCurrency || meta('product:price:currency') || 'TRY';

  // ── Images ───────────────────────────────────────────────────────────────
  let images: string[] = [];

  if (jsonLd?.image) {
    const raw = Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image];
    images = raw.map((img: any) => typeof img === 'string' ? img : (img?.url || img?.contentUrl || '')).filter(Boolean);
  }
  if (images.length === 0) { const og = meta('og:image'); if (og) images.push(og); }

  const imgSelectors = [
    '[class*="gallery"] img', '[class*="product"] img', '[class*="slider"] img',
    '[class*="carousel"] img', '[data-zoom-image]', '[data-large-img-url]',
    '#main-image', '.product-image img', '.thb-product-image img',
    'img[data-src]', 'img[data-lazy-src]', 'img[srcset]', '.product__media img'
  ];

  for (const sel of imgSelectors) {
    $(sel).each((_i: number, el: any) => {
      const src = $(el).attr('data-zoom-image') || $(el).attr('data-large-img-url') ||
                  $(el).attr('data-src') || $(el).attr('data-lazy-src') || $(el).attr('src') || '';

      const srcset = $(el).attr('srcset') || $(el).attr('data-srcset');
      if (srcset) {
        const highestRes = srcset.split(',').pop()?.trim().split(' ')[0];
        if (highestRes && !images.includes(highestRes)) images.push(highestRes);
      }

      if (src && !images.includes(src)) images.push(src);
    });
  }

  images = images
    .map(img => img.startsWith('http') ? img : new URL(img, origin).href)
    .map(img => img.replace(/^http:\/\//i, 'https://')) // Force HTTPS to avoid Mixed Content errors
    .filter(img => !img.includes('placeholder') && !img.includes('blank') && img.length > 10)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 30);

  // ── SKU ───────────────────────────────────────────────────────────────────
  let sku = jsonLd?.sku || meta('product:retailer_item_id') || meta('product-id') ||
    $('[itemprop="sku"]').text().trim() || $('[class*="sku"]').first().text().replace(/[^a-zA-Z0-9\-_]/g, '').trim() || null;

  if (!sku) {
    const refMatch = $('body').text().match(/Ref:\s*([A-Z0-9/_-]+)/i);
    if (refMatch) sku = refMatch[1].trim();
  }

  const barcode = jsonLd?.gtin13 || jsonLd?.gtin8 || jsonLd?.gtin14 || jsonLd?.gtin || jsonLd?.mpn ||
    $('[itemprop="gtin13"]').text().trim() || $('[itemprop="gtin"]').text().trim() || null;

  let in_stock = true;
  if (offers?.availability) {
    in_stock = String(offers.availability).includes('InStock') || String(offers.availability).includes('PreOrder');
  } else {
    const pageText = $('body').text().toLowerCase();
    if (['out of stock','tükendi','stokta yok','sold out'].some(k => pageText.includes(k))) in_stock = false;
  }

  const brand = (typeof jsonLd?.brand === 'string' ? jsonLd.brand : jsonLd?.brand?.name) ||
    meta('product:brand') || meta('og:brand') ||
    $('[itemprop="brand"]').text().trim() || $('[class*="brand"]').first().text().trim() || null;

  let category: string | null = null;
  $('script[type="application/ld+json"]').each((_i: number, el: any) => {
    try {
      const data = JSON.parse($(el).html() || '{}');
      const bc = data['@type'] === 'BreadcrumbList' ? data : data['@graph']?.find((d: any) => d['@type'] === 'BreadcrumbList');
      if (bc?.itemListElement) {
        const items = bc.itemListElement as any[];
        if (items.length > 1) {
          category = items.slice(1).map((i: any) => i.name || i.item?.name).filter(Boolean).join(' > ');
        }
      }
    } catch {}
  });
  if (!category) {
    const crumbs: string[] = [];
    $('[class*="breadcrumb"] a, [aria-label="breadcrumb"] a nav[class*="bread"] a').each((_i: number, el: any) => {
      const t = $(el).text().trim();
      if (t && !['home','anasayfa'].includes(t.toLowerCase())) crumbs.push(t);
    });
    if (crumbs.length) category = crumbs.join(' > ');
  }
  if (!category) category = jsonLd?.category || meta('product:category') || null;

  const color = jsonLd?.color || meta('product:color') ||
    $('[itemprop="color"]').text().trim() ||
    $('[class*="color"][class*="selected"]').first().text().trim() ||
    $('[data-color]').first().attr('data-color') || null;

  const sizes: string[] = [];
  if (jsonLd?.offers && Array.isArray(jsonLd.offers)) {
    jsonLd.offers.forEach((offer: any) => {
      const s = offer.itemOffered?.size || offer.size;
      if (s && !sizes.includes(String(s))) sizes.push(String(s));
    });
  }
  if (sizes.length === 0) {
    $('[class*="size"] button:not([disabled]), [data-size], select[class*="size"] option, [itemprop="size"]').each((_i: number, el: any) => {
      const s = $(el).attr('data-size') || $(el).attr('value') || $(el).text().trim();
      if (s && s.length < 20 && !sizes.includes(s)) sizes.push(s);
    });
  }

  let material: string | null = jsonLd?.material || $('[itemprop="material"]').text().trim() || null;
  if (!material) {
    const matKeys = ['kumaş','materyal','material','içerik','malzeme','fabric','composition'];
    $('table tr, dl dt, [class*="spec"] li, [class*="detail"] li').each((_i: number, el: any) => {
      if (material) return;
      const t = $(el).text().toLowerCase();
      if (matKeys.some(k => t.includes(k))) {
        const val = $(el).next().text().trim() || $(el).siblings('dd').first().text().trim();
        if (val && val.length < 200) material = val;
      }
    });
  }

  let gender: string | null = null;
  const gText = (meta('product:gender') || $('[itemprop="audience"]').text().trim() || '').toLowerCase();
  if (gText.includes('erkek') || gText.includes('male') || gText.includes('men')) gender = 'Erkek';
  else if (gText.includes('kadın') || gText.includes('female') || gText.includes('women')) gender = 'Kadın';
  else if (gText.includes('unisex')) gender = 'Unisex';

  if (!gender && category) {
    const cat = category.toLowerCase();
    if (cat.includes('erkek')) gender = 'Erkek';
    else if (cat.includes('kadın')) gender = 'Kadın';
    else if (cat.includes('çocuk') || cat.includes('kids')) gender = 'Çocuk';
    else if (cat.includes('unisex')) gender = 'Unisex';
  }

  let ingredients: string | null = null;
  const ingKeys = ['içindekiler','içerik','ingredients','bilgi','bileşenler','içerdiği','composition','content'];
  const ingSelectors = [
    'table tr', 'dl dt', '[class*="spec"] li', '[class*="detail"] li',
    '[class*="ingredients"]', '#ingredients', '.ingredients-text',
    'details[id*="composition_tab"] .accordion__content',
    'details[id*="Details-composition_tab"] .accordion__content'
  ];

  $(ingSelectors.join(', ')).each((_i: number, el: any) => {
    if (ingredients) return;
    const t = $(el).text().toLowerCase();
    if (ingKeys.some(k => t.includes(k))) {
      const val = $(el).next().text().trim() || $(el).siblings('dd').first().text().trim() ||
                  $(el).find('[class*="value"]').text().trim() ||
                  $(el).text().replace(/.*?(?:içindekiler|içerik|ingredients|bileşenler)[:\s]+/i, '').trim();
      if (val && val.length > 5 && val.length < 2000) ingredients = val;
    }
  });

  if (!ingredients && description) {
    const match = description.match(/(?:içerik|içindekiler|ingredients)[:\s]+([^\n.]{10,500})/i);
    if (match) ingredients = match[1].trim();
  }

  const collection = jsonLd?.collection || meta('product:collection') ||
    $('[class*="collection"]').first().text().trim() || null;

  let country_of_origin: string | null = jsonLd?.countryOfOrigin || meta('product:country_of_origin') || null;
  if (!country_of_origin) {
    const coKeys = ['made in','üretim yeri','menşei','origin','country','manufacturing'];
    $('table tr, dl, [class*="spec"] li, [class*="detail"] li, [class*="info"] li, p, .accordion__content').each((_i: number, el: any) => {
      if (country_of_origin) return;
      const t = $(el).text().toLowerCase();
      if (coKeys.some(k => t.includes(k))) {
        // Look for common patterns like "Manufacturing: Turkey" or "Product Manufacturing: France"
        const match = $(el).text().match(/(?:made in|üretim yeri|menşei|origin|manufacturing|manufacturing value)[:\s]+([^\n,<]{2,100})/i);
        if (match) {
          const val = match[1].trim();
          // Filter out long sentences, keep country name
          if (val.length < 50) country_of_origin = val;
        }
      }
    });

    // Special check for Eden Park text block containing "Product Manufacturing: Turkey"
    if (!country_of_origin) {
      const pageText = $('body').text();
      const emMatch = pageText.match(/Product Manufacturing[:\s]+([^\n.,]{2,50})/i);
      if (emMatch) country_of_origin = emMatch[1].trim();
    }
  }

  const weight = jsonLd?.weight || $('[itemprop="weight"]').text().trim() || null;
  const dimensions = (jsonLd?.width || jsonLd?.height || jsonLd?.depth)
    ? [jsonLd?.width, jsonLd?.height, jsonLd?.depth].filter(Boolean).join(' x ') : null;

  const variants: any[] = [];
  if (jsonLd?.offers && Array.isArray(jsonLd.offers)) {
    jsonLd.offers.forEach((offer: any) => {
      variants.push({
        price: offer.price, currency: offer.priceCurrency, sku: offer.sku,
        availability: offer.availability, color: offer.itemOffered?.color || offer.color || null,
        size: offer.itemOffered?.size || offer.size || null, name: offer.itemOffered?.name || null, url: offer.url || null,
      });
    });
  }

  return {
    title, description: description?.substring(0, 2000) || null,
    ingredients: ingredients?.substring(0, 2000) || null,
    price: isNaN(price as number) ? null : price,
    sale_price: isNaN(sale_price as number) ? null : sale_price,
    currency, images, sku: sku?.trim() || null, barcode: barcode?.trim() || null,
    in_stock, brand: brand?.trim() || null, category: category?.substring(0, 500) || null,
    color: color?.trim() || null, sizes, material: material?.trim() || null,
    gender, collection: collection?.trim() || null, country_of_origin: country_of_origin?.trim() || null,
    weight: weight?.trim() || null, dimensions: dimensions?.trim() || null, variants, raw_data: rawData,
  };
};
