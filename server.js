const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const PORT = parseInt(process.env.PORT || '5000', 10);
const ROOT = __dirname;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.createHash('sha256').update(process.env.DATABASE_URL || 'choice-properties-dev').digest('hex');
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;

const config = {
  API_BASE: '/api',
  SUPABASE_URL: '/api/compat',
  SUPABASE_ANON_KEY: 'replit-server-api',
  SITE_URL: (process.env.SITE_URL || '').replace(/\/$/, ''),
  APPLY_FORM_URL: (process.env.APPLY_FORM_URL || '').replace(/\/$/, ''),
  IMAGEKIT_URL: process.env.IMAGEKIT_URL || '',
  IMAGEKIT_PUBLIC_KEY: process.env.IMAGEKIT_PUBLIC_KEY || '',
  GEOAPIFY_API_KEY: process.env.GEOAPIFY_API_KEY || '',
  COMPANY_NAME: process.env.COMPANY_NAME || 'Choice Properties',
  COMPANY_EMAIL: process.env.COMPANY_EMAIL || 'hello@choiceproperties.com',
  COMPANY_PHONE: process.env.COMPANY_PHONE || '',
  COMPANY_TAGLINE: process.env.COMPANY_TAGLINE || 'Your trust is our standard.',
  COMPANY_ADDRESS: process.env.COMPANY_ADDRESS || '',
  LEASE_DEFAULT_LATE_FEE_FLAT: Number(process.env.LEASE_DEFAULT_LATE_FEE_FLAT) || 50,
  LEASE_DEFAULT_LATE_FEE_DAILY: Number(process.env.LEASE_DEFAULT_LATE_FEE_DAILY) || 10,
  LEASE_DEFAULT_EXPIRY_DAYS: Number(process.env.LEASE_DEFAULT_EXPIRY_DAYS) || 7,
  FEATURES: {
    CO_APPLICANT: process.env.FEATURE_CO_APPLICANT !== 'false',
    VEHICLE_INFO: process.env.FEATURE_VEHICLE_INFO !== 'false',
    DOCUMENT_UPLOAD: process.env.FEATURE_DOCUMENT_UPLOAD !== 'false',
    MESSAGING: process.env.FEATURE_MESSAGING !== 'false',
    REALTIME_UPDATES: process.env.FEATURE_REALTIME_UPDATES !== 'false',
  },
};

const configJs = `const CONFIG = ${JSON.stringify(config, null, 2)};
CONFIG.img = function(url, tr) {
  if (!url) return '/assets/placeholder-property.jpg';
  if (!CONFIG.IMAGEKIT_URL) return url;
  const transforms = { card:'tr:w-600,q-80,f-webp', card_2x:'tr:w-1200,q-80,f-webp', gallery:'tr:w-1200,q-90,f-webp', gallery_2x:'tr:w-2400,q-85,f-webp', strip:'tr:w-80,h-60,c-maintain_ratio,q-70,f-webp', thumb:'tr:w-120,h-120,c-maintain_ratio,q-75,f-webp', lightbox:'tr:q-95,f-webp', og:'tr:w-1200,h-630,c-force,fo-center,q-85,f-webp', avatar:'tr:w-80,h-80,c-force,fo-face,q-80,f-webp', avatar_lg:'tr:w-160,h-160,c-force,fo-face,q-85,f-webp' };
  const t = transforms[tr] || transforms.gallery;
  if (url.startsWith(CONFIG.IMAGEKIT_URL)) {
    const clean = url.replace(/\/tr:[^/]+/, '');
    return clean.replace(CONFIG.IMAGEKIT_URL, CONFIG.IMAGEKIT_URL + '/' + t);
  }
  return url;
};
CONFIG.srcset = function(url, tr1, tr2) { const u1 = CONFIG.img(url, tr1); const u2 = CONFIG.img(url, tr2); return !u1 ? '' : (!u2 || u2 === u1 ? u1 : u1 + ' 1x, ' + u2 + ' 2x'); };
Object.freeze(CONFIG); Object.freeze(CONFIG.FEATURES);`;

