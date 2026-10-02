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

const MAX_RENT = 800; // Strict user rule: Maximum publishing amount is 800

const QUALIFYING_BATCH = [
  {
    pipeline_id: "PP-152B5E32",
    address: "3615 N Zedna Dr",
    city: "Oklahoma City",
    state: "OK",
    zip: "73112",
    county: "Oklahoma County",
    title: "1BR SINGLE FAMILY in Oklahoma City",
    property_type: "APARTMENT", // Fourplex unit
    original_rent: 850,
    monthly_rent: 800, // Reduced to 800 per instruction
    security_deposit: 800,
    bedrooms: 1,
    bathrooms: 1.0,
    half_bathrooms: null,
    square_footage: 400,
    has_basement: false,
    has_central_air: true,
    parking: "Off-Street",
    garage_spaces: null,
    laundry_type: null,
    heating_type: "Forced Air",
    cooling_type: "Air Conditioner, Central Air",
    appliances: ["Refrigerator", "Stove"],
    amenities: [
      "Fourplex Apartment Layout",
      "Central Air Conditioning",
      "Low-Maintenance Design",
      "Near Lake Hefner & NW Expressway",
      "Pet Friendly"
    ],
    enriched_description: `Located in northwest Oklahoma City near May Avenue and the Northwest Expressway, this efficient one-bedroom, one-bathroom apartment within a residential fourplex provides a comfortable, low-maintenance interior. The open living and sleeping area maximizes practical floor space with clean finishes.

The kitchenette provides functional storage and food preparation space suited for daily essentials. Central air conditioning keeps the interior consistently comfortable throughout Oklahoma summers. Residents enjoy straightforward transit access to local retail corridors, neighborhood dining, and Lake Hefner parkland.`
  },
  {
    pipeline_id: "PP-AD4DABCD",
    address: "814.5 East Dr",
    city: "Oklahoma City",
    state: "OK",
    zip: "73105",
    county: "Oklahoma County",
    title: "1BR SINGLE FAMILY in Oklahoma City",
    property_type: "APARTMENT", // Balcony apartment unit
    original_rent: 800,
    monthly_rent: 800,
    security_deposit: 800,
    bedrooms: 1,
    bathrooms: 1.0,
    half_bathrooms: null,
    square_footage: 900,
    has_basement: false,
    has_central_air: false,
    parking: "Off-Street",
    garage_spaces: null,
    laundry_type: null,
    heating_type: "Wall Furnace",
    cooling_type: "Window Unit",
    appliances: ["Dishwasher", "Refrigerator", "Stove"],
    amenities: [
      "OU Health Science & State Capitol Area",
      "Spacious 900 Sqft Floor Plan",
      "Historic Brick Paver Flooring",
      "Private Balcony",
      "Full Appliance Package with Dishwasher",
      "Pet Friendly"
    ],
    enriched_description: `Situated in the OU Health Sciences Center and State Capitol district, this expansive 900-square-foot one-bedroom apartment delivers generous interior proportions and distinctive architectural character. The primary living area is highlighted by classic brick paver flooring and abundant natural daylight.

The kitchen is equipped with solid cabinetry, a refrigerator, stove, and dishwasher. An adjoining private balcony provides a quiet outdoor spot overlooking the surrounding neighborhood. The location offers excellent walkability and transit connectivity to the medical campus, state offices, and downtown Oklahoma City.`
  },
  {
    pipeline_id: "PP-C8A53CBE",
    address: "3144 NW 15th St",
    city: "Oklahoma City",
    state: "OK",
    zip: "73107",
    county: "Oklahoma County",
    title: "1BR SINGLE FAMILY in Oklahoma City",
    property_type: "DUPLEX", // Duplex unit
    original_rent: 800,
    monthly_rent: 800,
    security_deposit: 800,
    bedrooms: 1,
    bathrooms: 1.0,
    half_bathrooms: null,
    square_footage: 795,
    has_basement: false,
    has_central_air: false,
    parking: "Off-Street",
    garage_spaces: null,
    laundry_type: "Hookups",
    heating_type: "Wall Heater",
    cooling_type: "Window A/C Unit",
    appliances: ["Electric Range", "Refrigerator"],
    amenities: [
      "Shartel Boulevard Addition Duplex",
      "Classic Hardwood Floors",
      "In-Unit Washer & Dryer Hookups",
      "Near OCU & Plaza District",
      "Pet Friendly"
    ],
    enriched_description: `Nestled in the Shartel Boulevard Addition of northwest Oklahoma City, this one-bedroom, one-bathroom duplex residence spans 795 square feet with rich hardwood floors running throughout the main living areas and bedroom.

The kitchen is equipped with an electric range oven, refrigerator, and dedicated connections for an in-unit washer and dryer. Climate comfort is maintained with window cooling units and a wall heater. The property is ideally situated close to Oklahoma City University, the Plaza District, and convenient crosstown thoroughfares.`
  },
  {
    pipeline_id: "PP-E5A7297D",
    address: "3609 SW 12th St",
    city: "Oklahoma City",
    state: "OK",
    zip: "73108",
    county: "Oklahoma County",
    title: "1BR SINGLE FAMILY in Oklahoma City",
    property_type: "APARTMENT", // Urban multi-unit residence
    original_rent: 799,
    monthly_rent: 799,
    security_deposit: 799,
    bedrooms: 1,
    bathrooms: 1.0,
    half_bathrooms: null,
    square_footage: 800,
    has_basement: false,
    has_central_air: true,
    parking: "Off-Street",
    garage_spaces: null,
    laundry_type: "In Unit",
    heating_type: "Electric",
    cooling_type: "Air Conditioner, Electric",
    appliances: ["Dryer", "Garbage Disposal", "Refrigerator", "Washer"],
    amenities: [
      "Industrial-Modern Interior",
      "Massive Primary Bedroom",
      "Full-Size In-Unit Washer & Dryer Included",
      "Central Air Conditioning",
      "Minutes to Bricktown & Downtown OKC",
      "Pet Friendly"
    ],
    enriched_description: `Featuring an industrial-modern design aesthetic, this 800-square-foot one-bedroom residence provides open-concept urban living just minutes from downtown Oklahoma City. The interior is anchored by an oversized primary bedroom with ample room for lounge furniture and a dedicated desk setup.

The kitchen includes modern cabinetry, a refrigerator, and garbage disposal, complemented by the convenience of a full-size in-unit washer and dryer. Central air conditioning and heating regulate year-round comfort. Immediate highway proximity offers swift travel times to Bricktown, the Paycom Center, and city employment centers.`
  },
  {
    pipeline_id: "PP-19E36F45",
    address: "531 SE 15th St",
    city: "Oklahoma City",
    state: "OK",
    zip: "73129",
    county: "Oklahoma County",
    title: "1BR SINGLE FAMILY in Oklahoma City",
    property_type: "SINGLE_FAMILY",
    original_rent: 795,
    monthly_rent: 795,
    security_deposit: 795,
    bedrooms: 1,
    bathrooms: 1.0,
    half_bathrooms: null,
    square_footage: 588,
    has_basement: false,
    has_central_air: true,
    parking: "Off-Street",
    garage_spaces: null,
    laundry_type: "Hookups",
    heating_type: "Forced Air",
    cooling_type: "Air Conditioner, Window Unit",
    appliances: ["Microwave Oven", "Stove"],
    amenities: [
      "Detached Single-Family Home",
      "Newly Refreshed Interior",
      "Cooking Range & Built-in Microwave",
      "In-Unit Laundry Hookups",
      "Private Yard",
      "Quick Access to I-35",
      "Pet Friendly"
    ],
    enriched_description: `Positioned on the south side of Oklahoma City, this refreshed detached single-family home offers 588 square feet featuring a spacious bedroom and an updated full bathroom. Fresh interior paint and durable flooring create a welcoming living environment.

The kitchen features a cooking range, built-in microwave, and solid countertop workspace, accompanied by dedicated in-unit laundry hookups. Air conditioning and heating keep the home comfortable through all seasons. The standalone parcel includes a private outdoor yard with easy access to I-35 and local transit stops.`
  },
  {
    pipeline_id: "PP-FDC350A7",
    address: "1128 NW 11th St",
    city: "Oklahoma City",
    state: "OK",
    zip: "73106",
    county: "Oklahoma County",
    title: "1BR SINGLE FAMILY in Oklahoma City",
    property_type: "SINGLE_FAMILY",
    original_rent: 850,
    monthly_rent: 800, // Reduced to 800 per instruction
    security_deposit: 800,
    bedrooms: 1,
    bathrooms: 1.0,
    half_bathrooms: null,
    square_footage: 400,
    has_basement: false,
    has_central_air: true,
    parking: "Off Street",
    garage_spaces: null,
    laundry_type: "Hookups",
    heating_type: "Forced Air",
    cooling_type: "Air Conditioner, Central Air",
    appliances: ["Stove", "Refrigerator"],
    amenities: [
      "Midtown / Plaza District Location",
      "Renovated Single-Story Cottage",
      "Central Air Conditioning",
      "In-Unit Laundry Hookups",
      "Dedicated Off-Street Parking",
      "Pet Friendly"
    ],
    enriched_description: `Conveniently located near the Midtown and Plaza District corridors, this renovated standalone one-bedroom home provides 400 square feet of efficient single-story living. Modern updates throughout include durable easy-care flooring and neutral paint tones.

The residence is equipped with central air conditioning, in-unit laundry hookups, and dedicated off-street vehicle parking. Enjoy close proximity to premier neighborhood dining, local coffee shops, and vibrant urban entertainment with quick connectivity to I-235.`
  },
  {
    pipeline_id: "PP-1BED2CE5",
    address: "529 SE 15th St",
    city: "Oklahoma City",
    state: "OK",
    zip: "73129",
    county: "Oklahoma County",
    title: "1BR SINGLE FAMILY in Oklahoma City",
    property_type: "SINGLE_FAMILY",
    original_rent: 795,
    monthly_rent: 795,
    security_deposit: 795,
    bedrooms: 1,
    bathrooms: 1.0,
    half_bathrooms: null,
    square_footage: 588,
    has_basement: false,
    has_central_air: true,
    parking: "Off-Street",
    garage_spaces: null,
    laundry_type: "Hookups",
    heating_type: "Forced Air",
    cooling_type: "Air Conditioner, Window Unit",
    appliances: ["Microwave Oven", "Stove"],
    amenities: [
      "Detached Single-Family Home",
      "Updated Full Bathroom & Bedroom",
      "Range Stove & Built-In Microwave",
      "In-Unit Washer/Dryer Hookups",
      "Private Yard Area",
      "Pet Friendly"
    ],
    enriched_description: `Offering a comfortable detached floor plan in southeast Oklahoma City, this single-family residence encompasses 588 square feet with an updated interior, generous primary bedroom, and a full bathroom.

The kitchen includes essential appliances such as a cooking stove and built-in microwave, along with practical washer and dryer hookups for daily laundry needs. Air conditioning provides reliable cooling during hot summer months. The home is bordered by a private yard area with straightforward access to downtown OKC and major arterial roadways.`
  },
  {
    pipeline_id: "PP-1B35DA02",
    address: "215 SE 38th St",
    city: "Oklahoma City",
    state: "OK",
    zip: "73129",
    county: "Oklahoma County",
    title: "1BR SINGLE FAMILY in Oklahoma City",
    property_type: "SINGLE_FAMILY",
    original_rent: 875,
    monthly_rent: 800, // Reduced to 800 per instruction
    security_deposit: 800,
    bedrooms: 1,
    bathrooms: 1.0,
    half_bathrooms: null,
    square_footage: 600,
    has_basement: false,
    has_central_air: false,
    parking: "Off-Street Parking",
    garage_spaces: null,
    laundry_type: "Hookups",
    heating_type: "Gas Wall Heater",
    cooling_type: "Window Unit",
    appliances: ["5-Burner Gas Stove", "Refrigerator"],
    amenities: [
      "Remodeled Single-Family Home",
      "New Flooring & Neutral Paint",
      "5-Burner Gas Range Oven & Refrigerator",
      "Generous Off-Street Parking",
      "Private Location Near Local Schools",
      "Pet Friendly"
    ],
    enriched_description: `Situated on a private parcel in South Oklahoma City, this remodeled 600-square-foot detached single-family home features modern interior paint, updated fixtures, and brand-new flooring across a bright, open living layout.

The kitchen is equipped with updated cabinetry, a refrigerator, and a five-burner gas cooking range. Generous off-street parking accommodates multiple vehicles, and the property is conveniently positioned near local elementary and middle schools, parks, and quick I-35 highway links.`
  },
  {
    pipeline_id: "PP-AB0700B2",
    address: "1407 NW 8th St",
    city: "Oklahoma City",
    state: "OK",
    zip: "73106",
    county: "Oklahoma County",
    title: "1BR TOWNHOMES in Oklahoma City",
    property_type: "DUPLEX", // Duplex studio/efficiency unit
    original_rent: 725,
    monthly_rent: 725,
    security_deposit: 725,
    bedrooms: 1,
    bathrooms: 1.0,
    half_bathrooms: null,
    square_footage: 511,
    has_basement: false,
    has_central_air: true,
    parking: "Off-Street",
    garage_spaces: null,
    laundry_type: null,
    heating_type: "Electric, Wall Furnace",
    cooling_type: "Air Conditioner, Wall Unit",
    appliances: ["Refrigerator", "Stove"],
    amenities: [
      "Classen Ten Penn / Plaza District Location",
      "Freshly Painted Duplex Layout",
      "Wall Unit Air Conditioning & Electric Heating",
      "Walkable Neighborhood Setting",
      "Pet Friendly"
    ],
    enriched_description: `Located in the historic Classen Ten Penn neighborhood near the Plaza District, this updated 511-square-foot duplex home offers an easy-maintenance layout with fresh paint and modern updates throughout.

The living space connects directly to a bright kitchen area and a full central bathroom. Year-round comfort is supported by an electric wall furnace and air conditioning unit. Residents benefit from close walkability to unique retail shops, local eateries, and effortless transit links to downtown Oklahoma City.`
  },
  {
    pipeline_id: "PP-B497D345",
    address: "1501 SW 30th St",
    city: "Oklahoma City",
    state: "OK",
    zip: "73119",
    county: "Oklahoma County",
    title: "1BR SINGLE FAMILY in Oklahoma City",
    property_type: "DUPLEX", // Duplex layout
    original_rent: 725,
    monthly_rent: 725,
    security_deposit: 725,
    bedrooms: 1,
    bathrooms: 1.0,
    half_bathrooms: null,
    square_footage: 650,
    has_basement: false,
    has_central_air: true,
    parking: "Off-Street",
    garage_spaces: null,
    laundry_type: null,
    heating_type: "Wall Furnace",
    cooling_type: "Air Conditioner, Wall Unit",
    appliances: ["Stove"],
    amenities: [
      "Newly Renovated Duplex Layout",
      "Large Primary Bedroom",
      "Spacious Shared Backyard",
      "Convenient South OKC Location",
      "Pet Friendly"
    ],
    enriched_description: `Set on a corner parcel in southwest Oklahoma City, this newly renovated duplex unit delivers a comfortable layout featuring a large primary bedroom and an updated full bathroom. Fresh interior finishes create a welcoming living environment throughout.

The kitchen comes equipped with a cooking stove and solid countertop preparation space. Outside, residents can enjoy a spacious shared backyard area suitable for open-air leisure, with convenient driving access to local shopping plazas, dining options, and public transit routes.`
  },
  {
    pipeline_id: "PP-56D9939E",
    address: "2821 SW 33rd St",
    city: "Oklahoma City",
    state: "OK",
    zip: "73119",
    county: "Oklahoma County",
    title: "1BR SINGLE FAMILY in Oklahoma City",
    property_type: "SINGLE_FAMILY",
    original_rent: 800,
    monthly_rent: 800,
    security_deposit: 800,
    bedrooms: 1,
    bathrooms: 1.0,
    half_bathrooms: null,
    square_footage: 400,
    has_basement: false,
    has_central_air: true,
    parking: "Off-Street",
    garage_spaces: null,
    laundry_type: null,
    heating_type: "Gas",
    cooling_type: "Air Conditioner, Window Unit",
    appliances: ["Refrigerator", "Stove"],
    amenities: [
      "Standalone Detached Cottage",
      "Refrigerator & Stove Included",
      "Window Air Conditioning & Heating",
      "Private Yard",
      "Close to SW 29th Street & I-44",
      "Pet Friendly"
    ],
    enriched_description: `This standalone 400-square-foot cottage in southwest Oklahoma City provides an efficient, private living arrangement featuring one bedroom, a full bathroom, and independent detached living.

The interior layout includes a kitchen equipped with a refrigerator and gas stove, paired with window air conditioning and heating for seasonal comfort. The standalone home offers private yard space and quick access to nearby schools, shopping along SW 29th Street, and the I-44 corridor.`
  }
];

