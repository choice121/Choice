/* Phase L6 — Backdrop-blur sticky nav refinement (BATCH_06)
 * Toggles body[data-mv2-scrolled="true|false"] based on whether the user has
 * scrolled past a small threshold from the top. Lets CSS swap the nav between
 * a more transparent over-hero state and a fully frosted "lifted" state with
 * a hairline + soft shadow.
 *
 * Uses requestAnimationFrame throttling. Passive scroll listener.
 * Honors prefers-reduced-motion (still toggles state, CSS skips the transition).
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.document) return;
  // Only run on the home page; that's the only place the over-hero state matters.
  if (document.body && document.body.dataset && document.body.dataset.page !== 'home') return;
  if (document.documentElement.dataset.mv2NavInit === '1') return;
  document.documentElement.dataset.mv2NavInit = '1';

  var THRESHOLD = 24;
  var ticking = false;

  function setState(scrolled) {
    var cur = document.body.getAttribute('data-mv2-scrolled') === 'true';
    if (cur === scrolled) return;
    document.body.setAttribute('data-mv2-scrolled', scrolled ? 'true' : 'false');
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      setState(window.scrollY > THRESHOLD);
      ticking = false;
    });
  }

  // Set initial state synchronously so the nav renders correctly on first paint.
  setState(window.scrollY > THRESHOLD);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
})();
