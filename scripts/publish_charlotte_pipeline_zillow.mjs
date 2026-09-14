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

// 12 Charlotte Single-Family Homes from Zillow Pipeline with full manual enrichment
const CHARLOTTE_PROPERTIES = [
  {
    pipeline_id: 'PP-82F8894F',
    address: '11312 Deer Chase Ln',
    city: 'Charlotte',
    state: 'NC',
    zip: '28262',
    county: 'Mecklenburg County',
    neighborhood: 'University City North / Mallard Creek',
    lat: 35.34812,
    lng: -80.75124,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 4,
    bathrooms: 2.5,
    half_bathrooms: 1,
    total_bathrooms: 3,
    square_footage: 1916,
    monthly_rent: 1899,
    security_deposit: 1899,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Off-Street Driveway',
    garage_spaces: 0,
    heating_type: 'Central Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Upper-Level Dedicated Laundry Room',
    flooring: ['Hardwood-Style Vinyl Plank', 'Plush Carpet', 'Tile'],
    amenities: [
      'Vaulted Ceilings in Primary Suite',
      'Galley-Style Kitchen with Ample Cabinetry',
      'Separate Formal Dining Room',
      'Expansive Main-Floor Living Room',
      'Upper-Level Laundry Room',
      'Generous Walk-In Closet Storage',
      'Central Climate Control System',
      'Spacious Yard Area',
      'Pet-Friendly Living'
    ],
    appliances: ['Refrigerator', 'Electric Range / Oven', 'Dishwasher', 'Microwave', 'Washer/Dryer Hookups'],
    description: `A thoughtfully designed two-story layout highlights this 4-bedroom, 2.5-bathroom residence situated in the vibrant University City North corridor of Charlotte.

The ground floor welcomes you with an expansive living room bathed in natural light, connecting smoothly to a dedicated formal dining room ideal for shared meals and gatherings. The functional galley kitchen provides generous countertop prep space and abundant cabinetry storage. A discreet half bathroom on the main level adds everyday practicality for visiting guests.

All four bedrooms are situated privately on the second level. The primary suite features impressive vaulted ceilings, oversized windows, expansive closet capacity, and an en-suite full bathroom. Three additional bedrooms share a full hallway bath and enjoy quick access to the dedicated upper-floor laundry room. Situated conveniently near Mallard Creek, UNC Charlotte, and major thoroughfares including I-85 and I-485.

Key Property Features:
• 4 Bedrooms, 2.5 Bathrooms (1,916 sq. ft.)
• Primary retreat with vaulted ceilings and en-suite bath
• Separate formal dining room and spacious living area
• Dedicated second-floor laundry room with hookups
• Complete central heating and air conditioning
• Private driveway parking
• Pet-friendly accommodation for dogs and cats

Application Information:
• Monthly Rent: $1,899
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt verification.`
  },
  {
    pipeline_id: 'PP-76561956',
    address: '4208 Bowline Dr',
    city: 'Charlotte',
    state: 'NC',
    zip: '28269',
    county: 'Mecklenburg County',
    neighborhood: 'North Charlotte / Derita',
    lat: 35.31245,
    lng: -80.79632,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 4,
    bathrooms: 2.5,
    half_bathrooms: 1,
    total_bathrooms: 3,
    square_footage: 1660,
    monthly_rent: 1995,
    security_deposit: 1995,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Driveway & Garage Parking',
    garage_spaces: 1,
    heating_type: 'Central Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Hardwood-Style Plank', 'Carpet'],
    amenities: [
      'Large Open Living Spaces',
      'Expansive Private Backyard',
      'Main-Level Guest Powder Room',
      'Comfortable Primary Suite with En-Suite Bath',
      'Abundant Storage & Closet Space',
      'Modern Kitchen with Solid Countertops',
      'Energy-Efficient Central HVAC',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Washer/Dryer Hookups'],
    description: `Generous interior proportions and an expansive outdoor footprint define this 4-bedroom, 2.5-bathroom single-family home located on a peaceful residential street in North Charlotte.

Inside, the open-concept living area receives consistent daylight throughout the day, creating an inviting setting for relaxation and entertainment. The kitchen is outfitted with extensive counter space and clean cabinetry storage, positioned conveniently adjacent to the dining space. 

Upstairs, the comfortable primary bedroom provides a secluded retreat complete with a private en-suite bathroom and substantial closet storage. Three secondary bedrooms offer versatile options for family living, guest rooms, or a dedicated home workspace. Outside, the large backyard provides open space for outdoor leisure, weekend activities, and pet exercise. Conveniently positioned for fast access to Uptown Charlotte, Concord Mills, and major highway routes.

Key Property Features:
• 4 Bedrooms, 2.5 Bathrooms (1,660 sq. ft.)
• Spacious open living room and dining zone
• Primary bedroom suite with private bathroom
• Large backyard offering versatile outdoor space
• Central HVAC climate control
• Off-street driveway and garage parking
• Welcoming pet policy for dogs and cats

Application Information:
• Monthly Rent: $1,995
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-EDFF2F55',
    address: '6217 Bandy Dr',
    city: 'Charlotte',
    state: 'NC',
    zip: '28227',
    county: 'Mecklenburg County',
    neighborhood: 'East Charlotte / Idlewild',
    lat: 35.18432,
    lng: -80.71895,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 4,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2,
    square_footage: 1632,
    monthly_rent: 1975,
    security_deposit: 1975,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached 1-Car Garage & Driveway',
    garage_spaces: 1,
    heating_type: 'Central Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Hardwood Flooring', 'Tile', 'Carpet'],
    amenities: [
      'Main-Floor Primary Bedroom Suite',
      'Large Rear Entertainment Deck',
      'Spacious Fenced Backyard',
      'Attached 1-Car Garage with Storage',
      'Walk-In Closets in Multiple Bedrooms',
      'Quiet Mature Neighborhood Setting',
      'Central Climate Control',
      'Pet-Friendly Living'
    ],
    appliances: ['Dishwasher', 'Garbage Disposal', 'Microwave Oven', 'Refrigerator', 'Range / Oven', 'Washer/Dryer Hookups'],
    description: `Featuring a rare main-floor primary suite and an expansive rear entertainment deck, this 4-bedroom, 2-bathroom residence offers exceptional layout flexibility in East Charlotte.

The ground-floor primary bedroom provides complete single-level convenience, featuring an oversized walk-in closet and private full bathroom. The main living room flows naturally into an open dining area and a fully equipped kitchen complete with refrigerator, dishwasher, microwave, and garbage disposal. 

The upper floor accommodates three sizable secondary bedrooms and a second full bathroom, with one bedroom featuring a walk-in closet. Sliding glass doors lead from the living area to an expansive elevated deck overlooking the spacious, fenced backyard—an ideal setting for outdoor dining and pet play. Complete with an attached 1-car garage and off-street driveway parking. Situated in a mature, established neighborhood convenient to local shopping and commuter routes.

Key Property Features:
• 4 Bedrooms, 2 Full Bathrooms (1,632 sq. ft.)
• Downstairs primary bedroom with walk-in closet and en-suite bath
• Large rear entertainment deck and fenced backyard
• Attached 1-car garage and driveway parking
• Fully equipped kitchen with full appliance suite
• Three upper-level bedrooms with ample closet space
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,975
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-595B005A',
    address: '6114 Patric Alan Ct',
    city: 'Charlotte',
    state: 'NC',
    zip: '28216',
    county: 'Mecklenburg County',
    neighborhood: 'Northwest Charlotte / Mountain Island',
    lat: 35.30987,
    lng: -80.91243,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 4,
    bathrooms: 2.5,
    half_bathrooms: 1,
    total_bathrooms: 3,
    square_footage: 1704,
    monthly_rent: 1905,
    security_deposit: 1905,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached Garage & Driveway',
    garage_spaces: 1,
    heating_type: 'Central Heating with Fireplace Feature',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated In-Unit Laundry Room',
    flooring: ['Durable Vinyl Plank Flooring', 'Plush Carpet'],
    amenities: [
      'Smart Home Features & Thermostat',
      'Expansive Great Room with Focal Fireplace',
      'Eat-In Kitchen with Walk-In Pantry',
      'Oversized Soaking Bathtub & Walk-In Shower',
      'Ceiling Fans in Living Spaces',
      'Attached Garage Parking',
      'Private Cul-de-Sac Setting',
      'Dedicated Laundry Room',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Electric Range / Oven', 'Dishwasher', 'Microwave', 'Washer/Dryer Hookups'],
    description: `Nestled at the end of a quiet residential cul-de-sac in Northwest Charlotte, this contemporary 4-bedroom, 2.5-bathroom two-story home blends connected smart home convenience with generous interior living space.

The heart of the home is a dramatic great room complemented by a stylish fireplace feature and high-grade plank flooring. The adjacent eat-in kitchen includes a walk-in pantry, modern cabinetry, and ample counter space for casual dining. A main-floor half bath and separate laundry room add everyday convenience.

Upstairs, the primary suite includes a private bathroom outfitted with an oversized soaking bathtub, separate walk-in shower, and generous vanity space. Three additional bedrooms provide comfortable quarters with substantial closet storage. Situated close to Mountain Island Lake, Riverbend Village retail, and highway access to I-485.

Key Property Features:
• 4 Bedrooms, 2.5 Bathrooms (1,704 sq. ft.)
• Open great room with fireplace centerpiece
• Eat-in kitchen featuring a walk-in storage pantry
• Primary bathroom with oversized tub and walk-in shower
• Smart home technology integration
• Attached garage and private cul-de-sac positioning
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,905
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt review.`
  },
  {
    pipeline_id: 'PP-E02AAC6E',
    address: '4013 Fifendrum Ln',
    city: 'Charlotte',
    state: 'NC',
    zip: '28216',
    county: 'Mecklenburg County',
    neighborhood: 'Northwest Charlotte / Long Creek',
    lat: 35.32145,
    lng: -80.89432,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 4,
    bathrooms: 2.5,
    half_bathrooms: 1,
    total_bathrooms: 3,
    square_footage: 1744,
    monthly_rent: 1935,
    security_deposit: 1935,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached Garage & Driveway Parking',
    garage_spaces: 1,
    heating_type: 'Central Heating with Fireplace',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Modern Plank Flooring', 'Plush Carpet'],
    amenities: [
      'Stainless Steel Kitchen Appliances',
      'Dual-Vanity Sinks in Primary Bath',
      'Walk-In Shower & Garden Tub',
      'Smart Home Features',
      'Spacious Great Room with Fireplace',
      'Kitchen Pantry with Storage Shelving',
      'Large Walk-In Closets',
      'Attached Garage Parking',
      'Pet-Friendly Living'
    ],
    appliances: ['Stainless Steel Refrigerator', 'Stainless Steel Range / Oven', 'Stainless Steel Dishwasher', 'Built-in Microwave', 'Washer/Dryer Hookups'],
    description: `Modern finishes, stainless steel appliances, and smart home connectivity highlight this spacious 4-bedroom, 2.5-bathroom two-story home in the Long Creek area of Northwest Charlotte.

The expansive main floor centers around an airy great room with an integrated fireplace and resilient plank flooring throughout high-traffic areas. The kitchen is fully equipped with stainless steel appliances, clean cabinetry, a dedicated walk-in pantry, and an open transition to the dining space.

The second floor features four sizable bedrooms including a generous primary retreat with large walk-in closets and an en-suite bath with dual-vanity sinks, garden tub, and a separate walk-in shower. Three additional bedrooms offer flexible layouts for family, work-from-home office setups, or hobbies. Positioned near neighborhood parks, retail centers, and direct highway corridors.

Key Property Features:
• 4 Bedrooms, 2.5 Bathrooms (1,744 sq. ft.)
• Stainless steel kitchen appliance suite
• Primary en-suite with dual-sink vanity and walk-in shower
• Great room layout with central fireplace
• Smart home enabled system
• Attached garage and private driveway
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,935
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-CBF067A1',
    address: '5121 Magnasco Ln',
    city: 'Charlotte',
    state: 'NC',
    zip: '28208',
    county: 'Mecklenburg County',
    neighborhood: 'West Charlotte / Clanton Park',
    lat: 35.21542,
    lng: -80.89764,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 4,
    bathrooms: 2.5,
    half_bathrooms: 1,
    total_bathrooms: 3,
    square_footage: 1533,
    year_built: 2007,
    monthly_rent: 1955,
    security_deposit: 1955,
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
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Hardwood-Style Flooring', 'Carpet'],
    amenities: [
      '2007 Solid Construction',
      'Versatile Open Floor Plan',
      'Spacious Kitchen with Abundant Cabinetry',
      'Main-Floor Guest Half Bath',
      'Substantial Bedroom Closet Storage',
      'Central Climate Control System',
      'Private Yard Space',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Washer/Dryer Hookups'],
    description: `Constructed in 2007, this well-proportioned 4-bedroom, 2.5-bathroom single-family residence delivers 1,533 sq. ft. of versatile living space in West Charlotte.

The main level features an open layout with durable flooring, uniting the central living area and dining zone with a fully equipped kitchen boasting generous cabinet storage and countertop prep space. A convenient powder room is situated on the first floor for guests.

Upstairs, the primary bedroom suite offers a peaceful sanctuary with an attached private full bathroom and generous closet space. Three additional bedrooms provide comfortable accommodations, each with ample natural light and closet storage. Situated with quick access to Charlotte Douglas International Airport, Billy Graham Parkway, and Uptown Charlotte.

Key Property Features:
• 4 Bedrooms, 2.5 Bathrooms (1,533 sq. ft.)
• Open main-floor living and dining space
• Dedicated primary suite with private bath
• Kitchen with full appliance setup and extensive cabinetry
• Central heating and cooling system
• Off-street driveway parking
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,955
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-FBEEA716',
    address: '2627 Marmac Rd',
    city: 'Charlotte',
    state: 'NC',
    zip: '28208',
    county: 'Mecklenburg County',
    neighborhood: 'West Charlotte / Ashley Park',
    lat: 35.23412,
    lng: -80.89123,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 4,
    bathrooms: 2.5,
    half_bathrooms: 1,
    total_bathrooms: 3,
    square_footage: 1462,
    monthly_rent: 1825,
    security_deposit: 1825,
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
    laundry_type: 'Dedicated Laundry Room with Hookups',
    flooring: ['Luxury Vinyl Plank', 'Plush Carpet'],
    amenities: [
      'Quartz Kitchen Countertops',
      'Stainless Steel Appliances',
      'Eat-In Kitchen with Walk-In Pantry',
      'Oversized Soaking Bathtub',
      'Ceiling Fans in Living Spaces',
      'Smart Home Technology',
      'Attached Garage Parking',
      'Private Yard Area',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Stainless Steel Refrigerator', 'Stainless Steel Stove / Range', 'Stainless Steel Dishwasher', 'Microwave', 'Washer/Dryer Hookups'],
    description: `Modern kitchen upgrades including elegant quartz countertops and stainless steel appliances elevate this 4-bedroom, 2.5-bathroom single-family home in West Charlotte.

The first floor centers around an eat-in kitchen complete with quartz surfaces, stainless steel appliances, a walk-in pantry, and direct sightlines to the sunlit living area. A main-floor guest half bath and separate laundry space provide effortless daily functionality.

Upstairs, the primary bedroom suite features a private bath with an oversized soaking tub and generous walk-in closet space. Three additional bedrooms offer flexible arrangements for family, guest quarters, or home offices. Outside, enjoy an attached garage and private yard space. Located minutes from Uptown Charlotte, freedom parkways, and local transit.

Key Property Features:
• 4 Bedrooms, 2.5 Bathrooms (1,462 sq. ft.)
• Kitchen featuring quartz countertops and stainless appliances
• Eat-in kitchen with dedicated walk-in pantry
• Primary suite with oversized soaking bathtub and walk-in closet
• Smart home features and central climate control
• Attached garage and private driveway
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,825
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-5A2B016B',
    address: '1426 Peach Park Ln',
    city: 'Charlotte',
    state: 'NC',
    zip: '28216',
    county: 'Mecklenburg County',
    neighborhood: 'Peachtree Hills / Northwest Charlotte',
    lat: 35.31782,
    lng: -80.86541,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 4,
    bathrooms: 2.5,
    half_bathrooms: 1,
    total_bathrooms: 3,
    square_footage: 1449,
    year_built: 2003,
    monthly_rent: 1800,
    security_deposit: 1800,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached 1-Car Garage & Driveway',
    garage_spaces: 1,
    heating_type: 'Central Air, Gas Hot Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Upper-Level Dedicated Laundry Area',
    flooring: ['Hardwood-Style Plank', 'Carpet'],
    amenities: [
      'Living Room with Cozy Fireplace',
      'Granite Kitchen Countertops',
      'Primary Suite with Vaulted Ceiling',
      'Dual-Vanity Sinks & Garden Soaking Tub',
      'Private Fenced Backyard with Patio',
      'Attached 1-Car Garage',
      'Central Climate Control & Gas Heat',
      'Pet-Friendly Living'
    ],
    appliances: ['Dishwasher', 'Refrigerator', 'Electric Stove / Range', 'Washer/Dryer Hookups'],
    description: `A warm living room fireplace, granite countertops, and a private fenced backyard showcase this attractive 4-bedroom, 2.5-bathroom home in the Peachtree Hills neighborhood of Northwest Charlotte.

The main level offers a spacious living room centered around a fireplace, connecting smoothly to a dedicated dining area and an updated kitchen with solid granite counters and matching appliances. 

The upper floor holds all four bedrooms, led by a primary suite featuring vaulted ceilings, a large walk-in closet, and an en-suite bathroom with dual vanities and a relaxing garden tub. Three secondary bedrooms and a second full bath complete the top level. Outside, step out to a concrete patio and a fully fenced backyard ideal for pets and outdoor leisure. Complete with an attached 1-car garage. Conveniently located near Sunset Road with swift access to I-77, I-85, Northlake Mall, and Uptown.

Key Property Features:
• 4 Bedrooms, 2.5 Bathrooms (1,449 sq. ft.)
• Living room with fireplace focal point
• Updated kitchen featuring granite countertops
• Primary retreat with vaulted ceilings, dual vanity, and garden tub
• Fully fenced private backyard with outdoor patio
• Attached 1-car garage and off-street driveway
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,800
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-570C7143',
    address: '13121 Plaza Road Ext',
    city: 'Charlotte',
    state: 'NC',
    zip: '28215',
    county: 'Cabarrus County',
    neighborhood: 'Cabarrus Woods / East Charlotte',
    lat: 35.28914,
    lng: -80.64321,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 4,
    bathrooms: 2.5,
    half_bathrooms: 1,
    total_bathrooms: 3,
    square_footage: 1568,
    monthly_rent: 2000,
    security_deposit: 2000,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached Garage & Driveway',
    garage_spaces: 1,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning with Newer Outdoor Unit',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Brand New Luxury Flooring', 'Fresh Interior Paint'],
    amenities: [
      'New Granite Kitchen Countertops',
      'Fresh Neutral Interior Paint',
      'New Flooring Throughout Entire Home',
      'Open-Concept Main Level Layout',
      'Attached Garage Parking',
      'Updated Central Air Conditioning System',
      'Spacious Yard Space',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Oven / Stove', 'Dishwasher', 'Microwave Oven', 'Washer/Dryer Hookups'],
    description: `Fresh interior paint, brand-new flooring throughout, and polished granite countertops highlight this refreshed 4-bedroom, 2.5-bathroom residence in the Cabarrus Woods community of Charlotte.

The two-story floor plan features an open-concept living and dining area on the ground floor, offering a bright and adaptable layout for daily living and social entertaining. The kitchen is outfitted with new granite counters and reliable appliances, including a refrigerator, range, microwave, and dishwasher.

The upper level contains four generously sized bedrooms and two full bathrooms, while a main-level half bath serves guests. Additional practical features include in-home washer/dryer hookups, an attached garage for covered parking and storage, and a modern central cooling system. Ideally situated near I-485 for rapid access to University City, UNC Charlotte, greenway trails, Concord Mills, and shopping centers.

Key Property Features:
• 4 Bedrooms, 2.5 Bathrooms (1,568 sq. ft.)
• Brand new flooring and fresh interior paint throughout
• Kitchen with new granite countertops and full appliance set
• Open-concept living and dining area
• Modern central air conditioning with newer outdoor HVAC unit
• Attached garage and private driveway
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $2,000
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-53CC9EA0',
    address: '6443 Brumit Ln',
    city: 'Charlotte',
    state: 'NC',
    zip: '28269',
    county: 'Mecklenburg County',
    neighborhood: 'Oakbrooke / North Charlotte',
    lat: 35.34562,
    lng: -80.81234,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 4,
    bathrooms: 2.5,
    half_bathrooms: 1,
    total_bathrooms: 3,
    square_footage: 2270,
    monthly_rent: 1975,
    security_deposit: 1975,
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
    laundry_type: 'Upper-Level Dedicated Laundry Room',
    flooring: ['Hardwood-Style Plank', 'Carpet', 'Tile'],
    amenities: [
      'Expansive 2,270 Sq. Ft. Floor Plan',
      'Formal Living & Formal Dining Rooms',
      'Massive Great Room Open to Kitchen',
      'Attached 2-Car Garage',
      'Primary Suite with Dual Vanities, Garden Tub & Separate Shower',
      'Second-Floor Dedicated Laundry Room',
      'Large Walk-In Closets & Storage Space',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Washer/Dryer Hookups'],
    description: `Offering an expansive 2,270 square foot layout, this substantial 4-bedroom, 2.5-bathroom single-family home in Charlotte's Oakbrooke community delivers generous living zones and executive-level space.

The ground floor features formal living and dining rooms alongside an oversized open kitchen with extensive cabinetry and an eat-in breakfast area that flows directly into a massive great room. A half bathroom on the main level adds convenience.

All four bedrooms and the dedicated laundry room are situated on the second level. The primary suite serves as a true private retreat with dual-vanity sinks, an oversized garden tub, a separate stand-up shower, and an expansive walk-in closet. The secondary bedrooms are generously sized with exceptional closet and storage capacity. An attached 2-car garage provides extensive covered parking and workshop storage. Conveniently situated in North Charlotte close to I-77, I-485, and retail amenities.

Key Property Features:
• 4 Bedrooms, 2.5 Bathrooms (2,270 sq. ft.)
• Formal living room, formal dining room, and massive great room
• Primary suite with dual vanities, garden tub, and separate walk-in shower
• Second-floor dedicated laundry room
• Attached 2-car garage with expansive driveway
• Abundant closet and storage space throughout
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,975
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    pipeline_id: 'PP-66977F1C',
    address: '8301 Nathanael Greene Ln',
    city: 'Charlotte',
    state: 'NC',
    zip: '28227',
    county: 'Mecklenburg County',
    neighborhood: 'East Charlotte / Mint Hill Border',
    lat: 35.19652,
    lng: -80.68412,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 4,
    bathrooms: 2.5,
    half_bathrooms: 1,
    total_bathrooms: 3,
    square_footage: 1636,
    monthly_rent: 2000,
    security_deposit: 2000,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Driveway Parking',
    garage_spaces: 0,
    heating_type: 'Central Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Included',
    flooring: ['Hardwood-Style Plank', 'Carpet'],
    amenities: [
      'Split-Level Architectural Design',
      'Washer & Dryer Included in Unit',
      'Expansive Living Room with Sunlit Windows',
      'Large Open Yard Space',
      'Main-Level Powder Room',
      'Well-Proportioned Bedroom Layouts',
      'Central Climate Control System',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Washer', 'Dryer'],
    description: `A distinctive split-level architectural layout and a bright, welcoming interior highlight this 4-bedroom, 2.5-bathroom single-family residence in East Charlotte.

The home centers around a generous living room with large windows that invite abundant natural light, creating an open atmosphere for relaxation and hosting. The kitchen and adjoining dining area offer practical meal preparation space and ample cabinetry.

Four bedrooms provide flexible accommodations, complemented by 2.5 bathrooms throughout the multi-level floor plan. An in-unit washer and dryer are included for maximum everyday convenience. Outside, the large yard offers expansive green space for outdoor leisure and pet activities. Conveniently located near shopping, dining, parks, and commuter thoroughfares connecting to central Charlotte.

Key Property Features:
• 4 Bedrooms, 2.5 Bathrooms (1,636 sq. ft.)
• Distinctive split-level design with spacious living areas
• In-unit washer and dryer included
• Large open yard offering abundant outdoor space
• Central heating and air conditioning
• Private off-street driveway parking
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $2,000
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for prompt processing.`
  },
  {
    pipeline_id: 'PP-20090420',
    address: '1231 Joannas Ct',
    city: 'Charlotte',
    state: 'NC',
    zip: '28214',
    county: 'Mecklenburg County',
    neighborhood: 'West Charlotte / Moores Chapel',
    lat: 35.26541,
    lng: -80.93812,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 4,
    bathrooms: 2.5,
    half_bathrooms: 1,
    total_bathrooms: 3,
    square_footage: 1535,
    monthly_rent: 1950,
    security_deposit: 1950,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached Garage & Driveway',
    garage_spaces: 1,
    heating_type: 'Central Heat Pump',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Upper-Level Dedicated Laundry Room (Washer & Dryer Included)',
    flooring: ['Hardwood-Style Plank', 'Carpet'],
    amenities: [
      'Formal Dining Room with Elegant Tray Ceiling',
      'Fully Fenced Backyard with Sliding Door Access',
      'Oversized Kitchen with Breakfast Nook',
      'Primary Suite with Vaulted Ceiling & Walk-In Closet',
      'Garden Soaking Tub & Dual Vanity in En-Suite Bath',
      'Washer & Dryer Included in Dedicated Laundry Room',
      'Attached Garage & Quiet Cul-de-Sac Setting',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Washer', 'Dryer'],
    description: `A formal dining room with tray ceilings, an oversized kitchen with breakfast nook, and a fully fenced backyard highlight this 4-bedroom, 2.5-bathroom single-family home on a quiet cul-de-sac in West Charlotte.

The ground floor features a bright living room, a formal dining room defined by an elegant tray ceiling, and a generous kitchen with a breakfast nook and sliding glass door access to the private, fully fenced backyard. 

The upper floor accommodates the primary bedroom retreat featuring vaulted ceilings, a large walk-in closet, and an en-suite bathroom equipped with dual-sink vanity and garden soaking tub. Three secondary bedrooms, a shared full bath, and an upper-level laundry room with included washer and dryer complete the upper level. Situated with swift access to I-85, Charlotte Douglas International Airport, and Uptown Charlotte.

Key Property Features:
• 4 Bedrooms, 2.5 Bathrooms (1,535 sq. ft.)
• Formal dining room with tray ceiling and spacious living room
• Oversized kitchen with breakfast nook and fenced yard access
• Primary suite with vaulted ceiling, dual vanity, and garden tub
• Washer and dryer included in upper-level laundry room
• Fully fenced private backyard and attached garage
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,950
• Application Fee: $50 per adult applicant

Apply now through Choice Properties. Submit your application online for fast processing.`
  }
];

function buildDirectUrl(p) {
  return `${SITE_URL}/property.html?id=${p.id}`;
}

async function publishCharlotteBatch() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('  Choice Properties — Charlotte, NC Pipeline Publishing');
  console.log(`  Processing ${CHARLOTTE_PROPERTIES.length} Fully Enriched Properties`);
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

    // 2. Generate UUID for public.properties
    const propId = crypto.randomUUID();
    const title = `${item.bedrooms}BR/${item.bathrooms}BA Single-Family Home in ${item.city} – $${item.monthly_rent}/mo`;

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

    // 3. Insert into public.properties
    const insertPropRes = await fetch(`${SUPABASE_URL}/rest/v1/properties`, {
      method: 'POST',
      headers: { ...HEADERS, 'Prefer': 'return=representation' },
      body: JSON.stringify(propRecord)
    });

    if (!insertPropRes.ok) {
      const errText = await insertPropRes.text();
      console.error(`   ✗ Failed to insert property ${item.address}: ${insertPropRes.status} ${errText}`);
      continue;
    }
    console.log(`   ✓ Inserted property into public.properties (ID: ${propId})`);

    // 4. Insert photo records into public.property_photos
    const photoRows = photoUrls.map((url, idx) => ({
      property_id: propId,
      url: url,
      display_order: idx + 1,
      is_hero: idx === 0,
      watermark_status: 'clean',
      alt_text: `${item.address}, ${item.city} NC - Photo ${idx + 1}`
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

  fs.writeFileSync('scripts/published_charlotte_results.json', JSON.stringify(publishedResults, null, 2));

  console.log('═════════════════════════════════════════════════════════════════');
  console.log(`  CHARLOTTE, NC — PUBLISHED ${publishedResults.length} PROPERTIES`);
  console.log('═════════════════════════════════════════════════════════════════\n');

  publishedResults.forEach((r, idx) => {
    console.log(`${idx + 1}. ${r.address}, ${r.city}, ${r.state} ${r.zip} ($${r.rent}/mo | ${r.beds} Bed / ${r.baths} Bath) — ${r.directUrl}`);
  });

  return publishedResults;
}

publishCharlotteBatch().catch(err => {
  console.error('Fatal error during publish:', err);
  process.exit(1);
});
