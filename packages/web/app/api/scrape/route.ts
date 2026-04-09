import { NextResponse } from 'next/server';
import { supabase, log } from '@/lib/scraper/logger';
import { scrapeProduct } from '@/lib/scraper/productScraper';
import { saveProduct } from '@/lib/scraper/dbWriter';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; 

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { mode, targetUrl, url, sessionId, config } = body;

    // --- MODE: INIT (Create session) ---
    if (mode === 'init') {
      if (!targetUrl) return NextResponse.json({ error: 'targetUrl is required' }, { status: 400 });

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

      return NextResponse.json({ sessionId: session.id });
    }

    // --- MODE: SCRAPE-ITEM (Scrape single product) ---
    if (mode === 'scrape-item') {
      if (!url || !sessionId) {
        return NextResponse.json({ error: 'url and sessionId are required' }, { status: 400 });
      }

      try {
        const productData = await scrapeProduct(url);
        await saveProduct(productData, url, sessionId);
        return NextResponse.json({ success: true, title: productData.title });
      } catch (err: any) {
        console.error(`Error scraping ${url}:`, err.message);
        await log(sessionId, 'error', `Failed to scrape ${url}: ${err.message}`);
        return NextResponse.json({ error: err.message }, { status: 500 });
      }
    }

    // --- MODE: COMPLETE (Finish session) ---
    if (mode === 'complete') {
      if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
      
      await supabase
        .from('scrape_sessions')
        .update({ status: 'completed' })
        .eq('id', sessionId);
        
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });

  } catch (error: any) {
    console.error('Scrape Route Error:', error.message);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
