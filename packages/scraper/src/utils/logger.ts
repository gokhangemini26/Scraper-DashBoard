import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

export type LogLevel = 'info' | 'warn' | 'error' | 'success';

export const log = async (sessionId: string, level: LogLevel, message: string) => {
  console.log(`[${level.toUpperCase()}] [${sessionId}] - ${message}`);
  
  if (!supabaseUrl || !supabaseKey) return;
  
  try {
    const { error } = await supabase.from('scrape_logs').insert({
      session_id: sessionId,
      level,
      message,
    });
    
    if (error) {
      console.error('Log DB Error:', error.message);
    }
  } catch (err: any) {
    console.error('Log Runtime Error:', err.message);
  }
};
