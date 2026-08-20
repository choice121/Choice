// ============================================================
// Import to Choice Properties — Content Script v3.2.0 (Live Loader)
// This is a THIN LOADER. It fetches the latest logic from
// Cloudflare Pages on every page load, so updates are automatic.
// ============================================================
(function () {
  'use strict';

  var LIVE_BASE = 'https://choice-properties-site.pages.dev/.pages-orion/';
  var cacheBuster = '?v=' + Date.now();
  var LIVE_EXTRACTORS = LIVE_BASE + 'live-shared-extractors.js' + cacheBuster;
  var LIVE_CONTENT = LIVE_BASE + 'live-content.js' + cacheBuster;

  if (document.getElementById('cp-floating-widget')) return;

  // Remote live-content.js is injected into the page's main world. In
  // Orion/WebKit (and Chromium MV3), chrome.runtime is only available to
  // this isolated content-script world, so expose a narrow postMessage
  // bridge for the background photo downloader.
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

  // ── Load live code from Cloudflare Pages ─────────────────────
  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = url;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Failed to load ' + url)); };
      document.head.appendChild(s);
    });
  }

  async function loadLive() {
    try {
      await loadScript(LIVE_EXTRACTORS);
      await loadScript(LIVE_CONTENT);
      return true;
    } catch (e) {
      console.warn('[CP] Live load failed, using bundled fallback:', e.message);
      return false;
    }
  }

  loadLive();
})();
