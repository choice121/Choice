// /js/listings.js
  // Extracted from listings.html (issue #26). Loaded as <script type="module">.
  // Depends on globals provided by:
  //   - /js/cp-ui.js  -> CP.UI.esc, window.showToast, window.setupScrollTop
  //   - /js/cp-api.js -> CP.API (loaded as module)
  //   - /js/components.js, /js/card-builder.js
  // External-script CSP allows 'self' so no nonce is required for this file.

  // esc, showToast, setupScrollTop come from /js/cp-ui.js (window globals).
  const esc = (window.CP && CP.UI && CP.UI.esc) || (s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'));

// CSP-safe image load/error handling (inline onload/onerror blocked by Cloudflare CSP nonce policy)
document.addEventListener('load', function(e) {
  if (e.target.tagName === 'IMG') e.target.classList.add('cp-img-loaded');
}, true);
document.addEventListener('error', function(e) {
  var t = e.target;
  if (t.tagName !== 'IMG') return;
  t.classList.add('cp-img-loaded');
  if (t.src !== location.origin + '/assets/placeholder-property.jpg') {
    t.src = '/assets/placeholder-property.jpg';
  }
}, true);

// ── State ────────────────────────────────────────────────────────────────
let activeType     = 'all';
let activeBeds     = '';
let activeMaxRent  = '';
let activeMinRent  = '';
let activeSearch   = '';
let activeMinBaths = '';
let activeMinSqft  = '';
let activeMaxSqft  = '';
let activeAmenity  = '';
let activeLaundry  = '';
let activeHeating  = '';
let activePetType  = '';
let sortBy         = 'newest';
let currentPage    = 1;
let totalPages     = 1;
let totalCount     = 0;
let currentView    = 'list';
let isLoading      = false;
let mapInstance    = null;
let mapMarkers     = [];
let savedIds       = loadSavedIds();
// Phase C: cache the rows from the most-recent fetch so the
// click-anywhere-on-card handler can build the canonical slug URL
// without a second API call.
let pageProperties = [];
let activeTargetIds = [];
let activeShareToken = '';
const PER_PAGE     = 24;

// ── Admin mode state ───────────────────────────────────────────────────────
let isAdminMode       = false;
let adminStatusFilter = 'active';
let adminLandlordId   = null;
let adminLandlordName = null;
let _adminSelected    = new Set(); // property IDs checked for bulk ops

function loadSavedIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem('cp_saved') || '[]'));
  } catch {
    localStorage.removeItem('cp_saved');
    return new Set();
  }
}

async function waitForCP(timeoutMs = 8000) {
  const start = Date.now();
  while (!window.CP?.Properties || !window.CP?.UI || !window.CONFIG) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Listing dependencies did not load. Please refresh the page.');
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

function fmtRent(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `$${n.toLocaleString()}` : 'Rent TBD';
}

// ── Read URL → state ──────────────────────────────────────────────────────
function readURL() {
  const p = new URLSearchParams(window.location.search);
  const targetIdsRaw = p.get('p') || p.get('ids') || '';
  activeShareToken = p.get('share') || new URLSearchParams(window.location.hash.slice(1)).get('share') || '';
  activeTargetIds = !activeShareToken && targetIdsRaw ? targetIdsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
  activeSearch   = p.get('q')        || '';
  activeBeds     = p.get('beds')     || '';
  activeMaxRent  = p.get('maxrent')  || '';
  activeMinRent  = p.get('minrent')  || '';
  activeMinBaths = p.get('minbaths') || '';
  activeMinSqft  = p.get('minsqft')  || '';
  activeMaxSqft  = p.get('maxsqft')  || '';
  activeAmenity  = p.get('amenity')  || '';
  activeLaundry  = p.get('laundry')  || '';
  activeHeating  = p.get('heating')  || '';
  activePetType  = p.get('pettype')  || '';
  activeType     = p.get('type')     || 'all';
  sortBy         = p.get('sort')     || 'newest';
  currentPage    = parseInt(p.get('page') || '1', 10);
  if (isAdminMode) {
    adminLandlordId = p.get('landlord') || null;
    const urlStatus = p.get('status');
    adminStatusFilter = urlStatus || (adminLandlordId ? 'all' : 'active');
  }
  syncShareRobotsMeta();
}

function syncShareRobotsMeta() {
  let meta = document.querySelector('meta[name="robots"]');
  if (activeShareToken) {
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      meta.dataset.cpShareShield = '1';
      document.head.appendChild(meta);
    }
    meta.content = 'noindex, nofollow';
    const canon = document.querySelector('link[rel="canonical"]');
    if (canon) canon.remove();
  } else if (meta && meta.dataset.cpShareShield === '1') {
    meta.remove();
  }
}

// ── Write state → URL ─────────────────────────────────────────────────────
function pushURL(replace = false) {
  const p = new URLSearchParams();
  if (!activeShareToken && activeTargetIds && activeTargetIds.length) p.set('p', activeTargetIds.join(','));
  if (activeSearch)   p.set('q',        activeSearch);
  if (activeBeds)     p.set('beds',     activeBeds);
  if (activeMaxRent)  p.set('maxrent',  activeMaxRent);
  if (activeMinRent)  p.set('minrent',  activeMinRent);
  if (activeMinBaths) p.set('minbaths', activeMinBaths);
  if (activeMinSqft)  p.set('minsqft',  activeMinSqft);
  if (activeMaxSqft)  p.set('maxsqft',  activeMaxSqft);
  if (activeAmenity)  p.set('amenity',  activeAmenity);
  if (activeLaundry)  p.set('laundry',  activeLaundry);
  if (activeHeating)  p.set('heating',  activeHeating);
  if (activePetType)  p.set('pettype',  activePetType);
  if (activeType && activeType !== 'all') p.set('type', activeType);
  if (sortBy && sortBy !== 'newest') p.set('sort', sortBy);
  if (currentPage > 1) p.set('page', currentPage);
  if (isAdminMode && adminLandlordId) p.set('landlord', adminLandlordId);
  if (isAdminMode && adminStatusFilter && adminStatusFilter !== 'active') p.set('status', adminStatusFilter);
  const url = (p.toString() ? `?${p}` : window.location.pathname) +
    (activeShareToken ? `#share=${encodeURIComponent(activeShareToken)}` : '');
  if (replace) history.replaceState(null, '', url);
  else         history.pushState(null, '', url);
}

// ── Sync UI controls to current state ────────────────────────────────────
function syncControls() {
  const si = document.getElementById('searchInput');
  const bf = document.getElementById('bedroomsFilter');
  const ss = document.getElementById('sortSelect');
  if (si) si.value = activeSearch;
  if (bf) bf.value = activeBeds;
  const mrf = document.getElementById('maxRentFilter');
  if (mrf) mrf.value = activeMaxRent;
  if (ss) ss.value = sortBy;
  document.querySelectorAll('.filter-pill[data-filter]').forEach(pill => {
    pill.classList.toggle('active', pill.dataset.filter === activeType);
  });
  const at    = document.getElementById('advTypeFilter');
  const ab    = document.getElementById('advMinBeds');
  const abath = document.getElementById('advMinBaths');
  const amin  = document.getElementById('advMinRent');
  const amax  = document.getElementById('advMaxRent');
  const aminSq = document.getElementById('advMinSqft');
  const amaxSq = document.getElementById('advMaxSqft');
  const aamen  = document.getElementById('advAmenityFilter');
  const alaun  = document.getElementById('advLaundryFilter');
  const aheat  = document.getElementById('advHeatingFilter');
  const apet   = document.getElementById('advPetTypeFilter');
  if (at)     at.value     = ['apartment','house','condo','townhouse','duplex'].includes(activeType) ? activeType : '';
  if (ab)     ab.value     = activeBeds;
  if (abath)  abath.value  = activeMinBaths;
  if (amin)   amin.value   = activeMinRent;
  if (amax)   amax.value   = activeMaxRent;
  if (aminSq) aminSq.value = activeMinSqft;
  if (amaxSq) amaxSq.value = activeMaxSqft;
  if (aamen)  aamen.value  = activeAmenity;
  if (alaun)  alaun.value  = activeLaundry;
  if (aheat)  aheat.value  = activeHeating;
  if (apet)   apet.value   = activePetType;
  updateFilterBadge();
}

// ── Admin mode detection & toolbar ───────────────────────────────────────
async function initAdminMode() {
  if (!window.CP?.Auth) return;
  try { isAdminMode = await window.CP.Auth.isAdmin(); } catch(e) { isAdminMode = false; }
  if (!isAdminMode) return;
  window.__CP_IS_ADMIN__ = true;

  const usp = new URLSearchParams(window.location.search);
  if (usp.get('landlord')) adminLandlordId = usp.get('landlord');
  if (usp.get('status')) adminStatusFilter = usp.get('status');
  else if (adminLandlordId) adminStatusFilter = 'all';
  else adminStatusFilter = 'active';

  // Resolve landlord name if filter is active
  if (adminLandlordId) {
    try {
      const res = await window.CP.Landlords?.adminList?.({ id: adminLandlordId });
      adminLandlordName = res?.data?.[0]?.contact_name || res?.data?.[0]?.business_name || null;
    } catch(e) {}
  }

  injectAdminToolbar();
}

function getAdminDetailHref(id, extraParams, propObj) {
  const qp = new URLSearchParams();
  qp.set('id', id);
  const effectiveStatus = (activeShareToken || adminStatusFilter === 'private_placement' || propObj?.status === 'private_placement')
    ? 'private_placement'
    : (adminStatusFilter && adminStatusFilter !== 'active' ? adminStatusFilter : '');
  if (effectiveStatus) qp.set('from_status', effectiveStatus);
  if (extraParams && typeof extraParams === 'object') {
    Object.entries(extraParams).forEach(([k, v]) => {
      if (v != null && v !== '') qp.set(k, String(v));
    });
  }
  return '/admin/property-detail.html?' + qp.toString() +
    (activeShareToken ? '#share=' + encodeURIComponent(activeShareToken) : '');
}

const ADMIN_STATUS_LABELS = {
  active:            'Public Active Only',
  private_placement: 'Private Placement (Unlisted)',
  all:               'All Properties',
  rented:            'Rented',
  inactive:          'Inactive',
  maintenance:       'Maintenance',
  draft:             'Draft',
  paused:            'Paused',
  archived:          'Archived',
};

function syncAdminToolbarUI() {
  const toolbar = document.getElementById('adminListingsToolbar');
  if (!toolbar) return;
  const chipsCls = s => ({
    active:'#10b981', private_placement:'#8b5cf6', rented:'#3b82f6', inactive:'#6b7280',
    maintenance:'#f59e0b', draft:'#6366f1', paused:'#f97316', archived:'#6b7280'
  })[s] || '#374151';
  toolbar.querySelectorAll('[data-admin-status]').forEach(b => {
    const s = b.dataset.adminStatus;
    const col = chipsCls(s);
    const active = !activeShareToken && s === adminStatusFilter;
    b.style.border = '2px solid ' + (active ? col : '#d1d5db');
    b.style.background = active ? col + '1a' : '#fff';
    b.style.color = active ? col : '#374151';
    b.classList.toggle('admin-chip-active', active);
  });
  const scopeLabel = document.getElementById('adminScopeLabel');
  if (scopeLabel) {
    if (activeShareToken) {
      scopeLabel.textContent = 'Private Placement Magic Link (Admin Preview)';
    } else {
      scopeLabel.textContent = ADMIN_STATUS_LABELS[adminStatusFilter] || adminStatusFilter;
    }
  }
  const sniperBtn = document.getElementById('adminSniperBtn');
  if (sniperBtn) {
    if (activeShareToken) {
      sniperBtn.href = `/admin/watermark-sniper.html#share=${encodeURIComponent(activeShareToken)}`;
      sniperBtn.innerHTML = '<i class="fas fa-crosshairs"></i> 🎯 Snipe This List';
    } else if (adminStatusFilter === 'private_placement') {
      sniperBtn.href = '/admin/watermark-sniper.html?scope=private_placement';
      sniperBtn.innerHTML = '<i class="fas fa-crosshairs"></i> 🎯 Snipe Private Placements';
    } else {
      sniperBtn.href = '/admin/watermark-sniper.html?scope=public';
      sniperBtn.innerHTML = '<i class="fas fa-crosshairs"></i> 🎯 Public Watermark Sniper';
    }
  }
  renderAdminShareSniperBanner();
  renderAdminPrivateBatchesBar();
}

