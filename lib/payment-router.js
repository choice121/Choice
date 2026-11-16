/**
 * Choice Properties — Card-First Payment Router (Node / Dev Server)
 * Handles /api/payments/* endpoints:
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
 *   Never accepts, processes, logs, or persists raw card numbers or CVV/CVC.
 *   Only accepts client-tokenized card descriptors and masked brand/last4 metadata.
 *   Never simulates a paid transaction when live card processing is unavailable.
 */

const crypto = require('crypto');
const PaymentStore = require('./payment-store');

const { PAYMENT_STATES, normalizePaymentState } = PaymentStore;

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const RECOMMENDED_FAILURE_MESSAGE =
  'We were unable to finalize your payment at this time due to a verification issue. Please check your payment details and try another debit or credit card, or select an available alternative payment method. If you continue experiencing difficulties, please contact our support team for assistance.';

const CARD_UNAVAILABLE_MESSAGE =
  'Your card payment could not be completed because online debit and credit card checkout is currently disabled on this portal. This is a checkout configuration notice — not a bank decline or an issue with your card. No charge was made, and your submitted application and balance remain saved. Please select an alternative payment method below to complete your fee.';

const RAW_CARD_FORBIDDEN_KEYS = new Set([
  'card_number', 'cardnumber', 'card_num', 'pan', 'account_number',
  'cvv', 'cvc', 'cvv2', 'cvc2', 'security_code', 'securitycode', 'raw_card'
]);

const SUPPORT_INFO = {
  phone: '707-706-3137',
  email: 'choiceproperties404@gmail.com',
};

