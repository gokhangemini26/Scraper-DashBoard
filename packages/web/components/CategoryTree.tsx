'use client';
import { useState } from 'react';
import * as React from 'react';
import { useScrapeStore } from '@/stores/scrapeStore';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play, Loader2, StopCircle } from 'lucide-react';

export default function CategoryTree() {
  const { discoveredLinks, selectedLinks, toggleLink, selectAll, clearAll, isScraping, currentSessionId, setCurrentSession, setScraping } = useScrapeStore();
  const [error, setError] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState({ current: 0, total: 0 });

  const handleStartScrape = async () => {
    if (selectedLinks.length === 0) return;
    setScraping(true);
    setError(null);
    
    const originUrl = new URL(selectedLinks[0]).origin;
    let sessionId = '';

    try {
      // 1. Initialize Session
      const initRes = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'init',
          targetUrl: originUrl,
          config: { downloadImages: true }
        })
      });

      const initData = await initRes.json();
      if (!initRes.ok || !initData.sessionId) {
        throw new Error(initData.error || 'Oturum başlatılamadı');
      }

      sessionId = initData.sessionId;
      setCurrentSession(sessionId);

      // 2. Expand Queue (If category selected, find products first)
      const finalQueue: string[] = [];
      for (const link of selectedLinks) {
        if (link.includes('/collections/')) {
          console.log(`[EXPAND] Category detected: ${link}. Finding products...`);
          const discRes = await fetch('/api/discover', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: link })
          });
          const discData = await discRes.json();
          if (discRes.ok && discData.links) {
            // Add only products from that category
            const products = discData.links
              .filter((l: any) => l.url.includes('/products/'))
              .map((l: any) => l.url);
            finalQueue.push(...products);
          }
        } else {
          finalQueue.push(link);
        }
      }

      // Remove duplicates
      const uniqueQueue = Array.from(new Set(finalQueue));
      setProgress({ current: 0, total: uniqueQueue.length });

      // 3. Sequential Loop (One-by-One)
      let count = 0;
      for (const url of uniqueQueue) {
        if (!useScrapeStore.getState().isScraping) break;

        count++;
        setProgress({ current: count, total: uniqueQueue.length });

        try {
          console.log(`[SCRAPE] Fetching Product (${count}/${uniqueQueue.length}): ${url}`);
          const itemRes = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'scrape-item', url, sessionId })
          });
          
          if (!itemRes.ok) {
            console.warn(`[SCRAPE] Failed item ${url}`);
          }
        } catch (itemErr: any) {
          console.error(`[SCRAPE] Runtime error for ${url}:`, itemErr.message);
        }
      }

      // 3. Mark Session as Completed
      await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'complete',
          sessionId
        })
      });

    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Bir hata oluştu');
    } finally {
      setScraping(false);
    }
  };

  const handleStopScrape = async () => {
    if (!currentSessionId) return;
    const supabase = createClient();
    await supabase.from('scrape_sessions').update({ status: 'cancelled' }).eq('id', currentSessionId);
    setScraping(false);
  };

  if (discoveredLinks.length === 0) return null;

  return (
    <Card className="mt-6 border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle>Keşfedilen Ürünler</CardTitle>
        <CardDescription>
          {discoveredLinks.length} adet ürün bulundu. 
          <b> Hepsini taramak için "Tümünü Seç" butonuna basın.</b>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Button variant="secondary" size="sm" onClick={selectAll}>Tümünü Seç</Button>
          <Button variant="secondary" size="sm" onClick={clearAll}>Temizle</Button>
          <div className="flex-1" />
          <Button 
            onClick={handleStartScrape} 
            disabled={selectedLinks.length === 0 || isScraping}
            className="font-bold"
          >
            {isScraping ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {progress.current}/{progress.total} Taranıyor...</>
            ) : (
              <><Play className="mr-2 h-4 w-4" /> {selectedLinks.length} Linki Tara</>
            )}
          </Button>
          {isScraping && (
            <Button 
              onClick={handleStopScrape} 
              variant="destructive"
              size="sm"
              className="font-bold"
            >
              <StopCircle className="mr-2 h-4 w-4" /> Durdur
            </Button>
          )}
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md">
            {error}
          </div>
        )}

        <ScrollArea className="h-[350px] border rounded-md p-4 bg-background">
          <div className="flex flex-col gap-3">
            {discoveredLinks.map((link) => (
              <div key={link.url} className="flex items-start space-x-3">
                <Checkbox 
                  id={link.url} 
                  checked={selectedLinks.includes(link.url)}
                  onCheckedChange={() => toggleLink(link.url)}
                  disabled={isScraping}
                  className="mt-1"
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor={link.url}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {link.label || 'Kategori/Liste Sayfası'} <span className="text-muted-foreground ml-2 text-xs">(Derinlik: {link.depth})</span>
                  </label>
                  <p className="text-xs text-muted-foreground break-all">{link.url}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
