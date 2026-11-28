import assert from 'node:assert/strict';
import test from 'node:test';
import {
  orderCandidateKeys,
  type ResolvedApifyKey,
} from '../apify-key-pool.ts';
import {
  buildApifyActorInput,
  matchesTaskConfigFilters,
  normalizeApifyZillowItem,
  normalizeTaskConfigAliases,
} from '../apify-normalizer.ts';
import {
  calculatePropertyRent,
  normalizeAndValidatePricingConfig,
} from '../pricing-engine.ts';

function makeKey(overrides: Partial<ResolvedApifyKey> & { key_fingerprint: string; priority: number }): ResolvedApifyKey {
  return {
    id: overrides.id ?? null,
    label: overrides.label ?? `Key ${overrides.priority}`,
    key_fingerprint: overrides.key_fingerprint,
    token: overrides.token ?? `apify_token_${overrides.key_fingerprint}`,
    token_suffix: overrides.token_suffix ?? overrides.key_fingerprint.slice(-4),
    source: overrides.source ?? 'admin_pool',
    priority: overrides.priority,
    enabled: overrides.enabled ?? true,
    status: overrides.status ?? 'active',
    cooldown_until: overrides.cooldown_until ?? null,
    monthly_reset_at: overrides.monthly_reset_at ?? null,
    usage_usd_cached: null,
    limit_usd_cached: null,
    apify_username: null,
    last_error: null,
    last_error_code: null,
    runs_started: overrides.runs_started ?? 0,
    active_runs: overrides.active_runs ?? 0,
    failover_count: overrides.failover_count ?? 0,
    last_used_at: null,
    last_dispatched_at: null,
    last_checked_at: null,
  };
}

test('orderCandidateKeys prefers least-busy keys by active_runs, runs_started, and deterministic selectionSeed spread', () => {
  const keys: ResolvedApifyKey[] = [
    makeKey({ key_fingerprint: 'fp_alpha_1111', priority: 1, active_runs: 2, runs_started: 5 }),
    makeKey({ key_fingerprint: 'fp_beta_2222', priority: 2, active_runs: 0, runs_started: 3 }),
    makeKey({ key_fingerprint: 'fp_gamma_3333', priority: 3, active_runs: 0, runs_started: 0 }),
    makeKey({ key_fingerprint: 'fp_delta_4444', priority: 4, active_runs: 0, runs_started: 0 }),
    makeKey({ key_fingerprint: 'fp_epsil_5555', priority: 5, active_runs: 0, runs_started: 0 }),
    makeKey({ key_fingerprint: 'fp_zeta_6666', priority: 6, active_runs: 0, runs_started: 0 }),
  ];

  // Without selectionSeed: compatibility order is active_runs ASC -> runs_started ASC -> priority ASC
  const legacyOrder = orderCandidateKeys(keys, null, Date.now());
  assert.equal(legacyOrder[0].key_fingerprint, 'fp_gamma_3333');
  assert.equal(legacyOrder[legacyOrder.length - 1].key_fingerprint, 'fp_alpha_1111');
  assert.equal(legacyOrder[legacyOrder.length - 2].key_fingerprint, 'fp_beta_2222');

  // With distinct batch_id selectionSeeds across many jobs, idle 0/0 keys spread across distinct accounts
  const winners = new Set<string>();
  for (let b = 1000; b < 1030; b++) {
    const seeded = orderCandidateKeys(keys, null, Date.now(), String(b));
    assert.equal(seeded[0].active_runs, 0);
    assert.equal(seeded[0].runs_started, 0);
    winners.add(seeded[0].key_fingerprint);
  }
  assert.ok(winners.size >= 3, `Expected selectionSeed to spread across multiple idle keys, got ${winners.size}`);

  // Explicit preferredFingerprint overrides even active_runs sorting for run-key affinity
  const affinity = orderCandidateKeys(keys, 'fp_alpha_1111', Date.now(), '4821');
  assert.equal(affinity[0].key_fingerprint, 'fp_alpha_1111');
});

