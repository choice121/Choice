// ============================================================
// Choice Properties — receive-pipeline-import Edge Function
// v3.2 — Full Folder Management & Pipeline Ingestion
// ============================================================
// Accepts parsed listing payloads and folder actions from Chrome /
// Orion extensions on Zillow, Realtor, Apartments.com, etc.
// Authenticates via a shared secret (x-import-secret header or ?secret= query).
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import { permissiveCorsResponse, permissiveJsonOk, permissiveJsonErr } from '../_shared/cors.ts';
import {
  buildPipelineRecord,
  safeStr,
  safeInt,
  safeFloat,
  normalizeSource,
  normalizePropType,
  normalizeDate,
  qualityScore,
  missingFields,
  genId,
  isEmpty,
  CORE_FIELDS,
  BONUS_FIELDS,
  TRACKABLE_MISSING,
} from '../_shared/pipeline-record.ts';

type ImageEntry = string | {
  url: string;
  fileId?: string | null;
  width?: number | null;
  height?: number | null;
};

function parseImageEntries(raw: unknown): ImageEntry[] {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry === 'object' && typeof (entry as any).url === 'string') {
        return {
          url: (entry as any).url,
          fileId: (entry as any).fileId ?? null,
          width: typeof (entry as any).width === 'number' ? (entry as any).width : null,
          height: typeof (entry as any).height === 'number' ? (entry as any).height : null,
        };
      }
      return null;
    }).filter((entry): entry is ImageEntry => entry !== null);
  } catch {
    return [];
  }
}

function imageEntryUrl(entry: ImageEntry): string {
  return typeof entry === 'string' ? entry : entry.url;
}

