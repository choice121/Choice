import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  calculatePropertyRent,
  normalizeAndValidatePricingConfig,
} from '../pricing-engine.ts';

Deno.test('proportional_range computes exact formula endpoints, midpoint, and monotonicity', async () => {
  const cfgCheck = normalizeAndValidatePricingConfig({
    method: 'proportional_range',
    source_min: 1400,
    source_max: 1950,
    target_min: 1550,
    target_max: 1850,
  });
  assertEquals(cfgCheck.ok, true);

  const low = await calculatePropertyRent({ id: 'P1', original_monthly_rent: 1400 }, cfgCheck.normalized);
  assertEquals(low.pricing_status, 'calculated');
  assertEquals(low.calculated_rent, 1550);

  const mid = await calculatePropertyRent({ id: 'P2', original_monthly_rent: 1675 }, cfgCheck.normalized);
  assertEquals(mid.pricing_status, 'calculated');
  assertEquals(mid.calculated_rent, 1700);

  const high = await calculatePropertyRent({ id: 'P3', original_monthly_rent: 1950 }, cfgCheck.normalized);
  assertEquals(high.pricing_status, 'calculated');
  assertEquals(high.calculated_rent, 1850);
});

Deno.test('proportional_range rejects SourceMin === SourceMax with clarification error', () => {
  const invalid = normalizeAndValidatePricingConfig({
    method: 'proportional_range',
    source_min: 1600,
    source_max: 1600,
    target_min: 1550,
    target_max: 1850,
  });
  assertEquals(invalid.ok, false);
  assertEquals(invalid.error, 'invalid_source_range_clarification_required');
});

Deno.test('out-of-range OriginalRent routes property to held_out_of_range without altering rent', async () => {
  const cfgCheck = normalizeAndValidatePricingConfig({
    method: 'proportional_range',
    source_min: 1400,
    source_max: 1950,
    target_min: 1550,
    target_max: 1850,
  });
  const outLow = await calculatePropertyRent(
    { id: 'P4', original_monthly_rent: 1250, monthly_rent: 1250 },
    cfgCheck.normalized,
  );
  assertEquals(outLow.pricing_status, 'held_out_of_range');
  assertEquals(outLow.calculated_rent, null);

  const outHigh = await calculatePropertyRent(
    { id: 'P5', original_monthly_rent: 2300, monthly_rent: 2300 },
    cfgCheck.normalized,
  );
  assertEquals(outHigh.pricing_status, 'held_out_of_range');
  assertEquals(outHigh.calculated_rent, null);
});

Deno.test('re-running pricing on already calculated property is idempotent and preserves original_monthly_rent', async () => {
  const cfgCheck = normalizeAndValidatePricingConfig({
    method: 'proportional_range',
    source_min: 1400,
    source_max: 1950,
    target_min: 1550,
    target_max: 1850,
  });
  const first = await calculatePropertyRent(
    { id: 'P6', original_monthly_rent: 1675, monthly_rent: 1675 },
    cfgCheck.normalized,
  );
  assertEquals(first.calculated_rent, 1700);
  assertEquals(first.idempotent_skip, false);

  const second = await calculatePropertyRent(
    {
      id: 'P6',
      original_monthly_rent: 1675,
      monthly_rent: 1700,
      pricing_status: 'calculated',
      last_priced_hash: first.config_hash,
    },
    cfgCheck.normalized,
  );
  assertEquals(second.calculated_rent, 1700);
  assertEquals(second.idempotent_skip, true);
  assertEquals(second.audit_status, 'skipped_idempotent');
});

Deno.test('supports none, fixed, and individual_map pricing modes', async () => {
  const noneCfg = normalizeAndValidatePricingConfig({ method: 'none' }).normalized;
  const noneRes = await calculatePropertyRent({ id: 'P7', original_monthly_rent: 1525 }, noneCfg);
  assertEquals(noneRes.calculated_rent, 1525);

  const fixedCfg = normalizeAndValidatePricingConfig({ method: 'fixed', fixed_rent: 1795 }).normalized;
  const fixedRes = await calculatePropertyRent({ id: 'P8', original_monthly_rent: 1525 }, fixedCfg);
  assertEquals(fixedRes.calculated_rent, 1795);

  const mapCfg = normalizeAndValidatePricingConfig({
    method: 'individual_map',
    individual_map: { P9: 1690 },
  }).normalized;
  const mapFound = await calculatePropertyRent({ id: 'P9', original_monthly_rent: 1525 }, mapCfg);
  assertEquals(mapFound.pricing_status, 'calculated');
  assertEquals(mapFound.calculated_rent, 1690);

  const mapMissing = await calculatePropertyRent({ id: 'P10', original_monthly_rent: 1525 }, mapCfg);
  assertEquals(mapMissing.pricing_status, 'held_out_of_range');
});
