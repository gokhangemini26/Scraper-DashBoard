'use client';
import { useEffect, useState } from 'react';
import { useScrapeStore } from '@/stores/scrapeStore';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';

export default function StatsBar() {
  const { currentSessionId } = useScrapeStore();
  const [stats, setStats] = useState({ total_found: 0, total_saved: 0, total_failed: 0, status: 'pending' });

  useEffect(() => {
    if (!currentSessionId) return;

    const supabase = createClient();
    
    // Initial fetch
    supabase.from('scrape_sessions')
      .select('*')
      .eq('id', currentSessionId)
      .single()
      .then(({ data }) => { if (data) setStats(data as any); });

    // Realtime subscription
    const channel = supabase
      .channel(`session-${currentSessionId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'scrape_sessions', 
        filter: `id=eq.${currentSessionId}` 
      }, (payload) => {
        setStats(payload.new as any);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentSessionId]);

  if (!currentSessionId) return null;

  return (
    <Card className="mt-6 border-primary/40 bg-primary/10">
      <CardContent className="p-4 flex flex-wrap gap-8">
        <div className="flex flex-col">
          <p className="text-xs text-muted-foreground uppercase font-semibold">Durum</p>
          <span className="text-xl font-bold uppercase tracking-wider text-primary">{stats.status}</span>
        </div>
        <div className="flex flex-col">
          <p className="text-xs text-muted-foreground uppercase font-semibold">Kaydedilen Ürün</p>
          <span className="text-3xl font-black text-green-500">{stats.total_saved}</span>
        </div>
        <div className="flex flex-col">
          <p className="text-xs text-muted-foreground uppercase font-semibold">Hatalı URL'ler</p>
          <span className="text-3xl font-black text-destructive">{stats.total_failed}</span>
        </div>
      </CardContent>
    </Card>
  );
}
