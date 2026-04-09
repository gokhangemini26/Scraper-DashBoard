import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { createClient } from './supabase/client';

// ─── Colour palette ──────────────────────────────────────────────────────────
const COLORS = {
  headerBg: '1E1E2E',      // dark header
  headerFg: 'FFFFFF',      // white text
  altRow:   'F5F5FA',      // light grey alternate row
  accent:   '6366F1',      // indigo accent (borders)
  inStock:  'D1FAE5',      // green bg
  outStock: 'FEE2E2',      // red bg
  bold:     '1E1E2E',
};

// ─── Helper: fetch image → base64 ────────────────────────────────────────────
async function imageUrlToBase64(url: string): Promise<{ base64: string; ext: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const blob = await res.blob();
    const ext = (blob.type.split('/')[1] || 'jpeg').replace('jpeg', 'jpeg');
    const ab = await blob.arrayBuffer();
    const bytes = new Uint8Array(ab);
    let binary = '';
    bytes.forEach(b => (binary += String.fromCharCode(b)));
    return { base64: btoa(binary), ext };
  } catch {
    return null;
  }
}

// ─── Column definitions ────────────────────────────────────────────────────
const COLUMNS = [
  { key: 'photo',               header: '📷 Fotoğraf',            width: 20 },
  { key: 'sku',                 header: 'SKU / Ürün Kodu',        width: 18 },
  { key: 'barcode',             header: 'Barkod (GTIN)',          width: 20 },
  { key: 'title',               header: 'Ürün Adı',               width: 40 },
  { key: 'brand',               header: 'Marka',                  width: 18 },
  { key: 'category',            header: 'Kategori',               width: 30 },
  { key: 'gender',              header: 'Cinsiyet',               width: 12 },
  { key: 'collection',          header: 'Koleksiyon',             width: 18 },
  { key: 'color',               header: 'Renk',                   width: 14 },
  { key: 'sizes',               header: 'Bedenler',               width: 22 },
  { key: 'material',            header: 'Materyal / Kumaş',       width: 24 },
  { key: 'country_of_origin',   header: 'Üretim Yeri (Made In)',  width: 20 },
  { key: 'price',               header: 'Fiyat',                  width: 12 },
  { key: 'sale_price',          header: 'İndirimli Fiyat',        width: 14 },
  { key: 'currency',            header: 'Para Birimi',            width: 12 },
  { key: 'in_stock',            header: 'Stok',                   width: 12 },
  { key: 'weight',              header: 'Ağırlık',                width: 12 },
  { key: 'dimensions',          header: 'Boyutlar',               width: 14 },
  { key: 'description',         header: 'Açıklama',               width: 50 },
  { key: 'ingredients',         header: 'İçerik (Ingredients)',   width: 50 }, // New column
  { key: 'image_urls',          header: 'Tüm Resim URL\'leri',    width: 60 },
  { key: 'source_url',          header: 'Kaynak URL',             width: 50 },
  { key: 'created_at',          header: 'Tarih',                  width: 18 },
];

