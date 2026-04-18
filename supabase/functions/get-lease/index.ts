import { createClient } from 'npm:@supabase/supabase-js@2';
  import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
  import { substituteVars } from '../_shared/pdf.ts';

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  Deno.serve(async (req: Request) => {
    const cors = handleCors(req);
    if (cors) return cors;

    let token: string | null = null;

    if (req.method === 'POST') {
      try { const b = await req.json(); token = b.token; } catch { return jsonErr(400, 'Invalid JSON'); }
    } else {
      token = new URL(req.url).searchParams.get('token');
    }

    if (!token) return jsonErr(400, 'Missing token');

    const { data: app, error } = await supabase
      .from('applications')
      .select(
        'app_id,first_name,last_name,email,phone,property_address,' +
        'lease_start_date,lease_end_date,monthly_rent,security_deposit,move_in_costs,' +
        'lease_notes,lease_status,lease_pdf_url,tenant_sign_token,' +
        'lease_landlord_name,lease_landlord_address,lease_late_fee_flat,lease_late_fee_daily,' +
        'lease_state_code,lease_pets_policy,lease_smoking_policy,desired_lease_term,' +
        'signature_timestamp,tenant_signature,has_co_applicant'
      )
      .eq('tenant_sign_token', token)
      .single();

    if (error || !app) return jsonErr(404, 'Lease not found or signing link has expired.');
    if (app.signature_timestamp || app.lease_status === 'signed' || app.lease_status === 'co_signed') {
      return jsonErr(410, 'This lease has already been signed.');
    }

    const { data: tmpl } = await supabase
      .from('lease_templates').select('template_body').eq('is_active', true).single();

    const rendered = tmpl?.template_body ? substituteVars(tmpl.template_body, app) : '';

    return jsonOk({ app, rendered_lease: rendered });
  });
  