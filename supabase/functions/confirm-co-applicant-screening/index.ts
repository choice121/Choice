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

const SHARE_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const SHARE_ALIAS_RE = /^[a-z0-9]+(?:-[a-z0-9]+){1,4}$/;

function normalizeShareAlias(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

async function resolveShareRecord(tokenOrAlias: string) {
  const value = String(tokenOrAlias || '').trim();
  if (!value) return null;

  if (SHARE_TOKEN_RE.test(value)) {
    const tokenHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');

    const { data, error } = await supabase
      .from('property_shares')
      .select('id, token_hash')
      .eq('token_hash', tokenHash)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error) {
      console.warn('[confirm-co-applicant-screening] token lookup failed:', error.message);
      return null;
    }
    return data;
  }

  const alias = normalizeShareAlias(value);
  if (!alias || alias.length < 6 || !SHARE_ALIAS_RE.test(alias)) return null;

  const { data, error } = await supabase
    .from('property_shares')
    .select('id, token_hash')
    .eq('share_alias', alias)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.warn('[confirm-co-applicant-screening] alias lookup failed:', error.message);
    return null;
  }
  return data;
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
  const share = await resolveShareRecord(token);
  if (!share || body.consent !== true) {
    return response(req, 400, { error: 'Review the authorization and check the consent box to continue.' });
  }

  const tokenHash = SHARE_TOKEN_RE.test(token)
    ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
    : share?.token_hash || null;
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
