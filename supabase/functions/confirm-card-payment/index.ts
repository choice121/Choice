import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleCors, jsonOk, jsonErr } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/send-email.ts';
import { paymentConfirmedHtml } from '../_shared/email.ts';
import { getAdminEmails, getSiteUrl } from '../_shared/config.ts';
import { issuePaymentReceipt, mintReceiptAccessToken } from '../_shared/payment-receipts.ts';
import { buildSmsDispatchEmail } from '../_shared/sms-dispatch.ts';

const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, SERVICE_KEY);

function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return jsonErr(405, 'POST required', req);

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token || !constantTimeEq(token, SERVICE_KEY)) {
    return jsonErr(401, 'Unauthorized', req);
  }

  let body: { app_id?: string; applicant_id?: string };
  try { body = await req.json(); } catch { return jsonErr(400, 'Invalid JSON body', req); }
  const appId = String(body.app_id || '').trim();
  const applicantId = String(body.applicant_id || '').trim() || null;
  if (!appId) return jsonErr(400, 'Missing app_id', req);

  const { data: app, error: appErr } = await supabase
    .from('applications')
    .select('*')
    .eq('app_id', appId)
    .maybeSingle();

  if (appErr || !app) return jsonErr(404, 'Application not found', req);

  let targetApplicant: Record<string, unknown> | null = null;
  if (applicantId) {
    const { data: applicantRow } = await supabase
      .from('application_applicants')
      .select('*')
      .eq('id', applicantId)
      .eq('app_id', appId)
      .maybeSingle();
    targetApplicant = applicantRow as Record<string, unknown> | null;
  }

  const isMemberPayment = Boolean(targetApplicant && String(app.household_payment_mode || 'centralized') === 'individual');
  const isPaid = isMemberPayment
    ? targetApplicant?.payment_status === 'paid'
    : app.payment_status === 'paid';
  if (!isPaid) return jsonErr(409, 'Payment is not marked paid', req);

  let receipt: { id: string; receipt_number: string } | null = null;
  let receiptUrl: string | undefined;
  try {
    const actorId = app.applicant_user_id ? String(app.applicant_user_id) : null;
    receipt = await issuePaymentReceipt(
      supabase,
      app as Record<string, unknown>,
      'application_fee',
      actorId,
      isMemberPayment ? { applicant: targetApplicant } : undefined,
    );
    const rt = await mintReceiptAccessToken(appId, isMemberPayment ? applicantId : null);
    receiptUrl = `${getSiteUrl()}/receipt.html?receipt_id=${encodeURIComponent(receipt.id)}${rt ? `#rt=${encodeURIComponent(rt)}` : ''}`;
  } catch (err) {
    console.warn('Card payment receipt warning:', (err as Error).message);
  }

  const { data: coApplicantRows } = await supabase
    .from('application_applicants')
    .select('screening_consent,payment_status')
    .eq('app_id', appId)
    .eq('is_primary', false);

  const pendingConsentCount = (coApplicantRows || []).filter((r: { screening_consent?: boolean }) => r.screening_consent !== true).length;
  const fullBreakdown = Array.isArray(app.fee_breakdown) ? app.fee_breakdown : undefined;
  const memberBreakdown = isMemberPayment && targetApplicant
    ? [{
        name: `${targetApplicant.first_name || ''} ${targetApplicant.last_name || ''}`.trim() || 'Applicant',
        role_label: String(targetApplicant.role || targetApplicant.applicant_type || 'Applicant'),
        fee: Number(targetApplicant.payment_amount ?? targetApplicant.screening_fee_amount ?? 50),
        note: 'Option B — Individual Member Payment',
      }]
    : fullBreakdown;

  const prop = String(app.property_address || 'your property');
  const payerFirstName = isMemberPayment && targetApplicant
    ? String(targetApplicant.first_name || 'Applicant')
    : String(app.first_name || 'Applicant');
  const recipientEmail = isMemberPayment && targetApplicant?.email
    ? String(targetApplicant.email)
    : String(app.email || '');
  const paidAmount = isMemberPayment && targetApplicant
    ? (targetApplicant.payment_amount ?? targetApplicant.screening_fee_amount ?? 50)
    : (app.payment_amount_collected ?? app.application_fee);
  const methodConfirmed = isMemberPayment && targetApplicant
    ? ([targetApplicant.payment_card_brand || 'Card', targetApplicant.payment_card_last4 ? `•••• ${targetApplicant.payment_card_last4}` : ''].filter(Boolean).join(' '))
    : app.payment_method_confirmed;
  const txRefConfirmed = isMemberPayment && targetApplicant
    ? String(targetApplicant.payment_transaction_ref || app.payment_transaction_ref || '')
    : app.payment_transaction_ref;

  let emailSent = false;
  if (recipientEmail) {
    const html = paymentConfirmedHtml(
      payerFirstName,
      prop,
      paidAmount,
      methodConfirmed,
      txRefConfirmed,
      undefined,
      app.phone || undefined,
      appId,
      app.property_name || undefined,
      {
        receiptNumber: receipt?.receipt_number,
        receiptUrl,
        feeBreakdown: memberBreakdown,
        pendingConsentCount,
        hasAdditionalMembers: Boolean(app.has_co_applicant) || (coApplicantRows || []).length > 0,
      },
    );
    const res = await sendEmail({
      to: recipientEmail,
      subject: `\u2705 Payment Confirmed — ${prop.split(',')[0]} | Choice Properties (Ref: ${appId})`,
      html,
    });
    emailSent = res.ok;
    try {
      await supabase.from('email_logs').insert({
        app_id: appId,
        type: 'payment_confirmed',
        recipient: recipientEmail,
        status: res.ok ? 'sent' : 'failed',
        provider: res.provider,
        error_msg: res.ok ? null : (res.error || 'send failed'),
      });
    } catch (_) {}
  }

  try {
    const dispatch = buildSmsDispatchEmail('fee', {
      app: app as Record<string, unknown>,
      siteUrl: getSiteUrl(),
      receiptNumber: receipt?.receipt_number,
      receiptUrl,
    });
    for (const adminEmail of getAdminEmails()) {
      await sendEmail({ to: adminEmail, subject: dispatch.subject, html: dispatch.html });
    }
  } catch (_) {}

  return jsonOk({
    ok: true,
    app_id: appId,
    applicant_id: applicantId,
    receipt_id: receipt?.id || null,
    receipt_number: receipt?.receipt_number || null,
    email_sent: emailSent,
  }, req);
});
