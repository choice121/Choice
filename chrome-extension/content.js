// ============================================================
// Choice Properties — Content Script
// Runs directly in Chrome MV3 isolated world on listing pages.
// Injects floating "Save to Pipeline" button with Save-First
// preview modal, folder creation, and direct Supabase sync.
// ============================================================
(function () {
  'use strict';

  var EDGE_URL = (window.CP_CONFIG && window.CP_CONFIG.EDGE_URL) ||
    'https://tlfmwetmhthpyrytrcfo.supabase.co/functions/v1/receive-pipeline-import';
  var SECRET = (window.CP_CONFIG && window.CP_CONFIG.IMPORT_SECRET) ||
    'cp_import_7Kx3m9P2w5';

  var lastUrl = location.href;
  var isSaving = false;

  // ── URL detection ───────────────────────────────────────────
  function isSupportedPage(url) {
    if (!url) return false;
    return /zillow\.com\/(homedetails|b|apartments|community)\//i.test(url) ||
           /zillow\.com\/.*_zpid/i.test(url) ||
           /realtor\.com\/realestateandhomes-detail\//i.test(url) ||
           /apartments\.com\//i.test(url) ||
           /redfin\.com\//i.test(url);
  }

  // ── Helpers ─────────────────────────────────────────────────
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

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
    } catch (_) {}
    return urls;
  }

  // ── Folder API ──────────────────────────────────────────────
  async function fetchFolders() {
    try {
      var res = await fetch(EDGE_URL + '?action=list_folders&secret=' + encodeURIComponent(SECRET));
      var data = await res.json();
      return (data && data.folders) || [];
    } catch (e) {
      console.warn('[CP] Failed to fetch folders:', e);
      return [];
    }
  }

  async function createFolder(name) {
    try {
      var res = await fetch(EDGE_URL + '?secret=' + encodeURIComponent(SECRET), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_folder', name: name })
      });
      return await res.json();
    } catch (e) {
      console.warn('[CP] Failed to create folder:', e);
      return { ok: false, error: e.message };
    }
  }

  // ── Button injection & management ───────────────────────────
  function removeButton() {
    var old = document.getElementById('cp-save-btn');
    if (old) old.remove();
  }

  function injectButton() {
    if (document.getElementById('cp-save-btn')) return;
    if (!isSupportedPage(location.href)) return;

    var btn = document.createElement('button');
    btn.id = 'cp-save-btn';
    btn.setAttribute('type', 'button');
    btn.innerHTML = `
      <div class="cp-btn-inner" style="display:flex;align-items:center;gap:8px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2v13M5 9l7 7 7-7"/>
          <path d="M3 20h18"/>
        </svg>
        <span class="cp-btn-label">Save to Pipeline</span>
      </div>
    `;

    Object.assign(btn.style, {
      position: 'fixed',
      bottom: 'max(24px, env(safe-area-inset-bottom))',
      right: 'max(24px, env(safe-area-inset-right))',
      zIndex: '2147483647',
      padding: '0 20px',
      minWidth: '60px',
      height: '52px',
      background: '#6366f1',
      color: '#fff',
      border: 'none',
      borderRadius: '26px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '15px',
      fontWeight: '700',
      letterSpacing: '0.01em',
      cursor: 'pointer',
      boxShadow: '0 4px 20px rgba(99,102,241,0.5), 0 2px 6px rgba(0,0,0,0.2)',
      touchAction: 'manipulation',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      transition: 'transform 0.12s, opacity 0.12s, background 0.15s, box-shadow 0.15s',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      lineHeight: '1'
    });

    btn.addEventListener('mouseenter', function () {
      btn.style.background = '#4f46e5';
      btn.style.boxShadow = '0 6px 24px rgba(99,102,241,0.6)';
      btn.style.transform = 'translateY(-1px)';
    });

    btn.addEventListener('mouseleave', function () {
      btn.style.background = '#6366f1';
      btn.style.boxShadow = '0 4px 20px rgba(99,102,241,0.5), 0 2px 6px rgba(0,0,0,0.2)';
      btn.style.transform = 'translateY(0)';
    });

    btn.addEventListener('click', handleSave);

    if (document.body) {
      document.body.appendChild(btn);
    }
  }

  // ── URL & DOM change watchers ───────────────────────────────
  function onLocationChange() {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    removeButton();
    setTimeout(injectButton, 300);
  }

  function watchUrlChanges() {
    window.addEventListener('popstate', onLocationChange);
    setInterval(function () {
      if (location.href !== lastUrl) {
        onLocationChange();
      } else if (!document.getElementById('cp-save-btn') && isSupportedPage(location.href)) {
        injectButton();
      }
    }, 750);

    if (document.body) {
      var observer = new MutationObserver(function () {
        if (!document.getElementById('cp-save-btn') && isSupportedPage(location.href)) {
          injectButton();
        }
      });
      observer.observe(document.body, { childList: true, subtree: false });
    }
  }

  // ── Preview & Edit Modal ────────────────────────────────────
  async function openPreviewModal(extracted, triggerBtn) {
    var existing = document.getElementById('cp-preview-modal');
    if (existing) existing.remove();

    var folders = await fetchFolders();

    // Check stored folder setting
    var savedFolderId = '';
    try {
      if (chrome.storage && chrome.storage.local) {
        var stored = await chrome.storage.local.get({ cp_settings: {} });
        savedFolderId = stored.cp_settings?.folderId || '';
      }
    } catch (_) {}

    var folderOptions = '<option value="">(No folder / Main)</option>';
    folders.forEach(function (f) {
      var isSel = (f.id === savedFolderId) ? ' selected' : '';
      folderOptions += '<option value="' + escapeHtml(f.id) + '"' + isSel + '>' + escapeHtml(f.name) + '</option>';
    });
    folderOptions += '<option value="__new__">+ Create new folder...</option>';

    var photoUrls = extractPhotoUrls(extracted.original_image_urls);
    if (!photoUrls.length && Array.isArray(extracted.photo_urls)) {
      photoUrls = extracted.photo_urls;
    }
    var photoCount = photoUrls.length;

    var modal = document.createElement('div');
    modal.id = 'cp-preview-modal';
    modal.innerHTML = `
      <style>
        #cp-preview-modal { position:fixed; inset:0; z-index:2147483648; display:flex; align-items:center; justify-content:center; padding:16px; box-sizing:border-box; }
        #cp-preview-modal .cp-backdrop { position:absolute; inset:0; background:rgba(5,10,24,0.75); backdrop-filter:blur(4px); }
        #cp-preview-modal .cp-sheet { position:relative; width:100%; max-width:640px; background:#0b1120; color:#f8fafc; border:1px solid rgba(255,255,255,0.12); border-radius:16px; box-shadow:0 20px 50px rgba(0,0,0,0.6); padding:22px 24px; max-height:90vh; overflow-y:auto; font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; box-sizing:border-box; }
        #cp-preview-modal .cp-hd { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; padding-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.08); }
        #cp-preview-modal .cp-hd h3 { margin:0; font-size:17px; font-weight:700; color:#fff; display:flex; align-items:center; gap:8px; }
        #cp-preview-modal .cp-badge { font-size:11px; font-weight:600; background:rgba(99,102,241,0.25); color:#a5b4fc; border:1px solid rgba(99,102,241,0.4); padding:3px 8px; border-radius:12px; }
        #cp-preview-modal .cp-row { display:flex; gap:10px; margin-top:10px; }
        #cp-preview-modal .cp-field { flex:1; display:flex; flex-direction:column; }
        #cp-preview-modal label { font-size:12px; font-weight:600; color:#94a3b8; margin-bottom:5px; text-transform:uppercase; letter-spacing:0.04em; }
        #cp-preview-modal input, #cp-preview-modal select, #cp-preview-modal textarea { background:#131c31; border:1px solid rgba(255,255,255,0.1); color:#fff; padding:9px 12px; border-radius:8px; font-size:14px; outline:none; transition:border 0.15s; font-family:inherit; box-sizing:border-box; }
        #cp-preview-modal input:focus, #cp-preview-modal select:focus, #cp-preview-modal textarea:focus { border-color:#6366f1; background:#17223b; }
        #cp-preview-modal textarea { min-height:72px; resize:vertical; line-height:1.4; }
        #cp-preview-modal .cp-actions { display:flex; align-items:center; justify-content:flex-end; gap:10px; margin-top:18px; padding-top:14px; border-top:1px solid rgba(255,255,255,0.08); }
        #cp-preview-modal .btn { padding:10px 18px; border-radius:8px; cursor:pointer; border:none; font-size:14px; font-weight:700; transition:background 0.15s, opacity 0.15s; display:inline-flex; align-items:center; justify-content:center; gap:6px; }
        #cp-preview-modal .btn-primary { background:#6366f1; color:#fff; box-shadow:0 4px 14px rgba(99,102,241,0.4); }
        #cp-preview-modal .btn-primary:hover { background:#4f46e5; }
        #cp-preview-modal .btn-ghost { background:transparent; color:#94a3b8; border:1px solid rgba(255,255,255,0.1); }
        #cp-preview-modal .btn-ghost:hover { background:rgba(255,255,255,0.06); color:#fff; }
      </style>
      <div class="cp-backdrop"></div>
      <div class="cp-sheet" role="dialog" aria-modal="true" aria-label="Preview listing">
        <div class="cp-hd">
          <h3>
            <span>Choice Properties</span>
            ${photoCount > 0 ? `<span class="cp-badge">📸 ${photoCount} photos</span>` : ''}
          </h3>
          <button id="cp-preview-close" class="btn btn-ghost" style="padding:6px 12px; font-size:12px;">✕ Close</button>
        </div>

        <div class="cp-row">
          <div class="cp-field">
            <label>Listing Title</label>
            <input id="cp-prev-title" value="${escapeHtml(extracted.title || '')}" />
          </div>
        </div>

        <div class="cp-row">
          <div class="cp-field" style="flex:2">
            <label>Address</label>
            <input id="cp-prev-address" value="${escapeHtml(extracted.address || '')}" />
          </div>
          <div class="cp-field">
            <label>City</label>
            <input id="cp-prev-city" value="${escapeHtml(extracted.city || '')}" />
          </div>
        </div>

        <div class="cp-row">
          <div class="cp-field">
            <label>State</label>
            <input id="cp-prev-state" value="${escapeHtml(extracted.state || '')}" />
          </div>
          <div class="cp-field">
            <label>ZIP Code</label>
            <input id="cp-prev-zip" value="${escapeHtml(extracted.zip || '')}" />
          </div>
        </div>

        <div class="cp-row">
          <div class="cp-field">
            <label>Monthly Rent ($/mo)</label>
            <input id="cp-prev-rent" value="${escapeHtml(String(extracted.monthly_rent || extracted.rent || ''))}" />
          </div>
          <div class="cp-field">
            <label>Bedrooms</label>
            <input id="cp-prev-beds" value="${escapeHtml(String(extracted.bedrooms !== null && extracted.bedrooms !== undefined ? extracted.bedrooms : ''))}" />
          </div>
          <div class="cp-field">
            <label>Bathrooms</label>
            <input id="cp-prev-baths" value="${escapeHtml(String(extracted.bathrooms !== null && extracted.bathrooms !== undefined ? extracted.bathrooms : ''))}" />
          </div>
          <div class="cp-field">
            <label>Sq Ft</label>
            <input id="cp-prev-sqft" value="${escapeHtml(String(extracted.square_footage || ''))}" />
          </div>
        </div>

        <div style="margin-top:10px;" class="cp-field">
          <label>Target Pipeline Folder</label>
          <select id="cp-prev-folder-sel" style="width:100%; cursor:pointer;">
            ${folderOptions}
          </select>
          <div id="cp-new-folder-row" style="display:none; margin-top:8px; gap:8px;">
            <input id="cp-new-folder-input" style="flex:1" placeholder="Enter new folder name..." />
            <button id="cp-create-folder-btn" type="button" class="btn" style="background:#10b981; color:#fff; padding:8px 16px;">Create</button>
          </div>
        </div>

        <div style="margin-top:10px;" class="cp-field">
          <label>Description</label>
          <textarea id="cp-prev-desc" placeholder="Listing description...">${escapeHtml(extracted.description || '')}</textarea>
        </div>

        <div class="cp-actions">
          <button id="cp-prev-cancel" class="btn btn-ghost" type="button">Cancel</button>
          <button id="cp-prev-confirm" class="btn btn-primary" type="button">Save to Pipeline</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    var folderSel = document.getElementById('cp-prev-folder-sel');
    var newFolderRow = document.getElementById('cp-new-folder-row');
    var createBtn = document.getElementById('cp-create-folder-btn');
    var newFolderInp = document.getElementById('cp-new-folder-input');

    // Pre-select saved folder if exists
    if (savedFolderId) {
      folderSel.value = savedFolderId;
    }

    folderSel.addEventListener('change', function () {
      if (folderSel.value === '__new__') {
        newFolderRow.style.display = 'flex';
        newFolderInp.focus();
      } else {
        newFolderRow.style.display = 'none';
        if (folderSel.value) {
          try {
            if (chrome.storage && chrome.storage.local) {
              chrome.storage.local.get({ cp_settings: {} }, function (stored) {
                var s = stored.cp_settings || {};
                s.folderId = folderSel.value;
                chrome.storage.local.set({ cp_settings: s });
              });
            }
          } catch (_) {}
        }
      }
    });

    async function handleCreateFolder() {
      var name = newFolderInp.value.trim();
      if (!name) return;
      createBtn.textContent = 'Creating...';
      createBtn.disabled = true;

      var res = await createFolder(name);
      if (res && res.ok && res.id) {
        var opt = document.createElement('option');
        opt.value = res.id;
        opt.textContent = name;
        opt.selected = true;
        folderSel.insertBefore(opt, folderSel.lastElementChild);
        folderSel.value = res.id;
        newFolderRow.style.display = 'none';
        newFolderInp.value = '';

        try {
          if (chrome.storage && chrome.storage.local) {
            chrome.storage.local.get({ cp_settings: {} }, function (stored) {
              var s = stored.cp_settings || {};
              s.folderId = res.id;
              chrome.storage.local.set({ cp_settings: s });
            });
          }
        } catch (_) {}
      } else {
        alert('Could not create folder: ' + (res && res.error || 'Server error'));
      }

      createBtn.textContent = 'Create';
      createBtn.disabled = false;
    }

    createBtn.addEventListener('click', handleCreateFolder);
    newFolderInp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCreateFolder();
      }
    });

    function closePreviewModal() {
      var m = document.getElementById('cp-preview-modal');
      if (m) m.remove();
    }

    modal.querySelector('.cp-backdrop').addEventListener('click', closePreviewModal);
    modal.querySelector('#cp-preview-close').addEventListener('click', closePreviewModal);
    modal.querySelector('#cp-prev-cancel').addEventListener('click', closePreviewModal);

    modal.querySelector('#cp-prev-confirm').addEventListener('click', function () {
      var updated = Object.assign({}, extracted);
      updated.title = document.getElementById('cp-prev-title').value.trim();
      updated.address = document.getElementById('cp-prev-address').value.trim();
      updated.city = document.getElementById('cp-prev-city').value.trim();
      updated.state = document.getElementById('cp-prev-state').value.trim();
      updated.zip = document.getElementById('cp-prev-zip').value.trim();
      updated.monthly_rent = document.getElementById('cp-prev-rent').value.trim();
      updated.bedrooms = document.getElementById('cp-prev-beds').value.trim();
      updated.bathrooms = document.getElementById('cp-prev-baths').value.trim();
      updated.square_footage = document.getElementById('cp-prev-sqft').value.trim();
      updated.description = document.getElementById('cp-prev-desc').value.trim();

      if (folderSel.value && folderSel.value !== '__new__') {
        updated.folder_id = folderSel.value;
        updated.folder_name = folderSel.options[folderSel.selectedIndex].text;
      } else {
        updated.folder_id = null;
        updated.folder_name = null;
      }

      closePreviewModal();
      startImportProcess(updated, triggerBtn);
    });
  }

  // ── Extraction and save flow ────────────────────────────────
  async function handleSave() {
    if (isSaving) return;
    var btn = document.getElementById('cp-save-btn');
    if (btn) {
      var label = btn.querySelector('.cp-btn-label');
      if (label) label.textContent = 'Reading listing...';
    }

    try {
      var extractor = window.CP_Extractors && window.CP_Extractors.detect(location.href);
      var extracted = null;
      if (extractor) {
        extracted = window.CP_Extractors.extract(location.href, document);
      }

      // Robust fallback if extract returned null or missing
      if (!extracted) {
        var h1 = document.querySelector('h1');
        var priceEl = document.querySelector('[data-testid="price"], span[data-testid="price"], .summary-container span');
        var descEl = document.querySelector('[data-testid="description"], .property-description');
        var street = h1 ? h1.textContent.trim().split(',')[0].trim() : '';

        var zpidM = location.href.match(/(\d+)_zpid/i);
        var zpid = zpidM ? zpidM[1] : ('zillow-' + Date.now());

        var photos = [];
        var imgs = document.querySelectorAll('img[src*="zillowstatic.com"], img[src*="photos"]');
        imgs.forEach(function (img) {
          var src = img.src || img.getAttribute('src');
          if (src && !photos.includes(src)) photos.push(src);
        });

        extracted = {
          source: 'zillow',
          source_listing_id: zpid,
          source_url: location.href,
          title: street ? (street + ' Rental') : 'Choice Properties Rental',
          address: street,
          city: '',
          state: '',
          zip: '',
          monthly_rent: priceEl ? priceEl.textContent.replace(/[^0-9]/g, '') : '',
          bedrooms: '',
          bathrooms: '',
          square_footage: '',
          description: descEl ? descEl.textContent.trim() : '',
          original_image_urls: JSON.stringify(photos)
        };
      }

      if (btn) {
        var lbl = btn.querySelector('.cp-btn-label');
        if (lbl) lbl.textContent = 'Save to Pipeline';
      }

      openPreviewModal(extracted, btn);
    } catch (e) {
      console.error('[CP] Extraction error:', e);
      setError('Extraction error');
    }
  }

  async function startImportProcess(extracted, triggerBtn) {
    var btn = triggerBtn || document.getElementById('cp-save-btn');
    if (btn) {
      var lbl = btn.querySelector('.cp-btn-label');
      if (lbl) lbl.textContent = 'Saving...';
      btn.style.background = '#818cf8';
    }
    isSaving = true;

    try {
      var photoUrls = extractPhotoUrls(extracted.original_image_urls);
      if (!photoUrls.length && Array.isArray(extracted.photo_urls)) {
        photoUrls = extracted.photo_urls;
      }

      var payload = {
        source: extracted.source || 'zillow',
        source_listing_id: extracted.source_listing_id || (location.href.match(/(\d+)_zpid/i) || [])[1] || String(Date.now()),
        source_url: extracted.source_url || location.href,
        title: extracted.title,
        address: extracted.address,
        city: extracted.city,
        state: extracted.state,
        zip: extracted.zip,
        lat: extracted.lat,
        lng: extracted.lng,
        monthly_rent: extracted.monthly_rent ? parseInt(String(extracted.monthly_rent).replace(/[^0-9]/g, ''), 10) : null,
        bedrooms: extracted.bedrooms ? parseInt(String(extracted.bedrooms).replace(/[^0-9]/g, ''), 10) : null,
        bathrooms: extracted.bathrooms ? parseFloat(String(extracted.bathrooms).replace(/[^0-9.]/g, '')) : null,
        square_footage: extracted.square_footage ? parseInt(String(extracted.square_footage).replace(/[^0-9]/g, ''), 10) : null,
        property_type: extracted.property_type || 'SINGLE_FAMILY',
        description: extracted.description,
        available_date: extracted.available_date,
        folder_id: extracted.folder_id || null,
        folder_name: extracted.folder_name || null,
        original_image_urls: JSON.stringify(photoUrls.map(function (u) { return { url: u }; })),
        _import: 'chrome-extension-v4.1.0'
      };

      var res = await fetch(EDGE_URL + '?secret=' + encodeURIComponent(SECRET), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      var resp = await res.json();

      if (resp && resp.ok) {
        if (btn) {
          btn.style.background = '#16a34a';
          var l = btn.querySelector('.cp-btn-label');
          if (l) l.textContent = '✓ Saved to Pipeline!';
        }
        setTimeout(function () {
          if (btn) {
            btn.style.background = '#6366f1';
            var l = btn.querySelector('.cp-btn-label');
            if (l) l.textContent = 'Save to Pipeline';
          }
        }, 3500);
      } else if (resp && resp.duplicate) {
        if (btn) {
          btn.style.background = '#a16207';
          var l = btn.querySelector('.cp-btn-label');
          if (l) l.textContent = 'Already in pipeline';
        }
        setTimeout(function () {
          if (btn) {
            btn.style.background = '#6366f1';
            var l = btn.querySelector('.cp-btn-label');
            if (l) l.textContent = 'Save to Pipeline';
          }
        }, 3500);
      } else {
        setError(resp && resp.error ? resp.error.slice(0, 40) : 'Server error');
      }
    } catch (e) {
      console.error('[CP] Save error:', e);
      setError('Network error');
    } finally {
      isSaving = false;
    }
  }

  function setError(msg) {
    var btn = document.getElementById('cp-save-btn');
    if (!btn) return;
    btn.style.background = '#dc2626';
    var l = btn.querySelector('.cp-btn-label');
    if (l) l.textContent = 'Failed: ' + msg;
    setTimeout(function () {
      if (btn) {
        btn.style.background = '#6366f1';
        var label = btn.querySelector('.cp-btn-label');
        if (label) label.textContent = 'Save to Pipeline';
      }
    }, 4000);
  }

  // ── Listen for messages from popup or background ────────────
  try {
    if (chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request && request.action === 'TRIGGER_SAVE') {
          handleSave();
          sendResponse({ ok: true });
        }
      });
    }
  } catch (_) {}

  // ── Initialize ──────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      injectButton();
      watchUrlChanges();
    });
  } else {
    injectButton();
    watchUrlChanges();
  }
})();
