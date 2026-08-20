import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE';

async function fetchDb(endpoint, schema = 'public') {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
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
    const text = await res.text();
    throw new Error(`DB Fetch Error ${res.status}: ${text}`);
  }
  return await res.json();
}

async function checkUrl(url, timeoutMs = 6000) {
  if (!url || typeof url !== 'string') return { ok: false, status: 0, error: 'Empty URL' };
  if (url.startsWith('/')) {
    const localPath = path.join(process.cwd(), url.replace(/^\//, ''));
    const exists = fs.existsSync(localPath);
    return { ok: exists, status: exists ? 200 : 404, type: 'local', error: exists ? null : 'File not found locally' };
  }
  
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (res.status === 405 || res.status === 403) {
      const getRes = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Range': 'bytes=0-100'
        }
      });
      return { ok: getRes.ok || getRes.status === 206 || getRes.status === 304, status: getRes.status, type: 'remote' };
    }
    return { ok: res.ok || res.status === 304, status: res.status, type: 'remote' };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, status: 0, type: 'remote', error: err.message };
  }
}

async function runDeepScan() {
  console.log('================================================================');
  console.log(' CHOICE PROPERTIES — COMPREHENSIVE IMAGE SYSTEM DEEP SCAN');
  console.log(' Timestamp: ' + new Date().toISOString());
  console.log('================================================================\n');

  // 1. STATIC ASSETS AUDIT
  console.log('--- 1. STATIC ASSETS AUDIT ---');
  const assetFiles = [
    '/assets/avatar-placeholder.svg',
    '/assets/favicon.svg',
    '/assets/icon-192.png',
    '/assets/icon-512.png',
    '/assets/og-cover.jpg',
    '/assets/placeholder-property.jpg',
    '/assets/placeholder-property.svg'
  ];
  for (const asset of assetFiles) {
    const p = path.join(process.cwd(), asset.replace(/^\//, ''));
    if (fs.existsSync(p)) {
      const stat = fs.statSync(p);
      console.log(`  [OK] ${asset} (${(stat.size / 1024).toFixed(1)} KB)`);
    } else {
      console.log(`  [FAIL] ${asset} (MISSING ON DISK)`);
    }
  }

  // 2. FETCH SAMPLE PHOTO SCHEMA & COUNTS
  console.log('\n--- 2. DATABASE SCHEMA & COUNTS ---');
  const samplePhoto = await fetchDb('property_photos?select=*&limit=1');
  console.log('property_photos columns:', Object.keys(samplePhoto[0] || {}));

  // Fetch properties (active or all)
  const properties = await fetchDb('properties?select=id,title,address,city,state,zip,monthly_rent,bedrooms,bathrooms,status,created_at&order=created_at.desc');
  console.log(`Total properties in public.properties: ${properties.length}`);

  // Fetch all property photos in chunks or total
  const allPhotos = await fetchDb('property_photos?select=id,property_id,url,file_id,display_order,is_hero,created_at&order=display_order.asc&limit=10000');
  console.log(`Total property_photos retrieved: ${allPhotos.length}`);

  const photosByProperty = new Map();
  const domainDistribution = {};
  for (const photo of allPhotos) {
    if (!photosByProperty.has(photo.property_id)) {
      photosByProperty.set(photo.property_id, []);
    }
    photosByProperty.get(photo.property_id).push(photo);

    try {
      const u = new URL(photo.url);
      domainDistribution[u.hostname] = (domainDistribution[u.hostname] || 0) + 1;
    } catch {
      domainDistribution['invalid_or_local'] = (domainDistribution['invalid_or_local'] || 0) + 1;
    }
  }

  console.log('\nImage CDN/Domain Distribution in Database:');
  for (const [dom, count] of Object.entries(domainDistribution)) {
    console.log(`  - ${dom}: ${count} photos`);
  }

  // Check photo health
  let propertiesWithMin6Photos = 0;
  let propertiesBelow6Photos = 0;
  let propertiesWithZeroPhotos = 0;
  let brokenPhotosCount = 0;
  let totalPhotoUrlsChecked = 0;
  const zeroPhotoProps = [];
  const lowPhotoProps = [];

  console.log('\nScanning published listings photo compliance...');
  for (const prop of properties) {
    const photos = photosByProperty.get(prop.id) || [];
    const count = photos.length;
    
    if (count >= 6) {
      propertiesWithMin6Photos++;
    } else if (count === 0) {
      propertiesWithZeroPhotos++;
      zeroPhotoProps.push({ id: prop.id, address: `${prop.address}, ${prop.city}, ${prop.state}`, status: prop.status });
    } else {
      propertiesBelow6Photos++;
      lowPhotoProps.push({ id: prop.id, address: `${prop.address}, ${prop.city}, ${prop.state}`, count, status: prop.status });
    }
  }

  console.log(`\nPhoto Count Compliance (Pre-publishing rule: >= 6 photos):`);
  console.log(`  - Compliant (>= 6 photos): ${propertiesWithMin6Photos} (${((propertiesWithMin6Photos/properties.length)*100).toFixed(1)}%)`);
  console.log(`  - Below minimum (< 6 photos): ${propertiesBelow6Photos}`);
  console.log(`  - Zero photos: ${propertiesWithZeroPhotos}`);

  if (lowPhotoProps.length > 0) {
    console.log('\nProperties with < 6 photos:');
    lowPhotoProps.slice(0, 10).forEach(p => console.log(`  - [${p.count} photos] ${p.address} (ID: ${p.id}) [status: ${p.status}]`));
  }
  if (zeroPhotoProps.length > 0) {
    console.log('\nProperties with 0 photos:');
    zeroPhotoProps.slice(0, 10).forEach(p => console.log(`  - [0 photos] ${p.address} (ID: ${p.id}) [status: ${p.status}]`));
  }

  // 3. SAMPLE URL REACHABILITY TEST (Testing 20 random published photos)
  console.log('\n--- 3. LIVE URL REACHABILITY TEST (Sample of 20 URLs) ---');
  const sampleIndices = [0, 5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 90, 100, 120, 150, 200, 250, 300, 400, 500].filter(i => i < allPhotos.length);
  for (const idx of sampleIndices) {
    const photo = allPhotos[idx];
    totalPhotoUrlsChecked++;
    const res = await checkUrl(photo.url);
    if (!res.ok) {
      brokenPhotosCount++;
      console.log(`  [FAIL HTTP ${res.status}] Photo ID ${photo.id}: ${photo.url.substring(0, 80)}... (${res.error || 'Failed'})`);
    } else {
      console.log(`  [PASS HTTP ${res.status}] Photo ID ${photo.id} -> ${photo.url.substring(0, 80)}...`);
    }
  }

  // 4. PIPELINE PROPERTIES STATUS
  console.log('\n--- 4. PIPELINE STAGING DATABASE AUDIT ---');
  let pipelineProps = [];
  try {
    pipelineProps = await fetchDb('pipeline_properties?select=id,title,address,city,state,status,photo_import_status,last_photo_import_error,original_image_urls,choice_property_id&order=created_at.desc&limit=1000', 'pipeline');
    console.log(`Total pipeline properties found: ${pipelineProps.length}`);
  } catch (err) {
    console.log('Error fetching pipeline_properties:', err.message);
  }

  let pipelineImportedCount = 0;
  let pipelinePendingCount = 0;
  let pipelineFailedCount = 0;
  let pipelineOtherCount = 0;

  for (const pl of pipelineProps) {
    const st = (pl.photo_import_status || 'pending').toLowerCase();
    if (st === 'imported' || st === 'completed' || st === 'success') pipelineImportedCount++;
    else if (st === 'failed' || st === 'error') pipelineFailedCount++;
    else if (st === 'pending' || st === 'queued' || st === 'in_progress') pipelinePendingCount++;
    else pipelineOtherCount++;
  }

  console.log(`Pipeline Photo Import Status Breakdown:`);
  console.log(`  - Imported/Completed: ${pipelineImportedCount}`);
  console.log(`  - Pending/Queued: ${pipelinePendingCount}`);
  console.log(`  - Failed: ${pipelineFailedCount}`);
  if (pipelineOtherCount > 0) console.log(`  - Other: ${pipelineOtherCount}`);

  // 5. EDGE FUNCTIONS & INTEGRATIONS AUDIT
  console.log('\n--- 5. ARCHITECTURE & EDGE FUNCTION SYSTEM AUDIT ---');
  const efList = [
    'supabase/functions/imagekit-upload/index.ts',
    'supabase/functions/imagekit-delete/index.ts',
    'supabase/functions/imagekit-watermark/index.ts',
    'supabase/functions/import-pipeline-photos/index.ts',
    'supabase/functions/proxy-image/index.ts'
  ];

  for (const ef of efList) {
    const p = path.join(process.cwd(), ef);
    if (fs.existsSync(p)) {
      const stat = fs.statSync(p);
      console.log(`  [OK] ${ef} (${(stat.size / 1024).toFixed(1)} KB)`);
    } else {
      console.log(`  [MISSING] ${ef}`);
    }
  }

  console.log('\n================================================================');
  console.log(' DEEP SCAN SUMMARY:');
  console.log(`  - Total Properties: ${properties.length}`);
  console.log(`  - Total Photos Indexed: ${allPhotos.length}`);
  console.log(`  - Average Photos per Property: ${(allPhotos.length / properties.length).toFixed(1)}`);
  console.log(`  - Properties meeting >=6 rule: ${propertiesWithMin6Photos} / ${properties.length}`);
  console.log(`  - Live sample Reachability: ${totalPhotoUrlsChecked - brokenPhotosCount}/${totalPhotoUrlsChecked} OK`);
  console.log('================================================================\n');
}

runDeepScan().catch(err => {
  console.error('Deep scan runtime error:', err);
});
