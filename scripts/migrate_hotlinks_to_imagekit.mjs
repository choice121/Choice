// ============================================================
// Choice Properties — Full Gallery Hotlink to ImageKit Migration Worker
// Migrates 100% of photos for properties (all photos in the gallery)
// into native ImageKit storage, updating Supabase records in real time.
//
// Usage:
//   node scripts/migrate_hotlinks_to_imagekit.mjs --properties=20
//   node scripts/migrate_hotlinks_to_imagekit.mjs --all
//   node scripts/migrate_hotlinks_to_imagekit.mjs --property-id=<UUID>
// ============================================================

import { Buffer } from 'node:buffer';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE';
const IMAGEKIT_PRIVATE_KEY = process.env.Imagekitprivate || process.env.IMAGEKIT_PRIVATE_KEY;

if (!IMAGEKIT_PRIVATE_KEY) {
  console.error('ERROR: ImageKit private key is missing.');
  process.exit(1);
}

const ikAuthHeader = 'Basic ' + Buffer.from(IMAGEKIT_PRIVATE_KEY + ':').toString('base64');

// Parse CLI args
const args = process.argv.slice(2);
const isAll = args.includes('--all');
const propLimitArg = args.find(a => a.startsWith('--properties='));
const specificPropIdArg = args.find(a => a.startsWith('--property-id='));
const maxProperties = isAll ? 999999 : (propLimitArg ? parseInt(propLimitArg.split('=')[1], 10) : 25);
const targetPropertyId = specificPropIdArg ? specificPropIdArg.split('=')[1] : null;

async function getPropertiesNeedingMigration(limit) {
  if (targetPropertyId) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${targetPropertyId}&select=id,address,city,state,zip`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
    });
    return await res.json();
  }

  // Find properties that have at least one external photo
  const res = await fetch(`${SUPABASE_URL}/rest/v1/property_photos?select=property_id&url=not.like.*ik.imagekit.io*&limit=10000`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) throw new Error(`Failed to query unmigrated photos: HTTP ${res.status}`);
  const photos = await res.json();

  const propIds = [...new Set(photos.map(p => p.property_id))].slice(0, limit);
  if (propIds.length === 0) return [];

  // Fetch property details in chunks of 50
  const results = [];
  for (let i = 0; i < propIds.length; i += 50) {
    const chunk = propIds.slice(i, i + 50);
    const propRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=in.(${chunk.join(',')})&select=id,address,city,state,zip`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
    });
    if (propRes.ok) {
      const data = await propRes.json();
      results.push(...data);
    }
  }
  return results;
}

async function uploadSinglePhoto(externalUrl, propertyId, index, photoId) {
  const fileName = `photo_${String(index + 1).padStart(2, '0')}_${photoId.slice(0, 8)}.jpg`;
  const folder = `/properties/${propertyId}`;

  // Attempt 1: Fast direct URL upload to ImageKit
  try {
    const form = new URLSearchParams();
    form.append('file', externalUrl);
    form.append('fileName', fileName);
    form.append('folder', folder);
    form.append('useUniqueFileName', 'false');
    form.append('tags', `property_${propertyId}`);

    const ikRes = await fetch('https://api.imagekit.io/v1/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': ikAuthHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    if (ikRes.ok) {
      const data = await ikRes.json();
      return { fileId: data.fileId, url: data.url, width: data.width, height: data.height };
    }
  } catch (err) {
    // Fall through to buffer upload
  }

  // Attempt 2: Download buffer with realistic browser headers and upload base64
  const dlRes = await fetch(externalUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    },
  });
  if (!dlRes.ok) {
    throw new Error(`Failed to download source image (HTTP ${dlRes.status})`);
  }

  const arrayBuf = await dlRes.arrayBuffer();
  const base64Data = Buffer.from(arrayBuf).toString('base64');

  const form2 = new URLSearchParams();
  form2.append('file', base64Data);
  form2.append('fileName', fileName);
  form2.append('folder', folder);
  form2.append('useUniqueFileName', 'false');
  form2.append('tags', `property_${propertyId}`);

  const ikRes2 = await fetch('https://api.imagekit.io/v1/files/upload', {
    method: 'POST',
    headers: {
      'Authorization': ikAuthHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form2.toString(),
  });

  if (!ikRes2.ok) {
    const errText = await ikRes2.text().catch(() => '');
    throw new Error(`ImageKit buffer upload failed (HTTP ${ikRes2.status}): ${errText}`);
  }

  const data2 = await ikRes2.json();
  return { fileId: data2.fileId, url: data2.url, width: data2.width, height: data2.height };
}

