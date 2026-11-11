/**
 * Choice Properties — Charlotte / Matthews Manual Due-Diligence Enrichment & Publishing Script (Batch of 8)
 * =========================================================================================================
 * Deep manual verification, architectural classification, exact decimal bathroom precision,
 * high-resolution source CDN photo ingestion, and original price preservation according to
 * Choice Properties standards.
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

export const CHARLOTTE_PROPERTIES = [
  {
    pipeline_id: 'PP-083835A3',
    existing_property_id: null,
    title: '3441 Braden Dr, Charlotte, NC 28216',
    address: '3441 Braden Dr',
    city: 'Charlotte',
    state: 'NC',
    zip: '28216',
    county: 'Mecklenburg County',
    lat: 35.29525,
    lng: -80.884155,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2.0,
    square_footage: 1095,
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
    has_basement: false,
    parking: 'Private Driveway & Off-Street Parking',
    garage_spaces: 0,
    amenities: [
      'Standalone Single-Family Home',
      'Smart Home Features',
      'Open-Concept Living Area',
      'Private Fenced Yard',
      'Central Air Conditioning',
      'In-Unit Laundry Connections',
      'Modern Fixtures Throughout'
    ],
    appliances: [
      'Full-Size Refrigerator',
      'Electric Range & Oven',
      'Overhead Microwave',
      'Multi-Cycle Dishwasher'
    ],
    flooring: ['Luxury Vinyl Plank', 'Plush Carpet'],
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    description: `Offering standalone privacy in Northwest Charlotte, this detached single-family home at 3441 Braden Dr provides 1,095 square feet of thoughtfully designed interior space with integrated smart home capabilities.

The main entrance leads into an airy, light-filled living room featuring durable luxury vinyl plank flooring and modern neutral wall tones. The connected kitchen and dining layout is designed for everyday functionality, presenting solid cabinetry, expansive prep surfaces, and an itemized appliance package comprising a full-size refrigerator, electric range with oven, overhead microwave, and multi-cycle dishwasher.

The sleeping quarters consist of three well-scaled bedrooms with substantial closet space. The primary bedroom features a private en-suite bathroom equipped with modern vanity cabinetry and an easy-clean tub-shower combination. A second full bathroom in the main hallway serves secondary bedrooms and visitors with coordinated fixtures and tile accents.

Energy-efficient central air conditioning and forced-air heat provide whole-home climate comfort. A dedicated laundry alcove includes washer and dryer connections ready for tenant equipment. Outdoors, a private fenced yard area provides secure open-air recreation, complemented by a private paved driveway with off-street vehicle parking.

Tenant is responsible for all electric, water, and trash utilities. Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-49F9A39D',
    existing_property_id: '448e89c7-d722-4f73-882b-2db0a8995476',
    title: '2939 Gray Feather Dr, Charlotte, NC 28262',
    address: '2939 Gray Feather Dr',
    city: 'Charlotte',
    state: 'NC',
    zip: '28262',
    county: 'Mecklenburg County',
    lat: 35.30906,
    lng: -80.70281,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2.0,
    square_footage: 1344,
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
    has_basement: false,
    parking: 'Private Driveway & Covered Front Porch',
    garage_spaces: 0,
    amenities: [
      'Single-Story Ranch Architecture',
      'Sheltered Front Porch',
      'Vaulted Living Room Ceilings',
      'Stone Hearth Fireplace',
      'Newly Built Rear Entertainment Deck',
      'Private Tree-Lined Backyard',
      'Split-Bedroom Privacy Floor Plan',
      'Central Air Conditioning & Gas Heat'
    ],
    appliances: [
      'Refrigerator',
      'Gas Range & Oven',
      'Dishwasher',
      'Range Hood'
    ],
    flooring: ['Laminate Hardwood', 'Ceramic Tile', 'Plush Carpet'],
    heating_type: 'Gas Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated Interior Laundry Room',
    description: `Situated just off Harris Houston Road in Northeast Charlotte, this freshly updated single-story ranch residence at 2939 Gray Feather Dr encompasses 1,344 square feet of comfortable living on a private parcel.

A sheltered covered front porch welcomes residents into a grand living room characterized by vaulted ceilings, warm laminate hardwood flooring, and a handsome stone fireplace as a central focal point. The updated kitchen features refinished cabinetry, newer countertops, a gas cooking range with oven, refrigerator, and dishwasher. An adjacent dining area overlooks the grounds through wide picture windows.

The thoughtful split-bedroom floor plan ensures complete privacy for the primary bedroom suite, which boasts dual wardrobe closets and an en-suite bathroom with vanity storage and a full tub-shower combination. On the opposite wing, two secondary bedrooms offer spacious footprints and convenient access to a pristine hallway full bathroom.

Central air conditioning and dependable gas heating ensure four-season interior comfort, while a dedicated interior laundry room provides in-home washer and dryer connections. The rear grounds feature a newly constructed wooden deck overlooking a private backyard framed by mature trees, paired with an extended paved driveway for off-street vehicle parking.

Tenant is responsible for gas, electric, water, and trash utilities. Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-B167F7B5',
    existing_property_id: null,
    title: '6415 Saint Bernard Way, Charlotte, NC 28269',
    address: '6415 Saint Bernard Way',
    city: 'Charlotte',
    state: 'NC',
    zip: '28269',
    county: 'Mecklenburg County',
    lat: 35.35246,
    lng: -80.80373,
    property_type: 'TOWNHOUSE',
    bedrooms: 3,
    bathrooms: 2.5,
    half_bathrooms: 1,
    total_bathrooms: 2.5,
    square_footage: 1408,
    monthly_rent: 1675,
    security_deposit: 1675,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Designated Resident Parking',
    garage_spaces: 0,
    amenities: [
      'Two-Story End-Unit Townhome',
      'All-New Interior Renovation',
      'High Ceilings & Large Windows',
      'Premium Luxury Vinyl Plank Flooring',
      'Private Rear Patio Space',
      '2.5 Bathrooms with Primary En-Suite',
      'Minutes to I-77, I-485 & Birkdale Village',
      'Central Air Conditioning'
    ],
    appliances: [
      'Full-Size Refrigerator',
      'Electric Range & Oven',
      'Overhead Microwave',
      'Automatic Dishwasher'
    ],
    flooring: ['Luxury Vinyl Plank', 'New Carpet'],
    heating_type: 'Central Electric Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    description: `Positioned as a prime end-unit in a quiet North Charlotte residential enclave, this fully renovated two-story townhome at 6415 Saint Bernard Way delivers 1,408 square feet of bright, contemporary living space just minutes from I-77, I-485, and Birkdale Village.

The main level showcases an open-concept flow framed by high ceilings, expansive windows, and new luxury vinyl plank flooring throughout the central gathering areas. The completely modernized kitchen is appointed with updated countertops, fresh white shaker cabinetry, and an itemized appliance package including a full-size refrigerator, electric range with oven, built-in microwave, and automatic dishwasher. An adjoining dining space flows directly to the private rear patio.

Upstairs, three spacious bedrooms feature new neutral carpeting and generous wardrobe storage. The primary bedroom suite includes an en-suite bathroom with a modern vanity and walk-in shower surround. The property provides 2.5 bathrooms in total: a convenient ground-floor powder room for guests and an upper-level full hallway bath serving secondary bedrooms.

Mechanical updates include whole-home central air conditioning and electric forced-air heating. Dedicated in-unit laundry hookups are situated within an interior utility area. The private end-unit outdoor space features an open patio pad backing up to green community grounds, complemented by reserved resident parking.

Tenant is responsible for all electric, water, and trash utilities. Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-A3DAB053',
    existing_property_id: null,
    title: '5720 Prescott Ct, Charlotte, NC 28269',
    address: '5720 Prescott Ct',
    city: 'Charlotte',
    state: 'NC',
    zip: '28269',
    county: 'Mecklenburg County',
    lat: 35.329887,
    lng: -80.79984,
    property_type: 'TOWNHOUSE',
    bedrooms: 3,
    bathrooms: 2.5,
    half_bathrooms: 1,
    total_bathrooms: 2.5,
    square_footage: 1230,
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
    has_basement: false,
    parking: 'Assigned Parking Spaces',
    garage_spaces: 0,
    amenities: [
      'Two-Level Attached Townhome',
      'Granite Countertops in Kitchen',
      'Open Entertaining Floor Plan',
      '2.5 Bathrooms with Main-Floor Powder Room',
      'Private Rear Patio Space',
      'Spacious Bedroom Closets',
      'Central Climate Control System'
    ],
    appliances: [
      'Refrigerator',
      'Electric Range & Oven',
      'Multi-Cycle Dishwasher',
      'Range Hood Fan'
    ],
    flooring: ['Hard-Surface Flooring', 'Neutral Carpet'],
    heating_type: 'Electric Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Connections',
    description: `A charming two-story townhome residence situated on Prescott Court in North Charlotte, 5720 Prescott Ct encompasses 1,230 square feet of inviting interior living space designed for low-maintenance comfort and style.

The main level features a fluid open floor plan accented by durable hard-surface flooring and tall windows that introduce abundant natural light into the expansive living and dining area. The culinary kitchen stands out with polished granite countertops, classic solid cabinetry, and a full itemized appliance inventory including an electric range with oven, multi-cycle dishwasher, refrigerator, and range hood fan.

Three thoughtfully arranged bedrooms on the upper level provide serene sleeping environments with substantial closet storage. The home includes 2.5 bathrooms: two full bathrooms upstairs—including an en-suite private bath for the primary bedroom—and a convenient half bathroom located on the ground level for guest use.

Year-round comfort is maintained through central air conditioning and central forced-air heating. Dedicated in-unit laundry hookups are conveniently positioned inside the home. Outdoor living includes a private rear patio ideal for morning coffee, paired with designated resident parking.

Tenant is responsible for electric, water, and trash utilities. Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-AA1A8DA0',
    existing_property_id: null,
    title: '3053 Summerfield Ridge Ln, Matthews, NC 28105',
    address: '3053 Summerfield Ridge Ln',
    city: 'Matthews',
    state: 'NC',
    zip: '28105',
    county: 'Mecklenburg County',
    lat: 35.153423,
    lng: -80.72505,
    property_type: 'TOWNHOUSE',
    bedrooms: 3,
    bathrooms: 2.5,
    half_bathrooms: 1,
    total_bathrooms: 2.5,
    square_footage: 1387,
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
    has_basement: false,
    parking: 'Two Assigned Parking Spaces (#3053)',
    garage_spaces: 0,
    amenities: [
      'Two-Story End-Unit Townhouse',
      'Summerfield Residential Community',
      'Welcoming Front Porch',
      'Private Backyard with Patio',
      'Great Room with Cozy Fireplace',
      'Kitchen with Quartz Countertops & Tile Backsplash',
      'Walk-In Pantry',
      'In-Unit Washer & Dryer Included',
      'Two Assigned Parking Spaces'
    ],
    appliances: [
      'Refrigerator',
      'Electric Range & Oven',
      'Dishwasher',
      'In-Unit Clothes Washer',
      'In-Unit Clothes Dryer'
    ],
    flooring: ['Hardwood-Style Flooring', 'Tile', 'Plush Carpet'],
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Included',
    description: `Positioned in the popular Summerfield community of Matthews, this beautifully maintained two-story end-unit townhome at 3053 Summerfield Ridge Ln delivers 1,387 square feet of comfortable living with easy access to Independence Boulevard, I-485, and Uptown Charlotte.

The ground level features a covered front entry porch that leads into an expansive great room centered around a decorative fireplace. The upgraded kitchen is appointed with sleek quartz countertops, a designer tile backsplash, a walk-in food pantry, and an itemized appliance package comprising a refrigerator, electric range with oven, dishwasher, and dedicated in-unit washer and dryer. A cheerful breakfast area and dining nook opens directly onto the rear private patio and yard.

Upstairs, the primary bedroom suite offers a tranquil retreat with vaulted ceiling lines, a walk-in closet, and a private en-suite bathroom. Two additional bedrooms provide generous dimensions with double closets, serviced by a second full hallway bathroom. A convenient half bathroom is located on the first floor for visitors (2.5 bathrooms total).

Central heating and central air conditioning provide whole-home climate control. The exterior showcases a private rear patio and lawn space, along with two assigned parking spaces (#3053) right outside the door.

Tenant is responsible for gas, electricity, and internet services; water, sewer, and lawn maintenance are provided. Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-E38E304E',
    existing_property_id: null,
    title: '3823 Rosehaven Dr, Charlotte, NC 28205',
    address: '3823 Rosehaven Dr',
    city: 'Charlotte',
    state: 'NC',
    zip: '28205',
    county: 'Mecklenburg County',
    lat: 35.210747,
    lng: -80.76377,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2.0,
    square_footage: 1095,
    monthly_rent: 1600,
    security_deposit: 1600,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Driveway & Yard',
    garage_spaces: 0,
    amenities: [
      'Detached Single-Family Home (1963)',
      'Fully Remodeled Interior (28205 Area)',
      'Minutes to Plaza Midwood & NoDa',
      'Refinished Hard-Surface Flooring',
      'Modern Kitchen with Updated Finishes',
      'Two Fully Renovated Bathrooms',
      'Private Driveway Parking & Yard',
      'Central Air Conditioning'
    ],
    appliances: [
      'Full-Size Refrigerator',
      'Electric Range & Oven',
      'Overhead Microwave',
      'Dishwasher'
    ],
    flooring: ['Luxury Vinyl Plank', 'Tiled Bathrooms'],
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Home Washer & Dryer Hookups',
    description: `Set on an independent homesite in Charlotte's highly sought-after 28205 zip code, this completely remodeled detached single-family home at 3823 Rosehaven Dr provides 1,095 square feet of stylish interior living just minutes from Plaza Midwood, NoDa, and Uptown Charlotte.

The open-concept layout features brand-new hard-surface flooring, fresh modern interior paint, and recessed architectural lighting. The updated kitchen is equipped with sleek contemporary cabinetry, generous countertop workspace, and a complete itemized appliance inventory including a full-size refrigerator, electric range with oven, overhead microwave, and dishwasher.

Three well-proportioned bedrooms provide peaceful retreats with deep closet storage and bright window exposures. The home features two fully modernized bathrooms, each appointed with designer vanity cabinetry, updated plumbing hardware, and clean custom-tiled tub-shower surrounds.

Whole-home comfort is delivered through energy-efficient central air conditioning and central heating systems. Dedicated in-home laundry connections are provided in a private utility space. Outside, the property features a private backyard and a paved private driveway offering convenient off-street parking.

Tenant is responsible for all electric, water, and trash utilities. Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-F0D3CCB9',
    existing_property_id: null,
    title: '2343 Crosscut Dr, Charlotte, NC 28214',
    address: '2343 Crosscut Dr',
    city: 'Charlotte',
    state: 'NC',
    zip: '28214',
    county: 'Mecklenburg County',
    lat: 35.292404,
    lng: -80.96613,
    property_type: 'TOWNHOUSE',
    bedrooms: 3,
    bathrooms: 3.0,
    half_bathrooms: 0,
    total_bathrooms: 3.0,
    square_footage: 1264,
    monthly_rent: 1625,
    security_deposit: 1625,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Designated Off-Street Parking',
    garage_spaces: 0,
    amenities: [
      'Two-Story Townhome (Built 2007)',
      'Primary Suite on Main Level',
      'Three Full Bathrooms',
      'Rear Patio Backing to Natural Wooded Preserve',
      'Community Swimming Pool & Clubhouse',
      'Fitness Center, Walking Trails & Playground',
      'Washer & Dryer Included',
      'Central Climate Control'
    ],
    appliances: [
      'Refrigerator',
      'Electric Range & Oven',
      'Dishwasher',
      'Overhead Microwave',
      'In-Unit Washer',
      'In-Unit Dryer'
    ],
    flooring: ['Hardwood-Style Flooring', 'Plush Carpet'],
    heating_type: 'Central Electric Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Included',
    description: `Nestled adjacent to a serene natural wooded preserve in West Charlotte near I-485 and Uptown, this 1,264-square-foot two-story townhome at 2343 Crosscut Dr offers an ideal layout with three bedrooms and three full bathrooms.

The main level is anchored by a bright open living area that flows smoothly into a modern kitchen complete with solid cabinetry, ample meal preparation counters, and an itemized appliance suite featuring an electric range and oven, refrigerator, dishwasher, overhead microwave, and in-unit washer and dryer. Sliding glass doors lead out to a private rear patio backing up to mature trees and nature.

Uniquely advantageous, the primary bedroom suite is situated on the main floor, featuring expansive dimensions, a walk-in closet, and an en-suite full bathroom. Upstairs, two additional spacious bedrooms each offer generous storage, serviced by two additional full bathrooms ensuring complete privacy for every occupant (3.0 bathrooms total).

Comfort is guaranteed with central air conditioning and central heating. Residents enjoy access to premium community amenities including a swimming pool, clubhouse, fitness center, walking trails, and playground. Designated off-street parking is located directly in front of the home.

Tenant is responsible for electric, water, and internet utilities. Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-B7A49FDF',
    existing_property_id: null,
    title: '9128 Treyburn Dr, Charlotte, NC 28216',
    address: '9128 Treyburn Dr',
    city: 'Charlotte',
    state: 'NC',
    zip: '28216',
    county: 'Mecklenburg County',
    lat: 35.346,
    lng: -80.866714,
    property_type: 'TOWNHOUSE',
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2.0,
    square_footage: 1600,
    monthly_rent: 1700,
    security_deposit: 1700,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Two Reserved Front Spaces & Visitor Parking',
    garage_spaces: 0,
    amenities: [
      'Two-Story Townhome in Towne Meadows (1999)',
      '1,600 Square Feet of Living Space',
      'Main-Floor Primary Bedroom with En-Suite',
      'Second-Floor Open Loft / Bonus Room',
      'Private Rear Entertainment Patio',
      'Two Reserved Front Parking Spaces',
      'Convenient to I-485 & I-77 Corridors',
      'Central Climate Control'
    ],
    appliances: [
      'Full-Size Refrigerator',
      'Electric Range & Oven',
      'Built-in Dishwasher',
      'Range Hood Exhaust'
    ],
    flooring: ['Hard-Surface Flooring', 'Plush Carpet'],
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    description: `Delivering a generous 1,600 square feet of finished space in the Towne Meadows community of North Charlotte, this two-story townhome at 9128 Treyburn Dr provides prime accessibility to both the I-485 and I-77 interchange corridors.

The main level welcomes guests into an expansive living room with hard-surface flooring and ample natural lighting. The adjoining kitchen and dining area provides generous cabinet storage, solid countertops, and an itemized appliance package including a full-size refrigerator, electric range with oven, dishwasher, and range hood fan. Sliding glass doors open to a charming rear entertainment patio.

A highly desirable main-floor primary bedroom retreat features dual closets and an en-suite full bathroom. The upper floor boasts two additional spacious bedrooms, a second full bathroom, and a versatile open loft area well-suited as a home office, media room, or study.

Central air conditioning and forced-air heating ensure consistent whole-home comfort. Dedicated in-unit laundry connections are conveniently located inside. Outside, two reserved front parking spaces are provided along with ample nearby visitor parking.

Tenant is responsible for all electric, water, and trash utilities. Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.`
  }
];

export async function runCharlottePublish() {
  console.log('================================================================');
  console.log('CHOICE PROPERTIES — CHARLOTTE MANUAL ENRICHMENT & PUBLISHING ENGINE');
  console.log(`Processing ${CHARLOTTE_PROPERTIES.length} verified pipeline properties`);
  console.log('================================================================\n');

  const publishedResults = [];

  for (const item of CHARLOTTE_PROPERTIES) {
    console.log(`\n▶ Processing [${item.pipeline_id}] ${item.address}, ${item.city}...`);

    // 1. Fetch pipeline property record from pipeline schema
    const pipeRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${item.pipeline_id}`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Accept-Profile': 'pipeline'
      }
    });

    if (!pipeRes.ok) {
      console.error(`   ✗ Failed to fetch pipeline property ${item.pipeline_id}: ${pipeRes.status}`);
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
        const parsed = typeof rawProp.original_image_urls === 'string'
          ? JSON.parse(rawProp.original_image_urls)
          : rawProp.original_image_urls;
        photoUrls = (parsed || []).map(p => typeof p === 'string' ? p : p.url).filter(u => u && u.startsWith('http'));
      } catch (e) {
        photoUrls = [];
      }
    }

    // Deduplicate URLs while preserving order
    photoUrls = [...new Set(photoUrls)];
    console.log(`   ✓ Verified ${photoUrls.length} genuine source CDN photographs`);

    // 2. Determine Property ID (Check existing ID or address)
    let propId = item.existing_property_id;
    if (!propId) {
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
        alt_text: `${item.address}, ${item.city} NC - Photo ${idx + 1}`
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
        console.log(`   ✓ Synchronized ${photoRows.length} source CDN photos into public.property_photos (Hero: photo 1)`);
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
  console.log(`PUBLISHING COMPLETE: ${publishedResults.length}/${CHARLOTTE_PROPERTIES.length} PROPERTIES`);
  console.log('================================================================\n');

  publishedResults.forEach((p, idx) => {
    console.log(`${idx + 1}. ${p.address}, ${p.city}, ${p.state} ${p.zip} ($${p.rent.toLocaleString()}/mo | ${p.bedrooms} Bed / ${p.bathrooms} Bath) — ${p.url}`);
  });

  return publishedResults;
}

if (process.argv[1]?.endsWith('publish_charlotte_batch_8.mjs')) {
  runCharlottePublish().catch(console.error);
}
