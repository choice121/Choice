import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/send-email.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // GET ?token=xxx — retrieve a saved draft
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const token = (url.searchParams.get('token') || '').trim();
    if (!token) return jsonErr(400, 'token is required');

    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('draft_applications')
      .select('data')
      .eq('token', token)
      .gte('created_at', cutoff)
      .maybeSingle();

    if (error) {
      console.error('Draft fetch error:', JSON.stringify(error));
      return jsonErr(500, 'Failed to retrieve draft');
    }

    if (!data) return jsonOk({ found: false, expired: true });
    return jsonOk({ found: true, data: data.data });
  }

  // POST { token, email, resume_url, data, property_fingerprint }
  if (req.method === 'POST') {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return jsonErr(400, 'Invalid JSON body');
    }

    const token = String(body.token || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const resumeUrl = String(body.resume_url || '').trim();
    const progressData = body.data;
    const propertyFingerprint = String(body.property_fingerprint || '').trim();

    if (!token || token.length < 8) return jsonErr(400, 'Invalid token');
    if (!email || !email.includes('@')) return jsonErr(400, 'Valid email is required');

    const { error: upsertErr } = await supabase
      .from('draft_applications')
      .upsert({
        token,
        email,
        data: progressData ?? {},
        property_fingerprint: propertyFingerprint || null,
        created_at: new Date().toISOString(),
      }, { onConflict: 'token' });

    if (upsertErr) {
      console.error('Draft save error:', JSON.stringify(upsertErr));
      return jsonErr(500, 'Failed to save draft');
    }

    if (resumeUrl) {
      const html = `
        <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="color:#1a5276;">Your application progress is saved</h2>
          <p>Click the link below to continue your rental application right where you left off — on any device or browser.</p>
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
