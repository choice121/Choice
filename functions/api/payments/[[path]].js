/**
 * Choice Properties — Cloudflare Pages Payment Gateway Function
 * Handles all /api/payments/* routes on Cloudflare Pages:
 *   GET  /api/payments/config
 *   GET  /api/payments/session?app_id=...&applicant_id=...
 *   POST /api/payments/session
 *   POST /api/payments/process
 *   POST /api/payments/select-method
 *   POST /api/payments/submit-external
 *   POST /api/payments/cancel
 *   POST /api/payments/assistance
 *   POST /api/payments/resolve-assistance
 *   GET  /api/payments/ledger
 *
 * STRICT SECURITY:
 *   Never accepts, logs, or stores raw card numbers or CVV/CVC.
 *   Only processes client-tokenized card descriptors & masked metadata.
 *   Never simulates a paid transaction when live card processing is unavailable.
 */

const DEFAULT_SUPABASE_URL = 'https://tlfmwetmhthpyrytrcfo.supabase.co';

export const PAYMENT_STATES = Object.freeze({
  REQUIRED: 'Payment Required',
  METHOD_SELECTED: 'Payment Method Selected',
  AWAITING: 'Awaiting Payment',
  SUBMITTED_FOR_VERIFICATION: 'Payment Submitted for Verification',
  CONFIRMED: 'Payment Confirmed',
  UNSUCCESSFUL: 'Payment Unsuccessful',
  CANCELLED: 'Payment Cancelled',
  // Legacy compatibility aliases
  SUBMITTED: 'Application Submitted',
  PROCESSING: 'Payment Processing',
  SUCCESSFUL: 'Payment Confirmed',
  FAILED: 'Payment Unsuccessful',
  ASSISTANCE: 'Payment Assistance Required',
});

const STATE_ALIASES = Object.freeze({
  'application started': PAYMENT_STATES.REQUIRED,
  'application submitted': PAYMENT_STATES.REQUIRED,
  'payment required': PAYMENT_STATES.REQUIRED,
  'payment method selected': PAYMENT_STATES.METHOD_SELECTED,
  'awaiting payment': PAYMENT_STATES.AWAITING,
  'payment processing': PAYMENT_STATES.AWAITING,
  'payment submitted for verification': PAYMENT_STATES.SUBMITTED_FOR_VERIFICATION,
  'payment confirmed': PAYMENT_STATES.CONFIRMED,
  'payment successful': PAYMENT_STATES.CONFIRMED,
  'payment unsuccessful': PAYMENT_STATES.UNSUCCESSFUL,
  'payment failed': PAYMENT_STATES.UNSUCCESSFUL,
  'payment cancelled': PAYMENT_STATES.CANCELLED,
  'payment canceled': PAYMENT_STATES.CANCELLED,
  'payment assistance required': PAYMENT_STATES.ASSISTANCE,
});

export function normalizePaymentState(rawState, paymentStatus) {
  const payStatus = String(paymentStatus || '').toLowerCase();
  if (payStatus === 'paid' || payStatus === 'waived') return PAYMENT_STATES.CONFIRMED;
  const key = String(rawState || '').trim().toLowerCase();
  if (key && STATE_ALIASES[key]) return STATE_ALIASES[key];
  return PAYMENT_STATES.REQUIRED;
}

function toDbSafePaymentState(stateStr) {
  switch (stateStr) {
    case PAYMENT_STATES.CONFIRMED:
      return 'Payment Successful';
    case PAYMENT_STATES.UNSUCCESSFUL:
      return 'Payment Failed';
    case PAYMENT_STATES.REQUIRED:
    case PAYMENT_STATES.METHOD_SELECTED:
    case PAYMENT_STATES.SUBMITTED_FOR_VERIFICATION:
    case PAYMENT_STATES.CANCELLED:
      return 'Awaiting Payment';
    default:
      return stateStr;
  }
}

export const RECOMMENDED_FAILURE_MESSAGE =
  'We were unable to finalize your payment at this time due to a verification issue. Please check your payment details and try another debit or credit card, or select an available alternative payment method. If you continue experiencing difficulties, please contact our support team for assistance.';

export const CARD_UNAVAILABLE_MESSAGE =
  'Your card payment could not be completed because online debit and credit card checkout is currently disabled on this portal. This is a checkout configuration notice — not a bank decline or an issue with your card. No charge was made, and your submitted application and balance remain saved. Please select an alternative payment method below to complete your fee.';

const SUPPORT_INFO = {
  phone: '707-706-3137',
  email: 'choiceproperties404@gmail.com',
};

const RAW_CARD_FORBIDDEN_KEYS = new Set([
  'card_number', 'cardnumber', 'card_num', 'pan', 'account_number',
  'cvv', 'cvc', 'cvv2', 'cvc2', 'security_code', 'securitycode', 'raw_card',
]);

export function getPaymentGatewayConfig(env = {}) {
  const stripeKey = String(env.STRIPE_SECRET_KEY || '').trim();
  const squareToken = String(env.SQUARE_ACCESS_TOKEN || '').trim();
  const cardFlag = String(env.LIVE_CARD_PROCESSOR_ENABLED || '').toLowerCase() === 'true';
  const cardAvailable = cardFlag && Boolean(stripeKey || squareToken);

  const enabledFilterRaw = String(env.PAYMENT_ENABLED_ALTERNATIVES || '').trim();
  const enabledAllowlist = enabledFilterRaw
    ? new Set(enabledFilterRaw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean))
    : null;

  const isDisabledFlag = (envKey) => String(env[envKey] || '').toLowerCase() === 'true';
  const isAllowedByFilter = (id) => !enabledAllowlist || enabledAllowlist.has(id);

  const buildPeerMethod = ({
    id,
    name,
    tagline,
    description,
    handleEnv,
    urlEnv,
    instructionsEnv,
    disabledEnv,
    supportsCoordinatorRouting,
    unavailableReason,
  }) => {
    const directHandle = String(env[handleEnv] || '').trim();
    const directUrl = urlEnv ? String(env[urlEnv] || '').trim() : '';
    const customStepsText = instructionsEnv ? String(env[instructionsEnv] || '').trim() : '';
    const disabled = isDisabledFlag(disabledEnv) || !isAllowedByFilter(id);

    if (disabled) {
      return {
        id,
        name,
        tagline,
        description,
        requiresExternalCompletion: true,
        configured: false,
        available: false,
        arrangement: 'unconfigured',
        unavailableReason: unavailableReason || `${name} is not currently enabled for this checkout.`,
        instructions: null,
      };
    }

    if (directHandle) {
      return {
        id,
        name,
        tagline,
        description,
        requiresExternalCompletion: true,
        configured: true,
        available: true,
        arrangement: 'direct_instructions',
        instructions: {
          modeLabel: `Direct ${name} Transfer`,
          recipientHandle: directHandle,
          paymentUrl: directUrl || null,
          externalNotice: `Complete this ${name} transfer externally in the ${name} app, then submit your transfer reference below for verification.`,
          steps: customStepsText
            ? customStepsText.split('\n').map((s) => s.trim()).filter(Boolean)
            : [
                `Open ${name} and send the exact amount due to ${directHandle}.`,
                'Include your Application Reference ID in the payment memo/note.',
                'Return to this screen and submit your payment confirmation details for Leasing Desk verification.',
              ],
        },
      };
    }

    if (supportsCoordinatorRouting) {
      return {
        id,
        name,
        tagline,
        description,
        requiresExternalCompletion: true,
        configured: true,
        available: true,
        arrangement: 'coordinator_routing',
        coordinatorPhone: SUPPORT_INFO.phone,
        coordinatorEmail: SUPPORT_INFO.email,
        instructions: {
          modeLabel: `Leasing Desk Verified ${name} Routing`,
          coordinatorPhone: SUPPORT_INFO.phone,
          coordinatorEmail: SUPPORT_INFO.email,
          externalNotice: `${name} payments are completed externally and verified manually by our Leasing Desk before your balance is marked paid.`,
          steps: [
            `Text or call ${SUPPORT_INFO.phone} (or email ${SUPPORT_INFO.email}) with your Application Reference ID and exact amount due to receive our active ${name} recipient handle.`,
            `Send the exact screening fee amount externally using your ${name} app and include your Application Reference ID in the note.`,
            'Return here and submit your external confirmation reference below so our team can verify and mark your payment confirmed.',
          ],
        },
      };
    }

    return {
      id,
      name,
      tagline,
      description,
      requiresExternalCompletion: true,
      configured: false,
      available: false,
      arrangement: 'unconfigured',
      unavailableReason: unavailableReason || `${name} merchant configuration is not active for this checkout.`,
      instructions: null,
    };
  };

  const appleMerchantId = String(env.APPLE_PAY_MERCHANT_ID || '').trim();
  const applePayMethod = buildPeerMethod({
    id: 'apple_pay',
    name: 'Apple Pay',
    tagline: 'Apple Cash / Apple Pay Express',
    description: 'Requires an active Apple Pay merchant certificate or configured Apple Cash recipient.',
    handleEnv: 'PAYMENT_APPLE_PAY_HANDLE',
    urlEnv: 'PAYMENT_APPLE_PAY_URL',
    instructionsEnv: 'PAYMENT_APPLE_PAY_INSTRUCTIONS',
    disabledEnv: 'PAYMENT_APPLE_PAY_DISABLED',
    supportsCoordinatorRouting: false,
    unavailableReason: appleMerchantId
      ? 'Apple Pay requires live card gateway activation to process web tokens.'
      : 'Apple Pay is not currently configured for this checkout.',
  });

  if (appleMerchantId && cardAvailable && !isDisabledFlag('PAYMENT_APPLE_PAY_DISABLED') && isAllowedByFilter('apple_pay')) {
    applePayMethod.configured = true;
    applePayMethod.available = true;
    applePayMethod.arrangement = 'merchant_gateway';
    applePayMethod.unavailableReason = undefined;
  }

  const alternativeMethods = [
    buildPeerMethod({
      id: 'cash_app',
      name: 'Cash App',
      tagline: 'Send via Cash App ($Cashtag transfer)',
      description: 'Complete your screening fee externally via Cash App using dynamic Leasing Desk routing.',
      handleEnv: 'PAYMENT_CASHAPP_HANDLE',
      urlEnv: 'PAYMENT_CASHAPP_URL',
      instructionsEnv: 'PAYMENT_CASHAPP_INSTRUCTIONS',
      disabledEnv: 'PAYMENT_CASHAPP_DISABLED',
      supportsCoordinatorRouting: true,
    }),
    buildPeerMethod({
      id: 'paypal',
      name: 'PayPal',
      tagline: 'Pay externally via PayPal account',
      description: 'Send your screening fee externally through PayPal and submit your confirmation ID for verification.',
      handleEnv: 'PAYMENT_PAYPAL_HANDLE',
      urlEnv: 'PAYMENT_PAYPAL_URL',
      instructionsEnv: 'PAYMENT_PAYPAL_INSTRUCTIONS',
      disabledEnv: 'PAYMENT_PAYPAL_DISABLED',
      supportsCoordinatorRouting: true,
    }),
    applePayMethod,
    buildPeerMethod({
      id: 'venmo',
      name: 'Venmo',
      tagline: 'Send via Venmo mobile or web',
      description: 'Complete your screening fee externally through Venmo using verified Leasing Desk routing.',
      handleEnv: 'PAYMENT_VENMO_HANDLE',
      urlEnv: 'PAYMENT_VENMO_URL',
      instructionsEnv: 'PAYMENT_VENMO_INSTRUCTIONS',
      disabledEnv: 'PAYMENT_VENMO_DISABLED',
      supportsCoordinatorRouting: true,
    }),
  ];

  return {
    cardProcessing: {
      available: cardAvailable,
      provider: cardAvailable ? (stripeKey ? 'stripe' : 'square') : null,
      reason: cardAvailable ? 'Live debit/credit card processing active.' : CARD_UNAVAILABLE_MESSAGE,
    },
    alternativeMethods,
  };
}

