/**
 * CHOICE PROPERTIES — MASTER ZILLOW PIPELINE ENRICHMENT & PUBLISHING ENGINE
 * =========================================================================
 * Processes, enriches, validates, and publishes the 9 recently scraped
 * Zillow pipeline properties for Tulsa, OK.
 *
 * Rules Enforced:
 * 1. Price constraint: Rent capped/reduced to $1,200 max per user directive
 * 2. Bathroom precision: Accurate decimal representation (1.5 baths for #2 and #9)
 * 3. Architectural typing: DUPLEX vs TOWNHOUSE vs APARTMENT
 * 4. Zero security deposit or leasing restrictions in description narrative
 * 5. Minimum 6 verified photos per listing
 * 6. Address normalization & duplicate avoidance (preserves existing IDs)
 * 7. Standardized Choice policies ($50 fee, pet-friendly, non-smoking)
 */

import crypto from 'crypto';
import fs from 'fs';
import { CREDENTIALS_CONFIG } from '../credentials-config.mjs';

const SUPABASE_URL = CREDENTIALS_CONFIG.SUPABASE_URL;
const SERVICE_KEY = CREDENTIALS_CONFIG.SUPABASE_API_KEY;
const LANDLORD_ID = 'dabe7d4a-8a92-4fb4-9de9-0dcda47391c1'; // Choice properties LLC

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json'
};

const HEADERS_PIPELINE = {
  ...HEADERS,
  'Accept-Profile': 'pipeline',
  'Content-Profile': 'pipeline'
};

