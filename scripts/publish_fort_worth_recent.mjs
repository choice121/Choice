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

// 12 Fort Worth, TX properties manually verified and enriched from Zillow pipeline
const RECENT_PROPERTIES = [
  {
    pipeline_id: 'PP-24C63187',
    address: '2232 Washington Ave',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76110',
    county: 'Tarrant County',
    neighborhood: 'Carlocks South Side Addition / Near Southside',
    lat: 32.7154,
    lng: -97.3371,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 700,
    monthly_rent: 1295,
    security_deposit: 1295,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Dedicated Off-Street Parking',
    garage_spaces: 0,
    heating_type: 'Central Heating, Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Luxury Wood-Look Laminate (No Carpet)'],
    amenities: [
      'Carlocks South Side Addition Location',
      'No Carpet - Luxury Wood-Look Laminate Flooring Throughout',
      'Galley Kitchen with Granite Countertops & Subway Tile Backsplash',
      'Stainless Steel Appliance Suite',
      'Updated Bathroom with Modern Vanity & Fixtures',
      'Private Fully Fenced Backyard',
      'Ceiling Fans & Neutral Color Palette',
      'Dedicated In-Unit Washer/Dryer Hookups',
      'Minutes to Near Southside Dining, Medical District & I-35W'
    ],
    appliances: ['Stainless Refrigerator', 'Stainless Electric Range / Oven', 'Stainless Microwave', 'Dishwasher'],
    description: `Offering fresh modern updates in Fort Worth's Carlocks South Side Addition, this renovated 2-bedroom duplex delivers clean, low-maintenance living with luxury wood-look laminate flooring throughout and zero carpet.

The updated galley-style kitchen features polished granite countertops, crisp white subway tile backsplash, stainless steel appliances including a range, microwave, and refrigerator, and abundant cabinet storage. The living area is illuminated by natural light and accented by a neutral color palette and overhead ceiling fan.

Both bedrooms are well-proportioned with dedicated closet space and easy access to the fully updated central bathroom. Outside, enjoy your own private, fully fenced backyard—ideal for outdoor relaxation, pets, and quiet evenings. Conveniently located minutes from the Near Southside dining district, Fort Worth Medical District, and I-35W.

Key Property Features:
• 2 Bedrooms, 1 Full Bathroom (700 sq. ft.)
• Carlocks South Side Addition neighborhood
• Luxury wood-look laminate flooring throughout (no carpet)
• Updated kitchen with granite countertops and stainless steel appliances
• Private fully fenced backyard
• Modern updated bathroom with contemporary fixtures
• Central air conditioning and heating with ceiling fans
• Dedicated in-unit washer and dryer hookups`
  },
  {
    pipeline_id: 'PP-C63AC1D2',
    address: '3707 Bryce Ave',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76107',
    county: 'Tarrant County',
    neighborhood: 'Cultural District / West 7th Corridor',
    lat: 32.7432,
    lng: -97.3789,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1992,
    monthly_rent: 1495,
    security_deposit: 1495,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Covered Carport & Off-Street Parking',
    garage_spaces: 0,
    heating_type: 'Central Heating, Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Updated Hardwood-Style Flooring', 'Tile'],
    amenities: [
      'Premier Fort Worth Cultural District Setting',
      'Expansive Floor Plan with Nearly 2,000 Sq. Ft. of Living Space',
      '2 Full Bathrooms Providing Optimal Privacy',
      'Cozy Living Room Focal Fireplace',
      'Updated Flooring & Fresh Interior Paint Throughout',
      'Spacious Kitchen with Dishwasher & Abundant Cabinetry',
      'Covered Carport Parking Space',
      'Private Fenced Backyard',
      'Minutes to Dickies Arena, West 7th, Museums & Montgomery Plaza'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Garbage Disposal'],
    description: `Nestled in the heart of Fort Worth's coveted Cultural District, this rare and expansive 2-bedroom, 2-bathroom duplex provides nearly 2,000 square feet of comfortable, updated living space.

The bright, flowing layout features updated hard-surface flooring, fresh interior paint, and an oversized living room centered around a cozy focal fireplace. The spacious kitchen is equipped with extensive cabinetry, ample countertop workspace, and a dishwasher, easily connecting to a dedicated dining area.

Both bedrooms are generously sized with substantial closet storage, complemented by two full bathrooms that ensure complete privacy for residents and guests. Step outside to a private fenced backyard and enjoy the convenience of covered carport parking. Situated just moments from Dickies Arena, West 7th, Montgomery Plaza, world-class art museums, and premier dining.

Key Property Features:
• 2 Bedrooms, 2 Full Bathrooms (1,992 sq. ft.)
• Prime Cultural District location near West 7th and Dickies Arena
• Exceptionally large floor plan with nearly 2,000 square feet
• Cozy living room focal fireplace
• Two full bathrooms with modern vanities
• Private fenced backyard space
• Covered carport parking
• Central air conditioning and heating`
  },
  {
    pipeline_id: 'PP-AE1CA1CF',
    address: '2506 Normont Cir',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76103',
    county: 'Tarrant County',
    neighborhood: 'Poly / East Fort Worth',
    lat: 32.7231,
    lng: -97.2798,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 774,
    monthly_rent: 1450,
    security_deposit: 1450,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Driveway & Off-Street Parking',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Modern Plank Flooring', 'Tile'],
    amenities: [
      'Detached Single-Family Home with Private Lot',
      'Newly Renovated Modern Interior',
      'Clean Modern Kitchen with Refrigerator & Oven Included',
      'Updated Bathroom with Contemporary Fixtures',
      'Low-Maintenance Plank Flooring Throughout',
      'Central Air Conditioning & Heating',
      'Private Driveway Parking',
      'Private Yard Space',
      'Convenient Access to Highway 287, I-30 & Downtown Fort Worth'
    ],
    appliances: ['Refrigerator', 'Range / Oven'],
    description: `A standalone single-family home on a quiet circle in East Fort Worth, 2506 Normont Circle has been freshly updated to provide 774 square feet of clean, contemporary living.

The interior showcases an efficient, functional floor plan featuring modern plank flooring and bright, sunlit living areas. The kitchen comes equipped with a refrigerator, range/oven, and generous cabinet and counter space for easy meal preparation.

Two comfortable bedrooms feature ample closet storage and share a newly updated central bathroom with modern fixtures. Outside, the home offers a private driveway for off-street parking and a peaceful yard. Enjoy swift commutes with immediate access to Highway 287, I-30, and Downtown Fort Worth.

Key Property Features:
• 2 Bedrooms, 1 Full Bathroom (774 sq. ft.)
• Detached single-family residence on a quiet circle
• Freshly updated modern interior with low-maintenance flooring
• Kitchen equipped with refrigerator and range/oven
• Updated central bathroom with modern vanity
• Private driveway with off-street parking
• Central air conditioning and heating
• Fast connectivity to Hwy 287, I-30, and Downtown`
  },
  {
    pipeline_id: 'PP-A6D70114',
    address: '5718 Houghton Ave',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76107',
    county: 'Tarrant County',
    neighborhood: 'Arlington Heights / Como Corridor',
    lat: 32.7301,
    lng: -97.4082,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 896,
    monthly_rent: 1400,
    security_deposit: 1400,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Driveway & Off-Street Parking',
    garage_spaces: 0,
    heating_type: 'Central Heating, Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Hard-Surface Flooring', 'Ceramic Tile'],
    amenities: [
      'Complete Interior Renovation',
      'Open-Concept Kitchen & Living Space for Easy Entertaining',
      'Expansive Private Backyard for Outdoor Play & Family Gatherings',
      'Central AC & Heating System with Ceiling Fans in All Rooms',
      'Convenient Dedicated In-Unit Washer/Dryer Hookups',
      'Private Driveway Parking',
      'Quick Highway Access to I-30, I-20 & Ridgmar Area',
      'Minutes to Fort Worth Cultural District & Trinity Trails'
    ],
    appliances: ['Range / Oven'],
    description: `Featuring a complete interior renovation, this standalone 2-bedroom home on Houghton Avenue delivers 896 square feet of bright, open-concept living in West Fort Worth.

The layout connects an open kitchen directly to the main living area, creating an inviting atmosphere designed for seamless everyday living and entertaining. Climate comfort is ensured with central air conditioning, heating, and ceiling fans installed in every room.

Both bedrooms are well-sized with convenient closet storage, served by a refreshed central bathroom. Outside, an expansive private backyard provides plenty of room for family get-togethers, outdoor play, and pets. Positioned with rapid access to I-30 and I-20, putting the Cultural District, Camp Bowie, and Downtown within easy reach.

Key Property Features:
• 2 Bedrooms, 1 Full Bathroom (896 sq. ft.)
• Renovated open-concept single-family layout
• Open kitchen flowing into the central living room
• Large private backyard perfect for outdoor gatherings
• Central AC and heating with ceiling fans in all rooms
• In-unit washer and dryer hookups
• Private driveway with dedicated parking
• Convenient access to I-30, I-20, and Camp Bowie Blvd`
  },
  {
    pipeline_id: 'PP-8C03804A',
    address: '3440 Stuart Dr',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76110',
    county: 'Tarrant County',
    neighborhood: 'South Hemphill Heights / TCU Area Corridor',
    lat: 32.6974,
    lng: -97.3359,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 750,
    monthly_rent: 1250,
    security_deposit: 1250,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Off-Street Parking Space',
    garage_spaces: 0,
    heating_type: 'Central Heating, Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Brand-New Hard-Surface Flooring', 'Tile'],
    amenities: [
      'Freshly Painted & Completely Updated Interior',
      'New Quartz Countertops in Kitchen & Bathroom',
      'Upgraded Faucets, Designer Lighting & Ceiling Fans',
      'All-New Low-Maintenance Flooring Throughout',
      'Oven / Range Included with Ample Cabinet Space',
      'Clean, Move-In-Ready Presentation',
      'Minutes to I-35W, Downtown Fort Worth & Medical District',
      'Convenient Proximity to TCU, Shopping Malls & Restaurants'
    ],
    appliances: ['Range / Oven'],
    description: `Enjoy fresh updates and modern finishes in this newly painted 2-bedroom half-duplex, located in South Fort Worth with easy connectivity to I-35W and the Medical District.

The interior showcases brand-new quartz countertops in both the kitchen and bathroom, complemented by upgraded fixtures, designer lighting, new hard-surface flooring, and overhead ceiling fans. The kitchen offers practical cabinet storage and an included range/oven.

Two clean, comfortable bedrooms feature natural light and dedicated closet storage, sharing a modernized full bathroom with a quartz-topped vanity. Situated in a convenient neighborhood surrounded by shopping centers, dining, and local amenities, just minutes from Downtown Fort Worth and TCU.

Key Property Features:
• 2 Bedrooms, 1 Full Bathroom (750 sq. ft.)
• Freshly updated and painted half-duplex
• Brand-new quartz countertops in kitchen and bath
• New hard-surface flooring throughout
• Upgraded lighting fixtures, faucets, and ceiling fans
• Central air conditioning and heating
• Dedicated off-street parking
• Minutes from I-35W, Downtown Fort Worth, and TCU`
  },
  {
    pipeline_id: 'PP-9E84B37B',
    address: '3019 NW 27th St',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76106',
    county: 'Tarrant County',
    neighborhood: 'Historic Northside / Stockyards Area',
    lat: 32.7932,
    lng: -97.3621,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 680,
    monthly_rent: 1300,
    security_deposit: 1300,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Driveway & Off-Street Parking',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Hard-Surface Plank Flooring', 'Tile'],
    amenities: [
      'North Fort Worth / Stockyards Corridor Location',
      'Detached Single-Family Cottage with Private Yard',
      'Low-Maintenance Plank Flooring Throughout',
      'Bright Kitchen with Plentiful Cabinet Space',
      'Central Climate Control System',
      'Private Driveway with Dedicated Off-Street Parking',
      'Minutes to Historic Fort Worth Stockyards & Marine Creek',
      'Convenient to Shopping, Dining, Parks & Downtown'
    ],
    appliances: ['Range / Oven'],
    description: `Positioned in North Fort Worth near the Historic Stockyards, this charming 2-bedroom detached residence offers 680 square feet of comfortable, low-maintenance living.

The functional layout features durable hard-surface plank flooring throughout, creating an inviting living room with ample natural light. The kitchen is outfitted with solid cabinetry and prep counter space for effortless meal preparation.

Two bedrooms provide restful spaces with closet storage, served by a central full bathroom. Outside, enjoy a private fenced yard and a dedicated private driveway. Located just minutes from the vibrant Fort Worth Stockyards, local parks, neighborhood dining, and Downtown Fort Worth.

Key Property Features:
• 2 Bedrooms, 1 Full Bathroom (680 sq. ft.)
• Detached single-family home in North Fort Worth
• Minutes from the Historic Fort Worth Stockyards and Marine Creek
• Easy-care plank flooring throughout
• Central air conditioning and heating
• Private fenced yard and driveway parking
• Dedicated washer and dryer hookups`
  },
  {
    pipeline_id: 'PP-80CAB882',
    address: '3331 Avenue J',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76105',
    county: 'Tarrant County',
    neighborhood: 'Poly / Southeast Fort Worth',
    lat: 32.7215,
    lng: -97.2829,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 1116,
    monthly_rent: 1299,
    security_deposit: 1299,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'New Concrete Driveway (2 Dedicated Off-Street Spots)',
    garage_spaces: 0,
    heating_type: 'Forced Air Central Heating',
    cooling_type: 'Central Air Conditioning (Recent HVAC)',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Hard-Surface Flooring', 'Tile'],
    amenities: [
      'Remodeled Kitchen with New Granite Countertops & Hardwood Cabinets',
      'Full Kitchen Appliance Package with Refrigerator, Stove & Vent Hood Included',
      'Completely Remodeled Bathroom with Fresh Tile & Vanity',
      'Recent Energy-Efficient HVAC System',
      'Brand-New Concrete Driveway with Dedicated Off-Street Parking',
      'Generous 1,116 Sq. Ft. Floor Plan',
      'Large Private Backyard Space',
      'Convenient Location Near Schools, Parks & Highway 287'
    ],
    appliances: ['Refrigerator', 'Range / Stove', 'Vent Hood'],
    description: `Offering 1,116 square feet of remodeled living space, this charming single-family home on Avenue J features significant recent updates including a new kitchen, remodeled bathroom, and energy-efficient HVAC.

The kitchen is equipped with brand-new granite countertops, rich hardwood cabinetry, a range with vent hood, and an included refrigerator. The bathroom has been tastefully remodeled with contemporary tile and an updated vanity.

Both bedrooms are generously sized with expansive closets and natural lighting. Additional major upgrades include a recently installed central HVAC system and a newly poured concrete driveway offering two dedicated off-street parking spots. Outside, enjoy a spacious private backyard near neighborhood schools, parks, and dining with rapid access to Highway 287.

Key Property Features:
• 2 Bedrooms, 1 Full Bathroom (1,116 sq. ft.)
• Remodeled kitchen with granite countertops and hardwood cabinets
• Refrigerator, stove, and vent hood included
• Fully remodeled modern bathroom
• Recently updated HVAC system for energy efficiency
• Newly installed concrete driveway with 2 off-street spots
• Large private backyard
• Close to schools, shopping, and Highway 287`
  },
  {
    pipeline_id: 'PP-3F0C4F83',
    address: '1444 Weiler Blvd',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76112',
    county: 'Tarrant County',
    neighborhood: 'Eastern Hills / Meadowbrook Corridor',
    lat: 32.7485,
    lng: -97.2341,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 954,
    monthly_rent: 1400,
    security_deposit: 1400,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Dedicated Off-Street Parking',
    garage_spaces: 0,
    heating_type: 'Central Heating, Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Luxury Wood-Grain Plank Flooring', 'Tile'],
    amenities: [
      'Eastern Hills Neighborhood near Meadowbrook Golf Course',
      'High Vaulted Ceilings with Overhead Ceiling Fans',
      'Cozy Living Room Focal Fireplace',
      'Luxury Wood-Grain Plank Flooring Throughout',
      'Semi-Open Kitchen with Granite Countertops & White Subway Tile',
      'Stainless Steel Appliances & White Shaker Cabinetry',
      '2 Full Bathrooms for Maximum Resident Privacy',
      'Private Enclosed Courtyard / Patio Area',
      'Swift Connectivity to HWY 30 & Downtown Historic District'
    ],
    appliances: ['Stainless Refrigerator', 'Stainless Range / Oven', 'Dishwasher', 'Microwave'],
    description: `Set in the quiet Eastern Hills neighborhood in close proximity to Meadowbrook Golf Course, this stylish 2-bedroom, 2-bathroom townhome combines architectural character with modern finishes.

The interior welcomes you with soaring vaulted ceilings, luxury wood-grain plank flooring, and a focal fireplace in the main living room. The semi-open kitchen is appointed with granite countertops, crisp white subway tile backsplash, white shaker cabinets, and a suite of stainless steel appliances including a dishwasher.

Two full bathrooms offer exceptional convenience, with one on each level, alongside two restful bedrooms with generous closet space and ceiling fans. Step outside to your private enclosed patio courtyard. Situated with direct access to Highway 30, offering an easy commute to the Downtown historic district and Arlington entertainment venues.

Key Property Features:
• 2 Bedrooms, 2 Full Bathrooms (954 sq. ft.)
• Eastern Hills location near Meadowbrook Golf Course
• High vaulted ceilings and focal living room fireplace
• Modern kitchen with granite countertops and stainless appliances
• Luxury wood-grain plank flooring throughout
• Two full bathrooms with updated fixtures
• Private enclosed courtyard patio
• Rapid access to I-30, Downtown Fort Worth, and Arlington`
  },
  {
    pipeline_id: 'PP-90CEDAF7',
    address: '3211 Rogers Ave',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76109',
    county: 'Tarrant County',
    neighborhood: 'TCU Corridor / University West',
    lat: 32.7042,
    lng: -97.3695,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 1015,
    monthly_rent: 1500,
    security_deposit: 1500,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Driveway & Dedicated Parking',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Included',
    flooring: ['Hardwood & Plank Flooring', 'Tile'],
    amenities: [
      'Prime TCU Corridor & University West Location',
      'In-Unit Washer & Dryer Included in Rent',
      'Bright, Functional Floor Plan with Abundant Natural Light',
      'Spacious Living Areas with Hard-Surface Flooring',
      'Equipped Kitchen with Ample Cabinet & Pantry Space',
      'Large Private Fenced Backyard for Relaxing & Entertaining',
      'Private Driveway with Off-Street Parking',
      'Minutes to TCU Campus, Medical District, Clearfork & Downtown'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Washer', 'Dryer'],
    description: `Ideally situated just minutes from the Texas Christian University (TCU) campus, this charming single-family residence on Rogers Avenue offers 1,015 square feet of sunlit, functional living with in-unit washer and dryer included.

The home features an open, comfortable layout accented by hard-surface flooring and large windows that fill the living and dining rooms with natural light. The kitchen provides plenty of counter prep space, cabinetry, and essential appliances.

Both bedrooms are well-proportioned with deep closet storage, sharing an updated central bathroom. Outside, the large private backyard provides an expansive outdoor space for relaxing or entertaining under the Texas sky. Positioned in one of Fort Worth's most desirable pockets, moments from TCU, the Medical District, University Park Village, and the Fort Worth Zoo.

Key Property Features:
• 2 Bedrooms, 1 Full Bathroom (1,015 sq. ft.)
• Coveted location minutes from TCU and the Medical District
• In-unit washer and dryer included
• Sunlit living and dining areas with durable flooring
• Large private fenced backyard
• Private driveway with dedicated off-street parking
• Central air conditioning and heating
• Minutes from University Park Village, Clearfork, and I-30`
  },
  {
    pipeline_id: 'PP-F85DFF30',
    address: '6819 W Cleburne Rd',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76133',
    county: 'Tarrant County',
    neighborhood: 'South Hills / Southwest Fort Worth',
    lat: 32.6512,
    lng: -97.3715,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 1036,
    monthly_rent: 1275,
    security_deposit: 1275,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached 1-Car Garage & Driveway',
    garage_spaces: 1,
    heating_type: 'Central Heating, Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Wood-Look Hard-Surface Flooring Throughout (No Carpet)'],
    amenities: [
      'South Hills / Southwest Fort Worth Setting',
      'Attached 1-Car Garage with Private Driveway',
      'Wood-Look Flooring Throughout Living Areas & Bedrooms (No Carpet)',
      'Covered Back Patio Overlooking Fenced Backyard',
      'Kitchen with Refrigerator Included & Abundant Cabinetry',
      'Central Air Conditioning & Heating',
      'In-Unit Washer & Dryer Hookups',
      'Close to McCart Ave & Altamesa Blvd Shopping Centers'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher'],
    description: `Positioned in South Fort Worth near the South Hills neighborhood, this 1,036-square-foot half-duplex offers an attached one-car garage, private fenced yard, and low-maintenance wood-look flooring throughout with no carpet.

The open living area flows into the functional kitchen, which includes a refrigerator, range, dishwasher, and ample cabinet storage. Sliding glass doors lead out to a covered back patio, perfect for relaxing outdoors in any weather while looking over the private fenced yard.

Both bedrooms feature wood-look flooring and ample closet space, served by a central full bathroom. The attached one-car garage provides secure vehicle parking and additional storage. Located down the street from South Hills schools and minutes from McCart Avenue and Altamesa Boulevard retail and dining.

Key Property Features:
• 2 Bedrooms, 1 Full Bathroom (1,036 sq. ft.)
• South Fort Worth location near South Hills
• Attached 1-car garage plus private driveway
• Wood-look flooring throughout with zero carpet
• Refrigerator and kitchen appliances included
• Covered rear outdoor patio and fenced backyard
• Central air conditioning and heating
• Convenient to McCart Ave, Altamesa Blvd, and I-20`
  },
  {
    pipeline_id: 'PP-DF6BBD51',
    address: '5947 Shadydell Dr',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76135',
    county: 'Tarrant County',
    neighborhood: 'Lake Worth / Northwest Fort Worth',
    lat: 32.8091,
    lng: -97.4328,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 1.5,
    half_bathrooms: 1,
    total_bathrooms: 2,
    square_footage: 1088,
    monthly_rent: 1275,
    security_deposit: 1275,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Covered Carport & Off-Street Parking',
    garage_spaces: 0,
    heating_type: 'Central Heating, Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Hard-Surface Flooring', 'Carpet'],
    amenities: [
      'Lake Worth / Northwest Fort Worth Location',
      'Two-Story 1,088 Sq. Ft. Duplex Layout',
      '1.5 Bathrooms with Main-Level Guest Powder Room',
      'Covered Carport for Protected Vehicle Parking',
      'Equipped Kitchen with Extensive Counter & Cabinet Space',
      'Low-Maintenance Private Backyard',
      'Central Air Conditioning & Heating',
      'Minutes to Lake Worth Parks, Shopping Centers & Loop 820'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher'],
    description: `Offering a blend of comfort and convenience in Northwest Fort Worth near Lake Worth, this 1,088-square-foot two-story duplex features two bedrooms, 1.5 bathrooms, and covered carport parking.

The ground level features a bright living area filled with natural light, connecting to an equipped kitchen with generous counter space, full cabinetry, and appliances. A convenient powder room is positioned on the main floor for guests.

Upstairs, two comfortable bedrooms offer a quiet retreat with generous closet storage and access to the full bathroom. Step outside to a low-maintenance private backyard ideal for enjoying Texas weather. A dedicated carport provides covered off-street parking. Situated minutes from Lake Worth shopping centers, dining, parks, and Loop 820.

Key Property Features:
• 2 Bedrooms, 1.5 Bathrooms (1,088 sq. ft.)
• Lake Worth area location in Northwest Fort Worth
• Two-story layout with main-level guest powder room
• Covered carport parking space
• Functional kitchen with abundant cabinetry and counter prep area
• Low-maintenance private backyard
• Central air conditioning and heating
• Minutes from Loop 820, Lake Worth retail, and parks`
  },
  {
    pipeline_id: 'PP-63A81715',
    address: '6702 S Creek Dr',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76133',
    county: 'Tarrant County',
    neighborhood: 'South Hills / Southwest Fort Worth',
    lat: 32.6534,
    lng: -97.3621,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 1048,
    monthly_rent: 1350,
    security_deposit: 1350,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached 1-Car Garage & Driveway',
    garage_spaces: 1,
    heating_type: 'Central Heating, Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Luxury Vinyl Plank Flooring', 'Tile'],
    amenities: [
      'Southwest Fort Worth Location near Altamesa & McCart',
      'Large Living Room with Soaring High Ceilings',
      'Luxury Vinyl Plank Flooring Throughout Living Areas',
      'Primary Bedroom with Expansive Walk-In Closet & Vanity Area',
      'Galley Kitchen with Full Appliance Suite Including Refrigerator',
      'Attached 1-Car Garage with Extra Storage Space',
      'Fenced-In Private Backyard',
      'Central Air Conditioning & In-Unit Laundry Hookups'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Garbage Disposal'],
    description: `Situated in Southwest Fort Worth, this spacious 1,048-square-foot duplex features a large living room with high vaulted ceilings and luxury vinyl plank flooring, an attached one-car garage, and a private fenced yard.

The layout includes a dedicated dining area connecting to a functional galley-style kitchen fully equipped with a refrigerator, range/oven, dishwasher, and garbage disposal. The primary bedroom is quietly located at the rear of the home, showcasing a large walk-in closet, direct vanity access, and entry into the full bathroom.

The second bedroom is also generously sized with substantial closet storage. An attached one-car garage provides secure parking and extra storage space. Located near McCart Avenue and Altamesa Boulevard, offering quick access to shopping, dining, parks, and I-20.

Key Property Features:
• 2 Bedrooms, 1 Full Bathroom (1,048 sq. ft.)
• Southwest Fort Worth location near Altamesa and McCart
• High vaulted ceilings in living room with luxury vinyl plank flooring
• Primary bedroom with large walk-in closet and vanity area
• Full kitchen appliance package with refrigerator included
• Attached 1-car garage with extra storage space
• Fenced-in private backyard
• Central air conditioning and heating`
  }
];

