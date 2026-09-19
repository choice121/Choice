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

// 16 Oklahoma City Properties with full manual enrichment and pricing rule applied:
// If original > 1200 -> reduce to 1200; if <= 1200 -> keep original price
const OKC_PROPERTIES = [
  {
    pipeline_id: 'PP-04CDE9BD',
    address: '1304 Downing St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73120',
    county: 'Oklahoma County',
    neighborhood: 'The Village / Nichols Hills Border',
    lat: 35.5684,
    lng: -97.5342,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 1345,
    monthly_rent: 1200, // Reduced from 1395 to 1200
    security_deposit: 1200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached Garage & Driveway',
    garage_spaces: 1,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated Utility Room with Washer & Dryer Connections',
    flooring: ['Classic Hardwood Floors', 'Tile'],
    amenities: [
      'Prime Location in The Village Minutes from Nichols Hills',
      'Spacious 1,345 Sq. Ft. Floor Plan with Living & Dining Rooms',
      'Warm Hardwood Flooring Throughout Main Living Areas',
      'Equipped Kitchen with Modern Appliances & Generous Cabinets',
      'Private Fully Fenced Backyard for Outdoor Enjoyment',
      'Attached 1-Car Garage & Concrete Driveway',
      'Central Heating & Air Conditioning System',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Washer/Dryer Hookups'],
    description: `A prime Village location, warm hardwood flooring, and a generous 1,345 sq. ft. layout highlight this 2-bedroom, 1-bathroom single-family residence in Oklahoma City.

The home welcomes you into a bright, open living room that connects effortlessly to a dedicated dining space and an equipped kitchen with clean cabinetry, dependable appliances, and ample countertop prep area.

Both bedrooms provide peaceful private quarters with generous closet storage and natural lighting, centered around a full bathroom with updated fixtures. Step outside to a private, fully fenced backyard ideal for weekend relaxation and entertaining. Complete with an attached 1-car garage and private driveway. Located in the heart of The Village just minutes from Nichols Hills dining, Lake Hefner recreation, and shopping plazas.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (1,345 sq. ft.)
• Hardwood flooring throughout main living spaces
• Kitchen equipped with modern appliances and solid cabinetry
• Expansive fully fenced backyard
• Attached 1-car garage and private driveway
• Central air conditioning and heating system
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,200 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  },
  {
    pipeline_id: 'PP-FE5220D2',
    address: '5312 Brookdale Dr',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73135',
    county: 'Oklahoma County',
    neighborhood: 'Southeast Oklahoma City / Del City Area',
    lat: 35.4128,
    lng: -97.4352,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1.5,
    half_bathrooms: 1,
    total_bathrooms: 2,
    square_footage: 1023,
    monthly_rent: 1200, // Reduced from 1250 to 1200
    security_deposit: 1200,
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
    laundry_type: 'In-Home Laundry Connections',
    flooring: ['Hardwood-Style Flooring', 'Tile'],
    amenities: [
      'Spacious 3-Bedroom Floor Plan with 1.5 Baths',
      'Primary Suite with Built-In Vanity Area',
      'Equipped Kitchen with Range, Refrigerator & Double Sink',
      'Private Fenced Backyard for Outdoor Activities',
      'Attached 1-Car Garage & Driveway Parking',
      'Central Climate Control System',
      'Convenient Access to I-240 and Tinker AFB Area',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Washer/Dryer Hookups'],
    description: `A practical 3-bedroom, 1.5-bathroom floor plan, built-in primary vanity, and fenced backyard define this single-family home in Southeast Oklahoma City.

The main living area offers a comfortable setting that flows directly into a functional kitchen with dependable appliances, a double sink, and ample cabinet storage for daily meal preparation. 

The primary bedroom features a dedicated built-in vanity and private half bath for added convenience, while two additional bedrooms offer generous closet space and natural light. Outside, enjoy a private fenced backyard suitable for pets and outdoor leisure. Complete with an attached 1-car garage and off-street driveway parking. Positioned near I-240 corridors, shopping hubs, and local parks.

Key Property Features:
• 3 Bedrooms, 1.5 Bathrooms (1,023 sq. ft.)
• Primary bedroom with built-in vanity and half bath
• Equipped kitchen with double sink and refrigerator
• Fully fenced backyard for outdoor living
• Attached 1-car garage and private driveway
• Central heating and air conditioning
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,200 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-48F596EA',
    address: '1911 NE 27th St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73111',
    county: 'Oklahoma County',
    neighborhood: 'Northeast Oklahoma City / Innovation District Border',
    lat: 35.4982,
    lng: -97.4721,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 1072,
    monthly_rent: 1100, // <= 1200 kept at 1100
    security_deposit: 1100,
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
    laundry_type: 'In-Unit Washer & Dryer Connections',
    flooring: ['Updated Plank Flooring', 'Tile'],
    amenities: [
      'Comfortable 3-Bedroom Layout with Bright Living Room',
      'Functional Kitchen with Appliance Package',
      'Attached 1-Car Garage & Driveway Parking',
      'Private Fenced Backyard Area',
      'Central Climate Control System',
      'Convenient Access to Tinker AFB (13 Mins) and Downtown OKC',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Washer/Dryer Hookups'],
    description: `A bright 3-bedroom, 1-bathroom floor plan, attached garage, and private backyard define this comfortable home in Northeast Oklahoma City.

The interior showcases an open living room filled with natural light that transitions into a well-appointed kitchen featuring solid cabinetry and essential appliances. 

Three bedrooms offer comfortable accommodations with closet storage, served by a central full bathroom. Outside, the property features a fenced backyard and an attached single-car garage with additional driveway parking. Located just 13 minutes from Tinker Air Force Base with quick access to the Oklahoma State Capitol, OU Health campus, and Downtown Oklahoma City.

Key Property Features:
• 3 Bedrooms, 1 Bathroom (1,072 sq. ft.)
• Open and inviting living room layout
• Kitchen with ample cabinetry and full appliances
• Attached 1-car garage and off-street driveway
• Private fenced backyard
• Quick commute to Tinker AFB and Downtown OKC
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,100
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-03065F5E',
    address: '3600 N Prospect Ave',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73111',
    county: 'Oklahoma County',
    neighborhood: 'Lincoln Terrace North / Northeast OKC',
    lat: 35.5085,
    lng: -97.4789,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1500,
    monthly_rent: 1200, // Reduced from 1225 to 1200
    security_deposit: 1200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Carport & Concrete Driveway',
    garage_spaces: 0,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Refreshed Hardwood Floors', 'Ceramic Tile'],
    amenities: [
      'Substantial 1,500 Sq. Ft. All-Brick Bungalow',
      'Refreshed Hardwood Floors in Living & Dining Rooms',
      'Fresh Interior & Exterior Paint Throughout',
      'Double-Insulated Energy-Efficient Windows & Steel Doors',
      'Two Full Bathrooms with Tiled Finishes',
      'Covered Carport & Long Concrete Driveway',
      'Spacious Yard with Mature Trees',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Washer/Dryer Hookups'],
    description: `Substantial 1,500 sq. ft. proportions, refreshed hardwood flooring, and solid brick bungalow construction highlight this 2-bedroom, 2-full bathroom home in Northeast Oklahoma City.

The interior welcomes you with freshly painted walls, double-insulated energy-efficient windows, and beautifully refreshed hardwood floors across the expansive living and formal dining rooms. The functional kitchen includes solid cabinetry and generous countertop space.

Both bedrooms are well-proportioned with ample closet storage, each accompanied by access to a full bathroom. The exterior features a covered carport, long concrete driveway, and a large yard with mature shade trees. Located near Lincoln Park, the OKC Zoo, Remington Park, and easy highway routes.

Key Property Features:
• 2 Bedrooms, 2 Full Bathrooms (1,500 sq. ft.)
• Classic brick bungalow with refreshed hardwood floors
• Fresh interior and exterior paint with double-insulated windows
• Two full bathrooms providing exceptional privacy
• Covered carport and generous driveway parking
• Large yard with mature landscaping
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,200 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  },
  {
    pipeline_id: 'PP-2FE680D7',
    address: '1153 NW 57th St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73118',
    county: 'Oklahoma County',
    neighborhood: 'Meadowbrook Acres / Classen Curve',
    lat: 35.5301,
    lng: -97.5312,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 1450,
    monthly_rent: 1200, // Reduced from 1395 to 1200
    security_deposit: 1200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Dedicated Off-Street Parking & Storage Garage',
    garage_spaces: 1,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning (New Unit)',
    laundry_type: 'Dedicated Utility Room with Washer & Dryer Connections',
    flooring: ['Refinished Hardwood Flooring', 'Tile'],
    amenities: [
      'Two-Story Red Brick Colonial in Meadowbrook Acres',
      'Backs Directly to Classen Curve Shopping & Dining',
      'Walkable to Whole Foods, Trader Joe’s, Nichols Hills Plaza',
      'Refinished Hardwood Flooring & Large Multi-Pane Windows',
      'Kitchen with Newer Dishwasher, Oven & Range',
      'New Central Heat & Air Conditioning System',
      'Dedicated Garage Storage & Off-Street Parking',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Dishwasher', 'Range / Oven', 'Washer/Dryer Hookups'],
    description: `A premier setting in Meadowbrook Acres backing directly to Classen Curve highlights this charming 2-story red brick colonial residence in Oklahoma City.

The ground floor features a bright living room, dedicated dining area, and a kitchen equipped with newer dishwasher, oven, and range, alongside a separate utility room with laundry connections. Large multi-pane windows bring in exceptional natural light across refinished hardwood floors.

Upstairs, two spacious bedrooms flank a central full bathroom. The property includes a dedicated garage storage bay and an off-street parking space. Enjoy immediate walkable access to Whole Foods, Trader Joe's, Classen Curve dining, and Nichols Hills Plaza.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (1,450 sq. ft.)
• 2-story red brick colonial with refinished hardwood floors
• Kitchen with newer dishwasher, oven, and range
• Brand-new central heating and air conditioning system
• Dedicated garage storage bay and off-street parking
• Unbeatable location walking distance to Classen Curve & Nichols Hills Plaza
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,200 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-D46A3F2F',
    address: '808 N Markwell Ave',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73127',
    county: 'Oklahoma County',
    neighborhood: 'West Oklahoma City / Lake Overholser Area',
    lat: 35.4764,
    lng: -97.6321,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1268,
    monthly_rent: 1200, // Reduced from 1290 to 1200
    security_deposit: 1200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached 2-Car Garage & Driveway',
    garage_spaces: 2,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Connections',
    flooring: ['Luxury Vinyl Plank (LVP) Flooring'],
    amenities: [
      'Classic All-Brick Construction with Attached 2-Car Garage',
      '3 Bedrooms and 2 Full Bathrooms',
      'Modern Luxury Vinyl Plank (LVP) Flooring Throughout',
      'Fully Fenced Private Backyard with Storage Shed',
      '2-Minute Drive to Lake Overholser & Waterfront Parks',
      'Central Climate Control System',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Washer/Dryer Hookups'],
    description: `All-brick construction, a 2-car garage, and a location 2 minutes from Lake Overholser showcase this 3-bedroom, 2-full bathroom home in West Oklahoma City.

The interior features modern luxury vinyl plank (LVP) flooring throughout living areas and bedrooms. The open living room connects to an equipped kitchen with ample counter and cabinet space.

The primary suite includes a private full bathroom, while two additional bedrooms share the second full bathroom. Outside, the fully fenced backyard offers a secure green space with a dedicated storage shed. Complete with an attached 2-car garage. Situated near Lake Overholser parks, Route 66 trails, and NW 10th Street amenities.

Key Property Features:
• 3 Bedrooms, 2 Full Bathrooms (1,268 sq. ft.)
• Brick exterior with luxury vinyl plank flooring throughout
• Attached 2-car garage and wide concrete driveway
• Fully fenced private backyard with outdoor storage shed
• 2 full bathrooms for comfort and convenience
• Minutes from Lake Overholser parks and recreation
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,200 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-7584146C',
    address: '2807 SW 61st St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73159',
    county: 'Oklahoma County',
    neighborhood: 'Southwest Oklahoma City / Mayfair South',
    lat: 35.4052,
    lng: -97.5643,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1.5,
    half_bathrooms: 1,
    total_bathrooms: 2,
    square_footage: 966,
    monthly_rent: 1200, // Reduced from 1295 to 1200
    security_deposit: 1200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached 1-Car Garage & Driveway',
    garage_spaces: 1,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Home Washer & Dryer Hookups',
    flooring: ['Updated Laminate Flooring', 'Tile'],
    amenities: [
      'Newly Remodeled Interior & Updated Exterior',
      'Fresh Paint & Modern Flooring Throughout',
      'New Kitchen Countertops & New Gas Stove',
      'Large Fenced Backyard with Covered Patio Area',
      'Attached 1-Car Garage & Concrete Driveway',
      '1.5 Bathrooms for Added Everyday Convenience',
      'Central Heating & Air Conditioning System',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Gas Range / Oven', 'Dishwasher', 'Refrigerator', 'Washer/Dryer Hookups'],
    description: `A complete fresh remodel with new flooring, updated countertops, and a large covered patio highlight this 3-bedroom, 1.5-bathroom home in Southwest Oklahoma City.

The interior showcases fresh paint, new flooring, and an updated kitchen featuring new countertops and a brand-new gas stove. The open living area provides a comfortable layout for daily living and entertaining.

Three bedrooms offer comfortable accommodations with closet storage, complemented by a full bathroom and convenient guest powder room. Step outside to a large fenced backyard with a covered patio area perfect for shaded outdoor relaxation. Complete with an attached 1-car garage. Conveniently located near I-240 and May Avenue shopping corridors.

Key Property Features:
• 3 Bedrooms, 1.5 Bathrooms (966 sq. ft.)
• Freshly remodeled with new paint, flooring, and gas stove
• Kitchen with updated countertops and dishwasher
• Large fenced backyard with covered patio area
• Attached 1-car garage and private driveway
• Central forced air heating and air conditioning
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,200 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  },
  {
    pipeline_id: 'PP-2CDEB57F',
    address: '4641 N Indiana Ave',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73118',
    county: 'Oklahoma County',
    neighborhood: 'Northwest Oklahoma City / Penn Square Mall Corridor',
    lat: 35.5189,
    lng: -97.5456,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 1157,
    monthly_rent: 1200, // Reduced from 1295 to 1200
    security_deposit: 1200,
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
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Hardwood Floors', 'Tile Floors Throughout'],
    amenities: [
      'Remodeled Interior with Decorative Wood Beams & Fireplace',
      'Kitchen with White Marble Backsplash & Full Appliance Suite',
      'Spacious 1/3-Acre Fully Fenced Backyard',
      'Attached 2-Car Garage & Large Workshop/Storage Building',
      'Hardwood Floors and Tile Flooring Throughout',
      'Minutes from NW Expressway, Penn Square Mall & Interstates',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Electric Range / Stove', 'Microwave', 'Dishwasher', 'Refrigerator', 'Washer/Dryer Hookups'],
    description: `Exposed wood ceiling beams, a cozy fireplace, and an expansive 1/3-acre fenced lot highlight this remodeled 3-bedroom, 1-bathroom home in Northwest Oklahoma City.

The living and dining rooms feature handsome wood ceiling beams, a focal fireplace, and gleaming hardwood floors. The renovated kitchen boasts a white marble backsplash, solid cabinetry, and full appliance suite including electric stove, microwave, and dishwasher.

Three versatile bedrooms offer restful retreats with ample closet space. Outside, the large 1/3-acre fenced backyard includes an attached 2-car garage and a generous separate workshop/storage building. Located on a quiet street near NW Expressway, Penn Square Mall, and major interstates.

Key Property Features:
• 3 Bedrooms, 1 Bathroom (1,157 sq. ft.)
• Living room with decorative wood beams and fireplace
• Renovated kitchen with white marble backsplash and dishwasher
• Expansive 1/3-acre fully fenced backyard
• Attached 2-car garage plus large separate workshop/storage
• Hardwood and tile flooring with central air conditioning
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,200 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-9CC9B758',
    address: '2433 NW 35th St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73112',
    county: 'Oklahoma County',
    neighborhood: 'Central Northwest OKC / Mayfair',
    lat: 35.5064,
    lng: -97.5562,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 909,
    monthly_rent: 1200, // <= 1200 kept at 1200
    security_deposit: 1200,
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
    laundry_type: 'In-Unit Washer & Dryer Included',
    flooring: ['Hardwood-Style Flooring', 'Tile'],
    amenities: [
      'Central Oklahoma City Location with Quick Highway Access',
      'In-Unit Washer and Dryer Included',
      'Bright Living Room with Ample Natural Light',
      'Attached 1-Car Garage & Driveway Parking',
      'Quiet Residential Neighborhood Setting',
      'Central Climate Control System',
      'Proximity to Shopping Centers & Dining Hubs',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Washer', 'Dryer'],
    description: `A central Oklahoma City location, in-unit washer and dryer, and attached garage highlight this clean, move-in-ready 2-bedroom, 1-bathroom home.

The home features an organized floor plan with a welcoming living room, natural sunlight, and a functional kitchen equipped with refrigerator, stove, and cabinet storage. An in-unit washer and dryer are included for maximum convenience.

Both bedrooms offer comfortable private quarters with closet space and easy access to the full bathroom. The property includes an attached garage and private driveway. Positioned in a quiet neighborhood close to shopping centers, dining, and central highway corridors.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (909 sq. ft.)
• In-unit washer and dryer included
• Clean, move-in-ready interior with bright living spaces
• Attached 1-car garage and off-street driveway
• Central air conditioning and heating system
• Central location near shopping centers and highways
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,200
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-28AA9008',
    address: '2020 Andover Ct',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73120',
    county: 'Oklahoma County',
    neighborhood: 'The Village / Lake Hefner Area',
    lat: 35.5891,
    lng: -97.5452,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 1025,
    monthly_rent: 1200, // Reduced from 1400 to 1200
    security_deposit: 1200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached Garage & Driveway',
    garage_spaces: 1,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Home Dedicated Utility Room',
    flooring: ['Refinished Wood Floors Throughout', 'New Designer Tile'],
    amenities: [
      'Complete Top-to-Bottom Interior Remodel',
      'Custom Kitchen with Quartz Countertops & New Cabinetry',
      'Recessed Can Lighting & New Windows Throughout',
      'Completely New Bathroom with Custom Tile Surround & Vanity',
      'Refinished Wood Floors in All Main Rooms',
      'Covered Front Porch & Fully Fenced Yard',
      'Attached Garage & Dedicated Utility Room',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Stainless Steel Refrigerator', 'Stainless Steel Range / Oven', 'Stainless Steel Dishwasher', 'Washer/Dryer Hookups'],
    description: `A complete top-to-bottom remodel with quartz countertops, new cabinetry, and refinished wood floors defines this 2-bedroom, 1-bathroom home on a quiet cul-de-sac in The Village.

The interior showcases recessed can lighting, new energy-efficient windows, and wood floors throughout. The designer kitchen features brand-new cabinetry, quartz countertops, tile backsplash, and modern appliances including a dishwasher. A dedicated in-home utility room houses laundry hookups.

The completely remodeled bathroom boasts new custom tile, a modern vanity, and updated fixtures. Both bedrooms include new closet organizers and shelving. Outside, enjoy a welcoming covered front porch, an attached garage, and a fully fenced backyard. Located near Lake Hefner trails and shopping districts.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (1,025 sq. ft.)
• Complete remodel with quartz countertops and new cabinets
• Refinished wood flooring and recessed can lighting throughout
• Fully updated bathroom with modern tile and vanity
• Attached garage and dedicated indoor utility room
• Covered front porch and fully fenced yard
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,200 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  },
  {
    pipeline_id: 'PP-12139D5D',
    address: '1313 Bellevidere Dr',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73117',
    county: 'Oklahoma County',
    neighborhood: 'Northeast Oklahoma City / Edwards Heights',
    lat: 35.4832,
    lng: -97.4589,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 1225,
    monthly_rent: 1150, // <= 1200 kept at 1150
    security_deposit: 1150,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached 1-Car Garage & Driveway',
    garage_spaces: 1,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Air Conditioning System',
    laundry_type: 'In-Unit Washer & Dryer Included',
    flooring: ['New Laminate & Tile Flooring Throughout'],
    amenities: [
      'Freshly Updated 1,225 Sq. Ft. Floor Plan',
      'In-Unit Washer and Dryer Included',
      'Decorative Fireplace & Ceiling Fans',
      'New Laminate and Tile Flooring Throughout',
      'Attached 1-Car Garage & Concrete Driveway',
      'Fully Fenced Backyard for Outdoor Enjoyment',
      'Central Climate Control System',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Washer', 'Dryer'],
    description: `Fresh paint, new laminate flooring, an in-unit washer and dryer, and a decorative fireplace showcase this updated 2-bedroom, 1-bathroom home in Oklahoma City.

The spacious 1,225 sq. ft. floor plan features a bright living room highlighted by a decorative fireplace and ceiling fans, flowing into an equipped kitchen with stove, refrigerator, and solid cabinetry. 

Both bedrooms offer generous proportions with ample closet storage, served by a clean full bathroom with updated tile finishes. Washer and dryer units are provided in the home. Outside, enjoy a fully fenced backyard and an attached single-car garage with private driveway parking. Located conveniently near I-35 and local community parks.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (1,225 sq. ft.)
• Fresh updates with new paint and laminate flooring
• Living room with decorative fireplace and ceiling fans
• Washer and dryer included in home
• Attached 1-car garage and off-street driveway
• Fully fenced backyard
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,150
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-771EEC2B',
    address: '1240 NE 42nd St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73111',
    county: 'Oklahoma County',
    neighborhood: 'Northeast Oklahoma City / North Highland Border',
    lat: 35.5142,
    lng: -97.4876,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 1039,
    monthly_rent: 1200, // <= 1200 kept at 1200
    security_deposit: 1200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached Garage & Driveway',
    garage_spaces: 1,
    heating_type: 'Central Gas Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Connections',
    flooring: ['Laminate Flooring Throughout'],
    amenities: [
      'Laminate Flooring Throughout Living Areas & Bedrooms',
      'Spacious Fully Fenced Backyard Retreat',
      'Attached Garage for Secure Parking & Storage',
      'Central Air Conditioning & Gas Heating',
      'Equipped Kitchen with Full Cabinet Storage',
      'Convenient Access to I-235 and Downtown OKC',
      'Section 8 Housing Voucher Eligible',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Washer/Dryer Hookups'],
    description: `Laminate flooring throughout, an attached garage, and a spacious fenced backyard highlight this charming 2-bedroom, 1-bathroom home in Oklahoma City.

The residence features an open living layout with low-maintenance laminate flooring extending through the living room and bedrooms. The equipped kitchen offers generous cabinet storage and dependable appliances.

Both bedrooms provide peaceful private quarters with natural light and closet capacity, centered around a full bathroom. The large fenced backyard offers a private outdoor setting for gatherings and recreation. Complete with an attached garage and quick access to I-235 for rapid commutes into Downtown Oklahoma City.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (1,039 sq. ft.)
• Durable laminate flooring throughout the home
• Attached garage for parking and extra storage
• Large fully fenced backyard
• Central air conditioning and gas heating
• Fast access to I-235 and Downtown OKC
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,200
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-BE8251BE',
    address: '1537 NE 20th St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73111',
    county: 'Oklahoma County',
    neighborhood: 'Creston Hills / Innovation District Corridor',
    lat: 35.4895,
    lng: -97.4812,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 1124,
    monthly_rent: 1200, // Reduced from 1300 to 1200
    security_deposit: 1200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Off-Street Concrete Driveway',
    garage_spaces: 0,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Refinished Original Hardwood Floors', 'New Carpet', 'Tile'],
    amenities: [
      'Recently Remodeled Interior with Original Arched Openings',
      'Refinished Original Hardwood Floors & Updated Lighting',
      'Remodeled Kitchen with New Cabinetry, Tile Backsplash & Dishwasher',
      'Completely Updated Bathroom with Tiled Tub/Shower Surround',
      'Newer HVAC, Water Heater & Updated Plumbing',
      'Fenced Yard and Off-Street Driveway Parking',
      'Proximity to OU Medical Center & State Capitol',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Washer/Dryer Hookups'],
    description: `Refinished original hardwood floors, charming architectural arched openings, and a completely remodeled kitchen highlight this 3-bedroom, 1-bathroom home in Oklahoma City.

The interior showcases freshly painted rooms and restored hardwood flooring in the living areas. The remodeled kitchen features new cabinetry, modern countertops, a tile backsplash, and appliances including a dishwasher. 

The fully updated bathroom boasts a new vanity, contemporary fixtures, and a tiled tub and shower surround. Additional infrastructure updates include newer HVAC, water heater, and plumbing. Outside, enjoy a fenced yard and a private driveway for off-street parking. Situated near the OU Health campus, Innovation District, and Downtown Oklahoma City.

Key Property Features:
• 3 Bedrooms, 1 Bathroom (1,124 sq. ft.)
• Refinished original hardwood floors and character archways
• Remodeled kitchen with new cabinets, tile backsplash, and dishwasher
• Fully updated bathroom with custom tiled tub surround
• Newer HVAC system and plumbing upgrades
• Fenced yard and private driveway parking
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,200 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  },
  {
    pipeline_id: 'PP-1C541BAF',
    address: '2110 N Kelley Ave',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73111',
    county: 'Oklahoma County',
    neighborhood: 'Innovation District / OU Health Center Area',
    lat: 35.4912,
    lng: -97.4934,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 1437,
    monthly_rent: 1199, // <= 1200 kept at 1199
    security_deposit: 1199,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Two Dedicated Onsite Parking Spaces',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Refinished Original Hardwood Floors', 'Tile'],
    amenities: [
      'Historic Charm Blended with Modern Remodel (1,437 Sq. Ft.)',
      'Refinished Original Hardwood Flooring Throughout',
      'Transformed Kitchen with New Countertops & Dishwasher',
      '2 Spacious Bedrooms plus Dedicated Office / 3rd Bedroom Space',
      'Two Dedicated Onsite Parking Spaces',
      'Short Walk to OMRF and OUHSC Medical Campuses',
      'Central Climate Control & In-Unit Laundry Connections',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Stove', 'Dishwasher', 'Garbage Disposal', 'Washer/Dryer Hookups'],
    description: `A blend of historic architectural charm and modern remodeling highlights this spacious 3-bedroom, 1-bathroom residence in Oklahoma City's dynamic Innovation District.

The home features refinished original hardwood floors extending through an open living room and dining area. The transformed kitchen showcases new countertops, modern cabinetry, and appliances including a stove, refrigerator, garbage disposal, and dishwasher.

The floor plan offers two spacious bedrooms plus a versatile office space that serves perfectly as a third bedroom or private studio. Additional features include central heat and air conditioning, in-unit laundry hookups, and two dedicated onsite parking spaces. Located a short walk from the Oklahoma Medical Research Foundation (OMRF), OU Health Sciences Center (OUHSC), and the State Capitol.

Key Property Features:
• 3 Bedrooms, 1 Bathroom (1,437 sq. ft.)
• Refinished original hardwood flooring with historic character
• Completely transformed kitchen with modern appliances and dishwasher
• Bonus office room / 3rd bedroom space
• Two dedicated onsite parking spaces
• Walking distance to OMRF and OU Health Sciences Center
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,199
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-59B5C4A0',
    address: '2820 Meadow Cliff Dr',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73159',
    county: 'Oklahoma County',
    neighborhood: 'Southwest Oklahoma City / OCCC Area',
    lat: 35.3945,
    lng: -97.5678,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1.5,
    half_bathrooms: 1,
    total_bathrooms: 2,
    square_footage: 1132,
    monthly_rent: 1200, // Reduced from 1299 to 1200
    security_deposit: 1200,
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
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Updated Plank Flooring', 'Tile'],
    amenities: [
      'Newly Remodeled 3-Bedroom Floor Plan with 1.5 Baths',
      'Spacious Living Room & Updated Kitchen',
      'Attached Garage & Off-Street Driveway',
      'Walking Distance to Oklahoma City Community College (OCCC)',
      'Easy Access to I-240 Freeway Corridor',
      'Central Climate Control System',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Washer/Dryer Hookups'],
    description: `A newly remodeled 3-bedroom, 1.5-bathroom layout, attached garage, and walkable location near Oklahoma City Community College highlight this Southwest OKC residence.

The home features an open, comfortable living room connecting to an updated kitchen with solid cabinetry and appliances for everyday cooking. 

Three bedrooms provide restful private quarters with closet storage, accompanied by a full bathroom and a convenient guest half bath. Complete with an attached garage and private driveway. Enjoy fast access to the I-240 freeway corridor, local shopping centers, and walkable proximity to Oklahoma City Community College.

Key Property Features:
• 3 Bedrooms, 1.5 Bathrooms (1,132 sq. ft.)
• Newly remodeled interior with updated flooring
• Kitchen with ample cabinetry and full appliances
• Attached garage and private driveway
• 1.5 bathrooms for added comfort
• Walkable to Oklahoma City Community College and close to I-240
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,200 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-86A192B9',
    address: '2927 NW 22nd St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73107',
    county: 'Oklahoma County',
    neighborhood: 'Uptown 23rd District / West Lawn',
    lat: 35.4923,
    lng: -97.5671,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 1051,
    monthly_rent: 1200, // Reduced from 1300 to 1200
    security_deposit: 1200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: '2-Car Covered Carport & Storage Building',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Full-Size Washer & Dryer Included',
    flooring: ['Hardwood & Ceramic Tile Flooring'],
    amenities: [
      'Prime Location in the Vibrant Uptown 23rd District',
      'Kitchen with Granite Countertops & Full Appliance Suite',
      'Full-Size Washer & Dryer Included in Unit',
      'Wood and Ceramic Tile Flooring Throughout',
      '2-Car Carport & Dedicated Storage Building on Property',
      'Covered Front Porch & Fully Fenced Yard',
      'Integrated Security System Hardware',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Washer', 'Dryer'],
    description: `Granite countertops, a full-size washer and dryer, a 2-car carport, and a covered front porch showcase this updated 2-bedroom, 1-bathroom home in Oklahoma City's Uptown 23rd district.

The interior welcomes you with wood and ceramic tile flooring throughout living areas and bedrooms. The modernized kitchen features granite countertops, sleek cabinetry, and a full appliance suite including full-size washer and dryer.

Both bedrooms provide peaceful quarters with ample natural lighting and closet storage, centered around an updated full bathroom. Outdoor amenities include a welcoming covered front porch, a fully fenced yard, a 2-car carport, and a convenient on-property storage building. Situated in the desirable Uptown 23rd district with easy access to popular cafes, entertainment, and downtown.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (1,051 sq. ft.)
• Updated interior with granite countertops and wood/tile flooring
• Full-size washer and dryer included in unit
• Covered front porch and fully fenced yard
• 2-car carport plus on-property storage building
• Prime Uptown 23rd district location
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,200 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  }
];

async function publishOkcBatch() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('  Choice Properties — Oklahoma City Pipeline Publishing');
  console.log(`  Processing ${OKC_PROPERTIES.length} Fully Enriched Properties`);
  console.log('  Pricing Target: $1,000 - $1,200 (Over 1200 reduced to 1200)');
  console.log('═════════════════════════════════════════════════════════════════\n');

  const rawPipelineData = JSON.parse(fs.readFileSync('scripts/okc_zillow_raw.json', 'utf8'));
  const rawMap = new Map(rawPipelineData.map(p => [p.id, p]));

  const publishedResults = [];
  const today = new Date().toISOString().split('T')[0];

  for (let i = 0; i < OKC_PROPERTIES.length; i++) {
    const item = OKC_PROPERTIES[i];
    const pipeId = item.pipeline_id;
    const rawProp = rawMap.get(pipeId);

    console.log(`[${i + 1}/${OKC_PROPERTIES.length}] Processing ${item.address} (${item.bedrooms}BR/${item.bathrooms}BA) - $${item.monthly_rent}/mo...`);

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

  fs.writeFileSync('scripts/published_okc_results.json', JSON.stringify(publishedResults, null, 2));

  console.log('\n═════════════════════════════════════════════════════════════════');
  console.log(`  Published ${publishedResults.length} properties successfully!`);
  console.log('═════════════════════════════════════════════════════════════════\n');

  publishedResults.forEach(r => {
    console.log(`${r.n}. ${r.address}, ${r.city}, ${r.state} ${r.zip} ($${r.rent.toLocaleString()}/mo | ${r.beds} Bed / ${r.baths} Bath) — ${r.url}`);
  });
}

publishOkcBatch().catch(console.error);
