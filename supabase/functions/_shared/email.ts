import nodemailer from 'npm:nodemailer@6.9.16';
import { getAdminUrl, getContactEmail, getSiteUrl } from './config.ts';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: Deno.env.get('GMAIL_USER'),
    pass: Deno.env.get('GMAIL_APP_PASSWORD'),
  },
});

export async function sendEmail({
  to, subject, html,
}: { to: string; subject: string; html: string }) {
  const from = `"Choice Properties" <${Deno.env.get('GMAIL_USER')}>`;
  return transporter.sendMail({ from, to, subject, html });
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function footer() {
  return `<hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
    <p style="color:#a0aec0;font-size:12px">Choice Properties &middot; ${getContactEmail()} &middot; 707-706-3137</p>`;
}

function messageBlock(message?: string) {
  if (!message) return '';
  return `<div style="background:#fff;padding:14px;border-radius:6px;border:1px solid #e2e8f0;margin:16px 0">
    <p style="margin:0;color:#4a5568;font-size:14px">${message}</p>
  </div>`;
}

function header(color: string, title: string) {
  return `<div style="background:${color};padding:24px 32px;border-radius:8px 8px 0 0">
    <h1 style="color:#fff;margin:0;font-size:22px">${title}</h1>
  </div>`;
}

function wrap(headerHtml: string, bodyHtml: string) {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  ${headerHtml}
  <div style="background:#f8f9fa;padding:28px 32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none">
    ${bodyHtml}
    ${footer()}
  </div>
</div>`;
}

export function formatMoney(amount: number | string): string {
  return '$' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// ─── Existing templates ───────────────────────────────────────────────────────

export function signingEmailHtml(firstName: string, propertyAddress: string, signingUrl: string, appId: string) {
  return wrap(
    header('#006aff', 'Your Lease is Ready to Sign'),
    `<p style="color:#1a202c;font-size:15px">Dear ${firstName},</p>
    <p style="color:#4a5568;font-size:14px">Your lease for <strong>${propertyAddress}</strong> is ready for review and signature.</p>
    <div style="margin:24px 0;text-align:center">
      <a href="${signingUrl}" style="display:inline-block;padding:14px 32px;background:#006aff;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">Review &amp; Sign Your Lease</a>
    </div>
    <p style="color:#718096;font-size:13px">This link is unique to you and expires in 7 days. Do not share it.</p>
    <p style="color:#718096;font-size:13px">Application ID: <strong>${appId}</strong></p>`
  );
}

export function approvalEmailHtml(firstName: string, propertyAddress: string, message?: string) {
  return wrap(
    header('#16a34a', 'Application Approved'),
    `<p style="color:#1a202c;font-size:15px">Dear ${firstName},</p>
    <p style="color:#4a5568;font-size:14px">Congratulations! Your application for <strong>${propertyAddress}</strong> has been approved.</p>
    ${messageBlock(message)}
    <p style="color:#4a5568;font-size:14px">Our team will be in touch shortly regarding your lease agreement. Questions? Call 707-706-3137.</p>`
  );
}

// Phase 2A — added explicit 30-day reapplication language
export function denialEmailHtml(firstName: string, propertyAddress: string, message?: string) {
  return wrap(
    header('#374151', 'Application Status Update'),
    `<p style="color:#1a202c;font-size:15px">Dear ${firstName},</p>
    <p style="color:#4a5568;font-size:14px">Thank you for applying to <strong>${propertyAddress}</strong>. After careful review, we are unable to move forward with your application at this time.</p>
    ${messageBlock(message)}
    <p style="color:#4a5568;font-size:14px">You are welcome to apply for a different available property after 30 days. Please visit our listings at <a href="${getSiteUrl()}" style="color:#2563eb">${getSiteUrl().replace(/^https?:\/\//, '')}</a> to see current availability.</p>
    <p style="color:#4a5568;font-size:14px">We appreciate your interest and hope to work with you in the future. Questions? Call <strong>707-706-3137</strong>.</p>`
  );
}

export function moveinEmailHtml(firstName: string, propertyAddress: string, moveInDate?: string, message?: string) {
  return wrap(
    header('#006aff', 'Move-In Confirmed'),
    `<p style="color:#1a202c;font-size:15px">Dear ${firstName},</p>
    <p style="color:#4a5568;font-size:14px">Your move-in to <strong>${propertyAddress}</strong> has been confirmed.</p>
    ${moveInDate ? `<p style="color:#4a5568;font-size:14px">Move-in Date: <strong>${moveInDate}</strong></p>` : ''}
    ${messageBlock(message)}
    <p style="color:#4a5568;font-size:14px">Questions? Call 707-706-3137.</p>`
  );
}

export function signedConfirmHtml(firstName: string, propertyAddress: string, appId: string) {
  return wrap(
    header('#16a34a', 'Lease Signed Successfully'),
    `<p style="color:#1a202c;font-size:15px">Dear ${firstName},</p>
    <p style="color:#4a5568;font-size:14px">Your lease for <strong>${propertyAddress}</strong> has been signed successfully.</p>
    <p style="color:#718096;font-size:13px">Application ID: <strong>${appId}</strong></p>
    <p style="color:#4a5568;font-size:14px">Our team will be in touch about your move-in. Questions? Call 707-706-3137.</p>`
  );
}

export function applicationConfirmationHtml(firstName: string, propertyAddress: string, appId: string) {
  return wrap(
    header('#006aff', 'Application Received'),
    `<p style="color:#1a202c;font-size:15px">Dear ${firstName},</p>
    <p style="color:#4a5568;font-size:14px">We have received your rental application for <strong>${propertyAddress}</strong>. Our team will review it and be in touch within 1&ndash;2 business days.</p>
    <div style="background:#fff;padding:16px;border-radius:8px;border:1px solid #e2e8f0;margin:20px 0">
      <p style="margin:0;color:#4a5568;font-size:13px">Your Application Reference ID:</p>
      <p style="margin:6px 0 0;color:#006aff;font-size:20px;font-weight:700;letter-spacing:1px">${appId}</p>
    </div>
    <p style="color:#4a5568;font-size:14px">Save this reference number &mdash; you may need it if you contact us about your application.</p>
    <p style="color:#4a5568;font-size:14px">Questions? Call or text <strong>707-706-3137</strong> or email <strong>${getContactEmail()}</strong></p>`
  );
}

export function adminNotificationHtml(firstName: string, lastName: string, email: string, propertyAddress: string, appId: string) {
  return wrap(
    header('#1a202c', 'New Application Received'),
    `<table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:8px 0;color:#718096;width:160px">Application ID</td><td style="padding:8px 0;font-weight:700;color:#006aff">${appId}</td></tr>
      <tr><td style="padding:8px 0;color:#718096">Applicant</td><td style="padding:8px 0;font-weight:600;color:#1a202c">${firstName} ${lastName}</td></tr>
      <tr><td style="padding:8px 0;color:#718096">Email</td><td style="padding:8px 0;color:#4a5568">${email}</td></tr>
      <tr><td style="padding:8px 0;color:#718096">Property</td><td style="padding:8px 0;color:#4a5568">${propertyAddress}</td></tr>
    </table>
    <div style="margin-top:20px">
      <a href="${getAdminUrl('/admin/applications.html')}" style="display:inline-block;padding:12px 24px;background:#006aff;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px">View in Admin Panel &rarr;</a>
    </div>`
  );
}

// ─── New templates (Phase 1) ──────────────────────────────────────────────────

export function holdingFeeRequestHtml(firstName: string, propertyAddress: string, feeAmount?: number | string, dueDate?: string, message?: string) {
  const amountLine = feeAmount != null ? `<p style="color:#4a5568;font-size:14px">Holding Fee Amount: <strong>${formatMoney(feeAmount)}</strong></p>` : '';
  const dueLine    = dueDate          ? `<p style="color:#4a5568;font-size:14px">Due By: <strong>${formatDate(dueDate)}</strong></p>`              : '';
  return wrap(
    header('#7c3aed', 'Holding Fee Request'),
    `<p style="color:#1a202c;font-size:15px">Dear ${firstName},</p>
    <p style="color:#4a5568;font-size:14px">Your application for <strong>${propertyAddress}</strong> has been conditionally approved. To reserve this unit, please submit your holding fee.</p>
    ${amountLine}${dueLine}
    ${messageBlock(message)}
    <div style="background:#fff;padding:16px;border-radius:8px;border:1px solid #e2e8f0;margin:20px 0">
      <p style="margin:0 0 10px;color:#1a202c;font-size:14px;font-weight:600">Accepted Payment Methods:</p>
      <p style="margin:4px 0;color:#4a5568;font-size:14px">&bull; <strong>Zelle</strong> &mdash; ${getContactEmail()}</p>
      <p style="margin:4px 0;color:#4a5568;font-size:14px">&bull; <strong>Venmo</strong> &mdash; @ChoiceProperties</p>
      <p style="margin:4px 0;color:#4a5568;font-size:14px">&bull; <strong>Cashier's Check</strong> &mdash; payable to Choice Properties, 2265 Livernois Suite 500, Troy MI 48083</p>
    </div>
    <p style="color:#4a5568;font-size:14px">Once received, we will confirm via email and reserve your unit. Questions? Call <strong>707-706-3137</strong>.</p>`
  );
}

export function holdingFeeReceivedHtml(firstName: string, propertyAddress: string, portalUrl: string, message?: string) {
  return wrap(
    header('#16a34a', 'Holding Fee Received &mdash; Unit Reserved'),
    `<p style="color:#1a202c;font-size:15px">Dear ${firstName},</p>
    <p style="color:#4a5568;font-size:14px">We have received your holding fee for <strong>${propertyAddress}</strong>. Your unit is now reserved.</p>
    ${messageBlock(message)}
    <p style="color:#4a5568;font-size:14px">Your next step is to sign your lease. You can track your application status and access your lease in your tenant portal:</p>
    <div style="margin:24px 0;text-align:center">
      <a href="${portalUrl}" style="display:inline-block;padding:14px 32px;background:#16a34a;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">Go to Tenant Portal</a>
    </div>
    <p style="color:#4a5568;font-size:14px">Questions? Call <strong>707-706-3137</strong>.</p>`
  );
}

export function paymentConfirmedHtml(firstName: string, propertyAddress: string, amount?: number | string, method?: string, ref?: string, message?: string) {
  return wrap(
    header('#16a34a', 'Payment Confirmed'),
    `<p style="color:#1a202c;font-size:15px">Dear ${firstName},</p>
    <p style="color:#4a5568;font-size:14px">Your payment for <strong>${propertyAddress}</strong> has been confirmed. Here are your payment details:</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
      ${amount != null ? `<tr><td style="padding:8px 0;color:#718096;width:160px">Amount</td><td style="padding:8px 0;font-weight:600;color:#1a202c">${formatMoney(amount)}</td></tr>` : ''}
      ${method ? `<tr><td style="padding:8px 0;color:#718096">Payment Method</td><td style="padding:8px 0;color:#4a5568">${method}</td></tr>` : ''}
      ${ref    ? `<tr><td style="padding:8px 0;color:#718096">Reference</td><td style="padding:8px 0;color:#4a5568">${ref}</td></tr>`    : ''}
    </table>
    ${messageBlock(message)}
    <p style="color:#4a5568;font-size:14px">Please keep this confirmation for your records. Questions? Call <strong>707-706-3137</strong>.</p>`
  );
}

export function moveInPrepHtml(firstName: string, propertyAddress: string, message?: string) {
  return wrap(
    header('#2563eb', 'Your Move-In Preparation Guide'),
    `<p style="color:#1a202c;font-size:15px">Dear ${firstName},</p>
    <p style="color:#4a5568;font-size:14px">Congratulations on your upcoming move to <strong>${propertyAddress}</strong>! Here's what you need to do before and on move-in day.</p>
    ${messageBlock(message)}
    <div style="background:#fff;padding:16px;border-radius:8px;border:1px solid #e2e8f0;margin:20px 0">
      <p style="margin:0 0 10px;color:#1a202c;font-size:14px;font-weight:600">Before Move-In Day:</p>
      <p style="margin:4px 0;color:#4a5568;font-size:14px">&#10003; Set up utilities (electric, gas, water, internet) in your name</p>
      <p style="margin:4px 0;color:#4a5568;font-size:14px">&#10003; Purchase renter's insurance (required before key handover)</p>
      <p style="margin:4px 0;color:#4a5568;font-size:14px">&#10003; Update your address with USPS at usps.com/move</p>
      <p style="margin:4px 0;color:#4a5568;font-size:14px">&#10003; Confirm your move-in date and time with our office</p>
    </div>
    <div style="background:#fff;padding:16px;border-radius:8px;border:1px solid #e2e8f0;margin:20px 0">
      <p style="margin:0 0 10px;color:#1a202c;font-size:14px;font-weight:600">Bring on Move-In Day:</p>
      <p style="margin:4px 0;color:#4a5568;font-size:14px">&#10003; Government-issued photo ID</p>
      <p style="margin:4px 0;color:#4a5568;font-size:14px">&#10003; Proof of renter's insurance</p>
      <p style="margin:4px 0;color:#4a5568;font-size:14px">&#10003; Completed move-in inspection checklist (will be provided)</p>
      <p style="margin:4px 0;color:#4a5568;font-size:14px">&#10003; Keys and parking pass will be provided at handover</p>
    </div>
    <p style="color:#4a5568;font-size:14px">We look forward to welcoming you! Questions? Call <strong>707-706-3137</strong>.</p>`
  );
}

export function leaseSigningReminderHtml(firstName: string, propertyAddress: string, portalUrl: string, message?: string) {
  return wrap(
    header('#d97706', 'Reminder: Please Sign Your Lease'),
    `<p style="color:#1a202c;font-size:15px">Dear ${firstName},</p>
    <p style="color:#4a5568;font-size:14px">This is a friendly reminder that your lease for <strong>${propertyAddress}</strong> is awaiting your signature.</p>
    ${messageBlock(message)}
    <p style="color:#4a5568;font-size:14px">Please sign as soon as possible to secure your unit. You can access your lease in your tenant portal:</p>
    <div style="margin:24px 0;text-align:center">
      <a href="${portalUrl}" style="display:inline-block;padding:14px 32px;background:#d97706;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">Go to Tenant Portal</a>
    </div>
    <p style="color:#4a5568;font-size:14px">If you have any questions before signing, please call <strong>707-706-3137</strong>.</p>`
  );
}

export function leaseExpiryAlertHtml(firstName: string, propertyAddress: string, leaseEndDate: string, appId: string, tenantEmail: string) {
  return wrap(
    header('#dc2626', 'Lease Expiry Alert'),
    `<p style="color:#1a202c;font-size:15px">Lease Expiry Alert &mdash; Action Required</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
      <tr><td style="padding:8px 0;color:#718096;width:160px">Tenant</td><td style="padding:8px 0;font-weight:600;color:#1a202c">${firstName}</td></tr>
      <tr><td style="padding:8px 0;color:#718096">Tenant Email</td><td style="padding:8px 0;color:#4a5568">${tenantEmail}</td></tr>
      <tr><td style="padding:8px 0;color:#718096">Property</td><td style="padding:8px 0;color:#4a5568">${propertyAddress}</td></tr>
      <tr><td style="padding:8px 0;color:#718096">Application ID</td><td style="padding:8px 0;font-weight:700;color:#dc2626">${appId}</td></tr>
      <tr><td style="padding:8px 0;color:#718096">Lease End Date</td><td style="padding:8px 0;font-weight:600;color:#dc2626">${formatDate(leaseEndDate)}</td></tr>
    </table>
    <div style="margin-top:20px">
      <a href="${getAdminUrl('/admin/applications.html')}" style="display:inline-block;padding:12px 24px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px">View in Admin Panel &rarr;</a>
    </div>`
  );
}

// ─── Phase 4 — Admin review summary (sent internally when holding fee received) ─

export function adminReviewSummaryHtml(firstName: string, lastName: string, email: string, phone: string, propertyAddress: string, appId: string, feeReceived?: number | string) {
  return wrap(
    header('#16a34a', 'Holding Fee Received &mdash; Action Required'),
    `<p style="color:#1a202c;font-size:14px">A holding fee has been received. Please log in to the admin panel and generate the lease document for this applicant.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
      <tr><td style="padding:8px 0;color:#718096;width:160px">Applicant</td><td style="padding:8px 0;font-weight:600;color:#1a202c">${firstName} ${lastName}</td></tr>
      <tr><td style="padding:8px 0;color:#718096">Email</td><td style="padding:8px 0;color:#4a5568">${email}</td></tr>
      <tr><td style="padding:8px 0;color:#718096">Phone</td><td style="padding:8px 0;color:#4a5568">${phone || '&mdash;'}</td></tr>
      <tr><td style="padding:8px 0;color:#718096">Property</td><td style="padding:8px 0;color:#4a5568">${propertyAddress}</td></tr>
      <tr><td style="padding:8px 0;color:#718096">App ID</td><td style="padding:8px 0;font-weight:700;color:#16a34a">${appId}</td></tr>
      ${feeReceived != null ? `<tr><td style="padding:8px 0;color:#718096">Holding Fee</td><td style="padding:8px 0;font-weight:600;color:#1a202c">${formatMoney(feeReceived)}</td></tr>` : ''}
      <tr><td style="padding:8px 0;color:#718096">Received At</td><td style="padding:8px 0;color:#4a5568">${new Date().toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td></tr>
    </table>
    <p style="color:#1a202c;font-size:14px;font-weight:600">Recommended next action: Generate the lease document for this applicant.</p>
    <div style="margin-top:20px">
      <a href="${getAdminUrl('/admin/leases.html')}" style="display:inline-block;padding:12px 24px;background:#16a34a;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px">Go to Lease Pipeline &rarr;</a>
    </div>`
  );
}

// ─── Waitlisted notification ──────────────────────────────────────────────────

export function waitlistedEmailHtml(firstName: string, propertyAddress: string, message?: string) {
  return wrap(
    header('#7c3aed', 'Application Status Update'),
    `<p style="color:#1a202c;font-size:15px">Dear ${firstName},</p>
    <p style="color:#4a5568;font-size:14px">Thank you for your application for <strong>${propertyAddress}</strong>. We have added you to our waitlist for this property.</p>
    ${messageBlock(message)}
    <p style="color:#4a5568;font-size:14px">We will contact you as soon as the property becomes available or a comparable unit opens up. We appreciate your patience.</p>
    <p style="color:#4a5568;font-size:14px">In the meantime, feel free to browse our other available listings:</p>
    <div style="margin:20px 0;text-align:center">
      <a href="${getSiteUrl()}" style="display:inline-block;padding:12px 28px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">View Available Properties</a>
    </div>
    <p style="color:#4a5568;font-size:14px">Questions? Call <strong>707-706-3137</strong>.</p>`
  );
}

// ─── Phase 5 — Lease fully executed (management countersigned) ────────────────

export function leaseFullyExecutedHtml(firstName: string, propertyAddress: string, portalUrl: string) {
  return wrap(
    header('#16a34a', 'Your Lease Has Been Fully Executed'),
    `<p style="color:#1a202c;font-size:15px">Dear ${firstName},</p>
    <p style="color:#4a5568;font-size:14px">Great news! Your lease for <strong>${propertyAddress}</strong> has been fully executed &mdash; both you and management have signed.</p>
    <p style="color:#4a5568;font-size:14px">You can download your fully executed lease from your tenant portal:</p>
    <div style="margin:24px 0;text-align:center">
      <a href="${portalUrl}" style="display:inline-block;padding:14px 32px;background:#16a34a;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">Go to Tenant Portal</a>
    </div>
    <p style="color:#4a5568;font-size:14px">Questions? Call <strong>707-706-3137</strong>.</p>`
  );
}