function getSniperHrefForCurrentContext() {
  if (activeShareToken) return `/admin/watermark-sniper.html#share=${encodeURIComponent(activeShareToken)}`;
  if (adminStatusFilter === 'private_placement') return '/admin/watermark-sniper.html?scope=private_placement';
  return '/admin/watermark-sniper.html?scope=public';
}

function renderAdminShareSniperBanner() {
  let banner = document.getElementById('adminShareSniperBanner');
  if (!isAdminMode || !activeShareToken) {
    if (banner) banner.remove();
    return;
  }
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'adminShareSniperBanner';
    const toolbar = document.getElementById('adminListingsToolbar');
    if (toolbar) toolbar.insertAdjacentElement('afterend', banner);
    else document.body.prepend(banner);
  }
  const safeTok = encodeURIComponent(activeShareToken);
  const countTxt = totalCount > 0 ? `${totalCount} listing${totalCount === 1 ? '' : 's'} in this magic link` : 'All listings in this magic link';
  banner.innerHTML = `
    <div class="cp-admin-share-banner-inner">
      <div class="cp-admin-share-banner-meta">
        <span class="cp-admin-share-pill">🔒 ADMIN PRIVATE PLACEMENT</span>
        <div class="cp-admin-share-title">Batch Watermark Sniper Ready · <span id="adminShareCountTxt">${esc(countTxt)}</span></div>
        <div class="cp-admin-share-sub">Visible only while signed in as admin. Clients never see this bar or private badges.</div>
      </div>
      <div class="cp-admin-share-actions">
        <a href="/admin/watermark-sniper.html#share=${safeTok}" class="cp-admin-sniper-cta">
          <i class="fas fa-crosshairs"></i> Open Watermark Sniper for This List
        </a>
        <a href="/admin/watermark-sniper.html?tab=trash#share=${safeTok}" class="cp-admin-trash-cta">
          <i class="fas fa-clock-rotate-left"></i> 24h Trash
        </a>
      </div>
    </div>`;
}

let _privateBatchesCache = null;
let _privateBatchesLoading = false;

async function renderAdminPrivateBatchesBar() {
  let panel = document.getElementById('adminPrivateBatchesPanel');
  if (!isAdminMode || activeShareToken || adminStatusFilter !== 'private_placement') {
    if (panel) panel.remove();
    return;
  }
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'adminPrivateBatchesPanel';
    const toolbar = document.getElementById('adminListingsToolbar');
    if (toolbar) toolbar.insertAdjacentElement('afterend', panel);
    else document.body.prepend(panel);
  }

  if (!_privateBatchesCache && !_privateBatchesLoading && window.CP?.sb) {
    _privateBatchesLoading = true;
    panel.innerHTML = `<div class="cp-admin-batch-bar-inner"><span style="color:#94a3b8;font-size:12px"><i class="fas fa-spinner fa-spin"></i> Loading existing &amp; new private placement batches…</span></div>`;
    try {
      const { data, error } = await window.CP.sb().rpc('get_private_placement_batches_for_sniper');
      if (!error && data?.ok) _privateBatchesCache = data;
    } catch (_) {}
    _privateBatchesLoading = false;
  }

  const data = _privateBatchesCache;
  const batches = Array.isArray(data?.batches) ? data.batches : [];
  const shares = Array.isArray(data?.shares) ? data.shares : [];

  const optionsHtml = [
    ...batches.map(b => {
      const mkt = b.target_market ? ` · ${b.target_market}` : '';
      return `<option value="batch:${esc(b.batch_id)}" data-magic="${esc(b.magic_link_url || '')}">Batch ${esc(b.batch_id)}${esc(mkt)} (${b.property_count} props · ${b.photo_count || 0} photos)</option>`;
    }),
    ...shares.filter(s => !s.pub_batch_id).map(s => {
      const lbl = s.share_alias || s.sample_market || `Client Link ${String(s.share_id).slice(0, 8)}`;
      return `<option value="share_id:${esc(s.share_id)}">${esc(lbl)} (${s.property_count} props · ${s.photo_count || 0} photos)</option>`;
    })
  ].join('');

  panel.innerHTML = `
    <div class="cp-admin-batch-bar-inner">
      <div class="cp-admin-batch-bar-left">
        <span class="cp-admin-share-pill" style="background:rgba(139,92,246,0.2);color:#c4b5fd;border-color:rgba(139,92,246,0.4)">PRIVATE PLACEMENT SNIPER</span>
        <span style="font-size:12.5px;color:#cbd5e1">${batches.length} batch${batches.length === 1 ? '' : 'es'} · ${shares.length} active magic link${shares.length === 1 ? '' : 's'}</span>
      </div>
      <div class="cp-admin-batch-bar-controls">
        <select id="adminBatchLauncherSel" class="cp-admin-batch-select" aria-label="Select Private Placement Batch or Magic Link">
          <option value="scope:private_placement">All Private Placements (Latest 200)</option>
          ${optionsHtml}
        </select>
        <button type="button" id="adminLaunchSelectedBatchSniperBtn" class="cp-admin-sniper-cta">
          <i class="fas fa-crosshairs"></i> Open in Sniper
        </button>
      </div>
    </div>`;

  panel.querySelector('#adminLaunchSelectedBatchSniperBtn')?.addEventListener('click', () => {
    const val = panel.querySelector('#adminBatchLauncherSel')?.value || 'scope:private_placement';
    if (val.startsWith('batch:')) {
      window.location.href = `/admin/watermark-sniper.html?batch=${encodeURIComponent(val.slice(6))}`;
    } else if (val.startsWith('share_id:')) {
      window.location.href = `/admin/watermark-sniper.html?share_id=${encodeURIComponent(val.slice(9))}`;
    } else {
      window.location.href = '/admin/watermark-sniper.html?scope=private_placement';
    }
  });
}