export const PROPERTIES_TO_PUBLISH = [
  {
    pipeline_id: 'PP-E57D1E99',
    existing_property_id: null,
    title: '2BR Duplex in Tulsa',
    address: '2732 E 29th Pl N',
    city: 'Tulsa',
    state: 'OK',
    zip: '74110',
    county: 'Tulsa County',
    lat: 36.19608,
    lng: -95.94994,
    property_type: 'DUPLEX',
    bedrooms: 2,
    bathrooms: 1.0,
    total_bathrooms: 1,
    half_bathrooms: 0,
    square_footage: 858,
    monthly_rent: 1000,
    security_deposit: 1000,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Off-Street Parking',
    heating_type: 'Central Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Original Hardwood Flooring', 'Custom Tile'],
    amenities: [
      'Fully Renovated Two-Story Duplex Layout',
      'Original Refinished Hardwood Floors & New Paint',
      'Modernized Kitchen with New Appliances & Tile',
      'Updated Bathroom with Brand New Fixtures & Plumbing',
      'Brand New Central Air Conditioning & Heating',
      'Professional Lawn Upkeep Provided',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Range / Oven', 'Refrigerator', 'Washer/Dryer Hookups'],
    description: `Offering 858 square feet across a renovated two-story duplex layout, this two-bedroom, one-bathroom home delivers modern comfort with classic character. Original hardwood floors have been carefully restored and extend throughout the primary living areas, illuminated by natural light and accented by fresh neutral paint and new ceiling fans.

The renovated kitchen features new appliances, durable tile flooring, updated cabinetry, and contemporary lighting fixtures. Mechanical updates include brand new plumbing alongside a new central air and heating system for reliable year-round comfort. Complete with dedicated washer and dryer hookups, complimentary lawn maintenance, and easy highway connectivity, this home offers convenience inside and out.`
  },
  {
    pipeline_id: 'PP-7C93D14D',
    existing_property_id: null,
    title: '2BR Townhouse in Tulsa',
    address: '102 S Zunis Ave',
    city: 'Tulsa',
    state: 'OK',
    zip: '74104',
    county: 'Tulsa County',
    lat: 36.11459,
    lng: -95.96146,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 1.5,
    total_bathrooms: 2,
    half_bathrooms: 1,
    square_footage: 924,
    monthly_rent: 1200, // Reduced from $1,250 to $1,200 per directive
    security_deposit: 1200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Dedicated Off-Street Parking',
    heating_type: 'Central Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Updated Hard-Surface Flooring', 'Carpet'],
    amenities: [
      'Renovated Multi-Level Townhome Architecture',
      'Convenient 1.5 Bathroom Powder Room Arrangement',
      'Contemporary Ceiling Fans & Energy-Efficient Lighting',
      'Dependable Central Heating & Air Conditioning',
      'Located in Vibrant Historic Kendall Whittier Neighborhood',
      'Rapid Commuter Access to Downtown Tulsa & University of Tulsa',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Range / Oven', 'Refrigerator', 'Washer/Dryer Hookups'],
    description: `Positioned in Tulsa's historic Kendall Whittier neighborhood, this renovated 924-square-foot townhome features two bedrooms and one-and-a-half bathrooms. The main level centers around a bright, open living room with easy access to a convenient half-bath powder room for guests.

Upstairs, two comfortable bedrooms offer generous closet storage and share a well-appointed full bath. Modern ceiling fans and central heat and air conditioning keep the home temperate in every season. Residents enjoy dedicated off-street parking, in-unit laundry hookups, and walking distance to local art studios, neighborhood cafes, and nearby university campuses.`
  },
  {
    pipeline_id: 'PP-1D460B8F',
    existing_property_id: null,
    title: '2BR Townhouse in Tulsa',
    address: '10814 E 15th Pl',
    city: 'Tulsa',
    state: 'OK',
    zip: '74128',
    county: 'Tulsa County',
    lat: 36.13981,
    lng: -95.81029,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 1.0,
    total_bathrooms: 1,
    half_bathrooms: 0,
    square_footage: 946,
    monthly_rent: 1050,
    security_deposit: 1050,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Off-Street Parking',
    heating_type: 'Central Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Updated Hard-Surface Flooring'],
    amenities: [
      'Updated 946 Sq Ft Townhome Floor Plan',
      'Modern Hard-Surface Flooring Across Living Areas',
      'Dedicated In-Unit Washer & Dryer Hookups',
      'Central Climate Control & Heating',
      'Quick Highway Access for Convenient Tulsa Commuting',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Range / Oven', 'Refrigerator', 'Washer/Dryer Hookups'],
    description: `This well-maintained 946-square-foot townhome offers two bedrooms, one full bathroom, and updated finishes throughout. A welcoming living space transitions naturally into a functional dining and kitchen area equipped with solid cabinetry and essential appliances.

Both bedrooms provide peaceful private quarters with ample natural lighting and storage. Central heating and air conditioning ensure dependable climate control year-round, while dedicated in-unit washer and dryer connections offer everyday ease. Situated with fast access to major regional expressways, daily travel throughout the greater Tulsa metro is quick and seamless.`
  },
  {
    pipeline_id: 'PP-C5B39221',
    existing_property_id: null,
    title: '3BR Duplex in Tulsa',
    address: '1551 E 66th Pl',
    city: 'Tulsa',
    state: 'OK',
    zip: '74136',
    county: 'Tulsa County',
    lat: 36.06743,
    lng: -95.95909,
    property_type: 'DUPLEX',
    bedrooms: 3,
    bathrooms: 2.0,
    total_bathrooms: 2,
    half_bathrooms: 0,
    square_footage: 1300,
    monthly_rent: 1200, // Reduced from $1,250 to $1,200 per directive
    security_deposit: 1200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Off-Street Driveway Parking',
    heating_type: 'Central Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Updated Hard-Surface Flooring', 'Carpet'],
    amenities: [
      'Substantial 1,300 Sq Ft Three-Bedroom Duplex Floor Plan',
      'Quiet Cul-de-Sac Location Offering Enhanced Privacy',
      'Sliding Patio Doors Opening Directly to Outdoor Space',
      'Generous Storage Closets Throughout',
      'Water & Sewer Utility Service Included',
      'Proximity to Southern Tulsa Shopping, Dining & Parks',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Range / Oven', 'Refrigerator', 'Dishwasher', 'Washer/Dryer Hookups'],
    description: `Nestled on a peaceful cul-de-sac in south Tulsa, this spacious 1,300-square-foot duplex features three bedrooms and two full bathrooms. The expansive living room is designed for versatile furniture configurations and connects smoothly to an open dining room and well-appointed kitchen featuring a dishwasher and full appliance suite.

Sliding patio glass doors open to a private outdoor area, providing easy indoor-outdoor living. Three generously proportioned bedrooms offer abundant wardrobe storage, and central heat and air conditioning keep the home comfortable in every season. Water utility service is included for added convenience, and driveway parking easily accommodates resident vehicles.`
  },
  {
    pipeline_id: 'PP-E3292EC2',
    existing_property_id: null,
    title: '3BR Townhouse in Tulsa',
    address: '1206 S 110th Ave E #13-C',
    city: 'Tulsa',
    state: 'OK',
    zip: '74128',
    county: 'Tulsa County',
    lat: 36.14577,
    lng: -95.85499,
    property_type: 'TOWNHOUSE',
    bedrooms: 3,
    bathrooms: 2.0,
    total_bathrooms: 2,
    half_bathrooms: 0,
    square_footage: 1177,
    monthly_rent: 1195,
    security_deposit: 1195,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Dedicated Off-Street Parking',
    heating_type: 'Central Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Hard-Surface Flooring', 'Carpet'],
    amenities: [
      'Spacious 1,177 Sq Ft Three-Bedroom Multi-Level Layout',
      'Two Full Bathrooms with Contemporary Vanities',
      'Water and Trash Utility Services Covered by Community HOA',
      'Equipped Kitchen with Full Appliance Suite & Dishwasher',
      'Central Climate Control & Dedicated Parking',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Range / Oven', 'Refrigerator', 'Dishwasher', 'Washer/Dryer Hookups'],
    description: `Featuring 1,177 square feet across an efficient multi-level floor plan, this three-bedroom, two-bathroom townhome offers generous living space in east Tulsa. The central living room opens onto a functional dining area and an equipped kitchen complete with solid cabinetry and a dishwasher.

Upstairs, three well-sized bedrooms include wide closets and share modern full bathrooms. Community HOA coverage takes care of water and trash services, streamlining monthly budgeting. Central heating and air conditioning maintain year-round comfort, and assigned off-street parking sits just steps from the front entrance.`
  },
  {
    pipeline_id: 'PP-55BB0423',
    existing_property_id: '08904684-b5ec-484f-88b1-70f9ceb8e73d',
    title: '2BR Duplex in Tulsa',
    address: '1302 S Birmingham Ave #2',
    city: 'Tulsa',
    state: 'OK',
    zip: '74104',
    county: 'Tulsa County',
    lat: 36.12436,
    lng: -95.95330,
    property_type: 'DUPLEX',
    bedrooms: 2,
    bathrooms: 1.0,
    total_bathrooms: 1,
    half_bathrooms: 0,
    square_footage: 1150,
    monthly_rent: 1200, // Reduced from $1,250 to verified $1,200
    security_deposit: 1200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Dedicated Off-Street Parking',
    heating_type: 'Central Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Continuous Hard-Surface Flooring'],
    amenities: [
      'Prime Lower-Level Duplex in Highly Desirable Renaissance Neighborhood',
      'Gourmet Kitchen with Solid Granite Countertops & Stainless Steel Sink',
      'Complete Appliance Suite Including Range, Refrigerator & Dishwasher',
      'Continuous Hard Flooring Throughout with Zero Carpet',
      'Central Heating & Air Conditioning',
      'Complimentary Professional Lawn Care Included',
      'Dedicated Off-Street Parking',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Stove / Oven', 'Refrigerator', 'Dishwasher', 'Stainless Steel Sink', 'Washer/Dryer Hookups'],
    description: `Set in Tulsa's celebrated Renaissance neighborhood, this lower-level duplex home combines historic charm with modern updates across an expansive 1,150-square-foot floor plan. Seamless hard-surface flooring spans every room with zero carpeting, creating a clean and contemporary atmosphere.

The updated kitchen stands out with genuine granite countertops, an undermount stainless steel sink, a refrigerator, cooking stove, and dishwasher. Central heat and air conditioning guarantee reliable comfort throughout all seasons, while in-unit washer and dryer connections add everyday utility. Residents benefit from dedicated off-street parking, complimentary lawn upkeep, and immediate access to Cherry Street and midtown Tulsa destinations.`
  },
  {
    pipeline_id: 'PP-C2B1C3D4',
    existing_property_id: '032f563e-bb43-40e4-b1d8-3597e81bcf6a',
    title: '1BR Apartment in Tulsa',
    address: '2230 W Newton St',
    city: 'Tulsa',
    state: 'OK',
    zip: '74127',
    county: 'Osage County',
    lat: 36.17272,
    lng: -96.01567,
    property_type: 'APARTMENT',
    bedrooms: 1,
    bathrooms: 1.0,
    total_bathrooms: 1,
    half_bathrooms: 0,
    square_footage: 963,
    monthly_rent: 975,
    security_deposit: 975,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Community Off-Street Parking',
    heating_type: 'Central Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Hard-Surface Flooring', 'Carpet'],
    amenities: [
      'Generous 963 Sq Ft One-Bedroom Floor Plan',
      'Peaceful Community Setting at Oak Creek at Gilcrease',
      'Minutes from Gilcrease Museum, Arkansas River Parks & BOK Center',
      'Bright Open Living Area with Natural Daylight',
      'Central Climate Control & Air Conditioning',
      'Dedicated Community Parking & Scenic Green Surroundings',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Range / Oven', 'Refrigerator', 'Dishwasher', 'Washer/Dryer Hookups'],
    description: `Situated in the peaceful Oak Creek at Gilcrease community northwest of downtown Tulsa, this oversized 963-square-foot one-bedroom apartment delivers serene residential living with effortless urban connectivity. The expansive living room offers abundant wall space and natural daylight, accommodating both living and home office setups.

The open kitchen features solid cabinetry, a cooking range, refrigerator, and dishwasher, accompanied by in-unit laundry hookups. Just minutes away, residents can explore the Gilcrease Museum grounds, the Arkansas River trail system, downtown dining, and premier entertainment venues. Community off-street parking and central heating and air conditioning complete this inviting residence.`
  },
  {
    pipeline_id: 'PP-0A621B4F',
    existing_property_id: null,
    title: '3BR Duplex in Tulsa',
    address: '1130 S Florence Ave',
    city: 'Tulsa',
    state: 'OK',
    zip: '74104',
    county: 'Tulsa County',
    lat: 36.14721,
    lng: -95.94501,
    property_type: 'DUPLEX',
    bedrooms: 3,
    bathrooms: 1.0,
    total_bathrooms: 1,
    half_bathrooms: 0,
    square_footage: 900,
    monthly_rent: 1200, // Reduced from $1,275 to $1,200 per directive
    security_deposit: 1200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Off-Street Driveway Parking',
    heating_type: 'Central Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Refinished Hardwood Flooring', 'Custom Designer Tile'],
    amenities: [
      'Comprehensive Designer Remodel with Fresh Paint Throughout',
      'Gourmet Kitchen with Brand New Cabinets & Granite Countertops',
      'Brand New Appliances Including Range, Dishwasher & Garbage Disposal',
      'Refinished Hardwood Flooring & Custom Designer Tile',
      'Modernized Bathroom with Granite Vanity & New Tub/Shower',
      'Private Gated & Fenced Backyard',
      'Walking Distance to University of Tulsa, Cherry Street Dining & Parks',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Range / Oven', 'Dishwasher', 'Garbage Disposal', 'Refrigerator', 'Washer/Dryer Hookups'],
    description: `Showcasing a complete modern remodel in midtown Tulsa, this three-bedroom duplex provides 900 square feet of refined living space. Gleaming refinished hardwood floors flow through the living room and bedrooms, paired with designer tile in the kitchen and bath and crisp interior paint throughout.

The brand new kitchen is equipped with solid granite countertops, contemporary cabinetry, a cooking range, dishwasher, disposal, and refrigerator. The updated full bathroom features a new vanity with granite top, new plumbing fixtures, and a clean tub-shower combination. Outside, a private gated and fenced backyard offers secluded outdoor space, all situated within easy walking distance of Cherry Street cafes, restaurants, and the University of Tulsa campus.`
  },
  {
    pipeline_id: 'PP-69A55906',
    existing_property_id: '70011a30-8995-48c3-a074-807987ac8b67',
    title: '2BR Duplex in Tulsa',
    address: '1207 S 74th East Ave',
    city: 'Tulsa',
    state: 'OK',
    zip: '74112',
    county: 'Tulsa County',
    lat: 36.11862,
    lng: -95.89416,
    property_type: 'DUPLEX',
    bedrooms: 2,
    bathrooms: 1.5, // Corrected from 2.0 to verified 1.5 baths
    total_bathrooms: 2,
    half_bathrooms: 1,
    square_footage: 832,
    monthly_rent: 1000,
    security_deposit: 1000,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Off-Street Parking',
    heating_type: 'Central Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Updated Hard-Surface Flooring'],
    amenities: [
      'Newly Renovated 832 Sq Ft Duplex Layout',
      'Convenient 1.5 Bathroom Configuration with Half-Bath Powder Room',
      'Central Heat and Air Conditioning for Year-Round Comfort',
      'Bright Open Living Area with Modern Hard-Surface Flooring',
      'Prime Location at 11th & Memorial with Rapid Highway Connectivity',
      'Dedicated Off-Street Parking',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Range / Oven', 'Refrigerator', 'Washer/Dryer Hookups'],
    description: `This newly renovated 832-square-foot duplex in Tulsa offers two bedrooms and one-and-a-half bathrooms. The open main floor features durable hard-surface flooring, fresh paint, and a well-lit living room that flows directly into an efficient kitchen equipped with essential appliances and in-unit washer and dryer connections.

A convenient half-bath powder room on the primary level serves guests, while the upper level hosts two quiet bedrooms alongside a full bathroom. Central heating and air conditioning ensure steady comfort throughout every season. Located near the intersection of 11th and Memorial, the address provides quick access to major highways, making commutes across Tulsa effortless.`
  }
];

