'use client';
import { useScrapeStore } from '@/stores/scrapeStore';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play, Loader2, StopCircle } from 'lucide-react';

export default function CategoryTree() {
  const { discoveredLinks, selectedLinks, toggleLink, selectAll, clearAll, isScraping, currentSessionId, setCurrentSession, setScraping } = useScrapeStore();

  const handleStartScrape = async () => {
    if (selectedLinks.length === 0) return;
    setScraping(true);
    
    const originUrl = new URL(selectedLinks[0]).origin;

    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl: originUrl,
          selectedUrls: selectedLinks,
          config: { maxProducts: 50, downloadImages: true }
        })
      });
      const data = await res.json();
      if (res.ok && data.sessionId) {
        setCurrentSession(data.sessionId);
      }
    } catch (e) {
      console.error(e);
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
        <CardTitle>Keşfedilen Kategoriler</CardTitle>
        <CardDescription>{discoveredLinks.length} adet hedef sayfa bulundu. Taramak istediklerinizi seçin.</CardDescription>
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
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Taranıyor...</>
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
