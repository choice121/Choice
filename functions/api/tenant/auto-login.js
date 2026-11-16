/**
 * Choice Properties — Click-Time Passwordless Tenant Auto-Login Endpoint
 * Route: GET / POST /api/tenant/auto-login
 *
 * Accepts: { app_id?, app?, id?, applicant_id?, receipt_id?, email? }
 * Resolves the authoritative application / applicant email on the server,
 * generates a fresh single-session Supabase OTP token_hash at click time
 * (immune to email link-scanner prefetching & repeatable across reloads),
 * and mints a scoped HMAC-SHA256 receipt_access_token for PDF receipts.
 */

const DEFAULT_SUPABASE_URL = 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getSupabaseConfig(env = {}) {
  const url = String(env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return { url, key };
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    },
  });
}

function escapeLike(val) {
  return String(val || '').replace(/[\\%_]/g, (m) => `\\${m}`);
}

function toBase64Url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function mintReceiptToken(secretKey, appId, applicantId = null, ttlSeconds = 24 * 3600) {
  if (!secretKey || !appId || !globalThis.crypto?.subtle) return null;
  try {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const payload = {
      app_id: String(appId),
      ...(applicantId ? { applicant_id: String(applicantId) } : {}),
      exp,
    };
    const payloadB64 = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
    const hmacKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secretKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const mac = await crypto.subtle.sign('HMAC', hmacKey, new TextEncoder().encode(payloadB64));
    return `${payloadB64}.${toBase64Url(new Uint8Array(mac))}`;
  } catch (_) {
    return null;
  }
}

