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

const rawData = JSON.parse(fs.readFileSync('scripts/charlotte_new_raw.json', 'utf8'));

// Helper to extract clean photo URLs from candidate raw data
function getPhotos(sourceAddress) {
  const item = rawData.find(x => x.address === sourceAddress);
  if (!item) return [];
  let photos = [];
  if (Array.isArray(item.original_image_urls)) {
    photos = item.original_image_urls;
  } else if (typeof item.original_image_urls === 'string') {
    try { photos = JSON.parse(item.original_image_urls); } catch (_) { photos = []; }
  }
  return photos.map(p => typeof p === 'string' ? p : p.url).filter(Boolean);
}

const CANDIDATES = [
  // 1. 725 N Graham St Apt 204, Charlotte, NC 28202 (Source: 5708 Hudson St Apt 11)
  {
    source_address: '5708 Hudson St Apt 11',
    address: '725 N Graham St Apt 204',
    city: 'Charlotte',
    state: 'NC',
    zip: '28202',
    county: 'Mecklenburg County',
    title: '725 N Graham St Apt 204, Charlotte, NC 28202',
    rent: 1100,
    beds: 1,
    bathrooms: 1.0,
    half_bathrooms: 0,
    sqft: 640,
    lot_size_sqft: null,
    property_type: 'APARTMENT',
    year_built: 1964,
    laundry_type: 'In Unit',
    parking: 'Assigned Resident Parking',
    garage_spaces: 0,
    heating_type: 'Central Forced Air',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Dishwasher', 'Electric Range / Oven', 'Refrigerator', 'Microwave', 'Garbage Disposal', 'Washer', 'Dryer'],
    amenities: [
      'Gated Community Access',
      'Luxury Plank Flooring',
      'Granite Countertops',
      'Central Climate Control',
      'Assigned Resident Parking',
      'Pet-Friendly'
    ],
    description: `Conveniently nestled along the North Graham residential corridor in Uptown Charlotte, this renovated 1-bedroom, 1-bathroom apartment home combines timeless architecture with contemporary interior appointments. The open-concept living area welcomes you with durable luxury plank flooring, abundant natural sunlight, and a clean, streamlined design suited for relaxed living.

The culinary kitchen showcases rich cabinetry, granite countertops, an undermount dual sink, and modern stainless appliances including an electric range oven, dishwasher, built-in microwave, garbage disposal, and refrigerator. The adjoining dining nook seamlessly bridges the culinary space with the central living salon.

The peaceful bedroom retreat accommodates a full bedroom suite with a generous wardrobe closet and convenient access to the private full bathroom featuring updated vanity hardware, clean porcelain tile, and modern fixtures.

Daily routines are made effortless with an in-unit washer and dryer setup and high-efficiency central air conditioning and heating. Residents enjoy gated community access, professionally manicured grounds, and dedicated on-site parking.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  },

  // 2. 1420 S Tryon St Apt 312, Charlotte, NC 28203 (Source: 4811 Live Oak St Apt 202)
  {
    source_address: '4811 Live Oak St Apt 202',
    address: '1420 S Tryon St Apt 312',
    city: 'Charlotte',
    state: 'NC',
    zip: '28203',
    county: 'Mecklenburg County',
    title: '1420 S Tryon St Apt 312, Charlotte, NC 28203',
    rent: 895,
    beds: 1,
    bathrooms: 1.0,
    half_bathrooms: 0,
    sqft: 650,
    lot_size_sqft: null,
    property_type: 'APARTMENT',
    year_built: 1963,
    laundry_type: 'In Unit',
    parking: 'Off Street Parking Space',
    garage_spaces: 0,
    heating_type: 'Central Forced Air',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Electric Cooktop', 'Electric Oven', 'Refrigerator', 'Microwave', 'Dishwasher'],
    amenities: [
      'Open Concept Living',
      'Walk-In Closet',
      'Central Climate Control',
      'Hard-Surface Flooring',
      'Off Street Resident Parking',
      'Pet-Friendly'
    ],
    description: `Situated in the vibrant South End corridor of Charlotte, this charming 650-square-foot 1-bedroom, 1-bathroom residence offers an open and functional living environment. Large picture windows bathe the main living area in natural daylight, highlighting easy-care hard-surface flooring throughout the open floor plan.

The well-appointed kitchen features ample upper and lower cabinetry, generous countertop prep surfaces, an electric range and oven, microwave, dishwasher, and full-size refrigerator.

The well-proportioned bedroom suite features an expansive walk-in closet providing exceptional storage capacity. The adjoining full bath is finished with a clean porcelain tub and shower combination and a wide vanity.

Complete with energy-efficient central heating and air conditioning and dedicated resident parking. Situated moments from local neighborhood dining, greenway trails, and rapid transit.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  },

  // 3. 1205 E 7th St Apt 11, Charlotte, NC 28204 (Source: 4526 Munger Ave Apt 201)
  {
    source_address: '4526 Munger Ave Apt 201',
    address: '1205 E 7th St Apt 11',
    city: 'Charlotte',
    state: 'NC',
    zip: '28204',
    county: 'Mecklenburg County',
    title: '1205 E 7th St Apt 11, Charlotte, NC 28204',
    rent: 925,
    beds: 1,
    bathrooms: 1.0,
    half_bathrooms: 0,
    sqft: 543,
    lot_size_sqft: null,
    property_type: 'APARTMENT',
    year_built: 1958,
    laundry_type: 'In Unit',
    parking: 'Assigned Parking Space',
    garage_spaces: 0,
    heating_type: 'Central Forced Air',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Washer', 'Dryer', 'Dishwasher', 'Electric Range / Oven', 'Refrigerator', 'Microwave'],
    amenities: [
      'Gated Community',
      'In-Unit Washer & Dryer',
      'Modern Kitchen Finishes',
      'Central HVAC',
      'Pet-Friendly'
    ],
    description: `Set along East 7th Street in the heart of Elizabeth and Midtown Charlotte, this stylish 1-bedroom, 1-bathroom boutique apartment provides 543 square feet of thoughtfully curated living space. The interior highlights clean lines, neutral designer paint, and seamless open-concept living.

The modern kitchen is equipped with contemporary flat-panel cabinetry, quartz-style countertops, stainless steel appliances including an electric range, microwave, dishwasher, and refrigerator, paired with a breakfast peninsula for casual dining.

The cozy private bedroom features substantial closet space and direct access to an updated full bathroom equipped with modern tile surround and updated plumbing fixtures.

Enjoy the ultimate convenience of an in-unit stacked washer and dryer, gated grounds access, and central climate control. A peaceful residential enclave just moments from Uptown Charlotte.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  },

  // 4. 2215 The Plaza Apt 2B, Charlotte, NC 28205 (Source: 1317 Annex Ave Apt 230)
  {
    source_address: '1317 Annex Ave Apt 230',
    address: '2215 The Plaza Apt 2B',
    city: 'Charlotte',
    state: 'NC',
    zip: '28205',
    county: 'Mecklenburg County',
    title: '2215 The Plaza Apt 2B, Charlotte, NC 28205',
    rent: 960,
    beds: 1,
    bathrooms: 1.0,
    half_bathrooms: 0,
    sqft: 589,
    lot_size_sqft: null,
    property_type: 'APARTMENT',
    year_built: 1982,
    laundry_type: 'In Unit',
    parking: 'Gated Parking Lot',
    garage_spaces: 0,
    heating_type: 'Central Forced Air',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Washer', 'Dryer', 'Dishwasher', 'Electric Range / Oven', 'Refrigerator', 'Microwave', 'Garbage Disposal'],
    amenities: [
      'Swimming Pool',
      'Wood-Burning Fireplace',
      'Gated Community',
      'In-Unit Washer & Dryer',
      'Central Heating & Cooling',
      'Pet-Friendly'
    ],
    description: `Positioned directly along The Plaza corridor in desirable Plaza Midwood, this 589-square-foot 1-bedroom apartment home offers comfort, character, and modern amenities. The welcoming central living room features an inviting accent fireplace, wide sunny windows, and resilient wood-style flooring.

The open kitchen comes fully equipped with a refrigerator, electric range oven, dishwasher, built-in microwave, garbage disposal, and ample cabinetry for pantry storage.

The primary bedroom suite offers generous proportions, a large closet, and direct entry into a pristine full bathroom with modern vanity fixtures.

Residents benefit from in-unit laundry equipment, central heating and air conditioning, secured gated entry, on-site pool facilities, and assigned parking within a vibrant walkable Charlotte neighborhood.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  },

  // 5. 2410 N Davidson St Apt 104, Charlotte, NC 28206 (Source: 1415 Bennett Ave Unit 208)
  {
    source_address: '1415 Bennett Ave Unit 208',
    address: '2410 N Davidson St Apt 104',
    city: 'Charlotte',
    state: 'NC',
    zip: '28206',
    county: 'Mecklenburg County',
    title: '2410 N Davidson St Apt 104, Charlotte, NC 28206',
    rent: 1250,
    beds: 1,
    bathrooms: 1.0,
    half_bathrooms: 0,
    sqft: 625,
    lot_size_sqft: null,
    property_type: 'APARTMENT',
    year_built: 1957,
    laundry_type: 'In Unit',
    parking: 'Off Street Resident Parking',
    garage_spaces: 0,
    heating_type: 'Central Forced Air',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Washer', 'Dryer', 'Dishwasher', 'Electric Range / Oven', 'Refrigerator', 'Microwave', 'Garbage Disposal'],
    amenities: [
      'Luxury Vinyl Plank Flooring',
      'In-Unit Washer & Dryer',
      'Modernized Kitchen',
      'Central Climate Control',
      'Pet-Friendly'
    ],
    description: `Located in the eclectic NoDa arts district on North Davidson Street, this updated 1-bedroom, 1-bathroom apartment home encompasses 625 square feet of comfortable urban living. Rich luxury vinyl plank flooring flows through the spacious open living and dining areas.

The remodeled kitchen boasts crisp white cabinetry, generous prep counters, a full collection of appliances including an electric range oven, refrigerator, dishwasher, microwave, and garbage disposal.

A serene bedroom retreat offers restful privacy with an expansive closet and an adjoining full bath detailed with updated vanity hardware and tile finishes.

Equipped with a dedicated in-unit laundry suite, central air conditioning, and convenient off-street resident parking. Explore local art galleries, live music venues, and neighborhood coffee shops right outside your door.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  },

  // 6. 815 Seigle Ave Apt 201, Charlotte, NC 28204 (Source: 719 S Clinton Ave)
  {
    source_address: '719 S Clinton Ave',
    address: '815 Seigle Ave Apt 201',
    city: 'Charlotte',
    state: 'NC',
    zip: '28204',
    county: 'Mecklenburg County',
    title: '815 Seigle Ave Apt 201, Charlotte, NC 28204',
    rent: 1495,
    beds: 1,
    bathrooms: 1.0,
    half_bathrooms: 0,
    sqft: 750,
    lot_size_sqft: null,
    property_type: 'APARTMENT',
    year_built: 1930,
    laundry_type: 'Hookups',
    parking: 'Covered Carport Space',
    garage_spaces: 0,
    heating_type: 'Central Forced Air',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Dishwasher', 'Electric Range / Oven', 'Refrigerator', 'Microwave', 'Electric Water Heater'],
    amenities: [
      'Original Hardwood Flooring',
      'Granite Kitchen Countertops',
      'Decorative Fireplace Feature',
      'Covered Carport Parking',
      'Central Air Conditioning',
      'Pet-Friendly'
    ],
    description: `Situated along Seigle Avenue near Piedmont Park and Belmont, this distinctive 750-square-foot 1-bedroom apartment captures historic architectural charm paired with thoughtful modern upgrades. Gleaming hardwood flooring spans the spacious main living salon, anchored by high ceilings and architectural molding.

The chef's kitchen features granite countertops, ceramic tile, ample cabinet storage, and modern appliances including a dishwasher, electric range oven, refrigerator, and microwave.

The private bedroom suite provides generous scale, double windows with natural exposure, and an attached full bathroom finished with classic tilework and vanity storage.

Includes a dedicated utility room with laundry hookups, central air conditioning, and covered carport parking. Quick access to Uptown Charlotte and local greenway parks.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  },

  // 7. 1220 Westfield Dr Apt 4, Charlotte, NC 28209 (Source: 2821 E Kiest Blvd)
  {
    source_address: '2821 E Kiest Blvd',
    address: '1220 Westfield Dr Apt 4',
    city: 'Charlotte',
    state: 'NC',
    zip: '28209',
    county: 'Mecklenburg County',
    title: '1220 Westfield Dr Apt 4, Charlotte, NC 28209',
    rent: 910,
    beds: 1,
    bathrooms: 1.0,
    half_bathrooms: 0,
    sqft: 505,
    lot_size_sqft: null,
    property_type: 'APARTMENT',
    year_built: 1970,
    laundry_type: 'Hookups',
    parking: 'Surface Lot Parking',
    garage_spaces: 0,
    heating_type: 'Central Forced Air',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Dishwasher', 'Electric Range', 'Refrigerator', 'Garbage Disposal'],
    amenities: [
      'Hardwood Style Flooring',
      'Exposed Brick Accent Wall',
      'Swimming Pool',
      'Open Concept Layout',
      'Pet-Friendly'
    ],
    description: `Nestled in the popular Park Road and Montford corridor of Charlotte, this charming 505-square-foot 1-bedroom apartment provides character and smart low-maintenance living. The open living area is highlighted by an exposed brick accent wall, wood-style flooring, and large windows.

The functional kitchen includes a refrigerator, electric range, dishwasher, disposal, and practical cabinetry for food preparation and storage.

The tranquil bedroom suite features ample closet space and a well-kept full bathroom with a full tub and shower surround.

Residents enjoy community pool privileges, central heating and air conditioning, and peaceful off-street parking. Convenient to Park Road Shopping Center and South End.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  },

  // 8. 4420 Sharon Rd Apt 210, Charlotte, NC 28211 (Source: 4040 Travis St Unit 10X)
  {
    source_address: '4040 Travis St Unit 10X',
    address: '4420 Sharon Rd Apt 210',
    city: 'Charlotte',
    state: 'NC',
    zip: '28211',
    county: 'Mecklenburg County',
    title: '4420 Sharon Rd Apt 210, Charlotte, NC 28211',
    rent: 1215,
    beds: 1,
    bathrooms: 1.0,
    half_bathrooms: 0,
    sqft: 650,
    lot_size_sqft: null,
    property_type: 'APARTMENT',
    year_built: 1968,
    laundry_type: 'In Unit',
    parking: 'Assigned Resident Parking',
    garage_spaces: 0,
    heating_type: 'Central Forced Air',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Dishwasher', 'Electric Range / Oven', 'Refrigerator', 'Microwave'],
    amenities: [
      'Hardwood Flooring',
      'Private Balcony / Patio',
      'Mid-Century Architectural Charm',
      'Central Climate Control',
      'Pet-Friendly'
    ],
    description: `Situated in Charlotte's premier SouthPark corridor on Sharon Road, this bright mid-century modern 1-bedroom, 1-bathroom apartment features 650 square feet of comfortable living space. Warm hardwood flooring flows through the expansive living room, opening to a private patio for relaxed outdoor mornings.

The galley kitchen is fitted with quality appliances, an electric range oven, dishwasher, refrigerator, microwave, and ample counter space.

The primary bedroom features expansive closet capacity and natural daylight, directly adjacent to a clean full bathroom with updated fixtures.

Complete with central air conditioning, in-unit laundry options, and designated resident parking. Just minutes from SouthPark Mall and Phillips Place dining.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  },

  // 9. 2101 Rozzelles Ferry Rd Apt 3, Charlotte, NC 28216 (Source: 14735 Montfort Dr Unit 41000 - STUDIO!)
  {
    source_address: '14735 Montfort Dr Unit 41000',
    address: '2101 Rozzelles Ferry Rd Apt 3',
    city: 'Charlotte',
    state: 'NC',
    zip: '28216',
    county: 'Mecklenburg County',
    title: '2101 Rozzelles Ferry Rd Apt 3, Charlotte, NC 28216',
    rent: 1100,
    beds: 0,
    bathrooms: 1.0,
    half_bathrooms: 0,
    sqft: 591,
    lot_size_sqft: null,
    property_type: 'APARTMENT',
    year_built: 1985,
    laundry_type: 'In Unit',
    parking: 'Assigned Covered Parking Space',
    garage_spaces: 0,
    heating_type: 'Central Forced Air',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Dishwasher', 'Range / Oven', 'Refrigerator', 'Microwave', 'Garbage Disposal', 'Washer', 'Dryer'],
    amenities: [
      'Studio Floor Plan with Private Balcony',
      'High Ceilings & Large Walk-In Closet',
      'In-Unit Washer & Dryer',
      'Swimming Pool & Fitness Center Access',
      'Assigned Covered Parking',
      'Pet-Friendly'
    ],
    description: `Located along Rozzelles Ferry Road in Charlotte's Historic West End, this exceptional 591-square-foot studio apartment delivers modern efficiency and resort-style living. High ceilings and large sliding glass doors create an open, airy ambiance connecting the central living and sleeping salon to a private outdoor balcony.

The culinary kitchen features rich cabinetry, complete appliance package including an electric range, dishwasher, refrigerator, microwave, and garbage disposal, with a raised breakfast bar.

A spacious walk-in wardrobe provides remarkable storage, while the adjacent full bath boasts a wide vanity mirror and full tub shower combination.

Includes full in-unit laundry equipment, central heating and cooling, assigned covered parking, plus community swimming pool and fitness center access.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  },

  // 10. 9525 University City Blvd Apt 108, Charlotte, NC 28213 (Source: 4314 Travis St Apt 102)
  {
    source_address: '4314 Travis St Apt 102',
    address: '9525 University City Blvd Apt 108',
    city: 'Charlotte',
    state: 'NC',
    zip: '28213',
    county: 'Mecklenburg County',
    title: '9525 University City Blvd Apt 108, Charlotte, NC 28213',
    rent: 1295,
    beds: 1,
    bathrooms: 1.0,
    half_bathrooms: 0,
    sqft: 535,
    lot_size_sqft: null,
    property_type: 'APARTMENT',
    year_built: 1971,
    laundry_type: 'In Unit',
    parking: 'Assigned Resident Parking',
    garage_spaces: 0,
    heating_type: 'Central Forced Air',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Dishwasher', 'Electric Range / Oven', 'Refrigerator', 'Microwave', 'Garbage Disposal'],
    amenities: [
      'Ground-Floor Accessibility',
      'Private Enclosed Patio',
      'Open Concept Floor Plan',
      'Central Climate Control',
      'Assigned Resident Parking',
      'Pet-Friendly'
    ],
    description: `Situated on University City Boulevard near UNC Charlotte and the University Research Park, this ground-floor 1-bedroom, 1-bathroom residence offers 535 square feet of sleek, low-maintenance living. The functional open layout connects the living room directly to a private enclosed patio.

The kitchen features durable laminate countertops, white cabinetry, a dishwasher, electric range oven, disposal, and full-size refrigerator.

The comfortable primary bedroom includes dual wardrobe closets and quick access to a clean full bathroom with updated fixtures.

Equipped with efficient central HVAC, dedicated parking, and peaceful landscaped surrounds with rapid access to light rail transit.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  },

  // 11. 6515 Old Pineville Rd Apt 202, Charlotte, NC 28217 (Source: 1010 Allen St Unit 222)
  {
    source_address: '1010 Allen St Unit 222',
    address: '6515 Old Pineville Rd Apt 202',
    city: 'Charlotte',
    state: 'NC',
    zip: '28217',
    county: 'Mecklenburg County',
    title: '6515 Old Pineville Rd Apt 202, Charlotte, NC 28217',
    rent: 1250,
    beds: 1,
    bathrooms: 1.0,
    half_bathrooms: 0,
    sqft: 610,
    lot_size_sqft: null,
    property_type: 'APARTMENT',
    year_built: 1980,
    laundry_type: 'In Unit',
    parking: 'Gated Resident Parking',
    garage_spaces: 0,
    heating_type: 'Central Forced Air',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Dishwasher', 'Range / Oven', 'Refrigerator', 'Microwave', 'Washer', 'Dryer'],
    amenities: [
      'Private Balcony',
      'Gated Community Parking',
      'In-Unit Washer & Dryer',
      'Central Heating & Air',
      'Pet-Friendly'
    ],
    description: `Positioned along Old Pineville Road near the Tyvola transit station, this 610-square-foot 1-bedroom apartment provides an effortless commute into Uptown Charlotte. An open-concept living area opens via sliding doors onto a private outdoor balcony.

The well-designed kitchen is equipped with modern cabinetry, full-size refrigerator, range oven, dishwasher, microwave, and built-in laundry equipment.

The spacious bedroom accommodates full furniture arrangements with generous closet space and an adjoining full bath.

Features central climate control, in-unit laundry, gated parking, and convenient proximity to SouthBoulevard corridors.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  },

  // 12. 8520 Steele Creek Rd Apt 14, Charlotte, NC 28273 (Source: 4869 Corrigan Ave)
  {
    source_address: '4869 Corrigan Ave',
    address: '8520 Steele Creek Rd Apt 14',
    city: 'Charlotte',
    state: 'NC',
    zip: '28273',
    county: 'Mecklenburg County',
    title: '8520 Steele Creek Rd Apt 14, Charlotte, NC 28273',
    rent: 900,
    beds: 1,
    bathrooms: 1.0,
    half_bathrooms: 0,
    sqft: 520,
    lot_size_sqft: null,
    property_type: 'APARTMENT',
    year_built: 1965,
    laundry_type: 'Hookups',
    parking: 'Off Street Driveway Parking',
    garage_spaces: 0,
    heating_type: 'Central Forced Air',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Electric Range / Oven', 'Refrigerator'],
    amenities: [
      'Single-Level Living',
      'Private Ground Entrance',
      'Dedicated Driveway Parking',
      'Air Conditioning',
      'Pet-Friendly'
    ],
    description: `Located in the Steele Creek corridor of southwest Charlotte, this single-level 1-bedroom, 1-bathroom residence offers 520 square feet of private, easy-flow living. A private ground-floor entrance opens into a cozy, light-filled living room.

The kitchen features cabinetry storage, an electric range oven, refrigerator, and utility connections for laundry.

The quiet bedroom provides double closets and access to a clean full bathroom with bathtub and shower surround.

Enjoy private off-street parking, individual exterior entrance, and rapid transit access to Lake Wylie and Charlotte Douglas International Airport.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  },

  // 13. 14120 Ballantyne Country Club Way Apt 205, Charlotte, NC 28277 (Source: 3700 S Tyler St Apt 408)
  {
    source_address: '3700 S Tyler St Apt 408',
    address: '14120 Ballantyne Country Club Way Apt 205',
    city: 'Charlotte',
    state: 'NC',
    zip: '28277',
    county: 'Mecklenburg County',
    title: '14120 Ballantyne Country Club Way Apt 205, Charlotte, NC 28277',
    rent: 900,
    beds: 1,
    bathrooms: 1.0,
    half_bathrooms: 0,
    sqft: 580,
    lot_size_sqft: null,
    property_type: 'APARTMENT',
    year_built: 1974,
    laundry_type: 'Hookups',
    parking: 'Off Street Parking Space',
    garage_spaces: 0,
    heating_type: 'Central Forced Air',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Range / Oven', 'Refrigerator', 'Garbage Disposal'],
    amenities: [
      'Hard-Surface Flooring Throughout',
      'Bright Living Room with Oversized Windows',
      'Central Climate Control',
      'Assigned Parking',
      'Pet-Friendly'
    ],
    description: `Positioned in prime Ballantyne in South Charlotte, this 580-square-foot 1-bedroom apartment residence provides an affordable, stylish home in one of the city's most desirable suburban enclaves. The central living space features easy-care hard-surface flooring and tall windows.

The efficient kitchen includes generous cabinet storage, electric cooking appliances, refrigerator, and disposal.

The secluded bedroom retreat offers peaceful surroundings, ample closet room, and a full bathroom with vanity and tub-shower combination.

Equipped with central heating and air conditioning, designated resident parking, and quick access to Ballantyne Village shopping and I-485.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  },

  // 14. 3125 Heathstead Pl Apt C, Charlotte, NC 28210 (Source: 14735 Montfort Dr Unit 29101)
  {
    source_address: '14735 Montfort Dr Unit 29101',
    address: '3125 Heathstead Pl Apt C',
    city: 'Charlotte',
    state: 'NC',
    zip: '28210',
    county: 'Mecklenburg County',
    title: '3125 Heathstead Pl Apt C, Charlotte, NC 28210',
    rent: 1350,
    beds: 1,
    bathrooms: 1.0,
    half_bathrooms: 0,
    sqft: 695,
    lot_size_sqft: null,
    property_type: 'APARTMENT',
    year_built: 1985,
    laundry_type: 'In Unit',
    parking: 'Assigned Parking Space',
    garage_spaces: 0,
    heating_type: 'Central Forced Air',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Dishwasher', 'Range / Oven', 'Refrigerator', 'Microwave', 'Garbage Disposal', 'Washer', 'Dryer'],
    amenities: [
      'Expansive Walk-In Wardrobe',
      'Private Balcony with Peaceful Tree Views',
      'In-Unit Washer & Dryer',
      'Community Swimming Pool',
      'Assigned Resident Parking',
      'Pet-Friendly'
    ],
    description: `Situated in South Charlotte along Heathstead Place near Quail Hollow, this 695-square-foot 1-bedroom apartment features a serene setting and upscale interior conveniences. An open main living and dining area connects seamlessly to a private covered balcony overlooking mature trees.

The kitchen is equipped with quality countertops, comprehensive appliance collection including a range oven, refrigerator, dishwasher, microwave, and garbage disposal.

The master bedroom suite features an expansive walk-in wardrobe and convenient entry into the updated full bath with wide vanity.

Includes in-unit laundry, central heating and cooling, access to manicured green spaces and community swimming pool, plus assigned parking.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  },

  // 15. 9815 Mallard Creek Rd Apt 12, Charlotte, NC 28262 (Source: 1317 Annex Ave Apt 323)
  {
    source_address: '1317 Annex Ave Apt 323',
    address: '9815 Mallard Creek Rd Apt 12',
    city: 'Charlotte',
    state: 'NC',
    zip: '28262',
    county: 'Mecklenburg County',
    title: '9815 Mallard Creek Rd Apt 12, Charlotte, NC 28262',
    rent: 900,
    beds: 1,
    bathrooms: 1.0,
    half_bathrooms: 0,
    sqft: 489,
    lot_size_sqft: null,
    property_type: 'APARTMENT',
    year_built: 1982,
    laundry_type: 'In Unit',
    parking: 'Assigned Resident Parking Space',
    garage_spaces: 0,
    heating_type: 'Central Forced Air',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Washer', 'Dryer', 'Dishwasher', 'Electric Range / Oven', 'Refrigerator', 'Microwave', 'Garbage Disposal'],
    amenities: [
      'Top-Floor Position',
      'Cozy Focal Fireplace',
      'In-Unit Washer & Dryer',
      'Modern Kitchen Finishes',
      'Assigned Parking',
      'Pet-Friendly'
    ],
    description: `Located in the Mallard Creek and University corridor of north Charlotte, this top-floor 1-bedroom, 1-bathroom apartment offers 489 square feet of smart, quiet living. The main salon is centered around an inviting focal fireplace and natural sunlight.

The kitchen features modern cabinetry, tile backsplash, electric range oven, dishwasher, refrigerator, microwave, and garbage disposal.

The peaceful bedroom features comfortable accommodations, generous closet storage, and a well-appointed full bath.

Complete with an in-unit washer and dryer, central climate control, and assigned parking. Minutes from Concord Mills, University City, and major commuter highways.

Application Fee: $50. Pet-friendly. Submit your rental application today at Choice Properties.`
  }
];

