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

const ST_LOUIS_PROPERTIES = [
  {
    pipeline_id: 'PP-CBDDECA8',
    address: '7015 S Grand Ave',
    city: 'Saint Louis',
    state: 'MO',
    zip: '63111',
    county: 'Saint Louis City',
    neighborhood: 'Carondelet / South St. Louis',
    lat: 38.55755,
    lng: -90.263756,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 1500,
    monthly_rent: 1200,
    security_deposit: 1200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Off-Street Parking & Driveway',
    garage_spaces: 0,
    heating_type: 'Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Hardwood Flooring', 'Tile'],
    amenities: [
      'Spacious 3-Bedroom Single-Family Residence (1,500 Sq. Ft.)',
      'Expansive Open Living and Dining Area with Natural Daylight',
      'Functional Kitchen Equipped with Gas Range & Refrigerator',
      'Welcoming Front Yard Area for Outdoor Relaxation',
      'Dedicated In-Home Laundry Hookups',
      'Ample Storage Across All Three Bedrooms',
      'Convenient South St. Louis Location near Transit & Shopping',
      'Pet-Friendly Living'
    ],
    appliances: ['Refrigerator', 'Gas Range / Oven', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `A spacious 1,500 sq. ft. layout, an expansive combined living and dining area, a welcoming front yard, and an equipped kitchen highlight this 3-bedroom home on South Grand Avenue.

Upon entering, you are greeted by an open and versatile main living area designed for both entertaining and relaxing. The kitchen comes outfitted with a gas range, refrigerator, and practical cabinet storage for all your daily cooking needs.

Three generous bedrooms offer comfortable accommodations and flexible arrangements for family, guests, or a dedicated workspace. Additional conveniences include dedicated in-home washer and dryer hookups. Ideally situated in South St. Louis with immediate access to public transit routes, local grocery markets, and neighborhood dining.

Key Property Features:
• 3 Bedrooms, 1 Bathroom (1,500 sq. ft.)
• Generous living and dining room layout
• Kitchen equipped with refrigerator and gas stove
• Three well-proportioned bedrooms with closet storage
• Dedicated laundry hookups
• Welcoming front yard area
• Prime South St. Louis location near transit and retail
• Pet-friendly accommodations (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,200
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  },
  {
    pipeline_id: 'PP-00F4703C',
    address: '5520 Floy Ave',
    city: 'Saint Louis',
    state: 'MO',
    zip: '63136',
    county: 'Saint Louis City',
    neighborhood: 'North Pointe / North St. Louis',
    lat: 38.708107,
    lng: -90.25707,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 1050,
    year_built: 1950,
    monthly_rent: 1395,
    security_deposit: 1395,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Garage & Off-Street Parking for up to 4 Cars',
    garage_spaces: 1,
    heating_type: 'Natural Gas Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Basement Washer/Dryer Hookups',
    flooring: ['Classic Hardwood Floors', 'Tile'],
    amenities: [
      'Charming 3-Bedroom Brick Bungalow Home (1,050 Sq. Ft.)',
      'Classic Hardwood Flooring Throughout Main Living Areas',
      'Eat-In Kitchen with Dedicated Separate Dining Area',
      'Newer Refrigerator, Electric Range & Cooking Appliances Included',
      'Fresh Neutral Interior Paint Throughout',
      'Partially Finished Lower Level / Basement with Extra Closets & Storage',
      'Garage Plus Off-Street Driveway Parking for up to 4 Vehicles',
      'Minutes to MetroLink, Bus Routes, Shopping Centers & I-70',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Electric Range / Oven', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `Classic hardwood flooring, fresh neutral interior paint, a separate dining room, an attached garage, and a partially finished lower level highlight this 3-bedroom brick bungalow on Floy Avenue.

The main level showcases gleaming hardwood floors throughout the living spaces and three comfortable bedrooms. The kitchen provides generous cabinetry and meal-prep counters, opening into a dedicated dining area, and includes an electric stove and refrigerator.

Downstairs, the partially finished lower level supplies extra closet storage, utility space, and in-home washer and dryer connections. Outside, enjoy a private driveway and garage accommodating up to four vehicles. Conveniently situated close to MetroLink transit lines, local shopping, bus stops, and I-70 for effortless commuting across the St. Louis metropolitan area.

Key Property Features:
• 3 Bedrooms, 1 Bathroom (1,050 sq. ft.)
• Charming brick bungalow architecture
• Hardwood flooring and fresh paint throughout
• Kitchen with separate dining area and appliances included
• Partially finished basement with additional storage and closets
• Garage and off-street parking for up to 4 cars
• Quick access to I-70, MetroLink, and shopping
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,395
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-48667C73',
    address: '4831 Bessie Ave',
    city: 'Saint Louis',
    state: 'MO',
    zip: '63115',
    county: 'Saint Louis City',
    neighborhood: 'Penrose / Kingsway East',
    lat: 38.680565,
    lng: -90.24224,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 1500,
    year_built: 1925,
    monthly_rent: 1400,
    security_deposit: 1400,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Covered Carport & Driveway',
    garage_spaces: 0,
    heating_type: 'Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Basement Laundry with Washer/Dryer Hookups',
    flooring: ['New Contemporary Plank Flooring', 'Tile'],
    amenities: [
      'Substantial 1,500 Sq. Ft. 3-Bedroom Single-Family Home with Multi-Level Layout',
      'Main-Level Primary Bedroom with Direct Walkout to Private Back Porch',
      'Two Extra-Large Upper-Level Bedrooms with Spacious Walk-In Closets',
      'Updated Kitchen with Quality Cabinetry, Counters & Refrigerator',
      'Modernized Full Bathroom with Updated Tile Surrounds',
      'New Flooring and Fresh Paint Throughout the Entire Home',
      'Large Basement Offering Substantial Storage and Laundry Facilities',
      'Covered Carport Parking and Private Driveway',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Garbage Disposal', 'Washer/Dryer Hookups'],
    description: `A private main-level primary bedroom with direct access to a back porch, two oversized upper bedrooms with walk-in closets, new flooring throughout, and 1,500 sq. ft. of updated living space highlight this 3-bedroom home on Bessie Avenue.

The main floor features an inviting living room with new contemporary plank flooring and an updated kitchen with clean cabinetry, countertop space, and refrigerator. The main-level bedroom offers privacy with its own direct walkout to the back porch.

Upstairs, two extra-large bedrooms provide abundant natural lighting and generous walk-in closet storage. The full basement provides extensive space for storage and dedicated laundry equipment. Complete with a covered carport and private driveway. Located in Penrose with quick connections to Natural Bridge Avenue, local transit, and city amenities.

Key Property Features:
• 3 Bedrooms, 1 Bathroom (1,500 sq. ft.)
• Main-floor primary bedroom with walkout to private back porch
• Two extra-large upstairs bedrooms with walk-in closets
• Modernized kitchen and bathroom finishes
• New contemporary flooring throughout
• Expansive basement with laundry hookups and storage
• Covered carport parking
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,400
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  },
  {
    pipeline_id: 'PP-8F6FEF69',
    address: '2306 Farrar St',
    city: 'Saint Louis',
    state: 'MO',
    zip: '63107',
    county: 'Saint Louis City',
    neighborhood: 'Hyde Park / Near North Riverfront',
    lat: 38.65937,
    lng: -90.20795,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2,
    half_bathrooms: null,
    total_bathrooms: 2,
    square_footage: 1200,
    monthly_rent: 1400,
    security_deposit: 1400,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Off-Street Parking & Driveway',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Classic Hardwood Flooring', 'Tile'],
    amenities: [
      'Spacious 1,200 Sq. Ft. 3-Bedroom Home in St. Louis City',
      'Rich Hardwood Flooring Across Main Living Areas and Bedrooms',
      'Formal Separate Dining Room Perfect for Family Gatherings',
      'Eat-In Kitchen Complete with Full Cooking Range and Refrigerator Included',
      'Large Private Backyard Ideal for Outdoor Leisure and Pets',
      'Abundant Storage Closets Throughout',
      'Central Climate Control System',
      'Pet-Friendly Living'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `Classic hardwood flooring, a separate formal dining room, an eat-in kitchen with included appliances, and a large private backyard highlight this 3-bedroom residence on Farrar Street.

The home features solid hardwood floors flowing through a bright, sunlit living area and into a formal dining room suited for family dinners and hosting. The eat-in kitchen offers generous cabinet storage, functional counters, and cooking appliances including a stove and refrigerator.

Three comfortable bedrooms feature hardwood floors and ample closet storage, supported by two bathrooms. Outside, an expansive backyard provides private space for outdoor leisure and pets. Located in Hyde Park near North St. Louis with rapid access to I-70, Downtown St. Louis, and neighborhood parks.

Key Property Features:
• 3 Bedrooms, 2 Bathrooms (1,200 sq. ft.)
• Beautiful hardwood flooring throughout
• Separate formal dining room and eat-in kitchen
• Full kitchen appliances provided (refrigerator and range)
• Generous closet and utility storage space
• Large private backyard
• Central air conditioning and heating
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,400
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  },
  {
    pipeline_id: 'PP-4420A50C',
    address: '4262 Dardenne Dr',
    city: 'Saint Louis',
    state: 'MO',
    zip: '63120',
    county: 'Saint Louis City',
    neighborhood: 'Kingsway / Penrose Area',
    lat: 38.692307,
    lng: -90.272545,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 960,
    year_built: 1933,
    monthly_rent: 1150,
    security_deposit: 1150,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Corner Lot with Off-Street Driveway Parking',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Basement Laundry Hookups',
    flooring: ['Updated Contemporary Plank Flooring', 'Tile'],
    amenities: [
      'Freshly Rehabbed 3-Bedroom Single-Family Home on a Prime Corner Lot',
      'Updated Kitchen with Modern White Cabinetry and Solid Counter Space',
      'Refreshed Contemporary Flooring and Neutral Paint Throughout',
      'Clean Modernized Bathroom with Updated Fixtures',
      'Full Basement Area Offering Abundant Storage and Laundry Space',
      'Generous Yard Space on a Corner Setting',
      'Close to Local Transit, Shopping and Natural Bridge Corridor',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `A fresh top-to-bottom renovation, a prime corner lot setting, an updated kitchen, and full basement storage highlight this 3-bedroom home on Dardenne Drive.

The refreshed interior features updated contemporary plank flooring, fresh neutral paint, and abundant natural lighting throughout the central living area. The newly updated kitchen provides crisp white cabinetry, solid prep counters, and functional cooking space.

Three comfortable bedrooms share a modernized full bathroom with clean fixtures. The full basement provides extensive room for extra storage, hobby space, and dedicated laundry hookups. Situated on a spacious corner lot with easy access to Natural Bridge Avenue, local shopping, and neighborhood transit lines.

Key Property Features:
• 3 Bedrooms, 1 Bathroom (960 sq. ft.)
• Freshly rehabbed interior and move-in ready
• Prime corner lot location
• Updated kitchen with contemporary cabinetry
• Full basement with laundry hookups and storage
• Off-street driveway parking
• Convenient access to transit and major roads
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,150
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-F4E177E3',
    address: '5216 Davison Ave',
    city: 'Saint Louis',
    state: 'MO',
    zip: '63120',
    county: 'Saint Louis City',
    neighborhood: 'Mark Twain / Walnut Park',
    lat: 38.695007,
    lng: -90.2484,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2,
    half_bathrooms: null,
    total_bathrooms: 2,
    square_footage: 960,
    monthly_rent: 1200,
    security_deposit: 1200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Off-Street Driveway Parking',
    garage_spaces: 0,
    heating_type: 'Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Basement Washer/Dryer Hookups',
    flooring: ['Updated Plank Flooring', 'Tile'],
    amenities: [
      'Newly Renovated 3-Bedroom, 2-Bathroom Home with 2 Full Baths',
      'Equipped Kitchen with Cooking Oven, Refrigerator & Solid Cabinetry',
      'Two Full Bathrooms Providing Optimal Morning Convenience',
      'Forced Air Heating and Central Climate Control',
      'Full Basement for Extensive Household Storage and Laundry Connections',
      'Private Off-Street Parking Area',
      'Close to Highway Access, Public Bus Routes and Local Amenities',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `Two full bathrooms, a fresh interior renovation, an equipped kitchen, and full basement storage highlight this 3-bedroom single-family home on Davison Avenue.

The interior showcases updated plank flooring and a comfortable living area filled with natural light. The kitchen is outfitted with an oven, refrigerator, and solid cabinetry for daily meal preparation.

With three well-sized bedrooms and two full bathrooms, this home offers excellent functionality and convenience for household routines. The full basement provides abundant storage space alongside dedicated laundry hookups. Complete with off-street parking and easy access to neighborhood retail, bus lines, and arterial roadways.

Key Property Features:
• 3 Bedrooms, 2 Full Bathrooms (960 sq. ft.)
• Complete fresh interior renovation
• Two full bathrooms for added convenience
• Kitchen equipped with refrigerator and stove
• Full basement with laundry connections and storage
• Dedicated off-street parking
• Close to public transit and local services
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,200
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  },
  {
    pipeline_id: 'PP-D5B48171',
    address: '8990 Edna St',
    city: 'Saint Louis',
    state: 'MO',
    zip: '63147',
    county: 'Saint Louis City',
    neighborhood: 'Baden / North Riverfront',
    lat: 38.72166,
    lng: -90.23573,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 1100,
    monthly_rent: 1200,
    security_deposit: 1200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Attached Garage & Private Driveway',
    garage_spaces: 1,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Basement Washer/Dryer Hookups',
    flooring: ['Updated Plank Flooring', 'Tile'],
    amenities: [
      'Newly Renovated 3-Bedroom Single-Family Home (1,100 Sq. Ft.)',
      'Attached 1-Car Garage and Private Extended Driveway',
      'Equipped Kitchen with Cooking Range, Refrigerator & Storage',
      'Central Forced Air Heating and Central Air Conditioning',
      'Generous Yard Space for Outdoor Activities and Pets',
      'Full Basement for Workshop, Storage & In-Home Laundry Hookups',
      'Quiet Residential Setting near North Riverfront & Highway Access',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `An attached garage, central heating and air conditioning, an equipped kitchen, and 1,100 sq. ft. of newly renovated living space highlight this 3-bedroom home on Edna Street.

The home opens into a bright and spacious living area featuring updated contemporary flooring and fresh paint. The kitchen offers practical prep space, cabinet storage, and comes equipped with a cooking range and refrigerator.

Three well-proportioned bedrooms share a refreshed full bathroom with modern fixtures. Outside, enjoy an attached single-car garage with an extended private driveway and a generous yard space. The full basement provides extensive storage capacity along with dedicated laundry connections. Located in Baden with quick access to North Broadway, I-70, and local parks.

Key Property Features:
• 3 Bedrooms, 1 Bathroom (1,100 sq. ft.)
• Newly renovated interior finishes
• Attached 1-car garage and private driveway
• Central forced air heating and central air conditioning
• Equipped kitchen with stove and refrigerator
• Full basement with storage and laundry hookups
• Spacious yard area
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,200
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  },
  {
    pipeline_id: 'PP-9DBF7F7B',
    address: '3342 Iowa Ave',
    city: 'Saint Louis',
    state: 'MO',
    zip: '63118',
    county: 'Saint Louis City',
    neighborhood: 'Benton Park West / Tower Grove East Corridor',
    lat: 38.59418,
    lng: -90.22845,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2,
    half_bathrooms: 1,
    total_bathrooms: 2,
    square_footage: 872,
    year_built: 1890,
    monthly_rent: 1300,
    security_deposit: 1300,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Detached 3-Car Garage & Off-Street Parking',
    garage_spaces: 3,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer and Dryer Included',
    flooring: ['Hardwood Flooring', 'Tile'],
    amenities: [
      'Historic Brick Home with 3 Bedrooms and Finished Multi-Use Basement Area',
      'Rare 3-Car Detached Garage and Large Fenced Backyard',
      'Upper Level Features Full Bathroom; Basement Includes Convenient Half Bath',
      'Basement Egress Providing Direct Walk-Out Access to Backyard',
      'Full Appliance Package: Refrigerator, Range, Dishwasher, Microwave, Washer & Dryer',
      'Versatile Lower-Level Space Ideal for Home Office, Gym, or Creative Studio',
      'Central Climate Control System with Central Air and Heat',
      'Steps to Cherokee Street Arts, Dining, Boutiques & Tower Grove Park Vicinity',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Washer', 'Dryer'],
    description: `A rare 3-car detached garage, in-unit washer and dryer, a finished walkout basement space with a half bath, and a prime location near Cherokee Street highlight this historic 3-bedroom home on Iowa Avenue.

The upper living level features classic architecture, bright living areas, and three comfortable bedrooms supported by a central full bathroom. The well-appointed kitchen includes a full suite of appliances: refrigerator, cooking range, dishwasher, and microwave.

Downstairs, the well-lit basement features two finished multi-use rooms, a convenient half bathroom, in-unit laundry appliances, and a direct walkout egress leading into a large backyard. Outside, car enthusiasts and hobbyists will love the rare detached 3-car garage. Situated in vibrant Benton Park West, just steps from Cherokee Street's eclectic dining, bakeries, coffee shops, and antique stores.

Key Property Features:
• 3 Bedrooms, 2 Bathrooms (Full bath upstairs + half bath in basement)
• Detached 3-car garage with substantial parking and workshop capacity
• Finished multi-use basement space with backyard walk-out egress
• Full appliance package including dishwasher, washer, and dryer
• Central air conditioning and heating
• Large private backyard
• Walking distance to Cherokee Street arts and dining district
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,300
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-A8708971',
    address: '5916 Minnesota Ave',
    city: 'Saint Louis',
    state: 'MO',
    zip: '63111',
    county: 'Saint Louis City',
    neighborhood: 'Historic Carondelet / South City',
    lat: 38.56029,
    lng: -90.24594,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 800,
    monthly_rent: 1275,
    security_deposit: 1275,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Oversized 2-Car Garage with Double Doors & Driveway',
    garage_spaces: 2,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer and Dryer Included',
    flooring: ['Contemporary Flooring', 'Tile'],
    amenities: [
      'Charming 3-Bedroom Home in Historic Carondelet / South City (800 Sq. Ft.)',
      'Oversized 2-Car Garage with Double Doors and Dedicated Driveway Parking',
      'Deep Fenced-In Backyard Offering Exceptional Outdoor Living Space',
      'Galley Kitchen with Cabinetry, Countertops, and Cooking Range',
      'Finished Bonus Space in Basement Ideal for Extra Storage or Recreation',
      'In-Unit Washer and Dryer Included for Maximum Convenience',
      'Security System Installed',
      'Less than 5 Minutes to Highways, Grocery Markets, and Carondelet Park',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Range Hood', 'Washer', 'Dryer'],
    description: `An oversized 2-car garage with double doors, a deep fenced-in backyard, a finished basement bonus room, and included in-unit laundry highlight this 3-bedroom home on Minnesota Avenue.

The home offers a clean and welcoming layout featuring a bright main living area and a lovely galley kitchen with ample cabinetry and prep space. Three comfortable bedrooms provide generous closet storage and share a clean central full bathroom.

The basement features finished bonus space suited for a recreation room, hobby area, or extra storage, alongside dedicated washer and dryer laundry equipment. Outside, the deep fenced backyard is ideal for outdoor gatherings and pets, complemented by an oversized double-door garage. Located in historic Carondelet just minutes from Carondelet Park, local grocery shopping, and rapid highway connections to Downtown St. Louis.

Key Property Features:
• 3 Bedrooms, 1 Bathroom (800 sq. ft.)
• Oversized 2-car detached garage with double doors
• Deep fully fenced backyard
• Finished bonus room in basement
• In-unit washer and dryer included
• Galley kitchen with full appliances
• Central air conditioning and heating
• Minutes from Carondelet Park, grocery stores, and highway access
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,275
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  },
  {
    pipeline_id: 'PP-3DC58E86',
    address: '4556 Athlone Ave',
    city: 'Saint Louis',
    state: 'MO',
    zip: '63115',
    county: 'Saint Louis City',
    neighborhood: 'Penrose / O’Fallon Park Vicinity',
    lat: 38.67752,
    lng: -90.22362,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 1113,
    monthly_rent: 1350,
    security_deposit: 1350,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Attached Garage & Off-Street Driveway Parking',
    garage_spaces: 1,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Basement Washer/Dryer Hookups',
    flooring: ['Updated Contemporary Plank Flooring', 'Tile'],
    amenities: [
      'Newly Renovated 3-Bedroom Single-Family Residence (1,113 Sq. Ft.)',
      'Bright and Open Living Space with Fresh Contemporary Flooring',
      'Updated Kitchen with Modern Cabinetry and Solid Counter Space',
      'Attached Garage and Dedicated Off-Street Driveway Parking',
      'Central Climate Control System (Air Conditioning & Heating)',
      'Full Basement for Substantial Storage and Laundry Needs',
      'Walking Distance to Neighborhood Parks, Convenience Retail & Metro Bus Lines',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `A complete fresh renovation, an attached garage, central air conditioning, and 1,113 sq. ft. of comfortable living space highlight this 3-bedroom home on Athlone Avenue.

The interior showcases freshly painted living areas with updated contemporary plank flooring and abundant daylight. The kitchen provides modern cabinetry, solid countertop prep surfaces, and space for all your cooking needs.

Three well-sized bedrooms offer generous storage and share a refreshed full bathroom with modern vanity and tile finishes. Outside, enjoy an attached garage and private driveway parking. Located in the Penrose area within walking distance of local neighborhood parks, convenience shopping, and Metro bus transit lines for easy commuting.

Key Property Features:
• 3 Bedrooms, 1 Bathroom (1,113 sq. ft.)
• Newly renovated interior finishes
• Attached garage and private driveway
• Central air conditioning and heating
• Updated kitchen and bathroom
• Full basement with laundry hookups and storage
• Walking distance to parks, convenience stores, and Metro bus stops
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,350
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  }
];

async function publishStLouisBatch() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('  Choice Properties — St. Louis, MO Zillow Publishing Batch');
  console.log(`  Processing ${ST_LOUIS_PROPERTIES.length} Fully Enriched Properties`);
  console.log('═════════════════════════════════════════════════════════════════\n');

  const rawPipelineData = JSON.parse(fs.readFileSync('scripts/stlouis_batch2_raw.json', 'utf8'));
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

  fs.writeFileSync('scripts/published_stlouis_batch2_results.json', JSON.stringify(publishedResults, null, 2));

  console.log('\n═════════════════════════════════════════════════════════════════');
  console.log(`  Published ${publishedResults.length} St. Louis properties successfully!`);
  console.log('═════════════════════════════════════════════════════════════════\n');

  publishedResults.forEach(r => {
    console.log(`${r.n}. ${r.address}, ${r.city}, ${r.state} ${r.zip} ($${r.rent.toLocaleString()}/mo | ${r.beds} Bed / ${r.baths} Bath) — ${r.url}`);
  });
}

publishStLouisBatch().catch(console.error);
