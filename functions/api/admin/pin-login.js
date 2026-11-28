/**
 * Choice Properties — Admin 2-Digit Quick PIN Login API (Cloudflare Pages Function)
 * Route: POST /api/admin/pin-login
 */

const DEFAULT_SUPABASE_URL = 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const COOKIE_NAME = 'cp_admin_device';
const STORAGE_BUCKET = 'application-docs';
const STORAGE_PREFIX = '_admin_trusted_devices';
const MAX_ATTEMPTS = 3;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PIN_RE = /^\d{2}$/;

function getSupabaseConfig(env = {}) {
  const url = String(env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return { url, key };
}

function checkSameOrigin(request) {
  const origin = String(request.headers.get('origin') || '').trim();
  if (!origin) return { ok: true, origin: '' };
  try {
    const parsed = new URL(origin);
    const reqUrl = new URL(request.url);
    if (parsed.host.toLowerCase() !== reqUrl.host.toLowerCase()) {
      return { ok: false, origin };
    }
    return { ok: true, origin: parsed.origin };
  } catch (_) {
    return { ok: false, origin };
  }
}

function json(request, status, body, extraHeaders = {}) {
  const originCheck = checkSameOrigin(request);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    Vary: 'Origin, Cookie',
    ...extraHeaders,
  };
  if (originCheck.ok && originCheck.origin) {
    headers['Access-Control-Allow-Origin'] = originCheck.origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function parseCookies(request) {
  const header = String(request.headers.get('cookie') || '');
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) {
      try { out[k] = decodeURIComponent(v); } catch (_) { out[k] = v; }
    }
  }
  return out;
}

function clearDeviceCookie(request) {
  const url = new URL(request.url);
  const proto = String(request.headers.get('x-forwarded-proto') || '').toLowerCase();
  const isHttps = url.protocol === 'https:' || proto === 'https';
  const parts = [`${COOKIE_NAME}=`, 'Path=/', 'Max-Age=0', 'HttpOnly'];
  if (isHttps) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  return parts.join('; ');
}

function parseDeviceCookieValue(raw) {
  const s = String(raw || '').trim();
  const dot = s.indexOf('.');
  if (dot <= 0) return null;
  const deviceId = s.slice(0, dot).trim();
  const rawToken = s.slice(dot + 1).trim();
  if (!UUID_RE.test(deviceId) || rawToken.length < 24 || rawToken.length > 200) return null;
  return { deviceId, rawToken };
}

function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

async function sha256Hex(str) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(str)));
  return bytesToHex(new Uint8Array(digest));
}

async function hashPin(pin, saltHex) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(pin)),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
}

function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
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

async function isSqlTableAvailable(env) {
  const r = await sbFetch(env, '/rest/v1/admin_trusted_devices?select=id&limit=1');
  return r.ok;
}

async function storageGetJson(env, objPath) {
  const { url, key } = getSupabaseConfig(env);
  const r = await fetch(`${url}/storage/v1/object/${STORAGE_BUCKET}/${objPath}?cb=${Date.now()}`, {
    method: 'GET',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Cache-Control': 'no-cache, no-store',
    },
  });
  if (!r.ok) return null;
  return r.json().catch(() => null);
}

async function storagePutJson(env, objPath, data) {
  const { url, key } = getSupabaseConfig(env);
  const r = await fetch(`${url}/storage/v1/object/${STORAGE_BUCKET}/${objPath}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'x-upsert': 'true',
      'cache-control': '0',
    },
    body: JSON.stringify(data),
  });
  return r.ok;
}

async function getDeviceRecord(env, deviceId) {
  if (!UUID_RE.test(String(deviceId || ''))) return null;
  if (await isSqlTableAvailable(env)) {
    const r = await sbFetch(
      env,
      `/rest/v1/admin_trusted_devices?id=eq.${encodeURIComponent(deviceId)}&select=*&limit=1`,
    );
    if (!r.ok) return null;
    const rows = await r.json().catch(() => []);
    return Array.isArray(rows) && rows[0] ? { mode: 'sql', record: rows[0] } : null;
  }
  const rec = await storageGetJson(env, `${STORAGE_PREFIX}/devices/${deviceId}.json`);
  return rec ? { mode: 'storage', record: rec } : null;
}

async function updateDeviceRecord(env, mode, record) {
  if (mode === 'sql') {
    const r = await sbFetch(
      env,
      `/rest/v1/admin_trusted_devices?id=eq.${encodeURIComponent(record.id)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          failed_attempts: record.failed_attempts,
          revoked_at: record.revoked_at,
          revoked_reason: record.revoked_reason,
          last_used_at: record.last_used_at,
        }),
      },
    );
    return r.ok;
  }
  return storagePutJson(env, `${STORAGE_PREFIX}/devices/${record.id}.json`, record);
}

async function isUserAdmin(env, userId) {
  if (!UUID_RE.test(String(userId || ''))) return false;
  const roleRes = await sbFetch(
    env,
    `/rest/v1/admin_roles?user_id=eq.${encodeURIComponent(userId)}&select=id&limit=1`,
  );
  if (!roleRes.ok) return false;
  const roles = await roleRes.json().catch(() => []);
  return Array.isArray(roles) && roles.length > 0;
}

