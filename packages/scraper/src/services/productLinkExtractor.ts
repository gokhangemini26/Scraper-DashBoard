import * as cheerio from 'cheerio';

/**
 * Given a category/collection page URL, extracts all individual product links.
 * Uses lightweight fetch + cheerio (no Playwright needed).
 */
export const extractProductLinks = async (categoryUrl: string): Promise<string[]> => {
  const origin = new URL(categoryUrl).origin;
  const productLinks: string[] = [];
  const seen = new Set<string>();

  try {
    const response = await fetch(categoryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      console.error(`[EXTRACT] HTTP ${response.status} from ${categoryUrl}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Find all anchor tags that look like product links
    $('a[href]').each((_i: number, el: any) => {
      const href = $(el).attr('href');
      if (!href) return;

      try {
        const fullUrl = new URL(href, origin).href;
        const path = new URL(fullUrl).pathname.toLowerCase();

        // Common product URL patterns
        const isProductUrl =
          path.includes('/products/') ||
          path.includes('/product/') ||
          path.includes('/p/') ||
          path.match(/\/[a-z-]+-[a-z0-9]+$/i) !== null; // slug-SKU pattern

        // Exclude non-product pages
        const isExcluded =
          path.includes('/collections') ||
          path.includes('/categories') ||
          path.includes('/cart') ||
          path.includes('/account') ||
          path.includes('/search') ||
          path.includes('/pages/') ||
          path.includes('/blogs/') ||
          path === '/';

        if (isProductUrl && !isExcluded && new URL(fullUrl).origin === origin && !seen.has(fullUrl)) {
          seen.add(fullUrl);
          productLinks.push(fullUrl);
        }
      } catch {
        // Invalid URL, skip
      }
    });

    console.log(`[EXTRACT] Found ${productLinks.length} product links in ${categoryUrl}`);
  } catch (err: any) {
    console.error(`[EXTRACT] Error: ${err.message}`);
  }

  return productLinks;
};
