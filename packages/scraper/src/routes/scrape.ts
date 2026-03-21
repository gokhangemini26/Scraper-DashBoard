import { Router } from 'express';
import { createPageContext } from '../services/browser';
import { scrapeProduct } from '../services/productScraper';
import { extractProductLinks } from '../services/productLinkExtractor';
import { saveProduct } from '../services/dbWriter';
import { randomDelay } from '../utils/delay';
import { supabase, log } from '../utils/logger';

const router = Router();

router.post('/', async (req, res) => {
  const { targetUrl, selectedUrls, config, sessionId } = req.body;

  console.log('[SCRAPE] Received request:', { sessionId, targetUrl, urlCount: selectedUrls?.length });

  if (!sessionId || !selectedUrls || !Array.isArray(selectedUrls)) {
    console.error('[SCRAPE] Invalid payload');
    return res.status(400).json({ error: 'Invalid payload' });
  }

  // Update session status
  if (supabase) {
    await supabase.from('scrape_sessions').update({ status: 'running' }).eq('id', sessionId);
  }
  await log(sessionId, 'info', `Scraping started. ${selectedUrls.length} category pages to process.`);

  // Immediately respond to free up the client connection
  res.json({ status: 'started', sessionId });

  const maxProducts = config?.maxProducts || 100;
  let totalSaved = 0;

  try {
    // STEP 1: Extract all product links from category pages (lightweight, no browser)
    const allProductUrls: string[] = [];

    for (const categoryUrl of selectedUrls) {
      await log(sessionId, 'info', `📂 Scanning category: ${categoryUrl}`);
      console.log(`[SCRAPE] Extracting product links from: ${categoryUrl}`);

      const productUrls = await extractProductLinks(categoryUrl);
      await log(sessionId, 'info', `Found ${productUrls.length} products in this category`);
      
      for (const url of productUrls) {
        if (!allProductUrls.includes(url)) {
          allProductUrls.push(url);
        }
      }
    }

    // Update total_found
    if (supabase) {
      await supabase.from('scrape_sessions')
        .update({ total_found: allProductUrls.length })
        .eq('id', sessionId);
    }
    await log(sessionId, 'info', `🔍 Total unique products found: ${allProductUrls.length}. Starting scraping...`);
    console.log(`[SCRAPE] Total product URLs: ${allProductUrls.length}`);

    // Limit to maxProducts
    const urlsToScrape = allProductUrls.slice(0, maxProducts);

    // STEP 2: Visit each product page with Playwright and scrape details
    console.log('[SCRAPE] Launching Playwright browser...');
    const { context, page } = await createPageContext();
    console.log('[SCRAPE] Browser launched successfully');

    for (let i = 0; i < urlsToScrape.length; i++) {
      const url = urlsToScrape[i];

      // Check if session was cancelled by the user
      if (supabase) {
        const { data: sessionCheck } = await supabase
          .from('scrape_sessions')
          .select('status')
          .eq('id', sessionId)
          .single();
        if (sessionCheck?.status === 'cancelled') {
          await log(sessionId, 'warn', `⛔ Tarama kullanıcı tarafından durduruldu. ${totalSaved} ürün kaydedildi.`);
          console.log('[SCRAPE] Cancelled by user');
          break;
        }
      }

      console.log(`[SCRAPE] [${i + 1}/${urlsToScrape.length}] ${url}`);
      await log(sessionId, 'info', `🛒 [${i + 1}/${urlsToScrape.length}] Scraping: ${url}`);
      
      try {
        const productData = await scrapeProduct(url, page);
        await saveProduct(productData, url, sessionId);
        totalSaved++;
        console.log(`[SCRAPE] ✅ Saved #${totalSaved}: ${productData.title}`);

        await randomDelay();
      } catch (err: any) {
        console.error(`[SCRAPE] ❌ Error on ${url}:`, err.message);
        await log(sessionId, 'error', `❌ Error: ${url} — ${err.message}`);
        if (supabase) {
          await supabase.from('failed_jobs').insert({
            session_id: sessionId,
            url,
            error_message: err.message
          });
          // Increment failed counter
          const { data } = await supabase.from('scrape_sessions').select('total_failed').eq('id', sessionId).single();
          if (data) {
            await supabase.from('scrape_sessions').update({ total_failed: (data.total_failed || 0) + 1 }).eq('id', sessionId);
          }
        }
      }
    }

    await page.close();
    await context.close();
    console.log('[SCRAPE] Browser closed');

    if (supabase) {
      await supabase.from('scrape_sessions').update({ 
        status: 'completed',
        finished_at: new Date().toISOString()
      }).eq('id', sessionId);
    }
    
    await log(sessionId, 'success', `🎉 Scraping completed! ${totalSaved} products saved.`);
    console.log(`[SCRAPE] Done. ${totalSaved} products saved.`);

  } catch (globalErr: any) {
    console.error('[SCRAPE] FATAL ERROR:', globalErr.message, globalErr.stack);
    await log(sessionId, 'error', `💥 Fatal error: ${globalErr.message}`);
    if (supabase) {
      await supabase.from('scrape_sessions').update({ 
        status: 'failed',
        finished_at: new Date().toISOString()
      }).eq('id', sessionId);
    }
  }
});

export default router;
