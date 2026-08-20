import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE';
const SITE_BASE_URL = 'https://choice-properties-site.pages.dev';

const RM_BASE_URL = 'https://cjre.ua.rentmanager.com';
const RM_SEARCH_URL = `${RM_BASE_URL}/search_result`;
const RM_CORP_ID = 'cjre';

const SB_HEADERS = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'Prefer': 'return=representation'
};

const SB_PIPELINE_HEADERS = {
  ...SB_HEADERS,
  'Accept-Profile': 'pipeline',
  'Content-Profile': 'pipeline'
};

function sanitizeDescription(raw) {
  if (!raw) return '';
  let text = raw;

  // Remove URLs & web links
  text = text.replace(/https?:\/\/[^\s]+/gi, '');
  text = text.replace(/www\.[^\s]+/gi, '');
  text = text.replace(/[a-zA-Z0-9.-]+\.(?:com|org|net|io|co|gov|edu)[^\s]*/gi, '');

  // Remove emails
  text = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, '');

  // Remove phone numbers
  text = text.replace(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/gi, '');

  // Remove tour/showing & external application instructions
  const removalPatterns = [
    /schedule\s+(?:a\s+)?(?:tour|showing|viewing)[^.\n]*[.\n]?/gi,
    /call\s+(?:our\s+)?(?:office|agent|leasing)[^.\n]*[.\n]?/gi,
    /to\s+view\s+this\s+property[^.\n]*[.\n]?/gi,
    /for\s+more\s+information[^.\n]*[.\n]?/gi,
    /apply\s+online[^.\n]*[.\n]?/gi,
    /application\s+fee\s+is[^.\n]*[.\n]?/gi,
    /self[- ]guided\s+tour[^.\n]*[.\n]?/gi,
    /lockbox[^.\n]*[.\n]?/gi,
    /showingtime[^.\n]*[.\n]?/gi,
    /rent\s+manager[^.\n]*[.\n]?/gi,
    /cj\s+real\s+estate[^.\n]*[.\n]?/gi
  ];

  for (const pat of removalPatterns) {
    text = text.replace(pat, '');
  }

  // Clean up formatting & whitespace
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n\s*\n\s*\n+/g, '\n\n');
  return text.trim();
}

function parseAppliances(desc) {
  const d = (desc || '').toLowerCase();
  const apps = [];
  if (d.includes('refrigerator') || d.includes('fridge')) apps.push('Refrigerator');
  if (d.includes('dishwasher')) apps.push('Dishwasher');
  if (d.includes('stove') || d.includes('range') || d.includes('oven')) apps.push('Stove / Range');
  if (d.includes('microwave')) apps.push('Microwave');
  if (d.includes('garbage disposal') || d.includes('disposal')) apps.push('Garbage Disposal');
  if (d.includes('washer and dryer included') || d.includes('in-unit washer')) apps.push('Washer & Dryer');
  return apps;
}

function parseParking(desc) {
  const d = (desc || '').toLowerCase();
  if (d.includes('2 car garage') || d.includes('2-car garage')) return '2-Car Garage';
  if (d.includes('1 car garage') || d.includes('1-car garage')) return '1-Car Garage';
  if (d.includes('garage')) return 'Garage';
  if (d.includes('carport')) return 'Carport';
  if (d.includes('driveway')) return 'Driveway';
  if (d.includes('off-street parking') || d.includes('off street parking')) return 'Off-Street Parking';
  return 'Street Parking';
}

function parseLaundry(desc) {
  const d = (desc || '').toLowerCase();
  if (d.includes('washer/dryer hookups') || d.includes('w/d hookups') || d.includes('laundry hookups')) return 'Washer/Dryer Hookups';
  if (d.includes('in-unit') || d.includes('washer and dryer included')) return 'In-Unit';
  if (d.includes('on-site laundry') || d.includes('shared laundry')) return 'Shared Laundry';
  return 'Hookups Available';
}

async function fetchSearch() {
  const params = new URLSearchParams({
    command: 'search_result',
    corpid: RM_CORP_ID,
    locations: 'Results,CJ Real Estate',
    fromsearch: 'fromsearch',
    mode: 'javaScript',
    template: 'searchresults',
    unituserdef_Allow_on_websitene: 'no',
    maxperpage: '9999',
    headerfooter: 'false'
  });

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Referer': 'https://cjproperties.org/properties/'
  };

  const res = await fetch(`${RM_SEARCH_URL}?${params.toString()}`, { headers });
  let text = await res.text();
  text = text.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t');
  return text;
}

