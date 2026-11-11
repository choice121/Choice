// ============================================================
// Choice Properties — Delete Non-Compliant Listings
// Deletes listings with 0 photos and listings with < 6 photos.
// Hard-purges all associated photos and folders from ImageKit.
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

async function deleteImageKitFiles(fileIds) {
  if (!fileIds || fileIds.length === 0) return 0;
  const uniqueIds = Array.from(new Set(fileIds.filter(Boolean)));
  let deletedCount = 0;

  for (let i = 0; i < uniqueIds.length; i += 100) {
    const chunk = uniqueIds.slice(i, i + 100);
    try {
      const res = await fetch('https://api.imagekit.io/v1/files/batch/deleteByFileIds', {
        method: 'POST',
        headers: {
          'Authorization': ikAuthHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileIds: chunk }),
      });
      if (res.ok) {
        deletedCount += chunk.length;
      } else {
        console.warn(`[IK Delete Files] Warning: HTTP ${res.status}`);
      }
    } catch (e) {
      console.warn(`[IK Delete Files] Error: ${e.message}`);
    }
  }
  return deletedCount;
}

async function deleteImageKitFolder(folderPath) {
  const cleanPath = folderPath.replace(/^\/+/, '').replace(/\/+$/, '');
  try {
    const res = await fetch('https://api.imagekit.io/v1/folder', {
      method: 'DELETE',
      headers: {
        'Authorization': ikAuthHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ folderPath: cleanPath }),
    });
    return res.status === 204 || res.status === 404;
  } catch (e) {
    return false;
  }
}

async function run() {
  console.log('--- Step 1: Scanning properties and photo counts ---');
  
  // 1. Scan photos
  const photoCounts = new Map();
  let from = 0;
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/property_photos?select=property_id,file_id&offset=${from}&limit=1000`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
    });
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const p of batch) {
      if (!p.property_id) continue;
      let record = photoCounts.get(p.property_id);
      if (!record) {
        record = { count: 0, file_ids: [] };
        photoCounts.set(p.property_id, record);
      }
      record.count++;
      if (p.file_id) record.file_ids.push(p.file_id);
    }
    from += batch.length;
    if (batch.length < 1000) break;
  }
  console.log(`Audited ${from} photos across ${photoCounts.size} properties.`);

  // 2. Scan all properties
  let allProps = [];
  from = 0;
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/properties?select=id,address,city,state,zip,monthly_rent&offset=${from}&limit=1000`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
    });
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    allProps.push(...batch);
    from += batch.length;
    if (batch.length < 1000) break;
  }
  console.log(`Total properties in database: ${allProps.length}`);

  const zeroPhotoProps = [];
  const underSixPhotoProps = [];

  for (const prop of allProps) {
    const pInfo = photoCounts.get(prop.id);
    const count = pInfo ? pInfo.count : 0;
    if (count === 0) {
      zeroPhotoProps.push(prop);
    } else if (count < 6) {
      underSixPhotoProps.push({ ...prop, photoCount: count, file_ids: pInfo ? pInfo.file_ids : [] });
    }
  }

  const targets = [...zeroPhotoProps, ...underSixPhotoProps];
  console.log(`\nFound ${zeroPhotoProps.length} listings with 0 photos.`);
  console.log(`Found ${underSixPhotoProps.length} listings with 1-5 photos.`);
  console.log(`Total listings targeted for deletion: ${targets.length}\n`);

  if (targets.length === 0) {
    console.log('No non-compliant listings found. All listings have at least 6 photos.');
    return;
  }

  console.log('--- Step 2: Executing Cascading Deletion & ImageKit Storage Purge ---');

  const BATCH_SIZE = 50;
  let totalDeletedInDb = 0;
  let totalIKFilesDeleted = 0;
  let totalFoldersAttempted = 0;

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const chunk = targets.slice(i, i + BATCH_SIZE);
    const chunkIds = chunk.map(p => p.id);

    // Call cascading delete RPC
    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/delete_properties_cascade`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_ids: chunkIds }),
    });

    const rpcData = await rpcRes.json();
    if (!rpcData || !rpcData.ok) {
      console.error(`Error deleting batch ${i} - ${i + chunk.length}:`, rpcData);
      continue;
    }

    const numDeleted = rpcData.deleted || 0;
    totalDeletedInDb += numDeleted;

    // Collect all file_ids (from RPC return + pre-collected)
    const fileIds = [
      ...(rpcData.file_ids || []),
      ...chunk.flatMap(p => p.file_ids || []),
    ];

    if (fileIds.length > 0) {
      const deletedFiles = await deleteImageKitFiles(fileIds);
      totalIKFilesDeleted += deletedFiles;
    }

    // Delete property folders from ImageKit
    for (const prop of chunk) {
      await deleteImageKitFolder(`properties/${prop.id}`);
      totalFoldersAttempted++;
    }

    console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(targets.length / BATCH_SIZE)}: Deleted ${numDeleted} DB properties. Purged ${fileIds.length} IK files.`);
  }

  console.log('\n--- Step 3: Verification ---');
  console.log(`Successfully deleted ${totalDeletedInDb} non-compliant properties from Supabase.`);
  console.log(`Purged ${totalIKFilesDeleted} physical image assets and checked ${totalFoldersAttempted} property folders in ImageKit.`);
}

run().catch(console.error);
