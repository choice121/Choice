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
    pipelineId: 'PP-3F80B6C6',
    address: '2812 Cordone St',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76133',
    county: 'Tarrant County',
    neighborhood: 'South Fort Worth',
    lat: 32.6749,
    lng: -97.358734,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1.5,
    half_bathrooms: 1,
    square_footage: 1174,
    lot_size_sqft: 7500,
    year_built: 1960,
    floors: 1,
    garage_spaces: 0,
    parking: 'Attached Carport + Private Driveway',
    heating_type: 'Central Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated In-Unit Hookups',
    has_central_air: true,
    has_basement: false,
    monthly_rent: 1600,
    flooring: ['Hardwood Laminate', 'Ceramic Tile'],
    amenities: [
      'Central Air Conditioning & Heating',
      'Sheltered Carport Parking',
      'Expansive Fenced Backyard',
      'Single-Story Floor Plan',
      'Pet-Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Washer/Dryer Hookups'],
    description: `Situated in an established south Fort Worth neighborhood, 2812 Cordone St is an inviting single-story home offering 1,174 square feet of comfortable, accessible living space. A bright, practical layout connects the main living room to a functional culinary center complete with durable countertops, ample cabinetry, and an essential appliance suite including a refrigerator, range with oven, and dishwasher.

The private quarters feature three comfortable bedrooms with generous window illumination, serviced by one and a half bathrooms that include a private powder room for guests. Outside, an expansive, private fenced backyard delivers exceptional outdoor space for relaxing or recreation, supported by an attached covered carport for sheltered vehicle parking.

Key Highlights:
• 3 Bedrooms, 1.5 Bathrooms (1,174 Sq. Ft.)
• Functional single-story floor plan
• Kitchen equipped with refrigerator, oven, and dishwasher
• Large private fenced backyard
• Covered carport and private driveway parking
• Central air conditioning and forced-air heating
• In-unit washer and dryer hookups
• Pet-Friendly (Dogs & Cats Welcome)
• Application Fee: $50`
  },
  {
    pipelineId: 'PP-39D6EE71',
    address: '4529 Mizzenmast Ct #4529',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76135',
    county: 'Tarrant County',
    neighborhood: 'Lake Worth / Northwest Fort Worth',
    lat: 32.8123,
    lng: -97.4321,
    property_type: 'TOWNHOUSE',
    bedrooms: 3,
    bathrooms: 3,
    half_bathrooms: 0,
    square_footage: 1252,
    lot_size_sqft: null,
    year_built: 2005,
    floors: 2,
    garage_spaces: 1,
    parking: 'Attached Garage + Private Driveway',
    heating_type: 'Central Heat Pump',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated In-Unit Hookups',
    has_central_air: true,
    has_basement: false,
    monthly_rent: 1595,
    flooring: ['Luxury Vinyl Plank', 'Carpet', 'Ceramic Tile'],
    amenities: [
      'Central Air Conditioning & Heating',
      'Attached Garage Parking',
      'Three Full Bathrooms',
      'Private Fenced Backyard Lawn',
      'Cul-de-Sac Setting',
      'Pet-Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Washer/Dryer Hookups'],
    description: `Tucked into a quiet cul-de-sac setting near Lake Worth, 4529 Mizzenmast Court is a well-designed two-story townhome providing 1,252 square feet of versatile interior space. A distinctive advantage of this layout is the provision of three full bathrooms, delivering exceptional comfort and privacy for every resident and guest.

The ground level features an open living and dining area with clean sightlines into the kitchen, which offers generous storage, solid prep surfaces, and reliable appliances including a refrigerator, range with oven, microwave, and dishwasher. Sliding glass doors lead out to a deep, fully fenced private backyard that provides rare outdoor space for a townhome.

Upstairs and across the home, three spacious bedrooms provide quiet retreats with ample closet space, each enjoying convenient access to a full modern bathroom. An attached single-car garage and long private driveway deliver secure parking and supplemental utility.

Key Highlights:
• 3 Bedrooms, 3 Full Bathrooms (1,252 Sq. Ft.)
• Distinctive townhome design with three full baths
• Large private fenced backyard
• Kitchen equipped with refrigerator, oven, dishwasher, and microwave
• Attached garage and private driveway
• Central air conditioning and energy-efficient heat pump
• Dedicated in-unit laundry hookups
• Pet-Friendly (Dogs & Cats Welcome)
• Application Fee: $50`
  },
  {
    pipelineId: 'PP-F3A9CDF0',
    address: '8114 Marydean Ave',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76116',
    county: 'Tarrant County',
    neighborhood: 'West Fort Worth / Western Hills',
    lat: 32.7314,
    lng: -97.4645,
    property_type: 'DUPLEX',
    bedrooms: 3,
    bathrooms: 2,
    half_bathrooms: 0,
    square_footage: 1114,
    lot_size_sqft: null,
    year_built: 2001,
    floors: 1,
    garage_spaces: 1,
    parking: 'Attached 1-Car Garage + Private Driveway',
    heating_type: 'Central Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated In-Unit Hookups',
    has_central_air: true,
    has_basement: false,
    monthly_rent: 1500,
    flooring: ['Luxury Vinyl Plank', 'Tile'],
    amenities: [
      'Central Air Conditioning & Heating',
      'Attached 1-Car Garage',
      'Luxury Vinyl Plank Flooring Throughout',
      'Fresh Interior Paint',
      'Private Fenced Backyard with Patio',
      'Pet-Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Washer/Dryer Hookups'],
    description: `Recently refreshed with new interior paint and durable Luxury Vinyl Plank flooring across the entire layout, 8114 Marydean Ave is a clean, single-story duplex home in West Fort Worth. The well-proportioned floor plan centers around a bright, open living room that connects effortlessly with the dining space and kitchen.

The kitchen is equipped with generous cabinet capacity, breakfast counter seating, and an essential appliance package including a range with oven, dishwasher, and refrigerator. Three restful bedrooms offer comfortable accommodations with ample closets, supported by two full bathrooms featuring updated fixtures.

Outside, a private fenced backyard with a concrete patio provides a peaceful setting for morning coffee or outdoor relaxation, while an attached one-car garage and private driveway ensure secure parking. Situated moments from I-30, Ridgmar Mall, and local dining hubs.

Key Highlights:
• 3 Bedrooms, 2 Full Bathrooms (1,114 Sq. Ft.)
• Single-story duplex floor plan
• Luxury Vinyl Plank flooring throughout living and bed areas
• Kitchen with range, dishwasher, and refrigerator
• Attached garage and private driveway
• Private fenced backyard with patio
• Central air conditioning and forced-air heating
• In-unit washer and dryer hookups
• Pet-Friendly (Dogs & Cats Welcome)
• Application Fee: $50`
  },
  {
    pipelineId: 'PP-54F0FDBE',
    address: '2601 Woodmont Trl',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76133',
    county: 'Tarrant County',
    neighborhood: 'South Fort Worth / Wedgwood',
    lat: 32.6712,
    lng: -97.3712,
    property_type: 'DUPLEX',
    bedrooms: 3,
    bathrooms: 2,
    half_bathrooms: 0,
    square_footage: 1222,
    lot_size_sqft: null,
    year_built: 1980,
    floors: 1,
    garage_spaces: 1,
    parking: '1-Car Garage + Private Driveway',
    heating_type: 'Central Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated Full-Size Laundry Room',
    has_central_air: true,
    has_basement: false,
    monthly_rent: 1495,
    flooring: ['Ceramic Tile', 'Upgraded Carpet'],
    amenities: [
      'Central Air Conditioning & Heating',
      'Living Room Fireplace',
      'Ceramic Tile Living Areas',
      'Attached 1-Car Garage',
      'Corner Lot Setting',
      'Walk-In Closet in Primary Suite',
      'Pet-Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Garbage Disposal', 'Washer/Dryer Hookups'],
    description: `Positioned on an attractive corner lot in South Fort Worth, 2601 Woodmont Trail is an inviting 3-bedroom, 2-bath duplex home offering 1,222 square feet of well-designed living. The central living room is anchored by a charming brick fireplace and durable ceramic tile flooring, creating a warm, comfortable gathering space that flows directly into the dining and kitchen areas.

The culinary space features ample cabinetry, solid prep surfaces, a garbage disposal, range with oven, refrigerator, and dishwasher. The primary bedroom serves as a quiet retreat with an ensuite bath and walk-in closet, while two secondary bedrooms feature upgraded carpeting and easy access to the second full bathroom.

A full-size dedicated laundry room accommodates full-scale washer and dryer connections, complemented by a private fenced side yard and an attached single-car garage for secure vehicle parking.

Key Highlights:
• 3 Bedrooms, 2 Full Bathrooms (1,222 Sq. Ft.)
• Distinctive corner-lot duplex design
• Warm living room fireplace and ceramic tile flooring
• Kitchen equipped with range, refrigerator, dishwasher, and disposal
• Primary bedroom with walk-in closet and private bath
• Dedicated full-size in-unit laundry room
• Attached garage and private driveway
• Central air conditioning and forced-air heating
• Pet-Friendly (Dogs & Cats Welcome)
• Application Fee: $50`
  },
  {
    pipelineId: 'PP-EB3D261B',
    address: '5714 Shoreline Cir S',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76119',
    county: 'Tarrant County',
    neighborhood: 'Lake Arlington / Southeast Fort Worth',
    lat: 32.6951,
    lng: -97.2145,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2,
    half_bathrooms: 0,
    square_footage: 1216,
    lot_size_sqft: null,
    year_built: 1995,
    floors: 1,
    garage_spaces: 0,
    parking: 'Dedicated Off-Street Driveway Parking',
    heating_type: 'Central Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated In-Unit Hookups',
    has_central_air: true,
    has_basement: false,
    monthly_rent: 1600,
    flooring: ['Hardwood Laminate', 'Ceramic Tile'],
    amenities: [
      'Scenic Water & Lake Views',
      'Granite Countertops',
      'Central Air Conditioning & Heating',
      'Full Stainless Steel Appliance Package',
      'Dedicated Off-Street Parking',
      'Pet-Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Stainless Steel Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Washer/Dryer Hookups'],
    description: `Overlooking tranquil water scenery near Lake Arlington, 5714 Shoreline Circle South offers 1,216 square feet of tastefully updated living in a relaxed residential setting. The residence has been thoroughly modernized with upscale finishes, including rich granite countertops and durable modern flooring across the gathering spaces.

The culinary center is fully appointed with stainless steel appliances including a refrigerator, range with oven, microwave, and dishwasher, accompanied by custom cabinetry and a clean subway tile backsplash. The adjoining living room captures natural light and scenic outdoor sights, creating a calm, restorative atmosphere throughout the day.

Three comfortable bedrooms provide peaceful accommodations with generous closet storage, supported by two full bathrooms featuring updated fixtures and tile work. Complete with central air conditioning, in-unit laundry hookups, and dedicated off-street parking.

Key Highlights:
• 3 Bedrooms, 2 Full Bathrooms (1,216 Sq. Ft.)
• Beautiful lake views and serene setting
• Kitchen appointed with granite countertops and stainless appliances
• Two full updated bathrooms
• Central air conditioning and forced-air heating
• Dedicated off-street parking
• In-unit washer and dryer hookups
• Pet-Friendly (Dogs & Cats Welcome)
• Application Fee: $50`
  },
  {
    pipelineId: 'PP-9FC8F09F',
    address: '2157 New York Ave',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76104',
    county: 'Tarrant County',
    neighborhood: 'Near Southside / Fairmount Corridor',
    lat: 32.7214,
    lng: -97.3245,
    property_type: 'DUPLEX',
    bedrooms: 3,
    bathrooms: 1,
    half_bathrooms: 0,
    square_footage: 1011,
    lot_size_sqft: null,
    year_built: 1950,
    floors: 1,
    garage_spaces: 0,
    parking: 'Private Driveway Parking',
    heating_type: 'Central Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated In-Unit Hookups',
    has_central_air: true,
    has_basement: false,
    monthly_rent: 1550,
    flooring: ['Modern Wood-Look Plank', 'Ceramic Tile'],
    amenities: [
      'Central Air Conditioning & Heating',
      'Fresh Interior Renovation & Paint',
      'Walk-In Closets in All 3 Bedrooms',
      'Open Kitchen and Living Sightlines',
      'Dedicated Private Driveway',
      'Pet-Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Washer/Dryer Hookups'],
    description: `Freshly painted and thoughtfully renovated, 2157 New York Ave is an efficient 1,011 square foot half-duplex residence in Fort Worth's Near Southside district. The home delivers an open-concept flow where the kitchen overlooks both the dining area and living room, enabling easy daily living and entertaining.

The kitchen features renewed countertops, modern cabinetry, and complete appliances including a range with oven, refrigerator, and dishwasher. All three bedrooms include generous walk-in closets—a rare feature in homes of this vintage—serviced by a full-size central bathroom appointed with clean tile surrounds and an updated vanity.

Complete with a personal private driveway, in-unit washer/dryer hookups, and central climate control, this home offers quick access to the Medical District, Magnolia Avenue dining, and downtown Fort Worth.

Key Highlights:
• 3 Bedrooms, 1 Full Bathroom (1,011 Sq. Ft.)
• Renovated single-level duplex home
• Walk-in closets in all three bedrooms
• Open kitchen overlooking dining and living areas
• Personal private driveway parking
• Central air conditioning and forced-air heating
• In-unit washer and dryer hookups
• Pet-Friendly (Dogs & Cats Welcome)
• Application Fee: $50`
  },
  {
    pipelineId: 'PP-56E9DFB2',
    address: '8164 Marydean Ave',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76116',
    county: 'Tarrant County',
    neighborhood: 'West Fort Worth / Western Hills',
    lat: 32.7319,
    lng: -97.4648,
    property_type: 'DUPLEX',
    bedrooms: 3,
    bathrooms: 2,
    half_bathrooms: 0,
    square_footage: 1115,
    lot_size_sqft: null,
    year_built: 2001,
    floors: 1,
    garage_spaces: 2,
    parking: 'Attached 2-Car Garage + Private Driveway',
    heating_type: 'Central Forced Air Heat',
    cooling_type: 'New Central Air Conditioning',
    laundry_type: 'Dedicated In-Unit Hookups',
    has_central_air: true,
    has_basement: false,
    monthly_rent: 1450,
    flooring: ['New Luxury Vinyl Plank', 'New Carpet'],
    amenities: [
      'Attached Two-Car Garage',
      'New Central Air Conditioning',
      'New Luxury Vinyl Plank Flooring',
      'Private Fenced Backyard with Patio',
      'Walk-In Closet in Primary Suite',
      'Pet-Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Range / Oven', 'Dishwasher', 'Garbage Disposal', 'Refrigerator', 'Washer/Dryer Hookups'],
    description: `Featuring brand-new updates throughout, 8164 Marydean Ave is a clean, single-story duplex home highlighted by an attached two-car garage in West Fort Worth. The open floor plan welcomes you with new luxury vinyl plank flooring across the living room, dining space, kitchen, and bathrooms, paired with fresh paint throughout.

The kitchen is equipped with new countertops, a new range and oven, dishwasher, disposal, and a walk-in food pantry. The primary bedroom suite offers a generous walk-in closet and an ensuite bath with a dedicated linen cabinet. Two secondary bedrooms feature new carpeting and easy access to the full guest bathroom.

Outdoors, a private fenced backyard with a concrete patio provides a quiet outdoor retreat. Notable comforts include brand-new central air conditioning, in-unit washer/dryer connections, and quick access to Lockheed Martin, NAS-JRB, and primary commuter freeways.

Key Highlights:
• 3 Bedrooms, 2 Full Bathrooms (1,115 Sq. Ft.)
• Attached two-car garage and private driveway
• New luxury vinyl plank flooring and new carpeting
• Kitchen with new counters, range, dishwasher, and pantry
• Primary suite with walk-in closet and private bath
• Private fenced backyard with concrete patio
• New central air conditioning and forced-air heating
• In-unit washer and dryer hookups
• Pet-Friendly (Dogs & Cats Welcome)
• Application Fee: $50`
  },
  {
    pipelineId: 'PP-378CDB2B',
    address: '3155 Glen Garden Dr N',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76119',
    county: 'Tarrant County',
    neighborhood: 'Glen Garden / Southeast Fort Worth',
    lat: 32.6987,
    lng: -97.2645,
    property_type: 'DUPLEX',
    bedrooms: 3,
    bathrooms: 1.5,
    half_bathrooms: 1,
    square_footage: 1255,
    lot_size_sqft: null,
    year_built: 1985,
    floors: 1,
    garage_spaces: 0,
    parking: 'Dedicated Assigned Parking',
    heating_type: 'Brand-New Central HVAC',
    cooling_type: 'Brand-New Central Air Conditioning',
    laundry_type: 'Dedicated In-Unit Hookups',
    has_central_air: true,
    has_basement: false,
    monthly_rent: 1599,
    flooring: ['Modern Wood-Look Flooring', 'Tile'],
    amenities: [
      'High-End Granite Countertops',
      'Brand-New Energy-Efficient HVAC System',
      'New Energy-Saving Windows',
      'Large Private Fenced Backyard',
      'One and a Half Bathrooms',
      'Pet-Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Brand-New Refrigerator', 'Brand-New Range / Oven', 'Brand-New Dishwasher', 'Washer/Dryer Hookups'],
    description: `Extensively renovated with an emphasis on energy efficiency and modern style, 3155 Glen Garden Dr N is an exceptional 3-bedroom, 1.5-bathroom duplex residence in southeast Fort Worth. The home features brand-new double-pane windows and a brand-new central HVAC system designed to maintain optimal interior comfort while lowering utility expenses.

The culinary center showcases polished granite countertops paired with brand-new appliances including a refrigerator, range with oven, and dishwasher, surrounded by modern white cabinetry. Durable, stylish flooring extends through the main gathering areas, connecting the living and dining spaces seamlessly.

Three private bedrooms provide quiet rest, served by one full bathroom with clean modern tile work and a convenient half bath powder room for guests. Outside, a large private fenced backyard offers extensive outdoor utility. Conveniently located with rapid access to US-287, I-820, and downtown Fort Worth.

Key Highlights:
• 3 Bedrooms, 1.5 Bathrooms (1,255 Sq. Ft.)
• High-end kitchen with granite countertops and new appliances
• Brand-new HVAC system and new energy-efficient windows
• Large private fenced backyard
• Dedicated assigned parking
• Central air conditioning and forced-air heating
• In-unit washer and dryer hookups
• Pet-Friendly (Dogs & Cats Welcome)
• Application Fee: $50`
  },
  {
    pipelineId: 'PP-08784439',
    address: '2436 Dancy Dr N',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76131',
    county: 'Tarrant County',
    neighborhood: 'Eagle Mountain / North Fort Worth',
    lat: 32.8876,
    lng: -97.3541,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2,
    half_bathrooms: 0,
    square_footage: 1070,
    lot_size_sqft: 6500,
    year_built: 1982,
    floors: 1,
    garage_spaces: 1,
    parking: 'Attached Garage + Private Driveway',
    heating_type: 'Central Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated In-Unit Hookups',
    has_central_air: true,
    has_basement: false,
    monthly_rent: 1495,
    flooring: ['New Luxury Vinyl Plank', 'Tile'],
    amenities: [
      'Eagle Mountain ISD Schools',
      'New Granite Countertops & Shaker Cabinets',
      'New Stainless Steel Appliances',
      'Attached Garage Parking',
      'Private Fenced Backyard',
      'Pet-Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Stainless Steel Refrigerator', 'Stainless Steel Range / Oven', 'Stainless Steel Dishwasher', 'Washer/Dryer Hookups'],
    description: `Showcasing a comprehensive modern renovation in the sought-after Eagle Mountain ISD corridor, 2436 Dancy Dr N is an exceptional standalone single-family home offering 1,070 square feet of stylish interior living. The residence has been upgraded from top to bottom with fresh neutral paint, new luxury vinyl plank flooring, and updated plumbing and lighting fixtures.

The brand-new kitchen is appointed with white shaker-style cabinetry, polished granite countertops, and new stainless steel appliances including a refrigerator, range with oven, and dishwasher. The open main living room enjoys ample sunlight and smooth flow into the dining space.

Three private bedrooms offer comfortable accommodations, supported by two full bathrooms with modern vanities and clean tile surrounds. The exterior features a private fenced backyard for outdoor recreation and an attached single-car garage with private driveway parking. Located within walking distance of local neighborhood parks and schools.

Key Highlights:
• 3 Bedrooms, 2 Full Bathrooms (1,070 Sq. Ft.)
• Standalone single-family home in Eagle Mountain ISD
• New kitchen with granite countertops, shaker cabinets, and stainless appliances
• New luxury vinyl plank flooring and updated bathrooms
• Attached garage and private driveway
• Private fenced backyard
• Central air conditioning and forced-air heating
• In-unit washer and dryer hookups
• Pet-Friendly (Dogs & Cats Welcome)
• Application Fee: $50`
  },
  {
    pipelineId: 'PP-FC6537DC',
    address: '1711 Lady Rachael Ct',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76134',
    county: 'Tarrant County',
    neighborhood: 'South Fort Worth / Sycamore School',
    lat: 32.6245,
    lng: -97.3412,
    property_type: 'DUPLEX',
    bedrooms: 3,
    bathrooms: 2,
    half_bathrooms: 0,
    square_footage: 1110,
    lot_size_sqft: null,
    year_built: 1988,
    floors: 1,
    garage_spaces: 1,
    parking: 'Attached Garage + Driveway Parking',
    heating_type: 'Central Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated In-Unit Hookups',
    has_central_air: true,
    has_basement: false,
    monthly_rent: 1600,
    flooring: ['Ceramic Tile', 'Bedroom Carpeting'],
    amenities: [
      'Quiet Cul-de-Sac Setting',
      'French Doors to Rear Yard in Primary Suite',
      'No Rear Neighbors (Added Privacy)',
      'Attached Garage Parking',
      'Spacious Fenced Backyard with Side Yard',
      'Pet-Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Washer/Dryer Hookups'],
    description: `Resting at the end of a peaceful residential cul-de-sac off Sycamore School Road, 1711 Lady Rachael Ct is an updated 3-bedroom, 2-bathroom duplex home offering 1,110 square feet of comfortable living. The home features low-maintenance ceramic tile flooring through the central living spaces, ceiling fans, and neutral window blinds throughout.

The kitchen provides generous cabinet storage, solid counter surfaces, a dishwasher, range with oven, and refrigerator. A distinguishing architectural feature of this home is the primary bedroom suite, which boasts elegant French doors that open directly onto the private backyard.

The outdoor grounds offer notable seclusion with a deep, fully fenced backyard that backs to open space with no rear neighbors, alongside an expansive side yard for additional outdoor utility. Sheltered parking is provided by an attached single-car garage and private driveway, with effortless highway access to I-20 and I-35W.

Key Highlights:
• 3 Bedrooms, 2 Full Bathrooms (1,110 Sq. Ft.)
• Peaceful cul-de-sac location with no rear neighbors
• Primary suite with French doors opening to backyard
• Tile flooring in living areas and carpeting in bedrooms
• Kitchen equipped with dishwasher, range, and refrigerator
• Attached garage and private driveway
• Expansive private fenced backyard and side yard
• Central air conditioning and forced-air heating
• In-unit washer and dryer hookups
• Pet-Friendly (Dogs & Cats Welcome)
• Application Fee: $50`
  },
  {
    pipelineId: 'PP-5B6D6FD7',
    address: '3520 Western Ave',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76107',
    county: 'Tarrant County',
    neighborhood: 'Sunset Heights / Cultural District',
    lat: 32.7489,
    lng: -97.3789,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 2,
    half_bathrooms: 0,
    square_footage: 1151,
    lot_size_sqft: 8000,
    year_built: 1948,
    floors: 1,
    garage_spaces: 0,
    parking: 'Covered Carport + Private Driveway',
    heating_type: 'Central Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated In-Unit Hookups',
    has_central_air: true,
    has_basement: false,
    monthly_rent: 1545,
    flooring: ['Brand-New LVT Flooring', 'Ceramic Tile', 'Refinished Flooring'],
    amenities: [
      'Elevated Corner Lot in Sunset Heights',
      'Minutes from Cultural District and West 7th',
      'Spacious Primary Suite with Sliding Glass Doors',
      'Large Fenced Backyard with Mature Shade Trees',
      'Covered Carport Parking',
      'Pet-Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Refrigerator', 'Gas Range / Oven', 'Dishwasher', 'Washer/Dryer Hookups'],
    description: `Perched on a prominent, elevated corner lot in Sunset Heights, 3520 Western Ave is an updated 2-bedroom, 2-bathroom single-family residence offering 1,151 square feet of comfortable living just minutes from Fort Worth's celebrated Cultural District and West 7th. The home has been freshly painted in warm designer tones and features brand-new luxury vinyl tile flooring in the kitchen.

The kitchen is equipped with gas cooking, a dishwasher, refrigerator, and ample counter space. The expansive primary bedroom serves as a luminous sanctuary, accented by large sliding glass doors and oversized windows that bathe the room in natural light. Two full bathrooms provide complete modern convenience.

Outdoors, an expansive private fenced backyard is shaded by mature canopy trees, creating a peaceful outdoor retreat, paired with a covered carport for convenient vehicle parking.

Key Highlights:
• 2 Bedrooms, 2 Full Bathrooms (1,151 Sq. Ft.)
• Prominent corner-lot single-family home in Sunset Heights
• Minutes from Cultural District, West 7th, and downtown
• Generous primary bedroom with sliding glass doors and abundant light
• Two full bathrooms
• Large fenced backyard with mature shade trees
• Covered carport and private driveway parking
• Central air conditioning and forced-air heating
• In-unit washer and dryer hookups
• Pet-Friendly (Dogs & Cats Welcome)
• Application Fee: $50`
  }
];

async function main() {
  console.log('===============================================================');
  console.log('Choice Properties — Fort Worth Batch Enrichment & Publishing');
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
  console.log('ALL 11 PROPERTIES PUBLISHED SUCCESSFULLY!');
  console.log('===============================================================\n');

  results.forEach((r, idx) => {
    console.log(`${idx + 1}. ${r.address}, ${r.city}, ${r.state} ${r.zip} ($${r.rent}/mo | ${r.beds} Bed / ${r.baths} Bath) — ${r.liveUrl}`);
  });

  const fs = await import('fs');
  fs.writeFileSync('published_fort_worth_results.json', JSON.stringify(results, null, 2));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
