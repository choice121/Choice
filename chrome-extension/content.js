// ============================================================
// Choice Properties — Universal Content Script & UI Engine v18.0.4
// Runs securely inside Chrome Extension isolated world on
// Zillow, Realtor.com, Apartments.com, Redfin, Opendoor,
// Progress Residential, and CJ Real Estate.
// High Performance • Instant SPA Navigation • Smart Pre-Flight HUD
// Global Hotkeys (Cmd/Ctrl+Shift+S) • Resilient Background Retry
// ============================================================
(function () {
  'use strict';

  if (window.__CP_CONTENT_LOADED__) return;
  window.__CP_CONTENT_LOADED__ = true;

  var EDGE_URL = (window.CP_CONFIG && window.CP_CONFIG.EDGE_URL) || 'https://tlfmwetmhthpyrytrcfo.supabase.co/functions/v1/receive-pipeline-import';
  var SECRET   = (window.CP_CONFIG && window.CP_CONFIG.IMPORT_SECRET) || 'cp_import_7Kx3m9P2w5';
  var VERSION  = '18.0.4';

  var IS_MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  var PHOTO_BATCH_SIZE = IS_MOBILE ? 4 : 12;
  var MAX_PHOTOS = IS_MOBILE ? 25 : 50;

  var lastUrl = location.href;
  var activeWidget = null;
  var isExpanded = false;
  var isMinimized = false;
  var currentExtractedData = null;
  var cachedFolders = [];
  var isSaving = false;

  // ── URL & Page Support Detection ────────────────────────────
  function isDetailPage(url) {
    if (window.CP_Extractors && typeof window.CP_Extractors.detect === 'function') {
      if (window.CP_Extractors.detect(url)) return true;
    }
    return /zillow\.com\/(homedetails|homes|b|community|apartments)\/.*_zpid/i.test(url) ||
           /zillow\.com\/.*_zpid/i.test(url) ||
           /zillow\.com\/(homedetails|b|community)\//i.test(url) ||
           /realtor\.com\/realestateandhomes-detail/i.test(url) ||
           /apartments\.com\/[^/]+\/[^/]+/i.test(url) ||
           /redfin\.com\/[^/]+\/[^/]+\/[^/]+\/[^/]+/i.test(url) ||
           /opendoor\.com\/(homes|properties|listings|[^/]+\/[^/]+)/i.test(url) ||
           /rentprogress\.com\/(houses-for-rent|homes|properties|rental-homes|[^/]+\/[^/]+)/i.test(url) ||
           /(cjproperties\.org|cjrealestate\.com)\/[^/]+/i.test(url);
  }

  function isSearchPage(url) {
    return /zillow\.com\/(homes|for_rent|b\/|search)/i.test(url) ||
           /realtor\.com\/(apartments|houses-for-rent|realestateandhomes-search)/i.test(url) ||
           /redfin\.com\/.*\/filter/i.test(url);
  }

  // ── Fast In-Memory & LocalStorage Folder Cache ───────────────
  function getCachedFolders() {
    if (cachedFolders && cachedFolders.length > 0) return cachedFolders;
    try {
      var localData = localStorage.getItem('cp_pipeline_folders_cache');
      if (localData) {
        var parsed = JSON.parse(localData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          cachedFolders = parsed;
          return cachedFolders;
        }
      }
    } catch (e) {}
    return [];
  }

  function setCachedFolders(folders) {
    if (!Array.isArray(folders)) return;
    cachedFolders = folders;
    try {
      localStorage.setItem('cp_pipeline_folders_cache', JSON.stringify(folders));
    } catch (e) {}
  }

  // ── Smart Layout Collision Avoidance ────────────────────────
  function updateWidgetPosition() {
    if (!activeWidget) return;
    var bottomOffset = 24;

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

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char];
    });
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

    // Fast Pre-Flight Extraction
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
    photoUrls = dedupePhotoUrls(photoUrls);
    var photoCount = photoUrls.length;
    var photoBadgeClass = photoCount >= 6 ? 'cp-chip-photos' : 'cp-chip-warn';
    var photoBadgeText = photoCount > 0 ? ('📸 ' + photoCount + ' photos') : '📸 No photos';

    var propType = (extracted && extracted.property_type) ? extracted.property_type.replace(/_/g, ' ') : 'Property';
    var addressStr = (extracted && extracted.address) ? extracted.address : 'Detected Listing';
    if (extracted && extracted.city && extracted.state) {
      addressStr += ', ' + extracted.city + ', ' + extracted.state;
    }

    // Build Folder Options from Instant Cache
    var cached = getCachedFolders();
    var folderOptionsHtml = '<option value="">(Default / Main Inbox)</option>';
    cached.forEach(function (f) {
      folderOptionsHtml += '<option value="' + escapeHtml(f.id) + '">' +
        escapeHtml(f.icon || '📁') + ' ' + escapeHtml(f.name) + '</option>';
    });

    container.innerHTML = `
      <!-- Minimized State Trigger -->
      <div class="cp-mini-trigger" id="cp-expand-trigger" title="Click to expand Choice Properties importer (Cmd/Ctrl+Shift+S to save)">
        <div class="cp-logo-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
        </div>
        <span>${escapeHtml(rentStr)} • Choice Import</span>
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
            <span class="cp-badge-verified" id="cp-version-badge">Live v${VERSION}</span>
            <button class="cp-header-btn" id="cp-btn-minimize" title="Minimize widget">_</button>
            <button class="cp-header-btn" id="cp-btn-close" title="Close widget">×</button>
          </div>
        </div>

        <div class="cp-body">
          <div class="cp-property-snapshot">
            <div class="cp-address-line" title="${escapeHtml(addressStr)}">${escapeHtml(addressStr)}</div>
            <div class="cp-chips-row">
              <span class="cp-chip cp-chip-price">${escapeHtml(rentStr)}</span>
              <span class="cp-chip">${escapeHtml(bedsBaths)}</span>
              <span class="cp-chip ${photoBadgeClass}">${escapeHtml(photoBadgeText)}</span>
              <span class="cp-chip cp-chip-type">${escapeHtml(propType)}</span>
            </div>

            <!-- Mini Photo Pre-Flight Strip -->
            ${photoUrls.length > 0 ? `
              <div class="cp-photo-preview-strip">
                ${photoUrls.slice(0, 5).map(function (u) {
                  return '<img src="' + escapeHtml(u) + '" class="cp-photo-thumb" alt="thumb" loading="lazy" />';
                }).join('')}
                ${photoUrls.length > 5 ? '<span class="cp-photo-more">+' + (photoUrls.length - 5) + '</span>' : ''}
              </div>
            ` : ''}

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

          <!-- Folder Selection Target (Fast Instant Cache) -->
          <div class="cp-folder-select-row">
            <label for="cp-folder-select" class="cp-folder-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
              <span>Target Folder:</span>
            </label>
            <div class="cp-folder-select-wrapper">
              <select id="cp-folder-select" class="cp-folder-select">
                ${folderOptionsHtml}
              </select>
            </div>
          </div>

          <!-- Main Action Button with Hotkey Hint -->
          <button class="cp-save-action-btn" id="cp-btn-save">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            <span>Save to Pipeline</span>
            <span class="cp-hotkey-hint">${IS_MOBILE ? '' : '⌘⇧S'}</span>
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
              <span id="cp-success-text">Saved to Choice Pipeline!</span>
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

    // Revalidate Folders in background (0ms UI latency)
    (async function fetchFolders() {
      var folderSelect = container.querySelector('#cp-folder-select');
      if (!folderSelect) return;
      try {
        var url = EDGE_URL + '?secret=' + encodeURIComponent(SECRET) + '&action=list_folders';
        var foldersList = null;
        try {
          var res = await fetch(url);
          if (res.ok) {
            var data = await res.json();
            if (data && Array.isArray(data.folders) && data.folders.length > 0) {
              foldersList = data.folders;
            }
          }
        } catch (_) {}

        if (Array.isArray(foldersList) && foldersList.length > 0) {
          setCachedFolders(foldersList);
          var currentVal = folderSelect.value;
          folderSelect.innerHTML = '<option value="">(Default / Main Inbox)</option>';
          foldersList.forEach(function (f) {
            var opt = document.createElement('option');
            opt.value = f.id;
            opt.textContent = (f.icon || '📁') + ' ' + f.name;
            folderSelect.appendChild(opt);
          });
          if (currentVal) folderSelect.value = currentVal;
        }
      } catch (e) {}
    })();

    // Live Cloud Metadata Sync
    (async function syncWidgetVersion() {
      try {
        var metaRes = await fetch('https://choice-properties-site.pages.dev/extension-meta.json?_t=' + Date.now(), { cache: 'no-store' });
        if (metaRes.ok) {
          var meta = await metaRes.json();
          if (meta && meta.version) {
            var badge = container.querySelector('#cp-version-badge');
            if (badge) {
              badge.textContent = 'Verified v' + meta.version;
              badge.title = 'Live Cloud Sync Connected';
            }
          }
        }
      } catch (err) {}
    })();
  }

  // ── Save Execution Flow (Fast + Resilient Background Process) ─
  async function handleSave() {
    if (isSaving) return;
    var saveBtn = document.querySelector('#cp-btn-save');
    var progressBox = document.querySelector('#cp-progress-box');
    var progressStatus = document.querySelector('#cp-progress-status');
    var progressCount = document.querySelector('#cp-progress-count');
    var progressFill = document.querySelector('#cp-progress-fill');
    var successBox = document.querySelector('#cp-success-box');
    var successText = document.querySelector('#cp-success-text');

    if (!saveBtn) return;
    isSaving = true;

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="cp-spinner"></span> <span>Saving to pipeline…</span>';
    saveBtn.style.background = '#6366f1';

    try {
      var extracted = currentExtractedData;
      if (!extracted && window.CP_Extractors) {
        extracted = window.CP_Extractors.extract(location.href, document);
      }

      if (!extracted) {
        setError('Could not extract listing');
        isSaving = false;
        return;
      }

      var photoUrls = extractPhotoUrls(extracted.original_image_urls);
      if (!photoUrls.length && Array.isArray(extracted.photo_urls)) {
        photoUrls = extracted.photo_urls;
      }
      photoUrls = dedupePhotoUrls(photoUrls);

      var folderSelect = document.querySelector('#cp-folder-select');
      var selectedFolderId = folderSelect && folderSelect.value ? folderSelect.value : null;

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
        pets_allowed: true,
        application_fee: 50,
        folder_id: selectedFolderId,
        original_image_urls: JSON.stringify(photoUrls.map(function (u) { return { url: u }; })),
        _import: 'browser-extension-v' + VERSION,
      };

      // ── Step 1: Save the property record through the pipeline function ────────────
      var url = EDGE_URL + '?secret=' + encodeURIComponent(SECRET);
      var resp = null;
      var retries = 2;

      while (retries >= 0) {
        try {
          var saveRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          resp = await saveRes.json();
          if (resp && (resp.ok || resp.duplicate)) break;
        } catch (fetchErr) {
          retries--;
          if (retries < 0) break;
          await new Promise(function (r) { setTimeout(r, 600); });
        }
      }

      if (resp && resp.ok) {
        saveBtn.style.display = 'none';

        if (resp.folder && resp.folder.name) {
          if (successText) {
            successText.textContent = 'Saved to ' + resp.folder.name + (resp.folder.serial ? ' (#' + resp.folder.serial + ')' : '');
          }
        }

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
            isSaving = false;
            if (result.uploaded.length > 0) {
              updatePipelinePhotos(payload, result.uploaded);
            }
          }).catch(function () {
            progressBox.style.display = 'none';
            successBox.style.display = 'flex';
            isSaving = false;
          });
        } else {
          successBox.style.display = 'flex';
          isSaving = false;
        }
      } else if (resp && resp.duplicate) {
        isSaving = false;
        if (resp.folder && resp.folder.folder) {
          saveBtn.innerHTML = '<span>Updated Folder (' + escapeHtml(resp.folder.folder.slice(0, 14)) + ')</span>';
          saveBtn.style.background = '#059669';
        } else {
          saveBtn.innerHTML = '<span>Already in Pipeline</span>';
          saveBtn.style.background = '#b45309';
        }
        setTimeout(function () {
          saveBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg><span>Save to Pipeline</span><span class="cp-hotkey-hint">⌘⇧S</span>';
          saveBtn.style.background = 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)';
          saveBtn.disabled = false;
        }, 4000);
      } else {
        isSaving = false;
        setError(resp && resp.error ? resp.error.slice(0, 45) : 'Save failed');
      }
    } catch (e) {
      console.error('[CP] handleSave error:', e);
      isSaving = false;
      setError('Network connection error');
    }
  }

  function setError(msg) {
    var saveBtn = document.querySelector('#cp-btn-save');
    if (!saveBtn) return;
    saveBtn.innerHTML = '<span>Failed: ' + escapeHtml(msg) + '</span>';
    saveBtn.style.background = '#dc2626';
    saveBtn.disabled = false;
    setTimeout(function () {
      if (saveBtn) {
        saveBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg><span>Save to Pipeline</span><span class="cp-hotkey-hint">⌘⇧S</span>';
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
        if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
          resolve(null);
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
      var updated = false;
      try {
        var res = await fetch(EDGE_URL + '?secret=' + encodeURIComponent(SECRET), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload),
        });
        if (res.ok) updated = true;
      } catch (_) {}

    } catch (e) {}
  }

  // ── Search Results Cards Quick-Save (All Supported Feeds) ────
  function injectSearchCardButtons() {
    if (!isSearchPage(location.href)) return;
    var cards = document.querySelectorAll('article[data-test="property-card"], div[class*="StyledPropertyCard"], .photo-cards > li, div[data-testid="property-card"]');
    if (!cards || !cards.length) return;

    cards.forEach(function (card) {
      if (card.querySelector('.cp-search-card-btn')) return;

      var linkEl = card.querySelector('a[href*="/homedetails/"], a[href*="_zpid"], a[href*="/realestateandhomes-detail/"]');
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
          var address = addrEl ? addrEl.textContent.trim() : 'Search Card Listing';

          var cardPayload = {
            source: 'zillow',
            source_url: targetUrl,
            address: address,
            monthly_rent: rent,
            pets_allowed: true,
            application_fee: 50,
            _import: 'search-card-v' + VERSION,
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
          } else if (cardResp && cardResp.duplicate) {
            btn.innerHTML = '<span>In Pipeline</span>';
          } else {
            var errorMessage = cardResp && cardResp.error ? String(cardResp.error).slice(0, 45) : 'Save failed';
            btn.innerHTML = '<span>' + escapeHtml(errorMessage) + '</span>';
            btn.disabled = false;
          }
        } catch (err) {
          btn.innerHTML = '<span>Saved to Tab</span>';
          window.open(targetUrl, '_blank');
        }
      });

      if (card.style.position !== 'absolute') card.style.position = 'relative';
      card.appendChild(btn);
    });
  }

  // ── Global Hotkeys Hook (Cmd/Ctrl+Shift+S) ───────────────────
  function setupGlobalHotkeys() {
    window.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (activeWidget && !isSaving) {
          if (isMinimized) {
            activeWidget.classList.remove('cp-minimized');
            isMinimized = false;
          }
          handleSave();
        }
      }
    });
  }

  // ── 0ms Instant SPA History Hooks & Mutation Watchers ────────
  function hookHistoryMethods() {
    var rawPushState = history.pushState;
    var rawReplaceState = history.replaceState;

    history.pushState = function () {
      var result = rawPushState.apply(this, arguments);
      onUrlChange();
      return result;
    };

    history.replaceState = function () {
      var result = rawReplaceState.apply(this, arguments);
      onUrlChange();
      return result;
    };
  }

  function onUrlChange() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      removeWidget();
      // Fast mount using requestIdleCallback / fast timeout
      setTimeout(function () {
        injectWidget();
        injectSearchCardButtons();
      }, 100);
    }
  }

  function setupWatchers() {
    hookHistoryMethods();
    window.addEventListener('popstate', onUrlChange);
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
  setupGlobalHotkeys();
  console.log('[Choice Properties] High-Performance Engine v' + VERSION + ' active');
})();
