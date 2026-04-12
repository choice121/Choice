let _client = null;

function _ok(data, error) {
  if (error) return { ok: false, data: null, error: error.message || String(error) };
  return { ok: true, data: data ?? null, error: null };
}

function apiBase() {
  return (window.CONFIG && CONFIG.API_BASE) || '/api';
}

function storedSession() {
  try { return JSON.parse(localStorage.getItem('cp_session') || 'null'); } catch { return null; }
}

function storeSession(session) {
  if (session?.access_token) localStorage.setItem('cp_session', JSON.stringify(session));
  else localStorage.removeItem('cp_session');
}

async function postJson(url, payload, token = null) {
  const session = storedSession();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token || session?.access_token ? { Authorization: `Bearer ${token || session.access_token}` } : {}),
    },
    body: JSON.stringify(payload || {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || json.message || `HTTP ${res.status}`);
  return json;
}

class QueryBuilder {
  constructor(table) {
    this.table = table;
    this.action = 'select';
    this.selectValue = '*';
    this.filters = [];
    this.orderBy = null;
    this.rangeValue = null;
    this.limitValue = null;
    this.countValue = false;
    this.headValue = false;
    this.singleValue = false;
    this.maybeSingleValue = false;
    this.values = null;
    this.orValue = null;
    this.textSearchValue = null;
  }
  select(value = '*', options = {}) { this.selectValue = value; this.countValue = !!options.count; this.headValue = !!options.head; return this; }
  eq(column, value) { this.filters.push({ type: 'eq', column, value }); return this; }
  neq(column, value) { this.filters.push({ type: 'neq', column, value }); return this; }
  gte(column, value) { this.filters.push({ type: 'gte', column, value }); return this; }
  lte(column, value) { this.filters.push({ type: 'lte', column, value }); return this; }
  ilike(column, value) { this.filters.push({ type: 'ilike', column, value }); return this; }
  in(column, value) { this.filters.push({ type: 'in', column, value }); return this; }
  contains(column, value) { this.filters.push({ type: 'contains', column, value }); return this; }
  not(column, operator, value) { this.filters.push({ type: 'not', column, operator, value }); return this; }
  or(value) { this.orValue = value; return this; }
  textSearch(column, term) { this.textSearchValue = { column, term }; return this; }
  order(column, options = {}) { this.orderBy = { column, ascending: options.ascending === true }; return this; }
  range(from, to) { this.rangeValue = { from, to }; return this; }
  limit(limit) { this.limitValue = limit; return this; }
  single() { this.singleValue = true; return this; }
  maybeSingle() { this.maybeSingleValue = true; return this; }
  insert(values) { this.action = 'insert'; this.values = values; return this; }
  update(values) { this.action = 'update'; this.values = values; return this; }
  delete() { this.action = 'delete'; return this; }
  async execute() {
    try {
      const result = await postJson(`${apiBase()}/query`, {
        table: this.table,
        action: this.action,
        select: this.selectValue,
        filters: this.filters,
        orderBy: this.orderBy,
        range: this.rangeValue,
        limit: this.limitValue,
        count: this.countValue,
        head: this.headValue,
        single: this.singleValue,
        maybeSingle: this.maybeSingleValue,
        values: this.values,
        or: this.orValue,
        textSearch: this.textSearchValue,
      });
      return { data: result.data ?? null, error: null, count: result.count ?? null };
    } catch (error) {
      return { data: null, error, count: null };
    }
  }
  then(resolve, reject) { return this.execute().then(resolve, reject); }
}

function decodeToken(token) {
  try { return JSON.parse(atob(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))); } catch { return null; }
}

