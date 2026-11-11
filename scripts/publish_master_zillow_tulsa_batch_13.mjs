import crypto from 'node:crypto';

const SUPABASE_URL = 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE';

const HEADERS = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

// Curated unique surgical descriptions grounded 100% in authentic verified source facts:
// No security deposit mentions, no lease terms, no smoking, no tour/showing CTAs, no broker contacts.
const PROPERTY_ENRICHMENTS = {
  'PP-6E6F677E': { // 5312 W 11th Pl
    property_type: 'SINGLE_FAMILY',
    title: '2BR SINGLE FAMILY in Tulsa',
    appliances: ['Refrigerator', 'Range/Oven', 'Dishwasher'],
    amenities: ['Hardwood Floors', 'Remodeled Kitchen', 'Stainless Steel Appliances', 'Carport', 'Partially Fenced Yard', 'Eat-In Kitchen', 'Dedicated Laundry Room'],
    flooring: 'Hardwood',
    parking: 'Carport',
    garage_spaces: 0,
    description: `5312 W 11th Pl is a fully remodeled bungalow-style home nestled in Tulsa's Cunningham Addition. Rich hardwood flooring flows throughout the primary living spaces, leading into an expansive eat-in kitchen complete with stainless steel appliances, generous cabinetry, and ample meal preparation counter space.

The updated full bathroom features modern fixtures, while a separate interior laundry room offers dedicated washer and electric dryer hookups. Step outside to find an oversized covered carport alongside a spacious, partially fenced backyard suitable for pets and outdoor relaxation. Positioned with straightforward access to local transit routes and neighborhood amenities.`
  },

  'PP-24B0D6E4': { // 3932 E Admiral Ct
    property_type: 'SINGLE_FAMILY',
    title: '2BR SINGLE FAMILY in Tulsa',
    appliances: ['Stove/Range'],
    amenities: ['Hardwood Floors', 'Original Fireplace', 'Vintage Architectural Details', 'Marble Tile Tub Surround', 'Shared Backyard', 'Natural Light'],
    flooring: 'Hardwood, Tile',
    parking: 'Street Parking',
    garage_spaces: 0,
    description: `3932 E Admiral Ct combines classic vintage charm with modern interior updates in Tulsa's historic Sequoyah neighborhood. The bright living room highlights original hardwood floors, tall sunlit windows, and a classic brick fireplace centerpiece.

The kitchen is equipped with a cooking range and convenient washer/dryer hookups. In the updated bathroom, crisp marble tile surrounds the full tub-and-shower enclosure. Outside, residents enjoy a green shared backyard setting with included lawn maintenance. Situated along the vibrant Admiral corridor near favorite local cafes, dining spots, and convenient cross-town thoroughfares.`
  },

  'PP-BAAEAEC2': { // 3326 E King St
    property_type: 'SINGLE_FAMILY',
    title: '2BR SINGLE FAMILY in Tulsa',
    appliances: ['Range/Oven'],
    amenities: ['Private Yard', 'Spacious Living Room', 'Natural Lighting', 'Pet Friendly'],
    flooring: 'Vinyl / Hardwood',
    parking: 'Driveway',
    garage_spaces: 0,
    description: `3326 E King St presents a comfortable two-bedroom residence featuring an efficient single-story layout with generous natural light throughout. The main living area connects smoothly to the kitchen, offering practical counter space and designated room for casual dining.

Two quiet bedrooms provide dedicated closet space and convenient access to the central full bathroom. Outside, the property includes a private lawn area ideal for pets and fresh-air recreation, complemented by off-street driveway parking. Centrally positioned in Tulsa with swift access to shopping, neighborhood parks, and major city connectors.`
  },

  'PP-0BF40067': { // 1302 S Birmingham Ave #2
    property_type: 'DUPLEX',
    title: '2BR TOWNHOMES in Tulsa',
    appliances: ['Refrigerator', 'Stove/Range', 'Dishwasher'],
    amenities: ['Granite Countertops', 'Stainless Steel Sink', 'Hard Flooring Throughout', 'Central Heat & Air', 'In-Unit Washer/Dryer Hookups', 'Off-Street Parking', 'Lawn Care Included'],
    flooring: 'Laminate / Hard Surface',
    parking: 'Off-Street Parking',
    garage_spaces: 0,
    description: `1302 S Birmingham Ave #2 is a thoughtfully updated lower-level duplex residence situated in Tulsa's sought-after Renaissance neighborhood. The interior features durable hard-surface flooring throughout with zero carpet, accented by central heating and air conditioning for year-round climate control.

The contemporary kitchen showcases solid granite countertops, a stainless steel under-mount sink, and quality appliances including a refrigerator, stove, and dishwasher. Dedicated in-unit washer and dryer connections add everyday ease. Includes designated off-street parking and community lawn maintenance, located blocks from historic Route 66, the University of Tulsa campus, and midtown conveniences.`
  },

  'PP-4E761A7B': { // 4214 S 24th West Tulsa Ave
    property_type: 'SINGLE_FAMILY',
    title: '2BR SINGLE FAMILY in Tulsa',
    appliances: ['Range/Oven'],
    amenities: ['Spacious Living Area', 'Private Yard', 'Natural Sunlight', 'Easy Highway Access'],
    flooring: 'Hard Surface / Vinyl',
    parking: 'Driveway',
    garage_spaces: 0,
    description: `4214 S 24th West Tulsa Ave provides a functional, easy-living two-bedroom single-family layout situated on a quiet southwest Tulsa street. The airy main living room is illuminated by wide exterior windows, creating a welcoming gathering area that opens cleanly into the kitchen and dining space.

Both bedrooms are well-proportioned with private closet storage, situated adjacent to a full central bathroom. An expansive surrounding yard offers versatile outdoor space for relaxation or pets. Conveniently located with rapid connections to I-44, downtown Tulsa, and neighborhood shopping plazas.`
  },

  'PP-CEEF5212': { // 1129 S 124th East Ave
    property_type: 'DUPLEX',
    title: '2BR SINGLE FAMILY in Tulsa',
    appliances: ['Refrigerator', 'Stove/Range'],
    amenities: ['Attached 1-Car Garage', 'Covered Front Porch', 'Covered Back Patio', 'Updated Kitchen Pantry', 'Modern Bath Flooring', 'Tub/Shower Combo', 'Washer & Dryer Hookups'],
    flooring: 'Vinyl Plank, Tile',
    parking: 'Attached Garage',
    garage_spaces: 1,
    description: `1129 S 124th East Ave is a move-in ready two-bedroom duplex home featuring an attached one-car garage and versatile outdoor living areas. The updated kitchen provides abundant cabinetry, a dedicated pantry closet for extra pantry storage, and included refrigerator and cooking range.

The renovated full bathroom offers contemporary flooring and an integrated tub-shower combination. A dedicated laundry nook includes washer and dryer hookups. Outdoors, unwind on either the covered front porch or the secluded covered back patio. Situated within convenient walking distance of East Central High School, regional parks, and essential east Tulsa retail corridors.`
  },

  'PP-AA2F486C': { // 5518 E 2nd St
    property_type: 'SINGLE_FAMILY',
    title: '2BR SINGLE FAMILY in Tulsa',
    appliances: ['Refrigerator', 'Range/Oven', 'Microwave'],
    amenities: ['Luxury Vinyl Plank Flooring', 'Fresh Interior Paint', 'Shaker Kitchen Cabinets', 'Expansive Rear Deck', 'Large Yard', 'Open Concept Living', 'Near University of Tulsa'],
    flooring: 'Luxury Vinyl Plank (LVP)',
    parking: 'Driveway',
    garage_spaces: 0,
    description: `5518 E 2nd St is an extensively renovated rental residence situated moments from the University of Tulsa. The open-concept interior has been refreshed with brand new luxury vinyl plank flooring and clean neutral paint throughout. In the updated kitchen, crisp shaker cabinetry pairs with modern appliances and generous meal prep surfaces.

The home flows outward to an expansive rear sundeck overlooking an unusually large, peaceful backyard setting. Located in a prime collegiate corridor with rapid access to Route 66, major Tulsa freeways, and Kendall-Whittier cultural amenities.`
  },

  'PP-2FE65E5F': { // 1619 N Atlanta Ave
    property_type: 'SINGLE_FAMILY',
    title: '2BR SINGLE FAMILY in Tulsa',
    appliances: ['Refrigerator', 'Range/Oven'],
    amenities: ['Craftsman Architecture', 'Fenced Double Lot', 'Mature Pecan Trees', 'Refinished Hardwood Floors', 'Renovated Kitchen & Bath', 'Full Exterior-Access Basement', 'Storage Shed', 'New Front Porch'],
    flooring: 'Refinished Hardwood, Tile',
    parking: 'Driveway',
    garage_spaces: 0,
    description: `1619 N Atlanta Ave is a classic Craftsman single-family home that has undergone an extensive full-scale interior and exterior renovation, positioned proudly on an expansive, fully fenced double lot shaded by mature pecan trees. The interior showcases gleaming refinished hardwood floors, fresh paint, modern designer fixtures, and an inviting newly constructed front porch.

The completely updated kitchen and full bath feature crisp contemporary surfaces. Substantial additional storage is readily available between the outdoor rear shed and the sizable full basement, accessed via exterior grade stairs. A remarkable find delivering immense outdoor acreage and vintage character within minutes of downtown Tulsa.`
  },

  'PP-A89A001A': { // 608 E Zion St
    property_type: 'SINGLE_FAMILY',
    title: '2BR SINGLE FAMILY in Tulsa',
    appliances: ['Range/Oven'],
    amenities: ['Classic All-Brick Exterior', 'Spacious Yard for Gardening', 'Comfortable Single-Level Layout', 'Central Tulsa Location'],
    flooring: 'Hard Surface',
    parking: 'Driveway',
    garage_spaces: 0,
    description: `608 E Zion St is a charming, enduring all-brick single-family residence originally constructed in 1946. Providing a cozy and manageable single-story layout, the home features a comfortable living space with sunlit windows and a functional kitchen with essential cabinetry and cooking provisions.

The two bedrooms share a clean central full bathroom. The exterior offers a generously sized lawn ideal for gardening, weekend cookouts, and pet play. Nestled in north central Tulsa with convenient proximity to city parks, neighborhood schools, and quick downtown commuting arteries.`
  },

  'PP-30793F42': { // 5044 S 36th West Ave
    property_type: 'SINGLE_FAMILY',
    title: '2BR SINGLE FAMILY in Tulsa',
    appliances: ['Refrigerator', 'Range/Oven'],
    amenities: ['Bungalow Architecture', 'Spacious Living & Kitchen Area', 'Full Bath', 'Quick Highway Access', 'Utilities Included (Electric & Water)'],
    flooring: 'Hard Surface',
    parking: 'Off-Street Parking',
    garage_spaces: 0,
    description: `5044 S 36th West Ave is a tidy bungalow-style cottage delivering comfort, utility, and exceptional commuter convenience in southwest Tulsa. The home opens into a bright, open living room and adjacent kitchen area equipped with essential refrigeration and cooking appliances.

Two private bedrooms offer closet storage, supported by a full bathroom with vanity and tub-shower combination. Electric and water utility services are included with the residence. Positioned with rapid accessibility to I-44, the Arkansas River corridor, and neighboring shopping centers.`
  },

  'PP-C3A5F095': { // 402 S Phoenix Ave
    property_type: 'SINGLE_FAMILY',
    title: '2BR SINGLE FAMILY in Tulsa',
    appliances: ['New Refrigerator', 'New Dishwasher', 'Range/Oven'],
    amenities: ['Fresh Interior Paint', 'Laminate Flooring', 'Custom Shower & Floor Tile', 'New Windows & Blinds', 'In-Home Laundry Room', 'Large Rear Deck', 'Front Porch', '3-Car Off-Street Parking', 'Downtown Corridor'],
    flooring: 'Laminate, Tile',
    parking: '3-Car Off-Street Parking',
    garage_spaces: 0,
    description: `402 S Phoenix Ave is a freshly updated and meticulously maintained home located within immediate reach of Tulsa's vibrant downtown district. The interior highlights fresh neutral paint, durable wood-look laminate flooring, modern energy-efficient windows with new blinds, and a dedicated laundry room with washer and dryer hookups.

The spacious kitchen includes a brand new refrigerator and dishwasher, alongside an updated full bathroom with custom tile work on both the floor and shower surround. Outside living features an inviting front porch and a large private rear deck overlooking the yard, plus off-street parking accommodating up to three vehicles.`
  },

  'PP-1A96A690': { // 319 S 48th Ave W
    property_type: 'SINGLE_FAMILY',
    title: '2BR SINGLE FAMILY in Tulsa',
    appliances: ['4-Burner Gas Range', 'Dishwasher'],
    amenities: ['Hardwood Flooring', 'Spacious Great Room', 'Covered Back Patio', 'Covered Front Porch', 'Fenced-In Yard', 'Attached 1-Car Garage', 'Quiet Neighborhood'],
    flooring: 'Hardwood, Tile',
    parking: '1-Car Garage',
    garage_spaces: 1,
    description: `319 S 48th Ave W is an appealing two-bedroom home in west Tulsa offering classic hardwood flooring and a fluid indoor-outdoor layout. The spacious great room flows seamlessly into the kitchen, equipped with a 4-burner gas range, built-in dishwasher, and ample counter space.

Glass patio doors lead to a large covered rear patio that overlooks a generous, fully fenced backyard—ideal for outdoor dining, entertaining, and pet companionship. An attached one-car garage supplies secure sheltered parking and workshop or storage space. Conveniently located near local schools, neighborhood parks, and expressway access.`
  },

  'PP-0E0D1632': { // 10814 E 15th Pl
    property_type: 'TOWNHOUSE',
    title: '2BR TOWNHOMES in Tulsa',
    appliances: ['Range/Oven', 'Refrigerator'],
    amenities: ['Recent Interior Updates', 'Washer & Dryer Hookups', 'Two-Story Living', 'Dedicated Parking', 'Close to Major Freeways'],
    flooring: 'Vinyl Plank / Carpet',
    parking: 'Dedicated Off-Street Parking',
    garage_spaces: 0,
    description: `10814 E 15th Pl is a recently updated two-bedroom townhome offering clean, low-maintenance living in east Tulsa. The practical layout features a comfortable living area, a bright kitchen with designated dining space, and dedicated in-unit washer and dryer hookups.

Upstairs, two well-lit bedrooms provide privacy and generous closet storage adjacent to the central full bathroom. Positioned moments from Highway 169, I-44, and local public transit lines, residents benefit from effortless commutes across the metropolitan area.`
  },
};

