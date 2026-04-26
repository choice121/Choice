// Choice Properties - Tenant lease signing page (Phases 1.5 -> 4)
  //
  // One page handles three signer flows, identified by the URL:
  //
  //   /lease-sign.html?token=...              -> primary tenant OR co-applicant
  //                                             (server resolves which via
  //                                             lookup_signer_for_token)
  //   /lease-sign.html?amendment_token=...    -> amendment (addendum) signing
  //
  // All three flows use the same UI: identity-verification email + typed
  // legal name + optional drawn signature pad + agreement checkbox.
  // The typed name is the legally binding signature; the canvas drawing
  // is an additional verification artifact embedded in the rendered PDF.
  //
  // Phase 04 - if the server returns 'addenda', each one is rendered as
  // an expandable card with its own "I have read and agree" checkbox.
  // The Sign button stays disabled until ALL addenda are acknowledged
  // (in addition to the existing email/signature/main-agree checks).
  (function () {
    'use strict';

    // HTML-escape helper (local to this IIFE, mirrors js/tenant/portal.js:37
    // pattern so we don't depend on cp-ui.js being loaded). Used to harden
    // every interpolation that flows into innerHTML below.
    function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);}

    const params = new URLSearchParams(location.search);
    const token          = params.get('token');
    const amendmentToken = params.get('amendment_token');

    const SERVER_BASE = typeof CONFIG !== 'undefined' && CONFIG.SUPABASE_URL
      ? CONFIG.SUPABASE_URL + '/functions/v1' : '';
    const ANON_KEY    = typeof CONFIG !== 'undefined' ? (CONFIG.SUPABASE_ANON_KEY || '') : '';

    // ----- Mode (set after server response) -----
    // 'tenant'       -> POST /sign-lease
    // 'co_applicant' -> POST /sign-lease-co-applicant
    // 'amendment'    -> POST /sign-amendment
    let _mode = null;
    let _activeToken = null;
    let _appForLink = null;

    // Phase 04 - per-addendum ack state. Set of slugs that have been checked.
    let _addendaSlugs = [];
    const _addendaAcked = new Set();

    // Phase 05 - E-SIGN consent state. Cached so we know whether to show the
    // consent panel before revealing the lease body / sign section.
    let _consentRequired       = false;
    let _disclosureVersion     = null;
    let _signerEmailFromServer = '';

    // ----- State helpers -----
    function showState(state) {
      ['loading', 'error', 'success', 'form'].forEach(s => {
        const el = document.getElementById('state-' + s);
        if (el) el.style.display = (s === state ? '' : 'none');
      });
    }
    function fmtMoney(v) {
      if (v == null || v === '') return '\u2014';
      return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 });
    }
    function fmtDate(d) {
      if (!d) return '\u2014';
      try { return new Date(d).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }); }
      catch { return d; }
    }

    function buildInfoGrid(app, mode) {
      const items = [
        [mode === 'amendment' ? 'For Tenant' : 'Tenant', `${app.first_name||''} ${app.last_name||''}`],
        ['Property',         app.property_address || '\u2014'],
        ['Lease Start',      fmtDate(app.lease_start_date)],
        ['Lease End',        fmtDate(app.lease_end_date)],
        ['Monthly Rent',     fmtMoney(app.monthly_rent)],
        ['Security Deposit', fmtMoney(app.security_deposit)],
      ];
      return items.map(([label, val]) =>
        `<div class="info-item"><span class="info-label">${esc(label)}</span><span class="info-val">${esc(val || '\u2014')}</span></div>`
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
        banner.innerHTML = `<span class="b-mark">1</span><span>You are signing as the <strong>primary applicant</strong>${signerName ? ` (${esc(signerName)})` : ''}.</span>`;
      }
    }

    // ----- Phase 04: addenda renderer -----
    function pillClassForJurisdiction(j) {
      const x = String(j || '').toLowerCase();
      if (x === 'federal' || x === 'common') return 'addendum-jurisdiction-pill ' + x;
      return 'addendum-jurisdiction-pill';
    }
    function jurisdictionLabel(j) {
      const x = String(j || '').toLowerCase();
      if (x === 'federal') return 'Federal';
      if (x === 'common')  return 'All States';
      return String(j || '').toUpperCase();
    }

    function updateAddendaCounter() {
      const total = _addendaSlugs.length;
      const done  = _addendaAcked.size;
      const el = document.getElementById('addenda-counter');
      if (!el) return;
      if (total === 0) { el.textContent = ''; return; }
      if (done === total) {
        el.innerHTML = '<strong>\u2713 All ' + total + ' addenda acknowledged</strong>';
      } else {
        el.innerHTML = done + ' of ' + total + ' addenda acknowledged';
      }
    }

    function renderAddenda(list) {
      const section = document.getElementById('addenda-section');
      const listEl  = document.getElementById('addenda-list');
      if (!section || !listEl) return;

      _addendaSlugs = (list || []).map(a => a.slug);
      _addendaAcked.clear();

      if (!list || list.length === 0) {
        section.style.display = 'none';
        updateSignBtn();
        return;
      }

      section.style.display = '';
      listEl.innerHTML = list.map((a, i) => {
        const ackId = 'ack-' + i;
        const bodyId = 'addbody-' + i;
        return `
          <div class="addendum-card" data-slug="${esc(a.slug)}">
            <div class="addendum-head" data-toggle="${bodyId}">
              <span class="${pillClassForJurisdiction(a.jurisdiction)}">${esc(jurisdictionLabel(a.jurisdiction))}</span>
              <div class="addendum-titlebox">
                <div class="a-title">${esc(a.title)}</div>
                <div class="a-citation">Authority: ${esc(a.citation || '\u2014')}</div>
              </div>
              <button type="button" class="addendum-toggle" data-toggle="${bodyId}">Read</button>
            </div>
            <div class="addendum-body" id="${bodyId}">${esc(a.body || '')}</div>
            <label class="addendum-ack" for="${ackId}">
              <input type="checkbox" id="${ackId}" data-slug="${esc(a.slug)}">
              <span>I have read and agree to this addendum (<em>${esc(a.title)}</em>).</span>
            </label>
          </div>`;
      }).join('');

      // Wire up toggles (head click + Read button click both expand body)
      listEl.querySelectorAll('[data-toggle]').forEach(el => {
        el.addEventListener('click', (ev) => {
          // Don't toggle when clicking the ack checkbox
          if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.closest('.addendum-ack'))) return;
          const id = el.getAttribute('data-toggle');
          const body = document.getElementById(id);
          if (body) {
            body.classList.toggle('expanded');
            const toggleBtn = el.tagName === 'BUTTON' ? el : el.querySelector('.addendum-toggle');
            if (toggleBtn) toggleBtn.textContent = body.classList.contains('expanded') ? 'Hide' : 'Read';
          }
        });
      });

      // Wire up ack checkboxes
      listEl.querySelectorAll('input[type="checkbox"][data-slug]').forEach(cb => {
        cb.addEventListener('change', () => {
          const slug = cb.getAttribute('data-slug');
          if (cb.checked) _addendaAcked.add(slug);
          else _addendaAcked.delete(slug);
          const card = cb.closest('.addendum-card');
          if (card) card.classList.toggle('acked', cb.checked);
          updateAddendaCounter();
          updateSignBtn();
        });
      });

      updateAddendaCounter();
      updateSignBtn();
    }

    // ----- Phase 05: E-SIGN consent panel -----
    function renderConsentPanel(disclosure, signerEmail) {
      // Populate disclosure text
      const introEl    = document.getElementById('consent-intro');
      const hwEl       = document.getElementById('ack-hardware-body');
      const paperEl    = document.getElementById('ack-paper-body');
      const wdEl       = document.getElementById('ack-withdrawal-body');
      const procEl     = document.getElementById('consent-procedures');

      if (introEl) introEl.textContent  = disclosure.intro || '';
      if (hwEl)    hwEl.textContent     = disclosure.hardware_software || '';
      if (paperEl) paperEl.textContent  = disclosure.paper_copy_right || '';
      if (wdEl)    wdEl.textContent     = disclosure.withdrawal_right || '';
      if (procEl) {
        procEl.innerHTML =
          '<strong>How to request a paper copy:</strong> ' + esc(disclosure.paper_copy_procedure || '') +
          '<br><strong>How to withdraw consent:</strong> ' + esc(disclosure.withdrawal_procedure || '') +
          '<br><strong>Contact:</strong> ' + esc(disclosure.contact_email || '') + ' &middot; ' + esc(disclosure.contact_phone || '');
      }

      // Pre-fill the signer email if we have it
      const emailInputC = document.getElementById('consent-email');
      if (emailInputC && signerEmail) emailInputC.value = signerEmail;

      // Show/hide sections
      document.getElementById('consent-section').style.display = '';
      document.querySelector('.lease-text-wrap').style.display = 'none';
      const addSec = document.getElementById('addenda-section');
      if (addSec) addSec.style.display = 'none';
      document.querySelector('.sign-section').style.display = 'none';

      // Wire up checkboxes -> button enable
      const ackIds  = ['ack-hardware', 'ack-paper', 'ack-withdrawal'];
      const btnC    = document.getElementById('btn-consent');
      const updateConsentBtn = () => {
        const allAcked = ackIds.every(id => document.getElementById(id).checked);
        const emailVal = (emailInputC?.value || '').trim();
        const hasEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal);
        btnC.disabled = !(allAcked && hasEmail);
      };
      ackIds.forEach(id => {
        const cb = document.getElementById(id);
        cb.addEventListener('change', () => {
          cb.closest('.consent-ack').classList.toggle('checked', cb.checked);
          updateConsentBtn();
        });
      });
      if (emailInputC) emailInputC.addEventListener('input', updateConsentBtn);
      updateConsentBtn();

      // Wire up the consent submit button
      btnC.addEventListener('click', submitConsent);
    }

    async function submitConsent() {
      const btnC      = document.getElementById('btn-consent');
      const errEl     = document.getElementById('consent-error');
      const emailEl   = document.getElementById('consent-email');
      const txtEl     = document.getElementById('btn-consent-text');
      if (!btnC || !errEl || !emailEl) return;

      btnC.disabled = true;
      txtEl.textContent = 'Submitting\u2026';
      errEl.style.display = 'none';

      const body = {
        token:                          _activeToken,
        signer_email:                   emailEl.value.trim(),
        hardware_software_acknowledged: document.getElementById('ack-hardware').checked,
        paper_copy_right_acknowledged:  document.getElementById('ack-paper').checked,
        withdrawal_right_acknowledged:  document.getElementById('ack-withdrawal').checked,
        user_agent:                     navigator.userAgent,
        disclosure_version:             _disclosureVersion,
      };

      let resp, json;
      try {
        resp = await fetch(SERVER_BASE + '/record-esign-consent', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
          body:    JSON.stringify(body),
        });
        json = await resp.json();
      } catch {
        errEl.textContent = 'Connection error. Please try again.';
        errEl.style.display = 'block';
        btnC.disabled = false;
        txtEl.textContent = 'I Consent \u2014 Continue to the Document';
        return;
      }

      if (!resp.ok || !json.success) {
        errEl.textContent = json.error || 'Consent could not be recorded. Please try again.';
        errEl.style.display = 'block';
        btnC.disabled = false;
        txtEl.textContent = 'I Consent \u2014 Continue to the Document';
        return;
      }

      // Success: hide consent panel, reveal lease body / addenda / sign section,
      // and pre-fill the signer-email field on the sign section so the user
      // does not have to type it twice.
      _consentRequired = false;
      document.getElementById('consent-section').style.display = 'none';
      document.querySelector('.lease-text-wrap').style.display = '';
      const addSec = document.getElementById('addenda-section');
      if (addSec && _addendaSlugs.length) addSec.style.display = '';
      document.querySelector('.sign-section').style.display = '';
      const emailInput2 = document.getElementById('signer-email');
      if (emailInput2 && !emailInput2.value) emailInput2.value = body.signer_email;
      updateSignBtn();
    }

    // ----- Loading -----
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

      // Phase 05 - cache consent state from server
      _consentRequired       = !!json.consent_required;
      _disclosureVersion     = json.esign_disclosure_version || null;
      _signerEmailFromServer = (json.signer && json.signer.email) || (app && app.email) || '';

      if (isAmendment) {
        _mode = 'amendment';
        applySignerMode('amendment', json.signer?.name);
        document.getElementById('form-prop').textContent  = json.amendment.title || 'Amendment';
        document.getElementById('form-appid').textContent = app.app_id || '\u2014';
        document.getElementById('info-grid').innerHTML    = buildInfoGrid(app, 'amendment');
        document.getElementById('lease-text-body').textContent =
          `${json.amendment.title}\n\n${json.amendment.body}`;
        document.getElementById('rendered-notice').textContent = 'Amendment to your existing lease';
        // Amendments don't use the lease-level addenda list
        renderAddenda([]);
      } else {
        _mode = json.signer?.type || 'tenant';
        applySignerMode(_mode, json.signer?.name);
        document.getElementById('form-prop').textContent  = app.property_address || 'your property';
        document.getElementById('form-appid').textContent = app.app_id || '\u2014';
        document.getElementById('info-grid').innerHTML    = buildInfoGrid(app, _mode);
        const rendered = json.rendered_lease || '';
        document.getElementById('lease-text-body').textContent = rendered || 'Lease template unavailable. Please contact Choice Properties.';
        if (rendered) document.getElementById('rendered-notice').textContent = 'Scroll to review full lease';
        // Phase 04 - addenda
        renderAddenda(json.addenda || []);
      }

      // Phase 05 - if E-SIGN consent is needed for this signer, gate the
      // entire lease body + sign section behind the disclosure step.
      if (_consentRequired && json.esign_disclosure) {
        renderConsentPanel(json.esign_disclosure, _signerEmailFromServer);
      }

      showState('form');
    }

    // ----- Canvas signature pad -----
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
      return canvas.toDataURL('image/png');
    }

    canvas.addEventListener('pointerdown', startDraw);
    canvas.addEventListener('pointermove', moveDraw);
    canvas.addEventListener('pointerup', endDraw);
    canvas.addEventListener('pointercancel', endDraw);
    canvas.addEventListener('pointerleave', endDraw);
    canvas.addEventListener('touchstart',  startDraw, { passive: false });
    canvas.addEventListener('touchmove',   moveDraw,  { passive: false });
    canvas.addEventListener('touchend',    endDraw);
    document.getElementById('pad-clear').addEventListener('click', clearPad);
    window.addEventListener('resize', resizeCanvas);
    setTimeout(resizeCanvas, 60);

    // ----- Form state -----
    const sigInput   = document.getElementById('sig-input');
    const emailInput = document.getElementById('signer-email');
    const sigPreview = document.getElementById('sig-preview');
    const agreeCheck = document.getElementById('agree-check');
    const btnSign    = document.getElementById('btn-sign');

    function updateSignBtn() {
      const hasSig    = sigInput.value.trim().length >= 5;
      const hasEmail  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim());
      const hasAgree  = agreeCheck.checked;
      // Phase 04 - all addenda must be individually acknowledged
      const allAddendaAcked = _addendaSlugs.every(s => _addendaAcked.has(s));
      btnSign.disabled = !(hasSig && hasEmail && hasAgree && allAddendaAcked);
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
      document.getElementById('btn-sign-text').textContent = 'Submitting\u2026';
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
        // Phase 04 - which addenda the user explicitly acknowledged in this session
        acknowledged_addenda: Array.from(_addendaAcked),
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

    // ----- Boot -----
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
  