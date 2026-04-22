/* =====================================================================
   admin-chrome.js — Phase 2 transitional shim.
   Real source moved to /js/cp-chrome.js. This file dynamically loads
   the new path so any HTML that still references admin-chrome.js keeps
   working. Removed in Phase 8.
   ===================================================================== */
(function () {
  'use strict';
  if (window.CPChrome) return; // already loaded directly
  var s = document.createElement('script');
  s.src = '/js/cp-chrome.js?v=20260423';
  s.defer = true;
  (document.head || document.documentElement).appendChild(s);
})();
