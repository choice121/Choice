(function(){
  'use strict';
  const ready = () => window.AdminShell && window.CP && CP.Auth && CP.Landlords;
  function waitReady(ms){
    return new Promise((res,rej)=>{
      const start=Date.now();
      (function tick(){
        if(ready()) return res();
        if(Date.now()-start>ms) return rej(new Error('Admin tools failed to load.'));
        setTimeout(tick,80);
      })();
    });
  }

  function row(l){
    const S = window.AdminShell;
    const name = l.contact_name || l.business_name || l.email || '—';
    const initials = (l.contact_name||l.business_name||l.email||'?').trim().charAt(0).toUpperCase();
    const verifiedPill = l.verified
      ? '<span class="pill pill-success">Verified</span>'
      : '<span class="pill pill-muted">Unverified</span>';
    const subBits = [
      l.business_name && l.contact_name ? l.business_name : null,
      l.account_type || 'landlord',
      l.state || null,
      l.phone || null
    ].filter(Boolean).map(S.esc).join(' · ');
    return ''
      + '<div class="list-row" data-id="'+S.esc(l.id)+'" data-verified="'+(l.verified?'1':'0')+'">'
      +   '<div class="swipe-actions right">'
      +     '<button class="swipe-btn '+(l.verified?'deny':'approve')+'" data-action="toggle-verify">'
      +       (l.verified?'Unverify':'Verify')
      +     '</button>'
      +   '</div>'
      +   '<div class="list-row-inner">'
      +     '<div class="row-avatar" style="background:'+S.avatarColor(l.email||name)+'">'+S.esc(initials)+'</div>'
      +     '<div class="row-body">'
      +       '<div class="row-title">'+S.esc(name)+' '+verifiedPill+'</div>'
      +       '<div class="row-sub">'+S.esc(l.email||'—')+(subBits?' · '+subBits:'')+'</div>'
      +     '</div>'
      +     '<div class="row-meta">'+S.fmtRelative(l.created_at)+'</div>'
      +   '</div>'
      + '</div>';
  }

  let _data = [];
  async function load(){
    const list = document.getElementById('lord-list');
    const sub  = document.getElementById('page-sub');
    const cnt  = document.getElementById('count-label');
    sub.textContent = 'Loading…';
    const res = await CP.Landlords.getAll({ perPage: 500 });
    if(!res.ok){
      AdminShell.renderList(list, { error: res.error || 'Failed to load landlords.' });
      sub.textContent = 'Error';
      return;
    }
    _data = res.data || [];
    cnt.textContent = _data.length + ' account' + (_data.length===1?'':'s');
    sub.textContent = _data.length + ' total';
    AdminShell.renderList(list, _data, {
      render: row,
      emptyIcon: 'i-user',
      emptyTitle: 'No landlord accounts yet',
      emptySub: 'When landlords sign up they will appear here.'
    });
  }

  AdminShell && AdminShell.on && AdminShell.on('toggle-verify', async (target) => {
    const rowEl = target.closest('.list-row');
    if(!rowEl) return;
    const id = rowEl.dataset.id;
    const verified = rowEl.dataset.verified === '1';
    const ok = await AdminShell.confirm({
      title: verified ? 'Remove verification?' : 'Verify landlord?',
      message: verified
        ? 'This landlord will no longer appear as Verified to applicants.'
        : 'Mark this landlord as Verified. They will get a verified badge.',
      ok: verified ? 'Unverify' : 'Verify',
      danger: verified
    });
    if(!ok) return;
    const { error } = await CP.sb().from('landlords').update({ verified: !verified }).eq('id', id);
    if(error){ AdminShell.toast('Error: '+error.message, 'error'); return; }
    AdminShell.toast(verified ? 'Landlord unverified.' : 'Landlord verified!', 'success');
    await load();
  });

  document.addEventListener('cp:realtime', () => load().catch(()=>{}));
  document.addEventListener('DOMContentLoaded', async () => {
    try { await waitReady(8000); } catch(e){
      document.getElementById('lord-list').innerHTML =
        '<div class="empty"><h3>Could not load admin tools</h3><p>'+e.message+'</p></div>';
      return;
    }
    const ok = await AdminShell.requireAdmin();
    if(!ok) return;
    load().catch(err => {
      console.error('[landlords]', err);
      AdminShell.toast('Failed to load landlords', 'error');
    });
    AdminShell.on('refresh', () => load());
  });
})();
