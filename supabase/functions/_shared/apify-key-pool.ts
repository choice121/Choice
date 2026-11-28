// ============================================================================
// Choice Properties — Shared Apify Multi-Key Pool, Vault & Failover Engine
// ============================================================================
// Provides:
//   - AES-256-GCM encryption/decryption for admin-managed Apify API tokens
//   - SHA-256 token fingerprinting + masked suffix formatting
//   - Instant error classification (401/402/403/429 & Apify quota payloads)
//   - Live /v2/users/me/limits quota probing
//   - Hybrid pool resolution (encrypted DB keys + APIFY_API_TOKENS Edge secrets)
//   - Zero-delay failover request runner with persisted cooldown/exhausted state
// ============================================================================

const APIFY_BASE = 'https://api.apify.com/v2';
const TEXT_ENC = new TextEncoder();
const TEXT_DEC = new TextDecoder();

export type ApifyKeyStatus = 'active' | 'rate_limited' | 'exhausted' | 'invalid' | 'disabled';
export type ApifyKeySource = 'admin_pool' | 'edge_secret';

export interface ResolvedApifyKey {
  id: string | null;
  label: string;
  key_fingerprint: string;
  token: string;
  token_suffix: string;
  source: ApifyKeySource;
  priority: number;
  enabled: boolean;
  status: ApifyKeyStatus;
  cooldown_until: string | null;
  monthly_reset_at: string | null;
  usage_usd_cached: number | null;
  limit_usd_cached: number | null;
  apify_username: string | null;
  last_error: string | null;
  last_error_code: number | null;
  runs_started: number;
  active_runs?: number;
  failover_count: number;
  last_used_at: string | null;
  last_dispatched_at?: string | null;
  last_checked_at: string | null;
}

export interface MaskedApifyKey {
  id: string | null;
  label: string;
  key_fingerprint: string;
  token_suffix: string;
  source: ApifyKeySource;
  priority: number;
  enabled: boolean;
  status: ApifyKeyStatus;
  cooldown_until: string | null;
  monthly_reset_at: string | null;
  usage_usd_cached: number | null;
  limit_usd_cached: number | null;
  apify_username: string | null;
  last_error: string | null;
  last_error_code: number | null;
  runs_started: number;
  active_runs: number;
  failover_count: number;
  last_used_at: string | null;
  last_dispatched_at: string | null;
  last_checked_at: string | null;
  usable_now: boolean;
}

export interface FailoverEvent {
  from_fingerprint: string;
  from_suffix: string;
  from_label: string;
  reason: string;
  kind: ApifyFailureKind;
  status_code: number | null;
  at: string;
}

export type ApifyFailureKind =
  | 'invalid'
  | 'exhausted'
  | 'rate_limited'
  | 'transient'
  | 'bad_request'
  | 'actor_forbidden';

export interface ApifyQuotaProbeResult {
  ok: boolean;
  status: ApifyKeyStatus;
  status_code: number;
  apify_username: string | null;
  usage_usd: number | null;
  limit_usd: number | null;
  monthly_reset_at: string | null;
  error: string | null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.trim());
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function maskApifyToken(token: string): string {
  const clean = String(token || '').trim();
  if (clean.length <= 4) return '••••';
  return clean.slice(-4);
}