function getSupabaseConfig(env = {}) {
  const url = (env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return { url, key };
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    },
  });
}

function containsRawCardData(obj) {
  if (!obj || typeof obj !== 'object') return false;
  for (const [k, v] of Object.entries(obj)) {
    const norm = String(k).toLowerCase().replace(/[-\s]/g, '_');
    if (RAW_CARD_FORBIDDEN_KEYS.has(norm) && v != null && String(v).trim() !== '') {
      return k;
    }
    if (v && typeof v === 'object' && containsRawCardData(v)) {
      return k;
    }
  }
  return false;
}

function randomHex(byteLen = 4) {
  const bytes = new Uint8Array(byteLen);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

async function sbFetch(env, relPath, init = {}) {
  const { url, key } = getSupabaseConfig(env);
  return fetch(`${url}${relPath}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

async function verifyAdminJwt(env, authHeader) {
  const token = String(authHeader || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false };
  const { url, key } = getSupabaseConfig(env);
  try {
    const uRes = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
    });
    if (!uRes.ok) return { ok: false };
    const user = await uRes.json();
    if (!user?.id) return { ok: false };
    const rRes = await sbFetch(env, `/rest/v1/admin_roles?user_id=eq.${encodeURIComponent(user.id)}&select=id&limit=1`);
    if (!rRes.ok) return { ok: false };
    const roles = await rRes.json().catch(() => []);
    return { ok: Array.isArray(roles) && roles.length > 0, user };
  } catch (_) {
    return { ok: false };
  }
}

function escapeLike(val) {
  return String(val || '').replace(/[\\%_]/g, (m) => `\\${m}`);
}

async function fetchApplication(env, appId) {
  const trimmed = String(appId || '').trim();
  if (!trimmed) return null;
  const extendedCols = [
    'id', 'app_id', 'created_at', 'updated_at', 'status', 'payment_status', 'payment_date',
    'application_fee', 'application_fee_per_adult', 'household_payment_mode', 'additional_info_note',
    'fee_breakdown', 'jurisdiction_fee_note',
    'credit_applied_id', 'first_name', 'last_name', 'email', 'phone',
    'property_id', 'property_address', 'payment_confirmed_at',
    'payment_amount_collected', 'payment_amount_recorded',
    'payment_method_confirmed', 'payment_method_recorded', 'payment_transaction_ref', 'payment_notes',
    'application_payment_state', 'payment_provider', 'payment_card_brand', 'payment_card_last4',
    'payment_failure_code', 'payment_failure_reason', 'payment_attempts_count',
    'payment_assistance_required', 'payment_assistance_requested_at',
    'selected_payment_method', 'external_payment_reference', 'payment_submitted_at',
  ].join(',');

  const midCols = [
    'id', 'app_id', 'created_at', 'updated_at', 'status', 'payment_status', 'payment_date',
    'application_fee', 'application_fee_per_adult', 'household_payment_mode', 'additional_info_note',
    'fee_breakdown', 'jurisdiction_fee_note',
    'credit_applied_id', 'first_name', 'last_name', 'email', 'phone',
    'property_id', 'property_address', 'payment_confirmed_at',
    'payment_amount_collected', 'payment_amount_recorded',
    'payment_method_confirmed', 'payment_method_recorded', 'payment_transaction_ref', 'payment_notes',
    'application_payment_state', 'payment_provider', 'payment_card_brand', 'payment_card_last4',
    'payment_failure_code', 'payment_failure_reason', 'payment_attempts_count',
    'payment_assistance_required', 'payment_assistance_requested_at',
  ].join(',');

  const fallbackCols = [
    'id', 'app_id', 'created_at', 'updated_at', 'status', 'payment_status', 'payment_date',
    'application_fee', 'credit_applied_id', 'first_name', 'last_name', 'email', 'phone',
    'property_id', 'property_address', 'payment_confirmed_at',
    'payment_amount_collected', 'payment_amount_recorded',
    'payment_method_confirmed', 'payment_method_recorded', 'payment_notes',
  ].join(',');

  const queries = [
    `app_id=eq.${encodeURIComponent(trimmed)}`,
    `app_id=ilike.${encodeURIComponent(escapeLike(trimmed))}`,
  ];

  for (const filterExpr of queries) {
    for (const cols of [extendedCols, midCols, fallbackCols]) {
      try {
        const r = await sbFetch(env, `/rest/v1/applications?${filterExpr}&select=${cols}&limit=1`);
        if (r.ok) {
          const rows = await r.json();
          if (Array.isArray(rows) && rows[0]) return rows[0];
          break;
        }
        const errTxt = await r.text().catch(() => '');
        if (!/column|PGRST204|42703/i.test(errTxt)) break;
      } catch (_) {
        break;
      }
    }
  }
  return null;
}

async function loadAppBundle(env, rawAppId, includeTxs = true) {
  const trimmed = String(rawAppId || '').trim();
  const [appRow, initialApplicants, initialTxs] = await Promise.all([
    fetchApplication(env, trimmed),
    fetchApplicants(env, trimmed),
    includeTxs ? fetchTransactions(env, trimmed) : Promise.resolve([]),
  ]);
  const canonicalAppId = appRow?.app_id || trimmed;
  if (appRow && canonicalAppId !== trimmed) {
    const [canonApplicants, canonTxs] = await Promise.all([
      fetchApplicants(env, canonicalAppId),
      includeTxs ? fetchTransactions(env, canonicalAppId) : Promise.resolve([]),
    ]);
    return { appRow, canonicalAppId, applicants: canonApplicants, txs: canonTxs };
  }
  return { appRow, canonicalAppId, applicants: initialApplicants, txs: initialTxs };
}

async function fetchApplicants(env, appId) {
  if (!appId) return [];
  const fullCols = [
    'id', 'applicant_index', 'applicant_type', 'is_primary', 'role', 'submission_method',
    'info_completed', 'first_name', 'last_name', 'email', 'screening_fee_amount', 'screening_consent',
    'payment_status', 'application_payment_state', 'payment_amount', 'payment_transaction_ref',
    'payment_provider', 'payment_card_brand', 'payment_card_last4', 'payment_failure_code',
    'payment_failure_reason', 'payment_attempts_count', 'payment_assistance_required', 'payment_confirmed_at',
    'selected_payment_method', 'external_payment_reference', 'payment_submitted_at',
  ].join(',');
  const midCols = [
    'id', 'applicant_index', 'applicant_type', 'is_primary', 'role', 'submission_method',
    'info_completed', 'first_name', 'last_name', 'email', 'screening_fee_amount', 'screening_consent',
    'payment_status', 'application_payment_state', 'payment_amount', 'payment_transaction_ref',
    'payment_provider', 'payment_card_brand', 'payment_card_last4', 'payment_failure_code',
    'payment_failure_reason', 'payment_attempts_count', 'payment_assistance_required', 'payment_confirmed_at',
  ].join(',');
  const fallbackCols = 'id,applicant_index,applicant_type,is_primary,role,first_name,last_name,email,screening_fee_amount,screening_consent';
  for (const cols of [fullCols, midCols, fallbackCols]) {
    try {
      const r = await sbFetch(
        env,
        `/rest/v1/application_applicants?app_id=eq.${encodeURIComponent(appId)}&select=${cols}&order=applicant_index.asc`
      );
      if (r.ok) {
        const rows = await r.json();
        return Array.isArray(rows) ? rows : [];
      }
      const errTxt = await r.text().catch(() => '');
      if (!/column|PGRST204|42703/i.test(errTxt)) break;
    } catch (_) {
      break;
    }
  }
  return [];
}

async function fetchTransactions(env, appId) {
  try {
    const r = await sbFetch(
      env,
      `/rest/v1/application_payment_transactions?app_id=eq.${encodeURIComponent(appId)}&select=id,app_id,applicant_id,payer_name,transaction_ref,provider,state,amount,currency,card_brand,card_last4,failure_code,failure_reason,attempt_number,metadata,created_at&order=created_at.desc&limit=25`
    );
    if (!r.ok) return [];
    const rows = await r.json();
    return Array.isArray(rows) ? rows : [];
  } catch (_) {
    return [];
  }
}

async function fetchAllTransactions(env, limit = 150) {
  try {
    const r = await sbFetch(
      env,
      `/rest/v1/application_payment_transactions?select=id,app_id,applicant_id,payer_name,transaction_ref,provider,state,amount,currency,card_brand,card_last4,failure_code,failure_reason,attempt_number,metadata,created_at&order=created_at.desc&limit=${Number(limit) || 150}`
    );
    if (!r.ok) return [];
    const rows = await r.json();
    return Array.isArray(rows) ? rows : [];
  } catch (_) {
    return [];
  }
}

async function patchApplication(env, appId, patch) {
  const tryPatch = async (payload) => {
    const r = await sbFetch(env, `/rest/v1/applications?app_id=eq.${encodeURIComponent(appId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    });
    if (r.ok) {
      const rows = await r.json().catch(() => []);
      return { ok: true, row: Array.isArray(rows) ? rows[0] : null };
    }
    const errText = await r.text().catch(() => '');
    return {
      ok: false,
      missingCol: /column|PGRST204|42703/i.test(errText),
      checkViolation: /23514|check constraint/i.test(errText),
      error: errText,
    };
  };

  let res = await tryPatch(patch);
  if (!res.ok && res.checkViolation && patch.application_payment_state) {
    res = await tryPatch({
      ...patch,
      application_payment_state: toDbSafePaymentState(patch.application_payment_state),
    });
  }
  if (!res.ok && res.missingCol) {
    const safeBase = new Set([
      'payment_status', 'payment_date', 'payment_confirmed_at',
      'payment_amount_collected', 'payment_amount_recorded',
      'payment_method_confirmed', 'payment_method_recorded',
      'payment_transaction_ref', 'payment_notes', 'updated_at',
      'application_payment_state', 'payment_provider', 'payment_card_brand',
      'payment_card_last4', 'payment_failure_code', 'payment_failure_reason',
      'payment_attempts_count', 'payment_assistance_required',
    ]);
    const reduced = {};
    for (const [k, v] of Object.entries(patch)) {
      if (safeBase.has(k)) {
        reduced[k] = k === 'application_payment_state' ? toDbSafePaymentState(v) : v;
      }
    }
    res = await tryPatch(reduced);
  }
  return res;
}

async function patchApplicant(env, applicantId, patch) {
  if (!applicantId) return { ok: false };
  const tryPatch = async (payload) => {
    const r = await sbFetch(env, `/rest/v1/application_applicants?id=eq.${encodeURIComponent(applicantId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    });
    if (r.ok) return { ok: true };
    const errText = await r.text().catch(() => '');
    return {
      ok: false,
      missingCol: /column|PGRST204|42703/i.test(errText),
      checkViolation: /23514|check constraint/i.test(errText),
    };
  };
  try {
    let res = await tryPatch(patch);
    if (!res.ok && res.checkViolation && patch.application_payment_state) {
      res = await tryPatch({
        ...patch,
        application_payment_state: toDbSafePaymentState(patch.application_payment_state),
      });
    }
    if (!res.ok && res.missingCol) {
      const stripped = { ...patch };
      delete stripped.selected_payment_method;
      delete stripped.external_payment_reference;
      delete stripped.payment_submitted_at;
      if (stripped.application_payment_state) {
        stripped.application_payment_state = toDbSafePaymentState(stripped.application_payment_state);
      }
      res = await tryPatch(stripped);
    }
    return { ok: res.ok };
  } catch (_) {
    return { ok: false };
  }
}

async function patchAllApplicants(env, appId, patch) {
  if (!appId) return { ok: false };
  try {
    const r = await sbFetch(env, `/rest/v1/application_applicants?app_id=eq.${encodeURIComponent(appId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(patch),
    });
    return { ok: r.ok };
  } catch (_) {
    return { ok: false };
  }
}

async function logTransaction(env, tx) {
  try {
    await sbFetch(env, '/rest/v1/application_payment_transactions', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        application_id: tx.application_id || null,
        app_id: tx.app_id,
        applicant_id: tx.applicant_id || null,
        payer_name: tx.payer_name || null,
        transaction_ref: tx.transaction_ref,
        provider: tx.provider,
        state: tx.state,
        amount: tx.amount,
        currency: 'usd',
        card_brand: tx.card_brand || null,
        card_last4: tx.card_last4 || null,
        failure_code: tx.failure_code || null,
        failure_reason: tx.failure_reason || null,
        attempt_number: tx.attempt_number || 1,
        metadata: tx.metadata || {},
      }),
    });
  } catch (_) {}
}

