import crypto from 'crypto';
import { CREDENTIALS_CONFIG } from '../credentials-config.mjs';

const SUPABASE_URL = CREDENTIALS_CONFIG.SUPABASE_URL;
const KEY = CREDENTIALS_CONFIG.SUPABASE_API_KEY;
const SITE_URL = 'https://choice-properties-site.pages.dev';

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
  'Content-Profile': 'pipeline'
};

// Verified and sanitized descriptions for the 5 properties:
// Preserves original narrative and features while removing prohibited words (security deposit mentions,
// third-party application portals, extra fees, move-in days, showing schedules, and smoking policies).
const CLEANED_DESCRIPTIONS = {
  'PP-E6E3682A': `Welcome to 285 S. Champion Avenue, a charming 3-bedroom, 2-bath townhome conveniently located near downtown Columbus. This home features beautiful wood-style flooring, exposed brick accents, spacious living areas, ceiling fans, and a kitchen with plenty of counter space. Enjoy the character of this unique home while being just minutes from downtown dining, shopping, entertainment, and regional commuter corridors.

Tenant is responsible for all utilities. Application fee: $50 per adult applicant.

Rental Criteria:
1). Gross monthly income must be at least 3 times the rent
2). No evictions or balances due to any landlord in the last 5 years
3). No active bankruptcies or foreclosures
4). 2 years of good verifiable rental history
5). Standard background screening
6). No recent collections or late payments on credit in the last two years
7). Minimum credit score of 580 required
Renter's insurance is required.

Submit your rental application today at Choice Properties.
Equal Housing Opportunity`,

  'PP-93486427': `Remodeled 3-bedroom, 2-bath single-family house with full basement and 1-car garage. Features plenty of storage, a private fenced-in backyard, and central heating. Situated in a quiet residential neighborhood with convenient access to regional commuter corridors and shopping.

Rent: $1,500/month. Application fee: $50 per adult applicant.

Submit your rental application today at Choice Properties.`,

  'PP-38376A79': `Spacious 3BR/1.5BA duplex unit with original hardwood floors in Columbus's South Side.

A well-maintained 3-bedroom, 1.5-bath duplex unit combining classic character with thoughtful updates. Original hardwood floors run throughout the main living areas, paired with freshly painted light French gray walls and large windows that keep every room bright and naturally lit. The living room features a picture window, a handsome decommissioned brick fireplace, and generous proportions with plenty of space for a sectional and dining setup.

The kitchen has been freshly modernized with updated cabinetry and countertop, an upgraded sink and faucet, and new wood-look luxury vinyl plank flooring—clean, practical, and easy to maintain.

New Energy Star Certified double-hung windows installed throughout help keep heating and cooling costs down. Ceiling fans in all dry rooms add comfort year-round. Glazed panels on both the front and rear exterior doors bring in additional natural light.

All three bedrooms are well-proportioned with good natural light. The full bath upstairs features a shower/tub combo and vanity; a convenient half bath is located on the main level.

The full basement provides laundry hookups and bonus storage space. Covered front porch and off-street parking in the rear round out the home. Recent exterior work like aluminum trim, fascia, soffit, and porch components means the building is in excellent shape with years of low-maintenance living ahead.

Location:
Located in Columbus's South Side, steps from local markets, restaurants, and transit. Deshler Park, a beautiful tree-lined neighborhood park, is just a short walk away. Nationwide Children's Hospital is close by, with convenient access to regional commuter corridors and shopping.

Tenant responsible for gas and electric utilities, yard maintenance, and snow removal. Application fee: $50 per adult applicant. Submit your rental application today at Choice Properties.`,

  'PP-1177CFF1': `Completely updated kitchen, bath, flooring, roof, furnace, and central AC. Three-bedroom ranch with first-floor laundry, 1.5 baths, large backyard, and an oversized 2.5 car garage with extra storage area. Convenient to shopping, schools, and commuter corridors.

Rent: $1,425/month. Minimum gross household income of $4,500/month required to qualify. Renter's insurance is required. Tenant pays all utilities, including water. Application fee: $50 per adult applicant.

Submit your rental application today at Choice Properties.`,

  'PP-E2FE6CAA': `Charming 3-bedroom, 1.5-bathroom single-family home for rent. This home features central air conditioning, a fenced backyard, and a private driveway for off-street parking. The kitchen includes a stainless steel stove and refrigerator, and washer/dryer hookups are located in the full basement. Conveniently located with easy access to downtown Columbus, regional commuter corridors, shopping, schools, and public transit.

Tenant is responsible for providing their own washer and dryer and for paying all utilities, lawn care, and weed control.

Qualifications:
- Monthly household take-home pay of $4,485/month ($53,820/year).
- 600+ credit score.
- Online rent payment capability.
- No prior evictions.

Financial Details:
- Rent: $1,495/month.
- Application fee: $50 per adult applicant.

Submit your rental application today at Choice Properties.`
};

