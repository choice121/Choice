// ============================================================
// Choice Properties — Orion Content Bridge v18.0.6
//
// The bundled live UI is loaded by manifest.json before this bridge. Keeping
// the UI local means an unavailable Pages request cannot disable the extension.
// ============================================================
(function () {
  'use strict';

  var EXTENSION_API = (typeof chrome !== 'undefined' && chrome.runtime) ? chrome :
    ((typeof browser !== 'undefined' && browser.runtime) ? browser : null);

  // Message bridge between page main-world and isolated extension background
  window.addEventListener('message', function (event) {
    var data = event && event.data;
    if (event.source !== window || !data || data.type !== 'CP_DOWNLOAD_PHOTO') return;
    if (!data.requestId || typeof data.url !== 'string') return;
    if (!/^https:\/\/([a-z0-9-]+\.)?(zillowstatic\.com|rdcpix\.com|apartments\.com|redfin\.com|cdn-redfin\.com|opendoor\.com|cloudinary\.com|rentprogress\.com|fastly\.net|amazonaws\.com|cjproperties\.org|cjrealestate\.com|appfolio\.com)\//i.test(data.url)) return;
    try {
      EXTENSION_API.runtime.sendMessage(
        { type: 'DOWNLOAD_PHOTO', url: data.url },
        function (response) {
          var runtimeError = EXTENSION_API.runtime.lastError;
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

  if (window.__CP_LIVE_CONTENT_LOADED__) {
    console.log('[Choice Properties] Bundled Orion UI is active');
  }
})();
