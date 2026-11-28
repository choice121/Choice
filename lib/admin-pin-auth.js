/**
 * Choice Properties — Device-Bound 2-Digit Admin Quick PIN Auth (Node / Dev Server)
 * Routes:
 *   GET    /api/admin/trusted-devices        -> check current cookie enrollment (no PII) or ?list=1 (auth admin)
 *   POST   /api/admin/trusted-devices        -> enroll current device for logged-in admin
 *   DELETE /api/admin/trusted-devices        -> revoke one or all devices for logged-in admin
 *   POST   /api/admin/pin-login              -> verify HttpOnly device cookie + 2-digit PIN, mint Supabase session OTP
 */

const crypto = require('crypto');
const path = require('path');

const SUPABASE_URL = String(process.env.SUPABASE_URL || 'https://tlfmwetmhthpyrytrcfo.supabase.co').replace(/\/$/, '');
const COOKIE_NAME = 'cp_admin_device';
const STORAGE_BUCKET = 'application-docs';
const STORAGE_PREFIX = '_admin_trusted_devices';
const MAX_ATTEMPTS = 3;
const DEVICE_TTL_DAYS = 30;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PIN_RE = /^\d{2}$/;

let _cachedServiceKey = null;
async function getServiceKey() {
  const envKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (envKey) return envKey;
  if (_cachedServiceKey) return _cachedServiceKey;
  try {
    const mod = await import(path.join(process.cwd(), 'credentials-config.mjs'));
    const cfgKey = String(mod?.CREDENTIALS_CONFIG?.SUPABASE_API_KEY || '').trim();
    if (cfgKey) {
      _cachedServiceKey = cfgKey;
      return cfgKey;
    }
  } catch (_) {}
  return '';
}

function getRequestHost(req) {
  return String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase();
}

function isHttpsRequest(req) {
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  if (proto === 'https') return true;
  if (req.socket && req.socket.encrypted) return true;
  const origin = String(req.headers.origin || '').toLowerCase();
  return origin.startsWith('https://');
}

function checkSameOrigin(req) {
  const origin = String(req.headers.origin || '').trim();
  if (!origin) return { ok: true, origin: '' };
  try {
    const parsed = new URL(origin);
    const reqHost = getRequestHost(req);
    if (!reqHost || parsed.host.toLowerCase() !== reqHost) {
      return { ok: false, origin };
    }
    return { ok: true, origin: parsed.origin };
  } catch (_) {
    return { ok: false, origin };
  }
}

function json(req, res, statusCode, body, extraHeaders = {}) {
  const originCheck = checkSameOrigin(req);
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
  res.writeHead(statusCode, headers);
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 65536) req.destroy(new Error('Payload too large'));
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (_) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function parseCookies(req) {
  const header = String(req.headers.cookie || '');
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

function buildDeviceCookie(req, value, maxAgeSeconds) {
  const secure = isHttpsRequest(req);
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
    'HttpOnly',
  ];
  if (secure) {
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

function sha256Hex(str) {
  return crypto.createHash('sha256').update(String(str)).digest('hex');
}

function hashPin(pin, saltHex) {
  return crypto.pbkdf2Sync(String(pin), Buffer.from(saltHex, 'hex'), 100000, 32, 'sha256').toString('hex');
}

function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || a.length === 0) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch (_) {
    return false;
  }
}

function sanitizeLabel(raw) {
  const clean = String(raw || '').replace(/[\r\n\t<>]/g, ' ').replace(/\s+/g, ' ').trim();
  return (clean || 'Trusted Device').slice(0, 60);
}

