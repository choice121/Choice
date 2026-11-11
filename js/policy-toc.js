/* ─────────────────────────────────────────────────────────────────────
 * Auto-build a sticky side-rail Table of Contents for policy / legal
 * pages from the H2 headings inside `.info-doc .info-section`.
 *
 * Skips pages that already include a top-block TOC (`.policy-toc`).
 * Hidden on viewports < 1280px via cp-marketing.css.
 *
 * Used by: policies.html, privacy.html, terms.html, fair-housing.html,
 *          application-credit-policy.html, holding-deposit-policy.html,
 *          rental-application-policy.html, landlord-platform-agreement.html,
 *          policy-changelog.html
 * ───────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  function slugify(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/^\s*\d+\.\s*/, '')      // strip leading "12. "
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'section';
  }

  function buildToc() {
    // Don't double up on pages with an existing top-block TOC.
    if (document.querySelector('.policy-toc')) return;

    var sections = document.querySelectorAll('.info-doc .info-section');
    if (sections.length < 3) return;       // not enough to bother

    var items = [];
    sections.forEach(function (sec) {
      var h2 = sec.querySelector('h2');
      if (!h2) return;
      var id = sec.id || h2.id;
      if (!id) {
        id = slugify(h2.textContent);
        // ensure unique
        var n = 1, base = id;
        while (document.getElementById(id)) { id = base + '-' + (++n); }
        sec.id = id;
      }
      // strip the leading "12. " from the link label
      var label = h2.textContent.replace(/^\s*\d+\.\s*/, '').trim();
      items.push({ id: id, label: label });
    });

    if (!items.length) return;

    var nav = document.createElement('nav');
    nav.className = 'policy-toc-side';
    nav.setAttribute('aria-label', 'On this page');

    var heading = document.createElement('h4');
    heading.textContent = 'On this page';
    nav.appendChild(heading);

    var ol = document.createElement('ol');
    items.forEach(function (item) {
      var li = document.createElement('li');
      var a  = document.createElement('a');
      a.href = '#' + item.id;
      a.textContent = item.label;
      li.appendChild(a);
      ol.appendChild(li);
    });
    nav.appendChild(ol);
    document.body.appendChild(nav);

    // Active-section highlighting via IntersectionObserver
    if ('IntersectionObserver' in window) {
      var links = nav.querySelectorAll('a');
      var byId  = {};
      links.forEach(function (l) { byId[l.getAttribute('href').slice(1)] = l; });

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          var link = byId[e.target.id];
          if (!link) return;
          if (e.isIntersecting && e.intersectionRatio > 0.1) {
            links.forEach(function (l) { l.classList.remove('is-active'); });
            link.classList.add('is-active');
          }
        });
      }, { rootMargin: '-100px 0px -55% 0px', threshold: [0, 0.1, 0.5] });

      items.forEach(function (item) {
        var el = document.getElementById(item.id);
        if (el) observer.observe(el);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildToc);
  } else {
    buildToc();
  }
})();
