import { CREDENTIALS_CONFIG } from '../credentials-config.mjs';
import https from 'https';

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

function slugSeg(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function buildCanonicalUrl(p) {
  const id = String(p.id).toLowerCase();
  const state = 'oh';
  const city = slugSeg(p.city);
  const beds = `${p.bedrooms}br`;
  const rawType = String(p.property_type || '').toLowerCase();
  const type = rawType.includes('town') ? 'townhouse' : 'house';
  return `${SITE_URL}/rent/${state}/${city}/${beds}-${type}-${id}/`;
}

function buildDirectUrl(p) {
  return `${SITE_URL}/property.html?id=${p.id}`;
}

const COLUMBUS_ENRICHED = {
  'PP-677D2A3B': {
    title: '2BR/1BA Single-Family Home in Columbus – $1199/mo',
    address: '5804 N Meadows Blvd',
    city: 'Columbus',
    state: 'OH',
    zip: '43229',
    county: 'Franklin County',
    neighborhood: 'Forest Park East / Northland',
    lat: 40.0846523,
    lng: -82.9926666,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1.0,
    total_bathrooms: 1,
    square_footage: 1215,
    monthly_rent: 1199,
    security_deposit: 1199,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    pet_deposit: 300,
    smoking_allowed: false,
    minimum_lease_months: 12,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Driveway Parking',
    heating_type: 'Central Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Hardwood', 'Tile', 'Carpet'],
    amenities: [
      'Central Air Conditioning & Heating',
      'Spacious 1,215 Sq. Ft. Floor Plan',
      'Private Backyard Space',
      'Dedicated Driveway Parking',
      'Bright Living Room with Ample Natural Light',
      'Pet Friendly (Dogs & Cats Welcome)',
      'Smoke-Free Living Environment'
    ],
    appliances: ['Refrigerator', 'Stove / Range', 'Dishwasher', 'Washer/Dryer Hookups'],
    description: `Welcome to 5804 N Meadows Blvd — an expansive 2-bedroom, 1-bathroom single-family home offering 1,215 sq. ft. of comfortable living space in Northland / Forest Park East, Columbus, OH.

This single-story residence features a generously sized living area, dining nook, and a functional kitchen equipped with full appliances and solid cabinet space. Two comfortable bedrooms share a well-appointed central full bathroom. Enjoy private off-street driveway parking and a peaceful backyard for outdoor leisure. Conveniently situated near Karl Road, Dublin Granville Road, local shopping centers, and I-71 for straightforward commuting across central Ohio.

Key Property Features:
• 2 Bedrooms, 1 Full Bathroom (1,215 sq. ft.)
• Central air conditioning and forced-air heating
• Kitchen with refrigerator, stove/range, and dishwasher
• In-unit washer and dryer hookups
• Dedicated private driveway parking
• Pet-friendly living (dogs and cats welcome)

Lease Details:
• Monthly Rent: $1,199
• Security Deposit: $1,199 (equal to 1 month's rent)
• Application Fee: $50 per adult applicant
• Lease Term: 12 months minimum

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  'PP-5E1B93E7': {
    title: '2BR/1BA Ranch with Full Basement in Columbus – $1175/mo',
    address: '2609 Avalon Pl',
    city: 'Columbus',
    state: 'OH',
    zip: '43219',
    county: 'Franklin County',
    neighborhood: 'Eastland / Devonshire',
    lat: 39.9824941,
    lng: -82.9336568,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1.0,
    total_bathrooms: 1,
    square_footage: 761,
    monthly_rent: 1175,
    security_deposit: 1175,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    pet_deposit: 300,
    smoking_allowed: false,
    minimum_lease_months: 12,
    has_central_air: true,
    has_basement: true,
    parking: 'Private Driveway Parking',
    heating_type: 'Central Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Full Basement Washer/Dryer Hookups',
    flooring: ['Hardwood Flooring', 'Tile'],
    amenities: [
      'Full Unfinished Basement for Extra Storage & Laundry',
      'Updated Kitchen with Modern Countertops',
      'Refreshed Bathroom with Contemporary Vanity',
      'Hardwood Floors Throughout Living Areas',
      'Central Air Conditioning & Heating',
      'Private Driveway Parking',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Basement Washer/Dryer Hookups'],
    description: `Welcome to 2609 Avalon Pl — a charming, move-in ready 2-bedroom, 1-bathroom ranch home featuring a full basement in Columbus, OH.

This home offers 761 sq. ft. of efficient main-level living space enhanced by refinished hardwood floors, fresh interior paint, and an updated kitchen with solid cabinetry. A full basement provides extensive clean storage space along with dedicated washer and dryer hookups. Outside, enjoy a level backyard and private driveway parking. Located with easy access to I-670, Easton Town Center, and John Glenn International Airport.

Key Property Features:
• 2 Bedrooms, 1 Full Bathroom
• Full basement providing abundant extra storage & utility room
• Hardwood flooring and updated fixtures
• Modern central HVAC system
• Private off-street driveway parking
• Pet-friendly living (dogs and cats welcome)

Lease Details:
• Monthly Rent: $1,175
• Security Deposit: $1,175 (equal to 1 month's rent)
• Application Fee: $50 per adult applicant
• Lease Term: 12 months minimum

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  'PP-78E494FF': {
    title: '1BR/1BA Single-Family Cottage in Columbus – $725/mo',
    address: '141 Stevens Ave',
    city: 'Columbus',
    state: 'OH',
    zip: '43222',
    county: 'Franklin County',
    neighborhood: 'Franklinton / West Columbus',
    lat: 39.9595848,
    lng: -83.0415885,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 1,
    bathrooms: 1.0,
    total_bathrooms: 1,
    square_footage: 500,
    monthly_rent: 725,
    security_deposit: 725,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    pet_deposit: 250,
    smoking_allowed: false,
    minimum_lease_months: 12,
    has_central_air: false,
    has_basement: false,
    parking: 'Dedicated Off-Street Parking',
    heating_type: 'Forced Air Heat',
    cooling_type: 'Window Unit AC Compatible',
    laundry_type: 'Nearby Laundry Facilities',
    flooring: ['Durable Vinyl Plank', 'Tile'],
    amenities: [
      'Affordable High-Value Single-Family Cottage',
      'Low Utility Footprint & Low-Maintenance Vinyl Floors',
      'Dedicated Off-Street Parking Space',
      'Quiet Residential Setting in Historic Franklinton',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Refrigerator', 'Electric Stove / Range'],
    description: `Welcome to 141 Stevens Ave — an affordable, low-maintenance 1-bedroom, 1-bathroom single-family cottage located in Franklinton, Columbus, OH.

Offering 500 sq. ft. of cozy living space, this home includes durable wood-look vinyl flooring, a bright living room, an updated kitchen with full stove and refrigerator, and a refreshed full bathroom. Ideal for anyone seeking economical living with total single-family privacy. Centrally situated near Broad St, downtown Columbus, COSI, and Franklinton Arts District.

Key Property Features:
• 1 Bedroom, 1 Full Bathroom
• Low-maintenance vinyl plank flooring
• Fully equipped kitchen with stove and refrigerator
• Dedicated off-street parking
• Close to downtown Columbus and major bus routes
• Pet-friendly living (dogs and cats welcome)

Lease Details:
• Monthly Rent: $725
• Security Deposit: $725 (equal to 1 month's rent)
• Application Fee: $50 per adult applicant
• Lease Term: 12 months minimum

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  'PP-D1E42BC4': {
    title: '2BR/1BA Remodeled Home in Columbus – $1150/mo',
    address: '1062 Brentnell Ave',
    city: 'Columbus',
    state: 'OH',
    zip: '43219',
    county: 'Franklin County',
    neighborhood: 'Brentnell / North Central',
    lat: 39.9894195,
    lng: -82.9499702,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1.0,
    total_bathrooms: 1,
    square_footage: 672,
    monthly_rent: 1150,
    security_deposit: 1150,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    pet_deposit: 250,
    smoking_allowed: false,
    minimum_lease_months: 12,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Driveway Parking',
    heating_type: 'Forced Air Central Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Luxury Vinyl Plank', 'Modern Tile'],
    amenities: [
      'Fully Remodeled Modern Interior',
      'Brand New Kitchen Cabinetry & Countertops',
      'Modern Bathroom Vanity & Tile Finishes',
      'Central Air Conditioning & Heating',
      'Private Driveway Parking & Level Yard',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Washer/Dryer Hookups'],
    description: `Welcome to 1062 Brentnell Ave — a newly remodeled 2-bedroom, 1-bathroom single-family residence in Columbus, OH.

This 672 sq. ft. home has been updated from top to bottom with new luxury vinyl plank flooring, fresh neutral paint, updated kitchen cabinetry with ample countertops, and a modern bathroom. Enjoy energy-efficient central heating and cooling, in-unit laundry hookups, and dedicated driveway parking. Convenient to Sunbury Road, I-670, and shopping plazas.

Key Property Features:
• 2 Bedrooms, 1 Full Bathroom
• Modern remodel with new flooring and cabinetry
• Central air conditioning and heating
• In-unit washer/dryer hookups
• Private driveway parking
• Pet-friendly living (dogs and cats welcome)

Lease Details:
• Monthly Rent: $1,150
• Security Deposit: $1,150 (equal to 1 month's rent)
• Application Fee: $50 per adult applicant
• Lease Term: 12 months minimum

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  'PP-799D58C8': {
    title: '2BR/1BA Single-Family Home in Columbus – $1000/mo',
    address: '2665 Palmetto St',
    city: 'Columbus',
    state: 'OH',
    zip: '43204',
    county: 'Franklin County',
    neighborhood: 'Westgate / Hilltop',
    lat: 39.9508452,
    lng: -83.0709279,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1.0,
    total_bathrooms: 1,
    square_footage: 902,
    monthly_rent: 1000,
    security_deposit: 1000,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    pet_deposit: 300,
    smoking_allowed: false,
    minimum_lease_months: 12,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Driveway Parking',
    heating_type: 'Central Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Plank Flooring', 'Tile'],
    amenities: [
      'Central Climate Control System',
      'Expansive Backyard for Relaxation',
      'Private Driveway Parking',
      'Bright Kitchen with Solid Cabinet Storage',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Gas Range / Oven', 'Refrigerator', 'Washer/Dryer Hookups'],
    description: `Welcome to 2665 Palmetto St — a comfortable 2-bedroom, 1-bathroom single-family house offering 902 sq. ft. of living space in Westgate / Hilltop, Columbus, OH.

This practical floor plan offers a spacious front living room, a bright eat-in kitchen with gas cooking, and two comfortable bedrooms sharing a central bath. The property includes a level private backyard and off-street driveway parking. Located in an established neighborhood convenient to West Broad St, Sullivant Ave, I-270, and I-70.

Key Property Features:
• 2 Bedrooms, 1 Full Bathroom (902 sq. ft.)
• Efficient central heating and cooling
• Gas range and refrigerator included
• Private driveway parking and backyard
• Pet-friendly living (dogs and cats welcome)

Lease Details:
• Monthly Rent: $1,000
• Security Deposit: $1,000 (equal to 1 month's rent)
• Application Fee: $50 per adult applicant
• Lease Term: 12 months minimum

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  'PP-E08074C1': {
    title: '2BR/1BA Renovated Home w/ Granite & W/D – $1150/mo',
    address: '344 E 20th Ave',
    city: 'Columbus',
    state: 'OH',
    zip: '43201',
    county: 'Franklin County',
    neighborhood: 'Iuka Ravine / University District',
    lat: 40.0045605,
    lng: -82.999486,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1.0,
    total_bathrooms: 1,
    square_footage: 912,
    monthly_rent: 1150,
    security_deposit: 1150,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    pet_deposit: 300,
    smoking_allowed: false,
    minimum_lease_months: 12,
    has_central_air: true,
    has_basement: false,
    parking: 'Off-Street Dedicated Parking Lot',
    heating_type: 'Central Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Included',
    flooring: ['Hard Flooring Throughout', 'Modern Tile'],
    amenities: [
      'Granite Countertops & Brand New Kitchen Cabinets',
      'In-Unit Washer and Dryer Included',
      'Dual Vanity Sinks & Linen Storage in Bathroom',
      'Oversized Picture Window in Living Room with Abundant Light',
      'Off-Street Parking Lot plus Main Street Parking',
      'Located in Historic Iuka Ravine District near OSU & Parks',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Microwave', 'Garbage Disposal', 'In-Unit Washer and Dryer'],
    description: `Welcome to 344 E 20th Ave — a beautifully renovated 2-bedroom, 1-bathroom residence offering 912 sq. ft. in the Historic Iuka Ravine District of Columbus, OH.

This newly updated home boasts a designer kitchen featuring granite countertops, brand new white cabinetry, dishwasher, microwave, and in-unit washer and dryer. Freshly painted rooms with hard flooring throughout are flooded with natural light from oversized windows. The bathroom offers double vanity sinks and dedicated linen storage. Centered in the OSU / University District, just a short walk to Iuka Ravine Park, cafes, dining, and central transit corridors.

Key Property Features:
• 2 Bedrooms, 1 Full Bathroom (912 sq. ft.)
• Granite countertops, dishwasher, microwave, and disposal
• In-unit washer and dryer included
• Dual vanity sinks and modern bathroom finishes
• Central air conditioning and heating
• Dedicated off-street parking
• Pet-friendly living (dogs and cats welcome)

Lease Details:
• Monthly Rent: $1,150
• Security Deposit: $1,150 (equal to 1 month's rent)
• Application Fee: $50 per adult applicant
• Lease Term: 12 months minimum

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  'PP-E95A2532': {
    title: '2BR/1BA Corner-Lot House w/ Full Basement – $1200/mo',
    address: '2942 Atwood Ter',
    city: 'Columbus',
    state: 'OH',
    zip: '43224',
    county: 'Franklin County',
    neighborhood: 'North Linden / Northern Lights',
    lat: 40.025576,
    lng: -82.984688,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1.0,
    total_bathrooms: 1,
    square_footage: 962,
    monthly_rent: 1200,
    security_deposit: 1200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    pet_deposit: 300,
    smoking_allowed: false,
    minimum_lease_months: 12,
    has_central_air: true,
    has_basement: true,
    parking: 'Private Driveway Parking',
    heating_type: 'Central Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Full Basement Washer/Dryer Hookups',
    flooring: ['Wood-Look Flooring', 'Tile'],
    amenities: [
      'Spacious Corner Lot with Large Private Yard',
      'Full Clean Basement with Laundry Hookups & Ample Storage',
      'Central Air Conditioning & Heating',
      'New Flooring & Fresh Neutral Paint Throughout',
      'Private Driveway Parking',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Washer/Dryer Hookups'],
    description: `Welcome to 2942 Atwood Ter — an attractive 2-bedroom, 1-bathroom single-family house situated on a generous corner lot in North Linden, Columbus, OH.

Offering 962 sq. ft. of living space, this home features brand new flooring, fresh paint, central air conditioning, and a full basement with washer and dryer hookups. The spacious corner lot provides plenty of lawn space and off-street driveway parking. Located near Cleveland Ave, Morse Rd, Northern Lights shopping, and quick access to I-71.

Key Property Features:
• 2 Bedrooms, 1 Full Bathroom (962 sq. ft.)
• Full basement for spacious storage and laundry
• Central air conditioning and heating
• Prominent corner lot with large yard
• Private off-street driveway parking
• Pet-friendly living (dogs and cats welcome)

Lease Details:
• Monthly Rent: $1,200
• Security Deposit: $1,200 (equal to 1 month's rent)
• Application Fee: $50 per adult applicant
• Lease Term: 12 months minimum

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  'PP-CF99760A': {
    title: '2BR/1BA Renovated Home w/ High-Efficiency HVAC – $1150/mo',
    address: '2045 Briarwood Ave',
    city: 'Columbus',
    state: 'OH',
    zip: '43211',
    county: 'Franklin County',
    neighborhood: 'South Linden / North Central',
    lat: 40.0166944,
    lng: -82.9731502,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1.0,
    total_bathrooms: 1,
    square_footage: 768,
    monthly_rent: 1150,
    security_deposit: 1150,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    pet_deposit: 300,
    smoking_allowed: false,
    minimum_lease_months: 12,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Driveway Parking',
    heating_type: 'New High-Efficiency Central Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Luxury Vinyl Plank', 'Modern Tile'],
    amenities: [
      'Complete Top-to-Bottom Modern Renovation',
      'Brand New High-Efficiency HVAC & Windows',
      'New Kitchen Cabinetry and Modern Bathroom',
      'New Energy-Efficient Water Heater',
      'Private Driveway Parking & Yard',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Refrigerator', 'Range / Oven', 'Water Heater', 'Washer/Dryer Hookups'],
    description: `Welcome to 2045 Briarwood Ave — a fully renovated 2-bedroom, 1-bathroom single-family residence offering 768 sq. ft. in Columbus, OH.

This home has been upgraded with a brand new kitchen, contemporary bathroom, new luxury vinyl flooring, new energy-efficient double-pane windows, and a high-efficiency HVAC system and hot water tank. Enjoy low utility costs, modern finishes, and private off-street driveway parking. Conveniently positioned near Hudson St, Cleveland Ave, I-71, and downtown Columbus.

Key Property Features:
• 2 Bedrooms, 1 Full Bathroom
• Fully renovated with new kitchen, bath, and flooring
• High-efficiency central air and heating system
• In-unit washer and dryer hookups
• Private driveway parking
• Pet-friendly living (dogs and cats welcome)

Lease Details:
• Monthly Rent: $1,150
• Security Deposit: $1,150 (equal to 1 month's rent)
• Application Fee: $50 per adult applicant
• Lease Term: 12 months minimum

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  'PP-55C079CE': {
    title: '2BR/1BA Single-Family Cottage in Columbus – $1100/mo',
    address: '2493 Audubon Rd',
    city: 'Columbus',
    state: 'OH',
    zip: '43211',
    county: 'Franklin County',
    neighborhood: 'North Linden',
    lat: 40.0159175,
    lng: -82.9910842,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1.0,
    total_bathrooms: 1,
    square_footage: 850,
    monthly_rent: 1100,
    security_deposit: 1100,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    pet_deposit: 300,
    smoking_allowed: false,
    minimum_lease_months: 12,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Driveway Parking',
    heating_type: 'Central Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Hardwood Flooring', 'Tile'],
    amenities: [
      'Cozy Single-Family Cottage with Private Yard',
      'Central Air Conditioning & Heating',
      'Solid Hardwood Floors Throughout Living Areas',
      'Private Driveway Parking',
      'Close to Parks, Schools, and Transit Routes',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Refrigerator', 'Stove / Range', 'Washer/Dryer Hookups'],
    description: `Welcome to 2493 Audubon Rd — a charming 2-bedroom, 1-bathroom single-family cottage offering 850 sq. ft. of comfortable living in Columbus, OH.

This home offers solid hardwood floors, a bright living room, an eat-in kitchen with full appliances, and two well-proportioned bedrooms sharing an updated bathroom. Enjoy a private backyard with mature trees and off-street driveway parking. Located in North Linden within easy reach of Weber Rd, McGuffey Park, I-71, and downtown Columbus.

Key Property Features:
• 2 Bedrooms, 1 Full Bathroom (850 sq. ft.)
• Classic hardwood floors throughout
• Central air conditioning and heating
• Private fenced backyard and driveway parking
• Pet-friendly living (dogs and cats welcome)

Lease Details:
• Monthly Rent: $1,100
• Security Deposit: $1,100 (equal to 1 month's rent)
• Application Fee: $50 per adult applicant
• Lease Term: 12 months minimum

Apply now through Choice Properties. Submit your application online for fast processing.`
  }
};

function sbPost(table, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const u = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
    const req = https.request(u, {
      method: 'POST',
      headers: {
        ...HEADERS,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 30000
    }, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(raw)); } catch(e) { resolve(raw); }
        } else {
          reject(new Error(`Supabase ${res.statusCode}: ${raw}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function sbPatch(table, query, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const u = new URL(`${SUPABASE_URL}/rest/v1/${table}?${query}`);
    const req = https.request(u, {
      method: 'PATCH',
      headers: {
        ...HEADERS,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 30000
    }, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(raw)); } catch(e) { resolve(raw); }
        } else {
          reject(new Error(`Supabase ${res.statusCode}: ${raw}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function publishPipelineBatch() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('  Choice Properties — Publishing Columbus Pipeline Batch (<= $1,300)');
  console.log('═════════════════════════════════════════════════════════════════\n');

  // Fetch current pipeline records
  const pipelineListRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pipeline_list`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ p_status: 'all', p_limit: 1000 })
  });
  const allPipeline = await pipelineListRes.json();

  const today = new Date().toISOString().split('T')[0];
  const publishedResults = [];

  for (const [pipeId, enriched] of Object.entries(COLUMBUS_ENRICHED)) {
    const p = allPipeline.find(item => item.id === pipeId);
    if (!p) {
      console.warn(`⚠️ Pipeline item ${pipeId} not found in database.`);
      continue;
    }

    console.log(`▶ Processing: ${pipeId} - ${enriched.address} ($${enriched.monthly_rent}/mo)`);

    // 1. Save cleaned fields to pipeline first via pipeline_save
    const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pipeline_save`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        p_id: pipeId,
        p_patch: {
          title: enriched.title,
          description: enriched.description,
          monthly_rent: enriched.monthly_rent,
          security_deposit: enriched.security_deposit,
          application_fee: enriched.application_fee,
          pets_allowed: enriched.pets_allowed,
          smoking_allowed: enriched.smoking_allowed,
          parking: enriched.parking,
          minimum_lease_months: enriched.minimum_lease_months,
          has_central_air: enriched.has_central_air,
          has_basement: enriched.has_basement,
          neighborhood: enriched.neighborhood,
          county: enriched.county
        }
      })
    });
    const saveData = await saveRes.json();
    console.log(`   ✓ Saved enriched patch to pipeline (ok: ${saveData.ok})`);

    // 2. Call pipeline_publish RPC
    const pubRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pipeline_publish`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ p_id: pipeId, p_landlord_id: LANDLORD_ID })
    });
    const pubData = await pubRes.json();
    if (!pubData.ok || !pubData.choice_property_id) {
      console.error(`   ❌ Failed pipeline_publish RPC:`, pubData);
      continue;
    }

    const choiceId = pubData.choice_property_id;
    console.log(`   ✓ Published via RPC to properties table ID: ${choiceId}`);

    // 3. Update public properties table with complete enriched schema fields
    await sbPatch('properties', `id=eq.${choiceId}`, {
      title: enriched.title,
      description: enriched.description,
      status: 'active',
      landlord_id: LANDLORD_ID,
      address: enriched.address,
      city: enriched.city,
      state: enriched.state,
      zip: enriched.zip,
      county: enriched.county,
      neighborhood: enriched.neighborhood,
      lat: enriched.lat,
      lng: enriched.lng,
      property_type: enriched.property_type,
      bedrooms: enriched.bedrooms,
      bathrooms: enriched.bathrooms,
      total_bathrooms: enriched.total_bathrooms,
      square_footage: enriched.square_footage,
      monthly_rent: enriched.monthly_rent,
      security_deposit: enriched.security_deposit,
      application_fee: enriched.application_fee,
      pet_deposit: enriched.pet_deposit,
      available_date: today,
      lease_terms: ['12 months'],
      minimum_lease_months: 12,
      pets_allowed: enriched.pets_allowed,
      pet_types_allowed: enriched.pet_types_allowed,
      smoking_allowed: false,
      amenities: enriched.amenities,
      appliances: enriched.appliances,
      flooring: enriched.flooring,
      heating_type: enriched.heating_type,
      cooling_type: enriched.cooling_type,
      laundry_type: enriched.laundry_type,
      parking: enriched.parking,
      has_central_air: enriched.has_central_air,
      has_basement: enriched.has_basement,
      listed_at: today,
      featured: false
    });
    console.log(`   ✓ Synchronized enriched metadata, amenities, and appliances`);

    // 4. Ensure photos are registered in property_photos
    let rawImages = [];
    try {
      rawImages = typeof p.original_image_urls === 'string' ? JSON.parse(p.original_image_urls) : p.original_image_urls;
    } catch(e) {
      rawImages = [];
    }

    if (rawImages && rawImages.length > 0) {
      // Check existing photos for property
      const existingPhotosRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos?property_id=eq.${choiceId}&select=id`, {
        headers: HEADERS
      });
      const existingPhotos = await existingPhotosRes.json();

      if (!existingPhotos || existingPhotos.length === 0) {
        const photoRows = rawImages.map((img, idx) => {
          const url = typeof img === 'string' ? img : img.url;
          const fileId = (typeof img === 'object' && img.fileId) ? img.fileId : null;
          const width = (typeof img === 'object' && img.width) ? img.width : null;
          const height = (typeof img === 'object' && img.height) ? img.height : null;
          return {
            property_id: choiceId,
            url: url,
            file_id: fileId,
            width: width,
            height: height,
            display_order: idx + 1,
            is_hero: idx === 0,
            watermark_status: 'clean',
            alt_text: `${enriched.address}, ${enriched.city} OH - Photo ${idx + 1}`
          };
        });

        await fetch(`${SUPABASE_URL}/rest/v1/property_photos`, {
          method: 'POST',
          headers: { ...HEADERS, 'Prefer': 'return=minimal' },
          body: JSON.stringify(photoRows)
        });
        console.log(`   ✓ Inserted ${photoRows.length} photos into property_photos`);
      } else {
        console.log(`   ✓ ${existingPhotos.length} photos already linked in property_photos`);
      }
    }

    const propRecord = { id: choiceId, ...enriched };
    const canonicalUrl = buildCanonicalUrl(propRecord);
    const directUrl = buildDirectUrl(propRecord);

    publishedResults.push({
      pipeId,
      choiceId,
      address: `${enriched.address}, ${enriched.city}, ${enriched.state} ${enriched.zip}`,
      neighborhood: enriched.neighborhood,
      bedrooms: enriched.bedrooms,
      bathrooms: enriched.bathrooms,
      sqft: enriched.square_footage,
      monthlyRent: enriched.monthly_rent,
      photosCount: rawImages ? rawImages.length : 0,
      canonicalUrl,
      directUrl
    });

    console.log(`   🔗 Direct URL: ${directUrl}\n`);
  }

  console.log('═════════════════════════════════════════════════════════════════');
  console.log(`  COLUMBUS, OH — PUBLISHED ${publishedResults.length} PROPERTIES`);
  console.log('═════════════════════════════════════════════════════════════════\n');

  publishedResults.forEach((r, idx) => {
    console.log(`${idx + 1}. ${r.address}`);
    console.log(`   Rent: $${r.monthlyRent}/mo | ${r.bedrooms} Bed / ${r.bathrooms} Bath | ${r.sqft} Sq. Ft.`);
    console.log(`   Neighborhood: ${r.neighborhood} | Photos: ${r.photosCount}`);
    console.log(`   Direct:    ${r.directUrl}`);
    console.log(`   Canonical: ${r.canonicalUrl}\n`);
  });

  return publishedResults;
}

publishPipelineBatch().catch(err => {
  console.error('Fatal error during publish:', err);
  process.exit(1);
});
