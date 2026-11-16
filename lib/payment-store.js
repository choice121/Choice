/**
 * Choice Properties — Tokenized Payment State Store
 * Persists the 6-state application payment workflow alongside Supabase:
 *   - Application Submitted
 *   - Awaiting Payment
 *   - Payment Processing
 *   - Payment Successful
 *   - Payment Failed
 *   - Payment Assistance Required
 *
 * SECURITY INVARIANT:
 *   NEVER stores raw card numbers, PANs, CVV, CVC, or expiration security data.
 *   Only stores opaque provider/demo token references and masked brand/last4.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(process.cwd(), 'data', 'customer-memory');
const LEDGER_FILE = path.join(DATA_DIR, 'payments.json');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const PAYMENT_STATES = Object.freeze({
  REQUIRED: 'Payment Required',
  METHOD_SELECTED: 'Payment Method Selected',
  AWAITING: 'Awaiting Payment',
  SUBMITTED_FOR_VERIFICATION: 'Payment Submitted for Verification',
  CONFIRMED: 'Payment Confirmed',
  UNSUCCESSFUL: 'Payment Unsuccessful',
  CANCELLED: 'Payment Cancelled',
  // Legacy keys & assistance state mapped cleanly
  SUBMITTED: 'Application Submitted',
  PROCESSING: 'Payment Processing',
  SUCCESSFUL: 'Payment Confirmed',
  FAILED: 'Payment Unsuccessful',
  ASSISTANCE: 'Payment Assistance Required',
});

const GRANULAR_UNPAID_STATES = new Set([
  PAYMENT_STATES.REQUIRED,
  PAYMENT_STATES.METHOD_SELECTED,
  PAYMENT_STATES.AWAITING,
  PAYMENT_STATES.SUBMITTED_FOR_VERIFICATION,
  PAYMENT_STATES.UNSUCCESSFUL,
  PAYMENT_STATES.CANCELLED,
  PAYMENT_STATES.ASSISTANCE,
  PAYMENT_STATES.PROCESSING,
  'Payment Failed',
]);

function normalizePaymentState(rawState, paymentStatus) {
  const status = String(paymentStatus || '').toLowerCase();
  if (status === 'paid' || status === 'waived') return PAYMENT_STATES.CONFIRMED;
  const s = String(rawState || '').trim();
  if (!s || s === 'Application Submitted' || s === 'Application Started') return PAYMENT_STATES.REQUIRED;
  if (s === 'Payment Successful') return PAYMENT_STATES.CONFIRMED;
  if (s === 'Payment Failed') return PAYMENT_STATES.UNSUCCESSFUL;
  return s;
}

function toDbSafePaymentState(stateStr) {
  const s = String(stateStr || '').trim();
  if (s === PAYMENT_STATES.CONFIRMED || s === 'Payment Successful') return 'Payment Successful';
  if (s === PAYMENT_STATES.UNSUCCESSFUL || s === 'Payment Failed') return 'Payment Failed';
  if (s === PAYMENT_STATES.ASSISTANCE) return 'Payment Assistance Required';
  if (s === PAYMENT_STATES.PROCESSING) return 'Payment Processing';
  return 'Awaiting Payment';
}

let state = {
  records: {}, // app_id -> normalized payment state & masked tx history
};

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadLocal() {
  try {
    if (fs.existsSync(LEDGER_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8'));
      if (parsed && parsed.records && typeof parsed.records === 'object') {
        state.records = parsed.records;
      }
    }
  } catch (err) {
    console.warn('Warning reading local payment ledger:', err.message);
  }
}

function saveLocal() {
  try {
    ensureDir();
    fs.writeFileSync(
      LEDGER_FILE,
      JSON.stringify({ records: state.records, updated_at: new Date().toISOString() }, null, 2),
      'utf8'
    );
  } catch (err) {
    console.warn('Warning saving local payment ledger:', err.message);
  }
}

loadLocal();

async function supabaseFetch(relPath, options = {}) {
  const url = `${SUPABASE_URL.replace(/\/$/, '')}${relPath}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  return res;
}

async function verifyAdminJwt(authHeader) {
  const token = String(authHeader || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false };
  try {
    const uRes = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!uRes.ok) return { ok: false };
    const user = await uRes.json();
    if (!user || !user.id) return { ok: false };
    const rRes = await supabaseFetch(`/rest/v1/admin_roles?user_id=eq.${encodeURIComponent(user.id)}&select=id&limit=1`);
    if (!rRes.ok) return { ok: false };
    const roles = await rRes.json().catch(() => []);
    return { ok: Array.isArray(roles) && roles.length > 0, user };
  } catch (_) {
    return { ok: false };
  }
}

function derivePaymentState(appRow, localRecord, transactions = []) {
  const dbStatus = String(appRow?.payment_status || localRecord?.payment_status || 'unpaid').toLowerCase();
  if (dbStatus === 'paid' || dbStatus === 'waived') return PAYMENT_STATES.CONFIRMED;
  if (appRow?.payment_assistance_required || localRecord?.payment_assistance_required) return PAYMENT_STATES.ASSISTANCE;

  const dbState = appRow?.application_payment_state ? normalizePaymentState(appRow.application_payment_state, dbStatus) : '';
  const localState = localRecord?.application_payment_state ? normalizePaymentState(localRecord.application_payment_state, dbStatus) : '';

  if (dbState && dbState !== PAYMENT_STATES.AWAITING && dbState !== PAYMENT_STATES.REQUIRED) {
    return dbState;
  }
  if (localState && localState !== PAYMENT_STATES.AWAITING && localState !== PAYMENT_STATES.REQUIRED) {
    return localState;
  }
  if (Array.isArray(transactions) && transactions.length > 0) {
    const latestState = normalizePaymentState(transactions[0]?.state, dbStatus);
    if (latestState && GRANULAR_UNPAID_STATES.has(latestState) && latestState !== PAYMENT_STATES.AWAITING) {
      return latestState;
    }
  }
  if (localState) return localState;
  if (dbState) return dbState;
  return PAYMENT_STATES.REQUIRED;
}

function escapeLike(val) {
  return String(val || '').replace(/[\\%_]/g, (m) => `\\${m}`);
}

async function fetchApplicationFromSupabase(appId) {
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
    'selected_payment_method', 'external_payment_reference', 'payment_submitted_at'
  ].join(',');

  const prevExtendedCols = [
    'id', 'app_id', 'created_at', 'updated_at', 'status', 'payment_status', 'payment_date',
    'application_fee', 'application_fee_per_adult', 'household_payment_mode', 'additional_info_note',
    'fee_breakdown', 'jurisdiction_fee_note',
    'credit_applied_id', 'first_name', 'last_name', 'email', 'phone',
    'property_id', 'property_address', 'payment_confirmed_at',
    'payment_amount_collected', 'payment_amount_recorded',
    'payment_method_confirmed', 'payment_method_recorded', 'payment_transaction_ref', 'payment_notes',
    'application_payment_state', 'payment_provider', 'payment_card_brand', 'payment_card_last4',
    'payment_failure_code', 'payment_failure_reason', 'payment_attempts_count',
    'payment_assistance_required', 'payment_assistance_requested_at'
  ].join(',');

  const baseCols = [
    'id', 'app_id', 'created_at', 'updated_at', 'status', 'payment_status', 'payment_date',
    'application_fee', 'fee_breakdown', 'jurisdiction_fee_note', 'credit_applied_id',
    'first_name', 'last_name', 'email', 'phone', 'property_id', 'property_address',
    'payment_confirmed_at', 'payment_amount_collected', 'payment_amount_recorded',
    'payment_method_confirmed', 'payment_method_recorded', 'payment_transaction_ref', 'payment_notes'
  ].join(',');

  const minimalCols = [
    'id', 'app_id', 'created_at', 'updated_at', 'status', 'payment_status', 'payment_date',
    'application_fee', 'credit_applied_id', 'first_name', 'last_name', 'email', 'phone',
    'property_id', 'property_address', 'payment_confirmed_at',
    'payment_amount_collected', 'payment_amount_recorded',
    'payment_method_confirmed', 'payment_method_recorded', 'payment_notes'
  ].join(',');

  const queries = [
    `app_id=eq.${encodeURIComponent(trimmed)}`,
    `app_id=ilike.${encodeURIComponent(escapeLike(trimmed))}`,
  ];

  for (const filterExpr of queries) {
    for (const cols of [extendedCols, prevExtendedCols, baseCols, minimalCols]) {
      try {
        const res = await supabaseFetch(
          `/rest/v1/applications?${filterExpr}&select=${cols}&limit=1`
        );
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows) && rows[0]) return rows[0];
          break;
        }
        const errTxt = await res.text().catch(() => '');
        if (!/column|PGRST204|42703/i.test(errTxt)) {
          break;
        }
      } catch (_) {
        break;
      }
    }
  }
  return null;
}

async function fetchApplicantsFromSupabase(appId) {
  if (!appId) return [];
  const fullCols = [
    'id', 'applicant_index', 'applicant_type', 'is_primary', 'role', 'submission_method',
    'info_completed', 'first_name', 'last_name', 'email', 'screening_fee_amount', 'screening_consent',
    'payment_status', 'application_payment_state', 'payment_amount', 'payment_transaction_ref',
    'payment_provider', 'payment_card_brand', 'payment_card_last4', 'payment_failure_code',
    'payment_failure_reason', 'payment_attempts_count', 'payment_assistance_required', 'payment_confirmed_at',
    'selected_payment_method', 'external_payment_reference', 'payment_submitted_at'
  ].join(',');
  const prevFullCols = [
    'id', 'applicant_index', 'applicant_type', 'is_primary', 'role', 'submission_method',
    'info_completed', 'first_name', 'last_name', 'email', 'screening_fee_amount', 'screening_consent',
    'payment_status', 'application_payment_state', 'payment_amount', 'payment_transaction_ref',
    'payment_provider', 'payment_card_brand', 'payment_card_last4', 'payment_failure_code',
    'payment_failure_reason', 'payment_attempts_count', 'payment_assistance_required', 'payment_confirmed_at'
  ].join(',');
  const fallbackCols = 'id,applicant_index,applicant_type,is_primary,role,first_name,last_name,email,screening_fee_amount,screening_consent';
  for (const cols of [fullCols, prevFullCols, fallbackCols]) {
    try {
      const res = await supabaseFetch(
        `/rest/v1/application_applicants?app_id=eq.${encodeURIComponent(appId)}&select=${cols}&order=applicant_index.asc`
      );
      if (res.ok) {
        const rows = await res.json();
        return Array.isArray(rows) ? rows : [];
      }
      const errTxt = await res.text().catch(() => '');
      if (!/column|PGRST204|42703/i.test(errTxt)) break;
    } catch (_) {
      break;
    }
  }
  return [];
}

async function patchApplicantInSupabase(applicantId, patch) {
  if (!applicantId) return { ok: false };
  const tryPatch = async (payload) => {
    const res = await supabaseFetch(`/rest/v1/application_applicants?id=eq.${encodeURIComponent(applicantId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const rows = await res.json().catch(() => []);
      return { ok: true, row: Array.isArray(rows) ? rows[0] : null };
    }
    const errText = await res.text().catch(() => '');
    return {
      ok: false,
      error: errText,
      missingCol: /column|PGRST204|42703/i.test(errText),
      checkViolation: /23514|check constraint/i.test(errText),
    };
  };
  try {
    let result = await tryPatch(patch);
    if (!result.ok && (result.missingCol || result.checkViolation)) {
      const safePatch = { ...patch };
      if (result.checkViolation && safePatch.application_payment_state) {
        safePatch.application_payment_state = toDbSafePaymentState(safePatch.application_payment_state);
      }
      if (result.missingCol) {
        delete safePatch.selected_payment_method;
        delete safePatch.external_payment_reference;
        delete safePatch.payment_submitted_at;
      }
      result = await tryPatch(safePatch);
    }
    return result;
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function patchAllApplicantsInSupabase(appId, patch) {
  if (!appId) return { ok: false };
  try {
    const res = await supabaseFetch(`/rest/v1/application_applicants?app_id=eq.${encodeURIComponent(appId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(patch),
    });
    return { ok: res.ok };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function fetchTransactionsFromSupabase(appId) {
  if (!appId) return [];
  try {
    const res = await supabaseFetch(
      `/rest/v1/application_payment_transactions?app_id=eq.${encodeURIComponent(appId)}&select=id,app_id,applicant_id,payer_name,transaction_ref,provider,state,amount,currency,card_brand,card_last4,failure_code,failure_reason,attempt_number,created_at&order=created_at.desc&limit=25`
    );
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  } catch (_) {
    return [];
  }
}

async function fetchAllTransactionsFromSupabase(limit = 150) {
  try {
    const res = await supabaseFetch(
      `/rest/v1/application_payment_transactions?select=id,app_id,applicant_id,payer_name,transaction_ref,provider,state,amount,currency,card_brand,card_last4,failure_code,failure_reason,attempt_number,created_at&order=created_at.desc&limit=${Number(limit) || 150}`
    );
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  } catch (_) {
    return [];
  }
}

async function syncApplicationPatchToSupabase(appId, patch) {
  if (!appId) return { ok: false, fallbackOnly: true };
  // Try full patch first; if any migration column or updated state check constraint
  // hasn't been applied on remote Supabase yet, fall back cleanly without failing.
  const tryPatch = async (payload) => {
    if (!payload || Object.keys(payload).length === 0) return { ok: false, skipped: true };
    const res = await supabaseFetch(`/rest/v1/applications?app_id=eq.${encodeURIComponent(appId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const rows = await res.json().catch(() => []);
      return { ok: true, row: Array.isArray(rows) ? rows[0] : null };
    }
    const errText = await res.text().catch(() => '');
    return {
      ok: false,
      error: errText,
      missingCol: /column|PGRST204|42703/i.test(errText),
      checkViolation: /23514|check constraint|applications_payment_state_check/i.test(errText),
    };
  };

  let result = await tryPatch(patch);
  if (!result.ok && (result.missingCol || result.checkViolation)) {
    const nextPatch = { ...patch };
    if (result.checkViolation && nextPatch.application_payment_state) {
      nextPatch.application_payment_state = toDbSafePaymentState(nextPatch.application_payment_state);
    }
    if (result.missingCol) {
      delete nextPatch.selected_payment_method;
      delete nextPatch.external_payment_reference;
      delete nextPatch.payment_submitted_at;
    }
    result = await tryPatch(nextPatch);
  }
  if (!result.ok && (result.missingCol || result.checkViolation)) {
    const baseAllowed = new Set([
      'payment_status', 'payment_date', 'payment_confirmed_at',
      'payment_amount_collected', 'payment_amount_recorded',
      'payment_method_confirmed', 'payment_method_recorded',
      'payment_transaction_ref', 'payment_notes', 'updated_at'
    ]);
    const reduced = {};
    for (const [k, v] of Object.entries(patch)) {
      if (baseAllowed.has(k)) reduced[k] = v;
    }
    result = await tryPatch(reduced);
    if (!result.ok && result.missingCol) {
      delete reduced.payment_transaction_ref;
      result = await tryPatch(reduced);
    }
  }
  return result;
}

async function logPaymentTransactionToSupabase(tx) {
  try {
    await supabaseFetch('/rest/v1/application_payment_transactions', {
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
        currency: tx.currency || 'usd',
        card_brand: tx.card_brand || null,
        card_last4: tx.card_last4 || null,
        failure_code: tx.failure_code || null,
        failure_reason: tx.failure_reason || null,
        attempt_number: tx.attempt_number || 1,
        metadata: tx.metadata || {},
      }),
    });
  } catch (_) {
    // Non-fatal if migration hasn't been applied yet; local ledger preserves full audit log
  }
}

function getLocalRecord(appId) {
  const trimmed = String(appId || '').trim();
  if (!trimmed) return null;
  if (state.records[trimmed]) return state.records[trimmed];
  const lower = trimmed.toLowerCase();
  const matchKey = Object.keys(state.records).find((k) => k.toLowerCase() === lower);
  return matchKey ? state.records[matchKey] : null;
}

function upsertLocalRecord(appId, updates) {
  const now = new Date().toISOString();
  const prev = state.records[appId] || {
    app_id: appId,
    created_at: now,
    application_payment_state: PAYMENT_STATES.REQUIRED,
    payment_status: 'unpaid',
    payment_attempts_count: 0,
    transactions: [],
  };
  const next = {
    ...prev,
    ...updates,
    app_id: appId,
    updated_at: now,
  };
  state.records[appId] = next;
  saveLocal();
  return next;
}

function appendLocalTransaction(appId, tx) {
  const rec = getLocalRecord(appId) || upsertLocalRecord(appId, {});
  const list = Array.isArray(rec.transactions) ? rec.transactions.slice() : [];
  list.unshift({
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    ...tx,
  });
  return upsertLocalRecord(appId, { transactions: list.slice(0, 25) });
}

function getAllLocalRecords() {
  return { ...state.records };
}

module.exports = {
  PAYMENT_STATES,
  normalizePaymentState,
  toDbSafePaymentState,
  verifyAdminJwt,
  derivePaymentState,
  fetchApplicationFromSupabase,
  fetchApplicantsFromSupabase,
  patchApplicantInSupabase,
  patchAllApplicantsInSupabase,
  fetchTransactionsFromSupabase,
  fetchAllTransactionsFromSupabase,
  syncApplicationPatchToSupabase,
  logPaymentTransactionToSupabase,
  getLocalRecord,
  upsertLocalRecord,
  appendLocalTransaction,
  getAllLocalRecords,
};
