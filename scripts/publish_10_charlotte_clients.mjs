import { CREDENTIALS_CONFIG } from '../credentials-config.mjs';
import crypto from 'crypto';
import fs from 'fs';

const SUPABASE_URL = CREDENTIALS_CONFIG.SUPABASE_URL;
const KEY = CREDENTIALS_CONFIG.SUPABASE_API_KEY;
const SITE_URL = 'https://choice-properties-site.pages.dev';

const HEADERS = {
  'apikey': KEY,
  'Authorization': 'Bearer ' + KEY,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

const HEADERS_PIPELINE = {
  'apikey': KEY,
  'Authorization': 'Bearer ' + KEY,
  'Content-Type': 'application/json',
  'Accept-Profile': 'pipeline',
  'Content-Profile': 'pipeline',
  'Prefer': 'return=representation'
};

// Descriptions written independently and specifically for each home to meet Choice Properties guidelines:
const DESCRIPTIONS = {
  'PP-FB3B4A16': `Set in a peaceful Charlotte setting, this attractive two-story residence spans 1,596 square feet of well-designed living space. The main level opens into a luminous living area accented by expansive windows and resilient flooring, creating an easy transition between relaxing and entertaining spaces.

At the heart of the home, the kitchen features abundant cabinetry, durable countertops, a double basin sink, and an efficient culinary layout. The adjacent dining space enjoys views out to the private patio and surrounding outdoor living area, offering a wonderful spot for casual meals and morning coffee.

Upstairs, the accommodations include three well-proportioned bedrooms and three full bathrooms. The primary bedroom provides a tranquil sanctuary complete with generous closet storage and an en-suite bath. Additional bedrooms offer flexible layouts for family, visiting guests, or a dedicated home workspace.

Complete with central air conditioning, an attached garage, laundry hookups, and pet-friendly accommodations. A $50 application fee applies for each adult applicant. Submit your rental application today at Choice Properties.`,

  'PP-1AFF446E': `Positioned in a convenient Charlotte neighborhood, this welcoming single-family ranch provides 1,300 square feet of comfortable single-level living. The interior welcomes you with fresh neutral paint and durable flooring extending across an open and inviting central living room.

The functional kitchen is equipped with essential cooking appliances including a refrigerator and range, bordered by ample cabinet space and counter area for meal prep. Just off the main gathering area, step outside to a sheltered enclosed back patio, offering a private, weather-protected retreat ideal for year-round downtime.

Three comfortable bedrooms provide peaceful accommodations with easy access to two full bathrooms. The home is positioned minutes from neighborhood retail, essential services, and key Charlotte thoroughfares.

Features include dedicated laundry connections and pet-friendly policies. A $50 application fee applies for each adult applicant. Submit your rental application today at Choice Properties.`,

  'PP-F756F3CF': `Nestled in the established East Charlotte corridor, this handsome brick-accented home offers 1,651 square feet of comfortable interior space. A spacious front living room is filled with soft natural light, highlighting clean finishes and connecting smoothly to the adjoining dining zone.

The kitchen is arranged for convenience with quality cabinetry, solid counter space, and a garbage disposal, with direct access out to a relaxing backyard patio and lawn. The exterior grounds provide ample room for quiet afternoons and outdoor gatherings.

The private quarters feature three restful bedrooms and two full bathrooms, including a primary bedroom retreat with private closet space and dedicated bath fixtures. Additional bedrooms offer flexible arrangements for household members or remote work needs.

Highlights include central heating and air conditioning, dedicated laundry hookups, and a pet-friendly environment. A $50 application fee applies for each adult applicant. Submit your rental application today at Choice Properties.`,

  'PP-388D1396': `Situated in Southwest Charlotte near Lake Wylie corridors, this substantial two-story residence delivers 2,219 square feet of beautifully balanced living space. The open-concept lower level flows from a bright entry into a soaring great room, designed with high ceilings and wide windows that maximize natural daylight.

The open kitchen features extensive counter space, custom cabinetry, a walk-in pantry, and direct sightlines into both the informal dining area and the main living room. Sliding glass doors lead out to a patio overlooking the open grounds, perfect for outdoor leisure.

All three bedrooms are generously scaled, complemented by three full bathrooms. The primary suite is a private haven showcasing expansive proportions, a large walk-in closet, and an en-suite bathroom. Secondary bedrooms are well-appointed with ample closet capacity.

Finished with central air conditioning, an attached garage, dedicated laundry connections, and a welcoming pet-friendly policy. A $50 application fee applies for each adult applicant. Submit your rental application today at Choice Properties.`,

  'PP-7E4D9492': `Located in North Charlotte, this striking two-story home offers 1,946 square feet of contemporary craftsmanship and functional flow. The main floor features an open foyer leading into an expansive living room with easy-care flooring and large picture windows.

The kitchen is built to inspire culinary creativity, featuring broad countertop spans, an abundance of cabinet storage, modern appliances, and a seamless connection to the casual dining area. Just beyond, the outdoor patio offers an ideal open-air space for weekend relaxation.

Upstairs, three spacious bedrooms provide quiet retreats alongside three full bathrooms. The primary bedroom features a private en-suite bathroom with dual vanities and an extensive walk-in closet. Central air conditioning and multi-zone climate control ensure year-round comfort throughout.

Additional amenities include an attached private garage, laundry hookups, and a pet-friendly policy. A $50 application fee applies for each adult applicant. Submit your rental application today at Choice Properties.`,

  'PP-B5545318': `Steeped in character within historic Wesley Heights, this classic Charlotte residence offers 1,972 square feet of timeless charm and grand proportions. The first floor presents a grand living room anchored by a traditional fireplace, flanked by oversized windows that flood the interior with natural sunlight.

A formal separate dining room connects directly to the kitchen, which features a dedicated breakfast area with original built-ins for pantry and kitchenware storage. A dedicated main-level laundry room adds daily convenience. French doors open out to a fully private fenced backyard, offering an intimate oasis under mature shade trees.

The second level hosts three substantial bedrooms and two full bathrooms with vintage detailing, high ceilings, and great closet space. Positioned just moments from Uptown Charlotte, streetcar lines, and local greenways.

Enjoy a private fenced yard, central heating, and a fully pet-friendly atmosphere. A $50 application fee applies for each adult applicant. Submit your rental application today at Choice Properties.`,

  'PP-EB30B851': `Constructed with modern precision, this 2019-built Charlotte home offers 1,841 square feet of efficient, sunlit space. The open-concept main floor features durable luxury vinyl plank flooring throughout the central living and dining areas, illuminated by crisp recessed lighting.

The kitchen is designed with modern lifestyles in mind, featuring clean-lined cabinetry, expansive prep surfaces, and direct connectivity to the main living space. Glass doors lead out to the rear lawn, providing a clean outdoor footprint for relaxing and pets.

The upper level features three comfortable bedrooms and three full bathrooms. The primary suite boasts a generous walk-in closet and an en-suite bathroom with modern vanity fixtures. Two secondary bedrooms offer quiet privacy and ample natural light.

Equipped with high-efficiency central air conditioning, an attached private garage, dedicated laundry hookups, and pet-friendly terms. A $50 application fee applies for each adult applicant. Submit your rental application today at Choice Properties.`,

  'PP-F7E57446': `Featuring over 2,038 square feet of interior space, this expansive two-story home in East Charlotte combines room to breathe with low-maintenance living. The ground floor showcases dual living areas with high ceilings, ceiling fans, and an effortless transition into the formal and casual dining areas.

The well-appointed kitchen features a full suite of appliances including a refrigerator, dishwasher, and microwave oven, complemented by abundant cabinet capacity and convenient counter space. The adjacent dining nook looks out onto the private backyard.

Upstairs, the home accommodates three oversized bedrooms and three full bathrooms. The primary bedroom suite is a sprawling haven complete with a walk-in wardrobe and private bathroom. Dedicated storage closets and high-speed cabling complete the interior.

Includes an attached two-car garage, central air conditioning, and a welcoming pet-friendly policy. A $50 application fee applies for each adult applicant. Submit your rental application today at Choice Properties.`,

  'PP-604DC904': `Experience pristine modern living in this newly constructed 2026 townhome located in North Charlotte's Allen Road enclave. Spanning 1,635 square feet, the interior showcases cutting-edge contemporary design with open-concept living, tall ceilings, and premium luxury finishes throughout.

The gourmet chef's kitchen features rich granite countertops, a center island with undermount sink, designer tile backsplash, a walk-in pantry, and stainless steel appliances including a refrigerator, dishwasher, and microwave. The main level flows naturally toward a private fenced outdoor courtyard.

Upstairs, three well-appointed bedrooms and three full bathrooms provide restful accommodations. The primary suite highlights oversized closets and a luxury dual-sink vanity. An in-unit washer and dryer set adds ultimate everyday convenience.

Complete with an attached garage, professional landscaping service, and pet-friendly accommodations. A $50 application fee applies for each adult applicant. Submit your rental application today at Choice Properties.`,

  'PP-4F76E404': `Built in 2021, this stylish contemporary residence delivers 1,841 square feet of bright, energy-efficient living in East Charlotte. The front foyer opens into an expansive great room where natural light reflects off clean, modern flooring, establishing an airy and elevated environment.

The kitchen centers around an open culinary layout with durable prep counters, abundant cabinet storage, and smooth sightlines into the dining area. Step through the rear slider to the private back lawn, perfect for quiet relaxation or outdoor recreation.

Accommodations consist of three spacious bedrooms and three full bathrooms. The primary retreat offers a substantial walk-in closet and an en-suite bathroom with sleek contemporary fixtures. Two additional bedrooms easily accommodate family, roommates, or an executive home office.

Features an attached garage, central air conditioning, laundry hookups, and a welcoming pet-friendly policy. A $50 application fee applies for each adult applicant. Submit your rental application today at Choice Properties.`
};

async function publishPipeline10() {
  console.log('Fetching 10 scraped properties from pipeline.pipeline_properties...');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?status=eq.scraped&order=updated_at.desc`, {
    headers: HEADERS_PIPELINE
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch pipeline: ${res.status} ${await res.text()}`);
  }

  const pipelineProps = await res.json();
  console.log(`Found ${pipelineProps.length} properties to publish.`);

  const publishedResults = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const item of pipelineProps) {
    const propId = crypto.randomUUID();
    const pipeId = item.id;
    console.log(`\nPublishing ${pipeId}: ${item.address}, ${item.city}, ${item.state}...`);

    // Parse photos
    let rawPhotos = item.original_image_urls || item.photos || [];
    if (typeof rawPhotos === 'string') {
      try { rawPhotos = JSON.parse(rawPhotos); } catch(e) { rawPhotos = []; }
    }
    const photoUrls = rawPhotos.map(p => (typeof p === 'string' ? p : p.url)).filter(Boolean);

    // Parse amenities
    let amenities = [];
    if (typeof item.amenities === 'string') {
      try { amenities = JSON.parse(item.amenities); } catch(e) { amenities = []; }
    } else if (Array.isArray(item.amenities)) {
      amenities = item.amenities;
    }

    // Parse appliances
    let appliances = [];
    if (typeof item.appliances === 'string') {
      try { appliances = JSON.parse(item.appliances); } catch(e) { appliances = []; }
    } else if (Array.isArray(item.appliances)) {
      appliances = item.appliances;
    }

    const description = DESCRIPTIONS[pipeId] || item.description;

    const propRecord = {
      id: propId,
      title: `${item.address}, ${item.city}, ${item.state} ${item.zip}`,
      address: item.address,
      city: item.city,
      state: item.state,
      zip: item.zip,
      county: 'Mecklenburg County',
      neighborhood: 'Charlotte Metro',
      lat: item.lat || 35.2271,
      lng: item.lng || -80.8431,
      property_type: item.property_type || 'SINGLE_FAMILY',
      bedrooms: item.bedrooms,
      bathrooms: item.bathrooms,
      total_bathrooms: item.bathrooms,
      square_footage: item.square_footage,
      monthly_rent: item.monthly_rent,
      security_deposit: item.monthly_rent,
      application_fee: 50,
      pets_allowed: true,
      pet_types_allowed: ['Dogs', 'Cats'],
      smoking_allowed: false,
      has_central_air: item.has_central_air !== false,
      has_basement: item.has_basement || false,
      parking: item.parking || 'Driveway & Off-Street',
      heating_type: item.heating_type || 'Central Heating',
      cooling_type: item.cooling_type || 'Central Air Conditioning',
      laundry_type: item.laundry_type || 'In-Unit Hookups',
      amenities: amenities,
      appliances: appliances,
      description: description,
      original_description: item.original_description || item.description,
      listed_at: today,
      status: 'active',
      featured: false
    };

    // Insert into public.properties
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/properties`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(propRecord)
    });

    if (!insertRes.ok) {
      console.error(`   ✗ Failed to insert into public.properties: ${insertRes.status} ${await insertRes.text()}`);
      continue;
    }
    console.log(`   ✓ Inserted into public.properties (ID: ${propId})`);

    // Insert photos into public.property_photos
    if (photoUrls.length > 0) {
      const photoRows = photoUrls.map((url, idx) => ({
        property_id: propId,
        url: url,
        display_order: idx,
        is_hero: idx === 0,
        caption: `${item.address} - Photo ${idx + 1}`
      }));

      const photoRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(photoRows)
      });

      if (!photoRes.ok) {
        console.error(`   ⚠ Failed to insert photos: ${photoRes.status} ${await photoRes.text()}`);
      } else {
        console.log(`   ✓ Synced ${photoRows.length} photos into public.property_photos`);
      }
    }

    // Update pipeline record
    const patchPipeRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${pipeId}`, {
      method: 'PATCH',
      headers: HEADERS_PIPELINE,
      body: JSON.stringify({
        status: 'published',
        published_property_id: propId,
        published_at: new Date().toISOString()
      })
    });

    if (patchPipeRes.ok) {
      console.log(`   ✓ Updated pipeline status to 'published'`);
    } else {
      console.warn(`   ⚠ Failed to update pipeline status: ${patchPipeRes.status}`);
    }

    publishedResults.push({
      n: publishedResults.length + 1,
      id: propId,
      pipelineId: pipeId,
      address: item.address,
      city: item.city,
      state: item.state,
      zip: item.zip,
      rent: item.monthly_rent,
      beds: item.bedrooms,
      baths: item.bathrooms,
      url: `${SITE_URL}/property.html?id=${propId}`
    });
  }

  // Save published results to file
  fs.writeFileSync('scripts/published_charlotte_10_results.json', JSON.stringify(publishedResults, null, 2));

  console.log('\n=============================================================');
  console.log(`Successfully published ${publishedResults.length} properties!`);
  console.log('=============================================================\n');

  publishedResults.forEach(r => {
    console.log(`${r.n}. ${r.address}, ${r.city}, ${r.state} ${r.zip} ($${r.rent.toLocaleString()}/mo | ${r.beds} Bed / ${r.baths} Bath) — ${r.url}`);
  });

  // Now create the two client links:
  // Client A: Properties 1, 2, 3, 4, 5, 6
  // Client B: Properties 4, 5, 7, 8, 9, 10 (mixing 4 & 5 across both)
  const clientAIds = publishedResults.slice(0, 6).map(r => r.id);
  const clientBIds = [publishedResults[3].id, publishedResults[4].id, ...publishedResults.slice(6, 10).map(r => r.id)];

  const clientALink = `${SITE_URL}/listings.html?p=${clientAIds.join(',')}`;
  const clientBLink = `${SITE_URL}/listings.html?p=${clientBIds.join(',')}`;

  console.log('\n=============================================================');
  console.log('CLIENT MULTI-PROPERTY LINKS (READY FOR DEVICE TESTING):');
  console.log('=============================================================');
  console.log(`\nClient A Link (6 Properties - Includes Properties 1, 2, 3, 4, 5, 6):`);
  console.log(clientALink);

  console.log(`\nClient B Link (6 Properties - Includes Overlapping Properties 4 & 5, plus 7, 8, 9, 10):`);
  console.log(clientBLink);

  return { publishedResults, clientALink, clientBLink };
}

publishPipeline10().catch(console.error);