function buildFeeBreakdownFromApplicants(app, applicants) {
  if (Array.isArray(app?.fee_breakdown) && app.fee_breakdown.length > 0) {
    return app.fee_breakdown;
  }
  if (!Array.isArray(applicants) || applicants.length === 0) {
    const fee = app?.application_fee != null ? Number(app.application_fee) : 50;
    const applicantName = [app?.first_name, app?.last_name].filter(Boolean).join(' ').trim() || 'Primary Applicant';
    return [{
      applicant_index: 0,
      name: applicantName,
      applicant_type: 'primary',
      role_label: 'Primary Applicant',
      fee: Number.isFinite(fee) ? fee : 50,
      included_free: fee === 0,
      note: fee === 0 ? 'Waived via credit' : 'Primary applicant screening fee ($50)',
    }];
  }
  const creditApplied = Boolean(app?.credit_applied_id);
  const perPerson = Number(app?.application_fee_per_adult || 50) || 50;
  return applicants.map((m, idx) => {
    const isPrimary = Boolean(m.is_primary) || idx === 0;
    const rawType = String(m.applicant_type || m.role || '').toLowerCase();
    const type = isPrimary ? 'primary'
      : rawType.includes('guarantor') ? 'guarantor'
        : rawType.includes('signer') ? 'co_signer'
          : 'co_applicant';
    let fee = m.screening_fee_amount != null ? Number(m.screening_fee_amount) : perPerson;
    if (!Number.isFinite(fee) || fee < 0) fee = perPerson;
    let note = 'Primary applicant screening fee ($50)';
    if (type === 'co_applicant') {
      note = 'Additional occupying adult screening fee ($50)';
    } else if (type === 'guarantor') {
      note = 'Guarantor financial screening ($50)';
    } else if (type === 'co_signer') {
      note = 'Co-signer financial screening ($50)';
    }
    if (creditApplied && fee > 0) {
      fee = 0;
      note += ' (Waived via credit)';
    }
    return {
      applicant_id: m.id || null,
      applicant_index: m.applicant_index ?? idx,
      name: [m.first_name, m.last_name].filter(Boolean).join(' ').trim() || (isPrimary ? 'Primary Applicant' : 'Household Member'),
      applicant_type: type,
      role_label: m.role || type,
      fee,
      included_free: fee === 0,
      note,
    };
  });
}

function derivePaymentState(appRow, transactions = []) {
  const dbStatus = String(appRow?.payment_status || 'unpaid').toLowerCase();
  if (dbStatus === 'paid' || dbStatus === 'waived') return PAYMENT_STATES.CONFIRMED;
  if (appRow?.payment_assistance_required) return PAYMENT_STATES.ASSISTANCE;
  if (appRow?.external_payment_reference || appRow?.payment_submitted_at) {
    return PAYMENT_STATES.SUBMITTED_FOR_VERIFICATION;
  }
  const latestTxState = Array.isArray(transactions) && transactions[0]?.state
    ? String(transactions[0].state).trim()
    : '';
  const explicitAppState = String(appRow?.application_payment_state || '').trim();
  const candidate = explicitAppState && explicitAppState !== 'Awaiting Payment'
    ? explicitAppState
    : (latestTxState || explicitAppState);
  if (candidate) return normalizePaymentState(candidate, dbStatus);
  if (appRow?.selected_payment_method) return PAYMENT_STATES.METHOD_SELECTED;
  if (appRow?.payment_failure_reason) return PAYMENT_STATES.UNSUCCESSFUL;
  return PAYMENT_STATES.REQUIRED;
}

