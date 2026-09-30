const fs = require('fs');
const crypto = require('crypto');

const SUPABASE_URL = "https://tlfmwetmhthpyrytrcfo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE";

const headers = {
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json"
};

const pipelineHeaders = {
  ...headers,
  "Accept-Profile": "pipeline",
  "Content-Profile": "pipeline"
};

const PROPERTIES_DATA = [
  {
    id: "PP-8E073A3A",
    address: "3517 Galatian Way",
    city: "Yukon",
    state: "OK",
    zip: "73099",
    county: "Canadian County",
    monthly_rent: 1445,
    security_deposit: 1445,
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: null,
    square_footage: 1355,
    property_type: "DUPLEX",
    title: "3BR DUPLEX in Yukon",
    appliances: ["Dishwasher", "Microwave", "Range", "Oven", "Stove"],
    amenities: ["Fireplace", "2-Car Garage", "Pergola Covered Patio", "Fenced Backyard", "Double Vanity", "Walk-In Closet", "Washer & Dryer Hookups"],
    enriched_description: `Conveniently situated just minutes from downtown Yukon, this spacious three-bedroom, two-bathroom duplex offers 1,355 square feet of comfortable single-level living. The home features a bright living area anchored by a cozy fireplace, with plush carpeting throughout and easy-care ceramic tile in the kitchen and baths.

The kitchen provides generous cabinet storage and countertop space, outfitted with a range, oven, built-in microwave, and dishwasher. A dedicated full-size laundry room features washer and dryer hookups with additional utility storage.

The primary suite includes an expansive bedroom layout and private bath with double vanity sinks, while the second full bathroom offers a large vanity to comfortably accommodate family and guests. Outside, enjoy a two-car garage, private driveway parking, and a fenced backyard highlighted by an attractive pergola over the patio.`
  },
  {
    id: "PP-B6DF469C",
    address: "213 Woodbridge Cir",
    city: "Edmond",
    state: "OK",
    zip: "73012",
    county: "Oklahoma County",
    monthly_rent: 1550,
    security_deposit: 1550,
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: null,
    square_footage: 1456,
    property_type: "SINGLE_FAMILY",
    title: "3BR SINGLE FAMILY in Edmond",
    appliances: ["Dishwasher", "Range", "Oven", "Microwave"],
    amenities: ["Corner Lot", "Main Level Primary Suite", "Open-Concept Kitchen", "New Flooring", "Fresh Interior Paint", "Modern Light Fixtures", "Fenced Backyard"],
    enriched_description: `Positioned on a prime corner lot near East 2nd Street and Santa Fe in Edmond, this two-story single-family home delivers 1,456 square feet of updated interior space. The main level showcases an open-concept living and dining layout accented by fresh neutral paint, updated contemporary lighting, and low-maintenance modern flooring throughout.

The kitchen connects seamlessly with the dining area and comes equipped with a range, oven, microwave, and dishwasher. Designed for everyday convenience, the primary suite is situated on the main floor with an attached private bath.

Upstairs, two well-proportioned secondary bedrooms share a full central bathroom. Outside, the corner lot provides ample yard space and a private fenced outdoor area, all within quick reach of Edmond shopping, local dining, and top-rated area schools.`
  },
  {
    id: "PP-AE9DC758",
    address: "1609 SW 78th Ter",
    city: "Oklahoma City",
    state: "OK",
    zip: "73159",
    county: "Oklahoma County",
    monthly_rent: 1550,
    security_deposit: 1550,
    bedrooms: 3,
    bathrooms: 1.5,
    half_bathrooms: 1,
    square_footage: 1574,
    property_type: "SINGLE_FAMILY",
    title: "3BR SINGLE FAMILY in Oklahoma City",
    appliances: ["Dishwasher", "Oven", "Range", "Cooktop"],
    amenities: ["2-Car Garage with Workshop Space", "Attached Carport", "Fenced Backyard with Mature Trees", "Covered Patio", "Built-In Cabinetry", "Recessed Lighting", "Ceiling Fans", "Updated Roof (2025)"],
    enriched_description: `Offering 1,574 square feet of renovated interior living space, this single-story South Oklahoma City home delivers a functional three-bedroom, one-and-a-half-bathroom layout with abundant natural light. The open living and dining area features updated flooring, ceiling fans, recessed lighting, and substantial built-in storage.

The kitchen provides extensive counter and cabinet space, an updated tiled backsplash, a cooktop range, built-in oven, and dishwasher, opening directly into the main living room for effortless entertaining. A convenient guest half-bath complements the full family bathroom.

A glass door opens out to a generous wood-fenced backyard shaded by mature trees and complete with a patio for outdoor relaxation. Practical additions include an attached two-car garage with dedicated workshop or storage space, an adjoining carport, and a recently replaced roof. Located minutes from I-35, Walmart Neighborhood Market, and retail corridors along SW 89th, SW 104th, and Moore.`
  },
  {
    id: "PP-DE66E322",
    address: "12273 SW 11th St",
    city: "Yukon",
    state: "OK",
    zip: "73099",
    county: "Canadian County",
    monthly_rent: 1400,
    security_deposit: 1400,
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: null,
    square_footage: 1168,
    property_type: "SINGLE_FAMILY",
    title: "3BR SINGLE FAMILY in Yukon",
    appliances: ["Dishwasher", "Garbage Disposal", "Microwave", "Oven", "Range"],
    amenities: ["Fresh Interior Paint", "Granite Kitchen Countertops", "Walk-in Closet", "Ceiling Fans", "Private Master Bath", "Fenced Yard", "Near Mustang Trails Elementary"],
    enriched_description: `Fresh interior paint and new solid granite kitchen countertops highlight this charming three-bedroom, two-bathroom single-family home in Yukon. Encompassing 1,168 square feet of efficient living space, the home offers a welcoming front living room with ceiling fans and crisp finishes throughout.

The kitchen features newly installed granite surfaces, ample cabinetry, and a full appliance suite including a range, oven, built-in microwave, garbage disposal, and dishwasher. The primary bedroom includes an ensuite bath and walk-in closet space.

A fully fenced private backyard provides plenty of room for outdoor play and relaxation. Families will appreciate the exceptional location immediately adjacent to Mustang Trails Elementary and Meadow Intermediate School, with quick access to highway corridors across Yukon and Mustang.`
  },
  {
    id: "PP-B04ECC38",
    address: "11205 NW 6th Ter",
    city: "Yukon",
    state: "OK",
    zip: "73099",
    county: "Canadian County",
    monthly_rent: 1475,
    security_deposit: 1475,
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: null,
    square_footage: 1245,
    property_type: "DUPLEX",
    title: "3BR DUPLEX in Yukon",
    appliances: ["Dishwasher", "Oven", "Range"],
    amenities: ["Cul-de-Sac Setting", "New Carpet", "2-Car Garage", "Fenced Backyard", "Central Heat and Air", "Easy Access to I-40 and Kilpatrick Turnpike"],
    enriched_description: `Situated in a quiet residential cul-de-sac just off Yukon Parkway, this clean, move-in-ready three-bedroom, two-bathroom duplex offers 1,245 square feet of comfortable living space. Brand new carpeting and fresh interior details extend across the open floor plan.

The kitchen is equipped with an oven, cooktop range, and built-in dishwasher, surrounded by functional countertop workspace and storage. Three well-separated bedrooms include a private master suite with an attached bath.

The property includes a two-car attached garage with driveway parking and an enclosed, fenced backyard. Commuters benefit from swift access to I-40, the John Kilpatrick Turnpike, area shopping centers, and direct routes toward Tinker Air Force Base.`
  },
  {
    id: "PP-48AE7EE3",
    address: "1808 NW 40th St",
    city: "Oklahoma City",
    state: "OK",
    zip: "73118",
    county: "Oklahoma County",
    monthly_rent: 1500,
    security_deposit: 1500,
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: null,
    square_footage: 1264,
    property_type: "SINGLE_FAMILY",
    title: "3BR SINGLE FAMILY in Oklahoma City",
    appliances: ["Dishwasher", "Oven", "Range", "Stainless Steel Appliances"],
    amenities: ["Original Hardwood Floors", "Decorative Fireplace", "Quartz Countertops", "Sunroom / Home Office", "Updated Plumbing, Electrical & HVAC", "Large Fenced Yard", "Near NW 39th Expressway & Penn Square"],
    enriched_description: `Showcasing timeless character on an expansive 8,499-square-foot lot in Northwest Oklahoma City, this fully remodeled three-bedroom, two-bathroom residence blends historic appeal with modern updates. Refinished original hardwood floors flow through the living room, centered around an elegant decorative fireplace.

The gourmet kitchen has been updated with polished quartz countertops, tile backsplash, and stainless steel appliances including a range, oven, and dishwasher. A sun-drenched sunroom overlooks the sprawling backyard, serving as an ideal home office, reading lounge, or secondary living space.

Both bathrooms have been remodeled with contemporary fixtures and tile work. Major infrastructure updates—including updated plumbing, electrical, and HVAC systems—ensure lasting comfort and efficiency. Located minutes from NW 39th Expressway, Penn Square Mall, and prime dining.`
  },
  {
    id: "PP-354B9A7F",
    address: "12601 Florence Ln",
    city: "Yukon",
    state: "OK",
    zip: "73099",
    county: "Canadian County",
    monthly_rent: 1495,
    security_deposit: 1495,
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: null,
    square_footage: 1275,
    property_type: "DUPLEX",
    title: "3BR DUPLEX in Yukon",
    appliances: ["5-Burner Gas Range", "Oven", "Dishwasher", "Microwave"],
    amenities: ["Homes By Taber Construction", "Quartz Countertops", "Wood-Look Flooring", "2-Car Garage", "Tankless Water Heater", "In-Ground Sprinkler System", "Farmstyle Sink", "Walk-In Shower", "Fenced Backyard", "Neighborhood Park, Pond & Walking Trails", "Piedmont Schools"],
    enriched_description: `Built by renowned builder Homes By Taber within the Piedmont Schools district, this contemporary three-bedroom, two-bathroom duplex offers 1,275 square feet of upscale finishes and high-efficiency features in Yukon. Wood-look flooring runs throughout the interior, creating an open and unified aesthetic.

The gourmet kitchen is fitted with solid quartz countertops, a farmhouse sink, stainless steel built-in microwave, dishwasher, and a premium five-burner gas range. Energy-conscious amenities include an on-demand tankless water heater and an in-ground lawn sprinkler system.

The primary bedroom suite features a private bath with a custom tiled walk-in shower and walk-in closet. An attached two-car garage provides secure vehicle parking, while the fenced backyard offers private outdoor retreat. Community amenities include a neighborhood park, scenic pond, and paved walking paths right outside your door.`
  },
  {
    id: "PP-77E3D85E",
    address: "4421 NW 20th St",
    city: "Oklahoma City",
    state: "OK",
    zip: "73107",
    county: "Oklahoma County",
    monthly_rent: 1425,
    security_deposit: 1425,
    bedrooms: 2,
    bathrooms: 1.5,
    half_bathrooms: 1,
    square_footage: 1611,
    property_type: "SINGLE_FAMILY",
    title: "2BR SINGLE FAMILY in Oklahoma City",
    appliances: ["Dishwasher", "Oven", "Range", "Refrigerator"],
    amenities: ["Generous 1,611 Sq Ft Layout", "Guest Half-Bath / Powder Room", "Spacious Kitchen with Refrigerator", "Central Heat and Air", "Fenced Yard", "Central OKC Location"],
    enriched_description: `Encompassing an impressive 1,611 square feet of single-story interior space, this central Oklahoma City residence provides an expansive two-bedroom, one-and-a-half-bathroom configuration. The floor plan delivers generous living and family rooms that adapt easily to both entertaining and relaxed daily life.

The kitchen features plenty of cabinetry, broad countertops, a refrigerator, cooktop range, oven, and dishwasher, alongside space for casual dining. The split bedroom arrangement is complemented by a convenient guest powder room in addition to the full family bathroom.

Outside, a private fenced yard provides open outdoor enjoyment. Centrally located with fast connections to nearby parks, neighborhood schools, local dining, and major roadways across the Oklahoma City metro area.`
  },
  {
    id: "PP-C4A81879",
    address: "2601 Fennel Rd",
    city: "Oklahoma City",
    state: "OK",
    zip: "73128",
    county: "Canadian County",
    monthly_rent: 1445,
    security_deposit: 1445,
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: null,
    square_footage: 1315,
    property_type: "SINGLE_FAMILY",
    title: "3BR SINGLE FAMILY in Oklahoma City",
    appliances: ["Dishwasher", "Oven", "Range"],
    amenities: ["Fountain Grass Neighborhood", "Split Floor Plan", "Granite Kitchen Countertops & Pantry", "Primary Suite with Walk-In Closet", "Tub/Shower Combo", "Covered Back Patio", "Fenced Backyard", "2-Car Garage", "Near Mustang Valley Elementary School"],
    enriched_description: `Located in the desirable Fountain Grass neighborhood just down the street from Mustang Valley Elementary School, this three-bedroom, two-bathroom home spans 1,315 square feet with an attached two-car garage. A large living room welcomes abundant natural light through broad front windows.

The kitchen showcases solid granite countertops, a walk-in pantry, and appliances including an oven, range, and built-in dishwasher. The split floor plan ensures privacy, positioning the primary bedroom suite away from the secondary bedrooms. The primary bath features a spacious walk-in closet and a combined shower/tub.

Step out onto a covered rear patio overlooking an expansive fenced backyard. Conveniently accessible to I-40, the Kilpatrick Turnpike, and Mustang-area dining and shopping.`
  },
  {
    id: "PP-561FD6B2",
    address: "10705 Sunnymeade Pl",
    city: "Oklahoma City",
    state: "OK",
    zip: "73120",
    county: "Oklahoma County",
    monthly_rent: 1550,
    security_deposit: 1550,
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: null,
    square_footage: 1617,
    property_type: "SINGLE_FAMILY",
    title: "3BR SINGLE FAMILY in Oklahoma City",
    appliances: ["Dishwasher", "Oven", "Range"],
    amenities: ["Tree-Lined Street in The Village", "Oversized Lot", "Second Living Area with Fireplace", "Flexible Master Suite Layout", "Walk-In Closets", "Fenced Backyard"],
    enriched_description: `Nestled on a peaceful, tree-lined street in The Village, this single-story three-bedroom, two-bathroom home offers 1,617 square feet of living space on an oversized private lot. The residence features flexible living spaces designed to accommodate a variety of lifestyles.

A distinct second living area includes a warm wood-burning fireplace, a walk-in closet, and an adjoining full bathroom, functioning wonderfully as an expansive private primary suite or entertainment room. The kitchen provides generous storage, counter prep area, an oven, cooktop range, and built-in dishwasher.

Outside, the deep lot creates a substantial backyard space for recreation and outdoor relaxation. Ideally situated within The Village, with close proximity to Lake Hefner, parks, local shopping centers, and major Northwest Oklahoma City thoroughfares.`
  }
];

