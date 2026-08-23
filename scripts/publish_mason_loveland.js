import { CREDENTIALS_CONFIG } from '../credentials-config.mjs';

const SUPABASE_URL = CREDENTIALS_CONFIG.SUPABASE_URL;
const KEY = CREDENTIALS_CONFIG.SUPABASE_API_KEY;

const HEADERS = {
  'apikey': KEY,
  'Authorization': 'Bearer ' + KEY,
  'Content-Type': 'application/json'
};

function slugSeg(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function buildCanonicalUrl(p) {
  const id = String(p.id).toLowerCase();
  const state = String(p.state || 'oh').toLowerCase().slice(0, 2);
  const city = slugSeg(p.city);
  const beds = (p.bedrooms == null) ? 'home' : (Number(p.bedrooms) === 0 ? 'studio' : Number(p.bedrooms) + 'br');
  const rawType = String(p.property_type || '').toLowerCase().replace(/[\s_]+/g, '-');
  const typeMap = {
    'single-family': 'house', 'single_family': 'house',
    'townhomes': 'townhouse', 'townhome': 'townhouse',
    'condos': 'condo', 'apartment': 'apartment', 'house': 'house',
    'condo': 'condo', 'townhouse': 'townhouse', 'duplex': 'duplex',
    'studio': 'studio', 'multi-family': 'multi-family', 'mobile-home': 'mobile-home'
  };
  const type = typeMap[rawType] || rawType || 'house';
  return `/rent/${state}/${city}/${beds}-${type}-${id}/`;
}

const ENRICHED_DATA = {
  'PP-FB0E2A95': {
    title: '2BR/2.5BA Townhome in Mason w/ Garage – $1975/mo',
    city: 'Mason',
    state: 'OH',
    zip: '45040',
    property_type: 'TOWNHOMES',
    monthly_rent: 1975,
    security_deposit: 1975,
    application_fee: 50,
    pets_allowed: true,
    smoking_allowed: false,
    minimum_lease_months: 12,
    parking: 'Attached Garage + Driveway',
    has_basement: false,
    has_central_air: true,
    description: `Welcome to 4257 Spyglass Hl — a beautifully maintained 2-bedroom, 2.5-bathroom townhome in the highly desirable community of Mason, OH, offering approximately 1,210 sq. ft. of comfortable living space.

This thoughtfully designed residence features hardwood flooring, brand-new carpeting, energy-efficient windows, and updated modern appliances. The main floor boasts a bright living area, a fully equipped kitchen with refrigerator and dishwasher, and in-unit washer and dryer. Upstairs includes two spacious bedrooms, 2.5 bathrooms, and a versatile loft space ideal for a home office, study, or cozy reading retreat.

Outside, enjoy a spacious backyard and the convenience of an attached garage and private driveway. Located in the top-rated Mason City School District with HOA fees covered by the owner.

Home Features & Highlights:
• 2 Bedrooms, 2.5 Bathrooms with dedicated home office loft
• Modern kitchen complete with refrigerator, dishwasher, and ample cabinetry
• In-unit washer and dryer included
• Attached garage plus private driveway parking
• Large backyard retreat
• Central air conditioning and heating
• Top-rated Mason City School District
• Pet-friendly living (dogs and cats welcome)

Lease Terms:
• Monthly Rent: $1975 (includes HOA fees)
• Security Deposit: $1975 (equal to 1 month's rent)
• Application Fee: $50 per adult applicant
• 12-Month Lease Minimum

Your next home is waiting. Submit your application at Choice Properties to get started.`
  },
  'PP-6A16C24B': {
    title: '3BR/2BA Single-Family Home in Loveland w/ Garage – $1800/mo',
    city: 'Loveland',
    state: 'OH',
    zip: '45140',
    property_type: 'SINGLE_FAMILY',
    monthly_rent: 1800,
    security_deposit: 1800,
    application_fee: 50,
    pets_allowed: true,
    smoking_allowed: false,
    minimum_lease_months: 12,
    parking: 'Attached Garage + Driveway',
    has_basement: true,
    has_central_air: true,
    description: `Welcome to 3290 Myrtle Dr — a charming and spacious 3-bedroom, 2-bathroom single-family residence in Loveland, OH, offering approximately 1,616 sq. ft. of versatile living space.

This unique home features a flexible floor plan that can function as a full 3-bedroom home or a 2-bedroom layout with a private in-law suite setup with second kitchenette. Highlights include an unfinished basement offering abundant storage, an attached garage with private driveway parking, and an expansive backyard perfect for outdoor gatherings and relaxation.

Situated in the highly regarded Kings Local School District with quick access to local shopping, dining, and scenic Little Miami parks and trails.

Home Features & Highlights:
• 3 Bedrooms, 2 Full Bathrooms with flexible layout configuration
• Fully equipped primary kitchen with solid cabinetry and counter space
• Unfinished basement providing generous storage and hobby space
• Attached garage plus dedicated private driveway
• Expansive private backyard
• Central heating and cooling for year-round comfort
• Highly rated Kings Local School District
• Pet-friendly living (dogs and cats welcome)

Lease Terms:
• Monthly Rent: $1800
• Security Deposit: $1800 (equal to 1 month's rent)
• Application Fee: $50 per adult applicant
• 12-Month Lease Minimum

Your next home is waiting. Submit your application at Choice Properties to get started.`
  }
};

async function publishPipelineProperty(pipelineId) {
  console.log(`\n======================================================`);
  console.log(`Publishing pipeline property: ${pipelineId}`);

  // 1. Fetch the pipeline record
  const listRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pipeline_list`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ p_status: 'all', p_limit: 2000, p_offset: 0 })
  });
  const list = await listRes.json();
  const p = list.find(item => item.id === pipelineId);

  if (!p) {
    throw new Error(`Pipeline record ${pipelineId} not found`);
  }

  console.log(`Found: ${p.address}, ${p.city}, ${p.state} ${p.zip}`);

  // 2. Save cleaned patch to pipeline first
  const patch = ENRICHED_DATA[pipelineId];
  if (patch) {
    console.log('Saving cleaned fields to pipeline...');
    const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pipeline_save`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ p_id: p.id, p_patch: patch })
    });
    const saveData = await saveRes.json();
    console.log('pipeline_save response:', saveData);
    if (!saveData.ok) {
      throw new Error(`Failed to save patch: ${JSON.stringify(saveData)}`);
    }
  }

  // 3. Call pipeline_publish RPC
  console.log('Calling pipeline_publish RPC...');
  const pubRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pipeline_publish`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ p_id: p.id, p_landlord_id: null })
  });
  const pubData = await pubRes.json();
  console.log('Publish RPC response:', pubData);

  if (!pubData.ok || !pubData.choice_property_id) {
    throw new Error(`Publish RPC failed for ${p.id}: ${JSON.stringify(pubData)}`);
  }

  const choiceId = pubData.choice_property_id;
  console.log(`Published to properties table with ID: ${choiceId}`);

  // 4. Ensure property status is 'active' and listed_at is set to today
  const todayStr = new Date().toISOString().split('T')[0];
  const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${encodeURIComponent(choiceId)}`, {
    method: 'PATCH',
    headers: HEADERS,
    body: JSON.stringify({
      status: 'active',
      listed_at: todayStr
    })
  });
  console.log(`Activated property in properties table: ${patchRes.status}`);

  // 5. Insert photos into property_photos if needed
  let rawImages = [];
  try {
    rawImages = typeof p.original_image_urls === 'string' ? JSON.parse(p.original_image_urls) : p.original_image_urls;
  } catch (e) {
    rawImages = [];
  }

  if (rawImages && rawImages.length > 0) {
    console.log(`Inserting ${rawImages.length} ImageKit photos into property_photos...`);
    const photoRows = rawImages.map((img, idx) => {
      const url = typeof img === 'string' ? img : img.url;
      const fileId = (typeof img === 'object' && img.fileId) ? img.fileId : null;
      const width = (typeof img === 'object' && img.width) ? img.width : null;
      const height = (typeof img === 'object' && img.height) ? img.height : null;
      return {
        property_id: choiceId,
        url: url,
        file_id: fileId,
        width: width,
        height: height,
        display_order: idx,
        is_hero: idx === 0,
        watermark_status: 'pending',
        alt_text: `${p.address}, ${p.city} OH - Photo ${idx + 1}`
      };
    });

    const photoRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos`, {
      method: 'POST',
      headers: { ...HEADERS, 'Prefer': 'return=minimal' },
      body: JSON.stringify(photoRows)
    });
    console.log(`Photo insertion response: ${photoRes.status}`);
  }

  const merged = { ...p, ...(patch || {}), id: choiceId };
  const canonicalPath = buildCanonicalUrl(merged);
  const directPath = `/property.html?id=${choiceId}`;

  return {
    pipelineId: p.id,
    choicePropertyId: choiceId,
    title: merged.title,
    address: `${merged.address}, ${merged.city}, ${merged.state} ${merged.zip}`,
    monthlyRent: merged.monthly_rent,
    bedrooms: merged.bedrooms,
    bathrooms: merged.bathrooms,
    sqft: merged.square_footage,
    photoCount: rawImages ? rawImages.length : 0,
    canonicalUrl: `https://choice-properties-site.pages.dev${canonicalPath}`,
    directUrl: `https://choice-properties-site.pages.dev${directPath}`,
    canonicalPath: canonicalPath
  };
}

async function main() {
  const idsToPublish = ['PP-FB0E2A95', 'PP-6A16C24B'];
  const results = [];

  for (const id of idsToPublish) {
    try {
      const res = await publishPipelineProperty(id);
      results.push(res);
    } catch (err) {
      console.error(`Error publishing ${id}:`, err);
    }
  }

  console.log('\n======================================================');
  console.log('RESULTS:');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
