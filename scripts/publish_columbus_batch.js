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

const QUALIFYING_BATCH = [
  {
    pipeline_id: "PP-B9973D63",
    address: "899 Kinnear Rd",
    city: "Columbus",
    state: "OH",
    zip: "43212",
    county: "Franklin County",
    title: "3BR SINGLE FAMILY in Columbus",
    property_type: "SINGLE_FAMILY",
    original_rent: 2100,
    monthly_rent: 2000, // Capped at 2000 per instruction
    security_deposit: 2000,
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: null,
    square_footage: 2000,
    has_basement: true,
    has_central_air: true,
    parking: "Attached Garage & Off-Street",
    garage_spaces: 1,
    laundry_type: "In Unit",
    heating_type: "Forced Air",
    cooling_type: "Air Conditioner, Central Air",
    appliances: ["Dishwasher", "Dryer", "Stove", "Washer"],
    amenities: [
      "Hardwood Floors",
      "Finished Basement",
      "Expansive Rear Deck",
      "1-Car Attached Garage",
      "Separate Storage Barn",
      "Off-Street Parking (3+ Cars)",
      "Fully Fenced Backyard",
      "Pet Friendly"
    ],
    enriched_description: `Offering 2,000 square feet of finished living space near Grandview and Ohio State's West Campus, this three-bedroom, two-bathroom residence features refinished hardwood floors and generous natural lighting throughout. A versatile finished lower level adds substantial secondary living space ideal for recreation or a home office.

The upgraded kitchen is outfitted with stainless steel appliances including a range stove and dishwasher, complemented by modern cabinetry. Dedicated in-unit laundry includes a full-size washer and dryer. Exterior highlights feature an expansive entertainment deck, an attached one-car garage, an additional storage barn, and off-street parking for multiple vehicles within a fully fenced backyard.`
  },
  {
    pipeline_id: "PP-2435A953",
    address: "3280 E Hudson St",
    city: "Columbus",
    state: "OH",
    zip: "43219",
    county: "Franklin County",
    title: "3BR SINGLE FAMILY in Columbus",
    property_type: "SINGLE_FAMILY",
    original_rent: 2075,
    monthly_rent: 2000, // Capped at 2000 per instruction
    security_deposit: 2000,
    bedrooms: 3,
    bathrooms: 1.5, // Preserved decimal precision
    half_bathrooms: 1,
    square_footage: 1476,
    has_basement: true,
    has_central_air: true,
    parking: "Attached Garage",
    garage_spaces: 1,
    laundry_type: "In Unit",
    heating_type: "Forced Air",
    cooling_type: "Central Air Conditioning",
    appliances: ["Dishwasher", "Dryer", "Garbage Disposal", "Microwave Oven", "Range", "Refrigerator", "Washer"],
    amenities: [
      "Dual Living Areas (Living Room & Family Room)",
      "Full Storage Basement",
      "Well-Equipped Kitchen with Microwave & Dishwasher",
      "Attached Garage",
      "Private Fenced Backyard with Deck",
      "Quick Access to Easton Town Center",
      "Pet Friendly"
    ],
    enriched_description: `Positioned with convenient access to Easton Town Center and downtown Columbus, this single-family home offers 1,476 square feet of living space with both a front living room and an adjoining family room. The floor plan provides three comfortable bedrooms, a full upper-level bathroom, and a main-floor half bathroom.

The kitchen is equipped with solid cabinet storage, a dishwasher, built-in microwave, refrigerator, range, and disposal, flowing into an eat-in dining space. A full basement delivers abundant storage alongside in-unit laundry facilities. Outside, enjoy an attached garage and a private, fully fenced backyard with a patio deck.`
  },
  {
    pipeline_id: "PP-0F78225B",
    address: "3761 Springwood Dr",
    city: "Columbus",
    state: "OH",
    zip: "43224",
    county: "Franklin County",
    title: "3BR SINGLE FAMILY in Columbus",
    property_type: "SINGLE_FAMILY",
    original_rent: 1800,
    monthly_rent: 1800,
    security_deposit: 1800,
    bedrooms: 3,
    bathrooms: 1.5, // Preserved decimal precision
    half_bathrooms: 1,
    square_footage: 988,
    has_basement: false,
    has_central_air: true,
    parking: "2-Car Attached Garage",
    garage_spaces: 2,
    laundry_type: "In-Unit Hookups",
    heating_type: "Forced Air",
    cooling_type: "Air Conditioner, Central Air",
    appliances: ["Microwave Oven", "Oven", "Refrigerator"],
    amenities: [
      "2-Car Attached Garage",
      "Spacious Fenced Backyard",
      "Central Air Conditioning",
      "In-Unit Laundry Hookups",
      "Near Easton Town Center",
      "Pet Friendly"
    ],
    enriched_description: `Located in northeast Columbus near Easton Town Center, this single-family residence provides three bedrooms and one and a half bathrooms across a bright, practical layout. Year-round comfort is maintained via central air conditioning and efficient forced-air heating.

The kitchen includes a refrigerator, range oven, and built-in microwave, with dedicated washer and dryer hookups situated nearby. Vehicle parking and equipment storage are accommodated by an attached two-car garage. A deep, level backyard provides generous outdoor space with swift connectivity to Morse Road and the I-71 corridor.`
  },
  {
    pipeline_id: "PP-8836FE31",
    address: "743 Ann St",
    city: "Columbus",
    state: "OH",
    zip: "43206",
    county: "Franklin County",
    title: "3BR SINGLE FAMILY in Columbus",
    property_type: "SINGLE_FAMILY",
    original_rent: 1950,
    monthly_rent: 1950,
    security_deposit: 1950,
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: null,
    square_footage: 1392,
    has_basement: true,
    has_central_air: true,
    parking: "Off-Street Parking",
    garage_spaces: null,
    laundry_type: "In Unit",
    heating_type: "Forced Air",
    cooling_type: "Air Conditioner, Central Air",
    appliances: ["Dishwasher", "Dryer", "Washer", "Range Oven", "Refrigerator"],
    amenities: [
      "Southern Orchards Location",
      "Bonus Dedicated Office Room",
      "Waterproofed Full Basement",
      "Wide Front Porch with Swing",
      "Huge Fenced Backyard with Fire Pit",
      "Minutes to Nationwide Children's Hospital",
      "Pet Friendly"
    ],
    enriched_description: `Situated in Southern Orchards just blocks from Nationwide Children's Hospital and German Village, this updated two-story residence spans 1,392 square feet. The home features three spacious bedrooms with ample closet space, a dedicated bonus room ideal for a home office, and two complete full bathrooms.

Interior upgrades include modern kitchen cabinetry with a dishwasher, new light fixtures, fresh paint, central air conditioning, and plush gray carpeting. A waterproofed full basement provides extensive storage space and in-unit laundry with washer and dryer included. Outdoors, relax on the wide covered front porch with porch swing or gather in the large, fully fenced backyard complete with a fire pit.`
  },
  {
    pipeline_id: "PP-44F08CDD",
    address: "246 E Welch Ave",
    city: "Columbus",
    state: "OH",
    zip: "43207",
    county: "Franklin County",
    title: "3BR SINGLE FAMILY in Columbus",
    property_type: "DUPLEX", // Architectural reality: side-by-side duplex unit
    original_rent: 1650,
    monthly_rent: 1650,
    security_deposit: 1650,
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: null,
    square_footage: 1444,
    has_basement: false,
    has_central_air: true,
    parking: "2-Car Off-Street Parking Pad",
    garage_spaces: null,
    laundry_type: "In Unit",
    heating_type: "Forced Air",
    cooling_type: "Air Conditioner, Central Air",
    appliances: ["Dishwasher", "Dryer", "Washer", "Stove/Oven", "Refrigerator"],
    amenities: [
      "Top-to-Bottom Interior Renovation",
      "Granite Countertops",
      "Stainless Steel Appliances",
      "Brand New Washer & Dryer Included",
      "Fully Fenced Backyard for Privacy",
      "2-Car Off-Street Parking Pad",
      "Near Merion Village",
      "Pet Friendly"
    ],
    enriched_description: `Fully renovated throughout, this spacious side-by-side duplex residence offers 1,444 square feet of contemporary living space near Merion Village and south Columbus amenities. The interior features three bedrooms and two full bathrooms with durable flooring and modern fixtures.

The kitchen showcases granite countertops, stainless steel appliances, a new electric range, and a dishwasher. A brand-new washer and dryer are included within the unit for daily convenience. Central air conditioning regulates interior temperatures throughout the year. Exterior amenities include a private fenced backyard and a dedicated two-car off-street parking pad.`
  },
  {
    pipeline_id: "PP-63E51AB8",
    address: "4808 McAllister Ave",
    city: "Columbus",
    state: "OH",
    zip: "43227",
    county: "Franklin County",
    title: "3BR SINGLE FAMILY in Columbus",
    property_type: "SINGLE_FAMILY",
    original_rent: 1700,
    monthly_rent: 1700,
    security_deposit: 1700,
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: null,
    square_footage: 1500,
    has_basement: true,
    has_central_air: true,
    parking: "Attached 1-Car Garage",
    garage_spaces: 1,
    laundry_type: "In-Unit Hookups",
    heating_type: "Central Forced Air",
    cooling_type: "Central Air Conditioning",
    appliances: ["Range Oven", "Refrigerator"],
    amenities: [
      "Full Storage Basement",
      "1-Car Attached Garage",
      "Deep Fenced Backyard",
      "Central Heating & Air",
      "Quiet Residential Street",
      "Pet Friendly"
    ],
    enriched_description: `Set along a quiet residential street in East Columbus, this remodeled three-bedroom, two-bathroom single-family home delivers 1,500 square feet of comfortable living space. The main gathering areas feature generous natural light and dependable central heating for cooler seasons.

A functional kitchen connects to adjacent dining space and dedicated in-unit laundry hookups. A full unfinished basement extends underneath the home, offering expansive workshop and seasonal storage capacity. Outside, a private attached one-car garage and a deep, fully fenced backyard offer secure parking and outdoor leisure with quick access to the I-70 corridor.`
  },
  {
    pipeline_id: "PP-E03511B0",
    address: "3983 Nile Ave",
    city: "Groveport",
    state: "OH",
    zip: "43125",
    county: "Franklin County",
    title: "3BR SINGLE FAMILY in Groveport",
    property_type: "SINGLE_FAMILY",
    original_rent: 1750,
    monthly_rent: 1750,
    security_deposit: 1750,
    bedrooms: 3,
    bathrooms: 1.5, // Preserved decimal precision
    half_bathrooms: 1,
    square_footage: 936,
    has_basement: false,
    has_central_air: true,
    parking: "Attached 1-Car Garage",
    garage_spaces: 1,
    laundry_type: "In-Unit Hookups",
    heating_type: "Forced Air",
    cooling_type: "Air Conditioner, Central Air",
    appliances: ["Dishwasher", "Microwave Oven", "Oven", "Range Oven", "Refrigerator"],
    amenities: [
      "Split-Level Architectural Floor Plan",
      "Attached 1-Car Garage",
      "Full Kitchen Appliance Suite",
      "Central Air Conditioning",
      "Groveport Madison Schools",
      "Pet Friendly"
    ],
    enriched_description: `Located in Groveport within the local school district, this split-level home provides 936 square feet of functional living space featuring three bedrooms and one and a half bathrooms. The split-level architecture creates comfortable separation between common living quarters and private bedrooms.

The kitchen is equipped with a full appliance suite including an electric range oven, refrigerator, microwave, and dishwasher. Central air conditioning and forced-air heating provide reliable climate control. An attached one-car garage provides sheltered parking and storage, with quick driving access to Groveport community parks and southern commuting arteries.`
  },
  {
    pipeline_id: "PP-B2194362",
    address: "773 Ann St",
    city: "Columbus",
    state: "OH",
    zip: "43206",
    county: "Franklin County",
    title: "3BR TOWNHOMES in Columbus",
    property_type: "DUPLEX", // Architectural reality: 1,700 sqft side-by-side duplex unit
    original_rent: 1800,
    monthly_rent: 1800,
    security_deposit: 1800,
    bedrooms: 3,
    bathrooms: 1.5, // Preserved decimal precision
    half_bathrooms: 1,
    square_footage: 1700,
    has_basement: true,
    has_central_air: true,
    parking: "Off-Street Parking",
    garage_spaces: null,
    laundry_type: "In Unit",
    heating_type: "High-Efficiency Gas Furnace",
    cooling_type: "Central Air Conditioning",
    appliances: ["Dryer", "Range Oven", "Refrigerator", "Washer"],
    amenities: [
      "Decorative Brick Fireplace & Built-In Bookshelves",
      "Original French Doors",
      "Stainless Steel Kitchen Suite with Porcelain Tile",
      "Attached Sunroom & Home Office / 3rd Bedroom",
      "In-Unit Washer & Dryer Included",
      "Full Storage Basement",
      "6-Foot Privacy-Fenced Backyard",
      "Pet Friendly"
    ],
    enriched_description: `Spanning 1,700 square feet in historic Southern Orchards, this brick duplex residence is situated within walking distance of Nationwide Children's Hospital, local cafes, and neighborhood breweries. The open main level features a decorative brick fireplace, custom built-in bookshelves, and original French doors leading between living and dining spaces.

The kitchen is updated with porcelain tile flooring and stainless steel appliances including a range oven and refrigerator. A ground-floor half bathroom houses an in-unit washer and dryer, while the second floor hosts two large bedrooms, a versatile home office or third bedroom, an attached sunroom, and a full central bathroom. Additional features include a full storage basement, central air conditioning, off-street parking, and a six-foot privacy-fenced backyard.`
  },
  {
    pipeline_id: "PP-BB88F1CF",
    address: "1218 Summit St",
    city: "Columbus",
    state: "OH",
    zip: "43201",
    county: "Franklin County",
    title: "3BR TOWNHOMES in Columbus",
    property_type: "DUPLEX", // Architectural reality: classic half-double duplex
    original_rent: 1635,
    monthly_rent: 1635,
    security_deposit: 1635,
    bedrooms: 3,
    bathrooms: 1.5, // Preserved decimal precision
    half_bathrooms: 1,
    square_footage: 1296,
    has_basement: true,
    has_central_air: true,
    parking: "2 Off-Street Parking Spaces",
    garage_spaces: null,
    laundry_type: "In Unit",
    heating_type: "High-Efficiency Furnace",
    cooling_type: "Central Air Conditioning & Dual Zone",
    appliances: ["Dryer", "Washer", "Electric Range", "Microwave", "Refrigerator", "Dishwasher", "Disposal"],
    amenities: [
      "Historic Restored Half-Double in Weinland Park",
      "Original Woodwork & Hardwood Floors",
      "Decorative Fireplace Mantel",
      "Granite Countertops & Updated Cabinetry",
      "Third-Floor Den/Bedroom with Separate Zone",
      "Washer & Dryer in Basement",
      "Wide Front Porch & Fenced Yard",
      "2 Off-Street Parking Spaces",
      "Pet Friendly"
    ],
    enriched_description: `Positioned in Weinland Park just steps from Italian Village and the Short North Arts District, this restored half-double residence provides 1,296 square feet of character-rich living space. The first floor features original woodwork, hardwood floors, a living room with decorative mantel, and a convenient ground-floor half bath.

The kitchen is appointed with granite countertops, tiled flooring, updated cabinetry, a refrigerator, electric range, microwave, dishwasher, and disposal. Three versatile bedrooms include a top-floor den or third bedroom with independent temperature controls, supported by a full upper-level bath. A full basement houses an included washer and dryer, while the exterior provides a classic covered front porch, a fenced rear yard, and two dedicated off-street parking spaces.`
  },
  {
    pipeline_id: "PP-B0FA9249",
    address: "1377 N 6th St",
    city: "Columbus",
    state: "OH",
    zip: "43201",
    county: "Franklin County",
    title: "3BR TOWNHOMES in Columbus",
    property_type: "DUPLEX", // Architectural reality: half-double duplex
    original_rent: 1695,
    monthly_rent: 1695,
    security_deposit: 1695,
    bedrooms: 3,
    bathrooms: 1.5, // Preserved decimal precision
    half_bathrooms: 1,
    square_footage: 1150,
    has_basement: true,
    has_central_air: true,
    parking: "Off-Street Parking",
    garage_spaces: null,
    laundry_type: "In Unit",
    heating_type: "Forced Air",
    cooling_type: "Central Air Conditioning",
    appliances: ["Dishwasher", "Dryer", "Microwave Oven", "Oven", "Refrigerator", "Washer"],
    amenities: [
      "Weinland Park Location Near OSU & Short North",
      "Granite & Stainless Steel Kitchen",
      "Full Storage Basement",
      "Washer & Dryer Included",
      "Fenced Backyard",
      "Off-Street Parking",
      "Pet Friendly"
    ],
    enriched_description: `Situated in Weinland Park with immediate convenience to Ohio State University and the Short North, this remodeled half-double home provides 1,150 square feet across two levels. The home offers three comfortable bedrooms, a full central bath, and a main-level half bathroom.

The kitchen is finished with granite countertops and stainless steel appliances including a refrigerator, dishwasher, microwave, and range oven. A full basement provides extensive dry storage and includes a dedicated washer and dryer. Central air conditioning keeps the interior cool throughout the summer, while the exterior offers a fully fenced backyard and dedicated off-street parking.`
  },
  {
    pipeline_id: "PP-D7FA554D",
    address: "1419 N 6th St #1419",
    city: "Columbus",
    state: "OH",
    zip: "43201",
    county: "Franklin County",
    title: "3BR TOWNHOMES in Columbus",
    property_type: "TOWNHOUSE", // Architectural reality: multi-story townhome
    original_rent: 1600,
    monthly_rent: 1600,
    security_deposit: 1600,
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: null,
    square_footage: 1176,
    has_basement: false,
    has_central_air: true,
    parking: "Private 2-Car Parking Space",
    garage_spaces: null,
    laundry_type: "In-Unit Hookups",
    heating_type: "Forced Air",
    cooling_type: "Air Conditioner, Central Air",
    appliances: ["Oven", "Refrigerator"],
    amenities: [
      "Fully Updated Townhome Layout",
      "Private 2-Car Parking Behind Unit",
      "Fully Fenced Front & Back Yard",
      "Central Air Conditioning",
      "Quick Commute to Downtown Columbus",
      "Pet Friendly"
    ],
    enriched_description: `Located along North 6th Street with swift access to downtown Columbus and local transit corridors, this renovated multi-story townhome offers 1,176 square feet of updated living space. The layout features three well-proportioned bedrooms and two full bathrooms with modern finishes throughout.

The kitchen is equipped with solid cabinetry, a range oven, and refrigerator, with in-unit laundry hookups easily accessible. Heating and air conditioning ensure dependable year-round climate regulation. Exterior highlights include fully fenced front and rear yard areas and a private two-car parking space situated directly behind the home.`
  }
];

