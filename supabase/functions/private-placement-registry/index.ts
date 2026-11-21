// ============================================================
// Choice Properties — private-placement-registry Edge Function
// Phase 3: Permanent Private-Placement Registry & Batch Link Retrieval
// - Read actions (`get_batch`, `list_registry`) return exact stored
//   `magic_link_url` & real-time share status (`active`, `expired`,
//   `revoked`, `not_generated`) independently of pipeline folder deletion
//   and NEVER mutate or mint tokens on read.
// - `replace_expired_link` requires explicit admin auth + explicit reason,
//   marks prior share revoked/superseded, binds linked properties to a new
//   cryptographic share token, and records an admin_actions audit log.
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, corsResponse } from '../_shared/cors.ts';

const PUBLIC_SITE_BASE = 'https://choice-properties-site.pages.dev';

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

async function verifyAdmin(
  req: Request,
  adminClient: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
): Promise<AdminAuthResult> {
  const authHeader = req.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return { ok: false, status: 401, error: 'admin_auth_required' };

  const token = match[1].trim();
  if (!token) return { ok: false, status: 401, error: 'admin_auth_required' };

  if (serviceKey && token === serviceKey) {
    return { ok: true, status: 200, userId: null };
  }

  const { data: userData, error: authErr } = await adminClient.auth.getUser(token);
  if (!authErr && userData?.user) {
    const { data: adminRow, error: roleErr } = await adminClient
      .from('admin_roles')
      .select('user_id')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (roleErr) return { ok: false, status: 500, error: 'admin_check_failed' };
    if (!adminRow) return { ok: false, status: 403, error: 'admin_required' };
    return { ok: true, status: 200, userId: userData.user.id };
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

  return { ok: false, status: 401, error: 'invalid_session' };
}

async function mintShareToken(): Promise<{ rawToken: string; tokenHash: string }> {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const rawToken = btoa(String.fromCharCode(...randomBytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const encoded = new TextEncoder().encode(rawToken);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  const tokenHash = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return { rawToken, tokenHash };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return corsResponse(origin);
  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonResp({ ok: false, error: 'method_not_allowed' }, 405, origin);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !serviceKey) {
    return jsonResp({ ok: false, error: 'missing_supabase_config' }, 503, origin);
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const auth = await verifyAdmin(req, adminClient, supabaseUrl, serviceKey);
  if (!auth.ok) return jsonResp({ ok: false, error: auth.error }, auth.status, origin);

  let body: Record<string, unknown> = {};
  if (req.method === 'POST') {
    try {
      body = await req.json();
    } catch {
      return jsonResp({ ok: false, error: 'invalid_json' }, 400, origin);
    }
  } else {
    const url = new URL(req.url);
    body = {
      action: url.searchParams.get('action') || (url.searchParams.get('batch_id') ? 'get_batch' : 'list_registry'),
      batch_id: url.searchParams.get('batch_id') || '',
      share_status: url.searchParams.get('share_status') || '',
      batch_format: url.searchParams.get('batch_format') || '',
      search: url.searchParams.get('search') || '',
      limit: url.searchParams.get('limit') || undefined,
    };
  }

  const action = String(body.action || '').trim();

  // ── 1. Read-Only Exact Batch Retrieval ("Give me batch 4821") ────────────
  if (action === 'get_batch') {
    const rawBatchId = typeof body.batch_id === 'string' ? body.batch_id.trim() : '';
    if (!rawBatchId) {
      return jsonResp({ ok: false, error: 'batch_id_required' }, 400, origin);
    }

    const { data, error } = await adminClient.rpc('registry_get_batch', {
      p_batch_id: rawBatchId,
    });
    if (error) return jsonResp({ ok: false, error: error.message }, 500, origin);

    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    if (!parsed?.ok) {
      return jsonResp(parsed || { ok: false, error: 'lookup_failed' }, 400, origin);
    }
    if (!parsed.found) {
      return jsonResp({ ...parsed, error: 'batch_not_found' }, 404, origin);
    }
    return jsonResp(parsed, 200, origin);
  }

  // ── 2. Read-Only Registry Listing ────────────────────────────────────────
  if (action === 'list_registry' || action === 'list') {
    const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 200);
    const shareStatus = typeof body.share_status === 'string' && body.share_status.trim()
      ? body.share_status.trim()
      : (typeof body.status === 'string' && body.status.trim() ? body.status.trim() : null);
    const batchFormat = typeof body.batch_format === 'string' && body.batch_format.trim()
      ? body.batch_format.trim()
      : null;
    const search = typeof body.search === 'string' && body.search.trim()
      ? body.search.trim()
      : null;

    const { data, error } = await adminClient.rpc('registry_list_batches', {
      p_limit: limit,
      p_share_status: shareStatus,
      p_batch_format: batchFormat,
      p_search: search,
    });
    if (error) return jsonResp({ ok: false, error: error.message }, 500, origin);

    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return jsonResp(parsed, parsed?.ok ? 200 : 400, origin);
  }

  // ── 3. Explicit Admin-Authorized Expired Link Replacement (POST only) ──────
  if (action === 'replace_expired_link') {
    if (req.method !== 'POST') {
      return jsonResp({ ok: false, error: 'post_required_for_mutation' }, 405, origin);
    }

    const rawBatchId = typeof body.batch_id === 'string' ? body.batch_id.trim() : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    const force = body.force === true;
    const ttlDays = Math.min(Math.max(Math.round(Number(body.ttl_days) || 90), 1), 365);

    if (!rawBatchId) {
      return jsonResp({ ok: false, error: 'batch_id_required' }, 400, origin);
    }
    if (reason.length < 3) {
      return jsonResp({
        ok: false,
        error: 'replacement_reason_required',
        message: 'An explicit replacement reason (minimum 3 characters) is required.',
      }, 400, origin);
    }

    const { data: lookupData, error: lookupErr } = await adminClient.rpc('registry_get_batch', {
      p_batch_id: rawBatchId,
    });
    if (lookupErr) return jsonResp({ ok: false, error: lookupErr.message }, 500, origin);

    const current = typeof lookupData === 'string' ? JSON.parse(lookupData) : lookupData;
    if (!current?.found) {
      return jsonResp({ ok: false, found: false, error: 'batch_not_found', batch_id: rawBatchId }, 404, origin);
    }

    if (current.effective_share_status === 'active' && !force) {
      return jsonResp({
        ok: false,
        error: 'link_still_active',
        message: 'Current batch share link is still active. Pass force: true with an explicit reason to rotate an active link.',
        batch_id: current.batch_id,
        effective_share_status: current.effective_share_status,
        expires_at: current.expires_at,
      }, 409, origin);
    }

    const oldShareId: string | null = current.share_id || null;

    // Resolve authoritative linked property IDs from existing share or permanent batch snapshots
    const propIdSet = new Set<string>();
    if (oldShareId) {
      const { data: shareProps, error: spErr } = await adminClient
        .from('property_share_properties')
        .select('property_id')
        .eq('share_id', oldShareId);
      if (spErr) return jsonResp({ ok: false, error: spErr.message }, 500, origin);
      for (const row of (shareProps || [])) {
        if (row?.property_id) propIdSet.add(String(row.property_id));
      }
    }

    if (propIdSet.size === 0) {
      const { data: bpRows, error: bpErr } = await adminClient
        .from('publishing_batch_properties')
        .select('property_id, published_status')
        .eq('batch_id', current.batch_id)
        .eq('published_status', 'published')
        .not('property_id', 'is', null);
      if (bpErr) return jsonResp({ ok: false, error: bpErr.message }, 500, origin);
      for (const row of (bpRows || [])) {
        if (row?.property_id) propIdSet.add(String(row.property_id));
      }
    }

    const propertyIds = Array.from(propIdSet);
    if (propertyIds.length === 0) {
      return jsonResp({
        ok: false,
        error: 'no_published_properties_to_share',
        batch_id: current.batch_id,
      }, 400, origin);
    }

    const { rawToken, tokenHash } = await mintShareToken();
    const newShareId = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
    const magicLinkUrl = `${PUBLIC_SITE_BASE}/listings.html#share=${rawToken}`;

    // 1. Insert new share record
    const { error: insertShareErr } = await adminClient
      .from('property_shares')
      .insert({
        id: newShareId,
        token_hash: tokenHash,
        created_by: auth.userId || null,
        expires_at: expiresAt,
        share_alias: `batch-${current.batch_id}`,
      });
    if (insertShareErr) {
      return jsonResp({ ok: false, error: insertShareErr.message }, 500, origin);
    }

    // 2. Bind associated properties to new share
    const linkRows = propertyIds.map((propertyId) => ({
      share_id: newShareId,
      property_id: propertyId,
    }));
    const { error: linkErr } = await adminClient
      .from('property_share_properties')
      .insert(linkRows);
    if (linkErr) {
      await adminClient.from('property_shares').delete().eq('id', newShareId);
      return jsonResp({ ok: false, error: linkErr.message }, 500, origin);
    }

    // 3. Mark old share superseded/revoked cleanly (preserve audit trail, never delete)
    if (oldShareId) {
      await adminClient
        .from('property_shares')
        .update({
          revoked_at: current.revoked_at || nowIso,
          replaced_by_share_id: newShareId,
          revocation_reason: reason,
        })
        .eq('id', oldShareId);
    }

    // 4. Update permanent batch registry row
    const { error: batchUpdateErr } = await adminClient
      .from('publishing_batches')
      .update({
        share_id: newShareId,
        magic_link_url: magicLinkUrl,
        share_token_hash: tokenHash,
        share_created_at: nowIso,
        share_expires_at: expiresAt,
        share_property_count: propertyIds.length,
        share_verified: false,
        link_verified_at: null,
        replaced_from_share_id: oldShareId,
        replacement_reason: reason,
        magic_link_succeeded: true,
      })
      .eq('id', current.batch_id);

    if (batchUpdateErr) {
      return jsonResp({ ok: false, error: batchUpdateErr.message }, 500, origin);
    }

    // 5. Write audit entry
    await adminClient.from('admin_actions').insert({
      user_id: auth.userId || null,
      action: 'replace_expired_share_link',
      target_type: 'publishing_batch',
      target_id: current.batch_id,
      metadata: {
        old_share_id: oldShareId,
        new_share_id: newShareId,
        previous_share_status: current.effective_share_status,
        reason,
        forced: force,
        ttl_days: ttlDays,
        expires_at: expiresAt,
        property_count: propertyIds.length,
      },
    });

    const { data: updatedData } = await adminClient.rpc('registry_get_batch', {
      p_batch_id: current.batch_id,
    });
    const updated = typeof updatedData === 'string' ? JSON.parse(updatedData) : updatedData;

    return jsonResp({
      ok: true,
      batch_id: current.batch_id,
      share_id: newShareId,
      replaced_from_share_id: oldShareId,
      replacement_reason: reason,
      magic_link_url: magicLinkUrl,
      expires_at: expiresAt,
      property_count: propertyIds.length,
      registry: updated,
    }, 200, origin);
  }

  return jsonResp({ ok: false, error: 'invalid_action' }, 400, origin);
});
