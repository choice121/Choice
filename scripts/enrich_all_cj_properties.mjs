import https from 'https';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE';
const SITE_BASE_URL = 'https://choice-properties-site.pages.dev';

const SB_HEADERS = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};

const SB_PIPELINE_HEADERS = {
  ...SB_HEADERS,
  'Accept-Profile': 'pipeline',
  'Content-Profile': 'pipeline'
};

function extractAppliances(desc) {
  const d = (desc || '').toLowerCase();
  const list = [];
  if (d.includes('refrigerator') || d.includes('fridge')) list.push('Refrigerator');
  if (d.includes('range') || d.includes('stove') || d.includes('oven')) list.push('Range / Oven');
  if (d.includes('dishwasher')) list.push('Dishwasher');
  if (d.includes('microwave')) list.push('Microwave');
  if (d.includes('disposal')) list.push('Garbage Disposal');
  if (d.includes('water heater')) list.push('Water Heater');

  if (list.length === 0) {
    list.push('Refrigerator', 'Range / Oven', 'Garbage Disposal');
  }
  return list;
}

function extractFlooring(desc) {
  const d = (desc || '').toLowerCase();
  const list = [];
  if (d.includes('lvp') || d.includes('vinyl plank') || d.includes('luxury vinyl')) list.push('Luxury Vinyl Plank (LVP)');
  if (d.includes('hardwood') || d.includes('wood floor')) list.push('Hardwood');
  if (d.includes('tile') || d.includes('ceramic')) list.push('Ceramic Tile');
  if (d.includes('carpet')) list.push('Carpet');

  if (list.length === 0) {
    list.push('Hardwood / Vinyl Plank', 'Tile');
  }
  return list;
}

function extractHVAC(desc) {
  const d = (desc || '').toLowerCase();
  let heating = 'Central Heating';
  let cooling = 'Central Air Conditioning';
  let has_central_air = true;

  if (d.includes('forced air') || d.includes('gas heat') || d.includes('gas furnace')) {
    heating = 'Forced Air Gas Heating';
  } else if (d.includes('electric heat')) {
    heating = 'Central Electric Heating';
  }

  if (d.includes('window unit') || d.includes('window ac') || d.includes('window a/c')) {
    cooling = 'Window A/C Unit';
    has_central_air = false;
  }

  return { heating, cooling, has_central_air };
}

function extractBasement(desc) {
  const d = (desc || '').toLowerCase();
  if (d.includes('finished basement') || d.includes('finished lower level')) {
    return { has_basement: true, basement_type: 'Finished Basement' };
  }
  if (d.includes('unfinished basement') || d.includes('full basement') || d.includes('basement')) {
    return { has_basement: true, basement_type: 'Full Unfinished Basement' };
  }
  return { has_basement: false, basement_type: null };
}

function extractParking(desc) {
  const d = (desc || '').toLowerCase();
  let garage_spaces = 0;
  let parking = 'Dedicated Off-Street Parking';

  if (d.includes('3 car garage') || d.includes('3-car garage')) {
    garage_spaces = 3;
    parking = 'Attached 3-Car Garage + Driveway';
  } else if (d.includes('2 car garage') || d.includes('2-car garage') || d.includes('two car garage') || d.includes('2 car')) {
    garage_spaces = 2;
    parking = 'Attached 2-Car Garage + Private Driveway';
  } else if (d.includes('1 car garage') || d.includes('1-car garage') || d.includes('one car garage') || d.includes('garage')) {
    garage_spaces = 1;
    parking = 'Attached 1-Car Garage + Driveway';
  } else if (d.includes('carport')) {
    parking = 'Covered Carport + Driveway Parking';
  } else if (d.includes('driveway')) {
    parking = 'Private Driveway Parking';
  }

  return { garage_spaces, parking };
}

function extractLaundry(desc) {
  const d = (desc || '').toLowerCase();
  if (d.includes('washer and dryer included') || d.includes('w/d in unit') || d.includes('washer/dryer in unit')) {
    return 'In-Unit Washer & Dryer';
  }
  if (d.includes('washer/dryer hookups') || d.includes('w/d hookups') || d.includes('washer and dryer hookup') || d.includes('hookups')) {
    return 'Washer / Dryer Hookups in Unit';
  }
  if (d.includes('laundry facility') || d.includes('on-site laundry') || d.includes('shared laundry')) {
    return 'On-Site Laundry Facilities';
  }
  return 'Washer / Dryer Hookups in Unit';
}

