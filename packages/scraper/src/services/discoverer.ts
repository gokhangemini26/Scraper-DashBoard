import { createPageContext } from './browser';

export interface DiscoverLink {
  url: string;
  label: string;
  depth: number;
}

export const discoverLinks = async (targetUrl: string): Promise<DiscoverLink[]> => {
  const { context, page } = await createPageContext();
  const links: DiscoverLink[] = [];
  const origin = new URL(targetUrl).origin;

  try {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const Selectors = [
      'nav a[href]',
      'header a[href]',
      'footer a[href]',
      '[class*="menu"] a[href]',
      '[class*="nav"] a[href]',
      '[class*="category"] a[href]'
    ];

    const rawLinks: { href: string; text: string }[] = [];

    // Evaluate all selectors in browser context
    for (const selector of Selectors) {
      if (await page.$(selector)) {
        const found = await page.$$eval(selector, elements => {
          return elements.map(el => ({
            href: (el as HTMLAnchorElement).href,
            text: (el as HTMLAnchorElement).innerText.trim()
          }));
        });
        rawLinks.push(...found);
      }
    }

    // Process and filter
    const uniqueUrls = new Set<string>();
    
    for (const item of rawLinks) {
      try {
        if (!item.href || item.href.startsWith('javascript:')) continue;
        
        const urlObj = new URL(item.href, origin);
        const cleanUrl = urlObj.origin + urlObj.pathname + urlObj.search;

        if (urlObj.origin !== origin) continue; // Same domain only
        
        // Remove direct product URLs
        const lowerUrl = cleanUrl.toLowerCase();
        if (lowerUrl.includes('/product/') || lowerUrl.includes('/p/') || lowerUrl.includes('/item/')) {
          continue;
        }

        if (!uniqueUrls.has(cleanUrl)) {
          uniqueUrls.add(cleanUrl);
          links.push({
            url: cleanUrl,
            label: item.text || cleanUrl.replace(origin, ''),
            depth: urlObj.pathname.split('/').filter(Boolean).length
          });
        }
      } catch (e) {
        // Ignore invalid URLs
      }
    }

  } catch (error: any) {
    console.error('Discoverer Error:', error.message);
  } finally {
    await page.close();
    await context.close();
  }

  return links;
};