async function logAdminAction(env, { userId, action, targetId, metadata }) {
  try {
    await sbFetch(env, '/rest/v1/admin_actions', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        user_id: UUID_RE.test(String(userId || '')) ? userId : null,
        action,
        target_type: 'trusted_device',
        target_id: String(targetId || ''),
        metadata: metadata || {},
      }),
    });
  } catch (_) {}
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  if (!checkSameOrigin(request).ok) {
    return json(request, 403, { ok: false, error: 'Origin not allowed.' });
  }
  if (method === 'OPTIONS') {
    return json(request, 200, { ok: true });
  }
  if (method !== 'POST') {
    return json(request, 405, { ok: false, error: 'Method not allowed' });
  }
  if (String(request.headers.get('x-requested-with') || '') !== 'ChoiceAdmin') {
    return json(request, 403, { ok: false, error: 'Invalid request header.' });
  }

  const { key: serviceKey } = getSupabaseConfig(env);
  if (!serviceKey) {
    return json(request, 503, { ok: false, error: 'Admin quick login service is missing server credentials.' });
  }

  const cookies = parseCookies(request);
  const parsedCookie = parseDeviceCookieValue(cookies[COOKIE_NAME]);
  if (!parsedCookie) {
    return json(request, 401, {
      ok: false,
      enrolled: false,
      error: 'This device is not enrolled for Quick PIN login.',
    });
  }

  const body = await request.json().catch(() => ({}));
  const pin = String(body.pin || '').trim();
  if (!PIN_RE.test(pin)) {
    return json(request, 400, { ok: false, error: 'Enter 2 numbers.' });
  }

  const found = await getDeviceRecord(env, parsedCookie.deviceId);
  if (!found) {
    return json(request, 401, {
      ok: false,
      enrolled: false,
      error: 'This device is not enrolled for Quick PIN login.',
    }, {
      'Set-Cookie': clearDeviceCookie(request),
    });
  }

  const { mode, record: dev } = found;
  if (!safeEqualHex(await sha256Hex(parsedCookie.rawToken), dev.token_hash)) {
    return json(request, 401, {
      ok: false,
      enrolled: false,
      error: 'Device verification failed. Please sign in with your email and password.',
    }, {
      'Set-Cookie': clearDeviceCookie(request),
    });
  }

  if (dev.revoked_at || !dev.expires_at || Date.parse(dev.expires_at) <= Date.now()) {
    return json(request, 401, {
      ok: false,
      enrolled: false,
      locked: true,
      error: 'Quick PIN has expired or been revoked on this device. Please sign in with your email and password.',
    }, {
      'Set-Cookie': clearDeviceCookie(request),
    });
  }

  const stillAdmin = await isUserAdmin(env, dev.user_id);
  if (!stillAdmin) {
    dev.revoked_at = new Date().toISOString();
    dev.revoked_reason = 'admin_role_removed';
    await updateDeviceRecord(env, mode, dev);
    return json(request, 403, {
      ok: false,
      enrolled: false,
      locked: true,
      error: 'Access denied — this account no longer has admin privileges.',
    }, {
      'Set-Cookie': clearDeviceCookie(request),
    });
  }

  const candidateHash = await hashPin(pin, dev.pin_salt);
  if (!safeEqualHex(candidateHash, dev.pin_hash)) {
    const nextAttempts = Number(dev.failed_attempts || 0) + 1;
    dev.failed_attempts = nextAttempts;

    if (nextAttempts >= MAX_ATTEMPTS) {
      dev.revoked_at = new Date().toISOString();
      dev.revoked_reason = 'max_failed_attempts';
      await updateDeviceRecord(env, mode, dev);
      await logAdminAction(env, {
        userId: dev.user_id,
        action: 'admin_pin_lockout',
        targetId: dev.id,
        metadata: { failed_attempts: nextAttempts },
      });
      return json(request, 423, {
        ok: false,
        enrolled: false,
        locked: true,
        attempts_remaining: 0,
        error: 'Too many wrong taps. Quick PIN has been disabled on this device — please sign in with your email and password.',
      }, {
        'Set-Cookie': clearDeviceCookie(request),
      });
    }

    await updateDeviceRecord(env, mode, dev);
    await logAdminAction(env, {
      userId: dev.user_id,
      action: 'admin_pin_failed',
      targetId: dev.id,
      metadata: { failed_attempts: nextAttempts },
    });
    const remaining = MAX_ATTEMPTS - nextAttempts;
    return json(request, 401, {
      ok: false,
      enrolled: true,
      locked: false,
      attempts_remaining: remaining,
      error: `Incorrect numbers. ${remaining} attempt${remaining === 1 ? '' : 's'} left before this device is locked.`,
    });
  }

  const userRes = await sbFetch(env, `/auth/v1/admin/users/${encodeURIComponent(dev.user_id)}`);
  if (!userRes.ok) {
    return json(request, 502, { ok: false, error: 'Could not verify admin account.' });
  }
  const userData = await userRes.json().catch(() => null);
  const adminEmail = String(userData?.email || '').trim().toLowerCase();
  if (!adminEmail) {
    return json(request, 502, { ok: false, error: 'Admin account email unavailable.' });
  }

  const linkRes = await sbFetch(env, '/auth/v1/admin/generate_link', {
    method: 'POST',
    body: JSON.stringify({ type: 'magiclink', email: adminEmail }),
  });
  const linkData = await linkRes.json().catch(() => ({}));
  const tokenHash = String(linkData?.hashed_token || linkData?.properties?.hashed_token || '').trim();
  const verificationType = String(linkData?.verification_type || linkData?.properties?.verification_type || 'magiclink').trim();
  if (!linkRes.ok || !tokenHash) {
    return json(request, 502, { ok: false, error: 'Could not issue admin session.' });
  }

  dev.failed_attempts = 0;
  dev.last_used_at = new Date().toISOString();
  await updateDeviceRecord(env, mode, dev);

  await logAdminAction(env, {
    userId: dev.user_id,
    action: 'admin_pin_login',
    targetId: dev.id,
    metadata: { label: dev.label },
  });

  return json(request, 200, {
    ok: true,
    token_hash: tokenHash,
    verification_type: verificationType || 'magiclink',
  });
}
