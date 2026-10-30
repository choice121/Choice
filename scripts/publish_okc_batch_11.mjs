import fs from 'fs';
import crypto from 'crypto';

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

const PIPELINE_HEADERS = {
  ...HEADERS,
  'Accept-Profile': 'pipeline',
  'Content-Profile': 'pipeline'
};

function makeShareToken() {
  const bytes = crypto.randomBytes(32);
  return bytes.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Target adjusted prices for the 11 OKC properties ($900 - $1000 range)
// Original vs Adjusted:
// 1. 3112 NE 12th St ($1295) -> $1000
// 2. 4705 S Hudson Ave ($1295) -> $950
// 3. 2541 NW 34th St ($1400) -> $1000
// 4. 9308 Greystone Ave ($1295) -> $950
// 5. 733 NE 34th Ter ($1295) -> $950
// 6. 1453 SW 61st Ter ($1300) -> $1000
// 7. 708 SE 60th St ($1095) -> $900
// 8. 6101 Gaelic Glen Dr ($1399) -> $1000
// 9. 3701 NW 57th St ($1350) -> $1000
// 10. 808 N Markwell Ave ($1290) -> $950
// 11. 1240 NE 42nd St ($1150) -> $900

const PRICE_MAP = {
  'PP-21841212': 1000,
  'PP-21879472': 950,
  'PP-21853177': 1000,
  'PP-22023047': 950,
  'PP-21845879': 950,
  'PP-21872349': 1000,
  'PP-21877672': 900,
  'PP-21889874': 1000,
  'PP-21959528': 1000,
  'PP-21981469': 950,
  'PP-21910692': 900
};

const ARCHITECTURAL_DETAILS = {
  'PP-21841212': { type: 'SINGLE_FAMILY', year: 1955, laundry: 'Hookups', parking: 'Private Driveway Off-Street Parking', garage: 0, appliances: ['Gas Range / Oven', 'Refrigerator', 'Washer/Dryer Hookups'], amenities: ['Private Fenced Backyard', 'Mature Shade Trees', 'Single-Story Living', 'Pet-Friendly'] },
  'PP-21879472': { type: 'SINGLE_FAMILY', year: 1952, laundry: 'Hookups', parking: 'Driveway Parking', garage: 0, appliances: ['Range / Oven', 'Refrigerator', 'Washer/Dryer Hookups'], amenities: ['Covered Front Porch', 'Hardwood Flooring', 'Private Yard', 'Pet-Friendly'] },
  'PP-21853177': { type: 'SINGLE_FAMILY', year: 1948, laundry: 'Hookups', parking: 'Detached Garage & Driveway', garage: 1, appliances: ['Gas Range / Oven', 'Refrigerator', 'Washer/Dryer Hookups'], amenities: ['Detached Garage', 'Original Architectural Trim', 'Fenced Backyard', 'Pet-Friendly'] },
  'PP-22023047': { type: 'SINGLE_FAMILY', year: 1978, laundry: 'In Unit', parking: 'Attached 2-Car Garage', garage: 2, appliances: ['Dishwasher', 'Microwave', 'Range / Oven', 'Refrigerator', 'Washer', 'Dryer'], amenities: ['Attached 2-Car Garage', 'Fireplace', 'Vaulted Ceilings', 'Private Fenced Yard', 'Pet-Friendly'] },
  'PP-21845879': { type: 'SINGLE_FAMILY', year: 1950, laundry: 'Hookups', parking: 'Driveway Parking', garage: 0, appliances: ['Gas Range / Oven', 'Refrigerator', 'Washer/Dryer Hookups'], amenities: ['Classic Mid-Century Layout', 'Fenced Lawn', 'Pet-Friendly'] },
  'PP-21872349': { type: 'SINGLE_FAMILY', year: 1995, laundry: 'Hookups', parking: 'Attached 2-Car Garage', garage: 2, appliances: ['Dishwasher', 'Microwave', 'Range / Oven', 'Refrigerator', 'Washer/Dryer Hookups'], amenities: ['Attached 2-Car Garage', 'Master Suite', 'Patio', 'Pet-Friendly'] },
  'PP-21877672': { type: 'SINGLE_FAMILY', year: 1968, laundry: 'Hookups', parking: 'Driveway Parking', garage: 0, appliances: ['Range / Oven', 'Refrigerator', 'Washer/Dryer Hookups'], amenities: ['Quiet Residential Garland Area', 'Large Yard', 'Pet-Friendly'] },
  'PP-21889874': { type: 'SINGLE_FAMILY', year: 2004, laundry: 'Hookups', parking: 'Attached 2-Car Garage', garage: 2, appliances: ['Dishwasher', 'Microwave', 'Range / Oven', 'Refrigerator', 'Washer/Dryer Hookups'], amenities: ['Modern Open Layout', 'Attached Garage', 'Fenced Yard', 'Pet-Friendly'] },
  'PP-21959528': { type: 'SINGLE_FAMILY', year: 1954, laundry: 'Hookups', parking: 'Driveway Parking', garage: 0, appliances: ['Gas Range / Oven', 'Refrigerator', 'Washer/Dryer Hookups'], amenities: ['Charming Historic Details', 'Hardwood Floors', 'Pet-Friendly'] },
  'PP-21981469': { type: 'SINGLE_FAMILY', year: 1972, laundry: 'Hookups', parking: 'Attached 1-Car Garage', garage: 1, appliances: ['Dishwasher', 'Range / Oven', 'Refrigerator', 'Washer/Dryer Hookups'], amenities: ['Attached Garage', 'Covered Patio', 'Fenced Yard', 'Pet-Friendly'] },
  'PP-21910692': { type: 'SINGLE_FAMILY', year: 1958, laundry: 'Hookups', parking: 'Driveway Parking', garage: 0, appliances: ['Range / Oven', 'Refrigerator', 'Washer/Dryer Hookups'], amenities: ['Established Neighborhood Setting', 'Spacious Lot', 'Pet-Friendly'] }
};

async function run() {
  console.log(`=========================================================`);
  console.log(`Choice Properties — Publishing OKC Batch (11 Properties)`);
  console.log(`Target Mode: Private Placement Shield & Magic Link Sharing`);
  console.log(`Price Adjustment Range: $900 - $1000/mo`);
  console.log(`=========================================================\n`);

  const rawData = JSON.parse(fs.readFileSync('/tmp/okc_pipeline_batch.json', 'utf8'));
  const publishedResults = [];
  const publishedIds = [];

  for (let i = 0; i < rawData.length; i++) {
    const raw = rawData[i];
    const id = raw.id;
    const adjustedRent = PRICE_MAP[id] || 950;
    const arch = ARCHITECTURAL_DETAILS[id] || { type: 'SINGLE_FAMILY', year: 1960, laundry: 'Hookups', parking: 'Driveway', garage: 0, appliances: ['Range / Oven', 'Refrigerator'], amenities: ['Private Fenced Yard', 'Pet-Friendly'] };

    console.log(`\n---------------------------------------------------------`);
    console.log(`Processing #${i+1}: ${raw.address}, ${raw.city}, ${raw.state} (${raw.bedrooms}b/${raw.bathrooms}ba | $${adjustedRent}/mo [Orig: $${raw.monthly_rent}] | ${arch.type})`);

    const propertyId = crypto.randomUUID();
    const enrichedDescription = `Set in an established Oklahoma City neighborhood, this comfortable ${raw.square_footage}-square-foot ${arch.type.toLowerCase().replace('_', ' ')} residence delivers reliable single-story living and an efficient layout. The front entry opens into a bright, welcoming living room featuring clean flooring and abundant natural light.

The functional kitchen is equipped with solid cabinetry, generous counter space, and an itemized appliance package including a ${arch.appliances.join(', ')}. A dedicated dining alcove connects seamlessly for effortless daily meals.

Accommodations include ${raw.bedrooms} well-proportioned bedrooms with comfortable closet space and large windows. The ${raw.bathrooms}-bathroom setup features clean vanity fixtures and a solid tub/shower combination.

Equipped with efficient heating, cooling, and dedicated laundry utility connections. The exterior highlights a private fenced backyard and parking provisions suited for resident vehicles.

Pet-Friendly environment welcoming your animal companions. Application Fee: $50 per adult applicant. Submit your rental application today at Choice Properties.`;

    const propertyPayload = {
      id: propertyId,
      landlord_id: LANDLORD_ID,
      status: 'private_placement', // Shielded from public marketplace
      title: `${raw.address}, ${raw.city}, ${raw.state} ${raw.zip}`,
      description: enrichedDescription,
      address: raw.address,
      city: raw.city,
      state: raw.state,
      zip: raw.zip,
      county: raw.county || 'Oklahoma County',
      lat: raw.lat || 35.4676,
      lng: raw.lng || -97.5164,
      property_type: arch.type,
      year_built: arch.year,
      bedrooms: raw.bedrooms,
      bathrooms: Math.floor(raw.bathrooms),
      half_bathrooms: raw.half_bathrooms || 0,
      total_bathrooms: raw.bathrooms,
      square_footage: raw.square_footage,
      lot_size_sqft: raw.lot_size_sqft || 6000,
      garage_spaces: arch.garage,
      monthly_rent: adjustedRent,
      security_deposit: adjustedRent, // 1x monthly rent in DB
      application_fee: 50, // strictly $50
      pets_allowed: true,
      parking: arch.parking,
      amenities: arch.amenities,
      appliances: arch.appliances,
      heating_type: raw.heating_type || 'Forced Air Natural Gas',
      cooling_type: raw.cooling_type || 'Central Air Conditioning',
      laundry_type: arch.laundry,
      has_central_air: true,
      has_basement: false,
      original_description: raw.original_description || raw.description || '',
      views_count: 0,
      applications_count: 0,
      saves_count: 0
    };

    const propRes = await fetch(`${SUPABASE_URL}/rest/v1/properties`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(propertyPayload)
    });
    if (!propRes.ok) {
      const errText = await propRes.text();
      throw new Error(`Failed to insert into public.properties: ${propRes.status} ${errText}`);
    }
    publishedIds.push(propertyId);
    console.log(`✓ Published to public.properties (ID: ${propertyId}, status: 'private_placement')`);

    // Photos Insertion with direct source CDN URLs and original order
    let rawPhotos = [];
    try {
      rawPhotos = JSON.parse(raw.original_image_urls || raw.image_urls || '[]');
    } catch (e) {
      rawPhotos = [];
    }

    const photoRows = rawPhotos.map((item, idx) => ({
      property_id: propertyId,
      url: typeof item === 'string' ? item : item.url,
      display_order: idx + 1,
      is_hero: idx === 0
    }));

    if (photoRows.length > 0) {
      const photoRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(photoRows)
      });
      if (!photoRes.ok) {
        const pErr = await photoRes.text();
        console.warn(`Warning: failed to insert photos: ${photoRes.status} ${pErr}`);
      } else {
        console.log(`✓ Inserted ${photoRows.length} original CDN photos (hero: photo #1)`);
      }
    }

    // Mark pipeline record as published
    await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${id}`, {
      method: 'PATCH',
      headers: PIPELINE_HEADERS,
      body: JSON.stringify({
        status: 'published',
        published_at: new Date().toISOString(),
        choice_property_id: propertyId
      })
    });

    publishedResults.push({
      id: propertyId,
      address: raw.address,
      city: raw.city,
      state: raw.state,
      zip: raw.zip,
      title: propertyPayload.title,
      rent: adjustedRent,
      original_rent: raw.monthly_rent,
      beds: raw.bedrooms,
      baths: raw.bathrooms,
      sqft: raw.square_footage,
      photosCount: photoRows.length
    });
  }

  // Generate Magic Multi-Property Share Link
  console.log(`\n=========================================================`);
  console.log(`Generating Magic Multi-Property Share Token for ${publishedIds.length} properties...`);

  const token = makeShareToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days
  const shareId = crypto.randomUUID();

  // Insert into public.property_shares
  const shareRes = await fetch(`${SUPABASE_URL}/rest/v1/property_shares`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      id: shareId,
      token_hash: tokenHash,
      expires_at: expiresAt
    })
  });

  if (!shareRes.ok) {
    const err = await shareRes.text();
    throw new Error(`Failed to create property_shares: ${shareRes.status} ${err}`);
  }
  console.log(`✓ Created property_share record (ID: ${shareId})`);

  // Link all properties into public.property_share_properties
  const linkRows = publishedIds.map(pid => ({
    share_id: shareId,
    property_id: pid
  }));

  const linkRes = await fetch(`${SUPABASE_URL}/rest/v1/property_share_properties`, {
    method: 'POST',
    headers: { ...HEADERS, 'Prefer': 'return=representation' },
    body: JSON.stringify(linkRows)
  });

  if (!linkRes.ok) {
    const err = await linkRes.text();
    throw new Error(`Failed to link property_share_properties: ${linkRes.status} ${err}`);
  }
  console.log(`✓ Linked ${publishedIds.length} properties to share record`);

  // Verify resolution via property-share Edge Function
  console.log(`\nVerifying share resolution via /functions/v1/property-share...`);
  try {
    const resolveRes = await fetch(`${SUPABASE_URL}/functions/v1/property-share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`
      },
      body: JSON.stringify({
        action: 'resolve',
        token: token
      })
    });
    const resolveData = await resolveRes.json();
    console.log(`Resolution status: ${resolveRes.status}`, resolveData.success ? `✓ Resolved ${resolveData.properties?.length || resolveData.data?.length || 'OK'} properties` : resolveData);
  } catch (e) {
    console.warn(`Resolution check warning: ${e.message}`);
  }

  const magicLink = `${SITE_URL}/listings.html#share=${token}`;

  console.log(`\n=========================================================`);
  console.log(`🎉 MAGIC MULTI-PROPERTY LINK GENERATED SUCCESSFULLY!`);
  console.log(`Share URL: ${magicLink}`);
  console.log(`=========================================================`);

  fs.writeFileSync('scripts/published_okc_magic_results.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    share_token: token,
    share_id: shareId,
    share_url: magicLink,
    properties: publishedResults
  }, null, 2));

  console.log(`Saved output manifest to scripts/published_okc_magic_results.json`);
}

run().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