let navHtml = '';
let footerHtml = '';
try {
  navHtml = fs.readFileSync(path.join(ROOT, 'components/nav.html'), 'utf8');
  footerHtml = fs.readFileSync(path.join(ROOT, 'components/footer.html'), 'utf8');
  console.log('Nav + footer components loaded');
} catch (e) {
  console.warn('Could not read nav/footer components:', e.message);
}

const allowedTables = new Set(['admin_actions', 'admin_roles', 'applications', 'email_logs', 'inquiries', 'landlords', 'messages', 'properties', 'public_landlord_profiles', 'saved_properties']);
const allowedColumns = new Set(['id','user_id','email','created_at','updated_at','status','payment_status','lease_status','move_in_status','property_id','landlord_id','app_id','sender','sender_name','message','read','type','recipient','error_msg','tenant_name','tenant_email','tenant_phone','tenant_language','title','description','address','city','state','zip','county','lat','lng','property_type','bedrooms','bathrooms','monthly_rent','security_deposit','available_date','pets_allowed','pet_types_allowed','parking','heating_type','cooling_type','laundry_type','photo_urls','photo_file_ids','views_count','applications_count','saves_count','contact_name','business_name','avatar_url','verified','account_type','phone','plan','first_name','last_name','property_address','admin_notes','application_fee']);

function json(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 25 * 1024 * 1024) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function requireDb() {
  if (!pool) throw new Error('DATABASE_URL is not configured');
  return pool;
}

function cleanColumn(column) {
  const col = String(column || '').split('.').pop();
  if (!allowedColumns.has(col)) throw new Error(`Column not allowed: ${column}`);
  return col;
}

function cleanTable(table) {
  if (!allowedTables.has(table)) throw new Error(`Table not allowed: ${table}`);
  return table;
}

