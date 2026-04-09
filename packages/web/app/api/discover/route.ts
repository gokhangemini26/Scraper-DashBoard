import { NextResponse } from 'next/server';
import { discoverLinks } from '@/lib/scraper/discoverer';

// Vercel serverless function timeout (max 60s on Hobby, 300s on Pro)
export const maxDuration = 60;

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

    // DIRECTLY use the link discoverer function (Serverless)
    const links = await discoverLinks(url);
    
    return NextResponse.json({ links });

  } catch (error: any) {
    console.error('Discover Route Error:', error.message);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
