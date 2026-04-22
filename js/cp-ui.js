/* ============================================================
 * cp-ui.js — Shared UI helpers for ALL dashboards
 *   CP.UI.toast(msg, opts)        – transient bottom toast
 *   CP.UI.empty(el, opts)         – render empty-state
 *   CP.UI.skeleton(el, n)         – render skeleton loaders
 *   CP.UI.badge(status)           – consistent status pill HTML
 *   CP.UI.safeAvatar(name, opts)  – initials avatar, null-safe
 *   CP.UI.fmtDate(d)              – locale date, null-safe
 *   CP.UI.fmtMoney(n)             – USD formatter, null-safe
 *   CP.UI.fmtPhone(p)             – US phone formatter, null-safe
 *   CP.UI.esc(s)                  – HTML-escape, null-safe
 *
 * Self-contained, no module imports — load via classic <script>.
 * Pairs with css/cp-design.css for visuals (was dashboard-system.css pre-Phase 2).
 * ========================================================== */
(function () {
  'use strict';

  window.CP = window.CP || {};
  if (window.CP.UI && window.CP.UI.__v >= 1) return; // idempotent

  // --- esc / formatters -------------------------------------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function fmtDate(d) {
    if (!d) return '—';
    try {
      var dt = (d instanceof Date) ? d : new Date(d);
      if (isNaN(dt.getTime())) return '—';
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (_) { return '—'; }
  }
  function fmtMoney(n) {
    if (n == null || n === '' || isNaN(Number(n))) return '—';
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(n));
    } catch (_) { return '$' + Number(n).toFixed(0); }
  }
  function fmtPhone(p) {
    if (!p) return '—';
    var d = String(p).replace(/\D/g, '');
    if (d.length === 11 && d[0] === '1') d = d.slice(1);
    if (d.length !== 10) return String(p);
    return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
  }

  // --- badge -------------------------------------------------
  // Map a status string to a .ds-badge variant with consistent labels.
  function badge(status) {
    var s = String(status || 'pending').toLowerCase();
    var map = {
      pending:    'warning',
      submitted:  'info',
      approved:   'success',
      active:     'success',
      signed:     'success',
      paid:       'success',
      confirmed:  'success',
      denied:     'danger',
      rejected:   'danger',
      failed:     'danger',
      cancelled:  'danger',
      waitlisted: 'purple',
      draft:      'neutral',
      archived:   'neutral',
      sent:       'info',
      review:     'warning',
    };
    var variant = map[s] || 'neutral';
    return '<span class="ds-badge ds-badge--' + variant + '">' + esc(s) + '</span>';
  }

  // --- safeAvatar -------------------------------------------
  // Returns initials avatar HTML; never crashes on null/empty input.
  function safeAvatar(name, opts) {
    opts = opts || {};
    var size = opts.size || 36;
    var clean = String(name == null ? '' : name).trim();
    var initials = '?';
    if (clean) {
      var parts = clean.split(/\s+/).filter(Boolean);
      initials = (parts[0][0] || '') + (parts.length > 1 ? (parts[parts.length - 1][0] || '') : '');
      initials = initials.toUpperCase() || '?';
    }
    // Deterministic color from name
    var hue = 0; for (var i = 0; i < clean.length; i++) hue = (hue + clean.charCodeAt(i) * 7) % 360;
    var bg = 'hsl(' + hue + ', 60%, 92%)';
    var fg = 'hsl(' + hue + ', 55%, 30%)';
    return '<span aria-hidden="true" style="display:inline-flex;align-items:center;justify-content:center;'
      + 'width:' + size + 'px;height:' + size + 'px;border-radius:50%;'
      + 'background:' + bg + ';color:' + fg + ';font-weight:700;font-size:' + Math.round(size * 0.4) + 'px;'
      + 'flex:0 0 auto">' + esc(initials) + '</span>';
  }

  // --- skeleton ---------------------------------------------
  function skeleton(target, rows) {
    var el = (typeof target === 'string') ? document.querySelector(target) : target;
    if (!el) return;
    var n = Math.max(1, rows || 3);
    var html = '';
    for (var i = 0; i < n; i++) {
      html += '<div class="ds-skeleton ds-skeleton--title"></div>'
           +  '<div class="ds-skeleton ds-skeleton--text"></div>'
           +  '<div class="ds-skeleton ds-skeleton--text" style="width:80%"></div>';
    }
    el.innerHTML = html;
  }

  // --- empty state ------------------------------------------
  function empty(target, opts) {
    var el = (typeof target === 'string') ? document.querySelector(target) : target;
    if (!el) return;
    opts = opts || {};
    var icon  = opts.icon  || 'fa-inbox';
    var title = opts.title || 'Nothing here yet';
    var sub   = opts.sub   || '';
    var cta   = opts.cta;
    var ctaHtml = '';
    if (cta && cta.href) {
      ctaHtml = '<a class="ds-btn ds-btn--primary ds-btn--sm" href="' + esc(cta.href) + '">' + esc(cta.label || 'Get started') + '</a>';
    }
    el.innerHTML =
      '<div class="ds-empty">'
      + '<div class="ds-empty__icon"><i class="fas ' + esc(icon) + '"></i></div>'
      + '<div class="ds-empty__title">' + esc(title) + '</div>'
      + (sub ? '<div class="ds-empty__sub">' + esc(sub) + '</div>' : '')
      + ctaHtml
      + '</div>';
  }

  // --- toast -------------------------------------------------
  function toast(msg, opts) {
    opts = opts || {};
    var host = document.getElementById('ds-toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'ds-toast-host';
      host.className = 'ds-toast-host';
      host.setAttribute('role', 'status');
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    var el = document.createElement('div');
    el.className = 'ds-toast' + (opts.type ? ' ds-toast--' + opts.type : '');
    el.textContent = String(msg == null ? '' : msg);
    host.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('is-in'); });
    var dur = opts.duration || (opts.type === 'error' ? 5000 : 3200);
    setTimeout(function () {
      el.classList.remove('is-in');
      setTimeout(function () { el.remove(); }, 220);
    }, dur);
  }

  window.CP.UI = {
    __v: 1,
    esc: esc, fmtDate: fmtDate, fmtMoney: fmtMoney, fmtPhone: fmtPhone,
    badge: badge, safeAvatar: safeAvatar,
    skeleton: skeleton, empty: empty, toast: toast
  };
})();
