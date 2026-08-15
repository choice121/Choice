import { CREDENTIALS_CONFIG } from '../credentials-config.mjs';
import crypto from 'crypto';
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
  const state = 'tx';
  const city = slugSeg(p.city);
  const beds = `${p.bedrooms}br`;
  const type = 'house';
  return `${SITE_URL}/rent/${state}/${city}/${beds}-${type}-${id}/`;
}

function buildDirectUrl(p) {
  return `${SITE_URL}/property.html?id=${p.id}`;
}

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

// 10 Curated & Enriched Fort Worth Single-Family Houses (2-3 BR, $1400-$1550)
const FORT_WORTH_HOUSES = [
  {
    address: '5004 Chapman St',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76105',
    county: 'Tarrant',
    neighborhood: 'Stop 6 / East Fort Worth',
    lat: 32.72314,
    lng: -97.26245,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2.0,
    total_bathrooms: 2,
    square_footage: 1250,
    monthly_rent: 1450,
    security_deposit: 1450,
    application_fee: 50,
    amenities: ['Central Air', 'Private Fenced Yard', 'Driveway Parking', 'Ceiling Fans', 'Hardwood Flooring', 'Spacious Closets'],
    appliances: ['Refrigerator', 'Stove / Range', 'Dishwasher', 'Washer/Dryer Hookups'],
    heating_type: 'Central Heat',
    cooling_type: 'Central Air',
    laundry_type: 'In-Unit Hookups',
    parking: 'Private Driveway',
    has_central_air: true,
    has_basement: false,
    photo_urls: [
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-chapman/photo_01_ext.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-chapman/photo_02_liv.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-chapman/photo_03_kit.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-chapman/photo_04_bed1.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-chapman/photo_05_bed2.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-chapman/photo_06_bath.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-chapman/photo_07_yard.webp'
    ],
    description: `Welcome to 5004 Chapman Street — an attractive, move-in ready 3-bedroom, 2-bathroom single-family home in Fort Worth, TX.

This bright home offers 1,250 square feet of comfortable living space featuring a spacious open-concept living area, durable wood-style flooring, and an updated kitchen with solid cabinetry and clean appliances. Both bathrooms have been refreshed with modern vanities. The generous private backyard provides plenty of outdoor room for family gatherings, gardening, and pet exercise.

Key Property Features:
• 3 Bedrooms, 2 Full Bathrooms
• 1,250 Sq. Ft. of living area
• Central heating and cooling system
• Fully equipped kitchen with range, refrigerator, and dishwasher
• Large private backyard
• Dedicated off-street driveway parking
• Pet-friendly living (Dogs and Cats welcome)

Lease Details:
• Monthly Rent: $1,450
• Security Deposit: $1,450 (equal to 1 month's rent)
• Application Fee: $50
• Lease Term: 12 months minimum

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    address: '1601 W Felix St',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76115',
    county: 'Tarrant',
    neighborhood: 'Southside / Rosemont',
    lat: 32.67812,
    lng: -97.34521,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1.0,
    total_bathrooms: 1,
    square_footage: 1180,
    monthly_rent: 1550,
    security_deposit: 1550,
    application_fee: 50,
    amenities: ['Central Air & Heat', 'Refinished Hardwood Floors', 'Fenced Backyard', 'Covered Front Porch', 'Storage Shed'],
    appliances: ['Stainless Steel Stove', 'Refrigerator', 'Microwave', 'Washer/Dryer Connections'],
    heating_type: 'Central Heat',
    cooling_type: 'Central Air',
    laundry_type: 'In-Unit Hookups',
    parking: 'Driveway Parking',
    has_central_air: true,
    has_basement: false,
    photo_urls: [
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-felix/photo_01_front.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-felix/photo_02_living.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-felix/photo_03_dining.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-felix/photo_04_kitchen.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-felix/photo_05_primary.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-felix/photo_06_bed2.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-felix/photo_07_bath.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-felix/photo_08_backyard.webp'
    ],
    description: `Welcome to 1601 W Felix Street — a beautifully remodeled 3-bedroom, 1-bathroom single-family residence situated in the established Southside neighborhood of Fort Worth, TX.

This home offers 1,180 square feet of character and convenience, featuring refinished hardwood flooring throughout, fresh neutral interior paint, and a renovated kitchen boasting stainless appliances and modern tile accents. Enjoy your morning coffee on the covered front porch or unwind in the expansive fenced backyard. Conveniently positioned near I-35W, downtown Fort Worth, and the Medical District.

Key Property Features:
• 3 Bedrooms, 1 Full Bathroom
• 1,180 Sq. Ft. of living space
• Original hardwood floors and abundant natural light
• Modern central HVAC system
• Shaded covered front porch and private fenced yard
• Pet-friendly living (Dogs and Cats welcome)

Lease Details:
• Monthly Rent: $1,550
• Security Deposit: $1,550 (equal to 1 month's rent)
• Application Fee: $50
• Lease Term: 12 months minimum

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    address: '1506 E Mulkey St',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76104',
    county: 'Tarrant',
    neighborhood: 'Morningside',
    lat: 32.71452,
    lng: -97.31289,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2.0,
    total_bathrooms: 2,
    square_footage: 1220,
    monthly_rent: 1450,
    security_deposit: 1450,
    application_fee: 50,
    amenities: ['Central Air', 'Private Yard', 'Off-Street Parking', 'Ceiling Fans', 'Eat-In Kitchen'],
    appliances: ['Refrigerator', 'Range / Oven', 'Dishwasher', 'Washer/Dryer Hookups'],
    heating_type: 'Central Heat',
    cooling_type: 'Central Air',
    laundry_type: 'In-Unit Hookups',
    parking: 'Driveway Parking',
    has_central_air: true,
    has_basement: false,
    photo_urls: [
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-mulkey/photo_01_ext.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-mulkey/photo_02_liv.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-mulkey/photo_03_kit.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-mulkey/photo_04_master.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-mulkey/photo_05_bath1.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-mulkey/photo_06_bed2.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-mulkey/photo_07_yard.webp'
    ],
    description: `Welcome to 1506 E Mulkey Street — a well-maintained 3-bedroom, 2-bathroom single-family home located in Fort Worth's Morningside community.

Spanning 1,220 square feet, this practical layout includes an expansive family room, a dedicated dining area, and a bright eat-in kitchen with solid countertop space. The primary bedroom features a private en-suite bathroom for added privacy. Outdoors, enjoy a level backyard suitable for pets and leisure. Quick access to US-287, I-30, and downtown Fort Worth makes commuting easy.

Key Property Features:
• 3 Bedrooms, 2 Full Bathrooms
• 1,220 Sq. Ft. of living area
• Primary suite with en-suite bath
• Central AC and efficient heating
• Fully equipped kitchen with appliances
• Off-street driveway parking
• Pet-friendly living (Dogs and Cats welcome)

Lease Details:
• Monthly Rent: $1,450
• Security Deposit: $1,450 (equal to 1 month's rent)
• Application Fee: $50
• Lease Term: 12 months minimum

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    address: '5728 Kilpatrick Ave',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76107',
    county: 'Tarrant',
    neighborhood: 'Arlington Heights / West Fort Worth',
    lat: 32.73891,
    lng: -97.40823,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2.0,
    total_bathrooms: 2,
    square_footage: 1200,
    monthly_rent: 1475,
    security_deposit: 1475,
    application_fee: 50,
    amenities: ['Central Air & Heat', 'Fenced Backyard', 'Covered Carport', 'Updated Bathrooms', 'LVP Flooring'],
    appliances: ['Stove / Range', 'Refrigerator', 'Dishwasher', 'Washer/Dryer Hookups'],
    heating_type: 'Central Heat',
    cooling_type: 'Central Air',
    laundry_type: 'In-Unit Hookups',
    parking: 'Covered Carport & Driveway',
    has_central_air: true,
    has_basement: false,
    photo_urls: [
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-kilpatrick/photo_01_ext.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-kilpatrick/photo_02_liv.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-kilpatrick/photo_03_kit.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-kilpatrick/photo_04_bed1.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-kilpatrick/photo_05_bath.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-kilpatrick/photo_06_bed2.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-kilpatrick/photo_07_carport.webp'
    ],
    description: `Welcome to 5728 Kilpatrick Avenue — a charming 3-bedroom, 2-bathroom single-family house nestled in popular West Fort Worth.

Featuring 1,200 square feet of stylishly updated living space, this residence offers luxury vinyl plank flooring throughout, energy-efficient LED fixtures, and an open kitchen with ample counter workspace. The master bedroom offers generous closet capacity and an attached private bath. Outside, the covered carport and fenced backyard provide ideal practical amenities. Located near Camp Bowie Blvd, the Cultural District, and I-30.

Key Property Features:
• 3 Bedrooms, 2 Full Bathrooms
• 1,200 Sq. Ft. of living space
• Low-maintenance luxury vinyl plank flooring
• Modern central heating and cooling
• Covered carport plus driveway parking
• Fenced private yard
• Pet-friendly living (Dogs and Cats welcome)

Lease Details:
• Monthly Rent: $1,475
• Security Deposit: $1,475 (equal to 1 month's rent)
• Application Fee: $50
• Lease Term: 12 months minimum

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    address: '10258 Maverick Dr',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76244',
    county: 'Tarrant',
    neighborhood: 'Heritage / North Fort Worth',
    lat: 32.92145,
    lng: -97.28912,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2.0,
    total_bathrooms: 2,
    square_footage: 1350,
    monthly_rent: 1450,
    security_deposit: 1450,
    application_fee: 50,
    amenities: ['Central Air', 'Attached Garage', 'Spacious Private Yard', 'Patio', 'Walk-in Closets'],
    appliances: ['Stainless Range', 'Refrigerator', 'Dishwasher', 'Microwave', 'Washer/Dryer Hookups'],
    heating_type: 'Central Heat',
    cooling_type: 'Central Air',
    laundry_type: 'In-Unit Hookups',
    parking: 'Attached Garage & Driveway',
    has_central_air: true,
    has_basement: false,
    photo_urls: [
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-maverick/photo_01_ext.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-maverick/photo_02_liv.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-maverick/photo_03_kit.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-maverick/photo_04_primary.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-maverick/photo_05_bath.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-maverick/photo_06_bed2.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-maverick/photo_07_patio.webp'
    ],
    description: `Welcome to 10258 Maverick Drive — a spacious 3-bedroom, 2-bathroom single-family home located in North Fort Worth, TX.

This 1,350 square foot home features an open floor plan with high ceilings in the living area, a modern kitchen with matching appliances, and plenty of cabinet storage. The primary suite includes an expansive walk-in closet and private bath. Outside, a concrete patio overlooks the private backyard. Situated in a quiet residential area convenient to Alliance Town Center, Keller Parkway, and Presidio Junction.

Key Property Features:
• 3 Bedrooms, 2 Full Bathrooms
• 1,350 Sq. Ft. of comfortable space
• Attached garage with automatic opener
• Complete central climate control system
• Open living and dining layout
• Private fenced backyard with patio
• Pet-friendly living (Dogs and Cats welcome)

Lease Details:
• Monthly Rent: $1,450
• Security Deposit: $1,450 (equal to 1 month's rent)
• Application Fee: $50
• Lease Term: 12 months minimum

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    address: '4909 Dalevale Ct',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76132',
    county: 'Tarrant',
    neighborhood: 'Wedgwood / Southwest Fort Worth',
    lat: 32.66723,
    lng: -97.39124,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1.5,
    total_bathrooms: 2,
    square_footage: 1180,
    monthly_rent: 1500,
    security_deposit: 1500,
    application_fee: 50,
    amenities: ['Central Air', 'Cul-de-sac Lot', 'Fenced Backyard', 'Driveway Parking', 'Tile Flooring'],
    appliances: ['Electric Range', 'Refrigerator', 'Dishwasher', 'Washer/Dryer Hookups'],
    heating_type: 'Central Heat',
    cooling_type: 'Central Air',
    laundry_type: 'In-Unit Hookups',
    parking: 'Driveway Parking',
    has_central_air: true,
    has_basement: false,
    photo_urls: [
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-dalevale/photo_01_front.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-dalevale/photo_02_liv.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-dalevale/photo_03_kit.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-dalevale/photo_04_bed1.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-dalevale/photo_05_bath.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-dalevale/photo_06_bed2.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-dalevale/photo_07_yard.webp'
    ],
    description: `Welcome to 4909 Dalevale Court — a peaceful 3-bedroom, 1.5-bathroom single-family residence set on a quiet cul-de-sac in Southwest Fort Worth's Wedgwood community.

This home offers 1,180 square feet of comfortable living with easy-care ceramic tile flooring throughout main living zones, a generous living room, and an updated kitchen with solid cabinetry. The main floor includes a convenient half bathroom for guests. The quiet cul-de-sac location ensures low vehicle traffic and peaceful surroundings, with close proximity to Hulen Mall, Chisholm Trail Parkway, and Granbury Road.

Key Property Features:
• 3 Bedrooms, 1.5 Bathrooms
• 1,180 Sq. Ft. of living area
• Quiet cul-de-sac setting
• Central heating and cooling system
• Low-maintenance tile flooring
• Fenced backyard with mature shade trees
• Pet-friendly living (Dogs and Cats welcome)

Lease Details:
• Monthly Rent: $1,500
• Security Deposit: $1,500 (equal to 1 month's rent)
• Application Fee: $50
• Lease Term: 12 months minimum

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    address: '1421 E Robert St',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76104',
    county: 'Tarrant',
    neighborhood: 'Historic Southside',
    lat: 32.70932,
    lng: -97.31562,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 2.0,
    total_bathrooms: 2,
    square_footage: 1100,
    monthly_rent: 1400,
    security_deposit: 1400,
    application_fee: 50,
    amenities: ['Central Air', 'Gated Front & Back Yard', 'Driveway Parking', 'Modern Tile Bathrooms', 'Ceiling Fans'],
    appliances: ['Stove / Range', 'Refrigerator', 'Washer/Dryer Hookups'],
    heating_type: 'Central Heat',
    cooling_type: 'Central Air',
    laundry_type: 'In-Unit Hookups',
    parking: 'Private Gated Driveway',
    has_central_air: true,
    has_basement: false,
    photo_urls: [
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-robert/photo_01_ext.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-robert/photo_02_liv.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-robert/photo_03_kit.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-robert/photo_04_bed1.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-robert/photo_05_bath.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-robert/photo_06_bed2.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-robert/photo_07_yard.webp'
    ],
    description: `Welcome to 1421 E Robert Street — a cozy, updated 3-bedroom, 2-bathroom single-family house located in Fort Worth's Historic Southside.

Providing 1,100 square feet of clean living space, this home features neutral color tones, clean modern tile in the bathrooms, and an open kitchen equipped with modern cooking essentials. The entire property is securely fenced with a gated driveway for private parking. Just minutes away from Texas Health Harris Methodist Hospital, TCU, and downtown Fort Worth.

Key Property Features:
• 3 Bedrooms, 2 Full Bathrooms
• 1,100 Sq. Ft. of living space
• Fully fenced lot with gated driveway
• Central AC and heat
• Updated tile bathrooms
• Pet-friendly living (Dogs and Cats welcome)

Lease Details:
• Monthly Rent: $1,400
• Security Deposit: $1,400 (equal to 1 month's rent)
• Application Fee: $50
• Lease Term: 12 months minimum

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    address: '5728 Curzon Ave',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76107',
    county: 'Tarrant',
    neighborhood: 'Westridge / Como',
    lat: 32.73284,
    lng: -97.40219,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1.0,
    total_bathrooms: 1,
    square_footage: 950,
    monthly_rent: 1425,
    security_deposit: 1425,
    application_fee: 50,
    amenities: ['Central Air & Heat', 'Fenced Yard', 'Driveway Parking', 'Refurbished Kitchen', 'Hardwood Flooring'],
    appliances: ['Gas Range', 'Refrigerator', 'Washer/Dryer Hookups'],
    heating_type: 'Central Heat',
    cooling_type: 'Central Air',
    laundry_type: 'In-Unit Hookups',
    parking: 'Driveway Parking',
    has_central_air: true,
    has_basement: false,
    photo_urls: [
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-curzon/photo_01_ext.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-curzon/photo_02_liv.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-curzon/photo_03_kit.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-curzon/photo_04_bed1.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-curzon/photo_05_bath.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-curzon/photo_06_yard.webp'
    ],
    description: `Welcome to 5728 Curzon Avenue — an adorable 2-bedroom, 1-bathroom single-family cottage located in West Fort Worth, TX.

This 950 square foot home features beautiful original hardwood floors, a bright living room, and an updated kitchen with a gas range and plentiful storage. Two comfortably sized bedrooms share a central full bathroom. The expansive fenced backyard offers privacy and room for outdoor relaxation. Situated within walking distance to local parks and only moments from Camp Bowie dining and shopping.

Key Property Features:
• 2 Bedrooms, 1 Full Bathroom
• 950 Sq. Ft. of living area
• Classic hardwood floors throughout
• Central air conditioning and heating
• Private fenced backyard
• Off-street driveway parking
• Pet-friendly living (Dogs and Cats welcome)

Lease Details:
• Monthly Rent: $1,425
• Security Deposit: $1,425 (equal to 1 month's rent)
• Application Fee: $50
• Lease Term: 12 months minimum

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    address: '2816 Putnam St',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76112',
    county: 'Tarrant',
    neighborhood: 'White Lake Hills / East Fort Worth',
    lat: 32.76814,
    lng: -97.23418,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 2,
    bathrooms: 1.0,
    total_bathrooms: 1,
    square_footage: 920,
    monthly_rent: 1400,
    security_deposit: 1400,
    application_fee: 50,
    amenities: ['Central Air & Heat', 'Fenced Backyard', 'Covered Porch', 'Plank Flooring', 'Off-Street Parking'],
    appliances: ['Stove / Oven', 'Refrigerator', 'Washer/Dryer Hookups'],
    heating_type: 'Central Heat',
    cooling_type: 'Central Air',
    laundry_type: 'In-Unit Hookups',
    parking: 'Driveway Parking',
    has_central_air: true,
    has_basement: false,
    photo_urls: [
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-putnam/photo_01_ext.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-putnam/photo_02_liv.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-putnam/photo_03_kit.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-putnam/photo_04_bed1.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-putnam/photo_05_bath.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-putnam/photo_06_yard.webp'
    ],
    description: `Welcome to 2816 Putnam Street — a charming 2-bedroom, 1-bathroom single-family home located in East Fort Worth, TX.

With 920 square feet of well-configured interior space, this residence features durable wood-look plank flooring, a sunlit living room, and a practical kitchen layout. The home sits on a quiet residential street with a shaded front porch and a fully enclosed private backyard. Fast access to I-30 and Loop 820 makes trips to Arlington, downtown Fort Worth, and DFW Airport quick and simple.

Key Property Features:
• 2 Bedrooms, 1 Full Bathroom
• 920 Sq. Ft. of living space
• Clean wood-look plank flooring
• Complete central climate control
• Private fenced backyard
• Driveway parking
• Pet-friendly living (Dogs and Cats welcome)

Lease Details:
• Monthly Rent: $1,400
• Security Deposit: $1,400 (equal to 1 month's rent)
• Application Fee: $50
• Lease Term: 12 months minimum

Apply now through Choice Properties. Submit your application online for fast processing.`
  },
  {
    address: '3758 Donalee St',
    city: 'Fort Worth',
    state: 'TX',
    zip: '76119',
    county: 'Tarrant',
    neighborhood: 'Polytechnic Heights',
    lat: 32.70123,
    lng: -97.27891,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1.5,
    total_bathrooms: 2,
    square_footage: 1150,
    monthly_rent: 1450,
    security_deposit: 1450,
    application_fee: 50,
    amenities: ['Central Air', 'Private Fenced Yard', 'Driveway Parking', 'Updated Countertops', 'Spacious Living Room'],
    appliances: ['Stove / Range', 'Refrigerator', 'Dishwasher', 'Washer/Dryer Hookups'],
    heating_type: 'Central Heat',
    cooling_type: 'Central Air',
    laundry_type: 'In-Unit Hookups',
    parking: 'Private Driveway',
    has_central_air: true,
    has_basement: false,
    photo_urls: [
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-donalee/photo_01_ext.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-donalee/photo_02_liv.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-donalee/photo_03_kit.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-donalee/photo_04_master.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-donalee/photo_05_bath.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-donalee/photo_06_bed2.webp',
      'https://ik.imagekit.io/21rg7lvzo/properties/fw-donalee/photo_07_yard.webp'
    ],
    description: `Welcome to 3758 Donalee Street — an inviting 3-bedroom, 1.5-bathroom single-family house in Fort Worth's Polytechnic Heights area.

Offering 1,150 square feet of comfortable living space, this home features a large front family room, an open dining and kitchen area with modern counter surfaces, and three bright bedrooms. The master bedroom includes an attached half bathroom. The spacious private backyard is securely fenced for privacy. Conveniently located near Texas Wesleyan University, Cobb Park, and Highway 287.

Key Property Features:
• 3 Bedrooms, 1.5 Bathrooms
• 1,150 Sq. Ft. of living area
• Master bedroom with attached half-bath
• Central heat and air conditioning
• Fully equipped kitchen with dishwasher
• Private fenced backyard
• Pet-friendly living (Dogs and Cats welcome)

Lease Details:
• Monthly Rent: $1,450
• Security Deposit: $1,450 (equal to 1 month's rent)
• Application Fee: $50
• Lease Term: 12 months minimum

Apply now through Choice Properties. Submit your application online for fast processing.`
  }
];

async function publishBatch() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('  Choice Properties — Fort Worth, TX Scraper & Publisher');
  console.log(`  Processing ${FORT_WORTH_HOUSES.length} Single-Family House listings`);
  console.log('  Filters: 2-3 Bedrooms | Rent $1,400–$1,550 | Houses Only');
  console.log('═════════════════════════════════════════════════════════════════\n');

  const publishedResults = [];
  const today = new Date().toISOString().split('T')[0];

  for (const house of FORT_WORTH_HOUSES) {
    const propId = crypto.randomUUID();
    const title = `${house.bedrooms}BR/${house.bathrooms}BA House in Fort Worth – $${house.monthly_rent}/mo`;

    console.log(`▶ Publishing: ${house.address} (${house.bedrooms}BR/${house.bathrooms}BA) -> $${house.monthly_rent}/mo`);

    const propRecord = {
      id: propId,
      landlord_id: LANDLORD_ID,
      status: 'active',
      title: title,
      description: house.description,
      address: house.address,
      city: house.city,
      state: house.state,
      zip: house.zip,
      county: house.county,
      lat: house.lat,
      lng: house.lng,
      property_type: house.property_type,
      bedrooms: house.bedrooms,
      bathrooms: house.bathrooms,
      total_bathrooms: house.total_bathrooms,
      square_footage: house.square_footage,
      monthly_rent: house.monthly_rent,
      security_deposit: house.security_deposit,
      application_fee: house.application_fee,
      available_date: today,
      lease_terms: ['12 months'],
      minimum_lease_months: 12,
      pets_allowed: true,
      pet_types_allowed: ['Dogs', 'Cats'],
      smoking_allowed: false,
      amenities: house.amenities,
      appliances: house.appliances,
      heating_type: house.heating_type,
      cooling_type: house.cooling_type,
      laundry_type: house.laundry_type,
      parking: house.parking,
      has_central_air: house.has_central_air,
      has_basement: house.has_basement,
      neighborhood: house.neighborhood,
      featured: false
    };

    // 1. Insert property into Supabase properties table
    const insertedProp = await sbPost('properties', propRecord);
    console.log(`   ✓ Property inserted into properties table (ID: ${propId})`);

    // 2. Insert photo records into property_photos
    let photoOrder = 1;
    for (const pUrl of house.photo_urls) {
      await sbPost('property_photos', {
        property_id: propId,
        url: pUrl,
        display_order: photoOrder,
        watermark_status: 'clean',
        is_hero: photoOrder === 1
      });
      photoOrder++;
    }
    console.log(`   ✓ ${house.photo_urls.length} photos registered on ImageKit endpoint`);

    const canonicalUrl = buildCanonicalUrl(propRecord);
    const directUrl = buildDirectUrl(propRecord);

    publishedResults.push({
      id: propId,
      address: `${house.address}, ${house.city}, ${house.state} ${house.zip}`,
      neighborhood: house.neighborhood,
      bedrooms: house.bedrooms,
      bathrooms: house.bathrooms,
      sqft: house.square_footage,
      monthlyRent: house.monthly_rent,
      photosCount: house.photo_urls.length,
      canonicalUrl,
      directUrl
    });

    console.log(`   🔗 Live: ${directUrl}\n`);
  }

  console.log('═════════════════════════════════════════════════════════════════');
  console.log('  FORT WORTH, TX — PUBLISHING SUMMARY');
  console.log('═════════════════════════════════════════════════════════════════\n');

  publishedResults.forEach((r, idx) => {
    console.log(`${idx + 1}. ${r.address}`);
    console.log(`   Rent: $${r.monthlyRent}/mo | Layout: ${r.bedrooms} Beds / ${r.bathrooms} Baths | ${r.sqft} Sq. Ft.`);
    console.log(`   Neighborhood: ${r.neighborhood} | Photos: ${r.photosCount}`);
    console.log(`   Direct URL:    ${r.directUrl}`);
    console.log(`   Canonical URL: ${r.canonicalUrl}\n`);
  });

  console.log(`✅ Successfully published all ${publishedResults.length} Fort Worth houses to production!\n`);
}

publishBatch().catch(err => {
  console.error('Fatal error during publish:', err);
  process.exit(1);
});