export async function fingerprintApifyToken(token: string): Promise<string> {
  const clean = String(token || '').trim();
  const digest = await crypto.subtle.digest('SHA-256', TEXT_ENC.encode(clean));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function derivePoolAesKey(explicitSecret?: string | null): Promise<CryptoKey> {
  const rawSecret = (
    explicitSecret ||
    Deno.env.get('APIFY_KEY_ENCRYPTION_SECRET') ||
    Deno.env.get('SSN_ENCRYPTION_KEY') ||
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
    ''
  ).trim();

  if (!rawSecret) {
    throw new Error('No server encryption secret configured for Apify key vault');
  }

  const domainInput = TEXT_ENC.encode(`choice-apify-key-pool-v1:${rawSecret}`);
  const hashed = await crypto.subtle.digest('SHA-256', domainInput);
  return await crypto.subtle.importKey(
    'raw',
    hashed,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptApifyToken(
  token: string,
  explicitSecret?: string | null,
): Promise<string> {
  const clean = String(token || '').trim();
  if (!clean) throw new Error('Cannot encrypt empty Apify token');
  const key = await derivePoolAesKey(explicitSecret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ctBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    TEXT_ENC.encode(clean),
  );
  return `v1:${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(ctBuf))}`;
}

export async function decryptApifyToken(
  encrypted: string,
  explicitSecret?: string | null,
): Promise<string> {
  if (!encrypted || !encrypted.startsWith('v1:')) {
    throw new Error('Unsupported encrypted Apify token format');
  }
  const parts = encrypted.split(':');
  if (parts.length !== 3) throw new Error('Malformed encrypted Apify token');
  const iv = base64ToBytes(parts[1]);
  const ct = base64ToBytes(parts[2]);
  const key = await derivePoolAesKey(explicitSecret);
  const ptBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return TEXT_DEC.decode(ptBuf);
}

export function getEnvApifyTokens(): string[] {
  const single = Deno.env.get('APIFY_API_TOKEN')?.trim();
  const multi =
    Deno.env.get('APIFY_API_TOKENS')
      ?.split(/[\r\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean) || [];
  const numbered: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const val = Deno.env.get(`APIFY_API_TOKEN_${i}`)?.trim();
    if (val) numbered.push(val);
  }
  const all = [single, ...multi, ...numbered].filter((x): x is string => Boolean(x));
  return Array.from(new Set(all));
}

export function nextUtcMonthStartIso(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return new Date(Date.UTC(y, m + 1, 1, 0, 5, 0)).toISOString();
}

export function classifyApifyFailure(
  statusCode: number,
  parsedBody: unknown,
  fallbackMessage = '',
): { kind: ApifyFailureKind; reason: string; cooldownSeconds: number | null } {
  const obj =
    parsedBody && typeof parsedBody === 'object' && !Array.isArray(parsedBody)
      ? (parsedBody as Record<string, unknown>)
      : {};
  const errObj =
    obj.error && typeof obj.error === 'object' && !Array.isArray(obj.error)
      ? (obj.error as Record<string, unknown>)
      : {};

  const errType = String(errObj.type || '').toLowerCase();
  const errMsg = String(errObj.message || obj.message || obj.statusMessage || fallbackMessage || '');
  const hay = `${errType} ${errMsg}`.toLowerCase();

  if (
    statusCode === 401 ||
    errType.includes('invalid-token') ||
    errType.includes('token-not-found') ||
    hay.includes('authentication token is not valid') ||
    hay.includes('invalid token')
  ) {
    return {
      kind: 'invalid',
      reason: errMsg || `Invalid Apify token (HTTP ${statusCode})`,
      cooldownSeconds: null,
    };
  }

  if (
    statusCode === 402 ||
    errType.includes('not-enough-usage') ||
    errType.includes('usage-limit') ||
    errType.includes('platform-feature-disabled') ||
    hay.includes('monthly usage') ||
    hay.includes('usage limit') ||
    hay.includes('hard limit') ||
    hay.includes('not enough usage') ||
    hay.includes('exceeded your') ||
    hay.includes('free plan limit') ||
    hay.includes('insufficient funds') ||
    hay.includes('credit limit')
  ) {
    return {
      kind: 'exhausted',
      reason: errMsg || `Apify monthly usage quota exceeded (HTTP ${statusCode})`,
      cooldownSeconds: null,
    };
  }

  if (statusCode === 403) {
    // 403 on Apify can be an actor rental/permission restriction (all keys will fail on that actor)
    // OR an account monthly quota/blocked token restriction.
    const hasAccountLimitSignal =
      hay.includes('account limit') ||
      hay.includes('usage limit') ||
      hay.includes('monthly usage') ||
      hay.includes('hard limit') ||
      hay.includes('free plan limit') ||
      hay.includes('credit limit');

    const isActorOnly =
      !hasAccountLimitSignal &&
      (hay.includes('must rent') ||
        hay.includes('subscription required') ||
        hay.includes('not allowed to run') ||
        hay.includes('insufficient permissions for the actor') ||
        hay.includes('actor-is-not-rented') ||
        hay.includes('actor-permission'));

    if (isActorOnly) {
      return {
        kind: 'actor_forbidden',
        reason: errMsg || `Apify actor requires rental/subscription (HTTP 403)`,
        cooldownSeconds: null,
      };
    }

    return {
      kind: 'exhausted',
      reason: errMsg || `Apify account forbidden / quota restricted (HTTP 403)`,
      cooldownSeconds: null,
    };
  }

  if (
    statusCode === 429 ||
    errType.includes('rate-limit') ||
    errType.includes('actor-memory-limit') ||
    hay.includes('too many requests') ||
    hay.includes('rate limit') ||
    hay.includes('concurrent') ||
    hay.includes('memory limit')
  ) {
    return {
      kind: 'rate_limited',
      reason: errMsg || `Apify rate or concurrency limit hit (HTTP ${statusCode})`,
      cooldownSeconds: 90,
    };
  }

  if (statusCode >= 500 || statusCode === 0) {
    return {
      kind: 'transient',
      reason: errMsg || `Apify transient server error (HTTP ${statusCode})`,
      cooldownSeconds: 15,
    };
  }

  return {
    kind: 'bad_request',
    reason: errMsg || `Apify HTTP ${statusCode}`,
    cooldownSeconds: null,
  };
}

export function isApifyRunQuotaFailure(apifyRun: Record<string, unknown>): {
  isQuotaFailure: boolean;
  kind: ApifyFailureKind;
  reason: string;
} {
  const statusMsg = String(apifyRun.statusMessage || apifyRun.exitCode || '').trim();
  const hay = statusMsg.toLowerCase();
  if (!hay) {
    return { isQuotaFailure: false, kind: 'transient', reason: 'Apify actor run failed without statusMessage' };
  }

  if (
    hay.includes('usage') ||
    hay.includes('limit') ||
    hay.includes('quota') ||
    hay.includes('memory') ||
    hay.includes('credit') ||
    hay.includes('billing') ||
    hay.includes('monthly') ||
    hay.includes('rent') ||
    hay.includes('trial')
  ) {
    const classified = classifyApifyFailure(402, { statusMessage: statusMsg }, statusMsg);
    return {
      isQuotaFailure: true,
      kind: classified.kind === 'bad_request' ? 'exhausted' : classified.kind,
      reason: statusMsg,
    };
  }

  return { isQuotaFailure: false, kind: 'transient', reason: statusMsg };
}

export function isKeyUsableNow(k: {
  enabled: boolean;
  status: ApifyKeyStatus;
  cooldown_until: string | null;
  monthly_reset_at: string | null;
  token?: string;
}, nowMs = Date.now()): boolean {
  if (!k.enabled) return false;
  if ('token' in k && !k.token) return false;
  if (k.status === 'disabled' || k.status === 'invalid') return false;
  if (k.status === 'exhausted') {
    if (k.monthly_reset_at && Date.parse(k.monthly_reset_at) <= nowMs) return true;
    return false;
  }
  if (k.status === 'rate_limited') {
    if (k.cooldown_until && Date.parse(k.cooldown_until) <= nowMs) return true;
    return false;
  }
  return k.status === 'active';
}

function hashSelectionSeed(seed: string, fingerprint: string): number {
  const input = `${seed}:${fingerprint}`;
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function orderCandidateKeys(
  keys: ResolvedApifyKey[],
  preferredFingerprint?: string | null,
  nowMs = Date.now(),
  selectionSeed?: string | null,
): ResolvedApifyKey[] {
  const usable = keys.filter((k) => isKeyUsableNow(k, nowMs));
  const cleanSeed = typeof selectionSeed === 'string' && selectionSeed.trim() ? selectionSeed.trim() : null;
  usable.sort((a, b) => {
    if (preferredFingerprint) {
      if (a.key_fingerprint === preferredFingerprint && b.key_fingerprint !== preferredFingerprint) return -1;
      if (b.key_fingerprint === preferredFingerprint && a.key_fingerprint !== preferredFingerprint) return 1;
    }
    const activeDiff = (a.active_runs || 0) - (b.active_runs || 0);
    if (activeDiff !== 0) return activeDiff;
    const startedDiff = (a.runs_started || 0) - (b.runs_started || 0);
    if (startedDiff !== 0) return startedDiff;
    if (cleanSeed) {
      const ha = hashSelectionSeed(cleanSeed, a.key_fingerprint);
      const hb = hashSelectionSeed(cleanSeed, b.key_fingerprint);
      if (ha !== hb) return ha - hb;
    }
    return a.priority - b.priority;
  });
  return usable;
}

export function toMaskedKey(k: ResolvedApifyKey, nowMs = Date.now()): MaskedApifyKey {
  return {
    id: k.id,
    label: k.label,
    key_fingerprint: k.key_fingerprint,
    token_suffix: k.token_suffix,
    source: k.source,
    priority: k.priority,
    enabled: k.enabled,
    status: k.status,
    cooldown_until: k.cooldown_until,
    monthly_reset_at: k.monthly_reset_at,
    usage_usd_cached: k.usage_usd_cached,
    limit_usd_cached: k.limit_usd_cached,
    apify_username: k.apify_username,
    last_error: k.last_error,
    last_error_code: k.last_error_code,
    runs_started: k.runs_started,
    active_runs: k.active_runs || 0,
    failover_count: k.failover_count,
    last_used_at: k.last_used_at,
    last_dispatched_at: k.last_dispatched_at ?? null,
    last_checked_at: k.last_checked_at,
    usable_now: isKeyUsableNow(k, nowMs),
  };
}

export async function probeApifyTokenLimits(token: string): Promise<ApifyQuotaProbeResult> {
  const clean = String(token || '').trim();
  if (!clean) {
    return {
      ok: false,
      status: 'invalid',
      status_code: 400,
      apify_username: null,
      usage_usd: null,
      limit_usd: null,
      monthly_reset_at: null,
      error: 'Empty Apify token',
    };
  }

  try {
    const [limitsRes, meRes] = await Promise.all([
      fetch(`${APIFY_BASE}/users/me/limits`, {
        headers: { Authorization: `Bearer ${clean}` },
        signal: AbortSignal.timeout(8_000),
      }),
      fetch(`${APIFY_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${clean}` },
        signal: AbortSignal.timeout(8_000),
      }).catch(() => null),
    ]);

    const meJson = meRes && meRes.ok ? await meRes.json().catch(() => null) : null;
    const username = meJson?.data?.username || meJson?.data?.email || null;

    const text = await limitsRes.text();
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }

    if (!limitsRes.ok) {
      const classified = classifyApifyFailure(limitsRes.status, parsed, `HTTP ${limitsRes.status}`);
      return {
        ok: false,
        status:
          classified.kind === 'invalid'
            ? 'invalid'
            : classified.kind === 'exhausted'
            ? 'exhausted'
            : classified.kind === 'rate_limited'
            ? 'rate_limited'
            : 'active',
        status_code: limitsRes.status,
        apify_username: username,
        usage_usd: null,
        limit_usd: null,
        monthly_reset_at: classified.kind === 'exhausted' ? nextUtcMonthStartIso() : null,
        error: classified.reason,
      };
    }

    const d = parsed?.data || {};
    const currentUsage =
      typeof d?.current?.monthlyUsageUsd === 'number'
        ? d.current.monthlyUsageUsd
        : null;
    const maxUsage =
      typeof d?.limits?.maxMonthlyUsageUsd === 'number'
        ? d.limits.maxMonthlyUsageUsd
        : null;
    const resetAt =
      typeof d?.monthlyUsageCycle?.endAt === 'string' && d.monthlyUsageCycle.endAt
        ? d.monthlyUsageCycle.endAt
        : nextUtcMonthStartIso();

    const isExhausted =
      currentUsage !== null &&
      maxUsage !== null &&
      maxUsage > 0 &&
      currentUsage >= maxUsage;

    return {
      ok: true,
      status: isExhausted ? 'exhausted' : 'active',
      status_code: 200,
      apify_username: username,
      usage_usd: currentUsage,
      limit_usd: maxUsage,
      monthly_reset_at: resetAt,
      error: isExhausted
        ? `Monthly usage limit reached ($${currentUsage.toFixed(2)} / $${maxUsage.toFixed(2)})`
        : null,
    };
  } catch (err) {
    return {
      ok: false,
      status: 'active',
      status_code: 0,
      apify_username: null,
      usage_usd: null,
      limit_usd: null,
      monthly_reset_at: null,
      error: err instanceof Error ? err.message : 'Apify probe timeout',
    };
  }
}

export async function resolveUnifiedKeyPool(
  adminClient: any,
): Promise<{ allKeys: ResolvedApifyKey[]; usableKeys: ResolvedApifyKey[] }> {
  // 1. Auto-promote any expired cooldowns / monthly resets before reading
  try {
    await adminClient.rpc('pipeline_apify_auto_recover_keys');
  } catch {
    // Non-fatal if migration hasn't applied yet
  }

  const byFingerprint = new Map<string, ResolvedApifyKey>();

  // 2. Load DB key pool rows
  const { data: dbRows, error: dbErr } = await adminClient
    .schema('pipeline')
    .from('apify_api_keys')
    .select('*')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true });

  if (!dbErr && Array.isArray(dbRows)) {
    for (const row of dbRows) {
      let token = '';
      if (row.encrypted_token) {
        try {
          token = await decryptApifyToken(String(row.encrypted_token));
        } catch {
          token = '';
        }
      }
      byFingerprint.set(String(row.key_fingerprint), {
        id: row.id,
        label: String(row.label || `Key ••••${row.token_suffix}`),
        key_fingerprint: String(row.key_fingerprint),
        token,
        token_suffix: String(row.token_suffix || '••••'),
        source: (row.source === 'edge_secret' ? 'edge_secret' : 'admin_pool'),
        priority: Number(row.priority ?? 100),
        enabled: Boolean(row.enabled),
        status: (row.status || 'active') as ApifyKeyStatus,
        cooldown_until: row.cooldown_until || null,
        monthly_reset_at: row.monthly_reset_at || null,
        usage_usd_cached: row.usage_usd_cached != null ? Number(row.usage_usd_cached) : null,
        limit_usd_cached: row.limit_usd_cached != null ? Number(row.limit_usd_cached) : null,
        apify_username: row.apify_username || null,
        last_error: row.last_error || null,
        last_error_code: row.last_error_code != null ? Number(row.last_error_code) : null,
        runs_started: Number(row.runs_started || 0),
        active_runs: Number(row.active_runs || 0),
        failover_count: Number(row.failover_count || 0),
        last_used_at: row.last_used_at || null,
        last_dispatched_at: row.last_dispatched_at || null,
        last_checked_at: row.last_checked_at || null,
      });
    }
  }

  // 3. Merge Edge Secret tokens (APIFY_API_TOKEN + APIFY_API_TOKENS + APIFY_API_TOKEN_1..20)
  const envTokens = getEnvApifyTokens();
  for (let idx = 0; idx < envTokens.length; idx++) {
    const token = envTokens[idx];
    const fp = await fingerprintApifyToken(token);
    const existing = byFingerprint.get(fp);
    if (existing) {
      if (!existing.token) existing.token = token;
      continue;
    }

    const suffix = maskApifyToken(token);
    const label = `Edge Secret #${idx + 1}`;
    const priority = 200 + idx;

    // Register metadata row for persistent cooldown tracking (without overwriting token if DB table exists)
    let insertedId: string | null = null;
    if (!dbErr) {
      try {
        const { data: upRow } = await adminClient
          .schema('pipeline')
          .from('apify_api_keys')
          .upsert(
            {
              label,
              key_fingerprint: fp,
              encrypted_token: null,
              token_suffix: suffix,
              source: 'edge_secret',
              priority,
              enabled: true,
              status: 'active',
            },
            { onConflict: 'key_fingerprint' },
          )
          .select('id')
          .maybeSingle();
        insertedId = upRow?.id || null;
      } catch {
        // Non-fatal
      }
    }

    byFingerprint.set(fp, {
      id: insertedId,
      label,
      key_fingerprint: fp,
      token,
      token_suffix: suffix,
      source: 'edge_secret',
      priority,
      enabled: true,
      status: 'active',
      cooldown_until: null,
      monthly_reset_at: null,
      usage_usd_cached: null,
      limit_usd_cached: null,
      apify_username: null,
      last_error: null,
      last_error_code: null,
      runs_started: 0,
      active_runs: 0,
      failover_count: 0,
      last_used_at: null,
      last_dispatched_at: null,
      last_checked_at: null,
    });
  }

  const allKeys = Array.from(byFingerprint.values()).sort((a, b) => a.priority - b.priority);
  const usableKeys = orderCandidateKeys(allKeys);
  return { allKeys, usableKeys };
}

