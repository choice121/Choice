(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const appId = params.get('app_id');
  const type = params.get('type');
  const receiptId = params.get('receipt_id');
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

  function showError(message) {
    state.innerHTML = esc(message) + ' <a href="/tenant/login.html">Sign in to the resident portal</a>.';
  }

  function renderReceipt(app, storedReceipt = null, downloadUrl = null) {
    const receiptType = storedReceipt?.receipt_type || type;
    const isHolding = receiptType === 'holding_deposit';
    const paid = storedReceipt ? storedReceipt.status === 'issued' : (isHolding ? app.holding_fee_paid === true : app.payment_status === 'paid');
    if (!paid) {
      showError('No recorded payment was found for this receipt.');
      return;
    }

    const amount = storedReceipt ? storedReceipt.amount : isHolding
      ? app.holding_fee_amount
      : (app.payment_amount_collected ?? app.payment_amount_recorded ?? app.application_fee);
    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      showError('The payment record does not contain a valid amount.');
      return;
    }

    const appRef = String(app.app_id || appId);
    const serialType = isHolding ? 'HOLD' : 'APP';
    const paidAt = storedReceipt?.paid_at || (isHolding
      ? (app.holding_fee_paid_at || app.payment_confirmed_at || app.payment_date)
      : (app.payment_confirmed_at || app.payment_date));
    const paidTimestamp = paidAt ? Date.parse(paidAt) : 0;
    const serial = storedReceipt?.receipt_number || `CP-REC-${serialType}-${appRef}-${paidTimestamp}`;
    const issuedAt = storedReceipt?.issued_at || new Date().toISOString();
    const name = `${app.first_name || ''} ${app.last_name || ''}`.trim() || 'Resident';
    const method = storedReceipt?.payment_method || app.payment_method_confirmed || app.payment_method_recorded || 'Not recorded';
    const reference = storedReceipt?.transaction_ref || app.payment_transaction_ref || app.payment_notes || 'Not provided';
    const description = isHolding ? 'Property reservation holding payment' : 'Residential application screening fee';
    const address = app.property_address || 'Property address not recorded';

    paper.innerHTML = `
      <header class="receipt-top">
        <div><div class="brand-name">CHOICE PROPERTIES</div><div class="brand-sub">Residential leasing operations</div></div>
        <div class="receipt-ref"><span>Receipt reference</span><strong>${esc(serial)}</strong><span>Issued ${esc(date(issuedAt))}</span></div>
      </header>
      <section class="receipt-heading"><div><div class="eyebrow">Payment record</div><h1>Official receipt</h1></div><span class="status">Payment recorded</span></section>
      <section class="amount-band"><div><div class="amount-label">Amount received</div><div class="amount-value">${esc(money(amountNumber))}</div></div><div class="receipt-kind">${esc(description)}</div></section>
      <section class="detail-grid" aria-label="Payment details">
        <div class="detail"><div class="detail-label">Received from</div><div class="detail-value">${esc(name)}</div></div>
        <div class="detail"><div class="detail-label">Payment date</div><div class="detail-value">${esc(date(paidAt))}</div></div>
        <div class="detail"><div class="detail-label">Property</div><div class="detail-value">${esc(address)}</div></div>
        <div class="detail"><div class="detail-label">Payment method</div><div class="detail-value">${esc(method)}</div></div>
        <div class="detail"><div class="detail-label">Application reference</div><div class="detail-value">${esc(appRef)}</div></div>
        <div class="detail"><div class="detail-label">Transaction reference</div><div class="detail-value">${esc(reference)}</div></div>
      </section>
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
    printButton.textContent = storedReceipt ? 'Download stamped PDF' : 'Download / Print PDF';
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

    const session = await CP.Auth.getSession();
    if (!session?.access_token) {
      showError('Sign in to view this receipt.');
      return;
    }

    const receiptResponse = await fetch(CONFIG.SUPABASE_URL + '/functions/v1/download-payment-receipt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG.SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + session.access_token,
      },
      body: JSON.stringify(receiptId ? { receipt_id: receiptId } : { app_id: appId, receipt_type: type }),
    });
    const receiptResult = await receiptResponse.json().catch(() => ({}));
    if (receiptResponse.ok && receiptResult.receipt && receiptResult.application) {
      renderReceipt(receiptResult.application, receiptResult.receipt, receiptResult.signed_url);
      return;
    }
    if (receiptId) {
      showError(receiptResult.error || 'This receipt is not available for the signed-in account.');
      return;
    }

    if (!receiptId) {
      const { data, error } = await CP.sb().from('applications')
      .select('app_id,first_name,last_name,property_address,application_fee,payment_status,payment_date,payment_confirmed_at,payment_amount_recorded,payment_amount_collected,payment_method_recorded,payment_method_confirmed,payment_transaction_ref,payment_notes,holding_fee_amount,holding_fee_paid,holding_fee_paid_at')
      .eq('app_id', appId)
      .maybeSingle();
      if (error || !data) {
        showError('This receipt is not available for the signed-in account.');
        return;
      }
      renderReceipt(data);
    }
  }

  load().catch(error => showError(error.message || 'Could not load this receipt.'));
})();