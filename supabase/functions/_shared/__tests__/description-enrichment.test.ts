import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  enrichPropertyDescription,
  lintChoiceDescription,
  sanitizeBaselineDescription,
  STANDARD_APPLICATION_FEE_FOOTER,
} from '../description-enrichment.ts';

Deno.test('strips prohibited broker, deposit, lease, availability, and URL lines while preserving facts', async () => {
  const original =
    'Bright 3 bedroom, 2.5 bath home with hardwood floors, stainless kitchen appliances, and a fenced backyard. ' +
    'Security deposit is $1,800 due at signing. 12-month lease required. Available immediately! ' +
    'No smoking allowed. Pets are allowed with a $350 pet fee. ' +
    'Call Bob Smith at 405-555-0199 or visit https://zillow.com/homedetails/123 to schedule a showing. Application fee is $0.';

  const res = await enrichPropertyDescription(
    {
      original_description: original,
      bedrooms: 3,
      bathrooms: 2.5,
    },
    { useAi: false },
  );

  assertEquals(res.status, 'enriched');
  assertEquals(res.needs_review, false);
  assertEquals(res.original_description, original);
  assert(res.approved_description !== null);
  assert(res.approved_description.includes('hardwood floors'));
  assert(res.approved_description.includes('fenced backyard'));
  assert(res.approved_description.endsWith(STANDARD_APPLICATION_FEE_FOOTER));
  assert(!/deposit/i.test(res.approved_description));
  assert(!/12-month lease/i.test(res.approved_description));
  assert(!/available immediately/i.test(res.approved_description));
  assert(!/smoking/i.test(res.approved_description));
  assert(!/405-555-0199/.test(res.approved_description));
  assert(!/zillow\.com/i.test(res.approved_description));
  assert(!/\$0/i.test(res.approved_description));
  assert(res.changes.stripped_categories.length >= 6);
});

Deno.test('holds incomplete source description in needs_review without fabricating text', async () => {
  const res = await enrichPropertyDescription(
    {
      original_description: 'Available now! Call 405-555-1212.',
      bedrooms: 3,
      bathrooms: 2,
    },
    { useAi: false },
  );

  assertEquals(res.status, 'needs_review');
  assertEquals(res.needs_review, true);
  assertEquals(res.review_reason, 'enrichment_incomplete_source');
  assertEquals(res.approved_description, null);
});

Deno.test('holds contradictory bedroom count in needs_review', async () => {
  const res = await enrichPropertyDescription(
    {
      original_description:
        'Spacious 4 bedroom ranch home featuring granite countertops, updated fixtures, and a two-car garage.',
      bedrooms: 2,
      bathrooms: 2,
    },
    { useAi: false },
  );

  assertEquals(res.status, 'needs_review');
  assertEquals(res.needs_review, true);
  assertEquals(res.review_reason, 'enrichment_contradictory_source');
  assertEquals(res.approved_description, null);
});

Deno.test('lintChoiceDescription rejects AI output exceeding length variance or inventing numbers', () => {
  const { sanitized } = sanitizeBaselineDescription(
    'Cozy 3 bedroom brick house with central air, spacious living room, dining area, and private driveway.',
  );
  const bloated = sanitized + ' ' + 'Extra marketing fluff that was never in the original description. '.repeat(4);
  const varCheck = lintChoiceDescription(bloated, sanitized, 25);
  assertEquals(varCheck.ok, false);
  assert(varCheck.reason?.startsWith('length_variance_exceeded'));

  const invented = sanitized.replace('brick house', '1998 brick house');
  const numCheck = lintChoiceDescription(invented, sanitized, 25);
  assertEquals(numCheck.ok, false);
  assertEquals(numCheck.reason, 'invented_numeric_fact:1998');
});

Deno.test('sanitize_only mode preserves exact sanitized baseline without rewrite', async () => {
  const original =
    'Updated townhome with quartz countertops, open living area, and washer/dryer hookups in a quiet neighborhood.';
  const res = await enrichPropertyDescription(
    { original_description: original, bedrooms: 2, bathrooms: 2 },
    { rulesMap: { description_mode: 'sanitize_only' } },
  );

  assertEquals(res.status, 'enriched');
  assertEquals(res.mode, 'sanitize_only');
  assertEquals(res.model, 'sanitize-only');
  assertEquals(res.changes.variance_pct, 0);
  assertEquals(res.approved_description, `${original}\n\n${STANDARD_APPLICATION_FEE_FOOTER}`);
});
