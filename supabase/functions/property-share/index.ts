// ============================================================
// Choice Properties — property-share Edge Function
// Phase 8: Strictly client-safe field projection, batch-scoped
// published_rent / published_description overlays, strict CORS,
// and admin/service auth enforcement on both create and revoke.
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, corsResponse } from '../_shared/cors.ts';
import {
  type BatchOverlaySnapshot,
  CLIENT_SAFE_COLLECTION_SELECT,
  CLIENT_SAFE_PHOTO_SELECT,
  CLIENT_SAFE_PROPERTY_SELECT,
  mintShareToken,
  projectClientSafeProperty,
  sha256Hex,
} from '../_shared/batch-publishing.ts';

interface AdminAuthResult {
  ok: boolean;
  status: number;
  error?: string;
  userId?: string | null;
}

function jsonResp(data: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...buildCorsHeaders(origin),
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

async function verifyAdminOrService(
  req: Request,
  adminClient: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<AdminAuthResult> {
  const bearer = req.headers.get('authorization') || '';
  const match = bearer.match(/^Bearer\s+(.+)$/i);
  if (!match) return { ok: false, status: 401, error: 'admin_auth_required' };

  const token = match[1].trim();
  if (!token) return { ok: false, status: 401, error: 'admin_auth_required' };

  if (serviceKey && token === serviceKey) {
    return { ok: true, status: 200, userId: null };
  }

  const { data: authData, error: authErr } = await adminClient.auth.getUser(token);
  if (!authErr && authData?.user) {
    const { data: adminRole, error: roleErr } = await adminClient
      .from('admin_roles')
      .select('user_id')
      .eq('user_id', authData.user.id)
      .maybeSingle();

    if (roleErr) return { ok: false, status: 500, error: 'admin_check_failed' };
    if (!adminRole) return { ok: false, status: 403, error: 'admin_required' };
    return { ok: true, status: 200, userId: authData.user.id };
  }

  if (token.startsWith('eyJ')) {
    try {
      const checkRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: serviceKey,
        },
      });
      await checkRes.body?.cancel();
      if (checkRes.ok) {
        return { ok: true, status: 200, userId: null };
      }
    } catch {
      // Fall through to 401
    }
  }

  return { ok: false, status: 401, error: 'admin_auth_required' };
}

