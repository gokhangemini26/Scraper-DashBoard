const cheerio = require('cheerio');
// We test a local copy to avoid ESM/CJS issues in this simple script
// but it should match the logic in productUtils.ts
function extractMadeIn($, jsonLd, description) {
  if (jsonLd?.countryOfOrigin) {
    if (typeof jsonLd.countryOfOrigin === 'string') return jsonLd.countryOfOrigin;
    if (jsonLd.countryOfOrigin.name) return jsonLd.countryOfOrigin.name;
  }
  const metaOrigin = $('meta[name="origin"]').attr('content')
    || $('meta[property="product:origin"]').attr('content');
  if (metaOrigin) return metaOrigin;
  const searchTargets = [
    description || '',
    $('.product-details').text(),
    $('.specifications').text(),
    $('body').text()
  ];
  const madeInRegex = /Made\s*in\s*([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/;
  for (const text of searchTargets) {
    if (!text) continue;
    const match = text.match(madeInRegex);
    if (match && match[1]) {
      const cleaned = match[1].trim();
      if (cleaned.length > 2 && cleaned.length < 30) return cleaned;
    }
  }
  return null;
}

const tests = [
  {
    name: 'LD+JSON simple',
    jsonLd: { countryOfOrigin: 'Italy' },
    html: '<html></html>',
    expected: 'Italy'
  },
  {
    name: 'LD+JSON object',
    jsonLd: { countryOfOrigin: { name: 'France' } },
    html: '<html></html>',
    expected: 'France'
  },
  {
    name: 'Meta tag',
    jsonLd: null,
    html: '<html><meta name="origin" content="Germany"></html>',
    expected: 'Germany'
  },
  {
    name: 'Text content in body',
    jsonLd: null,
    html: '<html><body>This product is Made in USA and very high quality.</body></html>',
    expected: 'USA'
  },
  {
    name: 'Text content in description',
    jsonLd: null,
    description: 'Beautifully crafted. Made in Turkey.',
    html: '<html></html>',
    expected: 'Turkey'
  }
];

let failed = false;
tests.forEach(test => {
  const $ = cheerio.load(test.html);
  const result = extractMadeIn($, test.jsonLd, test.description || null);
  if (result === test.expected) {
    console.log(`✅ [PASS] ${test.name}`);
  } else {
    console.error(`❌ [FAIL] ${test.name}: expected "${test.expected}", got "${result}"`);
    failed = true;
  }
});

if (failed) process.exit(1);
