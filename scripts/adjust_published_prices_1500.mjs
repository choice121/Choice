import { CREDENTIALS_CONFIG } from '../credentials-config.mjs';

const SUPABASE_URL = CREDENTIALS_CONFIG.SUPABASE_URL;
const KEY = CREDENTIALS_CONFIG.SUPABASE_API_KEY;

const HEADERS = {
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

async function adjustPrices() {
  console.log('Adjusting properties with prices above $1,500 down to exactly $1,500...');

  // 1. 285 S Champion Ave (29790138-d8c0-4b9d-bf58-3062158bc6a9)
  const res1 = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.29790138-d8c0-4b9d-bf58-3062158bc6a9`, {
    method: 'PATCH',
    headers: HEADERS,
    body: JSON.stringify({
      monthly_rent: 1500,
      security_deposit: 1500
    })
  });
  console.log('285 S Champion Ave (public.properties):', res1.status);

  await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.PP-E6E3682A`, {
    method: 'PATCH',
    headers: HEADERS_PIPELINE,
    body: JSON.stringify({ monthly_rent: 1500, security_deposit: 1500 })
  });

  // 2. 4808 McAllister Ave (5be1d239-259f-41d2-b712-0f5061d2e9d4)
  // Needs description rent text adjusted from $1,700 to $1,500
  const get2 = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.5be1d239-259f-41d2-b712-0f5061d2e9d4&select=description`, { headers: HEADERS });
  const [data2] = await get2.json();
  const updatedDesc2 = (data2?.description || '').replace(/\$1,700/g, '$1,500').replace(/\$1700/g, '$1,500');

  const res2 = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.5be1d239-259f-41d2-b712-0f5061d2e9d4`, {
    method: 'PATCH',
    headers: HEADERS,
    body: JSON.stringify({
      monthly_rent: 1500,
      security_deposit: 1500,
      description: updatedDesc2
    })
  });
  console.log('4808 McAllister Ave (public.properties):', res2.status);

  await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.PP-93486427`, {
    method: 'PATCH',
    headers: HEADERS_PIPELINE,
    body: JSON.stringify({ monthly_rent: 1500, security_deposit: 1500, description: updatedDesc2 })
  });

  // 3. 1138-1140 Wilson Ave (76ce9415-b18b-4b53-a6fa-4c3106548bbc)
  const res3 = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.76ce9415-b18b-4b53-a6fa-4c3106548bbc`, {
    method: 'PATCH',
    headers: HEADERS,
    body: JSON.stringify({
      monthly_rent: 1500,
      security_deposit: 1500
    })
  });
  console.log('1138-1140 Wilson Ave (public.properties):', res3.status);

  await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.PP-38376A79`, {
    method: 'PATCH',
    headers: HEADERS_PIPELINE,
    body: JSON.stringify({ monthly_rent: 1500, security_deposit: 1500 })
  });

  console.log('\nPrice adjustments complete! Verifying all 5 properties under the magic link...');
}

adjustPrices().catch(console.error);
