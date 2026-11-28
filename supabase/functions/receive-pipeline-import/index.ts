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
import { extractPosterProfileSignal } from '../_shared/apify-normalizer.ts';
import { matchProhibitedProfiles, type ProhibitedProfileRule } from '../_shared/property-validation.ts';

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

function normalizeStreetForMatch(raw: unknown): string {
  let s = String(raw || '').toLowerCase().trim();
  if (!s) return '';
  s = s.replace(/[.,#]/g, ' ').replace(/\s+/g, ' ').trim();
  const suffixMap: Record<string, string> = {
    street: 'st', st: 'st',
    avenue: 'ave', ave: 'ave',
    lane: 'ln', ln: 'ln',
    drive: 'dr', dr: 'dr',
    road: 'rd', rd: 'rd',
    boulevard: 'blvd', blvd: 'blvd',
    court: 'ct', ct: 'ct',
    circle: 'cir', cir: 'cir',
    place: 'pl', pl: 'pl',
    terrace: 'ter', ter: 'ter',
    trail: 'trl', trl: 'trl',
    parkway: 'pkwy', pkwy: 'pkwy',
    way: 'way',
  };
  const dirMap: Record<string, string> = {
    north: 'n', south: 's', east: 'e', west: 'w',
    northeast: 'ne', northwest: 'nw', southeast: 'se', southwest: 'sw',
  };
  const tokens = s.split(' ').map((t, idx, arr) => {
    if (idx > 0 && dirMap[t]) return dirMap[t];
    if (idx === arr.length - 1 && suffixMap[t]) return suffixMap[t];
    return t;
  });
  return tokens.join(' ');
}

function buildAddrMatchKey(address: unknown, city: unknown, state: unknown): string {
  const street = normalizeStreetForMatch(address);
  const c = String(city || '').toLowerCase().trim().replace(/\s+/g, ' ');
  const st = String(state || '').toLowerCase().trim().replace(/\s+/g, ' ');
  if (!street || !c) return '';
  return `${street}|${c}|${st}`;
}

interface ActivePublicHit {
  property_id: string;
  status: 'active';
  monthly_rent: number | null;
  title: string | null;
}

/**
 * Checks ONLY public.properties with status = 'active' (never 'private_placement').
 * Matches by linked choice_property_id, field_provenance->>'source_listing_id',
 * or optional normalized (address, city, state).
 */
async function findActivePublicMatchMap(
  adminClient: ReturnType<typeof createClient>,
  source: string,
  items: Array<{
    sid: string;
    choiceId?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
  }>,
): Promise<Map<string, ActivePublicHit>> {
  const result = new Map<string, ActivePublicHit>();
  if (!items.length) return result;

  const choiceIds = Array.from(new Set(
    items.map((it) => safeStr(it.choiceId)).filter((v): v is string => Boolean(v))
  ));
  const sids = Array.from(new Set(
    items.map((it) => safeStr(it.sid)).filter((v): v is string => Boolean(v))
  ));
  const cities = Array.from(new Set(
    items.map((it) => safeStr(it.city)).filter((v): v is string => Boolean(v))
  ));

  const byId = new Map<string, ActivePublicHit>();
  const bySid = new Map<string, ActivePublicHit>();
  const byAddr = new Map<string, ActivePublicHit>();

  const recordRow = (pr: any) => {
    if (!pr || String(pr.status || '') !== 'active' || !pr.id) return;
    const hit: ActivePublicHit = {
      property_id: String(pr.id),
      status: 'active',
      monthly_rent: pr.monthly_rent != null ? Number(pr.monthly_rent) : null,
      title: pr.title ? String(pr.title) : null,
    };
    byId.set(hit.property_id, hit);
    const fpSid = safeStr(pr.field_provenance?.source_listing_id);
    const fpSrc = safeStr(pr.field_provenance?.source) || 'zillow';
    if (fpSid && fpSrc === source) bySid.set(fpSid, hit);
    const ak = buildAddrMatchKey(pr.address, pr.city, pr.state);
    if (ak && !byAddr.has(ak)) byAddr.set(ak, hit);
  };

  if (choiceIds.length > 0) {
    const { data } = await adminClient
      .from('properties')
      .select('id, status, monthly_rent, title, address, city, state, field_provenance')
      .eq('status', 'active')
      .in('id', choiceIds);
    for (const pr of data || []) recordRow(pr);
  }

  if (sids.length > 0) {
    const { data } = await adminClient
      .from('properties')
      .select('id, status, monthly_rent, title, address, city, state, field_provenance')
      .eq('status', 'active')
      .in('field_provenance->>source_listing_id', sids);
    for (const pr of data || []) recordRow(pr);
  }

  if (cities.length > 0) {
    const { data } = await adminClient
      .from('properties')
      .select('id, status, monthly_rent, title, address, city, state, field_provenance')
      .eq('status', 'active')
      .in('city', cities)
      .limit(400);
    for (const pr of data || []) recordRow(pr);
  }

  for (const it of items) {
    const sid = safeStr(it.sid);
    if (!sid) continue;
    const cid = safeStr(it.choiceId);
    const ak = buildAddrMatchKey(it.address, it.city, it.state);
    const hit = (cid ? byId.get(cid) : undefined) || bySid.get(sid) || (ak ? byAddr.get(ak) : undefined);
    if (hit) result.set(sid, hit);
  }

  return result;
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
    const rawTaskConfig =
      body.task_config && typeof body.task_config === 'object' && !Array.isArray(body.task_config)
        ? (body.task_config as Record<string, unknown>)
        : {};
    const requestedVisibility = safeStr(body.visibility) || 'private_placement';
    const explicitPublicOverride =
      body.explicit_public_override === true ||
      body.allow_public_override === true ||
      rawTaskConfig.explicit_public_override === true;

    if (requestedVisibility === 'active' && !explicitPublicOverride) {
      return permissiveJsonErr(
        403,
        'Strict rule: every batch defaults to private_placement unless explicit_public_override: true is explicitly supplied.',
        req,
      );
    }

    const effectiveTaskConfig = requestedVisibility === 'active'
      ? { ...rawTaskConfig, explicit_public_override: true }
      : rawTaskConfig;

    const { data, error } = await adminClient.rpc('batch_create', {
      p_batch_id: batchId,
      p_target_market: safeStr(body.target_market) || 'Unspecified',
      p_workflow_type: safeStr(body.workflow_type) || 'scrape_and_publish',
      p_visibility: requestedVisibility,
      p_task_config: effectiveTaskConfig,
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
    const checkAddress = safeStr(body.address) || safeStr(url.searchParams.get('address'));
    const checkCity = safeStr(body.city) || safeStr(url.searchParams.get('city'));
    const checkState = safeStr(body.state) || safeStr(url.searchParams.get('state'));

    let scopeBatchId: string | null = checkBatchId || null;
    let scopeFolderId: string | null = checkFolderId || null;
    if (checkFolderId && !scopeBatchId) {
      const { data: fRow } = await adminClient
        .schema('pipeline')
        .from('pipeline_folders')
        .select('id, batch_id')
        .eq('id', checkFolderId)
        .maybeSingle();
      if (fRow) {
        scopeFolderId = fRow.id || checkFolderId;
        scopeBatchId = fRow.batch_id || null;
      }
    } else if (!scopeBatchId && !scopeFolderId && checkFolderName) {
      const { data: fRow } = await adminClient
        .schema('pipeline')
        .from('pipeline_folders')
        .select('id, batch_id')
        .ilike('name', checkFolderName.trim())
        .neq('cleanup_state', 'deleted')
        .maybeSingle();
      if (fRow) {
        scopeFolderId = fRow.id || null;
        scopeBatchId = fRow.batch_id || null;
      }
    }

    let matchQuery = adminClient
      .schema('pipeline')
      .from('pipeline_properties')
      .select('id, title, status, folder_id, folder_serial, batch_id, batch_uuid, choice_property_id, imported_at')
      .eq('source_listing_id', checkSourceId)
      .eq('source', checkSource);

    if (scopeBatchId) {
      matchQuery = matchQuery.eq('batch_id', scopeBatchId);
    } else if (scopeFolderId) {
      matchQuery = matchQuery.is('batch_id', null).eq('folder_id', scopeFolderId);
    } else {
      matchQuery = matchQuery.is('batch_id', null).is('folder_id', null);
    }

    const { data: matchRows } = await matchQuery
      .order('imported_at', { ascending: false })
      .limit(1);
    const match = matchRows?.[0] ?? null;

    // Check ONLY public.properties with status = 'active' (private placements never count as already on site)
    const activePubMap = await findActivePublicMatchMap(adminClient, checkSource, [{
      sid: checkSourceId,
      choiceId: match?.choice_property_id || null,
      address: checkAddress,
      city: checkCity,
      state: checkState,
    }]);
    const activePub = activePubMap.get(checkSourceId) || null;

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
        folder_id: scopeFolderId,
        active_on_site: Boolean(activePub),
        public_property_id: activePub?.property_id || null,
        public_monthly_rent: activePub?.monthly_rent ?? null,
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
      active_on_site: Boolean(activePub),
      public_property_id: activePub?.property_id || null,
      public_monthly_rent: activePub?.monthly_rent ?? null,
      imported_at: match.imported_at,
      folder: folderMeta,
      other_batches: otherBatches,
    }, req);
  }

  // 5B. BATCH CHECK MULTIPLE LISTINGS IN ONE CALL (Zero-Tab Search Card Pre-Flight)
  if (action === 'check_listings_batch' || (req.method === 'GET' && actionFromQuery === 'check_listings_batch')) {
    const rawIdsParam = safeStr(url.searchParams.get('source_listing_ids'));
    const rawIds: unknown[] = Array.isArray(body.source_listing_ids)
      ? body.source_listing_ids
      : (rawIdsParam ? rawIdsParam.split(',') : []);

    const uniqueIds = Array.from(new Set(
      rawIds.map((v) => safeStr(v)).filter((v): v is string => Boolean(v))
    )).slice(0, 100);

    if (uniqueIds.length === 0) {
      return permissiveJsonOk({
        ok: true,
        source: 'zillow',
        batch_id: null,
        results: {},
      }, req);
    }

    const rawSource = safeStr(body.source) || safeStr(url.searchParams.get('source'));
    let checkSource = 'zillow';
    try {
      checkSource = normalizeSource(rawSource);
    } catch {
      checkSource = (rawSource || 'zillow').toLowerCase();
    }

    const checkBatchId = safeStr(body.batch_id) || safeStr(url.searchParams.get('batch_id'));
    const checkFolderId = safeStr(body.folder_id) || safeStr(url.searchParams.get('folder_id'));
    const checkFolderName = safeStr(body.folder_name) || safeStr(url.searchParams.get('folder_name'));
    const addressesMap = (body.addresses && typeof body.addresses === 'object' && !Array.isArray(body.addresses))
      ? (body.addresses as Record<string, { address?: string; city?: string; state?: string }>)
      : {};

    let scopeBatchId: string | null = checkBatchId || null;
    let scopeFolderId: string | null = checkFolderId || null;
    if (checkFolderId && !scopeBatchId) {
      const { data: fRow } = await adminClient
        .schema('pipeline')
        .from('pipeline_folders')
        .select('id, batch_id')
        .eq('id', checkFolderId)
        .maybeSingle();
      if (fRow) {
        scopeFolderId = fRow.id || checkFolderId;
        scopeBatchId = fRow.batch_id || null;
      }
    } else if (!scopeBatchId && !scopeFolderId && checkFolderName) {
      const { data: fRow } = await adminClient
        .schema('pipeline')
        .from('pipeline_folders')
        .select('id, batch_id')
        .ilike('name', checkFolderName.trim())
        .neq('cleanup_state', 'deleted')
        .maybeSingle();
      if (fRow) {
        scopeFolderId = fRow.id || null;
        scopeBatchId = fRow.batch_id || null;
      }
    }

    const { data: allRows, error: batchCheckErr } = await adminClient
      .schema('pipeline')
      .from('pipeline_properties')
      .select('id, source_listing_id, title, status, folder_id, folder_serial, batch_id, batch_uuid, choice_property_id, imported_at')
      .eq('source', checkSource)
      .in('source_listing_id', uniqueIds)
      .order('imported_at', { ascending: false });

    if (batchCheckErr) {
      return permissiveJsonErr(500, batchCheckErr.message, req);
    }

    const folderIds = Array.from(new Set(
      (allRows || []).map((r: any) => safeStr(r.folder_id)).filter((v): v is string => Boolean(v))
    ));
    const folderById = new Map<string, Record<string, unknown>>();
    if (folderIds.length > 0) {
      const { data: folderRows } = await adminClient
        .schema('pipeline')
        .from('pipeline_folders')
        .select('id, name, batch_id, is_disposable_batch')
        .in('id', folderIds);
      for (const fRow of folderRows || []) {
        folderById.set(String(fRow.id), {
          folder_id: fRow.id,
          name: fRow.name,
          batch_id: fRow.batch_id || null,
          is_disposable_batch: Boolean(fRow.is_disposable_batch),
        });
      }
    }

    // Check ONLY public.properties with status = 'active' (private_placement rows are NEVER flagged as already on site)
    const choiceBySid = new Map<string, string>();
    for (const r of allRows || []) {
      const sid = safeStr(r.source_listing_id);
      const cid = safeStr(r.choice_property_id);
      if (sid && cid && !choiceBySid.has(sid)) choiceBySid.set(sid, cid);
    }
    const activePublicMap = await findActivePublicMatchMap(
      adminClient,
      checkSource,
      uniqueIds.map((sid) => {
        const addrObj = addressesMap[sid];
        return {
          sid,
          choiceId: choiceBySid.get(sid) || null,
          address: addrObj?.address || null,
          city: addrObj?.city || null,
          state: addrObj?.state || null,
        };
      }),
    );

    const results: Record<string, Record<string, unknown>> = {};
    for (const sid of uniqueIds) {
      const activeHit = activePublicMap.get(sid) || null;
      results[sid] = {
        exists_in_scope: false,
        pipeline_id: null,
        status: null,
        batch_id: null,
        folder: null,
        other_batches: [],
        published: Boolean(activeHit),
        active_on_site: Boolean(activeHit),
        choice_property_id: activeHit?.property_id || null,
        public_monthly_rent: activeHit?.monthly_rent ?? null,
      };
    }

    for (const row of allRows || []) {
      const sid = safeStr(row.source_listing_id);
      if (!sid || !results[sid]) continue;
      const entry = results[sid];
      const rowBatch = safeStr(row.batch_id);
      const rowFolder = safeStr(row.folder_id);
      const inScope = scopeBatchId
        ? rowBatch === scopeBatchId
        : scopeFolderId
          ? (!rowBatch && rowFolder === scopeFolderId)
          : (!rowBatch && !rowFolder);
      const choiceId = safeStr(row.choice_property_id);

      if (inScope && !entry.exists_in_scope) {
        const fMeta = row.folder_id ? folderById.get(String(row.folder_id)) : null;
        entry.exists_in_scope = true;
        entry.pipeline_id = row.id;
        entry.title = row.title;
        entry.status = row.status;
        entry.batch_id = row.batch_id || null;
        entry.batch_uuid = row.batch_uuid || null;
        entry.imported_at = row.imported_at || null;
        if (choiceId && !entry.choice_property_id) entry.choice_property_id = choiceId;
        entry.folder = fMeta
          ? {
              ...fMeta,
              batch_id: fMeta.batch_id || row.batch_id || null,
              serial: row.folder_serial ?? null,
            }
          : null;
      } else if (rowBatch && rowBatch !== scopeBatchId) {
        const ob = entry.other_batches as string[];
        if (!ob.includes(rowBatch)) ob.push(rowBatch);
      }
    }

    return permissiveJsonOk({
      ok: true,
      source: checkSource,
      batch_id: scopeBatchId,
      folder_id: scopeFolderId,
      results,
    }, req);
  }

  // 5C. LIST PROHIBITED SOURCE PROFILES (Zero-Tab Card Pre-Flight Guard)
  if (action === 'list_prohibited_profiles' || (req.method === 'GET' && actionFromQuery === 'list_prohibited_profiles')) {
    const { data: profiles, error: profErr } = await adminClient
      .from('prohibited_source_profiles')
      .select('id, canonical_name, aliases, zillow_profile_urls, match_mode, notes')
      .eq('enabled', true)
      .order('canonical_name', { ascending: true });

    if (profErr) {
      return permissiveJsonErr(500, profErr.message, req);
    }

    return permissiveJsonOk({
      ok: true,
      profiles: (profiles || []).map((p: any) => ({
        id: p.id,
        canonical_name: p.canonical_name,
        aliases: Array.isArray(p.aliases) ? p.aliases : [],
        zillow_profile_urls: Array.isArray(p.zillow_profile_urls) ? p.zillow_profile_urls : [],
        match_mode: p.match_mode || 'token_phrase',
        notes: p.notes || null,
      })),
    }, req);
  }

  // 5D. BULK BATCH IMPORT (Up to 25 listings per request, 1-shot DB scope & pre-checks)
  if (action === 'import_batch') {
    if (req.method !== 'POST') {
      return permissiveJsonErr(405, 'Method not allowed', req);
    }

    const rawListings = Array.isArray(body.listings) ? body.listings : null;
    if (!rawListings || rawListings.length === 0) {
      return permissiveJsonErr(400, 'listings array (1..25) is required', req);
    }
    if (rawListings.length > 25) {
      return permissiveJsonErr(400, 'import_batch limit is 25 listings per request', req);
    }

    // Resolve shared target batch & folder ONCE for the entire batch
    const topBatchId = safeStr(body.batch_id) || safeStr((rawListings[0] as any)?.batch_id);
    const topFolderId = safeStr(body.folder_id) || safeStr((rawListings[0] as any)?.folder_id);
    const rawTopFolderName = body.folder_name !== undefined && body.folder_name !== null
      ? String(body.folder_name).trim()
      : ((rawListings[0] as any)?.folder_name != null ? String((rawListings[0] as any).folder_name).trim() : '');

    let batchTargetFolderId: string | null = topFolderId;
    let batchTargetFolderName: string | null = rawTopFolderName || null;
    let batchTargetBatchId: string | null = null;
    let batchTargetBatchUuid: string | null = null;
    let batchTargetIsDisposable = false;

    if (topBatchId) {
      const { data: batchRow, error: batchErr } = await adminClient
        .from('publishing_batches')
        .select('id, batch_uuid, batch_format, disposable_folder_id')
        .eq('id', topBatchId)
        .maybeSingle();

      if (batchErr) return permissiveJsonErr(500, batchErr.message, req);
      if (!batchRow) {
        return permissiveJsonErr(404, `Batch #${topBatchId} does not exist. Register the 4-digit batch first.`, req);
      }
      batchTargetBatchId = batchRow.id;
      batchTargetBatchUuid = batchRow.batch_uuid;

      if (batchTargetFolderId) {
        const { data: fRow } = await adminClient
          .schema('pipeline')
          .from('pipeline_folders')
          .select('id, name, batch_id, is_disposable_batch')
          .eq('id', batchTargetFolderId)
          .maybeSingle();
        if (!fRow) return permissiveJsonErr(404, 'Selected folder not found', req);
        if (fRow.batch_id && fRow.batch_id !== topBatchId) {
          return permissiveJsonErr(400, `Folder belongs to batch ${fRow.batch_id}, not ${topBatchId}`, req);
        }
        batchTargetFolderName = fRow.name;
        batchTargetIsDisposable = Boolean(fRow.is_disposable_batch);
      } else if (batchRow.disposable_folder_id) {
        batchTargetFolderId = batchRow.disposable_folder_id;
        batchTargetFolderName = topBatchId;
        batchTargetIsDisposable = true;
      } else {
        const { data: dispFolder } = await adminClient
          .schema('pipeline')
          .from('pipeline_folders')
          .select('id, name, is_disposable_batch')
          .eq('batch_id', topBatchId)
          .neq('cleanup_state', 'deleted')
          .maybeSingle();
        if (dispFolder) {
          batchTargetFolderId = dispFolder.id;
          batchTargetFolderName = dispFolder.name;
          batchTargetIsDisposable = Boolean(dispFolder.is_disposable_batch);
        }
      }
    } else if (batchTargetFolderId) {
      const { data: fRow, error: fErr } = await adminClient
        .schema('pipeline')
        .from('pipeline_folders')
        .select('id, name, batch_id, batch_uuid, is_disposable_batch, cleanup_state')
        .eq('id', batchTargetFolderId)
        .maybeSingle();

      if (fErr) return permissiveJsonErr(500, fErr.message, req);
      if (fRow && fRow.cleanup_state !== 'deleted') {
        batchTargetFolderId = fRow.id;
        batchTargetFolderName = fRow.name;
        batchTargetBatchId = fRow.batch_id || null;
        batchTargetBatchUuid = fRow.batch_uuid || null;
        batchTargetIsDisposable = Boolean(fRow.is_disposable_batch);
      } else {
        batchTargetFolderId = null;
      }
    }

    if (!batchTargetFolderId && rawTopFolderName) {
      const { data: existingFolder } = await adminClient
        .schema('pipeline')
        .from('pipeline_folders')
        .select('id, name, batch_id, batch_uuid, is_disposable_batch, cleanup_state')
        .ilike('name', rawTopFolderName)
        .neq('cleanup_state', 'deleted')
        .maybeSingle();

      if (existingFolder) {
        batchTargetFolderId = existingFolder.id;
        batchTargetFolderName = existingFolder.name;
        batchTargetBatchId = batchTargetBatchId || existingFolder.batch_id || null;
        batchTargetBatchUuid = batchTargetBatchUuid || existingFolder.batch_uuid || null;
        batchTargetIsDisposable = batchTargetIsDisposable || Boolean(existingFolder.is_disposable_batch);
      } else {
        const { data: createdF, error: createFErr } = await adminClient.rpc('pipeline_folder_create', {
          p_name: rawTopFolderName,
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
          batchTargetFolderId = cObj.id;
          batchTargetFolderName = cObj.name || rawTopFolderName;
        }
      }
    }

    // Fetch enabled prohibited rules & existing scoped listings ONCE
    let prohibitedRules: ProhibitedProfileRule[] = [];
    try {
      const { data: profRows } = await adminClient
        .from('prohibited_source_profiles')
        .select('id, canonical_name, aliases, zillow_profile_urls, match_mode, enabled')
        .eq('enabled', true);
      if (profRows) prohibitedRules = profRows as ProhibitedProfileRule[];
    } catch (e) {
      console.warn('[import_batch] prohibited_source_profiles read warning:', e);
    }

    const batchIds = Array.from(new Set(
      rawListings
        .map((item: any) => safeStr(item?.source_listing_id))
        .filter((v): v is string => Boolean(v))
    ));

    const existingMap = new Map<string, any>();
    if (batchIds.length > 0) {
      let existingQ = adminClient
        .schema('pipeline')
        .from('pipeline_properties')
        .select('id, source, source_listing_id, title, status, folder_id, folder_serial, batch_id, batch_uuid, choice_property_id, imported_at, field_provenance')
        .in('source_listing_id', batchIds);
      if (batchTargetBatchId) {
        existingQ = existingQ.eq('batch_id', batchTargetBatchId);
      } else if (batchTargetFolderId) {
        existingQ = existingQ.is('batch_id', null).eq('folder_id', batchTargetFolderId);
      } else {
        existingQ = existingQ.is('batch_id', null).is('folder_id', null);
      }
      const { data: existingBatchRows } = await existingQ.order('imported_at', { ascending: false });
      for (const row of existingBatchRows || []) {
        const key = `${row.source}|${row.source_listing_id}`;
        if (!existingMap.has(key)) existingMap.set(key, row);
      }
    }

    let maxSerial = 0;
    if (batchTargetFolderId) {
      const { data: maxSerialRow } = await adminClient
        .schema('pipeline')
        .from('pipeline_properties')
        .select('folder_serial')
        .eq('folder_id', batchTargetFolderId)
        .order('folder_serial', { ascending: false })
        .limit(1)
        .maybeSingle();
      maxSerial = maxSerialRow?.folder_serial || 0;
    }

    const results: Array<Record<string, unknown>> = new Array(rawListings.length);
    const pendingInserts: Array<{
      index: number;
      item: Record<string, unknown>;
      record: Record<string, unknown>;
      source: string;
      sourceListingId: string;
      incomingSaveNonce: string | null;
      photoCount: number;
    }> = [];
    const seenInPayload = new Set<string>();
    const geoapifyKey = Deno.env.get('GEOAPIFY_API_KEY') || null;
    const rawOrigin = String(req.headers.get('origin') || '');
    const defaultEnforceProhibited = body.enforce_prohibited_block === true;

    for (let i = 0; i < rawListings.length; i++) {
      const item = (rawListings[i] && typeof rawListings[i] === 'object')
        ? ({ ...(rawListings[i] as Record<string, unknown>) })
        : null;
      if (!item) {
        results[i] = { index: i, ok: false, error: 'Invalid listing payload object' };
        continue;
      }

      const sid = safeStr(item.source_listing_id);
      if (!sid) {
        results[i] = { index: i, ok: false, error: 'source_listing_id is required' };
        continue;
      }

      let itemSource = 'zillow';
      try {
        itemSource = normalizeSource(item.source);
      } catch (err) {
        results[i] = {
          index: i,
          source_listing_id: sid,
          ok: false,
          error: err instanceof Error ? err.message : 'Unsupported source',
        };
        continue;
      }

      const dedupKey = `${itemSource}|${sid}`;
      if (seenInPayload.has(dedupKey)) {
        results[i] = {
          index: i,
          source_listing_id: sid,
          ok: false,
          duplicate: true,
          message: 'Duplicate listing within batch payload',
        };
        continue;
      }
      seenInPayload.add(dedupKey);

      const reqProv = (item.field_provenance && typeof item.field_provenance === 'object')
        ? (item.field_provenance as Record<string, unknown>)
        : null;
      const saveNonce = safeStr(reqProv?.save_nonce);

      const existingRow = existingMap.get(dedupKey);
      if (existingRow) {
        const exProv = (existingRow.field_provenance && typeof existingRow.field_provenance === 'object')
          ? (existingRow.field_provenance as Record<string, unknown>)
          : null;
        const exNonce = safeStr(exProv?.save_nonce);

        if (saveNonce && exNonce && saveNonce === exNonce) {
          results[i] = {
            index: i,
            source_listing_id: sid,
            ok: true,
            deduped_retry: true,
            id: existingRow.id,
            title: String(existingRow.title || ''),
            status: existingRow.status,
            batch_id: existingRow.batch_id || null,
            folder: batchTargetFolderId ? {
              folder_id: existingRow.folder_id || batchTargetFolderId,
              name: batchTargetFolderName || 'Folder',
              batch_id: existingRow.batch_id || batchTargetBatchId || null,
              is_disposable_batch: batchTargetIsDisposable,
              serial: existingRow.folder_serial ?? null,
            } : null,
          };
          continue;
        }

        const dupStatus = existingRow.status ? String(existingRow.status) : 'scraped';
        results[i] = {
          index: i,
          source_listing_id: sid,
          ok: false,
          duplicate: true,
          id: existingRow.id,
          title: existingRow.title,
          status: dupStatus,
          batch_id: existingRow.batch_id || null,
          batch_uuid: existingRow.batch_uuid || null,
          folder: existingRow.folder_id ? {
            folder_id: existingRow.folder_id,
            name: batchTargetFolderName || 'Folder',
            batch_id: existingRow.batch_id || null,
            is_disposable_batch: batchTargetIsDisposable,
            serial: existingRow.folder_serial ?? null,
          } : null,
          message: batchTargetBatchId ? `Already in Batch #${batchTargetBatchId}` : 'Already in pipeline',
        };
        continue;
      }

      pendingInserts.push({
        index: i,
        item,
        record: {},
        source: itemSource,
        sourceListingId: sid,
        incomingSaveNonce: saveNonce,
        photoCount: 0,
      });
    }

    // Parallel Geoapify enrichment (runs whenever county OR neighborhood is missing and coordinates exist)
    if (geoapifyKey && pendingInserts.length > 0) {
      await Promise.all(pendingInserts.map(async (entry) => {
        const lat = safeFloat(entry.item.lat);
        const lng = safeFloat(entry.item.lng);
        const county = safeStr(entry.item.county);
        const neighborhood = safeStr(entry.item.neighborhood);
        if ((!county || !neighborhood) && lat != null && lng != null) {
          try {
            const gRes = await fetch(
              `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${geoapifyKey}`,
              { signal: AbortSignal.timeout(1500) }
            );
            if (gRes.ok) {
              const gJson = await gRes.json();
              const props = gJson?.features?.[0]?.properties;
              if (props) {
                if (!county && props.county) entry.item.county = props.county;
                if (!neighborhood && (props.suburb || props.neighbourhood || props.neighborhood || props.district || props.city_district)) {
                  entry.item.neighborhood = props.suburb || props.neighbourhood || props.neighborhood || props.district || props.city_district;
                }
              }
            }
          } catch (_) {}
        }
      }));
    }

    // Build canonical records & screen prohibited profiles
    const readyToInsert: typeof pendingInserts = [];
    for (const entry of pendingInserts) {
      const item = entry.item;
      const record = buildPipelineRecord(item as unknown as Parameters<typeof buildPipelineRecord>[0]);
      record.batch_id = batchTargetBatchId;
      record.batch_uuid = batchTargetBatchUuid;

      const rawImportMarker = String(item._import || body._import || '').toLowerCase();
      const inferredProviderKey = safeStr(item.provider_key) ||
        (rawImportMarker.includes('orion') || rawOrigin.startsWith('orion-extension://')
          ? 'browser_extension_orion'
          : 'browser_extension_chrome');

      const reqProv = (item.field_provenance && typeof item.field_provenance === 'object')
        ? (item.field_provenance as Record<string, unknown>)
        : {};
      const posterSignal = extractPosterProfileSignal(
        (item.source_raw_payload && typeof item.source_raw_payload === 'object' && !Array.isArray(item.source_raw_payload))
          ? { ...(item.source_raw_payload as Record<string, unknown>), agentName: item.agent_name, brokerName: item.broker_name }
          : { agentName: item.agent_name, brokerName: item.broker_name, ...reqProv },
      );
      const existingFp = (record.field_provenance && typeof record.field_provenance === 'object')
        ? (record.field_provenance as Record<string, unknown>)
        : {};
      record.field_provenance = {
        ...existingFp,
        source: entry.source,
        provider_key: existingFp.provider_key || inferredProviderKey,
        batch_id: batchTargetBatchId,
        poster_profile: existingFp.poster_profile || posterSignal,
      };

      const enforceProh = item.enforce_prohibited_block === true || defaultEnforceProhibited;
      if (prohibitedRules.length > 0) {
        const pMatch = matchProhibitedProfiles(
          {
            agent_name: record.agent_name,
            broker_name: record.broker_name,
            source_url: record.source_url,
            source_raw_payload: record.source_raw_payload,
            field_provenance: record.field_provenance,
          },
          prohibitedRules,
        );
        if (pMatch.matched) {
          (record.field_provenance as Record<string, unknown>).prohibited_match = pMatch;
          if (enforceProh) {
            results[entry.index] = {
              index: entry.index,
              source_listing_id: entry.sourceListingId,
              ok: false,
              prohibited: true,
              canonical_name: pMatch.canonical_name || null,
              matched_term: pMatch.matched_term || null,
              message: `Blocked: matches prohibited profile "${pMatch.canonical_name || pMatch.matched_term}"`,
            };
            continue;
          }
        }
      }

      const imgs = parseImageEntries(record.original_image_urls)
        .map(imageEntryUrl)
        .filter((u) => typeof u === 'string' && u.startsWith('http'));
      entry.photoCount = imgs.length;

      if (batchTargetFolderId) {
        maxSerial += 1;
        record.folder_id = batchTargetFolderId;
        record.folder_serial = maxSerial;
      }
      record.photo_import_status = 'completed';
      record.photo_upload_status = imgs.length > 0 ? 'complete' : 'none';
      record.last_photo_import_at = new Date().toISOString();
      record.last_photo_import_error = null;
      entry.record = record;
      readyToInsert.push(entry);
    }

    const batchFolderBase = batchTargetFolderId ? {
      folder_id: batchTargetFolderId,
      name: batchTargetFolderName || 'Folder',
      batch_id: batchTargetBatchId,
      batch_uuid: batchTargetBatchUuid,
      is_disposable_batch: batchTargetIsDisposable,
    } : null;

    if (readyToInsert.length > 0) {
      const insertRecords = readyToInsert.map((e) => e.record);
      const { error: bulkInsertErr } = await adminClient
        .schema('pipeline')
        .from('pipeline_properties')
        .insert(insertRecords);

      if (!bulkInsertErr) {
        for (const e of readyToInsert) {
          // Fire-and-forget raw payload data-lake archival
          try {
            const rawKeyPrefix = batchTargetBatchId ? `batches/${batchTargetBatchId}/` : '';
            const fileName = `${rawKeyPrefix}raw_${e.source}_${e.record.id || crypto.randomUUID()}_${new Date().toISOString()}.json`;
            void adminClient.storage
              .from('pipeline-raw-payloads')
              .upload(fileName, JSON.stringify(e.item), { contentType: 'application/json' });
          } catch (_) {}

          results[e.index] = {
            index: e.index,
            source_listing_id: e.sourceListingId,
            ok: true,
            id: e.record.id,
            title: String(e.record.title || ''),
            score: e.record.data_quality_score,
            photos: e.photoCount,
            city: safeStr(e.item.city),
            rent: safeInt(e.item.monthly_rent),
            batch_id: batchTargetBatchId,
            batch_uuid: batchTargetBatchUuid,
            folder: batchFolderBase ? { ...batchFolderBase, serial: e.record.folder_serial } : null,
          };
        }
      } else {
        // Fallback per-row insert so one race/constraint error never drops valid siblings in the batch
        for (const e of readyToInsert) {
          const { error: singleErr } = await adminClient
            .schema('pipeline')
            .from('pipeline_properties')
            .insert(e.record);
          if (!singleErr) {
            results[e.index] = {
              index: e.index,
              source_listing_id: e.sourceListingId,
              ok: true,
              id: e.record.id,
              title: String(e.record.title || ''),
              score: e.record.data_quality_score,
              photos: e.photoCount,
              city: safeStr(e.item.city),
              rent: safeInt(e.item.monthly_rent),
              batch_id: batchTargetBatchId,
              batch_uuid: batchTargetBatchUuid,
              folder: batchFolderBase ? { ...batchFolderBase, serial: e.record.folder_serial } : null,
            };
          } else if (singleErr.code === '23505') {
            results[e.index] = {
              index: e.index,
              source_listing_id: e.sourceListingId,
              ok: false,
              duplicate: true,
              title: String(e.record.title || ''),
              batch_id: batchTargetBatchId,
              message: batchTargetBatchId ? `Already in Batch #${batchTargetBatchId}` : 'Already in pipeline',
            };
          } else {
            results[e.index] = {
              index: e.index,
              source_listing_id: e.sourceListingId,
              ok: false,
              error: 'Database insert failed: ' + singleErr.message,
            };
          }
        }
      }
    }

    let savedCount = 0;
    let duplicateCount = 0;
    let prohibitedCount = 0;
    let failedCount = 0;
    for (const r of results) {
      if (!r) continue;
      if (r.ok) savedCount += 1;
      else if (r.duplicate) duplicateCount += 1;
      else if (r.prohibited) prohibitedCount += 1;
      else failedCount += 1;
    }

    return permissiveJsonOk({
      ok: true,
      total: results.length,
      saved: savedCount,
      duplicates: duplicateCount,
      prohibited: prohibitedCount,
      failed: failedCount,
      batch_id: batchTargetBatchId,
      batch_uuid: batchTargetBatchUuid,
      folder: batchFolderBase,
      results,
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

  // ── Step 2: Scoped Intra-Batch / Folder / Inbox Duplicate Check ──────────
  let dupQuery = adminClient
    .schema('pipeline')
    .from('pipeline_properties')
    .select('id, title, status, folder_id, folder_serial, batch_id, batch_uuid, choice_property_id, imported_at, field_provenance')
    .eq('source_listing_id', sourceListingId)
    .eq('source', source);

  if (targetBatchId) {
    dupQuery = dupQuery.eq('batch_id', targetBatchId);
  } else if (targetFolderId) {
    dupQuery = dupQuery.is('batch_id', null).eq('folder_id', targetFolderId);
  } else {
    dupQuery = dupQuery.is('batch_id', null).is('folder_id', null);
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

  if ((!county || !neighborhood) && lat != null && lng != null) {
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
            if (!county && props.county) body.county = props.county;
            if (!neighborhood && (props.suburb || props.neighbourhood || props.neighborhood || props.district || props.city_district)) {
              body.neighborhood = props.suburb || props.neighbourhood || props.neighborhood || props.district || props.city_district;
            }
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

  // Dual-channel provenance parity: normalize provider_key & poster_profile alongside Apify worker
  const rawImportMarker = String(body._import || '').toLowerCase();
  const inferredProviderKey = safeStr(body.provider_key) ||
    (rawImportMarker.includes('orion') || String(req.headers.get('origin') || '').startsWith('orion-extension://')
      ? 'browser_extension_orion'
      : 'browser_extension_chrome');
  const posterSignal = extractPosterProfileSignal(
    (body.source_raw_payload && typeof body.source_raw_payload === 'object' && !Array.isArray(body.source_raw_payload))
      ? { ...(body.source_raw_payload as Record<string, unknown>), agentName: body.agent_name, brokerName: body.broker_name }
      : { agentName: body.agent_name, brokerName: body.broker_name, ...(reqProvenance || {}) },
  );
  const existingFp = (record.field_provenance && typeof record.field_provenance === 'object')
    ? (record.field_provenance as Record<string, unknown>)
    : {};
  record.field_provenance = {
    ...existingFp,
    source,
    provider_key: existingFp.provider_key || inferredProviderKey,
    batch_id: targetBatchId,
    poster_profile: existingFp.poster_profile || posterSignal,
  };

  // Optional prohibited-profile pre-screen (runs fast against enabled rules)
  try {
    const { data: prohibitedRows } = await adminClient
      .from('prohibited_source_profiles')
      .select('id, canonical_name, aliases, zillow_profile_urls, match_mode, enabled')
      .eq('enabled', true);
    if (prohibitedRows && prohibitedRows.length > 0) {
      const pMatch = matchProhibitedProfiles(
        {
          agent_name: record.agent_name,
          broker_name: record.broker_name,
          source_url: record.source_url,
          source_raw_payload: record.source_raw_payload,
          field_provenance: record.field_provenance,
        },
        prohibitedRows as ProhibitedProfileRule[],
      );
      if (pMatch.matched) {
        (record.field_provenance as Record<string, unknown>).prohibited_match = pMatch;
        if (body.enforce_prohibited_block === true) {
          return permissiveJsonOk({
            ok: false,
            prohibited: true,
            canonical_name: pMatch.canonical_name || null,
            matched_term: pMatch.matched_term || null,
            matched_field: pMatch.matched_field || null,
            message: `Blocked: matches prohibited profile "${pMatch.canonical_name || pMatch.matched_term}"`,
          }, req);
        }
      }
    }
  } catch (prohErr) {
    console.warn('[receive-pipeline-import] Prohibited profile pre-screen error:', prohErr);
  }

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
      if (targetBatchId) {
        raceQuery = raceQuery.eq('batch_id', targetBatchId);
      } else if (targetFolderId) {
        raceQuery = raceQuery.is('batch_id', null).eq('folder_id', targetFolderId);
      } else {
        raceQuery = raceQuery.is('batch_id', null).is('folder_id', null);
      }
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