async function loadBatchOverlayMap(
  adminClient: ReturnType<typeof createClient>,
  shareId: string,
): Promise<Map<string, BatchOverlaySnapshot>> {
  const map = new Map<string, BatchOverlaySnapshot>();
  try {
    const { data: batchRow } = await adminClient
      .from('publishing_batches')
      .select('id')
      .eq('share_id', shareId)
      .order('completed_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (!batchRow?.id) return map;

    const { data: snapRows } = await adminClient
      .from('publishing_batch_properties')
      .select('property_id, published_rent, monthly_rent, published_description')
      .eq('batch_id', batchRow.id)
      .eq('published_status', 'published')
      .not('property_id', 'is', null);

    if (Array.isArray(snapRows)) {
      for (const row of snapRows) {
        if (row?.property_id) {
          map.set(String(row.property_id), row as BatchOverlaySnapshot);
        }
      }
    }
  } catch {
    // Non-fatal: canonical row values serve as fallback if batch overlay unavailable
  }
  return map;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') {
    return corsResponse(origin);
  }
  if (req.method !== 'POST') {
    return jsonResp({ error: 'method_not_allowed' }, 405, origin);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResp({ error: 'Missing environment variables' }, 500, origin);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return jsonResp({ error: 'invalid_json' }, 400, origin);
    }
    const action = typeof body.action === 'string' ? body.action.trim() : '';

    if (action === 'resolve') {
      const token = typeof body.token === 'string' ? body.token.trim() : '';
      if (!token) {
        return jsonResp({ error: 'Missing token' }, 400, origin);
      }

      const tokenHash = await sha256Hex(token);

      const { data: shareData, error: shareError } = await supabase
        .from('property_shares')
        .select('id, expires_at, revoked_at, view_count')
        .eq('token_hash', tokenHash)
        .is('revoked_at', null)
        .maybeSingle();

      if (shareError || !shareData) {
        return jsonResp({ error: 'share_not_found' }, 404, origin);
      }

      if (new Date(shareData.expires_at) < new Date()) {
        return jsonResp({ error: 'share_expired', expires_at: shareData.expires_at }, 410, origin);
      }

      if (body.track_view !== false) {
        void Promise.resolve(
          supabase
            .from('property_shares')
            .update({
              view_count: Number(shareData.view_count || 0) + 1,
              last_viewed_at: new Date().toISOString(),
            })
            .eq('id', shareData.id),
        ).catch(() => {});
      }

      const { data: linkData, error: linkError } = await supabase
        .from('property_share_properties')
        .select('property_id')
        .eq('share_id', shareData.id);

      if (linkError || !linkData || linkData.length === 0) {
        return jsonResp({ properties: [] }, 200, origin);
      }

      const propertyIds = Array.from(new Set(linkData.map((l) => String(l.property_id)).filter(Boolean)));
      const overlayMap = await loadBatchOverlayMap(supabase, shareData.id);

      const [{ data: properties, error: propError }, { data: photos }] = await Promise.all([
        supabase
          .from('properties')
          .select(CLIENT_SAFE_PROPERTY_SELECT)
          .in('id', propertyIds)
          .in('status', ['active', 'private_placement']),
        supabase
          .from('property_photos')
          .select(CLIENT_SAFE_PHOTO_SELECT)
          .in('property_id', propertyIds)
          .order('display_order', { ascending: true }),
      ]);

      if (propError) {
        return jsonResp({ error: propError.message }, 500, origin);
      }

      const photoMap: Record<string, Array<Record<string, unknown>>> = {};
      if (Array.isArray(photos)) {
        for (const ph of photos) {
          const pid = String(ph.property_id || '');
          if (!pid) continue;
          if (!photoMap[pid]) photoMap[pid] = [];
          photoMap[pid].push(ph as Record<string, unknown>);
        }
      }

      const enriched = (properties || []).map((prop) => {
        const rec = prop as Record<string, unknown>;
        const pid = String(rec.id);
        return projectClientSafeProperty(rec, overlayMap.get(pid) || null, photoMap[pid] || []);
      });

      return jsonResp({ properties: enriched }, 200, origin);
    }

    if (action === 'resolve_property' || action === 'resolve_single') {
      const propertyId = body.property_id || body.id;
      if (!propertyId) {
        return jsonResp({ error: 'Missing property_id' }, 400, origin);
      }

      const cleanPropId = String(propertyId).toLowerCase().trim();

      const { data: property, error: propError } = await supabase
        .from('properties')
        .select(CLIENT_SAFE_PROPERTY_SELECT)
        .eq('id', cleanPropId)
        .in('status', ['active', 'private_placement'])
        .maybeSingle();

      if (propError || !property) {
        return jsonResp({ error: 'property_not_found' }, 404, origin);
      }

      const { data: photos } = await supabase
        .from('property_photos')
        .select(CLIENT_SAFE_PHOTO_SELECT)
        .eq('property_id', property.id)
        .order('display_order', { ascending: true });

      let overlayMap = new Map<string, BatchOverlaySnapshot>();
      let collection: Array<Record<string, unknown>> = [];

      const rawToken = typeof body.token === 'string' ? body.token.trim() : '';
      if (rawToken) {
        try {
          const tokenHash = await sha256Hex(rawToken);
          const { data: shareData } = await supabase
            .from('property_shares')
            .select('id, expires_at')
            .eq('token_hash', tokenHash)
            .is('revoked_at', null)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle();

          if (shareData) {
            overlayMap = await loadBatchOverlayMap(supabase, shareData.id);
            const { data: linkData } = await supabase
              .from('property_share_properties')
              .select('property_id')
              .eq('share_id', shareData.id);

            if (linkData && linkData.length > 0) {
              const otherIds = Array.from(
                new Set(linkData.map((l) => String(l.property_id)).filter((id) => id && id !== property.id)),
              );
              if (otherIds.length > 0) {
                const [{ data: otherProps }, { data: otherPhotos }] = await Promise.all([
                  supabase
                    .from('properties')
                    .select(CLIENT_SAFE_COLLECTION_SELECT)
                    .in('id', otherIds)
                    .in('status', ['active', 'private_placement']),
                  supabase
                    .from('property_photos')
                    .select(CLIENT_SAFE_PHOTO_SELECT)
                    .in('property_id', otherIds)
                    .order('display_order', { ascending: true }),
                ]);

                const otherPhotoMap: Record<string, Array<Record<string, unknown>>> = {};
                if (Array.isArray(otherPhotos)) {
                  for (const ph of otherPhotos) {
                    const pid = String(ph.property_id || '');
                    if (!pid) continue;
                    if (!otherPhotoMap[pid]) otherPhotoMap[pid] = [];
                    otherPhotoMap[pid].push(ph as Record<string, unknown>);
                  }
                }

                collection = (otherProps || []).map((p) => {
                  const rec = p as Record<string, unknown>;
                  const pid = String(rec.id);
                  return projectClientSafeProperty(rec, overlayMap.get(pid) || null, otherPhotoMap[pid] || []);
                });
              }
            }
          }
        } catch {
          // Non-fatal
        }
      }

      const safeProperty = projectClientSafeProperty(
        property as Record<string, unknown>,
        overlayMap.get(String(property.id)) || null,
        photos || [],
      );

      return jsonResp({ property: safeProperty, collection }, 200, origin);
    }

    if (action === 'create') {
      const auth = await verifyAdminOrService(req, supabase, supabaseUrl, serviceRoleKey);
      if (!auth.ok) {
        return jsonResp({ error: auth.error }, auth.status, origin);
      }

      const propertyIds = body.property_ids;
      if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
        return jsonResp({ error: 'Missing property_ids' }, 400, origin);
      }

      const cleanIds = Array.from(new Set(propertyIds.map((p) => String(p).trim()).filter(Boolean)));
      if (cleanIds.length === 0) {
        return jsonResp({ error: 'Missing property_ids' }, 400, origin);
      }

      const ttlDays = Math.min(Math.max(Math.round(Number(body.ttl_days) || 90), 1), 365);
      const { rawToken, tokenHash } = await mintShareToken();
      const shareId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
      const shareAlias = typeof body.share_alias === 'string' && body.share_alias.trim()
        ? body.share_alias.trim().slice(0, 80)
        : null;

      const { error: shareInsertErr } = await supabase.from('property_shares').insert({
        id: shareId,
        token_hash: tokenHash,
        created_by: auth.userId || null,
        expires_at: expiresAt,
        ...(shareAlias ? { share_alias: shareAlias } : {}),
      });
      if (shareInsertErr) {
        return jsonResp({ error: shareInsertErr.message }, 500, origin);
      }

      const shareLinks = cleanIds.map((pId) => ({
        share_id: shareId,
        property_id: pId,
      }));
      const { error: linksErr } = await supabase.from('property_share_properties').insert(shareLinks);
      if (linksErr) {
        await supabase.from('property_shares').delete().eq('id', shareId);
        return jsonResp({ error: linksErr.message }, 500, origin);
      }

      return jsonResp({ token: rawToken, share_id: shareId, expires_at: expiresAt }, 200, origin);
    }

    if (action === 'revoke') {
      const auth = await verifyAdminOrService(req, supabase, supabaseUrl, serviceRoleKey);
      if (!auth.ok) {
        return jsonResp({ error: auth.error }, auth.status, origin);
      }

      const token = typeof body.token === 'string' ? body.token.trim() : '';
      if (!token) {
        return jsonResp({ error: 'Missing token' }, 400, origin);
      }

      const tokenHash = await sha256Hex(token);
      const { data: shareData } = await supabase
        .from('property_shares')
        .select('id')
        .eq('token_hash', tokenHash)
        .maybeSingle();

      if (shareData) {
        await supabase.from('property_share_properties').delete().eq('share_id', shareData.id);
        await supabase.from('property_shares').delete().eq('id', shareData.id);
      }

      return jsonResp({ revoked: true }, 200, origin);
    }

    return jsonResp({ error: 'Invalid action' }, 400, origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResp({ error: message }, 500, origin);
  }
});