function injectAdminToolbar() {
  if (document.getElementById('adminListingsToolbar')) return;

  const statusOptions = [
    { val:'active',            label:'Active' },
    { val:'private_placement', label:'Private Placement' },
    { val:'all',               label:'All' },
    { val:'rented',            label:'Rented' },
    { val:'inactive',          label:'Inactive' },
    { val:'maintenance',       label:'Maintenance' },
    { val:'draft',             label:'Draft' },
    { val:'paused',            label:'Paused' },
    { val:'archived',          label:'Archived' },
  ];

  const chipsCls = s => ({
    active:'#10b981', private_placement:'#8b5cf6', rented:'#3b82f6', inactive:'#6b7280',
    maintenance:'#f59e0b', draft:'#6366f1', paused:'#f97316', archived:'#6b7280'
  })[s] || '#374151';

  const chips = statusOptions.map(o =>
    `<button class="admin-status-chip${o.val===adminStatusFilter?' admin-chip-active':''}"
       data-admin-status="${o.val}"
       style="padding:5px 14px;border-radius:20px;border:2px solid ${o.val===adminStatusFilter?chipsCls(o.val):'#d1d5db'};
              background:${o.val===adminStatusFilter?chipsCls(o.val)+'1a':'#fff'};
              color:${o.val===adminStatusFilter?chipsCls(o.val):'#374151'};
              font-size:13px;font-weight:600;cursor:pointer;transition:all 150ms ease;white-space:nowrap">
      ${o.label}
    </button>`
  ).join('');

  const _clearParams = new URLSearchParams();
  if (!activeShareToken && adminStatusFilter && adminStatusFilter !== 'active') {
    _clearParams.set('status', adminStatusFilter);
  }
  const _clearHref = '/listings.html' + (_clearParams.toString() ? '?' + _clearParams : '') +
    (activeShareToken ? '#share=' + encodeURIComponent(activeShareToken) : '');

  const landlordBanner = adminLandlordId
    ? `<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:8px 16px;font-size:13px;color:#92400e;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <i class="fas fa-filter"></i>
        <span>Filtered by landlord${adminLandlordName?' — <strong>'+adminLandlordName+'</strong>':' (ID: '+adminLandlordId+')'}</span>
        <a href="${esc(_clearHref)}" style="color:#92400e;font-weight:700;text-decoration:underline;margin-left:auto">Clear filter ×</a>
       </div>`
    : '';

  if (!document.getElementById('adminToolbarResponsiveCSS')) {
    const st = document.createElement('style');
    st.id = 'adminToolbarResponsiveCSS';
    st.textContent = `
      #adminStatusChips { display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
      #adminShareSniperBanner { background:linear-gradient(135deg,#0f172a 0%,#1e1b4b 100%); border-bottom:2px solid #8b5cf6; color:#f8fafc; padding:10px 0; }
      .cp-admin-share-banner-inner { max-width:1280px; margin:0 auto; padding:0 20px; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
      .cp-admin-share-banner-meta { display:flex; flex-direction:column; gap:3px; min-width:0; }
      .cp-admin-share-pill { display:inline-flex; align-items:center; width:fit-content; font-size:10px; font-weight:800; letter-spacing:.06em; background:rgba(16,185,129,0.18); color:#34d399; border:1px solid rgba(16,185,129,0.35); border-radius:999px; padding:2px 8px; }
      .cp-admin-share-title { font-size:14px; font-weight:700; color:#fff; }
      .cp-admin-share-sub { font-size:12px; color:#cbd5e1; }
      .cp-admin-share-actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
      .cp-admin-sniper-cta { background:#dc2626; color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:8px; padding:9px 14px; font-size:13px; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:7px; cursor:pointer; min-height:38px; box-shadow:0 3px 12px rgba(220,38,38,0.35); white-space:nowrap; }
      .cp-admin-sniper-cta:hover { background:#ef4444; color:#fff; }
      .cp-admin-trash-cta { background:rgba(245,158,11,0.14); color:#fbbf24; border:1px solid rgba(245,158,11,0.35); border-radius:8px; padding:9px 12px; font-size:12.5px; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:6px; min-height:38px; white-space:nowrap; }
      #adminPrivateBatchesPanel { background:#0f172a; border-bottom:1px solid #334155; color:#f8fafc; padding:10px 0; }
      .cp-admin-batch-bar-inner { max-width:1280px; margin:0 auto; padding:0 20px; display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; }
      .cp-admin-batch-bar-left { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
      .cp-admin-batch-bar-controls { display:flex; align-items:center; gap:8px; flex-wrap:wrap; flex:1; justify-content:flex-end; }
      .cp-admin-batch-select { background:#1e293b; color:#f8fafc; border:1px solid #475569; border-radius:8px; padding:8px 10px; font-size:13px; min-height:38px; max-width:440px; width:100%; }
      .cp-admin-card-actions { position:absolute; bottom:10px; right:10px; z-index:8; display:flex; align-items:center; gap:6px; }
      .cp-admin-card-btn { background:#0a1628; color:#fff; border:1px solid rgba(255,255,255,.16); border-radius:6px; padding:5px 10px; font-size:11px; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:4px; box-shadow:0 2px 6px rgba(0,0,0,.42); cursor:pointer; min-height:28px; opacity:.94; transition:transform 120ms ease, opacity 120ms ease, background 120ms ease; }
      .cp-admin-card-btn:hover { opacity:1; transform:translateY(-1px); }
      .cp-admin-card-del { background:#dc2626; border-color:rgba(255,255,255,.22); color:#fff; }
      .cp-admin-card-del:hover { background:#b91c1c; }
      .cp-admin-card-del:disabled { opacity:.6; cursor:not-allowed; transform:none; }
      @media (max-width:640px) {
        #adminStatusChips { flex-wrap:nowrap; overflow-x:auto; -webkit-overflow-scrolling:touch; padding-bottom:4px; }
        .cp-admin-share-actions, .cp-admin-batch-bar-controls { width:100%; justify-content:stretch; }
        .cp-admin-sniper-cta { flex:1; justify-content:center; }
        .cp-admin-batch-select { max-width:100%; }
      }
    `;
    document.head.appendChild(st);
  }

  const toolbar = document.createElement('div');
  toolbar.id = 'adminListingsToolbar';
  toolbar.style.cssText = 'background:#0a1628;padding:12px 0;border-bottom:3px solid #006aff;position:sticky;top:0;z-index:100;';
  toolbar.innerHTML = `
    <div style="max-width:1280px;margin:0 auto;padding:0 20px;display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="background:#006aff;color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;letter-spacing:.05em">ADMIN</span>
          <span id="adminScopeLabel" style="color:#e2e8f0;font-size:13px;font-weight:500">${activeShareToken ? 'Private Placement Magic Link (Admin Preview)' : (ADMIN_STATUS_LABELS[adminStatusFilter] || 'Public Active Only')}</span>
          <span style="color:#64748b;font-size:12px" id="adminPropCount">Loading…</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <a id="adminSniperBtn" href="${getSniperHrefForCurrentContext()}"
            style="background:rgba(239,68,68,0.18);border:1px solid rgba(239,68,68,0.45);color:#fca5a5;border-radius:6px;padding:7px 12px;font-size:12.5px;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:6px;min-height:34px;transition:all 150ms ease">
            <i class="fas fa-crosshairs"></i> 🎯 ${activeShareToken ? 'Snipe This List' : (adminStatusFilter === 'private_placement' ? 'Snipe Private Placements' : 'Public Watermark Sniper')}
          </a>
          <button id="adminCsvExportBtn"
            style="background:transparent;border:1px solid #374151;color:#94a3b8;border-radius:6px;padding:7px 12px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;min-height:34px">
            <i class="fas fa-download"></i> Export CSV
          </button>
          <button id="adminNewPropBtn"
            style="background:#006aff;color:#fff;border-radius:6px;padding:7px 14px;font-size:12px;font-weight:700;border:none;cursor:pointer;display:flex;align-items:center;gap:6px;min-height:34px">
            <i class="fas fa-plus"></i> New Property
          </button>
        </div>
      </div>
      <div id="adminStatusChips">
        ${chips}
      </div>
      ${landlordBanner ? '<div>'+landlordBanner+'</div>' : ''}
    </div>`;

  // Insert before the listings page header
  const pageHeader = document.querySelector('.listings-page-header');
  if (pageHeader) pageHeader.parentNode.insertBefore(toolbar, pageHeader);
  else document.body.prepend(toolbar);

  renderAdminShareSniperBanner();
  renderAdminPrivateBatchesBar();

  // Bulk action bar (hidden until cards are selected)
  const bulkBar = document.createElement('div');
  bulkBar.id = 'adminBulkBar';
  bulkBar.style.cssText = 'display:none;align-items:center;gap:10px;background:#1e293b;padding:8px 20px;border-bottom:2px solid #006aff;flex-wrap:wrap;position:sticky;top:' + (toolbar.offsetHeight || 90) + 'px;z-index:99';
  bulkBar.innerHTML = `
    <span id="bulkSelLabel" style="color:#e2e8f0;font-size:13px;font-weight:600;min-width:120px"></span>
    <select id="bulkStatusSel" style="background:#0a1628;color:#e2e8f0;border:1px solid #374151;border-radius:6px;padding:5px 10px;font-size:12px;font-weight:600">
      <option value="">— Set status —</option>
      <option value="active">Active</option>
      <option value="private_placement">Private Placement</option>
      <option value="rented">Rented</option>
      <option value="inactive">Inactive</option>
      <option value="maintenance">Maintenance</option>
      <option value="draft">Draft</option>
      <option value="paused">Paused</option>
      <option value="archived">Archived</option>
    </select>
    <button id="bulkApplyBtn" style="background:#006aff;color:#fff;border:none;border-radius:6px;padding:5px 14px;font-size:12px;font-weight:700;cursor:pointer">Apply</button>
    <span style="width:1px;background:#374151;align-self:stretch;margin:0 2px"></span>
    <button id="bulkMatchBtn" style="background:transparent;border:1px solid #10b981;color:#10b981;border-radius:6px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer">🔗 Create Client Link</button>
    <span style="width:1px;background:#374151;align-self:stretch;margin:0 2px"></span>
    <button id="bulkFeatureBtn" style="background:transparent;border:1px solid #f59e0b;color:#f59e0b;border-radius:6px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer">⭐ Feature</button>
    <button id="bulkUnfeatureBtn" style="background:transparent;border:1px solid #374151;color:#94a3b8;border-radius:6px;padding:5px 12px;font-size:12px;cursor:pointer">Unfeature</button>
    <span style="width:1px;background:#374151;align-self:stretch;margin:0 2px"></span>
    <button id="bulkDeleteBtn" type="button" style="background:#dc2626;border:none;color:#fff;border-radius:6px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px"><i class="fas fa-trash-can"></i> Delete</button>
    <span style="width:1px;background:#374151;align-self:stretch;margin:0 2px"></span>
    <button id="bulkClearBtn" style="background:transparent;border:1px solid #374151;color:#94a3b8;border-radius:6px;padding:5px 12px;font-size:12px;cursor:pointer">Clear</button>
    <button id="bulkSelAllBtn" style="background:transparent;border:1px solid #374151;color:#94a3b8;border-radius:6px;padding:5px 12px;font-size:12px;cursor:pointer">Select all on page</button>`;
  toolbar.insertAdjacentElement('afterend', bulkBar);

  // Wire chip clicks
  toolbar.querySelectorAll('[data-admin-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (activeShareToken) {
        activeShareToken = '';
        if (typeof window !== 'undefined') window.__CP_ACTIVE_SHARE_TOKEN__ = '';
        syncShareRobotsMeta();
      }
      adminStatusFilter = btn.dataset.adminStatus;
      syncAdminToolbarUI();
      // Clear selection when filter changes — selected set no longer matches visible cards
      _adminSelected.clear();
      _updateBulkBar();
      currentPage = 1;
      pushURL();
      fetchAndRender();
    });
  });

  // Wire bulk bar buttons
  document.getElementById('bulkApplyBtn')?.addEventListener('click', _bulkStatusChange);
  document.getElementById('bulkMatchBtn')?.addEventListener('click', _bulkCreateMatch);
  document.getElementById('bulkFeatureBtn')?.addEventListener('click', () => _bulkSetFeatured(true));
  document.getElementById('bulkUnfeatureBtn')?.addEventListener('click', () => _bulkSetFeatured(false));
  document.getElementById('bulkDeleteBtn')?.addEventListener('click', _bulkDeleteSelected);
  document.getElementById('bulkClearBtn')?.addEventListener('click', () => {
    _adminSelected.clear();
    document.querySelectorAll('[data-admin-id]').forEach(c => { c.checked = false; });
    _updateBulkBar();
  });
  document.getElementById('bulkSelAllBtn')?.addEventListener('click', () => {
    document.querySelectorAll('[data-admin-id]').forEach(c => {
      c.checked = true;
      _adminSelected.add(c.dataset.adminId);
    });
    _updateBulkBar();
  });

  // Wire CSV export
  document.getElementById('adminCsvExportBtn')?.addEventListener('click', adminCSVExport);

  // Wire new property button
  document.getElementById('adminNewPropBtn')?.addEventListener('click', openAdminCreateModal);
}