async function sbFetch(env, relPath, init = {}) {
  const { url, key } = getSupabaseConfig(env);
  return fetch(`${url}${relPath}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

async function findApplicationRow(env, { appId, appUuid, email }) {
  const cols = 'id,app_id,email,co_applicant_email,first_name,last_name,status';
  const trimmedAppId = String(appId || '').trim();
  const trimmedUuid = String(appUuid || '').trim();
  const trimmedEmail = String(email || '').trim();

  if (trimmedUuid && UUID_RE.test(trimmedUuid)) {
    const r = await sbFetch(env, `/rest/v1/applications?id=eq.${encodeURIComponent(trimmedUuid)}&select=${cols}&limit=1`);
    if (r.ok) {
      const rows = await r.json().catch(() => []);
      if (Array.isArray(rows) && rows[0]) return rows[0];
    }
  }

  if (trimmedAppId) {
    if (UUID_RE.test(trimmedAppId)) {
      const rUuid = await sbFetch(env, `/rest/v1/applications?id=eq.${encodeURIComponent(trimmedAppId)}&select=${cols}&limit=1`);
      if (rUuid.ok) {
        const rows = await rUuid.json().catch(() => []);
        if (Array.isArray(rows) && rows[0]) return rows[0];
      }
    }
    const filters = [
      `app_id=eq.${encodeURIComponent(trimmedAppId)}`,
      `app_id=ilike.${encodeURIComponent(escapeLike(trimmedAppId))}`,
    ];
    for (const f of filters) {
      const r = await sbFetch(env, `/rest/v1/applications?${f}&select=${cols}&limit=1`);
      if (r.ok) {
        const rows = await r.json().catch(() => []);
        if (Array.isArray(rows) && rows[0]) return rows[0];
      }
    }
  }

  if (trimmedEmail) {
    const r = await sbFetch(
      env,
      `/rest/v1/applications?email=ilike.${encodeURIComponent(escapeLike(trimmedEmail))}&select=${cols}&order=created_at.desc&limit=1`,
    );
    if (r.ok) {
      const rows = await r.json().catch(() => []);
      if (Array.isArray(rows) && rows[0]) return rows[0];
    }
    const rMem = await sbFetch(
      env,
      `/rest/v1/application_applicants?email=ilike.${encodeURIComponent(escapeLike(trimmedEmail))}&select=id,app_id,email&order=created_at.desc&limit=1`,
    );
    if (rMem.ok) {
      const mRows = await rMem.json().catch(() => []);
      if (Array.isArray(mRows) && mRows[0]?.app_id) {
        const rApp = await sbFetch(
          env,
          `/rest/v1/applications?app_id=eq.${encodeURIComponent(mRows[0].app_id)}&select=${cols}&limit=1`,
        );
        if (rApp.ok) {
          const rows = await rApp.json().catch(() => []);
          if (Array.isArray(rows) && rows[0]) return rows[0];
        }
      }
    }
  }

  return null;
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return json(200, { ok: true });
  }
  if (method !== 'GET' && method !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' });
  }

  const { url: sbUrl, key: serviceKey } = getSupabaseConfig(env);
  if (!serviceKey) {
    return json(503, { ok: false, error: 'Auto-login service is missing server credentials.' });
  }

  let input = {};
  if (method === 'GET') {
    const u = new URL(request.url);
    input = {
      app_id: u.searchParams.get('app_id') || u.searchParams.get('id') || '',
      app: u.searchParams.get('app') || '',
      applicant_id: u.searchParams.get('applicant_id') || '',
      receipt_id: u.searchParams.get('receipt_id') || '',
      email: u.searchParams.get('email') || '',
    };
  } else {
    const body = await request.json().catch(() => ({}));
    input = {
      app_id: body.app_id || body.id || '',
      app: body.app || body.app_uuid || '',
      applicant_id: body.applicant_id || '',
      receipt_id: body.receipt_id || '',
      email: body.email || '',
    };
  }

  let appId = String(input.app_id || '').trim();
  const appUuid = String(input.app || '').trim();
  let applicantId = String(input.applicant_id || '').trim();
  const receiptId = String(input.receipt_id || '').trim();
  const requestedEmail = String(input.email || '').trim().toLowerCase();

  // Step 1: If receipt_id was passed without app_id, resolve app_id & applicant_id from payment_receipts
  if (receiptId && !appId) {
    const recRes = await sbFetch(
      env,
      `/rest/v1/payment_receipts?id=eq.${encodeURIComponent(receiptId)}&select=app_id,applicant_id&limit=1`,
    );
    if (recRes.ok) {
      const recs = await recRes.json().catch(() => []);
      if (Array.isArray(recs) && recs[0]) {
        appId = recs[0].app_id || '';
        if (!applicantId && recs[0].applicant_id) applicantId = recs[0].applicant_id;
      }
    }
  }

  // Step 2: Resolve authoritative application record (with fallback to most recent application if none specified)
  let appRow = await findApplicationRow(env, { appId, appUuid, email: requestedEmail });
  if (!appRow && !appId && !appUuid && !receiptId && !requestedEmail) {
    const latestRes = await sbFetch(
      env,
      `/rest/v1/applications?select=id,app_id,email,co_applicant_email,first_name,last_name,status&order=created_at.desc&limit=1`,
    );
    if (latestRes.ok) {
      const rows = await latestRes.json().catch(() => []);
      if (Array.isArray(rows) && rows[0]) appRow = rows[0];
    }
  }

  if (!appRow) {
    return json(404, { ok: false, error: 'We could not find a matching application.' });
  }

  const canonicalAppId = String(appRow.app_id || appId).trim();

  // Step 3: Determine which household email should be signed in
  let authEmail = '';
  if (applicantId) {
    const mRes = await sbFetch(
      env,
      `/rest/v1/application_applicants?id=eq.${encodeURIComponent(applicantId)}&select=id,app_id,email&limit=1`,
    );
    if (mRes.ok) {
      const mRows = await mRes.json().catch(() => []);
      if (Array.isArray(mRows) && mRows[0]?.email) {
        authEmail = String(mRows[0].email).trim().toLowerCase();
      }
    }
  }

  if (!authEmail && requestedEmail) {
    // Allow signing in as a matching household email (co-applicant / co-signer / primary)
    if (
      String(appRow.email || '').trim().toLowerCase() === requestedEmail ||
      String(appRow.co_applicant_email || '').trim().toLowerCase() === requestedEmail
    ) {
      authEmail = requestedEmail;
    } else {
      const hRes = await sbFetch(
        env,
        `/rest/v1/application_applicants?app_id=eq.${encodeURIComponent(canonicalAppId)}&email=ilike.${encodeURIComponent(escapeLike(requestedEmail))}&select=id,email&limit=1`,
      );
      if (hRes.ok) {
        const hRows = await hRes.json().catch(() => []);
        if (Array.isArray(hRows) && hRows[0]?.email) {
          authEmail = String(hRows[0].email).trim().toLowerCase();
          if (!applicantId && hRows[0].id) applicantId = String(hRows[0].id);
        }
      }
    }
  }

  if (!authEmail) {
    authEmail = String(appRow.email || requestedEmail || '').trim().toLowerCase();
  }

  if (!authEmail) {
    return json(422, { ok: false, error: 'Application has no email address on file for session creation.' });
  }

  // Step 4: Generate a fresh click-time Supabase magic-link OTP hash
  let tokenHash = '';
  let verificationType = 'magiclink';
  try {
    const linkRes = await fetch(`${sbUrl}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'magiclink',
        email: authEmail,
      }),
    });
    const linkData = await linkRes.json().catch(() => ({}));
    if (!linkRes.ok) {
      return json(502, {
        ok: false,
        error: linkData?.msg || linkData?.error_description || linkData?.message || 'Could not issue instant session.',
      });
    }
    tokenHash = String(linkData?.hashed_token || linkData?.properties?.hashed_token || '').trim();
    verificationType = String(linkData?.verification_type || linkData?.properties?.verification_type || 'magiclink').trim();
  } catch (err) {
    return json(502, { ok: false, error: err?.message || 'Failed to reach auth service.' });
  }

  if (!tokenHash) {
    return json(502, { ok: false, error: 'Auth service did not return a session verification token.' });
  }

  // Step 5: Mint scoped receipt access token matching download-payment-receipt HMAC contract
  const receiptAccessToken = await mintReceiptToken(serviceKey, canonicalAppId, applicantId || null, 24 * 3600);

  return json(200, {
    ok: true,
    app_id: canonicalAppId,
    app_uuid: appRow.id || null,
    applicant_id: applicantId || null,
    email: authEmail,
    token_hash: tokenHash,
    verification_type: verificationType || 'magiclink',
    receipt_access_token: receiptAccessToken,
  });
}
