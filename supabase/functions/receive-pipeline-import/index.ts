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
  caption?: string | null;
  room_label?: string | null;
  source_url?: string | null;
  media_type?: string | null;
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
          caption: typeof (entry as any).caption === 'string' ? (entry as any).caption : null,
          room_label: typeof (entry as any).room_label === 'string' ? (entry as any).room_label : null,
          source_url: typeof (entry as any).source_url === 'string' ? (entry as any).source_url : null,
          media_type: typeof (entry as any).media_type === 'string' ? (entry as any).media_type : null,
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
const BATCH_SIZE = 8;
const FETCH_TIMEOUT = 15_000;
const IMAGEKIT_UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return permissiveCorsResponse(req);

  // ── Auth: shared secret ──────────────────────────────────────
  const IMPORT_SECRET = Deno.env.get('SHORTCUT_IMPORT_SECRET') || Deno.env.get('IMPORT_SECRET');
  if (!IMPORT_SECRET) {
    console.error('[receive-pipeline-import] Import secret is not configured');
    return permissiveJsonErr(503, 'Import service is not configured', req);
  }
  const url = new URL(req.url);
  const incoming = url.searchParams.get('secret') || req.headers.get('x-import-secret');
  if (!incoming || incoming !== IMPORT_SECRET) {
    return permissiveJsonErr(401, 'Invalid import secret', req);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('[receive-pipeline-import] Supabase service configuration is missing');
    return permissiveJsonErr(503, 'Import service is not configured', req);
  }
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
    const rawName = body.name !== undefined && body.name !== null ? String(body.name) : (body.folder_name !== undefined && body.folder_name !== null ? String(body.folder_name) : '');
    const folderName = rawName.length > 0 ? rawName : '1';
    const description = body.description !== undefined && body.description !== null ? String(body.description) : null;
    const color = safeStr(body.color) || '#6366f1';
    const icon = safeStr(body.icon) || '📁';

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
      if (resObj?.name !== undefined && resObj?.name !== null) finalName = String(resObj.name);
    } else {
      // Direct table insert fallback
      const { data: inserted, error: insertErr } = await adminClient
        .schema('pipeline')
        .from('pipeline_folders')
        .insert({
          name: folderName,
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
          .ilike('name', folderName)
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

  // 5. CHECK IF LISTING ALREADY EXISTS IN PIPELINE
  if (action === 'check_listing') {
    const checkSourceId = safeStr(body.source_listing_id) || safeStr(url.searchParams.get('source_listing_id'));
    const rawSource = safeStr(body.source) || safeStr(url.searchParams.get('source'));
    if (!checkSourceId) {
      return permissiveJsonErr(400, 'source_listing_id is required', req);
    }
    let checkSource = 'zillow';
    try {
      checkSource = normalizeSource(rawSource);
    } catch {
      checkSource = (rawSource || 'zillow').toLowerCase();
    }

    const { data: matchRows } = await adminClient
      .schema('pipeline')
      .from('pipeline_properties')
      .select('id, title, status, folder_id, folder_serial, choice_property_id, imported_at')
      .eq('source_listing_id', checkSourceId)
      .eq('source', checkSource)
      .order('imported_at', { ascending: false })
      .limit(1);
    const match = matchRows?.[0] ?? null;

    if (!match) {
      return permissiveJsonOk({ ok: true, exists: false }, req);
    }

    let folderMeta: Record<string, unknown> | null = null;
    if (match.folder_id) {
      const { data: fRow } = await adminClient
        .schema('pipeline')
        .from('pipeline_folders')
        .select('id, name')
        .eq('id', match.folder_id)
        .maybeSingle();
      if (fRow) {
        folderMeta = {
          folder_id: fRow.id,
          name: fRow.name,
          serial: match.folder_serial ?? null,
        };
      }
    }

    return permissiveJsonOk({
      ok: true,
      exists: true,
      id: match.id,
      title: match.title,
      status: match.status,
      choice_property_id: match.choice_property_id,
      imported_at: match.imported_at,
      folder: folderMeta,
    }, req);
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

  const reqProvenance = (body.field_provenance && typeof body.field_provenance === 'object')
    ? (body.field_provenance as Record<string, unknown>)
    : null;
  const incomingSaveNonce = safeStr(reqProvenance?.save_nonce);

  // Duplicate check
  const { data: existingRows } = await adminClient
    .schema('pipeline')
    .from('pipeline_properties')
    .select('id, title, status, folder_id, folder_serial, choice_property_id, imported_at, field_provenance')
    .eq('source_listing_id', sourceListingId)
    .eq('source', source)
    .order('imported_at', { ascending: false })
    .limit(1);
  const existing = existingRows?.[0] ?? null;

  if (existing) {
    const existingProvenance = (existing.field_provenance && typeof existing.field_provenance === 'object')
      ? (existing.field_provenance as Record<string, unknown>)
      : null;
    const existingSaveNonce = safeStr(existingProvenance?.save_nonce);

    // If this request has the exact same save_nonce as the existing row,
    // an earlier background/retry attempt from the SAME save click already landed.
    // Treat as an idempotent success rather than a confusing "Already in pipeline" failure.
    if (incomingSaveNonce && existingSaveNonce && incomingSaveNonce === existingSaveNonce) {
      let sameSaveFolder: Record<string, unknown> | null = null;
      if (existing.folder_id) {
        const { data: fRow } = await adminClient
          .schema('pipeline')
          .from('pipeline_folders')
          .select('id, name')
          .eq('id', existing.folder_id)
          .maybeSingle();
        sameSaveFolder = {
          folder_id: existing.folder_id,
          name: fRow?.name || safeStr(body.folder_name) || 'Folder',
          serial: existing.folder_serial ?? null,
        };
      }
      return permissiveJsonOk({
        ok: true,
        deduped_retry: true,
        id: existing.id,
        title: String(existing.title || ''),
        status: existing.status,
        choice_property_id: existing.choice_property_id,
        photos_queued: false,
        folder: sameSaveFolder,
      }, req);
    }

    // If folder was specified (by folder_id or folder_name), assign/update it
    const reqFolderId = safeStr(body.folder_id);
    const reqFolder = body.folder_name !== undefined && body.folder_name !== null ? String(body.folder_name) : '';
    let updatedFolderInfo: Record<string, unknown> | null = null;
    if (reqFolderId || reqFolder) {
      try {
        let fId: string | null = reqFolderId || null;
        let fName: string = reqFolder || 'Folder';
        if (!fId && reqFolder) {
          const { data: foundFolder } = await adminClient
            .schema('pipeline')
            .from('pipeline_folders')
            .select('id, name')
            .ilike('name', reqFolder)
            .maybeSingle();

          if (foundFolder) {
            fId = foundFolder.id;
            fName = foundFolder.name;
          } else {
            const { data: created } = await adminClient.rpc('pipeline_folder_create', {
              p_name: reqFolder,
              p_description: null,
              p_color: '#6366f1',
              p_icon: '📁',
            });
            const cObj = typeof created === 'string' ? JSON.parse(created) : created;
            if (cObj?.id) fId = cObj.id;
          }
        }

        if (fId) {
          const { data: addData } = await adminClient.rpc('pipeline_folder_add_property', {
            p_property_id: existing.id,
            p_folder_id: fId,
          });
          const addObj = typeof addData === 'string' ? JSON.parse(addData) : addData;
          if (addObj?.ok) {
            updatedFolderInfo = { folder: fName, name: fName, serial: addObj.serial, folder_id: fId, folder_updated: true };
          }
        }
      } catch (e) {
        console.warn('[receive-pipeline-import] Assign existing duplicate to folder failed:', e);
      }
    }

    let existingFolderInfo: Record<string, unknown> | null = updatedFolderInfo;
    if (!existingFolderInfo && existing.folder_id) {
      const { data: fRow } = await adminClient
        .schema('pipeline')
        .from('pipeline_folders')
        .select('id, name')
        .eq('id', existing.folder_id)
        .maybeSingle();
      if (fRow) {
        existingFolderInfo = {
          folder_id: fRow.id,
          name: fRow.name,
          serial: existing.folder_serial ?? null,
        };
      }
    }

    const dupStatus = existing.status ? String(existing.status) : 'scraped';
    const dupMessage = dupStatus === 'published'
      ? 'Already in pipeline (Published)'
      : dupStatus === 'archived'
        ? 'Already in pipeline (Archived)'
        : 'Already in pipeline';

    return permissiveJsonOk({
      ok: false,
      duplicate: true,
      folder_updated: Boolean(updatedFolderInfo),
      id: existing.id,
      title: existing.title,
      status: dupStatus,
      choice_property_id: existing.choice_property_id,
      imported_at: existing.imported_at,
      folder: existingFolderInfo,
      message: dupMessage,
    }, req);
  }

  // Build record using shared builder
  const lat = safeFloat(body.lat);
  const lng = safeFloat(body.lng);
  let county = safeStr(body.county);
  let neighborhood = safeStr(body.neighborhood);

  if (!county && lat != null && lng != null) {
    const actualKey = Deno.env.get('GEOAPIFY_API_KEY');
    if (actualKey) {
      try {
        const res = await fetch(
          `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${actualKey}`,
          { signal: AbortSignal.timeout(2500) }
        );
        if (res.ok) {
          const json = await res.json();
          const props = json?.features?.[0]?.properties;
          if (props) {
            if (!county) body.county = props.county || county;
            if (!neighborhood) body.neighborhood = props.suburb || props.district || props.city_district || neighborhood;
          }
        }
      } catch (e) {
        console.warn('[receive-pipeline-import] Geoapify reverse geocode failed:', e);
      }
    }
  }

  const record = buildPipelineRecord(body as unknown as Parameters<typeof buildPipelineRecord>[0]);

  // ── 1.5 Save raw payload to the Data Lake Storage Bucket (Fire & Forget) ──
  try {
    const fileName = `raw_${source}_${record.id || crypto.randomUUID()}_${new Date().toISOString()}.json`;
    console.log(`[DataLake] Saving raw payload to pipeline-raw-payloads/${fileName}`);

    // Using void to intentionally not await this and block the response to the scraper
    void adminClient.storage
      .from('pipeline-raw-payloads')
      .upload(fileName, JSON.stringify(body), { contentType: 'application/json' })
      .then(({ error }) => {
        if (error) console.error(`[DataLake] Error saving raw payload:`, error.message);
      });
  } catch (lakeErr) {
    console.error(`[DataLake] Uncaught error saving raw payload:`, lakeErr);
  }

  // Extract source image entries and URLs
  const sourceImageEntries = parseImageEntries(record.original_image_urls);
  const sourceImageUrls = sourceImageEntries
    .map(imageEntryUrl)
    .filter((u) => typeof u === 'string' && u.startsWith('http'));

  if (sourceImageUrls.length > 0) {
    record.photo_import_status = 'queued';
    record.photo_upload_status = 'uploading';
  }

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

  // Direct Source CDN Mode: bypass remote ImageKit uploads completely.
  // Source CDN photo URLs are stored directly in original_image_urls for maximum speed,
  // zero upload failures, and full 1536px resolution preservation.
  record.photo_import_status = 'completed';
  record.photo_upload_status = 'complete';
  record.last_photo_import_at = new Date().toISOString();
  record.last_photo_import_error = null;

  // Insert into pipeline
  const { error: insertErr } = await adminClient
    .schema('pipeline')
    .from('pipeline_properties')
    .insert(record);

  if (insertErr) {
    console.error('Insert error:', insertErr);
    return permissiveJsonErr(500, 'Database insert failed: ' + insertErr.message, req);
  }

  // The extension supplies a cached folder name, so avoid extra reads on the
  // latency-sensitive save path.
  const folderResult = targetFolderId ? {
    folder_id: targetFolderId,
    name: targetFolderName || 'Folder',
    serial: record.folder_serial,
  } : null;

  return permissiveJsonOk({
    ok:     true,
    id:     record.id,
    title:  String(record.title),
    score:  record.data_quality_score,
    photos: sourceImageUrls.length,
    photos_queued: false,
    source_cdn_photos: sourceImageUrls.length,
    imagekit_photos: 0,
    imagekit_failed: 0,
    city:   safeStr(body.city),
    rent:   safeInt(body.monthly_rent),
    folder: folderResult,
  }, req);
});
