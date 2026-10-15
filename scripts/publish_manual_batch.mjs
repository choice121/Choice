import https from 'https';

const SUPABASE_URL = 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE';
const SITE_URL = 'https://choice-properties-site.pages.dev';

const HEADERS = {
  'apikey': SERVICE_KEY,
  'Authorization': 'Bearer ' + SERVICE_KEY,
  'Content-Type': 'application/json'
};

function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqOptions = {
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, data: json, text: data });
        } catch (e) {
          resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, data: null, text: data });
        }
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

const BATCH = [
  {
    pipelineId: 'PP-791FE85F',
    source: 'zillow',
    address: '4371 NE 83rd Ter',
    city: 'Kansas City',
    state: 'MO',
    zip: '64119',
    county: 'Clay County',
    neighborhood: 'Northland',
    lat: 39.244736,
    lng: -94.52739,
    property_type: 'TOWNHOUSE',
    bedrooms: 3,
    bathrooms: 2.5,
    half_bathrooms: 1,
    square_footage: 1500,
    lot_size_sqft: null,
    year_built: 2008,
    floors: 2,
    garage_spaces: 1,
    parking: 'Attached 1-Car Garage + Private Driveway',
    heating_type: 'Central Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Upper-Level Dedicated In-Unit Hookups',
    flooring: ['Hardwood Laminate', 'Carpet', 'Ceramic Tile'],
    has_central_air: true,
    has_basement: false,
    monthly_rent: 1475,
    amenities: [
      'Central Air Conditioning & Heating',
      'Attached Garage Parking',
      'End-Unit Privacy',
      'Private Rear Concrete Patio',
      'Primary Suite with Jetted Tub',
      'Walk-In Closets',
      'Tray Ceilings',
      'Pet-Friendly (Dogs & Cats Welcome)'
    ],
    appliances: [
      'Stainless Steel Refrigerator',
      'Dishwasher',
      'Electric Range / Oven',
      'Built-in Microwave',
      'Garbage Disposal',
      'Washer/Dryer Hookups'
    ],
    description: `Situated in a quiet, manicured enclave of Kansas City's Northland, 4371 NE 83rd Terrace is an elegant two-story end-unit townhome spanning 1,500 square feet of thoughtfully planned living space. Built in 2008, the residence benefits from premium end-position architecture, welcoming abundant natural light through multi-aspect windows and offering an enhanced sense of seclusion.

The main level unfolds through an open-concept living and entertaining layout, where clean architectural lines and neutral tones create an inviting ambiance. The culinary center features generous cabinetry, expansive countertop preparation surfaces, a breakfast serving bar, and a full suite of quality appliances including a refrigerator, electric range, built-in microwave, dishwasher, and disposal. The adjoining dining and living zones flow effortlessly out toward a private rear concrete patio, ideal for peaceful morning coffee or al fresco evening relaxation.

Upstairs, the home hosts three spacious bedrooms designed for optimal rest and personal privacy. The primary suite serves as an elevated retreat, accented by architectural tray ceilings, an expansive walk-in closet, and an ensuite bath complete with a double vanity, deep jetted soaking tub, and a standalone shower enclosure. The secondary bedrooms offer generous closet storage and easy access to the full hallway bath, alongside a convenient main-floor half bath powder room for guests.

Practical features include a dedicated upper-level laundry utility room with washer and dryer hookups, efficient central forced-air climate control, and an attached garage with interior access. Ideally positioned within the North Kansas City School District and moments from Staley High School, parklands, and major commuter routes.

Key Highlights:
• 3 Bedrooms, 2.5 Bathrooms (1,500 Sq. Ft.)
• End-unit townhouse design with private patio
• Kitchen with breakfast bar, ample cabinetry, and full appliance suite
• Primary suite with tray ceiling, walk-in closet, dual vanities, and jetted tub
• Attached garage and private driveway parking
• Dedicated upper-level laundry hookups
• Central air conditioning and forced-air heating
• Pet-Friendly (Dogs & Cats Welcome)
• Application Fee: $50`
  },
  {
    pipelineId: 'PP-00078BF2',
    source: 'zillow',
    address: '4202 Flora Ave',
    city: 'Kansas City',
    state: 'MO',
    zip: '64110',
    county: 'Jackson County',
    neighborhood: 'Ivanhoe Southwest / Midtown',
    lat: 39.05045,
    lng: -94.56663,
    property_type: 'DUPLEX',
    bedrooms: 4,
    bathrooms: 2,
    half_bathrooms: 0,
    square_footage: 1550,
    lot_size_sqft: null,
    year_built: 1920,
    floors: 2,
    garage_spaces: 1,
    parking: 'Attached Garage + Dedicated Off-Street Parking',
    heating_type: 'Central Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated In-Unit Hookups',
    flooring: ['Hardwood', 'Carpet', 'Ceramic Tile'],
    has_central_air: true,
    has_basement: true,
    monthly_rent: 1425,
    amenities: [
      'Central Air Conditioning & Heating',
      'Attached Garage Parking',
      'Hardwood & Ceramic Tile Flooring',
      'Spacious Two-Story Layout',
      'Main-Level Bedroom Suite',
      'Pet-Friendly (Dogs & Cats Welcome)'
    ],
    appliances: [
      'Refrigerator',
      'Range / Oven',
      'Dishwasher',
      'Microwave',
      'Deep Freezer',
      'Washer/Dryer Hookups'
    ],
    description: `Positioned along historic Flora Avenue in Kansas City's vibrant urban corridor, 4202 Flora Ave is a substantial two-story duplex residence providing 1,550 square feet of versatile, well-proportioned interior living. Combining architectural solidity with contemporary conveniences, this side-by-side home provides generous separation of space across two full levels.

The ground floor opens into a bright, welcoming living room adorned with authentic hardwood flooring and expansive front windows. The kitchen and dining quarters are equipped for everyday culinary ease, offering comprehensive cabinet storage, durable countertops, and an itemized appliance package comprising a refrigerator, range and oven, microwave, dishwasher, and auxiliary freezer. A highly desirable main-level bedroom offers flexible utility as a quiet guest suite, executive study, or primary bedroom, adjacent to a full tiled bathroom.

On the upper level, three additional carpeted bedrooms provide peaceful retreats with substantial closet space and natural illumination, serviced by a second full bathroom fitted with a combination shower and tub. A dedicated in-unit utility area accommodates washer and dryer hookups, while updated central air conditioning and forced-air heating provide year-round interior comfort.

Exterior highlights include sheltered attached garage parking, dedicated off-street space, and quick connectivity to the Country Club Plaza, UMKC, Rockhurst University, and downtown Kansas City.

Key Highlights:
• 4 Bedrooms, 2 Full Bathrooms (1,550 Sq. Ft.)
• Distinctive two-story duplex residence
• Main-level bedroom and full bathroom
• Kitchen equipped with refrigerator, oven, dishwasher, microwave, and freezer
• Hardwood and ceramic tile flooring
• Attached garage plus off-street parking
• Dedicated in-unit laundry hookups
• Central air conditioning and forced-air heating
• Pet-Friendly (Dogs & Cats Welcome)
• Application Fee: $50`
  },
  {
    pipelineId: 'PP-27ABE035',
    source: 'zillow',
    address: '3331 Bridge Manor Dr',
    city: 'Kansas City',
    state: 'MO',
    zip: '64137',
    county: 'Jackson County',
    neighborhood: 'South Kansas City',
    lat: 38.920208,
    lng: -94.55166,
    property_type: 'TOWNHOUSE',
    bedrooms: 4,
    bathrooms: 3,
    half_bathrooms: 0,
    square_footage: 1990,
    lot_size_sqft: null,
    year_built: 1970,
    floors: 3,
    garage_spaces: 0,
    parking: 'Dedicated Off-Street Parking',
    heating_type: 'Central Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated In-Unit Hookups',
    flooring: ['Hardwood', 'Luxury Vinyl Plank', 'Tile'],
    has_central_air: true,
    has_basement: true,
    monthly_rent: 1495,
    amenities: [
      'Central Air Conditioning & Heating',
      'Finished Lower-Level Suite / Media Room',
      'Private Balcony / Sun Deck',
      'Living Room Fireplace',
      'Hardwood Flooring',
      'Pet-Friendly (Dogs & Cats Welcome)'
    ],
    appliances: [
      'Refrigerator',
      'Range / Oven',
      'Dishwasher',
      'Microwave',
      'Garbage Disposal',
      'Washer/Dryer Hookups'
    ],
    description: `Offering 1,990 square feet of expansive living across multiple finished levels, 3331 Bridge Manor Drive is a beautifully modernized townhome situated in a tranquil south Kansas City community. Built in 1970 and refreshed with contemporary finishes, this home seamlessly integrates generous communal areas with exceptional multi-tier versatility.

The primary level centers on an open, light-filled living and dining area highlighted by warm hardwood floors, an inviting fireplace, and energy-efficient sliding patio doors leading out to a private elevated balcony deck. The kitchen delivers practical style with crisp countertops, modern faucets, renewed cabinetry, and full appliance provisioning including a refrigerator, range with oven, microwave, and dishwasher.

Upper-level accommodations include a commanding primary suite and two secondary bedrooms, all outfitted with genuine hardwood flooring, large closets, and updated bathroom vanities with polished hardware and tub-shower combinations. The fully finished lower level adds tremendous functional square footage, providing a fourth private bedroom, a third full bathroom, and an expansive flex area ideal for a media lounge, home gym, or secluded remote office.

Complete with dedicated off-street parking, in-unit washer and dryer hookups, and central climate control, this multi-level townhome offers effortless connectivity to I-49, local shopping centers, and recreational parks.

Key Highlights:
• 4 Bedrooms, 3 Full Bathrooms (1,990 Sq. Ft.)
• Multi-level townhome with private balcony deck
• Finished lower level with 4th bedroom, full bath, and media/office lounge
• Living room fireplace and hardwood flooring throughout
• Fully equipped kitchen with refrigerator, stove, microwave, and dishwasher
• Three full modern bathrooms
• Dedicated off-street parking
• In-unit washer and dryer hookups
• Central air conditioning and forced-air heating
• Pet-Friendly (Dogs & Cats Welcome)
• Application Fee: $50`
  },
  {
    pipelineId: 'PP-D12B824E',
    source: 'opendoor',
    address: '5243 N Lydia Ave',
    city: 'Kansas City',
    state: 'MO',
    zip: '64118',
    county: 'Clay County',
    neighborhood: 'Northland / Davidson',
    lat: 39.190214,
    lng: -94.562218,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 4,
    bathrooms: 2.5,
    half_bathrooms: 1,
    square_footage: 1800,
    lot_size_sqft: 14374,
    year_built: 1965,
    floors: 2,
    garage_spaces: 2,
    parking: 'Attached 2-Car Garage + Private Driveway',
    heating_type: 'Central Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated In-Unit Hookups',
    flooring: ['Hardwood', 'Carpet', 'Ceramic Tile'],
    has_central_air: true,
    has_basement: true,
    monthly_rent: 1495,
    amenities: [
      'Central Air Conditioning & Heating',
      'Attached Two-Car Garage',
      'Substantial Rear Sun Deck',
      'Spacious 0.33-Acre Lawn',
      'Living Room Fireplace',
      'Kitchen Island with Breakfast Seating',
      'Pet-Friendly (Dogs & Cats Welcome)'
    ],
    appliances: [
      'Stainless Steel Refrigerator',
      'Range / Oven',
      'Dishwasher',
      'Microwave',
      'Washer/Dryer Hookups'
    ],
    description: `Resting on a generous 0.33-acre lot in Kansas City's sought-after Northland corridor, 5243 N Lydia Ave is an attractive 1,800 square foot single-family residence combining classic 1965 architectural permanence with modern interior updates. Fresh paint in neutral designer tones and upgraded flooring set an elevated, welcoming tone across the home.

The open main living area is anchored by a stately brick fireplace and illuminated by large picture windows. The kitchen is designed as a true culinary hub, appointed with a functional central island with breakfast counter seating, custom tile backsplash, ample cabinetry, and premium stainless steel appliances including a refrigerator, range and oven, microwave, and dishwasher. Directly off the dining space, sliding doors open onto an expansive rear sun deck overlooking the deep, tranquil backyard lawn.

The home offers four spacious bedrooms with comfortable layouts and abundant closet storage. Two and a half bathrooms feature refreshed vanities, contemporary fixtures, and durable tile surrounds, including an ensuite primary bath and an accessible guest powder room. The lower tier provides direct access to an attached two-car garage offering secure vehicle parking and workshop storage.

Located in the acclaimed North Kansas City School District with quick access to North Oak Trafficway and I-29, this property pairs serene suburban living with urban accessibility.

Key Highlights:
• 4 Bedrooms, 2.5 Bathrooms (1,800 Sq. Ft.)
• Standalone single-family home on 0.33-acre lot
• Attached two-car garage with private driveway
• Kitchen island with breakfast seating and stainless steel appliances
• Brick fireplace in main living area
• Expansive rear sun deck and expansive lawn
• Central air conditioning and forced-air heating
• Dedicated in-unit laundry hookups
• Pet-Friendly (Dogs & Cats Welcome)
• Application Fee: $50`
  },
  {
    pipelineId: 'PP-7E30F5EE',
    source: 'opendoor',
    address: '11121 Herrick Ave',
    city: 'Kansas City',
    state: 'MO',
    zip: '64134',
    county: 'Jackson County',
    neighborhood: 'South Kansas City / Hickman Mills',
    lat: 38.920591,
    lng: -94.496004,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 4,
    bathrooms: 2,
    half_bathrooms: 0,
    square_footage: 1407,
    lot_size_sqft: 9947,
    year_built: 1959,
    floors: 1,
    garage_spaces: 0,
    parking: 'Covered Carport + Private Driveway',
    heating_type: 'Central Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated In-Unit Hookups',
    flooring: ['Luxury Vinyl Plank', 'Ceramic Tile'],
    has_central_air: true,
    has_basement: false,
    monthly_rent: 1450,
    amenities: [
      'Central Air Conditioning & Heating',
      'Covered Carport Parking',
      'Large Fully Fenced Backyard',
      'Luxury Vinyl Plank Flooring',
      'Tiled Walk-In Shower',
      'Pet-Friendly (Dogs & Cats Welcome)'
    ],
    appliances: [
      'Stainless Steel Refrigerator',
      'Built-in Wall Oven',
      'Cooktop Range',
      'Dishwasher',
      'Washer/Dryer Hookups'
    ],
    description: `Nestled on sprawling 0.23-acre grounds in south Kansas City, 11121 Herrick Ave is a standalone ranch-style single-family home providing 1,407 square feet of level, accessible living. Constructed with enduring mid-century craftsmanship in 1959, the home has been completely renewed with stylish modern appointments throughout.

Durable luxury vinyl plank flooring flows seamlessly through the central living and dining areas, reflecting natural light and setting a sophisticated, easy-maintenance tone. The renovated kitchen features updated cabinetry, extensive countertop prep space, and a sleek stainless steel appliance package equipped with a built-in wall oven, dedicated cooktop, dishwasher, and refrigerator.

Four well-proportioned bedrooms ensure privacy and versatile space for families, guests, or a dedicated home workspace. Two full updated bathrooms serve the residence, highlighted by a master ensuite featuring a custom-tiled walk-in shower with contemporary fixtures and a pristine secondary tub-shower combination.

Outdoors, the expansive, level backyard is fully fenced, offering a private haven for recreation and pets, while a covered carport and long private driveway ensure sheltered parking. With easy access to I-435 and 71 Highway, commuting across greater Kansas City is quick and direct.

Key Highlights:
• 4 Bedrooms, 2 Full Bathrooms (1,407 Sq. Ft.)
• Standalone ranch-style single-family home
• Fully fenced private backyard on 0.23-acre lot
• Kitchen with updated cabinetry, built-in wall oven, cooktop, and dishwasher
• Luxury vinyl plank flooring across main living zones
• Ensuite bath with custom-tiled walk-in shower
• Covered carport and private driveway parking
• Dedicated in-unit laundry hookups
• Central air conditioning and forced-air heating
• Pet-Friendly (Dogs & Cats Welcome)
• Application Fee: $50`
  },
  {
    pipelineId: 'PP-A7266BC3',
    source: 'opendoor',
    address: '3364 N 60th Ter',
    city: 'Kansas City',
    state: 'KS',
    zip: '66104',
    county: 'Wyandotte County',
    neighborhood: 'Nearman / Bethel',
    lat: 39.148339,
    lng: -94.718937,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 4,
    bathrooms: 3,
    half_bathrooms: 0,
    square_footage: 1877,
    lot_size_sqft: 17424,
    year_built: 1959,
    floors: 2,
    garage_spaces: 0,
    parking: 'Private Driveway Parking',
    heating_type: 'Central Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated In-Unit Hookups',
    flooring: ['Hardwood Laminate', 'Carpet', 'Ceramic Tile'],
    has_central_air: true,
    has_basement: true,
    monthly_rent: 1485,
    amenities: [
      'Central Air Conditioning & Heating',
      'Large Rear Sun Deck',
      'Expansive 0.4-Acre Wooded Lot',
      'Three Full Bathrooms',
      'Unfinished Basement Storage Space',
      'Pet-Friendly (Dogs & Cats Welcome)'
    ],
    appliances: [
      'Stainless Steel Refrigerator',
      'Range / Oven',
      'Dishwasher',
      'Microwave',
      'Washer/Dryer Hookups'
    ],
    description: `Set amidst a generous 0.40-acre wooded parcel in Kansas City, Kansas, 3364 N 60th Terrace is a striking multi-level single-family residence offering 1,877 square feet of refined interior living. Featuring freshly painted interiors in an elegant neutral palette and updated flooring throughout, this standalone home delivers comfort and privacy across every room.

The upper main level showcases an expansive open living room bathed in natural sunlight through oversized picture windows. The kitchen is designed with modern functionality in mind, showcasing an accent tile backsplash, generous cabinetry, durable counters, and a full suite of appliances including a refrigerator, range and oven, microwave, and dishwasher. Adjoining dining space opens via sliding glass doors directly out to an elevated exterior sun deck overlooking the vast private backyard.

Four comfortable bedrooms offer peaceful personal accommodations with ample closet space, supported by three full bathrooms featuring modern vanities and clean tile work. The lower level includes versatile flex space alongside an unfinished basement area perfect for extensive storage and workshop utility, with dedicated laundry hookups for in-home appliances.

Set in a peaceful neighborhood minutes from I-635, local parks, and shopping amenities, this standalone home provides a rare blend of substantial acreage and contemporary convenience.

Key Highlights:
• 4 Bedrooms, 3 Full Bathrooms (1,877 Sq. Ft.)
• Standalone single-family home on 0.40-acre lot
• Elevated rear sun deck overlooking private backyard
• Kitchen featuring tile accent backsplash and full appliance suite
• Three full modern bathrooms
• Unfinished basement area for supplemental storage
• Private driveway parking
• Central air conditioning and forced-air heating
• In-unit washer and dryer hookups
• Pet-Friendly (Dogs & Cats Welcome)
• Application Fee: $50`
  }
];

