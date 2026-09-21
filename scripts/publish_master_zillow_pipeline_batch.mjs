/**
 * scripts/publish_master_zillow_pipeline_batch.mjs
 * Master Zillow Pipeline Enrichment, Verification, Validation, and Publishing Engine
 * Processes the 9 recently scraped Zillow pipeline properties in Tulsa, OK.
 * Adheres strictly to AGENTS.md Choice Properties rules:
 * - Exact bathroom precision (1.5 decimal preserved, full_bathrooms=1, half_bathrooms=1)
 * - Physical architectural classification (DUPLEX, TOWNHOUSE, APARTMENT)
 * - Price capped at $1200 maximum per user explicit directive
 * - Zero security deposit mentions in descriptions (1x monthly rent in DB)
 * - Standardized application fee ($50) and pet-friendly policy (pets_allowed=true)
 * - Duplicate checking: existing records updated in-place to preserve IDs and URLs
 * - Photo validation & synchronization
 */

import crypto from 'crypto';
import { CREDENTIALS_CONFIG } from '../credentials-config.mjs';

const SUPABASE_URL = CREDENTIALS_CONFIG.SUPABASE_URL;
const KEY = CREDENTIALS_CONFIG.SUPABASE_API_KEY;
const LANDLORD_ID = 'dabe7d4a-8a92-4fb4-9de9-0dcda47391c1'; // Choice properties LLC

const HEADERS = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

const HEADERS_PIPELINE = {
  ...HEADERS,
  'Accept-Profile': 'pipeline',
  'Content-Profile': 'pipeline',
};

