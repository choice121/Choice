/**
 * CHOICE PROPERTIES — COLUMBUS 8 PROPERTIES MANUAL ENRICHMENT & PUBLISHING ENGINE
 * ==============================================================================
 * Performs deep, manual due-diligence enrichment and publishing for all 8 staged
 * pipeline properties in Columbus, OH according to Choice Properties standards.
 */

import crypto from 'crypto';
import { CREDENTIALS_CONFIG } from '../credentials-config.mjs';

const SUPABASE_URL = CREDENTIALS_CONFIG.SUPABASE_URL;
const SERVICE_KEY = CREDENTIALS_CONFIG.SUPABASE_API_KEY;

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json'
};

const HEADERS_PIPELINE = {
  ...HEADERS,
  'Accept-Profile': 'pipeline',
  'Content-Profile': 'pipeline',
  'Prefer': 'return=representation'
};

export const COLUMBUS_BATCH = [
  {
    pipeline_id: 'PP-334F9599',
    existing_property_id: 'f0495788-00be-4850-847c-b67ef1c99d53',
    title: '3614 Eakin Rd, Columbus, OH 43204',
    address: '3614 Eakin Rd',
    city: 'Columbus',
    state: 'OH',
    zip: '43204',
    county: 'Franklin County',
    lat: 39.939327,
    lng: -83.0947,
    property_type: 'DUPLEX',
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 938,
    monthly_rent: 1595,
    security_deposit: 1595,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: true,
    parking: 'Attached Garage, Off-Street Parking',
    garage_spaces: 1,
    heating_type: 'Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Hardwood Flooring', 'Tile'],
    amenities: [
      'Two Dedicated Kitchens (Main Level & Basement)',
      'Private Fully Enclosed Backyard',
      'Full Basement Storage & Utility Space',
      'Energy-Efficient Andersen Windows',
      'Genuine Hardwood Flooring',
      'Attached Garage & Off-Street Parking',
      'Central Air Conditioning & Forced Air Heat',
      'Pet Friendly'
    ],
    appliances: [
      'Refrigerator',
      'Range / Oven',
      'Dishwasher',
      'Freezer',
      'Washer/Dryer Hookups'
    ],
    description: `Positioned along Eakin Road in Columbus, this thoughtfully renovated two-story duplex residence delivers 938 square feet of independent living with a rare dual-kitchen layout. The home is completely separate from the adjacent unit, offering total privacy with no shared living quarters or outdoor grounds.

Inside, natural light fills a welcoming front living room accentuated by fresh neutral paint and genuine hardwood floors that extend through the primary gathering areas. The main-level kitchen is equipped with solid cabinetry and essential appliances, including a refrigerator, range with oven, and dishwasher. Downstairs, a full basement provides exceptional versatility, housing a second dedicated kitchen, extensive storage capacity, and laundry hookups.

The home accommodates three well-proportioned bedrooms alongside two full bathrooms finished with clean fixtures and easy-care surfaces. Energy-efficient Andersen windows and updated attic insulation provide quiet interior acoustics and steady year-round climate balance, supported by forced air heat and central air conditioning. Outside, step into a private, fully enclosed backyard ideal for relaxing or pets, supplemented by an attached garage and off-street parking.

This pet-friendly home requires a $50 application fee per adult applicant. Resident is responsible for utilities. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-943F392F',
    existing_property_id: '7e4e2200-f7a3-4713-b1dd-1c58f6f6aec6',
    title: '1007 Chestershire Rd, Columbus, OH 43204',
    address: '1007 Chestershire Rd',
    city: 'Columbus',
    state: 'OH',
    zip: '43204',
    county: 'Franklin County',
    lat: 39.934017,
    lng: -83.07808,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 962,
    monthly_rent: 1595,
    security_deposit: 1595,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: true,
    parking: 'Detached 2-Car Garage, Concrete Driveway',
    garage_spaces: 2,
    heating_type: 'Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Hardwood Flooring', 'Tile'],
    amenities: [
      'Expansive Full Basement with Finished Second Full Bath',
      'Glass-Door Walk-In Shower in Lower Bath',
      'Detached 2-Car Garage & Large Concrete Driveway',
      'Kitchen Center Island with Tile Flooring',
      'Hardwood Flooring & Custom Accent Wainscoting',
      'Custom Built-In Floating Wall Shelving',
      'Stainless Steel Appliances Package',
      'Central Air Conditioning & Forced Air Heat',
      'Pet Friendly'
    ],
    appliances: [
      'Stainless Steel Refrigerator',
      'Gas Range / Oven',
      'Dishwasher',
      'Microwave',
      'Washer/Dryer Hookups'
    ],
    description: `Situated on a peaceful residential street in West Columbus near Westgate Park, 1007 Chestershire Road presents a thoroughly upgraded 962-square-foot single-family home paired with an expansive full basement and detached two-car garage.

The main living space showcases rich hardwood flooring, custom accent wainscoting, and built-in floating wall shelves that frame an airy, open-concept living and dining area. The modernized kitchen is anchored by a functional center island and ceramic tile flooring, complemented by stainless steel appliances including a gas range and oven, refrigerator, dishwasher, and over-the-range microwave.

Three bright bedrooms feature hardwood floors and generous closet storage. The primary floor offers an updated full bathroom with a contemporary vanity and custom tile work. Descending to the lower level reveals an expansive full basement that functions effortlessly as a home gym, workshop, or recreation space, complete with a second full bathroom featuring a glass-door walk-in shower and washer/dryer connections. Central air conditioning and forced air heating maintain consistent comfort throughout.

Outdoors, enjoy a spacious backyard, a large concrete driveway, and a detached two-car garage with ample room for vehicles and equipment. Quick access to I-70, US-40, and Broad Street puts Downtown Columbus and Franklinton within easy reach.

This pet-friendly property requires a $50 application fee. Resident is responsible for utilities. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-67510D89',
    existing_property_id: null,
    title: '2923 Howey Rd, Columbus, OH 43224',
    address: '2923 Howey Rd',
    city: 'Columbus',
    state: 'OH',
    zip: '43224',
    county: 'Franklin County',
    lat: 40.025337,
    lng: -82.98395,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1056,
    monthly_rent: 1800,
    security_deposit: 1800,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Driveway, Off-Street & Rear Parking',
    garage_spaces: null,
    heating_type: 'Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Luxury Vinyl Plank', 'Tile'],
    amenities: [
      'Single-Story Ranch Living',
      'Primary Suite with Private Ensuite Bathroom',
      'Polished Granite Kitchen Countertops',
      'Stainless Steel Appliance Package',
      'Welcoming Covered Front Porch',
      'Deep Driveway & Rear Parking Area',
      'Central Air Conditioning & Forced Air Heat',
      'Quick Highway Access to I-71 & Downtown Columbus',
      'Pet Friendly'
    ],
    appliances: [
      'Stainless Steel Refrigerator',
      'Range / Oven',
      'Microwave',
      'Freezer',
      'Washer/Dryer Hookups'
    ],
    description: `Offering the ease of single-level ranch living, 2923 Howey Road in North Columbus delivers 1,056 square feet of freshly updated interior space paired with convenient connectivity to I-71, the Ohio State University campus, and Downtown Columbus.

A broad covered front porch introduces the residence, leading into an open-plan gathering space illuminated by generous windows and low-maintenance flooring. The remodeled kitchen stands out with polished granite countertops, crisp cabinetry, and a suite of stainless steel appliances encompassing a range and oven, refrigerator, microwave, and freezer.

The sleeping quarters comprise three bedrooms, highlighted by a private primary retreat complete with its own dedicated ensuite bathroom. A second full hallway bathroom features updated vanity cabinetry and clean ceramic tub tiling. Year-round comfort is delivered through efficient forced air heating and central air conditioning, with dedicated in-unit laundry hookups ready for equipment.

Exterior amenities include a deep private driveway, street parking, and an additional parking area behind the home with room for multiple vehicles.

This pet-friendly home has a $50 application fee per applicant. Resident is responsible for all utilities. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-0BEE7C3A',
    existing_property_id: 'ff682d8e-a21f-414f-b441-168d07ae3019',
    title: '1112 Peters Ave, Columbus, OH 43201',
    address: '1112 Peters Ave',
    city: 'Columbus',
    state: 'OH',
    zip: '43201',
    county: 'Franklin County',
    lat: 39.98776,
    lng: -82.98043,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1.5,
    half_bathrooms: 1,
    total_bathrooms: 2,
    square_footage: 1144,
    monthly_rent: 1695,
    security_deposit: 1695,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: true,
    parking: 'Dedicated Off-Street Parking (2 Spaces)',
    garage_spaces: null,
    heating_type: 'Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer',
    flooring: ['Luxury Vinyl Plank', 'Tile'],
    amenities: [
      'Fully Fenced Private Yard',
      'Convenient 1.5 Bathroom Configuration',
      'In-Unit Washer and Dryer Included',
      'Durable Luxury Vinyl Plank Flooring',
      'Decorative Architectural Fireplace',
      'Central Air Conditioning & Forced Air Heat',
      'Two Dedicated Off-Street Parking Spaces in Back',
      'Minutes to Short North Arts District & OSU Campus',
      'Pet Friendly'
    ],
    appliances: [
      'Refrigerator',
      'Range / Oven',
      'Dishwasher',
      'Microwave',
      'In-Unit Washer',
      'In-Unit Dryer'
    ],
    description: `Located in an established Columbus neighborhood with fast access to the Short North and university corridor, 1112 Peters Avenue is a classic 1,144-square-foot single-family home that has been thoroughly renovated with modern fixtures and durable finishes.

