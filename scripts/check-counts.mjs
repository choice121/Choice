import fetch from 'node-fetch';

const SUPABASE_URL = 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE';

async function fetchDbCount(endpoint, schema = 'public') {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const res = await fetch(url, {
    method: 'HEAD',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Accept': 'application/json',
      'Accept-Profile': schema,
      'Content-Profile': schema,
      'Prefer': 'count=exact'
    }
  });
  const contentRange = res.headers.get('content-range');
  if (contentRange) {
    const parts = contentRange.split('/');
    return parseInt(parts[1], 10);
  }
  return null;
}

async function fetchDbAll(endpoint, schema = 'public') {
  let allRows = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const sep = endpoint.includes('?') ? '&' : '?';
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}${sep}offset=${offset}&limit=${limit}`;
    const res = await fetch(url, {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Accept': 'application/json',
        'Accept-Profile': schema,
        'Content-Profile': schema,
      }
    });
    if (!res.ok) {
      throw new Error(`DB fetch error ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    allRows = allRows.concat(data);
    if (data.length < limit) break;
    offset += limit;
  }
  return allRows;
}

async function main() {
  const propCount = await fetchDbCount('properties');
  const photoCount = await fetchDbCount('property_photos');
  const pipelineCount = await fetchDbCount('pipeline_properties', 'pipeline');
  
  console.log(`Total properties count in public: ${propCount}`);
  console.log(`Total property_photos count in public: ${photoCount}`);
  console.log(`Total pipeline_properties count in pipeline: ${pipelineCount}`);

  // Fetch recent 50 properties
  const recentProps = await fetchDbAll('properties?select=id,title,address,city,state,zip,monthly_rent,bedrooms,bathrooms,status,created_at&order=created_at.desc&limit=50');
  
  // For each of the top 20 recent properties, let's see their actual photo count in property_photos
  console.log('\n--- Recent 20 Properties & Photo Counts ---');
  for (let i = 0; i < Math.min(20, recentProps.length); i++) {
    const p = recentProps[i];
    const photos = await fetchDbAll(`property_photos?property_id=eq.${p.id}&select=id,url,display_order,is_hero&order=display_order.asc`);
    console.log(`${i+1}. ${p.address}, ${p.city}, ${p.state} ${p.zip} (ID: ${p.id})`);
    console.log(`   Photos in DB: ${photos.length} | Status: ${p.status} | Created: ${p.created_at}`);
    if (photos.length > 0) {
      console.log(`   Hero: ${photos[0].url}`);
    }
  }

  // Check pipeline properties
  console.log('\n--- Recent 10 Pipeline Properties ---');
  const recentPipeline = await fetchDbAll('pipeline_properties?select=id,title,address,city,state,zip,rent,status,photo_import_status,last_photo_import_error,original_image_urls,choice_property_id&order=updated_at.desc&limit=10', 'pipeline');
  for (let i = 0; i < Math.min(10, recentPipeline.length); i++) {
    const pl = recentPipeline[i];
    let imgs = [];
    if (pl.original_image_urls) {
      try {
        imgs = typeof pl.original_image_urls === 'string' ? JSON.parse(pl.original_image_urls) : pl.original_image_urls;
      } catch (_) {}
    }
    console.log(`${i+1}. ${pl.address}, ${pl.city}, ${pl.state} (Pipeline ID: ${pl.id})`);
    console.log(`   Status: ${pl.status} | Photo Status: ${pl.photo_import_status} | Extracted Images: ${Array.isArray(imgs) ? imgs.length : 0} | Published Choice ID: ${pl.choice_property_id || 'None'}`);
    if (pl.last_photo_import_error) {
      console.log(`   Error: ${pl.last_photo_import_error}`);
    }
  }
}

main().catch(console.error);
