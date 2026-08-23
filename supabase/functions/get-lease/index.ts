import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
import { renderTemplate, createSupabasePartialResolver } from '../_shared/template-engine.ts';
import { buildLeaseRenderContext } from '../_shared/lease-context.ts';
import { resolveLeaseTemplate } from '../_shared/lease-render.ts';
import { fetchAttachedAddenda } from '../_shared/lease-addenda.ts';
import { ESIGN_DISCLOSURE, ESIGN_DISCLOSURE_VERSION } from '../_shared/esign-consent.ts';
import { resolveLease } from '../_shared/lease-resolve.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Phase 3 -- handles BOTH tenant_sign_token and co_applicant_lease_token.
// Phase 04 -- also returns the per-application addenda snapshots.
// Phase 05 -- also returns whether the signer needs to record E-SIGN consent
// before viewing the lease body.  When `consent_required` is true, the
// frontend gates the lease text behind the disclosure step and only
// reveals it after the user POSTs to /record-esign-consent.
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

  // 1. Identify the signer via the DB function
  const { data: lookupRaw, error: lookupErr } = await supabase
    .rpc('lookup_signer_for_token', { p_token: token });
  if (lookupErr) return jsonErr(500, 'Lookup failed: ' + lookupErr.message);
  const lookup = lookupRaw as {
    success: boolean; error?: string;
    app_id?: string; signer_type?: 'tenant'|'co_applicant';
    signer_email?: string; signer_name?: string;
    lease_status?: string; already_signed?: boolean;
    expires_at?: string | null;
  };
  if (!lookup?.success) {
    // Phase 05 -- lookup_signer_for_token returns expired/revoked errors
    // surface them as 410 (Gone) so the UI shows the right state.
    const msg = lookup?.error || 'Lease not found or signing link has expired.';
    const status = /expired|revoked/i.test(msg) ? 410 : 404;
    return jsonErr(status, msg);
  }

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

  // 3. For co-applicants, also fetch their record
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

  // 4. Render template
  // Phase 10: prefer the leases-table snapshot (immutable per lease) if a
  // lease row exists for this app. Falls back to the application columns
  // for unbackfilled apps. resolveLease() returns null silently for those.
  const leaseResolved = await resolveLease(supabase, { app_id: app.app_id });
  const renderSource = leaseResolved.ok ? { ...app, ...leaseResolved.lease } : app;
  const tmpl = await resolveLeaseTemplate(supabase, renderSource);
  const rendered = tmpl
    ? await renderTemplate(
        tmpl.template_body,
        buildLeaseRenderContext(renderSource),
        { partials: createSupabasePartialResolver(supabase) },
      )
    : '';

  // 5. Phase 04 -- load attached addenda for the signing UI
  const addenda = await fetchAttachedAddenda(supabase, app.app_id);

  // 6. Phase 05 -- determine whether E-SIGN consent must be re-collected.
  // We require a fresh consent at the current disclosure version on file
  // for THIS signer (signer.email), within the last 30 days.  If absent,
  // consent_required=true and the frontend hides the lease body.
  const { data: hasConsent } = await supabase.rpc('has_recent_esign_consent', {
    p_app_id:  app.app_id,
    p_email:   signer.email,
    p_version: ESIGN_DISCLOSURE_VERSION,
  });
  const consentRequired = !hasConsent;

  return jsonOk({
    app,
    // Phase 10: surface the lease_id alongside the legacy app payload so
    // the signing UI can pass it back to sign-lease / sign-amendment.
    lease_id:                leaseResolved.ok ? leaseResolved.lease.id : null,
    lease_status:            leaseResolved.ok ? leaseResolved.lease.lease_status : null,
    signer,
    rendered_lease:          rendered,
    template_version_id:     tmpl?.version_id    || null,
    template_version_number: tmpl?.version_number || null,
    template_source:         tmpl?.source        || 'none',
    addenda: addenda.map(a => ({
      slug:               a.slug,
      title:              a.title,
      jurisdiction:       a.jurisdiction,
      citation:           a.citation,
      body:               a.rendered_body,
      signature_required: a.signature_required,
      initials_required:  a.initials_required,
    })),
    // Phase 05 -- consent gating
    consent_required:       consentRequired,
    esign_disclosure:       consentRequired ? ESIGN_DISCLOSURE : null,
    esign_disclosure_version: ESIGN_DISCLOSURE_VERSION,
  });
});
