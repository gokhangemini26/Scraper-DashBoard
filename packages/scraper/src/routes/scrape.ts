import { Router } from 'express';
import { createPageContext } from '../services/browser';
import { scrapeProduct } from '../services/productScraper';
import { uploadImages } from '../services/imageUploader';
import { saveProduct } from '../services/dbWriter';
import { randomDelay } from '../utils/delay';
import { supabase, log } from '../utils/logger';

const router = Router();

router.post('/', async (req, res) => {
  const { targetUrl, selectedUrls, config, sessionId } = req.body;

  if (!sessionId || !selectedUrls || !Array.isArray(selectedUrls)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  // Update session status
  await supabase.from('scrape_sessions').update({ status: 'running' }).eq('id', sessionId);
  await log(sessionId, 'info', `Scraping started. Total category targets: ${selectedUrls.length}`);

  // We immediately respond to free up the client connection
  // Scraping continues in the background
  res.json({ status: 'started', sessionId });

  const maxProducts = config?.maxProducts || 100;
  const shouldDownloadImages = config?.downloadImages !== false;

  let productsFound = 0;

  try {
    const { context, page } = await createPageContext();

    for (const url of selectedUrls) {
      if (productsFound >= maxProducts) break;

      await log(sessionId, 'info', `Processing URL: ${url}`);
      
      try {
        const productData = await scrapeProduct(url, page);
        
        if (shouldDownloadImages && productData.images.length > 0) {
          await log(sessionId, 'info', `Uploading ${productData.images.length} images...`);
          productData.images = await uploadImages(productData.images, productData.sku, url);
        }

        await saveProduct(productData, url, sessionId);
        productsFound++;

        await randomDelay(); // Rate limiting
      } catch (err: any) {
        await log(sessionId, 'error', `Error processing ${url}: ${err.message}`);
        await supabase.from('failed_jobs').insert({
          session_id: sessionId,
          url,
          error_message: err.message
        });
      }
    }

    await page.close();
    await context.close();

    await supabase.from('scrape_sessions').update({ 
      status: 'completed',
      finished_at: new Date().toISOString()
    }).eq('id', sessionId);
    
    await log(sessionId, 'success', `Scraping completed. Processed ${productsFound} items.`);

  } catch (globalErr: any) {
    console.error('Fatal scrape error:', globalErr);
    await log(sessionId, 'error', `Fatal error during scraping: ${globalErr.message}`);
    await supabase.from('scrape_sessions').update({ 
      status: 'failed',
      finished_at: new Date().toISOString()
    }).eq('id', sessionId);
  }
});

export default router;
