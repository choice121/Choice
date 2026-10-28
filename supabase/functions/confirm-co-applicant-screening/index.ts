/// <reference lib="deno.ns" />

import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, handleCors } from '../_shared/cors.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

function response(req: Request, status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(req.headers.get('origin')),
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return response(req, 405, { error: 'Method not allowed.' });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return response(req, 400, { error: 'Invalid authorization request.' });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return response(req, 400, { error: 'Invalid authorization request.' });
  }

  const token = typeof body.token === 'string' ? body.token : '';
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || body.consent !== true) {
    return response(req, 400, { error: 'Review the authorization and check the consent box to continue.' });
  }

  const tokenHashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const tokenHash = Array.from(new Uint8Array(tokenHashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  const ip = req.headers.get('cf-connecting-ip')
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || null;
  const userAgent = req.headers.get('user-agent') || null;
  const { error } = await supabase.rpc('confirm_co_applicant_screening', {
    p_token_hash: tokenHash,
    p_consent_version: '1.0',
    p_ip: ip,
    p_user_agent: userAgent,
  });

  if (error) {
    console.error('Co-applicant screening consent confirmation failed:', error.message);
    return response(req, 400, { error: 'This authorization link is invalid, expired, or already used. Contact the leasing team for a new link.' });
  }

  return response(req, 200, { success: true, message: 'Your screening authorization has been recorded.' });
});
