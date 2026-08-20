// ==UserScript==
// @name         Choice Properties — Pipeline Importer
// @namespace    https://choice-properties-site.pages.dev/
// @version      5.0.0
// @description  Save Zillow, Realtor, Apartments.com & Redfin listings to Choice Properties Pipeline with Batch Mode
// @match        https://*.zillow.com/*
// @match        https://*.realtor.com/*
// @match        https://*.apartments.com/*
// @match        https://*.redfin.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';
  var LIVE_BASE = 'https://choice-properties-site.pages.dev/';
  var cacheBuster = '?v=' + Date.now();
  
  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = url;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function init() {
    try {
      await loadScript(LIVE_BASE + 'live-shared-extractors.js' + cacheBuster);
      await loadScript(LIVE_BASE + 'live-content.js' + cacheBuster);
    } catch (e) {
      console.warn('[CP Userscript] Live load fallback to .pages-orion:', e);
      try {
        await loadScript(LIVE_BASE + '.pages-orion/live-shared-extractors.js' + cacheBuster);
        await loadScript(LIVE_BASE + '.pages-orion/live-content.js' + cacheBuster);
      } catch (err) {
        console.error('[CP Userscript] Fatal error:', err);
      }
    }
  }

  init();
})();
