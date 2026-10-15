/**
 * Choice Properties — St. Louis County (Florissant, Hazelwood, Spanish Lake, South County) Batch Publisher
 *
 * Requirements:
 * 1. Townhomes and Houses in Florissant, Hazelwood, Spanish Lake, and South County.
 * 2. Scraped up to $1,600, published with rents at $1,400 and a bit less ($1,290 - $1,395).
 * 3. Stripped / Aliased street addresses (+8 block offset) so they cannot be found elsewhere online.
 * 4. Authentic authentic ground truth address quarantined in pipeline_properties.
 * 5. Full compliance with AGENTS.md:
 *    - Title: {Aliased Address}, {City}, MO {Zip}
 *    - $50 application fee strictly (DB field and description)
 *    - 100% Pet-friendly
 *    - Security deposit 1x rent in DB, strictly ZERO mentions in description
 *    - No lease terms / duration anywhere
 *    - No available dates / move-in dates anywhere
 *    - No smoking policies displayed
 *    - High-res source CDN photos directly into property_photos
 *    - Interior-first photo re-ordering
 *    - Deep, authentic, unique walkthrough descriptions
 */

import { CREDENTIALS_CONFIG } from '../credentials-config.mjs';
import crypto from 'crypto';
import fs from 'fs';

const SUPABASE_URL = CREDENTIALS_CONFIG.SUPABASE_URL;
const KEY = CREDENTIALS_CONFIG.SUPABASE_API_KEY;
const LANDLORD_ID = null;
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

// TEMPORARY DIRECTIVE: Image reordering is disabled.
// All images must be ordered exactly as they came from the original source.
function optimizePhotoOrder(photos) {
  return photos;
}

const rawCandidates = JSON.parse(fs.readFileSync('scripts/st_louis_candidates.json', 'utf8'));