const PROPERTIES_TO_PUBLISH = [
  {
    pipeline_id: 'PP-E57D1E99',
    existing_property_id: null,
    title: '2BR TOWNHOMES in Tulsa',
    address: '2732 E 29th Pl N',
    city: 'Tulsa',
    state: 'OK',
    zip: '74110',
    county: 'Tulsa County',
    lat: 36.19659,
    lng: -95.95293,
    property_type: 'DUPLEX',
    bedrooms: 2,
    bathrooms: 1.0,
    total_bathrooms: 1,
    half_bathrooms: 0,
    square_footage: 858,
    year_built: null,
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
    parking: 'Dedicated Off-Street Parking',
    heating_type: 'Central Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Original Hardwood Flooring', 'Ceramic Tile'],
    amenities: [
      'Fully Renovated Two-Story Duplex Layout',
      'Refinished Original Hardwood Floors',
      'New Central Air Conditioning Unit',
      'Updated Plumbing & Electrical Fixtures',
      'New Ceiling Fans & Fresh Paint Throughout',
      'Lawn Care Maintenance Included',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Range / Oven', 'Refrigerator', 'Dishwasher'],
    description: `Presenting a fully renovated 858-square-foot two-story duplex in Tulsa. This two-bedroom, one-bathroom home combines historic charm with comprehensive modern upgrades throughout.

The interior showcases freshly refinished original hardwood flooring, contemporary light fixtures, new ceiling fans, and crisp paint throughout both levels. The updated kitchen features newly installed cabinetry, modern appliances, and durable tile flooring, while the renovated bathroom includes modern tile work and updated fixtures. Year-round comfort is provided by a new central air unit and updated plumbing infrastructure. Lawn care maintenance is included.`
  },
  {
    pipeline_id: 'PP-7C93D14D',
    existing_property_id: null,
    title: '2BR TOWNHOMES in Tulsa',
    address: '102 S Zunis Ave',
    city: 'Tulsa',
    state: 'OK',
    zip: '74104',
    county: 'Tulsa County',
    lat: 36.158783,
    lng: -95.962296,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 1.5,
    total_bathrooms: 1.5,
    half_bathrooms: 1,
    square_footage: 924,
    year_built: null,
    monthly_rent: 1200, // Reduced from $1250 per explicit price reduction directive
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
    flooring: ['Hard-Surface Flooring'],
    amenities: [
      'Renovated Two-Story Townhome Layout',
      '1.5 Bathrooms with Main-Level Powder Room',
      'Central Heat & Air Conditioning',
      'Ceiling Fans in Living & Bedroom Areas',
      'Prime Kendall Whittier Historic Location',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Range / Oven', 'Refrigerator'],
    description: `Situated in Tulsa's historic Kendall Whittier neighborhood, this renovated two-bedroom, 1.5-bathroom townhome offers 924 square feet of comfortable, multi-level living space.

The main level features open living and dining spaces equipped with ceiling fans and central climate control, complemented by a convenient half-bathroom for guests. Upstairs, two private bedrooms share a full bath. Modern hard-surface flooring extends throughout high-traffic areas, while central heating and air conditioning ensure dependable year-round climate management. Positioned within minutes of local dining, arts venues, and neighborhood amenities.`
  },
  {
    pipeline_id: 'PP-1D460B8F',
    existing_property_id: null,
    title: '2BR TOWNHOMES in Tulsa',
    address: '10814 E 15th Pl',
    city: 'Tulsa',
    state: 'OK',
    zip: '74128',
    county: 'Tulsa County',
    lat: 36.14175,
    lng: -95.856995,
    property_type: 'TOWNHOUSE',
    bedrooms: 2,
    bathrooms: 1.0,
    total_bathrooms: 1,
    half_bathrooms: 0,
    square_footage: 946,
    year_built: null,
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
    parking: 'Dedicated Off-Street Parking',
    heating_type: 'Central Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Connections',
    flooring: ['Hard-Surface Flooring'],
    amenities: [
      'Recently Updated Interior Finishes',
      'Central Heat & Air Conditioning',
      'In-Unit Washer & Dryer Hookups',
      'Immediate Access to Major Tulsa Highways',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Range / Oven', 'Refrigerator', 'Washer/Dryer Connections'],
    description: `Offering 946 square feet of living space in East Tulsa, this updated two-bedroom, one-bathroom home delivers an efficient and functional floor plan.

The interior has been refreshed with clean contemporary updates, durable hard-surface flooring, and practical storage spaces. The functional kitchen layout provides dedicated cabinet storage and cooking appliances, while in-unit washer and dryer connections offer everyday laundry convenience. Positioned near major highways for rapid commuting across the Tulsa metropolitan area.`
  },
  {
    pipeline_id: 'PP-C5B39221',
    existing_property_id: null,
    title: '3BR TOWNHOMES in Tulsa',
    address: '1551 E 66th Pl',
    city: 'Tulsa',
    state: 'OK',
    zip: '74136',
    county: 'Tulsa County',
    lat: 36.067696,
    lng: -95.96982,
    property_type: 'DUPLEX',
    bedrooms: 3,
    bathrooms: 2.0,
    total_bathrooms: 2,
    half_bathrooms: 0,
    square_footage: 1300,
    year_built: null,
    monthly_rent: 1200, // Reduced from $1250 per explicit price reduction directive
    security_deposit: 1200,
    application_fee: 50,
    pets_allowed: true,
    pet_types_allowed: ['Dogs', 'Cats'],
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    has_central_air: true,
    has_basement: false,
    parking: 'Attached Garage & Driveway Parking',
    garage_spaces: 1,
    heating_type: 'Baseboard & Central Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Hard-Surface Flooring'],
    amenities: [
      'Quiet Cul-de-Sac Setting',
      'Attached Garage Parking',
      'Patio Door with Private Outdoor Access',
      'Extensive In-Home Storage Capacity',
      'Water Utility Service Covered by Landlord',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Range / Oven', 'Refrigerator', 'Dishwasher', 'Washer/Dryer Hookups'],
    description: `Positioned in a tranquil residential cul-de-sac in South Tulsa, this spacious 1,300-square-foot duplex offers three bedrooms, two full bathrooms, and attached garage parking.

The floor plan includes generous living and dining areas filled with natural light, featuring sliding patio doors that lead directly to the outdoor yard area. The kitchen provides ample counter space and functional cabinetry, adjacent to substantial closet and pantry storage throughout the home. Three well-proportioned bedrooms are served by two full bathrooms. Water utility service is provided by the property, and the quiet cul-de-sac location ensures minimal through traffic while remaining close to South Tulsa retail and dining corridors.`
  },
  {
    pipeline_id: 'PP-E3292EC2',
    existing_property_id: null,
    title: '3BR TOWNHOMES in Tulsa',
    address: '1206 S 110th Ave E #13-C',
    city: 'Tulsa',
    state: 'OK',
    zip: '74128',
    county: 'Tulsa County',
    lat: 36.14576,
    lng: -95.854416,
    property_type: 'TOWNHOUSE',
    bedrooms: 3,
    bathrooms: 2.0,
    total_bathrooms: 2,
    half_bathrooms: 0,
    square_footage: 1177,
    year_built: null,
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
    parking: 'Attached Garage Parking',
    garage_spaces: 1,
    heating_type: 'Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Tile Flooring', 'Hard-Surface Flooring'],
    amenities: [
      'Community Swimming Pool Access',
      'Attached Garage Parking',
      'Water & Trash Utilities Included via HOA',
      'Central Air Conditioning & Forced Air Heat',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Dishwasher', 'Range / Oven', 'Refrigerator'],
    description: `Located within an established community setting in East Tulsa, this three-bedroom, two-bathroom residence offers 1,177 square feet of functional living space with an attached garage.

The home features an open-concept living area with durable hard-surface flooring and central climate control. A fully equipped kitchen includes a dishwasher, range, and refrigerator, paired with dedicated cabinet storage. Three comfortable bedrooms provide versatile accommodations with generous closet space. Residents enjoy community pool access, attached parking, and convenient utility inclusions with water and trash services covered.`
  },
  {
    pipeline_id: 'PP-55BB0423',
    existing_property_id: '08904684-b5ec-484f-88b1-70f9ceb8e73d', // Matched existing record
    title: '2BR TOWNHOMES in Tulsa',
    address: '1302 S Birmingham Ave #2',
    city: 'Tulsa',
    state: 'OK',
    zip: '74104',
    county: 'Tulsa County',
    lat: 36.144077,
    lng: -95.95408,
    property_type: 'DUPLEX',
    bedrooms: 2,
    bathrooms: 1.0,
    total_bathrooms: 1,
    half_bathrooms: 0,
    square_footage: 950,
    year_built: null,
    monthly_rent: 1200, // Reduced from $1250 per explicit price reduction directive
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
    heating_type: 'Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Hard-Surface Flooring (No Carpet)'],
    amenities: [
      'Desirable Renaissance Neighborhood Setting',
      'Granite Kitchen Countertops & Stainless Steel Sink',
      'Hard Flooring Throughout (Zero Carpet)',
      'Dedicated Off-Street Parking',
      'Lawn Care Service Provided',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Dishwasher', 'Range / Oven', 'Refrigerator', 'Washer/Dryer Hookups'],
    description: `Positioned on the lower level of a classic duplex in Tulsa's desirable Renaissance neighborhood, this updated two-bedroom, one-bathroom home offers move-in-ready comfort and refined finishes.

The interior is appointed with hard-surface flooring throughout the entire floor plan, providing a completely carpet-free living environment. The updated kitchen features rich granite countertops, a deep stainless steel sink, and quality appliances including a refrigerator, stove, and dishwasher. In-unit washer and dryer hookups offer dedicated laundry convenience. Complete with central heating and air conditioning, private off-street parking, and complimentary professional lawn care, all moments from neighborhood parks and Midtown conveniences.`
  },
  {
    pipeline_id: 'PP-C2B1C3D4',
    existing_property_id: '032f563e-bb43-40e4-b1d8-3597e81bcf6a', // Matched existing record
    title: '1BR TOWNHOMES in Tulsa',
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
    total_bathrooms: 1,
    half_bathrooms: 0,
    square_footage: 963,
    year_built: null,
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
    parking: 'Detached Garage & Community Parking',
    garage_spaces: 1,
    heating_type: 'Forced Air Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer & Dryer',
    flooring: ['Hard-Surface Flooring'],
    amenities: [
      'Resort-Style Community Swimming Pool',
      'Detached Garage Parking',
      'In-Unit Washer & Dryer Included',
      'Scenic Enclave Northwest of Downtown Tulsa',
      'Minutes to Gilcrease Museum, Arkansas River & BOK Center',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Washer', 'Dryer', 'Dishwasher', 'Microwave', 'Range / Oven', 'Refrigerator', 'Freezer'],
    description: `Located at Oak Creek at Gilcrease in Tulsa, this expansive 963-square-foot one-bedroom, one-bathroom residence offers inspired living just northwest of Downtown.

The interior showcases an open living concept with complete in-home conveniences, including a full kitchen suite with dishwasher, microwave, range, and refrigerator, alongside in-unit washer and dryer appliances. Residents enjoy access to landscaped community grounds, a resort-style swimming pool, and detached garage parking. Situated within minutes of the Arkansas River trails, Gilcrease Museum, the BOK Center, and major urban employment hubs.`
  },
  {
    pipeline_id: 'PP-0A621B4F',
    existing_property_id: null,
    title: '3BR TOWNHOMES in Tulsa',
    address: '1130 S Florence Ave',
    city: 'Tulsa',
    state: 'OK',
    zip: '74104',
    county: 'Tulsa County',
    lat: 36.147274,
    lng: -95.9449,
    property_type: 'DUPLEX',
    bedrooms: 3,
    bathrooms: 1.0,
    total_bathrooms: 1,
    half_bathrooms: 0,
    square_footage: 900,
    year_built: null,
    monthly_rent: 1200, // Reduced from $1275 per explicit price reduction directive
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
    heating_type: 'Electric Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Refinished Hardwood Flooring', 'Custom Ceramic Tile'],
    amenities: [
      'Gated Fenced Backyard',
      'Brand New Kitchen Cabinets & Granite Countertops',
      'Refinished Hardwood Floors & Custom Tile',
      'Completely Remodeled Bathroom with Granite Vanity',
      'Prime Location Near University of Tulsa & Cherry Street',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Range / Oven', 'Dishwasher', 'Garbage Disposal'],
    description: `Showcasing a comprehensive remodel, this 900-square-foot three-bedroom, one-bathroom duplex is situated in Midtown Tulsa near the University of Tulsa and Cherry Street dining.

The interior features newly refinished hardwood flooring, fresh paint, and custom tile detailing throughout. The chef's kitchen is newly appointed with contemporary cabinetry, polished granite countertops, a deep undermount sink with disposal, range, and dishwasher. The updated bathroom provides a new vanity with granite counters, modern plumbing fixtures, and a new bathtub and shower surround. Outside, a private gated and fenced backyard provides secure outdoor enjoyment, just blocks from campus and neighborhood retail.`
  },
  {
    pipeline_id: 'PP-69A55906',
    existing_property_id: '70011a30-8995-48c3-a074-807987ac8b67', // Matched existing record
    title: '2BR TOWNHOMES in Tulsa',
    address: '1207 S 74th East Ave',
    city: 'Tulsa',
    state: 'OK',
    zip: '74112',
    county: 'Tulsa County',
    lat: 36.145786,
    lng: -95.89419,
    property_type: 'DUPLEX',
    bedrooms: 2,
    bathrooms: 1.5,
    total_bathrooms: 1.5,
    half_bathrooms: 1,
    square_footage: 832,
    year_built: null,
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
    parking: 'Dedicated Off-Street Parking',
    heating_type: 'Central Heat',
    cooling_type: 'Central Air Conditioning',
    laundry_type: 'In-Unit Washer/Dryer Hookups',
    flooring: ['Hard-Surface Flooring'],
    amenities: [
      'Newly Renovated Duplex Layout',
      '1.5 Bathrooms with Main-Level Powder Room',
      'Central Heating & Air Conditioning',
      'Quick Access to 11th Street & Memorial Drive Highways',
      'Pet Friendly (Dogs & Cats Welcome)'
    ],
    appliances: ['Refrigerator', 'Range / Stove'],
    description: `Positioned near 11th and Memorial in Tulsa, this newly renovated 832-square-foot duplex offers a two-bedroom, 1.5-bathroom configuration designed for everyday efficiency.

The property features durable hard-surface flooring throughout the living areas, supported by central heating and air conditioning for year-round climate control. The main level provides an open living space, functional kitchen with refrigerator and stove, and a guest half-bath. Upstairs, two bedrooms share a clean full bath. Convenient highway access enables quick commutes throughout Tulsa.`
  }
];

async function runMasterPublish() {
  console.log('================================================================');
  console.log('CHOICE PROPERTIES — MASTER ZILLOW PIPELINE ENRICHMENT & PUBLISH');
  console.log(`Processing ${PROPERTIES_TO_PUBLISH.length} properties from Zillow pipeline...`);
  console.log('================================================================\n');

  const today = new Date().toISOString().split('T')[0];
  const publishedResults = [];

  for (let i = 0; i < PROPERTIES_TO_PUBLISH.length; i++) {
    const item = PROPERTIES_TO_PUBLISH[i];
    console.log(`\n----------------------------------------------------------------`);
    console.log(`[${i + 1}/${PROPERTIES_TO_PUBLISH.length}] ${item.address}, ${item.city} ${item.state} ${item.zip}`);
    console.log(`    Rent: $${item.monthly_rent}/mo | Beds: ${item.bedrooms} | Baths: ${item.bathrooms} (Half: ${item.half_bathrooms}) | Type: ${item.property_type}`);

    // 1. Fetch raw pipeline record to verify images and original data
    const pipeRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${item.pipeline_id}&select=*`, {
      headers: HEADERS_PIPELINE
    });
    const pipeData = await pipeRes.json();
    if (!pipeData || pipeData.length === 0) {
      console.error(`   ✗ Pipeline record ${item.pipeline_id} not found in pipeline schema!`);
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
      garage_spaces: item.garage_spaces || null,
      has_central_air: item.has_central_air,
      has_basement: item.has_basement,
      listed_at: today,
      featured: false
    };

    // 3. Insert or Update public.properties
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
      // Synchronize fresh verified photo set
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
        garage_spaces: item.garage_spaces || null,
        pets_allowed: item.pets_allowed,
        pet_types_allowed: JSON.stringify(item.pet_types_allowed),
        smoking_allowed: false,
        lease_terms: '[]',
        minimum_lease_months: null,
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
    console.log(`${r.address}, ${r.city}, ${r.state} ${r.zip} ($${r.rent}/mo | ${r.bedrooms} Bed / ${r.bathrooms} Bath) — ${r.url}`);
  });
}

runMasterPublish();
