import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/send-email.ts';
import { applicationConfirmationHtml, adminNotificationHtml } from '../_shared/email.ts';
import { getAdminEmails, getTenantLoginUrl } from '../_shared/config.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const ADMIN_EMAILS = getAdminEmails();

function generateAppId(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `CP-${y}${m}${d}-${random}${ms}`;
}

function fv(val: FormDataEntryValue | string | null | undefined): string {
  if (!val) return '';
  return String(val).trim();
}

function fBool(val: FormDataEntryValue | string | null | undefined): boolean | null {
  const s = fv(val).toLowerCase();
  if (['true', 'yes', '1', 'on'].includes(s)) return true;
  if (['false', 'no', '0', 'none'].includes(s)) return false;
  return null;
}

function fNum(val: FormDataEntryValue | string | null | undefined): number | null {
  const n = parseFloat(fv(val).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? null : n;
}

const VALID_PAYMENT_STATUSES = new Set(['unpaid', 'paid', 'waived', 'refunded']);

function fPaymentStatus(val: FormDataEntryValue | string | null | undefined): string {
  const status = fv(val).toLowerCase();
  return VALID_PAYMENT_STATUSES.has(status) ? status : 'unpaid';
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

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

  // Honeypot check
  if (fields['_trap']) {
    return jsonOk({ success: true, message: 'Application received.', appId: 'HP-' + Date.now() });
  }

  const email = fv(fields['Email']).toLowerCase();
  const firstName = fv(fields['First Name']);
  const lastName = fv(fields['Last Name']);

  if (!email || !email.includes('@')) return jsonErr(400, 'Valid email is required');
  if (!firstName) return jsonErr(400, 'First name is required');

  // ── Property policy enforcement ─────────────────────────────────────────────
  const submittedPropertyId = fv(fields['Property ID']) || null;
  let enforcedFee: number | null = fNum(fields['Application Fee']);

  if (submittedPropertyId) {
    const { data: prop, error: propErr } = await supabase
      .from('properties')
      .select('application_fee, pets_allowed, smoking_allowed')
      .eq('id', submittedPropertyId)
      .maybeSingle();

    if (!propErr && prop) {
      enforcedFee = typeof prop.application_fee === 'number' ? prop.application_fee : null;

      const hasPetsSubmitted = fBool(fields['Has Pets']);
      if (hasPetsSubmitted === true && prop.pets_allowed === false) {
        return jsonErr(422, 'This property does not allow pets. Please contact us if you have questions.');
      }

      const smokerSubmitted = fBool(fields['Smoker']);
      if (smokerSubmitted === true && prop.smoking_allowed === false) {
        return jsonErr(422, 'This is a non-smoking property. Please contact us if you have questions.');
      }
    } else if (propErr) {
      console.warn('Property lookup error (non-fatal):', JSON.stringify(propErr));
    }
  }

  const appId = generateAppId();
  // Link to login page (not portal directly) so the applicant is authenticated
  // with the correct email before reaching the dashboard, preventing the
  // "email does not match" error when another account is already signed in.
  const portalUrl = getTenantLoginUrl(appId, email);

  const application: Record<string, unknown> = {
    app_id: appId,
    status: 'pending',
    first_name: firstName,
    last_name: lastName,
    email,
    phone: fv(fields['Phone']) || null,
    dob: fv(fields['DOB']) || null,
    ssn: (() => { const raw = fv(fields['SSN']); if (!raw) return null; const d = raw.replace(/\D/g, ''); return d.length >= 4 ? 'XXX-XX-' + d.slice(-4) : '****'; })() || null,
    property_address: fv(fields['Property Address']) || null,
    property_id: submittedPropertyId,
    requested_move_in_date: fv(fields['Requested Move-in Date']) || null,
    desired_lease_term: fv(fields['Desired Lease Term']) || null,
    current_address: fv(fields['Current Address']) || null,
    residency_duration: fv(fields['Residency Duration']) || null,
    current_rent_amount: fv(fields['Current Rent Amount']) || null,
    reason_for_leaving: fv(fields['Reason for leaving']) || null,
    current_landlord_name: fv(fields['Current Landlord Name']) || null,
    landlord_phone: fv(fields['Landlord Phone']) || null,
    previous_address: fv(fields['Previous Address']) || null,
    previous_residency_duration: fv(fields['Previous Residency Duration']) || null,
    previous_landlord_name: fv(fields['Previous Landlord Name']) || null,
    previous_landlord_phone: fv(fields['Previous Landlord Phone']) || null,
    employment_status: fv(fields['Employment Status']) || null,
    employer: fv(fields['Employer']) || null,
    employer_address: fv(fields['Employer Address']) || null,
    job_title: fv(fields['Job Title']) || null,
    employment_start_date: fv(fields['Employment Start Date']) || null,
    employment_duration: fv(fields['Employment Duration']) || null,
    supervisor_name: fv(fields['Supervisor Name']) || null,
    supervisor_phone: fv(fields['Supervisor Phone']) || null,
    monthly_income: fv(fields['Monthly Income']) || null,
    other_income: fv(fields['Other Income']) || null,
    reference_1_name: fv(fields['Reference 1 Name']) || null,
    reference_1_phone: fv(fields['Reference 1 Phone']) || null,
    reference_1_relationship: fv(fields['Reference 1 Relationship']) || null,
    reference_2_name: fv(fields['Reference 2 Name']) || null,
    reference_2_phone: fv(fields['Reference 2 Phone']) || null,
    reference_2_relationship: fv(fields['Reference 2 Relationship']) || null,
    emergency_contact_name: fv(fields['Emergency Contact Name']) || null,
    emergency_contact_phone: fv(fields['Emergency Contact Phone']) || null,
    emergency_contact_relationship: fv(fields['Emergency Contact Relationship']) || null,
    primary_payment_method: fv(fields['Primary Payment Method']) || null,
    primary_payment_method_other: fv(fields['Primary Payment Method Other']) || null,
    alternative_payment_method: fv(fields['Alternative Payment Method']) || null,
    alternative_payment_method_other: fv(fields['Alternative Payment Method Other']) || null,
    third_choice_payment_method: fv(fields['Third Choice Payment Method']) || null,
    third_choice_payment_method_other: fv(fields['Third Choice Payment Method Other']) || null,
    has_pets: fBool(fields['Has Pets']),
    pet_details: fv(fields['Pet Details']) || null,
    total_occupants: fNum(fields['Total Occupants']),
    additional_occupants: fv(fields['Additional Occupants']) || null,
    ever_evicted: fBool(fields['Ever Evicted']),
    smoker: fBool(fields['Smoker']),
    preferred_contact_method: fv(fields['Preferred Contact Method']) || null,
    preferred_time: fv(fields['Preferred Time']) || null,
    preferred_time_specific: fv(fields['Preferred Time Specific']) || null,
    vehicle_make: fv(fields['Vehicle Make']) || null,
    vehicle_model: fv(fields['Vehicle Model']) || null,
    vehicle_year: fv(fields['Vehicle Year']) || null,
    vehicle_license_plate: fv(fields['Vehicle License Plate']) || null,
    has_co_applicant: fBool(fields['Has Co-Applicant']),
    co_applicant_first_name: fv(fields['Co-Applicant First Name']) || null,
    co_applicant_last_name: fv(fields['Co-Applicant Last Name']) || null,
    co_applicant_email: fv(fields['Co-Applicant Email']) || null,
    co_applicant_phone: fv(fields['Co-Applicant Phone']) || null,
    application_fee: enforcedFee,
    monthly_rent: fNum(fields['Listed Rent']),
    security_deposit: fNum(fields['Security Deposit']),
    lease_status: 'none',
    move_in_status: 'pending',
    payment_status: fPaymentStatus(null),
    terms_consent: fv(fields['Terms Consent']) === 'yes' || fBool(fields['Terms Consent']) || fBool(fields['agreeTermsPrivacy']),
    sms_consent: fv(fields['SMS Consent']) === 'yes' || fBool(fields['SMS Consent']) || fBool(fields['smsConsent']),
    consent_timestamp: fv(fields['Consent Timestamp']) || new Date().toISOString(),
    consent_version: fv(fields['Consent Version']) || '2.0',
  };

  const cleanApp = Object.fromEntries(
    Object.entries(application).filter(([, val]) => val !== null && val !== undefined && val !== '')
  );

  const { error: insertErr } = await supabase.from('applications').insert(cleanApp);
  if (insertErr) {
    console.error('Insert error:', JSON.stringify(insertErr));
    return jsonErr(500, 'Failed to save application');
  }

  const prop = fv(fields['Property Address']) || 'your chosen property';

  const logEmail = async (type: string, recipient: string, status: string, provider: string) => {
    const { error } = await supabase.from('email_logs').insert({
      app_id: appId, type, recipient, status, provider,
    });
    if (error) console.error('Email log insert failed:', error.message);
  };

  const emailJobs = [
    sendEmail({
      to: email,
      subject: `Application Received — ${prop.split(',')[0]} | Choice Properties (Ref: ${appId})`,
      html: applicationConfirmationHtml(firstName, prop, appId, fields, portalUrl),
    }).then(result => logEmail('application_confirmation', email, result.ok ? 'sent' : 'failed', result.provider))
      .catch(async err => {
        console.error('Confirmation email error:', err);
        await logEmail('application_confirmation', email, 'failed', 'none');
      }),
    ...ADMIN_EMAILS.map(adminEmail =>
      sendEmail({
        to: adminEmail,
        subject: `New Application — ${appId} | ${firstName} ${lastName}`,
        html: adminNotificationHtml(firstName, lastName, email, prop, appId, fields),
      }).then(result => logEmail('admin_notification', adminEmail, result.ok ? 'sent' : 'failed', result.provider))
        .catch(async err => {
          console.error('Admin notification error:', err);
          await logEmail('admin_notification', adminEmail, 'failed', 'none');
        })
    ),
  ];

  await Promise.all(emailJobs);

  return jsonOk({ success: true, appId, message: 'Application received.' });
});
