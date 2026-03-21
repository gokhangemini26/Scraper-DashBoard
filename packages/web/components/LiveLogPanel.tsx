'use client';
import { useEffect, useState, useRef } from 'react';
import { useScrapeStore } from '@/stores/scrapeStore';
import { createClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function LiveLogPanel() {
  const { currentSessionId } = useScrapeStore();
  const [logs, setLogs] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentSessionId) {
      setLogs([]);
      return;
    }

    const supabase = createClient();

    const fetchInitial = async () => {
      const { data } = await supabase.from('scrape_logs').select('*').eq('session_id', currentSessionId).order('created_at', { ascending: true });
      if (data) setLogs(data);
    };
    fetchInitial();

    const channel = supabase
      .channel(`logs-${currentSessionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'scrape_logs',
        filter: `session_id=eq.${currentSessionId}`
      }, (payload) => {
        setLogs(prev => [...prev, payload.new]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentSessionId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  if (!currentSessionId) return null;

  return (
    <Card className="mt-6 font-mono text-sm bg-[#0c0c0c] text-green-400 border-zinc-800 shadow-2xl">
      <CardHeader className="py-2.5 border-b border-zinc-800 bg-[#111]">
        <CardTitle className="text-xs font-semibold text-zinc-400 flex items-center uppercase tracking-wider">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-2 shadow-[0_0_8px_rgba(34,197,94,0.8)]"></span> Canlı Terminal
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 relative">
        <div className="h-[280px] overflow-y-auto p-4 custom-scrollbar">
          {logs.map((log, i) => (
            <div key={log.id || i} className="mb-1.5 leading-snug break-all border-l-2 border-transparent pl-2 hover:border-zinc-700 hover:bg-zinc-900/50">
              <span className="text-zinc-600 mr-3 text-xs">[{new Date(log.created_at).toLocaleTimeString()}]</span>
              <span className={`
                ${log.level === 'error' ? 'text-rose-500 font-bold' : ''}
                ${log.level === 'warn' ? 'text-amber-400' : ''}
                ${log.level === 'info' ? 'text-sky-300 relative top-[-1px]' : ''}
                ${log.level === 'success' ? 'text-emerald-400 font-bold' : ''}
              `}>
                {log.message}
              </span>
            </div>
          ))}
          <div ref={scrollRef} className="h-4" />
        </div>
      </CardContent>
    </Card>
  );
}
