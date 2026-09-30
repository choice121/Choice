(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const state = { requests: [], filter: 'all', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' };

  function notice(message, error = false) {
    const target = $('#feedback');
    target.textContent = message;
    target.style.color = error ? '#f2a2a2' : '';
  }

  async function call(payload) {
    const session = await CP.Auth.getSession();
    const response = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/tour-scheduler`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: CONFIG.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session?.access_token || CONFIG.SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  }

  function formatTime(value, timezone) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return esc(value);
    try { return esc(new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone || state.timezone }).format(date)) + ` ${esc(timezone || state.timezone)}`; }
    catch { return esc(date.toLocaleString()); }
  }

  async function loadProperties() {
    const { data, error } = await CP.sb().from('properties')
      .select('id,title,address,city,state,zip,monthly_rent').eq('status', 'active').order('city').limit(1000);
    if (error) throw error;
    const options = ['<option value="">Choose an active property</option>', ...(data || []).map((property) =>
      `<option value="${esc(property.id)}">${esc(property.address)}, ${esc(property.city)}, ${esc(property.state)} · $${esc(property.monthly_rent)}/mo</option>`
    )].join('');
    $$('select[name="property_id"]').forEach((select) => { select.innerHTML = options; });
  }

  function requestMarkup(item) {
    const property = item.property || {};
    const times = Array.isArray(item.requested_times) ? item.requested_times : [];
    const messages = [...(item.messages || [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const status = item.status || 'requested';
    const requested = times.map((time) => typeof time === 'string' ? { at: time, timezone: 'UTC' } : time);
    const timeMarkup = requested.map((time) => `<div>${formatTime(time.at, time.timezone)}</div>`).join('');
    const messageMarkup = messages.map((message) => `<div class="tour-message ${message.sender_type === 'admin' ? 'admin' : 'guest'}"><strong>${esc(message.sender_name)}</strong> · ${esc(new Date(message.created_at).toLocaleString())}<br>${esc(message.body)}</div>`).join('');
    const controls = status === 'requested'
      ? `<form class="tour-form confirm-form" data-id="${esc(item.id)}"><label>Confirm date and time<input name="confirmed_for" type="datetime-local" required></label><label>Visit instructions<textarea name="instructions" maxlength="3000" placeholder="Arrival, access, parking, and who to ask for"></textarea></label><div class="tour-actions"><button class="btn btn-primary btn-sm" type="submit">Confirm and email guest</button><button class="btn btn-ghost btn-sm" type="button" data-action="decline" data-id="${esc(item.id)}">Decline</button></div></form>`
      : status === 'confirmed'
        ? `<div class="tour-times"><strong>Confirmed:</strong> ${formatTime(item.confirmed_for, item.confirmed_timezone)}${item.instructions ? `<br><strong>Instructions:</strong> ${esc(item.instructions)}` : ''}</div><div class="tour-actions"><button class="btn btn-ghost btn-sm" type="button" data-action="cancel" data-id="${esc(item.id)}">Cancel tour</button></div>`
        : '';
    const messageForm = ['declined', 'cancelled'].includes(status) ? '' : `<form class="message-form" data-id="${esc(item.id)}"><textarea name="body" maxlength="3000" required aria-label="Message guest" placeholder="Message guest"></textarea><button class="btn btn-ghost btn-sm" type="submit">Send</button></form>`;
    return `<article class="tour-request"><div class="tour-request-head"><div><h3>${esc(property.title || 'Property tour')}</h3><div class="tour-muted">${esc(property.address)}, ${esc(property.city)}, ${esc(property.state)} ${esc(property.zip)}</div></div><span class="tour-status ${esc(status)}">${esc(status)}</span></div><div class="tour-muted" style="margin-top:8px"><strong>${esc(item.guest_name)}</strong> · <a href="mailto:${esc(item.guest_email)}">${esc(item.guest_email)}</a>${item.guest_phone ? ` · ${esc(item.guest_phone)}` : ''}</div>${timeMarkup ? `<div class="tour-times"><strong>Guest preferred times</strong>${timeMarkup}</div>` : ''}${controls}<div class="tour-conversation">${messageMarkup || '<div class="tour-muted">No messages yet.</div>'}${messageForm}</div></article>`;
  }

  function render() {
    const requests = state.requests;
    const counts = {
      requested: requests.filter((row) => row.status === 'requested').length,
      confirmed: requests.filter((row) => row.status === 'confirmed').length,
      closed: requests.filter((row) => ['declined', 'cancelled'].includes(row.status)).length,
    };
    $('#tour-summary').innerHTML = `<span>${counts.requested} need review</span><span>${counts.confirmed} confirmed</span><span>${counts.closed} closed</span>`;
    const filtered = requests.filter((row) => state.filter === 'all' || (state.filter === 'closed' ? ['declined', 'cancelled'].includes(row.status) : row.status === state.filter));
    $('#tour-list').innerHTML = filtered.length ? filtered.map(requestMarkup).join('') : '<div class="tour-empty">No tour requests in this view.</div>';
    const minimum = new Date(Date.now() + 60_000);
    const local = new Date(minimum.getTime() - minimum.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    $$('input[name="confirmed_for"]').forEach((input) => { input.min = local; });
  }

  async function loadRequests() {
    const response = await call({ action: 'list' });
    state.requests = response.requests || [];
    render();
  }

  function showLink(data, label) {
    const box = $('#created-link');
    box.hidden = false;
    box.innerHTML = `<strong>${esc(label)}</strong><div class="tour-note">${data.email_sent ? 'Email sent through the GAS relay.' : `Email was not sent: ${esc(data.email_error || 'check Supabase email logs')}. You can still copy the private link.`}</div><input id="tour-link-value" readonly aria-label="Private tour link" value="${esc(data.link)}"><button class="btn btn-ghost btn-sm" id="copy-tour-link" type="button">Copy private link</button>`;
    $('#copy-tour-link').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(data.link); notice('Private link copied.'); }
      catch { $('#tour-link-value').select(); notice('Select and copy the link.'); }
    });
  }

  function formData(form) { return Object.fromEntries(new FormData(form).entries()); }

  async function initialize() {
    if (!await CP.Auth.requireAdmin()) return;
    try {
      await loadProperties();
      await loadRequests();
    } catch (error) { notice(error.message || 'Unable to load tour scheduling.', true); }

    $$('[data-mode]').forEach((button) => button.addEventListener('click', () => {
      const direct = button.dataset.mode === 'direct';
      $('#link-form').hidden = direct;
      $('#direct-form').hidden = !direct;
      $$('[data-mode]').forEach((item) => item.classList.toggle('active', item === button));
      $('#created-link').hidden = true;
      notice('');
    }));

    $('#link-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        const data = await call({ action: 'create-invite', ...formData(form) });
        showLink(data, 'Private scheduling link created');
        form.reset();
        notice('The invite is ready.');
      } catch (error) { notice(error.message, true); }
      finally { submit.disabled = false; }
    });

    $('#direct-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = form.querySelector('[type="submit"]');
      const data = formData(form);
      submit.disabled = true;
      try {
        const result = await call({ ...data, action: 'schedule-direct', timezone: state.timezone, confirmed_for: new Date(data.confirmed_for).toISOString() });
        showLink(result, 'Tour scheduled');
        form.reset();
        await loadRequests();
        notice(result.email_sent ? 'Tour scheduled and confirmation emailed.' : `Tour scheduled, but the email failed: ${result.email_error || 'check email logs'}.` , !result.email_sent);
      } catch (error) { notice(error.message, true); }
      finally { submit.disabled = false; }
    });

    $('#refresh-tours').addEventListener('click', () => loadRequests().catch((error) => notice(error.message, true)));
    $$('.tour-filters [data-filter]').forEach((button) => button.addEventListener('click', () => {
      state.filter = button.dataset.filter;
      $$('.tour-filters [data-filter]').forEach((item) => item.classList.toggle('active', item === button));
      render();
    }));

    $('#tour-list').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.target;
      try {
        if (form.matches('.confirm-form')) {
          const values = formData(form);
          const result = await call({ action: 'confirm', request_id: form.dataset.id, timezone: state.timezone, confirmed_for: new Date(values.confirmed_for).toISOString(), instructions: values.instructions });
          notice(result.email_sent ? 'Tour confirmed and guest emailed with the final instructions.' : `Tour confirmed, but the confirmation email failed: ${result.email_error || 'check email logs'}.`, !result.email_sent);
        } else if (form.matches('.message-form')) {
          await call({ action: 'admin-message', request_id: form.dataset.id, body: formData(form).body });
          notice('Message sent to the guest.');
        } else return;
        await loadRequests();
      } catch (error) { notice(error.message, true); }
    });

    $('#tour-list').addEventListener('click', async (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      const action = button.dataset.action;
      const message = action === 'decline' ? prompt('Optional note to send to the guest:') : action === 'cancel' ? prompt('Optional cancellation note for the guest:') : '';
      if (message === null) return;
      button.disabled = true;
      try {
        const result = await call({ action, request_id: button.dataset.id, message });
        notice(result.email_sent ? (action === 'decline' ? 'Tour request update sent to the guest.' : 'Tour cancellation sent to the guest.') : 'Status updated, but the email could not be sent. Check the tour email log.', !result.email_sent);
        await loadRequests();
      } catch (error) { notice(error.message, true); button.disabled = false; }
    });
  }

  window.addEventListener('load', () => initialize().catch((error) => notice(error.message, true)));
})();