import { CREDENTIALS_CONFIG } from '../credentials-config.mjs';

const SUPABASE_URL = CREDENTIALS_CONFIG.SUPABASE_URL;
const KEY = CREDENTIALS_CONFIG.SUPABASE_API_KEY;

const HEADERS = {
  'apikey': KEY,
  'Authorization': 'Bearer ' + KEY,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

const HEADERS_PIPELINE = {
  'apikey': KEY,
  'Authorization': 'Bearer ' + KEY,
  'Content-Type': 'application/json',
  'Accept-Profile': 'pipeline',
  'Content-Profile': 'pipeline',
  'Prefer': 'return=representation'
};

const ADJUSTMENTS = [
  {
    public_id: '1be9d581-b7c0-4384-8417-5715f4a16d4d',
    pipeline_id: 'PP-C63AC1D2',
    address: '3707 Bryce Ave',
    old_rent: 1495,
    new_rent: 1400
  },
  {
    public_id: '14771dd3-6cd0-463d-a947-1812a9f095f9',
    pipeline_id: 'PP-AE1CA1CF',
    address: '2506 Normont Cir',
    old_rent: 1450,
    new_rent: 1400
  },
  {
    public_id: 'e2ec9cf3-a67e-48ac-8e3d-835802bdc16d',
    pipeline_id: 'PP-90CEDAF7',
    address: '3211 Rogers Ave',
    old_rent: 1500,
    new_rent: 1400
  }
];

async function adjustPrices() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('  ADJUSTING PRICES (> $1400 -> $1400) FOR PUBLISHED PROPERTIES');
  console.log('═════════════════════════════════════════════════════════════════\n');

  for (const item of ADJUSTMENTS) {
    console.log(`Adjusting ${item.address}: $${item.old_rent}/mo -> $${item.new_rent}/mo...`);

    // 1. Update public.properties
    const patchPropRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${item.public_id}`, {
      method: 'PATCH',
      headers: HEADERS,
      body: JSON.stringify({
        monthly_rent: item.new_rent,
        security_deposit: item.new_rent,
        updated_at: new Date().toISOString()
      })
    });

    if (!patchPropRes.ok) {
      console.error(`  ✗ Failed to update public.properties for ${item.address}: ${patchPropRes.status}`);
    } else {
      console.log(`  ✓ public.properties updated successfully.`);
    }

    // 2. Update pipeline.pipeline_properties
    const patchPipeRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${item.pipeline_id}`, {
      method: 'PATCH',
      headers: HEADERS_PIPELINE,
      body: JSON.stringify({
        monthly_rent: item.new_rent,
        security_deposit: item.new_rent,
        updated_at: new Date().toISOString()
      })
    });

    if (!patchPipeRes.ok) {
      console.error(`  ✗ Failed to update pipeline_properties for ${item.address}: ${patchPipeRes.status}`);
    } else {
      console.log(`  ✓ pipeline.pipeline_properties updated successfully.`);
    }
  }

  // 3. Verify all 12 properties
  const allIds = [
    'f1693a41-0061-4185-aae4-70f42926cd1a', // 2232 Washington
    '1be9d581-b7c0-4384-8417-5715f4a16d4d', // 3707 Bryce
    '14771dd3-6cd0-463d-a947-1812a9f095f9', // 2506 Normont
    'da73edd3-1b40-42fa-b1bf-d5a992c9b1fd', // 5718 Houghton
    'b57e770a-f6b5-444e-8b50-0387094f57e9', // 3440 Stuart
    '0b4cc7ea-e3c7-4706-8a3f-cf598ed098e6', // 3019 NW 27th
    '13b298b7-0a68-43f1-aed5-a937ca4170ad', // 3331 Avenue J
    '2a587930-ec85-433a-8bb5-4d4e115a9f78', // 1444 Weiler
    'e2ec9cf3-a67e-48ac-8e3d-835802bdc16d', // 3211 Rogers
    '34076c5f-d18f-440f-b21a-cca3dd054ea1', // 6819 W Cleburne
    'b903a6bc-189c-4527-b36d-6e27246d3a42', // 5947 Shadydell
    'f083c58d-598b-4928-ae62-0008e9e78024'  // 6702 S Creek
  ];

  const verifyRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=in.(${allIds.join(',')})&select=id,address,city,state,zip,monthly_rent,security_deposit,bedrooms,bathrooms`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
  });
  const data = await verifyRes.json();
  console.log('\nVerified updated list from database:');
  console.log(data);
}

adjustPrices().catch(err => {
  console.error(err);
  process.exit(1);
});