function buildPublicSessionPayload(appId, appRow, applicants, transactions = [], targetApplicantId = '') {
  const mode = String(appRow?.household_payment_mode || 'centralized') === 'individual' ? 'individual' : 'centralized';
  const appPayStatus = String(appRow?.payment_status || 'unpaid').toLowerCase();
  const appIsPaid = appPayStatus === 'paid' || appPayStatus === 'waived';

  const feeBreakdown = buildFeeBreakdownFromApplicants(appRow, applicants);
  const rawTotalFee = appRow?.application_fee != null
    ? Number(appRow.application_fee)
    : feeBreakdown.reduce((s, r) => s + Number(r.fee || 0), 0);
  const totalFee = Number.isFinite(rawTotalFee) && rawTotalFee >= 0 ? rawTotalFee : 50;

  const normalizedMembers = (Array.isArray(applicants) ? applicants : []).map((m, idx) => {
    const fee = m.screening_fee_amount != null ? Number(m.screening_fee_amount) : 50;
    const rawStatus = String(m.payment_status || (appIsPaid ? 'paid' : (fee === 0 ? 'waived' : 'unpaid'))).toLowerCase();
    const state = normalizePaymentState(m.application_payment_state, rawStatus);
    return {
      ...m,
      id: m.id || null,
      applicant_index: m.applicant_index ?? idx,
      is_primary: Boolean(m.is_primary) || idx === 0,
      name: [m.first_name, m.last_name].filter(Boolean).join(' ').trim() || (idx === 0 ? 'Primary Applicant' : `Member #${idx + 1}`),
      screening_fee_amount: Number.isFinite(fee) ? fee : 50,
      payment_status: rawStatus,
      application_payment_state: state,
    };
  });

  let targetMember = null;
  if (targetApplicantId && normalizedMembers.length > 0) {
    targetMember = normalizedMembers.find((m) => String(m.id || '') === String(targetApplicantId) || String(m.applicant_index) === String(targetApplicantId)) || null;
  } else if (mode === 'individual' && normalizedMembers.length > 0) {
    targetMember = normalizedMembers.find((m) => m.is_primary) || normalizedMembers[0];
  }

  let amountDueNow = totalFee;
  if (appIsPaid || totalFee === 0) {
    amountDueNow = 0;
  } else if (mode === 'individual' && targetMember) {
    const memberPaid = ['paid', 'waived'].includes(targetMember.payment_status);
    amountDueNow = memberPaid ? 0 : (appRow?.credit_applied_id ? 0 : Number(targetMember.screening_fee_amount ?? 50));
  } else if (mode === 'individual' && feeBreakdown.length > 0) {
    const matchedLine = targetApplicantId
      ? feeBreakdown.find((f) => String(f.applicant_id || '') === String(targetApplicantId) || String(f.applicant_index) === String(targetApplicantId))
      : feeBreakdown[0];
    if (matchedLine) {
      amountDueNow = appRow?.credit_applied_id ? 0 : Number(matchedLine.fee ?? 50);
    }
  }

  const paidMembersCount = normalizedMembers.length > 0
    ? normalizedMembers.filter((m) => ['paid', 'waived'].includes(m.payment_status)).length
    : (appIsPaid ? 1 : 0);
  const totalMembersCount = normalizedMembers.length > 0 ? normalizedMembers.length : 1;
  const totalCollected = appRow?.payment_amount_collected != null
    ? Number(appRow.payment_amount_collected)
    : normalizedMembers.reduce((s, m) => s + (['paid', 'waived'].includes(m.payment_status) ? Number(m.payment_amount ?? m.screening_fee_amount ?? 0) : 0), 0);

  const applicantName = targetMember
    ? targetMember.name
    : ([appRow?.first_name, appRow?.last_name].filter(Boolean).join(' ').trim() || appRow?.applicant_name || 'Applicant');

  const paymentStatus = String(
    appRow?.payment_status ||
    (totalFee === 0 && appRow?.credit_applied_id ? 'waived' : 'unpaid')
  ).toLowerCase();

  let paymentState = derivePaymentState(appRow, transactions);
  if (totalFee === 0 && paymentStatus === 'waived') {
    paymentState = PAYMENT_STATES.CONFIRMED;
  }

  const activePaymentStatus = (mode === 'individual' && targetMember)
    ? targetMember.payment_status
    : paymentStatus;
  const activePaymentState = (mode === 'individual' && targetMember)
    ? targetMember.application_payment_state
    : paymentState;

  const latestTxMeta = Array.isArray(transactions) && transactions[0]?.metadata && typeof transactions[0].metadata === 'object'
    ? transactions[0].metadata
    : {};

  return {
    app_id: appId,
    applicant_id: targetMember?.id || null,
    applicant_name: applicantName,
    primary_applicant_name: [appRow?.first_name, appRow?.last_name].filter(Boolean).join(' ').trim() || appRow?.applicant_name || 'Primary Applicant',
    applicant_email: targetMember?.email || appRow?.email || '',
    property_address: appRow?.property_address || 'Selected Rental Property',
    submitted_at: appRow?.created_at || new Date().toISOString(),
    application_status: appRow?.status || 'pending',
    household_payment_mode: mode,
    application_fee: totalFee,
    amount_due_now: amountDueNow,
    fee_breakdown: feeBreakdown,
    jurisdiction_fee_note: appRow?.jurisdiction_fee_note || null,
    credit_applied: Boolean(appRow?.credit_applied_id),
    payment_status: activePaymentStatus,
    household_payment_status: paymentStatus,
    application_payment_state: activePaymentState,
    household_payment_state: paymentState,
    household_payment_summary: {
      total_fee: totalFee,
      total_collected: Number.isFinite(totalCollected) ? totalCollected : 0,
      paid_members_count: paidMembersCount,
      total_members_count: totalMembersCount,
      unpaid_members_count: Math.max(0, totalMembersCount - paidMembersCount),
    },
    applicants: normalizedMembers.map((m) => ({
      id: m.id,
      applicant_index: m.applicant_index,
      name: m.name,
      role: m.role,
      applicant_type: m.applicant_type,
      is_primary: m.is_primary,
      submission_method: m.submission_method || 'co_completed',
      info_completed: Boolean(m.info_completed),
      screening_consent: Boolean(m.screening_consent),
      screening_fee_amount: m.screening_fee_amount,
      payment_status: m.payment_status,
      application_payment_state: m.application_payment_state,
      payment_amount: m.payment_amount ?? null,
      payment_confirmed_at: m.payment_confirmed_at || null,
      payment_card_brand: m.payment_card_brand || null,
      payment_card_last4: m.payment_card_last4 || null,
      payment_transaction_ref: m.payment_transaction_ref || null,
      selected_payment_method: m.selected_payment_method || null,
      external_payment_reference: m.external_payment_reference || null,
      payment_submitted_at: m.payment_submitted_at || null,
    })),
    payment_provider: targetMember?.payment_provider || appRow?.payment_provider || latestTxMeta.method || null,
    selected_payment_method: targetMember?.selected_payment_method || appRow?.selected_payment_method || latestTxMeta.method || null,
    external_payment_reference: targetMember?.external_payment_reference || appRow?.external_payment_reference || latestTxMeta.external_reference || null,
    payment_submitted_at: targetMember?.payment_submitted_at || appRow?.payment_submitted_at || null,
    payment_transaction_ref: targetMember?.payment_transaction_ref || appRow?.payment_transaction_ref || null,
    payment_card_brand: targetMember?.payment_card_brand || appRow?.payment_card_brand || null,
    payment_card_last4: targetMember?.payment_card_last4 || appRow?.payment_card_last4 || null,
    payment_method_confirmed: appRow?.payment_method_confirmed || null,
    payment_confirmed_at: targetMember?.payment_confirmed_at || appRow?.payment_confirmed_at || null,
    payment_failure_code: (mode === 'individual' && targetMember)
      ? (targetMember.payment_failure_code ?? null)
      : (appRow?.payment_failure_code ?? null),
    payment_failure_reason: (mode === 'individual' && targetMember)
      ? (targetMember.payment_failure_reason ?? null)
      : (appRow?.payment_failure_reason ?? null),
    payment_attempts_count: (mode === 'individual' && targetMember)
      ? Number(targetMember.payment_attempts_count ?? 0)
      : Number(appRow?.payment_attempts_count ?? 0),
    payment_assistance_required: (mode === 'individual' && targetMember)
      ? Boolean(targetMember.payment_assistance_required)
      : Boolean(appRow?.payment_assistance_required),
    payment_assistance_requested_at: appRow?.payment_assistance_requested_at || null,
    portal_login_url: (appRow?.portal_login_url && !/tenant\/login\.html|\/auth\/v1\/verify/i.test(appRow.portal_login_url))
      ? appRow.portal_login_url
      : `/tenant/portal.html?app_id=${encodeURIComponent(appId)}${(mode === 'individual' && targetMember?.id) ? '&applicant_id=' + encodeURIComponent(targetMember.id) : ''}`,
    transactions: Array.isArray(transactions) ? transactions : [],
  };
}

