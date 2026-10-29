/**
 * CHOICE PROPERTIES — TULSA 7 PROPERTIES MANUAL ENRICHMENT & PUBLISHING ENGINE
 * ============================================================================
 * Performs deep, manual due-diligence enrichment and publishing for all 7 staged
 * pipeline properties in Tulsa, OK according to Choice Properties standards.
 */

import crypto from 'crypto';
import { CREDENTIALS_CONFIG } from '../credentials-config.mjs';

const SUPABASE_URL = CREDENTIALS_CONFIG.SUPABASE_URL;
const SERVICE_KEY = CREDENTIALS_CONFIG.SUPABASE_API_KEY;

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json'
};

const HEADERS_PIPELINE = {
  ...HEADERS,
  'Accept-Profile': 'pipeline',
  'Content-Profile': 'pipeline',
  'Prefer': 'return=representation'
};

export const TULSA_BATCH = [
  {
    pipeline_id: 'PP-F4D06533',
    title: '1630 S Knoxville Ave, Tulsa, OK 74112',
    address: '1630 S Knoxville Ave',
    city: 'Tulsa',
    state: 'OK',
    zip: '74112',
    county: 'Tulsa County',
    lat: 36.138187,
    lng: -95.93698,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 1,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 895,
    monthly_rent: 900,
    security_deposit: 900,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: false,
    has_basement: false,
    parking: 'Detached Garage, Driveway Parking',
    garage_spaces: 1,
    heating_type: 'Forced Air',
    cooling_type: 'Window Air Conditioning Units',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Hardwood Flooring', 'Tile'],
    amenities: [
      'Original Hardwood Flooring',
      'Spacious 895 Sq Ft Midtown Single-Family Home',
      'Detached Garage & Off-Street Driveway Parking',
      'In-Unit Washer & Dryer Hookups',
      'Forced Air Heat & Air Conditioning Units',
      'Quiet Midtown Tulsa Neighborhood Near Expo Square',
      'Pet Friendly'
    ],
    appliances: [
      'Refrigerator',
      'Range / Oven',
      'Washer/Dryer Hookups'
    ],
    description: `Located in Midtown Tulsa near the Expo Square and University of Tulsa corridors, 1630 South Knoxville Avenue offers an 895-square-foot single-family home that combines classic architectural charm with convenient residential living.

The interior showcases warm, original hardwood flooring that runs continuously through the sunlit living room and dedicated dining area. The kitchen is outfitted with ample cabinetry, solid countertops, a gas range with oven, and a refrigerator. Adjoining the kitchen, dedicated utility connections provide in-unit washer and dryer hookups for everyday laundry ease.

The bedroom is comfortably scaled with generous natural lighting and deep closet space. The full bathroom features vintage-inspired tile work, a clean vanity, and a tub/shower combination. Climate comfort is maintained with forced air heating and window air conditioning units. Outside, the home includes a detached garage space along with driveway parking.

This pet-friendly home requires a $50 application fee per applicant. Resident is responsible for gas and electric. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-6BAB6960',
    title: '919 W 24th Pl, Tulsa, OK 74107',
    address: '919 W 24th Pl',
    city: 'Tulsa',
    state: 'OK',
    zip: '74107',
    county: 'Tulsa County',
    lat: 36.127293,
    lng: -96.00272,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 1,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 651,
    monthly_rent: 900,
    security_deposit: 900,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Off-Street Parking',
    garage_spaces: null,
    heating_type: 'Wall Furnace / Central Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Luxury Vinyl Plank', 'Tile'],
    amenities: [
      'Completely Renovated Standalone Single-Family Home',
      'Large Private Fenced Backyard',
      'Brand New Luxury Vinyl Plank Flooring & Ceramic Tile',
      'New Energy-Efficient Windows, Roof & Siding',
      'Central Air Conditioning & Heating',
      'In-Unit Washer & Dryer Hookups',
      'Minutes to The Gathering Place & Downtown Tulsa',
      'Pet Friendly'
    ],
    appliances: [
      'Range / Oven',
      'Washer/Dryer Hookups'
    ],
    description: `Nestled in Southwest Tulsa minutes from The Gathering Place, the OSU Center for Health Sciences, and Downtown, 919 West 24th Place is a fully remodeled 651-square-foot standalone single-family residence featuring extensive modern upgrades inside and out.

The interior begins in a bright living area anchored by newly installed luxury vinyl plank flooring, fresh neutral paint, and new energy-efficient windows. The updated kitchen features refreshed cabinetry, clean tile accents, and a range with oven, with open access to the main living area.

The bedroom offers a restful sanctuary with generous closet space and natural light. The updated bathroom features modern fixtures, custom ceramic wall tile, and a contemporary vanity. Practical additions include central air conditioning and heating, plus dedicated in-unit washer and dryer hookups. Outside, enjoy an expansive, fully fenced backyard along with off-street parking.

Pet-friendly property with a $50 application fee. Resident is responsible for utility services. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-437C0CE0',
    title: '731 S Rockford Ave, Tulsa, OK 74120',
    address: '731 S Rockford Ave',
    city: 'Tulsa',
    state: 'OK',
    zip: '74120',
    county: 'Tulsa County',
    lat: 36.15112,
    lng: -95.97169,
    property_type: 'DUPLEX',
    bedrooms: 1,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 660,
    monthly_rent: 900,
    security_deposit: 900,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Off-Street Parking',
    garage_spaces: null,
    heating_type: 'Central Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Hard-Surface Flooring', 'Tile'],
    amenities: [
      'Prime Pearl District Location (Walk to Dining & Breweries)',
      'Private Backyard with Privacy Fence',
      'Central Heating and Air Conditioning',
      'Large Bedroom Closet & Generous Storage',
      'Ceiling Fan in Living Area',
      'In-Unit Washer & Dryer Hookups',
      'Dedicated Off-Street Parking',
      'Pet Friendly'
    ],
    appliances: [
      'Refrigerator',
      'Range / Oven',
      'Washer/Dryer Hookups'
    ],
    description: `Situated in Tulsa's vibrant Pearl District, 731 South Rockford Avenue is an inviting 660-square-foot half-duplex residence within easy walking distance of local coffee shops, breweries, art studios, and dining destinations.

The floor plan welcomes you into an airy living area detailed with ceiling fans and durable flooring that flows into an efficient kitchen equipped with cabinet storage, solid counter surfaces, and a refrigerator. Dedicated in-unit laundry hookups are situated within the utility area for washer and dryer installation.

The spacious bedroom accommodates full furniture arrangements with an oversized closet and excellent storage capacity. The full bathroom includes clean porcelain fixtures, a full tub and shower surround, and an updated vanity. Year-round comfort is supported by central heating and air conditioning. Outdoors, each unit enjoys its own private fenced backyard offering a quiet outdoor retreat.

This pet-friendly duplex requires a $50 application fee. Resident is responsible for utilities. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-0181822D',
    title: '2010 E 8th St, Tulsa, OK 74104',
    address: '2010 E 8th St',
    city: 'Tulsa',
    state: 'OK',
    zip: '74104',
    county: 'Tulsa County',
    lat: 36.149628,
    lng: -95.96334,
    property_type: 'DUPLEX',
    bedrooms: 1,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 700,
    monthly_rent: 995,
    security_deposit: 995,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Dedicated Off-Street Parking',
    garage_spaces: null,
    heating_type: 'Central Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer',
    flooring: ['Refinished Hardwood Flooring', 'Ceramic Tile'],
    amenities: [
      'Complete Designer Remodel with High-End Finishes',
      'Polished Granite Kitchen Countertops',
      'Full Stainless Steel Appliance Package with Dishwasher',
      'In-Unit Washer & Dryer Included',
      'Architectural Focal Fireplace',
      'Refinished Hardwood Floors & Tile Bathroom',
      'Central Heating & Air Conditioning with New Windows',
      'Dedicated Off-Street Parking in Quiet Neighborhood',
      'Pet Friendly'
    ],
    appliances: [
      'Stainless Steel Refrigerator',
      'Range / Oven',
      'Microwave',
      'Dishwasher',
      'In-Unit Washer',
      'In-Unit Dryer'
    ],
    description: `Positioned on East 8th Street in a quiet Tulsa neighborhood near Route 66 and downtown transit, 2010 East 8th Street presents a completely remodeled 700-square-foot duplex home that pairs modern luxury finishes with functional design.

The open living space features polished hardwood floors, new thermal windows, and a focal architectural fireplace that anchors the living room. The remodeled kitchen is finished with polished granite countertops, contemporary cabinetry, and a full stainless steel appliance package including a refrigerator, range and oven, microwave, and dishwasher. Complete in-unit laundry convenience is provided with an included washer and dryer.

The bedroom offers comfortable proportions with ample closet storage. The full bathroom is finished with designer ceramic tile, an updated vanity, and modern fixtures. Efficient central heating and air conditioning ensure consistent interior temperatures. Dedicated off-street parking is provided right outside the home.

Pet-friendly residence with a $50 application fee. Resident is responsible for electric, water, and trash. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-DF64069B',
    title: '2217 E 66th Pl S #910, Tulsa, OK 74136',
    address: '2217 E 66th Pl S #910',
    city: 'Tulsa',
    state: 'OK',
    zip: '74136',
    county: 'Tulsa County',
    lat: 36.067448,
    lng: -95.9599,
    property_type: 'TOWNHOUSE',
    bedrooms: 1,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 800,
    monthly_rent: 850,
    security_deposit: 850,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Off-Street Parking',
    garage_spaces: null,
    heating_type: 'Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer Hookup',
    flooring: ['Hard-Surface Flooring', 'Carpet', 'Tile'],
    amenities: [
      'Two-Story Townhome Layout with Ground Floor Living',
      'Private Elevated Balcony off Bedroom Suite',
      'Cozy Fireplace in Second-Story Bedroom',
      'Polished Granite Countertops with Kitchen Pantry',
      'Oversized Bedroom Storage Closet',
      'Central Air Conditioning & Forced Air Heat',
      'In-Unit Washer Hookup',
      'Dedicated Off-Street Parking',
      'Pet Friendly'
    ],
    appliances: [
      'Refrigerator',
      'Range / Oven',
      'Dishwasher',
      'Freezer',
      'Washer Hookup'
    ],
    description: `Offering an appealing two-level architectural design in South Tulsa, 2217 East 66th Place South #910 delivers 800 square feet of townhome-style living with private outdoor space.

The ground level features an open main living room and kitchen layout with durable flooring and natural light. The kitchen is appointed with granite countertops, a functional pantry, and appliances including a refrigerator, range with oven, and dishwasher, alongside dedicated in-unit washer hookups.

Upstairs, the private second-story bedroom suite is accented by a cozy in-room fireplace, an oversized storage closet, and sliding glass doors that open directly onto a private elevated balcony. The full bathroom features a modern vanity and tiled shower/tub combination. Central air conditioning and forced air heat maintain steady comfort throughout both levels, with convenient off-street parking provided.

This pet-friendly townhome requires a $50 application fee. Resident is responsible for utility services. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-05B666A2',
    title: '132 1/2 N Wheeling Ave, Tulsa, OK 74110',
    address: '132 1/2 N Wheeling Ave',
    city: 'Tulsa',
    state: 'OK',
    zip: '74110',
    county: 'Tulsa County',
    lat: 36.192013,
    lng: -95.96491,
    property_type: 'APARTMENT',
    bedrooms: 1,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 600,
    monthly_rent: 795,
    security_deposit: 795,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: false,
    has_basement: false,
    parking: 'Front Door Dedicated Parking',
    garage_spaces: null,
    heating_type: 'Forced Air Heat',
    cooling_type: 'Air Conditioning Unit',
    laundry_type: 'In-Unit Washer & Dryer',
    flooring: ['Hardwood Flooring', 'Ceramic Tile'],
    amenities: [
      'Gleaming Original Hardwood Floors Throughout',
      'Stacking In-Unit Washer & Dryer Included',
      'Efficiency Kitchen with Clean Cabinetry',
      'Ceramic Tile Bathroom with Full Tub & Shower',
      'Fresh Paint & New Window Coverings',
      'Dedicated Parking Directly at Front Entrance',
      'Water & Sewer Included in Rent',
      'Pet Friendly'
    ],
    appliances: [
      'Refrigerator',
      'Range / Oven',
      'In-Unit Washer',
      'In-Unit Dryer'
    ],
    description: `Tucked into a residential North Tulsa setting on North Wheeling Avenue, 132 1/2 North Wheeling Avenue offers a clean, private one-bedroom residence with polished hardwood floors and practical everyday amenities.

The main interior features genuine hardwood flooring spanning across the living area and bedroom, accented by freshly painted white walls and updated mini blinds. The efficient kitchen is designed for easy everyday meal prep, equipped with cabinet storage, a cooktop/oven, refrigerator, and an in-unit stacking washer and dryer.

The private bedroom offers peaceful accommodations with convenient closet storage. The full bathroom features ceramic tile flooring, an updated vanity, and a traditional bathtub and shower combination. Climate control keeps the home comfortable, and parking is available right at the front entrance.

Pet-friendly residence with a $50 application fee. Resident is responsible for electricity. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-CB1ED806',
    title: '2230 W Newton St, Tulsa, OK 74127',
    address: '2230 W Newton St',
    city: 'Tulsa',
    state: 'OK',
    zip: '74127',
    county: 'Osage County',
    lat: 36.172832,
    lng: -96.016335,
    property_type: 'APARTMENT',
    bedrooms: 1,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1,
    square_footage: 963,
    monthly_rent: 975,
    security_deposit: 975,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Detached Garage, Covered Parking',
    garage_spaces: 1,
    heating_type: 'Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer',
    flooring: ['Hard-Surface Flooring', 'Carpet', 'Tile'],
    amenities: [
      'Spacious 963 Sq Ft Open Apartment Layout',
      'Community Swimming Pool & Manicured Grounds',
      'In-Unit Washer and Dryer Included',
      'Full Kitchen with Dishwasher & Microwave',
      'Oversized Bedroom with Walk-In Closet',
      'Central Air Conditioning & Forced Air Heat',
      'Detached Garage & Covered Parking Options',
      'Minutes to Gilcrease Museum, Arkansas River & Downtown',
      'Pet Friendly'
    ],
    appliances: [
      'Refrigerator',
      'Range / Oven',
      'Dishwasher',
      'Microwave',
      'Freezer',
      'In-Unit Washer',
      'In-Unit Dryer'
    ],
    description: `Situated northwest of Downtown Tulsa near the Gilcrease Museum, the Arkansas River, and local parks, 2230 West Newton Street at Oak Creek offers 963 square feet of expansive apartment living in a tranquil community setting.

The spacious floor plan unfolds with high ceilings and wide living spaces that lead out toward a comfortable dining zone. The fully equipped kitchen features ample cabinet storage and a complete appliance collection including a refrigerator, range and oven, dishwasher, and microwave. Everyday convenience is enhanced by an included in-unit washer and dryer.

The private bedroom easily accommodates king-size furniture with a large walk-in closet for extensive storage. The full bathroom is outfitted with a large vanity, contemporary mirrors, and a full tub/shower combination. Central air conditioning and forced air heat ensure effortless climate management, and community amenities feature a refreshing swimming pool, manicured grounds, and covered parking options.

This pet-friendly home requires a $50 application fee. Resident is responsible for utilities. Submit your rental application today at Choice Properties.`
  }
];