// ── ImageKit auto-upload config ─────────────────────────────────
const MAX_PHOTOS_TO_UPLOAD = 40;
const BATCH_SIZE = 3;
const FETCH_TIMEOUT = 15_000;
const IMAGEKIT_UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return permissiveCorsResponse(req);

  // ── Auth: shared secret ──────────────────────────────────────
  const IMPORT_SECRET = Deno.env.get('SHORTCUT_IMPORT_SECRET') || Deno.env.get('IMPORT_SECRET') || 'cp_import_7Kx3m9P2w5';
  const url = new URL(req.url);
  const incoming = url.searchParams.get('secret') || req.headers.get('x-import-secret');
  if (!incoming || incoming !== IMPORT_SECRET) {
    return permissiveJsonErr(401, 'Invalid import secret', req);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://tlfmwetmhthpyrytrcfo.supabase.co';
  const FALLBACK_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE';
  const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || FALLBACK_SERVICE_KEY;
  const adminClient  = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── GET or Action Handling ──────────────────────────────────
  const actionFromQuery = url.searchParams.get('action');

  let body: Record<string, unknown> = {};
  if (req.method === 'POST') {
    try {
      body = await req.json();
    } catch {
      return permissiveJsonErr(400, 'Invalid JSON body', req);
    }
  }

  const action = safeStr(body.action) || actionFromQuery;

  // 1. LIST FOLDERS
  if (action === 'list_folders' || (req.method === 'GET' && actionFromQuery === 'list_folders')) {
    const { data, error } = await adminClient.rpc('pipeline_folder_list');
    if (error) {
      // Fallback query if RPC has issue
      const { data: rawFolders, error: rawErr } = await adminClient
        .schema('pipeline')
        .from('pipeline_folders')
        .select('id, name, description, created_at')
        .order('created_at', { ascending: false });
      if (rawErr) return permissiveJsonErr(500, rawErr.message, req);
      return permissiveJsonOk({ ok: true, folders: rawFolders || [] }, req);
    }
    const folders = typeof data === 'string' ? JSON.parse(data) : (data || []);
    return permissiveJsonOk({ ok: true, folders }, req);
  }

  // 2. CREATE FOLDER
  if (action === 'create_folder') {
    const folderName = safeStr(body.name || body.folder_name);
    const description = safeStr(body.description);
    const color = safeStr(body.color) || '#6366f1';
    const icon = safeStr(body.icon) || '📁';
    if (!folderName) {
      return permissiveJsonErr(400, 'Folder name is required', req);
    }

    let folderId: string | null = null;
    let finalName = folderName;

    // Try RPC first (pass all 4 parameters to disambiguate overloaded database functions)
    const { data, error } = await adminClient.rpc('pipeline_folder_create', {
      p_name: folderName,
      p_description: description || null,
      p_color: color,
      p_icon: icon,
    });

    if (!error && data) {
      const resObj = typeof data === 'string' ? JSON.parse(data) : data;
      folderId = resObj?.id || null;
      if (resObj?.name) finalName = resObj.name;
    } else {
      // Direct table insert fallback
      const { data: inserted, error: insertErr } = await adminClient
        .schema('pipeline')
        .from('pipeline_folders')
        .insert({
          name: folderName.trim(),
          description: description || null,
          color: color,
          icon: icon,
        })
        .select('id, name')
        .single();

      if (insertErr) {
        // If already exists, fetch it
        const { data: existingF } = await adminClient
          .schema('pipeline')
          .from('pipeline_folders')
          .select('id, name')
          .ilike('name', folderName.trim())
          .maybeSingle();

        if (existingF) {
          folderId = existingF.id;
          finalName = existingF.name;
        } else {
          return permissiveJsonErr(500, insertErr.message || (error && error.message) || 'Folder creation failed', req);
        }
      } else if (inserted) {
        folderId = inserted.id;
        finalName = inserted.name;
      }
    }

    return permissiveJsonOk({
      ok: true,
      id: folderId,
      name: finalName,
      property_count: 0,
    }, req);
  }

  // 3. GET FOLDER PROPERTIES
  if (action === 'get_folder_properties') {
    const folderId = safeStr(body.folder_id);
    const folderName = safeStr(body.folder_name);
    let resolvedId = folderId;

    if (!resolvedId && folderName) {
      const { data: fRow } = await adminClient
        .schema('pipeline')
        .from('pipeline_folders')
        .select('id')
        .ilike('name', folderName.trim())
        .maybeSingle();
      if (fRow) resolvedId = fRow.id;
    }

    if (!resolvedId) {
      return permissiveJsonErr(400, 'folder_id or existing folder_name is required', req);
    }

    // Try RPC first
    const { data, error } = await adminClient.rpc('pipeline_folder_properties', {
      p_folder_id: resolvedId,
    });

    if (!error && data) {
      const properties = typeof data === 'string' ? JSON.parse(data) : (data || []);
      return permissiveJsonOk({ ok: true, folder_id: resolvedId, properties }, req);
    }

    // Direct table fallback
    const { data: rawProps, error: rawPropsErr } = await adminClient
      .schema('pipeline')
      .from('pipeline_properties')
      .select('id, title, address, city, state, monthly_rent, bedrooms, bathrooms, square_footage, original_image_urls, source_url, folder_serial, created_at')
      .eq('folder_id', resolvedId)
      .order('folder_serial', { ascending: true });

    if (rawPropsErr) return permissiveJsonErr(500, rawPropsErr.message, req);
    return permissiveJsonOk({ ok: true, folder_id: resolvedId, properties: rawProps || [] }, req);
  }

  // 4. REMOVE PROPERTY FROM FOLDER
  if (action === 'remove_from_folder') {
    const propertyId = safeStr(body.property_id);
    if (!propertyId) return permissiveJsonErr(400, 'property_id is required', req);

    const { data, error } = await adminClient.rpc('pipeline_folder_remove_property', {
      p_property_id: propertyId,
    });

    if (!error && data) {
      return permissiveJsonOk({ ok: true, property_id: propertyId }, req);
    }

    // Direct update fallback
    const { error: updErr } = await adminClient
      .schema('pipeline')
      .from('pipeline_properties')
      .update({ folder_id: null, folder_serial: null })
      .eq('id', propertyId);

    if (updErr) return permissiveJsonErr(500, updErr.message, req);
    return permissiveJsonOk({ ok: true, property_id: propertyId }, req);
  }

  // ── DEFAULT: LISTING IMPORT ──────────────────────────────────
  if (req.method !== 'POST') {
    return permissiveJsonErr(405, 'Method not allowed', req);
  }

  const sourceListingId = safeStr(body.source_listing_id);
  if (!sourceListingId) {
    return permissiveJsonErr(400, 'source_listing_id is required', req);
  }

  let source: string;
  try {
    source = normalizeSource(body.source);
  } catch (err) {
    return permissiveJsonErr(400, err instanceof Error ? err.message : 'Unsupported source', req);
  }

  // Duplicate check
  const { data: existing } = await adminClient
    .schema('pipeline')
    .from('pipeline_properties')
    .select('id, title, folder_id, folder_serial')
    .eq('source_listing_id', sourceListingId)
    .eq('source', source)
    .maybeSingle();

  if (existing) {
    // If folder was specified and existing record doesn't have it, we can assign it
    const reqFolder = safeStr(body.folder_name);
    let updatedFolderInfo: Record<string, unknown> | null = null;
    if (reqFolder) {
      try {
        // Resolve or create folder
        let fId: string | null = null;
        const { data: foundFolder } = await adminClient
          .schema('pipeline')
          .from('pipeline_folders')
          .select('id, name')
          .ilike('name', reqFolder.trim())
          .maybeSingle();

        if (foundFolder) {
          fId = foundFolder.id;
        } else {
          const { data: created } = await adminClient.rpc('pipeline_folder_create', {
            p_name: reqFolder.trim(),
            p_description: null,
            p_color: '#6366f1',
            p_icon: '📁',
          });
          const cObj = typeof created === 'string' ? JSON.parse(created) : created;
          if (cObj?.id) fId = cObj.id;
        }

        if (fId) {
          const { data: addData } = await adminClient.rpc('pipeline_folder_add_property', {
            p_property_id: existing.id,
            p_folder_id: fId,
          });
          const addObj = typeof addData === 'string' ? JSON.parse(addData) : addData;
          if (addObj?.ok) {
            updatedFolderInfo = { folder: reqFolder, serial: addObj.serial, folder_id: fId };
          }
        }
      } catch (e) {
        console.warn('[receive-pipeline-import] Assign existing duplicate to folder failed:', e);
      }
    }

    return permissiveJsonOk({
      ok: false,
      duplicate: true,
      id: existing.id,
      title: existing.title,
      folder: updatedFolderInfo,
      message: 'Already in pipeline',
    }, req);
  }

  // Build record using shared builder
  const record = buildPipelineRecord(body as unknown as Parameters<typeof buildPipelineRecord>[0]);

  // Extract source image entries and URLs
  const sourceImageEntries = parseImageEntries(record.original_image_urls);
  const sourceImageUrls = sourceImageEntries
    .map(imageEntryUrl)
    .filter((u) => typeof u === 'string' && u.startsWith('http'));

  // ── Handle Folder Assignment Prior to or During Insert ────────
  let targetFolderId: string | null = safeStr(body.folder_id);
  const targetFolderName = safeStr(body.folder_name);

  if (!targetFolderId && targetFolderName) {
    // Find or Auto-Create Folder
    const { data: existingFolder } = await adminClient
      .schema('pipeline')
      .from('pipeline_folders')
      .select('id, name')
      .ilike('name', targetFolderName.trim())
      .maybeSingle();

    if (existingFolder) {
      targetFolderId = existingFolder.id;
    } else {
      // Auto-create folder
      const { data: createdF } = await adminClient.rpc('pipeline_folder_create', {
        p_name: targetFolderName.trim(),
        p_description: null,
        p_color: '#6366f1',
        p_icon: '📁',
      });
      const cObj = typeof createdF === 'string' ? JSON.parse(createdF) : createdF;
      if (cObj?.id) targetFolderId = cObj.id;
    }
  }

  if (targetFolderId) {
    // Get next serial
    const { data: maxSerialRow } = await adminClient
      .schema('pipeline')
      .from('pipeline_properties')
      .select('folder_serial')
      .eq('folder_id', targetFolderId)
      .order('folder_serial', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextSerial = (maxSerialRow?.folder_serial || 0) + 1;
    record.folder_id = targetFolderId;
    record.folder_serial = nextSerial;
  }

  // Insert into pipeline
  const { error: insertErr } = await adminClient
    .schema('pipeline')
    .from('pipeline_properties')
    .insert(record);

  if (insertErr) {
    console.error('Insert error:', insertErr);
    return permissiveJsonErr(500, 'Database insert failed: ' + insertErr.message, req);
  }

  // Auto-upload images to ImageKit if not already ImageKit
  let imagekitUploaded = 0;
  let imagekitFailed = 0;
  const imagekitUrls: ImageEntry[] = [];
  const alreadyImageKit = sourceImageUrls.length > 0 && sourceImageUrls.every((u) => u.includes('ik.imagekit.io'));
  const IMAGEKIT_PRIVATE_KEY = Deno.env.get('IMAGEKIT_PRIVATE_KEY');

  if (alreadyImageKit) {
    imagekitUrls.push(...sourceImageEntries);
    imagekitUploaded = sourceImageEntries.length;
  } else if (IMAGEKIT_PRIVATE_KEY && sourceImageUrls.length > 0) {
    const alreadyIkEntries = sourceImageEntries.filter((entry) => imageEntryUrl(entry).includes('ik.imagekit.io'));
    imagekitUrls.push(...alreadyIkEntries);
    imagekitUploaded = alreadyIkEntries.length;

    const toUpload = sourceImageEntries
      .filter((entry) => !imageEntryUrl(entry).includes('ik.imagekit.io'))
      .slice(0, MAX_PHOTOS_TO_UPLOAD);
    const credentials = btoa(`${IMAGEKIT_PRIVATE_KEY}:`);
    const folderPath = `/pipeline/${record.id}`;

    async function uploadOne(sourceEntry: ImageEntry, index: number): Promise<ImageEntry | null> {
      try {
        const sourceUrl = imageEntryUrl(sourceEntry);
        const fetchHeaders: Record<string, string> = {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
        };
        if (source === 'zillow') fetchHeaders['Referer'] = 'https://www.zillow.com/';
        else if (source === 'realtor') fetchHeaders['Referer'] = 'https://www.realtor.com/';
        else if (source === 'apartments') fetchHeaders['Referer'] = 'https://www.apartments.com/';
        else if (source === 'redfin') fetchHeaders['Referer'] = 'https://www.redfin.com/';

        const imgRes = await fetch(sourceUrl, {
          headers: fetchHeaders,
          redirect: 'follow',
          signal: AbortSignal.timeout(FETCH_TIMEOUT),
        });
        if (!imgRes.ok) return null;

        const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
        const buffer = await imgRes.arrayBuffer();

        const extMap: Record<string, string> = {
          'image/jpeg': 'jpg', 'image/jpg': 'jpg',
          'image/png': 'png', 'image/webp': 'webp',
        };
        const mimeBase = contentType.split(';')[0].trim().toLowerCase();
        const ext = extMap[mimeBase] || 'jpg';
        const fileName = `photo_${index + 1}.${ext}`;

        const formData = new FormData();
        formData.append('file', new Blob([buffer], { type: mimeBase }), fileName);
        formData.append('fileName', fileName);
        formData.append('folder', folderPath);

        const ikRes = await fetch(IMAGEKIT_UPLOAD_URL, {
          method: 'POST',
          headers: { Authorization: `Basic ${credentials}` },
          body: formData,
        });

        if (!ikRes.ok) return null;

        const ikData = await ikRes.json();
        return {
          url: ikData.url as string,
          fileId: (ikData.fileId ?? null) as string | null,
          width: typeof ikData.width === 'number' ? ikData.width : null,
          height: typeof ikData.height === 'number' ? ikData.height : null,
        };
      } catch {
        return null;
      }
    }

    for (let batchStart = 0; batchStart < toUpload.length; batchStart += BATCH_SIZE) {
      const batch = toUpload.slice(batchStart, batchStart + BATCH_SIZE);
      const results = await Promise.all(
        batch.map((entry, i) => uploadOne(entry, batchStart + i))
      );
      for (const r of results) {
        if (r) { imagekitUploaded++; imagekitUrls.push(r); }
        else imagekitFailed++;
      }
    }

    if (imagekitUrls.length > 0) {
      await adminClient
        .schema('pipeline')
        .from('pipeline_properties')
        .update({
          original_image_urls: JSON.stringify(imagekitUrls),
          photo_import_status: 'ok',
          last_photo_import_at: new Date().toISOString(),
          last_photo_import_error: null,
        })
        .eq('id', record.id);
    }
  }

  // Count total properties in folder for the response
  let folderCount = 1;
  let finalFolderName = targetFolderName;
  if (targetFolderId) {
    const { count } = await adminClient
      .schema('pipeline')
      .from('pipeline_properties')
      .select('id', { count: 'exact', head: true })
      .eq('folder_id', targetFolderId);
    if (count != null) folderCount = count;

    if (!finalFolderName) {
      const { data: fData } = await adminClient
        .schema('pipeline')
        .from('pipeline_folders')
        .select('name')
        .eq('id', targetFolderId)
        .maybeSingle();
      if (fData?.name) finalFolderName = fData.name;
    }
  }

  const folderResult = targetFolderId ? {
    folder_id: targetFolderId,
    name: finalFolderName || 'Folder',
    serial: record.folder_serial,
    total_count: folderCount,
  } : null;

  return permissiveJsonOk({
    ok:     true,
    id:     record.id,
    title:  String(record.title),
    score:  record.data_quality_score,
    photos: sourceImageUrls.length,
    imagekit_photos: imagekitUploaded,
    imagekit_failed: imagekitFailed,
    city:   safeStr(body.city),
    rent:   safeInt(body.monthly_rent),
    folder: folderResult,
  }, req);
});
