// ============================================================
// Choice Properties — publish-batch Edge Function
// Phase 8: Batch-scoped isolated publishing, partial-success
// recovery, canonical property reuse across sibling batches,
// single batch #share={token} generation, and inline verification.
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, corsResponse } from '../_shared/cors.ts';
import { mintShareToken } from '../_shared/batch-publishing.ts';
import { enrichPropertyDescription } from '../_shared/description-enrichment.ts';
import { runBatchVerification } from '../_shared/batch-verifier.ts';
import { verifyBatchWorkerLease } from '../_shared/worker-lease.ts';

const PUBLIC_SITE_BASE = 'https://choice-properties-site.pages.dev';

interface AdminAuthResult {
  ok: boolean;
  status: number;
  error?: string;
  userId?: string | null;
  isHumanAdmin?: boolean;
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
  const authHeader = req.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return { ok: false, status: 401, error: 'admin_auth_required' };

  const token = match[1].trim();
  if (!token) return { ok: false, status: 401, error: 'admin_auth_required' };

  if (serviceKey && token === serviceKey) {
    return { ok: true, status: 200, userId: null, isHumanAdmin: false };
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
    return { ok: true, status: 200, userId: userData.user.id, isHumanAdmin: true };
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
        return { ok: true, status: 200, userId: null, isHumanAdmin: false };
      }
    } catch {
      // Fall through to 401
    }
  }

  return { ok: false, status: 401, error: 'invalid_session' };
}

