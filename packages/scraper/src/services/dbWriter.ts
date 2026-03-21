import { supabase, log } from '../utils/logger';
import { ProductData } from './productScraper';

export const saveProduct = async (productData: ProductData, url: string, sessionId: string) => {
  if (!supabase) {
    console.error('saveProduct: Supabase client unavailable');
    return;
  }

  try {
    const { error } = await supabase.from('products').upsert({
      ...productData,
      source_url: url,
      scrape_session_id: sessionId
    }, { onConflict: 'source_url' });

    if (error) throw new Error(error.message);

    await log(sessionId, 'success', `Saved: ${productData.title}`);
    
    // Directly increment total_saved counter
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
      console.log(`[DB] total_saved incremented to ${(data.total_saved || 0) + 1}`);
    }

  } catch (error: any) {
    console.error('saveProduct Error:', error.message);
    await log(sessionId, 'error', `Failed to save product: ${url}`);
    
    try {
      await supabase.from('failed_jobs').insert({
        session_id: sessionId,
        url,
        error_message: error.message
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
