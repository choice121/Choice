import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE';
const SITE_BASE_URL = 'https://choice-properties-site.pages.dev';

const SB_HEADERS = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};

const SB_PIPELINE_HEADERS = {
  ...SB_HEADERS,
  'Accept-Profile': 'pipeline',
  'Content-Profile': 'pipeline'
};

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

async function uploadOnePhoto(propertyId, photoUrl, index) {
  try {
    const res = await fetch(photoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) {
      console.warn(`[Photo ${index + 1}] Download failed HTTP ${res.status} for ${propertyId}`);
      return null;
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 500) {
      console.warn(`[Photo ${index + 1}] Small/empty file (${buf.byteLength}b) for ${propertyId}`);
      return null;
    }

    const padIdx = String(index + 1).padStart(2, '0');
    const storagePath = `properties/${propertyId}/photo_${padIdx}.jpg`;

    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/property-photos/${storagePath}`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true'
      },
      body: buf
    });

    if (!uploadRes.ok) {
      console.warn(`[Photo ${index + 1}] Upload failed HTTP ${uploadRes.status} for ${propertyId}`);
      return null;
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/property-photos/${storagePath}`;
    return {
      url: publicUrl,
      display_order: index + 1,
      is_hero: index === 0
    };
  } catch (err) {
    console.warn(`[Photo ${index + 1}] Error uploading:`, err.message);
    return null;
  }
}

async function processProperty(record, idx, total) {
  const propId = record.choice_property_id;
  if (!propId) return null;

  let rawPhotos = [];
  try {
    rawPhotos = JSON.parse(record.original_image_urls || '[]');
  } catch (e) {
    rawPhotos = [];
  }

  if (rawPhotos.length === 0) {
    console.log(`[${idx + 1}/${total}] No photos found for ${record.address}`);
    return null;
  }

  console.log(`[${idx + 1}/${total}] Uploading ${rawPhotos.length} photos for ${record.address} (${propId})...`);

  // Download & upload each photo concurrently
  const uploadResults = await mapConcurrent(
    rawPhotos.map((url, i) => ({ url, i })),
    6,
    async ({ url, i }) => uploadOnePhoto(propId, url, i)
  );

  const validUploads = uploadResults.filter(Boolean);

  if (validUploads.length === 0) {
    console.error(`[${idx + 1}/${total}] Failed all photo uploads for ${record.address}`);
    return null;
  }

  // Delete previous photos from public.property_photos for this property
  await fetch(`${SUPABASE_URL}/rest/v1/property_photos?property_id=eq.${propId}`, {
    method: 'DELETE',
    headers: SB_HEADERS
  });

  // Insert newly uploaded public CDN photos
  const photoRecords = validUploads.map((up) => ({
    id: crypto.randomUUID(),
    property_id: propId,
    url: up.url,
    display_order: up.display_order,
    is_hero: up.is_hero,
    created_at: new Date().toISOString()
  }));

  const insRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos`, {
    method: 'POST',
    headers: SB_HEADERS,
    body: JSON.stringify(photoRecords)
  });

  if (!insRes.ok) {
    console.error(`[${idx + 1}/${total}] Failed inserting photo records for ${record.address}:`, await insRes.text());
  } else {
    console.log(`[${idx + 1}/${total}] SUCCESS: ${validUploads.length} CDN photos live for ${record.address}`);
  }

  return {
    ...record,
    choice_property_id: propId,
    uploaded_photos_count: validUploads.length
  };
}

async function main() {
  console.log('=== Uploading All CJ Property Photos to CDN ===');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?source=eq.cjproperties&status=eq.published&select=id,choice_property_id,address,city,state,zip,monthly_rent,bedrooms,bathrooms,original_image_urls&order=monthly_rent.desc&limit=200`, {
    headers: {
      ...SB_PIPELINE_HEADERS,
      'Range': '0-199'
    }
  });

  const records = await res.json();
  console.log(`Found ${records.length} published CJ properties to process.`);

  // Process properties with concurrency limit 4
  const completed = await mapConcurrent(
    records.map((r, i) => ({ r, i })),
    4,
    async ({ r, i }) => processProperty(r, i, records.length)
  );

  const successful = completed.filter(Boolean);
  console.log(`\nProcessed ${successful.length} properties with CDN photo galleries.`);

  console.log('\n=============================================================');
  console.log('VERIFIED PUBLISHED CJ PROPERTIES');
  console.log('=============================================================\n');

  records.forEach((p, idx) => {
    console.log(`${idx + 1}. ${p.address}, ${p.city}, ${p.state} ${p.zip || ''} ($${Number(p.monthly_rent).toLocaleString()}/mo | ${p.bedrooms} Bed / ${p.bathrooms} Bath) — ${SITE_BASE_URL}/property.html?id=${p.choice_property_id}`);
    console.log('');
  });
}

main().catch(console.error);
