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

// 13 Fort Worth Zillow Properties manually enriched with verified information
// Pricing Target: $1,300 (over 1300 reduced to 1300; <= 1300 kept as-is)
const FORT_WORTH_1300_PROPERTIES = [
  {
    pipeline_id: 'PP-A4879EEB',
    address: '7411 Novella Dr',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76134',
    county: 'Tarrant County',
    neighborhood: 'South Fort Worth / Crowley Border',
    lat: 32.6289,
    lng: -97.3382,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2,
    half_bathrooms: null,
    total_bathrooms: 2,
    square_footage: 1055,
    monthly_rent: 1300, // Reduced from 1400 to 1300
    security_deposit: 1300,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached Garage & Private Driveway',
    garage_spaces: 1,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Connections',
    flooring: ['Luxury Vinyl Plank (LVP)', 'Tile', 'Carpet'],
    amenities: [
      'Well-Maintained 3-Bedroom, 2-Bathroom Layout (1,055 Sq. Ft.)',
      'Open Living Room Flowing into Dining & Kitchen Area',
      'Fully Equipped Kitchen with Range, Refrigerator & Dishwasher',
      'Spacious Primary Bedroom with En-Suite Full Bathroom',
      'Private Fenced Backyard Ideal for Outdoor Enjoyment',
      'Attached 1-Car Garage with Direct Home Access',
      'Quiet Residential Street Close to I-35W & Local Shopping',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Washer/Dryer Hookups'],
    description: `A comfortable 1,055 sq. ft. single-story floor plan, attached 1-car garage, and private fenced backyard highlight this 3-bedroom, 2-bathroom single-family home in South Fort Worth.

The home opens into a bright living room featuring easy-care flooring that connects effortlessly to the dining area and kitchen. The kitchen provides generous cabinet storage, wrap-around countertop prep space, and a complete appliance package including range, refrigerator, and dishwasher.

Three well-proportioned bedrooms include a primary suite with its own private full bathroom, while a second full bathroom serves the additional bedrooms and guests. Outside, enjoy a private fenced backyard with ample room for outdoor relaxation. Conveniently located with quick access to I-35W, Chisholm Trail Parkway, and neighborhood shopping centers.

Key Property Features:
• 3 Bedrooms, 2 Full Bathrooms (1,055 sq. ft.)
• Open living and dining layout with abundant natural light
• Fully equipped kitchen with complete appliance suite
• Primary bedroom suite with dedicated private bath
• Private fenced backyard
• Attached 1-car garage and concrete driveway
• Fast access to I-35W and local retail
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,300 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-3A006F23',
    address: '1906 San Rafael St',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76134',
    county: 'Tarrant County',
    neighborhood: 'South Fort Worth / Edgecliff Area',
    lat: 32.6456,
    lng: -97.3412,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2,
    half_bathrooms: null,
    total_bathrooms: 2,
    square_footage: 960,
    monthly_rent: 1300, // Reduced from 1495 to 1300
    security_deposit: 1300,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Dedicated Off-Street Driveway Parking',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated In-Home Laundry Hookups',
    flooring: ['Hardwood-Style Plank Flooring', 'Tile'],
    amenities: [
      'Efficient 3-Bedroom, 2-Bathroom Single-Family Floor Plan (960 Sq. Ft.)',
      'Durable Hardwood-Style Flooring Throughout Main Areas',
      'Modern Kitchen with Clean Cabinetry & Ample Counter Space',
      'Two Full Bathrooms Providing Comfort for Residents & Guests',
      'Private Fenced Backyard with Mature Shade Trees',
      'Central Heating and Air Conditioning',
      'Minutes to I-35W, Downtown Fort Worth & Local Parks',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `A smart 3-bedroom, 2-bathroom layout, durable plank flooring, and a private fenced yard highlight this single-family home on San Rafael Street in South Fort Worth.

The interior showcases an open living room with easy-care flooring and large windows welcoming natural daylight. The adjacent kitchen features ample counter workspace, solid cabinetry, and a full cooking range and refrigerator.

Three comfortable bedrooms are complemented by two full bathrooms, offering ideal privacy and convenience. Step outside to a private fenced backyard with plenty of open space for pets and quiet relaxation. Situated on a tree-lined street with fast access to I-35W and central Fort Worth employment hubs.

Key Property Features:
• 3 Bedrooms, 2 Full Bathrooms (960 sq. ft.)
• Durable wood-style plank flooring
• Functional kitchen with ample cabinet storage
• Two full bathrooms for added convenience
• Private fenced backyard
• Dedicated off-street driveway parking
• Rapid access to I-35W and surrounding services
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,300 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  },
  {
    pipeline_id: 'PP-1D1A3B26',
    address: '7407 Novella Dr',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76134',
    county: 'Tarrant County',
    neighborhood: 'South Fort Worth / Crowley Area',
    lat: 32.6287,
    lng: -97.3385,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2,
    half_bathrooms: null,
    total_bathrooms: 2,
    square_footage: 1055,
    monthly_rent: 1300, // Reduced from 1400 to 1300
    security_deposit: 1300,
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
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Hardwood-Style Vinyl Flooring', 'Tile'],
    amenities: [
      'Inviting 3-Bedroom, 2-Bathroom Residence (1,055 Sq. Ft.)',
      'Open-Concept Living and Dining Layout',
      'Kitchen Equipped with Full Appliances & Generous Cabinetry',
      'Primary Bedroom Featuring Private En-Suite Bath & Closet Storage',
      'Fully Fenced Backyard for Outdoor Activities',
      'Attached Single-Car Garage & Extended Driveway',
      'Central HVAC for Year-Round Climate Comfort',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Washer/Dryer Hookups'],
    description: `An attached garage, fully fenced backyard, and an open 3-bedroom, 2-bathroom layout define this single-family home on Novella Drive in South Fort Worth.

The home offers a welcoming front living area that seamlessly flows into the dining and kitchen zone. The kitchen is outfitted with ample storage cabinetry, spacious countertops, and full appliances for effortless meal preparation.

The primary bedroom features an en-suite full bathroom and generous closet space, accompanied by two additional bedrooms and a second full hall bathroom. The private backyard is completely fenced, providing a secure space for pets and family activities. Convenient to I-35W, local schools, and major retail corridors.

Key Property Features:
• 3 Bedrooms, 2 Full Bathrooms (1,055 sq. ft.)
• Open floor plan with bright living spaces
• Kitchen with full appliance package and ample cabinetry
• Primary bedroom suite with private bathroom
• Attached 1-car garage and off-street parking
• Fully fenced private backyard
• Convenient South Fort Worth location near I-35W
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,300 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-5E44D419',
    address: '3107 NW 30th St',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76106',
    county: 'Tarrant County',
    neighborhood: 'Northside / Historic Stockyards Area',
    lat: 32.7954,
    lng: -97.3681,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 905,
    monthly_rent: 1300, // Reduced from 1350 to 1300
    security_deposit: 1300,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Off-Street Driveway Parking',
    garage_spaces: 0,
    heating_type: 'Central Heating System',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Connections',
    flooring: ['Hardwood Flooring', 'Tile'],
    amenities: [
      'Charming 3-Bedroom Home in Historic Northside (905 Sq. Ft.)',
      'Refinished Hardwood Floors & Abundant Natural Light',
      'Bright Kitchen with Cooking Range & Refrigerator',
      'Updated Bathroom with Tile Surround',
      'Expansive Fenced Backyard with Mature Shade Trees',
      'Central Climate Control System',
      'Minutes to Historic Fort Worth Stockyards & Downtown',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `Hardwood flooring, central air, and an expansive fenced yard highlight this charming 3-bedroom home located in Fort Worth's historic Northside neighborhood.

The home welcomes you into a bright living room featuring original hardwood floors and classic architectural touches. The adjacent kitchen offers functional counter space, practical cabinet storage, and cooking appliances.

Three comfortable bedrooms share a well-appointed central full bathroom. The expansive backyard is completely fenced, offering exceptional space for outdoor recreation, gardening, and pets under mature shade trees. Located just minutes from the world-famous Fort Worth Stockyards, Marine Park, and Downtown Fort Worth.

Key Property Features:
• 3 Bedrooms, 1 Bathroom (905 sq. ft.)
• Classic hardwood floors in living areas and bedrooms
• Functional kitchen with full appliances
• Central air conditioning and heating
• Expansive fenced backyard with mature shade trees
• Dedicated off-street driveway parking
• Close to Historic Stockyards and Downtown Fort Worth
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,300 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  },
  {
    pipeline_id: 'PP-9D6B6F8F',
    address: '5004 Chapman St #5004',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76105',
    county: 'Tarrant County',
    neighborhood: 'Polytechnic Heights / East Fort Worth',
    lat: 32.7241,
    lng: -97.2745,
    property_type: 'TOWNHOUSE',
    bedrooms: 3,
    bathrooms: 2,
    half_bathrooms: null,
    total_bathrooms: 2,
    square_footage: 980,
    monthly_rent: 1300, // Reduced from 1450 to 1300
    security_deposit: 1300,
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
    laundry_type: 'Dedicated Laundry Connections',
    flooring: ['Brand New Vinyl Flooring', 'Tile'],
    amenities: [
      'Freshly Painted Interior with Brand New Flooring (980 Sq. Ft.)',
      'Open-Concept Living Area Connecting to Dining and Kitchen',
      'Spacious Primary Bedroom Suite with Walk-In Closet',
      'Two Well-Proportioned Secondary Bedrooms',
      'Good-Sized Fenced Backyard for Private Outdoor Living',
      'Attached 1-Car Garage with Direct Entry',
      'Quick Commute to Texas Wesleyan University & Downtown Fort Worth',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Range / Oven', 'Dishwasher', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `Fresh interior paint, brand new flooring throughout, an attached 1-car garage, and a private fenced yard highlight this move-in-ready 3-bedroom, 2-bathroom townhome on Chapman Street.

The unit features an inviting open-concept layout where the central living room connects effortlessly with the dining space and kitchen. The kitchen provides ample counter space, clean cabinetry, and standard appliances.

The primary bedroom suite offers a generous walk-in closet and private en-suite bathroom, while two additional bedrooms offer flexible space for family members or a home office. Outside, enjoy a private fenced backyard. Conveniently positioned near Texas Wesleyan University, Cobb Park, and Highway 287.

Key Property Features:
• 3 Bedrooms, 2 Full Bathrooms (980 sq. ft.)
• Freshly painted interior with brand new flooring
• Open living room and dining area
• Primary suite with walk-in closet and en-suite bath
• Private fenced backyard
• Attached 1-car garage and off-street parking
• Close to Texas Wesleyan University and Hwy 287
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,300 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-D583F794',
    address: '6729 Westcreek Dr #6729',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76133',
    county: 'Tarrant County',
    neighborhood: 'Southwest Fort Worth / Wedgewood Area',
    lat: 32.6612,
    lng: -97.3789,
    property_type: 'APARTMENT',
    bedrooms: 3,
    bathrooms: 2,
    half_bathrooms: null,
    total_bathrooms: 2,
    square_footage: 1250,
    monthly_rent: 1300, // Reduced from 1400 to 1300
    security_deposit: 1300,
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
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['New Wood-Look Vinyl Flooring', 'Tile'],
    amenities: [
      'Spacious 1,250 Sq. Ft. Multi-Bedroom Layout',
      'Freshly Painted Walls with New Flooring in Bedrooms & Bathrooms',
      'Bright Kitchen with Ample Prep Space & Cabinets',
      'Two Full Modern Bathrooms with Updated Fixtures',
      'Attached Garage for Secure Parking and Storage',
      'Easy Walkable Proximity to Local Schools & Neighborhood Parks',
      'Convenient to Hulen Mall Shopping, Chisholm Trail & I-20',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Washer/Dryer Hookups'],
    description: `Fresh interior paint, updated flooring in all bedrooms and bathrooms, an attached garage, and a generous 1,250 sq. ft. layout highlight this 3-bedroom, 2-bathroom home in Southwest Fort Worth.

The spacious living room offers clean transitions and excellent natural light. The kitchen features expansive countertop workspace, quality cabinets, and a full appliance setup.

All three bedrooms have been updated with new flooring and fresh paint, accompanied by two full bathrooms with modern fixtures. The property includes an attached garage and off-street parking. Located in the established Wedgewood area with easy access to neighborhood schools, Hulen Mall shopping, and the Chisholm Trail Parkway.

Key Property Features:
• 3 Bedrooms, 2 Full Bathrooms (1,250 sq. ft.)
• Freshly painted interior with new bedroom and bathroom flooring
• Spacious living and dining area
• Full kitchen with ample cabinetry and appliances
• Attached garage for vehicle parking and storage
• Close to neighborhood schools, Hulen retail, and Chisholm Trail
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,300 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  },
  {
    pipeline_id: 'PP-CB84B78F',
    address: '8164 Marydean Ave',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76116',
    county: 'Tarrant County',
    neighborhood: 'West Fort Worth / Western Hills',
    lat: 32.7289,
    lng: -97.4589,
    property_type: 'TOWNHOUSE',
    bedrooms: 3,
    bathrooms: 2,
    half_bathrooms: null,
    total_bathrooms: 2,
    square_footage: 1115,
    monthly_rent: 1300, // Reduced from 1475 to 1300
    security_deposit: 1300,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached 2-Car Garage & Driveway',
    garage_spaces: 2,
    heating_type: 'Brand New Central Heating',
    cooling_type: 'Brand New Central Air Conditioning',
    laundry_type: 'Dedicated In-Unit Washer/Dryer Connections',
    flooring: ['New Vinyl Plank Flooring', 'New Carpet in Bedrooms', 'Tile'],
    amenities: [
      'Substantial 3-Bedroom, 2-Bathroom Duplex with Attached 2-Car Garage',
      'Open-Concept Living & Dining with New Vinyl Plank Flooring',
      'Updated Kitchen with New Countertops & New Cooking Stove',
      'Brand New Central AC & Heating System',
      'Primary Bedroom with Walk-In Closet & Linen Storage',
      'Fenced Backyard with Private Patio',
      'Close to Lockheed Martin, NAS JRB Fort Worth & Downtown Corridors',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Brand New Range / Oven', 'Dishwasher', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `An attached 2-car garage, brand new central AC system, updated kitchen countertops, new stove, and a private fenced backyard with patio highlight this updated 3-bedroom, 2-bathroom duplex in West Fort Worth.

The open-concept living and dining areas showcase new luxury vinyl plank flooring and abundant natural lighting. The kitchen is upgraded with new countertops, a brand new cooking stove, and generous cabinet storage.

The primary bedroom features a spacious walk-in closet and a private bathroom with a linen closet, while the secondary bedrooms offer new plush carpet. Outside, relax in a private fenced backyard with a patio. Perfectly situated on the Westside near Lockheed Martin, NAS JRB Fort Worth, Camp Bowie Blvd, and I-30.

Key Property Features:
• 3 Bedrooms, 2 Full Bathrooms (1,115 sq. ft.)
• Attached 2-car garage and private concrete driveway
• Updated kitchen with new countertops and new cooking range
• Brand new central air conditioning and heating
• New vinyl plank flooring in living areas and new carpet in bedrooms
• Private fenced backyard with concrete patio
• Minutes to Lockheed Martin, NAS JRB, and Downtown Fort Worth
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,300 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  },
  {
    pipeline_id: 'PP-3745B6BC',
    address: '2905 Creston Ave',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76133',
    county: 'Tarrant County',
    neighborhood: 'South Fort Worth / McCart & Seminary',
    lat: 32.6845,
    lng: -97.3582,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 1252,
    monthly_rent: 1295, // <= 1300 kept at 1295
    security_deposit: 1295,
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
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Classic Hardwood Floors', 'Tile'],
    amenities: [
      'Quaint 1,252 Sq. Ft. Single-Family Home with Character',
      'Classic Hardwood Flooring Throughout Main Living Areas',
      'Attached 1-Car Garage with Off-Street Driveway',
      'Full Kitchen with Dining Space & Cabinet Storage',
      '3 Comfortable Bedrooms with Generous Windows',
      'Established Residential Neighborhood near McCart & Seminary',
      'Central Climate Control System',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `Classic hardwood flooring, vintage character, an attached 1-car garage, and 1,252 sq. ft. of comfortable living space define this 3-bedroom, 1-bathroom single-family home near McCart Avenue and Seminary Drive.

The interior showcases rich hardwood floors through the main living room and bedrooms, creating a warm, timeless atmosphere. The kitchen offers practical counter space, traditional cabinetry, and room for casual dining.

Three well-proportioned bedrooms share a full central bathroom. Complete with an attached single-car garage and off-street driveway parking. Situated in a mature, established South Fort Worth neighborhood with convenient access to Texas Christian University (TCU), local shopping, and I-35W.

Key Property Features:
• 3 Bedrooms, 1 Bathroom (1,252 sq. ft.)
• Rich classic hardwood floors throughout
• Attached 1-car garage and off-street driveway
• Full kitchen with ample cabinet storage
• Central heating and air conditioning
• Established South Fort Worth location near TCU & I-35W
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,295
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  },
  {
    pipeline_id: 'PP-BB49627F',
    address: '2917 Vanhorn Ave',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76111',
    county: 'Tarrant County',
    neighborhood: 'Northeast Fort Worth / Riverside Area',
    lat: 32.7812,
    lng: -97.2989,
    property_type: 'APARTMENT',
    bedrooms: 3,
    bathrooms: 2,
    half_bathrooms: null,
    total_bathrooms: 2,
    square_footage: 1061,
    monthly_rent: 1300, // Reduced from 1395 to 1300
    security_deposit: 1300,
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
    laundry_type: 'Dedicated Hallway Laundry Room',
    flooring: ['Tile', 'Laminate Wood Flooring'],
    amenities: [
      'Contemporary 3-Bedroom, 2-Bathroom Layout (1,061 Sq. Ft.)',
      'Tile and Laminate Flooring Throughout (No Carpet)',
      'Open-Concept Living and Dining Space',
      'Kitchen Includes Refrigerator & Cooking Range',
      'Dedicated Hallway Laundry Room with Connections',
      'Private Fenced Backyard for Outdoor Leisure',
      'Walking Distance to Local Elementary School & Parks',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `An open living and dining area, tile and laminate flooring throughout (no carpet), a private fenced backyard, and an included refrigerator highlight this 3-bedroom, 2-bathroom residence in Northeast Fort Worth.

The open living area transitions smoothly to the dining area and kitchen. The kitchen comes equipped with a full refrigerator, cooking range, and ample cabinet storage. A dedicated hallway laundry room provides convenient in-home hookups.

Three bedrooms feature easy-maintenance laminate flooring and are served by two full bathrooms. Outside, enjoy a private fenced backyard ideal for pets and outdoor relaxation. Situated within walking distance to the local elementary school and minutes from Highway 121, I-35W, and Downtown Fort Worth.

Key Property Features:
• 3 Bedrooms, 2 Full Bathrooms (1,061 sq. ft.)
• Tile and laminate flooring throughout (zero carpet)
• Kitchen equipped with refrigerator and range
• Dedicated hall laundry room
• Private fenced backyard
• Dedicated off-street parking
• Walking distance to local school; fast access to Hwy 121
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,300 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  },
  {
    pipeline_id: 'PP-FBD938CD',
    address: '4313 Alamo Ave',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76107',
    county: 'Tarrant County',
    neighborhood: 'Cultural District / Alamo Heights / West Fort Worth',
    lat: 32.7354,
    lng: -97.3982,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 1100,
    monthly_rent: 1300, // Reduced from 1500 to 1300
    security_deposit: 1300,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Driveway Parking',
    garage_spaces: 0,
    heating_type: 'Central Heating System',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Hardwood Flooring', 'Tile'],
    amenities: [
      'Remodeled 3-Bedroom Home in Prime 76107 Location (1,100 Sq. Ft.)',
      'Refinished Hardwood Floors & Updated Modern Interior',
      'Upgraded Kitchen with Full Appliance Package',
      'Central Air Conditioning and Heating System',
      'Spacious Fenced Backyard with Mature Shade Trees',
      'Off-Street Private Driveway',
      'Unbeatable Proximity to I-30, Hulen St, Camp Bowie & Cultural District',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Washer/Dryer Hookups'],
    description: `Remodeled interior finishes, central air and heat, beautiful hardwood floors, and a prime 76107 location near the Cultural District and Hulen Street highlight this 3-bedroom, 1-bathroom single-family home on Alamo Avenue.

The home offers a spacious living room with gleaming hardwood flooring and large windows. The updated kitchen features quality countertops, contemporary cabinetry, and modern cooking appliances.

Three comfortable bedrooms offer versatile arrangements and share a modernized central full bathroom. The expansive fenced backyard provides a serene private setting with mature shade trees. Located in high-demand West Fort Worth with immediate access to I-30, Hulen Street, the Museum District, and Downtown.

Key Property Features:
• 3 Bedrooms, 1 Bathroom (1,100 sq. ft.)
• Remodeled interior with refinished hardwood floors
• Modernized kitchen with full appliance suite
• Central heating and air conditioning
• Large fenced backyard with mature trees
• Private driveway parking
• Exceptional location near I-30, Hulen St, and Cultural District
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,300 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-D33FA118',
    address: '1520 Coleman Ave',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76105',
    county: 'Tarrant County',
    neighborhood: 'South East Fort Worth / Stop 6 Area',
    lat: 32.7212,
    lng: -97.2889,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1.5,
    half_bathrooms: 1,
    total_bathrooms: 2,
    square_footage: 1313,
    monthly_rent: 1300, // Reduced from 1495 to 1300
    security_deposit: 1300,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: false,
    has_basement: false,
    parking: 'Off-Street Driveway Parking',
    garage_spaces: 0,
    heating_type: 'Window/Wall Heating Units',
    cooling_type: 'Window/Wall AC Units',
    laundry_type: 'In-Unit Washer/Dryer Connections',
    flooring: ['New Bedroom Flooring', 'Vinyl / Tile', 'Hardwood-Style'],
    amenities: [
      'Spacious 1,313 Sq. Ft. Single-Family Home on Large Lot',
      'New Paint and New Flooring in Bedrooms',
      'Generous Living Area with Natural Lighting',
      'Kitchen Equipped with Electric Cooking Appliances',
      'Huge Fenced Yard with Lush Greenery and Trees',
      'Dedicated In-Unit Washer & Dryer Hookups',
      'Walkable to Stores, Dining & Public Transit Lines',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Electric Range / Oven', 'Refrigerator', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `A large 1,313 sq. ft. layout, fresh interior paint, new bedroom flooring, and a huge fenced yard with lush greenery highlight this 3-bedroom, 1.5-bathroom home on Coleman Avenue.

The home features an expansive living room with plenty of space for relaxing and entertaining. The kitchen is outfitted with electric cooking appliances, solid cabinetry, and generous counter space.

Three bedrooms feature brand-new flooring and fresh paint, supported by a full bathroom and an additional half bath. Outside, the large fenced yard provides expansive private green space. Located within easy walking distance of local convenience stores, neighborhood dining, and public transit bus routes.

Key Property Features:
• 3 Bedrooms, 1.5 Bathrooms (1,313 sq. ft.)
• New paint and new flooring in bedrooms
• Large spacious living room
• Kitchen with electric appliance package
• Huge private fenced yard with mature greenery
• In-unit washer/dryer connections
• Convenient to bus lines, shops, and Highway 287
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,300 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  },
  {
    pipeline_id: 'PP-CA3A92A2',
    address: '6501 Shady Oaks Manor Dr APT 712',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76135',
    county: 'Tarrant County',
    neighborhood: 'Lake Worth / Northwest Fort Worth',
    lat: 32.8124,
    lng: -97.4389,
    property_type: 'APARTMENT',
    bedrooms: 3,
    bathrooms: 2,
    half_bathrooms: null,
    total_bathrooms: 2,
    square_footage: 1296,
    monthly_rent: 1300, // Reduced from 1400 to 1300
    security_deposit: 1300,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Detached Garage & Dedicated Parking Lot',
    garage_spaces: 1,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Connections',
    flooring: ['Hardwood-Style Plank Flooring', 'Plush Carpet', 'Tile'],
    amenities: [
      'Substantial 1,296 Sq. Ft. 3-Bedroom, 2-Bathroom Lakeview Apartment',
      'Open-Concept Living & Dining with Large Windows',
      'Fully Equipped Modern Kitchen with Full Appliances',
      'Primary Bedroom Suite with Private Bathroom & Walk-In Closet',
      'Detached Garage and Assigned Parking Options',
      'Central Climate Control System',
      'Minutes from Lake Worth Center Shopping, Dining & Recreation',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Washer/Dryer Hookups'],
    description: `A spacious 1,296 sq. ft. 3-bedroom, 2-bathroom layout, detached garage options, and close proximity to Lake Worth Center highlight this apartment home at Lakeview in Northwest Fort Worth.

The home features an expansive living area that opens into the dining space and kitchen. The kitchen provides generous cabinetry, ample counter space, and full appliances for home cooking.

Three comfortable bedrooms include a primary suite with a walk-in closet and private full bathroom, while a second full bathroom serves the other bedrooms. Central heating and air conditioning ensure comfort year-round. Located near Lake Worth Center with easy access to shopping, dining, parks, and Loop 820.

Key Property Features:
• 3 Bedrooms, 2 Full Bathrooms (1,296 sq. ft.)
• Open living and dining layout with abundant natural light
• Modern kitchen with full appliance suite
• Primary bedroom suite with walk-in closet and en-suite bath
• Detached garage and assigned parking available
• Central air conditioning and heating
• Minutes from Lake Worth shopping, parks, and Loop 820
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,300 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  },
  {
    pipeline_id: 'PP-6151D093',
    address: '4301 Weber St #117',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76106',
    county: 'Tarrant County',
    neighborhood: 'Northside / Meacham Airport Corridor',
    lat: 32.8089,
    lng: -97.3512,
    property_type: 'APARTMENT',
    bedrooms: 3,
    bathrooms: 2,
    half_bathrooms: null,
    total_bathrooms: 2,
    square_footage: 1120,
    monthly_rent: 1300, // Reduced from 1375 to 1300
    security_deposit: 1300,
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
    laundry_type: 'In-Unit Washer/Dryer Connections',
    flooring: ['Hardwood-Style Plank Flooring', 'Tile'],
    amenities: [
      'Spacious 1,120 Sq. Ft. 3-Bedroom, 2-Bathroom Apartment Home',
      'Open Living and Dining Layout with Clean Plank Flooring',
      'Equipped Kitchen with Full Cooking Appliances & Cabinetry',
      'Two Full Bathrooms Providing Optimal Convenience',
      'Central Heating and Air Conditioning',
      'Dedicated Off-Street Parking',
      'Fast Access to Northside, Historic Stockyards & Downtown Fort Worth',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `A 1,120 sq. ft. 3-bedroom, 2-bathroom layout, durable plank flooring, and central air highlight this apartment home on Weber Street in North Fort Worth.

The home offers a welcoming living room that connects seamlessly to the dining space and kitchen. The kitchen is outfitted with full appliances, ample countertop prep room, and functional cabinet storage.

Three well-proportioned bedrooms are served by two full bathrooms, offering excellent privacy and flexibility. Complete with central heating, air conditioning, and dedicated off-street parking. Situated in Northside with fast access to Meacham Airport, the Stockyards, and Downtown Fort Worth.

Key Property Features:
• 3 Bedrooms, 2 Full Bathrooms (1,120 sq. ft.)
• Open floor plan with clean plank flooring
• Equipped kitchen with full appliances and cabinetry
• Two full bathrooms for resident convenience
• Central air conditioning and heating
• Dedicated off-street parking
• Convenient Northside location near Stockyards and transit
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,300 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  }
];

async function publishFortWorthBatch() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('  Choice Properties — Fort Worth Zillow Publishing ($1,300 Target)');
  console.log(`  Processing ${FORT_WORTH_1300_PROPERTIES.length} Fully Enriched Properties`);
  console.log('  Pricing Rule: Over $1,300 reduced to $1,300; <= $1,300 kept as-is');
  console.log('═════════════════════════════════════════════════════════════════\n');

  const rawPipelineData = JSON.parse(fs.readFileSync('scripts/fort_worth_remaining.json', 'utf8'));
  const rawMap = new Map(rawPipelineData.map(p => [p.id, p]));

  const publishedResults = [];
  const today = new Date().toISOString().split('T')[0];

  for (let i = 0; i < FORT_WORTH_1300_PROPERTIES.length; i++) {
    const item = FORT_WORTH_1300_PROPERTIES[i];
    const pipeId = item.pipeline_id;
    const rawProp = rawMap.get(pipeId);

    console.log(`[${i + 1}/${FORT_WORTH_1300_PROPERTIES.length}] Processing ${item.address} (${item.bedrooms}BR/${item.bathrooms}BA) - $${item.monthly_rent}/mo...`);

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

  fs.writeFileSync('scripts/published_fort_worth_1300_results.json', JSON.stringify(publishedResults, null, 2));

  console.log('\n═════════════════════════════════════════════════════════════════');
  console.log(`  Published ${publishedResults.length} Fort Worth properties successfully!`);
  console.log('═════════════════════════════════════════════════════════════════\n');

  publishedResults.forEach(r => {
    console.log(`${r.n}. ${r.address}, ${r.city}, ${r.state} ${r.zip} ($${r.rent.toLocaleString()}/mo | ${r.beds} Bed / ${r.baths} Bath) — ${r.url}`);
  });
}

publishFortWorthBatch().catch(console.error);
