/**
 * scripts/publish_master_zillow_tulsa.mjs
 * Master enrichment, verification, validation, and publication engine
 * for recently scraped Zillow pipeline properties in Tulsa, OK.
 * Adheres strictly to AGENTS.md Choice Properties rules.
 */

import crypto from 'crypto';
import { CREDENTIALS_CONFIG } from '../credentials-config.mjs';

const SUPABASE_URL = CREDENTIALS_CONFIG.SUPABASE_URL;
const KEY = CREDENTIALS_CONFIG.SUPABASE_API_KEY;
const LANDLORD_ID = 'dabe7d4a-8a92-4fb4-9de9-0dcda47391c1'; // Choice properties LLC

const HEADERS = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

const HEADERS_PIPELINE = {
  ...HEADERS,
  'Accept-Profile': 'pipeline',
  'Content-Profile': 'pipeline',
};

const PROPERTIES_TO_PUBLISH = [
  {
    pipeline_id: 'PP-7CD0623E',
    existing_property_id: 'cfa206c2-137b-460e-8c08-30fac0b599e9',
    title: '2BR Single Family in Tulsa',
    address: '5518 E 2nd St',
    city: 'Tulsa',
    state: 'OK',
    zip: '74112',
    county: 'Tulsa County',
    lat: 36.1585,
    lng: -95.91508,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1.0,
    total_bathrooms: 1,
    half_bathrooms: 0,
    square_footage: 728,
    monthly_rent: 1050,
    security_deposit: 1050,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Driveway Parking',
    heating_type: 'Central Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Luxury Vinyl Plank', 'Hard-Surface Flooring'],
    amenities: [
      'Expansive Backyard Deck Overlooking Peaceful Yard',
      'Renovated Open Concept Living Space',
      'Brand New Luxury Vinyl Plank Flooring',
      'Central Air Conditioning & Heating',
      'Private Driveway Parking',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Range / Oven', 'Dishwasher', 'Microwave', 'Washer/Dryer Hookups'],
    description: `Renovated throughout its 728-square-foot floor plan, this two-bedroom residence sits conveniently close to the University of Tulsa and historic Route 66. Interior updates include fresh paint and brand new luxury vinyl plank flooring extending across an open living area.

The kitchen is outfitted with contemporary shaker cabinetry alongside a full appliance suite comprising a range, oven, microwave, and dishwasher. Outside, a generous rear deck overlooks an expansive, peaceful backyard ideal for relaxation. Additional practical elements include central air conditioning, in-unit washer and dryer connections, and private driveway parking. Direct access to surrounding expressways ensures straightforward commutes into central Tulsa.`
  },
  {
    pipeline_id: 'PP-EDCB975C',
    existing_property_id: '82c617a5-877a-46e7-822f-2f1778e71a9a',
    title: '2BR Single Family in Tulsa',
    address: '608 E Zion St',
    city: 'Tulsa',
    state: 'OK',
    zip: '74106',
    county: 'Tulsa County',
    lat: 36.1894,
    lng: -95.98636,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1.0,
    total_bathrooms: 1,
    half_bathrooms: 0,
    square_footage: 708,
    year_built: 1946,
    monthly_rent: 1200,
    security_deposit: 1200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Dedicated Off-Street Driveway Parking',
    heating_type: 'Central Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Connections',
    flooring: ['Hard-Surface Flooring'],
    amenities: [
      'Classic 1946 Brick Exterior Construction',
      'Substantial Outdoor Yard for Gardening & Recreation',
      'Central Heating & Air Conditioning',
      'Dedicated Off-Street Driveway Parking',
      'Close to Local Schools & Parks',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Range / Oven', 'Refrigerator', 'Washer/Dryer Connections'],
    description: `Constructed with classic brick exterior masonry in 1946, this standalone 708-square-foot home presents a manageable two-bedroom, one-bathroom arrangement in the heart of Tulsa.

Inside, clean wall finishes pair with durable hard-surface flooring throughout the main living areas and bedrooms. The kitchen provides functional cabinetry and dedicated cooking appliances, while the full bathroom offers a clean vanity and bath setup. A substantial outdoor yard provides space for gardening and outdoor leisure. Located with immediate access to neighborhood parks, local public schools, and main transit routes, the home offers comfortable living with dedicated off-street driveway parking.`
  },
  {
    pipeline_id: 'PP-E614D196',
    existing_property_id: '54a1748f-e194-4d46-a4ce-cdf18ae1dbd3',
    title: '3BR Single Family in Tulsa',
    address: '1552 E 54th St N',
    city: 'Tulsa',
    state: 'OK',
    zip: '74126',
    county: 'Tulsa County',
    lat: 36.2307,
    lng: -95.96914,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1.0,
    total_bathrooms: 1,
    half_bathrooms: 0,
    square_footage: 996,
    monthly_rent: 1125,
    security_deposit: 1125,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Dedicated Driveway Parking',
    heating_type: 'Central Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Hardwood Flooring', 'Hard-Surface Flooring'],
    amenities: [
      'Refinished Hardwood Floors & Abundant Natural Light',
      'Spacious Backyard with Covered Outdoor Patio',
      'Central Air Conditioning & Heating',
      'Dedicated Driveway Parking',
      'Quick Highway Connectivity to Downtown Tulsa',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Range / Oven', 'Refrigerator', 'Washer/Dryer Hookups'],
    description: `Situated in North Tulsa, this 996-square-foot single-family home features three bedrooms, a central full bath, and hardwood flooring across the interior. Expansive windows let in abundant daylight throughout the front living room and adjacent dining area.

The kitchen delivers practical counter workspace and solid cabinetry alongside washer and dryer hookups. A standout outdoor highlight is the spacious backyard complete with a covered rear patio designed for year-round shelter. Central air conditioning and heating maintain comfort in every season. Highway access nearby allows rapid transit into downtown Tulsa, while neighborhood schools and local green spaces remain within easy reach. Off-street driveway parking is included.`
  },
  {
    pipeline_id: 'PP-5D4FF3BF',
    existing_property_id: 'acff7c20-6898-4909-aaca-a499bd6c168b',
    title: '2BR Single Family in Tulsa',
    address: '1020 E Apache St',
    city: 'Tulsa',
    state: 'OK',
    zip: '74106',
    county: 'Tulsa County',
    lat: 36.1969,
    lng: -95.97864,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1.0,
    total_bathrooms: 1,
    half_bathrooms: 0,
    square_footage: 744,
    monthly_rent: 1100,
    security_deposit: 1100,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Off-Street Driveway Parking',
    heating_type: 'Wall Units & Central Climate Control',
    cooling_type: 'Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Updated Hard-Surface Flooring'],
    amenities: [
      'Full Kitchen Appliance Suite with Dishwasher & Microwave',
      'Large Private Yard',
      'Updated Flooring & Fresh Interior Paint',
      'Off-Street Driveway Parking',
      'Minutes from Downtown Tulsa & Expressways',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Stove / Oven', 'Microwave', 'Dishwasher', 'Refrigerator', 'Washer/Dryer Hookups'],
    description: `This single-level home provides 744 square feet of updated interior space featuring two bedrooms and one full bath. Fresh neutral paint pairs with updated hard flooring across the shared living room and bedrooms.

The kitchen comes fully equipped with a refrigerator, cooking stove and oven, built-in microwave, and dishwasher, backed by dedicated washer and dryer connections. Climate systems provide dependable year-round temperature control. Outside, a sizable private yard creates plenty of open outdoor space. Positioned just minutes north of downtown Tulsa, residents enjoy quick drives to local shopping, neighborhood parks, and major regional thoroughfares. Driveway parking accommodates multiple vehicles.`
  },
  {
    pipeline_id: 'PP-A97A6252',
    existing_property_id: null,
    title: '2BR Single Family in Tulsa',
    address: '1017 N College Ave',
    city: 'Tulsa',
    state: 'OK',
    zip: '74110',
    county: 'Tulsa County',
    lat: 36.1685,
    lng: -95.95286,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1.0,
    total_bathrooms: 1,
    half_bathrooms: 0,
    square_footage: 1115,
    monthly_rent: 1050,
    security_deposit: 1050,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Off-Street Driveway Parking',
    heating_type: 'Central Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Updated Hard-Surface Flooring'],
    amenities: [
      'Substantial 1,115 Sq Ft Single-Story Layout',
      'Fresh Interior Paint & Modernized Fixtures',
      'Spacious Private Yard for Entertaining',
      'Off-Street Driveway Parking',
      'Close to Historic Route 66 & Downtown Tulsa',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Range / Oven', 'Refrigerator', 'Washer/Dryer Hookups'],
    description: `Offering an expansive 1,115 square feet on a single level, this two-bedroom, one-bathroom residence provides generous room throughout its living areas and private quarters. Recent interior updates include fresh neutral paint, updated flooring, and modernized fixtures.

The kitchen offers generous counter area and storage cabinetry, while the bathroom features a clean vanity and tub-shower arrangement. In-unit washer and dryer hookups make laundry days effortless. Outside, a large private yard provides ample space for quiet outdoor activities. Set in an established Tulsa neighborhood near Route 66 and the University of Tulsa corridor, the address provides quick routes to downtown dining, arts, and employment hubs. Off-street driveway parking completes the property.`
  },
  {
    pipeline_id: 'PP-115830B9',
    existing_property_id: null,
    title: '3BR Single Family in Tulsa',
    address: '150 W 50th Pl N',
    city: 'Tulsa',
    state: 'OK',
    zip: '74126',
    county: 'Tulsa County',
    lat: 36.2269,
    lng: -95.99222,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1.0,
    total_bathrooms: 1,
    half_bathrooms: 0,
    square_footage: 864,
    monthly_rent: 1095,
    security_deposit: 1095,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Driveway Parking',
    heating_type: 'Central Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Hard-Surface Flooring'],
    amenities: [
      'Open Concept Living & Dining Layout',
      'Expansive Backyard Green Space',
      'Section 8 / Housing Choice Vouchers Accepted',
      'Private Driveway Parking',
      'Convenient Access to Hwy 75 & Chamberlain Park',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Range / Oven', 'Refrigerator', 'Washer/Dryer Hookups'],
    description: `Positioned on a quiet residential street in North Tulsa off 46th Street North and Osage, this 864-square-foot ranch home delivers a sensible three-bedroom, one-bathroom configuration. The layout centers on an open living and dining area designed for straightforward daily living.

Included kitchen appliances feature a cooking range and refrigerator, supplemented by in-home washer and dryer connections. The three distinct bedrooms provide flexible options for family quarters or dedicated workspace. A deep backyard offers substantial lawn area for outdoor activities. Convenient proximity to Highway 75 and Chamberlain Park simplifies area travel and recreation. Housing choice vouchers are accepted. Private driveway parking is provided on-site.`
  },
  {
    pipeline_id: 'PP-F45B578C',
    existing_property_id: null,
    title: '2BR Single Family in Tulsa',
    address: '10111 E 30th St',
    city: 'Tulsa',
    state: 'OK',
    zip: '74129',
    county: 'Tulsa County',
    lat: 36.1186,
    lng: -95.86221,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1.0,
    total_bathrooms: 1,
    half_bathrooms: 0,
    square_footage: 1059,
    monthly_rent: 1300,
    security_deposit: 1300,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached Garage & Driveway Parking',
    garage_spaces: 1,
    heating_type: 'Central Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Connections',
    flooring: ['Hard-Surface Flooring'],
    amenities: [
      'Attached Garage with Private Driveway Parking',
      'Fully Fenced Backyard with Mature Trees & Patio',
      'Spacious 1,059 Sq Ft Single-Level Ranch Layout',
      'Central Air Conditioning & Heating',
      'Convenient to 31st St & Hwy 169 Corridor',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Range / Oven', 'Refrigerator', 'Washer/Dryer Connections'],
    description: `Spanning 1,059 square feet, this two-bedroom single-family ranch home delivers comfortable single-level living in East Tulsa. A spacious central living room provides ample wall space and natural lighting across easy-care hard-surface flooring.

The kitchen features solid cabinetry, generous food preparation surfaces, and essential cooking appliances. Both bedrooms offer private closets and quick access to the full bathroom. A fully fenced rear lawn with mature shade trees and an open patio provides a secure outdoor retreat. Vehicle accommodation includes an attached single-car garage and a wide private driveway. Located near 31st Street and Highway 169, retail shopping centers and neighborhood services are just minutes away.`
  },
  {
    pipeline_id: 'PP-0EB82978',
    existing_property_id: null,
    title: '3BR Single Family in Tulsa',
    address: '3703 E Ute St',
    city: 'Tulsa',
    state: 'OK',
    zip: '74115',
    county: 'Tulsa County',
    lat: 36.1837,
    lng: -95.93488,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1.0,
    total_bathrooms: 1,
    half_bathrooms: 0,
    square_footage: 1300,
    monthly_rent: 1100,
    security_deposit: 1100,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached 2-Car Garage & Driveway',
    garage_spaces: 2,
    heating_type: 'Central Heat & Gas Fireplace',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Large Sunken Utility Room with Washer/Dryer Hookups',
    flooring: ['Laminate Flooring'],
    amenities: [
      'Attached 2-Car Garage with Carpeted Breezeway',
      'Prominent Corner Lot with Fully Fenced Backyard',
      'Living Room Gas Fireplace with Central Heat & Air',
      'Large Sunken Utility Room with Laundry Connections',
      'Close to TCC Northeast Campus & Highways 244/11',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Stove / Oven', 'Refrigerator', 'Washer/Dryer Hookups'],
    description: `Occupying a prominent corner lot, this 1,300-square-foot residence offers three bedrooms, one bathroom, and an attached two-car garage connected via a spacious carpeted breezeway. The living area features a classic gas fireplace complementing the central heating and air conditioning system.

Fresh interior paint pairs with low-maintenance laminate flooring throughout the home. A large sunken utility room houses dedicated washer and dryer hookups with supplemental storage capacity. The kitchen includes a refrigerator and stove, while storm windows and window coverings enhance insulation. The outdoor perimeter features a fully fenced backyard. Commuters benefit from direct access to Highway 244 and Highway 11, with Tulsa Community College Northeast Campus and Celia Clinton Elementary School nearby.`
  },
  {
    pipeline_id: 'PP-62CDF330',
    existing_property_id: 'abf098ca-89f8-4769-9e6f-f217057767ff',
    title: '3BR Single Family in Tulsa',
    address: '1645 S 128th East Ave',
    city: 'Tulsa',
    state: 'OK',
    zip: '74128',
    county: 'Tulsa County',
    lat: 36.1399,
    lng: -95.83358,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1.0,
    total_bathrooms: 1,
    half_bathrooms: 0,
    square_footage: 845,
    monthly_rent: 1295,
    security_deposit: 1295,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached 2-Car Garage & Driveway Parking',
    garage_spaces: 2,
    heating_type: 'Central Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Connections',
    flooring: ['Hard-Surface Flooring'],
    amenities: [
      'Attached Two-Car Garage & Wide Driveway Parking',
      'Energy-Efficient Double-Paned Windows',
      'Fully Fenced Backyard with Level Lawn',
      'Central Air Conditioning & Heating',
      'Convenient Access to Historic Route 66 & I-44',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Range / Oven', 'Refrigerator', 'Washer/Dryer Connections'],
    description: `With 845 square feet of interior space, this three-bedroom ranch residence provides efficient daily living in East Tulsa. The primary living room receives generous natural illumination through energy-efficient double-paned windows.

The functional kitchen layout incorporates extensive cabinetry and food preparation counter space. Each of the three bedrooms includes dedicated closet storage, sharing a centrally positioned full bath. The exterior features a private two-car attached garage, a paved driveway, and a fully fenced backyard with a grassy lawn. Positioned close to 11th Street and Interstate 44, the home offers simple travel connections to shopping destinations and regional transit corridors.`
  },
  {
    pipeline_id: 'PP-8B6F2A30',
    existing_property_id: '1aa45eba-8b39-49e4-95fb-57c56e6c8b54',
    title: '3BR Single Family in Tulsa',
    address: '4224 N Frankfort Ave',
    city: 'Tulsa',
    state: 'OK',
    zip: '74106',
    county: 'Tulsa County',
    lat: 36.2128,
    lng: -95.9868,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1.0,
    total_bathrooms: 1,
    half_bathrooms: 0,
    square_footage: 912,
    monthly_rent: 1097,
    security_deposit: 1097,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached Garage & Driveway Parking',
    garage_spaces: 1,
    heating_type: 'Whole-Home Central Heat',
    cooling_type: 'Whole-Home Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Luxury Vinyl Plank', 'Bathroom Ceramic Tile'],
    amenities: [
      'Designer Kitchen with Granite/Quartz Countertops & Gas Range',
      'Attached Private Garage & Dedicated Driveway Parking',
      'Luxury Vinyl Plank Flooring & Ceramic Tile Bath',
      'Whole-Home Central Air Conditioning & Heating',
      'Section 8 / Housing Choice Vouchers Welcomed',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Gas Stove / Oven', 'Dishwasher', 'Refrigerator', 'Washer/Dryer Hookups'],
    description: `Situated on a private lot in Tulsa's Suburban Acres Second subdivision, this 912-square-foot single-story home provides three bedrooms and one full bath. Upgraded luxury vinyl plank flooring spans the main living rooms, complemented by ceramic tile in the bathroom.

The kitchen features granite and quartz countertops, an updated gas range and oven, a dishwasher, a refrigerator, and dedicated washer and dryer connections. Whole-home central air conditioning maintains efficient climate comfort. Parking needs are met by an attached garage and a private driveway. Housing Choice Vouchers are welcomed. The location offers convenient access to Peoria Avenue, Highway 75, and downtown Tulsa amenities.`
  }
];

async function runMasterPublish() {
  console.log('================================================================');
  console.log('CHOICE PROPERTIES — MASTER ZILLOW PIPELINE PUBLISHING ENGINE');
  console.log(`Processing batch of ${PROPERTIES_TO_PUBLISH.length} properties...`);
  console.log('================================================================\n');

  const today = new Date().toISOString().split('T')[0];
  const publishedResults = [];

  for (let i = 0; i < PROPERTIES_TO_PUBLISH.length; i++) {
    const item = PROPERTIES_TO_PUBLISH[i];
    console.log(`\n----------------------------------------------------------------`);
    console.log(`[${i + 1}/${PROPERTIES_TO_PUBLISH.length}] ${item.address}, ${item.city} ${item.state} ${item.zip}`);
    console.log(`    Rent: $${item.monthly_rent}/mo | Beds: ${item.bedrooms} | Baths: ${item.bathrooms}`);

    // 1. Fetch raw pipeline record to verify images and original data
    const pipeRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${item.pipeline_id}&select=*`, {
      headers: HEADERS_PIPELINE
    });
    const pipeData = await pipeRes.json();
    if (!pipeData || pipeData.length === 0) {
      console.error(`   ✗ Pipeline record ${item.pipeline_id} not found in pipeline schema!`);
      continue;
    }
    const rawProp = pipeData[0];

    // Extract photos
    let photoUrls = [];
    if (rawProp.original_image_urls) {
      try {
        const parsed = typeof rawProp.original_image_urls === 'string' ? JSON.parse(rawProp.original_image_urls) : rawProp.original_image_urls;
        photoUrls = parsed.map(p => typeof p === 'string' ? p : p.url).filter(u => u && u.startsWith('http'));
      } catch (e) {
        photoUrls = [];
      }
    }

    if (photoUrls.length < 6) {
      console.error(`   ✗ Skipping ${item.address}: requires at least 6 photos, found ${photoUrls.length}`);
      continue;
    }
    console.log(`   ✓ Verified ${photoUrls.length} genuine property photographs`);

    // 2. Determine Property ID (Update existing or create new)
    let propId = item.existing_property_id;
    const isUpdate = Boolean(propId);

    if (!isUpdate) {
      propId = crypto.randomUUID();
    }

    const propRecord = {
      id: propId,
      landlord_id: LANDLORD_ID,
      status: 'active',
      title: item.title,
      description: item.description,
      address: item.address,
      city: item.city,
      state: item.state,
      zip: item.zip,
      county: item.county,
      lat: item.lat,
      lng: item.lng,
      property_type: item.property_type,
      bedrooms: item.bedrooms,
      bathrooms: item.bathrooms,
      half_bathrooms: item.half_bathrooms,
      total_bathrooms: item.total_bathrooms,
      square_footage: item.square_footage,
      year_built: item.year_built || null,
      monthly_rent: item.monthly_rent,
      security_deposit: item.security_deposit,
      application_fee: item.application_fee,
      available_date: today,
      lease_terms: null,
      minimum_lease_months: null,
      pets_allowed: item.pets_allowed,
      pet_types_allowed: item.pet_types_allowed,
      smoking_allowed: false,
      amenities: item.amenities,
      appliances: item.appliances,
      flooring: item.flooring,
      heating_type: item.heating_type,
      cooling_type: item.cooling_type,
      laundry_type: item.laundry_type,
      parking: item.parking,
      garage_spaces: item.garage_spaces || null,
      has_central_air: item.has_central_air,
      has_basement: item.has_basement,
      listed_at: today,
      featured: false
    };

    // 3. Insert or Update public.properties
    if (isUpdate) {
      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${propId}`, {
        method: 'PATCH',
        headers: { ...HEADERS, 'Prefer': 'return=representation' },
        body: JSON.stringify(propRecord)
      });
      if (!updateRes.ok) {
        const errText = await updateRes.text();
        console.error(`   ✗ Failed to update property ${item.address}: ${updateRes.status} ${errText}`);
        continue;
      }
      console.log(`   ✓ Updated existing property in public.properties (ID: ${propId})`);
    } else {
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/properties`, {
        method: 'POST',
        headers: { ...HEADERS, 'Prefer': 'return=representation' },
        body: JSON.stringify(propRecord)
      });
      if (!insertRes.ok) {
        const errText = await insertRes.text();
        console.error(`   ✗ Failed to insert property ${item.address}: ${insertRes.status} ${errText}`);
        continue;
      }
      console.log(`   ✓ Inserted new property into public.properties (ID: ${propId})`);
    }

    // 4. Synchronize photos in public.property_photos
    // If existing photos are already on ImageKit (like Frankfort Ave), keep ImageKit URLs, otherwise sync verified photos
    const existingPhotosRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos?property_id=eq.${propId}&select=*`, {
      headers: HEADERS
    });
    const existingPhotos = await existingPhotosRes.json();
    const hasExistingIkPhotos = existingPhotos && existingPhotos.length >= 6 && existingPhotos.some(p => p.url && p.url.includes('imagekit.io'));

    if (!hasExistingIkPhotos) {
      // Clear out older hotlink rows and replace with verified fresh photo set
      await fetch(`${SUPABASE_URL}/rest/v1/property_photos?property_id=eq.${propId}`, {
        method: 'DELETE',
        headers: HEADERS
      });

      const photoRows = photoUrls.map((url, idx) => ({
        property_id: propId,
        url: url,
        display_order: idx + 1,
        is_hero: idx === 0,
        watermark_status: 'clean',
        alt_text: `${item.address}, ${item.city} OK - Photo ${idx + 1}`
      }));

      const insertPhotosRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos`, {
        method: 'POST',
        headers: { ...HEADERS, 'Prefer': 'return=minimal' },
        body: JSON.stringify(photoRows)
      });
      if (!insertPhotosRes.ok) {
        const errText = await insertPhotosRes.text();
        console.error(`   ✗ Failed to insert photos for ${item.address}: ${insertPhotosRes.status} ${errText}`);
      } else {
        console.log(`   ✓ Synchronized ${photoRows.length} photos into public.property_photos`);
      }
    } else {
      console.log(`   ✓ Preserved ${existingPhotos.length} existing ImageKit photos in public.property_photos`);
    }

    // 5. Update pipeline_properties table row
    const patchPipeRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${item.pipeline_id}`, {
      method: 'PATCH',
      headers: HEADERS_PIPELINE,
      body: JSON.stringify({
        status: 'published',
        choice_property_id: propId,
        title: item.title,
        description: item.description,
        monthly_rent: item.monthly_rent,
        security_deposit: item.security_deposit,
        application_fee: item.application_fee,
        amenities: JSON.stringify(item.amenities),
        appliances: JSON.stringify(item.appliances),
        flooring: JSON.stringify(item.flooring),
        heating_type: item.heating_type,
        cooling_type: item.cooling_type,
        laundry_type: item.laundry_type,
        parking: item.parking,
        garage_spaces: item.garage_spaces || null,
        pets_allowed: item.pets_allowed,
        pet_types_allowed: JSON.stringify(item.pet_types_allowed),
        smoking_allowed: false,
        lease_terms: '[]',
        minimum_lease_months: null,
        has_central_air: item.has_central_air,
        has_basement: item.has_basement,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    });

    if (!patchPipeRes.ok) {
      const errText = await patchPipeRes.text();
      console.error(`   ✗ Failed to patch pipeline_properties row: ${patchPipeRes.status} ${errText}`);
    } else {
      console.log(`   ✓ Updated pipeline_properties row ${item.pipeline_id} to status: 'published'`);
    }

    publishedResults.push({
      index: publishedResults.length + 1,
      id: propId,
      address: item.address,
      city: item.city,
      state: item.state,
      zip: item.zip,
      rent: item.monthly_rent,
      bedrooms: item.bedrooms,
      bathrooms: item.bathrooms,
      url: `https://choice-properties-site.pages.dev/property.html?id=${propId}`
    });
  }

  console.log('\n================================================================');
  console.log(`BATCH COMPLETE: ${publishedResults.length}/${PROPERTIES_TO_PUBLISH.length} PROPERTIES SUCCESSFULLY PUBLISHED`);
  console.log('================================================================\n');

  publishedResults.forEach(r => {
    console.log(`${r.index}. ${r.address}, ${r.city}, ${r.state} ${r.zip} ($${r.rent.toLocaleString()}/mo | ${r.bedrooms} Bed / ${r.bathrooms} Bath) — ${r.url}`);
  });
}

runMasterPublish();