function getPaymentGatewayConfig(env = process.env) {
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

function containsRawCardData(obj) {
  if (!obj || typeof obj !== 'object') return false;
  for (const [key, val] of Object.entries(obj)) {
    const norm = String(key).toLowerCase().replace(/[-\s]/g, '_');
    if (RAW_CARD_FORBIDDEN_KEYS.has(norm) && val != null && String(val).trim() !== '') {
      return key;
    }
    if (val && typeof val === 'object' && containsRawCardData(val)) {
      return key;
    }
  }
  return false;
}

function json(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 256 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (_) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
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

function mergeApplicantsWithLocal(applicants, localRec, mode, appPaid) {
  const localMembers = (localRec && localRec.member_payments && typeof localRec.member_payments === 'object')
    ? localRec.member_payments
    : {};
  return (Array.isArray(applicants) ? applicants : []).map((m, idx) => {
    const key = m.id ? String(m.id) : String(m.applicant_index ?? idx);
    const localM = localMembers[key] || {};
    const fee = m.screening_fee_amount != null ? Number(m.screening_fee_amount) : 50;
    const rawPayStatus = String(
      m.payment_status ||
      localM.payment_status ||
      (appPaid ? 'paid' : (fee === 0 ? 'waived' : 'unpaid'))
    ).toLowerCase();
    const payState = normalizePaymentState(
      m.application_payment_state || localM.application_payment_state,
      rawPayStatus
    );
    return {
      ...m,
      id: m.id || null,
      applicant_index: m.applicant_index ?? idx,
      is_primary: Boolean(m.is_primary) || idx === 0,
      name: [m.first_name, m.last_name].filter(Boolean).join(' ').trim() || (idx === 0 ? 'Primary Applicant' : `Member #${idx + 1}`),
      screening_fee_amount: Number.isFinite(fee) ? fee : 50,
      payment_status: rawPayStatus,
      application_payment_state: payState,
      payment_amount: m.payment_amount ?? localM.payment_amount ?? ((rawPayStatus === 'paid' || rawPayStatus === 'waived') ? fee : null),
      payment_confirmed_at: m.payment_confirmed_at || localM.payment_confirmed_at || null,
      payment_card_brand: m.payment_card_brand || localM.payment_card_brand || null,
      payment_card_last4: m.payment_card_last4 || localM.payment_card_last4 || null,
      payment_transaction_ref: m.payment_transaction_ref || localM.payment_transaction_ref || null,
      selected_payment_method: m.selected_payment_method || localM.selected_payment_method || null,
      external_payment_reference: m.external_payment_reference || localM.external_payment_reference || null,
      payment_submitted_at: m.payment_submitted_at || localM.payment_submitted_at || null,
      payment_failure_code: m.payment_failure_code ?? localM.payment_failure_code ?? null,
      payment_failure_reason: m.payment_failure_reason ?? localM.payment_failure_reason ?? null,
      payment_attempts_count: Number(m.payment_attempts_count ?? localM.payment_attempts_count ?? 0),
      payment_assistance_required: Boolean(m.payment_assistance_required ?? localM.payment_assistance_required),
    };
  });
}

function buildPublicSessionPayload(appId, appRow, localRec, applicants, transactions = [], targetApplicantId = '') {
  const merged = { ...(localRec || {}), ...(appRow || {}) };
  const mode = String(merged.household_payment_mode || 'centralized') === 'individual' ? 'individual' : 'centralized';
  const appPayStatus = String(merged.payment_status || 'unpaid').toLowerCase();
  const appIsPaid = appPayStatus === 'paid' || appPayStatus === 'waived';

  const feeBreakdown = buildFeeBreakdownFromApplicants(merged, applicants);
  const rawTotalFee = merged.application_fee != null
    ? Number(merged.application_fee)
    : feeBreakdown.reduce((s, r) => s + Number(r.fee || 0), 0);
  const totalFee = Number.isFinite(rawTotalFee) && rawTotalFee >= 0 ? rawTotalFee : 50;

  const mergedMembers = mergeApplicantsWithLocal(applicants, localRec, mode, appIsPaid);
  let targetMember = null;
  if (targetApplicantId && mergedMembers.length > 0) {
    targetMember = mergedMembers.find((m) => String(m.id || '') === String(targetApplicantId) || String(m.applicant_index) === String(targetApplicantId)) || null;
  } else if (mode === 'individual' && mergedMembers.length > 0) {
    targetMember = mergedMembers.find((m) => m.is_primary) || mergedMembers[0];
  }

  let amountDueNow = totalFee;
  if (appIsPaid || totalFee === 0) {
    amountDueNow = 0;
  } else if (mode === 'individual' && targetMember) {
    const memberPaid = ['paid', 'waived'].includes(targetMember.payment_status);
    amountDueNow = memberPaid ? 0 : (merged.credit_applied_id ? 0 : Number(targetMember.screening_fee_amount ?? 50));
  } else if (mode === 'individual' && feeBreakdown.length > 0) {
    const matchedLine = targetApplicantId
      ? feeBreakdown.find((f) => String(f.applicant_id || '') === String(targetApplicantId) || String(f.applicant_index) === String(targetApplicantId))
      : feeBreakdown[0];
    if (matchedLine) {
      amountDueNow = merged.credit_applied_id ? 0 : Number(matchedLine.fee ?? 50);
    }
  }

  const paidMembersCount = mergedMembers.length > 0
    ? mergedMembers.filter((m) => ['paid', 'waived'].includes(m.payment_status)).length
    : (appIsPaid ? 1 : 0);
  const totalMembersCount = mergedMembers.length > 0 ? mergedMembers.length : 1;
  const totalCollected = merged.payment_amount_collected != null
    ? Number(merged.payment_amount_collected)
    : mergedMembers.reduce((s, m) => s + (['paid', 'waived'].includes(m.payment_status) ? Number(m.payment_amount ?? m.screening_fee_amount ?? 0) : 0), 0);

  const applicantName = targetMember
    ? targetMember.name
    : ([merged.first_name, merged.last_name].filter(Boolean).join(' ').trim() || merged.applicant_name || 'Applicant');

  let paymentStatus = String(
    merged.payment_status ||
    (totalFee === 0 && merged.credit_applied_id ? 'waived' : 'unpaid')
  ).toLowerCase();

  const combinedTx = Array.isArray(transactions) && transactions.length > 0
    ? transactions
    : (Array.isArray(localRec?.transactions) ? localRec.transactions.slice(0, 15) : []);

  let paymentState = PaymentStore.derivePaymentState(appRow, localRec, combinedTx);
  if (totalFee === 0 && paymentStatus === 'waived') {
    paymentState = PAYMENT_STATES.CONFIRMED;
  }

  const activePaymentStatus = (mode === 'individual' && targetMember)
    ? targetMember.payment_status
    : paymentStatus;
  const activePaymentState = (mode === 'individual' && targetMember)
    ? targetMember.application_payment_state
    : paymentState;

  return {
    app_id: appId,
    applicant_id: targetMember?.id || null,
    applicant_name: applicantName,
    primary_applicant_name: [merged.first_name, merged.last_name].filter(Boolean).join(' ').trim() || merged.applicant_name || 'Primary Applicant',
    applicant_email: targetMember?.email || merged.email || '',
    property_address: merged.property_address || 'Selected Rental Property',
    submitted_at: merged.created_at || localRec?.created_at || new Date().toISOString(),
    application_status: merged.status || 'pending',
    household_payment_mode: mode,
    application_fee: totalFee,
    amount_due_now: amountDueNow,
    fee_breakdown: feeBreakdown,
    jurisdiction_fee_note: merged.jurisdiction_fee_note || null,
    credit_applied: Boolean(merged.credit_applied_id),
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
    applicants: mergedMembers.map((m) => ({
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
      payment_amount: m.payment_amount,
      payment_confirmed_at: m.payment_confirmed_at,
      payment_card_brand: m.payment_card_brand,
      payment_card_last4: m.payment_card_last4,
      payment_transaction_ref: m.payment_transaction_ref,
      selected_payment_method: m.selected_payment_method || null,
      external_payment_reference: m.external_payment_reference || null,
      payment_submitted_at: m.payment_submitted_at || null,
    })),
    payment_provider: targetMember?.payment_provider || localRec?.payment_provider || appRow?.payment_provider || null,
    selected_payment_method: targetMember?.selected_payment_method || localRec?.selected_payment_method || appRow?.selected_payment_method || null,
    external_payment_reference: targetMember?.external_payment_reference || localRec?.external_payment_reference || appRow?.external_payment_reference || null,
    payment_submitted_at: targetMember?.payment_submitted_at || localRec?.payment_submitted_at || appRow?.payment_submitted_at || null,
    payment_transaction_ref: targetMember?.payment_transaction_ref || localRec?.payment_transaction_ref || appRow?.payment_transaction_ref || null,
    payment_card_brand: targetMember?.payment_card_brand || localRec?.payment_card_brand || appRow?.payment_card_brand || null,
    payment_card_last4: targetMember?.payment_card_last4 || localRec?.payment_card_last4 || appRow?.payment_card_last4 || null,
    payment_method_confirmed: appRow?.payment_method_confirmed || localRec?.payment_method_confirmed || null,
    payment_confirmed_at: targetMember?.payment_confirmed_at || appRow?.payment_confirmed_at || localRec?.payment_confirmed_at || null,
    payment_failure_code: (mode === 'individual' && targetMember)
      ? (targetMember.payment_failure_code ?? null)
      : (localRec?.payment_failure_code ?? appRow?.payment_failure_code ?? null),
    payment_failure_reason: (mode === 'individual' && targetMember)
      ? (targetMember.payment_failure_reason ?? null)
      : (localRec?.payment_failure_reason ?? appRow?.payment_failure_reason ?? null),
    payment_attempts_count: (mode === 'individual' && targetMember)
      ? Number(targetMember.payment_attempts_count ?? 0)
      : Number(localRec?.payment_attempts_count ?? appRow?.payment_attempts_count ?? 0),
    payment_assistance_required: (mode === 'individual' && targetMember)
      ? Boolean(targetMember.payment_assistance_required)
      : Boolean(localRec?.payment_assistance_required ?? appRow?.payment_assistance_required),
    payment_assistance_requested_at: localRec?.payment_assistance_requested_at || appRow?.payment_assistance_requested_at || null,
    portal_login_url: (localRec?.portal_login_url && !/tenant\/login\.html|\/auth\/v1\/verify/i.test(localRec.portal_login_url))
      ? localRec.portal_login_url
      : `/tenant/portal.html?app_id=${encodeURIComponent(appId)}${(mode === 'individual' && targetMember?.id) ? '&applicant_id=' + encodeURIComponent(targetMember.id) : ''}`,
    transactions: combinedTx,
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
      txRef: `CP-TX-ERR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
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
      txRef: `CP-TX-ERR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
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
      txRef: `CP-TX-DEC-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      brand,
      last4: last4 || '0002',
    };
  }

  const suffix = appId.replace(/[^A-Z0-9]/gi, '').slice(-6).toUpperCase() || 'CARD';
  return {
    ok: true,
    txRef: `CP-TX-${suffix}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    amountPaid: amountDue,
    brand,
    last4: last4 || '4242',
  };
}

function mintReceiptAccessToken(appId, applicantId = null, ttlSeconds = 86400) {
  if (!SERVICE_KEY || !appId) return null;
  try {
    const payloadObj = {
      app_id: String(appId),
      applicant_id: applicantId ? String(applicantId) : null,
      exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    };
    const payloadB64 = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
    const sigB64 = crypto.createHmac('sha256', SERVICE_KEY).update(payloadB64).digest('base64url');
    return `${payloadB64}.${sigB64}`;
  } catch (err) {
    console.warn('Could not mint receipt token:', err?.message || err);
    return null;
  }
}

function attachReceiptTokenIfPaid(session, receiptMeta = null) {
  if (!session) return session;
  const isPaid = session.payment_status === 'paid' || session.household_payment_status === 'paid';
  if (isPaid) {
    const token = mintReceiptAccessToken(session.app_id, session.applicant_id || null);
    if (token) session.receipt_access_token = token;
  }
  if (receiptMeta?.receipt_id) session.receipt_id = receiptMeta.receipt_id;
  if (receiptMeta?.receipt_number) session.receipt_number = receiptMeta.receipt_number;
  return session;
}

async function triggerPostPaymentConfirmation(appId, applicantId = null) {
  if (!appId || /^APP-TEST/i.test(appId)) return null;
  if (!SERVICE_KEY) {
    console.error('[payments] Missing SUPABASE_SERVICE_ROLE_KEY; skipped confirm-card-payment');
    return null;
  }
  const payload = { app_id: appId };
  if (applicantId) payload.applicant_id = applicantId;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/confirm-card-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
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

async function handlePaymentApi(req, res) {
  const urlObj = new URL(req.url, 'http://localhost');
  const pathname = urlObj.pathname;
  const method = req.method;

  if (method === 'OPTIONS') {
    return json(res, 200, { ok: true });
  }

  try {
    // 1. GET /api/payments/config
    if (pathname === '/api/payments/config' && method === 'GET') {
      const gwConfig = getPaymentGatewayConfig(process.env);
      return json(res, 200, {
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

    // Helper to load application + applicants + transactions with canonical app_id
    const loadAppBundle = async (rawAppId) => {
      const trimmed = String(rawAppId || '').trim();
      const [appRow, initialApplicants, initialTxs] = await Promise.all([
        PaymentStore.fetchApplicationFromSupabase(trimmed),
        PaymentStore.fetchApplicantsFromSupabase(trimmed),
        PaymentStore.fetchTransactionsFromSupabase(trimmed),
      ]);
      const localRec = PaymentStore.getLocalRecord(appRow?.app_id || trimmed);
      const canonicalAppId = appRow?.app_id || localRec?.app_id || trimmed;
      if (appRow && canonicalAppId !== trimmed) {
        const [canonApplicants, canonTxs] = await Promise.all([
          PaymentStore.fetchApplicantsFromSupabase(canonicalAppId),
          PaymentStore.fetchTransactionsFromSupabase(canonicalAppId),
        ]);
        return { appRow, localRec, canonicalAppId, applicants: canonApplicants, txs: canonTxs };
      }
      return { appRow, localRec, canonicalAppId, applicants: initialApplicants, txs: initialTxs };
    };

    // 2. GET /api/payments/session?app_id=...&applicant_id=...
    if (pathname === '/api/payments/session' && method === 'GET') {
      const rawAppId = String(urlObj.searchParams.get('app_id') || '').trim();
      const targetApplicantId = String(urlObj.searchParams.get('applicant_id') || '').trim();
      if (!rawAppId) {
        return json(res, 400, { ok: false, error: 'app_id is required' });
      }
      const { appRow, localRec, canonicalAppId, applicants, txs } = await loadAppBundle(rawAppId);
      if (!appRow && !localRec) {
        return json(res, 404, {
          ok: false,
          error: 'Application reference not found. Please verify your Application ID or contact support.',
        });
      }
      const session = attachReceiptTokenIfPaid(
        buildPublicSessionPayload(canonicalAppId, appRow, localRec, applicants, txs, targetApplicantId)
      );
      return json(res, 200, { ok: true, session });
    }

    // 3. POST /api/payments/session
    if (pathname === '/api/payments/session' && method === 'POST') {
      const body = await readBody(req);
      const badKey = containsRawCardData(body);
      if (badKey) {
        return json(res, 400, { ok: false, error: 'Raw card credentials are never permitted by this API.' });
      }
      const rawAppId = String(body.app_id || '').trim();
      if (!rawAppId) {
        return json(res, 400, { ok: false, error: 'app_id is required' });
      }
      const { appRow, localRec: existing, canonicalAppId: appId, applicants, txs } = await loadAppBundle(rawAppId);
      const safeContext = {
        first_name: String(body.first_name || existing?.first_name || '').slice(0, 80),
        last_name: String(body.last_name || existing?.last_name || '').slice(0, 80),
        applicant_name: String(body.applicant_name || existing?.applicant_name || '').slice(0, 160),
        email: String(body.email || existing?.email || '').slice(0, 120),
        property_address: String(body.property_address || existing?.property_address || '').slice(0, 240),
        household_payment_mode: String(body.household_payment_mode || existing?.household_payment_mode || 'centralized') === 'individual' ? 'individual' : 'centralized',
        application_fee: body.application_fee != null ? Number(body.application_fee) : (existing?.application_fee ?? 50),
        fee_breakdown: Array.isArray(body.fee_breakdown) ? body.fee_breakdown : (existing?.fee_breakdown || null),
        credit_applied_id: body.credit_applied ? 'credit' : (existing?.credit_applied_id || null),
        portal_login_url: (body.portal_login_url && !/tenant\/login\.html|\/auth\/v1\/verify/i.test(body.portal_login_url))
          ? body.portal_login_url
          : (existing?.portal_login_url && !/tenant\/login\.html|\/auth\/v1\/verify/i.test(existing.portal_login_url) ? existing.portal_login_url : null),
        application_payment_state: (existing?.payment_status === 'paid' || existing?.payment_status === 'waived')
          ? PAYMENT_STATES.CONFIRMED
          : normalizePaymentState(existing?.application_payment_state || PAYMENT_STATES.REQUIRED, existing?.payment_status),
      };
      const saved = PaymentStore.upsertLocalRecord(appId, safeContext);
      const session = attachReceiptTokenIfPaid(
        buildPublicSessionPayload(appId, appRow, saved, applicants, txs, String(body.applicant_id || ''))
      );
      return json(res, 200, { ok: true, session });
    }

    // 4. POST /api/payments/process
    if (pathname === '/api/payments/process' && method === 'POST') {
      const body = await readBody(req);

      const forbiddenField = containsRawCardData(body);
      if (forbiddenField) {
        return json(res, 400, {
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

      if (!rawAppId) {
        return json(res, 400, { ok: false, error: 'Application ID is required.' });
      }

      const { appRow, localRec, canonicalAppId: appId, applicants, txs: existingTxs } = await loadAppBundle(rawAppId);
      if (!appRow && !localRec) {
        return json(res, 404, { ok: false, error: 'Application not found.' });
      }

      const currentSession = buildPublicSessionPayload(appId, appRow, localRec, applicants, existingTxs, targetApplicantId);
      const isIndividualMode = currentSession.household_payment_mode === 'individual';
      const resolvedTarget = isIndividualMode
        ? (currentSession.applicants.find((a) => String(a.id || '') === String(currentSession.applicant_id || '')) || currentSession.applicants[0] || null)
        : null;

      if (currentSession.payment_status === 'paid' || currentSession.application_payment_state === PAYMENT_STATES.CONFIRMED) {
        attachReceiptTokenIfPaid(currentSession);
        return json(res, 200, {
          ok: true,
          alreadyPaid: true,
          session: currentSession,
          message: 'Payment has already been confirmed for this step.',
        });
      }

      const amountDue = Number(currentSession.amount_due_now ?? currentSession.application_fee ?? 0);
      if (amountDue <= 0) {
        const now = new Date().toISOString();
        if (isIndividualMode && resolvedTarget) {
          const memberKey = resolvedTarget.id ? String(resolvedTarget.id) : String(resolvedTarget.applicant_index ?? 0);
          const nextMemberMap = { ...(localRec?.member_payments || {}) };
          nextMemberMap[memberKey] = {
            ...(nextMemberMap[memberKey] || {}),
            payment_status: 'waived',
            application_payment_state: PAYMENT_STATES.CONFIRMED,
            payment_amount: 0,
            payment_confirmed_at: now,
          };
          if (resolvedTarget.id) {
            await PaymentStore.patchApplicantInSupabase(resolvedTarget.id, {
              payment_status: 'waived',
              application_payment_state: PAYMENT_STATES.CONFIRMED,
              payment_amount: 0,
              payment_confirmed_at: now,
            });
          }
          const updatedApplicants = await PaymentStore.fetchApplicantsFromSupabase(appId);
          const allPaid = updatedApplicants.every((a, i) => {
            const k = a.id ? String(a.id) : String(a.applicant_index ?? i);
            const st = (nextMemberMap[k]?.payment_status || a.payment_status || 'unpaid').toLowerCase();
            return st === 'paid' || st === 'waived';
          });
          if (allPaid) {
            await PaymentStore.syncApplicationPatchToSupabase(appId, {
              payment_status: 'waived',
              application_payment_state: PAYMENT_STATES.CONFIRMED,
              payment_confirmed_at: now,
              updated_at: now,
            });
          }
          PaymentStore.upsertLocalRecord(appId, {
            member_payments: nextMemberMap,
            ...(allPaid ? { payment_status: 'waived', application_payment_state: PAYMENT_STATES.CONFIRMED, payment_confirmed_at: now } : {}),
          });
          return json(res, 200, {
            ok: true,
            session: buildPublicSessionPayload(appId, appRow, PaymentStore.getLocalRecord(appId), updatedApplicants, existingTxs, targetApplicantId),
          });
        }
        await PaymentStore.syncApplicationPatchToSupabase(appId, {
          payment_status: 'waived',
          application_payment_state: PAYMENT_STATES.CONFIRMED,
          payment_confirmed_at: now,
          updated_at: now,
        });
        PaymentStore.upsertLocalRecord(appId, {
          payment_status: 'waived',
          application_payment_state: PAYMENT_STATES.CONFIRMED,
          payment_confirmed_at: now,
        });
        return json(res, 200, {
          ok: true,
          session: buildPublicSessionPayload(appId, { ...appRow, payment_status: 'waived' }, PaymentStore.getLocalRecord(appId), applicants, existingTxs, targetApplicantId),
        });
      }

      // CRITICAL: Refuse to simulate a paid card transaction when live card processing is unconfigured.
      const gwConfig = getPaymentGatewayConfig(process.env);
      if (!gwConfig.cardProcessing.available) {
        return json(res, 503, {
          ok: false,
          code: 'card_processing_unavailable',
          card_unavailable: true,
          message: CARD_UNAVAILABLE_MESSAGE,
          alternativeMethods: gwConfig.alternativeMethods,
          session: currentSession,
        });
      }

      if (!cardholderName || cardholderName.length < 2) {
        return json(res, 400, { ok: false, error: 'Cardholder name is required.' });
      }

      const nextAttempt = Number(currentSession.payment_attempts_count || 0) + 1;
      const appNextAttempt = Number(appRow?.payment_attempts_count ?? localRec?.payment_attempts_count ?? 0) + 1;
      const nowProcessing = new Date().toISOString();
      PaymentStore.upsertLocalRecord(appId, {
        application_payment_state: PAYMENT_STATES.PROCESSING,
        payment_attempts_count: appNextAttempt,
      });
      await PaymentStore.syncApplicationPatchToSupabase(appId, {
        application_payment_state: PAYMENT_STATES.PROCESSING,
        payment_attempts_count: appNextAttempt,
        updated_at: nowProcessing,
      });

      const providerUsed = gwConfig.cardProcessing.provider || 'card_gateway';
      const outcome = processTokenizedCard({
        paymentToken,
        cardMeta,
        amountDue,
        appId,
      });

      const now = new Date().toISOString();

      if (outcome.ok) {
        const brand = outcome.brand || cardMeta.brand || 'Card';
        const last4 = outcome.last4 || String(cardMeta.last4 || '').slice(-4) || null;
        const methodLabel = last4 ? `${brand} •••• ${last4}` : `${brand} (Card)`;
        const paidNow = outcome.amountPaid ?? amountDue;

        if (isIndividualMode && resolvedTarget) {
          const memberKey = resolvedTarget.id ? String(resolvedTarget.id) : String(resolvedTarget.applicant_index ?? 0);
          const nextMemberMap = { ...(localRec?.member_payments || {}) };
          nextMemberMap[memberKey] = {
            payment_status: 'paid',
            application_payment_state: PAYMENT_STATES.SUCCESSFUL,
            payment_amount: paidNow,
            payment_provider: providerUsed,
            payment_transaction_ref: outcome.txRef,
            payment_card_brand: brand,
            payment_card_last4: last4,
            payment_failure_code: null,
            payment_failure_reason: null,
            payment_attempts_count: nextAttempt,
            payment_assistance_required: false,
            payment_confirmed_at: now,
          };

          if (resolvedTarget.id) {
            await PaymentStore.patchApplicantInSupabase(resolvedTarget.id, {
              payment_status: 'paid',
              application_payment_state: PAYMENT_STATES.SUCCESSFUL,
              payment_amount: paidNow,
              payment_provider: providerUsed,
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

          const refreshedApplicants = (await PaymentStore.fetchApplicantsFromSupabase(appId));
          const membersToSum = refreshedApplicants.length > 0 ? refreshedApplicants : currentSession.applicants;
          let paidCount = 0;
          let totalCollected = 0;
          for (let i = 0; i < membersToSum.length; i += 1) {
            const m = membersToSum[i];
            const k = m.id ? String(m.id) : String(m.applicant_index ?? i);
            const st = String(m.payment_status || nextMemberMap[k]?.payment_status || 'unpaid').toLowerCase();
            if (st === 'paid' || st === 'waived') {
              paidCount += 1;
              totalCollected += Number(m.payment_amount ?? nextMemberMap[k]?.payment_amount ?? m.screening_fee_amount ?? 0);
            }
          }
          const allPaid = membersToSum.length > 0 && paidCount === membersToSum.length;

          const appPatch = {
            payment_status: allPaid ? 'paid' : 'unpaid',
            payment_date: allPaid ? now : (appRow?.payment_date || null),
            payment_confirmed_at: allPaid ? now : (appRow?.payment_confirmed_at || null),
            payment_amount_collected: totalCollected,
            payment_amount_recorded: totalCollected,
            payment_method_confirmed: methodLabel,
            payment_method_recorded: methodLabel,
            payment_transaction_ref: outcome.txRef,
            application_payment_state: allPaid ? PAYMENT_STATES.SUCCESSFUL : PAYMENT_STATES.AWAITING,
            payment_provider: providerUsed,
            payment_card_brand: brand,
            payment_card_last4: last4,
            payment_failure_code: null,
            payment_failure_reason: null,
            payment_attempts_count: appNextAttempt,
            payment_assistance_required: false,
            updated_at: now,
          };

          await PaymentStore.syncApplicationPatchToSupabase(appId, appPatch);
          const savedLocal = PaymentStore.appendLocalTransaction(appId, {
            applicant_id: resolvedTarget.id || null,
            payer_name: cardholderName,
            transaction_ref: outcome.txRef,
            provider: providerUsed,
            state: PAYMENT_STATES.SUCCESSFUL,
            amount: paidNow,
            card_brand: brand,
            card_last4: last4,
            attempt_number: nextAttempt,
          });
          PaymentStore.upsertLocalRecord(appId, {
            ...savedLocal,
            ...appPatch,
            member_payments: nextMemberMap,
          });
          await PaymentStore.logPaymentTransactionToSupabase({
            application_id: appRow?.id || null,
            app_id: appId,
            applicant_id: resolvedTarget.id || null,
            payer_name: cardholderName,
            transaction_ref: outcome.txRef,
            provider: providerUsed,
            state: PAYMENT_STATES.SUCCESSFUL,
            amount: paidNow,
            card_brand: brand,
            card_last4: last4,
            attempt_number: nextAttempt,
            metadata: { cardholder_name: cardholderName, household_payment_mode: 'individual', applicant_id: resolvedTarget.id || null },
          });

          const confirmData = await triggerPostPaymentConfirmation(appId, resolvedTarget.id || null);

          const refreshedTxs = await PaymentStore.fetchTransactionsFromSupabase(appId);
          const updatedSession = attachReceiptTokenIfPaid(
            buildPublicSessionPayload(
              appId,
              { ...(appRow || {}), ...appPatch },
              PaymentStore.getLocalRecord(appId),
              refreshedApplicants.length > 0 ? refreshedApplicants : applicants,
              refreshedTxs,
              resolvedTarget.id || targetApplicantId
            ),
            confirmData
          );
          return json(res, 200, {
            ok: true,
            transaction_ref: outcome.txRef,
            provider: providerUsed,
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
          payment_provider: providerUsed,
          payment_card_brand: brand,
          payment_card_last4: last4,
          payment_failure_code: null,
          payment_failure_reason: null,
          payment_attempts_count: appNextAttempt,
          payment_assistance_required: false,
          updated_at: now,
        };

        await Promise.all([
          PaymentStore.syncApplicationPatchToSupabase(appId, dbPatch),
          PaymentStore.patchAllApplicantsInSupabase(appId, {
            payment_status: 'paid',
            application_payment_state: PAYMENT_STATES.SUCCESSFUL,
            payment_provider: providerUsed,
            payment_transaction_ref: outcome.txRef,
            payment_card_brand: brand,
            payment_card_last4: last4,
            payment_failure_code: null,
            payment_failure_reason: null,
            payment_assistance_required: false,
            payment_confirmed_at: now,
          }),
        ]);

        const savedLocal = PaymentStore.appendLocalTransaction(appId, {
          payer_name: cardholderName,
          transaction_ref: outcome.txRef,
          provider: providerUsed,
          state: PAYMENT_STATES.SUCCESSFUL,
          amount: paidNow,
          card_brand: brand,
          card_last4: last4,
          attempt_number: appNextAttempt,
        });
        PaymentStore.upsertLocalRecord(appId, {
          ...savedLocal,
          ...dbPatch,
        });
        await PaymentStore.logPaymentTransactionToSupabase({
          application_id: appRow?.id || null,
          app_id: appId,
          payer_name: cardholderName,
          transaction_ref: outcome.txRef,
          provider: providerUsed,
          state: PAYMENT_STATES.SUCCESSFUL,
          amount: paidNow,
          card_brand: brand,
          card_last4: last4,
          attempt_number: appNextAttempt,
          metadata: { cardholder_name: cardholderName, household_payment_mode: 'centralized' },
        });

        const confirmData = await triggerPostPaymentConfirmation(appId, null);

        const refreshedTxs = await PaymentStore.fetchTransactionsFromSupabase(appId);
        const refreshedApplicants = await PaymentStore.fetchApplicantsFromSupabase(appId);
        const updatedSession = attachReceiptTokenIfPaid(
          buildPublicSessionPayload(
            appId,
            { ...(appRow || {}), ...dbPatch },
            PaymentStore.getLocalRecord(appId),
            refreshedApplicants.length > 0 ? refreshedApplicants : applicants,
            refreshedTxs,
            targetApplicantId
          ),
          confirmData
        );
        return json(res, 200, {
          ok: true,
          transaction_ref: outcome.txRef,
          provider: providerUsed,
          session: updatedSession,
        });
      }

      // Failed card attempt
      const brand = outcome.brand || cardMeta.brand || 'Card';
      const last4 = outcome.last4 || String(cardMeta.last4 || '').slice(-4) || null;
      const failPatch = {
        payment_status: 'unpaid',
        application_payment_state: PAYMENT_STATES.FAILED,
        payment_provider: providerUsed,
        payment_transaction_ref: outcome.txRef,
        payment_card_brand: brand,
        payment_card_last4: last4,
        payment_failure_code: outcome.code || 'card_verification_declined',
        payment_failure_reason: RECOMMENDED_FAILURE_MESSAGE,
        payment_attempts_count: appNextAttempt,
        updated_at: now,
      };

      const nextMemberMap = { ...(localRec?.member_payments || {}) };
      if (isIndividualMode && resolvedTarget) {
        const memberKey = resolvedTarget.id ? String(resolvedTarget.id) : String(resolvedTarget.applicant_index ?? 0);
        nextMemberMap[memberKey] = {
          ...(nextMemberMap[memberKey] || {}),
          payment_status: 'unpaid',
          application_payment_state: PAYMENT_STATES.FAILED,
          payment_provider: providerUsed,
          payment_transaction_ref: outcome.txRef,
          payment_card_brand: brand,
          payment_card_last4: last4,
          payment_failure_code: outcome.code || 'card_verification_declined',
          payment_failure_reason: RECOMMENDED_FAILURE_MESSAGE,
          payment_attempts_count: nextAttempt,
        };
        if (resolvedTarget.id) {
          await PaymentStore.patchApplicantInSupabase(resolvedTarget.id, {
            payment_status: 'unpaid',
            application_payment_state: PAYMENT_STATES.FAILED,
            payment_provider: providerUsed,
            payment_transaction_ref: outcome.txRef,
            payment_card_brand: brand,
            payment_card_last4: last4,
            payment_failure_code: outcome.code || 'card_verification_declined',
            payment_failure_reason: RECOMMENDED_FAILURE_MESSAGE,
            payment_attempts_count: nextAttempt,
          });
        }
      }

      await PaymentStore.syncApplicationPatchToSupabase(appId, failPatch);
      const savedLocal = PaymentStore.appendLocalTransaction(appId, {
        applicant_id: resolvedTarget?.id || null,
        payer_name: cardholderName,
        transaction_ref: outcome.txRef,
        provider: providerUsed,
        state: PAYMENT_STATES.FAILED,
        amount: amountDue,
        card_brand: brand,
        card_last4: last4,
        failure_code: outcome.code || 'card_verification_declined',
        failure_reason: RECOMMENDED_FAILURE_MESSAGE,
        attempt_number: nextAttempt,
      });
      PaymentStore.upsertLocalRecord(appId, {
        ...savedLocal,
        ...failPatch,
        member_payments: nextMemberMap,
      });
      await PaymentStore.logPaymentTransactionToSupabase({
        application_id: appRow?.id || null,
        app_id: appId,
        applicant_id: resolvedTarget?.id || null,
        payer_name: cardholderName,
        transaction_ref: outcome.txRef,
        provider: providerUsed,
        state: PAYMENT_STATES.FAILED,
        amount: amountDue,
        card_brand: brand,
        card_last4: last4,
        failure_code: outcome.code || 'card_verification_declined',
        failure_reason: RECOMMENDED_FAILURE_MESSAGE,
        attempt_number: nextAttempt,
      });

      const refreshedTxs = await PaymentStore.fetchTransactionsFromSupabase(appId);
      const failedSession = buildPublicSessionPayload(
        appId,
        { ...(appRow || {}), ...failPatch },
        PaymentStore.getLocalRecord(appId),
        applicants,
        refreshedTxs,
        resolvedTarget?.id || targetApplicantId
      );
      return json(res, 402, {
        ok: false,
        code: outcome.code || 'card_verification_declined',
        message: RECOMMENDED_FAILURE_MESSAGE,
        transaction_ref: outcome.txRef,
        session: failedSession,
      });
    }

    // 4B. POST /api/payments/select-method
    if (pathname === '/api/payments/select-method' && method === 'POST') {
      const body = await readBody(req);
      const rawAppId = String(body.app_id || '').trim();
      const targetApplicantId = String(body.applicant_id || '').trim();
      const chosenMethod = String(body.method || '').trim().toLowerCase();

      if (!rawAppId) {
        return json(res, 400, { ok: false, error: 'app_id is required.' });
      }
      if (!chosenMethod) {
        return json(res, 400, { ok: false, error: 'Payment method is required.' });
      }

      const { appRow, localRec, canonicalAppId: appId, applicants, txs: existingTxs } = await loadAppBundle(rawAppId);
      if (!appRow && !localRec) {
        return json(res, 404, { ok: false, error: 'Application not found.' });
      }

      const currentSession = buildPublicSessionPayload(appId, appRow, localRec, applicants, existingTxs, targetApplicantId);
      if (currentSession.payment_status === 'paid' || currentSession.payment_status === 'waived' || currentSession.application_payment_state === PAYMENT_STATES.CONFIRMED) {
        attachReceiptTokenIfPaid(currentSession);
        return json(res, 200, {
          ok: true,
          alreadyPaid: true,
          session: currentSession,
        });
      }

      const gwConfig = getPaymentGatewayConfig(process.env);
      if (chosenMethod === 'card') {
        if (!gwConfig.cardProcessing.available) {
          const nowUnavail = new Date().toISOString();
          const unavailPatch = {
            selected_payment_method: 'card',
            application_payment_state: PAYMENT_STATES.AWAITING,
            updated_at: nowUnavail,
          };
          PaymentStore.upsertLocalRecord(appId, unavailPatch);
          return json(res, 503, {
            ok: false,
            code: 'card_processing_unavailable',
            card_unavailable: true,
            message: CARD_UNAVAILABLE_MESSAGE,
            alternativeMethods: gwConfig.alternativeMethods,
            session: buildPublicSessionPayload(appId, { ...(appRow || {}), ...unavailPatch }, PaymentStore.getLocalRecord(appId), applicants, existingTxs, targetApplicantId),
          });
        }
      } else {
        const alt = gwConfig.alternativeMethods.find((m) => m.id === chosenMethod);
        if (!alt) {
          return json(res, 400, { ok: false, error: 'Unsupported payment method selected.' });
        }
        if (!alt.available || !alt.configured) {
          return json(res, 400, {
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
      const txRef = `CP-SEL-${chosenMethod.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
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

      const nextMemberMap = { ...(localRec?.member_payments || {}) };
      if (isIndividualMode && resolvedTarget) {
        const memberKey = resolvedTarget.id ? String(resolvedTarget.id) : String(resolvedTarget.applicant_index ?? 0);
        nextMemberMap[memberKey] = {
          ...(nextMemberMap[memberKey] || {}),
          payment_status: 'unpaid',
          selected_payment_method: chosenMethod,
          payment_provider: chosenMethod,
          application_payment_state: PAYMENT_STATES.METHOD_SELECTED,
        };
        if (resolvedTarget.id) {
          await PaymentStore.patchApplicantInSupabase(resolvedTarget.id, {
            selected_payment_method: chosenMethod,
            payment_provider: chosenMethod,
            application_payment_state: PAYMENT_STATES.METHOD_SELECTED,
          });
        }
      }

      await PaymentStore.syncApplicationPatchToSupabase(appId, selectPatch);
      const savedLocal = PaymentStore.appendLocalTransaction(appId, {
        applicant_id: resolvedTarget?.id || null,
        payer_name: currentSession.applicant_name || null,
        transaction_ref: txRef,
        provider: chosenMethod,
        state: PAYMENT_STATES.METHOD_SELECTED,
        amount: Number(currentSession.amount_due_now ?? currentSession.application_fee ?? 0),
        attempt_number: Number(currentSession.payment_attempts_count || 0),
        metadata: { method: chosenMethod, method_label: methodLabel },
      });
      PaymentStore.upsertLocalRecord(appId, {
        ...savedLocal,
        ...selectPatch,
        member_payments: nextMemberMap,
      });
      await PaymentStore.logPaymentTransactionToSupabase({
        application_id: appRow?.id || null,
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
        PaymentStore.fetchApplicantsFromSupabase(appId),
        PaymentStore.fetchTransactionsFromSupabase(appId),
      ]);

      return json(res, 200, {
        ok: true,
        selected_method: chosenMethod,
        session: buildPublicSessionPayload(
          appId,
          { ...(appRow || {}), ...selectPatch },
          PaymentStore.getLocalRecord(appId),
          refreshedApplicants.length > 0 ? refreshedApplicants : applicants,
          refreshedTxs,
          resolvedTarget?.id || targetApplicantId
        ),
      });
    }

    // 4C. POST /api/payments/submit-external
    // Records an applicant's external transfer confirmation reference for Leasing Desk verification.
    // STRICT INVARIANT: Never sets payment_status to 'paid'. Remains 'unpaid' until verified & confirmed.
    if (pathname === '/api/payments/submit-external' && method === 'POST') {
      const body = await readBody(req);
      const badKey = containsRawCardData(body);
      if (badKey) {
        return json(res, 400, { ok: false, error: 'Raw card credentials are never permitted by this API.' });
      }

      const rawAppId = String(body.app_id || '').trim();
      const targetApplicantId = String(body.applicant_id || '').trim();
      const chosenMethod = String(body.method || '').trim().toLowerCase();
      const externalRef = String(body.external_reference || '').trim().slice(0, 120);
      const payerHandle = String(body.payer_handle || '').trim().slice(0, 120);
      const payerName = String(body.payer_name || '').trim().slice(0, 120);
      const note = String(body.note || '').trim().slice(0, 300);
      const confirmedExternal = Boolean(body.confirmed_external);

      if (!rawAppId) {
        return json(res, 400, { ok: false, error: 'Application ID is required.' });
      }
      if (!chosenMethod) {
        return json(res, 400, { ok: false, error: 'Selected payment method is required.' });
      }
      if (!confirmedExternal) {
        return json(res, 400, { ok: false, error: 'Please confirm that you completed the external payment before submitting for verification.' });
      }

      const gwConfig = getPaymentGatewayConfig(process.env);
      const alt = gwConfig.alternativeMethods.find((m) => m.id === chosenMethod);
      if (!alt || !alt.available || !alt.configured) {
        return json(res, 400, {
          ok: false,
          code: 'method_not_configured',
          error: alt?.unavailableReason || 'Selected alternative payment method is not currently configured.',
        });
      }

      const { appRow, localRec, canonicalAppId: appId, applicants, txs: existingTxs } = await loadAppBundle(rawAppId);
      if (!appRow && !localRec) {
        return json(res, 404, { ok: false, error: 'Application not found.' });
      }

      const currentSession = buildPublicSessionPayload(appId, appRow, localRec, applicants, existingTxs, targetApplicantId);
      if (currentSession.payment_status === 'paid' || currentSession.payment_status === 'waived' || currentSession.application_payment_state === PAYMENT_STATES.CONFIRMED) {
        attachReceiptTokenIfPaid(currentSession);
        return json(res, 200, {
          ok: true,
          alreadyPaid: true,
          session: currentSession,
        });
      }

      const isIndividualMode = currentSession.household_payment_mode === 'individual';
      const resolvedTarget = isIndividualMode
        ? (currentSession.applicants.find((a) => String(a.id || '') === String(currentSession.applicant_id || '')) || currentSession.applicants[0] || null)
        : null;

      const amountDue = Number(currentSession.amount_due_now ?? currentSession.application_fee ?? 0);
      const now = new Date().toISOString();
      const txRef = `CP-EXT-${chosenMethod.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const referenceDisplay = externalRef || payerHandle || `${alt.name} external transfer (${payerName || currentSession.applicant_name || 'Applicant'})`;
      const existingNotes = String(appRow?.payment_notes || '').trim();
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

      const nextMemberMap = { ...(localRec?.member_payments || {}) };
      if (isIndividualMode && resolvedTarget) {
        const memberKey = resolvedTarget.id ? String(resolvedTarget.id) : String(resolvedTarget.applicant_index ?? 0);
        nextMemberMap[memberKey] = {
          ...(nextMemberMap[memberKey] || {}),
          payment_status: 'unpaid',
          application_payment_state: PAYMENT_STATES.SUBMITTED_FOR_VERIFICATION,
          selected_payment_method: chosenMethod,
          payment_provider: chosenMethod,
          external_payment_reference: referenceDisplay,
          payment_submitted_at: now,
          payment_transaction_ref: txRef,
        };
        if (resolvedTarget.id) {
          await PaymentStore.patchApplicantInSupabase(resolvedTarget.id, {
            payment_status: 'unpaid',
            application_payment_state: PAYMENT_STATES.SUBMITTED_FOR_VERIFICATION,
            selected_payment_method: chosenMethod,
            payment_provider: chosenMethod,
            external_payment_reference: referenceDisplay,
            payment_submitted_at: now,
            payment_transaction_ref: txRef,
          });
        }
      }

      await PaymentStore.syncApplicationPatchToSupabase(appId, verifyPatch);
      const savedLocal = PaymentStore.appendLocalTransaction(appId, {
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
      PaymentStore.upsertLocalRecord(appId, {
        ...savedLocal,
        ...verifyPatch,
        member_payments: nextMemberMap,
      });
      await PaymentStore.logPaymentTransactionToSupabase({
        application_id: appRow?.id || null,
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
        PaymentStore.fetchApplicantsFromSupabase(appId),
        PaymentStore.fetchTransactionsFromSupabase(appId),
      ]);

      return json(res, 200, {
        ok: true,
        verification_pending: true,
        transaction_ref: txRef,
        message: `${alt.name} payment details submitted for verification. Our Leasing Desk will confirm your transfer before marking your fee paid.`,
        session: buildPublicSessionPayload(
          appId,
          { ...(appRow || {}), ...verifyPatch },
          PaymentStore.getLocalRecord(appId),
          refreshedApplicants.length > 0 ? refreshedApplicants : applicants,
          refreshedTxs,
          resolvedTarget?.id || targetApplicantId
        ),
      });
    }

    // 4D. POST /api/payments/cancel
    if (pathname === '/api/payments/cancel' && method === 'POST') {
      const body = await readBody(req);
      const rawAppId = String(body.app_id || '').trim();
      const targetApplicantId = String(body.applicant_id || '').trim();
      const reason = String(body.reason || 'Applicant cancelled payment selection to complete later.').trim().slice(0, 240);

      if (!rawAppId) {
        return json(res, 400, { ok: false, error: 'app_id is required.' });
      }

      const { appRow, localRec, canonicalAppId: appId, applicants, txs: existingTxs } = await loadAppBundle(rawAppId);
      if (!appRow && !localRec) {
        return json(res, 404, { ok: false, error: 'Application not found.' });
      }

      const currentSession = buildPublicSessionPayload(appId, appRow, localRec, applicants, existingTxs, targetApplicantId);
      if (currentSession.payment_status === 'paid' || currentSession.payment_status === 'waived' || currentSession.application_payment_state === PAYMENT_STATES.CONFIRMED) {
        attachReceiptTokenIfPaid(currentSession);
        return json(res, 200, {
          ok: true,
          alreadyPaid: true,
          session: currentSession,
        });
      }

      const isIndividualMode = currentSession.household_payment_mode === 'individual';
      const resolvedTarget = isIndividualMode
        ? (currentSession.applicants.find((a) => String(a.id || '') === String(currentSession.applicant_id || '')) || currentSession.applicants[0] || null)
        : null;

      const now = new Date().toISOString();
      const txRef = `CP-CAN-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const cancelPatch = {
        payment_status: 'unpaid',
        application_payment_state: PAYMENT_STATES.CANCELLED,
        updated_at: now,
      };

      const nextMemberMap = { ...(localRec?.member_payments || {}) };
      if (isIndividualMode && resolvedTarget) {
        const memberKey = resolvedTarget.id ? String(resolvedTarget.id) : String(resolvedTarget.applicant_index ?? 0);
        nextMemberMap[memberKey] = {
          ...(nextMemberMap[memberKey] || {}),
          payment_status: 'unpaid',
          application_payment_state: PAYMENT_STATES.CANCELLED,
        };
        if (resolvedTarget.id) {
          await PaymentStore.patchApplicantInSupabase(resolvedTarget.id, {
            payment_status: 'unpaid',
            application_payment_state: PAYMENT_STATES.CANCELLED,
          });
        }
      }

      await PaymentStore.syncApplicationPatchToSupabase(appId, cancelPatch);
      const savedLocal = PaymentStore.appendLocalTransaction(appId, {
        applicant_id: resolvedTarget?.id || null,
        payer_name: currentSession.applicant_name || null,
        transaction_ref: txRef,
        provider: currentSession.selected_payment_method || 'checkout',
        state: PAYMENT_STATES.CANCELLED,
        amount: Number(currentSession.amount_due_now ?? currentSession.application_fee ?? 0),
        attempt_number: Number(currentSession.payment_attempts_count || 0),
        metadata: { reason },
      });
      PaymentStore.upsertLocalRecord(appId, {
        ...savedLocal,
        ...cancelPatch,
        member_payments: nextMemberMap,
      });
      await PaymentStore.logPaymentTransactionToSupabase({
        application_id: appRow?.id || null,
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
        PaymentStore.fetchApplicantsFromSupabase(appId),
        PaymentStore.fetchTransactionsFromSupabase(appId),
      ]);

      return json(res, 200, {
        ok: true,
        cancelled: true,
        session: buildPublicSessionPayload(
          appId,
          { ...(appRow || {}), ...cancelPatch },
          PaymentStore.getLocalRecord(appId),
          refreshedApplicants.length > 0 ? refreshedApplicants : applicants,
          refreshedTxs,
          resolvedTarget?.id || targetApplicantId
        ),
      });
    }

    // 5. POST /api/payments/assistance
    if (pathname === '/api/payments/assistance' && method === 'POST') {
      const body = await readBody(req);
      const rawAppId = String(body.app_id || '').trim();
      const targetApplicantId = String(body.applicant_id || '').trim();
      const note = String(body.note || '').trim().slice(0, 500);
      if (!rawAppId) {
        return json(res, 400, { ok: false, error: 'app_id is required' });
      }
      const { appRow, localRec, canonicalAppId: appId, applicants, txs } = await loadAppBundle(rawAppId);
      if (!appRow && !localRec) {
        return json(res, 404, { ok: false, error: 'Application not found' });
      }
      const now = new Date().toISOString();
      const assistPatch = {
        application_payment_state: PAYMENT_STATES.ASSISTANCE,
        payment_assistance_required: true,
        payment_assistance_requested_at: now,
        updated_at: now,
      };
      if (note) {
        assistPatch.payment_notes = note;
      }
      await PaymentStore.syncApplicationPatchToSupabase(appId, assistPatch);

      const nextMemberMap = { ...(localRec?.member_payments || {}) };
      if (targetApplicantId) {
        nextMemberMap[targetApplicantId] = {
          ...(nextMemberMap[targetApplicantId] || {}),
          application_payment_state: PAYMENT_STATES.ASSISTANCE,
          payment_assistance_required: true,
        };
        await PaymentStore.patchApplicantInSupabase(targetApplicantId, {
          application_payment_state: PAYMENT_STATES.ASSISTANCE,
          payment_assistance_required: true,
        });
      }

      PaymentStore.upsertLocalRecord(appId, {
        ...assistPatch,
        member_payments: nextMemberMap,
        assistance_note: note || localRec?.assistance_note || null,
      });
      const updatedSession = buildPublicSessionPayload(appId, { ...(appRow || {}), ...assistPatch }, PaymentStore.getLocalRecord(appId), applicants, txs, targetApplicantId);
      return json(res, 200, {
        ok: true,
        session: updatedSession,
        support: {
          phone: '707-706-3137',
          email: 'choiceproperties404@gmail.com',
          message: 'Your application has been flagged for Payment Assistance Required. Our support team can assist you directly while your submitted application remains active.',
        },
      });
    }

    // 6. POST /api/payments/resolve-assistance (Admin only)
    if (pathname === '/api/payments/resolve-assistance' && method === 'POST') {
      const auth = await PaymentStore.verifyAdminJwt(req.headers.authorization);
      if (!auth.ok) {
        return json(res, 401, { ok: false, error: 'Administrator authentication required' });
      }
      const body = await readBody(req);
      const appId = String(body.app_id || '').trim();
      if (!appId) return json(res, 400, { ok: false, error: 'app_id is required' });
      const nextState = body.next_state && Object.values(PAYMENT_STATES).includes(body.next_state)
        ? body.next_state
        : PAYMENT_STATES.AWAITING;
      const now = new Date().toISOString();
      const patch = {
        application_payment_state: nextState,
        payment_assistance_required: false,
        updated_at: now,
      };
      await Promise.all([
        PaymentStore.syncApplicationPatchToSupabase(appId, patch),
        PaymentStore.patchAllApplicantsInSupabase(appId, {
          payment_assistance_required: false,
        }),
      ]);
      PaymentStore.upsertLocalRecord(appId, patch);
      return json(res, 200, { ok: true, application_payment_state: nextState });
    }

    // 7. GET /api/payments/ledger (Admin only)
    if (pathname === '/api/payments/ledger' && method === 'GET') {
      const auth = await PaymentStore.verifyAdminJwt(req.headers.authorization);
      if (!auth.ok) {
        return json(res, 401, { ok: false, error: 'Administrator authentication required' });
      }
      const localRecords = PaymentStore.getAllLocalRecords();
      const dbTransactions = await PaymentStore.fetchAllTransactionsFromSupabase(150);
      const seenRefs = new Set(dbTransactions.map((t) => t.transaction_ref).filter(Boolean));
      const mergedTxs = dbTransactions.slice();
      for (const [recAppId, rec] of Object.entries(localRecords)) {
        for (const tx of (Array.isArray(rec?.transactions) ? rec.transactions : [])) {
          if (tx.transaction_ref && seenRefs.has(tx.transaction_ref)) continue;
          mergedTxs.push({ app_id: recAppId, ...tx });
        }
      }
      mergedTxs.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      return json(res, 200, { ok: true, records: localRecords, transactions: mergedTxs.slice(0, 150) });
    }

    return json(res, 404, { ok: false, error: 'Payment endpoint not found' });
  } catch (err) {
    console.error('Payment API error:', err);
    return json(res, 500, { ok: false, error: err.message || 'Internal payment service error' });
  }
}

module.exports = {
  handlePaymentApi,
  PAYMENT_STATES,
  RECOMMENDED_FAILURE_MESSAGE,
  CARD_UNAVAILABLE_MESSAGE,
  getPaymentGatewayConfig,
};
