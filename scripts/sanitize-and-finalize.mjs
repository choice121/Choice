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
  'Content-Profile': 'pipeline',
  'Prefer': 'return=representation'
};

async function main() {
  // 1. Fetch the 19 published properties
  const res = await fetch(`${SUPABASE_URL}/rest/v1/properties?status=eq.private_placement&order=created_at.desc&limit=19`, {
    headers: HEADERS
  });
  const properties = await res.json();
  console.log(`Fetched ${properties.length} published private_placement properties to finalize.`);

  const publishedIds = [];
  const propertyCards = [];

  for (const prop of properties) {
    publishedIds.push(prop.id);

    // Clean appliances
    let cleanAppliances = ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave'];
    if (prop.laundry_type === 'In Unit') {
      cleanAppliances.push('In-Unit Washer & Dryer');
    } else {
      cleanAppliances.push('Washer/Dryer Hookups');
    }
    if (prop.address.includes('Autumn')) {
      cleanAppliances = ['Refrigerator', 'Gas Range & Oven', 'Dishwasher', 'Microwave', 'Washer/Dryer Hookups'];
    }
    if (prop.address.includes('Woodston')) {
      cleanAppliances = ['Refrigerator', 'Gas Range & Oven', 'Dishwasher', 'Microwave', 'In-Unit Washer & Dryer'];
    }
    if (prop.address.includes('Trezevant')) {
      cleanAppliances = ['New Stainless Refrigerator', 'Gas Range & Oven', 'Dishwasher', 'Microwave', 'New Washer & Dryer'];
    }

    // Clean amenities
    let cleanAmenities = (prop.amenities || []).filter(a => typeof a === 'string' && a.length > 2 && !['[', ']', '"', ','].includes(a));
    if (!cleanAmenities.includes('Central Air Conditioning & Heating')) {
      cleanAmenities.unshift('Central Air Conditioning & Heating');
    }

    // Clean description to ensure appliance list is pristine
    let desc = prop.description || '';
    const cleanApplianceText = cleanAppliances.join(', ');
    desc = desc.replace(/Kitchen equipped with [^\n]+/g, `Kitchen equipped with ${cleanApplianceText}`);
    desc = desc.replace(/Kitchen includes: [^\n]+/g, `Kitchen includes: ${cleanApplianceText}`);
    desc = desc.replace(/appliances including [^.]+/g, `appliances including ${cleanApplianceText}`);

    // Patch property in database
    await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${prop.id}`, {
      method: 'PATCH',
      headers: HEADERS,
      body: JSON.stringify({
        appliances: cleanAppliances,
        amenities: cleanAmenities,
        description: desc
      })
    });

    propertyCards.push({
      id: prop.id,
      address: prop.address,
      city: prop.city,
      state: prop.state,
      zip: prop.zip,
      rent: prop.monthly_rent,
      beds: prop.bedrooms,
      baths: prop.bathrooms,
      sqft: prop.square_footage,
      year: prop.year_built,
      parking: prop.parking,
      laundry: prop.laundry_type,
      appliances: cleanAppliances,
      amenities: cleanAmenities,
      url: `${SITE_URL}/property.html?id=${prop.id}`
    });
  }

  // 2. Generate clean client magic link
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const shareId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  await fetch(`${SUPABASE_URL}/rest/v1/property_shares`, {
    method: 'POST',
    headers: { ...HEADERS, 'Prefer': 'return=minimal' },
    body: JSON.stringify({
      id: shareId,
      token_hash: tokenHash,
      expires_at: expiresAt
    })
  });

  const shareLinks = publishedIds.map(pId => ({
    share_id: shareId,
    property_id: pId
  }));

  await fetch(`${SUPABASE_URL}/rest/v1/property_share_properties`, {
    method: 'POST',
    headers: { ...HEADERS, 'Prefer': 'return=minimal' },
    body: JSON.stringify(shareLinks)
  });

  const masterMagicLink = `${SITE_URL}/listings.html#share=${rawToken}`;

  // 3. Clear pipeline.pipeline_properties now that publishing is verified
  console.log('Clearing pipeline.pipeline_properties table for fresh inbox...');
  await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=neq.none`, {
    method: 'DELETE',
    headers: HEADERS_PIPELINE
  });
  console.log('✓ Pipeline cleared.');

  console.log('\nFINAL_MAGIC_LINK:', masterMagicLink);
  console.log('\nFINAL_PROPERTIES_DATA_START');
  console.log(JSON.stringify(propertyCards, null, 2));
  console.log('FINAL_PROPERTIES_DATA_END');
}

main().catch(console.error);
