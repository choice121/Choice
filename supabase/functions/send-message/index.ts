// Choice Properties — Edge Function: send-message
// Allowed callers:
//   • Admin users (admin_roles table)
//   • Authenticated landlords — only for applications on their own properties
// Tenant replies use the submit_tenant_reply() DB RPC (anon-callable) instead.
//
// Issue #25 (Apr 26 2026): every GAS call now goes through gasSend() in
// _shared/send-email.ts so the HMAC-signed payload is identical across
// every edge function.
import { corsResponse } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';
import { jsonResponse } from '../_shared/utils.ts';
import { gasSend } from '../_shared/send-email.ts';
import { isDbRateLimited } from '../_shared/rate-limit.ts';

// Per-user message cap: 30 / 10 min. Generous for real conversations
// (an admin replying to a batch of applications, or a landlord
// answering several questions back-to-back) while capping any
// compromised-account abuse against tenant inboxes + GAS quota.
const MSG_MAX_PER_WINDOW = 30;
const MSG_WINDOW_MS      = 10 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse(req.headers.get('origin'))

  // ── Authenticate caller ───────────────────────────────────
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.response
  const { user, supabase } = auth

  const { data: adminRow }    = await supabase.from('admin_roles').select('id').eq('user_id', user.id).maybeSingle()
  const { data: landlordRow } = await supabase.from('landlords').select('id').eq('user_id', user.id).maybeSingle()
  const isAdmin    = !!adminRow
  const isLandlord = !!landlordRow

  if (!isAdmin && !isLandlord) return jsonResponse({ success: false, error: 'Forbidden' }, 403, {}, req)
  // ── End auth check ────────────────────────────────────────

  // ── Per-user rate limit (DB-backed, survives cold starts) ──
  if (await isDbRateLimited('user:' + user.id, 'send-message', MSG_MAX_PER_WINDOW, MSG_WINDOW_MS)) {
    return jsonResponse({ success: false, error: 'Too many messages. Please wait a few minutes and try again.' }, 429, {}, req)
  }

  try {
    const { app_id, message, sender: clientSender, sender_name: clientSenderName } = await req.json()
    if (!app_id || !message) throw new Error('app_id and message required')

    // ── I-056: Message length cap ─────────────────────────────
    // Prevents unbounded strings from being stored in the messages table.
    // 4,000 chars ≈ ~600 words — more than enough for any landlord message.
    const MAX_MESSAGE_LENGTH = 4000
    if (typeof message !== 'string' || message.trim().length === 0) {
      return jsonResponse({ success: false, error: 'message must be a non-empty string' }, 400, {}, req)
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return jsonResponse(
        { success: false, error: `Message too long. Maximum is ${MAX_MESSAGE_LENGTH} characters.` },
        400
      )
    }
    // ── End I-056 ─────────────────────────────────────────────

    // Landlords may only message applicants on their own properties.
    // Check landlord_id first; fall back to property ownership for apps where landlord_id was not resolved at submission time.
    if (!isAdmin && isLandlord) {
      const { data: appCheck } = await supabase
        .from('applications')
        .select('landlord_id, property_id')
        .eq('app_id', app_id)
        .maybeSingle()
      if (!appCheck) return jsonResponse({ success: false, error: 'Application not found' }, 404, {}, req)
      let hasAccess = appCheck.landlord_id === landlordRow!.id
      if (!hasAccess && appCheck.property_id) {
        const { data: propCheck } = await supabase
          .from('properties')
          .select('landlord_id')
          .eq('id', appCheck.property_id)
          .maybeSingle()
        hasAccess = propCheck?.landlord_id === landlordRow!.id
      }
      if (!hasAccess) return jsonResponse({ success: false, error: 'Forbidden — not your property' }, 403, {}, req)
    }

    const { data: app, error: fetchErr } = await supabase.from('applications').select('email,first_name,preferred_language,landlord_id').eq('app_id', app_id).maybeSingle()
    if (fetchErr) {
      console.error('[send-message] applications fetch failed:', fetchErr)
      return jsonResponse({ success: false, error: 'Failed to load application' }, 500, {}, req)
    }
    if (!app) return jsonResponse({ success: false, error: 'Application not found' }, 404, {}, req)

    // ── SECURITY: derive sender + sender_name from auth, not body ─
    // Previously both came straight from the request body, so a landlord
    // could send a message with sender:'admin' and sender_name:'Choice Properties
    // Admin Team' — making fake-admin messages indistinguishable from real
    // admin messages in the tenant's inbox + persisted DB row.
    //
    // Now:
    //   • Landlords are forced to sender='landlord' with their own profile name.
    //   • Admins may set sender='tenant' (legitimate "relay this tenant message
    //     to the landlord" flow described at the bottom of this function) or
    //     sender='admin' (default). Admin sender_name is honoured for branded
    //     reply variations ("Choice Properties Support" etc).
    let effectiveSender: 'admin' | 'landlord' | 'tenant'
    let effectiveSenderName: string
    if (isAdmin) {
      effectiveSender = clientSender === 'tenant' ? 'tenant'
                      : clientSender === 'landlord' ? 'landlord'
                      : 'admin'
      effectiveSenderName = (typeof clientSenderName === 'string' && clientSenderName.trim())
        ? clientSenderName.trim().slice(0, 200)
        : (effectiveSender === 'tenant' ? 'Tenant'
           : effectiveSender === 'landlord' ? 'Landlord'
           : 'Choice Properties')
    } else {
      // Landlord — forced identity. Look up the landlord's preferred display name.
      effectiveSender = 'landlord'
      const { data: landlordProfile } = await supabase
        .from('landlords')
        .select('business_name, contact_name')
        .eq('id', landlordRow!.id)
        .maybeSingle()
      effectiveSenderName = landlordProfile?.business_name
                         || landlordProfile?.contact_name
                         || 'Landlord'
    }

    await supabase.from('messages').insert({ app_id, sender: effectiveSender, sender_name: effectiveSenderName, message })

    // P1-A: Graceful GAS relay check — if not configured, skip email but still return success
    const gasConfigured = !!Deno.env.get('GAS_EMAIL_URL') && !!Deno.env.get('GAS_RELAY_SECRET')
    if (!gasConfigured) {
      console.warn('GAS_EMAIL_URL or GAS_RELAY_SECRET not configured — email notification skipped')
      return jsonResponse({ success: true, warning: 'Email relay not configured' }, 200, {}, req)
    }

    // Fire-and-forget GAS send + email_logs insert helper.
    //
    // E-4 (2026-04-28): wrap the background promise in EdgeRuntime.waitUntil
    // so Supabase Edge Runtime keeps the isolate alive until the GAS round-
    // trip AND the email_logs insert finish. Without this, the runtime
    // killed the worker the moment we returned jsonResponse(), so neither
    // the email nor the log row ever materialised.
    const keepAlive = (p: Promise<unknown>) => {
      // EdgeRuntime is a top-level binding injected by Supabase's deno_runtime
      // (it is NOT attached to globalThis, so an `as any` cast through globalThis
      // silently no-ops). Reference it directly with a typeof guard so local
      // Deno / tests still work.
      // @ts-ignore -- EdgeRuntime exists at runtime on Supabase Edge Functions
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(p)
      }
    }
    const fireAndLog = (
      template: string,
      to: string,
      data: Record<string, unknown>,
      logExtra: Record<string, unknown> = {},
    ) => {
      keepAlive(
        gasSend({ template, to, data }).then(async (res) => {
          await supabase.from('email_logs').insert({
            type: template,
            recipient: to,
            status: res.ok ? 'sent' : 'failed',
            error_msg: res.ok ? null : (res.error || `HTTP ${res.status}`),
            ...logExtra,
          }).catch(() => {})
        }).catch(async (e) => {
          await supabase.from('email_logs').insert({
            type: template,
            recipient: to,
            status: 'failed',
            error_msg: e?.message || 'Network error',
            ...logExtra,
          }).catch(() => {})
        })
      )
    }

    // P1-A: new_message_tenant — notify tenant when admin or landlord sends a message.
    // Routing keys off effectiveSender (what we actually wrote to DB), not the
    // client-supplied value, so an impersonation attempt never affects routing.
    if (effectiveSender === 'admin' || effectiveSender === 'landlord') {
      fireAndLog(
        'new_message_tenant',
        app.email,
        { app_id, first_name: app.first_name, message, preferred_language: app.preferred_language || 'en' },
        { app_id },
      )
    }

    // P1-B: new_message_landlord — admin-only path: admin relays a tenant message.
    // Note: tenants cannot call this endpoint directly (auth guard enforces admin/landlord only).
    // For tenant-initiated replies, cp-api.js tenantReply() calls send-inquiry with type:'tenant_reply'
    // after the DB RPC succeeds. Landlords cannot reach this branch even if they try
    // (effectiveSender is forced to 'landlord' for non-admin callers).
    if (effectiveSender === 'tenant') {
      if (app.landlord_id) {
        const { data: landlordData } = await supabase.from('landlords').select('email, contact_name, business_name').eq('id', app.landlord_id).maybeSingle()
        if (landlordData?.email) {
          const landlordName = landlordData.business_name || landlordData.contact_name || 'Landlord'
          fireAndLog(
            'new_message_landlord',
            landlordData.email,
            { app_id, landlordName, tenantName: effectiveSenderName, message },
            { app_id },
          )
        }
      }
    }

    return jsonResponse({ success: true }, 200, {}, req)
  } catch (err) {
    console.error('[send-message] handler error:', err)
    return jsonResponse({ success: false, error: 'Failed to send message' }, 500, {}, req)
  }
})