async function main() {
  console.log('===============================================================');
  console.log('Choice Properties — Master Zillow Tulsa Pipeline Enrich & Publish');
  console.log('===============================================================\n');

  // Fetch all 13 pipeline properties
  const res = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?source=eq.zillow&select=*&order=scraped_at.asc`, {
    headers: { ...HEADERS, 'Accept-Profile': 'pipeline' }
  });
  const pipelineProps = await res.json();
  console.log(`Found ${pipelineProps.length} pipeline properties to process.\n`);

  const publishedResults = [];
  const skippedResults = [];

  for (const p of pipelineProps) {
    console.log(`---------------------------------------------------------------`);
    console.log(`Processing ${p.id} (${p.address}, ${p.city}, ${p.state} ${p.zip})...`);

    const enrichment = PROPERTY_ENRICHMENTS[p.id];
    if (!enrichment) {
      console.warn(`[warning] No custom enrichment configuration found for ${p.id}, skipping.`);
      skippedResults.push({ id: p.id, address: p.address, reason: 'Missing enrichment config' });
      continue;
    }

    // Parse photos
    const rawPhotos = p.original_image_urls ? (typeof p.original_image_urls === 'string' ? JSON.parse(p.original_image_urls) : p.original_image_urls) : [];
    console.log(`[photos] Raw photo count: ${rawPhotos.length}`);
    if (rawPhotos.length < 6) {
      console.error(`[error] Property has less than 6 photos (${rawPhotos.length}). Rejecting publication per Rule 4/13/15.`);
      skippedResults.push({ id: p.id, address: p.address, reason: `Insufficient photos (${rawPhotos.length} < 6)` });
      continue;
    }

    // Retain exact price (User requested: "dont adjust the prices")
    const rent = Math.round(Number(p.monthly_rent));
    const securityDeposit = rent; // 1x monthly rent in DB
    const beds = Number(p.bedrooms);
    const baths = Number(p.bathrooms); // Decimal precision
    const halfBaths = p.half_bathrooms != null ? Number(p.half_bathrooms) : 0;
    const sqft = p.square_footage ? Number(p.square_footage) : null;
    const propType = enrichment.property_type;
    const verbatimTitle = p.title || `${beds}BR ${propType.replace('_', ' ')} in ${p.city}`;

    // Clean description audit
    const enrichedDesc = enrichment.description.trim();
    if (/security\s*deposit|deposit/i.test(enrichedDesc)) {
      throw new Error(`Security deposit text found in description for ${p.id}!`);
    }
    if (/lease\s*term|minimum\s*lease|\d+\s*months?\s*lease/i.test(enrichedDesc)) {
      throw new Error(`Lease term text found in description for ${p.id}!`);
    }
    if (/smoking/i.test(enrichedDesc)) {
      throw new Error(`Smoking text found in description for ${p.id}!`);
    }

    // Check for existing property
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?address=ilike.*${encodeURIComponent(p.address.trim())}*&select=id`, {
      headers: HEADERS
    });
    const existingMatches = await checkRes.json();
    let choicePropertyId = null;

    const propPayload = {
      title: verbatimTitle,
      description: enrichedDesc,
      address: p.address.trim(),
      city: p.city.trim(),
      state: p.state.trim(),
      zip: p.zip.trim(),
      property_type: propType,
      bedrooms: beds,
      bathrooms: baths,
      half_bathrooms: halfBaths,
      total_bathrooms: baths,
      square_footage: sqft,
      monthly_rent: rent,
      security_deposit: securityDeposit,
      application_fee: 50,
      pets_allowed: true,
      smoking_allowed: false,
      lease_terms: null,
      minimum_lease_months: null,
      status: 'active',
      listed_at: '2026-09-27',
      garage_spaces: enrichment.garage_spaces ?? p.garage_spaces ?? 0,
      parking: enrichment.parking || 'Off-Street Parking',
      amenities: enrichment.amenities || [],
      appliances: enrichment.appliances || [],
      flooring: Array.isArray(enrichment.flooring) ? enrichment.flooring : (enrichment.flooring ? enrichment.flooring.split(",").map(s => s.trim()) : ["Hardwood"]), 
      views_count: 0,
      saves_count: 0,
      applications_count: 0,
      updated_at: new Date().toISOString()
    };

    if (existingMatches && existingMatches.length > 0) {
      choicePropertyId = existingMatches[0].id;
      console.log(`[db] Updating existing property ${choicePropertyId} at ${p.address}...`);
      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${choicePropertyId}`, {
        method: 'PATCH',
        headers: HEADERS,
        body: JSON.stringify(propPayload)
      });
      if (!updateRes.ok) {
        throw new Error(`Failed to update property: ${await updateRes.text()}`);
      }
      console.log(`[db] Successfully updated property ${choicePropertyId}`);
    } else {
      choicePropertyId = crypto.randomUUID();
      propPayload.id = choicePropertyId;
      propPayload.created_at = new Date().toISOString();
      console.log(`[db] Inserting new property ${choicePropertyId} at ${p.address}...`);
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/properties`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(propPayload)
      });
      if (!insertRes.ok) {
        throw new Error(`Failed to insert property: ${await insertRes.text()}`);
      }
      console.log(`[db] Successfully inserted new property ${choicePropertyId}`);
    }

    // Sync photos
    console.log(`[photos] Syncing ${rawPhotos.length} photos for ${choicePropertyId}...`);
    // Delete existing photos for this property
    await fetch(`${SUPABASE_URL}/rest/v1/property_photos?property_id=eq.${choicePropertyId}`, {
      method: 'DELETE',
      headers: HEADERS
    });

    const photoInserts = rawPhotos.map((url, idx) => ({
      property_id: choicePropertyId,
      url: url,
      display_order: idx + 1,
      is_hero: idx === 0,
      created_at: new Date().toISOString()
    }));

    const photoRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(photoInserts)
    });
    if (!photoRes.ok) {
      throw new Error(`Failed to insert photos: ${await photoRes.text()}`);
    }
    console.log(`[photos] Successfully synced ${photoInserts.length} photos`);

    // Update pipeline record
    console.log(`[pipeline] Updating pipeline record ${p.id}...`);
    const pipeUpdateRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${encodeURIComponent(p.id)}`, {
      method: 'PATCH',
      headers: { ...HEADERS, 'Content-Profile': 'pipeline' },
      body: JSON.stringify({
        status: 'published',
        choice_property_id: choicePropertyId,
        property_type: propType,
        monthly_rent: rent,
        security_deposit: securityDeposit,
        application_fee: 50,
        pets_allowed: true,
        smoking_allowed: false,
        lease_terms: null,
        minimum_lease_months: null,
        description: enrichedDesc,
        original_description: p.original_description,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    });
    if (!pipeUpdateRes.ok) {
      console.warn(`[pipeline warning] Failed to update pipeline record: ${await pipeUpdateRes.text()}`);
    } else {
      console.log(`[pipeline] Successfully marked ${p.id} as published`);
    }

    publishedResults.push({
      n: publishedResults.length + 1,
      address: p.address.trim(),
      city: p.city.trim(),
      state: p.state.trim(),
      zip: p.zip.trim(),
      rent: rent,
      beds: beds,
      baths: baths,
      id: choicePropertyId
    });
  }

  console.log('\n===============================================================');
  console.log('TULSA ZILLOW BATCH PUBLISH COMPLETE');
  console.log('===============================================================\n');

  publishedResults.forEach(r => {
    console.log(`${r.n}. ${r.address}, ${r.city}, ${r.state} ${r.zip} ($${r.rent.toLocaleString()}/mo | ${r.beds} Bed / ${r.baths} Bath) — https://choice-properties-site.pages.dev/property.html?id=${r.id}`);
  });

  return { published: publishedResults, skipped: skippedResults };
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
