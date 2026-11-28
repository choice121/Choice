// ============================================================
// Choice Properties — rules-engine Edge Function
// Phase 4: Centralized Rules & Policies Engine + Versioned Policy Admin
// - Actions:
//     * get_active_policy       (optional batch_id -> returns pinned or active)
//     * list_versions           (policy_sets + policy_change_log)
//     * pin_policy_to_batch     (pins active or specified policy_set_id)
//     * update_rules            (creates new active version + audit log; 403 on immutable)
//     * create_draft_version    (stages draft version without activating)
//     * activate_version        (activates a draft version + logs audit)
//     * evaluate_dry_run        (in-memory rule & sample evaluation; zero DB writes)
//     * prohibited_profiles     (list / create / update / delete; protects immutable)
//     * scraping_providers      (list / update_config)
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, corsResponse } from '../_shared/cors.ts';

interface AuthResult {
  ok: boolean;
  status: number;
  error?: string;
  actor: string;
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
): Promise<AuthResult> {
  const authHeader = req.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return { ok: false, status: 401, error: 'admin_auth_required', actor: 'anonymous' };

  const token = match[1].trim();
  if (!token) return { ok: false, status: 401, error: 'admin_auth_required', actor: 'anonymous' };

  if (serviceKey && token === serviceKey) {
    return { ok: true, status: 200, actor: 'service_role' };
  }

  const { data: userData, error: authErr } = await adminClient.auth.getUser(token);
  if (!authErr && userData?.user) {
    const { data: adminRow, error: roleErr } = await adminClient
      .from('admin_roles')
      .select('user_id')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (roleErr) return { ok: false, status: 500, error: 'admin_check_failed', actor: userData.user.id };
    if (!adminRow) return { ok: false, status: 403, error: 'admin_required', actor: userData.user.id };
    return { ok: true, status: 200, actor: userData.user.email || userData.user.id };
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
        return { ok: true, status: 200, actor: 'service_role_jwt' };
      }
    } catch {
      // Fall through to 401
    }
  }

  return { ok: false, status: 401, error: 'invalid_session', actor: 'anonymous' };
}

