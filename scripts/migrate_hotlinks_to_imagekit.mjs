// ============================================================
// Choice Properties — Full Gallery Hotlink to ImageKit Migration Worker
// Migrates 100% of photos for properties (all photos in the gallery)
// into native ImageKit storage using indexed keyset pagination & checkpoints.
//
// Usage:
//   node scripts/migrate_hotlinks_to_imagekit.mjs --all
//   node scripts/migrate_hotlinks_to_imagekit.mjs --properties=50
//   node scripts/migrate_hotlinks_to_imagekit.mjs --reset-checkpoint
// ============================================================

import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';

const CHECKPOINT_FILE = path.join(process.cwd(), '.migration_checkpoint.json');
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
const isAll = args.includes('--all') || (!args.some(a => a.startsWith('--properties=')) && !args.includes('--reset-checkpoint'));
const propLimitArg = args.find(a => a.startsWith('--properties='));
const maxProperties = propLimitArg ? parseInt(propLimitArg.split('=')[1], 10) : (isAll ? 999999 : 50);

if (args.includes('--reset-checkpoint')) {
  if (fs.existsSync(CHECKPOINT_FILE)) fs.unlinkSync(CHECKPOINT_FILE);
  console.log('Checkpoint reset.');
}

function loadCheckpoint() {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
    }
  } catch (e) {}
  return { lastId: null, totalProperties: 0, totalPhotos: 0 };
}

function saveCheckpoint(state) {
  try {
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {}
}

async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
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

    const ikRes = await fetchWithRetry('https://api.imagekit.io/v1/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': ikAuthHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    if (ikRes && ikRes.ok) {
      const data = await ikRes.json();
      return { fileId: data.fileId, url: data.url, width: data.width, height: data.height };
    }
  } catch (err) {
    // Fallback to buffer
  }

  // Attempt 2: Buffer download with browser headers
  const dlRes = await fetchWithRetry(externalUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    },
  });
  if (!dlRes || !dlRes.ok) {
    throw new Error(`Failed to download source image (HTTP ${dlRes ? dlRes.status : 'ERR'})`);
  }

  const arrayBuf = await dlRes.arrayBuffer();
  const base64Data = Buffer.from(arrayBuf).toString('base64');

  const form2 = new URLSearchParams();
  form2.append('file', base64Data);
  form2.append('fileName', fileName);
  form2.append('folder', folder);
  form2.append('useUniqueFileName', 'false');
  form2.append('tags', `property_${propertyId}`);

  const ikRes2 = await fetchWithRetry('https://api.imagekit.io/v1/files/upload', {
    method: 'POST',
    headers: {
      'Authorization': ikAuthHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form2.toString(),
  });

  if (!ikRes2 || !ikRes2.ok) {
    const errText = ikRes2 ? await ikRes2.text().catch(() => '') : '';
    throw new Error(`ImageKit buffer upload failed: ${errText}`);
  }

  const data2 = await ikRes2.json();
  return { fileId: data2.fileId, url: data2.url, width: data2.width, height: data2.height };
}

async function migratePropertyPhotos(property, photos) {
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  // Process photos in concurrent chunks of 3
  const concurrency = 3;
  for (let i = 0; i < photos.length; i += concurrency) {
    const chunk = photos.slice(i, i + concurrency);
    await Promise.all(chunk.map(async (photo, chunkOffset) => {
      const photoIdx = i + chunkOffset;

      if (photo.url && photo.url.includes('ik.imagekit.io')) {
        skipped++;
        return;
      }

      try {
        const uploadResult = await uploadSinglePhoto(photo.url, property.id, photoIdx, photo.id);

        const patchRes = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/property_photos?id=eq.${photo.id}`, {
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

        if (patchRes && patchRes.ok) {
          migrated++;
        } else {
          failed++;
        }
      } catch (err) {
        failed++;
        console.error(`    Photo ${photoIdx + 1}/${photos.length} error: ${err.message}`);
      }
    }));

    await new Promise(r => setTimeout(r, 100));
  }

  return { migrated, skipped, failed };
}

async function main() {
  console.log('============================================================');
  console.log('Choice Properties — Full-Gallery ImageKit Migration Engine');
  console.log('Keyset Pagination Engine with Checkpointing');
  console.log('============================================================\n');

  const checkpoint = loadCheckpoint();
  let lastId = checkpoint.lastId;
  let totalProperties = checkpoint.totalProperties || 0;
  let totalPhotos = checkpoint.totalPhotos || 0;
  let runCount = 0;

  console.log(`Starting from checkpoint: lastId=${lastId || 'START'}, totalSoFar=${totalPhotos} photos`);

  const pageSize = 25;
  const startTime = Date.now();

  while (runCount < maxProperties) {
    let query = `${SUPABASE_URL}/rest/v1/properties?select=id,address,city,state,zip,property_photos(id,url,display_order)&order=id.asc&limit=${pageSize}`;
    if (lastId) {
      query += `&id=gt.${lastId}`;
    }

    let res;
    try {
      res = await fetchWithRetry(query, {
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
      });
    } catch (e) {
      console.warn(`Query failed, retrying in 3s: ${e.message}`);
      await new Promise(r => setTimeout(r, 3000));
      continue;
    }

    if (!res.ok) {
      console.warn(`Supabase returned HTTP ${res.status}, retrying in 3s...`);
      await new Promise(r => setTimeout(r, 3000));
      continue;
    }

    const properties = await res.json();
    if (!properties || properties.length === 0) {
      console.log('\n Reached the end of the property catalog!');
      break;
    }

    for (const prop of properties) {
      lastId = prop.id;
      runCount++;
      totalProperties++;

      const photos = (prop.property_photos || []).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      const externalPhotos = photos.filter(p => p.url && !p.url.includes('ik.imagekit.io'));

      if (externalPhotos.length === 0) {
        // Already fully migrated
        continue;
      }

      console.log(`[#${totalProperties}] ${prop.address || prop.id} (${prop.city || ''}, ${prop.state || ''}) — ${externalPhotos.length}/${photos.length} external photos to migrate`);

      const { migrated, failed } = await migratePropertyPhotos(prop, photos);
      totalPhotos += migrated;

      if (migrated > 0) {
        console.log(`  -> Migrated ${migrated} photos (Total: ${totalPhotos})`);
      }

      // Save checkpoint periodically
      if (totalProperties % 10 === 0) {
        saveCheckpoint({ lastId, totalProperties, totalPhotos });
      }

      if (runCount >= maxProperties) break;
    }

    saveCheckpoint({ lastId, totalProperties, totalPhotos });
    const elapsedMins = ((Date.now() - startTime) / 60000).toFixed(1);
    console.log(`\n>>> Checkpoint Saved | Properties Checked: ${totalProperties} | Photos Migrated: ${totalPhotos} | Elapsed: ${elapsedMins}m <<<\n`);
  }

  saveCheckpoint({ lastId, totalProperties, totalPhotos });
  console.log('\n============================================================');
  console.log('=== Migration Session Complete ===');
  console.log(`Properties Checked: ${totalProperties}`);
  console.log(`Photos Migrated:    ${totalPhotos}`);
  console.log('============================================================');
}

main().catch(console.error);