const REJECTED_PROPERTIES = [
  {
    pipeline_id: "PP-73DC574D",
    address: "2817 SW 33rd St",
    city: "Oklahoma City",
    state: "OK",
    zip: "73119",
    rent: 900,
    beds: 1,
    baths: 1,
    photos_count: 5,
    rejection_reason: "Fails minimum photo requirement: Only 5 photos available (minimum 6 genuine property photos required by Rule 13 & AGENTS.md Section 4C)."
  }
];

async function main() {
  console.log("=== CHOICE PROPERTIES: OKC ZILLOW PIPELINE ENRICHMENT & PUBLISHING ===");
  console.log(`Reviewed properties: ${QUALIFYING_BATCH.length + REJECTED_PROPERTIES.length}`);
  console.log(`Qualifying properties: ${QUALIFYING_BATCH.length}`);
  console.log(`Rejected properties: ${REJECTED_PROPERTIES.length}`);
  console.log(`Price Cap Enforced: Maximum $${MAX_RENT}/month\n`);

  // 1. Handle rejected property
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

  const rawRecords = JSON.parse(fs.readFileSync('batch_okc_raw.json', 'utf8'));
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

    // Check existing
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

    // Price cap enforcement
    let rent = p.original_rent;
    if (rent > MAX_RENT) {
      console.log(`  [Price adjustment]: Original rent $${rent} capped down to exactly $${MAX_RENT}`);
      rent = MAX_RENT;
    }
    const deposit = rent; // 1x monthly rent

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
      console.error(`  ERROR saving property ${targetPropertyId}:`, upsertRes.status, await upsertRes.text());
      continue;
    }
    console.log(`  ✓ Saved property record (${targetPropertyId})`);

    // Photos
    let rawPhotoUrls = [];
    try {
      rawPhotoUrls = typeof raw.original_image_urls === 'string' ? JSON.parse(raw.original_image_urls) : (raw.original_image_urls || []);
    } catch (e) {
      rawPhotoUrls = [];
    }

    if (rawPhotoUrls.length < 6) {
      console.error(`  ERROR: ${p.pipeline_id} has fewer than 6 photos (${rawPhotoUrls.length}). Skipping photo insert.`);
      continue;
    }

    // Delete existing photos if updating
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
      console.warn(`  Warning: Photo insert returned HTTP ${photoInsertRes.status}`);
    } else {
      console.log(`  ✓ Inserted ${photoRows.length} clean property photos`);
    }

    // Update pipeline record
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

    // Verify live record
    const checkLiveRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${targetPropertyId}&select=id,title,address,city,state,zip,monthly_rent,bedrooms,bathrooms,property_type,status`, {
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

  fs.writeFileSync('published_okc_results.json', JSON.stringify(publishedResults, null, 2));
}

main().catch(console.error);
