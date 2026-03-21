import crypto from 'crypto';
import { supabase } from '../utils/logger';

export const uploadImages = async (imageUrls: string[], sku: string | null, url: string): Promise<string[]> => {
  const publicUrls: string[] = [];

  for (let i = 0; i < imageUrls.length; i++) {
    const imgUrl = imageUrls[i];
    try {
      const response = await fetch(imgUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Safari/537.36' },
        signal: AbortSignal.timeout(15000)
      });
      
      if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const ext = contentType.split('/')[1] || 'jpg';
      
      const identifier = sku ? sku.replace(/[^a-zA-Z0-9-]/g, '') : crypto.createHash('md5').update(url).digest('hex');
      const filename = `${identifier}-${i + 1}.${ext}`;

      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(filename, buffer, {
          contentType,
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.error('Upload Error:', error.message);
        publicUrls.push(imgUrl); // Fallback to original URL
      } else {
        const { data: publicData } = supabase.storage.from('product-images').getPublicUrl(filename);
        publicUrls.push(publicData.publicUrl);
      }
    } catch (e) {
      console.error(`Failed to process image ${imgUrl}:`, e);
      publicUrls.push(imgUrl); // Fallback to original
    }
  }

  return publicUrls;
};
