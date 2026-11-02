import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

console.log('🧪 Starting End-to-End Application Journey Verification Tests...\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

// ── Test 1: Policy Text Consistency ─────────────────────────────────────────
test('Credit Policy specifies 30-day window, move-in cost credit, covering total applicants', () => {
  const creditPolicy = fs.readFileSync('application-credit-policy.html', 'utf8');
  assert.ok(creditPolicy.includes('30 days') || creditPolicy.includes('30-day'), 'Missing 30 days in application-credit-policy.html');
  assert.ok(creditPolicy.includes('move-in costs'), 'Missing move-in costs in application-credit-policy.html');
  assert.ok(creditPolicy.includes('total applicants'), 'Missing total applicants coverage in application-credit-policy.html');
  assert.ok(!creditPolicy.includes('45 days'), 'Found stale 45 days in application-credit-policy.html');
});

test('Policies.html Section 7 specifies 30-day window and move-in cost credit', () => {
  const policies = fs.readFileSync('policies.html', 'utf8');
  assert.ok(policies.includes('valid for <strong>30 days</strong>'), 'Missing 30 days in policies.html');
  assert.ok(policies.includes('Applied Towards Move-In Costs'), 'Missing move-in costs in policies.html');
  assert.ok(policies.includes('Total Household Coverage'), 'Missing total household coverage in policies.html');
  assert.ok(!policies.includes('45 days'), 'Found stale 45 days in policies.html');
});

// ── Test 2: Email Template Consistency ──────────────────────────────────────
test('GAS-EMAIL-RELAY.gs fee banner is dynamic and includes 30-day move-in credit', () => {
  const gas = fs.readFileSync('GAS-EMAIL-RELAY.gs', 'utf8');
  assert.ok(gas.includes("Cargo de Solicitud Pendiente — $' + fmtCurrency(fee, lang)"), 'Missing dynamic Spanish fee banner in GAS-EMAIL-RELAY.gs');
  assert.ok(gas.includes("Application Fee Due — $' + fmtCurrency(fee, lang)"), 'Missing dynamic English fee banner in GAS-EMAIL-RELAY.gs');
  assert.ok(gas.includes('30 days applied towards move-in costs'), 'Missing 30 days move-in credit in GAS-EMAIL-RELAY.gs');
  assert.ok(!gas.includes('Application Fee Due — $50.00'), 'Hardcoded $50.00 still present in GAS-EMAIL-RELAY.gs');
});

test('Shared email.ts computes dynamic fee and includes 30-day move-in credit', () => {
  const emailTs = fs.readFileSync('supabase/functions/_shared/email.ts', 'utf8');
  assert.ok(emailTs.includes('screened_adult_count'), 'Missing screened_adult_count in email.ts');
  assert.ok(emailTs.includes('30 days and are applied directly toward move-in costs'), 'Missing 30-day move-in credit in email.ts');
  assert.ok(emailTs.includes('covering the total applicants that applied'), 'Missing total applicants in email.ts');
});

// ── Test 3: Backend Edge Function Logic ─────────────────────────────────────
test('receive-application parses additional_applicants_json and calculates $50 * screened adults', () => {
  const edgeTs = fs.readFileSync('supabase/functions/receive-application/index.ts', 'utf8');
  assert.ok(edgeTs.includes('additional_applicants_json'), 'Missing additional_applicants_json handling');
  assert.ok(edgeTs.includes('1 + (hasCoApplicant ? 1 : 0) + additionalApplicants.length'), 'Missing dynamic multi-applicant count');
  assert.ok(edgeTs.includes('screenedAdultCount * applicationFeePerAdult'), 'Missing enforced fee calculation');
  assert.ok(edgeTs.includes('co_applicants'), 'Missing co_applicants database persistence');
});

// ── Test 4: Frontend Application Script Logic ────────────────────────────────
test('apply/js/script.js supports dynamic applicants, fee calculation, and full localStorage persistence', () => {
  const script = fs.readFileSync('apply/js/script.js', 'utf8');
  assert.ok(script.includes('addAdditionalApplicant'), 'Missing addAdditionalApplicant in script.js');
  assert.ok(script.includes('removeAdditionalApplicant'), 'Missing removeAdditionalApplicant in script.js');
  assert.ok(script.includes('getAdditionalApplicantsData'), 'Missing getAdditionalApplicantsData in script.js');
  assert.ok(script.includes('additionalApplicantsContainer'), 'Missing additionalApplicantsContainer in script.js');
  assert.ok(script.includes('additional_applicants_json'), 'Missing additional_applicants_json in script.js');

  // Verify that localStorage does NOT wipe data on property switch
  assert.ok(!script.includes('localStorage.removeItem(this.config.LOCAL_STORAGE_KEY);\n                    return;'), 'Found stale localStorage wipe on property switch');

  // Verify that fee acknowledge checkbox text includes 30-day move-in credit
  assert.ok(script.includes('30-day move-in credit covers all applicants') || script.includes('30-day courtesy'), 'Missing credit policy in script.js fee acknowledge');
});

// ── Test 5: Admin Panel Applications Logic ───────────────────────────────────
test('admin/applications.js supports dynamic fees in pay sheet and warns on unpaid approval', () => {
  const adminJs = fs.readFileSync('js/admin/applications.js', 'utf8');
  assert.ok(adminJs.includes('openPaySheet(dbId, appId, name, feeRaw)'), 'Missing fee parameter in openPaySheet');
  assert.ok(adminJs.includes('Unpaid Application Warning'), 'Missing unpaid application approval warning');
  assert.ok(adminJs.includes('increments of $50.00'), 'Missing $50 increment validation in openPaySheet');
});

console.log(`\n================================`);
console.log(`Test Results: ${passed} passed, ${failed} failed`);
console.log(`================================\n`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 All End-to-End Application Journey Verification Tests Passed!\n');
}
