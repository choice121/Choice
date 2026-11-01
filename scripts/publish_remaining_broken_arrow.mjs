import crypto from 'crypto';

const SUPABASE_URL = "https://tlfmwetmhthpyrytrcfo.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE";
const HEADERS = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json"
};

const PROPERTIES = [
  {
    pipeId: 'PP-BA81E11D',
    address: '1006 N 4th St',
    city: 'Broken Arrow',
    state: 'OK',
    zip: '74012',
    rent: 1100,
    beds: 2,
    baths: 1.0,
    sqft: 1000,
    garage_spaces: 1,
    parking: 'Attached 1-Car Garage + Driveway',
    flooring: ['Hardwood', 'Tile'],
    amenities: [
      'Original Hardwood Flooring',
      'Attached 1-Car Garage',
      'Large Fenced Backyard',
      'Near Rose District',
      'Close to Schools and Shopping',
      'Pet Friendly'
    ],
    appliances: ['Range / Oven'],
    description: `1006 N 4th St is a charming two-bedroom single-family home located in a quiet, established Broken Arrow neighborhood moments from the Rose District. The residence highlights classic solid hardwood flooring throughout the main living areas and bedrooms, illuminated by plentiful natural window light.

The kitchen provides efficient meal prep space and connects smoothly to the dedicated dining and living rooms. An attached one-car garage supplies sheltered vehicle parking and extra utility storage. Outside, enjoy a generously sized, fully fenced backyard ideal for pets and outdoor living. Superbly situated near local neighborhood schools, parks, and Broken Arrow's downtown dining and shopping corridor.`
  },
  {
    pipeId: 'PP-B6A2448E',
    address: '310 W Galveston St',
    city: 'Broken Arrow',
    state: 'OK',
    zip: '74012',
    rent: 1100,
    beds: 2,
    baths: 1.0,
    sqft: 950,
    garage_spaces: 0,
    parking: 'Off-Street Parking',
    flooring: ['Hardwood', 'Tile'],
    amenities: [
      'Bonus Living Area',
      'Generous Backyard Lawn',
      'Walking Distance to Main Street',
      'Heart of Broken Arrow',
      'Pet Friendly'
    ],
    appliances: ['Range / Oven', 'Refrigerator'],
    description: `310 W Galveston St offers a comfortable and versatile two-bedroom home positioned directly in the heart of Broken Arrow. The layout includes an expanded bonus living area that provides flexible space for a home office, media room, or secondary gathering lounge.

The home features natural sunlight throughout, a clean and functional kitchen with essential cooking appliances, and a full central bathroom. Step outside to a spacious, private backyard ready for weekend relaxation and pet recreation. Outstanding walkability to downtown Broken Arrow's Main Street corridor, local cafes, and community festivals.`
  }
];

async function publishRemaining() {
  for (const item of PROPERTIES) {
    const pipeRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${item.pipeId}&select=*`, {
      headers: { ...HEADERS, "Accept-Profile": "pipeline" }
    });
    const [p] = await pipeRes.json();
    const photos = typeof p.original_image_urls === "string" ? JSON.parse(p.original_image_urls) : p.original_image_urls;

    const choiceId = crypto.randomUUID();
    const propPayload = {
      id: choiceId,
      title: p.title || `2BR SINGLE FAMILY in Broken Arrow`,
      description: item.description.trim(),
      address: item.address,
      city: item.city,
      state: item.state,
      zip: item.zip,
      property_type: 'SINGLE_FAMILY',
      bedrooms: item.beds,
      bathrooms: item.baths,
      half_bathrooms: 0,
      total_bathrooms: item.baths,
      square_footage: item.sqft,
      monthly_rent: item.rent,
      security_deposit: item.rent,
      application_fee: 50,
      pets_allowed: true,
      smoking_allowed: false,
      lease_terms: null,
      minimum_lease_months: null,
      status: 'active',
      listed_at: '2026-09-27',
      available_date: '2026-11-01',
      garage_spaces: item.garage_spaces,
      parking: item.parking,
      flooring: item.flooring,
      amenities: item.amenities,
      appliances: item.appliances,
      views_count: 0,
      saves_count: 0,
      applications_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/properties`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(propPayload)
    });
    if (!insertRes.ok) {
      throw new Error(`Failed to insert ${item.address}: ${await insertRes.text()}`);
    }
    console.log(`Inserted ${item.address} with ID ${choiceId}`);

    // Insert photos
    const photoPayload = photos.map((url, idx) => ({
      property_id: choiceId,
      url: url,
      display_order: idx + 1,
      is_hero: idx === 0,
      created_at: new Date().toISOString()
    }));
    const photoRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(photoPayload)
    });
    if (!photoRes.ok) {
      throw new Error(`Failed to insert photos for ${choiceId}: ${await photoRes.text()}`);
    }
    console.log(`Inserted ${photos.length} photos for ${choiceId}`);

    // Update pipeline record to published
    await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${item.pipeId}`, {
      method: 'PATCH',
      headers: { ...HEADERS, 'Content-Profile': 'pipeline' },
      body: JSON.stringify({
        status: 'published',
        choice_property_id: choiceId,
        monthly_rent: item.rent,
        security_deposit: item.rent,
        application_fee: 50,
        pets_allowed: true,
        smoking_allowed: false,
        lease_terms: null,
        description: item.description,
        available_date: '2026-11-01',
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    });
    console.log(`Updated ${item.pipeId} to published`);
    console.log(`Link: https://choice-properties-site.pages.dev/property.html?id=${choiceId}`);
  }
}

publishRemaining().catch(console.error);
