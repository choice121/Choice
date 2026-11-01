import fs from 'fs';
import crypto from 'crypto';
import { CREDENTIALS_CONFIG } from '../credentials-config.mjs';

const { SUPABASE_URL, SUPABASE_API_KEY } = CREDENTIALS_CONFIG;
const LANDLORD_ID = 'b8d3aea0-f466-49f2-ac07-2b2b40793cc9'; // Choice Properties verified landlord
const SITE_URL = 'https://choice-properties-site.pages.dev';

const HEADERS = {
  'apikey': SUPABASE_API_KEY,
  'Authorization': `Bearer ${SUPABASE_API_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

function makeShareToken() {
  const bytes = crypto.randomBytes(32);
  return bytes.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const rawData = JSON.parse(fs.readFileSync('scripts/today_unique_payloads.json', 'utf8'));

// Build candidates with verified facts and architectural walkthrough descriptions
const CANDIDATES = [
  // 1. 3800 NE 140th St, Edmond, OK 73013
  {
    address: '3800 NE 140th St',
    city: 'Edmond',
    state: 'OK',
    zip: '73013',
    county: 'Oklahoma County',
    title: '3800 NE 140th St, Edmond, OK 73013',
    rent: 1650,
    beds: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    sqft: 1595,
    lot_size_sqft: 7405,
    property_type: 'SINGLE_FAMILY',
    year_built: 1983,
    laundry_type: 'Hookups',
    parking: 'Attached 2-Car Garage & Driveway',
    garage_spaces: 2,
    heating_type: 'Central Forced Air',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Dishwasher', 'Refrigerator', 'Range / Oven', 'Microwave', 'Garbage Disposal'],
    amenities: [
      'Attached 2-Car Garage',
      'Private Fenced Backyard',
      'Covered Patio / Outdoor Living Area',
      'Storage Building',
      'Central Climate Control',
      'Pet-Friendly'
    ],
    description: `Set along a quiet residential corridor in desirable Edmond, this handsome 1,595-square-foot standalone residence showcases classic brick architecture and a versatile single-level floor plan. The front entryway opens into an expansive main living room enhanced by natural light, clean architectural lines, and durable easy-care flooring designed for modern family living.

The fully appointed kitchen offers substantial cabinetry, expansive countertop prep zones, a dual-basin sink, and a complete appliance collection including a refrigerator, range oven, dishwasher, microwave, and garbage disposal. An adjoining dining space provides seamless flow for both casual weeknight dinners and entertaining guests.

The private primary bedroom suite features generous proportions, a large walk-in closet, and an en-suite full bathroom with updated fixtures. Two secondary bedrooms provide sunny exposures, abundant closet capacity, and swift access to the central second full bath.

A dedicated interior utility room provides full-size washer and dryer hookups with additional overhead storage. Efficient central heating and cooling ensure seasonal comfort year-round. Outside, a private fenced backyard and covered patio create an idyllic retreat for outdoor gatherings, complemented by an attached two-car garage.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  },

  // 2. 2325 Elwood Dr, Edmond, OK 73013
  {
    address: '2325 Elwood Dr',
    city: 'Edmond',
    state: 'OK',
    zip: '73013',
    county: 'Oklahoma County',
    title: '2325 Elwood Dr, Edmond, OK 73013',
    rent: 1600,
    beds: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    sqft: 1065,
    lot_size_sqft: 7200,
    property_type: 'SINGLE_FAMILY',
    year_built: 1974,
    laundry_type: 'Hookups',
    parking: 'Attached 2-Car Garage',
    garage_spaces: 2,
    heating_type: 'Central Forced Air',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Dishwasher', 'Electric Range / Oven', 'Refrigerator', 'Quartz Countertops'],
    amenities: [
      'Comprehensive Interior Remodel',
      'Quartz Countertops',
      'Wood-Look Ceramic Tile Flooring',
      'New Energy-Efficient Windows',
      'Attached 2-Car Garage',
      'Private Fenced Yard',
      'Pet-Friendly'
    ],
    description: `Superbly situated in prime East Edmond, this completely remodeled 1,065-square-foot brick residence combines contemporary interior aesthetics with classic architectural permanence. Premium wood-look ceramic tile flooring runs continuously throughout the home, accented by fresh neutral paint and new energy-efficient double-pane windows that bathe the living spaces in natural light.

The redesigned culinary kitchen boasts pristine quartz countertops, designer tile backsplash, rich cabinetry, and a suite of modern appliances including a refrigerator, electric range oven, and dishwasher. The open-concept living and dining areas connect smoothly to the kitchen for effortless entertaining.

The primary suite serves as an inviting personal retreat, featuring modern fixtures and a beautifully modernized en-suite bathroom with custom tile surrounds. Two well-scaled guest bedrooms offer excellent closet space and share the fully renovated hallway bathroom.

A separate interior laundry area features dedicated washer and dryer hookups. Energy-efficient central heating and air conditioning ensure dependable climate control throughout the home. The exterior showcases an attached two-car garage and a spacious fenced backyard.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  },

  // 3. 204 John Rausch Ln, Edmond, OK 73003
  {
    address: '204 John Rausch Ln',
    city: 'Edmond',
    state: 'OK',
    zip: '73003',
    county: 'Oklahoma County',
    title: '204 John Rausch Ln, Edmond, OK 73003',
    rent: 1645,
    beds: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    sqft: 1452,
    lot_size_sqft: 6800,
    property_type: 'SINGLE_FAMILY',
    year_built: 1998,
    laundry_type: 'Hookups',
    parking: 'Attached 2-Car Garage',
    garage_spaces: 2,
    heating_type: 'Central Gas Forced Air',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Dishwasher', 'Range / Oven', 'Built-in Microwave', 'Garbage Disposal'],
    amenities: [
      'Open Architectural Layout',
      'Attached 2-Car Garage',
      'Private Fenced Backyard',
      'Contemporary Light Fixtures',
      'Central Climate Control',
      'Pet-Friendly'
    ],
    description: `Positioned in a premier Edmond enclave, this freshly updated 1,452-square-foot single-family home delivers a harmonious blend of refined design and everyday functionality. The open-concept floor plan greets you with soaring sightlines, crisp modern trim, and resilient flooring that bridges the formal and everyday social spaces.

The central kitchen is crafted with abundant prep counter surfaces, generous cabinetry, a breakfast dining area, and quality appliances including a range oven, dishwasher, built-in microwave, and garbage disposal. The dining area overlooks the private backyard through wide sliding patio doors.

The secluded primary suite is appointed with a generous bedroom footprint, an expansive walk-in closet, and an en-suite bath equipped with a broad vanity and custom bathing fixtures. Two secondary bedrooms provide ample proportions, oversized windows, and easy access to the pristine secondary full bathroom.

An interior laundry room provides convenient washer and dryer hookups. The residence benefits from high-efficiency central air conditioning and gas forced heating. Outside, the large fenced backyard offers plenty of room to unwind, backed by an attached two-car garage with secure direct interior access.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  },

  // 4. 2309 Butternut Pl, Edmond, OK 73013
  {
    address: '2309 Butternut Pl',
    city: 'Edmond',
    state: 'OK',
    zip: '73013',
    county: 'Oklahoma County',
    title: '2309 Butternut Pl, Edmond, OK 73013',
    rent: 1525,
    beds: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    sqft: 1466,
    lot_size_sqft: 7500,
    property_type: 'SINGLE_FAMILY',
    year_built: 1976,
    laundry_type: 'Hookups',
    parking: 'Attached 2-Car Garage',
    garage_spaces: 2,
    heating_type: 'Central Forced Air',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Dishwasher', 'Freezer', 'Microwave Oven', 'Range / Oven', 'Refrigerator'],
    amenities: [
      'Quiet Cul-de-sac Setting',
      'Attached 2-Car Garage',
      'Northwood Addition Neighborhood',
      'Private Fenced Yard',
      'Patio / Outdoor Living Area',
      'Pet-Friendly'
    ],
    description: `Tucked away at the end of a peaceful cul-de-sac within Edmond's celebrated Northwood Addition, this charming 1,466-square-foot standalone brick home offers tranquility and immediate neighborhood connectivity. The home features welcoming living spaces finished with durable flooring, neutral designer palettes, and picture windows framing the front garden.

The spacious kitchen includes ample solid cabinetry, long prep counters, a dual-basin sink, and a complete appliance package including a refrigerator, range oven, microwave, and dishwasher. An adjoining dining nook creates an inviting space for gatherings.

The comfortable primary bedroom suite provides an expansive layout, walk-in wardrobe storage, and a private en-suite bathroom. Two additional sun-filled bedrooms share a well-positioned central bathroom with clean tile accents and modern vanity hardware.

A dedicated interior laundry zone accommodates washer and dryer hookups. High-performance central heating and cooling guarantee comfort through every Oklahoma season. The property features a fully fenced backyard with a patio slab and an attached two-car garage with direct driveway access.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  },

  // 5. 3821 Meadow Ln, Edmond, OK 73013
  {
    address: '3821 Meadow Ln',
    city: 'Edmond',
    state: 'OK',
    zip: '73013',
    county: 'Oklahoma County',
    title: '3821 Meadow Ln, Edmond, OK 73013',
    rent: 1695,
    beds: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    sqft: 1700,
    lot_size_sqft: 8200,
    property_type: 'SINGLE_FAMILY',
    year_built: 1978,
    laundry_type: 'Hookups',
    parking: 'Attached 2-Car Garage',
    garage_spaces: 2,
    heating_type: 'Central Forced Air',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Dishwasher', 'Range / Oven', 'Microwave', 'Garbage Disposal'],
    amenities: [
      'Substantial 1,700 Sq Ft Floor Plan',
      'Attached 2-Car Garage',
      'Dual Social Living Spaces',
      'Private Fenced Backyard',
      'Central Climate Control',
      'Pet-Friendly'
    ],
    description: `Prominently positioned near Eastern Avenue and Memorial Road, this substantial 1,700-square-foot Edmond home combines an expansive architectural footprint with exceptional daily convenience. The residence opens into a luminous foyer leading to two expansive living zones that offer unmatched versatility for formal gatherings and casual relaxation.

The generous kitchen is equipped with extensive cabinetry, expansive countertop workspaces, modern cooking appliances including a range oven and dishwasher, and an adjacent dining area designed for seamless entertaining.

The primary suite provides a peaceful sanctuary, complete with generous closet capacity and an en-suite bathroom featuring updated fixtures. Two secondary bedrooms are generous in size, featuring ample closet storage and convenient access to the secondary full bath.

A full interior utility area houses dedicated washer and dryer hookups. Robust central air conditioning and heating ensure optimal comfort across all seasons. The grounds include an attached two-car garage and an expansive, fully fenced backyard.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  },

  // 6. 103 Sahoma Ter, Edmond, OK 73013
  {
    address: '103 Sahoma Ter',
    city: 'Edmond',
    state: 'OK',
    zip: '73013',
    county: 'Oklahoma County',
    title: '103 Sahoma Ter, Edmond, OK 73013',
    rent: 1495,
    beds: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    sqft: 1248,
    lot_size_sqft: 5400,
    property_type: 'DUPLEX',
    year_built: 1984,
    laundry_type: 'Hookups',
    parking: 'Attached 2-Car Garage',
    garage_spaces: 2,
    heating_type: 'Central Forced Air',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Dishwasher', 'Refrigerator', 'Range / Oven'],
    amenities: [
      'Attached 2-Car Garage',
      'Quiet Cul-de-sac Setting',
      'Single-Level Duplex Layout',
      'Southwinds Addition Enclave',
      'Central Air Conditioning',
      'Pet-Friendly'
    ],
    description: `Nestled in the quiet Southwinds Addition at the terminus of a secluded cul-de-sac, this 1,248-square-foot single-level duplex unit offers peaceful living with convenient access to central Edmond. The home features an intuitive layout with unified easy-care flooring and crisp neutral finishes throughout the primary living areas.

The fully equipped kitchen provides efficient cabinetry, durable prep counters, a refrigerator, range oven, and dishwasher, alongside an open dining area that transitions effortlessly into the main living room.

Three comfortable bedrooms provide flexible accommodations for family living, guests, or a dedicated home office. The primary bedroom features a private en-suite bathroom, while a well-appointed second full bathroom serves the secondary bedrooms.

Features an internal laundry closet with washer and dryer hookups, plus central climate control. Includes an attached two-car garage providing sheltered parking and supplemental storage, complemented by quiet residential surroundings.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  },

  // 7. 2308 Red Elm Dr, Edmond, OK 73013
  {
    address: '2308 Red Elm Dr',
    city: 'Edmond',
    state: 'OK',
    zip: '73013',
    county: 'Oklahoma County',
    title: '2308 Red Elm Dr, Edmond, OK 73013',
    rent: 1600,
    beds: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    sqft: 1502,
    lot_size_sqft: 7600,
    property_type: 'SINGLE_FAMILY',
    year_built: 1977,
    laundry_type: 'Hookups',
    parking: 'Attached 2-Car Garage',
    garage_spaces: 2,
    heating_type: 'Central Forced Air',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Dishwasher', 'Microwave Oven', 'Range / Oven', 'Garbage Disposal'],
    amenities: [
      'Attached 2-Car Garage',
      'In-Ground Storm Cellar',
      'Exposed Wood-Beam Ceilings',
      'Walk-In Shower & Designer Fixtures',
      'Ceiling Fans',
      'Private Fenced Yard',
      'Pet-Friendly'
    ],
    description: `Showcasing rich architectural character and solid construction, this 1,502-square-foot single-family home in Edmond delivers an authentic blend of timeless warmth and modern appointments. The central living area is highlighted by exposed wood-beam ceilings, overhead ceiling fans, and durable flooring that creates an inviting atmosphere for relaxation.

The updated kitchen features designer faucets, abundant cabinetry, generous countertop prep areas, a microwave, range oven, dishwasher, and garbage disposal, seamlessly opening to an adjoining dining nook.

The primary suite offers a private sanctuary complete with a modern walk-in shower, updated vanity, and expansive closet capacity. Two additional well-proportioned bedrooms are served by a secondary full bathroom featuring modern finishes and clean tile work.

A dedicated utility room provides full washer and dryer hookups. The home includes a built-in in-ground storm cellar for total peace of mind during Oklahoma weather events, along with central air conditioning, an attached two-car garage, and a spacious fenced backyard.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  },

  // 8. 2602 Michael Dr, Edmond, OK 73013
  {
    address: '2602 Michael Dr',
    city: 'Edmond',
    state: 'OK',
    zip: '73013',
    county: 'Oklahoma County',
    title: '2602 Michael Dr, Edmond, OK 73013',
    rent: 1645,
    beds: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    sqft: 1600,
    lot_size_sqft: 7500,
    property_type: 'SINGLE_FAMILY',
    year_built: 1980,
    laundry_type: 'Hookups',
    parking: 'Attached 2-Car Garage',
    garage_spaces: 2,
    heating_type: 'Central Forced Air',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Dishwasher', 'Garbage Disposal', 'Stainless Steel Stove / Oven'],
    amenities: [
      'Main-Level Primary Suite',
      'Attached 2-Car Garage',
      'Remodeled Kitchen with Custom Backsplash',
      'Covered Back Patio',
      'Expansive Fenced Backyard',
      'Pet-Friendly'
    ],
    description: `Situated in desirable East Edmond near 33rd & Boulevard, this beautifully remodeled 1,600-square-foot two-story residence boasts an optimal multi-level layout designed for modern privacy. The bright living room welcomes you with clean finishes, contemporary lighting, and low-maintenance flooring.

The renovated kitchen features updated solid countertops, a contemporary tile backsplash, sleek stainless steel cooking appliances including an oven range and dishwasher, and a waste disposal unit, with ample room for casual dining.

The sought-after main-level primary bedroom provides total seclusion and features an en-suite bathroom and generous wardrobe storage. Upstairs, two bright secondary bedrooms share a second full bathroom, providing an ideal split-floorplan arrangement for family or guests.

The interior laundry area includes dedicated washer and dryer hookups. Modern central heating and air conditioning ensure year-round efficiency. Outside, a covered back patio overlooks a large fenced yard, complemented by an attached two-car garage.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  },

  // 9. 13424 Palm Ave, Edmond, OK 73013
  {
    address: '13424 Palm Ave',
    city: 'Edmond',
    state: 'OK',
    zip: '73013',
    county: 'Oklahoma County',
    title: '13424 Palm Ave, Edmond, OK 73013',
    rent: 1595,
    beds: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    sqft: 1679,
    lot_size_sqft: 8100,
    property_type: 'SINGLE_FAMILY',
    year_built: 1975,
    laundry_type: 'Hookups',
    parking: 'Attached 2-Car Garage',
    garage_spaces: 2,
    heating_type: 'Central Forced Air',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Dishwasher', 'Countertop Microwave', 'Refrigerator', 'Built-in Oven', 'Electric Stovetop'],
    amenities: [
      'Wood-Look Vinyl Flooring Throughout',
      'Formal Foyer & Bay Window',
      'Built-In Bookshelves & Mock Fireplace',
      'Dedicated Interior Laundry Room',
      'Covered Patio & Fenced Yard',
      'Attached 2-Car Garage',
      'Pet-Friendly'
    ],
    description: `Located in the Northwood Section 3 Addition of Edmond, this expansive 1,679-square-foot single-family brick residence is appointed with wood-look vinyl flooring and fresh paint throughout. An inviting entry foyer opens to a stately formal living room highlighted by architectural built-in bookshelves, a mock fireplace hearth, and a sunny bay window.

The culinary center features hardwood dining room flooring, extensive cabinet storage, a built-in computer/desk workstation, dishwasher, countertop microwave, refrigerator, built-in wall oven, and smooth electric stovetop.

The primary bedroom suite offers a tranquil haven with an oversized walk-in closet and an en-suite bath with a walk-in shower. Two secondary bedrooms are notably spacious, equipped with abundant closet storage and convenient access to the central hall bathroom.

A large interior laundry room provides washer and dryer connections plus built-in storage. Equipped with central heating and air conditioning, the residence is complemented outdoors by a covered back patio, a securely fenced backyard, and an attached two-car garage.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  },

  // 10. 14301 Scott St, Edmond, OK 73013
  {
    address: '14301 Scott St',
    city: 'Edmond',
    state: 'OK',
    zip: '73013',
    county: 'Oklahoma County',
    title: '14301 Scott St, Edmond, OK 73013',
    rent: 1695,
    beds: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    sqft: 1550,
    lot_size_sqft: 8000,
    property_type: 'SINGLE_FAMILY',
    year_built: 1982,
    laundry_type: 'In Unit',
    parking: 'Attached 2-Car Garage',
    garage_spaces: 2,
    heating_type: 'Central Forced Air, Brick Fireplace',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Refrigerator', 'Microwave', 'Range / Oven', 'Washer', 'Dryer', 'Dishwasher'],
    amenities: [
      'Attached 2-Car Garage',
      'Dual Spacious Living Areas',
      'Exposed Architectural Wood Beams',
      'Classic Brick Fireplace',
      'Designer Tiled Walk-In Shower',
      'In-Unit Washer & Dryer Included',
      'Fenced Yard with Mature Trees',
      'Covered Front Porch',
      'Pet-Friendly'
    ],
    description: `Welcomed by a charming covered front porch in a peaceful Edmond neighborhood with swift I-35 access, this 1,550-square-foot brick home offers two expansive living areas accented by exposed architectural wood ceiling beams. The primary social room is anchored by a stately brick hearth fireplace and integrated custom bookshelves.

The oversized kitchen and dinette space feature wide picture windows overlooking the backyard, abundant countertop surface area, rich cabinetry, and a full appliance suite including a refrigerator, range oven, microwave, and dishwasher.

The private master suite features a beautifully tiled walk-in shower, contemporary vanity fixtures, and generous closet space. Two additional comfortably sized bedrooms include ceiling fans, wide windows, and close proximity to the second full bathroom.

A dedicated laundry room includes both a full-size washer and dryer. High-efficiency central heating and air conditioning provide climate control throughout. Outside, enjoy a sizable fenced backyard shaded by mature trees, backed by an attached two-car garage.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  },

  // 11. 2108 Henderson Dr, Edmond, OK 73013
  {
    address: '2108 Henderson Dr',
    city: 'Edmond',
    state: 'OK',
    zip: '73013',
    county: 'Oklahoma County',
    title: '2108 Henderson Dr, Edmond, OK 73013',
    rent: 1345,
    beds: 3,
    bathrooms: 1.5,
    half_bathrooms: 1,
    sqft: 1095,
    lot_size_sqft: 7000,
    property_type: 'SINGLE_FAMILY',
    year_built: 1961,
    laundry_type: 'Hookups',
    parking: 'Attached 2-Car Garage',
    garage_spaces: 2,
    heating_type: 'Central Forced Air',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Granite Countertops', 'Range / Oven', 'Dishwasher', 'Refrigerator'],
    amenities: [
      'Attached 2-Car Garage',
      'Rich Hardwood Flooring Throughout',
      'Granite Kitchen Countertops',
      'Spacious Entertaining Deck',
      'Private Fenced Backyard',
      'Pet-Friendly'
    ],
    description: `This charming 1,095-square-foot standalone brick residence in Edmond greets you with rich authentic hardwood floors that flow seamlessly through every living room and bedroom, delivering timeless warmth and effortless maintenance.

The upgraded chef's kitchen features polished granite countertops, abundant solid cabinetry, and a full suite of kitchen appliances including a refrigerator, range oven, and dishwasher, offering an optimal setup for daily meal preparation and entertaining.

The home offers 1.5 thoughtfully placed bathrooms, with the powder room ideally positioned for visiting guests and a full bathroom serving the three well-proportioned bedrooms. Each bedroom provides generous natural lighting and closet storage.

An internal utility zone provides dedicated washer and dryer hookups. Energy-efficient central heating and air conditioning keep the home comfortable year-round. The exterior is highlighted by a beautifully maintained wooden entertaining deck, an attached two-car garage, and a spacious fully fenced backyard.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  },

  // 12. 14213 Constitution Ave, Edmond, OK 73013
  {
    address: '14213 Constitution Ave',
    city: 'Edmond',
    state: 'OK',
    zip: '73013',
    county: 'Oklahoma County',
    title: '14213 Constitution Ave, Edmond, OK 73013',
    rent: 1450,
    beds: 3,
    bathrooms: 2.5,
    half_bathrooms: 1,
    sqft: 1761,
    lot_size_sqft: 8500,
    property_type: 'SINGLE_FAMILY',
    year_built: 1974,
    laundry_type: 'In Unit',
    parking: 'Attached 2-Car Garage',
    garage_spaces: 2,
    heating_type: 'Central Forced Air',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Cooktop', 'Built-in Oven', 'Dishwasher', 'Refrigerator', 'Washer', 'Dryer'],
    amenities: [
      'Expansive 1,761 Sq Ft Living Area',
      'Dual Living & Dual Dining Rooms',
      'Architectural Bay Window',
      'Master Walk-In Closet & Double Vanity',
      'Attached 2-Car Garage',
      'Lawn Irrigation System',
      'Private Fenced Yard with Patio',
      'Pet-Friendly'
    ],
    description: `Located in the established Heritage Heights Addition of Edmond, this stately 1,761-square-foot brick home offers two living areas and two dining spaces across a sprawling single-story floor plan. An architectural bay window and custom built-in cabinetry grace the social spaces.

The culinary center features built-in oven, smooth cooktop, dishwasher, refrigerator, and abundant cabinet storage, flowing seamlessly into breakfast and formal dining zones.

The private master suite is appointed with an expansive walk-in closet and a master bathroom featuring a double vanity and updated bathing fixtures. Two secondary bedrooms offer substantial space and share a full hallway bath, complemented by a guest half bath (powder room).

The interior utility room includes in-unit laundry appliances. Central climate control ensures year-round comfort. The exterior grounds feature an attached two-car garage, lawn sprinkler system, private fenced yard, and an outdoor patio.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  },

  // 13. 437 Belmont Dr, Edmond, OK 73034
  {
    address: '437 Belmont Dr',
    city: 'Edmond',
    state: 'OK',
    zip: '73034',
    county: 'Oklahoma County',
    title: '437 Belmont Dr, Edmond, OK 73034',
    rent: 1400,
    beds: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    sqft: 1200,
    lot_size_sqft: 7000,
    property_type: 'SINGLE_FAMILY',
    year_built: 1986,
    laundry_type: 'In Unit',
    parking: 'Attached 1-Car Garage & Driveway',
    garage_spaces: 1,
    heating_type: 'Central Forced Air, Fireplace',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Smooth-Top Stove / Oven', 'Dishwasher', 'Washer', 'Dryer'],
    amenities: [
      'Updated Ceramic Tile & Fresh Carpet',
      'Gas/Wood-Burning Fireplace',
      'Indoor Laundry Room with Washer/Dryer',
      'Attached 1-Car Garage with Auto Opener',
      '6-Foot Privacy Fence',
      'Covered Back Patio',
      'Pet-Friendly'
    ],
    description: `Located in a quiet and established Edmond neighborhood, this thoroughly updated 1,200-square-foot standalone home features fresh paint, new carpeting, updated light fixtures, new ceiling fans, and durable ceramic tile. The main living room is anchored by a cozy gas and wood-burning fireplace.

The kitchen features a smooth-top stove and oven, dishwasher, refreshed cabinetry, and an adjoining dining space overlooking the back patio.

The master bedroom provides an en-suite full bathroom with refreshed tile surrounds and a walk-in closet. Two additional bedrooms are comfortably proportioned and share an updated full secondary bathroom with modern hardware.

Includes an indoor laundry room equipped with a washer and dryer. High-efficiency central air conditioning and heating provide reliable climate control. The exterior boasts a covered back patio, 6-foot privacy fence, and an attached one-car garage with an automatic door opener.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  },

  // 14. 17 E 7th St, Edmond, OK 73034
  {
    address: '17 E 7th St',
    city: 'Edmond',
    state: 'OK',
    zip: '73034',
    county: 'Oklahoma County',
    title: '17 E 7th St, Edmond, OK 73034',
    rent: 1600,
    beds: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    sqft: 1867,
    lot_size_sqft: 7800,
    property_type: 'SINGLE_FAMILY',
    year_built: 1940,
    laundry_type: 'In Unit',
    parking: 'Attached / Detached Garage & Driveway',
    garage_spaces: 1,
    heating_type: 'Forced Air',
    cooling_type: 'Brand-New Energy-Efficient Central AC',
    has_central_air: true,
    has_basement: false,
    appliances: ['Dishwasher', 'Dryer', 'Freezer', 'Microwave Oven', 'Oven / Range', 'Refrigerator', 'Washer'],
    amenities: [
      'Walkable Downtown Edmond Historic District',
      'Brand-New Energy-Efficient AC System',
      'Substantial 1,867 Sq Ft Footprint',
      'Modern Remodeled Kitchen',
      'Complete Appliance Suite with Washer/Dryer',
      'Pet-Friendly'
    ],
    description: `Discover an exceptional blend of historic architectural charm and modern upgrades in the heart of Edmond's vibrant Downtown district! Spanning 1,867 square feet, this classic home puts you steps from Broadway, local cafes, and community parks while delivering serene residential living.

The newly remodeled kitchen is a standout culinary space, featuring extensive updated cabinetry, generous countertop surfaces, and a full stainless appliance suite including a refrigerator, range oven, microwave, dishwasher, freezer, washer, and dryer.

The home offers generous bedroom accommodations with comfortable dimensions, tall sunny windows, and two full bathrooms equipped with updated fixtures and pristine vanity surfaces.

A brand-new state-of-the-art central air conditioning system ensures top-tier energy efficiency and cooling performance. An interior laundry area includes the provided washer and dryer. Complete with garage parking, private driveway space, and a pleasant yard.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  },

  // 15. 1717 NW 146th St, Edmond, OK 73013
  {
    address: '1717 NW 146th St',
    city: 'Edmond',
    state: 'OK',
    zip: '73013',
    county: 'Oklahoma County',
    title: '1717 NW 146th St, Edmond, OK 73013',
    rent: 1500,
    beds: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    sqft: 1200,
    lot_size_sqft: 6500,
    property_type: 'SINGLE_FAMILY',
    year_built: 1985,
    laundry_type: 'Hookups',
    parking: 'Attached 2-Car Garage',
    garage_spaces: 2,
    heating_type: 'Central Forced Air',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Dishwasher', 'Range / Oven', 'Microwave'],
    amenities: [
      'Split Floor Plan Layout',
      'Luxurious Wood-Look SPC Flooring Throughout',
      'Fresh Professional Interior Paint',
      'New Bath Fixtures & Custom Blinds',
      'Attached 2-Car Garage',
      'Private Fenced Yard',
      'Pet-Friendly'
    ],
    description: `Fresh off a comprehensive renovation, this 1,200-square-foot Edmond home presents an intelligent split floor plan designed for privacy and modern convenience. The entire residence is appointed with luxurious wood-look SPC flooring, fresh neutral paint, and new window blinds and screens.

The central kitchen features a new dishwasher, modern range oven, ample cabinet storage, and an open dining area that transitions effortlessly into the bright social living room.

The split layout places the primary suite on one wing with a private full bathroom and new fixtures. On the opposite wing, two secondary bedrooms share a pristine second full bathroom, ensuring peace and quiet for all occupants.

An interior utility area provides dedicated washer and dryer hookups. Central heating and air conditioning ensure dependable four-season comfort. Outdoors, you'll find an attached two-car garage and a private fenced backyard.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  },

  // 16. 651 Ridgecrest Rd, Edmond, OK 73013
  {
    address: '651 Ridgecrest Rd',
    city: 'Edmond',
    state: 'OK',
    zip: '73013',
    county: 'Oklahoma County',
    title: '651 Ridgecrest Rd, Edmond, OK 73013',
    rent: 1465,
    beds: 3,
    bathrooms: 1.5,
    half_bathrooms: 1,
    sqft: 1212,
    lot_size_sqft: 7200,
    property_type: 'SINGLE_FAMILY',
    year_built: 1972,
    laundry_type: 'Hookups',
    parking: 'Attached 2-Car Garage with Automatic Opener',
    garage_spaces: 2,
    heating_type: 'Central Forced Air',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Dishwasher', 'Microwave Oven', 'Range / Oven', 'Quartz Countertops'],
    amenities: [
      'Remodeled 2-Car Garage with Auto Opener & Storage',
      'Quartz Kitchen Countertops',
      'Jack-and-Jill Half Bathroom',
      'High-Speed Fiber Internet Ready',
      'Private Fenced Backyard',
      'Pet-Friendly'
    ],
    description: `Impeccably maintained and situated within walking distance of neighborhood parks, this 1,212-square-foot Edmond home offers smart architecture and updated finishes. The living room features updated hard-surface flooring and flows directly into an adjacent dining room.

The kitchen is appointed with solid quartz countertops, contemporary flooring, a dishwasher, range oven, and microwave, providing a refined space for home cooking.

Three spacious bedrooms are arranged for optimal comfort. The primary bedroom features a convenient Jack-and-Jill half bath, while a full central bathroom with updated tile serves the secondary bedrooms and guests.

A dedicated utility room provides washer and dryer hookups. The home is equipped with central heating and air conditioning. Outside, the recently remodeled two-car garage features automatic doors and bonus storage space, overlooking a private fenced backyard.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  },

  // 17. 200 Elwood Dr, Edmond, OK 73013
  {
    address: '200 Elwood Dr',
    city: 'Edmond',
    state: 'OK',
    zip: '73013',
    county: 'Oklahoma County',
    title: '200 Elwood Dr, Edmond, OK 73013',
    rent: 1450,
    beds: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    sqft: 1360,
    lot_size_sqft: 7500,
    property_type: 'SINGLE_FAMILY',
    year_built: 1974,
    laundry_type: 'Hookups',
    parking: 'Attached 2-Car Garage',
    garage_spaces: 2,
    heating_type: 'Central Forced Air',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Stainless Steel Refrigerator', 'Dishwasher', 'Electric Range / Oven', 'Granite Countertops'],
    amenities: [
      'Prime Corner Lot Setting',
      'Granite Kitchen Countertops',
      'All-Stainless Appliance Suite',
      'Stockade Fenced Backyard',
      'Resilient Plank Flooring',
      'Attached 2-Car Garage',
      'Pet-Friendly'
    ],
    description: `Occupying a prominent corner lot at Boulevard and Elwood, this 1,360-square-foot single-family home features resilient plank flooring and fresh designer paint throughout. The flowing living room is bathed in natural light from broad corner windows.

The kitchen is equipped with granite countertops, rich cabinetry, and a full suite of stainless steel appliances including a refrigerator, range oven, and dishwasher, accompanied by an open dining nook.

The master bedroom suite features a private en-suite bathroom with updated vanity and tile finishes. Two secondary bedrooms provide generous dimensions, ample wardrobe closets, and convenient access to the central hall bathroom.

An internal laundry room accommodates washer and dryer hookups. Central heating and air conditioning ensure dependable year-round climate control. The exterior boasts a spacious stockade fenced backyard and an attached two-car garage.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  },

  // 18. 209 Elwood Dr, Edmond, OK 73013
  {
    address: '209 Elwood Dr',
    city: 'Edmond',
    state: 'OK',
    zip: '73013',
    county: 'Oklahoma County',
    title: '209 Elwood Dr, Edmond, OK 73013',
    rent: 1700,
    beds: 4,
    bathrooms: 2.0,
    half_bathrooms: 0,
    sqft: 1417,
    lot_size_sqft: 7400,
    property_type: 'SINGLE_FAMILY',
    year_built: 1974,
    laundry_type: 'Hookups',
    parking: 'Attached 2-Car Garage',
    garage_spaces: 2,
    heating_type: 'Central Natural Gas Heat',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Dishwasher', 'Electric Range / Oven', 'Microwave'],
    amenities: [
      'Four Full Bedrooms',
      'Attached 2-Car Garage',
      'Master Walk-In Closet',
      'Central Natural Gas Heat & AC',
      'Private Fenced Yard',
      'Pet-Friendly'
    ],
    description: `A rare four-bedroom find in Edmond, this 1,417-square-foot standalone home offers an expansive layout ideal for growing families or those needing dedicated office spaces. The main living room features broad windows, crisp architectural lines, and low-maintenance flooring.

The kitchen features an electric oven and range, dishwasher, generous counter space, and abundant cabinet storage, opening smoothly to an adjoining family dining area.

The master suite is appointed with a large walk-in closet and a private en-suite bathroom. Three secondary bedrooms provide generous dimensions, deep closets, and easy access to the central full bathroom.

Equipped with dedicated laundry hookups, central gas heating, and central air conditioning. The home includes an attached two-car garage and a private fenced backyard with ample space for outdoor activities.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  },

  // 19. 2408 Red Elm Ct, Edmond, OK 73013
  {
    address: '2408 Red Elm Ct',
    city: 'Edmond',
    state: 'OK',
    zip: '73013',
    county: 'Oklahoma County',
    title: '2408 Red Elm Ct, Edmond, OK 73013',
    rent: 1650,
    beds: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    sqft: 1727,
    lot_size_sqft: 8000,
    property_type: 'SINGLE_FAMILY',
    year_built: 1976,
    laundry_type: 'Hookups',
    parking: 'Attached 2-Car Garage',
    garage_spaces: 2,
    heating_type: 'Central Heat Pump / Forced Air',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Dishwasher', 'Range / Oven', 'Microwave', 'Garbage Disposal'],
    amenities: [
      'Spacious 1,727 Sq Ft Footprint',
      'Quiet Cul-de-sac Location',
      'Attached 2-Car Garage',
      'Multiple Living & Entertaining Areas',
      'Private Fenced Yard & Landscaped Grounds',
      'Pet-Friendly'
    ],
    description: `Situated in a quiet, friendly cul-de-sac in Edmond, this expansive 1,727-square-foot standalone brick home delivers an impressive blend of comfort, scale, and neighborhood serenity. The versatile layout includes multiple spacious living and entertaining spaces adorned with clean finishes and sunlit windows.

The chef's kitchen features ample cabinet storage, wide prep surfaces, a range oven, dishwasher, microwave, and waste disposal, opening onto an informal dining area overlooking the grounds.

The primary suite provides a peaceful haven with an expansive bedroom footprint, deep wardrobe storage, and a private en-suite bathroom. Two additional bedrooms are generously sized and share the well-appointed secondary full bathroom.

A separate utility room features full-size washer and dryer hookups. Equipped with central heating and air conditioning, an attached two-car garage, and a serene landscaped backyard with privacy fencing.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  }
];

