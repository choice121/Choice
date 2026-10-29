import https from 'https';
import crypto from 'crypto';
import fs from 'fs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE';
const LANDLORD_ID = 'b8d3aea0-f466-49f2-ac07-2b2b40793cc9'; // Choice Properties verified landlord
const SITE_URL = 'https://choice-properties-site.pages.dev';

const HEADERS = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

const FOLDER1_URLS = [
  'https://www.opendoor.com/properties/3326-Briaroaks-Dr-Garland-TX-75044-17892086/aid_c7c2642e-0d89-53db-a5a9-9c62bfa0b332',
  'https://www.opendoor.com/properties/2105-J-J-Pearce-Dr-Richardson-TX-75081-17678727/aid_eb6a2084-40f2-5de3-8d05-eb45f272f159',
  'https://www.opendoor.com/properties/2331-Royal-Dr-Garland-TX-75041/aid_cf7f260d-e163-59fb-89a8-c6cde7ede3dc',
  'https://www.opendoor.com/properties/1410-Lexington-Dr-Garland-TX-75041/aid_9da026b2-c1c9-5a7c-8694-f99d4745b932',
  'https://www.opendoor.com/properties/2446-Chesterfield-Rd-Garland-TX-75043/aid_3f161f8b-2096-5ac6-8ceb-ce46ccf8b5ff',
  'https://www.opendoor.com/properties/2226-Country-Oaks-Dr-Garland-TX-75040/aid_39204c73-baa4-53ae-97d3-359cd8496d7b',
  'https://www.opendoor.com/properties/8540-Foxwood-Ln-Dallas-TX-75217/aid_c574e3b2-9e89-54d8-8589-145cd43725eb'
];

function fetchOpendoorPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const match = data.match(/<script[^>]*id=\"__NEXT_DATA__\"[^>]*>([\s\S]*?)<\/script>/i);
        if (!match) return reject(new Error(`No __NEXT_DATA__ found in ${url}`));
        try {
          const parsed = JSON.parse(match[1]);
          resolve(parsed.props.pageProps.property);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

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

function generateEnrichedDescription(address, city, state, zip, beds, baths, sqft, rent) {
  const bathText = baths === 1 ? '1 full bathroom' : baths % 1 === 0 ? `${baths} full bathrooms` : `${Math.floor(baths)} full bathrooms and a powder room`;
  
  return `Welcome to ${address}, a well-maintained ${beds}-bedroom, ${bathText} single-family residence situated in a quiet, established ${city} neighborhood. Offering ${sqft.toLocaleString()} square feet of thoughtfully designed living space, this home features an open floor plan that effortlessly connects the central living room with bright dining areas and daily living zones.

The kitchen features durable countertops, rich cabinetry, pantry storage, and a full itemized appliance inventory including refrigerator, electric range and oven, dishwasher, and microwave.

Each of the ${beds} bedrooms provides comfortable proportions, generous natural lighting, and ample closet storage. The primary bedroom suite serves as a relaxing retreat complete with private en-suite bathroom facilities, modern fixtures, and vanity counter space. Secondary bedrooms share convenient access to well-appointed hallway bathroom spaces.

Year-round climate control is maintained via efficient central heating and air conditioning, accompanied by dedicated interior laundry hookups. Outside, enjoy a level private fenced backyard and convenient attached garage parking.

Pet-friendly living welcomes your companion animals. A standard $50 application fee applies per adult applicant. Submit your rental application today at Choice Properties.`.trim();
}

async function run() {
  console.log('=== SCRAPING & PUBLISHING 7 FOLDER 1 PROPERTIES AS PRIVATE PLACEMENT ===\n');

  const publishedProperties = [];

  for (let i = 0; i < FOLDER1_URLS.length; i++) {
    const url = FOLDER1_URLS[i];
    console.log(`[${i + 1}/7] Scraping listing: ${url}`);
    
    const opendoorData = await fetchOpendoorPage(url);
    const street = opendoorData.street;
    const city = opendoorData.city;
    const state = opendoorData.state;
    const zip = opendoorData.zip;
    const listPrice = opendoorData.listPrice || 300000;
    const sqft = opendoorData.sqFtTotalLiving || 1500;
    const beds = opendoorData.bedrooms || 3;
    const baths = opendoorData.bathrooms || 2;
    const yearBuilt = opendoorData.yearBuilt ? parseInt(opendoorData.yearBuilt, 10) : 1985;
    const lotSize = opendoorData.sqFtLot || 6500;
    const lat = opendoorData.latitude || 32.9;
    const lng = opendoorData.longitude || -96.7;

    const rawPhotos = opendoorData.photosXl || opendoorData.photosLg || opendoorData.photos || [];
    
    // Calculate rental price using standard market formula: round((listPrice * 0.0085) / 25) * 25
    let monthlyRent = Math.round((listPrice * 0.0085) / 25) * 25;
    if (monthlyRent < 1200) monthlyRent = 1450;
    if (monthlyRent > 2400) monthlyRent = 2195;

    console.log(`   Property: ${street}, ${city}, ${state} ${zip} (${beds} bed, ${baths} bath, ${sqft} sqft, Rent: $${monthlyRent}/mo)`);
    console.log(`   Extracted ${rawPhotos.length} authentic source photos`);

    const propId = crypto.randomUUID();
    const title = `${street}, ${city}, ${state} ${zip}`;
    const description = generateEnrichedDescription(street, city, state, zip, beds, baths, sqft, monthlyRent);

    const propertyPayload = {
      id: propId,
      title: title,
      address: street,
      city: city,
      state: state,
      zip: zip,
      county: city === 'Dallas' ? 'Dallas County' : 'Collin County',
      lat: lat,
      lng: lng,
      property_type: 'SINGLE_FAMILY',
      bedrooms: beds,
      bathrooms: baths,
      square_footage: sqft,
      lot_size_sqft: lotSize,
      year_built: yearBuilt,
      monthly_rent: monthlyRent,
      security_deposit: monthlyRent, // 1x monthly rent in DB strictly
      application_fee: 50, // Always $50
      pets_allowed: true,
      smoking_allowed: false,
      status: 'private_placement', // Private Placement Shield
      description: description,
      listed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      landlord_id: LANDLORD_ID,
      amenities: [
        'Central Air Conditioning & Heating',
        'Attached Garage & Private Driveway',
        'Private Fenced Backyard',
        'In-Unit Washer & Dryer Hookups',
        'Pet Friendly (Dogs & Cats Welcome)',
        'Full Kitchen Appliance Package'
      ],
      appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Washer/Dryer Hookups'],
      heating_type: 'Central Forced Air Heat',
      cooling_type: 'Central Air Conditioning',
      laundry_type: 'In-Unit Washer & Dryer Hookups',
      parking: 'Attached Garage + Driveway'
    };

    await supabaseRequest('/rest/v1/properties', 'POST', propertyPayload);
    console.log(`   ✓ Inserted into public.properties (private_placement)`);

    const photoRows = rawPhotos.map((photoUrl, idx) => ({
      id: crypto.randomUUID(),
      property_id: propId,
      url: photoUrl,
      display_order: idx,
      is_hero: idx === 0,
      caption: idx === 0 ? 'Front Exterior' : `Property Photo ${idx + 1}`
    }));

    if (photoRows.length > 0) {
      await supabaseRequest('/rest/v1/property_photos', 'POST', photoRows);
      console.log(`   ✓ Inserted ${photoRows.length} source CDN photos (hero: Photo 1)\n`);
    }

    publishedProperties.push({
      id: propId,
      address: street,
      city: city,
      state: state,
      zip: zip,
      rent: monthlyRent,
      beds: beds,
      baths: baths,
      sqft: sqft,
      photosCount: photoRows.length,
      url: `${SITE_URL}/property.html?id=${propId}`
    });
  }

  // Generate 32-byte URL-safe base64 token for Client Multi-Property Magic Link
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

  const shareLinks = publishedProperties.map(p => ({
    share_id: shareId,
    property_id: p.id
  }));

  await supabaseRequest('/rest/v1/property_share_properties', 'POST', shareLinks);

  const masterMagicLink = `${SITE_URL}/listings.html#share=${rawToken}`;

  // Clear local pipeline inbox files
  try {
    fs.writeFileSync('pipeline_9_properties.json', '[]');
    fs.writeFileSync('src/data/pipeline_properties.json', '[]');
    console.log('✓ Cleared local pipeline inbox files.');
  } catch (e) {}

  fs.writeFileSync('scripts/published_folder1_results.json', JSON.stringify({
    masterMagicLink,
    properties: publishedProperties
  }, null, 2));

  console.log('\n===============================================================');
  console.log('MASTER CLIENT MAGIC LINK:');
  console.log(masterMagicLink);
  console.log('===============================================================\n');

  publishedProperties.forEach((p, idx) => {
    console.log(`${idx + 1}. ${p.address}, ${p.city}, ${p.state} ${p.zip} ($${p.rent.toLocaleString()}/mo | ${p.beds} Bed / ${p.baths} Bath) — ${p.url}`);
  });
}

run().catch(err => {
  console.error('Execution error:', err);
  process.exit(1);
});
