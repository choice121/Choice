'use strict';

// ─────────────────────────────────────────────────────────────────────
// js/tenant/deposit.js — Phase 09 chunk 5/5
//
// Tenant-facing view of their security-deposit accounting:
//   - Late banner if state-mandated return deadline already passed
//   - "Disputed on …" banner if they have already filed
//   - Itemized deductions with category + description + amount
//   - Totals (deposit held, deductions, interest, refund owed)
//   - "Download letter PDF" via signed URL on lease-pdfs bucket
//   - "Dispute this accounting" → modal → POST submit-deposit-dispute
//
// RLS: Phase 9 chunk 1 grants tenants SELECT on
// lease_deposit_accountings + lease_deposit_deductions whose
// applications.email = auth email. We rely on that here — no
// service-role calls from the browser.
// ─────────────────────────────────────────────────────────────────────

(function(){
  'use strict';

  const PDF_BUCKET = 'lease-pdfs';
  const CAT_LABEL = {
    rent_arrears:      'Unpaid rent',
    cleaning:          'Cleaning',
    damages:           'Property damage',
    unpaid_utilities:  'Unpaid utilities',
    early_termination: 'Early-termination charges',
    other:             'Other',
  };

  let _sb = null;
  let _user = null;
  let _state = null;   // { app, accounting, deductions, isLate }

  function getSB(){
    if (_sb) return _sb;
    if (!window.supabase || typeof CONFIG === 'undefined' || !CONFIG.SUPABASE_URL) return null;
    _sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
      auth: {
        persistSession:     true,
        autoRefreshToken:   true,
        detectSessionInUrl: false,
        flowType:           'pkce',
      },
    });
    _sb.auth.onAuthStateChange(()=>{});
    return _sb;
  }

  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);}
  function fmtMoney(v){if(v==null)return '—';const n=Number(v)||0;return '$'+n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');}
  function fmtDate(d){if(!d)return '—';try{return new Date(d).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});}catch{return d;}}
  function fmtDateShort(d){if(!d)return '—';try{return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});}catch{return d;}}
  function todayISO(){return new Date().toISOString().slice(0,10);}
  function $(s, root){return (root||document).querySelector(s);}

  function toast(msg, kind){
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast show ' + (kind || 'ok');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.className = 'toast'; }, kind === 'error' ? 5500 : 3500);
  }

  // ── Wait for the auth session set up by /tenant/login.html magic link
  async function waitForUser(){
    const sb = getSB();
    if (!sb) return null;
    for (let i = 0; i < 40; i++) {
      const { data } = await sb.auth.getUser();
      if (data?.user) return data.user;
      await new Promise(r => setTimeout(r, 80));
    }
    return null;
  }

  async function load(){
    const sb = getSB();
    if (!sb) {
      $('#loading').textContent = 'Auth library not ready — please refresh.';
      return;
    }
    _user = await waitForUser();
    if (!_user) {
      // Bounce to tenant login preserving the return path
      const ret = encodeURIComponent('/tenant/deposit.html');
      location.href = '/tenant/login.html?redirect=' + ret;
      return;
    }

    // 1. Find the application this tenant owns that has a move_out_date_actual
    const email = (_user.email || '').toLowerCase();
    const { data: apps, error: appsErr } = await sb
      .from('applications')
      .select(`id, app_id, first_name, last_name, email,
               property_address, city, state, zip,
               move_in_date_actual, move_out_date_actual,
               lease_state_code, security_deposit, pet_deposit, key_deposit`)
      .ilike('email', email)
      .not('move_out_date_actual', 'is', null)
      .order('move_out_date_actual', { ascending: false })
      .limit(1);
    if (appsErr) {
      $('#loading').textContent = 'Failed to load: ' + appsErr.message;
      return;
    }
    if (!apps || !apps.length) {
      $('#loading').style.display = 'none';
      $('#empty').style.display = 'block';
      document.body.dataset.pageSub = 'No move-out on file';
      return;
    }
    const app = apps[0];

    // 2. Find their deposit accounting (may not exist yet)
    const { data: accs, error: accErr } = await sb
      .from('lease_deposit_accountings')
      .select(`id, app_id, total_deposit_held, amount_withheld,
               refund_owed_to_tenant, interest_accrued,
               state_code_snapshot, state_return_days_snapshot,
               state_return_deadline, late_generated,
               letter_pdf_path, letter_pdf_sha256, letter_pdf_bytes,
               generated_at, sent_at, tenant_disputed_at, tenant_dispute_text`)
      .eq('app_id', app.id)
      .order('updated_at', { ascending: false })
      .limit(1);
    if (accErr) {
      $('#loading').textContent = 'Failed to load: ' + accErr.message;
      return;
    }
    const accounting = (accs && accs[0]) || null;

    // 3. Deductions
    let deductions = [];
    if (accounting) {
      const { data: deds } = await sb
        .from('lease_deposit_deductions')
        .select('id, category, description, amount, sort_order')
        .eq('accounting_id', accounting.id)
        .order('sort_order', { ascending: true });
      deductions = deds || [];
    }

    _state = { app, accounting, deductions };
    render();
  }

  function render(){
    const { app, accounting, deductions } = _state;
    $('#loading').style.display = 'none';

    if (!accounting) {
      $('#empty').style.display = 'block';
      document.body.dataset.pageSub = 'Awaiting your landlord';
      return;
    }
    if (!accounting.generated_at) {
      // Draft state — do not show details, only a notice
      $('#content').style.display = 'block';
      $('#content').innerHTML = `
        <div class="dep-card">
          <h2>Move-out & deposit</h2>
          <div class="sub">${esc(app.property_address || '')}${app.city?' · '+esc(app.city):''} · Move-out ${esc(fmtDate(app.move_out_date_actual))}</div>
          <p style="color:var(--muted,#64748b);line-height:1.6;font-size:.95rem">
            Your deposit accounting is being prepared. Once your landlord finalizes the deduction letter,
            it will appear here with your refund details and an option to download the official PDF.
          </p>
        </div>
      `;
      document.body.dataset.pageSub = 'Accounting in progress';
      return;
    }

    const today = todayISO();
    const isLate = accounting.late_generated || (accounting.state_return_deadline && today > accounting.state_return_deadline);
    const refund = Number(accounting.refund_owed_to_tenant || 0);
    const stateCode = (accounting.state_code_snapshot || app.lease_state_code || app.state || '').toUpperCase();

    let html = '';

    // ── Late banner ──
    if (isLate) {
      html += `
        <div class="late-banner">
          <strong>This accounting was generated past your state's statutory deadline.</strong><br>
          ${esc(stateCode || 'Your state')} requires the security deposit accounting to be returned within
          <strong>${accounting.state_return_days_snapshot || '?'} days</strong> of move-out
          (deadline was <strong>${esc(fmtDate(accounting.state_return_deadline))}</strong>).
          You may have additional rights under your state's tenant-protection statute as a result of the late issuance.
          The downloadable letter PDF carries this notice on its cover page.
        </div>
      `;
    }

    // ── Disputed banner ──
    if (accounting.tenant_disputed_at) {
      html += `
        <div class="disputed-banner">
          <strong>Dispute filed ${esc(fmtDate(accounting.tenant_disputed_at))}.</strong><br>
          Your dispute is on file and visible to your landlord and Choice Properties staff. You can update
          your objection text by submitting again below.
        </div>
      `;
    }

    // ── Header card ──
    const tenantName = ((app.first_name||'') + ' ' + (app.last_name||'')).trim() || 'Tenant';
    html += `
      <div class="dep-card">
        <div class="row-flex between">
          <div>
            <h2>Security deposit accounting</h2>
            <div class="sub">${esc(tenantName)} · ${esc(app.property_address || '')}${app.city?' · '+esc(app.city):''}${stateCode?', '+esc(stateCode):''}</div>
          </div>
          <div>
            <span class="pill pill-ok">Letter generated ${esc(fmtDateShort(accounting.generated_at))}</span>
          </div>
        </div>
        <div class="meta-row"><span class="k">Move-in date</span><span class="v">${esc(fmtDate(app.move_in_date_actual))}</span></div>
        <div class="meta-row"><span class="k">Move-out date</span><span class="v">${esc(fmtDate(app.move_out_date_actual))}</span></div>
        <div class="meta-row"><span class="k">State return window</span><span class="v">${accounting.state_return_days_snapshot || '?'} days (${esc(stateCode || '?')})</span></div>
        <div class="meta-row"><span class="k">Statutory deadline</span><span class="v" style="${isLate?'color:#b91c1c':''}">${esc(fmtDate(accounting.state_return_deadline))}</span></div>
        <div class="actions">
          ${accounting.letter_pdf_path ? `<button class="btn btn-primary" id="btnDownload">Download letter PDF</button>` : ''}
          <button class="btn btn-warn" id="btnDispute">${accounting.tenant_disputed_at ? 'Update dispute' : 'Dispute this accounting'}</button>
        </div>
      </div>
    `;

    // ── Deductions ──
    if (deductions.length) {
      html += `
        <div class="dep-card">
          <h2>Itemized deductions</h2>
          <div class="sub">Each deduction below has been withheld from your security deposit.</div>
          <div class="deductions-list">
            ${deductions.map(d => `
              <div class="deduction-row">
                <div style="flex:1;min-width:0">
                  <div class="ded-cat">${esc(CAT_LABEL[d.category] || d.category)}</div>
                  <div class="ded-desc">${esc(d.description || '—')}</div>
                </div>
                <div class="ded-amt">- ${esc(fmtMoney(d.amount))}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="dep-card">
          <h2>Itemized deductions</h2>
          <div class="sub">No deductions were taken — your full deposit is being refunded.</div>
        </div>
      `;
    }

    // ── Totals ──
    html += `
      <div class="dep-card">
        <h2>Totals</h2>
        <div class="totals-section">
          <div class="totals-row"><span>Total security deposit held</span><span class="v">${esc(fmtMoney(accounting.total_deposit_held))}</span></div>
          <div class="totals-row"><span>Itemized deductions</span><span class="v" style="color:#b91c1c">- ${esc(fmtMoney(accounting.amount_withheld))}</span></div>
          <div class="totals-row"><span>Interest accrued</span><span class="v">${esc(fmtMoney(accounting.interest_accrued))}</span></div>
          <div class="totals-row emph"><span>Net refund owed to you</span><span class="v ${refund>0?'refund-pos':'refund-zero'}">${esc(fmtMoney(refund))}</span></div>
        </div>
        ${refund>0?'<div class="small" style="margin-top:14px">Your landlord will issue the refund per your state\'s statute. Contact Choice Properties if you have not received it within a reasonable time.</div>':''}
      </div>
    `;

    $('#content').style.display = 'block';
    $('#content').innerHTML = html;

    // Wire actions
    if ($('#btnDownload')) $('#btnDownload').addEventListener('click', downloadPDF);
    $('#btnDispute').addEventListener('click', openDispute);

    document.body.dataset.pageSub = isLate ? 'Past statutory deadline' :
      (accounting.tenant_disputed_at ? 'Disputed' : 'Accounting available');
  }

  async function downloadPDF(){
    const sb = getSB();
    if (!_state?.accounting?.letter_pdf_path) return;
    try {
      const { data, error } = await sb.storage
        .from(PDF_BUCKET)
        .createSignedUrl(_state.accounting.letter_pdf_path, 600);
      if (error || !data?.signedUrl) throw error || new Error('No signed URL');
      window.open(data.signedUrl, '_blank', 'noopener');
    } catch (e) {
      toast('Could not generate download link: ' + e.message, 'error');
    }
  }

  function openDispute(){
    const ta = $('#disputeText');
    ta.value = _state?.accounting?.tenant_dispute_text || '';
    updateCharCount();
    $('#disputeBg').classList.add('open');
    setTimeout(() => ta.focus(), 50);
  }
  function closeDispute(){
    $('#disputeBg').classList.remove('open');
  }
  function updateCharCount(){
    const v = $('#disputeText').value || '';
    const n = v.length;
    const el = $('#charCount');
    el.textContent = n + ' / 5000';
    el.className = 'char-count' + ((n > 5000 || (n > 0 && n < 10)) ? ' warn' : '');
  }

  async function submitDispute(){
    const text = ($('#disputeText').value || '').trim();
    if (text.length < 10)   { toast('Please enter at least 10 characters', 'error'); return; }
    if (text.length > 5000) { toast('Dispute text must be 5,000 characters or fewer', 'error'); return; }
    const accId = _state?.accounting?.id;
    if (!accId) return;

    const btn = $('#btnSubmitDispute');
    btn.disabled = true; btn.textContent = 'Submitting…';
    try {
      const sb = getSB();
      const { data: sess } = await sb.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) throw new Error('Not signed in');

      const url = CONFIG.SUPABASE_URL + '/functions/v1/submit-deposit-dispute';
      const resp = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body:    JSON.stringify({ accounting_id: accId, dispute_text: text }),
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok || !body.success) throw new Error(body.message || body.error || ('HTTP ' + resp.status));

      toast(body.was_first_dispute ? 'Dispute submitted — landlord notified' : 'Dispute updated', 'ok');
      _state.accounting.tenant_disputed_at  = body.tenant_disputed_at;
      _state.accounting.tenant_dispute_text = text;
      closeDispute();
      render();
    } catch (e) {
      toast('Submit failed: ' + e.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Submit dispute';
    }
  }

  function wire(){
    $('#disputeText').addEventListener('input', updateCharCount);
    $('#btnCancelDispute').addEventListener('click', closeDispute);
    $('#btnSubmitDispute').addEventListener('click', submitDispute);
    $('#disputeBg').addEventListener('click', e => { if (e.target.id === 'disputeBg') closeDispute(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && $('#disputeBg').classList.contains('open')) closeDispute();
    });
  }

  function boot(){
    if (typeof CONFIG === 'undefined' || !window.supabase) { setTimeout(boot, 80); return; }
    wire();
    load();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
