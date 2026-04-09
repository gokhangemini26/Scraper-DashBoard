import { supabase, log } from '../utils/logger';
import { ProductData } from './productScraper';

export const saveProduct = async (productData: ProductData, url: string, sessionId: string) => {
  if (!supabase) {
    console.error('saveProduct: Supabase client unavailable');
    return;
  }

  try {
    const { error } = await supabase.from('products').upsert(
      {
        // Core
        source_url:        url,
        scrape_session_id: sessionId,
        title:             productData.title,
        description:       productData.description,
        ingredients:       productData.ingredients,

        // Pricing
        price:             productData.price,
        sale_price:        productData.sale_price,
        currency:          productData.currency || 'TRY',

        // Identity
        sku:               productData.sku,
        barcode:           productData.barcode,

        // Stock
        in_stock:          productData.in_stock,

        // Media
        images:            productData.images,

        // Attributes
        brand:             productData.brand,
        category:          productData.category,
        color:             productData.color,
        sizes:             productData.sizes,
        material:          productData.material,
        gender:            productData.gender,
        collection:        productData.collection,
        country_of_origin: productData.country_of_origin,
        weight:            productData.weight,
        dimensions:        productData.dimensions,

        // Variants & raw
        variants:          productData.variants,
        raw_data:          productData.raw_data,
      },
      { onConflict: 'source_url' }
    );

    if (error) throw new Error(error.message);

    await log(sessionId, 'success', `Kaydedildi: ${productData.title}`);

    // Increment total_saved
    const { data } = await supabase
      .from('scrape_sessions')
      .select('total_saved')
      .eq('id', sessionId)
      .single();

    if (data) {
      await supabase
        .from('scrape_sessions')
        .update({ total_saved: (data.total_saved || 0) + 1 })
        .eq('id', sessionId);
    }
  } catch (error: any) {
    console.error('saveProduct Error:', error.message);
    await log(sessionId, 'error', `Kayıt hatası: ${url} — ${error.message}`);

    try {
      await supabase.from('failed_jobs').insert({
        session_id:    sessionId,
        url,
        error_message: error.message,
      });

      const { data } = await supabase
        .from('scrape_sessions')
        .select('total_failed')
        .eq('id', sessionId)
        .single();

      if (data) {
        await supabase
          .from('scrape_sessions')
          .update({ total_failed: (data.total_failed || 0) + 1 })
          .eq('id', sessionId);
      }
    } catch (innerErr: any) {
      console.error('Failed to log failure:', innerErr.message);
    }
  }
};