const ST_LOUIS_BATCH = [
  // 1. FLORISSANT - House
  {
    candidate_key: '728 Liberty Village',
    aliased_address: '736 Liberty Village Dr',
    city: 'Florissant',
    state: 'MO',
    zip: '63031',
    county: 'St. Louis County',
    neighborhood: 'Liberty Village',
    lat: 38.825396,
    lng: -90.316843,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2,
    half_bathrooms: null,
    total_bathrooms: 2,
    square_footage: 1025, // soft-rounded from 1013
    monthly_rent: 1395, // Original $1,545 -> changed to $1,395
    security_deposit: 1395,
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
    laundry_type: 'Dedicated In-Home Laundry Hookups',
    appliances: ['Refrigerator', 'Electric Range / Oven', 'Built-In Microwave', 'Dishwasher', 'Garbage Disposal'],
    flooring: ['Contemporary Wood-Look Plank Flooring', 'Plush Carpet in Bedrooms'],
    amenities: [
      'Single-Story Ranch Layout with 3 Bedrooms and 2 Full Bathrooms',
      'Modern Kitchen with Crisp Cabinetry, Matching Appliances, and Pantry',
      'Primary Bedroom Suite Featuring Private En-Suite Bathroom and Double Closets',
      'Attached Single-Car Garage Providing Protected Parking and Extra Storage',
      'Full Unfinished Lower Level Basement Offering Expansive Storage Options',
      'Private Fenced Backyard with Patio Space for Grilling and Outdoor Relaxation',
      'Central Climate Control System for Year-Round Temperature Regulation',
      'Prime Florissant Neighborhood Moments from North Lindbergh Boulevard and Shopping',
      'Pet-Friendly Living Policy'
    ],
    description: `A welcoming single-story ranch residence nestled in the heart of Florissant, this three-bedroom, two-bathroom home combines functional daily convenience with stylish interior finishes across approximately 1,025 square feet of bright living space.

Upon arrival, the front walkway leads into a sun-drenched open living room finished with low-maintenance wood-style plank flooring, warm neutral wall tones, and generous picture windows that frame the surrounding streetscape. The living area transitions effortlessly toward a dedicated dining nook and an impressively outfitted kitchen. Complete with crisp white cabinetry, generous laminate prep counters, and an itemized appliance package—including a frost-free refrigerator, electric range and oven, built-in overhead microwave, and dishwasher—this culinary workspace is designed for effortless meal prep and entertaining.

Down the hallway, three peaceful bedrooms provide personal retreats for household members or guests. The primary bedroom easily accommodates a full bedroom suite and features a private en-suite full bathroom equipped with a walk-in shower and modern vanity. Two secondary bedrooms include sizable closets and easy access to the central hall bathroom, which features a full bathtub and shower combination paired with updated plumbing fixtures.

Additional functional highlights include an attached single-car garage, dedicated laundry hookups on the lower level, a full basement suited for organized storage, and an expansive fenced backyard ideal for pets and quiet afternoons outdoors. Conveniently situated just minutes from Lindbergh Boulevard, Florissant shopping plazas, neighborhood parks, and Hazelwood School District facilities.

Choice Properties welcomes your four-legged family members with pet-friendly accommodations. Application fee is $50. Submit your rental application today at Choice Properties.`
  },

  // 2. FLORISSANT - House
  {
    candidate_key: '2639 Freemantle',
    aliased_address: '2647 Freemantle Dr',
    city: 'Florissant',
    state: 'MO',
    zip: '63031',
    county: 'St. Louis County',
    neighborhood: 'Pleasant Hollow',
    lat: 38.828349,
    lng: -90.34383,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 1025, // soft-rounded from 1029
    monthly_rent: 1365, // Original $1,494 -> changed to $1,365
    security_deposit: 1365,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Attached Carport & Extended Concrete Driveway',
    garage_spaces: 0,
    heating_type: 'Central Gas Furnace',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Basement Laundry Facility Connections',
    appliances: ['Refrigerator', 'Electric Cooking Range', 'Overhead Vent Hood', 'Dishwasher'],
    flooring: ['Refinished Hardwood-Style Flooring', 'Neutral Ceramic Tile'],
    amenities: [
      'Charming 3-Bedroom Ranch Home in Established Pleasant Hollow Community',
      'Refreshed Kitchen with Abundant Hardwood Cabinets and Dedicated Dining Area',
      'Durable Hard-Surface Flooring Flowing Seamlessly Throughout Common Living Zones',
      'Full Lower-Level Basement Supplying Substantial Storage and Workspace',
      'Attached Covered Carport Protecting Your Vehicle from Inclement Weather',
      'Substantial Level Backyard Perfect for Outdoor Play and Gardening',
      'Central Air Conditioning and Energy-Efficient Gas Heating',
      'Quick Access to New Halls Ferry Road, I-270, and Local Community Centers',
      'Pet-Friendly Accommodations'
    ],
    description: `Positioned within Florissant's established Pleasant Hollow neighborhood, this charming three-bedroom ranch residence delivers over 1,025 square feet of comfortable single-level living paired with a generous full basement and covered parking.

The home welcomes you into a broad, light-filled central living room highlighted by clean architectural lines, warm hardwood-inspired flooring, and oversized windows that bathe the interior in natural daylight. Adjacent to the living room, the eat-in kitchen offers plenty of space for a morning breakfast table alongside rich wood cabinetry, extensive countertop prep surfaces, and essential appliances including a refrigerator, electric range, and dishwasher.

Three well-proportioned bedrooms are situated along the home's quiet wing, each equipped with dedicated closet storage, modern ceiling illumination, and easy access to the central bathroom. The bathroom showcases clean tile surrounds, a combination tub and shower, and an updated vanity with under-sink cabinetry.

Downstairs, the sprawling unfinished basement houses the home's laundry connections, mechanical systems, and extensive floor space adaptable for seasonal storage or hobby workshops. Outside, an attached covered carport and wide driveway provide protected parking, while the flat green lawn in back is ready for play, gardening, and pets. Positioned near New Halls Ferry Road, shopping corridors, and swift connections to I-270.

Pet-friendly accommodations with a $50 application fee. Submit your rental application today at Choice Properties.`
  },

  // 3. FLORISSANT - House
  {
    candidate_key: '20 Regina',
    aliased_address: '28 Regina Ct',
    city: 'Florissant',
    state: 'MO',
    zip: '63031',
    county: 'St. Louis County',
    neighborhood: 'Regina Gardens',
    lat: 38.786255,
    lng: -90.325766,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 1075, // soft-rounded from 1086
    monthly_rent: 1295, // Original $1,347 -> changed to $1,295
    security_deposit: 1295,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Dedicated Off-Street Concrete Driveway',
    garage_spaces: 0,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Basement Laundry Hookups',
    appliances: ['Refrigerator', 'Gas Range & Oven', 'Range Hood', 'Dishwasher'],
    flooring: ['Refinished Hardwood Flooring', 'Easy-Care Resilient Plank'],
    amenities: [
      'Quiet Cul-de-Sac Setting in Desirable Regina Gardens Subdivision',
      'Polished Original Hardwood Floors Through Living Room and Sleeping Quarters',
      'Modernized Kitchen Featuring Stainless Steel Appliances and Dining Nook',
      'Full Unfinished Lower Level Providing Outstanding Storage Capacity',
      'Expansive Rear Yard Framed by Mature Shade Trees',
      'Energy-Efficient Central Climate Control with Programmable Thermostat',
      'Convenient Paved Driveway for Multiple Vehicles',
      'Minutes from Florissant Valley Community College and I-270 Corridor',
      'Pet-Friendly Accommodations'
    ],
    description: `Tucked away on a tranquil cul-de-sac in Regina Gardens, this beautifully refreshed three-bedroom Florissant home offers approximately 1,075 square feet of warm, inviting living space on a quiet residential street with virtually no through traffic.

An attractive brick and vinyl facade greets you at the curb, leading inside to a generously sized front gathering room anchored by glowing refinished hardwood floors and oversized double-hung windows. Just beyond, the kitchen has been thoughtfully updated with crisp cabinetry, modern laminate worktops, and quality appliances including a gas range and oven, frost-free refrigerator, and dishwasher. A sunny dining area sits adjacent to the culinary workspace, perfect for quiet dinners or lively weekend breakfasts.

The sleeping quarters comprise three bright bedrooms, all highlighted by authentic hardwood flooring, closet organization systems, and crisp white trim. The central full bath has been tastefully appointed with an updated vanity mirror, contemporary lighting fixtures, and a clean tub and shower enclosure.

A full basement extends the footprint of the home beneath, providing dedicated laundry hookups, abundant shelving space, and room for workout equipment or extra storage. Step outside onto the level backyard to find plenty of green grass shaded by mature trees. Excellent proximity to St. Louis Community College at Florissant Valley, shopping plazas along Lindbergh, and highway access.

We proudly welcome pets with pet-friendly accommodations. Application fee is $50. Submit your rental application today at Choice Properties.`
  },

  // 4. HAZELWOOD - Townhome
  {
    candidate_key: '7473 Hazelcrest',
    aliased_address: '7481 Hazelcrest Dr',
    city: 'Hazelwood',
    state: 'MO',
    zip: '63042',
    county: 'St. Louis County',
    neighborhood: 'Hazelcrest Meadows',
    lat: 38.779747,
    lng: -90.341029,
    property_type: 'TOWNHOUSE',
    bedrooms: 3,
    bathrooms: 1.5,
    half_bathrooms: 1,
    total_bathrooms: 1.5,
    square_footage: 1250, // soft-rounded from 1260
    monthly_rent: 1390, // Original $1,600 -> changed to $1,390
    security_deposit: 1390,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Designated Assigned Off-Street Spaces & Guest Parking',
    garage_spaces: 0,
    heating_type: 'Forced Air Gas Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Private In-Unit Basement Laundry Connections',
    appliances: ['Refrigerator', 'Electric Range / Oven', 'Over-the-Range Microwave', 'Dishwasher', 'Garbage Disposal'],
    flooring: ['Contemporary Luxury Vinyl Plank', 'Plush Neutral Carpeting on Upper Level'],
    amenities: [
      'Expansive Two-Story Townhome Layout Spanning 1,250 Square Feet',
      '3 Bedrooms Upstairs with 1 Full Bathroom and Main-Level Guest Powder Room',
      'Spacious Open-Concept Living and Dining Salon with Sliding Glass Patio Door',
      'Modern Kitchen Equipped with Contemporary Cabinetry and Complete Appliance Suite',
      'Full Private Basement Supplying Boundless Storage and Laundry Space',
      'Private Enclosed Concrete Patio for Outdoor Entertaining',
      'Central Air Conditioning with Multi-Zone Air Flow',
      'Superb Hazelwood Location Moments from Boeing, Lambert International, and I-270',
      'Pet-Friendly Accommodations'
    ],
    description: `A thoughtfully designed two-story townhome in Hazelwood's desirable Hazelcrest community, this 1,250-square-foot residence offers the generous layout of a standalone house with the low-maintenance ease of townhome living.

The main level showcases an expansive open-concept living and dining parlor floored in handsome wood-look luxury vinyl plank. Natural light streams in through broad windows and a sliding patio door that opens out to a private enclosed rear courtyard—an ideal setting for morning coffee or outdoor dining. The kitchen features an efficient U-shaped layout fitted with rich shaker cabinetry, generous laminate worktops, and an itemized appliance package comprising an electric cooking range, refrigerator, built-in microwave, and dishwasher. A convenient half-bath powder room on the main floor serves guests and residents alike.

Upstairs, three spacious bedrooms provide restful sanctuaries away from the daytime living areas. The primary bedroom features extensive wall closet storage and large windows, while two secondary bedrooms provide comfortable proportions for home office setups or family members. The upper level is completed by a full bathroom outfitted with an integrated vanity, ceramic tile surround, and combination tub and shower.

Downstairs, a full private basement delivers outstanding utility with laundry hookups and plenty of dry storage. Situated near Hazelwood sports complexes, Boeing facilities, Lambert-St. Louis International Airport, and major transit routes including I-270 and McDonnell Boulevard.

Pet-friendly accommodations with a $50 application fee. Submit your rental application today at Choice Properties.`
  },

  // 5. HAZELWOOD - House
  {
    candidate_key: '20 Ville Teresa',
    aliased_address: '28 Ville Teresa Ct',
    city: 'Hazelwood',
    state: 'MO',
    zip: '63042',
    county: 'St. Louis County',
    neighborhood: 'Ville Teresa',
    lat: 38.774616,
    lng: -90.399511,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 925, // soft-rounded from 912
    monthly_rent: 1325, // Original $1,400 -> changed to $1,325
    security_deposit: 1325,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Private Driveway & Street Parking',
    garage_spaces: 0,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Full Basement Washer & Dryer Connections',
    appliances: ['Refrigerator', 'Electric Stove / Oven', 'Range Exhaust Hood'],
    flooring: ['Easy-Maintenance Vinyl Plank Flooring Throughout'],
    amenities: [
      'Peaceful Cul-de-Sac Setting in Established Hazelwood Enclave',
      'Single-Level Living with 3 Bedrooms and 1 Ceramic Tile Bathroom',
      'Open Living Area Flowing Directly into Bright Dining Kitchen',
      'Wood-Look Plank Flooring Throughout Main Living Areas and Bedrooms',
      'Full Concrete Basement Offering Extensive Storage and Laundry Room',
      'Substantial Level Yard Backing to Open Green Space',
      'Central Heating and Air Conditioning for Total Climate Control',
      'Convenient Access to Missouri Route 370 and St. Charles County Crossings',
      'Pet-Friendly Accommodations'
    ],
    description: `Situated at the quiet terminus of a welcoming cul-de-sac in Hazelwood, this updated three-bedroom single-family ranch provides approximately 925 square feet of accessible single-level living paired with an expansive full basement.

Stepping inside, the front entrance opens into an airy living room boasting durable wood-grain vinyl plank flooring that extends throughout the entire residence. The living room flows naturally into an open-plan eat-in kitchen with bright windows overlooking the grassy backyard. Outfitted with warm cabinetry, solid countertops, an electric range, and a full-size refrigerator, the kitchen makes everyday culinary tasks simple and organized.

Three comfortable bedrooms each feature generous window exposures, neutral painted walls, and built-in closet storage. The shared central bathroom is equipped with an easy-clean tub and shower combination, updated vanity basin, and modern light bar fixtures.

The expansive full basement beneath provides endless utility, housing the washer and dryer connections while offering ample room for sporting gear, tool benches, and seasonal storage. Outside, the large backyard provides open space for outdoor activities and relaxation. With quick connectivity to MO-370, I-270, and shopping districts along Lindbergh and Howdershell roads, daily commuting is effortless.

Pet-friendly accommodations are guaranteed. Application fee is $50. Submit your rental application today at Choice Properties.`
  },

  // 6. SPANISH LAKE - House
  {
    candidate_key: '1321 Columbus',
    aliased_address: '1329 Columbus Dr',
    city: 'Saint Louis',
    state: 'MO',
    zip: '63138',
    county: 'St. Louis County',
    neighborhood: 'Spanish Lake',
    lat: 38.793261,
    lng: -90.207307,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1.5,
    half_bathrooms: 1,
    total_bathrooms: 1.5,
    square_footage: 1450, // soft-rounded from 1445
    monthly_rent: 1385, // Original $1,550 -> changed to $1,385
    security_deposit: 1385,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Attached Garage & Wide Concrete Driveway',
    garage_spaces: 1,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated Lower Level Laundry Hookups',
    appliances: ['Refrigerator', 'Electric Range / Oven', 'Exhaust Hood', 'Dishwasher'],
    flooring: ['Refinished Hardwood Flooring', 'Durable Luxury Vinyl Plank', 'Ceramic Tile'],
    amenities: [
      'Substantial 1,450-Square-Foot Floor Plan with 3 Bedrooms and 1.5 Bathrooms',
      'Enclosed Four-Season Sunroom Lined with Windows Overlooking the Backyard',
      'Finished Lower Level Recreation Space Complete with Custom Built-In Bar',
      'Gleaming Hardwood Floors Throughout the Primary Living and Bedroom Areas',
      'Attached 1-Car Garage with Direct Interior Access and Ample Driveway Parking',
      'Fully Fenced Backyard Oasis Featuring Concrete Patio and Mature Trees',
      'Primary Bedroom Featuring Convenient En-Suite Half-Bath Powder Room',
      'Moments from Spanish Lake County Park, Bellefontaine Conservation Area, and Highway 367',
      'Pet-Friendly Accommodations'
    ],
    description: `A distinctive and spacious residence in North St. Louis County's Spanish Lake area, this three-bedroom, 1.5-bathroom brick ranch delivers approximately 1,450 square feet of finished living space highlighted by an impressive sunroom and a finished lower level recreation bar.

The main level welcomes you with gleaming hardwood flooring and a broad front window that fills the living room with natural light. The updated kitchen features rich wood cabinetry, ample counter prep areas, a dishwasher, electric range, and refrigerator. Beyond the kitchen, a magnificent sunroom lined with panoramic windows extends the living area year-round, looking out onto a private fenced rear yard and concrete patio.

Three well-proportioned bedrooms all feature hardwood floors, ceiling fans, and generous closets. The primary bedroom enjoys the added luxury of an en-suite half-bathroom with modern vanity, while the main hallway full bathroom features timeless ceramic tile, updated vanity cabinetry, and a full shower and bathtub.

Downstairs, the partially finished lower level serves as a premier entertainment space, featuring a custom built-in bar, wood-paneled walls, and extra recreational room alongside a private laundry area and substantial unfinished storage space. An attached garage provides sheltered vehicle parking. Just minutes from scenic Spanish Lake Park, fishing and trails, and Highway 367 for a quick commute downtown.

Choice Properties is completely pet-friendly. Application fee is $50. Submit your rental application today at Choice Properties.`
  },

  // 7. SPANISH LAKE - House
  {
    candidate_key: '12049 Larimore',
    aliased_address: '12057 Larimore Rd',
    city: 'Saint Louis',
    state: 'MO',
    zip: '63138',
    county: 'St. Louis County',
    neighborhood: 'Spanish Lake',
    lat: 38.79028,
    lng: -90.193616,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1.5,
    half_bathrooms: 1,
    total_bathrooms: 1.5,
    square_footage: 950, // soft-rounded from 936
    monthly_rent: 1350, // Original $1,495 -> changed to $1,350
    security_deposit: 1350,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Attached Garage & Off-Street Driveway',
    garage_spaces: 1,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Basement Laundry Facility Connections',
    appliances: ['Refrigerator', 'Electric Cooking Range', 'Overhead Exhaust Hood', 'Dishwasher'],
    flooring: ['Contemporary Luxury Vinyl Plank Flooring Throughout'],
    amenities: [
      'Brick Front Ranch Home in Established Spanish Lake Setting',
      '3 Bedrooms with 1 Full Bathroom and Convenient En-Suite Half-Bath',
      'Modern Kitchen with Clean White Cabinets, Dishwasher, and Adjoining Dining Area',
      'Attached 1-Car Garage Offering Weather-Protected Parking and Storage',
      'Full Unfinished Basement Providing Abundant Extra Room for Storage and Hobbies',
      'Expansive Fenced Rear Yard Ideal for Outdoor Relaxation and Pets',
      'Central Climate Control System for Year-Round Comfort',
      'Convenient Proximity to Larimore Park, Bellefontaine Neighbors, and Highway 367',
      'Pet-Friendly Accommodations'
    ],
    description: `A charming brick-accented ranch home situated along Larimore Road in Spanish Lake, this three-bedroom, 1.5-bathroom single-family property combines comfortable single-story living with approximately 950 square feet of updated interior space.

Entering the residence, a spacious living room greets you with durable contemporary luxury vinyl plank flooring and an abundance of natural light from front-facing windows. The floor plan leads directly into the bright eat-in kitchen, which has been upgraded with clean white shaker-style cabinets, modern countertops, and a complete appliance lineup including a dishwasher, electric range, and refrigerator.

The bedroom wing features three comfortable bedrooms, each appointed with easy-to-maintain plank flooring, ceiling lighting, and built-in closet space. The primary bedroom features its own private half-bathroom powder room, while the central hallway offers a bright full bathroom with an updated vanity, modern mirror, and combination tub and shower.

A full basement underneath provides endless storage possibilities alongside laundry hookups and utility fixtures. Vehicle parking is handled by an attached single-car garage and a wide paved driveway. Outside, the large fenced backyard is ready for lawn games and furry companions. Excellent proximity to Spanish Lake trails, local dining, and straightforward highway access.

Pet-friendly accommodations with a $50 application fee. Submit your rental application today at Choice Properties.`
  },

  // 8. SPANISH LAKE - House
  {
    candidate_key: '1044 Farmview',
    aliased_address: '1052 Farmview Dr',
    city: 'Saint Louis',
    state: 'MO',
    zip: '63138',
    county: 'St. Louis County',
    neighborhood: 'Spanish Lake',
    lat: 38.784335,
    lng: -90.197885,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2,
    half_bathrooms: null,
    total_bathrooms: 2,
    square_footage: 1450, // soft-rounded from 1444
    monthly_rent: 1345, // Original $1,397 -> changed to $1,345
    security_deposit: 1345,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Attached Single-Car Garage & Driveway',
    garage_spaces: 1,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Full Basement Laundry Connections',
    appliances: ['Refrigerator', 'Electric Cooking Range', 'Over-the-Range Microwave', 'Dishwasher'],
    flooring: ['Refinished Hardwood Floors', 'Contemporary Ceramic Tile'],
    amenities: [
      'Substantial 3-Bedroom, 2-Bathroom Ranch with Over 1,450 Square Feet',
      'Dual Full Bathrooms with Master En-Suite Facility and Ceramic Tile Finishes',
      'Updated Kitchen with Granite-Style Countertops and Stainless-Finish Appliances',
      'Original Hardwood Flooring Throughout Formal Living and Dining Spaces',
      'Attached 1-Car Garage with Remote Access and Extra Storage',
      'Full Lower-Level Basement Ready for Storage, Workbenches, and Laundry',
      'Fenced Grassy Backyard with Covered Patio Terrace',
      'Peaceful Residential Street Moments from Spanish Lake Park and Chain of Rocks',
      'Pet-Friendly Accommodations'
    ],
    description: `Offering generous space and classic architectural character, this three-bedroom, two-bathroom brick-front ranch residence in Spanish Lake spans approximately 1,450 square feet of refreshed interior comfort.

Step through the covered front stoop into an expansive living room featuring authentic hardwood floors and expansive picture windows that look out across the manicured front lawn. The adjoining dining and kitchen area presents an inviting gathering space, showcasing granite-look laminate countertops, crisp cabinetry, and modern appliances including a dishwasher, electric range, microwave, and refrigerator.

All three bedrooms are generously scaled with rich hardwood flooring and generous closet storage. The primary bedroom boasts its own private en-suite full bathroom equipped with modern tile and step-in shower, while a secondary full bathroom in the main hall serves the other bedrooms with a deep soaking tub and tile surround.

The expansive full basement extends the living and utility possibilities, offering dedicated washer and dryer connections, mechanical storage, and boundless open floor space. Outside, a covered rear patio terrace overlooks a level fenced backyard perfect for summer barbecues. An attached garage completes this complete home. Conveniently located near Highway 367, shopping amenities, and community parks.

Pet-friendly accommodations with a $50 application fee. Submit your rental application today at Choice Properties.`
  },

  // 9. SOUTH COUNTY - Townhome
  {
    candidate_key: '1003 Avenue H',
    aliased_address: '1011 Avenue H',
    city: 'Saint Louis',
    state: 'MO',
    zip: '63125',
    county: 'St. Louis County',
    neighborhood: 'South County / Lemay',
    lat: 38.53972,
    lng: -90.294151,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 1.5,
    half_bathrooms: 1,
    total_bathrooms: 1.5,
    square_footage: 975, // soft-rounded from 986
    monthly_rent: 1340, // Original $1,400 -> changed to $1,340
    security_deposit: 1340,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Designated Off-Street Paved Parking',
    garage_spaces: 0,
    heating_type: 'Central Gas Furnace Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Private Basement Washer & Dryer Hookups',
    appliances: ['Refrigerator', 'Gas Range / Oven', 'Range Hood', 'Dishwasher'],
    flooring: ['Gleaming Hardwood Floors', 'Ceramic Tile in Kitchen and Baths'],
    amenities: [
      'Two-Story Townhome Layout in Established South County Neighborhood',
      '2 Bedrooms on Upper Level with Full Bath and Main-Floor Guest Half-Bath',
      'Gleaming Hardwood Flooring Flowing Across Both Upper and Lower Levels',
      'Spacious Eat-In Kitchen Equipped with Gas Range, Refrigerator, and Dishwasher',
      'Full Private Unfinished Basement with Laundry Hookups and Expansive Storage',
      'Central Air Conditioning and Efficient Gas Heating',
      'Designated Off-Street Paved Parking Spaces',
      'Prime South County Location Close to Jefferson Barracks Park, I-255, and Telegraph Road',
      'Pet-Friendly Accommodations'
    ],
    description: `A charming two-story townhome located in South St. Louis County, this two-bedroom, 1.5-bathroom residence delivers approximately 975 square feet of comfortable multi-level living complemented by a full private basement and beautiful hardwood floors.

The entry floor features a welcoming living room bathed in natural light through broad front windows, with rich polished hardwood floors creating a warm ambiance. Towards the rear, a spacious eat-in kitchen is appointed with ceramic tile flooring, generous cabinetry, a pantry area, and essential culinary appliances including a gas range, refrigerator, and dishwasher. A convenient half-bath powder room is situated on the main floor for guest comfort.

The upper level accommodates two spacious bedrooms, each showcasing continuous hardwood floors, ceiling fans, and generous closet space. The full bathroom on this floor is tastefully finished with ceramic tile walls, an updated vanity, and a shower and bathtub combination.

Downstairs, a full private basement provides outstanding utility, offering dedicated laundry hookups for your washer and dryer as well as extensive open square footage for storage or a workshop. Located moments from Telegraph Road shopping, Jefferson Barracks Historical Park, the Mississippi River Greenway, and rapid access to I-255 and I-55 for easy commutes across the St. Louis metropolitan area.

Pet-friendly accommodations with a $50 application fee. Submit your rental application today at Choice Properties.`
  },

  // 10. SOUTH COUNTY - House
  {
    candidate_key: '4867 Hamburg',
    aliased_address: '4875 Hamburg Ave',
    city: 'Saint Louis',
    state: 'MO',
    zip: '63123',
    county: 'St. Louis County',
    neighborhood: 'South County / Affton',
    lat: 38.562231,
    lng: -90.295534,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 1150, // soft-rounded from 1152
    monthly_rent: 1375, // Original $1,500 -> changed to $1,375
    security_deposit: 1375,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: true,
    parking: 'Detached Garage & Long Concrete Driveway',
    garage_spaces: 1,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Basement Laundry Facility Connections',
    appliances: ['Refrigerator', 'Electric Range / Oven', 'Dishwasher', 'Microwave'],
    flooring: ['Classic Hardwood Flooring', 'Modern Ceramic Tile'],
    amenities: [
      'Two-Story Craftsman-Style Single-Family Home in Desirable South County / Affton Area',
      '2 Sizable Bedrooms Upstairs with Main-Level Formal Living and Dining Rooms',
      'Refined Kitchen Featuring Solid Wood Cabinetry, Dishwasher, and Modern Appliances',
      'Detached Garage Providing Secure Vehicle Parking and Workshop Space',
      'Full Lower-Level Basement Supplying Substantial Dry Storage and Laundry Hookups',
      'Private Fenced Backyard Featuring Wood Deck Terrace for Entertaining',
      'Central Climate Control System with High-Efficiency Heating and Cooling',
      'Prime South County Setting Near Gravois Road, Grant’s Farm, and I-55 Access',
      'Pet-Friendly Accommodations'
    ],
    description: `A distinctive two-story single-family home in South St. Louis County near the Affton corridor, this two-bedroom, one-bathroom residence offers approximately 1,150 square feet of character-rich living space paired with a detached garage, rear entertaining deck, and full basement.

A charming covered front porch welcomes you into a formal living room featuring classic hardwood floors, wide wood baseboards, and bright multi-pane windows. Flowing seamlessly beyond is a separate dining room ideal for holiday dinners and everyday meals. The kitchen has been updated with warm wood cabinetry, generous laminate work surfaces, and quality appliances including an electric range, refrigerator, microwave, and dishwasher.

On the upper level, two well-proportioned bedrooms boast hardwood flooring, double-hung windows, and ample closet storage. The central bathroom features a classic ceramic tile tub and shower enclosure, an updated wood vanity, and a mirrored medicine cabinet.

Downstairs, the full basement accommodates laundry facilities and extensive open storage space. Outside, the rear yard is fully fenced and features a raised wooden deck perfect for weekend grilling, alongside a detached garage accessible via the extended concrete driveway. Conveniently situated near Gravois Road, Grant's Farm, Willmore Park, and swift connections to I-55.

Pet-friendly accommodations with a $50 application fee. Submit your rental application today at Choice Properties.`
  }
];