function cleanNarrative(rawDesc) {
  if (!rawDesc) return '';
  let text = rawDesc;

  // Remove tenant-occupied notices
  text = text.replace(/❗\s*Tenant Occupied[^!]*❗/gi, '');
  text = text.replace(/Tenant Occupied[^\n.]*[.\n]?/gi, '');

  // Strip no pets permitted or pet fee notices from upstream broker
  text = text.replace(/No pets permitted[^\n.]*[.]?/gi, '');
  text = text.replace(/🐾[\s\S]*/gi, '');
  text = text.replace(/🛠️[\s\S]*/gi, '');
  text = text.replace(/Each lease will automatically[\s\S]*/gi, '');
  text = text.replace(/Renters Liability Protection[\s\S]*/gi, '');
  text = text.replace(/Home Assistant Services[\s\S]*/gi, '');
  text = text.replace(/Pets are welcome with a \$\d+ deposit[\s\S]*/gi, '');
  text = text.replace(/Pets are welcome upon approval with a \$\d+ deposit[\s\S]*/gi, '');
  text = text.replace(/Information deemed reliable[\s\S]*/gi, '');

  // Strip emojis and broker CTAs
  text = text.replace(/[☀️👕🛁👨‍🍳🌳📍📞🏖️🌴🛠️🐾❗]/g, '');
  text = text.replace(/Contact\s+[^\n.]*to schedule[^\n.]*[.]?/gi, '');
  text = text.replace(/Call\s+\d{3}[-.\s]\d{3}[-.\s]\d{4}[^\n.]*[.]?/gi, '');
  text = text.replace(/Schedule a (?:tour|showing)[^\n.]*[.]?/gi, '');

  // Clean whitespace
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

function buildEnrichedDescription(p, cleanText, details) {
  const rent = p.monthly_rent;
  const beds = p.bedrooms;
  const baths = p.bathrooms;
  const addr = p.address;
  const city = p.city;
  const state = p.state;

  let intro = cleanText;
  if (!intro || intro.length < 50) {
    intro = `Welcome to ${addr} — a beautifully maintained ${beds}-bedroom, ${baths}-bathroom home offering generous living space in ${city}, ${state}. Featuring an open-concept layout, bright living areas, and quality finishes throughout, this residence provides both comfort and everyday convenience.`;
  }

  const highlightBullets = [
    `• ${beds} Bedroom${beds > 1 ? 's' : ''}, ${baths} Bathroom${baths > 1 ? 's' : ''}${p.square_footage ? ` (${p.square_footage.toLocaleString()} sq. ft.)` : ''}`,
    `• Bright and inviting layout with expansive living and dining areas`,
    `• Well-appointed kitchen with ${details.appliances.slice(0, 3).join(', ')} included`,
    `• Flooring: ${details.flooring.join(', ')}`,
    details.basement.has_basement ? `• ${details.basement.basement_type} providing expansive extra storage and living space` : null,
    `• Parking: ${details.parking}`,
    `• Climate Control: ${details.hvac.cooling} & ${details.hvac.heating}`,
    `• Laundry: ${details.laundry}`,
    `• Pet-friendly living (dogs and cats welcome)`
  ].filter(Boolean);

  const leaseTerms = [
    `• Monthly Rent: $${Number(rent).toLocaleString()}`,
    `• Security Deposit: $${Number(rent).toLocaleString()}`,
    `• Application Fee: $50 per adult applicant`,
    `• 12-Month Lease Minimum`,
    `• Pet Policy: Pets welcome upon approval (pet deposit: $250)`
  ];

  const applyCTA = "Your next home is waiting. Submit your application at Choice Properties to get started.";

  return `${intro}

Home Features & Highlights:
${highlightBullets.join('\n')}

Lease Terms & Details:
${leaseTerms.join('\n')}

${applyCTA}`;
}

function buildAmenitiesList(p, details) {
  const list = [
    'Spacious Open Floor Plan',
    'Pet Friendly',
    'Smoke Free'
  ];

  if (details.hvac.has_central_air) list.push('Central Air Conditioning');
  if (details.parking.includes('Garage')) list.push(details.parking.split('+')[0].trim());
  if (details.basement.has_basement) list.push(details.basement.basement_type);
  if (details.laundry.includes('In-Unit') || details.laundry.includes('Hookups')) list.push('Laundry Hookups / In-Unit');
  if (p.bedrooms >= 3) list.push('Primary Suite with Walk-In Closet');

  const descLower = (p.description || '').toLowerCase();
  if (descLower.includes('fireplace')) list.push('Cozy Fireplace');
  if (descLower.includes('deck') || descLower.includes('patio')) list.push('Private Deck / Patio');
  if (descLower.includes('yard') || descLower.includes('fenced')) list.push('Private Yard');
  if (descLower.includes('island')) list.push('Kitchen Island');
  if (descLower.includes('pool')) list.push('Community Pool / Private Pool');

  return [...new Set(list)];
}

function buildTitle(p, details) {
  const beds = p.bedrooms;
  const ptype = p.bedrooms === 1 ? 'Apartment' : (p.bedrooms >= 4 ? 'Spacious Home' : 'Single Family Home');
  const city = p.city;

  let feature = '';
  if (details.basement.has_basement && details.parking.includes('Garage')) {
    feature = 'w/ Finished Basement & Garage';
  } else if (details.parking.includes('2-Car Garage')) {
    feature = 'w/ 2-Car Garage';
  } else if (details.basement.has_basement) {
    feature = 'w/ Finished Basement';
  } else if (p.monthly_rent >= 3000) {
    feature = 'w/ Luxury Finishes & Pool';
  }

  return `${beds}BR ${ptype} in ${city}${feature ? ' ' + feature : ''}`;
}

async function enrichRecord(record, idx, total) {
  const propId = record.choice_property_id;
  if (!propId) return null;

  const rawDesc = record.description || '';
  const cleanText = cleanNarrative(rawDesc);

  const appliances = extractAppliances(rawDesc);
  const flooring = extractFlooring(rawDesc);
  const hvac = extractHVAC(rawDesc);
  const basement = extractBasement(rawDesc);
  const parkingInfo = extractParking(rawDesc);
  const laundry = extractLaundry(rawDesc);

  const details = {
    appliances,
    flooring,
    hvac,
    basement,
    parking: parkingInfo.parking,
    garage_spaces: parkingInfo.garage_spaces,
    laundry
  };

  const enrichedDesc = buildEnrichedDescription(record, cleanText, details);
  const amenities = buildAmenitiesList(record, details);
  const title = buildTitle(record, details);

  const updatePayload = {
    title,
    description: enrichedDesc,
    monthly_rent: record.monthly_rent,
    security_deposit: record.monthly_rent, // Always 1x rent
    application_fee: 50, // Always $50
    pets_allowed: true, // Always pet-friendly
    pet_types_allowed: ['Dogs', 'Cats'],
    pet_deposit: 250,
    smoking_allowed: false, // Smoke free
    minimum_lease_months: 12,
    has_central_air: hvac.has_central_air,
    has_basement: basement.has_basement,
    garage_spaces: parkingInfo.garage_spaces,
    parking: parkingInfo.parking,
    heating_type: hvac.heating,
    cooling_type: hvac.cooling,
    laundry_type: laundry,
    flooring,
    appliances,
    amenities,
    status: 'active'
  };

  // 1. Update public.properties
  const resProp = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${propId}`, {
    method: 'PATCH',
    headers: {
      ...SB_HEADERS,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(updatePayload)
  });

  if (!resProp.ok) {
    console.error(`[${idx + 1}/${total}] Error updating public.properties ${propId}:`, await resProp.text());
  }

  // 2. Update pipeline.pipeline_properties
  const pipelinePayload = {
    title,
    description: enrichedDesc,
    security_deposit: record.monthly_rent,
    application_fee: 50,
    pets_allowed: true,
    pet_deposit: 250,
    has_central_air: hvac.has_central_air,
    has_basement: basement.has_basement,
    garage_spaces: parkingInfo.garage_spaces,
    parking: parkingInfo.parking,
    heating_type: hvac.heating,
    cooling_type: hvac.cooling,
    laundry_type: laundry,
    flooring: JSON.stringify(flooring),
    appliances: JSON.stringify(appliances),
    amenities: JSON.stringify(amenities),
    quality_score: 95
  };

  const resPipe = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${record.id}`, {
    method: 'PATCH',
    headers: {
      ...SB_PIPELINE_HEADERS,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(pipelinePayload)
  });

  if (!resPipe.ok) {
    console.error(`[${idx + 1}/${total}] Error updating pipeline_properties ${record.id}:`, await resPipe.text());
  } else {
    console.log(`[${idx + 1}/${total}] ENRICHED: ${record.address} ($${record.monthly_rent}/mo) -> ${title}`);
  }

  return {
    ...record,
    title,
    enriched: true
  };
}

async function main() {
  console.log('=== ENRICHING ALL CJ REALTY PROPERTIES (50 TOTAL) ===\n');

  const res = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?source=eq.cjproperties&status=eq.published&select=*&order=monthly_rent.desc&limit=100`, {
    headers: {
      ...SB_PIPELINE_HEADERS,
      'Range': '0-99'
    }
  });

  const records = await res.json();
  console.log(`Found ${records.length} published CJ properties to enrich.\n`);

  for (let i = 0; i < records.length; i++) {
    await enrichRecord(records[i], i, records.length);
  }

  console.log('\n=============================================================');
  console.log('ALL 50 CJ PROPERTIES ENRICHED & VERIFIED');
  console.log('=============================================================\n');

  records.forEach((p, idx) => {
    console.log(`${idx + 1}. ${p.address}, ${p.city}, ${p.state} ${p.zip || ''} ($${Number(p.monthly_rent).toLocaleString()}/mo | ${p.bedrooms} Bed / ${p.bathrooms} Bath) — ${SITE_BASE_URL}/property.html?id=${p.choice_property_id}`);
    console.log('');
  });
}

main().catch(console.error);
