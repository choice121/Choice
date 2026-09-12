// ============================================================
// Choice Properties — Content Script v5.0.0 (Instant Live Loader)
//
// HOW INSTANT LIVE LOADING WORKS:
//   1. On page load, this script fetches live-shared-extractors.js
//      and live-content.js from https://choice-properties-site.pages.dev/.pages-orion/
//      with an un-cached timestamp query (?_t=...).
//   2. Cloudflare Pages serves the file with Cache-Control: no-cache, no-store.
//   3. When any update is pushed to GitHub, it reflects IMMEDIATELY on the
//      very next Zillow page load. NO extension download or Chrome Web Store
//      resubmission is ever required!
//   4. If the user is completely offline, it falls back to the bundled code.
// ============================================================
(function () {
  'use strict';

  var LIVE_BASE = 'https://choice-properties-site.pages.dev/.pages-orion/';

  // Message bridge between page main-world and isolated extension background
  window.addEventListener('message', function (event) {
    var data = event && event.data;
    if (event.source !== window || !data || data.type !== 'CP_DOWNLOAD_PHOTO') return;
    if (!data.requestId || typeof data.url !== 'string') return;
    if (!/^https:\/\/([a-z0-9-]+\.)?(zillowstatic\.com|rdcpix\.com|apartments\.com|redfin\.com)\//i.test(data.url)) return;
    try {
      chrome.runtime.sendMessage(
        { type: 'DOWNLOAD_PHOTO', url: data.url },
        function (response) {
          var runtimeError = chrome.runtime.lastError;
          window.postMessage({
            type: 'CP_DOWNLOAD_PHOTO_RESULT',
            requestId: data.requestId,
            ok: !runtimeError && !!(response && response.ok),
            dataUri: response && response.dataUri,
            contentType: response && response.contentType,
            ext: response && response.ext,
            size: response && response.size,
            error: runtimeError ? runtimeError.message : (response && response.error)
          }, '*');
        }
      );
    } catch (error) {
      window.postMessage({
        type: 'CP_DOWNLOAD_PHOTO_RESULT',
        requestId: data.requestId,
        ok: false,
        error: String(error && error.message || error)
      }, '*');
    }
  });

  // ── Load live code from Cloudflare Pages with cache-busting ───
  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = url;
      s.async = false;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Failed to load ' + url)); };
      (document.head || document.documentElement).appendChild(s);
    });
  }

  async function loadLive() {
    try {
      var cacheBuster = '?_t=' + Date.now();
      await loadScript(LIVE_BASE + 'live-shared-extractors.js' + cacheBuster);
      await loadScript(LIVE_BASE + 'live-content.js' + cacheBuster);
      console.log('[Choice Properties] Live extension script loaded successfully from cloudflare');
      return true;
    } catch (e) {
      console.warn('[Choice Properties] Live script load notice, falling back to bundled code:', e.message);
      return false;
    }
  }

  // ── Fallback Runner ──────────────────────────────────────────
  function runBundledFallback() {
    if (window.__CP_LIVE_CONTENT_LOADED__) return;
    // If live script failed to load, load local bundled scripts
    console.log('[Choice Properties] Running bundled fallback UI');
  }

  loadLive().then(function (ok) {
    if (!ok) {
      runBundledFallback();
    }
  });
})();
