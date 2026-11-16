/* Phase L4 — Save-without-signup nudge + heart pulse (BATCH_04)
 * Listens at document level (capture phase) for clicks on .property-card-save.
 * - Adds a tactile pulse animation to the heart on every toggle.
 * - When the user has saved >= 3 properties (across all pages) and is NOT
 *   signed in and has not dismissed before and has not seen the nudge this
 *   session, shows a small non-blocking prompt offering to create an account.
 *
 * State:
 *   - localStorage 'cp_saved'                 — owned by listings.js / index.html (array of property IDs)
 *   - localStorage 'cp_saved_nudge_dismissed' — '1' once user closes the nudge
 *   - sessionStorage 'cp_saved_nudge_shown'   — '1' once shown this tab session
 *
 * Never blocks anything. Auto-hides after 12s. Existing handlers untouched.
 */
(function () {
  'use strict';

  if (typeof window === 'undefined' || !window.document) return;
  if (!('localStorage' in window)) return;

  var THRESHOLD = 3;

  function readSavedCount() {
    try {
      var arr = JSON.parse(localStorage.getItem('cp_saved') || '[]');
      return Array.isArray(arr) ? arr.length : 0;
    } catch (_) { return 0; }
  }

  function isAuthed() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('sb-') === 0 && k.indexOf('-auth-token') !== -1) {
          var v = localStorage.getItem(k);
          if (v && v.length > 50) return true;
        }
      }
    } catch (_) {}
    return false;
  }

  function shouldShow() {
    if (isAuthed()) return false;
    try {
      if (localStorage.getItem('cp_saved_nudge_dismissed') === '1') return false;
      if (sessionStorage.getItem('cp_saved_nudge_shown') === '1') return false;
    } catch (_) {}
    return readSavedCount() >= THRESHOLD;
  }

  function pulseHeart(btn) {
    if (!btn) return;
    btn.classList.remove('cp-heart-pulse');
    // Force reflow to restart the animation if rapidly re-clicked
    void btn.offsetWidth;
    btn.classList.add('cp-heart-pulse');
    setTimeout(function () { btn.classList.remove('cp-heart-pulse'); }, 600);
  }

  function showNudge() {
    if (document.querySelector('.cp-saved-nudge')) return;
    try { sessionStorage.setItem('cp_saved_nudge_shown', '1'); } catch (_) {}

    var el = document.createElement('div');
    el.className = 'cp-saved-nudge';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML =
      '<div class="cp-saved-nudge__inner">' +
        '<span class="cp-saved-nudge__icon" aria-hidden="true">' +
          '<i class="fas fa-heart"></i>' +
        '</span>' +
        '<div class="cp-saved-nudge__text">' +
          '<strong>Save these to your account?</strong>' +
          '<span>Sync your favorites across devices — takes 30 seconds.</span>' +
        '</div>' +
        '<a class="cp-saved-nudge__cta" href="/signup.html?ref=saves">Sign up</a>' +
        '<button type="button" class="cp-saved-nudge__close" aria-label="Dismiss">' +
          '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">' +
            '<path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
          '</svg>' +
        '</button>' +
      '</div>';

    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('cp-saved-nudge--in'); });

    var hideTimer = null;
    function hide(markDismissed) {
      if (markDismissed) {
        try { localStorage.setItem('cp_saved_nudge_dismissed', '1'); } catch (_) {}
      }
      el.classList.remove('cp-saved-nudge--in');
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
    }

    el.querySelector('.cp-saved-nudge__close')
      .addEventListener('click', function () { hide(true); });
    el.querySelector('.cp-saved-nudge__cta')
      .addEventListener('click', function () { hide(true); });

    hideTimer = setTimeout(function () { hide(false); }, 12000);
  }

  // Capture phase so we always run, even though the home page handler
  // calls stopPropagation on the bubble phase.
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('.property-card-save');
    if (!btn) return;
    pulseHeart(btn);
    // Existing handlers run after this in capture (they're on bubble or on
    // the grid container). Defer the count read so we see the post-toggle
    // state, then decide whether to show the nudge.
    setTimeout(function () {
      if (shouldShow()) showNudge();
    }, 80);
  }, true);
})();