async function sbFetch(serviceKey, relPath, init = {}) {
  return fetch(`${SUPABASE_URL}${relPath}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

async function verifyAdminBearer(serviceKey, req) {
  const authHeader = String(req.headers.authorization || '');
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!jwt) return null;

  const userRes = await sbFetch(serviceKey, '/auth/v1/user', {
    method: 'GET',
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!userRes.ok) return null;
  const user = await userRes.json().catch(() => null);
  if (!user?.id || !UUID_RE.test(user.id)) return null;

  const roleRes = await sbFetch(
    serviceKey,
    `/rest/v1/admin_roles?user_id=eq.${encodeURIComponent(user.id)}&select=id&limit=1`,
  );
  if (!roleRes.ok) return null;
  const roles = await roleRes.json().catch(() => []);
  if (!Array.isArray(roles) || roles.length === 0) return null;

  return { id: user.id, email: String(user.email || '').trim().toLowerCase() };
}

async function isUserAdmin(serviceKey, userId) {
  if (!UUID_RE.test(String(userId || ''))) return false;
  const roleRes = await sbFetch(
    serviceKey,
    `/rest/v1/admin_roles?user_id=eq.${encodeURIComponent(userId)}&select=id&limit=1`,
  );
  if (!roleRes.ok) return false;
  const roles = await roleRes.json().catch(() => []);
  return Array.isArray(roles) && roles.length > 0;
}

async function logAdminAction(serviceKey, { userId, action, targetId, metadata }) {
  try {
    await sbFetch(serviceKey, '/rest/v1/admin_actions', {
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

// ── Persistence layer: primary SQL table `admin_trusted_devices`,
//    with automatic private Storage bucket fallback if migration is pending ──
async function isSqlTableAvailable(serviceKey) {
  const r = await sbFetch(serviceKey, '/rest/v1/admin_trusted_devices?select=id&limit=1');
  return r.ok;
}

async function storageGetJson(serviceKey, objPath) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${objPath}?cb=${Date.now()}`, {
    method: 'GET',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Cache-Control': 'no-cache, no-store',
    },
  });
  if (!r.ok) return null;
  return r.json().catch(() => null);
}

