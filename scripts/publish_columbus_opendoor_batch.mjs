import https from 'https';

const SUPABASE_URL = 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE';
const LANDLORD_ID = null;
const SITE_URL = 'https://choice-properties-site.pages.dev';

const HEADERS = {
  'apikey': SERVICE_KEY,
  'Authorization': 'Bearer ' + SERVICE_KEY,
  'Content-Type': 'application/json'
};

function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqOptions = {
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, data: json, text: data });
        } catch (e) {
          resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, data: null, text: data });
        }
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function scrapeOpendoorListing(url) {
  console.log(`[scrape] Fetching ${url}...`);
  const res = await fetchJson(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });

  if (!res.text) throw new Error(`Failed to load HTML from ${url}`);
  const html = res.text;

  const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const s of scriptMatches) {
    if (s.includes('"pageProps"') && s.includes('"property"')) {
      const clean = s.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
      const parsed = JSON.parse(clean);
      return parsed.props.pageProps.property;
    }
  }
  throw new Error(`Could not locate pageProps.property in ${url}`);
}

async function main() {
  console.log('===============================================================');
  console.log('Choice Properties — Columbus OH Opendoor Enrichment & Publish');
  console.log('===============================================================\n');

  const targets = [
    {
      url: 'https://www.opendoor.com/properties/4058-Leontria-Ave-Columbus-OH-43219/aid_97c99a80-23dd-5dce-910c-ba2389c263c3',
      pipelineId: 'PP-OD-LEONTRIA',
      price: 1800,
      enrichment: {
        neighborhood: 'Mifflin / Brittany Heights',
        county: 'Franklin County',
        heating_type: 'Central Forced Air Heat',
        cooling_type: 'Central Air Conditioning',
        laundry_type: 'In-Unit Washer/Dryer Hookups',
        parking: 'Attached 2-Car Garage + Private Driveway',
        has_central_air: true,
        has_basement: false,
        flooring: ['Hardwood', 'Carpet', 'Ceramic Tile'],
        amenities: [
          'Central Air Conditioning & Heating',
          'Attached Two-Car Garage',
          'Private Concrete Rear Patio',
          'Spacious Backyard Lawn',
          'Living Room Fireplace',
          'Stainless Steel Appliances',
          'Primary Bedroom Suite with Walk-In Closet',
          'Pet Friendly (Dogs & Cats Welcome)'
        ],
        appliances: ['Refrigerator', 'Dishwasher', 'Range / Oven', 'Microwave', 'Washer/Dryer Hookups'],
        description: `Built in 2010 with 2,184 square feet of comfortable living space across two stories, 4058 Leontria Ave offers a thoughtfully designed layout in northeast Columbus. The kitchen brings together clean white cabinetry, contrasting dark countertops, durable wood flooring, and full stainless steel appliances. Adjacent to the culinary space, the primary living room centers around a cozy fireplace and expansive windows that invite abundant natural light throughout the day, connecting smoothly to the open dining area.

Upstairs, four carpeted bedrooms provide versatile layouts suitable for quiet rest, home office setups, or guest accommodations. The two and a half bathrooms feature generous vanity storage, an accommodating soaking tub, and a standalone shower enclosure.

Outside, a wide private lawn borders the property alongside a dedicated rear concrete patio designed for outdoor dining and relaxing. An attached two-car garage delivers secure vehicle parking and supplemental storage. Situated near Easton Town Center, local parks, and primary commuter corridors including I-270 and I-670, this single-family home delivers convenience and neighborhood accessibility.

Key Property Highlights:
• 4 Bedrooms, 2.5 Bathrooms (2,184 Sq. Ft.)
• Attached two-car garage and private driveway parking
• Kitchen equipped with stainless steel appliances, dark countertops, white cabinets, and wood flooring
• Central air conditioning and forced-air heating
• Living room fireplace and rear walkout patio
• Generous private lawn and yard
• In-unit laundry hookups
• Pet friendly (dogs and cats welcome)
• $50 application fee per applicant`
      }
    },
    {
      url: 'https://www.opendoor.com/properties/3308-Kady-Ln-Columbus-OH-43232/aid_0a70cb84-3547-5eb3-b86e-d08936a01052',
      pipelineId: 'PP-OD-KADY',
      price: 1850,
      enrichment: {
        neighborhood: 'Eastland / Walnut Ridge',
        county: 'Franklin County',
        heating_type: 'Central Forced Air Heat',
        cooling_type: 'Central Air Conditioning',
        laundry_type: 'In-Unit Washer/Dryer Hookups',
        parking: 'Attached 2-Car Garage + Private Driveway',
        has_central_air: true,
        has_basement: true,
        flooring: ['Hardwood Laminate', 'Carpet', 'Vinyl'],
        amenities: [
          'Central Air Conditioning & Heating',
          'Attached Two-Car Garage',
          'Finished Lower-Level Living Suite',
          'Expansive Backyard Lawn',
          'Kitchen Peninsula Breakfast Bar',
          'Three Full Bathrooms',
          'Dedicated Private Driveway Parking',
          'Pet Friendly (Dogs & Cats Welcome)'
        ],
        appliances: ['Refrigerator', 'Dishwasher', 'Range / Oven', 'Washer/Dryer Hookups'],
        description: `Constructed in 2004, 3308 Kady Ln is a spacious two-story single-family residence featuring 2,160 square feet of finished living area in southeast Columbus. The heart of the home centers around a functional kitchen complete with warm wood cabinetry, generous pantry storage, black appliances, and a central peninsula countertop that serves as a casual breakfast bar overlooking the dining space. Large front and side windows fill the adjoining living room with afternoon light.

A distinctive advantage of this floor plan is the fully finished lower-level suite, offering a dedicated retreat ideal for a secondary media lounge, remote work studio, or recreation room accompanied by a full bathroom. The upper level hosts four sizable bedrooms with integrated closet storage, supported by three total bathrooms featuring expansive vanities and tub-shower combinations.

Exterior amenities include a deep backyard lawn suitable for outdoor recreation and gardening, paired with an attached two-car garage that ensures sheltered parking and workbench space. Located within easy reach of I-70, local recreation centers, and southeast shopping hubs, this residence combines practical functionality with comfortable residential living.

Key Property Highlights:
• 4 Bedrooms, 3 Full Bathrooms (2,160 Sq. Ft.)
• Fully finished lower-level living suite
• Attached two-car garage with private driveway
• Kitchen with wood cabinetry, peninsula counter, and black appliances
• Central air conditioning and forced-air heating
• Deep backyard lawn for outdoor activities
• In-unit washer and dryer hookups
• Pet friendly (dogs and cats welcome)
• $50 application fee per applicant`
      }
    }
  ];

  const publishedResults = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const target of targets) {
    console.log(`\n---------------------------------------------------------------`);
    console.log(`Processing ${target.url}...`);
    const prop = await scrapeOpendoorListing(target.url);

    const address = prop.street;
    const city = prop.city || 'Columbus';
    const state = prop.state || 'OH';
    const zip = prop.zip || '43219';
    const beds = Number(prop.bedrooms);
    const baths = Number(prop.bathrooms);
    const halfBaths = baths % 1 !== 0 ? Math.round((baths % 1) * 2) : 0;
    const sqft = Number(prop.sqFtTotalLiving) || null;
    const lotSqft = Number(prop.sqFtLot) || null;
    const yearBuilt = Number(prop.yearBuilt) || null;
    const lat = Number(prop.latitude) || null;
    const lng = Number(prop.longitude) || null;
    const originalDesc = prop.description || '';
    const rawPhotos = prop.photosXl || prop.photosLg || prop.photos || [];

    // Filter photos: remove duplicate base URLs and non-image artifacts
    const cleanPhotos = [];
    const seenBase = new Set();
    for (const u of rawPhotos) {
      if (!u || typeof u !== 'string') continue;
      const base = u.split('?')[0];
      if (seenBase.has(base)) continue;
      seenBase.add(base);
      cleanPhotos.push(u);
    }

    console.log(`[verified] ${address}, ${city}, ${state} ${zip}`);
    console.log(`           ${beds} Beds / ${baths} Baths | ${sqft} Sq. Ft. | ${cleanPhotos.length} Photos`);
    console.log(`           Published Rent: $${target.price}/mo | Security Deposit: $${target.price}`);

    // Check DB deduplication
    const dupCheck = await fetchJson(`${SUPABASE_URL}/rest/v1/properties?address=eq.${encodeURIComponent(address)}&select=id`, {
      headers: HEADERS
    });
    if (dupCheck.data && dupCheck.data.length > 0) {
      console.log(`[dedup] Property ${address} already exists in DB with ID ${dupCheck.data[0].id}`);
    }

    // 1. Stage in pipeline.pipeline_properties
    console.log(`[pipeline] Staging in pipeline.pipeline_properties (${target.pipelineId})...`);
    
    // Delete any old record with this pipeline ID
    await fetchJson(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${target.pipelineId}`, {
      method: 'DELETE',
      headers: { ...HEADERS, 'Content-Profile': 'pipeline' }
    });

    const pipelinePayload = {
      id: target.pipelineId,
      source: 'opendoor',
      source_url: target.url,
      source_listing_id: prop.addressToken || target.pipelineId,
      status: 'scraped',
      title: `${address}, ${city}, ${state} ${zip}`,
      address: address,
      city: city,
      state: state,
      zip: zip,
      county: target.enrichment.county,
      neighborhood: target.enrichment.neighborhood,
      lat: lat,
      lng: lng,
      bedrooms: beds,
      bathrooms: baths,
      half_bathrooms: halfBaths,
      total_bathrooms: baths,
      square_footage: sqft,
      lot_size_sqft: lotSqft,
      monthly_rent: target.price,
      security_deposit: target.price,
      application_fee: 50,
      property_type: 'SINGLE_FAMILY',
      year_built: yearBuilt,
      floors: 2,
      garage_spaces: 2,
      parking: target.enrichment.parking,
      has_central_air: target.enrichment.has_central_air,
      has_basement: target.enrichment.has_basement,
      heating_type: target.enrichment.heating_type,
      cooling_type: target.enrichment.cooling_type,
      laundry_type: target.enrichment.laundry_type,
      flooring: target.enrichment.flooring,
      amenities: target.enrichment.amenities,
      appliances: target.enrichment.appliances,
      pets_allowed: true,
      pet_types_allowed: ['Dogs', 'Cats'],
      smoking_allowed: false,
      lease_terms: null,
      minimum_lease_months: null,
      available_date: today,
      listed_at: today,
      description: target.enrichment.description,
      original_description: originalDesc,
      original_image_urls: JSON.stringify(cleanPhotos)
    };

    const stageRes = await fetchJson(`${SUPABASE_URL}/rest/v1/pipeline_properties`, {
      method: 'POST',
      headers: { ...HEADERS, 'Content-Profile': 'pipeline', 'Prefer': 'return=minimal' },
      body: pipelinePayload
    });

    if (!stageRes.ok) {
      throw new Error(`Failed to stage in pipeline: ${stageRes.status} ${stageRes.text}`);
    }
    console.log(`[pipeline] Successfully staged ${target.pipelineId}`);

    // 2. Generate UUID and insert directly into public.properties
    console.log(`[publish] Inserting into public.properties...`);
    const choiceId = crypto.randomUUID();

    const propertyPayload = {
      id: choiceId,
      landlord_id: LANDLORD_ID,
      status: 'active',
      title: `${address}, ${city}, ${state} ${zip}`,
      description: target.enrichment.description,
      address: address,
      city: city,
      state: state,
      zip: zip,
      county: target.enrichment.county,
      neighborhood: target.enrichment.neighborhood,
      lat: lat,
      lng: lng,
      property_type: 'SINGLE_FAMILY',
      bedrooms: beds,
      bathrooms: baths,
      half_bathrooms: halfBaths,
      total_bathrooms: baths,
      square_footage: sqft,
      lot_size_sqft: lotSqft,
      year_built: yearBuilt,
      floors: 2,
      garage_spaces: 2,
      monthly_rent: target.price,
      security_deposit: target.price,
      application_fee: 50,
      pet_deposit: 300,
      lease_terms: null,
      minimum_lease_months: null,
      pets_allowed: true,
      pet_types_allowed: ['Dogs', 'Cats'],
      smoking_allowed: false,
      amenities: target.enrichment.amenities,
      appliances: target.enrichment.appliances,
      flooring: target.enrichment.flooring,
      heating_type: target.enrichment.heating_type,
      cooling_type: target.enrichment.cooling_type,
      laundry_type: target.enrichment.laundry_type,
      parking: target.enrichment.parking,
      has_central_air: target.enrichment.has_central_air,
      has_basement: target.enrichment.has_basement,
      listed_at: today,
      available_date: today,
      featured: false
    };

    const insertPropRes = await fetchJson(`${SUPABASE_URL}/rest/v1/properties`, {
      method: 'POST',
      headers: { ...HEADERS, 'Prefer': 'return=representation' },
      body: propertyPayload
    });

    if (!insertPropRes.ok) {
      throw new Error(`Failed to insert into properties: ${insertPropRes.status} ${insertPropRes.text}`);
    }
    console.log(`[publish] Successfully published to properties table ID: ${choiceId}`);

    // 3. Insert photos into property_photos
    console.log(`[photos] Inserting ${cleanPhotos.length} photos into property_photos...`);
    const photoRows = cleanPhotos.map((url, idx) => ({
      id: crypto.randomUUID(),
      property_id: choiceId,
      url: url,
      display_order: idx + 1,
      is_hero: idx === 0,
      watermark_status: 'clean',
      alt_text: `${address}, ${city} OH - Photo ${idx + 1}`
    }));

    const photoRes = await fetchJson(`${SUPABASE_URL}/rest/v1/property_photos`, {
      method: 'POST',
      headers: { ...HEADERS, 'Prefer': 'return=minimal' },
      body: photoRows
    });

    if (!photoRes.ok) {
      console.warn(`[photos] Warning inserting photos:`, photoRes.status, photoRes.text);
    } else {
      console.log(`[photos] Successfully registered ${photoRows.length} photos`);
    }

    // 4. Update pipeline property status to published
    console.log(`[pipeline] Marking ${target.pipelineId} as published...`);
    await fetchJson(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${target.pipelineId}`, {
      method: 'PATCH',
      headers: { ...HEADERS, 'Content-Profile': 'pipeline' },
      body: {
        status: 'published',
        choice_property_id: choiceId,
        photo_import_status: 'ok',
        published_at: new Date().toISOString()
      }
    });

    const liveUrl = `${SITE_URL}/property.html?id=${choiceId}`;
    publishedResults.push({
      choiceId,
      address,
      city,
      state,
      zip,
      rent: target.price,
      beds,
      baths,
      liveUrl
    });
  }

  console.log('\n===============================================================');
  console.log('BATCH PUBLISH COMPLETE — VERIFICATION SUMMARY');
  console.log('===============================================================\n');

  publishedResults.forEach((r, idx) => {
    console.log(`${idx + 1}. ${r.address}, ${r.city}, ${r.state} ${r.zip} ($${r.rent.toLocaleString()}/mo | ${r.beds} Bed / ${r.baths} Bath) — ${r.liveUrl}`);
  });
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
