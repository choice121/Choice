// Choice Properties — Tenant lease signing page (Phases 1.5 → 4)
//
// One page handles three signer flows, identified by the URL:
//
//   /lease-sign.html?token=…              → primary tenant OR co-applicant
//                                            (server resolves which via
//                                            lookup_signer_for_token)
//   /lease-sign.html?amendment_token=…    → amendment (addendum) signing
//
// All three flows use the same UI: identity-verification email + typed
// legal name + optional drawn signature pad + agreement checkbox.
// The typed name is the legally binding signature; the canvas drawing
// is an additional verification artifact embedded in the rendered PDF.
(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  const token          = params.get('token');
  const amendmentToken = params.get('amendment_token');

  const SERVER_BASE = typeof CONFIG !== 'undefined' && CONFIG.SUPABASE_URL
    ? CONFIG.SUPABASE_URL + '/functions/v1' : '';
  const ANON_KEY    = typeof CONFIG !== 'undefined' ? (CONFIG.SUPABASE_ANON_KEY || '') : '';

  // ── Mode (set after server response) ────────────────────────────────
  // 'tenant'       → POST /sign-lease
  // 'co_applicant' → POST /sign-lease-co-applicant
  // 'amendment'    → POST /sign-amendment
  let _mode = null;
  let _activeToken = null;
  let _appForLink = null;

  // ── State helpers ───────────────────────────────────────────────────
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
    try { return new Date(d).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }); }
    catch { return d; }
  }

  function buildInfoGrid(app, mode) {
    const items = [
      [mode === 'amendment' ? 'For Tenant' : 'Tenant', `${app.first_name||''} ${app.last_name||''}`],
      ['Property',         app.property_address || '—'],
      ['Lease Start',      fmtDate(app.lease_start_date)],
      ['Lease End',        fmtDate(app.lease_end_date)],
      ['Monthly Rent',     fmtMoney(app.monthly_rent)],
      ['Security Deposit', fmtMoney(app.security_deposit)],
    ];
    return items.map(([label, val]) =>
      `<div class="info-item"><span class="info-label">${label}</span><span class="info-val">${val || '—'}</span></div>`
    ).join('');
  }

  function applySignerMode(mode, signerName) {
    const banner = document.getElementById('signer-banner');
    const titleEl = document.getElementById('form-title');
    const sectionTitle = document.getElementById('sign-section-title');
    const sectionHelp = document.getElementById('sign-section-help');
    const labelEl = document.getElementById('lease-text-label');
    const btnText = document.getElementById('btn-sign-text');
    const successTitle = document.getElementById('success-title');

    banner.style.display = 'flex';
    if (mode === 'co_applicant') {
      banner.className = 'signer-banner coapp';
      banner.innerHTML = `<span class="b-mark">2</span><span>You are signing as the <strong>co-applicant</strong>. The primary applicant has already signed.</span>`;
      sectionTitle.textContent = 'Sign as Co-Applicant';
      sectionHelp.textContent  = 'By signing you become jointly and severally liable for the lease alongside the primary applicant.';
      btnText.textContent      = 'Sign as Co-Applicant';
      successTitle.textContent = 'Co-Applicant Signature Recorded';
    } else if (mode === 'amendment') {
      banner.className = 'signer-banner amend';
      banner.innerHTML = `<span class="b-mark">+</span><span>You are signing a <strong>lease amendment</strong>. Your existing lease remains in effect.</span>`;
      labelEl.textContent      = 'Amendment Document';
      sectionTitle.textContent = 'Sign Amendment';
      sectionHelp.textContent  = 'Type your full legal name to sign this amendment. Your original lease is unaffected.';
      btnText.textContent      = 'Sign Amendment';
      successTitle.textContent = 'Amendment Signed';
    } else {
      banner.className = 'signer-banner tenant';
      banner.innerHTML = `<span class="b-mark">1</span><span>You are signing as the <strong>primary applicant</strong>${signerName ? ` (${signerName})` : ''}.</span>`;
    }
  }

  // ── Loading ─────────────────────────────────────────────────────────
  async function loadLease() {
    if (!token && !amendmentToken) {
      document.getElementById('err-title').textContent = 'No Signing Token';
      document.getElementById('err-message').textContent = 'This page requires a valid signing link from your email.';
      showState('error');
      return;
    }

    _activeToken = token || amendmentToken;
    const isAmendment = !!amendmentToken;
    const url = SERVER_BASE + (isAmendment ? '/get-amendment' : '/get-lease');

    let resp, json;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
        body: JSON.stringify({ token: _activeToken }),
      });
      json = await resp.json();
    } catch {
      document.getElementById('err-title').textContent = 'Connection Error';
      document.getElementById('err-message').textContent = 'Could not connect to the signing server. Please try again.';
      showState('error');
      return;
    }

    if (!resp.ok) {
      document.getElementById('err-title').textContent =
        resp.status === 410 ? 'Already Signed' : 'Link Expired or Invalid';
      document.getElementById('err-message').textContent =
        json.error || 'This signing link is no longer valid.';
      showState('error');
      return;
    }

    const app = json.app;
    _appForLink = app;

    if (isAmendment) {
      _mode = 'amendment';
      applySignerMode('amendment', json.signer?.name);
      document.getElementById('form-prop').textContent  = json.amendment.title || 'Amendment';
      document.getElementById('form-appid').textContent = app.app_id || '—';
      document.getElementById('info-grid').innerHTML    = buildInfoGrid(app, 'amendment');
      document.getElementById('lease-text-body').textContent =
        `${json.amendment.title}\n\n${json.amendment.body}`;
      document.getElementById('rendered-notice').textContent = 'Amendment to your existing lease';
    } else {
      _mode = json.signer?.type || 'tenant';
      applySignerMode(_mode, json.signer?.name);
      document.getElementById('form-prop').textContent  = app.property_address || 'your property';
      document.getElementById('form-appid').textContent = app.app_id || '—';
      document.getElementById('info-grid').innerHTML    = buildInfoGrid(app, _mode);
      const rendered = json.rendered_lease || '';
      document.getElementById('lease-text-body').textContent = rendered || 'Lease template unavailable. Please contact Choice Properties.';
      if (rendered) document.getElementById('rendered-notice').textContent = 'Scroll to review full lease';
    }

    showState('form');
  }

  // ── Canvas signature pad ────────────────────────────────────────────
  // Pure-DOM minimal pad. Captures pointer/touch events and exports a
  // PNG data-URL trimmed to the actual ink bounding box.
  const canvas = document.getElementById('sig-canvas');
  const ctx = canvas.getContext('2d');
  let _drawing = false, _hasInk = false;
  let _lastX = 0, _lastY = 0;

  function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e293b';
  }

  function evtPos(e) {
    const rect = canvas.getBoundingClientRect();
    const t = (e.touches && e.touches[0]) || e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  }

  function startDraw(e) {
    e.preventDefault();
    _drawing = true;
    const p = evtPos(e); _lastX = p.x; _lastY = p.y;
  }
  function moveDraw(e) {
    if (!_drawing) return;
    e.preventDefault();
    const p = evtPos(e);
    ctx.beginPath();
    ctx.moveTo(_lastX, _lastY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    _lastX = p.x; _lastY = p.y;
    if (!_hasInk) {
      _hasInk = true;
      canvas.classList.add('filled');
    }
  }
  function endDraw(e) { e && e.preventDefault && e.preventDefault(); _drawing = false; }

  function clearPad() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    _hasInk = false;
    canvas.classList.remove('filled');
  }

  function getSignaturePngDataUrl() {
    if (!_hasInk) return null;
    // pdf-lib accepts the data URL directly via our decodeDataUrl helper
    return canvas.toDataURL('image/png');
  }

  canvas.addEventListener('pointerdown', startDraw);
  canvas.addEventListener('pointermove', moveDraw);
  canvas.addEventListener('pointerup', endDraw);
  canvas.addEventListener('pointercancel', endDraw);
  canvas.addEventListener('pointerleave', endDraw);
  // Fallback for non-pointer browsers
  canvas.addEventListener('touchstart',  startDraw, { passive: false });
  canvas.addEventListener('touchmove',   moveDraw,  { passive: false });
  canvas.addEventListener('touchend',    endDraw);
  document.getElementById('pad-clear').addEventListener('click', clearPad);
  window.addEventListener('resize', resizeCanvas);
  // Initial sizing — must run after layout
  setTimeout(resizeCanvas, 60);

  // ── Form state ──────────────────────────────────────────────────────
  const sigInput   = document.getElementById('sig-input');
  const emailInput = document.getElementById('signer-email');
  const sigPreview = document.getElementById('sig-preview');
  const agreeCheck = document.getElementById('agree-check');
  const btnSign    = document.getElementById('btn-sign');

  function updateSignBtn() {
    const hasSig   = sigInput.value.trim().length >= 5;
    const hasEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim());
    const hasAgree = agreeCheck.checked;
    btnSign.disabled = !(hasSig && hasEmail && hasAgree);
  }

  sigInput.addEventListener('input', () => {
    const val = sigInput.value.trim();
    if (val) { sigPreview.textContent = val; sigPreview.classList.add('filled'); }
    else { sigPreview.textContent = 'Your signature will appear here'; sigPreview.classList.remove('filled'); }
    updateSignBtn();
  });
  emailInput.addEventListener('input', updateSignBtn);
  agreeCheck.addEventListener('change', updateSignBtn);

  btnSign.addEventListener('click', submitSignature);

  async function submitSignature() {
    const signature = sigInput.value.trim();
    if (!signature || !_mode || !_activeToken) return;

    btnSign.disabled = true;
    document.getElementById('btn-sign-text').textContent = 'Submitting…';
    document.getElementById('sign-error').style.display = 'none';

    const endpoint = _mode === 'co_applicant' ? '/sign-lease-co-applicant'
                   : _mode === 'amendment'    ? '/sign-amendment'
                   : '/sign-lease';

    const body = {
      token:           _activeToken,
      signature,
      signature_image: getSignaturePngDataUrl(),
      applicant_email: emailInput.value.trim(),
      user_agent:      navigator.userAgent,
    };

    let resp, json;
    try {
      resp = await fetch(SERVER_BASE + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
        body: JSON.stringify(body),
      });
      json = await resp.json();
    } catch {
      document.getElementById('sign-error').textContent = 'Connection error. Please try again.';
      document.getElementById('sign-error').style.display = 'block';
      btnSign.disabled = false;
      document.getElementById('btn-sign-text').textContent = 'Sign';
      return;
    }

    if (!resp.ok || !json.success) {
      document.getElementById('sign-error').textContent =
        json.error || 'Signing failed. Please try again or contact support.';
      document.getElementById('sign-error').style.display = 'block';
      btnSign.disabled = false;
      const fallback = _mode === 'co_applicant' ? 'Sign as Co-Applicant'
                     : _mode === 'amendment'    ? 'Sign Amendment'
                     : 'Sign Lease Agreement';
      document.getElementById('btn-sign-text').textContent = fallback;
      return;
    }

    if (_appForLink && _appForLink.app_id) {
      const portalBtn = document.getElementById('portal-link-btn');
      if (portalBtn) portalBtn.href = '/tenant/login.html?app_id=' + encodeURIComponent(_appForLink.app_id);
    }
    showState('success');
  }

  // ── Boot ────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadLease);
  } else {
    let tries = 0;
    (function tryLoad() {
      if (typeof CONFIG !== 'undefined') { loadLease(); return; }
      if (++tries < 30) { setTimeout(tryLoad, 100); return; }
      loadLease();
    })();
  }
})();
