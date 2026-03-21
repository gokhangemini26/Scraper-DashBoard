import { supabase, log } from '../utils/logger';
import { ProductData } from './productScraper';

export const saveProduct = async (productData: ProductData, url: string, sessionId: string) => {
  try {
    const { error } = await supabase.from('products').upsert({
      ...productData,
      source_url: url,
      scrape_session_id: sessionId
    }, { onConflict: 'source_url' });

    if (error) throw new Error(error.message);

    // Call RPC to increment total_saved (or we can just let frontend count via realtime)
    // Actually, updating total_saved via SQL or Supabase update might be safer
    // But since realtime is used, it's ok to just log it
    await log(sessionId, 'success', `Saved: ${productData.title}`);
    
    // Update session stats
    await supabase.rpc('increment_session_stats', { p_session_id: sessionId, p_type: 'saved' })
      .catch(() => {
        // Fallback if RPC doesn't exist
        supabase.from('scrape_sessions')
          .select('total_saved').eq('id', sessionId).single()
          .then(({ data }) => {
            if (data) supabase.from('scrape_sessions').update({ total_saved: data.total_saved + 1 }).eq('id', sessionId).then();
          });
      });

  } catch (error: any) {
    console.error('saveProduct Error:', error.message);
    await log(sessionId, 'error', `Failed to save product: ${url}`);
    
    await supabase.from('failed_jobs').insert({
      session_id: sessionId,
      url,
      error_message: error.message
    });
    
    // Fallback increment total_failed
    supabase.from('scrape_sessions')
      .select('total_failed').eq('id', sessionId).single()
      .then(({ data }) => {
        if (data) supabase.from('scrape_sessions').update({ total_failed: data.total_failed + 1 }).eq('id', sessionId).then();
      });
  }
};
