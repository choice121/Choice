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
    pipelineId: 'PP-6B29E289',
    address: '2426 NW 11th St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73107',
    county: 'Oklahoma County',
    neighborhood: 'Plaza District Corridor',
    lat: 35.4795,
    lng: -97.5562,
    property_type: 'DUPLEX',
    bedrooms: 1,
    bathrooms: 1,
    half_bathrooms: 0,
    square_footage: 680,
    lot_size_sqft: null,
    year_built: 1926,
    floors: 1,
    garage_spaces: 0,
    parking: 'Dedicated Off-Street Parking',
    heating_type: 'Central Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer and Dryer Included',
    has_central_air: true,
    has_basement: false,
    monthly_rent: 675,
    flooring: ['Hardwood Laminate', 'Ceramic Tile'],
    amenities: [
      'Central Air Conditioning & Heating',
      'In-Unit Washer & Dryer Included',
      'Renovated Interior Finishes',
      'Dedicated Off-Street Parking',
      'Pet-Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Washer', 'Dryer'],
    description: `Offering convenient single-level living in Oklahoma City's vibrant west-central district, 2426 NW 11th St is an updated 1-bedroom, 1-bathroom duplex home spanning 680 square feet. Built with 1920s architectural charm and enhanced with modern finishes, the residence provides an efficient, light-filled layout with clean flooring throughout the primary gathering spaces.

The kitchen is equipped with durable countertops, clean cabinetry, and an appliance inventory that includes a refrigerator, range with oven, dishwasher, and an in-home washer and dryer. The private bedroom features comfortable accommodations and built-in closet storage, accompanied by a full bathroom with updated fixtures.

Key Highlights:
• 1 Bedroom, 1 Full Bathroom (680 Sq. Ft.)
• Single-level duplex floor plan
• Kitchen equipped with refrigerator, oven, and dishwasher
• In-unit washer and dryer included
• Dedicated off-street parking
• Central air conditioning and forced-air heating
• Pet-Friendly (Dogs & Cats Welcome)
• Application Fee: $50`
  },
  {
    pipelineId: 'PP-D35FB19F',
    address: '215 SE 38th St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73129',
    county: 'Oklahoma County',
    neighborhood: 'Capitol Hill / Southeast OKC',
    lat: 35.4291,
    lng: -97.5098,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 1,
    bathrooms: 1,
    half_bathrooms: 0,
    square_footage: 600,
    lot_size_sqft: 5000,
    year_built: 1920,
    floors: 1,
    garage_spaces: 0,
    parking: 'Private Driveway Parking',
    heating_type: 'Central Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated In-Unit Hookups',
    has_central_air: true,
    has_basement: false,
    monthly_rent: 650,
    flooring: ['New Modern Plank Flooring', 'Ceramic Tile'],
    amenities: [
      'Standalone Single-Family Privacy',
      '5-Burner Gas Range',
      'Fresh Interior Paint & New Flooring',
      'Private Driveway Parking',
      'Pet-Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Refrigerator', '5-Burner Gas Range / Oven', 'Washer/Dryer Hookups'],
    description: `Featuring a fresh interior remodel from top to bottom, 215 SE 38th St is a detached 1-bedroom, 1-bathroom single-family cottage offering 600 square feet of private, comfortable living. The home welcomes you with fresh paint in neutral tones and brand-new wood-look plank flooring across the open gathering room.

The kitchen is equipped with updated fixtures, extensive cabinetry, and reliable culinary appliances including a premium 5-burner gas range and refrigerator. The bedroom provides a peaceful retreat with built-in storage, serviced by a full updated bathroom with clean tile surrounds.

Outside, a private driveway ensures dedicated off-street parking on a quiet residential parcel situated near Capitol Hill and local community parks.

Key Highlights:
• 1 Bedroom, 1 Full Bathroom (600 Sq. Ft.)
• Standalone single-family cottage
• Kitchen with updated fixtures, 5-burner gas range, and refrigerator
• Fresh interior paint and new plank flooring
• Private driveway parking
• Central air conditioning and forced-air heating
• In-unit laundry hookups
• Pet-Friendly (Dogs & Cats Welcome)
• Application Fee: $50`
  },
  {
    pipelineId: 'PP-BA61908F',
    address: '2522 W Park Pl',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73107',
    county: 'Oklahoma County',
    neighborhood: 'Plaza Court / West Park',
    lat: 35.4812,
    lng: -97.5612,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 1,
    bathrooms: 1,
    half_bathrooms: 0,
    square_footage: 911,
    lot_size_sqft: 6200,
    year_built: 1935,
    floors: 1,
    garage_spaces: 0,
    parking: 'Dedicated Off-Street Parking',
    heating_type: 'Central Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated In-Unit Hookups',
    has_central_air: true,
    has_basement: false,
    monthly_rent: 680,
    flooring: ['Hardwood', 'Ceramic Tile'],
    amenities: [
      'Generous 911 Sq. Ft. Floor Plan',
      'Central Air Conditioning & Heating',
      'Dedicated Off-Street Parking',
      'Quick Commuter Access to I-40 & I-44',
      'Pet-Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Washer/Dryer Hookups'],
    description: `Providing an expansive 911 square feet of interior space, 2522 W Park Pl is an oversized 1-bedroom, 1-bathroom standalone single-family home in central Oklahoma City. The residence offers generous room dimensions throughout, beginning with a wide living room filled with natural sunlight through multiple front windows.

The kitchen delivers substantial preparation counter space and storage, appointed with a range and oven, refrigerator, and convenient access to in-unit laundry hookups. The large private bedroom accommodates full bedroom furnishings with ample closet space, supported by a full bathroom.

Conveniently located with rapid highway access to both I-40 and I-44, this home places you minutes from downtown Oklahoma City, Paycom Center, and the OU Medical Center.

Key Highlights:
• 1 Bedroom, 1 Full Bathroom (911 Sq. Ft.)
• Standalone single-family residence with generous square footage
• Kitchen equipped with range, oven, and refrigerator
• Dedicated off-street parking
• Central air conditioning and forced-air heating
• In-unit washer and dryer hookups
• Pet-Friendly (Dogs & Cats Welcome)
• Application Fee: $50`
  },
  {
    pipelineId: 'PP-E32649E2',
    address: '1128 NW 11th St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73106',
    county: 'Oklahoma County',
    neighborhood: 'Midtown / Plaza Edge',
    lat: 35.4798,
    lng: -97.5312,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 1,
    bathrooms: 1,
    half_bathrooms: 0,
    square_footage: 400,
    lot_size_sqft: 4000,
    year_built: 1930,
    floors: 1,
    garage_spaces: 0,
    parking: 'Dedicated Off-Street Parking',
    heating_type: 'Central Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated In-Unit Hookups',
    has_central_air: true,
    has_basement: false,
    monthly_rent: 640,
    flooring: ['Luxury Vinyl Plank', 'Tile'],
    amenities: [
      'Renovated Urban Cottage',
      'Central Air Conditioning',
      'Prime Midtown Corridor Location',
      'Dedicated Off-Street Parking',
      'Pet-Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Washer/Dryer Hookups'],
    description: `Tastefully renovated and situated in an ultra-convenient urban setting, 1128 NW 11th St is a charming 1-bedroom, 1-bathroom standalone cottage offering 400 square feet of low-maintenance living. The home features clean modern flooring and fresh neutral paint across an efficient, open-concept floor plan.

The kitchen provides solid prep counters, updated cabinet storage, a range with oven, and refrigerator, paired with in-unit laundry hookups. A comfortable private bedroom and clean full bathroom complete the interior. Located moments from Midtown dining, Plaza District cafes, and local neighborhood entertainment.

Key Highlights:
• 1 Bedroom, 1 Full Bathroom (400 Sq. Ft.)
• Renovated standalone urban cottage
• Kitchen equipped with range and refrigerator
• Dedicated off-street parking
• Central air conditioning and forced-air heating
• In-unit washer and dryer hookups
• Pet-Friendly (Dogs & Cats Welcome)
• Application Fee: $50`
  },
  {
    pipelineId: 'PP-26211A91',
    address: '2935 NW 21st St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73107',
    county: 'Oklahoma County',
    neighborhood: 'Crestwood / Northwest OKC',
    lat: 35.4912,
    lng: -97.5714,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 1,
    bathrooms: 1,
    half_bathrooms: 0,
    square_footage: 540,
    lot_size_sqft: 5500,
    year_built: 1938,
    floors: 1,
    garage_spaces: 0,
    parking: 'Dedicated Off-Street Parking',
    heating_type: 'Baseboard Heat',
    cooling_type: 'Air Conditioner Unit',
    laundry_type: 'Dedicated In-Unit Hookups',
    has_central_air: false,
    has_basement: false,
    monthly_rent: 660,
    flooring: ['Hardwood Laminate', 'Vinyl'],
    amenities: [
      'Standalone Single-Family Privacy',
      'Private Yard Space',
      'Appliance Package Included',
      'Quiet Residential Enclave',
      'Pet-Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Freezer'],
    description: `Set on a residential parcel in northwest Oklahoma City, 2935 NW 21st St is a 540 square foot single-family home offering quiet privacy and straightforward functionality. The living space connects smoothly to the kitchen, which is furnished with cabinet storage, a range with oven, refrigerator, and freezer.

The bedroom offers quiet personal space with built-in closet utility, serviced by a full central bathroom. Outside, a private designated yard area provides manageable outdoor space, supported by dedicated off-street parking.

Key Highlights:
• 1 Bedroom, 1 Full Bathroom (540 Sq. Ft.)
• Standalone single-family cottage
• Kitchen equipped with range, oven, and refrigerator
• Dedicated off-street parking
• Private designated yard space
• Heating and air conditioning
• Pet-Friendly (Dogs & Cats Welcome)
• Application Fee: $50`
  },
  {
    pipelineId: 'PP-1FB4A218',
    address: '504 NW 45th St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73118',
    county: 'Oklahoma County',
    neighborhood: 'Crown Heights / Edgemere Park',
    lat: 35.5178,
    lng: -97.5214,
    property_type: 'APARTMENT',
    bedrooms: 1,
    bathrooms: 1,
    half_bathrooms: 0,
    square_footage: 700,
    lot_size_sqft: null,
    year_built: 1940,
    floors: 2,
    garage_spaces: 0,
    parking: 'On-Site Assigned Parking',
    heating_type: 'Central Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer and Dryer Included',
    has_central_air: true,
    has_basement: false,
    monthly_rent: 695,
    flooring: ['Hardwood Floors', 'Ceramic Tile'],
    amenities: [
      'Overlooks Scenic Parklands',
      'In-Unit Washer & Dryer Included',
      'Central Air Conditioning & Heating',
      'Downstairs Bonus Utility Area',
      'On-Site Dedicated Parking',
      'Pet-Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Washer', 'Dryer'],
    description: `Overlooking scenic neighborhood park grounds in historic Crown Heights, 504 NW 45th St is a distinctive 700 square foot apartment home blending architectural character with contemporary conveniences. Authentic hardwood flooring extends across the primary living room, which captures direct parkland vistas and tree-lined views.

The kitchen is equipped with solid prep countertops, ample cabinetry, a refrigerator, range with oven, and dishwasher. A downstairs bonus utility room houses a dedicated in-unit washer and dryer. The private bedroom features restful proportions and closet storage, accompanied by an updated full bathroom with clean tile surrounds.

Key Highlights:
• 1 Bedroom, 1 Full Bathroom (700 Sq. Ft.)
• Distinctive parkside apartment residence
• Direct views of nearby green parklands
• Kitchen equipped with refrigerator, oven, and dishwasher
• In-unit washer and dryer in downstairs bonus area
• Central air conditioning and forced-air heating
• On-site dedicated parking
• Pet-Friendly (Dogs & Cats Welcome)
• Application Fee: $50`
  },
  {
    pipelineId: 'PP-0C716A14',
    address: '2819 SW 33rd St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73119',
    county: 'Oklahoma County',
    neighborhood: 'Southwest OKC / Hillcrest',
    lat: 35.4341,
    lng: -97.5678,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 1,
    bathrooms: 1,
    half_bathrooms: 0,
    square_footage: 550,
    lot_size_sqft: 5000,
    year_built: 1945,
    floors: 1,
    garage_spaces: 0,
    parking: 'Off-Street Driveway Parking',
    heating_type: 'Forced Air Heat',
    cooling_type: 'Air Conditioner Unit',
    laundry_type: 'Dedicated In-Unit Hookups',
    has_central_air: false,
    has_basement: false,
    monthly_rent: 625,
    flooring: ['Wood-Look Plank', 'Vinyl'],
    amenities: [
      'Standalone Single-Family Home',
      'Manageable Yard Space',
      'Off-Street Driveway Parking',
      'Gas Range Cooking',
      'Pet-Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Refrigerator', 'Gas Range / Stove'],
    description: `2819 SW 33rd St is a cozy 1-bedroom, 1-bathroom standalone cottage offering 550 square feet of level, accessible living in southwest Oklahoma City. The efficient layout centers around a bright front living room that connects directly with the kitchen.

The kitchen is equipped with cabinet storage, a gas range and stove, and refrigerator. The bedroom provides peaceful personal quarters with closet space, served by a full bathroom. Outside, a private yard area and dedicated driveway parking provide daily ease.

Key Highlights:
• 1 Bedroom, 1 Full Bathroom (550 Sq. Ft.)
• Standalone single-family cottage
• Kitchen equipped with gas stove and refrigerator
• Off-street driveway parking
• Private outdoor yard space
• Heating and cooling installed
• Pet-Friendly (Dogs & Cats Welcome)
• Application Fee: $50`
  },
  {
    pipelineId: 'PP-E4EDA7CE',
    address: '814.5 East Dr',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73105',
    county: 'Oklahoma County',
    neighborhood: 'OU Medical / State Capitol District',
    lat: 35.4789,
    lng: -97.4987,
    property_type: 'APARTMENT',
    bedrooms: 1,
    bathrooms: 1,
    half_bathrooms: 0,
    square_footage: 900,
    lot_size_sqft: null,
    year_built: 1950,
    floors: 2,
    garage_spaces: 0,
    parking: 'Dedicated Off-Street Parking',
    heating_type: 'Central Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated In-Unit Hookups',
    has_central_air: true,
    has_basement: false,
    monthly_rent: 650,
    flooring: ['Authentic Brick Paver Flooring', 'Tile'],
    amenities: [
      'Authentic Brick Paver Flooring',
      'Private Outdoor Morning Balcony',
      'Oversized 900 Sq. Ft. Floor Plan',
      'OU Health Science Center Corridor',
      'Pet-Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Refrigerator', 'Range / Stove', 'Dishwasher', 'Washer/Dryer Hookups'],
    description: `Featuring a generous 900 square feet of oversized living space, 814.5 East Dr is a distinctive 1-bedroom, 1-bathroom apartment home situated in Oklahoma City's State Capitol and OU Health Sciences corridor. The central living room is distinguished by handsome authentic brick paver flooring that infuses the interior with rich architectural warmth.

The culinary space provides generous counter surfaces, white cabinetry, a dishwasher, refrigerator, and range with stove. A private outdoor balcony offers a pleasant perch for morning coffee or fresh evening air. The spacious bedroom accommodates substantial furniture suites with closet storage, serviced by a full modern bathroom.

Key Highlights:
• 1 Bedroom, 1 Full Bathroom (900 Sq. Ft.)
• Oversized apartment floor plan
• Beautiful brick paver flooring in living room
• Private outdoor morning balcony
• Kitchen equipped with refrigerator, stove, and dishwasher
• Dedicated off-street parking
• Central air conditioning and forced-air heating
• In-unit laundry hookups
• Pet-Friendly (Dogs & Cats Welcome)
• Application Fee: $50`
  },
  {
    pipelineId: 'PP-BCDB68A0',
    address: '125 NW 25th St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73103',
    county: 'Oklahoma County',
    neighborhood: 'Historic Jefferson Park / Paseo Edge',
    lat: 35.4945,
    lng: -97.5165,
    property_type: 'APARTMENT',
    bedrooms: 1,
    bathrooms: 1,
    half_bathrooms: 0,
    square_footage: 650,
    lot_size_sqft: null,
    year_built: 1920,
    floors: 1,
    garage_spaces: 0,
    parking: 'Dedicated Off-Street Parking',
    heating_type: 'Central Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'On-Site Laundry Facilities & Hookups',
    has_central_air: true,
    has_basement: false,
    monthly_rent: 690,
    flooring: ['Restored Hardwood Flooring', 'Ceramic Tile'],
    amenities: [
      'High-End Granite Countertops',
      'Subway Tile Backsplash & New Shaker Cabinets',
      'Restored Original Hardwood Flooring',
      'Walk-In Closet',
      'Prime Jefferson Park & Paseo District Location',
      'Pet-Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Stainless Steel Refrigerator', 'Stainless Steel Range / Oven', 'Dishwasher', 'Microwave', 'Garbage Disposal'],
    description: `Completely remodeled with high-end designer finishes, 125 NW 25th St is an exquisite 1-bedroom, 1-bathroom residence set in Oklahoma City's historic Jefferson Park neighborhood, just minutes from the Paseo Arts District and Uptown 23rd. The home showcases gleaming restored hardwood flooring, high ceilings, and fresh interior paint.

The newly remodeled kitchen is a standout culinary space, featuring crisp white shaker cabinetry, polished granite countertops, classic subway tile backsplash, and a full stainless steel appliance package including a refrigerator, range with oven, built-in microwave, dishwasher, and disposal. The bedroom includes an expansive walk-in closet, complemented by a pristine tiled bathroom.

Key Highlights:
• 1 Bedroom, 1 Full Bathroom (650 Sq. Ft.)
• Remodeled kitchen with granite counters and subway tile backsplash
• Stainless steel appliances (refrigerator, range, microwave, dishwasher)
• Restored original hardwood flooring throughout
• Spacious walk-in closet
• Dedicated off-street parking and on-site laundry
• Central air conditioning and forced-air heating
• Pet-Friendly (Dogs & Cats Welcome)
• Application Fee: $50`
  }
];

async function main() {
  console.log('===============================================================');
  console.log('Choice Properties — OKC Batch Enrichment & Publishing');
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

    // 2. Update pipeline.pipeline_properties with enriched details
    console.log(`[pipeline] Updating enriched specs in pipeline.pipeline_properties...`);
    const patchPayload = {
      property_type: item.property_type,
      bedrooms: item.bedrooms,
      bathrooms: item.bathrooms,
      half_bathrooms: item.half_bathrooms,
      total_bathrooms: Math.ceil(item.bathrooms),
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
      total_bathrooms: Math.ceil(item.bathrooms),
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
        console.log(`[photos] Successfully registered ${photoRows.length} photos.`);
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
  console.log('ALL 9 OKC PROPERTIES PUBLISHED SUCCESSFULLY!');
  console.log('===============================================================\n');

  results.forEach((r, idx) => {
    console.log(`${idx + 1}. ${r.address}, ${r.city}, ${r.state} ${r.zip} ($${r.rent}/mo | ${r.beds} Bed / ${r.baths} Bath) — ${r.liveUrl}`);
  });

  const fs = await import('fs');
  fs.writeFileSync('published_okc_results.json', JSON.stringify(results, null, 2));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
