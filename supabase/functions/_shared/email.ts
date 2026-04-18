import nodemailer from 'npm:nodemailer@6.9.16';

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

  export function signingEmailHtml(firstName: string, propertyAddress: string, signingUrl: string, appId: string) {
    return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
    <div style="background:#006aff;padding:24px 32px;border-radius:8px 8px 0 0">
      <h1 style="color:#fff;margin:0;font-size:22px">Your Lease is Ready to Sign</h1>
    </div>
    <div style="background:#f8f9fa;padding:28px 32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none">
      <p style="color:#1a202c;font-size:15px">Dear ${firstName},</p>
      <p style="color:#4a5568;font-size:14px">Your lease for <strong>${propertyAddress}</strong> is ready for review and signature.</p>
      <div style="margin:24px 0;text-align:center">
        <a href="${signingUrl}" style="display:inline-block;padding:14px 32px;background:#006aff;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">
          Review &amp; Sign Your Lease
        </a>
      </div>
      <p style="color:#718096;font-size:13px">This link is unique to you and expires in 7 days. Do not share it.</p>
      <p style="color:#718096;font-size:13px">Application ID: <strong>${appId}</strong></p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
      <p style="color:#a0aec0;font-size:12px">Choice Properties · 2265 Livernois Suite 500, Troy MI 48083 · choicepropertyofficial1@gmail.com · 707-706-3137</p>
    </div>
  </div>`;
  }

  export function approvalEmailHtml(firstName: string, propertyAddress: string, message?: string) {
    return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
    <div style="background:#16a34a;padding:24px 32px;border-radius:8px 8px 0 0">
      <h1 style="color:#fff;margin:0;font-size:22px">Application Approved</h1>
    </div>
    <div style="background:#f8f9fa;padding:28px 32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none">
      <p style="color:#1a202c;font-size:15px">Dear ${firstName},</p>
      <p style="color:#4a5568;font-size:14px">Congratulations! Your application for <strong>${propertyAddress}</strong> has been approved.</p>
      ${message ? `<p style="color:#4a5568;font-size:14px;background:#fff;padding:14px;border-radius:6px;border:1px solid #e2e8f0">${message}</p>` : ''}
      <p style="color:#4a5568;font-size:14px">Our team will be in touch shortly regarding your lease agreement. Questions? Call 707-706-3137.</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
      <p style="color:#a0aec0;font-size:12px">Choice Properties · 2265 Livernois Suite 500, Troy MI 48083</p>
    </div>
  </div>`;
  }

  export function denialEmailHtml(firstName: string, propertyAddress: string, message?: string) {
    return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
    <div style="background:#374151;padding:24px 32px;border-radius:8px 8px 0 0">
      <h1 style="color:#fff;margin:0;font-size:22px">Application Status Update</h1>
    </div>
    <div style="background:#f8f9fa;padding:28px 32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none">
      <p style="color:#1a202c;font-size:15px">Dear ${firstName},</p>
      <p style="color:#4a5568;font-size:14px">Thank you for applying to <strong>${propertyAddress}</strong>. After careful review, we are unable to move forward with your application at this time.</p>
      ${message ? `<p style="color:#4a5568;font-size:14px;background:#fff;padding:14px;border-radius:6px;border:1px solid #e2e8f0">${message}</p>` : ''}
      <p style="color:#4a5568;font-size:14px">We appreciate your interest and wish you the best in your search.</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
      <p style="color:#a0aec0;font-size:12px">Choice Properties · 2265 Livernois Suite 500, Troy MI 48083</p>
    </div>
  </div>`;
  }

  export function moveinEmailHtml(firstName: string, propertyAddress: string, moveInDate?: string, message?: string) {
    return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
    <div style="background:#006aff;padding:24px 32px;border-radius:8px 8px 0 0">
      <h1 style="color:#fff;margin:0;font-size:22px">Move-In Confirmed</h1>
    </div>
    <div style="background:#f8f9fa;padding:28px 32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none">
      <p style="color:#1a202c;font-size:15px">Dear ${firstName},</p>
      <p style="color:#4a5568;font-size:14px">Your move-in to <strong>${propertyAddress}</strong> has been confirmed.</p>
      ${moveInDate ? `<p style="color:#4a5568;font-size:14px">Move-in Date: <strong>${moveInDate}</strong></p>` : ''}
      ${message ? `<p style="color:#4a5568;font-size:14px;background:#fff;padding:14px;border-radius:6px;border:1px solid #e2e8f0">${message}</p>` : ''}
      <p style="color:#4a5568;font-size:14px">Questions? Call 707-706-3137.</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
      <p style="color:#a0aec0;font-size:12px">Choice Properties · 2265 Livernois Suite 500, Troy MI 48083</p>
    </div>
  </div>`;
  }

  export function signedConfirmHtml(firstName: string, propertyAddress: string, appId: string) {
    return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
    <div style="background:#16a34a;padding:24px 32px;border-radius:8px 8px 0 0">
      <h1 style="color:#fff;margin:0;font-size:22px">Lease Signed Successfully</h1>
    </div>
    <div style="background:#f8f9fa;padding:28px 32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none">
      <p style="color:#1a202c;font-size:15px">Dear ${firstName},</p>
      <p style="color:#4a5568;font-size:14px">Your lease for <strong>${propertyAddress}</strong> has been signed successfully.</p>
      <p style="color:#718096;font-size:13px">Application ID: <strong>${appId}</strong></p>
      <p style="color:#4a5568;font-size:14px">Our team will be in touch about your move-in. Questions? Call 707-706-3137.</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
      <p style="color:#a0aec0;font-size:12px">Choice Properties · 2265 Livernois Suite 500, Troy MI 48083</p>
    </div>
  </div>`;
  }
  