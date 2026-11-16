import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, handleCors } from '../_shared/cors.ts';
import { decryptSsn } from '../_shared/ssn-crypto.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

function jsonNoStore(req: Request, status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(req.headers.get('origin')),
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return jsonNoStore(req, 405, { error: 'Method not allowed' });

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return jsonNoStore(req, 401, { error: 'Administrator sign-in is required.' });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return jsonNoStore(req, 401, { error: 'Invalid or expired administrator token.' });

  const { data: role } = await supabase
    .from('admin_roles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!role) return jsonNoStore(req, 403, { error: 'Administrator access required.' });

  let body: { applicant_id?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return jsonNoStore(req, 400, { error: 'Invalid JSON body.' });
  }

  const applicantId = String(body.applicant_id || '').trim();
  const reason = String(body.reason || '').trim();
  if (!UUID_RE.test(applicantId)) {
    return jsonNoStore(req, 400, { error: 'Valid applicant_id UUID is required.' });
  }
  if (reason.length < 3) {
    return jsonNoStore(req, 400, { error: 'A brief audit reason (at least 3 characters) is required to reveal an SSN.' });
  }

  const { data: applicant, error: fetchErr } = await supabase
    .from('application_applicants')
    .select('id, app_id, applicant_index, is_primary, first_name, last_name, ssn_encrypted, ssn_last4')
    .eq('id', applicantId)
    .maybeSingle();

  if (fetchErr || !applicant) {
    return jsonNoStore(req, 404, { error: 'Applicant record not found.' });
  }

  if (!applicant.ssn_encrypted) {
    return jsonNoStore(req, 200, {
      success: true,
      applicant_id: applicant.id,
      app_id: applicant.app_id,
      encrypted_available: false,
      ssn: applicant.ssn_last4 ? `XXX-XX-${applicant.ssn_last4}` : null,
      last4: applicant.ssn_last4 || null,
      note: 'Legacy submission — only the last 4 digits were collected at submission time.',
    });
  }

  let plainSsn: string;
  try {
    plainSsn = await decryptSsn(applicant.ssn_encrypted);
  } catch (err) {
    console.error('SSN decrypt failure for applicant', applicantId, (err as Error).message);
    return jsonNoStore(req, 500, { error: 'Could not decrypt SSN for this applicant.' });
  }

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    || req.headers.get('cf-connecting-ip')
    || null;

  try {
    await supabase.from('admin_actions').insert({
      user_id: user.id,
      action: 'reveal_applicant_ssn',
      target_type: 'application_applicant',
      target_id: applicant.id,
      metadata: {
        app_id: applicant.app_id,
        applicant_index: applicant.applicant_index,
        applicant_name: `${applicant.first_name || ''} ${applicant.last_name || ''}`.trim(),
        actor: user.email || user.id,
        reason,
        ip,
      },
    });
  } catch (e) {
    console.warn('admin_actions log failed (non-fatal):', (e as Error).message);
  }

  return jsonNoStore(req, 200, {
    success: true,
    applicant_id: applicant.id,
    app_id: applicant.app_id,
    encrypted_available: true,
    ssn: plainSsn,
    last4: applicant.ssn_last4 || plainSsn.slice(-4),
  });
});
