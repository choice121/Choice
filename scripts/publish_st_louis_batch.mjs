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

// 12 St. Louis Zillow Properties - Full Manual Enrichment with Verified Information
// Pricing Rules Applied:
// - Original = $1,200 -> Reduced $50 to $1,150
// - Original > $1,200 -> Reduced to $1,200
// - Original < $1,200 ($1,195) -> Retained at $1,195
const ST_LOUIS_PROPERTIES = [
  {
    pipeline_id: 'PP-7B50C60F',
    address: '1277 Waldorf Dr',
    city: 'Saint Louis',
    state: 'MO',
    zip: '63137',
    county: 'St. Louis County',
    neighborhood: 'Bissell Hills / North County',
    lat: 38.7489,
    lng: -90.2212,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 2,
    half_bathrooms: null,
    total_bathrooms: 2,
    square_footage: 982,
    monthly_rent: 1200, // Reduced from 1250 to 1200
    security_deposit: 1200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Attached Garage, Covered Carport & Driveway',
    garage_spaces: 1,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Durable Vinyl Plank Flooring', 'Tile'],
    amenities: [
      'Single-Story 2-Bedroom, 2-Bathroom Layout (982 Sq. Ft.)',
      'Dual Parking: Attached 1-Car Garage Plus Covered Carport',
      'Equipped Kitchen with Range, Refrigerator, Pantry & Counter Prep Space',
      'Central Air Conditioning and Ceiling Fans for Maximum Comfort',
      'Full Lower-Level Basement with Abundant Storage Capacity',
      'Dedicated In-Unit Laundry Connections with Linen Storage',
      'Close to Local Neighborhood Parks, Schools & Route 367 / I-270',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `An attached garage, covered carport, durable vinyl plank flooring, and 982 sq. ft. of comfortable single-level living highlight this 2-bedroom, 2-bathroom home on Waldorf Drive.

The residence opens into a bright front living room equipped with central air conditioning and ceiling fans. The kitchen is designed for efficiency with a dedicated food pantry, laminate countertops, a cooking range, refrigerator, and practical cabinet storage.

Two spacious bedrooms are complemented by two full bathrooms, offering rare convenience for a home of this size. The full basement provides expansive storage capacity and dedicated laundry hookups. Outside, enjoy covered vehicle protection with both an attached single-car garage and an adjacent carport. Located on a quiet residential street with swift access to Lewis and Clark Blvd (Route 367) and I-270.

Key Property Features:
• 2 Bedrooms, 2 Full Bathrooms (982 sq. ft.)
• Attached 1-car garage plus covered carport
• Kitchen with dedicated pantry, range, and refrigerator
• Full basement providing extensive storage space
• Central cooling and forced air heating
• Dual full bathrooms for resident ease
• Convenient North County location near Route 367
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,200 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-61CFC0D7',
    address: '7534 Blanding Dr',
    city: 'Saint Louis',
    state: 'MO',
    zip: '63135',
    county: 'St. Louis County',
    neighborhood: 'Ferguson / North County',
    lat: 38.7495,
    lng: -90.2854,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 768,
    monthly_rent: 1195, // Kept at 1195 (< 1200)
    security_deposit: 1195,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Private Off-Street Driveway Parking',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Basement Washer/Dryer Hookups',
    flooring: ['Hardwood-Style Flooring', 'Tile'],
    amenities: [
      'Comfortable 2-Bedroom, 1-Bathroom Single-Family Floor Plan (768 Sq. Ft.)',
      'Sunlit Living Room with Open Transition to Dining Area',
      'Functional Kitchen with Generous Countertop & Cabinet Storage',
      'Full Unfinished Basement for Storage and Flexible Utility Space',
      'Spacious Green Backyard for Outdoor Enjoyment',
      'Central Climate Control System',
      'Proximity to January-Wabash Park, Local Dining & St. Louis Community College',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `A large green backyard, full basement storage, and an inviting light-filled interior define this 2-bedroom, 1-bathroom single-family home in Ferguson.

The home features a comfortable living room that captures abundant natural daylight through large front windows. Directly adjacent, the kitchen offers clean cabinetry, ample counter space, and room for a breakfast table.

Two well-sized bedrooms share a central full bathroom with clean tile surrounds. Downstairs, the full unfinished basement provides excellent extra storage and dedicated washer/dryer connections. Outside, the spacious backyard offers plenty of open lawn for pets and outdoor relaxation. Situated near January-Wabash Memorial Park, Hudson Park, local dining on Florissant Road, and I-270.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (768 sq. ft.)
• Sunlit living and dining areas
• Kitchen with ample cabinetry and full appliances
• Full basement with extensive storage and laundry hookups
• Large open backyard with mature landscaping
• Off-street driveway parking
• Close to January-Wabash Park and Florissant Road retail
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,195
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  },
  {
    pipeline_id: 'PP-7E0CB5A9',
    address: '320 Henquin Dr',
    city: 'Saint Louis',
    state: 'MO',
    zip: '63135',
    county: 'St. Louis County',
    neighborhood: 'Ferguson / North St. Louis County',
    lat: 38.7421,
    lng: -90.2912,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 1000,
    monthly_rent: 1200, // Reduced from 1298 to 1200
    security_deposit: 1200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Private Driveway Parking',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Home Laundry Connections',
    flooring: ['Hardwood Flooring', 'Tile'],
    amenities: [
      'Generous 3-Bedroom Single-Family Home (1,000 Sq. Ft.)',
      'Move-In Ready with Municipal Occupancy Inspection Passed',
      'Solid Hardwood Floors Throughout Living Areas & Bedrooms',
      'Functional Kitchen with Quality Cabinetry & Cooking Appliances',
      'Full Basement for Storage and Workshop Use',
      'Expansive Yard Space with Mature Shade Trees',
      'Close to Ferguson Schools, Shopping Centers & I-270 / I-70',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `A spacious 1,000 sq. ft. 3-bedroom floor plan, gleaming hardwood floors, and full basement storage highlight this move-in ready single-family home on Henquin Drive.

The property features a bright living room with large windows and hardwood flooring that extends throughout all three bedrooms. The kitchen provides plenty of counter space and solid cabinet storage for easy meal preparation.

Three generously sized bedrooms offer versatile layout options and are served by a central full bathroom. Downstairs, a full basement provides substantial storage capacity and laundry connections. Situated in an established North County neighborhood within minutes of schools, shopping corridors, and major highway connections.

Key Property Features:
• 3 Bedrooms, 1 Bathroom (1,000 sq. ft.)
• Passed municipal occupancy inspection and move-in ready
• Hardwood flooring across living spaces and bedrooms
• Functional kitchen with cooking appliances
• Full basement with generous storage
• Private driveway and spacious yard
• Convenient to I-270 and local retail
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,200 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  },
  {
    pipeline_id: 'PP-E53AD969',
    address: '750 Kelvin Dr',
    city: 'Saint Louis',
    state: 'MO',
    zip: '63137',
    county: 'St. Louis County',
    neighborhood: 'Bellefontaine Neighbors',
    lat: 38.7512,
    lng: -90.2245,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 912,
    monthly_rent: 1200, // Reduced from 1295 to 1200
    security_deposit: 1200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Attached 1-Car Garage & Driveway',
    garage_spaces: 1,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Connections',
    flooring: ['Updated Hardwood Plank Flooring', 'Tile'],
    amenities: [
      'Freshly Updated 3-Bedroom Home with Attached Garage (912 Sq. Ft.)',
      'Modern Kitchen Equipped with Stainless Steel Appliances',
      'Passed City of Bellefontaine Neighbors Occupancy Inspection',
      'Attached 1-Car Garage with Direct Entry & Extended Driveway',
      'Full Lower-Level Basement for Extra Storage Capacity',
      'Central Air Conditioning & Heating for Complete Climate Control',
      'Fenced Backyard Space Ideal for Outdoor Leisure',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Stainless Steel Refrigerator', 'Stainless Steel Range / Oven', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `Stainless steel kitchen appliances, an attached garage, and fresh interior updates highlight this 3-bedroom, 1-bathroom home on Kelvin Drive in Bellefontaine Neighbors.

The home welcomes you into a bright living room featuring clean flooring and neutral paint. The modernized kitchen is outfitted with contemporary stainless steel appliances, solid cabinetry, and ample counter space.

Three bedrooms provide comfortable accommodations, each with built-in closet storage, sharing a refreshed full bathroom. An attached single-car garage and a full basement offer abundant vehicle parking, workshop potential, and storage. Passed municipal occupancy inspection and ready for immediate occupancy.

Key Property Features:
• 3 Bedrooms, 1 Bathroom (912 sq. ft.)
• Updated kitchen with stainless steel appliances
• Attached 1-car garage and off-street driveway
• Full basement with expansive storage room
• Central heating and air conditioning
• Fully passed municipal occupancy inspection
• Easy commute via Route 367 and I-270
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,200 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  },
  {
    pipeline_id: 'PP-616957B1',
    address: '315 Averill Ave',
    city: 'Saint Louis',
    state: 'MO',
    zip: '63135',
    county: 'St. Louis County',
    neighborhood: 'Ferguson / North County',
    lat: 38.7418,
    lng: -90.2982,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 840,
    monthly_rent: 1200, // Reduced from 1295 to 1200
    security_deposit: 1200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Private Garage & Off-Street Parking',
    garage_spaces: 1,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Hardwood Flooring', 'Tile'],
    amenities: [
      'Impeccably Maintained 2-Bedroom Single-Family Home (840 Sq. Ft.)',
      'Private Secure Garage for Vehicle Parking & Storage',
      'Spacious Primary Bedroom with Ample Closet Storage',
      'Full Usable Basement Ideal for Home Office, Fitness or Storage',
      'Bright Kitchen with Generous Prep Space & Cooking Range',
      'Central Climate Control System',
      'Established Tree-Lined Street Close to Parks & Transit',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `A private garage, fully usable basement, and well-maintained interior define this 2-bedroom single-family home on Averill Avenue in Ferguson.

The home opens to a welcoming central living room featuring polished hardwood flooring and natural light. The kitchen offers practical countertop workspace, dependable cabinetry, and full cooking appliances.

Two comfortable bedrooms are supported by a well-kept central bathroom. The full basement provides versatile space for a home office, hobby area, or extensive storage, alongside laundry hookups. Complete with a private garage and off-street parking. Located in a quiet, established neighborhood near local community parks and primary travel routes.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (840 sq. ft.)
• Polished hardwood floors throughout
• Private secure garage and driveway parking
• Full usable basement for storage or office use
• Central air conditioning and heating
• Established neighborhood setting
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,200 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-8C00B028',
    address: '1136 Grenshaw Dr',
    city: 'Saint Louis',
    state: 'MO',
    zip: '63137',
    county: 'St. Louis County',
    neighborhood: 'Bissell Hills / North County',
    lat: 38.7468,
    lng: -90.2234,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 1030,
    monthly_rent: 1150, // Original 1200 -> Reduced $50 to 1150
    security_deposit: 1150,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Detached 1-Car Garage & Driveway',
    garage_spaces: 1,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Basement Washer/Dryer Hookups',
    flooring: ['Hardwood Floors', 'Vinyl Plank Flooring', 'Tile'],
    amenities: [
      'Updated 2-Bedroom Home with Sunroom & Rear Porch (1,030 Sq. Ft.)',
      'Sun-Drenched Back Sunroom Overlooking Partially Fenced Yard',
      'Fresh Interior Paint with Hardwood & Vinyl Plank Flooring',
      'Detached 1-Car Garage with Long Paved Driveway',
      'Full Unfinished Basement Offering Extensive Storage Space',
      'Central Air Conditioning and Heating System',
      'Quiet Residential Setting near Route 367 Corridors',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `A light-filled rear sunroom, covered back porch, detached 1-car garage, and 1,030 sq. ft. of updated living space highlight this 2-bedroom, 1-bathroom home on Grenshaw Drive.

The interior showcases fresh neutral paint, durable vinyl plank flooring, and classic hardwood finishes. The kitchen is efficiently arranged with plenty of cabinet storage, counter workspace, and cooking appliances.

At the back of the home, enjoy a bright sunroom with direct access to a rear porch overlooking a partially fenced yard. Two comfortable bedrooms share a central full bathroom. A full unfinished basement provides abundant storage space, and the detached single-car garage offers secure parking. Located in North County with straightforward access to Route 367 and I-270.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (1,030 sq. ft.)
• Sunlit sunroom opening to rear porch and yard
• Fresh interior paint and combination hardwood/vinyl plank floors
• Detached 1-car garage and extended driveway
• Full basement with ample storage space
• Central cooling and forced air heating
• Convenient North St. Louis County location
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,150 (Special Reduced Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  },
  {
    pipeline_id: 'PP-E7E6DE79',
    address: '10139 Cabot Dr',
    city: 'Saint Louis',
    state: 'MO',
    zip: '63137',
    county: 'St. Louis County',
    neighborhood: 'Bellefontaine Neighbors',
    lat: 38.7534,
    lng: -90.2201,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 792,
    monthly_rent: 1195, // Kept at 1195 (< 1200)
    security_deposit: 1195,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Dedicated Off-Street Driveway',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Basement Washer/Dryer Hookups',
    flooring: ['Hardwood-Style Plank Flooring', 'Tile'],
    amenities: [
      'Renovated 2-Bedroom, 1-Bathroom Home on Quiet Street (792 Sq. Ft.)',
      'Modernized Kitchen with Updated Cabinetry & Countertops',
      'Large Backyard Ideal for Outdoor Cooking & Relaxation',
      'Full Lower-Level Basement with Abundant Storage Room',
      'Central Air Conditioning and Heating System',
      'Quiet Residential Setting with Easy Highway Access',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `A renovated kitchen, expansive backyard, full basement storage, and a quiet street setting highlight this 2-bedroom, 1-bathroom single-family home on Cabot Drive.

The home features an easy-flowing floor plan with updated plank flooring and abundant natural light. The renovated kitchen offers clean contemporary cabinets, updated countertops, and cooking appliances.

Two well-proportioned bedrooms share a central full bathroom. The full basement provides substantial storage capacity and in-home laundry connections. The large backyard offers plenty of open lawn for outdoor recreation and pets. Positioned in Bellefontaine Neighbors with quick access to Route 367 and I-270.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (792 sq. ft.)
• Renovated kitchen with modern cabinetry
• Large backyard perfect for outdoor gatherings
• Full basement with substantial storage capacity
• Central air conditioning and heating
• Dedicated off-street parking
• Fast access to major highways and shopping
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,195
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  },
  {
    pipeline_id: 'PP-47A31953',
    address: '450 S Dade Ave',
    city: 'Saint Louis',
    state: 'MO',
    zip: '63135',
    county: 'St. Louis County',
    neighborhood: 'Ferguson / North County',
    lat: 38.7389,
    lng: -90.3012,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 1040,
    monthly_rent: 1150, // Original 1200 -> Reduced $50 to 1150
    security_deposit: 1150,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Off-Street Driveway Parking',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Basement Washer/Dryer Hookups',
    flooring: ['Hardwood Plank Flooring', 'Tile'],
    amenities: [
      'Fully Renovated 2-Bedroom Home with Bonus Sunroom (1,040 Sq. Ft.)',
      'Versatile Bonus Sunroom Off Primary Bedroom for Home Office or Reading Nook',
      'Renovated Kitchen with Modern Cabinetry & Fixtures',
      'Updated Bathroom with Contemporary Finishes',
      'Fully Fenced Backyard for Private Outdoor Living',
      'Full Unfinished Basement with Washer/Dryer Hookups & Storage',
      'Fast, Easy Access to I-70 for Quick Commuting',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `A fully renovated kitchen and bathroom, private bonus sunroom off the primary bedroom, and a fully fenced backyard highlight this move-in-ready 2-bedroom home on South Dade Avenue.

The interior showcases fresh modern finishes throughout an open living area. The newly updated kitchen features contemporary cabinets, solid countertops, and cooking appliances.

The primary bedroom connects directly to a bonus sunroom—ideal for a dedicated home office, nursery, or quiet reading nook. A second bedroom and a fully renovated bathroom complete the main level. Outside, enjoy a secure fully fenced backyard, while the full basement provides ample extra storage and laundry hookups. Conveniently located with rapid access to I-70.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (1,040 sq. ft.)
• Bonus sunroom off the primary bedroom
• Fully renovated kitchen and bathroom
• Fully fenced private backyard
• Full basement with laundry connections and storage
• Central climate control system
• Immediate access to I-70 for easy travel
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,150 (Special Reduced Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  },
  {
    pipeline_id: 'PP-37D12D22',
    address: '324 Newell Dr',
    city: 'Saint Louis',
    state: 'MO',
    zip: '63135',
    county: 'St. Louis County',
    neighborhood: 'Ferguson / North County',
    lat: 38.7445,
    lng: -90.2934,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 802,
    monthly_rent: 1200, // Reduced from 1250 to 1200
    security_deposit: 1200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Detached Garage & Off-Street Driveway',
    garage_spaces: 1,
    heating_type: 'Newer Central Heating System',
    cooling_type: 'Newer Central Air Conditioning System',
    laundry_type: 'Basement Laundry Hookups',
    flooring: ['Gleaming Hardwood Floors Throughout', 'Tile'],
    amenities: [
      'Freshly Painted 2-Bedroom Home with Hardwood Floors (802 Sq. Ft.)',
      'Modern High-Efficiency HVAC & Water Heater Systems',
      'Detached Secure Garage with Generous Off-Street Driveway',
      'Full Basement Offering Substantial Storage Capacity',
      'Bright and Airy Living Room with Hardwood Finishes',
      'Established Quiet Neighborhood in Ferguson',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `Fresh interior paint, gleaming hardwood floors throughout, modern mechanical systems (HVAC and water heater), and a detached garage highlight this 2-bedroom, 1-bathroom home on Newell Drive.

The home opens into a bright and airy living room highlighted by refinished hardwood flooring. The kitchen offers practical meal-prep counters, clean cabinetry, and full appliances.

Both bedrooms feature beautiful hardwood floors and share a central full bathroom. Downstairs, a large basement provides abundant storage capacity alongside laundry connections. The property also features a secure detached garage and plenty of off-street parking. Situated in a peaceful North County neighborhood near local parks and retail centers.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (802 sq. ft.)
• Refinished hardwood flooring throughout the home
• Freshly painted interior
• Detached garage and extended private driveway
• Newer central heating, air conditioning, and water heater
• Large full basement with extensive storage
• Quiet Ferguson neighborhood location
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,200 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-28DD97AC',
    address: '8301 Fullerton Ave',
    city: 'Saint Louis',
    state: 'MO',
    zip: '63132',
    county: 'St. Louis County',
    neighborhood: 'University City / Hanley Hills / Central County',
    lat: 38.6812,
    lng: -90.3345,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 900,
    monthly_rent: 1200, // Reduced from 1300 to 1200
    security_deposit: 1200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Private Driveway & Off-Street Parking',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Basement Washer/Dryer Connections',
    flooring: ['Hardwood-Style Plank Flooring', 'Tile'],
    amenities: [
      'Charming 2-Bedroom Single-Family Home (900 Sq. Ft.) in 63132',
      'Prime Central County Location near University City & I-170 Corridor',
      'Open Living Area with Abundant Natural Light',
      'Equipped Kitchen with Full Appliances & Ample Cabinets',
      'Full Basement for Storage, Laundry & Utility Workspace',
      'Private Backyard with Mature Landscaping',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `A central St. Louis County location near University City, full basement storage, central air, and an open 900 sq. ft. floor plan define this 2-bedroom, 1-bathroom single-family home on Fullerton Avenue.

The home welcomes you into a bright central living room featuring durable plank flooring and oversized windows. The kitchen is well-equipped with solid cabinetry, generous counter space, and a full appliance setup.

Two comfortable bedrooms offer ample closet storage and share a central full bathroom. Downstairs, the full basement provides extensive storage space and dedicated washer/dryer hookups. Situated in desirable 63132 with immediate access to I-170, Page Avenue, University City shopping, and Clayton employment centers.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (900 sq. ft.)
• Bright living room with clean plank flooring
• Functional kitchen with full appliance suite
• Full basement with substantial storage room
• Central heating and air conditioning
• Private driveway and spacious yard
• Prime Central County location near I-170 & Clayton
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,200 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  },
  {
    pipeline_id: 'PP-FACB8B38',
    address: '10167 Jepson Dr',
    city: 'Saint Louis',
    state: 'MO',
    zip: '63137',
    county: 'St. Louis County',
    neighborhood: 'Bellefontaine Neighbors',
    lat: 38.7541,
    lng: -90.2221,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 792,
    monthly_rent: 1200, // Reduced from 1275 to 1200
    security_deposit: 1200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Attached 1-Car Garage & Driveway',
    garage_spaces: 1,
    heating_type: 'Updated Central Heating',
    cooling_type: 'Updated Central Air Conditioning',
    laundry_type: 'Epoxy-Floored Basement with In-Unit Washer & Dryer Included',
    flooring: ['Refinished Oak Hardwood Floors', 'Tile', 'Epoxy Basement Floor'],
    amenities: [
      'Fully Updated 2-Bedroom Home with Attached Garage & Huge Back Deck',
      'Refinished Oak Hardwood Floors Throughout Living Areas & Bedrooms',
      'Chef-Style Kitchen with Gas Range, Microwave, Dishwasher & Disposal',
      'Huge Stained Back Deck Overlooking Large Private Fenced Yard',
      'Ultra-Clean Basement with Painted Walls, Epoxied Floors, Washer & Dryer Included',
      'Energy-Efficient Windows with Custom Blinds & Remote-Controlled Ceiling Fans',
      'Attached 1-Car Garage with Automatic Opener',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Gas Range / Oven', 'Over-the-Range Microwave', 'Built-In Dishwasher', 'Garbage Disposal', 'Washer', 'Dryer'],
    description: `Refinished oak hardwood floors, a chef-style kitchen with full appliances, an attached garage, a huge stained back deck, and an ultra-clean epoxied basement with washer and dryer included highlight this updated home on Jepson Drive.

The main living areas and both bedrooms showcase gleaming refinished oak hardwood floors, crisp neutral paint, energy-efficient windows, and remote-controlled ceiling fans. The kitchen is fully equipped with upgraded LED lighting, a chef's pull-down faucet, gas range, built-in microwave, refrigerator, dishwasher, and disposal.

Step out onto a massive back deck overlooking a private, fully fenced backyard with mature trees. Downstairs, the basement features painted walls and an epoxy-coated floor perfect for a home gym or hobby space, complete with washer and dryer. Located on a quiet street in Bellefontaine Neighbors with quick access to Route 367 and I-270.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (792 sq. ft.)
• Refinished oak hardwoods throughout
• Upgraded kitchen with gas range, dishwasher, and microwave
• Huge back deck and fully fenced private yard
• Clean epoxied basement with washer & dryer included
• Attached 1-car garage with automatic opener
• Updated energy-efficient windows and central HVAC
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,200 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-237E9387',
    address: '10220 Doane Dr',
    city: 'Saint Louis',
    state: 'MO',
    zip: '63136',
    county: 'St. Louis County',
    neighborhood: 'Moline Acres / North County',
    lat: 38.7491,
    lng: -90.2456,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 1014,
    monthly_rent: 1200, // Reduced from 1300 to 1200
    security_deposit: 1200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Attached 1-Car Garage & Driveway',
    garage_spaces: 1,
    heating_type: 'Central Heating System',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Hardwood-Style Plank Flooring', 'Tile'],
    amenities: [
      'Spacious 3-Bedroom Single-Family Home with Over 1,000 Sq. Ft.',
      'Attached 1-Car Garage with Direct Home Access & Extended Driveway',
      'Large Open Living Room with Generous Natural Light',
      'Equipped Kitchen with Full Appliance Package',
      'Central Air Conditioning for Summer Comfort',
      'Expansive Backyard Perfect for Grilling, Relaxing & Pets',
      'Quiet Residential Neighborhood near Parks, Retail & Highways',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `An attached garage, expansive backyard, central air, and over 1,000 sq. ft. of comfortable living space highlight this 3-bedroom, 1-bathroom single-family home on Doane Drive.

The home offers a bright and open living area with large front windows and clean plank flooring. The kitchen provides ample counter workspace, solid cabinet storage, and a full appliance setup for daily cooking.

Three spacious bedrooms feature generous closet storage and are served by a central full bathroom. An attached single-car garage provides secure parking and storage. Outside, the large backyard offers ample open space for grilling and outdoor relaxation. Located in a quiet neighborhood with easy access to shopping centers, community parks, and major highways.

Key Property Features:
• 3 Bedrooms, 1 Bathroom (1,014 sq. ft.)
• Bright, open living room layout
• Equipped kitchen with full appliances and ample storage
• Attached 1-car garage and off-street driveway
• Large open backyard
• Central air conditioning and heating
• Convenient North County location near shopping and transit
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,200 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  }
];

async function publishStLouisBatch() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('  Choice Properties — St. Louis Zillow Publishing ($1,100-$1,200 Target)');
  console.log(`  Processing ${ST_LOUIS_PROPERTIES.length} Fully Enriched Properties`);
  console.log('  Pricing Rules: $1,200 -> reduced $50 ($1,150); >$1,200 -> $1,200; <$1,200 -> as-is');
  console.log('═════════════════════════════════════════════════════════════════\n');

  const rawPipelineData = JSON.parse(fs.readFileSync('scripts/stlouis_raw.json', 'utf8'));
  const rawMap = new Map(rawPipelineData.map(p => [p.id, p]));

  const publishedResults = [];
  const today = new Date().toISOString().split('T')[0];

  for (let i = 0; i < ST_LOUIS_PROPERTIES.length; i++) {
    const item = ST_LOUIS_PROPERTIES[i];
    const pipeId = item.pipeline_id;
    const rawProp = rawMap.get(pipeId);

    console.log(`[${i + 1}/${ST_LOUIS_PROPERTIES.length}] Processing ${item.address} (${item.bedrooms}BR/${item.bathrooms}BA) - $${item.monthly_rent}/mo...`);

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

    const title = `${item.bedrooms}BR/${item.bathrooms}BA Home in ${item.city} – $${item.monthly_rent.toLocaleString()}/mo`;

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

  fs.writeFileSync('scripts/published_st_louis_results.json', JSON.stringify(publishedResults, null, 2));

  console.log('\n═════════════════════════════════════════════════════════════════');
  console.log(`  Published ${publishedResults.length} St. Louis properties successfully!`);
  console.log('═════════════════════════════════════════════════════════════════\n');

  publishedResults.forEach(r => {
    console.log(`${r.n}. ${r.address}, ${r.city}, ${r.state} ${r.zip} ($${r.rent.toLocaleString()}/mo | ${r.beds} Bed / ${r.baths} Bath) — ${r.url}`);
  });
}

publishStLouisBatch().catch(console.error);
