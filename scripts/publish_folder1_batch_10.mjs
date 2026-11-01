import fs from 'fs';
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE';
const LANDLORD_ID = 'b8d3aea0-f466-49f2-ac07-2b2b40793cc9'; // Choice Properties verified landlord
const SITE_URL = 'https://choice-properties-site.pages.dev';

const HEADERS = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

function makeShareToken() {
  const bytes = crypto.randomBytes(32);
  return bytes.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const CANDIDATES = [
  // 1. 2004 Woodnote Ln, Garland, TX 75040 ($1,000/mo | Orig: $1,900)
  {
    address: '2004 Woodnote Ln',
    city: 'Garland',
    state: 'TX',
    zip: '75040',
    county: 'Dallas County',
    title: '2004 Woodnote Ln, Garland, TX 75040',
    original_rent: 1900,
    rent: 1000,
    beds: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    sqft: 1424,
    lot_size_sqft: 2483,
    property_type: 'TOWNHOUSE',
    year_built: 1974,
    laundry_type: 'Hookups',
    parking: 'Attached 2-Car Garage & Driveway',
    garage_spaces: 2,
    heating_type: 'Central Natural Gas, Fireplace',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Dishwasher', 'Microwave Oven', 'Electric Range / Oven', 'Refrigerator', 'Freezer', 'Washer/Dryer Hookups'],
    amenities: [
      'Attached 2-Car Garage',
      'Private Fenced Yard',
      'Central Air Conditioning',
      'Brick Fireplace',
      'Spacious 1,424 Sq Ft Layout',
      'Pet-Friendly'
    ],
    description: `Set along a quiet residential street in Garland, this spacious 1,424-square-foot two-story townhome delivers generous proportions and low-maintenance convenience. The entrance opens into a sun-filled living room anchored by a handsome brick hearth fireplace, complemented by durable flooring and crisp architectural lines throughout.

The kitchen has been updated with contemporary hard-surface flooring, solid cabinetry, and broad preparation counters. Culinary appliances include an electric range oven, over-the-range microwave, dishwasher, refrigerator, and freezer, all positioned adjacent to the breakfast and dining area.

Upstairs, three well-proportioned bedrooms offer private retreats with airy windows and deep wardrobe closets. Two full ceramic-tile bathrooms ensure seamless morning routines for all occupants.

Equipped with efficient central heating and central air conditioning, plus dedicated washer and dryer hookups. The home features a private fully fenced backyard ideal for outdoor dining, along with an attached two-car garage offering secure parking and storage. Rapid access to President George Bush Turnpike and Firewheel Town Center.

Pet-Friendly living welcoming your four-legged companions. Application Fee: $50 per adult applicant. Submit your rental application today at Choice Properties.`
  },

  // 2. 9205 Grackle Pl, McKinney, TX 75071 ($950/mo | Orig: $1,799)
  {
    address: '9205 Grackle Pl',
    city: 'McKinney',
    state: 'TX',
    zip: '75071',
    county: 'Collin County',
    title: '9205 Grackle Pl, McKinney, TX 75071',
    original_rent: 1799,
    rent: 950,
    beds: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    sqft: 1436,
    lot_size_sqft: 4356,
    property_type: 'SINGLE_FAMILY',
    year_built: 2024,
    laundry_type: 'Hookups',
    parking: 'Attached 2-Car Garage & Concrete Driveway',
    garage_spaces: 2,
    heating_type: 'Central Forced Air Gas',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Gas Cooktop', 'Electric Range / Oven', 'Microwave', 'Dishwasher', 'Stainless Steel Refrigerator', 'Washer/Dryer Hookups'],
    amenities: [
      '2024 Brand-New Construction',
      'Granite Countertops',
      'Community Swimming Pool Access',
      'Private Fenced Backyard',
      'Attached 2-Car Garage',
      'Walk-In Closets',
      'Pet-Friendly'
    ],
    description: `Showcasing 2024 new construction in a master-planned McKinney neighborhood, this pristine 1,436-square-foot single-story home delivers modern architectural efficiency. The front foyer opens directly into an expansive open-concept living and entertaining space surfaced in easy-care, high-durability flooring.

The gourmet kitchen features gleaming slab granite countertops, clean designer cabinetry, a gas cooktop, electric oven, microwave, dishwasher, and a full stainless-steel refrigerator. The central island breakfast bar flows naturally into the sunny dining alcove.

The secluded primary bedroom suite boasts an oversized walk-in wardrobe and a private en-suite bathroom featuring modern fixtures and an expansive vanity. Two additional bedrooms are positioned near the second full bathroom, each with generous closet storage and bright natural light.

Complete with high-efficiency central air conditioning, gas heating, and interior washer/dryer hookups. The exterior includes a privacy-fenced backyard, an attached two-car garage, and resident access to community park amenities and swimming pool facilities. Served by top-rated McKinney schools.

Pet-Friendly environment. Application Fee: $50 per adult applicant. Submit your rental application today at Choice Properties.`
  },

  // 3. 3420 Flicker Ln, McKinney, TX 75071 ($950/mo | Orig: $1,800)
  {
    address: '3420 Flicker Ln',
    city: 'McKinney',
    state: 'TX',
    zip: '75071',
    county: 'Collin County',
    title: '3420 Flicker Ln, McKinney, TX 75071',
    original_rent: 1800,
    rent: 950,
    beds: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    sqft: 1264,
    lot_size_sqft: 4356,
    property_type: 'SINGLE_FAMILY',
    year_built: 2024,
    laundry_type: 'In Unit',
    parking: 'Attached 2-Car Garage & Driveway',
    garage_spaces: 2,
    heating_type: 'Central Forced Air Gas',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Gas Cooktop', 'Range / Oven', 'Microwave', 'Dishwasher', 'Refrigerator', 'Washer', 'Dryer'],
    amenities: [
      '2024 Construction',
      'In-Unit Washer & Dryer Included',
      'Chef\'s Kitchen with Granite',
      'Full Yard Sprinkler System',
      'Private Privacy Fence',
      'Community Pool & Parks',
      'Attached 2-Car Garage',
      'Pet-Friendly'
    ],
    description: `Built in 2024 within the respected McKinney ISD corridor, this 1,264-square-foot detached single-family home offers modern comfort and turnkey convenience. Premium luxury vinyl plank flooring sweeps across the open social spaces, illuminated by energy-saving recessed illumination.

The chef\'s kitchen features premium granite countertops, rich cabinetry, a gas cooktop, built-in microwave, range oven, dishwasher, and a full refrigerator. An adjoining dining area looks out onto the grassy rear yard.

Three well-appointed bedrooms feature plush carpeting, ceiling fans, and excellent closet storage. The primary suite offers a private sanctuary with its own en-suite bathroom, wide vanity, and generous walk-in closet. The secondary full bath is finished in clean neutral tones.

This home includes an in-unit washer and dryer for supreme laundry convenience, plus full automatic lawn irrigation and central air conditioning. An attached two-car garage and fully sodded, privacy-fenced yard provide exceptional comfort. Community perks feature neighborhood pools, walking trails, and parks.

Pet-Friendly accommodations for your pets. Application Fee: $50 per adult applicant. Submit your rental application today at Choice Properties.`
  },

  // 4. 1110 Wycliff Dr, Garland, TX 75040 ($950/mo | Orig: $1,800)
  {
    address: '1110 Wycliff Dr',
    city: 'Garland',
    state: 'TX',
    zip: '75040',
    county: 'Dallas County',
    title: '1110 Wycliff Dr, Garland, TX 75040',
    original_rent: 1800,
    rent: 950,
    beds: 3,
    bathrooms: 1.5,
    half_bathrooms: 1,
    sqft: 1200,
    lot_size_sqft: 7540,
    property_type: 'SINGLE_FAMILY',
    year_built: 1970,
    laundry_type: 'Hookups',
    parking: 'Attached 2-Car Garage & Wide Driveway',
    garage_spaces: 2,
    heating_type: 'Central Forced Air Gas',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Brand New Range / Oven', 'Refrigerator', 'Range Hood', 'Washer/Dryer Hookups'],
    amenities: [
      'Luxury Vinyl Plank (LVP) Flooring',
      'Freshly Painted Cabinetry',
      'Attached 2-Car Garage',
      'Substantial 7,540 Sq Ft Lot',
      'Spacious Private Fenced Backyard',
      'Single-Level Living',
      'Pet-Friendly'
    ],
    description: `Situated on an expansive 7,540-square-foot homesite in a mature Garland enclave, this newly refreshed 1,200-square-foot ranch home pairs single-story ease with extensive modern updates. Brand-new luxury vinyl plank (LVP) flooring extends throughout the entire interior, delivering an elegant and easy-care aesthetic.

The newly modernized kitchen showcases freshly painted cabinetry, stylish hardware, an updated range oven, range hood, and refrigerator. An intuitive floor plan connects the kitchen directly to the central dining area and main living room.

Three comfortable bedrooms feature matching LVP flooring and large picture windows. The primary bedroom features a private en-suite half-bath powder room, while the central full bathroom boasts clean ceramic tile surrounds and an updated vanity.

Enjoy whole-house comfort with central air conditioning and gas heat. The attached two-car garage provides exceptional vehicle and equipment storage, and the massive, fully fenced backyard offers a private outdoor haven for weekend relaxation. Conveniently located near North Garland High School and Firewheel recreation.

Pet-Friendly living. Application Fee: $50 per adult applicant. Submit your rental application today at Choice Properties.`
  },

  // 5. 403 Carver St, McKinney, TX 75069 ($1,000/mo | Orig: $1,895)
  {
    address: '403 Carver St',
    city: 'McKinney',
    state: 'TX',
    zip: '75069',
    county: 'Collin County',
    title: '403 Carver St, McKinney, TX 75069',
    original_rent: 1895,
    rent: 1000,
    beds: 3,
    bathrooms: 2.5,
    half_bathrooms: 1,
    sqft: 1312,
    lot_size_sqft: 5802,
    property_type: 'SINGLE_FAMILY',
    year_built: 2020,
    laundry_type: 'Hookups',
    parking: 'Attached 2-Car Garage & Private Driveway',
    garage_spaces: 2,
    heating_type: 'Central Forced Air Gas',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Gas Range / Oven', 'Microwave', 'Dishwasher', 'Refrigerator', 'Washer/Dryer Hookups'],
    amenities: [
      'Kitchen Island with Breakfast Bar',
      'Granite Countertops',
      'Primary Suite with En-Suite Bath',
      'Walk-In Closets',
      'Private Fenced Yard',
      'Mature Trees',
      'Attached 2-Car Garage',
      'Pet-Friendly'
    ],
    description: `Built in 2020 in historical McKinney, this contemporary 1,312-square-foot standalone residence blends craftsman charm with contemporary interior styling. An open-concept floor plan connects the central living room, formal dining space, and gourmet kitchen into an inviting social expanse.

The kitchen serves as the visual centerpiece, appointed with a granite-topped center island, rich modern cabinetry, a gas range oven, microwave, dishwasher, and refrigerator. Tall ceilings and sunny windows enhance the spacious feel.

Accommodations encompass three bedrooms and two-and-a-half bathrooms. The private primary suite features an en-suite bath with a walk-in shower and deep wardrobe closet. Two additional upstairs bedrooms share a full bath, while a main-level half-bath serves guests.

Energy-efficient central HVAC, double-pane windows, and dedicated interior laundry hookups provide seamless day-to-day comfort. Outside, the 5,802-square-foot lot features mature shade trees, an attached two-car garage, and a private wooden-fenced backyard. Minutes to historic Downtown McKinney Square dining and shopping.

Pet-Friendly property. Application Fee: $50 per adult applicant. Submit your rental application today at Choice Properties.`
  },

  // 6. 1309 Greencove Dr, Garland, TX 75040 ($950/mo | Orig: $1,850)
  {
    address: '1309 Greencove Dr',
    city: 'Garland',
    state: 'TX',
    zip: '75040',
    county: 'Dallas County',
    title: '1309 Greencove Dr, Garland, TX 75040',
    original_rent: 1850,
    rent: 950,
    beds: 3,
    bathrooms: 1.5,
    half_bathrooms: 1,
    sqft: 1311,
    lot_size_sqft: 7400,
    property_type: 'SINGLE_FAMILY',
    year_built: 1971,
    laundry_type: 'Hookups',
    parking: 'Attached 2-Car Garage & Driveway',
    garage_spaces: 2,
    heating_type: 'Central Forced Air Gas',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Stove / Range Oven', 'Microwave', 'Dishwasher', 'Refrigerator', 'Washer/Dryer Hookups'],
    amenities: [
      'Large Fenced-In Backyard',
      'Storage Shed Workshop',
      'Covered Concrete Patio',
      'Attached 2-Car Garage',
      'Central Air Conditioning',
      'Pet-Friendly'
    ],
    description: `Positioned on a quiet, tree-lined street in North Garland, this 1,311-square-foot detached single-family home features single-level living and an expansive 7,400-square-foot lot. The front entrance leads into a welcoming living room characterized by bright windows and neutral paint finishes that accommodate any decor.

The kitchen is equipped with solid wood cabinets, ample counter preparation space, a range oven, microwave, dishwasher, and refrigerator. An adjacent dining space opens onto the covered outdoor patio for effortless indoor-outdoor flow.

The home offers three well-sized bedrooms with roomy closets. The primary bedroom enjoys the convenience of a private half-bath powder room, while a full central bathroom with a ceramic tub/shower combination serves the secondary rooms and guests.

Central heating and air conditioning ensure dependable year-round climate control, supported by dedicated in-unit laundry hookups. Outdoors, the huge privacy-fenced backyard features a covered concrete patio and a detached storage shed/workshop, alongside an attached two-car garage. Quick access to Spring Creek Forest Preserve and Firewheel Mall.

Pet-Friendly accommodations. Application Fee: $50 per adult applicant. Submit your rental application today at Choice Properties.`
  },

  // 7. 1514 Cedar Crest Dr, Garland, TX 75042 ($900/mo | Orig: $1,675)
  {
    address: '1514 Cedar Crest Dr',
    city: 'Garland',
    state: 'TX',
    zip: '75042',
    county: 'Dallas County',
    title: '1514 Cedar Crest Dr, Garland, TX 75042',
    original_rent: 1675,
    rent: 900,
    beds: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    sqft: 1200,
    lot_size_sqft: 7362,
    property_type: 'SINGLE_FAMILY',
    year_built: 1940,
    laundry_type: 'Hookups',
    parking: 'Detached Garage & Long Driveway',
    garage_spaces: 1,
    heating_type: 'Central Forced Air Gas',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Gas Range / Oven', 'Dishwasher', 'Refrigerator', 'Washer/Dryer Hookups'],
    amenities: [
      'Rich Genuine Hardwood Flooring',
      'White Cabinetry with Granite Countertops',
      'Private Fenced Backyard',
      'Detached Garage',
      'Open-Concept Social Living',
      'Pet-Friendly'
    ],
    description: `Exuding classic character and recent interior modernization, this 1,200-square-foot standalone home occupies a generous 7,362-square-foot parcel in central Garland. Gorgeous, gleaming hardwood flooring flows across the sunlit living areas, creating an enduring, upscale foundation.

The remodeled kitchen boasts crisp white cabinetry, polished granite countertops, a gas range oven, dishwasher, and refrigerator. An open floor plan connects the kitchen to the formal dining and living areas for easy entertaining.

Three bedrooms feature genuine hardwoods and bright exposures. Two full updated bathrooms showcase modern vanities, stylish lighting, and updated bath enclosures.

Central air conditioning and forced-air gas heat maintain ideal indoor comfort, while dedicated laundry hookups are on hand for washer and dryer installation. The large private fenced yard provides plenty of outdoor space for gardening and pets, accompanied by a detached garage and an extended driveway. Conveniently situated near Central Park and downtown Garland transit.

Pet-Friendly living. Application Fee: $50 per adult applicant. Submit your rental application today at Choice Properties.`
  },

  // 8. 2425 Gabriel Dr, McKinney, TX 75071 ($1,000/mo | Orig: $1,899)
  {
    address: '2425 Gabriel Dr',
    city: 'McKinney',
    state: 'TX',
    zip: '75071',
    county: 'Collin County',
    title: '2425 Gabriel Dr, McKinney, TX 75071',
    original_rent: 1899,
    rent: 1000,
    beds: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    sqft: 1280,
    lot_size_sqft: 6970,
    property_type: 'SINGLE_FAMILY',
    year_built: 2006,
    laundry_type: 'Hookups',
    parking: 'Attached 2-Car Garage & Extended Driveway',
    garage_spaces: 2,
    heating_type: 'Central Forced Air Gas',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Gas Range / Oven', 'Microwave', 'Dishwasher', 'Refrigerator', 'Washer/Dryer Hookups'],
    amenities: [
      'Sandy Glen Neighborhood Enclave',
      'Spacious 6,970 Sq Ft Lot',
      'Attached 2-Car Garage',
      'Central Air Conditioning',
      'Private Fenced Backyard',
      'Pet-Friendly'
    ],
    description: `Located in the sought-after Sandy Glen neighborhood of northern Collin County, this 1,280-square-foot single-family home delivers a clean, open layout on a 6,970-square-foot residential lot. An arched entryway leads into a large living room illuminated by tall windows overlooking the private yard.

The kitchen is equipped with solid wood cabinetry, expansive prep surfaces, a gas range oven, microwave, dishwasher, and refrigerator. A dedicated dining space bridges the kitchen and living room for practical everyday comfort.

The split-bedroom configuration features a secluded primary suite with a walk-in wardrobe and private en-suite bathroom. Two additional bedrooms are generously sized with large closets and easy access to the second full ceramic-tile bath.

Central air conditioning, gas heating, and dedicated laundry hookups ensure stress-free living. The exterior highlights an attached two-car garage and a spacious fully fenced backyard ideal for pets and outdoor leisure. Fast access to US-75 and McKinney Towne Crossing.

Pet-Friendly property. Application Fee: $50 per adult applicant. Submit your rental application today at Choice Properties.`
  },

  // 9. 4015 Hartford Dr, Garland, TX 75043 ($900/mo | Orig: $1,760)
  {
    address: '4015 Hartford Dr',
    city: 'Garland',
    state: 'TX',
    zip: '75043',
    county: 'Dallas County',
    title: '4015 Hartford Dr, Garland, TX 75043',
    original_rent: 1760,
    rent: 900,
    beds: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    sqft: 1286,
    lot_size_sqft: 7449,
    property_type: 'SINGLE_FAMILY',
    year_built: 1971,
    laundry_type: 'Hookups',
    parking: 'Attached 2-Car Garage & Driveway',
    garage_spaces: 2,
    heating_type: 'Central Forced Air Gas',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Range / Oven', 'Dishwasher', 'Refrigerator', 'Washer/Dryer Hookups'],
    amenities: [
      'Attached 2-Car Garage',
      'Generous 7,449 Sq Ft Lot',
      'Private Fenced Backyard',
      'Single-Story Open Flow',
      'Central Air Conditioning',
      'Pet-Friendly'
    ],
    description: `Set on a generous 7,449-square-foot lot in South Garland, this single-story detached residence offers 1,286 square feet of comfortable, versatile living space. The large main gathering area features durable flooring, clean contemporary paint tones, and an open sightline to the dining area.

The kitchen is appointed with extensive cabinetry, durable laminate countertops, a range oven, dishwasher, and refrigerator. A wide sliding glass door leads out to the expansive rear yard.

Three bedrooms provide tranquil retreats with ample closet space and natural daylight. Two full bathrooms offer updated fixtures, modern vanities, and clean bathtub/shower enclosures.

Central air conditioning and forced-air gas heat provide dependable year-round comfort. Features an attached two-car garage, private driveway, dedicated interior laundry hookups, and a large privacy-fenced yard. Convenient to I-30, Lake Ray Hubbard, and local parks.

Pet-Friendly environment welcoming your animal companions. Application Fee: $50 per adult occupant. Submit your rental application today at Choice Properties.`
  },

  // 10. 9208 Grackle Pl, McKinney, TX 75071 ($1,000/mo | Orig: $1,900)
  {
    address: '9208 Grackle Pl',
    city: 'McKinney',
    state: 'TX',
    zip: '75071',
    county: 'Collin County',
    title: '9208 Grackle Pl, McKinney, TX 75071',
    original_rent: 1900,
    rent: 1000,
    beds: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    sqft: 1411,
    lot_size_sqft: 4400,
    property_type: 'SINGLE_FAMILY',
    year_built: 2024,
    laundry_type: 'In Unit',
    parking: 'Attached 2-Car Garage & Concrete Driveway',
    garage_spaces: 2,
    heating_type: 'Central Forced Air Gas',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Gas Range / Oven', 'Microwave', 'Dishwasher', 'Refrigerator', 'Washer', 'Dryer'],
    amenities: [
      '2024 New Construction',
      'Oversized Ceramic Tile Flooring',
      'Granite Countertops',
      'In-Unit Washer & Dryer Included',
      'Community Pool Access',
      'Attached 2-Car Garage',
      'Pet-Friendly'
    ],
    description: `Featuring 2024 new construction in McKinney, this pristine 1,411-square-foot single-level residence offers energy-conscious construction and contemporary craftsmanship. Oversized modern ceramic tile flooring flows seamlessly through the spacious main living and dining spaces.

The gourmet kitchen boasts gleaming granite countertops, solid wood cabinetry, a gas range oven, built-in microwave, dishwasher, and a full refrigerator. The expansive central island overlooks the living room for effortless day-to-day connectivity.

Three comfortable bedrooms feature plush neutral carpeting and large wardrobe closets. The primary suite showcases an oversized en-suite bathroom with a walk-in shower and broad vanity. The second full bath is conveniently placed near the secondary bedrooms.

Complete with an in-unit washer and dryer, energy-efficient central air conditioning, gas heating, an attached two-car garage, and a private wooden-fenced backyard. Residents enjoy full access to neighborhood community swimming pool and park facilities.

Pet-Friendly accommodations. Application Fee: $50 per adult applicant. Submit your rental application today at Choice Properties.`
  }
];

async function run() {
  console.log(`=========================================================`);
  console.log(`Choice Properties — Publishing Folder 1 (10 Properties)`);
  console.log(`Area: Garland / McKinney / Collin & Dallas County`);
  console.log(`Mode: Private Placement Shield & Magic Link Sharing`);
  console.log(`Price Adjustment Range: $900 - $1,000/mo`);
  console.log(`=========================================================\n`);

  // Load raw batch to match photos and coordinates
  const rawData = JSON.parse(fs.readFileSync('/tmp/folder1_raw_batch.json', 'utf8'));
  const rawMap = new Map();
  rawData.forEach(p => {
    const addr = (p.address || p.streetAddress || '').trim().toLowerCase();
    rawMap.set(addr, p);
  });

  const publishedResults = [];
  const publishedIds = [];

  for (let i = 0; i < CANDIDATES.length; i++) {
    const c = CANDIDATES[i];
    const key = c.address.trim().toLowerCase();
    const raw = rawMap.get(key) || {};

    console.log(`\n---------------------------------------------------------`);
    console.log(`Processing #${i+1}: ${c.address} (${c.beds}b/${c.bathrooms}ba | Adjusted Rent: $${c.rent}/mo [Orig: $${c.original_rent}] | ${c.property_type})`);

    const propertyId = crypto.randomUUID();
    const propertyPayload = {
      id: propertyId,
      landlord_id: LANDLORD_ID,
      status: 'private_placement', // Shielded from public marketplace
      title: c.title,
      description: c.description,
      address: c.address,
      city: c.city,
      state: c.state,
      zip: c.zip,
      county: c.county,
      lat: raw.lat || raw.latitude || 32.9126,
      lng: raw.lng || raw.longitude || -96.6389,
      property_type: c.property_type,
      year_built: c.year_built,
      bedrooms: c.beds,
      bathrooms: Math.floor(c.bathrooms),
      half_bathrooms: c.half_bathrooms,
      total_bathrooms: c.bathrooms,
      square_footage: c.sqft,
      lot_size_sqft: c.lot_size_sqft,
      garage_spaces: c.garage_spaces,
      monthly_rent: c.rent,
      security_deposit: c.rent, // 1x monthly rent in DB
      application_fee: 50, // strictly $50
      pets_allowed: true,
      parking: c.parking,
      amenities: c.amenities,
      appliances: c.appliances,
      heating_type: c.heating_type,
      cooling_type: c.cooling_type,
      laundry_type: c.laundry_type,
      has_central_air: c.has_central_air,
      has_basement: c.has_basement,
      original_description: raw.original_description || raw.description || '',
      views_count: 0,
      applications_count: 0,
      saves_count: 0
    };

    const propRes = await fetch(`${SUPABASE_URL}/rest/v1/properties`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(propertyPayload)
    });
    if (!propRes.ok) {
      const errText = await propRes.text();
      throw new Error(`Failed to insert into public.properties: ${propRes.status} ${errText}`);
    }
    publishedIds.push(propertyId);
    console.log(`✓ Published to public.properties (ID: ${propertyId}, status: 'private_placement')`);

    // Photos Insertion with direct source CDN URLs and original order
    let rawPhotos = [];
    try {
      rawPhotos = JSON.parse(raw.original_image_urls || raw.image_urls || '[]');
    } catch (e) {
      rawPhotos = [];
    }
    if (!Array.isArray(rawPhotos) || rawPhotos.length === 0) {
      if (raw.photos && Array.isArray(raw.photos)) rawPhotos = raw.photos;
    }

    const photoRows = rawPhotos.map((item, idx) => ({
      property_id: propertyId,
      url: typeof item === 'string' ? item : item.url,
      display_order: idx + 1,
      is_hero: idx === 0
    }));

    if (photoRows.length > 0) {
      const photoRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(photoRows)
      });
      if (!photoRes.ok) {
        const pErr = await photoRes.text();
        console.warn(`Warning: failed to insert photos: ${photoRes.status} ${pErr}`);
      } else {
        console.log(`✓ Inserted ${photoRows.length} original CDN photos (hero: photo #1)`);
      }
    }

    publishedResults.push({
      id: propertyId,
      address: c.address,
      city: c.city,
      state: c.state,
      zip: c.zip,
      title: c.title,
      rent: c.rent,
      original_rent: c.original_rent,
      beds: c.beds,
      baths: c.bathrooms,
      sqft: c.sqft,
      photosCount: photoRows.length
    });
  }

  // Generate Magic Multi-Property Share Link
  console.log(`\n=========================================================`);
  console.log(`Generating Magic Multi-Property Share Token for ${publishedIds.length} properties...`);

  const token = makeShareToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days
  const shareId = crypto.randomUUID();

  // Insert into public.property_shares
  const shareRes = await fetch(`${SUPABASE_URL}/rest/v1/property_shares`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      id: shareId,
      token_hash: tokenHash,
      expires_at: expiresAt
    })
  });

  if (!shareRes.ok) {
    const err = await shareRes.text();
    throw new Error(`Failed to create property_shares: ${shareRes.status} ${err}`);
  }
  console.log(`✓ Created property_share record (ID: ${shareId})`);

  // Link all properties into public.property_share_properties
  const linkRows = publishedIds.map(pid => ({
    share_id: shareId,
    property_id: pid
  }));

  const linkRes = await fetch(`${SUPABASE_URL}/rest/v1/property_share_properties`, {
    method: 'POST',
    headers: { ...HEADERS, 'Prefer': 'return=representation' },
    body: JSON.stringify(linkRows)
  });

  if (!linkRes.ok) {
    const err = await linkRes.text();
    throw new Error(`Failed to link property_share_properties: ${linkRes.status} ${err}`);
  }
  console.log(`✓ Linked ${publishedIds.length} properties to share record`);

  // Verify resolution via property-share Edge Function
  console.log(`\nVerifying share resolution via /functions/v1/property-share...`);
  try {
    const resolveRes = await fetch(`${SUPABASE_URL}/functions/v1/property-share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`
      },
      body: JSON.stringify({
        action: 'resolve',
        token: token
      })
    });
    const resolveData = await resolveRes.json();
    console.log(`Resolution status: ${resolveRes.status}`, resolveData.success ? `✓ Resolved ${resolveData.properties?.length || resolveData.data?.length || 'OK'} properties` : resolveData);
  } catch (e) {
    console.warn(`Resolution check warning: ${e.message}`);
  }

  const magicLink = `${SITE_URL}/listings.html#share=${token}`;

  console.log(`\n=========================================================`);
  console.log(`🎉 MAGIC MULTI-PROPERTY LINK GENERATED SUCCESSFULLY!`);
  console.log(`Share URL: ${magicLink}`);
  console.log(`=========================================================`);

  fs.writeFileSync('scripts/published_folder1_magic_results.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    share_token: token,
    share_id: shareId,
    share_url: magicLink,
    properties: publishedResults
  }, null, 2));

  console.log(`Saved output manifest to scripts/published_folder1_magic_results.json`);
}

run().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
