import * as cheerio from 'cheerio';

/**
 * Helper to extract "Made In" information from various sources.
 */
export function extractMadeIn($: cheerio.CheerioAPI, jsonLd: any, description: string | null): string | null {
  // 1. Try LD+JSON (countryOfOrigin)
  if (jsonLd?.countryOfOrigin) {
    if (typeof jsonLd.countryOfOrigin === 'string') return jsonLd.countryOfOrigin;
    if (jsonLd.countryOfOrigin.name) return jsonLd.countryOfOrigin.name;
  }

  // 2. Try common meta tags
  const metaOrigin = $('meta[name="origin"]').attr('content')
    || $('meta[property="product:origin"]').attr('content');
  if (metaOrigin) return metaOrigin;

  // 3. Search in description or text content for "Made in [Country]"
  const searchTargets = [
    description || '',
    $('.product-details').text(),
    $('.specifications').text(),
    $('body').text()
  ];

  // Regex specifically looks for "Made in Country" with proper capitalization.
  const madeInRegex = /Made\s*in\s*([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/;

  for (const text of searchTargets) {
    if (!text) continue;
    const match = text.match(madeInRegex);
    if (match && match[1]) {
      const cleaned = match[1].trim();
      // Length check to avoid capturing full sentences as country names
      if (cleaned.length > 2 && cleaned.length < 30) {
        return cleaned;
      }
    }
  }

  return null;
}
