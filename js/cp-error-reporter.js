// ============================================================
// Choice Properties — Client-side error reporter (cp-error-reporter.js)
// ------------------------------------------------------------
// Phase 1 of the AI-monitoring loop. Captures uncaught errors and
// unhandled promise rejections, fingerprints + dedupes them in-page,
// strips PII (query strings + hash from URLs), and POSTs to the
// public.report_client_error RPC (rate-limited SECURITY DEFINER).
//
// Why a vanilla script (not an ES module): so the browser can execute
// it as early as possible — in particular before /js/cp-api.js (module)
// — letting us catch errors thrown by later-loading scripts too.
//
// Costs: $0. No external deps. Tightly rate-limited (page + DB side).
// ============================================================

(function () {
  'use strict';

  if (typeof window === 'undefined' || !window.fetch) return;

  // ─── Tunables (page-side) ──────────────────────────────────────────
  var MAX_PER_PAGE_LOAD = 20;     // hard cap on sends from one tab
  var MIN_INTERVAL_MS   = 2000;   // min gap between two sends
  var DEDUP_WINDOW_MS   = 30000;  // same fp won't re-fire within this window

  // Known third-party / browser noise we never report
  var NOISE_PATTERNS = [
    /^Script error\.?$/i,                      // cross-origin opaque
    /chrome-extension:\/\//,
    /moz-extension:\/\//,
    /safari-extension:\/\//,
    /^ResizeObserver loop /,                   // benign browser warning
    /Loading chunk \d+ failed/,                // user navigated away
    /^Non-Error promise rejection captured/,
    /AbortError/,
    /The user aborted a request/,
    /Failed to fetch dynamically imported module/
  ];

  // ─── State ─────────────────────────────────────────────────────────
  var sent = 0;
  var lastSendTs = 0;
  var seenFingerprints = Object.create(null);

  function fingerprint(message, source, line, col) {
    var raw = (message || '') + '|' + (source || '') + '|' + (line || 0) + '|' + (col || 0);
    var h = 0;
    for (var i = 0; i < raw.length; i++) {
      h = ((h << 5) - h) + raw.charCodeAt(i);
      h |= 0;
    }
    return 'fp_' + Math.abs(h).toString(36) + '_' + raw.length;
  }

  function safePagePath() {
    try {
      return (location.pathname || '/').slice(0, 256);
    } catch (_) { return '/'; }
  }

  function isNoise(message, source) {
    var s = (message || '') + ' ' + (source || '');
    for (var i = 0; i < NOISE_PATTERNS.length; i++) {
      if (NOISE_PATTERNS[i].test(s)) return true;
    }
    return false;
  }

  function getEndpoint() {
    var c = window.CONFIG || window.CP_CONFIG;
    if (!c || !c.SUPABASE_URL || !c.SUPABASE_ANON_KEY) return null;
    return {
      url: c.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/report_client_error',
      key: c.SUPABASE_ANON_KEY
    };
  }

  function send(payload) {
    var ep = getEndpoint();
    if (!ep) return;
    try {
      fetch(ep.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': ep.key,
          'Authorization': 'Bearer ' + ep.key
        },
        body: JSON.stringify(payload),
        keepalive: true,        // survive a navigation
        credentials: 'omit'
      }).catch(function () { /* swallow — never let the reporter itself error */ });
    } catch (_) { /* swallow */ }
  }

  function report(message, source, line, col, stack) {
    if (sent >= MAX_PER_PAGE_LOAD) return;
    if (isNoise(message, source)) return;

    var now = Date.now();
    if (now - lastSendTs < MIN_INTERVAL_MS) return;

    var fp = fingerprint(message, source, line, col);
    if (seenFingerprints[fp] && (now - seenFingerprints[fp]) < DEDUP_WINDOW_MS) return;
    seenFingerprints[fp] = now;
    lastSendTs = now;
    sent++;

    send({
      p_fingerprint:  fp,
      p_message:      String(message || '').slice(0, 1000),
      p_stack:        String(stack || '').slice(0, 4000),
      p_page_path:    safePagePath(),
      p_user_agent:   String(navigator.userAgent || '').slice(0, 256),
      p_browser_lang: String(navigator.language || '').slice(0, 32)
    });
  }

  // ─── Hooks ────────────────────────────────────────────────────────
  window.addEventListener('error', function (e) {
    if (!e) return;
    var msg = e.message || (e.error && e.error.message) || 'unknown';
    var src = e.filename || (e.error && e.error.fileName) || '';
    var stk = (e.error && e.error.stack) || '';
    report(msg, src, e.lineno, e.colno, stk);
  }, true);

  window.addEventListener('unhandledrejection', function (e) {
    if (!e) return;
    var reason = e.reason;
    var msg = (reason && (reason.message || (typeof reason === 'string' ? reason : reason.toString && reason.toString()))) || 'unhandled rejection';
    var stk = (reason && reason.stack) || '';
    report(msg, '', 0, 0, stk);
  });

  // Tiny global hook so we can manually report from app code:
  //   window.cpReportError(new Error('something went wrong'))
  window.cpReportError = function (errOrMsg) {
    try {
      if (errOrMsg && errOrMsg.message) {
        report(errOrMsg.message, '', 0, 0, errOrMsg.stack || '');
      } else {
        report(String(errOrMsg), '', 0, 0, '');
      }
    } catch (_) { /* swallow */ }
  };
})();
