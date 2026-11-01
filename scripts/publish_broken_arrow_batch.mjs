import crypto from 'crypto';

const SUPABASE_URL = "https://tlfmwetmhthpyrytrcfo.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE";
const HEADERS = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json"
};

async function processBatch() {
  // 1. Process 308 W College St (PP-68B093C7)
  const pipeRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.PP-68B093C7&select=*`, {
    headers: { ...HEADERS, "Accept-Profile": "pipeline" }
  });
  const [p] = await pipeRes.json();
  const photos = typeof p.original_image_urls === "string" ? JSON.parse(p.original_image_urls) : p.original_image_urls;

  const choiceId = crypto.randomUUID();
  const enrichedDesc = `308 W College St is an architectural two-bedroom home in Broken Arrow's vibrant Rose District, located just three blocks west of Main Street and directly across from the local library. The interior showcases a unique multi-level design, featuring an elevated living room with an open loft, an eat-in kitchen with a gas range, and a full bathroom on the upper level with warm wood floors.

Downstairs, two private bedrooms provide painted concrete flooring and comfortable separation from the main living quarters. Additional functional highlights include newer energy-efficient windows throughout, a versatile bonus room at the rear of the home, dedicated in-unit washer and dryer connections, and central heating and air conditioning. Outdoors, enjoy a fully fenced backyard setting, with water, sewer, and trash collection services included. Situated moments from downtown Broken Arrow's shopping, dining, and community arts.`;

  const propPayload = {
    id: choiceId,
    title: p.title || "2BR SINGLE FAMILY in Broken Arrow",
    description: enrichedDesc,
    address: p.address.trim(),
    city: p.city.trim(),
    state: p.state.trim(),
    zip: p.zip.trim(),
    property_type: "SINGLE_FAMILY",
    bedrooms: 2,
    bathrooms: 1.0,
    half_bathrooms: 0,
    total_bathrooms: 1.0,
    square_footage: 900,
    monthly_rent: 1200, // Reduced from 1250 to 1200 per user instruction
    security_deposit: 1200, // 1x monthly rent in DB
    application_fee: 50,
    pets_allowed: true,
    smoking_allowed: false,
    lease_terms: null,
    minimum_lease_months: null,
    status: "active",
    listed_at: "2026-09-27",
    available_date: "2026-11-01",
    garage_spaces: 0,
    parking: "Off-Street Parking",
    flooring: ["Wood", "Painted Concrete"],
    amenities: [
      "Rose District Location",
      "Wood Floors Upstairs",
      "Painted Concrete Floors Downstairs",
      "Loft Living Room",
      "Bonus Room",
      "Fully Fenced Yard",
      "Newer Windows",
      "Central Heat & Air",
      "In-Unit Washer/Dryer Hookups",
      "Water, Sewer & Trash Included"
    ],
    appliances: ["Gas Range / Oven", "Washer/Dryer Hookups"],
    views_count: 0,
    saves_count: 0,
    applications_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/properties`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(propPayload)
  });
  if (!insertRes.ok) {
    throw new Error(`Failed to insert property: ${await insertRes.text()}`);
  }
  console.log(`Inserted property ${choiceId} for ${p.address}`);

  // Insert photos
  const photoPayload = photos.map((url, idx) => ({
    property_id: choiceId,
    url: url,
    display_order: idx + 1,
    is_hero: idx === 0,
    created_at: new Date().toISOString()
  }));
  const photoRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(photoPayload)
  });
  if (!photoRes.ok) {
    throw new Error(`Failed to insert photos: ${await photoRes.text()}`);
  }
  console.log(`Inserted ${photos.length} photos for ${choiceId}`);

  // Update pipeline property for PP-68B093C7
  await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.PP-68B093C7`, {
    method: "PATCH",
    headers: { ...HEADERS, "Content-Profile": "pipeline" },
    body: JSON.stringify({
      status: "published",
      choice_property_id: choiceId,
      monthly_rent: 1200,
      security_deposit: 1200,
      application_fee: 50,
      pets_allowed: true,
      smoking_allowed: false,
      lease_terms: null,
      description: enrichedDesc,
      available_date: "2026-11-01",
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
  });
  console.log("Updated PP-68B093C7 pipeline record to published");

  // 2. Mark PP-BA81E11D and PP-B6A2448E as rejected in pipeline due to <6 photos
  for (const rejId of ["PP-BA81E11D", "PP-B6A2448E"]) {
    await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${rejId}`, {
      method: "PATCH",
      headers: { ...HEADERS, "Content-Profile": "pipeline" },
      body: JSON.stringify({
        status: "rejected",
        notes: "Rejected from publication: property has only 5 photos (minimum 6 required per Rule 4.C/13/15/21).",
        updated_at: new Date().toISOString()
      })
    });
    console.log(`Marked ${rejId} as rejected in pipeline`);
  }

  console.log(`\nPublished link: https://choice-properties-site.pages.dev/property.html?id=${choiceId}`);
}

processBatch().catch(console.error);