// Verified specifications from original source listings:
const VERIFIED_SPECS = {
  'PP-E6E3682A': {
    bedrooms: 3,
    bathrooms: 2,
    half_bathrooms: null,
    total_bathrooms: 2,
    property_type: 'TOWNHOUSE',
    square_footage: 1950,
    monthly_rent: 1500,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    parking: 'Off-Street Parking',
    garage_spaces: null,
    has_basement: false,
    has_central_air: true,
    laundry_type: 'In-Unit Hookups'
  },
  'PP-93486427': {
    bedrooms: 3,
    bathrooms: 2,
    half_bathrooms: null,
    total_bathrooms: 2,
    property_type: 'SINGLE_FAMILY',
    square_footage: 1500,
    monthly_rent: 1500,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    parking: '1-Car Attached Garage',
    garage_spaces: 1,
    has_basement: true,
    has_central_air: true,
    laundry_type: 'In-Unit Hookups'
  },
  'PP-38376A79': {
    bedrooms: 3,
    bathrooms: 1.5,
    half_bathrooms: 1,
    total_bathrooms: 1.5,
    property_type: 'DUPLEX',
    square_footage: 1144,
    monthly_rent: 1500,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    parking: 'Off-Street Parking',
    garage_spaces: null,
    has_basement: true,
    has_central_air: true,
    laundry_type: 'In-Unit Hookups'
  },
  'PP-1177CFF1': {
    bedrooms: 3,
    bathrooms: 1.5,
    half_bathrooms: 1,
    total_bathrooms: 1.5,
    property_type: 'SINGLE_FAMILY',
    square_footage: 962,
    monthly_rent: 1425,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    parking: '2.5-Car Garage & Driveway',
    garage_spaces: 2,
    has_basement: false,
    has_central_air: true,
    laundry_type: 'In-Unit Hookups'
  },
  'PP-E2FE6CAA': {
    bedrooms: 3,
    bathrooms: 1.5,
    half_bathrooms: 1,
    total_bathrooms: 1.5,
    property_type: 'SINGLE_FAMILY',
    square_footage: 1150,
    monthly_rent: 1495,
    pets_allowed: false, // Strict no pet policy on source listing
    pet_types_allowed: [],
    parking: 'Private Driveway Off-Street',
    garage_spaces: null,
    has_basement: true,
    has_central_air: true,
    laundry_type: 'In-Unit Hookups'
  }
};

