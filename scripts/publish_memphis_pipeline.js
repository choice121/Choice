import { CREDENTIALS_CONFIG } from '../credentials-config.mjs';

const SUPABASE_URL = CREDENTIALS_CONFIG.SUPABASE_URL;
const KEY = CREDENTIALS_CONFIG.SUPABASE_API_KEY;

const HEADERS = {
  'apikey': KEY,
  'Authorization': 'Bearer ' + KEY,
  'Content-Type': 'application/json'
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
  const state = String(p.state || 'tn').toLowerCase().slice(0, 2);
  const city = slugSeg(p.city);
  const beds = (p.bedrooms == null) ? 'home' : (Number(p.bedrooms) === 0 ? 'studio' : Number(p.bedrooms) + 'br');
  const rawType = String(p.property_type || '').toLowerCase().replace(/[\s_]+/g, '-');
  const typeMap = {
    'single-family': 'house', 'single_family': 'house',
    'townhomes': 'townhouse', 'townhome': 'townhouse',
    'condos': 'condo', 'apartment': 'apartment', 'house': 'house',
    'condo': 'condo', 'townhouse': 'townhouse', 'duplex': 'duplex',
    'studio': 'studio', 'multi-family': 'multi-family', 'mobile-home': 'mobile-home'
  };
  const type = typeMap[rawType] || rawType || 'house';
  return `/rent/${state}/${city}/${beds}-${type}-${id}/`;
}

