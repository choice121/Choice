// Choice Properties — Phase 01 tests for the templating engine.
//
// Run with:  deno test supabase/functions/_shared/__tests__/template-engine.test.ts
//
// These tests do not touch the database. The Supabase-backed partial
// resolver is exercised via a stub function so the engine itself stays
// unit-testable in isolation.

import { assertEquals, assertRejects, assertThrows } from 'https://deno.land/std@0.220.0/assert/mod.ts';
import {
  renderTemplate,
  renderTemplateSync,
  TemplateError,
  type PartialResolver,
} from '../template-engine.ts';

const ctx = {
  state_code: 'CA',
  monthly_rent: 2500,
  security_deposit: 2500,
  move_in_date: '2026-05-01',
  has_pets: true,
  utilities: [
    { name: 'electric', who: 'tenant' },
    { name: 'water',    who: 'landlord' },
  ],
};

// ─── Output / filters ─────────────────────────────────────────────────

Deno.test('plain output (no spaces)', async () => {
  assertEquals(await renderTemplate('Hi {{state_code}}!', ctx), 'Hi CA!');
});

Deno.test('plain output (with spaces)', async () => {
  assertEquals(await renderTemplate('Hi {{ state_code }}!', ctx), 'Hi CA!');
});

Deno.test('money filter', async () => {
  assertEquals(await renderTemplate('Rent: {{ monthly_rent | money }}', ctx), 'Rent: $2,500.00');
});

Deno.test('money filter empty', async () => {
  assertEquals(await renderTemplate('{{ missing | money }}', ctx), '');
});

Deno.test('date filter', async () => {
  assertEquals(await renderTemplate('{{ move_in_date | date }}', ctx), 'May 1, 2026');
});

Deno.test('default filter when missing', async () => {
  assertEquals(await renderTemplate('{{ missing | default:"N/A" }}', ctx), 'N/A');
});

Deno.test('default filter when empty string', async () => {
  assertEquals(await renderTemplate('{{ blank | default:"X" }}', { blank: '' }), 'X');
});

Deno.test('upper / lower filters', async () => {
  assertEquals(await renderTemplate('{{ state_code | lower }}', ctx), 'ca');
  assertEquals(await renderTemplate('{{ word | upper }}', { word: 'hello' }), 'HELLO');
});

Deno.test('escape_pdf strips smart quotes', async () => {
  const out = await renderTemplate('{{ s | escape_pdf }}', { s: 'he said \u201chi\u201d \u2014 ok' });
  assertEquals(out, 'he said "hi" - ok');
});

Deno.test('chained filters', async () => {
  assertEquals(await renderTemplate('{{ state_code | lower | upper }}', ctx), 'CA');
});

// ─── Strict mode ──────────────────────────────────────────────────────

Deno.test('non-strict missing var renders as empty', async () => {
  assertEquals(await renderTemplate('A{{ missing }}B', ctx), 'AB');
});

Deno.test('strict mode throws on missing var', async () => {
  await assertRejects(() => renderTemplate('{{ missing }}', ctx, { strict: true }), TemplateError);
});

Deno.test('strict mode allows missing if default filter present', async () => {
  assertEquals(await renderTemplate('{{ missing | default:"x" }}', ctx, { strict: true }), 'x');
});

// ─── If / elsif / else ────────────────────────────────────────────────

Deno.test('if matches state', async () => {
  const tpl = '{% if state_code == "CA" %}CA only{% else %}other{% endif %}';
  assertEquals(await renderTemplate(tpl, ctx), 'CA only');
  assertEquals(await renderTemplate(tpl, { state_code: 'TX' }), 'other');
});

Deno.test('elsif chain', async () => {
  const tpl = '{% if state_code == "TX" %}T{% elsif state_code == "CA" %}C{% else %}O{% endif %}';
  assertEquals(await renderTemplate(tpl, { state_code: 'TX' }), 'T');
  assertEquals(await renderTemplate(tpl, { state_code: 'CA' }), 'C');
  assertEquals(await renderTemplate(tpl, { state_code: 'NY' }), 'O');
});

Deno.test('and / or / not', async () => {
  const tpl = '{% if has_pets and state_code == "CA" %}pets+CA{% endif %}';
  assertEquals(await renderTemplate(tpl, ctx), 'pets+CA');
  const tpl2 = '{% if not has_pets %}none{% else %}some{% endif %}';
  assertEquals(await renderTemplate(tpl2, ctx), 'some');
  assertEquals(await renderTemplate(tpl2, { has_pets: false }), 'none');
});

