import fs from 'fs';
import { randomUUID } from 'crypto';

const SUPABASE_URL = 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE';

const SB_HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'Prefer': 'return=representation'
};

const SB_PIPELINE_HEADERS = {
  ...SB_HEADERS,
  'Accept-Profile': 'pipeline',
  'Content-Profile': 'pipeline'
};

// Raw pipeline records
const rawRecords = JSON.parse(fs.readFileSync('wave_a_raw.json', 'utf8'));

// 1. Fully verified, enriched, unique, natural descriptions & structured fields
const ENRICHED_DATA = {
  'PP-2F334469': {
    title: '4BR/2BA Townhome Style Duplex in Cleveland',
    address: '2023 W 93rd St #1',
    city: 'Cleveland',
    state: 'OH',
    zip: '44102',
    county: 'Cuyahoga County',
    property_type: 'Townhouse',
    bedrooms: 4,
    bathrooms: 2,
    square_footage: 1825,
    monthly_rent: 1900,
    security_deposit: 1900,
    application_fee: 50,
    pets_allowed: true,
    smoking_allowed: false,
    minimum_lease_months: null,
    lease_terms: null,
    parking: 'Off-Street Parking Available',
    garage_spaces: null,
    laundry_type: 'In-Unit Hookups Available',
    heating_type: 'Forced Air',
    cooling_type: 'Window Units',
    has_basement: true,
    has_central_air: false,
    appliances: ['Dishwasher', 'Oven', 'Refrigerator', 'Washer/Dryer Hookups'],
    amenities: ['Pet Friendly', 'Private Porch', 'Backyard', 'Basement Storage', 'Dedicated Laundry Hookups'],
    description: `Fully renovated townhome-style duplex providing 1,825 square feet of updated living space across three distinct levels at 2023 W 93rd St in Cleveland.

The main level features an open layout with natural light connecting the living room to the dining area, leading directly into a modern kitchen with new tile flooring, updated cabinetry, refrigerator, stove, and dishwasher. A private rear door provides convenient access out to a dedicated back porch and yard space.

On the second level, three comfortable bedrooms share a fully renovated bathroom with modern vanity and fixtures. The entire third floor offers an expansive private retreat featuring a fourth bedroom, a flexible landing area suitable for a study or lounge, and a second full bathroom.

A full private unfinished basement includes dedicated laundry hookups and extensive utility storage. Outdoor spaces include a covered front porch, front yard, and a private backyard.

Utilities: Tenant is responsible for gas and electric, plus a $125/month municipal water and sewer utility fee. Pet friendly. Application Fee: $50.

Submit your rental application today at Choice Properties.`
  },

  'PP-DA16E8A6': {
    title: '3BR/3BA Townhome in Berea',
    address: '119 River Rock Way #1',
    city: 'Berea',
    state: 'OH',
    zip: '44017',
    county: 'Cuyahoga County',
    property_type: 'Townhouse',
    bedrooms: 3,
    bathrooms: 3,
    half_bathrooms: 1,
    square_footage: 1776,
    monthly_rent: 2495,
    security_deposit: 2495,
    application_fee: 50,
    pets_allowed: true,
    smoking_allowed: false,
    minimum_lease_months: null,
    lease_terms: null,
    parking: 'Attached 1-Car Garage',
    garage_spaces: 1,
    laundry_type: 'In-Unit Washer & Dryer',
    heating_type: 'Central / Forced Air',
    cooling_type: 'Central Air',
    has_basement: true,
    has_central_air: true,
    appliances: ['Dishwasher', 'Dryer', 'Microwave Oven', 'Oven', 'Refrigerator', 'Washer', 'Water Softener'],
    amenities: ['Pet Friendly', 'Hardwood Floors', 'Composite Deck', 'Walk-In Closet', 'Morning Room', 'Attached Garage', 'Basement Storage'],
    description: `Spacious two-story townhome offering 1,776 square feet of living space at 119 River Rock Way in Berea.

The main level features hardwood flooring flowing throughout the living room, formal dining space, kitchen, and an adjacent morning room with ample natural light. The kitchen comes fully equipped with a refrigerator, range oven, microwave, dishwasher, and water softener. A sliding glass door opens directly to a private composite deck ideal for outdoor dining.

Upstairs, three carpeted bedrooms provide peaceful private quarters, highlighted by a primary suite with a walk-in closet and private en-suite bathroom. A dedicated second-floor laundry room includes both washer and dryer for everyday convenience.

The home also includes an attached one-car garage with interior access and a full unfinished basement offering abundant additional storage space. Central air conditioning and forced air heating maintain consistent year-round comfort.

Ideally located in Berea, within quick driving distance of Baldwin Wallace University, Cleveland Hopkins International Airport, local dining, and shopping. Pet friendly. Application Fee: $50.

Submit your rental application today at Choice Properties.`
  },

  'PP-7DAC0757': {
    title: '3BR/2BA Single Family Home in Cleveland',
    address: '17424 Oxford Ave',
    city: 'Cleveland',
    state: 'OH',
    zip: '44111',
    county: 'Cuyahoga County',
    property_type: 'Single Family',
    bedrooms: 3,
    bathrooms: 2,
    square_footage: 1550,
    monthly_rent: 2200,
    security_deposit: 2200,
    application_fee: 50,
    pets_allowed: true,
    smoking_allowed: false,
    minimum_lease_months: null,
    lease_terms: null,
    parking: 'Detached Garage & Driveway',
    garage_spaces: 1,
    laundry_type: 'In-Unit Washer & Dryer',
    heating_type: 'Central / Forced Air',
    cooling_type: 'Central Air',
    has_basement: true,
    has_central_air: true,
    appliances: ['Dishwasher', 'Dryer', 'Freezer', 'Microwave Oven', 'Oven', 'Refrigerator', 'Washer'],
    amenities: ['Pet Friendly', 'Enclosed Front Porch', 'Fenced Yard', 'Home Office Space', 'Finished Lower Level', 'Detached Garage', 'Central Air'],
    description: `Well-appointed three-level single-family home located on Oxford Ave in Cleveland's West Park neighborhood, within easy walking distance of Fairview Hospital and local shopping plazas.

An inviting enclosed front porch welcomes you into the first-floor living room and dining room accommodating a full six-person table. The adjacent kitchen features counter barstool seating, refrigerator, oven, microwave, and dishwasher.

The upper level includes two comfortable bedrooms with ceiling fans and blackout window coverings, along with a connected private home office area ideal for remote work or study. A versatile third bedroom area features a dedicated mudroom with direct walk-out access to the fully fenced backyard.

Two full bathrooms provide daily convenience, with one situated on the main level and a second located in the basement. The lower level includes a full washer and dryer, substantial utility storage space, and a pool table.

Parking is provided via an attached garage plus driveway space for two additional vehicles. Central air conditioning and forced air heating ensure year-round climate control. Utilities: electricity, gas, water/sewer, and internet included in rent. Pet friendly ($10/mo pet rent). Application Fee: $50.

Submit your rental application today at Choice Properties.`
  },

  'PP-7DE1AA99': {
    title: '3BR/2BA Single Family Home in Cleveland',
    address: '12605 Crossburn Ave',
    city: 'Cleveland',
    state: 'OH',
    zip: '44135',
    county: 'Cuyahoga County',
    property_type: 'Single Family',
    bedrooms: 3,
    bathrooms: 2,
    square_footage: 1736,
    monthly_rent: 1895,
    security_deposit: 1895,
    application_fee: 50,
    pets_allowed: true,
    smoking_allowed: false,
    minimum_lease_months: null,
    lease_terms: null,
    parking: 'Detached Garage',
    garage_spaces: 1,
    laundry_type: 'In-Unit Washer & Dryer',
    heating_type: 'Central / Forced Air',
    cooling_type: 'Central Air',
    has_basement: true,
    has_central_air: true,
    appliances: ['Dishwasher', 'Dryer', 'Freezer', 'Microwave Oven', 'Oven', 'Refrigerator', 'Washer'],
    amenities: ['Pet Friendly', 'Renovated Interior', 'Finished Basement', 'Home Office Workspace', 'Fenced Backyard', 'Detached Garage', 'Central Air'],
    description: `Thoroughly renovated in 2023, this spacious single-family residence provides 1,736 square feet across three finished levels of living space at 12605 Crossburn Ave in Cleveland.

The primary level features a bright living room, two generous bedrooms, a modern full bathroom, and a fully appointed kitchen with stainless steel appliances including a refrigerator, range oven, microwave, and dishwasher, complemented by ample cabinetry.

Upstairs offers an additional sleeping quarters and living area accompanied by a second full bathroom.

The fully finished basement adds significant flexible space, featuring an entertainment and dining zone with table seating for eight, a pool table, and a dedicated home office workstation equipped with a desk setup, built-in monitor, and accessible power connections. The lower level also includes a separate laundry room with washer, dryer, and utility sink.

Outdoors, enjoy a private fenced backyard and a detached garage. Conveniently situated for swift commutes: roughly 6 minutes to Cleveland Hopkins International Airport, 15 minutes to downtown Cleveland and Cleveland Clinic Fairview, and moments from I-71 and I-480. Pet friendly. Application Fee: $50.

Submit your rental application today at Choice Properties.`
  },

  'PP-46642B8B': {
    title: '3BR/2BA Single Family Home in Cleveland',
    address: '3971 Lonna Ct',
    city: 'Cleveland',
    state: 'OH',
    zip: '44111',
    county: 'Cuyahoga County',
    property_type: 'Single Family',
    bedrooms: 3,
    bathrooms: 2,
    square_footage: 1155,
    monthly_rent: 2100,
    security_deposit: 2100,
    application_fee: 50,
    pets_allowed: true,
    smoking_allowed: false,
    minimum_lease_months: null,
    lease_terms: null,
    parking: 'Detached 2-Car Garage',
    garage_spaces: 2,
    laundry_type: 'In-Unit Washer & Dryer',
    heating_type: 'High-Efficiency Forced Air',
    cooling_type: 'Central Air',
    has_basement: true,
    has_central_air: true,
    appliances: ['Dishwasher', 'Dryer', 'Oven', 'Refrigerator', 'Washer'],
    amenities: ['Pet Friendly', 'Cul-de-Sac Location', 'Hardwood Floors', 'Marble Countertops', 'Finished Rec Room', '2-Car Garage', 'High-Efficiency HVAC'],
    description: `Recently renovated 3-bedroom bungalow situated on a quiet cul-de-sac at 3971 Lonna Ct in Cleveland's 44111 neighborhood.

The home features refinished hardwood flooring across the living room and primary bedrooms, paired with custom tile in the kitchen and bathrooms. The upgraded kitchen is outfitted with craftsman-style cabinetry, Italian marble countertops and undermount sink, and appliances including a refrigerator, stove, and dishwasher.

The full basement provides a finished recreation room and a second full bathroom complete with a walk-in shower. A dedicated laundry and utility space includes an in-home washer and dryer.

Extensive mechanical upgrades include a high-efficiency HVAC heating and central air system, newer hot water tank, updated electrical service, extra blown-in attic insulation, a newer concrete driveway, and a detached 2-car garage. Pet friendly. Application Fee: $50.

Submit your rental application today at Choice Properties.`
  },

  'PP-3ACE1493': {
    title: '3BR/3BA Single Family Home in Cleveland',
    address: '15025 Schuyler Ave',
    city: 'Cleveland',
    state: 'OH',
    zip: '44111',
    county: 'Cuyahoga County',
    property_type: 'Single Family',
    bedrooms: 3,
    bathrooms: 3,
    square_footage: 2488,
    monthly_rent: 2400,
    security_deposit: 2400,
    application_fee: 50,
    pets_allowed: true,
    smoking_allowed: false,
    minimum_lease_months: null,
    lease_terms: null,
    parking: 'Heated 3-Car Garage with Workshop',
    garage_spaces: 3,
    laundry_type: 'In-Unit Washer & Dryer',
    heating_type: 'Central / Forced Air',
    cooling_type: 'Central Air',
    has_basement: true,
    has_central_air: true,
    appliances: ['Dishwasher', 'Dryer', 'Microwave Oven', 'Oven', 'Refrigerator', 'Washer'],
    amenities: ['Pet Friendly', 'Half-Acre Lot', 'Heated 3-Car Garage', 'Workshop with Exhaust', 'Finished Basement', 'Fenced Yard', 'Vaulted Primary Suite', 'Central Air'],
    description: `Substantial single-family home positioned on an exceptional half-acre parcel (.49 acre) at 15025 Schuyler Ave in Cleveland's West Park neighborhood.

Offering nearly 2,500 square feet of renovated living space across three levels, the first floor includes an open living room and dining area, two bedrooms, a full bathroom, and an updated kitchen with stainless steel appliances including a refrigerator, stove, microwave, and dishwasher.

The upper level features a spacious primary retreat with vaulted ceilings, multiple walk-in closets, and an en-suite bath with a custom-tiled walk-in shower. The finished lower level adds a large recreation room suited for a media room, home gym, or office, plus a third full bathroom and dedicated private laundry room with washer and dryer.

Exterior highlights include new siding, energy-efficient black windows and doors, a composite front porch, central air, and a deep backyard fully enclosed with modern black horizontal fencing.

A standout highlight is the expansive 3-car heated garage featuring an attached rear workshop, integrated LED workspace lighting, and a whole-garage exhaust system. Conveniently located near I-90, I-71, the Cleveland Metroparks, Kamm's Corners, and Cleveland Hopkins International Airport. Pet friendly. Application Fee: $50.

Submit your rental application today at Choice Properties.`
  },

  'PP-4DDECAA9': {
    id: 'ba506749-1923-46cc-b4bb-88189901cef0', // Existing property ID
    title: '3BR/3BA Luxury Townhome in Cleveland',
    address: '7304 Park Place Ct',
    city: 'Cleveland',
    state: 'OH',
    zip: '44102',
    county: 'Cuyahoga County',
    property_type: 'Townhouse',
    bedrooms: 3,
    bathrooms: 3,
    square_footage: 1676,
    monthly_rent: 3550,
    security_deposit: 3550,
    application_fee: 50,
    pets_allowed: true,
    smoking_allowed: false,
    minimum_lease_months: null,
    lease_terms: null,
    parking: 'Attached 2-Car Garage',
    garage_spaces: 2,
    laundry_type: 'In-Unit Washer & Dryer',
    heating_type: 'Central / Forced Air',
    cooling_type: 'Central Air',
    has_basement: true,
    has_central_air: true,
    appliances: ['Dishwasher', 'Dryer', 'Freezer', 'Gas Range', 'Microwave Oven', 'Oven', 'Refrigerator', 'Washer'],
    amenities: ['Pet Friendly', 'Rooftop Wet Bar Terrace', '10-Foot Ceilings', 'Attached 2-Car Garage', 'Walk-In Closet', 'Utilities Included (Water/Trash/Snow)'],
    description: `Corner townhome residence featuring 10-foot ceilings and expansive window lines at 7304 Park Place Ct, steps from Edgewater Beach and the Gordon Square Arts District.

The main level showcases an open-concept layout centered around a gourmet kitchen with high-end stainless steel appliances including a gas range, dishwasher, refrigerator, microwave, walk-in pantry, and generous cabinetry.

The bedroom level includes a large primary suite with a spa-inspired en-suite bathroom and walk-in closet, a second bedroom, and a versatile third room ideal as an executive office, fitness room, or guest bedroom.

On the upper level, an open-air rooftop terrace provides an outdoor entertaining venue complete with a wet bar, mini-fridge, prep sink, and cabinetry.

Additional conveniences include an attached two-car garage, in-unit washer and dryer, and motion-activated security sensors. Water, sewer, trash removal, landscaping, and snow removal are included in the monthly rent. Pet friendly. Application Fee: $50.

Submit your rental application today at Choice Properties.`
  },

  'PP-A8A0837F': {
    id: '9831b82b-630d-4aaa-95bb-d3c2858a60c0', // Existing property ID
    title: '3BR/2BA Single Family Home in Cleveland',
    address: '4480 W 148th St',
    city: 'Cleveland',
    state: 'OH',
    zip: '44135',
    county: 'Cuyahoga County',
    property_type: 'Single Family',
    bedrooms: 3,
    bathrooms: 2,
    square_footage: 1188,
    monthly_rent: 1600,
    security_deposit: 1600,
    application_fee: 50,
    pets_allowed: true,
    smoking_allowed: false,
    minimum_lease_months: null,
    lease_terms: null,
    parking: 'Detached 2-Car Garage',
    garage_spaces: 2,
    laundry_type: 'In-Unit Hookups Available',
    heating_type: 'Central / Forced Air',
    cooling_type: 'Central Air',
    has_basement: true,
    has_central_air: true,
    appliances: ['Dishwasher', 'Oven', 'Refrigerator'],
    amenities: ['Pet Friendly', 'New Flooring', 'Brick Paved Driveway', 'Oversized 2-Car Garage', 'Central Air', 'Basement Storage'],
    description: `Single-family home featuring fresh interior paint and new flooring throughout at 4480 W 148th St in Cleveland.

The home offers a comfortable layout with three bedrooms, two bathrooms, and a bright main living area with energy-efficient windows. The kitchen includes a refrigerator, range oven, and dishwasher with practical counter and cabinet space.

A full basement provides extensive utility storage and dedicated in-home laundry hookups. Forced air heating and central air conditioning provide reliable climate comfort throughout all seasons.

Outside, an oversized detached 2-car garage is paired with a classic brick-paved driveway offering ample off-street parking, alongside a private yard space. Conveniently located minutes from I-71, I-480, Cleveland Hopkins International Airport, neighborhood schools, and downtown Cleveland. Pet friendly. Application Fee: $50.

Submit your rental application today at Choice Properties.`
  },

  'PP-3FB1BF3B': {
    id: '4081-w-158th-st-PP-39FE3', // Existing property ID
    title: '3BR/2BA Single Family Home in Cleveland',
    address: '4081 W 158th St',
    city: 'Cleveland',
    state: 'OH',
    zip: '44135',
    county: 'Cuyahoga County',
    property_type: 'Single Family',
    bedrooms: 3,
    bathrooms: 2,
    square_footage: 2164,
    monthly_rent: 2200,
    security_deposit: 2200,
    application_fee: 50,
    pets_allowed: true,
    smoking_allowed: false,
    minimum_lease_months: null,
    lease_terms: null,
    parking: 'Detached 2-Car Garage with Storage Loft',
    garage_spaces: 2,
    laundry_type: 'In-Unit Washer & Dryer',
    heating_type: 'Central / Forced Air',
    cooling_type: 'Central Air',
    has_basement: true,
    has_central_air: true,
    appliances: ['Dishwasher', 'Dryer', 'Garbage Disposal', 'Microwave Oven', 'Range Oven', 'Refrigerator', 'Washer'],
    amenities: ['Pet Friendly', 'Vaulted Loft Suite', 'Finished Basement', 'Covered Front Porch', 'Detached 2-Car Garage', 'Kitchen Island'],
    description: `Distinctive 3-bedroom, 2-full-bathroom residence offering 2,164 square feet in Cleveland's desirable Kamm's Corners neighborhood at 4081 W 158th St.

A second-floor loft suite serves as a primary bedroom retreat featuring vaulted ceilings, multiple windows with natural light, and its own dedicated full bathroom. The main floor houses two additional bedrooms, a second full bathroom, and a spacious kitchen with a center island, generous cabinet storage, refrigerator, range oven, microwave, and dishwasher.

The partially finished basement provides flexible additional living space with fresh paint and new carpeting, ideal for a recreation room, media lounge, or home office. An unfinished utility section includes a washer and dryer along with abundant storage.

Exterior amenities include an inviting covered front porch, a partially fenced yard, and a detached two-car garage with an overhead storage loft. Situated less than one mile from Cleveland Clinic Fairview Hospital, with convenient proximity to the Cleveland Metroparks, I-71, I-90, and Kamm's Corners shopping and dining. Pet friendly. Application Fee: $50.

Submit your rental application today at Choice Properties.`
  }
};

