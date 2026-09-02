(function () {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => (window.CPShell || window.AdminShell).esc(value);
  const date = (value) => value ? new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

  function render(rows) {
    const host = $('#location-list');
    if (!rows.length) {
      host.innerHTML = '<div class="empty"><svg class="i"><use href="#i-check"/></svg><h3>All locations are reviewed</h3><p>New markets will appear here when the pipeline detects them.</p></div>';
      return;
    }
    host.innerHTML = '<div class="list">' + rows.map((row) => `
      <div class="list-row" data-city="${esc(row.city)}" data-state="${esc(row.state)}">
        <div class="list-row-inner">
          <div class="row-avatar" style="background:${(window.CPShell || window.AdminShell).avatarColor(row.city + row.state)}"><svg class="i"><use href="#i-listings"/></svg></div>
          <div class="row-body">
            <div class="row-title">${esc(row.city)}, ${esc(row.state)}</div>
            <div class="row-sub">Detected ${esc(date(row.detected_at))}${row.property_id ? ` · Property ${esc(row.property_id)}` : ''}</div>
          </div>
          <div class="row-meta">
            ${row.property_id ? `<a class="btn btn-ghost btn-sm" href="/admin/property-detail.html?id=${encodeURIComponent(row.property_id)}">Review property</a>` : ''}
            <button class="btn btn-primary btn-sm" data-dismiss type="button">Mark reviewed</button>
          </div>
        </div>
      </div>`).join('') + '</div>';
  }

  async function load() {
    const S = window.CPShell || window.AdminShell;
    const host = $('#location-list');
    host.innerHTML = `<div class="list">${S.skeletonRows(3)}</div>`;
    if (!await S.requireAdmin()) return;
    const { data, error } = await CP.sb().rpc('get_location_notifications');
    if (error) {
      host.innerHTML = `<div class="empty"><svg class="i"><use href="#i-alert"/></svg><h3>Could not load notifications</h3><p>${esc(error.message)}</p></div>`;
      return;
    }
    render(Array.isArray(data) ? data : []);
  }

  async function dismiss(row) {
    const S = window.CPShell || window.AdminShell;
    const { error } = await CP.sb().rpc('dismiss_location_notification', {
      p_city: row.dataset.city,
      p_state: row.dataset.state,
    });
    if (error) {
      S.toast('Could not mark location reviewed: ' + error.message, 'error');
      return;
    }
    S.toast('Location marked reviewed.', 'success');
    load();
  }

  (window.CPShell?.ready || Promise.resolve(window.AdminShell)).then(() => {
    $('#refresh-locations').addEventListener('click', load);
    $('#location-list').addEventListener('click', (event) => {
      const button = event.target.closest('[data-dismiss]');
      if (button) dismiss(button.closest('.list-row'));
    });
    load();
  }).catch((error) => {
    $('#location-list').innerHTML = `<div class="empty"><h3>Admin shell failed to load</h3><p>${esc(error.message)}</p></div>`;
  });
})();