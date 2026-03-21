import { Browser, BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright-extra';
// @ts-ignore
import stealth from 'puppeteer-extra-plugin-stealth';

chromium.use(stealth());

let browserInstance: Browser | null = null;

export const getBrowser = async (): Promise<Browser> => {
  if (!browserInstance) {
    console.log('Starting Playwright Chromium browser...');
    browserInstance = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browserInstance;
};

export const closeBrowser = async () => {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
    console.log('Playwright Chromium browser closed.');
  }
};

export const createPageContext = async (): Promise<{ context: BrowserContext; page: Page }> => {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  return { context, page };
};

// Graceful shutdown handlers
const handleShutdown = async () => {
  console.log('Shutdown signal received. Closing browser...');
  await closeBrowser();
  process.exit(0);
};

process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);
