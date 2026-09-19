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

// 10 Cleveland, OH Zillow Properties - Full Manual Enrichment with Verified Information
// Pricing Rules:
// - Original > $1,200 -> Reduced to exactly $1,200
// - Original <= $1,200 -> Retained at original price
const CLEVELAND_PROPERTIES = [
  {
    pipeline_id: 'PP-F7B76FBC',
    address: '1581 E 47th St',
    city: 'Cleveland',
    state: 'OH',
    zip: '44103',
    county: 'Cuyahoga County',
    neighborhood: 'Midtown / Hough',
    lat: 41.51392,
    lng: -81.65524,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 1100,
    monthly_rent: 1200, // Original 1200 -> 1200
    security_deposit: 1200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Paved Concrete Driveway & Off-Street Parking',
    garage_spaces: 0,
    heating_type: 'Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Basement Washer/Dryer Hookups',
    flooring: ['Hardwood-Style Flooring', 'Tile'],
    amenities: [
      'Private Standalone 2-Bedroom Single-Family Home (1,100 Sq. Ft.)',
      'Set Back from Street for Enhanced Privacy & Quiet',
      'New Energy-Efficient Windows Throughout',
      'Brand New Paved Concrete Driveway with Off-Street Parking',
      'Equipped Kitchen with Full Refrigerator & Cooking Range Included',
      'Basement Storage Space with In-Home Laundry Hookups',
      'Convenient Covered Front Porch Entry',
      'Prime Midtown Location: 8 Mins to Downtown, 10 Mins to CSU & Cleveland Clinic',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `A private standalone setting, brand-new energy-efficient windows, a freshly paved concrete driveway, and 1,100 sq. ft. of comfortable living space highlight this 2-bedroom home on East 47th Street.

Positioned back from the street for quiet privacy, the residence opens from a covered front entry into a welcoming living room filled with natural light. The functional kitchen comes equipped with a cooking range, refrigerator, and solid cabinet storage for easy daily meal preparation.

Two comfortable bedrooms are supported by a clean full bathroom. Downstairs, the basement offers extensive extra storage along with dedicated laundry connections. Located in Cleveland's Midtown corridor with rapid access to Downtown Cleveland (8 minutes), Cleveland State University (10 minutes), Cleveland Clinic Main Campus, Dave's Market, and neighborhood transit lines.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (1,100 sq. ft.)
• Set-back residential layout offering privacy
• Brand-new energy-efficient windows throughout
• Newly poured concrete driveway and off-street parking
• Equipped kitchen with refrigerator and stove included
• Full basement with laundry hookups and storage
• Prime location minutes from CSU, Downtown & Cleveland Clinic
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,200
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-7830E82A',
    address: '13802 Byron Ave',
    city: 'Cleveland',
    state: 'OH',
    zip: '44120',
    county: 'Cuyahoga County',
    neighborhood: 'Buckeye-Shaker / Shaker Heights Border',
    lat: 41.4789,
    lng: -81.5892,
    property_type: 'TOWNHOMES',
    bedrooms: 2,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 950,
    monthly_rent: 1200, // Reduced from 1250 to 1200
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
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Updated Plank Flooring', 'Tile'],
    amenities: [
      'Fully Renovated 2-Bedroom Residence in Buckeye-Shaker',
      'Comprehensive Interior & Exterior Renovation with Fresh Lead-Free Paint',
      'Updated Kitchen with Modern Cabinetry, Solid Counters & Appliances',
      'Modernized Bathroom with Fresh Tile Surround & Contemporary Fixtures',
      'Energy-Efficient Windows and Updated Entry Doors',
      'Dedicated Basement Storage with Laundry Hookups',
      'Convenient Access to Shaker Square, RTA Rapid Transit & University Circle',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `A comprehensive top-to-bottom renovation, brand-new flooring, updated kitchen and bathroom finishes, and energy-efficient windows highlight this 2-bedroom home on Byron Avenue.

The interior showcases fresh neutral paint, updated contemporary plank flooring, and abundant natural light throughout the open living area. The newly renovated kitchen features updated cabinetry, clean countertops, and cooking appliances.

Two well-proportioned bedrooms share a refreshed full bathroom with modern vanity and tile surrounds. Additional highlights include a full basement providing extensive storage capacity and laundry connections. Situated in the Buckeye-Shaker neighborhood with easy access to Shaker Square shopping, local dining, RTA transit lines, and University Circle.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (950 sq. ft.)
• Fully renovated interior and exterior
• Modern kitchen with updated cabinetry and appliances
• Contemporary plank flooring and energy-efficient windows
• Full basement with storage space and laundry hookups
• Dedicated off-street driveway parking
• Close to Shaker Square, parks, and RTA rapid transit
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,200 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  },
  {
    pipeline_id: 'PP-F54A2409',
    address: '2025 E 81st St',
    city: 'Cleveland',
    state: 'OH',
    zip: '44103',
    county: 'Cuyahoga County',
    neighborhood: 'Hough / University Circle West',
    lat: 41.5121,
    lng: -81.6324,
    property_type: 'TOWNHOMES',
    bedrooms: 1,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 650,
    monthly_rent: 1200, // Original 1200 -> 1200
    security_deposit: 1200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Off-Street Resident Parking',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'On-Site Laundry Facility',
    flooring: ['Contemporary Flooring', 'Tile'],
    amenities: [
      'Low-Maintenance 1-Bedroom, 1-Bathroom Residence (650 Sq. Ft.)',
      'Comfortable Living Room with Bright Windows',
      'Efficient Kitchen with Refrigerator, Range & Cabinetry',
      'Central Climate Control System',
      'On-Site Resident Parking and Easy First-Floor Access',
      'Minutes to Cleveland Clinic Main Campus, University Hospitals & Health Facilities',
      'Convenient Access to Public Transportation & Local Neighborhood Amenities',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Range Hood'],
    description: `A central Hough location near University Circle, low-maintenance living, central climate control, and easy access to healthcare hubs define this 1-bedroom apartment home on East 81st Street.

The unit features a practical, sunlit living area designed for easy daily comfort. The kitchen provides essential cabinetry, counter space, and full cooking appliances.

The bedroom offers generous closet space and quick access to a clean full bathroom. Positioned conveniently close to world-class healthcare centers including Cleveland Clinic Main Campus, University Hospitals, Case Western Reserve University, neighborhood grocery stores, and local bus transit lines.

Key Property Features:
• 1 Bedroom, 1 Bathroom (650 sq. ft.)
• Bright and efficient open living space
• Kitchen equipped with cooking range and refrigerator
• Central heating and cooling
• Resident off-street parking
• Minutes from Cleveland Clinic and University Circle
• Close to public transit and local retail
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,200
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  },
  {
    pipeline_id: 'PP-65467D77',
    address: '1911 E 123rd St',
    city: 'Cleveland',
    state: 'OH',
    zip: '44106',
    county: 'Cuyahoga County',
    neighborhood: 'University Circle / Little Italy',
    lat: 41.5112,
    lng: -81.5987,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 1200,
    monthly_rent: 1200, // Reduced from 1400 to 1200
    security_deposit: 1200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Free On-Site Parking & Off-Street Spaces',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'On-Site Washer and Dryer Access',
    flooring: ['Hardwood Flooring', 'Tile'],
    amenities: [
      'Prime University Circle / Little Italy 2-Bedroom Single-Family Home (1,200 Sq. Ft.)',
      'Remodeled Kitchen with Quality Cabinetry & Cooking Appliances',
      'Remodeled Bathroom with Modern Fixtures',
      'Walking Distance to Case Western Reserve University (CWRU) & Cleveland Institute of Art (CIA)',
      'Minutes from Cleveland Clinic Main Campus & University Hospitals',
      'Free On-Site Parking with Access to On-Site Washer and Dryer',
      'Outdoor Common Area for Relaxing and Fresh Air',
      'Just Blocks from Renowned Restaurants and Bakeries in Little Italy',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Range Hood', 'Washer', 'Dryer'],
    description: `A remodeled kitchen and bathroom, free on-site parking, and an unbeatable location within walking distance of Little Italy and Case Western Reserve University highlight this 2-bedroom home on East 123rd Street.

The residence features an expansive 1,200 sq. ft. floor plan with classic hardwood flooring and a bright living area. The remodeled kitchen offers updated cabinetry, spacious countertop area, and full cooking appliances.

Two spacious bedrooms share a newly remodeled full bathroom. Residents enjoy free on-site parking, on-site washer and dryer access, and an outdoor common space perfect for unwinding. Superbly located just steps from CWRU, the Cleveland Institute of Art, University Hospitals, Cleveland Clinic, and world-class dining throughout Little Italy.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (1,200 sq. ft.)
• Remodeled kitchen and bathroom
• Hardwood flooring across living spaces
• Free on-site parking included
• On-site washer and dryer access
• Outdoor common area
• Walking distance to CWRU, CIA, and Little Italy dining
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,200 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-72F51141',
    address: '2613 Martin Luther King Jr Dr',
    city: 'Cleveland',
    state: 'OH',
    zip: '44104',
    county: 'Cuyahoga County',
    neighborhood: 'Larchmere / University Circle Corridor',
    lat: 41.4889,
    lng: -81.6034,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 1200,
    monthly_rent: 1200, // Reduced from 1250 to 1200
    security_deposit: 1200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Detached 2-Car Garage with Dedicated Space',
    garage_spaces: 2,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Building Washer and Dryer Installed Downstairs',
    flooring: ['Refinished Hardwood Floors in Living & Dining Rooms', 'Luxury Vinyl Plank in Kitchen', 'Plush Carpet in Bedrooms'],
    amenities: [
      'Spacious 1,200 Sq. Ft. 2-Bedroom Unit at the Corner of Larchmere Blvd',
      'Refinished Hardwood Floors in Formal Living & Dining Rooms',
      'New Luxury Vinyl Plank Flooring in Kitchen with Gas Stove & Refrigerator Provided',
      'Detached 2-Car Garage with Dedicated Parking Space',
      'Dedicated Washer and Dryer Installed Downstairs',
      'Fresh Interior Neutral Paint Throughout',
      'Prime Location near Cleveland Clinic, University Hospitals & CWRU',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Gas Range / Oven', 'Range Hood', 'Washer', 'Dryer'],
    description: `Refinished hardwood floors, a dedicated garage space, in-building laundry, and a generous 1,200 sq. ft. layout at the corner of Larchmere Boulevard highlight this 2-bedroom home on Martin Luther King Jr Drive.

The unit features gleaming refinished hardwood floors throughout the spacious living and formal dining rooms. The kitchen is outfitted with new luxury vinyl plank flooring, solid cabinetry, and provided appliances including a gas stove and refrigerator.

Two quiet bedrooms feature plush carpeting and share a central full bathroom. Downstairs, enjoy dedicated washer and dryer laundry appliances, plus a dedicated parking space in the detached 2-car garage. Positioned directly down the street from the Cleveland Clinic, University Hospitals, Case Western Reserve University, and Larchmere's vibrant boutique and restaurant district.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (1,200 sq. ft.)
• Refinished hardwood flooring in living and dining rooms
• Updated kitchen with gas range, refrigerator, and luxury vinyl plank
• Detached 2-car garage with dedicated parking space
• Washer and dryer installed downstairs
• Fresh interior paint throughout
• Superb location near Larchmere Blvd, Cleveland Clinic & CWRU
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,200 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  },
  {
    pipeline_id: 'PP-B069CE78',
    address: '13706 Coit Rd',
    city: 'Cleveland',
    state: 'OH',
    zip: '44110',
    county: 'Cuyahoga County',
    neighborhood: 'Collinwood / East Cleveland Border',
    lat: 41.5432,
    lng: -81.5789,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 1038,
    monthly_rent: 1100, // Original 1100 -> 1100
    security_deposit: 1100,
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
    flooring: ['Updated Hardwood Plank Flooring', 'Tile'],
    amenities: [
      'Updated 2-Bedroom Single-Family Residence (1,038 Sq. Ft.)',
      'Flexible Floor Plan Ideal for Home Office or Roommates',
      'Fresh Interior Updates & Move-In Ready Condition',
      'Private Yard Space for Outdoor Relaxation and Pets',
      'Full Basement for Extra Storage & Laundry Connections',
      'Off-Street Driveway Parking',
      'Minutes from Lake Erie Shoreline, Euclid Parks & Downtown Cleveland Access',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `A private yard, flexible 1,038 sq. ft. layout, move-in-ready interior updates, and close proximity to Lake Erie highlight this 2-bedroom home on Coit Road.

The home opens into a generous front living space featuring updated plank flooring and abundant daylight. The kitchen provides ample counter space, clean cabinetry, and full cooking appliances.

Two spacious bedrooms offer flexible layout options, perfect for a dedicated home office or guest bedroom, supported by a central full bathroom. A private yard provides space for outdoor leisure, while the full basement supplies extensive storage capacity and laundry hookups. Located just minutes from Lake Erie, Euclid parks, grocery shopping, and quick highway connections to Downtown Cleveland.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (1,038 sq. ft.)
• Fresh interior updates throughout
• Flexible room layout accommodating home office needs
• Private yard for outdoor enjoyment
• Full basement with substantial storage capacity
• Off-street driveway parking
• Close to Lake Erie, Euclid parks, and Downtown access
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,100
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-3D5453AD',
    address: '17906 Brazil Rd',
    city: 'Cleveland',
    state: 'OH',
    zip: '44119',
    county: 'Cuyahoga County',
    neighborhood: 'North Collinwood / Euclid Beach',
    lat: 41.5812,
    lng: -81.5423,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 880,
    monthly_rent: 1195, // Original 1195 -> 1195
    security_deposit: 1195,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Detached Garage & Long Private Driveway',
    garage_spaces: 1,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Basement Washer/Dryer Connections',
    flooring: ['Updated Hardwood Plank Flooring', 'Tile'],
    amenities: [
      'Charming 2-Bedroom Home Steps from Euclid Beach Park & Lake Erie (880 Sq. Ft.)',
      'Inviting Enclosed Front Sun Porch for Year-Round Enjoyment',
      'Deluxe Full Bathroom Complete with Jetted Whirlpool Tub',
      'Additional Main-Level Bonus Room Ideal for Home Office or Study',
      'Two Bright Upstairs Bedrooms with Excellent Natural Sunlight',
      'Detached 1-Car Garage and Ample Driveway Parking',
      'Private Fully Fenced-In Backyard',
      'Full Basement for Storage and Laundry Equipment',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `An enclosed front sun porch, jetted whirlpool tub, detached garage, private fenced backyard, and prime location steps from Euclid Beach Park and Lake Erie highlight this 2-bedroom home on Brazil Road.

Step through the welcoming enclosed front porch into a bright main living area with updated plank flooring. The main level offers a functional kitchen, an additional bonus room ideal for a private study or home office, and a full bathroom outfitted with a luxury jetted whirlpool tub.

Upstairs, two sunlit bedrooms feature generous closet space and natural light. Outside, enjoy a detached single-car garage with an extended driveway and a fully fenced private backyard. Complete with full basement storage and easy access to Route 2 / I-90.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (880 sq. ft.)
• Enclosed front sun porch
• Bathroom featuring a jetted whirlpool tub
• Main-level bonus room for study or office
• Two upper-level bedrooms with great natural light
• Detached garage and long private driveway
• Fully fenced-in private backyard
• Steps from Euclid Beach Park, Euclid Creek, and Lake Erie
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,195
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  },
  {
    pipeline_id: 'PP-6479924C',
    address: '4019 Newark Ave',
    city: 'Cleveland',
    state: 'OH',
    zip: '44109',
    county: 'Cuyahoga County',
    neighborhood: 'Clark-Fulton / West Cleveland',
    lat: 41.4689,
    lng: -81.7012,
    property_type: 'TOWNHOMES',
    bedrooms: 2,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 750,
    monthly_rent: 1080, // Original 1080 -> 1080
    security_deposit: 1080,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Off-Street Parking Available',
    garage_spaces: 0,
    heating_type: 'Central Heating System',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Updated Plank Flooring', 'Tile'],
    amenities: [
      'Newly Renovated 2-Bedroom, 1-Bathroom Unit (750 Sq. Ft.) in West Cleveland',
      'Fresh Interior Renovation with Contemporary Flooring & Paint',
      'Modernized Kitchen with Updated Cabinetry and Cooking Appliances',
      'Clean Updated Bathroom with Contemporary Vanity & Fixtures',
      'Central Climate Control System',
      'Off-Street Parking and Dedicated Storage Area',
      'Minutes to MetroHealth Main Campus, Ohio City & Downtown Cleveland',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `Fresh interior renovations, modern plank flooring, an updated kitchen and bathroom, and convenient West Cleveland location highlight this 2-bedroom home on Newark Avenue.

The interior showcases freshly painted living areas with clean plank flooring and abundant daylight. The updated kitchen features contemporary cabinets, solid countertops, and cooking appliances.

Two well-sized bedrooms offer comfortable accommodations and share a refreshed full bathroom with modern fixtures. Situated in Clark-Fulton with immediate convenience to the MetroHealth Medical Center campus, Ohio City dining, Tremont arts, and I-71/I-90 for quick commuting across Cleveland.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (750 sq. ft.)
• Newly renovated interior finishes
• Modern kitchen and updated bathroom
• Durable plank flooring throughout
• Central heating and cooling
• Off-street parking available
• Close to MetroHealth, Ohio City, and Downtown
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,080
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  },
  {
    pipeline_id: 'PP-753529A1',
    address: '3463 E 149th St',
    city: 'Cleveland',
    state: 'OH',
    zip: '44120',
    county: 'Cuyahoga County',
    neighborhood: 'Kinsman / Mount Pleasant',
    lat: 41.4723,
    lng: -81.5734,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 1050,
    monthly_rent: 1050, // Original 1050 -> 1050
    security_deposit: 1050,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Detached Garage & Off-Street Driveway',
    garage_spaces: 1,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Basement Laundry & Storage Area',
    flooring: ['New Hardwood Plank Flooring', 'Tile'],
    amenities: [
      'Beautifully Renovated 2-Bedroom Main-Level Residence (1,050 Sq. Ft.)',
      'New Flooring, Updated Modern Lighting & Designer Fixtures Throughout',
      'Spacious and Bright Living Room Blending Modern Upgrades with Classic Charm',
      'Updated Kitchen with Abundant Cabinet Storage and Counter Prep Space',
      'Full Basement Offering Substantial Space for Storage & Laundry',
      'Detached Garage and Off-Street Driveway Parking',
      'Close to Shaker Heights Border, Local Transit & Neighborhood Shopping',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `New contemporary flooring, updated modern lighting fixtures, detached garage parking, and full basement storage highlight this beautifully renovated 2-bedroom home on East 149th Street.

The residence combines classic architecture with modern upgrades, featuring a bright, spacious living room with fresh paint and clean flooring. The kitchen offers generous cabinet storage, practical meal-prep counters, and cooking appliances.

Two well-sized bedrooms offer great natural lighting and built-in closet storage, sharing a refreshed full bathroom with updated fixtures. The full basement provides expansive room for storage and laundry. Complete with a detached garage and private driveway. Located close to the Shaker Heights border, public transit lines, and local neighborhood shopping.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (1,050 sq. ft.)
• Renovated interior with new floors and modern lighting
• Updated kitchen with ample cabinetry
• Detached garage and off-street driveway
• Full basement with generous storage and laundry area
• Central air conditioning and heating
• Convenient access to Shaker Square and transit
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,050
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-BF24CAF0',
    address: '12405 Signet Ave',
    city: 'Cleveland',
    state: 'OH',
    zip: '44120',
    county: 'Cuyahoga County',
    neighborhood: 'Buckeye-Woodhill / Larchmere Vicinity',
    lat: 41.4795,
    lng: -81.5991,
    property_type: 'TOWNHOMES',
    bedrooms: 2,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 900,
    monthly_rent: 1200, // Reduced from 1295 to 1200
    security_deposit: 1200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Brand New Paved Driveway & Off-Street Parking',
    garage_spaces: 0,
    heating_type: 'Updated Central Heating',
    cooling_type: 'Updated Central Air Conditioning',
    laundry_type: 'Basement Washer/Dryer Hookups',
    flooring: ['Contemporary Flooring', 'Tile'],
    amenities: [
      'Comprehensive New Renovation: New Roof, Siding, Windows, Electrical & Plumbing',
      'Modern Kitchen with Shiny Butcher Block Countertops & Open Floor Plan',
      'Remote-Controlled LED Lighting and Recessed Ceiling Lights',
      'Private Fully Fenced Backyard Perfect for Relaxation and Pets',
      'Brand New Paved Driveway for Convenient Off-Street Parking',
      'Less than 10 Minutes from University Circle, Little Italy, CWRU & Cleveland Clinic',
      '5 Minutes from Larchmere Dining, Vintage Stores & Entertainment',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `A top-to-bottom renovation featuring shiny butcher block countertops, an open floor plan, remote-controlled LED recessed lighting, a new paved driveway, and a private fully fenced backyard highlights this 2-bedroom home on Signet Avenue.

The home showcases extensive modern upgrades including new roof, siding, energy-efficient windows, updated electrical and plumbing systems, and contemporary flooring. The stylish kitchen provides a sleek contemporary feel with polished butcher block countertops, solid cabinetry, and full appliances.

Two comfortable bedrooms share a newly remodeled full bathroom with modern tile and fixtures. Outside, relax in a private, fully fenced backyard ideal for pets and outdoor leisure. Positioned less than 10 minutes from University Circle, Little Italy, Case Western Reserve University, and the Cleveland Clinic, and just 5 minutes from Larchmere's dining and shopping.

Key Property Features:
• 2 Bedrooms, 1 Bathroom (900 sq. ft.)
• Open floor plan with butcher block countertops
• Remote-controlled LED and recessed lighting
• New energy-efficient windows, roof, and siding
• Private fully fenced backyard
• Brand-new paved driveway
• 5-10 minutes from Larchmere, University Circle & Cleveland Clinic
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,200 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  }
];

async function publishClevelandBatch() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('  Choice Properties — Cleveland, OH Zillow Publishing ($1,000-$1,200 Target)');
  console.log(`  Processing ${CLEVELAND_PROPERTIES.length} Fully Enriched Properties`);
  console.log('  Pricing Rules: >$1,200 -> $1,200; <=$1,200 -> original price');
  console.log('═════════════════════════════════════════════════════════════════\n');

  const rawPipelineData = JSON.parse(fs.readFileSync('scripts/cleveland_raw.json', 'utf8'));
  const rawMap = new Map(rawPipelineData.map(p => [p.id, p]));

  const publishedResults = [];
  const today = new Date().toISOString().split('T')[0];

  for (let i = 0; i < CLEVELAND_PROPERTIES.length; i++) {
    const item = CLEVELAND_PROPERTIES[i];
    const pipeId = item.pipeline_id;
    const rawProp = rawMap.get(pipeId);

    console.log(`[${i + 1}/${CLEVELAND_PROPERTIES.length}] Processing ${item.address} (${item.bedrooms}BR/${item.bathrooms}BA) - $${item.monthly_rent}/mo...`);

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

  fs.writeFileSync('scripts/published_cleveland_results.json', JSON.stringify(publishedResults, null, 2));

  console.log('\n═════════════════════════════════════════════════════════════════');
  console.log(`  Published ${publishedResults.length} Cleveland properties successfully!`);
  console.log('═════════════════════════════════════════════════════════════════\n');

  publishedResults.forEach(r => {
    console.log(`${r.n}. ${r.address}, ${r.city}, ${r.state} ${r.zip} ($${r.rent.toLocaleString()}/mo | ${r.beds} Bed / ${r.baths} Bath) — ${r.url}`);
  });
}

publishClevelandBatch().catch(console.error);