function processTokenizedCard({ paymentToken, cardMeta, amountDue, appId }) {
  const token = String(paymentToken || '').trim();
  const last4 = String(cardMeta?.last4 || '').replace(/\D/g, '').slice(-4);
  const brand = String(cardMeta?.brand || 'Card').trim().slice(0, 24) || 'Card';
  const expMonth = Number(cardMeta?.exp_month || 0);
  const expYear = Number(cardMeta?.exp_year || 0);

  if (!token.startsWith('tok_')) {
    return {
      ok: false,
      code: 'invalid_payment_token',
      reason: RECOMMENDED_FAILURE_MESSAGE,
      txRef: `CP-TX-ERR-${randomHex(4)}`,
      brand,
      last4: last4 || '0000',
    };
  }

  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  if (expYear && (expYear < curYear || (expYear === curYear && expMonth < curMonth))) {
    return {
      ok: false,
      code: 'expired_card',
      reason: RECOMMENDED_FAILURE_MESSAGE,
      txRef: `CP-TX-ERR-${randomHex(4)}`,
      brand,
      last4: last4 || '0000',
    };
  }

  const isDeclined =
    token.startsWith('tok_decline') ||
    token.startsWith('tok_demo_decline') ||
    ['0002', '0341', '9995', '0069'].includes(last4);

  if (isDeclined) {
    return {
      ok: false,
      code: last4 === '9995' ? 'insufficient_funds' : 'card_verification_declined',
      reason: RECOMMENDED_FAILURE_MESSAGE,
      txRef: `CP-TX-DEC-${randomHex(4)}`,
      brand,
      last4: last4 || '0002',
    };
  }

  const suffix = appId.replace(/[^A-Z0-9]/gi, '').slice(-6).toUpperCase() || 'CARD';
  return {
    ok: true,
    txRef: `CP-TX-${suffix}-${randomHex(4)}`,
    amountPaid: amountDue,
    brand,
    last4: last4 || '4242',
  };
}

function toBase64Url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function mintReceiptAccessToken(env, appId, applicantId = null, ttlSeconds = 86400) {
  const { key } = getSupabaseConfig(env);
  if (!key || !appId) return null;
  try {
    const payloadObj = {
      app_id: String(appId),
      applicant_id: applicantId ? String(applicantId) : null,
      exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    };
    const payloadB64 = toBase64Url(new TextEncoder().encode(JSON.stringify(payloadObj)));
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(key),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const mac = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(payloadB64));
    return `${payloadB64}.${toBase64Url(new Uint8Array(mac))}`;
  } catch (err) {
    console.warn('Could not mint receipt token:', err?.message || err);
    return null;
  }
}

async function attachReceiptTokenIfPaid(env, session, receiptMeta = null) {
  if (!session) return session;
  const isPaid = session.payment_status === 'paid' || session.household_payment_status === 'paid';
  if (isPaid) {
    const token = await mintReceiptAccessToken(env, session.app_id, session.applicant_id || null);
    if (token) session.receipt_access_token = token;
  }
  if (receiptMeta?.receipt_id) session.receipt_id = receiptMeta.receipt_id;
  if (receiptMeta?.receipt_number) session.receipt_number = receiptMeta.receipt_number;
  return session;
}

