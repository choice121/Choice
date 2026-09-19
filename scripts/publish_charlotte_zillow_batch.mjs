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

// 16 Charlotte, NC Properties with manual verified enrichment and target pricing rule applied:
// If original > 1650 -> reduce to 1650; if <= 1650 -> keep original price
const CHARLOTTE_PROPERTIES = [
  {
    pipeline_id: 'PP-0F20F820',
    address: '3204 Summercroft Ln',
    city: 'Charlotte',
    state: 'NC',
    zip: '28269',
    county: 'Mecklenburg County',
    neighborhood: 'North Charlotte / Croft Area',
    lat: 35.3342,
    lng: -80.8124,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 2.5,
    half_bathrooms: 1,
    total_bathrooms: 3,
    square_footage: 1088,
    monthly_rent: 1650, // Reduced from 1680 to 1650
    security_deposit: 1650,
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
    laundry_type: 'In-Unit Washer & Dryer Connections',
    flooring: ['Hardwood-Style Flooring', 'Tile'],
    amenities: [
      'Dual Primary Suite Layout with Private Full Baths',
      'Main-Level Powder Room for Guests',
      'Equipped Kitchen with Full Appliance Suite & Pantry',
      'Open Living and Dining Spaces with Natural Light',
      'Private Rear Patio for Outdoor Relaxation',
      'Dedicated Off-Street Parking Spaces',
      'Convenient Access to I-77, I-85, and Northlake Mall',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Washer/Dryer Hookups'],
    description: `A dual primary suite layout, private rear patio, and convenient North Charlotte location define this 2-bedroom, 2.5-bathroom townhome.

The main level features an open living and dining area with clean finishes and natural sunlight, connecting directly to an equipped kitchen with dependable appliances, ample cabinet storage, and pantry space. A convenient half bathroom serves guests on the ground floor.

Upstairs, two spacious primary bedrooms each include private en-suite full bathrooms and generous closet capacity, providing exceptional privacy and flexibility. Outside, enjoy a private rear patio suitable for morning coffee and outdoor leisure. Positioned near Northlake Mall, research parks, and major transit routes including I-77 and I-85.

Key Property Features:
• 2 Bedrooms, 2.5 Bathrooms (1,088 sq. ft.)
• Dual primary suites each with private full bathrooms
• Main-level powder room for guests
• Kitchen equipped with full appliance suite and pantry
• Private rear patio and dedicated off-street parking
• Central air conditioning and heating system
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,650 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  },
  {
    pipeline_id: 'PP-8B1E001A',
    address: '5819 Hamilton Oaks Dr',
    city: 'Charlotte',
    state: 'NC',
    zip: '28216',
    county: 'Mecklenburg County',
    neighborhood: 'Oakview Terrace / Northwest Charlotte',
    lat: 35.2812,
    lng: -80.8943,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1028,
    monthly_rent: 1650, // <= 1650 kept at 1650
    security_deposit: 1650,
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
    laundry_type: 'In-Unit Washer & Dryer Connections',
    flooring: ['Brand-New Luxury Vinyl Plank (LVP)', 'New Plush Carpet'],
    amenities: [
      'Fresh Interior Updates Throughout',
      'Brand-New LVP Flooring and New Carpet in Bedrooms',
      'Modern Stainless Steel Kitchen Appliances',
      'Fresh Neutral Paint Palette Across All Living Spaces',
      'Two Full Bathrooms with Updated Fixtures',
      'Private Driveway for Off-Street Parking',
      'Quick Commute to Uptown Charlotte & Brookshire Blvd',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Stainless Steel Refrigerator', 'Stainless Steel Range / Oven', 'Dishwasher', 'Microwave', 'Washer/Dryer Hookups'],
    description: `Brand-new luxury vinyl plank flooring, fresh interior paint, and updated stainless steel appliances highlight this move-in ready 3-bedroom, 2-bathroom home in Northwest Charlotte.

The single-story layout welcomes you into a bright living room that connects effortlessly to an eat-in kitchen complete with modern stainless steel appliances, solid cabinetry, and generous meal prep space.

Three bedrooms offer comfortable quarters with new plush carpeting and ample closet capacity, served by two full bathrooms with refreshed fixtures. Outside, the property features a private yard and off-street concrete driveway. Located with rapid access to Brookshire Boulevard, I-85, and Uptown Charlotte.

Key Property Features:
• 3 Bedrooms, 2 Full Bathrooms (1,028 sq. ft.)
• Brand-new LVP flooring and fresh interior paint
• Kitchen with updated stainless steel appliances
• Two full bathrooms providing everyday convenience
• Off-street driveway parking and private yard space
• Central heating and air conditioning system
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,650
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  },
  {
    pipeline_id: 'PP-AF914DF4',
    address: '6034 Heath Valley Rd',
    city: 'Charlotte',
    state: 'NC',
    zip: '28210',
    county: 'Mecklenburg County',
    neighborhood: 'Heathstead / SouthPark Perimeter',
    lat: 35.1328,
    lng: -80.8491,
    property_type: 'CONDO',
    bedrooms: 2,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1068,
    monthly_rent: 1600, // <= 1650 kept at 1600
    security_deposit: 1600,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Designated Community Parking',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Connections',
    flooring: ['New Luxury Vinyl Plank (LVP)', 'New Carpet', 'Tile'],
    amenities: [
      'Updated Condo in Highly Desirable Heathstead Community',
      'Fresh Interior Paint & New Contemporary Lighting Fixtures',
      'Updated Kitchen Cabinetry with Modern Countertops',
      'Two Full Bathrooms with Modernized Vanities',
      'Private Balcony / Covered Porch Area',
      'Scenic Mature Trees & Community Green Spaces',
      'Minutes from SouthPark Mall, Dining & Quail Corners',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Electric Range / Oven', 'Dishwasher', 'Microwave', 'Washer/Dryer Hookups'],
    description: `A prime setting in desirable Heathstead, fresh interior paint, and updated kitchen cabinetry highlight this 2-bedroom, 2-bathroom residence in South Charlotte.

The home opens into a spacious living and dining area with luxury vinyl plank flooring and modern light fixtures. The updated kitchen features refreshed cabinetry, modern countertops, and a full appliance suite designed for easy meal preparation.

Both bedrooms provide peaceful retreats with new carpeting and generous closet space, complemented by two full bathrooms with updated vanities. Enjoy relaxing on the private outdoor covered porch overlooking tranquil community greenery. Located just minutes from SouthPark Mall, Sharon Road dining, and Quail Corners.

Key Property Features:
• 2 Bedrooms, 2 Full Bathrooms (1,068 sq. ft.)
• Desirable Heathstead community location
• Updated kitchen cabinetry, countertops, and appliances
• Fresh paint, new LVP flooring, and contemporary lighting
• Private covered porch with green space views
• Minutes from SouthPark shopping and dining
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,600
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  },
  {
    pipeline_id: 'PP-7D82381B',
    address: '1509 Eagles Landing Dr',
    city: 'Charlotte',
    state: 'NC',
    zip: '28214',
    county: 'Mecklenburg County',
    neighborhood: 'Eagle Park / West Charlotte',
    lat: 35.2519,
    lng: -80.9521,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1128,
    monthly_rent: 1575, // <= 1650 kept at 1575
    security_deposit: 1575,
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
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Hardwood-Style Flooring', 'Tile'],
    amenities: [
      'Functional 3-Bedroom Floor Plan with 2 Full Baths',
      'Modern Kitchen with Granite Countertops & Full Appliances',
      'Attached 1-Car Garage & Off-Street Driveway',
      'Private Yard for Outdoor Enjoyment',
      'Central Climate Control System',
      'Quick Access to I-485, Charlotte Douglas Airport & Whitewater Center',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Washer/Dryer Hookups'],
    description: `Modern kitchen finishes, an attached garage, and a convenient West Charlotte location define this 3-bedroom, 2-bathroom single-family home.

The interior showcases an open living room with clean flooring that connects seamlessly to a well-appointed kitchen featuring granite countertops, solid cabinetry, and dependable appliances.

The primary bedroom includes an en-suite full bathroom, while two additional bedrooms offer versatility for family, guests, or a home office. Outside, enjoy a private yard and an attached single-car garage with private driveway parking. Located near I-485, the US National Whitewater Center, and Charlotte Douglas International Airport.

Key Property Features:
• 3 Bedrooms, 2 Full Bathrooms (1,128 sq. ft.)
• Kitchen with granite countertops and modern appliances
• Primary suite with private full bathroom
• Attached 1-car garage and off-street driveway
• Private yard space and central air conditioning
• Proximity to I-485 and US National Whitewater Center
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,575
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  },
  {
    pipeline_id: 'PP-03A50EA0',
    address: '4410 Brooktree Dr',
    city: 'Charlotte',
    state: 'NC',
    zip: '28208',
    county: 'Mecklenburg County',
    neighborhood: 'Westerwood / West Charlotte',
    lat: 35.2412,
    lng: -80.9128,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 1000,
    monthly_rent: 1550, // <= 1650 kept at 1550
    security_deposit: 1550,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Off-Street Driveway',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Hardwood Flooring', 'Tile'],
    amenities: [
      'Single-Story 3-Bedroom Brick Home',
      'Warm Hardwood Flooring Across Living Areas & Bedrooms',
      'Equipped Kitchen with Cooking Range & Cabinet Storage',
      'Generous Front and Backyard Areas',
      'Private Concrete Driveway for Off-Street Parking',
      'Central Climate Control System',
      'Minutes from Wilkinson Blvd, I-85 & Uptown Charlotte',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Range / Stove', 'Refrigerator', 'Washer/Dryer Hookups'],
    description: `Warm hardwood flooring, classic single-story brick construction, and a generous yard highlight this 3-bedroom, 1-bathroom home in West Charlotte.

The interior welcomes you into a bright living room that leads to a functional kitchen with solid cabinetry and cooking range. Hardwood flooring extends throughout the main living areas and bedrooms.

Three comfortable bedrooms offer restful accommodations with closet storage, served by a central full bathroom. The exterior provides expansive front and backyard spaces with a private concrete driveway for off-street parking. Situated with fast access to Wilkinson Boulevard, I-85, and Uptown Charlotte.

Key Property Features:
• 3 Bedrooms, 1 Bathroom (1,000 sq. ft.)
• Hardwood flooring throughout main living spaces and bedrooms
• Kitchen equipped with cooking range and ample cabinetry
• Spacious front and back yards
• Private concrete driveway parking
• Central heating and air conditioning
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,550
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  },
  {
    pipeline_id: 'PP-2AC6278F',
    address: '323 Huntsmoor Dr',
    city: 'Charlotte',
    state: 'NC',
    zip: '28217',
    county: 'Mecklenburg County',
    neighborhood: 'Yorkmount / South Charlotte',
    lat: 35.1782,
    lng: -80.8994,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 1074,
    monthly_rent: 1645, // <= 1650 kept at 1645
    security_deposit: 1645,
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
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Updated Plank Flooring', 'Tile'],
    amenities: [
      'Single-Story 3-Bedroom Floor Plan with Open Living Area',
      'Kitchen with Granite Countertops & Full Appliance Package',
      'Spacious Fenced Backyard with Mature Landscaping',
      'Private Driveway for Off-Street Parking',
      'Central Heating & Air Conditioning System',
      'Prime Proximity to South Boulevard, Light Rail & I-77',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Washer/Dryer Hookups'],
    description: `Granite countertops, an open living layout, and a spacious fenced backyard highlight this 3-bedroom, 1-bathroom home in South Charlotte.

The interior showcases durable plank flooring, a sunlit living room, and an equipped kitchen complete with granite countertops, modern cabinetry, and dependable appliances.

Three well-proportioned bedrooms provide comfortable accommodations with closet storage, sharing a clean full bathroom with updated fixtures. Step outside to a generous fenced backyard with mature trees. Located near South Boulevard, Tyvola Light Rail station, and the I-77 corridor for effortless commutes.

Key Property Features:
• 3 Bedrooms, 1 Bathroom (1,074 sq. ft.)
• Kitchen featuring granite countertops and modern appliances
• Open living room with clean, durable plank flooring
• Spacious fenced backyard with mature shade trees
• Private off-street driveway parking
• Convenient to South Blvd transit and I-77
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,645
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  },
  {
    pipeline_id: 'PP-DC453C47',
    address: '3200 Circles End Cir',
    city: 'Charlotte',
    state: 'NC',
    zip: '28226',
    county: 'Mecklenburg County',
    neighborhood: 'Swan Run / Wessex Square / SouthPark Area',
    lat: 35.1245,
    lng: -80.8281,
    property_type: 'CONDO',
    bedrooms: 3,
    bathrooms: 1.5,
    half_bathrooms: 1,
    total_bathrooms: 2,
    square_footage: 1494,
    monthly_rent: 1595, // <= 1650 kept at 1595
    security_deposit: 1595,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Designated Community Parking',
    garage_spaces: 0,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Hardwood-Style Flooring', 'Tile'],
    amenities: [
      'Generous 1,494 Sq. Ft. Full Brick 3-Bedroom Residence',
      'Screened-In Porch Leading to Extended Rear Patio',
      'Swan Run Community with Lush Green Spaces',
      'Equipped Kitchen with Solid Cabinetry & Appliances',
      '1.5 Bathrooms for Everyday Functionality',
      'Highly Coveted Wessex Square Location Near SouthPark & Colony Place',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Washer/Dryer Hookups'],
    description: `Expansive 1,494 sq. ft. proportions, full brick construction, and a peaceful screened-in porch define this 3-bedroom, 1.5-bathroom residence in Swan Run.

The main level offers a spacious living and dining area with easy outdoor flow. The kitchen includes dependable appliances, solid cabinetry, and good countertop space. A main-floor half bath serves guests.

Upstairs, three comfortable bedrooms provide peaceful quarters, complemented by a full bathroom. Enjoy the outdoors from your screened-in porch and extended private patio overlooking community green spaces. Situated in the coveted Wessex Square area, just minutes from SouthPark Mall, Colony Place, and top dining destinations.

Key Property Features:
• 3 Bedrooms, 1.5 Bathrooms (1,494 sq. ft.)
• Full brick residence with generous living areas
• Screened-in porch and extended private rear patio
• Kitchen equipped with full appliance suite
• Access to Swan Run community green spaces
• Minutes from SouthPark, Colony Place, and Rea Road
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,595
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  },
  {
    pipeline_id: 'PP-1F655209',
    address: '11642 Retriever Way',
    city: 'Charlotte',
    state: 'NC',
    zip: '28269',
    county: 'Mecklenburg County',
    neighborhood: 'Highland Creek / Prosperity Church Area',
    lat: 35.3789,
    lng: -80.7912,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1034,
    monthly_rent: 1625, // <= 1650 kept at 1625
    security_deposit: 1625,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Two Designated Parking Spaces',
    garage_spaces: 0,
    heating_type: 'Central Heat Pump',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Included',
    flooring: ['Hardwood-Style Flooring', 'Tile'],
    amenities: [
      'Two-Story Townhome with Vaulted Ceilings Upstairs',
      'Spacious Great Room Flowing into Dining Area',
      'In-Unit Washer and Dryer Included',
      'Two Designated Parking Spaces & Outdoor Storage Shed',
      'Two Generous Bedrooms with Two Full Bathrooms',
      'Convenient North Charlotte Location Near I-485 & Retail Hubs',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Washer', 'Dryer'],
    description: `Vaulted second-floor ceilings, an in-unit washer and dryer, and two designated parking spaces highlight this 2-bedroom, 2-bathroom townhome in North Charlotte.

The main level features a bright great room that transitions into a dining space and kitchen filled with natural light from the backyard. Refrigerator, washer, and dryer are all provided for resident convenience.

Upstairs, two spacious bedrooms feature soaring vaulted ceilings creating an airy ambiance, served by two full bathrooms. Additional exterior storage is available in the storage shed. Located near Prosperity Church Road, I-485, shopping centers, and neighborhood parks.

Key Property Features:
• 2 Bedrooms, 2 Full Bathrooms (1,034 sq. ft.)
• Vaulted ceilings upstairs for an open, airy feeling
• In-unit washer and dryer included
• Kitchen filled with natural light and complete appliances
• Two designated parking spaces plus storage shed
• Fast access to I-485 and Prosperity Church amenities
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,625
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  },
  {
    pipeline_id: 'PP-EFE5DCB5',
    address: '137 Sleepy Hollow Rd',
    city: 'Charlotte',
    state: 'NC',
    zip: '28217',
    county: 'Mecklenburg County',
    neighborhood: 'Montclaire South / Starmount Area',
    lat: 35.1584,
    lng: -80.8841,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1500,
    monthly_rent: 1600, // <= 1650 kept at 1600
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
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['New Kitchen Flooring', 'Hardwood-Style Flooring', 'Tile'],
    amenities: [
      'Substantial 1,500 Sq. Ft. Single-Family Home',
      'Brand-New Kitchen Cabinets, New Stove & New Flooring',
      'Three Spacious Bedrooms and Two Full Bathrooms',
      'Large Living and Entertaining Spaces',
      'Private Driveway for Off-Street Parking',
      'Generous Yard Area with Mature Trees',
      'Close to South Boulevard, Light Rail & Archdale Transit',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['New Range / Stove', 'Refrigerator', 'Washer/Dryer Hookups'],
    description: `Brand-new kitchen cabinetry, a new cooking range, and a spacious 1,500 sq. ft. floor plan highlight this 3-bedroom, 2-bathroom home in South Charlotte.

The interior showcases recent updates including a completely refreshed kitchen with new cabinets, new flooring, and a brand-new cooking stove. The expansive living and dining spaces offer abundant room for relaxation and entertaining.

Three well-proportioned bedrooms provide comfortable accommodations with generous closet space, supported by two full bathrooms. Outside, enjoy a large private yard and dedicated driveway parking. Conveniently situated near South Boulevard, Archdale Light Rail Station, shopping plazas, and major roadways.

Key Property Features:
• 3 Bedrooms, 2 Full Bathrooms (1,500 sq. ft.)
• Brand-new kitchen cabinets, stove, and flooring
• Generous living and dining room layout
• Two full bathrooms for added household comfort
• Private driveway and large yard area
• Fast access to South Blvd, Light Rail, and I-77
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,600
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  },
  {
    pipeline_id: 'PP-4E32941D',
    address: '1717 Purser Dr',
    city: 'Charlotte',
    state: 'NC',
    zip: '28215',
    county: 'Mecklenburg County',
    neighborhood: 'Hickory Ridge / East Charlotte',
    lat: 35.2341,
    lng: -80.7428,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 864,
    monthly_rent: 1635, // <= 1650 kept at 1635
    security_deposit: 1635,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Off-Street Driveway',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated In-Home Laundry Room',
    flooring: ['Hardwood-Style Plank Flooring', 'Tile'],
    amenities: [
      'Single-Story 3-Bedroom Floor Plan with Smart Home Integration',
      'Kitchen with Pantry and Full Cabinet Storage',
      'Dedicated Laundry Room Inside Home',
      'Private Fenced Backyard Area',
      'Ceiling Fans & Modern Climate Control',
      'Private Driveway for Off-Street Parking',
      'Proximity to Reedy Creek Park, Retail & Albemarle Rd',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Washer/Dryer Hookups'],
    description: `A smart home-ready 3-bedroom layout, dedicated laundry room, and private fenced backyard highlight this single-story home in East Charlotte.

The home features an efficient, well-organized interior with durable plank flooring and ceiling fans. The kitchen includes a dedicated food pantry, ample cabinetry, and dependable appliances for everyday meal prep.

Three bedrooms offer comfortable private spaces with natural light and closet capacity, served by a central full bathroom. Step outside to a private fenced backyard ideal for pets and outdoor activities, with a private driveway for parking. Located near Reedy Creek Park and Nature Center, Albemarle Road shopping, and convenient transit routes.

Key Property Features:
• 3 Bedrooms, 1 Bathroom (864 sq. ft.)
• Single-story layout with durable plank flooring
• Kitchen with dedicated food pantry and full cabinetry
• Dedicated in-home laundry room
• Private fenced backyard and off-street driveway
• Minutes from Reedy Creek Park and shopping hubs
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,635
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  },
  {
    pipeline_id: 'PP-4FDCB2B3',
    address: '402 E 16th St',
    city: 'Charlotte',
    state: 'NC',
    zip: '28206',
    county: 'Mecklenburg County',
    neighborhood: 'Optimist Park / Uptown Edge',
    lat: 35.2329,
    lng: -80.8274,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 2.5,
    half_bathrooms: 1,
    total_bathrooms: 3,
    square_footage: 1170,
    monthly_rent: 1650, // Reduced from 1695 to 1650
    security_deposit: 1650,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: '1 Deeded Parking Space',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Stacked Washer & Dryer Included',
    flooring: ['Hardwood-Style Flooring', 'Tile'],
    amenities: [
      'Premier Optimist Park Location 3 Minutes from Optimist Hall',
      '2 Minutes to Parkwood LYNX Blue Line Light Rail Station',
      'Private Back Patio and Upper-Level Balcony',
      'In-Unit Stacked Washer and Dryer Included',
      'Kitchen with Range, Dishwasher, Microwave & Refrigerator',
      '1 Deeded Parking Space Included',
      'High-Speed Connectivity & Urban Walkability',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Stacked Washer', 'Stacked Dryer'],
    description: `A walkable Optimist Park setting 3 minutes from Optimist Hall, a private back patio, an upper balcony, and in-unit washer/dryer highlight this 2-bedroom, 2.5-bathroom townhome.

The main level features an open living and dining area connecting to a well-equipped kitchen with range, refrigerator, dishwasher, and microwave. A main-floor half bath serves visiting guests.

Upstairs, two bedrooms provide private accommodations, each accompanied by full bathroom access and an upper-level balcony. Stacked laundry appliances are included within the unit. The property includes a deeded parking space. Positioned just 0.4 miles from Parkwood LYNX Blue Line station and 0.6 miles from Optimist Hall dining and retail.

Key Property Features:
• 2 Bedrooms, 2.5 Bathrooms (1,170 sq. ft.)
• Premier Optimist Park location near Optimist Hall and LYNX light rail
• Private back patio and upper balcony
• In-unit stacked washer and dryer included
• Kitchen with full appliance suite
• 1 deeded parking space included
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,650 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  },
  {
    pipeline_id: 'PP-13E4D037',
    address: '2413 Dora Dr',
    city: 'Charlotte',
    state: 'NC',
    zip: '28215',
    county: 'Mecklenburg County',
    neighborhood: 'Hickory Ridge / Shamrock Area',
    lat: 35.2458,
    lng: -80.7512,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 1170,
    monthly_rent: 1650, // Reduced from 1700 to 1650
    security_deposit: 1650,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Concrete Driveway',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Connections',
    flooring: ['Hardwood-Style Plank Flooring', 'Tile'],
    amenities: [
      'Spacious 1,170 Sq. Ft. Single-Story Floor Plan',
      'Granite Kitchen Countertops with Eat-in Dining Space',
      'Walk-In Closet in Primary Bedroom',
      'Fully Fenced Backyard for Outdoor Activities',
      'Ceiling Fans and Smart Home Features',
      'Private Driveway for Off-Street Parking',
      'Near Neighborhood Parks and Shopping Retail Hubs',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Washer/Dryer Hookups'],
    description: `Granite countertops, an eat-in kitchen, a walk-in closet, and a fully fenced backyard define this 3-bedroom, 1-bathroom single-story residence in East Charlotte.

The home opens into a bright, open living room with clean plank flooring and ceiling fans. The kitchen features granite countertops, ample cabinetry, and dedicated eat-in dining space for shared meals.

Three comfortable bedrooms include a primary suite with a walk-in closet, supported by a central full bathroom. Outside, the fully fenced backyard offers a secure private green space, with a private driveway for parking. Located close to neighborhood parks, schools, and shopping plazas along The Plaza and Eastway Drive.

Key Property Features:
• 3 Bedrooms, 1 Bathroom (1,170 sq. ft.)
• Open single-story layout with durable plank flooring
• Eat-in kitchen with granite countertops and quality cabinets
• Primary bedroom with walk-in closet
• Fully fenced private backyard
• Private off-street driveway parking
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,650 (Special Rate)
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  },
  {
    pipeline_id: 'PP-5FDA21FB',
    address: '3811 Mosscroft Ln',
    city: 'Charlotte',
    state: 'NC',
    zip: '28215',
    county: 'Mecklenburg County',
    neighborhood: 'University City Perimeter / Rocky River Road',
    lat: 35.2678,
    lng: -80.7321,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 2.5,
    half_bathrooms: 1,
    total_bathrooms: 3,
    square_footage: 1088,
    monthly_rent: 1595, // <= 1650 kept at 1595
    security_deposit: 1595,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Designated Parking Lot Spaces',
    garage_spaces: 0,
    heating_type: 'Central Electric Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Upper-Floor Laundry Closet with Hookups',
    flooring: ['Hardwood-Style Flooring', 'Tile'],
    amenities: [
      'Dual Primary Suite Floor Plan Each with Private Full Bath',
      'Living and Dining Room with Cozy Focal Fireplace',
      'Kitchen Featuring Granite Countertops & Full Appliance Suite',
      'Fenced Back Patio Area for Outdoor Living',
      'Main-Level Guest Half Bath',
      'Upper-Floor Laundry Closet for Convenience',
      'Convenient University City Location Near UNC Charlotte',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Electric Range / Oven', 'Dishwasher', 'Microwave', 'Refrigerator', 'Washer/Dryer Hookups'],
    description: `A cozy fireplace, granite countertops, dual primary suites with private full baths, and a fenced patio define this 2-bedroom, 2.5-bathroom townhome in the University City area.

The main level features a welcoming living and dining room centered around a fireplace, connecting to a kitchen with granite countertops, solid cabinetry, and full appliances. A powder room on the first floor serves guests.

Upstairs, two generous primary suites each boast private full bathrooms and walk-in closet space. Laundry hookups are conveniently situated on the upper bedroom level. Step outside to a private fenced rear patio for outdoor dining. Located near UNC Charlotte, University Research Park, and major shopping destinations.

Key Property Features:
• 2 Bedrooms, 2.5 Bathrooms (1,088 sq. ft.)
• Dual primary suites each with private full bathrooms
• Living room with focal fireplace and dining area
• Kitchen with granite countertops and full appliances
• Private fenced backyard patio
• Upper-floor laundry hookups
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,595
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  },
  {
    pipeline_id: 'PP-1CFD70CE',
    address: '609 Mountainwater Dr',
    city: 'Charlotte',
    state: 'NC',
    zip: '28262',
    county: 'Mecklenburg County',
    neighborhood: 'University City / North Tryon Corridor',
    lat: 35.3194,
    lng: -80.7482,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 2.5,
    half_bathrooms: 1,
    total_bathrooms: 3,
    square_footage: 1068,
    monthly_rent: 1650, // <= 1650 kept at 1650
    security_deposit: 1650,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Assigned Resident Parking Space',
    garage_spaces: 0,
    heating_type: 'Central Heat Pump',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Included',
    flooring: ['Hardwood-Style Flooring', 'Tile'],
    amenities: [
      'Two-Story Townhome with 2 Bedrooms and 2.5 Bathrooms',
      'In-Unit Washer and Dryer Included',
      'Walkable to Sam’s Club, Retail and Dining Hubs',
      'Spacious Living Room Flowing into Kitchen & Dining Area',
      'Assigned Designated Parking Space',
      'Central Climate Control System',
      'Fast Commutes to UNC Charlotte & University Research Park',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Washer', 'Dryer'],
    description: `Walkable access to shopping, an in-unit washer/dryer, and a 2-bedroom, 2.5-bathroom layout highlight this townhome in University City.

The main level showcases a comfortable living area that connects smoothly to an equipped kitchen with dependable appliances, freezer, dishwasher, microwave, and generous cabinet storage. A powder room is located on the main level.

Upstairs, two well-sized bedrooms offer comfortable accommodations with closet storage and two full bathrooms, providing ideal separation for roommates or a home office. Washer and dryer are included in the home. Located within walking distance of Sam's Club, grocery stores, restaurants, and minutes from UNC Charlotte.

Key Property Features:
• 2 Bedrooms, 2.5 Bathrooms (1,068 sq. ft.)
• In-unit washer and dryer included
• Equipped kitchen with dishwasher and microwave
• Two full bathrooms upstairs plus main-floor powder room
• Assigned resident parking space
• Walkable to shopping and minutes from UNC Charlotte
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,650
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  },
  {
    pipeline_id: 'PP-E8A19587',
    address: '2512 Tuckaseegee Rd',
    city: 'Charlotte',
    state: 'NC',
    zip: '28208',
    county: 'Mecklenburg County',
    neighborhood: 'Enderly Park / FreeMoreWest',
    lat: 35.2419,
    lng: -80.8845,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1080,
    monthly_rent: 1595, // <= 1650 kept at 1595
    security_deposit: 1595,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Dedicated Off-Street Parking',
    garage_spaces: 0,
    heating_type: 'Central Heat Pump',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Brand-New In-Unit Washer & Dryer Included',
    flooring: ['Hardwood Floors Throughout', 'Tile'],
    amenities: [
      'Complete High-End Renovation with Quartz Countertops',
      'Kitchen Island Seating, Soft-Close Cabinets & Convection Oven',
      'Gleaming Hardwood Flooring & 2-Inch Window Blinds Throughout',
      'Brand-New In-Unit Washer & Dryer Included',
      'Each Bedroom Features a Private En-Suite Full Bathroom',
      'Energy-Efficient Windows, Insulation & Modern HVAC',
      'Walkable to Enderly Coffee, Noble Smoke, Bossy Beulah’s & Stewart Creek Greenway',
      'Weekly Landscaping Service Provided',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Stainless Convection Range / Oven', 'Stainless Refrigerator', 'Stainless Dishwasher', 'Microwave', 'Washer', 'Dryer'],
    description: `A complete modern renovation featuring quartz countertops, kitchen island seating, soft-close cabinetry, and hardwood floors throughout defines this 2-bedroom, 2-bathroom home in Enderly Park.

The kitchen is a standout with new stainless steel appliances including a convection oven, quartz countertops, island seating, and soft-close cabinets. Each of the two bedrooms includes its own private full bathroom and closet. Brand-new washer and dryer are included.

High energy-efficiency is ensured with new windows, insulation, roof, plumbing, and modern HVAC. Enjoy weekly landscaping service provided. The location is highly walkable, situated just a block from Enderly Coffee and steps from Noble Smoke, Bossy Beulah's, and Stewart Creek greenway pickleball courts, just 5 minutes from Downtown Uptown Charlotte.

Key Property Features:
• 2 Bedrooms, 2 Full Bathrooms (1,080 sq. ft.)
• Complete renovation with hardwood floors throughout
• Kitchen with quartz countertops, island seating, and convection oven
• Each bedroom has its own private en-suite full bathroom
• Brand-new washer and dryer included in unit
• Weekly landscaping service included
• Walkable to Enderly Coffee, local dining, and Stewart Creek Greenway
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,595
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  },
  {
    pipeline_id: 'PP-435504EE',
    address: '11625 Lioness St',
    city: 'Charlotte',
    state: 'NC',
    zip: '28273',
    county: 'Mecklenburg County',
    neighborhood: 'Lions Gate / Steele Creek Area',
    lat: 35.1182,
    lng: -80.9541,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 2.5,
    half_bathrooms: 1,
    total_bathrooms: 3,
    square_footage: 1189,
    monthly_rent: 1645, // <= 1650 kept at 1645
    security_deposit: 1645,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Dedicated 2-Car Parking',
    garage_spaces: 0,
    heating_type: 'Central Heat Pump',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Included',
    flooring: ['Hardwood-Style Flooring', 'Tile'],
    amenities: [
      'Desirable Lions Gate Community with Swimming Pool & Clubhouse Access',
      'Dual Primary Suite Layout Upstairs Each with Private Full Bath',
      'Main-Level Granite Countertops & Kitchen Food Pantry',
      'In-Home Washer and Dryer Included',
      'Private Rear Patio for Outdoor Relaxation',
      'Dedicated 2-Car Parking Spaces',
      'Proximity to Rivergate Shopping, Lake Wylie & I-485',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Washer', 'Dryer'],
    description: `Granite kitchen countertops, dual primary suites, community pool access, and dedicated 2-car parking highlight this 2-bedroom, 2.5-bathroom townhome in Lions Gate.

The main level features an open-concept living and dining area with clean finishes, connecting to a well-appointed kitchen with granite countertops, food pantry, and full appliances. A half bathroom is conveniently located downstairs for guests.

Upstairs, two spacious bedrooms each include private en-suite full bathrooms, offering excellent privacy. Washer and dryer are included in the unit. Step out to a private rear patio. Residents enjoy access to the Lions Gate community swimming pool and clubhouse. Conveniently located near Rivergate shopping center, Lake Wylie recreation, and I-485.

Key Property Features:
• 2 Bedrooms, 2.5 Bathrooms (1,189 sq. ft.)
• Dual primary suites each with private full bathroom
• Kitchen with granite countertops and food pantry
• In-home washer and dryer included
• Private rear patio and dedicated 2-car parking
• Lions Gate community swimming pool and clubhouse
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,645
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast review.`
  }
];

async function publishCharlotteBatch() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('  Choice Properties — Charlotte Pipeline Publishing');
  console.log(`  Processing ${CHARLOTTE_PROPERTIES.length} Fully Enriched Properties`);
  console.log('  Pricing Target: $1,650 (Over 1650 reduced to 1650)');
  console.log('═════════════════════════════════════════════════════════════════\n');

  const rawPipelineData = JSON.parse(fs.readFileSync('scripts/charlotte_zillow_raw.json', 'utf8'));
  const rawMap = new Map(rawPipelineData.map(p => [p.id, p]));

  const publishedResults = [];
  const today = new Date().toISOString().split('T')[0];

  for (let i = 0; i < CHARLOTTE_PROPERTIES.length; i++) {
    const item = CHARLOTTE_PROPERTIES[i];
    const pipeId = item.pipeline_id;
    const rawProp = rawMap.get(pipeId);

    console.log(`[${i + 1}/${CHARLOTTE_PROPERTIES.length}] Processing ${item.address} (${item.bedrooms}BR/${item.bathrooms}BA) - $${item.monthly_rent}/mo...`);

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

  fs.writeFileSync('scripts/published_charlotte_results.json', JSON.stringify(publishedResults, null, 2));

  console.log('\n═════════════════════════════════════════════════════════════════');
  console.log(`  Published ${publishedResults.length} Charlotte properties successfully!`);
  console.log('═════════════════════════════════════════════════════════════════\n');

  publishedResults.forEach(r => {
    console.log(`${r.n}. ${r.address}, ${r.city}, ${r.state} ${r.zip} ($${r.rent.toLocaleString()}/mo | ${r.beds} Bed / ${r.baths} Bath) — ${r.url}`);
  });
}

publishCharlotteBatch().catch(console.error);
