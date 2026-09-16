// ============================================================
// Choice Properties — Update & Audit Columbus 15 Batch
// Fully enriches and synchronizes all 15 Columbus 2b/2ba & 3b/2ba properties.
// Enforces strict compliance:
//  - 0 prohibited phrases (no "Welcome to", no "Security Deposit" in desc, no lease terms)
//  - security_deposit = monthly_rent in DB
//  - application_fee = 50 in DB
//  - pets_allowed = true in DB
//  - lease_terms = null, minimum_lease_months = null
//  - smoking_allowed = null
// ============================================================

import { CREDENTIALS_CONFIG } from '../credentials-config.mjs';

const SUPABASE_URL = CREDENTIALS_CONFIG.SUPABASE_URL;
const SERVICE_KEY = CREDENTIALS_CONFIG.SUPABASE_API_KEY;

const updates = [
  {
    id: "9b1c0e4f-662e-4c40-ba73-c9265e9d81b0",
    title: "2 Bed / 2 Bath Townhouse in Franklinton – $1,125/mo",
    address: "186 W Park Ave #186",
    city: "Columbus",
    state: "OH",
    zip: "43223",
    bedrooms: 2,
    bathrooms: 2,
    square_footage: 1100,
    monthly_rent: 1125,
    security_deposit: 1125,
    application_fee: 50,
    property_type: "TOWNHOMES",
    parking: "Dedicated Off-Street Parking",
    pets_allowed: true,
    pet_types_allowed: ["Dogs", "Cats"],
    lease_terms: null,
    minimum_lease_months: null,
    smoking_allowed: null,
    description: "Positioned in Columbus's historic Franklinton neighborhood, this two-story brick townhome offers a smart multi-level design with two full bathrooms and two well-proportioned bedrooms. The main level centers on a sunlit living room featuring resilient wood-style flooring that flows directly toward an efficient kitchen equipped with an electric range, full refrigerator, dishwasher, and ample counter space.\n\nBoth bedrooms reside on the upper floor, each paired with substantial closet space and easy access to a full modern bath. Dedicated off-street parking behind the building eliminates street parking worries, while in-unit washer and dryer connections add everyday utility. Located just minutes from the vibrant Franklinton Arts District, COSI, and downtown Columbus riverfront trails, this residence pairs neighborhood character with swift highway connections via I-70 and SR-315."
  },
  {
    id: "eb37fed5-24fc-4e88-a32b-c088bfad94ac",
    title: "2 Bed / 2 Bath Townhouse in Lincoln Village – $1,140/mo",
    address: "1133 McCarley Dr E #1133",
    city: "Columbus",
    state: "OH",
    zip: "43228",
    bedrooms: 2,
    bathrooms: 2,
    square_footage: 1350,
    monthly_rent: 1140,
    security_deposit: 1140,
    application_fee: 50,
    property_type: "TOWNHOMES",
    parking: "Assigned Parking Space",
    pets_allowed: true,
    pet_types_allowed: ["Dogs", "Cats"],
    lease_terms: null,
    minimum_lease_months: null,
    smoking_allowed: null,
    description: "Offering generous space across multiple finished levels, this west Columbus townhome delivers 1,350 square feet of comfortable living. An open-concept main floor features a bright living room, dedicated dining area, and a functional galley kitchen complete with range, refrigerator, dishwasher, and breakfast bar seating.\n\nA finished lower level provides flexible bonus square footage ideal for a home office, recreation room, or quiet lounge. Upstairs, two private bedrooms provide peaceful retreats alongside two full ceramic-tiled bathrooms. Sliding glass doors open to a private rear patio overlooking shared green space, complemented by assigned off-street parking and central air conditioning. Situated conveniently near West Broad Street and I-270, shopping, dining, and transit options remain readily accessible."
  },
  {
    id: "bbeb79ff-de4e-4d4e-abd1-1841207ecbea",
    title: "2 Bed / 2 Bath Single-Family House in Merion Village – $1,150/mo",
    address: "550 Sheldon Ave",
    city: "Columbus",
    state: "OH",
    zip: "43207",
    bedrooms: 2,
    bathrooms: 2,
    square_footage: 1180,
    monthly_rent: 1150,
    security_deposit: 1150,
    application_fee: 50,
    property_type: "SINGLE_FAMILY",
    parking: "Detached Garage & Driveway",
    pets_allowed: true,
    pet_types_allowed: ["Dogs", "Cats"],
    lease_terms: null,
    minimum_lease_months: null,
    smoking_allowed: null,
    description: "A covered front porch introduces this standalone South Side single-family home situated near Merion Village and German Village amenities. The interior showcases restored hardwood flooring throughout the primary living room and dining room, complemented by neutral paint tones and classic architectural woodwork.\n\nThe updated kitchen features stone-look countertops, generous oak cabinetry, a gas range, dishwasher, and stainless steel refrigerator. Two comfortable bedrooms and two full bathrooms ensure privacy and convenience. A full unfinished basement provides abundant dry storage and washer/dryer hookups. Out back, a private fenced yard and detached garage offer secure parking and outdoor space, all within walking distance of Schiller Park and neighborhood cafes."
  },
  {
    id: "2a476368-e567-4f2d-b393-e2793516e98d",
    title: "2 Bed / 2 Bath Townhouse in Northwest Columbus – $1,165/mo",
    address: "1762 Queensbridge Dr #1",
    city: "Columbus",
    state: "OH",
    zip: "43235",
    bedrooms: 2,
    bathrooms: 2,
    square_footage: 1220,
    monthly_rent: 1165,
    security_deposit: 1165,
    application_fee: 50,
    property_type: "TOWNHOMES",
    parking: "Reserved Parking Space",
    pets_allowed: true,
    pet_types_allowed: ["Dogs", "Cats"],
    lease_terms: null,
    minimum_lease_months: null,
    smoking_allowed: null,
    description: "Set within a quiet residential enclave in Northwest Columbus, this 1,220-square-foot townhome is highlighted by dual primary bedroom suites, each accompanied by its own private full bathroom and walk-in wardrobe. The main floor opens to an expansive great room with wood-laminate flooring and a decorative corner hearth.\n\nAdjacent to the dining alcove, the kitchen offers clean white cabinetry, modern appliances including a dishwasher and disposal, and direct access to an enclosed private patio for morning coffee or outdoor dining. Additional conveniences include main-level laundry connections, energy-efficient heat pump climate control, and reserved parking. Bethel Road retail, Olentangy Trail recreation, and major commuter arteries including SR-315 are only moments away."
  },
  {
    id: "4a27a716-4922-488e-8f2d-35001d86516f",
    title: "2 Bed / 2 Bath Townhouse in King-Lincoln District – $1,175/mo",
    address: "342 Taylor Ave",
    city: "Columbus",
    state: "OH",
    zip: "43203",
    bedrooms: 2,
    bathrooms: 2,
    square_footage: 1400,
    monthly_rent: 1175,
    security_deposit: 1175,
    application_fee: 50,
    property_type: "TOWNHOMES",
    parking: "Off-Street Parking Pad",
    pets_allowed: true,
    pet_types_allowed: ["Dogs", "Cats"],
    lease_terms: null,
    minimum_lease_months: null,
    smoking_allowed: null,
    description: "Characterized by exposed brick accent walls and soaring ceilings, this King-Lincoln district townhome combines historic urban texture with modern renovations. The spacious main floor accommodates both generous seating and dining arrangements, centered around an eat-in kitchen with custom prep island, stainless steel appliances, and contemporary pendant lighting.\n\nTwo full bathrooms feature updated vanities and subway tile surrounds, serving two large upper-level bedrooms filled with natural light from tall double-hung windows. A dedicated basement room houses laundry connections and extra storage capacity. Outside, a private rear courtyard and dedicated parking pad provide practical urban convenience, with Franklin Park Conservatory and King Arts Complex just blocks away."
  },
  {
    id: "efe77375-f43d-425f-b83d-d417a46556ff",
    title: "3 Bed / 2 Bath Single-Family House in East Franklinton – $1,180/mo",
    address: "33 S Cypress Ave",
    city: "Columbus",
    state: "OH",
    zip: "43222",
    bedrooms: 3,
    bathrooms: 2,
    square_footage: 1280,
    monthly_rent: 1180,
    security_deposit: 1180,
    application_fee: 50,
    property_type: "SINGLE_FAMILY",
    parking: "Off-Street Parking",
    pets_allowed: true,
    pet_types_allowed: ["Dogs", "Cats"],
    lease_terms: null,
    minimum_lease_months: null,
    smoking_allowed: null,
    description: "Detached single-family living in East Franklinton is showcased at this three-bedroom, two-full-bathroom residence. A classic covered front porch greets visitors, opening to a bright living area anchored by durable plank flooring and oversized replacement windows that maximize daylight.\n\nThe modern kitchen provides clean prep surfaces, an electric range, full-size refrigerator, and pantry storage. Three separate bedrooms offer versatile arrangements for family members, roommates, or dedicated workspace, supported by two complete bathrooms on separate levels. A private fenced backyard provides open outdoor area, while off-street parking accommodates vehicles effortlessly. The Scioto Mile, downtown business district, and neighborhood art galleries are all easily reached."
  },
  {
    id: "b850a9ac-f6ed-4bbe-97bf-175e94e1d543",
    title: "3 Bed / 2 Bath Single-Family House in Hilltop – $1,185/mo",
    address: "510 Hilltonia Ave",
    city: "Columbus",
    state: "OH",
    zip: "43223",
    bedrooms: 3,
    bathrooms: 2,
    square_footage: 1320,
    monthly_rent: 1185,
    security_deposit: 1185,
    application_fee: 50,
    property_type: "SINGLE_FAMILY",
    parking: "Detached Garage & Long Driveway",
    pets_allowed: true,
    pet_types_allowed: ["Dogs", "Cats"],
    lease_terms: null,
    minimum_lease_months: null,
    smoking_allowed: null,
    description: "Situated along a tree-lined residential street in the Hilltop neighborhood, this freestanding three-bedroom home features 1,320 square feet of well-maintained living area. The entry opens to a large family room with warm wood flooring that transitions seamlessly to a family dining room.\n\nThe functional kitchen is equipped with updated counters, a gas cooking range, refrigerator, and dishwasher. Two full bathrooms prevent morning routines from backing up, serving three dedicated bedrooms with ample closet space. Downstairs, a full basement offers extensive workshop or storage options alongside laundry hookups. A detached garage, private concrete driveway, and grassy fenced backyard round out the property, with Westgate Park and local schools nearby."
  },
  {
    id: "228f96b8-954b-4005-afbc-75cb479c2645",
    title: "2 Bed / 2 Bath Single-Family House near Bexley – $1,190/mo",
    address: "2725 Allegheny Ave",
    city: "Columbus",
    state: "OH",
    zip: "43209",
    bedrooms: 2,
    bathrooms: 2,
    square_footage: 1150,
    monthly_rent: 1190,
    security_deposit: 1190,
    application_fee: 50,
    property_type: "SINGLE_FAMILY",
    parking: "Private Driveway & Carport",
    pets_allowed: true,
    pet_types_allowed: ["Dogs", "Cats"],
    lease_terms: null,
    minimum_lease_months: null,
    smoking_allowed: null,
    description: "Located along the Bexley corridor in East Columbus, this single-story home delivers modern finishes throughout an easy-to-navigate floor plan. The central kitchen features quartz countertops, classic tiled backsplash, stainless steel appliances, and crisp white cabinetry with brushed nickel hardware.\n\nAn enclosed three-season sunroom extends off the main living room, offering an inviting space for relaxation overlooking the level, fenced backyard. Two quiet bedrooms share two full bathrooms, including a primary en-suite with walk-in shower. A private driveway and covered carport provide protected parking. Commuters enjoy rapid access to Main Street, Capital University, and I-70 for direct routes into central Columbus."
  },
  {
    id: "79b78097-af70-42ea-b0be-e9290995b86c",
    title: "3 Bed / 2 Bath Single-Family House in Northeast Columbus – $1,195/mo",
    address: "1590 Vendome Dr S",
    city: "Columbus",
    state: "OH",
    zip: "43219",
    bedrooms: 3,
    bathrooms: 2,
    square_footage: 1450,
    monthly_rent: 1195,
    security_deposit: 1195,
    application_fee: 50,
    property_type: "SINGLE_FAMILY",
    parking: "Attached 1-Car Garage & Driveway",
    pets_allowed: true,
    pet_types_allowed: ["Dogs", "Cats"],
    lease_terms: null,
    minimum_lease_months: null,
    smoking_allowed: null,
    description: "This Northeast Columbus multi-level residence provides 1,450 square feet of thoughtfully separated living zones. The main tier holds a bright living room and kitchen complete with gas range, refrigerator, dishwasher, and dining nook.\n\nThe lower walk-out level features an expansive secondary living area, full bathroom, and dedicated laundry room, creating privacy and functional flexibility. Upstairs, three bedrooms feature hardwood flooring and closet organizers, adjacent to a full ceramic-tile bathroom. An attached single-car garage and concrete driveway handle vehicle storage, while the walk-out opens to an elevated wooden deck overlooking an expansive backyard. Easton Town Center and John Glenn International Airport are both within a short drive."
  },
  {
    id: "64a3944d-63d6-421d-9772-fdc6f58dbe34",
    title: "3 Bed / 2 Bath Single-Family House in South Columbus – $1,200/mo",
    address: "4900 Kresge Dr",
    city: "Columbus",
    state: "OH",
    zip: "43232",
    bedrooms: 3,
    bathrooms: 2,
    square_footage: 1380,
    monthly_rent: 1200,
    security_deposit: 1200,
    application_fee: 50,
    property_type: "SINGLE_FAMILY",
    parking: "Off-Street Concrete Driveway",
    pets_allowed: true,
    pet_types_allowed: ["Dogs", "Cats"],
    lease_terms: null,
    minimum_lease_months: null,
    smoking_allowed: null,
    description: "Classic single-story ranch architecture highlights this three-bedroom, two-bathroom detached home in southeast Columbus. The front living room receives abundant western exposure through large picture windows, transitioning into a spacious eat-in kitchen with solid cabinetry, full appliance package, and backyard garden views.\n\nThree well-proportioned bedrooms include a primary suite with dedicated attached bath, while a second full bathroom serves the hallway. A full unfinished basement extends under the entire footprint of the home, providing enormous storage space and laundry connections. Outside, a wide concrete driveway leads to a level, tree-bordered backyard ideal for outdoor activities. Quick access to I-70 and I-270 makes regional commutes straightforward."
  },
  {
    id: "e6c2b405-ed54-4e5b-b44f-185ba81a902b",
    title: "3 Bed / 2 Bath Single-Family House in Olde Towne East – $1,170/mo",
    address: "422 Wilson Ave",
    city: "Columbus",
    state: "OH",
    zip: "43205",
    bedrooms: 3,
    bathrooms: 2,
    square_footage: 1520,
    monthly_rent: 1170,
    security_deposit: 1170,
    application_fee: 50,
    property_type: "SINGLE_FAMILY",
    parking: "Off-Street Rear Parking Pad",
    pets_allowed: true,
    pet_types_allowed: ["Dogs", "Cats"],
    lease_terms: null,
    minimum_lease_months: null,
    smoking_allowed: null,
    description: "Distinguished by historic brick construction and generous 1,520-square-foot dimensions, this Olde Towne East single-family residence pairs architectural heritage with updated interior amenities. High ceilings and hardwood flooring characterize the formal living and dining spaces, complemented by original trim work.\n\nThe kitchen has been updated with stone countertops, gas range, refrigerator, dishwasher, and contemporary cabinetry. Three second-floor bedrooms offer substantial floor area and closet capacity, supported by two fully updated bathrooms with tile tub-surrounds. An upper-level laundry closet adds daily convenience. A private off-street parking pad sits behind the home, positioned moments from Nationwide Children's Hospital and downtown employment centers."
  },
  {
    id: "71747f01-226a-463f-b48e-320a6eb1330c",
    title: "2 Bed / 2 Bath Single-Family House near Grandview – $1,160/mo",
    address: "1303 Elmwood Ave",
    city: "Columbus",
    state: "OH",
    zip: "43212",
    bedrooms: 2,
    bathrooms: 2,
    square_footage: 1200,
    monthly_rent: 1160,
    security_deposit: 1160,
    application_fee: 50,
    property_type: "SINGLE_FAMILY",
    parking: "Private Driveway",
    pets_allowed: true,
    pet_types_allowed: ["Dogs", "Cats"],
    lease_terms: null,
    minimum_lease_months: null,
    smoking_allowed: null,
    description: "Positioned in the desirable Fifth by Northwest corridor adjacent to Grandview Heights, this freestanding two-bedroom home provides 1,200 square feet of comfortable residential living. Refinished oak hardwood flooring runs through the central living room and formal dining room.\n\nThe kitchen is equipped with gas cooking, refrigerator, dishwasher, and pantry storage. A screened three-season side porch creates a peaceful spot for fresh air throughout the warmer months. Two full bathrooms serve the two bedrooms, while a full basement offers dry storage and laundry hookups. A private concrete driveway provides off-street parking, with Grandview Avenue restaurants, coffee houses, and local parks just a brief stroll away."
  },
  {
    id: "8124c46c-70e2-4fb3-a59e-0942c402ed21",
    title: "3 Bed / 2 Bath Single-Family House in Clintonville – $1,155/mo",
    address: "557 E Royal Forest Blvd",
    city: "Columbus",
    state: "OH",
    zip: "43214",
    bedrooms: 3,
    bathrooms: 2,
    square_footage: 1460,
    monthly_rent: 1155,
    security_deposit: 1155,
    application_fee: 50,
    property_type: "SINGLE_FAMILY",
    parking: "Detached Garage & Driveway",
    pets_allowed: true,
    pet_types_allowed: ["Dogs", "Cats"],
    lease_terms: null,
    minimum_lease_months: null,
    smoking_allowed: null,
    description: "Nestled along a quiet residential street in Columbus's Beechwold / Clintonville neighborhood, this three-bedroom single-family residence features a handsome brick facade and 1,460 square feet of finished space. The main living room centers on a decorative fireplace hearth framed by refinished hardwood floors.\n\nAn updated kitchen offers granite countertops, gas cooking range, stainless dishwasher, and full refrigerator, opening to a sunny breakfast room. Three restful bedrooms and two full ceramic bathrooms accommodate family or shared living arrangements. A full basement provides extensive storage and laundry facilities. The deep rear yard includes a paved patio and detached garage, within easy reach of the Olentangy Trail and High Street transit lines."
  },
  {
    id: "9e9a2bac-fbd9-48b9-91fb-271f60f2bf29",
    title: "3 Bed / 2 Bath Single-Family House in Franklinton Arts District – $1,195/mo",
    address: "550 W Town St Unit 550",
    city: "Columbus",
    state: "OH",
    zip: "43215",
    bedrooms: 3,
    bathrooms: 2,
    square_footage: 1360,
    monthly_rent: 1195,
    security_deposit: 1195,
    application_fee: 50,
    property_type: "SINGLE_FAMILY",
    parking: "Dedicated Off-Street Parking Pad",
    pets_allowed: true,
    pet_types_allowed: ["Dogs", "Cats"],
    lease_terms: null,
    minimum_lease_months: null,
    smoking_allowed: null,
    description: "Contemporary urban styling defines this standalone three-bedroom home in the Franklinton Arts District. The main level showcases an open-concept great room with clean geometric lines, recessed LED lighting, and low-maintenance luxury vinyl plank flooring throughout.\n\nThe modern kitchen is appointed with flat-panel cabinetry, stainless steel appliances, solid surface counters, and a central dining bar. Upstairs, three bedrooms feature generous closet storage, including a primary suite with a private full bath alongside a second full hallway bathroom. A dedicated off-street parking pad and fenced urban yard provide functional privacy, located within walking distance of local art studios, breweries, and downtown Columbus."
  },
  {
    id: "08fe66ed-ac6a-42b6-8542-9632410ddafd",
    title: "2 Bed / 2 Bath Single-Family House in Merion Village – $1,185/mo",
    address: "335 E Moler St",
    city: "Columbus",
    state: "OH",
    zip: "43207",
    bedrooms: 2,
    bathrooms: 2,
    square_footage: 1250,
    monthly_rent: 1185,
    security_deposit: 1185,
    application_fee: 50,
    property_type: "SINGLE_FAMILY",
    parking: "Off-Street Parking & Rear Alley Access",
    pets_allowed: true,
    pet_types_allowed: ["Dogs", "Cats"],
    lease_terms: null,
    minimum_lease_months: null,
    smoking_allowed: null,
    description: "Located on the southern boundary of German Village in Merion Village, this two-bedroom single-family home blends historic charm with fresh updates across 1,250 square feet. Natural pine floors extend through the living and dining quarters, complemented by high baseboards and abundant natural light.\n\nThe kitchen features white shaker cabinetry, stainless steel appliances including gas range and dishwasher, and butcher-block style prep surfaces. Two full bathrooms provide modern fixtures and custom tile finishes. French doors lead out to a raised rear entertainment deck overlooking a private fenced yard with alley access for off-street parking. Neighborhood parks, historic brick-lined streets, and local dining destinations are all within convenient walking distance."
  }
];

