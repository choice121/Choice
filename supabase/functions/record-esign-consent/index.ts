/**
 * record-esign-consent -- Phase 05
 *
 * Public endpoint called by the lease/amendment signing UI after the user
 * checks all three E-SIGN disclosure boxes (hardware/software, paper-copy
 * right, withdrawal right).  Stores a row in esign_consents keyed by
 * (app_id, signer_email, disclosure_version) so subsequent calls to
 * /get-lease and /sign-lease* see consent_required=false for this signer.
 *
 * Identity is verified the same way as /sign-lease: the caller must pass
 * a valid signing token AND the email that matches it.  This is the
 * weakest form of identity verification we can do without forcing a
 * separate auth step, but it is the same standard the rest of the
 * signing flow already uses.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
import { isDbRateLimited }             from '../_shared/rate-limit.ts';
import { ESIGN_DISCLOSURE_VERSION }    from '../_shared/esign-consent.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  let body: {
    token:                          string;
    signer_email:                   string;
    hardware_software_acknowledged: boolean;
    paper_copy_right_acknowledged:  boolean;
    withdrawal_right_acknowledged:  boolean;
    user_agent?:                    string;
    disclosure_version?:            string;
  };
  try { body = await req.json(); } catch { return jsonErr(400, 'Invalid JSON body'); }

  const { token, signer_email, hardware_software_acknowledged,
          paper_copy_right_acknowledged, withdrawal_right_acknowledged,
          user_agent } = body;

  if (!token)        return jsonErr(400, 'Missing token');
  if (!signer_email) return jsonErr(400, 'Missing signer email');
  if (!hardware_software_acknowledged
   || !paper_copy_right_acknowledged
   || !withdrawal_right_acknowledged) {
    return jsonErr(400, 'All three E-SIGN disclosures must be acknowledged before consent can be recorded.');
  }

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';
  if (await isDbRateLimited(ip, 'record-esign-consent', 30, 60 * 60 * 1000)) {
    return jsonErr(429, 'Too many consent attempts from this network. Please wait an hour and try again.');
  }

  // 1. Resolve token -> (app_id, signer_role, signer_email_on_file)
  const { data: lookup, error: lookupErr } = await supabase
    .rpc('lookup_signer_for_token', { p_token: token });
  if (lookupErr) return jsonErr(500, 'Lookup failed: ' + lookupErr.message);
  const L = lookup as {
    success: boolean; error?: string;
    app_id?: string; signer_type?: string;
    signer_email?: string;
  };

  let appId:    string | undefined = L?.app_id;
  let role:     'tenant'|'co_applicant'|'amendment' | undefined =
    (L?.signer_type as 'tenant'|'co_applicant'|undefined);
  let onFile:   string | undefined = L?.signer_email;

  // If lookup_signer_for_token didn't recognize this token (it only knows
  // about tenant/co-applicant tokens on `applications`), try amendment.
  if (!L?.success) {
    const { data: amend } = await supabase
      .from('lease_amendments')
      .select('app_id')
      .eq('signing_token', token)
      .maybeSingle();
    if (amend) {
      const { data: app } = await supabase
        .from('applications')
        .select('email')
        .eq('app_id', amend.app_id)
        .single();
      if (app) {
        appId  = amend.app_id;
        role   = 'amendment';
        onFile = app.email || '';
      }
    }
    if (!appId) {
      return jsonErr(404, L?.error || 'Signing link not recognized.');
    }
  }

  // 2. Verify the email matches the signer on file
  if (!onFile || signer_email.trim().toLowerCase() !== onFile.toLowerCase()) {
    return jsonErr(403, 'The email you entered does not match our records.');
  }

  if (!role) {
    return jsonErr(500, 'Could not resolve signer role for this token.');
  }

  // 3. Insert consent row
  const version = body.disclosure_version || ESIGN_DISCLOSURE_VERSION;
  const { error: insErr } = await supabase
    .from('esign_consents')
    .insert({
      app_id:                          appId,
      signer_email:                    signer_email.trim(),
      signer_role:                     role,
      disclosure_version:              version,
      ip_address:                      ip === 'unknown' ? null : ip,
      user_agent:                      user_agent || null,
      hardware_software_acknowledged:  true,
      paper_copy_right_acknowledged:   true,
      withdrawal_right_acknowledged:   true,
      consent_given:                   true,
      consented_at:                    new Date().toISOString(),
    });
  if (insErr) return jsonErr(500, 'Failed to record consent: ' + insErr.message);

  // 4. Audit
  try {
    await supabase.from('admin_actions').insert({
      action:      'esign_consent_recorded',
      target_type: 'application',
      target_id:   appId,
      metadata:    {
        app_id:               appId,
        actor:                signer_email,
        signer_role:          role,
        disclosure_version:   version,
      },
    });
  } catch (_) { /* non-fatal */ }

  return jsonOk({
    success: true,
    app_id:  appId,
    disclosure_version: version,
  });
});
