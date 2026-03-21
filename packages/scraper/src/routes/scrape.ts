import { Router } from 'express';
import { extractProductLinks } from '../services/productLinkExtractor';
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

  if (supabase) {
    await supabase.from('scrape_sessions').update({ status: 'running' }).eq('id', sessionId);
  }
  await log(sessionId, 'info', `Scraping started. ${selectedUrls.length} category pages to process.`);

  // Immediately respond
  res.json({ status: 'started', sessionId });

  const maxProducts = config?.maxProducts || 100;
  let totalSaved = 0;

  try {
    // STEP 1: Extract product links from category pages (cheerio)
    const allProductUrls: string[] = [];

    for (const categoryUrl of selectedUrls) {
      await log(sessionId, 'info', `📂 Scanning category: ${categoryUrl}`);
      const productUrls = await extractProductLinks(categoryUrl);
      await log(sessionId, 'info', `Found ${productUrls.length} products in this category`);
      
      for (const url of productUrls) {
        if (!allProductUrls.includes(url)) {
          allProductUrls.push(url);
        }
      }
    }

    if (supabase) {
      await supabase.from('scrape_sessions')
        .update({ total_found: allProductUrls.length })
        .eq('id', sessionId);
    }
    await log(sessionId, 'info', `🔍 Total unique products: ${allProductUrls.length}. Starting scraping...`);

    const urlsToScrape = allProductUrls.slice(0, maxProducts);

    // STEP 2: Scrape each product page (cheerio — no browser!)
    for (let i = 0; i < urlsToScrape.length; i++) {
      const url = urlsToScrape[i];

      // Check if cancelled
      if (supabase) {
        const { data: sessionCheck } = await supabase
          .from('scrape_sessions')
          .select('status')
          .eq('id', sessionId)
          .single();
        if (sessionCheck?.status === 'cancelled') {
          await log(sessionId, 'warn', `⛔ Tarama durduruldu. ${totalSaved} ürün kaydedildi.`);
          break;
        }
      }

      console.log(`[SCRAPE] [${i + 1}/${urlsToScrape.length}] ${url}`);
      await log(sessionId, 'info', `🛒 [${i + 1}/${urlsToScrape.length}] Scraping: ${url}`);
      
      try {
        const productData = await scrapeProduct(url);
        await saveProduct(productData, url, sessionId);
        totalSaved++;
        console.log(`[SCRAPE] ✅ #${totalSaved}: ${productData.title}`);

        await randomDelay();
      } catch (err: any) {
        console.error(`[SCRAPE] ❌ ${url}:`, err.message);
        await log(sessionId, 'error', `❌ ${url} — ${err.message}`);
        if (supabase) {
          await supabase.from('failed_jobs').insert({
            session_id: sessionId, url, error_message: err.message
          });
          const { data } = await supabase.from('scrape_sessions').select('total_failed').eq('id', sessionId).single();
          if (data) await supabase.from('scrape_sessions').update({ total_failed: (data.total_failed || 0) + 1 }).eq('id', sessionId);
        }
      }
    }

    if (supabase) {
      await supabase.from('scrape_sessions').update({ 
        status: 'completed', finished_at: new Date().toISOString()
      }).eq('id', sessionId);
    }
    await log(sessionId, 'success', `🎉 Completed! ${totalSaved} products saved.`);
    console.log(`[SCRAPE] Done. ${totalSaved} products saved.`);

  } catch (globalErr: any) {
    console.error('[SCRAPE] FATAL:', globalErr.message);
    await log(sessionId, 'error', `💥 Fatal: ${globalErr.message}`);
    if (supabase) {
      await supabase.from('scrape_sessions').update({ 
        status: 'failed', finished_at: new Date().toISOString()
      }).eq('id', sessionId);
    }
  }
});

export default router;