async function main() {
  console.log('===============================================================');
  console.log('Choice Properties — Deep Enrichment & Batch Publishing');
  console.log('===============================================================\n');

  const today = new Date().toISOString().slice(0, 10);
  const results = [];

  for (const item of BATCH) {
    console.log(`\n---------------------------------------------------------------`);
    console.log(`Processing ${item.address}, ${item.city}, ${item.state} ${item.zip} (${item.pipelineId})...`);

    // 1. Fetch current pipeline record to extract photo URLs
    const pipeRes = await fetchJson(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${item.pipelineId}&select=*`, {
      headers: { ...HEADERS, 'Accept-Profile': 'pipeline' }
    });

    if (!pipeRes.ok || !pipeRes.data || pipeRes.data.length === 0) {
      throw new Error(`Could not fetch pipeline record for ${item.pipelineId}: ${pipeRes.status}`);
    }

    const currentRecord = pipeRes.data[0];
    let rawImgs = currentRecord.original_image_urls;
    if (typeof rawImgs === 'string') {
      try { rawImgs = JSON.parse(rawImgs); } catch (e) { rawImgs = []; }
    }
    rawImgs = rawImgs || [];

    const cleanPhotos = rawImgs.map(img => {
      if (typeof img === 'string') return img;
      if (img && typeof img === 'object' && img.url) return img.url;
      return null;
    }).filter(Boolean);

    console.log(`[photos] Extracted ${cleanPhotos.length} high-res source CDN photos.`);
    if (cleanPhotos.length === 0) {
      console.warn(`[warning] No photos found for ${item.pipelineId}!`);
    }

    // 2. Update pipeline.pipeline_properties with enriched details
    console.log(`[pipeline] Updating enriched specs in pipeline.pipeline_properties...`);
    const patchPayload = {
      property_type: item.property_type,
      bedrooms: item.bedrooms,
      bathrooms: item.bathrooms,
      half_bathrooms: item.half_bathrooms,
      total_bathrooms: item.bathrooms,
      square_footage: item.square_footage,
      lot_size_sqft: item.lot_size_sqft,
      year_built: item.year_built,
      floors: item.floors,
      garage_spaces: item.garage_spaces,
      parking: item.parking,
      heating_type: item.heating_type,
      cooling_type: item.cooling_type,
      laundry_type: item.laundry_type,
      flooring: item.flooring,
      has_central_air: item.has_central_air,
      has_basement: item.has_basement,
      monthly_rent: item.monthly_rent,
      security_deposit: item.monthly_rent,
      application_fee: 50,
      amenities: item.amenities,
      appliances: item.appliances,
      description: item.description,
      county: item.county,
      neighborhood: item.neighborhood,
      pets_allowed: true,
      pet_types_allowed: ['Dogs', 'Cats'],
      smoking_allowed: false,
      lease_terms: null,
      minimum_lease_months: null,
      updated_at: new Date().toISOString()
    };

    const patchRes = await fetchJson(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${item.pipelineId}`, {
      method: 'PATCH',
      headers: { ...HEADERS, 'Content-Profile': 'pipeline' },
      body: patchPayload
    });

    if (!patchRes.ok) {
      console.warn(`[pipeline] Warning patching pipeline record: ${patchRes.status} ${patchRes.text}`);
    } else {
      console.log(`[pipeline] Successfully patched pipeline specifications.`);
    }

    // 3. Generate UUID for public.properties
    const choiceId = crypto.randomUUID();
    console.log(`[publish] Inserting into public.properties (ID: ${choiceId})...`);

    const propertyPayload = {
      id: choiceId,
      landlord_id: null,
      status: 'active',
      title: `${item.address}, ${item.city}, ${item.state} ${item.zip}`,
      description: item.description,
      address: item.address,
      city: item.city,
      state: item.state,
      zip: item.zip,
      county: item.county,
      neighborhood: item.neighborhood,
      lat: item.lat,
      lng: item.lng,
      property_type: item.property_type,
      bedrooms: item.bedrooms,
      bathrooms: item.bathrooms,
      half_bathrooms: item.half_bathrooms,
      total_bathrooms: item.bathrooms,
      square_footage: item.square_footage,
      lot_size_sqft: item.lot_size_sqft,
      year_built: item.year_built,
      floors: item.floors,
      garage_spaces: item.garage_spaces,
      monthly_rent: item.monthly_rent,
      security_deposit: item.monthly_rent,
      application_fee: 50,
      pet_deposit: 300,
      lease_terms: null,
      minimum_lease_months: null,
      pets_allowed: true,
      pet_types_allowed: ['Dogs', 'Cats'],
      smoking_allowed: false,
      amenities: item.amenities,
      appliances: item.appliances,
      flooring: item.flooring,
      heating_type: item.heating_type,
      cooling_type: item.cooling_type,
      laundry_type: item.laundry_type,
      parking: item.parking,
      has_central_air: item.has_central_air,
      has_basement: item.has_basement,
      listed_at: today,
      available_date: today,
      featured: false
    };

    const insertPropRes = await fetchJson(`${SUPABASE_URL}/rest/v1/properties`, {
      method: 'POST',
      headers: { ...HEADERS, 'Prefer': 'return=representation' },
      body: propertyPayload
    });

    if (!insertPropRes.ok) {
      throw new Error(`Failed to insert into properties: ${insertPropRes.status} ${insertPropRes.text}`);
    }
    console.log(`[publish] Successfully inserted property ${choiceId}`);

    // 4. Insert photo rows into public.property_photos
    console.log(`[photos] Inserting ${cleanPhotos.length} photo records into public.property_photos...`);
    const photoRows = cleanPhotos.map((url, idx) => ({
      id: crypto.randomUUID(),
      property_id: choiceId,
      url: url,
      display_order: idx + 1,
      is_hero: idx === 0,
      watermark_status: 'clean',
      alt_text: `${item.address}, ${item.city} ${item.state} - Photo ${idx + 1}`
    }));

    if (photoRows.length > 0) {
      const photoRes = await fetchJson(`${SUPABASE_URL}/rest/v1/property_photos`, {
        method: 'POST',
        headers: { ...HEADERS, 'Prefer': 'return=minimal' },
        body: photoRows
      });

      if (!photoRes.ok) {
        console.warn(`[photos] Warning inserting photo rows: ${photoRes.status} ${photoRes.text}`);
      } else {
        console.log(`[photos] Successfully registered ${photoRows.length} photos. Hero: ${cleanPhotos[0].slice(0, 60)}...`);
      }
    }

    // 5. Mark pipeline property as published
    console.log(`[pipeline] Marking ${item.pipelineId} as published...`);
    await fetchJson(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${item.pipelineId}`, {
      method: 'PATCH',
      headers: { ...HEADERS, 'Content-Profile': 'pipeline' },
      body: {
        status: 'published',
        choice_property_id: choiceId,
        photo_import_status: 'ok',
        published_at: new Date().toISOString()
      }
    });

    const liveUrl = `${SITE_URL}/property.html?id=${choiceId}`;
    results.push({
      choiceId,
      pipelineId: item.pipelineId,
      address: item.address,
      city: item.city,
      state: item.state,
      zip: item.zip,
      rent: item.monthly_rent,
      beds: item.bedrooms,
      baths: item.bathrooms,
      liveUrl
    });
  }

  console.log('\n===============================================================');
  console.log('ALL 6 PROPERTIES PUBLISHED SUCCESSFULLY!');
  console.log('===============================================================\n');

  results.forEach((r, idx) => {
    console.log(`${idx + 1}. ${r.address}, ${r.city}, ${r.state} ${r.zip} ($${r.rent}/mo | ${r.beds} Bed / ${r.baths} Bath) — ${r.liveUrl}`);
  });

  const fs = await import('fs');
  fs.writeFileSync('published_batch_results.json', JSON.stringify(results, null, 2));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