export async function claimKeySlot(
  adminClient: any,
  keyFingerprint?: string | null,
): Promise<void> {
  if (!keyFingerprint) return;
  try {
    await adminClient.rpc('pipeline_apify_key_claim_slot', {
      p_key_fingerprint: keyFingerprint,
    });
  } catch {
    // Non-fatal fallback
  }
}

export async function releaseKeySlot(
  adminClient: any,
  keyFingerprint?: string | null,
): Promise<void> {
  if (!keyFingerprint) return;
  try {
    await adminClient.rpc('pipeline_apify_key_release_slot', {
      p_key_fingerprint: keyFingerprint,
    });
  } catch {
    // Non-fatal fallback
  }
}

export async function markKeyState(
  adminClient: any,
  key: ResolvedApifyKey,
  status: ApifyKeyStatus,
  opts: {
    errorCode?: number | null;
    error?: string | null;
    cooldownSeconds?: number | null;
    monthlyResetAt?: string | null;
    incrementFailover?: boolean;
  } = {},
): Promise<void> {
  key.status = status;
  key.last_error = opts.error || null;
  key.last_error_code = opts.errorCode ?? null;
  if (status === 'rate_limited') {
    key.cooldown_until = new Date(Date.now() + (opts.cooldownSeconds ?? 90) * 1000).toISOString();
  }
  if (status === 'exhausted') {
    key.monthly_reset_at = opts.monthlyResetAt || nextUtcMonthStartIso();
  }
  if (opts.incrementFailover) {
    key.failover_count = (key.failover_count || 0) + 1;
  }

  try {
    await adminClient.rpc('pipeline_apify_key_mark_state', {
      p_key_fingerprint: key.key_fingerprint,
      p_status: status,
      p_error_code: opts.errorCode ?? null,
      p_error: opts.error ?? null,
      p_cooldown_seconds: opts.cooldownSeconds ?? null,
      p_monthly_reset_at: opts.monthlyResetAt ?? null,
      p_increment_failover: Boolean(opts.incrementFailover),
    });
  } catch {
    // Non-fatal fallback if DB RPC unavailable
  }
}

