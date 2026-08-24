(function(){
  'use strict';

  function readyDeps(){ return window.AdminShell && window.CP && CP.sb && CP.Auth; }
  function waitReady(ms){
    return new Promise((res,rej)=>{
      const start=Date.now();
      (function tick(){
        if(readyDeps()) return res();
        if(Date.now()-start>ms) return rej(new Error('Admin tools failed to load.'));
        setTimeout(tick,80);
      })();
    });
  }

  let S;
  let allProperties = [];
  let allImages = [];        // [{ url, propertyId, property }]
  let queuedPropertyIds = new Set();
  let searchQuery = '';
  let currentFilter = 'all'; // 'all' | 'flagged'
  let displayLimit = 120;     // Initial batch size for ultra-responsive DOM

  // ─── Image URL Helper (Fast & Micro-Data) ──────────────────────────────────
  function getThumbUrl(rawUrl){
    if(!rawUrl) return '';
    if(rawUrl.includes('ik.imagekit.io')){
      const clean = rawUrl.replace(/\?tr=[^&]+/, '').split('?')[0];
      return clean + '?tr=w-280,h-210,c-maintain_ratio,q-50,f-webp';
    }
    if(window.CONFIG && typeof CONFIG.img === 'function'){
      return CONFIG.img(rawUrl, 'thumb');
    }
    return rawUrl;
  }

  function getCoverUrl(rawUrl){
    if(!rawUrl) return '';
    if(rawUrl.includes('ik.imagekit.io')){
      const clean = rawUrl.replace(/\?tr=[^&]+/, '').split('?')[0];
      return clean + '?tr=w-120,h-120,c-maintain_ratio,q-50,f-webp';
    }
    return rawUrl;
  }

  // ─── Load Properties & Photos ──────────────────────────────────────────────
  async function load(){
    const okAuth = await S.requireAdmin();
    if(!okAuth) return;

    const loadingEl = document.getElementById('sniper-loading');
    if(loadingEl) loadingEl.style.display = 'flex';

    try {
      const { data, error } = await CP.sb()
        .from('properties')
        .select('id,title,address,city,state,zip,status,created_at,property_photos(id,url,display_order)')
        .order('created_at', { ascending: false });

      if(error) throw error;

      allProperties = data || [];
      allImages = [];

      allProperties.forEach(p => {
        const rawPhotos = Array.isArray(p.property_photos) ? p.property_photos : [];
        const sorted = rawPhotos.slice().sort((a,b) => (a.display_order||0) - (b.display_order||0));
        const validPhotos = sorted.filter(x => x.url);

        p.photos = validPhotos;
        p.coverUrl = validPhotos[0]?.url || '';

        validPhotos.forEach((photo) => {
          allImages.push({
            url: photo.url,
            propertyId: p.id,
            property: p
          });
        });
      });

      // Update header statistics
      updateStats();

      // Check if URL has ?property_id=
      const urlPid = new URLSearchParams(location.search).get('property_id');
      if(urlPid && allProperties.some(p => p.id === urlPid)){
        queuedPropertyIds.add(urlPid);
        renderQueue();
      }

      renderGrid();
    } catch(err){
      console.error('[watermark-sniper] load error:', err);
      S.toast('Failed to load properties: ' + err.message, 'error');
      const grid = document.getElementById('sniper-grid');
      if(grid){
        grid.innerHTML = '<div style="grid-column:1/-1;padding:40px;text-align:center;color:var(--danger)">'
          + '<h3>Failed to load properties</h3><p>'+S.esc(err.message)+'</p></div>';
      }
    } finally {
      if(loadingEl) loadingEl.style.display = 'none';
    }
  }

  function updateStats(){
    const statsProps = document.getElementById('stats-props');
    const statsImages = document.getElementById('stats-images');
    if(statsProps) statsProps.textContent = allProperties.length;
    if(statsImages) statsImages.textContent = allImages.length;
  }

  // ─── Filter & Search ───────────────────────────────────────────────────────
  function getVisibleImages(){
    let images = allImages;

    if(currentFilter === 'flagged'){
      images = images.filter(img => queuedPropertyIds.has(img.propertyId));
    }

    if(searchQuery.trim()){
      const q = searchQuery.trim().toLowerCase();
      images = images.filter(img => {
        const addr = (img.property.address || '').toLowerCase();
        const title = (img.property.title || '').toLowerCase();
        const city = (img.property.city || '').toLowerCase();
        const pid = (img.propertyId || '').toLowerCase();
        return addr.includes(q) || title.includes(q) || city.includes(q) || pid.includes(q);
      });
    }

    return images;
  }

  // ─── Render Photo Wall Grid ────────────────────────────────────────────────
  function renderGrid(){
    const grid = document.getElementById('sniper-grid');
    if(!grid) return;

    const visible = getVisibleImages();
    const slice = visible.slice(0, displayLimit);

    if(!slice.length){
      grid.innerHTML = `<div style="grid-column:1/-1;padding:60px 20px;text-align:center;color:var(--muted)">
        <svg style="width:48px;height:48px;margin:0 auto 12px;opacity:.4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
        <h3 style="font-size:1.1rem;font-weight:700;color:var(--text);margin:0 0 6px">No photos found</h3>
        <p style="font-size:.875rem;margin:0">${searchQuery ? 'No listings match "'+S.esc(searchQuery)+'".' : 'No photos to display.'}</p>
      </div>`;
      return;
    }

    const frag = document.createDocumentFragment();

    slice.forEach((item, index) => {
      const isFlagged = queuedPropertyIds.has(item.propertyId);
      const card = document.createElement('div');
      card.className = 'sniper-card' + (isFlagged ? ' flagged' : '');
      card.dataset.pid = item.propertyId;
      card.dataset.idx = index;

      const thumbUrl = getThumbUrl(item.url);
      const addr = item.property.address || item.property.title || 'Property';

      card.innerHTML = `
        <img src="${S.esc(thumbUrl)}" alt="${S.esc(addr)}" loading="lazy" width="280" height="210">
        <span class="sniper-flag-badge">Flagged</span>
        <div class="sniper-card-caption">${S.esc(addr)}</div>
      `;

      card.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleProperty(item.propertyId);
      });

      frag.appendChild(card);
    });

    grid.innerHTML = '';
    grid.appendChild(frag);

    // Load More Button if images remain
    if(visible.length > displayLimit){
      const remaining = visible.length - displayLimit;
      const loadMoreWrap = document.createElement('div');
      loadMoreWrap.style.gridColumn = '1 / -1';
      loadMoreWrap.style.padding = '20px 0 10px';
      loadMoreWrap.style.textAlign = 'center';

      const loadMoreBtn = document.createElement('button');
      loadMoreBtn.className = 'btn btn-secondary';
      loadMoreBtn.style.padding = '10px 24px';
      loadMoreBtn.style.fontWeight = '700';
      loadMoreBtn.textContent = `Load more photos (${remaining} remaining)`;
      loadMoreBtn.addEventListener('click', () => {
        displayLimit += 120;
        renderGrid();
      });

      loadMoreWrap.appendChild(loadMoreBtn);
      grid.appendChild(loadMoreWrap);
    }
  }

  // ─── Selection & Staging Queue ─────────────────────────────────────────────
  function toggleProperty(propertyId){
    if(queuedPropertyIds.has(propertyId)){
      queuedPropertyIds.delete(propertyId);
    } else {
      queuedPropertyIds.add(propertyId);
    }

    // Update visuals on all images associated with this property across the DOM
    updateGridVisuals(propertyId);
    renderQueue();
  }

  function updateGridVisuals(targetPid){
    const grid = document.getElementById('sniper-grid');
    if(!grid) return;

    if(targetPid){
      const cards = grid.querySelectorAll(`.sniper-card[data-pid="${targetPid}"]`);
      const isFlagged = queuedPropertyIds.has(targetPid);
      cards.forEach(card => {
        card.classList.toggle('flagged', isFlagged);
      });
    } else {
      const cards = grid.querySelectorAll('.sniper-card');
      cards.forEach(card => {
        const isFlagged = queuedPropertyIds.has(card.dataset.pid);
        card.classList.toggle('flagged', isFlagged);
      });
    }
  }

  function renderQueue(){
    const count = queuedPropertyIds.size;
    const queueList = document.getElementById('sniper-queue-list');
    const emptyMsg = document.getElementById('sniper-empty-queue');
    const deleteBtn = document.getElementById('sniper-btn-delete');
    const clearBtn = document.getElementById('sniper-btn-clear');
    const queueBadge = document.getElementById('sniper-queue-badge');
    const deleteCountText = document.getElementById('sniper-del-count');

    if(queueBadge) queueBadge.textContent = count;
    if(deleteCountText) deleteCountText.textContent = count > 0 ? `(${count})` : '';
    if(deleteBtn) deleteBtn.disabled = count === 0;
    if(clearBtn) clearBtn.disabled = count === 0;

    if(!queueList) return;

    if(count === 0){
      if(emptyMsg) emptyMsg.style.display = 'block';
      // Remove any rendered items
      queueList.querySelectorAll('.sniper-queue-item').forEach(el => el.remove());
      return;
    }

    if(emptyMsg) emptyMsg.style.display = 'none';

    // Clear previous items
    queueList.querySelectorAll('.sniper-queue-item').forEach(el => el.remove());

    const frag = document.createDocumentFragment();

    queuedPropertyIds.forEach(pid => {
      const prop = allProperties.find(p => p.id === pid);
      if(!prop) return;

      const item = document.createElement('div');
      item.className = 'sniper-queue-item';

      const coverUrl = getCoverUrl(prop.coverUrl);
      const addr = prop.address || prop.title || 'Unknown Address';
      const cityState = [prop.city, prop.state].filter(Boolean).join(', ');

      item.innerHTML = `
        <img class="sniper-queue-thumb" src="${S.esc(coverUrl)}" alt="Cover" loading="lazy" width="54" height="54">
        <div class="sniper-queue-info">
          <div class="sniper-queue-addr" title="${S.esc(addr)}">${S.esc(addr)}</div>
          <div class="sniper-queue-meta">
            <span>${S.esc(cityState || 'ID: ' + prop.id.slice(0,8))}</span>
            <span>•</span>
            <a class="sniper-queue-link" href="/property.html?id=${encodeURIComponent(prop.id)}" target="_blank" rel="noopener">View Live ↗</a>
          </div>
        </div>
        <button class="sniper-queue-remove" title="Remove from queue" aria-label="Remove property">
          <svg style="width:18px;height:18px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      `;

      item.querySelector('.sniper-queue-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleProperty(pid);
      });

      frag.appendChild(item);
    });

    queueList.appendChild(frag);
  }

  function clearQueue(){
    queuedPropertyIds.clear();
    updateGridVisuals();
    renderQueue();
    S.toast('Staging queue cleared.', 'info');
  }

  // ─── Delete Execution ──────────────────────────────────────────────────────
  async function executeDelete(){
    const count = queuedPropertyIds.size;
    if(count === 0) return;

    const ids = Array.from(queuedPropertyIds);
    const confirmed = await S.confirm({
      title: `Permanently Delete ${count} Propert${count === 1 ? 'y' : 'ies'}?`,
      message: `You are about to permanently delete ${count} flagged listings and all of their photos from the database. This action cannot be undone.`,
      ok: `Delete ${count} Propert${count === 1 ? 'y' : 'ies'}`,
      danger: true
    });

    if(!confirmed) return;

    const deleteBtn = document.getElementById('sniper-btn-delete');
    if(deleteBtn){
      deleteBtn.disabled = true;
      deleteBtn.textContent = 'Deleting…';
    }

    let succeeded = 0;
    let failed = 0;

    try {
      // Use cascading delete RPC
      const { error } = await CP.sb().rpc('delete_properties_cascade', { p_ids: ids });
      if(!error){
        succeeded = ids.length;
      } else {
        console.warn('[watermark-sniper] RPC failed, falling back to direct delete:', error);
        for(const id of ids){
          const { error: dErr } = await CP.sb().from('properties').delete().eq('id', id);
          if(dErr) failed++; else succeeded++;
        }
      }
    } catch(err){
      console.error('[watermark-sniper] deletion exception:', err);
      for(const id of ids){
        const { error: dErr } = await CP.sb().from('properties').delete().eq('id', id);
        if(dErr) failed++; else succeeded++;
      }
    }

    if(succeeded > 0){
      const delSet = new Set(ids);
      allProperties = allProperties.filter(p => !delSet.has(p.id));
      allImages = allImages.filter(img => !delSet.has(img.propertyId));
      queuedPropertyIds.clear();

      updateStats();
      renderQueue();
      renderGrid();

      S.toast(`${succeeded} flagged propert${succeeded === 1 ? 'y' : 'ies'} permanently deleted.`, 'success');
    }

    if(failed > 0){
      S.toast(`${failed} propert${failed === 1 ? 'y' : 'ies'} failed to delete.`, 'error');
    }

    if(deleteBtn){
      deleteBtn.textContent = 'Delete Flagged Properties';
      deleteBtn.disabled = queuedPropertyIds.size === 0;
    }
  }

  // ─── Boot & Event Bindings ─────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', async () => {
    try { await waitReady(8000); }
    catch(e){
      const grid = document.getElementById('sniper-grid');
      if(grid){
        grid.innerHTML = '<div style="grid-column:1/-1;padding:40px;text-align:center;color:var(--danger)">'
          + '<h3>Could not load admin shell</h3><p>'+e.message+'</p></div>';
      }
      return;
    }

    S = window.AdminShell;

    // Mobile Drawer Header Toggle
    const sidebar = document.getElementById('sniper-sidebar');
    const sidebarHeader = document.getElementById('sniper-sidebar-header');
    const toggleIcon = document.getElementById('sniper-toggle-icon');

    if(sidebarHeader && sidebar){
      sidebarHeader.addEventListener('click', () => {
        if(window.innerWidth < 900){
          const isExpanded = sidebar.classList.toggle('expanded');
          if(toggleIcon){
            toggleIcon.innerHTML = isExpanded
              ? '<svg style="width:20px;height:20px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>'
              : '<svg style="width:20px;height:20px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>';
          }
        }
      });
    }

    // Search Input
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
          displayLimit = 120;
          renderGrid();
        }, 100);
      });
    }

    if(searchClear){
      searchClear.addEventListener('click', () => {
        if(searchInput) searchInput.value = '';
        searchClear.style.display = 'none';
        searchQuery = '';
        displayLimit = 120;
        renderGrid();
        if(searchInput) searchInput.focus();
      });
    }

    // Filter Tabs (All vs Flagged)
    const tabAll = document.getElementById('tab-filter-all');
    const tabFlagged = document.getElementById('tab-filter-flagged');

    if(tabAll && tabFlagged){
      tabAll.addEventListener('click', () => {
        tabAll.classList.add('active');
        tabFlagged.classList.remove('active');
        currentFilter = 'all';
        displayLimit = 120;
        renderGrid();
      });

      tabFlagged.addEventListener('click', () => {
        tabFlagged.classList.add('active');
        tabAll.classList.remove('active');
        currentFilter = 'flagged';
        displayLimit = 120;
        renderGrid();
      });
    }

    // Buttons
    const deleteBtn = document.getElementById('sniper-btn-delete');
    if(deleteBtn) deleteBtn.addEventListener('click', executeDelete);

    const clearBtn = document.getElementById('sniper-btn-clear');
    if(clearBtn) clearBtn.addEventListener('click', clearQueue);

    await load();
  });

})();