function openAdminCreateModal() {
  if (document.getElementById('adminCreateModal')) return;

  const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'];
  const stateOpts = US_STATES.map(s => `<option value="${s}">${s}</option>`).join('');

  const inp = (id, name, type, ph, extra) =>
    `<input id="${id}" name="${name}" type="${type}" placeholder="${ph}" ${extra||''}
      style="padding:9px 12px;border:1.5px solid #d1d5db;border-radius:8px;font-size:14px;width:100%;box-sizing:border-box;outline:none;transition:border-color .15s"
      onfocus="this.style.borderColor='#006aff'" onblur="this.style.borderColor='#d1d5db'">`;

  const sel = (id, name, opts) =>
    `<select id="${id}" name="${name}"
      style="padding:9px 12px;border:1.5px solid #d1d5db;border-radius:8px;font-size:14px;background:#fff;width:100%;box-sizing:border-box;outline:none">${opts}</select>`;

  const lbl = (label, required, inner) =>
    `<label style="display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:600;color:#374151">
      ${label}${required ? ' <span style="color:#ef4444">*</span>' : ''}
      ${inner}
    </label>`;

  const modal = document.createElement('div');
  modal.id = 'adminCreateModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.65);backdrop-filter:blur(4px)';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:14px;width:100%;max-width:540px;max-height:92vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,.35)">
      <div style="padding:20px 24px 14px;display:flex;align-items:flex-start;justify-content:space-between;border-bottom:1px solid #e5e7eb;position:sticky;top:0;background:#fff;z-index:1;border-radius:14px 14px 0 0">
        <div>
          <div style="font-size:18px;font-weight:800;color:#0a1628">New Property</div>
          <div style="font-size:12px;color:#6b7280;margin-top:2px">Creates a draft — you'll fill in everything else on the next screen</div>
        </div>
        <button id="acm-close" style="background:none;border:none;cursor:pointer;font-size:20px;color:#9ca3af;padding:2px;line-height:1;margin-top:2px">✕</button>
      </div>
      <form id="acm-form" style="padding:20px 24px;display:flex;flex-direction:column;gap:14px">

        ${lbl('Title', true, inp('acm-title','title','text','e.g. Spacious 2BR in Downtown Austin','required maxlength="120"'))}

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          ${lbl('Property type', false, sel('acm-type','property_type',
            '<option value="">— Select —</option>' +
            ['apartment','house','condo','townhouse','studio','duplex','room'].map(v =>
              `<option value="${v}">${v.charAt(0).toUpperCase()+v.slice(1)}</option>`).join('')))}
          ${lbl('Monthly rent ($)', false, inp('acm-rent','monthly_rent','number','e.g. 1500','min="0" step="1"'))}
        </div>

        ${lbl('Street address', false, inp('acm-address','address','text','e.g. 123 Main St',''))}

        <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px">
          ${lbl('City', false, inp('acm-city','city','text','Austin',''))}
          ${lbl('State', false, sel('acm-state','state','<option value="">—</option>'+stateOpts))}
          ${lbl('ZIP', false, inp('acm-zip','zip','text','78701','maxlength="10"'))}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          ${lbl('Bedrooms', false, sel('acm-beds','bedrooms',
            '<option value="">—</option><option value="0">Studio</option>' +
            [1,2,3,4,5].map(n=>`<option value="${n}">${n}${n===5?'+':''}</option>`).join('')))}
          ${lbl('Bathrooms', false, sel('acm-baths','bathrooms',
            '<option value="">—</option>' +
            [1,1.5,2,2.5,3,3.5,4].map(n=>`<option value="${n}">${n}${n===4?'+':''}</option>`).join('')))}
        </div>

        <div id="acm-error" style="display:none;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:10px 14px;font-size:13px;color:#dc2626"></div>

        <div style="display:flex;gap:10px;padding-top:4px">
          <button type="button" id="acm-cancel"
            style="flex:1;padding:11px;border:1.5px solid #d1d5db;border-radius:8px;background:#fff;font-size:14px;font-weight:600;color:#374151;cursor:pointer">
            Cancel
          </button>
          <button type="submit" id="acm-submit"
            style="flex:2;padding:11px;border:none;border-radius:8px;background:#006aff;color:#fff;font-size:14px;font-weight:700;cursor:pointer">
            Create draft &amp; continue &rarr;
          </button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('acm-title')?.focus(), 60);

  const close = () => modal.remove();
  document.getElementById('acm-close').addEventListener('click', close);
  document.getElementById('acm-cancel').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });

  document.getElementById('acm-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl    = document.getElementById('acm-error');
    const submitBtn = document.getElementById('acm-submit');

    const title = document.getElementById('acm-title').value.trim();
    if (!title) {
      errEl.textContent = 'Title is required.';
      errEl.style.display = '';
      document.getElementById('acm-title').focus();
      return;
    }

    const rawRent = document.getElementById('acm-rent').value;
    const rawBeds = document.getElementById('acm-beds').value;
    const rawBaths = document.getElementById('acm-baths').value;

    const payload = {
      title,
      status:         'draft',
      property_type:  document.getElementById('acm-type').value  || null,
      monthly_rent:   rawRent  !== '' ? parseFloat(rawRent)  : null,
      address:        document.getElementById('acm-address').value.trim() || null,
      city:           document.getElementById('acm-city').value.trim()    || null,
      state:          document.getElementById('acm-state').value          || null,
      zip:            document.getElementById('acm-zip').value.trim()     || null,
      bedrooms:       rawBeds  !== '' ? Number(rawBeds)  : null,
      bathrooms:      rawBaths !== '' ? Number(rawBaths) : null,
    };

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating…';
    errEl.style.display = 'none';

    try {
      if (!window.CP?.sb) throw new Error('API not ready — please refresh the page');
      const { data, error } = await window.CP.sb()
        .from('properties')
        .insert([payload])
        .select('id')
        .single();
      if (error) throw new Error(error.message);

      // Audit log (non-blocking)
      try {
        const { data: sessData } = await window.CP.Auth.getSession();
        window.CP.sb().from('admin_actions').insert([{
          user_id:     sessData?.session?.user?.id || null,
          action:      'property.create',
          target_type: 'property',
          target_id:   String(data.id),
          metadata:    { title, status: 'draft', source: 'admin_create' }
        }]).catch(() => {});
      } catch (_) {}

      window.showToast?.('Draft created — opening editor…', 'success');
      setTimeout(() => {
        window.location.href = getAdminDetailHref(data.id, { edit: '1' }, payload);
      }, 600);
    } catch (err) {
      errEl.textContent = err.message || 'Failed to create property — please try again.';
      errEl.style.display = '';
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Create draft &amp; continue &rarr;';
    }
  });
}

function applyAdminCardOverlays(grid, props) {
  const STATUS_COLORS = {
    active:'#10b981', private_placement:'#8b5cf6', rented:'#3b82f6', inactive:'#6b7280',
    maintenance:'#f59e0b', draft:'#6366f1', paused:'#f97316', archived:'#ef4444'
  };
  grid.querySelectorAll('.property-card[data-id]').forEach(card => {
    const id   = card.dataset.id;
    const prop = props.find(p => p.id === id);
    if (!prop) return;
    const imgEl = card.querySelector('.property-card-img');
    if (!imgEl) return;
    imgEl.style.position = 'relative';

    // Bulk-select checkbox (top-left corner)
    const chkWrap = document.createElement('label');
    chkWrap.title = 'Select for bulk action';
    chkWrap.style.cssText = 'position:absolute;top:8px;left:8px;z-index:10;cursor:pointer;width:22px;height:22px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.85);border-radius:5px;box-shadow:0 1px 3px rgba(0,0,0,.25)';
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.dataset.adminId = id;
    chk.checked = _adminSelected.has(id);
    chk.style.cssText = 'width:15px;height:15px;cursor:pointer;accent-color:#006aff';
    chk.addEventListener('change', () => {
      if (chk.checked) _adminSelected.add(id);
      else _adminSelected.delete(id);
      _updateBulkBar();
    });
    chk.addEventListener('click', e => e.stopPropagation());
    chkWrap.addEventListener('click', e => e.stopPropagation());
    chkWrap.appendChild(chk);
    imgEl.appendChild(chkWrap);

    // Status badge (shifted right to not overlap checkbox)
    const badge = document.createElement('div');
    const col = STATUS_COLORS[prop.status] || '#6b7280';
    badge.style.cssText = `position:absolute;top:10px;left:40px;background:${col};color:#fff;font-size:11px;font-weight:700;padding:3px 9px;border-radius:12px;text-transform:uppercase;letter-spacing:.05em;z-index:5;pointer-events:none;box-shadow:0 1px 4px rgba(0,0,0,.3)`;
    badge.textContent = prop.status || 'unknown';
    imgEl.appendChild(badge);

    // Admin card quick actions (Edit + Quick Delete)
    const actionsWrap = document.createElement('div');
    actionsWrap.className = 'cp-admin-card-actions';

    const editBtn = document.createElement('a');
    editBtn.href = getAdminDetailHref(id, {}, prop);
    editBtn.className = 'cp-admin-card-btn';
    editBtn.innerHTML = '<i class="fas fa-pen"></i> Edit';
    editBtn.title = 'Edit this property (Admin)';
    editBtn.addEventListener('click', e => e.stopPropagation());

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'cp-admin-card-btn cp-admin-card-del';
    delBtn.dataset.adminQuickDelete = id;
    delBtn.innerHTML = '<i class="fas fa-trash-can"></i> Delete';
    delBtn.title = 'Delete this property (Admin)';
    delBtn.setAttribute('aria-label', `Delete ${prop.title || prop.address || 'property'}`);
    delBtn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      _confirmAndDeleteProperties([prop], delBtn);
    });

    actionsWrap.appendChild(editBtn);
    actionsWrap.appendChild(delBtn);
    imgEl.appendChild(actionsWrap);

    // Featured badge
    if (prop.featured) {
      const fBadge = document.createElement('div');
      fBadge.style.cssText = 'position:absolute;top:10px;right:10px;background:#f59e0b;color:#0a1628;font-size:10px;font-weight:800;padding:2px 8px;border-radius:10px;text-transform:uppercase;z-index:5;letter-spacing:.06em';
      fBadge.textContent = 'Featured';
      imgEl.appendChild(fBadge);
    }
  });
  _updateBulkBar();
}

function _updateBulkBar() {
  const bar = document.getElementById('adminBulkBar');
  if (!bar) return;
  const n = _adminSelected.size;
  if (n === 0) {
    bar.style.display = 'none';
    return;
  }
  bar.style.display = 'flex';
  const label = bar.querySelector('#bulkSelLabel');
  if (label) label.textContent = n + ' propert' + (n === 1 ? 'y' : 'ies') + ' selected';
}

function _bulkDeleteSelected() {
  const ids = [..._adminSelected];
  if (!ids.length) return;
  const items = ids.map(id => pageProperties.find(p => String(p.id) === String(id)) || { id });
  const btn = document.getElementById('bulkDeleteBtn');
  _confirmAndDeleteProperties(items, btn);
}

function _confirmAndDeleteProperties(items, triggerBtn) {
  if (!isAdminMode) return;
  const list = (Array.isArray(items) ? items : []).filter(item => item && item.id);
  if (!list.length) return;

  const existing = document.getElementById('adminDeleteConfirmModal');
  if (existing) existing.remove();

  const count = list.length;
  const isSingle = count === 1;
  const firstLabel = list[0].title || list[0].address || `Property ${list[0].id}`;
  const previewNames = list
    .slice(0, 4)
    .map(p => p.title || p.address || p.id);
  const extraCount = count - previewNames.length;

  const modal = document.createElement('div');
  modal.id = 'adminDeleteConfirmModal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(10,22,40,.68);backdrop-filter:blur(4px)';

  const card = document.createElement('div');
  card.style.cssText = 'background:#fff;border-radius:14px;width:100%;max-width:440px;padding:24px;box-shadow:0 24px 64px rgba(0,0,0,.35);color:#0f172a';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:12px';

  const iconBox = document.createElement('div');
  iconBox.style.cssText = 'width:40px;height:40px;border-radius:10px;background:#fef2f2;color:#dc2626;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0';
  iconBox.innerHTML = '<i class="fas fa-trash-can"></i>';

  const titleEl = document.createElement('h3');
  titleEl.style.cssText = 'margin:0;font-size:17px;font-weight:800;color:#0f172a';
  titleEl.textContent = isSingle ? 'Delete this property?' : `Delete ${count} selected properties?`;

  header.appendChild(iconBox);
  header.appendChild(titleEl);

  const desc = document.createElement('p');
  desc.style.cssText = 'margin:0 0 12px;font-size:13.5px;line-height:1.5;color:#475569';
  desc.textContent = isSingle
    ? `This permanently deletes "${firstLabel}" and its photos from the live inventory.`
    : `This permanently deletes ${count} properties and their photos from the live inventory.`;

  const listBox = document.createElement('ul');
  listBox.style.cssText = 'margin:0 0 18px;padding:10px 14px 10px 28px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:12.5px;color:#334155;line-height:1.55';
  previewNames.forEach(name => {
    const li = document.createElement('li');
    li.textContent = name;
    listBox.appendChild(li);
  });
  if (extraCount > 0) {
    const li = document.createElement('li');
    li.style.color = '#64748b';
    li.textContent = `…and ${extraCount} more`;
    listBox.appendChild(li);
  }

  const errEl = document.createElement('div');
  errEl.style.cssText = 'display:none;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:9px 12px;font-size:12.5px;color:#b91c1c;margin-bottom:14px';

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:10px';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'padding:9px 16px;border:1.5px solid #cbd5e1;border-radius:8px;background:#fff;color:#334155;font-size:13px;font-weight:600;cursor:pointer';

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.textContent = isSingle ? 'Delete Property' : `Delete ${count} Properties`;
  confirmBtn.style.cssText = 'padding:9px 18px;border:none;border-radius:8px;background:#dc2626;color:#fff;font-size:13px;font-weight:700;cursor:pointer';

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(confirmBtn);

  card.appendChild(header);
  card.appendChild(desc);
  card.appendChild(listBox);
  card.appendChild(errEl);
  card.appendChild(btnRow);
  modal.appendChild(card);
  document.body.appendChild(modal);

  let busy = false;
  const close = () => {
    if (busy) return;
    document.removeEventListener('keydown', onKey);
    modal.remove();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  cancelBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  confirmBtn.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    errEl.style.display = 'none';
    cancelBtn.disabled = true;
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting…';

    const ok = await _executeAdminPropertyDelete(list, triggerBtn, (msg) => {
      errEl.textContent = msg;
      errEl.style.display = '';
    });

    busy = false;
    if (ok) {
      document.removeEventListener('keydown', onKey);
      modal.remove();
    } else {
      cancelBtn.disabled = false;
      confirmBtn.disabled = false;
      confirmBtn.textContent = isSingle ? 'Delete Property' : `Delete ${count} Properties`;
    }
  });
}

