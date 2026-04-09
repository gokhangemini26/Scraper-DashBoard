import { NextResponse } from 'next/server';
import { supabase, log } from '@/lib/scraper/logger';
import { scrapeProduct } from '@/lib/scraper/productScraper';
import { saveProduct } from '@/lib/scraper/dbWriter';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds (Vercel max for Hobby)

export async function POST(req: Request) {
  let sessionId = '';

  try {
    const body = await req.json();
    const { targetUrl, selectedUrls, config } = body;

    if (!targetUrl || !selectedUrls || !Array.isArray(selectedUrls)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // 1. Create new scrape session
    const { data: session, error: dbError } = await supabase
      .from('scrape_sessions')
      .insert({
        target_url: targetUrl,
        status: 'ongoing',
        config: config || {}
      })
      .select('id')
      .single();

    if (dbError || !session) {
      throw new Error(`Failed to create session: ${dbError?.message}`);
    }

    sessionId = session.id;

    // 2. Perform scraping DIRECTLY (Serverless mode)
    // We use parallel execution (concurrency: 5) to maximize products within the 60s limit.
    const startTime = Date.now();
    let processedCount = 0;
    const CONCURRENCY = 5;

    for (let i = 0; i < selectedUrls.length; i += CONCURRENCY) {
      // Check if we are approaching the 60s limit (leave 5s buffer)
      if (Date.now() - startTime > 55000) {
        await log(sessionId, 'warn', 'Vercel timeout approaching. Stopping early.');
        break;
      }

      const chunk = selectedUrls.slice(i, i + CONCURRENCY);
      
      // Process chunk in parallel
      await Promise.all(chunk.map(async (url) => {
        try {
          const productData = await scrapeProduct(url);
          await saveProduct(productData, url, sessionId);
          processedCount++;
        } catch (err: any) {
          console.error(`Error scraping ${url}:`, err.message);
          await log(sessionId, 'error', `Failed to scrape ${url}: ${err.message}`);
        }
      }));
    }

    // 3. Update session status
    await supabase
      .from('scrape_sessions')
      .update({ 
        status: 'completed',
        total_saved: processedCount
      })
      .eq('id', sessionId);

    return NextResponse.json({ sessionId, processedCount });

  } catch (error: any) {
    console.error('Scrape Route Error:', error.message);
    
    if (sessionId) {
      await supabase
        .from('scrape_sessions')
        .update({ status: 'failed' })
        .eq('id', sessionId);
    }

    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
