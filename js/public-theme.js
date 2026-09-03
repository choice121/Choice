/* Choice Properties public theme bootstrap.
 * Runs before the public stylesheets to prevent a light/dark flash.
 * The existing nav toggle continues to write cp-theme as light or dark.
 * When no explicit preference is saved, the document follows the OS.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var THEME_KEY = 'cp-theme';

  function getStoredTheme() {
    try {
      var value = window.localStorage.getItem(THEME_KEY);
      return value === 'light' || value === 'dark' ? value : null;
    } catch (_) {
      return null;
    }
  }

  function systemTheme() {
    return window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  function applyTheme() {
    var theme = getStoredTheme() || systemTheme();
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-theme-mode', getStoredTheme() || 'system');
    return theme;
  }

  function updateBrowserChrome() {
    var theme = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0B1220' : '#F7F5F2');
  }

  applyTheme();

  function syncChrome() {
    updateBrowserChrome();
    root.style.colorScheme = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncChrome, { once: true });
  } else {
    syncChrome();
  }

  if (window.MutationObserver) {
    new MutationObserver(syncChrome).observe(root, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  }

  if (window.matchMedia) {
    var media = window.matchMedia('(prefers-color-scheme: dark)');
    var onSystemChange = function () {
      if (!getStoredTheme()) {
        applyTheme();
        syncChrome();
      }
    };
    if (media.addEventListener) media.addEventListener('change', onSystemChange);
    else if (media.addListener) media.addListener(onSystemChange);
  }
})();