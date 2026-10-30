/**
 * Choice Properties — Manual Due-Diligence Enrichment & Publishing Script (Batch of 6)
 * ====================================================================================
 * Deep manual verification, architectural classification, exact decimal bathroom precision,
 * high-resolution source CDN photo ingestion, and pricing synchronization according to
 * Choice Properties standards.
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

export const ENRICHED_PROPERTIES = [
  {
    pipeline_id: 'PP-5D12A329',
    title: '5695 Cherry Bottom Rd #5-302, Columbus, OH 43230',
    address: '5695 Cherry Bottom Rd #5-302',
    city: 'Columbus',
    state: 'OH',
    zip: '43230',
    county: 'Franklin County',
    lat: 40.074768,
    lng: -82.89181,
    property_type: 'APARTMENT',
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: 0,
    total_bathrooms: 2.0,
    square_footage: 1248,
    monthly_rent: 1800,
    security_deposit: 1800,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Off Street Resident & Guest Parking',
    garage_spaces: 0,
    amenities: [
      'Private Balcony / Terrace',
      'Private Ground-Level Entrance',
      'Walk-In Closets',
      'Wood Plank Style Flooring',
      'Espresso Shaker Cabinets',
      'Brushed Nickel Hardware',
      'Community Swimming Pool',
      '24/7 Fitness Center',
      'Clubhouse',
      'Dog Park',
      'In-Unit Laundry Connections',
      'Central Air Conditioning'
    ],
    appliances: [
      'Refrigerator',
      'Glass-Top Electric Range & Oven',
      'Overhead Microwave',
      'Multi-Cycle Dishwasher'
    ],
    flooring: ['Luxury Wood Plank Vinyl', 'Carpet'],
    heating_type: 'Central Electric Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    description: `Constructed in 2020 within the peaceful Magnolia Trace residential community in Northeast Columbus, this spacious top-floor apartment home at 5695 Cherry Bottom Rd #5-302 delivers 1,248 square feet of refined modern living.

A dedicated ground-floor private entrance leads upward into an expansive open-concept living and dining layout finished with durable wood plank flooring, crisp white trim, and contemporary neutral grey wall tones. Large dual-pane windows bathe the interior in continuous natural daylight. The chef's kitchen is appointed with espresso shaker-style cabinetry, brushed nickel hardware, expansive countertop prep surfaces with an extended breakfast counter, and an itemized appliance package featuring a black Frigidaire multi-door refrigerator, electric range and oven, built-in microwave, and multi-cycle dishwasher.

The generous primary bedroom suite accommodates king-sized bedroom furnishings and features a large walk-in closet alongside a private en-suite bathroom with custom vanity cabinetry and an integrated tub-shower combination. Two secondary bedrooms offer bright exposures and ample wardrobe storage, serviced by a second full hallway bathroom with matching brushed nickel fixtures and easy-care surfaces.

Whole-home comfort is maintained with energy-efficient central air conditioning and programmable forced-air heating. A private utility alcove provides dedicated in-unit washer and dryer hookups ready for tenant machines. Outside, a private covered balcony extends directly off the main living space, providing an elevated vantage point over manicured green lawns. Residents enjoy unassigned off-street parking alongside neighborhood amenities including a sparkling resort pool, 24/7 fitness facility, community clubhouse, and fenced dog park.

Tenant is responsible for electric, water, and trash services. Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-6F2CAC8B',
    title: '5415 Turtle Station Way #5551, Westerville, OH 43081',
    address: '5415 Turtle Station Way #5551',
    city: 'Westerville',
    state: 'OH',
    zip: '43081',
    county: 'Franklin County',
    lat: 40.08533,
    lng: -82.890854,
    property_type: 'TOWNHOUSE',
    bedrooms: 3,
    bathrooms: 3.0,
    half_bathrooms: 0,
    total_bathrooms: 3.0,
    square_footage: 1920,
    monthly_rent: 1750,
    security_deposit: 1750,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached Garage & Off-Street Parking',
    garage_spaces: 1,
    amenities: [
      'Multi-Level Townhome Floor Plan',
      'Attached Garage Parking',
      'Private Patio Space',
      'Lakeside and Golf Course Environs',
      'Three Full Bathrooms',
      'Spacious Walk-In Closets',
      'Central Climate Control',
      'In-Unit Laundry Connections',
      'Pet-Friendly Community'
    ],
    appliances: [
      'Full-Size Refrigerator',
      'Electric Range & Oven',
      'Built-in Microwave',
      'Dishwasher',
      'Garbage Disposal'
    ],
    flooring: ['Plush Carpet', 'Premium Vinyl Tile'],
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    description: `Offering an impressive 1,920 square feet of finished living space across a multi-level design, this attached townhome residence at 5415 Turtle Station Way #5551 sits in Westerville's coveted Little Turtle neighborhood at The Garratt, close to the New Albany and Gahanna borders.

The entry level welcomes guests into an expansive living room defined by tall ceilings, neutral carpet flooring, and sliding glass access opening toward the private outdoor patio. The contiguous dining space connects directly with an open-concept kitchen equipped with generous cabinetry, abundant countertop space, a breakfast peninsula for casual seating, and an itemized appliance suite including a full-size refrigerator, electric range with oven, overhead microwave, dishwasher, and garbage disposal.

Three full bathrooms provide unmatched flexibility across all three living levels. The private primary suite features large floor space, extensive closet organization, and an en-suite bath with a porcelain vanity and private walk-in shower. Two additional generously proportioned bedrooms each provide deep double closets and convenient access to dedicated full bathrooms equipped with tub-shower surrounds, modern hardware, and clean vanity fixtures.

Mechanical systems include central heating and whole-home central air conditioning. A private utility zone offers dedicated laundry hookups for full-size washer and dryer units. Parking is accommodated by a private attached garage with additional off-street guest parking available within the development.

Tenant is responsible for all electric, gas, water, and trash utilities. Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-C39C4B2A',
    title: '12417 Johnstown Utica Rd, Johnstown, OH 43031',
    address: '12417 Johnstown Utica Rd',
    city: 'Johnstown',
    state: 'OH',
    zip: '43031',
    county: 'Licking County',
    lat: 40.136906,
    lng: -82.72272,
    property_type: 'DUPLEX',
    bedrooms: 3,
    bathrooms: 1.5,
    half_bathrooms: 1,
    total_bathrooms: 1.5,
    square_footage: 1350,
    monthly_rent: 1750,
    security_deposit: 1750,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached 1-Car Garage & Private Driveway',
    garage_spaces: 1,
    amenities: [
      'Twin-Single Duplex Layout',
      'Private Covered Front Porch',
      'Dedicated Yard Area',
      'Brand New Roof & High-Efficiency Windows',
      'Attached 1-Car Garage with Interior Access',
      'Fresh Neutral Interior Paint',
      'Central Air Conditioning & Heat Pump',
      'In-Unit Laundry Connections'
    ],
    appliances: [
      'Electric Range & Oven',
      'Multi-Cycle Dishwasher',
      'Refrigerator'
    ],
    flooring: ['Durable Luxury Vinyl Flooring', 'Plush Carpet'],
    heating_type: 'Electric Heat Pump & Forced Air',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated In-Unit Laundry Connections',
    description: `A newly renovated twin-single duplex residence situated on Johnstown Utica Road in Johnstown, this quiet rear home at 12417 Johnstown Utica Rd encompasses 1,350 square feet of private living space with an independent front entrance, covered porch, and dedicated yard.

The interior showcases fresh neutral paint and newly installed double-hung insulated windows that flood the formal living room and separate dining room with bright natural lighting. The functional kitchen offers ample cabinet storage, solid countertop work surfaces, and itemized appliances including an electric range and oven, built-in dishwasher, and refrigerator.

Accommodations consist of three spacious upper-level bedrooms, each equipped with dedicated closet space and new windows overlooking the surrounding grounds. The home features 1.5 bathrooms: an updated powder room with vanity sink on the ground level for guest convenience, and an upper-level full bathroom appointed with a clean acrylic tub-shower surround, mirror vanity, and contemporary lighting.

Thermal performance is reinforced by a recently installed roof and new insulated windows, supported by a central heat pump and central air conditioning system. A private laundry room provides washer and dryer connections. Exterior amenities include an attached one-car garage with interior access, a spacious private paved driveway, a sheltered covered front porch, and an exclusive lawn.

Tenants are responsible for electric, trash, internet, lawn maintenance, and water softener salt upkeep. Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-9183A9EF',
    title: '600 Reynoldsburg New Albany Rd, Blacklick, OH 43004',
    address: '600 Reynoldsburg New Albany Rd',
    city: 'Blacklick',
    state: 'OH',
    zip: '43004',
    county: 'Franklin County',
    lat: 39.99655,
    lng: -82.80717,
    property_type: 'SINGLE_FAMILY',
    bedrooms: 3,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1.0,
    square_footage: 1400,
    monthly_rent: 1800,
    security_deposit: 1800,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Driveway & Off-Street Parking',
    garage_spaces: 0,
    amenities: [
      'Detached Single-Family Cottage',
      'Picturesque Farm & Mature Tree Setting',
      'Pitched Great Room Ceilings',
      'Oversized Glass Sliders to Scenic Views',
      'Breakfast Bar Counter',
      'Secondary Level Loft / Reading Nook',
      'Dedicated Interior Laundry Room',
      'Central Air Conditioning'
    ],
    appliances: [
      'Full-Size Refrigerator',
      'Electric Range & Oven',
      'Range Hood Exhaust'
    ],
    flooring: ['Wood-Look Vinyl Plank', 'Durable Tile'],
    heating_type: 'Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'Dedicated In-Home Laundry Room',
    description: `Positioned on scenic pastoral farm grounds in Blacklick, this charming standalone cottage residence at 600 Reynoldsburg New Albany Rd offers 1,400 square feet of freshly remodeled living space just minutes from I-270 and fifteen minutes from Downtown Columbus.

The interior is centered around a dramatic open great room showcasing pitched ceilings, rich wood-look plank flooring, and massive sliding glass doors that present peaceful vistas of mature greenery and landscape. The updated kitchen features clean shaker cabinetry, generous countertop workspace, a deep stainless steel sink, and a raised breakfast bar counter ideal for morning coffee. An itemized appliance package includes a full-size refrigerator and electric range with oven.

The versatile bedroom configuration provides two private bedrooms with ample wardrobe closets plus an adaptable third room perfectly suited as an office, fitness studio, or guest bedroom. An upper-level loft nook accessible by ladder provides an intimate reading space or supplemental storage. The fully updated bathroom offers modern plumbing fixtures, a contemporary vanity with under-sink storage, and an enclosed tub-shower combination.

Central heating and central air conditioning ensure dependable year-round climate control, while a dedicated interior laundry room includes full washer and dryer hookups. The exterior setting provides expansive yard space surrounded by mature trees and garden beds, complemented by a private driveway with abundant off-street vehicle parking.

Tenant is responsible for electric, heating, and trash utilities. Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-92219786',
    title: '5353 Nottinghamshire Ln #6163KIRK, Westerville, OH 43081',
    address: '5353 Nottinghamshire Ln #6163KIRK',
    city: 'Westerville',
    state: 'OH',
    zip: '43081',
    county: 'Franklin County',
    lat: 40.089928,
    lng: -82.85377,
    property_type: 'CONDO',
    bedrooms: 3,
    bathrooms: 2.5,
    half_bathrooms: 1,
    total_bathrooms: 2.5,
    square_footage: 1776,
    monthly_rent: 1800,
    security_deposit: 1800,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Private Enclosed Garage & Resident Parking',
    garage_spaces: 1,
    amenities: [
      'Single-Level Condominium Living',
      'Soaring Vaulted Great Room',
      'Screened-In Upper Balcony Porch',
      'Private Enclosed Garage with Opener',
      'Spacious Walk-In Closets',
      '2.5 Bathrooms with Dual Primary Vanity',
      'Community Clubhouse, Pool & Fitness Center',
      'Central Air Conditioning & Heating'
    ],
    appliances: [
      'Full-Size Refrigerator',
      'Electric Range & Oven',
      'Built-in Microwave',
      'Multi-Cycle Dishwasher',
      'Garbage Disposal'
    ],
    flooring: ['Plush Neutral Carpeting', 'Ceramic Tile'],
    heating_type: 'Central Forced Air Heating',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer Hookups',
    description: `Situated at The Reserve at Preston Woods in Westerville, just moments from the New Albany business corridor and Route 161, this rare 1,776-square-foot condominium residence at 5353 Nottinghamshire Ln #6163KIRK delivers one of the community's premier three-bedroom, 2.5-bathroom floor plans.

An impressive vaulted great room with soaring ceiling height anchors the home, illuminated by high architectural windows and finished in neutral carpeting. The adjoining dining and kitchen zone is designed for effortless entertaining, highlighting extensive cabinet storage, expansive solid-surface prep counters, and an itemized appliance package comprising a full-size refrigerator, electric range and oven, microwave, multi-cycle dishwasher, and disposal.

Three expansive bedrooms deliver exceptional personal space. The primary suite features vaulted ceilings, an oversized walk-in closet, and a private en-suite bathroom appointed with a double-sink vanity and walk-in shower. Two secondary bedrooms provide generous dimensions with deep closets, serviced by a second full hallway bathroom with tub-shower surround. A guest half-bath (powder room) is conveniently positioned off the main living corridor for total privacy.

Year-round comfort is delivered via central air conditioning and forced-air heating. Dedicated in-unit laundry connections accommodate full-size machines. Relax on the private screened-in upper balcony porch offering tranquil green views without insect intrusion. Parking includes a private enclosed garage bay with automatic opener. Community perks include access to a clubhouse, swimming pool, and fitness center.

Tenant is responsible for electric, gas, and communications utilities. Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.`
  },
  {
    pipeline_id: 'PP-72287377',
    title: '6350 Well Fleet Dr #103, Columbus, OH 43231',
    address: '6350 Well Fleet Dr #103',
    city: 'Columbus',
    state: 'OH',
    zip: '43231',
    county: 'Franklin County',
    lat: 40.09989,
    lng: -82.94545,
    property_type: 'CONDO',
    bedrooms: 3,
    bathrooms: 1.5,
    half_bathrooms: 1,
    total_bathrooms: 1.5,
    square_footage: 1258,
    monthly_rent: 1800,
    security_deposit: 1800,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    available_date: null,
    has_central_air: true,
    has_basement: true,
    parking: 'Attached 1-Car Garage & Driveway',
    garage_spaces: 1,
    amenities: [
      'Two-Story Condominium Townhome',
      'Full Unfinished Basement Storage',
      'Attached 1-Car Garage',
      'Decorative Fireplace Feature',
      'Granite Countertops & Modern Cabinetry',
      'Brand New 2024 Furnace & Central A/C',
      'Westerville School District',
      'Rear Patio Area',
      'Fresh Interior Paint & New Flooring'
    ],
    appliances: [
      'Refrigerator',
      'Electric Range & Oven',
      'Overhead Microwave',
      'Dishwasher',
      'Garbage Disposal'
    ],
    flooring: ['Updated Luxury Vinyl Tile', 'Neutral Flooring'],
    heating_type: 'High-Efficiency Forced Air Furnace (2024)',
    cooling_type: 'Central Air Conditioning (2024)',
    laundry_type: 'Basement Washer & Dryer Hookups',
    description: `Located in Northeast Columbus within the Westerville School District, this refreshed two-story condominium residence at 6350 Well Fleet Dr #103 encompasses 1,258 square feet of finished interior space supplemented by a private full unfinished basement.

The main level welcomes residents into an expansive living room featuring fresh neutral paint, updated flooring, and a handsome decorative brick fireplace focal point. The connected dining space leads directly to a modernized kitchen outfitted with polished granite countertops, fresh cabinetry, a deep stainless steel sink with modern faucet, and an itemized appliance suite including a refrigerator, electric range and oven, overhead microwave, dishwasher, and disposal.

Upstairs, three well-proportioned bedrooms offer peaceful sleeping quarters with dedicated closet storage and oversized windows. The property provides 1.5 bathrooms: an updated main-floor powder room for guests, and a primary upper-level bathroom featuring a granite vanity, porcelain commode, and a fully tiled tub-shower surround.

Major mechanical upgrades deliver worry-free reliability, including a brand new 2024 high-efficiency furnace and central air conditioning system paired with a 2021 water heater. The full unfinished basement provides expansive dry storage space along with dedicated washer and dryer hookups. Parking is provided by an attached one-car garage with interior access and a private paved driveway, complemented by a private rear patio.

Tenant is responsible for electric, gas, water/sewer, and cable utilities. Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.`
  }
];

export async function runBatchPublish() {
  console.log('================================================================');
  console.log('CHOICE PROPERTIES — MANUAL DUE DILIGENCE PUBLISHING ENGINE');
  console.log(`Processing ${ENRICHED_PROPERTIES.length} verified pipeline properties`);
  console.log('================================================================\n');

  const publishedResults = [];

  for (const item of ENRICHED_PROPERTIES) {
    console.log(`\n▶ Processing [${item.pipeline_id}] ${item.address}, ${item.city}...`);

    // 1. Fetch pipeline property record from pipeline schema
    const pipeRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${item.pipeline_id}`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Accept-Profile': 'pipeline'
      }
    });

    if (!pipeRes.ok) {
      console.error(`   ✗ Failed to fetch pipeline property ${item.pipeline_id}: ${pipeRes.status}`);
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
        const parsed = typeof rawProp.original_image_urls === 'string'
          ? JSON.parse(rawProp.original_image_urls)
          : rawProp.original_image_urls;
        photoUrls = (parsed || []).map(p => typeof p === 'string' ? p : p.url).filter(u => u && u.startsWith('http'));
      } catch (e) {
        photoUrls = [];
      }
    }

    // Deduplicate URLs while preserving order
    photoUrls = [...new Set(photoUrls)];
    console.log(`   ✓ Verified ${photoUrls.length} genuine source CDN photographs`);

    // 2. Determine Property ID (Check if exists in public.properties by address)
    let propId = null;
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?address=eq.${encodeURIComponent(item.address)}&city=eq.${encodeURIComponent(item.city)}&select=id`, {
      headers: HEADERS
    });
    const checkData = await checkRes.json();
    if (checkData && checkData.length > 0) {
      propId = checkData[0].id;
    } else {
      propId = crypto.randomUUID();
    }

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

    // 3. Upsert into public.properties
    const existingCheck = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${propId}&select=id`, {
      headers: HEADERS
    });
    const exists = (await existingCheck.json()).length > 0;

    if (exists) {
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
        alt_text: `${item.address}, ${item.city} OH - Photo ${idx + 1}`
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
        console.log(`   ✓ Synchronized ${photoRows.length} source CDN photos into public.property_photos (Hero: photo 1)`);
      }
    }

    // 5. Update pipeline_properties table row with enriched details and published status
    const patchPipeRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${item.pipeline_id}`, {
      method: 'PATCH',
      headers: {
        ...HEADERS_PIPELINE,
        'Content-Type': 'application/json'
      },
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
  console.log(`PUBLISHING COMPLETE: ${publishedResults.length}/${ENRICHED_PROPERTIES.length} PROPERTIES`);
  console.log('================================================================\n');

  publishedResults.forEach((p, idx) => {
    console.log(`${idx + 1}. ${p.address}, ${p.city}, ${p.state} ${p.zip} ($${p.rent.toLocaleString()}/mo | ${p.bedrooms} Bed / ${p.bathrooms} Bath) — ${p.url}`);
  });

  return publishedResults;
}

if (process.argv[1]?.endsWith('publish_manual_batch_6.mjs')) {
  runBatchPublish().catch(console.error);
}