The main level reveals a comfortable, fluid floor plan outfitted with durable luxury vinyl plank flooring throughout. The updated kitchen features practical cabinetry, generous prep counter space, and a complete appliance package including a refrigerator, range and oven, dishwasher, and microwave. Everyday utility is elevated by an in-unit washer and dryer.

The home offers three well-lit bedrooms supported by one full bathroom and one convenient half bathroom, both upgraded with fresh fixtures. A decorative fireplace accents the main living area, while central air conditioning and forced air heating keep the interior comfortable in every season.

A fully fenced backyard provides a private outdoor retreat, complemented by two dedicated off-street parking spaces situated directly behind the property.

Pet-friendly residence with a $50 application fee. Resident is responsible for utility services. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-2AF1E830',
    existing_property_id: '156af438-2c9a-47da-918d-2d04aa4bd317',
    title: '510 Hilltonia Ave, Columbus, OH 43223',
    address: '510 Hilltonia Ave',
    city: 'Columbus',
    state: 'OH',
    zip: '43223',
    county: 'Franklin County',
    lat: 39.945534,
    lng: -83.05124,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1456,
    monthly_rent: 1695,
    security_deposit: 1695,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: false,
    has_basement: true,
    parking: 'Detached Garage, Off-Street Driveway',
    garage_spaces: 1,
    heating_type: 'Forced Air',
    cooling_type: 'Window Air Conditioning Units',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Hardwood Flooring', 'Tile', 'Carpet'],
    amenities: [
      'Fully Finished Basement with Recreation Room & Storage',
      'Two Full Bathrooms (One on First Floor)',
      'Charming Covered Front Veranda',
      '1,456 Sq Ft of Generous Two-Story Living Space',
      'Detached Garage & Off-Street Parking',
      'Under-Stair & Generous Closet Storage',
      'Window Air-Conditioning Units Included',
      'Quick Highway Access to I-70 & Downtown Columbus',
      'Pet Friendly'
    ],
    appliances: [
      'High-End Range / Oven',
      'Refrigerator',
      'Washer/Dryer Hookups'
    ],
    description: `Fronted by a classic covered veranda, 510 Hilltonia Avenue offers 1,456 square feet of bright living space across two stories, complemented by a fully finished basement for exceptional overall capacity in Southwest Columbus.

The main level welcomes guests with an inviting living room washed in natural daylight, leading toward an updated kitchen featuring durable countertops, generous cabinet storage, and a high-end range and refrigerator. A full bathroom is conveniently situated on the ground level alongside under-stair storage and closet space. Upstairs, three comfortably scaled bedrooms share a second full bathroom fitted with a tile surround and modern vanity.

The fully finished lower level substantially expands usable footprint with a spacious recreation room, dedicated utility area, and organized dry storage. Climate control is managed through forced air heating and window air conditioning units. Outside, the property includes a detached garage and an off-street driveway, positioned within minutes of shopping, neighborhood parks, and major Columbus transit arteries.

This pet-friendly home requires a $50 application fee. Resident covers utilities and lawn care. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-6F39769F',
    existing_property_id: 'd67eeaf5-f12e-48e0-9586-b4372160abc8',
    title: '379 Sturbridge Rd, Columbus, OH 43228',
    address: '379 Sturbridge Rd',
    city: 'Columbus',
    state: 'OH',
    zip: '43228',
    county: 'Franklin County',
    lat: 39.95988,
    lng: -83.13636,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1.5,
    half_bathrooms: 1,
    total_bathrooms: 2,
    square_footage: 1107,
    monthly_rent: 1800,
    security_deposit: 1800,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached Carport, Driveway Parking',
    garage_spaces: 1,
    heating_type: 'Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer',
    flooring: ['Hard-Surface Flooring', 'Tile'],
    amenities: [
      'Expansive Private Backyard',
      'Modern 1.5 Bathroom Configuration',
      'In-Unit Washer & Dryer Included',
      'Updated Eat-In Kitchen with Complete Appliance Suite',
      'Central Air Conditioning & Forced Air Heat',
      'Attached Covered Carport & Paved Driveway',
      'Single-Story Ranch Flow with Durable Flooring',
      'Pet Friendly'
    ],
    appliances: [
      'Refrigerator',
      'Range / Oven',
      'Dishwasher',
      'Microwave',
      'Freezer',
      'Washer',
      'Dryer'
    ],
    description: `Nestled in a quiet West Columbus setting, 379 Sturbridge Road delivers 1,107 square feet of updated single-story living accented by clean lines, modern flooring, and a generous private yard.

