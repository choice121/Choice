/**
 * get-amendment -- Phase 4 + Phase 05
 * Public endpoint that returns an amendment + its parent application
 * details for a given signing token.  Phase 05 adds E-SIGN consent gating
 * and surfaces token-expiry/revocation status from the signing-token registry.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
import { renderTemplate, createSupabasePartialResolver } from '../_shared/template-engine.ts';
import { buildLeaseRenderContext } from '../_shared/lease-context.ts';
import { ESIGN_DISCLOSURE, ESIGN_DISCLOSURE_VERSION } from '../_shared/esign-consent.ts';

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

  // Phase 05 -- check registry for expiry/revoked
  const { data: tokenMeta } = await supabase
    .from('lease_signing_tokens')
    .select('expires_at, revoked_at, used_at, revoke_reason, signer_role')
    .eq('token', token)
    .maybeSingle();

  if (tokenMeta) {
    if (tokenMeta.revoked_at) {
      return jsonErr(410, tokenMeta.revoke_reason
        ? 'Amendment link revoked: ' + tokenMeta.revoke_reason
        : 'Amendment link has been revoked.');
    }
    if (tokenMeta.expires_at && new Date(tokenMeta.expires_at) < new Date()) {
      return jsonErr(410, 'Amendment link expired on '
        + new Date(tokenMeta.expires_at).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' })
        + '. Please contact us for a fresh link.');
    }
    if (tokenMeta.used_at) {
      return jsonErr(410, 'This amendment link has already been used.');
    }
  }

  const { data: amend, error: aErr } = await supabase
    .from('lease_amendments')
    .select('id, app_id, kind, title, body, status, tenant_signature, created_at')
    .eq('signing_token', token).maybeSingle();

  if (aErr) return jsonErr(500, 'Lookup failed: ' + aErr.message);
  if (!amend) return jsonErr(404, 'This amendment signing link is invalid or has expired.');
  if (amend.tenant_signature) return jsonErr(410, 'This amendment has already been signed.');
  if (amend.status === 'voided') return jsonErr(410, 'This amendment has been voided.');

  const { data: app } = await supabase
    .from('applications')
    .select('app_id, first_name, last_name, email, property_address, lease_start_date, lease_end_date, monthly_rent, security_deposit')
    .eq('app_id', amend.app_id).single();

  if (!app) return jsonErr(404, 'Parent lease not found.');

  const renderedBody = await renderTemplate(
    amend.body,
    buildLeaseRenderContext(app),
    { partials: createSupabasePartialResolver(supabase) },
  );

  // Phase 05 -- E-SIGN consent gating for amendment signers
  const { data: hasConsent } = await supabase.rpc('has_recent_esign_consent', {
    p_app_id:  app.app_id,
    p_email:   app.email || '',
    p_version: ESIGN_DISCLOSURE_VERSION,
  });
  const consentRequired = !hasConsent;

  return jsonOk({
    amendment: {
      id:    amend.id,
      kind:  amend.kind,
      title: amend.title,
      body:  renderedBody,
    },
    app,
    signer: {
      type:  'tenant',
      email: app.email || '',
      name:  `${app.first_name || ''} ${app.last_name || ''}`.trim(),
    },
    consent_required:       consentRequired,
    esign_disclosure:       consentRequired ? ESIGN_DISCLOSURE : null,
    esign_disclosure_version: ESIGN_DISCLOSURE_VERSION,
  });
});
