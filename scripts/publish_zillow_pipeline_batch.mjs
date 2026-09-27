import crypto from 'crypto';

const SUPABASE_URL = "https://tlfmwetmhthpyrytrcfo.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE";

const ZILLOW_PROPERTIES = [
  {
    pipeline_id: 'PP-F8D83E41',
    existing_property_id: '9f8909ac-7708-45a0-b81d-ad4bcf9a8e9d',
    source_url: 'https://www.zillow.com/homedetails/1970-N-4th-St-Columbus-OH-43201/2117379813_zpid/',
    address: '1970 N 4th St',
    city: 'Columbus',
    state: 'OH',
    zip: '43201',
    monthly_rent: 1850,
    bedrooms: 5,
    bathrooms: 2,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 2500,
    lot_size_sqft: 5227,
    property_type: 'SINGLE_FAMILY',
    year_built: 1900,
    floors: 2,
    parking: 'Off-street private parking behind property, front parking',
    garage_spaces: 0,
    has_basement: true,
    has_central_air: true,
    appliances: ['Refrigerator', 'Range', 'Oven', 'Washer', 'Dryer'],
    amenities: ['Front Porch', 'Back Deck', 'Full Basement', 'Private Off-Street Parking', 'In-Unit Washer & Dryer', 'Central Heat', 'Spacious Living Areas'],
    utilities_included: ['Water', 'Sewer', 'Trash'],
    lat: 39.999645,
    lng: -82.99948,
    title: '1970 N 4th St, Columbus, OH 43201',
    original_description: `Spacious rental in a prime location near OSU campus! Just minutes away from highways, bus routes, and downtown, this property offers convenience and comfort. Enjoy a large living room, dining room, and a full basement for ample storage. Bright and airy bedrooms with plenty of natural light. On-site washer and dryer are available at no cost. Tenants will appreciate private off-street parking behind the property, with additional parking available in the front. Relax on the front porch or back deck. Perfect for those seeking a blend of convenience and space!Non-smoking house. Owner pays for trash, sewer, and water. Renter is responsible for gas and electric.`,
    enriched_description: `Offering exceptional living space across a 2,500-square-foot layout, this five-bedroom, two-full-bathroom single-family residence is ideally positioned in Columbus just minutes from the Ohio State University campus and downtown. The home welcomes residents with a covered front porch that opens into an expansive main living room paired with a dedicated formal dining room, perfect for hosting and daily gathering. The kitchen provides straightforward functionality with ample cabinetry and workspace, complemented by a full basement that delivers extensive clean storage capacity and included on-site laundry appliances. Five well-proportioned bedrooms feature large windows that capture natural daylight throughout the day, while two complete bathrooms support busy daily routines. Outside, enjoy a private rear deck overlooking the yard alongside dedicated off-street parking behind the home and convenient front parking options. Positioned close to major highway connectors and public transit, this residence combines generous square footage with swift access to campus, medical centers, and urban dining.`
  },
  {
    pipeline_id: 'PP-C12220B1',
    existing_property_id: '7d166837-a6d2-4400-a433-0f1b119d6b6e',
    source_url: 'https://www.zillow.com/homedetails/2438-Glenmawr-Ave-Columbus-OH-43202/2086921249_zpid/',
    address: '2438 Glenmawr Ave',
    city: 'Columbus',
    state: 'OH',
    zip: '43202',
    monthly_rent: 1800,
    bedrooms: 4,
    bathrooms: 2,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1200,
    lot_size_sqft: 4791,
    property_type: 'SINGLE_FAMILY',
    year_built: 1925,
    floors: 2,
    parking: 'Detached 1-Car Garage and Driveway',
    garage_spaces: 1,
    has_basement: true,
    has_central_air: true,
    appliances: ['Refrigerator', 'Range', 'Oven', 'Dishwasher', 'Microwave', 'Washer', 'Dryer'],
    amenities: ['Hardwood Floors', 'Screened-In Front Porch', 'Fenced Backyard', 'Central Air Conditioning', '1-Car Garage', 'Stainless Steel Appliances', 'In-Unit Washer & Dryer'],
    utilities_included: [],
    lat: 40.01252,
    lng: -83.00769,
    title: '2438 Glenmawr Ave, Columbus, OH 43202',
    original_description: `Hardwood floors, stainless steel appliances, washer and dryer. One car garage, fenced in yard, central air, dishwasher, microwave, 2 full baths, screened in front porch.tenant responsible for gas, ater, and electric`,
    enriched_description: `Classic character and everyday practicality come together in this four-bedroom, two-full-bathroom single-family home on Glenmawr Avenue in Columbus. Polished hardwood floors carry through the main living areas, creating an inviting flow from the comfortable living room into the kitchen and dining spaces. The kitchen is outfitted with stainless steel appliances, including a built-in dishwasher and microwave, accompanied by quality cabinetry and counter prep space. A private screened-in front porch offers a sheltered outdoor nook for morning coffee, while the fully fenced backyard provides a secure outdoor retreat for leisure and pets. Two full bathrooms effectively accommodate residents, and an included washer and dryer simplifies laundry tasks. A detached one-car garage supplies covered parking and seasonal storage, with central air conditioning maintaining year-round comfort. Conveniently situated near High Street, neighborhood parks, and essential commuter routes, this residence delivers an all-around balanced Columbus setting.`
  },
  {
    pipeline_id: 'PP-9FA0D067',
    existing_property_id: null, // New listing
    source_url: 'https://www.zillow.com/homedetails/1432-Minnesota-Ave-Columbus-OH-43211/33860450_zpid/',
    address: '1432 Minnesota Ave',
    city: 'Columbus',
    state: 'OH',
    zip: '43211',
    monthly_rent: 1750,
    bedrooms: 4,
    bathrooms: 1.5, // CRITICAL: Decimal precision, 1 full + 1 half bath!
    half_bathrooms: 1,
    total_bathrooms: 1.5,
    square_footage: 1296,
    lot_size_sqft: 5000,
    property_type: 'SINGLE_FAMILY',
    year_built: 1950,
    floors: 2,
    parking: 'Driveway and Street Parking',
    garage_spaces: 0,
    has_basement: true,
    has_central_air: true,
    appliances: ['Refrigerator', 'Range', 'Oven'],
    amenities: ['Spacious Yard', 'Full Basement', 'Half Bath Powder Room', 'Equipped Kitchen', 'Central Heating', 'Driveway Parking'],
    utilities_included: [],
    lat: 40.01524,
    lng: -82.97341,
    title: '1432 Minnesota Ave, Columbus, OH 43211',
    original_description: `Welcome home to 1432 Minnesota Ave a spacious Single Family, 4-bedroom, 1.5-bath house offering 1,296 square feet of comfortable living space in Columbus, Ohio. The kitchen comes equipped with a refrigerator and stove, so you're ready to move right in, and cats are welcome.This home is offered at $1,750/month with a matching $1,750 security deposit ($45 application fee per applicant).Don't miss your chance to make this house your next home schedule a showing today!`,
    enriched_description: `Spanning 1,296 square feet of functional living space, this four-bedroom, 1.5-bathroom single-family home on Minnesota Avenue offers an accommodating layout tailored for flexibility. The main level centers around a bright, open living room with large windows that invite natural daylight throughout the space. Adjacent to the living quarters, the practical kitchen comes equipped with a refrigerator, cooking stove, and dedicated cabinetry for food preparation and pantry storage. Four well-sized bedrooms provide versatility for sleeping arrangements, a home office, or creative space, supported by a main full bathroom and a convenient powder room half-bath for guests. Generous outdoor yard space surrounds the home, adding room for outdoor activities and pets. Located with convenient access to central Columbus thoroughfares, neighborhood parks, and local amenities, this residence offers a straightforward and comfortable home environment.`
  }
];