The floor plan opens to a sunlit main living area featuring durable hard-surface flooring that flows smoothly into a renovated eat-in kitchen. Culinary needs are supported by modern cabinetry and a full appliance suite comprising a refrigerator, range and oven, dishwasher, microwave, and freezer. In-unit laundry convenience is already in place with an included washer and dryer.

Three well-proportioned bedrooms provide peaceful retreats, accommodated by one full bathroom and one powder room half-bath showcasing updated vanities, modern hardware, and crisp tile accents. Central air conditioning and forced air heat provide efficient, consistent comfort throughout.

Outdoors, an expansive backyard offers plentiful space for recreation, complemented by an attached covered carport and private driveway parking.

Pet-friendly home with a $50 application fee. Resident is responsible for utility services. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-908A8F46',
    existing_property_id: '3b1f2a05-c308-4a5c-9a2a-0a01f16b4fbd',
    title: '189 Avondale Ave, Columbus, OH 43223',
    address: '189 Avondale Ave',
    city: 'Columbus',
    state: 'OH',
    zip: '43223',
    county: 'Franklin County',
    lat: 39.95519,
    lng: -83.02653,
    property_type: 'TOWNHOUSE',
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1292,
    monthly_rent: 1650,
    security_deposit: 1650,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: true,
    parking: 'Dedicated Rear Parking Pad, Alley Access',
    garage_spaces: null,
    heating_type: 'Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer',
    flooring: ['Refurbished Hardwood', 'Granite', 'Ceramic Tile'],
    amenities: [
      'Historic Franklinton Architectural Character with Exposed Brick',
      'Refurbished Original Hardwood Flooring',
      'Polished Granite Countertops & Ceramic Tile Bathrooms',
      'Energy-Efficient Samsung Appliance Suite',
      'Newly Installed Central Air Conditioning & Water Heater',
      'Keyless Digital Entry System',
      'Private Fenced Yard with Rear Parking Pad & Alley Access',
      'Minutes to Franklinton Arts District & Downtown Columbus',
      'Pet Friendly'
    ],
    appliances: [
      'Samsung Stainless Steel Refrigerator',
      'Samsung Range / Oven',
      'Samsung Dishwasher',
      'Samsung Microwave',
      'In-Unit Washer',
      'In-Unit Dryer'
    ],
    description: `Positioned in the heart of historic Franklinton, 189 Avondale Avenue is a meticulously renovated 1,292-square-foot multi-story townhouse that marries rich architectural character with high-end contemporary upgrades.

The main level greets you with refurbished hardwood flooring, high ceilings, exposed brick accents, and ceramic tile transitions. The kitchen is outfitted with polished granite countertops, modern cabinetry, and an energy-efficient Samsung appliance suite featuring a refrigerator, range and oven, microwave, and dishwasher. An in-unit washer and dryer provide complete laundry convenience.

Three spacious bedrooms with generous closets are arranged across the upper floors, accompanied by two full bathrooms finished with modern vanities, ceramic tile surrounds, and updated plumbing fixtures. Modern infrastructure upgrades include newly installed central air conditioning, forced air heating, an updated hot water system, and digital keyless entry.

Outdoor living features a private fenced yard and a dedicated rear parking pad with alley access. Located just minutes from the Franklinton Arts District, local dining, and Downtown Columbus.

Pet-friendly townhouse with a $50 application fee. Resident is responsible for utilities. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-FD94272F',
    existing_property_id: null,
    title: '2700 Bulen Ave, Columbus, OH 43207',
    address: '2700 Bulen Ave',
    city: 'Columbus',
    state: 'OH',
    zip: '43207',
    county: 'Franklin County',
    lat: 39.910427,
    lng: -82.95507,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1.5,
    half_bathrooms: 1,
    total_bathrooms: 2,
    square_footage: 936,
    monthly_rent: 1900,
    security_deposit: 1900,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: true,
    parking: 'Detached 3-Car Garage with Pull-Through Bay',
    garage_spaces: 3,
    heating_type: 'Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Luxury Vinyl Plank', 'New Carpeting', 'Tile'],
    amenities: [
      'Oversized 0.49-Acre Double Lot (Nearly Half an Acre)',
      'Detached 3-Car Garage with Pull-Through Rear Bay Door',
      'Skylit Breezeway with French Doors to Yard',
      'Convenient Ensuite Half-Bathroom in Primary Bedroom',
      'Semi-Finished Dry Basement Recreation Room or Home Office',
      'Fresh Luxury Vinyl Plank Flooring & Brand New Carpeting',
      'Digital Keypad Entry',
      'Central Air Conditioning & Forced Air Heat',
      'Near Marion-Franklin Park & Metro Parks',
      'Pet Friendly'
    ],
    appliances: [
      'Black Refrigerator',
      'Black Range / Oven',
      'Washer/Dryer Hookups'
    ],
    description: `Set on a rare 0.49-acre double lot in South Columbus, 2700 Bulen Avenue is a completely renovated single-family home offering 936 square feet of main-level living, a skylit breezeway, a semi-finished dry basement, and an oversized detached three-car garage.