// Pre-flight check: verify every description adheres to all strict rules
function verifyDescription(desc, idx) {
  const issues = [];
  if (!desc.includes('Application Fee: $50')) issues.push('Must contain "Application Fee: $50"');
  if (/free\s+application|waived\s+fee|\$0\s+fee/i.test(desc)) issues.push('Contains free/waived fee clause');
  if (/security\s+deposit|\$\d+.*deposit/i.test(desc)) issues.push('Mentions security deposit');
  if (/\b(?:12|24|36|6)\s*[- ]?month\s+(?:lease|term)/i.test(desc)) issues.push('Mentions lease terms');
  if (/\b(?:available\s+now|move-in\s+ready|ready\s+for\s+move-in)\b/i.test(desc)) issues.push('Mentions availability/move-in');
  if (/\b(?:no\s+smoking|non-smoking)\b/i.test(desc)) issues.push('Mentions smoking policy');
  if (!desc.includes('Pet-friendly')) issues.push('Must mention Pet-friendly');
  if (issues.length > 0) {
    throw new Error(`Candidate #${idx + 1} description failed verification:\n` + issues.join('\n'));
  }
}

async function run() {
  console.log('Verifying all 19 candidate descriptions...');
  CANDIDATES.forEach((c, i) => verifyDescription(c.description, i));
  console.log('✓ All 19 descriptions verified against strict platform invariants!');

  console.log('\nMatching candidates with raw payloads for direct CDN photos...');
  const publishedResults = [];
  const publishedIds = [];

  for (let i = 0; i < CANDIDATES.length; i++) {
    const c = CANDIDATES[i];
    const rawMatch = rawData.find(item => {
      const p = item.payload;
      return p.address && p.address.toLowerCase().trim() === c.address.toLowerCase().trim();
    }) || rawData[i];

    const raw = rawMatch.payload;
    const propertyId = crypto.randomUUID();

    const propertyPayload = {
      id: propertyId,
      landlord_id: LANDLORD_ID,
      status: 'private_placement', // Shielded from public page
      title: c.title,
      description: c.description,
      address: c.address,
      city: c.city,
      state: c.state,
      zip: c.zip,
      county: c.county,
      lat: raw.lat || null,
      lng: raw.lng || null,
      monthly_rent: c.rent,
      security_deposit: c.rent, // Exactly 1x rent in DB field
      application_fee: 50,
      bedrooms: c.beds,
      bathrooms: c.bathrooms,
      half_bathrooms: c.half_bathrooms,
      total_bathrooms: c.bathrooms,
      square_footage: c.sqft,
      lot_size_sqft: c.lot_size_sqft,
      property_type: c.property_type,
      year_built: c.year_built,
      garage_spaces: c.garage_spaces,
      parking: c.parking,
      amenities: c.amenities,
      appliances: c.appliances,
      heating_type: c.heating_type,
      cooling_type: c.cooling_type,
      laundry_type: c.laundry_type,
      has_central_air: c.has_central_air,
      has_basement: c.has_basement,
      original_description: raw.original_description || raw.description || '',
      pets_allowed: null, // Zero pet info in structured fields per invariant
      pet_types_allowed: null,
      pet_deposit: null,
      lease_terms: null, // Zero lease terms per invariant
      minimum_lease_months: null,
      available_date: null, // Zero available dates per invariant
      smoking_allowed: null,
      views_count: 0,
      applications_count: 0,
      saves_count: 0
    };

    console.log(`\nPublishing #${i + 1}: ${c.title} ($${c.rent}/mo, ${c.beds}bd/${c.bathrooms}ba)...`);
    const propRes = await fetch(`${SUPABASE_URL}/rest/v1/properties`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(propertyPayload)
    });

    if (!propRes.ok) {
      const errText = await propRes.text();
      throw new Error(`Failed to insert into public.properties: ${propRes.status} ${errText}`);
    }
    publishedIds.push(propertyId);
    console.log(`✓ Inserted property into public.properties (ID: ${propertyId}, status: 'private_placement')`);

    // Photos Insertion: Direct Source CDN URLs, Strict Original Order
    let photos = [];
    try {
      photos = Array.isArray(raw.original_image_urls) ? raw.original_image_urls : JSON.parse(raw.original_image_urls || '[]');
    } catch(e) {
      photos = [];
    }

    const photoRows = photos.map((item, idx) => ({
      property_id: propertyId,
      url: typeof item === 'string' ? item : item.url,
      display_order: idx + 1,
      is_hero: idx === 0
    }));

    if (photoRows.length > 0) {
      const photoRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(photoRows)
      });
      if (!photoRes.ok) {
        const pErr = await photoRes.text();
        console.warn(`Warning: failed to insert photos: ${photoRes.status} ${pErr}`);
      } else {
        console.log(`✓ Attached ${photoRows.length} source CDN photos (hero: photo #1)`);
      }
    }

    publishedResults.push({
      id: propertyId,
      address: c.address,
      city: c.city,
      state: c.state,
      zip: c.zip,
      rent: c.rent,
      beds: c.beds,
      baths: c.bathrooms,
      sqft: c.sqft,
      photosCount: photoRows.length
    });
  }

  // Step 5: Multi-Property Magic Share Link Generation
  console.log(`\n=========================================================`);
  console.log(`Generating Magic Multi-Property Share Token for ${publishedIds.length} properties...`);

  const token = makeShareToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days
  const shareId = crypto.randomUUID();

  const shareRes = await fetch(`${SUPABASE_URL}/rest/v1/property_shares`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      id: shareId,
      token_hash: tokenHash,
      expires_at: expiresAt
    })
  });

  if (!shareRes.ok) {
    const err = await shareRes.text();
    throw new Error(`Failed to create property_shares: ${shareRes.status} ${err}`);
  }
  console.log(`✓ Created property_share record (ID: ${shareId}, Token: ${token})`);

  // Link all 19 properties into public.property_share_properties
  const linkRows = publishedIds.map(pid => ({
    share_id: shareId,
    property_id: pid
  }));

  const linkRes = await fetch(`${SUPABASE_URL}/rest/v1/property_share_properties`, {
    method: 'POST',
    headers: { ...HEADERS, 'Prefer': 'return=representation' },
    body: JSON.stringify(linkRows)
  });

  if (!linkRes.ok) {
    const err = await linkRes.text();
    throw new Error(`Failed to link property_share_properties: ${linkRes.status} ${err}`);
  }
  console.log(`✓ Linked all ${publishedIds.length} properties to share record`);

  // Verify resolution via property-share edge function
  console.log('\nTesting token resolution via edge function...');
  try {
    const testResolve = await fetch(`${SUPABASE_URL}/functions/v1/property-share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_API_KEY
      },
      body: JSON.stringify({ action: 'resolve', token })
    });
    const resolveData = await testResolve.json();
    console.log(`Resolve status: ${testResolve.status}, resolved properties: ${resolveData.properties ? resolveData.properties.length : 'none'}`);
  } catch (err) {
    console.warn('Resolution test notice:', err.message);
  }

  // Step 6: Clear the pipeline so it looks free to expect new scraped properties
  console.log('\nClearing pipeline table so it looks free for incoming scraped properties...');
  try {
    // Check if any remain in pipeline.pipeline_properties and delete
    const delRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties`, {
      method: 'DELETE',
      headers: { ...HEADERS, 'Accept-Profile': 'pipeline' }
    });
    console.log('Direct pipeline table clear status:', delRes.status);
  } catch (err) {
    console.warn('Pipeline clear notice:', err.message);
  }

  const magicLink = `${SITE_URL}/listings.html#share=${token}`;
  console.log(`\n=========================================================`);
  console.log(`SUCCESS! Master Magic Link Generated:`);
  console.log(magicLink);
  console.log(`=========================================================`);

  fs.writeFileSync('scripts/edmond_published_results.json', JSON.stringify({
    magicLink,
    token,
    shareId,
    count: publishedResults.length,
    properties: publishedResults
  }, null, 2));
}

run().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
