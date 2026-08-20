// ============================================================
// Choice Properties — Orion & Chrome Live Content Script
// v5.2 — High-Performance Mobile Batch Mode & Touch Ergonomics
// Supports: Zillow (Web + Mobile), Realtor.com, Apartments.com, Redfin
// ============================================================
(function () {
  'use strict';

  // ── Message Bridge for Background Photo Downloader ───────────
  if (typeof window !== 'undefined' && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    window.addEventListener('message', function (event) {
      var data = event && event.data;
      if (event.source !== window || !data || data.type !== 'CP_DOWNLOAD_PHOTO') return;
      if (!data.requestId || typeof data.url !== 'string') return;
      if (!/^https:\/\/([a-z0-9-]+\.)?(zillowstatic\.com|rdcpix\.com|apartments\.com|redfin\.com)\//i.test(data.url)) return;
      try {
        chrome.runtime.sendMessage(
          { type: 'DOWNLOAD_PHOTO', url: data.url },
          function (response) {
            var runtimeError = chrome.runtime.lastError;
            window.postMessage({
              type: 'CP_DOWNLOAD_PHOTO_RESULT',
              requestId: data.requestId,
              ok: !runtimeError && !!(response && response.ok),
              dataUri: response && response.dataUri,
              contentType: response && response.contentType,
              ext: response && response.ext,
              size: response && response.size,
              error: runtimeError ? runtimeError.message : (response && response.error)
            }, '*');
          }
        );
      } catch (error) {
        window.postMessage({
          type: 'CP_DOWNLOAD_PHOTO_RESULT',
          requestId: data.requestId,
          ok: false,
          error: String(error && error.message || error)
        }, '*');
      }
    });
  }

  // ── Configuration ───────────────────────────────────────────
  var EDGE_URL = (window.CP_CONFIG && window.CP_CONFIG.EDGE_URL) || 'https://tlfmwetmhthpyrytrcfo.supabase.co/functions/v1/receive-pipeline-import';
  var SECRET   = (window.CP_CONFIG && window.CP_CONFIG.IMPORT_SECRET) || 'cp_import_7Kx3m9P2w5';
  var VERSION  = '5.2.0-mobile-batch';
  var STORAGE_KEY_ACTIVE_FOLDER = 'cp_active_folder';

  // ── State ───────────────────────────────────────────────────
  var lastUrl = location.href;
  var knownSavedUrls = new Set();
  var stabilizationInterval = null;
  var isThrottled = false;

  var state = {
    folders: [],
    activeFolder: null, // { id, name, count }
    folderProperties: [],
    loadingFolders: false,
    loadingProperties: false,
    popoverOpen: false,
    drawerOpen: false,
    isSaving: false,
    filterText: '',
    batchMode: false,
    selectedCards: new Map(), // url -> cardPayload
    isBatchSaving: false,
    newFolderColor: '#6366f1',
    newFolderIcon: '📁',
  };

  // Restore saved active folder from localStorage
  try {
    var savedFolder = localStorage.getItem(STORAGE_KEY_ACTIVE_FOLDER);
    if (savedFolder) {
      state.activeFolder = JSON.parse(savedFolder);
    }
  } catch (_) {}

  // ── URL & Page Classification ───────────────────────────────
  function isDetailPage(url) {
    var current = url || location.href;
    var isUrlMatch = /zillow\.com\/(homedetails|b|community|apartments)\//i.test(current) ||
                     /zillow\.com\/.*_zpid(\/|\?|$)/i.test(current) ||
                     /realtor\.com\/realestateandhomes-detail\//i.test(current) ||
                     /apartments\.com\/[^/]+\/[^/]+/i.test(current) ||
                     /redfin\.com\/[^/]+\/[^/]+\/[^/]+\/[^/]+/i.test(current);

    if (isUrlMatch) return true;

    // Check for open detail modal / drawer in Zillow/Realtor DOM
    if (typeof document !== 'undefined') {
      var modal = document.querySelector([
        '[data-test="detail-modal"]',
        '[data-testid="search-detail-panel"]',
        '#search-detail-root',
        '.layout-detail',
        '[data-testid="hdp-top-bar"]',
        '[data-testid="bdp-property-header"]',
        '[data-test-id="bdp-building-title"]',
        '#hdp-content',
        '[data-testid="home-details-chip-container"]'
      ].join(', '));
      if (modal && modal.offsetParent !== null) {
        return true;
      }
    }
    return false;
  }

  function isSearchPage(url) {
    var current = url || location.href;
    if (isDetailPage(current)) return false;
    return /zillow\.com/i.test(current) ||
           /realtor\.com/i.test(current) ||
           /apartments\.com/i.test(current) ||
           /redfin\.com/i.test(current);
  }

  function isSupportedPage(url) {
    var current = url || location.href;
    return /zillow\.com|realtor\.com|apartments\.com|redfin\.com/i.test(current);
  }

  function getApiUrl(action) {
    var base = EDGE_URL + '?secret=' + encodeURIComponent(SECRET);
    if (action) base += '&action=' + encodeURIComponent(action);
    return base;
  }

  // ── Haptic and Sound Synthesis ──────────────────────────────
  function triggerHaptic(type) {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        if (type === 'double') navigator.vibrate([20, 50, 25]);
        else if (type === 'heavy') navigator.vibrate(35);
        else navigator.vibrate(20);
      }
    } catch (_) {}
  }

  function playSuccessChime() {
    triggerHaptic('double');
    try {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      var ctx = new AudioCtx();
      var now = ctx.currentTime;
      
      var osc1 = ctx.createOscillator();
      var gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
      gain1.gain.setValueAtTime(0.09, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.26);
    } catch (_) {}
  }

  // ── Interactive Toast Feedback ──────────────────────────────
  function showToast(message, type, actionText, actionCallback) {
    var existing = document.getElementById('cp-global-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.id = 'cp-global-toast';
    toast.className = 'cp-toast ' + (type || 'info');

    var textSpan = document.createElement('span');
    textSpan.textContent = message;
    toast.appendChild(textSpan);

    if (actionText && actionCallback) {
      var actionBtn = document.createElement('button');
      actionBtn.className = 'cp-toast-action';
      actionBtn.textContent = actionText;
      actionBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        triggerHaptic();
        actionCallback();
        toast.remove();
      });
      toast.appendChild(actionBtn);
    }

    (document.body || document.documentElement).appendChild(toast);
    setTimeout(function() {
      if (toast && toast.parentNode) {
        toast.classList.add('cp-toast-hide');
        setTimeout(function() { if (toast.parentNode) toast.remove(); }, 300);
      }
    }, 3800);
  }

  // ── Backend Folder API ──────────────────────────────────────
  async function fetchFolders() {
    state.loadingFolders = true;
    updateWidgetUI();
    try {
      var res = await fetch(getApiUrl('list_folders'), {
        method: 'GET',
        headers: { 'x-import-secret': SECRET }
      });
      var data = await res.json();
      if (data && (data.ok || Array.isArray(data.folders))) {
        var list = data.folders || [];
        state.folders = list;
        if (state.activeFolder) {
          var matched = list.find(function (f) { return f.id === state.activeFolder.id || f.name === state.activeFolder.name; });
          if (matched) {
            state.activeFolder = { id: matched.id, name: matched.name, count: matched.property_count || matched.count || 0 };
          }
        }
      }
    } catch (e) {
      console.warn('[CP] fetchFolders failed:', e);
    } finally {
      state.loadingFolders = false;
      updateWidgetUI();
    }
  }

  async function createNewFolder(name, color, icon) {
    try {
      var res = await fetch(getApiUrl('create_folder'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-import-secret': SECRET
        },
        body: JSON.stringify({ name: name.trim(), color: color || '#6366f1', icon: icon || '📁' })
      });
      var data = await res.json();
      if (data && data.ok && data.folder) {
        var created = data.folder;
        state.folders.unshift(created);
        selectFolder({ id: created.id, name: created.name, count: 0 });
        showToast('Created folder "' + created.name + '"', 'success');
        return created;
      }
    } catch (e) {
      console.error('[CP] createFolder:', e);
      showToast('Failed to create folder', 'error');
    }
    return null;
  }

  async function fetchFolderProperties(folder) {
    state.loadingProperties = true;
    updateDrawerUI();
    try {
      var action = folder && folder.id ? ('folder_properties&folder_id=' + encodeURIComponent(folder.id)) : 'recent_properties';
      var res = await fetch(getApiUrl(action), {
        headers: { 'x-import-secret': SECRET }
      });
      var data = await res.json();
      if (data && (data.ok || Array.isArray(data.properties))) {
        state.folderProperties = data.properties || [];
      }
    } catch (e) {
      console.warn('[CP] fetchFolderProperties error:', e);
    } finally {
      state.loadingProperties = false;
      updateDrawerUI();
    }
  }

  async function removePropertyFromFolder(propertyId) {
    try {
      var res = await fetch(getApiUrl('remove_from_folder'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-import-secret': SECRET
        },
        body: JSON.stringify({ property_id: propertyId })
      });
      var data = await res.json();
      if (data && data.ok) {
        state.folderProperties = state.folderProperties.filter(function (p) { return p.id !== propertyId; });
        if (state.activeFolder && state.activeFolder.count > 0) {
          state.activeFolder.count--;
          persistActiveFolder();
        }
        updateDrawerUI();
        updateWidgetUI();
        showToast('Removed listing from folder', 'info');
      }
    } catch (e) {
      console.error('[CP] remove error:', e);
    }
  }

  function selectFolder(folder) {
    state.activeFolder = folder;
    persistActiveFolder();
    updateWidgetUI();
    closePopover();
    triggerHaptic();
    showToast('Active folder: ' + (folder ? folder.name : 'General Pipeline'), 'info');
  }

  function persistActiveFolder() {
    try {
      if (state.activeFolder) {
        localStorage.setItem(STORAGE_KEY_ACTIVE_FOLDER, JSON.stringify(state.activeFolder));
      } else {
        localStorage.removeItem(STORAGE_KEY_ACTIVE_FOLDER);
      }
    } catch (_) {}
  }

  // ── Helpers ──────────────────────────────────────────────────
  function dedupePhotoUrls(urls) {
    var seen = new Set();
    var out = [];
    (urls || []).forEach(function (u) {
      if (!u || typeof u !== 'string') return;
      var clean = u.trim();
      if (clean.startsWith('http') && !seen.has(clean)) {
        seen.add(clean);
        out.push(clean);
      }
    });
    return out;
  }

  function extractPhotoUrls(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return raw.map(function (item) {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') return item.url || item.href || item.src || '';
        return '';
      }).filter(Boolean);
    }
    if (typeof raw === 'string') {
      try {
        var parsed = JSON.parse(raw);
        return extractPhotoUrls(parsed);
      } catch (_) {
        if (raw.startsWith('http')) return [raw];
      }
    }
    return [];
  }

  function getZillowSearchMemoryCache() {
    var map = new Map();
    try {
      var nextData = null;
      if (window.__NEXT_DATA__) {
        nextData = window.__NEXT_DATA__;
      } else {
        var script = document.getElementById('__NEXT_DATA__');
        if (script && script.textContent) {
          nextData = JSON.parse(script.textContent);
        }
      }

      if (!nextData || !nextData.props || !nextData.props.pageProps) return map;
      var pageProps = nextData.props.pageProps;
      var searchState = pageProps.searchPageState || pageProps.initialData || {};
      var listResults = (searchState.cat1 && searchState.cat1.searchResults && searchState.cat1.searchResults.listResults) ||
                        (searchState.searchResults && searchState.searchResults.listResults) ||
                        (searchState.cat1 && searchState.cat1.searchResults && searchState.cat1.searchResults.mapResults) ||
                        [];

      listResults.forEach(function (item) {
        if (!item) return;
        var detailUrl = item.detailUrl || '';
        if (detailUrl && !detailUrl.startsWith('http')) {
          detailUrl = 'https://www.zillow.com' + detailUrl;
        }

        var photos = [];
        if (Array.isArray(item.carouselPhotos)) {
          item.carouselPhotos.forEach(function (p) {
            var url = typeof p === 'string' ? p : (p && (p.url || p.imgSrc));
            if (url) photos.push(url);
          });
        }
        if (item.imgSrc && !photos.includes(item.imgSrc)) {
          photos.unshift(item.imgSrc);
        }

        photos = photos.map(function(u) {
          return u.replace(/_[a-z0-9]+\.jpg$/i, '-uncropped_scaled_within_1536_1152.jpg');
        });

        var rent = item.unformattedPrice || parseInt(String(item.price || '').replace(/[^0-9]/g, ''), 10) || null;
        var addr = item.address || item.streetAddress || '';

        var record = {
          source: 'zillow',
          source_listing_id: String(item.zpid || item.id || ''),
          source_url: detailUrl,
          title: (item.beds ? item.beds + ' Bed ' : '') + (item.baths ? item.baths + ' Bath ' : '') + (addr || 'Property'),
          address: item.streetAddress || addr,
          city: item.addressCity || (item.address && item.address.city) || '',
          state: item.addressState || (item.address && item.address.state) || '',
          zip: item.addressZipcode || (item.address && item.address.zipcode) || '',
          lat: item.latLong ? item.latLong.latitude : null,
          lng: item.latLong ? item.latLong.longitude : null,
          monthly_rent: rent,
          bedrooms: item.beds != null ? item.beds : null,
          bathrooms: item.baths != null ? item.baths : null,
          square_footage: item.area != null ? item.area : null,
          property_type: item.hdpData && item.hdpData.homeInfo ? item.hdpData.homeInfo.homeType : 'APARTMENT',
          description: item.statusText || '',
          original_image_urls: JSON.stringify(dedupePhotoUrls(photos).slice(0, 50).map(function(u){ return { url: u }; })),
          _import: 'zillow-search-instant-cache'
        };

        if (detailUrl) map.set(detailUrl, record);
        if (item.zpid) map.set(String(item.zpid), record);
      });
    } catch (e) {
      console.warn('[CP] NextData cache parse:', e);
    }
    return map;
  }

  // ── Styles Injection ─────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('cp-extension-styles')) return;
    var style = document.createElement('style');
    style.id = 'cp-extension-styles';
    style.textContent = `
      :root {
        --cp-safe-bottom: max(16px, calc(env(safe-area-inset-bottom) + 12px));
        --cp-safe-right: max(12px, calc(env(safe-area-inset-right) + 10px));
      }

      /* Desktop & Mobile Floating Dock */
      #cp-floating-widget {
        position: fixed !important;
        bottom: var(--cp-safe-bottom) !important;
        right: var(--cp-safe-right) !important;
        z-index: 2147483645 !important;
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
        background: rgba(15, 23, 42, 0.96) !important;
        backdrop-filter: blur(20px) !important;
        -webkit-backdrop-filter: blur(20px) !important;
        padding: 6px 8px !important;
        border-radius: 32px !important;
        border: 1px solid rgba(255, 255, 255, 0.18) !important;
        box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.1) !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s !important;
        user-select: none !important;
        -webkit-user-select: none !important;
        pointer-events: auto !important;
      }
      #cp-floating-widget.cp-collapsed {
        transform: translateY(calc(100% + 20px)) !important;
        opacity: 0.2 !important;
      }

      .cp-btn-folder {
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #f1f5f9;
        padding: 8px 12px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.18s ease;
        max-width: 140px;
        min-height: 40px;
        box-sizing: border-box;
      }
      .cp-btn-folder:hover { background: rgba(255,255,255,0.15); }
      .cp-btn-folder:active { transform: scale(0.96); }
      .cp-btn-folder span#cp-folder-label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .cp-folder-badge {
        background: rgba(99, 102, 241, 0.25);
        color: #a5b4fc;
        font-size: 11px;
        font-weight: 700;
        padding: 1px 6px;
        border-radius: 10px;
      }
      
      .cp-btn-batch {
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #e2e8f0;
        padding: 9px 14px;
        border-radius: 24px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        min-height: 40px;
        box-sizing: border-box;
      }
      .cp-btn-batch.active {
        background: #2563eb !important;
        border-color: #60a5fa !important;
        color: #ffffff !important;
        box-shadow: 0 0 20px rgba(37, 99, 235, 0.8) !important;
        animation: cpBatchGlow 1.8s infinite;
      }
      @keyframes cpBatchGlow {
        0%, 100% { box-shadow: 0 0 14px rgba(37, 99, 235, 0.6); }
        50% { box-shadow: 0 0 24px rgba(96, 165, 250, 0.9); }
      }
      .cp-btn-batch:active { transform: scale(0.95); }

      .cp-btn-save {
        display: flex;
        align-items: center;
        gap: 6px;
        background: linear-gradient(135deg, #6366f1, #4f46e5);
        color: #ffffff;
        border: none;
        padding: 9px 18px;
        border-radius: 24px;
        font-size: 13.5px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 4px 14px rgba(99,102,241,0.45);
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        white-space: nowrap;
        min-height: 40px;
        box-sizing: border-box;
      }
      .cp-btn-save.batch-ready {
        background: linear-gradient(135deg, #10b981, #059669) !important;
        box-shadow: 0 4px 20px rgba(16, 185, 129, 0.7) !important;
        animation: cpPulse 1.6s infinite;
      }
      @keyframes cpPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
      .cp-btn-save:active { transform: scale(0.95); }
      .cp-btn-save:disabled { opacity: 0.9; cursor: not-allowed; }

      .cp-btn-drawer {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #e2e8f0;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .cp-btn-drawer:active {
        transform: scale(0.92);
        background: rgba(255, 255, 255, 0.22);
      }
      .cp-kbd-hint {
        font-size: 10px;
        opacity: 0.65;
        background: rgba(0,0,0,0.25);
        padding: 1px 4px;
        border-radius: 4px;
        margin-left: 2px;
      }

      /* In-Page Header / Action Bar Button on Single Property Page */
      .cp-inline-detail-btn {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 7px !important;
        background: linear-gradient(135deg, #4f46e5, #3b82f6) !important;
        color: #ffffff !important;
        border: 1px solid rgba(255, 255, 255, 0.3) !important;
        padding: 9px 18px !important;
        border-radius: 24px !important;
        font-size: 13.5px !important;
        font-weight: 700 !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        cursor: pointer !important;
        box-shadow: 0 4px 14px rgba(79, 70, 229, 0.45) !important;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        white-space: nowrap !important;
        min-height: 38px !important;
        box-sizing: border-box !important;
        z-index: 100 !important;
        margin: 4px 8px !important;
        pointer-events: auto !important;
        text-decoration: none !important;
        outline: none !important;
      }
      .cp-inline-detail-btn:hover {
        background: linear-gradient(135deg, #4338ca, #2563eb) !important;
        box-shadow: 0 6px 20px rgba(79, 70, 229, 0.6) !important;
        transform: translateY(-1px) !important;
      }
      .cp-inline-detail-btn:active {
        transform: scale(0.96) !important;
      }
      .cp-inline-detail-btn.saved {
        background: linear-gradient(135deg, #16a34a, #15803d) !important;
        box-shadow: 0 4px 14px rgba(22, 163, 74, 0.45) !important;
      }
      .cp-inline-detail-btn.in-pipeline {
        background: linear-gradient(135deg, #0284c7, #0369a1) !important;
      }
      .cp-inline-detail-btn.loading {
        opacity: 0.8 !important;
        cursor: wait !important;
      }

      /* Card Selection Checkboxes in Batch Mode (High-Priority Mobile Touch Targets) */
      .cp-card-select-badge {
        position: absolute !important;
        top: 8px !important;
        left: 8px !important;
        z-index: 2147483640 !important;
        width: 44px !important;
        height: 44px !important;
        border-radius: 50% !important;
        background: rgba(15, 23, 42, 0.92) !important;
        border: 2.5px solid #ffffff !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        color: #ffffff !important;
        font-weight: 800 !important;
        font-size: 18px !important;
        cursor: pointer !important;
        box-shadow: 0 4px 14px rgba(0,0,0,0.6) !important;
        transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1) !important;
        pointer-events: auto !important;
        touch-action: manipulation !important;
      }
      .cp-card-select-badge.selected {
        background: #10b981 !important;
        border-color: #ffffff !important;
        box-shadow: 0 0 16px rgba(16, 185, 129, 0.9) !important;
        transform: scale(1.1) !important;
      }
      .cp-card-highlight-selected {
        outline: 3.5px solid #10b981 !important;
        outline-offset: -3.5px !important;
      }
      .cp-card-batch-active {
        cursor: pointer !important;
      }

      /* In-Grid Quick Add Button on Property Cards */
      .cp-card-quick-add-btn {
        position: absolute !important;
        top: 8px !important;
        right: 8px !important;
        z-index: 2147483640 !important;
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
        background: rgba(15, 23, 42, 0.94) !important;
        backdrop-filter: blur(10px) !important;
        -webkit-backdrop-filter: blur(10px) !important;
        color: #ffffff !important;
        border: 1.5px solid rgba(255, 255, 255, 0.35) !important;
        padding: 8px 14px !important;
        border-radius: 24px !important;
        font-size: 12.5px !important;
        font-weight: 700 !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        cursor: pointer !important;
        box-shadow: 0 4px 14px rgba(0,0,0,0.5) !important;
        transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1) !important;
        pointer-events: auto !important;
        touch-action: manipulation !important;
        min-height: 38px !important;
        box-sizing: border-box !important;
      }
      .cp-card-quick-add-btn:active { transform: scale(0.94) !important; }
      .cp-card-quick-add-btn.saved {
        background: #16a34a !important;
        border-color: #22c55e !important;
      }
      .cp-card-quick-add-btn.loading {
        opacity: 0.7 !important;
        pointer-events: none !important;
      }

      /* Popover & Drawer Styles */
      #cp-folder-popover {
        position: fixed;
        bottom: calc(var(--cp-safe-bottom) + 54px);
        right: var(--cp-safe-right);
        width: 320px;
        background: #0f172a;
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 20px;
        box-shadow: 0 20px 45px rgba(0, 0, 0, 0.6);
        z-index: 2147483646;
        padding: 14px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #f8fafc;
        display: none;
        flex-direction: column;
        gap: 12px;
      }
      #cp-folder-popover.open { display: flex; animation: cpPopIn 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
      @keyframes cpPopIn {
        from { opacity: 0; transform: scale(0.95) translateY(10px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }

      .cp-folder-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 9px 12px;
        border-radius: 12px;
        cursor: pointer;
        transition: background 0.15s ease;
      }
      .cp-folder-item:hover { background: rgba(255,255,255,0.08); }
      .cp-folder-item.active { background: rgba(99,102,241,0.25); border: 1px solid rgba(99,102,241,0.4); }

      #cp-folder-drawer {
        position: fixed;
        top: 0;
        right: 0;
        width: 380px;
        height: 100vh;
        background: #090d16;
        border-left: 1px solid rgba(255,255,255,0.12);
        box-shadow: -10px 0 35px rgba(0,0,0,0.6);
        z-index: 2147483646;
        display: flex;
        flex-direction: column;
        transform: translateX(100%);
        transition: transform 0.26s cubic-bezier(0.16, 1, 0.3, 1);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #f8fafc;
      }
      #cp-folder-drawer.open { transform: translateX(0); }
      .cp-drawer-header {
        padding: 16px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .cp-drawer-list {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .cp-drawer-item {
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
        padding: 10px;
        display: flex;
        gap: 10px;
        position: relative;
      }
      .cp-drawer-thumb {
        width: 60px;
        height: 60px;
        border-radius: 8px;
        object-fit: cover;
        background: #1e293b;
        flex-shrink: 0;
      }
      .cp-drawer-btn-danger {
        background: rgba(239,68,68,0.15);
        border: 1px solid rgba(239,68,68,0.3);
        color: #fca5a5;
        border-radius: 8px;
        padding: 4px 8px;
        font-size: 11px;
        cursor: pointer;
      }

      /* Global Toast */
      .cp-toast {
        position: fixed;
        bottom: max(84px, calc(env(safe-area-inset-bottom) + 72px));
        left: 50%;
        transform: translateX(-50%);
        background: #0f172a;
        border: 1px solid rgba(255,255,255,0.2);
        color: #fff;
        padding: 10px 20px;
        border-radius: 30px;
        font-size: 13px;
        font-weight: 600;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        box-shadow: 0 16px 36px rgba(0,0,0,0.65);
        z-index: 2147483647;
        display: flex;
        align-items: center;
        gap: 12px;
        animation: cpToastIn 0.22s ease-out;
        transition: opacity 0.25s, transform 0.25s;
        max-width: 90vw;
        box-sizing: border-box;
      }
      @keyframes cpToastIn {
        from { opacity: 0; transform: translate(-50%, 14px); }
        to { opacity: 1; transform: translate(-50%, 0); }
      }
      .cp-toast.success { border-color: rgba(34, 197, 94, 0.5); }
      .cp-toast.error { border-color: rgba(239, 68, 68, 0.5); }
      .cp-toast-action {
        background: #6366f1;
        border: none;
        color: #fff;
        font-size: 11.5px;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 12px;
        cursor: pointer;
        white-space: nowrap;
      }
      .cp-toast-hide { opacity: 0; transform: translate(-50%, 12px); }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  // ── In-Page Header Button Injection (Single Property Page) ────
  function injectDetailHeaderButton() {
    var isDetail = isDetailPage(location.href);
    if (!isDetail) {
      var existingBtn = document.getElementById('cp-inline-detail-import-btn');
      if (existingBtn) existingBtn.remove();
      return;
    }

    if (document.getElementById('cp-inline-detail-import-btn')) return;

    var headerSelectors = [
      '[data-testid="hdp-action-bar-container"]',
      '[data-testid="hdp-view-controls"]',
      '[data-testid="hdp-action-bar"]',
      '[data-testid="home-details-chip-container"]',
      '[data-testid="bdp-property-header"]',
      '[data-testid="summary-container"]',
      '.summary-container [class*="ActionBar"]',
      '.summary-container',
      'header[class*="StyledHeader"]',
      '[data-test="detail-modal"] header',
      '#search-detail-root header',
      '.layout-detail .summary-container',
      '[data-testid="property-overview-summary"]',
      '[data-testid="save-btn-container"]',
      '[data-testid="property-meta-container"]',
      '.property-meta',
      '#propertyHeader .actionButtons',
      '#propertyHeader',
      '.propertyHeader',
      '[data-rf-test-name="abp-actions"]',
      '.action-panel',
      '.inline-stats-container'
    ];

    var container = null;
    for (var i = 0; i < headerSelectors.length; i++) {
      var el = document.querySelector(headerSelectors[i]);
      if (el && el.offsetParent !== null) {
        container = el;
        break;
      }
    }
    if (!container) {
      var h1 = document.querySelector('h1');
      if (h1 && h1.parentElement) {
        container = h1.parentElement;
      }
    }

    if (!container) return;

    var isSaved = knownSavedUrls.has(location.href);
    var btn = document.createElement('button');
    btn.id = 'cp-inline-detail-import-btn';
    btn.className = 'cp-inline-detail-btn' + (isSaved ? ' saved' : '');
    btn.innerHTML = isSaved ? '<span>✓ In Pipeline</span>' : '<span>📥 Import to Choice</span>';
    btn.title = 'Save to Choice Properties Pipeline (' + (state.activeFolder ? state.activeFolder.name : 'General') + ')';

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      triggerHaptic();
      handleInstantSave(btn);
    });

    if (container.tagName === 'HEADER' || container.getAttribute('data-testid') === 'hdp-action-bar-container') {
      container.prepend(btn);
    } else {
      container.appendChild(btn);
    }
  }

  // ── Floating Dock Widget Injection ───────────────────────────
  function injectWidget() {
    if (!isSupportedPage(location.href)) {
      var existing = document.getElementById('cp-floating-widget');
      if (existing) existing.remove();
      return;
    }

    injectStyles();

    var isDetail = isDetailPage(location.href);
    var isSearch = isSearchPage(location.href);
    var selectedCount = state.selectedCards.size;

    var saveBtnText = isDetail
      ? (state.activeFolder ? ('Save #' + ((state.activeFolder.count || 0) + 1)) : 'Save Listing')
      : (selectedCount > 0 ? ('Save (' + selectedCount + ') ⚡') : (state.batchMode ? 'Select Cards' : 'Choice Importer'));

    var widget = document.getElementById('cp-floating-widget');
    if (!widget) {
      widget = document.createElement('div');
      widget.id = 'cp-floating-widget';
      (document.body || document.documentElement).appendChild(widget);
    }

    widget.innerHTML = `
      <button class="cp-btn-folder" id="cp-folder-toggle-btn" title="Select target folder">
        <span>📁</span>
        <span id="cp-folder-label">${state.activeFolder ? state.activeFolder.name : 'Pipeline'}</span>
        <span class="cp-folder-badge" id="cp-folder-count-badge">${state.activeFolder ? (state.activeFolder.count || 0) : 0}</span>
        <span style="font-size: 10px; opacity: 0.6">▼</span>
      </button>

      ${isSearch ? `
        <button class="cp-btn-batch ${state.batchMode ? 'active' : ''}" id="cp-batch-toggle-btn" title="Toggle Batch Multi-Select Mode">
          <span>⚡ Batch</span>
          <span id="cp-batch-count-badge" style="background: rgba(0,0,0,0.3); padding: 1px 6px; border-radius: 8px; font-size: 11px;">${selectedCount}</span>
        </button>
      ` : ''}

      <button class="cp-btn-save ${selectedCount > 0 ? 'batch-ready' : ''}" id="cp-save-btn" title="${isDetail ? 'Save Listing' : 'Save selected properties'}">
        <span>💾</span>
        <span id="cp-save-text">${saveBtnText}</span>
        ${isDetail ? '<span class="cp-kbd-hint">Alt+S</span>' : ''}
      </button>

      <button class="cp-btn-drawer" id="cp-drawer-toggle-btn" title="View folder properties">
        <span style="font-size: 15px">☰</span>
      </button>
    `;

    // Rebind event listeners
    var folderBtn = document.getElementById('cp-folder-toggle-btn');
    if (folderBtn) {
      folderBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        e.preventDefault();
        triggerHaptic();
        togglePopover();
      });
    }

    if (isSearch) {
      var batchBtn = document.getElementById('cp-batch-toggle-btn');
      if (batchBtn) {
        batchBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          e.preventDefault();
          triggerHaptic('heavy');
          toggleBatchMode();
        });
      }
    }

    var saveBtn = document.getElementById('cp-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        e.preventDefault();
        triggerHaptic();
        if (isDetailPage(location.href)) {
          handleInstantSave();
        } else if (state.selectedCards.size > 0) {
          handleBatchSave();
        } else if (state.batchMode) {
          showToast('Tap any property card to select it first', 'info');
        } else {
          toggleDrawer();
        }
      });
    }

    var drawerBtn = document.getElementById('cp-drawer-toggle-btn');
    if (drawerBtn) {
      drawerBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        e.preventDefault();
        triggerHaptic();
        toggleDrawer();
      });
    }

    fetchFolders();
  }

  function updateWidgetUI() {
    var label = document.getElementById('cp-folder-label');
    var badge = document.getElementById('cp-folder-count-badge');
    var saveText = document.getElementById('cp-save-text');
    var saveBtn = document.getElementById('cp-save-btn');
    var batchBadge = document.getElementById('cp-batch-count-badge');
    var batchBtn = document.getElementById('cp-batch-toggle-btn');
    var isDetail = isDetailPage(location.href);

    if (label) {
      label.textContent = state.activeFolder ? state.activeFolder.name : 'Pipeline';
    }
    if (badge) {
      var count = state.activeFolder ? (state.activeFolder.count || 0) : 0;
      badge.textContent = count;
      badge.style.display = state.activeFolder ? 'inline-block' : 'none';
    }
    if (batchBadge) {
      batchBadge.textContent = state.selectedCards.size;
    }
    if (batchBtn) {
      if (state.batchMode) batchBtn.classList.add('active');
      else batchBtn.classList.remove('active');
    }

    if (saveText && !state.isSaving && !state.isBatchSaving) {
      if (isDetail) {
        saveText.textContent = state.activeFolder ? ('Save #' + ((state.activeFolder.count || 0) + 1)) : 'Save Listing';
        if (saveBtn) saveBtn.classList.remove('batch-ready');
      } else if (state.selectedCards.size > 0) {
        saveText.textContent = 'Save (' + state.selectedCards.size + ') ⚡';
        if (saveBtn) saveBtn.classList.add('batch-ready');
      } else {
        saveText.textContent = state.batchMode ? 'Select Cards' : 'Choice Importer';
        if (saveBtn) saveBtn.classList.remove('batch-ready');
      }
    }
  }

  // ── Popover Management (Folder Switcher) ──────────────────────
  function closePopover() {
    var pop = document.getElementById('cp-folder-popover');
    if (pop) pop.classList.remove('open');
    state.popoverOpen = false;
  }

  function togglePopover() {
    if (state.popoverOpen) {
      closePopover();
      return;
    }
    state.popoverOpen = true;

    var pop = document.getElementById('cp-folder-popover');
    if (!pop) {
      pop = document.createElement('div');
      pop.id = 'cp-folder-popover';
      (document.body || document.documentElement).appendChild(pop);
    }

    pop.classList.add('open');
    pop.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:8px;">
        <span style="font-weight:700; font-size:14px; color:#fff;">Target Folder</span>
        <button id="cp-pop-close-btn" style="background:none; border:none; color:#94a3b8; font-size:18px; cursor:pointer;">✕</button>
      </div>

      <div style="display:flex; gap:6px;">
        <input type="text" id="cp-new-folder-input" placeholder="New folder name…" style="flex:1; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.15); border-radius:10px; padding:7px 10px; color:#fff; font-size:12.5px; outline:none;" />
        <button id="cp-create-folder-btn" class="cp-btn-save" style="padding: 6px 14px; font-size: 12.5px; border-radius: 10px;">
          + Create
        </button>
      </div>

      <div id="cp-pop-folder-list" style="max-height: 240px; overflow-y: auto; display:flex; flex-direction:column; gap:4px;">
        <div style="text-align:center; padding:15px; color:#94a3b8; font-size:12px;">Loading folders…</div>
      </div>
    `;

    pop.querySelector('#cp-pop-close-btn').addEventListener('click', closePopover);

    var createBtn = pop.querySelector('#cp-create-folder-btn');
    var newFolderInput = pop.querySelector('#cp-new-folder-input');

    createBtn.addEventListener('click', async function () {
      var name = newFolderInput.value;
      if (!name || !name.trim()) return;
      createBtn.textContent = '…';
      createBtn.disabled = true;
      await createNewFolder(name, state.newFolderColor, state.newFolderIcon);
    });

    newFolderInput.addEventListener('keydown', async function (e) {
      if (e.key === 'Enter') {
        var name = newFolderInput.value;
        if (!name || !name.trim()) return;
        createBtn.textContent = '…';
        createBtn.disabled = true;
        await createNewFolder(name, state.newFolderColor, state.newFolderIcon);
      }
    });

    renderFolderItems(pop);
  }

  function renderFolderItems(pop) {
    var listContainer = pop.querySelector('#cp-pop-folder-list');
    if (!listContainer) return;

    var filtered = state.folders.filter(function (f) {
      return !state.filterText || (f.name && f.name.toLowerCase().includes(state.filterText));
    });

    var html = `
      <div class="cp-folder-item ${!state.activeFolder ? 'active' : ''}" data-folder-id="__none">
        <div style="display:flex; align-items:center; gap:8px;">
          <span>📦</span>
          <span style="font-weight:600; font-size:13px;">General (No Folder)</span>
        </div>
      </div>
    `;

    filtered.forEach(function (f) {
      var isActive = state.activeFolder && (state.activeFolder.id === f.id || state.activeFolder.name === f.name);
      var count = f.property_count != null ? f.property_count : (f.count || 0);
      var icon = f.icon || '📁';
      html += `
        <div class="cp-folder-item ${isActive ? 'active' : ''}" data-folder-id="${f.id || ''}" data-folder-name="${f.name}">
          <div style="display:flex; align-items:center; gap:8px;">
            <span>${icon}</span>
            <span style="font-weight:600; font-size:13px;">${f.name}</span>
          </div>
          <span class="cp-folder-badge">${count}</span>
        </div>
      `;
    });

    listContainer.innerHTML = html;

    listContainer.querySelectorAll('.cp-folder-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var id = item.getAttribute('data-folder-id');
        var name = item.getAttribute('data-folder-name');
        if (id === '__none') {
          selectFolder(null);
        } else {
          var matched = state.folders.find(function (f) { return f.id === id || f.name === name; });
          selectFolder(matched || { id: id, name: name });
        }
      });
    });
  }

  // ── Drawer Management (View Folder Properties) ──────────────
  function closeDrawer() {
    var drawer = document.getElementById('cp-folder-drawer');
    var backdrop = document.getElementById('cp-modal-backdrop');
    if (drawer) drawer.classList.remove('open');
    if (backdrop) backdrop.remove();
    state.drawerOpen = false;
  }

  function toggleDrawer() {
    if (state.drawerOpen) {
      closeDrawer();
      return;
    }
    state.drawerOpen = true;

    var backdrop = document.createElement('div');
    backdrop.id = 'cp-modal-backdrop';
    backdrop.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:2147483645;';
    backdrop.addEventListener('click', closeDrawer);
    (document.body || document.documentElement).appendChild(backdrop);

    var drawer = document.getElementById('cp-folder-drawer');
    if (!drawer) {
      drawer = document.createElement('div');
      drawer.id = 'cp-folder-drawer';
      (document.body || document.documentElement).appendChild(drawer);
    }

    setTimeout(function() { drawer.classList.add('open'); }, 10);
    fetchFolderProperties(state.activeFolder);
  }

  function updateDrawerUI() {
    var drawer = document.getElementById('cp-folder-drawer');
    if (!drawer) return;

    var folderName = state.activeFolder ? state.activeFolder.name : 'General Pipeline';
    var items = state.folderProperties || [];

    var itemsHtml = '';
    if (state.loadingProperties) {
      itemsHtml = '<div style="text-align:center; padding:30px; color:#94a3b8;">Loading properties…</div>';
    } else if (!items.length) {
      itemsHtml = '<div style="text-align:center; padding:40px 20px; color:#64748b; font-size:13px;">No properties in this folder yet.<br><br>Tap <b>💾 Save</b> on any listing to save it here!</div>';
    } else {
      itemsHtml = items.map(function (p) {
        var photos = extractPhotoUrls(p.original_image_urls || p.photo_urls);
        var thumb = photos[0] || '';
        var price = p.monthly_rent ? ('$' + Number(p.monthly_rent).toLocaleString() + '/mo') : (p.price ? ('$' + Number(p.price).toLocaleString()) : '');
        var details = [
          p.bedrooms != null ? (p.bedrooms + ' bd') : '',
          p.bathrooms != null ? (p.bathrooms + ' ba') : '',
          p.square_footage ? (Number(p.square_footage).toLocaleString() + ' sqft') : ''
        ].filter(Boolean).join(' · ');

        return `
          <div class="cp-drawer-item">
            ${thumb ? `<img src="${thumb}" class="cp-drawer-thumb" alt="photo" />` : '<div class="cp-drawer-thumb"></div>'}
            <div style="flex:1; min-width:0;">
              <div style="font-weight:700; font-size:13.5px; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${p.address || p.title || 'Untitled Property'}
              </div>
              <div style="font-size:12px; color:#94a3b8; margin-top:2px;">
                ${[p.city, p.state].filter(Boolean).join(', ')}
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px;">
                <span style="font-size:12.5px; font-weight:700; color:#38bdf8;">${price}</span>
                <span style="font-size:11px; color:#64748b;">${details}</span>
              </div>
            </div>
            <button class="cp-drawer-btn-danger" data-remove-id="${p.id}" title="Remove from folder">✕</button>
          </div>
        `;
      }).join('');
    }

    drawer.innerHTML = `
      <div class="cp-drawer-header">
        <div>
          <div style="font-size:16px; font-weight:700; color:#fff;">${folderName}</div>
          <div style="font-size:12px; color:#94a3b8;">${items.length} saved properties</div>
        </div>
        <button id="cp-drawer-close-btn" style="background:none; border:none; color:#94a3b8; font-size:20px; cursor:pointer;">✕</button>
      </div>
      <div class="cp-drawer-list">
        ${itemsHtml}
      </div>
      <div style="padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.08); background: #06090f;">
        <a href="https://choice-properties-site.pages.dev/admin/pipeline.html" target="_blank" class="cp-btn-save" style="width: 100%; justify-content: center; text-decoration: none; box-sizing: border-box;">
          Open Admin Pipeline ↗
        </a>
      </div>
    `;

    var closeBtn = drawer.querySelector('#cp-drawer-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);

    drawer.querySelectorAll('[data-remove-id]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        triggerHaptic();
        var id = btn.getAttribute('data-remove-id');
        btn.textContent = '…';
        btn.disabled = true;
        await removePropertyFromFolder(id);
      });
    });
  }

  // ── High-Speed Instant Ingestion Handler (Detail Page) ───────
  async function handleInstantSave(customTriggerBtn) {
    var saveBtn = document.getElementById('cp-save-btn');
    var saveText = document.getElementById('cp-save-text');
    var inlineBtn = customTriggerBtn || document.getElementById('cp-inline-detail-import-btn');

    if (state.isSaving) return;

    state.isSaving = true;
    if (saveBtn) { saveBtn.disabled = true; }
    if (saveText) { saveText.textContent = 'Saving…'; }
    if (inlineBtn) {
      inlineBtn.classList.add('loading');
      inlineBtn.innerHTML = '<span>⏳ Saving…</span>';
    }

    try {
      var extracted = window.CP_Extractors ? window.CP_Extractors.extract(location.href, document) : null;
      if (!extracted || !extracted.address) {
        await new Promise(function(r) { setTimeout(r, 250); });
        extracted = window.CP_Extractors ? window.CP_Extractors.extract(location.href, document) : null;
      }

      if (!extracted) {
        setError('Could not read listing');
        if (inlineBtn) {
          inlineBtn.classList.remove('loading');
          inlineBtn.innerHTML = '<span>⚠️ Retry Import</span>';
        }
        return;
      }

      var photoUrls = extractPhotoUrls(extracted.original_image_urls);
      if (!photoUrls.length && Array.isArray(extracted.photo_urls)) {
        extracted.photo_urls.forEach(function (u) { if (typeof u === 'string') photoUrls.push(u); });
      }
      var finalPhotoUrls = dedupePhotoUrls(photoUrls).slice(0, 50).map(function(u) { return { url: u }; });

      var payload = {
        source: extracted.source || 'web',
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
        property_type: extracted.property_type,
        description: extracted.description,
        available_date: extracted.available_date,
        pets_allowed: extracted.pets_allowed,
        original_image_urls: JSON.stringify(finalPhotoUrls),
        folder_id: state.activeFolder ? state.activeFolder.id : null,
        folder_name: state.activeFolder ? state.activeFolder.name : null,
        _import: 'orion-v5.2.0-resilient',
      };

      var res = await fetch(getApiUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-import-secret': SECRET
        },
        body: JSON.stringify(payload),
      });

      var resp = await res.json();

      if (resp && resp.ok) {
        playSuccessChime();
        knownSavedUrls.add(location.href);
        if (extracted.source_url) knownSavedUrls.add(extracted.source_url);

        var serialMsg = resp.folder && resp.folder.serial ? (' #' + resp.folder.serial) : '';
        if (saveText) saveText.textContent = 'Saved' + serialMsg + ' ✓';
        if (saveBtn) saveBtn.style.background = 'linear-gradient(135deg, #16a34a, #15803d)';

        if (inlineBtn) {
          inlineBtn.classList.remove('loading');
          inlineBtn.classList.add('saved');
          inlineBtn.innerHTML = '<span>✓ In Pipeline' + serialMsg + '</span>';
        }

        showToast('Saved ' + (extracted.address || 'Property') + serialMsg, 'success', 'View Pipeline', function() {
          window.open('https://choice-properties-site.pages.dev/admin/pipeline.html', '_blank');
        });

        if (state.activeFolder) {
          state.activeFolder.count = (state.activeFolder.count || 0) + 1;
          persistActiveFolder();
        }
        fetchFolders();

        setTimeout(function () {
          if (saveBtn) saveBtn.style.background = 'linear-gradient(135deg, #6366f1, #4f46e5)';
          state.isSaving = false;
          if (saveBtn) saveBtn.disabled = false;
          updateWidgetUI();
        }, 2200);
      } else if (resp && resp.duplicate) {
        var dupSerial = resp.folder && resp.folder.serial ? (' #' + resp.folder.serial) : '';
        knownSavedUrls.add(location.href);
        if (extracted.source_url) knownSavedUrls.add(extracted.source_url);

        if (saveText) saveText.textContent = 'In Pipeline' + dupSerial + ' ✓';
        if (saveBtn) saveBtn.style.background = 'linear-gradient(135deg, #0284c7, #0369a1)';

        if (inlineBtn) {
          inlineBtn.classList.remove('loading');
          inlineBtn.classList.add('in-pipeline');
          inlineBtn.innerHTML = '<span>✓ In Pipeline' + dupSerial + '</span>';
        }

        showToast('Already in Pipeline' + dupSerial, 'info');
        setTimeout(function () {
          if (saveBtn) saveBtn.style.background = 'linear-gradient(135deg, #6366f1, #4f46e5)';
          state.isSaving = false;
          if (saveBtn) saveBtn.disabled = false;
          updateWidgetUI();
        }, 2200);
      } else {
        setError(resp && resp.error ? resp.error.slice(0, 30) : 'Server error');
        if (inlineBtn) {
          inlineBtn.classList.remove('loading');
          inlineBtn.innerHTML = '<span>⚠️ Error</span>';
        }
      }
    } catch (e) {
      console.error('[CP]', e);
      setError('Network error');
      if (inlineBtn) {
        inlineBtn.classList.remove('loading');
        inlineBtn.innerHTML = '<span>⚠️ Network Error</span>';
      }
    }
  }

  // ── High-Speed Batch Ingestion (Search Grid Multi-Select) ─────
  function toggleBatchMode() {
    state.batchMode = !state.batchMode;
    if (!state.batchMode) {
      state.selectedCards.clear();
    }
    updateWidgetUI();
    injectSearchCardButtons();
    
    if (state.batchMode) {
      showToast('⚡ Batch Mode ON — Tap any property card to select', 'info');
    } else {
      showToast('Batch Mode OFF', 'info');
    }
  }

  async function handleBatchSave() {
    var saveBtn = document.getElementById('cp-save-btn');
    var saveText = document.getElementById('cp-save-text');
    if (!saveBtn || state.isBatchSaving || state.selectedCards.size === 0) return;

    state.isBatchSaving = true;
    saveBtn.disabled = true;

    var selected = Array.from(state.selectedCards.values());
    var total = selected.length;
    saveText.textContent = 'Saving 0/' + total + '…';

    var savedCount = 0;
    var errorCount = 0;

    for (var i = 0; i < selected.length; i++) {
      var item = selected[i];
      saveText.textContent = 'Saving ' + (i + 1) + '/' + total + '…';
      try {
        var payload = Object.assign({}, item, {
          folder_id: state.activeFolder ? state.activeFolder.id : null,
          folder_name: state.activeFolder ? state.activeFolder.name : null,
          _import: 'batch-v5.2.0-multi'
        });

        var res = await fetch(getApiUrl(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-import-secret': SECRET
          },
          body: JSON.stringify(payload)
        });
        var resp = await res.json();
        if (resp && (resp.ok || resp.duplicate)) {
          savedCount++;
          knownSavedUrls.add(item.source_url);
        } else {
          errorCount++;
        }
      } catch (err) {
        errorCount++;
      }
    }

    playSuccessChime();
    state.selectedCards.clear();
    state.isBatchSaving = false;
    saveBtn.disabled = false;

    if (state.activeFolder && savedCount > 0) {
      state.activeFolder.count = (state.activeFolder.count || 0) + savedCount;
      persistActiveFolder();
    }
    fetchFolders();

    saveText.textContent = 'Saved (' + savedCount + ') ✓';
    saveBtn.style.background = 'linear-gradient(135deg, #16a34a, #15803d)';

    showToast('Batch saved ' + savedCount + ' properties to ' + (state.activeFolder ? state.activeFolder.name : 'Pipeline'), 'success');

    injectSearchCardButtons();
    setTimeout(function() {
      saveBtn.style.background = 'linear-gradient(135deg, #6366f1, #4f46e5)';
      updateWidgetUI();
    }, 2500);
  }

  function setError(msg) {
    var saveBtn = document.getElementById('cp-save-btn');
    var saveText = document.getElementById('cp-save-text');
    if (!saveBtn || !saveText) return;
    saveText.textContent = msg;
    saveBtn.style.background = '#dc2626';
    setTimeout(function () {
      if (saveBtn) {
        saveBtn.style.background = 'linear-gradient(135deg, #6366f1, #4f46e5)';
        saveBtn.disabled = false;
        state.isSaving = false;
        state.isBatchSaving = false;
        updateWidgetUI();
      }
    }, 3000);
  }

  // ── Search Grid Quick-Add & Multi-Select Badges ──────────────
  async function fetchFullDetailAndIngest(listingUrl, cardBtn) {
    if (!listingUrl || cardBtn.classList.contains('loading') || cardBtn.classList.contains('saved')) return;

    cardBtn.classList.add('loading');
    cardBtn.innerHTML = '⏳ <span>Importing…</span>';

    var memoryCache = getZillowSearchMemoryCache();
    var cached = memoryCache.get(listingUrl);

    if (cached) {
      await savePayloadDirect(cached, cardBtn, listingUrl);
      return;
    }

    try {
      var htmlRes = await fetch(listingUrl, {
        headers: { 'Accept': 'text/html,application/xhtml+xml' },
        credentials: 'same-origin'
      });
      var html = await htmlRes.text();
      var parser = new DOMParser();
      var doc = parser.parseFromString(html, 'text/html');

      var extracted = window.CP_Extractors ? window.CP_Extractors.extract(listingUrl, doc) : null;
      if (extracted && extracted.address) {
        await savePayloadDirect(extracted, cardBtn, listingUrl);
      } else {
        cardBtn.classList.remove('loading');
        cardBtn.innerHTML = '⚠️ Retry';
      }
    } catch (e) {
      cardBtn.classList.remove('loading');
      cardBtn.innerHTML = '⚠️ Error';
    }
  }

  async function savePayloadDirect(extracted, cardBtn, listingUrl) {
    try {
      var photoUrls = extractPhotoUrls(extracted.original_image_urls);
      var payload = Object.assign({}, extracted, {
        folder_id: state.activeFolder ? state.activeFolder.id : null,
        folder_name: state.activeFolder ? state.activeFolder.name : null,
        original_image_urls: JSON.stringify(dedupePhotoUrls(photoUrls).slice(0, 50).map(function(u){ return { url: u }; })),
        _import: 'card-quick-add'
      });

      var res = await fetch(getApiUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-import-secret': SECRET
        },
        body: JSON.stringify(payload)
      });
      var resp = await res.json();

      if (resp && (resp.ok || resp.duplicate)) {
        playSuccessChime();
        knownSavedUrls.add(listingUrl);
        cardBtn.classList.remove('loading');
        cardBtn.classList.add('saved');
        var serial = resp.folder && resp.folder.serial ? (' #' + resp.folder.serial) : '';
        cardBtn.innerHTML = '✓ Saved' + serial;

        if (state.activeFolder && resp.ok) {
          state.activeFolder.count = (state.activeFolder.count || 0) + 1;
          persistActiveFolder();
        }
        fetchFolders();

        showToast('Saved ' + (extracted.address || 'Property') + serial, 'success');
      } else {
        cardBtn.classList.remove('loading');
        cardBtn.innerHTML = '⚠️ Error';
      }
    } catch (e) {
      cardBtn.classList.remove('loading');
      cardBtn.innerHTML = '⚠️ Error';
    }
  }

  // ── Universal Card Identification Engine (Desktop & Mobile) ──
  function findAllListingCards() {
    var foundMap = new Map(); // href -> { cardEl, href, payload }
    var memoryMap = getZillowSearchMemoryCache();

    // 1. Scan all property links across the entire DOM
    var linkSelectors = [
      'a[href*="/homedetails/"]',
      'a[href*="_zpid"]',
      'a[href*="/b/"]',
      'a[href*="/community/"]',
      'a[href*="/apartments/"]',
      'a[href*="/realestateandhomes-detail/"]',
      'a[href*="apartments.com/"]',
      'a[href*="/home/"]'
    ];

    var allLinks = document.querySelectorAll(linkSelectors.join(','));
    allLinks.forEach(function (link) {
      var href = link.href;
      if (!href || !href.startsWith('http')) return;

      // Filter out links that are not individual properties (e.g. general city hubs or footers)
      if (!/(\/homedetails\/|_zpid|\/b\/|\/community\/|\/apartments\/|\/realestateandhomes-detail\/|\/home\/)/i.test(href)) {
        return;
      }

      // Find the card container
      var card = link.closest([
        'article',
        'li',
        '[data-test*="card"]',
        '[data-testid*="card"]',
        '[data-testid="search-card"]',
        'div[class*="Card"]',
        'div[class*="card"]',
        'div[class*="ListItem"]',
        'div[class*="StyledPropertyCard"]',
        '.placard',
        '.search-result-card',
        '.property-card',
        '.list-card'
      ].join(',')) || link.parentElement;

      if (card && !foundMap.has(href)) {
        var cachedData = memoryMap.get(href);
        if (!cachedData) {
          var parts = href.split('/');
          var zpid = parts[parts.length - 1].replace(/_zpid|\.htm.*/gi, '');
          if (zpid) cachedData = memoryMap.get(zpid);
        }

        foundMap.set(href, {
          cardEl: card,
          href: href,
          cachedData: cachedData
        });
      }
    });

    // 2. Also check explicit card containers
    var containerSelectors = [
      'article[data-test="property-card"]',
      'li[class*="ListItem-"]',
      '.ListItem-c11n-8-100-0',
      'div[data-testid="property-card"]',
      'div[data-testid="search-card"]',
      '.property-card',
      '.placard',
      '.search-result-card'
    ];

    var containers = document.querySelectorAll(containerSelectors.join(','));
    containers.forEach(function (card) {
      var link = card.querySelector('a[href*="/homedetails/"], a[href*="_zpid"], a[href*="/b/"], a[href*="/community/"], a[href*="/apartments/"], a[href*="/realestateandhomes-detail/"], a[href*="apartments.com/"], a[href*="/home/"]');
      if (link && link.href && !foundMap.has(link.href)) {
        var href = link.href;
        var cachedData = memoryMap.get(href);
        foundMap.set(href, {
          cardEl: card,
          href: href,
          cachedData: cachedData
        });
      }
    });

    return Array.from(foundMap.values());
  }

  function injectSearchCardButtons() {
    if (!isSearchPage(location.href)) {
      document.querySelectorAll('.cp-card-select-badge, .cp-card-quick-add-btn').forEach(function(el) {
        el.remove();
      });
      return;
    }

    var cards = findAllListingCards();

    cards.forEach(function (item) {
      var card = item.cardEl;
      var href = item.href;
      var cachedData = item.cachedData;

      var style = window.getComputedStyle(card);
      if (style.position === 'static') {
        card.style.position = 'relative';
      }

      // Batch selection mode badge
      var existingSelect = card.querySelector('.cp-card-select-badge');
      if (state.batchMode) {
        card.classList.add('cp-card-batch-active');

        var toggleSelection = function (e) {
          if (e) {
            e.stopPropagation();
            e.preventDefault();
          }
          triggerHaptic();

          var badge = card.querySelector('.cp-card-select-badge');
          if (state.selectedCards.has(href)) {
            state.selectedCards.delete(href);
            if (badge) {
              badge.classList.remove('selected');
              badge.innerHTML = '';
            }
            card.classList.remove('cp-card-highlight-selected');
          } else {
            var payload = cachedData || {
              source: 'zillow',
              source_url: href,
              title: card.innerText.slice(0, 40) || 'Selected Property',
              address: card.querySelector('address') ? card.querySelector('address').innerText : 'Selected Property'
            };
            state.selectedCards.set(href, payload);
            if (badge) {
              badge.classList.add('selected');
              badge.innerHTML = '✓';
            }
            card.classList.add('cp-card-highlight-selected');
          }
          updateWidgetUI();
        };

        if (!existingSelect) {
          var selectBadge = document.createElement('div');
          selectBadge.className = 'cp-card-select-badge' + (state.selectedCards.has(href) ? ' selected' : '');
          selectBadge.innerHTML = state.selectedCards.has(href) ? '✓' : '';
          selectBadge.title = 'Select property for batch saving';

          selectBadge.addEventListener('click', toggleSelection);
          selectBadge.addEventListener('touchend', function(e) {
            e.stopPropagation();
            e.preventDefault();
            toggleSelection();
          }, { passive: false });

          card.appendChild(selectBadge);
        } else {
          var isSel = state.selectedCards.has(href);
          if (isSel) {
            existingSelect.classList.add('selected');
            existingSelect.innerHTML = '✓';
            card.classList.add('cp-card-highlight-selected');
          } else {
            existingSelect.classList.remove('selected');
            existingSelect.innerHTML = '';
            card.classList.remove('cp-card-highlight-selected');
          }
        }
      } else {
        if (existingSelect) existingSelect.remove();
        card.classList.remove('cp-card-highlight-selected');
        card.classList.remove('cp-card-batch-active');
      }

      // Quick add pill button
      if (!card.querySelector('.cp-card-quick-add-btn')) {
        var isSaved = knownSavedUrls.has(href);
        var btn = document.createElement('button');
        btn.className = 'cp-card-quick-add-btn' + (isSaved ? ' saved' : '');
        btn.innerHTML = isSaved ? '✓ Saved' : '+ Quick Add';
        btn.title = 'Add to Choice Properties Pipeline (' + (state.activeFolder ? state.activeFolder.name : 'General') + ')';

        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          e.preventDefault();
          triggerHaptic();
          fetchFullDetailAndIngest(href, btn);
        });
        btn.addEventListener('touchend', function (e) {
          e.stopPropagation();
          e.preventDefault();
          triggerHaptic();
          fetchFullDetailAndIngest(href, btn);
        }, { passive: false });

        card.appendChild(btn);
      }
    });
  }

  // ── Keyboard Shortcut: Alt + S / Option + S ─────────────────
  window.addEventListener('keydown', function (e) {
    if ((e.altKey && e.code === 'KeyS') || (e.altKey && e.key === 's') || (e.altKey && e.key === 'S')) {
      e.preventDefault();
      if (isDetailPage(location.href)) {
        handleInstantSave();
      } else if (state.selectedCards.size > 0) {
        handleBatchSave();
      }
    }
  });

  // ── Unified Stabilization Engine ─────────────────────────────
  function stabilizeUI() {
    if (!isSupportedPage(location.href)) return;

    // 1. Maintain Floating Dock
    if (!document.getElementById('cp-floating-widget')) {
      injectWidget();
    } else {
      updateWidgetUI();
    }

    // 2. Detail vs Search Specific UI
    if (isDetailPage(location.href)) {
      injectDetailHeaderButton();
      var straySearchBtns = document.querySelectorAll('.cp-card-select-badge, .cp-card-quick-add-btn');
      if (straySearchBtns.length > 0) {
        straySearchBtns.forEach(function(b) { b.remove(); });
      }
    } else if (isSearchPage(location.href)) {
      injectSearchCardButtons();
    }
  }

  function onLocationChange() {
    lastUrl = location.href;
    closePopover();
    
    // Immediate tick
    stabilizeUI();

    // Staggered follow-up ticks for async React mounting
    setTimeout(stabilizeUI, 150);
    setTimeout(stabilizeUI, 400);
    setTimeout(stabilizeUI, 900);
  }

  // Patch history navigation for SPAs
  function patchHistoryNavigation() {
    var originalPush = history.pushState;
    var originalReplace = history.replaceState;
    history.pushState = function () {
      var result = originalPush.apply(this, arguments);
      onLocationChange();
      return result;
    };
    history.replaceState = function () {
      var result = originalReplace.apply(this, arguments);
      onLocationChange();
      return result;
    };
  }

  patchHistoryNavigation();
  window.addEventListener('popstate', onLocationChange);
  window.addEventListener('hashchange', onLocationChange);

  // Scroll listener for lazy-loaded mobile cards
  window.addEventListener('scroll', function () {
    if (isThrottled) return;
    isThrottled = true;
    requestAnimationFrame(function () {
      if (isSearchPage(location.href)) {
        injectSearchCardButtons();
      }
      isThrottled = false;
    });
  }, { passive: true });

  // Mutation observer with debounce for heavy DOM changes
  var mutTimer = null;
  var observer = new MutationObserver(function () {
    if (mutTimer) return;
    mutTimer = setTimeout(function () {
      mutTimer = null;
      stabilizeUI();
    }, 120);
  });

  if (document.body || document.documentElement) {
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
  }

  // Periodic heartbeat every 600ms to guarantee persistent attachment
  if (stabilizationInterval) clearInterval(stabilizationInterval);
  stabilizationInterval = setInterval(stabilizeUI, 600);

  // Initial execution
  stabilizeUI();
  setTimeout(stabilizeUI, 300);
  setTimeout(stabilizeUI, 800);
})();