async function _executeAdminPropertyDelete(items, triggerBtn, onError) {
  const ids = items.map(p => String(p.id)).filter(Boolean);
  if (!ids.length) return true;

  let prevBtnHtml = null;
  if (triggerBtn) {
    prevBtnHtml = triggerBtn.innerHTML;
    triggerBtn.disabled = true;
    triggerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting…';
  }

  try {
    const adminConfirmed = await window.CP?.Auth?.isAdmin?.();
    if (!adminConfirmed) {
      throw new Error('Admin session required to delete properties.');
    }

    const res = await window.CP.Properties.deleteCascadeBulk(ids);
    if (!res || !res.ok) {
      throw new Error(res?.error || 'Could not delete properties.');
    }

    const deletedIds = Array.isArray(res.data?.deleted_ids) && res.data.deleted_ids.length
      ? res.data.deleted_ids.map(String)
      : ids;
    const deletedCount = Number(res.data?.deleted ?? deletedIds.length);
    const fileIds = Array.isArray(res.data?.file_ids) ? res.data.file_ids.filter(Boolean) : [];

    // Asynchronous remote storage purge (ImageKit)
    if (fileIds.length && window.CONFIG?.SUPABASE_URL) {
      try {
        const sess = await window.CP?.Auth?.getSession?.().catch(() => null);
        const authKey = sess?.access_token || window.CONFIG.SUPABASE_ANON_KEY || '';
        fetch(`${window.CONFIG.SUPABASE_URL.replace(/\/$/, '')}/functions/v1/imagekit-delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: window.CONFIG.SUPABASE_ANON_KEY || authKey,
            Authorization: `Bearer ${authKey}`,
          },
          body: JSON.stringify({ fileIds, propertyIds: deletedIds }),
        }).catch(() => {});
      } catch (_) {}
    }

    // Audit log (non-blocking)
    try {
      const sess = await window.CP?.Auth?.getSession?.().catch(() => null);
      const uid = sess?.user?.id || null;
      if (uid) {
        const rows = deletedIds.map(id => {
          const item = items.find(p => String(p.id) === id);
          return {
            user_id: uid,
            action: 'property.hard_delete',
            target_type: 'property',
            target_id: id,
            metadata: {
              title: item?.title || item?.address || null,
              source: items.length > 1 ? 'listings_bulk_delete' : 'listings_card_quick_delete',
              deleted_at: new Date().toISOString(),
            },
          };
        });
        window.CP.sb().from('admin_actions').insert(rows).catch(() => {});
      }
    } catch (_) {}

    deletedIds.forEach(id => _adminSelected.delete(id));
    _updateBulkBar();

    window.showToast?.(
      deletedCount === 1
        ? 'Property deleted.'
        : `${deletedCount} properties deleted.`,
      'success'
    );

    // If current page now has no items left and we're past page 1, step back cleanly
    if (deletedIds.length >= pageProperties.length && currentPage > 1) {
      currentPage = Math.max(1, currentPage - 1);
      pushURL(true);
    }
    await fetchAndRender();
    return true;
  } catch (err) {
    const msg = err?.message || 'Delete failed. Please try again.';
    window.showToast?.(msg, 'error');
    if (typeof onError === 'function') onError(msg);
    if (triggerBtn && document.body.contains(triggerBtn)) {
      triggerBtn.disabled = false;
      if (prevBtnHtml !== null) triggerBtn.innerHTML = prevBtnHtml;
    }
    return false;
  }
}

async function _bulkStatusChange() {
  const ids = [..._adminSelected];
  if (!ids.length) return;
  const bar = document.getElementById('adminBulkBar');
  const sel = bar?.querySelector('#bulkStatusSel');
  const newStatus = sel?.value;
  if (!newStatus) { window.showToast?.('Pick a status first', 'error'); return; }

  // Confirmation dialog — prevents accidental mass status changes
  const confirmed = window.confirm(
    `Change ${ids.length} propert${ids.length === 1 ? 'y' : 'ies'} to "${newStatus}"?\n\nThis will update all selected properties immediately.`
  );
  if (!confirmed) return;

  const btn = bar?.querySelector('#bulkApplyBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  // Resolve session once — used for audit log entries
  let userId = null;
  try {
    const session = await window.CP.Auth.getSession();
    userId = session?.user?.id || null;
  } catch (_) {}

  let ok = 0, fail = 0;
  await Promise.all(ids.map(async id => {
    try {
      const oldStatus = pageProperties.find(p => String(p.id) === String(id))?.status || null;
      const res = await window.CP.Properties.update(id, { status: newStatus });
      if (res && res.ok !== false) {
        ok++;
        // Audit log — non-blocking, mirrors the pattern used by property.js status changes
        try {
          if (userId) {
            await window.CP.sb().from('admin_actions').insert({
              action:      'property.status_change',
              target_type: 'property',
              target_id:   id,
              metadata:    { from: oldStatus, to: newStatus, source: 'bulk' },
              user_id:     userId,
            });
          }
        } catch (_) {}
      } else {
        fail++;
      }
    } catch { fail++; }
  }));

  if (btn) { btn.disabled = false; btn.textContent = 'Apply'; }
  window.showToast?.(ok + ' updated' + (fail ? ', ' + fail + ' failed' : ''), fail ? 'error' : 'success');
  _adminSelected.clear();
  _updateBulkBar();
  document.querySelectorAll('[data-admin-id]').forEach(c => { c.checked = false; });
  await fetchAndRender();
}

async function _bulkCreateMatch() {
  const ids = [..._adminSelected];
  if (!ids.length) return;

  const button = document.getElementById('bulkMatchBtn');
  if (button) { button.disabled = true; button.textContent = 'Creating…'; }
  let shareToken;
  try {
    const { data, error } = await window.CP.sb().functions.invoke('property-share', {
      body: { action: 'create', property_ids: ids },
    });
    if (error) throw error;
    if (!data?.token) throw new Error(data?.error || 'Share link was not created');
    shareToken = data.token;
  } catch (error) {
    window.showToast?.('Could not create share link: ' + (error?.message || 'Unknown error'), 'error');
    if (button) { button.disabled = false; button.textContent = 'Create Client Link'; }
    return;
  }
  const url = `${window.location.origin}/listings.html#share=${encodeURIComponent(shareToken)}`;
  
  try {
    await navigator.clipboard.writeText(url);
  } catch (_) {}

  // Render modal dialog for the admin
  const modal = document.createElement('div');
  modal.id = 'adminMagicLinkModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.65);backdrop-filter:blur(4px)';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:28px;max-width:540px;width:100%;box-shadow:0 20px 40px rgba(0,0,0,.25);position:relative;animation:modalIn .15s ease-out">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;background:rgba(16,185,129,.12);border-radius:10px;display:flex;align-items:center;justify-content:center;color:#10b981;font-size:18px">
            <i class="fas fa-link"></i>
          </div>
          <div>
            <h3 style="margin:0;font-size:17px;font-weight:700;color:#0f172a">Client Multi-Property Magic Link</h3>
            <span style="font-size:12px;color:#64748b">${ids.length} tailored propert${ids.length === 1 ? 'y' : 'ies'} attached</span>
          </div>
        </div>
        <button id="closeMagicModalBtn" style="background:none;border:none;font-size:18px;color:#94a3b8;cursor:pointer;padding:4px 8px;border-radius:6px">✕</button>
      </div>
      
      <p style="font-size:13.5px;color:#475569;margin:0 0 16px;line-height:1.5">
        This link shows only these properties and expires in 90 days. Anyone who has the link can use it, so share it only with the intended client.
      </p>

      <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:8px;padding:10px 12px;display:flex;align-items:center;gap:8px;margin-bottom:20px">
        <input type="text" readonly id="magicLinkInput" value="${url}" style="background:none;border:none;font-size:12.5px;color:#0f172a;width:100%;outline:none;font-family:monospace;text-overflow:ellipsis">
        <button id="copyModalLinkBtn" style="background:#006aff;color:#fff;border:none;border-radius:6px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:6px">
          <i class="fas fa-copy"></i> Copy
        </button>
      </div>

      <div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap">
        <a href="/admin/watermark-sniper.html#share=${encodeURIComponent(shareToken)}" target="_blank" rel="noopener" style="background:#dc2626;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:6px">
          <i class="fas fa-crosshairs"></i> Open in Sniper
        </a>
        <a href="${url}" target="_blank" rel="noopener" style="background:transparent;border:1.5px solid #cbd5e1;color:#334155;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:6px">
          <i class="fas fa-external-link-alt"></i> Preview Link
        </a>
        <button id="revokeMagicLinkBtn" style="background:#fff;color:#b91c1c;border:1px solid #fecaca;border-radius:8px;padding:8px 12px;font-size:13px;font-weight:600;cursor:pointer">Revoke</button>
        <button id="doneMagicModalBtn" style="background:#0f172a;color:#fff;border:none;border-radius:8px;padding:8px 20px;font-size:13px;font-weight:600;cursor:pointer">
          Done
        </button>
      </div>
    </div>`;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#closeMagicModalBtn').addEventListener('click', close);
  modal.querySelector('#doneMagicModalBtn').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  modal.querySelector('#revokeMagicLinkBtn').addEventListener('click', async event => {
    const revokeButton = event.currentTarget;
    revokeButton.disabled = true;
    revokeButton.textContent = 'Revoking…';
    try {
      const { data, error } = await window.CP.sb().functions.invoke('property-share', {
        body: { action: 'revoke', token: shareToken },
      });
      if (error) throw error;
      if (!data?.revoked) throw new Error(data?.error || 'Share could not be revoked');
      window.showToast?.('Share link revoked.', 'success');
      close();
    } catch (error) {
      window.showToast?.('Could not revoke link: ' + (error?.message || 'Unknown error'), 'error');
      revokeButton.disabled = false;
      revokeButton.textContent = 'Revoke';
    }
  });

  const copyBtn = modal.querySelector('#copyModalLinkBtn');
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
      copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
      copyBtn.style.background = '#10b981';
      setTimeout(() => {
        copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
        copyBtn.style.background = '#006aff';
      }, 2000);
    } catch (_) {
      const inp = modal.querySelector('#magicLinkInput');
      inp.select();
      document.execCommand('copy');
    }
  });

  window.showToast?.(`Link with ${ids.length} properties copied to clipboard!`, 'success');
  
  _adminSelected.clear();
  _updateBulkBar();
  document.querySelectorAll('[data-admin-id]').forEach(c => { c.checked = false; });
  if (button) { button.disabled = false; button.textContent = 'Create Client Link'; }
}

async function _bulkSetFeatured(featured) {
  const ids = [..._adminSelected];
  if (!ids.length) return;
  const label = featured ? 'feature' : 'unfeature';
  const confirmed = window.confirm(
    `${featured ? 'Feature' : 'Unfeature'} ${ids.length} propert${ids.length === 1 ? 'y' : 'ies'}?\n\n` +
    (featured
      ? 'These properties will appear as Featured on the public listings page.'
      : 'These properties will no longer appear as Featured.')
  );
  if (!confirmed) return;

  const fBtn = document.getElementById(featured ? 'bulkFeatureBtn' : 'bulkUnfeatureBtn');
  if (fBtn) { fBtn.disabled = true; fBtn.textContent = 'Saving…'; }

  let userId = null;
  try {
    const session = await window.CP.Auth.getSession();
    userId = session?.user?.id || null;
  } catch (_) {}

  let ok = 0, fail = 0;
  await Promise.all(ids.map(async id => {
    try {
      const oldVal = pageProperties.find(p => String(p.id) === String(id))?.featured ?? null;
      const res = await window.CP.Properties.update(id, { featured });
      if (res && res.ok !== false) {
        ok++;
        try {
          if (userId) {
            await window.CP.sb().from('admin_actions').insert({
              action:      'property.featured_change',
              target_type: 'property',
              target_id:   id,
              metadata:    { from: oldVal, to: featured, source: 'bulk' },
              user_id:     userId,
            });
          }
        } catch (_) {}
      } else {
        fail++;
      }
    } catch { fail++; }
  }));

  if (fBtn) {
    fBtn.disabled = false;
    fBtn.textContent = featured ? '⭐ Feature' : 'Unfeature';
  }
  window.showToast?.(ok + ' ' + label + 'd' + (fail ? ', ' + fail + ' failed' : ''), fail ? 'error' : 'success');
  _adminSelected.clear();
  _updateBulkBar();
  document.querySelectorAll('[data-admin-id]').forEach(c => { c.checked = false; });
  await fetchAndRender();
}

async function adminCSVExport() {
  const btn = document.getElementById('adminCsvExportBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting…'; }
  try {
    const result = await window.CP.Properties.getListingsAdmin({
      status: adminStatusFilter,
      landlord: adminLandlordId,
      q: activeSearch,
      sort: sortBy,
      per_page: 1000,
      page: 1,
    });
    if (!result.ok) throw new Error(result.error);
    const rows = result.data.rows;
    const headers = ['id','title','status','address','city','state','zip','monthly_rent','bedrooms','bathrooms','property_type','available_date','landlord_id','created_at','views_count','applications_count'];
    const csvRows = [headers.join(',')];
    rows.forEach(r => {
      csvRows.push(headers.map(h => {
        const v = r[h] == null ? '' : String(r[h]);
        return v.includes(',') || v.includes('"') || v.includes('\n') ? '"' + v.replace(/"/g,'""') + '"' : v;
      }).join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type:'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'properties-export.csv'; a.click();
    URL.revokeObjectURL(url);
    if (typeof showToast === 'function') showToast(`Exported ${rows.length} properties`, 'success');
  } catch(e) {
    if (typeof showToast === 'function') showToast('Export failed: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-download"></i> Export CSV'; }
  }
}

// ── Boot ─────────────────────────────────────────────────────────────────
(async () => {
  try {
    await waitForCP();
    // Parse URL first so activeShareToken / status params are available when admin toolbar injects
    readURL();
    // Admin mode detection (non-blocking — runs before first fetch)
    await initAdminMode();
    // Refresh saved IDs from Supabase for authenticated users (non-blocking)
    window.CP.SavedProperties.getIds().then(ids => { savedIds = ids; }).catch(() => {});
    setupScrollTop();
    setupGridDelegation(); // P1-A: wire delegated listeners once at boot
    readURL();
    syncControls();
    if (isAdminMode) syncAdminToolbarUI();
    setupFilters();
    // Restore filter dropdown state from sessionStorage (for mobile progressive disclosure)
    const filterDropdown = document.getElementById('moreFiltersDropdown');
    if (filterDropdown && sessionStorage.getItem('filters_dropdown_open') === 'true') {
      filterDropdown.classList.add('open');
    }
    await fetchAndRender();
    const onUrlChange = async () => {
      readURL();
      syncControls();
      if (isAdminMode) syncAdminToolbarUI();
      await fetchAndRender();
    };
    window.addEventListener('popstate', onUrlChange);
    window.addEventListener('hashchange', onUrlChange);
  } catch (err) {
    console.error('Listings boot error:', err);
    renderError(err.message || 'Failed to load listings');
  }
})();

// ── Core fetch ────────────────────────────────────────────────────────────
async function fetchAndRender() {
  if (isLoading) return;
  isLoading = true;

  showSkeletons();

  // Swap min/max rent if user entered them backwards — prevents silent empty results
    if (activeMinRent && activeMaxRent) {
      const _minR = parseFloat(activeMinRent);
      const _maxR = parseFloat(activeMaxRent);
      if (!isNaN(_minR) && !isNaN(_maxR) && _minR > _maxR) {
        activeMinRent = String(_maxR);
        activeMaxRent = String(_minR);
        const minEl = document.getElementById('advMinRent');
        const maxEl = document.getElementById('advMaxRent');
        if (minEl) minEl.value = activeMinRent;
        if (maxEl) maxEl.value = activeMaxRent;
      }
    }

    try {
    const fetchTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out. Please check your connection and try again.')), 10000)
    );
    const fetchPromise = (isAdminMode && !activeShareToken && !(activeTargetIds && activeTargetIds.length))
      ? CP.Properties.getListingsAdmin({
          q:            activeSearch,
          status:       adminStatusFilter,
          landlord:     adminLandlordId,
          type:         activeType,
          beds:         activeBeds,
          min_baths:    activeMinBaths,
          min_rent:     activeMinRent,
          max_rent:     activeMaxRent,
          min_sqft:     activeMinSqft,
          max_sqft:     activeMaxSqft,
          amenity:      activeAmenity,
          laundry_type: activeLaundry,
          heating_type: activeHeating,
          pet_type:     activePetType,
          sort:         sortBy,
          page:         currentPage,
          per_page:     PER_PAGE,
        })
      : CP.Properties.getListings({
          target_ids:   activeTargetIds,
          share_token:  activeShareToken,
          q:            activeSearch,
          type:         activeType,
          beds:         activeBeds,
          min_baths:    activeMinBaths,
          min_rent:     activeMinRent,
          max_rent:     activeMaxRent,
          min_sqft:     activeMinSqft,
          max_sqft:     activeMaxSqft,
          amenity:      activeAmenity,
          laundry_type: activeLaundry,
          heating_type: activeHeating,
          pet_type:     activePetType,
          sort:         sortBy,
          page:         currentPage,
          per_page:     PER_PAGE,
        });
    const result = await Promise.race([fetchPromise, fetchTimeout]);

    if (!result.ok) {
      console.error('Failed to load listings:', result.error);
      const subheadingEl = document.getElementById('listingsSubheading');
      if (subheadingEl) {
        subheadingEl.innerHTML = '<span style="color:var(--color-error);font-size:0.9rem;"><i class="fas fa-exclamation-circle"></i> Unable to load listings. Please try again.</span>';
      }
      renderError(result.error);
      return;
    }

    const { rows, total, total_pages } = result.data;
    totalCount = total;
    totalPages = total_pages;
    pageProperties = rows || [];

    if (typeof window !== 'undefined') {
      window.__CP_ACTIVE_SHARE_TOKEN__ = activeShareToken || '';
    }
    if (activeShareToken && Array.isArray(rows)) {
      try {
        rows.forEach((r) => {
          if (r && r.id) {
            sessionStorage.setItem('cp_share_token_for_' + String(r.id).toLowerCase(), activeShareToken);
          }
        });
      } catch (_) {}
    }

    renderProperties(rows);
    renderPagination();
    if (currentView === 'map') initMap(rows);

    // Update admin count display
    if (isAdminMode) {
      const countEl = document.getElementById('adminPropCount');
      if (countEl) countEl.textContent = `${total.toLocaleString()} propert${total === 1 ? 'y' : 'ies'}`;
      const shareCountEl = document.getElementById('adminShareCountTxt');
      if (shareCountEl) shareCountEl.textContent = `${total.toLocaleString()} listing${total === 1 ? '' : 's'} in this magic link`;
    }
  } catch (err) {
    console.error('fetchAndRender error:', err);
    renderError(err?.message);
  } finally {
    isLoading = false;
  }
}

// ── Trigger search (resets to page 1) ─────────────────────────────────────
async function refreshResults() {
  currentPage = 1;
  pushURL();
  await fetchAndRender();
}
window.refreshResults = refreshResults;

// ── Skeletons ─────────────────────────────────────────────────────────────
function showSkeletons() {
  const grid = document.getElementById('propertyGrid');
  const sk = (w1, w2, w3) => `
    <div class="property-card property-card-skeleton">
      <div class="property-card-img skeleton-img skeleton"></div>
      <div class="property-card-body" style="gap:10px;padding:20px">
        <div class="skeleton skeleton-line" style="height:26px;width:${w1}%"></div>
        <div class="skeleton skeleton-line" style="width:${w2}%"></div>
        <div class="skeleton skeleton-line" style="width:${w3}%"></div>
        <div class="skeleton skeleton-line" style="height:12px;width:40%;margin-top:8px"></div>
      </div>
    </div>`;
  grid.innerHTML = [sk(35,80,55),sk(38,75,60),sk(32,85,50),sk(40,78,58),sk(36,82,52),sk(34,76,62)].join('');
  const pg = document.getElementById('paginationBar');
  if (pg) pg.innerHTML = '';
}

// ── updateNav ─────────────────────────────────────────────────────────────
async function updateNav() {
  const session    = await CP.Auth.getSession();
  const authLink   = document.getElementById('navAuthLink');
  const drawerLink = document.getElementById('drawerAuthLink');
  const drawerListLink = document.getElementById('drawerListPropertyLink');
  const dest  = session ? '/landlord/dashboard.html' : '/landlord/login.html';
  const label = session ? 'My Dashboard' : 'Landlord Login';
  if (authLink)   { authLink.href = dest;   authLink.textContent = label; }
  if (drawerLink) { drawerLink.href = dest; drawerLink.textContent = label; }
  if (session && drawerListLink) drawerListLink.href = '/landlord/new-listing.html';
  if (window.CONFIG) {
    const footerEmail = document.getElementById('drawerFooterEmail');
    if (footerEmail) { footerEmail.href = `mailto:${CONFIG.COMPANY_EMAIL}`; footerEmail.textContent = CONFIG.COMPANY_EMAIL; }
    document.querySelectorAll('[data-cfg-email]').forEach(el => { el.href = `mailto:${CONFIG.COMPANY_EMAIL}`; el.textContent = CONFIG.COMPANY_EMAIL; });
    document.querySelectorAll('[data-cfg-phone]').forEach(el => { el.href = `tel:${CONFIG.COMPANY_PHONE.replace(/\D/g,'')}`; el.textContent = CONFIG.COMPANY_PHONE; });
  }
}

// ── renderProperties ──────────────────────────────────────────────────────
function renderProperties(props) {
  const grid      = document.getElementById('propertyGrid');
  if (!grid) return;
  const heading   = document.getElementById('listingsHeading');
  const hasTargetIds = activeTargetIds && activeTargetIds.length > 0;
  const hasShare = !!activeShareToken;
  const hasFilters = hasTargetIds || hasShare || activeType !== 'all' || activeSearch || activeBeds || activeMaxRent || activeMinRent || activeMinBaths || activeMinSqft || activeMaxSqft || activeAmenity || activeLaundry || activeHeating || activePetType;

  if (heading) {
    if (hasShare) {
      heading.innerHTML = `Shared Properties <span style="font-size:0.9rem;font-weight:400;color:var(--color-text-secondary);margin-left:8px">(${props.length} propert${props.length === 1 ? 'y' : 'ies'})</span>`;
    } else if (hasTargetIds) {
      heading.innerHTML = `Tailored Selection <span style="font-size:0.9rem;font-weight:400;color:var(--color-text-secondary);margin-left:8px">(${props.length} propert${props.length === 1 ? 'y' : 'ies'})</span> <a href="/listings.html" style="font-size:0.85rem;color:var(--color-brand);margin-left:14px;font-weight:600;text-decoration:underline">Browse All Listings &rarr;</a>`;
    } else {
      heading.textContent = hasFilters ? 'Results' : 'All Listings';
    }
  }

  if (!props.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;text-align:center;padding:var(--s-16) var(--s-6)">
        <div class="empty-state-icon"><i class="fas fa-search" style="font-size:40px;color:var(--color-text-muted)"></i></div>
        <h3 style="margin:var(--s-4) 0 var(--s-2)">No listings match your filters</h3>
        <p style="color:var(--color-text-secondary)">Try adjusting your search or <button onclick="window.clearAllFilters()" style="background:none;border:none;color:var(--color-brand);cursor:pointer;font-size:inherit;padding:0;text-decoration:underline">clearing all filters</button></p>
      </div>`;
    return;
  }

  grid.innerHTML = props.map(p => buildCard(p)).join('');

  // Mark saved state only — click events handled by delegated listeners (P1-A)
  grid.querySelectorAll('.property-card-save').forEach(btn => {
    if (savedIds.has(btn.dataset.id)) { btn.classList.add('saved'); btn.innerHTML = '<i class="fas fa-heart"></i>'; }
  });

  // Admin mode: overlay status badges and edit buttons on each card
  if (isAdminMode) applyAdminCardOverlays(grid, props);

  lazyInitCarousels(grid); // P1-C: initialize carousels only as cards enter viewport
  animateCards();
}

// ── Pagination ────────────────────────────────────────────────────────────
function renderPagination() {
  const bar = document.getElementById('paginationBar');
  if (!bar) return;
  if (totalPages <= 1) { bar.innerHTML = ''; return; }

  const show   = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1].filter(n => n >= 1 && n <= totalPages));
  const sorted = [...show].sort((a, b) => a - b);

  let html = `<div class="pagination">`;
  html += `<button class="pg-btn pg-prev" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}" aria-label="Previous page"><i class="fas fa-chevron-left"></i></button>`;
  let prev = 0;
  for (const n of sorted) {
    if (prev && n - prev > 1) html += `<span class="pg-ellipsis">…</span>`;
    html += `<button class="pg-btn${n === currentPage ? ' pg-active' : ''}" data-page="${n}">${n}</button>`;
    prev = n;
  }
  html += `<button class="pg-btn pg-next" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}" aria-label="Next page"><i class="fas fa-chevron-right"></i></button>`;
  html += `</div>`;
  bar.innerHTML = html;

  bar.querySelectorAll('.pg-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      currentPage = parseInt(btn.dataset.page);
      pushURL();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      await fetchAndRender();
    });
  });
}

