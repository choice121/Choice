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
    id: "PP-BEA27126",
    address: "7249 Cormwell Ln",
    city: "Charlotte",
    state: "NC",
    zip: "28217",
    county: "Mecklenburg County",
    monthly_rent: 1700,
    security_deposit: 1700,
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: null,
    square_footage: 1221,
    property_type: "SINGLE_FAMILY",
    title: "3BR SINGLE FAMILY in Charlotte",
    appliances: ["Refrigerator", "Dishwasher", "Garbage Disposal", "Range", "Oven", "Washer", "Dryer"],
    amenities: ["Fireplace", "Luxury Vinyl Plank Flooring", "Fresh Paint", "New Roof", "Covered Carport", "Large Rear Deck", "Expansive Backyard", "Utility Storage"],
    enriched_description: `Extensively renovated throughout, this three-bedroom, two-bathroom residence offers 1,221 square feet of comfortable single-level living in southwest Charlotte. The home features luxury vinyl plank flooring across the living room, bedrooms, and kitchen, accompanied by a brand-new roof and crisp interior paint. A cozy wood-burning fireplace anchors the main gathering area.

The spacious eat-in kitchen comes fully equipped with a refrigerator, ice maker, dishwasher, garbage disposal, and range oven. A dedicated laundry room includes a full-size washer and dryer. Outside, enjoy an expansive rear deck, an oversized backyard ideal for outdoor gatherings, a covered carport, and extra utility storage. Conveniently located near the I-485 and I-77 corridors with quick access to local shopping, dining, and entertainment.`
  },
  {
    id: "PP-526FA8C4",
    address: "1614 Dendy Ln",
    city: "Pineville",
    state: "NC",
    zip: "28134",
    county: "Mecklenburg County",
    monthly_rent: 1795,
    security_deposit: 1795,
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: null,
    square_footage: 1354,
    property_type: "SINGLE_FAMILY",
    title: "3BR SINGLE FAMILY in Pineville",
    appliances: ["Refrigerator", "Stove", "Range", "Oven", "Dishwasher"],
    amenities: ["Dedicated Dining Room", "Spacious Fenced Backyard", "Rear Patio", "Washer & Dryer Hookups", "Central Air", "Gas Heat", "Near Sterling Elementary"],
    enriched_description: `Positioned in a quiet Pineville neighborhood, this three-bedroom, two-bathroom single-family home delivers 1,354 square feet of well-balanced living space. The functional floor plan includes a bright front living room with central air conditioning and efficient gas heating for year-round comfort.

The kitchen is outfitted with a refrigerator, cooktop range, oven, and dishwasher, flowing naturally into a dedicated dining room for shared meals. Plush carpeting runs through all three comfortable bedrooms. Outdoors, relax on the private back patio overlooking a generous, fully fenced backyard. Located close to Sterling Elementary, Quail Hollow Middle, and South Mecklenburg High School, with convenient proximity to Pineville area retail and commuting routes.`
  },
  {
    id: "PP-22E46EC4",
    address: "5310 Abner Ln",
    city: "Charlotte",
    state: "NC",
    zip: "28269",
    county: "Mecklenburg County",
    monthly_rent: 1699,
    security_deposit: 1699,
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: null,
    square_footage: 1145,
    property_type: "SINGLE_FAMILY",
    title: "3BR SINGLE FAMILY in Charlotte",
    appliances: ["Refrigerator", "Dishwasher", "Garbage Disposal", "Microwave", "Range", "Oven"],
    amenities: ["Primary Ensuite Bath", "Dedicated Laundry Room with Hookups", "Central Air Conditioning", "Forced Air Heating", "Near Statesville Road", "Near Local Schools"],
    enriched_description: `Offering 1,145 square feet of heated living space, this single-story Charlotte residence provides a practical three-bedroom, two-bathroom layout designed for easy daily routines. The open living area features comfortable flow between rooms with central air conditioning and forced-air heat.

The kitchen provides substantial cabinet storage and functional counter space, equipped with a refrigerator, electric range, oven, microwave, dishwasher, and garbage disposal. The primary suite features direct access to its own private bathroom and generous closet storage, while two versatile secondary bedrooms share a full central bathroom. Conveniently situated in the 28269 corridor near Statesville Road with swift access to local schools, neighborhood dining, and major highway routes.`
  },
  {
    id: "PP-0B598440",
    address: "329 Cottonwood Park Dr",
    city: "Charlotte",
    state: "NC",
    zip: "28214",
    county: "Mecklenburg County",
    monthly_rent: 1770,
    security_deposit: 1770,
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: null,
    square_footage: 1032,
    property_type: "SINGLE_FAMILY",
    title: "3BR SINGLE FAMILY in Charlotte",
    appliances: ["Refrigerator", "Dishwasher", "Range", "Oven", "Stainless Steel Appliances"],
    amenities: ["Vaulted Ceiling", "Ceiling Fans", "Oversized Soaking Tub", "Covered Front Porch", "Rear Patio", "Near RibbonWalk Nature Preserve"],
    enriched_description: `Featuring soaring vaulted ceilings in the main living room, this three-bedroom, two-bathroom residence offers 1,032 square feet of comfortable living space in west Charlotte. Ceiling fans and large windows bring ample light and air into the primary living spaces.

The modern kitchen is equipped with stainless steel appliances including a refrigerator, range, oven, and dishwasher, alongside functional cabinetry. The bathroom layout includes an oversized soaking tub for relaxing at the end of the day. Exterior highlights include a charming covered front porch and a private rear patio. Conveniently situated near RibbonWalk Nature Preserve, area shopping centers, and easy transit toward uptown Charlotte.`
  },
  {
    id: "PP-940AA62C",
    address: "2214 Pleasant Dale Dr",
    city: "Charlotte",
    state: "NC",
    zip: "28214",
    county: "Mecklenburg County",
    monthly_rent: 1800,
    security_deposit: 1800,
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: null,
    square_footage: 1215,
    property_type: "SINGLE_FAMILY",
    title: "3BR SINGLE FAMILY in Charlotte",
    appliances: ["Stainless Steel Refrigerator", "Range", "Oven", "Dishwasher", "Microwave"],
    amenities: ["Quartz Countertops", "Eat-in Kitchen", "Kitchen Pantry", "Vaulted Ceiling", "Ceiling Fans", "Smart Home Features", "Walk-In Closet", "Dedicated Laundry Room"],
    enriched_description: `This single-story, three-bedroom, two-bathroom Charlotte home offers 1,215 square feet of stylish interior living. The main living room features vaulted ceilings, ceiling fans, and durable vinyl plank flooring, creating an open and welcoming atmosphere.

The eat-in kitchen showcases polished quartz countertops, a dedicated storage pantry, and stainless steel appliances including a refrigerator, cooktop range, oven, and dishwasher. Integrated smart home features add modern convenience to daily routines. Outside, the property includes a private patio and lawn space, situated close to local neighborhood parks, retail centers, and central commuting roads.`
  },
  {
    id: "PP-B05FD61F",
    address: "314 N Linwood Ave",
    city: "Charlotte",
    state: "NC",
    zip: "28216",
    county: "Mecklenburg County",
    monthly_rent: 1745,
    security_deposit: 1745,
    bedrooms: 3,
    bathrooms: 1.0,
    half_bathrooms: null,
    square_footage: 1040,
    property_type: "SINGLE_FAMILY",
    title: "3BR SINGLE FAMILY in Charlotte",
    appliances: ["Stainless Steel Refrigerator", "Range", "Oven", "Dishwasher", "Washer", "Dryer"],
    amenities: ["Quartz Countertops", "Custom Tile Backsplash", "Dual Glass Vessel Sinks", "Tiled Shower Surround", "Laminate Flooring", "In-Unit Washer & Dryer", "Fenced Backyard"],
    enriched_description: `Completely remodeled with stylish contemporary finishes, this three-bedroom, one-bathroom ranch home delivers 1,040 square feet of comfortable living space in Charlotte. Beautiful laminate flooring extends seamlessly from the spacious front living room into the kitchen.

The updated kitchen highlights quartz countertops, custom tile backsplash, modern cabinetry, and stainless-steel appliances including a refrigerator, range, oven, and dishwasher. The shared central bathroom features dual glass vessel sinks, designer tile flooring, and a fully tiled shower surround. An in-unit washer and dryer are included, and the expansive fenced backyard provides secure outdoor enjoyment.`
  },
  {
    id: "PP-BC2BF859",
    address: "1641 Galesburg St",
    city: "Charlotte",
    state: "NC",
    zip: "28216",
    county: "Mecklenburg County",
    monthly_rent: 1755,
    security_deposit: 1755,
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: null,
    square_footage: 1200,
    property_type: "SINGLE_FAMILY",
    title: "3BR SINGLE FAMILY in Charlotte",
    appliances: ["Stainless Steel Refrigerator", "Range", "Oven", "Dishwasher", "Microwave"],
    amenities: ["Quiet Cul-de-Sac Setting", "Vaulted Ceiling", "Quartz Countertops", "Eat-in Kitchen", "Kitchen Pantry", "Walk-In Closet", "Oversized Bathtub", "Smart Home Technology", "Garden Patio"],
    enriched_description: `Situated on a quiet cul-de-sac in Northwest Charlotte, this single-story residence provides 1,200 square feet of functional living space with three bedrooms and two full bathrooms. Vaulted ceilings and easy-care vinyl flooring elevate the airy living area.

The eat-in kitchen features quartz countertops, a pantry, and stainless-steel appliances including a refrigerator, range, oven, microwave, and dishwasher. The primary bedroom features a walk-in closet and an ensuite bath with an oversized soaking tub. Smart home technology provides connected climate control and keyless entry, complemented by an outdoor patio, garden space, and dedicated laundry room.`
  },
  {
    id: "PP-0BC82EE8",
    address: "5308 Black Trail Ct",
    city: "Charlotte",
    state: "NC",
    zip: "28269",
    county: "Mecklenburg County",
    monthly_rent: 1615,
    security_deposit: 1615,
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: null,
    square_footage: 1121,
    property_type: "SINGLE_FAMILY",
    title: "3BR SINGLE FAMILY in Charlotte",
    appliances: ["Refrigerator", "Electric Range", "Oven", "Microwave", "Dishwasher"],
    amenities: ["Peaceful Cul-de-Sac Setting", "Eat-in Kitchen", "Ensuite Primary Bath", "Washer & Dryer Hookups", "Ceiling Fan", "Convenient Highway Access to I-77 & I-85"],
    enriched_description: `Located on a peaceful cul-de-sac, this three-bedroom, two-bathroom home encompasses 1,121 square feet of efficient single-story living in North Charlotte. The open layout connects the bright living space directly with the dining area and kitchen.

The eat-in kitchen is equipped with a refrigerator, electric range, oven, and an over-the-range microwave, surrounded by ample cabinetry. Full laundry hookups are situated in a dedicated utility space. The primary bedroom includes an ensuite bath, while secondary bedrooms offer great closet storage. Positioned with fast connections to I-77, I-85, and north metro shopping centers.`
  },
  {
    id: "PP-F3845C61",
    address: "2939 Gray Feather Dr",
    city: "Charlotte",
    state: "NC",
    zip: "28262",
    county: "Mecklenburg County",
    monthly_rent: 1750,
    security_deposit: 1750,
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: null,
    square_footage: 1344,
    property_type: "SINGLE_FAMILY",
    title: "3BR SINGLE FAMILY in Charlotte",
    appliances: ["Gas Range", "Oven", "Dishwasher", "Refrigerator"],
    amenities: ["Covered Front Porch", "Laminate Hardwood Floors", "Vaulted Ceilings", "Stone Fireplace", "Newly Built Wooden Deck", "Split-Bedroom Floor Plan", "Dual Primary Closets", "Private Backyard"],
    enriched_description: `Freshly painted and updated throughout, this three-bedroom, two-bathroom ranch home offers 1,344 square feet of comfortable living just off Harris Houston Road. A welcoming covered front porch opens into a spacious living room featuring laminate hardwood floors, dramatic vaulted ceilings, and a central stone fireplace.

The renovated kitchen boasts refinished cabinetry, newer countertops, a refrigerator, dishwasher, and a premium gas range. The split-bedroom layout positions the primary suite on its own wing, complete with dual closets and a private ensuite bath. Out back, a newly built wooden deck overlooks a tranquil private backyard. Equipped with central air and efficient gas heat near University City amenities.`
  },
  {
    id: "PP-2BBCA8E7",
    address: "812 Cantwell St",
    city: "Charlotte",
    state: "NC",
    zip: "28208",
    county: "Mecklenburg County",
    monthly_rent: 1799,
    security_deposit: 1799,
    bedrooms: 3,
    bathrooms: 2.0,
    half_bathrooms: null,
    square_footage: 1244,
    property_type: "SINGLE_FAMILY",
    title: "3BR SINGLE FAMILY in Charlotte",
    appliances: ["Stainless Steel Refrigerator", "Range", "Oven", "Dishwasher", "Microwave", "Garbage Disposal"],
    amenities: ["Center Kitchen Island with Seating", "Stainless Steel Appliances", "Attached Garage", "Dual-Sink Primary Bath", "Front Patio & Rear Outdoor Living Area", "Washer & Dryer Hookups", "Near Charlotte Douglas Airport"],
    enriched_description: `Located in Charlotte's Thomasboro-Hoskins neighborhood, this modern three-bedroom, two-bathroom residence provides 1,244 square feet of contemporary living. The heart of the home is a spacious open kitchen featuring modern countertops, a center island with bar seating, and stainless-steel appliances including a refrigerator, range, oven, microwave, dishwasher, and garbage disposal.

The primary bedroom suite offers generous closet space and an ensuite bath with dual-sink vanities. Interior washer and dryer hookups and an attached garage with covered parking add everyday practicality. Outdoors, both front and rear patios extend the living area into the open air, just minutes from I-85 and Charlotte Douglas International Airport.`
  },
  {
    id: "PP-39619DA8",
    address: "1003 Korp Rd",
    city: "Charlotte",
    state: "NC",
    zip: "28216",
    county: "Mecklenburg County",
    monthly_rent: 1765,
    security_deposit: 1765,
    bedrooms: 3,
    bathrooms: 2.5,
    half_bathrooms: 1,
    square_footage: 1254,
    property_type: "SINGLE_FAMILY",
    title: "3BR SINGLE FAMILY in Charlotte",
    appliances: ["Stainless Steel Refrigerator", "Range", "Oven", "Dishwasher", "Microwave"],
    amenities: ["Two-Story Layout", "Main Floor Guest Powder Room", "Quartz Countertops", "Eat-in Kitchen Pantry", "Vaulted Primary Ceilings", "Dual-Vanity Sinks", "Oversized Bathtub & Walk-In Shower", "Second Floor Laundry Room", "Smart Home Features"],
    enriched_description: `This two-story, three-bedroom, two-and-a-half-bathroom home delivers 1,254 square feet of well-designed living space in Charlotte. The main floor features an open living and dining area with smart home temperature and security controls, complemented by a convenient guest powder room.

The eat-in kitchen is highlighted by quartz countertops, a walk-in pantry, and stainless-steel appliances. Upstairs, the primary bedroom suite boasts vaulted ceilings, a walk-in closet, and a private bath with dual-vanity sinks, an oversized bathtub, and a separate walk-in shower. A dedicated second-floor laundry room, garden space, and proximity to local parks and retail make this an ideal home.`
  },
  {
    id: "PP-02C27FFE",
    address: "10327 Seedling Ln",
    city: "Charlotte",
    state: "NC",
    zip: "28214",
    county: "Mecklenburg County",
    monthly_rent: 1795,
    security_deposit: 1795,
    bedrooms: 3,
    bathrooms: 2.5,
    half_bathrooms: 1,
    square_footage: 1782,
    property_type: "SINGLE_FAMILY",
    title: "3BR SINGLE FAMILY in Charlotte",
    appliances: ["Refrigerator", "Range", "Oven", "Microwave", "Dishwasher"],
    amenities: ["Defined Foyer Entrance", "Formal Dining & Breakfast Nook", "Wood Cabinetry & Pantry", "Main Floor Half Bath", "Attached One-Car Garage", "Primary Suite with Multiple Closets", "Fresh Interior Paint", "Smart Lock & Smart Thermostat"],
    enriched_description: `Featuring 1,782 square feet of generous two-story living space, this three-bedroom, two-and-a-half-bathroom home offers a flowing floor plan in West Charlotte. A defined entrance foyer leads into large living and dining spaces accented by fresh interior paint and smart thermostat controls.

The kitchen features classic wood cabinetry, generous counter space, a pantry, breakfast nook, and a full appliance suite including a refrigerator, range, oven, built-in microwave, and dishwasher. The first floor also hosts a convenient half bathroom and direct interior access to the attached one-car garage. Upstairs, all three bedrooms are privately arranged together, highlighted by an expansive primary suite with multiple closets and an ensuite bathroom.`
  }
];

async function main() {
  console.log("=== CHOICE PROPERTIES CHARLOTTE ZILLOW BATCH ENRICHMENT & PUBLISHING ===");
  console.log(`Processing ${PROPERTIES_DATA.length} candidate properties...\n`);

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

  fs.writeFileSync("/tmp/published_charlotte_results.json", JSON.stringify(publishedResults, null, 2));
}

main().catch(err => {
  console.error("FATAL ERROR in pipeline enrichment:", err);
  process.exit(1);
});
