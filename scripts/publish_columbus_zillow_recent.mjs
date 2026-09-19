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

// 13 Columbus & Worthington Metro properties manually verified and enriched from Zillow pipeline
const RECENT_PROPERTIES = [
  {
    pipeline_id: 'PP-ADF1CB33',
    address: '2099 W Case Rd',
    city: 'Columbus',
    state: 'OH',
    zip: '43235',
    county: 'Franklin County',
    neighborhood: 'Northwest Columbus / Dublin School District',
    lat: 40.0864,
    lng: -83.0728,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 2.0,
    half_bathrooms: 1,
    total_bathrooms: 2,
    square_footage: 1200,
    monthly_rent: 1795,
    security_deposit: 1795,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached Garage & Off-Street Parking',
    garage_spaces: 1,
    heating_type: 'Central Heating, Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Hard-Surface Flooring', 'Plush Carpet'],
    amenities: [
      'Dublin City School District',
      'Attached Garage with Direct Access',
      'Granite Kitchen Countertops',
      'Stainless Steel Appliance Suite',
      'Cozy Living Room Fireplace',
      'Semi-Private Outdoor Patio',
      'Central Air Conditioning & Heating',
      'Main-Floor Powder Room',
      'Pet-Friendly Community'
    ],
    appliances: ['Stainless Refrigerator', 'Electric Range / Oven', 'Dishwasher', 'Microwave', 'Garbage Disposal'],
    description: `Positioned within Northwest Columbus with Dublin City Schools attendance, this two-story townhome delivers 1,200 square feet of comfortable, modern living space.

The main level welcomes you with an open living room highlighted by a focal fireplace and sliding glass doors that open directly onto a semi-private outdoor patio. Adjoining the dining area, the updated kitchen comes fully equipped with granite countertops, rich cabinetry, and a suite of stainless steel appliances including an electric range, built-in microwave, dishwasher, garbage disposal, and refrigerator. A convenient half bath is positioned on the main floor for guests.

Upstairs, two well-proportioned bedrooms offer generous closet storage and easy access to the full bathroom. The home includes an attached garage, dedicated off-street parking, central air conditioning, and convenient in-unit washer and dryer hookups.

Key Property Features:
• 2 Bedrooms, 1.5 Bathrooms (1,200 sq. ft.)
• Dublin City School District
• Updated kitchen with granite countertops and stainless appliances
• Cozy focal fireplace in main living area
• Semi-private rear outdoor patio
• Attached garage plus off-street parking
• Central air conditioning and heating
• Dedicated washer/dryer hookups`
  },
  {
    pipeline_id: 'PP-502D6B4A',
    address: '3512 Kinsale Head Dr',
    city: 'Columbus',
    state: 'OH',
    zip: '43221',
    county: 'Franklin County',
    neighborhood: 'Mill Run / Hilliard School District',
    lat: 40.0381,
    lng: -83.1192,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 2.0,
    half_bathrooms: 1,
    total_bathrooms: 2,
    square_footage: 1440,
    monthly_rent: 1800,
    security_deposit: 1800,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Attached Garage Parking',
    garage_spaces: 1,
    heating_type: 'Central Heating, Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Hardwood Laminate', 'Plush Carpet', 'Tile'],
    amenities: [
      'Hilliard City School District',
      'Finished Lower-Level Flex Room',
      'Attached 1-Car Garage',
      'Living Room Fireplace',
      'Central Air Conditioning',
      'Equipped Kitchen with Dishwasher',
      'Private Patio & Yard Setting',
      'Minutes from Mill Run Plaza & I-270'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Garbage Disposal'],
    description: `Situated in a quiet residential pocket near the Mill Run Plaza corridor with Hilliard City Schools attendance, this spacious 1,440-square-foot duplex offers multiple levels of finished living space.

The main level showcases a bright, expansive living room centered around a cozy fireplace, seamlessly connecting to the dining nook and functional kitchen equipped with a refrigerator, range, and dishwasher. A convenient half bath serves the ground level.

The upper floor features two spacious bedrooms with substantial closet space alongside a full bathroom. Adding exceptional versatility, the partially finished basement provides a dedicated flex room ideal for a private home office, media lounge, or recreational space, along with laundry hookups and generous storage. An attached one-car garage and a private rear patio complete the home.

Key Property Features:
• 2 Bedrooms, 1.5 Bathrooms (1,440 sq. ft.)
• Hilliard City School District
• Finished basement room perfect for home office or media lounge
• Attached 1-car garage with private driveway
• Living room fireplace with hearth
• Central air conditioning and heating
• Private outdoor patio space
• Minutes from Mill Run shopping, dining, and I-270 access`
  },
  {
    pipeline_id: 'PP-6CF6B984',
    address: '1020 Hartford Village Blvd',
    city: 'Columbus',
    state: 'OH',
    zip: '43228',
    county: 'Franklin County',
    neighborhood: 'Hartford Village Commons / West Columbus',
    lat: 39.9575,
    lng: -83.1362,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 3.0,
    half_bathrooms: 1,
    total_bathrooms: 3,
    square_footage: 1520,
    monthly_rent: 1800,
    security_deposit: 1800,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Attached 1-Car Garage & Driveway',
    garage_spaces: 1,
    heating_type: 'Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Included',
    flooring: ['Updated Carpet', 'Wood Laminate', 'Ceramic Tile'],
    amenities: [
      'Hartford Village Commons End-Unit Layout',
      '3 Finished Levels of Living Space (1,520+ Sq. Ft.)',
      'Scenic Community Pond Views',
      'Community Swimming Pool, Clubhouse & Fitness Center',
      'Finished Lower Level with Fireplace & Half Bath',
      'Updated Kitchen with Breakfast Bar & Stainless Appliances',
      'Fenced Private Patio Leading to 1-Car Garage',
      'In-Unit Washer & Dryer Included',
      'Fresh Paint & Brand-New Carpet'
    ],
    appliances: ['Stainless Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Washer', 'Dryer'],
    description: `Enjoy end-unit privacy and three full levels of finished living space in this 1,520-square-foot townhome at Hartford Village Commons, overlooking the community pond.

The main level features freshly painted interiors and new carpeting throughout a luminous living and dining area. The updated kitchen boasts stainless steel appliances, abundant cabinetry, and a raised breakfast bar. Step outside to a private fenced patio that leads directly into the attached one-car garage.

The upper floor holds two generous bedroom suites, each accompanied by its own full bathroom. Downstairs, the finished lower level provides an expansive living area with a fireplace and an additional half bath, along with a dedicated laundry utility room complete with included washer and dryer. Residents enjoy community amenities including a swimming pool, clubhouse, and fitness center.

Key Property Features:
• 2 Bedroom Suites, 2.5 Bathrooms (1,520+ sq. ft.)
• Three finished levels of living space
• End-unit position with views of the community pond
• Finished lower level with focal fireplace and powder room
• Modern kitchen with breakfast bar and stainless appliances
• Fenced private patio connecting to attached 1-car garage
• Washer and dryer included in unit
• Access to community pool, clubhouse, and fitness facility`
  },
  {
    pipeline_id: 'PP-5BA45E2E',
    address: '841 Saint Clair Ave',
    city: 'Columbus',
    state: 'OH',
    zip: '43201',
    county: 'Franklin County',
    neighborhood: 'Milo-Grogan / Italian Village Corridor',
    lat: 39.9882,
    lng: -82.9835,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 2.0,
    half_bathrooms: 1,
    total_bathrooms: 2,
    square_footage: 1120,
    monthly_rent: 1800,
    security_deposit: 1800,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Dedicated 2-Car Off-Street Parking',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Durable Hard-Surface Plank Flooring', 'Tile'],
    amenities: [
      'Standalone 2-Story Single-Family Home',
      'Refreshed Modern Interior with Neutral Palette',
      'Updated Kitchen with Modern Cabinetry & Dishwasher',
      'Two Dedicated Off-Street Parking Spaces',
      'Full Basement for Storage & Laundry Hookups',
      'Refreshed Exterior Siding & Fresh Paint',
      'Private Yard Space',
      'Central Air Conditioning & Heating',
      'Minutes to Downtown Columbus, Short North & OSU'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher'],
    description: `Offering standalone privacy in the Milo-Grogan and Italian Village corridor, this two-story single-family home delivers 1,120 square feet of refreshed interior living minutes from Downtown Columbus, the Short North Arts District, and OSU.

The ground floor features bright living spaces styled with durable hard-surface plank flooring and a clean neutral color scheme. The updated kitchen features contemporary white cabinetry, generous counter space, and appliances including an electric range, refrigerator, and dishwasher.

Upstairs, two well-sized bedrooms offer ample closet storage and convenient access to a polished full bathroom. The full basement provides expansive dry storage space and dedicated washer/dryer hookups. Exterior highlights include refreshed siding, freshly painted architectural details, a private lawn, and two dedicated off-street parking spaces.

Key Property Features:
• 2 Bedrooms, 1.5 Bathrooms (1,120 sq. ft.)
• Detached single-family residence with private yard
• Freshly updated kitchen with modern cabinetry and dishwasher
• Two designated off-street parking spaces
• Full basement with abundant storage and laundry hookups
• Central air conditioning and central heating
• Easy access to Short North, Italian Village, Downtown, and I-670 / I-71`
  },
  {
    pipeline_id: 'PP-DF12DA46',
    address: '5248 Dierker Rd',
    city: 'Columbus',
    state: 'OH',
    zip: '43220',
    county: 'Franklin County',
    neighborhood: 'Cunard Village / Northwest Columbus',
    lat: 40.0615,
    lng: -83.0648,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 2.0,
    half_bathrooms: 1,
    total_bathrooms: 2,
    square_footage: 1206,
    monthly_rent: 1600,
    security_deposit: 1600,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: '2 Reserved Off-Street Parking Spaces',
    garage_spaces: 0,
    heating_type: 'Central Heating, Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Included',
    flooring: ['Hardwood Flooring', 'Brand-New Carpet', 'Tile'],
    amenities: [
      'Cunard Village Community off Bethel Road',
      'Water Utility Included in Rent',
      'Hardwood Flooring Across Main Level',
      'Brand-New Plush Carpeting Upstairs',
      'Stainless Steel Kitchen Appliances',
      'Partially Finished Basement for Recreation or Office',
      'Private Fenced-In Patio',
      'In-Unit Washer & Dryer Included',
      '2 Reserved Parking Spots Plus Guest Parking'
    ],
    appliances: ['Stainless Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Washer', 'Dryer'],
    description: `Set within the desirable Cunard Village community off Bethel Road, this updated 1,206-square-foot townhome provides a prime Northwest Columbus location with quick access to Route 315, shopping centers, and dining. Water utility is included.

The main living floor showcases authentic wood flooring, natural light, and a modern kitchen equipped with stainless steel appliances and generous cabinet storage. Sliding glass doors lead out to a private, fully fenced brick-paver patio ideal for outdoor relaxation.

Upstairs, two spacious bedrooms feature brand-new carpeting and generous closet space alongside a clean full bath. The half-finished basement offers flexible additional square footage for a home office, gym, or entertainment lounge, complete with an in-unit washer and dryer. Two reserved parking spaces sit right outside, with plenty of visitor parking nearby.

Key Property Features:
• 2 Bedrooms, 1.5 Bathrooms (1,206 sq. ft.)
• Cunard Village community in Northwest Columbus
• Water service included in monthly rent
• Hardwood flooring on the main level and new carpet upstairs
• Kitchen fitted with stainless steel appliances
• Partially finished basement providing bonus living or office space
• In-unit washer and dryer included
• Private fenced rear patio
• 2 reserved parking spaces plus guest parking`
  },
  {
    pipeline_id: 'PP-E1C853EE',
    address: '3798 Dunlane Ct',
    city: 'Columbus',
    state: 'OH',
    zip: '43228',
    county: 'Franklin County',
    neighborhood: 'West Columbus / Lincoln Village Area',
    lat: 39.9542,
    lng: -83.1189,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 1,
    total_bathrooms: 2,
    square_footage: 1800,
    monthly_rent: 1800,
    security_deposit: 1800,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Attached 1-Car Garage & Driveway',
    garage_spaces: 1,
    heating_type: 'Central Heating, Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Hard-Surface Flooring', 'Plush Carpet', 'Tile'],
    amenities: [
      'Quiet Cul-de-Sac Setting',
      'Generous 1,800 Sq. Ft. Floor Plan',
      'Attached 1-Car Garage with Concrete Driveway',
      'Large Private Fenced Backyard',
      'Full Basement for Storage & Workshop Space',
      'Central Air Conditioning & Heating',
      'Functional Kitchen with Dishwasher & Microwave',
      'Quick Connectivity to I-270, Parks & Shopping'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave Oven', 'Freezer'],
    description: `Tucked away at the end of a quiet cul-de-sac in West Columbus, this well-maintained 3-bedroom single-family residence offers approximately 1,800 square feet of comfortable living space minutes from the I-270 outerbelt.

An inviting front entryway opens into expansive living and dining areas filled with natural light. The functional kitchen provides ample cabinetry, expansive countertops, and a complete appliance package including a refrigerator, range, microwave, and dishwasher. A first-floor half bathroom is conveniently positioned for guests.

Upstairs, three well-proportioned bedrooms offer restful accommodation with generous closet space and a central full bathroom. The full basement provides abundant storage and dedicated washer/dryer hookups. Outside, enjoy an attached one-car garage, extended private driveway, and a large private backyard.

Key Property Features:
• 3 Bedrooms, 1.5 Bathrooms (1,800 sq. ft.)
• Quiet cul-de-sac location with minimal street traffic
• Attached 1-car garage and extended driveway parking
• Large private backyard space
• Full basement with laundry hookups and extensive storage
• Central air conditioning and forced-air heating
• Minutes from I-270, shopping centers, restaurants, and parks`
  },
  {
    pipeline_id: 'PP-4C5EAACB',
    address: '3301 Kristin Ct',
    city: 'Columbus',
    state: 'OH',
    zip: '43231',
    county: 'Franklin County',
    neighborhood: 'Northland / Minerva Park Corridor',
    lat: 40.0838,
    lng: -82.9302,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 4,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1500,
    monthly_rent: 1795,
    security_deposit: 1795,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Private Driveway Parking',
    garage_spaces: 0,
    heating_type: 'Forced Air Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Hard-Surface Plank', 'Carpet', 'Vinyl Plank'],
    amenities: [
      '4 Bedrooms & 2 Full Bathrooms',
      'Cul-de-Sac Location with Minimal Traffic',
      'Finished Basement with Vinyl Plank Flooring',
      'Fully Fenced Backyard & Private Rear Deck',
      'Equipped Kitchen with Dishwasher & Disposal',
      'Main-Level Bonus Room / Office Option',
      'Central Air Conditioning & Heating',
      'Pet-Friendly Property'
    ],
    appliances: ['Refrigerator', 'Range / Stove', 'Dishwasher', 'Microwave', 'Garbage Disposal'],
    description: `Nestled on a peaceful cul-de-sac in Northeast Columbus near the Minerva Park corridor, this versatile 4-bedroom, 2-full-bathroom home delivers 1,500 square feet of finished living space across two functional levels.

The main level features comfortable carpeted bedrooms and a bonus room that easily serves as a dedicated home office, nursery, or additional bedroom. The kitchen comes fully equipped with a stove, refrigerator, built-in microwave, dishwasher, and garbage disposal. 

Downstairs, the finished basement is finished in durable vinyl plank flooring, providing private lower-level bedrooms or secondary living and entertainment quarters alongside a full second bathroom. Step through the rear door to enjoy a private raised wood deck overlooking a fully fenced backyard. Central air conditioning and washer/dryer hookups ensure year-round convenience.

Key Property Features:
• 4 Bedrooms, 2 Full Bathrooms (1,500 sq. ft.)
• Quiet cul-de-sac setting
• Finished basement with vinyl plank flooring
• Main-level bonus room / executive home office option
• Full kitchen appliance package including dishwasher and microwave
• Private rear wood deck and fully fenced yard
• Central air conditioning and forced-air heating
• Convenient driveway parking`
  },
  {
    pipeline_id: 'PP-F5F4FBC5',
    address: '2998 Indianola Ave',
    city: 'Columbus',
    state: 'OH',
    zip: '43202',
    county: 'Franklin County',
    neighborhood: 'Clintonville',
    lat: 40.0242,
    lng: -83.0019,
    property_type: 'TOWNHOUSE',
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 1,
    total_bathrooms: 2,
    square_footage: 1350,
    monthly_rent: 1750,
    security_deposit: 1750,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Dedicated Rear Off-Street Parking',
    garage_spaces: 0,
    heating_type: 'Forced Air Gas Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Refinished Hardwood Floors', 'Ceramic Tile'],
    amenities: [
      'Heart of Historic Clintonville',
      'Original Hardwood Floors & Natural Woodwork Throughout',
      'Remodeled Kitchen with Granite Countertops & Gas Range',
      'Updated 1.5 Bathrooms with First-Floor Powder Room',
      'Inviting Covered Front Porch',
      'Rear Outdoor Patio Area for Grilling',
      'Full Basement for Storage & Laundry Hookups',
      'Dedicated Rear Off-Street Parking',
      'Steps to Studio 35 Cinema, Cafes & Riverside Hospital'
    ],
    appliances: ['Refrigerator', 'Gas Range / Oven', 'Dishwasher', 'Microwave Oven'],
    description: `Immersed in the vibrant center of Clintonville just steps from Studio 35 cinema and local neighborhood cafes, this remodeled 3-bedroom, 1.5-bath townhouse blends classic architectural charm with modern upgrades.

Authentic hardwood floors, rich natural woodwork, updated lighting fixtures, and custom window treatments flow throughout the spacious living and formal dining rooms. The remodeled kitchen is outfitted with granite countertops, abundant cabinetry, a gas range, refrigerator, dishwasher, and microwave. A newly renovated half bath is situated on the first floor for guests.

Upstairs, three well-proportioned bedrooms provide generous closet space and share a remodeled full bathroom. The full basement offers extensive clean storage space and washer/dryer hookups. Outdoor amenities include a classic covered front porch, a rear patio area for grilling, and dedicated off-street parking behind the building.

Key Property Features:
• 3 Bedrooms, 1.5 Bathrooms (approx. 1,350 sq. ft.)
• Prime Clintonville location near Studio 35, yoga studios, and transit
• Genuine hardwood flooring and natural woodwork throughout
• Granite kitchen countertops with gas range and dishwasher
• First-floor powder room and remodeled upper full bath
• Covered front porch and rear grilling patio
• Dedicated off-street parking in rear
• Full basement with washer/dryer hookups`
  },
  {
    pipeline_id: 'PP-991F82C9',
    address: '378-380 Stoddart Ave',
    city: 'Columbus',
    state: 'OH',
    zip: '43205',
    county: 'Franklin County',
    neighborhood: 'Historic Franklin Park',
    lat: 39.9612,
    lng: -82.9641,
    property_type: 'TOWNHOUSE',
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 2700,
    monthly_rent: 1700,
    security_deposit: 1700,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Off-Street Dedicated Parking',
    garage_spaces: 0,
    heating_type: 'Central Heating, Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Hardwood Flooring', 'Hard-Surface Plank', 'Tile'],
    amenities: [
      'Massive 2,700 Sq. Ft. Multi-Level Duplex Layout',
      'Steps to 88-Acre Franklin Park & Botanical Conservatory',
      'Historic Neighborhood Charm with Soaring Ceilings',
      'Expansive Living & Formal Dining Rooms',
      'Flexible Layout for Home Office or Creative Studio',
      'Full Kitchen with Dishwasher & Microwave',
      'Full Basement for Storage & Laundry Hookups',
      'Central Air Conditioning & Heating',
      'Minutes to East Market, Bexley & Downtown Columbus'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave Oven', 'Freezer'],
    description: `Experience the extraordinary scale of a 2,700-square-foot duplex nestled in the heart of historic Franklin Park, surrounded by tree-lined streets and lush parkland.

The home features soaring ceilings and expansive living and dining spaces designed for effortless entertaining, creative studio pursuits, or a dedicated executive home office. The equipped kitchen includes a refrigerator, range, microwave, and dishwasher, accompanied by ample pantry and cabinet storage.

The upper level holds three substantial bedrooms with deep closets and two full bathrooms. The full private basement offers generous additional storage and washer/dryer hookups. Located just steps from the 88-acre Franklin Park, scenic walking trails, the landmark Conservatory & Botanical Gardens, and the East Market, with swift access to Bexley and Downtown Columbus.

Key Property Features:
• 3 Bedrooms, 2 Full Bathrooms (2,700 sq. ft.)
• Rare massive duplex footprint in historic Franklin Park
• Steps from 88-acre Franklin Park and the Conservatory
• Expansive living and dining rooms with high ceilings
• Flexible layout accommodates large home offices or creative studios
• Central air conditioning and forced-air heating
• Full private basement with laundry hookups
• Dedicated off-street parking`
  },
  {
    pipeline_id: 'PP-2B919939',
    address: '267 S Gift St',
    city: 'Columbus',
    state: 'OH',
    zip: '43215',
    county: 'Franklin County',
    neighborhood: 'Franklinton Arts District',
    lat: 39.9548,
    lng: -83.0185,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 2.0,
    half_bathrooms: 1,
    total_bathrooms: 2,
    square_footage: 1100,
    monthly_rent: 1700,
    security_deposit: 1700,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Private Driveway & Off-Street Parking',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Included',
    flooring: ['All-New Modern Plank Flooring', 'Tile'],
    amenities: [
      'Franklinton Arts District with Downtown Skyline Views',
      'Water Utility Included in Rent',
      'Direct Access to Scioto Greenways Bike & Jogging Paths',
      'Comprehensive Renovation with Whole-House Insulation',
      'Modern Eat-In Kitchen with Stainless Steel Appliances',
      'Two Bedrooms Plus Dedicated Den / Home Office',
      'Washer and Dryer Included in Basement',
      'Full Covered Front Porch',
      'Private Driveway & Off-Street Parking',
      'Walk to Franklinton Breweries, COSI & River & Rich'
    ],
    appliances: ['Stainless Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Washer', 'Dryer'],
    description: `Overlooking the Downtown Columbus skyline along the Scioto Greenways in the Franklinton Arts District, this fully renovated two-story single-family home offers 1,100 square feet of modern living with water utility included.

The interior showcases whole-house energy-efficient insulation, high-durability modern plank flooring, and a bright eat-in kitchen with all-new stainless steel appliances including a dishwasher, range, refrigerator, and microwave. The main level also features a convenient half bathroom.

Upstairs, two bedrooms are joined by a versatile den ideal for a work-from-home office, served by an updated full bathroom. The basement includes a washer and dryer and useful storage. Relax on the covered front porch overlooking the yard, and enjoy private driveway parking. Steps to COSI, River & Rich, local craft breweries, art galleries, and Scioto Greenways trails.

Key Property Features:
• 2 Bedrooms + Den / Office, 1.5 Bathrooms (1,100 sq. ft.)
• Franklinton Arts District location with skyline views
• Water utility included in monthly rent
• Fully renovated with new plank flooring and energy-efficient insulation
• Eat-in kitchen with stainless steel appliances
• Dedicated den/office perfect for remote work
• In-unit washer and dryer included in basement
• Private driveway and covered front porch`
  },
  {
    pipeline_id: 'PP-E5B11F19',
    address: '65 Dakota Ave',
    city: 'Columbus',
    state: 'OH',
    zip: '43222',
    county: 'Franklin County',
    neighborhood: 'Franklinton',
    lat: 39.9571,
    lng: -83.0234,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1260,
    monthly_rent: 1695,
    security_deposit: 1695,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Dedicated Off-Street Parking',
    garage_spaces: 0,
    heating_type: 'Forced Air Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Classic Hardwood Flooring', 'Ceramic Tile'],
    amenities: [
      '2 Full Bathrooms with Contemporary Remodeling',
      'Original Hardwood Flooring Throughout',
      'Remodeled Kitchen with Modern Cabinetry & Dishwasher',
      'Dedicated Formal Dining Room',
      'Spacious Rear Entertainment Deck',
      'Fully Fenced Backyard',
      'Central Air Conditioning & Heating',
      'Full Basement for Storage & Laundry Hookups',
      'Dedicated Off-Street Parking'
    ],
    appliances: ['Refrigerator', 'Range / Stove', 'Dishwasher'],
    description: `A charming standalone residence in the revitalized Franklinton neighborhood, this 1,260-square-foot single-family home combines classic hardwood flooring with fully remodeled kitchen and bathroom spaces.

The layout features an open living area flowing into a dedicated formal dining room. The remodeled kitchen is appointed with modern cabinetry, stove, dishwasher, and refrigerator. Two remodeled full bathrooms provide complete privacy and comfort for residents and guests alike.

Two spacious bedrooms feature abundant natural light and generous closet space. Central air conditioning maintains climate comfort throughout the seasons. Outside, a spacious rear entertainment deck overlooks a fully fenced backyard, complemented by a full basement for storage and laundry hookups and off-street parking.

Key Property Features:
• 2 Bedrooms, 2 Full Bathrooms (1,260 sq. ft.)
• Detached single-family residence with fully fenced yard
• Classic hardwood flooring across main living areas
• Remodeled kitchen with modern cabinetry and dishwasher
• Dedicated formal dining room
• Spacious rear entertainment deck
• Central air conditioning and central heating
• Full basement with laundry hookups and off-street parking`
  },
  {
    pipeline_id: 'PP-A97BD16A',
    address: '452 N Ohio Ave',
    city: 'Columbus',
    state: 'OH',
    zip: '43203',
    county: 'Franklin County',
    neighborhood: 'Near East Side / King-Lincoln Bronzeville',
    lat: 39.9734,
    lng: -82.9732,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1200,
    monthly_rent: 1600,
    security_deposit: 1600,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Detached 2-Car Garage & Off-Street Parking',
    garage_spaces: 2,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    flooring: ['Modern Hard-Surface Flooring', 'Designer Tile'],
    amenities: [
      'Complete Top-to-Bottom Renovation',
      'Detached 2-Car Garage with Secure Parking',
      '2 Full Modern Bathrooms',
      'Fresh Contemporary Kitchen Cabinetry & Appliances',
      'Bright Open-Concept Living & Dining Flow',
      'Central Air Conditioning & Heating',
      'Full Basement for Storage & Laundry Hookups',
      'Private Yard Space',
      'Convenient to Downtown Columbus, I-670 & I-71'
    ],
    appliances: ['Refrigerator', 'Range / Oven'],
    description: `Completely renovated from top to bottom, this detached single-family home on North Ohio Avenue offers 1,200 square feet of fresh, contemporary living on Columbus' Near East Side.

The residence features an open-concept living and dining layout accented by brand-new hard-surface flooring and a crisp neutral color palette. The updated kitchen provides clean cabinetry, generous countertop prep area, and equipped appliances including a range and refrigerator.

Two well-appointed bedrooms are complemented by two full remodeled bathrooms featuring modern vanities and designer tile work. A major highlight is the detached 2-car garage, providing secure off-street parking and substantial storage. Additional features include a full basement with laundry hookups and central air conditioning.

Key Property Features:
• 2 Bedrooms, 2 Full Bathrooms (1,200 sq. ft.)
• Comprehensive top-to-bottom renovation
• Detached 2-car garage with private parking and extra storage
• Two fully remodeled modern bathrooms
• Central air conditioning and heating
• Full basement with washer/dryer hookups
• Easy access to Downtown Columbus, King-Lincoln Bronzeville, and major freeways`
  },
  {
    pipeline_id: 'PP-1F7970E9',
    address: '912 Annagladys Dr',
    city: 'Worthington',
    state: 'OH',
    zip: '43085',
    county: 'Franklin County',
    neighborhood: 'Worthington Area / Polaris Corridor',
    lat: 40.1312,
    lng: -82.9961,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 950,
    monthly_rent: 1795,
    security_deposit: 1795,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Two Dedicated Off-Street Parking Spaces',
    garage_spaces: 0,
    heating_type: 'Central Heating, Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Included',
    flooring: ['Hard-Surface Flooring', 'Carpet', 'Tile'],
    amenities: [
      'Worthington Area Location Near Polaris Corridor',
      'Water Utility Included in Monthly Rent',
      'Finished Lower-Level Ensuite with Full Bathroom',
      'Granite Kitchen Countertops & Stainless Appliances',
      'Living Room Fireplace',
      'Washer & Dryer Included in Unit',
      'Private Rear Wood Deck',
      'Two Dedicated Off-Street Parking Spaces',
      'Swift Connectivity to I-71, I-270 & Polaris Parkway'
    ],
    appliances: ['Stainless Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Washer', 'Dryer', 'Freezer'],
    description: `Located in the sought-after Worthington area near Polaris shopping and dining, this updated two-story townhome provides 950 square feet of above-ground living plus a finished lower-level suite. Water utility is included.

The bright main level features an open living and dining area centered around a cozy fireplace, leading to an updated kitchen outfitted with granite countertops and a full suite of stainless steel appliances including a dishwasher and microwave. A private rear deck extends the living space outdoors.

The upper floor holds two quiet bedrooms with closet storage and a full bathroom. The finished lower level is equipped with its own dedicated full bathroom suite, offering outstanding adaptability as a guest suite, media lounge, or private executive office. An in-unit washer and dryer are included, along with two designated off-street parking spaces.

Key Property Features:
• 2 Bedrooms, 2 Full Bathrooms (950 sq. ft. + Finished Lower Level)
• Worthington area location with water utility included
• Finished lower-level ensuite with dedicated second full bath
• Kitchen with granite countertops and stainless steel appliances
• Living room fireplace
• In-unit washer and dryer included
• Private rear wood deck
• Two dedicated off-street parking spaces
• Easy access to Polaris Parkway, I-71, and I-270`
  }
];

function buildDirectUrl(prop) {
  return `${SITE_URL}/property.html?id=${prop.id}`;
}

async function publishBatch() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('  PUBLISHING 13 RECENT PIPELINE PROPERTIES (COLUMBUS / WORTHINGTON)');
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
    const title = `${item.bedrooms}BR ${item.property_type === 'SINGLE_FAMILY' ? 'Single Family Home' : 'Townhome'} in ${item.city}`;

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

  fs.writeFileSync('scripts/published_recent_columbus_results.json', JSON.stringify(publishedResults, null, 2));

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
