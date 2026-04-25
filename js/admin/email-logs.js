(function(){
  'use strict';
  let _all = [];
  let _debounce = null;

  function pillFor(status){
    const s = (status||'').toLowerCase();
    if(s === 'success' || s === 'sent') return '<span class="pill pill-success">'+s+'</span>';
    if(s === 'failed') return '<span class="pill pill-danger">failed</span>';
    return '<span class="pill pill-muted">'+(s||'—')+'</span>';
  }

  function row(l){
    const S = AdminShell;
    const errBlock = l.error_msg
      ? '<div class="row-sub" style="color:var(--danger);margin-top:4px">'+S.esc(l.error_msg)+'</div>'
      : '';
    const appLink = l.app_id
      ? '<a href="applications.html?id='+S.esc(l.app_id)+'" style="font-family:monospace">'+S.esc(l.app_id)+'</a>'
      : '<span class="muted">—</span>';
    return ''
      + '<div class="list-row">'
      +   '<div class="list-row-inner" style="align-items:flex-start">'
      +     '<div class="row-body">'
      +       '<div class="row-title">'+S.esc(l.recipient||'—')+' '+pillFor(l.status)+'</div>'
      +       '<div class="row-sub">'+S.esc(l.type||'—')+' · '+appLink+'</div>'
      +       errBlock
      +     '</div>'
      +     '<div class="row-meta">'+S.fmtRelative(l.created_at)+'</div>'
      +   '</div>'
      + '</div>';
  }

  function applyFilter(){
    const app = document.getElementById('f-app').value.trim().toLowerCase();
    const type = document.getElementById('f-type').value;
    const status = document.getElementById('f-status').value;
    const f = _all.filter(l => {
      if(type && l.type !== type) return false;
      if(status && l.status !== status) return false;
      if(app && !(l.app_id||'').toLowerCase().includes(app)) return false;
      return true;
    });
    document.getElementById('count-label').textContent = f.length + ' / ' + _all.length;
    AdminShell.renderList('#log-list', f, {
      render: row,
      emptyIcon: 'i-mail',
      emptyTitle: 'No matching emails',
      emptySub: 'Try a different filter.'
    });
  }

  async function load(){
    AdminShell.renderList('#log-list', 'loading', { skeleton: 6 });
    document.getElementById('page-sub').textContent = 'Loading…';
    const res = await CP.EmailLogs.getAll({ perPage: 500 });
    if(!res.ok){
      AdminShell.renderList('#log-list', { error: res.error || 'Failed to load email logs.' });
      document.getElementById('page-sub').textContent = 'Error';
      return;
    }
    _all = res.data || [];
    document.getElementById('page-sub').textContent = _all.length + ' total';
    applyFilter();
  }

  function readyDeps(){ return window.AdminShell && window.CP && CP.Auth && CP.EmailLogs; }
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

  document.addEventListener('DOMContentLoaded', async () => {
    try { await waitReady(8000); }
    catch(e){
      document.getElementById('log-list').innerHTML =
        '<div class="empty"><h3>Could not load admin tools</h3><p>'+e.message+'</p></div>';
      return;
    }
    const ok = await AdminShell.requireAdmin();
    if(!ok) return;

    // Pre-fill filters from query string
    const params = new URLSearchParams(location.search);
    if(params.get('app'))    document.getElementById('f-app').value = params.get('app');
    if(params.get('status')) document.getElementById('f-status').value = params.get('status');
    if(params.get('type'))   document.getElementById('f-type').value = params.get('type');

    document.getElementById('f-app').addEventListener('input', () => {
      clearTimeout(_debounce); _debounce = setTimeout(applyFilter, 250);
    });
    document.getElementById('f-type').addEventListener('change', applyFilter);
    document.getElementById('f-status').addEventListener('change', applyFilter);

    AdminShell.on('refresh', () => load());
    load().catch(err => { console.error(err); AdminShell.toast('Failed to load logs','error'); });
  });
})();