Deno.test('numeric comparisons', async () => {
  const tpl = '{% if monthly_rent >= 1000 %}big{% else %}small{% endif %}';
  assertEquals(await renderTemplate(tpl, ctx), 'big');
  assertEquals(await renderTemplate(tpl, { monthly_rent: 500 }), 'small');
});

// ─── For loops ────────────────────────────────────────────────────────

Deno.test('for loop with forloop helpers', async () => {
  const tpl =
    '{% for u in utilities %}' +
    '{% if forloop.first %}[{% endif %}' +
    '{{ u.name }}={{ u.who }}{% if not forloop.last %}, {% endif %}' +
    '{% if forloop.last %}]{% endif %}' +
    '{% endfor %}';
  assertEquals(await renderTemplate(tpl, ctx), '[electric=tenant, water=landlord]');
});

Deno.test('for loop over non-array renders empty', async () => {
  assertEquals(await renderTemplate('{% for x in nope %}X{% endfor %}', {}), '');
});

// ─── Include / partials / cycles ──────────────────────────────────────

Deno.test('include with resolver', async () => {
  const partials: PartialResolver = (slug) =>
    Promise.resolve(slug === 'common/disclaimer' ? '<<DISC>>' : null);
  assertEquals(
    await renderTemplate('top {% include "common/disclaimer" %} bottom', {}, { partials }),
    'top <<DISC>> bottom',
  );
});

Deno.test('include without resolver throws', async () => {
  await assertRejects(() => renderTemplate('{% include "x" %}', {}), TemplateError);
});

Deno.test('include of unknown partial throws', async () => {
  const partials: PartialResolver = () => Promise.resolve(null);
  await assertRejects(() => renderTemplate('{% include "missing" %}', {}, { partials }), TemplateError);
});

Deno.test('cycle detection', async () => {
  const partials: PartialResolver = (slug) => {
    if (slug === 'a') return Promise.resolve('A {% include "b" %}');
    if (slug === 'b') return Promise.resolve('B {% include "a" %}');
    return Promise.resolve(null);
  };
  await assertRejects(() => renderTemplate('{% include "a" %}', {}, { partials }), TemplateError);
});

Deno.test('max include depth enforced', async () => {
  const partials: PartialResolver = (slug) => Promise.resolve(`X {% include "${slug}.next" %}`);
  // Even though the resolver returns content, depth caps before cycle detection triggers.
  await assertRejects(
    () => renderTemplate('{% include "x" %}', {}, { partials, maxIncludeDepth: 3 }),
    TemplateError,
  );
});

// ─── Comments ─────────────────────────────────────────────────────────

Deno.test('block comment stripped', async () => {
  assertEquals(await renderTemplate('A{% comment %}IGNORED{% endcomment %}B', {}), 'AB');
});

Deno.test('inline comment stripped', async () => {
  assertEquals(await renderTemplate('A{# x #}B', {}), 'AB');
});

// ─── Sync renderer ────────────────────────────────────────────────────

Deno.test('sync renderer works without includes', () => {
  assertEquals(renderTemplateSync('Hi {{ state_code }}', ctx), 'Hi CA');
});

Deno.test('sync renderer rejects includes', () => {
  assertThrows(() => renderTemplateSync('{% include "x" %}', {}), TemplateError);
});

// ─── Backward compat with seeded MI template syntax ───────────────────

Deno.test('legacy {{var}} (no spaces) renders identically to old substituteVars', async () => {
  // The seeded MI template uses bare {{tenant_full_name}} style references.
  // Build a synthetic body covering every var the old substituteVars
  // exposed. We don't import the legacy function (it's been replaced) —
  // we instead assert on known correct output values for these inputs.
  const app = {
    first_name: 'Jane', last_name: 'Doe',
    email: 'jane@example.com',
    monthly_rent: 1750,
    lease_start_date: '2026-05-01',
    lease_state_code: 'MI',
  };
  const expected =
    'Jane Doe / jane@example.com / $1,750.00 / May 1, 2026 / MI';
  const tpl = '{{tenant_full_name}} / {{tenant_email}} / {{monthly_rent}} / {{lease_start_date}} / {{state_code}}';
  // The body uses raw output; lease-context.ts is responsible for pre-formatting.
  // Mirror that behaviour here:
  const ctx2 = {
    tenant_full_name: 'Jane Doe',
    tenant_email:     'jane@example.com',
    monthly_rent:     '$1,750.00',
    lease_start_date: 'May 1, 2026',
    state_code:       'MI',
  };
  assertEquals(await renderTemplate(tpl, ctx2), expected);
  // Ensure the new engine accepts the un-spaced form universally
  assertEquals(await renderTemplate('x{{state_code}}y', ctx2), 'xMIy');
});
