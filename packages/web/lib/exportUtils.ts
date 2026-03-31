import * as xlsx from 'xlsx';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { createClient } from './supabase/client';

export const exportSessionToExcel = async (sessionId: string) => {
  const supabase = createClient();
  const { data: products } = await supabase.from('products').select('*').eq('scrape_session_id', sessionId).order('created_at');
  
  if (!products || products.length === 0) {
    alert('İndirilecek veri yok!');
    return false;
  }

  const exportData = products.map(p => ({
    'Sistem ID': p.id,
    'SKU / Ürün Kodu': p.sku || '-',
    'Ürün Başlığı': p.title,
    'Açıklama': p.description || '-',
    'Menşei (Made In)': p.made_in || '-',
    'Fiyat': p.price || 0,
    'İndirimli Fiyat': p.sale_price || '-',
    'Para Birimi': p.currency || 'TRY',
    'Stok Durumu': p.in_stock ? 'Mevcut' : 'Tükendi',
    'Kaynak Link': p.source_url,
    'Resim Linkleri (Virgül ile ayrılmış)': p.images?.join(', ') || ''
  }));

  const worksheet = xlsx.utils.json_to_sheet(exportData);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Çekilen Ürünler');
  
  xlsx.writeFile(workbook, `SmartScraper-Veriler-${sessionId.substring(0,8)}.xlsx`);
  return true;
};

export const exportSessionImagesToZip = async (sessionId: string) => {
  const supabase = createClient();
  const { data: products } = await supabase.from('products').select('sku, id, images').eq('scrape_session_id', sessionId);
  
  if (!products || products.length === 0) {
    alert('İndirilecek resim yok!');
    return false;
  }

  const zip = new JSZip();
  let imageCount = 0;

  for (const product of products) {
    if (!product.images || product.images.length === 0) continue;
    
    // Klasör adı ürünün SKU'su ya da veritabanı ID'si (eşleşebilmesi için)
    const identifier = product.sku ? product.sku.replace(/[^a-zA-Z0-9_-]/g, '') : product.id.substring(0, 8);
    const folder = zip.folder(identifier);

    if (!folder) continue;

    for (let i = 0; i < product.images.length; i++) {
      const imgUrl = product.images[i];
      try {
        const response = await fetch(imgUrl);
        if (response.ok) {
          const blob = await response.blob();
          // Uzantıyı tahmin et
          let ext = imgUrl.split('.').pop()?.split('?')[0] || 'jpg';
          if (ext.length > 5) ext = 'jpg'; // Garanti olsun
          
          folder.file(`${identifier}_gorsel_${i + 1}.${ext}`, blob);
          imageCount++;
        }
      } catch (err) {
        console.error(`Görsel indirilemedi: ${imgUrl}`);
      }
    }
  }

  if (imageCount === 0) {
    alert('Hiçbir görsel indirilemedi.');
    return false;
  }

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `SmartScraper-Resimler-${sessionId.substring(0,8)}.zip`);
  return true;
};
