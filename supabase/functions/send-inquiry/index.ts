// Choice Properties — Edge Function: send-inquiry
// Handles all inquiry-related emails server-side.
//
// Handles:
//   type: 'inquiry_reply'   → confirmation to tenant
//   type: 'new_inquiry'     → notification to landlord
//   type: 'app_id_recovery' → sends applicant their app_id link
//
// Called from: cp-api.js Inquiries.submit() and Applications.sendRecoveryEmail()
// No auth required — these are public-facing actions.
//
// Rate limiting: max 5 requests per IP per 5 minutes (DB-backed, C-03).
// app_id_recovery and tenant_reply are exempt from rate limiting.
//
// Issue #25 (Apr 26 2026): every GAS call now goes through gasSend() in
// _shared/send-email.ts so the HMAC-signed payload is identical across
// every edge function. Previously this file built the payload by hand
// with only the legacy `secret` field.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsResponse } from '../_shared/cors.ts';
import { getClientIp, jsonResponse } from '../_shared/utils.ts';
import { isDbRateLimited } from '../_shared/rate-limit.ts';
import { gasSend } from '../_shared/send-email.ts';
import { getTenantLoginUrl } from '../_shared/config.ts';

// ── C-03: DB-backed rate limiting ─────────────────────────────
// Max 5 new_inquiry requests per IP per 5 minutes.
// Uses rate_limit_log table — persists across Deno cold starts.
const RATE_LIMIT_MAX    = 5;
const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes in ms
// ── End C-03 ──────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse(req.headers.get('origin'))

  // ── Parse body early — needed to check type for rate-limit exemptions ──
  let body: any = {}
  try { body = await req.json() } catch { /* empty body */ }
  const { type } = body

  // ── C-03: DB-backed rate-limit check ──────────────────────
  // SECURITY: tenant_reply was previously exempt under the assumption it
  // was an internal callback after submit_tenant_reply() DB RPC succeeded.
  // But this endpoint is publicly callable — there is no server-side proof
  // the RPC actually ran. An attacker can POST {type:'tenant_reply', app_id, message}
  // directly and spam landlord inboxes for any known app_id, bypassing the
  // IP throttle. Subjecting tenant_reply to the standard 5-per-5-min IP cap
  // closes the abuse path while leaving legitimate use (one POST per actual
  // reply) well inside the limit.
  //
  // app_id_recovery remains exempt: it's a self-service "I forgot my app ID"
  // flow that a user might legitimately retry several times in quick
  // succession across devices, and the email is sent only to the address
  // tied to the matching application — no third-party harm vector.
  const clientIp = getClientIp(req)
  const rateLimitExempt = type === 'app_id_recovery'
  if (!rateLimitExempt && await isDbRateLimited(clientIp, 'send-inquiry', RATE_LIMIT_MAX, RATE_LIMIT_WINDOW)) {
    return jsonResponse(
      { success: false, error: 'Too many requests. Please wait a few minutes before trying again.' },
      429,
      { 'Retry-After': '300' },
      req
    )
  }
  // ── End rate-limit check ──────────────────────────────────────────────

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // GAS relay is reached via gasSend() — that helper checks env vars itself
    // and returns ok=false with a descriptive error if the relay is not
    // configured. Keep a top-level guard so callers still see the legacy
    // "Email relay not configured" warning when both vars are missing.
    const gasConfigured =
      !!Deno.env.get('GAS_EMAIL_URL') && !!Deno.env.get('GAS_RELAY_SECRET')
    if (!gasConfigured) {
      console.warn('GAS_EMAIL_URL or GAS_RELAY_SECRET not configured — email skipped')
      return jsonResponse({ success: true, warning: 'Email relay not configured' }, 200, {}, req)
    }

    // Helper: fire-and-forget GAS send + email_logs insert.
    // Mirrors the previous fetch().then().catch() pattern so the HTTP
    // response is returned to the caller immediately and the email
    // attempt is logged in the background.
    const fireAndLog = (
      template: string,
      to: string,
      data: Record<string, unknown>,
      logExtra: Record<string, unknown> = {},
    ) => {
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
    }

    // ── Tenant Reply → Landlord Notification (P1-B, rate-limit exempt) ────
    // submit_tenant_reply() is a DB RPC with no HTTP capability, so cp-api.js
    // calls this endpoint after a successful tenant reply to notify the landlord.
    // Rate-limit is intentionally bypassed for authenticated tenant reply notifications.
    if (type === 'tenant_reply') {
      const { app_id, tenant_name, message } = body
      if (!app_id || !message) throw new Error('app_id and message required')

      const { data: appRow } = await supabase
        .from('applications')
        .select('landlord_id, first_name, last_name')
        .eq('app_id', app_id)
        .maybeSingle()

      if (appRow?.landlord_id) {
        const { data: landlordRow } = await supabase
          .from('landlords')
          .select('email, contact_name, business_name')
          .eq('id', appRow.landlord_id)
          .maybeSingle()

        if (landlordRow?.email) {
          const landlordName  = landlordRow.business_name || landlordRow.contact_name || 'Landlord'
          const applicantName = tenant_name || `${appRow.first_name || ''} ${appRow.last_name || ''}`.trim() || 'Tenant'
          fireAndLog(
            'new_message_landlord',
            landlordRow.email,
            { app_id, landlordName, tenantName: applicantName, message },
            { app_id },
          )
        }
      }

      return jsonResponse({ success: true }, 200, {}, req)
    }

    // ── App-ID Recovery by Email (server-side lookup) ──────
    // Accepts only an email address. Looks up all matching applications
    // server-side, sends recovery emails for each, and NEVER returns
    // app IDs back to the browser — preventing information disclosure.
    //
    // SECURITY: dashboard_url is built server-side via getTenantLoginUrl().
    // Any client-supplied dashboard_url is intentionally ignored — accepting
    // it here would let an attacker send phishing emails through this domain
    // with the victim's real app_id and an attacker-controlled link target.
    if (type === 'app_id_recovery_by_email') {
      const { email } = body
      if (!email) throw new Error('email required')

      const { data: appRows } = await supabase
        .from('applications')
        .select('app_id, preferred_language, property_address, created_at')
        .ilike('email', email)
        .order('created_at', { ascending: false })
        .limit(5)

      // Always return success to prevent email enumeration
      if (appRows && appRows.length > 0) {
        for (const row of appRows) {
          const link = getTenantLoginUrl(row.app_id, email)
          const preferred_language = row.preferred_language || 'en'
          // Fire and forget; log the ACTUAL outcome (E-2, 2026-04-28).
          // Previously we logged status:'sent' regardless of relay result,
          // which masked GAS secret-mismatch / quota / rate-limit failures
          // in the admin email-logs view.
          gasSend({
            template: 'app_id_recovery',
            to: email,
            data: { app_id: row.app_id, email, dashboard_url: link, preferred_language },
          }).then(async (res) => {
            await supabase.from('email_logs').insert({
              type: 'app_id_recovery',
              recipient: email,
              status: res.ok ? 'sent' : 'failed',
              error_msg: res.ok ? null : (res.error || `HTTP ${res.status}`),
              app_id: row.app_id,
            }).catch(() => {})
          }).catch(async (e) => {
            await supabase.from('email_logs').insert({
              type: 'app_id_recovery',
              recipient: email,
              status: 'failed',
              error_msg: e?.message || 'Network error',
              app_id: row.app_id,
            }).catch(() => {})
          })
        }
      }

      return jsonResponse({ success: true }, 200, {}, req)
    }

    // ── App-ID Recovery ────────────────────────────────────
    // SECURITY: dashboard_url is built server-side (see comment above).
    if (type === 'app_id_recovery') {
      const { email, app_id } = body
      if (!email || !app_id) throw new Error('email and app_id required')

      const { data: appRow } = await supabase
        .from('applications')
        .select('preferred_language')
        .eq('app_id', app_id)
        .maybeSingle()
      const preferred_language = appRow?.preferred_language || 'en'

      const dashboard_url = getTenantLoginUrl(app_id, email)

      // Fire-and-forget; log the ACTUAL outcome (E-2, 2026-04-28).
      gasSend({
        template: 'app_id_recovery',
        to: email,
        data: { app_id, email, dashboard_url, preferred_language },
      }).then(async (res) => {
        await supabase.from('email_logs').insert({
          type: 'app_id_recovery',
          recipient: email,
          status: res.ok ? 'sent' : 'failed',
          error_msg: res.ok ? null : (res.error || `HTTP ${res.status}`),
          app_id,
        }).catch(() => {})
      }).catch(async (e) => {
        await supabase.from('email_logs').insert({
          type: 'app_id_recovery',
          recipient: email,
          status: 'failed',
          error_msg: e?.message || 'Network error',
          app_id,
        }).catch(() => {})
      })

      return jsonResponse({ success: true }, 200, {}, req)
    }

    // ── Inquiry Emails (tenant confirmation + landlord alert) ──
    // C-04 FIX: The DB insert now happens here in the Edge Function (service-role key),
    // not in cp-api.js via the anon REST API. The anon INSERT grant and
    // inquiries_public_insert RLS policy have been removed from SETUP.sql.
    const { tenant_name, tenant_email, tenant_language, tenant_phone, message, property_id } = body
    // SECURITY: do NOT read insert_payload from body. The previous code passed
    // the entire client-supplied object straight to supabase.insert(), which
    // let callers control id, created_at, read, and any other column on the
    // inquiries table. The server now builds the row from validated fields.
    if (!tenant_name || typeof tenant_name !== 'string' || !tenant_name.trim()) {
      return jsonResponse({ success: false, error: 'tenant_name required' }, 400, {}, req)
    }
    if (!tenant_email || typeof tenant_email !== 'string' || !tenant_email.trim()) {
      return jsonResponse({ success: false, error: 'tenant_email required' }, 400, {}, req)
    }
    if (!message || typeof message !== 'string' || !message.trim()) {
      return jsonResponse({ success: false, error: 'message required' }, 400, {}, req)
    }

    // H-05 FIX: Block messages containing URLs to prevent phishing links being
    // forwarded to landlords via the platform email relay.
    const hasUrl = /https?:\/\/\S+|www\.\S+/i.test(message)
    if (hasUrl) {
      return jsonResponse({
        success: false,
        error: 'Messages may not contain links. Please describe your inquiry in plain text.'
      }, 400)
    }

    // Length caps. The inquiries table has no DB-level length constraints,
    // so cap on the way in to prevent unbounded strings being persisted.
    const NAME_MAX  = 200
    const EMAIL_MAX = 254
    const PHONE_MAX = 50
    const MSG_MAX   = 4000
    const cleanName    = tenant_name.trim().slice(0, NAME_MAX)
    const cleanEmail   = tenant_email.trim().toLowerCase().slice(0, EMAIL_MAX)
    const cleanPhone   = typeof tenant_phone === 'string' && tenant_phone.trim()
                           ? tenant_phone.trim().slice(0, PHONE_MAX)
                           : null
    const cleanMessage = message.trim().slice(0, MSG_MAX)
    const cleanPropId  = typeof property_id === 'string' && property_id.trim()
                           ? property_id.trim()
                           : null

    // Build the row server-side. id, read, created_at all fall back to DB
    // defaults — never client-controlled.
    const inquiryRow = {
      tenant_name:  cleanName,
      tenant_email: cleanEmail,
      tenant_phone: cleanPhone,
      message:      cleanMessage,
      property_id:  cleanPropId,
    }

    // Insert using service-role client (bypasses RLS — RLS policies for
    // public inserts have been intentionally removed; see C-04 above).
    const { error: insertErr } = await supabase.from('inquiries').insert(inquiryRow)
    if (insertErr) {
      console.error('[send-inquiry] inquiries insert failed:', insertErr)
      return jsonResponse({ success: false, error: 'Failed to save inquiry' }, 500, {}, req)
    }

    // Resolve property title up front so both emails show a human-readable
    // name instead of a raw UUID (Bug 2 fix).
    let propertyLabel = property_id || ''
    if (property_id) {
      const { data: propLookup } = await supabase
        .from('properties')
        .select('title, address, city')
        .eq('id', property_id)
        .single()
      if (propLookup?.title) {
        propertyLabel = propLookup.address && propLookup.city
          ? `${propLookup.title} — ${propLookup.address}, ${propLookup.city}`
          : propLookup.title
      }
    }

    // Tenant confirmation
    fireAndLog(
      'inquiry_reply',
      tenant_email,
      { name: tenant_name, message, property: propertyLabel, preferred_language: tenant_language || 'en' },
    )

    // Landlord notification
    if (property_id) {
      const { data: prop } = await supabase
        .from('properties')
        .select('landlords(email, contact_name, business_name)')
        .eq('id', property_id)
        .single()

      const landlordEmail = (prop as any)?.landlords?.email
      if (landlordEmail) {
        const landlordName =
          (prop as any)?.landlords?.business_name ||
          (prop as any)?.landlords?.contact_name ||
          'Landlord'

        fireAndLog(
          'new_message_landlord',
          landlordEmail,
          {
            landlordName,
            tenantName: tenant_name,
            tenantEmail: tenant_email,
            message,
            property: propertyLabel,
            propertyId: property_id,
          },
        )
      }
    }

    return jsonResponse({ success: true }, 200, {}, req)

  } catch (err: any) {
    console.error('[send-inquiry] handler error:', err)
    return jsonResponse({ success: false, error: 'Failed to process inquiry' }, 500, {}, req)
  }
})
