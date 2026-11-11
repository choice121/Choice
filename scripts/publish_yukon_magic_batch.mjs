import fs from 'fs';
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE';
const LANDLORD_ID = 'b8d3aea0-f466-49f2-ac07-2b2b40793cc9'; // Choice Properties verified landlord
const SITE_URL = 'https://choice-properties-site.pages.dev';

const HEADERS = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
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

const DESCRIPTIONS = [
  // 1. 3600 Janus ($850/mo | 3 Bed / 2 Bath | 2,292 sqft | DUPLEX)
  `Positioned at the end of a quiet Yukon cul-de-sac, this expansive residence delivers an impressive 2,292 square feet of generous single-level living space. An expansive living room welcomes you with open sightlines, tall ceilings, and resilient easy-care flooring, creating an ideal setting for everyday gatherings and entertaining.

The fully equipped kitchen features generous counter prep space, rich cabinetry, a dual-basin sink, refrigerator, range oven, dishwasher, and garbage disposal, with an adjacent dining nook that flows effortlessly into the living area.

The secluded primary suite serves as a quiet retreat, complete with a large walk-in closet and an en-suite bath with a walk-in shower and wide vanity. Two additional bedrooms provide ample proportions, sunny windows, and close access to the well-appointed second full bathroom.

A full-sized dedicated laundry room accommodates full-size washer and dryer units with extra overhead storage. Efficient central heating and cooling guarantee comfort through every season. The low-traffic cul-de-sac setting offers peaceful outdoor enjoyment and private driveway parking.

Pet-friendly accommodations welcome your four-legged companions. A $50 application fee applies for each adult applicant. Submit your rental application today at Choice Properties.`,

  // 2. 11011 SW 5th St ($875/mo | 3 Bed / 2 Bath | 1,323 sqft | DUPLEX)
  `Located within a private gated Yukon neighborhood with rapid access to I-40 and the Kilpatrick Turnpike, this smart two-story townhome duplex spans 1,323 square feet of contemporary design. Bright and welcoming, the ground-floor living area connects seamlessly to the dining space with modern neutral paint and low-maintenance flooring.

The central kitchen is outfitted with ample cabinet storage, generous countertops, and modern appliances including a built-in microwave, range oven, and dishwasher.

A highly requested main-level primary bedroom suite offers total convenience, featuring a private en-suite bathroom and closet. Upstairs, two sunlit secondary bedrooms share a pristine second full bathroom, ideal for privacy.

Features a dedicated interior laundry room with full-size washer and dryer hookups, plus energy-efficient central climate control. Includes an attached two-car garage with automated door openers and a fully fenced private backyard perfect for relaxing.

Pet-friendly living. A $50 application fee applies per adult applicant. Submit your rental application today at Choice Properties.`,

  // 3. 10620 SW 16th Ter ($895/mo | 3 Bed / 2 Bath | 1,216 sqft | SINGLE_FAMILY)
  `Situated in a growing Yukon enclave, this newly constructed standalone single-family home offers 1,216 square feet of pristine modern construction on a level residential parcel. The front foyer leads into a light-filled open-concept living room complete with overhead ceiling fans, sleek contemporary lighting, and unified hard-surface flooring throughout the main social areas.

An inviting culinary space boasts solid cabinetry, expansive prep surfaces, quality appliances, and a central dining area positioned adjacent to the rear patio door.

Three comfortable bedrooms each feature dedicated ceiling fans and generous closet space. The primary suite showcases an expansive en-suite bath with a large vanity and a roomy walk-in wardrobe.

Modern central HVAC system, double-pane insulated windows, and dedicated interior laundry connections simplify daily routines. Enjoy an attached multi-car garage, private driveway, and an open backyard patio suited for weekend barbecues.

Welcomes household pets with open arms. A $50 application fee applies per adult applicant. Submit your rental application today at Choice Properties.`,

  // 4. 3804 Matthew Dr ($925/mo | 3 Bed / 2 Bath | 1,092 sqft | DUPLEX)
  `Tucked away in a peaceful cul-de-sac setting in Yukon, this well-maintained residence features 1,092 square feet of efficient, easy-flow living space. The welcoming front living room is centered around a warm focal brick fireplace, framed by bright windows and durable flooring that holds up to active lifestyles.

The open-concept kitchen includes crisp white cabinetry, generous counter space, dual sinks, refrigerator, range, and dishwasher, accompanied by an open dining nook for family meals.

The primary bedroom suite includes an en-suite bath and generous closet space. Two additional guest bedrooms share a clean central hallway bathroom with a shower/tub combination.

Equipped with central air conditioning and heating, plus a dedicated laundry utility area with standard washer/dryer connections. A private fenced yard and dedicated parking provide ease and security in a quiet community pocket.

Pet-friendly accommodations. A $50 application fee applies per adult applicant. Submit your rental application today at Choice Properties.`,

  // 5. 9118 McLendon Ct ($950/mo | 3 Bed / 2 Bath | 1,215 sqft | SINGLE_FAMILY)
  `Located in a desirable newer Yukon development, this single-family home spans 1,215 square feet of refined modern construction with attractive exterior curb appeal. Luxury vinyl plank (LVP) flooring flows throughout the central living areas, accented by contemporary fixtures and neutral designer paint tones.

The chef-friendly kitchen offers modern cabinetry, durable counters, a stainless steel appliance package, and a breakfast bar open to the dining and family rooms.

The tranquil primary retreat features soft carpeting, walk-in closet, and an upgraded private bathroom. Two secondary bedrooms offer versatility for home office, nursery, or guests, serviced by a full secondary bath.

Energy-efficient central HVAC, digital thermostat, and dedicated laundry room. A fully fenced private backyard and attached two-car garage deliver convenience and peace of mind.

Pet-friendly policy in place. A $50 application fee applies for each adult applicant. Submit your rental application today at Choice Properties.`,

  // 6. 405 Yukon Ave ($975/mo | 3 Bed / 2 Bath | 1,800 sqft | SINGLE_FAMILY)
  `Positioned right in the heart of Yukon near neighborhood schools and I-40, this distinctive 1,800-square-foot standalone home features classic character combined with generous living proportions. A prominent, expansive covered front porch greets you before stepping into a flexible interior plan featuring hard-surface flooring throughout and an extra bonus room/den area ideal for a second media room, playroom, or executive office.

The heart of the home features substantial cabinetry, generous meal preparation counters, full appliances, and easy flow into the dining area.

Three spacious bedrooms provide restful retreats with ceiling fans and extensive closet storage. Two full bathrooms feature roomy vanities and updated fixtures.

Central heating and air conditioning ensure dependable comfort, accompanied by a dedicated utility space with washer and dryer hookups. The expansive, fully fenced backyard on a quiet neighborhood street provides plenty of outdoor living space, complemented by a private driveway.

Pet-friendly accommodations. A $50 application fee applies per adult applicant. Submit your rental application today at Choice Properties.`,

  // 7. 900 Coles Crk ($995/mo | 3 Bed / 2 Bath | 1,350 sqft | SINGLE_FAMILY)
  `Nestled on a premium corner lot within the gated Yukon Crossing community, this newer 1,350-square-foot home delivers community security and modern craftsmanship. Wood-look plank flooring sweeps through the main open-concept living area, where tall ceilings and natural light create a breezy, elevated atmosphere.

The open island kitchen boasts sleek cabinetry, generous countertops, pantry storage, and quality appliances, opening right to the dining zone.

The private primary suite features wood-look plank flooring, a walk-in closet, and an en-suite bath with dual vanity sinks. Two secondary bedrooms have soft finishes and share a bright full bath.

Includes a dedicated laundry room, energy-efficient insulation, and central heating and air conditioning. Gated neighborhood setting, attached two-car garage, and a low-maintenance corner yard with a private patio.

Welcomes pets of all sizes. A $50 application fee applies per adult applicant. Submit your rental application today at Choice Properties.`,

  // 8. 9428 NW 122nd Ter ($1,025/mo | 3 Bed / 2 Bath | 1,256 sqft | SINGLE_FAMILY)
  `Set in a popular Yukon residential community, this stylish 1,256-square-foot single-family home features an intelligent split-bedroom layout designed for privacy and functionality. The front entry opens directly into a bright, airy living space showcasing clean lines, recessed lighting, and resilient flooring that connects smoothly to the kitchen.

The kitchen showcases contemporary finishes, generous counter workspace, abundant cabinets, a pantry, and an open breakfast bar that makes casual dining effortless.

The secluded primary suite provides an oasis with a walk-in wardrobe and private en-suite bathroom. Across the home, two secondary bedrooms provide generous storage and share a central bathroom.

Central HVAC, double-pane windows, and interior laundry room with standard washer/dryer connections. Features an attached two-car garage, private concrete driveway, and an enclosed backyard for outdoor relaxation.

100% Pet-friendly. A $50 application fee applies per adult applicant. Submit your rental application today at Choice Properties.`,

  // 9. 9321 NW 124th St ($1,050/mo | 3 Bed / 2 Bath | 1,275 sqft | DUPLEX)
  `Delivering top-tier craftsmanship in Yukon, this luxury attached townhome duplex spans 1,275 square feet of modern design with clean architectural lines. High ceilings and open sightlines accent the sunlit living area, where luxury vinyl plank flooring provides style and durability.

The contemporary kitchen features custom cabinetry, solid-surface countertops, an undermount sink, and stainless appliances including dishwasher, microwave, and range.

Three comfortable bedrooms feature soft carpeting, wide windows, and deep closets. The primary suite boasts a private bathroom retreat, while the secondary full bath includes a tub/shower combo and modern vanity.

Fully equipped with energy-efficient central heating and air, plus interior laundry hookups. Attached garage and private patio area within a tranquil Yukon corridor.

Pet-friendly living. A $50 application fee applies per adult applicant. Submit your rental application today at Choice Properties.`,

  // 10. 316 Ash Ave ($1,095/mo | 3 Bed / 2.5 Bath | 1,342 sqft | DUPLEX)
  `Showcasing modern farmhouse flair in central Yukon, this 1,342-square-foot townhome duplex combines two-story charm with contemporary amenities. The ground floor opens into an expansive living room with luxury vinyl plank flooring throughout, accompanied by a convenient powder room (half bath) on the main level for guests and entertaining.

A standout chef-inspired kitchen features a built-in island area with breakfast bar seating, ample cabinetry, pantry storage, and modern appliances.

Upstairs, the primary bedroom suite offers a serene escape with an en-suite bath and large closet. Two additional upstairs bedrooms share a second full bathroom, providing a true 2.5-bath floor plan without morning congestion.

Interior laundry connections, central air conditioning, and efficient heat pump climate systems. Includes dedicated parking, private rear patio, and walking proximity to local Yukon dining and parks.

Welcomes household pets. A $50 application fee applies per adult applicant. Submit your rental application today at Choice Properties.`
];

