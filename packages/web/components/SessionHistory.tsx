'use client';
import { useEffect, useState } from 'react';
import { useScrapeStore } from '@/stores/scrapeStore';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History } from 'lucide-react';

export default function SessionHistory() {
  const [sessions, setSessions] = useState<any[]>([]);
  const { currentSessionId, setCurrentSession } = useScrapeStore();

  useEffect(() => {
    // Fetch last 20 sessions on mount or when active session is updated 
    fetch('/api/sessions')
      .then(res => res.json())
      .then(data => {
        if (data.sessions) setSessions(data.sessions);
      })
      .catch(console.error);
  }, [currentSessionId]); 

  return (
    <Card className="h-[calc(100vh-2rem)] flex flex-col sticky top-4">
      <CardHeader className="py-4">
        <CardTitle className="text-lg flex items-center">
          <History className="w-5 h-5 mr-2 text-muted-foreground" />
          Geçmiş Taramalar
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full px-4 pb-4">
          <div className="flex flex-col gap-3">
            {sessions.map(session => (
              <div 
                key={session.id} 
                className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 hover:shadow-md ${currentSessionId === session.id ? 'border-primary bg-primary/10 shadow-sm' : 'border-border/60 hover:border-primary/50 hover:bg-muted/50'}`}
                onClick={() => setCurrentSession(session.id)}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-foreground truncate max-w-[120px]" title={session.target_url}>
                    {session.target_url ? new URL(session.target_url).hostname.replace('www.', '') : 'Bilinmeyen'}
                  </span>
                  <Badge 
                    variant={session.status === 'completed' ? 'secondary' : session.status === 'running' ? 'default' : session.status === 'failed' ? 'destructive' : 'outline'} 
                    className={`scale-90 origin-top-right ${session.status === 'completed' ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30 border-transparent' : ''}`}
                  >
                    {session.status}
                  </Badge>
                </div>
                <div className="flex justify-between text-xs items-center">
                  <span className="text-muted-foreground">{new Date(session.created_at).toLocaleDateString()} {new Date(session.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  <span className="text-primary font-bold">{session.total_saved} ürün</span>
                </div>
              </div>
            ))}
            {sessions.length === 0 && (
              <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed mt-2">
                <History className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-sm">Henüz kayıt yok.</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
