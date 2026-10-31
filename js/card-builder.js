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

  function escAttr(s) {
    return esc(s).replace(/'/g, '&#39;');
  }

  // ── Slug helpers for city-page links ────────────────────────
  function toSlug(s) {
    return String(s || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  var _STATE_SLUG = {
    AL:'alabama',AK:'alaska',AZ:'arizona',AR:'arkansas',CA:'california',
    CO:'colorado',CT:'connecticut',DE:'delaware',FL:'florida',GA:'georgia',
    HI:'hawaii',ID:'idaho',IL:'illinois',IN:'indiana',IA:'iowa',
    KS:'kansas',KY:'kentucky',LA:'louisiana',ME:'maine',MD:'maryland',
    MA:'massachusetts',MI:'michigan',MN:'minnesota',MS:'mississippi',MO:'missouri',
    MT:'montana',NE:'nebraska',NV:'nevada',NH:'new-hampshire',NJ:'new-jersey',
    NM:'new-mexico',NY:'new-york',NC:'north-carolina',ND:'north-dakota',OH:'ohio',
    OK:'oklahoma',OR:'oregon',PA:'pennsylvania',RI:'rhode-island',SC:'south-carolina',
    SD:'south-dakota',TN:'tennessee',TX:'texas',UT:'utah',VT:'vermont',
    VA:'virginia',WA:'washington',WV:'west-virginia',WI:'wisconsin',WY:'wyoming',
    DC:'district-of-columbia'
  };

  function cityPageUrl(city, state) {
    if (!city || !state) return null;
    return '/listings.html?' + new URLSearchParams({ city: city, state: state });
  }

  // ── Rent formatter ──────────────────────────────────────────
  // P2-D: Wrap $ in branded span so it renders in brand blue.
  function fmtRent(v) {
    const n = Number(v);
    if (!n || n <= 0) return 'Contact';
    return '<span class="property-card-price-dollar">$</span>' + n.toLocaleString();
  }

  function summarizeCommunityLayouts(units) {
    if (!Array.isArray(units)) return null;
    const plans = units.filter(unit =>
      unit &&
      typeof unit.floor_plan_name === 'string' &&
      unit.floor_plan_name.trim() &&
      !(typeof unit.unit_number === 'string' && unit.unit_number.trim())
    );
    if (!plans.length) return null;

    function values(field) {
      return [...new Set(plans
        .map(unit => unit[field] == null || unit[field] === '' ? NaN : Number(unit[field]))
        .filter(value => Number.isFinite(value) && value >= 0))]
        .sort((a, b) => a - b);
    }

    function range(list, suffix) {
      if (!list.length) return '';
      const first = list[0];
      const last = list[list.length - 1];
      if (first === 0 && suffix === 'bed') {
        if (list.length === 1) return 'Studio';
        return list.length === 2 ? `Studio, ${last} bed${last === 1 ? '' : 's'}` : `Studio–${last} beds`;
      }
      if (first === last) return first === 0 && suffix === 'bed' ? 'Studio' : `${first} ${suffix}${first === 1 ? '' : 's'}`;
      return `${first}–${last} ${suffix}s`;
    }

    const rents = values('monthly_rent').filter(value => value > 0);
    const sqft = values('square_footage').filter(value => value > 0);
    return {
      count: plans.length,
      minRent: rents.length ? rents[0] : null,
      bedrooms: range(values('bedrooms'), 'bed'),
      bathrooms: range(values('bathrooms'), 'bath'),
      sqft: sqft.length
        ? `~${Math.round(sqft[0] / 25) * 25}${sqft[0] === sqft[sqft.length - 1] ? '' : `–~${Math.round(sqft[sqft.length - 1] / 25) * 25}`} sqft`
        : '',
    };
  }

  // ── Listed date label ────────────────────────────────────────
  // Prefer the original listing date from the source site when it exists.
  // Only fall back to the import date if the source listing date is missing,
  // so public cards do not misrepresent an older listing as newly listed.
  function listedDateLabel(listedAt, importedAt) {
    return null;
  }

  // ── Unified card builder ────────────────────────────────────
  /**
   * Build a property card HTML string.
   *
   * @param {Object} p     - property row from Supabase (with landlords join)
   * @param {Object} opts
   *   opts.imgSizes  {string}  - responsive sizes attr (default covers up to 4-col grid)
   */
  function buildPropertyCard(p, opts) {
    opts = opts || {};
    const imgSizes = opts.imgSizes ||
      '(max-width: 399px) calc(100vw - 32px), (max-width: 899px) calc(50vw - 28px), (max-width: 1319px) calc(33vw - 32px), calc(25vw - 32px)';

    const rawPhotos = (p.photo_urls && p.photo_urls.length) ? p.photo_urls : ['/assets/placeholder-property.jpg'];
    // TEMPORARY DIRECTIVE: Image reordering is disabled.
    // All images must be ordered exactly as they came from the original source.
    // The interior-first reordering logic below is preserved but disabled until further notice.
    var photos = rawPhotos;
    const PHOTO_REORDERING_ENABLED = false;
    if (PHOTO_REORDERING_ENABLED && rawPhotos.length >= 3) {
      var reordered = rawPhotos.slice();
      var exterior = reordered.shift();
      var insertIdx = Math.min(3, reordered.length);
      reordered.splice(insertIdx, 0, exterior);
      photos = reordered;
    }
    const title  = esc(p.title || 'Rental property');
    const community = summarizeCommunityLayouts(p.property_units);
    const rawId  = p.id;
    const id     = esc(p.id);
    let propUrl = rawId ? ('/property.html?id=' + encodeURIComponent(rawId)) : '/listings.html';
    if (rawId && typeof window !== 'undefined' && window.location) {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const share = urlParams.get('share');
        const shareHash = new URLSearchParams(window.location.hash.slice(1)).get('share');
        const fromP = opts.from_p || urlParams.get('p') || urlParams.get('ids') || urlParams.get('from_p');
        if (share || shareHash) {
          propUrl += '#share=' + encodeURIComponent(share || shareHash);
        } else if (fromP) {
          propUrl += '&from_p=' + encodeURIComponent(fromP);
        }
      } catch (_) {}
    }

    // ── Image slides ──────────────────────────────────────────
    const slidesHtml = photos.map(function (url, i) {
      const imgSrc    = (window.CONFIG && CONFIG.img)    ? CONFIG.img(url, 'card')               : url;
      const imgSrcset = (window.CONFIG && CONFIG.srcset) ? CONFIG.srcset(url, 'card', 'card_2x') : '';
      const lqip      = (window.CP && window.CP.UI && window.CP.UI.lqipUrl) ? window.CP.UI.lqipUrl(url) : '';
      const lqipStyle = lqip ? ' style="background-image:url(\'' + escAttr(lqip) + '\');background-size:cover;background-position:center"' : '';
      return (
        '<div class="property-card-slide"' + lqipStyle + '>' +
          '<img src="' + escAttr(imgSrc) + '"' +
          (imgSrcset ? ' srcset="' + escAttr(imgSrcset) + '"' : '') +
          ' alt="' + title + ' photo ' + (i + 1) + '"' +
          ' sizes="' + imgSizes + '"' +
          ' loading="' + (i === 0 ? 'eager' : 'lazy') + '"' +
          (i === 0 ? ' fetchpriority="high"' : '') +
          ' referrerpolicy="no-referrer"' +
          ' decoding="async"' +
          ' onerror="this.onerror=null;this.srcset=\'\';this.src=\'/assets/placeholder-property.jpg\';">' +
        '</div>'
      );
    }).join('');

    // ── Specs row — beds + baths + sqft (sqft is rounded to ~25 increments) ─
    var specParts = [];
    if (community) {
      if (community.bedrooms) specParts.push('<span class="property-card-spec-item"><i class="fas fa-bed"></i>' + esc(community.bedrooms) + '</span>');
      if (community.bathrooms) specParts.push('<span class="property-card-spec-item"><i class="fas fa-bath"></i>' + esc(community.bathrooms) + '</span>');
      if (community.sqft) specParts.push('<span class="property-card-spec-item"><i class="fas fa-ruler-combined"></i>' + esc(community.sqft) + '</span>');
    } else {
      if (p.bedrooms != null) specParts.push('<span class="property-card-spec-item"><i class="fas fa-bed"></i>' + (p.bedrooms === 0 ? 'Studio' : p.bedrooms + ' Bed' + (Number(p.bedrooms) === 1 ? '' : 's')) + '</span>');
      if (p.bathrooms)        specParts.push('<span class="property-card-spec-item"><i class="fas fa-bath"></i>' + p.bathrooms + ' Bath' + (Number(p.bathrooms) === 1 ? '' : 's') + '</span>');
    }
    if (!community && p.square_footage) {
      var roundedSqft = Math.round(Number(p.square_footage) / 25) * 25;
      specParts.push('<span class="property-card-spec-item"><i class="fas fa-ruler-combined"></i>~' + roundedSqft.toLocaleString() + ' sqft</span>');
    }
    var specsHtml = specParts.map(function (s, i) {
      return i === 0 ? s : '<span class="property-card-spec-sep">·</span>' + s;
    }).join('');

    // ── Badge — priority: featured only (Private placement badges completely disabled) ──
    var badge = '';
    if (p.featured) {
      badge = '<div class="property-card-badge badge-featured"><i class="fas fa-star"></i> Featured</div>';
    }

    var mediaItems = Array.isArray(p.property_media) ? p.property_media : [];
    var hasVideoTour = mediaItems.some(function(item) {
      return item && item.kind === 'video' && typeof item.url === 'string' && item.url.trim();
    });
    var hasThreeDTour = !!(p.virtual_tour_url && String(p.virtual_tour_url).trim()) || mediaItems.some(function(item) {
      return item && (item.kind === 'virtual_tour' || item.kind === 'tour_3d') && typeof item.url === 'string' && item.url.trim();
    });
    var mediaBadges = [];
    if (hasThreeDTour) mediaBadges.push('<span class="property-card-media-badge"><i class="fas fa-cube" aria-hidden="true"></i> 3D tour</span>');
    if (hasVideoTour) mediaBadges.push('<span class="property-card-media-badge"><i class="fas fa-play" aria-hidden="true"></i> Video tour</span>');
    var mediaBadgesHtml = mediaBadges.length
      ? '<div class="property-card-media-badges" role="group" aria-label="Available property media for ' + title + '">' + mediaBadges.join('') + '</div>'
      : '';

    var listedLabel = listedDateLabel(p.listed_at, p.imported_at || p.created_at);

    // Type chip removed from card — type is in the title and the filter bar.

    // ── P2-B: Dots (≤6 photos) OR count pill (>6 photos) — never both ──
    var dotsHtml = '';
    var photoCountHtml = '';
    if (photos.length > 1) {
      if (photos.length <= 6) {
        var dotItems = photos.map(function(_, i) {
          return '<button class="property-card-dot' + (i === 0 ? ' active' : '') + '" type="button" data-idx="' + i + '" aria-pressed="' + (i === 0 ? 'true' : 'false') + '" aria-label="Show photo ' + (i + 1) + ' of ' + title + '"></button>';
        }).join('');
        dotsHtml = '<div class="property-card-dots" role="group" aria-label="Photo selection for ' + title + '">' + dotItems + '</div>';
      } else {
        photoCountHtml = '<div class="property-card-photo-count"><i class="fas fa-camera"></i> ' + photos.length + '</div>';
      }
    }

    // ── Address ───────────────────────────────────────────────
    var addrLine = esc([p.address, p.city, p.state].filter(Boolean).join(', '));

    // ── Price ─────────────────────────────────────────────────
    var cardRent = community ? community.minRent : p.monthly_rent;
    var rentHtml = community && cardRent == null ? 'See layouts' : fmtRent(cardRent);
    var rentUnit = Number(cardRent) > 0 ? '<span class="property-card-price-unit">/mo</span>' : '';
    var communityPricePrefix = community && cardRent != null
      ? '<span class="property-card-community-prefix">From </span>'
      : '';
    var communitySummary = community
      ? '<div class="property-card-community-summary">' + community.count + (community.count === 1 ? ' floor plan' : ' floor plans') + '</div>'
      : '';

    return (
      '<article class="property-card" id="card-' + id + '" data-id="' + id + '"' + (p.featured ? ' data-featured="1"' : '') + '>' +

        // ── Image block ────────────────────────────────────────
        '<div class="property-card-img">' +
          '<div class="property-card-slides">' + slidesHtml + '</div>' +
          // Featured / verified badge — top-left (self-positioned via .property-card-badge)
          badge +
          // Tour availability
          mediaBadgesHtml +
          // Carousel position indicators — bottom-center
          dotsHtml +
          // Photo count — bottom-right (only when >6 photos)
          photoCountHtml +
          // Save heart — top-right, sole action on the photo
          '<div class="property-card-actions">' +
            '<button class="property-card-save" type="button" data-id="' + id + '" data-title="' + title + '" aria-label="Save rental: ' + title + '" aria-pressed="false">' +
              '<i class="far fa-heart" aria-hidden="true"></i>' +
            '</button>' +
          '</div>' +
          // Carousel arrows — desktop only (hidden on touch via CSS)
          (photos.length > 1
            ? '<button class="property-card-arrow property-card-arrow--prev" type="button" aria-label="Previous photo of ' + title + '"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>' +
              '<button class="property-card-arrow property-card-arrow--next" type="button" aria-label="Next photo of ' + title + '"><i class="fas fa-chevron-right" aria-hidden="true"></i></button>'
            : '') +
        '</div>' +

        // ── Body — full-width link for click-through ───────────
        '<a href="' + escAttr(propUrl) + '" class="property-card-body" aria-label="' + title + '">' +
          // 1. Title (2-line clamp — most prominent element)
          '<div class="property-card-title">' + title + '</div>' +
          // 2. Address inline
          '<div class="property-card-addr">' +
            '<i class="fas fa-location-dot"></i>' + addrLine +
            (listedLabel ? '<span class="property-card-addr-sep">·</span><span class="property-card-listed-date">' + listedLabel + '</span>' : '') +
          '</div>' +
          // 3. Specs — beds + baths + sqft
          (specsHtml ? '<div class="property-card-specs">' + specsHtml + '</div>' : '') +
          communitySummary +
          // 4. Footer — price pinned to bottom (no divider)
          '<div class="property-card-footer">' +
            '<div class="property-card-price">' + communityPricePrefix + rentHtml + rentUnit + '</div>' +
            (p.city && p.state
              ? '<span class="prop-city-badge" title="' + esc(p.city) + ', ' + esc(p.state) + '" aria-label="Location: ' + esc(p.city) + ', ' + esc(p.state) + '">' +
                  '<i class="fas fa-location-dot"></i> ' + esc(p.city) + ', ' + esc(p.state) +
                '</span>'
              : '') +
          '</div>' +
        '</a>' +

      '</article>'
    );
  }

  // ── Carousel initialiser ────────────────────────────────────
  /**
   * Attach carousel touch-swipe and keyboard behaviour to a card element.
   * Nav arrows removed — navigation via swipe (touch) and arrow keys (keyboard).
   */
  function initCardCarousel(card) {
    var slides = card.querySelector('.property-card-slides');
    if (!slides) return;

    var total = card.querySelectorAll('.property-card-slide').length;
    if (total < 2) return;

    var idx  = 0;
    var dots = Array.prototype.slice.call(card.querySelectorAll('.property-card-dot'));

    function goTo(n) {
      idx = (n + total) % total;
      slides.style.transform = 'translateX(-' + (idx * 100) + '%)';
      // P2-B: Update active dot (buttons are focusable + clickable)
      dots.forEach(function(dot, i) {
        var active = i === idx;
        dot.classList.toggle('active', active);
        dot.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }

    // Click handlers for dots
    dots.forEach(function(dot) {
      dot.addEventListener('click', function (e) { e.stopPropagation(); goTo(parseInt(this.dataset.idx, 10)); });
    });

    // Touch swipe
    var touchX = 0;
    slides.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
    slides.addEventListener('touchend', function (e) {
      var diff = touchX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 40) goTo(idx + (diff > 0 ? 1 : -1));
    }, { passive: true });

    // Desktop arrow buttons
    var prevBtn = card.querySelector('.property-card-arrow--prev');
    var nextBtn = card.querySelector('.property-card-arrow--next');
    if (prevBtn) prevBtn.addEventListener('click', function (e) { e.stopPropagation(); goTo(idx - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function (e) { e.stopPropagation(); goTo(idx + 1); });

    // P3-B: Keyboard navigation — ArrowLeft/ArrowRight when card has focus
    function onKeyDown(e) {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); goTo(idx - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); goTo(idx + 1); }
    }
    card.setAttribute('tabindex', card.getAttribute('tabindex') || '0');
    card.addEventListener('focus',  function () { document.addEventListener('keydown', onKeyDown); });
    card.addEventListener('blur',   function (e) {
      if (!card.contains(e.relatedTarget)) { document.removeEventListener('keydown', onKeyDown); }
    });
  }

  // ── Expose globally ─────────────────────────────────────────
  window.buildPropertyCard = buildPropertyCard;
  window.initCardCarousel  = initCardCarousel;

})();
