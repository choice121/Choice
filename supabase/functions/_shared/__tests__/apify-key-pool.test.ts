import {
  assertEquals,
  assertNotEquals,
} from 'https://deno.land/std@0.220.0/assert/mod.ts';
import {
  classifyApifyFailure,
  decryptApifyToken,
  encryptApifyToken,
  fetchApifyWithFailover,
  fingerprintApifyToken,
  isApifyRunQuotaFailure,
  isKeyUsableNow,
  maskApifyToken,
  orderCandidateKeys,
  type ResolvedApifyKey,
} from '../apify-key-pool.ts';

function makeKey(overrides: Partial<ResolvedApifyKey> = {}): ResolvedApifyKey {
  const token = overrides.token ?? 'apify_api_exampletoken1234';
  return {
    id: overrides.id ?? 'key-1',
    label: overrides.label ?? 'Key #1',
    key_fingerprint: overrides.key_fingerprint ?? 'fp-1',
    token,
    token_suffix: overrides.token_suffix ?? maskApifyToken(token),
    source: overrides.source ?? 'admin_pool',
    priority: overrides.priority ?? 100,
    enabled: overrides.enabled ?? true,
    status: overrides.status ?? 'active',
    cooldown_until: overrides.cooldown_until ?? null,
    monthly_reset_at: overrides.monthly_reset_at ?? null,
    usage_usd_cached: overrides.usage_usd_cached ?? null,
    limit_usd_cached: overrides.limit_usd_cached ?? null,
    apify_username: overrides.apify_username ?? null,
    last_error: overrides.last_error ?? null,
    last_error_code: overrides.last_error_code ?? null,
    runs_started: overrides.runs_started ?? 0,
    failover_count: overrides.failover_count ?? 0,
    last_used_at: overrides.last_used_at ?? null,
    last_checked_at: overrides.last_checked_at ?? null,
  };
}

function makeMockAdminClient() {
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  return {
    rpcCalls,
    async rpc(fn: string, args: Record<string, unknown> = {}) {
      rpcCalls.push({ fn, args });
      return { data: null, error: null };
    },
  };
}

Deno.test('AES-256-GCM encrypt/decrypt round-trip, fingerprinting, and masking', async () => {
  const secret = 'test-vault-encryption-secret-32-chars!!';
  const rawToken = 'apify_api_superSecretFreeTierToken9876';

  const encrypted = await encryptApifyToken(rawToken, secret);
  assertEquals(encrypted.startsWith('v1:'), true);
  assertNotEquals(encrypted.includes(rawToken), true);

  const decrypted = await decryptApifyToken(encrypted, secret);
  assertEquals(decrypted, rawToken);

  const fp1 = await fingerprintApifyToken(rawToken);
  const fp2 = await fingerprintApifyToken(`  ${rawToken}  `);
  assertEquals(fp1, fp2);
  assertEquals(fp1.length, 64);

  assertEquals(maskApifyToken(rawToken), '9876');
  assertEquals(maskApifyToken('abc'), '••••');
});

Deno.test('classifyApifyFailure categorizes 401, 402, 403, 429, 5xx, and 400 accurately', () => {
  const invalid = classifyApifyFailure(401, {
    error: { type: 'invalid-token', message: 'Authentication token is not valid' },
  });
  assertEquals(invalid.kind, 'invalid');

  const monthlyQuota = classifyApifyFailure(402, {
    error: { type: 'not-enough-usage', message: 'Monthly usage hard limit exceeded' },
  });
  assertEquals(monthlyQuota.kind, 'exhausted');

  const forbiddenQuota = classifyApifyFailure(403, {
    error: { message: 'Subscription required or account limit hit' },
  });
  assertEquals(forbiddenQuota.kind, 'exhausted');

  const rateLimit = classifyApifyFailure(429, {
    error: { type: 'rate-limit-exceeded', message: 'Too many requests' },
  });
  assertEquals(rateLimit.kind, 'rate_limited');
  assertEquals(rateLimit.cooldownSeconds, 90);

  const serverErr = classifyApifyFailure(503, { message: 'Upstream timeout' });
  assertEquals(serverErr.kind, 'transient');

  const badInput = classifyApifyFailure(400, {
    error: { type: 'invalid-input', message: 'Actor input searchUrls is malformed' },
  });
  assertEquals(badInput.kind, 'bad_request');
});

Deno.test('isApifyRunQuotaFailure detects mid-run quota aborts from statusMessage', () => {
  const quotaAbort = isApifyRunQuotaFailure({
    status: 'ABORTED',
    statusMessage: 'Run aborted because the monthly usage limit was exceeded',
  });
  assertEquals(quotaAbort.isQuotaFailure, true);
  assertEquals(quotaAbort.kind, 'exhausted');

  const actorCrash = isApifyRunQuotaFailure({
    status: 'FAILED',
    statusMessage: 'Unhandled TypeError inside page selector',
  });
  assertEquals(actorCrash.isQuotaFailure, false);
  assertEquals(actorCrash.kind, 'transient');
});

