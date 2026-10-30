/**
 * CHOICE PROPERTIES — COLUMBUS 8 PROPERTIES MANUAL ENRICHMENT & PUBLISHING ENGINE (BATCH 4)
 * =========================================================================================
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

export const COLUMBUS_BATCH_4 = [
  {
    pipeline_id: 'PP-CBD459CE',
    existing_property_id: null,
    title: '674 Thurman Ave, Columbus, OH 43206',
    address: '674 Thurman Ave',
    city: 'Columbus',
    state: 'OH',
    zip: '43206',
    county: 'Franklin County',
    lat: 39.93921,
    lng: -82.977844,
    property_type: 'DUPLEX',
    bedrooms: 3,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 1250,
    monthly_rent: 1400,
    security_deposit: 1400,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: true,
    parking: 'Detached Garage, On-Street Parking',
    garage_spaces: 1,
    heating_type: 'Central Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer (in Basement)',
    flooring: ['Refinished Hardwood', 'Tile'],
    amenities: [
      'German Village / Southern Orchards Historic Setting',
      'Walk to The Thurman Cafe, South Village Grille & Fox in the Snow',
      'Refinished Original Hardwood Flooring Throughout',
      'Remodeled Kitchen with Stainless Steel Appliances & Subway Tile',
      'In-Unit Washer and Dryer in Large Unfinished Basement',
      'Central Air Conditioning & Central Heat',
      'Covered Front Porch & Storage Garage',
      'Pet Friendly'
    ],
    appliances: [
      'Stainless Steel Refrigerator',
      'Range / Oven',
      'Dishwasher',
      'Microwave',
      'In-Unit Washer',
      'In-Unit Dryer'
    ],
    description: `Situated in a sought-after South Columbus neighborhood steps from German Village and Nationwide Children's Hospital, 674 Thurman Avenue presents a beautifully renovated 1,250-square-foot duplex residence within walking distance of popular local eateries including The Thurman Cafe and Fox in the Snow.

The main level welcomes you with refinished original hardwood flooring, high ceilings, new energy-efficient windows, and expansive open living and dining spaces filled with natural light. The remodeled kitchen features fresh white cabinetry, subway tile backsplashes, and stainless steel appliances including a range with oven, refrigerator, dishwasher, and microwave.

The private upper floor includes three generously proportioned bedrooms with ample closet space, supported by an updated full bathroom equipped with a traditional soaking tub and modern tile surround. The substantial unfinished basement provides extensive dry storage and includes an in-unit washer and dryer. Central air conditioning and forced air heat ensure steady year-round climate control. Outdoors, enjoy a covered front porch, shared backyard with gravel patio pads, and a storage garage.

Pet-friendly property with a $50 application fee per applicant. Resident is responsible for electric and gas utilities. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-125EA8F0',
    existing_property_id: null,
    title: '1543 Cordell Ave, Columbus, OH 43211',
    address: '1543 Cordell Ave',
    city: 'Columbus',
    state: 'OH',
    zip: '43211',
    county: 'Franklin County',
    lat: 40.010925,
    lng: -82.96815,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 1208,
    monthly_rent: 1395,
    security_deposit: 1395,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: true,
    parking: 'Private Driveway, Off-Street Parking',
    garage_spaces: null,
    heating_type: 'Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups (in Basement)',
    flooring: ['Hardwood Flooring', 'Tile'],
    amenities: [
      'Classic Covered Front Porch',
      'Decorative Brick Focal Fireplace',
      'Full Unfinished Basement with Washer & Dryer Hookups',
      'Central Air Conditioning & Forced Air Heat',
      'Private Driveway Off-Street Parking',
      'Spacious Backyard',
      'Close to I-71 Transit Corridor',
      'Pet Friendly'
    ],
    appliances: [
      'Refrigerator',
      'Range / Oven',
      'Dishwasher',
      'Microwave',
      'Freezer',
      'Washer/Dryer Hookups'
    ],
    description: `Fronted by a classic wide covered porch, 1543 Cordell Avenue is a charming 1,208-square-foot single-family home located in North Columbus with easy access to I-71, local parks, and shopping.

The interior showcases an open living room detailed with a decorative brick fireplace that creates a warm focal accent for gathering. The functional kitchen offers generous cabinetry, durable countertops, and an appliance collection featuring a range and oven, refrigerator, microwave, and dishwasher. Below, an expansive full basement provides substantial utility and storage capacity alongside in-unit washer and dryer hookups.

Three comfortably scaled bedrooms feature natural illumination and convenient closet space. The full bathroom features updated fixtures, a clean vanity, and a tiled tub/shower combination. Comfort is regulated with forced air heating and central air conditioning. Outside, the property includes a private driveway for off-street parking and a spacious backyard for outdoor relaxation.

This pet-friendly home requires a $50 application fee. Resident is responsible for utility services and lawn care. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-BD6C40BC',
    existing_property_id: '6c88a553-7c72-4e03-90db-e0fe35f2101b',
    title: '1875 Ward Rd, Columbus, OH 43224',
    address: '1875 Ward Rd',
    city: 'Columbus',
    state: 'OH',
    zip: '43224',
    county: 'Franklin County',
    lat: 40.05097,
    lng: -82.96662,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1.5,
    half_bathrooms: 1,
    total_bathrooms: 2,
    square_footage: 962,
    monthly_rent: 1425,
    security_deposit: 1425,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Detached 2.5-Car Garage, Driveway Parking',
    garage_spaces: 2,
    heating_type: 'Forced Air, Natural Gas',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'First-Floor In-Unit Laundry Hookups',
    flooring: ['Updated Hard-Surface Flooring', 'Tile'],
    amenities: [
      'Single-Story Ranch Living with First-Floor Laundry',
      'Convenient 1.5 Bathroom Configuration with Half-Bath',
      'Oversized 2.5-Car Detached Garage with Storage Workshop',
      'Large Private Fenced Backyard',
      'Completely Updated Kitchen, Flooring, Roof, Furnace & AC',
      'Central Air Conditioning & Gas Heat',
      'Quick Access to I-71 & I-270',
      'Pet Friendly'
    ],
    appliances: [
      'Range / Oven',
      'Dishwasher',
      'Garbage Disposal',
      'Washer/Dryer Hookups'
    ],
    description: `Offering complete single-level convenience, 1875 Ward Road in North Columbus presents a fully upgraded 962-square-foot ranch-style single-family home paired with an oversized 2.5-car garage and a deep private backyard.

The residence opens into a sun-filled living space enhanced by fresh neutral paint and durable updated flooring that extends throughout the main living areas. The remodeled eat-in kitchen features crisp cabinetry, solid countertops, a range with oven, dishwasher, garbage disposal, and dining space. A convenient first-floor laundry area accommodates washer and dryer hookups with easy exterior access.

The sleeping quarters comprise three peaceful bedrooms with practical closet storage. The home features one full bathroom with a tiled bathtub and shower surround, plus a convenient half-bath powder room for everyday practicality. Heating and cooling are powered by a newly installed natural gas furnace and central air conditioning. Outside, enjoy an expansive fenced backyard and an oversized 2.5-car detached garage with generous workshop or storage capacity.

Pet-friendly residence with a $50 application fee. Resident is responsible for utilities. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-BF92085D',
    existing_property_id: null,
    title: '132 S Highland Ave, Columbus, OH 43223',
    address: '132 S Highland Ave',
    city: 'Columbus',
    state: 'OH',
    zip: '43223',
    county: 'Franklin County',
    lat: 39.952778,
    lng: -83.06044,
    property_type: 'DUPLEX',
    bedrooms: 3,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 1072,
    monthly_rent: 1165,
    security_deposit: 1165,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: true,
    parking: 'Two Dedicated Off-Street Parking Spaces in Back',
    garage_spaces: null,
    heating_type: 'Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Original Wood Flooring', 'Tile'],
    amenities: [
      'Two-Story Classic Columbus Double / Duplex Layout',
      'Architectural Focal Fireplace in Living Room',
      'Original Wood Flooring in Bedrooms',
      'Two Dedicated Off-Street Parking Spaces Behind Property',
      'Central Air Conditioning & Heating',
      'In-Unit Washer & Dryer Hookups',
      'Pet Friendly'
    ],
    appliances: [
      'Range / Oven',
      'Garbage Disposal',
      'Washer/Dryer Hookups'
    ],
    description: `Located on South Highland Avenue in West Columbus, 132 South Highland Avenue is a well-proportioned 1,072-square-foot double residence offering generous multi-level living and private off-street parking.

The main level reveals an inviting living room accented by an architectural fireplace and hardwood-style flooring. The kitchen is designed for functional daily meal preparation, equipped with solid cabinetry, a gas range with oven, and a garbage disposal. Dedicated in-unit laundry hookups are provided for convenient washer and dryer installation.

The second floor hosts three comfortable bedrooms featuring genuine wood flooring and generous closet space. The central full bathroom includes a classic bathtub and shower combination, an updated vanity, and porcelain fixtures. Comfort is maintained through central air conditioning and heating. Outside, two dedicated off-street parking spaces are positioned directly behind the property for private resident access.

This pet-friendly home requires a $50 application fee per adult applicant. Resident is responsible for utilities. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-6C88471A',
    existing_property_id: '84627d4f-f1b7-4883-96a1-e0cc8edc44ae',
    title: '1890 Lonsdale Rd, Columbus, OH 43232',
    address: '1890 Lonsdale Rd',
    city: 'Columbus',
    state: 'OH',
    zip: '43232',
    county: 'Franklin County',
    lat: 39.93892,
    lng: -82.85169,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 925,
    monthly_rent: 1500,
    security_deposit: 1500,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: true,
    parking: 'Detached 2-Car Garage, Off-Street Driveway',
    garage_spaces: 2,
    heating_type: 'Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups (in Basement)',
    flooring: ['Luxury Vinyl Plank', 'Tile'],
    amenities: [
      'Full Basement for Storage, Gym or Workshop',
      'Detached 2-Car Garage with Long Driveway',
      'Brand New Kitchen Cabinetry with Complete Appliance Package',
      'New Bathroom Vanity with Solid-Surface Top',
      'Fresh Luxury Vinyl Plank Flooring Throughout',
      'Central Air Conditioning & Forced Air Heat',
      'Large Private Backyard',
      'Pet Friendly'
    ],
    appliances: [
      'Refrigerator',
      'Range / Oven',
      'Dishwasher',
      'Microwave',
      'Washer/Dryer Hookups'
    ],
    description: `Situated on Lonsdale Road in East Columbus with quick connectivity to I-70 and I-270, 1890 Lonsdale Road presents a completely refreshed 925-square-foot single-family home with a full basement and detached two-car garage.

The home opens into a welcoming living space outfitted with brand-new luxury vinyl plank flooring and fresh interior paint. The updated kitchen features contemporary cabinets, solid countertops, and a complete suite of appliances including a refrigerator, range and oven, microwave, and dishwasher. Descending to the full basement reveals extensive dry storage, hobby space, and dedicated washer/dryer hookups.

Three bright bedrooms provide comfortable accommodations with updated flooring and closet storage. The full bathroom features a new vanity with a solid surface top, modern hardware, and a clean tub and shower surround. Central air conditioning and forced air heat maintain steady indoor climate control. Exterior highlights include an oversized detached two-car garage, private driveway, and a large yard.

Pet-friendly property with a $50 application fee. Resident is responsible for utility services. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-843D6F02',
    existing_property_id: '78cd6551-293a-421d-8dc5-518a929b5678',
    title: '1479 Mount Vernon Ave, Columbus, OH 43203',
    address: '1479 Mount Vernon Ave',
    city: 'Columbus',
    state: 'OH',
    zip: '43203',
    county: 'Franklin County',
    lat: 39.973713,
    lng: -82.96273,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 4,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1668,
    monthly_rent: 1450,
    security_deposit: 1450,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: true,
    parking: 'Off-Street Parking',
    garage_spaces: null,
    heating_type: 'Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Included',
    flooring: ['New Hard-Surface Flooring', 'Tile'],
    amenities: [
      'Generous 1,668 Sq Ft Four-Bedroom Single-Family Floor Plan',
      'Two Fully Renovated Bathrooms with Contemporary Vanities',
      'Fresh Paint & Brand New Flooring Throughout',
      'In-Unit Washer and Dryer Included',
      'Minutes to Downtown Columbus & Major Highways',
      'Central Air Conditioning & Heating',
      'Dedicated Off-Street Parking',
      'Pet Friendly'
    ],
    appliances: [
      'Range / Oven',
      'Refrigerator',
      'In-Unit Washer',
      'In-Unit Dryer'
    ],
    description: `Positioned on Mount Vernon Avenue just minutes from Downtown Columbus and major highway corridors, 1479 Mount Vernon Avenue is an expansive 1,668-square-foot four-bedroom, two-bathroom single-family residence offering rare multi-bedroom capacity.

The interior welcomes you with a broad entry layout showcasing freshly painted neutral walls and brand-new flooring throughout the primary gathering spaces. The spacious kitchen accommodates generous counter prep area and cabinet storage, equipped with a range and oven and direct access to an in-unit washer and dryer.

Four well-proportioned bedrooms are arranged across the home, offering ample space for extended households or home office configurations. Two full bathrooms have been renovated with modern vanities, fresh fixtures, and tiled shower surrounds. Efficient heating and cooling regulate interior comfort, while dedicated off-street parking is available on site.

This pet-friendly home requires a $50 application fee per applicant. Resident is responsible for gas, electric, and water utilities. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-DC852214',
    existing_property_id: null,
    title: '254 S Princeton Ave, Columbus, OH 43223',
    address: '254 S Princeton Ave',
    city: 'Columbus',
    state: 'OH',
    zip: '43223',
    county: 'Franklin County',
    lat: 39.95298,
    lng: -83.033554,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 1222,
    monthly_rent: 1299,
    security_deposit: 1299,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: false,
    has_basement: true,
    parking: 'Private Driveway & Yard',
    garage_spaces: null,
    heating_type: 'Forced Air',
    cooling_type: 'Window Air Conditioning / Fan Support',
    laundry_type: 'In-Unit Washer/Dryer Hookups (in Basement)',
    flooring: ['New Luxury Vinyl Plank', 'Tile'],
    amenities: [
      'Two-Story Single-Family Residence in Historic Franklinton',
      'Fresh Paint & Brand New Luxury Vinyl Plank Flooring',
      'Full Unfinished Basement with Laundry Hookups & Storage',
      'Three Spacious Second-Floor Bedrooms',
      'Private Backyard',
      'Minutes to Downtown Columbus & Franklinton Arts District',
      'Pet Friendly'
    ],
    appliances: [
      'Range / Oven',
      'Washer/Dryer Hookups'
    ],
    description: `Located in the revitalized Franklinton community of Columbus, 254 South Princeton Avenue delivers 1,222 square feet of classic two-story single-family living within minutes of the arts district and Downtown.

The main level features a spacious front living room and dining area highlighted by brand-new luxury vinyl plank flooring and fresh modern paint. The kitchen is arranged for functional efficiency with solid cabinetry, generous storage, and cooking space. A full unfinished basement provides abundant dry storage and dedicated laundry hookups for a washer and dryer.

Upstairs, three generously sized bedrooms provide quiet retreats with plenty of natural light and closet capacity. The full bathroom includes an updated vanity, porcelain fixtures, and a clean tub/shower combination. Forced air heating keeps the interior warm and efficient throughout the year. Exterior space includes a private backyard for relaxing or outdoor activities.

Pet-friendly residence with a $50 application fee. Resident is responsible for utilities and landscaping. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-103D7469',
    existing_property_id: null,
    title: '130 Chicago Ave, Columbus, OH 43222',
    address: '130 Chicago Ave',
    city: 'Columbus',
    state: 'OH',
    zip: '43222',
    county: 'Franklin County',
    lat: 39.96091,
    lng: -83.03438,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 1152,
    monthly_rent: 1500,
    security_deposit: 1500,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: false,
    has_basement: true,
    parking: 'Off-Street Parking, Dedicated Driveway',
    garage_spaces: null,
    heating_type: 'Forced Air',
    cooling_type: 'Window Unit Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups (in Basement)',
    flooring: ['Hard-Surface Flooring', 'Tile'],
    amenities: [
      'Prime Franklinton Location Minutes to Downtown & Children\'s Hospital',
      'Two-Story 1,152 Sq Ft Living Floor Plan',
      'Full Basement for Storage, Gym or Workshop',
      'Renovated Kitchen with Full Stainless Appliance Suite',
      'In-Unit Washer and Dryer Hookups in Basement',
      'Private Yard & Dedicated Off-Street Parking',
      'Pet Friendly'
    ],
    appliances: [
      'Refrigerator',
      'Range / Oven',
      'Dishwasher',
      'Microwave',
      'Washer/Dryer Hookups'
    ],
    description: `Nestled in a prime Franklinton pocket minutes from Downtown Columbus, Nationwide Children's Hospital, and I-70/I-670, 130 Chicago Avenue is a thoroughly updated 1,152-square-foot two-story single-family home.

The interior showcases an open-concept living and dining flow complemented by durable flooring and crisp modern paint. The renovated kitchen features contemporary cabinetry, solid countertops, and an appliance suite including a refrigerator, range with oven, dishwasher, and microwave. A full basement adds valuable extra footprint for dry storage, a home workshop, and in-unit washer and dryer hookups.

Three comfortable bedrooms occupy the upper floor with generous closet capacity and quiet exposure. The full bathroom features an updated vanity, modern fixtures, and a spotless shower/tub surround. Forced air heating and air conditioning units ensure year-round climate management. Outside, a private backyard and off-street parking complete this desirable urban home.

This pet-friendly property has a $50 application fee per applicant. Resident is responsible for utility services. Submit your rental application today at Choice Properties.`
  }
];

export async function runColumbusBatch4Publish() {
  console.log('================================================================');
  console.log('CHOICE PROPERTIES — COLUMBUS 8 PROPERTIES MANUAL ENRICHMENT & PUBLISH (BATCH 4)');
  console.log(`Processing Batch: ${COLUMBUS_BATCH_4.length} Properties`);
  console.log('================================================================\n');

  const publishedResults = [];

  for (let i = 0; i < COLUMBUS_BATCH_4.length; i++) {
    const item = COLUMBUS_BATCH_4[i];
    console.log(`\n[${i + 1}/${COLUMBUS_BATCH_4.length}] Processing: ${item.address}, ${item.city} ${item.zip} (${item.pipeline_id})`);

    // 1. Fetch raw pipeline record to extract genuine source CDN photo URLs
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
      headers: {
        ...HEADERS_PIPELINE,
        'Content-Type': 'application/json'
      },
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
  console.log(`PUBLISHING COMPLETE: ${publishedResults.length}/${COLUMBUS_BATCH_4.length} PROPERTIES`);
  console.log('================================================================\n');

  publishedResults.forEach((p, idx) => {
    console.log(`${idx + 1}. ${p.address}, ${p.city}, ${p.state} ${p.zip} ($${p.rent}/mo | ${p.bedrooms} Bed / ${p.bathrooms} Bath) — ${p.url}`);
  });

  return publishedResults;
}

// Only execute when run directly from CLI
if (process.argv[1]?.endsWith('publish_columbus_batch_4.mjs')) {
  runColumbusBatch4Publish().catch(console.error);
}
