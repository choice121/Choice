// ============================================================
// Choice Properties — Live Content Script (auto-updated)
// v4.0 — August 2026
//
// v4.0: SAVE-FIRST ARCHITECTURE
//   The property is saved to the pipeline IMMEDIATELY and the
//   user sees "Saved!" in under 2 seconds. Photos continue
//   uploading in the background with a floating progress widget.
//
//   PHOTO UPLOAD PIPELINE:
//   1. Save property → get pipeline ID (instant)
//   2. Show "Saved!" button, user can navigate away
//   3. Photos upload in background (12 concurrent)
//   4. Pipeline record is updated when all photos complete
//
//   FALLBACK CHAIN:
//   1. Background worker download (best — no CORS issues)
//   2. Direct content-script fetch (works for some CDNs)
//   3. Send source URLs to server — server tries to download
//   4. If all fail, listing still saves with source URLs for retry
// ============================================================
(function () {
  'use strict';

  // ── Config ──────────────────────────────────────────────────
  var EDGE_URL = (window.CP_CONFIG && window.CP_CONFIG.EDGE_URL) || 'https://tlfmwetmhthpyrytrcfo.supabase.co/functions/v1/receive-pipeline-import';
  var SECRET   = (window.CP_CONFIG && window.CP_CONFIG.IMPORT_SECRET) || 'cp_import_7Kx3m9P2w5';
  var VERSION  = '4.1.0-live';

  // ── SPA navigation handling ─────────────────────────────────
  var lastUrl = location.href;
  var IS_MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  var PHOTO_BATCH_SIZE = IS_MOBILE ? 4 : 12;
  var MAX_PHOTOS = IS_MOBILE ? 20 : 40;

  function isSupportedPage(url) {
    return /zillow\.com\/homedetails\//i.test(url) ||
           /realtor\.com\/realestateandhomes-detail\//i.test(url) ||
           /apartments\.com\//i.test(url) ||
           /redfin\.com\//i.test(url);
  }

  function removeButton() {
    var old = document.getElementById('cp-save-btn');
    if (old) old.remove();
  }

  function injectButton() {
    if (document.getElementById('cp-save-btn')) return;
    if (!isSupportedPage(location.href)) return;

    var btn = document.createElement('button');
    btn.id = 'cp-save-btn';
    btn.textContent = 'Save to Pipeline';
    Object.assign(btn.style, {
      position: 'fixed', bottom: 'max(24px, env(safe-area-inset-bottom))', right: 'max(24px, env(safe-area-inset-right))',
      zIndex: '2147483647',
      padding: '14px 24px', minWidth: '60px', height: '52px', background: '#6366f1',
      color: '#fff', border: 'none', borderRadius: '26px',
      fontFamily: '-apple-system, sans-serif', fontSize: '15px',
      fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 20px rgba(99,102,241,0.5)',
      touchAction: 'manipulation', userSelect: 'none', WebkitUserSelect: 'none',
      transition: 'transform 0.12s, opacity 0.12s',
    });

    // Touch/click feedback for mobile
    var onDown = function(e) {
      btn.style.transform = 'scale(0.94)';
      btn.style.opacity = '0.85';
      if (navigator.vibrate) navigator.vibrate(8);
    };
    var onUp = function() {
      btn.style.transform = '';
      btn.style.opacity = '';
    };
    btn.addEventListener('touchstart', onDown, { passive: true });
    btn.addEventListener('touchend', onUp);
    btn.addEventListener('touchcancel', onUp);
    btn.addEventListener('mousedown', onDown);
    btn.addEventListener('mouseup', onUp);
    btn.addEventListener('mouseleave', onUp);

    btn.addEventListener('click', handleSave);
    document.body.appendChild(btn);
  }

  function dispatchNavigation() {
    window.dispatchEvent(new Event('cp_navigation'));
  }

  function patchHistoryNavigation() {
    var originalPush = history.pushState;
    var originalReplace = history.replaceState;

    history.pushState = function () {
      var result = originalPush.apply(this, arguments);
      dispatchNavigation();
      return result;
    };

    history.replaceState = function () {
      var result = originalReplace.apply(this, arguments);
      dispatchNavigation();
      return result;
    };
  }

  function onLocationChange() {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    removeButton();
    setTimeout(injectButton, 250);
  }

  function watchUrlChanges() {
    patchHistoryNavigation();
    window.addEventListener('popstate', onLocationChange);
    window.addEventListener('cp_navigation', onLocationChange);

    if (document.body) {
      var observer = new MutationObserver(function () {
        onLocationChange();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  // ── Photo download + upload helpers (v4.0) ──────────────────
  function dedupePhotoUrls(urls) {
    var seen = new Set();
    var unique = [];
    if (!Array.isArray(urls)) return unique;
    urls.forEach(function(raw) {
      if (!raw) return;
      var url = typeof raw === 'string' ? raw.trim() : (raw.url || '');
      if (!url) return;
      if (!/^https?:\/\//i.test(url)) return;
      if (seen.has(url)) return;
      seen.add(url);
      unique.push(url);
    });
    return unique;
  }

  function extractPhotoUrls(raw) {
    var urls = [];
    if (!raw) return urls;
    try {
      var parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) {
        parsed.forEach(function(item) {
          if (!item) return;
          if (typeof item === 'string') urls.push(item);
          else if (typeof item === 'object' && typeof item.url === 'string') urls.push(item.url);
        });
      }
    } catch (e) {
      // ignore
    }
    return urls;
  }

  // ── Floating progress widget (v4.0) ─────────────────────────
  // Shows a small floating indicator when photos are uploading in the background
  var progressWidget = null;

  function showProgressWidget() {
    hideProgressWidget();
    progressWidget = document.createElement('div');
    progressWidget.id = 'cp-progress-widget';
    progressWidget.textContent = 'Saving property…';
    Object.assign(progressWidget.style, {
      position: 'fixed', bottom: 'max(80px, env(safe-area-inset-bottom))', right: 'max(24px, env(safe-area-inset-right))',
      zIndex: '2147483647',
      padding: '10px 18px', background: '#1e293b', color: '#e2e8f0',
      border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
      fontFamily: '-apple-system, sans-serif', fontSize: '13px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', gap: '8px',
      transition: 'opacity 0.3s',
    });
    document.body.appendChild(progressWidget);
  }

  function updateProgressWidget(text) {
    if (progressWidget) progressWidget.textContent = text;
  }

  function hideProgressWidget() {
    if (progressWidget) {
      progressWidget.remove();
      progressWidget = null;
    }
  }

  // ── v4.0: Save property first, then upload photos in background ──
  
      function escapeHtml(str){
        if(str === null || str === undefined) return '';
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
      }

      async function fetchFolders() {
        try {
          var res = await fetch('https://tlfmwetmhthpyrytrcfo.supabase.co/functions/v1/receive-pipeline-import?action=list_folders&secret=cp_import_7Kx3m9P2w5');
          var data = await res.json();
          return data.folders || [];
        } catch (e) {
          return [];
        }
      }

      async function openPreviewModal(extracted, triggerBtn) {
        var existing = document.getElementById('cp-preview-modal');
        if (existing) existing.remove();

        var folders = await fetchFolders();
        var folderOptions = '<option value="">(No folder / Main)</option>';
        folders.forEach(function(f) {
          folderOptions += '<option value="' + escapeHtml(f.id) + '">' + escapeHtml(f.name) + '</option>';
        });
        folderOptions += '<option value="__new__">+ Create new folder...</option>';

        var modal = document.createElement('div');
        modal.id = 'cp-preview-modal';
        modal.innerHTML = `
          <style>
            #cp-preview-modal { position:fixed; inset:0; z-index:2147483648; display:flex; align-items:flex-end; justify-content:center; }
            #cp-preview-modal .cp-backdrop { position:absolute; inset:0; background:rgba(0,0,0,.5); }
            #cp-preview-modal .cp-sheet { position:relative; width:100%; max-width:680px; background:#0a0f1e; color:#fff; border-radius:14px 14px 0 0; box-shadow:0 -8px 30px rgba(0,0,0,.5); padding:max(14px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) max(18px, env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left)); max-height:88vh; overflow:auto; font-family:-apple-system, sans-serif; }
            #cp-preview-modal .cp-hd { display:flex; align-items:center; gap:8px; }
            #cp-preview-modal .cp-hd h3 { margin:0; font-size:16px; font-weight:700; }
            #cp-preview-modal .cp-row { display:flex; gap:8px; margin-top:10px; }
            #cp-preview-modal .cp-row .cp-field { flex:1; display:flex; flex-direction:column; }
            #cp-preview-modal input, #cp-preview-modal select, #cp-preview-modal textarea { background:#0f1724; border:1px solid rgba(255,255,255,.06); color:#fff; padding:10px 12px; border-radius:8px; font-size:15px; min-height:44px; outline:none; }
            #cp-preview-modal textarea { min-height:84px; resize:vertical; }
            #cp-preview-modal .cp-actions { display:flex; gap:8px; margin-top:12px; }
            #cp-preview-modal .btn { padding:10px 16px; border-radius:10px; cursor:pointer; border:none; font-size:15px; min-height:44px; font-weight:bold; }
            #cp-preview-modal .btn-primary { background:#6366f1; color:#fff }
            #cp-preview-modal .btn-ghost { background:transparent; color:#cbd5e1; border:1px solid rgba(255,255,255,.04) }
          </style>
          <div class="cp-backdrop"></div>
          <div class="cp-sheet" role="dialog" aria-modal="true" aria-label="Preview listing">
            <div class="cp-hd"><h3>Preview & Edit</h3><div style="flex:1"></div><button id="cp-preview-close" class="btn btn-ghost">Close</button></div>
            <div class="cp-row">
              <div class="cp-field"><label style="font-size:12px;color:#94a3b8;margin-bottom:6px">Title</label><input id="cp-prev-title" value="${escapeHtml(extracted.title||'')}" /></div>
            </div>
            <div class="cp-row">
              <div class="cp-field"><label style="font-size:12px;color:#94a3b8;margin-bottom:6px">Address</label><input id="cp-prev-address" value="${escapeHtml(extracted.address||'')}" /></div>
              <div class="cp-field"><label style="font-size:12px;color:#94a3b8;margin-bottom:6px">City</label><input id="cp-prev-city" value="${escapeHtml(extracted.city||'')}" /></div>
            </div>
            <div class="cp-row">
              <div class="cp-field"><label style="font-size:12px;color:#94a3b8;margin-bottom:6px">State</label><input id="cp-prev-state" value="${escapeHtml(extracted.state||'')}" /></div>
              <div class="cp-field"><label style="font-size:12px;color:#94a3b8;margin-bottom:6px">ZIP</label><input id="cp-prev-zip" value="${escapeHtml(extracted.zip||'')}" /></div>
            </div>
            <div class="cp-row">
              <div class="cp-field"><label style="font-size:12px;color:#94a3b8;margin-bottom:6px">Monthly Rent</label><input id="cp-prev-rent" value="${escapeHtml(String(extracted.monthly_rent || extracted.rent || ''))}" /></div>
              <div class="cp-field"><label style="font-size:12px;color:#94a3b8;margin-bottom:6px">Bedrooms</label><input id="cp-prev-beds" value="${escapeHtml(String(extracted.bedrooms || extracted.beds || ''))}" /></div>
            </div>
            <div style="margin-top:8px" class="cp-field"><label style="font-size:12px;color:#94a3b8;margin-bottom:6px">Description</label><textarea id="cp-prev-desc">${escapeHtml(extracted.description||'')}</textarea></div>
            <div style="margin-top:8px" class="cp-field">
              <label style="font-size:12px;color:#94a3b8;margin-bottom:6px">Folder</label>
              <select id="cp-prev-folder-sel">${folderOptions}</select>
              <div id="cp-new-folder-row" style="display:none; margin-top:8px; display:flex; gap:8px;">
                 <input id="cp-new-folder-input" style="flex:1" placeholder="New folder name..." />
                 <button id="cp-create-folder-btn" class="btn btn-primary" style="background:#4ade80;color:#064e3b">Create</button>
              </div>
            </div>
            <div class="cp-actions"><button id="cp-prev-cancel" class="btn btn-ghost">Cancel</button><div style="flex:1"></div><button id="cp-prev-confirm" class="btn btn-primary">Save to Pipeline</button></div>
          </div>`;

        document.body.appendChild(modal);
        document.getElementById('cp-new-folder-row').style.display = 'none';

        var folderSel = document.getElementById('cp-prev-folder-sel');
        var newFolderRow = document.getElementById('cp-new-folder-row');
        var createBtn = document.getElementById('cp-create-folder-btn');
        var newFolderInp = document.getElementById('cp-new-folder-input');

        folderSel.addEventListener('change', function() {
          if (folderSel.value === '__new__') {
            newFolderRow.style.display = 'flex';
            newFolderInp.focus();
          } else {
            newFolderRow.style.display = 'none';
          }
        });

        createBtn.addEventListener('click', async function() {
          var name = newFolderInp.value.trim();
          if (!name) return;
          createBtn.textContent = '...';
          try {
            var res = await fetch('https://tlfmwetmhthpyrytrcfo.supabase.co/functions/v1/receive-pipeline-import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'create_folder', secret: 'cp_import_7Kx3m9P2w5', name: name })
            });
            var data = await res.json();
            if (data.ok && data.id) {
               var opt = document.createElement('option');
               opt.value = data.id;
               opt.textContent = name;
               folderSel.insertBefore(opt, folderSel.lastElementChild);
               folderSel.value = data.id;
               newFolderRow.style.display = 'none';
            }
          } catch (e) {}
          createBtn.textContent = 'Create';
        });

        function closePreviewModal() { var m = document.getElementById('cp-preview-modal'); if (m) m.remove(); }
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
          updated.description = document.getElementById('cp-prev-desc').value.trim();
          
          if (folderSel.value && folderSel.value !== '__new__') {
            updated.folder_id = folderSel.value;
            updated.folder_name = folderSel.options[folderSel.selectedIndex].text;
          }

          closePreviewModal();
          startImportProcess(updated, triggerBtn);
        });
      }

      async function handleSave() {
        var btn = document.getElementById('cp-save-btn');
        if (!btn) return;
        btn.textContent = 'Loading...';
        try {
          var extractor = window.CP_Extractors && window.CP_Extractors.detect(location.href);
          if (!extractor) { setError('Unsupported page'); return; }

          var extracted = window.CP_Extractors.extract(location.href, document);
          if (!extracted) { setError('Could not read listing'); return; }

          openPreviewModal(extracted, btn);
        } catch (e) {
          setError('Extraction error');
        }
      }

      async function startImportProcess(extracted, triggerBtn) {
        var btn = triggerBtn || document.getElementById('cp-save-btn');
        btn.textContent = 'Saving...';
        btn.style.background = '#818cf8';
        btn.disabled = true;

        try {
          var photoUrls = extractPhotoUrls(extracted.original_image_urls);
          if (!photoUrls.length && Array.isArray(extracted.photo_urls)) {
            extracted.photo_urls.forEach(function(u) { if (typeof u === 'string') photoUrls.push(u); });
          }

          var payload = {
            source: extracted.source,
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
            folder_id: extracted.folder_id,
            folder_name: extracted.folder_name,
            original_image_urls: JSON.stringify(photoUrls.map(function(u) { return { url: u }; })),
            _import: 'browser-extension-v4.1.0-modal',
          };

          var direct = await fetch(EDGE_URL + '?secret=' + encodeURIComponent(SECRET), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          var resp = await direct.json();

          if (resp && resp.ok) {
            btn.textContent = 'Saved! Photos uploading in background.';
            btn.style.background = '#16a34a';
            
            setTimeout(function () { btn.remove(); }, 3000);
          } else if (resp && resp.duplicate) {
            btn.textContent = 'Already in pipeline';
            btn.style.background = '#a16207';
            setTimeout(function () { btn.remove(); }, 3000);
          } else {
            setError(resp && resp.error ? resp.error.slice(0, 40) : 'Server error');
          }
        } catch (e) {
          setError('Network error');
        }
      }

function setError(msg) {
    var btn = document.getElementById('cp-save-btn');
    if (!btn) return;
    btn.textContent = 'Failed: ' + msg;
    btn.style.background = '#dc2626';
    btn.disabled = false;
    setTimeout(function () {
      if (btn) { btn.textContent = 'Save to Pipeline'; btn.style.background = '#6366f1'; }
    }, 4000);
  }

  // ── Init ────────────────────────────────────────────────────
  injectButton();
  watchUrlChanges();
})();