async function publishRecentProperties() {
  console.log('Fetching properties added in the last 30 minutes from pipeline.pipeline_properties...');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?imported_at=gte.2026-10-20T19:55:00Z&order=imported_at.asc`, {
    headers: HEADERS_PIPELINE
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch pipeline: ${res.status} ${await res.text()}`);
  }

  const pipelineProps = await res.json();
  console.log(`Found ${pipelineProps.length} properties to publish.`);

  const publishedResults = [];
  const publishedIds = [];
  const today = new Date().toISOString().slice(0, 10);
  const choiceLandlordId = 'b8d3aea0-f466-49f2-ac07-2b2b40793cc9';

  for (const item of pipelineProps) {
    const pipeId = item.id;
    const propId = crypto.randomUUID();
    const specs = VERIFIED_SPECS[pipeId] || {};
    const description = CLEANED_DESCRIPTIONS[pipeId] || item.description;

    console.log(`\n--------------------------------------------------`);
    console.log(`Publishing ${pipeId}: ${item.address}, ${item.city}, ${item.state} ${item.zip}`);
    console.log(`Specs: ${specs.bedrooms} Bed / ${specs.bathrooms} Bath | Pets Allowed: ${specs.pets_allowed}`);

    // Parse photos
    let rawPhotos = item.original_image_urls || item.photos || [];
    if (typeof rawPhotos === 'string') {
      try { rawPhotos = JSON.parse(rawPhotos); } catch (e) { rawPhotos = []; }
    }
    const photoUrls = rawPhotos.map(p => (typeof p === 'string' ? p : p.url)).filter(Boolean);
    console.log(`Photos found: ${photoUrls.length}`);

    // Parse amenities and appliances
    let amenities = [];
    if (typeof item.amenities === 'string') {
      try { amenities = JSON.parse(item.amenities); } catch (e) { amenities = []; }
    } else if (Array.isArray(item.amenities)) {
      amenities = item.amenities;
    }

    let appliances = [];
    if (typeof item.appliances === 'string') {
      try { appliances = JSON.parse(item.appliances); } catch (e) { appliances = []; }
    } else if (Array.isArray(item.appliances)) {
      appliances = item.appliances;
    }

    const title = `${item.address}, ${item.city}, ${item.state} ${item.zip}`;

    const propRecord = {
      id: propId,
      landlord_id: choiceLandlordId,
      status: 'private_placement', // Enforce private placement
      title: title,
      address: item.address,
      city: item.city,
      state: item.state,
      zip: item.zip,
      county: item.county || 'Franklin County',
      lat: item.lat,
      lng: item.lng,
      property_type: specs.property_type || item.property_type || 'SINGLE_FAMILY',
      bedrooms: specs.bedrooms ?? item.bedrooms,
      bathrooms: specs.bathrooms ?? item.bathrooms,
      half_bathrooms: specs.half_bathrooms ?? item.half_bathrooms,
      total_bathrooms: specs.total_bathrooms ?? item.total_bathrooms,
      square_footage: specs.square_footage ?? item.square_footage,
      monthly_rent: specs.monthly_rent ?? item.monthly_rent,
      security_deposit: specs.monthly_rent ?? item.monthly_rent, // 1x monthly rent in DB
      application_fee: 50, // Strictly $50
      pets_allowed: specs.pets_allowed,
      pet_types_allowed: specs.pet_types_allowed,
      pet_deposit: null,
      smoking_allowed: false,
      available_date: null,
      lease_terms: null,
      minimum_lease_months: null,
      has_central_air: specs.has_central_air ?? true,
      has_basement: specs.has_basement ?? false,
      parking: specs.parking ?? item.parking ?? 'Off-Street Parking',
      garage_spaces: specs.garage_spaces ?? item.garage_spaces,
      heating_type: item.heating_type || 'Forced Air Heating',
      cooling_type: item.cooling_type || 'Central Air Conditioning',
      laundry_type: specs.laundry_type ?? item.laundry_type ?? 'In-Unit Hookups',
      amenities: amenities,
      appliances: appliances,
      description: description,
      original_description: item.original_description || item.description,
      listed_at: today,
      featured: false
    };

    // 1. Insert into public.properties
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/properties`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(propRecord)
    });

    if (!insertRes.ok) {
      console.error(`  ✗ Failed to insert property ${propId}: ${insertRes.status} ${await insertRes.text()}`);
      continue;
    }
    console.log(`  ✓ Inserted into public.properties (${propId}) with status 'private_placement'`);

    // 2. Insert photos into public.property_photos
    if (photoUrls.length > 0) {
      const photoRows = photoUrls.map((url, idx) => ({
        property_id: propId,
        url: url,
        display_order: idx,
        is_hero: idx === 0,
        caption: `${title} - Photo ${idx + 1}`
      }));

      const photoRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(photoRows)
      });

      if (!photoRes.ok) {
        console.error(`  ⚠ Failed to insert photos: ${photoRes.status} ${await photoRes.text()}`);
      } else {
        console.log(`  ✓ Synced ${photoRows.length} photos into public.property_photos`);
      }
    }

    // 3. Update pipeline.pipeline_properties status
    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${pipeId}`, {
      method: 'PATCH',
      headers: HEADERS_PIPELINE,
      body: JSON.stringify({
        status: 'published',
        published_property_id: propId,
        choice_property_id: propId,
        published_at: new Date().toISOString()
      })
    });

    if (patchRes.ok) {
      console.log(`  ✓ Updated pipeline record ${pipeId} to 'published'`);
    } else {
      console.warn(`  ⚠ Failed to update pipeline status: ${patchRes.status}`);
    }

    publishedIds.push(propId);
    publishedResults.push({
      n: publishedResults.length + 1,
      id: propId,
      pipeId: pipeId,
      address: item.address,
      city: item.city,
      state: item.state,
      zip: item.zip,
      rent: propRecord.monthly_rent,
      beds: propRecord.bedrooms,
      baths: propRecord.bathrooms,
      petsAllowed: propRecord.pets_allowed,
      url: `${SITE_URL}/property.html?id=${propId}`
    });
  }

  // 4. Create Private Placement Master Magic Link
  console.log(`\nCreating Client Multi-Property Magic Link (90-day expiry) for ${publishedIds.length} properties...`);
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const shareId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  const shareRes = await fetch(`${SUPABASE_URL}/rest/v1/property_shares`, {
    method: 'POST',
    headers: { ...HEADERS, 'Prefer': 'return=minimal' },
    body: JSON.stringify({
      id: shareId,
      token_hash: tokenHash,
      expires_at: expiresAt
    })
  });

  if (!shareRes.ok) {
    throw new Error(`Failed to insert into property_shares: ${shareRes.status} ${await shareRes.text()}`);
  }

  const shareLinkRows = publishedIds.map(pId => ({
    share_id: shareId,
    property_id: pId
  }));

  const linkRes = await fetch(`${SUPABASE_URL}/rest/v1/property_share_properties`, {
    method: 'POST',
    headers: { ...HEADERS, 'Prefer': 'return=minimal' },
    body: JSON.stringify(shareLinkRows)
  });

  if (!linkRes.ok) {
    throw new Error(`Failed to insert into property_share_properties: ${linkRes.status} ${await linkRes.text()}`);
  }

  const magicLink = `${SITE_URL}/listings.html#share=${rawToken}`;
  console.log(`✓ Magic Link created: ${magicLink}`);

  console.log('\n=============================================================================');
  console.log('MASTER MAGIC LINK:');
  console.log(magicLink);
  console.log('=============================================================================\n');

  console.log('PUBLISHED PROPERTIES:');
  publishedResults.forEach(r => {
    console.log(`${r.n}. ${r.address}, ${r.city}, ${r.state} ${r.zip} ($${r.rent.toLocaleString()}/mo | ${r.beds} Bed / ${r.baths} Bath) — ${r.url}`);
  });

  return { magicLink, publishedResults };
}

publishRecentProperties().catch(err => {
  console.error('Fatal error in publishing script:', err);
  process.exit(1);
});
