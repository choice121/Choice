/* =====================================================================
   Choice Properties — admin-shell.js
   Shared mobile shell for admin v2: bottom nav highlighting,
   pull-to-refresh, swipe-to-act, bottom sheet, toast, skeletons,
   realtime live indicator, CSP-safe data-action delegation, helpers.
   No external deps. Loads after supabase + cp-api.
   ===================================================================== */
(function(window, document){
  'use strict';

  const Shell = {};
  const $  = (s, r) => (r||document).querySelector(s);
  const $$ = (s, r) => Array.from((r||document).querySelectorAll(s));

  // ───────────────────────── Format helpers ─────────────────────────
  Shell.esc = function(s){
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  };
  Shell.fmtDate = function(d){
    if(!d) return '—';
    try { return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }
    catch { return d; }
  };
  Shell.fmtTime = function(d){
    if(!d) return '';
    try { return new Date(d).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
    catch { return ''; }
  };
  Shell.fmtRelative = function(d){
    if(!d) return '—';
    const t = new Date(d).getTime();
    if(isNaN(t)) return '—';
    const diff = (Date.now() - t) / 1000;
    if(diff < 60) return 'just now';
    if(diff < 3600) return Math.floor(diff/60) + 'm ago';
    if(diff < 86400) return Math.floor(diff/3600) + 'h ago';
    if(diff < 604800) return Math.floor(diff/86400) + 'd ago';
    if(diff < 2592000) return Math.floor(diff/604800) + 'w ago';
    return Shell.fmtDate(d);
  };
  Shell.initials = function(first, last){
    const f = (first||'').trim().charAt(0).toUpperCase();
    const l = (last ||'').trim().charAt(0).toUpperCase();
    return (f + l) || '?';
  };
  Shell.avatarColor = function(seed){
    const palettes = [
      'linear-gradient(135deg,#006aff,#a855f7)',
      'linear-gradient(135deg,#22c55e,#3b82f6)',
      'linear-gradient(135deg,#f59e0b,#ef4444)',
      'linear-gradient(135deg,#a855f7,#ec4899)',
      'linear-gradient(135deg,#06b6d4,#3b82f6)',
      'linear-gradient(135deg,#c9a55c,#a855f7)'
    ];
    let h = 0;
    for(const c of String(seed||'')) h = (h*31 + c.charCodeAt(0)) >>> 0;
    return palettes[h % palettes.length];
  };
  Shell.statusPill = function(status){
    const s = (status||'pending').toLowerCase();
    const map = {
      pending:    { cls:'pill-warning', label:'Pending'   },
      under_review:{cls:'pill-info',    label:'In Review' },
      approved:   { cls:'pill-success', label:'Approved'  },
      denied:     { cls:'pill-danger',  label:'Denied'    },
      waitlisted: { cls:'pill-purple',  label:'Waitlisted'},
      withdrawn:  { cls:'pill-muted',   label:'Withdrawn' },
      paid:       { cls:'pill-success', label:'Paid'      },
      unpaid:     { cls:'pill-danger',  label:'Unpaid'    },
      waived:     { cls:'pill-warning', label:'Waived'    },
      sent:       { cls:'pill-info',    label:'Sent'      },
      signed:     { cls:'pill-success', label:'Signed'    },
      confirmed:  { cls:'pill-success', label:'Confirmed' }
    };
    const m = map[s] || { cls:'pill-muted', label: s };
    return '<span class="pill '+m.cls+'">'+Shell.esc(m.label)+'</span>';
  };

  // ───────────────────────── Toast ─────────────────────────
  function ensureToastStack(){
    let stack = $('.toast-stack');
    if(!stack){ stack = document.createElement('div'); stack.className='toast-stack'; document.body.appendChild(stack); }
    return stack;
  }
  Shell.toast = function(msg, type, ttl){
    const stack = ensureToastStack();
    const el = document.createElement('div');
    el.className = 'toast ' + (type||'');
    el.textContent = msg;
    stack.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(-8px)'; el.style.transition='opacity .25s, transform .25s'; setTimeout(()=>el.remove(), 260); }, ttl || 3000);
  };

  // ───────────────────────── Bottom sheet ─────────────────────────
  Shell.openSheet = function(opts){
    opts = opts || {};
    let backdrop = $('.sheet-backdrop'), sheet = $('.sheet');
    if(!backdrop){ backdrop = document.createElement('div'); backdrop.className='sheet-backdrop'; document.body.appendChild(backdrop); }
    if(!sheet){
      sheet = document.createElement('div'); sheet.className='sheet';
      sheet.innerHTML = '<div class="sheet-handle"></div><div class="sheet-header"><div class="sheet-title"></div><button class="btn-icon" data-shell-close-sheet aria-label="Close"><svg class="i" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div><div class="sheet-body"></div>';
      document.body.appendChild(sheet);
    }
    sheet.querySelector('.sheet-title').textContent = opts.title || '';
    sheet.querySelector('.sheet-body').innerHTML = opts.body || '';
    requestAnimationFrame(() => { backdrop.classList.add('open'); sheet.classList.add('open'); });
    backdrop.onclick = Shell.closeSheet;
  };
  Shell.closeSheet = function(){
    const backdrop = $('.sheet-backdrop'), sheet = $('.sheet');
    if(backdrop) backdrop.classList.remove('open');
    if(sheet)    sheet.classList.remove('open');
  };

  // ───────────────────────── Pull-to-refresh ─────────────────────────
  function initPullToRefresh(){
    const ptr = document.createElement('div');
    ptr.className = 'ptr';
    ptr.innerHTML = '<div class="spinner"></div><span>Refreshing…</span>';
    document.body.appendChild(ptr);

    let startY = 0, pulling = false;
    document.addEventListener('touchstart', (e) => {
      if(window.scrollY > 0) return;
      startY = e.touches[0].clientY;
      pulling = true;
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
      if(!pulling) return;
      const dy = e.touches[0].clientY - startY;
      if(dy > 80){ pulling = false; ptr.classList.add('active'); setTimeout(()=>{ location.reload(); }, 250); }
    }, { passive: true });
    document.addEventListener('touchend', () => { pulling = false; }, { passive: true });
  }

  // ───────────────────────── Swipe to act ─────────────────────────
  function initSwipeRows(){
    let active = null, startX = 0, dx = 0;
    document.addEventListener('touchstart', (e) => {
      const inner = e.target.closest('.list-row-inner');
      if(!inner) return;
      const row = inner.closest('.list-row');
      if(!row || !row.querySelector('.swipe-actions')) return;
      active = inner; startX = e.touches[0].clientX; dx = 0;
      inner.style.transition = 'none';
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
      if(!active) return;
      dx = e.touches[0].clientX - startX;
      const row = active.closest('.list-row');
      const hasLeft  = !!row.querySelector('.swipe-actions.left');
      const hasRight = !!row.querySelector('.swipe-actions.right');
      if(dx > 0 && !hasLeft)  dx = 0;
      if(dx < 0 && !hasRight) dx = 0;
      dx = Math.max(-160, Math.min(160, dx));
      active.style.transform = 'translateX('+dx+'px)';
    }, { passive: true });
    document.addEventListener('touchend', () => {
      if(!active) return;
      const row = active.closest('.list-row');
      active.style.transition = 'transform .25s';
      if(Math.abs(dx) > 80){
        const target = dx > 0 ? 100 : -100;
        active.style.transform = 'translateX('+target+'px)';
      } else {
        active.style.transform = 'translateX(0)';
      }
      active = null;
    }, { passive: true });
    // Tap outside any open swipe row to reset
    document.addEventListener('click', (e) => {
      if(e.target.closest('.swipe-btn')) return;
      $$('.list-row-inner').forEach(el => { el.style.transition = 'transform .2s'; el.style.transform = 'translateX(0)'; });
    });
  }

  // ───────────────────────── CSP-safe data-action delegation ─────────────────────────
  const handlers = {};
  Shell.on = function(name, fn){ handlers[name] = fn; };
  function initActions(){
    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if(!target) return;
      const action = target.getAttribute('data-action');
      // Built-in actions
      if(action === 'sign-out'){
        if(window.CP && CP.sb) CP.sb().auth.signOut().then(() => location.href = 'login.html');
        else location.href = 'login.html';
        return;
      }
      if(action === 'close-sheet'){ Shell.closeSheet(); return; }
      if(action === 'go-back'){ history.length > 1 ? history.back() : (location.href = 'dashboard.html'); return; }
      // User-registered actions
      if(handlers[action]){ e.preventDefault(); handlers[action](target, e); }
    });
    // Built-in close-sheet via data-shell-close-sheet attribute
    document.addEventListener('click', (e) => {
      if(e.target.closest('[data-shell-close-sheet]')) Shell.closeSheet();
    });
  }

  // ───────────────────────── Realtime live indicator ─────────────────────────
  function initLiveIndicator(){
    if(!window.CP || !CP.sb) return;
    try {
      const channel = CP.sb()
        .channel('admin-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, () => {
          document.dispatchEvent(new CustomEvent('cp:realtime', { detail: { table: 'applications' } }));
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'leases' }, () => {
          document.dispatchEvent(new CustomEvent('cp:realtime', { detail: { table: 'leases' } }));
        })
        .subscribe((status) => {
          const dots = $$('.live-dot');
          if(status === 'SUBSCRIBED') dots.forEach(d => d.style.background = 'var(--success)');
          else dots.forEach(d => d.style.background = 'var(--muted-2)');
        });
      window.__cpLiveChannel = channel;
    } catch(err){ console.warn('[admin-shell] realtime init failed', err); }
  }

  // ───────────────────────── Tab bar / sidebar active state ─────────────────────────
  function initActiveNav(){
    const path = location.pathname.split('/').pop() || 'dashboard.html';
    $$('[data-nav]').forEach(el => {
      const target = el.getAttribute('data-nav');
      if(target === path || (target === 'dashboard.html' && (path === '' || path === 'index.html'))) el.classList.add('active');
    });
  }

  // ───────────────────────── Skeleton helpers ─────────────────────────
  Shell.skeletonRows = function(n, opts){
    opts = opts || {};
    let html = '';
    for(let i=0;i<n;i++){
      html += '<div class="list-row"><div class="list-row-inner">'
        + (opts.avatar !== false ? '<div class="skeleton sk-circle"></div>' : '')
        + '<div style="flex:1"><div class="skeleton sk-line lg" style="width:'+(40+Math.random()*40)+'%"></div><div class="skeleton sk-line sm" style="width:'+(30+Math.random()*30)+'%"></div></div>'
        + '</div></div>';
    }
    return html;
  };
  Shell.skeletonKpis = function(n){
    let html = '';
    for(let i=0;i<n;i++){
      html += '<div class="kpi-chip"><div class="skeleton sk-line sm" style="width:60%"></div><div class="skeleton sk-line lg" style="width:40%;margin-top:8px"></div></div>';
    }
    return html;
  };

  // ───────────────────────── Auth boot helper ─────────────────────────
  Shell.requireAdmin = async function(){
    if(!window.CP || !CP.Auth) return false;
    try {
      const ok = await CP.Auth.requireAdmin();
      if(!ok) return false;
      const user = await CP.Auth.getUser();
      const nameEl = $('#admin-name');
      if(nameEl) nameEl.textContent = user?.email || 'Admin';
      return true;
    } catch(e){ console.error('[admin-shell] requireAdmin', e); return false; }
  };

  // ───────────────────────── Boot ─────────────────────────
  function boot(){
    initActions();
    initActiveNav();
    initSwipeRows();
    if('ontouchstart' in window) initPullToRefresh();
    // Defer realtime to after CP is ready
    setTimeout(initLiveIndicator, 800);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.AdminShell = Shell;
})(window, document);
