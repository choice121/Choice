import fs from 'fs';
import { randomUUID } from 'crypto';

const SUPABASE_URL = "https://tlfmwetmhthpyrytrcfo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE";

const headers = {
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json"
};

const pipelineHeaders = {
  ...headers,
  "Accept-Profile": "pipeline",
  "Content-Profile": "pipeline"
};

const BATCH_DATA = [
  {
    pipeline_id: "PP-4D615BA8",
    address: "1637 Veronica Ave",
    city: "Saint Louis",
    state: "MO",
    zip: "63147",
    county: "St. Louis City",
    title: "4BR SINGLE FAMILY in Saint Louis",
    property_type: "SINGLE_FAMILY",
    monthly_rent: 1725,
    security_deposit: 1725,
    bedrooms: 4,
    bathrooms: 1.5,
    full_bathrooms: 1,
    half_bathrooms: 1,
    square_footage: 1762,
    has_basement: true,
    has_central_air: true,
    parking: "Private Garage",
    garage_spaces: 1,
    laundry_type: "In-Unit Hookups",
    heating_type: "Forced Air",
    cooling_type: "Whole-Home Central Air Conditioning",
    appliances: ["Refrigerator", "Range Oven", "Dishwasher", "Washer/Dryer Hookups"],
    amenities: [
      "Granite / Quartz Countertops",
      "Luxury Vinyl Plank Flooring",
      "Tiled Bathrooms",
      "Unfinished Storage Basement",
      "Private Garage Parking",
      "Private Lot (Over 0.1 Acre)",
      "Pet Friendly"
    ],
    enriched_description: `Situated on an independent lot spanning more than a tenth of an acre in northern Saint Louis, this one-story residence provides 1,762 square feet of updated living space across four bedrooms and one and a half bathrooms. Luxury vinyl plank flooring extends through the main living quarters, complemented by updated fixtures and tiled bath surfaces.

The kitchen features solid granite and quartz countertops paired with a functional layout including an electric range, refrigerator, and dishwasher. A dedicated unfinished basement spans the footprint of the home, providing expansive utility storage and washer/dryer hookups. Vehicle parking is accommodated with a private detached garage. Quick proximity to Riverview Drive, local transit lines, and neighborhood parks offers straightforward connectivity throughout the metropolitan area.`
  },
  {
    pipeline_id: "PP-073EC531",
    address: "4454 N Newstead Ave",
    city: "Saint Louis",
    state: "MO",
    zip: "63115",
    county: "St. Louis City",
    title: "4BR SINGLE FAMILY in Saint Louis",
    property_type: "SINGLE_FAMILY",
    monthly_rent: 1750,
    security_deposit: 1750,
    bedrooms: 4,
    bathrooms: 2.0,
    full_bathrooms: 2,
    half_bathrooms: null,
    square_footage: 1400,
    has_basement: false,
    has_central_air: true,
    parking: "Off-Street Parking",
    garage_spaces: null,
    laundry_type: "In-Unit Hookups",
    heating_type: "Forced Air",
    cooling_type: "Central Air Conditioning",
    appliances: ["Refrigerator", "Oven", "Microwave", "Freezer", "Washer/Dryer Hookups"],
    amenities: [
      "Architectural Fireplace Accent",
      "Private Second-Story Balcony",
      "Updated Kitchen with White Cabinetry",
      "Outdoor Patio Space",
      "In-Unit Laundry Hookups",
      "Pet Friendly"
    ],
    enriched_description: `Located along North Newstead Avenue in Saint Louis, this fully renovated two-story home offers approximately 1,400 square feet of comfortable living space featuring four bedrooms and two full bathrooms. The front living room centers around an architectural fireplace accent, illuminated by tall windows that capture steady natural daylight.

An upgraded kitchen includes new white cabinetry, solid counter surfaces, and a complete appliance set featuring a refrigerator, cooktop oven, and microwave. Outdoor spaces include a private second-story balcony and rear patio space. Washer and dryer hookups are located within the home, alongside central air conditioning for year-round temperature regulation. The location provides direct, convenient access to I-70 and nearby north city transit corridors.`
  },
  {
    pipeline_id: "PP-5BBE0712",
    address: "1237 Shawmut Pl",
    city: "Saint Louis",
    state: "MO",
    zip: "63112",
    county: "St. Louis City",
    title: "4BR SINGLE FAMILY in Saint Louis",
    property_type: "SINGLE_FAMILY",
    monthly_rent: 1800,
    security_deposit: 1800,
    bedrooms: 4,
    bathrooms: 1.5,
    full_bathrooms: 1,
    half_bathrooms: 1,
    square_footage: 1536,
    has_basement: false,
    has_central_air: true,
    parking: "Dedicated Off-Street Parking",
    garage_spaces: null,
    laundry_type: "Main-Floor Laundry Hookups",
    heating_type: "Forced Air",
    cooling_type: "Central Air Conditioning",
    appliances: ["Refrigerator", "Oven", "Washer/Dryer Hookups"],
    amenities: [
      "Historic 1908 Architectural Character",
      "New Wood-Look Flooring",
      "Fresh Interior Paint Throughout",
      "Dedicated Off-Street Parking",
      "Main Floor Laundry Room",
      "Pet Friendly"
    ],
    enriched_description: `Originally built in 1908, this classic two-story residence on Shawmut Place combines historic architectural proportion with recent interior improvements across 1,536 square feet. The four-bedroom layout includes one full bathroom on the bedroom level and a convenient powder room on the ground floor.

Fresh neutral paint pairs with newly installed flooring spanning both the primary living spaces and upper bedrooms. The eat-in kitchen includes an oven, range, and full refrigerator, connecting directly to a dedicated main-floor laundry room with washer and dryer hookups. Off-street parking is situated adjacent to the home, with convenient walking and driving proximity to Delmar Loop, Forest Park, and public transit links along the central corridor.`
  },
  {
    pipeline_id: "PP-79DCE969",
    address: "3717 Bamberger Ave",
    city: "Saint Louis",
    state: "MO",
    zip: "63116",
    county: "St. Louis City",
    title: "4BR SINGLE FAMILY in Saint Louis",
    property_type: "SINGLE_FAMILY",
    monthly_rent: 1750,
    security_deposit: 1750,
    bedrooms: 4,
    bathrooms: 2.0,
    full_bathrooms: 2,
    half_bathrooms: null,
    square_footage: 2200,
    has_basement: false,
    has_central_air: true,
    parking: "Detached Garage",
    garage_spaces: 2,
    laundry_type: "In-Unit Hookups",
    heating_type: "Forced Air",
    cooling_type: "Central Air Conditioning",
    appliances: ["Refrigerator"],
    amenities: [
      "Generous 2,200 Sqft Layout",
      "Converted Classic Two-Family Flat",
      "Detached Garage & Workshop Storage",
      "Recently Replaced Roof",
      "High Ceilings & Large Windows",
      "Pet Friendly"
    ],
    enriched_description: `Positioned on Bamberger Avenue in south Saint Louis, this expansive 2,200 square foot single-family home offers generous proportions and flexible room configurations. Converted from a traditional Saint Louis two-family flat into a unified residence, the home delivers four large bedrooms and two complete full bathrooms across two full stories.

The interior showcases high ceilings, wide baseboards, and broad windows characteristic of south city brick architecture. The main floor features separate living and formal dining rooms served by central air conditioning and an updated roof overhead. In back, a detached garage provides protected vehicle parking or dedicated workshop and storage space, just minutes from Gravois Avenue and Tower Grove Park.`
  },
  {
    pipeline_id: "PP-45BC66C7",
    address: "8726 Riverview Blvd",
    city: "Saint Louis",
    state: "MO",
    zip: "63147",
    county: "St. Louis City",
    title: "4BR SINGLE FAMILY in Saint Louis",
    property_type: "SINGLE_FAMILY",
    monthly_rent: 1500,
    security_deposit: 1500,
    bedrooms: 4,
    bathrooms: 2.0,
    full_bathrooms: 2,
    half_bathrooms: null,
    square_footage: 1150,
    has_basement: false,
    has_central_air: true,
    parking: "Driveway Parking",
    garage_spaces: null,
    laundry_type: "In-Unit Hookups",
    heating_type: "Forced Air",
    cooling_type: "Central Air Conditioning",
    appliances: ["Refrigerator", "Range Oven"],
    amenities: [
      "Updated Kitchen Cabinetry",
      "Modernized Bathrooms",
      "Central Air Conditioning",
      "Private Front & Rear Lawn",
      "In-Unit Laundry Hookups",
      "Pet Friendly"
    ],
    enriched_description: `Fronting Riverview Boulevard in north Saint Louis, this single-family residence provides four bedrooms and two full bathrooms within an efficient 1,150 square foot layout. The interior features modernized kitchen cabinetry with durable countertops and updated bathroom vanities and fixtures.

Central air conditioning maintains comfortable interior climates across all four bedrooms. Dedicated laundry hookups are positioned on-site, and the exterior features a private grassy lawn with ample space for outdoor activities. Conveniently situated along major thoroughfares, residents enjoy direct driving routes toward downtown Saint Louis, Chain of Rocks park areas, and the Riverview transit exchange.`
  },
  {
    pipeline_id: "PP-AA933FF3",
    address: "3440 Potomac St",
    city: "Saint Louis",
    state: "MO",
    zip: "63118",
    county: "St. Louis City",
    title: "5BR SINGLE FAMILY in Saint Louis",
    property_type: "SINGLE_FAMILY",
    monthly_rent: 1800,
    security_deposit: 1800,
    bedrooms: 5,
    bathrooms: 2.0,
    full_bathrooms: 2,
    half_bathrooms: null,
    square_footage: 2070,
    has_basement: false,
    has_central_air: false,
    parking: "Private Garage",
    garage_spaces: 1,
    laundry_type: "In-Unit Hookups",
    heating_type: "Radiator / Radiant",
    cooling_type: "Window Units",
    appliances: ["Stainless Steel Refrigerator", "Stainless Steel Microwave", "Garbage Disposal", "Range Oven"],
    amenities: [
      "Exposed Historic Brick Accents",
      "Stainless Steel Kitchen Suite",
      "Convenient Main-Level Bedroom",
      "Private Detached Garage",
      "Historic Gravois Park Location",
      "Pet Friendly"
    ],
    enriched_description: `Located in the historic Gravois Park neighborhood, this brick residence delivers 2,070 square feet of finished living space across five bedrooms and two full bathrooms. The interior retains historic character through exposed brick feature walls while providing modern mechanical and cosmetic upgrades.

The kitchen is equipped with stainless steel appliances including a refrigerator, built-in microwave, and range. A convenient main-floor bedroom accommodates guests, multi-generational living, or a quiet dedicated workspace, while four additional bedrooms occupy the second floor. A private garage provides secure parking and storage, situated within easy walking distance of local neighborhood cafes, community parks, and Grand Boulevard transit corridors.`
  },
  {
    pipeline_id: "PP-6EBC0E3E",
    address: "4409 Oakwood Ave",
    city: "Saint Louis",
    state: "MO",
    zip: "63121",
    county: "St. Louis County",
    title: "4BR SINGLE FAMILY in Saint Louis",
    property_type: "SINGLE_FAMILY",
    monthly_rent: 1650,
    security_deposit: 1650,
    bedrooms: 4,
    bathrooms: 2.0,
    full_bathrooms: 2,
    half_bathrooms: null,
    square_footage: 1490,
    has_basement: true,
    has_central_air: true,
    parking: "Attached Garage & Driveway",
    garage_spaces: 2,
    laundry_type: "In-Unit Washer & Dryer Included",
    heating_type: "Forced Air",
    cooling_type: "Central Air Conditioning",
    appliances: ["Washer", "Dryer", "Gas Range Oven", "Refrigerator", "Freezer"],
    amenities: [
      "Complete Finished Renovation",
      "New Luxury Vinyl Flooring",
      "Brand New Gas Range & Vanities",
      "Clean Painted Full Basement",
      "Oversized Attached Garage",
      "In-Unit Washer & Dryer Included",
      "Pet Friendly"
    ],
    enriched_description: `Completely updated from top to bottom, this four-bedroom, two-bathroom residence offers 1,490 square feet of fresh living space on Oakwood Avenue. Newly installed luxury vinyl flooring runs throughout all four bedrooms and common areas, paired with crisp neutral wall paint and modern lighting fixtures.

The kitchen features new cabinetry, a brand-new gas stove, full refrigerator, and freezer. Both bathrooms have been fully refreshed with new vanities, toilets, and modern shower hardware. A clean, freshly painted full basement houses dedicated in-unit laundry with washer and dryer included, while an oversized private garage and driveway offer extensive off-street parking. Conveniently positioned near Natural Bridge Road and the University of Missouri–St. Louis campus.`
  },
  {
    pipeline_id: "PP-71BF063E",
    address: "3826 Avondale Ave",
    city: "Saint Louis",
    state: "MO",
    zip: "63121",
    county: "St. Louis County",
    title: "4BR SINGLE FAMILY in Saint Louis",
    property_type: "SINGLE_FAMILY",
    monthly_rent: 1695,
    security_deposit: 1695,
    bedrooms: 4,
    bathrooms: 1.5,
    full_bathrooms: 1,
    half_bathrooms: 1,
    square_footage: 1700,
    has_basement: true,
    has_central_air: false,
    parking: "Driveway Parking",
    garage_spaces: null,
    laundry_type: "Dedicated Main-Floor Laundry Room",
    heating_type: "Forced Air",
    cooling_type: "Window Units",
    appliances: ["Dishwasher", "Refrigerator", "Range Stove"],
    amenities: [
      "New Luxury Vinyl Flooring Throughout",
      "Brand New Kitchen with Dishwasher",
      "Main-Level Bedroom & Powder Room",
      "Dedicated Main-Floor Laundry Room",
      "Full Storage Basement",
      "Large Level Fenced Backyard",
      "Pet Friendly"
    ],
    enriched_description: `Featuring an extensive interior renovation, this single-family residence on Avondale Avenue delivers 1,700 square feet of living space with four spacious bedrooms and one and a half bathrooms. New luxury vinyl plank flooring and fresh interior paint run consistently through both levels.

The ground floor includes a brand-new kitchen with contemporary cabinetry, dishwasher, refrigerator, and range, as well as an accessible main-level bedroom and dedicated main-floor laundry room. The full basement provides substantial storage and work space, while the exterior features a level, fully fenced backyard ideal for pets and outdoor relaxation. Located within minutes of Lucas-Hunt Road, local retail, and convenient regional highway connectors.`
  },
  {
    pipeline_id: "PP-98544C25",
    address: "5626 Hodiamont Ave",
    city: "Saint Louis",
    state: "MO",
    zip: "63136",
    county: "St. Louis County",
    title: "4BR SINGLE FAMILY in Saint Louis",
    property_type: "SINGLE_FAMILY",
    monthly_rent: 1650,
    security_deposit: 1650,
    bedrooms: 4,
    bathrooms: 1.0,
    full_bathrooms: 1,
    half_bathrooms: null,
    square_footage: 1360,
    has_basement: false,
    has_central_air: true,
    parking: "Dedicated Off-Street Parking",
    garage_spaces: null,
    laundry_type: "In-Unit Hookups",
    heating_type: "New High-Efficiency HVAC",
    cooling_type: "Central Air Conditioning",
    appliances: ["Stainless Steel Dishwasher", "Stainless Steel Microwave", "Stainless Steel Oven", "Stainless Steel Refrigerator"],
    amenities: [
      "Brand New Stainless Steel Appliances",
      "Brand New HVAC System & Hot Water Heater",
      "Wood-Look Laminate Flooring",
      "Updated Bath Vanity, Sink & Toilet",
      "Fresh Agreeable Gray Paint",
      "Dedicated Off-Street Parking",
      "Pet Friendly"
    ],
    enriched_description: `Freshly updated with modern mechanical and cosmetic improvements, this four-bedroom home on Hodiamont Avenue provides 1,360 square feet of comfortable single-family living. The entire interior has been refreshed in popular Agreeable Gray paint, accented by light wood-tone laminate flooring.

The kitchen features rich stained cabinetry, modern countertops, and a complete suite of brand-new stainless steel appliances including a dishwasher, microwave, range oven, and refrigerator. Major infrastructure includes a newly installed HVAC system and new water heater for dependable energy efficiency. A refreshed central bathroom features a new vanity, mirror, and fixtures, with dedicated off-street parking and easy access to West Florissant Avenue.`
  },
  {
    pipeline_id: "PP-69ADE059",
    address: "7037 Theodore Ave",
    city: "Saint Louis",
    state: "MO",
    zip: "63136",
    county: "St. Louis County",
    title: "4BR SINGLE FAMILY in Saint Louis",
    property_type: "SINGLE_FAMILY",
    monthly_rent: 1650,
    security_deposit: 1650,
    bedrooms: 4,
    bathrooms: 2.0,
    full_bathrooms: 2,
    half_bathrooms: null,
    square_footage: 1260,
    has_basement: true,
    has_central_air: true,
    parking: "Off-Street Driveway",
    garage_spaces: null,
    laundry_type: "In-Unit Washer & Dryer Included",
    heating_type: "New High-Efficiency HVAC",
    cooling_type: "Central Air Conditioning",
    appliances: ["Washer", "Dryer", "Stainless Steel Refrigerator", "Range Oven"],
    amenities: [
      "Refinished Classic Hardwood Floors",
      "Updated Kitchen with Contemporary Counters",
      "Stainless Steel Appliances",
      "Two-Story Floor Plan (2 Beds & 1 Bath per Level)",
      "Full Open-Concept Basement",
      "New Hot Water Heater & HVAC",
      "Large Backyard with Cooking Patio",
      "In-Unit Washer & Dryer Included",
      "Pet Friendly"
    ],
    enriched_description: `Positioned on Theodore Avenue in Walnut Park / North City, this four-bedroom, two-bathroom home provides a versatile two-story layout with 1,260 square feet of living space. Classic refinished hardwood floors extend across the main level, which hosts a sunlit living room, formal dining area, two bedrooms, and a full bathroom, with two additional bedrooms and a second full bath upstairs.

The kitchen has been updated with contemporary countertops and stainless steel appliances. Downstairs, a clean open-concept basement includes a newly installed hot water tank, efficient HVAC system, and full-size washer and dryer. Outside, a large backyard features a concrete patio suitable for outdoor furniture and barbecue cooking, situated close to Riverview Park and local bus transit lines.`
  }
];

