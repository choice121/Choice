import { CREDENTIALS_CONFIG } from '../credentials-config.mjs';
import crypto from 'crypto';
import fs from 'fs';

const SUPABASE_URL = CREDENTIALS_CONFIG.SUPABASE_URL;
const KEY = CREDENTIALS_CONFIG.SUPABASE_API_KEY;
const LANDLORD_ID = 'b8d3aea0-f466-49f2-ac07-2b2b40793cc9';
const SITE_URL = 'https://choice-properties-site.pages.dev';

const HEADERS = {
  'apikey': KEY,
  'Authorization': 'Bearer ' + KEY,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

const HEADERS_PIPELINE = {
  'apikey': KEY,
  'Authorization': 'Bearer ' + KEY,
  'Content-Type': 'application/json',
  'Accept-Profile': 'pipeline',
  'Content-Profile': 'pipeline',
  'Prefer': 'return=representation'
};

// 7 Charlotte Zillow Properties manually enriched with verified information and target price rule:
// If original > 2200 -> reduce to 2200; if <= 2200 -> keep original price
const CHARLOTTE_2200_PROPERTIES = [
  {
    pipeline_id: 'PP-3D051276',
    address: '2281 Winthrop Chase Dr',
    city: 'Charlotte',
    state: 'NC',
    zip: '28212',
    county: 'Mecklenburg County',
    neighborhood: 'Winthrop Chase / East Charlotte',
    lat: 35.1824,
    lng: -80.7381,
    property_type: 'TOWNHOUSE',
    bedrooms: 4,
    bathrooms: 2.5,
    half_bathrooms: 1,
    total_bathrooms: 3,
    square_footage: 2008,
    monthly_rent: 1950, // <= 2200 kept at 1950
    security_deposit: 1950,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached Garage & Off-Street Driveway',
    garage_spaces: 1,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated Main-Level Laundry Room',
    flooring: ['Luxury Vinyl Plank (LVP)', 'Plush Carpet Upstairs', 'Tile'],
    amenities: [
      'Substantial 2,008 Sq. Ft. End-Unit Townhome',
      'High Ceilings & Large Windows Providing Abundant Natural Light',
      'Focal Fireplace Separating Living and Dining Spaces',
      'Kitchen with Stainless Steel Appliances & Subway Tile Backsplash',
      'Private Back Patio for Outdoor Living & Grilling',
      'Spacious Primary Bedroom Suite with Generous Walk-In Closet',
      'Attached 1-Car Garage & Private Driveway',
      'Walkable to Independence Square Retail & McAlpine Creek Greenway',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Stainless Steel Refrigerator', 'Stainless Steel Range / Oven', 'Stainless Steel Dishwasher', 'Microwave', 'Washer/Dryer Hookups'],
    description: `A spacious 2,008 sq. ft. end-unit layout, high ceilings, a focal fireplace, and an attached garage highlight this 4-bedroom, 2.5-bathroom townhome situated between Uptown Charlotte and Matthews.

The main level features luxury vinyl plank flooring, high ceilings, and an open floor plan where the light-filled living and dining rooms are anchored by a central fireplace. The kitchen is outfitted with stainless steel appliances, crisp subway tile backsplash, and direct access to a private back patio. A main-floor half bathroom and dedicated laundry room complete the first level.

Upstairs, the home offers four spacious bedrooms with plush carpeting, including a large primary suite with abundant closet storage, alongside two full bathrooms. The attached single-car garage provides protected parking and storage. Located within walking distance of Independence Square shops, dining, and scenic McAlpine Creek Greenway trails.

Key Property Features:
• 4 Bedrooms, 2.5 Bathrooms (2,008 sq. ft. End-Unit)
• Open layout with high ceilings and central fireplace
• Kitchen with stainless steel appliances and subway tile backsplash
• Private rear patio and attached 1-car garage
• Primary suite with expansive closet capacity
• Walking distance to McAlpine Creek Greenway trails & Independence Square
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,950
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-90B6B1EF',
    address: '2027 Tears Ln',
    city: 'Charlotte',
    state: 'NC',
    zip: '28217',
    county: 'Mecklenburg County',
    neighborhood: 'Southwest Charlotte / Airport Corridor',
    lat: 35.1845,
    lng: -80.9189,
    property_type: 'TOWNHOUSE',
    bedrooms: 4,
    bathrooms: 3.5,
    half_bathrooms: 1,
    total_bathrooms: 4,
    square_footage: 2003,
    monthly_rent: 2200, // Reduced from 2290 to 2200
    security_deposit: 2200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached 2-Car Garage & Driveway',
    garage_spaces: 2,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Third-Floor Laundry Room with Washer & Dryer Included',
    flooring: ['Hardwood-Style Flooring', 'Tile', 'Plush Carpet'],
    amenities: [
      'Modern 3-Story Townhome (2,003 Sq. Ft.) with 2-Car Garage',
      'Ground-Level Suite with Bedroom and Private Full Bathroom',
      'Second-Floor Open Living Area with Private Rear Balcony',
      'Gourmet Kitchen with Quartz Countertops & Large Center Island',
      'Stainless Steel Appliances Suite',
      'In-Unit Washer and Dryer Included on Bedroom Level',
      'Spacious Primary Suite with Private Bathroom on Third Floor',
      'Minutes from Charlotte Douglas International Airport & Major Interstates',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Stainless Refrigerator', 'Stainless Range / Oven', 'Stainless Dishwasher', 'Stainless Microwave', 'Washer', 'Dryer'],
    description: `A three-story design, attached 2-car garage, quartz center island kitchen, and ground-level guest suite define this 4-bedroom, 3.5-bathroom townhome in Southwest Charlotte.

The ground floor features an attached 2-car garage along with a private bedroom and full bathroom, ideal for guests, multi-generational living, or a quiet home office. The second floor showcases an expansive open living and dining area with access to a private rear balcony, alongside a gourmet kitchen with quartz countertops, a large center island, and stainless steel appliances.

The third floor houses a generous primary suite with an en-suite full bath, two additional bedrooms, a third full bathroom, and a laundry room equipped with a washer and dryer. Located just minutes from Charlotte Douglas International Airport, I-77, and South Boulevard amenities.

Key Property Features:
• 4 Bedrooms, 3.5 Bathrooms (2,003 sq. ft. across 3 Levels)
• Gourmet kitchen with quartz countertops, center island, and stainless appliances
• Ground-floor suite with dedicated full bathroom
• Private second-floor rear balcony
• Attached 2-car garage and driveway parking
• Washer and dryer included in third-floor laundry room
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $2,200 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  },
  {
    pipeline_id: 'PP-8FCBF5E7',
    address: '11022 Garden Oaks Ln',
    city: 'Charlotte',
    state: 'NC',
    zip: '28273',
    county: 'Mecklenburg County',
    neighborhood: 'Southwest Charlotte / Steele Creek Corridor',
    lat: 35.1221,
    lng: -80.9384,
    property_type: 'TOWNHOUSE',
    bedrooms: 4,
    bathrooms: 3.5,
    half_bathrooms: 1,
    total_bathrooms: 4,
    square_footage: 2160,
    monthly_rent: 2200, // Reduced from 2250 to 2200
    security_deposit: 2200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached Garage & Off-Street Parking',
    garage_spaces: 1,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Dedicated Laundry Room',
    flooring: ['Hardwood-Style Plank Flooring', 'Plush Carpet', 'Tile'],
    amenities: [
      'Expansive 2,160 Sq. Ft. Multi-Level Floor Plan',
      '4 Generous Bedrooms with 3.5 Bathrooms',
      'Modern Kitchen with Abundant Cabinetry & Prep Space',
      'Bright Living Room with Large Windows & Open Layout',
      'Attached Garage & Off-Street Parking',
      'Central Heating & Air Conditioning System',
      'Convenient to Rivergate Shopping, Lake Wylie & I-485',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Washer/Dryer Hookups'],
    description: `Generous 2,160 sq. ft. proportions, a versatile 4-bedroom layout, and 3.5 bathrooms highlight this modern townhome in Southwest Charlotte.

The home welcomes you into an open living and dining space with durable plank flooring and oversized windows that bathe the interior in natural light. The kitchen offers abundant cabinetry, generous countertop prep areas, and dependable appliances for everyday cooking.

The multi-level design provides four comfortable bedrooms with excellent closet storage, supported by three full bathrooms and a main-level guest powder room. The property includes an attached garage and off-street parking. Situated in the Steele Creek area with fast access to Rivergate shopping center, Lake Wylie recreation, and I-485.

Key Property Features:
• 4 Bedrooms, 3.5 Bathrooms (2,160 sq. ft.)
• Multi-level floor plan with generous natural lighting
• Kitchen with ample cabinet storage and full appliances
• 3 full bathrooms plus guest powder room
• Attached garage and private off-street parking
• Close to Rivergate shopping and I-485
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $2,200 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-32716C9B',
    address: '4143 Lurelin Ln',
    city: 'Charlotte',
    state: 'NC',
    zip: '28262',
    county: 'Mecklenburg County',
    neighborhood: 'Mallard Creek Towns / University City',
    lat: 35.3456,
    lng: -80.7812,
    property_type: 'TOWNHOUSE',
    bedrooms: 4,
    bathrooms: 2.5,
    half_bathrooms: 1,
    total_bathrooms: 3,
    square_footage: 1554,
    monthly_rent: 2200, // <= 2200 kept at 2200
    security_deposit: 2200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached 1-Car Garage & Driveway',
    garage_spaces: 1,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Included',
    flooring: ['Hardwood-Style Flooring', 'Plush Carpet Upstairs', 'Tile'],
    amenities: [
      'Like-New Construction in Mallard Creek Towns',
      'Chef’s Kitchen with Stainless Steel Appliances & Center Island',
      'In-Unit Washer and Dryer Included',
      'Attached 1-Car Garage and Private Concrete Driveway',
      'Spacious Rear Patio and Flat Green Yard',
      '4 Bedrooms with Generous Closets & 2.5 Bathrooms',
      'Minutes to Wells Fargo, Vanguard, TIAA & BofA Corporate Campuses',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Stainless Steel Refrigerator', 'Stainless Steel Range / Oven', 'Stainless Steel Dishwasher', 'Microwave', 'Washer', 'Dryer'],
    description: `Like-new construction in Mallard Creek Towns, a chef's kitchen with stainless steel appliances, an attached garage, and a spacious flat yard highlight this 4-bedroom, 2.5-bathroom townhome.

The open main level features clean flooring and flows directly into a modern chef's kitchen equipped with stainless steel appliances, quality cabinetry, and center island prep space. Sliding glass doors lead to an outdoor rear patio and level lawn area suitable for outdoor activities.

Upstairs, four well-proportioned bedrooms provide peaceful quarters with plush carpeting and ample storage, accompanied by two full bathrooms and a main-floor guest half bath. Washer and dryer are included in the home. Located near University Research Park, UNC Charlotte, and major employment centers including Wells Fargo, Vanguard, TIAA, and Bank of America campuses.

Key Property Features:
• 4 Bedrooms, 2.5 Bathrooms (1,554 sq. ft.)
• Like-new townhome in Mallard Creek Towns
• Chef's kitchen with stainless steel appliances and center island
• In-unit washer and dryer included
• Attached 1-car garage and private driveway
• Rear patio and flat green yard space
• Proximity to University Research Park and I-85/I-485
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $2,200
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-D6C6F7D2',
    address: '3327 Ellingford Rd',
    city: 'Charlotte',
    state: 'NC',
    zip: '28214',
    county: 'Mecklenburg County',
    neighborhood: 'Moores Chapel / West Charlotte',
    lat: 35.2712,
    lng: -80.9634,
    property_type: 'TOWNHOUSE',
    bedrooms: 4,
    bathrooms: 2.5,
    half_bathrooms: 1,
    total_bathrooms: 3,
    square_footage: 1704,
    monthly_rent: 2150, // <= 2200 kept at 2150
    security_deposit: 2150,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Dedicated Off-Street Parking',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Dedicated Laundry Area',
    flooring: ['Hardwood-Style Flooring', 'Tile', 'Plush Carpet'],
    amenities: [
      'Spacious 1,704 Sq. Ft. End-Unit Townhome with Extra Windows',
      'Granite Countertops & Full Kitchen Appliance Package',
      'Expansive Primary Suite Featuring Vaulted Ceilings',
      'Open Living and Dining Area with Natural Daylight',
      'Dedicated Off-Street Parking Spaces',
      'Central Heating & Air Conditioning System',
      'Fast Access to I-485, I-85, and Charlotte Douglas Airport',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Washer/Dryer Hookups'],
    description: `End-unit positioning with extra natural lighting, granite kitchen countertops, and a primary suite with vaulted ceilings define this 4-bedroom, 2.5-bathroom townhome in West Charlotte.

The main level offers an expansive open layout with durable flooring, connecting the living and dining areas to a kitchen outfitted with granite countertops, quality cabinetry, and dependable appliances. A main-floor half bath serves guests.

Upstairs, four bedrooms provide flexible accommodations, led by an expansive primary suite with vaulted ceilings, private en-suite bathroom, and generous closet space. End-unit construction provides added tranquility and side windows. Located with swift access to I-485, I-85, Charlotte Douglas International Airport, and the US National Whitewater Center.

Key Property Features:
• 4 Bedrooms, 2.5 Bathrooms (1,704 sq. ft. End-Unit)
• Granite kitchen countertops with full appliances
• Primary suite with vaulted ceilings and en-suite bath
• End-unit layout with abundant natural lighting
• Dedicated off-street parking
• Fast access to I-485, I-85, and airport corridors
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $2,150
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  },
  {
    pipeline_id: 'PP-189E0200',
    address: '1117 Wonder Way',
    city: 'Charlotte',
    state: 'NC',
    zip: '28208',
    county: 'Mecklenburg County',
    neighborhood: 'West Charlotte / Ashley Park Area',
    lat: 35.2289,
    lng: -80.8872,
    property_type: 'TOWNHOUSE',
    bedrooms: 4,
    bathrooms: 2.5,
    half_bathrooms: 1,
    total_bathrooms: 3,
    square_footage: 1829,
    monthly_rent: 2200, // Reduced from 2300 to 2200
    security_deposit: 2200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached 1-Car Garage & Driveway',
    garage_spaces: 1,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Included',
    flooring: ['Contemporary Hardwood-Style Flooring', 'Plush Carpet', 'Tile'],
    amenities: [
      'Brand-New Modern 3-Story Townhome Construction (1,829 Sq. Ft.)',
      '3 Bedrooms Plus Dedicated Flex Room / 4th Bedroom with Closet',
      'Open-Concept Living and Dining with Contemporary Finishes',
      'Upgraded Kitchen with Stainless Steel Appliances & Disposal',
      'In-Unit Washer and Dryer Included',
      'Attached 1-Car Garage Plus Private Driveway Parking',
      'Minutes to Uptown Charlotte, VA Hospital & Charlotte Airport',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Stainless Refrigerator', 'Stainless Range / Oven', 'Stainless Dishwasher', 'Garbage Disposal', 'Washer', 'Dryer'],
    description: `Brand-new 3-story modern construction, an attached garage, in-unit washer/dryer, and a versatile 4-room layout (3 bedrooms plus flex room with closet) highlight this 1,829 sq. ft. townhome minutes from Uptown Charlotte.

The open-concept main floor features a bright living and dining area with clean modern flooring that connects effortlessly to an upgraded kitchen with stainless steel appliances, garbage disposal, and abundant cabinet storage.

The floor plan provides three spacious upper bedrooms and a versatile lower-level flex room with its own closet, ideal as a fourth bedroom, private office, or fitness space. In-unit washer and dryer are included. Complete with an attached single-car garage and private driveway. Positioned with rapid access to Uptown Charlotte, I-77, the VA Hospital, and local parks.

Key Property Features:
• 4 Bedrooms / Flex Spaces, 2.5 Bathrooms (1,829 sq. ft. 3-Story Build)
• Brand-new modern construction with pristine finishes
• Upgraded kitchen with stainless steel appliances
• In-unit washer and dryer included
• Attached 1-car garage and private driveway
• Minutes from Uptown Charlotte, I-77, and airport
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $2,200 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  },
  {
    pipeline_id: 'PP-ED2DBE03',
    address: '4129 Edenborn Ln',
    city: 'Charlotte',
    state: 'NC',
    zip: '28208',
    county: 'Mecklenburg County',
    neighborhood: 'South End Perimeter / FreeMoreWest',
    lat: 35.2214,
    lng: -80.8756,
    property_type: 'TOWNHOUSE',
    bedrooms: 4,
    bathrooms: 2.5,
    half_bathrooms: 1,
    total_bathrooms: 3,
    square_footage: 1691,
    monthly_rent: 2195, // <= 2200 kept at 2195
    security_deposit: 2195,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached Garage & Off-Street Parking',
    garage_spaces: 1,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Connections',
    flooring: ['Hardwood-Style Plank Flooring', 'Plush Carpet', 'Tile'],
    amenities: [
      'Brand-New Construction with Soaring 10-Foot Ceilings Throughout',
      'Open Kitchen with Large Island, Quartz Countertops & Stainless Appliances',
      '4 Flexible Bedrooms Including Ground-Level Suite / Private Office',
      'Just 1 Mile to Bank of America Stadium and South End Dining',
      'Modern High-End Finishes in All 2.5 Bathrooms',
      'Attached Garage and Dedicated Off-Street Parking',
      'Prime Proximity to Uptown Entertainment & Transit',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Stainless Steel Refrigerator', 'Stainless Steel Range / Oven', 'Stainless Steel Dishwasher', 'Microwave', 'Washer/Dryer Hookups'],
    description: `Brand-new construction with 10-foot ceilings, quartz kitchen island, and an unbeatable location just 1 mile from Bank of America Stadium and South End highlight this 4-bedroom, 2.5-bathroom townhome.

The home features 10-foot ceilings creating an expansive, airy feel throughout. The open gourmet kitchen is centered around a large entertaining island with quartz countertops, soft-close cabinets, and premium stainless steel appliances.

The versatile floor plan offers four bedroom spaces, including a ground-level room perfect for a private home office or studio, along with three upper bedrooms and 2.5 updated bathrooms. Complete with an attached garage and off-street parking. Located just a mile from South End restaurants, breweries, light rail, and Uptown sporting venues.

Key Property Features:
• 4 Bedrooms / Workspaces, 2.5 Bathrooms (1,691 sq. ft.)
• Brand-new construction with 10-foot ceilings throughout
• Gourmet kitchen with quartz countertops and entertaining island
• Versatile ground-level room for bedroom or office
• Attached garage and off-street parking
• 1 mile to Bank of America Stadium, South End & Uptown
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $2,195
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  }
];

async function publishCharlotte2200Batch() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('  Choice Properties — Charlotte Zillow Publishing ($2,200 Target)');
  console.log(`  Processing ${CHARLOTTE_2200_PROPERTIES.length} Fully Enriched Properties`);
  console.log('  Pricing Rule: Over $2,200 reduced to $2,200; <= $2,200 kept as-is');
  console.log('═════════════════════════════════════════════════════════════════\n');

  const rawPipelineData = JSON.parse(fs.readFileSync('scripts/charlotte_zillow_target.json', 'utf8'));
  const rawMap = new Map(rawPipelineData.map(p => [p.id, p]));

  const publishedResults = [];
  const today = new Date().toISOString().split('T')[0];

  for (let i = 0; i < CHARLOTTE_2200_PROPERTIES.length; i++) {
    const item = CHARLOTTE_2200_PROPERTIES[i];
    const pipeId = item.pipeline_id;
    const rawProp = rawMap.get(pipeId);

    console.log(`[${i + 1}/${CHARLOTTE_2200_PROPERTIES.length}] Processing ${item.address} (${item.bedrooms}BR/${item.bathrooms}BA) - $${item.monthly_rent}/mo...`);

    // 1. Get raw photos from pipeline
    let photoUrls = [];
    if (rawProp && rawProp.original_image_urls) {
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

    // 2. Check if property already exists in public.properties by address
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?address=eq.${encodeURIComponent(item.address)}&select=id`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
    });
    const existingRows = await checkRes.json();
    let propId = existingRows.length > 0 ? existingRows[0].id : null;
    const isUpdate = Boolean(propId);

    if (!propId) {
      propId = crypto.randomUUID();
    }

    const title = `${item.bedrooms}BR/${item.bathrooms}BA Home in ${item.city} – $${item.monthly_rent}/mo`;

    const propRecord = {
      id: propId,
      landlord_id: LANDLORD_ID,
      status: 'active',
      title: title,
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
      garage_spaces: item.garage_spaces,
      has_central_air: item.has_central_air,
      has_basement: item.has_basement,
      listed_at: today,
      featured: false
    };

    if (isUpdate) {
      const updatePropRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${propId}`, {
        method: 'PATCH',
        headers: HEADERS,
        body: JSON.stringify(propRecord)
      });
      if (!updatePropRes.ok) {
        const errText = await updatePropRes.text();
        console.error(`   ✗ Failed to update property ${item.address}: ${updatePropRes.status} ${errText}`);
        continue;
      }
      console.log(`   ✓ Updated existing property in public.properties (ID: ${propId})`);
    } else {
      const insertPropRes = await fetch(`${SUPABASE_URL}/rest/v1/properties`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(propRecord)
      });
      if (!insertPropRes.ok) {
        const errText = await insertPropRes.text();
        console.error(`   ✗ Failed to insert property ${item.address}: ${insertPropRes.status} ${errText}`);
        continue;
      }
      console.log(`   ✓ Inserted property into public.properties (ID: ${propId})`);
    }

    // 4. Synchronize photos in public.property_photos
    await fetch(`${SUPABASE_URL}/rest/v1/property_photos?property_id=eq.${propId}`, {
      method: 'DELETE',
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
    });

    const photoInserts = photoUrls.map((url, pIdx) => ({
      property_id: propId,
      url: url,
      display_order: pIdx,
      is_hero: pIdx === 0,
      caption: `${item.address} - Photo ${pIdx + 1}`
    }));

    const photoRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(photoInserts)
    });
    if (!photoRes.ok) {
      console.error(`   ✗ Failed to insert photos for ${item.address}`);
    } else {
      console.log(`   ✓ Synced ${photoInserts.length} photos`);
    }

    // 5. Update pipeline record status to published
    await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${pipeId}`, {
      method: 'PATCH',
      headers: HEADERS_PIPELINE,
      body: JSON.stringify({
        status: 'published',
        published_property_id: propId,
        published_at: new Date().toISOString()
      })
    });

    publishedResults.push({
      n: publishedResults.length + 1,
      id: propId,
      address: item.address,
      city: item.city,
      state: item.state,
      zip: item.zip,
      rent: item.monthly_rent,
      beds: item.bedrooms,
      baths: item.bathrooms,
      url: `${SITE_URL}/property.html?id=${propId}`
    });
  }

  fs.writeFileSync('scripts/published_charlotte_2200_results.json', JSON.stringify(publishedResults, null, 2));

  console.log('\n═════════════════════════════════════════════════════════════════');
  console.log(`  Published ${publishedResults.length} Charlotte properties successfully!`);
  console.log('═════════════════════════════════════════════════════════════════\n');

  publishedResults.forEach(r => {
    console.log(`${r.n}. ${r.address}, ${r.city}, ${r.state} ${r.zip} ($${r.rent.toLocaleString()}/mo | ${r.beds} Bed / ${r.baths} Bath) — ${r.url}`);
  });
}

publishCharlotte2200Batch().catch(console.error);