export async function fetchApifyWithFailover(params: {
  adminClient: any;
  path: string;
  keys: ResolvedApifyKey[];
  preferredFingerprint?: string | null;
  selectionSeed?: string | null;
  method?: string;
  body?: unknown;
  recordUseOnSuccess?: boolean;
}): Promise<{
  ok: boolean;
  status: number;
  data: any;
  error?: string;
  usedKey: ResolvedApifyKey | null;
  failoverEvents: FailoverEvent[];
}> {
  const method = params.method || 'GET';
  const candidates = orderCandidateKeys(params.keys, params.preferredFingerprint, Date.now(), params.selectionSeed);
  const failoverEvents: FailoverEvent[] = [];

  if (candidates.length === 0) {
    return {
      ok: false,
      status: 429,
      data: null,
      error: 'All configured Apify API keys are currently exhausted, rate-limited, or disabled.',
      usedKey: null,
      failoverEvents,
    };
  }

  let lastStatus = 502;
  let lastError = 'Apify request failed';

  for (const candidate of candidates) {
    // Up to 2 attempts on the same key ONLY for transient 5xx/network hiccups;
    // quota/rate/auth limits fail over to the next key IMMEDIATELY with zero sleep!
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`${APIFY_BASE}${params.path}`, {
          method,
          headers: {
            Authorization: `Bearer ${candidate.token}`,
            ...(params.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          },
          body: params.body !== undefined ? JSON.stringify(params.body) : undefined,
          signal: AbortSignal.timeout(22_000),
        });

        const text = await res.text();
        let parsed: any = null;
        try {
          parsed = text ? JSON.parse(text) : null;
        } catch {
          parsed = text;
        }

        if (res.ok) {
          if (params.recordUseOnSuccess) {
            try {
              await params.adminClient.rpc('pipeline_apify_key_record_use', {
                p_key_fingerprint: candidate.key_fingerprint,
              });
            } catch {
              // Non-fatal
            }
          }
          return {
            ok: true,
            status: res.status,
            data: parsed,
            usedKey: candidate,
            failoverEvents,
          };
        }

        lastStatus = res.status;
        const classified = classifyApifyFailure(res.status, parsed);
        lastError = classified.reason;

        if (classified.kind === 'invalid' || classified.kind === 'exhausted' || classified.kind === 'rate_limited') {
          const nextStatus: ApifyKeyStatus =
            classified.kind === 'invalid'
              ? 'invalid'
              : classified.kind === 'exhausted'
              ? 'exhausted'
              : 'rate_limited';

          await markKeyState(params.adminClient, candidate, nextStatus, {
            errorCode: res.status,
            error: classified.reason,
            cooldownSeconds: classified.cooldownSeconds,
            incrementFailover: true,
          });

          failoverEvents.push({
            from_fingerprint: candidate.key_fingerprint,
            from_suffix: candidate.token_suffix,
            from_label: candidate.label,
            reason: classified.reason,
            kind: classified.kind,
            status_code: res.status,
            at: new Date().toISOString(),
          });
          // Instant failover: break inner attempt loop immediately with zero delay
          break;
        }

        if (classified.kind === 'transient' && attempt === 0) {
          await new Promise((r) => setTimeout(r, 350));
          continue;
        }

        if (classified.kind === 'bad_request' || classified.kind === 'actor_forbidden') {
          // 400 invalid actor input or 403 paid-actor rental restrictions apply to the actor/request
          // across every account; abort without marking healthy keys as exhausted.
          return {
            ok: false,
            status: res.status,
            data: parsed,
            error: lastError,
            usedKey: candidate,
            failoverEvents,
          };
        }

        // Transient failure exhausted on this key -> try next key
        failoverEvents.push({
          from_fingerprint: candidate.key_fingerprint,
          from_suffix: candidate.token_suffix,
          from_label: candidate.label,
          reason: classified.reason,
          kind: classified.kind,
          status_code: res.status,
          at: new Date().toISOString(),
        });
        break;
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Apify network timeout';
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 300));
          continue;
        }
        failoverEvents.push({
          from_fingerprint: candidate.key_fingerprint,
          from_suffix: candidate.token_suffix,
          from_label: candidate.label,
          reason: lastError,
          kind: 'transient',
          status_code: null,
          at: new Date().toISOString(),
        });
      }
    }
  }

  return {
    ok: false,
    status: lastStatus,
    data: null,
    error: lastError,
    usedKey: null,
    failoverEvents,
  };
}