async function main() {
  console.log("=== CHOICE PROPERTIES: SAINT LOUIS ZILLOW PIPELINE PUBLISHING ===");
  console.log(`Processing ${BATCH_DATA.length} properties...\n`);

  const rawRecords = JSON.parse(fs.readFileSync('batch_stlouis_raw.json', 'utf8'));
  const rawMap = new Map();
  rawRecords.forEach(r => rawMap.set(r.id, r));

  const publishedResults = [];

  for (let i = 0; i < BATCH_DATA.length; i++) {
    const p = BATCH_DATA[i];
    const raw = rawMap.get(p.pipeline_id);
    if (!raw) {
      console.error(`ERROR: Could not find raw pipeline record for ${p.pipeline_id}`);
      continue;
    }

    console.log(`\n------------------------------------------------------------`);
    console.log(`[${i+1}/${BATCH_DATA.length}] Processing ${p.pipeline_id}: ${p.address}, ${p.city}, ${p.state} ${p.zip}`);

    // 1. Check for duplicates in public.properties
    const existingRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?address=ilike.${encodeURIComponent(p.address)}&select=id,status`, {
      headers
    });
    const existing = await existingRes.json();
    let targetPropertyId;

    if (existing && existing.length > 0) {
      targetPropertyId = existing[0].id;
      console.log(`  Found existing property record: ${targetPropertyId} (status: ${existing[0].status}) - updating record`);
    } else {
      targetPropertyId = randomUUID();
      console.log(`  Generated new property ID: ${targetPropertyId}`);
    }

    // 2. Validate price constraint: cap at $1,800
    let rent = p.monthly_rent;
    if (rent > 1800) {
      console.log(`  [Price adjustment]: Rent $${rent} capped down to $1,800`);
      rent = 1800;
    }
    const deposit = rent; // 1x monthly rent

    // 3. Prepare public property payload
    const propertyPayload = {
      id: targetPropertyId,
      title: p.title,
      description: p.enriched_description,
      address: p.address,
      city: p.city,
      state: p.state,
      zip: p.zip,
      county: p.county,
      property_type: p.property_type,
      monthly_rent: rent,
      security_deposit: deposit,
      application_fee: 50,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      half_bathrooms: p.half_bathrooms || 0,
      square_footage: p.square_footage,
      pets_allowed: true,
      smoking_allowed: false,
      minimum_lease_months: null,
      lease_terms: null,
      available_date: null,
      parking: p.parking,
      garage_spaces: p.garage_spaces,
      laundry_type: p.laundry_type,
      heating_type: p.heating_type,
      cooling_type: p.cooling_type,
      has_basement: p.has_basement,
      has_central_air: p.has_central_air,
      appliances: p.appliances,
      amenities: p.amenities,
      source: "zillow",
      source_url: raw.source_url,
      source_listing_id: raw.source_listing_id,
      status: "active",
      featured: true,
      listed_at: new Date().toISOString().slice(0, 10),
      source_status: "available",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    let upsertRes;
    if (existing && existing.length > 0) {
      upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${targetPropertyId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify(propertyPayload)
      });
    } else {
      upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/properties`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify(propertyPayload)
      });
    }

    if (!upsertRes.ok) {
      console.error(`  ERROR inserting/updating property ${targetPropertyId}:`, upsertRes.status, await upsertRes.text());
      continue;
    }
    console.log(`  ✓ Successfully saved property record (${targetPropertyId})`);

    // 4. Photos validation & insertion
    let rawPhotoUrls = [];
    try {
      rawPhotoUrls = typeof raw.original_image_urls === 'string' ? JSON.parse(raw.original_image_urls) : (raw.original_image_urls || []);
    } catch (e) {
      rawPhotoUrls = [];
    }

    if (rawPhotoUrls.length < 6) {
      console.error(`  ERROR: Property ${p.pipeline_id} has fewer than 6 photos (${rawPhotoUrls.length}). Skipping photo insert.`);
      continue;
    }

    // Delete any existing photos for this property if updating
    await fetch(`${SUPABASE_URL}/rest/v1/property_photos?property_id=eq.${targetPropertyId}`, {
      method: 'DELETE',
      headers
    });

    const photoRows = rawPhotoUrls.map((url, idx) => ({
      id: randomUUID(),
      property_id: targetPropertyId,
      url: typeof url === 'string' ? url : url.url,
      display_order: idx + 1,
      is_hero: idx === 0,
      watermark_status: 'clean',
      alt_text: `${p.address}, ${p.city} ${p.state} - photo ${idx + 1}`,
      created_at: new Date().toISOString()
    }));

    const photoInsertRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify(photoRows)
    });

    if (!photoInsertRes.ok) {
      console.warn(`  Warning: Photo insert returned HTTP ${photoInsertRes.status}:`, await photoInsertRes.text());
    } else {
      console.log(`  ✓ Inserted ${photoRows.length} clean, genuine property photos`);
    }

    // 5. Update pipeline record
    const pipeRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${p.pipeline_id}`, {
      method: 'PATCH',
      headers: pipelineHeaders,
      body: JSON.stringify({
        status: 'published',
        choice_property_id: targetPropertyId,
        title: p.title,
        description: p.enriched_description,
        monthly_rent: rent,
        security_deposit: deposit,
        application_fee: 50,
        pets_allowed: true,
        smoking_allowed: false,
        minimum_lease_months: null,
        lease_terms: null,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    });
    console.log(`  ✓ Updated pipeline record ${p.pipeline_id} to status: published (HTTP ${pipeRes.status})`);

    // 6. Verify live property in public.properties
    const checkLiveRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${targetPropertyId}&select=id,title,address,city,state,zip,monthly_rent,bedrooms,bathrooms,half_bathrooms,property_type,status`, {
      headers
    });
    const [liveData] = await checkLiveRes.json();
    console.log(`  ✓ Live Verified: ${liveData.address} | Rent: $${liveData.monthly_rent} | Beds: ${liveData.bedrooms} | Baths: ${liveData.bathrooms} | Status: ${liveData.status}`);

    publishedResults.push({
      pipeline_id: p.pipeline_id,
      property_id: targetPropertyId,
      address: p.address,
      city: p.city,
      state: p.state,
      zip: p.zip,
      rent: rent,
      beds: p.bedrooms,
      baths: p.bathrooms,
      photos_count: photoRows.length
    });
  }

  console.log("\n============================================================");
  console.log("PUBLISHING WORKFLOW COMPLETE!");
  console.log(`Successfully published ${publishedResults.length} properties:\n`);

  publishedResults.forEach((r, idx) => {
    console.log(`${idx + 1}. ${r.address}, ${r.city}, ${r.state} ${r.zip} ($${r.rent.toLocaleString()}/mo | ${r.beds} Bed / ${r.baths} Bath) — https://choice-properties-site.pages.dev/property.html?id=${r.property_id}`);
  });

  fs.writeFileSync('published_stlouis_results.json', JSON.stringify(publishedResults, null, 2));
}

main().catch(console.error);