/* ─── Build card ─── */
// Delegates to the unified card builder in /js/card-builder.js
function buildCard(p) {
  return buildPropertyCard(p, {
    imgSizes: '(max-width: 599px) calc(100vw - 32px), 300px',
  });
}

/* ─── Animate Cards ─── */
function animateCards() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.property-card:not(.property-card-skeleton)').forEach(c => c.classList.add('cp-card-visible'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('cp-card-visible'); observer.unobserve(e.target); }
    });
  }, { threshold: 0.06 });
  let i = 0;
  document.querySelectorAll('.property-card:not(.property-card-skeleton)').forEach(card => {
    card.style.setProperty('--cp-delay', Math.min(i * 55, 320) + 'ms');
    observer.observe(card);
    i++;
  });
}

/* ─── Carousel ─── */
// Delegates to the unified carousel in /js/card-builder.js
function initCarousel(card) {
  initCardCarousel(card);
}

/* ─── P1-A: Grid event delegation ───────────────────────────────────────────
   Set up once at boot — survives every re-render without re-attaching.
   Replaces 72+ per-card listeners (save × 24, share × 24, click-through × 24)
   with 4 permanent listeners on the container.
   ─────────────────────────────────────────────────────────────────────────── */
function setupGridDelegation() {
  const grid = document.getElementById('propertyGrid');
  if (!grid || grid._delegated) return;
  grid._delegated = true;

  // City badge — navigate to the city-specific listing page
  grid.addEventListener('click', e => {
    const btn = e.target.closest('.prop-city-badge');
    if (!btn) return;
    e.preventDefault(); e.stopPropagation();
    window.location.href = btn.dataset.cityUrl;
  });

  // Save (heart)
  grid.addEventListener('click', e => {
    const btn = e.target.closest('.property-card-save');
    if (!btn) return;
    e.preventDefault(); e.stopPropagation();
    toggleSave(btn.dataset.id, btn);
  });

  // Share — native share API / clipboard fallback
  grid.addEventListener('click', e => {
    const btn = e.target.closest('.property-card-share');
    if (!btn) return;
    e.preventDefault(); e.stopPropagation();
    let targetPath = btn.dataset.url || (btn.dataset.id ? `/property.html?id=${encodeURIComponent(btn.dataset.id)}` : '');
    let url = location.origin + targetPath;
    if (activeShareToken && !url.includes('#share=')) {
      url += `#share=${encodeURIComponent(activeShareToken)}`;
    }
    const title = btn.dataset.title || 'Check out this property';
    if (navigator.share) {
      navigator.share({ title, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url)
        .then(() => showToast('Link copied to clipboard!', 'success'))
        .catch(() => showToast('Could not copy link', 'error'));
    }
  });

  // Card click-through (not on links or buttons).
  grid.addEventListener('click', e => {
    if (e.target.closest('a, button')) return;
    const card = e.target.closest('.property-card');
    if (!card || !card.dataset.id) return;
    const clickedProp = pageProperties.find(p => String(p.id) === String(card.dataset.id));
    const privParam = (!activeShareToken && isAdminMode && (adminStatusFilter === 'private_placement' || clickedProp?.status === 'private_placement'))
      ? '&from_status=private_placement'
      : '';
    const shareParam = activeShareToken ? `#share=${encodeURIComponent(activeShareToken)}` : '';
    window.location.href = `/property.html?id=${encodeURIComponent(card.dataset.id)}${privParam}${shareParam}`;
  });

  // P1-D: Switch non-first slide images from lazy → eager on first hover & highlight map pin
  grid.addEventListener('mouseover', e => {
    const card = e.target.closest('.property-card');
    if (!card) return;
    if (!card._preloaded) {
      card._preloaded = true;
      card.querySelectorAll('.property-card-slide img[loading="lazy"]').forEach(img => {
        img.loading = 'eager';
      });
    }
    const id = card.dataset.id;
    if (id && mapMarkers.length) {
      const marker = mapMarkers.find(m => m._propId === id);
      if (marker && marker._icon) {
        marker._icon.classList.add('map-marker-hover');
      }
    }
  });

  grid.addEventListener('mouseout', e => {
    const card = e.target.closest('.property-card');
    if (!card) return;
    const id = card.dataset.id;
    if (id && mapMarkers.length) {
      const marker = mapMarkers.find(m => m._propId === id);
      if (marker && marker._icon) {
        marker._icon.classList.remove('map-marker-hover');
      }
    }
  });
}

/* ─── P1-C: Lazy carousel initialization ────────────────────────────────────
   Defer initCarousel until each card enters a 200px margin around the viewport.
   Cuts JS work at initial render by ~75% on a full 24-card grid.
   ─────────────────────────────────────────────────────────────────────────── */
function lazyInitCarousels(grid) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        initCarousel(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { rootMargin: '200px 0px' });
  grid.querySelectorAll('.property-card').forEach(card => observer.observe(card));
}