// ─── Main export ─────────────────────────────────────────────────────────────
export const exportSessionToExcel = async (sessionId: string) => {
  const supabase = createClient();
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('scrape_session_id', sessionId)
    .order('created_at');

  if (!products || products.length === 0) {
    alert('İndirilecek veri yok!');
    return false;
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SmartScraper Dashboard';
  workbook.created = new Date();

  // ── Sheet 1: Ürünler (with embedded images) ──────────────────────────────
  const ws = workbook.addWorksheet('Çekilen Ürünler', {
    views: [{ state: 'frozen', ySplit: 1 }],
    pageSetup: { orientation: 'landscape', fitToPage: true },
  });

  // Header row
  ws.columns = COLUMNS.map(c => ({ key: c.key, width: c.width }));
  const headerRow = ws.addRow(COLUMNS.map(c => c.header));
  headerRow.height = 28;
  headerRow.eachCell(cell => {
    cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } };
    cell.font   = { bold: true, color: { argb: COLORS.headerFg }, name: 'Arial', size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      bottom: { style: 'medium', color: { argb: COLORS.accent } },
    };
  });

  const PHOTO_COL_IDX = 1; // Column A = photo
  const ROW_HEIGHT    = 110; // px height for image rows

  // Data rows
  for (let i = 0; i < products.length; i++) {
    const p   = products[i];
    const row = i + 2; // 1-indexed, row 1 = header

    const excelRow = ws.addRow({
      photo:              '', // placeholder, image added below
      sku:                p.sku              || '-',
      barcode:            p.barcode          || '-',
      title:              p.title,
      brand:              p.brand            || '-',
      category:           p.category         || '-',
      gender:             p.gender           || '-',
      collection:         p.collection       || '-',
      color:              p.color            || '-',
      sizes:              (p.sizes || []).join(', ') || '-',
      material:           p.material         || '-',
      country_of_origin:  p.country_of_origin || '-',
      price:              p.price            || 0,
      sale_price:         p.sale_price       || '-',
      currency:           p.currency         || 'TRY',
      in_stock:           p.in_stock ? 'Mevcut ✓' : 'Tükendi ✗',
      weight:             p.weight           || '-',
      dimensions:         p.dimensions       || '-',
      description:        p.description      || '-',
      ingredients:        p.ingredients      || '-',
      image_urls:         (p.images || []).join('\n'),
      source_url:         p.source_url,
      created_at:         p.created_at ? new Date(p.created_at).toLocaleString('tr-TR') : '-',
    });

    excelRow.height = ROW_HEIGHT;

    // Alternate row background
    const rowBg = i % 2 === 1 ? COLORS.altRow : 'FFFFFF';

    excelRow.eachCell((cell, colNum) => {
      if (colNum === PHOTO_COL_IDX) return; // handled separately

      cell.font      = { name: 'Arial', size: 10, color: { argb: COLORS.bold } };
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.border    = { bottom: { style: 'thin', color: { argb: 'E5E7EB' } } };

      // Price: right-aligned
      if (['price', 'sale_price'].includes(cell.name)) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        if (typeof cell.value === 'number') {
          cell.numFmt = '#,##0.00';
        }
      }

      // Stock: colored background
      if (cell.name === 'in_stock') {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.fill = {
          type: 'pattern', pattern: 'solid',
          fgColor: { argb: p.in_stock ? COLORS.inStock.replace('#', '') : COLORS.outStock.replace('#', '') },
        };
      }
    });

    // ── Embed product image ──────────────────────────────────────────────
    if (p.images && p.images.length > 0) {
      const imgData = await imageUrlToBase64(p.images[0]);
      if (imgData) {
        const ext = imgData.ext === 'jpeg' ? 'jpeg' : (imgData.ext === 'png' ? 'png' : 'jpeg');
        const imageId = workbook.addImage({
          base64: imgData.base64,
          extension: ext as 'jpeg' | 'png',
        });

        ws.addImage(imageId, {
          tl: { col: PHOTO_COL_IDX - 1, row: row - 1 } as any,      // top-left cell (0-indexed)
          br: { col: PHOTO_COL_IDX,     row: row     } as any,       // bottom-right cell
          editAs: 'oneCell',
        });
      }
    }
  }

  // ── Sheet 2: Özet İstatistikler ──────────────────────────────────────────
  const ws2 = workbook.addWorksheet('📊 Özet');
  ws2.columns = [
    { key: 'metric', width: 30 },
    { key: 'value',  width: 20 },
  ];

  const totalProducts = products.length;
  const inStockCount  = products.filter(p => p.in_stock).length;
  const uniqueBrands  = [...new Set(products.map(p => p.brand).filter(Boolean))].length;
  const uniqueColors  = [...new Set(products.map(p => p.color).filter(Boolean))].length;
  const avgPrice      = products.filter(p => p.price).reduce((s, p) => s + (p.price || 0), 0) / (products.filter(p => p.price).length || 1);
  const withImages    = products.filter(p => p.images?.length > 0).length;
  const withMaterial  = products.filter(p => p.material).length;
  const withOrigin    = products.filter(p => p.country_of_origin).length;

  const summaryTitle = ws2.addRow(['SmartScraper — Oturum Özeti', '']);
  summaryTitle.height = 36;
  summaryTitle.getCell(1).font = { bold: true, size: 16, color: { argb: COLORS.bold }, name: 'Arial' };
  summaryTitle.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EEF2FF' } };

  ws2.addRow([]);

  const summaryRows: [string, string | number][] = [
    ['Toplam Ürün',                totalProducts],
    ['Stokta Mevcut',              inStockCount],
    ['Stokta Yok',                 totalProducts - inStockCount],
    ['Benzersiz Marka Sayısı',     uniqueBrands],
    ['Benzersiz Renk Sayısı',      uniqueColors],
    ['Ortalama Fiyat',             `${avgPrice.toFixed(2)} TRY`],
    ['Resmî Ürün Sayısı',          withImages],
    ['Materyal Bilgisi Olan',      withMaterial],
    ['Üretim Yeri Bilgisi Olan',   withOrigin],
    ['Dışa Aktarma Tarihi',        new Date().toLocaleString('tr-TR')],
  ];

  summaryRows.forEach(([metric, value], idx) => {
    const r = ws2.addRow({ metric, value });
    r.height = 24;
    r.getCell('metric').font  = { bold: true, name: 'Arial', size: 11 };
    r.getCell('metric').fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? 'F9FAFB' : 'FFFFFF' } };
    r.getCell('value').font   = { name: 'Arial', size: 11 };
    r.getCell('value').fill   = r.getCell('metric').fill;
    r.getCell('value').alignment = { horizontal: 'right' };
    r.eachCell(cell => {
      cell.border = { bottom: { style: 'thin', color: { argb: 'E5E7EB' } } };
    });
  });

  // ── Generate file ─────────────────────────────────────────────────────────
  const buffer = await workbook.xlsx.writeBuffer();
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `SmartScraper-Urunler-${sessionId.substring(0, 8)}.xlsx`);
  return true;
};