function signToken(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [encoded, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  if (payload.exp && payload.exp < Date.now()) return null;
  return payload;
}

function authPayload(req) {
  const header = req.headers.authorization || '';
  return verifyToken(header.replace(/^Bearer\s+/i, ''));
}

function addFilter(parts, params, filter) {
  if (!filter || !filter.column) return;
  const col = cleanColumn(filter.column);
  const type = filter.type || 'eq';
  if (type === 'eq') { params.push(filter.value); parts.push(`t.${col} = $${params.length}`); }
  else if (type === 'neq') { params.push(filter.value); parts.push(`t.${col} <> $${params.length}`); }
  else if (type === 'gte') { params.push(filter.value); parts.push(`t.${col} >= $${params.length}`); }
  else if (type === 'lte') { params.push(filter.value); parts.push(`t.${col} <= $${params.length}`); }
  else if (type === 'ilike') { params.push(filter.value); parts.push(`t.${col} ILIKE $${params.length}`); }
  else if (type === 'in') { params.push(filter.value || []); parts.push(`t.${col} = ANY($${params.length})`); }
  else if (type === 'contains') { params.push(filter.value || []); parts.push(`t.${col} @> $${params.length}`); }
  else if (type === 'not' && filter.operator === 'is') { parts.push(`t.${col} IS NOT NULL`); }
}

async function attachRelations(table, rows) {
  if (!rows.length) return rows;
  const db = requireDb();
  if (table === 'properties') {
    const ids = [...new Set(rows.map((r) => r.landlord_id).filter(Boolean))];
    if (ids.length) {
      const { rows: landlords } = await db.query('SELECT * FROM landlords WHERE id = ANY($1)', [ids]);
      const byId = new Map(landlords.map((l) => [String(l.id), l]));
      rows.forEach((r) => { r.landlords = byId.get(String(r.landlord_id)) || null; });
    } else rows.forEach((r) => { r.landlords = null; });
  }
  if (table === 'inquiries') {
    const ids = [...new Set(rows.map((r) => r.property_id).filter(Boolean))];
    if (ids.length) {
      const { rows: props } = await db.query('SELECT id,title,address,landlord_id FROM properties WHERE id = ANY($1)', [ids]);
      const byId = new Map(props.map((p) => [String(p.id), p]));
      rows.forEach((r) => { r.properties = byId.get(String(r.property_id)) || null; });
    }
  }
  if (table === 'messages') {
    const ids = [...new Set(rows.map((r) => r.app_id).filter(Boolean))];
    if (ids.length) {
      const { rows: apps } = await db.query('SELECT first_name,last_name,email,app_id FROM applications WHERE app_id = ANY($1)', [ids]);
      const byId = new Map(apps.map((a) => [String(a.app_id), a]));
      rows.forEach((r) => { r.applications = byId.get(String(r.app_id)) || null; });
    }
  }
  return rows;
}

async function handleQuery(req, res) {
  const body = await readBody(req);
  const table = cleanTable(body.table);
  const action = body.action || 'select';
  const db = requireDb();
  const params = [];
  const where = [];
  (body.filters || []).forEach((f) => addFilter(where, params, f));

  if (body.or) {
    if (String(body.or).includes('available_date.is.null') && String(body.or).includes('available_date.lte.')) {
      const date = String(body.or).split('available_date.lte.')[1]?.split(',')[0];
      params.push(date || new Date().toISOString().slice(0, 10));
      where.push(`(t.available_date IS NULL OR t.available_date <= $${params.length})`);
    }
  }
  if (body.textSearch?.column && body.textSearch?.term) {
    params.push(`%${body.textSearch.term}%`);
    where.push(`(t.title ILIKE $${params.length} OR t.address ILIKE $${params.length} OR t.city ILIKE $${params.length} OR t.state ILIKE $${params.length})`);
  }

  const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';

  if (action === 'insert') {
    const values = Array.isArray(body.values) ? body.values : [body.values];
    if (!values.length || !values[0]) return json(res, 400, { error: 'Insert payload required' });
    const inserted = [];
    for (const value of values) {
      const keys = Object.keys(value).filter((k) => allowedColumns.has(k));
      if (!keys.length) continue;
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
      const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders}) RETURNING *`;
      const result = await db.query(sql, keys.map((k) => value[k]));
      inserted.push(result.rows[0]);
    }
    return json(res, 200, { data: body.single ? inserted[0] || null : inserted });
  }

  if (action === 'update') {
    const values = body.values || {};
    const keys = Object.keys(values).filter((k) => allowedColumns.has(k));
    if (!keys.length) return json(res, 400, { error: 'Update payload required' });
    const setParams = keys.map((k) => values[k]);
    const setSql = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const shiftedWhere = where.map((clause) => clause.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + setParams.length}`));
    const sql = `UPDATE ${table} t SET ${setSql}, updated_at = COALESCE(t.updated_at, now())${shiftedWhere.length ? ` WHERE ${shiftedWhere.join(' AND ')}` : ''} RETURNING *`;
    const result = await db.query(sql, [...setParams, ...params]);
    return json(res, 200, { data: body.single || body.maybeSingle ? result.rows[0] || null : result.rows });
  }

  if (action === 'delete') {
    const result = await db.query(`DELETE FROM ${table} t${whereSql} RETURNING *`, params);
    return json(res, 200, { data: result.rows });
  }

  const countResult = body.count ? await db.query(`SELECT COUNT(*)::int AS count FROM ${table} t${whereSql}`, params) : null;
  if (body.head) return json(res, 200, { data: null, count: countResult?.rows?.[0]?.count || 0 });

  let sql = `SELECT t.* FROM ${table} t${whereSql}`;
  if (body.orderBy?.column) {
    const col = cleanColumn(body.orderBy.column);
    sql += ` ORDER BY t.${col} ${body.orderBy.ascending === true ? 'ASC' : 'DESC'}`;
  }
  if (body.range && Number.isInteger(body.range.from) && Number.isInteger(body.range.to)) {
    params.push(body.range.to - body.range.from + 1, body.range.from);
    sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
  } else if (body.limit) {
    params.push(Math.min(Number(body.limit), 500));
    sql += ` LIMIT $${params.length}`;
  }

  const result = await db.query(sql, params);
  const rows = await attachRelations(table, result.rows);
  const data = body.single || body.maybeSingle ? rows[0] || null : rows;
  return json(res, 200, { data, count: countResult?.rows?.[0]?.count ?? null });
}