/* ─── Map ─── */
// M-10: Leaflet CSS+JS (~180KB gzipped) is loaded on demand only when the
// user clicks "Map View". Saves bandwidth on every listing page visit.
const _LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
const _LEAFLET_JS  = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';

function loadLeaflet() {
  return new Promise((resolve, reject) => {
    if (window.L) { resolve(); return; }
    if (!document.querySelector(`link[href="${_LEAFLET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = _LEAFLET_CSS;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = _LEAFLET_JS;
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      // Remove map loading spinner when Leaflet loads
      const mapSpinner = document.getElementById('mapLoadingSpinner');
      if (mapSpinner) mapSpinner.style.display = 'none';
      resolve();
    };
    script.onerror = () => {
      // Hide spinner on error  
      const mapSpinner = document.getElementById('mapLoadingSpinner');
      if (mapSpinner) mapSpinner.style.display = 'none';
      reject();
    };
    document.head.appendChild(script);
  });
}

let mapProgrammaticMove = false;
let isFetchingBounds = false;

function initMap(props, isBoundsUpdate = false) {
  if (!mapInstance) {
    mapInstance = L.map('listingsMap', { zoomControl: false }).setView([39.5, -98.35], 4);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ', maxZoom: 18
    }).addTo(mapInstance);
    L.control.zoom({ position: 'bottomright' }).addTo(mapInstance);

    mapInstance.on('moveend', async () => {
      if (currentView !== 'map' || mapProgrammaticMove || isFetchingBounds || activeShareToken || (activeTargetIds && activeTargetIds.length) || (isAdminMode && adminStatusFilter !== 'active')) return;
      isFetchingBounds = true;
      const b = mapInstance.getBounds();
      const result = await CP.Properties.getListings({
        q: activeSearch, type: activeType, beds: activeBeds,
        min_baths: activeMinBaths, min_rent: activeMinRent, max_rent: activeMaxRent,
        min_sqft: activeMinSqft, max_sqft: activeMaxSqft, amenity: activeAmenity,
        laundry_type: activeLaundry, heating_type: activeHeating, pet_type: activePetType,
        sort: sortBy, per_page: 50,
        min_lat: b.getSouth(), max_lat: b.getNorth(),
        min_lng: b.getWest(), max_lng: b.getEast()
      });
      isFetchingBounds = false;
      if (result.ok) initMap(result.data.rows, true);
    });
  }
  mapMarkers.forEach(m => m.remove()); mapMarkers = [];
  const bounds = [];
  props.forEach(p => {
    if (!p.lat || !p.lng) return;
    const lat = parseFloat(p.lat), lng = parseFloat(p.lng);
    if (isNaN(lat) || isNaN(lng)) return;
    const safeId = encodeURIComponent(p.id || '');
    const safeTitle = esc(p.title || 'Rental property');
    const safeImg = esc(CONFIG.img(p.photo_urls?.[0] || '','card'));
    const safeRent = Number(p.monthly_rent || 0);
    // Canonical property details URL
    let popupHref = (window.CP && window.CP.UI && window.CP.UI.propertyUrl)
      ? window.CP.UI.propertyUrl(p)
      : `/property.html?id=${safeId}`;
    if (!activeShareToken && isAdminMode && (adminStatusFilter === 'private_placement' || p.status === 'private_placement')) {
      popupHref += (popupHref.includes('?') ? '&' : '?') + 'from_status=private_placement';
    }
    if (activeShareToken) popupHref += `#share=${encodeURIComponent(activeShareToken)}`;
    popupHref = esc(popupHref);
    bounds.push([lat, lng]);
    const icon = L.divIcon({
      className: '',
      html: `<div class="map-marker-price">$${(safeRent/1000).toFixed(safeRent >= 1000 ? 1 : 0)}${safeRent >= 1000 ? 'k' : ''}</div>`,
      iconAnchor: [30, 16], iconSize: [60, 32],
    });
    const marker = L.marker([lat, lng], { icon }).addTo(mapInstance);
    marker._propId = p.id;
    marker.on('popupopen', () => {
      const card = document.getElementById(`card-${p.id}`);
      if (card) {
        card.classList.add('property-card-highlighted');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        setTimeout(() => card.classList.remove('property-card-highlighted'), 2000);
      }
    });
    marker.bindPopup(`
      <a href="${popupHref}" class="map-popup-card">
        <img class="map-popup-img" src="${safeImg}" alt="${safeTitle}" loading="lazy" referrerpolicy="no-referrer">
        <div class="map-popup-body">
          <div class="map-popup-price">$${safeRent.toLocaleString()}<span>/mo</span></div>
          <div class="map-popup-title">${safeTitle}</div>
          <div class="map-popup-meta">
            ${p.bedrooms != null ? `<span>${p.bedrooms === 0 ? 'Studio' : p.bedrooms + ' bd'}</span>` : ''}
            ${p.bathrooms ? `<span>${p.bathrooms} ba</span>` : ''}
            ${p.virtual_tour_url ? `<span style="background:#0284c7;color:#fff;padding:1px 5px;border-radius:3px;font-size:10px;font-weight:700"><i class="fas fa-cube"></i> 3D</span>` : ''}
          </div>
          <a href="${popupHref}" class="map-popup-apply">View Property →</a>
        </div>
      </a>`, { maxWidth: 260 });
    mapMarkers.push(marker);
  });
  if (bounds.length && !isBoundsUpdate) {
    mapProgrammaticMove = true;
    mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    setTimeout(() => { mapProgrammaticMove = false; }, 400);
  }
  setTimeout(() => mapInstance.invalidateSize(), 50);
}

/* ─── View toggle ─── */
document.getElementById('btnListView').addEventListener('click', () => {
  currentView = 'list';
  document.getElementById('listPanel').style.display = '';
  document.getElementById('mapPanel').style.display = 'none';
  document.getElementById('btnListView').classList.add('active');
  document.getElementById('btnMapView').classList.remove('active');
});
document.getElementById('btnMapView').addEventListener('click', async () => {
  currentView = 'map';
  document.getElementById('listPanel').style.display = 'none';
  document.getElementById('mapPanel').style.display = 'block';
  document.getElementById('btnMapView').classList.add('active');
  document.getElementById('btnListView').classList.remove('active');
  // Show loading spinner while Leaflet loads
  const mapSpinner = document.getElementById('mapLoadingSpinner');
  if (mapSpinner) mapSpinner.style.display = 'flex';
  
  // Lazy-load Leaflet on first map view, then render existing markers
  await loadLeaflet();
  
  // Do not fetch redundantly. The list view already fetched `pageProperties`.
  initMap(pageProperties);
});

/* ─── Filters ─── */
function setupFilters() {
  document.querySelectorAll('.filter-pill[data-filter]').forEach(pill => {
    pill.addEventListener('click', () => {
      activeType = pill.dataset.filter;
      refreshResults();
    });
  });

  // Debounce helper — prevents API calls on every keystroke
  function debounce(fn, delay) {
    let timer;
    return function(...args) { clearTimeout(timer); timer = setTimeout(() => fn.apply(this, args), delay); };
  }
  const debouncedSearch = debounce(doSearch, 400);

  document.getElementById('searchBtn').addEventListener('click', doSearch);
  document.getElementById('searchInput').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  document.getElementById('searchInput').addEventListener('input', debouncedSearch);
  document.getElementById('bedroomsFilter').addEventListener('change', e => { activeBeds = e.target.value; refreshResults(); });
  document.getElementById('maxRentFilter').addEventListener('change', e => { activeMaxRent = e.target.value; refreshResults(); });
  document.getElementById('sortSelect').addEventListener('change', e => { sortBy = e.target.value; refreshResults(); });

  document.getElementById('moreFiltersBtn').addEventListener('click', e => {
      e.stopPropagation();
      const dropdown = document.getElementById('moreFiltersDropdown');
      dropdown.classList.toggle('open');
      const isOpen = dropdown.classList.contains('open');
      sessionStorage.setItem('filters_dropdown_open', isOpen ? 'true' : 'false');
    });

    // Fix 2: Mobile Filters button opens the same dropdown bottom-sheet
    const mfBtn = document.getElementById('mobileFiltersBtn');
    if (mfBtn) {
      mfBtn.addEventListener('click', e => {
        e.stopPropagation();
        const dropdown = document.getElementById('moreFiltersDropdown');
        dropdown.classList.toggle('open');
        sessionStorage.setItem('filters_dropdown_open', dropdown.classList.contains('open') ? 'true' : 'false');
      });
    }

    // Fix 3: Clear All pill (desktop bar)
    const clearAllPill = document.getElementById('clearAllPill');
    if (clearAllPill) clearAllPill.addEventListener('click', () => window.clearAllFilters());

    // Fix 3: Clear All inside dropdown header (mobile)
    const clearAllMobile = document.getElementById('clearAllMobile');
    if (clearAllMobile) clearAllMobile.addEventListener('click', () => {
      ['advTypeFilter','advMinBeds','advMinBaths','advMinRent','advMaxRent','advMinSqft','advMaxSqft','advAmenityFilter','advLaundryFilter','advHeatingFilter','advPetTypeFilter'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
      });
      window.clearAllFilters();
      document.getElementById('moreFiltersDropdown').classList.remove('open');
      sessionStorage.setItem('filters_dropdown_open', 'false');
    });
  document.addEventListener('click', e => {
    if (!document.getElementById('moreFiltersWrap').contains(e.target)) {
      document.getElementById('moreFiltersDropdown').classList.remove('open');
      sessionStorage.setItem('filters_dropdown_open', 'false');
    }
  });

  document.getElementById('applyAdvFilters').addEventListener('click', () => {
    activeMinRent  = document.getElementById('advMinRent')?.value || '';
    activeMaxRent  = document.getElementById('advMaxRent')?.value || activeMaxRent;
    activeMinBaths = document.getElementById('advMinBaths')?.value || '';
    activeMinSqft  = document.getElementById('advMinSqft')?.value || '';
    activeMaxSqft  = document.getElementById('advMaxSqft')?.value || '';
    activeAmenity  = document.getElementById('advAmenityFilter')?.value || '';
    activeLaundry  = document.getElementById('advLaundryFilter')?.value || '';
    activeHeating  = document.getElementById('advHeatingFilter')?.value || '';
    activePetType  = document.getElementById('advPetTypeFilter')?.value || '';
    const advBeds = document.getElementById('advMinBeds')?.value || '';
    if (advBeds !== '') activeBeds = advBeds;
    document.getElementById('moreFiltersDropdown').classList.remove('open');
    sessionStorage.setItem('filters_dropdown_open', 'false');
    refreshResults();
    showToast('Filters applied', 'success');
  });

  document.getElementById('clearAdvFilters').addEventListener('click', () => {
    ['advTypeFilter','advMinBeds','advMinBaths','advMinRent','advMaxRent','advMinSqft','advMaxSqft','advAmenityFilter','advLaundryFilter','advHeatingFilter','advPetTypeFilter'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    window.clearAllFilters();
    document.getElementById('moreFiltersDropdown').classList.remove('open');
    sessionStorage.setItem('filters_dropdown_open', 'false');
  });
}

window.clearAllFilters = function() {
  activeType = 'all'; activeSearch = ''; activeBeds = '';
  activeMaxRent = ''; activeMinRent = ''; activeMinBaths = '';
  activeMinSqft = ''; activeMaxSqft = ''; activeAmenity = '';
  activeLaundry = ''; activeHeating = ''; activePetType = '';
  sortBy = 'newest'; currentPage = 1;
  syncControls();
  pushURL(true);
  fetchAndRender();
};

function doSearch() {
  activeSearch = document.getElementById('searchInput').value.trim();
  refreshResults();
}

function updateFilterBadge() {
    const badge = document.getElementById('filterActiveBadge');
    const clearAllPill = document.getElementById('clearAllPill');
    const mobileBadge = document.getElementById('mobileFiltersBadge');
    const count = [activeType && activeType !== 'all', !!activeBeds, !!activeMaxRent, !!activeMinRent, !!activeMinBaths, !!activeMinSqft, !!activeMaxSqft, !!activeAmenity, !!activeSearch, !!activeLaundry, !!activeHeating, !!activePetType].filter(Boolean).length;
    if (badge) { badge.textContent = count || ''; badge.style.display = count > 0 ? 'inline-flex' : 'none'; }
    if (clearAllPill) clearAllPill.style.display = count > 0 ? '' : 'none';
    if (mobileBadge) { mobileBadge.textContent = count || ''; mobileBadge.style.display = count > 0 ? 'inline-flex' : 'none'; }
  }

/* ─── Utilities ─── */
/* setupScrollTop() and showToast() are provided as window globals by /js/cp-ui.js (issue #16 dedup). */

function renderError(errorMsg = 'Failed to load listings') {
  const grid = document.getElementById('propertyGrid');
  if (!grid) return;
  grid.innerHTML = `
    <div class="empty-state" style="grid-column:1/-1;text-align:center;padding:var(--space-16) var(--space-6)">
      <div class="empty-state-icon"><i class="fas fa-exclamation-triangle" style="font-size:48px;color:var(--color-error);margin-bottom:16px;opacity:0.7"></i></div>
      <h3 style="margin:var(--space-4) 0 var(--space-2);color:var(--color-text-primary);font-size:1.1rem">Something went wrong</h3>
      <p style="color:var(--color-text-secondary);margin-bottom:24px;max-width:360px;margin-left:auto;margin-right:auto;line-height:1.5">
        ${errorMsg || 'We couldn\'t load listings from the server. Please check your connection and try again.'}
      </p>
      <button onclick="window.refreshResults()" style="background:var(--color-brand);color:#fff;border:none;border-radius:8px;padding:12px 28px;cursor:pointer;font-size:0.9rem;font-weight:500;transition:background 160ms ease">
        <i class="fas fa-redo" style="margin-right:6px"></i>Retry
      </button>
    </div>`;
}


// showToast() is provided as a window global by /js/cp-ui.js (issue #16 dedup).

async function toggleSave(id, btn) {
  btn.disabled = true;
  try {
    const { saved } = await window.CP.SavedProperties.toggle(id);
    if (saved) {
      savedIds.add(id);
      btn.classList.add('saved');
      btn.innerHTML = '<i class="fas fa-heart"></i>';
      showToast('Property saved!', 'success');
    } else {
      savedIds.delete(id);
      btn.classList.remove('saved');
      btn.innerHTML = '<i class="far fa-heart"></i>';
    }
  } catch(_) {
    // Fallback: localStorage only
    if (savedIds.has(id)) {
      savedIds.delete(id); btn.classList.remove('saved'); btn.innerHTML = '<i class="far fa-heart"></i>';
    } else {
      savedIds.add(id); btn.classList.add('saved'); btn.innerHTML = '<i class="fas fa-heart"></i>';
      showToast('Property saved!', 'success');
    }
    localStorage.setItem('cp_saved', JSON.stringify([...savedIds]));
  } finally {
    btn.disabled = false;
  }
}

/* ─── Mobile Drawer ─── */
