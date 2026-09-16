import { CREDENTIALS_CONFIG } from '../credentials-config.mjs';
import fs from 'fs';

const SUPABASE_URL = CREDENTIALS_CONFIG.SUPABASE_URL;
const KEY = CREDENTIALS_CONFIG.SUPABASE_API_KEY;

const HEADERS = {
  'apikey': KEY,
  'Authorization': 'Bearer ' + KEY,
};

async function run() {
  const published = JSON.parse(fs.readFileSync('scripts/columbus_15_published_results.json', 'utf8'));
  console.log(`Inspecting ${published.length} properties in DB...`);

  for (let i = 0; i < published.length; i++) {
    const item = published[i];
    const res = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${item.id}&select=*`, {
      headers: HEADERS
    });
    const [prop] = await res.json();
    if (!prop) {
      console.log(`${i + 1}. ${item.address}: NOT FOUND IN DB!`);
      continue;
    }

    const photoRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos?property_id=eq.${item.id}&select=id,url,display_order`, {
      headers: HEADERS
    });
    const photos = await photoRes.json();
    const ikPhotos = photos.filter(p => p.url && p.url.startsWith('https://ik.imagekit.io'));
    const hasSecDepositInDesc = /security deposit/i.test(prop.description || '');
    const hasWelcome = /welcome to/i.test(prop.description || '');
    const hasLeaseInDesc = /lease term|minimum lease|12 month/i.test(prop.description || '');

    console.log(`[${i + 1}] ${prop.address}, ${prop.zip}`);
    console.log(`    Type: ${prop.property_type} | Beds: ${prop.bedrooms} | Baths: ${prop.bathrooms} (total: ${prop.total_bathrooms})`);
    console.log(`    Rent: $${prop.monthly_rent} | Deposit: $${prop.security_deposit} | AppFee: $${prop.application_fee}`);
    console.log(`    Photos Total: ${photos.length} | ImageKit Photos: ${ikPhotos.length}`);
    console.log(`    Violations: SecDepInDesc=${hasSecDepositInDesc}, Welcome=${hasWelcome}, LeaseInDesc=${hasLeaseInDesc}, lease_terms=${JSON.stringify(prop.lease_terms)}`);
  }
}

run().catch(console.error);
