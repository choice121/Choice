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

const PIPELINE_HEADERS = {
  ...HEADERS,
  'Accept-Profile': 'pipeline',
  'Content-Profile': 'pipeline'
};

function makeShareToken() {
  const bytes = crypto.randomBytes(32);
  return bytes.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const CANDIDATES = [
  // 1. 755 Canonby Pl #731F
  {
    pipeline_id: 'PP-38A2824C',
    address: '755 Canonby Pl #731F',
    city: 'Columbus',
    state: 'OH',
    zip: '43223',
    county: 'Franklin County',
    title: '755 Canonby Pl #731F, Columbus, OH 43223',
    rent: 1045,
    beds: 2,
    bathrooms: 1.5,
    half_bathrooms: 1,
    sqft: 950,
    lot_size_sqft: null,
    property_type: 'TOWNHOUSE',
    year_built: 1971,
    laundry_type: 'Hookups',
    parking: 'Off-Street Direct-Access Resident Parking',
    garage_spaces: 0,
    heating_type: 'Central Natural Gas, Electric',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Dishwasher', 'Electric Range / Oven', 'Refrigerator', 'Freezer', 'Disposal'],
    amenities: [
      'Central Air Conditioning',
      'Clubhouse',
      'Community Courtyard',
      'Off-Street Direct-Access Parking',
      'Security Cameras',
      'Cable & High-Speed Internet Ready',
      'Near Green Lawn Bird Sanctuary & Park',
      'Pet-Friendly'
    ],
    description: `Set within the welcoming Scioto Townhomes community in South Franklinton, this two-story brick townhome offers 950 square feet of well-proportioned living space. The entrance opens into a comfortable primary gathering room bathed in daylight, framed by neutral wall finishes and resilient flooring designed for everyday ease.

The functional culinary area features durable cabinetry, generous countertop prep space, a stainless-basin sink, and full-size appliances including an electric range, refrigerator, and dishwasher. An adjacent open dining area ensures effortless mealtimes and hospitality.

The thoughtful multi-story arrangement separates living and sleeping zones. Upstairs, two generously scaled bedrooms provide airy closet accommodations, large sunny windows, and close proximity to the updated full ceramic-tile bathroom. A convenient main-floor half-bath powder room serves visitors and day-to-day routines with ease.

Energy-efficient central air conditioning and central heating keep the entire townhome comfortable year-round. Residents benefit from dedicated off-street direct-access parking, shared community clubhouse grounds, a landscaped courtyard, and on-premise laundry center facilities. Located less than ten minutes from downtown Columbus with rapid highway connections via I-70, I-71, and US-33.

Pet-Friendly property welcoming your animal companions. Application Fee: $50 per adult occupant. Submit your rental application today at Choice Properties.`
  },

  // 2. 577 E Kossuth St
  {
    pipeline_id: 'PP-B12FEE4F',
    address: '577 E Kossuth St',
    city: 'Columbus',
    state: 'OH',
    zip: '43206',
    county: 'Franklin County',
    title: '577 E Kossuth St, Columbus, OH 43206',
    rent: 1195,
    beds: 3,
    bathrooms: 1.0,
    half_bathrooms: 0,
    sqft: 1134,
    lot_size_sqft: 3713,
    property_type: 'DUPLEX',
    year_built: 1920,
    laundry_type: 'Hookups',
    parking: 'Off-Street & On-Street Parking',
    garage_spaces: 0,
    heating_type: 'Forced Air Natural Gas',
    cooling_type: 'Window Units Permitted',
    has_central_air: false,
    has_basement: true,
    appliances: ['Refrigerator', 'Gas Range / Oven', 'Dishwasher', 'Over-the-Range Microwave', 'Washer/Dryer Hookups'],
    amenities: [
      'Spacious Half-Duplex Layout',
      'Full Unfinished Basement Storage',
      'Dedicated Dining Room',
      'Fresh Paint Throughout',
      'Minutes to German Village & Southern Orchards',
      'Pet-Friendly'
    ],
    description: `Positioned minutes from German Village, Southern Orchards, and Nationwide Children's Hospital, this historic 1,134-square-foot half-duplex pairs character with generous domestic scale. Freshly painted in crisp neutral hues, the ground floor welcomes you through an expansive living room that flows directly into a dedicated formal dining room.

The oversized eat-in kitchen comes fully equipped for cooking and entertaining, showcasing a full package of appliances including a refrigerator, gas range oven, built-in dishwasher, and over-the-range microwave. Extensive cabinetry and broad prep counters deliver outstanding everyday functionality.

The home encompasses three private bedrooms, each offering generous natural light and closet space. The central bathroom is thoughtfully placed with clean fixtures, a mirrored vanity, and a full-size bathtub/shower combination.

A full unfinished private basement delivers abundant dry storage space and dedicated washer and dryer hookups for stress-free laundry care. Enjoy peaceful residential street surroundings with both off-street parking options and quick connectivity to major transit corridors.

Pet-Friendly environment welcoming cats and dogs. Application Fee: $50 per adult applicant. Submit your rental application today at Choice Properties.`
  },

  // 3. 2481 N 4th St
  {
    pipeline_id: 'PP-5AD7F0B3',
    address: '2481 N 4th St',
    city: 'Columbus',
    state: 'OH',
    zip: '43202',
    county: 'Franklin County',
    title: '2481 N 4th St, Columbus, OH 43202',
    rent: 1199,
    beds: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    sqft: 950,
    lot_size_sqft: 3339,
    property_type: 'TOWNHOUSE',
    year_built: 1915,
    laundry_type: 'Hookups',
    parking: 'Ample On-Street Parking along 4th St & Tompkins',
    garage_spaces: 0,
    heating_type: 'Forced Air Natural Gas',
    cooling_type: 'Window Units Permitted',
    has_central_air: false,
    has_basement: true,
    appliances: ['Gas Range / Oven', 'Refrigerator', 'Washer/Dryer Hookups'],
    amenities: [
      'End-Unit Privacy',
      'Covered Front Porch',
      'Laminate Wood-Style Flooring',
      'Plush Second-Floor Carpeting',
      'Architectural Bay Window with Built-in Bench',
      'Full Storage Basement',
      'COTA & CABS Bus Line Access',
      'Pet-Friendly'
    ],
    description: `Occupying a desirable end-unit position in the vibrant Old North Columbus corridor, this updated multi-story townhome delivers 950 square feet of distinctive architectural charm. A covered front porch welcomes you inside to a sun-drenched main level surfaced in durable wood-look laminate flooring.

The social heart of the residence features an open living and dining area highlighted by a stunning architectural bay window with integrated bench seating. In the kitchen, clean cabinetry, ample counter space, a gas range oven, and refrigerator provide an efficient culinary workstation with direct access to the back exit.

Upstairs, plush modern carpeting runs through two bright, comfortably sized bedrooms with deep closets. An updated full bathroom serves the second floor with a clean white vanity, updated fixtures, and a tub/shower enclosure.

The dedicated private basement provides an extensive storage footprint along with washer and dryer hookups. Commuting is effortless with immediate access to COTA and CABS bus lines, local neighborhood eateries, and expressways.

Pet-Friendly accommodations. Application Fee: $50 per adult applicant. Submit your rental application today at Choice Properties.`
  },

  // 4. 132 S Highland Ave
  {
    pipeline_id: 'PP-94AC2457',
    address: '132 S Highland Ave',
    city: 'Columbus',
    state: 'OH',
    zip: '43223',
    county: 'Franklin County',
    title: '132 S Highland Ave, Columbus, OH 43223',
    rent: 1165,
    beds: 3,
    bathrooms: 1.0,
    half_bathrooms: 0,
    sqft: 1072,
    lot_size_sqft: 7841,
    property_type: 'DUPLEX',
    year_built: 1925,
    laundry_type: 'Hookups',
    parking: 'Two Dedicated Off-Street Parking Spaces in Rear',
    garage_spaces: 0,
    heating_type: 'Central Forced Air Gas, Decorative Fireplace',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Electric Range / Oven', 'Garbage Disposal', 'Refrigerator', 'Washer/Dryer Hookups'],
    amenities: [
      'Two Off-Street Rear Parking Spots',
      'Decorative Living Room Fireplace',
      'Hardwood Bedroom Flooring',
      'Ceiling Fans',
      'Central Air Conditioning',
      'Pet-Friendly'
    ],
    description: `Situated in a classic Columbus neighborhood setting, this 1,072-square-foot duplex residence blends vintage craftsmanship with reliable modern upgrades. The welcoming front parlor showcases warm wood-trimmed detailing, overhead ceiling fan circulation, and an eye-catching decorative hearth fireplace that anchors the living space.

The kitchen is equipped with solid upper and lower cabinets, an electric range oven, refrigerator, and an in-sink garbage disposal. An intuitive layout connects the kitchen to the dining and social zones for easy day-to-day hosting.

Three generous bedrooms feature genuine wood flooring, ample natural light from tall double-hung windows, and private closet space. The full bathroom includes a classic pedestal vanity, neutral tile surrounds, and a deep soaking shower/tub combo.

Enjoy the year-round comfort of central air conditioning and natural gas forced-air heating, alongside dedicated washer and dryer hookups. In the rear of the property, two dedicated off-street parking spots eliminate street parking hassles.

Pet-Friendly living for all family pets. Application Fee: $50 per adult applicant. Submit your rental application today at Choice Properties.`
  },

  // 5. 5804 N Meadows Blvd
  {
    pipeline_id: 'PP-C7B80340',
    address: '5804 N Meadows Blvd',
    city: 'Columbus',
    state: 'OH',
    zip: '43229',
    county: 'Franklin County',
    title: '5804 N Meadows Blvd, Columbus, OH 43229',
    rent: 1199,
    beds: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    sqft: 1215,
    lot_size_sqft: 12720,
    property_type: 'SINGLE_FAMILY',
    year_built: 1963,
    laundry_type: 'Hookups',
    parking: 'Private Driveway Off-Street Parking',
    garage_spaces: 0,
    heating_type: 'Forced Air Natural Gas',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Electric Range / Oven', 'Refrigerator', 'Range Hood', 'Washer/Dryer Hookups'],
    amenities: [
      'Substantial 1,215 Sq Ft Floor Plan',
      'Expansive 0.29-Acre Lot (12,720 Sq Ft)',
      'Private Driveway Parking',
      'Generous Lawn Space',
      'Single-Level Living',
      'Pet-Friendly'
    ],
    description: `Resting on an expansive 0.29-acre parcel (12,720 square feet) in Northern Woods, this standalone single-family residence delivers an impressive 1,215 square feet of comfortable single-level living. A wide front lawn and long private driveway lead into a spacious main living area designed for easy flow and versatile furniture arrangements.

The central kitchen provides extensive cabinetry, wrap-around countertop prep space, a range hood, electric range oven, and a refrigerator. The adjacent dining area looks out over the sizable rear grounds, creating a serene backdrop for morning routines.

Two well-proportioned bedrooms boast private closets and sunlit exposures. The full bathroom features an easy-clean tub and shower combination, modern vanity, and contemporary lighting.

Central air conditioning and energy-conscious forced-air gas heating provide reliable climate control through every Ohio season. Dedicated interior laundry utility hookups simplify home chores, while the private driveway accommodates multiple resident vehicles off-street.

Pet-Friendly property. Application Fee: $50 per adult occupant. Submit your rental application today at Choice Properties.`
  },

  // 6. 670 Rhoads Ave
  {
    pipeline_id: 'PP-D1737420',
    address: '670 Rhoads Ave',
    city: 'Columbus',
    state: 'OH',
    zip: '43205',
    county: 'Franklin County',
    title: '670 Rhoads Ave, Columbus, OH 43205',
    rent: 1200,
    beds: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    sqft: 1020,
    lot_size_sqft: 4356,
    property_type: 'SINGLE_FAMILY',
    year_built: 1942,
    laundry_type: 'Hookups',
    parking: 'Private Driveway & Street Parking',
    garage_spaces: 0,
    heating_type: 'Forced Air Natural Gas',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: false,
    appliances: ['Gas Range / Oven', 'Refrigerator', 'Washer/Dryer Hookups'],
    amenities: [
      'Detached Classic Bungalow Style',
      'Quiet Low-Traffic Corner Setting',
      'Central Air Conditioning',
      'Proximity to Capital University & Franklin Park Conservatory',
      'Quick I-70 Highway Access',
      'Pet-Friendly'
    ],
    description: `Nestled on a low-traffic corner parcel just south of East Main Street, this standalone 1,020-square-foot bungalow pairs timeless curb appeal with comfortable modern amenities. A sheltered entrance opens into a warm central living room highlighted by clean flooring, crisp trim, and welcoming natural illumination.

The eat-in kitchen is appointed with abundant solid cabinetry, generous counter space, a gas range oven, and a full-size refrigerator. Its open relationship with the living area creates a welcoming environment for meals and quiet evenings at home.

Two tranquil bedrooms offer comfortable proportions and generous closet space. The full bathroom is finished with a white vanity sink, bright vanity mirror, and a clean bathtub/shower enclosure.

Enjoy the year-round convenience of central air conditioning and efficient forced-air natural gas heat. Dedicated laundry hookups accommodate full-size washer and dryer units. Located just minutes from Capital University, the Franklin Park Conservatory & Botanical Gardens, and rapid I-70 highway on-ramps.

Pet-Friendly accommodations for your pets. Application Fee: $50 per adult applicant. Submit your rental application today at Choice Properties.`
  },

  // 7. 1610 Vendome Dr S
  {
    pipeline_id: 'PP-BCBBB250',
    address: '1610 Vendome Dr S',
    city: 'Columbus',
    state: 'OH',
    zip: '43219',
    county: 'Franklin County',
    title: '1610 Vendome Dr S, Columbus, OH 43219',
    rent: 1150,
    beds: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    sqft: 672,
    lot_size_sqft: 8276,
    property_type: 'SINGLE_FAMILY',
    year_built: 1951,
    laundry_type: 'Hookups',
    parking: 'Detached 1-Car Garage & Extended Driveway',
    garage_spaces: 1,
    heating_type: 'Forced Air Natural Gas',
    cooling_type: 'Window Units Permitted',
    has_central_air: false,
    has_basement: true,
    appliances: ['Refrigerator', 'Gas Range / Oven', 'Washer/Dryer Hookups'],
    amenities: [
      'Detached 1-Car Garage',
      'Substantial 8,276 Sq Ft Lot',
      'Large Partially Fenced Backyard',
      'Spacious Full Storage Basement',
      'Single-Story Ranch Living',
      'Convenient Highway & Park Access',
      'Pet-Friendly'
    ],
    description: `Positioned on an expansive 8,276-square-foot residential lot, this classic detached single-family ranch offers 672 square feet of efficient one-level living paired with incredible outdoor acreage. The inviting front living room greets you with crisp architectural lines, large picture windows, and easy-maintenance flooring throughout.

The kitchen provides solid wood cabinetry, durable prep countertops, a stainless-steel sink, a gas range oven, and a refrigerator. A sunny dining niche overlooks the immense backyard grounds.

Two bedrooms provide peaceful personal sanctuaries with built-in closets and private views. The central bathroom features clean tile finishes, a vanity with under-sink storage, and a full-size bathtub/shower.

A full unfinished basement spans the footprint of the home, providing extraordinary extra storage and dedicated washer and dryer hookups. Outdoors, the huge partially fenced backyard and detached one-car garage offer rare versatility for vehicle parking, storage, and open-air leisure. Conveniently situated close to local parks, walking trails, shopping, and major highways.

Pet-Friendly home for companion animals. Application Fee: $50 per adult applicant. Submit your rental application today at Choice Properties.`
  },

  // 8. 2487 Azelda St
  {
    pipeline_id: 'PP-CD8BFD29',
    address: '2487 Azelda St',
    city: 'Columbus',
    state: 'OH',
    zip: '43211',
    county: 'Franklin County',
    title: '2487 Azelda St, Columbus, OH 43211',
    rent: 1150,
    beds: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    sqft: 667,
    lot_size_sqft: 4792,
    property_type: 'SINGLE_FAMILY',
    year_built: 1930,
    laundry_type: 'Hookups',
    parking: 'Private Driveway Off-Street Parking',
    garage_spaces: 0,
    heating_type: 'Forced Air Natural Gas',
    cooling_type: 'Window Units Permitted',
    has_central_air: false,
    has_basement: false,
    appliances: ['Electric Range / Oven', 'Refrigerator', 'Washer/Dryer Hookups'],
    amenities: [
      'Newly Renovated Interior',
      'Spacious Private Backyard',
      'Private Driveway Off-Street Parking',
      'Convenient I-71 Highway Connectivity',
      'Easy Single-Level Layout',
      'Pet-Friendly'
    ],
    description: `Freshly updated and turnkey ready, this standalone 667-square-foot North Linden home offers a cozy, low-maintenance haven with a deep 4,792-square-foot lot. The bright living room welcomes you with fresh paint, modern ceiling lighting, and attractive durable flooring that flows effortlessly through the common areas.

The renovated kitchen features freshly updated cabinetry, expansive preparation counters, a stainless-steel sink, an electric range oven, and a refrigerator. An efficient design provides direct access to the generous rear yard for simple outdoor enjoyment.

Two comfortable bedrooms feature clean finishes, abundant natural sunlight, and dedicated closet space. The full bathroom showcases an updated vanity, contemporary light fixtures, and a clean bathtub/shower enclosure.

Dedicated laundry hookups handle your laundry appliances with ease. Outside, a long private driveway provides dedicated off-street parking, while the wide grassy backyard offers plenty of private open space. Positioned just moments from I-71 for quick citywide transit.

Pet-Friendly setting welcoming your pets. Application Fee: $50 per adult applicant. Submit your rental application today at Choice Properties.`
  },

  // 9. 2563 McGuffey Rd
  {
    pipeline_id: 'PP-57B8D1C5',
    address: '2563 McGuffey Rd',
    city: 'Columbus',
    state: 'OH',
    zip: '43211',
    county: 'Franklin County',
    title: '2563 McGuffey Rd, Columbus, OH 43211',
    rent: 1150,
    beds: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    sqft: 672,
    lot_size_sqft: 7840,
    property_type: 'SINGLE_FAMILY',
    year_built: 1941,
    laundry_type: 'Hookups',
    parking: 'Dedicated Driveway Off-Street Parking',
    garage_spaces: 0,
    heating_type: 'Forced Air Natural Gas',
    cooling_type: 'Central Air Conditioning',
    has_central_air: true,
    has_basement: true,
    appliances: ['Gas Range / Oven', 'Refrigerator', 'Washer/Dryer Hookups'],
    amenities: [
      'Full Unfinished Basement Storage',
      'Central Air Conditioning',
      'Generous 7,840 Sq Ft Parcel',
      'Off-Street Driveway Parking',
      'Single-Story Ranch Living',
      'Pet-Friendly'
    ],
    description: `Delivering easy single-level ranch living on a substantial 7,840-square-foot parcel, this well-maintained 672-square-foot residence offers comfort and exceptional storage. The inviting front living room features broad windows, crisp neutral tones, and durable flooring that creates a bright, welcoming atmosphere.

The kitchen is equipped with solid wood cabinets, spacious countertops, a dual-basin sink, a gas range oven, and a full refrigerator. A practical floor plan connects effortlessly to the dining nook for easy everyday living.

Both bedrooms provide comfortable sleeping quarters with private closets and ample natural light. The full bathroom includes a classic vanity sink, mirror, and a shower/tub combination.

A full unfinished basement provides expansive dry storage space for tools, seasonal items, and gear, as well as dedicated washer and dryer hookups. Central air conditioning and natural gas heating maintain optimum comfort in every season. An extended private driveway ensures hassle-free off-street parking.

Pet-Friendly accommodations for your pets. Application Fee: $50 per adult applicant. Submit your rental application today at Choice Properties.`
  }
];

async function run() {
  console.log(`=========================================================`);
  console.log(`Choice Properties — Publishing Columbus Batch (9 Properties)`);
  console.log(`Target Mode: Private Placement Shield & Magic Link Sharing`);
  console.log(`=========================================================\n`);

  // Load raw pipeline properties to get original photos & geo
  const rawData = JSON.parse(fs.readFileSync('/tmp/current_pipeline_batch.json', 'utf8'));
  const rawMap = new Map();
  rawData.forEach(p => rawMap.set(p.id, p));

  const publishedResults = [];
  const publishedIds = [];

  for (let i = 0; i < CANDIDATES.length; i++) {
    const c = CANDIDATES[i];
    const raw = rawMap.get(c.pipeline_id);
    if (!raw) {
      throw new Error(`Pipeline record ${c.pipeline_id} not found in raw batch`);
    }

    console.log(`\n---------------------------------------------------------`);
    console.log(`Processing #${i+1}: ${c.address} (${c.beds}b/${c.bathrooms}ba | $${c.rent}/mo | ${c.property_type})`);

    // 1. Update pipeline record with enriched data
    const pipelineUpdateBody = {
      property_type: c.property_type,
      year_built: c.year_built,
      lot_size_sqft: c.lot_size_sqft,
      laundry_type: c.laundry_type,
      parking: c.parking,
      garage_spaces: c.garage_spaces,
      heating_type: c.heating_type,
      cooling_type: c.cooling_type,
      has_central_air: c.has_central_air,
      has_basement: c.has_basement,
      appliances: JSON.stringify(c.appliances),
      amenities: JSON.stringify(c.amenities),
      bathrooms: Math.floor(c.bathrooms),
      total_bathrooms: c.bathrooms,
      half_bathrooms: c.half_bathrooms,
      description: c.description,
      application_fee: 50,
      security_deposit: c.rent,
      pets_allowed: true,
      updated_at: new Date().toISOString()
    };

    const pipeUpRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${c.pipeline_id}`, {
      method: 'PATCH',
      headers: PIPELINE_HEADERS,
      body: JSON.stringify(pipelineUpdateBody)
    });
    if (!pipeUpRes.ok) {
      console.warn(`Warning: failed to update pipeline record: ${pipeUpRes.status}`);
    } else {
      console.log(`✓ Updated pipeline staging record ${c.pipeline_id}`);
    }

    // 2. Insert into public.properties with status: 'private_placement'
    const propertyId = crypto.randomUUID();
    const propertyPayload = {
      id: propertyId,
      landlord_id: LANDLORD_ID,
      status: 'private_placement', // Shielded from public marketplace
      title: c.title,
      description: c.description,
      address: c.address,
      city: c.city,
      state: c.state,
      zip: c.zip,
      county: c.county,
      lat: raw.lat || 39.9612,
      lng: raw.lng || -82.9988,
      property_type: c.property_type,
      year_built: c.year_built,
      bedrooms: c.beds,
      bathrooms: Math.floor(c.bathrooms),
      half_bathrooms: c.half_bathrooms,
      total_bathrooms: c.bathrooms,
      square_footage: c.sqft,
      lot_size_sqft: c.lot_size_sqft,
      garage_spaces: c.garage_spaces,
      monthly_rent: c.rent,
      security_deposit: c.rent, // 1x monthly rent in DB
      application_fee: 50, // strictly $50
      pets_allowed: true,
      parking: c.parking,
      amenities: c.amenities,
      appliances: c.appliances,
      heating_type: c.heating_type,
      cooling_type: c.cooling_type,
      laundry_type: c.laundry_type,
      has_central_air: c.has_central_air,
      has_basement: c.has_basement,
      original_description: raw.original_description || raw.description,
      views_count: 0,
      applications_count: 0,
      saves_count: 0
    };

    const propRes = await fetch(`${SUPABASE_URL}/rest/v1/properties`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(propertyPayload)
    });
    if (!propRes.ok) {
      const errText = await propRes.text();
      throw new Error(`Failed to insert into public.properties: ${propRes.status} ${errText}`);
    }
    const [insertedProp] = await propRes.json();
    publishedIds.push(propertyId);
    console.log(`✓ Published to public.properties (ID: ${propertyId}, status: 'private_placement')`);

    // 3. Insert Photos with original order & CDN URLs (display_order: 1 is hero)
    let rawPhotos = [];
    try {
      rawPhotos = JSON.parse(raw.original_image_urls || '[]');
    } catch (e) {
      rawPhotos = [];
    }

    if (rawPhotos.length === 0 && raw.image_urls) {
      try { rawPhotos = JSON.parse(raw.image_urls); } catch (e) {}
    }

    const photoRows = rawPhotos.map((item, idx) => ({
      property_id: propertyId,
      url: typeof item === 'string' ? item : item.url,
      display_order: idx + 1,
      is_hero: idx === 0
    }));

    if (photoRows.length > 0) {
      const photoRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(photoRows)
      });
      if (!photoRes.ok) {
        const pErr = await photoRes.text();
        console.warn(`Warning: failed to insert photos: ${photoRes.status} ${pErr}`);
      } else {
        console.log(`✓ Inserted ${photoRows.length} original CDN photos (hero: photo #1)`);
      }
    }

    // 4. Mark pipeline record as published
    await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${c.pipeline_id}`, {
      method: 'PATCH',
      headers: PIPELINE_HEADERS,
      body: JSON.stringify({
        status: 'published',
        published_at: new Date().toISOString(),
        choice_property_id: propertyId
      })
    });
    console.log(`✓ Pipeline record ${c.pipeline_id} marked published`);

    publishedResults.push({
      id: propertyId,
      pipeline_id: c.pipeline_id,
      address: c.address,
      city: c.city,
      state: c.state,
      zip: c.zip,
      title: c.title,
      rent: c.rent,
      beds: c.beds,
      baths: c.bathrooms,
      sqft: c.sqft,
      photosCount: photoRows.length
    });
  }

  // 5. Generate Magic Multi-Property Share Link
  console.log(`\n=========================================================`);
  console.log(`Generating Magic Multi-Property Share Token for ${publishedIds.length} properties...`);

  const token = makeShareToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days
  const shareId = crypto.randomUUID();

  // Insert into public.property_shares
  const shareRes = await fetch(`${SUPABASE_URL}/rest/v1/property_shares`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      id: shareId,
      token_hash: tokenHash,
      expires_at: expiresAt
    })
  });

  if (!shareRes.ok) {
    const err = await shareRes.text();
    throw new Error(`Failed to create property_shares: ${shareRes.status} ${err}`);
  }

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

  // Verify resolution via property-share Edge Function
  console.log(`\nVerifying share resolution via /functions/v1/property-share...`);
  try {
    const resolveRes = await fetch(`${SUPABASE_URL}/functions/v1/property-share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`
      },
      body: JSON.stringify({
        action: 'resolve',
        token: token
      })
    });
    const resolveData = await resolveRes.json();
    console.log(`Resolution status: ${resolveRes.status}`, resolveData.success ? `✓ Resolved ${resolveData.properties?.length || resolveData.data?.length || 'OK'} properties` : resolveData);
  } catch (e) {
    console.warn(`Resolution check warning: ${e.message}`);
  }

  const magicLink = `${SITE_URL}/listings.html#share=${token}`;

  console.log(`\n=========================================================`);
  console.log(`🎉 MAGIC MULTI-PROPERTY LINK GENERATED SUCCESSFULLY!`);
  console.log(`Share URL: ${magicLink}`);
  console.log(`=========================================================`);

  fs.writeFileSync('scripts/published_columbus_magic_results.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    share_token: token,
    share_id: shareId,
    share_url: magicLink,
    properties: publishedResults
  }, null, 2));

  console.log(`Saved output manifest to scripts/published_columbus_magic_results.json`);
}

run().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
