export type SmsDispatchStage = 'fee' | 'approved' | 'holding' | 'lease' | 'executed' | 'handover';

export interface SmsDispatchData {
  app: Record<string, unknown>;
  siteUrl: string;
  receiptNumber?: string;
  receiptUrl?: string;
  accessCode?: string;
}

function htmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]!);
}

export function buildSmsMessage(stage: SmsDispatchStage, data: SmsDispatchData): string {
  const app = data.app;
  const firstName = String(app.first_name || 'there');
  const address = String(app.property_address || 'your property');
  const appId = String(app.app_id || '');
  const email = String(app.email || 'your email address');
  const method = String(app.primary_payment_method || 'preferred method');
  const portalUrl = `${data.siteUrl}/tenant/portal.html?app=${encodeURIComponent(appId)}`;
  const signingUrl = app.tenant_sign_token
    ? `${data.siteUrl}/lease-sign.html?token=${encodeURIComponent(String(app.tenant_sign_token))}`
    : portalUrl;

  switch (stage) {
    case 'fee':
      return `Hello ${firstName}, your $50 application screening fee for ${address} has been received and verified.\n\nYour official stamped corporate ledger receipt has been generated${data.receiptNumber ? ` (${data.receiptNumber})` : ''}. You can access your file and view your receipt directly in your resident portal here:\n${data.receiptUrl || portalUrl}\n\nYour full file is now with our underwriting department. We have also emailed a copy of your receipt to ${email} (please check your spam/junk folder if not visible).`;
    case 'approved':
      return `Congratulations ${firstName}! Your rental application for ${address} has been officially APPROVED by Choice Properties underwriting.\n\nUnder our reservation protocol, this property is eligible to be held exclusively in your name while we prepare your lease documents. Your holding deposit is 100% credited toward your move-in balance.\n\nPlease review your Approval & Reservation Agreement here:\n${portalUrl}\n\nWe also sent your official approval packet to ${email}. Please check your inbox and spam folder. Reply to this text to coordinate your reservation holding details.`;
    case 'holding':
      return `Great news ${firstName}! Your reservation holding deposit for ${address} has been verified and posted to your account ledger.\n\nThe home is now officially off the market and secured for your upcoming move-in! Your stamped receipt${data.receiptNumber ? ` (${data.receiptNumber})` : ''} is now available here:\n${data.receiptUrl || portalUrl}\n\nOur leasing team is currently preparing your official Residential Lease Agreement. We have also emailed your receipt to ${email} (please check spam if needed).`;
    case 'lease':
      return `Hello ${firstName}, your official Residential Lease Agreement for ${address} is prepared and ready for electronic signature!\n\nPlease review and execute your agreement securely using your signing link:\n${signingUrl}\n\nA direct signing copy was also dispatched to ${email}. Because this contains formal legal contracts, some email providers filter it—please inspect your spam, junk, or promotions folder. Feel free to text me here once signed!`;
    case 'executed':
      return `Welcome home, ${firstName}! Your lease for ${address} has been fully countersigned and finalized by Choice Properties management.\n\nYour complete, executed legal lease package and initial move-in orientation guide are now available in your resident portal:\n${portalUrl}\n\nWe also emailed your executed documents to ${email} (check your spam folder if not in primary inbox). Our move-in coordination team will reach out with your key handover protocol as your move-in date approaches!`;
    case 'handover':
      return `Hello ${firstName}, today is your official move-in day for ${address}!\n\nYour electronic lockbox / keypad access code is: ${data.accessCode || '[ENTER_CODE]'}\n(Code activates at 9:00 AM local time).\n\nPlease remember to complete your 48-Hour Move-In Condition Checklist in your portal to document initial property condition and protect your deposit:\n${portalUrl}\n\nFull move-in packet and emergency maintenance contacts have been emailed to ${email} (check spam if needed). Welcome to Choice Properties!`;
  }
}

export function buildSmsDispatchEmail(stage: SmsDispatchStage, data: SmsDispatchData): { subject: string; html: string } {
  const message = buildSmsMessage(stage, data);
  const labels: Record<SmsDispatchStage, string> = {
    fee: 'Application fee received',
    approved: 'Application approved',
    holding: 'Holding payment recorded',
    lease: 'Lease ready to sign',
    executed: 'Lease fully executed',
    handover: 'Key handover',
  };
  const phone = String(data.app.phone || '').replace(/[^+\d]/g, '');
  const smsHref = phone ? `sms:${phone}?body=${encodeURIComponent(message)}` : '';
  const escaped = htmlEscape(message);
  return {
    subject: `[ACTION: Send SMS] ${labels[stage]} — ${String(data.app.first_name || 'Applicant')} ${String(data.app.last_name || '')}`.trim(),
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${labels[stage]} SMS</title></head><body style="margin:0;background:#f1f4f2;color:#172321;font-family:Arial,sans-serif"><main style="max-width:640px;margin:24px auto;padding:28px;background:#fff;border:1px solid #dce3df"><div style="color:#176345;font-size:11px;font-weight:700;text-transform:uppercase">Choice Properties · Admin SMS Dispatch</div><h1 style="margin:8px 0 4px;font-size:22px">${labels[stage]}</h1><p style="margin:0 0 18px;color:#65716d;font-size:13px">${htmlEscape(String(data.app.first_name || 'Applicant'))} ${htmlEscape(String(data.app.last_name || ''))} · ${htmlEscape(String(data.app.property_address || ''))} · Ref ${htmlEscape(String(data.app.app_id || ''))}</p><pre style="white-space:pre-wrap;overflow-wrap:anywhere;padding:16px;background:#f5f8f6;border-left:3px solid #187354;font:14px/1.6 Arial,sans-serif">${escaped}</pre>${phone ? `<a href="${htmlEscape(smsHref)}" style="display:inline-block;margin-top:14px;padding:11px 15px;background:#176345;color:#fff;text-decoration:none;font-size:13px;font-weight:700">Open SMS app</a>` : ''}</main></body></html>`,
  };
}