(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(String(window.location.hash || '').replace(/^#/, ''));
  const rawAppId = (params.get('app_id') || '').trim();
  const appId = /^cp-/i.test(rawAppId) ? rawAppId.toUpperCase() : rawAppId;
  const type = (params.get('type') || '').trim();
  const receiptId = (params.get('receipt_id') || '').trim();
  const applicantId = (params.get('applicant_id') || '').trim();
  const receiptToken = (hashParams.get('rt') || params.get('receipt_token') || '').trim();
  const state = document.getElementById('receipt-state');
  const paper = document.getElementById('receipt-paper');
  const printButton = document.getElementById('print-receipt');

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function money(value) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value));
  }

  function date(value) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 'Not recorded' : parsed.toLocaleString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
    });
  }

  function getStoredFallbackAppId() {
    if (appId) return appId;
    try {
      const s = sessionStorage.getItem('pendingPortalAppId') || sessionStorage.getItem('lastSuccessAppId');
      if (s) return /^cp-/i.test(s) ? s.toUpperCase() : s;
      const rawLocal = localStorage.getItem('cpLastSubmittedApplication');
      if (rawLocal) {
        const parsed = JSON.parse(rawLocal);
        if (parsed?.app_id) return /^cp-/i.test(parsed.app_id) ? parsed.app_id.toUpperCase() : parsed.app_id;
      }
    } catch (_) {}
    return '';
  }

  function readCachedReceiptToken(targetAppId) {
    if (receiptToken) return receiptToken;
    if (!targetAppId) return '';
    try {
      return sessionStorage.getItem('cpReceiptToken:' + (/^cp-/i.test(targetAppId) ? targetAppId.toUpperCase() : targetAppId)) || '';
    } catch (_) {
      return '';
    }
  }

  function showError(message) {
    const targetApp = getStoredFallbackAppId();
    const portalHref = '/tenant/portal.html' + (targetApp ? '?app_id=' + encodeURIComponent(targetApp) : '');
    state.innerHTML = esc(message) + ` <a href="${portalHref}">Open Tenant Portal</a>.`;
  }

  async function performAutoLogin(targetAppId) {
    if (!targetAppId && !receiptId && !applicantId) return { session: null, receiptToken: '' };
    try {
      const res = await fetch('/api/tenant/auto-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(targetAppId ? { app_id: targetAppId } : {}),
          ...(receiptId ? { receipt_id: receiptId } : {}),
          ...(applicantId ? { applicant_id: applicantId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) return { session: null, receiptToken: '' };
      const resolvedAppId = data.app_id || targetAppId;
      const freshRt = data.receipt_access_token || '';
      if (freshRt && resolvedAppId) {
        try { sessionStorage.setItem('cpReceiptToken:' + (/^cp-/i.test(resolvedAppId) ? resolvedAppId.toUpperCase() : resolvedAppId), freshRt); } catch (_) {}
      }
      let nextSession = null;
      if (data.token_hash && window.CP?.sb()) {
        const { data: otpData, error: otpErr } = await CP.sb().auth.verifyOtp({
          token_hash: data.token_hash,
          type: data.verification_type || 'magiclink',
        });
        if (!otpErr && otpData?.session) nextSession = otpData.session;
      }
      return { session: nextSession, receiptToken: freshRt, appId: resolvedAppId };
    } catch (_) {
      return { session: null, receiptToken: '' };
    }
  }

  function renderReceipt(app, storedReceipt = null, downloadUrl = null, memberOverride = null) {
    const receiptType = storedReceipt?.receipt_type || type;
    const isHolding = receiptType === 'holding_deposit';
    const paid = storedReceipt
      ? ['issued', 'active'].includes(storedReceipt.status)
      : (isHolding ? app.holding_fee_paid === true : (memberOverride ? memberOverride.payment_status === 'paid' : app.payment_status === 'paid'));
    if (!paid) {
      showError('No recorded payment was found for this receipt.');
      return;
    }

    const amount = storedReceipt ? storedReceipt.amount : isHolding
      ? app.holding_fee_amount
      : (memberOverride ? (memberOverride.payment_amount ?? memberOverride.screening_fee_amount ?? 50) : (app.payment_amount_collected ?? app.payment_amount_recorded ?? app.application_fee));
    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      showError('The payment record does not contain a valid amount.');
      return;
    }

    const appRef = String(app.app_id || appId);
    const serialType = isHolding ? 'HOLD' : 'APP';
    const paidAt = storedReceipt?.paid_at || (isHolding
      ? (app.holding_fee_paid_at || app.payment_confirmed_at || app.payment_date)
      : (memberOverride?.payment_confirmed_at || app.payment_confirmed_at || app.payment_date));
    const paidTimestamp = paidAt ? Date.parse(paidAt) : 0;
    const serial = storedReceipt?.receipt_number || `CP-REC-${serialType}-${appRef}-${paidTimestamp}`;
    const issuedAt = storedReceipt?.issued_at || new Date().toISOString();
    const memberName = memberOverride ? `${memberOverride.first_name || ''} ${memberOverride.last_name || ''}`.trim() : '';
    const name = memberName || `${app.first_name || ''} ${app.last_name || ''}`.trim() || 'Resident';
    const method = storedReceipt?.payment_method || (memberOverride?.payment_card_last4 ? `${memberOverride.payment_card_brand || 'Card'} •••• ${memberOverride.payment_card_last4}` : null) || app.payment_method_confirmed || app.payment_method_recorded || 'Not recorded';
    const reference = storedReceipt?.transaction_ref || memberOverride?.payment_transaction_ref || app.payment_transaction_ref || app.payment_notes || 'Not provided';
    const description = isHolding ? 'Property reservation holding payment' : 'Residential application screening fee ($50/adult)';
    const address = app.property_address || 'Property address not recorded';

    const mode = app.household_payment_mode === 'individual' ? 'individual' : 'centralized';
    const arrangementLabel = mode === 'individual'
      ? 'Option B · Individual Member Payment ($50 Share)'
      : 'Option A · Centralized Household Payment';

    const rawBreakdown = Array.isArray(storedReceipt?.fee_breakdown) && storedReceipt.fee_breakdown.length
      ? storedReceipt.fee_breakdown
      : (Array.isArray(app.fee_breakdown) ? app.fee_breakdown : []);
    const targetApplicantId = storedReceipt?.applicant_id || applicantId || memberOverride?.id || null;
    const filteredBreakdown = (mode === 'individual' && targetApplicantId && rawBreakdown.some(r => r.applicant_id === targetApplicantId))
      ? rawBreakdown.filter(r => r.applicant_id === targetApplicantId)
      : rawBreakdown;

    const breakdownHtml = (!isHolding && filteredBreakdown.length)
      ? `<section class="breakdown-box" aria-label="Itemized fee breakdown">
          <div class="breakdown-title">Itemized Screening Fee Breakdown</div>
          <table class="breakdown-table">
            <tbody>
              ${filteredBreakdown.map(row => {
                const label = row.name || row.label || row.role_label || 'Applicant Screening';
                const role = row.role_label || row.roleLabel || '';
                const feeVal = Number(row.fee ?? 50);
                return `<tr>
                  <td><strong>${esc(label)}</strong>${role && role !== label ? ` <span style="color:#65716d">(${esc(role)})</span>` : ''}</td>
                  <td class="amt">${esc(money(feeVal))}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </section>`
      : '';

    paper.innerHTML = `
      <header class="receipt-top">
        <div><div class="brand-name">CHOICE PROPERTIES</div><div class="brand-sub">Residential leasing operations</div></div>
        <div class="receipt-ref"><span>Receipt reference</span><strong>${esc(serial)}</strong><span>Issued ${esc(date(issuedAt))}</span></div>
      </header>
      <section class="receipt-heading"><div><div class="eyebrow">Payment record</div><h1>Official receipt</h1>${!isHolding ? `<div class="arrangement-badge">${esc(arrangementLabel)}</div>` : ''}</div><span class="status">Payment recorded</span></section>
      <section class="amount-band"><div><div class="amount-label">Amount received</div><div class="amount-value">${esc(money(amountNumber))}</div></div><div class="receipt-kind">${esc(description)}</div></section>
      <section class="detail-grid" aria-label="Payment details">
        <div class="detail"><div class="detail-label">Received from</div><div class="detail-value">${esc(name)}</div></div>
        <div class="detail"><div class="detail-label">Payment date</div><div class="detail-value">${esc(date(paidAt))}</div></div>
        <div class="detail"><div class="detail-label">Property</div><div class="detail-value">${esc(address)}</div></div>
        <div class="detail"><div class="detail-label">Payment method</div><div class="detail-value">${esc(method)}</div></div>
        <div class="detail"><div class="detail-label">Application reference</div><div class="detail-value">${esc(appRef)}</div></div>
        <div class="detail"><div class="detail-label">Transaction reference</div><div class="detail-value">${esc(reference)}</div></div>
      </section>
      ${breakdownHtml}
      <div class="record-note">This receipt confirms that the payment shown above is recorded on the Choice Properties application ledger. Keep this document with your application records.</div>
      <svg class="receipt-seal" viewBox="0 0 120 120" role="img" aria-label="Choice Properties payment recorded seal">
        <circle cx="60" cy="60" r="53" fill="none" stroke="#187354" stroke-width="2"/>
        <circle cx="60" cy="60" r="46" fill="none" stroke="#187354" stroke-width="1"/>
        <path d="M35 61l16 16 34-37" fill="none" stroke="#187354" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        <text x="60" y="29" text-anchor="middle" fill="#187354" font-size="8" font-weight="700">CHOICE PROPERTIES</text>
        <text x="60" y="96" text-anchor="middle" fill="#187354" font-size="8" font-weight="700">PAYMENT RECORDED</text>
      </svg>
      <footer class="receipt-footer"><span>Choice Properties<br>Resident payment record</span><span>Reference ${esc(serial)}<br>Generated ${esc(date(issuedAt))}</span></footer>`;
    paper.hidden = false;
    state.hidden = true;
    printButton.disabled = false;
    printButton.textContent = downloadUrl ? 'Download stamped PDF' : 'Download / Print PDF';
    printButton.onclick = () => downloadUrl ? window.open(downloadUrl, '_blank', 'noopener') : window.print();
  }

  async function load() {
    if (!receiptId && (!appId || !['application_fee', 'holding_deposit'].includes(type))) {
      showError('This receipt link is incomplete or invalid.');
      return;
    }

    const started = Date.now();
    while (!window.CP?.Auth || !window.CP?.sb) {
      if (Date.now() - started > 8000) throw new Error('Secure portal services did not load. Please refresh this page.');
      await new Promise(resolve => setTimeout(resolve, 60));
    }

    const effectiveAppId = getStoredFallbackAppId();
    let effectiveReceiptToken = readCachedReceiptToken(effectiveAppId);
    let session = null;
    try { session = await CP.Auth.getSession(); } catch(_) {}

    let didAutoLogin = false;
    if (!session && !effectiveReceiptToken) {
      didAutoLogin = true;
      const autoRes = await performAutoLogin(effectiveAppId);
      if (autoRes.session) session = autoRes.session;
      if (autoRes.receiptToken) effectiveReceiptToken = autoRes.receiptToken;
    }

    async function fetchReceiptFunction(activeSession, activeToken) {
      const headers = {
        'Content-Type': 'application/json',
        'apikey': CONFIG.SUPABASE_ANON_KEY,
      };
      if (activeSession?.access_token) {
        headers['Authorization'] = 'Bearer ' + activeSession.access_token;
      }
      const bodyPayload = receiptId
        ? { receipt_id: receiptId, ...(activeToken ? { receipt_token: activeToken } : {}) }
        : {
            app_id: appId || effectiveAppId,
            receipt_type: type,
            ...(applicantId ? { applicant_id: applicantId } : {}),
            ...(activeToken ? { receipt_token: activeToken } : {}),
          };

      const resp = await fetch(CONFIG.SUPABASE_URL + '/functions/v1/download-payment-receipt', {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyPayload),
      });
      const jsonBody = await resp.json().catch(() => ({}));
      return { resp, jsonBody };
    }

    let { resp: receiptResponse, jsonBody: receiptResult } = await fetchReceiptFunction(session, effectiveReceiptToken);
    if (!receiptResponse.ok && !didAutoLogin && (receiptResponse.status === 401 || receiptResponse.status === 403 || receiptResponse.status === 404)) {
      didAutoLogin = true;
      const autoRes = await performAutoLogin(effectiveAppId);
      if (autoRes.session) session = autoRes.session;
      if (autoRes.receiptToken) effectiveReceiptToken = autoRes.receiptToken;
      if (session || effectiveReceiptToken) {
        const retried = await fetchReceiptFunction(session, effectiveReceiptToken);
        receiptResponse = retried.resp;
        receiptResult = retried.jsonBody;
      }
    }

    if (receiptResponse.ok && receiptResult.receipt && receiptResult.application) {
      renderReceipt(receiptResult.application, receiptResult.receipt, receiptResult.signed_url);
      return;
    }
    if (receiptId) {
      showError(receiptResult.error || 'This receipt could not be loaded automatically.');
      return;
    }

    if (!receiptId) {
      const appSelect = 'app_id,first_name,last_name,property_address,household_payment_mode,fee_breakdown,application_fee,payment_status,payment_date,payment_confirmed_at,payment_amount_recorded,payment_amount_collected,payment_method_recorded,payment_method_confirmed,payment_transaction_ref,payment_notes,holding_fee_amount,holding_fee_paid,holding_fee_paid_at';
      let { data, error } = await CP.sb().from('applications')
        .select(appSelect)
        .eq('app_id', appId)
        .maybeSingle();
      if (!data && !error && appId) {
        const escaped = appId.replace(/[\\%_]/g, m => '\\' + m);
        const ciRes = await CP.sb().from('applications')
          .select(appSelect)
          .ilike('app_id', escaped)
          .maybeSingle();
        data = ciRes.data;
        error = ciRes.error;
      }
      if (error || !data) {
        showError(receiptResult.error || 'This receipt is not available for the signed-in account.');
        return;
      }
      let memberOverride = null;
      if (applicantId) {
        const { data: mData } = await CP.sb().from('application_applicants')
          .select('id,first_name,last_name,screening_fee_amount,payment_status,payment_amount,payment_transaction_ref,payment_card_brand,payment_card_last4,payment_confirmed_at')
          .eq('id', applicantId)
          .maybeSingle();
        memberOverride = mData || null;
      }
      renderReceipt(data, null, null, memberOverride);
    }
  }

  load().catch(error => showError(error.message || 'Could not load this receipt.'));
})();