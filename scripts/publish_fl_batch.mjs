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

const FL_PROPERTIES = [
  {
    pipeline_id: 'PP-EA65A6E9',
    address: '1810 Caralee Blvd',
    city: 'Orlando',
    state: 'FL',
    zip: '32822',
    county: 'Orange County',
    neighborhood: 'Ventura / East Orlando',
    lat: 28.5304,
    lng: -81.2965,
    property_type: 'CONDO',
    bedrooms: 2,
    bathrooms: 2,
    half_bathrooms: null,
    total_bathrooms: 2,
    square_footage: 1029,
    monthly_rent: 1590,
    security_deposit: 1590,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Dedicated Resident & Guest Parking',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer and Dryer Included',
    flooring: ['Tile Flooring', 'Carpet'],
    amenities: [
      'Comfortable 2-Bedroom, 2-Bathroom Residence (1,029 Sq. Ft.)',
      'Bright Open-Concept Living and Dining Layout',
      'Equipped Kitchen with Dishwasher, Range, Disposal & Refrigerator',
      'In-Unit Washer and Dryer Included',
      'Water Utility Included in Monthly Rent',
      'Central Air Conditioning & Climate Control',
      'Rapid Access to SR-408, SR-436, and Orlando International Airport',
      'Pet-Friendly Living'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Garbage Disposal', 'Washer', 'Dryer'],
    description: `An expansive 1,029 sq. ft. open floor plan, included in-unit laundry, water service included, and quick connectivity to East Orlando thoroughfares highlight this 2-bedroom residence on Caralee Boulevard.

The home features an open living and dining room flooded with natural light, offering generous space for everyday living and hosting guests. The kitchen is outfitted with full cabinetry, a dishwasher, garbage disposal, electric range, and refrigerator.

Both bedrooms are well-proportioned with dedicated closet storage and easy access to full bathrooms. An in-unit washer and dryer provides daily laundry convenience. Situated in East Orlando with rapid access to SR-408, Semoran Boulevard (SR-436), Downtown Orlando, and Orlando International Airport.

Key Property Features:
• 2 Bedrooms, 2 Bathrooms (1,029 sq. ft.)
• Open living and dining room layout
• Full kitchen appliances including dishwasher and disposal
• In-unit washer and dryer included
• Water utility service included in rent
• Central air conditioning and heating
• Quick access to SR-408, SR-436, and MCO Airport
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,590
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt processing.`
  },
  {
    pipeline_id: 'PP-A0A38A21',
    address: '218 N Lakeland Ave',
    city: 'Orlando',
    state: 'FL',
    zip: '32805',
    county: 'Orange County',
    neighborhood: 'Rock Lake / West Downtown Orlando',
    lat: 28.5463,
    lng: -81.4012,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 813,
    monthly_rent: 1495,
    security_deposit: 1495,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Covered Carport & Driveway',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Dedicated Laundry Room with Washer & Dryer Included',
    flooring: ['Classic Terrazzo Flooring'],
    amenities: [
      'Charming 2-Bedroom Half-Duplex with Private Covered Carport',
      'Fully Fenced Private Backyard',
      'Timeless Terrazzo Flooring Throughout the Home',
      'Kitchen with Brand New Refrigerator, Range Oven & Generous Cabinetry',
      'Dedicated Laundry Room Equipped with Brand New Washer and Dryer',
      'Refreshed Bathroom with Glazed Tub and Updated Vanity',
      'Both Bedrooms Feature Spacious Walk-In Closets',
      'Prime Location: 2 Miles to Downtown Orlando, Minutes to Camping World Stadium & Lake Eola',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Washer', 'Dryer'],
    description: `Timeless terrazzo flooring throughout, a private covered carport, a fully fenced backyard, and brand-new laundry appliances highlight this 2-bedroom home on North Lakeland Avenue.

The interior showcases cool and durable terrazzo floors across a spacious main living area equipped with ceiling fan cooling. The kitchen features a brand-new refrigerator, cooking range, solid cabinetry, and an adjoining dedicated laundry room complete with a new washer and dryer.

Both bedrooms provide generous dimensions and dedicated walk-in closets. The full bathroom features a freshly glazed bathtub and updated vanity. Outside, enjoy a covered carport and a private, fully fenced backyard ideal for pets and outdoor leisure. Centrally located just 2 miles from Downtown Orlando, half a mile from Camping World Stadium and Rock Lake, with swift access to I-4, SR-50, and SR-408.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (813 sq. ft.)
• Classic terrazzo flooring throughout
• Private covered carport and driveway
• Fully fenced private backyard
• Dedicated laundry room with brand-new washer and dryer included
• Both bedrooms equipped with walk-in closets
• 2 miles from Downtown Orlando, Lake Eola, and major highways
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,495
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  },
  {
    pipeline_id: 'PP-5E49F81B',
    address: '2803 Waxy Willow Ln',
    city: 'Orlando',
    state: 'FL',
    zip: '32808',
    county: 'Orange County',
    neighborhood: 'Pine Hills / North West Orlando',
    lat: 28.5772,
    lng: -81.4589,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 2,
    half_bathrooms: null,
    total_bathrooms: 2,
    square_footage: 868,
    year_built: 1984,
    monthly_rent: 1600,
    security_deposit: 1600,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Driveway Parking',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Home Washer & Dryer Hookups',
    flooring: ['Contemporary Flooring', 'Tile'],
    amenities: [
      'Well-Maintained 2-Bedroom, 2-Bathroom Single-Family Home',
      'Equipped Kitchen with Dishwasher, Microwave, Range Oven & Refrigerator',
      'Central Air Conditioning & Heating System',
      'Two Full Bathrooms for Optimal Household Convenience',
      'Private Driveway Parking',
      'In-Home Laundry Connections',
      'Convenient Access to Silver Star Road, SR-408 & Highway 50',
      'Pet-Friendly Living'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Washer/Dryer Hookups'],
    description: `Two full bathrooms, an equipped kitchen with full appliances, central climate control, and private driveway parking highlight this 2-bedroom single-family home on Waxy Willow Lane.

The layout features a bright, welcoming living room with low-maintenance flooring and central air conditioning. The kitchen offers practical meal-preparation counter space, solid cabinetry, and a full appliance suite including a refrigerator, cooking range, microwave, and dishwasher.

Two comfortable bedrooms each provide dedicated closet space and convenient access to two full bathrooms. The home also includes in-house laundry connections and a private driveway. Situated in Northwest Orlando with easy access to Silver Star Road, Colonial Drive (SR-50), and SR-408 for straightforward travel across the region.

Key Property Features:
• 2 Bedrooms, 2 Bathrooms (868 sq. ft.)
• Single-family home with private yard space
• Full kitchen package with dishwasher and microwave
• Central air conditioning and heating
• Dedicated in-home laundry hookups
• Two full bathrooms
• Private driveway parking
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,600
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  },
  {
    pipeline_id: 'PP-A4115364',
    address: '9061 Lee Vista Blvd #1306-1',
    city: 'Orlando',
    state: 'FL',
    zip: '32829',
    county: 'Orange County',
    neighborhood: 'Lee Vista / Lake Nona Gateway',
    lat: 28.4619,
    lng: -81.2725,
    property_type: 'CONDO',
    bedrooms: 1,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 776,
    monthly_rent: 1600,
    security_deposit: 1600,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Assigned Parking & Guest Spaces',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated In-Unit Laundry Room with Full-Size Washer & Dryer Included',
    flooring: ['Carpet', 'Tile'],
    amenities: [
      'Unique 1-Bedroom Loft Condominium with Expansive Bonus Upper Space',
      'Dedicated Laundry Room with Full-Size Washer and Dryer Included',
      'Rent Includes Cable, Water, Sewer, Trash Service & Lawn Care',
      'Resort-Style Community Pool with Sun Deck',
      'Modern Fitness Center & Clubhouse',
      'Tennis Courts & Indoor Basketball Courts',
      'Minutes to Lake Nona Medical City, MCO Airport, SR-417 & SR-528',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Washer', 'Dryer'],
    description: `A dramatic high-ceiling bonus loft space, comprehensive utilities included in rent, an in-unit laundry room with full-size machines, and resort-style community amenities highlight this condominium on Lee Vista Boulevard.

The residence features an open primary living and dining area complemented by an expansive upper-level loft area ideal for an executive home office, creative studio, or secondary lounge. The functional kitchen provides ample cabinet storage and counter space. A separate indoor laundry room comes equipped with a full-size washer and dryer.

Residents enjoy an inclusive living package with cable, water, sewer, trash, and exterior maintenance included in monthly rent. Community amenities feature a resort-style swimming pool, fully equipped fitness center, tennis courts, indoor basketball courts, and a resident clubhouse. Strategically located near Lake Nona, UCF, Orlando International Airport, and major expressways including SR-417 and SR-528.

Key Property Features:
• 1 Bedroom + Bonus Loft, 1 Bathroom (776 sq. ft.)
• Spacious second-level loft space for office or flex living
• Dedicated laundry room with full-size washer and dryer included
• Cable, water, sewer, trash, and lawn maintenance included in rent
• Resort-style community pool, fitness center, tennis & indoor basketball
• Central air conditioning and heating
• Prime location near Lake Nona, MCO Airport, SR-417, and SR-528
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,600
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  },
  {
    pipeline_id: 'PP-2F0F52A3',
    address: '155 S Court Ave #1603-1',
    city: 'Orlando',
    state: 'FL',
    zip: '32801',
    county: 'Orange County',
    neighborhood: 'Downtown Orlando / Central Business District',
    lat: 28.5398,
    lng: -81.3789,
    property_type: 'CONDO',
    bedrooms: 0,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 615,
    monthly_rent: 1600,
    security_deposit: 1600,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: '1 Assigned Garage Parking Space',
    garage_spaces: 1,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer and Dryer',
    flooring: ['Hardwood Flooring', 'Tile'],
    amenities: [
      'High-Rise 16th-Floor Studio Residence at The Solaire at the Plaza',
      'Floor-to-Ceiling Windows with Panoramic Skyline & Lake Eola Views',
      'Contemporary Kitchen with Granite Countertops, Onyx Backsplash & Stainless Steel Appliances',
      'Hardwood Flooring in Foyer & Kitchen with Sleek Tile Living Area',
      'One Dedicated Secure Garage Parking Space Included',
      '10th-Floor Outdoor Amenity Plaza with Swimming Pool, Sun Deck & Grilling Stations',
      'Resident Clubhouse Lounge with Flat-Screen TVs, Full Kitchen & Bar Area',
      '24-Hour Building Security and Concierge Service',
      'Steps to Lake Eola Park, Dr. Phillips Center, Kia Center, Cinema & Premier Dining',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Washer', 'Dryer'],
    description: `Panoramic 16th-floor skyline views over Downtown Orlando and Lake Eola, floor-to-ceiling windows, granite and stainless steel kitchen finishes, and luxury high-rise amenities highlight this studio at The Solaire at the Plaza.

The interior showcases polished hardwood flooring at the entry, elegant tile across the main living suite, and expansive floor-to-ceiling glass providing breathtaking views day and night. The modern kitchen is equipped with granite countertops, an onyx tiled backsplash, and stainless steel appliances.

Residents enjoy premier high-rise amenities including a 10th-floor outdoor plaza with a swimming pool, sunbathing deck, and gas grilling stations, as well as an upscale resident clubhouse with lounge seating, flat-screen televisions, and private gathering spaces. The building offers 24-hour concierge and security service, plus one assigned garage parking space. Located in the core of Downtown Orlando, steps from Lake Eola Park, the Dr. Phillips Performing Arts Center, Kia Center, and world-class dining.

Key Property Features:
• Studio Residence, 1 Bathroom (615 sq. ft.)
• 16th-floor position with floor-to-ceiling panoramic skyline views
• Granite countertops, onyx backsplash, and stainless steel kitchen appliances
• Hardwood and designer tile flooring
• 1 assigned secure garage parking space
• 10th-floor outdoor plaza pool, sun deck, and grilling stations
• 24-hour security, concierge, and clubhouse lounge
• Prime Downtown Orlando location steps from Lake Eola and entertainment
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,600
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  },
  {
    pipeline_id: 'PP-5746885D',
    address: '1507 Wise Ave',
    city: 'Orlando',
    state: 'FL',
    zip: '32806',
    county: 'Orange County',
    neighborhood: 'Hourglass District / SoDo Vicinity',
    lat: 28.5195,
    lng: -81.3541,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 750,
    year_built: 1940,
    monthly_rent: 1600,
    security_deposit: 1600,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Open Driveway Parking',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated Laundry Room with Washer and Dryer Included',
    flooring: ['Wood Plank Flooring', 'Tile'],
    amenities: [
      'Charming Single-Family Home in the Walkable Hourglass District',
      'Dedicated Laundry Room Equipped with Washer and Dryer Included',
      'Partially Fenced Private Backyard and Side Yard Space',
      'Lawn Care Maintenance Included in Rent',
      'Private Driveway Parking',
      'Central Climate Control System',
      'Walkable to Local Neighborhood Cafes, Craft Bakeries, Dining & Markets',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Washer', 'Dryer'],
    description: `A walkable setting in the vibrant Hourglass District, a dedicated laundry room with washer and dryer, lawn maintenance included, and private yard space highlight this 2-bedroom single-family home on Wise Avenue.

The interior offers a functional 2-bedroom floor plan with wood plank flooring and bright windows. The kitchen includes a cooking range, refrigerator, and solid cabinet storage. A dedicated indoor laundry room comes fully equipped with a washer and dryer.

Outside, enjoy a private driveway and a partially fenced backyard and side yard providing outdoor space for relaxation and pets. Biweekly lawn maintenance is included. Situated in one of Orlando's most energetic and walkable neighborhoods, just steps from neighborhood coffee shops, local dining, breweries, and groceries, with quick connections to Downtown Orlando and the SoDo district.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (750 sq. ft.)
• Single-family home in the walkable Hourglass District
• Fully equipped dedicated laundry room with washer and dryer
• Partially fenced private backyard and side yard
• Lawn maintenance included in rent
• Private driveway parking
• Walk to popular neighborhood cafes, restaurants, and shopping
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,600
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-5D24E960',
    address: '2548 Clairmont Ave',
    city: 'Sanford',
    state: 'FL',
    zip: '32773',
    county: 'Seminole County',
    neighborhood: 'Central Sanford / Lake Monroe Corridor',
    lat: 28.7785,
    lng: -81.2711,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 900,
    monthly_rent: 1500,
    security_deposit: 1500,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Off-Street Driveway Parking',
    garage_spaces: 0,
    heating_type: 'Central Heat Pump',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Home Washer & Dryer Hookups',
    flooring: ['Ceramic Tile', 'Laminate Wood Flooring'],
    amenities: [
      'Fully Renovated 2-Bedroom Home with Top-to-Bottom Upgrades',
      'Modern Kitchen with Stainless Steel Appliances, Tile Backsplash & Pantry',
      'Ceramic Tile and Modern Laminate Flooring Throughout',
      'Energy-Efficient Upgrades, Modern LED Fixtures & Brushed Nickel Hardware',
      'Fully Enclosed Tiled Back Porch / Sunroom with Storage Closet',
      'Spacious Fully Fenced Backyard Ideal for Outdoor Privacy and Pets',
      'Newer Central A/C and Climate Control System',
      'Minutes to Historic Downtown Sanford, Lake Monroe Marina & Regional Shopping',
      'Pet-Friendly Living'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `A complete top-to-bottom renovation, stainless steel kitchen appliances, a fully enclosed tiled sunroom, and a spacious fenced backyard highlight this 2-bedroom home on Clairmont Avenue in Sanford.

The updated interior features durable ceramic tile and laminate flooring throughout, complemented by modern LED lighting, brushed nickel hardware, and fresh neutral paint. The renovated kitchen offers stainless steel appliances, custom backsplash tiling, and pantry storage.

Two bright bedrooms share an updated bathroom with modern fixtures. Off the back of the home, a fully enclosed tiled back porch provides sunroom relaxation with an extra storage closet, opening to a spacious fully fenced backyard. Complete with newer central air conditioning and off-street parking. Located in central Sanford close to SR-417, US-17/92, Lake Monroe waterfront parks, and Historic Downtown Sanford's dining and shopping.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (900 sq. ft.)
• Complete top-to-bottom modern renovation
• Kitchen with stainless steel appliances, new backsplash, and pantry
• Fully enclosed tiled rear porch / sunroom with storage closet
• Spacious fully fenced backyard
• Ceramic tile and laminate flooring throughout (no carpet)
• Newer central air conditioning and LED lighting
• Close to Historic Downtown Sanford, Lake Monroe, and major transit
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,500
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  },
  {
    pipeline_id: 'PP-35F93CBF',
    address: '4025 Billingsgate Rd #2004',
    city: 'Orlando',
    state: 'FL',
    zip: '32839',
    county: 'Orange County',
    neighborhood: 'Lyme Bay Colony / Millenia Area',
    lat: 28.4985,
    lng: -81.4112,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 2,
    half_bathrooms: 1,
    total_bathrooms: 2,
    square_footage: 1164,
    monthly_rent: 1600,
    security_deposit: 1600,
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
    laundry_type: 'Second-Floor Dedicated Laundry Room',
    flooring: ['Brand New Luxury Vinyl Plank Flooring', 'Designer Tile'],
    amenities: [
      'Fully Renovated 2-Story Townhome in Lyme Bay Colony (1,164 Sq. Ft.)',
      'Brand New Luxury Vinyl Plank Flooring and Fresh Interior Paint Throughout',
      'Modern Kitchen with Gray Cabinetry, Stainless Steel Appliances & Massive Pantry',
      'Breakfast Bar Passthrough to Dining Room with Sliding Door to Backyard',
      'Fenced-In Private Backyard Patio for Outdoor Entertaining',
      'Primary Bedroom Retreat with Walk-In Closet and Private Balcony Walk-Out',
      'Upgraded Bathroom with Floor-to-Ceiling Tile and Glass-Framed Shower Door',
      'Convenient Second-Floor Laundry Room Steps from Bedrooms',
      '10 Minutes to Downtown Orlando, Mall at Millenia, I-4, SR-408 & Florida Turnpike',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Washer/Dryer Hookups'],
    description: `A brand-new full renovation, stainless steel kitchen appliances, a primary bedroom with private balcony, and a fenced backyard patio highlight this 2-story townhome in Lyme Bay Colony on Billingsgate Road.

The main level showcases brand new vinyl plank flooring and fresh neutral paint across an open living and dining area. The kitchen is outfitted with contemporary gray cabinetry, brand-new stainless steel appliances, a breakfast bar passthrough, and an expansive pantry. Sliding glass doors lead out to a private fenced backyard patio.

Upstairs, two spacious bedrooms offer abundant natural light. The primary suite features a generous walk-in closet and direct walkout to a private outdoor balcony. The main bathroom displays floor-to-ceiling tile surrounds, a glass-framed shower door, and new vanity. A dedicated laundry room is conveniently positioned on the second floor. Superbly located near the Mall at Millenia with effortless access to I-4, SR-408, and Florida's Turnpike, placing Downtown Orlando just 10 minutes away.

Key Property Features:
• 2 Bedrooms, 2 Bathrooms (1,164 sq. ft. two-story layout)
• Complete fresh modern renovation with luxury vinyl plank flooring
• Upgraded kitchen with stainless steel appliances and large pantry
• Primary bedroom with private walkout balcony and walk-in closet
• Designer bathroom with floor-to-ceiling tile and new vanities
• Fully fenced private backyard patio
• Second-floor dedicated laundry room
• Minutes from Mall at Millenia, I-4, SR-408, and Downtown Orlando
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,600
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  },
  {
    pipeline_id: 'PP-DD3A7C36',
    address: '6623 Westmont Dr',
    city: 'Orlando',
    state: 'FL',
    zip: '32835',
    county: 'Orange County',
    neighborhood: 'MetroWest / West Orlando',
    lat: 28.5281,
    lng: -81.4729,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 2,
    half_bathrooms: null,
    total_bathrooms: 2,
    square_footage: 832,
    monthly_rent: 1600,
    security_deposit: 1600,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Covered Carport & Extended Private Driveway',
    garage_spaces: 0,
    heating_type: 'Central Heat Pump',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Separate Rear Utility Laundry Room with Washer & Dryer Included',
    flooring: ['Ceramic Tile Flooring Throughout'],
    amenities: [
      'Move-In Ready 2-Bedroom, 2-Bathroom Home with High Spatial Efficiency',
      'Both Bedrooms Sized to Easily Accommodate King-Size Beds',
      'Two Full Bathrooms (One with Soaking Tub, One with Walk-In Shower)',
      'Modern Kitchen with Large Refrigerator, Glass-Top Stove & Dishwasher',
      'Separate Rear Utility Room with Full-Size Washer and Dryer Included',
      'Expansive Backyard Featuring a 12x10 Storage Shed',
      'Covered Carport plus Extended Driveway Parking',
      'Tile Flooring Throughout with Central Climate Control and Free Biweekly Lawn Care',
      'Convenient West Orlando Location near SR-408, MetroWest & Downtown',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Washer', 'Dryer'],
    description: `Low-maintenance tile flooring throughout, two full bathrooms, a large backyard with a 12x10 storage shed, and a covered carport highlight this 2-bedroom single-family home on Westmont Drive in the 32835 area.

The floor plan is smartly arranged to maximize living space, easily accommodating king-size beds in both bedrooms. The two full bathrooms provide optimal convenience—one featuring a deep soaking tub and the other a walk-in shower. The kitchen includes a large refrigerator, glass-top cooking range, dishwasher, and ample cabinetry.

A separate rear utility room includes a full-size washer and dryer. Outside, enjoy a covered carport, long private driveway, and an expansive backyard with a 12x10 storage shed. Biweekly lawn maintenance is included in the rent. Located near SR-408 and MetroWest with fast commuting into Downtown Orlando, Universal Studios, and Valencia College.

Key Property Features:
• 2 Bedrooms, 2 Bathrooms (832 sq. ft.)
• Both bedrooms comfortably fit king-size beds
• Two full bathrooms (soaking tub + walk-in shower)
• Separate utility room with washer and dryer included
• Modern kitchen appliances including glass-top stove and dishwasher
• Large backyard with 12x10 detached storage shed
• Covered carport and extended private driveway
• Easy-clean tile flooring throughout and cold central A/C
• Biweekly lawn care included in rent
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,600
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  },
  {
    pipeline_id: 'PP-DBA5DE64',
    address: '3004 Hambleton Ave',
    city: 'Orlando',
    state: 'FL',
    zip: '32810',
    county: 'Orange County',
    neighborhood: 'Fairview Shores / Maitland Vicinity',
    lat: 28.6185,
    lng: -81.4231,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 776,
    monthly_rent: 1600,
    security_deposit: 1600,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Driveway Parking',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated Laundry Closet with Washer and Dryer Included',
    flooring: ['Updated Contemporary Plank Flooring', 'Tile'],
    amenities: [
      'Updated 2-Bedroom Single-Family Home in Quiet Residential Setting',
      'Refreshed Interior with Modern Flooring and Neutral Paint',
      'Modernized Kitchen with Full Appliance Suite & Solid Countertops',
      'Updated Bathroom with Clean Modern Tile and Vanity',
      'Dedicated Laundry Closet with In-Unit Washer and Dryer Included',
      'Large and Private Backyard Space',
      'Water and Trash Services Included in Rent',
      'Quick Connections to Maitland, I-4, Winter Park & Downtown Orlando',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Microwave', 'Washer', 'Dryer'],
    description: `A large private backyard, updated contemporary flooring and paint, in-unit washer and dryer, and water and garbage services included highlight this 2-bedroom single-family home on Hambleton Avenue.

The updated interior features modern plank flooring, fresh neutral walls, and a cozy central living space. The renovated kitchen provides full cooking appliances including a refrigerator, range oven, microwave, and generous prep counters.

Two comfortable bedrooms share a refreshed full bathroom with updated fixtures. The home includes a dedicated laundry closet equipped with a washer and dryer. Outside, enjoy a large private backyard with space for outdoor leisure and pets, supported by private driveway parking. Water and garbage services are included in the monthly rent. Situated in a peaceful neighborhood with rapid access to Orange Blossom Trail, Maitland Boulevard, I-4, and Winter Park.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (776 sq. ft.)
• Updated interior with modern flooring and fresh paint
• Fully equipped kitchen with microwave and refrigerator
• Laundry closet with washer and dryer included
• Large, private backyard
• Water and garbage collection utilities included in rent
• Private driveway parking
• Close to Maitland, I-4, and Winter Park amenities
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,600
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  },
  {
    pipeline_id: 'PP-6FEC388C',
    address: '5117 Mustang Way',
    city: 'Orlando',
    state: 'FL',
    zip: '32810',
    county: 'Orange County',
    neighborhood: 'Rosemont / Lockhart Area',
    lat: 28.6148,
    lng: -81.4497,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 950,
    monthly_rent: 1600,
    security_deposit: 1600,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Off-Street Private Driveway Parking',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Indoor Laundry Room with Washer & Dryer Hookups',
    flooring: ['Tile Flooring', 'Plank Flooring'],
    amenities: [
      'Solid Concrete Block 2-Bedroom Home with 10x17 Family Room & 10x14 Den',
      'Versatile Den Space Ideal for a Home Office, Studio, or Media Lounge',
      'Kitchen Outfitted with Ice-Maker Refrigerator, Glass-Top Stove & Microwave Hood',
      'Spacious 9x19 Covered Back Patio and Fully Fenced Backyard',
      'Outdoor Storage Shed in Backyard',
      'Dedicated Indoor Laundry Room with Washer and Dryer Hookups',
      'Fresh Interior Paint, Ceiling Fans & Window Blinds Throughout',
      'Lawn Care Service Included in Monthly Rent',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Glass-Top Range / Oven', 'Over-the-Range Microwave', 'Washer/Dryer Hookups'],
    description: `A versatile 10x14 den space, a 10x17 family room, a 9x19 covered back patio, a fully fenced backyard with a storage shed, and included lawn care highlight this concrete block home on Mustang Way.

The residence provides generous living areas with fresh interior paint, ceiling fans, and window blinds. In addition to the main living room, the 10x14 den provides flexible space for a remote work office, media room, or creative retreat. The kitchen features a refrigerator with ice maker, a smooth glass-top cooking stove, an over-the-range microwave hood, and a double stainless steel sink.

Two comfortable bedrooms share a central full bathroom. The home includes a dedicated indoor laundry room with washer and dryer connections. Step outside to a 9x19 covered patio overlooking a fully fenced backyard with an outdoor storage shed. Lawn maintenance is included in the monthly rent. Situated in Lockhart/Rosemont with quick access to Riverside Elementary, Lockhart Middle, Wekiva High, and SR-441.

Key Property Features:
• 2 Bedrooms + Den / Office, 1 Bathroom (950 sq. ft.)
• Concrete block construction with fresh interior paint
• 10x17 family room plus dedicated 10x14 den/flex room
• Kitchen with ice-maker refrigerator, glass-top stove, and microwave
• Expansive 9x19 covered back patio and outdoor shed
• Fully fenced backyard
• Dedicated indoor laundry room with hookups
• Lawn care maintenance included in rent
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,600
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  },
  {
    pipeline_id: 'PP-1567691C',
    address: '801 Egan Dr',
    city: 'Orlando',
    state: 'FL',
    zip: '32822',
    county: 'Orange County',
    neighborhood: 'Dover Shores / Lake Underhill Corridor',
    lat: 28.5342,
    lng: -81.2938,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 912,
    monthly_rent: 1595,
    security_deposit: 1595,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Driveway Parking',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Home Laundry Hookups',
    flooring: ['Tile Flooring', 'Plank Flooring'],
    amenities: [
      'Cozy 3-Bedroom Single-Family Home in Prime East Orlando Location',
      'Spacious Private Backyard Ideal for Outdoor Dining and Pets',
      'Equipped Kitchen with Range Oven, Microwave, Dishwasher & Refrigerator',
      'Functional Single-Story Layout with Abundant Natural Light',
      'Central Climate Control System',
      'Private Driveway Parking',
      'Convenient Access to Lake Underhill Road, Goldenrod Road (FL-551) & SR-408',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Washer/Dryer Hookups'],
    description: `A spacious private backyard, an equipped kitchen with dishwasher and microwave, three comfortable bedrooms, and rapid access to the SR-408 Expressway highlight this single-family home on Egan Drive.

The single-story floor plan features an inviting living room with easy-care flooring and abundant natural daylight. The kitchen provides functional countertop workspace, solid cabinetry, a cooking range, microwave, dishwasher, and refrigerator.

Three well-proportioned bedrooms share a central full bathroom. Outside, the large private backyard offers generous outdoor space for recreation, relaxation, and pets. Complete with private driveway parking and central air conditioning. Conveniently located off Lake Underhill Road and Goldenrod Road, just minutes from SR-408, neighborhood parks, schools, and East Orlando shopping centers.

Key Property Features:
• 3 Bedrooms, 1 Bathroom (912 sq. ft.)
• Single-family home with single-story layout
• Spacious private backyard
• Kitchen equipped with refrigerator, stove, dishwasher, and microwave
• Central air conditioning and heating
• Private driveway parking
• Quick access to SR-408, Lake Underhill Rd, and Goldenrod Rd
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,595
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  }
];

async function publishFLBatch() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('  Choice Properties — Florida Zillow Publishing Batch');
  console.log(`  Processing ${FL_PROPERTIES.length} Fully Enriched Properties`);
  console.log('═════════════════════════════════════════════════════════════════\n');

  const rawPipelineData = JSON.parse(fs.readFileSync('scripts/fl_raw.json', 'utf8'));
  const rawMap = new Map(rawPipelineData.map(p => [p.id, p]));

  const publishedResults = [];
  const today = new Date().toISOString().split('T')[0];

  for (let i = 0; i < FL_PROPERTIES.length; i++) {
    const item = FL_PROPERTIES[i];
    const pipeId = item.pipeline_id;
    const rawProp = rawMap.get(pipeId);

    console.log(`[${i + 1}/${FL_PROPERTIES.length}] Processing ${item.address} (${item.bedrooms}BR/${item.bathrooms}BA) - $${item.monthly_rent}/mo...`);

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

    const title = `${item.bedrooms === 0 ? 'Studio' : item.bedrooms + 'BR'}/${item.bathrooms}BA ${item.property_type === 'CONDO' ? 'Condo' : item.property_type === 'TOWNHOUSE' ? 'Townhome' : 'Home'} in ${item.city} – $${item.monthly_rent.toLocaleString()}/mo`;

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

  fs.writeFileSync('scripts/published_fl_results.json', JSON.stringify(publishedResults, null, 2));

  console.log('\n═════════════════════════════════════════════════════════════════');
  console.log(`  Published ${publishedResults.length} Florida properties successfully!`);
  console.log('═════════════════════════════════════════════════════════════════\n');

  publishedResults.forEach(r => {
    console.log(`${r.n}. ${r.address}, ${r.city}, ${r.state} ${r.zip} ($${r.rent.toLocaleString()}/mo | ${r.beds} Bed / ${r.baths} Bath) — ${r.url}`);
  });
}

publishFLBatch().catch(console.error);
