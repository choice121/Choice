// ─────────────────────────────────────────────────────────────────────
// record-inspection — Phase 08 chunk 2/N
//
// POST endpoint that persists a move-in / mid-term / move-out condition
// report and renders a versioned PDF.
//
// Caller may be:
//   • a tenant (must own the application by email match)
//   • a landlord (must own the property referenced by the app)
//   • an admin
//
// Request body:
//   {
//     app_id:               UUID,                 // required
//     inspection_type:      'move_in' | 'mid_term' | 'move_out',
//     scheduled_for?:       ISO timestamp,
//     completed_at?:        ISO timestamp,        // defaults to now() server-side
//     completed_by_role?:   'tenant' | 'landlord' | 'joint',
//     rooms:                { [room_key]: { items: [...] } },
//     notes?:               string,
//     tenant_sig_image?:    data: URL (PNG / JPEG),
//     landlord_sig_image?:  data: URL,
//     photos:               [
//       { storage_path, room_key, item_key?, caption?, taken_at_exif?,
//         byte_size?, width?, height? }
//     ]
//   }
//
// On success returns:
//   {
//     success: true,
//     inspection_id, pdf_storage_path, pdf_sha256,
//     pdf_version_number, page_count, photos_embedded, photos_failed
//   }
//
// Photos must already be uploaded by the client into the
// lease-inspection-photos bucket under the path
// "<app_id>/<inspection_id_or_temp>/...".  This endpoint does not
// stream binary data; it only records the metadata + renders the PDF.
// ─────────────────────────────────────────────────────────────────────

import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
import {
  buildInspectionPDF,
  type InspectionType,
  type InspectionRecord,
} from '../_shared/inspection-pdf.ts';

const PHOTO_BUCKET     = 'lease-inspection-photos';
const PDF_BUCKET       = 'lease-pdfs';
const VALID_TYPES: InspectionType[]                = ['move_in', 'mid_term', 'move_out'];
const VALID_ROLES                                  = ['tenant', 'landlord', 'joint'];
const VALID_CONDITIONS                             = ['good', 'fair', 'poor', 'damaged'];
const MAX_ROOMS                                    = 40;
const MAX_ITEMS_PER_ROOM                           = 50;
const MAX_PHOTOS_PER_INSPECTION                    = 200;
const SHA256_RE                                    = /^[0-9a-f]{64}$/;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// ── Helpers ───────────────────────────────────────────────────────────

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

interface AuthContext {
  user_id:   string;
  email:     string;
  is_admin:  boolean;
}

async function authenticate(req: Request): Promise<{ ok: true; ctx: AuthContext } | { ok: false; status: number; msg: string }> {
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!token) return { ok: false, status: 401, msg: 'Missing authorization header' };

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { ok: false, status: 401, msg: 'Invalid or expired session' };

  const { data: adminRow } = await supabase.from('admin_roles')
    .select('id').eq('user_id', user.id).maybeSingle();

  return {
    ok: true,
    ctx: { user_id: user.id, email: (user.email || '').toLowerCase(), is_admin: !!adminRow },
  };
}

interface AccessCheck { allowed: boolean; role: 'tenant' | 'landlord' | 'admin' | null; }

async function checkAppAccess(appId: string, ctx: AuthContext): Promise<AccessCheck> {
  if (ctx.is_admin) return { allowed: true, role: 'admin' };

  const { data: app } = await supabase.from('applications')
    .select('id, email, property_id')
    .eq('id', appId).maybeSingle();
  if (!app) return { allowed: false, role: null };

  if ((app.email || '').toLowerCase() === ctx.email) {
    return { allowed: true, role: 'tenant' };
  }

  // Landlord: properties.landlord_id = ctx.user_id
  if (app.property_id) {
    const { data: prop } = await supabase.from('properties')
      .select('landlord_id').eq('id', app.property_id).maybeSingle();
    if (prop && prop.landlord_id === ctx.user_id) {
      return { allowed: true, role: 'landlord' };
    }
  }

  return { allowed: false, role: null };
}

