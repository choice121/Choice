// Choice Properties — Admin: lease template editor
//
// Edits the active row in lease_templates and publishes immutable
// snapshots into lease_template_versions via publish_lease_template().
// Surfaces the full version history so admins can see exactly what
// each pinned-by-application snapshot contains.
(function () {
  'use strict';

  function readyDeps() { return window.AdminShell && window.CP && CP.Auth; }
  function waitReady(ms) {
    return new Promise((res, rej) => {
      const start = Date.now();
      (function tick() {
        if (readyDeps()) return res();
        if (Date.now() - start > ms) return rej(new Error('Admin tools failed to load.'));
        setTimeout(tick, 80);
      })();
    });
  }

  let S;
  let _activeId = null;     // id of the lease_templates row we're editing
  let _versions = [];

  const VARIABLES = [
    ['tenant_full_name',    'Primary applicant full name'],
    ['tenant_email',        'Primary applicant email'],
    ['tenant_phone',        'Primary applicant phone'],
    ['property_address',    'Property street address'],
    ['lease_start_date',    'Lease start date (formatted)'],
    ['lease_end_date',      'Lease end date (formatted)'],
    ['monthly_rent',        'Monthly rent (formatted)'],
    ['security_deposit',    'Security deposit (formatted)'],
    ['move_in_costs',       'Total due at move-in (formatted)'],
    ['landlord_name',       'Landlord legal name'],
    ['landlord_address',    'Landlord mailing address'],
    ['late_fee_flat',       'Late fee — flat (formatted)'],
    ['late_fee_daily',      'Late fee — daily (formatted)'],
    ['state_code',          'State code (2-letter)'],
    ['pets_policy',         'Pets policy clause'],
    ['smoking_policy',      'Smoking policy clause'],
    ['desired_lease_term',  'Desired lease term (text)'],
    ['app_id',              'Application ID'],
    ['signature_date',      'Tenant signature date (formatted)'],
    ['tenant_signature',    'Tenant typed signature'],
    ['co_applicant_signature', 'Co-applicant typed signature'],
  ];

  function fmtDateTime(s) {
    if (!s) return '—';
    try { return new Date(s).toLocaleString('en-US', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }); }
    catch { return s; }
  }

  function renderVarList() {
    const html = VARIABLES.map(([k, label]) =>
      `<div style="margin-bottom:8px">
         <span class="var-pill" data-var="${k}">{{${k}}}</span>
         <span class="text-xs muted" style="margin-left:6px">${S.esc(label)}</span>
       </div>`
    ).join('');
    document.getElementById('var-list').innerHTML = html;
    document.getElementById('var-list').addEventListener('click', e => {
      const pill = e.target.closest('.var-pill');
      if (!pill) return;
      const tok = '{{' + pill.dataset.var + '}}';
      const ta = document.getElementById('tpl-body');
      const start = ta.selectionStart, end = ta.selectionEnd;
      ta.value = ta.value.slice(0, start) + tok + ta.value.slice(end);
      ta.focus();
      ta.setSelectionRange(start + tok.length, start + tok.length);
    });
  }

  function renderVersions() {
    const el = document.getElementById('ver-list');
    document.getElementById('ver-count').textContent =
      _versions.length + ' version' + (_versions.length !== 1 ? 's' : '');
    if (!_versions.length) {
      el.innerHTML = '<div style="padding:14px;text-align:center" class="text-sm muted">No versions yet. Click <strong>Save &amp; Publish</strong> to create v1.</div>';
      return;
    }
    el.innerHTML = _versions.map(v =>
      `<div class="ver-row">
         <div style="flex:1;min-width:0">
           <span class="ver-num">v${v.version_number}</span>
           <span class="text-xs muted" style="margin-left:6px">${S.esc(fmtDateTime(v.published_at))}</span>
           ${v.published_by ? `<span class="text-xs muted" style="margin-left:6px">by ${S.esc(v.published_by)}</span>` : ''}
           ${v.notes ? `<div class="text-xs" style="margin-top:3px;color:var(--text)">${S.esc(v.notes)}</div>` : ''}
         </div>
         <div>
           <button class="btn btn-ghost btn-sm" data-action="load-version" data-id="${S.esc(v.id)}">Load</button>
         </div>
       </div>`
    ).join('');
  }

  async function loadTemplate() {
    const sb = CP.sb();
    // Pick the active editable template row (or the most recent one)
    const { data: tmpl, error } = await sb.from('lease_templates')
      .select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (error) { S.toast('Could not load template: ' + error.message, 'error'); return; }

    if (!tmpl) {
      // No template at all — present an empty editor so the admin can create v1
      _activeId = null;
      document.getElementById('tpl-name').value = 'Standard Residential Lease';
      document.getElementById('tpl-state').value = 'MI';
      document.getElementById('tpl-body').value = '';
      document.getElementById('tpl-notes').value = '';
    } else {
      _activeId = tmpl.id;
      document.getElementById('tpl-name').value = tmpl.name || '';
      document.getElementById('tpl-state').value = tmpl.variables?.state_code || 'MI';
      document.getElementById('tpl-body').value = tmpl.template_body || '';
      document.getElementById('tpl-notes').value = '';
    }

    // Load versions for this template id (if any)
    if (_activeId) {
      const { data: vers } = await sb.from('lease_template_versions')
        .select('id, version_number, name, published_by, published_at, notes')
        .eq('template_id', _activeId)
        .order('version_number', { ascending: false });
      _versions = vers || [];
    } else {
      _versions = [];
    }
    renderVersions();
  }

  async function loadVersion(versionId) {
    const sb = CP.sb();
    const { data: v, error } = await sb.from('lease_template_versions')
      .select('*').eq('id', versionId).single();
    if (error || !v) { S.toast('Could not load version', 'error'); return; }
    document.getElementById('tpl-name').value = v.name || '';
    document.getElementById('tpl-body').value = v.template_body || '';
    document.getElementById('tpl-notes').value = v.notes || '';
    S.toast(`Loaded v${v.version_number} into editor (not yet saved).`);
  }

  async function publish() {
    const name = document.getElementById('tpl-name').value.trim();
    const body = document.getElementById('tpl-body').value;
    const stateCode = document.getElementById('tpl-state').value.trim().toUpperCase() || 'MI';
    const notes = document.getElementById('tpl-notes').value.trim();

    if (!name) { S.toast('Template name is required', 'error'); return; }
    if (!body || body.length < 100) { S.toast('Template body looks too short. Are you sure?', 'error'); return; }

    const ok = await S.confirm({
      title: 'Publish new template version?',
      message: 'A new immutable version will be created. Applications generated AFTER this point will use it. Existing applications keep their pinned snapshot.',
      ok: 'Publish version',
    });
    if (!ok) return;

    const sb = CP.sb();
    const session = await CP.Auth.getSession();
    if (!session?.access_token) { S.toast('Session expired. Please sign in again.', 'error'); return; }

    const { data, error } = await sb.rpc('publish_lease_template', {
      p_template_id:   _activeId,
      p_name:          name,
      p_template_body: body,
      p_variables:     { state_code: stateCode },
      p_notes:         notes || null,
      p_make_active:   true,
    });
    if (error) { S.toast('Publish failed: ' + error.message, 'error'); return; }
    if (!data?.success) { S.toast('Publish failed: ' + (data?.error || 'unknown'), 'error'); return; }

    _activeId = data.template_id;
    document.getElementById('tpl-notes').value = '';
    S.toast(`Published v${data.version_number}.`, 'success');
    await loadTemplate();
  }

  async function previewPDF() {
    // Find the most recent application with a lease to preview against,
    // else preview against a synthetic dummy app via dry-run.
    const sb = CP.sb();
    const { data: cand } = await sb.from('applications')
      .select('app_id').not('lease_pdf_url','is', null).order('updated_at', { ascending:false }).limit(1);
    const targetAppId = cand?.[0]?.app_id;
    if (!targetAppId) { S.toast('No applications with leases yet — generate one first to preview.', 'error'); return; }

    S.toast('Generating preview…');
    // We pass the live editor body via a one-off publish-then-dry-run? No —
    // instead, save current draft to lease_templates without publishing a
    // version, then dry-run. But snapshots are immutable, so the safest UX
    // is: publish a draft version, then dry-run, then leave it. Simpler:
    // call generate-lease in dry_run mode against this app — it picks up
    // the current active template. The admin should hit "Save & Publish"
    // first if they want preview to reflect editor changes.
    const res = await S.callFn('/generate-lease', { app_id: targetAppId, dry_run: true });
    if (!res) return;
    if (!res.ok || !res.json.preview_url) { S.toast(res.json.error || 'Preview failed', 'error'); return; }
    window.open(res.json.preview_url, '_blank');
    S.toast('Preview opened. Note: preview reflects the saved active template, not unsaved editor changes.');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    try { await waitReady(8000); }
    catch (e) {
      const main = document.querySelector('main');
      if (main) main.innerHTML = '<div class="empty"><h3>Could not load admin tools</h3><p>'+e.message+'</p></div>';
      return;
    }
    S = window.AdminShell;

    document.getElementById('btn-publish').addEventListener('click', publish);
    document.getElementById('btn-preview').addEventListener('click', previewPDF);
    document.addEventListener('click', e => {
      const t = e.target.closest('[data-action="load-version"]');
      if (t) loadVersion(t.dataset.id);
    });

    renderVarList();

    const okAuth = await S.requireAdmin();
    if (!okAuth) return;
    await loadTemplate();
  });
})();