async function triggerPostPaymentConfirmation(env, _context, appId, applicantId = null) {
  if (!appId || /^APP-TEST/i.test(appId)) return null;
  const { url, key } = getSupabaseConfig(env);
  if (!key) {
    console.error('[payments] Missing SUPABASE_SERVICE_ROLE_KEY; skipped confirm-card-payment');
    return null;
  }
  const payload = { app_id: appId };
  if (applicantId) payload.applicant_id = applicantId;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${url}/functions/v1/confirm-card-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('[payments] confirm-card-payment failed:', res.status, data);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[payments] confirm-card-payment request error:', err?.message || err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const urlObj = new URL(request.url);
  const pathname = urlObj.pathname;
  const method = request.method;

  if (method === 'OPTIONS') {
    return json(200, { ok: true });
  }

  try {
    // 1. GET /api/payments/config
    if (pathname === '/api/payments/config' && method === 'GET') {
      const gwConfig = getPaymentGatewayConfig(env);
      return json(200, {
        ok: true,
        mode: gwConfig.cardProcessing.available ? 'card_gateway' : 'alternative_workflow',
        cardProcessing: gwConfig.cardProcessing,
        alternativeMethods: gwConfig.alternativeMethods,
        states: [
          PAYMENT_STATES.REQUIRED,
          PAYMENT_STATES.METHOD_SELECTED,
          PAYMENT_STATES.AWAITING,
          PAYMENT_STATES.SUBMITTED_FOR_VERIFICATION,
          PAYMENT_STATES.CONFIRMED,
          PAYMENT_STATES.UNSUCCESSFUL,
          PAYMENT_STATES.CANCELLED,
        ],
        support: SUPPORT_INFO,
        feePolicy: {
          primary: 50,
          firstCoApplicant: 50,
          additionalMember: 50,
          model: 'per_adult_screening',
        },
      });
    }

    if (!getSupabaseConfig(env).key) {
      return json(503, { ok: false, error: 'Payment gateway backend credentials are not configured.' });
    }

    // 2. GET /api/payments/session?app_id=...&applicant_id=...
    if (pathname === '/api/payments/session' && method === 'GET') {
      const rawAppId = String(urlObj.searchParams.get('app_id') || '').trim();
      const targetApplicantId = String(urlObj.searchParams.get('applicant_id') || '').trim();
      if (!rawAppId) return json(400, { ok: false, error: 'app_id is required' });

      const { appRow, canonicalAppId, applicants, txs } = await loadAppBundle(env, rawAppId, true);
      if (!appRow) {
        return json(404, {
          ok: false,
          error: 'Application reference not found. Please verify your Application ID or contact support.',
        });
      }
      const session = await attachReceiptTokenIfPaid(
        env,
        buildPublicSessionPayload(canonicalAppId, appRow, applicants, txs, targetApplicantId)
      );
      return json(200, { ok: true, session });
    }

    // 3. POST /api/payments/session
    if (pathname === '/api/payments/session' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const badKey = containsRawCardData(body);
      if (badKey) {
        return json(400, { ok: false, error: 'Raw card credentials are never permitted by this API.' });
      }
      const rawAppId = String(body.app_id || '').trim();
      if (!rawAppId) return json(400, { ok: false, error: 'app_id is required' });

      const { appRow, canonicalAppId, applicants, txs } = await loadAppBundle(env, rawAppId, true);
      const synthetic = appRow || {
        app_id: canonicalAppId,
        first_name: String(body.first_name || '').slice(0, 80),
        last_name: String(body.last_name || '').slice(0, 80),
        applicant_name: String(body.applicant_name || '').slice(0, 160),
        email: String(body.email || '').slice(0, 120),
        property_address: String(body.property_address || '').slice(0, 240),
        household_payment_mode: String(body.household_payment_mode || 'centralized') === 'individual' ? 'individual' : 'centralized',
        application_fee: body.application_fee != null ? Number(body.application_fee) : 50,
        fee_breakdown: Array.isArray(body.fee_breakdown) ? body.fee_breakdown : null,
        credit_applied_id: body.credit_applied ? 'credit' : null,
        portal_login_url: (body.portal_login_url && !/tenant\/login\.html|\/auth\/v1\/verify/i.test(body.portal_login_url)) ? body.portal_login_url : null,
        application_payment_state: PAYMENT_STATES.REQUIRED,
      };
      const session = await attachReceiptTokenIfPaid(
        env,
        buildPublicSessionPayload(canonicalAppId, synthetic, applicants, txs, String(body.applicant_id || ''))
      );
      return json(200, { ok: true, session });
    }

    // 4. POST /api/payments/process
    if (pathname === '/api/payments/process' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const badKey = containsRawCardData(body);
      if (badKey) {
        return json(400, {
          ok: false,
          code: 'raw_card_rejected',
          error: 'Security error: Raw card numbers or security codes must not be sent directly. Use tokenized card entry.',
        });
      }

      const rawAppId = String(body.app_id || '').trim();
      const targetApplicantId = String(body.applicant_id || '').trim();
      const cardholderName = String(body.cardholder_name || '').trim();
      const paymentToken = String(body.payment_token || '').trim();
      const cardMeta = (body.card_meta && typeof body.card_meta === 'object') ? body.card_meta : {};

      if (!rawAppId) return json(400, { ok: false, error: 'Application ID is required.' });

      const { appRow, canonicalAppId: appId, applicants, txs: existingTxs } = await loadAppBundle(env, rawAppId, true);
      if (!appRow) {
        return json(404, { ok: false, error: 'Application not found.' });
      }

      const currentSession = buildPublicSessionPayload(appId, appRow, applicants, existingTxs, targetApplicantId);
      const isIndividualMode = currentSession.household_payment_mode === 'individual';
      const resolvedTarget = isIndividualMode
        ? (currentSession.applicants.find((a) => String(a.id || '') === String(currentSession.applicant_id || '')) || currentSession.applicants[0] || null)
        : null;

      if (currentSession.payment_status === 'paid' || currentSession.application_payment_state === PAYMENT_STATES.CONFIRMED) {
        await attachReceiptTokenIfPaid(env, currentSession);
        return json(200, {
          ok: true,
          alreadyPaid: true,
          session: currentSession,
          message: 'Payment has already been confirmed for this step.',
        });
      }

      const amountDue = Number(currentSession.amount_due_now ?? currentSession.application_fee ?? 0);
      if (amountDue <= 0) {
        const now = new Date().toISOString();
        if (isIndividualMode && resolvedTarget?.id) {
          await patchApplicant(env, resolvedTarget.id, {
            payment_status: 'waived',
            application_payment_state: PAYMENT_STATES.CONFIRMED,
            payment_amount: 0,
            payment_confirmed_at: now,
          });
          const refreshedApplicants = await fetchApplicants(env, appId);
          const allPaid = refreshedApplicants.every((a) => ['paid', 'waived'].includes(String(a.payment_status || '').toLowerCase()));
          if (allPaid) {
            await patchApplication(env, appId, {
              payment_status: 'waived',
              application_payment_state: PAYMENT_STATES.CONFIRMED,
              payment_confirmed_at: now,
              updated_at: now,
            });
          }
          return json(200, {
            ok: true,
            session: buildPublicSessionPayload(appId, allPaid ? { ...appRow, payment_status: 'waived' } : appRow, refreshedApplicants, existingTxs, resolvedTarget.id),
          });
        }
        const patch = {
          payment_status: 'waived',
          application_payment_state: PAYMENT_STATES.CONFIRMED,
          payment_confirmed_at: now,
          updated_at: now,
        };
        await patchApplication(env, appId, patch);
        return json(200, {
          ok: true,
          session: buildPublicSessionPayload(appId, { ...appRow, ...patch }, applicants, existingTxs, targetApplicantId),
        });
      }

      // Refuse to simulate a paid card transaction when live card processing is unconfigured.
      const gwConfig = getPaymentGatewayConfig(env);
      if (!gwConfig.cardProcessing.available) {
        return json(503, {
          ok: false,
          code: 'card_processing_unavailable',
          card_unavailable: true,
          message: CARD_UNAVAILABLE_MESSAGE,
          alternativeMethods: gwConfig.alternativeMethods,
          session: currentSession,
        });
      }

      if (!cardholderName || cardholderName.length < 2) {
        return json(400, { ok: false, error: 'Cardholder name is required.' });
      }

      const nextAttempt = Number(currentSession.payment_attempts_count || 0) + 1;
      const appNextAttempt = Number(appRow.payment_attempts_count || 0) + 1;
      await patchApplication(env, appId, {
        application_payment_state: PAYMENT_STATES.PROCESSING,
        payment_attempts_count: appNextAttempt,
        updated_at: new Date().toISOString(),
      });

      const outcome = processTokenizedCard({ paymentToken, cardMeta, amountDue, appId });
      const now = new Date().toISOString();

      if (outcome.ok) {
        const brand = outcome.brand || cardMeta.brand || 'Card';
        const last4 = outcome.last4 || String(cardMeta.last4 || '').slice(-4) || null;
        const methodLabel = last4 ? `${brand} •••• ${last4}` : `${brand} (Card)`;
        const paidNow = outcome.amountPaid ?? amountDue;

        if (isIndividualMode && resolvedTarget) {
          if (resolvedTarget.id) {
            await patchApplicant(env, resolvedTarget.id, {
              payment_status: 'paid',
              application_payment_state: PAYMENT_STATES.SUCCESSFUL,
              payment_amount: paidNow,
              payment_provider: 'card_gateway',
              payment_transaction_ref: outcome.txRef,
              payment_card_brand: brand,
              payment_card_last4: last4,
              payment_failure_code: null,
              payment_failure_reason: null,
              payment_attempts_count: nextAttempt,
              payment_assistance_required: false,
              payment_confirmed_at: now,
            });
          }

          const refreshedApplicants = await fetchApplicants(env, appId);
          const membersToSum = refreshedApplicants.length > 0 ? refreshedApplicants : currentSession.applicants;
          let paidCount = 0;
          let totalCollected = 0;
          for (const m of membersToSum) {
            const st = String(m.payment_status || 'unpaid').toLowerCase();
            if (st === 'paid' || st === 'waived') {
              paidCount += 1;
              totalCollected += Number(m.payment_amount ?? m.screening_fee_amount ?? 0);
            }
          }
          const allPaid = membersToSum.length > 0 && paidCount === membersToSum.length;

          const appPatch = {
            payment_status: allPaid ? 'paid' : 'unpaid',
            payment_date: allPaid ? now : (appRow.payment_date || null),
            payment_confirmed_at: allPaid ? now : (appRow.payment_confirmed_at || null),
            payment_amount_collected: totalCollected,
            payment_amount_recorded: totalCollected,
            payment_method_confirmed: methodLabel,
            payment_method_recorded: methodLabel,
            payment_transaction_ref: outcome.txRef,
            application_payment_state: allPaid ? PAYMENT_STATES.SUCCESSFUL : PAYMENT_STATES.AWAITING,
            payment_provider: 'card_gateway',
            payment_card_brand: brand,
            payment_card_last4: last4,
            payment_failure_code: null,
            payment_failure_reason: null,
            payment_attempts_count: appNextAttempt,
            payment_assistance_required: false,
            updated_at: now,
          };

          await patchApplication(env, appId, appPatch);
          await logTransaction(env, {
            application_id: appRow.id || null,
            app_id: appId,
            applicant_id: resolvedTarget.id || null,
            payer_name: cardholderName,
            transaction_ref: outcome.txRef,
            provider: 'card_gateway',
            state: PAYMENT_STATES.SUCCESSFUL,
            amount: paidNow,
            card_brand: brand,
            card_last4: last4,
            attempt_number: nextAttempt,
            metadata: { cardholder_name: cardholderName, household_payment_mode: 'individual', applicant_id: resolvedTarget.id || null },
          });

          const confirmData = await triggerPostPaymentConfirmation(env, context, appId, resolvedTarget.id || null);

          const refreshedTxs = await fetchTransactions(env, appId);
          const updatedSession = await attachReceiptTokenIfPaid(
            env,
            buildPublicSessionPayload(appId, { ...appRow, ...appPatch }, refreshedApplicants, refreshedTxs, resolvedTarget.id || targetApplicantId),
            confirmData
          );
          return json(200, {
            ok: true,
            transaction_ref: outcome.txRef,
            provider: 'card_gateway',
            session: updatedSession,
          });
        }

        // Option A: Centralized full household payment
        const dbPatch = {
          payment_status: 'paid',
          payment_date: now,
          payment_confirmed_at: now,
          payment_amount_collected: paidNow,
          payment_amount_recorded: paidNow,
          payment_method_confirmed: methodLabel,
          payment_method_recorded: methodLabel,
          payment_transaction_ref: outcome.txRef,
          application_payment_state: PAYMENT_STATES.SUCCESSFUL,
          payment_provider: 'card_gateway',
          payment_card_brand: brand,
          payment_card_last4: last4,
          payment_failure_code: null,
          payment_failure_reason: null,
          payment_attempts_count: appNextAttempt,
          payment_assistance_required: false,
          updated_at: now,
        };

        await Promise.all([
          patchApplication(env, appId, dbPatch),
          patchAllApplicants(env, appId, {
            payment_status: 'paid',
            application_payment_state: PAYMENT_STATES.SUCCESSFUL,
            payment_provider: 'card_gateway',
            payment_transaction_ref: outcome.txRef,
            payment_card_brand: brand,
            payment_card_last4: last4,
            payment_failure_code: null,
            payment_failure_reason: null,
            payment_assistance_required: false,
            payment_confirmed_at: now,
          }),
        ]);
        await logTransaction(env, {
          application_id: appRow.id || null,
          app_id: appId,
          payer_name: cardholderName,
          transaction_ref: outcome.txRef,
          provider: 'card_gateway',
          state: PAYMENT_STATES.SUCCESSFUL,
          amount: paidNow,
          card_brand: brand,
          card_last4: last4,
          attempt_number: appNextAttempt,
          metadata: { cardholder_name: cardholderName, household_payment_mode: 'centralized' },
        });

        const confirmData = await triggerPostPaymentConfirmation(env, context, appId, null);

        const [refreshedApplicants, refreshedTxs] = await Promise.all([
          fetchApplicants(env, appId),
          fetchTransactions(env, appId),
        ]);
        const updatedSession = await attachReceiptTokenIfPaid(
          env,
          buildPublicSessionPayload(appId, { ...appRow, ...dbPatch }, refreshedApplicants, refreshedTxs, targetApplicantId),
          confirmData
        );
        return json(200, {
          ok: true,
          transaction_ref: outcome.txRef,
          provider: 'card_gateway',
          session: updatedSession,
        });
      }

      // Failed card attempt
      const brand = outcome.brand || cardMeta.brand || 'Card';
      const last4 = outcome.last4 || String(cardMeta.last4 || '').slice(-4) || null;
      const failPatch = {
        payment_status: 'unpaid',
        application_payment_state: PAYMENT_STATES.FAILED,
        payment_provider: 'card_gateway',
        payment_transaction_ref: outcome.txRef,
        payment_card_brand: brand,
        payment_card_last4: last4,
        payment_failure_code: outcome.code || 'card_verification_declined',
        payment_failure_reason: RECOMMENDED_FAILURE_MESSAGE,
        payment_attempts_count: appNextAttempt,
        updated_at: now,
      };

      if (isIndividualMode && resolvedTarget?.id) {
        await patchApplicant(env, resolvedTarget.id, {
          payment_status: 'unpaid',
          application_payment_state: PAYMENT_STATES.FAILED,
          payment_provider: 'card_gateway',
          payment_transaction_ref: outcome.txRef,
          payment_card_brand: brand,
          payment_card_last4: last4,
          payment_failure_code: outcome.code || 'card_verification_declined',
          payment_failure_reason: RECOMMENDED_FAILURE_MESSAGE,
          payment_attempts_count: nextAttempt,
        });
      }

      await patchApplication(env, appId, failPatch);
      await logTransaction(env, {
        application_id: appRow.id || null,
        app_id: appId,
        applicant_id: resolvedTarget?.id || null,
        payer_name: cardholderName,
        transaction_ref: outcome.txRef,
        provider: 'card_gateway',
        state: PAYMENT_STATES.FAILED,
        amount: amountDue,
        card_brand: brand,
        card_last4: last4,
        failure_code: outcome.code || 'card_verification_declined',
        failure_reason: RECOMMENDED_FAILURE_MESSAGE,
        attempt_number: nextAttempt,
      });

      const [refreshedApplicants, refreshedTxs] = await Promise.all([
        fetchApplicants(env, appId),
        fetchTransactions(env, appId),
      ]);
      return json(402, {
        ok: false,
        code: outcome.code || 'card_verification_declined',
        message: RECOMMENDED_FAILURE_MESSAGE,
        transaction_ref: outcome.txRef,
        session: buildPublicSessionPayload(appId, { ...appRow, ...failPatch }, refreshedApplicants, refreshedTxs, resolvedTarget?.id || targetApplicantId),
      });
    }

    // 4B. POST /api/payments/select-method
    if (pathname === '/api/payments/select-method' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const rawAppId = String(body.app_id || '').trim();
      const targetApplicantId = String(body.applicant_id || '').trim();
      const chosenMethod = String(body.method || '').trim().toLowerCase();

      if (!rawAppId) return json(400, { ok: false, error: 'app_id is required.' });
      if (!chosenMethod) return json(400, { ok: false, error: 'Payment method is required.' });

      const { appRow, canonicalAppId: appId, applicants, txs: existingTxs } = await loadAppBundle(env, rawAppId, true);
      if (!appRow) return json(404, { ok: false, error: 'Application not found.' });

      const currentSession = buildPublicSessionPayload(appId, appRow, applicants, existingTxs, targetApplicantId);
      if (currentSession.payment_status === 'paid' || currentSession.payment_status === 'waived' || currentSession.application_payment_state === PAYMENT_STATES.CONFIRMED) {
        await attachReceiptTokenIfPaid(env, currentSession);
        return json(200, { ok: true, alreadyPaid: true, session: currentSession });
      }

      const gwConfig = getPaymentGatewayConfig(env);
      if (chosenMethod === 'card') {
        if (!gwConfig.cardProcessing.available) {
          return json(503, {
            ok: false,
            code: 'card_processing_unavailable',
            card_unavailable: true,
            message: CARD_UNAVAILABLE_MESSAGE,
            alternativeMethods: gwConfig.alternativeMethods,
            session: currentSession,
          });
        }
      } else {
        const alt = gwConfig.alternativeMethods.find((m) => m.id === chosenMethod);
        if (!alt) return json(400, { ok: false, error: 'Unsupported payment method selected.' });
        if (!alt.available || !alt.configured) {
          return json(400, {
            ok: false,
            code: 'method_not_configured',
            error: alt.unavailableReason || `${alt.name} is not currently configured for this checkout.`,
            method: alt,
            session: currentSession,
          });
        }
      }

      const isIndividualMode = currentSession.household_payment_mode === 'individual';
      const resolvedTarget = isIndividualMode
        ? (currentSession.applicants.find((a) => String(a.id || '') === String(currentSession.applicant_id || '')) || currentSession.applicants[0] || null)
        : null;

      const now = new Date().toISOString();
      const txRef = `CP-SEL-${chosenMethod.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)}-${randomHex(3)}`;
      const methodLabel = chosenMethod === 'card'
        ? 'Debit / Credit Card'
        : (gwConfig.alternativeMethods.find((m) => m.id === chosenMethod)?.name || chosenMethod);

      const selectPatch = {
        payment_status: 'unpaid',
        selected_payment_method: chosenMethod,
        payment_provider: chosenMethod,
        application_payment_state: PAYMENT_STATES.METHOD_SELECTED,
        updated_at: now,
      };

      if (isIndividualMode && resolvedTarget?.id) {
        await patchApplicant(env, resolvedTarget.id, {
          selected_payment_method: chosenMethod,
          payment_provider: chosenMethod,
          application_payment_state: PAYMENT_STATES.METHOD_SELECTED,
        });
      }

      await patchApplication(env, appId, selectPatch);
      await logTransaction(env, {
        application_id: appRow.id || null,
        app_id: appId,
        applicant_id: resolvedTarget?.id || null,
        payer_name: currentSession.applicant_name || null,
        transaction_ref: txRef,
        provider: chosenMethod,
        state: PAYMENT_STATES.METHOD_SELECTED,
        amount: Number(currentSession.amount_due_now ?? currentSession.application_fee ?? 0),
        attempt_number: Number(currentSession.payment_attempts_count || 0),
        metadata: { method: chosenMethod, method_label: methodLabel },
      });

      const [refreshedApplicants, refreshedTxs] = await Promise.all([
        fetchApplicants(env, appId),
        fetchTransactions(env, appId),
      ]);

      return json(200, {
        ok: true,
        selected_method: chosenMethod,
        session: buildPublicSessionPayload(
          appId,
          { ...appRow, ...selectPatch },
          refreshedApplicants,
          refreshedTxs,
          resolvedTarget?.id || targetApplicantId
        ),
      });
    }

    // 4C. POST /api/payments/submit-external
    if (pathname === '/api/payments/submit-external' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const badKey = containsRawCardData(body);
      if (badKey) {
        return json(400, { ok: false, error: 'Raw card credentials are never permitted by this API.' });
      }

      const rawAppId = String(body.app_id || '').trim();
      const targetApplicantId = String(body.applicant_id || '').trim();
      const chosenMethod = String(body.method || '').trim().toLowerCase();
      const externalRef = String(body.external_reference || '').trim().slice(0, 120);
      const payerHandle = String(body.payer_handle || '').trim().slice(0, 120);
      const payerName = String(body.payer_name || '').trim().slice(0, 120);
      const note = String(body.note || '').trim().slice(0, 300);
      const confirmedExternal = Boolean(body.confirmed_external);

      if (!rawAppId) return json(400, { ok: false, error: 'Application ID is required.' });
      if (!chosenMethod) return json(400, { ok: false, error: 'Selected payment method is required.' });
      if (!confirmedExternal) {
        return json(400, { ok: false, error: 'Please confirm that you completed the external payment before submitting for verification.' });
      }

      const gwConfig = getPaymentGatewayConfig(env);
      const alt = gwConfig.alternativeMethods.find((m) => m.id === chosenMethod);
      if (!alt || !alt.available || !alt.configured) {
        return json(400, {
          ok: false,
          code: 'method_not_configured',
          error: alt?.unavailableReason || 'Selected alternative payment method is not currently configured.',
        });
      }

      const { appRow, canonicalAppId: appId, applicants, txs: existingTxs } = await loadAppBundle(env, rawAppId, true);
      if (!appRow) return json(404, { ok: false, error: 'Application not found.' });

      const currentSession = buildPublicSessionPayload(appId, appRow, applicants, existingTxs, targetApplicantId);
      if (currentSession.payment_status === 'paid' || currentSession.payment_status === 'waived' || currentSession.application_payment_state === PAYMENT_STATES.CONFIRMED) {
        await attachReceiptTokenIfPaid(env, currentSession);
        return json(200, { ok: true, alreadyPaid: true, session: currentSession });
      }

      const isIndividualMode = currentSession.household_payment_mode === 'individual';
      const resolvedTarget = isIndividualMode
        ? (currentSession.applicants.find((a) => String(a.id || '') === String(currentSession.applicant_id || '')) || currentSession.applicants[0] || null)
        : null;

      const amountDue = Number(currentSession.amount_due_now ?? currentSession.application_fee ?? 0);
      const now = new Date().toISOString();
      const txRef = `CP-EXT-${chosenMethod.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)}-${randomHex(4)}`;
      const referenceDisplay = externalRef || payerHandle || `${alt.name} external transfer (${payerName || currentSession.applicant_name || 'Applicant'})`;
      const existingNotes = String(appRow.payment_notes || '').trim();
      const combinedNote = [
        `[${alt.name} Verification Submitted ${now.slice(0, 10)}] Ref: ${referenceDisplay}`,
        payerHandle ? `Sender: ${payerHandle}` : '',
        note ? `Note: ${note}` : '',
      ].filter(Boolean).join(' · ');
      const mergedPaymentNotes = existingNotes ? `${combinedNote}\n${existingNotes}`.slice(0, 1000) : combinedNote.slice(0, 1000);

      const verifyPatch = {
        payment_status: 'unpaid',
        application_payment_state: PAYMENT_STATES.SUBMITTED_FOR_VERIFICATION,
        selected_payment_method: chosenMethod,
        payment_provider: chosenMethod,
        external_payment_reference: referenceDisplay,
        payment_submitted_at: now,
        payment_transaction_ref: txRef,
        payment_method_recorded: `${alt.name} (Pending Verification)`,
        payment_amount_recorded: amountDue,
        payment_notes: mergedPaymentNotes,
        updated_at: now,
      };

      if (isIndividualMode && resolvedTarget?.id) {
        await patchApplicant(env, resolvedTarget.id, {
          payment_status: 'unpaid',
          application_payment_state: PAYMENT_STATES.SUBMITTED_FOR_VERIFICATION,
          selected_payment_method: chosenMethod,
          payment_provider: chosenMethod,
          external_payment_reference: referenceDisplay,
          payment_submitted_at: now,
          payment_transaction_ref: txRef,
        });
      }

      await patchApplication(env, appId, verifyPatch);
      await logTransaction(env, {
        application_id: appRow.id || null,
        app_id: appId,
        applicant_id: resolvedTarget?.id || null,
        payer_name: payerName || currentSession.applicant_name || null,
        transaction_ref: txRef,
        provider: chosenMethod,
        state: PAYMENT_STATES.SUBMITTED_FOR_VERIFICATION,
        amount: amountDue,
        attempt_number: Number(currentSession.payment_attempts_count || 0),
        metadata: {
          method: chosenMethod,
          method_name: alt.name,
          external_reference: externalRef || null,
          payer_handle: payerHandle || null,
          note: note || null,
          requires_manual_verification: true,
        },
      });

      const [refreshedApplicants, refreshedTxs] = await Promise.all([
        fetchApplicants(env, appId),
        fetchTransactions(env, appId),
      ]);

      return json(200, {
        ok: true,
        verification_pending: true,
        transaction_ref: txRef,
        message: `${alt.name} payment details submitted for verification. Our Leasing Desk will confirm your transfer before marking your fee paid.`,
        session: buildPublicSessionPayload(
          appId,
          { ...appRow, ...verifyPatch },
          refreshedApplicants,
          refreshedTxs,
          resolvedTarget?.id || targetApplicantId
        ),
      });
    }

    // 4D. POST /api/payments/cancel
    if (pathname === '/api/payments/cancel' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const rawAppId = String(body.app_id || '').trim();
      const targetApplicantId = String(body.applicant_id || '').trim();
      const reason = String(body.reason || 'Applicant cancelled payment selection to complete later.').trim().slice(0, 240);

      if (!rawAppId) return json(400, { ok: false, error: 'app_id is required.' });

      const { appRow, canonicalAppId: appId, applicants, txs: existingTxs } = await loadAppBundle(env, rawAppId, true);
      if (!appRow) return json(404, { ok: false, error: 'Application not found.' });

      const currentSession = buildPublicSessionPayload(appId, appRow, applicants, existingTxs, targetApplicantId);
      if (currentSession.payment_status === 'paid' || currentSession.payment_status === 'waived' || currentSession.application_payment_state === PAYMENT_STATES.CONFIRMED) {
        await attachReceiptTokenIfPaid(env, currentSession);
        return json(200, { ok: true, alreadyPaid: true, session: currentSession });
      }

      const isIndividualMode = currentSession.household_payment_mode === 'individual';
      const resolvedTarget = isIndividualMode
        ? (currentSession.applicants.find((a) => String(a.id || '') === String(currentSession.applicant_id || '')) || currentSession.applicants[0] || null)
        : null;

      const now = new Date().toISOString();
      const txRef = `CP-CAN-${randomHex(4)}`;
      const cancelPatch = {
        payment_status: 'unpaid',
        application_payment_state: PAYMENT_STATES.CANCELLED,
        updated_at: now,
      };

      if (isIndividualMode && resolvedTarget?.id) {
        await patchApplicant(env, resolvedTarget.id, {
          payment_status: 'unpaid',
          application_payment_state: PAYMENT_STATES.CANCELLED,
        });
      }

      await patchApplication(env, appId, cancelPatch);
      await logTransaction(env, {
        application_id: appRow.id || null,
        app_id: appId,
        applicant_id: resolvedTarget?.id || null,
        payer_name: currentSession.applicant_name || null,
        transaction_ref: txRef,
        provider: currentSession.selected_payment_method || 'checkout',
        state: PAYMENT_STATES.CANCELLED,
        amount: Number(currentSession.amount_due_now ?? currentSession.application_fee ?? 0),
        attempt_number: Number(currentSession.payment_attempts_count || 0),
        metadata: { reason },
      });

      const [refreshedApplicants, refreshedTxs] = await Promise.all([
        fetchApplicants(env, appId),
        fetchTransactions(env, appId),
      ]);

      return json(200, {
        ok: true,
        cancelled: true,
        session: buildPublicSessionPayload(
          appId,
          { ...appRow, ...cancelPatch },
          refreshedApplicants,
          refreshedTxs,
          resolvedTarget?.id || targetApplicantId
        ),
      });
    }

    // 5. POST /api/payments/assistance
    if (pathname === '/api/payments/assistance' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const rawAppId = String(body.app_id || '').trim();
      const targetApplicantId = String(body.applicant_id || '').trim();
      const note = String(body.note || '').trim().slice(0, 500);
      if (!rawAppId) return json(400, { ok: false, error: 'app_id is required' });

      const { appRow, canonicalAppId: appId, applicants, txs } = await loadAppBundle(env, rawAppId, true);
      if (!appRow) return json(404, { ok: false, error: 'Application not found' });

      const now = new Date().toISOString();
      const assistPatch = {
        application_payment_state: PAYMENT_STATES.ASSISTANCE,
        payment_assistance_required: true,
        payment_assistance_requested_at: now,
        updated_at: now,
      };
      if (note) assistPatch.payment_notes = note;
      await patchApplication(env, appId, assistPatch);

      if (targetApplicantId) {
        await patchApplicant(env, targetApplicantId, {
          application_payment_state: PAYMENT_STATES.ASSISTANCE,
          payment_assistance_required: true,
        });
      }

      return json(200, {
        ok: true,
        session: buildPublicSessionPayload(appId, { ...appRow, ...assistPatch }, applicants, txs, targetApplicantId),
        support: {
          phone: '707-706-3137',
          email: 'choiceproperties404@gmail.com',
          message: 'Your application has been flagged for Payment Assistance Required. Our support team can assist you directly while your submitted application remains active.',
        },
      });
    }

    // 6. POST /api/payments/resolve-assistance (Admin only)
    if (pathname === '/api/payments/resolve-assistance' && method === 'POST') {
      const auth = await verifyAdminJwt(env, request.headers.get('authorization'));
      if (!auth.ok) return json(401, { ok: false, error: 'Administrator authentication required' });

      const body = await request.json().catch(() => ({}));
      const appId = String(body.app_id || '').trim();
      if (!appId) return json(400, { ok: false, error: 'app_id is required' });

      const nextState = body.next_state && Object.values(PAYMENT_STATES).includes(body.next_state)
        ? body.next_state
        : PAYMENT_STATES.AWAITING;
      await Promise.all([
        patchApplication(env, appId, {
          application_payment_state: nextState,
          payment_assistance_required: false,
          updated_at: new Date().toISOString(),
        }),
        patchAllApplicants(env, appId, {
          payment_assistance_required: false,
        }),
      ]);
      return json(200, { ok: true, application_payment_state: nextState });
    }

    // 7. GET /api/payments/ledger (Admin only)
    if (pathname === '/api/payments/ledger' && method === 'GET') {
      const auth = await verifyAdminJwt(env, request.headers.get('authorization'));
      if (!auth.ok) return json(401, { ok: false, error: 'Administrator authentication required' });

      const extCols = 'app_id,household_payment_mode,application_payment_state,payment_provider,payment_transaction_ref,payment_card_brand,payment_card_last4,payment_failure_code,payment_failure_reason,payment_attempts_count,payment_assistance_required,payment_assistance_requested_at,selected_payment_method,external_payment_reference,payment_submitted_at';
      const baseCols = 'app_id,household_payment_mode,application_payment_state,payment_provider,payment_transaction_ref,payment_card_brand,payment_card_last4,payment_failure_code,payment_failure_reason,payment_attempts_count,payment_assistance_required,payment_assistance_requested_at';

      const [rExt, transactions] = await Promise.all([
        sbFetch(env, `/rest/v1/applications?select=${extCols}&order=created_at.desc&limit=200`),
        fetchAllTransactions(env, 150),
      ]);
      const r = rExt.ok
        ? rExt
        : await sbFetch(env, `/rest/v1/applications?select=${baseCols}&order=created_at.desc&limit=200`);
      if (!r.ok) return json(200, { ok: true, records: {}, transactions });
      const rows = await r.json().catch(() => []);
      const records = {};
      for (const row of Array.isArray(rows) ? rows : []) {
        if (row.app_id) records[row.app_id] = row;
      }
      return json(200, { ok: true, records, transactions });
    }

    return json(404, { ok: false, error: 'Payment endpoint not found' });
  } catch (err) {
    return json(500, { ok: false, error: err?.message || 'Internal payment service error' });
  }
}