async function handleRpc(req, res) {
  const body = await readBody(req);
  const db = requireDb();
  if (body.name === 'generate_property_id') {
    return json(res, 200, { data: `PROP-${crypto.randomBytes(4).toString('hex').toUpperCase()}` });
  }
  if (body.name === 'increment_counter') {
    const table = cleanTable(body.args?.p_table);
    const id = body.args?.p_id;
    const column = cleanColumn(body.args?.p_column);
    if (!['views_count', 'applications_count', 'saves_count'].includes(column)) throw new Error('Counter column not allowed');
    await db.query(`UPDATE ${table} SET ${column} = COALESCE(${column}, 0) + 1 WHERE id = $1`, [id]);
    return json(res, 200, { data: true });
  }
  return json(res, 404, { error: 'RPC not implemented' });
}

async function sendEmail(payload) {
  const gasUrl = process.env.GAS_EMAIL_URL;
  const gasSecret = process.env.GAS_RELAY_SECRET;
  if (!gasUrl || !gasSecret || !payload.template) return { ok: false, provider: 'none', error: 'Email relay not configured' };
  const response = await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: gasSecret, ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok && data.success !== false, provider: 'gas', error: data.error || null };
}

async function handleEdge(req, res, name) {
  const body = await readBody(req);
  const db = requireDb();
  if (name === 'send-inquiry') {
    if (body.type === 'new_inquiry') {
      const message = String(body.message || '');
      if (!body.tenant_email || !message) return json(res, 400, { success: false, error: 'tenant_email and message required' });
      if (/https?:\/\/\S+|www\.\S+/i.test(message)) return json(res, 400, { success: false, error: 'Messages may not contain links.' });
      const payload = body.insert_payload && typeof body.insert_payload === 'object' ? body.insert_payload : body;
      await db.query('INSERT INTO inquiries (property_id, tenant_name, tenant_email, tenant_phone, tenant_language, message) VALUES ($1,$2,$3,$4,$5,$6)', [payload.property_id || null, payload.tenant_name || 'Tenant', payload.tenant_email, payload.tenant_phone || null, payload.tenant_language || 'en', payload.message || message]);
      const emailResult = await sendEmail({ template: 'inquiry_reply', to: body.tenant_email, data: { name: body.tenant_name, message, preferred_language: body.tenant_language || 'en' } }).catch((e) => ({ ok: false, error: e.message }));
      await db.query('INSERT INTO email_logs (type, recipient, status, error_msg) VALUES ($1,$2,$3,$4)', ['inquiry_reply', body.tenant_email, emailResult.ok ? 'sent' : 'skipped', emailResult.error || null]);
      return json(res, 200, { success: true });
    }
    return json(res, 200, { success: true, warning: 'Email action accepted' });
  }

  if (name === 'send-message') {
    await db.query('INSERT INTO messages (app_id, sender, sender_name, message) VALUES ($1,$2,$3,$4)', [body.app_id, body.sender || 'admin', body.sender_name || 'Choice Properties', body.message]);
    return json(res, 200, { success: true });
  }

  if (name === 'imagekit-upload') {
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    if (!privateKey) return json(res, 500, { success: false, error: 'ImageKit private key is not configured' });
    const { fileData, fileName, folder } = body;
    if (!fileData || !fileName) return json(res, 400, { success: false, error: 'fileData and fileName required' });
    const safeFileName = String(fileName).replace(/[\/\\?%*:|"<>]/g, '_').replace(/\.{2,}/g, '_');
    const ext = safeFileName.split('.').pop().toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return json(res, 400, { success: false, error: 'Unsupported image type' });
    const base64Raw = String(fileData).includes(',') ? String(fileData).split(',')[1] : String(fileData);
    const binary = Uint8Array.from(Buffer.from(base64Raw, 'base64'));
    const form = new FormData();
    form.append('file', new Blob([binary], { type: 'image/jpeg' }), safeFileName);
    form.append('fileName', safeFileName);
    if (folder) form.append('folder', folder);
    const response = await fetch('https://upload.imagekit.io/api/v1/files/upload', { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString('base64')}` }, body: form });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return json(res, 502, { success: false, error: data.message || `ImageKit error ${response.status}` });
    return json(res, 200, { success: true, url: data.url, fileId: data.fileId || null });
  }

  if (name === 'imagekit-delete') {
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    if (!privateKey) return json(res, 500, { success: false, error: 'ImageKit private key is not configured' });
    if (!body.fileId) return json(res, 400, { success: false, error: 'fileId is required' });
    const response = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(body.fileId)}`, { method: 'DELETE', headers: { Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString('base64')}` } });
    if (!response.ok && response.status !== 404) return json(res, 502, { success: false, error: `ImageKit error ${response.status}` });
    return json(res, 200, { success: true });
  }

  return json(res, 404, { success: false, error: 'Function not found' });
}

async function handleAuth(req, res, pathName) {
  const db = requireDb();
  if (pathName === '/api/auth/session' || pathName === '/api/auth/user') {
    const payload = authPayload(req);
    if (!payload) return json(res, 200, { user: null, session: null });
    return json(res, 200, { user: { id: payload.id, email: payload.email, user_metadata: payload.user_metadata || {} }, session: { access_token: req.headers.authorization?.replace(/^Bearer\s+/i, ''), user: payload } });
  }
  if (pathName === '/api/auth/sign-out') return json(res, 200, { success: true });
  const body = await readBody(req);
  if (pathName === '/api/auth/sign-up') {
    const id = crypto.randomUUID();
    const profile = body.profile || {};
    await db.query('INSERT INTO app_users (id,email,role,user_metadata) VALUES ($1,$2,$3,$4)', [id, body.email, 'landlord', profile]);
    await db.query('INSERT INTO landlords (user_id,email,contact_name,business_name,phone,account_type,avatar_url) VALUES ($1,$2,$3,$4,$5,$6,$7)', [id, body.email, profile.contact_name || '', profile.business_name || null, profile.phone || null, profile.account_type || 'landlord', profile.avatar_url || null]);
    const token = signToken({ id, email: body.email, role: 'landlord', user_metadata: profile, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
    return json(res, 200, { user: { id, email: body.email, user_metadata: profile }, session: { access_token: token } });
  }
  if (pathName === '/api/auth/sign-in') {
    const { rows } = await db.query('SELECT * FROM app_users WHERE email = $1', [body.email]);
    let user = rows[0];
    const adminOk = process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD && body.email === process.env.ADMIN_EMAIL && body.password === process.env.ADMIN_PASSWORD;
    if (!user && adminOk) {
      const id = crypto.randomUUID();
      await db.query('INSERT INTO app_users (id,email,role) VALUES ($1,$2,$3)', [id, body.email, 'admin']);
      await db.query('INSERT INTO admin_roles (user_id,email) VALUES ($1,$2) ON CONFLICT (email) DO NOTHING', [id, body.email]);
      user = { id, email: body.email, role: 'admin', user_metadata: {} };
    }
    if (!user) return json(res, 401, { error: 'Invalid email or password' });
    const token = signToken({ id: user.id, email: user.email, role: user.role, user_metadata: user.user_metadata || {}, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
    return json(res, 200, { user: { id: user.id, email: user.email, user_metadata: user.user_metadata || {} }, session: { access_token: token } });
  }
  return json(res, 404, { error: 'Auth route not found' });
}

let propertyCache = null;
let propertyCacheTime = 0;
async function fetchListingsFromDatabase() {
  if (!pool) return null;
  try {
    const { rows } = await pool.query("SELECT * FROM properties WHERE status = 'active' ORDER BY created_at DESC LIMIT 24");
    await attachRelations('properties', rows);
    const count = await pool.query("SELECT COUNT(*)::int AS count FROM properties WHERE status = 'active'");
    return { rows, total: count.rows[0].count, page: 1, per_page: 24, total_pages: Math.ceil(count.rows[0].count / 24) };
  } catch (e) {
    console.warn('Property cache fetch failed:', e.message);
    return null;
  }
}
async function refreshPropertyCache() {
  const data = await fetchListingsFromDatabase();
  if (data) { propertyCache = data; propertyCacheTime = Date.now(); }
}
refreshPropertyCache();
setInterval(refreshPropertyCache, 3 * 60 * 1000);

function injectIntoHtml(html, filePath) {
  if (navHtml) html = html.replace(/<div\s+id="site-nav"\s*><\/div>/g, `<div id="site-nav" data-server-injected="1">${navHtml}</div>`);
  if (footerHtml) html = html.replace(/<div\s+id="site-footer"\s*><\/div>/g, `<div id="site-footer" data-server-injected="1">${footerHtml}</div>`);
  if (filePath.endsWith('listings.html') && propertyCache) {
    html = html.replace(/<script[^>]*>window\.__INITIAL_LISTINGS__[\s\S]*?<\/script>\n?/g, '');
    html = html.replace('</head>', `<script>window.__INITIAL_LISTINGS__=${JSON.stringify(propertyCache)};window.__INITIAL_LISTINGS_TS__=${propertyCacheTime};</script>\n</head>`);
  }
  return html;
}

const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.ico':'image/x-icon', '.woff':'font/woff', '.woff2':'font/woff2', '.ttf':'font/ttf', '.txt':'text/plain; charset=utf-8', '.xml':'application/xml; charset=utf-8', '.webmanifest':'application/manifest+json' };
function cacheHeader(ext) {
  if (ext === '.html') return 'no-cache';
  if (['.css','.js','.woff','.woff2','.ttf','.svg','.png','.jpg','.jpeg','.webp','.ico'].includes(ext)) return 'public, max-age=31536000, immutable';
  return 'public, max-age=3600';
}
function serveFile(res, filePath, statusCode = 200) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  if (ext === '.html') {
    const html = injectIntoHtml(fs.readFileSync(filePath, 'utf8'), filePath);
    res.writeHead(statusCode, { 'Content-Type': mime, 'Cache-Control': cacheHeader(ext) });
    return res.end(html);
  }
  res.writeHead(statusCode, { 'Content-Type': mime, 'Cache-Control': cacheHeader(ext) });
  res.end(fs.readFileSync(filePath));
}

async function route(req, res) {
  const parsed = new URL(req.url, `http://${req.headers.host}`);
  const urlPath = decodeURIComponent(parsed.pathname);
  try {
    if (req.method === 'OPTIONS') return json(res, 200, { ok: true });
    if (urlPath === '/config.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(configJs);
    }
    if (urlPath === '/api/query' && req.method === 'POST') return await handleQuery(req, res);
    if (urlPath === '/api/rpc' && req.method === 'POST') return await handleRpc(req, res);
    if (urlPath.startsWith('/api/edge/') && req.method === 'POST') return await handleEdge(req, res, urlPath.split('/').pop());
    if (urlPath.startsWith('/api/compat/functions/v1/') && req.method === 'POST') return await handleEdge(req, res, urlPath.split('/').pop());
    if (urlPath.startsWith('/api/auth/')) return await handleAuth(req, res, urlPath);
    if (urlPath === '/api/health') return json(res, 200, { ok: true, database: !!pool });
    if (urlPath === '/favicon.ico' || urlPath === '/apple-touch-icon.png' || urlPath === '/apple-touch-icon-precomposed.png') {
      res.writeHead(302, { Location: '/assets/favicon.svg' });
      return res.end();
    }

    let filePath = path.normalize(path.join(ROOT, urlPath));
    if (!filePath.startsWith(ROOT)) return res.writeHead(403).end('Forbidden');
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
    if (!fs.existsSync(filePath) && !path.extname(urlPath)) {
      const withHtml = filePath + '.html';
      if (fs.existsSync(withHtml)) filePath = withHtml;
    }
    if (!fs.existsSync(filePath)) {
      const notFound = path.join(ROOT, '404.html');
      return serveFile(res, fs.existsSync(notFound) ? notFound : path.join(ROOT, 'index.html'), 404);
    }
    serveFile(res, filePath);
  } catch (err) {
    console.error('Request failed:', err);
    json(res, err.message && err.message.includes('not configured') ? 503 : 500, { error: err.message || 'Server error' });
  }
}

const server = http.createServer((req, res) => route(req, res));
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Choice Properties server running on port ${PORT}`);
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'set' : 'missing'}`);
  console.log(`IMAGEKIT_URL: ${config.IMAGEKIT_URL ? 'set' : 'missing'}`);
  console.log(`GEOAPIFY_API_KEY: ${config.GEOAPIFY_API_KEY ? 'set' : 'missing'}`);
});
