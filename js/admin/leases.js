(function(){
  'use strict';
  // I-410: Inline <script> at end of body runs DURING parsing — BEFORE deferred
  // scripts like cp-shell.js execute. So window.AdminShell is undefined here and
  // the previous early-return left the page spinning forever. Use the same
  // waitReady polling pattern used by properties.html / landlords.html instead.
  function readyDeps(){ return window.AdminShell && window.CP && CP.Applications && CP.Auth; }
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

  let _filter = 'all';
  let _rows = [];

  // ───────── Helpers ─────────
  function fmtDate(d){ if(!d) return '—'; try{ return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }catch{ return d; } }
  function fmtMoney(v){ if(v==null||v==='') return '—'; return '$' + Number(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }

  function leaseBadgeTone(s){
    return ({
      sent:'warn', awaiting_co_sign:'warn',
      signed:'success', co_signed:'success',
      voided:'danger', expired:'danger'
    })[s] || '';
  }
  function leaseBadgeLabel(s){
    return ({
      none:'No lease', sent:'Lease sent', awaiting_co_sign:'Awaiting co-sign',
      signed:'Signed', co_signed:'Fully executed',
      voided:'Voided', expired:'Expired'
    })[s] || (s || 'No lease');
  }

  // ───────── Card render ─────────
  function renderCard(app){
    const name = ((app.first_name||'') + ' ' + (app.last_name||'')).trim() || '(no name)';
    const prop = app.property_address || app.property_id || '—';
    const tone = leaseBadgeTone(app.lease_status);
    const labelText = leaseBadgeLabel(app.lease_status);
    const isCounter = !!app.management_cosigned;
    const sentLine   = app.lease_sent_date   ? `Sent ${S.esc(fmtDate(app.lease_sent_date))}` : '';
    const signedLine = app.lease_signed_date ? `Signed ${S.esc(fmtDate(app.lease_signed_date))}` : '';
    const generateLabel = ['sent','signed','co_signed'].includes(app.lease_status) ? 'Regenerate & Send' : 'Generate & Send';
    return `<div class="card" style="margin-bottom:12px" id="lcard-${S.esc(app.id)}">
      <div class="card-body">
        <div class="row-flex between" style="align-items:flex-start;gap:12px">
          <div style="min-width:0;flex:1">
            <div class="text-xs muted" style="font-family:ui-monospace,monospace;letter-spacing:.04em">${S.esc(app.app_id||app.id)}</div>
            <div class="text-strong" style="font-size:1rem;margin-top:2px">${S.esc(name)}</div>
            <div class="text-sm muted" style="margin-top:2px">${S.esc(prop)}</div>
            <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
              <span class="badge ${tone}">${S.esc(labelText)}</span>
              ${isCounter ? '<span class="badge success">Countersigned</span>' : ''}
              ${app.has_co_applicant ? '<span class="badge">Co-applicant</span>' : ''}
            </div>
          </div>
          <div class="text-xs muted" style="text-align:right;flex-shrink:0;line-height:1.5">
            ${sentLine ? `<div>${sentLine}</div>` : ''}
            ${signedLine ? `<div style="color:var(--success);font-weight:600">${signedLine}</div>` : ''}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin:14px 0;padding:12px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border)">
          <div><div class="text-xs muted">Lease start</div><div class="text-sm text-strong">${fmtDate(app.lease_start_date)}</div></div>
          <div><div class="text-xs muted">Lease end</div><div class="text-sm text-strong">${fmtDate(app.lease_end_date)}</div></div>
          <div><div class="text-xs muted">Monthly rent</div><div class="text-sm text-strong">${fmtMoney(app.monthly_rent)}</div></div>
          <div><div class="text-xs muted">Security deposit</div><div class="text-sm text-strong">${fmtMoney(app.security_deposit)}</div></div>
          <div><div class="text-xs muted">Move-in costs</div><div class="text-sm text-strong">${fmtMoney(app.move_in_costs)}</div></div>
          <div><div class="text-xs muted">Tenant signed</div><div class="text-sm text-strong">${app.signature_timestamp ? fmtDate(app.signature_timestamp) : 'Not yet'}</div></div>
        </div>

        <div class="row-flex gap-2" style="flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" data-action="generate" data-id="${S.esc(app.id)}" data-app-id="${S.esc(app.app_id||'')}">${generateLabel}</button>
          ${app.lease_pdf_url ? `<button class="btn btn-ghost btn-sm" data-action="download" data-app-id="${S.esc(app.app_id||'')}"><svg class="i i-sm"><use href="#i-out"/></svg> Download PDF</button>` : ''}
          ${app.lease_status === 'sent' ? `<button class="btn btn-ghost btn-sm" data-action="remind" data-app-id="${S.esc(app.app_id||'')}"><svg class="i i-sm"><use href="#i-bell"/></svg> Send reminder</button>` : ''}
          ${app.lease_status === 'signed' && !isCounter ? `<button class="btn btn-ghost btn-sm" data-action="cosign" data-id="${S.esc(app.id)}" data-app-id="${S.esc(app.app_id||'')}"><svg class="i i-sm"><use href="#i-check"/></svg> Countersign</button>` : ''}
          ${app.lease_status === 'sent' ? `<button class="btn btn-danger btn-sm" data-action="void" data-id="${S.esc(app.id)}">Void</button>` : ''}
          <button class="btn btn-ghost btn-sm" data-action="toggle-detail" data-id="${S.esc(app.id)}">Notes / Details</button>
        </div>

        <div id="ldetail-${S.esc(app.id)}" style="display:none;margin-top:12px;padding:12px;background:var(--surface-2);border-radius:var(--r-md);font-size:.82rem">
          ${app.lease_notes ? `<div style="margin-bottom:6px"><strong>Lease notes:</strong> ${S.esc(app.lease_notes)}</div>` : ''}
          <div class="text-sm muted"><strong>Email:</strong> ${S.esc(app.email||'—')} &nbsp;·&nbsp; <strong>Landlord email:</strong> ${S.esc(app.landlord_email||'—')}</div>
          ${app.tenant_signature ? `<div class="text-xs" style="color:var(--success);margin-top:6px">Tenant signed: ${fmtDate(app.signature_timestamp)}</div>` : ''}
          <div class="text-xs muted" style="margin-top:10px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">Admin notes</div>
          <textarea class="form-input" id="lnotes-${S.esc(app.id)}" rows="3" placeholder="Internal lease notes…">${S.esc(app.admin_notes||'')}</textarea>
          <div style="margin-top:8px"><button class="btn btn-ghost btn-sm" data-action="save-notes" data-id="${S.esc(app.id)}">Save notes</button></div>
        </div>
      </div>
    </div>`;
  }

  // ───────── Load ─────────
  async function load(){
    S.renderList('#leases-list', 'loading', { skeleton:5 });
    const filters = (_filter === 'all') ? { status:'approved' } : { lease_status:_filter };
    const res = await CP.Applications.getAll(filters).catch(e => ({ ok:false, error: e.message }));
    if(!res.ok){
      S.renderList('#leases-list', { error: res.error || 'Failed to load' });
      document.getElementById('count-label').textContent = '';
      return;
    }
    _rows = res.data || [];
    document.getElementById('count-label').textContent =
      _rows.length + ' record' + (_rows.length!==1?'s':'');
    document.querySelector('.appbar-sub').textContent =
      _filter === 'all' ? 'Approved applications' : ('Filter: ' + leaseBadgeLabel(_filter));
    if(!_rows.length){
      document.getElementById('leases-list').innerHTML =
        '<div class="empty"><svg class="i"><use href="#i-leases"/></svg>'+
        '<h3>No records</h3><p>No applications match this filter.</p></div>';
      return;
    }
    document.getElementById('leases-list').innerHTML = _rows.map(renderCard).join('');
  }

  function findApp(id){ return _rows.find(r => String(r.id) === String(id)); }

  // ───────── Generate / preview ─────────
  // I-407: All Edge Function calls go through S.callFn (cp-shell.js).
  // Local copy removed — was silently no-op'ing on missing CONFIG and
  // showing a single-line "Session expired" toast that users missed.
  // S.callFn now hard-redirects to login on missing token + visible toasts
  // for CONFIG / network / non-2xx failures.
  const callFn = (path, body) => S.callFn(path, body);

  async function openGenerateSheet(id, appId){
    const app = findApp(id) || {};
    const data = await S.formSheet({
      title: 'Generate & send lease',
      submit: 'Generate & send',
      fields: [
        { name:'lease_start_date',  label:'Lease start date', type:'date', value: app.lease_start_date ? String(app.lease_start_date).slice(0,10) : '' },
        { name:'lease_end_date',    label:'Lease end date',   type:'date', value: app.lease_end_date   ? String(app.lease_end_date).slice(0,10)   : '' },
        { name:'monthly_rent',      label:'Monthly rent ($)', type:'number', value: app.monthly_rent || '', placeholder:'1200.00' },
        { name:'security_deposit',  label:'Security deposit ($)', type:'number', value: app.security_deposit || '', placeholder:'1200.00' },
        { name:'move_in_costs',     label:'Move-in costs ($)', type:'number', value: app.move_in_costs || '', placeholder:'2400.00' },
        { name:'lease_late_fee_flat', label:'Late fee (flat $)', type:'number', value: app.lease_late_fee_flat || '', placeholder:'50' },
        { name:'lease_landlord_name', label:'Landlord name', value: app.lease_landlord_name || 'Choice Properties' },
        { name:'lease_state_code',  label:'State code', value: app.lease_state_code || 'MI' },
        { name:'lease_landlord_address', label:'Landlord address', value: app.lease_landlord_address || '2265 Livernois Suite 500, Troy MI 48083' },
        { name:'lease_pets_policy', label:'Pets policy', value: app.lease_pets_policy || '', placeholder:'No pets allowed.' },
        { name:'lease_smoking_policy', label:'Smoking policy', value: app.lease_smoking_policy || '', placeholder:'No smoking permitted on premises.' },
        { name:'lease_notes', label:'Lease notes (internal)', type:'textarea', rows:2, value: app.lease_notes || '' },
        { name:'preview_only', type:'checkbox', label:'Preview only', checkLabel:'Preview PDF without sending email', value:false }
      ]
    });
    if(!data) return;
    const leaseData = {
      lease_start_date:       data.lease_start_date || null,
      lease_end_date:         data.lease_end_date   || null,
      monthly_rent:           data.monthly_rent     ? parseFloat(data.monthly_rent) : null,
      security_deposit:       data.security_deposit ? parseFloat(data.security_deposit) : null,
      move_in_costs:          data.move_in_costs    ? parseFloat(data.move_in_costs) : null,
      lease_late_fee_flat:    data.lease_late_fee_flat ? parseFloat(data.lease_late_fee_flat) : null,
      lease_landlord_name:    data.lease_landlord_name    || 'Choice Properties',
      lease_landlord_address: data.lease_landlord_address || '2265 Livernois Suite 500, Troy MI 48083',
      lease_state_code:       data.lease_state_code       || 'MI',
      lease_pets_policy:      data.lease_pets_policy      || null,
      lease_smoking_policy:   data.lease_smoking_policy   || null,
      lease_notes:            data.lease_notes            || null
    };
    const dryRun = !!data.preview_only;
    S.toast(dryRun ? 'Generating preview…' : 'Generating lease…');
    const res = await callFn('/generate-lease', { app_id: appId, lease_data: leaseData, dry_run: dryRun });
    if(!res){ return; }
    if(!res.ok){ S.toast(res.json.error || 'Generation failed', 'error'); return; }
    if(dryRun && res.json.preview_url){ window.open(res.json.preview_url, '_blank'); S.toast('Preview ready.'); return; }
    S.toast('Lease generated and signing email sent!', 'success');
    await load();
  }

  async function openCosignSheet(id, appId){
    const data = await S.formSheet({
      title: 'Management countersignature',
      submit: 'Countersign lease',
      fields: [
        { name:'signer_name', label:'Management signer name', required:true, placeholder:'e.g. John Smith, Property Manager' },
        { name:'notes', label:'Internal notes (optional)', type:'textarea', rows:2 }
      ]
    });
    if(!data) return;
    if(!data.signer_name || !data.signer_name.trim()){ S.toast('Signer name is required','error'); return; }
    S.toast('Counter-signing…');
    const res = await callFn('/countersign', { app_id: appId, signer_name: data.signer_name.trim(), notes: (data.notes||'').trim() });
    if(!res) return;
    if(!res.ok){ S.toast(res.json.error || 'Countersign failed','error'); return; }
    S.toast('Lease countersigned. Fully-executed email sent.','success');
    await load();
  }

  async function sendReminder(appId){
    const ok = await S.confirm({ title:'Send signing reminder?', message:'A reminder email will be sent to the tenant.', ok:'Send reminder' });
    if(!ok) return;
    const session = await CP.Auth.getSession();
    const token = session?.access_token || CONFIG.SUPABASE_ANON_KEY;
    try {
      const res = await fetch(CONFIG.SUPABASE_URL + '/functions/v1/send-email', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'apikey': CONFIG.SUPABASE_ANON_KEY, 'Authorization':'Bearer ' + token },
        body: JSON.stringify({ app_id: appId, type:'lease_signing_reminder' })
      });
      const json = await res.json().catch(() => ({}));
      if(!res.ok || json.success === false){ S.toast('Email failed: ' + (json.error || res.statusText),'error'); return; }
      S.toast('Reminder sent to tenant.','success');
    } catch(e){ S.toast('Error: ' + e.message,'error'); }
  }

  async function voidLease(id){
    const ok = await S.confirm({ title:'Void this lease?', message:'The tenant will no longer be able to sign. This cannot be undone.', ok:'Void lease', danger:true });
    if(!ok) return;
    const { error } = await CP.sb().from('applications')
      .update({ lease_status:'voided', updated_at: new Date().toISOString() })
      .eq('id', id);
    if(error){ S.toast('Error: ' + error.message,'error'); return; }
    S.toast('Lease voided.','success');
    await load();
  }

  async function downloadLease(appId){
    S.toast('Generating download link…');
    const res = await callFn('/download-lease', { app_id: appId });
    if(!res) return;
    if(!res.ok || !res.json.signed_url){ S.toast(res.json.error || 'Could not get download link','error'); return; }
    window.open(res.json.signed_url, '_blank');
  }

  async function saveNotes(id){
    const ta = document.getElementById('lnotes-' + id);
    if(!ta) return;
    const { ok, error } = await CP.Applications.saveNotes(id, ta.value);
    if(!ok){ S.toast('Error: ' + error,'error'); return; }
    S.toast('Notes saved.');
  }

  function toggleDetail(id){
    const el = document.getElementById('ldetail-' + id);
    if(!el) return;
    el.style.display = (el.style.display === 'block') ? 'none' : 'block';
  }

  document.addEventListener('DOMContentLoaded', async () => {
    try { await waitReady(8000); }
    catch(e){
      const el = document.getElementById('leases-list');
      if(el) el.innerHTML = '<div class="empty"><h3>Could not load admin tools</h3><p>'+e.message+'</p></div>';
      return;
    }
    S = window.AdminShell;

    // ───────── Wiring (after S is available) ─────────
    S.on('generate',      (t) => openGenerateSheet(t.dataset.id, t.dataset.appId));
    S.on('cosign',        (t) => openCosignSheet(t.dataset.id, t.dataset.appId));
    S.on('remind',        (t) => sendReminder(t.dataset.appId));
    S.on('void',          (t) => voidLease(t.dataset.id));
    S.on('download',      (t) => downloadLease(t.dataset.appId));
    S.on('save-notes',    (t) => saveNotes(t.dataset.id));
    S.on('toggle-detail', (t) => toggleDetail(t.dataset.id));

    document.getElementById('filter-tabs').addEventListener('click', async e => {
      const btn = e.target.closest('.chip');
      if(!btn) return;
      document.querySelectorAll('#filter-tabs .chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _filter = btn.dataset.lease;
      await load();
    });

    const okAuth = await S.requireAdmin();
    if(!okAuth) return;
    await load().catch(err => {
      console.error('[leases] load failed', err);
      S.toast('Failed to load leases','error');
    });
  });
})();
