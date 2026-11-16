/**
 * Automated verification suite for the Enhanced Application Payment & Alternative Method Workflow.
 * Verifies:
 *   1. Preservation of /apply/index.html -> /apply/pay.html?app_id=... handoff and removal of legacy 3-option form controls
 *   2. Presence & structure of /apply/pay.html, /apply/css/pay.css, /apply/js/pay.js (card checkout, multi-stage processing overlay, failure modal popup, inline notice, confirmation/assistance views)
 *   3. Cloudflare Pages /api/payments/[[path]].js parity with Node router
 *   4. Payment API endpoints (/api/payments/*):
 *        - GET  /api/payments/config (default mode: 'alternative_workflow', cardProcessing.available === false, 7 states, Apple Pay unconfigured)
 *        - POST /api/payments/session & GET /api/payments/session (Option A $150 & Option B $100 -> $50 share)
 *        - Security guard rejecting raw card_number / cvv (HTTP 400 raw_card_rejected)
 *        - Unavailable card enforcement (HTTP 503 card_processing_unavailable on both /process and /select-method card, preserves unpaid state & app_id)
 *        - Unconfigured alternative method rejection (HTTP 400 method_not_configured for apple_pay)
 *        - Select configured alternative method (POST /api/payments/select-method -> 'Payment Method Selected', stays unpaid)
 *        - External payment submission validation & state separation (POST /api/payments/submit-external requires attestation; valid submission -> 'Payment Submitted for Verification', payment_status strictly remains 'unpaid')
 *        - Cancel payment flow (POST /api/payments/cancel -> 'Payment Cancelled', preserves app_id & unpaid state)
 *        - Assistance escalation (POST /api/payments/assistance -> 'Payment Assistance Required')
 *        - $0.00 fee waiver via /api/payments/process -> 'Payment Confirmed' / 'waived'
 *        - Isolated live-card-gateway regression (decline 402 -> tokenized retry recovery 200 -> 'Payment Confirmed')
 *        - Unauthenticated /api/payments/ledger -> 401
 *   5. Admin & Tenant UI support for all 7 canonical states + Not Approved + $50/adult fee policy
 *   6. Raw PAN/CVV never leaked to persisted ledger
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const LEDGER_PATH = path.join(ROOT, 'data', 'customer-memory', 'payments.json');
const {
  handlePaymentApi,
  PAYMENT_STATES,
  RECOMMENDED_FAILURE_MESSAGE,
  CARD_UNAVAILABLE_MESSAGE,
} = require('../lib/payment-router.js');

const EXPECTED_CANONICAL_STATES = [
  PAYMENT_STATES.REQUIRED,
  PAYMENT_STATES.METHOD_SELECTED,
  PAYMENT_STATES.AWAITING,
  PAYMENT_STATES.SUBMITTED_FOR_VERIFICATION,
  PAYMENT_STATES.CONFIRMED,
  PAYMENT_STATES.UNSUCCESSFUL,
  PAYMENT_STATES.CANCELLED,
];

async function request(baseUrl, method, urlPath, body) {
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function run() {
  console.log('1. Checking /apply/ handoff and legacy payment selection removal...');
  const applyHtml = fs.readFileSync(path.join(ROOT, 'apply', 'index.html'), 'utf8');
  const applyJs = fs.readFileSync(path.join(ROOT, 'apply', 'js', 'script.js'), 'utf8');
  for (const forbidden of [
    'primaryPayment',
    'secondaryPayment',
    'thirdPayment',
    'primaryPaymentOther',
    'secondaryPaymentOther',
    'thirdPaymentOther',
    'paymentDuplicateWarning',
    'summaryPaymentPrefs',
    'Resident Billing Allocation',
  ]) {
    assert(!applyHtml.includes(forbidden), `apply/index.html still contains legacy reference: ${forbidden}`);
    assert(!applyJs.includes(forbidden), `apply/js/script.js still contains legacy reference: ${forbidden}`);
  }
  assert(
    applyJs.includes('/apply/pay.html?app_id='),
    'apply/js/script.js must redirect to /apply/pay.html?app_id=...'
  );

  console.log('2. Checking enhanced payment portal assets...');
  const payHtml = fs.readFileSync(path.join(ROOT, 'apply', 'pay.html'), 'utf8');
  const payCss = fs.readFileSync(path.join(ROOT, 'apply', 'css', 'pay.css'), 'utf8');
  const payJs = fs.readFileSync(path.join(ROOT, 'apply', 'js', 'pay.js'), 'utf8');
  for (const requiredId of [
    'id="paymentStatusBanner"',
    'id="cardPaymentForm"',
    'id="cardholderName"',
    'id="cardNumberInput"',
    'id="cardExpiryInput"',
    'id="cardCvvInput"',
    'id="billingZipInput"',
    'id="processingOverlay"',
    'id="inlineCardNotice"',
    'id="dismissInlineNoticeBtn"',
    'id="cardErrorModal"',
    'id="closeCardErrorModalBtn"',
    'id="dismissCardErrorModalBtn"',
    'id="verificationPendingPanel"',
    'id="cancelledPanel"',
    'id="resumePaymentBtn"',
    'id="tryAnotherCardBtn"',
    'id="contactSupportBtn"',
  ]) {
    assert(payHtml.includes(requiredId), `pay.html missing expected element ${requiredId}`);
  }
  for (const unwanted of [
    'Demonstration Mode',
    'presetValidBtn',
    'presetDeclineBtn',
    'js.stripe.com',
    'stripeElements',
    'cardUnavailableOptionView',
    'switchToAltFooterBtn',
    'switchToAlternativesQuickBtn',
  ]) {
    assert(!payHtml.includes(unwanted), `pay.html should not contain ${unwanted}`);
  }
  for (const unwantedJs of ['Demonstration Mode', 'presetValidBtn', 'presetDeclineBtn', 'js.stripe.com', 'stripeElements']) {
    assert(!payJs.includes(unwantedJs), `pay.js should not contain ${unwantedJs}`);
  }
  assert(payCss.includes('tabular-nums'), 'pay.css missing tabular-nums financial formatting');
  assert(payCss.includes('.cp-modal-card'), 'pay.css missing failure modal styling');
  assert(payCss.includes('.inline-card-notice'), 'pay.css missing inline card notice styling');
  assert(payJs.includes('Payment Submitted for Verification'), 'pay.js missing verification state label');
  assert(payJs.includes('Payment Method Selected'), 'pay.js missing method selected state label');

  // Verify complete card payment interface always renders first & displays transparent failure modal on 503/402
  assert(
    payHtml.includes('Card Payment Could Not Be Completed') && payHtml.includes('Not a Bank Decline'),
    'pay.html must transparently communicate disabled card checkout as not a bank decline'
  );
  assert(
    CARD_UNAVAILABLE_MESSAGE.toLowerCase().includes('not a bank decline') &&
      CARD_UNAVAILABLE_MESSAGE.toLowerCase().includes('disabled'),
    'CARD_UNAVAILABLE_MESSAGE must transparently state online card checkout is disabled and not a bank decline'
  );
  assert(
    payJs.includes("cardForm.style.display = 'block'") &&
      payJs.includes("if ($('altPaymentPanel')) $('altPaymentPanel').style.display = 'none'") &&
      payJs.includes('showCardErrorModal('),
    'pay.js must show the card form first, keep #altPaymentPanel hidden, and show the failure modal popup when card checkout is disabled'
  );

  console.log('2b. Checking Cloudflare Pages /api/payments/[[path]].js parity...');
  const cfMod = await import(path.join(ROOT, 'functions', 'api', 'payments', '[[path]].js'));
  assert.strictEqual(typeof cfMod.onRequest, 'function', 'CF payments function must export onRequest');
  const cfCfgRes = await cfMod.onRequest({
    request: new Request('https://example.com/api/payments/config', { method: 'GET' }),
    env: {},
  });
  assert.strictEqual(cfCfgRes.status, 200);
  const cfCfg = await cfCfgRes.json();
  assert.strictEqual(cfCfg.mode, 'alternative_workflow');
  assert.strictEqual(cfCfg.cardProcessing.available, false);
  assert.deepStrictEqual(cfCfg.states, EXPECTED_CANONICAL_STATES);
  const cfApple = cfCfg.alternativeMethods.find((m) => m.id === 'apple_pay');
  const cfCashApp = cfCfg.alternativeMethods.find((m) => m.id === 'cash_app');
  assert(cfApple && cfApple.available === false, 'Apple Pay should be unconfigured when no merchant config is provided');
  assert(cfCashApp && cfCashApp.available === true, 'Cash App coordinator routing should be available by default');

  console.log('3. Testing /api/payments/* workflow against ephemeral HTTP server...');
  const hadLedgerBefore = fs.existsSync(LEDGER_PATH);
  const ledgerBackup = hadLedgerBefore ? fs.readFileSync(LEDGER_PATH, 'utf8') : null;
  const savedLiveFlag = process.env.LIVE_CARD_PROCESSOR_ENABLED;
  const savedStripeKey = process.env.STRIPE_SECRET_KEY;
  const savedSquareToken = process.env.SQUARE_ACCESS_TOKEN;
  const savedAppleHandle = process.env.PAYMENT_APPLE_PAY_HANDLE;
  const savedAppleMerch = process.env.APPLE_PAY_MERCHANT_ID;

  delete process.env.LIVE_CARD_PROCESSOR_ENABLED;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.SQUARE_ACCESS_TOKEN;
  delete process.env.PAYMENT_APPLE_PAY_HANDLE;
  delete process.env.APPLE_PAY_MERCHANT_ID;

  const testAppId = `APP-TESTPAY-${Date.now()}`;
  const server = http.createServer((req, res) => handlePaymentApi(req, res));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // Config check (default unconfigured card gateway)
    const cfg = await request(baseUrl, 'GET', '/api/payments/config');
    assert.strictEqual(cfg.status, 200);
    assert.strictEqual(cfg.data.ok, true);
    assert.strictEqual(cfg.data.mode, 'alternative_workflow');
    assert.strictEqual(cfg.data.cardProcessing.available, false);
    assert.strictEqual(cfg.data.cardProcessing.reason, CARD_UNAVAILABLE_MESSAGE);
    assert.strictEqual(cfg.data.feePolicy.primary, 50);
    assert.strictEqual(cfg.data.feePolicy.firstCoApplicant, 50);
    assert.strictEqual(cfg.data.feePolicy.additionalMember, 50);
    assert.deepStrictEqual(cfg.data.states, EXPECTED_CANONICAL_STATES);
    const cfgApple = cfg.data.alternativeMethods.find((m) => m.id === 'apple_pay');
    const cfgCash = cfg.data.alternativeMethods.find((m) => m.id === 'cash_app');
    const cfgPaypal = cfg.data.alternativeMethods.find((m) => m.id === 'paypal');
    const cfgVenmo = cfg.data.alternativeMethods.find((m) => m.id === 'venmo');
    assert(cfgApple && cfgApple.available === false && cfgApple.configured === false);
    assert(cfgCash && cfgCash.available === true && cfgPaypal && cfgPaypal.available === true && cfgVenmo && cfgVenmo.available === true);

    // Register Option A (Centralized) session: Primary ($50) + Co-Applicant ($50) + Guarantor ($50) = $150
    const createSess = await request(baseUrl, 'POST', '/api/payments/session', {
      app_id: testAppId,
      first_name: 'Jordan',
      last_name: 'Rivera',
      applicant_name: 'Jordan Rivera',
      email: 'jordan.rivera@example.com',
      property_address: '608 Maple Ave, Yukon, OK 73099',
      household_payment_mode: 'centralized',
      application_fee: 150,
      fee_breakdown: [
        { applicant_index: 0, name: 'Jordan Rivera', role_label: 'Primary Applicant', fee: 50 },
        { applicant_index: 1, name: 'Sam Rivera', role_label: 'Occupying Co-Applicant', fee: 50 },
        { applicant_index: 2, name: 'Pat Rivera', role_label: 'Guarantor', fee: 50 },
      ],
    });
    assert.strictEqual(createSess.status, 200);
    assert.strictEqual(createSess.data.session.application_payment_state, PAYMENT_STATES.REQUIRED);
    assert.strictEqual(createSess.data.session.application_fee, 150);
    assert.strictEqual(createSess.data.session.household_payment_mode, 'centralized');

    // Fetch session
    const getSess = await request(baseUrl, 'GET', `/api/payments/session?app_id=${encodeURIComponent(testAppId)}`);
    assert.strictEqual(getSess.status, 200);
    assert.strictEqual(getSess.data.session.app_id, testAppId);
    assert.strictEqual(getSess.data.session.fee_breakdown.length, 3);
    assert.strictEqual(getSess.data.session.amount_due_now, 150);

    // Reject raw card data even before gateway check
    const rawReject = await request(baseUrl, 'POST', '/api/payments/process', {
      app_id: testAppId,
      cardholder_name: 'Jordan Rivera',
      card_number: '4111111111111111',
      cvv: '123',
    });
    assert.strictEqual(rawReject.status, 400);
    assert.strictEqual(rawReject.data.code, 'raw_card_rejected');

    // Card unavailable enforcement on /process
    const unavailProcess = await request(baseUrl, 'POST', '/api/payments/process', {
      app_id: testAppId,
      cardholder_name: 'Jordan Rivera',
      payment_token: 'tok_card_4242_test',
      card_meta: { brand: 'Visa', last4: '4242', exp_month: 12, exp_year: 2030 },
    });
    assert.strictEqual(unavailProcess.status, 503);
    assert.strictEqual(unavailProcess.data.ok, false);
    assert.strictEqual(unavailProcess.data.code, 'card_processing_unavailable');
    assert.strictEqual(unavailProcess.data.card_unavailable, true);
    assert.strictEqual(unavailProcess.data.session.payment_status, 'unpaid');
    assert.strictEqual(unavailProcess.data.session.amount_due_now, 150);

    // Card unavailable enforcement on /select-method card
    const unavailSelect = await request(baseUrl, 'POST', '/api/payments/select-method', {
      app_id: testAppId,
      method: 'card',
    });
    assert.strictEqual(unavailSelect.status, 503);
    assert.strictEqual(unavailSelect.data.code, 'card_processing_unavailable');
    assert.strictEqual(unavailSelect.data.session.app_id, testAppId);
    assert.strictEqual(unavailSelect.data.session.payment_status, 'unpaid');

    // Reject unconfigured alternative method (apple_pay)
    const unconfSelect = await request(baseUrl, 'POST', '/api/payments/select-method', {
      app_id: testAppId,
      method: 'apple_pay',
    });
    assert.strictEqual(unconfSelect.status, 400);
    assert.strictEqual(unconfSelect.data.code, 'method_not_configured');

    // Select configured alternative method (cash_app) -> Payment Method Selected
    const selectCash = await request(baseUrl, 'POST', '/api/payments/select-method', {
      app_id: testAppId,
      method: 'cash_app',
    });
    assert.strictEqual(selectCash.status, 200);
    assert.strictEqual(selectCash.data.ok, true);
    assert.strictEqual(selectCash.data.selected_method, 'cash_app');
    assert.strictEqual(selectCash.data.session.selected_payment_method, 'cash_app');
    assert.strictEqual(selectCash.data.session.application_payment_state, PAYMENT_STATES.METHOD_SELECTED);
    assert.strictEqual(selectCash.data.session.payment_status, 'unpaid');
    assert.strictEqual(selectCash.data.session.amount_due_now, 150);

    // Submit external without attestation -> 400
    const missingAck = await request(baseUrl, 'POST', '/api/payments/submit-external', {
      app_id: testAppId,
      method: 'cash_app',
      external_reference: 'CASH-88123',
      confirmed_external: false,
    });
    assert.strictEqual(missingAck.status, 400);

    // Submit external unconfigured method -> 400
    const unconfSubmit = await request(baseUrl, 'POST', '/api/payments/submit-external', {
      app_id: testAppId,
      method: 'apple_pay',
      external_reference: 'AP-0001',
      confirmed_external: true,
    });
    assert.strictEqual(unconfSubmit.status, 400);
    assert.strictEqual(unconfSubmit.data.code, 'method_not_configured');

    // Submit external configured method -> Payment Submitted for Verification (remains unpaid!)
    const submitExt = await request(baseUrl, 'POST', '/api/payments/submit-external', {
      app_id: testAppId,
      method: 'cash_app',
      external_reference: 'CASH-99421',
      payer_handle: '$jrivera',
      note: 'Sent full household balance',
      confirmed_external: true,
    });
    assert.strictEqual(submitExt.status, 200);
    assert.strictEqual(submitExt.data.ok, true);
    assert.strictEqual(submitExt.data.verification_pending, true);
    assert(submitExt.data.transaction_ref.startsWith('CP-EXT-'));
    assert.strictEqual(submitExt.data.session.application_payment_state, PAYMENT_STATES.SUBMITTED_FOR_VERIFICATION);
    assert.strictEqual(submitExt.data.session.payment_status, 'unpaid', 'External verification submission must NEVER mark payment_status paid');
    assert.strictEqual(submitExt.data.session.selected_payment_method, 'cash_app');
    assert.strictEqual(submitExt.data.session.external_payment_reference, 'CASH-99421');
    assert.strictEqual(submitExt.data.session.app_id, testAppId);

    // Cancel flow preserves app_id & unpaid status
    const cancelRes = await request(baseUrl, 'POST', '/api/payments/cancel', {
      app_id: testAppId,
      reason: 'Applicant switching method later',
    });
    assert.strictEqual(cancelRes.status, 200);
    assert.strictEqual(cancelRes.data.cancelled, true);
    assert.strictEqual(cancelRes.data.session.application_payment_state, PAYMENT_STATES.CANCELLED);
    assert.strictEqual(cancelRes.data.session.payment_status, 'unpaid');
    assert.strictEqual(cancelRes.data.session.app_id, testAppId);

    // Assistance escalation
    const assistRes = await request(baseUrl, 'POST', '/api/payments/assistance', {
      app_id: testAppId,
      note: 'Needs Leasing Desk assistance completing Venmo transfer.',
    });
    assert.strictEqual(assistRes.status, 200);
    assert.strictEqual(assistRes.data.session.application_payment_state, PAYMENT_STATES.ASSISTANCE);
    assert.strictEqual(assistRes.data.session.payment_assistance_required, true);

    // $0.00 fee waiver path succeeds with Payment Confirmed / waived
    const waiveAppId = `APP-TESTWAIVE-${Date.now()}`;
    await request(baseUrl, 'POST', '/api/payments/session', {
      app_id: waiveAppId,
      applicant_name: 'Fee Credit Applicant',
      property_address: '100 Main St, Yukon, OK 73099',
      application_fee: 0,
      credit_applied: true,
    });
    const waiveRes = await request(baseUrl, 'POST', '/api/payments/process', {
      app_id: waiveAppId,
    });
    assert.strictEqual(waiveRes.status, 200);
    assert.strictEqual(waiveRes.data.session.payment_status, 'waived');
    assert.strictEqual(waiveRes.data.session.application_payment_state, PAYMENT_STATES.CONFIRMED);

    // Isolated live-card gateway regression check (temporarily enable gateway in process.env)
    const liveAppId = `APP-TESTLIVE-${Date.now()}`;
    process.env.LIVE_CARD_PROCESSOR_ENABLED = 'true';
    process.env.STRIPE_SECRET_KEY = 'sk_test_regression_only';
    try {
      const liveCfg = await request(baseUrl, 'GET', '/api/payments/config');
      assert.strictEqual(liveCfg.data.mode, 'card_gateway');
      assert.strictEqual(liveCfg.data.cardProcessing.available, true);

      await request(baseUrl, 'POST', '/api/payments/session', {
        app_id: liveAppId,
        applicant_name: 'Live Card Tester',
        property_address: '608 Maple Ave, Yukon, OK 73099',
        application_fee: 50,
      });

      const declineRes = await request(baseUrl, 'POST', '/api/payments/process', {
        app_id: liveAppId,
        cardholder_name: 'Live Card Tester',
        payment_token: 'tok_decline_0002_test',
        card_meta: { brand: 'Visa', last4: '0002', exp_month: 12, exp_year: 2030 },
      });
      assert.strictEqual(declineRes.status, 402);
      assert.strictEqual(declineRes.data.message, RECOMMENDED_FAILURE_MESSAGE);
      assert.strictEqual(declineRes.data.session.application_payment_state, PAYMENT_STATES.UNSUCCESSFUL);
      assert.strictEqual(declineRes.data.session.payment_status, 'unpaid');

      const okRes = await request(baseUrl, 'POST', '/api/payments/process', {
        app_id: liveAppId,
        cardholder_name: 'Live Card Tester',
        payment_token: 'tok_card_4242_test',
        card_meta: { brand: 'Visa', last4: '4242', exp_month: 12, exp_year: 2030 },
      });
      assert.strictEqual(okRes.status, 200);
      assert.strictEqual(okRes.data.session.application_payment_state, PAYMENT_STATES.CONFIRMED);
      assert.strictEqual(okRes.data.session.payment_status, 'paid');
      assert.strictEqual(okRes.data.session.payment_card_last4, '4242');
      assert.strictEqual(okRes.data.session.payment_failure_reason, null);
    } finally {
      delete process.env.LIVE_CARD_PROCESSOR_ENABLED;
      delete process.env.STRIPE_SECRET_KEY;
    }

    // Ledger requires admin auth
    const unauthLedger = await request(baseUrl, 'GET', '/api/payments/ledger');
    assert.strictEqual(unauthLedger.status, 401);

    // Option B (Individual) mode session + external submission test
    const indAppId = `APP-TESTIND-${Date.now()}`;
    const indSess = await request(baseUrl, 'POST', '/api/payments/session', {
      app_id: indAppId,
      first_name: 'Alex',
      last_name: 'Morgan',
      applicant_name: 'Alex Morgan',
      email: 'alex.morgan@example.com',
      property_address: '7400 Melrose Ln, Oklahoma City, OK 73127',
      household_payment_mode: 'individual',
      application_fee: 100,
      fee_breakdown: [
        { applicant_index: 0, name: 'Alex Morgan', role_label: 'Primary Applicant', fee: 50 },
        { applicant_index: 1, name: 'Taylor Morgan', role_label: 'Co-Applicant', fee: 50 },
      ],
    });
    assert.strictEqual(indSess.status, 200);
    assert.strictEqual(indSess.data.session.household_payment_mode, 'individual');
    assert.strictEqual(indSess.data.session.application_fee, 100);
    assert.strictEqual(indSess.data.session.amount_due_now, 50);

    // Admin & Tenant UI support checks
    const cpShell = fs.readFileSync(path.join(ROOT, 'js', 'cp-shell.js'), 'utf8');
    const adminAppsJs = fs.readFileSync(path.join(ROOT, 'js', 'admin', 'applications.js'), 'utf8');
    const portalJs = fs.readFileSync(path.join(ROOT, 'js', 'tenant', 'portal.js'), 'utf8');
    const cpApiJs = fs.readFileSync(path.join(ROOT, 'js', 'cp-api.js'), 'utf8');
    assert(cpShell.includes("label:'Not Approved'"), 'cp-shell.js must map denied -> Not Approved');
    assert(adminAppsJs.includes("denied:'Not Approved'"), 'applications.js must map denied -> Not Approved');
    assert(portalJs.includes('Not Approved'), 'portal.js must render Not Approved');
    assert(!cpApiJs.includes('1er co-solicitante') && !cpApiJs.includes('1st additional co-applicant included'), 'cp-api.js must not include $0 1st co-applicant discount');
    for (const st of EXPECTED_CANONICAL_STATES) {
      assert(adminAppsJs.includes(st), `admin/applications.js missing state support for ${st}`);
      if (st !== PAYMENT_STATES.AWAITING) {
        assert(portalJs.includes(st), `tenant/portal.js missing state support for ${st}`);
      }
    }
    assert(portalJs.includes('resolvePortalPayState'), 'tenant/portal.js must include resolvePortalPayState helper');

    // Confirm raw PAN/CVV never leaked into persisted ledger
    const written = fs.readFileSync(LEDGER_PATH, 'utf8');
    assert(!written.includes('4111111111111111') && !written.includes('"cvv"'), 'Raw card data leaked to ledger!');

    console.log('ALL ENHANCED PAYMENT & ALTERNATIVE WORKFLOW TESTS PASSED.');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (savedLiveFlag !== undefined) process.env.LIVE_CARD_PROCESSOR_ENABLED = savedLiveFlag;
    else delete process.env.LIVE_CARD_PROCESSOR_ENABLED;
    if (savedStripeKey !== undefined) process.env.STRIPE_SECRET_KEY = savedStripeKey;
    else delete process.env.STRIPE_SECRET_KEY;
    if (savedSquareToken !== undefined) process.env.SQUARE_ACCESS_TOKEN = savedSquareToken;
    else delete process.env.SQUARE_ACCESS_TOKEN;
    if (savedAppleHandle !== undefined) process.env.PAYMENT_APPLE_PAY_HANDLE = savedAppleHandle;
    else delete process.env.PAYMENT_APPLE_PAY_HANDLE;
    if (savedAppleMerch !== undefined) process.env.APPLE_PAY_MERCHANT_ID = savedAppleMerch;
    else delete process.env.APPLE_PAY_MERCHANT_ID;

    if (hadLedgerBefore && ledgerBackup !== null) {
      fs.writeFileSync(LEDGER_PATH, ledgerBackup, 'utf8');
    } else if (!hadLedgerBefore && fs.existsSync(LEDGER_PATH)) {
      fs.unlinkSync(LEDGER_PATH);
    }
  }
}

run().catch((err) => {
  console.error('PAYMENT WORKFLOW TEST FAILED:', err);
  process.exit(1);
});
