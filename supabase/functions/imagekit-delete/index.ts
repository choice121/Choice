// ============================================================
// Choice Properties — ImageKit Delete Edge Function
// Supabase → Functions → imagekit-delete
//
// Required secrets (same as imagekit-upload):
//   IMAGEKIT_PRIVATE_KEY  →  your ImageKit private key
//
// Phase 3b update (2026-04-22):
//   • Ownership check now consults the new `property_photos` table
//     first via the SECURITY INVOKER RPC `delete_property_photo_by_file_id`.
//     Falls back to the legacy `properties.photo_file_ids` array
//     check during the transition window.
//   • The DB row is removed inside the RPC before the CDN call so
//     the property_photos table stays consistent even if the CDN
//     delete is retried.
//
// Deletion remains best-effort: a CDN failure does NOT block the UI.
// ============================================================

import { corsResponse } from '../_shared/cors.ts';
import { requireAuth }  from '../_shared/auth.ts';
import { jsonResponse } from '../_shared/utils.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  // ── Auth check ────────────────────────────────────────────
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth;
  // ── End auth check ────────────────────────────────────────

  try {
    const IMAGEKIT_PRIVATE_KEY = Deno.env.get('IMAGEKIT_PRIVATE_KEY');
    if (!IMAGEKIT_PRIVATE_KEY) {
      return jsonResponse({ success: false, error: 'ImageKit not configured' }, 500);
    }

    const { fileId } = await req.json();
    if (!fileId || typeof fileId !== 'string') {
      return jsonResponse({ success: false, error: 'fileId is required' }, 400);
    }

    // ── Ownership + DB row removal via RPC (Phase 3b) ─────────
    // The RPC raises if the caller doesn't own the parent property.
    // It returns true if a row was deleted, false if it didn't exist.
    const { data: rpcDeleted, error: rpcErr } = await supabase.rpc(
      'delete_property_photo_by_file_id',
      { p_file_id: fileId }
    );

    let isOwner = rpcDeleted === true;

    if (rpcErr) {
      // RPC raised "Forbidden" or doesn't exist yet — fall back to the
      // legacy ownership check against the array column.
      const { data: adminRow } = await supabase
        .from('admin_roles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      const isAdmin = !!adminRow;

      if (!isAdmin) {
        const { data: owned, error: ownerErr } = await supabase
          .from('properties')
          .select('id')
          .eq('landlord_id', user.id)
          .filter('photo_file_ids', 'cs', JSON.stringify([fileId]))
          .maybeSingle();

        if (ownerErr || !owned) {
          return jsonResponse({ success: false, error: 'Forbidden' }, 403);
        }
      }
      isOwner = true;
    }

    // If the RPC returned false (no row found) AND the legacy check
    // also returned no match, treat as forbidden to prevent enumeration.
    if (!isOwner) {
      const { data: adminRow } = await supabase
        .from('admin_roles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!adminRow) {
        const { data: legacyOwned } = await supabase
          .from('properties')
          .select('id')
          .eq('landlord_id', user.id)
          .filter('photo_file_ids', 'cs', JSON.stringify([fileId]))
          .maybeSingle();
        if (!legacyOwned) {
          return jsonResponse({ success: false, error: 'Forbidden' }, 403);
        }
      }
    }
    // ── End ownership check ───────────────────────────────────

    const credentials = btoa(`${IMAGEKIT_PRIVATE_KEY}:`);
    const ikRes = await fetch(
      `https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`,
      { method: 'DELETE', headers: { Authorization: `Basic ${credentials}` } }
    );

    // 204 = success, 404 = already gone — both are acceptable (idempotent).
    if (!ikRes.ok && ikRes.status !== 404) {
      const errText = await ikRes.text().catch(() => `HTTP ${ikRes.status}`);
      return jsonResponse({ success: false, error: `ImageKit error: ${errText}` }, 502);
    }

    return jsonResponse({ success: true });
  } catch (err: any) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
});
