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

// 16 Columbus Metro Townhomes & Duplexes from Zillow Pipeline with full manual enrichment
// Pricing rule applied: > 1300 reduced to 1300, <= 1300 kept at original price
const COLUMBUS_PROPERTIES = [
  {
    pipeline_id: 'PP-84091A9B',
    address: '2415 Glenmawr Ave',
    city: 'Columbus',
    state: 'OH',
    zip: '43202',
    county: 'Franklin County',
    neighborhood: 'So-Hud / University District',
    lat: 40.0135,
    lng: -83.0032,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 750,
    monthly_rent: 1290, // <= 1300 kept at 1290
    security_deposit: 1290,
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
    laundry_type: 'In-Unit Washer and Dryer on First Floor',
    flooring: ['Hardwood Flooring', 'Tile'],
    amenities: [
      'Two-Story Townhouse Layout',
      'In-Unit Washer and Dryer on Main Floor',
      'Kitchen with Dedicated Eating Area',
      'Central Air Conditioning & Heating',
      'Upper-Level Private Bedrooms',
      'Close to COTA and CABS Bus Lines',
      'Direct Access to Protected Bike Lanes',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Washer', 'Dryer'],
    description: `A well-maintained two-story townhouse layout and everyday convenience come together at this 2-bedroom, 1-bathroom residence in Columbus' popular So-Hud neighborhood.

The ground level features an inviting living room that transitions smoothly into a functional kitchen with a dedicated dining and eating nook, alongside first-floor in-unit laundry facilities with washer and dryer included. 

The upper floor accommodates two quiet bedrooms and a full central bathroom. Situated northeast of the OSU campus, the location provides quick connections to COTA and CABS transit lines, protected bike corridors, Columbus State, and Downtown Columbus.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (750 sq. ft.)
• In-unit washer and dryer located on the first floor
• Kitchen featuring a dedicated eat-in dining area
• Central air conditioning and heating system
• Two upper-level private bedrooms
• Easy transit connections to OSU and Downtown Columbus
• Welcoming pet policy for dogs and cats

Application Information:
• Monthly Rent: $1,290
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-D632AE4F',
    address: '442-446 S Yale Ave',
    city: 'Columbus',
    state: 'OH',
    zip: '43223',
    county: 'Franklin County',
    neighborhood: 'Franklinton / Hilltop Border',
    lat: 39.9512,
    lng: -83.0315,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 900,
    monthly_rent: 1200, // <= 1300 kept at 1200
    security_deposit: 1200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Off-Street Parking',
    garage_spaces: 0,
    heating_type: 'Forced Air Heating',
    cooling_type: 'Air Conditioning System',
    laundry_type: 'In-Building Laundry Connections',
    flooring: ['Luxury Vinyl Tile (LVT)', 'Ceramic Tile'],
    amenities: [
      'Fully Updated Kitchen with Modern Cabinetry',
      'Renovated Bathroom with Tile Accents',
      'Durable LVT & Ceramic Tile Flooring',
      'Private Fenced Yard Area',
      'Assigned Off-Street Parking Space',
      'Energy-Efficient Heating & Cooling',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven'],
    description: `Complete interior renovations including modern kitchen updates and resilient flooring highlight this 2-bedroom, 1-bathroom townhome in Columbus.

The interior showcases an updated kitchen equipped with clean cabinetry and appliances, pairing seamlessly with luxury vinyl tile (LVT) and ceramic tile flooring throughout living spaces. 

Both bedrooms offer comfortable accommodations with ample daylight and practical closet storage. Residents enjoy a fenced yard space for outdoor relaxation and designated off-street parking. Positioned conveniently near schools, neighborhood retail, transit corridors, and freeway onramps.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (900 sq. ft.)
• Fully updated kitchen and renovated bathroom
• Easy-to-maintain LVT and ceramic tile flooring
• Fenced yard area for outdoor enjoyment
• Dedicated off-street parking space
• Fast highway access and close to local schools
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,200
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  },
  {
    pipeline_id: 'PP-B95FD529',
    address: '215 Mix Ave',
    city: 'Columbus',
    state: 'OH',
    zip: '43228',
    county: 'Franklin County',
    neighborhood: 'Westgate / West Columbus',
    lat: 39.9532,
    lng: -83.0821,
    property_type: 'TOWNHOUSE',
    bedrooms: 3,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 1080,
    year_built: 1959,
    monthly_rent: 1300, // Reduced from 1500 to 1300
    security_deposit: 1300,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Off-Street Parking in Front of Unit',
    garage_spaces: 0,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'First-Floor Dedicated Laundry Room with Washer and Dryer',
    flooring: ['Laminate Flooring', 'Ceramic Tile', 'Fresh Paint'],
    amenities: [
      'Two-Story Duplex Townhome',
      'First-Floor Family Room & Large Eat-In Kitchen',
      'Dedicated Laundry Room with Bonus Flex Space',
      'Washer & Dryer Included in Unit',
      'Rear Patio & Fully Fenced Yard',
      'Outdoor Storage Shed Use',
      'Fresh Paint & Modern Laminate/Tile Flooring',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Microwave Oven', 'Washer', 'Dryer'],
    description: `A spacious two-story floor plan, complete appliance package, and fully fenced backyard highlight this 3-bedroom, 1-bathroom townhome duplex in West Columbus.

The main level features a bright family room, a generous eat-in kitchen with plentiful cabinet storage, and a separate laundry room with washer and dryer included, alongside versatile flex space. Fresh paint and durable laminate and tile flooring extend throughout the home.

The upper floor accommodates three comfortable bedrooms, each with dedicated closet space, centered around a full bathroom. Outside, enjoy a private rear patio, a fenced yard, an outdoor storage shed for tools and gear, and off-street parking directly in front of the home. Located near Westgate parks, shopping centers, and major transit routes.

Key Property Features:
• 3 Bedrooms, 1 Bathroom (1,080 sq. ft.)
• Large eat-in kitchen and spacious main-floor family room
• In-unit washer and dryer in dedicated laundry/flex room
• Rear patio, fully fenced yard, and storage shed
• Fresh interior paint with laminate and tile flooring
• Off-street parking in front of unit
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,300 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-1D4CC0F2',
    address: '347 N Ohio Ave #347',
    city: 'Columbus',
    state: 'OH',
    zip: '43203',
    county: 'Franklin County',
    neighborhood: 'Mount Vernon / Near East Side',
    lat: 39.9705,
    lng: -82.9723,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 812,
    monthly_rent: 1175, // <= 1300 kept at 1175
    security_deposit: 1175,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: false,
    has_basement: false,
    parking: 'Private Parking Space Next to Unit',
    garage_spaces: 0,
    heating_type: 'Forced Air Heating',
    cooling_type: 'Tenant Air Conditioning',
    laundry_type: 'Nearby Laundry Facilities',
    flooring: ['Luxury Vinyl Plank Flooring'],
    amenities: [
      'Thoughtfully Renovated Duplex Interior',
      'Luxury Vinyl Plank Flooring Throughout',
      'Modern Kitchen with Full Appliance Suite',
      'Dedicated Private Parking Space Beside Unit',
      'Historic Neighborhood Charm with Modern Finishes',
      'Proximity to Nationwide Children’s Hospital & Downtown',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Freezer', 'Range / Oven'],
    description: `Historic charm pairs with modern interior renovations in this 2-bedroom, 1-bathroom townhome duplex located in the historic Mount Vernon neighborhood just east of Downtown Columbus.

The home features an efficient open layout with luxury vinyl plank flooring throughout living areas and bedrooms. The updated kitchen includes clean cabinetry, modern appliances, and generous countertop preparation space. 

Both bedrooms offer peaceful quarters with natural light and closet storage. A dedicated private parking space sits directly adjacent to the unit for seamless everyday parking. Conveniently positioned minutes from Nationwide Children's Hospital, OSU Hospital East, and Downtown Columbus cultural hubs.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (812 sq. ft.)
• Thoughtfully updated interior with luxury vinyl flooring
• Modern kitchen appliances included
• Private off-street parking space next to unit
• Convenient access to Downtown Columbus and medical centers
• Quiet residential neighborhood setting
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,175
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-8BE62F4D',
    address: '656 Riverview Dr #B',
    city: 'Columbus',
    state: 'OH',
    zip: '43202',
    county: 'Franklin County',
    neighborhood: 'Olentangy West / Riverview',
    lat: 40.0245,
    lng: -83.0234,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 850,
    monthly_rent: 1300, // Reduced from 1325 to 1300
    security_deposit: 1300,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'On-Street & Off-Street Parking',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Full Basement Washer & Dryer Hookups',
    flooring: ['New Hardwood-Style Flooring', 'Plush Carpet'],
    amenities: [
      'Two-Story Renovated Townhome',
      'Full Unfinished Basement with Ample Storage',
      'New Flooring Throughout Main Living Areas',
      'Spacious Living Room & Dining Connection',
      'Central Air Conditioning & Heating',
      'Washer/Dryer Hookups in Basement',
      'Immediate Access to SR-315 and Olentangy Trail',
      'Pet-Friendly Living'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Washer/Dryer Hookups'],
    description: `A renovated two-story townhome layout and full basement storage define this 2-bedroom, 1-bathroom residence in the Olentangy West neighborhood of Columbus.

The main level welcomes you with fresh hardwood-style flooring extending through a generous living area into an efficient kitchen equipped with appliances and functional counter space.

The upper floor contains two well-proportioned bedrooms with comfortable closet space and a full bathroom. The full unfinished basement provides expansive storage capacity alongside dedicated washer and dryer hookups. Located seconds from SR-315, the Olentangy Trail, and Ohio State University.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (850 sq. ft.)
• Fully renovated townhome with updated flooring
• Full unfinished basement for extensive storage
• In-home washer and dryer hookups
• Central air conditioning and heating
• Quick highway access to SR-315 and OSU campus
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,300 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  },
  {
    pipeline_id: 'PP-E8E9588F',
    address: '6737 Lagrange Dr',
    city: 'Canal Winchester',
    state: 'OH',
    zip: '43110',
    county: 'Franklin County',
    neighborhood: 'Shannon Green / Canal Winchester',
    lat: 39.8782,
    lng: -82.8341,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 1.5,
    half_bathrooms: 1,
    total_bathrooms: 2,
    square_footage: 1248,
    monthly_rent: 1300, // Reduced from 1500 to 1300
    security_deposit: 1300,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: '2 Assigned Parking Spaces in Front',
    garage_spaces: 0,
    heating_type: 'Central Forced Air Heating (Natural Gas)',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated In-Unit Laundry Room with Hookups',
    flooring: ['Upgraded Laminate Flooring', 'Carpet'],
    amenities: [
      'Generous 1,248 Sq. Ft. Townhome Layout',
      'Expansive Primary Bedroom with Abundant Closet Capacity',
      'Private Rear Patio for Outdoor Relaxation',
      'Upgraded Laminate Flooring Throughout Main Level',
      'Community Pool, Clubhouse & Fitness Center Access',
      'Neighborhood Walking Trails & Dog Park',
      'Two Assigned Parking Spaces in Front of Unit',
      'Central Climate Control & Natural Gas Heating'
    ],
    appliances: ['Dishwasher', 'Microwave Oven', 'Range / Oven', 'Refrigerator', 'Freezer', 'Washer/Dryer Hookups'],
    description: `Generous 1,248 sq. ft. living quarters, a private rear patio, and premier community amenities highlight this 2-bedroom, 1.5-bathroom townhome in Canal Winchester.

The ground floor features upgraded laminate flooring through an expansive living room and an open dining area connecting to a fully equipped kitchen with dishwasher, microwave, range, and refrigerator. A guest half bathroom and separate laundry room are also situated on the first floor.

Upstairs, the expansive primary bedroom boasts oversized closet storage, accompanied by a comfortable second bedroom and a full hallway bath. Step out back to a private patio ideal for outdoor relaxation. Community amenities include a swimming pool, clubhouse, workout facility, walking trails, and a dedicated dog park. Complete with two assigned parking spaces directly in front of the home.

Key Property Features:
• 2 Bedrooms, 1.5 Bathrooms (1,248 sq. ft.)
• Large primary bedroom suite with deep closet capacity
• Fully equipped kitchen with full appliance suite
• Private outdoor patio and dedicated laundry room
• Community pool, fitness facility, clubhouse, and dog park
• 2 assigned parking spaces directly at your front door
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,300 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-7BB2C41D',
    address: '540 S Wayne Ave',
    city: 'Columbus',
    state: 'OH',
    zip: '43204',
    county: 'Franklin County',
    neighborhood: 'West Columbus / Hilltop',
    lat: 39.9478,
    lng: -83.0654,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 950,
    monthly_rent: 1300, // Reduced from 1400 to 1300
    security_deposit: 1300,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Covered Carport Off-Street Parking',
    garage_spaces: 0,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Updated Plank Flooring', 'Plush Carpet in Bedrooms'],
    amenities: [
      'Refreshed Kitchen with Subway Tile Backsplash & White Cabinetry',
      'Updated Bathroom with Matte-Black Fixtures & Custom Tile Surround',
      'Covered Off-Street Carport Parking',
      'Private Lockable Outdoor Storage Shed',
      'Fenced Outdoor Green Space Area',
      'Ceiling Fans in Bedrooms',
      'Central Climate Control System',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave Oven', 'Freezer', 'Washer/Dryer Hookups'],
    description: `Thoughtful modern updates, covered carport parking, and private outdoor storage highlight this 2-bedroom, 1-bathroom home on Columbus' west side.

The main level features a sunlit living room with updated plank flooring and neutral color tones, leading to a refreshed kitchen with crisp white cabinetry, subway tile backsplash, updated countertops, and black appliances. 

The upper floor contains two carpeted bedrooms with ceiling fans and ample natural light, accompanied by a modernized bathroom featuring a new vanity, matte-black fixtures, and custom patterned tile. Outdoor highlights include a covered carport, a private lockable storage shed for bicycles and gear, and a fenced outdoor green space. Located just off Sullivant Avenue with easy access to Downtown Columbus and the Scioto Mile.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (950 sq. ft.)
• Refreshed kitchen with subway tile and modern appliances
• Renovated bathroom with contemporary fixtures and tile
• Covered carport parking and lockable outdoor storage shed
• Private fenced yard space
• In-unit laundry hookups and central air conditioning
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,300 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-82A0EED8',
    address: '2041 Dunbar Dr #2041',
    city: 'Columbus',
    state: 'OH',
    zip: '43224',
    county: 'Franklin County',
    neighborhood: 'North Linden / Northern Woods Border',
    lat: 40.0412,
    lng: -82.9654,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 1050,
    monthly_rent: 1100, // <= 1300 kept at 1100
    security_deposit: 1100,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Designated Off-Street Parking',
    garage_spaces: 0,
    heating_type: 'Heat Pump System',
    cooling_type: 'Air Conditioning System',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Hardwood-Style Vinyl Flooring', 'Carpet'],
    amenities: [
      'Spacious 1,050 Sq. Ft. Floor Plan',
      'Comfortable Open Living Room',
      'Equipped Kitchen with Full Range and Refrigerator',
      'In-Unit Washer and Dryer Hookups',
      'Off-Street Parking Space',
      'Proximity to Cleveland Avenue Transit',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Washer/Dryer Hookups'],
    description: `A generous 1,050 sq. ft. layout and comfortable two-story design make this 2-bedroom, 1-bathroom townhome an excellent residential option in Northeast Columbus.

The main floor centers around a spacious living room that connects to an equipped kitchen with dependable appliances and cabinet storage. 

Upstairs, two well-sized bedrooms offer quiet personal retreats with ample natural light and generous closet capacity, complemented by a full hallway bathroom. Off-street parking is provided on-site. Conveniently positioned near Cleveland Avenue transit lines, shopping hubs, and local parks.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (1,050 sq. ft.)
• Open and inviting living room layout
• Equipped kitchen with range and refrigerator
• In-unit washer and dryer hookups
• Dedicated off-street parking
• Convenient to shopping, parks, and transit corridors
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,100
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-C66F9276',
    address: '161 S Princeton Ave',
    city: 'Columbus',
    state: 'OH',
    zip: '43222',
    county: 'Franklin County',
    neighborhood: 'Franklinton / West Arts District',
    lat: 39.9567,
    lng: -83.0289,
    property_type: 'TOWNHOUSE',
    bedrooms: 3,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 1200,
    monthly_rent: 1300, // Reduced from 1350 to 1300
    security_deposit: 1300,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Off-Street Parking',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Luxury Plank Flooring', 'Tile'],
    amenities: [
      'Newly Renovated 3-Bedroom Floor Plan',
      'Generous 1,200 Sq. Ft. of Living Space',
      'Updated Kitchen & Bathroom',
      'In-Unit Washer & Dryer Hookups',
      'Dedicated Off-Street Parking',
      'Lawn Care Service Included',
      'Proximity to Franklinton Arts District & Downtown',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Washer/Dryer Hookups'],
    description: `Generous 1,200 sq. ft. proportions and complete interior renovations define this 3-bedroom, 1-bathroom townhome duplex in Columbus' thriving Franklinton neighborhood.

The home offers a bright and expansive living layout with modern plank flooring connecting into a refreshed kitchen with updated cabinets and appliances. 

Three dedicated bedrooms provide exceptional flexibility for families, guests, or a home workspace. Additional conveniences include in-unit laundry hookups, off-street parking, and included lawn care service. Situated minutes from the Franklinton Arts District, COSI, the Scioto Peninsula, and Downtown Columbus.

Key Property Features:
• 3 Bedrooms, 1 Bathroom (1,200 sq. ft.)
• Fully renovated interior with contemporary finishes
• Generous living room and open kitchen
• In-unit washer and dryer hookups
• Dedicated off-street parking
• Convenient access to Downtown Columbus and cultural attractions
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,300 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  },
  {
    pipeline_id: 'PP-65A86FD2',
    address: '186 W Park Ave #186',
    city: 'Columbus',
    state: 'OH',
    zip: '43223',
    county: 'Franklin County',
    neighborhood: 'Franklinton / West Columbus',
    lat: 39.9545,
    lng: -83.0212,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 1.5,
    half_bathrooms: 1,
    total_bathrooms: 2,
    square_footage: 1050,
    monthly_rent: 1299, // <= 1300 kept at 1299
    security_deposit: 1299,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Dedicated Off-Street Parking',
    garage_spaces: 0,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'First-Floor Dedicated Laundry Room',
    flooring: ['Hardwood-Style Vinyl Plank', 'Tile'],
    amenities: [
      'Updated Kitchen with Dishwasher & Full Appliances',
      'First-Floor Dedicated Laundry Room',
      'Main-Level Guest Half Bath',
      'Bonus Office / Flex Room Space',
      'Private Fenced Backyard Area',
      'Central Climate Control System',
      'Off-Street Parking',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Washer/Dryer Hookups'],
    description: `An updated kitchen with dishwasher, first-floor laundry, and a private fenced backyard showcase this 2-bedroom, 1.5-bathroom townhome in Franklinton.

The main level features a bright living room, an updated kitchen with solid cabinetry and dishwasher, a guest half bathroom, and a dedicated first-floor laundry room. A bonus flex room provides the perfect space for a dedicated home office or hobby studio.

The second floor contains two spacious bedrooms with closet storage and a full central bathroom. Outside, step into a private fenced backyard area separate from neighboring units. Complete with dedicated off-street parking. Situated close to local shopping, transit lines, and Downtown Columbus.

Key Property Features:
• 2 Bedrooms, 1.5 Bathrooms (1,050 sq. ft.)
• Updated kitchen with dishwasher and full appliances
• First-floor laundry room and bonus home office flex space
• Private fenced backyard
• Central forced air heating and air conditioning
• Dedicated off-street parking
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,299
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-3808982E',
    address: '398 E Northwood Ave',
    city: 'Columbus',
    state: 'OH',
    zip: '43201',
    county: 'Franklin County',
    neighborhood: 'North Campus / University District',
    lat: 40.0091,
    lng: -83.0012,
    property_type: 'TOWNHOUSE',
    bedrooms: 3,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 1100,
    monthly_rent: 1300, // Reduced from 1399 to 1300
    security_deposit: 1300,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'On-Street Parking on Northwood Ave',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Air Conditioning System',
    laundry_type: 'Basement Washer & Dryer Hookups',
    flooring: ['Classic Hardwood Flooring Throughout'],
    amenities: [
      'Original Hardwood Flooring Throughout',
      'Equipped Kitchen with Dishwasher',
      'Full Unfinished Basement for Extra Storage',
      'Air Conditioning & Central Heating',
      'In-Home Washer/Dryer Hookups',
      'Prime North Campus / University District Location',
      'Directly on CABS and COTA Bus Lines',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Washer/Dryer Hookups'],
    description: `Classic hardwood flooring, an equipped kitchen with dishwasher, and an unbeatable North Campus location highlight this 3-bedroom, 1-bathroom University District townhome.

The home features original hardwood floors throughout a spacious living room and open dining zone connecting to a functional kitchen with dishwasher, refrigerator, and range. 

Three well-proportioned bedrooms offer private quarters with abundant natural lighting, accompanied by a full bathroom. The full unfinished basement provides expansive storage capacity alongside dedicated washer and dryer hookups. Situated directly on the CABS and COTA transit corridors for seamless access to Ohio State University and High Street retail.

Key Property Features:
• 3 Bedrooms, 1 Bathroom (1,100 sq. ft.)
• Classic hardwood flooring throughout
• Kitchen equipped with dishwasher and full appliances
• Full unfinished basement with extensive storage
• Central climate control and in-home laundry hookups
• Prime North Campus location on CABS bus routes
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,300 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-4D704F9B',
    address: '483 Gilbert St #483',
    city: 'Columbus',
    state: 'OH',
    zip: '43205',
    county: 'Franklin County',
    neighborhood: 'Driving Park / Southern Orchards Border',
    lat: 39.9531,
    lng: -82.9678,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 816,
    monthly_rent: 1300, // <= 1300 kept at 1300
    security_deposit: 1300,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'On-Street Parking on Gilbert St',
    garage_spaces: 0,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Full Basement Washer & Dryer Hookups',
    flooring: ['Luxury Vinyl Plank Flooring', 'Ceramic Tile'],
    amenities: [
      'Beautifully Remodeled Interior',
      'Decorative Living Room Fireplace Mantle',
      'Water-Resistant Luxury Vinyl Plank Flooring',
      'Custom Countertops & Stainless Steel Appliances',
      'Ceramic Tile Shower Liner & Modern Bathroom Fixtures',
      'Full Basement with Washer/Dryer Hookups',
      'Central Air Conditioning & Forced Air Heating',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Stainless Steel Refrigerator', 'Stainless Steel Range / Oven', 'Stainless Steel Dishwasher', 'Microwave', 'Washer/Dryer Hookups'],
    description: `A decorative living room mantle, water-resistant luxury vinyl plank flooring, and custom stainless steel kitchen upgrades showcase this remodeled 2-bedroom, 1-bathroom townhome in Columbus.

The main level features a bright living room centered by a decorative mantle, leading into a renovated kitchen outfitted with custom countertops, ample cabinetry, and stainless steel appliances including stove, refrigerator, dishwasher, and microwave.

Upstairs, two comfortable bedrooms offer restful accommodations with generous closet storage. The renovated bathroom features a newly installed bathtub with ceramic tile shower surround and contemporary fixtures. The full basement includes washer and dryer hookups with plentiful room for storage. Located near Driving Park community facilities and minutes from Downtown Columbus.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (816 sq. ft.)
• Extensively remodeled interior with luxury vinyl plank
• Stainless steel kitchen appliance suite and custom counters
• Contemporary bathroom with ceramic tile shower surround
• Full basement with laundry hookups and storage
• Central air conditioning and heating system
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,300
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  },
  {
    pipeline_id: 'PP-A78C13F1',
    address: '289 S Ohio Ave #B',
    city: 'Columbus',
    state: 'OH',
    zip: '43205',
    county: 'Franklin County',
    neighborhood: 'Olde Towne East / Franklin Park Border',
    lat: 39.9582,
    lng: -82.9734,
    property_type: 'TOWNHOUSE',
    bedrooms: 3,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 1075,
    monthly_rent: 1300, // <= 1300 kept at 1300
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
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Classic Hardwood Flooring Throughout'],
    amenities: [
      'Original Hardwood Flooring Throughout',
      'Renovated Kitchen with Modern Cabinetry',
      'Updated Bathroom with Contemporary Fixtures',
      'Central Air Conditioning & Heating',
      'Three Sizable Bedrooms with Closets',
      'Dedicated Off-Street Parking',
      'Minutes from Franklin Park Conservatory & Downtown',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Washer/Dryer Hookups'],
    description: `Classic hardwood flooring, renovated kitchen and bath spaces, and 3 sizable bedrooms highlight this charming residence in the Olde Towne East / Franklin Park corridor of Columbus.

The home features gleaming hardwood floors throughout the living area, dining space, and bedrooms. The updated kitchen provides clean cabinetry and dependable appliances for effortless cooking. 

Three versatile bedrooms deliver spacious private quarters with generous closet storage and natural lighting, centered around a modernized full bathroom. Central heating and air conditioning ensure year-round climate comfort, while dedicated off-street parking provides everyday ease. Located moments from Franklin Park Conservatory, Main Street cafes, and Downtown Columbus.

Key Property Features:
• 3 Bedrooms, 1 Bathroom (1,075 sq. ft.)
• Hardwood flooring extending throughout the entire home
• Renovated kitchen and updated modern bathroom
• Central air conditioning and heating system
• Dedicated off-street parking
• Convenient location near Franklin Park and Downtown
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,300
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-88084310',
    address: '6174 Michaelkenney Ln',
    city: 'Dublin',
    state: 'OH',
    zip: '43017',
    county: 'Franklin County',
    neighborhood: 'Dublin / Northwest Franklin County',
    lat: 40.0984,
    lng: -83.1345,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 1.5,
    half_bathrooms: 1,
    total_bathrooms: 2,
    square_footage: 1000,
    monthly_rent: 1250, // <= 1300 kept at 1250
    security_deposit: 1250,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Dedicated Off-Street Parking',
    garage_spaces: 0,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Included',
    flooring: ['Hardwood-Style Flooring', 'Carpet'],
    amenities: [
      'Dublin City School District Location',
      'In-Unit Washer & Dryer Included',
      'Private Outdoor Patio Outback',
      'Two-Story Townhouse Layout with 1.5 Baths',
      'Central Climate Control System',
      'Assigned Off-Street Parking',
      'Close to Sawmill Road Shopping & I-270',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Washer', 'Dryer'],
    description: `Situated in the highly regarded Dublin City School District, this 2-bedroom, 1.5-bathroom townhome offers complete convenience with in-unit washer and dryer and a private rear patio.

The main level features a bright living room, a convenient guest powder room, and an equipped kitchen with ample cabinet storage and dining space. Sliding doors lead to a private outdoor patio out back for quiet relaxation.

The second floor contains two well-proportioned bedrooms with comfortable closet space and a full central bathroom. An in-unit washer and dryer are included for maximum everyday ease. Complete with off-street parking. Conveniently positioned near Sawmill Road shopping centers, parks, dining, and I-270 highway connections.

Key Property Features:
• 2 Bedrooms, 1.5 Bathrooms (1,000 sq. ft.)
• In-unit washer and dryer included
• Private rear outdoor patio
• Located in the Dublin City School District
• Central air conditioning and forced air heating
• Dedicated off-street parking
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,250
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  },
  {
    pipeline_id: 'PP-0454A316',
    address: '1762 Queensbridge Dr #1',
    city: 'Columbus',
    state: 'OH',
    zip: '43235',
    county: 'Franklin County',
    neighborhood: 'Northwest Columbus / Bethel Road Corridor',
    lat: 40.0632,
    lng: -83.0567,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1150,
    monthly_rent: 1300, // Reduced from 1499 to 1300
    security_deposit: 1300,
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
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Hardwood-Style Plank', 'Carpet'],
    amenities: [
      'Attached Garage Parking & Storage',
      'Decorative Fireplace in Living Area',
      'Private Outdoor Patio Area',
      'Two Full Bathrooms for Optimal Privacy',
      'Open Kitchen with Ample Cabinet Storage',
      'Central Climate Control System',
      'Proximity to Bethel Road Dining & SR-315',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Washer/Dryer Hookups'],
    description: `An attached garage, decorative fireplace, and private patio highlight this spacious 2-bedroom, 2-full bathroom townhome in Northwest Columbus.

The main level centers around a bright, open living room with a decorative fireplace centerpiece, connecting seamlessly into the kitchen and dining area. The kitchen features updated appliances, generous cabinet storage, and clean prep surfaces.

Both bedrooms are generously sized with expansive closet storage and direct access to full bathrooms, creating an ideal layout for privacy and comfort. Sliding glass doors lead out to a private patio area, while the attached garage provides secure covered parking and storage. Positioned in Columbus 43235 near Bethel Road, Olentangy River corridors, and SR-315.

Key Property Features:
• 2 Bedrooms, 2 Full Bathrooms (1,150 sq. ft.)
• Attached garage parking and storage
• Living room with decorative fireplace focal point
• Private outdoor patio
• Two full bathrooms providing maximum privacy
• Central heating and air conditioning
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,300 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-2C7E91E5',
    address: '1133 McCarley Dr E #1133',
    city: 'Columbus',
    state: 'OH',
    zip: '43228',
    county: 'Franklin County',
    neighborhood: 'West Columbus / Lincoln Village',
    lat: 39.9654,
    lng: -83.1123,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 1.5,
    half_bathrooms: 1,
    total_bathrooms: 2,
    square_footage: 1350,
    monthly_rent: 1300, // <= 1300 kept at 1300
    security_deposit: 1300,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Dedicated Off-Street Parking',
    garage_spaces: 0,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Full Basement Washer & Dryer Hookups',
    flooring: ['Brand-New Luxury Vinyl Plank (LVP) Throughout'],
    amenities: [
      'Top-to-Bottom Modern Renovation (1,350 Sq. Ft.)',
      'Chef-Inspired Kitchen with Granite Countertops & New Cabinetry',
      'Brand-New Luxury Vinyl Plank Flooring Throughout',
      'Renovated Modern Bathrooms with Upgraded Fixtures',
      'Freshly Painted Clean Full Basement for Storage & Gym',
      'Expansive Fully Fenced-In Backyard',
      'Central Climate Control System',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Washer/Dryer Hookups'],
    description: `A top-to-bottom modern renovation, granite kitchen countertops, and an expansive fully fenced backyard define this 2-bedroom, 1.5-bathroom townhome in West Columbus.

The interior showcases brand-new luxury vinyl plank (LVP) flooring, fresh neutral paint, updated lighting fixtures, and sleek hardware throughout. The chef-inspired kitchen features rich granite countertops, new cabinetry, and modern appliances. A stylishly updated powder room serves the main floor.

Upstairs, two spacious bedrooms offer abundant closet storage alongside an updated full bathroom with a contemporary vanity and fixtures. The clean, freshly painted full basement provides versatile space for extra storage, laundry, or workout equipment. Outside, enjoy an oversized fully fenced-in backyard providing exceptional outdoor space and privacy. Minutes from I-70, I-270, shopping, dining, and parks.

Key Property Features:
• 2 Bedrooms, 1.5 Bathrooms (1,350 sq. ft.)
• Top-to-bottom modern renovation with luxury vinyl plank flooring
• Chef-inspired kitchen with granite countertops and new cabinets
• Updated bathrooms with modern vanities and fixtures
• Freshly painted full basement with laundry setup
• Oversized fully fenced backyard
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,300
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  }
];

function buildDirectUrl(p) {
  return `${SITE_URL}/property.html?id=${p.id}`;
}

async function publishColumbusBatch() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('  Choice Properties — Columbus, OH Pipeline Publishing');
  console.log(`  Processing ${COLUMBUS_PROPERTIES.length} Fully Enriched Properties`);
  console.log('  Pricing Target: $1,100 - $1,300 (Over 1300 capped at 1300)');
  console.log('═════════════════════════════════════════════════════════════════\n');

  const rawPipelineData = JSON.parse(fs.readFileSync('scripts/columbus_zillow_raw.json', 'utf8'));
  const rawMap = new Map(rawPipelineData.map(p => [p.id, p]));

  const publishedResults = [];
  const today = new Date().toISOString().split('T')[0];

  for (let i = 0; i < COLUMBUS_PROPERTIES.length; i++) {
    const item = COLUMBUS_PROPERTIES[i];
    const pipeId = item.pipeline_id;
    const rawProp = rawMap.get(pipeId);

    console.log(`[${i + 1}/${COLUMBUS_PROPERTIES.length}] Processing ${item.address} (${item.bedrooms}BR/${item.bathrooms}BA) - $${item.monthly_rent}/mo...`);

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

    const title = `${item.bedrooms}BR/${item.bathrooms}BA Townhome in ${item.city} – $${item.monthly_rent}/mo`;

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
      // Update existing property record
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
      // Insert new property record
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
    // Delete existing photos if any
    await fetch(`${SUPABASE_URL}/rest/v1/property_photos?property_id=eq.${propId}`, {
      method: 'DELETE',
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
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

  fs.writeFileSync('scripts/published_columbus_results.json', JSON.stringify(publishedResults, null, 2));

  console.log('═════════════════════════════════════════════════════════════════');
  console.log(`  COLUMBUS, OH — PUBLISHED ${publishedResults.length} PROPERTIES`);
  console.log('═════════════════════════════════════════════════════════════════\n');

  publishedResults.forEach((r, idx) => {
    console.log(`${idx + 1}. ${r.address}, ${r.city}, ${r.state} ${r.zip} ($${r.rent}/mo | ${r.beds} Bed / ${r.baths} Bath) — ${r.directUrl}`);
  });

  return publishedResults;
}

publishColumbusBatch().catch(err => {
  console.error('Fatal error during publish:', err);
  process.exit(1);
});
