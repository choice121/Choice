/// <reference lib="deno.ns" />

import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, handleCors } from '../_shared/cors.ts';
import { getRoleDisplayLabel, normalizeApplicantType, normalizeSubmissionMethod } from '../_shared/application-rules.ts';
import { getSiteUrl } from '../_shared/config.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

function response(req: Request, status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(req.headers.get('origin')),
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

const CONSENT_TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;

async function sha256Hex(raw: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function ageInYears(dobStr: string): number | null {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

const SAFE_APPLICANT_COLS =
  'id, applicant_index, is_primary, first_name, last_name, email, phone, role, applicant_type, ' +
  'submission_method, info_completed, info_completed_at, housing_status, is_occupant, financial_support_notes, ' +
  'screening_fee_amount, payment_status, application_payment_state, payment_amount, payment_confirmed_at, payment_transaction_ref, ' +
  'dob, ssn_last4, government_id_type, government_id_number, ' +
  'current_address, residency_duration, current_rent_amount, reason_for_leaving, ' +
  'current_landlord_name, landlord_phone, ' +
  'employment_status, employer, job_title, employment_duration, monthly_income, other_income, ' +
  'ever_evicted, smoker, screening_consent';

async function loadTargetApplicant(tok: { applicant_id?: string | null; application_id: string; recipient_email?: string | null }) {
  if (tok.applicant_id) {
    const { data } = await supabase
      .from('application_applicants')
      .select(SAFE_APPLICANT_COLS)
      .eq('id', tok.applicant_id)
      .maybeSingle();
    return data as Record<string, unknown> | null;
  }
  if (tok.recipient_email) {
    const { data } = await supabase
      .from('application_applicants')
      .select(SAFE_APPLICANT_COLS)
      .eq('application_id', tok.application_id)
      .ilike('email', tok.recipient_email)
      .eq('is_primary', false)
      .maybeSingle();
    return data as Record<string, unknown> | null;
  }
  return null;
}

async function lookupConsentToken(rawToken: string, allowConsumed = false) {
  const token = String(rawToken || '').trim();
  if (!token || !CONSENT_TOKEN_RE.test(token)) {
    return { ok: false as const, status: 400, error: 'Invalid or missing screening authorization link.' };
  }
  const tokenHash = await sha256Hex(token);

  const { data: tok, error } = await supabase
    .from('co_applicant_consent_tokens')
    .select('token_hash, application_id, applicant_id, recipient_email, expires_at, consumed_at, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error) {
    console.error('[confirm-co-applicant-screening] token lookup failed:', error.message);
    return { ok: false as const, status: 500, error: 'Could not verify authorization link. Please retry.' };
  }
  if (!tok) {
    return { ok: false as const, status: 404, error: 'This authorization link is not recognized.' };
  }
  if (tok.revoked_at) {
    return { ok: false as const, status: 410, error: 'This authorization link has been superseded or revoked. Please use the latest email link.' };
  }
  if (tok.consumed_at && !allowConsumed) {
    return { ok: false as const, status: 410, error: 'Your screening authorization has already been recorded.' };
  }
  if (new Date(tok.expires_at).getTime() <= Date.now()) {
    return { ok: false as const, status: 410, error: 'This authorization link has expired. Please ask the leasing team for a new link.' };
  }

  return { ok: true as const, tokenHash, tok, alreadyConsented: Boolean(tok.consumed_at) };
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // GET ?token=... — preview context & pre-fill safe profile before consenting/completing
  if (req.method === 'GET') {
    const rawToken = new URL(req.url).searchParams.get('token') || '';
    const check = await lookupConsentToken(rawToken, true);
    if (!check.ok) return response(req, check.status, { valid: false, error: check.error });

    const { data: app } = await supabase
      .from('applications')
      .select('id, app_id, property_address, first_name, last_name, status, preferred_language, household_payment_mode, payment_status, credit_applied_id, application_fee_per_adult')
      .eq('id', check.tok.application_id)
      .maybeSingle();

    const applicant = await loadTargetApplicant(check.tok);
    const householdPaymentMode = String(app?.household_payment_mode || 'centralized') === 'individual' ? 'individual' : 'centralized';
    const creditApplied = Boolean(app?.credit_applied_id);
    const memberFee = creditApplied ? 0 : (Number(applicant?.screening_fee_amount ?? app?.application_fee_per_adult ?? 50) || 50);
    const memberPayStatus = String(applicant?.payment_status || (app?.payment_status === 'paid' || app?.payment_status === 'waived' ? app.payment_status : 'unpaid')).toLowerCase();
    const paymentRequired = householdPaymentMode === 'individual' && !creditApplied && memberFee > 0 && memberPayStatus !== 'paid' && memberPayStatus !== 'waived';

    if (check.alreadyConsented && !paymentRequired) {
      return response(req, 410, { valid: false, already_consented: true, error: 'Your screening authorization has already been recorded.' });
    }

    const appType = normalizeApplicantType(applicant?.applicant_type || applicant?.role, false);
    const subMethod = normalizeSubmissionMethod(applicant?.submission_method);
    const infoCompleted = applicant?.info_completed !== undefined
      ? Boolean(applicant.info_completed)
      : Boolean(applicant?.dob && applicant?.ssn_last4);
    const applicantId = String(applicant?.id || check.tok.applicant_id || '');
    const payUrl = (app?.app_id && applicantId)
      ? `${getSiteUrl()}/apply/pay.html?app_id=${encodeURIComponent(String(app.app_id))}&applicant_id=${encodeURIComponent(applicantId)}&token=${encodeURIComponent(rawToken)}`
      : null;

    let documents: Array<Record<string, unknown>> = [];
    if (applicant?.id) {
      const { data: docs } = await supabase
        .from('application_documents')
        .select('id, original_file_name, doc_type, status, mime_type, metadata, created_at')
        .eq('applicant_id', applicant.id)
        .eq('status', 'uploaded')
        .order('created_at', { ascending: false });
      documents = docs || [];
    }

    const locale = String(app?.preferred_language || '').toLowerCase().startsWith('es') ? 'es' : 'en';

    return response(req, 200, {
      valid: true,
      already_consented: check.alreadyConsented,
      app_id: app?.app_id || '',
      property_address: app?.property_address || 'Rental Property',
      preferred_language: locale,
      primary_name: `${app?.first_name || ''} ${app?.last_name || ''}`.trim() || 'Primary Applicant',
      applicant_id: applicantId || null,
      applicant_index: applicant?.applicant_index ?? null,
      applicant_name: applicant
        ? `${applicant.first_name || ''} ${applicant.last_name || ''}`.trim()
        : check.tok.recipient_email,
      applicant_email: String(applicant?.email || check.tok.recipient_email || ''),
      applicant_type: appType,
      applicant_role: applicant?.role || getRoleDisplayLabel(appType, 'en'),
      applicant_role_label: getRoleDisplayLabel(appType, locale),
      submission_method: subMethod,
      info_completed: infoCompleted,
      household_payment_mode: householdPaymentMode,
      screening_fee_amount: memberFee,
      payment_status: memberPayStatus,
      application_payment_state: applicant?.application_payment_state || 'Awaiting Payment',
      payment_required: paymentRequired,
      credit_applied: creditApplied,
      pay_url: paymentRequired ? payUrl : null,
      has_ssn: Boolean(applicant?.ssn_last4),
      ssn_last4: applicant?.ssn_last4 || null,
      profile: applicant ? {
        first_name: applicant.first_name || '',
        last_name: applicant.last_name || '',
        email: applicant.email || '',
        phone: applicant.phone || '',
        dob: applicant.dob || '',
        government_id_type: applicant.government_id_type || '',
        government_id_number: applicant.government_id_number || '',
        current_address: applicant.current_address || '',
        housing_status: applicant.housing_status || '',
        residency_duration: applicant.residency_duration || '',
        current_rent_amount: applicant.current_rent_amount || '',
        reason_for_leaving: applicant.reason_for_leaving || '',
        current_landlord_name: applicant.current_landlord_name || '',
        landlord_phone: applicant.landlord_phone || '',
        employment_status: applicant.employment_status || '',
        employer: applicant.employer || '',
        job_title: applicant.job_title || '',
        employment_duration: applicant.employment_duration || '',
        monthly_income: applicant.monthly_income || '',
        other_income: applicant.other_income || '',
        ever_evicted: applicant.ever_evicted === true,
        smoker: applicant.smoker === true,
        financial_support_notes: applicant.financial_support_notes || '',
      } : null,
      documents,
      expires_at: check.tok.expires_at,
    });
  }

  if (req.method !== 'POST') return response(req, 405, { error: 'Method not allowed.' });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return response(req, 400, { error: 'Invalid authorization request.' });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return response(req, 400, { error: 'Invalid authorization request.' });
  }

  const token = typeof body.token === 'string' ? body.token : '';
  if (body.consent !== true) {
    return response(req, 400, { error: 'Review the authorization and check the consent box to continue.' });
  }

  const check = await lookupConsentToken(token);
  if (!check.ok) {
    return response(req, check.status, { error: check.error });
  }

  const applicant = await loadTargetApplicant(check.tok);
  const appType = normalizeApplicantType(applicant?.applicant_type || applicant?.role, false);
  const profile = (body.profile && typeof body.profile === 'object' && !Array.isArray(body.profile))
    ? (body.profile as Record<string, unknown>)
    : null;

  const needsCompletion = applicant && (
    normalizeSubmissionMethod(applicant.submission_method) === 'invited' || !applicant.info_completed
  );

  if (applicant && (needsCompletion || profile)) {
    const str = (k: string, fallback = '') => {
      const v = profile?.[k];
      return v !== undefined && v !== null && String(v).trim() !== '' ? String(v).trim() : fallback;
    };

    const nextDob = str('dob', String(applicant.dob || ''));
    const nextAddress = str('current_address', String(applicant.current_address || ''));
    const nextEmpStatus = str('employment_status', String(applicant.employment_status || ''));
    const nextIncome = str('monthly_income', String(applicant.monthly_income || ''));
    const nextHousingStatus = str('housing_status', String(applicant.housing_status || ''));
    const rawSsn = profile?.ssn ? String(profile.ssn).trim() : '';
    const ssnModeRaw = String(profile?.ssn_mode || 'last4').trim().toLowerCase();
    const ssnMode = (ssnModeRaw === 'alternative_id' || ssnModeRaw === 'alt' || ssnModeRaw === 'itin' || ssnModeRaw === 'no_ssn')
      ? 'alternative_id'
      : 'last4';

    if (needsCompletion) {
      if (!nextDob) return response(req, 400, { error: 'Date of birth is required to complete your application.' });
      const age = ageInYears(nextDob);
      if (age === null || age < 18 || age > 120) {
        return response(req, 400, { error: 'You must be at least 18 years of age with a valid date of birth.' });
      }
      if (!applicant.ssn_last4) {
        if (ssnMode === 'alternative_id') {
          if (!str('government_id_type') && !str('government_id_number')) {
            return response(req, 400, { error: 'Please provide your Alternative Government ID type or number for verification.' });
          }
        } else {
          const d = rawSsn.replace(/\D/g, '');
          if (d.length < 4 || d.slice(-4) === '0000') {
            return response(req, 400, { error: 'Please enter the valid last 4 digits of your Social Security Number.' });
          }
        }
      }
      if (!nextAddress) return response(req, 400, { error: 'Current residential address is required.' });
      if ((appType === 'guarantor' || appType === 'co_signer') && !nextHousingStatus) {
        return response(req, 400, { error: 'Please select your current housing status (Own, Rent, Mortgage, Family, or Other).' });
      }
      if (!nextEmpStatus) return response(req, 400, { error: 'Employment or income status is required.' });
      if (!nextIncome) return response(req, 400, { error: 'Monthly gross income is required.' });
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (profile?.phone !== undefined && str('phone')) updatePayload.phone = str('phone');
    if (nextDob) updatePayload.dob = nextDob;
    if (nextAddress) updatePayload.current_address = nextAddress;
    if (str('government_id_type')) updatePayload.government_id_type = str('government_id_type');
    if (str('government_id_number')) updatePayload.government_id_number = str('government_id_number');
    if (nextEmpStatus) updatePayload.employment_status = nextEmpStatus;
    if (nextHousingStatus) updatePayload.housing_status = nextHousingStatus;
    if (str('employer')) updatePayload.employer = str('employer');
    if (str('employer_address')) updatePayload.employer_address = str('employer_address');
    if (str('job_title')) updatePayload.job_title = str('job_title');
    if (str('employment_start_date')) updatePayload.employment_start_date = str('employment_start_date');
    if (str('employment_duration')) updatePayload.employment_duration = str('employment_duration');
    if (nextIncome) updatePayload.monthly_income = nextIncome;
    if (str('other_income')) updatePayload.other_income = str('other_income');

    if (appType === 'guarantor' || appType === 'co_signer') {
      if (str('financial_support_notes')) updatePayload.financial_support_notes = str('financial_support_notes');
    } else {
      if (str('residency_duration')) updatePayload.residency_duration = str('residency_duration');
      if (str('current_rent_amount')) updatePayload.current_rent_amount = str('current_rent_amount');
      if (str('reason_for_leaving')) updatePayload.reason_for_leaving = str('reason_for_leaving');
      if (str('current_landlord_name')) updatePayload.current_landlord_name = str('current_landlord_name');
      if (str('landlord_phone')) updatePayload.landlord_phone = str('landlord_phone');
      if (str('previous_address')) updatePayload.previous_address = str('previous_address');
      if (str('previous_residency_duration')) updatePayload.previous_residency_duration = str('previous_residency_duration');
      if (str('previous_landlord_name')) updatePayload.previous_landlord_name = str('previous_landlord_name');
      if (str('previous_landlord_phone')) updatePayload.previous_landlord_phone = str('previous_landlord_phone');
      if (typeof profile?.ever_evicted === 'boolean') updatePayload.ever_evicted = profile.ever_evicted;
      if (typeof profile?.smoker === 'boolean') updatePayload.smoker = profile.smoker;
      if (typeof profile?.has_bankruptcy === 'boolean') updatePayload.has_bankruptcy = profile.has_bankruptcy;
      if (str('bankruptcy_explanation')) updatePayload.bankruptcy_explanation = str('bankruptcy_explanation');
      if (typeof profile?.has_criminal_history === 'boolean') updatePayload.has_criminal_history = profile.has_criminal_history;
      if (str('criminal_history_explanation')) updatePayload.criminal_history_explanation = str('criminal_history_explanation');
    }

    if (ssnMode === 'alternative_id') {
      updatePayload.ssn_encrypted = null;
      updatePayload.ssn_last4 = null;
      updatePayload.ssn_hash = null;
    } else if (rawSsn) {
      const d = rawSsn.replace(/\D/g, '').slice(-4);
      if (d.length !== 4 || d === '0000') {
        return response(req, 400, { error: 'Please enter the valid last 4 digits of your Social Security Number.' });
      }
      updatePayload.ssn_encrypted = null;
      updatePayload.ssn_last4 = d;
      updatePayload.ssn_hash = null;
    }

    const { error: updateErr } = await supabase
      .from('application_applicants')
      .update(updatePayload)
      .eq('id', String(applicant.id));
    if (updateErr) {
      console.error('[confirm-co-applicant-screening] profile update failed:', updateErr.message);
      return response(req, 500, { error: 'Could not save your details. Please verify all fields and try again.' });
    }
  }

  const ip = req.headers.get('cf-connecting-ip')
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || null;
  const userAgent = req.headers.get('user-agent') || null;
  const { data: appUuid, error } = await supabase.rpc('confirm_co_applicant_screening', {
    p_token_hash: check.tokenHash,
    p_consent_version: '2.0',
    p_ip: ip,
    p_user_agent: userAgent,
  });

  if (error) {
    console.error('Co-applicant screening consent confirmation failed:', error.message);
    return response(req, 400, { error: 'This authorization link is invalid, expired, or already used. Contact the leasing team for a new link.' });
  }

  const { data: appInfo } = await supabase
    .from('applications')
    .select('app_id, household_payment_mode, payment_status, credit_applied_id, application_fee_per_adult')
    .eq('id', appUuid)
    .maybeSingle();

  const householdPaymentMode = String(appInfo?.household_payment_mode || 'centralized') === 'individual' ? 'individual' : 'centralized';
  const creditApplied = Boolean(appInfo?.credit_applied_id);
  const memberFee = creditApplied ? 0 : (Number(applicant?.screening_fee_amount ?? appInfo?.application_fee_per_adult ?? 50) || 50);
  const memberPayStatus = String(applicant?.payment_status || (appInfo?.payment_status === 'paid' || appInfo?.payment_status === 'waived' ? appInfo.payment_status : 'unpaid')).toLowerCase();
  const paymentRequired = householdPaymentMode === 'individual' && !creditApplied && memberFee > 0 && memberPayStatus !== 'paid' && memberPayStatus !== 'waived';
  const resolvedApplicantId = String(applicant?.id || check.tok.applicant_id || '');
  const payUrl = (paymentRequired && appInfo?.app_id && resolvedApplicantId)
    ? `${getSiteUrl()}/apply/pay.html?app_id=${encodeURIComponent(String(appInfo.app_id))}&applicant_id=${encodeURIComponent(resolvedApplicantId)}&token=${encodeURIComponent(token)}`
    : null;

  return response(req, 200, {
    success: true,
    application_id: appUuid,
    app_id: appInfo?.app_id || '',
    applicant_id: resolvedApplicantId || null,
    household_payment_mode: householdPaymentMode,
    screening_fee_amount: memberFee,
    payment_status: memberPayStatus,
    payment_required: paymentRequired,
    pay_url: payUrl,
    message: paymentRequired
      ? 'Your details and screening authorization are saved. Please complete your $50.00 screening fee below.'
      : 'Your details and screening authorization have been recorded.',
  });
});