function sanitizeForRules(text) {
  let clean = text;
  // Security deposit removal
  clean = clean.replace(/(\$\s*\d+[\d,]*\s*)?(?:refundable\s+)?(?:security\s+)?deposit[^\.\n;]*/gi, '');
  clean = clean.replace(/matching\s+\$?\d+[\d,]*\s*security\s*deposit[^\.\n;]*/gi, '');
  // Lease term removal
  clean = clean.replace(/\b(?:12|24|36|6)\s*[- ]month\s*lease\b[^\.\n;]*/gi, '');
  clean = clean.replace(/\b(?:lease\s*terms?|minimum\s*lease)[^\.\n;]*/gi, '');
  // Smoking removal
  clean = clean.replace(/\b(?:no\s*smoking|non[- ]smoking|smoking\s*(?:prohibited|allowed|policy))[^\.\n;]*/gi, '');
  // Showing / tour removal
  clean = clean.replace(/\b(?:schedule\s*a\s*(?:tour|showing)|book\s*a\s*showing|call\s*for\s*showing)[^\.\n;]*/gi, '');
  return clean.replace(/\s{2,}/g, ' ').trim();
}

async function run() {
  console.log('===============================================================');
  console.log('Choice Properties — Master Zillow Pipeline Enrichment & Publish');
  console.log('===============================================================');

  const publishedResults = [];

  for (const item of ZILLOW_PROPERTIES) {
    console.log(`\n---------------------------------------------------------------`);
    console.log(`Processing ${item.pipeline_id} (${item.address})...`);

    // 1. Fetch raw pipeline record to get original photos & metadata
    const pipeRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${item.pipeline_id}&select=*`, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Accept-Profile': 'pipeline'
      }
    });
    const [pipeRecord] = await pipeRes.json();
    if (!pipeRecord) {
      throw new Error(`Pipeline record ${item.pipeline_id} not found!`);
    }

    const rawPhotos = typeof pipeRecord.original_image_urls === 'string'
      ? JSON.parse(pipeRecord.original_image_urls)
      : (pipeRecord.original_image_urls || []);
    console.log(`[photos] Raw photo count: ${rawPhotos.length}`);
    if (rawPhotos.length < 6) {
      throw new Error(`Property ${item.address} has only ${rawPhotos.length} photos; minimum required is 6!`);
    }

    // Surgical description audit
    const safeDesc = sanitizeForRules(item.enriched_description);
    if (/deposit/i.test(safeDesc)) throw new Error(`Audit failed: deposit in description for ${item.address}`);
    if (/smoking/i.test(safeDesc)) throw new Error(`Audit failed: smoking in description for ${item.address}`);
    if (/lease/i.test(safeDesc)) throw new Error(`Audit failed: lease term in description for ${item.address}`);
    if (/showing|schedule\s*a\s*tour/i.test(safeDesc)) throw new Error(`Audit failed: showing text in description for ${item.address}`);

    let targetPropertyId = item.existing_property_id;

    const propertyPayload = {
      title: item.title,
      description: safeDesc,
      address: item.address,
      city: item.city,
      state: item.state,
      zip: item.zip,
      monthly_rent: item.monthly_rent,
      security_deposit: item.monthly_rent, // Rule: Exactly 1x monthly rent
      application_fee: 50,                // Rule: Standard $50
      pets_allowed: true,                 // Rule: Always pet friendly
      smoking_allowed: false,             // Rule: Never smoking allowed
      lease_terms: null,                  // Rule: Omitted
      minimum_lease_months: null,         // Rule: Omitted
      bedrooms: item.bedrooms,
      bathrooms: item.bathrooms,          // Decimal precision (1.5 for Minnesota!)
      half_bathrooms: item.half_bathrooms,
      total_bathrooms: item.total_bathrooms,
      square_footage: item.square_footage,
      lot_size_sqft: item.lot_size_sqft,
      property_type: item.property_type,
      year_built: item.year_built,
      floors: item.floors,
      parking: item.parking,
      garage_spaces: item.garage_spaces,
      has_basement: item.has_basement,
      has_central_air: item.has_central_air,
      appliances: item.appliances,
      amenities: item.amenities,
      utilities_included: item.utilities_included,
      lat: item.lat,
      lng: item.lng,
      status: 'active',
      listed_at: new Date().toISOString().split('T')[0],
      source_status: 'verified',
      last_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (targetPropertyId) {
      console.log(`[db] Updating existing property ${targetPropertyId} at ${item.address}...`);
      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${targetPropertyId}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(propertyPayload)
      });
      if (!updateRes.ok) {
        throw new Error(`Failed to update property ${targetPropertyId}: ${await updateRes.text()}`);
      }
      console.log(`[db] Successfully updated property ${targetPropertyId}`);
    } else {
      targetPropertyId = crypto.randomUUID();
      console.log(`[db] Inserting new property ${targetPropertyId} at ${item.address}...`);
      propertyPayload.id = targetPropertyId;
      propertyPayload.created_at = new Date().toISOString();

      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/properties`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(propertyPayload)
      });
      if (!insertRes.ok) {
        throw new Error(`Failed to insert property ${targetPropertyId}: ${await insertRes.text()}`);
      }
      console.log(`[db] Successfully inserted new property ${targetPropertyId}`);
    }

    // 2. Refresh photos in property_photos
    console.log(`[photos] Syncing ${rawPhotos.length} high-resolution photos for ${targetPropertyId}...`);
    // Delete existing photos for clean sync
    await fetch(`${SUPABASE_URL}/rest/v1/property_photos?property_id=eq.${targetPropertyId}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      }
    });

    const photoRows = rawPhotos.map((url, idx) => ({
      id: crypto.randomUUID(),
      property_id: targetPropertyId,
      url: url,
      display_order: idx + 1,
      is_hero: idx === 0,
      caption: idx === 0 ? 'Front Exterior' : null,
      created_at: new Date().toISOString()
    }));

    const batchSize = 25;
    for (let i = 0; i < photoRows.length; i += batchSize) {
      const slice = photoRows.slice(i, i + batchSize);
      const photoInsertRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(slice)
      });
      if (!photoInsertRes.ok) {
        throw new Error(`Failed to insert photos slice: ${await photoInsertRes.text()}`);
      }
    }
    console.log(`[photos] Successfully synced ${photoRows.length} photos`);

    // 3. Update pipeline record status to published
    console.log(`[pipeline] Updating pipeline record ${item.pipeline_id}...`);
    const pipeUpdateRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${item.pipeline_id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Content-Profile': 'pipeline'
      },
      body: JSON.stringify({
        status: 'published',
        choice_property_id: targetPropertyId,
        bathrooms: item.bathrooms,
        half_bathrooms: item.half_bathrooms,
        total_bathrooms: item.total_bathrooms,
        original_description: item.original_description,
        description: safeDesc,
        monthly_rent: item.monthly_rent,
        security_deposit: item.monthly_rent,
        application_fee: 50,
        pets_allowed: true,
        smoking_allowed: false,
        lease_terms: null,
        minimum_lease_months: null,
        published_at: new Date().toISOString(),
        photo_import_status: 'ok',
        updated_at: new Date().toISOString()
      })
    });
    if (!pipeUpdateRes.ok) {
      console.warn(`Warning: Pipeline patch returned status ${pipeUpdateRes.status}`);
    } else {
      console.log(`[pipeline] Successfully marked ${item.pipeline_id} as published`);
    }

    publishedResults.push({
      address: item.address,
      city: item.city,
      state: item.state,
      zip: item.zip,
      rent: item.monthly_rent,
      beds: item.bedrooms,
      baths: item.bathrooms,
      id: targetPropertyId
    });
  }

  console.log('\n===============================================================');
  console.log('ZILLOW BATCH PUBLISH COMPLETE');
  console.log('===============================================================');
  publishedResults.forEach((p, idx) => {
    console.log(`${idx + 1}. ${p.address}, ${p.city}, ${p.state} ${p.zip} ($${p.rent.toLocaleString()}/mo | ${p.beds} Bed / ${p.baths} Bath) — https://choice-properties-site.pages.dev/property.html?id=${p.id}`);
  });
}

run().catch(err => {
  console.error("Execution error:", err);
  process.exit(1);
});
