/**
 * scripts/publish_memphis_batch_10.mjs
 * Manual Deep Verification, Enrichment, and Publishing Script
 * Memphis, TN 38125 Batch (10 Properties)
 */

import crypto from 'crypto';
import { CREDENTIALS_CONFIG } from '../credentials-config.mjs';

const SUPABASE_URL = CREDENTIALS_CONFIG.SUPABASE_URL;
const KEY = CREDENTIALS_CONFIG.SUPABASE_API_KEY;

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

const PROPERTIES = [
  {
    pipeline_id: 'PP-55B1BD3B',
    title: '3824 Isleworth Dr, Memphis, TN 38125',
    address: '3824 Isleworth Dr',
    city: 'Memphis',
    state: 'TN',
    zip: '38125',
    county: 'Shelby County',
    lat: 35.0315,
    lng: -89.8242,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1462,
    year_built: 1978,
    monthly_rent: 1640,
    security_deposit: 1640,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Driveway Parking',
    garage_spaces: null,
    heating_type: 'Central Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated Laundry Room with Hookups',
    flooring: ['Hardwood-Style Plank', 'Ceramic Tile'],
    amenities: [
      'Living Room Brick Fireplace',
      'Wood-Style Plank Flooring',
      'Primary Suite with Walk-In Closet',
      'Private En-Suite Bathroom',
      'Fully Fenced Backyard',
      'Concrete Patio',
      'Pet Friendly'
    ],
    appliances: ['Refrigerator', 'Electric Range / Oven', 'Dishwasher', 'Microwave'],
    description: `Standalone single-family residence offering 1,462 square feet of well-appointed living space in the established Hickory Ridge neighborhood of Memphis. The exterior presents traditional brick and siding elevation framed by a shaded front yard and a concrete driveway.

Inside, the floor plan opens into an expansive living room anchored by a brick hearth fireplace, elevated ceilings, and handsome wood-style plank flooring that flows seamlessly across primary entertaining areas. Natural light streams through multi-pane windows, creating a bright and inviting interior ambiance.

The kitchen is designed for convenient daily living and culinary prep, featuring ample solid-surface cabinetry, clean countertops, a dedicated pantry, and a full suite of appliances including a refrigerator, range/oven, dishwasher, and microwave. An adjoining eat-in dining area offers direct access to the back patio.

The home includes three generously proportioned bedrooms, headlined by a comfortable primary suite complete with a deep walk-in closet and a private en-suite bathroom. The two secondary bedrooms share a central full hallway bath equipped with a combination tub-and-shower and modern vanity.

Practical conveniences include a separate interior laundry area with washer/dryer connections, central heating and air conditioning, and a fully fenced backyard ideal for outdoor recreation and privacy.

Choice Properties welcomes companion animals in this pet-friendly home. Application Fee: $50. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-5DBFE9D4',
    title: '4891 Top Notch Loop, Memphis, TN 38125',
    address: '4891 Top Notch Loop',
    city: 'Memphis',
    state: 'TN',
    zip: '38125',
    county: 'Shelby County',
    lat: 35.0357,
    lng: -89.8184,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 4,
    bathrooms: 2.5,
    half_bathrooms: 1,
    total_bathrooms: 2.5,
    square_footage: 1967,
    year_built: 2001,
    monthly_rent: 1765,
    security_deposit: 1765,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached 2-Car Garage & Driveway',
    garage_spaces: 2,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Interior Laundry Room with Hookups',
    flooring: ['Luxury Vinyl Plank', 'Ceramic Tile', 'Neutral Carpet'],
    amenities: [
      'Attached Two-Car Garage',
      'Main-Level Guest Powder Room',
      'Cozy Corner Fireplace',
      'Primary Suite with Soaking Tub & Separate Shower',
      'Private Fenced Backyard',
      'Walk-In Closets',
      'Pet Friendly'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Built-In Microwave'],
    description: `Situated in the Shelby Woodlands community of Southeast Memphis, this two-story single-family home encompasses 1,967 square feet with four spacious bedrooms and two-and-a-half bathrooms. The facade showcases neat architectural gables, brick wainscoting, and an integrated two-car garage.

The ground-level living space emphasizes comfort and openness, featuring durable luxury vinyl plank flooring, tall ceilings, and a corner fireplace serving as an attractive focal point. Expansive windows overlook the rear grounds, while a flexible open dining nook connects effortlessly with the main living area.

The kitchen is outfitted with abundant cabinetry, wrap-around preparation countertops, a pantry closet, and quality appliances comprising a refrigerator, range/oven, dishwasher, and built-in microwave. A convenient main-floor powder room provides easy accessibility for family and guests.

Upstairs, the primary bedroom suite delivers a peaceful personal retreat with tray ceiling detailing, a roomy walk-in wardrobe, and an en-suite bath with a garden tub, separate shower, and double vanity. Three additional bedrooms feature substantial closet storage and access to a second full upstairs bathroom with ceramic tile finishes.

Exterior amenities include an attached two-car garage with remote access and an expansive grassy backyard surrounded by privacy fencing. Complete with central heating, central air conditioning, and dedicated laundry connections.

Pet-friendly accommodation with flexible guidelines. Application Fee: $50. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-49EDA73E',
    title: '7897 Rushmeade Cir S, Memphis, TN 38125',
    address: '7897 Rushmeade Cir S',
    city: 'Memphis',
    state: 'TN',
    zip: '38125',
    county: 'Shelby County',
    lat: 35.0448,
    lng: -89.8291,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2.5,
    half_bathrooms: 1,
    total_bathrooms: 2.5,
    square_footage: 1700,
    year_built: 2007,
    monthly_rent: 1595,
    security_deposit: 1595,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached Garage & Driveway',
    garage_spaces: 1,
    heating_type: 'Central Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated Laundry Connections',
    flooring: ['Contemporary Vinyl Plank', 'Ceramic Tile', 'Soft Carpet'],
    amenities: [
      'Gated Community Setting',
      'Corner Lot Positioning',
      'Main-Level Primary Suite',
      'Gas Log Fireplace',
      'Brand New Architectural Roof',
      'Attached Garage',
      'Pet Friendly'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave'],
    description: `Occupying a prominent corner lot within a private gated enclave in Southwind, this 1,700-square-foot standalone home features three bedrooms and two-and-a-half bathrooms. The exterior has been upgraded with fresh architectural siding, a newer roof, and manicured perimeter landscaping.

The main level centers around an open-concept great room complete with tall ceilings, sleek contemporary vinyl flooring, and a handsome fireplace. The natural layout provides clean circulation between entertaining zones and casual living areas.

The kitchen features extensive counter surface, generous cabinetry storage, and an itemized appliance package that includes a refrigerator, range/oven, dishwasher, and microwave. Adjacent to the kitchen is a half-bathroom powder room catering to the main living floor.

Positioned on the ground level for maximum privacy, the primary suite features large windows, generous closet space, and a dedicated full private bath. The upper level houses two secondary bedrooms with bright exposures, along with a full second bathroom featuring a tub/shower combination.

Additional features include an attached garage, central air conditioning, central heating, and washer/dryer connections. Residents will enjoy the peace of a gated setting with rapid access to local dining and retail corridors.

Pet-friendly living with welcoming terms. Application Fee: $50. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-7B00E646',
    title: '7341 Isherwood Rd, Memphis, TN 38125',
    address: '7341 Isherwood Rd',
    city: 'Memphis',
    state: 'TN',
    zip: '38125',
    county: 'Shelby County',
    lat: 35.0345,
    lng: -89.8398,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1584,
    year_built: 1978,
    monthly_rent: 1549,
    security_deposit: 1549,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Driveway Parking',
    garage_spaces: null,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated Laundry Room',
    flooring: ['Solid Hardwood Flooring', 'Ceramic Tile'],
    amenities: [
      'Brick Veneer Construction',
      'Wood Privacy Fenced Yard',
      'Level 0.2-Acre Parcel',
      'Solid Hardwood Flooring Throughout',
      'Pull-Down Attic Storage',
      'Updated Bath Vanities',
      'Pet Friendly'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave'],
    description: `Traditional Tennessee brick veneer single-family home providing 1,584 square feet of comfortable living space in the heart of Memphis 38125. Set on a level 0.2-acre parcel, the property features solid brick exterior walls and mature neighborhood surroundings.

The interior opens to genuine hardwood flooring and ceramic tile throughout, avoiding carpet entirely for easy maintenance and a crisp aesthetic. The central living room offers ample proportions for sectional seating and media layouts, flooded with daylight through well-placed windows.

The eat-in kitchen combines practical storage with generous prep surfaces, featuring solid wood cabinetry, updated laminate counters, and modern appliances including a refrigerator, range/oven, dishwasher, and microwave.

Three expansive bedrooms provide quiet retreats with deep closets, hardwood flooring, and pull-down attic stairs for additional seasonal storage. Two full bathrooms are thoughtfully outfitted with ceramic tile surrounds, modern vanities, and clean chrome hardware.

Outside, the level backyard is encircled by wooden privacy fencing, providing an ideal setting for outdoor seating, gardening, or recreation. The home includes a dedicated laundry room with washer/dryer connections and central HVAC.

Pet-friendly policies apply throughout. Application Fee: $50. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-DAD65194',
    title: '7360 Doncaster Ln, Memphis, TN 38125',
    address: '7360 Doncaster Ln',
    city: 'Memphis',
    state: 'TN',
    zip: '38125',
    county: 'Shelby County',
    lat: 35.0382,
    lng: -89.8415,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1188,
    year_built: 1978,
    monthly_rent: 1500,
    security_deposit: 1500,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached Garage & Driveway',
    garage_spaces: 1,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Interior Laundry Area with Hookups',
    flooring: ['Wood-Style Plank Flooring', 'Ceramic Tile'],
    amenities: [
      'Fully Renovated Interior',
      'Attached Garage',
      'Wood-Style Plank Flooring',
      'Updated Kitchen & Baths',
      'Private Backyard',
      'Single-Story Ranch Layout',
      'Pet Friendly'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher'],
    description: `Nicely renovated single-story ranch home featuring 1,188 square feet with three bedrooms and two full bathrooms in Memphis. The residence sits on a tranquil residential street with a mature lawn and private driveway leading to an attached garage.

The interior has undergone a comprehensive renovation with updated wood-style plank flooring, neutral paint palette, and upgraded electrical and lighting fixtures. The living room provides a relaxing environment with wide picture windows and versatile furniture space.

The kitchen boasts refreshed white cabinetry, contrasting durable countertops, and an essential appliance package including a refrigerator, range/oven, and dishwasher. An adjoining dining area creates an inviting breakfast nook for daily dining.

All three bedrooms offer comfortable accommodations with ample closet space and updated lighting. Both full bathrooms have been refreshed with updated vanities, modern mirrors, and clean tub/shower enclosures.

Outdoor space includes a private backyard suitable for leisure, while an attached garage provides sheltered vehicle parking and workshop space. Equipped with central heating, central air conditioning, and laundry hookups.

Pet-friendly living welcomed. Application Fee: $50. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-36A3003A',
    title: '7576 Baysweet Dr, Memphis, TN 38125',
    address: '7576 Baysweet Dr',
    city: 'Memphis',
    state: 'TN',
    zip: '38125',
    county: 'Shelby County',
    lat: 35.0396,
    lng: -89.8354,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1227,
    year_built: 1998,
    monthly_rent: 1540,
    security_deposit: 1540,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached Garage & Driveway',
    garage_spaces: 1,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Interior Laundry Room with Hookups',
    flooring: ['Ceramic Tile', 'Luxury Vinyl Plank'],
    amenities: [
      'Attached Garage',
      'Living Room Fireplace',
      'Stainless Steel Appliances',
      'Walk-In Kitchen Pantry',
      'Rear Outdoor Patio',
      'Lowrance / Southwind School Area',
      'Pet Friendly'
    ],
    appliances: ['Stainless Steel Refrigerator', 'Electric Range / Oven', 'Dishwasher', 'Microwave'],
    description: `Attractively finished 1,227-square-foot single-family home featuring three bedrooms and two full bathrooms in Memphis. The property greets visitors with neat brick-and-siding exterior detailing, an attached garage, and a welcoming front entrance.

Inside, modern flooring choices of ceramic tile and resilient vinyl extend throughout the interior. The primary living room features a corner fireplace, high ceilings, and an easy connection to the rear outdoor patio.

The kitchen is equipped with stainless steel appliances including a refrigerator, range/oven, dishwasher, and microwave, complemented by a walk-in pantry, ample cabinetry, and an adjoining eat-in dining nook.

Three private bedrooms offer quiet comfort, with the primary bedroom featuring an en-suite full bathroom and closet storage. The second full bathroom serves the remaining bedrooms and features updated fixtures with modern styling.

A concrete rear patio opens onto the backyard, creating an inviting space for morning coffee or outdoor dining. Additional highlights include an attached single-car garage, central air conditioning, central heating, and an interior laundry room.

Pet-friendly property with comprehensive amenities. Application Fee: $50. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-D9C9E9BA',
    title: '4841 Quarry Rd, Memphis, TN 38125',
    address: '4841 Quarry Rd',
    city: 'Memphis',
    state: 'TN',
    zip: '38125',
    county: 'Shelby County',
    lat: 35.0348,
    lng: -89.8219,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2.5,
    half_bathrooms: 1,
    total_bathrooms: 2.5,
    square_footage: 1986,
    year_built: 2001,
    monthly_rent: 1800, // Reduced from $1830 per explicit batch price ceiling ($1800)
    security_deposit: 1800,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached 2-Car Garage & Driveway',
    garage_spaces: 2,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated Laundry Room with Hookups',
    flooring: ['Wood-Look Laminate Plank', 'Ceramic Tile', 'Plush Carpet'],
    amenities: [
      'Two-Story Floor Plan',
      'Attached Two-Car Garage',
      'Main-Level Guest Powder Room',
      'Primary Suite with Garden Soaking Tub',
      'Separate Standing Shower',
      'Private Fenced Yard',
      'Pet Friendly'
    ],
    appliances: ['Refrigerator', 'Electric Range / Oven', 'Dishwasher', 'Microwave'],
    description: `Substantial two-story standalone home offering 1,986 square feet of functional living space in the established Quarry Road corridor of Southeast Memphis. The house presents striking curb appeal with multi-tier rooflines, brick wainscoting, and a two-car front-loading garage.

The ground level opens into a vaulted entry leading to an open living and dining area finished with durable wood-look flooring. Expansive wall dimensions and natural lighting provide plenty of room for both formal and informal arrangements.

The kitchen features solid cabinetry, extended prep counters, a pantry, and an integrated appliance suite including a refrigerator, range/oven, dishwasher, and microwave. A main-floor half bath powder room provides convenient guest access.

Upstairs, the primary bedroom suite offers a serene retreat with a walk-in closet and a private five-piece bath featuring a garden soaking tub, separate standing shower, and double vanity. Two additional well-sized bedrooms share a full second bathroom with ceramic tile details.

The property includes an attached two-car garage, a separate laundry room with washer/dryer hookups, central heating, central air conditioning, and a spacious backyard for open-air enjoyment.

Pet-friendly property welcoming dogs and cats. Application Fee: $50. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-E0C319B3',
    title: '7627 Glenlaurel Way, Memphis, TN 38125',
    address: '7627 Glenlaurel Way',
    city: 'Memphis',
    state: 'TN',
    zip: '38125',
    county: 'Shelby County',
    lat: 35.0418,
    lng: -89.8336,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1672,
    year_built: 2006,
    monthly_rent: 1800, // Reduced from $1875 per explicit batch price ceiling ($1800)
    security_deposit: 1800,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached 2-Car Garage & Driveway',
    garage_spaces: 2,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated Laundry Room with Hookups',
    flooring: ['Hardwood-Style Plank Flooring', 'Ceramic Tile'],
    amenities: [
      'Vaulted Living Room Ceilings',
      'Granite Kitchen Countertops',
      'Ornate Mantel Fireplace',
      'Attached Two-Car Garage',
      'Primary Suite Double-Sink Vanity',
      'Soaking Tub & Separate Shower',
      'Fully Fenced Backyard',
      'Pet Friendly'
    ],
    appliances: ['Stainless Steel Refrigerator', 'Electric Range / Oven', 'Dishwasher', 'Microwave'],
    description: `Built in 2006, this 1,672-square-foot single-family home offers three bedrooms and two full bathrooms in the desirable Glenlaurel subdivision of Memphis. The exterior combines traditional brick veneer with neat architectural vinyl siding and an attached two-car garage.

The heart of the home is a dramatic living room highlighted by vaulted ceilings, an ornate mantel fireplace, and gleaming hardwood-style flooring. Large picture windows overlook the backyard while welcoming abundant sunshine.

The kitchen is upgraded with granite countertops, rich cabinetry, a pantry, and stainless steel appliances including a refrigerator, range/oven, dishwasher, and microwave. A bright breakfast nook sits adjacent to the kitchen overlooking the grounds.

The primary bedroom suite offers vaulted architectural ceilings, a walk-in wardrobe, and a luxury-appointed en-suite bathroom featuring a double-sink vanity, soaking tub, and separate glass-enclosed shower. Two auxiliary bedrooms offer ceiling fans and generous closet space, served by a second full bathroom with ceramic tile work.

Outside, the fenced backyard provides a secluded outdoor setting, complemented by an attached two-car garage, central air conditioning, central heating, and a dedicated laundry room.

Pet-friendly accommodations with generous guidelines. Application Fee: $50. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-B2C7AC7D',
    title: '7941 Carmen Cv, Memphis, TN 38125',
    address: '7941 Carmen Cv',
    city: 'Memphis',
    state: 'TN',
    zip: '38125',
    county: 'Shelby County',
    lat: 35.0452,
    lng: -89.8279,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 4,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1699,
    year_built: 2004,
    monthly_rent: 1800, // Reduced from $1820 per explicit batch price ceiling ($1800)
    security_deposit: 1800,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached 2-Car Garage & Driveway',
    garage_spaces: 2,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Interior Laundry Room with Hookups',
    flooring: ['Wood-Style Plank Flooring', 'Ceramic Tile'],
    amenities: [
      'Quiet Cul-de-Sac Location',
      'Four Generous Bedrooms',
      'Living Room Hearth Fireplace',
      'Attached Two-Car Garage',
      'Fully Fenced Backyard',
      'Stainless Steel Appliances',
      'Pet Friendly'
    ],
    appliances: ['Stainless Steel Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave'],
    description: `Situated in a peaceful residential cul-de-sac, this four-bedroom, two-bathroom single-family residence encompasses 1,699 square feet in Southeast Memphis. The quiet cul-de-sac setting minimizes street traffic while providing a spacious concrete driveway and attached two-car garage.

The open floor plan features durable wood-look flooring that spans the primary entertaining spaces. The central living room is anchored by a fireplace and flows effortlessly into the adjoining dining and kitchen zones.

The kitchen is appointed with extensive counter space, solid cabinetry, a pantry, and stainless steel appliances including a refrigerator, range/oven, dishwasher, and microwave.

Four bedrooms provide versatile options for growing households, guest rooms, or home office needs. The primary suite features a generous bedroom footprint, walk-in closet, and an en-suite bath with updated fixtures. A secondary full bathroom conveniently serves the remaining three bedrooms.

The rear yard is fully enclosed by privacy fencing, providing a secluded haven for outdoor relaxation. Complete with an attached two-car garage, central heat, central air, and an interior laundry room.

Pet-friendly policies apply. Application Fee: $50. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-9043013A',
    title: '7743 Meadow Vale Dr, Memphis, TN 38125',
    address: '7743 Meadow Vale Dr',
    city: 'Memphis',
    state: 'TN',
    zip: '38125',
    county: 'Shelby County',
    lat: 35.0425,
    lng: -89.8315,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1264,
    year_built: 1995,
    monthly_rent: 1800, // Reduced from $1900 per explicit batch price ceiling ($1800)
    security_deposit: 1800,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached Garage & Driveway',
    garage_spaces: 1,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Interior Laundry Room with Hookups',
    flooring: ['Luxury Vinyl Plank', 'Ceramic Tile'],
    amenities: [
      'Recently Renovated Throughout',
      'Attached Garage',
      'Sliding Glass Patio Access',
      'Fully Fenced Backyard',
      'Highway 385 Corridor Access',
      'Close to Germantown & Collierville',
      'Pet Friendly'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave'],
    description: `Recently updated 1,264-square-foot single-family home providing three bedrooms and two full bathrooms in Memphis. Located on an 8,712-square-foot lot with quick connectivity to Highway 385, the home is minutes from premier Germantown and Collierville shopping and dining corridors.

The interior has been refreshed with modern luxury vinyl plank flooring and clean neutral paint. The living room offers high ceilings, broad windows, and an open layout that connects seamlessly with the kitchen and dining area.

The renovated kitchen is equipped with updated cabinetry, contemporary laminate countertops, a pantry, and appliances including a refrigerator, range/oven, dishwasher, and microwave.

The private sleeping quarters comprise three bedrooms with good natural lighting and ample closet storage. Both full bathrooms have been renovated with contemporary vanities, mirrors, and clean tiled tub/shower enclosures.

A sliding glass door leads to a fully fenced rear lawn with mature shade trees, offering exceptional outdoor privacy. Additional conveniences include an attached garage, central air conditioning, central heating, and indoor laundry connections.

Pet-friendly living with flexible pet guidelines. Application Fee: $50. Submit your rental application today at Choice Properties.`
  }
];

async function main() {
  console.log('Starting Manual Verification, Enrichment, and Publishing Workflow for Memphis Batch...');
  const today = new Date().toISOString().split('T')[0];
  const publishedResults = [];

  for (let i = 0; i < PROPERTIES.length; i++) {
    const item = PROPERTIES[i];
    console.log(`\n[${i + 1}/${PROPERTIES.length}] Processing ${item.address}, ${item.city}, ${item.state}...`);

    // 1. Fetch original pipeline property to extract verified photos and details
    const pipeRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${item.pipeline_id}&select=*`, {
      headers: HEADERS_PIPELINE
    });
    if (!pipeRes.ok) {
      console.error(`Failed to fetch pipeline item ${item.pipeline_id}: ${pipeRes.status}`);
      continue;
    }
    const pipeRows = await pipeRes.json();
    if (!pipeRows || !pipeRows.length) {
      console.error(`Pipeline item ${item.pipeline_id} not found.`);
      continue;
    }
    const pipeRecord = pipeRows[0];

    // Extract photo URLs from original_image_urls
    let photoUrls = [];
    try {
      const rawImgs = typeof pipeRecord.original_image_urls === 'string'
        ? JSON.parse(pipeRecord.original_image_urls)
        : pipeRecord.original_image_urls;
      photoUrls = (rawImgs || []).map(x => typeof x === 'string' ? x : (x.url || x.src));
    } catch (e) {
      console.error(`Error parsing photos for ${item.address}:`, e);
    }
    // Deduplicate
    photoUrls = Array.from(new Set(photoUrls.filter(Boolean)));
    console.log(`   ✓ Ingested ${photoUrls.length} high-resolution source CDN photo URLs`);

    // 2. Build property record for public.properties
    const propId = crypto.randomUUID();
    const propRecord = {
      id: propId,
      landlord_id: null,
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
      year_built: item.year_built,
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
      featured: false,
      original_description: pipeRecord.original_description || pipeRecord.description
    };

    // 3. Insert into public.properties
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/properties`, {
      method: 'POST',
      headers: { ...HEADERS, Prefer: 'return=representation' },
      body: JSON.stringify(propRecord)
    });
    if (!insertRes.ok) {
      const err = await insertRes.text();
      console.error(`   ✗ Failed to insert into public.properties: ${insertRes.status} ${err}`);
      continue;
    }
    console.log(`   ✓ Inserted into public.properties (ID: ${propId})`);

    // 4. Synchronize photos in public.property_photos
    if (photoUrls.length > 0) {
      const photoRows = photoUrls.map((url, idx) => ({
        property_id: propId,
        url: url,
        display_order: idx + 1,
        is_hero: idx === 0,
        watermark_status: 'clean',
        alt_text: `${item.address}, ${item.city} TN - Photo ${idx + 1}`
      }));

      const insertPhotosRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos`, {
        method: 'POST',
        headers: { ...HEADERS, Prefer: 'return=minimal' },
        body: JSON.stringify(photoRows)
      });
      if (!insertPhotosRes.ok) {
        const err = await insertPhotosRes.text();
        console.error(`   ✗ Failed to insert property_photos: ${insertPhotosRes.status} ${err}`);
      } else {
        console.log(`   ✓ Inserted ${photoRows.length} source CDN photos into public.property_photos`);
      }
    }

    // 5. Update pipeline_properties status to 'published'
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
        bathrooms: item.bathrooms,
        half_bathrooms: item.half_bathrooms,
        total_bathrooms: item.total_bathrooms,
        amenities: JSON.stringify(item.amenities),
        appliances: JSON.stringify(item.appliances),
        flooring: JSON.stringify(item.flooring),
        heating_type: item.heating_type,
        cooling_type: item.cooling_type,
        laundry_type: item.laundry_type,
        parking: item.parking,
        garage_spaces: item.garage_spaces,
        pets_allowed: true,
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
      console.error(`   ✗ Failed to patch pipeline status: ${patchPipeRes.status}`);
    } else {
      console.log(`   ✓ Updated pipeline status to 'published' for ${item.pipeline_id}`);
    }

    publishedResults.push({
      num: publishedResults.length + 1,
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

  console.log('\n=== PUBLISHING COMPLETED ===');
  console.log(`Successfully published ${publishedResults.length} properties:\n`);
  publishedResults.forEach(r => {
    console.log(`${r.num}. ${r.address}, ${r.city}, ${r.state} ${r.zip} ($${r.rent}/mo | ${r.bedrooms} Bed / ${r.bathrooms} Bath) — ${r.url}\n`);
  });

  const fs = await import('fs');
  fs.writeFileSync('memphis_published_results.json', JSON.stringify(publishedResults, null, 2));
}

main().catch(err => {
  console.error('Fatal error in publishing script:', err);
  process.exit(1);
});
