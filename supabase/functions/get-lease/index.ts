import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
import { substituteVars } from '../_shared/pdf.ts';
import { resolveLeaseTemplate } from '../_shared/lease-render.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Phase 3 — handles BOTH tenant_sign_token and co_applicant_lease_token.
// Resolves which signer the token belongs to, returns the snapshotted
// template body (Phase 2 versioning), and surfaces signer_type so the
// page can render "Sign as primary applicant" vs "Sign as co-applicant".
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

  // 1. Identify the signer via the DB function (handles either token type)
  const { data: lookupRaw, error: lookupErr } = await supabase
    .rpc('lookup_signer_for_token', { p_token: token });
  if (lookupErr) return jsonErr(500, 'Lookup failed: ' + lookupErr.message);
  const lookup = lookupRaw as {
    success: boolean; error?: string;
    app_id?: string; signer_type?: 'tenant'|'co_applicant';
    signer_email?: string; signer_name?: string;
    lease_status?: string; already_signed?: boolean;
  };
  if (!lookup?.success) return jsonErr(404, lookup?.error || 'Lease not found or signing link has expired.');

  if (lookup.already_signed) {
    return jsonErr(410, lookup.signer_type === 'co_applicant'
      ? 'Your signature on this lease has already been recorded.'
      : 'This lease has already been signed.');
  }
  if (lookup.lease_status === 'voided')  return jsonErr(410, 'This lease has been voided.');
  if (lookup.lease_status === 'expired') return jsonErr(410, 'This signing link has expired.');

  // 2. Pull the application details for rendering
  const { data: app, error } = await supabase
    .from('applications')
    .select(
      'app_id,first_name,last_name,email,phone,property_address,' +
      'lease_start_date,lease_end_date,monthly_rent,security_deposit,move_in_costs,' +
      'lease_notes,lease_status,lease_pdf_url,' +
      'lease_landlord_name,lease_landlord_address,lease_late_fee_flat,lease_late_fee_daily,' +
      'lease_state_code,lease_pets_policy,lease_smoking_policy,desired_lease_term,' +
      'signature_timestamp,tenant_signature,co_applicant_signature,has_co_applicant,' +
      'lease_template_version_id'
    )
    .eq('app_id', lookup.app_id)
    .single();
  if (error || !app) return jsonErr(404, 'Lease not found.');

  // 3. For co-applicants, also fetch their record so the page can pre-fill
  //    the expected name/email and the email-verification step targets the
  //    co-applicant's email instead of the primary's.
  let signer = {
    type:  lookup.signer_type!,
    email: lookup.signer_email || '',
    name:  lookup.signer_name  || '',
  };
  if (lookup.signer_type === 'co_applicant') {
    const { data: co } = await supabase
      .from('co_applicants').select('first_name, last_name, email')
      .eq('app_id', app.app_id).maybeSingle();
    if (co) {
      signer = {
        type:  'co_applicant',
        email: co.email || signer.email,
        name:  `${co.first_name || ''} ${co.last_name || ''}`.trim() || signer.name,
      };
    }
  }

  // 4. Render template — snapshot pinned to this app wins (Phase 2)
  const tmpl = await resolveLeaseTemplate(supabase, app);
  const rendered = tmpl ? substituteVars(tmpl.template_body, app) : '';

  return jsonOk({
    app,
    signer,
    rendered_lease:        rendered,
    template_version_id:   tmpl?.version_id    || null,
    template_version_number: tmpl?.version_number || null,
    template_source:       tmpl?.source        || 'none',
  });
});
