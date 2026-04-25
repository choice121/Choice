// Tenant lease signing page — extracted from lease-sign.html (Phase 1).
//
// Behaviour is identical to the previous inline script: hydrate the page from
// the get-lease edge function, render the lease text + info grid, manage the
// signature/email/agree-checkbox state machine, then POST to sign-lease and
// flip to the success state. The only intentional change is that the legacy
// hardcoded CSP nonce attribute is gone — this file is loaded as an external
// `<script defer>` and is allowed by the script-src 'self' directive.
(function () {
  const params = new URLSearchParams(location.search);
  const token = params.get('token');

  const SERVER_BASE = typeof CONFIG !== 'undefined' && CONFIG.SUPABASE_URL
    ? CONFIG.SUPABASE_URL + '/functions/v1'
    : '';
  const ANON_KEY = typeof CONFIG !== 'undefined' ? (CONFIG.SUPABASE_ANON_KEY || '') : '';

  function showState(state) {
    ['loading', 'error', 'success', 'form'].forEach(s => {
      const el = document.getElementById('state-' + s);
      if (el) el.style.display = (s === state ? '' : 'none');
    });
  }

  function fmtMoney(v) {
    if (v == null || v === '') return '—';
    return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 });
  }
  function fmtDate(d) {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return d; }
  }

  // Kept for reference — the server already returns `rendered_lease` with
  // variables substituted. This local copy is only used as a fallback if a
  // future template carries unsubstituted vars.
  function substituteVars(template, app) {
    const vars = {
      tenant_full_name:    (app.first_name || '') + ' ' + (app.last_name || ''),
      tenant_email:        app.email || '',
      tenant_phone:        app.phone || '',
      property_address:    app.property_address || '',
      lease_start_date:    fmtDate(app.lease_start_date),
      lease_end_date:      fmtDate(app.lease_end_date),
      monthly_rent:        fmtMoney(app.monthly_rent),
      security_deposit:    fmtMoney(app.security_deposit),
      move_in_costs:       fmtMoney(app.move_in_costs),
      landlord_name:       app.lease_landlord_name    || 'Choice Properties',
      landlord_address:    app.lease_landlord_address || '2265 Livernois Suite 500, Troy MI 48083',
      late_fee_flat:       app.lease_late_fee_flat    ? fmtMoney(app.lease_late_fee_flat) : '',
      late_fee_daily:      app.lease_late_fee_daily   ? fmtMoney(app.lease_late_fee_daily) : '',
      state_code:          app.lease_state_code       || 'MI',
      pets_policy:         app.lease_pets_policy      || 'No pets allowed.',
      smoking_policy:      app.lease_smoking_policy   || 'No smoking permitted on premises.',
      desired_lease_term:  app.desired_lease_term     || '',
      app_id:              app.app_id || '',
      signature_date:      '',
      tenant_signature:    '',
    };
    return template.replace(/\{\{(\w+)\}\}/g, (m, k) => vars[k] !== undefined ? vars[k] : '');
  }

  function buildInfoGrid(app) {
    const items = [
      ['Tenant', (app.first_name || '') + ' ' + (app.last_name || '')],
      ['Property', app.property_address || '—'],
      ['Lease Start', fmtDate(app.lease_start_date)],
      ['Lease End', fmtDate(app.lease_end_date)],
      ['Monthly Rent', fmtMoney(app.monthly_rent)],
      ['Security Deposit', fmtMoney(app.security_deposit)],
      ['Move-In Costs', fmtMoney(app.move_in_costs)],
    ];
    return items.map(([label, val]) =>
      '<div class="info-item"><span class="info-label">' + label + '</span><span class="info-val">' + (val || '—') + '</span></div>'
    ).join('');
  }

  async function loadLease() {
    if (!token) {
      document.getElementById('err-title').textContent = 'No Signing Token';
      document.getElementById('err-message').textContent = 'This page requires a valid signing link. Please check your email for the correct link.';
      showState('error');
      return;
    }

    const url = SERVER_BASE + '/get-lease';
    let resp, json;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
        body: JSON.stringify({ token }),
      });
      json = await resp.json();
    } catch (e) {
      document.getElementById('err-title').textContent = 'Connection Error';
      document.getElementById('err-message').textContent = 'Could not connect to the signing server. Please try again.';
      showState('error');
      return;
    }

    if (!resp.ok) {
      document.getElementById('err-title').textContent = resp.status === 410 ? 'Already Signed' : 'Link Expired or Invalid';
      document.getElementById('err-message').textContent = json.error || 'This signing link is no longer valid.';
      showState('error');
      return;
    }

    const { app, rendered_lease } = json;
    window._leaseApp = app;
    window._leaseToken = token;

    document.getElementById('form-prop').textContent = app.property_address || 'your property';
    document.getElementById('form-appid').textContent = app.app_id || '—';
    document.getElementById('info-grid').innerHTML = buildInfoGrid(app);

    if (rendered_lease) {
      document.getElementById('lease-text-body').textContent = rendered_lease;
      document.getElementById('rendered-notice').textContent = 'Scroll to review full lease';
    } else {
      document.getElementById('lease-text-body').textContent = 'Lease template unavailable. Please contact Choice Properties.';
    }

    showState('form');
  }

  // Signature preview + validation
  const sigInput   = document.getElementById('sig-input');
  const emailInput = document.getElementById('signer-email');
  const sigPreview = document.getElementById('sig-preview');
  const agreeCheck = document.getElementById('agree-check');
  const btnSign    = document.getElementById('btn-sign');

  function updateSignBtn() {
    const hasSig   = sigInput.value.trim().length >= 5; // Phase 3 — min 5 chars
    const hasEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim());
    const hasAgree = agreeCheck.checked;
    btnSign.disabled = !(hasSig && hasEmail && hasAgree);
  }

  sigInput.addEventListener('input', () => {
    const val = sigInput.value.trim();
    if (val) {
      sigPreview.textContent = val;
      sigPreview.classList.add('filled');
    } else {
      sigPreview.textContent = 'Your signature will appear here';
      sigPreview.classList.remove('filled');
    }
    updateSignBtn();
  });
  emailInput.addEventListener('input', updateSignBtn);
  agreeCheck.addEventListener('change', updateSignBtn);

  // CSP-safe: bind click handler instead of inline onclick
  btnSign.addEventListener('click', submitSignature);

  async function submitSignature() {
    const signature = sigInput.value.trim();
    if (!signature) return;

    btnSign.disabled = true;
    document.getElementById('btn-sign-text').textContent = 'Submitting…';
    document.getElementById('sign-error').style.display = 'none';

    const url = SERVER_BASE + '/sign-lease';
    let resp, json;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
        body: JSON.stringify({
          token:           window._leaseToken,
          signature,
          applicant_email: emailInput.value.trim(), // Phase 3
          user_agent:      navigator.userAgent,
        }),
      });
      json = await resp.json();
    } catch (e) {
      document.getElementById('sign-error').textContent = 'Connection error. Please try again.';
      document.getElementById('sign-error').style.display = 'block';
      btnSign.disabled = false;
      document.getElementById('btn-sign-text').textContent = 'Sign Lease Agreement';
      return;
    }

    if (!resp.ok || !json.success) {
      document.getElementById('sign-error').textContent = json.error || 'Signing failed. Please try again or contact support.';
      document.getElementById('sign-error').style.display = 'block';
      btnSign.disabled = false;
      document.getElementById('btn-sign-text').textContent = 'Sign Lease Agreement';
      return;
    }

    const appForLink = window._leaseApp;
    if (appForLink && appForLink.app_id) {
      const portalBtn = document.getElementById('portal-link-btn');
      if (portalBtn) portalBtn.href = '/tenant/login.html?app_id=' + encodeURIComponent(appForLink.app_id);
    }
    showState('success');
  }

  // Load on DOMContentLoaded — config.js is deferred and may not be ready
  // when this module first parses, so poll briefly then proceed anyway.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadLease);
  } else {
    let tries = 0;
    function tryLoad() {
      if (typeof CONFIG !== 'undefined') { loadLease(); return; }
      if (++tries < 30) { setTimeout(tryLoad, 100); return; }
      loadLease(); // proceed anyway after 3 seconds
    }
    tryLoad();
  }
})();
