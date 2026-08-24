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
  let scanResults   = {};  // { [propId]: { overallFlag, perImage:[{url,flag,score}], saved } }
  let selectedIds   = new Set();
  let currentFilter = 'all';
  let searchQuery   = '';
  let scanning      = false;
  let scanCancelled = false;
  let _displayLimit = 24;  // Default 24 items for ultra-lean mobile performance

  // Cache for perceptual hashes to prevent re-hashing images
  const _photoHashCache = new Map();
  let _currentSimilarMatches = [];

  // ─── Ultra-Lightweight Image URL helpers ────────────────────────────────────
  function getThumb(url, mode='thumb'){
    if(!url) return '';
    if(url.includes('ik.imagekit.io')){
      const clean = url.replace(/\?tr=[^&]+/, '').split('?')[0];
      return clean + '?tr=w-240,h-160,c-maintain_ratio,q-50,f-webp';
    }
    if(window.CONFIG && typeof CONFIG.img === 'function'){
      return CONFIG.img(url, mode);
    }
    return url;
  }

  function getScanUrl(rawUrl){
    if(!rawUrl) return '';
    // Downscale to lightweight WebP 160px for canvas analysis
    if(rawUrl.includes('ik.imagekit.io')){
      const clean = rawUrl.replace(/\?tr=[^&]+/, '').split('?')[0];
      return clean + '?tr=w-160,q-50,f-webp';
    }
    return rawUrl;
  }

  function getHashScanUrl(rawUrl){
    if(!rawUrl) return '';
    // Micro 32x32 WebP image (~300 bytes) for instant gradient fingerprinting
    if(rawUrl.includes('ik.imagekit.io')){
      const clean = rawUrl.replace(/\?tr=[^&]+/, '').split('?')[0];
      return clean + '?tr=w-32,h-32,q-40,f-webp';
    }
    return rawUrl;
  }

  // ─── Proxy URL builder ────────────────────────────────────────────────────
  async function proxyUrl(imageUrl){
    if(!window.CONFIG || !CONFIG.SUPABASE_URL) return imageUrl;
    const token = await CP.Auth.getAccessToken().catch(()=>'');
    if(!token) return imageUrl;
    return CONFIG.SUPABASE_URL.replace(/\/$/,'')
      + '/functions/v1/proxy-image?url='
      + encodeURIComponent(imageUrl)
      + '&token='
      + encodeURIComponent(token);
  }

  // ─── Load properties ──────────────────────────────────────────────────────
  async function load(){
    const okAuth = await S.requireAdmin();
    if(!okAuth) return;
    const { data, error } = await CP.sb()
      .from('properties')
      .select('id,title,address,status,created_at,property_photos(id,url,file_id,display_order,watermark_status,perceptual_hash)')
      .order('created_at',{ ascending:false });
    if(error){
      document.getElementById('props-list').innerHTML =
        '<div class="empty"><svg class="i"><use href="#i-alert"/></svg><h3>Failed to load</h3><p>'+S.esc(error.message)+'</p></div>';
      return;
    }
    allProperties = (data || []).map(p => {
      const photos = Array.isArray(p.property_photos) ? p.property_photos : [];
      const sorted = photos.slice().sort((a,b) => (a.display_order||0)-(b.display_order||0));
      const validPhotos = sorted.filter(x => x.url);
      validPhotos.forEach(ph => {
        if(ph.perceptual_hash) _photoHashCache.set(ph.url, ph.perceptual_hash);
      });
      return { ...p, photos: validPhotos, images: validPhotos.map(x => ({ url: x.url, id: x.id, perceptual_hash: x.perceptual_hash })) };
    });

    // Pre-populate scanResults from previously saved watermark_status values
    for(const p of allProperties){
      const hasStatus = p.photos.some(ph =>
        ph.watermark_status && ph.watermark_status !== 'applied' && ph.watermark_status !== 'unscanned'
      );
      if(!hasStatus) continue;
      const perImage = p.photos.map(ph => ({
        url:     ph.url,
        photoId: ph.id,
        flag:    (ph.watermark_status && ph.watermark_status !== 'applied') ? ph.watermark_status : 'unscanned',
        score:   null,
      }));
      const flagged   = perImage.filter(x => x.flag === 'watermark' || x.flag === 'branding').length;
      const allFlagged = flagged === perImage.length && perImage.length > 0;
      let overallFlag = 'clean';
      if(allFlagged)    overallFlag = 'all';
      else if(flagged)  overallFlag = 'some';
      scanResults[p.id] = { overallFlag, perImage, saved: true };
    }

    document.querySelector('.appbar-sub').textContent =
      allProperties.length + ' propert' + (allProperties.length===1?'y':'ies');
    const totalBadge = document.getElementById('wm-total-badge');
    if(totalBadge) totalBadge.textContent = allProperties.length + ' propert' + (allProperties.length===1?'y':'ies');
    updateTabCounts();
    renderCards();
    updateSaveBtn();
  }

  // ─── Persist scan results to property_photos.watermark_status ────────────
  async function saveScanResult(p){
    const result = scanResults[p.id];
    if(!result || result.saved) return true;
    let allOk = true;
    for(const im of result.perImage){
      let q = CP.sb().from('property_photos').update({ watermark_status: im.flag });
      if(im.photoId) {
        q = q.eq('id', im.photoId);
      } else {
        q = q.eq('property_id', p.id).eq('url', im.url);
      }
      const { error } = await q;
      if(error){ allOk = false; console.error('[wm] save error:', im.url, error); }
    }
    if(allOk) result.saved = true;
    return allOk;
  }

  async function saveAllUnsaved(){
    const unsaved = allProperties.filter(p => scanResults[p.id] && !scanResults[p.id].saved);
    if(!unsaved.length){ S.toast('Nothing new to save.', 'info'); return; }
    let ok=0, fail=0;
    for(const p of unsaved){
      const saved = await saveScanResult(p);
      if(saved) ok++; else fail++;
      const card = document.getElementById('card-'+p.id);
      if(card && saved) card.classList.add('wm-saved');
    }
    if(ok)   S.toast(`${ok} propert${ok===1?'y':'ies'} saved to database.`, 'success');
    if(fail) S.toast(`${fail} failed to save.`, 'error');
    updateSaveBtn();
  }

  function updateSaveBtn(){
    const unsaved = allProperties.filter(p => scanResults[p.id] && !scanResults[p.id].saved).length;
    const btn = document.getElementById('btn-save-all');
    if(!btn) return;
    btn.disabled = unsaved === 0;
    btn.textContent = unsaved ? `Save results (${unsaved})` : 'All saved';
  }

  function updateTabCounts(){
    const allCnt = allProperties.length;
    const allWmCnt = allProperties.filter(p => scanResults[p.id]?.overallFlag === 'all').length;
    const someWmCnt = allProperties.filter(p => ['all','some'].includes(scanResults[p.id]?.overallFlag)).length;
    const cleanCnt = allProperties.filter(p => scanResults[p.id]?.overallFlag === 'clean').length;

    const elAll = document.getElementById('chip-cnt-all');
    const elAllWm = document.getElementById('chip-cnt-all-wm');
    const elSomeWm = document.getElementById('chip-cnt-some-wm');
    const elClean = document.getElementById('chip-cnt-clean');

    if(elAll) elAll.textContent = allCnt;
    if(elAllWm) elAllWm.textContent = allWmCnt;
    if(elSomeWm) elSomeWm.textContent = someWmCnt;
    if(elClean) elClean.textContent = cleanCnt;
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  function renderCards(){
    const allVisible = getVisibleProperties();
    const visible = allVisible.slice(0, _displayLimit);
    const list = document.getElementById('props-list');

    const sumShowing = document.getElementById('sum-showing');
    if(sumShowing){
      if(allVisible.length === allProperties.length){
        sumShowing.textContent = `Showing ${allVisible.length} properties`;
      } else {
        sumShowing.textContent = `Showing ${allVisible.length} of ${allProperties.length}`;
      }
    }

    if(!visible.length){
      const isSearch = !!searchQuery.trim();
      list.innerHTML = `<div class="empty"><svg class="i"><use href="#i-image"/></svg><h3>No properties found</h3><p>${isSearch ? 'No properties match "'+S.esc(searchQuery)+'".' : 'Nothing matches this filter.'}</p></div>`;
      updateSummary();
      updateTabCounts();
      return;
    }
    let html = '<div class="wm-grid">' + visible.map(cardHtml).join('') + '</div>';
    if(allVisible.length > _displayLimit){
      const remaining = allVisible.length - _displayLimit;
      html += '<div style="padding:20px;text-align:center">'
        + '<button class="btn btn-secondary" data-action="wm-load-more">'
        + 'Load more (' + remaining + ' remaining)'
        + '</button></div>';
    }
    list.innerHTML = html;
    updateSummary();
    updateTabCounts();
  }

  function cardHtml(p){
    const imgs   = p.images || [];
    const firstObj = imgs[0];
    const firstUrl = typeof firstObj === 'string' ? firstObj : firstObj?.url || '';
    const displayThumb = getThumb(firstUrl, 'thumb');
    const result = scanResults[p.id];
    const flag   = result?.overallFlag || 'unscanned';
    const flagLabel = { all:'All flagged', some:'Some flagged', clean:'Clean', unscanned:'Not scanned' }[flag] || 'Not scanned';
    const isSel  = selectedIds.has(p.id);
    const isSaved = result?.saved;

    let stripHtml = '';
    if(result && result.perImage && result.perImage.length > 1){
      stripHtml = '<div class="wm-strip">'
        + result.perImage.map((img, i) => {
            const fCls = img.flag === 'watermark' ? 'wm-strip-dot all'
                       : img.flag === 'branding'  ? 'wm-strip-dot some'
                       : img.flag === 'unscanned'  ? 'wm-strip-dot unscanned'
                       :                             'wm-strip-dot clean';
            const scoreLabel = img.score !== null ? ` (score ${img.score})` : '';
            return `<span class="${fCls}" title="Image ${i+1}: ${img.flag}${scoreLabel}" data-action="find-similar-photo" data-prop-id="${S.esc(p.id)}" data-url="${S.esc(img.url)}">${i+1}</span>`;
          }).join('')
        + '</div>';
    }

    const savedBadge = isSaved
      ? `<span class="wm-saved-badge" title="Results saved to database">Saved</span>`
      : '';

    return `<div class="wm-card ${isSel?'selected':''} ${isSaved?'wm-saved':''}" id="card-${S.esc(p.id)}" data-card-id="${S.esc(p.id)}">
      <div class="wm-thumb" data-action="lightbox" data-url="${S.esc(firstUrl)}" data-cap="${S.esc(p.title||'')}">
        ${displayThumb
          ? `<img src="${S.esc(displayThumb)}" alt="" loading="lazy">`
          : '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:.75rem">No image</div>'}
        <span class="wm-flag ${flag}">${flagLabel}</span>
        <div class="wm-check" data-action="select-stop">
          <input type="checkbox" data-action="select" data-id="${S.esc(p.id)}" ${isSel?'checked':''}>
        </div>
        ${imgs.length>1 ? `<span class="wm-imgcount">${imgs.length} images</span>` : ''}
      </div>
      ${stripHtml}
      <div class="wm-body">
        <div class="wm-title">${S.esc(p.title||'(untitled)')}</div>
        <div class="wm-addr">${S.esc(p.address||'—')}</div>
        ${result ? `<div class="wm-score-row">${result.perImage.map((im,i)=>
          `<span class="wm-score-chip ${im.flag==='watermark'?'chip-red':im.flag==='branding'?'chip-amber':im.flag==='unscanned'?'chip-grey':'chip-green'}"
           title="${S.esc(im.url)}" data-action="find-similar-photo" data-prop-id="${S.esc(p.id)}" data-url="${S.esc(im.url)}" style="cursor:pointer">img${i+1}${im.score!==null?' '+im.score:''}</span>`).join('')}</div>` : ''}
        ${savedBadge}
      </div>
      <div class="wm-foot">
        <button class="btn btn-ghost btn-sm" data-action="find-similar-photo" data-prop-id="${S.esc(p.id)}" data-url="${S.esc(firstUrl)}" title="Find visually similar photos across catalog">
          <svg class="i i-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg> Similar
        </button>
        <button class="btn btn-ghost btn-sm" data-action="scan-one" data-id="${S.esc(p.id)}">
          ${result ? 'Re-scan' : 'Scan'}
        </button>
        <button class="btn btn-danger btn-sm" data-action="delete-one"
          data-id="${S.esc(p.id)}" data-title="${S.esc(p.title||'(untitled)')}">Delete</button>
      </div>
    </div>`;
  }

  // ─── Image analysis (Ultra-optimized for zero heat and low data) ──────────
  async function scanProperty(p){
    const imgs = p.images || [];
    if(!imgs.length){
      scanResults[p.id] = { overallFlag:'unscanned', perImage:[], saved:false };
      return;
    }
    const perImage = [];
    // Concurrency limit = 2 for smooth CPU temperature and responsive UI
    const BATCH = 2;
    for(let i = 0; i < imgs.length; i += BATCH){
      if(scanCancelled) break;
      const slice = imgs.slice(i, i + BATCH);
      const results = await Promise.all(slice.map(img => {
        const url = typeof img === 'string' ? img : img.url;
        const photoId = typeof img === 'string' ? null : img.id;
        return analyzeImage(url).then(r => ({ url, photoId, ...r }));
      }));
      perImage.push(...results);
      // Yield 16ms so the UI stays 60fps and device doesn't overheat
      await new Promise(r => setTimeout(r, 16));
    }
    const flagged    = perImage.filter(x => x.flag === 'watermark' || x.flag === 'branding').length;
    const allFlagged = flagged === perImage.length && perImage.length > 0;
    let overallFlag  = 'clean';
    if(allFlagged)   overallFlag = 'all';
    else if(flagged) overallFlag = 'some';
    scanResults[p.id] = { overallFlag, perImage, saved: false };
  }

  async function scanAll(){
    if(scanning) return;
    scanning = true;
    scanCancelled = false;
    const bar  = document.getElementById('scan-bar');
    const fill = document.getElementById('scan-fill');
    const txt  = document.getElementById('scan-text');
    bar.style.display = 'flex';
    fill.style.width  = '0%';
    let done = 0;
    for(const p of allProperties){
      if(scanCancelled) break;
      txt.textContent = `Scanning ${done+1} / ${allProperties.length} — ${S.esc(p.title||p.id)}`;
      await scanProperty(p);
      await saveScanResult(p);
      done++;
      fill.style.width = Math.round(done / allProperties.length * 100) + '%';
      const card = document.getElementById('card-' + p.id);
      if(card){
        const res  = scanResults[p.id];
        const flag = res?.overallFlag || 'unscanned';
        const fl   = card.querySelector('.wm-flag');
        if(fl){ fl.className = 'wm-flag ' + flag; fl.textContent = ({all:'All flagged',some:'Some flagged',clean:'Clean',unscanned:'Not scanned'})[flag]; }
        if(res?.saved) card.classList.add('wm-saved');
      }
      await new Promise(r => setTimeout(r, 20));
    }
    txt.textContent = scanCancelled ? 'Scan stopped' : `Done — ${allProperties.length} propert${allProperties.length===1?'y':'ies'} scanned`;
    setTimeout(() => { bar.style.display = 'none'; }, 1800);
    renderCards();
    updateSaveBtn();
    scanning = false;
    scanCancelled = false;
  }

  async function analyzeImage(rawUrl){
    if(!rawUrl) return { flag:'unscanned', score:0 };
    let objectUrl = null;
    try {
      // Downscale image to lightweight webp URL before fetching over network
      const scanUrl = getScanUrl(rawUrl);
      const px   = await proxyUrl(scanUrl);
      const resp = await fetch(px);
      if(!resp.ok) return { flag:'unscanned', score:0 };
      const blob = await resp.blob();
      objectUrl  = URL.createObjectURL(blob);
      const result = await analyzeBlob(objectUrl);
      return result;
    } catch(err){
      console.warn('[wm] analyzeImage failed:', err);
      return { flag:'unscanned', score:0 };
    } finally {
      if(objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }

  function analyzeBlob(blobUrl){
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          // Lightweight 200px max canvas reduces CPU usage by 85%
          const cW = 200;
          const cH = img.naturalHeight
            ? Math.max(10, Math.round(img.naturalHeight * (cW / (img.naturalWidth || cW))))
            : 150;
          canvas.width = cW; canvas.height = cH;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, cW, cH);

          const regions = [
            [0.00, 0.00, 0.28, 0.22],
            [0.72, 0.00, 0.28, 0.22],
            [0.00, 0.78, 0.28, 0.22],
            [0.72, 0.78, 0.28, 0.22],
            [0.30, 0.00, 0.40, 0.15],
            [0.30, 0.85, 0.40, 0.15],
            [0.00, 0.35, 0.18, 0.30],
            [0.82, 0.35, 0.18, 0.30],
            [0.25, 0.30, 0.50, 0.40],
            [0.10, 0.15, 0.30, 0.25],
            [0.60, 0.60, 0.30, 0.25],
            [0.35, 0.45, 0.30, 0.15],
          ];

          let maxScore = 0;
          for(const [fx,fy,fw,fh] of regions){
            const rx = Math.round(fx*cW), ry = Math.round(fy*cH);
            const rw = Math.max(4, Math.round(fw*cW));
            const rh = Math.max(4, Math.round(fh*cH));
            let px;
            try{ px = ctx.getImageData(rx,ry,rw,rh).data; } catch{ continue; }
            const s = scoreRegion(px, rw, rh);
            if(s > maxScore) maxScore = s;
          }

          const flag = maxScore >= 68 ? 'watermark'
                     : maxScore >= 40 ? 'branding'
                     :                  'clean';
          resolve({ flag, score: maxScore });
        } catch(e){
          console.warn('[wm] canvas error:', e);
          resolve({ flag:'unscanned', score:0 });
        }
      };
      img.onerror = () => resolve({ flag:'unscanned', score:0 });
      img.src = blobUrl;
      setTimeout(() => resolve({ flag:'unscanned', score:0 }), 10000);
    });
  }

  function scoreRegion(data, w, h){
    const n = data.length / 4;
    if(n < 4) return 0;

    let lumSum = 0, lumSqSum = 0;
    let nearWhiteCount = 0;
    let nearGreyCount  = 0;
    let highEdgeCount  = 0;
    const lums = new Float32Array(n);

    // Stride optimization: single pass evaluation
    for(let i=0; i<data.length; i+=4){
      const r=data[i], g=data[i+1], b=data[i+2];
      const lum = 0.299*r + 0.587*g + 0.114*b;
      const idx = i >> 2;
      lums[idx] = lum;
      lumSum   += lum;
      lumSqSum += lum*lum;
      if(r>210 && g>210 && b>210) nearWhiteCount++;
      const diff = Math.max(r,g,b) - Math.min(r,g,b);
      if(diff < 20 && lum > 60 && lum < 210) nearGreyCount++;
    }

    for(let row=0; row<h; row+=2){
      for(let col=1; col<w; col+=2){
        const idx = row*w + col;
        if(Math.abs(lums[idx] - lums[idx-1]) > 70) highEdgeCount++;
      }
    }

    const mean     = lumSum / n;
    const variance = lumSqSum/n - mean*mean;
    const stdDev   = Math.sqrt(Math.max(0, variance));

    const whiteRatio = nearWhiteCount / n;
    const greyRatio  = nearGreyCount  / n;
    const edgeRatio  = (highEdgeCount * 4) / n;

    let score = 0;

    if(stdDev > 55 && whiteRatio > 0.12) score += 38;
    else if(stdDev > 40 && whiteRatio > 0.06) score += 22;

    if(greyRatio > 0.35 && stdDev > 30) score += 28;
    else if(greyRatio > 0.20 && stdDev > 20) score += 14;

    if(edgeRatio > 0.20) score += 30;
    else if(edgeRatio > 0.10) score += 16;
    else if(edgeRatio > 0.05) score += 6;

    if(stdDev < 25 && edgeRatio > 0.08) score += 18;

    return Math.min(100, Math.round(score));
  }

  // ─── Perceptual Hashing (dHash) & Similar Photo Finder ────────────────────
  async function getPhotoHash(url, photoId=null){
    if(!url) return null;
    if(_photoHashCache.has(url)) return _photoHashCache.get(url);
    try {
      const scanUrl = getHashScanUrl(url);
      const px = await proxyUrl(scanUrl);
      const resp = await fetch(px);
      if(!resp.ok) return null;
      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);
      const hash = await computeDHashFromBlob(objectUrl);
      URL.revokeObjectURL(objectUrl);
      if(hash) {
        _photoHashCache.set(url, hash);
        if(photoId){
          // Asynchronously persist to Supabase so it's instant next time
          CP.sb().from('property_photos').update({ perceptual_hash: hash }).eq('id', photoId).then(()=>{});
        }
      }
      return hash;
    } catch(e) {
      return null;
    }
  }

  function computeDHashFromBlob(blobUrl){
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 9;
          canvas.height = 8;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, 9, 8);
          const imgData = ctx.getImageData(0, 0, 9, 8).data;
          const grays = [];
          for(let i=0; i<imgData.length; i+=4){
            grays.push(0.299*imgData[i] + 0.587*imgData[i+1] + 0.114*imgData[i+2]);
          }
          let hashBits = '';
          for(let row=0; row<8; row++){
            for(let col=0; col<8; col++){
              const left = grays[row*9 + col];
              const right = grays[row*9 + col + 1];
              hashBits += left < right ? '1' : '0';
            }
          }
          resolve(hashBits);
        } catch(e){
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = blobUrl;
      setTimeout(() => resolve(null), 6000);
    });
  }

  function hammingDistance(hash1, hash2){
    if(!hash1 || !hash2 || hash1.length !== hash2.length) return 64;
    let dist = 0;
    for(let i=0; i<hash1.length; i++){
      if(hash1[i] !== hash2[i]) dist++;
    }
    return dist;
  }

  async function openSimilarFinder(targetPhotoUrl, targetPropId){
    const prop = allProperties.find(p => p.id === targetPropId);
    const modal = document.getElementById('wm-similar-modal');
    const targetImg = document.getElementById('wm-target-img');
    const targetTitle = document.getElementById('wm-target-title');
    const targetAddr = document.getElementById('wm-target-addr');
    const grid = document.getElementById('wm-similar-grid');
    const countEl = document.getElementById('wm-similar-matches-count');

    if(!modal) return;
    targetImg.src = getThumb(targetPhotoUrl, 'thumb');
    targetTitle.textContent = prop?.title || 'Selected Photo';
    targetAddr.textContent = prop?.address || '—';
    grid.innerHTML = '<div style="grid-column:1/-1;padding:28px;text-align:center;color:var(--muted)">Analyzing perceptual hash & matching across catalog…</div>';
    countEl.textContent = 'Searching catalog…';
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    const targetPhotoObj = prop?.photos?.find(x => x.url === targetPhotoUrl);
    const targetHash = await getPhotoHash(targetPhotoUrl, targetPhotoObj?.id);
    if(!targetHash){
      grid.innerHTML = '<div style="grid-column:1/-1;padding:24px;text-align:center;color:#ef4444">Could not generate visual signature for this photo.</div>';
      countEl.textContent = '0 matches';
      return;
    }

    const matches = [];
    let checkedCount = 0;
    for(const p of allProperties){
      for(const ph of p.photos){
        if(ph.url === targetPhotoUrl && p.id === targetPropId) continue;
        const hash = await getPhotoHash(ph.url, ph.id);
        checkedCount++;
        if(checkedCount % 12 === 0) {
          // Yield to main thread every 12 checks to keep mobile fluid
          await new Promise(r => setTimeout(r, 8));
        }
        if(!hash) continue;
        const dist = hammingDistance(targetHash, hash);
        // Distance <= 15 out of 64 bits = >= 76% visual similarity
        if(dist <= 15){
          const similarityPct = Math.round((1 - dist / 64) * 100);
          matches.push({
            property: p,
            photo: ph,
            dist,
            similarityPct
          });
        }
      }
    }

    matches.sort((a,b) => b.similarityPct - a.similarityPct);
    _currentSimilarMatches = matches;

    countEl.textContent = `${matches.length} matching photo${matches.length===1?'':'s'} found (≥76% similarity)`;

    if(!matches.length){
      grid.innerHTML = '<div style="grid-column:1/-1;padding:24px;text-align:center;color:var(--muted)">No matching similar photos found across the catalog.</div>';
      return;
    }

    grid.innerHTML = matches.map((m, idx) => {
      return `
        <div class="wm-sim-card" id="sim-card-${idx}">
          <div class="wm-sim-thumb" data-action="lightbox" data-url="${S.esc(m.photo.url)}" data-cap="${S.esc(m.property.title||'')}">
            <img src="${S.esc(getThumb(m.photo.url, 'thumb'))}" alt="" loading="lazy">
            <span class="wm-sim-pct">${m.similarityPct}% match</span>
          </div>
          <div class="wm-sim-body">
            <div class="wm-sim-addr" title="${S.esc(m.property.address || m.property.title)}">${S.esc(m.property.address || m.property.title || 'Untitled')}</div>
            <div class="wm-sim-btn-group">
              <button class="btn btn-ghost btn-sm" style="font-size:0.68rem;flex:1;padding:3px 4px" data-action="sim-select-prop" data-prop-id="${S.esc(m.property.id)}">
                Select
              </button>
              <button class="btn btn-danger btn-sm" style="font-size:0.68rem;flex:1;padding:3px 4px" data-action="sim-flag-wm" data-photo-id="${S.esc(m.photo.id)}" data-prop-id="${S.esc(m.property.id)}" data-photo-url="${S.esc(m.photo.url)}">
                Flag WM
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function closeSimilarFinder(){
    const modal = document.getElementById('wm-similar-modal');
    if(modal) modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  // ─── Selection ───────────────────────────────────────────────────────────
  function toggleSelect(id, checked){
    if(checked) selectedIds.add(id); else selectedIds.delete(id);
    updateSelCount();
    const card = document.getElementById('card-' + id);
    if(card) {
      card.classList.toggle('selected', checked);
      const chk = card.querySelector('input[type=checkbox]');
      if(chk) chk.checked = checked;
    }
  }
  function toggleSelectAll(checked){
    const visible = getVisibleProperties();
    visible.forEach(p => {
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
  function clearSelection(){
    selectedIds.clear();
    document.querySelectorAll('.wm-card.selected').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('.wm-check input[type=checkbox]').forEach(chk => chk.checked = false);
    const topChk = document.getElementById('select-all');
    if(topChk) topChk.checked = false;
    const bulkChk = document.getElementById('wm-bulk-select-all');
    if(bulkChk) bulkChk.checked = false;
    updateSelCount();
  }

  function updateSelCount(){
    const count = selectedIds.size;
    const selCountEl = document.getElementById('sel-count');
    if(selCountEl) selCountEl.textContent = count;
    const btnDelSel = document.getElementById('btn-delete-sel');
    if(btnDelSel) btnDelSel.disabled = count === 0;

    const bulkBar = document.getElementById('wm-bulk-bar');
    const bulkCount = document.getElementById('wm-bulk-count');
    const bulkDelNum = document.getElementById('wm-bulk-del-num');
    const topSelectAll = document.getElementById('select-all');
    const bulkSelectAll = document.getElementById('wm-bulk-select-all');

    if(bulkBar){
      if(count > 0){
        bulkBar.classList.add('visible');
      } else {
        bulkBar.classList.remove('visible');
      }
    }
    if(bulkCount) bulkCount.textContent = count === 1 ? '1 property selected' : `${count} properties selected`;
    if(bulkDelNum) bulkDelNum.textContent = count;

    const visible = getVisibleProperties();
    const allSelected = visible.length > 0 && visible.every(p => selectedIds.has(p.id));
    if(topSelectAll) topSelectAll.checked = allSelected;
    if(bulkSelectAll) bulkSelectAll.checked = allSelected;
  }

  function getVisibleProperties(){
    let props = allProperties;
    if(currentFilter === 'all-watermarked'){
      props = props.filter(p => scanResults[p.id]?.overallFlag === 'all');
    } else if(currentFilter === 'some-watermarked'){
      props = props.filter(p => ['all','some'].includes(scanResults[p.id]?.overallFlag));
    } else if(currentFilter === 'clean'){
      props = props.filter(p => scanResults[p.id]?.overallFlag === 'clean');
    }

    if(searchQuery && searchQuery.trim()){
      const q = searchQuery.trim().toLowerCase();
      props = props.filter(p => {
        const title = (p.title || '').toLowerCase();
        const addr = (p.address || '').toLowerCase();
        const id = (p.id || '').toLowerCase();
        return title.includes(q) || addr.includes(q) || id.includes(q);
      });
    }

    return props;
  }

  // ─── Scan Selected ────────────────────────────────────────────────────────
  async function scanSelected(){
    if(!selectedIds.size || scanning) return;
    scanning = true;
    scanCancelled = false;
    const ids = [...selectedIds];
    const targets = allProperties.filter(p => ids.includes(p.id));
    if(!targets.length){ scanning = false; return; }

    const bar  = document.getElementById('scan-bar');
    const fill = document.getElementById('scan-fill');
    const txt  = document.getElementById('scan-text');
    bar.style.display = 'flex';
    fill.style.width  = '0%';

    let done = 0;
    for(const p of targets){
      if(scanCancelled) break;
      txt.textContent = `Scanning selected ${done+1} / ${targets.length} — ${S.esc(p.title||p.id)}`;
      await scanProperty(p);
      await saveScanResult(p);
      done++;
      fill.style.width = Math.round(done / targets.length * 100) + '%';
      const card = document.getElementById('card-' + p.id);
      if(card){
        const tmp = document.createElement('div');
        tmp.innerHTML = cardHtml(p);
        card.replaceWith(tmp.firstElementChild);
      }
      await new Promise(r => setTimeout(r, 20));
    }
    txt.textContent = scanCancelled ? 'Scan stopped' : `Done — ${targets.length} propert${targets.length===1?'y':'ies'} scanned`;
    setTimeout(() => { bar.style.display = 'none'; }, 1800);
    renderCards();
    updateSaveBtn();
    scanning = false;
    scanCancelled = false;
    S.toast(`${done} propert${done===1?'y':'ies'} scanned and saved.`, 'success');
  }

  // ─── Cascading Delete (100% Reliable, No FK Violations) ───────────────────
  async function deleteOne(id, title){
    const ok = await S.confirm({
      title:   'Delete this property?',
      message: `"${title}" will be permanently removed along with all its photos and related data. This cannot be undone.`,
      ok:      'Delete property',
      danger:  true,
    });
    if(!ok) return;
    await doDelete([id]);
  }
  async function deleteSelected(){
    if(!selectedIds.size) return;
    const ids = [...selectedIds];
    const ok  = await S.confirm({
      title:   `Delete ${ids.length} propert${ids.length===1?'y':'ies'}?`,
      message: 'This will permanently remove them, their photos, and all related database records. This cannot be undone.',
      ok:      'Delete all',
      danger:  true,
    });
    if(!ok) return;
    await doDelete(ids);
  }
  async function doDelete(ids){
    let userId = null;
    try {
      const session = await CP.Auth.getSession();
      userId = session?.data?.session?.user?.id || null;
    } catch (_) {}

    try {
      const res = await CP.Properties.deleteBulk(ids);
      if(res && res.ok !== false){
        // Audit log
        if(userId){
          await CP.sb().from('admin_actions').insert({
            user_id:     userId,
            action:      'property.bulk_delete',
            target_type: 'property',
            metadata:    { ids, count: ids.length, source: 'watermark-review' }
          }).catch(() => {});
        }

        // Smooth card removal
        for(const id of ids){
          allProperties = allProperties.filter(p => p.id !== id);
          delete scanResults[id];
          selectedIds.delete(id);
          const card = document.getElementById('card-' + id);
          if(card){
            card.style.transition = 'opacity .25s, transform .25s';
            card.style.opacity    = '0';
            card.style.transform  = 'scale(0.95)';
            setTimeout(() => card.remove(), 260);
          }
        }

        updateSelCount();
        updateSummary();
        updateTabCounts();
        updateSaveBtn();

        S.toast(`${ids.length} propert${ids.length===1?'y':'ies'} deleted successfully.`, 'success');
        document.querySelector('.appbar-sub').textContent =
          allProperties.length + ' propert' + (allProperties.length===1?'y':'ies');
        const totalBadge = document.getElementById('wm-total-badge');
        if(totalBadge) totalBadge.textContent = allProperties.length + ' propert' + (allProperties.length===1?'y':'ies');
      } else {
        throw new Error(res?.error || 'Failed to delete properties');
      }
    } catch(err){
      console.error('Delete error:', err);
      S.toast('Delete failed: ' + (err.message || err), 'error');
    }
  }

  // ─── Summary bar ─────────────────────────────────────────────────────────
  function updateSummary(){
    const scanned = allProperties.filter(p => scanResults[p.id]);
    if(!scanned.length){ document.getElementById('summary-bar').style.display='none'; return; }
    const allF  = scanned.filter(p => scanResults[p.id]?.overallFlag==='all').length;
    const someF = scanned.filter(p => scanResults[p.id]?.overallFlag==='some').length;
    const clean = scanned.filter(p => scanResults[p.id]?.overallFlag==='clean').length;
    document.getElementById('sum-all').textContent   = `${allF} fully watermarked`;
    document.getElementById('sum-some').textContent  = `${someF} partially flagged`;
    document.getElementById('sum-clean').textContent = `${clean} clean`;
    document.getElementById('sum-total').textContent = `${scanned.length} scanned`;
    document.getElementById('summary-bar').style.display = 'flex';
  }

  // ─── Lightbox ────────────────────────────────────────────────────────────
  function openLightbox(url, caption){
    if(!url) return;
    document.getElementById('lightbox-img').src  = url;
    document.getElementById('lightbox-caption').textContent = caption || '';
    document.getElementById('lightbox').classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox(){
    document.getElementById('lightbox').classList.remove('open');
    document.getElementById('lightbox-img').src = '';
    document.body.style.overflow = '';
  }

  // ─── Boot ────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', async () => {
    try { await waitReady(8000); }
    catch(e){
      const el = document.getElementById('props-list');
      if(el) el.innerHTML =
        '<div class="empty"><h3>Could not load admin tools</h3><p>'+e.message+'</p></div>';
      return;
    }
    S = window.AdminShell;

    S.on('lightbox',    (t, e) => { e?.stopPropagation?.(); openLightbox(t.dataset.url, t.dataset.cap); });
    S.on('select',      (t, e) => { e?.stopPropagation?.(); toggleSelect(t.dataset.id, t.checked); });
    S.on('select-stop', (_, e) => e?.stopPropagation?.());
    S.on('delete-one',  (t, e) => { e?.stopPropagation?.(); deleteOne(t.dataset.id, t.dataset.title); });
    S.on('find-similar-photo', (t, e) => {
      e?.stopPropagation?.();
      openSimilarFinder(t.dataset.url, t.dataset.propId);
    });

    // Card tap selection: clicking anywhere on a wm-card toggles selection
    document.getElementById('props-list').addEventListener('click', e => {
      const card = e.target.closest('.wm-card');
      if(!card) return;
      if(e.target.closest('button, input, [data-action="lightbox"], [data-action="select-stop"], [data-action="find-similar-photo"]')) {
        return;
      }
      const propId = card.dataset.cardId;
      if(!propId) return;
      const isSel = selectedIds.has(propId);
      toggleSelect(propId, !isSel);
    });

    S.on('scan-one', async (t, e) => {
      e?.stopPropagation?.();
      const p = allProperties.find(x => x.id === t.dataset.id);
      if(!p) return;
      t.disabled    = true;
      t.textContent = 'Scanning…';
      await scanProperty(p);
      const saved = await saveScanResult(p);
      const card  = document.getElementById('card-' + p.id);
      if(card){
        const tmp = document.createElement('div');
        tmp.innerHTML = cardHtml(p);
        card.replaceWith(tmp.firstElementChild);
      }
      updateSummary();
      updateSaveBtn();
      if(saved) S.toast('Scan result saved.', 'success');
      t.disabled = false;
    });

    // Stop scan button
    const btnStop = document.getElementById('btn-scan-stop');
    if(btnStop) {
      btnStop.addEventListener('click', () => {
        scanCancelled = true;
        S.toast('Stopping scan…', 'info');
      });
    }

    document.getElementById('btn-scan-all').addEventListener('click',  () => scanAll());
    document.getElementById('btn-save-all').addEventListener('click',  () => saveAllUnsaved());
    document.getElementById('btn-delete-sel').addEventListener('click', () => deleteSelected());
    document.getElementById('select-all').addEventListener('change', e => toggleSelectAll(e.target.checked));

    // Floating Bulk Action Bar bindings
    const bulkSelectAll = document.getElementById('wm-bulk-select-all');
    if(bulkSelectAll) bulkSelectAll.addEventListener('change', e => toggleSelectAll(e.target.checked));
    const bulkClear = document.getElementById('wm-bulk-clear');
    if(bulkClear) bulkClear.addEventListener('click', () => clearSelection());
    const bulkScanSel = document.getElementById('wm-bulk-scan-sel');
    if(bulkScanSel) bulkScanSel.addEventListener('click', () => scanSelected());
    const bulkDelete = document.getElementById('wm-bulk-delete');
    if(bulkDelete) bulkDelete.addEventListener('click', () => deleteSelected());

    // Search input bindings
    const searchInput = document.getElementById('wm-search-input');
    const searchClear = document.getElementById('wm-search-clear');
    let searchDebounce = null;
    if(searchInput){
      searchInput.addEventListener('input', e => {
        const val = e.target.value;
        if(searchClear) searchClear.style.display = val ? 'flex' : 'none';
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
          searchQuery = val;
          _displayLimit = 50;
          renderCards();
        }, 120);
      });
    }
    if(searchClear){
      searchClear.addEventListener('click', () => {
        if(searchInput) searchInput.value = '';
        searchClear.style.display = 'none';
        searchQuery = '';
        _displayLimit = 50;
        renderCards();
        if(searchInput) searchInput.focus();
      });
    }

    // Scroll to top floating button
    const btnScrollTop = document.getElementById('btn-scroll-top');
    if(btnScrollTop){
      window.addEventListener('scroll', () => {
        if(window.scrollY > 250){
          btnScrollTop.classList.add('visible');
        } else {
          btnScrollTop.classList.remove('visible');
        }
      }, { passive: true });
      btnScrollTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // Similar Photos Modal bindings
    document.getElementById('wm-similar-close')?.addEventListener('click', closeSimilarFinder);
    document.getElementById('wm-similar-overlay')?.addEventListener('click', closeSimilarFinder);

    document.getElementById('wm-btn-flag-all-sim')?.addEventListener('click', async () => {
      if(!_currentSimilarMatches.length) return;
      let count = 0;
      for(const m of _currentSimilarMatches){
        await CP.sb().from('property_photos').update({ watermark_status: 'watermark' }).eq('id', m.photo.id);
        m.photo.watermark_status = 'watermark';
        count++;
      }
      S.toast(`${count} matching photos flagged as watermark.`, 'success');
      load();
    });

    document.getElementById('wm-btn-select-all-sim')?.addEventListener('click', () => {
      if(!_currentSimilarMatches.length) return;
      for(const m of _currentSimilarMatches){
        selectedIds.add(m.property.id);
        const card = document.getElementById('card-' + m.property.id);
        if(card){
          card.classList.add('selected');
          const chk = card.querySelector('input[type=checkbox]');
          if(chk) chk.checked = true;
        }
      }
      updateSelCount();
      S.toast(`${_currentSimilarMatches.length} matching properties selected.`, 'success');
      closeSimilarFinder();
    });

    S.on('sim-select-prop', (t) => {
      const pid = t.dataset.propId;
      if(pid) {
        toggleSelect(pid, true);
        S.toast('Property selected for bulk action.', 'info');
      }
    });

    S.on('sim-flag-wm', async (t) => {
      const photoId = t.dataset.photoId;
      if(photoId){
        await CP.sb().from('property_photos').update({ watermark_status: 'watermark' }).eq('id', photoId);
        t.textContent = 'Flagged';
        t.disabled = true;
        S.toast('Photo marked as watermarked.', 'success');
      }
    });

    document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
    document.getElementById('lightbox').addEventListener('click', e => { if(e.target.id==='lightbox') closeLightbox(); });
    document.addEventListener('keydown', e => {
      if(e.key==='Escape') {
        closeLightbox();
        closeSimilarFinder();
      }
    });
    S.on('wm-load-more', () => {
      _displayLimit += 50;
      renderCards();
    });

    document.getElementById('filter-tabs').addEventListener('click', e => {
      const btn = e.target.closest('.chip');
      if(!btn) return;
      document.querySelectorAll('#filter-tabs .chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      _displayLimit = 50;
      renderCards();
    });

    await load();

    // ─── Real-time updates ──────────────────────────────────────────────────
    let _rtReloadTimer = null;
    function scheduleReload(){
      clearTimeout(_rtReloadTimer);
      _rtReloadTimer = setTimeout(() => { load().catch(()=>{}); }, 400);
    }
    try {
      CP.sb()
        .channel('watermark-review-properties')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'properties' }, scheduleReload)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'property_photos' }, scheduleReload)
        .subscribe();
    } catch(e){
      console.warn('[watermark-review] realtime subscription failed', e);
    }

    const _focusPropId = new URLSearchParams(location.search).get('property_id');
    if (_focusPropId) {
      const card = document.getElementById('card-' + _focusPropId);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        card.style.outline = '2px solid var(--brand)';
        card.style.borderRadius = 'var(--r-md, 8px)';
        setTimeout(() => { card.style.outline = ''; card.style.borderRadius = ''; }, 3000);
      }
    }
  });
})();