function buildDirectUrl(prop) {
  return `${SITE_URL}/property.html?id=${prop.id}`;
}

async function publishBatch() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('  PUBLISHING 12 RECENT PIPELINE PROPERTIES (FORT WORTH, TX)');
  console.log('═════════════════════════════════════════════════════════════════\n');

  // 1. Fetch raw pipeline properties from DB
  const pipeFetchRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?select=*`, {
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Accept-Profile': 'pipeline'
    }
  });
  const dbPipeProps = await pipeFetchRes.json();
  console.log(`Fetched ${dbPipeProps.length} pipeline records from database.\n`);

  const publishedResults = [];

  for (let i = 0; i < RECENT_PROPERTIES.length; i++) {
    const item = RECENT_PROPERTIES[i];
    const pipeId = item.pipeline_id;
    const dbProp = dbPipeProps.find(p => p.id === pipeId);

    console.log(`\n[${i + 1}/${RECENT_PROPERTIES.length}] Processing ${item.address}, ${item.city}, ${item.state} ${item.zip}...`);

    let rawImageUrls = [];
    if (dbProp && dbProp.original_image_urls) {
      try {
        rawImageUrls = typeof dbProp.original_image_urls === 'string'
          ? JSON.parse(dbProp.original_image_urls)
          : dbProp.original_image_urls;
      } catch (e) {
        rawImageUrls = [];
      }
    }

    // Filter images (clean only)
    const cleanImageUrls = rawImageUrls.filter(url => {
      if (!url || typeof url !== 'string') return false;
      const lower = url.toLowerCase();
      return !lower.includes('banner') && !lower.includes('flyer') && !lower.includes('contact');
    });

    if (cleanImageUrls.length < 6) {
      console.warn(`   ⚠ Property ${item.address} has only ${cleanImageUrls.length} images (< 6). Skipping.`);
      continue;
    }

    console.log(`   ✓ Found ${cleanImageUrls.length} verified photographs.`);

    // 2. Build public.properties record
    const propId = crypto.randomUUID();
    const title = `${item.bedrooms}BR ${item.property_type === 'SINGLE_FAMILY' ? 'Single Family Home' : 'Duplex / Townhome'} in ${item.city}`;

    const propRecord = {
      id: propId,
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
      bedrooms: item.bedrooms,
      bathrooms: item.bathrooms,
      half_bathrooms: item.half_bathrooms,
      total_bathrooms: item.total_bathrooms,
      square_footage: item.square_footage,
      monthly_rent: item.monthly_rent,
      security_deposit: item.security_deposit,
      application_fee: item.application_fee,
      property_type: item.property_type,
      parking: item.parking,
      garage_spaces: item.garage_spaces,
      pets_allowed: true,
      pet_types_allowed: item.pet_types_allowed,
      smoking_allowed: false,
      lease_terms: null,
      minimum_lease_months: null,
      has_central_air: item.has_central_air,
      has_basement: item.has_basement,
      heating_type: item.heating_type,
      cooling_type: item.cooling_type,
      laundry_type: item.laundry_type,
      flooring: item.flooring,
      amenities: item.amenities,
      appliances: item.appliances,
      landlord_id: LANDLORD_ID,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 3. Insert into public.properties
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
    console.log(`   ✓ Inserted into public.properties (ID: ${propId})`);

    // 4. Insert photos into public.property_photos
    const photoRows = cleanImageUrls.map((url, idx) => ({
      property_id: propId,
      url: url,
      display_order: idx,
      is_hero: idx === 0,
      caption: `${item.address} - Photo ${idx + 1}`
    }));

    const insertPhotosRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(photoRows)
    });

    if (!insertPhotosRes.ok) {
      const errText = await insertPhotosRes.text();
      console.error(`   ✗ Failed to insert photos for ${item.address}: ${insertPhotosRes.status} ${errText}`);
    } else {
      console.log(`   ✓ Inserted ${photoRows.length} photos into public.property_photos`);
    }

    // 5. Update pipeline_properties table row
    const patchPipeRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${pipeId}`, {
      method: 'PATCH',
      headers: HEADERS_PIPELINE,
      body: JSON.stringify({
        status: 'published',
        choice_property_id: propId,
        title: title,
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
        garage_spaces: item.garage_spaces,
        has_central_air: item.has_central_air,
        has_basement: item.has_basement,
        neighborhood: item.neighborhood,
        pets_allowed: true,
        smoking_allowed: false,
        lease_terms: null,
        minimum_lease_months: null,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    });

    if (!patchPipeRes.ok) {
      const errText = await patchPipeRes.text();
      console.warn(`   ⚠ Failed to update pipeline_properties for ${pipeId}: ${patchPipeRes.status} ${errText}`);
    } else {
      console.log(`   ✓ Pipeline record ${pipeId} marked as published`);
    }

    const directUrl = buildDirectUrl(propRecord);
    publishedResults.push({
      n: publishedResults.length + 1,
      pipeId,
      id: propId,
      address: item.address,
      city: item.city,
      state: item.state,
      zip: item.zip,
      rent: item.monthly_rent,
      beds: item.bedrooms,
      baths: item.bathrooms,
      sqft: item.square_footage,
      photosCount: photoRows.length,
      directUrl
    });

    console.log(`   🔗 Direct URL: ${directUrl}\n`);
  }

  fs.writeFileSync('scripts/published_recent_fort_worth_results.json', JSON.stringify(publishedResults, null, 2));

  console.log('═════════════════════════════════════════════════════════════════');
  console.log(`  PUBLISHED ${publishedResults.length} PROPERTIES SUCCESSFULLY`);
  console.log('═════════════════════════════════════════════════════════════════\n');

  publishedResults.forEach(r => {
    console.log(`${r.n}. ${r.address}, ${r.city}, ${r.state} ${r.zip} ($${r.rent.toLocaleString()}/mo | ${r.beds} Bed / ${r.baths} Bath) — ${r.directUrl}`);
  });

  return publishedResults;
}

publishBatch().catch(err => {
  console.error('Fatal error during publish:', err);
  process.exit(1);
});