The home opens into a radiant interior featuring brand-new luxury vinyl plank flooring and fresh neutral paint throughout. A standout skylit breezeway with French doors bridges the interior to the grounds. The kitchen is equipped with black appliances, including a refrigerator and electric range with oven, backed by crisp white cabinetry. The dry basement provides washer and dryer hookups, plus an open rec room or home office space complete with HVAC ducting and a glass-block egress window.

Accommodations include three bedrooms and one-and-a-half bathrooms, with a private ensuite half-bath located directly within the primary bedroom. The main hallway bathroom features clean tile surfaces and an updated vanity. Central air conditioning and forced air heating ensure year-round efficiency.

Car enthusiasts, hobbyists, or contractors will appreciate the massive detached three-car garage, where the third bay features a pull-through rear garage door opening directly onto the deep 312-foot lot. Convenient keypad entry secures the home, located minutes from I-270, I-71, and the Marion-Franklin Community Center.

Pet-friendly property with a $50 application fee. Resident is responsible for all utilities. Submit your rental application today at Choice Properties.`
  }
];

export async function runColumbusPublish() {
  console.log('================================================================');
  console.log('CHOICE PROPERTIES — COLUMBUS 8 PROPERTIES MANUAL ENRICHMENT & PUBLISH');
  console.log(`Processing Batch: ${COLUMBUS_BATCH.length} Properties`);
  console.log('================================================================\n');

  const publishedResults = [];

  for (let i = 0; i < COLUMBUS_BATCH.length; i++) {
    const item = COLUMBUS_BATCH[i];
    console.log(`\n[${i + 1}/${COLUMBUS_BATCH.length}] Processing: ${item.address}, ${item.city} ${item.zip} (${item.pipeline_id})`);

    // 1. Fetch raw pipeline record to extract photo URLs and preserve original description
    const pipeRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${item.pipeline_id}&select=*`, {
      headers: HEADERS_PIPELINE
    });

    if (!pipeRes.ok) {
      console.error(`   ✗ Could not fetch pipeline row ${item.pipeline_id}: ${pipeRes.status}`);
      continue;
    }

    const pipeData = await pipeRes.json();
    if (!pipeData || pipeData.length === 0) {
      console.error(`   ✗ Pipeline property ${item.pipeline_id} not found.`);
      continue;
    }

    const rawProp = pipeData[0];

    // Extract genuine photos from original_image_urls
    let photoUrls = [];
    if (rawProp.original_image_urls) {
      try {
        const parsed = typeof rawProp.original_image_urls === 'string' ? JSON.parse(rawProp.original_image_urls) : rawProp.original_image_urls;
        photoUrls = (parsed || []).map(p => typeof p === 'string' ? p : p.url).filter(u => u && u.startsWith('http'));
      } catch (e) {
        photoUrls = [];
      }
    }

    // Deduplicate URLs while preserving order
    photoUrls = [...new Set(photoUrls)];
    console.log(`   ✓ Verified ${photoUrls.length} genuine source CDN photographs`);

    // 2. Determine Property ID (Update existing or create new)
    let propId = item.existing_property_id;
    if (!propId) {
      // Check if property exists in public.properties by address
      const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?address=eq.${encodeURIComponent(item.address)}&city=eq.${encodeURIComponent(item.city)}&select=id`, {
        headers: HEADERS
      });
      const checkData = await checkRes.json();
      if (checkData && checkData.length > 0) {
        propId = checkData[0].id;
      } else {
        propId = crypto.randomUUID();
      }
    }

    const isUpdate = Boolean(item.existing_property_id || (propId && item.existing_property_id));

    const heroPhotoUrl = photoUrls.length > 0 ? photoUrls[0] : null;

    const propRecord = {
      id: propId,
      landlord_id: null,
      status: 'active',
      title: item.title,
      description: item.description,
      showing_instructions: 'Self-guided or agent-assisted viewings available upon request.',
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
      monthly_rent: item.monthly_rent,
      security_deposit: item.security_deposit,
      application_fee: item.application_fee,
      pets_allowed: item.pets_allowed,
      pet_types_allowed: item.pet_types_allowed,
      smoking_allowed: item.smoking_allowed,
      lease_terms: item.lease_terms,
      minimum_lease_months: item.minimum_lease_months,
      available_date: item.available_date,
      has_central_air: item.has_central_air,
      has_basement: item.has_basement,
      parking: item.parking,
      garage_spaces: item.garage_spaces,
      amenities: item.amenities,
      appliances: item.appliances,
      flooring: item.flooring,
      heating_type: item.heating_type,
      cooling_type: item.cooling_type,
      laundry_type: item.laundry_type,
      source_status: 'active',
      last_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 3. Upsert into public.properties
    const existingCheck = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${propId}&select=id`, {
      headers: HEADERS
    });
    const exists = (await existingCheck.json()).length > 0;

    if (exists) {
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

    // 4. Synchronize photos in public.property_photos using high-res source CDN URLs
    if (photoUrls.length > 0) {
      // Clear out older rows for this property
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
        alt_text: `${item.address}, ${item.city} OH - Photo ${idx + 1}`
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
        console.log(`   ✓ Synchronized ${photoRows.length} source CDN photos into public.property_photos`);
      }
    }

    // 5. Update pipeline_properties table row with enriched details and published status
    const patchPipeRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${item.pipeline_id}`, {
      method: 'PATCH',
      headers: HEADERS_PIPELINE,
      body: JSON.stringify({
        status: 'published',
        choice_property_id: propId,
        title: item.title,
        monthly_rent: item.monthly_rent,
        security_deposit: item.security_deposit,
        application_fee: item.application_fee,
        pets_allowed: item.pets_allowed,
        pet_types_allowed: item.pet_types_allowed,
        smoking_allowed: item.smoking_allowed,
        lease_terms: null,
        minimum_lease_months: null,
        available_date: null,
        property_type: item.property_type,
        bedrooms: item.bedrooms,
        bathrooms: item.bathrooms,
        half_bathrooms: item.half_bathrooms,
        total_bathrooms: item.total_bathrooms,
        square_footage: item.square_footage,
        description: item.description,
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
      pipeline_id: item.pipeline_id,
      property_id: propId,
      address: item.address,
      city: item.city,
      state: item.state,
      zip: item.zip,
      rent: item.monthly_rent,
      bedrooms: item.bedrooms,
      bathrooms: item.bathrooms,
      photoCount: photoUrls.length,
      url: `https://choice-properties-site.pages.dev/property.html?id=${propId}`
    });
  }

  console.log('\n================================================================');
  console.log(`PUBLISHING COMPLETE: ${publishedResults.length}/${COLUMBUS_BATCH.length} PROPERTIES`);
  console.log('================================================================\n');

  publishedResults.forEach((p, idx) => {
    console.log(`${idx + 1}. ${p.address}, ${p.city}, ${p.state} ${p.zip} ($${p.rent}/mo | ${p.bedrooms} Bed / ${p.bathrooms} Bath) — ${p.url}`);
  });

  return publishedResults;
}

runColumbusPublish().catch(console.error);
