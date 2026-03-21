import { Router } from 'express';
import { createPageContext } from '../services/browser';
import { scrapeProduct } from '../services/productScraper';
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
  await log(sessionId, 'info', `Scraping started. Total targets: ${selectedUrls.length}`);
  console.log('[SCRAPE] Session status set to running');

  // Immediately respond to free up the client connection
  res.json({ status: 'started', sessionId });

  const maxProducts = config?.maxProducts || 100;
  let productsFound = 0;

  try {
    console.log('[SCRAPE] Launching Playwright browser...');
    const { context, page } = await createPageContext();
    console.log('[SCRAPE] Browser launched successfully');

    for (const url of selectedUrls) {
      if (productsFound >= maxProducts) break;

      console.log(`[SCRAPE] Processing: ${url}`);
      await log(sessionId, 'info', `Processing URL: ${url}`);
      
      try {
        const productData = await scrapeProduct(url, page);
        console.log(`[SCRAPE] Scraped: ${productData.title}`);

        // Resimleri Supabase'e YUKLEMIYORUZ - orijinal URL olarak kaydediyoruz
        // ZIP indirme zaten orijinal URL'lerden çekiyor
        await saveProduct(productData, url, sessionId);
        productsFound++;
        console.log(`[SCRAPE] Saved product #${productsFound}: ${productData.title}`);

        await randomDelay();
      } catch (err: any) {
        console.error(`[SCRAPE] Error on ${url}:`, err.message);
        await log(sessionId, 'error', `Error processing ${url}: ${err.message}`);
        if (supabase) {
          await supabase.from('failed_jobs').insert({
            session_id: sessionId,
            url,
            error_message: err.message
          });
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
    
    await log(sessionId, 'success', `Scraping completed. Processed ${productsFound} items.`);
    console.log(`[SCRAPE] Done. ${productsFound} products saved.`);

  } catch (globalErr: any) {
    console.error('[SCRAPE] FATAL ERROR:', globalErr.message, globalErr.stack);
    await log(sessionId, 'error', `Fatal error: ${globalErr.message}`);
    if (supabase) {
      await supabase.from('scrape_sessions').update({ 
        status: 'failed',
        finished_at: new Date().toISOString()
      }).eq('id', sessionId);
    }
  }
});

export default router;
