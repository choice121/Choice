import { createClient } from '@supabase/supabase-js';
import { CREDENTIALS_CONFIG } from '../credentials-config.mjs';

const SUPABASE_URL = CREDENTIALS_CONFIG.SUPABASE_URL;
const KEY = CREDENTIALS_CONFIG.SUPABASE_API_KEY;
const token = process.argv[2] || process.env.SUPABASE_ACCESS_TOKEN || "";

const supabase = createClient(SUPABASE_URL, KEY);

async function run() {
  console.log('Adding view_count and last_viewed_at to property_shares...');
  const res = await fetch(`https://api.supabase.com/v1/projects/tlfmwetmhthpyrytrcfo/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: `
        ALTER TABLE public.property_shares ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0;
        ALTER TABLE public.property_shares ADD COLUMN IF NOT EXISTS last_viewed_at timestamp with time zone;
      `
    })
  });
  const text = await res.text();
  console.log('Migration response:', res.status, text);
}

run().catch(console.error);