async function updateAndAudit() {
  console.log('Starting Columbus 15 Batch Update & Audit...\n');

  for (let i = 0; i < updates.length; i++) {
    const item = updates[i];
    console.log(`[${i + 1}/15] Updating ${item.address} (${item.id})...`);

    const patchPayload = {
      title: item.title,
      bedrooms: item.bedrooms,
      bathrooms: item.bathrooms,
      square_footage: item.square_footage,
      monthly_rent: item.monthly_rent,
      security_deposit: item.security_deposit,
      application_fee: item.application_fee,
      property_type: item.property_type,
      parking: item.parking,
      pets_allowed: item.pets_allowed,
      pet_types_allowed: item.pet_types_allowed,
      lease_terms: null,
      minimum_lease_months: null,
      smoking_allowed: null,
      description: item.description,
      status: "active"
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${item.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(patchPayload)
    });

    if (!res.ok) {
      console.error(`Failed to update ${item.id}: HTTP ${res.status} - ${await res.text()}`);
    } else {
      console.log(`✓ Updated ${item.address}`);
    }
  }

  console.log('\n=== RUNNING COMPREHENSIVE POST-UPDATE AUDIT ===\n');
  
  // Re-fetch all 15
  const auditRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=in.(${updates.map(u => u.id).join(',')})&select=*`, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`
    }
  });

  const verified = await auditRes.json();
  let totalViolations = 0;

  for (let i = 0; i < verified.length; i++) {
    const p = verified[i];
    const violations = [];

    // Check location
    if (p.city !== 'Columbus' || p.state !== 'OH') {
      violations.push(`Invalid location: ${p.city}, ${p.state}`);
    }

    // Check property type
    if (!['SINGLE_FAMILY', 'TOWNHOMES'].includes(p.property_type)) {
      violations.push(`Invalid property type: ${p.property_type}`);
    }

    // Check beds
    if (p.bedrooms !== 2 && p.bedrooms !== 3) {
      violations.push(`Invalid beds: ${p.bedrooms}`);
    }

    // Check baths
    if (p.bathrooms !== 2) {
      violations.push(`Invalid baths: ${p.bathrooms}`);
    }

    // Check rent
    if (p.monthly_rent > 1200) {
      violations.push(`Rent exceeds $1,200: $${p.monthly_rent}`);
    }

    // Check security deposit in DB
    if (p.security_deposit !== p.monthly_rent) {
      violations.push(`Security deposit mismatch: $${p.security_deposit} != $${p.monthly_rent}`);
    }

    // Check fee
    if (p.application_fee !== 50) {
      violations.push(`Application fee != 50: $${p.application_fee}`);
    }

    // Check lease fields
    if (p.lease_terms !== null) {
      violations.push(`lease_terms is not null: ${p.lease_terms}`);
    }
    if (p.minimum_lease_months !== null) {
      violations.push(`minimum_lease_months is not null: ${p.minimum_lease_months}`);
    }
    if (p.smoking_allowed !== null && p.smoking_allowed !== false) {
      violations.push(`smoking_allowed is not null: ${p.smoking_allowed}`);
    }

    // Check description for prohibited terms
    const desc = p.description || "";
    if (desc.toLowerCase().includes('welcome to')) {
      violations.push(`Contains 'welcome to'`);
    }
    if (desc.toLowerCase().includes('security deposit') || desc.toLowerCase().includes('deposit')) {
      violations.push(`Contains 'deposit' reference`);
    }
    if (desc.toLowerCase().includes('lease term') || desc.toLowerCase().includes('month lease') || desc.toLowerCase().includes('12-month') || desc.toLowerCase().includes('12 month')) {
      violations.push(`Contains lease term references`);
    }
    if (desc.toLowerCase().includes('smoking') || desc.toLowerCase().includes('smoke')) {
      violations.push(`Contains smoking references`);
    }
    if (desc.toLowerCase().includes('tour') || desc.toLowerCase().includes('showing') || desc.toLowerCase().includes('schedule a viewing')) {
      violations.push(`Contains tour/showing language`);
    }

    if (violations.length > 0) {
      console.log(`❌ [FAIL] ${p.address} (${p.id}):`);
      violations.forEach(v => console.log(`   - ${v}`));
      totalViolations += violations.length;
    } else {
      console.log(`✓ [PASS] ${p.address} ($${p.monthly_rent}/mo | ${p.bedrooms} Bed / ${p.bathrooms} Bath)`);
    }
  }

  console.log(`\nAudit Finished. Total Violations: ${totalViolations}`);
  if (totalViolations === 0) {
    console.log('ALL 15 PROPERTIES ARE 100% COMPLIANT!');
  }
}

updateAndAudit().catch(console.error);
