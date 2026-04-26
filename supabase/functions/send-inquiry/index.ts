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

// ── C-03: DB-backed rate limiting ─────────────────────────────
// Max 5 new_inquiry requests per IP per 5 minutes.
// Uses rate_limit_log table — persists across Deno cold starts.
const RATE_LIMIT_MAX    = 5;
const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes in ms
// ── End C-03 ──────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  // ── Parse body early — needed to check type for rate-limit exemptions ──
  let body: any = {}
  try { body = await req.json() } catch { /* empty body */ }
  const { type } = body

  // ── C-03: DB-backed rate-limit check ──────────────────────
  // 'tenant_reply' and 'app_id_recovery' are internal notification callbacks,
  // not user-initiated cold inquiries — exempt them from IP rate limiting.
  const clientIp = getClientIp(req)
  const rateLimitExempt = type === 'tenant_reply' || type === 'app_id_recovery'
  if (!rateLimitExempt && await isDbRateLimited(clientIp, 'send-inquiry', RATE_LIMIT_MAX, RATE_LIMIT_WINDOW)) {
    return jsonResponse(
      { success: false, error: 'Too many requests. Please wait a few minutes before trying again.' },
      429,
      { 'Retry-After': '300' }
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
      return jsonResponse({ success: true, warning: 'Email relay not configured' })
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

      return jsonResponse({ success: true })
    }

    // ── App-ID Recovery by Email (server-side lookup) ──────
    // Accepts only an email address. Looks up all matching applications
    // server-side, sends recovery emails for each, and NEVER returns
    // app IDs back to the browser — preventing information disclosure.
    if (type === 'app_id_recovery_by_email') {
      const { email, dashboard_url } = body
      if (!email) throw new Error('email required')

      const dashBase = (dashboard_url || '').replace(/\/+$/, '')

      const { data: appRows } = await supabase
        .from('applications')
        .select('app_id, preferred_language, property_address, created_at')
        .ilike('email', email)
        .order('created_at', { ascending: false })
        .limit(5)

      // Always return success to prevent email enumeration
      if (appRows && appRows.length > 0) {
        for (const row of appRows) {
          const link = `${dashBase}?id=${row.app_id}`
          const preferred_language = row.preferred_language || 'en'
          // Fire and forget; email_logs insert is best-effort.
          gasSend({
            template: 'app_id_recovery',
            to: email,
            data: { app_id: row.app_id, email, dashboard_url: link, preferred_language },
          }).catch(() => {})
          await supabase.from('email_logs').insert({
            type: 'app_id_recovery',
            recipient: email,
            status: 'sent',
            app_id: row.app_id,
          }).catch(() => {})
        }
      }

      return jsonResponse({ success: true })
    }

    // ── App-ID Recovery ────────────────────────────────────
    if (type === 'app_id_recovery') {
      const { email, app_id, dashboard_url } = body
      if (!email || !app_id) throw new Error('email and app_id required')

      const { data: appRow } = await supabase
        .from('applications')
        .select('preferred_language')
        .eq('app_id', app_id)
        .maybeSingle()
      const preferred_language = appRow?.preferred_language || 'en'

      gasSend({
        template: 'app_id_recovery',
        to: email,
        data: { app_id, email, dashboard_url, preferred_language },
      }).catch(() => {})

      await supabase.from('email_logs').insert({
        type: 'app_id_recovery',
        recipient: email,
        status: 'sent',
        app_id,
      })

      return jsonResponse({ success: true })
    }

    // ── Inquiry Emails (tenant confirmation + landlord alert) ──
    // C-04 FIX: The DB insert now happens here in the Edge Function (service-role key),
    // not in cp-api.js via the anon REST API. The anon INSERT grant and
    // inquiries_public_insert RLS policy have been removed from SETUP.sql.
    const { tenant_name, tenant_email, tenant_language, message, property_id, insert_payload } = body
    if (!tenant_email) throw new Error('tenant_email required')
    if (!message) throw new Error('message required')

    // H-05 FIX: Block messages containing URLs to prevent phishing links being
    // forwarded to landlords via the platform email relay.
    const hasUrl = /https?:\/\/\S+|www\.\S+/i.test(message)
    if (hasUrl) {
      return jsonResponse({
        success: false,
        error: 'Messages may not contain links. Please describe your inquiry in plain text.'
      }, 400)
    }

    // Insert the inquiry row using the service-role client (bypasses RLS)
    if (insert_payload && typeof insert_payload === 'object') {
      const { error: insertErr } = await supabase.from('inquiries').insert(insert_payload)
      if (insertErr) throw new Error(`Failed to save inquiry: ${insertErr.message}`)
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

    return jsonResponse({ success: true })

  } catch (err: any) {
    return jsonResponse({ success: false, error: err.message }, 500)
  }
})
