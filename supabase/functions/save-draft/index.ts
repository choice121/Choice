import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/send-email.ts';
import { getSiteUrl } from '../_shared/config.ts';
import { isDbRateLimited } from '../_shared/rate-limit.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const TOKEN_RE = /^[A-Za-z0-9_\-]{32,128}$/;

// Keys that must NEVER be stored in draft_applications JSONB
const SENSITIVE_KEY_RE = /^(?:_docFile_|ssn$|co_applicant_ssn$|co-applicant ssn$|government id number$|government_id_number$|id_number$)/i;

function stripSensitiveDraftData(val: unknown): unknown {
  if (Array.isArray(val)) {
    return val.map(item => stripSensitiveDraftData(item));
  }
  if (val && typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (k.startsWith('_docFile_') || SENSITIVE_KEY_RE.test(k.trim()) || /\bssn\b/i.test(k)) {
        continue;
      }
      if ((k === '_coApplicantsJson' || k === 'co_applicants') && typeof v === 'string') {
        try {
          const parsed = JSON.parse(v);
          out[k] = JSON.stringify(stripSensitiveDraftData(parsed));
          continue;
        } catch { /* fall through */ }
      }
      out[k] = stripSensitiveDraftData(v);
    }
    return out;
  }
  return val;
}

function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for') || '';
  return (fwd.split(',')[0] || req.headers.get('cf-connecting-ip') || 'unknown').trim();
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const token = (url.searchParams.get('token') || '').trim();
    if (!TOKEN_RE.test(token)) return jsonErr(400, 'Invalid token');

    const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - DRAFT_TTL_MS).toISOString();
    const { data, error } = await supabase
      .from('draft_applications')
      .select('data, created_at')
      .eq('token', token)
      .gte('created_at', cutoff)
      .maybeSingle();

    if (error) {
      console.error('Draft fetch error:', JSON.stringify(error));
      return jsonErr(500, 'Failed to retrieve draft');
    }

    if (!data) return jsonOk({ found: false, expired: true });

    const createdAt = data.created_at as string;
    const expiresAt = new Date(new Date(createdAt).getTime() + DRAFT_TTL_MS);
    const msRemaining = expiresAt.getTime() - Date.now();

    return jsonOk({
      found: true,
      data: stripSensitiveDraftData(data.data),
      created_at: createdAt,
      expires_at: expiresAt.toISOString(),
      ms_remaining: Math.max(0, msRemaining),
    });
  }

  if (req.method === 'POST') {
    const ip = getClientIp(req);

    if (await isDbRateLimited(ip, 'save-draft', 20, 60_000)) {
      return jsonErr(429, 'Too many save requests. Please wait a moment.');
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return jsonErr(400, 'Invalid JSON body');
    }

    const token = String(body.token || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const sendResumeEmail = body.send_email === true;
    const progressData = stripSensitiveDraftData(body.data);
    const propertyFingerprint = String(body.property_fingerprint || '').trim();

    if (!TOKEN_RE.test(token)) return jsonErr(400, 'Invalid token');
    if (!email || !email.includes('@') || email.length > 254) return jsonErr(400, 'Valid email is required');

    const resumeUrl = `${getSiteUrl()}/apply/?resume=${encodeURIComponent(token)}`;

    const { error: upsertErr } = await supabase
      .from('draft_applications')
      .upsert({
        token,
        email,
        data: progressData ?? {},
        property_fingerprint: propertyFingerprint || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'token' });

    if (upsertErr) {
      console.error('Draft save error:', JSON.stringify(upsertErr));
      return jsonErr(500, 'Failed to save draft');
    }

    if (sendResumeEmail) {
      const html = `
        <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="color:#1a5276;">Your application progress is saved</h2>
          <p>Click the link below to continue your rental application right where you left off — on any device or browser. For security, please re-enter Social Security Numbers before submitting.</p>
          <p style="margin:24px 0;">
            <a href="${resumeUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
              Continue My Application →
            </a>
          </p>
          <p style="color:#64748b;font-size:13px;">This link is valid for 7 days. If it expires, you can start a new application at any time.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
          <p style="color:#94a3b8;font-size:12px;">Choice Properties · 707-706-3137</p>
        </div>`;

      sendEmail({
        to: email,
        subject: 'Your Choice Properties application progress is saved',
        html,
      }).catch(err => console.error('Draft email error:', err));
    }

    return jsonOk({ ok: true });
  }

  return jsonErr(405, 'Method not allowed');
});
