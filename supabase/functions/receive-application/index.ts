import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/send-email.ts';
import {
  applicationConfirmationHtml,
  adminNotificationHtml,
  coApplicantScreeningConsentHtml,
  landlordNewApplicationHtml,
} from '../_shared/email.ts';
import { getAdminEmails, getAdminUrl, getSiteUrl } from '../_shared/config.ts';
import { generateMagicLoginUrl } from '../_shared/magic-login.ts';
import { isDbRateLimited } from '../_shared/rate-limit.ts';
import { getLandlordForProperty } from '../_shared/landlord-notify.ts';
import { normalizeSsnDigits } from '../_shared/ssn-crypto.ts';
import { createPortalUploadToken } from '../_shared/upload-token.ts';
import {
  calculateHouseholdApplicationFee,
  calculateHouseholdFinancials,
  getRoleDisplayLabel,
  isOccupyingRole,
  normalizeApplicantType as normalizeRoleType,
  normalizeSubmissionMethod,
  type ApplicantRole,
  type SubmissionMethod,
} from '../_shared/application-rules.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const ADMIN_EMAILS = getAdminEmails();

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateAppId(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `CP-${y}${m}${d}-${random}${ms}`;
}

function fv(val: FormDataEntryValue | string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function formatPhoneWithExtras(rawPhone: string, ext = '', phoneType = '', secondary = ''): string | null {
  const base = fv(rawPhone);
  const sec = fv(secondary);
  if (!base && !sec) return null;
  let out = base;
  const cleanExt = fv(ext).replace(/[^0-9A-Za-z]/g, '');
  if (out && cleanExt) out += ` ext. ${cleanExt}`;
  if (out && phoneType && phoneType.toLowerCase() !== 'mobile') out += ` (${phoneType})`;
  if (sec) out = out ? `${out} | Alt: ${sec}` : `Alt: ${sec}`;
  return out || null;
}

type SsnMode = 'last4' | 'alternative_id';
function normalizeSsnMode(raw: unknown): SsnMode {
  const s = fv(raw as string).toLowerCase();
  if (s === 'alternative_id' || s === 'alt' || s === 'itin' || s === 'no_ssn') return 'alternative_id';
  return 'last4';
}

async function resolveIdentityFields(params: {
  mode: SsnMode;
  rawSsn: string;
  govIdType: string;
  govIdNum: string;
  label: string;
}): Promise<{ ok: true; last4: string | null; masked: string | null; encrypted: string | null; hash: string | null } | { ok: false; error: string }> {
  if (params.mode === 'alternative_id') {
    if (!params.govIdType && !params.govIdNum) {
      return { ok: false, error: `${params.label}: Please select an Alternative Government ID / ITIN type or provide an ID number.` };
    }
    const marker = params.govIdType ? `ALT-ID (${params.govIdType.slice(0, 20)})` : 'ALT-ID-VERIFIED';
    return { ok: true, last4: null, masked: marker, encrypted: null, hash: null };
  }
  const d = normalizeSsnDigits(params.rawSsn);
  if (d.length < 4) {
    return { ok: false, error: `${params.label}: Please enter the last 4 digits of your Social Security Number.` };
  }
  const last4 = d.slice(-4);
  if (last4 === '0000') {
    return { ok: false, error: `${params.label}: Last 4 digits of SSN cannot be 0000.` };
  }
  return { ok: true, last4, masked: `XXX-XX-${last4}`, encrypted: null, hash: null };
}

function fBool(val: FormDataEntryValue | string | number | boolean | null | undefined): boolean | null {
  if (typeof val === 'boolean') return val;
  const s = fv(val).toLowerCase();
  if (['true', 'yes', '1', 'on'].includes(s)) return true;
  if (['false', 'no', '0', 'none', 'off'].includes(s)) return false;
  return null;
}

function fNum(val: FormDataEntryValue | string | number | null | undefined): number | null {
  const raw = fv(val);
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.\-]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

const VALID_PAYMENT_STATUSES = new Set(['unpaid', 'paid', 'waived', 'refunded']);
function fPaymentStatus(val: FormDataEntryValue | string | null | undefined): string {
  const status = fv(val).toLowerCase();
  return VALID_PAYMENT_STATUSES.has(status) ? status : 'unpaid';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHARE_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for') || '';
  return (fwd.split(',')[0] || req.headers.get('cf-connecting-ip') || 'unknown').trim();
}

function ageInYears(dobStr: string): number | null {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

async function logBotAttempt(ip: string, ua: string, reason: string, payloadHash?: string) {
  try {
    await supabase.from('bot_attempts').insert({
      ip: ip === 'unknown' ? null : ip,
      user_agent: ua || null,
      endpoint: 'receive-application',
      reason,
      payload_hash: payloadHash || null,
    });
  } catch (_) { /* swallow */ }
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function normalizeApplicantType(rawRole: string): Exclude<ApplicantRole, 'primary'> {
  const t = normalizeRoleType(rawRole, false);
  return t === 'primary' ? 'co_applicant' : t;
}

interface NormalizedCoApplicant {
  role: string;
  applicant_type: Exclude<ApplicantRole, 'primary'>;
  submission_method: SubmissionMethod;
  housing_status: string;
  financial_support_notes: string;
  same_address: boolean;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  dob: string;
  ssn: string;
  ssn_mode: SsnMode;
  government_id_type: string;
  government_id_number: string;
  current_address: string;
  residency_duration: string;
  current_rent_amount: string;
  reason_for_leaving: string;
  current_landlord_name: string;
  landlord_phone: string;
  previous_address: string;
  previous_residency_duration: string;
  previous_landlord_name: string;
  previous_landlord_phone: string;
  employment_status: string;
  employer: string;
  employer_address: string;
  job_title: string;
  employment_start_date: string;
  employment_duration: string;
  supervisor_name: string;
  supervisor_phone: string;
  monthly_income: string;
  other_income: string;
  has_bankruptcy: boolean;
  bankruptcy_explanation: string;
  has_criminal_history: boolean;
  criminal_history_explanation: string;
  ever_evicted: boolean;
  smoker: boolean;
  reference_1_name: string;
  reference_1_phone: string;
  reference_1_relationship: string;
  reference_2_name: string;
  reference_2_phone: string;
  reference_2_relationship: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
  screening_consent: boolean;
  screening_consent_explicit: boolean;
}

function defaultRoleDisplay(type: Exclude<ApplicantRole, 'primary'>): string {
  if (type === 'guarantor') return 'Guarantor';
  if (type === 'co_signer') return 'Co-Signer';
  return 'Co-Applicant';
}

function parseCoApplicants(fields: Record<string, unknown>): NormalizedCoApplicant[] {
  const list: NormalizedCoApplicant[] = [];
  const rawJson = fields['_coApplicantsJson'] ?? fields['co_applicants'];
  let parsedArr: Array<Record<string, unknown>> = [];

  if (typeof rawJson === 'string' && rawJson.trim()) {
    try {
      const p = JSON.parse(rawJson);
      if (Array.isArray(p)) parsedArr = p;
    } catch { /* ignore invalid JSON here — fallback below */ }
  } else if (Array.isArray(rawJson)) {
    parsedArr = rawJson as Array<Record<string, unknown>>;
  }

  for (const item of parsedArr) {
    if (!item || typeof item !== 'object') continue;
    const roleRaw = fv(item.applicant_type as string) || fv(item.role as string) || 'Co-Applicant';
    const appType = normalizeApplicantType(roleRaw);
    const subMethod = normalizeSubmissionMethod(item.submission_method);
    const first = fv(item.first_name as string);
    const last = fv(item.last_name as string);
    const em = fv(item.email as string).toLowerCase();
    if (!first && !last && !em) continue;
    const hasExplicitConsent = item.screening_consent !== undefined && item.screening_consent !== null && item.screening_consent !== '';
    const parsedConsent = fBool(item.screening_consent as string) === true;
    list.push({
      role: fv(item.role as string) || defaultRoleDisplay(appType),
      applicant_type: appType,
      submission_method: subMethod,
      housing_status: fv(item.housing_status as string),
      financial_support_notes: fv(item.financial_support_notes as string),
      same_address: fBool(item.same_address as string) === true,
      first_name: first,
      last_name: last,
      email: em,
      phone: fv(item.phone as string),
      dob: fv(item.dob as string),
      ssn: fv(item.ssn as string),
      ssn_mode: normalizeSsnMode(item.ssn_mode as string),
      government_id_type: fv(item.government_id_type as string),
      government_id_number: fv(item.government_id_number as string),
      current_address: fv(item.current_address as string),
      residency_duration: fv(item.residency_duration as string),
      current_rent_amount: fv(item.current_rent_amount as string),
      reason_for_leaving: fv(item.reason_for_leaving as string),
      current_landlord_name: fv(item.current_landlord_name as string),
      landlord_phone: fv(item.landlord_phone as string),
      previous_address: fv(item.previous_address as string),
      previous_residency_duration: fv(item.previous_residency_duration as string),
      previous_landlord_name: fv(item.previous_landlord_name as string),
      previous_landlord_phone: fv(item.previous_landlord_phone as string),
      employment_status: fv(item.employment_status as string),
      employer: fv(item.employer as string),
      employer_address: fv(item.employer_address as string),
      job_title: fv(item.job_title as string),
      employment_start_date: fv(item.employment_start_date as string),
      employment_duration: fv(item.employment_duration as string),
      supervisor_name: fv(item.supervisor_name as string),
      supervisor_phone: fv(item.supervisor_phone as string),
      monthly_income: fv(item.monthly_income as string),
      other_income: fv(item.other_income as string),
      has_bankruptcy: fBool(item.has_bankruptcy as string) === true,
      bankruptcy_explanation: fv(item.bankruptcy_explanation as string),
      has_criminal_history: fBool(item.has_criminal_history as string) === true,
      criminal_history_explanation: fv(item.criminal_history_explanation as string),
      ever_evicted: appType === 'guarantor' ? false : fBool(item.ever_evicted as string) === true,
      smoker: appType === 'guarantor' ? false : fBool(item.smoker as string) === true,
      reference_1_name: fv(item.reference_1_name as string),
      reference_1_phone: fv(item.reference_1_phone as string),
      reference_1_relationship: fv(item.reference_1_relationship as string),
      reference_2_name: fv(item.reference_2_name as string),
      reference_2_phone: fv(item.reference_2_phone as string),
      reference_2_relationship: fv(item.reference_2_relationship as string),
      emergency_contact_name: fv(item.emergency_contact_name as string),
      emergency_contact_phone: fv(item.emergency_contact_phone as string),
      emergency_contact_relationship: fv(item.emergency_contact_relationship as string),
      screening_consent: parsedConsent,
      screening_consent_explicit: hasExplicitConsent,
    });
  }

  // Legacy single co-applicant flat field fallback
  if (list.length === 0 && fBool(fields['Has Co-Applicant'] as string) === true) {
    const roleStr = fv(fields['Additional Person Role'] as string) || fv(fields['Co-Applicant Role'] as string) || 'Co-Applicant';
    const appType = normalizeApplicantType(roleStr);
    const first = fv(fields['Co-Applicant First Name'] as string);
    const last = fv(fields['Co-Applicant Last Name'] as string);
    const em = fv(fields['Co-Applicant Email'] as string).toLowerCase();
    if (first || last || em) {
      list.push({
        role: roleStr,
        applicant_type: appType,
        submission_method: normalizeSubmissionMethod(fields['Co-Applicant Submission Method']),
        housing_status: fv(fields['Co-Applicant Housing Status'] as string),
        financial_support_notes: '',
        same_address: false,
        first_name: first,
        last_name: last,
        email: em,
        phone: fv(fields['Co-Applicant Phone'] as string),
        dob: fv(fields['Co-Applicant DOB'] as string),
        ssn: fv(fields['Co-Applicant SSN'] as string),
        ssn_mode: normalizeSsnMode(fields['Co-Applicant SSN Mode'] as string),
        government_id_type: '',
        government_id_number: '',
        current_address: '',
        residency_duration: '',
        current_rent_amount: '',
        reason_for_leaving: '',
        current_landlord_name: '',
        landlord_phone: '',
        previous_address: '',
        previous_residency_duration: '',
        previous_landlord_name: '',
        previous_landlord_phone: '',
        employment_status: fv(fields['Co-Applicant Employment Status'] as string),
        employer: fv(fields['Co-Applicant Employer'] as string),
        employer_address: '',
        job_title: fv(fields['Co-Applicant Job Title'] as string),
        employment_start_date: '',
        employment_duration: fv(fields['Co-Applicant Employment Duration'] as string),
        supervisor_name: '',
        supervisor_phone: '',
        monthly_income: fv(fields['Co-Applicant Monthly Income'] as string),
        other_income: '',
        has_bankruptcy: false,
        bankruptcy_explanation: '',
        has_criminal_history: false,
        criminal_history_explanation: '',
        ever_evicted: false,
        smoker: false,
        reference_1_name: '',
        reference_1_phone: '',
        reference_1_relationship: '',
        reference_2_name: '',
        reference_2_phone: '',
        reference_2_relationship: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        emergency_contact_relationship: '',
        screening_consent: fBool(fields['Co-Applicant Screening Consent'] as string) === true,
        screening_consent_explicit: fields['Co-Applicant Screening Consent'] !== undefined && fields['Co-Applicant Screening Consent'] !== '',
      });
    }
  }

  return list;
}

function isMemberAuthorizedByPrimary(ca: NormalizedCoApplicant, primaryTermsConsent: boolean): boolean {
  if (ca.submission_method !== 'primary_completed') return false;
  if (ca.screening_consent_explicit) return ca.screening_consent === true;
  return primaryTermsConsent === true;
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  (globalThis as unknown as { currentRequest?: Request }).currentRequest = req;
  const cors = handleCors(req);
  if (cors) return cors;

  // ── GET: legacy verification endpoint ──────────────────────────────────────
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const path = url.searchParams.get('path');
    const email = fv(url.searchParams.get('email')).toLowerCase();

    if (path === 'checkRecentSubmission') {
      if (!email || !email.includes('@')) return jsonOk({ found: false });
      const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('applications')
        .select('app_id, created_at')
        .ilike('email', email)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error('Verify error:', JSON.stringify(error));
        return jsonErr(500, 'Failed to verify submission');
      }
      return jsonOk({ found: !!data, appId: data?.app_id || null });
    }

    return jsonErr(400, 'Unsupported verification request');
  }

  if (req.method !== 'POST') return jsonErr(405, 'Method not allowed');

  const ip = getClientIp(req);
  const ua = req.headers.get('user-agent') || '';

  if (await isDbRateLimited(ip, 'receive-application', 5, 60_000)) {
    return jsonErr(429, 'Too many submissions. Please wait a minute and try again.');
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let fields: Record<string, string> = {};
  const ct = req.headers.get('content-type') || '';

  try {
    if (ct.includes('multipart/form-data') || ct.includes('application/x-www-form-urlencoded')) {
      const fd = await req.formData();
      for (const [key, value] of fd.entries()) {
        if (typeof value === 'string') fields[key] = value;
      }
    } else {
      fields = await req.json();
    }
  } catch {
    return jsonErr(400, 'Invalid request body');
  }

  if (fields['_trap']) {
    await logBotAttempt(ip, ua, 'honeypot');
    return jsonOk({ success: true, message: 'Application received.', appId: 'HP-' + Date.now() });
  }

  // ── Required-field & SSN/Identity validation — Primary ───────────────────
  const email      = fv(fields['Email']).toLowerCase();
  const rawFirst   = fv(fields['First Name']);
  const middleName = fv(fields['Middle Name']);
  const firstName  = middleName ? `${rawFirst} ${middleName}`.trim() : rawFirst;
  const lastName   = fv(fields['Last Name']);
  const dob        = fv(fields['DOB']);

  if (!email || !email.includes('@') || email.length > 254) {
    await logBotAttempt(ip, ua, 'invalid_email');
    return jsonErr(400, 'Valid email is required');
  }
  if (!rawFirst) return jsonErr(400, 'First name is required');

  const termsConsent = fv(fields['Terms Consent']) === 'yes'
                    || fBool(fields['Terms Consent']) === true
                    || fBool(fields['agreeTermsPrivacy']) === true;
  if (!termsConsent) {
    return jsonErr(400, 'You must accept the Terms & Privacy Policy to submit.');
  }

  const age = ageInYears(dob);
  if (age === null) return jsonErr(400, 'A valid date of birth is required.');
  if (age < 18)     return jsonErr(400, 'Applicants must be 18 years of age or older.');
  if (age > 120)    return jsonErr(400, 'Please enter a valid date of birth.');

  const primarySsnMode = normalizeSsnMode(fields['SSN Mode'] || fields['ssn_mode']);
  const primaryIdRes = await resolveIdentityFields({
    mode: primarySsnMode,
    rawSsn: fv(fields['SSN']),
    govIdType: fv(fields['Government ID Type']),
    govIdNum: fv(fields['Government ID Number']),
    label: 'Primary applicant',
  });
  if (!primaryIdRes.ok) {
    return jsonErr(400, primaryIdRes.error);
  }

  // ── Additional Members parsing & validation (Method A & Method B) ─────────
  const coApplicants = parseCoApplicants(fields);
  const seenEmails = new Set<string>([email]);
  const coSsnValidated: Array<{ last4: string | null; masked: string | null; encrypted: string | null; hash: string | null }> = [];

  for (let i = 0; i < coApplicants.length; i++) {
    const ca = coApplicants[i];
    const roleLbl = defaultRoleDisplay(ca.applicant_type);
    const label = `${roleLbl} #${i + 1}`;
    if (!ca.first_name) return jsonErr(400, `${label}: First name is required.`);
    if (!ca.email || !ca.email.includes('@') || ca.email.length > 254) {
      return jsonErr(400, `${label}: A valid email address is required.`);
    }
    if (seenEmails.has(ca.email)) {
      return jsonErr(400, `${label}: Email address (${ca.email}) cannot duplicate another member on the same application.`);
    }
    seenEmails.add(ca.email);

    if (ca.submission_method === 'primary_completed') {
      if (ca.screening_consent_explicit && !ca.screening_consent) {
        return jsonErr(400, `${label}: Screening authorization is required when completing details on their behalf.`);
      }
      if (!ca.dob) return jsonErr(400, `${label}: Date of birth is required when completing details on their behalf.`);
      const caAge = ageInYears(ca.dob);
      if (caAge === null) return jsonErr(400, `${label}: A valid date of birth is required.`);
      if (caAge < 18)     return jsonErr(400, `${label} must be 18 years of age or older.`);
      if (caAge > 120)    return jsonErr(400, `${label}: Please enter a valid date of birth.`);

      const coIdRes = await resolveIdentityFields({
        mode: ca.ssn_mode,
        rawSsn: ca.ssn,
        govIdType: ca.government_id_type,
        govIdNum: ca.government_id_number,
        label,
      });
      if (!coIdRes.ok) {
        return jsonErr(400, coIdRes.error);
      }
      coSsnValidated.push({
        last4: coIdRes.last4,
        masked: coIdRes.masked,
        encrypted: coIdRes.encrypted,
        hash: coIdRes.hash,
      });
    } else {
      // Method B (invited): validate optional DOB/SSN only if provided, otherwise defer to private link completion
      if (ca.dob) {
        const caAge = ageInYears(ca.dob);
        if (caAge === null || caAge < 18 || caAge > 120) {
          return jsonErr(400, `${label}: If entered, date of birth must confirm the member is at least 18 years old.`);
        }
      }
      if (ca.ssn && ca.ssn.replace(/\D/g, '').length > 0) {
        const coIdRes = await resolveIdentityFields({
          mode: ca.ssn_mode,
          rawSsn: ca.ssn,
          govIdType: ca.government_id_type,
          govIdNum: ca.government_id_number,
          label,
        });
        if (!coIdRes.ok) return jsonErr(400, coIdRes.error);
        coSsnValidated.push({
          last4: coIdRes.last4,
          masked: coIdRes.masked,
          encrypted: coIdRes.encrypted,
          hash: coIdRes.hash,
        });
      } else {
        coSsnValidated.push({ last4: null, masked: null, encrypted: null, hash: null });
      }
    }
  }

  const primarySsnEncrypted = primaryIdRes.encrypted;
  const primarySsnHash      = primaryIdRes.hash;

  // ── Property lookup & server-enforced economics ───────────────────────────
  const submittedPropertyId = fv(fields['Property ID']);
  if (!submittedPropertyId) {
    await logBotAttempt(ip, ua, 'no_property');
    return jsonErr(400, 'A property selection is required.');
  }

  const { data: prop, error: propErr } = await supabase
    .from('properties')
    .select('id, address, state, landlord_id, application_fee, monthly_rent, security_deposit, pets_allowed, smoking_allowed, status')
    .eq('id', submittedPropertyId)
    .maybeSingle();

  if (propErr) {
    console.error('Property lookup error:', JSON.stringify(propErr));
    return jsonErr(500, 'Could not validate property. Please retry.');
  }
  if (!prop) {
    await logBotAttempt(ip, ua, 'unknown_property');
    return jsonErr(400, 'Selected property is no longer available.');
  }
  if (prop.status && !['active', 'pending', 'private_placement'].includes(prop.status)) {
    return jsonErr(422, 'This property is no longer accepting applications.');
  }

  if (prop.status === 'private_placement') {
    const shareToken = fv(fields['_share_token']);
    if (shareToken) {
      if (!SHARE_TOKEN_RE.test(shareToken)) {
        return jsonErr(403, 'This private listing requires its valid client share link.');
      }
      const tokenHash = await sha256Hex(shareToken);
      const { data: share, error: shareError } = await supabase
        .from('property_shares')
        .select('id')
        .eq('token_hash', tokenHash)
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (shareError) return jsonErr(500, 'Could not validate the private listing link. Please retry.');
      if (!share) return jsonErr(403, 'This private listing link is invalid or expired.');

      const { data: membership, error: membershipError } = await supabase
        .from('property_share_properties')
        .select('property_id')
        .eq('share_id', share.id)
        .eq('property_id', submittedPropertyId)
        .maybeSingle();

      if (membershipError) return jsonErr(500, 'Could not validate the private listing link. Please retry.');
      if (!membership) return jsonErr(403, 'This private listing is not part of your client share.');
    }
  }

  const locale: 'en' | 'es' = fv(fields['Preferred Language']).toLowerCase().startsWith('es') ? 'es' : 'en';
  const perAdultFee     = typeof prop.application_fee === 'number' && prop.application_fee > 0 ? prop.application_fee : 50;
  const enforcedRent    = typeof prop.monthly_rent === 'number' ? prop.monthly_rent : null;
  const enforcedDeposit = typeof prop.security_deposit === 'number' ? prop.security_deposit : null;
  const enforcedAddress = prop.address || fv(fields['Property Address']) || null;
  const stateCode       = String(prop.state || fv(fields['Property State']) || '').trim().toUpperCase().slice(0, 2);

  // Compute strictly separated Household Occupant Income vs Guarantor & Co-Signer Support
  const financials = calculateHouseholdFinancials(
    [
      {
        is_primary: true,
        applicant_type: 'primary',
        first_name: firstName,
        last_name: lastName,
        monthly_income: fields['Monthly Income'],
        other_income: fields['Other Income'],
      },
      ...coApplicants.map((ca) => ({
        is_primary: false,
        applicant_type: ca.applicant_type,
        role: ca.role,
        first_name: ca.first_name,
        last_name: ca.last_name,
        monthly_income: ca.monthly_income,
        other_income: ca.other_income,
      })),
    ],
    enforcedRent,
  );
  const householdIncomeRounded = financials.householdMonthlyIncome > 0
    ? Math.round(financials.householdMonthlyIncome * 100) / 100
    : null;
  const guarantorIncomeRounded = Math.round(financials.guarantorMonthlyIncome * 100) / 100;
  const coSignerIncomeRounded  = Math.round(financials.coSignerMonthlyIncome * 100) / 100;
  const totalSupportRounded    = financials.totalFinancialSupport > 0
    ? Math.round(financials.totalFinancialSupport * 100) / 100
    : null;

  // ── Idempotency ───────────────────────────────────────────────────────────
  const clientUuid = fv(fields['submission_uuid']);
  const submissionUuid = (clientUuid && UUID_RE.test(clientUuid)) ? clientUuid.toLowerCase() : crypto.randomUUID();

  {
    const { data: existing } = await supabase
      .from('applications')
      .select('app_id')
      .eq('submission_uuid', submissionUuid)
      .maybeSingle();
    if (existing?.app_id) {
      return jsonOk({ success: true, appId: existing.app_id, message: 'Application already received.', deduped: true });
    }
  }

  // ── Per-email 24h dedup ───────────────────────────────────────────────────
  {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from('applications')
      .select('app_id, property_id, created_at')
      .ilike('email', email)
      .eq('property_id', submittedPropertyId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent?.app_id) {
      return jsonOk({ success: true, appId: recent.app_id, message: 'A recent application already exists for this email and property.', deduped: true });
    }
  }

  // ── Optional Reapplication Credit Redemption (2 credits / 45 days) ────────
  let appliedCreditId: string | null = null;
  let initialPaymentStatus = fPaymentStatus(null);
  let creditNote = '';
  if (fBool(fields['apply_credit']) === true) {
    const { data: activeCredit } = await supabase
      .from('application_credits')
      .select('id, original_app_id, remaining_credits, used_app_ids')
      .ilike('email', email)
      .eq('status', 'active')
      .gt('remaining_credits', 0)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (activeCredit?.id) {
      appliedCreditId = activeCredit.id;
      initialPaymentStatus = 'waived';
      creditNote = `Reapplication credit applied from ${activeCredit.original_app_id}`;
    }
  }

  const feeSummary = calculateHouseholdApplicationFee(
    [
      {
        applicant_index: 0,
        is_primary: true,
        applicant_type: 'primary',
        role: 'Primary Applicant',
        submission_method: 'primary_completed',
        first_name: firstName,
        last_name: lastName,
      },
      ...coApplicants.map((ca, idx) => ({
        applicant_index: idx + 1,
        is_primary: false,
        applicant_type: ca.applicant_type,
        role: ca.role,
        submission_method: ca.submission_method,
        first_name: ca.first_name,
        last_name: ca.last_name,
      })),
    ],
    {
      perPersonFee: perAdultFee,
      creditApplied: !!appliedCreditId,
      stateCode,
      locale,
    },
  );
  const enforcedFee = feeSummary.totalFee;
  const screenedAdultCount = feeSummary.screenedAdultCount;

  const appId = generateAppId();
  const portalUrl = await generateMagicLoginUrl(supabase, email, { appId });
  const nowIso = new Date().toISOString();
  const consentVer = fv(fields['Consent Version']) || '2.0';
  const firstCo = coApplicants[0] || null;
  const firstCoSsn = coSsnValidated[0] || null;
  const allCoAuthorized = coApplicants.length > 0 && coApplicants.every((ca) => isMemberAuthorizedByPrimary(ca, termsConsent));

  const rawPayMode = fv(fields['household_payment_mode'] || fields['Household Payment Mode']).toLowerCase();
  const householdPaymentMode: 'centralized' | 'individual' =
    coApplicants.length > 0 && (rawPayMode === 'individual' || rawPayMode === 'split' || rawPayMode === 'option_b')
      ? 'individual'
      : 'centralized';
  const primaryFeeItem = feeSummary.feeBreakdown[0];
  const initialAmountDue = appliedCreditId
    ? 0
    : (householdPaymentMode === 'individual' ? Number(primaryFeeItem?.fee ?? perAdultFee) : enforcedFee);

  const formattedPrimaryPhone = formatPhoneWithExtras(
    fv(fields['Phone']),
    '',
    fv(fields['Primary Phone Type']),
    fv(fields['Secondary Phone']),
  );
  const formattedLandlordPhone = formatPhoneWithExtras(fv(fields['Landlord Phone']), fv(fields['Landlord Phone Ext']));
  const formattedPrevLandlordPhone = formatPhoneWithExtras(fv(fields['Previous Landlord Phone']), fv(fields['Previous Landlord Phone Ext']));
  const formattedSupervisorPhone = formatPhoneWithExtras(fv(fields['Supervisor Phone']), fv(fields['Supervisor Phone Ext']));
  const formattedRef1Phone = formatPhoneWithExtras(fv(fields['Reference 1 Phone']), fv(fields['Reference 1 Phone Ext']));
  const formattedRef2Phone = formatPhoneWithExtras(fv(fields['Reference 2 Phone']), fv(fields['Reference 2 Phone Ext']));
  const formattedEmergencyPhone = formatPhoneWithExtras(fv(fields['Emergency Contact Phone']), fv(fields['Emergency Contact Phone Ext']));

  const application: Record<string, unknown> = {
    app_id: appId,
    submission_uuid: submissionUuid,
    status: 'pending',
    first_name: firstName,
    last_name: lastName,
    email,
    phone: formattedPrimaryPhone,
    dob: dob || null,
    // Store ONLY masked XXX-XX-1234 or ALT-ID marker in legacy applications.ssn! Full encrypted SSN lives exclusively in application_applicants.
    ssn: primaryIdRes.masked,
    property_address: enforcedAddress,
    property_id: submittedPropertyId,
    landlord_id: prop.landlord_id || null,
    requested_move_in_date: fv(fields['Requested Move-in Date']) || null,
    desired_lease_term: fv(fields['Desired Lease Term']) || null,
    current_address: fv(fields['Current Address']) || null,
    residency_duration: fv(fields['Residency Duration']) || null,
    current_rent_amount: fv(fields['Current Rent Amount']) || null,
    reason_for_leaving: fv(fields['Reason for leaving']) || null,
    current_landlord_name: fv(fields['Current Landlord Name']) || null,
    landlord_phone: formattedLandlordPhone,
    previous_address: fv(fields['Previous Address']) || null,
    previous_residency_duration: fv(fields['Previous Residency Duration']) || null,
    previous_landlord_name: fv(fields['Previous Landlord Name']) || null,
    previous_landlord_phone: formattedPrevLandlordPhone,
    employment_status: fv(fields['Employment Status']) || null,
    employer: fv(fields['Employer']) || null,
    employer_address: fv(fields['Employer Address']) || null,
    job_title: fv(fields['Job Title']) || null,
    employment_start_date: fv(fields['Employment Start Date']) || null,
    employment_duration: fv(fields['Employment Duration']) || null,
    supervisor_name: fv(fields['Supervisor Name']) || null,
    supervisor_phone: formattedSupervisorPhone,
    monthly_income: fv(fields['Monthly Income']) || null,
    other_income: fv(fields['Other Income']) || null,
    has_bankruptcy: fBool(fields['Has Bankruptcy']),
    bankruptcy_explanation: fv(fields['Bankruptcy Explanation']) || null,
    has_criminal_history: fBool(fields['Has Criminal History']),
    criminal_history_explanation: fv(fields['Criminal History Explanation']) || null,
    government_id_type: fv(fields['Government ID Type']) || null,
    government_id_number: fv(fields['Government ID Number']) || null,
    reference_1_name: fv(fields['Reference 1 Name']) || null,
    reference_1_phone: formattedRef1Phone,
    reference_1_relationship: fv(fields['Reference 1 Relationship']) || null,
    reference_2_name: fv(fields['Reference 2 Name']) || null,
    reference_2_phone: formattedRef2Phone,
    reference_2_relationship: fv(fields['Reference 2 Relationship']) || null,
    emergency_contact_name: fv(fields['Emergency Contact Name']) || null,
    emergency_contact_phone: formattedEmergencyPhone,
    emergency_contact_relationship: fv(fields['Emergency Contact Relationship']) || null,
    primary_payment_method: null,
    primary_payment_method_other: null,
    alternative_payment_method: null,
    alternative_payment_method_other: null,
    third_choice_payment_method: null,
    third_choice_payment_method_other: null,
    has_pets: fBool(fields['Has Pets']),
    pet_details: fv(fields['Pet Details']) || null,
    total_occupants: fNum(fields['Total Occupants']) ?? financials.occupyingAdultCount,
    additional_occupants: fv(fields['Additional Occupants']) || null,
    ever_evicted: fBool(fields['Ever Evicted']),
    smoker: fBool(fields['Smoker']),
    preferred_language: locale,
    preferred_contact_method: fv(fields['Preferred Contact Method']) || null,
    preferred_time: fv(fields['Preferred Time']) || null,
    preferred_time_specific: fv(fields['Preferred Time Specific']) || null,
    vehicle_make: fv(fields['Vehicle Make']) || null,
    vehicle_model: fv(fields['Vehicle Model']) || null,
    vehicle_year: fv(fields['Vehicle Year']) || null,
    vehicle_license_plate: fv(fields['Vehicle License Plate']) || null,
    // Multi-applicant summary + separated household vs financial support + 1st additional projection
    has_co_applicant: coApplicants.length > 0,
    co_applicant_count: coApplicants.length,
    screened_adult_count: screenedAdultCount,
    occupying_adult_count: financials.occupyingAdultCount,
    guarantor_count: financials.guarantorCount,
    co_signer_count: financials.coSignerCount,
    application_fee_per_adult: perAdultFee,
    household_payment_mode: householdPaymentMode,
    combined_monthly_income: householdIncomeRounded,
    household_monthly_income: householdIncomeRounded,
    guarantor_monthly_income: guarantorIncomeRounded,
    co_signer_monthly_income: coSignerIncomeRounded,
    total_financial_support: totalSupportRounded,
    fee_breakdown: feeSummary.feeBreakdown,
    jurisdiction_fee_note: feeSummary.jurisdictionFeeNote,
    additional_person_role: firstCo?.role || null,
    co_applicant_role: firstCo?.role || null,
    co_applicant_first_name: firstCo?.first_name || null,
    co_applicant_last_name: firstCo?.last_name || null,
    co_applicant_email: firstCo?.email || null,
    co_applicant_phone: firstCo?.phone || null,
    co_applicant_dob: firstCo?.dob || null,
    co_applicant_ssn: firstCoSsn?.masked || null,
    co_applicant_employer: firstCo?.employer || null,
    co_applicant_job_title: firstCo?.job_title || null,
    co_applicant_monthly_income: firstCo?.monthly_income || null,
    co_applicant_employment_duration: firstCo?.employment_duration || null,
    co_applicant_employment_status: firstCo?.employment_status || null,
    co_applicant_consent: coApplicants.length > 0 ? allCoAuthorized : null,
    co_applicant_consent_timestamp: allCoAuthorized ? nowIso : null,
    co_applicant_consent_version: allCoAuthorized ? consentVer : null,
    // Economics & state
    application_fee: enforcedFee,
    monthly_rent: enforcedRent,
    security_deposit: enforcedDeposit,
    lease_status: 'none',
    move_in_status: 'pending',
    payment_status: initialPaymentStatus,
    application_payment_state: initialPaymentStatus === 'waived' ? 'Payment Successful' : 'Awaiting Payment',
    credit_applied_id: appliedCreditId,
    payment_notes: creditNote || null,
    terms_consent: termsConsent,
    screening_consent: termsConsent,
    screening_consent_timestamp: nowIso,
    screening_consent_version: fv(fields['Consent Version']) || '2.0',
    sms_consent: fv(fields['SMS Consent']) === 'yes' || fBool(fields['SMS Consent']) === true || fBool(fields['smsConsent']) === true,
    consent_timestamp: nowIso,
    consent_version: fv(fields['Consent Version']) || '2.0',
  };

  const cleanApp = Object.fromEntries(
    Object.entries(application).filter(([, val]) => {
      if (val === null || val === undefined) return false;
      if (typeof val === 'string' && val === '') return false;
      return true;
    })
  );

  // ── Insert primary application row ────────────────────────────────────────
  let { data: insertedApp, error: insertErr } = await supabase
    .from('applications')
    .insert(cleanApp)
    .select('id, app_id')
    .single();

  if (insertErr && (insertErr.code === 'PGRST204' || insertErr.code === '42703' || /application_payment_state/i.test(insertErr.message || ''))) {
    const { application_payment_state: _omitted, ...legacyCleanApp } = cleanApp;
    const retry = await supabase
      .from('applications')
      .insert(legacyCleanApp)
      .select('id, app_id')
      .single();
    insertedApp = retry.data;
    insertErr = retry.error;
  }

  if (insertErr) {
    if ((insertErr as { code?: string }).code === '23505') {
      const { data: dup } = await supabase
        .from('applications').select('app_id')
        .eq('submission_uuid', submissionUuid).maybeSingle();
      if (dup?.app_id) {
        return jsonOk({ success: true, appId: dup.app_id, portal_login_url: portalUrl, message: 'Application already received.', deduped: true });
      }
    }
    console.error('Insert error:', JSON.stringify(insertErr));
    return jsonErr(500, 'Failed to save application');
  }

  const applicationUuid = insertedApp.id as string;

  // Redeem application credit atomically if used
  if (appliedCreditId) {
    try {
      const { data: cr } = await supabase
        .from('application_credits')
        .select('remaining_credits, used_app_ids')
        .eq('id', appliedCreditId)
        .single();
      if (cr && cr.remaining_credits > 0) {
        const nextRem = cr.remaining_credits - 1;
        await supabase.from('application_credits').update({
          remaining_credits: nextRem,
          status: nextRem === 0 ? 'exhausted' : 'active',
          used_app_ids: [...(cr.used_app_ids || []), appId],
        }).eq('id', appliedCreditId);
      }
    } catch (e) { console.warn('Credit deduction warning:', (e as Error).message); }
  }

  // ── Insert normalized Primary + N Additional Member rows into application_applicants
  const applicantRowsToInsert = [
    {
      application_id: applicationUuid,
      app_id: appId,
      applicant_index: 0,
      applicant_type: 'primary',
      is_primary: true,
      role: 'Primary Applicant',
      submission_method: 'primary_completed',
      info_completed: true,
      info_completed_at: nowIso,
      is_occupant: true,
      screening_fee_amount: feeSummary.feeBreakdown[0]?.fee ?? perAdultFee,
      payment_status: appliedCreditId ? 'waived' : 'unpaid',
      application_payment_state: appliedCreditId ? 'Payment Successful' : 'Awaiting Payment',
      screening_status: 'consented',
      first_name: firstName,
      last_name: lastName,
      email,
      phone: formattedPrimaryPhone,
      dob: dob || null,
      housing_status: fv(fields['Housing Status']) || null,
      ssn_encrypted: primarySsnEncrypted,
      ssn_last4: primaryIdRes.last4,
      ssn_hash: primarySsnHash,
      government_id_type: fv(fields['Government ID Type']) || null,
      government_id_number: fv(fields['Government ID Number']) || null,
      current_address: fv(fields['Current Address']) || null,
      residency_duration: fv(fields['Residency Duration']) || null,
      current_rent_amount: fv(fields['Current Rent Amount']) || null,
      reason_for_leaving: fv(fields['Reason for leaving']) || null,
      current_landlord_name: fv(fields['Current Landlord Name']) || null,
      landlord_phone: formattedLandlordPhone,
      previous_address: fv(fields['Previous Address']) || null,
      previous_residency_duration: fv(fields['Previous Residency Duration']) || null,
      previous_landlord_name: fv(fields['Previous Landlord Name']) || null,
      previous_landlord_phone: formattedPrevLandlordPhone,
      employment_status: fv(fields['Employment Status']) || null,
      employer: fv(fields['Employer']) || null,
      employer_address: fv(fields['Employer Address']) || null,
      job_title: fv(fields['Job Title']) || null,
      employment_start_date: fv(fields['Employment Start Date']) || null,
      employment_duration: fv(fields['Employment Duration']) || null,
      supervisor_name: fv(fields['Supervisor Name']) || null,
      supervisor_phone: formattedSupervisorPhone,
      monthly_income: fv(fields['Monthly Income']) || null,
      other_income: fv(fields['Other Income']) || null,
      has_bankruptcy: fBool(fields['Has Bankruptcy']) === true,
      bankruptcy_explanation: fv(fields['Bankruptcy Explanation']) || null,
      has_criminal_history: fBool(fields['Has Criminal History']) === true,
      criminal_history_explanation: fv(fields['Criminal History Explanation']) || null,
      ever_evicted: fBool(fields['Ever Evicted']) === true,
      smoker: fBool(fields['Smoker']) === true,
      reference_1_name: fv(fields['Reference 1 Name']) || null,
      reference_1_phone: formattedRef1Phone,
      reference_1_relationship: fv(fields['Reference 1 Relationship']) || null,
      reference_2_name: fv(fields['Reference 2 Name']) || null,
      reference_2_phone: formattedRef2Phone,
      reference_2_relationship: fv(fields['Reference 2 Relationship']) || null,
      emergency_contact_name: fv(fields['Emergency Contact Name']) || null,
      emergency_contact_phone: formattedEmergencyPhone,
      emergency_contact_relationship: fv(fields['Emergency Contact Relationship']) || null,
      screening_consent: true,
      screening_consent_timestamp: nowIso,
      screening_consent_version: String(application.consent_version),
      screening_consent_ip: ip === 'unknown' ? null : ip,
    },
    ...coApplicants.map((ca, idx) => {
      const feeLine = feeSummary.feeBreakdown[idx + 1];
      const infoDone = ca.submission_method === 'primary_completed';
      const methodAAuthorized = isMemberAuthorizedByPrimary(ca, termsConsent);
      return {
        application_id: applicationUuid,
        app_id: appId,
        applicant_index: idx + 1,
        applicant_type: ca.applicant_type,
        is_primary: false,
        role: ca.role,
        submission_method: ca.submission_method,
        info_completed: infoDone,
        info_completed_at: infoDone ? nowIso : null,
        housing_status: ca.housing_status || null,
        is_occupant: isOccupyingRole(ca.applicant_type),
        screening_fee_amount: feeLine?.fee ?? perAdultFee,
        payment_status: appliedCreditId ? 'waived' : 'unpaid',
        application_payment_state: appliedCreditId ? 'Payment Successful' : 'Awaiting Payment',
        screening_status: ca.submission_method === 'invited' ? 'invited' : (methodAAuthorized ? 'consented' : 'pending_consent'),
        financial_support_notes: ca.financial_support_notes || null,
        first_name: ca.first_name,
        last_name: ca.last_name || null,
        email: ca.email,
        phone: ca.phone || null,
        dob: ca.dob || null,
        ssn_encrypted: coSsnValidated[idx].encrypted,
        ssn_last4: coSsnValidated[idx].last4,
        ssn_hash: coSsnValidated[idx].hash,
        government_id_type: ca.government_id_type || null,
        government_id_number: ca.government_id_number || null,
        current_address: ca.current_address || null,
        residency_duration: ca.residency_duration || null,
        current_rent_amount: ca.current_rent_amount || null,
        reason_for_leaving: ca.reason_for_leaving || null,
        current_landlord_name: ca.current_landlord_name || null,
        landlord_phone: ca.landlord_phone || null,
        previous_address: ca.previous_address || null,
        previous_residency_duration: ca.previous_residency_duration || null,
        previous_landlord_name: ca.previous_landlord_name || null,
        previous_landlord_phone: ca.previous_landlord_phone || null,
        employment_status: ca.employment_status || null,
        employer: ca.employer || null,
        employer_address: ca.employer_address || null,
        job_title: ca.job_title || null,
        employment_start_date: ca.employment_start_date || null,
        employment_duration: ca.employment_duration || null,
        supervisor_name: ca.supervisor_name || null,
        supervisor_phone: ca.supervisor_phone || null,
        monthly_income: ca.monthly_income || null,
        other_income: ca.other_income || null,
        has_bankruptcy: ca.has_bankruptcy,
        bankruptcy_explanation: ca.bankruptcy_explanation || null,
        has_criminal_history: ca.has_criminal_history,
        criminal_history_explanation: ca.criminal_history_explanation || null,
        ever_evicted: ca.ever_evicted,
        smoker: ca.smoker,
        reference_1_name: ca.reference_1_name || null,
        reference_1_phone: ca.reference_1_phone || null,
        reference_1_relationship: ca.reference_1_relationship || null,
        reference_2_name: ca.reference_2_name || null,
        reference_2_phone: ca.reference_2_phone || null,
        reference_2_relationship: ca.reference_2_relationship || null,
        emergency_contact_name: ca.emergency_contact_name || null,
        emergency_contact_phone: ca.emergency_contact_phone || null,
        emergency_contact_relationship: ca.emergency_contact_relationship || null,
        screening_consent: methodAAuthorized,
        screening_consent_timestamp: methodAAuthorized ? nowIso : null,
        screening_consent_version: methodAAuthorized ? consentVer : null,
        screening_consent_ip: methodAAuthorized ? (ip === 'unknown' ? null : ip) : null,
      };
    }),
  ];

  const { data: insertedApplicants, error: appApplicantsErr } = await supabase
    .from('application_applicants')
    .insert(applicantRowsToInsert)
    .select('id, applicant_index, is_primary, email, first_name, last_name, role, applicant_type, submission_method, screening_consent');

  if (appApplicantsErr) {
    console.error('application_applicants insert error:', JSON.stringify(appApplicantsErr));
    // Roll back orphaned application row so user isn't left with half state
    await supabase.from('applications').delete().eq('id', applicationUuid);
    return jsonErr(500, 'Failed to store applicant records securely.');
  }

  const applicantIdByIndex = new Map<number, string>();
  for (const row of (insertedApplicants || [])) {
    applicantIdByIndex.set(Number(row.applicant_index), row.id as string);
  }

  // Sync legacy co_applicants table for any legacy readers
  if (coApplicants.length > 0) {
    try {
      await supabase.from('co_applicants').insert(
        coApplicants.map((ca, idx) => ({
          app_id: appId,
          first_name: ca.first_name,
          last_name: ca.last_name || null,
          email: ca.email,
          phone: ca.phone || null,
          dob: ca.dob || null,
          ssn: coSsnValidated[idx].masked,
          role: ca.role,
          employer: ca.employer || null,
          job_title: ca.job_title || null,
          monthly_income: ca.monthly_income || null,
          employment_duration: ca.employment_duration || null,
          employment_status: ca.employment_status || null,
          consent: isMemberAuthorizedByPrimary(ca, termsConsent),
        }))
      );
    } catch (e) { console.warn('Legacy co_applicants sync warning:', (e as Error).message); }
  }

  // ── Persist attached documents (up to 12 per-applicant docs) ─────────────
  try {
    let docIdx = 0;
    while (docIdx < 12 && fields[`_docFile_${docIdx}_data`]) {
      const origName = fv(fields[`_docFile_${docIdx}_name`]) || `document_${docIdx}`;
      const mimeType = fv(fields[`_docFile_${docIdx}_type`]) || 'application/octet-stream';
      const docType  = fv(fields[`_docFile_${docIdx}_doc_type`]) || 'applicant_upload';
      const docSide  = fv(fields[`_docFile_${docIdx}_side`]);
      const appIdxRaw = fNum(fields[`_docFile_${docIdx}_applicant_index`]);
      const targetAppIdx = appIdxRaw !== null ? Math.max(0, Math.round(appIdxRaw)) : 0;
      const targetApplicantId = applicantIdByIndex.get(targetAppIdx) ?? applicantIdByIndex.get(0) ?? null;
      const b64 = fields[`_docFile_${docIdx}_data`];

      const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
      if (!ALLOWED_MIME.has(mimeType)) {
        console.warn(`[CP] Skipping doc idx=${docIdx} — disallowed MIME type: ${mimeType}`);
        docIdx++;
        continue;
      }

      const binStr = atob(b64);
      const bytes  = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);

      const safeName = origName.replace(/[^a-zA-Z0-9._\-]/g, '_');
      const storagePath = `${appId}/applicant_${targetAppIdx}/${Date.now()}_${safeName}`;

      const { error: uploadErr } = await supabase.storage
        .from('application-docs')
        .upload(storagePath, bytes, { contentType: mimeType, upsert: false });

      if (!uploadErr) {
        await supabase.from('application_documents').insert({
          app_id:              appId,
          application_id:      applicationUuid,
          applicant_id:        targetApplicantId,
          bucket:              'application-docs',
          storage_path:        storagePath,
          original_file_name:  origName,
          mime_type:           mimeType,
          file_size_bytes:     bytes.byteLength,
          doc_type:            docType,
          status:              'uploaded',
          review_status:       'pending',
          uploaded_by_email:   email,
          metadata: {
            submitted_with_application: true,
            file_index: docIdx,
            applicant_index: targetAppIdx,
            ...(docSide === 'front' || docSide === 'back' ? { doc_side: docSide } : {}),
          },
        });
      } else {
        console.error(`[CP] Doc upload failed idx=${docIdx}:`, uploadErr.message);
      }

      docIdx++;
    }
  } catch (docErr) {
    console.error('[CP] Document processing error (non-fatal):', docErr);
  }

  // ── Append-only consent record & per-applicant screening consent events ───
  try {
    await supabase.from('consent_log').insert({
      app_id: appId,
      submission_uuid: submissionUuid,
      email,
      consent_version: String(application.consent_version),
      terms_consent: termsConsent,
      sms_consent: !!application.sms_consent,
      ip: ip === 'unknown' ? null : ip,
      user_agent: ua || null,
    });
  } catch (e) {
    console.error('consent_log insert failed (non-fatal):', e);
  }

  try {
    const consentEvents = (insertedApplicants || [])
      .filter((row) => row.is_primary || row.screening_consent === true)
      .map((row) => ({
        application_id: applicationUuid,
        applicant_id: row.id,
        applicant_type: row.is_primary ? 'primary' : normalizeApplicantType(String(row.applicant_type || row.role || '')),
        consent_version: String(application.consent_version),
        consented_at: nowIso,
        ip: ip === 'unknown' ? null : ip,
        user_agent: ua || null,
      }));
    if (consentEvents.length > 0) {
      await supabase.from('application_screening_consent_events').insert(consentEvents);
    }
  } catch (e) {
    console.warn('application_screening_consent_events insert warning (non-fatal):', (e as Error).message);
  }

  const logEmail = async (
    type: string,
    recipient: string,
    status: string,
    provider: string,
    errorMsg: string | null = null,
  ) => {
    const { error } = await supabase.from('email_logs').insert({
      app_id: appId, type, recipient, status, provider, error_msg: errorMsg,
    });
    if (error) console.error('Email log insert failed:', error.message);
  };

  // ── Auto-mint & email separate screening / Method B completion links ──────
  // Method A members authorized directly by the primary applicant do NOT receive private consent links.
  let coConsentInviteSent = false;
  let pendingInviteCount = 0;
  const coConsentJobs: Promise<void>[] = [];
  const primaryFullName = `${firstName} ${lastName}`.trim();
  const propLabel = enforcedAddress || 'your chosen property';

  for (const row of (insertedApplicants || [])) {
    if (row.is_primary) continue;
    const subMethod = normalizeSubmissionMethod(row.submission_method);
    if (subMethod !== 'invited' && row.screening_consent === true) continue;
    pendingInviteCount += 1;
    const recipientEmail = String(row.email || '').trim().toLowerCase();
    if (!recipientEmail) continue;

    coConsentJobs.push((async () => {
      try {
        const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
        const rawToken = btoa(String.fromCharCode(...tokenBytes))
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
        const tokenHash = await sha256Hex(rawToken);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const { error: tokErr } = await supabase.from('co_applicant_consent_tokens').insert({
          application_id: applicationUuid,
          applicant_id: row.id,
          token_hash: tokenHash,
          recipient_email: recipientEmail,
          expires_at: expiresAt,
        });
        if (tokErr) {
          console.error('Co-applicant consent token insert failed:', tokErr.message);
          return;
        }

        const roleType = normalizeRoleType(row.applicant_type || row.role, false);
        const subMethod = normalizeSubmissionMethod(row.submission_method);
        const roleDisp = getRoleDisplayLabel(roleType, locale);
        const isInvited = subMethod === 'invited';
        const consentLink = `${getSiteUrl()}/co-applicant-consent.html#token=${rawToken}`;
        const memberPayUrl = (householdPaymentMode === 'individual' && !appliedCreditId)
          ? `${getSiteUrl()}/apply/pay.html?app_id=${encodeURIComponent(appId)}&applicant_id=${encodeURIComponent(String(row.id))}&token=${encodeURIComponent(rawToken)}`
          : undefined;
        const inviteSubject = locale === 'es'
          ? (isInvited
              ? `Acción requerida: complete sus datos y autorice evaluación (${appId})`
              : `Acción requerida: autorice su evaluación de alquiler (${appId})`)
          : (isInvited
              ? `Action required: complete your details & authorize screening (${appId})`
              : `Action required: authorize screening for Choice Properties (${appId})`);

        const res = await sendEmail({
          to: recipientEmail,
          subject: inviteSubject,
          html: coApplicantScreeningConsentHtml(
            String(row.first_name || 'Applicant'),
            appId,
            consentLink,
            {
              applicantType: roleType,
              roleLabel: roleDisp,
              submissionMethod: subMethod,
              primaryName: primaryFullName,
              propertyAddress: propLabel,
              locale,
              householdPaymentMode,
              individualFee: appliedCreditId ? 0 : perAdultFee,
              payUrl: memberPayUrl,
            },
          ),
        });
        await logEmail('co_applicant_consent_invitation', recipientEmail, res.ok ? 'sent' : 'failed', res.provider, res.ok ? null : (res.error || 'send failed'));
        if (res.ok) coConsentInviteSent = true;
      } catch (err) {
        console.error('Co-applicant consent invite error:', (err as Error).message);
      }
    })());
  }
  await Promise.all(coConsentJobs);

  // ── Notification emails ───────────────────────────────────────────────────
  const emailFields: Record<string, unknown> = {
    ...fields,
    'Preferred Language': locale,
    'Has Co-Applicant': coApplicants.length > 0 ? 'true' : 'false',
    'screened_adult_count': screenedAdultCount,
    'occupying_adult_count': financials.occupyingAdultCount,
    '_householdPaymentMode': householdPaymentMode,
    '_initialAmountDue': initialAmountDue,
    '_coApplicantsList': coApplicants.map(c => {
      const auth = isMemberAuthorizedByPrimary(c, termsConsent);
      return {
        first_name: c.first_name,
        last_name: c.last_name,
        email: c.email,
        role: c.role,
        role_label: getRoleDisplayLabel(c.applicant_type, locale),
        applicant_type: c.applicant_type,
        submission_method: c.submission_method,
        screening_consent: auth,
        authorized_by_primary: auth,
      };
    }),
    '_feeBreakdown': feeSummary.feeBreakdown,
    '_jurisdictionFeeNote': feeSummary.jurisdictionFeeNote,
    '_financials': financials,
    '_combinedMonthlyIncome': householdIncomeRounded,
    'Co-Applicant Consent Invite': coConsentInviteSent
      ? 'sent'
      : (pendingInviteCount > 0 ? 'failed/pending' : (coApplicants.length > 0 ? 'not_required_method_a' : 'n/a')),
  };

  const confSubject = locale === 'es'
    ? `Solicitud Recibida — ${propLabel.split(',')[0]} | Choice Properties (Ref: ${appId})`
    : `Application Received — ${propLabel.split(',')[0]} | Choice Properties (Ref: ${appId})`;

  const emailJobs = [
    sendEmail({
      to: email,
      subject: confSubject,
      html: applicationConfirmationHtml(firstName, propLabel, appId, emailFields as never, portalUrl, enforcedFee, coConsentInviteSent),
    }).then(result => logEmail('application_confirmation', email, result.ok ? 'sent' : 'failed', result.provider, result.ok ? null : (result.error || 'send failed')))
      .catch(async err => {
        console.error('Confirmation email error:', err);
        await logEmail('application_confirmation', email, 'failed', 'none', err?.message || 'unknown error');
      }),
    ...ADMIN_EMAILS.map(adminEmail =>
      sendEmail({
        to: adminEmail,
        subject: `New Application — ${appId} | ${firstName} ${lastName}${coApplicants.length ? ` (+${coApplicants.length})` : ''}`,
        html: adminNotificationHtml(firstName, lastName, email, propLabel, appId, emailFields as never, enforcedFee),
      }).then(result => logEmail('admin_notification', adminEmail, result.ok ? 'sent' : 'failed', result.provider, result.ok ? null : (result.error || 'send failed')))
        .catch(async err => {
          console.error('Admin notification error:', err);
          await logEmail('admin_notification', adminEmail, 'failed', 'none', err?.message || 'unknown error');
        })
    ),
    (async () => {
      try {
        const landlordInfo = await getLandlordForProperty(supabase, submittedPropertyId);
        if (landlordInfo?.email) {
          await sendEmail({
            to: landlordInfo.email,
            subject: `New Application — ${propLabel.split(',')[0]} (Ref: ${appId})`,
            html: landlordNewApplicationHtml(
              landlordInfo.contact_name || '',
              firstName, lastName, email, propLabel, appId,
              getAdminUrl('/admin/applications.html'),
            ),
          }).then(result => logEmail('landlord_new_application', landlordInfo.email, result.ok ? 'sent' : 'failed', result.provider, result.ok ? null : (result.error || 'send failed')))
            .catch(() => {});
        }
      } catch (_) {}
    })(),
  ];

  await Promise.all(emailJobs);

  const portalUploadToken = await createPortalUploadToken(appId, email);

  return jsonOk({
    success: true,
    appId,
    primary_applicant_id: applicantIdByIndex.get(0) || null,
    portal_upload_token: portalUploadToken,
    household_payment_mode: householdPaymentMode,
    portal_login_url: portalUrl,
    co_applicant_count: coApplicants.length,
    pending_consent_count: pendingInviteCount,
    co_applicant_consent: coApplicants.length > 0 ? allCoAuthorized : null,
    enforced_fee: enforcedFee,
    initial_amount_due: initialAmountDue,
    fee_breakdown: feeSummary.feeBreakdown,
    jurisdiction_fee_note: feeSummary.jurisdictionFeeNote,
    financials,
    credit_applied: !!appliedCreditId,
    message: locale === 'es' ? 'Solicitud recibida.' : 'Application received.',
  });
});
