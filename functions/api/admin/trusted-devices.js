/**
 * Choice Properties — Admin Trusted Devices API (Cloudflare Pages Function)
 * Route: GET / POST / DELETE /api/admin/trusted-devices
 */

const DEFAULT_SUPABASE_URL = 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const COOKIE_NAME = 'cp_admin_device';
const STORAGE_BUCKET = 'application-docs';
const STORAGE_PREFIX = '_admin_trusted_devices';
const MAX_ATTEMPTS = 3;
const DEVICE_TTL_DAYS = 30;
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
    headers['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, OPTIONS';
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

function buildDeviceCookie(request, value, maxAgeSeconds) {
  const url = new URL(request.url);
  const proto = String(request.headers.get('x-forwarded-proto') || '').toLowerCase();
  const isHttps = url.protocol === 'https:' || proto === 'https';
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
    'HttpOnly',
  ];
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

function bytesToBase64Url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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

function sanitizeLabel(raw) {
  const clean = String(raw || '').replace(/[\r\n\t<>]/g, ' ').replace(/\s+/g, ' ').trim();
  return (clean || 'Trusted Device').slice(0, 60);
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

async function verifyAdminBearer(env, request) {
  const authHeader = String(request.headers.get('authorization') || '');
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!jwt) return null;

  const userRes = await sbFetch(env, '/auth/v1/user', {
    method: 'GET',
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!userRes.ok) return null;
  const user = await userRes.json().catch(() => null);
  if (!user?.id || !UUID_RE.test(user.id)) return null;

  const roleRes = await sbFetch(
    env,
    `/rest/v1/admin_roles?user_id=eq.${encodeURIComponent(user.id)}&select=id&limit=1`,
  );
  if (!roleRes.ok) return null;
  const roles = await roleRes.json().catch(() => []);
  if (!Array.isArray(roles) || roles.length === 0) return null;

  return { id: user.id, email: String(user.email || '').trim().toLowerCase() };
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

async function saveDeviceRecord(env, mode, record, isNew = false) {
  if (mode === 'sql') {
    if (isNew) {
      const r = await sbFetch(env, '/rest/v1/admin_trusted_devices', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(record),
      });
      return r.ok;
    }
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

  const ok = await storagePutJson(env, `${STORAGE_PREFIX}/devices/${record.id}.json`, record);
  if (!ok) return false;
  if (isNew) {
    const idxPath = `${STORAGE_PREFIX}/users/${record.user_id}.json`;
    const idx = (await storageGetJson(env, idxPath)) || { device_ids: [] };
    const ids = Array.isArray(idx.device_ids) ? idx.device_ids.filter((x) => UUID_RE.test(String(x))) : [];
    if (!ids.includes(record.id)) ids.unshift(record.id);
    await storagePutJson(env, idxPath, { device_ids: ids.slice(0, 20) });
  }
  return true;
}

async function listUserDevices(env, userId) {
  if (!UUID_RE.test(String(userId || ''))) return { mode: 'sql', devices: [] };
  if (await isSqlTableAvailable(env)) {
    const r = await sbFetch(
      env,
      `/rest/v1/admin_trusted_devices?user_id=eq.${encodeURIComponent(userId)}&select=id,user_id,label,failed_attempts,revoked_at,revoked_reason,last_used_at,expires_at,created_at&order=created_at.desc&limit=20`,
    );
    const rows = r.ok ? await r.json().catch(() => []) : [];
    return { mode: 'sql', devices: Array.isArray(rows) ? rows : [] };
  }
  const idx = await storageGetJson(env, `${STORAGE_PREFIX}/users/${userId}.json`);
  const ids = Array.isArray(idx?.device_ids) ? idx.device_ids : [];
  const loaded = await Promise.all(
    ids.map((id) => storageGetJson(env, `${STORAGE_PREFIX}/devices/${id}.json`)),
  );
  return { mode: 'storage', devices: loaded.filter((d) => d && d.user_id === userId) };
}

function summarizeDevice(d, currentDeviceId) {
  return {
    id: d.id,
    label: d.label || 'Trusted Device',
    current_device: Boolean(currentDeviceId && d.id === currentDeviceId),
    failed_attempts: Number(d.failed_attempts || 0),
    revoked_at: d.revoked_at || null,
    revoked_reason: d.revoked_reason || null,
    last_used_at: d.last_used_at || null,
    expires_at: d.expires_at,
    created_at: d.created_at,
  };
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

  const { key: serviceKey } = getSupabaseConfig(env);
  if (!serviceKey) {
    return json(request, 503, { ok: false, error: 'Admin quick login service is missing server credentials.' });
  }

  const cookies = parseCookies(request);
  const parsedCookie = parseDeviceCookieValue(cookies[COOKIE_NAME]);
  const urlObj = new URL(request.url);

  if (method === 'GET') {
    if (urlObj.searchParams.get('list') === '1') {
      const admin = await verifyAdminBearer(env, request);
      if (!admin) return json(request, 401, { ok: false, error: 'Unauthorized' });
      const { devices } = await listUserDevices(env, admin.id);
      const currentId = parsedCookie?.deviceId || null;
      return json(request, 200, {
        ok: true,
        devices: devices.map((d) => summarizeDevice(d, currentId)),
      });
    }

    if (!parsedCookie) {
      return json(request, 200, { ok: true, enrolled: false });
    }
    const found = await getDeviceRecord(env, parsedCookie.deviceId);
    if (!found) {
      return json(request, 200, { ok: true, enrolled: false });
    }
    const dev = found.record;
    const tokenMatch = safeEqualHex(await sha256Hex(parsedCookie.rawToken), dev.token_hash);
    const expired = !dev.expires_at || Date.parse(dev.expires_at) <= Date.now();
    const locked = Number(dev.failed_attempts || 0) >= MAX_ATTEMPTS;
    if (!tokenMatch || dev.revoked_at || expired || locked) {
      return json(request, 200, { ok: true, enrolled: false }, {
        'Set-Cookie': buildDeviceCookie(request, '', 0),
      });
    }
    const stillAdmin = await isUserAdmin(env, dev.user_id);
    if (!stillAdmin) {
      return json(request, 200, { ok: true, enrolled: false }, {
        'Set-Cookie': buildDeviceCookie(request, '', 0),
      });
    }
    return json(request, 200, {
      ok: true,
      enrolled: true,
      device_label: dev.label || 'Trusted Device',
      attempts_remaining: Math.max(0, MAX_ATTEMPTS - Number(dev.failed_attempts || 0)),
      expires_at: dev.expires_at,
    });
  }

  if (method === 'POST') {
    if (String(request.headers.get('x-requested-with') || '') !== 'ChoiceAdmin') {
      return json(request, 403, { ok: false, error: 'Invalid request header.' });
    }
    const admin = await verifyAdminBearer(env, request);
    if (!admin) return json(request, 401, { ok: false, error: 'Unauthorized' });

    const body = await request.json().catch(() => ({}));
    const pin = String(body.pin || '').trim();
    if (!PIN_RE.test(pin)) {
      return json(request, 400, { ok: false, error: 'Please choose exactly 2 numbers (00–99).' });
    }
    const label = sanitizeLabel(body.label);
    const mode = (await isSqlTableAvailable(env)) ? 'sql' : 'storage';

    if (parsedCookie) {
      const prev = await getDeviceRecord(env, parsedCookie.deviceId);
      if (prev && prev.record.user_id === admin.id && !prev.record.revoked_at) {
        prev.record.revoked_at = new Date().toISOString();
        prev.record.revoked_reason = 'replaced_by_new_enrollment';
        await saveDeviceRecord(env, prev.mode, prev.record, false);
      }
    }

    const deviceId = crypto.randomUUID();
    const rawTokenBytes = new Uint8Array(32);
    crypto.getRandomValues(rawTokenBytes);
    const rawToken = bytesToBase64Url(rawTokenBytes);

    const saltBytes = new Uint8Array(16);
    crypto.getRandomValues(saltBytes);
    const pinSalt = bytesToHex(saltBytes);

    const nowIso = new Date().toISOString();
    const expiresIso = new Date(Date.now() + DEVICE_TTL_DAYS * 86400 * 1000).toISOString();

    const record = {
      id: deviceId,
      user_id: admin.id,
      label,
      token_hash: await sha256Hex(rawToken),
      pin_hash: await hashPin(pin, pinSalt),
      pin_salt: pinSalt,
      failed_attempts: 0,
      revoked_at: null,
      revoked_reason: null,
      last_used_at: null,
      expires_at: expiresIso,
      created_at: nowIso,
    };

    const saved = await saveDeviceRecord(env, mode, record, true);
    if (!saved) {
      return json(request, 502, { ok: false, error: 'Could not save trusted device.' });
    }

    await logAdminAction(env, {
      userId: admin.id,
      action: 'admin_device_enrolled',
      targetId: deviceId,
      metadata: { label, expires_at: expiresIso },
    });

    const cookieHeader = buildDeviceCookie(request, `${deviceId}.${rawToken}`, DEVICE_TTL_DAYS * 86400);
    return json(request, 200, {
      ok: true,
      device: summarizeDevice(record, deviceId),
    }, {
      'Set-Cookie': cookieHeader,
    });
  }

  if (method === 'DELETE') {
    if (String(request.headers.get('x-requested-with') || '') !== 'ChoiceAdmin') {
      return json(request, 403, { ok: false, error: 'Invalid request header.' });
    }
    const admin = await verifyAdminBearer(env, request);
    if (!admin) return json(request, 401, { ok: false, error: 'Unauthorized' });

    const body = await request.json().catch(() => ({}));
    const revokeAll = body.all === true;
    const targetId = String(body.device_id || '').trim();
    const { mode, devices } = await listUserDevices(env, admin.id);
    const nowIso = new Date().toISOString();
    let revokedCurrent = false;
    let count = 0;

    for (const dev of devices) {
      if (dev.revoked_at) continue;
      if (revokeAll || (UUID_RE.test(targetId) && dev.id === targetId)) {
        dev.revoked_at = nowIso;
        dev.revoked_reason = revokeAll ? 'revoked_all_by_admin' : 'revoked_by_admin';
        await saveDeviceRecord(env, mode, dev, false);
        count++;
        if (parsedCookie && dev.id === parsedCookie.deviceId) {
          revokedCurrent = true;
        }
      }
    }

    await logAdminAction(env, {
      userId: admin.id,
      action: revokeAll ? 'admin_devices_revoked_all' : 'admin_device_revoked',
      targetId: revokeAll ? admin.id : targetId,
      metadata: { count },
    });

    const extra = revokedCurrent ? { 'Set-Cookie': buildDeviceCookie(request, '', 0) } : {};
    return json(request, 200, { ok: true, revoked_count: count }, extra);
  }

  return json(request, 405, { ok: false, error: 'Method not allowed' });
}