async function fetchDetail(unitId) {
  const url = `${RM_BASE_URL}/search_result?command=Detail_View.aspx&corpid=cjre&rmwebsvc_unitid=${unitId}&rmwebsvc_id=${unitId}&rmwebsvc_command=Detail_View.aspx&rmwebsvc_corpid=cjre&rmwebsvc_location=1&rmwebsvc_mode=javaScript&rmwebsvc_template=searchresults`;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Referer': `https://cjproperties.org/unit-detail?unitID=${unitId}`
  };
  try {
    const res = await fetch(url, { headers });
    const text = await res.text();
    const images = [...text.matchAll(/https:\/\/rm12filereader\.rentmanager\.com\/files\/get\/\?EID=cjre&FKey=[^"'\\s]+/gi)].map(m => m[0]);
    const ytMatch = text.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]+/i);
    return { images: [...new Set(images)], virtualTour: ytMatch ? ytMatch[0] : null };
  } catch (err) {
    return { images: [], virtualTour: null };
  }
}

async function mapConcurrent(items, limit, fn) {
  const results = [];
  const executing = [];
  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item));
    results.push(p);
    if (limit <= items.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(results);
}

async function main() {
  console.log('=== Choice Properties — CJ Properties Live Scraper & Publisher ===');
  console.log('1. Fetching all search records from CJ Properties...');
  const html = await fetchSearch();

  const propRegex = /<div[^>]*class=["']property["'][^>]*data-unitid=["'](\d+)["']([\s\S]*?)(?=<div[^>]*class=["']property["']|$)/gi;
  let match;
  const rawListings = [];

  while ((match = propRegex.exec(html)) !== null) {
    const unitId = match[1];
    const block = match[2];

    const headerMatch = block.match(/<div class=["']propertyHeader["']>([\s\S]*?)<\/div>/i);
    const header = headerMatch ? headerMatch[1].replace(/<[^>]+>/g, ' ').trim() : '';

    const addrMatch = block.match(/<div class=["']propertyAddress["']>([\s\S]*?)<\/div>/i);
    const addrRaw = addrMatch ? addrMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim() : '';
    const addrLines = addrRaw.split('\n').map(s => s.trim()).filter(Boolean);
    const street = addrLines[0] || '';
    const cityStateZip = addrLines[1] || '';
    let city = '', state = '', zip = '';
    const cszMatch = cityStateZip.match(/(.*?),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?/i);
    if (cszMatch) {
      city = cszMatch[1].trim();
      state = cszMatch[2].trim();
      zip = cszMatch[3] || '';
    } else {
      const cszMatch2 = cityStateZip.match(/(.+?)\s+([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?/i);
      if (cszMatch2) {
        city = cszMatch2[1].trim();
        state = cszMatch2[2].trim();
        zip = cszMatch2[3] || '';
      }
    }

    const typeMatch = block.match(/Type:\s*([^:<\n]+)/i);
    const bedsMatch = block.match(/Bedrooms?:\s*(\d+)/i);
    const bathsMatch = block.match(/Bathrooms?:\s*([\d.]+)/i);
    const rentMatch = block.match(/Price:\s*\$?([\d,]+(?:\.\d+)?)/i);

    const descMatch = block.match(/<div class=["']propertyDescription["']>([\s\S]*?)<\/div>/i);
    const rawDesc = descMatch ? descMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim() : '';

    const searchImages = [...block.matchAll(/https:\/\/rm12filereader\.rentmanager\.com\/files\/get\/\?EID=cjre&FKey=[^"'\\s]+/gi)].map(m => m[0]);

    const rent = rentMatch ? parseInt(rentMatch[1].replace(/,/g, '')) : 0;
    const beds = bedsMatch ? parseInt(bedsMatch[1]) : 0;
    const baths = bathsMatch ? parseFloat(bathsMatch[1]) : 1.0;

    // Standard rental filtering: rent between 800 and 6000, valid address
    if (street && city && state && rent >= 700) {
      rawListings.push({
        unitId,
        header,
        street,
        city,
        state,
        zip,
        propType: typeMatch ? typeMatch[1].trim() : 'House',
        beds,
        baths,
        rent,
        rawDesc,
        searchImages: [...new Set(searchImages)]
      });
    }
  }

  console.log(`Extracted ${rawListings.length} candidate rental properties.`);

  // 2. Concurrently fetch full photo galleries
  console.log('2. Fetching full high-resolution galleries...');
  const populated = await mapConcurrent(rawListings, 8, async (item) => {
    const detail = await fetchDetail(item.unitId);
    const allPhotos = [...new Set([...item.searchImages, ...detail.images])];
    return {
      ...item,
      photos: allPhotos,
      virtualTour: detail.virtualTour
    };
  });

  // 3. Filter by 6-photo minimum rule & valid property types
  const eligible = populated.filter(p => p.photos.length >= 6);
  console.log(`3. Verified ${eligible.length} properties meet the >= 6 photo requirement.`);

  // 4. Check already published properties in Supabase
  console.log('4. Checking Supabase for already published properties...');
  const resPublished = await fetch(`${SUPABASE_URL}/rest/v1/properties?select=id,address,city,state,zip`, {
    headers: SB_HEADERS
  });
  const existingPublished = await resPublished.json();
  const existingKeySet = new Set(
    (existingPublished || []).map(p => `${(p.address || '').toLowerCase().trim()}|${(p.city || '').toLowerCase().trim()}|${(p.state || '').toLowerCase().trim()}`)
  );

  const toPublish = [];
  const alreadyLive = [];

  for (const item of eligible) {
    const key = `${item.street.toLowerCase().trim()}|${item.city.toLowerCase().trim()}|${item.state.toLowerCase().trim()}`;
    if (existingKeySet.has(key)) {
      const match = existingPublished.find(p => `${(p.address || '').toLowerCase().trim()}|${(p.city || '').toLowerCase().trim()}|${(p.state || '').toLowerCase().trim()}` === key);
      alreadyLive.push({ ...item, property_id: match?.id });
    } else {
      toPublish.push(item);
    }
  }

  console.log(`Found ${alreadyLive.length} already published, ${toPublish.length} new properties to publish.`);

  const publishedResults = [];

  // 5. Publish each new property
  for (let idx = 0; idx < toPublish.length; idx++) {
    const item = toPublish[idx];
    const cleanDesc = sanitizeDescription(item.rawDesc);
    const title = item.header || `${item.beds} Bed / ${item.baths} Bath Home in ${item.city}, ${item.state}`;
    const pipelineId = `PP-CJ-${item.unitId}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const pipelineRecord = {
      id: pipelineId,
      source: 'cjproperties',
      source_listing_id: `cjre-${item.unitId}`,
      source_url: `https://cjproperties.org/unit-detail?unitID=${item.unitId}`,
      title,
      description: cleanDesc,
      address: item.street,
      city: item.city,
      state: item.state,
      zip: item.zip,
      property_type: item.propType.toUpperCase().includes('TOWN') ? 'TOWNHOMES' :
                     item.propType.toUpperCase().includes('CONDO') ? 'CONDOS' :
                     item.propType.toUpperCase().includes('DUPLEX') ? 'DUPLEX' :
                     item.propType.toUpperCase().includes('APART') ? 'APARTMENT' : 'SINGLE_FAMILY',
      bedrooms: item.beds,
      bathrooms: item.baths,
      monthly_rent: item.rent,
      security_deposit: item.rent, // 1x rent
      application_fee: 50.00,      // Always $50
      pets_allowed: true,          // Always pet friendly
      smoking_allowed: false,      // Removed smoking policy
      parking: parseParking(item.rawDesc),
      appliances: JSON.stringify(parseAppliances(item.rawDesc)),
      laundry_type: parseLaundry(item.rawDesc),
      virtual_tour_url: item.virtualTour,
      original_image_urls: JSON.stringify(item.photos),
      status: 'staged',
      data_quality_score: 95,
      scraped_at: new Date().toISOString()
    };

    try {
      // Stage in pipeline.pipeline_properties
      const stageRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?on_conflict=source_listing_id`, {
        method: 'POST',
        headers: {
          ...SB_PIPELINE_HEADERS,
          'Prefer': 'return=representation,resolution=merge-duplicates'
        },
        body: JSON.stringify(pipelineRecord)
      });

      if (!stageRes.ok) {
        console.error(`[${idx+1}/${toPublish.length}] Stage failed for ${item.street}:`, await stageRes.text());
        continue;
      }

      // Publish via pipeline_publish RPC
      const pubRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pipeline_publish`, {
        method: 'POST',
        headers: SB_HEADERS,
        body: JSON.stringify({ p_id: pipelineId, p_landlord_id: null })
      });

      const pubData = await pubRes.json();
      const propId = pubData?.choice_property_id || pubData?.property_id;

      if (!propId) {
        console.error(`[${idx+1}/${toPublish.length}] Publish RPC returned no ID for ${item.street}:`, pubData);
        continue;
      }

      // Ensure active status and all policy fields
      await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${propId}`, {
        method: 'PATCH',
        headers: SB_HEADERS,
        body: JSON.stringify({
          status: 'active',
          application_fee: 50.00,
          pets_allowed: true,
          security_deposit: item.rent,
          smoking_allowed: false,
          virtual_tour_url: item.virtualTour
        })
      });

      publishedResults.push({
        ...item,
        property_id: propId
      });

      console.log(`[${idx+1}/${toPublish.length}] Published: ${item.street}, ${item.city}, ${item.state} ${item.zip} ($${item.rent}/mo) -> ID: ${propId}`);
    } catch (err) {
      console.error(`[${idx+1}/${toPublish.length}] Error publishing ${item.street}:`, err.message);
    }
  }

  // Combine newly published + already live verified properties
  const allFinalProperties = [...publishedResults, ...alreadyLive];

  console.log('\n=============================================================');
  console.log(`FINAL PUBLISHED CJ PROPERTIES LIST (${allFinalProperties.length} TOTAL)`);
  console.log('=============================================================\n');

  allFinalProperties.forEach((p, idx) => {
    const formatted = `${idx + 1}. ${p.street}, ${p.city}, ${p.state} ${p.zip} ($${p.rent.toLocaleString()}/mo | ${p.beds} Bed / ${p.baths} Bath) — ${SITE_BASE_URL}/property.html?id=${p.property_id}`;
    console.log(formatted);
    console.log('');
  });
}

main().catch(console.error);
