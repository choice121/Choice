(function(){
  'use strict';
  // I-410: Inline scripts run before deferred scripts. window.AdminShell is
  // undefined at this point, so the previous early-return left the page
  // spinning forever. Use the same waitReady pattern as the working pages.
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
  let S; // assigned after waitReady resolves

  let allProperties = [];
  let scanResults  = {};
  let selectedIds  = new Set();
  let currentFilter = 'all';
  let scanning = false;

  function escHtml(s){ return S.esc(s); }

  // ───── Load ─────
  async function load(){
    const okAuth = await S.requireAdmin();
    if(!okAuth) return;
    const { data, error } = await CP.sb().from('properties')
      .select('id,title,address,images,status,created_at')
      .order('created_at',{ ascending:false });
    if(error){
      document.getElementById('props-list').innerHTML =
        '<div class="empty"><svg class="i"><use href="#i-alert"/></svg><h3>Failed to load</h3><p>'+S.esc(error.message)+'</p></div>';
      return;
    }
    allProperties = data || [];
    document.querySelector('.appbar-sub').textContent = allProperties.length + ' propert' + (allProperties.length===1?'y':'ies');
    renderCards();
  }

  function renderCards(){
    const visible = getVisibleProperties();
    const list = document.getElementById('props-list');
    if(!visible.length){
      list.innerHTML = '<div class="empty"><svg class="i"><use href="#i-image"/></svg><h3>No properties</h3><p>Nothing matches this filter.</p></div>';
      return;
    }
    list.innerHTML = '<div class="wm-grid">' + visible.map(cardHtml).join('') + '</div>';
  }

  function cardHtml(p){
    const imgs = Array.isArray(p.images) ? p.images : [];
    const first = imgs[0] || '';
    const result = scanResults[p.id];
    const flag = result?.overallFlag || 'unscanned';
    const flagLabel = ({all:'All flagged',some:'Some flagged',clean:'Clean',unscanned:'Not scanned'})[flag];
    const isSel = selectedIds.has(p.id);
    return `<div class="wm-card ${isSel?'selected':''}" id="card-${escHtml(p.id)}">
      <div class="wm-thumb" data-action="lightbox" data-url="${escHtml(first)}" data-cap="${escHtml(p.title||'')}">
        ${first ? `<img src="${escHtml(first)}" alt="" loading="lazy">` : '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:.75rem">No image</div>'}
        <span class="wm-flag ${flag}">${flagLabel}</span>
        <div class="wm-check" data-action="select-stop"><input type="checkbox" data-action="select" data-id="${escHtml(p.id)}" ${isSel?'checked':''}></div>
        ${imgs.length>1 ? `<span class="wm-imgcount">${imgs.length} images</span>` : ''}
      </div>
      <div class="wm-body">
        <div class="wm-title">${escHtml(p.title || '(untitled)')}</div>
        <div class="wm-addr">${escHtml(p.address || '—')}</div>
      </div>
      <div class="wm-foot">
        <button class="btn btn-ghost btn-sm" data-action="scan-one" data-id="${escHtml(p.id)}">Re-scan</button>
        <button class="btn btn-danger btn-sm" data-action="delete-one" data-id="${escHtml(p.id)}" data-title="${escHtml(p.title||'(untitled)')}">Delete</button>
      </div>
    </div>`;
  }

  // ───── Scan ─────
  async function scanProperty(p){
    const imgs = Array.isArray(p.images) ? p.images : [];
    if(!imgs.length){
      scanResults[p.id] = { overallFlag:'unscanned', perImage:[] };
      return;
    }
    const perImage = [];
    for(const url of imgs){
      const flag = await analyzeImage(url);
      perImage.push({ url, flag });
    }
    const flagged = perImage.filter(x => x.flag === 'watermark' || x.flag === 'branding').length;
    let overallFlag = 'clean';
    if(flagged === perImage.length) overallFlag = 'all';
    else if(flagged > 0)            overallFlag = 'some';
    scanResults[p.id] = { overallFlag, perImage };
  }

  async function scanAll(){
    if(scanning) return;
    scanning = true;
    document.getElementById('scan-bar').style.display = 'flex';
    let done = 0;
    for(const p of allProperties){
      await scanProperty(p);
      done++;
      const pct = Math.round(done / allProperties.length * 100);
      document.getElementById('scan-fill').style.width = pct + '%';
      document.getElementById('scan-text').textContent = `Scanning ${done} / ${allProperties.length}`;
      // Live update each card's flag
      const card = document.getElementById('card-' + p.id);
      if(card){
        const flag = scanResults[p.id]?.overallFlag || 'unscanned';
        const fl = card.querySelector('.wm-flag');
        if(fl){ fl.className = 'wm-flag ' + flag; fl.textContent = ({all:'All flagged',some:'Some flagged',clean:'Clean',unscanned:'Not scanned'})[flag]; }
      }
    }
    document.getElementById('scan-text').textContent = 'Scan complete';
    setTimeout(() => { document.getElementById('scan-bar').style.display = 'none'; }, 1200);
    updateSummary();
    scanning = false;
  }

  function analyzeImage(url){
    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const cW = Math.min(640, img.naturalWidth);
          const cH = Math.round(img.naturalHeight * (cW / img.naturalWidth));
          canvas.width = cW; canvas.height = cH;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, cW, cH);

          // Sample 9 regions: corners + edges + center band
          const regions = [
            [0.00,0.00,0.30,0.20], [0.70,0.00,0.30,0.20],
            [0.00,0.80,0.30,0.20], [0.70,0.80,0.30,0.20],
            [0.35,0.00,0.30,0.15], [0.35,0.85,0.30,0.15],
            [0.00,0.40,0.20,0.20], [0.80,0.40,0.20,0.20],
            [0.30,0.40,0.40,0.20]
          ];
          let maxScore = 0;
          for(const [fx,fy,fw,fh] of regions){
            const rx = Math.round(fx*cW), ry = Math.round(fy*cH);
            const rw = Math.max(2, Math.round(fw*cW)), rh = Math.max(2, Math.round(fh*cH));
            let data;
            try { data = ctx.getImageData(rx,ry,rw,rh).data; } catch { continue; }
            const score = scoreRegion(data);
            if(score > maxScore) maxScore = score;
          }
          if(maxScore >= 72) resolve('watermark');
          else if(maxScore >= 42) resolve('branding');
          else resolve('clean');
        } catch { resolve('unscanned'); }
      };
      img.onerror = () => resolve('unscanned');
      const sep = url.includes('?') ? '&' : '?';
      img.src = url + sep + '_wm=1';
      setTimeout(() => resolve('unscanned'), 8000);
    });
  }

  function scoreRegion(data){
    const len = data.length / 4;
    if(!len) return 0;
    let rSum=0,gSum=0,bSum=0,aSum=0;
    let rMin=255,gMin=255,bMin=255, rMax=0,gMax=0,bMax=0;
    let lowAlphaCount=0, highContrastCount=0;
    let prevLum=-1, contrastPairs=0;
    for(let i=0;i<data.length;i+=4){
      const r=data[i], g=data[i+1], b=data[i+2], a=data[i+3];
      rSum+=r; gSum+=g; bSum+=b; aSum+=a;
      rMin=Math.min(rMin,r); rMax=Math.max(rMax,r);
      gMin=Math.min(gMin,g); gMax=Math.max(gMax,g);
      bMin=Math.min(bMin,b); bMax=Math.max(bMax,b);
      if(a < 200) lowAlphaCount++;
      const lum = 0.299*r + 0.587*g + 0.114*b;
      if(prevLum >= 0 && Math.abs(lum - prevLum) > 90) highContrastCount++;
      prevLum = lum;
      const maxC = Math.max(r,g,b), minC = Math.min(r,g,b);
      if(maxC > 20 && (maxC - minC) < 20 && Math.abs(r-g) < 15 && Math.abs(g-b) < 15) contrastPairs++;
    }
    const avgA = aSum/len;
    const maxRange = Math.max(rMax-rMin, gMax-gMin, bMax-bMin);
    let score = 0;
    if(avgA < 200 && avgA > 20) score += 35;
    else if(lowAlphaCount/len > 0.3) score += 25;
    if(maxRange > 180) score += 30;
    else if(maxRange > 120) score += 15;
    const contrastRatio = highContrastCount/len;
    if(contrastRatio > 0.25) score += 25;
    else if(contrastRatio > 0.12) score += 12;
    const neutralRatio = contrastPairs/len;
    if(neutralRatio > 0.6 && maxRange > 100) score += 18;
    return Math.min(100, score);
  }

  // ───── Selection ─────
  function toggleSelect(id, checked){
    if(checked) selectedIds.add(id); else selectedIds.delete(id);
    updateSelCount();
    const card = document.getElementById('card-' + id);
    if(card) card.classList.toggle('selected', checked);
  }
  function toggleSelectAll(checked){
    getVisibleProperties().forEach(p => {
      if(checked) selectedIds.add(p.id); else selectedIds.delete(p.id);
      const card = document.getElementById('card-' + p.id);
      if(card){
        card.classList.toggle('selected', checked);
        const chk = card.querySelector('input[type=checkbox]');
        if(chk) chk.checked = checked;
      }
    });
    updateSelCount();
  }
  function updateSelCount(){
    document.getElementById('sel-count').textContent = selectedIds.size;
    document.getElementById('btn-delete-sel').disabled = selectedIds.size === 0;
  }

  function getVisibleProperties(){
    if(currentFilter === 'all') return allProperties;
    if(currentFilter === 'all-watermarked')  return allProperties.filter(p => scanResults[p.id]?.overallFlag === 'all');
    if(currentFilter === 'some-watermarked') return allProperties.filter(p => ['all','some'].includes(scanResults[p.id]?.overallFlag));
    if(currentFilter === 'clean')            return allProperties.filter(p => scanResults[p.id]?.overallFlag === 'clean');
    return allProperties;
  }

  // ───── Delete ─────
  async function deleteOne(id, title){
    const ok = await S.confirm({
      title:'Delete this property?',
      message:`"${title}" will be permanently removed along with all its data. This cannot be undone.`,
      ok:'Delete property', danger:true
    });
    if(!ok) return;
    await doDelete([id]);
  }
  async function deleteSelected(){
    if(!selectedIds.size) return;
    const ids = [...selectedIds];
    const ok = await S.confirm({
      title:`Delete ${ids.length} propert${ids.length===1?'y':'ies'}?`,
      message:'This will permanently remove them and all related data. This cannot be undone.',
      ok:'Delete all', danger:true
    });
    if(!ok) return;
    await doDelete(ids);
  }
  async function doDelete(ids){
    let succeeded = 0, failed = 0;
    for(const id of ids){
      const { error } = await CP.sb().from('properties').delete().eq('id', id);
      if(error){ console.error('Delete error for', id, error); failed++; }
      else {
        succeeded++;
        allProperties = allProperties.filter(p => p.id !== id);
        delete scanResults[id];
        selectedIds.delete(id);
        const card = document.getElementById('card-' + id);
        if(card){
          card.style.transition = 'opacity .3s';
          card.style.opacity = '0';
          setTimeout(() => card.remove(), 320);
        }
      }
    }
    updateSelCount();
    updateSummary();
    if(succeeded) S.toast(`${succeeded} propert${succeeded===1?'y':'ies'} deleted.`,'success');
    if(failed)    S.toast(`${failed} failed to delete.`,'error');
    document.querySelector('.appbar-sub').textContent = allProperties.length + ' propert' + (allProperties.length===1?'y':'ies');
  }

  // ───── Summary ─────
  function updateSummary(){
    const scanned = allProperties.filter(p => scanResults[p.id]);
    if(!scanned.length){ document.getElementById('summary-bar').style.display = 'none'; return; }
    const allFlag  = scanned.filter(p => scanResults[p.id]?.overallFlag === 'all').length;
    const someFlag = scanned.filter(p => scanResults[p.id]?.overallFlag === 'some').length;
    const clean    = scanned.filter(p => scanResults[p.id]?.overallFlag === 'clean').length;
    document.getElementById('sum-all').textContent   = `${allFlag} fully watermarked`;
    document.getElementById('sum-some').textContent  = `${someFlag} partially flagged`;
    document.getElementById('sum-clean').textContent = `${clean} clean`;
    document.getElementById('sum-total').textContent = `${scanned.length} total`;
    document.getElementById('summary-bar').style.display = 'flex';
  }

  // ───── Lightbox ─────
  function openLightbox(url, caption){
    if(!url) return;
    document.getElementById('lightbox-img').src = url;
    document.getElementById('lightbox-caption').textContent = caption || '';
    document.getElementById('lightbox').classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox(){
    document.getElementById('lightbox').classList.remove('open');
    document.getElementById('lightbox-img').src = '';
    document.body.style.overflow = '';
  }

  document.addEventListener('DOMContentLoaded', async () => {
    try { await waitReady(8000); }
    catch(e){
      const el = document.getElementById('props-list');
      if(el) el.innerHTML = '<div class="empty"><h3>Could not load admin tools</h3><p>'+e.message+'</p></div>';
      return;
    }
    S = window.AdminShell;

    // ───── Wiring (after S is available) ─────
    S.on('lightbox',   (t) => openLightbox(t.dataset.url, t.dataset.cap));
    S.on('select',     (t, e) => { e.stopPropagation(); toggleSelect(t.dataset.id, t.checked); });
    S.on('select-stop',(_, e) => e.stopPropagation());
    S.on('scan-one',   async (t) => {
      const p = allProperties.find(x => x.id === t.dataset.id);
      if(!p) return;
      t.disabled = true; t.textContent = 'Scanning…';
      await scanProperty(p);
      updateSummary();
      renderCards();
    });
    S.on('delete-one', (t) => deleteOne(t.dataset.id, t.dataset.title));

    document.getElementById('btn-scan-all').addEventListener('click', () => scanAll());
    document.getElementById('btn-delete-sel').addEventListener('click', () => deleteSelected());
    document.getElementById('select-all').addEventListener('change', e => toggleSelectAll(e.target.checked));
    document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
    document.getElementById('lightbox').addEventListener('click', e => { if(e.target.id === 'lightbox') closeLightbox(); });
    document.addEventListener('keydown', e => { if(e.key === 'Escape') closeLightbox(); });
    document.getElementById('filter-tabs').addEventListener('click', e => {
      const btn = e.target.closest('.chip');
      if(!btn) return;
      document.querySelectorAll('#filter-tabs .chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderCards();
    });
    await load();
  });
})();
