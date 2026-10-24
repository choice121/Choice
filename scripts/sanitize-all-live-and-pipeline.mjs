import { CREDENTIALS_CONFIG } from '../credentials-config.mjs';
import { sanitizeProhibitedDescription } from './description-sanitizer.mjs';

const SUPABASE_URL = CREDENTIALS_CONFIG.SUPABASE_URL;
const KEY = CREDENTIALS_CONFIG.SUPABASE_API_KEY;

const HEADERS_PUBLIC = {
  'apikey': KEY,
  'Authorization': 'Bearer ' + KEY,
  'Content-Type': 'application/json'
};

const HEADERS_PIPELINE = {
  'apikey': KEY,
  'Authorization': 'Bearer ' + KEY,
  'Content-Type': 'application/json',
  'Accept-Profile': 'pipeline',
  'Content-Profile': 'pipeline'
};

function cleanDescription(desc) {
  if (!desc || typeof desc !== 'string') return desc;
  let cleaned = sanitizeProhibitedDescription(desc);
  
  // Clean up any remaining trailing/hanging headers
  cleaned = cleaned.replace(/REQUIREMENTS\s*&\s*QUALIFICATIONS:?\s*/gi, '');
  cleaned = cleaned.replace(/QUALIFICATIONS:?\s*/gi, '');
  cleaned = cleaned.replace(/REQUIREMENTS:?\s*/gi, '');
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  // Ensure application fee notice is formatted cleanly if missing
  if (!cleaned.includes('$50') && !cleaned.includes('50 application fee')) {
    cleaned += '\n\nApplication Fee: $50. Submit your rental application today at Choice Properties.';
  }

  return cleaned.trim();
}

async function fetchAll(table, headers) {
  let allRows = [];
  let from = 0;
  const pageSize = 500;
  while (true) {
    const to = from + pageSize - 1;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id,title,description`, {
      headers: {
        ...headers,
        'Range': `${from}-${to}`
      }
    });
    if (!res.ok) {
      console.error(`Failed to fetch ${table} range ${from}-${to}:`, res.status, await res.text());
      break;
    }
    const rows = await res.json();
    if (!rows || rows.length === 0) break;
    allRows = allRows.concat(rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return allRows;
}

async function run() {
  console.log('--- Fetching public.properties with full pagination ---');
  const publicProps = await fetchAll('properties', HEADERS_PUBLIC);
  console.log(`Found ${publicProps.length} total public properties.`);

  let pubUpdated = 0;
  for (const p of publicProps) {
    const orig = p.description || '';
    const cleaned = cleanDescription(orig);
    if (cleaned !== orig) {
      console.log(`[PUBLIC] Updating property ${p.id} (${p.title || 'No Title'})...`);
      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${p.id}`, {
        method: 'PATCH',
        headers: HEADERS_PUBLIC,
        body: JSON.stringify({ description: cleaned })
      });
      if (updateRes.ok) {
        pubUpdated++;
      } else {
        console.error(`Failed to update ${p.id}:`, await updateRes.text());
      }
    }
  }
  console.log(`Public properties sanitized: ${pubUpdated} / ${publicProps.length}`);

  console.log('\n--- Fetching pipeline.pipeline_properties ---');
  const pipeProps = await fetchAll('pipeline_properties', HEADERS_PIPELINE);
  console.log(`Found ${pipeProps.length} pipeline properties.`);

  let pipeUpdated = 0;
  for (const p of pipeProps) {
    const orig = p.description || '';
    const cleaned = cleanDescription(orig);
    if (cleaned !== orig) {
      console.log(`[PIPELINE] Updating pipeline property ${p.id} (${p.title || 'No Title'})...`);
      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${p.id}`, {
        method: 'PATCH',
        headers: HEADERS_PIPELINE,
        body: JSON.stringify({ description: cleaned })
      });
      if (updateRes.ok) {
        pipeUpdated++;
      } else {
        console.error(`Failed to update pipeline prop ${p.id}:`, await updateRes.text());
      }
    }
  }
  console.log(`Pipeline properties sanitized: ${pipeUpdated} / ${pipeProps.length}`);
}

run().catch(console.error);