const MEMPHIS_ENRICHMENTS = {
  'PP-AA9E92F9': {
    title: '3BR/1BA Single-Family Home in Memphis – $1400/mo',
    city: 'Memphis',
    state: 'TN',
    zip: '38105',
    property_type: 'SINGLE_FAMILY',
    monthly_rent: 1400,
    security_deposit: 1400,
    application_fee: 50,
    pets_allowed: true,
    smoking_allowed: false,
    minimum_lease_months: 12,
    parking: 'Driveway / Off-Street',
    has_basement: false,
    has_central_air: true,
    description: `Welcome to 891 Lane Ave — a charming 3-bedroom, 1-bathroom single-family home offering approximately 1,200 sq. ft. of comfortable living space in Memphis, TN.

This well-maintained residence features a functional single-story layout with bright, natural lighting throughout. Enjoy a welcoming living room, an eat-in kitchen with generous cabinet storage, and three comfortable bedrooms. The exterior offers a private backyard and off-street driveway parking. Conveniently located near downtown Memphis, medical centers, shopping, and major transit routes.

Home Features & Highlights:
• 3 Bedrooms, 1 Full Bathroom
• Open living room with natural light
• Functional kitchen with abundant cabinetry
• Private backyard space
• Off-street driveway parking
• Pet-friendly living (dogs and cats welcome)

Lease Terms:
• Monthly Rent: $1400
• Security Deposit: $1400 (equal to 1 month's rent)
• Application Fee: $50 per adult applicant
• 12-Month Lease Minimum

Your next home is waiting. Submit your rental application at Choice Properties to get started.`
  },
  'PP-BF971241': {
    title: '3BR/1BA Single-Family Home in Memphis – $1400/mo',
    city: 'Memphis',
    state: 'TN',
    zip: '38127',
    property_type: 'SINGLE_FAMILY',
    monthly_rent: 1400,
    security_deposit: 1400,
    application_fee: 50,
    pets_allowed: true,
    smoking_allowed: false,
    minimum_lease_months: 12,
    parking: 'Driveway / Off-Street',
    has_basement: false,
    has_central_air: true,
    description: `Welcome to 1473 Oberle Ave — a delightful and spacious 3-bedroom, 1-bathroom single-family residence offering 1,304 sq. ft. of comfortable living space in North Memphis, TN.

This home features a bright living room, dedicated dining area, and a fully equipped kitchen with range, vent hood, and dishwasher. Three generously sized bedrooms share a central full bathroom. Situated on a large lot with a private backyard ideal for outdoor activities, relaxation, and pets. Located close to local schools, parks, and commuter roadways.

Home Features & Highlights:
• 3 Bedrooms, 1 Full Bathroom
• Fully equipped kitchen with range and dishwasher
• Large private backyard on a generous lot
• Convenient driveway parking
• Central heating and cooling
• Pet-friendly living (dogs and cats welcome)

Lease Terms:
• Monthly Rent: $1400
• Security Deposit: $1400 (equal to 1 month's rent)
• Application Fee: $50 per adult applicant
• 12-Month Lease Minimum

Your next home is waiting. Submit your rental application at Choice Properties to get started.`
  },
  'PP-F10217F7': {
    title: '3BR/1BA Single-Family Home in Memphis – $1450/mo',
    city: 'Memphis',
    state: 'TN',
    zip: '38111',
    property_type: 'SINGLE_FAMILY',
    monthly_rent: 1450,
    security_deposit: 1450,
    application_fee: 50,
    pets_allowed: true,
    smoking_allowed: false,
    minimum_lease_months: 12,
    parking: 'Driveway / Off-Street',
    has_basement: false,
    has_central_air: true,
    description: `Welcome to 756 S Graham St — a beautifully appointed 3-bedroom, 1-bathroom home offering 1,163 sq. ft. of living space in desirable East Memphis / University area.

Featuring classic architectural charm paired with modern updates, this home offers hardwood flooring, a bright and open living area, and an efficient kitchen layout. Outside, you will find a fenced backyard and dedicated driveway parking. Prime location near the University of Memphis, Audubon Park, shopping, dining, and Interstate access.

Home Features & Highlights:
• 3 Bedrooms, 1 Full Bathroom
• Hardwood flooring and rich natural light
• Fully functional kitchen with plenty of storage
• Fenced backyard retreat
• Off-street driveway parking
• Convenient East Memphis / U of M location
• Pet-friendly living (dogs and cats welcome)

Lease Terms:
• Monthly Rent: $1450
• Security Deposit: $1450 (equal to 1 month's rent)
• Application Fee: $50 per adult applicant
• 12-Month Lease Minimum

Your next home is waiting. Submit your rental application at Choice Properties to get started.`
  },
  'PP-284456AA': {
    title: '3BR/2BA Single-Family Home in Memphis – $1450/mo',
    city: 'Memphis',
    state: 'TN',
    zip: '38108',
    property_type: 'SINGLE_FAMILY',
    monthly_rent: 1450,
    security_deposit: 1450,
    application_fee: 50,
    pets_allowed: true,
    smoking_allowed: false,
    minimum_lease_months: 12,
    parking: 'Driveway / Off-Street',
    has_basement: false,
    has_central_air: true,
    description: `Welcome to 970 Maple Dr — an exceptionally spacious 3-bedroom, 2-bathroom single-family residence offering 1,829 sq. ft. of expansive living space in Memphis, TN.

With multiple living areas, this floor plan provides outstanding flexibility for everyday living and entertaining. Features include a large family living room, formal dining area, and a fully equipped kitchen with ample counter workspace. The primary suite offers a private ensuite bath, while secondary bedrooms share a full hallway bath. Enjoy a large fenced yard and private driveway.

Home Features & Highlights:
• 3 Spacious Bedrooms, 2 Full Bathrooms (1,829 sq. ft.)
• Primary bedroom suite with private ensuite bathroom
• Multiple living areas and formal dining
• Large fenced backyard
• Dedicated off-street driveway parking
• Pet-friendly living (dogs and cats welcome)

Lease Terms:
• Monthly Rent: $1450
• Security Deposit: $1450 (equal to 1 month's rent)
• Application Fee: $50 per adult applicant
• 12-Month Lease Minimum

Your next home is waiting. Submit your rental application at Choice Properties to get started.`
  },
  'PP-E5BA107D': {
    title: '3BR/2BA Single-Family Home in Memphis – $1455/mo',
    city: 'Memphis',
    state: 'TN',
    zip: '38115',
    property_type: 'SINGLE_FAMILY',
    monthly_rent: 1455,
    security_deposit: 1455,
    application_fee: 50,
    pets_allowed: true,
    smoking_allowed: false,
    minimum_lease_months: 12,
    parking: 'Driveway / Off-Street',
    has_basement: false,
    has_central_air: true,
    description: `Welcome to 3542 E Regency Park Cir — a lovely 3-bedroom, 2-bathroom home offering 1,151 sq. ft. of comfortable living in Southeast Memphis, TN.

Tucked away on a quiet residential circle, this home features a bright living area, dedicated dining space, and a well-equipped kitchen. The primary suite includes a private bathroom, and the two additional bedrooms share a full bath. Outside, a private fenced yard and private driveway complete the home. Close to local shopping, dining, and Bill Morris Parkway (Hwy 385).

Home Features & Highlights:
• 3 Bedrooms, 2 Full Bathrooms
• Quiet residential circle location
• Private primary bedroom suite
• Fully fenced backyard
• Private driveway parking
• Central air conditioning and heating
• Pet-friendly living (dogs and cats welcome)

Lease Terms:
• Monthly Rent: $1455
• Security Deposit: $1455 (equal to 1 month's rent)
• Application Fee: $50 per adult applicant
• 12-Month Lease Minimum

Your next home is waiting. Submit your rental application at Choice Properties to get started.`
  },
  'PP-CCE3267F': {
    title: '3BR/2BA Single-Family Home in Memphis – $1475/mo',
    city: 'Memphis',
    state: 'TN',
    zip: '38128',
    property_type: 'SINGLE_FAMILY',
    monthly_rent: 1475,
    security_deposit: 1475,
    application_fee: 50,
    pets_allowed: true,
    smoking_allowed: false,
    minimum_lease_months: 12,
    parking: 'Driveway / Off-Street',
    has_basement: false,
    has_central_air: true,
    description: `Welcome to 4697 Grecco Dr — an impressive and spacious 3-bedroom, 2-bathroom home boasting 1,800 sq. ft. of living space in Northeast Memphis (Raleigh area).

This expansive home offers generous room sizes, an open-concept living and dining area, and a large kitchen with extensive counter space and cabinet storage. Bedrooms provide abundant closet space, while the private backyard offers room for recreation and outdoor entertaining. Situated with easy access to Austin Peay Hwy, I-40, and local shopping centers.

Home Features & Highlights:
• 3 Large Bedrooms, 2 Full Bathrooms (1,800 sq. ft.)
• Expansive living and entertainment spaces
• Modern kitchen layout with ample cabinetry
• Generous backyard with privacy
• Off-street driveway parking
• Pet-friendly living (dogs and cats welcome)

Lease Terms:
• Monthly Rent: $1475
• Security Deposit: $1475 (equal to 1 month's rent)
• Application Fee: $50 per adult applicant
• 12-Month Lease Minimum

Your next home is waiting. Submit your rental application at Choice Properties to get started.`
  },
  'PP-BFAAB89E': {
    title: '3BR/2BA Single-Family Home in Memphis – $1495/mo',
    city: 'Memphis',
    state: 'TN',
    zip: '38109',
    property_type: 'SINGLE_FAMILY',
    monthly_rent: 1495,
    security_deposit: 1495,
    application_fee: 50,
    pets_allowed: true,
    smoking_allowed: false,
    minimum_lease_months: 12,
    parking: 'Driveway / Off-Street',
    has_basement: false,
    has_central_air: true,
    description: `Welcome to 736 King Ave — a charming 3-bedroom, 2-bathroom single-family residence offering 1,084 sq. ft. of modern, low-maintenance living in South Memphis, TN.

This move-in-ready home features a welcoming floor plan with bright living spaces, an updated kitchen with solid cabinetry, and durable flooring throughout. The primary bedroom features its own private bathroom, while two additional bedrooms share a full hall bath. Enjoy a private backyard and convenient driveway parking. Minutes from I-55, Downtown Memphis, and local parks.

Home Features & Highlights:
• 3 Bedrooms, 2 Full Bathrooms
• Bright living room with low-maintenance flooring
• Updated kitchen with generous cabinet storage
• Private primary ensuite bathroom
• Dedicated driveway parking
• Fenced backyard space
• Pet-friendly living (dogs and cats welcome)

Lease Terms:
• Monthly Rent: $1495
• Security Deposit: $1495 (equal to 1 month's rent)
• Application Fee: $50 per adult applicant
• 12-Month Lease Minimum

Your next home is waiting. Submit your rental application at Choice Properties to get started.`
  },
  'PP-DD5D86B4': {
    title: '3BR/2BA Brick Home in Memphis w/ Garage – $1495/mo',
    city: 'Memphis',
    state: 'TN',
    zip: '38116',
    property_type: 'SINGLE_FAMILY',
    monthly_rent: 1495,
    security_deposit: 1495,
    application_fee: 50,
    pets_allowed: true,
    smoking_allowed: false,
    minimum_lease_months: 12,
    parking: 'Attached Garage + Driveway',
    has_basement: false,
    has_central_air: true,
    description: `Welcome to 4398 Ridgewood Rd — a warm and inviting 3-bedroom, 2-bathroom all-brick home offering 1,607 sq. ft. of versatile living space in Memphis, TN (Whitehaven area).

This single-story residence features multiple living areas including a formal front living room, a formal dining room, and a bonus den off the kitchen ideal for a home office or media room. The U-shaped kitchen offers ample cabinetry and counter space. The primary bedroom serves as a private retreat with its own ensuite bath featuring a walk-in shower. Outside, enjoy an enclosed back porch, fenced yard, storage shed, and attached garage.

Home Features & Highlights:
• 3 Bedrooms, 2 Full Bathrooms (1,607 sq. ft.)
• Formal living room, dining room, plus bonus den
• Primary suite with private ensuite walk-in shower
• Enclosed back porch and fenced backyard with storage shed
• Attached garage plus side driveway parking
• Central air conditioning and heating
• Pet-friendly living (dogs and cats welcome)

Lease Terms:
• Monthly Rent: $1495
• Security Deposit: $1495 (equal to 1 month's rent)
• Application Fee: $50 per adult applicant
• 12-Month Lease Minimum

Your next home is waiting. Submit your rental application at Choice Properties to get started.`
  },
  'PP-60406CCF': {
    title: '3BR/2BA Single-Family Home in Bartlett / Memphis – $1495/mo',
    city: 'Memphis',
    state: 'TN',
    zip: '38133',
    property_type: 'SINGLE_FAMILY',
    monthly_rent: 1495,
    security_deposit: 1495,
    application_fee: 50,
    pets_allowed: true,
    smoking_allowed: false,
    minimum_lease_months: 12,
    parking: 'Carport + Driveway',
    has_basement: false,
    has_central_air: true,
    description: `Welcome to 7691 Mesa Dr — a beautifully updated 3-bedroom, 2-bathroom home offering 1,164 sq. ft. of bright living space in the Bartlett / Northeast Memphis area (38133).

Freshly painted throughout, this home features modern flooring in the primary bedroom, a spacious living area, and a fully equipped kitchen with appliances included. Exterior amenities include a covered carport, storage cabin, and a fully fenced backyard perfect for outdoor recreation and relaxation. Located conveniently near Bartlett schools, shopping centers, and parks.

Home Features & Highlights:
• 3 Bedrooms, 2 Full Bathrooms
• Freshly painted interior with updated flooring
• Fully equipped kitchen with appliances
• Covered carport and private driveway
• Outdoor storage cabin
• Fully fenced backyard
• Pet-friendly living (dogs and cats welcome)

Lease Terms:
• Monthly Rent: $1495
• Security Deposit: $1495 (equal to 1 month's rent)
• Application Fee: $50 per adult applicant
• 12-Month Lease Minimum

Your next home is waiting. Submit your rental application at Choice Properties to get started.`
  },
  'PP-1B07E841': {
    title: '3BR/2BA Home in Memphis w/ Garage & Fireplace – $1495/mo',
    city: 'Memphis',
    state: 'TN',
    zip: '38141',
    property_type: 'SINGLE_FAMILY',
    monthly_rent: 1495,
    security_deposit: 1495,
    application_fee: 50,
    pets_allowed: true,
    smoking_allowed: false,
    minimum_lease_months: 12,
    parking: 'Attached Garage + Driveway',
    has_basement: false,
    has_central_air: true,
    description: `Welcome to 6326 Valleydale Dr — a standout 3-bedroom, 2-bathroom single-family residence offering 1,371 sq. ft. of polished living space near Southwind in Memphis, TN (38141).

The interior makes a stunning impression with soaring vaulted ceilings, rich hardwood flooring, and a cozy centerpiece fireplace in the expansive main living room. The open kitchen is equipped with durable tile flooring, extensive countertop workspace, and rich cabinetry, alongside a dedicated formal dining area. Includes a secure 1-car garage, laundry closet with full hookups, and a spacious fully fenced backyard.

Home Features & Highlights:
• 3 Bedrooms, 2 Full Bathrooms (1,371 sq. ft.)
• Soaring vaulted ceilings and rustic centerpiece fireplace
• Chef's kitchen with tile flooring and adjacent formal dining
• Secure 1-car attached garage and private driveway
• Dedicated laundry area with hookups
• Private, fully fenced-in backyard retreat
• Pet-friendly living (dogs and cats welcome)

Lease Terms:
• Monthly Rent: $1495
• Security Deposit: $1495 (equal to 1 month's rent)
• Application Fee: $50 per adult applicant
• 12-Month Lease Minimum

Your next home is waiting. Submit your rental application at Choice Properties to get started.`
  },
  'PP-BF4C574D': {
    title: '2BR/2BA Single-Family Home in Memphis – $1500/mo',
    city: 'Memphis',
    state: 'TN',
    zip: '38107',
    property_type: 'SINGLE_FAMILY',
    monthly_rent: 1500,
    security_deposit: 1500,
    application_fee: 50,
    pets_allowed: true,
    smoking_allowed: false,
    minimum_lease_months: 12,
    parking: 'Driveway / Off-Street',
    has_basement: false,
    has_central_air: true,
    description: `Welcome to 1477 Lyndale Ave — an attractive and spacious 2-bedroom, 2-bathroom home offering 1,492 sq. ft. of living space in Memphis, TN (38107).

With generous room proportions, this residence features a large living and entertaining area, a well-configured kitchen with ample cabinetry, and two full private bathroom suites. Located in a convenient neighborhood with rapid access to Downtown Memphis, the Medical District, St. Jude, and major roadways.

Home Features & Highlights:
• 2 Spacious Bedrooms, 2 Full Bathrooms (1,492 sq. ft.)
• Expansive living room with abundant natural light
• Functional kitchen with generous counter and storage space
• Dual full bathrooms offering great privacy
• Off-street driveway parking
• Fenced backyard area
• Pet-friendly living (dogs and cats welcome)

Lease Terms:
• Monthly Rent: $1500
• Security Deposit: $1500 (equal to 1 month's rent)
• Application Fee: $50 per adult applicant
• 12-Month Lease Minimum

Your next home is waiting. Submit your rental application at Choice Properties to get started.`
  },
  'PP-C7B739A2': {
    title: '3BR/2BA Single-Family Home in Memphis – $1500/mo',
    city: 'Memphis',
    state: 'TN',
    zip: '38109',
    property_type: 'SINGLE_FAMILY',
    monthly_rent: 1500,
    security_deposit: 1500,
    application_fee: 50,
    pets_allowed: true,
    smoking_allowed: false,
    minimum_lease_months: 12,
    parking: 'Driveway / Off-Street',
    has_basement: false,
    has_central_air: true,
    description: `Welcome to 523 Shofner Dr — a beautifully renovated 3-bedroom, 2-bathroom home offering 1,371 sq. ft. of living space in South Memphis, TN.

This versatile property features separate formal Living Room, Dining Room, and cozy family Den. Highlights include classic hardwood flooring, brand-new carpeting in bedrooms, and a fully renovated primary ensuite bathroom. Enjoy a serene, spacious backyard perfect for entertaining and weekend relaxation, alongside dedicated driveway parking.

Home Features & Highlights:
• 3 Bedrooms, 2 Full Bathrooms
• Separate Living Room, Dining Room, and Family Den
• Hardwood flooring and renovated primary ensuite bath
• Refrigerator and in-home laundry appliances included
• Serene and spacious private backyard
• Dedicated off-street driveway parking
• Pet-friendly living (dogs and cats welcome)

Lease Terms:
• Monthly Rent: $1500
• Security Deposit: $1500 (equal to 1 month's rent)
• Application Fee: $50 per adult applicant
• 12-Month Lease Minimum

Your next home is waiting. Submit your rental application at Choice Properties to get started.`
  },
  'PP-DEFFFE19': {
    title: '3BR/2BA Renovated Home in Memphis w/ Parking Pad – $1500/mo',
    city: 'Memphis',
    state: 'TN',
    zip: '38107',
    property_type: 'SINGLE_FAMILY',
    monthly_rent: 1500,
    security_deposit: 1500,
    application_fee: 50,
    pets_allowed: true,
    smoking_allowed: false,
    minimum_lease_months: 12,
    parking: 'Private Parking Pad + Street',
    has_basement: false,
    has_central_air: true,
    description: `Welcome to 949 Kney St — a fully renovated 3-bedroom, 2-bathroom residence offering approximately 1,668 sq. ft. of high-ceilinged modern living in Memphis, TN (38107).

Featuring a bright open-concept layout with living and dining combination, a dedicated office nook, and a separate laundry room with generous storage. Outside, relax on the southern-style front porch or utilize the private rear parking pad. Superb location within walking distance of the Northside Square development and just 5 minutes to St. Jude and Downtown Memphis.

Home Features & Highlights:
• 3 Bedrooms, 2 Full Bathrooms (1,668 sq. ft.)
• Fully renovated interior with soaring high ceilings
• Open-concept living and dining with home office nook
• Separate dedicated laundry room
• Southern-style front covered porch
• Private rear parking pad plus street parking
• Walking distance to Northside Square, 5 minutes to St. Jude
• Pet-friendly living (dogs and cats welcome)

Lease Terms:
• Monthly Rent: $1500
• Security Deposit: $1500 (equal to 1 month's rent)
• Application Fee: $50 per adult applicant
• 12-Month Lease Minimum

Your next home is waiting. Submit your rental application at Choice Properties to get started.`
  }
};

