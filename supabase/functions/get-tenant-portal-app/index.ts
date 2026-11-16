import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
import {
  calculateHouseholdApplicationFee,
  calculateHouseholdFinancials,
} from '../_shared/application-rules.ts';
import { createPortalUploadToken } from '../_shared/upload-token.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const FULL_APP_SELECT =
  'id,app_id,created_at,updated_at,status,payment_status,payment_date,application_fee,application_fee_per_adult,' +
  'household_payment_mode,additional_info_note,' +
  'primary_payment_method,primary_payment_method_other,alternative_payment_method,alternative_payment_method_other,' +
  'third_choice_payment_method,third_choice_payment_method_other,' +
  'application_payment_state,payment_provider,payment_transaction_ref,payment_card_brand,payment_card_last4,' +
  'payment_failure_code,payment_failure_reason,payment_attempts_count,payment_assistance_required,' +
  'payment_amount_recorded,payment_method_recorded,payment_notes,' +
  'holding_fee_requested,holding_fee_amount,holding_fee_due_date,holding_fee_paid,holding_fee_paid_at,' +
  'payment_confirmed_at,payment_amount_collected,payment_method_confirmed,' +
  'first_name,last_name,email,property_address,property_id,preferred_language,' +
  'lease_status,lease_sent_date,lease_signed_date,monthly_rent,monthly_income,other_income,' +
  'tenant_sign_token,has_co_applicant,co_applicant_count,combined_monthly_income,' +
  'household_monthly_income,guarantor_monthly_income,co_signer_monthly_income,total_financial_support,' +
  'occupying_adult_count,guarantor_count,co_signer_count,fee_breakdown,jurisdiction_fee_note,' +
  'last_contacted_at,credit_applied_id,admin_notes,move_in_status,move_in_date_actual,move_in_notes';

const LEGACY_APP_SELECT =
  'id,app_id,created_at,updated_at,status,payment_status,payment_date,application_fee,' +
  'primary_payment_method,primary_payment_method_other,alternative_payment_method,alternative_payment_method_other,' +
  'third_choice_payment_method,third_choice_payment_method_other,' +
  'payment_amount_recorded,payment_method_recorded,payment_notes,' +
  'holding_fee_requested,holding_fee_amount,holding_fee_due_date,holding_fee_paid,holding_fee_paid_at,' +
  'payment_confirmed_at,payment_amount_collected,payment_method_confirmed,' +
  'first_name,last_name,email,property_address,property_id,preferred_language,' +
  'lease_status,lease_sent_date,lease_signed_date,monthly_rent,monthly_income,other_income,' +
  'tenant_sign_token,has_co_applicant,co_applicant_count,combined_monthly_income,' +
  'last_contacted_at,credit_applied_id,admin_notes,move_in_status,move_in_date_actual,move_in_notes';

const FULL_APPLICANT_SELECT =
  'id,applicant_index,applicant_type,is_primary,role,submission_method,info_completed,info_completed_at,' +
  'housing_status,is_occupant,screening_fee_amount,screening_status,first_name,last_name,email,phone,' +
  'monthly_income,other_income,screening_consent,screening_consent_timestamp,lease_signature,lease_signed_at,' +
  'payment_status,application_payment_state,payment_amount,payment_transaction_ref,payment_provider,' +
  'payment_card_brand,payment_card_last4,payment_failure_code,payment_failure_reason,payment_attempts_count,' +
  'payment_assistance_required,payment_confirmed_at';

