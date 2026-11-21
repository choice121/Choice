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

  // 0A. CREATE 4-DIGIT BATCH + 1:1 DISPOSABLE FOLDER
  if (action === 'create_batch') {
    const batchId = safeStr(body.batch_id);
    if (!batchId) {
      return permissiveJsonErr(400, 'batch_id is required (4-digit code, e.g. 4821)', req);
    }
    const { data, error } = await adminClient.rpc('batch_create', {
      p_batch_id: batchId,
      p_target_market: safeStr(body.target_market) || 'Unspecified',
      p_workflow_type: safeStr(body.workflow_type) || 'scrape_and_publish',
      p_visibility: safeStr(body.visibility) || 'private_placement',
      p_task_config: (body.task_config && typeof body.task_config === 'object') ? body.task_config : {},
      p_description: safeStr(body.description) || null,
      p_color: safeStr(body.color) || '#6366f1',
      p_icon: safeStr(body.icon) || '📦',
    });
    if (error) return permissiveJsonErr(500, error.message, req);
    const resObj = typeof data === 'string' ? JSON.parse(data) : data;
    if (!resObj?.ok) {
      const code = resObj?.error;
      const status = code === 'batch_id_already_used' ? 409 : 400;
      return new Response(JSON.stringify(resObj || { ok: false, error: 'Batch creation failed' }), {
        status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': req.headers.get('origin') || '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-import-secret',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        },
      });
    }
    return permissiveJsonOk(resObj, req);
  }

  // 0B. BATCH LOOKUP
  if (action === 'batch_lookup' || (req.method === 'GET' && actionFromQuery === 'batch_lookup')) {
    const batchId = safeStr(body.batch_id) || safeStr(url.searchParams.get('batch_id'));
    if (!batchId) return permissiveJsonErr(400, 'batch_id is required', req);
    const { data, error } = await adminClient.rpc('batch_lookup', { p_batch_id: batchId });
    if (error) return permissiveJsonErr(500, error.message, req);
    const resObj = typeof data === 'string' ? JSON.parse(data) : data;
    return permissiveJsonOk(resObj || { ok: true, found: false, batch_id: batchId }, req);
  }

  // 0C. LIST BATCHES & NAMESPACE STATS
  if (action === 'list_batches' || (req.method === 'GET' && actionFromQuery === 'list_batches')) {
    const limitParam = safeInt(body.limit) || safeInt(url.searchParams.get('limit')) || 50;
    const formatParam = safeStr(body.batch_format) || safeStr(url.searchParams.get('batch_format'));
    const [{ data: batches, error: bErr }, { data: stats, error: sErr }] = await Promise.all([
      adminClient.rpc('batch_list', { p_limit: limitParam, p_batch_format: formatParam }),
      adminClient.rpc('batch_namespace_stats'),
    ]);
    if (bErr) return permissiveJsonErr(500, bErr.message, req);
    if (sErr) return permissiveJsonErr(500, sErr.message, req);
    return permissiveJsonOk({
      ok: true,
      batches: typeof batches === 'string' ? JSON.parse(batches) : (batches || []),
      namespace_stats: typeof stats === 'string' ? JSON.parse(stats) : stats,
    }, req);
  }

  // 1. LIST FOLDERS
  if (action === 'list_folders' || (req.method === 'GET' && actionFromQuery === 'list_folders')) {
    const { data, error } = await adminClient.rpc('pipeline_folder_list');
    if (error) {
      const { data: rawFolders, error: rawErr } = await adminClient
        .schema('pipeline')
        .from('pipeline_folders')
        .select('id, name, description, created_at, color, icon, batch_id, batch_uuid, is_disposable_batch, cleanup_state')
        .neq('cleanup_state', 'deleted')
        .order('is_disposable_batch', { ascending: false })
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

    const { data, error } = await adminClient.rpc('pipeline_folder_create', {
      p_name: folderName,
      p_description: description || null,
      p_color: color,
      p_icon: icon,
    });

    if (!error && data) {
      const resObj = typeof data === 'string' ? JSON.parse(data) : data;
      if (resObj?.ok === false) {
        if (resObj.error === 'batch_id_already_used') {
          return new Response(JSON.stringify(resObj), {
            status: 409,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': req.headers.get('origin') || '*',
              'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-import-secret',
              'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            },
          });
        }
        if (resObj.error === 'Folder already exists' && resObj.id) {
          folderId = resObj.id;
        } else {
          return permissiveJsonErr(400, resObj.message || resObj.error || 'Folder creation failed', req);
        }
      } else {
        folderId = resObj?.id || null;
        if (resObj?.name !== undefined && resObj?.name !== null) finalName = String(resObj.name);
      }
    } else {
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
        const { data: existingF } = await adminClient
          .schema('pipeline')
          .from('pipeline_folders')
          .select('id, name')
          .ilike('name', folderName)
          .neq('cleanup_state', 'deleted')
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

    const { data: folderDetail } = folderId
      ? await adminClient
          .schema('pipeline')
          .from('pipeline_folders')
          .select('id, name, batch_id, batch_uuid, is_disposable_batch, icon, color')
          .eq('id', folderId)
          .maybeSingle()
      : { data: null };

    return permissiveJsonOk({
      ok: true,
      id: folderId,
      name: folderDetail?.name || finalName,
      batch_id: folderDetail?.batch_id || null,
      batch_uuid: folderDetail?.batch_uuid || null,
      is_disposable_batch: Boolean(folderDetail?.is_disposable_batch),
      icon: folderDetail?.icon || icon,
      color: folderDetail?.color || color,
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
        .neq('cleanup_state', 'deleted')
        .maybeSingle();
      if (fRow) resolvedId = fRow.id;
    }

    if (!resolvedId) {
      return permissiveJsonErr(400, 'folder_id or existing folder_name is required', req);
    }

    const { data, error } = await adminClient.rpc('pipeline_folder_properties', {
      p_folder_id: resolvedId,
    });

    if (!error && data) {
      const properties = typeof data === 'string' ? JSON.parse(data) : (data || []);
      return permissiveJsonOk({ ok: true, folder_id: resolvedId, properties }, req);
    }

    const { data: rawProps, error: rawPropsErr } = await adminClient
      .schema('pipeline')
      .from('pipeline_properties')
      .select('id, title, address, city, state, monthly_rent, bedrooms, bathrooms, square_footage, original_image_urls, source_url, folder_serial, batch_id, batch_uuid, created_at')
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

    const { error: updErr } = await adminClient
      .schema('pipeline')
      .from('pipeline_properties')
      .update({ folder_id: null, folder_serial: null })
      .eq('id', propertyId);

    if (updErr) return permissiveJsonErr(500, updErr.message, req);
    return permissiveJsonOk({ ok: true, property_id: propertyId }, req);
  }

  // 5. CHECK IF LISTING ALREADY EXISTS IN PIPELINE (SCOPED BY BATCH OR INBOX)
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

    const checkBatchId = safeStr(body.batch_id) || safeStr(url.searchParams.get('batch_id'));
    const checkFolderId = safeStr(body.folder_id) || safeStr(url.searchParams.get('folder_id'));
    const checkFolderName = safeStr(body.folder_name) || safeStr(url.searchParams.get('folder_name'));

    let scopeBatchId: string | null = checkBatchId || null;
    if (!scopeBatchId && checkFolderId) {
      const { data: fRow } = await adminClient
        .schema('pipeline')
        .from('pipeline_folders')
        .select('batch_id')
        .eq('id', checkFolderId)
        .maybeSingle();
      scopeBatchId = fRow?.batch_id || null;
    } else if (!scopeBatchId && checkFolderName) {
      const { data: fRow } = await adminClient
        .schema('pipeline')
        .from('pipeline_folders')
        .select('batch_id')
        .ilike('name', checkFolderName.trim())
        .neq('cleanup_state', 'deleted')
        .maybeSingle();
      scopeBatchId = fRow?.batch_id || null;
    }

    let matchQuery = adminClient
      .schema('pipeline')
      .from('pipeline_properties')
      .select('id, title, status, folder_id, folder_serial, batch_id, batch_uuid, choice_property_id, imported_at')
      .eq('source_listing_id', checkSourceId)
      .eq('source', checkSource);

    if (scopeBatchId) {
      matchQuery = matchQuery.eq('batch_id', scopeBatchId);
    } else {
      matchQuery = matchQuery.is('batch_id', null);
    }

    const { data: matchRows } = await matchQuery
      .order('imported_at', { ascending: false })
      .limit(1);
    const match = matchRows?.[0] ?? null;

    // Informational sibling batches holding the same source listing
    const { data: siblingRows } = await adminClient
      .schema('pipeline')
      .from('pipeline_properties')
      .select('batch_id')
      .eq('source_listing_id', checkSourceId)
      .eq('source', checkSource)
      .not('batch_id', 'is', null);
    const otherBatches = Array.from(new Set(
      (siblingRows || [])
        .map((r: any) => safeStr(r.batch_id))
        .filter((b): b is string => Boolean(b) && b !== scopeBatchId)
    ));

    if (!match) {
      return permissiveJsonOk({
        ok: true,
        exists: false,
        batch_id: scopeBatchId,
        other_batches: otherBatches,
      }, req);
    }

    let folderMeta: Record<string, unknown> | null = null;
    if (match.folder_id) {
      const { data: fRow } = await adminClient
        .schema('pipeline')
        .from('pipeline_folders')
        .select('id, name, batch_id, is_disposable_batch')
        .eq('id', match.folder_id)
        .maybeSingle();
      if (fRow) {
        folderMeta = {
          folder_id: fRow.id,
          name: fRow.name,
          batch_id: fRow.batch_id || match.batch_id || null,
          is_disposable_batch: Boolean(fRow.is_disposable_batch),
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
      batch_id: match.batch_id || null,
      batch_uuid: match.batch_uuid || null,
      choice_property_id: match.choice_property_id,
      imported_at: match.imported_at,
      folder: folderMeta,
      other_batches: otherBatches,
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

  // ── Step 1: Resolve Batch & Folder Context BEFORE Duplicate Check ─────────
  const explicitBatchId = safeStr(body.batch_id);
  const reqFolderId = safeStr(body.folder_id);
  const reqFolderName = body.folder_name !== undefined && body.folder_name !== null
    ? String(body.folder_name).trim()
    : '';

  let targetFolderId: string | null = reqFolderId;
  let targetFolderName: string | null = reqFolderName || null;
  let targetBatchId: string | null = null;
  let targetBatchUuid: string | null = null;
  let targetIsDisposable = false;

  if (explicitBatchId) {
    const { data: batchRow, error: batchErr } = await adminClient
      .from('publishing_batches')
      .select('id, batch_uuid, batch_format, disposable_folder_id')
      .eq('id', explicitBatchId)
      .maybeSingle();

    if (batchErr) return permissiveJsonErr(500, batchErr.message, req);
    if (!batchRow) {
      return permissiveJsonErr(404, `Batch #${explicitBatchId} does not exist. Register the 4-digit batch first.`, req);
    }
    targetBatchId = batchRow.id;
    targetBatchUuid = batchRow.batch_uuid;

    if (targetFolderId) {
      const { data: fRow } = await adminClient
        .schema('pipeline')
        .from('pipeline_folders')
        .select('id, name, batch_id, is_disposable_batch')
        .eq('id', targetFolderId)
        .maybeSingle();
      if (!fRow) {
        return permissiveJsonErr(404, 'Selected folder not found', req);
      }
      if (fRow.batch_id && fRow.batch_id !== explicitBatchId) {
        return permissiveJsonErr(400, `Folder belongs to batch ${fRow.batch_id}, not ${explicitBatchId}`, req);
      }
      targetFolderName = fRow.name;
      targetIsDisposable = Boolean(fRow.is_disposable_batch);
    } else if (batchRow.disposable_folder_id) {
      targetFolderId = batchRow.disposable_folder_id;
      targetFolderName = explicitBatchId;
      targetIsDisposable = true;
    } else {
      const { data: dispFolder } = await adminClient
        .schema('pipeline')
        .from('pipeline_folders')
        .select('id, name, is_disposable_batch')
        .eq('batch_id', explicitBatchId)
        .neq('cleanup_state', 'deleted')
        .maybeSingle();
      if (dispFolder) {
        targetFolderId = dispFolder.id;
        targetFolderName = dispFolder.name;
        targetIsDisposable = Boolean(dispFolder.is_disposable_batch);
      }
    }
  } else if (targetFolderId) {
    const { data: fRow, error: fErr } = await adminClient
      .schema('pipeline')
      .from('pipeline_folders')
      .select('id, name, batch_id, batch_uuid, is_disposable_batch, cleanup_state')
      .eq('id', targetFolderId)
      .maybeSingle();

    if (fErr) return permissiveJsonErr(500, fErr.message, req);
    if (fRow && fRow.cleanup_state !== 'deleted') {
      targetFolderId = fRow.id;
      targetFolderName = fRow.name;
      targetBatchId = fRow.batch_id || null;
      targetBatchUuid = fRow.batch_uuid || null;
      targetIsDisposable = Boolean(fRow.is_disposable_batch);
    } else {
      // Fall back to name resolution if cached ID came from another session or deleted folder
      targetFolderId = null;
    }
  }

  if (!targetFolderId && reqFolderName) {
    const { data: existingFolder } = await adminClient
      .schema('pipeline')
      .from('pipeline_folders')
      .select('id, name, batch_id, batch_uuid, is_disposable_batch, cleanup_state')
      .ilike('name', reqFolderName)
      .neq('cleanup_state', 'deleted')
      .maybeSingle();

    if (existingFolder) {
      targetFolderId = existingFolder.id;
      targetFolderName = existingFolder.name;
      targetBatchId = targetBatchId || existingFolder.batch_id || null;
      targetBatchUuid = targetBatchUuid || existingFolder.batch_uuid || null;
      targetIsDisposable = targetIsDisposable || Boolean(existingFolder.is_disposable_batch);
    } else {
      const { data: createdF, error: createFErr } = await adminClient.rpc('pipeline_folder_create', {
        p_name: reqFolderName,
        p_description: null,
        p_color: '#6366f1',
        p_icon: '📁',
      });
      if (createFErr) {
        return permissiveJsonErr(500, 'Could not resolve target folder: ' + createFErr.message, req);
      }
      const cObj = typeof createdF === 'string' ? JSON.parse(createdF) : createdF;
      if (cObj?.ok === false && cObj?.error === 'batch_id_already_used') {
        return new Response(JSON.stringify(cObj), {
          status: 409,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': req.headers.get('origin') || '*',
            'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-import-secret',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          },
        });
      }
      if (cObj?.id) {
        targetFolderId = cObj.id;
        targetFolderName = cObj.name || reqFolderName;
      }
    }
  }

  // ── Step 2: Scoped Intra-Batch / Inbox Duplicate Check ───────────────────
  let dupQuery = adminClient
    .schema('pipeline')
    .from('pipeline_properties')
    .select('id, title, status, folder_id, folder_serial, batch_id, batch_uuid, choice_property_id, imported_at, field_provenance')
    .eq('source_listing_id', sourceListingId)
    .eq('source', source);

  if (targetBatchId) {
    dupQuery = dupQuery.eq('batch_id', targetBatchId);
  } else {
    dupQuery = dupQuery.is('batch_id', null);
  }

  const { data: existingRows } = await dupQuery
    .order('imported_at', { ascending: false })
    .limit(1);
  const existing = existingRows?.[0] ?? null;

  if (existing) {
    const existingProvenance = (existing.field_provenance && typeof existing.field_provenance === 'object')
      ? (existing.field_provenance as Record<string, unknown>)
      : null;
    const existingSaveNonce = safeStr(existingProvenance?.save_nonce);

    // Idempotent retry for identical save_nonce from the same save click
    if (incomingSaveNonce && existingSaveNonce && incomingSaveNonce === existingSaveNonce) {
      let sameSaveFolder: Record<string, unknown> | null = null;
      if (existing.folder_id) {
        const { data: fRow } = await adminClient
          .schema('pipeline')
          .from('pipeline_folders')
          .select('id, name, batch_id, is_disposable_batch')
          .eq('id', existing.folder_id)
          .maybeSingle();
        sameSaveFolder = {
          folder_id: existing.folder_id,
          name: fRow?.name || targetFolderName || 'Folder',
          batch_id: fRow?.batch_id || existing.batch_id || null,
          is_disposable_batch: Boolean(fRow?.is_disposable_batch),
          serial: existing.folder_serial ?? null,
        };
      }
      return permissiveJsonOk({
        ok: true,
        deduped_retry: true,
        id: existing.id,
        title: String(existing.title || ''),
        status: existing.status,
        batch_id: existing.batch_id || null,
        batch_uuid: existing.batch_uuid || null,
        choice_property_id: existing.choice_property_id,
        photos_queued: false,
        folder: sameSaveFolder,
      }, req);
    }

    // Reassign regular folder within the same inbox scope (existing v34+ behavior)
    let updatedFolderInfo: Record<string, unknown> | null = null;
    if (targetFolderId && existing.folder_id !== targetFolderId && (existing.batch_id || null) === (targetBatchId || null)) {
      try {
        const { data: addData } = await adminClient.rpc('pipeline_folder_add_property', {
          p_property_id: existing.id,
          p_folder_id: targetFolderId,
        });
        const addObj = typeof addData === 'string' ? JSON.parse(addData) : addData;
        if (addObj?.ok) {
          updatedFolderInfo = {
            folder: targetFolderName || 'Folder',
            name: targetFolderName || 'Folder',
            batch_id: targetBatchId,
            is_disposable_batch: targetIsDisposable,
            serial: addObj.serial,
            folder_id: targetFolderId,
            folder_updated: true,
          };
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
        .select('id, name, batch_id, is_disposable_batch')
        .eq('id', existing.folder_id)
        .maybeSingle();
      if (fRow) {
        existingFolderInfo = {
          folder_id: fRow.id,
          name: fRow.name,
          batch_id: fRow.batch_id || existing.batch_id || null,
          is_disposable_batch: Boolean(fRow.is_disposable_batch),
          serial: existing.folder_serial ?? null,
        };
      }
    }

    const dupStatus = existing.status ? String(existing.status) : 'scraped';
    const dupMessage = targetBatchId
      ? `Already in Batch #${targetBatchId}`
      : dupStatus === 'published'
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
      batch_id: existing.batch_id || null,
      batch_uuid: existing.batch_uuid || null,
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
  record.batch_id = targetBatchId;
  record.batch_uuid = targetBatchUuid;

  // ── Save raw payload to the Data Lake Storage Bucket (Fire & Forget) ──
  try {
    const rawKeyPrefix = targetBatchId ? `batches/${targetBatchId}/` : '';
    const fileName = `${rawKeyPrefix}raw_${source}_${record.id || crypto.randomUUID()}_${new Date().toISOString()}.json`;
    console.log(`[DataLake] Saving raw payload to pipeline-raw-payloads/${fileName}`);

    void adminClient.storage
      .from('pipeline-raw-payloads')
      .upload(fileName, JSON.stringify(body), { contentType: 'application/json' })
      .then(({ error }) => {
        if (error) console.error(`[DataLake] Error saving raw payload:`, error.message);
      });
  } catch (lakeErr) {
    console.error(`[DataLake] Uncaught error saving raw payload:`, lakeErr);
  }

  const sourceImageEntries = parseImageEntries(record.original_image_urls);
  const sourceImageUrls = sourceImageEntries
    .map(imageEntryUrl)
    .filter((u) => typeof u === 'string' && u.startsWith('http'));

  if (targetFolderId) {
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

  // Direct Source CDN Mode
  record.photo_import_status = 'completed';
  record.photo_upload_status = sourceImageUrls.length > 0 ? 'complete' : 'none';
  record.last_photo_import_at = new Date().toISOString();
  record.last_photo_import_error = null;

  const { error: insertErr } = await adminClient
    .schema('pipeline')
    .from('pipeline_properties')
    .insert(record);

  if (insertErr) {
    if (insertErr.code === '23505') {
      // Concurrent race on identical save_nonce or intra-batch insert
      let raceQuery = adminClient
        .schema('pipeline')
        .from('pipeline_properties')
        .select('id, title, status, folder_id, folder_serial, batch_id, batch_uuid, choice_property_id, field_provenance')
        .eq('source_listing_id', sourceListingId)
        .eq('source', source);
      raceQuery = targetBatchId ? raceQuery.eq('batch_id', targetBatchId) : raceQuery.is('batch_id', null);
      const { data: raceRow } = await raceQuery.maybeSingle();
      const raceNonce = safeStr((raceRow?.field_provenance as Record<string, unknown> | undefined)?.save_nonce);
      if (raceRow && incomingSaveNonce && raceNonce && incomingSaveNonce === raceNonce) {
        return permissiveJsonOk({
          ok: true,
          deduped_retry: true,
          id: raceRow.id,
          title: String(raceRow.title || ''),
          status: raceRow.status,
          batch_id: raceRow.batch_id || null,
          batch_uuid: raceRow.batch_uuid || null,
          choice_property_id: raceRow.choice_property_id,
          photos_queued: false,
          folder: targetFolderId ? {
            folder_id: targetFolderId,
            name: targetFolderName || 'Folder',
            batch_id: targetBatchId,
            is_disposable_batch: targetIsDisposable,
            serial: raceRow.folder_serial ?? null,
          } : null,
        }, req);
      }
      return permissiveJsonOk({
        ok: false,
        duplicate: true,
        id: raceRow?.id || null,
        title: raceRow?.title || String(record.title || ''),
        status: raceRow?.status || 'scraped',
        batch_id: raceRow?.batch_id || targetBatchId || null,
        message: targetBatchId ? `Already in Batch #${targetBatchId}` : 'Already in pipeline',
      }, req);
    }
    console.error('Insert error:', insertErr);
    return permissiveJsonErr(500, 'Database insert failed: ' + insertErr.message, req);
  }

  const folderResult = targetFolderId ? {
    folder_id: targetFolderId,
    name: targetFolderName || 'Folder',
    batch_id: targetBatchId,
    batch_uuid: targetBatchUuid,
    is_disposable_batch: targetIsDisposable,
    serial: record.folder_serial,
  } : null;

  return permissiveJsonOk({
    ok: true,
    id: record.id,
    title: String(record.title),
    score: record.data_quality_score,
    photos: sourceImageUrls.length,
    photos_queued: false,
    source_cdn_photos: sourceImageUrls.length,
    imagekit_photos: 0,
    imagekit_failed: 0,
    city: safeStr(body.city),
    rent: safeInt(body.monthly_rent),
    batch_id: targetBatchId,
    batch_uuid: targetBatchUuid,
    folder: folderResult,
  }, req);
});
