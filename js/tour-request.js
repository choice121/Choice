(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const params = new URLSearchParams(location.search);
  const token = params.get('token') || '';
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  let inviteData = null;

  function feedback(message, error = false) {
    const target = $('#tour-feedback');
    target.textContent = message;
    target.classList.toggle('error', error);
  }

  async function api(action, data = {}) {
    const response = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/tour-scheduler`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: CONFIG.SUPABASE_ANON_KEY, Authorization: `Bearer ${CONFIG.SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ action, token, ...data }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
    return result;
  }

  function formatTime(value, zone = timezone) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return esc(value);
    try { return `${esc(new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: zone }).format(date))} (${esc(zone)})`; }
    catch { return esc(date.toLocaleString()); }
  }

  function renderProperty(property) {
    const beds = property.bedrooms == null ? '' : `${property.bedrooms} bed`;
    const baths = property.bathrooms == null ? '' : `${property.bathrooms} bath`;
    const features = [beds, baths].filter(Boolean).join(' · ');
    $('#tour-property').hidden = false;
    $('#tour-property').innerHTML = `<div><h2>${esc(property.title)}</h2><address>${esc(property.address)}, ${esc(property.city)}, ${esc(property.state)} ${esc(property.zip)}</address></div><div class="tour-price">$${esc(Number(property.monthly_rent).toLocaleString())}/mo<small>${esc(features)}</small></div>`;
  }

  function renderMessages(request) {
    const messages = request.property_tour_messages || [];
    const list = messages.length
      ? messages.map((message) => `<div class="tour-message ${message.sender_type === 'admin' ? 'admin' : 'guest'}"><small>${esc(message.sender_name)} · ${esc(new Date(message.created_at).toLocaleString())}</small>${esc(message.body)}</div>`).join('')
      : '<p class="tour-helper">Messages about this visit will appear here.</p>';
    const closed = ['declined', 'cancelled'].includes(request.status);
    return `<section class="tour-panel"><h2>Conversation</h2><div class="tour-thread">${list}</div>${closed ? '' : '<form class="tour-message-form" id="tour-message-form"><label for="tour-message">Message our leasing team</label><textarea id="tour-message" name="body" maxlength="3000" required></textarea><button type="submit">Send message</button></form>'}</section>`;
  }

  function renderRequest(request) {
    const statusLabel = {
      requested: ['Request received', 'Our leasing team is reviewing your preferred times. Your visit is not confirmed yet.'],
      confirmed: ['Tour confirmed', 'Your visit is scheduled. Review the time and arrival instructions below.'],
      declined: ['Unable to schedule this request', 'Check the conversation below for a message from our leasing team.'],
      cancelled: ['Tour cancelled', 'Check the conversation below for the latest update.'],
    }[request.status] || ['Tour status updated', 'Contact our leasing team using the conversation below.'];
    let detail = '';
    if (request.status === 'confirmed') {
      detail = `<section class="tour-panel"><h2>Confirmed visit</h2><p><strong>${formatTime(request.confirmed_for, request.confirmed_timezone || timezone)}</strong></p><h3 style="font-size:13px;margin:16px 0 6px">Arrival instructions</h3><div class="tour-instructions">${esc(request.instructions || 'Contact our leasing team if you need arrival instructions.')}</div></section>`;
    } else if (request.status === 'requested') {
      const preferred = (request.requested_times || []).map((item) => typeof item === 'string' ? { at: item, timezone } : item);
      detail = `<section class="tour-panel"><h2>Your preferred times</h2>${preferred.map((item) => `<p>${formatTime(item.at, item.timezone)}</p>`).join('')}</section>`;
    }
    $('#tour-content').innerHTML = `<div class="tour-status ${request.status === 'confirmed' ? 'confirmed' : ''}"><strong>${esc(statusLabel[0])}</strong>${esc(statusLabel[1])}</div>${detail}${renderMessages(request)}`;
    $('#tour-content').hidden = false;
    feedback(`This private link was sent to ${inviteData.invitee_email}.`);
    $('#tour-message-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('button');
      button.disabled = true;
      try {
        await api('guest-message', { body: new FormData(form).get('body') });
        feedback('Message sent to the leasing team.');
        await refresh();
      } catch (error) { feedback(error.message, true); }
      finally { button.disabled = false; }
    });
  }

  function renderInvite() {
    $('#tour-content').innerHTML = `<section class="tour-panel"><h2>Choose preferred times</h2><p class="tour-helper">Select up to three options in your local time zone (${esc(timezone)}). We’ll email you after a time is confirmed.</p><form class="tour-form" id="tour-request-form"><label>Your name<input name="name" autocomplete="name" maxlength="120" value="${esc(inviteData.invitee_name || '')}" required></label><label>Phone (optional)<input name="phone" autocomplete="tel" maxlength="40" type="tel"></label><div class="tour-slots"><label>Preferred time 1<input name="time1" type="datetime-local" required></label><label>Preferred time 2<input name="time2" type="datetime-local"></label><label>Preferred time 3<input name="time3" type="datetime-local"></label></div><button type="submit">Request a tour</button></form></section>`;
    $('#tour-content').hidden = false;
    const minimum = new Date(Date.now() + 60_000);
    const minValue = new Date(minimum.getTime() - minimum.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    $$('input[type="datetime-local"]', $('#tour-content')).forEach((input) => { input.min = minValue; });
    $('#tour-request-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = new FormData(form);
      const button = form.querySelector('button');
      const requested_times = ['time1', 'time2', 'time3'].map((key) => values.get(key)).filter(Boolean).map((value) => ({ at: new Date(value).toISOString(), timezone }));
      button.disabled = true;
      try {
        const result = await api('request-tour', { name: values.get('name'), phone: values.get('phone'), requested_times });
        feedback(result.email_sent ? 'Your request was submitted successfully. A receipt was emailed to you; the visit is not confirmed until our team replies.' : 'Your request was submitted successfully, but the receipt email could not be sent. Our team has been notified.', !result.email_sent);
        await refresh();
      } catch (error) { feedback(error.message, true); button.disabled = false; }
    });
  }

  async function refresh() {
    const result = await api('guest-view');
    inviteData = result;
    renderProperty(result.property);
    if (result.request) renderRequest(result.request);
    else renderInvite();
  }

  async function initialize() {
    if (!/^[a-f0-9]{64}$/.test(token)) {
      feedback('This private tour link is missing or invalid. Contact the person who invited you for a new link.', true);
      return;
    }
    try { await refresh(); }
    catch (error) { feedback(error.message, true); }
  }

  window.addEventListener('load', initialize);
})();