function validateRooms(rooms: unknown): string | null {
  if (!rooms || typeof rooms !== 'object' || Array.isArray(rooms)) {
    return 'rooms must be a JSON object keyed by room name';
  }
  const keys = Object.keys(rooms as Record<string, unknown>);
  if (keys.length === 0)        return 'rooms must contain at least one entry';
  if (keys.length > MAX_ROOMS)  return `rooms exceeds ${MAX_ROOMS} entries`;
  for (const k of keys) {
    if (!/^[a-z0-9_]{1,40}$/.test(k)) return `invalid room key "${k}" (lowercase, digits, underscore only)`;
    const room = (rooms as Record<string, { items?: unknown }>)[k];
    if (!room || typeof room !== 'object') return `room "${k}" must be an object`;
    const items = room.items;
    if (items !== undefined) {
      if (!Array.isArray(items)) return `room "${k}".items must be an array`;
      if (items.length > MAX_ITEMS_PER_ROOM) return `room "${k}".items exceeds ${MAX_ITEMS_PER_ROOM}`;
      for (const it of items as Array<Record<string, unknown>>) {
        if (!it || typeof it !== 'object') return `each item in "${k}" must be an object`;
        if (typeof it.name !== 'string' || !it.name.trim()) return `item.name is required in "${k}"`;
        if (it.condition !== undefined && it.condition !== null) {
          if (typeof it.condition !== 'string' || !VALID_CONDITIONS.includes(it.condition)) {
            return `invalid item.condition in "${k}" (must be one of: ${VALID_CONDITIONS.join(', ')})`;
          }
        }
        if (it.photo_paths !== undefined) {
          if (!Array.isArray(it.photo_paths)) return `item.photo_paths must be an array in "${k}"`;
          for (const p of it.photo_paths as unknown[]) {
            if (typeof p !== 'string') return `item.photo_paths entries must be strings in "${k}"`;
          }
        }
      }
    }
  }
  return null;
}

function isValidPhotoPath(path: string, appId: string): boolean {
  // Path must begin with the app_id segment so it matches the bucket RLS policy.
  if (typeof path !== 'string' || path.length === 0 || path.length > 500) return false;
  if (path.startsWith('/') || path.includes('..') || path.includes('//')) return false;
  return path.split('/')[0] === appId;
}

