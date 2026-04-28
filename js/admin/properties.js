(function(){
  'use strict';

  // ─────────────────────────── State ───────────────────────────
  let _statusFilter = 'all';
  let _q = '';
  let _debounce = null;
  let _allCache = [];
  let _selectMode = false;
  const _selected = new Set();

  // ─────────────────────────── Helpers ───────────────────────────
  function fmtMoney(v){ if(v==null) return '—'; return '$'+Number(v).toLocaleString('en-US'); }
  function statusLabel(s){
    const m = { active:'Active', rented:'Rented', inactive:'Inactive', maintenance:'Maintenance' };
    return m[s] || (s||'Unknown');
  }
  function shortAddr(p){
    if(p.address) return p.address;
    const parts = [p.city, p.state].filter(Boolean);
    return parts.join(', ') || 'No address';
  }

  // ─────────────────────────── Card markup ───────────────────────────
  function card(p){
    const S = AdminShell;
    const photos = Array.isArray(p.photo_urls) ? p.photo_urls : [];
    const heroUrl = photos[0] || '';
    const photoCount = photos.length;
    const status = (p.status || 'unknown').toLowerCase();
    const meta = [
      p.bedrooms!=null ? p.bedrooms+' bd' : null,
      p.bathrooms!=null ? p.bathrooms+' ba' : null,
      p.square_footage ? p.square_footage.toLocaleString()+' sqft' : null
    ].filter(Boolean);
    const metaHtml = meta.length
      ? meta.map((m,i) => (i?'<span class="dot"></span>':'')+'<span>'+S.esc(m)+'</span>').join('')
      : '<span style="opacity:.6">No specs</span>';
    const isSelected = _selected.has(p.id);

    const media = heroUrl
      ? '<img src="'+S.esc(heroUrl)+'" alt="" loading="lazy" decoding="async">'
      : '<div class="ph"><svg class="i"><use href="#i-property"/></svg></div>';

    const photoCountHtml = photoCount > 1
      ? '<div class="prop-photo-count" aria-hidden="true">'
      +   '<svg class="i"><use href="#i-image"/></svg>'+photoCount
      + '</div>'
      : '';

    return ''
      + '<article class="prop-shell'+(isSelected?' is-selected':'')+'" data-id="'+S.esc(p.id)+'">'
      +   '<div class="prop-media">'
      +     media
      +     '<span class="prop-status-badge s-'+S.esc(status)+'">'+S.esc(statusLabel(status))+'</span>'
      +     photoCountHtml
      +     '<button class="prop-checkbox" type="button" data-action="toggle-select" data-id="'+S.esc(p.id)+'" aria-label="Select property" aria-pressed="'+(isSelected?'true':'false')+'">'
      +       '<svg class="i"><use href="#i-check"/></svg>'
      +     '</button>'
      +     '<div class="prop-actions-overlay">'
      +       '<a class="prop-action-btn" href="/property.html?id='+S.esc(p.id)+'" target="_blank" rel="noopener" title="View public page" aria-label="View public page">'
      +         '<svg class="i"><use href="#i-eye"/></svg>'
      +       '</a>'
      +       '<button class="prop-action-btn" type="button" data-action="edit-prop" data-id="'+S.esc(p.id)+'" title="Edit" aria-label="Edit property">'
      +         '<svg class="i"><use href="#i-edit"/></svg>'
      +       '</button>'
      +       '<button class="prop-action-btn danger" type="button" data-action="delete-prop" data-id="'+S.esc(p.id)+'" title="Delete forever" aria-label="Delete property forever">'
      +         '<svg class="i"><use href="#i-trash"/></svg>'
      +       '</button>'
      +     '</div>'
      +   '</div>'
      +   '<div class="prop-body">'
      +     '<div class="prop-title">'+S.esc(p.title||'Untitled')+'</div>'
      +     '<div class="prop-addr">'+S.esc(shortAddr(p))+'</div>'
      +     '<div class="prop-meta-row">'+metaHtml+'</div>'
      +     '<div class="prop-rent">'+(p.monthly_rent ? fmtMoney(p.monthly_rent)+'<span class="per"> /mo</span>' : '<span style="color:var(--muted);font-weight:600">No rent set</span>')+'</div>'
      +     '<div class="prop-stats">'
      +       '<span><svg class="i"><use href="#i-eye"/></svg>'+(p.views_count||0)+' views</span>'
      +       '<span><svg class="i"><use href="#i-clock"/></svg>'+(p.updated_at ? timeAgo(p.updated_at) : '—')+'</span>'
      +     '</div>'
      +   '</div>'
      + '</article>';
  }

  function timeAgo(iso){
    try {
      const d = new Date(iso); const s = (Date.now() - d.getTime())/1000;
      if(s < 60) return 'just now';
      if(s < 3600) return Math.floor(s/60)+'m ago';
      if(s < 86400) return Math.floor(s/3600)+'h ago';
      if(s < 604800) return Math.floor(s/86400)+'d ago';
      return d.toLocaleDateString();
    } catch(_) { return '—'; }
  }

  // ─────────────────────────── Data load ───────────────────────────
  async function load(){
    const grid = document.getElementById('prop-grid');
    grid.innerHTML = '<div class="skeleton sk-line lg" style="height:280px;border-radius:14px"></div>'.repeat(3);
    document.getElementById('page-sub').textContent = 'Loading…';
    let q = CP.sb().from('properties').select('*, property_photos(url,display_order)').order('created_at',{ascending:false});
    if(_statusFilter !== 'all') q = q.eq('status', _statusFilter);
    if(_q.trim()){
      const s = _q.trim().replace(/'/g,"''");
      q = q.or('title.ilike.%'+s+'%,address.ilike.%'+s+'%');
    }
    const { data, error } = await q;
    if(error){
      grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><svg class="i"><use href="#i-alert"/></svg><h3>Error</h3><p>'+AdminShell.esc(error.message)+'</p></div>';
      document.getElementById('page-sub').textContent = 'Error';
      return;
    }
    _allCache = (data || []).map(function(p) {
      if (Array.isArray(p.property_photos) && p.property_photos.length) {
        var sorted = p.property_photos.slice().sort(function(a,b){ return (a.display_order||0)-(b.display_order||0); });
        p.photo_urls = sorted.map(function(x){ return x.url; }).filter(Boolean);
      } else {
        p.photo_urls = [];
      }
      return p;
    });
    // Drop selections that no longer exist after a reload
    const existing = new Set(_allCache.map(p => p.id));
    Array.from(_selected).forEach(id => { if(!existing.has(id)) _selected.delete(id); });

    document.getElementById('page-sub').textContent = _allCache.length+' propert'+(_allCache.length===1?'y':'ies');
    if(!_allCache.length){
      grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><svg class="i"><use href="#i-property"/></svg><h3>No properties</h3><p>Tap + to add one.</p></div>';
      updateBulkBar();
      return;
    }
    grid.innerHTML = _allCache.map(card).join('');
    updateBulkBar();
  }

  // ─────────────────────────── Selection / bulk bar ───────────────────────────
  function setSelectMode(on){
    _selectMode = !!on;
    const grid = document.getElementById('prop-grid');
    const bar = document.getElementById('bulkbar');
    const toggleBtn = document.getElementById('btn-select-toggle');
    if(_selectMode){
      grid.classList.add('select-mode');
      bar.classList.add('show');
      toggleBtn.querySelector('span').textContent = 'Done';
    } else {
      grid.classList.remove('select-mode');
      bar.classList.remove('show');
      toggleBtn.querySelector('span').textContent = 'Select';
      _selected.clear();
      // Clear visual selected state
      document.querySelectorAll('.prop-shell.is-selected').forEach(el => el.classList.remove('is-selected'));
    }
    updateBulkBar();
  }
  function updateBulkBar(){
    const n = _selected.size;
    const cEl = document.getElementById('bulk-count');
    const dEl = document.getElementById('bulk-delete');
    if(cEl) cEl.textContent = n + ' selected';
    if(dEl) dEl.disabled = n === 0;
  }
  function toggleSelect(id){
    if(_selected.has(id)) _selected.delete(id); else _selected.add(id);
    const el = document.querySelector('.prop-shell[data-id="'+CSS.escape(id)+'"]');
    if(el){
      el.classList.toggle('is-selected', _selected.has(id));
      const cb = el.querySelector('.prop-checkbox');
      if(cb) cb.setAttribute('aria-pressed', _selected.has(id) ? 'true' : 'false');
    }
    updateBulkBar();
  }

  // ─────────────────────────── Hard delete ───────────────────────────
  async function hardDeleteOne(id){
    const { error } = await CP.sb().from('properties').delete().eq('id', id);
    if(error) throw error;
  }
  async function hardDeleteMany(ids){
    if(!ids.length) return { ok:0, fail:0, errors:[] };
    const { error } = await CP.sb().from('properties').delete().in('id', ids);
    if(error){
      // Fallback: try one at a time so partial success is possible.
      let ok = 0, errors = [];
      for(const id of ids){
        try { await hardDeleteOne(id); ok++; }
        catch(e){ errors.push({ id, msg: e.message || String(e) }); }
      }
      return { ok, fail: errors.length, errors };
    }
    return { ok: ids.length, fail: 0, errors: [] };
  }

  async function confirmDeleteOne(id){
    const p = _allCache.find(x => x.id === id);
    const label = p ? (p.title || 'this property') : 'this property';
    const ok = await AdminShell.confirm({
      title: 'Delete this property forever?',
      message: 'You are about to permanently delete "' + label + '". '
             + 'This cannot be undone. All linked photos, inquiries, and saves will also be removed. '
             + 'Tenant applications tied to it will keep their history but lose the property reference.',
      ok: 'Delete forever', cancel: 'Keep', danger: true
    });
    if(!ok) return;
    try {
      await hardDeleteOne(id);
      _selected.delete(id);
      AdminShell.toast('Property deleted', 'success');
      load();
    } catch(e){
      AdminShell.toast('Delete failed: ' + (e.message || e), 'error');
    }
  }

  async function confirmDeleteSelected(){
    const ids = Array.from(_selected);
    if(!ids.length) return;
    const sample = ids.slice(0, 3).map(id => {
      const p = _allCache.find(x => x.id === id);
      return p ? (p.title || p.id) : id;
    });
    const more = ids.length > sample.length ? ' and ' + (ids.length - sample.length) + ' more' : '';
    const ok = await AdminShell.confirm({
      title: 'Delete ' + ids.length + ' propert' + (ids.length===1?'y':'ies') + ' forever?',
      message: 'This will permanently delete: ' + sample.join(', ') + more + '. '
             + 'This cannot be undone. All linked photos, inquiries, and saves will also be removed. '
             + 'Tenant applications tied to these properties will keep their history but lose the property reference.',
      ok: 'Delete ' + ids.length + ' forever', cancel: 'Keep', danger: true
    });
    if(!ok) return;
    const res = await hardDeleteMany(ids);
    if(res.fail === 0){
      AdminShell.toast(res.ok + ' propert' + (res.ok===1?'y':'ies') + ' deleted', 'success');
    } else if (res.ok === 0){
      AdminShell.toast('Delete failed: ' + (res.errors[0]?.msg || 'unknown error'), 'error');
    } else {
      AdminShell.toast(res.ok + ' deleted, ' + res.fail + ' failed', 'warning');
    }
    setSelectMode(false);
    load();
  }

  // ─────────────────────────── Edit form (unchanged shape, no in-form delete) ───────────────────────────
  function fields(p){
    p = p || {};
    return [
      { name:'title',          label:'Title',         type:'text',     value:p.title||'',          required:true,  placeholder:'2BR/1BA Apartment' },
      { name:'status',         label:'Status',        type:'select',   value:p.status||'active', options:[
          {value:'active',label:'Active'},{value:'inactive',label:'Inactive'},{value:'rented',label:'Rented'},{value:'maintenance',label:'Maintenance'}
        ]},
      { name:'address',        label:'Address',       type:'text',     value:p.address||p.location||'', required:true, placeholder:'123 Main St, City, State 12345' },
      { name:'bedrooms',       label:'Bedrooms',      type:'number',   value:p.bedrooms!=null?p.bedrooms:'', placeholder:'2' },
      { name:'bathrooms',      label:'Bathrooms',     type:'number',   value:p.bathrooms!=null?p.bathrooms:'', placeholder:'1' },
      { name:'monthly_rent',   label:'Monthly rent',  type:'number',   value:p.monthly_rent||'', placeholder:'1500' },
      { name:'property_type',  label:'Type',          type:'select',   value:p.property_type||'', options:[
          {value:'',label:'Select…'},{value:'apartment',label:'Apartment'},{value:'house',label:'House'},
          {value:'condo',label:'Condo'},{value:'townhouse',label:'Townhouse'},{value:'studio',label:'Studio'},{value:'duplex',label:'Duplex'}
        ]},
      { name:'square_footage', label:'Sq ft',         type:'number',   value:p.square_footage||'', placeholder:'850' },
      { name:'available_date', label:'Available',     type:'date',     value:p.available_date||'' },
      { name:'description',    label:'Description',   type:'textarea', value:p.description||'', rows:3 },
      { name:'amenities',      label:'Amenities',     type:'text',     value:(p.amenities||[]).join(', '), placeholder:'Parking, Laundry, AC, Pets OK', help:'Comma-separated' }
    ];
  }

  async function openForm(p){
    const isEdit = !!(p && p.id);
    const data = await AdminShell.formSheet({
      title: isEdit ? 'Edit property' : 'Add property',
      submit: isEdit ? 'Save changes' : 'Create property',
      fields: fields(p)
    });
    if(!data) return;
    if(!data.title || !data.address){
      AdminShell.toast('Title and address are required','error'); return;
    }

    // Confirm every save action
    const confirmMsg = isEdit
      ? 'Save changes to "' + (data.title||'this property') + '"?'
      : 'Create new property "' + (data.title||'') + '"?';
    const okSave = await AdminShell.confirm({
      title: isEdit ? 'Save changes?' : 'Create property?',
      message: confirmMsg,
      ok: isEdit ? 'Save' : 'Create', cancel: 'Cancel'
    });
    if(!okSave) return;

    const patch = {
      title: data.title.trim(),
      address: data.address.trim(),
      status: data.status || 'active',
      property_type: data.property_type || null,
      bedrooms: data.bedrooms !== '' ? Number(data.bedrooms) : null,
      bathrooms: data.bathrooms !== '' ? Number(data.bathrooms) : null,
      monthly_rent: data.monthly_rent !== '' ? Number(data.monthly_rent) : null,
      square_footage: data.square_footage !== '' ? Number(data.square_footage) : null,
      available_date: data.available_date || null,
      description: (data.description||'').trim() || null,
      amenities: data.amenities ? data.amenities.split(',').map(s => s.trim()).filter(Boolean) : [],
      updated_at: new Date().toISOString()
    };
    let error;
    if(isEdit){
      const r = await CP.sb().from('properties').update(patch).eq('id', p.id); error = r.error;
    } else {
      patch.created_at = new Date().toISOString();
      const r = await CP.sb().from('properties').insert([patch]); error = r.error;
    }
    if(error){ AdminShell.toast('Save failed: '+error.message,'error'); return; }
    AdminShell.toast(isEdit ? 'Updated' : 'Property added','success');
    load();
  }

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

  document.addEventListener('cp:realtime', () => load().catch(()=>{}));
  document.addEventListener('DOMContentLoaded', async () => {
    try { await waitReady(8000); }
    catch(e){
      document.getElementById('prop-grid').innerHTML =
        '<div class="empty"><h3>Could not load admin tools</h3><p>'+e.message+'</p></div>';
      return;
    }
    const ok = await AdminShell.requireAdmin();
    if(!ok) return;

    // Detect touch to pin overlay buttons visible
    if(matchMedia('(hover: none)').matches){
      document.getElementById('prop-grid').classList.add('touch');
    }

    AdminShell.on('refresh', () => load());
    AdminShell.on('add-prop', (target, e) => { e && e.preventDefault && e.preventDefault(); openForm(null); });
    AdminShell.on('edit-prop', (target) => {
      const id = target.getAttribute('data-id');
      const p = _allCache.find(x => x.id === id);
      if(p) openForm(p);
    });
    AdminShell.on('delete-prop', (target) => {
      const id = target.getAttribute('data-id');
      confirmDeleteOne(id);
    });
    AdminShell.on('toggle-select', (target) => {
      const id = target.getAttribute('data-id');
      if(!_selectMode) setSelectMode(true);
      toggleSelect(id);
    });

    // Whole-card tap toggles selection while in select mode
    document.getElementById('prop-grid').addEventListener('click', (e) => {
      if(!_selectMode) return;
      // Ignore clicks on action buttons / links inside cards (they're hidden anyway)
      if(e.target.closest('.prop-action-btn') || e.target.closest('a[href]')) return;
      const shell = e.target.closest('.prop-shell');
      if(!shell) return;
      const id = shell.getAttribute('data-id');
      if(id) toggleSelect(id);
    });

    document.getElementById('btn-select-toggle').addEventListener('click', () => setSelectMode(!_selectMode));
    document.getElementById('bulk-cancel').addEventListener('click', () => setSelectMode(false));
    document.getElementById('bulk-all').addEventListener('click', () => {
      _allCache.forEach(p => _selected.add(p.id));
      document.querySelectorAll('.prop-shell').forEach(el => {
        el.classList.add('is-selected');
        const cb = el.querySelector('.prop-checkbox');
        if(cb) cb.setAttribute('aria-pressed','true');
      });
      updateBulkBar();
    });
    document.getElementById('bulk-none').addEventListener('click', () => {
      _selected.clear();
      document.querySelectorAll('.prop-shell.is-selected').forEach(el => el.classList.remove('is-selected'));
      document.querySelectorAll('.prop-checkbox[aria-pressed="true"]').forEach(cb => cb.setAttribute('aria-pressed','false'));
      updateBulkBar();
    });
    document.getElementById('bulk-delete').addEventListener('click', () => confirmDeleteSelected());

    document.getElementById('chips').addEventListener('click', e => {
      const c = e.target.closest('.chip');
      if(!c) return;
      document.querySelectorAll('#chips .chip').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      _statusFilter = c.dataset.status;
      load();
    });
    document.getElementById('search').addEventListener('input', e => {
      _q = e.target.value;
      clearTimeout(_debounce); _debounce = setTimeout(load, 300);
    });

    await load();

    // Auto-open edit form when navigated from public property page (?edit=<id>)
    try {
      const params = new URLSearchParams(location.search);
      const editId = params.get('edit');
      if(editId){
        const p = _allCache.find(x => x.id === editId);
        if(p) openForm(p);
        // Strip the param so a refresh doesn't re-open the sheet
        const clean = location.pathname + location.hash;
        history.replaceState(null, '', clean);
      }
    } catch(_){ /* non-fatal */ }
  });
})();