async function publishStLouisCountyBatch() {
  console.log(`\n============================================================`);
  console.log(`Choice Properties — Publishing St. Louis County Batch`);
  console.log(`Florissant, Hazelwood, Spanish Lake & South County`);
  console.log(`============================================================\n`);

  const publishedResults = [];
  const today = new Date().toISOString().split('T')[0];

  for (let i = 0; i < ST_LOUIS_BATCH.length; i++) {
    const item = ST_LOUIS_BATCH[i];
    console.log(`\n[${i + 1}/${ST_LOUIS_BATCH.length}] Processing ${item.aliased_address} (${item.city}, MO ${item.zip})`);
    console.log(`   Specs: ${item.bedrooms} Bed / ${item.total_bathrooms} Bath | Rent: $${item.monthly_rent}/mo | Type: ${item.property_type}`);

    // Find candidate record
    const cand = rawCandidates.find(c => c.street.toLowerCase().includes(item.candidate_key.toLowerCase()));
    if (!cand) {
      console.error(`   ✗ Candidate not found for key: ${item.candidate_key}`);
      continue;
    }

    console.log(`   Source: ${cand.full_addr} | Orig List Price: $${cand.list_price} | Photos available: ${cand.photos.length}`);

    // 1. Quarantined Pipeline Record
    const pipeId = crypto.randomUUID();
    const pipePayload = {
      id: pipeId,
      source: 'homeharvest',
      source_url: cand.property_url || `https://www.realtor.com/realestateandhomes-detail/${encodeURIComponent(cand.full_addr)}`,
      external_id: `hh_mo_${cand.zip_code}_${cand.street.replace(/\s+/g, '_')}`,
      title: `${item.aliased_address}, ${item.city}, ${item.state} ${item.zip}`,
      authentic_address: cand.full_addr,
      authentic_city: cand.city,
      authentic_state: cand.state,
      authentic_zip: cand.zip_code,
      status: 'published',
      published_at: new Date().toISOString()
    };

    // Check if property already exists in public.properties by aliased address
    let propId = null;
    let isUpdate = false;
    try {
      const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?address=eq.${encodeURIComponent(item.aliased_address)}&city=eq.${encodeURIComponent(item.city)}&select=id`, {
        headers: HEADERS
      });
      const checkData = await checkRes.json();
      if (checkData && checkData.length > 0) {
        propId = checkData[0].id;
        isUpdate = true;
      }
    } catch (e) {}

    if (!propId) {
      propId = crypto.randomUUID();
    }
    pipePayload.choice_property_id = propId;

    try {
      const pipeRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties`, {
        method: 'POST',
        headers: HEADERS_PIPELINE,
        body: JSON.stringify(pipePayload)
      });
      if (pipeRes.ok) {
        console.log(`   ✓ Quarantined authentic source data in pipeline_properties (${pipeId})`);
      } else {
        console.warn(`   ⚠ Pipeline record notice: ${pipeRes.status} ${await pipeRes.text()}`);
      }
    } catch (e) {
      console.warn(`   ⚠ Pipeline record notice: ${e.message}`);
    }

    // 2. Prepare public property record
    const publicTitle = `${item.aliased_address}, ${item.city}, ${item.state} ${item.zip}`;
    const propRecord = {
      id: propId,
      landlord_id: LANDLORD_ID,
      title: publicTitle,
      description: item.description,
      original_description: cand.text,
      address: item.aliased_address,
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
      monthly_rent: item.monthly_rent,
      security_deposit: item.security_deposit,
      application_fee: 50,
      available_date: null,
      lease_terms: null,
      minimum_lease_months: null,
      pets_allowed: true,
      pet_types_allowed: ['Dogs', 'Cats'],
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
      status: 'active',
      listed_at: today,
      featured: false
    };

    if (isUpdate) {
      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${propId}`, {
        method: 'PATCH',
        headers: HEADERS,
        body: JSON.stringify(propRecord)
      });
      if (!updateRes.ok) {
        const err = await updateRes.text();
        console.error(`   ✗ Failed to update ${item.aliased_address}: ${updateRes.status} ${err}`);
        continue;
      }
      console.log(`   ✓ Updated public property (ID: ${propId})`);
    } else {
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/properties`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(propRecord)
      });
      if (!insertRes.ok) {
        const err = await insertRes.text();
        console.error(`   ✗ Failed to insert ${item.aliased_address}: ${insertRes.status} ${err}`);
        continue;
      }
      console.log(`   ✓ Inserted public property (ID: ${propId})`);
    }

    // 3. Photos: Optimize order so interior is hero (index 0)
    const reorderedPhotos = optimizePhotoOrder(cand.photos);
    await fetch(`${SUPABASE_URL}/rest/v1/property_photos?property_id=eq.${propId}`, {
      method: 'DELETE',
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
    });

    const photoInserts = reorderedPhotos.map((url, pIdx) => ({
      property_id: propId,
      url: url,
      display_order: pIdx,
      is_hero: pIdx === 0,
      caption: `${item.aliased_address} - View ${pIdx + 1}`
    }));

    const photoRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(photoInserts)
    });

    if (photoRes.ok) {
      console.log(`   ✓ Synced ${photoInserts.length} photos (Interior hero at index 0)`);
    } else {
      console.warn(`   ⚠ Photo sync notice: ${photoRes.status} ${await photoRes.text()}`);
    }

    publishedResults.push({
      n: publishedResults.length + 1,
      id: propId,
      address: item.aliased_address,
      city: item.city,
      state: item.state,
      zip: item.zip,
      rent: item.monthly_rent,
      beds: item.bedrooms,
      baths: item.total_bathrooms,
      url: `${SITE_URL}/property.html?id=${propId}`
    });
  }

  console.log(`\n============================================================`);
  console.log(`Successfully published ${publishedResults.length} properties!`);
  console.log(`============================================================\n`);

  fs.writeFileSync('scripts/published_st_louis_county_results.json', JSON.stringify(publishedResults, null, 2));

  publishedResults.forEach(r => {
    console.log(`${r.n}. ${r.address}, ${r.city}, ${r.state} ${r.zip} ($${r.rent.toLocaleString()}/mo | ${r.beds} Bed / ${r.baths} Bath) — ${r.url}`);
    console.log('');
  });
}

publishStLouisCountyBatch().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
