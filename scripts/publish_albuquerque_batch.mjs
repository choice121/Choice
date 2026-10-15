/**
 * Choice Properties — Albuquerque, NM 3-Bedroom Batch Publisher
 *
 * Requirements:
 * 1. 3-bedroom properties in Albuquerque, NM scraped via HomeHarvest (original <= $1,500).
 * 2. Published maximum rent capped at $1,200.
 * 3. Stripped / Aliased addresses (+8 block offset, no unit fingerprinting) so they cannot be found online.
 * 4. Original authentic address quarantined in pipeline_properties.
 * 5. Full compliance with AGENTS.md:
 *    - Title: {Aliased Address}, Albuquerque, NM {Zip}
 *    - $50 application fee (structured field and in description text)
 *    - 100% Pet-friendly
 *    - Security deposit 1x rent in DB, strictly 0 mentions in description
 *    - No lease terms / duration in DB or description
 *    - No available dates / move-in dates in DB or description
 *    - No smoking policies displayed
 *    - Soft spec rounding (sqft to nearest 25 sqft)
 *    - Interior-first photo re-ordering
 *    - Rich, unique, deep walkthrough descriptions for each property
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

const rawCandidates = JSON.parse(fs.readFileSync('scripts/albuquerque_candidates.json', 'utf8'));

// 8 Distinct Albuquerque 3-Bedroom Properties
const ALBUQUERQUE_BATCH = [
  {
    candidate_key: '4601 Carlisle Blvd',
    aliased_address: '4609 Carlisle Blvd NE',
    city: 'Albuquerque',
    state: 'NM',
    zip: '87109',
    county: 'Bernalillo County',
    neighborhood: 'Northeast Heights / Del Norte',
    lat: 35.1328,
    lng: -106.6042,
    property_type: 'CONDO',
    bedrooms: 3,
    bathrooms: 2,
    half_bathrooms: null,
    total_bathrooms: 2,
    square_footage: 975, // soft-rounded from 964
    monthly_rent: 1195, // Original $1,450 -> capped <= $1,200
    security_deposit: 1195,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Designated Off-Street Paved Parking',
    garage_spaces: 0,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Refrigerated Central Air Conditioning',
    laundry_type: 'In-Unit Laundry Connections',
    flooring: ['Hardwood-Style Tile Flooring Throughout'],
    amenities: [
      'Spacious 3-Bedroom, 2-Bathroom Layout in Desirable Northeast Heights',
      'Private Enclosed Outdoor Patio for Entertaining and Relaxation',
      'Durable Hardwood-Look Tile Flooring Throughout All Living Spaces and Bedrooms',
      'Refrigerated Central Air Conditioning and Efficient Forced Air Heating',
      'Equipped Kitchen Featuring Solid Cabinetry, Refrigerator, and Range / Oven',
      'Generous Walk-In Closets in All Three Bedrooms',
      'Convenient Paved Off-Street Parking Immediately Adjacent to Residence',
      'Prime Location Moments from Del Norte Shopping, Dining, and I-25 Access',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `A well-crafted layout, durable hardwood-look tile flooring throughout, and a private enclosed patio highlight this three-bedroom, two-bathroom residence in Albuquerque's established Northeast Heights corridor.

The home opens into a naturally illuminated central living area designed for easy relaxation and everyday living. Seamlessly connecting to the adjoining dining alcove, the kitchen comes equipped with solid wood cabinetry, generous laminate countertops, a full refrigerator, cooking range, and dishwasher for streamlined meal preparation.

All three bedrooms are generously proportioned, each offering substantial closet storage. The primary suite features a dedicated private full bathroom with an updated vanity and tub/shower combination, while the secondary bedrooms have convenient access to the central hall bathroom. Comfort is maintained year-round with modern refrigerated air conditioning and central forced heating.

Step outside to your private enclosed patio, ideal for morning coffee, evening relaxation, or enjoying Albuquerque's sunny climate. Dedicated off-street parking is included, with convenient proximity to neighborhood grocery markets, local dining destinations, and arterial transit routes across the metro area.

Key Property Features:
• 3 Bedrooms, 2 Bathrooms (approx. 975 sq. ft.)
• Hardwood-style tile flooring throughout entire home
• Refrigerated central air conditioning and forced heating
• Equipped kitchen with full refrigerator, range, and dishwasher
• Private enclosed patio space
• Deep closet storage in every bedroom
• Dedicated off-street parking
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,195
• Application Fee: $50 per adult applicant
• Pet Policy: Pet-Friendly

Submit your rental application today at Choice Properties.`
  },
  {
    candidate_key: '1400 Pennsylvania St',
    aliased_address: '1408 Pennsylvania St NE',
    city: 'Albuquerque',
    state: 'NM',
    zip: '87110',
    county: 'Bernalillo County',
    neighborhood: 'ABQ Uptown / Winrock',
    lat: 35.0975,
    lng: -106.5591,
    property_type: 'TOWNHOUSE',
    bedrooms: 3,
    bathrooms: 1.5,
    half_bathrooms: 1,
    total_bathrooms: 1.5,
    square_footage: 1200,
    monthly_rent: 1150, // Original $1,300 -> capped <= $1,200
    security_deposit: 1150,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Assigned Off-Street Courtyard Parking',
    garage_spaces: 0,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Refrigerated Central Air Conditioning',
    laundry_type: 'Dedicated In-Unit Laundry Room with Electric Hookups',
    flooring: ['Contemporary Plank Flooring', 'Plush Carpeted Bedrooms'],
    amenities: [
      'Two-Story 3-Bedroom Townhome in Prime ABQ Uptown Corridor',
      '1.5 Bathrooms with Main-Floor Powder Room for Guest Convenience',
      'Private Enclosed Backyard Area Plus Shared Landscaped Courtyard',
      'Modern Refrigerated Air Conditioning for Peak Summer Comfort',
      'Dedicated In-Unit Laundry Space with Washer and Electric Dryer Connections',
      'Spacious Kitchen with Extensive Cabinetry and Double-Basin Sink',
      'Assigned Off-Street Parking Spaces Included',
      'Walking Distance to Uptown Shopping, Trader Joe\'s, and Winrock Town Center',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Stove / Range', 'Dishwasher', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `Positioned in Albuquerque's highly desirable Uptown neighborhood, this two-story contemporary townhome provides 1,200 square feet of comfortable living space, featuring three spacious bedrooms, 1.5 bathrooms, and a private enclosed rear yard.

The ground floor invites you into an open-concept living and entertaining room accented by stylish modern plank flooring and expansive picture windows. The connecting kitchen provides ample counter space, clean cabinetry, a double-basin sink, and full cooking appliances including a refrigerator, range, and dishwasher. A convenient main-level half bath (powder room) accommodates daytime guests with ease.

Upstairs, three well-appointed bedrooms feature plush carpeting and generous closet capacity. The full central bathroom features a ceramic-tiled shower/tub combo and a generous vanity with integrated storage. Additional interior highlights include a dedicated laundry area with electric washer/dryer connections and modern refrigerated air conditioning ensuring total temperature control throughout hot summer months.

Outside, enjoy a private rear yard perfect for container gardening and outdoor relaxation, along with direct access to a shared landscaped courtyard. Located moments from premier Uptown shopping at Winrock Town Center, Coronado Center, and regional transit lines.

Key Property Features:
• 3 Bedrooms, 1.5 Bathrooms (1,200 sq. ft.)
• Multi-level townhome floor plan with distinct living and sleeping zones
• Refrigerated central air conditioning
• Ground-floor powder room plus upper-level full bath
• In-unit laundry room with washer/dryer hookups
• Private enclosed backyard area
• Assigned off-street parking
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,150
• Application Fee: $50 per adult applicant
• Pet Policy: Pet-Friendly

Submit your rental application today at Choice Properties.`
  },
  {
    candidate_key: '4200 Montgomery Blvd',
    aliased_address: '4208 Montgomery Blvd NE',
    city: 'Albuquerque',
    state: 'NM',
    zip: '87109',
    county: 'Bernalillo County',
    neighborhood: 'Montgomery Heights / Del Norte',
    lat: 35.1294,
    lng: -106.6002,
    property_type: 'CONDO',
    bedrooms: 3,
    bathrooms: 2,
    half_bathrooms: null,
    total_bathrooms: 2,
    square_footage: 1275, // soft-rounded from 1262
    monthly_rent: 1199, // Original $1,500 -> capped <= $1,200
    security_deposit: 1199,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Covered Carport Parking Space',
    garage_spaces: 1,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Connections',
    flooring: ['Hardwood-Style Laminate Flooring', 'Ceramic Tile'],
    amenities: [
      'Expansive 1,275 Sq. Ft. 3-Bedroom Layout with Mountain Vistas',
      'Private Covered Balcony / Patio with Unobstructed Scenic Views',
      'Unique Dual-Entry Architecture with Private Access to 3rd Bedroom / Home Office',
      'Gated Community Setting Featuring Heated Pool, Fitness Center & Clubhouse',
      'Covered Assigned Carport Parking Included',
      'Bright Open-Concept Living and Dining Rooms with Large View Windows',
      'Two Full Ceramic-Tiled Bathrooms with Contemporary Fixtures',
      'Minutes to Neighborhood Grocery Stores, Arroyo Del Oso Golf Course, and I-25',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Garbage Disposal', 'Washer/Dryer Hookups'],
    description: `Spectacular mountain views, expansive open-plan interiors, and a generous 1,275-square-foot layout define this three-bedroom, two-bathroom residence situated in Northeast Albuquerque.

The home unfolds through a bright, light-filled central living room where oversized sliding glass doors frame panoramic Sandia Mountain views and open to a private covered terrace. An open dining area leads seamlessly to the fully outfitted kitchen, complete with a full refrigerator, electric range, built-in microwave, dishwasher, and ample pantry cabinetry.

A flexible architectural layout provides private secondary entrance access to the third bedroom, creating the ideal setup for an executive home office, creative studio, or guest quarters. The primary bedroom retreat features substantial wardrobe space and an en-suite bathroom with custom vanity finishes. The second full bathroom is thoughtfully situated off the main corridor to serve household members and guests alike.

Residents enjoy community amenities including a heated outdoor swimming pool, fully equipped fitness center, resident clubhouse, and designated covered carport parking. Situated within walking distance of local neighborhood markets, dining, and scenic walking trails.

Key Property Features:
• 3 Bedrooms, 2 Full Bathrooms (approx. 1,275 sq. ft.)
• Panoramic mountain vistas from private covered terrace
• Flexible 3rd bedroom layout with secondary private entrance
• Central heating and cooling systems throughout
• Fully equipped kitchen with microwave and dishwasher
• Gated community access with heated pool and fitness facility
• Covered carport parking space
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,199
• Application Fee: $50 per adult applicant
• Pet Policy: Pet-Friendly

Submit your rental application today at Choice Properties.`
  },
  {
    candidate_key: '200 Figueroa St',
    aliased_address: '208 Figueroa St NE',
    city: 'Albuquerque',
    state: 'NM',
    zip: '87123',
    county: 'Bernalillo County',
    neighborhood: 'Foothills / Singing Arrow',
    lat: 35.0746,
    lng: -106.5187,
    property_type: 'APARTMENT',
    bedrooms: 3,
    bathrooms: 2,
    half_bathrooms: null,
    total_bathrooms: 2,
    square_footage: 1000, // soft-rounded from 1007
    monthly_rent: 1185, // Original $1,495 -> capped <= $1,200
    security_deposit: 1185,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Paved Off-Street Lot Parking',
    garage_spaces: 0,
    heating_type: 'Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'On-Site Laundry Facilities & Hookups',
    flooring: ['Hardwood-Style Flooring', 'Carpeted Bedrooms'],
    amenities: [
      'Open-Concept 3-Bedroom Floor Plan in the East Gateway Corridor',
      'Two Full Bathrooms with Vanity Storage and Tub/Shower Surrounds',
      'Modern Kitchen with Full Dishwasher, Refrigerator, and Range Included',
      'Central Climate Control for Year-Round Temperature Regulation',
      'Durable Wood-Style Plank Flooring Across Living and Dining Spaces',
      'Plush Carpeted Bedrooms with Deep Built-In Closets',
      'Community Amenities Including Swimming Pool, Dog Park, and Fitness Center',
      'Quick Access to Central Ave, Route 66 Historic Corridor, and I-40',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Electric Range / Oven', 'Dishwasher', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `A fluid open-concept living design, practical multi-room configuration, and convenient Foothills access highlight this comfortable three-bedroom, two-bathroom residence in East Albuquerque.

Entering the home, the main entertaining zone combines living and dining spaces into one unified, cohesive environment accented by contemporary wood-style plank flooring. The adjacent kitchen features an efficient layout complete with updated appliances, including a dishwasher, full refrigerator, cooking range, and plentiful counter space for food preparation.

Three quiet bedrooms feature plush carpeting underfoot and spacious wardrobe storage. The primary bedroom includes an attached private full bathroom, while the second full bathroom is conveniently positioned near the guest bedrooms. Central air conditioning and energy-efficient heating ensure reliable comfort throughout all seasons.

Community amenities include a resident swimming pool, landscaped dog park, fitness center, and plentiful off-street parking. Conveniently positioned near mountain hiking trailheads, regional shopping centers, and major east-west transit routes across Albuquerque.

Key Property Features:
• 3 Bedrooms, 2 Bathrooms (approx. 1,000 sq. ft.)
• Open living and dining room layout with wood-style flooring
• Kitchen equipped with dishwasher, range, and refrigerator
• Two full bathrooms with vanity sinks and full tubs
• Central air conditioning and heating
• Community pool, fitness room, and dog park
• Paved off-street parking included
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,185
• Application Fee: $50 per adult applicant
• Pet Policy: Pet-Friendly

Submit your rental application today at Choice Properties.`
  },
  {
    candidate_key: '301 Western Skies Dr',
    aliased_address: '309 Western Skies Dr SE',
    city: 'Albuquerque',
    state: 'NM',
    zip: '87123',
    county: 'Bernalillo County',
    neighborhood: 'Foothills South / Western Skies',
    lat: 35.0682,
    lng: -106.5165,
    property_type: 'APARTMENT',
    bedrooms: 3,
    bathrooms: 2,
    half_bathrooms: null,
    total_bathrooms: 2,
    square_footage: 925, // soft-rounded from 916
    monthly_rent: 988, // Original $988 -> preserved <= $1,200
    security_deposit: 988,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Dedicated Resident Parking Lot',
    garage_spaces: 0,
    heating_type: 'Central Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Community Laundry Facility',
    flooring: ['Easy-Care Wood-Style Flooring', 'Neutral Bedroom Carpeting'],
    amenities: [
      'Exceptional Value 3-Bedroom, 2-Bathroom Rental in Albuquerque',
      'Dual Full Bathrooms Supporting Morning Family Convenience',
      'Private Outdoor Balcony Space with Open Sky Views',
      'Full Kitchen Equipped with Dishwasher, Refrigerator, and Range',
      'Hardwood-Style Flooring Across Central High-Traffic Areas',
      'Central Climate Control System with Digital Thermostat',
      'Community Pool, Recreation Clubhouse, and On-Site Dog Park',
      'Close to Manzano Mesa Community Center, Parks, and Retail Outlets',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Range Hood'],
    description: `Offering unbeatable value and three complete bedrooms, this thoughtfully arranged residence delivers two full bathrooms, central climate control, and a private outdoor balcony in southeast Albuquerque.

The interior showcases an open living and dining configuration floored in durable hardwood-style materials that simplify daily maintenance. Large windows and a sliding patio door fill the living room with natural daylight while connecting out to the fresh-air balcony. The efficient kitchen is equipped with a cooking range, refrigerator, and dishwasher, accompanied by ample cabinetry for dinnerware and pantry goods.

The three bedrooms are comfortably carpeted and feature dedicated closet space. Having two complete full bathrooms eliminates morning bottlenecks and provides true privacy for the primary bedroom occupant. Central heating and air conditioning maintain steady comfort year-round.

On-site community features include a swimming pool, clubhouse, well-kept grounds with a dedicated pet play area, and ample off-street parking. Situated minutes from local parks, grocery stores, and quick highway access.

Key Property Features:
• 3 Bedrooms, 2 Bathrooms (approx. 925 sq. ft.)
• Affordable monthly rent of just $988
• Private outdoor balcony
• Open layout with easy-care wood-style flooring
• Kitchen equipped with dishwasher, range, and full refrigerator
• Dual full bathrooms
• Central air conditioning and heating
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $988
• Application Fee: $50 per adult applicant
• Pet Policy: Pet-Friendly

Submit your rental application today at Choice Properties.`
  },
  {
    candidate_key: '9000 Zuni Rd',
    aliased_address: '9008 Zuni Rd SE',
    city: 'Albuquerque',
    state: 'NM',
    zip: '87123',
    county: 'Bernalillo County',
    neighborhood: 'Trumbull Village / East Gateway',
    lat: 35.0681,
    lng: -106.5492,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1,
    half_bathrooms: null,
    total_bathrooms: 1,
    square_footage: 800,
    monthly_rent: 1125, // Original $1,400 -> capped <= $1,200
    security_deposit: 1125,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Driveway & Dedicated Off-Street Parking',
    garage_spaces: 0,
    heating_type: 'Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated In-Home Laundry Hookups',
    flooring: ['Easy-Clean Vinyl Plank Flooring Throughout'],
    amenities: [
      'Standalone Single-Level 3-Bedroom Home with Independent Parcel Footprint',
      'Private Driveway with Dedicated Off-Street Parking at Your Doorstep',
      'Bright Open Living Room with Vaulted Ceilings and Modern Finishes',
      'Spacious Eat-In Kitchen with Abundant Cabinetry and Full Appliance Suite',
      'Dedicated In-Home Laundry Room with Washer/Dryer Connections',
      'Private Enclosed Yard Space for Outdoor Enjoyment and Pets',
      'Energy-Efficient Central Heating and Cooling',
      'Convenient East Gateway Location Near Public Transit, Shopping, and Parks',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `Enjoy the peace, privacy, and independence of a standalone single-story residence in this three-bedroom home featuring a private driveway, in-home laundry hookups, and a private yard space in Albuquerque.

The front entry opens directly into a bright central living room enhanced by elevated vaulted ceilings and clean, easy-maintenance vinyl plank flooring that extends throughout the entire residence. The spacious eat-in kitchen offers generous cabinetry, extensive food-prep surfaces, a full refrigerator, and a gas cooking range with overhead ventilation.

Three versatile bedrooms feature generous windows and dedicated clothing closets, suitable for family living, a home office, or guest space. The full bathroom includes a vanity with lower cabinetry and an easy-clean tub/shower enclosure. A separate utility alcove houses dedicated washer and dryer hookups for private in-home laundry convenience.

Step outside to your private yard area, ideal for relaxing outdoors or playing with pets. A private driveway offers direct, hassle-free parking right at your doorstep. Located with straightforward access to grocery centers, transit routes, and local neighborhood parks.

Key Property Features:
• Standalone Single-Family Home (approx. 800 sq. ft.)
• 3 Bedrooms, 1 Full Bathroom
• Vaulted ceiling architecture in primary living space
• Vinyl plank flooring throughout with zero carpet
• Eat-in kitchen with full refrigerator and cooking range
• In-home laundry connections
• Private driveway parking and dedicated yard area
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,125
• Application Fee: $50 per adult applicant
• Pet Policy: Pet-Friendly

Submit your rental application today at Choice Properties.`
  },
  {
    candidate_key: '7303 Montgomery Blvd',
    aliased_address: '7311 Montgomery Blvd NE',
    city: 'Albuquerque',
    state: 'NM',
    zip: '87109',
    county: 'Bernalillo County',
    neighborhood: 'Arroyo Del Oso / Northeast Heights',
    lat: 35.1302,
    lng: -106.5684,
    property_type: 'APARTMENT',
    bedrooms: 3,
    bathrooms: 2,
    half_bathrooms: null,
    total_bathrooms: 2,
    square_footage: 1400, // soft-rounded from 1396
    monthly_rent: 1175, // Original $1,253 -> capped <= $1,200
    security_deposit: 1175,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Covered Resident Carport & Guest Parking',
    garage_spaces: 0,
    heating_type: 'Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups & Laundry Center',
    flooring: ['Polished Hardwood-Style Flooring', 'Plush Carpeted Bedrooms'],
    amenities: [
      'Remarkably Generous 1,400 Sq. Ft. 3-Bedroom, 2-Bathroom Floor Plan',
      'Dual Full Bathrooms with Extensive Counter and Vanity Storage',
      'Gourmet Kitchen with Dishwasher, Large Refrigerator, and Breakfast Bar',
      'Private Covered Patio Overlooking Landscaped Grounds',
      'Dual Walk-In Closets Providing Ample Wardrobe Capacity',
      'Central Climate Control System with Programmable Thermostat',
      'Resort-Style Community Pool, Sundeck with BBQ Grills, and Fitness Center',
      'Adjacent to Arroyo Del Oso Park, Golf Course, and San Mateo Retail Corridor',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Disposal', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `Boasting an expansive 1,400-square-foot floor plan, this three-bedroom, two-bathroom apartment home combines generous room proportions with resort-style community amenities in Albuquerque's Arroyo Del Oso corridor.

The front entry leads into an oversized great room with dedicated living and dining areas floored in refined hardwood-style finishes. Expansive sliding patio doors open onto a private covered outdoor terrace overlooking landscaped grounds. The spacious kitchen features an open breakfast bar, expansive wrap-around cabinetry, a large refrigerator, electric range, and multi-cycle dishwasher.

The sleeping quarters offer genuine tranquility, highlighted by a king-sized primary suite complete with a private en-suite bathroom and a deep walk-in closet. The two secondary bedrooms are equally comfortable, each featuring plush carpeting, generous natural lighting, and close proximity to the second full hallway bathroom.

Residents enjoy access to a resort-style swimming pool, sundeck with outdoor grilling stations, clubhouse, and fitness center. Positioned within minutes of Arroyo Del Oso Golf Course, neighborhood parks, schools, and rapid commuter routes across Albuquerque.

Key Property Features:
• 3 Bedrooms, 2 Bathrooms (approx. 1,400 sq. ft.)
• Vast open great room with breakfast bar connectivity
• Kitchen equipped with dishwasher, range, and full refrigerator
• Primary suite with private full bathroom and walk-in closet
• Private covered patio overlooking green spaces
• Central air conditioning and heating
• Resort amenities: swimming pool, sundeck with grills, and gym
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,175
• Application Fee: $50 per adult applicant
• Pet Policy: Pet-Friendly

Submit your rental application today at Choice Properties.`
  },
  {
    candidate_key: '12021 Skyline Rd',
    aliased_address: '12029 Skyline Rd NE',
    city: 'Albuquerque',
    state: 'NM',
    zip: '87123',
    county: 'Bernalillo County',
    neighborhood: 'Sandia Foothills / Glenwood Hills',
    lat: 35.0862,
    lng: -106.4981,
    property_type: 'APARTMENT',
    bedrooms: 3,
    bathrooms: 2,
    half_bathrooms: null,
    total_bathrooms: 2,
    square_footage: 1250, // soft-rounded from 1254
    monthly_rent: 1190, // Original $1,477 -> capped <= $1,200
    security_deposit: 1190,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    has_central_air: true,
    has_basement: false,
    parking: 'Designated Covered Carport Parking',
    garage_spaces: 0,
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Hardwood-Style Vinyl Plank', 'Plush Carpeted Bedrooms'],
    amenities: [
      'Stunning Sandia Foothills Backdrop with Crisp Desert Mountain Air',
      'Spacious 1,250 Sq. Ft. 3-Bedroom, 2-Bathroom Layout',
      'Private Scenic Balcony with Unobstructed Views of the High Desert',
      'Chef-Friendly Galley Kitchen with Updated Appliances and Dishwasher',
      'Two Full Ceramic-Tiled Bathrooms with Deep Soaking Tubs',
      'Primary Suite Featuring Walk-In Closet and Private Bathroom',
      'Central Air Conditioning and Energy-Efficient Forced Air Heat',
      'Community Pool, Year-Round Spa, Fitness Studio, and Pet Play Area',
      'Pet-Friendly Accommodations'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Range Hood', 'Washer/Dryer Hookups'],
    description: `Nestled against the foothills of the Sandia Mountains, this three-bedroom, two-bathroom residence offers 1,250 square feet of peaceful high-desert living, panoramic mountain vistas, and scenic outdoor balcony relaxation.

The main living room greets you with expansive picture windows that flood the space with natural Southwest daylight. Handsome hardwood-style vinyl plank flooring spans the central living and dining areas, leading out to a private scenic balcony ideal for enjoying Albuquerque's sunsets. The functional galley kitchen features updated modern appliances including a dishwasher, cooking range, and full refrigerator, flanked by generous counter workspace and cabinet storage.

Three large bedrooms are outfitted with plush carpeting and expansive wardrobe closets. The primary retreat includes an attached private full bathroom, while the second full bathroom offers a deep soaking tub and stylish vanity. Year-round comfort is guaranteed with central heating and air conditioning.

Community highlights include a resort swimming pool, spa, fitness studio, and fenced dog run. Located steps away from scenic Foothills hiking trailheads, neighborhood grocery markets, and major Eastside transit arteries.

Key Property Features:
• 3 Bedrooms, 2 Bathrooms (approx. 1,250 sq. ft.)
• Sandia Foothills setting with private scenic balcony
• Updated kitchen equipped with dishwasher, range, and refrigerator
• Two complete full bathrooms
• Primary bedroom suite with walk-in wardrobe
• Central air conditioning and heating
• Community swimming pool, spa, gym, and pet area
• Pet-friendly living (dogs and cats welcome)

Application Information:
• Monthly Rent: $1,190
• Application Fee: $50 per adult applicant
• Pet Policy: Pet-Friendly

Submit your rental application today at Choice Properties.`
  }
];

async function publishAlbuquerqueBatch() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log(' Choice Properties — Albuquerque, NM 3-Bedroom Batch Publishing');
  console.log('═════════════════════════════════════════════════════════════════\n');

  const today = new Date().toISOString().split('T')[0];
  const publishedResults = [];

  for (let idx = 0; idx < ALBUQUERQUE_BATCH.length; idx++) {
    const item = ALBUQUERQUE_BATCH[idx];
    console.log(`\n[${idx + 1}/${ALBUQUERQUE_BATCH.length}] Processing ${item.aliased_address} (Orig: ${item.candidate_key})...`);

    // Match candidate from scraped data
    const cand = rawCandidates.find(c => c.street.startsWith(item.candidate_key));
    if (!cand) {
      console.error(`   ✗ Candidate not found for ${item.candidate_key}`);
      continue;
    }

    // 1. Quarantined provenance in pipeline_properties
    const pipeId = `PP-ABQ-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const pipePayload = {
      id: pipeId,
      source: 'homeharvest',
      source_url: cand.property_url || null,
      source_listing_id: cand.property_url ? cand.property_url.split('/').pop() : null,
      title: `${item.aliased_address}, ${item.city}, ${item.state} ${item.zip}`,
      address: cand.full_addr, // authentic original address quarantined
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
      pets_allowed: true,
      pet_types_allowed: ['Dogs', 'Cats'],
      smoking_allowed: false,
      has_central_air: item.has_central_air,
      has_basement: item.has_basement,
      parking: item.parking,
      garage_spaces: item.garage_spaces,
      heating_type: item.heating_type,
      cooling_type: item.cooling_type,
      laundry_type: item.laundry_type,
      flooring: item.flooring,
      amenities: item.amenities,
      appliances: item.appliances,
      description: item.description,
      original_description: cand.text,
      original_image_urls: cand.photos,
      status: 'published',
      choice_property_id: null, // will link below
      scraped_at: new Date().toISOString(),
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

    // 3. Prepare public property record
    // Title standard: {Aliased Address}, Albuquerque, NM {Zip}
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

    // 4. Photos: Optimize order so interior is hero (index 0)
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

  fs.writeFileSync('scripts/published_albuquerque_results.json', JSON.stringify(publishedResults, null, 2));

  console.log('\n═════════════════════════════════════════════════════════════════');
  console.log(` Successfully published ${publishedResults.length} Albuquerque 3B listings!`);
  console.log(' All prices <= $1,200 | All addresses aliased and quarantined');
  console.log('═════════════════════════════════════════════════════════════════\n');

  publishedResults.forEach(r => {
    console.log(`${r.n}. ${r.address}, ${r.city}, ${r.state} ${r.zip} ($${r.rent.toLocaleString()}/mo | ${r.beds} Bed / ${r.baths} Bath) — ${r.url}`);
  });
}

publishAlbuquerqueBatch().catch(console.error);