function normalizeText(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractZillowProfileSlug(raw: string): string | null {
  const m = String(raw || '').trim().match(/zillow\.com\/profile\/([^/?#]+)/i);
  if (!m || !m[1]) return null;
  try {
    return decodeURIComponent(m[1]).trim().toLowerCase();
  } catch {
    return m[1].trim().toLowerCase();
  }
}

function sanitizeZillowProfileUrls(input: unknown): string[] {
  const arr = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(/[\n,]+/)
      : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of arr) {
    const raw = String(item || '').trim();
    if (!raw) continue;
    try {
      const u = raw.startsWith('/') ? new URL(`https://www.zillow.com${raw}`) : new URL(raw);
      const host = u.hostname.toLowerCase();
      if (u.protocol === 'https:' && (host === 'zillow.com' || host === 'www.zillow.com') && u.pathname.toLowerCase().includes('/profile/')) {
        u.search = '';
        u.hash = '';
        const clean = u.toString().replace(/\/+$/, '/');
        if (!seen.has(clean.toLowerCase())) {
          seen.add(clean.toLowerCase());
          out.push(clean);
        }
      }
    } catch {
      // Ignore non-URL strings here; handled via aliases/canonical_name
    }
  }
  return out;
}

function nameFromProfileSlug(slug: string): string {
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function matchProhibitedProfile(
  haystack: string,
  profiles: Array<{
    canonical_name: string;
    aliases?: string[];
    zillow_profile_urls?: string[];
    match_mode?: string;
    enabled?: boolean;
  }>,
): { matched: boolean; profile?: string; matched_term?: string } {
  const norm = normalizeText(haystack);
  const rawLower = String(haystack || '').toLowerCase();
  if (!norm && !rawLower) return { matched: false };

  for (const prof of profiles) {
    if (prof.enabled === false) continue;
    const urls = Array.isArray(prof.zillow_profile_urls) ? prof.zillow_profile_urls : [];
    for (const u of urls) {
      const cleanUrl = String(u || '').trim().toLowerCase().replace(/\/+$/, '');
      if (cleanUrl && rawLower.includes(cleanUrl)) {
        return { matched: true, profile: prof.canonical_name, matched_term: u };
      }
      const slug = extractZillowProfileSlug(String(u || ''));
      if (slug && rawLower.includes(`/profile/${slug}`)) {
        return { matched: true, profile: prof.canonical_name, matched_term: slug };
      }
    }

    const terms = [prof.canonical_name, ...(Array.isArray(prof.aliases) ? prof.aliases : [])]
      .map((t) => normalizeText(t))
      .filter(Boolean);

    for (const term of terms) {
      if (prof.match_mode === 'normalized_exact') {
        if (norm === term) return { matched: true, profile: prof.canonical_name, matched_term: term };
      } else {
        const paddedNorm = ` ${norm} `;
        const paddedTerm = ` ${term} `;
        if (paddedNorm.includes(paddedTerm)) {
          return { matched: true, profile: prof.canonical_name, matched_term: term };
        }
      }
    }
  }
  return { matched: false };
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

  const auth = await verifyAdminOrService(req, adminClient, supabaseUrl, serviceKey);
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
      action: url.searchParams.get('action') || 'get_active_policy',
      batch_id: url.searchParams.get('batch_id') || '',
      sub_action: url.searchParams.get('sub_action') || 'list',
    };
  }

  const action = String(body.action || 'get_active_policy').trim();

  // ── 1. Get Active or Batch-Pinned Effective Policy ────────────────────────
  if (action === 'get_active_policy' || action === 'get_batch_policy') {
    const batchId = typeof body.batch_id === 'string' && body.batch_id.trim() ? body.batch_id.trim() : null;
    const { data, error } = await adminClient.rpc('rules_get_effective_policy', {
      p_batch_id: batchId,
    });
    if (error) return jsonResp({ ok: false, error: error.message }, 500, origin);
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return jsonResp(parsed, parsed?.ok ? 200 : 400, origin);
  }

  // ── 2. List Policy Versions & Change Log ──────────────────────────────────
  if (action === 'list_versions') {
    const { data: sets, error: setsErr } = await adminClient
      .from('policy_sets')
      .select('*')
      .order('version_number', { ascending: false })
      .limit(50);
    if (setsErr) return jsonResp({ ok: false, error: setsErr.message }, 500, origin);

    const { data: logs, error: logsErr } = await adminClient
      .from('policy_change_log')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(100);
    if (logsErr) return jsonResp({ ok: false, error: logsErr.message }, 500, origin);

    return jsonResp({ ok: true, versions: sets || [], change_log: logs || [] }, 200, origin);
  }

  // ── 3. Pin Policy Set to a Batch ──────────────────────────────────────────
  if (action === 'pin_policy_to_batch') {
    if (req.method !== 'POST') return jsonResp({ ok: false, error: 'post_required' }, 405, origin);
    const batchId = typeof body.batch_id === 'string' ? body.batch_id.replace(/^#/, '').trim() : '';
    const requestedSetId = typeof body.policy_set_id === 'string' ? body.policy_set_id.trim() : '';
    const force = body.force === true;

    if (!batchId) return jsonResp({ ok: false, error: 'batch_id_required' }, 400, origin);

    const { data: batchRow, error: batchErr } = await adminClient
      .from('publishing_batches')
      .select('id, policy_set_id')
      .eq('id', batchId)
      .maybeSingle();
    if (batchErr) return jsonResp({ ok: false, error: batchErr.message }, 500, origin);
    if (!batchRow) return jsonResp({ ok: false, error: 'batch_not_found', batch_id: batchId }, 404, origin);

    if (batchRow.policy_set_id && !force) {
      return jsonResp({
        ok: true,
        already_pinned: true,
        batch_id: batchId,
        policy_set_id: batchRow.policy_set_id,
      }, 200, origin);
    }

    let targetSetId = requestedSetId;
    if (!targetSetId) {
      const { data: activeSet, error: activeErr } = await adminClient
        .from('policy_sets')
        .select('id')
        .eq('status', 'active')
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (activeErr || !activeSet) {
        return jsonResp({ ok: false, error: 'no_active_policy_set' }, 500, origin);
      }
      targetSetId = activeSet.id;
    }

    const { error: updErr } = await adminClient
      .from('publishing_batches')
      .update({ policy_set_id: targetSetId })
      .eq('id', batchId);
    if (updErr) return jsonResp({ ok: false, error: updErr.message }, 500, origin);

    return jsonResp({
      ok: true,
      already_pinned: false,
      batch_id: batchId,
      policy_set_id: targetSetId,
    }, 200, origin);
  }

  // ── 4. Update Configurable Rules (Creates New Active Version + Audit Log) ─
  if (action === 'update_rules' || action === 'update_rule') {
    if (req.method !== 'POST') return jsonResp({ ok: false, error: 'post_required' }, 405, origin);

    let updates: Record<string, unknown> = {};
    if (body.updates && typeof body.updates === 'object' && !Array.isArray(body.updates)) {
      updates = body.updates as Record<string, unknown>;
    } else if (typeof body.rule_key === 'string' && body.rule_key.trim()) {
      updates = { [body.rule_key.trim()]: body.value_json ?? body.value };
    }

    if (Object.keys(updates).length === 0) {
      return jsonResp({ ok: false, error: 'updates_object_required' }, 400, origin);
    }

    const reason = typeof body.reason === 'string' && body.reason.trim()
      ? body.reason.trim()
      : 'Admin policy configuration update';

    const { data, error } = await adminClient.rpc('rules_publish_configurable_update', {
      p_updates: updates,
      p_changed_by: auth.actor,
      p_reason: reason,
    });
    if (error) return jsonResp({ ok: false, error: error.message }, 500, origin);

    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    if (!parsed?.ok) {
      const status = parsed?.error === 'immutable_rule_protected' ? 403 : 400;
      return jsonResp(parsed, status, origin);
    }
    return jsonResp(parsed, 200, origin);
  }

  // ── 5. Create Draft Version ───────────────────────────────────────────────
  if (action === 'create_draft_version') {
    if (req.method !== 'POST') return jsonResp({ ok: false, error: 'post_required' }, 405, origin);
    const updates = (body.updates && typeof body.updates === 'object' && !Array.isArray(body.updates))
      ? (body.updates as Record<string, unknown>)
      : {};
    const notes = typeof body.notes === 'string' && body.notes.trim()
      ? body.notes.trim()
      : 'Draft policy set';

    const { data: activeRes, error: effErr } = await adminClient.rpc('rules_get_effective_policy', { p_batch_id: null });
    if (effErr) return jsonResp({ ok: false, error: effErr.message }, 500, origin);
    const active = typeof activeRes === 'string' ? JSON.parse(activeRes) : activeRes;
    const activeRules = (active?.rules || []) as Array<Record<string, unknown>>;

    for (const key of Object.keys(updates)) {
      const found = activeRules.find((r) => r.rule_key === key);
      if (!found) return jsonResp({ ok: false, error: 'unknown_rule_key', rule_key: key }, 400, origin);
      if (found.is_immutable) {
        return jsonResp({
          ok: false,
          error: 'immutable_rule_protected',
          rule_key: key,
          message: `Immutable Choice system rule "${key}" cannot be modified.`,
        }, 403, origin);
      }
    }

    const { data: maxRows } = await adminClient
      .from('policy_sets')
      .select('version_number')
      .order('version_number', { ascending: false })
      .limit(1);
    const nextVer = ((maxRows?.[0]?.version_number as number) || 1) + 1;
    const draftLabel = typeof body.version_label === 'string' && body.version_label.trim()
      ? body.version_label.trim()
      : `v${nextVer}`;

    const { data: newSet, error: insSetErr } = await adminClient
      .from('policy_sets')
      .insert({
        version_number: nextVer,
        version_label: draftLabel,
        status: 'draft',
        notes,
        created_by: auth.actor,
      })
      .select('*')
      .single();
    if (insSetErr || !newSet) {
      return jsonResp({ ok: false, error: insSetErr?.message || 'draft_create_failed' }, 500, origin);
    }

    const clonedRules = activeRules.map((r) => ({
      policy_set_id: newSet.id,
      rule_key: r.rule_key,
      category: r.category,
      value_json: Object.prototype.hasOwnProperty.call(updates, String(r.rule_key))
        ? updates[String(r.rule_key)]
        : r.value_json,
      is_immutable: Boolean(r.is_immutable),
      is_enabled: r.is_enabled !== false,
      description: r.description || null,
    }));

    const { error: insRulesErr } = await adminClient.from('policy_rules').insert(clonedRules);
    if (insRulesErr) {
      await adminClient.from('policy_sets').delete().eq('id', newSet.id);
      return jsonResp({ ok: false, error: insRulesErr.message }, 500, origin);
    }

    return jsonResp({ ok: true, draft_policy_set: newSet, updated_keys: Object.keys(updates) }, 201, origin);
  }

  // ── 6. Activate Draft Version ─────────────────────────────────────────────
  if (action === 'activate_version') {
    if (req.method !== 'POST') return jsonResp({ ok: false, error: 'post_required' }, 405, origin);
    const targetSetId = typeof body.policy_set_id === 'string' ? body.policy_set_id.trim() : '';
    const reason = typeof body.reason === 'string' && body.reason.trim()
      ? body.reason.trim()
      : 'Activated draft policy version';

    if (!targetSetId) return jsonResp({ ok: false, error: 'policy_set_id_required' }, 400, origin);

    const { data: targetSet, error: tErr } = await adminClient
      .from('policy_sets')
      .select('*')
      .eq('id', targetSetId)
      .maybeSingle();
    if (tErr) return jsonResp({ ok: false, error: tErr.message }, 500, origin);
    if (!targetSet) return jsonResp({ ok: false, error: 'policy_set_not_found' }, 404, origin);

    if (targetSet.status === 'active') {
      return jsonResp({ ok: true, already_active: true, policy_set: targetSet }, 200, origin);
    }

    const { data: activeEff } = await adminClient.rpc('rules_get_effective_policy', { p_batch_id: null });
    const parsedEff = typeof activeEff === 'string' ? JSON.parse(activeEff) : activeEff;
    const activeRules = (parsedEff?.rules || []) as Array<Record<string, unknown>>;
    const activeSetId = parsedEff?.policy_set?.id as string | undefined;

    const { data: draftRules, error: dErr } = await adminClient
      .from('policy_rules')
      .select('*')
      .eq('policy_set_id', targetSetId);
    if (dErr) return jsonResp({ ok: false, error: dErr.message }, 500, origin);

    // Verify all immutable rules in active set match draft identically
    for (const ar of activeRules) {
      if (!ar.is_immutable) continue;
      const dr = (draftRules || []).find((x) => x.rule_key === ar.rule_key);
      if (!dr || JSON.stringify(dr.value_json) !== JSON.stringify(ar.value_json) || !dr.is_enabled) {
        return jsonResp({
          ok: false,
          error: 'immutable_rule_protected',
          rule_key: ar.rule_key,
          message: `Cannot activate version: immutable rule "${ar.rule_key}" differs or is disabled.`,
        }, 403, origin);
      }
    }

    if (activeSetId) {
      await adminClient.from('policy_sets').update({ status: 'archived' }).eq('id', activeSetId);
    }
    const nowIso = new Date().toISOString();
    const { data: activated, error: actErr } = await adminClient
      .from('policy_sets')
      .update({ status: 'active', activated_at: nowIso })
      .eq('id', targetSetId)
      .select('*')
      .single();
    if (actErr) return jsonResp({ ok: false, error: actErr.message }, 500, origin);

    await adminClient.from('policy_change_log').insert({
      policy_set_id: targetSetId,
      rule_key: 'policy_set_activation',
      old_value: activeSetId ? { policy_set_id: activeSetId } : null,
      new_value: { policy_set_id: targetSetId, version_label: targetSet.version_label },
      changed_by: auth.actor,
      reason,
    });

    return jsonResp({ ok: true, policy_set: activated }, 200, origin);
  }

  // ── 7. Evaluate Dry Run (Zero DB Writes) ──────────────────────────────────
  if (action === 'evaluate_dry_run') {
    const proposed = (body.proposed_updates && typeof body.proposed_updates === 'object' && !Array.isArray(body.proposed_updates))
      ? (body.proposed_updates as Record<string, unknown>)
      : {};
    const sample = (body.sample_listing && typeof body.sample_listing === 'object' && !Array.isArray(body.sample_listing))
      ? (body.sample_listing as Record<string, unknown>)
      : null;

    const { data: effData, error: effErr } = await adminClient.rpc('rules_get_effective_policy', { p_batch_id: null });
    if (effErr) return jsonResp({ ok: false, error: effErr.message }, 500, origin);
    const eff = typeof effData === 'string' ? JSON.parse(effData) : effData;
    const rulesList = (eff?.rules || []) as Array<Record<string, unknown>>;
    const mergedMap: Record<string, unknown> = { ...(eff?.rules_map || {}) };

    const diffs: Array<{ rule_key: string; old_value: unknown; new_value: unknown }> = [];
    for (const [key, val] of Object.entries(proposed)) {
      const rule = rulesList.find((r) => r.rule_key === key);
      if (!rule) {
        return jsonResp({ ok: false, error: 'unknown_rule_key', rule_key: key }, 400, origin);
      }
      if (rule.is_immutable) {
        return jsonResp({
          ok: false,
          error: 'immutable_rule_protected',
          rule_key: key,
          message: `Dry run rejected: immutable rule "${key}" cannot be overridden.`,
        }, 403, origin);
      }
      diffs.push({ rule_key: key, old_value: rule.value_json, new_value: val });
      mergedMap[key] = val;
    }

    let sampleEvaluation: Record<string, unknown> | null = null;
    if (sample) {
      const profiles = (eff?.prohibited_source_profiles || []) as Array<{
        canonical_name: string;
        aliases?: string[];
        zillow_profile_urls?: string[];
        match_mode?: string;
        enabled?: boolean;
      }>;
      const haystack = [sample.agent_name, sample.broker_name, sample.source_url, sample.description].filter(Boolean).join(' ');
      const profileMatch = matchProhibitedProfile(haystack, profiles);
      const minPhotos = Number(mergedMap.min_usable_photos ?? 1);
      const photoCount = Number(sample.photo_count ?? 0);
      const rent = Number(sample.monthly_rent ?? 0);
      const appFee = Number(mergedMap.application_fee ?? 50);

      const reasons: string[] = [];
      if (profileMatch.matched) reasons.push(`prohibited_source_profile:${profileMatch.profile}`);
      if (photoCount < minPhotos) reasons.push(`insufficient_photos:${photoCount}<${minPhotos}`);
      if (!Number.isFinite(rent) || rent <= 0) reasons.push('invalid_monthly_rent');

      sampleEvaluation = {
        eligible: reasons.length === 0,
        reasons,
        prohibited_match: profileMatch,
        enforced_application_fee: appFee,
        description_mode: mergedMap.description_mode,
        max_description_length_variance_pct: mergedMap.max_description_length_variance_pct,
      };
    }

    return jsonResp({
      ok: true,
      dry_run: true,
      mutated_live_db: false,
      base_policy_set: eff?.policy_set,
      diffs,
      simulated_rules_map: mergedMap,
      sample_evaluation: sampleEvaluation,
    }, 200, origin);
  }

  // ── 8. Prohibited Source Profiles CRUD (+ Unlimited Bulk & Zillow URLs) ───
  if (action === 'prohibited_profiles') {
    const sub = String(body.sub_action || 'list').trim();

    if (sub === 'list') {
      const { data, error } = await adminClient
        .from('prohibited_source_profiles')
        .select('*')
        .order('is_immutable', { ascending: false })
        .order('canonical_name', { ascending: true });
      if (error) return jsonResp({ ok: false, error: error.message }, 500, origin);
      return jsonResp({ ok: true, profiles: data || [] }, 200, origin);
    }

    if (req.method !== 'POST') return jsonResp({ ok: false, error: 'post_required' }, 405, origin);

    if (sub === 'create') {
      const rawUrlList = sanitizeZillowProfileUrls(body.zillow_profile_urls ?? body.profile_url ?? body.url);
      let canonical = typeof body.canonical_name === 'string' ? body.canonical_name.trim() : '';
      if (!canonical && rawUrlList.length > 0) {
        const slug = extractZillowProfileSlug(rawUrlList[0]);
        if (slug) canonical = nameFromProfileSlug(slug);
      }
      if (!canonical) return jsonResp({ ok: false, error: 'canonical_name_required' }, 400, origin);

      const rawAliases = Array.isArray(body.aliases)
        ? body.aliases.map((a) => String(a).trim()).filter(Boolean)
        : typeof body.aliases === 'string'
          ? body.aliases.split(',').map((a) => a.trim()).filter(Boolean)
          : [];
      const urlSlugAliases = rawUrlList
        .map((u) => extractZillowProfileSlug(u))
        .filter((s): s is string => Boolean(s))
        .map((s) => nameFromProfileSlug(s))
        .filter((s) => normalizeText(s) !== normalizeText(canonical));
      const aliases = Array.from(new Set([...rawAliases, ...urlSlugAliases]));
      const matchMode = body.match_mode === 'normalized_exact' ? 'normalized_exact' : 'token_phrase';

      const { data, error } = await adminClient
        .from('prohibited_source_profiles')
        .insert({
          canonical_name: canonical,
          aliases,
          zillow_profile_urls: rawUrlList,
          match_mode: matchMode,
          is_immutable: false,
          enabled: body.enabled !== false,
          notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
          added_by: auth.actor,
        })
        .select('*')
        .single();
      if (error) return jsonResp({ ok: false, error: error.message }, 400, origin);
      return jsonResp({ ok: true, profile: data }, 201, origin);
    }

    if (sub === 'bulk_create') {
      const itemsToProcess: Array<{
        canonical_name: string;
        aliases: string[];
        zillow_profile_urls: string[];
        match_mode: 'token_phrase' | 'normalized_exact';
        notes: string | null;
      }> = [];

      if (typeof body.text === 'string' && body.text.trim()) {
        const lines = body.text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        for (const line of lines) {
          const parts = line.split('|').map((p) => p.trim()).filter(Boolean);
          const lineUrls: string[] = [];
          const lineTerms: string[] = [];
          for (const part of parts) {
            if (/zillow\.com\/profile\//i.test(part)) {
              lineUrls.push(...sanitizeZillowProfileUrls(part));
            } else {
              for (const token of part.split(',').map((t) => t.trim()).filter(Boolean)) {
                if (/zillow\.com\/profile\//i.test(token)) {
                  lineUrls.push(...sanitizeZillowProfileUrls(token));
                } else {
                  lineTerms.push(token);
                }
              }
            }
          }
          let canonical = lineTerms[0] || '';
          const aliases = lineTerms.slice(1);
          if (!canonical && lineUrls.length > 0) {
            const slug = extractZillowProfileSlug(lineUrls[0]);
            if (slug) canonical = nameFromProfileSlug(slug);
          }
          if (canonical) {
            itemsToProcess.push({
              canonical_name: canonical,
              aliases,
              zillow_profile_urls: lineUrls,
              match_mode: 'token_phrase',
              notes: typeof body.notes === 'string' ? body.notes.trim() || null : 'Bulk added via Admin',
            });
          }
        }
      }

      if (Array.isArray(body.entries)) {
        for (const rawEntry of body.entries) {
          if (typeof rawEntry === 'string') {
            const trimmed = rawEntry.trim();
            if (!trimmed) continue;
            const urls = sanitizeZillowProfileUrls(trimmed);
            const slug = urls[0] ? extractZillowProfileSlug(urls[0]) : null;
            const canonical = urls.length > 0 ? (slug ? nameFromProfileSlug(slug) : trimmed) : trimmed;
            itemsToProcess.push({
              canonical_name: canonical,
              aliases: [],
              zillow_profile_urls: urls,
              match_mode: 'token_phrase',
              notes: null,
            });
          } else if (rawEntry && typeof rawEntry === 'object') {
            const e = rawEntry as Record<string, unknown>;
            const urls = sanitizeZillowProfileUrls(e.zillow_profile_urls ?? e.url);
            let canonical = typeof e.canonical_name === 'string' ? e.canonical_name.trim() : '';
            if (!canonical && urls.length > 0) {
              const slug = extractZillowProfileSlug(urls[0]);
              if (slug) canonical = nameFromProfileSlug(slug);
            }
            if (!canonical) continue;
            const aliases = Array.isArray(e.aliases)
              ? e.aliases.map((a) => String(a).trim()).filter(Boolean)
              : [];
            itemsToProcess.push({
              canonical_name: canonical,
              aliases,
              zillow_profile_urls: urls,
              match_mode: e.match_mode === 'normalized_exact' ? 'normalized_exact' : 'token_phrase',
              notes: typeof e.notes === 'string' ? e.notes.trim() || null : null,
            });
          }
        }
      }

      if (itemsToProcess.length === 0) {
        return jsonResp({ ok: false, error: 'entries_or_text_required' }, 400, origin);
      }

      const { data: existingRows, error: exErr } = await adminClient
        .from('prohibited_source_profiles')
        .select('*');
      if (exErr) return jsonResp({ ok: false, error: exErr.message }, 500, origin);

      const byNormName = new Map<string, Record<string, unknown>>();
      for (const row of existingRows || []) {
        byNormName.set(normalizeText(row.canonical_name), row);
      }

      let createdCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      const touchedProfiles: Array<Record<string, unknown>> = [];

      for (const item of itemsToProcess) {
        const key = normalizeText(item.canonical_name);
        if (!key) {
          skippedCount++;
          continue;
        }
        const existing = byNormName.get(key);
        if (existing) {
          const mergedAliases = Array.from(new Set([
            ...(Array.isArray(existing.aliases) ? existing.aliases.map(String) : []),
            ...item.aliases,
          ]));
          const mergedUrls = Array.from(new Set([
            ...(Array.isArray(existing.zillow_profile_urls) ? existing.zillow_profile_urls.map(String) : []),
            ...item.zillow_profile_urls,
          ]));
          const unchanged =
            mergedAliases.length === (Array.isArray(existing.aliases) ? existing.aliases.length : 0) &&
            mergedUrls.length === (Array.isArray(existing.zillow_profile_urls) ? existing.zillow_profile_urls.length : 0);

          if (unchanged) {
            skippedCount++;
            continue;
          }
          const { data: upd, error: uErr } = await adminClient
            .from('prohibited_source_profiles')
            .update({
              aliases: mergedAliases,
              zillow_profile_urls: mergedUrls,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
            .select('*')
            .single();
          if (!uErr && upd) {
            updatedCount++;
            byNormName.set(key, upd);
            touchedProfiles.push(upd);
          } else {
            skippedCount++;
          }
        } else {
          const { data: ins, error: iErr } = await adminClient
            .from('prohibited_source_profiles')
            .insert({
              canonical_name: item.canonical_name,
              aliases: item.aliases,
              zillow_profile_urls: item.zillow_profile_urls,
              match_mode: item.match_mode,
              is_immutable: false,
              enabled: true,
              notes: item.notes,
              added_by: auth.actor,
            })
            .select('*')
            .single();
          if (!iErr && ins) {
            createdCount++;
            byNormName.set(key, ins);
            touchedProfiles.push(ins);
          } else {
            skippedCount++;
          }
        }
      }

      return jsonResp({
        ok: true,
        created_count: createdCount,
        updated_count: updatedCount,
        skipped_count: skippedCount,
        profiles: touchedProfiles,
      }, 200, origin);
    }

    if (sub === 'update') {
      const id = typeof body.id === 'string' ? body.id.trim() : '';
      if (!id) return jsonResp({ ok: false, error: 'id_required' }, 400, origin);

      const { data: existing, error: fErr } = await adminClient
        .from('prohibited_source_profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (fErr) return jsonResp({ ok: false, error: fErr.message }, 500, origin);
      if (!existing) return jsonResp({ ok: false, error: 'profile_not_found' }, 404, origin);

      if (existing.is_immutable && body.enabled === false) {
        return jsonResp({
          ok: false,
          error: 'immutable_profile_protected',
          message: `Immutable prohibited profile "${existing.canonical_name}" cannot be disabled.`,
        }, 403, origin);
      }

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (Array.isArray(body.aliases)) patch.aliases = body.aliases.map((a) => String(a).trim()).filter(Boolean);
      if (body.zillow_profile_urls !== undefined) {
        patch.zillow_profile_urls = sanitizeZillowProfileUrls(body.zillow_profile_urls);
      }
      if (typeof body.notes === 'string') patch.notes = body.notes.trim() || null;
      if (typeof body.enabled === 'boolean' && !existing.is_immutable) patch.enabled = body.enabled;
      if (body.match_mode === 'normalized_exact' || body.match_mode === 'token_phrase') patch.match_mode = body.match_mode;

      const { data, error } = await adminClient
        .from('prohibited_source_profiles')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) return jsonResp({ ok: false, error: error.message }, 400, origin);
      return jsonResp({ ok: true, profile: data }, 200, origin);
    }

    if (sub === 'delete') {
      const id = typeof body.id === 'string' ? body.id.trim() : '';
      if (!id) return jsonResp({ ok: false, error: 'id_required' }, 400, origin);

      const { data: existing } = await adminClient
        .from('prohibited_source_profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (!existing) return jsonResp({ ok: false, error: 'profile_not_found' }, 404, origin);

      if (existing.is_immutable) {
        return jsonResp({
          ok: false,
          error: 'immutable_profile_protected',
          message: `Immutable prohibited profile "${existing.canonical_name}" cannot be deleted.`,
        }, 403, origin);
      }

      const { error } = await adminClient.from('prohibited_source_profiles').delete().eq('id', id);
      if (error) return jsonResp({ ok: false, error: error.message }, 400, origin);
      return jsonResp({ ok: true, deleted_id: id }, 200, origin);
    }

    return jsonResp({ ok: false, error: 'invalid_sub_action' }, 400, origin);
  }

  // ── 9. Scraping Providers Management ──────────────────────────────────────
  if (action === 'scraping_providers') {
    const sub = String(body.sub_action || 'list').trim();
    if (sub === 'list') {
      const { data, error } = await adminClient
        .from('scraping_providers')
        .select('*')
        .order('is_default', { ascending: false })
        .order('provider_key', { ascending: true });
      if (error) return jsonResp({ ok: false, error: error.message }, 500, origin);
      return jsonResp({ ok: true, providers: data || [] }, 200, origin);
    }

    if (req.method !== 'POST') return jsonResp({ ok: false, error: 'post_required' }, 405, origin);

    if (sub === 'update_config') {
      const providerKey = typeof body.provider_key === 'string' ? body.provider_key.trim() : '';
      if (!providerKey) return jsonResp({ ok: false, error: 'provider_key_required' }, 400, origin);

      const { data: existing } = await adminClient
        .from('scraping_providers')
        .select('*')
        .eq('provider_key', providerKey)
        .maybeSingle();
      if (!existing) return jsonResp({ ok: false, error: 'provider_not_found' }, 404, origin);

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof body.enabled === 'boolean') patch.enabled = body.enabled;
      if (body.config_json && typeof body.config_json === 'object' && !Array.isArray(body.config_json)) {
        patch.config_json = { ...(existing.config_json || {}), ...(body.config_json as Record<string, unknown>) };
      }

      const { data, error } = await adminClient
        .from('scraping_providers')
        .update(patch)
        .eq('provider_key', providerKey)
        .select('*')
        .single();
      if (error) return jsonResp({ ok: false, error: error.message }, 400, origin);
      return jsonResp({ ok: true, provider: data }, 200, origin);
    }

    return jsonResp({ ok: false, error: 'invalid_sub_action' }, 400, origin);
  }

  return jsonResp({ ok: false, error: 'invalid_action' }, 400, origin);
});
