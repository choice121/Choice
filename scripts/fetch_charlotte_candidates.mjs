import fs from 'fs';
import { CREDENTIALS_CONFIG } from '../credentials-config.mjs';

const { SUPABASE_URL, SUPABASE_API_KEY } = CREDENTIALS_CONFIG;
const headers = {
  'apikey': SUPABASE_API_KEY,
  'Authorization': 'Bearer ' + SUPABASE_API_KEY,
  'Content-Type': 'application/json'
};

async function run() {
  const deduped = JSON.parse(fs.readFileSync('scripts/deduped_payloads.json', 'utf8'));
  const charlotte1Bed = deduped.filter(d => {
    const isCharlotte = (d.city || '').toLowerCase().includes('charlotte') || (d.state || '').toLowerCase() === 'nc';
    const rent = Number(d.rent);
    const beds = Number(d.beds);
    return isCharlotte && rent <= 1500 && (beds === 1 || beds === 0);
  });

  console.log('Charlotte 1-bed/studio candidates found in storage index:', charlotte1Bed.length);

  const fullPayloads = [];
  for (const item of charlotte1Bed) {
    console.log('Fetching', item.file, 'for', item.address);
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/pipeline-raw-payloads/${item.file}`, {
      headers
    });
    if (res.ok) {
      const payload = await res.json();
      fullPayloads.push({
        file: item.file,
        payload
      });
    } else {
      console.warn('Failed to fetch', item.file, res.status);
    }
  }

  console.log('Successfully fetched full payloads:', fullPayloads.length);
  fs.writeFileSync('scripts/charlotte_full_payloads.json', JSON.stringify(fullPayloads, null, 2));
}

run().catch(console.error);
