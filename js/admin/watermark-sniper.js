(function(){
  'use strict';

  function readyDeps(){
    return window.CP && CP.sb && (window.AdminShell || window.CPShell || CP.Auth);
  }

  function waitReady(ms){
    return new Promise((res) => {
      const start = Date.now();
      (function tick(){
        if(readyDeps()) return res();
        if(Date.now() - start > ms) {
          console.warn('[watermark-sniper] Dependencies took longer than expected, proceeding with available globals.');
          return res();
        }
        setTimeout(tick, 50);
      })();
    });
  }

  let S = null;

  // ─── State Management ──────────────────────────────────────────────────────
  let currentPage = 1;
  let pageSize = 48; // Optimized for 2, 3, 4, 6 column layouts
  let totalProperties = 0;
  let totalPages = 1;

  let filterState = '';
  let filterCity = '';
  let filterType = '';
  let filterDate = 'all';
  let filterCompliance = 'all';
  let searchQuery = '';

  let filterOptions = null;
  let currentCatalog = [];       // Rows for the current page
  let currentImages = [];        // Image objects for current page
  const queuedProperties = new Map(); // id -> { id, title, address, city, state, zip, coverUrl, photoCount, reason, photoFileId }

  let similarityPrioritized = true;
  let activeSimilarityProfile = null;
  let scannedViolations = [];

  // ─── Scope, Batch Moderation & 24h Recovery State ─────────────────────────
  let sniperMode = 'public'; // 'public' | 'private'
  let isBatchMode = false;
  let batchId = null;
  let shareToken = null;
  let shareId = null;
  let deepLinkPropertyId = null;
  let batchScope = null;
  let batchData = null;
  let batchProperties = [];
  let batchPhotos = [];
  let batchRecoverable = [];
  let privateCollectionsCache = null;
  let selectedBatchPropId = '';
  let activeInspectedPhoto = null;
  let activeInspectedProperty = null;
  let isEdgeContain = false;
  let activeSidebarTab = 'inspector';
  let trashCountdownTimer = null;
  let pendingDeletePhoto = null;
  let pendingDeleteListing = null;
  let toggleSidebarRef = null;

  // ─── URL Signature Helpers ────────────────────────────────────────────────
  function extractUrlSignature(url){
    if(!url || typeof url !== 'string') return '';
    try {
      const u = new URL(url, 'https://choice-properties.internal');
      const parts = u.pathname.split('/').filter(Boolean);
      const folder = parts.slice(0, -1).join('/');
      return folder || parts[0] || '';
    } catch(_) {
      return '';
    }
  }

  function tokenizeProperty(p){
    const str = `${p.title || ''} ${p.address || ''} ${p.city || ''} ${p.state || ''} ${p.landlord_id || ''}`.toLowerCase();
    const words = str.split(/[\s,.\-_/]+/).filter(w => w.length > 2);
    return new Set(words);
  }

  function getThumbUrl(rawUrl, size = 'medium'){
    if(!rawUrl || typeof rawUrl !== 'string') return '';
    if(rawUrl.includes('ik.imagekit.io')){
      const clean = rawUrl.replace(/\?tr=[^&]+/, '').split('?')[0];
      if(size === 'compact') {
        return clean + '?tr=w-320,h-220,c-maintain_ratio,q-75,f-webp';
      } else if(size === 'large') {
        return clean + '?tr=w-640,h-440,c-maintain_ratio,q-85,f-webp';
      }
      // Medium default
      return clean + '?tr=w-480,h-320,c-maintain_ratio,q-80,f-webp';
    }
    if(window.CONFIG && typeof CONFIG.img === 'function'){
      return CONFIG.img(rawUrl, 'thumb');
    }
    return rawUrl;
  }

  function getSmallThumb(rawUrl){
    if(!rawUrl || typeof rawUrl !== 'string') return '';
    if(rawUrl.includes('ik.imagekit.io')){
      const clean = rawUrl.replace(/\?tr=[^&]+/, '').split('?')[0];
      return clean + '?tr=w-90,h-90,c-maintain_ratio,q-60,f-webp';
    }
    return rawUrl;
  }

  function escSafe(str){
    if(S && typeof S.esc === 'function') return S.esc(str);
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toastSafe(msg, type = 'info', duration = 3500){
    if(S && typeof S.toast === 'function'){
      S.toast(msg, type, duration);
    } else {
      console.log(`[toast:${type}]`, msg);
    }
  }

  function setLoading(visible, text = 'Querying property inventory…'){
    const loadingEl = document.getElementById('sniper-loading');
    const loadingTxt = document.getElementById('sniper-loading-txt');
    if(!loadingEl) return;
    if(visible){
      if(loadingTxt) loadingTxt.textContent = text;
      loadingEl.style.display = 'flex';
    } else {
      loadingEl.style.display = 'none';
    }
  }

  // ─── Filter Options Loader (Scoped to Public Active Inventory) ────────────
  async function loadFilterOptions(){
    try {
      const { data, error } = await CP.sb().rpc('get_watermark_sniper_filter_options', {
        p_status: 'active'
      });
      if(error) throw error;
      if(!data) return;

      filterOptions = data;

      // 1. Update Global Total Stat Pill
      const totalInventory = data.total_properties || 0;
      const totalCatalogEl = document.getElementById('stat-total-catalog');
      if(totalCatalogEl) {
        totalCatalogEl.textContent = totalInventory.toLocaleString();
      }

      // 2. Populate States Dropdown
      const stateSelect = document.getElementById('sniper-state-select');
      if(stateSelect && Array.isArray(data.states)){
        const curVal = stateSelect.value || '';
        stateSelect.innerHTML = `<option value="">All States (${data.states.length})</option>`;
        data.states.forEach(st => {
          if(!st) return;
          const opt = document.createElement('option');
          opt.value = st;
          opt.textContent = st;
          if(st === curVal) opt.selected = true;
          stateSelect.appendChild(opt);
        });
      }

      // 3. Populate Cities Dropdown
      populateCitiesDropdown();

      // 4. Populate Property Types Dropdown
      const typeSelect = document.getElementById('sniper-type-select');
      if(typeSelect && Array.isArray(data.property_types)){
        const curVal = typeSelect.value || '';
        typeSelect.innerHTML = '<option value="">All Property Types</option>';
        data.property_types.forEach(pt => {
          if(!pt) return;
          const opt = document.createElement('option');
          opt.value = pt;
          opt.textContent = pt;
          if(pt === curVal) opt.selected = true;
          typeSelect.appendChild(opt);
        });
      }

      // 5. Update Photo Compliance Dropdown with actual counts
      const compSelect = document.getElementById('sniper-compliance-select');
      if(compSelect){
        const zeroCnt = data.zero_photos_count || 0;
        const under6Cnt = data.under_6_photos_count || 0;
        const flaggedCnt = data.flagged_photos_count || 0;

        const optZero = compSelect.querySelector('option[value="zero_photos"]');
        if(optZero) optZero.textContent = `⚠️ 0 Photos (Missing) (${zeroCnt.toLocaleString()})`;

        const optUnder6 = compSelect.querySelector('option[value="under_6_photos"]');
        if(optUnder6) optUnder6.textContent = `⚠️ < 6 Photos (Policy) (${under6Cnt.toLocaleString()})`;

        const optFlagged = compSelect.querySelector('option[value="flagged_only"]');
        if(optFlagged) optFlagged.textContent = `🚨 Flagged (${flaggedCnt.toLocaleString()})`;
      }

    } catch(err){
      console.warn('[watermark-sniper] Could not load dynamic filter options:', err);
    }
  }

  function populateCitiesDropdown(){
    const citySelect = document.getElementById('sniper-city-select');
    if(!citySelect || !filterOptions) return;

    const curVal = citySelect.value || '';
    let citiesList = [];

    if(filterState && filterOptions.cities_by_state && filterOptions.cities_by_state[filterState]){
      citiesList = filterOptions.cities_by_state[filterState];
    } else if(Array.isArray(filterOptions.all_cities)){
      citiesList = filterOptions.all_cities;
    }

    citySelect.innerHTML = `<option value="">All Cities (${citiesList.length})</option>`;
    citiesList.forEach(c => {
      if(!c) return;
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      if(c === curVal) opt.selected = true;
      citySelect.appendChild(opt);
    });
  }

  // ─── Loading States ────────────────────────────────────────────────────────
  function setPagingState(isPaging){
    const loadingBar = document.getElementById('sniper-grid-loading-bar');
    const grid = document.getElementById('sniper-grid');
    if(loadingBar) loadingBar.style.display = isPaging ? 'block' : 'none';
    if(grid) {
      grid.style.opacity = isPaging ? '0.6' : '1';
      grid.style.pointerEvents = isPaging ? 'none' : 'auto';
    }
  }

  // ─── Catalog Loader (Database-Driven Dynamic Pagination) ───────────────────
  async function loadPage(pageIndex){
    if(pageIndex < 1) pageIndex = 1;
    currentPage = pageIndex;

    const viewport = document.getElementById('sniper-grid-viewport');
    if(viewport){
      viewport.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const isInitialOrFilter = currentCatalog.length === 0;
    if(isInitialOrFilter){
      setLoading(true, `Querying page ${currentPage} of property inventory…`);
    } else {
      setPagingState(true);
    }

    const offset = (currentPage - 1) * pageSize;

    const rpcParams = {
      p_limit: pageSize,
      p_offset: offset,
      p_state: filterState ? filterState : null,
      p_city: filterCity ? filterCity : null,
      p_property_type: filterType ? filterType : null,
      p_photo_status: filterCompliance !== 'all' ? filterCompliance : null,
      p_date_filter: filterDate !== 'all' ? filterDate : null,
      p_date_from: null,
      p_date_to: null,
      p_search: searchQuery ? searchQuery.trim() : null,
      p_status: 'active'
    };

    try {
      let data = null;
      let error = null;

      try {
        const res = await CP.sb().rpc('get_watermark_sniper_catalog', rpcParams);
        data = res.data;
        error = res.error;
      } catch(rpcErr){
        error = rpcErr;
      }

      // Direct Supabase fallback if RPC ever errors
      if(error || !Array.isArray(data)){
        console.warn('[watermark-sniper] RPC call failed, trying direct Supabase fallback query:', error);
        let q = CP.sb().from('properties').select('id, address, city, state, zip, monthly_rent, bedrooms, bathrooms, square_footage, property_type, landlord_id, status, created_at, updated_at, property_photos(id, url, file_id, display_order, watermark_status, is_hero)', { count: 'exact' }).eq('status', 'active');
        if(filterState) q = q.eq('state', filterState);
        if(filterCity) q = q.eq('city', filterCity);
        if(filterType) q = q.eq('property_type', filterType);
        if(searchQuery){
          q = q.or(`address.ilike.%${searchQuery}%,city.ilike.%${searchQuery}%,zip.ilike.%${searchQuery}%`);
        }

        q = q.order('updated_at', { ascending: false }).range(offset, offset + pageSize - 1);
        const fbRes = await q;
        if(fbRes.error) throw fbRes.error;
        data = (fbRes.data || []).map(r => {
          const photos = Array.isArray(r.property_photos) ? r.property_photos : [];
          const sortedPhotos = photos.slice().sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999));
          const firstPhoto = sortedPhotos[0];
          const hasFlagged = sortedPhotos.some(p => ['branding', 'watermark', 'flagged'].includes(p.watermark_status));
          return {
            ...r,
            total_count: fbRes.count || 0,
            photo_count: sortedPhotos.length,
            photo_url: firstPhoto?.url || null,
            photo_id: firstPhoto?.id || null,
            photo_file_id: firstPhoto?.file_id || null,
            cover_url: firstPhoto?.url || null,
            has_flagged_photo: hasFlagged
          };
        });
      }

      currentCatalog = Array.isArray(data) ? data : [];
      currentImages = [];

      if(currentCatalog.length > 0){
        totalProperties = Number(currentCatalog[0].total_count || 0);
      } else {
        // If current page exceeded total pages due to filter changes, reset to page 1
        if(currentPage > 1){
          currentPage = 1;
          return loadPage(1);
        }
        totalProperties = 0;
      }

      totalPages = Math.max(1, Math.ceil(totalProperties / pageSize));

      // Build image objects for current page
      currentCatalog.forEach(row => {
        row.tokenSet = tokenizeProperty(row);
        if(row.photo_url || row.cover_url){
          const targetUrl = row.photo_url || row.cover_url;
          const imgObj = {
            id: row.photo_id || row.id,
            url: targetUrl,
            file_id: row.photo_file_id || null,
            propertyId: row.id,
            property: row,
            hasFlaggedPhoto: !!row.has_flagged_photo,
            urlSignature: extractUrlSignature(targetUrl),
            similarityScore: 0
          };
          currentImages.push(imgObj);
        }
      });

      renderGrid();
      updatePaginationControls();
      updateStagePageButtonState();
      recalculateSimilarities();

    } catch(err){
      console.error('[watermark-sniper] Error fetching catalog page:', err);
      toastSafe('Failed to load inventory: ' + (err.message || 'Network error'), 'error');
      renderGridEmpty('Error loading properties. Please check your connection and retry.');
    } finally {
      setLoading(false);
      setPagingState(false);
    }
  }

  // ─── Stage Page Toggle ────────────────────────────────────────────────────
  function toggleStagePage(){
    if(currentCatalog.length === 0) return;
    const allStaged = currentCatalog.every(p => queuedProperties.has(p.id));

    if(allStaged){
      currentCatalog.forEach(p => {
        if(queuedProperties.has(p.id)){
          toggleStage(p);
        }
      });
      toastSafe('Unstaged all listings on current page.', 'info');
    } else {
      currentCatalog.forEach(p => {
        if(!queuedProperties.has(p.id)){
          toggleStage(p);
        }
      });
      toastSafe(`Staged all ${currentCatalog.length} listings on current page.`, 'success');
    }

    updateStagePageButtonState();
  }

  function updateStagePageButtonState(){
    const btn = document.getElementById('sniper-btn-stage-page');
    const txt = document.getElementById('sniper-stage-page-txt');
    if(!btn || !txt) return;

    if(currentCatalog.length === 0){
      btn.disabled = true;
      txt.textContent = 'Stage Page';
      btn.classList.remove('all-staged');
      return;
    }

    btn.disabled = false;
    const allStaged = currentCatalog.every(p => queuedProperties.has(p.id));
    if(allStaged){
      btn.classList.add('all-staged');
      txt.textContent = 'Unstage Page';
    } else {
      btn.classList.remove('all-staged');
      txt.textContent = `Stage Page (${currentCatalog.length})`;
    }
  }

  // ─── Grid Rendering ────────────────────────────────────────────────────────
  function renderGrid(){
    const grid = document.getElementById('sniper-grid');
    if(!grid) return;
    grid.innerHTML = '';

    if(currentCatalog.length === 0){
      renderGridEmpty('No properties match your filter criteria. Try adjusting or resetting your filters.');
      return;
    }

    currentCatalog.forEach(p => {
      const isStaged = queuedProperties.has(p.id);
      const photoCount = Number(p.photo_count || 0);
      const isZeroPhotos = photoCount === 0;

      const card = document.createElement('div');
      card.className = 'sniper-card' + (isStaged ? ' staged' : '') + (isZeroPhotos ? ' zero-photos' : '');
      card.id = `prop-card-${p.id}`;
      card.dataset.propId = p.id;
      card.tabIndex = 0;

      let mediaHtml = '';
      if(isZeroPhotos){
        mediaHtml = `
          <div class="sniper-card-media-wrap">
            <div class="sniper-zero-photos-body">
              <svg class="sniper-zero-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
              <div class="sniper-zero-title">No Photos Available</div>
              <div class="sniper-zero-sub">Listing has 0 photos uploaded</div>
              <div class="sniper-zero-badge">Missing Media Violation</div>
            </div>
            <div class="sniper-card-top-badges">
              <div class="sniper-stage-checkbox" aria-label="Toggle staging">
                <svg style="width:16px;height:16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div class="sniper-card-top-right-badges">
                <span class="sniper-badge-photo-count alert">❌ 0 photos</span>
              </div>
            </div>
          </div>
        `;
      } else {
        const displayPhotoUrl = getThumbUrl(p.photo_url || p.cover_url || '');
        const hasFlag = !!p.has_flagged_photo;
        const isPolicyAlert = photoCount < 6;

        let badgeHtml = '';
        if(hasFlag){
          badgeHtml += '<span class="sniper-badge-flagged">🚨 Flagged</span>';
        }
        if(isPolicyAlert){
          badgeHtml += `<span class="sniper-badge-photo-count alert" title="Choice Properties policy requires minimum 6 photos">⚠️ ${photoCount} photos</span>`;
        } else {
          badgeHtml += `<span class="sniper-badge-photo-count">📷 ${photoCount} photos</span>`;
        }

        mediaHtml = `
          <div class="sniper-card-media-wrap">
            <div class="sniper-card-media">
              <img class="sniper-card-img" src="${displayPhotoUrl}" alt="${escSafe(p.address)}" referrerpolicy="no-referrer" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
              <div class="sniper-error-fallback" style="display:none">
                <svg class="sniper-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                <div class="sniper-error-txt">Photo Unavailable</div>
              </div>
            </div>
            <div class="sniper-card-top-badges">
              <div class="sniper-stage-checkbox" aria-label="Toggle staging">
                <svg style="width:16px;height:16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div class="sniper-card-top-right-badges">
                ${badgeHtml}
              </div>
            </div>
          </div>
        `;
      }

      let bedBathTxt = '';
      if(p.bedrooms != null && p.bathrooms != null){
        bedBathTxt = `<span class="sniper-card-beds">${p.bedrooms}b / ${p.bathrooms}ba</span>`;
      } else if(p.bedrooms != null){
        bedBathTxt = `<span class="sniper-card-beds">${p.bedrooms} bed</span>`;
      }

      const footerHtml = `
        <div class="sniper-card-footer">
          <div class="sniper-card-title-row">
            <div class="sniper-card-address" title="${escSafe(p.address)}">${escSafe(p.address || 'Unknown Address')}</div>
            <div class="sniper-card-title-actions">
              <button type="button" class="sniper-card-inspect-btn" title="Inspect all photos & edge watermarks of this listing" aria-label="Inspect photos">
                <span>Photos</span>
              </button>
              <a href="/property.html?id=${encodeURIComponent(p.id)}" target="_blank" rel="noopener noreferrer" class="sniper-card-ext-btn" title="Open listing in new tab" aria-label="Open listing">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
            </div>
          </div>
          <div class="sniper-card-city">${escSafe(p.city || '')}${p.state ? ', ' + escSafe(p.state) : ''} ${escSafe(p.zip || '')}</div>
          <div class="sniper-card-bottom-row">
            <span class="sniper-card-price">${p.monthly_rent ? '$' + Number(p.monthly_rent).toLocaleString() + '/mo' : 'Contact for Rent'}</span>
            <div class="sniper-card-pills">
              ${bedBathTxt}
              <span class="sniper-card-type">${escSafe(p.property_type || 'Listing')}</span>
            </div>
          </div>
        </div>
      `;

      card.innerHTML = mediaHtml + footerHtml;

      // Inspect button opens single-property Photo Sniper view directly
      const inspectBtn = card.querySelector('.sniper-card-inspect-btn');
      if(inspectBtn){
        inspectBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          loadBatchMode({ pPropertyId: p.id, pScope: 'public' });
        });
      }

      // Card Click Handler (stages/unstages listing)
      card.addEventListener('click', (e) => {
        if(e.target.closest('.sniper-card-ext-btn') || e.target.closest('.sniper-card-inspect-btn')) return;
        e.preventDefault();
        toggleStage(p);
      });

      // Keyboard space/enter handler
      card.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          toggleStage(p);
        }
      });

      // External link click prevention
      const extLink = card.querySelector('.sniper-card-ext-btn');
      if(extLink){
        extLink.addEventListener('click', (e) => e.stopPropagation());
      }

      grid.appendChild(card);
    });
  }

  function renderGridEmpty(msg){
    const grid = document.getElementById('sniper-grid');
    if(!grid) return;
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; text-align: center; color: var(--sniper-text-muted);">
        <svg style="width: 48px; height: 48px; opacity: 0.3; margin-bottom: 16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <h3 style="font-size: 1.1rem; color: #fff; margin: 0 0 8px;">No Listings Found</h3>
        <p style="font-size: 0.875rem; max-width: 400px; margin: 0 0 16px;">${escSafe(msg)}</p>
        <button id="sniper-empty-reset-btn" style="padding: 8px 16px; background: var(--sniper-surface-2); border: 1px solid var(--sniper-border); border-radius: 6px; color: #fff; font-size: 0.8125rem; font-weight: 600; cursor: pointer;">Reset Filters</button>
      </div>
    `;
    const resetBtn = document.getElementById('sniper-empty-reset-btn');
    if(resetBtn){
      resetBtn.addEventListener('click', resetAllFilters);
    }
  }

  // ─── Scope & Mode Switcher (Public vs Private Placements) ──────────────────
  function syncModeStripUI(){
    const tabPub = document.getElementById('mode-tab-public');
    const tabPriv = document.getElementById('mode-tab-private');
    const picker = document.getElementById('sniper-private-picker');
    if(tabPub) tabPub.classList.toggle('active', sniperMode === 'public');
    if(tabPriv) tabPriv.classList.toggle('active', sniperMode === 'private');
    if(picker) picker.style.display = sniperMode === 'private' ? 'block' : 'none';
  }

  function toggleCatalogFilterControls(showFullCatalogFilters){
    const row = document.getElementById('sniper-filters-row');
    if(!row) return;
    Array.from(row.children).forEach(el => {
      const keepInBatch = el.classList.contains('sniper-search-box')
        || el.classList.contains('sniper-density-toggle')
        || el.classList.contains('sniper-btn-focus');
      if(showFullCatalogFilters || keepInBatch){
        el.style.display = '';
      } else {
        el.style.display = 'none';
      }
    });
  }

  async function loadPrivateCollections(forceRefresh = false){
    const select = document.getElementById('sniper-private-source-select');
    if(privateCollectionsCache && !forceRefresh){
      return privateCollectionsCache;
    }
    try {
      const { data, error } = await CP.sb().rpc('get_private_placement_batches_for_sniper');
      if(error) throw error;
      if(!data || !data.ok) throw new Error(data?.error || 'Could not load private placements');

      privateCollectionsCache = data;

      // Sync global 24h recoverable count early
      const totalRec = Number(data.total_recoverable || 0);
      if(!isBatchMode){
        const stripTrash = document.getElementById('strip-trash-count');
        const sidebarTrash = document.getElementById('sidebar-trash-count');
        const statTrash = document.getElementById('stat-trash-count');
        if(stripTrash) stripTrash.textContent = totalRec;
        if(sidebarTrash) sidebarTrash.textContent = totalRec;
        if(statTrash) statTrash.textContent = totalRec;
      }

      if(select){
        const curVal = select.value;
        select.innerHTML = '';

        const allOpt = document.createElement('option');
        allOpt.value = 'scope:private_placement';
        allOpt.textContent = `All Private Placements (${data.total_private_properties || 0} props · ${data.total_private_photos || 0} photos)`;
        select.appendChild(allOpt);

        const batches = Array.isArray(data.batches) ? data.batches : [];
        if(batches.length){
          const grpB = document.createElement('optgroup');
          grpB.label = `Publishing Batches (${batches.length})`;
          batches.forEach(b => {
            const opt = document.createElement('option');
            opt.value = `batch:${b.batch_id}`;
            const recNote = b.recoverable_count > 0 ? ` · ${b.recoverable_count} in trash` : '';
            opt.textContent = `${b.batch_id} · ${b.target_market || 'Private Batch'} (${b.property_count} props · ${b.photo_count} photos${recNote})`;
            grpB.appendChild(opt);
          });
          select.appendChild(grpB);
        }

        const shares = Array.isArray(data.shares) ? data.shares : [];
        if(shares.length){
          const grpS = document.createElement('optgroup');
          grpS.label = `Curated Client Magic Links (${shares.length})`;
          shares.forEach(s => {
            const opt = document.createElement('option');
            opt.value = `share_id:${s.share_id}`;
            const label = s.share_alias || s.target_market || s.sample_market || 'Client Magic Link';
            const batchHint = s.pub_batch_id ? ` · ${s.pub_batch_id}` : '';
            opt.textContent = `${label} (${s.property_count} props · ${s.photo_count} photos${batchHint})`;
            grpS.appendChild(opt);
          });
          select.appendChild(grpS);
        }

        if(curVal && Array.from(select.options).some(o => o.value === curVal)){
          select.value = curVal;
        }
      }
      return data;
    } catch(err){
      console.warn('[watermark-sniper] Could not load private placement collections:', err);
      if(select && select.options.length <= 1){
        select.innerHTML = '<option value="scope:private_placement">All Private Placements</option>';
      }
      return null;
    }
  }

  function syncPrivatePickerSelection(){
    const select = document.getElementById('sniper-private-source-select');
    if(!select) return;
    const candidates = [];
    if(shareId) candidates.push(`share_id:${shareId}`);
    if(batchId) candidates.push(`batch:${batchId}`);
    if(batchScope === 'private_placement') candidates.push('scope:private_placement');

    for(const val of candidates){
      if(Array.from(select.options).some(o => o.value === val)){
        select.value = val;
        return;
      }
    }
    if(shareToken){
      const existing = select.querySelector('option[data-dynamic-share="1"]');
      if(existing) existing.remove();
      const opt = document.createElement('option');
      opt.value = `share_token:${shareToken}`;
      opt.dataset.dynamicShare = '1';
      opt.textContent = `Active Magic Link (${batchProperties.length} props · ${batchPhotos.length} photos)`;
      select.insertBefore(opt, select.firstChild);
      select.value = opt.value;
    }
  }

  async function switchSniperMode(mode, opts = {}){
    if(mode === 'public'){
      sniperMode = 'public';
      isBatchMode = false;
      batchId = null;
      shareToken = null;
      shareId = null;
      deepLinkPropertyId = null;
      batchScope = null;
      selectedBatchPropId = '';
      activeInspectedPhoto = null;
      activeInspectedProperty = null;

      syncModeStripUI();
      toggleCatalogFilterControls(true);
      toggleEdgeContainMode(false);

      const batchBanner = document.getElementById('sniper-batch-banner');
      if(batchBanner) batchBanner.style.display = 'none';

      const topPaging = document.getElementById('sniper-pagination-top');
      const bottomPaging = document.getElementById('sniper-pagination-bottom');
      if(topPaging) topPaging.style.display = '';
      if(bottomPaging) bottomPaging.style.display = '';

      const modePill = document.getElementById('sniper-mode-pill');
      if(modePill) modePill.textContent = 'Public Inventory';
      const invLabel = document.getElementById('stat-inventory-label');
      if(invLabel) invLabel.textContent = 'Public:';
      const photosCountEl = document.getElementById('stat-photos-catalog');
      if(photosCountEl) photosCountEl.style.display = 'none';

      if(window.history && window.history.replaceState){
        window.history.replaceState(null, '', '/admin/watermark-sniper.html?scope=public');
      }

      await loadFilterOptions();
      await loadPage(1);
      await fetchRecoverableTrash();
      startTrashTimer();
      return;
    }

    // Switch to Private Placements mode
    sniperMode = 'private';
    syncModeStripUI();
    const collections = await loadPrivateCollections();
    const targetBatch = opts.batchId || (collections?.batches?.[0]?.batch_id) || null;
    const targetShareId = opts.shareId || (!targetBatch ? collections?.shares?.[0]?.share_id : null) || null;

    await loadBatchMode({
      pBatchId: targetBatch,
      pShareId: targetShareId,
      pScope: (!targetBatch && !targetShareId) ? 'private_placement' : null
    });
  }

  // ─── Batch Mode Loader & Gallery Controller ────────────────────────────────
  async function loadBatchMode(arg1, arg2, arg3, arg4, arg5){
    const opts = (arg1 && typeof arg1 === 'object' && !Array.isArray(arg1))
      ? arg1
      : {
          pBatchId: arg1 || null,
          pShareToken: arg2 || null,
          pShareId: arg3 || null,
          pPropertyId: arg4 || null,
          pScope: arg5 || null
        };

    isBatchMode = true;
    batchId = opts.pBatchId || null;
    shareToken = opts.pShareToken || null;
    shareId = opts.pShareId || null;
    deepLinkPropertyId = opts.pPropertyId || null;
    batchScope = opts.pScope || null;
    sniperMode = (batchScope === 'public') ? 'public' : 'private';
    selectedBatchPropId = '';

    syncModeStripUI();
    if(sniperMode === 'private'){
      loadPrivateCollections().catch(() => {});
    }

    setLoading(true, 'Querying photos, edges & parent listings…');

    try {
      const { data, error } = await CP.sb().rpc('get_batch_photos_for_sniper', {
        p_batch_id: batchId,
        p_share_token: shareToken,
        p_share_id: shareId,
        p_property_id: deepLinkPropertyId,
        p_scope: batchScope
      });

      if(error) throw error;
      if(!data || !data.ok){
        throw new Error(data?.error || 'Failed to load batch records');
      }

      batchData = data;
      batchProperties = Array.isArray(data.properties) ? data.properties : [];
      batchPhotos = Array.isArray(data.photos) ? data.photos : [];
      batchRecoverable = Array.isArray(data.recoverable) ? data.recoverable : [];

      if(data.batch_id && !batchId) batchId = data.batch_id;
      if(data.share_id && !shareId) shareId = data.share_id;

      // 1. Update Topbar Indicators
      const modePill = document.getElementById('sniper-mode-pill');
      if(modePill){
        modePill.textContent = sniperMode === 'public' ? 'Listing Photo Audit' : 'Private Placement Sniper';
      }

      const invLabel = document.getElementById('stat-inventory-label');
      if(invLabel) invLabel.textContent = sniperMode === 'public' ? 'Listing:' : 'Batch:';

      const invCount = document.getElementById('stat-total-catalog');
      if(invCount) invCount.textContent = `${batchProperties.length} listings`;

      const photosCountEl = document.getElementById('stat-photos-catalog');
      if(photosCountEl){
        photosCountEl.textContent = `(${batchPhotos.length} photos)`;
        photosCountEl.style.display = 'inline';
      }

      const trashStatBtn = document.getElementById('sniper-trash-stat');
      const trashCountEl = document.getElementById('stat-trash-count');
      if(trashStatBtn && trashCountEl){
        trashStatBtn.style.display = 'inline-flex';
        trashCountEl.textContent = batchRecoverable.length;
      }

      // 2. Setup Batch Banner
      const batchBanner = document.getElementById('sniper-batch-banner');
      const batchIdText = document.getElementById('sniper-batch-id-text');
      const batchMarketBadge = document.getElementById('sniper-batch-market-badge');
      const batchCountsText = document.getElementById('sniper-batch-counts');
      const batchTrashPill = document.getElementById('batch-trash-pill-count');

      const info = data.batch_info || {};
      if(batchBanner) batchBanner.style.display = 'flex';
      if(batchIdText){
        if(data.mode === 'property' && batchProperties[0]){
          batchIdText.textContent = batchProperties[0].address || batchProperties[0].id;
        } else if(batchId){
          batchIdText.textContent = batchId;
        } else if(info.share_alias){
          batchIdText.textContent = info.share_alias;
        } else if(shareToken || shareId){
          batchIdText.textContent = 'Curated Magic Link';
        } else {
          batchIdText.textContent = 'All Private Placements';
        }
      }
      if(batchMarketBadge){
        const market = info.target_market || info.share_alias || (data.mode === 'property' && batchProperties[0]?.status === 'active' ? 'Public Active Listing' : 'Private Placement');
        batchMarketBadge.textContent = market;
      }
      if(batchCountsText){
        batchCountsText.textContent = `${batchProperties.length} propert${batchProperties.length === 1 ? 'y' : 'ies'} · ${batchPhotos.length} total photos`;
      }
      if(batchTrashPill){
        batchTrashPill.textContent = batchRecoverable.length;
      }

      // 3. Populate Property Selector Dropdown inside Batch
      const batchPropSelect = document.getElementById('sniper-batch-prop-select');
      if(batchPropSelect){
        batchPropSelect.innerHTML = `<option value="">All Properties in List (${batchProperties.length})</option>`;
        batchProperties.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = `${p.address || p.id} (${p.photo_count || 0} photos · $${Number(p.monthly_rent || 0).toLocaleString()}/mo)`;
          batchPropSelect.appendChild(opt);
        });
      }

      syncPrivatePickerSelection();

      // 4. Enforce Edge Contain Mode by default so watermarks on edges stand out
      toggleEdgeContainMode(true);

      // 5. Hide catalog-only filters & pagination in photo-inspection grid
      toggleCatalogFilterControls(false);
      const topPaging = document.getElementById('sniper-pagination-top');
      const bottomPaging = document.getElementById('sniper-pagination-bottom');
      if(topPaging) topPaging.style.display = 'none';
      if(bottomPaging) bottomPaging.style.display = 'none';

      // 6. Render all photos with uncropped edges
      renderBatchGrid();

      // 7. Render 24h Recoverable Trash and start live countdown
      renderTrashList();
      startTrashTimer();

      // 8. Inspector / Drawer UX: desktop opens side-by-side; mobile stays clear for browsing unless explicitly requested
      const requestedTab = opts.autoOpenTab;
      const isMobile = window.innerWidth <= 900;
      if(requestedTab === 'trash'){
        switchSidebarTab('trash');
        if(toggleSidebarRef) toggleSidebarRef(true);
      } else if(deepLinkPropertyId && batchPhotos.length > 0){
        const firstPhoto = batchPhotos.find(p => p.property_id === deepLinkPropertyId) || batchPhotos[0];
        selectPhotoForInspection(firstPhoto, !isMobile || requestedTab === 'inspector');
      } else {
        switchSidebarTab('inspector');
        if(toggleSidebarRef) toggleSidebarRef(!isMobile);
      }

      toastSafe(`Loaded ${batchProperties.length} propert${batchProperties.length === 1 ? 'y' : 'ies'} · ${batchPhotos.length} photos (Edges Clear).`, 'success', 3500);

    } catch(err){
      console.error('[watermark-sniper] Error loading batch mode:', err);
      toastSafe('Failed to load photos: ' + (err.message || 'Unknown error'), 'error', 6000);
      renderGridEmpty('Could not load photos. Ensure you are signed in as admin and try again.');
    } finally {
      setLoading(false);
    }
  }

  // ─── Batch Grid Renderer ──────────────────────────────────────────────────
  function renderBatchGrid(){
    const grid = document.getElementById('sniper-grid');
    if(!grid) return;
    grid.innerHTML = '';

    // Filter photos if a specific property is selected or search query entered
    let filteredPhotos = batchPhotos;
    if(selectedBatchPropId){
      filteredPhotos = filteredPhotos.filter(p => p.property_id === selectedBatchPropId);
    }
    if(searchQuery){
      const q = searchQuery.toLowerCase().trim();
      filteredPhotos = filteredPhotos.filter(p => {
        const full = `${p.address || ''} ${p.city || ''} ${p.state || ''} ${p.zip || ''} ${p.property_id || ''}`.toLowerCase();
        return full.includes(q);
      });
    }

    // Also collect zero-photo properties matching current filter so admin can still inspect & delete them
    let zeroPhotoProps = batchProperties.filter(p => Number(p.photo_count || 0) === 0);
    if(selectedBatchPropId){
      zeroPhotoProps = zeroPhotoProps.filter(p => p.id === selectedBatchPropId);
    }
    if(searchQuery){
      const q = searchQuery.toLowerCase().trim();
      zeroPhotoProps = zeroPhotoProps.filter(p => `${p.address || ''} ${p.city || ''} ${p.state || ''} ${p.zip || ''} ${p.id || ''}`.toLowerCase().includes(q));
    }

    if(filteredPhotos.length === 0 && zeroPhotoProps.length === 0){
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; text-align: center; color: var(--sniper-text-muted);">
          <svg style="width: 48px; height: 48px; opacity: 0.3; margin-bottom: 16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <h3 style="font-size: 1.1rem; color: var(--sniper-text); margin: 0 0 8px;">No Photos Match Current Filter</h3>
          <p style="font-size: 0.875rem; max-width: 420px; margin: 0 0 16px;">Try clearing your search or selecting "All Properties in List".</p>
          <button id="sniper-batch-reset-filter-btn" style="padding: 8px 16px; background: var(--sniper-surface-2); border: 1px solid var(--sniper-border); border-radius: 6px; color: var(--sniper-text); font-size: 0.8125rem; font-weight: 600; cursor: pointer;">Show All List Photos</button>
        </div>
      `;
      const btn = document.getElementById('sniper-batch-reset-filter-btn');
      if(btn){
        btn.addEventListener('click', () => {
          selectedBatchPropId = '';
          const sel = document.getElementById('sniper-batch-prop-select');
          if(sel) sel.value = '';
          const inp = document.getElementById('sniper-search-input');
          if(inp) inp.value = '';
          const clr = document.getElementById('sniper-search-clear');
          if(clr) clr.style.display = 'none';
          searchQuery = '';
          renderBatchGrid();
        });
      }
      return;
    }

    // Render zero-photo properties first so missing-media properties are immediately actionable
    zeroPhotoProps.forEach(prop => {
      const card = document.createElement('div');
      card.className = 'sniper-card batch-photo-card zero-photos';
      card.dataset.propId = prop.id;
      card.tabIndex = 0;
      card.innerHTML = `
        <div class="sniper-card-media-wrap">
          <div class="sniper-zero-photos-body">
            <svg class="sniper-zero-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            <div class="sniper-zero-title">0 Photos on Listing</div>
            <div class="sniper-zero-sub">Tap to inspect or delete listing</div>
          </div>
        </div>
        <div class="sniper-card-footer">
          <div class="sniper-card-address" title="${escSafe(prop.address)}">${escSafe(prop.address || 'Unknown Address')}</div>
          <div class="sniper-card-city">${escSafe(prop.city || '')}${prop.state ? ', ' + escSafe(prop.state) : ''} ${escSafe(prop.zip || '')}</div>
          <div class="sniper-card-bottom-row">
            <span class="sniper-card-price">${prop.monthly_rent ? '$' + Number(prop.monthly_rent).toLocaleString() + '/mo' : 'Rent TBD'}</span>
            <span class="sniper-card-beds">0 photos</span>
          </div>
        </div>
      `;
      card.addEventListener('click', () => {
        selectPhotoForInspection({ id: `zero-${prop.id}`, property_id: prop.id, url: '', display_order: 0, is_hero: false, ...prop }, true);
      });
      grid.appendChild(card);
    });

    // Render every photo card in the batch
    filteredPhotos.forEach(photo => {
      const isSelected = activeInspectedPhoto && activeInspectedPhoto.id === photo.id;
      const isHero = !!photo.is_hero;

      const card = document.createElement('div');
      card.className = 'sniper-card batch-photo-card' + (isSelected ? ' selected' : '') + (isHero ? ' is-hero' : '');
      card.id = `batch-photo-card-${photo.id}`;
      card.dataset.photoId = photo.id;
      card.dataset.propId = photo.property_id;
      card.tabIndex = 0;

      const thumbUrl = getThumbUrl(photo.url, 'large');

      let badgeHtml = '';
      if(isHero){
        badgeHtml += '<span class="sniper-badge-photo-count" style="background:#006aff;color:#fff;font-weight:700">★ Hero Cover</span>';
      } else {
        badgeHtml += `<span class="sniper-badge-photo-count">#${photo.display_order || 1}</span>`;
      }
      if(['branding', 'watermark', 'flagged'].includes(photo.watermark_status)){
        badgeHtml += '<span class="sniper-badge-flagged">🚨 Flagged</span>';
      }

      card.innerHTML = `
        <div class="sniper-card-media-wrap">
          <div class="sniper-card-media">
            <img class="sniper-card-img" src="${thumbUrl}" alt="${escSafe(photo.address)}" referrerpolicy="no-referrer" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div class="sniper-error-fallback" style="display:none">
              <svg class="sniper-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
              <div class="sniper-error-txt">Photo Unavailable</div>
            </div>
            <!-- Delete Single Photo Hover/Touch Button (Top-Right corner) -->
            <button class="sniper-photo-delete-btn" title="Delete only this single photo" aria-label="Delete photo" type="button" data-photo-id="${photo.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg>
            </button>
          </div>
          <!-- Badges strictly Top-Left so top-right Delete button never overlaps -->
          <div class="sniper-card-top-badges">
            <div class="sniper-card-top-right-badges">
              ${badgeHtml}
            </div>
          </div>
        </div>
        <div class="sniper-card-footer">
          <div class="sniper-card-title-row">
            <div class="sniper-card-address" title="${escSafe(photo.address)}">${escSafe(photo.address || 'Unknown Address')}</div>
            <a href="/property.html?id=${encodeURIComponent(photo.property_id)}${shareToken ? '#share=' + encodeURIComponent(shareToken) : ''}" target="_blank" rel="noopener noreferrer" class="sniper-card-ext-btn" title="Open listing in new tab" aria-label="Open listing">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          </div>
          <div class="sniper-card-city">${escSafe(photo.city || '')}${photo.state ? ', ' + escSafe(photo.state) : ''} ${escSafe(photo.zip || '')}</div>
          <div class="sniper-card-bottom-row">
            <span class="sniper-card-price">${photo.monthly_rent ? '$' + Number(photo.monthly_rent).toLocaleString() + '/mo' : 'Rent TBD'}</span>
            <div class="sniper-card-pills">
              <span class="sniper-card-beds">${photo.bedrooms || 0}b / ${photo.bathrooms || 0}ba</span>
            </div>
          </div>
        </div>
      `;

      // Click photo -> completely identify parent listing in sidebar
      card.addEventListener('click', (e) => {
        if(e.target.closest('.sniper-card-ext-btn') || e.target.closest('.sniper-photo-delete-btn')) return;
        selectPhotoForInspection(photo, true);
      });

      card.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          selectPhotoForInspection(photo, true);
        }
      });

      // Single photo delete button click
      const delBtn = card.querySelector('.sniper-photo-delete-btn');
      if(delBtn){
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          confirmDeleteSinglePhoto(photo);
        });
      }

      grid.appendChild(card);
    });
  }

  // ─── Photo Inspection & Listing Identification ────────────────────────────
  function selectPhotoForInspection(photo, shouldOpenDrawer = true){
    activeInspectedPhoto = photo;
    activeInspectedProperty = batchProperties.find(p => p.id === photo.property_id) || {
      id: photo.property_id,
      address: photo.address,
      city: photo.city,
      state: photo.state,
      zip: photo.zip,
      monthly_rent: photo.monthly_rent,
      bedrooms: photo.bedrooms,
      bathrooms: photo.bathrooms,
      square_footage: photo.square_footage,
      property_type: photo.property_type,
      status: photo.status,
      batch_id: photo.batch_id
    };

    // Update active highlight ring across batch cards
    document.querySelectorAll('.batch-photo-card.selected').forEach(c => c.classList.remove('selected'));
    const curCard = document.getElementById(`batch-photo-card-${photo.id}`);
    if(curCard){
      curCard.classList.add('selected');
    }

    // Switch to Inspector tab and optionally open drawer/sheet
    switchSidebarTab('inspector');
    if(shouldOpenDrawer && toggleSidebarRef){
      toggleSidebarRef(true);
    }

    const emptyView = document.getElementById('sniper-empty-inspector');
    const contentView = document.getElementById('sniper-inspector-content');
    if(emptyView) emptyView.style.display = 'none';
    if(contentView) contentView.style.display = 'flex';

    // Populate Parent Property Details
    const addrEl = document.getElementById('inspector-address');
    const cityEl = document.getElementById('inspector-city-state-zip');
    const rentEl = document.getElementById('inspector-rent');
    const specsEl = document.getElementById('inspector-specs');
    const badgesEl = document.getElementById('inspector-badges');
    const linkLive = document.getElementById('inspector-link-live');
    const linkEdit = document.getElementById('inspector-link-admin-edit');

    if(addrEl) addrEl.textContent = activeInspectedProperty.address || 'Unknown Address';
    if(cityEl) cityEl.textContent = `${activeInspectedProperty.city || ''}${activeInspectedProperty.state ? ', ' + activeInspectedProperty.state : ''} ${activeInspectedProperty.zip || ''}`;
    if(rentEl) rentEl.textContent = activeInspectedProperty.monthly_rent ? `$${Number(activeInspectedProperty.monthly_rent).toLocaleString()}/month` : 'Contact for Rent';
    if(specsEl){
      const sqft = activeInspectedProperty.square_footage ? ` · ${Number(activeInspectedProperty.square_footage).toLocaleString()} sqft` : '';
      specsEl.textContent = `${activeInspectedProperty.bedrooms || 0} Beds · ${activeInspectedProperty.bathrooms || 0} Baths${sqft} · ${activeInspectedProperty.property_type || 'Single Family'}`;
    }
    if(badgesEl){
      const isPrivate = activeInspectedProperty.status === 'private_placement';
      const statusBadge = isPrivate
        ? '<span class="sniper-prop-badge private">Private Placement</span>'
        : `<span class="sniper-prop-badge active-listing">${escSafe((activeInspectedProperty.status || 'active').toUpperCase())}</span>`;
      const batchBadge = activeInspectedProperty.batch_id
        ? `<span class="sniper-prop-badge">Batch: ${escSafe(activeInspectedProperty.batch_id)}</span>`
        : '';
      badgesEl.innerHTML = `
        ${statusBadge}
        ${batchBadge}
        <span class="sniper-prop-badge">ID: ${escSafe(activeInspectedProperty.id)}</span>
      `;
    }
    if(linkLive){
      linkLive.href = `/property.html?id=${encodeURIComponent(activeInspectedProperty.id)}${shareToken ? '#share=' + encodeURIComponent(shareToken) : ''}`;
    }
    if(linkEdit){
      linkEdit.href = `/admin/property-detail.html?id=${encodeURIComponent(activeInspectedProperty.id)}`;
    }

    // Populate Active Photo Details
    const photoMetaEl = document.getElementById('inspector-photo-meta');
    const activeImgEl = document.getElementById('inspector-active-img');
    const delActiveBtn = document.getElementById('inspector-btn-del-active-photo');
    const hasPhoto = Boolean(photo && photo.url && !String(photo.id || '').startsWith('zero-'));

    if(photoMetaEl){
      photoMetaEl.textContent = hasPhoto
        ? `#${photo.display_order || 1} ${photo.is_hero ? '(Cover Photo)' : ''}`
        : '0 photos';
    }
    if(activeImgEl){
      activeImgEl.src = hasPhoto ? photo.url : '/assets/placeholder-property.svg';
    }
    if(delActiveBtn){
      delActiveBtn.style.display = hasPhoto ? 'inline-flex' : 'none';
    }

    // Populate Thumbnail Strip for all photos in this specific house
    renderInspectorThumbnails();
  }

  function renderInspectorThumbnails(){
    const container = document.getElementById('inspector-thumbnails');
    const countEl = document.getElementById('inspector-photo-total');
    if(!container || !activeInspectedProperty) return;

    const propPhotos = batchPhotos.filter(p => p.property_id === activeInspectedProperty.id);
    if(countEl) countEl.textContent = propPhotos.length;

    container.innerHTML = '';
    propPhotos.forEach(p => {
      const isCur = activeInspectedPhoto && activeInspectedPhoto.id === p.id;
      const thumb = document.createElement('div');
      thumb.className = 'sniper-thumb-item' + (isCur ? ' active' : '');
      thumb.title = `Photo #${p.display_order || 1}`;
      thumb.innerHTML = `<img src="${getSmallThumb(p.url)}" alt="" referrerpolicy="no-referrer" loading="lazy">`;

      thumb.addEventListener('click', () => {
        selectPhotoForInspection(p, true);
        const targetCard = document.getElementById(`batch-photo-card-${p.id}`);
        if(targetCard){
          targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });

      container.appendChild(thumb);
    });
  }

  // ─── Single Photo Deletion ────────────────────────────────────────────────
  function confirmDeleteSinglePhoto(photo){
    pendingDeletePhoto = photo;
    const modal = document.getElementById('sniper-delete-photo-modal');
    const addrEl = document.getElementById('modal-del-photo-address');
    const imgEl = document.getElementById('modal-del-photo-img');

    if(!modal) return;
    if(addrEl) addrEl.textContent = photo.address || 'this property';
    if(imgEl) imgEl.src = photo.url;
    modal.style.display = 'flex';
  }

  function closeDeletePhotoModal(){
    const modal = document.getElementById('sniper-delete-photo-modal');
    if(modal) modal.style.display = 'none';
    pendingDeletePhoto = null;
  }

  async function executeDeleteSinglePhoto(){
    if(!pendingDeletePhoto) return;
    const photoToDelete = pendingDeletePhoto;
    closeDeletePhotoModal();

    // Check admin authentication
    if(window.CP && CP.Auth && typeof CP.Auth.isAdmin === 'function'){
      const isAdm = await CP.Auth.isAdmin().catch(() => false);
      if(!isAdm){
        toastSafe('Admin authentication required to delete photos. Please sign in.', 'error');
        return;
      }
    }

    setLoading(true, 'Deleting photo from database…');

    try {
      const { data, error } = await CP.sb().rpc('delete_single_property_photo', {
        p_photo_id: photoToDelete.id
      });

      if(error) throw error;
      if(!data || !data.ok){
        throw new Error(data?.error || 'Database rejected photo deletion');
      }

      // Purge from ImageKit if remote file_id exists
      if(photoToDelete.file_id && window.CONFIG && CONFIG.SUPABASE_URL){
        let authHeaderToken = CONFIG.SUPABASE_ANON_KEY || '';
        try {
          const sess = await CP.Auth.getSession().catch(() => null);
          if(sess?.access_token) authHeaderToken = sess.access_token;
        } catch(_) {}

        fetch(`${CONFIG.SUPABASE_URL}/functions/v1/imagekit-delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': CONFIG.SUPABASE_ANON_KEY || authHeaderToken,
            'Authorization': `Bearer ${authHeaderToken}`
          },
          body: JSON.stringify({ fileIds: [photoToDelete.file_id] })
        }).catch(e => console.warn('[watermark-sniper] Remote ImageKit purge error:', e));
      }

      // Update in-memory collections + invalidate private list cache
      privateCollectionsCache = null;
      batchPhotos = batchPhotos.filter(p => p.id !== photoToDelete.id);

      // Decrement photo count on parent property
      const parentProp = batchProperties.find(p => p.id === photoToDelete.property_id);
      if(parentProp && parentProp.photo_count > 0){
        parentProp.photo_count--;
      }

      // If hero was deleted, promote next photo in-memory to stay synced with DB
      if(photoToDelete.is_hero){
        const nextHero = batchPhotos.find(p => p.property_id === photoToDelete.property_id);
        if(nextHero) nextHero.is_hero = true;
      }

      // Smoothly remove card from DOM
      const cardEl = document.getElementById(`batch-photo-card-${photoToDelete.id}`);
      if(cardEl){
        cardEl.style.transition = 'all 0.3s ease';
        cardEl.style.opacity = '0';
        cardEl.style.transform = 'scale(0.8)';
        setTimeout(() => cardEl.remove(), 300);
      }

      // Update header banner counts
      const countsEl = document.getElementById('sniper-batch-counts');
      if(countsEl){
        countsEl.textContent = `${batchProperties.length} propert${batchProperties.length === 1 ? 'y' : 'ies'} · ${batchPhotos.length} total photos`;
      }
      const photosCountTop = document.getElementById('stat-photos-catalog');
      if(photosCountTop){
        photosCountTop.textContent = `(${batchPhotos.length} photos)`;
      }

      // If the deleted photo was currently inspected, advance to another photo of this property
      if(activeInspectedPhoto && activeInspectedPhoto.id === photoToDelete.id){
        const remaining = batchPhotos.filter(p => p.property_id === photoToDelete.property_id);
        if(remaining.length > 0){
          selectPhotoForInspection(remaining[0], true);
        } else {
          const emptyView = document.getElementById('sniper-empty-inspector');
          const contentView = document.getElementById('sniper-inspector-content');
          if(emptyView) emptyView.style.display = 'flex';
          if(contentView) contentView.style.display = 'none';
          activeInspectedPhoto = null;
        }
      } else if(activeInspectedProperty && activeInspectedProperty.id === photoToDelete.property_id){
        renderInspectorThumbnails();
      }

      toastSafe(`Photo deleted successfully from ${photoToDelete.address}.`, 'success');

    } catch(err){
      console.error('[watermark-sniper] Photo deletion failed:', err);
      toastSafe('Failed to delete photo: ' + (err.message || 'Unknown error'), 'error', 5000);
    } finally {
      setLoading(false);
    }
  }

  // ─── Entire Listing Deletion (24-Hour Recovery Window) ─────────────────────
  function confirmDeleteEntireListing(property){
    if(!property) return;
    pendingDeleteListing = property;

    const modal = document.getElementById('sniper-delete-listing-modal');
    const addrEl = document.getElementById('modal-del-listing-addr');
    const photoCountEl = document.getElementById('modal-del-listing-photo-count');

    if(!modal) return;
    const propPhotos = batchPhotos.filter(p => p.property_id === property.id);
    if(addrEl) addrEl.textContent = property.address || 'this listing';
    if(photoCountEl) photoCountEl.textContent = propPhotos.length || property.photo_count || 0;

    modal.style.display = 'flex';
  }

  function closeDeleteListingModal(){
    const modal = document.getElementById('sniper-delete-listing-modal');
    if(modal) modal.style.display = 'none';
    pendingDeleteListing = null;
  }

  async function executeDeleteEntireListing(){
    if(!pendingDeleteListing) return;
    const propToDelete = pendingDeleteListing;
    closeDeleteListingModal();

    if(window.CP && CP.Auth && typeof CP.Auth.isAdmin === 'function'){
      const isAdm = await CP.Auth.isAdmin().catch(() => false);
      if(!isAdm){
        toastSafe('Admin authentication required to delete listings. Please sign in.', 'error');
        return;
      }
    }

    setLoading(true, `Archiving & deleting ${propToDelete.address}…`);

    try {
      const { data, error } = await CP.sb().rpc('archive_and_delete_property', {
        p_property_id: propToDelete.id,
        p_reason: 'Watermark sniper listing moderation'
      });

      if(error) throw error;
      if(!data || !data.ok){
        throw new Error(data?.error || 'Database rejected listing deletion');
      }

      privateCollectionsCache = null;

      // Remove property and its photos from in-memory arrays
      batchProperties = batchProperties.filter(p => p.id !== propToDelete.id);
      batchPhotos = batchPhotos.filter(p => p.property_id !== propToDelete.id);

      // Remove all photo cards belonging to this property from the DOM
      document.querySelectorAll(`.batch-photo-card[data-prop-id="${propToDelete.id}"]`).forEach(c => c.remove());

      const propSel = document.getElementById('sniper-batch-prop-select');
      if(propSel){
        const opt = propSel.querySelector(`option[value="${propToDelete.id}"]`);
        if(opt) opt.remove();
      }

      const countsEl = document.getElementById('sniper-batch-counts');
      if(countsEl){
        countsEl.textContent = `${batchProperties.length} propert${batchProperties.length === 1 ? 'y' : 'ies'} · ${batchPhotos.length} total photos`;
      }
      const invCount = document.getElementById('stat-total-catalog');
      if(invCount) invCount.textContent = `${batchProperties.length} listings`;
      const photosCountTop = document.getElementById('stat-photos-catalog');
      if(photosCountTop) photosCountTop.textContent = `(${batchPhotos.length} photos)`;

      const emptyView = document.getElementById('sniper-empty-inspector');
      const contentView = document.getElementById('sniper-inspector-content');
      if(emptyView) emptyView.style.display = 'flex';
      if(contentView) contentView.style.display = 'none';
      activeInspectedPhoto = null;
      activeInspectedProperty = null;

      await fetchRecoverableTrash();
      switchSidebarTab('trash');

      toastSafe(`Deleted ${propToDelete.address}. Restorable for 24 hours in 24h Trash.`, 'warning', 6000);

    } catch(err){
      console.error('[watermark-sniper] Listing deletion failed:', err);
      toastSafe('Failed to delete listing: ' + (err.message || 'Unknown error'), 'error', 5000);
    } finally {
      setLoading(false);
    }
  }

  // ─── 24-Hour Recovery Trash Engine ────────────────────────────────────────
  async function fetchRecoverableTrash(){
    try {
      const { data, error } = await CP.sb().rpc('get_recoverable_properties', {
        p_batch_id: isBatchMode ? batchId : null,
        p_share_id: isBatchMode ? shareId : null
      });
      if(error) throw error;
      if(data && data.ok && Array.isArray(data.items)){
        batchRecoverable = data.items;
        renderTrashList();
      }
    } catch(err){
      console.warn('[watermark-sniper] Could not refresh 24h trash:', err);
    }
  }

  function renderTrashList(){
    const listEl = document.getElementById('sniper-trash-list');
    const emptyEl = document.getElementById('sniper-empty-trash');
    const trashPillTop = document.getElementById('stat-trash-count');
    const trashPillBatch = document.getElementById('batch-trash-pill-count');
    const trashPillSidebar = document.getElementById('sidebar-trash-count');
    const trashPillStrip = document.getElementById('strip-trash-count');

    const count = batchRecoverable.length;
    if(trashPillTop) trashPillTop.textContent = count;
    if(trashPillBatch) trashPillBatch.textContent = count;
    if(trashPillSidebar) trashPillSidebar.textContent = count;
    if(trashPillStrip) trashPillStrip.textContent = count;

    if(!listEl) return;

    if(count === 0){
      Array.from(listEl.querySelectorAll('.sniper-trash-card')).forEach(el => el.remove());
      if(emptyEl){
        emptyEl.style.display = 'flex';
        if(!emptyEl.parentElement) listEl.appendChild(emptyEl);
      }
      return;
    }

    if(emptyEl) emptyEl.style.display = 'none';
    Array.from(listEl.querySelectorAll('.sniper-trash-card')).forEach(el => el.remove());

    const nowMs = Date.now();
    batchRecoverable.forEach(item => {
      const card = document.createElement('div');
      card.className = 'sniper-trash-card';
      card.id = `trash-card-${item.recovery_id}`;

      const expMs = new Date(item.recovery_expires_at).getTime();
      const secRemaining = Math.max(0, Math.round((expMs - nowMs) / 1000));

      card.innerHTML = `
        <div class="sniper-trash-card-top">
          <div>
            <div class="sniper-trash-addr">${escSafe(item.address)}</div>
            <div class="sniper-trash-meta">${escSafe(item.city)}, ${escSafe(item.state)} · ${item.photo_count || 0} photos · $${Number(item.monthly_rent || 0).toLocaleString()}/mo</div>
          </div>
          <span class="sniper-trash-countdown" id="countdown-${item.recovery_id}" data-expires-at="${item.recovery_expires_at}">
            ⏱ ${formatCountdown(secRemaining)}
          </span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:4px">
          <span style="font-size:0.6875rem;color:var(--sniper-text-muted)">Deleted: ${new Date(item.archived_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</span>
          <button type="button" class="sniper-btn-restore" data-recovery-id="${item.recovery_id}" data-address="${escSafe(item.address)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="sniper-icon-13"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            <span>Restore Listing</span>
          </button>
        </div>
      `;

      card.querySelector('.sniper-btn-restore').addEventListener('click', () => {
        executeRestoreProperty(item.recovery_id, item.address);
      });

      listEl.appendChild(card);
    });
  }

  function startTrashTimer(){
    clearInterval(trashCountdownTimer);
    trashCountdownTimer = setInterval(() => {
      updateTrashCountdowns();
    }, 1000);
  }

  function updateTrashCountdowns(){
    const nowMs = Date.now();
    document.querySelectorAll('.sniper-trash-countdown').forEach(el => {
      const expIso = el.dataset.expiresAt;
      if(!expIso) return;
      const secRemaining = Math.max(0, Math.round((new Date(expIso).getTime() - nowMs) / 1000));
      if(secRemaining <= 0){
        el.textContent = 'Expired';
        el.style.color = '#ef4444';
      } else {
        el.textContent = `⏱ ${formatCountdown(secRemaining)}`;
      }
    });
  }

  function formatCountdown(totalSec){
    if(totalSec <= 0) return 'Expired';
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if(hrs > 0){
      return `${hrs}h ${mins}m left`;
    }
    return `${mins}m ${secs}s left`;
  }

  async function executeRestoreProperty(recoveryId, address){
    setLoading(true, `Restoring ${address} from archive…`);

    try {
      const { data, error } = await CP.sb().rpc('restore_archived_property', {
        p_recovery_id: recoveryId
      });

      if(error) throw error;
      if(!data || !data.ok){
        throw new Error(data?.error || 'Database rejected listing restoration');
      }

      privateCollectionsCache = null;
      toastSafe(`Successfully restored ${address} with all photos!`, 'success', 5000);

      if(isBatchMode){
        await loadBatchMode({
          pBatchId: batchId,
          pShareToken: shareToken,
          pShareId: shareId,
          pPropertyId: deepLinkPropertyId,
          pScope: batchScope
        });
      } else {
        await fetchRecoverableTrash();
        await loadFilterOptions();
        await loadPage(currentPage);
      }

    } catch(err){
      console.error('[watermark-sniper] Restoration failed:', err);
      toastSafe('Failed to restore listing: ' + (err.message || 'Unknown error'), 'error', 6000);
    } finally {
      setLoading(false);
    }
  }

  // ─── Sidebar Tab Switcher ──────────────────────────────────────────────────
  function switchSidebarTab(tabName){
    activeSidebarTab = tabName;

    // Update Tab Buttons
    document.querySelectorAll('.sniper-sidebar-tab').forEach(btn => {
      const isCur = btn.dataset.tab === tabName;
      btn.classList.toggle('active', isCur);
      btn.setAttribute('aria-selected', isCur ? 'true' : 'false');
    });

    // Update Tab Panes
    const paneInspector = document.getElementById('pane-inspector');
    const paneTrash = document.getElementById('pane-trash');
    const paneQueue = document.getElementById('pane-queue');

    if(paneInspector) paneInspector.style.display = tabName === 'inspector' ? 'flex' : 'none';
    if(paneTrash) paneTrash.style.display = tabName === 'trash' ? 'flex' : 'none';
    if(paneQueue) paneQueue.style.display = tabName === 'queue' ? 'flex' : 'none';
  }

  // ─── Edge Inspection Mode Toggle (Contain vs Cover) ───────────────────────
  function toggleEdgeContainMode(forceState){
    const grid = document.getElementById('sniper-grid');
    const btn = document.getElementById('sniper-btn-edge-mode');
    const txt = document.getElementById('sniper-edge-mode-txt');
    const stripBtn = document.getElementById('sniper-strip-edge-btn');
    if(!grid) return;

    isEdgeContain = forceState !== undefined ? forceState : !grid.classList.contains('edge-contain');
    grid.classList.toggle('edge-contain', isEdgeContain);

    if(btn) btn.classList.toggle('active', isEdgeContain);
    if(stripBtn) stripBtn.classList.toggle('active', isEdgeContain);
    if(txt) txt.textContent = isEdgeContain ? 'Contain (Edges Clear)' : 'Cover (Fill Grid)';
  }

  // ─── Pagination Controls ───────────────────────────────────────────────────
  function updatePaginationControls(){
    const startIdx = totalProperties === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const endIdx = Math.min(currentPage * pageSize, totalProperties);

    const summaryText = `Showing ${startIdx.toLocaleString()}–${endIdx.toLocaleString()} of ${totalProperties.toLocaleString()} properties`;
    const summaryElTop = document.getElementById('sniper-page-summary');
    if(summaryElTop) summaryElTop.textContent = summaryText;

    const summaryElBottom = document.getElementById('sniper-page-summary-bottom');
    if(summaryElBottom) summaryElBottom.textContent = `Page ${currentPage} of ${totalPages} (${totalProperties.toLocaleString()} listings)`;

    // Jump Input
    const jumpInput = document.getElementById('sniper-jump-input');
    if(jumpInput){
      jumpInput.max = totalPages;
      jumpInput.value = currentPage;
    }

    // Top buttons
    const btnFirst = document.getElementById('sniper-page-first');
    const btnPrev = document.getElementById('sniper-page-prev');
    const btnNext = document.getElementById('sniper-page-next');
    const btnLast = document.getElementById('sniper-page-last');

    if(btnFirst) btnFirst.disabled = currentPage <= 1;
    if(btnPrev) btnPrev.disabled = currentPage <= 1;
    if(btnNext) btnNext.disabled = currentPage >= totalPages;
    if(btnLast) btnLast.disabled = currentPage >= totalPages;

    // Bottom buttons
    const btnPrevBottom = document.getElementById('sniper-page-prev-bottom');
    const btnNextBottom = document.getElementById('sniper-page-next-bottom');
    if(btnPrevBottom) btnPrevBottom.disabled = currentPage <= 1;
    if(btnNextBottom) btnNextBottom.disabled = currentPage >= totalPages;

    // Render numbered page buttons (smart sliding window)
    renderPageNumbers('sniper-page-numbers-top');
    renderPageNumbers('sniper-page-numbers-bottom');
  }

  function renderPageNumbers(containerId){
    const container = document.getElementById(containerId);
    if(!container) return;
    container.innerHTML = '';

    if(totalPages <= 1) return;

    const pages = [];
    const maxVisible = 7;

    if(totalPages <= maxVisible){
      for(let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if(currentPage > 4){
        pages.push('...');
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for(let i = start; i <= end; i++){
        if(!pages.includes(i)) pages.push(i);
      }

      if(currentPage < totalPages - 3){
        pages.push('...');
      }
      if(!pages.includes(totalPages)){
        pages.push(totalPages);
      }
    }

    pages.forEach(p => {
      if(p === '...'){
        const ell = document.createElement('span');
        ell.className = 'sniper-page-ellipsis';
        ell.textContent = '…';
        container.appendChild(ell);
      } else {
        const btn = document.createElement('button');
        btn.className = 'sniper-page-btn' + (p === currentPage ? ' active' : '');
        btn.textContent = p;
        btn.addEventListener('click', () => loadPage(p));
        container.appendChild(btn);
      }
    });
  }

  // ─── Staging Queue Actions ────────────────────────────────────────────────
  function toggleStage(property, reason = null){
    const pid = property.id;
    if(queuedProperties.has(pid)){
      queuedProperties.delete(pid);
    } else {
      let resolvedReason = reason;
      if(!resolvedReason){
        if(property.photo_count === 0) resolvedReason = '0 Photos';
        else if(property.has_flagged_photo) resolvedReason = 'Watermark Flagged';
        else if(property.photo_count < 6) resolvedReason = '< 6 Photos';
        else resolvedReason = 'Manual Stage';
      }

      queuedProperties.set(pid, {
        id: pid,
        title: property.title || property.address,
        address: property.address || 'Unknown Address',
        city: property.city || '',
        state: property.state || '',
        zip: property.zip || '',
        monthly_rent: property.monthly_rent || null,
        coverUrl: property.cover_url || property.photo_url || '',
        photoCount: Number(property.photo_count || 0),
        reason: resolvedReason,
        fileId: property.photo_file_id || null
      });
    }

    // Update card DOM
    const card = document.getElementById(`prop-card-${pid}`);
    if(card){
      card.classList.toggle('staged', queuedProperties.has(pid));
    }

    renderQueue();
    recalculateSimilarities();
  }

  function renderQueue(){
    const list = document.getElementById('sniper-queue-list');
    const empty = document.getElementById('sniper-empty-queue');
    const count = queuedProperties.size;

    // Badges & Counters
    const badgeSidebar = document.getElementById('sniper-queue-badge');
    const badgeTop = document.getElementById('stat-staged-count');
    const delCount = document.getElementById('sniper-del-count');
    const deleteBtn = document.getElementById('sniper-btn-delete');
    const clearBtn = document.getElementById('sniper-btn-clear');

    if(badgeSidebar) badgeSidebar.textContent = count;
    if(badgeTop) badgeTop.textContent = count;
    if(delCount) delCount.textContent = count > 0 ? `(${count})` : '';

    const badgeQueueToggle = document.getElementById('sniper-topbar-queue-badge');
    if(badgeQueueToggle){
      badgeQueueToggle.textContent = count;
      badgeQueueToggle.style.display = count > 0 ? 'flex' : 'none';
    }
    const queueToggleBtn = document.getElementById('sniper-btn-queue-toggle');
    if(queueToggleBtn){
      if(count > 0){
        queueToggleBtn.classList.add('active');
      } else {
        queueToggleBtn.classList.remove('active');
      }
    }

    if(deleteBtn) deleteBtn.disabled = count === 0;
    if(clearBtn) clearBtn.disabled = count === 0;

    if(!list) return;

    if(count === 0){
      if(empty) empty.style.display = 'flex';
      // Remove all items except empty state
      Array.from(list.querySelectorAll('.sniper-queue-item')).forEach(el => el.remove());
      return;
    }

    if(empty) empty.style.display = 'none';
    list.innerHTML = '';

    queuedProperties.forEach(item => {
      const row = document.createElement('div');
      row.className = 'sniper-queue-item';
      row.id = `queue-item-${item.id}`;

      let thumbHtml = '';
      if(item.photoCount === 0 || !item.coverUrl){
        thumbHtml = `
          <div class="sniper-queue-thumb-wrap" style="background:rgba(239,68,68,0.15)">
            <svg style="width:20px;height:20px;color:#f87171" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          </div>
        `;
      } else {
        thumbHtml = `
          <div class="sniper-queue-thumb-wrap">
            <img class="sniper-queue-thumb" src="${getSmallThumb(item.coverUrl)}" alt="" referrerpolicy="no-referrer" onerror="this.style.display='none'">
          </div>
        `;
      }

      let reasonClass = 'watermark';
      if(item.reason.includes('0 Photo')) reasonClass = 'zero';

      row.innerHTML = `
        ${thumbHtml}
        <div class="sniper-queue-meta">
          <div class="sniper-queue-addr" title="${escSafe(item.address)}">${escSafe(item.address)}</div>
          <div class="sniper-queue-city">${escSafe(item.city)}${item.state ? ', ' + escSafe(item.state) : ''}</div>
          <span class="sniper-queue-reason ${reasonClass}">${escSafe(item.reason)}</span>
        </div>
        <button class="sniper-queue-remove-btn" title="Unstage listing" type="button" aria-label="Remove">✕</button>
      `;

      row.querySelector('.sniper-queue-remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleStage(item);
      });

      list.appendChild(row);
    });
  }

  function clearQueue(){
    queuedProperties.clear();
    // Un-highlight all cards on current page
    document.querySelectorAll('.sniper-card.staged').forEach(el => el.classList.remove('staged'));
    renderQueue();
    recalculateSimilarities();
    toastSafe('Staging queue cleared.', 'info');
  }

  // ─── Similarity Detection Engine ──────────────────────────────────────────
  function recalculateSimilarities(){
    const banner = document.getElementById('sniper-priority-banner');
    const prioCountEl = document.getElementById('sniper-prio-count');
    const matchCountEl = document.getElementById('sniper-match-count');
    const stageMatchesBtn = document.getElementById('sniper-btn-stage-matches');

    if(queuedProperties.size === 0 || !similarityPrioritized){
      activeSimilarityProfile = null;
      if(banner) banner.style.display = 'none';
      return;
    }

    const stagedList = Array.from(queuedProperties.values());
    const stagedLandlords = new Set();
    const stagedUrlSigs = new Set();
    const stagedTokens = new Set();

    stagedList.forEach(s => {
      if(s.fileId) stagedUrlSigs.add(extractUrlSignature(s.coverUrl));
    });

    // Match across current images on the page
    let matchCount = 0;
    currentImages.forEach(img => {
      if(queuedProperties.has(img.propertyId)) return;

      let score = 0;
      if(img.urlSignature && stagedUrlSigs.has(img.urlSignature)){
        score += 0.5;
      }
      if(score >= 0.4){
        matchCount++;
      }
    });

    if(matchCount > 0 && banner){
      banner.style.display = 'flex';
      if(prioCountEl) prioCountEl.textContent = `${matchCount} matching propert${matchCount === 1 ? 'y' : 'ies'}`;
      if(matchCountEl) matchCountEl.textContent = matchCount;
      if(stageMatchesBtn) stageMatchesBtn.disabled = false;
    } else if(banner){
      banner.style.display = 'none';
    }
  }

  function stageAllSimilarOnPage(){
    const stagedUrlSigs = new Set();
    queuedProperties.forEach(s => {
      if(s.coverUrl) stagedUrlSigs.add(extractUrlSignature(s.coverUrl));
    });

    let stagedCount = 0;
    currentImages.forEach(img => {
      if(!queuedProperties.has(img.propertyId)){
        if(img.urlSignature && stagedUrlSigs.has(img.urlSignature)){
          toggleStage(img.property, 'Similar Provider');
          stagedCount++;
        }
      }
    });

    toastSafe(`Staged ${stagedCount} similar propert${stagedCount === 1 ? 'y' : 'ies'} on this page.`, 'success');
  }

  // ─── System Scan ──────────────────────────────────────────────────────────
  async function runSystemScan(){
    const scanBtn = document.getElementById('sniper-btn-scan');
    if(scanBtn){
      scanBtn.disabled = true;
      scanBtn.innerHTML = `
        <div class="sniper-spinner" style="width:14px;height:14px;border-width:2px;"></div>
        <span>Scanning Entire Database…</span>
      `;
    }

    try {
      const { data, error } = await CP.sb().rpc('scan_watermark_sniper_system', {
        p_status: sniperMode === 'private' ? 'private_placement' : 'active'
      });
      if(error) throw error;

      scannedViolations = Array.isArray(data) ? data : [];

      const scanBanner = document.getElementById('sniper-scan-banner');
      const scanTitle = document.getElementById('sniper-scan-title');
      const scanMsg = document.getElementById('sniper-scan-msg');
      const scanBadge = document.getElementById('sniper-scan-badge');

      if(scanBadge){
        scanBadge.textContent = scannedViolations.length;
        scanBadge.style.display = 'inline-block';
      }

      if(scanBanner && scanTitle && scanMsg){
        scanBanner.style.display = 'flex';
        scanTitle.textContent = `${sniperMode === 'private' ? 'Private Placement' : 'Public Inventory'} Scan Complete:`;
        scanMsg.textContent = `Identified ${scannedViolations.length} properties with watermarks or compliance violations.`;
      }

      toastSafe(`Scan complete: found ${scannedViolations.length} non-compliant properties.`, 'warning', 5000);
    } catch(err){
      console.error('[watermark-sniper] System scan error:', err);
      toastSafe('System scan failed: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      if(scanBtn){
        scanBtn.disabled = false;
        scanBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="sniper-icon-16"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/><path d="M12 12l7-7"/></svg>
          <span>Scan System</span>
          <span class="sniper-scan-badge">${scannedViolations.length}</span>
        `;
      }
    }
  }

  function stageAllScannedViolations(){
    if(!scannedViolations.length) return;
    let added = 0;
    scannedViolations.forEach(v => {
      if(!queuedProperties.has(v.property_id)){
        const reasonTxt = v.flag_reason || v.flagged_reason;
        queuedProperties.set(v.property_id, {
          id: v.property_id,
          title: v.address || 'Listing ' + v.property_id.slice(0, 8),
          address: v.address || 'Unknown Address',
          city: v.city || '',
          state: v.state || '',
          zip: v.zip || '',
          coverUrl: v.flagged_photo_url || '',
          photoCount: Number(v.photo_count || 1),
          reason: reasonTxt ? reasonTxt : 'System Scan Violation',
          fileId: v.flagged_photo_file_id || null
        });
        added++;
      }
    });

    // Update active cards on current page
    document.querySelectorAll('.sniper-card').forEach(card => {
      const pid = card.dataset.propId;
      if(queuedProperties.has(pid)){
        card.classList.add('staged');
      }
    });

    switchSidebarTab('queue');
    if(toggleSidebarRef) toggleSidebarRef(true);
    renderQueue();
    toastSafe(`Staged all ${added} scanned violations into deletion queue.`, 'success');
  }

  // ─── Cascading Deletion & ImageKit Storage Cleanup ─────────────────────────
  async function openDeleteConfirmationModal(){
    const count = queuedProperties.size;
    if(count === 0) return;

    // Check if user is authenticated admin before allowing permanent deletion
    if (window.CP && CP.Auth && typeof CP.Auth.isAdmin === 'function') {
      const isAdm = await CP.Auth.isAdmin().catch(() => false);
      if (!isAdm) {
        toastSafe('Admin authentication required to perform permanent deletions. Please sign in.', 'error');
        setTimeout(() => {
          const cur = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.href = `/admin/login.html?returnTo=${cur}`;
        }, 1200);
        return;
      }
    }

    const modal = document.getElementById('sniper-delete-modal');
    const modalCount = document.getElementById('modal-del-count');
    const previewBox = document.getElementById('modal-prop-preview');

    if(!modal) return;

    if(modalCount) modalCount.textContent = count;
    if(previewBox){
      previewBox.innerHTML = '';
      const items = Array.from(queuedProperties.values()).slice(0, 8);
      items.forEach(it => {
        const row = document.createElement('div');
        row.textContent = `• ${it.address} (${it.city}, ${it.state}) — ${it.reason}`;
        previewBox.appendChild(row);
      });
      if(count > 8){
        const more = document.createElement('div');
        more.style.fontStyle = 'italic';
        more.style.color = 'var(--sniper-text-muted)';
        more.textContent = `… and ${count - 8} more listings`;
        previewBox.appendChild(more);
      }
    }

    modal.style.display = 'flex';
  }

  function closeDeleteConfirmationModal(){
    const modal = document.getElementById('sniper-delete-modal');
    if(modal) modal.style.display = 'none';
  }

  async function executeCascadeDelete(chunk) {
    // Attempt 1: window.CP.Properties.deleteCascadeBulk if defined
    if (window.CP && window.CP.Properties && typeof window.CP.Properties.deleteCascadeBulk === 'function') {
      try {
        const res = await window.CP.Properties.deleteCascadeBulk(chunk);
        if (res && res.ok && res.data) return res;
      } catch (e) {
        console.warn('[watermark-sniper] CP.Properties.deleteCascadeBulk threw:', e);
      }
    }

    // Attempt 2: window.CP.Properties.deleteCascade if defined
    if (window.CP && window.CP.Properties && typeof window.CP.Properties.deleteCascade === 'function') {
      try {
        let count = 0;
        const dIds = [];
        const fIds = [];
        for (const id of chunk) {
          const res = await window.CP.Properties.deleteCascade(id);
          if (res && res.ok) {
            count += (res.data?.deleted || 1);
            if (res.data?.deleted_ids) dIds.push(...res.data.deleted_ids);
            else dIds.push(id);
            if (res.data?.file_ids) fIds.push(...res.data.file_ids);
          }
        }
        return { ok: true, data: { deleted: count, deleted_ids: dIds, file_ids: fIds }, error: null };
      } catch (e) {
        console.warn('[watermark-sniper] CP.Properties.deleteCascade fallback threw:', e);
      }
    }

    // Attempt 3: Supabase RPC 'delete_properties_cascade'
    const sbClient = (window.CP && typeof window.CP.sb === 'function') ? window.CP.sb() : (window.supabase || null);
    if (sbClient && typeof sbClient.rpc === 'function') {
      try {
        const { data, error } = await sbClient.rpc('delete_properties_cascade', { p_ids: chunk });
        let parsed = data;
        if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed); } catch (_) {}
        }
        if (!error && parsed && (parsed.ok === true || parsed.deleted !== undefined)) {
          return { ok: true, data: parsed, error: null };
        }
      } catch (e) {
        console.warn('[watermark-sniper] RPC delete_properties_cascade threw:', e);
      }
    }

    // Attempt 4: Direct multi-table cascading delete fallback
    try {
      let fileIds = [];
      if (sbClient) {
        const { data: photos } = await sbClient.from('property_photos').select('file_id').in('property_id', chunk);
        fileIds = (photos || []).map(p => p.file_id).filter(Boolean);
        await sbClient.from('property_photos').delete().in('property_id', chunk).catch(() => {});
        await sbClient.from('saved_properties').delete().in('property_id', chunk).catch(() => {});
        await sbClient.from('inquiries').delete().in('property_id', chunk).catch(() => {});
        await sbClient.from('applications').update({ property_id: null }).in('property_id', chunk).catch(() => {});
        const { data: delProps, error: delErr } = await sbClient.from('properties').delete().in('id', chunk).select('id');
        if (!delErr) {
          const dIds = (delProps || []).map(p => p.id);
          return { ok: true, data: { deleted: dIds.length || chunk.length, deleted_ids: dIds.length ? dIds : chunk, file_ids: fileIds }, error: null };
        }
      }

      // REST API fallback if client wasn't initialized
      const cfg = (typeof CONFIG !== 'undefined' && CONFIG) ? CONFIG : (window.CONFIG || {});
      const supaUrl = (cfg.SUPABASE_URL || '').replace(/\/$/, '');
      const supaKey = cfg.SUPABASE_ANON_KEY || '';
      let authToken = supaKey;
      try {
        const sess = await (window.CP?.Auth?.getSession ? window.CP.Auth.getSession() : null).catch(() => null);
        if (sess?.access_token) authToken = sess.access_token;
      } catch (_) {}

      if (supaUrl && supaKey) {
        const hdrs = { 'apikey': supaKey, 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' };
        await fetch(`${supaUrl}/rest/v1/property_photos?property_id=in.(${chunk.join(',')})`, { method: 'DELETE', headers: hdrs }).catch(() => {});
        await fetch(`${supaUrl}/rest/v1/saved_properties?property_id=in.(${chunk.join(',')})`, { method: 'DELETE', headers: hdrs }).catch(() => {});
        await fetch(`${supaUrl}/rest/v1/inquiries?property_id=in.(${chunk.join(',')})`, { method: 'DELETE', headers: hdrs }).catch(() => {});
        await fetch(`${supaUrl}/rest/v1/applications?property_id=in.(${chunk.join(',')})`, { method: 'PATCH', headers: hdrs, body: JSON.stringify({ property_id: null }) }).catch(() => {});
        const delRes = await fetch(`${supaUrl}/rest/v1/properties?id=in.(${chunk.join(',')})`, { method: 'DELETE', headers: { ...hdrs, 'Prefer': 'return=representation' } });
        if (delRes.ok) {
          const rows = await delRes.json().catch(() => []);
          const dIds = rows.map(r => r.id);
          return { ok: true, data: { deleted: dIds.length || chunk.length, deleted_ids: dIds.length ? dIds : chunk, file_ids: fileIds }, error: null };
        }
      }
    } catch (directErr) {
      console.error('[watermark-sniper] Direct cascading delete failed:', directErr);
    }

    return { ok: false, error: 'All cascading delete strategies failed for the selected listings.' };
  }

  async function performCascadingDeletion(){
    closeDeleteConfirmationModal();
    const count = queuedProperties.size;
    if(count === 0) return;

    setLoading(true, `Permanently deleting ${count} listings and purging assets…`);

    const ids = Array.from(queuedProperties.keys());
    let succeeded = 0;
    let failed = 0;
    let lastErrorDetails = null;
    const actuallyDeletedIds = [];
    const processedIds = [];

    // Retrieve session token once for ImageKit cleanup
    let authHeaderToken = (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE_ANON_KEY) ? CONFIG.SUPABASE_ANON_KEY : '';
    try {
      const sess = await (window.CP && window.CP.Auth ? window.CP.Auth.getSession() : null).catch(() => null);
      if(sess?.access_token) authHeaderToken = sess.access_token;
    } catch(_) {}

    const chunkSize = 50;
    for(let i = 0; i < ids.length; i += chunkSize){
      const chunk = ids.slice(i, i + chunkSize);
      setLoading(true, `Deleting listings ${i + 1}–${Math.min(i + chunkSize, ids.length)} of ${ids.length}…`);

      try {
        const result = await executeCascadeDelete(chunk);
        if(result && result.ok && result.data){
          const dIds = Array.isArray(result.data.deleted_ids) ? result.data.deleted_ids : [];
          const numDeleted = typeof result.data.deleted === 'number' ? result.data.deleted : dIds.length;
          actuallyDeletedIds.push(...dIds);
          processedIds.push(...chunk);
          succeeded += numDeleted;

          // Asynchronous ImageKit purge per AGENTS.md rule 4.C
          const fileIds = Array.isArray(result.data.file_ids) ? result.data.file_ids.filter(Boolean) : [];
          if(typeof CONFIG !== 'undefined' && CONFIG.SUPABASE_URL){
            fetch(`${CONFIG.SUPABASE_URL}/functions/v1/imagekit-delete`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': CONFIG.SUPABASE_ANON_KEY || authHeaderToken,
                'Authorization': `Bearer ${authHeaderToken}`
              },
              body: JSON.stringify({ fileIds, propertyIds: chunk })
            }).catch(e => console.warn('[watermark-sniper] ImageKit remote delete error:', e));
          }
        } else {
          const errMsg = result?.error || 'Unknown deletion failure';
          lastErrorDetails = errMsg;
          console.error('[watermark-sniper] Batch deletion failed:', { chunk, error: errMsg, result });
          failed += chunk.length;
        }
      } catch(err){
        const errMsg = err?.message || String(err);
        lastErrorDetails = errMsg;
        console.error('[watermark-sniper] Global deletion error:', { chunk, error: errMsg, stack: err?.stack });
        failed += chunk.length;
      }
    }

    // Audit Logging
    try {
      const sess = await CP.Auth.getSession().catch(() => null);
      const userId = sess?.user?.id || null;
      if(actuallyDeletedIds.length > 0){
        await CP.sb().from('admin_actions').insert([{
          user_id: userId,
          action: 'property.watermark_sniper_delete',
          target_type: 'property',
          target_id: actuallyDeletedIds.join(','),
          metadata: { count: actuallyDeletedIds.length, property_ids: actuallyDeletedIds, deleted_at: new Date().toISOString() }
        }]).catch(() => {});
      }
    } catch(_) {}

    // Cleanup staged properties that were processed cleanly by the database
    processedIds.forEach(id => queuedProperties.delete(id));

    renderQueue();
    setLoading(false);

    // Distinguish successful, partial, and actual failure
    if(succeeded > 0 && failed === 0){
      toastSafe(`Successfully deleted ${succeeded} listing${succeeded === 1 ? '' : 's'} and purged associated media.`, 'success', 5000);
      await loadFilterOptions();
      await loadPage(currentPage);
    } else if(succeeded > 0 && failed > 0){
      toastSafe(`Partially deleted: ${succeeded} listings deleted, ${failed} failed. Check console for details.`, 'warning', 6000);
      await loadFilterOptions();
      await loadPage(currentPage);
    } else if(failed > 0){
      toastSafe(`Deletion failed for ${failed} listing${failed === 1 ? '' : 's'}. ${lastErrorDetails ? '(' + lastErrorDetails + ')' : 'Check console for details.'}`, 'error', 6000);
    } else if(processedIds.length > 0){
      toastSafe('The selected listings were already removed from the database. Staging queue cleared.', 'info', 4000);
      await loadFilterOptions();
      await loadPage(currentPage);
    }
  }

  // ─── Filter Reset ──────────────────────────────────────────────────────────
  function resetAllFilters(){
    filterState = '';
    filterCity = '';
    filterType = '';
    filterDate = 'all';
    filterCompliance = 'all';
    searchQuery = '';

    const stateSelect = document.getElementById('sniper-state-select');
    if(stateSelect) stateSelect.value = '';

    const citySelect = document.getElementById('sniper-city-select');
    if(citySelect) {
      populateCitiesDropdown();
      citySelect.value = '';
    }

    const typeSelect = document.getElementById('sniper-type-select');
    if(typeSelect) typeSelect.value = '';

    const dateSelect = document.getElementById('sniper-date-select');
    if(dateSelect) dateSelect.value = 'all';

    const compSelect = document.getElementById('sniper-compliance-select');
    if(compSelect) compSelect.value = 'all';

    const searchInput = document.getElementById('sniper-search-input');
    const searchClear = document.getElementById('sniper-search-clear');
    if(searchInput) searchInput.value = '';
    if(searchClear) searchClear.style.display = 'none';

    currentPage = 1;
    loadPage(1);
    toastSafe('Filters reset to default.', 'info');
  }

  // ─── UI & Event Listeners Initialization ───────────────────────────────────
  function initUI(){
    // 1. Search Input
    const searchInput = document.getElementById('sniper-search-input');
    const searchClear = document.getElementById('sniper-search-clear');
    let searchTimer = null;

    if(searchInput){
      searchInput.addEventListener('input', (e) => {
        const val = e.target.value;
        if(searchClear) searchClear.style.display = val ? 'flex' : 'none';
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          searchQuery = val;
          if(isBatchMode){
            renderBatchGrid();
          } else {
            loadPage(1);
          }
        }, 200);
      });
    }

    if(searchClear){
      searchClear.addEventListener('click', () => {
        if(searchInput) searchInput.value = '';
        searchClear.style.display = 'none';
        searchQuery = '';
        if(isBatchMode){
          renderBatchGrid();
        } else {
          loadPage(1);
        }
        if(searchInput) searchInput.focus();
      });
    }

    // 2. Dropdown Filters
    const stateSelect = document.getElementById('sniper-state-select');
    if(stateSelect){
      stateSelect.addEventListener('change', () => {
        filterState = stateSelect.value;
        filterCity = ''; // Reset city filter when state changes
        populateCitiesDropdown();
        loadPage(1);
      });
    }

    const citySelect = document.getElementById('sniper-city-select');
    if(citySelect){
      citySelect.addEventListener('change', () => {
        filterCity = citySelect.value;
        loadPage(1);
      });
    }

    const typeSelect = document.getElementById('sniper-type-select');
    if(typeSelect){
      typeSelect.addEventListener('change', () => {
        filterType = typeSelect.value;
        loadPage(1);
      });
    }

    const dateSelect = document.getElementById('sniper-date-select');
    if(dateSelect){
      dateSelect.addEventListener('change', () => {
        filterDate = dateSelect.value;
        loadPage(1);
      });
    }

    const compSelect = document.getElementById('sniper-compliance-select');
    if(compSelect){
      compSelect.addEventListener('change', () => {
        filterCompliance = compSelect.value;
        loadPage(1);
      });
    }

    const resetFiltersBtn = document.getElementById('sniper-btn-reset-filters');
    if(resetFiltersBtn){
      resetFiltersBtn.addEventListener('click', resetAllFilters);
    }

    // 3. Page Size Selector
    const pageSizeSelect = document.getElementById('sniper-page-size-select');
    if(pageSizeSelect){
      pageSizeSelect.value = '48';
      pageSizeSelect.addEventListener('change', () => {
        pageSize = parseInt(pageSizeSelect.value, 10) || 48;
        loadPage(1);
      });
    }

    // 4. Pagination Buttons
    const btnFirst = document.getElementById('sniper-page-first');
    if(btnFirst) btnFirst.addEventListener('click', () => loadPage(1));

    const btnPrev = document.getElementById('sniper-page-prev');
    if(btnPrev) btnPrev.addEventListener('click', () => loadPage(currentPage - 1));

    const btnNext = document.getElementById('sniper-page-next');
    if(btnNext) btnNext.addEventListener('click', () => loadPage(currentPage + 1));

    const btnLast = document.getElementById('sniper-page-last');
    if(btnLast) btnLast.addEventListener('click', () => loadPage(totalPages));

    // Bottom Pagination
    const btnFirstBottom = document.getElementById('sniper-page-first-bottom');
    if(btnFirstBottom) btnFirstBottom.addEventListener('click', () => loadPage(1));

    const btnPrevBottom = document.getElementById('sniper-page-prev-bottom');
    if(btnPrevBottom) btnPrevBottom.addEventListener('click', () => loadPage(currentPage - 1));

    const btnNextBottom = document.getElementById('sniper-page-next-bottom');
    if(btnNextBottom) btnNextBottom.addEventListener('click', () => loadPage(currentPage + 1));

    const btnLastBottom = document.getElementById('sniper-page-last-bottom');
    if(btnLastBottom) btnLastBottom.addEventListener('click', () => loadPage(totalPages));

    // Jump to Page
    const jumpInput = document.getElementById('sniper-jump-input');
    const jumpBtn = document.getElementById('sniper-jump-btn');
    const handleJump = () => {
      const pageVal = parseInt(jumpInput?.value, 10);
      if(!isNaN(pageVal) && pageVal >= 1 && pageVal <= totalPages){
        loadPage(pageVal);
      }
    };
    if(jumpBtn) jumpBtn.addEventListener('click', handleJump);
    if(jumpInput){
      jumpInput.addEventListener('keydown', (e) => {
        if(e.key === 'Enter') handleJump();
      });
    }

    // Stage Page Button
    const stagePageBtn = document.getElementById('sniper-btn-stage-page');
    if(stagePageBtn){
      stagePageBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleStagePage();
      });
    }

    // Scroll to Top Floating Button
    const scrollTopBtn = document.getElementById('sniper-scroll-top-btn');
    const gridViewport = document.getElementById('sniper-grid-viewport');
    if(gridViewport && scrollTopBtn){
      gridViewport.addEventListener('scroll', () => {
        if(gridViewport.scrollTop > 350){
          scrollTopBtn.style.display = 'inline-flex';
        } else {
          scrollTopBtn.style.display = 'none';
        }
      }, { passive: true });

      scrollTopBtn.addEventListener('click', () => {
        gridViewport.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // 5. System Scanner & Similar Watermarks
    const scanBtn = document.getElementById('sniper-btn-scan');
    if(scanBtn) scanBtn.addEventListener('click', runSystemScan);

    const stageScanBtn = document.getElementById('sniper-btn-stage-scan-flagged');
    if(stageScanBtn) stageScanBtn.addEventListener('click', stageAllScannedViolations);

    const dismissScanBtn = document.getElementById('sniper-btn-dismiss-scan');
    if(dismissScanBtn){
      dismissScanBtn.addEventListener('click', () => {
        const scanBanner = document.getElementById('sniper-scan-banner');
        if(scanBanner) scanBanner.style.display = 'none';
      });
    }

    const stageMatchesBtn = document.getElementById('sniper-btn-stage-matches');
    if(stageMatchesBtn) stageMatchesBtn.addEventListener('click', stageAllSimilarOnPage);

    const resetPrioBtn = document.getElementById('sniper-btn-reset-prio');
    if(resetPrioBtn){
      resetPrioBtn.addEventListener('click', () => {
        const banner = document.getElementById('sniper-priority-banner');
        if(banner) banner.style.display = 'none';
        similarityPrioritized = false;
      });
    }

    // 6. Delete & Queue Actions
    const deleteBtn = document.getElementById('sniper-btn-delete');
    if(deleteBtn) deleteBtn.addEventListener('click', openDeleteConfirmationModal);

    const clearBtn = document.getElementById('sniper-btn-clear');
    if(clearBtn) clearBtn.addEventListener('click', clearQueue);

    // Modal Actions
    const modalConfirmBtn = document.getElementById('sniper-btn-modal-confirm');
    if(modalConfirmBtn) modalConfirmBtn.addEventListener('click', performCascadingDeletion);

    const modalCancelBtn = document.getElementById('sniper-btn-modal-cancel');
    if(modalCancelBtn) modalCancelBtn.addEventListener('click', closeDeleteConfirmationModal);

    const modalCloseBtn = document.getElementById('sniper-modal-close-btn');
    if(modalCloseBtn) modalCloseBtn.addEventListener('click', closeDeleteConfirmationModal);

    // ─── Batch & Mode Switcher Listeners ────────────────────────────────────
    const tabModePublic = document.getElementById('mode-tab-public');
    if(tabModePublic){
      tabModePublic.addEventListener('click', () => switchSniperMode('public'));
    }

    const tabModePrivate = document.getElementById('mode-tab-private');
    if(tabModePrivate){
      tabModePrivate.addEventListener('click', () => switchSniperMode('private'));
    }

    const privateSourceSelect = document.getElementById('sniper-private-source-select');
    if(privateSourceSelect){
      privateSourceSelect.addEventListener('change', () => {
        const val = privateSourceSelect.value || '';
        if(val.startsWith('batch:')){
          loadBatchMode({ pBatchId: val.slice(6) });
        } else if(val.startsWith('share_id:')){
          loadBatchMode({ pShareId: val.slice(9) });
        } else if(val.startsWith('share_token:')){
          loadBatchMode({ pShareToken: val.slice(12) });
        } else {
          loadBatchMode({ pScope: 'private_placement' });
        }
      });
    }

    const batchExitLink = document.getElementById('sniper-batch-exit-link');
    if(batchExitLink){
      batchExitLink.addEventListener('click', (e) => {
        e.preventDefault();
        switchSniperMode('public');
      });
    }

    const batchPropSelect = document.getElementById('sniper-batch-prop-select');
    if(batchPropSelect){
      batchPropSelect.addEventListener('change', () => {
        selectedBatchPropId = batchPropSelect.value;
        renderBatchGrid();
      });
    }

    const edgeBtn = document.getElementById('sniper-btn-edge-mode');
    if(edgeBtn){
      edgeBtn.addEventListener('click', () => toggleEdgeContainMode());
    }

    const stripEdgeBtn = document.getElementById('sniper-strip-edge-btn');
    if(stripEdgeBtn){
      stripEdgeBtn.addEventListener('click', () => toggleEdgeContainMode());
    }

    const stripTrashBtn = document.getElementById('sniper-strip-trash-btn');
    if(stripTrashBtn){
      stripTrashBtn.addEventListener('click', () => {
        switchSidebarTab('trash');
        toggleSidebar(true);
      });
    }

    const stripDrawerBtn = document.getElementById('sniper-strip-drawer-btn');
    if(stripDrawerBtn){
      stripDrawerBtn.addEventListener('click', () => toggleSidebar());
    }

    const batchTrashBtn = document.getElementById('sniper-btn-batch-trash');
    if(batchTrashBtn){
      batchTrashBtn.addEventListener('click', () => {
        switchSidebarTab('trash');
        toggleSidebar(true);
      });
    }

    const topTrashStat = document.getElementById('sniper-trash-stat');
    if(topTrashStat){
      topTrashStat.addEventListener('click', () => {
        switchSidebarTab('trash');
        toggleSidebar(true);
      });
    }

    // Sidebar Tab Switches
    const tabInspector = document.getElementById('tab-btn-inspector');
    if(tabInspector) tabInspector.addEventListener('click', () => switchSidebarTab('inspector'));

    const tabTrash = document.getElementById('tab-btn-trash');
    if(tabTrash) tabTrash.addEventListener('click', () => switchSidebarTab('trash'));

    const tabQueue = document.getElementById('tab-btn-queue');
    if(tabQueue) tabQueue.addEventListener('click', () => switchSidebarTab('queue'));

    // Inspector Action Buttons
    const btnDelActivePhoto = document.getElementById('inspector-btn-del-active-photo');
    if(btnDelActivePhoto){
      btnDelActivePhoto.addEventListener('click', () => {
        if(activeInspectedPhoto) confirmDeleteSinglePhoto(activeInspectedPhoto);
      });
    }

    const btnDelListing = document.getElementById('inspector-btn-delete-listing');
    if(btnDelListing){
      btnDelListing.addEventListener('click', () => {
        if(activeInspectedProperty) confirmDeleteEntireListing(activeInspectedProperty);
      });
    }

    // Single Photo Delete Modal Listeners
    const photoCloseBtn = document.getElementById('modal-photo-close-btn');
    if(photoCloseBtn) photoCloseBtn.addEventListener('click', closeDeletePhotoModal);

    const photoCancelBtn = document.getElementById('modal-photo-cancel-btn');
    if(photoCancelBtn) photoCancelBtn.addEventListener('click', closeDeletePhotoModal);

    const photoConfirmBtn = document.getElementById('modal-photo-confirm-btn');
    if(photoConfirmBtn) photoConfirmBtn.addEventListener('click', executeDeleteSinglePhoto);

    // Entire Listing Delete Modal Listeners
    const listingCloseBtn = document.getElementById('modal-listing-close-btn');
    if(listingCloseBtn) listingCloseBtn.addEventListener('click', closeDeleteListingModal);

    const listingCancelBtn = document.getElementById('modal-listing-cancel-btn');
    if(listingCancelBtn) listingCancelBtn.addEventListener('click', closeDeleteListingModal);

    const listingConfirmBtn = document.getElementById('modal-listing-confirm-btn');
    if(listingConfirmBtn) listingConfirmBtn.addEventListener('click', executeDeleteEntireListing);


    // 7. Grid Density Switcher (Medium by default)
    function setGridDensity(density){
      const grid = document.getElementById('sniper-grid');
      const buttons = document.querySelectorAll('.sniper-density-btn[data-density]');
      if(!grid) return;
      grid.classList.remove('density-large', 'density-medium', 'density-compact');
      grid.classList.add(`density-${density}`);
      buttons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.density === density);
      });
      try {
        localStorage.setItem('sniper_grid_density', density);
      } catch(_) {}
    }

    const densityButtons = document.querySelectorAll('.sniper-density-btn[data-density]');
    densityButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const d = btn.dataset.density || 'medium';
        setGridDensity(d);
      });
    });

    const savedDensity = localStorage.getItem('sniper_grid_density') || 'medium';
    setGridDensity(savedDensity);

    // 8. Focus / Zen Mode Toggle
    function toggleFocusMode(forceState){
      const col = document.getElementById('sniper-gallery-column');
      const focusBtn = document.getElementById('sniper-btn-focus');
      if(!col) return;
      const isFocus = forceState !== undefined ? forceState : !col.classList.contains('focus-mode');
      col.classList.toggle('focus-mode', isFocus);
      if(focusBtn) {
        focusBtn.classList.toggle('active', isFocus);
        focusBtn.title = isFocus ? 'Exit Focus Mode (Z)' : 'Toggle Focus Mode (Z)';
      }
      toastSafe(isFocus ? 'Focus Mode active (filters minimized, press Z to restore)' : 'Focus Mode deactivated', 'info', 2000);
    }

    const focusBtn = document.getElementById('sniper-btn-focus');
    if(focusBtn){
      focusBtn.addEventListener('click', () => toggleFocusMode());
    }

    // 9. Staging Queue / Inspector Drawer Toggle (+ Mobile Bottom Sheet Backdrop)
    function toggleSidebar(forceOpen){
      const sidebar = document.getElementById('sniper-sidebar');
      const queueBtn = document.getElementById('sniper-btn-queue-toggle');
      const mobileBackdrop = document.getElementById('sniper-mobile-backdrop');
      if(!sidebar) return;
      const shouldOpen = forceOpen !== undefined ? forceOpen : sidebar.classList.contains('collapsed');
      if(shouldOpen){
        sidebar.classList.remove('collapsed');
        if(queueBtn) queueBtn.classList.add('active');
        if(mobileBackdrop && window.innerWidth <= 900){
          mobileBackdrop.classList.add('visible');
        }
      } else {
        sidebar.classList.add('collapsed');
        if(queueBtn) queueBtn.classList.remove('active');
        if(mobileBackdrop){
          mobileBackdrop.classList.remove('visible');
        }
      }
      try {
        if(!isBatchMode){
          localStorage.setItem('sniper_drawer_open', shouldOpen ? '1' : '0');
        }
      } catch(_) {}
    }
    toggleSidebarRef = toggleSidebar;

    const queueToggleBtn = document.getElementById('sniper-btn-queue-toggle');
    if(queueToggleBtn){
      queueToggleBtn.addEventListener('click', () => {
        if(!isBatchMode) switchSidebarTab('queue');
        toggleSidebar();
      });
    }

    const stagedStatPill = document.getElementById('sniper-staged-stat');
    if(stagedStatPill){
      stagedStatPill.addEventListener('click', () => {
        switchSidebarTab('queue');
        toggleSidebar(true);
      });
    }

    const sidebarCloseBtn = document.getElementById('sniper-sidebar-close-btn');
    if(sidebarCloseBtn){
      sidebarCloseBtn.addEventListener('click', () => toggleSidebar(false));
    }

    const mobileBackdrop = document.getElementById('sniper-mobile-backdrop');
    if(mobileBackdrop){
      mobileBackdrop.addEventListener('click', () => toggleSidebar(false));
    }

    const sheetHandle = document.querySelector('.sniper-sheet-handle');
    if(sheetHandle){
      sheetHandle.addEventListener('click', () => toggleSidebar(false));
    }

    const drawerToggle = document.getElementById('sniper-toggle-drawer');
    if(drawerToggle){
      drawerToggle.addEventListener('click', () => toggleSidebar());
    }

    // Initial Drawer State: collapsed by default on mobile / catalog to maximize photo canvas
    const initialDrawerOpen = localStorage.getItem('sniper_drawer_open');
    if(initialDrawerOpen === '1' && window.innerWidth > 900){
      toggleSidebar(true);
    } else {
      toggleSidebar(false);
    }

    // 10. Fullscreen Toggle
    const fsBtn = document.getElementById('sniper-btn-fullscreen');
    if(fsBtn){
      fsBtn.addEventListener('click', () => {
        if(!document.fullscreenElement){
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }

    // 11. Keyboard Shortcuts Dialog
    const shortcutsBtn = document.getElementById('sniper-btn-shortcuts');
    const shortcutsModal = document.getElementById('sniper-shortcuts-modal');
    const shortcutsClose = document.getElementById('sniper-shortcuts-close-btn');

    if(shortcutsBtn && shortcutsModal){
      shortcutsBtn.addEventListener('click', () => shortcutsModal.style.display = 'flex');
    }
    if(shortcutsClose && shortcutsModal){
      shortcutsClose.addEventListener('click', () => shortcutsModal.style.display = 'none');
    }

    // Global Key Bindings
    window.addEventListener('keydown', (e) => {
      if(['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) {
        if(e.key === 'Escape') e.target.blur();
        return;
      }

      if(e.key === 'ArrowLeft' || e.key === 'PageUp'){
        if(!isBatchMode && currentPage > 1) loadPage(currentPage - 1);
      } else if(e.key === 'ArrowRight' || e.key === 'PageDown'){
        if(!isBatchMode && currentPage < totalPages) loadPage(currentPage + 1);
      } else if(e.key === 's' || e.key === 'S'){
        e.preventDefault();
        toggleSidebar();
      } else if(e.key === 'z' || e.key === 'Z'){
        e.preventDefault();
        toggleFocusMode();
      } else if(e.key === '1'){
        e.preventDefault();
        setGridDensity('compact');
      } else if(e.key === '2'){
        e.preventDefault();
        setGridDensity('medium');
      } else if(e.key === '3'){
        e.preventDefault();
        setGridDensity('large');
      } else if(e.key === '/'){
        e.preventDefault();
        const inp = document.getElementById('sniper-search-input');
        if(inp) inp.focus();
      } else if(e.key === 'Escape'){
        closeDeleteConfirmationModal();
        closeDeletePhotoModal();
        closeDeleteListingModal();
        if(shortcutsModal) shortcutsModal.style.display = 'none';
        const sidebar = document.getElementById('sniper-sidebar');
        if(sidebar && !sidebar.classList.contains('collapsed')){
          toggleSidebar(false);
        }
      } else if((e.key === 'Delete' || e.key === 'Backspace') && queuedProperties.size > 0){
        openDeleteConfirmationModal();
      } else if(e.key === '?'){
        if(shortcutsModal) shortcutsModal.style.display = 'flex';
      }
    });
  }

  // ─── URL Scope Router ─────────────────────────────────────────────────────
  function parseSniperRoute(){
    const urlParams = new URLSearchParams(window.location.search);
    const hashStr = window.location.hash.replace(/^#/, '');
    const hashParams = new URLSearchParams(hashStr);
    return {
      urlParams,
      paramShare: urlParams.get('share') || hashParams.get('share') || (hashStr.startsWith('share=') ? hashStr.slice(6) : null),
      paramShareId: urlParams.get('share_id') || hashParams.get('share_id') || null,
      paramBatch: urlParams.get('batch') || hashParams.get('batch') || (hashStr.startsWith('batch=') ? hashStr.slice(6) : null),
      paramPropertyId: urlParams.get('property_id') || hashParams.get('property_id') || null,
      paramScope: urlParams.get('scope') || hashParams.get('scope') || null,
      paramTab: urlParams.get('tab') || hashParams.get('tab') || null
    };
  }

  // ─── Boot Sequence ─────────────────────────────────────────────────────────
  async function boot(){
    await waitReady(12000);
    S = window.AdminShell || window.CPShell;

    let isAdminUser = false;
    try {
      if(window.CP && CP.Auth){
        if(typeof CP.Auth.isAdmin === 'function'){
          isAdminUser = await CP.Auth.isAdmin().catch(() => false);
        }
        if(typeof CP.Auth.getUser === 'function'){
          const user = await CP.Auth.getUser().catch(() => null);
          const nameEl = document.getElementById('admin-name');
          if(nameEl && user?.email) nameEl.textContent = user.email;
        }
      }
    } catch(_) {}

    initUI();

    if(!isAdminUser){
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
      const grid = document.getElementById('sniper-grid');
      if(grid){
        grid.innerHTML = `
          <div style="grid-column:1/-1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:56px 20px;text-align:center;color:var(--sniper-text-muted);">
            <div style="font-size:2.2rem;margin-bottom:10px">🔒</div>
            <h2 style="font-size:1.15rem;color:var(--sniper-text);margin:0 0 8px">Admin Sign-In Required</h2>
            <p style="font-size:0.875rem;max-width:420px;margin:0 0 18px;line-height:1.5">
              Sign in with your Choice Properties admin account to inspect private placement photos, delete individual images, or restore listings from 24h Trash.
            </p>
            <a href="/admin/login.html?returnTo=${returnTo}" style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:var(--sniper-primary);color:#fff;border-radius:8px;font-size:0.875rem;font-weight:700;text-decoration:none;box-shadow:0 4px 12px rgba(0,106,255,0.35);">
              Sign In to Admin Console →
            </a>
          </div>
        `;
      }
      const statTotal = document.getElementById('stat-total-catalog');
      if(statTotal) statTotal.textContent = 'Sign-In Required';
      return;
    }

    window.addEventListener('hashchange', () => {
      const r = parseSniperRoute();
      if(r.paramShare || r.paramBatch || r.paramShareId){
        loadBatchMode({
          pBatchId: r.paramBatch,
          pShareToken: r.paramShare,
          pShareId: r.paramShareId,
          pPropertyId: r.paramPropertyId,
          pScope: r.paramScope,
          autoOpenTab: r.paramTab
        });
      }
    });

    const route = parseSniperRoute();
    const { urlParams, paramShare, paramShareId, paramBatch, paramPropertyId, paramScope, paramTab } = route;

    // Preload private placement switcher options in background
    loadPrivateCollections().catch(() => {});

    if(paramShare || paramShareId || paramBatch || paramPropertyId || paramScope === 'private_placement'){
      await loadBatchMode({
        pBatchId: paramBatch,
        pShareToken: paramShare,
        pShareId: paramShareId,
        pPropertyId: paramPropertyId,
        pScope: paramScope,
        autoOpenTab: paramTab
      });
      return;
    }

    sniperMode = 'public';
    syncModeStripUI();
    await loadFilterOptions();

    if(urlParams.has('state')) {
      filterState = urlParams.get('state');
      const el = document.getElementById('sniper-state-select');
      if(el) el.value = filterState;
      populateCitiesDropdown();
    }
    if(urlParams.has('city')) {
      filterCity = urlParams.get('city');
      const el = document.getElementById('sniper-city-select');
      if(el) el.value = filterCity;
    }
    if(urlParams.has('type')) {
      filterType = urlParams.get('type');
      const el = document.getElementById('sniper-type-select');
      if(el) el.value = filterType;
    }
    if(urlParams.has('compliance')) {
      filterCompliance = urlParams.get('compliance');
      const el = document.getElementById('sniper-compliance-select');
      if(el) el.value = filterCompliance;
    }
    if(urlParams.has('search')) {
      searchQuery = urlParams.get('search');
      const el = document.getElementById('sniper-search-input');
      if(el) el.value = searchQuery;
    }

    await loadPage(1);
    await fetchRecoverableTrash();
    startTrashTimer();

    if(paramTab){
      switchSidebarTab(paramTab);
      if(toggleSidebarRef) toggleSidebarRef(true);
    }
  }

  if(document.readyState !== 'loading'){
    boot();
  } else {
    document.addEventListener('DOMContentLoaded', boot);
  }

})();