// ─── ZIP image export (unchanged) ─────────────────────────────────────────
export const exportSessionImagesToZip = async (sessionId: string) => {
  const supabase = createClient();
  const { data: products } = await supabase
    .from('products')
    .select('sku, id, images, title')
    .eq('scrape_session_id', sessionId);

  if (!products || products.length === 0) {
    alert('İndirilecek resim yok!');
    return false;
  }

  const zip = new JSZip();
  let imageCount = 0;

  for (const product of products) {
    if (!product.images || product.images.length === 0) continue;

    const identifier = product.sku
      ? product.sku.replace(/[^a-zA-Z0-9_-]/g, '')
      : product.id.substring(0, 8);
    const folder = zip.folder(identifier);
    if (!folder) continue;

    for (let i = 0; i < product.images.length; i++) {
      const imgUrl = product.images[i];
      try {
        const res = await fetch(imgUrl);
        if (res.ok) {
          const blob = await res.blob();
          let ext = imgUrl.split('.').pop()?.split('?')[0] || 'jpg';
          if (ext.length > 5) ext = 'jpg';
          folder.file(`${identifier}_gorsel_${i + 1}.${ext}`, blob);
          imageCount++;
        }
      } catch {
        console.error(`Görsel indirilemedi: ${imgUrl}`);
      }
    }
  }

  if (imageCount === 0) {
    alert('Hiçbir görsel indirilemedi.');
    return false;
  }

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `SmartScraper-Resimler-${sessionId.substring(0, 8)}.zip`);
  return true;
};
