// ============================================================
// Choice Properties — Hotlink to ImageKit Migration Worker
// Migrates external CDN photos (Zillow, Opendoor, Realtor) into
// native ImageKit storage, updating Supabase records upon upload.
//
// Usage:
//   node scripts/migrate_hotlinks_to_imagekit.mjs --dry-run
//   node scripts/migrate_hotlinks_to_imagekit.mjs --limit=50 --concurrency=5
// ============================================================

import { Buffer } from 'node:buffer';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE';
const IMAGEKIT_PRIVATE_KEY = process.env.Imagekitprivate || process.env.IMAGEKIT_PRIVATE_KEY;

if (!IMAGEKIT_PRIVATE_KEY) {
  console.error('ERROR: ImageKit private key is missing.');
  process.exit(1);
}

const isDryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const maxToProcess = limitArg ? parseInt(limitArg.split('=')[1], 10) : 20;

const ikAuthHeader = 'Basic ' + Buffer.from(IMAGEKIT_PRIVATE_KEY + ':').toString('base64');

async function fetchExternalPhotos(limit) {
  console.log(`Querying up to ${limit} external photo records...`);
  // Query photos where url is not like ImageKit and limit to `limit`
  const res = await fetch(`${SUPABASE_URL}/rest/v1/property_photos?select=id,property_id,url,display_order&url=not.like.*ik.imagekit.io*&limit=${limit}`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to query property_photos: HTTP ${res.status}`);
  }
  return await res.json();
}

async function uploadToImageKit(externalUrl, propertyId, photoId) {
  // Download source image
  const imgRes = await fetch(externalUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
  });
  if (!imgRes.ok) {
    throw new Error(`Failed to download source image: HTTP ${imgRes.status}`);
  }

  const arrayBuffer = await imgRes.arrayBuffer();
  const base64Data = Buffer.from(arrayBuffer).toString('base64');
  const fileName = `photo_${photoId}.webp`;

  // Upload to ImageKit
  const form = new URLSearchParams();
  form.append('file', base64Data);
  form.append('fileName', fileName);
  form.append('folder', `/properties/${propertyId}`);
  form.append('useUniqueFileName', 'true');
  form.append('tags', `property_${propertyId}`);

  const ikRes = await fetch('https://api.imagekit.io/v1/files/upload', {
    method: 'POST',
    headers: {
      'Authorization': ikAuthHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  if (!ikRes.ok) {
    const errBody = await ikRes.text().catch(() => '');
    throw new Error(`ImageKit upload failed: HTTP ${ikRes.status} - ${errBody}`);
  }

  const ikData = await ikRes.json();
  return {
    fileId: ikData.fileId,
    url: ikData.url,
  };
}

async function updateDatabaseRecord(photoId, newUrl, fileId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/property_photos?id=eq.${photoId}`, {
    method: 'PATCH',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      url: newUrl,
      file_id: fileId,
    }),
  });
  return res.ok;
}

async function run() {
  console.log('=== Choice Properties: Hotlink Ingestion Migration Worker ===');
  console.log(`Mode: ${isDryRun ? 'DRY-RUN' : 'LIVE MIGRATION'}`);
  console.log(`Target batch size: ${maxToProcess}`);

  const photos = await fetchExternalPhotos(maxToProcess);
  console.log(`Found ${photos.length} external hotlinks queued for migration.`);

  if (photos.length === 0) {
    console.log('No external photos found.');
    return;
  }

  if (isDryRun) {
    console.log('Sample queued photos for migration:');
    photos.slice(0, 5).forEach((p, idx) => {
      console.log(`  ${idx + 1}. [Property: ${p.property_id}] -> ${p.url.slice(0, 70)}...`);
    });
    console.log('\n[DRY RUN COMPLETE] To execute migration, run without --dry-run:');
    console.log('  node scripts/migrate_hotlinks_to_imagekit.mjs --limit=20');
    return;
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    console.log(`[${i + 1}/${photos.length}] Migrating photo ${photo.id} (Property: ${photo.property_id})...`);

    try {
      const { fileId, url: newUrl } = await uploadToImageKit(photo.url, photo.property_id, photo.id);
      const updated = await updateDatabaseRecord(photo.id, newUrl, fileId);

      if (updated) {
        successCount++;
        console.log(`   -> Successfully uploaded to ImageKit: ${newUrl}`);
      } else {
        failCount++;
        console.warn(`   -> Warning: ImageKit upload succeeded but DB update failed for ${photo.id}`);
      }
    } catch (err) {
      failCount++;
      console.error(`   -> Failed to migrate photo ${photo.id}: ${err.message}`);
    }

    // Brief delay between uploads to respect rate-limits
    await new Promise(r => setTimeout(r, 250));
  }

  console.log('\n=== Migration Worker Summary ===');
  console.log(`Successfully Migrated: ${successCount}`);
  console.log(`Failed Migrations:     ${failCount}`);
}

run().catch(console.error);
