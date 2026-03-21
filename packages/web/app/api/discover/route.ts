import { NextResponse } from 'next/server';

const SCRAPER_URL = (process.env.SCRAPER_SERVICE_URL || 'http://localhost:3001').trim().replace(/\/+$/, '');
const SCRAPER_TOKEN = (process.env.SCRAPER_SECRET_TOKEN || 'generate-a-random-string-here').trim();

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    const response = await fetch(`${SCRAPER_URL}/discover?url=${encodeURIComponent(url)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SCRAPER_TOKEN}`
      },
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      throw new Error(`Scraper responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Discover Route Error:', error.message);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
