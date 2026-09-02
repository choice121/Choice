(function () {
  'use strict';

  const PAGE_SIZE = 24;
  let allProperties = [];
  let landlords = [];
  let page = 1;

  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => (window.CPShell || window.AdminShell).esc(value);
  const fmtMoney = (value) => value == null ? '—' : '$' + Number(value).toLocaleString('en-US') + '/mo';
  const fmtDate = (value) => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  const statusClass = (status) => ({
    active: 'pill-success', rented: 'pill-info', inactive: 'pill-muted',
    maintenance: 'pill-warning', draft: 'pill-muted', paused: 'pill-warning',
    archived: 'pill-muted',
  }[status] || 'pill-muted');

  function landlordName(property) {
    const landlord = property.landlords || {};
    return landlord.contact_name || landlord.business_name || 'No landlord assigned';
  }

  function filteredProperties() {
    const query = ($('#pm-search').value || '').trim().toLowerCase();
    const status = $('#pm-status').value;
    const landlord = $('#pm-landlord').value;
    const sort = $('#pm-sort').value;
    const rows = allProperties.filter((property) => {
      const searchable = [
        property.title, property.address, property.city, property.state,
        property.zip, property.id, landlordName(property),
      ].filter(Boolean).join(' ').toLowerCase();
      return (!query || searchable.includes(query))
        && (status === 'all' || property.status === status)
        && (!landlord || property.landlord_id === landlord);
    });
    rows.sort((a, b) => {
      if (sort === 'rent_high') return Number(b.monthly_rent || 0) - Number(a.monthly_rent || 0);
      if (sort === 'rent_low') return Number(a.monthly_rent || 0) - Number(b.monthly_rent || 0);
      const left = new Date(a.listed_at || a.created_at || 0).getTime();
      const right = new Date(b.listed_at || b.created_at || 0).getTime();
      return sort === 'oldest' ? left - right : right - left;
    });
    return rows;
  }

  function card(property) {
    const photos = Array.isArray(property.property_photos)
      ? property.property_photos.slice().sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
      : [];
    const photo = photos.find((item) => item.is_hero) || photos[0];
    const location = [property.city, property.state, property.zip].filter(Boolean).join(', ');
    const meta = [
      property.bedrooms != null ? `${property.bedrooms} bed` : null,
      property.bathrooms != null ? `${property.bathrooms} bath` : null,
      property.square_feet ? `${Number(property.square_feet).toLocaleString()} sqft` : null,
    ].filter(Boolean).join(' · ');
    return `<article class="pm-card">
      <div class="pm-photo">
        ${photo?.url ? `<img src="${esc(photo.url)}" alt="${esc(property.title || property.address || 'Property')}" loading="lazy" referrerpolicy="no-referrer">` : '<div class="pm-photo-empty">No photos</div>'}
        <span class="pm-status">${(window.CP?.UI?.statusBadge ? CP.UI.statusBadge(property.status) : `<span class="pill ${statusClass(property.status)}">${esc(property.status || 'unknown')}</span>`)}</span>
      </div>
      <div class="pm-body">
        <div class="pm-title" title="${esc(property.title || '')}">${esc(property.title || 'Untitled property')}</div>
        <div class="pm-address" title="${esc(property.address || '')}">${esc(property.address || 'Address unavailable')}${location ? ` · ${esc(location)}` : ''}</div>
        <div class="pm-rent">${fmtMoney(property.monthly_rent)}</div>
        ${meta ? `<div class="pm-meta">${esc(meta)}</div>` : ''}
        <div class="pm-landlord" title="${esc(landlordName(property))}">Landlord: ${esc(landlordName(property))}</div>
        <div class="text-xs muted">Listed ${esc(fmtDate(property.listed_at || property.created_at))}</div>
      </div>
      <div class="pm-actions">
        <a class="btn btn-primary btn-sm" href="/admin/property-detail.html?id=${encodeURIComponent(property.id)}">Manage</a>
        <a class="btn btn-ghost btn-sm" href="/property.html?id=${encodeURIComponent(property.id)}" target="_blank" rel="noopener">View live</a>
      </div>
    </article>`;
  }

  function render() {
    const rows = filteredProperties();
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    page = Math.min(page, totalPages);
    const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    $('#pm-count').textContent = `${rows.length.toLocaleString()} matching ${rows.length === 1 ? 'property' : 'properties'} · ${allProperties.length.toLocaleString()} total`;
    if (!visible.length) {
      $('#pm-list').innerHTML = `<div class="empty"><svg class="i"><use href="#i-property"/></svg><h3>No properties found</h3><p>Try changing the search or filters.</p></div>`;
    } else {
      $('#pm-list').innerHTML = `<div class="pm-grid">${visible.map(card).join('')}</div>`;
    }
    const pagination = $('#pm-pagination');
    pagination.hidden = totalPages <= 1;
    $('#pm-page').textContent = `Page ${page} of ${totalPages}`;
    $('#pm-prev').disabled = page <= 1;
    $('#pm-next').disabled = page >= totalPages;
  }

  function showError(message) {
    $('#pm-count').textContent = 'Could not load properties';
    $('#pm-list').innerHTML = `<div class="empty"><svg class="i"><use href="#i-alert"/></svg><h3>Properties unavailable</h3><p>${esc(message)}</p><button class="btn btn-primary btn-sm" id="pm-retry" type="button">Try again</button></div>`;
    $('#pm-retry')?.addEventListener('click', load);
  }

  async function loadLandlords() {
    const { data, error } = await CP.sb().rpc('admin_list_landlords', { p_page: 0, p_per_page: 500 });
    if (error) return;
    landlords = data?.rows || (Array.isArray(data) ? data : []);
    const select = $('#pm-landlord');
    select.innerHTML = '<option value="">All landlords</option>' + landlords
      .sort((a, b) => (a.contact_name || a.business_name || '').localeCompare(b.contact_name || b.business_name || ''))
      .map((landlord) => `<option value="${esc(landlord.id)}">${esc(landlord.contact_name || landlord.business_name || landlord.email || landlord.id)}</option>`)
      .join('');
  }

  async function load() {
    const S = window.CPShell || window.AdminShell;
    $('#pm-list').innerHTML = `<div class="list">${S.skeletonRows(6, { avatar: false })}</div>`;
    const ok = await S.requireAdmin();
    if (!ok) return;
    try {
      const { data, error } = await CP.sb().from('properties')
        .select('id,title,address,city,state,zip,status,monthly_rent,bedrooms,bathrooms,square_feet,created_at,listed_at,landlord_id,landlords(contact_name,business_name),property_photos(url,file_id,display_order,is_hero)')
        .order('listed_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) throw error;
      allProperties = data || [];
      await loadLandlords();
      render();
    } catch (error) {
      console.error('[admin/properties]', error);
      showError(error.message || 'Please refresh and try again.');
    }
  }

  function wire() {
    const params = new URLSearchParams(location.search);
    if (params.get('q')) $('#pm-search').value = params.get('q');
    if (params.get('status')) $('#pm-status').value = params.get('status');
    if (params.get('landlord')) $('#pm-landlord').dataset.initial = params.get('landlord');
    ['pm-search', 'pm-status', 'pm-landlord', 'pm-sort'].forEach((id) => {
      const el = $('#' + id);
      el.addEventListener('input', () => { page = 1; render(); });
      el.addEventListener('change', () => { page = 1; render(); });
    });
    $('#pm-reset').addEventListener('click', () => {
      $('#pm-search').value = '';
      $('#pm-status').value = 'all';
      $('#pm-landlord').value = '';
      $('#pm-sort').value = 'newest';
      page = 1;
      render();
    });
    $('#pm-prev').addEventListener('click', () => { page -= 1; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    $('#pm-next').addEventListener('click', () => { page += 1; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }

  (window.CPShell?.ready || Promise.resolve(window.AdminShell)).then(() => {
    wire();
    // Apply a landlord deep-link after the landlord options have loaded.
    const landlordSelect = $('#pm-landlord');
    const initialLandlord = landlordSelect.dataset.initial;
    if (initialLandlord && Array.from(landlordSelect.options).some((option) => option.value === initialLandlord)) {
      landlordSelect.value = initialLandlord;
    }
    document.addEventListener('cp:realtime', (event) => {
      if (event.detail?.table === 'properties') load();
    });
    load();
  }).catch((error) => showError(error.message || 'Admin shell failed to load.'));
})();
