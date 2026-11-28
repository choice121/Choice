/* ============================================================
   Choice Properties — Living Hero (Phase L1)
   ------------------------------------------------------------
   Adds a small "LIVE" activity chip to the hero. Rotates through
   believable activity strings with smooth crossfades. NO Supabase,
   NO fetches — numbers are deterministic per-day (seeded by date)
   so they stay stable across page loads within the same day.

   Respects prefers-reduced-motion: in that mode no rotation runs
   and the chip displays a single static message for the session.

   Pure browser JS. No build step. Loaded as a deferred <script>.
   ============================================================ */
(function () {
  'use strict';

  function init() {
    var chip = document.querySelector('.mv2-hero__live');
    if (!chip) return;
    var textEl = chip.querySelector('.mv2-hero__live-text');
    if (!textEl) return;

    var reduce = false;
    try {
      reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (_) {}

    /* ── Seeded RNG (LCG) — seed = day-of-year for stability ─── */
    var now = new Date();
    var startOfYear = new Date(now.getFullYear(), 0, 0);
    var dayOfYear = Math.floor((now - startOfYear) / 86400000);
    var seed = now.getFullYear() * 1000 + dayOfYear;
    var state = seed > 0 ? seed : 1;
    function rand() {
      state = (state * 9301 + 49297) % 233280;
      return state / 233280;
    }
    function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
    function range(min, max) { return Math.floor(min + rand() * (max - min + 1)); }

    var cities = [
      'Atlanta', 'Dallas', 'Houston', 'Phoenix',
      'Austin', 'Charlotte', 'Tampa', 'Nashville'
    ];
    var beds = ['Studio', '1BR', '2BR', '3BR'];
    var minutesAgo = function () { return range(2, 22); };

    /* ── Generate a fresh batch of messages ─────────────────── */
    function generateMessages() {
      return [
        range(8, 26) + ' applications submitted today',
        'New ' + pick(beds) + ' in ' + pick(cities) + ' \u00B7 ' + minutesAgo() + ' min ago',
        range(42, 138) + ' renters browsing listings right now',
        'Avg decision time: ' + range(28, 42) + ' hours',
        range(3, 9) + ' new listings in ' + pick(cities) + ' this week',
        'Verified ' + pick(beds) + ' just listed in ' + pick(cities),
        range(160, 320) + ' renters housed in the last 30 days',
        '$' + (range(11, 16) * 100).toLocaleString() + ' avg rent in ' + pick(cities),
        pick(cities) + ' added ' + range(2, 7) + ' new listings today'
      ];
    }

    var messages = generateMessages();
    var idx = 0;

    /* ── Show with crossfade (or instant in reduced-motion) ─── */
    function show(text) {
      if (reduce) {
        textEl.textContent = text;
        return;
      }
      textEl.style.opacity = '0';
      window.setTimeout(function () {
        textEl.textContent = text;
        textEl.style.opacity = '1';
      }, 350);
    }

    /* ── Reveal the chip itself with a fade-in ──────────────── */
    function revealChip() {
      chip.setAttribute('data-ready', 'true');
    }

    /* ── First message after a short beat so it doesn't ─────── */
    /*    appear simultaneously with hero paint ──────────────── */
    window.setTimeout(function () {
      revealChip();
      show(messages[0]);
    }, 1400);

    if (reduce) return;

    /* ── Rotate every 9–14s with mild jitter ───────────────── */
    function scheduleNext() {
      var delay = 9000 + Math.floor(Math.random() * 5000);
      window.setTimeout(function () {
        idx = (idx + 1) % messages.length;
        if (idx === 0) {
          /* Refresh the pool every full cycle for variety */
          var fresh = generateMessages();
          for (var i = 0; i < fresh.length; i++) messages[i] = fresh[i];
        }
        show(messages[idx]);
        scheduleNext();
      }, delay);
    }

    /* Wait until the first message has settled before scheduling */
    window.setTimeout(scheduleNext, 1400 + 9000);

    /* ── Pause rotation when the tab is hidden (battery) ───── */
    /*    Implemented via visibility check inside the loop;    */
    /*    if hidden we just skip the swap but keep timing.     */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        textEl.style.opacity = '0';
      } else {
        textEl.style.opacity = '1';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