async function publishBatch() {
  const candidates = JSON.parse(fs.readFileSync('scripts/yukon_magic_candidates.json', 'utf8'));
  console.log(`🚀 Starting publication of ${candidates.length} private placement Yukon properties...`);

  const publishedIds = [];
  const publishedProperties = [];
  const today = new Date().toISOString().split('T')[0];

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const desc = DESCRIPTIONS[i];
    const title = `${c.street}, ${c.city}, ${c.state} ${c.zip}`;
    const rent = c.adjusted_rent;
    const propId = crypto.randomUUID();

    console.log(`\n---------------------------------------------------------`);
    console.log(`[${i + 1}/${candidates.length}] Publishing ${title} at $${rent}/mo (ID: ${propId})`);
    console.log(`   Type: ${c.property_type} | Beds: ${c.beds} | Baths: ${c.total_bathrooms} | Sqft: ${c.sqft}`);

    const propertyPayload = {
      id: propId,
      landlord_id: LANDLORD_ID,
      status: 'private_placement', // Exclusive private placement — does not appear on public page
      title: title,
      description: desc,
      original_description: c.original_description,
      address: c.street,
      city: c.city,
      state: c.state,
      zip: c.zip,
      county: 'Canadian County',
      lat: c.lat,
      lng: c.lng,
      property_type: c.property_type,
      year_built: c.year_built,
      bedrooms: c.beds,
      bathrooms: c.bathrooms,
      half_bathrooms: c.half_bathrooms,
      total_bathrooms: c.total_bathrooms,
      square_footage: c.sqft,
      monthly_rent: rent,
      security_deposit: rent, // 1x monthly rent in structured DB, zero mentions in desc
      application_fee: 50,    // Exactly $50 application fee
      pets_allowed: true,     // Always pet-friendly
      pet_types_allowed: ['Dogs', 'Cats'],
      smoking_allowed: false,
      parking: c.property_type === 'SINGLE_FAMILY' ? 'Garage' : 'Off-street / Driveway',
      heating_type: 'Central Heating',
      cooling_type: 'Central Air',
      laundry_type: 'Hookups',
      featured: false,
      listed_at: today
    };

    const propRes = await fetch(`${SUPABASE_URL}/rest/v1/properties`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(propertyPayload)
    });

    if (!propRes.ok) {
      const err = await propRes.text();
      throw new Error(`Failed to insert property ${title}: ${propRes.status} ${err}`);
    }
    console.log(`   ✓ Property inserted successfully with status 'private_placement'`);

    // Photos: Ingest in STRICT original source order per temporary directive
    // First photo is hero (display_order: 0, is_hero: true)
    const photoRows = c.photos.map((url, idx) => ({
      property_id: propId,
      url: url,
      display_order: idx,
      is_hero: idx === 0,
      watermark_status: 'clean',
      alt_text: `${c.street}, ${c.city} ${c.state} - Photo ${idx + 1}`
    }));

    if (photoRows.length > 0) {
      const photoRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos`, {
        method: 'POST',
        headers: { ...HEADERS, 'Prefer': 'return=minimal' },
        body: JSON.stringify(photoRows)
      });
      if (!photoRes.ok) {
        console.warn(`   ⚠ Photo insertion warning: ${photoRes.status} ${await photoRes.text()}`);
      } else {
        console.log(`   ✓ Inserted ${photoRows.length} photos in strict original order (hero: Photo 1)`);
      }
    }

    publishedIds.push(propId);
    publishedProperties.push({
      id: propId,
      title,
      rent,
      beds: c.beds,
      baths: c.total_bathrooms,
      sqft: c.sqft,
      photosCount: photoRows.length
    });
  }

  // Generate Magic Multi-Property Share Link
  console.log(`\n=========================================================`);
  console.log(`Generating Magic Multi-Property Share Token for ${publishedIds.length} properties...`);

  const token = makeShareToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days

  // Insert into public.property_shares
  const shareRes = await fetch(`${SUPABASE_URL}/rest/v1/property_shares`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      token_hash: tokenHash,
      expires_at: expiresAt
    })
  });

  if (!shareRes.ok) {
    const err = await shareRes.text();
    throw new Error(`Failed to create property_shares: ${shareRes.status} ${err}`);
  }

  const [shareData] = await shareRes.json();
  const shareId = shareData.id;
  console.log(`✓ Created property_share record (ID: ${shareId})`);

  // Link all properties into public.property_share_properties
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
  console.log(`✓ Linked ${publishedIds.length} properties to share record`);

  const magicLink = `${SITE_URL}/listings.html#share=${token}`;
  console.log(`\n=========================================================`);
  console.log(`🎉 MAGIC MULTI-PROPERTY LINK GENERATED SUCCESSFULLY!`);
  console.log(`Share URL: ${magicLink}`);
  console.log(`=========================================================`);

  fs.writeFileSync('scripts/published_yukon_magic_results.json', JSON.stringify({
    share_id: shareId,
    token: token,
    magic_link: magicLink,
    expires_at: expiresAt,
    properties: publishedProperties
  }, null, 2));

  return { magicLink, token, properties: publishedProperties };
}

publishBatch().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