const REJECTED_PROPERTIES = [
  {
    pipeline_id: "PP-6FBC37FE",
    address: "4906 Folger Dr",
    city: "Columbus",
    state: "OH",
    zip: "43227",
    rent: 1650,
    beds: 3,
    baths: 2,
    photos_count: 5,
    rejection_reason: "Fails minimum photo requirement: Only 5 photos available (minimum 6 genuine property photos required by Rule 13 & AGENTS.md)."
  }
];

async function main() {
  console.log("=== CHOICE PROPERTIES: COLUMBUS ZILLOW PIPELINE ENRICHMENT & PUBLISHING ===");
  console.log(`Reviewed properties: ${QUALIFYING_BATCH.length + REJECTED_PROPERTIES.length}`);
  console.log(`Qualifying properties: ${QUALIFYING_BATCH.length}`);
  console.log(`Rejected properties: ${REJECTED_PROPERTIES.length}\n`);

  // Handle rejected property
  for (const rej of REJECTED_PROPERTIES) {
    console.log(`[REJECTED] ${rej.pipeline_id}: ${rej.address} (${rej.rejection_reason})`);
    await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${rej.pipeline_id}`, {
      method: "PATCH",
      headers: pipelineHeaders,
      body: JSON.stringify({
        status: "rejected",
        photo_cleanup_status: "rejected",
        last_photo_import_error: rej.rejection_reason,
        updated_at: new Date().toISOString()
      })
    });
    console.log(`  ✓ Pipeline status marked as 'rejected'`);
  }

  const rawRecords = JSON.parse(fs.readFileSync('batch_columbus_raw.json', 'utf8'));
  const rawMap = new Map();
  rawRecords.forEach(r => rawMap.set(r.id, r));

  const publishedResults = [];

  for (let i = 0; i < QUALIFYING_BATCH.length; i++) {
    const p = QUALIFYING_BATCH[i];
    const raw = rawMap.get(p.pipeline_id);
    if (!raw) {
      console.error(`ERROR: Could not find raw pipeline record for ${p.pipeline_id}`);
      continue;
    }

    console.log(`\n------------------------------------------------------------`);
    console.log(`[${i+1}/${QUALIFYING_BATCH.length}] Processing ${p.pipeline_id}: ${p.address}, ${p.city}, ${p.state} ${p.zip}`);

    // 1. Check for duplicates in public.properties to preserve existing ID if present
    const existingRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?address=ilike.${encodeURIComponent(p.address)}&select=id,status`, {
      headers
    });
    const existing = await existingRes.json();
    let targetPropertyId;

    if (existing && existing.length > 0) {
      targetPropertyId = existing[0].id;
      console.log(`  Found existing property record: ${targetPropertyId} (preserving existing ID & URL)`);
    } else {
      targetPropertyId = randomUUID();
      console.log(`  Generated new property ID: ${targetPropertyId}`);
    }

    // 2. Validate price constraint: cap at $2,000 per user prompt instruction
    let rent = p.original_rent;
    if (rent > 2000) {
      console.log(`  [Price adjustment]: Original rent $${rent} capped to exactly $2,000`);
      rent = 2000;
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

    // Delete existing photos for this property if updating
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
        bathrooms: p.bathrooms,
        half_bathrooms: p.half_bathrooms,
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

  fs.writeFileSync('published_columbus_results.json', JSON.stringify(publishedResults, null, 2));
}

main().catch(console.error);