Deno.test('isKeyUsableNow and orderCandidateKeys handle cooldowns, resets, and preferred affinity', () => {
  const now = Date.parse('2026-11-21T12:00:00.000Z');
  const keys: ResolvedApifyKey[] = [
    makeKey({
      key_fingerprint: 'fp-exhausted-active-cycle',
      status: 'exhausted',
      monthly_reset_at: '2026-12-01T00:05:00.000Z',
      priority: 10,
    }),
    makeKey({
      key_fingerprint: 'fp-exhausted-expired-cycle',
      status: 'exhausted',
      monthly_reset_at: '2026-11-01T00:05:00.000Z',
      priority: 20,
    }),
    makeKey({
      key_fingerprint: 'fp-rate-limited-now',
      status: 'rate_limited',
      cooldown_until: '2026-11-21T12:01:00.000Z',
      priority: 5,
    }),
    makeKey({
      key_fingerprint: 'fp-rate-limited-expired',
      status: 'rate_limited',
      cooldown_until: '2026-11-21T11:59:00.000Z',
      priority: 30,
    }),
    makeKey({
      key_fingerprint: 'fp-disabled',
      enabled: false,
      status: 'active',
      priority: 1,
    }),
    makeKey({
      key_fingerprint: 'fp-preferred',
      status: 'active',
      priority: 50,
    }),
  ];

  assertEquals(isKeyUsableNow(keys[0], now), false);
  assertEquals(isKeyUsableNow(keys[1], now), true);
  assertEquals(isKeyUsableNow(keys[2], now), false);
  assertEquals(isKeyUsableNow(keys[3], now), true);
  assertEquals(isKeyUsableNow(keys[4], now), false);

  const orderedDefault = orderCandidateKeys(keys, null, now).map((k) => k.key_fingerprint);
  assertEquals(orderedDefault, [
    'fp-exhausted-expired-cycle',
    'fp-rate-limited-expired',
    'fp-preferred',
  ]);

  const orderedPreferred = orderCandidateKeys(keys, 'fp-preferred', now).map((k) => k.key_fingerprint);
  assertEquals(orderedPreferred[0], 'fp-preferred');
});

Deno.test('fetchApifyWithFailover switches instantly on 402/429 without delay', async () => {
  const originalFetch = globalThis.fetch;
  const adminClient = makeMockAdminClient();
  const attemptedAuthHeaders: string[] = [];

  const keys: ResolvedApifyKey[] = [
    makeKey({
      label: 'Primary Free Key',
      key_fingerprint: 'fp-primary',
      token: 'apify_api_primary_1111',
      token_suffix: '1111',
      priority: 10,
    }),
    makeKey({
      label: 'Rate Limited Key',
      key_fingerprint: 'fp-second',
      token: 'apify_api_second_2222',
      token_suffix: '2222',
      priority: 20,
    }),
    makeKey({
      label: 'Healthy Backup Key',
      key_fingerprint: 'fp-third',
      token: 'apify_api_third_3333',
      token_suffix: '3333',
      priority: 30,
    }),
  ];

  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    const auth = String((init?.headers as Record<string, string>)?.Authorization || '');
    attemptedAuthHeaders.push(auth);

    if (auth.includes('primary_1111')) {
      return new Response(
        JSON.stringify({
          error: { type: 'not-enough-usage', message: 'Monthly usage limit exceeded' },
        }),
        { status: 402, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (auth.includes('second_2222')) {
      return new Response(
        JSON.stringify({
          error: { type: 'rate-limit-exceeded', message: 'Too many concurrent runs' },
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ data: { id: 'actor-run-999', defaultDatasetId: 'ds-999', status: 'RUNNING' } }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  try {
    const res = await fetchApifyWithFailover({
      adminClient,
      path: '/acts/maxcopell~zillow-scraper/runs',
      method: 'POST',
      body: { maxItems: 10 },
      keys,
      recordUseOnSuccess: true,
    });

    assertEquals(res.ok, true);
    assertEquals(res.usedKey?.key_fingerprint, 'fp-third');
    assertEquals(res.failoverEvents.length, 2);
    assertEquals(res.failoverEvents[0].from_suffix, '1111');
    assertEquals(res.failoverEvents[0].kind, 'exhausted');
    assertEquals(res.failoverEvents[1].from_suffix, '2222');
    assertEquals(res.failoverEvents[1].kind, 'rate_limited');
    assertEquals(attemptedAuthHeaders.length, 3);
    assertEquals(keys[0].status, 'exhausted');
    assertEquals(keys[1].status, 'rate_limited');
    assertEquals(
      adminClient.rpcCalls.some(
        (c) => c.fn === 'pipeline_apify_key_record_use' && c.args.p_key_fingerprint === 'fp-third',
      ),
      true,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('fetchApifyWithFailover returns 429 when all keys are depleted and stops immediately on 400', async () => {
  const originalFetch = globalThis.fetch;
  const adminClient = makeMockAdminClient();
  let callCount = 0;

  globalThis.fetch = (async () => {
    callCount++;
    return new Response(
      JSON.stringify({ error: { type: 'invalid-input', message: 'Bad searchUrls field' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  try {
    const keys = [
      makeKey({ key_fingerprint: 'fp-a', token: 'apify_api_a', priority: 10 }),
      makeKey({ key_fingerprint: 'fp-b', token: 'apify_api_b', priority: 20 }),
    ];
    const badRes = await fetchApifyWithFailover({
      adminClient,
      path: '/acts/test/runs',
      method: 'POST',
      body: {},
      keys,
    });
    assertEquals(badRes.ok, false);
    assertEquals(badRes.status, 400);
    assertEquals(callCount, 1);
    assertEquals(badRes.failoverEvents.length, 0);

    const emptyRes = await fetchApifyWithFailover({
      adminClient,
      path: '/acts/test/runs',
      keys: [makeKey({ status: 'exhausted', monthly_reset_at: '2099-01-01T00:00:00Z' })],
    });
    assertEquals(emptyRes.ok, false);
    assertEquals(emptyRes.status, 429);
    assertEquals(emptyRes.usedKey, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