async function publishPipelineProperty(pipelineId) {
  console.log(`\n======================================================`);
  console.log(`Publishing Memphis pipeline property: ${pipelineId}`);

  const listRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pipeline_list`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ p_status: 'all', p_limit: 2000, p_offset: 0 })
  });
  const list = await listRes.json();
  const p = list.find(item => item.id === pipelineId);

  if (!p) {
    throw new Error(`Pipeline record ${pipelineId} not found`);
  }

  console.log(`Found: ${p.address}, ${p.city}, ${p.state} ${p.zip}`);

  const patch = MEMPHIS_ENRICHMENTS[pipelineId];
  if (patch) {
    console.log('Saving cleaned patch to pipeline...');
    const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pipeline_save`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ p_id: p.id, p_patch: patch })
    });
    const saveData = await saveRes.json();
    if (!saveData.ok) {
      throw new Error(`Failed to save patch: ${JSON.stringify(saveData)}`);
    }
  }

  console.log('Calling pipeline_publish RPC...');
  const pubRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pipeline_publish`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ p_id: p.id, p_landlord_id: null })
  });
  const pubData = await pubRes.json();

  if (!pubData.ok || !pubData.choice_property_id) {
    throw new Error(`Publish RPC failed for ${p.id}: ${JSON.stringify(pubData)}`);
  }

  const choiceId = pubData.choice_property_id;
  console.log(`Published to properties table with ID: ${choiceId}`);

  const todayStr = new Date().toISOString().split('T')[0];
  await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${encodeURIComponent(choiceId)}`, {
    method: 'PATCH',
    headers: HEADERS,
    body: JSON.stringify({
      status: 'active',
      listed_at: todayStr
    })
  });

  let rawImages = [];
  try {
    rawImages = typeof p.original_image_urls === 'string' ? JSON.parse(p.original_image_urls) : p.original_image_urls;
  } catch (e) {
    rawImages = [];
  }

  if (rawImages && rawImages.length > 0) {
    console.log(`Inserting ${rawImages.length} ImageKit photos into property_photos...`);
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
        display_order: idx,
        is_hero: idx === 0,
        watermark_status: 'pending',
        alt_text: `${p.address}, Memphis TN - Photo ${idx + 1}`
      };
    });

    await fetch(`${SUPABASE_URL}/rest/v1/property_photos`, {
      method: 'POST',
      headers: { ...HEADERS, 'Prefer': 'return=minimal' },
      body: JSON.stringify(photoRows)
    });
  }

  const merged = { ...p, ...(patch || {}), id: choiceId };
  const canonicalPath = buildCanonicalUrl(merged);
  const directPath = `/property.html?id=${choiceId}`;

  return {
    pipelineId: p.id,
    choicePropertyId: choiceId,
    title: merged.title,
    address: `${merged.address}, ${merged.city}, ${merged.state} ${merged.zip}`,
    monthlyRent: merged.monthly_rent,
    bedrooms: merged.bedrooms,
    bathrooms: merged.bathrooms,
    sqft: merged.square_footage,
    photoCount: rawImages ? rawImages.length : 0,
    canonicalUrl: `https://choice-properties-site.pages.dev${canonicalPath}`,
    directUrl: `https://choice-properties-site.pages.dev${directPath}`
  };
}

async function main() {
  const idsToPublish = [
    'PP-AA9E92F9', 'PP-BF971241', 'PP-F10217F7', 'PP-284456AA',
    'PP-E5BA107D', 'PP-CCE3267F', 'PP-BFAAB89E', 'PP-DD5D86B4',
    'PP-60406CCF', 'PP-1B07E841', 'PP-BF4C574D', 'PP-C7B739A2', 'PP-DEFFFE19'
  ];

  const results = [];
  for (const id of idsToPublish) {
    try {
      const res = await publishPipelineProperty(id);
      results.push(res);
    } catch (err) {
      console.error(`Error publishing ${id}:`, err);
    }
  }

  console.log('\n======================================================');
  console.log(`SUCCESSFULLY PUBLISHED ${results.length} PROPERTIES:`);
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