function createClient() {
  return {
    from(table) { return new QueryBuilder(table); },
    async rpc(name, args = {}) {
      try {
        const result = await postJson(`${apiBase()}/rpc`, { name, args });
        return { data: result.data ?? null, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    auth: {
      async getSession() {
        const session = storedSession();
        if (!session?.access_token) return { data: { session: null }, error: null };
        return { data: { session }, error: null };
      },
      async getUser(token = null) {
        const accessToken = token || storedSession()?.access_token;
        if (!accessToken) return { data: { user: null }, error: null };
        const payload = decodeToken(accessToken);
        if (!payload) return { data: { user: null }, error: new Error('Invalid session') };
        return { data: { user: { id: payload.id, email: payload.email, user_metadata: payload.user_metadata || {} } }, error: null };
      },
      async refreshSession() { return this.getSession(); },
      async signInWithPassword({ email, password }) {
        try {
          const data = await postJson(`${apiBase()}/auth/sign-in`, { email, password });
          storeSession({ ...data.session, user: data.user });
          return { data, error: null };
        } catch (error) {
          return { data: null, error };
        }
      },
      async signUp({ email, password, options = {} }) {
        try {
          const data = await postJson(`${apiBase()}/auth/sign-up`, { email, password, profile: options.data || {} });
          storeSession({ ...data.session, user: data.user });
          return { data, error: null };
        } catch (error) {
          return { data: null, error };
        }
      },
      async signOut() { storeSession(null); return { error: null }; },
      async resetPasswordForEmail() { return { error: new Error('Password reset email is not configured on this Replit backend yet.') }; },
      async updateUser() { return { data: null, error: new Error('Account updates are not configured on this Replit backend yet.') }; },
      async setSession(session) { storeSession(session); return { data: { session }, error: null }; },
      async resend() { return { error: null }; },
    },
    storage: {
      from() {
        return {
          async upload() { return { data: null, error: new Error('Use ImageKit uploads on this Replit backend.') }; },
          getPublicUrl(path) { return { data: { publicUrl: path } }; },
        };
      },
    },
  };
}

function sb() {
  if (!_client) _client = createClient();
  return _client;
}

const Auth = {
  async getUser() { const { data } = await sb().auth.getUser(); return data?.user || null; },
  async getSession() { const { data } = await sb().auth.getSession(); return data?.session || null; },
  async getAccessToken() { return (await Auth.getSession())?.access_token || null; },
  async signOut() {
    await sb().auth.signOut();
    const path = location.pathname;
    if (path.includes('/admin/')) location.href = '/admin/login.html';
    else location.href = '/landlord/login.html';
  },
  async isAdmin() {
    const user = await Auth.getUser();
    if (!user) return false;
    const { data } = await sb().from('admin_roles').select('id').eq('user_id', user.id).maybeSingle();
    return !!data;
  },
  async requireLandlord(redirectTo = '../landlord/login.html') {
    const user = await Auth.getUser();
    if (!user) { location.href = redirectTo; return null; }
    const { data } = await sb().from('landlords').select('*').eq('user_id', user.id).maybeSingle();
    if (!data) { location.href = redirectTo; return null; }
    return data;
  },
  async requireAdmin(redirectTo = '../admin/login.html') {
    const isAdmin = await Auth.isAdmin();
    if (!isAdmin) { location.href = redirectTo; return false; }
    return true;
  },
};

async function callEdgeFunction(name, payload) {
  try {
    const result = await postJson(`${apiBase()}/edge/${name}`, payload);
    if ('success' in result && !result.success) return { ok: false, data: null, error: result.error || 'Unknown error' };
    const { success, error, ...data } = result;
    return { ok: true, data: Object.keys(data).length ? data : null, error: null };
  } catch (error) {
    return { ok: false, data: null, error: error.message || String(error) };
  }
}

const Properties = {
  async getListings(filters = {}) {
    const PAGE_SIZE = filters.per_page || 24;
    const page = Math.max(1, filters.page || 1);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let q = sb().from('properties').select('*, landlords(contact_name, business_name, avatar_url, verified)', { count: 'exact' }).eq('status', 'active');
    if (filters.q) q = q.textSearch('search_tsv', filters.q.trim());
    if (filters.type && filters.type !== 'all' && !['pets', 'parking', 'available'].includes(filters.type)) q = q.eq('property_type', filters.type);
    if (filters.type === 'pets') q = q.eq('pets_allowed', true);
    if (filters.type === 'parking') q = q.not('parking', 'is', null).neq('parking', '').neq('parking', 'None');
    if (filters.type === 'available') q = q.or(`available_date.is.null,available_date.lte.${new Date().toISOString().slice(0, 10)}`);
    if (filters.beds !== undefined && filters.beds !== '') { const beds = parseInt(filters.beds); q = beds === 4 ? q.gte('bedrooms', 4) : q.eq('bedrooms', beds); }
    else if (filters.min_beds !== undefined && filters.min_beds !== '') q = q.gte('bedrooms', parseInt(filters.min_beds));
    if (filters.min_baths !== undefined && filters.min_baths !== '') q = q.gte('bathrooms', parseFloat(filters.min_baths));
    if (filters.min_rent !== undefined && filters.min_rent !== '') q = q.gte('monthly_rent', parseInt(filters.min_rent));
    if (filters.max_rent !== undefined && filters.max_rent !== '') q = q.lte('monthly_rent', parseInt(filters.max_rent));
    if (filters.laundry_type) q = q.eq('laundry_type', filters.laundry_type);
    if (filters.heating_type) q = q.eq('heating_type', filters.heating_type);
    if (filters.pet_type) q = q.contains('pet_types_allowed', [filters.pet_type]);
    switch (filters.sort) {
      case 'price_asc': q = q.order('monthly_rent', { ascending: true }); break;
      case 'price_desc': q = q.order('monthly_rent', { ascending: false }); break;
      case 'beds_desc': q = q.order('bedrooms', { ascending: false }); break;
      default: q = q.order('created_at', { ascending: false }); break;
    }
    const { data, error, count } = await q.range(from, to);
    if (error) return { ok: false, data: null, error: error.message };
    const total = count ?? (data || []).length;
    return { ok: true, error: null, data: { rows: data || [], total, page, per_page: PAGE_SIZE, total_pages: Math.ceil(total / PAGE_SIZE) } };
  },
  async getAll(filters = {}) {
    let q = sb().from('properties').select('*, landlords(contact_name, business_name, avatar_url, verified)').order('created_at', { ascending: false });
    if (filters.status) q = q.eq('status', filters.status);
    if (filters.landlord) q = q.eq('landlord_id', filters.landlord);
    if (filters.bedrooms !== undefined && filters.bedrooms !== '') q = q.gte('bedrooms', filters.bedrooms);
    if (filters.max_rent) q = q.lte('monthly_rent', filters.max_rent);
    if (filters.state) q = q.eq('state', filters.state);
    const { data, error } = await q;
    return _ok(data || [], error);
  },
  async getOne(id) {
    const { data, error } = await sb().from('properties').select('*, landlords(*)').eq('id', id).maybeSingle();
    if (data && data.landlords && !data.landlords.avatar_url) data.landlords.avatar_url = '/assets/avatar-placeholder.png';
    return _ok(data, error);
  },
  async create(payload) {
    const { data: newId, error: idErr } = await sb().rpc('generate_property_id');
    if (idErr || !newId) return { ok: false, data: null, error: idErr?.message || 'Failed to generate property ID' };
    const { data, error } = await sb().from('properties').insert({ ...payload, id: newId }).select().single();
    return _ok(data, error);
  },
  async update(id, payload) { const { data, error } = await sb().from('properties').update(payload).eq('id', id).select().single(); return _ok(data, error); },
  async delete(id) { return sb().from('properties').delete().eq('id', id); },
  async incrementView(id) { return sb().rpc('increment_counter', { p_table: 'properties', p_id: id, p_column: 'views_count' }); },
};

const SavedProperties = {
  async getIds() { return new Set(JSON.parse(localStorage.getItem('cp_saved') || '[]')); },
  async toggle(propertyId) {
    const ids = new Set(JSON.parse(localStorage.getItem('cp_saved') || '[]'));
    const saved = !ids.has(propertyId);
    if (saved) ids.add(propertyId); else ids.delete(propertyId);
    localStorage.setItem('cp_saved', JSON.stringify([...ids]));
    return { saved };
  },
};

const Inquiries = {
  async submit(payload) {
    const THROTTLE_KEY = 'cp_inquiry_last';
    const last = parseInt(localStorage.getItem(THROTTLE_KEY) || '0', 10);
    if (Date.now() - last < 60000) return { ok: false, data: null, error: 'Please wait a moment before sending another inquiry.' };
    const result = await callEdgeFunction('send-inquiry', { type: 'new_inquiry', tenant_name: payload.tenant_name, tenant_email: payload.tenant_email, tenant_language: payload.tenant_language || localStorage.getItem('cp_lang') || 'en', message: payload.message, property_id: payload.property_id, tenant_phone: payload.tenant_phone || null, insert_payload: payload });
    if (result?.ok) localStorage.setItem(THROTTLE_KEY, String(Date.now()));
    return result;
  },
  async getForLandlord(landlordId) { const { data, error } = await sb().from('inquiries').select('*, properties!inner(id, title, address, landlord_id)').eq('properties.landlord_id', landlordId).order('created_at', { ascending: false }); return _ok(data || [], error); },
  async markRead(id) { return sb().from('inquiries').update({ read: true }).eq('id', id); },
};

const Landlords = {
  async getProfile(userId) { const { data, error } = await sb().from('landlords').select('*').eq('user_id', userId).maybeSingle(); return _ok(data, error); },
  async update(id, payload) { const { data, error } = await sb().from('landlords').update(payload).eq('id', id).select().single(); return _ok(data, error); },
  async getAll(filters = {}) {
    const perPage = filters.perPage || 50;
    const page = filters.page || 0;
    const { data, error, count } = await sb().from('landlords').select('*, properties(count)', { count: 'exact' }).order('created_at', { ascending: false }).range(page * perPage, (page + 1) * perPage - 1);
    if (error) return { ok: false, data: null, error: error.message };
    return { ok: true, data: data || [], error: null, count: count || 0, page, perPage };
  },
};

const EmailLogs = {
  async getAll(filters = {}) {
    const perPage = filters.perPage || 50;
    const page = filters.page || 0;
    let q = sb().from('email_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(page * perPage, (page + 1) * perPage - 1);
    if (filters.app_id) q = q.eq('app_id', filters.app_id);
    if (filters.type) q = q.eq('type', filters.type);
    if (filters.status) q = q.eq('status', filters.status);
    const { data, error, count } = await q;
    if (error) return { ok: false, data: null, error: error.message };
    return { ok: true, data: data || [], error: null, count: count || 0, page, perPage };
  },
};

const UI = {
  fmt: {
    currency: (n) => `$${parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    date: (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—',
    dateTime: (d) => d ? new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—',
    status: (s) => s ? String(s).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—',
    phone: (p) => p ? String(p).replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3') : '',
  },
  statusBadge(status) { const map = { pending: 'badge-warning', under_review: 'badge-info', approved: 'badge-success', denied: 'badge-danger', withdrawn: 'badge-secondary', waitlisted: 'badge-secondary' }; return `<span class="badge ${map[status] || 'badge-secondary'}">${UI.fmt.status(status)}</span>`; },
  paymentBadge(status) { const map = { unpaid: 'badge-danger', paid: 'badge-success', waived: 'badge-info', refunded: 'badge-warning' }; return `<span class="badge ${map[status] || 'badge-secondary'}">${UI.fmt.status(status)}</span>`; },
  leaseBadge(status) { const map = { none: 'badge-secondary', sent: 'badge-info', signed: 'badge-success', awaiting_co_sign: 'badge-warning', co_signed: 'badge-success', voided: 'badge-danger', expired: 'badge-warning' }; return `<span class="badge ${map[status] || 'badge-secondary'}">${UI.fmt.status(status)}</span>`; },
  toast(msg, type = 'info', duration = 4000) { const t = document.createElement('div'); t.className = `cp-toast cp-toast-${type}`; t.textContent = msg; document.body.appendChild(t); requestAnimationFrame(() => t.classList.add('show')); setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, duration); },
  loading(el, on) { if (!el) return; if (on) { el.dataset.origText = el.textContent; el.disabled = true; el.textContent = 'Loading…'; } else { el.textContent = el.dataset.origText || el.textContent; el.disabled = false; } },
  cpConfirm(message, { confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false } = {}) { return Promise.resolve(window.confirm(message)); },
  lqipUrl(url) { if (!url || !window.CONFIG || !CONFIG.IMAGEKIT_URL) return null; const base = url.startsWith(CONFIG.IMAGEKIT_URL) ? url.replace(/\/tr:[^/]+/, '') : CONFIG.IMAGEKIT_URL + '/' + encodeURIComponent(url); return base.replace(CONFIG.IMAGEKIT_URL, CONFIG.IMAGEKIT_URL + '/tr:w-30,bl-20,q-20,f-webp'); },
  skeletonRows(rows = 5, cols = 4) { const cells = Array(cols).fill('<td><div class="sk-cell"></div></td>').join(''); return Array(rows).fill(`<tr class="sk-row">${cells}</tr>`).join(''); },
  emptyState(message, icon = '📭', cols = 0) { const inner = `<div class="cp-empty-state"><span class="cp-empty-icon">${icon}</span><span class="cp-empty-msg">${message}</span></div>`; return cols ? `<tr><td colspan="${cols}">${inner}</td></tr>` : inner; },
  errorState(message = 'Failed to load data. Please refresh and try again.', cols = 0) { const inner = `<div class="cp-error-state"><span class="cp-error-icon">⚠️</span><span class="cp-error-msg">${message}</span></div>`; return cols ? `<tr><td colspan="${cols}">${inner}</td></tr>` : inner; },
};

function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function buildApplyURL(property) {
  try { sessionStorage.setItem('cp_property_context', JSON.stringify(property)); } catch {}
  const p = new URLSearchParams();
  p.set('id', property.id);
  if (property.title) p.set('pn', property.title.substring(0, 120));
  if (property.address) p.set('addr', property.address.substring(0, 100));
  if (property.city) p.set('city', property.city);
  if (property.state) p.set('state', property.state);
  if (property.zip) p.set('zip', property.zip);
  if (property.monthly_rent) p.set('rent', property.monthly_rent);
  if (property.security_deposit) p.set('deposit', property.security_deposit);
  p.set('fee', property.application_fee != null ? property.application_fee : 0);
  if (property.bedrooms != null) p.set('beds', property.bedrooms);
  if (property.bathrooms != null) p.set('baths', property.bathrooms);
  if (property.available_date) p.set('avail', property.available_date);
  if (property.lease_terms?.length) p.set('terms', Array.isArray(property.lease_terms) ? property.lease_terms.join('|') : property.lease_terms);
  p.set('pets', property.pets_allowed ? 'true' : 'false');
  if (property.pet_types_allowed?.length) p.set('pet_types', Array.isArray(property.pet_types_allowed) ? property.pet_types_allowed.join('|') : property.pet_types_allowed);
  p.set('smoking', property.smoking_allowed ? 'true' : 'false');
  if (property.utilities_included?.length) p.set('utilities', Array.isArray(property.utilities_included) ? property.utilities_included.join('|') : property.utilities_included);
  if (property.parking) p.set('parking', property.parking);
  try { p.set('source', window.location.href.substring(0, 300)); } catch {}
  const base = (typeof CONFIG !== 'undefined' && CONFIG.APPLY_FORM_URL) ? CONFIG.APPLY_FORM_URL : '/';
  return `${base}?${p.toString()}`;
}

async function incrementCounter(table, id, column) { return sb().rpc('increment_counter', { p_table: table, p_id: id, p_column: column }); }
async function getSession() { return Auth.getSession(); }
async function getLandlordProfile() { const user = await Auth.getUser(); if (!user) return null; return (await Landlords.getProfile(user.id)).data; }
async function requireAuth(r) { return Auth.requireLandlord(r); }
async function signIn(e, p) { const { data, error } = await sb().auth.signInWithPassword({ email: e, password: p }); if (error) throw error; return data; }
async function signUp(email, password, profile) { const { data, error } = await sb().auth.signUp({ email, password, options: { data: profile } }); if (error) throw error; return data; }
async function signOut() { await sb().auth.signOut(); window.location.href = window.location.pathname.includes('/admin/') ? '/admin/login.html' : '/landlord/login.html'; }
async function resetPassword(email, redirectPath = '/landlord/login.html') { const { error } = await sb().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}${redirectPath}` }); if (error) throw error; }
async function updateNav() {
  const session = await Auth.getSession();
  const authLink = document.getElementById('navAuthLink');
  const drawerLink = document.getElementById('drawerAuthLink');
  if (session) {
    if (authLink) { authLink.href = '/landlord/dashboard.html'; authLink.textContent = 'My Dashboard'; }
    if (drawerLink) { drawerLink.href = '/landlord/dashboard.html'; drawerLink.textContent = 'My Dashboard'; }
  } else {
    if (authLink) { authLink.href = '/landlord/register.html'; authLink.textContent = 'List Your Property'; }
    if (drawerLink) { drawerLink.href = '/landlord/login.html'; drawerLink.textContent = 'Landlord Login'; }
  }
}

window.CP_esc = esc;
window.CP = { sb, Auth, Properties, SavedProperties, Inquiries, Landlords, EmailLogs, UI, buildApplyURL, incrementCounter, getSession, getLandlordProfile, requireAuth, signIn, signUp, signOut, resetPassword, updateNav };

export const supabase = sb();
export { buildApplyURL, incrementCounter, getSession, getLandlordProfile, requireAuth, signIn, signUp, signOut, resetPassword, updateNav };