// ── Handler ───────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return jsonErr(405, 'Method not allowed', req);

  // 1. Auth
  const auth = await authenticate(req);
  if (!auth.ok) return jsonErr(auth.status, auth.msg, req);

  // 2. Parse body
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return jsonErr(400, 'Invalid JSON body', req); }

  const app_id = body.app_id as string | undefined;
  const inspection_type = body.inspection_type as InspectionType | undefined;
  const rooms = body.rooms;
  if (!app_id) return jsonErr(400, 'Missing app_id', req);
  if (!inspection_type || !VALID_TYPES.includes(inspection_type)) {
    return jsonErr(400, `inspection_type must be one of: ${VALID_TYPES.join(', ')}`, req);
  }
  const roomsErr = validateRooms(rooms);
  if (roomsErr) return jsonErr(400, roomsErr, req);

  if (body.completed_by_role !== undefined && body.completed_by_role !== null) {
    if (typeof body.completed_by_role !== 'string' || !VALID_ROLES.includes(body.completed_by_role)) {
      return jsonErr(400, `completed_by_role must be one of: ${VALID_ROLES.join(', ')}`, req);
    }
  }

  // 3. Access control
  const access = await checkAppAccess(app_id, auth.ctx);
  if (!access.allowed) return jsonErr(403, 'You do not have access to this application', req);

  // 4. Validate photo metadata array (optional)
  const photosInput = Array.isArray(body.photos) ? body.photos as Array<Record<string, unknown>> : [];
  if (photosInput.length > MAX_PHOTOS_PER_INSPECTION) {
    return jsonErr(400, `photos exceeds ${MAX_PHOTOS_PER_INSPECTION} entries`, req);
  }
  for (const p of photosInput) {
    if (typeof p.storage_path !== 'string' || !isValidPhotoPath(p.storage_path, app_id)) {
      return jsonErr(400, `photo.storage_path must start with "${app_id}/" and be ≤500 chars`, req);
    }
    if (typeof p.room_key !== 'string' || !/^[a-z0-9_]{1,40}$/.test(p.room_key)) {
      return jsonErr(400, 'photo.room_key required (lowercase, digits, underscore)', req);
    }
  }

  // 5. Fetch the application (we need it for the PDF cover page).
  const { data: app, error: appErr } = await supabase.from('applications')
    .select('id, app_id, property_address, first_name, last_name, email, lease_landlord_name, lease_landlord_address')
    .eq('id', app_id).maybeSingle();
  if (appErr || !app) return jsonErr(404, 'Application not found', req);

  // 6. Insert / upsert the lease_inspections row. We use upsert-by-(app_id,
  //    inspection_type) semantics: if a row for this app + type already
  //    exists, we update it in place so re-submitting overwrites.
  const nowIso = new Date().toISOString();
  const inspectionPayload: Record<string, unknown> = {
    app_id,
    inspection_type,
    scheduled_for:      body.scheduled_for      ?? null,
    completed_at:       body.completed_at       ?? nowIso,
    completed_by_role:  body.completed_by_role  ?? access.role,
    tenant_signed_at:   access.role === 'tenant'   ? nowIso : (body.tenant_signed_at   as string | null | undefined) ?? null,
    landlord_signed_at: access.role === 'landlord' || access.role === 'admin' ? nowIso : (body.landlord_signed_at as string | null | undefined) ?? null,
    tenant_sig_image:   (body.tenant_sig_image   as string | null | undefined) ?? null,
    landlord_sig_image: (body.landlord_sig_image as string | null | undefined) ?? null,
    rooms,
    notes:              (body.notes              as string | null | undefined) ?? null,
  };

  // Look for existing row to preserve id (and any sigs already captured).
  const { data: existing } = await supabase.from('lease_inspections')
    .select('id, tenant_signed_at, landlord_signed_at, tenant_sig_image, landlord_sig_image')
    .eq('app_id', app_id).eq('inspection_type', inspection_type).maybeSingle();

  let inspectionId: string;
  if (existing) {
    // Don't clobber a counter-signature already on file with NULL.
    inspectionPayload.tenant_signed_at   = inspectionPayload.tenant_signed_at   ?? existing.tenant_signed_at;
    inspectionPayload.landlord_signed_at = inspectionPayload.landlord_signed_at ?? existing.landlord_signed_at;
    inspectionPayload.tenant_sig_image   = inspectionPayload.tenant_sig_image   ?? existing.tenant_sig_image;
    inspectionPayload.landlord_sig_image = inspectionPayload.landlord_sig_image ?? existing.landlord_sig_image;
    const { error: updErr } = await supabase.from('lease_inspections')
      .update(inspectionPayload).eq('id', existing.id);
    if (updErr) return jsonErr(500, 'Failed to update inspection: ' + updErr.message, req);
    inspectionId = existing.id;
  } else {
    const { data: ins, error: insErr } = await supabase.from('lease_inspections')
      .insert(inspectionPayload).select('id').single();
    if (insErr || !ins) return jsonErr(500, 'Failed to insert inspection: ' + (insErr?.message || ''), req);
    inspectionId = ins.id;
  }

  // 7. Replace photo rows for this inspection (idempotent re-submit).
  if (existing) {
    await supabase.from('lease_inspection_photos').delete().eq('inspection_id', inspectionId);
  }
  if (photosInput.length > 0) {
    const photoRows = photosInput.map(p => ({
      inspection_id:  inspectionId,
      app_id,
      storage_path:   p.storage_path as string,
      room_key:       p.room_key as string,
      item_key:       (p.item_key       as string | null | undefined) ?? null,
      caption:        (p.caption        as string | null | undefined) ?? null,
      taken_at_exif:  (p.taken_at_exif  as string | null | undefined) ?? null,
      uploaded_by:    access.role === 'admin' ? 'admin' : access.role,
      byte_size:      typeof p.byte_size === 'number' ? p.byte_size : null,
      width:          typeof p.width     === 'number' ? p.width     : null,
      height:         typeof p.height    === 'number' ? p.height    : null,
    }));
    const { error: phErr } = await supabase.from('lease_inspection_photos').insert(photoRows);
    if (phErr) return jsonErr(500, 'Failed to record photos: ' + phErr.message, req);
  }

  // 8. Build the PDF.
  const inspectionForPdf: InspectionRecord = {
    id:                 inspectionId,
    app_id,
    inspection_type,
    scheduled_for:      inspectionPayload.scheduled_for      as string | null,
    completed_at:       inspectionPayload.completed_at       as string | null,
    completed_by_role:  inspectionPayload.completed_by_role  as string | null,
    tenant_signed_at:   inspectionPayload.tenant_signed_at   as string | null,
    landlord_signed_at: inspectionPayload.landlord_signed_at as string | null,
    tenant_sig_image:   inspectionPayload.tenant_sig_image   as string | null,
    landlord_sig_image: inspectionPayload.landlord_sig_image as string | null,
    rooms:              rooms as Record<string, { items?: Array<Record<string, unknown>> }>,
    notes:              inspectionPayload.notes              as string | null,
    photos_count:       photosInput.length,
  };

  let pdfResult;
  try {
    pdfResult = await buildInspectionPDF({
      inspection: inspectionForPdf,
      app: {
        app_id:                 app.app_id || app_id,
        property_address:       app.property_address ?? null,
        first_name:             app.first_name ?? null,
        last_name:              app.last_name ?? null,
        email:                  app.email ?? null,
        lease_landlord_name:    app.lease_landlord_name ?? null,
        lease_landlord_address: app.lease_landlord_address ?? null,
      },
      storage: supabase.storage,
    });
  } catch (e) {
    return jsonErr(500, 'PDF render failed: ' + (e as Error).message, req);
  }

  const sha256 = await sha256Hex(pdfResult.bytes);
  if (!SHA256_RE.test(sha256)) {
    return jsonErr(500, 'PDF hash format invalid', req);
  }

  // 9. Upload to lease-pdfs bucket.
  const ts             = Date.now();
  const pdfStoragePath = `${app_id}/inspection_${inspection_type}_${inspectionId}_${ts}.pdf`;
  const { error: upErr } = await supabase.storage.from(PDF_BUCKET)
    .upload(pdfStoragePath, pdfResult.bytes, {
      contentType: 'application/pdf', upsert: true,
    });
  if (upErr) return jsonErr(500, 'PDF upload failed: ' + upErr.message, req);

  // 10. Update the inspection row with PDF metadata.
  const { error: updPdfErr } = await supabase.from('lease_inspections')
    .update({ pdf_storage_path: pdfStoragePath, pdf_sha256: sha256 })
    .eq('id', inspectionId);
  if (updPdfErr) return jsonErr(500, 'Failed to record PDF metadata: ' + updPdfErr.message, req);

  // 11. Mirror into lease_pdf_versions (best-effort) so the existing
  //     download / integrity pipeline picks it up uniformly.
  let pdfVersionNumber: number | null = null;
  try {
    // Compute next version_number per app_id locally; the table's events
    // for this app are already serialized by the lease pipeline so we
    // don't need RPC indirection for inspection rows.
    const { data: maxRow } = await supabase.from('lease_pdf_versions')
      .select('version_number').eq('app_id', app.app_id || app_id)
      .order('version_number', { ascending: false }).limit(1).maybeSingle();
    pdfVersionNumber = ((maxRow?.version_number as number | undefined) || 0) + 1;

    const eventName =
      inspection_type === 'move_in'  ? 'inspection_movein' :
      inspection_type === 'move_out' ? 'inspection_moveout' :
                                       'inspection_midterm';

    await supabase.from('lease_pdf_versions').insert({
      app_id:                 app.app_id || app_id,
      version_number:         pdfVersionNumber,
      event:                  eventName,
      storage_path:           pdfStoragePath,
      size_bytes:             pdfResult.bytes.length,
      created_by:             auth.ctx.email || null,
      sha256,
      certificate_appended:   false,
    });
  } catch (e) {
    // Non-fatal: lease_inspections already has the authoritative pointer.
    console.error('lease_pdf_versions mirror failed (non-fatal):', (e as Error).message);
    pdfVersionNumber = null;
  }

  // 12. Audit log.
  try {
    await supabase.from('admin_actions').insert({
      action:      'record_inspection',
      target_type: 'application',
      target_id:   app.app_id || app_id,
      metadata: {
        app_id,
        actor:            auth.ctx.email,
        actor_role:       access.role,
        inspection_id:    inspectionId,
        inspection_type,
        page_count:       pdfResult.page_count,
        photos_embedded:  pdfResult.photos_embedded,
        photos_failed:    pdfResult.photos_failed,
        pdf_storage_path: pdfStoragePath,
        pdf_sha256:       sha256,
      },
    });
  } catch (_) { /* non-fatal */ }

  return jsonOk({
    success:            true,
    inspection_id:      inspectionId,
    pdf_storage_path:   pdfStoragePath,
    pdf_sha256:         sha256,
    pdf_version_number: pdfVersionNumber,
    page_count:         pdfResult.page_count,
    photos_embedded:    pdfResult.photos_embedded,
    photos_failed:      pdfResult.photos_failed,
    photos_count:       photosInput.length,
  }, req);
});
