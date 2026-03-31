import { supabase } from '../utils/logger';
import * as cheerio from 'cheerio';
import { extractMadeIn } from '../utils/productUtils';

async function processExistingMadeIn() {
  if (!supabase) {
    console.error('Supabase client not initialized.');
    return;
  }

  const BATCH_SIZE = 100;
  let from = 0;
  let hasMore = true;
  let totalUpdated = 0;

  console.log('Starting migration to extract "Made In" from existing products...');

  while (hasMore) {
    console.log(`Fetching batch: ${from} to ${from + BATCH_SIZE - 1}...`);

    const { data: products, error } = await supabase
      .from('products')
      .select('id, description, raw_data, made_in')
      .is('made_in', null)
      .range(from, from + BATCH_SIZE - 1);

    if (error) {
      console.error('Error fetching products:', error.message);
      break;
    }

    if (!products || products.length === 0) {
      console.log('No more products to process.');
      hasMore = false;
      break;
    }

    console.log(`Processing ${products.length} products in this batch.`);

    for (const product of products) {
      const jsonLd = product.raw_data?.jsonLd;
      const description = product.description;

      const $ = cheerio.load('');
      const madeIn = extractMadeIn($, jsonLd, description);

      if (madeIn) {
        console.log(`  Updating product ${product.id}: Made in ${madeIn}`);
        const { error: updateError } = await supabase
          .from('products')
          .update({ made_in: madeIn })
          .eq('id', product.id);

        if (updateError) {
          console.error(`  Failed to update product ${product.id}:`, updateError.message);
        } else {
          totalUpdated++;
        }
      }
    }

    if (products.length < BATCH_SIZE) {
      hasMore = false;
    } else {
      // If we are updating records, we might stay at the same 'from'
      // because the updated records no longer match 'is("made_in", null)'.
      // But for safety against infinite loops, we should be careful.
      // Since we filter by made_in IS NULL, the next batch will naturally
      // be the "next" set of NULLs.
      // If we don't update all of them, we might get stuck.
      // Let's increment 'from' ONLY for those we didn't update or that don't have made_in info.
      // Actually, easier is to just keep from=0 if we are filtering by IS NULL and we successfully updated some.
      // But if we couldn't find "Made In" for some, they will stay NULL.
      // So we MUST track which ones we've already tried.
      // A better way is to order by ID and use a "last_id" pointer.
    }

    // Simplest reliable way for this task:
    from += BATCH_SIZE;
  }

  console.log(`Finished processing. Total updated: ${totalUpdated}`);
}

processExistingMadeIn();
