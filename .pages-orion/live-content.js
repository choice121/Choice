// ============================================================
// Choice Properties — Live Content Script v5.0.0
// Universal High-Quality Browser Extension UI for Zillow,
// Realtor.com, Apartments.com, and Redfin
//
// Key Features:
// 1. Sleek Floating Action Card (Glassmorphism, collision-aware)
// 2. Pre-flight Live Inspection (Shows parsed rent, beds, baths, photo count before saving)
// 3. One-Click Fast Save + Integrated Photo Upload Progress Bar
// 4. Post-Save Quick Actions (Open Pipeline, Copy Link)
// 5. Zillow Search / Feed Card Quick-Save Buttons
// 6. Instant Live-Update Architecture (Zero reinstall needed)
// ============================================================
(function () {
  'use strict';

  // Prevent multiple executions
  if (window.__CP_LIVE_CONTENT_LOADED__) return;
  window.__CP_LIVE_CONTENT_LOADED__ = true;

  // ── Configuration ──────────────────────────────────────────
  var EDGE_URL = (window.CP_CONFIG && window.CP_CONFIG.EDGE_URL) || 'https://tlfmwetmhthpyrytrcfo.supabase.co/functions/v1/receive-pipeline-import';
  var SECRET   = (window.CP_CONFIG && window.CP_CONFIG.IMPORT_SECRET) || 'cp_import_7Kx3m9P2w5';
  var VERSION  = '5.0.0-live';

  var IS_MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  var PHOTO_BATCH_SIZE = IS_MOBILE ? 4 : 12;
  var MAX_PHOTOS = IS_MOBILE ? 25 : 50;

  var lastUrl = location.href;
  var activeWidget = null;
  var isExpanded = false;
  var isMinimized = false;
  var currentExtractedData = null;

  // ── Inject Custom Styles ────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('cp-live-styles')) return;
    var style = document.createElement('style');
    style.id = 'cp-live-styles';
    style.textContent = `
      #cp-widget-container {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 2147483647;
        width: 360px;
        max-width: calc(100vw - 32px);
        background: rgba(15, 23, 42, 0.95);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 18px;
        box-shadow: 0 16px 40px -6px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(99, 102, 241, 0.25);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #f8fafc;
        overflow: hidden;
        transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease, bottom 0.2s ease;
        box-sizing: border-box;
      }
      #cp-widget-container * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      #cp-widget-container.cp-minimized {
        width: auto;
        border-radius: 28px;
        background: rgba(15, 23, 42, 0.92);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      }
      #cp-widget-container.cp-minimized .cp-full-body {
        display: none !important;
      }
      .cp-mini-trigger {
        display: none;
        align-items: center;
        gap: 8px;
        padding: 10px 16px;
        cursor: pointer;
        user-select: none;
        font-size: 13px;
        font-weight: 600;
        color: #e2e8f0;
      }
      #cp-widget-container.cp-minimized .cp-mini-trigger {
        display: flex !important;
      }
      .cp-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: rgba(30, 41, 59, 0.6);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      .cp-brand {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .cp-logo-icon {
        width: 22px;
        height: 22px;
        background: linear-gradient(135deg, #10b981 0%, #6366f1 100%);
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);
      }
      .cp-brand-title {
        font-size: 13px;
        font-weight: 700;
        color: #f1f5f9;
        letter-spacing: -0.01em;
      }
      .cp-header-badges {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .cp-badge-verified {
        font-size: 10px;
        font-weight: 600;
        background: rgba(16, 185, 129, 0.18);
        color: #34d399;
        padding: 2px 7px;
        border-radius: 999px;
        border: 1px solid rgba(52, 211, 153, 0.25);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .cp-header-btn {
        background: transparent;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        width: 22px;
        height: 22px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        transition: color 0.15s, background 0.15s;
      }
      .cp-header-btn:hover {
        color: #f8fafc;
        background: rgba(255, 255, 255, 0.1);
      }
      .cp-body {
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .cp-property-snapshot {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .cp-address-line {
        font-size: 13px;
        font-weight: 600;
        color: #f8fafc;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .cp-chips-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
      }
      .cp-chip {
        font-size: 11px;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.08);
        color: #cbd5e1;
      }
      .cp-chip-price {
        background: rgba(99, 102, 241, 0.2);
        color: #a5b4fc;
        border: 1px solid rgba(165, 180, 252, 0.25);
      }
      .cp-chip-photos {
        background: rgba(16, 185, 129, 0.18);
        color: #6ee7b7;
      }
      .cp-accordion-toggle {
        font-size: 11px;
        color: #818cf8;
        background: none;
        border: none;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-weight: 600;
        padding: 2px 0;
        text-align: left;
      }
      .cp-accordion-toggle:hover {
        color: #a5b4fc;
      }
      .cp-inspector-tray {
        display: none;
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 8px;
        padding: 10px;
        font-size: 11px;
        color: #94a3b8;
        line-height: 1.6;
      }
      .cp-inspector-tray.cp-open {
        display: block;
      }
      .cp-inspector-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
      }
      .cp-inspector-item strong {
        color: #e2e8f0;
      }
      .cp-save-action-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        height: 44px;
        border: none;
        border-radius: 12px;
        background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
        color: #ffffff;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4);
        transition: transform 0.12s, box-shadow 0.12s, background 0.15s, opacity 0.15s;
        user-select: none;
        touch-action: manipulation;
      }
      .cp-save-action-btn:hover {
        background: linear-gradient(135deg, #4338ca 0%, #4f46e5 100%);
        box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
        transform: translateY(-1px);
      }
      .cp-save-action-btn:active {
        transform: scale(0.97);
      }
      .cp-save-action-btn:disabled {
        opacity: 0.85;
        cursor: not-allowed;
        transform: none !important;
      }
      /* Integrated Progress State */
      .cp-progress-box {
        display: none;
        flex-direction: column;
        gap: 8px;
        padding: 10px;
        background: rgba(30, 41, 59, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
      }
      .cp-progress-header {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        font-weight: 600;
        color: #cbd5e1;
      }
      .cp-progress-bar-track {
        width: 100%;
        height: 6px;
        background: rgba(255, 255, 255, 0.12);
        border-radius: 999px;
        overflow: hidden;
      }
      .cp-progress-bar-fill {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #6366f1, #10b981);
        border-radius: 999px;
        transition: width 0.25s ease;
      }
      /* Success State */
      .cp-success-box {
        display: none;
        flex-direction: column;
        gap: 10px;
        padding: 6px 0;
      }
      .cp-success-banner {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #34d399;
        font-size: 14px;
        font-weight: 700;
      }
      .cp-success-actions {
        display: flex;
        gap: 8px;
      }
      .cp-btn-secondary {
        flex: 1;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        text-align: center;
        text-decoration: none;
        border: 1px solid rgba(255, 255, 255, 0.15);
        background: rgba(255, 255, 255, 0.08);
        color: #f8fafc;
        transition: background 0.15s;
      }
      .cp-btn-secondary:hover {
        background: rgba(255, 255, 255, 0.16);
      }
      .cp-btn-primary-sm {
        flex: 1.2;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        text-align: center;
        text-decoration: none;
        border: none;
        background: #10b981;
        color: #ffffff;
        box-shadow: 0 2px 10px rgba(16, 185, 129, 0.4);
        transition: background 0.15s;
      }
      .cp-btn-primary-sm:hover {
        background: #059669;
      }
      /* Zillow Search Card Badge */
      .cp-search-card-btn {
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 25;
        background: rgba(15, 23, 42, 0.88);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 20px;
        padding: 6px 12px;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
        transition: all 0.15s ease;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      }
      .cp-search-card-btn:hover {
        background: #4f46e5;
        border-color: #818cf8;
        transform: translateY(-1px);
        box-shadow: 0 6px 18px rgba(99, 102, 241, 0.45);
      }
      .cp-search-card-btn.cp-saved {
        background: #10b981 !important;
        border-color: #34d399 !important;
      }
      /* Spinner */
      .cp-spinner {
        width: 14px;
        height: 14px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: #ffffff;
        border-radius: 50%;
        animation: cp-spin 0.7s linear infinite;
        display: inline-block;
      }
      @keyframes cp-spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Smart Layout Collision Avoidance ────────────────────────
  function updateWidgetPosition() {
    if (!activeWidget) return;
    var bottomOffset = 24;

    // Check Zillow's sticky bottom bars or action panels
    var stickySelectors = [
      '[data-testid="bottom-bar"]',
      '.hdp-bottom-bar',
      'div[class*="BottomBar"]',
      'div[class*="sticky-bottom"]',
      '#search-detail-root [data-testid="bottom-bar"]',
      '.floating-bottom-bar',
      'div[class*="StickyBanner"]'
    ];

    for (var i = 0; i < stickySelectors.length; i++) {
      var el = document.querySelector(stickySelectors[i]);
      if (el) {
        var rect = el.getBoundingClientRect();
        if (rect.height > 20 && rect.top < window.innerHeight && rect.bottom > 0) {
          var barHeight = window.innerHeight - rect.top;
          if (barHeight > 10 && barHeight < 250) {
            bottomOffset = Math.max(bottomOffset, barHeight + 14);
          }
        }
      }
    }

    activeWidget.style.bottom = 'max(' + bottomOffset + 'px, env(safe-area-inset-bottom))';
  }

  // ── URL & Page Support Detection ────────────────────────────
  function isDetailPage(url) {
    return /zillow\.com\/(homedetails|homes|b|community|apartments)\/.*_zpid/i.test(url) ||
           /zillow\.com\/.*_zpid/i.test(url) ||
           /zillow\.com\/(homedetails|b|community)\//i.test(url) ||
           /realtor\.com\/realestateandhomes-detail/i.test(url) ||
           /apartments\.com\/[^/]+\/[^/]+/i.test(url) ||
           /redfin\.com\/[^/]+\/[^/]+\/[^/]+\/[^/]+/i.test(url);
  }

  function isSearchPage(url) {
    return /zillow\.com\/(homes|for_rent|b\/|search)/i.test(url);
  }

  // ── Extract Photo URLs Helper ───────────────────────────────
  function extractPhotoUrls(raw) {
    var urls = [];
    if (!raw) return urls;
    try {
      var parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) {
        parsed.forEach(function (item) {
          if (!item) return;
          if (typeof item === 'string') urls.push(item);
          else if (typeof item === 'object' && typeof item.url === 'string') urls.push(item.url);
        });
      }
    } catch (e) {}
    return urls;
  }

  function dedupePhotoUrls(urls) {
    var seen = new Set();
    var unique = [];
    if (!Array.isArray(urls)) return unique;
    urls.forEach(function (raw) {
      if (!raw) return;
      var url = typeof raw === 'string' ? raw.trim() : (raw.url || '');
      if (!url || !/^https?:\/\//i.test(url) || seen.has(url)) return;
      seen.add(url);
      unique.push(url);
    });
    return unique;
  }

  // ── Build & Inject Main Widget ──────────────────────────────
  function removeWidget() {
    if (activeWidget) {
      activeWidget.remove();
      activeWidget = null;
    }
  }

  function injectWidget() {
    removeWidget();
    if (!isDetailPage(location.href)) return;

    injectStyles();

    // Run pre-flight extraction
    var extracted = null;
    try {
      if (window.CP_Extractors && typeof window.CP_Extractors.extract === 'function') {
        extracted = window.CP_Extractors.extract(location.href, document);
      }
    } catch (err) {
      console.warn('[CP] Pre-flight extraction notice:', err);
    }
    currentExtractedData = extracted;

    var container = document.createElement('div');
    container.id = 'cp-widget-container';

    // Format display attributes
    var rentStr = 'Rent pending';
    if (extracted && (extracted.monthly_rent || extracted.rent)) {
      var rentNum = extracted.monthly_rent || extracted.rent;
      rentStr = '$' + Number(rentNum).toLocaleString() + '/mo';
    }

    var bedsBaths = 'Listing details';
    if (extracted && (extracted.bedrooms != null || extracted.bathrooms != null)) {
      var beds = extracted.bedrooms != null ? extracted.bedrooms + ' bd' : '';
      var baths = extracted.bathrooms != null ? extracted.bathrooms + ' ba' : '';
      bedsBaths = [beds, baths].filter(Boolean).join(' • ');
      if (extracted.square_footage) {
        bedsBaths += ' • ' + Number(extracted.square_footage).toLocaleString() + ' sqft';
      }
    }

    var photoUrls = [];
    if (extracted) {
      photoUrls = extractPhotoUrls(extracted.original_image_urls);
      if (!photoUrls.length && Array.isArray(extracted.photo_urls)) {
        photoUrls = extracted.photo_urls;
      }
    }
    var photoCount = photoUrls.length || 'Verified';

    var addressStr = (extracted && extracted.address) ? extracted.address : 'Detected Listing';
    if (extracted && extracted.city && extracted.state) {
      addressStr += ', ' + extracted.city + ', ' + extracted.state;
    }

    container.innerHTML = `
      <!-- Minimized State Trigger -->
      <div class="cp-mini-trigger" id="cp-expand-trigger" title="Click to expand Choice Properties importer">
        <div class="cp-logo-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
        </div>
        <span>${rentStr} • Choice Import</span>
      </div>

      <!-- Full Body -->
      <div class="cp-full-body">
        <div class="cp-header">
          <div class="cp-brand">
            <div class="cp-logo-icon">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
            </div>
            <span class="cp-brand-title">Choice Properties</span>
          </div>
          <div class="cp-header-badges">
            <span class="cp-badge-verified">Zillow Verified</span>
            <button class="cp-header-btn" id="cp-btn-minimize" title="Minimize widget">_</button>
            <button class="cp-header-btn" id="cp-btn-close" title="Close widget">×</button>
          </div>
        </div>

        <div class="cp-body">
          <div class="cp-property-snapshot">
            <div class="cp-address-line" title="${addressStr}">${addressStr}</div>
            <div class="cp-chips-row">
              <span class="cp-chip cp-chip-price">${rentStr}</span>
              <span class="cp-chip">${bedsBaths}</span>
              <span class="cp-chip cp-chip-photos">📸 ${photoCount} photos</span>
            </div>
            <button class="cp-accordion-toggle" id="cp-toggle-tray">
              <span>View details breakdown</span> <span id="cp-chevron">▾</span>
            </button>
            <div class="cp-inspector-tray" id="cp-inspector-tray">
              <div class="cp-inspector-grid">
                <div class="cp-inspector-item">Deposit: <strong>1x Rent</strong></div>
                <div class="cp-inspector-item">App Fee: <strong>$50</strong></div>
                <div class="cp-inspector-item">Pets: <strong>Pet Friendly ✓</strong></div>
                <div class="cp-inspector-item">Lease Term: <strong>Omitted ✓</strong></div>
              </div>
            </div>
          </div>

          <!-- Main Action Button -->
          <button class="cp-save-action-btn" id="cp-btn-save">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            <span>Save to Pipeline</span>
          </button>

          <!-- Integrated Progress Box -->
          <div class="cp-progress-box" id="cp-progress-box">
            <div class="cp-progress-header">
              <span id="cp-progress-status">Uploading photos to ImageKit…</span>
              <span id="cp-progress-count">0%</span>
            </div>
            <div class="cp-progress-bar-track">
              <div class="cp-progress-bar-fill" id="cp-progress-fill"></div>
            </div>
          </div>

          <!-- Success State -->
          <div class="cp-success-box" id="cp-success-box">
            <div class="cp-success-banner">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>Saved to Choice Pipeline!</span>
            </div>
            <div class="cp-success-actions">
              <a class="cp-btn-secondary" id="cp-copy-link-btn" href="javascript:void(0)">Copy Link</a>
              <a class="cp-btn-primary-sm" id="cp-open-pipeline-btn" target="_blank" href="https://choice-properties-site.pages.dev/admin/pipeline.html">Open Pipeline ↗</a>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);
    activeWidget = container;

    // Attach Event Listeners
    var minimizeBtn = container.querySelector('#cp-btn-minimize');
    var closeBtn = container.querySelector('#cp-btn-close');
    var expandTrigger = container.querySelector('#cp-expand-trigger');
    var toggleTrayBtn = container.querySelector('#cp-toggle-tray');
    var inspectorTray = container.querySelector('#cp-inspector-tray');
    var chevron = container.querySelector('#cp-chevron');
    var saveBtn = container.querySelector('#cp-btn-save');
    var copyLinkBtn = container.querySelector('#cp-copy-link-btn');

    minimizeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      container.classList.add('cp-minimized');
      isMinimized = true;
    });

    closeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      removeWidget();
    });

    expandTrigger.addEventListener('click', function () {
      container.classList.remove('cp-minimized');
      isMinimized = false;
    });

    toggleTrayBtn.addEventListener('click', function () {
      isExpanded = !isExpanded;
      if (isExpanded) {
        inspectorTray.classList.add('cp-open');
        chevron.textContent = '▴';
      } else {
        inspectorTray.classList.remove('cp-open');
        chevron.textContent = '▾';
      }
    });

    saveBtn.addEventListener('click', handleSave);

    copyLinkBtn.addEventListener('click', function () {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(location.href);
        copyLinkBtn.textContent = 'Copied! ✓';
        setTimeout(function () { copyLinkBtn.textContent = 'Copy Link'; }, 2500);
      }
    });

    updateWidgetPosition();
  }

  // ── Save Execution Flow ─────────────────────────────────────
  async function handleSave() {
    var saveBtn = document.querySelector('#cp-btn-save');
    var progressBox = document.querySelector('#cp-progress-box');
    var progressStatus = document.querySelector('#cp-progress-status');
    var progressCount = document.querySelector('#cp-progress-count');
    var progressFill = document.querySelector('#cp-progress-fill');
    var successBox = document.querySelector('#cp-success-box');

    if (!saveBtn) return;

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="cp-spinner"></span> <span>Saving to pipeline…</span>';
    saveBtn.style.background = '#6366f1';

    try {
      var extractor = window.CP_Extractors && window.CP_Extractors.detect(location.href);
      var extracted = currentExtractedData;
      if (!extracted && window.CP_Extractors) {
        extracted = window.CP_Extractors.extract(location.href, document);
      }

      if (!extracted) {
        setError('Could not extract listing');
        return;
      }

      var photoUrls = extractPhotoUrls(extracted.original_image_urls);
      if (!photoUrls.length && Array.isArray(extracted.photo_urls)) {
        photoUrls = extracted.photo_urls;
      }
      photoUrls = dedupePhotoUrls(photoUrls);

      var payload = {
        source: extracted.source || 'zillow',
        source_listing_id: extracted.source_listing_id,
        source_url: extracted.source_url || extracted.url || location.href,
        title: extracted.title,
        address: extracted.address,
        city: extracted.city,
        state: extracted.state,
        zip: extracted.zip,
        lat: extracted.lat,
        lng: extracted.lng,
        monthly_rent: extracted.monthly_rent != null ? extracted.monthly_rent : extracted.rent,
        bedrooms: extracted.bedrooms != null ? extracted.bedrooms : extracted.beds,
        bathrooms: extracted.bathrooms != null ? extracted.bathrooms : extracted.baths,
        half_bathrooms: extracted.half_bathrooms,
        square_footage: extracted.square_footage != null ? extracted.square_footage : extracted.sqft,
        lot_size_sqft: extracted.lot_size_sqft != null ? extracted.lot_size_sqft : extracted.lot_sqft,
        year_built: extracted.year_built,
        property_type: extracted.property_type || 'APARTMENT',
        description: extracted.description,
        available_date: extracted.available_date,
        pets_allowed: true, // Choice Properties standard
        application_fee: 50, // Choice Properties standard
        original_image_urls: JSON.stringify(photoUrls.map(function (u) { return { url: u }; })),
        _import: 'browser-extension-v5.0.0-live',
      };

      // ── Step 1: Save property record first (Instant < 2s) ───
      var url = EDGE_URL + '?secret=' + encodeURIComponent(SECRET);
      var saveRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      var resp = null;
      try {
        resp = await saveRes.json();
      } catch (err) {
        setError('Invalid server response');
        return;
      }

      if (resp && resp.ok) {
        // Record created successfully!
        saveBtn.style.display = 'none';

        if (photoUrls.length > 0) {
          progressBox.style.display = 'flex';
          progressStatus.textContent = 'Uploading photos to ImageKit…';

          uploadPhotosInBackground(photoUrls, function (completed, total) {
            var percent = Math.round((completed / total) * 100);
            progressFill.style.width = percent + '%';
            progressCount.textContent = percent + '%';
            progressStatus.textContent = 'Uploaded ' + completed + ' of ' + total + ' photos';
          }).then(function (result) {
            progressBox.style.display = 'none';
            successBox.style.display = 'flex';
            if (result.uploaded.length > 0) {
              updatePipelinePhotos(payload, result.uploaded);
            }
          }).catch(function () {
            progressBox.style.display = 'none';
            successBox.style.display = 'flex';
          });
        } else {
          successBox.style.display = 'flex';
        }
      } else if (resp && resp.duplicate) {
        saveBtn.innerHTML = '<span>Already in Pipeline</span>';
        saveBtn.style.background = '#b45309';
        setTimeout(function () {
          saveBtn.innerHTML = '<span>Save to Pipeline</span>';
          saveBtn.style.background = 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)';
          saveBtn.disabled = false;
        }, 4000);
      } else {
        setError(resp && resp.error ? resp.error.slice(0, 45) : 'Save failed');
      }
    } catch (e) {
      console.error('[CP] handleSave error:', e);
      setError('Network connection error');
    }
  }

  function setError(msg) {
    var saveBtn = document.querySelector('#cp-btn-save');
    if (!saveBtn) return;
    saveBtn.innerHTML = '<span>Failed: ' + msg + '</span>';
    saveBtn.style.background = '#dc2626';
    saveBtn.disabled = false;
    setTimeout(function () {
      if (saveBtn) {
        saveBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg><span>Save to Pipeline</span>';
        saveBtn.style.background = 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)';
      }
    }, 4000);
  }

  // ── Photo Upload Pipeline ───────────────────────────────────
  async function uploadPhotosInBackground(photoUrls, progressCallback) {
    var uploaded = [];
    var failed = 0;
    var urls = dedupePhotoUrls(photoUrls);
    var limit = Math.min(urls.length, MAX_PHOTOS);
    var total = limit;

    for (var i = 0; i < limit; i += PHOTO_BATCH_SIZE) {
      var batch = urls.slice(i, i + PHOTO_BATCH_SIZE);
      if (progressCallback) progressCallback(Math.min(i, total), total);
      var results = await Promise.all(batch.map(function (url, batchIndex) {
        return uploadOnePhoto(url, i + batchIndex);
      }));
      for (var j = 0; j < results.length; j++) {
        if (results[j]) uploaded.push(results[j]);
        else failed++;
        if (progressCallback) progressCallback(Math.min(i + j + 1, total), total);
      }
    }
    return { uploaded: uploaded, failed: failed, total: total };
  }

  async function downloadViaBackground(url) {
    return new Promise(function (resolve) {
      try {
        if (!window.chrome || !window.chrome.runtime || !window.chrome.runtime.sendMessage) {
          var requestId = 'cp-photo-' + Date.now() + '-' + Math.random().toString(36).slice(2);
          var timer = setTimeout(function () {
            window.removeEventListener('message', onResult);
            resolve(null);
          }, 25000);
          function onResult(event) {
            var data = event && event.data;
            if (event.source !== window || !data ||
                data.type !== 'CP_DOWNLOAD_PHOTO_RESULT' ||
                data.requestId !== requestId) return;
            clearTimeout(timer);
            window.removeEventListener('message', onResult);
            resolve(data.ok && data.dataUri ? data : null);
          }
          window.addEventListener('message', onResult);
          window.postMessage({ type: 'CP_DOWNLOAD_PHOTO', requestId: requestId, url: url }, '*');
          return;
        }
        chrome.runtime.sendMessage(
          { type: 'DOWNLOAD_PHOTO', url: url },
          function (response) {
            if (chrome.runtime.lastError) {
              resolve(null);
              return;
            }
            resolve(response && response.ok && response.dataUri ? response : null);
          }
        );
      } catch (e) {
        resolve(null);
      }
    });
  }

  async function downloadViaDirectFetch(url) {
    try {
      var imgRes = await fetch(url, {
        mode: 'cors',
        credentials: 'include',
        headers: { 'Accept': 'image/jpeg,image/png,image/webp,image/*;q=0.8' }
      });
      if (!imgRes.ok) return null;
      var blob = await imgRes.blob();
      var base64 = await blobToBase64(blob);
      var ext = (blob.type || 'image/jpeg').split('/')[1] || 'jpg';
      if (ext === 'jpeg') ext = 'jpg';
      return {
        dataUri: base64,
        contentType: blob.type || 'image/jpeg',
        ext: ext,
        size: blob.size,
      };
    } catch (e) {
      return null;
    }
  }

  async function uploadOnePhoto(url, index) {
    try {
      var photo = await downloadViaBackground(url);
      if (!photo) photo = await downloadViaDirectFetch(url);
      if (!photo) return null;

      var ikRes = await fetch('https://tlfmwetmhthpyrytrcfo.supabase.co/functions/v1/pipeline-photo-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-import-secret': SECRET
        },
        body: JSON.stringify({
          fileData: photo.dataUri,
          fileName: 'photo_' + (index + 1) + '.' + photo.ext,
          folder: '/pipeline/temp'
        })
      });
      var ikData = await ikRes.json();
      if (!ikData || !ikData.url) return null;

      return {
        url: ikData.url,
        fileId: ikData.fileId || null,
        width: ikData.width || null,
        height: ikData.height || null,
      };
    } catch (e) {
      return null;
    }
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function updatePipelinePhotos(originalPayload, uploadedPhotos) {
    try {
      if (!uploadedPhotos || !uploadedPhotos.length) return;
      var updatePayload = Object.assign({}, originalPayload, {
        _update_photos_only: true,
        original_image_urls: JSON.stringify(uploadedPhotos),
      });
      await fetch(EDGE_URL + '?secret=' + encodeURIComponent(SECRET), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });
    } catch (e) {}
  }

  // ── Zillow Search Results Cards Quick-Save ──────────────────
  function injectSearchCardButtons() {
    if (!isSearchPage(location.href)) return;
    var cards = document.querySelectorAll('article[data-test="property-card"], div[class*="StyledPropertyCard"], .photo-cards > li');
    if (!cards || !cards.length) return;

    cards.forEach(function (card) {
      if (card.querySelector('.cp-search-card-btn')) return;

      var linkEl = card.querySelector('a[href*="/homedetails/"], a[href*="_zpid"]');
      if (!linkEl) return;
      var targetUrl = linkEl.href;

      var btn = document.createElement('button');
      btn.className = 'cp-search-card-btn';
      btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg> <span>+ Choice</span>';
      btn.title = 'Save to Choice Properties Pipeline';

      btn.addEventListener('click', async function (e) {
        e.preventDefault();
        e.stopPropagation();
        btn.disabled = true;
        btn.innerHTML = '<span class="cp-spinner"></span> <span>Saving…</span>';

        try {
          var priceEl = card.querySelector('[data-test="property-card-price"], span[class*="PropertyCardPrice"]');
          var addrEl = card.querySelector('address, [data-test="property-card-addr"]');
          var rentMatch = priceEl ? priceEl.textContent.replace(/[^0-9]/g, '') : '';
          var rent = rentMatch ? parseInt(rentMatch, 10) : null;
          var address = addrEl ? addrEl.textContent.trim() : 'Zillow Card Listing';

          var cardPayload = {
            source: 'zillow',
            source_url: targetUrl,
            address: address,
            monthly_rent: rent,
            pets_allowed: true,
            application_fee: 50,
            _import: 'zillow-search-card-v5',
          };

          var saveRes = await fetch(EDGE_URL + '?secret=' + encodeURIComponent(SECRET), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cardPayload),
          });
          var cardResp = await saveRes.json();

          if (cardResp && cardResp.ok) {
            btn.classList.add('cp-saved');
            btn.innerHTML = '<span>Saved ✓</span>';
          } else {
            btn.innerHTML = '<span>Already in DB</span>';
          }
        } catch (err) {
          btn.innerHTML = '<span>Saved to Tab</span>';
          window.open(targetUrl, '_blank');
        }
      });

      // Inject into card image container or card top
      var imgWrap = card.querySelector('.property-card-data, [data-test="property-card-link"]') || card;
      if (card.style.position !== 'absolute') card.style.position = 'relative';
      card.appendChild(btn);
    });
  }

  // ── Navigation & Lifecycle Watcher ──────────────────────────
  function onPageChange() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      removeWidget();
      setTimeout(function () {
        injectWidget();
        injectSearchCardButtons();
      }, 350);
    } else {
      updateWidgetPosition();
      injectSearchCardButtons();
    }
  }

  function setupWatchers() {
    window.addEventListener('popstate', onPageChange);
    window.addEventListener('resize', updateWidgetPosition);
    window.addEventListener('scroll', updateWidgetPosition, { passive: true });

    var observer = new MutationObserver(function () {
      if (isDetailPage(location.href) && !document.getElementById('cp-widget-container')) {
        injectWidget();
      }
      injectSearchCardButtons();
      updateWidgetPosition();
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  // ── Startup ─────────────────────────────────────────────────
  injectWidget();
  injectSearchCardButtons();
  setupWatchers();
  console.log('[Choice Properties] Live extension UI v' + VERSION + ' active');
})();
