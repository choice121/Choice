// Choice Properties — Edge Function: send-message
// Allowed callers:
//   • Admin users (admin_roles table)
//   • Authenticated landlords — only for applications on their own properties
// Tenant replies use the submit_tenant_reply() DB RPC (anon-callable) instead.
import { corsResponse } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';
import { jsonResponse } from '../_shared/utils.ts';
import { sendEmail } from '../_shared/send-email.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse()

  // ── Authenticate caller ───────────────────────────────────
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.response
  const { user, supabase } = auth

  const { data: adminRow }    = await supabase.from('admin_roles').select('id').eq('user_id', user.id).maybeSingle()
  const { data: landlordRow } = await supabase.from('landlords').select('id').eq('user_id', user.id).maybeSingle()
  const isAdmin    = !!adminRow
  const isLandlord = !!landlordRow

  if (!isAdmin && !isLandlord) return jsonResponse({ success: false, error: 'Forbidden' }, 403)
  // ── End auth check ────────────────────────────────────────

  try {
    const { app_id, message, sender, sender_name } = await req.json()
    if (!app_id || !message) throw new Error('app_id and message required')

    // ── I-056: Message length cap ─────────────────────────────
    // Prevents unbounded strings from being stored in the messages table.
    // 4,000 chars ≈ ~600 words — more than enough for any landlord message.
    const MAX_MESSAGE_LENGTH = 4000
    if (typeof message !== 'string' || message.trim().length === 0) {
      return jsonResponse({ success: false, error: 'message must be a non-empty string' }, 400)
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
      if (!appCheck) return jsonResponse({ success: false, error: 'Application not found' }, 404)
      let hasAccess = appCheck.landlord_id === landlordRow!.id
      if (!hasAccess && appCheck.property_id) {
        const { data: propCheck } = await supabase
          .from('properties')
          .select('landlord_id')
          .eq('id', appCheck.property_id)
          .maybeSingle()
        hasAccess = propCheck?.landlord_id === landlordRow!.id
      }
      if (!hasAccess) return jsonResponse({ success: false, error: 'Forbidden — not your property' }, 403)
    }

    const { data: app, error: fetchErr } = await supabase.from('applications').select('email,first_name,preferred_language,landlord_id,property_address').eq('app_id', app_id).single()
    if (fetchErr) throw new Error(fetchErr.message)

    await supabase.from('messages').insert({ app_id, sender: sender || 'admin', sender_name: sender_name || 'Choice Properties', message })

    // Route all outbound mail through HMAC-SHA256 signed GAS relay helper
    if ((sender === 'admin' || sender === 'landlord' || !sender) && app.email) {
      try {
        const res = await sendEmail({
          template: 'new_message_tenant',
          to: app.email,
          data: {
            app_id,
            first_name: app.first_name || 'Applicant',
            message,
            preferred_language: app.preferred_language || 'en',
            sender_name: sender_name || 'Choice Properties Leasing Team',
          },
        });
        await supabase.from('email_logs').insert({
          type: 'new_message_tenant',
          recipient: app.email,
          status: res.ok ? 'sent' : 'failed',
          provider: res.provider,
          app_id,
          error_msg: res.ok ? null : (res.error || 'send failed'),
        });
      } catch (e) {
        await supabase.from('email_logs').insert({
          type: 'new_message_tenant',
          recipient: app.email,
          status: 'failed',
          provider: 'none',
          app_id,
          error_msg: (e as Error)?.message || 'Network error',
        });
      }
    }

    if (sender === 'tenant' && app.landlord_id) {
      const { data: landlordData } = await supabase.from('landlords').select('email, contact_name, business_name').eq('id', app.landlord_id).maybeSingle()
      if (landlordData?.email) {
        const landlordName = landlordData.business_name || landlordData.contact_name || 'Landlord'
        try {
          const res = await sendEmail({
            template: 'new_message_landlord',
            to: landlordData.email,
            data: {
              app_id,
              landlordName,
              tenantName: sender_name || 'Tenant',
              message,
              property: app.property_address || '',
            },
          });
          await supabase.from('email_logs').insert({
            type: 'new_message_landlord',
            recipient: landlordData.email,
            status: res.ok ? 'sent' : 'failed',
            provider: res.provider,
            app_id,
            error_msg: res.ok ? null : (res.error || 'send failed'),
          });
        } catch (e) {
          await supabase.from('email_logs').insert({
            type: 'new_message_landlord',
            recipient: landlordData.email,
            status: 'failed',
            provider: 'none',
            app_id,
            error_msg: (e as Error)?.message || 'Network error',
          });
        }
      }
    }

    return jsonResponse({ success: true })
  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500)
  }
})
