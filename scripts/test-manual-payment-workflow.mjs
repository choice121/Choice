#!/usr/bin/env node
/**
 * Choice Properties — Manual Payment Workflow Regression Suite
 * Verifies end-to-end reversion from card-checkout/Option A+B back to
 * manual payment preferences while preserving all Nov 15-16 non-payment features.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = process.cwd();
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL  ${name}\n  ${err.stack || err.message}`);
    process.exitCode = 1;
  }
}

test('Card checkout files & edge function are removed', () => {
  const removed = [
    'apply/pay.html',
    'apply/js/pay.js',
    'apply/css/pay.css',
    'functions/api/payments/[[path]].js',
    'lib/payment-router.js',
    'lib/payment-store.js',
    'docs/PAYMENT_FLOW_REQUIREMENTS.md',
    'scripts/test-payment-workflow.mjs',
    'supabase/functions/confirm-card-payment/index.ts',
  ];
  for (const rel of removed) {
    assert.equal(exists(rel), false, `Expected ${rel} to be removed`);
  }
});

test('302 redirects exist for legacy /apply/pay routes in _redirects and serve.js', () => {
  const redir = read('_redirects');
  assert.match(redir, /^\/apply\/pay\.html\s+\/tenant\/portal\.html\s+302/m);
  assert.match(redir, /^\/apply\/pay\s+\/tenant\/portal\.html\s+302/m);

  const serve = read('serve.js');
  assert.match(serve, /cleanUrl === '\/apply\/pay\.html' \|\| cleanUrl === '\/apply\/pay'/);
  assert.match(serve, /res\.writeHead\(302,\s*\{\s*Location:\s*`\/tenant\/portal\.html\$\{qs\}`/);
});

test('Frontend HouseholdRules calculates $50 Primary, $50 Co-Applicant, $50 additional', () => {
  const cpApiSrc = read('js/cp-api.js');
  const sandbox = {
    window: { location: { origin: 'https://choice-properties-site.pages.dev' }, addEventListener: () => {} },
    document: { addEventListener: () => {} },
    CONFIG: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon' },
    console,
  };
  sandbox.window.CP = {};
  const runnableCpApi = cpApiSrc.replace(/^\s*export\s+\{[^}]*\};?\s*$/gm, '');
  vm.runInNewContext(runnableCpApi, sandbox);
  const rules = sandbox.window.CP.HouseholdRules;
  assert.ok(rules, 'CP.HouseholdRules should be initialized');

  assert.equal(rules.calculateHouseholdApplicationFee([{ applicant_type: 'primary' }]).totalFee, 50);
  assert.equal(rules.calculateHouseholdApplicationFee([
    { applicant_type: 'primary' },
    { applicant_type: 'co_applicant' },
  ]).totalFee, 100, 'Occupying co-applicant is $50');
  assert.equal(rules.calculateHouseholdApplicationFee([
    { applicant_type: 'primary' },
    { applicant_type: 'co_applicant' },
    { applicant_type: 'co_applicant' },
  ]).totalFee, 150, '2 occupying co-applicants plus primary equals $150');
  assert.equal(rules.calculateHouseholdApplicationFee([
    { applicant_type: 'primary' },
    { applicant_type: 'co_applicant' },
    { applicant_type: 'guarantor' },
  ]).totalFee, 150, 'Primary + co-applicant + guarantor equals $150');
  assert.equal(rules.calculateHouseholdApplicationFee([
    { applicant_type: 'primary' },
    { applicant_type: 'co_applicant' },
    { applicant_type: 'co_signer' },
  ], { creditApplied: true }).totalFee, 0, 'Credit waives household total');
});

test('Backend _shared/application-rules.ts matches $50 per adult fee rules', () => {
  const rulesTs = read('supabase/functions/_shared/application-rules.ts');
  assert.match(rulesTs, /Occupying co-applicant screening \(\$50\)/);
});

test('Application form preserves manual payment dropdowns AND Nov 15-16 non-payment improvements', () => {
  const applyHtml = read('apply/index.html');
  assert.match(applyHtml, /id="primaryPaymentMethod"/);
  assert.match(applyHtml, /id="alternativePaymentMethod"/);
  assert.match(applyHtml, /id="thirdChoicePaymentMethod"/);
  assert.match(applyHtml, /Venmo/);
  assert.match(applyHtml, /Zelle/);
  assert.match(applyHtml, /Cash App/);
  assert.match(applyHtml, /Chime/);
  // Preserved Nov 15-16 features:
  assert.match(applyHtml, /last.?4|ssn/i);
  assert.ok(!applyHtml.includes('/apply/pay'), 'apply/index.html must not reference /apply/pay');
  assert.ok(!/Option\s+[AB]\b/i.test(applyHtml), 'apply/index.html must not contain Option A/B payment selector');

  const applyJs = read('apply/js/script.js');
  assert.ok(!applyJs.includes('/apply/pay'), 'apply/js/script.js must not redirect to /apply/pay');
  assert.match(applyJs, /Primary Payment Method/);
  assert.match(applyJs, /auto-login|tenant\/portal\.html/);
});

test('No leftover Option A/B, card checkout links, or 45-day credit copy in active frontend & docs', () => {
  const filesToScan = [
    'apply/index.html',
    'apply/start.html',
    'apply/js/start.js',
    'apply/js/script.js',
    'tenant/portal.html',
    'js/tenant/portal.js',
    'js/tenant/receipt.js',
    'js/tenant/co-applicant-consent.js',
    'co-applicant-consent.html',
    'admin/applications.html',
    'js/admin/applications.js',
    'js/admin/dashboard.js',
    'js/cp-copy.js',
    'faq.html',
    'how-to-apply.html',
    'policies.html',
    'rental-application-policy.html',
    'application-credit-policy.html',
    'docs/customer-support-ai/application-process.md',
    'docs/customer-support-ai/business-policies.md',
    'data/customer-memory/policies.json',
    'supabase/functions/_shared/email.ts',
    'supabase/functions/_shared/i18n.ts',
    'supabase/functions/receive-application/index.ts',
    'supabase/functions/send-co-applicant-consent/index.ts',
    'supabase/functions/confirm-co-applicant-screening/index.ts',
    'supabase/functions/get-tenant-portal-app/index.ts',
    'supabase/functions/nudge-expiring-drafts/index.ts',
  ];
  for (const rel of filesToScan) {
    const content = read(rel);
    assert.ok(!content.includes('/apply/pay'), `${rel} still contains /apply/pay`);
    assert.ok(!content.includes('/api/payments'), `${rel} still contains /api/payments`);
    assert.ok(!content.includes('confirm-card-payment'), `${rel} still contains confirm-card-payment`);
    assert.ok(!/\bOption\s+[AB]\b/i.test(content), `${rel} still contains Option A/B`);
    assert.ok(!/\b45[- ]days?\b/i.test(content), `${rel} still contains 45-day wording`);
  }
});

console.log(`\nAll ${passed} manual-payment regression tests passed.`);
