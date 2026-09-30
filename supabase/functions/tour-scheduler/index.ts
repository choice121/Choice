import { createClient } from 'npm:@supabase/supabase-js@2';
import { requireAdmin } from '../_shared/auth.ts';
import { getAdminEmails, getSiteUrl } from '../_shared/config.ts';
import { handleCors, jsonErr, jsonOk } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/send-email.ts';

const serviceClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const encoder = new TextEncoder();
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!));

function emailHtml(title: string, paragraphs: string[], rows: Array<[string, string]> = [], cta?: [string, string]) {
  const details = rows.map(([label, value]) =>
    `<tr><td style="padding:8px 12px;color:#64748b">${escapeHtml(label)}</td><td style="padding:8px 12px;font-weight:600">${escapeHtml(value)}</td></tr>`
  ).join('');
  const body = paragraphs.map((text) => `<p style="line-height:1.6;color:#334155">${escapeHtml(text)}</p>`).join('');
  const button = cta
    ? `<p style="margin:24px 0"><a href="${escapeHtml(cta[1])}" style="background:#176b55;color:white;padding:12px 18px;border-radius:5px;text-decoration:none;font-weight:700">${escapeHtml(cta[0])}</a></p>`
    : '';
  return `<div style="margin:0 auto;max-width:620px;font:15px Arial,sans-serif;color:#10231f"><div style="border-top:5px solid #176b55;padding:24px"><p style="font-size:12px;font-weight:700;color:#176b55">CHOICE PROPERTIES</p><h1 style="font-size:24px">${escapeHtml(title)}</h1>${body}${details ? `<table style="width:100%;border-collapse:collapse;background:#f4f7f5">${details}</table>` : ''}${button}<p style="font-size:12px;color:#64748b;margin-top:28px">Choice Properties Leasing Team</p></div></div>`;
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function newToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function propertyLabel(property: Record<string, string>) {
  return `${property.address}, ${property.city}, ${property.state} ${property.zip}`;
}

async function deliver(input: {
  inviteId?: string;
  requestId?: string;
  recipient: string;
  emailType: string;
  subject: string;
  html: string;
}) {
  const result = await sendEmail({ to: input.recipient, subject: input.subject, html: input.html });
  await serviceClient.from('property_tour_email_log').insert({
    invite_id: input.inviteId ?? null,
    request_id: input.requestId ?? null,
    recipient: input.recipient,
    email_type: input.emailType,
    status: result.ok ? 'sent' : 'failed',
    provider: result.provider,
    error_message: result.error ?? null,
  });
  return result;
}

async function getInvite(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const { data } = await serviceClient.from('property_tour_invites')
    .select('id,property_id,invitee_name,invitee_email,expires_at,revoked_at')
    .eq('token_hash', await hashToken(token)).maybeSingle();
  if (!data || data.revoked_at || Date.parse(data.expires_at) <= Date.now()) return null;
  return data;
}

async function guestAction(body: Record<string, unknown>, req: Request) {
  const invite = await getInvite(String(body.token ?? ''));
  if (!invite) return jsonErr(404, 'This tour link is invalid or has expired.', req);

  if (body.action === 'guest-view') {
    const [{ data: property }, { data: request }] = await Promise.all([
      serviceClient.from('properties').select('id,title,address,city,state,zip,monthly_rent,bedrooms,bathrooms,property_photos(url,display_order,is_hero)')
        .eq('id', invite.property_id).maybeSingle(),
      serviceClient.from('property_tour_requests')
        .select('id,status,requested_times,confirmed_for,confirmed_timezone,instructions,created_at,updated_at,property_tour_messages(id,sender_type,sender_name,body,created_at)')
        .eq('invite_id', invite.id).maybeSingle(),
    ]);
    if (!property) return jsonErr(404, 'This property is no longer available.', req);
    request?.property_tour_messages?.sort((a: { created_at: string }, b: { created_at: string }) => a.created_at.localeCompare(b.created_at));
    return jsonOk({ property, invitee_name: invite.invitee_name, invitee_email: invite.invitee_email, request: request ?? null }, req);
  }

  if (body.action === 'request-tour') {
    const rawTimes = Array.isArray(body.requested_times) ? body.requested_times : [];
    const name = String(body.name ?? invite.invitee_name ?? '').trim().slice(0, 120);
    const phone = String(body.phone ?? '').trim().slice(0, 40);
    if (!name || rawTimes.length < 1 || rawTimes.length > 3) return jsonErr(400, 'Enter your name and 1 to 3 preferred times.', req);
    const times = rawTimes.map((item) => {
      const value = typeof item === 'string' ? { at: item, timezone: 'UTC' } : item as Record<string, unknown>;
      return { at: String(value.at ?? ''), timezone: String(value.timezone ?? 'UTC').slice(0, 80) };
    });
    if (times.some((item) => !Number.isFinite(Date.parse(item.at)) || Date.parse(item.at) <= Date.now())) {
      return jsonErr(400, 'Choose future dates and times.', req);
    }
    const { data: tourRequest, error } = await serviceClient.from('property_tour_requests').insert({
      invite_id: invite.id, property_id: invite.property_id, guest_name: name,
      guest_email: invite.invitee_email, guest_phone: phone || null,
      requested_times: times,
    }).select('id,status,requested_times,created_at').single();
    if (error) return jsonErr(error.code === '23505' ? 409 : 400, error.code === '23505' ? 'A tour request has already been submitted for this link.' : 'Unable to submit the tour request.', req);

    await serviceClient.from('property_tour_messages').insert({ request_id: tourRequest.id, sender_type: 'guest', sender_name: name, body: 'Tour request submitted.' });
    const { data: property } = await serviceClient.from('properties').select('address,city,state,zip').eq('id', invite.property_id).single();
    const label = propertyLabel(property);
    const guestEmail = await deliver({
      inviteId: invite.id, requestId: tourRequest.id, recipient: invite.invitee_email,
      emailType: 'request_received', subject: 'Tour request received — awaiting confirmation',
      html: emailHtml('Tour request received', [
        `Hi ${name}, we received your request to tour ${propertyLabel(property)}. Our leasing team is reviewing the time options you selected and will send a confirmed appointment email once a time is approved.`,
        'Until that confirmation arrives, your visit is still pending. Please keep this private link handy for updates or to send a follow-up message.'
      ], [['Property', label], ['Status', 'Pending confirmation'], ['Next step', 'Wait for the leasing team to confirm a time']], ['Review private tour page', `${getSiteUrl()}/tour-request.html?token=${encodeURIComponent(String(body.token ?? ''))}`]),
    });
    for (const adminEmail of getAdminEmails()) {
      await deliver({
        inviteId: invite.id, requestId: tourRequest.id, recipient: adminEmail,
        emailType: 'admin_new_request', subject: `New tour request: ${property.address}`,
        html: emailHtml('New tour request', [`${name} (${invite.invitee_email}) requested a tour.`], [
          ['Property', label], ['Phone', phone || 'Not provided'],
          ['Preferred times', times.map((item) => `${item.at} (${item.timezone})`).join(' | ')],
        ], ['Open tour manager', `${getSiteUrl()}/admin/tours.html`]),
      });
    }
    return jsonOk({ request: tourRequest, email_sent: guestEmail.ok }, req);
  }

  if (body.action === 'guest-message') {
    const text = String(body.body ?? '').trim();
    if (!text || text.length > 3000) return jsonErr(400, 'Message must be between 1 and 3000 characters.', req);
    const { data: tourRequest } = await serviceClient.from('property_tour_requests')
      .select('id,guest_name,guest_email,status').eq('invite_id', invite.id).maybeSingle();
    if (!tourRequest) return jsonErr(404, 'Submit a tour request before messaging the team.', req);
    if (['cancelled', 'declined'].includes(tourRequest.status)) return jsonErr(409, 'This tour request is closed.', req);
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await serviceClient.from('property_tour_messages')
      .select('id', { count: 'exact', head: true }).eq('request_id', tourRequest.id)
      .eq('sender_type', 'guest').gte('created_at', since);
    if ((count ?? 0) >= 5) return jsonErr(429, 'Please wait before sending another message.', req);
    const { error } = await serviceClient.from('property_tour_messages').insert({ request_id: tourRequest.id, sender_type: 'guest', sender_name: tourRequest.guest_name, body: text });
    if (error) return jsonErr(500, 'Unable to send your message.', req);
    const { data: property } = await serviceClient.from('properties').select('address,city,state,zip').eq('id', invite.property_id).single();
    for (const adminEmail of getAdminEmails()) {
      await deliver({
        inviteId: invite.id, requestId: tourRequest.id, recipient: adminEmail,
        emailType: 'guest_message', subject: 'New message about a property tour',
        html: emailHtml('New tour message', [`${tourRequest.guest_name} sent a message:`, text], [['Property', propertyLabel(property)]], ['Open tour manager', `${getSiteUrl()}/admin/tours.html`]),
      });
    }
    return jsonOk({ sent: true }, req);
  }

  return jsonErr(400, 'Unknown guest action.', req);
}

async function adminAction(body: Record<string, unknown>, userId: string, req: Request) {
  const action = String(body.action ?? '');
  if (action === 'list') {
    const { data, error } = await serviceClient.from('property_tour_requests')
      .select('*,property:properties(id,title,address,city,state,zip,monthly_rent),messages:property_tour_messages(id,sender_type,sender_name,body,created_at)')
      .order('created_at', { ascending: false }).limit(200);
    if (error) return jsonErr(500, 'Unable to load tour requests.', req);
    return jsonOk({ requests: data ?? [] }, req);
  }

  if (action === 'create-invite' || action === 'schedule-direct') {
    const propertyId = String(body.property_id ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    const name = String(body.name ?? '').trim().slice(0, 120);
    if (!propertyId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonErr(400, 'Choose a property and enter a valid email address.', req);
    const { data: property } = await serviceClient.from('properties').select('id,title,address,city,state,zip')
      .eq('id', propertyId).eq('status', 'active').maybeSingle();
    if (!property) return jsonErr(404, 'Active property not found.', req);
    const token = newToken();
    const { data: invite, error } = await serviceClient.from('property_tour_invites').insert({
      property_id: propertyId, invitee_name: name || null, invitee_email: email,
      token_hash: await hashToken(token), created_by: userId,
    }).select('id,expires_at').single();
    if (error) return jsonErr(500, 'Unable to create the private tour link.', req);
    const link = `${getSiteUrl()}/tour-request.html?token=${token}`;

    if (action === 'schedule-direct') {
      const timestamp = Date.parse(String(body.confirmed_for ?? ''));
      const timezone = String(body.timezone ?? 'UTC').slice(0, 80);
      const instructions = String(body.instructions ?? '').trim().slice(0, 3000);
      if (!Number.isFinite(timestamp) || timestamp <= Date.now()) {
        await serviceClient.from('property_tour_invites').delete().eq('id', invite.id);
        return jsonErr(400, 'Choose a future confirmed date and time.', req);
      }
      const confirmedFor = new Date(timestamp).toISOString();
      const { data: request, error: requestError } = await serviceClient.from('property_tour_requests').insert({
        invite_id: invite.id, property_id: propertyId, guest_name: name || 'Guest', guest_email: email,
        requested_times: [{ at: confirmedFor, timezone }], status: 'confirmed', confirmed_for: confirmedFor,
        confirmed_timezone: timezone, confirmed_at: new Date().toISOString(), instructions,
      }).select('id').single();
      if (requestError) {
        await serviceClient.from('property_tour_invites').delete().eq('id', invite.id);
        return jsonErr(500, 'Unable to schedule this tour.', req);
      }
      await serviceClient.from('property_tour_messages').insert({
        request_id: request.id, sender_type: 'admin', sender_name: 'Choice Properties',
        body: `Tour scheduled for ${confirmedFor} (${timezone}).${instructions ? ` ${instructions}` : ''}`,
      });
      const delivery = await deliver({
        inviteId: invite.id, requestId: request.id, recipient: email,
        emailType: 'tour_confirmed', subject: `Tour confirmed: ${property.address}`,
        html: emailHtml('Your tour is confirmed', [
          `Hi ${name || 'there'}, your private tour is now confirmed for ${propertyLabel(property)}. The information below includes the scheduled time, arrival details, and any instructions from our leasing team.`,
          'Please keep this email and the private tour link for quick access to your appointment details or to send a follow-up question.'
        ], [
          ['Property', propertyLabel(property)],
          ['Confirmed time', new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: timezone }).format(new Date(timestamp)) + ` (${timezone})`],
          ['Visit instructions', instructions || 'Please arrive on time and contact our leasing team if you need to confirm directions or access instructions.'],
        ], ['View tour details', link]),
      });
      return jsonOk({ link, email_sent: delivery.ok, email_error: delivery.error ?? null }, req);
    }

    const delivery = await deliver({
      inviteId: invite.id, recipient: email, emailType: 'tour_invitation',
      subject: `Schedule a tour: ${property.address}`,
      html: emailHtml('You are invited to request a tour', [
        `Hi ${name || 'there'}, Choice Properties invited you to choose preferred times to visit this property. Your visit is only confirmed after our leasing team selects a time and sends instructions.`,
      ], [['Property', propertyLabel(property)], ['Link expires', new Date(invite.expires_at).toLocaleDateString('en-US')]], ['Choose preferred times', link]),
    });
    return jsonOk({ invite_id: invite.id, link, email_sent: delivery.ok, email_error: delivery.error ?? null }, req);
  }

  const requestId = String(body.request_id ?? '');
  const { data: tourRequest } = await serviceClient.from('property_tour_requests')
    .select('*,property:properties(id,title,address,city,state,zip),invite:property_tour_invites(id)')
    .eq('id', requestId).maybeSingle();
  if (!tourRequest) return jsonErr(404, 'Tour request not found.', req);

  if (action === 'confirm') {
    const confirmedFor = String(body.confirmed_for ?? '');
    const timestamp = Date.parse(confirmedFor);
    const timezone = String(body.timezone ?? 'UTC').slice(0, 80);
    const instructions = String(body.instructions ?? '').trim().slice(0, 3000);
    if (!Number.isFinite(timestamp) || timestamp <= Date.now()) return jsonErr(400, 'Choose a future confirmed date and time.', req);
    if (tourRequest.status !== 'requested') return jsonErr(409, 'Only pending requests can be confirmed.', req);
    const { data: updated, error } = await serviceClient.from('property_tour_requests').update({
      status: 'confirmed', confirmed_for: new Date(timestamp).toISOString(), confirmed_timezone: timezone,
      confirmed_at: new Date().toISOString(), instructions,
    }).eq('id', requestId).eq('status', 'requested').select('id').maybeSingle();
    if (error || !updated) return jsonErr(409, 'The request changed. Refresh and try again.', req);
    await serviceClient.from('property_tour_messages').insert({
      request_id: requestId, sender_type: 'admin', sender_name: 'Choice Properties',
      body: `Tour confirmed for ${new Date(timestamp).toISOString()} (${timezone}).${instructions ? ` ${instructions}` : ''}`,
    });
    const guestEmail = await deliver({
      inviteId: tourRequest.invite_id, requestId, recipient: tourRequest.guest_email,
      emailType: 'tour_confirmed', subject: `Tour confirmed: ${tourRequest.property.address}`,
      html: emailHtml('Your tour is confirmed', [
        `Hi ${tourRequest.guest_name}, your private tour has been confirmed for ${propertyLabel(tourRequest.property)}. Please arrive at the scheduled time and follow the visit instructions below.`,
        'If you need to ask a question, change the visit time, or request additional instructions, use the private tour link from your original invitation.'
      ], [
        ['Property', propertyLabel(tourRequest.property)],
        ['Confirmed time', new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: timezone }).format(new Date(timestamp)) + ` (${timezone})`],
        ['Visit instructions', instructions || 'Please arrive on time and contact our leasing team if you need directions, building access, or arrival guidance.'],
      ]),
    });
    return jsonOk({ updated: true, email_sent: guestEmail.ok, email_error: guestEmail.error ?? null }, req);
  }

  if (action === 'decline' || action === 'cancel') {
    const nextStatus = action === 'decline' ? 'declined' : 'cancelled';
    if (!['requested', 'confirmed'].includes(tourRequest.status)) return jsonErr(409, 'This request is already closed.', req);
    const { data: updated, error } = await serviceClient.from('property_tour_requests').update({ status: nextStatus })
      .eq('id', requestId).in('status', ['requested', 'confirmed']).select('id').maybeSingle();
    if (error || !updated) return jsonErr(409, 'The request changed. Refresh and try again.', req);
    const note = String(body.message ?? '').trim().slice(0, 1000);
    const text = action === 'decline' ? `The requested tour cannot be scheduled at this time.${note ? ` ${note}` : ''}` : `The scheduled tour has been cancelled.${note ? ` ${note}` : ''}`;
    await serviceClient.from('property_tour_messages').insert({ request_id: requestId, sender_type: 'admin', sender_name: 'Choice Properties', body: text });
    const delivery = await deliver({
      inviteId: tourRequest.invite_id, requestId, recipient: tourRequest.guest_email,
      emailType: nextStatus, subject: action === 'decline' ? 'Update on your tour request' : 'Your tour has been cancelled',
      html: emailHtml(action === 'decline' ? 'Tour request update' : 'Tour cancelled', [text], [['Property', propertyLabel(tourRequest.property)]]),
    });
    return jsonOk({ updated: true, email_sent: delivery.ok, email_error: delivery.error ?? null }, req);
  }

  if (action === 'admin-message') {
    const text = String(body.body ?? '').trim();
    if (!text || text.length > 3000) return jsonErr(400, 'Message must be between 1 and 3000 characters.', req);
    const { error } = await serviceClient.from('property_tour_messages').insert({ request_id: requestId, sender_type: 'admin', sender_name: 'Choice Properties', body: text });
    if (error) return jsonErr(500, 'Unable to send the message.', req);
    const delivery = await deliver({
      inviteId: tourRequest.invite_id, requestId, recipient: tourRequest.guest_email,
      emailType: 'admin_message', subject: 'A message about your property tour',
      html: emailHtml('Message from Choice Properties', [text, 'Use the private tour link from your original invitation to view the conversation or reply.'], [['Property', propertyLabel(tourRequest.property)]]),
    });
    return jsonOk({ sent: true, email_sent: delivery.ok, email_error: delivery.error ?? null }, req);
  }

  return jsonErr(400, 'Unknown admin action.', req);
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return jsonErr(405, 'Use POST.', req);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonErr(400, 'Invalid JSON body.', req); }
  const action = String(body.action ?? '');
  if (['guest-view', 'request-tour', 'guest-message'].includes(action)) return await guestAction(body, req);
  const auth = await requireAdmin(req);
  if (auth.ok === false) return auth.response;
  return await adminAction(body, auth.user.id, req);
});