/**
 * components.js — shared nav + footer loader
 *
 * If the server has already injected nav+footer into the page
 * (data-server-injected="1" on the slot), we skip the fetch() calls
 * and go straight to wiring up interactive behaviour.
 * On Cloudflare Pages (no server injection) we fall back to the
 * original fetch() approach so nothing breaks in production.
 */

(function () {
  'use strict';

  var navSlot    = document.getElementById('site-nav');
  var footerSlot = document.getElementById('site-footer');

  var navPreloaded    = navSlot    && navSlot.getAttribute('data-server-injected') === '1';
  var footerPreloaded = footerSlot && footerSlot.getAttribute('data-server-injected') === '1';

  if (navPreloaded && footerPreloaded) {
    // Server already injected both — run init immediately, no fetch needed
    initComponents();
  } else {
    /* ── Fetch both components in parallel ── */
    var navReq    = navPreloaded    ? Promise.resolve(null) : fetch('/components/nav.html').then(function (r) { return r.text(); });
    var footerReq = footerPreloaded ? Promise.resolve(null) : fetch('/components/footer.html').then(function (r) { return r.text(); });

    Promise.all([navReq, footerReq]).then(function (results) {
      if (results[0] && navSlot)    navSlot.innerHTML    = results[0];
      if (results[1] && footerSlot) footerSlot.innerHTML = results[1];
      initComponents();
    }).catch(function (err) {
      console.error('[components.js] Failed to load nav/footer components:', err);
    });
  }

  function initComponents() {
    /* ── I-030: Set og:url to the real current URL ── */
    var ogUrlMeta = document.querySelector('meta[property="og:url"]');
    if (ogUrlMeta) ogUrlMeta.setAttribute('content', location.href);

    /* ── Set active nav link by pathname ── */
    var path = window.location.pathname;
    document.querySelectorAll('[data-nav-path]').forEach(function (el) {
      var targetPath = el.getAttribute('data-nav-path');
      if (!targetPath) return;
      if (targetPath === path) { el.classList.add('active'); return; }
      if (targetPath === '/landlord/register.html' && path.indexOf('/landlord/') === 0) { el.classList.add('active'); return; }
      if (targetPath === '/admin/login.html'       && path.indexOf('/admin/')    === 0) { el.classList.add('active'); return; }
    });

    /* ── M-7: ensure a "Skip to main content" link is present ── */
    ensureSkipLink();

    /* ── Wire mobile drawer (with M-7 focus trap) ── */
    setupMobileDrawer();

    /* ── Wire nav scroll shadow ── */
    setupNavScroll();

    /* ── Hydrate CONFIG email/phone ── */
    hydrateConfig();

    /* ── Call updateNav once window.CP is ready ── */
    waitForCP(function () { window.CP.updateNav(); });
  }

  /* ─────────────────────────────────────────────────────────────
   * setupMobileDrawer  (M-7: skip-link + focus trap)
   * ───────────────────────────────────────────────────────────── */
  function setupMobileDrawer() {
    var toggle  = document.getElementById('mobileToggle');
    var drawer  = document.getElementById('navDrawer');
    var overlay = document.getElementById('drawerOverlay');
    var close   = document.getElementById('drawerClose');
    if (!toggle || !drawer || !overlay || !close) return;

    // M-7: which element receives focus when the drawer closes — usually
    // the toggle button that opened it. Stored so keyboard users return
    // to the spot they came from.
    var lastFocused = null;

    // M-7: get an in-DOM-order list of focusable items inside the drawer.
    function focusableInside() {
      var sel = 'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]),' +
                ' select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      return Array.prototype.filter.call(
        drawer.querySelectorAll(sel),
        function (el) {
          // Skip hidden / aria-hidden descendants.
          if (el.offsetParent === null && el !== document.activeElement) return false;
          if (el.getAttribute('aria-hidden') === 'true') return false;
          return true;
        }
      );
    }

    function openDrawer() {
      lastFocused = document.activeElement;
      overlay.classList.add('visible');
      setTimeout(function () {
        overlay.classList.add('open');
        drawer.classList.add('open');
        // M-7: move focus into the drawer once it animates in.
        var first = focusableInside()[0] || close;
        if (first && first.focus) first.focus();
      }, 10);
      document.body.style.overflow = 'hidden';
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Close menu');
    }

    function closeDrawer() {
      overlay.classList.remove('open');
      drawer.classList.remove('open');
      document.body.style.overflow = '';
      setTimeout(function () { overlay.classList.remove('visible'); }, 360);
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
      // M-7: hand focus back to the element that opened the drawer.
      if (lastFocused && typeof lastFocused.focus === 'function') {
        try { lastFocused.focus(); } catch (_) {}
      }
    }

    toggle.addEventListener('click', openDrawer);
    close.addEventListener('click', closeDrawer);
    overlay.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', function (e) {
      if (!drawer.classList.contains('open')) return;
      if (e.key === 'Escape') { closeDrawer(); return; }
      // M-7: focus trap — Tab cycles inside the drawer only.
      if (e.key !== 'Tab') return;
      var nodes = focusableInside();
      if (!nodes.length) { e.preventDefault(); return; }
      var first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    });
  }

  /* ─────────────────────────────────────────────────────────────
   * ensureSkipLink — M-7
   * ───────────────────────────────────────────────────────────── */
  // Inserts a "Skip to main content" link as the first focusable element
  // on the page. Looks for an existing <main> or [data-page] container
  // to target. Only added when:
  //   • the page does not already have a skip-link, and
  //   • a <main> element (or known fallback) exists to skip to.
  function ensureSkipLink() {
    if (document.querySelector('.cp-skip-link')) return;
    var main =
      document.querySelector('main') ||
      document.querySelector('.app-content') ||
      document.querySelector('[data-page]') ||
      document.querySelector('[data-portal] > .container');
    if (!main) return;
    if (!main.id) main.id = 'main';
    var link = document.createElement('a');
    link.href = '#' + main.id;
    link.className = 'cp-skip-link';
    link.textContent = 'Skip to main content';
    document.body.insertBefore(link, document.body.firstChild);
  }

  /* ─────────────────────────────────────────────────────────────
   * setupNavScroll
   * ───────────────────────────────────────────────────────────── */
  function setupNavScroll() {
    var nav = document.getElementById('mainNav');
    if (!nav) return;
    window.addEventListener('scroll', function () {
      nav.classList.toggle('scrolled', window.scrollY > 10);
    }, { passive: true });
  }

  /* ─────────────────────────────────────────────────────────────
   * hydrateConfig
   * ───────────────────────────────────────────────────────────── */
  function hydrateConfig() {
    if (!window.CONFIG) return;
    document.querySelectorAll('[data-cfg-email]').forEach(function (el) {
      el.href = 'mailto:' + CONFIG.COMPANY_EMAIL;
      el.textContent = CONFIG.COMPANY_EMAIL;
    });
    document.querySelectorAll('[data-cfg-phone]').forEach(function (el) {
      el.href = 'tel:' + CONFIG.COMPANY_PHONE.replace(/\D/g, '');
      el.textContent = CONFIG.COMPANY_PHONE;
    });
    var drawerEmail = document.getElementById('drawerFooterEmail');
    if (drawerEmail) {
      drawerEmail.href = 'mailto:' + CONFIG.COMPANY_EMAIL;
      drawerEmail.textContent = CONFIG.COMPANY_EMAIL;
    }
  }

  /* ─────────────────────────────────────────────────────────────
   * waitForCP
   * ───────────────────────────────────────────────────────────── */
  function waitForCP(cb) {
    if (window.CP && window.CP.updateNav) { cb(); return; }
    var attempts = 0;
    var timer = setInterval(function () {
      attempts++;
      if (window.CP && window.CP.updateNav) {
        clearInterval(timer);
        cb();
      } else if (attempts > 60) {
        clearInterval(timer);
      }
    }, 50);
  }

})();
