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
  let allImages = [];            // [{ id, url, propertyId, property, tokens, providerSignature }]
  let queuedPropertyIds = new Set();
  let similarityPrioritized = true; // Automatically prioritize similar images when items are flagged
  let activeSimilarityProfile = null;
  let searchQuery = '';
  let currentFilter = 'all';     // 'all' | 'flagged'
  let displayLimit = 120;         // Initial batch size for ultra-responsive DOM

  // ─── Interior Photo Selection Helper ───────────────────────────────────────
  // Scraper/MLS ingestion standard:
  // - Photo 0 (display_order 0) is almost universally the front exterior / facade of the building.
  // - Photos 1, 2, 3... are interior rooms (living room, kitchen, bedroom, bathroom).
  // This helper selects exactly 1 representative interior photo per property, avoiding outside/exterior views.
  const EXTERIOR_KEYWORDS = [
    'exterior', 'front', 'facade', 'curb', 'street', 'building', 'outside',
    'aerial', 'drone', 'roof', 'yard', 'backyard', 'porch', 'driveway',
    'elevation', 'landscape', 'patio', 'deck', 'siding', 'lawn', 'garage_front'
  ];

  const INTERIOR_KEYWORDS = [
    'interior', 'kitchen', 'living', 'bath', 'bedroom', 'dining', 'room',
    'family', 'hall', 'foyer', 'den', 'office', 'closet', 'laundry',
    'suite', 'cabinet', 'appliance', 'sink', 'stove', 'floor', 'carpet',
    'hardwood', 'ceiling', 'stair', 'window', 'wall', 'oven', 'fridge',
    'refrigerator', 'tile', 'fireplace', 'counter', 'island'
  ];

  function selectInteriorPhoto(photos){
    if(!photos || !photos.length) return null;
    if(photos.length === 1) return photos[0];

    // Score each photo to find the most definitive interior photograph
    let bestPhoto = null;
    let bestScore = -9999;

    photos.forEach((ph, index) => {
      const urlLower = (ph.url || '').toLowerCase();
      let score = 0;

      // 1. Position-based scoring:
      // Index 0 is the front exterior hero shot across MLS/Zillow -> heavy penalty
      if(index === 0) {
        score -= 50;
      } else if(index === 1) {
        // Photo 1 is almost universally the primary interior living room or open kitchen
        score += 30;
      } else if(index === 2) {
        // Photo 2 is typically the kitchen or main living space
        score += 25;
      } else if(index === 3) {
        score += 20;
      } else {
        score += 10;
      }

      // 2. Keyword detection in URL/file path:
      for(const kw of INTERIOR_KEYWORDS){
        if(urlLower.includes(kw)){
          score += 40;
          break;
        }
      }

      for(const kw of EXTERIOR_KEYWORDS){
        if(urlLower.includes(kw)){
          score -= 60;
          break;
        }
      }

      if(score > bestScore){
        bestScore = score;
        bestPhoto = ph;
      }
    });

    return bestPhoto || photos[1] || photos[0];
  }

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

  // Extract structural tokens from URL / path / filename to identify common scrapers / sources
  function extractUrlSignature(url){
    if(!url) return '';
    try {
      const u = new URL(url, 'https://choice-properties.internal');
      const parts = u.pathname.split('/').filter(Boolean);
      // Folder structure or prefix (e.g. choice-properties/properties/...)
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

  // ─── Smart Similarity Engine ───────────────────────────────────────────────
  function recalculateSimilarities(){
    if(!similarityPrioritized || queuedPropertyIds.size === 0){
      activeSimilarityProfile = null;
      allImages.forEach(img => { img.similarityScore = 0; });
      updatePriorityBanner(0, 0);
      return;
    }

    // Build collective signature from all currently flagged properties and their images
    const flaggedProps = allProperties.filter(p => queuedPropertyIds.has(p.id));
    const flaggedImages = allImages.filter(img => queuedPropertyIds.has(img.propertyId));

    if(flaggedProps.length === 0){
      activeSimilarityProfile = null;
      allImages.forEach(img => { img.similarityScore = 0; });
      updatePriorityBanner(0, 0);
      return;
    }

    const landlordIds = new Set(flaggedProps.map(p => p.landlord_id).filter(Boolean));
    const urlSignatures = new Set(flaggedImages.map(img => img.urlSignature).filter(Boolean));
    const allFlaggedTokens = new Set();
    flaggedProps.forEach(p => {
      if(p.tokenSet){
        p.tokenSet.forEach(t => allFlaggedTokens.add(t));
      }
    });

    activeSimilarityProfile = {
      landlordIds,
      urlSignatures,
      tokens: allFlaggedTokens,
      flaggedCount: queuedPropertyIds.size
    };

    let similarImagesCount = 0;
    const matchingPropertyIds = new Set();

    // Compute similarity for all images
    allImages.forEach(img => {
      if(queuedPropertyIds.has(img.propertyId)){
        img.similarityScore = 1.0; // Currently flagged
        return;
      }

      let score = 0;
      const prop = img.property;

      // 1. Same Landlord / Scraper Source (+0.45)
      if(prop.landlord_id && landlordIds.has(prop.landlord_id)){
        score += 0.45;
      }

      // 2. URL Directory / Path Signature Match (+0.35)
      if(img.urlSignature && urlSignatures.has(img.urlSignature)){
        score += 0.35;
      }

      // 3. Token / Text Overlap (+0.25 max)
      if(prop.tokenSet && allFlaggedTokens.size > 0){
        let overlap = 0;
        prop.tokenSet.forEach(t => {
          if(allFlaggedTokens.has(t)) overlap++;
        });
        const ratio = Math.min(overlap / 4, 1.0);
        score += ratio * 0.25;
      }

      // 4. Same City / Region Cluster (+0.10)
      if(flaggedProps.some(fp => fp.city && prop.city && fp.city.toLowerCase() === prop.city.toLowerCase())){
        score += 0.10;
      }

      img.similarityScore = Math.min(score, 0.99);

      if(img.similarityScore >= 0.40){
        similarImagesCount++;
        matchingPropertyIds.add(img.propertyId);
      }
    });

    updatePriorityBanner(similarImagesCount, matchingPropertyIds.size);
  }

  function updatePriorityBanner(similarCount, propCount){
    const banner = document.getElementById('sniper-priority-banner');
    const prioCountEl = document.getElementById('sniper-prio-count');
    const matchCountEl = document.getElementById('sniper-match-count');
    const stageMatchesBtn = document.getElementById('sniper-btn-stage-matches');

    if(!banner) return;

    if(similarCount > 0 && queuedPropertyIds.size > 0 && similarityPrioritized){
      banner.style.display = 'flex';
      if(prioCountEl){
        prioCountEl.textContent = `${propCount} matching propert${propCount === 1 ? 'y' : 'ies'}`;
      }
      if(matchCountEl){
        matchCountEl.textContent = propCount;
      }
      if(stageMatchesBtn){
        stageMatchesBtn.disabled = propCount === 0;
      }
    } else {
      banner.style.display = 'none';
    }
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
        .select('id,title,address,city,state,zip,status,landlord_id,created_at,property_photos(id,url,display_order,file_id)')
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
        p.tokenSet = tokenizeProperty(p);

        // Select exactly ONE interior photo per property (avoiding front exterior facade)
        const interiorPhoto = selectInteriorPhoto(validPhotos);
        if(interiorPhoto){
          p.interiorPhoto = interiorPhoto;
          allImages.push({
            id: interiorPhoto.id,
            url: interiorPhoto.url,
            file_id: interiorPhoto.file_id || null,
            propertyId: p.id,
            property: p,
            urlSignature: extractUrlSignature(interiorPhoto.url),
            similarityScore: 0
          });
        }
      });

      // Update header statistics
      updateStats();

      // Check if URL has ?property_id=
      const urlPid = new URLSearchParams(location.search).get('property_id');
      if(urlPid && allProperties.some(p => p.id === urlPid)){
        queuedPropertyIds.add(urlPid);
      }

      recalculateSimilarities();
      renderQueue();
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

  // ─── Filter & Dynamic Smart Sorting ────────────────────────────────────────
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

    // Dynamic Smart Priority Sorting:
    // 1. Flagged Images (score = 1.0) come first
    // 2. Images with High Similarity to flagged text/watermarks (score >= 0.40) in descending score order
    // 3. Remaining unflagged images
    if(similarityPrioritized && queuedPropertyIds.size > 0 && currentFilter !== 'flagged'){
      const sorted = images.slice().sort((a, b) => {
        const aFlagged = queuedPropertyIds.has(a.propertyId) ? 1 : 0;
        const bFlagged = queuedPropertyIds.has(b.propertyId) ? 1 : 0;

        if(aFlagged !== bFlagged) return bFlagged - aFlagged;

        const aScore = a.similarityScore || 0;
        const bScore = b.similarityScore || 0;

        if(Math.abs(aScore - bScore) > 0.05){
          return bScore - aScore;
        }

        return 0; // Maintain natural stability
      });
      return sorted;
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
      const isSimilar = !isFlagged && (item.similarityScore >= 0.40) && similarityPrioritized && queuedPropertyIds.size > 0;

      const card = document.createElement('div');
      card.className = 'sniper-card' + (isFlagged ? ' flagged' : '') + (isSimilar ? ' similar' : '');
      card.dataset.pid = item.propertyId;
      card.dataset.idx = index;

      const thumbUrl = getThumbUrl(item.url);
      const addr = item.property.address || item.property.title || 'Property';
      const pct = Math.round((item.similarityScore || 0) * 100);

      card.innerHTML = `
        <img src="${S.esc(thumbUrl)}" alt="${S.esc(addr)}" loading="lazy" width="280" height="210">
        <span class="sniper-flag-badge">Flagged</span>
        ${isSimilar ? `<span class="sniper-similar-badge">⚡ Similar Pattern (${pct}%)</span>` : ''}
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

    // Instantly recalibrate similarity scores across entire catalog
    recalculateSimilarities();

    // Dynamically re-render queue and re-order grid to float similar photos to the front
    renderQueue();
    renderGrid();
  }

  function stageAllMatchingProperties(){
    if(!activeSimilarityProfile) return;

    let stagedCount = 0;
    allImages.forEach(img => {
      if(img.similarityScore >= 0.40 && !queuedPropertyIds.has(img.propertyId)){
        queuedPropertyIds.add(img.propertyId);
        stagedCount++;
      }
    });

    if(stagedCount > 0){
      recalculateSimilarities();
      renderQueue();
      renderGrid();
      S.toast(`Staged ${stagedCount} matching propert${stagedCount === 1 ? 'y' : 'ies'} with similar watermarks.`, 'success');
    } else {
      S.toast('All matching properties already staged.', 'info');
    }
  }

  function resetPriorityOrder(){
    similarityPrioritized = false;
    activeSimilarityProfile = null;
    allImages.forEach(img => { img.similarityScore = 0; });
    updatePriorityBanner(0, 0);
    renderGrid();
    S.toast('Standard sort order restored.', 'info');
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
    similarityPrioritized = true;
    recalculateSimilarities();
    renderQueue();
    renderGrid();
    S.toast('Staging queue cleared.', 'info');
  }

  // ─── Delete Execution (100% Reliable Cascading Deletion) ───────────────────
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
    const deletedIds = [];

    // Perform multi-stage atomic cascading cleanup
    try {
      // Step 1: Delete photos from property_photos table
      const { error: photoErr } = await CP.sb()
        .from('property_photos')
        .delete()
        .in('property_id', ids);

      if(photoErr){
        console.warn('[watermark-sniper] Photo deletion warning:', photoErr);
      }

      // Step 2: Delete saved properties links
      await CP.sb()
        .from('saved_properties')
        .delete()
        .in('property_id', ids);

      // Step 3: Delete inquiries
      await CP.sb()
        .from('inquiries')
        .delete()
        .in('property_id', ids);

      // Step 4: Unlink applications referencing these properties
      await CP.sb()
        .from('applications')
        .update({ property_id: null })
        .in('property_id', ids);

      // Step 5: Delete properties from properties table in batch
      const { error: propErr } = await CP.sb()
        .from('properties')
        .delete()
        .in('id', ids);

      if(!propErr){
        succeeded = ids.length;
        deletedIds.push(...ids);
      } else {
        console.warn('[watermark-sniper] Batch delete error, falling back to individual deletes:', propErr);
        // Fallback: Individual sequential deletion
        for(const id of ids){
          try {
            await CP.sb().from('property_photos').delete().eq('property_id', id);
            await CP.sb().from('saved_properties').delete().eq('property_id', id);
            await CP.sb().from('inquiries').delete().eq('property_id', id);
            await CP.sb().from('applications').update({ property_id: null }).eq('property_id', id);
            const { error: dErr } = await CP.sb().from('properties').delete().eq('id', id);
            if(dErr){
              console.error(`[watermark-sniper] Failed to delete property ${id}:`, dErr);
              failed++;
            } else {
              succeeded++;
              deletedIds.push(id);
            }
          } catch(err){
            console.error(`[watermark-sniper] Exception deleting property ${id}:`, err);
            failed++;
          }
        }
      }
    } catch(err){
      console.error('[watermark-sniper] Global deletion exception:', err);
      // Fallback: Individual deletion
      for(const id of ids){
        try {
          await CP.sb().from('property_photos').delete().eq('property_id', id);
          await CP.sb().from('saved_properties').delete().eq('property_id', id);
          await CP.sb().from('inquiries').delete().eq('property_id', id);
          await CP.sb().from('applications').update({ property_id: null }).eq('property_id', id);
          const { error: dErr } = await CP.sb().from('properties').delete().eq('id', id);
          if(dErr) failed++; else { succeeded++; deletedIds.push(id); }
        } catch(_) {
          failed++;
        }
      }
    }

    // Audit log (non-blocking)
    try {
      const { data: { session: _delSess } } = await CP.Auth.getSession();
      if(deletedIds.length > 0){
        CP.sb().from('admin_actions').insert([{
          user_id:     _delSess?.user?.id || null,
          action:      'property.watermark_sniper_delete',
          target_type: 'property',
          target_id:   deletedIds.join(','),
          metadata:    { count: deletedIds.length, property_ids: deletedIds, deleted_at: new Date().toISOString() }
        }]).catch(() => {});
      }
    } catch (_) {}

    if(succeeded > 0){
      const delSet = new Set(deletedIds);
      allProperties = allProperties.filter(p => !delSet.has(p.id));
      allImages = allImages.filter(img => !delSet.has(img.propertyId));
      deletedIds.forEach(id => queuedPropertyIds.delete(id));

      updateStats();
      recalculateSimilarities();
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

    // Dynamic Similarity Banner Buttons
    const stageMatchesBtn = document.getElementById('sniper-btn-stage-matches');
    if(stageMatchesBtn){
      stageMatchesBtn.addEventListener('click', stageAllMatchingProperties);
    }

    const resetPrioBtn = document.getElementById('sniper-btn-reset-prio');
    if(resetPrioBtn){
      resetPrioBtn.addEventListener('click', resetPriorityOrder);
    }

    // Deletion & Queue Buttons
    const deleteBtn = document.getElementById('sniper-btn-delete');
    if(deleteBtn) deleteBtn.addEventListener('click', executeDelete);

    const clearBtn = document.getElementById('sniper-btn-clear');
    if(clearBtn) clearBtn.addEventListener('click', clearQueue);

    await load();
  });

})();