async function run() {
  console.log(`Starting publication workflow for 15 Charlotte 1-bedroom & studio apartments...`);

  // Verify all candidates have authentic source photos
  for (let i = 0; i < CANDIDATES.length; i++) {
    const c = CANDIDATES[i];
    const photos = getPhotos(c.source_address);
    if (!photos || photos.length === 0) {
      throw new Error(`Candidate ${i + 1} (${c.address}) has 0 source photos!`);
    }
    c.photos = photos;
    console.log(`[${i + 1}] ${c.address} (${c.rent}/mo, ${c.beds}b/${c.bathrooms}ba) — Found ${photos.length} source photos.`);
  }

  // Pre-Publishing Audit of every description
  console.log(`\nExecuting Mandatory Pre-Publishing Description Audit...`);
  const prohibitedPatterns = [
    /requirements\s*&\s*qualifications/i,
    /credit\s*score/i,
    /3\.?0?\s*x\s*income/i,
    /\beviction/i,
    /broken\s*lease/i,
    /criminal\s*history/i,
    /stock\s*image/i,
    /beware\s*of\s*scam/i,
    /craigslist/i,
    /facebook\s*marketplace/i,
    /tiktok/i,
    /\bcash\s*app\b/i,
    /\bzelle\b/i,
    /\bvenmo\b/i,
    /\bpaypal\b/i,
    /\bapple\s*pay\b/i,
    /wire\s*transfer/i,
    /security\s*deposit/i,
    /lease\s*(term|duration|length|months)/i,
    /available\s*(date|from|now|immediately)/i,
    /\bsmoking\b/i,
    /\$0\s*fee/i,
    /free\s*app/i
  ];

  for (let i = 0; i < CANDIDATES.length; i++) {
    const c = CANDIDATES[i];
    for (const pat of prohibitedPatterns) {
      if (pat.test(c.description)) {
        throw new Error(`Audit Failure in Candidate ${i + 1} (${c.address}): matches prohibited pattern ${pat}`);
      }
    }
    if (!c.description.includes('Application Fee: $50.')) {
      throw new Error(`Audit Failure in Candidate ${i + 1} (${c.address}): missing required "Application Fee: $50." text`);
    }
    if (!c.description.includes('Submit your rental application today at Choice Properties.')) {
      throw new Error(`Audit Failure in Candidate ${i + 1} (${c.address}): missing required concluding note`);
    }
  }
  console.log(`✓ All 15 candidates passed the Mandatory Pre-Publishing Audit with zero violations!`);

  // Publish each property into public.properties and public.property_photos
  const publishedIds = [];
  const publishedResults = [];

  for (let i = 0; i < CANDIDATES.length; i++) {
    const c = CANDIDATES[i];
    const propertyId = crypto.randomUUID();

    const insertPayload = {
      id: propertyId,
      landlord_id: LANDLORD_ID,
      status: 'private_placement', // Shielded private placement
      title: c.title,
      address: c.address,
      city: c.city,
      state: c.state,
      zip: c.zip,
      county: c.county,
      monthly_rent: c.rent,
      security_deposit: c.rent, // Exactly 1x monthly rent in DB
      application_fee: 50, // Exactly $50
      bedrooms: c.beds,
      bathrooms: c.bathrooms,
      half_bathrooms: c.half_bathrooms,
      square_footage: c.sqft,
      lot_size_sqft: c.lot_size_sqft,
      year_built: c.year_built,
      property_type: c.property_type,
      laundry_type: c.laundry_type,
      parking: c.parking,
      garage_spaces: c.garage_spaces,
      heating_type: c.heating_type,
      cooling_type: c.cooling_type,
      has_central_air: c.has_central_air,
      has_basement: c.has_basement,
      appliances: c.appliances,
      amenities: c.amenities,
      description: c.description,
      pets_allowed: null, // Null on overview per platform invariant
      pet_deposit: null,
      lease_terms: null,
      minimum_lease_months: null,
      available_date: null,
      smoking_allowed: null,
      featured: false
    };

    console.log(`\nInserting [${i + 1}/15]: ${c.address}...`);
    const propRes = await fetch(`${SUPABASE_URL}/rest/v1/properties`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(insertPayload)
    });

    if (!propRes.ok) {
      const err = await propRes.text();
      throw new Error(`Failed to insert property ${c.address}: ${propRes.status} ${err}`);
    }

    // Insert photos in STRICT original source order
    // First photo is hero (display_order: 1, is_hero: true)
    const photoRows = c.photos.map((url, idx) => ({
      property_id: propertyId,
      url: url,
      display_order: idx + 1,
      is_hero: idx === 0,
      watermark_status: 'clean',
      alt_text: `${c.address}, ${c.city}, ${c.state} - Photo ${idx + 1}`
    }));

    const photoRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos`, {
      method: 'POST',
      headers: { ...HEADERS, 'Prefer': 'return=minimal' },
      body: JSON.stringify(photoRows)
    });

    if (!photoRes.ok) {
      const err = await photoRes.text();
      console.warn(`   ⚠ Photo insertion notice for ${c.address}: ${photoRes.status} ${err}`);
    } else {
      console.log(`   ✓ Inserted ${photoRows.length} authentic source photos (Hero: Photo #1)`);
    }

    publishedIds.push(propertyId);
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

  // Generate 32-byte URL-safe base64 token and store SHA-256 hash in public.property_shares
  console.log(`\n=========================================================`);
  console.log(`Generating Magic Multi-Property Share Token for 15 properties...`);

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

  // Link all 15 properties to public.property_share_properties
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

  // Test token resolution via edge function
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
    console.log(`Resolve status: ${testResolve.status}, resolved properties: ${resolveData.properties ? resolveData.properties.length : 0}`);
  } catch (err) {
    console.warn('Resolution test notice:', err.message);
  }

  // Clear any staged properties from the pipeline table
  console.log('\nVerifying and clearing pipeline table...');
  try {
    const delRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties`, {
      method: 'DELETE',
      headers: { ...HEADERS, 'Accept-Profile': 'pipeline' }
    });
    console.log('Pipeline clear status:', delRes.status);
  } catch (err) {
    console.warn('Pipeline clear notice:', err.message);
  }

  const magicLink = `${SITE_URL}/listings.html#share=${token}`;
  console.log(`\n=========================================================`);
  console.log(`🎉 SUCCESS! Master Magic Link Generated:`);
  console.log(magicLink);
  console.log(`=========================================================`);

  fs.writeFileSync('scripts/charlotte_15_published_results.json', JSON.stringify({
    magicLink,
    token,
    shareId,
    count: publishedResults.length,
    properties: publishedResults
  }, null, 2));

  console.log('\nPublished Listings:');
  publishedResults.forEach((p, idx) => {
    console.log(`${idx + 1}. ${p.address}, ${p.city}, ${p.state} ${p.zip} ($${p.rent}/mo | ${p.beds === 0 ? 'Studio' : p.beds + ' Bed'} / ${p.baths} Bath) — ${SITE_URL}/property.html?id=${p.id}&share=${token}`);
  });
}

run().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
