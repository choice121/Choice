/**
 * Choice Properties — Click-Time Passwordless Tenant Auto-Login Handler (Node / Dev Server)
 * Route: GET / POST /api/tenant/auto-login
 */

const crypto = require('crypto');

const SUPABASE_URL = String(process.env.SUPABASE_URL || 'https://tlfmwetmhthpyrytrcfo.supabase.co').replace(/\/$/, '');
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 262144) req.destroy(new Error('Payload too large'));
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch (_) { resolve({}); }
    });
    req.on('error', reject);
  });
}

function escapeLike(val) {
  return String(val || '').replace(/[\\%_]/g, (m) => `\\${m}`);
}

function toBase64Url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function mintReceiptToken(secretKey, appId, applicantId = null, ttlSeconds = 24 * 3600) {
  if (!secretKey || !appId) return null;
  try {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const payload = {
      app_id: String(appId),
      ...(applicantId ? { applicant_id: String(applicantId) } : {}),
      exp,
    };
    const payloadB64 = toBase64Url(JSON.stringify(payload));
    const sig = toBase64Url(crypto.createHmac('sha256', secretKey).update(payloadB64).digest());
    return `${payloadB64}.${sig}`;
  } catch (_) {
    return null;
  }
}

async function sbFetch(relPath, init = {}) {
  return fetch(`${SUPABASE_URL}${relPath}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

async function findApplicationRow({ appId, appUuid, email }) {
  const cols = 'id,app_id,email,co_applicant_email,first_name,last_name,status';
  const trimmedAppId = String(appId || '').trim();
  const trimmedUuid = String(appUuid || '').trim();
  const trimmedEmail = String(email || '').trim();

  if (trimmedUuid && UUID_RE.test(trimmedUuid)) {
    const r = await sbFetch(`/rest/v1/applications?id=eq.${encodeURIComponent(trimmedUuid)}&select=${cols}&limit=1`);
    if (r.ok) {
      const rows = await r.json().catch(() => []);
      if (Array.isArray(rows) && rows[0]) return rows[0];
    }
  }

  if (trimmedAppId) {
    if (UUID_RE.test(trimmedAppId)) {
      const rUuid = await sbFetch(`/rest/v1/applications?id=eq.${encodeURIComponent(trimmedAppId)}&select=${cols}&limit=1`);
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
      const r = await sbFetch(`/rest/v1/applications?${f}&select=${cols}&limit=1`);
      if (r.ok) {
        const rows = await r.json().catch(() => []);
        if (Array.isArray(rows) && rows[0]) return rows[0];
      }
    }
  }

  if (trimmedEmail) {
    const r = await sbFetch(
      `/rest/v1/applications?email=ilike.${encodeURIComponent(escapeLike(trimmedEmail))}&select=${cols}&order=created_at.desc&limit=1`,
    );
    if (r.ok) {
      const rows = await r.json().catch(() => []);
      if (Array.isArray(rows) && rows[0]) return rows[0];
    }
    const rMem = await sbFetch(
      `/rest/v1/application_applicants?email=ilike.${encodeURIComponent(escapeLike(trimmedEmail))}&select=id,app_id,email&order=created_at.desc&limit=1`,
    );
    if (rMem.ok) {
      const mRows = await rMem.json().catch(() => []);
      if (Array.isArray(mRows) && mRows[0]?.app_id) {
        const rApp = await sbFetch(
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

async function handleTenantAutoLogin(req, res) {
  const method = String(req.method || 'GET').toUpperCase();
  if (method === 'OPTIONS') return json(res, 200, { ok: true });
  if (method !== 'GET' && method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
  if (!SERVICE_KEY) {
    return json(res, 503, { ok: false, error: 'Auto-login service is missing server credentials.' });
  }

  let input = {};
  if (method === 'GET') {
    const u = new URL(req.url, 'http://localhost');
    input = {
      app_id: u.searchParams.get('app_id') || u.searchParams.get('id') || '',
      app: u.searchParams.get('app') || '',
      applicant_id: u.searchParams.get('applicant_id') || '',
      receipt_id: u.searchParams.get('receipt_id') || '',
      email: u.searchParams.get('email') || '',
    };
  } else {
    const body = await readBody(req).catch(() => ({}));
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

  try {
    if (receiptId && !appId) {
      const recRes = await sbFetch(
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

    let appRow = await findApplicationRow({ appId, appUuid, email: requestedEmail });
    if (!appRow && !appId && !appUuid && !receiptId && !requestedEmail) {
      const latestRes = await sbFetch(
        `/rest/v1/applications?select=id,app_id,email,co_applicant_email,first_name,last_name,status&order=created_at.desc&limit=1`,
      );
      if (latestRes.ok) {
        const rows = await latestRes.json().catch(() => []);
        if (Array.isArray(rows) && rows[0]) appRow = rows[0];
      }
    }

    if (!appRow) {
      return json(res, 404, { ok: false, error: 'We could not find a matching application.' });
    }

    const canonicalAppId = String(appRow.app_id || appId).trim();
    let authEmail = '';

    if (applicantId) {
      const mRes = await sbFetch(
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
      if (
        String(appRow.email || '').trim().toLowerCase() === requestedEmail ||
        String(appRow.co_applicant_email || '').trim().toLowerCase() === requestedEmail
      ) {
        authEmail = requestedEmail;
      } else {
        const hRes = await sbFetch(
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
      return json(res, 422, { ok: false, error: 'Application has no email address on file for session creation.' });
    }

    const linkRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'magiclink',
        email: authEmail,
      }),
    });
    const linkData = await linkRes.json().catch(() => ({}));
    if (!linkRes.ok) {
      return json(res, 502, {
        ok: false,
        error: linkData?.msg || linkData?.error_description || linkData?.message || 'Could not issue instant session.',
      });
    }

    const tokenHash = String(linkData?.hashed_token || linkData?.properties?.hashed_token || '').trim();
    const verificationType = String(linkData?.verification_type || linkData?.properties?.verification_type || 'magiclink').trim();
    if (!tokenHash) {
      return json(res, 502, { ok: false, error: 'Auth service did not return a session verification token.' });
    }

    const receiptAccessToken = mintReceiptToken(SERVICE_KEY, canonicalAppId, applicantId || null, 24 * 3600);
    return json(res, 200, {
      ok: true,
      app_id: canonicalAppId,
      app_uuid: appRow.id || null,
      applicant_id: applicantId || null,
      email: authEmail,
      token_hash: tokenHash,
      verification_type: verificationType || 'magiclink',
      receipt_access_token: receiptAccessToken,
    });
  } catch (err) {
    return json(res, 500, { ok: false, error: err?.message || 'Internal auto-login error' });
  }
}

module.exports = { handleTenantAutoLogin };