const LEGACY_APPLICANT_SELECT =
  'id,applicant_index,applicant_type,is_primary,role,first_name,last_name,email,phone,' +
  'monthly_income,other_income,screening_consent,screening_consent_timestamp,lease_signature,lease_signed_at';

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return jsonErr(405, 'POST required');

  let body: { app_id?: string };
  try { body = await req.json(); } catch { return jsonErr(400, 'Invalid JSON body'); }

  const rawAppId = (body.app_id || '').trim();
  if (!rawAppId) return jsonErr(400, 'Missing app_id');
  const escapedAppId = rawAppId.replace(/[\\%_]/g, (m) => `\\${m}`);

  // Pull application record using service role client (never select raw SSN columns)
  let { data: app, error: appErr } = await supabase
    .from('applications')
    .select(FULL_APP_SELECT)
    .eq('app_id', rawAppId)
    .maybeSingle();

  if (appErr && (appErr.code === 'PGRST204' || appErr.code === '42703' || /column/i.test(appErr.message || ''))) {
    const fb = await supabase.from('applications').select(LEGACY_APP_SELECT).eq('app_id', rawAppId).maybeSingle();
    app = fb.data;
    appErr = fb.error;
  }

  if (!app && !appErr) {
    let { data: ciApp, error: ciErr } = await supabase
      .from('applications')
      .select(FULL_APP_SELECT)
      .ilike('app_id', escapedAppId)
      .maybeSingle();
    if (ciErr && (ciErr.code === 'PGRST204' || ciErr.code === '42703' || /column/i.test(ciErr.message || ''))) {
      const fb = await supabase.from('applications').select(LEGACY_APP_SELECT).ilike('app_id', escapedAppId).maybeSingle();
      ciApp = fb.data;
      ciErr = fb.error;
    }
    app = ciApp;
    appErr = ciErr;
  }

  if (appErr || !app) {
    return jsonErr(404, 'Application not found');
  }

  const appId = String(app.app_id || rawAppId);

  // Pull property details & photos if available
  let property: Record<string, unknown> | null = null;
  if (app.property_id) {
    const { data: propData } = await supabase
      .from('properties')
      .select('id,address,city,state,zip,bedrooms,bathrooms,property_type,property_photos(url,display_order)')
      .eq('id', app.property_id)
      .maybeSingle();
    property = propData;
  }

  // Pull safe applicant rows (strictly excluding ssn_encrypted / ssn_hash)
  let { data: applicantsRaw, error: appsErr } = await supabase
    .from('application_applicants')
    .select(FULL_APPLICANT_SELECT)
    .eq('app_id', appId)
    .order('applicant_index', { ascending: true });

  if (appsErr && (appsErr.code === 'PGRST204' || appsErr.code === '42703' || /column/i.test(appsErr.message || ''))) {
    const fbApps = await supabase
      .from('application_applicants')
      .select(LEGACY_APPLICANT_SELECT)
      .eq('app_id', appId)
      .order('applicant_index', { ascending: true });
    applicantsRaw = fbApps.data;
  }

  const locale: 'en' | 'es' = String(app.preferred_language || '').toLowerCase().startsWith('es') ? 'es' : 'en';
  const normalizedApplicants = (applicantsRaw || []).length > 0
    ? applicantsRaw!
    : [{
        applicant_index: 0,
        is_primary: true,
        applicant_type: 'primary',
        role: 'Primary Applicant',
        first_name: app.first_name,
        last_name: app.last_name,
        email: app.email,
        monthly_income: app.monthly_income,
        other_income: app.other_income,
      }];

  const financials = calculateHouseholdFinancials(normalizedApplicants, app.monthly_rent);
  const feeSummary = calculateHouseholdApplicationFee(normalizedApplicants, {
    perPersonFee: Number(app.application_fee_per_adult) || 50,
    creditApplied: Boolean(app.credit_applied_id),
    stateCode: String(property?.state || ''),
    locale,
  });

  const enrichedApp = {
    ...app,
    household_monthly_income: app.household_monthly_income ?? financials.householdMonthlyIncome,
    guarantor_monthly_income: app.guarantor_monthly_income ?? financials.guarantorMonthlyIncome,
    co_signer_monthly_income: app.co_signer_monthly_income ?? financials.coSignerMonthlyIncome,
    total_financial_support: app.total_financial_support ?? financials.totalFinancialSupport,
    occupying_adult_count: app.occupying_adult_count ?? financials.occupyingAdultCount,
    guarantor_count: app.guarantor_count ?? financials.guarantorCount,
    co_signer_count: app.co_signer_count ?? financials.coSignerCount,
    fee_breakdown: Array.isArray(app.fee_breakdown) && app.fee_breakdown.length > 0 ? app.fee_breakdown : feeSummary.feeBreakdown,
    jurisdiction_fee_note: app.jurisdiction_fee_note ?? feeSummary.jurisdictionFeeNote,
  };

  // Pull uploaded documents for this application using real schema column original_file_name
  const { data: docsRaw } = await supabase
    .from('application_documents')
    .select('id,doc_type,status,review_status,original_file_name,mime_type,storage_path,applicant_id,uploaded_by_email,metadata,created_at')
    .eq('app_id', appId)
    .order('created_at', { ascending: false });

  const docs = (docsRaw || []).map((d: Record<string, unknown>) => ({
    ...d,
    file_name: d.original_file_name,
  }));

  // Pull payment receipts issued for this application
  const { data: receipts } = await supabase
    .from('payment_receipts')
    .select('id,applicant_id,receipt_type,receipt_number,amount,currency,payment_method,transaction_ref,paid_at,issued_at,status,fee_breakdown')
    .eq('app_id', appId)
    .eq('status', 'issued')
    .order('issued_at', { ascending: false });

  // Pull masked payment attempt history (never stores raw card PAN/CVV)
  const { data: transactions } = await supabase
    .from('application_payment_transactions')
    .select('id,applicant_id,payer_name,transaction_ref,provider,state,amount,currency,card_brand,card_last4,failure_code,failure_reason,attempt_number,created_at')
    .eq('app_id', appId)
    .order('created_at', { ascending: false })
    .limit(20);

  // Pull active application credits for this applicant email
  let credits: Array<Record<string, unknown>> = [];
  if (app.email) {
    const { data: creditRows } = await supabase
      .from('application_credits')
      .select('id,original_app_id,total_credits,remaining_credits,issued_at,expires_at,status')
      .ilike('email', String(app.email).trim())
      .eq('status', 'active')
      .gt('remaining_credits', 0)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true });
    credits = creditRows || [];
  }

  const portalUploadToken = await createPortalUploadToken(appId, String(app.email || ''));

  return jsonOk({
    success: true,
    app: enrichedApp,
    property,
    applicants: applicantsRaw || [],
    docs,
    receipts: receipts || [],
    transactions: transactions || [],
    credits,
    portal_upload_token: portalUploadToken,
  });
});
