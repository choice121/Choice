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
  let pageSize = 50;
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

  function getThumbUrl(rawUrl){
    if(!rawUrl || typeof rawUrl !== 'string') return '';
    if(rawUrl.includes('ik.imagekit.io')){
      const clean = rawUrl.replace(/\?tr=[^&]+/, '').split('?')[0];
      return clean + '?tr=w-320,h-240,c-maintain_ratio,q-60,f-webp';
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
      return clean + '?tr=w-90,h-90,c-maintain_ratio,q-50,f-webp';
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

  // ─── Filter Options Loader ────────────────────────────────────────────────
  async function loadFilterOptions(){
    try {
      const { data, error } = await CP.sb().rpc('get_watermark_sniper_filter_options');
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

  // ─── Catalog Loader (Database-Driven Full Pagination) ──────────────────────
  async function loadPage(pageIndex){
    if(pageIndex < 1) pageIndex = 1;
    currentPage = pageIndex;

    setLoading(true, `Querying page ${currentPage} of property inventory…`);

    const offset = (currentPage - 1) * pageSize;

    const rpcParams = {
      p_limit: pageSize,
      p_offset: offset,
      p_state: filterState ? filterState : null,
      p_city: filterCity ? filterCity : null,
      p_property_type: filterType ? filterType : null,
      p_date_filter: filterDate !== 'all' ? filterDate : null,
      p_photo_status: filterCompliance !== 'all' ? filterCompliance : null,
      p_search: searchQuery ? searchQuery.trim() : null
    };

    try {
      const { data, error } = await CP.sb().rpc('get_watermark_sniper_catalog', rpcParams);
      if(error) throw error;

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
      recalculateSimilarities();

    } catch(err){
      console.error('[watermark-sniper] Error fetching catalog page:', err);
      toastSafe('Failed to load inventory: ' + (err.message || 'Network error'), 'error');
      renderGridEmpty('Error loading properties. Please check your connection and retry.');
    } finally {
      setLoading(false);
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
              <img class="sniper-card-img" src="${displayPhotoUrl}" alt="${escSafe(p.address)}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
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
            <a href="/property.html?id=${encodeURIComponent(p.id)}" target="_blank" rel="noopener noreferrer" class="sniper-card-ext-btn" title="Open listing in new tab" aria-label="Open listing">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
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

      // Prevent external link click from triggering stage
      const extLink = card.querySelector('.sniper-card-ext-btn');
      if(extLink){
        extLink.addEventListener('click', (e) => e.stopPropagation());
      }

      // Card Click Handler
      card.addEventListener('click', (e) => {
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
            <img class="sniper-queue-thumb" src="${getSmallThumb(item.coverUrl)}" alt="" onerror="this.style.display='none'">
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
      const { data, error } = await CP.sb().rpc('scan_watermark_sniper_system');
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
        scanTitle.textContent = `Full System Scan Complete:`;
        scanMsg.textContent = `Identified ${scannedViolations.length} properties with watermarks or compliance violations across the entire database.`;
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
        queuedProperties.set(v.property_id, {
          id: v.property_id,
          title: v.address || 'Listing ' + v.property_id.slice(0, 8),
          address: v.address || 'Unknown Address',
          city: v.city || '',
          state: v.state || '',
          zip: v.zip || '',
          coverUrl: v.flagged_photo_url || '',
          photoCount: 1,
          reason: v.flagged_reason ? 'Watermark: ' + v.flagged_reason : 'System Scan Violation',
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

    renderQueue();
    toastSafe(`Staged all ${added} scanned violations into deletion queue.`, 'success');
  }

  // ─── Cascading Deletion & ImageKit Storage Cleanup ─────────────────────────
  function openDeleteConfirmationModal(){
    const count = queuedProperties.size;
    if(count === 0) return;

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
        const result = await CP.Properties.deleteCascadeBulk(chunk);
        if(result && result.ok && result.data){
          const dIds = Array.isArray(result.data.deleted_ids) ? result.data.deleted_ids : [];
          const numDeleted = typeof result.data.deleted === 'number' ? result.data.deleted : dIds.length;
          actuallyDeletedIds.push(...dIds);
          processedIds.push(...chunk);
          succeeded += numDeleted;

          // Asynchronous ImageKit purge per AGENTS.md rule 4.C
          const fileIds = Array.isArray(result.data.file_ids) ? result.data.file_ids : [];
          if(fileIds.length > 0 && typeof CONFIG !== 'undefined' && CONFIG.SUPABASE_URL){
            fileIds.forEach(fid => {
              if(!fid) return;
              fetch(`${CONFIG.SUPABASE_URL}/functions/v1/imagekit-delete`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': CONFIG.SUPABASE_ANON_KEY || authHeaderToken,
                  'Authorization': `Bearer ${authHeaderToken}`
                },
                body: JSON.stringify({ fileId: fid })
              }).catch(e => console.warn('[watermark-sniper] ImageKit remote delete error:', e));
            });
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
          loadPage(1);
        }, 250);
      });
    }

    if(searchClear){
      searchClear.addEventListener('click', () => {
        if(searchInput) searchInput.value = '';
        searchClear.style.display = 'none';
        searchQuery = '';
        loadPage(1);
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
      pageSizeSelect.addEventListener('change', () => {
        pageSize = parseInt(pageSizeSelect.value, 10) || 50;
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
    const btnPrevBottom = document.getElementById('sniper-page-prev-bottom');
    if(btnPrevBottom) btnPrevBottom.addEventListener('click', () => loadPage(currentPage - 1));

    const btnNextBottom = document.getElementById('sniper-page-next-bottom');
    if(btnNextBottom) btnNextBottom.addEventListener('click', () => loadPage(currentPage + 1));

    // Jump to Page
    const jumpInput = document.getElementById('sniper-jump-input');
    const jumpBtn = document.getElementById('sniper-jump-go');
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

    // 7. Grid Density Switcher
    function setGridDensity(density){
      const grid = document.getElementById('sniper-grid');
      const buttons = document.querySelectorAll('.sniper-density-btn');
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

    const densityButtons = document.querySelectorAll('.sniper-density-btn');
    densityButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const d = btn.dataset.density || 'large';
        setGridDensity(d);
      });
    });

    const savedDensity = localStorage.getItem('sniper_grid_density') || 'large';
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

    // 9. Staging Queue Drawer Toggle
    function toggleSidebar(forceOpen){
      const sidebar = document.getElementById('sniper-sidebar');
      const queueBtn = document.getElementById('sniper-btn-queue-toggle');
      if(!sidebar) return;
      const shouldOpen = forceOpen !== undefined ? forceOpen : sidebar.classList.contains('collapsed');
      if(shouldOpen){
        sidebar.classList.remove('collapsed');
        if(queueBtn) queueBtn.classList.add('active');
      } else {
        sidebar.classList.add('collapsed');
        if(queueBtn) queueBtn.classList.remove('active');
      }
      try {
        localStorage.setItem('sniper_drawer_open', shouldOpen ? '1' : '0');
      } catch(_) {}
    }

    const queueToggleBtn = document.getElementById('sniper-btn-queue-toggle');
    if(queueToggleBtn){
      queueToggleBtn.addEventListener('click', () => toggleSidebar());
    }

    const stagedStatPill = document.getElementById('sniper-staged-stat');
    if(stagedStatPill){
      stagedStatPill.addEventListener('click', () => toggleSidebar(true));
    }

    const sidebarCloseBtn = document.getElementById('sniper-sidebar-close-btn');
    if(sidebarCloseBtn){
      sidebarCloseBtn.addEventListener('click', () => toggleSidebar(false));
    }

    const drawerToggle = document.getElementById('sniper-toggle-drawer');
    if(drawerToggle){
      drawerToggle.addEventListener('click', () => toggleSidebar());
    }

    // Initial Drawer State: Default collapsed to maximize inspection space
    const initialDrawerOpen = localStorage.getItem('sniper_drawer_open');
    if(initialDrawerOpen === '1'){
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
      // Ignore if user is typing in an input or select
      if(['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) {
        if(e.key === 'Escape') e.target.blur();
        return;
      }

      if(e.key === 'ArrowLeft' || e.key === 'PageUp'){
        if(currentPage > 1) loadPage(currentPage - 1);
      } else if(e.key === 'ArrowRight' || e.key === 'PageDown'){
        if(currentPage < totalPages) loadPage(currentPage + 1);
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

  // ─── Boot Sequence ─────────────────────────────────────────────────────────
  async function boot(){
    await waitReady(12000);
    S = window.AdminShell || window.CPShell;

    if(S && typeof S.requireAdmin === 'function'){
      const okAuth = await S.requireAdmin().catch(() => false);
      if(!okAuth) return;
    }

    initUI();
    await loadFilterOptions();

    // Check if query params specify initial filters (e.g. ?city=Columbus or ?state=OH or ?compliance=zero_photos)
    const urlParams = new URLSearchParams(window.location.search);
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
  }

  if(document.readyState !== 'loading'){
    boot();
  } else {
    document.addEventListener('DOMContentLoaded', boot);
  }

})();