async function resolveShareTtlDays(
  adminClient: ReturnType<typeof createClient>,
  policySetId: string | null,
): Promise<number> {
  try {
    let targetSetId = policySetId;
    if (!targetSetId) {
      const { data: activeSet } = await adminClient
        .from('policy_sets')
        .select('id')
        .eq('status', 'active')
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      targetSetId = activeSet?.id || null;
    }
    if (!targetSetId) return 90;

    const { data: ruleRow } = await adminClient
      .from('policy_rules')
      .select('value_json')
      .eq('policy_set_id', targetSetId)
      .eq('rule_key', 'share_link_ttl_days')
      .eq('is_enabled', true)
      .maybeSingle();

    const raw = ruleRow?.value_json;
    const days = typeof raw === 'number'
      ? raw
      : typeof raw === 'object' && raw !== null && 'value' in raw
      ? Number((raw as Record<string, unknown>).value)
      : Number(raw);
    if (Number.isFinite(days) && days >= 1 && days <= 365) return Math.round(days);
  } catch {
    // Fallback to standard 90 days
  }
  return 90;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return corsResponse(origin);
  if (req.method !== 'POST') {
    return jsonResp({ ok: false, error: 'method_not_allowed' }, 405, origin);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  if (!supabaseUrl || !serviceKey) {
    return jsonResp({ ok: false, error: 'missing_supabase_config' }, 503, origin);
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const auth = await verifyAdminOrService(req, adminClient, supabaseUrl, serviceKey);
  if (!auth.ok) {
    return jsonResp({ ok: false, error: auth.error }, auth.status, origin);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return jsonResp({ ok: false, error: 'invalid_json' }, 400, origin);
  }

  const rawBatchId = typeof body.batch_id === 'string' ? body.batch_id.replace(/^#/, '').trim() : '';
  if (!rawBatchId) {
    return jsonResp({ ok: false, error: 'batch_id_required' }, 400, origin);
  }

  const leaseCheck = await verifyBatchWorkerLease({
    adminClient,
    batchId: rawBatchId,
    req,
    body,
    isHumanAdmin: auth.isHumanAdmin,
  });
  if (!leaseCheck.ok) {
    return jsonResp(leaseCheck.body, leaseCheck.status, origin);
  }

  const limit = Math.min(Math.max(Number(body.limit) || 200, 1), 500);
  const visibilityOverride =
    typeof body.visibility === 'string' && ['private_placement', 'active'].includes(body.visibility.trim())
      ? body.visibility.trim()
      : null;
  const landlordId = typeof body.landlord_id === 'string' && body.landlord_id.trim() ? body.landlord_id.trim() : null;
  const shouldVerify = body.verify !== false;
  const checkLivePages = body.check_live_pages !== false;
  const checkMediaHead = body.check_media_head !== false;

  // 1. Load batch candidates
  const { data: candData, error: candErr } = await adminClient.rpc('pipeline_publish_batch_candidates', {
    p_batch_id: rawBatchId,
    p_limit: limit,
  });
  if (candErr) {
    return jsonResp({ ok: false, error: candErr.message }, 500, origin);
  }

  const candParsed = (typeof candData === 'string' ? JSON.parse(candData) : candData) as Record<string, unknown>;
  if (!candParsed?.ok) {
    const code = candParsed?.error === 'batch_not_found' ? 404 : 400;
    return jsonResp(candParsed || { ok: false, error: 'candidate_lookup_failed' }, code, origin);
  }

  const batchMeta = (candParsed.batch || {}) as Record<string, unknown>;
  const batchTaskConfig =
    batchMeta.task_config && typeof batchMeta.task_config === 'object' && !Array.isArray(batchMeta.task_config)
      ? (batchMeta.task_config as Record<string, unknown>)
      : {};
  const explicitPublicOverride =
    body.explicit_public_override === true ||
    body.allow_public_override === true ||
    batchTaskConfig.explicit_public_override === true;
  const effectiveVisibility = visibilityOverride || String(batchMeta.visibility || 'private_placement');

  if (effectiveVisibility === 'active' && !explicitPublicOverride) {
    return jsonResp({
      ok: false,
      error: 'public_visibility_override_required',
      batch_id: String(batchMeta.id || rawBatchId),
      message: 'Strict rule: every job must publish as private_placement unless the operator explicitly instructs public (active) publishing with explicit_public_override: true.',
    }, 403, origin);
  }

  if (
    effectiveVisibility === 'active' &&
    explicitPublicOverride &&
    (batchTaskConfig.explicit_public_override !== true || String(batchMeta.visibility || '') !== 'active')
  ) {
    const mergedTaskConfig = {
      ...batchTaskConfig,
      explicit_public_override: true,
      ...(typeof body.public_override_reason === 'string' && body.public_override_reason.trim()
        ? { public_override_reason: body.public_override_reason.trim() }
        : {}),
    };
    await adminClient
      .from('publishing_batches')
      .update({
        visibility: 'active',
        task_config: mergedTaskConfig,
      })
      .eq('id', String(batchMeta.id || rawBatchId));
  }

  const candidates = Array.isArray(candParsed.candidates)
    ? (candParsed.candidates as Array<Record<string, unknown>>)
    : [];

  if (candidates.length === 0) {
    return jsonResp({
      ok: false,
      error: 'no_candidates_in_batch',
      batch_id: rawBatchId,
    }, 400, origin);
  }

  // 2. Publish each property inside its own isolated DB transaction (partial-success safe)
  const results: Array<Record<string, unknown>> = [];
  const errors: Array<Record<string, unknown>> = [];
  const publishedPropertyIds: string[] = [];
  let publishedCount = 0;
  let failedCount = 0;
  const skippedCount = 0;

  for (const cand of candidates) {
    const pipelineId = String(cand.id || '');
    if (!pipelineId) continue;

    const valStatus = String(cand.validation_status || 'pending');
    const allowPending = Boolean(auth.isHumanAdmin || body.allow_pending_validation === true);
    if (
      cand.needs_review === true ||
      valStatus === 'rejected' ||
      (valStatus !== 'passed' && !(allowPending && valStatus === 'pending'))
    ) {
      failedCount++;
      const msg = `validation_not_passed: ${String(cand.review_reason || valStatus || 'pending')}`;
      errors.push({ pipeline_id: pipelineId, address: cand.address || null, error: msg });
      results.push({
        pipeline_id: pipelineId,
        ok: false,
        status: 'failed',
        title: cand.title || cand.address || pipelineId,
        error: msg,
      });
      await adminClient.rpc('pipeline_record_publish_failure', {
        p_batch_id: String(batchMeta.id || rawBatchId),
        p_pipeline_id: pipelineId,
        p_error: msg,
      });
      continue;
    }

    // Ensure every candidate has clean Nov 20 sanitize_only description persisted prior to publish
    try {
      const needsAutoSanitize =
        String(cand.enrichment_status || 'pending') !== 'enriched' ||
        !cand.approved_description ||
        String(cand.approved_description).trim() === '';
      if (needsAutoSanitize) {
        const enr = await enrichPropertyDescription(cand, {
          policy: { mode: 'sanitize_only' },
          useAi: false,
        });
        if (enr.approved_description) {
          await adminClient.rpc('pipeline_record_enrichment_result', {
            p_id: pipelineId,
            p_enrichment_status: enr.status,
            p_ai_description_draft: enr.ai_description_draft,
            p_approved_description: enr.approved_description,
            p_enrichment_meta: { mode: 'sanitize_only', model: 'sanitize-only', auto_on_publish: true },
            p_enrichment_version: enr.ruleset_version || 'v1',
            p_last_enriched_hash: enr.original_hash,
            p_needs_review: false,
            p_review_reason: null,
            p_original_hash: enr.original_hash,
            p_cleaned_hash: enr.cleaned_hash,
            p_changes: enr.changes,
            p_reasons: enr.reasons,
            p_confidence: enr.confidence,
            p_ruleset_version: enr.ruleset_version,
            p_model: enr.model,
            p_triggered_by: 'publish-batch:auto_sanitize',
            p_latency_ms: enr.latency_ms,
            p_mode: 'sanitize_only',
          });
        }
      }

      const { data: pubRaw, error: pubErr } = await adminClient.rpc('pipeline_publish_for_batch', {
        p_batch_id: String(batchMeta.id || rawBatchId),
        p_pipeline_id: pipelineId,
        p_visibility: visibilityOverride,
        p_landlord_id: landlordId,
      });

      if (pubErr) {
        failedCount++;
        const msg = pubErr.message || 'rpc_publish_error';
        errors.push({ pipeline_id: pipelineId, address: cand.address || null, error: msg });
        results.push({
          pipeline_id: pipelineId,
          ok: false,
          status: 'failed',
          title: cand.title || cand.address || pipelineId,
          error: msg,
        });
        await adminClient.rpc('pipeline_record_publish_failure', {
          p_batch_id: String(batchMeta.id || rawBatchId),
          p_pipeline_id: pipelineId,
          p_error: msg,
        });
        continue;
      }

      const pubRes = (typeof pubRaw === 'string' ? JSON.parse(pubRaw) : pubRaw) as Record<string, unknown>;
      if (!pubRes?.ok || !pubRes.property_id) {
        failedCount++;
        const msg = String(pubRes?.error || 'publish_validation_failed');
        errors.push({ pipeline_id: pipelineId, address: cand.address || null, error: msg });
        results.push({
          pipeline_id: pipelineId,
          ok: false,
          status: 'failed',
          title: cand.title || cand.address || pipelineId,
          error: msg,
        });
        await adminClient.rpc('pipeline_record_publish_failure', {
          p_batch_id: String(batchMeta.id || rawBatchId),
          p_pipeline_id: pipelineId,
          p_error: msg,
        });
        continue;
      }

      publishedCount++;
      const propId = String(pubRes.property_id);
      if (!publishedPropertyIds.includes(propId)) {
        publishedPropertyIds.push(propId);
      }
      results.push({
        pipeline_id: pipelineId,
        ok: true,
        status: 'published',
        title: cand.title || cand.address || pipelineId,
        property_id: propId,
        reused_canonical: Boolean(pubRes.reused_canonical),
        published_rent: pubRes.published_rent ?? cand.monthly_rent ?? null,
        pricing_method: cand.pricing_method ?? null,
        photo_count: pubRes.photo_count ?? null,
      });
    } catch (err) {
      failedCount++;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ pipeline_id: pipelineId, address: cand.address || null, error: msg });
      results.push({
        pipeline_id: pipelineId,
        ok: false,
        status: 'failed',
        title: cand.title || cand.address || pipelineId,
        error: msg,
      });
      try {
        await adminClient.rpc('pipeline_record_publish_failure', {
          p_batch_id: String(batchMeta.id || rawBatchId),
          p_pipeline_id: pipelineId,
          p_error: msg,
        });
      } catch {
        // Non-fatal audit update
      }
    }
  }

  // 3. Mint or reuse batch share token if >= 1 property succeeded
  let shareId: string | null = null;
  let magicLinkUrl: string | null = null;
  let shareTokenHash: string | null = null;
  let shareExpiresAt: string | null = null;

  if (publishedPropertyIds.length > 0) {
    const existingShareId = typeof batchMeta.share_id === 'string' ? batchMeta.share_id : null;
    const existingMagicUrl = typeof batchMeta.magic_link_url === 'string' ? batchMeta.magic_link_url : null;

    let reuseExistingShare = false;
    if (existingShareId && existingMagicUrl && body.rotate_share !== true) {
      const { data: shareRow } = await adminClient
        .from('property_shares')
        .select('id, token_hash, expires_at, revoked_at')
        .eq('id', existingShareId)
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (shareRow) {
        reuseExistingShare = true;
        shareId = shareRow.id;
        magicLinkUrl = existingMagicUrl;
        shareTokenHash = shareRow.token_hash;
        shareExpiresAt = shareRow.expires_at;

        const { data: curLinks } = await adminClient
          .from('property_share_properties')
          .select('property_id')
          .eq('share_id', shareId);
        const curSet = new Set((curLinks || []).map((l) => String(l.property_id)));
        const missingLinks = publishedPropertyIds
          .filter((id) => !curSet.has(id))
          .map((id) => ({ share_id: shareId, property_id: id }));
        if (missingLinks.length > 0) {
          await adminClient.from('property_share_properties').insert(missingLinks);
        }
      }
    }

    if (!reuseExistingShare) {
      const ttlDays = await resolveShareTtlDays(
        adminClient,
        typeof batchMeta.policy_set_id === 'string' ? batchMeta.policy_set_id : null,
      );
      const { rawToken, tokenHash } = await mintShareToken();
      const newShareId = crypto.randomUUID();
      const expiresAtIso = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
      const batchLabel = String(batchMeta.id || rawBatchId);

      const { error: shareErr } = await adminClient.from('property_shares').insert({
        id: newShareId,
        token_hash: tokenHash,
        created_by: auth.userId || null,
        expires_at: expiresAtIso,
        share_alias: `batch-${batchLabel}`,
      });
      if (shareErr) {
        return jsonResp({ ok: false, error: `share_insert_failed: ${shareErr.message}`, results, errors }, 500, origin);
      }

      const linkRows = publishedPropertyIds.map((id) => ({
        share_id: newShareId,
        property_id: id,
      }));
      const { error: linkErr } = await adminClient.from('property_share_properties').insert(linkRows);
      if (linkErr) {
        await adminClient.from('property_shares').delete().eq('id', newShareId);
        return jsonResp({ ok: false, error: `share_link_insert_failed: ${linkErr.message}`, results, errors }, 500, origin);
      }

      shareId = newShareId;
      shareTokenHash = tokenHash;
      shareExpiresAt = expiresAtIso;
      magicLinkUrl = `${PUBLIC_SITE_BASE}/listings.html#share=${rawToken}`;
    }
  }

  // 4. Finalize batch summary & permanent registry entry
  const finalBatchId = String(batchMeta.id || rawBatchId);
  const { data: finRaw, error: finErr } = await adminClient.rpc('pipeline_finalize_batch_publish', {
    p_batch_id: finalBatchId,
    p_share_id: shareId,
    p_magic_link_url: magicLinkUrl,
    p_share_token_hash: shareTokenHash,
    p_share_expires_at: shareExpiresAt,
    p_share_property_count: publishedPropertyIds.length,
    p_published_count: publishedCount,
    p_failed_count: failedCount,
    p_skipped_count: skippedCount,
    p_errors: errors,
  });
  if (finErr) {
    return jsonResp({ ok: false, error: finErr.message, results, errors }, 500, origin);
  }
  const finRes = (typeof finRaw === 'string' ? JSON.parse(finRaw) : finRaw) as Record<string, unknown>;

  // 5. Audit admin_actions (non-blocking)
  try {
    await adminClient
      .from('admin_actions')
      .insert({
        user_id: auth.userId || null,
        action: 'batch.publish',
        target_type: 'publishing_batch',
        target_id: finalBatchId,
        metadata: {
          published_count: publishedCount,
          failed_count: failedCount,
          share_id: shareId,
          property_ids: publishedPropertyIds,
        },
      });
  } catch {
    // Non-fatal audit logging
  }

  // 6. Optional inline post-publish live verification
  let verification: unknown = null;
  if (shouldVerify && publishedCount > 0 && magicLinkUrl) {
    verification = await runBatchVerification(adminClient, {
      batchId: finalBatchId,
      checkLivePages,
      checkMediaHead,
      supabaseUrl,
      serviceKey,
      anonKey,
    });
  }

  const batchOk = publishedCount > 0;
  return jsonResp(
    {
      ok: batchOk,
      batch_id: finalBatchId,
      status: finRes?.status || (publishedCount > 0 ? (failedCount > 0 ? 'partial' : 'completed') : 'failed'),
      published_count: publishedCount,
      failed_count: failedCount,
      skipped_count: skippedCount,
      share_id: shareId,
      magic_link_url: magicLinkUrl,
      expires_at: shareExpiresAt,
      property_ids: publishedPropertyIds,
      results,
      errors,
      verification,
    },
    batchOk ? 200 : 422,
    origin,
  );
});
