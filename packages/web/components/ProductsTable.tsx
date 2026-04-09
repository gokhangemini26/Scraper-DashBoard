'use client';
import { useEffect, useState } from 'react';
import { useScrapeStore } from '@/stores/scrapeStore';
import { createClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

import { exportSessionToExcel, exportSessionImagesToZip } from '@/lib/exportUtils';
import { Button } from '@/components/ui/button';
import { Download, FileArchive, Loader2 } from 'lucide-react';

export default function ProductsTable() {
  const { currentSessionId } = useScrapeStore();
  const [products, setProducts] = useState<any[]>([]);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);

  useEffect(() => {
    if (!currentSessionId) {
      setProducts([]);
      return;
    }

    const supabase = createClient();

    const fetchInitial = async () => {
      const { data } = await supabase.from('products').select('*').eq('scrape_session_id', currentSessionId).order('created_at', { ascending: false }).limit(50);
      if (data) setProducts(data);
    };
    fetchInitial();

    const channel = supabase
      .channel(`products-${currentSessionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'products',
        filter: `scrape_session_id=eq.${currentSessionId}`
      }, (payload) => {
        setProducts(prev => [payload.new, ...prev].slice(0, 50));
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'products',
        filter: `scrape_session_id=eq.${currentSessionId}`
      }, (payload) => {
        setProducts(prev => {
          const exists = prev.find(p => p.id === payload.new.id);
          if (exists) {
            return prev.map(p => p.id === payload.new.id ? payload.new : p);
          } else {
            return [payload.new, ...prev].slice(0, 50);
          }
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentSessionId]);

  const handleExportExcel = async () => {
    if (!currentSessionId) return;
    setIsExportingExcel(true);
    await exportSessionToExcel(currentSessionId);
    setIsExportingExcel(false);
  };

  const handleExportZip = async () => {
    if (!currentSessionId) return;
    setIsExportingZip(true);
    await exportSessionImagesToZip(currentSessionId);
    setIsExportingZip(false);
  };

  if (!currentSessionId) return null;

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Döküm: Son Eklenen Ürünler</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={isExportingExcel}>
            {isExportingExcel ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Excel İndir
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportZip} disabled={isExportingZip}>
            {isExportingZip ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileArchive className="w-4 h-4 mr-2" />}
            Tüm Resimleri ZIP'le
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[80px]">Görsel</TableHead>
                <TableHead>Başlık</TableHead>
                <TableHead>Fiyat</TableHead>
                <TableHead>Stok</TableHead>
                <TableHead>SKU</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    {product.images && product.images[0] ? (
                      <div className="w-12 h-12 relative rounded-md overflow-hidden bg-muted border border-border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={product.images[0]} alt={product.title} className="object-cover w-full h-full" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center text-xs border border-border text-muted-foreground">Yok</div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium max-w-[200px] sm:max-w-[300px]" title={product.title}>
                    <a href={product.source_url} target="_blank" rel="noreferrer" className="hover:underline line-clamp-2">{product.title}</a>
                  </TableCell>
                  <TableCell className="font-semibold text-primary">
                    {product.price ? `${product.price} ${product.currency || 'TL'}` : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.in_stock ? 'default' : 'destructive'} className={product.in_stock ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30' : ''}>
                      {product.in_stock ? 'Stokta' : 'Tükendi'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">{product.sku || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
