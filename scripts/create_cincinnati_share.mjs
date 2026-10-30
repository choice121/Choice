import https from 'https';
import crypto from 'crypto';
import fs from 'fs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE';
const SITE_URL = 'https://choice-properties-site.pages.dev';

const HEADERS = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

const PROPERTY_IDS = [
  '49e290cc-a438-4719-8e6b-653fcbdd1283', // 3420 Cheviot Ave ($1,800)
  '4d8b0172-34a2-42c6-a184-af14e3410d98', // 4518 Rapid Run Rd ($1,900)
  '5427914a-2569-4991-adc6-616aba12ee89', // 1624 Cedar Ave ($1,850)
  '79bc03f6-7a80-4362-9438-79f112536e28', // 1820 Sutton Ave ($1,750)
  '91abebab-cbb6-447f-b94a-547df112029f'  // 7120 Plainfield Rd ($1,700)
];

function supabaseRequest(path, method, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}${path}`);
    const req = https.request(url, {
      method: method,
      headers: HEADERS
    }, res => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(responseBody ? JSON.parse(responseBody) : null);
          } catch (e) {
            resolve(responseBody);
          }
        } else {
          reject(new Error(`Supabase request failed: ${res.statusCode} ${responseBody}`));
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('Generating Client Master Magic Link for Cincinnati Private Placement listings...');

  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const shareId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  const sharePayload = {
    id: shareId,
    token_hash: tokenHash,
    created_at: new Date().toISOString(),
    expires_at: expiresAt
  };

  await supabaseRequest('/rest/v1/property_shares', 'POST', sharePayload);
  console.log(`✓ Created property_shares row with ID: ${shareId}`);

  const shareLinks = PROPERTY_IDS.map(propId => ({
    share_id: shareId,
    property_id: propId
  }));

  await supabaseRequest('/rest/v1/property_share_properties', 'POST', shareLinks);
  console.log(`✓ Linked all 5 Cincinnati properties in property_share_properties`);

  const masterMagicLink = `${SITE_URL}/listings.html#share=${rawToken}`;
  console.log('\n===============================================================');
  console.log('MASTER CLIENT MAGIC LINK:');
  console.log(masterMagicLink);
  console.log('===============================================================\n');

  // Verify properties data
  const props = await supabaseRequest(`/rest/v1/properties?id=in.(${PROPERTY_IDS.join(',')})&select=*,property_photos(*)`, 'GET');
  console.log('Verified 5 Published Properties:');
  props.forEach((p, idx) => {
    console.log(`${idx + 1}. ${p.address}, ${p.city}, ${p.state} ${p.zip} ($${p.monthly_rent.toLocaleString()}/mo | ${p.bedrooms} Bed / ${p.bathrooms} Bath) — ${SITE_URL}/property.html?id=${p.id}`);
    console.log(`   Photos: ${p.property_photos?.length} photos | Status: ${p.status}`);
  });

  fs.writeFileSync('scripts/published_cincinnati_results.json', JSON.stringify({
    masterMagicLink,
    properties: props
  }, null, 2));
}

run().catch(err => {
  console.error('Error generating share link:', err);
  process.exit(1);
});
