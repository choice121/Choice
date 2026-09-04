// ============================================================
// Choice Properties — Orphaned ImageKit Storage Purge Utility
// Purges all orphaned staging folders (PP-*) and deleted property folders
// from ImageKit, permanently freeing up account storage.
// ============================================================

import { Buffer } from 'node:buffer';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE';
const IMAGEKIT_PRIVATE_KEY = process.env.Imagekitprivate || process.env.IMAGEKIT_PRIVATE_KEY;

if (!IMAGEKIT_PRIVATE_KEY) {
  console.error('ERROR: ImageKit private key is missing.');
  process.exit(1);
}

const isExecute = process.argv.includes('--execute');
const ikAuthHeader = 'Basic ' + Buffer.from(IMAGEKIT_PRIVATE_KEY + ':').toString('base64');

async function getActivePropertyIds() {
  console.log('[1/3] Loading active property IDs from Supabase...');
  const activeIds = new Set();
  let from = 0;
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/properties?select=id&offset=${from}&limit=1000`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
    });
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    batch.forEach(p => activeIds.add(p.id));
    from += batch.length;
    if (batch.length < 1000) break;
  }
  console.log(`Loaded ${activeIds.size} active properties from Supabase.`);
  return activeIds;
}

async function scanAllImageKitFolders(activeIds) {
  console.log('[2/3] Scanning all files and folder structures across ImageKit...');
  const folders = new Map(); // folderPath -> count
  let skip = 0;
  const pageSize = 1000;

  while (true) {
    const res = await fetch(`https://api.imagekit.io/v1/files?limit=${pageSize}&skip=${skip}&sort=ASC_CREATED`, {
      headers: { 'Authorization': ikAuthHeader },
    });
    if (!res.ok) {
      console.warn(`ImageKit files API returned HTTP ${res.status}`);
      break;
    }
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;

    for (const f of batch) {
      if (f.filePath) {
        const parts = f.filePath.split('/').filter(Boolean);
        if (parts[0] === 'properties' && parts[1]) {
          const folder = 'properties/' + parts[1];
          folders.set(folder, (folders.get(folder) || 0) + 1);
        }
      }
    }

    skip += batch.length;
    if (batch.length < pageSize) break;
  }

  const orphanedFolders = [];
  let orphanedFileCount = 0;
  let activeFolderCount = 0;
  let activeFileCount = 0;

  for (const [folder, count] of folders.entries()) {
    const ref = folder.replace('properties/', '');
    if (activeIds.has(ref)) {
      activeFolderCount++;
      activeFileCount += count;
    } else {
      orphanedFolders.push({ folder, count });
      orphanedFileCount += count;
    }
  }

  console.log(`\nScan Summary:`);
  console.log(`Total ImageKit files audited: ${skip}`);
  console.log(`Active property folders to KEEP: ${activeFolderCount} (${activeFileCount} files)`);
  console.log(`Orphaned folders targeted for PURGE: ${orphanedFolders.length} (${orphanedFileCount} files)`);

  return orphanedFolders;
}

async function purgeFolders(orphanedFolders) {
  console.log(`\n[3/3] Executing deletion of ${orphanedFolders.length} orphaned folders...`);
  let purgedCount = 0;
  let failCount = 0;
  const total = orphanedFolders.length;

  // Process with concurrency of 5
  const concurrency = 5;
  for (let i = 0; i < total; i += concurrency) {
    const chunk = orphanedFolders.slice(i, i + concurrency);
    await Promise.all(chunk.map(async ({ folder, count }) => {
      try {
        const res = await fetch('https://api.imagekit.io/v1/folder', {
          method: 'DELETE',
          headers: { 'Authorization': ikAuthHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderPath: folder }),
        });
        if (res.status === 204 || res.status === 200 || res.status === 404) {
          purgedCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        failCount++;
      }
    }));

    if ((i + concurrency) % 50 === 0 || i + concurrency >= total) {
      const progress = Math.min(i + concurrency, total);
      const pct = ((progress / total) * 100).toFixed(1);
      console.log(`Progress: ${progress}/${total} folders processed (${pct}%)...`);
    }
  }

  console.log('\n=== ImageKit Orphan Purge Complete ===');
  console.log(`Successfully purged folders: ${purgedCount}`);
  console.log(`Failed / skipped:            ${failCount}`);
}

async function run() {
  console.log('=== ImageKit Storage Orphan Purge ===');
  console.log(`Execution Mode: ${isExecute ? 'LIVE DELETION' : 'DRY-RUN'}`);

  const activeIds = await getActivePropertyIds();
  const orphanedFolders = await scanAllImageKitFolders(activeIds);

  if (!isExecute) {
    console.log('\n[DRY-RUN] Pass --execute to permanently delete these orphaned folders.');
    return;
  }

  if (orphanedFolders.length === 0) {
    console.log('No orphaned folders found. ImageKit storage is already completely clean!');
    return;
  }

  await purgeFolders(orphanedFolders);
}

run().catch(console.error);
