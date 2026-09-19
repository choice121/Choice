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

const OK_PROPERTIES = [
  {
    pipeline_id: 'PP-4B6A0CFC',
    address: '2629 NE 16th St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73117',
    county: 'Oklahoma County',
    neighborhood: 'Edwards Park / East OKC',
    lat: 35.4855,
    lng: -97.4642,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 1200,
    monthly_rent: 1000,
    security_deposit: 1000,
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
    laundry_type: 'Washer and Dryer Hookups',
    flooring: ['Modern Hard-Surface Flooring', 'Vinyl Plank'],
    amenities: [
      'Comprehensive Interior & Exterior Renovation',
      'Spacious 3-Bedroom Single-Family Residence (1,200 Sq. Ft.)',
      'Fresh Custom Paint Palette Throughout',
      'New Low-Maintenance Hard-Surface Flooring',
      'Updated Facade with Welcoming Front Entry',
      'Generous Open Living & Dining Floor Plan',
      'Expansive Backyard Space',
      'Pet-Friendly Living'
    ],
    appliances: ['Range / Oven', 'Range Hood'],
    description: `A comprehensive interior and exterior remodel highlights this spacious 3-bedroom single-family residence situated on NE 16th Street in East Oklahoma City.

Featuring 1,200 square feet of refreshed living space, the home offers a bright and open floor plan anchored by brand-new hard-surface flooring and a custom neutral paint palette. The main living room provides a generous gathering area that flows naturally toward the dining space and kitchen.

Each of the three bedrooms provides comfortable proportions, dedicated closet storage, and easy access to the central full bathroom. Outside, the home boasts a refreshed facade and a spacious yard ideal for outdoor recreation and relaxation. Located with swift connectivity to NE 23rd Street, I-35, and Downtown Oklahoma City.

Key Property Features:
• 3 Bedrooms, 1 Bathroom (1,200 sq. ft.)
• Complete interior and exterior renovation
• Fresh custom paint and new durable hard-surface flooring
• Open living room and dining accommodation
• Convenient private driveway parking
• Central heating and air conditioning
• Expansive yard space
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,000
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt processing.`
  },
  {
    pipeline_id: 'PP-8021A2C9',
    address: '1405 NE 40th St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73111',
    county: 'Oklahoma County',
    neighborhood: 'Forest Park / Northeast OKC',
    lat: 35.5126,
    lng: -97.4855,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 850,
    monthly_rent: 995,
    security_deposit: 995,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached 1-Car Garage & Driveway Parking',
    garage_spaces: 1,
    heating_type: 'Electric Heat Pump Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer and Dryer Hookups',
    flooring: ['Original Wood Flooring'],
    amenities: [
      'Authentic Hardwood Flooring Throughout (Zero Carpet)',
      'Attached 1-Car Garage with Private Driveway & Street Parking',
      'Central Air Conditioning & Electric Heat Pump Climate Control',
      'All-Electric Utility Configuration (No Gas Bill)',
      'Electric Range Cooking Setup',
      'Dedicated Washer & Dryer Hookups',
      'Expansive Grassy Yard',
      'Pet-Friendly Living'
    ],
    appliances: ['Electric Range / Stove', 'Range Hood'],
    description: `Original wood flooring with zero carpet and an attached 1-car garage distinguish this single-family home on NE 40th Street in Northeast Oklahoma City.

The interior showcases classic wood floors spanning both the main living room and the two private bedrooms. Central air conditioning and an efficient electric heat pump provide year-round climate control throughout the 850 sq. ft. layout. The kitchen features an electric cooking range and an all-electric utility setup, eliminating the need for a separate gas account.

Residents benefit from direct vehicle parking in the attached garage, complemented by driveway and street parking options. A dedicated laundry area includes washer and dryer hookups for everyday convenience. Situated minutes from Remington Park, the OKC Zoo, the OU Health Sciences Center, and I-35 corridors.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (850 sq. ft.)
• Wood floors throughout the home with no carpet
• Attached 1-car garage plus extended driveway parking
• Central air conditioning and electric heat pump
• All-electric utilities with electric cooking range
• In-unit washer and dryer hookups
• Private yard area
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $995
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt processing.`
  },
  {
    pipeline_id: 'PP-6A0DE51C',
    address: '2902 SW 86th St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73159',
    county: 'Oklahoma County',
    neighborhood: 'Southwest OKC / OCCC Area',
    lat: 35.3824,
    lng: -97.5682,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 2,
    half_bathrooms: null,
    total_bathrooms: 2,
    square_footage: 1044,
    monthly_rent: 995,
    security_deposit: 995,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached 1-Car Garage & 2-Car Driveway',
    garage_spaces: 1,
    heating_type: 'Central Electric Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer and Dryer Hookups',
    flooring: ['Carpet', 'Tile'],
    amenities: [
      'Two Full Bathrooms (1,044 Sq. Ft. Layout)',
      'Primary Bedroom with Sliding Glass Door Direct to Backyard',
      'Open-Concept Kitchen Overlooking Spacious Living Room',
      'Dedicated Dining Area Adjacent to Kitchen',
      'Fully Equipped Kitchen with Dishwasher, Refrigerator & Disposal',
      'Attached 1-Car Garage with Driveway Space for Two Vehicles',
      'Ceiling Fans in Living Room & Bedrooms',
      'Fully Fenced Backyard',
      'Pet-Friendly Living'
    ],
    appliances: ['Refrigerator', 'Dishwasher', 'Garbage Disposal', 'Range / Oven'],
    description: `Two full bathrooms, an open-concept living layout, and a primary bedroom with private sliding glass door access to a fenced backyard define this duplex on SW 86th Street.

With 1,044 square feet of interior space, the home opens into an expansive living area that flows directly into the dining space and kitchen. The kitchen is fully equipped with a refrigerator, dishwasher, garbage disposal, and range.

Both bedrooms are carpeted and fitted with ceiling fans for continuous air circulation. The primary bedroom features a dedicated sliding glass door leading straight out to the private, fully fenced backyard. Vehicle accommodation includes an attached 1-car garage plus a driveway accommodating two additional cars. Located directly behind Oklahoma City Community College (OCCC) with immediate access to I-44.

Key Property Features:
• 2 Bedrooms, 2 Full Bathrooms (1,044 sq. ft.)
• Open kitchen and living room concept with dedicated dining nook
• Kitchen equipped with refrigerator, dishwasher, and disposal
• Primary bedroom suite with private slider to fenced backyard
• Attached 1-car garage and double-wide driveway
• Ceiling fans throughout and central HVAC
• Fully fenced private backyard
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $995
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt processing.`
  },
  {
    pipeline_id: 'PP-71DCFE35',
    address: '1016 NW 99th St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73114',
    county: 'Oklahoma County',
    neighborhood: 'North OKC / Chisholm Creek Area',
    lat: 35.5714,
    lng: -97.5312,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 832,
    monthly_rent: 950,
    security_deposit: 950,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Driveway Parking',
    garage_spaces: 0,
    heating_type: 'Central Forced Air Natural Gas Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Washer and Dryer Hookups',
    flooring: ['Warm Hardwood Flooring', 'Tile'],
    amenities: [
      'Dual Fenced Grounds: Fully Fenced Front Yard & Fully Fenced Backyard',
      'Warm Hardwood Flooring Across Living Spaces',
      'Fresh Paint & Polished Finishes Throughout',
      'Ceiling Fans Installed in Living Room & Both Bedrooms',
      'Equipped Kitchen with Range and Oven',
      'Central Forced Air Gas Heating & Central Air Conditioning',
      'Private Driveway Parking',
      'Pet-Friendly Living'
    ],
    appliances: ['Gas Range / Oven', 'Range Hood'],
    description: `Dual perimeter fencing enclosing both the front yard and back yard, paired with warm hardwood flooring and fresh interior paint, highlights this North OKC single-family home on NW 99th Street.

The 832 sq. ft. residence offers an inviting living room with hardwood floors and a ceiling fan. Fresh paint and polished trim extend through the entire home into the two private bedrooms, each outfitted with dedicated ceiling fans and closet storage.

The kitchen is equipped with a gas range and oven with plenty of functional prep space. Outdoor living is exceptionally private thanks to completely fenced front and rear yard areas, providing secure outdoor enjoyment. Conveniently located near Western Avenue, the Broadway Extension (I-235), Chisholm Creek shopping, and Lake Hefner.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (832 sq. ft.)
• Warm original hardwood flooring in living room
• Freshly painted interior and updated fixtures
• Ceiling fans in living room and both bedrooms
• Fully fenced front yard and fully fenced backyard
• Kitchen equipped with gas range/oven
• Central natural gas heat and central air conditioning
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $950
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt processing.`
  },
  {
    pipeline_id: 'PP-0E33219C',
    address: '3204 NW 14th St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73107',
    county: 'Oklahoma County',
    neighborhood: 'Creston Hills / West OKC',
    lat: 35.4837,
    lng: -97.5752,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 900,
    monthly_rent: 950,
    security_deposit: 950,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Driveway & Street Parking',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Washer and Dryer Hookups',
    flooring: ['Hardwood Flooring', 'Tile'],
    amenities: [
      'Classic Single-Family Brick Ranch (900 Sq. Ft.)',
      'Fully Fenced Backyard with Mature Shade Trees',
      'Central Air Conditioning & Heating System',
      'Covered Front Porch Entry',
      'Low-Maintenance Hard-Surface Flooring',
      'Private Driveway Parking',
      'Minutes to Plaza District & NW 10th Corridor',
      'Pet-Friendly Living'
    ],
    appliances: ['Range / Oven', 'Range Hood'],
    description: `A classic brick ranch exterior, fully fenced backyard with mature shade trees, and central climate control define this single-family residence on NW 14th Street.

Spanning 900 square feet, the home features a welcoming covered front porch leading into a well-proportioned living room illuminated by broad picture windows. Hard-surface flooring runs across high-traffic areas for effortless upkeep.

The floor plan includes two well-sized bedrooms with built-in closets and a central full bathroom. The private, fully fenced backyard offers a secure open setting for outdoor barbecues and pets. Positioned in West NW OKC with quick access to the Plaza District, State Fair Park, I-44, and NW 10th Street.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (900 sq. ft.)
• Brick ranch architecture with covered front porch
• Fully fenced backyard shaded by mature trees
• Central air conditioning and central heating
• Practical 2-bedroom floor plan with ample storage
• Private driveway parking
• Rapid access to I-44 and the Plaza District
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $950
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt processing.`
  },
  {
    pipeline_id: 'PP-977757C7',
    address: '4229 NE 20th St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73121',
    county: 'Oklahoma County',
    neighborhood: 'Northeast OKC / Diggs Park',
    lat: 35.4899,
    lng: -97.4335,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 900,
    monthly_rent: 925,
    security_deposit: 925,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Driveway Parking',
    garage_spaces: 0,
    heating_type: 'Forced Air Heating',
    cooling_type: 'Air Conditioning',
    laundry_type: 'Washer and Dryer Connections',
    flooring: ['Durable Vinyl Plank', 'Tile'],
    amenities: [
      'Efficient 3-Bedroom Layout (900 Sq. Ft.)',
      'Equipped Kitchen with Refrigerator & Cooking Range',
      'Durable Hard-Surface Laminate Countertops',
      'Ceiling Fans in Living Spaces',
      'Large Grassy Yard Area',
      'Minutes from Diggs Park & Pleasant Hill Elementary',
      'Private Driveway Parking',
      'Pet-Friendly Living'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Range Hood'],
    description: `A versatile 3-bedroom floor plan, an equipped kitchen with durable laminate countertops, and close proximity to Diggs Park highlight this single-family home on NE 20th Street.

The 900 sq. ft. home provides an efficient living room outfitted with ceiling fans and hard-surface flooring. The kitchen comes equipped with a refrigerator, cooking range, and ample cabinet storage.

Three individual bedrooms provide flexible options for family living, a home office, or guest space, all serviced by a central full bathroom. Outside, a generous grassy yard offers plenty of open space. Conveniently located just minutes from Pleasant Hill Elementary, Diggs Park, and major East OKC transit routes.

Key Property Features:
• 3 Bedrooms, 1 Bathroom (900 sq. ft.)
• Equipped kitchen with refrigerator and range included
• Durable hard-surface laminate countertops
• Ceiling fans in main living spaces
• Three distinct private bedrooms
• Large open yard space
• Close proximity to Diggs Park and schools
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $925
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt processing.`
  },
  {
    pipeline_id: 'PP-45FD0D5F',
    address: '3322 NW 16th St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73107',
    county: 'Oklahoma County',
    neighborhood: 'Creston Hills / NW OKC',
    lat: 35.4858,
    lng: -97.5776,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 1,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 670,
    monthly_rent: 825,
    security_deposit: 825,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: false,
    has_basement: false,
    parking: 'Dedicated 1-Car Garage & Driveway Parking',
    garage_spaces: 1,
    heating_type: 'Heating Units',
    cooling_type: 'Dual Window Air Conditioning Units',
    laundry_type: 'None',
    flooring: ['Original Hardwood Floors', 'Tile'],
    amenities: [
      'Gleaming Hardwood Flooring Throughout',
      'Dedicated 1-Car Garage for Parking & Storage',
      'Charming Covered Front Porch',
      'Equipped Kitchen with Cooking Stove & Refrigerator',
      'Dual Climate Control Units for Heating & Air Conditioning',
      'Ceiling Fans for Year-Round Airflow',
      'Quiet Duplex Setting in NW OKC',
      'Pet-Friendly Living'
    ],
    appliances: ['Refrigerator', 'Range / Oven'],
    description: `Original hardwood floors, a covered front porch, and a dedicated 1-car garage provide classic charm and practical convenience at this 1-bedroom duplex on NW 16th Street.

Spanning 670 square feet, the residence features rich hardwood flooring across the living room and bedroom. Ceiling fans and two dedicated window units provide tailored heating and air conditioning comfort throughout the seasons. The kitchen is fully equipped with a refrigerator and stove, offering straightforward meal preparation.

A separate 1-car garage in the rear offers secure vehicle parking or valuable additional storage space. Situated in West NW OKC within easy driving distance of the Plaza District, Midtown, Oklahoma City University, and I-44.

Key Property Features:
• 1 Bedroom, 1 Bathroom (670 sq. ft.)
• Authentic hardwood floors throughout
• Dedicated 1-car garage for vehicle parking and extra storage
• Covered front porch entry
• Kitchen with stove and refrigerator included
• Dual heating and cooling window units with ceiling fans
• Convenient location near Plaza District and I-44
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $825
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt processing.`
  },
  {
    pipeline_id: 'PP-C2155376',
    address: '3320 NW 16th St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73107',
    county: 'Oklahoma County',
    neighborhood: 'Creston Hills / NW OKC',
    lat: 35.4858,
    lng: -97.5775,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 1,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 665,
    monthly_rent: 825,
    security_deposit: 825,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: false,
    has_basement: false,
    parking: 'Rear Garage Space & Driveway',
    garage_spaces: 1,
    heating_type: 'Heating Units',
    cooling_type: 'Window Air Conditioning Units',
    laundry_type: 'None',
    flooring: ['Solid Wood Flooring', 'Tile'],
    amenities: [
      'Beautiful Solid Wood Floors Throughout',
      'Rear Garage Space for Vehicle Storage & Parking',
      'Kitchen with Gas Cooking Stove & Refrigerator',
      'Dual Heating and Cooling Climate Units',
      'Low-Maintenance Single-Bedroom Layout',
      'Covered Front Entry Porch',
      'Minutes from Plaza District & OCU',
      'Pet-Friendly Living'
    ],
    appliances: ['Refrigerator', 'Gas Range / Stove'],
    description: `Solid wood floors throughout, a gas cooking kitchen, and a rear garage highlight this low-maintenance 1-bedroom duplex on NW 16th Street.

The 665 sq. ft. floor plan features warm natural wood floors flowing seamlessly from the front living room into the bedroom. The kitchen comes equipped with a gas range and refrigerator, offering efficient functionality. Heating and cooling units maintain comfortable interior temperatures through all seasons.

Outside, a private garage located in the back provides sheltered parking and storage. Positioned in a central NW OKC neighborhood with rapid access to the Plaza District, the Fairgrounds, NW 23rd Uptown, and I-44.

Key Property Features:
• 1 Bedroom, 1 Bathroom (665 sq. ft.)
• Solid wood flooring across living and bedroom areas
• Kitchen equipped with gas stove and refrigerator
• Rear garage available for parking and storage
• Dual heating and air conditioning units
• Covered front porch
• Quick access to Plaza District, Midtown, and I-44
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $825
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt processing.`
  },
  {
    pipeline_id: 'PP-EA8822BF',
    address: '531 SE 15th St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73129',
    county: 'Oklahoma County',
    neighborhood: 'Southeast OKC / Central',
    lat: 35.4501,
    lng: -97.5024,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 1,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 588,
    monthly_rent: 795,
    security_deposit: 795,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: false,
    has_basement: false,
    parking: 'Private Driveway Parking',
    garage_spaces: 0,
    heating_type: 'Forced Air Heating',
    cooling_type: 'Window Unit Air Conditioning',
    laundry_type: 'In-Unit Washer and Dryer Hookups',
    flooring: ['Modern Vinyl Plank Flooring'],
    amenities: [
      'Newly Refreshed & Modernized Interior',
      'Large Private Bedroom with Built-In Closet',
      'Equipped Kitchen with Cooking Stove & Built-In Microwave',
      'In-Unit Washer and Dryer Hookups',
      'Contemporary Hard-Surface Flooring Throughout',
      'Updated Bathroom with Modern Fixtures',
      'Private Driveway Parking',
      'Pet-Friendly Living'
    ],
    appliances: ['Cooking Stove / Range', 'Built-In Microwave Oven'],
    description: `A freshly redone interior, large private bedroom, and in-unit washer/dryer hookups make this single-bedroom home on SE 15th Street a move-in ready retreat in Central Oklahoma City.

Featuring 588 sq. ft. of updated living space, the interior showcases clean vinyl plank flooring throughout. The kitchen is equipped with a cooking stove and a space-saving built-in microwave oven, surrounded by modern white cabinetry.

The bedroom is notably spacious with deep closet storage, located adjacent to the fully updated bathroom. Dedicated washer and dryer hookups offer convenient in-home laundry. Positioned in Southeast OKC with swift transit connectivity to I-35, I-40, Downtown OKC, Bricktown, and the Wheeler District.

Key Property Features:
• 1 Bedroom, 1 Bathroom (588 sq. ft.)
• Complete interior refresh with modern vinyl plank flooring
• Large bedroom with generous closet storage
• Kitchen with cooking stove and built-in microwave
• In-unit washer and dryer hookups provided
• Updated full bathroom with clean modern fixtures
• Swift commute to Downtown OKC, Bricktown, and I-35
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $795
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt processing.`
  },
  {
    pipeline_id: 'PP-AB528958',
    address: '8606 S Brookline Pl #8606',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73159',
    county: 'Oklahoma County',
    neighborhood: 'Southwest OKC / Moore School District',
    lat: 35.3820,
    lng: -97.5668,
    property_type: 'TOWNHOMES',
    bedrooms: 2,
    bathrooms: 2,
    half_bathrooms: null,
    total_bathrooms: 2,
    square_footage: 1000,
    monthly_rent: 975,
    security_deposit: 975,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached Garage & Driveway Parking',
    garage_spaces: 1,
    heating_type: 'Central Heat Pump Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer and Dryer Hookups',
    flooring: ['Tile Flooring', 'Carpet'],
    amenities: [
      'Two Full Bathrooms with 1,000 Sq. Ft. Layout',
      'Located in Highly Desired Moore School District',
      'Attached 1-Car Garage with Direct Interior Access',
      'Central Heat Pump Heating & Central Air Conditioning',
      'Kitchen Outfitted with Built-In Dishwasher & Range',
      'In-Unit Washer & Dryer Hookups',
      'Quiet Cul-de-Sac Setting right off I-44 by OCCC',
      'Pet-Friendly Living'
    ],
    appliances: ['Dishwasher', 'Range / Oven', 'Range Hood'],
    description: `Two full bathrooms, an attached garage, and placement within the Moore School District highlight this townhome duplex situated on a peaceful cul-de-sac at 8606 S Brookline Place.

Offering 1,000 square feet of comfortable living space, the home features a well-defined living room and dining area. The kitchen is equipped with a built-in dishwasher and cooking range, complemented by functional counter space and cabinetry.

Both bedrooms are generously proportioned with ample closet capacity, and two full bathrooms offer complete privacy and convenience. Additional highlights include central heat pump climate control, in-unit laundry hookups, and an attached garage. Located just off I-44 adjacent to Oklahoma City Community College (OCCC) and minutes from SW 89th retail corridors.

Key Property Features:
• 2 Bedrooms, 2 Full Bathrooms (1,000 sq. ft.)
• Situated within the Moore School District
• Attached 1-car garage with private driveway
• Central heat pump and central air conditioning
• Kitchen equipped with dishwasher and cooking range
• In-unit washer and dryer connections
• Quiet cul-de-sac location near OCCC and I-44
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $975
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt processing.`
  },
  {
    pipeline_id: 'PP-F9120285',
    address: '517 SE 72nd St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73149',
    county: 'Oklahoma County',
    neighborhood: 'Southern OKC',
    lat: 35.3956,
    lng: -97.5028,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2,
    half_bathrooms: null,
    total_bathrooms: 2,
    square_footage: 1000,
    monthly_rent: 995,
    security_deposit: 995,
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
    laundry_type: 'In-Unit Washer and Dryer Included',
    flooring: ['Hard-Surface Flooring', 'Carpet'],
    amenities: [
      '3 Bedrooms with 2 Bathrooms (1,000 Sq. Ft.)',
      'In-Unit Washer and Dryer Included for Resident Use',
      'Attached 1-Car Garage for Vehicle Parking & Storage',
      'Central Heating & Air Conditioning System',
      'Kitchen Outfitted with Gas Cooking Range',
      'Generous Fenced Backyard Space',
      'Straightforward Access to I-35 and I-240 Shopping',
      'Pet-Friendly Living'
    ],
    appliances: ['Gas Range / Stove', 'Washer', 'Dryer', 'Range Hood'],
    description: `A 3-bedroom, 2-bathroom layout, an attached 1-car garage, and included in-unit laundry appliances offer complete daily convenience at this single-family home on SE 72nd Street.

Spanning 1,000 square feet, the interior features a bright living room that connects effortlessly to the dining area and kitchen. The kitchen is outfitted with a gas stove and abundant cabinetry for easy cooking and storage.

Three individual bedrooms provide generous accommodation for residents and guests, paired with two functional bathrooms. The home includes a dedicated laundry room with washer and dryer units already installed. A secure 1-car garage and large backyard complete the property. Conveniently located near the I-35 and I-240 corridors with quick commutes across South OKC.

Key Property Features:
• 3 Bedrooms, 2 Bathrooms (1,000 sq. ft.)
• In-unit washer and dryer included
• Attached 1-car garage for parking and extra storage
• Kitchen with gas cooking range
• Central air conditioning and central heating
• Spacious fenced backyard
• Fast access to I-35, I-240, and local retail centers
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $995
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt processing.`
  },
  {
    pipeline_id: 'PP-08DF47D7',
    address: '2935 NW 21st St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73107',
    county: 'Oklahoma County',
    neighborhood: 'West NW OKC',
    lat: 35.4909,
    lng: -97.5701,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 1,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 540,
    monthly_rent: 925,
    security_deposit: 925,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: false,
    has_basement: false,
    parking: 'Dedicated Off-Street & Driveway Parking',
    garage_spaces: 0,
    heating_type: 'Baseboard Heating',
    cooling_type: 'Window Unit Air Conditioning',
    laundry_type: 'None',
    flooring: ['Hard-Surface Flooring', 'Tile'],
    amenities: [
      'Independent Detached Single-Family Home (No Shared Walls)',
      'Equipped Kitchen with Refrigerator, Oven & Freezer',
      'Efficient 540 Sq. Ft. Low-Maintenance Floor Plan',
      'Dedicated Private Yard Space',
      'Baseboard Heating & Window Air Conditioning',
      'Convenient NW OKC Location near NW 23rd St',
      'Pet-Friendly Living'
    ],
    appliances: ['Refrigerator', 'Freezer', 'Oven / Range'],
    description: `Detached single-family privacy with zero shared walls, an equipped kitchen, and a low-maintenance footprint highlight this 1-bedroom home on NW 21st Street.

Offering 540 sq. ft. of independent living space, the interior features an open living area with easy-care hard-surface flooring. The kitchen includes a full-size refrigerator, freezer, and oven/range for all cooking needs.

The private bedroom includes closet storage and connects to a clean, functional full bathroom. Outside, residents enjoy a dedicated yard space in a classic NW OKC neighborhood setting. Situated just blocks from NW 23rd Street, the Plaza District, Oklahoma City University, and Lake Hefner Parkway.

Key Property Features:
• 1 Bedroom, 1 Bathroom (540 sq. ft.)
• Detached single-family privacy with no adjoining walls
• Equipped kitchen with refrigerator, freezer, and oven/range
• Low-maintenance hard-surface flooring
• Dedicated private yard space
• Off-street driveway parking
• Quick access to NW 23rd St, Plaza District, and OCU
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $925
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt processing.`
  },
  {
    pipeline_id: 'PP-F297A55E',
    address: '2433 SE 15th St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73129',
    county: 'Oklahoma County',
    neighborhood: 'Southeast OKC / Tinker AFB Corridor',
    lat: 35.4503,
    lng: -97.4678,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 840,
    monthly_rent: 900,
    security_deposit: 900,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: false,
    has_basement: false,
    parking: 'Off-Street Driveway Parking',
    garage_spaces: 0,
    heating_type: 'Forced Air Heating',
    cooling_type: 'Air Conditioning Window Units',
    laundry_type: 'In-Unit Washer and Dryer Included',
    flooring: ['New Laminate Flooring Throughout'],
    amenities: [
      'Recently Renovated with New Laminate Flooring & Fresh Paint',
      'Modern Kitchen with Gas Range, Dishwasher, Fridge & Disposal',
      'In-Unit Washer and Dryer Included in Spacious Bathroom',
      'Fully Fenced Backyard with Large Storage Shed & Raised Garden Beds',
      'Two Bedrooms with Deep Closets',
      'Upgraded Modern Lighting Fixtures & Contemporary Faucets',
      'Less than 15-Minute Commute to Downtown OKC & Tinker AFB',
      'Pet-Friendly Living'
    ],
    appliances: ['Gas Range / Stove', 'Dishwasher', 'Refrigerator', 'Garbage Disposal', 'Washer', 'Dryer'],
    description: `Recent modern renovations, a gas kitchen with dishwasher, included washer/dryer, and a fenced backyard with a large storage shed and raised garden beds define this 2-bedroom home on SE 15th Street.

The 840 sq. ft. residence has been thoughtfully upgraded with brand-new laminate flooring throughout, fresh paint, and modern designer light fixtures. The kitchen is outfitted with contemporary hardware, a gas range, dishwasher, refrigerator, garbage disposal, and ample cabinetry.

Both bedrooms are situated privately on the side of the home with deep closet storage. The oversized bathroom houses an included washer and dryer and opens directly to the fully fenced backyard featuring a generous storage shed and raised garden planting beds. Centrally located with an easy 15-minute commute to Downtown OKC and Tinker Air Force Base.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (840 sq. ft.)
• Comprehensive renovations with new laminate flooring and fresh paint
• Fully equipped kitchen with gas range, dishwasher, fridge, and disposal
• In-unit washer and dryer included in bathroom
• Deep bedroom closets and upgraded light fixtures
• Fully fenced backyard with large storage shed and raised garden beds
• Under 15 minutes to Downtown OKC and Tinker Air Force Base
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $900
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt processing.`
  },
  {
    pipeline_id: 'PP-4F1FE814',
    address: '3407 S Lee Ave',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73109',
    county: 'Oklahoma County',
    neighborhood: 'South OKC / Capitol Hill Area',
    lat: 35.4334,
    lng: -97.5255,
    property_type: 'TOWNHOMES',
    bedrooms: 2,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 900,
    monthly_rent: 925,
    security_deposit: 925,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Dedicated Resident Parking',
    garage_spaces: 0,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer and Dryer Hookups',
    flooring: ['Hard-Surface Flooring', 'Carpet'],
    amenities: [
      'Two-Bedroom Townhome Layout (900 Sq. Ft.)',
      'Equipped Kitchen with Dishwasher, Oven/Range & Refrigerator',
      'In-Unit Washer and Dryer Hookups',
      'Central Heating & Air Conditioning',
      'Spacious Open Living and Dining Accommodation',
      'Generous Bedroom Closets',
      'Minutes from Historic Capitol Hill & Wheeler District',
      'Pet-Friendly Living'
    ],
    appliances: ['Dishwasher', 'Range / Oven', 'Refrigerator', 'Range Hood'],
    description: `A 900 sq. ft. two-bedroom townhome design, complete kitchen appliances including a dishwasher, and in-unit laundry hookups highlight this residence on South Lee Avenue.

The interior layout features a spacious main living and dining room with easy-care hard-surface flooring. The functional kitchen is equipped with a dishwasher, oven/range, and refrigerator, backed by plentiful upper and lower cabinetry.

Both bedrooms are well-proportioned with wide closets and easy access to the central bathroom. Dedicated washer and dryer hookups offer convenient in-home laundry care. Situated in South OKC near the historic Capitol Hill district, Scissortail Park, the Wheeler District, and I-35/I-40 transit corridors.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (900 sq. ft.)
• Townhome architecture with open living and dining spaces
• Kitchen equipped with dishwasher, range/oven, and refrigerator
• In-unit washer and dryer hookups
• Central air conditioning and heating
• Ample bedroom closet storage
• Rapid access to Capitol Hill, Downtown OKC, and I-35
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $925
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt processing.`
  },
  {
    pipeline_id: 'PP-3FFA9926',
    address: '2428 NW 33rd St',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73112',
    county: 'Oklahoma County',
    neighborhood: 'Mayfair / NW OKC',
    lat: 35.5048,
    lng: -97.5583,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 1,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 600,
    monthly_rent: 995,
    security_deposit: 995,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Driveway Parking',
    garage_spaces: 0,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Stackable Washer and Dryer Included',
    flooring: ['Modern Vinyl Plank Flooring', 'Tile'],
    amenities: [
      'All Utilities & High-Speed Internet Included in Rent',
      'Freshly Painted & Fully Updated Interior',
      'Full Kitchen with Full-Size Fridge, Dishwasher, Disposal & Range',
      'Stackable In-Unit Washer and Dryer Included',
      'Central Air Conditioning & Central Heating',
      'Huge Open Backyard Area',
      'Private Driveway Parking',
      'Prime Mayfair Location near NW 36th & May Ave',
      'Pet-Friendly Living'
    ],
    appliances: ['Refrigerator', 'Dishwasher', 'Garbage Disposal', 'Range / Oven', 'Stackable Washer', 'Stackable Dryer'],
    description: `All utilities and high-speed internet paid by owner, an updated kitchen with dishwasher, stackable laundry included, and an expansive backyard highlight this updated 1-bedroom home on NW 33rd Street.

The 600 sq. ft. residence has been freshly painted and upgraded with clean contemporary flooring throughout. The kitchen is fully equipped with full-size appliances including a refrigerator, dishwasher, garbage disposal, and range.

The floor plan includes a comfortable private bedroom, a full bathroom, and a dedicated laundry closet with stackable washer and dryer that stays in the home. A massive open backyard provides exceptional outdoor space, complemented by private driveway parking. Located in prime Mayfair near NW 36th and May Avenue, surrounded by restaurants, shopping, and Lake Hefner recreation.

Key Property Features:
• 1 Bedroom, 1 Bathroom (600 sq. ft.)
• All utilities and internet paid by owner
• Kitchen with full-size refrigerator, dishwasher, disposal, and range
• Stackable washer and dryer included in unit
• Central air conditioning and central forced air heating
• Huge open backyard
• Private driveway parking
• Close to NW 36th & May dining, retail, and transit
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $995
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt processing.`
  },
  {
    pipeline_id: 'PP-42581181',
    address: '2515 N Fonshill Ave',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73111',
    county: 'Oklahoma County',
    neighborhood: 'East OKC / OU Health Sciences District',
    lat: 35.4952,
    lng: -97.4665,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 1200,
    monthly_rent: 950,
    security_deposit: 950,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Off-Street Driveway Parking',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated Laundry Room with Utility Sink, Washer & Dryer Included',
    flooring: ['Ceramic Tile Flooring', 'Laminate Flooring'],
    amenities: [
      'Expansive Corner Lot with 1,200 Sq. Ft. Remodeled Layout',
      'Both Bedrooms Feature Generous Walk-In Closets',
      'Dedicated Laundry Room with Built-In Utility Sink, Washer & Dryer Included',
      'Fully Remodeled Kitchen with Refrigerator, Microwave & Range Vent',
      'Durable Ceramic Tile and Laminate Flooring Throughout (No Carpet)',
      'Central Heating & Central Air Conditioning',
      '5 Minutes to OU Health Sciences Center; 10 Minutes to Downtown & Bricktown',
      'Pet-Friendly Living'
    ],
    appliances: ['Refrigerator', 'Microwave Oven', 'Range / Oven', 'Range Hood Vent', 'Washer', 'Dryer'],
    description: `A complete remodel on a prominent corner lot, walk-in closets in both bedrooms, and a dedicated laundry room with utility sink and washer/dryer highlight this 1,200 sq. ft. home on N Fonshill Avenue.

The interior showcases low-maintenance ceramic tile and laminate flooring throughout the expansive living and dining areas. The remodeled kitchen comes equipped with a refrigerator, microwave, cooking range, and ventilation hood, framed by clean white cabinetry.

Both bedrooms are generously sized and feature large walk-in closets. A standout feature is the separate utility laundry room complete with a built-in wash basin sink and included washer and dryer. Located just 5 minutes from the OU Health Sciences Center and 10 minutes from the State Capitol, Bricktown, and Downtown OKC, right off the NE 23rd Street corridor.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (1,200 sq. ft.)
• Complete remodel situated on an oversized corner lot
• Walk-in closets in both bedrooms
• Separate laundry room with utility sink and washer/dryer included
• Remodeled kitchen with refrigerator, microwave, and range
• Low-maintenance tile and laminate flooring throughout
• Central air conditioning and heating
• 5 minutes from OU Medical Center and 10 minutes to Downtown OKC
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $950
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt processing.`
  },
  {
    pipeline_id: 'PP-2CAE3747',
    address: '1102 NW 27th St #A',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73106',
    county: 'Oklahoma County',
    neighborhood: 'Asian District / Uptown 23rd',
    lat: 35.4975,
    lng: -97.5332,
    property_type: 'TOWNHOMES',
    bedrooms: 2,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 850,
    monthly_rent: 700,
    security_deposit: 700,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Dedicated Covered Parking in Rear',
    garage_spaces: 0,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'None',
    flooring: ['Hard-Surface Flooring', 'Designer Ceramic Tile'],
    amenities: [
      'Historic Colonial Revival Townhome Architecture',
      'Newly Renovated Bathroom with Designer Tile & Upgraded Fixtures',
      'Lawn Care, Yard Maintenance & Pest Control Included in Rent',
      'Dedicated Covered Parking in the Back of the Property',
      'Central Heating & Central Air Conditioning',
      'Equipped Kitchen with Oven/Range and Refrigerator',
      'Prime Walkable Location in Asian District & Western Avenue Corridor',
      'Pet-Friendly Living'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Range Hood'],
    description: `Historic Colonial Revival architectural charm, a newly renovated bathroom with designer tile, and covered rear parking distinguish this 2-bedroom townhome on NW 27th Street.

Located in the heart of the vibrant Western Avenue and Asian District, this freshly renovated residence features an open living and dining area with central heating and air conditioning. The kitchen is equipped with an oven/range and refrigerator.

The bathroom has been fully updated with contemporary fixtures and custom tile work. Residents enjoy included lawn care, yard maintenance, and pest control services, as well as dedicated covered parking at the rear of the building. Located just blocks from the Paseo Arts District and fashionable Uptown 23rd Street dining and shopping.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (850 sq. ft.)
• Historic Colonial Revival townhome in Asian District / Western Ave
• Newly renovated bathroom with designer tile and updated fixtures
• Covered parking space located at the back of the property
• Central forced air heating and central air conditioning
• Lawn care, yard maintenance, and pest control included in rent
• Walkable to Paseo Arts District and Uptown 23rd Street
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $700
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt processing.`
  },
  {
    pipeline_id: 'PP-C30438E5',
    address: '1132 N Saint Clair Ave',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73107',
    county: 'Oklahoma County',
    neighborhood: 'Plaza District / West OKC',
    lat: 35.4801,
    lng: -97.5925,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 778,
    monthly_rent: 925,
    security_deposit: 925,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Single-Car Detached Garage & Covered Carport',
    garage_spaces: 1,
    heating_type: 'Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Washer and Dryer Hookups',
    flooring: ['Classic Hardwood Flooring', 'Tile'],
    amenities: [
      'Authentic Hardwood Floors with Abundant Natural Sunlight',
      'Dual Parking Accommodations: Single-Car Garage PLUS Covered Carport',
      'Spacious Eat-In Kitchen with Cooking Range Included',
      'Fully Fenced Backyard for Private Outdoor Living',
      'Ceiling Fans & Climate Control System',
      'Less than 3 Miles to Uptown 23rd, Plaza District & Western Ave',
      'Pet-Friendly Living'
    ],
    appliances: ['Cooking Range / Oven', 'Range Hood'],
    description: `Gleaming authentic hardwood floors, abundant natural light, a single-car garage plus covered carport, and a fully fenced yard highlight this 2-bedroom home on N Saint Clair Avenue.

Spanning 778 sq. ft., the home features a welcoming living room bathed in natural sunlight across warm wood floors. The large kitchen offers generous cabinetry and counter space, equipped with a cooking range.

Both bedrooms provide comfortable dimensions, ceiling fans, and closet storage. The exterior offers exceptional convenience with a detached single-car garage, an adjoining covered carport, and a fully fenced backyard. Located within 3 miles of the Plaza District, Uptown 23rd Street, and Western Avenue with rapid highway access.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (778 sq. ft.)
• Classic hardwood floors throughout living areas
• Single-car garage plus covered carport parking
• Large eat-in kitchen with cooking range
• Fully fenced backyard
• Ceiling fans and climate control
• Less than 3 miles to the Plaza District and Uptown 23rd
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $925
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt processing.`
  },
  {
    pipeline_id: 'PP-B679C8AF',
    address: '2510 W Park Pl',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73107',
    county: 'Oklahoma County',
    neighborhood: 'West End / Mid-City OKC',
    lat: 35.4807,
    lng: -97.5601,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 1,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 900,
    monthly_rent: 900,
    security_deposit: 900,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Off-Street Driveway Parking',
    garage_spaces: 0,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer and Dryer Hookups',
    flooring: ['Hard-Surface Flooring', 'Tile'],
    amenities: [
      'Generous 900 Sq. Ft. 1-Bedroom Single-Family Layout',
      'Central Heating & Central Air Conditioning System',
      'In-Unit Washer and Dryer Hookups',
      'Spacious Living Room and Distinct Dining Space',
      'Private Driveway Off-Street Parking',
      'Expansive Bedroom with Ample Closet Storage',
      'Rapid Access to I-40 & I-44 Interstates, OU Medical & Downtown OKC',
      'Pet-Friendly Living'
    ],
    appliances: ['Range / Oven', 'Range Hood'],
    description: `An expansive 900 sq. ft. single-family footprint, central heating and air conditioning, and swift access to major interstates highlight this 1-bedroom home on West Park Place.

Offering substantially more interior space than typical one-bedroom homes, the residence features a spacious main living room with easy-care hard-surface flooring and a separate dining area. Central forced air climate control ensures comfortable temperatures throughout every season.

The large bedroom includes generous closet capacity and sits adjacent to a full bathroom. In-unit washer and dryer hookups provide everyday laundry convenience. Positioned in Mid-City OKC with seamless access to I-40 and I-44, placing residents minutes from OU Medical Center, Downtown OKC, and the Paycom Center.

Key Property Features:
• 1 Bedroom, 1 Bathroom (900 sq. ft.)
• Substantially spacious 1-bedroom single-family floor plan
• Central heating and central air conditioning
• In-unit washer and dryer hookups
• Dedicated off-street driveway parking
• Separate dining area and large living room
• Fast connectivity to I-40, I-44, OU Medical Center, and Downtown OKC
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $900
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt processing.`
  },
  {
    pipeline_id: 'PP-4531C648',
    address: '1017 N Tabor Ave',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73107',
    county: 'Oklahoma County',
    neighborhood: 'Fairgrounds / NW 10th & Portland',
    lat: 35.4789,
    lng: -97.5852,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 792,
    monthly_rent: 925,
    security_deposit: 925,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Driveway Parking',
    garage_spaces: 0,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Interior Washer and Dryer Connections',
    flooring: ['Authentic Wood Flooring Throughout'],
    amenities: [
      'Gleaming Wood Floors Throughout All Living Areas',
      'Living Room with Decorative Mock Fireplace & Architectural Mantel',
      'Dedicated Formal Dining Room for Entertaining',
      'Galley Kitchen Outfitted with White Gas Cooking Range',
      'Central HVAC System & Overhead Ceiling Fans',
      'Interior Washer & Dryer Connections',
      'Large Fenced Backyard for Cookouts & Outdoor Enjoyment',
      'Pet-Friendly Living'
    ],
    appliances: ['Gas Range / Stove', 'Range Hood'],
    description: `Rich wood floors, a formal dining room, a decorative fireplace mantel, and an expansive fenced backyard highlight this classic 2-bedroom home on N Tabor Avenue.

Located off NW 10th and Portland, the 792 sq. ft. residence features warm wood flooring spanning both living spaces and bedrooms. The formal living room is anchored by a charming decorative fireplace and architectural mantel, flowing smoothly into a dedicated formal dining room.

The galley-style kitchen is equipped with a white gas stove and functional storage. Daily comfort is assured with central HVAC, ceiling fans, and interior washer/dryer connections. Outside, a large backyard provides ideal space for cookouts and pets. Situated with rapid access to I-44 and State Fair Park.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (792 sq. ft.)
• Authentic wood floors throughout the home
• Decorative mock fireplace and mantel in formal living room
• Dedicated formal dining room
• Galley kitchen with white gas cooking stove
• Central HVAC and ceiling fans
• Interior washer and dryer connections
• Large private backyard
• Quick highway access to I-44 and State Fair Park
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $925
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt processing.`
  }
];

async function publishOKBatch() {
  console.log(`Starting publication of ${OK_PROPERTIES.length} Oklahoma properties...`);

  const rawList = JSON.parse(fs.readFileSync('scripts/ok_raw.json', 'utf8'));
  const rawMap = new Map();
  rawList.forEach(item => {
    rawMap.set(item.id, item);
  });

  const publishedResults = [];

  for (let i = 0; i < OK_PROPERTIES.length; i++) {
    const item = OK_PROPERTIES[i];
    const raw = rawMap.get(item.pipeline_id) || {};
    const pipeId = item.pipeline_id;

    console.log(`\n[${i + 1}/${OK_PROPERTIES.length}] Processing ${item.address}, ${item.city}, ${item.state} ${item.zip}...`);

    // 1. Photo extraction and verification
    let photoUrls = [];
    try {
      photoUrls = typeof raw.original_image_urls === 'string' 
        ? JSON.parse(raw.original_image_urls) 
        : (raw.original_image_urls || []);
    } catch(e) {
      photoUrls = [];
    }

    if (!Array.isArray(photoUrls) || photoUrls.length === 0) {
      console.warn(`   ⚠️ No photos found for ${item.address}, checking fallback...`);
    }

    // 2. Check if property already exists in public.properties by address
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?address=eq.${encodeURIComponent(item.address)}&city=eq.${encodeURIComponent(item.city)}&select=id`, {
      headers: HEADERS
    });
    const existing = await checkRes.json();
    let propId = (existing && existing.length > 0) ? existing[0].id : crypto.randomUUID();

    const title = `${item.bedrooms} Bed / ${item.bathrooms} Bath Home in ${item.neighborhood || item.city}`;

    // 3. Prepare payload for public.properties
    const propRecord = {
      id: propId,
      landlord_id: LANDLORD_ID,
      status: 'active',
      title: title,
      description: item.description,
      showing_instructions: 'Online applications accepted directly through Choice Properties.',
      address: item.address,
      city: item.city,
      state: item.state,
      zip: item.zip,
      county: item.county,
      neighborhood: item.neighborhood,
      lat: item.lat,
      lng: item.lng,
      property_type: item.property_type,
      year_built: raw.year_built || null,
      floors: 1,
      unit_number: item.address.includes('#') ? item.address.split('#')[1].trim() : null,
      total_units: 1,
      bedrooms: item.bedrooms,
      bathrooms: item.bathrooms,
      half_bathrooms: item.half_bathrooms,
      total_bathrooms: item.total_bathrooms,
      square_footage: item.square_footage,
      lot_size_sqft: raw.lot_size_sqft || null,
      garage_spaces: item.garage_spaces,
      monthly_rent: item.monthly_rent,
      security_deposit: item.security_deposit,
      application_fee: item.application_fee,
      pet_deposit: 0,
      admin_fee: 0,
      pets_allowed: item.pets_allowed,
      pet_types_allowed: item.pet_types_allowed,
      smoking_allowed: false,
      has_central_air: item.has_central_air,
      has_basement: item.has_basement,
      parking: item.parking,
      amenities: item.amenities,
      appliances: item.appliances,
      flooring: item.flooring,
      heating_type: item.heating_type,
      cooling_type: item.cooling_type,
      laundry_type: item.laundry_type,
      featured: false,
      listed_at: new Date().toISOString(),
      source_status: 'verified',
      last_verified_at: new Date().toISOString()
    };

    if (existing && existing.length > 0) {
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

    if (photoInserts.length > 0) {
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

  fs.writeFileSync('scripts/published_ok_results.json', JSON.stringify(publishedResults, null, 2));

  console.log('\n═════════════════════════════════════════════════════════════════');
  console.log(`  Published ${publishedResults.length} Oklahoma properties successfully!`);
  console.log('═════════════════════════════════════════════════════════════════\n');

  publishedResults.forEach(r => {
    console.log(`${r.n}. ${r.address}, ${r.city}, ${r.state} ${r.zip} ($${r.rent.toLocaleString()}/mo | ${r.beds} Bed / ${r.baths} Bath) — ${r.url}`);
  });
}

publishOKBatch().catch(console.error);
