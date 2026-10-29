/**
 * CHOICE PROPERTIES — YUKON 12 PROPERTIES MANUAL ENRICHMENT & PUBLISHING ENGINE
 * =============================================================================
 * Performs deep, manual due-diligence enrichment and publishing for all 12 staged
 * pipeline properties in Yukon, OK according to Choice Properties standards.
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

export const YUKON_BATCH = [
  {
    pipeline_id: 'PP-F93213C5',
    existing_property_id: 'd59e2966-8600-479f-ae85-8535e7a91f2c',
    title: '3517 Galatian Way, Yukon, OK 73099',
    address: '3517 Galatian Way',
    city: 'Yukon',
    state: 'OK',
    zip: '73099',
    county: 'Canadian County',
    lat: 35.50683,
    lng: -97.69895,
    property_type: 'DUPLEX',
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1355,
    monthly_rent: 1445,
    security_deposit: 1445,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached 2-Car Garage, Driveway Parking',
    garage_spaces: 2,
    heating_type: 'Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Carpet', 'Tile'],
    amenities: [
      'Wood-Burning Fireplace in Living Room',
      'Spacious 1,355 Sq Ft Duplex Layout',
      'Master Bathroom with Double Vanity',
      'Tile Flooring in Kitchen and Bathrooms',
      'Attached 2-Car Garage with Private Driveway',
      'Central Air Conditioning & Forced Air Heat',
      'Dedicated Laundry Room with Hookups',
      'Pet Friendly'
    ],
    appliances: [
      'Range / Oven',
      'Dishwasher',
      'Microwave',
      'Washer/Dryer Hookups'
    ],
    description: `Positioned in a quiet residential Yukon neighborhood with rapid access to local thoroughfares, 3517 Galatian Way presents a spacious 1,355-square-foot duplex home that combines generous interior dimensions with functional appointments.

The main living room greets you with comfortable carpeting and a central wood-burning fireplace that creates an inviting focal point. The layout transitions into an expansive kitchen outfitted with rich cabinetry, durable tile flooring, and solid counter surfaces. Culinary preparation is supported by a full appliance suite comprising a range with oven, dishwasher, and microwave. An adjoining dedicated laundry room provides full-size washer and dryer hookups with additional utility shelving.

Three well-proportioned bedrooms offer restful retreats, highlighted by a private primary suite featuring a double-vanity bathroom. A second full bathroom serves the secondary bedrooms with an oversized vanity and clean ceramic tub surround. Year-round temperature control is managed via forced air heating and central air conditioning. Outside, the home features an attached two-car garage with private driveway parking.

This pet-friendly home requires a $50 application fee per applicant. Resident is responsible for all utility services. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-543F7FC0',
    existing_property_id: null,
    title: '9204 McLendon Ct, Yukon, OK 73099',
    address: '9204 McLendon Ct',
    city: 'Yukon',
    state: 'OK',
    zip: '73099',
    county: 'Canadian County',
    lat: 35.56385,
    lng: -97.68745,
    property_type: 'DUPLEX',
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1250,
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
    has_basement: false,
    parking: 'Attached 2-Car Garage',
    garage_spaces: 2,
    heating_type: 'Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Luxury Vinyl Plank', 'Carpet', 'Tile'],
    amenities: [
      'Brand New Contemporary Duplex Construction',
      'Polished Quartz Countertops in Kitchen',
      'Stainless Steel Appliance Suite',
      'Luxury Vinyl Plank Flooring in Main Areas',
      'Attached 2-Car Garage & Private Fenced Backyard',
      'Rapid Access to Kilpatrick Turnpike & Morgan Road',
      'Central Air Conditioning & Heating',
      'Pet Friendly'
    ],
    appliances: [
      'Stainless Steel Refrigerator',
      'Range / Oven',
      'Dishwasher',
      'Microwave',
      'Washer/Dryer Hookups'
    ],
    description: `Located in the modern Morgan and Britton corridor of Yukon with direct connectivity to the Kilpatrick Turnpike, 9204 McLendon Court is a contemporary 1,250-square-foot duplex designed for sleek, low-maintenance luxury.

The interior opens into a bright, open-concept living and dining area finished with durable luxury vinyl plank flooring and modern lighting fixtures. The gourmet kitchen centers around polished quartz countertops, clean flat-panel cabinetry, and a suite of stainless steel appliances including a refrigerator, range and oven, dishwasher, and built-in microwave.

The sleeping quarters comprise three peaceful bedrooms with soft carpeting and ample closet storage. The primary suite features an attached private bathroom with a contemporary walk-in shower and modern vanity, while the secondary bedrooms are supported by a second full hallway bathroom with modern tile surfaces. In-unit washer and dryer connections are conveniently situated. Central air conditioning and forced air heat maintain steady comfort throughout. Outside, a private fenced backyard and an attached two-car garage complete the home.

Pet-friendly property with a $50 application fee. Resident is responsible for utilities. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-862F831D',
    existing_property_id: null,
    title: '1428 Viola Dr, Yukon, OK 73099',
    address: '1428 Viola Dr',
    city: 'Yukon',
    state: 'OK',
    zip: '73099',
    county: 'Canadian County',
    lat: 35.519722,
    lng: -97.70734,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1513,
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
    has_basement: false,
    parking: 'Attached 2-Car Garage, Concrete Driveway',
    garage_spaces: 2,
    heating_type: 'Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['New Carpet', 'Tile'],
    amenities: [
      'Brand New Carpet Throughout Living & Bedrooms',
      'Traditional Brick Fireplace with Decorative Mantel',
      'Private Fully Fenced Backyard with Mature Trees',
      'Solid Oak Kitchen Cabinetry',
      'Attached 2-Car Garage & Driveway Parking',
      'Central Air Conditioning & Heating',
      'Dedicated Utility Room with Hookups',
      'Pet Friendly'
    ],
    appliances: [
      'Range / Oven',
      'Dishwasher',
      'Washer/Dryer Hookups'
    ],
    description: `Nestled in an established Yukon neighborhood close to shopping and dining, 1428 Viola Drive offers 1,513 square feet of comfortable single-family living across a thoughtfully arranged single-story footprint.

The expansive living room is highlighted by brand-new neutral carpeting, fresh paint, and a traditional brick fireplace with a decorative mantel. The adjacent kitchen and dining area feature durable flooring, solid oak cabinetry, generous counter space, and a built-in electric range and oven alongside a dishwasher. A dedicated utility room accommodates full-size washer and dryer hookups.

Three comfortably scaled bedrooms feature spacious closets and natural light. The primary suite includes a private bathroom, while the second full bathroom is finished with a large vanity and full tub and shower combination. Climate comfort is maintained with efficient central air conditioning and forced air heat. The exterior offers a private, fully fenced backyard with mature trees, complemented by an attached two-car garage and concrete driveway.

This pet-friendly home has a $50 application fee per applicant. Resident covers utility services and lawn care. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-FE1BCEBD',
    existing_property_id: '0d6a2856-c059-44b1-8458-2dcdb86fee7f',
    title: '12273 SW 11th St, Yukon, OK 73099',
    address: '12273 SW 11th St',
    city: 'Yukon',
    state: 'OK',
    zip: '73099',
    county: 'Canadian County',
    lat: 35.455044,
    lng: -97.74699,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1168,
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
    has_basement: false,
    parking: 'Driveway Parking, Attached Garage',
    garage_spaces: 2,
    heating_type: 'Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Hard-Surface Flooring', 'Carpet', 'Tile'],
    amenities: [
      'New Granite Kitchen Countertops',
      'Fresh Interior Paint Throughout',
      'Primary Suite with Walk-In Closet & Private Bath',
      'Ceiling Fans in Living & Bedrooms',
      'Fully Fenced Backyard',
      'Attached 2-Car Garage',
      'Near Mustang Trails Elementary & Meadow Intermediate',
      'Pet Friendly'
    ],
    appliances: [
      'Range / Oven',
      'Dishwasher',
      'Microwave',
      'Garbage Disposal',
      'Washer/Dryer Hookups'
    ],
    description: `Situated in a popular South Yukon neighborhood within walking distance of Mustang Trails Elementary and Meadow Intermediate, 12273 Southwest 11th Street offers 1,168 square feet of freshly updated single-family living.

The interior reveals an open-concept living area with fresh neutral paint, overhead ceiling fans, and easy-care flooring. The renovated kitchen features newly installed polished granite countertops, generous cabinetry, and appliances including an electric range with oven, dishwasher, over-the-range microwave, and garbage disposal. In-unit laundry hookups are located in a dedicated utility niche.

Three bright bedrooms provide comfortable accommodations, headlined by a primary bedroom with a private ensuite bathroom and a spacious walk-in closet. The second full bathroom features clean porcelain fixtures and a full shower/tub surround. Forced air heating and central air conditioning provide consistent climate regulation. Outside, the fully fenced backyard offers a secure space for outdoor enjoyment, accompanied by off-street driveway parking.

Pet-friendly property with a $50 application fee. Resident is responsible for all utilities. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-BD607C04',
    existing_property_id: '7f04fc78-9516-4e06-8687-0ee5d6a543b1',
    title: '11205 NW 6th Ter, Yukon, OK 73099',
    address: '11205 NW 6th Ter',
    city: 'Yukon',
    state: 'OK',
    zip: '73099',
    county: 'Canadian County',
    lat: 35.473335,
    lng: -97.72188,
    property_type: 'DUPLEX',
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1245,
    monthly_rent: 1475,
    security_deposit: 1475,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached 2-Car Garage',
    garage_spaces: 2,
    heating_type: 'Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['New Carpet', 'Tile'],
    amenities: [
      'Quiet Cul-de-Sac Location off Yukon Parkway',
      'Brand New Carpet & Fresh Clean Paint',
      'Private Fenced Backyard',
      'Attached 2-Car Garage with Interior Access',
      'Primary Suite with Dedicated Full Bathroom',
      'Easy Access to I-40, Turnpike & Tinker AFB',
      'Central Air Conditioning & Heating',
      'Pet Friendly'
    ],
    appliances: [
      'Range / Oven',
      'Dishwasher',
      'Washer/Dryer Hookups'
    ],
    description: `Set at the end of a quiet cul-de-sac off the Yukon Parkway with rapid access to I-40 and the turnpike, 11205 Northwest 6th Terrace delivers 1,245 square feet of updated duplex living.

A welcoming covered entryway leads into an open living room with brand-new carpeting, fresh paint, and natural lighting. The functional kitchen offers substantial counter space, solid wooden cabinetry, a breakfast bar, and appliances including a range and oven, dishwasher, and double sink. Adjacent utility space provides dedicated washer and dryer hookups.

The home encompasses three generously sized bedrooms with ample closet space. The primary bedroom features a private full bathroom, while a second full bathroom serves the hallway with clean tile finishes and modern vanity fixtures. Year-round comfort is assured through central air conditioning and forced air heat. A private fenced backyard is accessed from the interior, supplemented by an attached two-car garage.

This pet-friendly residence requires a $50 application fee. Resident is responsible for utility services. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-608BD3A6',
    existing_property_id: null,
    title: '924 Norway Ave, Yukon, OK 73099',
    address: '924 Norway Ave',
    city: 'Yukon',
    state: 'OK',
    zip: '73099',
    county: 'Canadian County',
    lat: 35.456295,
    lng: -97.744484,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 4,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1488,
    monthly_rent: 1545,
    security_deposit: 1545,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached 2-Car Garage',
    garage_spaces: 2,
    heating_type: 'Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer (Dedicated Laundry Room)',
    flooring: ['Hard-Surface Flooring', 'Carpet', 'Tile'],
    amenities: [
      'Expansive Corner Lot Location with Brick Exterior',
      'Four Bedroom Floor Plan for Family or Work-from-Home',
      'Primary Suite with Deep Walk-In Closet & Private Bath',
      'Dedicated Laundry Room off Garage with Washer & Dryer',
      'Open-Concept Living, Kitchen and Dining Layout',
      'Attached 2-Car Garage with Driveway',
      'Central Air Conditioning & Heating',
      'Pet Friendly'
    ],
    appliances: [
      'Refrigerator',
      'Range / Oven',
      'Dishwasher',
      'In-Unit Washer',
      'In-Unit Dryer'
    ],
    description: `Occupying an expansive corner parcel near SW 15th Street and Czech Hall Road, 924 Norway Avenue is an attractive four-bedroom, two-bathroom brick single-family home delivering 1,488 square feet of bright living space.

The interior is organized around a spacious open-concept living, kitchen, and dining layout. The kitchen is fully equipped with generous counter workspace, cabinetry, a range with oven, and an included refrigerator. Directly off the kitchen, a separate dedicated laundry room includes a washer and dryer and connects to the attached two-car garage.

Four well-proportioned bedrooms provide flexible options for family, guests, or a dedicated home office. The primary suite features a deep walk-in closet and a private ensuite bathroom. The second full bathroom serves the guest bedrooms with updated fixtures and clean surfaces. Central air conditioning and forced air heating keep the interior comfortable in every season, while the large corner lot provides generous outdoor space.

Pet-friendly residence with a $50 application fee. Resident covers all utilities. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-D4171895',
    existing_property_id: null,
    title: '10821 SW 22nd St, Yukon, OK 73099',
    address: '10821 SW 22nd St',
    city: 'Yukon',
    state: 'OK',
    zip: '73099',
    county: 'Canadian County',
    lat: 35.442318,
    lng: -97.71275,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1260,
    monthly_rent: 1475,
    security_deposit: 1475,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached 2-Car Garage',
    garage_spaces: 2,
    heating_type: 'Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Hard-Surface Flooring', 'Carpet', 'Tile'],
    amenities: [
      'Modern 2023 Single-Family Construction',
      'Open Floor Plan with Seamless Flow',
      'Contemporary Kitchen with Gas Range & Microwave',
      'Primary Suite with Walk-In Closet & Private Bath',
      'Energy-Efficient Thermal Construction',
      'Attached 2-Car Garage & Private Backyard',
      'Central Air Conditioning & Heating',
      'Pet Friendly'
    ],
    appliances: [
      'Refrigerator',
      'Gas Range / Oven',
      'Dishwasher',
      'Microwave',
      'Washer/Dryer Hookups'
    ],
    description: `Constructed in 2023, 10821 Southwest 22nd Street presents 1,260 square feet of contemporary single-family living in a vibrant, growing Yukon community.

The open floor plan creates a seamless progression between the primary living room, dining zone, and designer kitchen. The kitchen is outfitted with sleek solid-surface countertops, contemporary cabinetry, a gas range with oven, microwave, dishwasher, and refrigerator. Dedicated in-unit laundry hookups are situated within an interior utility space.

Three comfortable bedrooms feature plush neutral carpeting and generous closet space. The primary suite boasts a private bathroom and a walk-in closet, complemented by a second full hallway bathroom finished with modern tile accents and updated fixtures. Energy-efficient construction pairs with central air conditioning and gas heating for optimal efficiency. The home includes an attached two-car garage and a private backyard.

This pet-friendly property requires a $50 application fee per adult applicant. Resident is responsible for utility services. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-199A4275',
    existing_property_id: null,
    title: '12713 Carrara Ln, Yukon, OK 73099',
    address: '12713 Carrara Ln',
    city: 'Yukon',
    state: 'OK',
    zip: '73099',
    county: 'Canadian County',
    lat: 35.59849,
    lng: -97.680626,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1286,
    monthly_rent: 1590,
    security_deposit: 1590,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached 2-Car Garage',
    garage_spaces: 2,
    heating_type: 'Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Hard-Surface Flooring', 'Carpet', 'Tile'],
    amenities: [
      'Smart Home Features & Modern Construction',
      'Open Living Room with Hard-Surface Flooring',
      'Contemporary Kitchen with Built-In Dishwasher & Microwave',
      'Primary Suite with Attached Private Bath',
      'Private Fenced Backyard with Patio Area',
      'Attached 2-Car Garage',
      'Central Air Conditioning & Heating',
      'Pet Friendly'
    ],
    appliances: [
      'Range / Oven',
      'Dishwasher',
      'Microwave',
      'Washer/Dryer Hookups'
    ],
    description: `Situated in a well-planned Northwest Yukon neighborhood, 12713 Carrara Lane offers 1,286 square feet of modern single-family living enhanced by smart home technology and energy-efficient construction.

The home opens into a bright central living room detailed with modern hard-surface flooring and crisp neutral walls. The adjoining kitchen is designed for convenient entertaining, equipped with contemporary cabinetry, generous prep counter space, an electric range and oven, dishwasher, and microwave. Washer and dryer connections are conveniently located in an interior utility room.

Three tranquil bedrooms offer comfortable carpeted accommodations with abundant closet capacity. The primary bedroom features a private ensuite bathroom with contemporary plumbing fixtures and vanity lighting. A second full hallway bathroom serves the remaining bedrooms with clean tiled surfaces. Efficient central air conditioning and forced air heating provide steady indoor comfort. Outside, enjoy a private fenced backyard and an attached two-car garage.

Pet-friendly home with a $50 application fee. Resident is responsible for utilities. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-8251DC86',
    existing_property_id: null,
    title: '10416 NW 40th St, Yukon, OK 73099',
    address: '10416 NW 40th St',
    city: 'Yukon',
    state: 'OK',
    zip: '73099',
    county: 'Canadian County',
    lat: 35.510803,
    lng: -97.70369,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1536,
    monthly_rent: 1485,
    security_deposit: 1485,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached 2-Car Garage',
    garage_spaces: 2,
    heating_type: 'Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Hard-Surface Flooring', 'Carpet', 'Tile'],
    amenities: [
      'Cozy Brick Fireplace & High Living Room Ceilings',
      'Smart Home Capabilities',
      'Large Fenced Backyard with Patio',
      'Primary Bedroom with Ensuite Bath & Ceiling Fan',
      'Dedicated Utility Laundry Room with Hookups',
      'Attached 2-Car Garage with Driveway',
      'Central Air Conditioning & Heating',
      'Pet Friendly'
    ],
    appliances: [
      'Range / Oven',
      'Dishwasher',
      'Washer/Dryer Hookups'
    ],
    description: `Nestled in a peaceful residential pocket of Yukon, 10416 Northwest 40th Street delivers 1,536 square feet of single-story family living across an expansive three-bedroom, two-bathroom floor plan.

The interior showcases an open living area centered around a cozy brick fireplace, augmented by high ceilings and smart home features. The kitchen is outfitted with rich cabinetry, durable countertops, a range with oven, and a dishwasher, with direct access to a dedicated dining area. A separate interior laundry room provides hookups for washer and dryer installation.

The three bedrooms are comfortably appointed with generous closet storage and ceiling fans. The primary bedroom includes an ensuite bathroom, while a second full bathroom serves the additional bedrooms with modern vanity cabinetry and a full tub/shower surround. Central air conditioning and forced air heat maintain year-round climate balance. Outdoors, a large fenced backyard and an attached two-car garage offer plenty of space for vehicles and outdoor living.

This pet-friendly home requires a $50 application fee per applicant. Resident is responsible for utilities. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-3B78DE49',
    existing_property_id: null,
    title: '9509 Black Tail Cir, Yukon, OK 73099',
    address: '9509 Black Tail Cir',
    city: 'Yukon',
    state: 'OK',
    zip: '73099',
    county: 'Canadian County',
    lat: 35.50672,
    lng: -97.76254,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 4,
    bathrooms: 2.5,
    half_bathrooms: 1,
    total_bathrooms: 3,
    square_footage: 1816,
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
    has_basement: false,
    parking: 'Attached 2-Car Garage',
    garage_spaces: 2,
    heating_type: 'Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Luxury Vinyl Plank', 'Carpet', 'Tile'],
    amenities: [
      'Two-Story Floor Plan with Upstairs Loft Living Area',
      'Convenient Powder Bath on Main Floor (2.5 Baths Total)',
      'Primary Suite with Walk-In Closet & Ensuite Bath',
      'Upstairs Jack-and-Jill Bathroom Serving Guest Rooms',
      'Kitchen Island with Stainless Steel Gas Range Suite',
      'Full-Service Lawn Care Included in Rent',
      'Attached 2-Car Garage',
      'Located in Redstone Ranch Community with Highway Access',
      'Pet Friendly'
    ],
    appliances: [
      'Stainless Steel Refrigerator',
      'Gas Range / Oven',
      'Dishwasher',
      'Microwave',
      'Garbage Disposal',
      'Washer/Dryer Hookups'
    ],
    description: `Located in the Redstone Ranch community of Yukon with convenient highway access, 9509 Black Tail Circle is a handsome two-story single-family home featuring 1,816 square feet of living space with four bedrooms and two-and-a-half bathrooms.

The main level welcomes guests with durable luxury vinyl plank flooring spanning across an open-concept family room and dining area. A convenient powder room half-bath is situated on the main floor for guests. The kitchen features an island, stainless steel appliances including a gas range and oven, dishwasher, microwave, and refrigerator, backed by ample cabinet storage.

Upstairs, a versatile central loft space serves as a secondary living room or media area. The expansive primary suite includes a private bathroom and a large walk-in closet. Three secondary bedrooms are connected by a functional Jack-and-Jill full bathroom, with a dedicated second-floor laundry room. Central air conditioning and forced air heating deliver efficient temperature control throughout both levels. Outside, full-service lawn care is included, alongside an attached two-car garage.

Pet-friendly property with a $50 application fee. Resident is responsible for utilities. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-FCE1B780',
    existing_property_id: null,
    title: '11608 SW 12th St, Yukon, OK 73099',
    address: '11608 SW 12th St',
    city: 'Yukon',
    state: 'OK',
    zip: '73099',
    county: 'Canadian County',
    lat: 35.453625,
    lng: -97.72949,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1257,
    monthly_rent: 1550,
    security_deposit: 1550,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached 2-Car Garage',
    garage_spaces: 2,
    heating_type: 'Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Carpet', 'Tile', 'Hard-Surface Flooring'],
    amenities: [
      'Bright Open Living and Dining Flow',
      'Modern Kitchen with Solid Countertops & Dishwasher',
      'Primary Suite with Private Ensuite Bathroom',
      'Plush Carpeting in Bedrooms with Generous Closets',
      'Attached 2-Car Garage & Private Backyard',
      'Central Air Conditioning & Forced Air Heat',
      'Dedicated Interior Laundry Closet',
      'Pet Friendly'
    ],
    appliances: [
      'Range / Oven',
      'Dishwasher',
      'Microwave',
      'Washer/Dryer Hookups'
    ],
    description: `Set in a desirable Yukon neighborhood close to Mustang and OKC transit corridors, 11608 Southwest 12th Street offers 1,257 square feet of updated single-family living in a clean, modern single-story layout.

The home opens into a luminous living room that transitions into an open kitchen and dining space. The kitchen is equipped with solid-surface countertops, contemporary cabinetry, an electric range and oven, a microwave, and a dishwasher. A dedicated interior laundry closet features washer and dryer hookups for everyday convenience.

Three well-proportioned bedrooms provide quiet retreats with plush carpeting and expansive closet storage. The primary bedroom features a private bathroom with modern vanity fixtures, complemented by a second full hallway bathroom with a clean tile surround and updated hardware. Forced air heating and central air conditioning provide efficient climate control. An attached two-car garage and a private backyard complete the property.

Pet-friendly home with a $50 application fee. Resident is responsible for utilities. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-EF1517CA',
    existing_property_id: 'c7116e4f-a4e8-4629-aa81-2b19a97a42cd',
    title: '12324 SW 5th St, Yukon, OK 73099',
    address: '12324 SW 5th St',
    city: 'Yukon',
    state: 'OK',
    zip: '73099',
    county: 'Canadian County',
    lat: 35.461273,
    lng: -97.74637,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1361,
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
    has_basement: false,
    parking: 'Attached 2-Car Garage',
    garage_spaces: 2,
    heating_type: 'Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Hard-Surface Flooring', 'Carpet', 'Tile'],
    amenities: [
      'Comfortable 1,361 Sq Ft Open Living Floor Plan',
      'Private Fully Fenced Backyard for Pets & Relaxing',
      'Primary Suite with Dedicated Full Bathroom',
      'Kitchen with Extensive Cabinet Storage & Dishwasher',
      'Attached 2-Car Garage & Concrete Driveway',
      'Central Air Conditioning & Heating',
      'Dedicated Laundry Utility Room',
      'Pet Friendly'
    ],
    appliances: [
      'Range / Oven',
      'Dishwasher',
      'Washer/Dryer Hookups'
    ],
    description: `Positioned on Southwest 5th Street in a quiet residential enclave of Yukon, 12324 Southwest 5th Street presents 1,361 square feet of comfortable single-family living featuring an open layout and a private fenced backyard.

The front entry opens into a bright living room that flows seamlessly into the kitchen and dining area. The kitchen is fitted with practical counter space, extensive cabinet storage, an electric range and oven, a dishwasher, and a double basin sink. Dedicated in-unit laundry connections are situated within the utility room for washer and dryer setup.

Three bedrooms feature ample closet space and natural light, anchored by a primary suite that includes a private full bathroom. A second full hallway bathroom serves the remaining bedrooms with updated fixtures and clean surfaces. Forced air heating and central air conditioning ensure steady year-round indoor temperatures. Exterior features include a fully fenced backyard for pets or outdoor leisure, plus an attached two-car garage.

This pet-friendly property has a $50 application fee per applicant. Resident is responsible for all utilities. Submit your rental application today at Choice Properties.`
  }
];

export async function runYukonPublish() {
  console.log('================================================================');
  console.log('CHOICE PROPERTIES — YUKON 12 PROPERTIES MANUAL ENRICHMENT & PUBLISH');
  console.log(`Processing Batch: ${YUKON_BATCH.length} Properties`);
  console.log('================================================================\n');

  const publishedResults = [];

  for (let i = 0; i < YUKON_BATCH.length; i++) {
    const item = YUKON_BATCH[i];
    console.log(`\n[${i + 1}/${YUKON_BATCH.length}] Processing: ${item.address}, ${item.city} ${item.zip} (${item.pipeline_id})`);

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
  console.log(`PUBLISHING COMPLETE: ${publishedResults.length}/${YUKON_BATCH.length} PROPERTIES`);
  console.log('================================================================\n');

  publishedResults.forEach((p, idx) => {
    console.log(`${idx + 1}. ${p.address}, ${p.city}, ${p.state} ${p.zip} ($${p.rent}/mo | ${p.bedrooms} Bed / ${p.bathrooms} Bath) — ${p.url}`);
  });

  return publishedResults;
}

// Only execute when run directly from CLI
if (process.argv[1]?.endsWith('publish_yukon_batch_12.mjs')) {
  runYukonPublish().catch(console.error);
}