async function storagePutJson(serviceKey, objPath, data) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${objPath}`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      'x-upsert': 'true',
      'cache-control': '0',
    },
    body: JSON.stringify(data),
  });
  return r.ok;
}

async function getDeviceRecord(serviceKey, deviceId) {
  if (!UUID_RE.test(String(deviceId || ''))) return null;
  if (await isSqlTableAvailable(serviceKey)) {
    const r = await sbFetch(
      serviceKey,
      `/rest/v1/admin_trusted_devices?id=eq.${encodeURIComponent(deviceId)}&select=*&limit=1`,
    );
    if (!r.ok) return null;
    const rows = await r.json().catch(() => []);
    return Array.isArray(rows) && rows[0] ? { mode: 'sql', record: rows[0] } : null;
  }
  const rec = await storageGetJson(serviceKey, `${STORAGE_PREFIX}/devices/${deviceId}.json`);
  return rec ? { mode: 'storage', record: rec } : null;
}

async function saveDeviceRecord(serviceKey, mode, record, isNew = false) {
  if (mode === 'sql') {
    if (isNew) {
      const r = await sbFetch(serviceKey, '/rest/v1/admin_trusted_devices', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(record),
      });
      return r.ok;
    }
    const r = await sbFetch(
      serviceKey,
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

  const ok = await storagePutJson(serviceKey, `${STORAGE_PREFIX}/devices/${record.id}.json`, record);
  if (!ok) return false;
  if (isNew) {
    const idxPath = `${STORAGE_PREFIX}/users/${record.user_id}.json`;
    const idx = (await storageGetJson(serviceKey, idxPath)) || { device_ids: [] };
    const ids = Array.isArray(idx.device_ids) ? idx.device_ids.filter((x) => UUID_RE.test(String(x))) : [];
    if (!ids.includes(record.id)) ids.unshift(record.id);
    await storagePutJson(serviceKey, idxPath, { device_ids: ids.slice(0, 20) });
  }
  return true;
}

async function listUserDevices(serviceKey, userId) {
  if (!UUID_RE.test(String(userId || ''))) return { mode: 'sql', devices: [] };
  if (await isSqlTableAvailable(serviceKey)) {
    const r = await sbFetch(
      serviceKey,
      `/rest/v1/admin_trusted_devices?user_id=eq.${encodeURIComponent(userId)}&select=id,user_id,label,failed_attempts,revoked_at,revoked_reason,last_used_at,expires_at,created_at&order=created_at.desc&limit=20`,
    );
    const rows = r.ok ? await r.json().catch(() => []) : [];
    return { mode: 'sql', devices: Array.isArray(rows) ? rows : [] };
  }
  const idx = await storageGetJson(serviceKey, `${STORAGE_PREFIX}/users/${userId}.json`);
  const ids = Array.isArray(idx?.device_ids) ? idx.device_ids : [];
  const loaded = await Promise.all(
    ids.map((id) => storageGetJson(serviceKey, `${STORAGE_PREFIX}/devices/${id}.json`)),
  );
  return {
    mode: 'storage',
    devices: loaded.filter((d) => d && d.user_id === userId),
  };
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

async function handleTrustedDevices(req, res, urlObj, serviceKey) {
  const method = req.method.toUpperCase();
  const cookies = parseCookies(req);
  const parsedCookie = parseDeviceCookieValue(cookies[COOKIE_NAME]);

  if (method === 'GET') {
    const wantsList = urlObj.searchParams.get('list') === '1';
    if (wantsList) {
      const admin = await verifyAdminBearer(serviceKey, req);
      if (!admin) return json(req, res, 401, { ok: false, error: 'Unauthorized' });
      const { devices } = await listUserDevices(serviceKey, admin.id);
      const currentId = parsedCookie?.deviceId || null;
      return json(req, res, 200, {
        ok: true,
        devices: devices.map((d) => summarizeDevice(d, currentId)),
      });
    }

    // Anonymous cookie check for /admin/login.html — never returns PII
    if (!parsedCookie) {
      return json(req, res, 200, { ok: true, enrolled: false });
    }
    const found = await getDeviceRecord(serviceKey, parsedCookie.deviceId);
    if (!found) {
      return json(req, res, 200, { ok: true, enrolled: false });
    }
    const dev = found.record;
    const tokenMatch = safeEqualHex(sha256Hex(parsedCookie.rawToken), dev.token_hash);
    const expired = !dev.expires_at || Date.parse(dev.expires_at) <= Date.now();
    const locked = Number(dev.failed_attempts || 0) >= MAX_ATTEMPTS;
    if (!tokenMatch || dev.revoked_at || expired || locked) {
      return json(req, res, 200, {
        ok: true,
        enrolled: false,
      }, {
        'Set-Cookie': buildDeviceCookie(req, '', 0),
      });
    }
    const stillAdmin = await isUserAdmin(serviceKey, dev.user_id);
    if (!stillAdmin) {
      return json(req, res, 200, { ok: true, enrolled: false }, {
        'Set-Cookie': buildDeviceCookie(req, '', 0),
      });
    }
    return json(req, res, 200, {
      ok: true,
      enrolled: true,
      device_label: dev.label || 'Trusted Device',
      attempts_remaining: Math.max(0, MAX_ATTEMPTS - Number(dev.failed_attempts || 0)),
      expires_at: dev.expires_at,
    });
  }

  if (method === 'POST') {
    if (String(req.headers['x-requested-with'] || '') !== 'ChoiceAdmin') {
      return json(req, res, 403, { ok: false, error: 'Invalid request header.' });
    }
    const admin = await verifyAdminBearer(serviceKey, req);
    if (!admin) return json(req, res, 401, { ok: false, error: 'Unauthorized' });

    const body = await readBody(req);
    const pin = String(body.pin || '').trim();
    if (!PIN_RE.test(pin)) {
      return json(req, res, 400, { ok: false, error: 'Please choose exactly 2 numbers (00–99).' });
    }
    const label = sanitizeLabel(body.label);
    const mode = (await isSqlTableAvailable(serviceKey)) ? 'sql' : 'storage';

    // If this browser already had an active device cookie for this user, revoke the old one cleanly
    if (parsedCookie) {
      const prev = await getDeviceRecord(serviceKey, parsedCookie.deviceId);
      if (prev && prev.record.user_id === admin.id && !prev.record.revoked_at) {
        prev.record.revoked_at = new Date().toISOString();
        prev.record.revoked_reason = 'replaced_by_new_enrollment';
        await saveDeviceRecord(serviceKey, prev.mode, prev.record, false);
      }
    }

    const deviceId = crypto.randomUUID();
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const pinSalt = crypto.randomBytes(16).toString('hex');
    const nowIso = new Date().toISOString();
    const expiresIso = new Date(Date.now() + DEVICE_TTL_DAYS * 86400 * 1000).toISOString();

    const record = {
      id: deviceId,
      user_id: admin.id,
      label,
      token_hash: sha256Hex(rawToken),
      pin_hash: hashPin(pin, pinSalt),
      pin_salt: pinSalt,
      failed_attempts: 0,
      revoked_at: null,
      revoked_reason: null,
      last_used_at: null,
      expires_at: expiresIso,
      created_at: nowIso,
    };

    const saved = await saveDeviceRecord(serviceKey, mode, record, true);
    if (!saved) {
      return json(req, res, 502, { ok: false, error: 'Could not save trusted device.' });
    }

    await logAdminAction(serviceKey, {
      userId: admin.id,
      action: 'admin_device_enrolled',
      targetId: deviceId,
      metadata: { label, expires_at: expiresIso },
    });

    const cookieHeader = buildDeviceCookie(req, `${deviceId}.${rawToken}`, DEVICE_TTL_DAYS * 86400);
    return json(req, res, 200, {
      ok: true,
      device: summarizeDevice(record, deviceId),
    }, {
      'Set-Cookie': cookieHeader,
    });
  }

  if (method === 'DELETE') {
    if (String(req.headers['x-requested-with'] || '') !== 'ChoiceAdmin') {
      return json(req, res, 403, { ok: false, error: 'Invalid request header.' });
    }
    const admin = await verifyAdminBearer(serviceKey, req);
    if (!admin) return json(req, res, 401, { ok: false, error: 'Unauthorized' });

    const body = await readBody(req);
    const revokeAll = body.all === true;
    const targetId = String(body.device_id || '').trim();
    const { mode, devices } = await listUserDevices(serviceKey, admin.id);
    const nowIso = new Date().toISOString();
    let revokedCurrent = false;
    let count = 0;

    for (const dev of devices) {
      if (dev.revoked_at) continue;
      if (revokeAll || (UUID_RE.test(targetId) && dev.id === targetId)) {
        dev.revoked_at = nowIso;
        dev.revoked_reason = revokeAll ? 'revoked_all_by_admin' : 'revoked_by_admin';
        await saveDeviceRecord(serviceKey, mode, dev, false);
        count++;
        if (parsedCookie && dev.id === parsedCookie.deviceId) {
          revokedCurrent = true;
        }
      }
    }

    await logAdminAction(serviceKey, {
      userId: admin.id,
      action: revokeAll ? 'admin_devices_revoked_all' : 'admin_device_revoked',
      targetId: revokeAll ? admin.id : targetId,
      metadata: { count },
    });

    const extra = revokedCurrent ? { 'Set-Cookie': buildDeviceCookie(req, '', 0) } : {};
    return json(req, res, 200, { ok: true, revoked_count: count }, extra);
  }

  return json(req, res, 405, { ok: false, error: 'Method not allowed' });
}

async function handlePinLogin(req, res, serviceKey) {
  const method = req.method.toUpperCase();
  if (method !== 'POST') {
    return json(req, res, 405, { ok: false, error: 'Method not allowed' });
  }
  if (String(req.headers['x-requested-with'] || '') !== 'ChoiceAdmin') {
    return json(req, res, 403, { ok: false, error: 'Invalid request header.' });
  }

  const cookies = parseCookies(req);
  const parsedCookie = parseDeviceCookieValue(cookies[COOKIE_NAME]);
  if (!parsedCookie) {
    return json(req, res, 401, {
      ok: false,
      enrolled: false,
      error: 'This device is not enrolled for Quick PIN login.',
    });
  }

  const body = await readBody(req);
  const pin = String(body.pin || '').trim();
  if (!PIN_RE.test(pin)) {
    return json(req, res, 400, { ok: false, error: 'Enter 2 numbers.' });
  }

  const found = await getDeviceRecord(serviceKey, parsedCookie.deviceId);
  if (!found) {
    return json(req, res, 401, {
      ok: false,
      enrolled: false,
      error: 'This device is not enrolled for Quick PIN login.',
    }, {
      'Set-Cookie': buildDeviceCookie(req, '', 0),
    });
  }

  const { mode, record: dev } = found;
  // Verify secret device token BEFORE touching failed_attempts
  if (!safeEqualHex(sha256Hex(parsedCookie.rawToken), dev.token_hash)) {
    return json(req, res, 401, {
      ok: false,
      enrolled: false,
      error: 'Device verification failed. Please sign in with your email and password.',
    }, {
      'Set-Cookie': buildDeviceCookie(req, '', 0),
    });
  }

  if (dev.revoked_at || !dev.expires_at || Date.parse(dev.expires_at) <= Date.now()) {
    return json(req, res, 401, {
      ok: false,
      enrolled: false,
      locked: true,
      error: 'Quick PIN has expired or been revoked on this device. Please sign in with your email and password.',
    }, {
      'Set-Cookie': buildDeviceCookie(req, '', 0),
    });
  }

  const stillAdmin = await isUserAdmin(serviceKey, dev.user_id);
  if (!stillAdmin) {
    dev.revoked_at = new Date().toISOString();
    dev.revoked_reason = 'admin_role_removed';
    await saveDeviceRecord(serviceKey, mode, dev, false);
    return json(req, res, 403, {
      ok: false,
      enrolled: false,
      locked: true,
      error: 'Access denied — this account no longer has admin privileges.',
    }, {
      'Set-Cookie': buildDeviceCookie(req, '', 0),
    });
  }

  const candidateHash = hashPin(pin, dev.pin_salt);
  if (!safeEqualHex(candidateHash, dev.pin_hash)) {
    const nextAttempts = Number(dev.failed_attempts || 0) + 1;
    dev.failed_attempts = nextAttempts;

    if (nextAttempts >= MAX_ATTEMPTS) {
      dev.revoked_at = new Date().toISOString();
      dev.revoked_reason = 'max_failed_attempts';
      await saveDeviceRecord(serviceKey, mode, dev, false);
      await logAdminAction(serviceKey, {
        userId: dev.user_id,
        action: 'admin_pin_lockout',
        targetId: dev.id,
        metadata: { failed_attempts: nextAttempts },
      });
      return json(req, res, 423, {
        ok: false,
        enrolled: false,
        locked: true,
        attempts_remaining: 0,
        error: 'Too many wrong taps. Quick PIN has been disabled on this device — please sign in with your email and password.',
      }, {
        'Set-Cookie': buildDeviceCookie(req, '', 0),
      });
    }

    await saveDeviceRecord(serviceKey, mode, dev, false);
    await logAdminAction(serviceKey, {
      userId: dev.user_id,
      action: 'admin_pin_failed',
      targetId: dev.id,
      metadata: { failed_attempts: nextAttempts },
    });
    const remaining = MAX_ATTEMPTS - nextAttempts;
    return json(req, res, 401, {
      ok: false,
      enrolled: true,
      locked: false,
      attempts_remaining: remaining,
      error: `Incorrect numbers. ${remaining} attempt${remaining === 1 ? '' : 's'} left before this device is locked.`,
    });
  }

  // PIN matched — fetch authoritative user email and generate magic-link OTP hash
  const userRes = await sbFetch(serviceKey, `/auth/v1/admin/users/${encodeURIComponent(dev.user_id)}`);
  if (!userRes.ok) {
    return json(req, res, 502, { ok: false, error: 'Could not verify admin account.' });
  }
  const userData = await userRes.json().catch(() => null);
  const adminEmail = String(userData?.email || '').trim().toLowerCase();
  if (!adminEmail) {
    return json(req, res, 502, { ok: false, error: 'Admin account email unavailable.' });
  }

  const linkRes = await sbFetch(serviceKey, '/auth/v1/admin/generate_link', {
    method: 'POST',
    body: JSON.stringify({ type: 'magiclink', email: adminEmail }),
  });
  const linkData = await linkRes.json().catch(() => ({}));
  const tokenHash = String(linkData?.hashed_token || linkData?.properties?.hashed_token || '').trim();
  const verificationType = String(linkData?.verification_type || linkData?.properties?.verification_type || 'magiclink').trim();
  if (!linkRes.ok || !tokenHash) {
    return json(req, res, 502, { ok: false, error: 'Could not issue admin session.' });
  }

  dev.failed_attempts = 0;
  dev.last_used_at = new Date().toISOString();
  await saveDeviceRecord(serviceKey, mode, dev, false);

  await logAdminAction(serviceKey, {
    userId: dev.user_id,
    action: 'admin_pin_login',
    targetId: dev.id,
    metadata: { label: dev.label },
  });

  return json(req, res, 200, {
    ok: true,
    token_hash: tokenHash,
    verification_type: verificationType || 'magiclink',
  });
}

async function handleAdminPinApi(req, res) {
  const originCheck = checkSameOrigin(req);
  if (!originCheck.ok) {
    return json(req, res, 403, { ok: false, error: 'Origin not allowed.' });
  }

  const urlObj = new URL(req.url, 'http://localhost');
  if (req.method.toUpperCase() === 'OPTIONS') {
    return json(req, res, 200, { ok: true });
  }

  const serviceKey = await getServiceKey();
  if (!serviceKey) {
    return json(req, res, 503, { ok: false, error: 'Admin quick login service is missing server credentials.' });
  }

  if (urlObj.pathname === '/api/admin/trusted-devices') {
    return handleTrustedDevices(req, res, urlObj, serviceKey);
  }
  if (urlObj.pathname === '/api/admin/pin-login') {
    return handlePinLogin(req, res, serviceKey);
  }
  return json(req, res, 404, { ok: false, error: 'Not found' });
}

module.exports = { handleAdminPinApi };
