import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';

const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  SERVICE_KEY,
);

interface ReceiptAccessPayload {
  app_id: string;
  applicant_id?: string | null;
  exp: number;
}

function base64UrlToUint8Array(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64url.length + 3) % 4);
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyReceiptToken(rawToken: string): Promise<ReceiptAccessPayload | null> {
  if (!rawToken || !SERVICE_KEY) return null;
  const parts = rawToken.trim().split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(SERVICE_KEY),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
    const expectedSig = uint8ArrayToBase64Url(new Uint8Array(mac));
    if (!constantTimeEq(sigB64, expectedSig)) return null;

    const payloadJson = new TextDecoder().decode(base64UrlToUint8Array(payloadB64));
    const payload = JSON.parse(payloadJson) as ReceiptAccessPayload;
    if (!payload || !payload.app_id || !payload.exp) return null;
    if (Math.floor(Date.now() / 1000) > Number(payload.exp)) return null;
    return payload;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return jsonErr(405, 'POST required', req);

  const authHeader = req.headers.get('Authorization') || '';
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();

  let body: { receipt_id?: string; app_id?: string; receipt_type?: string; applicant_id?: string; receipt_token?: string };
  try { body = await req.json(); } catch { return jsonErr(400, 'Invalid JSON body', req); }

  if (!body.receipt_id && !(body.app_id && ['application_fee', 'holding_deposit'].includes(body.receipt_type || ''))) {
    return jsonErr(400, 'Provide a receipt_id or a valid app_id and receipt_type', req);
  }

  let appId = String(body.app_id || '').trim();
  if (body.receipt_id) {
    const { data: receiptForApp, error: lookupError } = await supabase.from('payment_receipts')
      .select('app_id').eq('id', body.receipt_id).maybeSingle();
    if (lookupError || !receiptForApp) return jsonErr(404, 'Receipt not found', req);
    appId = receiptForApp.app_id;
  }

  let { data: app, error: appError } = await supabase.from('applications')
    .select('app_id,applicant_user_id,email,co_applicant_email,first_name,last_name,property_address,household_payment_mode,fee_breakdown')
    .eq('app_id', appId)
    .maybeSingle();
  if (!app && !appError && appId) {
    const escaped = appId.replace(/[\\%_]/g, (m) => `\\${m}`);
    const ciRes = await supabase.from('applications')
      .select('app_id,applicant_user_id,email,co_applicant_email,first_name,last_name,property_address,household_payment_mode,fee_breakdown')
      .ilike('app_id', escaped)
      .maybeSingle();
    app = ciRes.data;
    appError = ciRes.error;
  }
  if (appError || !app) return jsonErr(404, 'Receipt application not found', req);

  // Enforce strict authorization via either an authenticated household/admin JWT OR a valid scoped receipt_token.
  let authorizedByJwt = false;
  let scopedTokenPayload: ReceiptAccessPayload | null = null;

  if (bearerToken) {
    const { data: { user }, error: authError } = await supabase.auth.getUser(bearerToken);
    if (!authError && user) {
      const { data: role } = await supabase.from('admin_roles').select('id').eq('user_id', user.id).maybeSingle();
      const [{ data: coApplicants }, { data: applicantRows }] = await Promise.all([
        supabase.from('co_applicants').select('email').eq('app_id', app.app_id),
        supabase.from('application_applicants').select('email').eq('app_id', app.app_id),
      ]);
      const userEmail = (user.email || '').toLowerCase();
      const householdEmails = [
        ...(coApplicants || []).map((c: { email?: string }) => String(c.email || '').toLowerCase()),
        ...(applicantRows || []).map((a: { email?: string }) => String(a.email || '').toLowerCase()),
      ].filter(Boolean);
      const allowed = !!role
        || app.applicant_user_id === user.id
        || (userEmail !== '' && (app.email || '').toLowerCase() === userEmail)
        || (userEmail !== '' && (app.co_applicant_email || '').toLowerCase() === userEmail)
        || (userEmail !== '' && householdEmails.includes(userEmail));
      if (!allowed) {
        return jsonErr(403, 'This receipt is not linked to the signed-in account.', req);
      }
      authorizedByJwt = true;
    }
  }

  if (!authorizedByJwt && body.receipt_token) {
    const verified = await verifyReceiptToken(String(body.receipt_token));
    if (verified && verified.app_id === app.app_id) {
      if (verified.applicant_id && body.applicant_id && String(verified.applicant_id) !== String(body.applicant_id)) {
        return jsonErr(403, 'This receipt token is scoped to another applicant.', req);
      }
      scopedTokenPayload = verified;
    }
  }

  if (!authorizedByJwt && !scopedTokenPayload) {
    return jsonErr(401, 'Sign in or use your verified post-payment receipt link to view this receipt.', req);
  }

  let receiptQuery = supabase.from('payment_receipts')
    .select('id,app_id,applicant_id,receipt_type,receipt_number,amount,currency,payment_method,transaction_ref,paid_at,storage_path,status,issued_at,fee_breakdown')
    .eq('app_id', app.app_id)
    .eq('status', 'issued');
  if (body.receipt_id) {
    receiptQuery = receiptQuery.eq('id', body.receipt_id);
  } else {
    receiptQuery = receiptQuery.eq('receipt_type', body.receipt_type!);
    const effectiveApplicantId = body.applicant_id || scopedTokenPayload?.applicant_id || '';
    if (effectiveApplicantId) {
      receiptQuery = receiptQuery.eq('applicant_id', effectiveApplicantId);
    }
  }
  const { data: receipt, error: receiptError } = await receiptQuery
    .order('issued_at', { ascending: false }).limit(1).maybeSingle();
  if (receiptError || !receipt) return jsonErr(404, 'Issued receipt not found', req);

  if (scopedTokenPayload?.applicant_id && receipt.applicant_id && String(receipt.applicant_id) !== String(scopedTokenPayload.applicant_id)) {
    return jsonErr(403, 'This receipt token is not authorized for this member receipt.', req);
  }

  const { data: signed, error: signedError } = await supabase.storage.from('lease-pdfs')
    .createSignedUrl(receipt.storage_path, 900);
  if (signedError || !signed?.signedUrl) return jsonErr(500, 'Could not create a receipt download link.', req);

  return jsonOk({
    receipt,
    application: {
      app_id: app.app_id,
      first_name: app.first_name,
      last_name: app.last_name,
      property_address: app.property_address,
      household_payment_mode: app.household_payment_mode || 'centralized',
      fee_breakdown: app.fee_breakdown || null,
    },
    signed_url: signed.signedUrl,
  }, req);
});