async function main() {
  console.log("=== CHOICE PROPERTIES ENRICHMENT & PUBLISHING PIPELINE ===");
  console.log(`Processing ${PROPERTIES_DATA.length} qualifying properties...\n`);

  // Step 1: Reject PP-BB4BF5FD (39 Akin Dr - 5 photos < 6 photo min)
  console.log("--> Archiving/Rejecting PP-BB4BF5FD (39 Akin Dr) due to insufficient photos (5 photos < 6 photo min)...");
  const rejectRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.PP-BB4BF5FD`, {
    method: "PATCH",
    headers: pipelineHeaders,
    body: JSON.stringify({
      status: "archived",
      missing_fields: JSON.stringify(["photos_minimum_failed: has 5, requires at least 6"]),
      updated_at: new Date().toISOString()
    })
  });
  console.log(`   PP-BB4BF5FD archive status: ${rejectRes.status}`);

  const publishedResults = [];

  for (const p of PROPERTIES_DATA) {
    console.log(`\n======================================================`);
    console.log(`Processing ${p.id} (${p.address}, ${p.city}, ${p.state} ${p.zip})...`);

    // 1. Fetch current pipeline record to preserve original_description and get original_image_urls
    const getRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${p.id}&select=*`, {
      headers: pipelineHeaders
    });
    const [rec] = await getRes.json();
    if (!rec) {
      console.error(`   ERROR: ${p.id} not found in pipeline!`);
      continue;
    }

    const rawDescription = rec.original_description || rec.description || "";
    const rawPhotos = typeof rec.original_image_urls === "string" 
      ? JSON.parse(rec.original_image_urls || "[]") 
      : (rec.original_image_urls || []);

    console.log(`   Source Photos: ${rawPhotos.length} | Raw Desc Length: ${rawDescription.length}`);

    if (rawPhotos.length < 6) {
      console.error(`   ERROR: ${p.id} has fewer than 6 photos (${rawPhotos.length})! Skipping.`);
      continue;
    }

    // 2. Patch pipeline_properties with surgically enriched & verified data
    const patchPayload = {
      title: p.title,
      description: p.enriched_description,
      original_description: rawDescription, // Permanent ground truth preservation
      property_type: p.property_type,
      bathrooms: p.bathrooms,
      half_bathrooms: p.half_bathrooms,
      bedrooms: p.bedrooms,
      square_footage: p.square_footage,
      monthly_rent: p.monthly_rent,
      security_deposit: p.security_deposit,
      application_fee: 50,
      pets_allowed: true,
      smoking_allowed: false,
      minimum_lease_months: null,
      lease_terms: null,
      appliances: JSON.stringify(p.appliances),
      amenities: JSON.stringify(p.amenities),
      status: "ready",
      updated_at: new Date().toISOString()
    };

    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${p.id}`, {
      method: "PATCH",
      headers: pipelineHeaders,
      body: JSON.stringify(patchPayload)
    });
    console.log(`   Pipeline record updated (status: ${patchRes.status})`);

    // 3. Publish to public.properties
    const newPropertyId = crypto.randomUUID();
    console.log(`   Inserting into public.properties with UUID: ${newPropertyId}...`);

    const publicInsertPayload = {
      id: newPropertyId,
      status: "active",
      title: p.title,
      description: p.enriched_description,
      address: p.address,
      city: p.city,
      state: p.state,
      zip: p.zip,
      county: p.county,
      neighborhood: rec.neighborhood || null,
      lat: rec.lat || null,
      lng: rec.lng || null,
      property_type: p.property_type,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      half_bathrooms: p.half_bathrooms || 0,
      square_footage: p.square_footage,
      monthly_rent: p.monthly_rent,
      security_deposit: p.security_deposit,
      application_fee: 50,
      pets_allowed: true,
      smoking_allowed: false,
      minimum_lease_months: null,
      lease_terms: null,
      appliances: p.appliances,
      amenities: p.amenities,
      source: "zillow",
      source_url: rec.source_url,
      source_listing_id: rec.source_listing_id,
      listed_at: new Date().toISOString().slice(0, 10),
      has_central_air: rec.has_central_air != null ? rec.has_central_air : true,
      has_basement: rec.has_basement != null ? rec.has_basement : false
    };

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/properties`, {
      method: "POST",
      headers: {
        ...headers,
        "Prefer": "return=representation"
      },
      body: JSON.stringify(publicInsertPayload)
    });

    if (!insertRes.ok) {
      console.error(`   ERROR: Insert into public.properties failed (${insertRes.status}):`, await insertRes.text());
      continue;
    }
    console.log(`   ✓ Successfully inserted into public.properties!`);

    // 4. Update pipeline record status to published
    await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${p.id}`, {
      method: "PATCH",
      headers: pipelineHeaders,
      body: JSON.stringify({
        status: "published",
        choice_property_id: newPropertyId,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    });
    console.log(`   ✓ Pipeline record marked as published`);

    // 5. Attach verified photos into public.property_photos
    console.log(`   Inserting ${rawPhotos.length} photos into public.property_photos...`);
    let photosAdded = 0;
    for (let idx = 0; idx < rawPhotos.length; idx++) {
      const photoUrl = typeof rawPhotos[idx] === "string" ? rawPhotos[idx] : rawPhotos[idx].url;
      const isHero = idx === 0;

      const photoRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos`, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          property_id: newPropertyId,
          url: photoUrl,
          display_order: idx + 1,
          is_hero: isHero,
          watermark_status: "clean"
        })
      });

      if (photoRes.status === 201) {
        photosAdded++;
      } else {
        console.warn(`      Photo ${idx + 1} insert warning (${photoRes.status}):`, await photoRes.text());
      }
    }
    console.log(`   ✓ ${photosAdded}/${rawPhotos.length} photos attached to ${newPropertyId}`);

    // 6. Verify published property in public.properties
    const verifyRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${newPropertyId}&select=id,title,address,city,state,zip,monthly_rent,bedrooms,bathrooms,half_bathrooms,property_type,status`, {
      headers: headers
    });
    const [verifiedProp] = await verifyRes.json();
    console.log(`   ✓ Verified Live Property:`, verifiedProp);

    publishedResults.push({
      pipeline_id: p.id,
      property_id: newPropertyId,
      address: p.address,
      city: p.city,
      state: p.state,
      zip: p.zip,
      rent: p.monthly_rent,
      beds: p.bedrooms,
      baths: p.bathrooms,
      property_type: p.property_type,
      photos_count: photosAdded
    });
  }

  console.log("\n======================================================");
  console.log("PUBLISHING PIPELINE COMPLETE!");
  console.log(`Published ${publishedResults.length} properties:`);
  publishedResults.forEach((r, i) => {
    console.log(`${i+1}. ${r.address}, ${r.city}, ${r.state} ${r.zip} ($${r.rent.toLocaleString()}/mo | ${r.beds} Bed / ${r.baths} Bath) — https://choice-properties-site.pages.dev/property.html?id=${r.property_id}`);
  });

  fs.writeFileSync("/tmp/published_batch_results.json", JSON.stringify(publishedResults, null, 2));
}

main().catch(err => {
  console.error("FATAL ERROR in pipeline enrichment:", err);
  process.exit(1);
});
