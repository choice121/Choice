// ============================================================
// Choice Properties — Unified Property Card Builder
// Provides: window.buildPropertyCard(p, opts)
//           window.initCardCarousel(card)
//
// Used by both index.html (featured section) and listings.html.
// Ensures pixel-perfect consistency between every card across
// the entire site. Always edit this file — never the per-page
// duplicates that this module replaced.
// ============================================================

(function () {
  'use strict';

  // ── HTML escape helper ──────────────────────────────────────
  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Rent formatter ──────────────────────────────────────────
  // P2-D: Wrap $ in branded span so it renders in brand blue.
  function fmtRent(v) {
    const n = Number(v);
    if (!n || n <= 0) return 'Contact';
    return '<span class="property-card-price-dollar">$</span>' + n.toLocaleString();
  }

  // ── Unified card builder ────────────────────────────────────
  /**
   * Build a property card HTML string.
   *
   * @param {Object} p     - property row from Supabase (with landlords join)
   * @param {Object} opts
   *   opts.imgSizes  {string}  - responsive sizes attr (default covers up to 4-col grid)
   *   opts.showFooter {bool}   - include "View Details + Share" footer row (default true)
   */
  function buildPropertyCard(p, opts) {
    opts = opts || {};
    const showFooter = opts.showFooter !== false;
    const imgSizes = opts.imgSizes ||
      '(max-width: 539px) calc(100vw - 32px), (max-width: 899px) calc(50vw - 28px), (max-width: 1319px) calc(33vw - 32px), calc(25vw - 32px)';

    const photos = (p.photo_urls && p.photo_urls.length) ? p.photo_urls : ['/assets/placeholder-property.jpg'];
    const title  = esc(p.title || 'Rental property');
    const id     = esc(p.id);

    // ── Image slides ──────────────────────────────────────────
    const slidesHtml = photos.map(function (url, i) {
      const imgSrc    = (window.CONFIG && CONFIG.img)    ? CONFIG.img(url, 'card')                  : url;
      const imgSrcset = (window.CONFIG && CONFIG.srcset) ? CONFIG.srcset(url, 'card', 'card_2x')    : '';
      const lqip      = (window.CP && CP.UI && CP.UI.lqipUrl) ? CP.UI.lqipUrl(url) : '';
      const lqipStyle = lqip ? ' style="background-image:url(\'' + lqip + '\');background-size:cover;background-position:center"' : '';
      return (
        '<div class="property-card-slide"' + lqipStyle + '>' +
          '<img src="' + imgSrc + '"' +
          (imgSrcset ? ' srcset="' + imgSrcset + '"' : '') +
          ' alt="' + title + ' photo ' + (i + 1) + '"' +
          ' sizes="' + imgSizes + '"' +
          ' loading="' + (i === 0 ? 'eager' : 'lazy') + '"' +
          (i === 0 ? ' fetchpriority="high"' : '') +
          ' decoding="async">' +
        '</div>'
      );
    }).join('');

    // ── Amenity tags ──────────────────────────────────────────
    var tags = [];
    if (p.pets_allowed) tags.push('<span class="property-card-tag tag-pet"><i class="fas fa-paw"></i> Pets OK</span>');
    if (p.parking)      tags.push('<span class="property-card-tag tag-parking"><i class="fas fa-car"></i> Parking</span>');
    if (Array.isArray(p.utilities_included) ? p.utilities_included.length > 0 : !!p.utilities_included) {
      tags.push('<span class="property-card-tag tag-utilities"><i class="fas fa-bolt"></i> Utilities</span>');
    }

    // ── Specs row ─────────────────────────────────────────────
    var specParts = [];
    if (p.bedrooms != null) specParts.push('<span class="property-card-spec-item"><i class="fas fa-bed"></i>' + (p.bedrooms === 0 ? 'Studio' : p.bedrooms + ' Bed') + '</span>');
    if (p.bathrooms)        specParts.push('<span class="property-card-spec-item"><i class="fas fa-bath"></i>' + p.bathrooms + ' Bath</span>');
    if (p.square_footage)   specParts.push('<span class="property-card-spec-item">' + Number(p.square_footage).toLocaleString() + ' sqft</span>');
    var specsHtml = specParts.map(function (s, i) {
      return i === 0 ? s : '<span class="property-card-spec-sep">·</span>' + s;
    }).join('');

    // ── Badge — priority: featured > hot(≤3d) > new(≤7d) > verified > available ─
    var ageDays  = p.created_at ? Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000) : 999;
    var availNow = !p.available_date || new Date(p.available_date) <= new Date();
    var badge = '';
    if (p.featured) {
      badge = '<div class="property-card-badge badge-featured"><i class="fas fa-star"></i> Featured</div>';
    } else if (ageDays <= 3) {
      badge = '<div class="property-card-badge badge-hot"><i class="fas fa-fire"></i> Hot Deal</div>';
    } else if (ageDays <= 7) {
      badge = '<div class="property-card-badge badge-new"><i class="fas fa-tag"></i> New Listing</div>';
    } else if (p.landlords && p.landlords.verified) {
      badge = '<div class="property-card-badge badge-verified"><i class="fas fa-shield-halved"></i> Verified</div>';
    } else if (availNow || !p.available_date) {
      badge = '<div class="property-card-badge badge-available"><i class="fas fa-circle-check"></i> Available Now</div>';
    } else {
      var availLabel = new Date(p.available_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      badge = '<div class="property-card-badge badge-available"><i class="fas fa-calendar"></i> Avail. ' + availLabel + '</div>';
    }

    // P2-B: Dots (≤6 photos) OR count pill (>6 photos) — never both
    var dotsHtml = '';
    var photoCountHtml = '';
    if (photos.length > 1) {
      if (photos.length <= 6) {
        var dotItems = photos.map(function(_, i) {
          return '<span class="property-card-dot' + (i === 0 ? ' active' : '') + '"></span>';
        }).join('');
        dotsHtml = '<div class="property-card-dots">' + dotItems + '</div>';
      } else {
        photoCountHtml = '<div class="property-card-photo-count"><i class="fas fa-camera"></i> ' + photos.length + '</div>';
      }
    }

    // ── Address ───────────────────────────────────────────────
    var addrLine = [p.address, p.city, p.state].filter(Boolean).join(', ');

    // P2-C: Property type label ────────────────────────────────
    var typeMap = { apartment: 'Apartment', house: 'House', condo: 'Condo', townhouse: 'Townhouse',
                    townhome: 'Townhome', studio: 'Studio', loft: 'Loft', room: 'Room', duplex: 'Duplex' };
    var typeLabel = p.property_type ? (typeMap[String(p.property_type).toLowerCase()] || esc(p.property_type)) : '';
    var typeHtml  = typeLabel ? '<div class="property-card-type">' + typeLabel + '</div>' : '';

    // ── Price ─────────────────────────────────────────────────
    var rentHtml = fmtRent(p.monthly_rent);
    var rentUnit = Number(p.monthly_rent) > 0 ? '<span class="property-card-price-unit">/mo</span>' : '';

    // ── Footer (View Details + Share) ─────────────────────────
    var footerHtml = showFooter
      ? '<div class="property-card-footer">' +
          '<a href="/property.html?id=' + id + '" class="property-card-view">View Details</a>' +
          '<button class="property-card-share" data-id="' + id + '" data-title="' + title + '" data-url="/property.html?id=' + id + '" aria-label="Share property"><i class="fas fa-share-nodes"></i> Share</button>' +
        '</div>'
      : '';

    // ── Nav arrows ────────────────────────────────────────────
    var navHtml = photos.length > 1
      ? '<button class="property-card-nav prev" data-dir="-1" aria-label="Previous photo"><i class="fas fa-chevron-left"></i></button>' +
        '<button class="property-card-nav next" data-dir="1"  aria-label="Next photo"><i class="fas fa-chevron-right"></i></button>'
      : '';

    return (
      '<article class="property-card" data-id="' + id + '">' +
        '<a href="/property.html?id=' + id + '" style="display:block;text-decoration:none" tabindex="-1" aria-hidden="true">' +
          '<div class="property-card-img">' +
            '<div class="property-card-slides">' + slidesHtml + '</div>' +
            navHtml +
            badge +
            dotsHtml +
            photoCountHtml +
          '</div>' +
        '</a>' +
        '<button class="property-card-save" data-id="' + id + '" aria-label="Save property"><i class="far fa-heart"></i></button>' +
        '<div class="property-card-body">' +
          typeHtml +
          '<div class="property-card-price">' + rentHtml + rentUnit + '</div>' +
          (specsHtml ? '<div class="property-card-specs">' + specsHtml + '</div>' : '') +
          '<a href="/property.html?id=' + id + '" style="text-decoration:none">' +
            '<div class="property-card-title">' + title + '</div>' +
          '</a>' +
          '<div class="property-card-addr"><i class="fas fa-location-dot"></i>' + addrLine + '</div>' +
          (tags.length ? '<div class="property-card-tags">' + tags.join('') + '</div>' : '') +
        '</div>' +
        footerHtml +
      '</article>'
    );
  }

  // ── Carousel initialiser ────────────────────────────────────
  /**
   * Attach carousel prev/next and touch-swipe behaviour to a card element.
   * Call once per card after it is inserted into the DOM.
   */
  function initCardCarousel(card) {
    var slides  = card.querySelector('.property-card-slides');
    var navBtns = card.querySelectorAll('.property-card-nav');
    if (!slides || !navBtns.length) return;

    var idx   = 0;
    var total = card.querySelectorAll('.property-card-slide').length;
    var dots  = card.querySelectorAll('.property-card-dot');

    function goTo(n) {
      idx = (n + total) % total;
      slides.style.transform = 'translateX(-' + (idx * 100) + '%)';
      // P2-B: Update active dot
      dots.forEach(function(dot, i) { dot.classList.toggle('active', i === idx); });
    }

    navBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        goTo(idx + parseInt(btn.dataset.dir, 10));
      });
    });

    var touchX = 0;
    slides.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
    slides.addEventListener('touchend', function (e) {
      var diff = touchX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 40) goTo(idx + (diff > 0 ? 1 : -1));
    }, { passive: true });
  }

  // ── Expose globally ─────────────────────────────────────────
  window.buildPropertyCard = buildPropertyCard;
  window.initCardCarousel  = initCardCarousel;

})();
