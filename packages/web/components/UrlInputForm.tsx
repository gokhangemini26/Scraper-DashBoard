'use client';
import { useState } from 'react';
import { useScrapeStore } from '@/stores/scrapeStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Search, Loader2 } from 'lucide-react';

export default function UrlInputForm() {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const { isDiscovering, setDiscovering, setDiscoveredLinks, clearAll } = useScrapeStore();

  const handleDiscover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    try {
      new URL(url);
    } catch {
      setError('Geçerli bir URL giriniz. (Örn: https://example.com)');
      return;
    }

    setError('');
    setDiscovering(true);
    clearAll(); 

    try {
      const res = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Keşif hatası');
      
      const foundLinks = data.links || [];
      setDiscoveredLinks(foundLinks);
      
      if (foundLinks.length === 0) {
        setError('Bu sayfada taranabilir kategori linki bulunamadı. Lütfen farklı bir sayfa deneyin.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDiscovering(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Yeni Tarama Başlat</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleDiscover} className="flex gap-4">
          <Input 
            placeholder="E-ticaret site URL'si (ör. https://example.com)" 
            value={url} 
            onChange={e => setUrl(e.target.value)}
            disabled={isDiscovering}
            className="flex-1"
          />
          <Button type="submit" disabled={isDiscovering}>
            {isDiscovering ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Keşfediliyor...</>
            ) : (
              <><Search className="mr-2 h-4 w-4" /> Linkleri Bul</>
            )}
          </Button>
        </form>
        {error && <p className="text-destructive text-sm mt-2">{error}</p>}
      </CardContent>
    </Card>
  );
}