async function migratePropertyFullGallery(property, pIndex, totalProps) {
  console.log(`\n------------------------------------------------------------`);
  console.log(`[${pIndex + 1}/${totalProps}] Property: ${property.address || property.id}`);
  console.log(`Location: ${property.city || ''}, ${property.state || ''} ${property.zip || ''}`);
  console.log(`ID: ${property.id}`);

  // Fetch ALL photos for this property in exact display_order
  const photosRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos?property_id=eq.${property.id}&order=display_order.asc`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
  });
  if (!photosRes.ok) {
    console.error(`  ❌ Failed to fetch photos for property ${property.id}`);
    return { success: false, migrated: 0, skipped: 0, failed: 0 };
  }

  const allPhotos = await photosRes.json();
  console.log(`  📸 Total Photos in Gallery: ${allPhotos.length}`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  // Process photos in concurrent chunks of 3
  const concurrency = 3;
  for (let i = 0; i < allPhotos.length; i += concurrency) {
    const chunk = allPhotos.slice(i, i + concurrency);
    await Promise.all(chunk.map(async (photo, chunkOffset) => {
      const photoIdx = i + chunkOffset;

      if (photo.url && photo.url.includes('ik.imagekit.io')) {
        skipped++;
        return;
      }

      try {
        const uploadResult = await uploadSinglePhoto(photo.url, property.id, photoIdx, photo.id);

        const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos?id=eq.${photo.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
          },
          body: JSON.stringify({
            url: uploadResult.url,
            file_id: uploadResult.fileId,
            width: uploadResult.width || null,
            height: uploadResult.height || null,
            updated_at: new Date().toISOString(),
          }),
        });

        if (patchRes.ok) {
          migrated++;
          console.log(`    ✅ Photo ${photoIdx + 1}/${allPhotos.length} migrated -> ${uploadResult.url}`);
        } else {
          failed++;
          console.warn(`    ⚠️ Photo ${photoIdx + 1}/${allPhotos.length} uploaded to IK but DB update failed`);
        }
      } catch (err) {
        failed++;
        console.error(`    ❌ Photo ${photoIdx + 1}/${allPhotos.length} error: ${err.message}`);
      }
    }));

    // Respect ImageKit API rate limits
    await new Promise(r => setTimeout(r, 150));
  }

  console.log(`  Summary: ${migrated} migrated, ${skipped} already on IK, ${failed} failed.`);
  return { success: failed === 0, migrated, skipped, failed };
}

async function main() {
  console.log('============================================================');
  console.log('Choice Properties — Full-Gallery ImageKit Migration Engine');
  console.log('Policy: 100% of photos for every property (entire gallery)');
  console.log('============================================================');

  const properties = await getPropertiesNeedingMigration(maxProperties);
  console.log(`Found ${properties.length} properties queued for full-gallery migration.\n`);

  if (properties.length === 0) {
    console.log('All properties are fully migrated to ImageKit!');
    return;
  }

  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (let pIdx = 0; pIdx < properties.length; pIdx++) {
    const result = await migratePropertyFullGallery(properties[pIdx], pIdx, properties.length);
    totalMigrated += result.migrated;
    totalSkipped += result.skipped;
    totalFailed += result.failed;
  }

  console.log('\n============================================================');
  console.log('=== Migration Batch Complete ===');
  console.log(`Properties Processed: ${properties.length}`);
  console.log(`Photos Migrated:      ${totalMigrated}`);
  console.log(`Photos Skipped (IK):  ${totalSkipped}`);
  console.log(`Failed Photos:        ${totalFailed}`);
  console.log('============================================================');
}

main().catch(console.error);
