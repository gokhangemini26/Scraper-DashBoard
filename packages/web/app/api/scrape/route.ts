import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const SCRAPER_URL = process.env.SCRAPER_SERVICE_URL || 'http://localhost:3001';
const SCRAPER_TOKEN = process.env.SCRAPER_SECRET_TOKEN || 'generate-a-random-string-here';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { targetUrl, selectedUrls, config } = body;

    if (!targetUrl || !selectedUrls || !Array.isArray(selectedUrls)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const supabase = createClient();
    
    // Create new scrape session
    const { data: session, error: dbError } = await supabase
      .from('scrape_sessions')
      .insert({
        target_url: targetUrl,
        status: 'pending',
        config: config || {}
      })
      .select('id')
      .single();

    if (dbError || !session) {
      throw new Error(`Failed to create session: ${dbError?.message}`);
    }

    // Trigger scraper asynchronously
    fetch(`${SCRAPER_URL}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SCRAPER_TOKEN}`
      },
      body: JSON.stringify({
        targetUrl,
        selectedUrls,
        config: config || { maxProducts: 100, downloadImages: true },
        sessionId: session.id
      })
    }).catch(err => {
      console.error('Failed to trigger scraper:', err.message);
    });

    return NextResponse.json({ sessionId: session.id });

  } catch (error: any) {
    console.error('Scrape Route Error:', error.message);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