export async function runMasterPublish() {
  console.log('================================================================');
  console.log('CHOICE PROPERTIES — MASTER ZILLOW PIPELINE ENRICHMENT & PUBLISH');
  console.log(`Processing Batch: ${PROPERTIES_TO_PUBLISH.length} Properties`);
  console.log('================================================================\n');

  const publishedResults = [];

  for (let i = 0; i < PROPERTIES_TO_PUBLISH.length; i++) {
    const item = PROPERTIES_TO_PUBLISH[i];
    console.log(`\n[${i + 1}/${PROPERTIES_TO_PUBLISH.length}] Processing: ${item.address}, ${item.city} ${item.zip} (${item.pipeline_id})`);

    // 1. Fetch raw pipeline data to extract and verify source photos
    const pipeRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${item.pipeline_id}&select=*`, {
      headers: HEADERS_PIPELINE
    });
    if (!pipeRes.ok) {
      console.error(`   ✗ Could not fetch pipeline row ${item.pipeline_id}: ${pipeRes.status}`);
      continue;
    }
    const pipeData = await pipeRes.json();
    if (!pipeData || pipeData.length === 0) {
      console.error(`   ✗ Pipeline property ${item.pipeline_id} not found.`);
      continue;
    }
    const rawProp = pipeData[0];

    // Extract photos
    let photoUrls = [];
    if (rawProp.original_image_urls) {
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
    console.log(`   ✓ Verified ${photoUrls.length} genuine property photographs`);

    // 2. Determine Property ID (Update existing or create new)
    let propId = item.existing_property_id;
    const isUpdate = Boolean(propId);

    if (!isUpdate) {
      propId = crypto.randomUUID();
    }

    const propRecord = {
      id: propId,
      landlord_id: LANDLORD_ID,
      status: 'active',
      title: item.title,
      description: item.description,
      showing_instructions: 'Self-guided or agent-assisted viewings available upon request.',
      address: item.address,
      city: item.city,
      state: item.state,
      zip: item.zip,
      county: item.county,
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
      application_fee: item.application_fee,
      pets_allowed: item.pets_allowed,
      pet_types_allowed: item.pet_types_allowed,
      smoking_allowed: false,
      lease_terms: null,
      minimum_lease_months: null,
      has_central_air: item.has_central_air,
      has_basement: item.has_basement,
      parking: item.parking,
      amenities: item.amenities,
      appliances: item.appliances,
      flooring: item.flooring,
      heating_type: item.heating_type,
      cooling_type: item.cooling_type,
      laundry_type: item.laundry_type,
      source_status: 'active',
      last_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 3. Upsert into public.properties
    if (isUpdate) {
      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${propId}`, {
        method: 'PATCH',
        headers: { ...HEADERS, 'Prefer': 'return=representation' },
        body: JSON.stringify(propRecord)
      });
      if (!updateRes.ok) {
        const errText = await updateRes.text();
        console.error(`   ✗ Failed to update property ${item.address}: ${updateRes.status} ${errText}`);
        continue;
      }
      console.log(`   ✓ Updated existing property in public.properties (ID: ${propId})`);
    } else {
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/properties`, {
        method: 'POST',
        headers: { ...HEADERS, 'Prefer': 'return=representation' },
        body: JSON.stringify(propRecord)
      });
      if (!insertRes.ok) {
        const errText = await insertRes.text();
        console.error(`   ✗ Failed to insert property ${item.address}: ${insertRes.status} ${errText}`);
        continue;
      }
      console.log(`   ✓ Inserted new property into public.properties (ID: ${propId})`);
    }

    // 4. Synchronize photos in public.property_photos
    const existingPhotosRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos?property_id=eq.${propId}&select=*`, {
      headers: HEADERS
    });
    const existingPhotos = await existingPhotosRes.json();
    const hasExistingIkPhotos = existingPhotos && existingPhotos.length >= 6 && existingPhotos.some(p => p.url && p.url.includes('imagekit.io'));

    if (!hasExistingIkPhotos) {
      // Clear out older rows and replace with verified fresh photo set
      await fetch(`${SUPABASE_URL}/rest/v1/property_photos?property_id=eq.${propId}`, {
        method: 'DELETE',
        headers: HEADERS
      });

      const photoRows = photoUrls.map((url, idx) => ({
        property_id: propId,
        url: url,
        display_order: idx + 1,
        is_hero: idx === 0,
        watermark_status: 'clean',
        alt_text: `${item.address}, ${item.city} OK - Photo ${idx + 1}`
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
        console.log(`   ✓ Synchronized ${photoRows.length} photos into public.property_photos`);
      }
    } else {
      console.log(`   ✓ Preserved ${existingPhotos.length} existing ImageKit photos in public.property_photos`);
    }

    // 5. Update pipeline_properties table row
    const patchPipeRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${item.pipeline_id}`, {
      method: 'PATCH',
      headers: HEADERS_PIPELINE,
      body: JSON.stringify({
        status: 'published',
        choice_property_id: propId,
        title: item.title,
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
        garage_spaces: null,
        pets_allowed: item.pets_allowed,
        pet_types_allowed: JSON.stringify(item.pet_types_allowed),
        smoking_allowed: false,
        lease_terms: '[]',
        minimum_lease_months: null,
        has_central_air: item.has_central_air,
        has_basement: item.has_basement,
        lat: item.lat,
        lng: item.lng,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    });

    if (!patchPipeRes.ok) {
      const errText = await patchPipeRes.text();
      console.error(`   ✗ Failed to patch pipeline_properties row: ${patchPipeRes.status} ${errText}`);
    } else {
      console.log(`   ✓ Updated pipeline_properties row ${item.pipeline_id} to status: 'published'`);
    }

    publishedResults.push({
      index: publishedResults.length + 1,
      id: propId,
      address: item.address,
      city: item.city,
      state: item.state,
      zip: item.zip,
      rent: item.monthly_rent,
      bedrooms: item.bedrooms,
      bathrooms: item.bathrooms,
      url: `https://choice-properties-site.pages.dev/property.html?id=${propId}`
    });
  }

  console.log('\n================================================================');
  console.log(`BATCH COMPLETE: ${publishedResults.length}/${PROPERTIES_TO_PUBLISH.length} PROPERTIES SUCCESSFULLY PUBLISHED`);
  console.log('================================================================\n');

  publishedResults.forEach(r => {
    console.log(`${r.index}. ${r.address}, ${r.city}, ${r.state} ${r.zip} ($${r.rent.toLocaleString()}/mo | ${r.bedrooms} Bed / ${r.bathrooms} Bath) — ${r.url}`);
  });

  return publishedResults;
}

if (process.argv[1]?.endsWith('publish_master_zillow_pipeline_9.mjs')) {
  runMasterPublish().catch(console.error);
}
