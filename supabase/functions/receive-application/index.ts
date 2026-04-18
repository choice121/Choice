import { createClient } from 'npm:@supabase/supabase-js@2';
  import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
  import { sendEmail, applicationConfirmationHtml, adminNotificationHtml } from '../_shared/email.ts';

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const ADMIN_EMAILS = ['choicepropertyofficial1@gmail.com', 'choicepropertygroup@hotmail.com'];

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

    const email = fv(fields['Email']);
    const firstName = fv(fields['First Name']);
    const lastName = fv(fields['Last Name']);

    if (!email || !email.includes('@')) return jsonErr(400, 'Valid email is required');
    if (!firstName) return jsonErr(400, 'First name is required');

    const appId = generateAppId();

    const application: Record<string, unknown> = {
      app_id: appId,
      status: 'pending',
      payment_status: fPaymentStatus(fields['Payment Status']),
      first_name: firstName,
      last_name: lastName,
      email,
      phone: fv(fields['Phone']) || null,
      dob: fv(fields['DOB']) || null,
      ssn: fv(fields['SSN']) || null,
      property_address: fv(fields['Property Address']) || null,
      property_id: fv(fields['Property ID']) || null,
      requested_move_in_date: fv(fields['Requested Move-in Date']) || null,
      desired_lease_term: fv(fields['Desired Lease Term']) || null,
      current_address: fv(fields['Current Address']) || null,
      residency_duration: fv(fields['Residency Duration']) || null,
      current_rent_amount: fv(fields['Current Rent Amount']) || null,
      reason_for_leaving: fv(fields['Reason for leaving']) || null,
      current_landlord_name: fv(fields['Current Landlord Name']) || null,
      landlord_phone: fv(fields['Landlord Phone']) || null,
      employment_status: fv(fields['Employment Status']) || null,
      employer: fv(fields['Employer']) || null,
      job_title: fv(fields['Job Title']) || null,
      employment_duration: fv(fields['Employment Duration']) || null,
      supervisor_name: fv(fields['Supervisor Name']) || null,
      supervisor_phone: fv(fields['Supervisor Phone']) || null,
      monthly_income: fv(fields['Monthly Income']) || null,
      other_income: fv(fields['Other Income']) || null,
      reference_1_name: fv(fields['Reference 1 Name']) || null,
      reference_1_phone: fv(fields['Reference 1 Phone']) || null,
      reference_2_name: fv(fields['Reference 2 Name']) || null,
      reference_2_phone: fv(fields['Reference 2 Phone']) || null,
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
      application_fee: fNum(fields['Application Fee']),
      monthly_rent: fNum(fields['Listed Rent']),
      security_deposit: fNum(fields['Security Deposit']),
      lease_status: 'none',
      move_in_status: 'pending',
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

    sendEmail({
      to: email,
      subject: `✓ Application Received – ${prop.split(',')[0]} | Choice Properties (Ref: ${appId})`,
      html: applicationConfirmationHtml(firstName, prop, appId),
    }).catch(err => console.error('Confirmation email error:', err));

    for (const adminEmail of ADMIN_EMAILS) {
      sendEmail({
        to: adminEmail,
        subject: `New Application: ${appId} – ${firstName} ${lastName} | ${prop}`,
        html: adminNotificationHtml(firstName, lastName, email, prop, appId),
      }).catch(err => console.error('Admin notification error:', err));
    }

    return jsonOk({ success: true, appId, message: 'Application received.' });
  });
  