test('normalizeTaskConfigAliases maps common AI aliases cleanly without splitting City, ST strings', () => {
  const raw = {
    location: 'Yukon, OK',
    target_quantity: 12,
    rent_min: '1400',
    rent_max: '1950',
    bedrooms_exact: '3',
    bathrooms_min: '2.5',
    property_types: ['SINGLE_FAMILY'],
  };

  const normalized = normalizeTaskConfigAliases(raw);
  assert.deepEqual(normalized.locations, ['Yukon, OK']);
  assert.equal(normalized.target_qty, 12);
  assert.equal(normalized.min_rent, '1400');
  assert.equal(normalized.max_rent, '1950');
  assert.equal(normalized.exact_beds, '3');
  assert.equal(normalized.min_baths, '2.5');

  const actorInput = buildApifyActorInput(raw);
  const actorUrls = actorInput.searchUrls as Array<{ url: string }>;
  assert.equal(actorUrls.length, 1);
  assert.ok(actorUrls[0].url.startsWith('https://www.zillow.com/yukon-ok/rentals/?searchQueryState='));
  const qs = JSON.parse(new URL(actorUrls[0].url).searchParams.get('searchQueryState') || '{}');
  assert.equal(qs.filterState.isForRent.value, true);
  assert.deepEqual(qs.filterState.monthlyPayment, { min: 1400, max: 1950 });
  assert.deepEqual(qs.filterState.beds, { min: 3, max: 3 });
  assert.deepEqual(qs.filterState.baths, { min: 2.5 });
  assert.equal(qs.filterState.isSingleFamily.value, true);
  assert.equal(actorInput.resultsLimit, 36); // filtered headroom 3x target_qty=12

  const normProp = normalizeApifyZillowItem({
    zpid: 778899,
    detailUrl: 'https://www.zillow.com/homedetails/608-Maple-Ave/778899_zpid/',
    address: {
      streetAddress: '608 Maple Ave',
      city: 'Yukon',
      state: 'OK',
      zipcode: '73099',
    },
    price: '$1,595/mo',
    bedrooms: 3,
    bathrooms: 2.5,
    homeStatus: 'FOR_RENT',
    homeType: 'SINGLE_FAMILY',
    description: 'Clean home in Yukon with 2.5 baths and attached garage.',
    responsivePhotos: [
      { url: 'https://photos.zillowstatic.com/fp/a.jpg' },
      { url: 'https://photos.zillowstatic.com/fp/b.jpg' },
    ],
  });
  assert.equal(normProp.ok, true);
  if (!normProp.ok) throw new Error('expected valid normalized item');

  assert.equal(matchesTaskConfigFilters(normProp, raw).matches, true);
  assert.equal(matchesTaskConfigFilters(normProp, { ...raw, bedrooms_exact: 4 }).matches, false);
  assert.equal(matchesTaskConfigFilters(normProp, { ...raw, rent_min: 1700 }).matches, false);
});

test('normalizeAndValidatePricingConfig accepts proportional alias and source/target rent range aliases', async () => {
  const cfg = normalizeAndValidatePricingConfig({
    method: 'proportional',
    source_rent_min: 1400,
    source_rent_max: 1950,
    target_rent_min: 1550,
    target_rent_max: 1850,
  });

  assert.equal(cfg.ok, true);
  assert.equal(cfg.normalized.method, 'proportional_range');
  assert.equal(cfg.normalized.source_min, 1400);
  assert.equal(cfg.normalized.source_max, 1950);
  assert.equal(cfg.normalized.target_min, 1550);
  assert.equal(cfg.normalized.target_max, 1850);

  const mid = await calculatePropertyRent(
    { id: 'batch-prop-1', original_monthly_rent: 1675 },
    cfg.normalized,
  );
  assert.equal(mid.pricing_status, 'calculated');
  assert.equal(mid.calculated_rent, 1700);
});
