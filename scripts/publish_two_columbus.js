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

const CLEANED_PROPERTIES = {
  'PP-260A1C9E': {
    title: '3BR/2BA Single-Family Home in Columbus – $1595/mo',
    monthly_rent: 1595,
    security_deposit: 1595,
    application_fee: 50,
    pets_allowed: true,
    smoking_allowed: false,
    minimum_lease_months: 12,
    parking: 'Driveway + Street',
    description: `Welcome to 1276 Wager St — a beautifully appointed 3-bedroom, 2-bathroom single-family residence in Columbus, OH offering approximately 1,273 sq. ft. of comfortable living space.

This lovely home features an open floor plan where the living room blends seamlessly into an island kitchen equipped with stainless steel appliances. The spacious primary bedroom and secondary bedrooms are complemented by two full contemporary bathrooms. In-unit washer and dryer hookups provide everyday convenience. Outside, enjoy a fenced backyard with a storage shed, perfect for outdoor relaxation.

Ideally located in South Columbus just minutes from German Village, Schiller Park, the Brewery District, Scioto Audubon Metro Park, and easy highway access to I-70 and I-71.

Home Features & Highlights:
• 3 Bedrooms, 2 Full Bathrooms with generous closet storage
• Modern kitchen with island and stainless steel appliances
• Central heating and air conditioning
• In-unit washer/dryer hookups
• Fenced backyard with storage shed
• Pet-friendly living (dogs and cats welcome)

Lease Terms:
• Monthly Rent: $1595
• Security Deposit: $1595 (equal to 1 month's rent)
• Application Fee: $50 per adult applicant
• 12-Month Lease Minimum

Your next home is waiting. Submit your application at Choice Properties to get started.`
  },
  'PP-4187D1EE': {
    title: '3BR/1BA Single-Family Home in Columbus – $1496/mo',
    monthly_rent: 1496,
    security_deposit: 1496,
    application_fee: 50,
    pets_allowed: true,
    smoking_allowed: false,
    minimum_lease_months: 12,
    parking: 'Attached Garage + Driveway',
    description: `Welcome to 1630 Elaine Rd — a charming 3-bedroom, 1-bathroom single-family home in Columbus, OH offering approximately 1,053 sq. ft. of light-filled living space.

The living room features a decorative fireplace that adds warmth and character. The kitchen is equipped with an oven, refrigerator, and dishwasher. Extend your living space into the bright, versatile enclosed sunroom overlooking the private backyard. An attached garage and private driveway provide convenient parking and additional storage.

Conveniently located near OH-317 and major transit routes, providing quick access to local schools, neighborhood parks, retail plazas, and downtown Columbus.

Home Features & Highlights:
• 3 Bedrooms, 1 Full Bathroom with functional single-story layout
• Kitchen equipped with refrigerator, oven, and dishwasher
• Decorative fireplace and bright enclosed sunroom
• Central heating and air conditioning
• Attached garage plus private driveway parking
• Pet-friendly living (dogs and cats welcome)

Lease Terms:
• Monthly Rent: $1496
• Security Deposit: $1496 (equal to 1 month's rent)
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
    body: JSON.stringify({ p_status: 'all', p_limit: 100, p_offset: 0 })
  });
  const list = await listRes.json();
  const p = list.find(item => item.id === pipelineId);

  if (!p) {
    throw new Error(`Pipeline record ${pipelineId} not found`);
  }

  console.log(`Found: ${p.address}, ${p.city}, ${p.state} ${p.zip}`);

  // 2. Save cleaned patch to pipeline first
  const patch = CLEANED_PROPERTIES[pipelineId];
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
    address: `${p.address}, ${p.city}, ${p.state} ${p.zip}`,
    monthlyRent: merged.monthly_rent,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    sqft: p.square_footage,
    photoCount: rawImages ? rawImages.length : 0,
    canonicalUrl: `https://choice-properties-site.pages.dev${canonicalPath}`,
    directUrl: `https://choice-properties-site.pages.dev${directPath}`,
    localDirectUrl: `http://localhost:3000${directPath}`,
    canonicalPath: canonicalPath
  };
}

async function main() {
  const idsToPublish = ['PP-260A1C9E', 'PP-4187D1EE'];
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
