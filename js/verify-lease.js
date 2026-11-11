// ============================================================
// verify-lease.js -- Phase 06
//
// Public lease-PDF verification page. Reads the QR token from the
// query string, calls the verify-lease edge function, and renders
// the integrity result + signer summary. NO PII is requested or
// shown -- the edge function only emits first-name + last-initial.
// ============================================================
(function () {
  'use strict';

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
      });
    } catch { return iso; }
  }
  function fmtDateShort(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
    } catch { return iso; }
  }
  function roleLabel(r) {
    return ({
      tenant:        'Tenant',
      co_applicant:  'Co-Applicant',
      management:    'Landlord',
    })[r] || r;
  }
  function eventLabel(e) {
    return ({
      pre_sign:       'Issued for signing',
      tenant_signed:  'Signed by tenant',
      co_signed:      'Signed by co-applicant',
      countersigned:  'Fully executed',
      amended:        'Amended',
      renewed:        'Renewed',
      manual:         'Manual revision',
    })[e] || e || '—';
  }

  function render(state) {
    const body = document.getElementById('verify-body');
    if (!body) return;

    if (state.kind === 'error') {
      body.innerHTML = '';
      body.appendChild(el(`
        <div class="err-box">
          <strong>Verification failed</strong>
          ${esc(state.message || 'An unexpected error occurred while verifying this lease.')}
        </div>
      `));
      return;
    }

    if (state.kind === 'loading') {
      // initial pending markup is already in the DOM
      return;
    }

    // state.kind === 'result'
    const r       = state.result || {};
    const summary = r.summary || {};
    const ok      = r.hash_match === true;
    const reason  = r.reason || (ok ? 'PDF matches recorded hash' : 'PDF bytes differ from the recorded hash');

    const signersHtml = (summary.signers || []).map(s => `
      <div class="signer-row">
        <div class="signer-role">${esc(roleLabel(s.role))}</div>
        <div class="signer-name">${esc(s.display_name || '—')}</div>
        <div class="signer-date">${esc(fmtDate(s.signed_at))}</div>
      </div>
    `).join('') || '<div class="signer-row"><div class="signer-role">—</div><div class="signer-name" style="color:var(--muted)">No signers on file yet</div><div class="signer-date"></div></div>';

    const consents = summary.esign_consents_by_role || {};
    const consentsList = Object.keys(consents).map(k => `${esc(roleLabel(k))} × ${esc(consents[k])}`).join(' &middot; ') || 'None recorded';

    const auditNote = !ok
      ? `<div class="audit-note">
           <strong>Integrity warning.</strong> The bytes of the PDF on file do not match the SHA-256 recorded
           when this version was finalized. This event has been logged for review.
           If you believe the document was tampered with, please contact support immediately.
         </div>`
      : '';

    body.innerHTML = '';
    body.appendChild(el(`
      <div class="verify-status ${ok ? 'ok' : 'fail'}">
        <div class="vs-icon">${ok ? '✓' : '✗'}</div>
        <div>
          <div class="vs-title">${ok ? 'Document verified' : 'Document NOT verified'}</div>
          <div class="vs-sub">${esc(reason)}</div>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">State</span>
          <span class="info-val">${esc(summary.state_code || '—')}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Lease status</span>
          <span class="info-val">${esc((summary.lease_status || '—').toString().replace(/_/g, ' '))}</span>
        </div>
        <div class="info-item">
          <span class="info-label">PDF version</span>
          <span class="info-val">v${esc(summary.pdf_version)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Event</span>
          <span class="info-val">${esc(eventLabel(summary.event))}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Lease term</span>
          <span class="info-val">${esc(fmtDateShort(summary.lease_start_date))} → ${esc(fmtDateShort(summary.lease_end_date))}</span>
        </div>
        <div class="info-item">
          <span class="info-label">PDF generated</span>
          <span class="info-val">${esc(fmtDate(summary.created_at))}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Cert page</span>
          <span class="info-val">${summary.certificate_appended ? 'Yes' : 'No'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">E-SIGN consents</span>
          <span class="info-val">${consentsList}</span>
        </div>
      </div>

      <div class="signers">
        <h3>Signers on this version</h3>
        ${signersHtml}
      </div>

      <div class="hash-block">
        <span class="h-label">Recorded SHA-256</span>
        ${esc(r.stored_sha256 || '—')}
        <br><br>
        <span class="h-label">Re-computed SHA-256</span>
        <span class="${ok ? '' : 'h-mismatch'}">${esc(r.recomputed_sha256 || '—')}</span>
        <br><br>
        <span class="h-label">Verified at</span>
        ${esc(fmtDate(r.verified_at))}
        ${typeof r.size_bytes === 'number' ? `<br><br><span class="h-label">PDF size</span>${esc(r.size_bytes)} bytes` : ''}
      </div>

      ${auditNote}
    `));
  }

  async function verify() {
    const params = new URLSearchParams(window.location.search);
    const token  = (params.get('t') || params.get('token') || '').trim();
    if (!token) {
      render({ kind: 'error', message: 'No verification token in the URL. The link should look like /verify-lease.html?t=...' });
      return;
    }

    const cfg = window.CONFIG || {};
    const supaUrl  = cfg.SUPABASE_URL;
    const supaAnon = cfg.SUPABASE_ANON_KEY;
    if (!supaUrl || !supaAnon) {
      render({ kind: 'error', message: 'Verification service is not configured. Please refresh the page; if the error persists contact support.' });
      return;
    }

    const url = supaUrl.replace(/\/+$/, '') + '/functions/v1/verify-lease?t=' + encodeURIComponent(token);
    let resp;
    try {
      resp = await fetch(url, {
        method:  'GET',
        headers: {
          'apikey':        supaAnon,
          'Authorization': 'Bearer ' + supaAnon,
          'Accept':        'application/json',
        },
      });
    } catch (e) {
      render({ kind: 'error', message: 'Network error while contacting the verification service. ' + (e && e.message ? e.message : '') });
      return;
    }

    let payload = null;
    try { payload = await resp.json(); } catch { /* may be empty on 5xx */ }

    if (!resp.ok || !payload) {
      const msg = (payload && (payload.error || payload.message)) || `Verification failed (HTTP ${resp.status}).`;
      render({ kind: 'error', message: msg });
      return;
    }

    render({ kind: 'result', result: payload });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', verify);
  } else {
    verify();
  }
})();