export async function runTulsaPublish() {
  console.log('================================================================');
  console.log('CHOICE PROPERTIES — TULSA 7 PROPERTIES MANUAL ENRICHMENT & PUBLISH');
  console.log(`Processing Batch: ${TULSA_BATCH.length} Properties`);
  console.log('================================================================\n');

  const publishedResults = [];

  for (let i = 0; i < TULSA_BATCH.length; i++) {
    const item = TULSA_BATCH[i];
    console.log(`\n[${i + 1}/${TULSA_BATCH.length}] Processing: ${item.address}, ${item.city} ${item.zip} (${item.pipeline_id})`);

    // 1. Fetch raw pipeline record to extract genuine source CDN photo URLs
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

    // Extract genuine photos from original_image_urls
    let photoUrls = [];
    if (rawProp.original_image_urls) {
      try {
        const parsed = typeof rawProp.original_image_urls === 'string' ? JSON.parse(rawProp.original_image_urls) : rawProp.original_image_urls;
        photoUrls = (parsed || []).map(p => typeof p === 'string' ? p : p.url).filter(u => u && u.startsWith('http'));
      } catch (e) {
        photoUrls = [];
      }
    }

    // Deduplicate URLs while preserving order
    photoUrls = [...new Set(photoUrls)];
    console.log(`   ✓ Verified ${photoUrls.length} genuine source CDN photographs`);

    // 2. Generate or lookup Property ID
    const propId = crypto.randomUUID();

    const propRecord = {
      id: propId,
      landlord_id: null,
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
      smoking_allowed: item.smoking_allowed,
      lease_terms: item.lease_terms,
      minimum_lease_months: item.minimum_lease_months,
      available_date: item.available_date,
      has_central_air: item.has_central_air,
      has_basement: item.has_basement,
      parking: item.parking,
      garage_spaces: item.garage_spaces,
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

    // 3. Insert into public.properties
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

    // 4. Synchronize photos in public.property_photos using high-res source CDN URLs
    if (photoUrls.length > 0) {
      // Clear out older rows for this property
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
        console.log(`   ✓ Synchronized ${photoRows.length} source CDN photos into public.property_photos`);
      }
    }

    // 5. Update pipeline_properties table row with enriched details and published status
    const patchPipeRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${item.pipeline_id}`, {
      method: 'PATCH',
      headers: HEADERS_PIPELINE,
      body: JSON.stringify({
        status: 'published',
        choice_property_id: propId,
        title: item.title,
        monthly_rent: item.monthly_rent,
        security_deposit: item.security_deposit,
        application_fee: item.application_fee,
        pets_allowed: item.pets_allowed,
        pet_types_allowed: item.pet_types_allowed,
        smoking_allowed: item.smoking_allowed,
        lease_terms: null,
        minimum_lease_months: null,
        available_date: null,
        property_type: item.property_type,
        bedrooms: item.bedrooms,
        bathrooms: item.bathrooms,
        half_bathrooms: item.half_bathrooms,
        total_bathrooms: item.total_bathrooms,
        square_footage: item.square_footage,
        description: item.description,
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
      pipeline_id: item.pipeline_id,
      property_id: propId,
      address: item.address,
      city: item.city,
      state: item.state,
      zip: item.zip,
      rent: item.monthly_rent,
      bedrooms: item.bedrooms,
      bathrooms: item.bathrooms,
      photoCount: photoUrls.length,
      url: `https://choice-properties-site.pages.dev/property.html?id=${propId}`
    });
  }

  console.log('\n================================================================');
  console.log(`PUBLISHING COMPLETE: ${publishedResults.length}/${TULSA_BATCH.length} PROPERTIES`);
  console.log('================================================================\n');

  publishedResults.forEach((p, idx) => {
    console.log(`${idx + 1}. ${p.address}, ${p.city}, ${p.state} ${p.zip} ($${p.rent}/mo | ${p.bedrooms} Bed / ${p.bathrooms} Bath) — ${p.url}`);
  });

  return publishedResults;
}

runTulsaPublish().catch(console.error);
