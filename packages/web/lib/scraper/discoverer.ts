import * as cheerio from 'cheerio';

export interface DiscoverLink {
  url: string;
  label: string;
  depth: number;
}

/**
 * Shopify-specific discovery using the .json endpoint.
 * This is "God Mode" for Shopify sites, bypassing infinite scroll.
 */
async function fetchShopifyLinks(targetUrl: string, origin: string): Promise<DiscoverLink[]> {
  const urlObj = new URL(targetUrl);
  // Shopify collections usually follow /collections/name
  if (!urlObj.pathname.includes('/collections/')) return [];

  try {
    const jsonUrl = `${origin}${urlObj.pathname.replace(/\/$/, '')}/products.json?limit=250`;
    console.log(`[DISCOVER] Trying Shopify JSON: ${jsonUrl}`);
    
    const res = await fetch(jsonUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];

    const data = await res.json();
    if (!data.products || !Array.isArray(data.products)) return [];

    return data.products.map((p: any) => ({
      url: `${origin}/products/${p.handle}`,
      label: p.title,
      depth: 2
    }));
  } catch (err) {
    console.warn('[DISCOVER] Shopify JSON fetch failed, falling back to static crawl.');
    return [];
  }
}

/**
 * Lightweight link discoverer using fetch + cheerio.
 */
export const discoverLinks = async (targetUrl: string): Promise<DiscoverLink[]> => {
  const origin = new URL(targetUrl).origin;

  // 1. Try Shopify Fast-Track first
  const shopifyLinks = await fetchShopifyLinks(targetUrl, origin);
  if (shopifyLinks.length > 0) {
    console.log(`[DISCOVER] Shopify Fast-Track found ${shopifyLinks.length} links.`);
    return shopifyLinks;
  }

  const links: DiscoverLink[] = [];
  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,tr;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${targetUrl}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const selectors = [
      'nav a[href]',
      'header a[href]',
      'footer a[href]',
      '[class*="menu"] a[href]',
      '[class*="nav"] a[href]',
      '[class*="category"] a[href]',
    ];

    const rawLinks: { href: string; text: string }[] = [];

    for (const selector of selectors) {
      $(selector).each((_i: number, el: any) => {
        const href = $(el).attr('href');
        const text = $(el).text().trim();
        if (href) {
          rawLinks.push({ href, text });
        }
      });
    }

    // Process and filter
    const uniqueUrls = new Set<string>();

    for (const item of rawLinks) {
      try {
        if (!item.href || item.href.startsWith('javascript:') || item.href === '#') continue;

        const urlObj = new URL(item.href, origin);
        const cleanUrl = urlObj.origin + urlObj.pathname + urlObj.search;

        if (urlObj.origin !== origin) continue; // Same domain only

        // Skip obvious product URLs
        const lowerUrl = cleanUrl.toLowerCase();
        if (lowerUrl.includes('/product/') || lowerUrl.includes('/p/') || lowerUrl.includes('/item/')) {
          continue;
        }

        if (!uniqueUrls.has(cleanUrl)) {
          uniqueUrls.add(cleanUrl);
          links.push({
            url: cleanUrl,
            label: item.text || cleanUrl.replace(origin, ''),
            depth: urlObj.pathname.split('/').filter(Boolean).length,
          });
        }
      } catch {
        // Ignore invalid URLs
      }
    }
  } catch (error: any) {
    console.error('Discoverer Error:', error.message);
    throw error;
  }

  return links;
};