async function main() {
  console.log('=== Choice Properties: Cleveland Wave A Publishing ===\n');
  const publishedList = [];

  // 1. Process 6 NEW properties
  const newPipelineIds = [
    'PP-2F334469',
    'PP-DA16E8A6',
    'PP-7DAC0757',
    'PP-7DE1AA99',
    'PP-46642B8B',
    'PP-3ACE1493'
  ];

  for (const pid of newPipelineIds) {
    const data = ENRICHED_DATA[pid];
    const raw = rawRecords.find(r => r.id === pid);
    const newPropId = randomUUID();
    
    console.log(`Publishing NEW: ${pid} -> ${newPropId} (${data.address}, ${data.city})`);

    // Parse photos from raw original_image_urls
    let photoUrls = [];
    try {
      const parsed = JSON.parse(raw.original_image_urls);
      photoUrls = parsed.map(u => (typeof u === 'string' ? u : u.url)).filter(Boolean);
    } catch (e) {
      console.error(`Error parsing photos for ${pid}:`, e);
    }
    console.log(`  Photo count: ${photoUrls.length}`);

    // Insert into public.properties
    const propPayload = {
      id: newPropId,
      status: 'active',
      title: data.title,
      description: data.description,
      address: data.address,
      city: data.city,
      state: data.state,
      zip: data.zip,
      county: data.county,
      property_type: data.property_type,
      bedrooms: data.bedrooms,
      bathrooms: data.bathrooms,
      half_bathrooms: data.half_bathrooms || 0,
      square_footage: data.square_footage,
      monthly_rent: data.monthly_rent,
      security_deposit: data.security_deposit,
      application_fee: 50,
      pets_allowed: true,
      smoking_allowed: false,
      minimum_lease_months: null,
      lease_terms: null,
      parking: data.parking,
      garage_spaces: data.garage_spaces,
      laundry_type: data.laundry_type,
      heating_type: data.heating_type,
      cooling_type: data.cooling_type,
      has_basement: data.has_basement,
      has_central_air: data.has_central_air,
      amenities: data.amenities,
      appliances: data.appliances,
      lat: raw.lat || null,
      lng: raw.lng || null,
      source_status: 'available',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const propRes = await fetch(`${SUPABASE_URL}/rest/v1/properties`, {
      method: 'POST',
      headers: SB_HEADERS,
      body: JSON.stringify(propPayload)
    });

    if (!propRes.ok) {
      const err = await propRes.text();
      console.error(`  ERROR inserting property ${newPropId}:`, propRes.status, err);
      continue;
    }
    console.log(`  Property inserted: HTTP ${propRes.status}`);

    // Insert photos in batches into public.property_photos
    const photoRows = photoUrls.map((url, idx) => ({
      id: randomUUID(),
      property_id: newPropId,
      url: url,
      display_order: idx,
      is_hero: idx === 0,
      watermark_status: 'clean',
      alt_text: `${data.address}, ${data.city} ${data.state} - photo ${idx + 1}`,
      created_at: new Date().toISOString()
    }));

    const photoRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos`, {
      method: 'POST',
      headers: { ...SB_HEADERS, 'Prefer': 'return=minimal' },
      body: JSON.stringify(photoRows)
    });
    console.log(`  Inserted ${photoRows.length} photos: HTTP ${photoRes.status}`);

    // Update pipeline.pipeline_properties record to published
    const pipeRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${pid}`, {
      method: 'PATCH',
      headers: SB_PIPELINE_HEADERS,
      body: JSON.stringify({
        status: 'published',
        choice_property_id: newPropId,
        title: data.title,
        description: data.description,
        monthly_rent: data.monthly_rent,
        security_deposit: data.security_deposit,
        application_fee: 50,
        pets_allowed: true,
        smoking_allowed: false,
        minimum_lease_months: null,
        lease_terms: null,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    });
    console.log(`  Pipeline updated to published: HTTP ${pipeRes.status}`);

    publishedList.push({
      pipeline_id: pid,
      property_id: newPropId,
      address: data.address,
      city: data.city,
      state: data.state,
      zip: data.zip,
      rent: data.monthly_rent,
      beds: data.bedrooms,
      baths: data.bathrooms
    });
  }

  // 2. Process 3 EXISTING properties (enrich & sync in place)
  const existingPipelineIds = ['PP-4DDECAA9', 'PP-A8A0837F', 'PP-3FB1BF3B'];
  for (const pid of existingPipelineIds) {
    const data = ENRICHED_DATA[pid];
    const propId = data.id;

    console.log(`\nSyncing EXISTING: ${pid} -> ${propId} (${data.address}, ${data.city})`);

    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${propId}`, {
      method: 'PATCH',
      headers: SB_HEADERS,
      body: JSON.stringify({
        status: 'active',
        title: data.title,
        description: data.description,
        monthly_rent: data.monthly_rent,
        security_deposit: data.security_deposit,
        application_fee: 50,
        pets_allowed: true,
        smoking_allowed: false,
        minimum_lease_months: null,
        lease_terms: null,
        parking: data.parking,
        garage_spaces: data.garage_spaces,
        laundry_type: data.laundry_type,
        heating_type: data.heating_type,
        cooling_type: data.cooling_type,
        has_basement: data.has_basement,
        has_central_air: data.has_central_air,
        amenities: data.amenities,
        appliances: data.appliances,
        updated_at: new Date().toISOString()
      })
    });
    console.log(`  Existing property updated: HTTP ${updateRes.status}`);

    const pipeRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${pid}`, {
      method: 'PATCH',
      headers: SB_PIPELINE_HEADERS,
      body: JSON.stringify({
        status: 'published',
        choice_property_id: propId,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    });
    console.log(`  Pipeline updated to published: HTTP ${pipeRes.status}`);

    publishedList.push({
      pipeline_id: pid,
      property_id: propId,
      address: data.address,
      city: data.city,
      state: data.state,
      zip: data.zip,
      rent: data.monthly_rent,
      beds: data.bedrooms,
      baths: data.bathrooms
    });
  }

  // 3. Reject PP-B3FAC102 per Rule 4.C and Rule 15/19/21
  console.log('\nRejecting non-compliant property PP-B3FAC102 (Only 2 photos)...');
  const rejRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.PP-B3FAC102`, {
    method: 'PATCH',
    headers: SB_PIPELINE_HEADERS,
    body: JSON.stringify({
      status: 'failed',
      photo_cleanup_status: 'failed',
      photo_import_status: 'failed',
      last_photo_import_error: 'Rejected: Only 2 photos available (Streetview only; minimum 6 genuine property photos required per platform rules)',
      updated_at: new Date().toISOString()
    })
  });
  console.log(`  PP-B3FAC102 status: HTTP ${rejRes.status}`);

  console.log('\n=== Publication Complete! Summary ===');
  publishedList.forEach((p, idx) => {
    console.log(`${idx + 1}. ${p.address}, ${p.city}, ${p.state} ${p.zip} ($${p.rent}/mo | ${p.beds} Bed / ${p.baths} Bath) — https://choice-properties-site.pages.dev/property.html?id=${p.property_id}`);
  });

  fs.writeFileSync('wave_a_published_final.json', JSON.stringify(publishedList, null, 2));
}

main().catch(console.error);
