import { getAdminUrl, getContactEmail, getDirectTenantPortalUrl, getSiteUrl } from './config.ts';

// ─── Utilities ────────────────────────────────────────────────────────────────

export function formatMoney(amount: number | string): string {
  return '$' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function safeFee(val: unknown): string {
  const n = parseFloat(String(val ?? '').replace(/[^0-9.]/g, ''));
  return (!isNaN(n) && n > 0) ? n.toFixed(0) : '—';
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getESignText(state: string): string {
  const map: Record<string, string> = {
    AL: 'Alabama Uniform Electronic Transactions Act',
    AK: 'Alaska Uniform Electronic Transactions Act',
    AZ: 'Arizona Uniform Electronic Transactions Act',
    CA: 'California Uniform Electronic Transactions Act',
    CO: 'Colorado Uniform Electronic Transactions Act',
    FL: 'Florida Electronic Signature Act',
    GA: 'Georgia Electronic Records and Signatures Act',
    IL: 'Illinois Electronic Commerce Security Act',
    MI: 'Michigan Electronic Signature Act (MCL § 450.832 et seq.) and the federal Electronic Signatures in Global and National Commerce Act (E-SIGN)',
    MN: 'Minnesota Uniform Electronic Transactions Act',
    NV: 'Nevada Electronic Transactions Act',
    NJ: 'New Jersey Uniform Electronic Transactions Act',
    NY: 'New York Electronic Signatures and Records Act',
    NC: 'North Carolina Uniform Electronic Transactions Act',
    OH: 'Ohio Uniform Electronic Transactions Act',
    PA: 'Pennsylvania Electronic Transactions Act',
    TX: 'Texas Uniform Electronic Transactions Act',
    WA: 'Washington Uniform Electronic Transactions Act',
    WI: 'Wisconsin Uniform Electronic Transactions Act',
  };
  const law = map[state?.toUpperCase()] || 'applicable state Electronic Transactions Act and the federal E-SIGN Act';
  return law.includes('federal') ? law : `${law} and the federal Electronic Signatures in Global and National Commerce Act (E-SIGN)`;
}

// ─── Shared Layout Constants ───────────────────────────────────────────────────

const EMAIL_BASE_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { margin:0; padding:0; background:#f4f4f4; font-family:Arial,Helvetica,sans-serif; -webkit-font-smoothing:antialiased; color:#1a1a1a; }
  .email-wrapper { max-width:600px; margin:24px auto; background:#ffffff; border:1px solid #e0e0e0; border-radius:4px; overflow:hidden; }
  .email-header { background:#ffffff; padding:32px 40px 24px; border-bottom:3px solid #1a5276; }
  .header-brand { font-size:20px; font-weight:700; color:#1a1a1a; letter-spacing:0.3px; margin-bottom:3px; }
  .header-sub   { font-size:12px; color:#666666; margin-bottom:14px; }
  .header-title { font-size:22px; font-weight:700; color:#1a1a1a; line-height:1.3; margin-bottom:8px; }
  .header-ref   { font-size:12px; color:#888888; font-family:monospace; }
  .status-line { padding:12px 40px; font-size:13px; font-weight:600; border-bottom:1px solid #e8e8e8; }
  .status-pending  { color:#b45309; }
  .status-paid     { color:#166534; }
  .status-approved { color:#166534; }
  .status-denied   { color:#991b1b; }
  .status-lease    { color:#1e40af; }
  .email-body { padding:36px 40px; }
  .greeting   { font-size:16px; font-weight:600; color:#1a1a1a; margin-bottom:16px; }
  .intro-text { font-size:14px; color:#444444; line-height:1.7; margin-bottom:28px; }
  .section { margin-bottom:28px; }
  .section-label { font-size:11px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:#888888; margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid #e8e8e8; }
  .info-table { width:100%; border-collapse:collapse; }
  .info-table tr td { padding:10px 0; font-size:14px; vertical-align:top; border-bottom:1px solid #f0f0f0; }
  .info-table tr:last-child td { border-bottom:none; }
  .info-table td:first-child { width:42%; font-weight:600; color:#555555; padding-right:12px; }
  .info-table td:last-child  { color:#1a1a1a; }
  .callout { border-left:3px solid #1a5276; padding:14px 18px; margin:20px 0; background:#ffffff; }
  .callout.green  { border-color:#166534; }
  .callout.amber  { border-color:#b45309; }
  .callout.red    { border-color:#991b1b; }
  .callout h4 { font-size:13px; font-weight:700; color:#1a1a1a; margin-bottom:6px; }
  .callout p  { font-size:13px; color:#444444; line-height:1.65; }
  .steps-list { list-style:none; margin:0; padding:0; }
  .steps-list li { display:flex; align-items:flex-start; gap:14px; padding:11px 0; border-bottom:1px solid #f0f0f0; font-size:14px; color:#333333; line-height:1.6; }
  .steps-list li:last-child { border-bottom:none; }
  .step-num { flex-shrink:0; width:24px; height:24px; background:#1a5276; color:#ffffff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; }
  .financial-row { display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f0f0f0; font-size:14px; }
  .financial-row:last-child { border-bottom:none; }
  .financial-row .f-label { color:#555555; }
  .financial-row .f-value { font-weight:700; color:#1a1a1a; }
  .cta-wrap { text-align:center; margin:32px 0 24px; }
  .cta-btn  { display:inline-block; background:#1a5276; color:#ffffff !important; text-decoration:none; padding:14px 36px; border-radius:4px; font-size:14px; font-weight:700; letter-spacing:0.5px; }
  .cta-note { font-size:11px; color:#888888; text-align:center; margin-top:8px; word-break:break-all; }
  .contact-row { padding:16px 0; border-top:1px solid #e8e8e8; border-bottom:1px solid #e8e8e8; margin:24px 0; font-size:13px; color:#444444; }
  .email-closing { margin-top:28px; padding-top:20px; border-top:1px solid #e8e8e8; }
  .closing-text { font-size:13px; color:#666666; line-height:1.65; margin-bottom:14px; }
  .sign-off     { font-size:14px; font-weight:700; color:#1a1a1a; margin-bottom:2px; }
  .sign-company { font-size:13px; color:#666666; }
  .email-footer { background:#f8f8f8; border-top:1px solid #e0e0e0; padding:20px 40px; text-align:center; }
  .footer-name    { font-size:13px; font-weight:700; color:#1a1a1a; margin-bottom:4px; }
  .footer-details { font-size:12px; color:#888888; line-height:1.7; }
  .pay-pill { display:inline-block; border:1px solid #cccccc; border-radius:3px; padding:5px 12px; font-size:13px; color:#333333; margin:3px 4px 3px 0; }
  @media only screen and (max-width:600px) {
    .email-body   { padding:24px 20px; }
    .email-header { padding:24px 20px 18px; }
    .email-footer { padding:16px 20px; }
    .status-line  { padding:10px 20px; }
    .cta-btn { padding:13px 24px; }
  }
`;

const POLICY_BASE_URL = 'https://choice-properties-site.pages.dev';

const EMAIL_FOOTER = `
  <div class="email-footer">
    <div class="footer-name">Choice Properties</div>
    <div class="footer-details">
      2265 Livernois, Suite 500 &middot; Troy, MI 48083<br>
      707-706-3137 (Text Only) &middot; choiceproperties404@gmail.com<br>
      Your trust is our standard.
    </div>
    <div class="footer-details" style="margin-top:12px;font-size:11px;line-height:1.6;">
      <a href="${POLICY_BASE_URL}/policies.html" style="color:#666;text-decoration:underline;">Policy Framework</a> &middot;
      <a href="${POLICY_BASE_URL}/terms.html" style="color:#666;text-decoration:underline;">Terms</a> &middot;
      <a href="${POLICY_BASE_URL}/privacy.html" style="color:#666;text-decoration:underline;">Privacy</a> &middot;
      <a href="${POLICY_BASE_URL}/fair-housing.html" style="color:#666;text-decoration:underline;">Fair Housing</a> &middot;
      <a href="${POLICY_BASE_URL}/policy-changelog.html" style="color:#666;text-decoration:underline;">Changelog</a>
    </div>
    <div class="footer-details" style="margin-top:10px;font-size:10px;color:#9aa3af;line-height:1.5;">
      You are receiving this transactional email because you submitted an application or signed a lease through Choice Properties. This is not a marketing message.<br>
      <strong>SMS:</strong> Reply HELP for help, STOP to opt out. Msg &amp; data rates may apply. SMS opt-out does not affect application emails.<br>
      Policy Framework v2.3 &middot; Effective October 28, 2026.
    </div>
  </div>
`;

function buildEmailHeader(title: string, appId?: string): string {
  return `
  <div class="email-header">
    <div class="header-brand">Choice Properties</div>
    <div class="header-sub">Nationwide Rental Marketplace</div>
    <div class="header-title">${escapeHtml(title)}</div>
    ${appId ? `<div class="header-ref">Reference: ${escapeHtml(appId)}</div>` : ''}
  </div>`;
}

const CONTACT_ROW = `<div class="contact-row"><strong>Questions?</strong> &nbsp; Text: 707-706-3137 &nbsp;&middot;&nbsp; choiceproperties404@gmail.com</div>`;

// ─── Template 1: Application Confirmation (Tenant) ────────────────────────────

export interface ApplicationFields {
  'First Name'?: string;
  'Last Name'?: string;
  'Email'?: string;
  'Phone'?: string;
  'Property Address'?: string;
  'Property Name'?: string;
  'Requested Move-in Date'?: string;
  'Desired Lease Term'?: string;
  'Application Fee'?: string | number;
  'Employment Status'?: string;
  'Employer'?: string;
  'Job Title'?: string;
  'Monthly Income'?: string | number;
  'Employment Duration'?: string;
  'Preferred Contact Method'?: string;
  'Preferred Time'?: string;
  'Preferred Time Specific'?: string;
  'SMS Consent'?: 'yes' | 'no' | string;
  'Terms Consent'?: 'yes' | 'no' | string;
  'Consent Timestamp'?: string;
  'Consent Version'?: string;
  [key: string]: unknown;
}

export interface EmailFeeLine {
  name?: string;
  role_label?: string;
  applicant_type?: string;
  submission_method?: string;
  fee?: number;
  standard_fee?: number;
  included_free?: boolean;
  note?: string;
}

export function applicationConfirmationHtml(
  firstName: string,
  propertyAddress: string,
  appId: string,
  fields?: ApplicationFields,
  dashboardLink?: string,
  enforcedFee?: number | null,
  coApplicantConsentInviteSent = false): string {
  const portal = dashboardLink || getDirectTenantPortalUrl(appId, { email: String(fields?.['Email'] || '') });
  const safeFirstName = escapeHtml(firstName);
  const safeLastName = escapeHtml(fields?.['Last Name']);
  const safeAppId = escapeHtml(appId);
  const safePropertyAddress = escapeHtml(propertyAddress || 'To be confirmed');
  const locale = String(fields?.['Preferred Language'] || '').toLowerCase().startsWith('es') ? 'es' : 'en';
  const isEs = locale === 'es';

  const coList = Array.isArray(fields?.['_coApplicantsList'])
    ? (fields!['_coApplicantsList'] as Array<Record<string, unknown>>)
    : [];
  const hasCoApplicant = coList.length > 0 || ['true', 'yes', '1', 'on'].includes(String(fields?.['Has Co-Applicant'] || '').toLowerCase());
  const feeBreakdown = Array.isArray(fields?.['_feeBreakdown'])
    ? (fields!['_feeBreakdown'] as EmailFeeLine[])
    : [];
  const jurisdictionNote = fields?.['_jurisdictionFeeNote'] ? String(fields['_jurisdictionFeeNote']) : '';
  const screenedAdultCount = Number(fields?.['screened_adult_count']) || (1 + coList.length);
  const occupyingAdultCount = Number(fields?.['occupying_adult_count']) || (1 + coList.filter(c => String(c.applicant_type || '').toLowerCase() === 'co_applicant').length);
  const feeNum = enforcedFee != null && enforcedFee >= 0 ? Number(enforcedFee) : (feeBreakdown.length > 0
    ? feeBreakdown.reduce((s, item) => s + Number(item.fee ?? item.standard_fee ?? 0), 0)
    : 50);
  const feeDisplay = `$${feeNum.toFixed(0)}`;

  const householdPaymentMode = String(fields?.['_householdPaymentMode'] || 'centralized') === 'individual' ? 'individual' : 'centralized';
  const initialAmountDue = fields?.['_initialAmountDue'] != null
    ? Number(fields['_initialAmountDue'])
    : (householdPaymentMode === 'individual' && feeNum > 0 ? Math.min(feeNum, Number(feeBreakdown[0]?.fee ?? 50)) : feeNum);
  const initialDisplay = `$${initialAmountDue.toFixed(2)}`;
  const primaryApplicantId = fields?.['_primaryApplicantId'] ? String(fields['_primaryApplicantId']) : '';

  const feeTableHtml = feeBreakdown.length > 0
    ? `<table style="width:100%;border-collapse:collapse;margin:8px 0 10px;border:1px solid #e5e7eb;background:#fafafa;">
        <thead><tr>
          <th style="text-align:left;padding:7px 10px;font-size:11px;text-transform:uppercase;color:#666;border-bottom:1px solid #e5e7eb;">${isEs ? 'Persona / Rol' : 'Member / Role'}</th>
          <th style="text-align:left;padding:7px 10px;font-size:11px;text-transform:uppercase;color:#666;border-bottom:1px solid #e5e7eb;">${isEs ? 'Detalle' : 'Rule'}</th>
          <th style="text-align:right;padding:7px 10px;font-size:11px;text-transform:uppercase;color:#666;border-bottom:1px solid #e5e7eb;">${isEs ? 'Tarifa' : 'Fee'}</th>
        </tr></thead>
        <tbody>
          ${feeBreakdown.map((item) => `<tr>
            <td style="padding:7px 10px;font-size:13px;border-bottom:1px solid #efefef;"><strong>${escapeHtml(item.name || '')}</strong><br><span style="font-size:11px;color:#666;">${escapeHtml(item.role_label || '')}</span></td>
            <td style="padding:7px 10px;font-size:12px;color:#555;border-bottom:1px solid #efefef;">${escapeHtml(item.note || '')}</td>
            <td style="padding:7px 10px;font-size:13px;font-weight:700;text-align:right;border-bottom:1px solid #efefef;">$${Number(item.fee ?? 0).toFixed(2)}</td>
          </tr>`).join('')}
          <tr>
            <td colspan="2" style="padding:8px 10px;font-size:13px;font-weight:700;">${isEs ? 'Total de Tarifa del Hogar' : 'Total Household Screening Fee'}</td>
            <td style="padding:8px 10px;font-size:14px;font-weight:700;text-align:right;">$${feeNum.toFixed(2)}</td>
          </tr>
          ${householdPaymentMode === 'individual' && coList.length > 0 ? `<tr>
            <td colspan="2" style="padding:8px 10px;font-size:13px;font-weight:700;color:#1a5276;">${isEs ? 'Su Parte Individual Ahora (Opción B)' : 'Your Individual Share Due Now (Option B)'}</td>
            <td style="padding:8px 10px;font-size:14px;font-weight:700;text-align:right;color:#1a5276;">${initialDisplay}</td>
          </tr>` : ''}
        </tbody>
      </table>`
    : `<p><strong>${isEs ? `Total de solicitud: ${feeDisplay}` : `Total household fee: ${feeDisplay}`}</strong></p>`;

  const payPortalUrl = `${getSiteUrl()}/apply/pay.html?app_id=${encodeURIComponent(appId)}${householdPaymentMode === 'individual' && primaryApplicantId ? `&applicant_id=${encodeURIComponent(primaryApplicantId)}` : ''}`;

  const pendingMembers = coList.filter(c => String(c.submission_method || '') === 'invited' || c.screening_consent === false);
  const invitedPending = pendingMembers.some(c => String(c.submission_method || '') === 'invited');
  const hasPendingConsent = coList.length > 0
    ? pendingMembers.length > 0
    : (hasCoApplicant || screenedAdultCount > 1);
  const allMethodAAuthorized = coList.length > 0 && !hasPendingConsent;

  const consentNotice = hasPendingConsent
    ? `<div class="callout amber"><h4>${isEs ? 'Acción requerida de participantes adicionales' : 'Additional household member action required'}</h4><p>${
        isEs
          ? (coApplicantConsentInviteSent
              ? (invitedPending
                  ? 'Se envió un enlace privado por correo a cada participante invitado bajo el Método B para que complete su información, suba documentos y autorice la evaluación directamente.'
                  : 'Se envió un enlace privado de autorización de evaluación a cada co-solicitante, garante o co-firmante pendiente.')
              : 'Los correos de autorización están en proceso. La evaluación de los miembros pendientes comenzará cuando completen su enlace privado.')
          : (coApplicantConsentInviteSent
              ? (invitedPending
                  ? 'A private email link was dispatched to each Method B invited member so they can complete their own details, upload documents, and authorize screening directly.'
                  : 'A separate screening authorization link was emailed to each pending co-applicant, guarantor, or co-signer.')
              : 'Additional authorization emails are being processed. Please contact our team if not received; screening for pending members requires completing their link.')
      }${householdPaymentMode === 'individual' && coList.length > 0 ? (isEs ? ' Bajo la Opción B (Pagos Individuales), cada participante adicional también recibirá el enlace para pagar su tarifa de evaluación de $50.00.' : ' Under Option B (Individual Member Payments), each additional member will also receive their $50.00 card payment link.') : ''}</p></div>`
    : (allMethodAAuthorized
        ? `<div class="callout green"><h4>${isEs ? 'Evaluación del hogar autorizada (Método A)' : 'Household Screening Authorized (Method A)'}</h4><p>${
            isEs
              ? 'Usted completó los datos y autorizó directamente la evaluación de sus participantes adicionales bajo el Método A. No se envió enlace privado ni se requiere acción adicional de su parte.'
              : 'You completed all details and authorized screening directly on behalf of your additional household member(s) under Method A. No private link was sent and no separate action is required from them.'
          }</p></div>`
        : '');

  const membersListHtml = coList.length > 0
    ? `<tr><td>${isEs ? 'Participantes adicionales' : 'Additional Members'}</td><td>${coList.map((ca) => {
        const nm = escapeHtml([ca.first_name, ca.last_name].filter(Boolean).join(' ') || '');
        const roleTxt = escapeHtml(ca.role_label || ca.role || 'Co-Applicant');
        const meth = String(ca.submission_method || '') === 'invited'
          ? (isEs ? 'Enlace privado (completa sus datos)' : 'Private invite link (self-completing)')
          : (ca.screening_consent !== false
              ? (isEs ? 'Completado y autorizado por el principal · sin enlace privado' : 'Completed & authorized by primary · no private link needed')
              : (isEs ? 'Datos completados por principal · pendiente autorización' : 'Entered by primary · awaiting consent'));
        return `<div style="margin-bottom:4px;"><strong>${nm}</strong> — ${roleTxt} <span style="font-size:11px;color:#666;">(${meth})</span></div>`;
      }).join('')}</td></tr>`
    : '';

  const paymentDueLabel = (householdPaymentMode === 'individual' && coList.length > 0) ? initialDisplay : feeDisplay;
  const paymentSection = `<div class="section"><div class="section-label">${isEs ? 'Tarifa de Solicitud y Pago' : 'Application Fee &amp; Card Payment'}</div><div class="callout amber"><h4>${isEs ? `Tarifa de Solicitud — ${paymentDueLabel}` : `Application Fee \u2014 ${paymentDueLabel}`}</h4>${feeTableHtml}${jurisdictionNote ? `<p style="font-size:12px;color:#6b7280;margin:6px 0 10px;">${escapeHtml(jurisdictionNote)}</p>` : ''}<p style="margin-bottom:12px;">${
    initialAmountDue === 0
      ? (isEs ? 'Su crédito de solicitud cubrió esta tarifa ($0.00 debido).' : 'Your active reapplication credit waived this application fee ($0.00 due).')
      : (householdPaymentMode === 'individual' && coList.length > 0
          ? (isEs
              ? `Seleccionó la Opción B (Pagos Individuales por Miembro). Complete el pago de su parte (${initialDisplay}) con tarjeta de débito o crédito ahora; los demás miembros pagarán su parte de $50.00 desde su enlace de pago.`
              : `You selected Option B (Individual Member Payments). Complete your individual ${initialDisplay} share now using a supported debit or credit card; other household members will pay their own $50.00 share via their payment link.`)
          : (isEs
              ? `Complete el pago seguro de ${feeDisplay} con tarjeta de débito o crédito en el portal de pago para activar la revisión de su solicitud. Su solicitud no será revisada hasta confirmar el pago.`
              : `Complete your ${feeDisplay} application fee online using a supported debit or credit card to activate review. Application credits are valid for 30 days on participating listings if not approved. Your application will not be reviewed until payment is received and confirmed.`))
  }</p>${initialAmountDue > 0 ? `<div style="margin:12px 0 4px;"><a href="${escapeHtml(payPortalUrl)}" class="cta-btn" style="display:inline-block;">${isEs ? `Pagar ${initialDisplay} con Tarjeta` : `Complete ${paymentDueLabel} Card Payment`}</a></div><div style="font-size:12px;color:#6b7280;">${escapeHtml(payPortalUrl)}</div>` : ''}</div></div>`;

  const step2TextEs = hasPendingConsent
    ? '<strong>Confirmación y Autorizaciones</strong> — Una vez confirmado el pago y completados los enlaces de los participantes invitados, su expediente pasa a revisión.'
    : '<strong>Confirmación y Verificación</strong> — Una vez confirmado el pago, su expediente completo pasa directamente a revisión.';
  const step2TextEn = hasPendingConsent
    ? '<strong>Payment &amp; Member Authorizations</strong> — Once payment is confirmed and any invited member links are completed, your file advances to underwriting review.'
    : '<strong>Payment &amp; Verification</strong> — Once payment is confirmed, your complete file advances directly to underwriting review.';

  const nextSteps = isEs
    ? `<ul class="steps-list"><li><span class="step-num">1</span><span><strong>Pago Seguro con Tarjeta</strong> — Complete la tarifa de evaluación de ${paymentDueLabel} con tarjeta de débito o crédito mediante su enlace de pago directo.</span></li><li><span class="step-num">2</span><span>${step2TextEs}</span></li><li><span class="step-num">3</span><span><strong>Revisión</strong> — Revisamos su solicitud en 24–72 horas tras confirmar pago y consentimientos.</span></li><li><span class="step-num">4</span><span><strong>Decisión</strong> — Recibirá nuestra decisión por correo y, de aprobarse, su contrato de arrendamiento para firma electrónica.</span></li></ul>`
    : `<ul class="steps-list"><li><span class="step-num">1</span><span><strong>Online Card Payment</strong> \u2014 Complete your ${paymentDueLabel} screening fee online using a supported debit or credit card.</span></li><li><span class="step-num">2</span><span>${step2TextEn}</span></li><li><span class="step-num">3</span><span><strong>Application Review</strong> \u2014 Our team will conduct a thorough review within 24\u201372 hours of confirmation.</span></li><li><span class="step-num">4</span><span><strong>Decision Notification</strong> \u2014 You will be notified of our decision via email. If approved, our leasing team will prepare your lease agreement for electronic signature.</span></li></ul>`;

  const agreementFeeLine = isEs
    ? `La tarifa de solicitud de <strong>${feeDisplay} no es reembolsable</strong> una vez confirmado el pago, salvo lo dispuesto en la <a href="${POLICY_BASE_URL}/application-credit-policy.html" style="color:#1a5276;">Política de Crédito de Solicitud</a>.`
    : `The <strong>${feeDisplay} application fee is non-refundable</strong> once payment is confirmed, except as described in the <a href="${POLICY_BASE_URL}/application-credit-policy.html" style="color:#1a5276;">Application Credit Policy</a>. Application credits remain valid for 30 days toward move-in costs.`;

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${isEs ? 'Solicitud Recibida — Choice Properties' : 'Application Received — Choice Properties'}</title>
  <style>${EMAIL_BASE_CSS}</style>
</head>
<body>
<div class="email-wrapper">
  ${buildEmailHeader(isEs ? 'Solicitud Recibida con Éxito' : 'Application Successfully Received', appId)}
  <div class="status-line status-pending">&#x23F3; &nbsp; ${isEs ? 'Esperando Tarifa de Solicitud · Revisión Pendiente' : 'Awaiting Application Fee · Review Pending'}</div>
  <div class="email-body">
    <p class="greeting">${isEs ? `Estimado/a ${safeFirstName}:` : `Dear ${safeFirstName},`}</p>
    <p class="intro-text">${isEs ? 'Gracias por elegir Choice Properties. Hemos recibido con éxito su solicitud de alquiler y su expediente ha sido registrado en nuestro sistema.' : 'Thank you for choosing Choice Properties. We have successfully received your rental application and your file is now in our system. This confirmation serves as your official acknowledgment that your submission has been recorded.'}</p>

    <div class="section">
      <div class="section-label">${isEs ? 'Resumen de la Solicitud' : 'Application Summary'}</div>
      <table class="info-table">
        <tr><td>${isEs ? 'ID de Solicitud' : 'Application ID'}</td><td><strong>${safeAppId}</strong></td></tr>
        <tr><td>${isEs ? 'Solicitante Principal' : 'Primary Applicant'}</td><td>${safeFirstName} ${safeLastName}</td></tr>
        <tr><td>${isEs ? 'Propiedad de Interés' : 'Property of Interest'}</td><td>${safePropertyAddress}</td></tr>
        <tr><td>${isEs ? 'Fecha de Mudanza Solicitada' : 'Requested Move-In'}</td><td>${escapeHtml(fields?.['Requested Move-in Date'] || (isEs ? 'No especificada' : 'Not specified'))}</td></tr>
        <tr><td>${isEs ? 'Plazo del Contrato' : 'Lease Term'}</td><td>${escapeHtml(fields?.['Desired Lease Term'] || (isEs ? 'No especificado' : 'Not specified'))}</td></tr>
        <tr><td>${isEs ? 'Correo en Archivo' : 'Email on File'}</td><td>${escapeHtml(fields?.['Email'] || '')}</td></tr>
        <tr><td>${isEs ? 'Teléfono en Archivo' : 'Phone on File'}</td><td>${escapeHtml(fields?.['Phone'] || '')}</td></tr>
        <tr><td>${isEs ? 'Adultos Ocupantes' : 'Occupying Adults'}</td><td>${occupyingAdultCount}</td></tr>
        ${membersListHtml}
        <tr><td>${isEs ? 'Total Tarifa de Evaluación' : 'Total Application Fee'}</td><td><strong>${feeDisplay}</strong></td></tr>
        ${(() => { const dc = fields ? Object.keys(fields).filter(k => k.startsWith('_docFile_') && k.endsWith('_name')).length : 0; return dc > 0 ? `<tr><td>${isEs ? 'Documentos Adjuntos' : 'Documents Submitted'}</td><td><strong>${dc} ${isEs ? 'archivo(s) adjunto(s)' : `file${dc > 1 ? 's' : ''} attached`}</strong></td></tr>` : ''; })()}
      </table>
    </div>

    ${paymentSection}
    ${consentNotice}

    <div class="section">
      <div class="section-label">${isEs ? 'Qué Sigue' : 'What Happens Next'}</div>
      ${nextSteps}
    </div>

    <div class="callout">
      <h4>${isEs ? 'Importante — Guarde su ID de Solicitud' : 'Important — Save Your Application ID'}</h4>
      <p>${isEs ? `Su ID es <strong>${safeAppId}</strong>. Úselo para dar seguimiento a su solicitud en su portal de inquilino.` : `Your application ID is <strong>${safeAppId}</strong>. Please save this reference number to track your application status and access your tenant portal at any time.`}</p>
    </div>

    <div class="cta-wrap">
      <a href="${escapeHtml(portal)}" class="cta-btn">${isEs ? 'Seguir Mi Solicitud' : 'Track My Application'}</a>
      <div class="cta-note">${isEs ? 'O visite:' : 'Or visit:'} ${escapeHtml(portal)}</div>
    </div>

    <div class="section">
      <div class="section-label">${isEs ? 'Acuerdo Registrado' : 'Your Agreement on Record'}</div>
      <p style="font-size:13px;color:#555;line-height:1.65;">${
        isEs
          ? `Al enviar esta solicitud aceptó los <a href="${POLICY_BASE_URL}/terms.html" style="color:#1a5276;">Términos de Servicio</a>, la <a href="${POLICY_BASE_URL}/privacy.html" style="color:#1a5276;">Política de Privacidad</a> y el <a href="${POLICY_BASE_URL}/policies.html" style="color:#1a5276;">Marco de Políticas</a>. ${agreementFeeLine}`
          : `When you submitted this application you agreed to the <a href="${POLICY_BASE_URL}/terms.html" style="color:#1a5276;">Terms of Service</a> (Sections 18–19), the <a href="${POLICY_BASE_URL}/privacy.html" style="color:#1a5276;">Privacy Policy</a>, and the <a href="${POLICY_BASE_URL}/policies.html" style="color:#1a5276;">Complete Policy &amp; Legal Framework</a> (v2.3). ${agreementFeeLine}`
      }</p>
    </div>

    ${CONTACT_ROW}

    <div class="email-closing">
      <p class="closing-text">${isEs ? 'Gracias por confiar en Choice Properties.' : 'Should you have any questions prior to hearing from our team, please do not hesitate to reach out.'}</p>
      <div class="sign-off">Choice Properties Leasing Team</div>
      <div class="sign-company">choiceproperties404@gmail.com</div>
    </div>
  </div>
  ${EMAIL_FOOTER}
</div>
</body>
</html>`;
}

export function coApplicantScreeningConsentHtml(
  firstName: string,
  appId: string,
  consentLink: string,
  opts?: {
    applicantType?: string;
    roleLabel?: string;
    submissionMethod?: string;
    primaryName?: string;
    propertyAddress?: string;
    locale?: 'en' | 'es';
    householdPaymentMode?: 'centralized' | 'individual' | string;
    individualFee?: number;
    payUrl?: string;
  }): string {
  const safeFirstName = escapeHtml(firstName);
  const safeAppId = escapeHtml(appId);
  const safeLink = escapeHtml(consentLink);
  const isEs = opts?.locale === 'es';
  const appType = String(opts?.applicantType || '').toLowerCase();
  const isInvited = opts?.submissionMethod === 'invited';
  const isGuarantor = appType === 'guarantor';
  const isCoSigner = appType === 'co_signer';
  const isIndividualPay = String(opts?.householdPaymentMode || 'centralized') === 'individual' && Number(opts?.individualFee ?? 50) > 0;
  const individualFeeDisplay = `$${Number(opts?.individualFee ?? 50).toFixed(2)}`;
  const roleName = escapeHtml(
    opts?.roleLabel ||
      (isGuarantor
        ? (isEs ? 'Garante (Apoyo Financiero No Ocupante)' : 'Guarantor (Non-Occupying Financial Support)')
        : isCoSigner
          ? (isEs ? 'Co-Firmante' : 'Co-Signer')
          : (isEs ? 'Co-Solicitante (Ocupante)' : 'Co-Applicant (Occupying Adult)'))
  );
  const primaryText = opts?.primaryName ? ` by <strong>${escapeHtml(opts.primaryName)}</strong>` : '';
  const propText = opts?.propertyAddress ? ` for <strong>${escapeHtml(opts.propertyAddress)}</strong>` : '';
  const headerTitle = isEs
    ? (isInvited ? 'Complete sus datos y autorice su evaluación' : 'Se requiere su autorización de evaluación')
    : (isInvited ? 'Complete your details & authorize screening' : 'Your separate screening authorization is needed');
  const intro = isEs
    ? `Usted fue incluido/a como <strong>${roleName}</strong> en la solicitud de alquiler ${safeAppId} en Choice Properties${opts?.propertyAddress ? ` para <strong>${escapeHtml(opts.propertyAddress)}</strong>` : ''}. ${isInvited ? 'El solicitante principal eligió enviarle este enlace privado para que complete directamente su información confidencial, adjunte sus documentos y autorice la evaluación.' : 'Antes de iniciar cualquier evaluación sobre usted, debe revisar y enviar personalmente su propia autorización.'}`
    : `You were listed as a <strong>${roleName}</strong> on Choice Properties rental application <strong>${safeAppId}</strong>${primaryText}${propText}. ${isInvited ? 'The primary applicant selected Method B so you can privately complete your remaining details, upload supporting documents, and submit your screening authorization directly.' : 'Before any screening of you can begin, you must personally review and submit your own authorization.'}`;
  const authCalloutTitle = isEs ? 'Lo que autoriza y completa' : (isInvited ? 'What you will complete & authorize' : 'What you are authorizing');
  const authCalloutBody = isEs
    ? (isGuarantor
        ? 'Como garante no ocupante, solo recopilaremos sus datos de contacto, residencia actual, situación de vivienda e ingresos para evaluar su capacidad de respaldo financiero — nunca se le harán preguntas de ocupación de inquilino — junto con su autorización FCRA.'
        : 'Autoriza a Choice Properties y sus proveedores de verificación a comprobar empleo, ingresos, historial y reportes de crédito/antecedentes según la ley aplicable.')
    : (isGuarantor
        ? 'As a non-occupying guarantor, you will confirm your residential housing status and financial support details (without unrelated tenant-occupancy questions) and authorize Choice Properties and its consumer reporting providers to verify financial qualification.'
        : 'You authorize Choice Properties and its designated verification providers to verify employment, income, rental history, and references, and to request consumer reports where applicable under the Fair Credit Reporting Act (FCRA).');
  const ctaLabel = isEs
    ? (isInvited ? 'Completar Datos y Autorizar Evaluación' : 'Revisar y Autorizar Evaluación')
    : (isInvited ? 'Complete Details & Authorize Screening' : 'Review and Authorize Screening');

  const paymentDisclosure = isIndividualPay
    ? `<div class="callout amber"><h4>${isEs ? `Su tarifa individual de evaluación: ${individualFeeDisplay}` : `Your Individual Screening Fee: ${individualFeeDisplay}`}</h4><p>${
        isEs
          ? `Esta solicitud utiliza la Opción B (Pagos Individuales por Miembro). Después de enviar su autorización en el enlace anterior, se le dirigirá automáticamente al pago seguro con tarjeta por su parte de <strong>${individualFeeDisplay}</strong>.`
          : `This household selected Option B (Individual Member Payments). After submitting your authorization above, you will be directed to our secure card checkout to complete your <strong>${individualFeeDisplay}</strong> individual screening fee.`
      }</p>${opts?.payUrl ? `<p style="margin-top:6px;font-size:12px;">${isEs ? 'Enlace directo de pago:' : 'Direct payment link:'} <a href="${escapeHtml(opts.payUrl)}" style="color:#1a5276;">${escapeHtml(opts.payUrl)}</a></p>` : ''}</div>`
    : '';

  const linkNote = isIndividualPay
    ? (isEs
        ? `Este enlace privado es exclusivo para usted, vence en 7 días y no crea una solicitud duplicada. Su tarifa individual de evaluación es de <strong>${individualFeeDisplay}</strong>.`
        : `This private link is unique to you, expires in 7 days, and creates no duplicate application record. Your individual screening fee is <strong>${individualFeeDisplay}</strong>.`)
    : (isEs
        ? 'Este enlace privado es exclusivo para usted, vence en 7 días y es de un solo uso. El solicitante principal gestionó el pago de evaluación para su grupo.'
        : 'This private link is unique to you, expires in 7 days, and creates no duplicate application record. Your screening fee is covered under the primary applicant\'s centralized household payment.');

  return `<!DOCTYPE html>
<html lang="${isEs ? 'es' : 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(headerTitle)} — Choice Properties</title>
  <style>${EMAIL_BASE_CSS}</style>
</head>
<body>
<div class="email-wrapper">
  ${buildEmailHeader(headerTitle, appId)}
  <div class="email-body">
    <p class="greeting">${isEs ? `Estimado/a ${safeFirstName}:` : `Dear ${safeFirstName},`}</p>
    <p class="intro-text">${intro}</p>
    <div class="callout amber">
      <h4>${authCalloutTitle}</h4>
      <p>${authCalloutBody}</p>
    </div>
    ${paymentDisclosure}
    <p class="intro-text">${linkNote}</p>
    <div class="cta-wrap">
      <a href="${safeLink}" class="cta-btn">${ctaLabel}</a>
      <p class="cta-note">${isEs ? 'Si el botón no funciona, copie y pegue este enlace seguro:' : 'If the button does not work, copy and paste this secure link:'} ${safeLink}</p>
    </div>
    <p class="cta-note">${isEs ? 'Referencia:' : 'Application reference:'} ${safeAppId}</p>
    ${CONTACT_ROW}
  </div>
  ${EMAIL_FOOTER}
</div>
</body>
</html>`;
}

// ─── Template 2: Admin Notification ───────────────────────────────────────────

export function adminNotificationHtml(
  firstName: string,
  lastName: string,
  email: string,
  propertyAddress: string,
  appId: string,
  fields?: ApplicationFields,
  enforcedFee?: number | null): string {
  const adminUrl = getAdminUrl();
  const safeAdminUrl = escapeHtml(adminUrl);
  const safeFirstName = escapeHtml(firstName);
  const safeLastName = escapeHtml(lastName);
  const safeEmail = escapeHtml(email);
  const safeAppId = escapeHtml(appId);
  const safePropertyAddress = escapeHtml(propertyAddress || 'Not specified');
  const coListRaw = fields?.['_coApplicantsList'];
  const coList = Array.isArray(coListRaw) ? coListRaw as Array<Record<string, unknown>> : [];
  const hasCoApplicant = coList.length > 0 || ['true', 'yes', '1', 'on'].includes(String(fields?.['Has Co-Applicant'] || '').toLowerCase());
  const feeBreakdown = Array.isArray(fields?.['_feeBreakdown'])
    ? (fields!['_feeBreakdown'] as EmailFeeLine[])
    : [];
  const financials = (fields?.['_financials'] && typeof fields['_financials'] === 'object')
    ? (fields['_financials'] as Record<string, unknown>)
    : null;
  const screenedAdultCount = Number(fields?.['screened_adult_count']) || (1 + coList.length);
  const occupyingAdultCount = Number(financials?.occupyingAdultCount ?? fields?.['occupying_adult_count']) || 1;
  const feeNum = enforcedFee != null && enforcedFee >= 0 ? Number(enforcedFee) : 50;
  const feeDisplay = `$${feeNum.toFixed(2)}`;
  const feeSummaryText = feeBreakdown.length > 0
    ? feeBreakdown.map(f => `${escapeHtml(f.role_label || f.name || '')}: $${Number(f.fee ?? 0).toFixed(0)}`).join(' + ') + ` = ${feeDisplay}`
    : `${screenedAdultCount} participant(s) · ${feeDisplay} total`;

  const payPortalUrl = `${getSiteUrl()}/apply/pay.html?app_id=${encodeURIComponent(appId)}`;
  const adminPaymentSection = `<div class="section"><div class="section-label" style="color:#1d4ed8;">💳 Card Payment Status</div><div class="callout amber"><h4>Application Fee: ${feeDisplay} — ${feeNum === 0 ? 'Waived by Credit' : 'Awaiting Online Card Payment'}</h4><p><strong>${feeSummaryText}</strong></p><p style="font-size:12px;color:#475569;margin-top:8px;">${feeNum === 0 ? 'Fee covered by an active reapplication credit ($0.00 due).' : `The applicant was automatically directed to the online card payment portal (<a href="${escapeHtml(payPortalUrl)}" style="color:#1d4ed8;">${escapeHtml(payPortalUrl)}</a>). Payment status updates automatically in Admin &rarr; Applications when completed or if assistance is requested.`}</p></div></div>`;

  const householdIncome = financials?.householdMonthlyIncome ?? fields?.['_combinedMonthlyIncome'];
  const guarantorSupport = Number(financials?.guarantorMonthlyIncome || 0);
  const coSignerSupport = Number(financials?.coSignerMonthlyIncome || 0);
  const totalSupport = Number(financials?.totalFinancialSupport || 0);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>New Application — ${safeAppId}</title>
  <style>${EMAIL_BASE_CSS}</style>
</head>
<body>
<div class="email-wrapper">
  ${buildEmailHeader('New Application Received', appId)}
  <div class="status-line status-pending">&#x26A1; &nbsp; ${feeNum === 0 ? 'Fee Waived by Credit — Ready for Review' : 'Awaiting Card Payment — Automatic Checkout Presented'}</div>
  <div class="email-body">
    <p class="greeting">New Application Alert,</p>
    <p class="intro-text">A new rental application has been submitted. ${feeNum === 0 ? 'Reapplication credit covered the screening fee.' : 'The applicant has been directed to the online card payment portal. Track live payment status, failed attempts, or assistance requests inside Admin &rarr; Applications.'}</p>

    ${adminPaymentSection}

    <div class="section">
      <div class="section-label">Applicant Overview</div>
      <table class="info-table">
        <tr><td>Full Name</td><td><strong>${safeFirstName} ${safeLastName}</strong></td></tr>
        <tr><td>Email</td><td>${safeEmail}</td></tr>
        <tr><td>Phone</td><td><strong>${escapeHtml(fields?.['Phone'] || 'Not provided')}</strong> (Text preferred)</td></tr>
        <tr><td>Property Requested</td><td>${safePropertyAddress}</td></tr>
        <tr><td>Requested Move-In</td><td>${escapeHtml(fields?.['Requested Move-in Date'] || 'Not specified')}</td></tr>
        <tr><td>Lease Term</td><td>${escapeHtml(fields?.['Desired Lease Term'] || 'Not specified')}</td></tr>
        <tr><td>Occupying Adults</td><td><strong>${occupyingAdultCount}</strong> (Excludes guarantors &amp; co-signers)</td></tr>
        <tr><td>Screened Individuals</td><td>${screenedAdultCount}</td></tr>
        ${coList.length > 0 ? coList.map((ca, idx) => {
          const nm = escapeHtml([ca.first_name, ca.last_name].filter(Boolean).join(' ') || `Additional Person #${idx + 1}`);
          const rl = escapeHtml(ca.role_label || ca.role || 'Co-Applicant');
          const em = ca.email ? ` &mdash; ${escapeHtml(ca.email)}` : '';
          const meth = String(ca.submission_method || '') === 'invited'
            ? 'Method B: Private invite link sent to complete details &amp; consent'
            : (ca.screening_consent !== false
                ? 'Method A: Completed &amp; screening authorized by primary applicant (no private link needed)'
                : 'Method A: Primary completed details; private screening consent link sent');
          return `<tr><td>Member #${idx + 2} (${rl})</td><td><strong style="color:#7c3aed;">&#x1F465; ${nm}</strong>${em}<br><span style="font-size:12px;color:#555;">${meth}</span></td></tr>`;
        }).join('') : (hasCoApplicant ? `<tr><td>Additional Member</td><td><strong style="color:#7c3aed;">${escapeHtml([fields?.['Co-Applicant First Name'], fields?.['Co-Applicant Last Name']].filter(Boolean).join(' ') || 'Yes')}</strong></td></tr>` : '')}
        <tr><td>Itemized Fee</td><td>${feeSummaryText}</td></tr>
        ${householdIncome ? `<tr><td>Household Occupant Income</td><td><strong>$${Number(householdIncome).toLocaleString()}</strong>/mo <span style="font-size:11px;color:#666;">(Occupants only)</span></td></tr>` : ''}
        ${guarantorSupport > 0 ? `<tr><td>Guarantor Support (Separate)</td><td><strong>$${guarantorSupport.toLocaleString()}</strong>/mo</td></tr>` : ''}
        ${coSignerSupport > 0 ? `<tr><td>Co-Signer Support (Separate)</td><td><strong>$${coSignerSupport.toLocaleString()}</strong>/mo</td></tr>` : ''}
        ${totalSupport > 0 && (guarantorSupport > 0 || coSignerSupport > 0) ? `<tr><td>Total Financial Support Available</td><td><strong>$${totalSupport.toLocaleString()}</strong>/mo</td></tr>` : ''}
        ${(() => { const docCount = fields ? Object.keys(fields).filter(k => k.startsWith('_docFile_') && k.endsWith('_name')).length : 0; return docCount > 0 ? `<tr><td>Documents Attached</td><td><strong style="color:#059669;">&#x1F4CE; ${docCount} file${docCount > 1 ? 's' : ''} — view in admin portal</strong></td></tr>` : ''; })()}
      </table>
    </div>

    ${fields?.['Employment Status'] ? `
    <div class="section">
      <div class="section-label">Employment &amp; Income</div>
      <table class="info-table">
        <tr><td>Employment Status</td><td>${escapeHtml(fields?.['Employment Status'] || 'Not specified')}</td></tr>
        <tr><td>Employer</td><td>${escapeHtml(fields?.['Employer'] || 'N/A')}</td></tr>
        <tr><td>Job Title</td><td>${escapeHtml(fields?.['Job Title'] || 'N/A')}</td></tr>
        <tr><td>Monthly Income</td><td>${fields?.['Monthly Income'] ? '$' + Number(fields['Monthly Income']).toLocaleString() : 'Not specified'}</td></tr>
        <tr><td>Employment Duration</td><td>${escapeHtml(fields?.['Employment Duration'] || 'N/A')}</td></tr>
      </table>
    </div>
    ` : ''}

    ${(String(fields?.['Ever Evicted']).toLowerCase() === 'true' || String(fields?.['Has Criminal History']).toLowerCase() === 'true' || String(fields?.['Has Bankruptcy']).toLowerCase() === 'true' || (String(fields?.['Has Pets']).toLowerCase() === 'true') || String(fields?.['Smoker']).toLowerCase() === 'true') ? `
    <div class="section">
      <div class="section-label">Application Flags — Review Required</div>
      <div class="callout red">
        <h4>&#x26A0; Disclosed Items</h4>
        <p>
          ${String(fields?.['Ever Evicted']).toLowerCase() === 'true' ? '<strong>Prior Eviction:</strong> Applicant disclosed a prior eviction record.<br>' : ''}
          ${String(fields?.['Has Criminal History']).toLowerCase() === 'true' ? '<strong>Criminal History:</strong> Applicant disclosed criminal history.<br>' : ''}
          ${String(fields?.['Has Bankruptcy']).toLowerCase() === 'true' ? '<strong>Bankruptcy:</strong> Applicant disclosed prior bankruptcy.<br>' : ''}
          ${String(fields?.['Has Pets']).toLowerCase() === 'true' ? `<strong>Pets:</strong> ${fields?.['Pet Details'] || 'Has pets — verify property pet policy.'}<br>` : ''}
          ${String(fields?.['Smoker']).toLowerCase() === 'true' ? '<strong>Smoker:</strong> Applicant disclosed smoking — verify property policy.<br>' : ''}
        </p>
      </div>
    </div>
    ` : ''}

    <div class="section">
      <div class="section-label">Quick Actions</div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:4px;">
        <a href="${safeAdminUrl}" style="display:inline-block;background:#0a1628;color:white;text-decoration:none;padding:11px 22px;border-radius:3px;font-size:13px;font-weight:600;">Admin Dashboard</a>
        <a href="mailto:${encodeURIComponent(email)}?subject=Your%20Application%20${encodeURIComponent(appId)}%20-%20Choice%20Properties" style="display:inline-block;background:#1d4ed8;color:white;text-decoration:none;padding:11px 22px;border-radius:3px;font-size:13px;font-weight:600;">Email Applicant</a>
        ${fields?.['Phone'] ? `<a href="sms:${encodeURIComponent(fields['Phone'].toString().replace(/\D/g,''))}?body=Hi%20${encodeURIComponent(firstName)}%2C%20this%20is%20Choice%20Properties%20regarding%20your%20application%20${encodeURIComponent(appId)}" style="display:inline-block;background:#059669;color:white;text-decoration:none;padding:11px 22px;border-radius:3px;font-size:13px;font-weight:600;">Text Applicant</a>` : ''}
      </div>
    </div>

    <div class="email-closing">
      <div class="sign-off">Choice Properties System</div>
      <div class="sign-company">Automated Admin Notification &mdash; ${safeAppId}</div>
    </div>
  </div>
  ${EMAIL_FOOTER}
</div>
</body>
</html>`;
}

// ─── Template 3: Status Update (Approved / Denied / Waitlisted) ───────────────

export function statusUpdateHtml(
  appId: string,
  firstName: string,
  status: 'approved' | 'denied' | 'waitlisted' | 'under_review' | 'additional_info_required',
  reason: string | undefined,
  dashboardLink: string,
  propertyAddress: string,
  propertyName?: string,
  propertyState?: string): string {
  const portal = dashboardLink || getDirectTenantPortalUrl(appId);
  const isApproved = status === 'approved';
  const isWaitlisted = status === 'waitlisted';
  const isUnderReview = status === 'under_review';
  const isInfoRequired = status === 'additional_info_required';
  const propertyLabel = propertyName || propertyAddress;
  const safeFirstName = escapeHtml(firstName);
  const safePropertyLabel = escapeHtml(propertyLabel);
  const safeReason = escapeHtml(reason);
  const safePortal = escapeHtml(portal);
  const eSignText = getESignText(propertyState || 'MI');

  const pageTitle = isApproved
    ? 'Application Approved'
    : isWaitlisted
      ? 'You\'ve Been Waitlisted'
      : isUnderReview
        ? 'Application Under Review'
        : isInfoRequired
          ? 'Additional Information Required'
          : 'Application Update';

  const bannerClass = isApproved
    ? 'status-approved'
    : (isWaitlisted || isUnderReview)
      ? 'status-lease'
      : isInfoRequired
        ? 'status-pending'
        : 'status-denied';

  const bannerText = isApproved
    ? '&#x2713; &nbsp; Congratulations — Your Application Has Been Approved'
    : isWaitlisted
      ? '&#x23F3; &nbsp; You Have Been Added to the Waitlist'
      : isUnderReview
        ? '&#x1F50D; &nbsp; Your Application Is Now Under Review'
        : isInfoRequired
          ? '&#x26A0; &nbsp; Action Requested — Additional Information Required'
          : '&mdash; &nbsp; Application Decision: Not Approved';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${pageTitle} — Choice Properties</title>
  <style>${EMAIL_BASE_CSS}</style>
</head>
<body>
<div class="email-wrapper">
  ${buildEmailHeader(pageTitle, appId)}
  <div class="status-line ${bannerClass}">
    ${bannerText}
  </div>
  <div class="email-body">
    <p class="greeting">Dear ${safeFirstName},</p>
    ${propertyLabel ? `<p style="font-size:13px;color:#64748b;margin:-4px 0 16px;">Property: <strong>${safePropertyLabel}</strong></p>` : ''}

    ${isApproved ? `
    <p class="intro-text">We are delighted to inform you that your rental application with Choice Properties has been <strong>approved</strong>. This decision reflects our confidence in your application, and we look forward to welcoming you as a resident.</p>
    <div class="callout green">
      <h4>&#x2713; Application Approved</h4>
      <p>Your application has met all of our criteria. Our leasing team will be in contact with you shortly to prepare and deliver your lease agreement for electronic signature. Please ensure your phone and email remain accessible.</p>
    </div>
    <div class="section">
      <div class="section-label">Your Next Steps</div>
      <ul class="steps-list">
        <li><span class="step-num">1</span><span><strong>Lease Agreement</strong> — Our team will prepare a formal lease agreement and send it to you shortly. Please review it carefully in its entirety before signing.</span></li>
        <li><span class="step-num">2</span><span><strong>Electronic Signature</strong> — You will sign your lease electronically. Your signature is legally binding under the ${eSignText}.</span></li>
        <li><span class="step-num">3</span><span><strong>Move-In Costs</strong> — Prior to receiving your keys, the move-in total (first month's rent plus security deposit) must be paid in full. This will be clearly outlined in your lease.</span></li>
        <li><span class="step-num">4</span><span><strong>Key Handoff</strong> — Once all documents and payments are complete, our team will coordinate your move-in date.</span></li>
      </ul>
    </div>
    <div class="callout amber">
      <h4>Important — Please Respond Promptly</h4>
      <p>Approval qualifies you to move forward, but the unit is not yet held in your name. Units are secured on a <strong>first-completion basis</strong> among approved applicants — the next steps (holding fee, then lease signing within 48 hours) are what formally remove this property from the market. Delays may result in the unit being awarded to another approved applicant.</p>
    </div>

    <div class="callout">
      <h4>Why We Move Quickly at This Stage</h4>
      <p style="font-size:13px;color:#555;line-height:1.65;">Approved listings often have multiple qualified applicants. Moving promptly through the holding-fee and signing steps is how we make sure the right unit is secured for the right resident — without leaving anyone in limbo. Our team is available throughout to answer questions before you commit.</p>
    </div>
    ` : isUnderReview ? `
    <p class="intro-text">Your rental application for <strong>${safePropertyLabel}</strong> is actively <strong>Under Review</strong> by our leasing and underwriting team.</p>
    <div class="callout" style="border-color:#1e40af;">
      <h4>&#x1F50D; Application Under Review</h4>
      <p>${safeReason || 'We are verifying your submitted application details, income documentation, and rental history. Typical review takes 24–48 hours.'}</p>
    </div>
    <div class="section">
      <div class="section-label">What Happens Next</div>
      <ul class="steps-list">
        <li><span class="step-num">1</span><span><strong>Verification Checks</strong> — Our team reviews employment, income, references, and household screening consents.</span></li>
        <li><span class="step-num">2</span><span><strong>Track Progress Anytime</strong> — Check your live status updates inside your Applicant Portal.</span></li>
      </ul>
    </div>
    ` : isInfoRequired ? `
    <p class="intro-text">Our leasing team reviewed your application for <strong>${safePropertyLabel}</strong> and needs a bit of <strong>additional information</strong> before completing underwriting.</p>
    <div class="callout amber">
      <h4>&#x26A0; Requested Information</h4>
      <p>${safeReason ? safeReason : 'Please upload the requested supporting verification documents (such as recent paystubs, ID verification, or income proof) in your Applicant Portal.'}</p>
    </div>
    <div class="section">
      <div class="section-label">How to Respond</div>
      <ul class="steps-list">
        <li><span class="step-num">1</span><span><strong>Open Your Applicant Portal</strong> — Use the button below to access your application directly.</span></li>
        <li><span class="step-num">2</span><span><strong>Upload Requested Documents</strong> — Submit any requested paystubs, IDs, or supporting documents securely in the Document Upload section.</span></li>
        <li><span class="step-num">3</span><span><strong>Prompt Review</strong> — Once uploaded, our team is automatically notified to resume your review immediately.</span></li>
      </ul>
    </div>
    ` : isWaitlisted ? `
    <p class="intro-text">Thank you for your application for <strong>${safePropertyLabel}</strong>. We have reviewed your application and have added you to our active waitlist for this property.</p>
    <div class="callout" style="border-color:#1e40af;">
      <h4>&#x23F3; You Are on the Active Waitlist</h4>
      <p>${safeReason || 'Your application is complete and has been placed in our priority waitlist queue. We will contact you as soon as a unit becomes available or a comparable property opens up.'}</p>
    </div>
    <div class="section">
      <div class="section-label">What This Means</div>
      <ul class="steps-list">
        <li><span class="step-num">1</span><span><strong>Active Monitoring</strong> — Your application remains active in our system. We review the waitlist regularly and contact applicants as availability changes.</span></li>
        <li><span class="step-num">2</span><span><strong>Other Properties</strong> — You are encouraged to browse our current listings. If you see another property that interests you, contact us to discuss your application.</span></li>
        <li><span class="step-num">3</span><span><strong>Stay Reachable</strong> — Please keep your phone and email accessible. When a unit becomes available, we will reach out promptly. A timely response is important.</span></li>
      </ul>
    </div>
    <div class="cta-wrap">
      <a href="${getSiteUrl()}/listings.html" class="cta-btn">View Available Properties</a>
    </div>
    ` : `
    <p class="intro-text">Thank you for the time and effort you invested in your rental application. After careful and thorough consideration, we regret to inform you that your application is <strong>Not Approved</strong> for tenancy at this time.</p>
    <div class="callout red">
      <h4>Application Status — Not Approved</h4>
      <p>${safeReason ? `After review, the primary consideration relates to: <strong>${safeReason}</strong>. ` : ''}Our decision is based on our standard application review criteria. We understand this is disappointing and we genuinely appreciate the trust you placed in us by applying.</p>
    </div>
    <div class="section">
      <div class="section-label">Looking Ahead</div>
      <ul class="steps-list">
        <li><span class="step-num">1</span><span><strong>Reapplication Protection (2 Credits &middot; Valid 30 Days)</strong> — After an initial paid application is not approved, your file automatically receives <strong>2 fee-free reapplication credits valid for 30 days</strong> for the same adults screened across participating Choice Properties listings. Simply use the same email address on the application form or contact our team before payment so the credit waiver is verified. (Any newly added adult not previously screened is subject to the standard $50 fee.)</span></li>
        <li><span class="step-num">2</span><span><strong>Other Properties</strong> — Choice Properties manages a portfolio of properties. Our team would be happy to discuss alternative options that may be a strong fit for your current profile.</span></li>
        <li><span class="step-num">3</span><span><strong>Questions</strong> — If you would like to discuss this decision or explore your options, please reach out to our leasing team directly.</span></li>
      </ul>
    </div>
    <div class="callout" style="border-color:#888888;">
      <p style="font-size:12px;color:#666666;line-height:1.7;"><strong>Fair Housing Notice:</strong> Choice Properties is committed to complying with all applicable Fair Housing laws. We do not discriminate on the basis of race, color, national origin, religion, sex, familial status, disability, or any other class protected by federal, state, or local law. If you believe you have been treated unfairly, you may contact the U.S. Department of Housing and Urban Development (HUD) at hud.gov or call 1-800-669-9777.</p>
    </div>
    <div class="cta-wrap" style="margin-bottom:8px;">
      <a href="${getSiteUrl()}/listings.html" class="cta-btn">Browse Available Properties</a>
    </div>
    `}

    <div class="cta-wrap">
      <a href="${safePortal}" class="cta-btn">${isInfoRequired ? 'Upload Requested Info' : 'View My Application'}</a>
    </div>

    ${CONTACT_ROW}

    <div class="email-closing">
      <p class="closing-text">${isApproved ? 'Congratulations once more. We look forward to having you as part of the Choice Properties community.' : (isWaitlisted || isUnderReview || isInfoRequired) ? 'Thank you for your prompt attention and patience during review.' : 'Thank you again for your interest in Choice Properties. We wish you all the best.'}</p>
      <div class="sign-off">Choice Properties Leasing Team</div>
      <div class="sign-company">choiceproperties404@gmail.com</div>
    </div>
  </div>
  ${EMAIL_FOOTER}
</div>
</body>
</html>`;
}

// Backward-compatible wrappers
export function approvalEmailHtml(firstName: string, propertyAddress: string, message?: string): string {
  const portal = getDirectTenantPortalUrl();
  return statusUpdateHtml('', firstName, 'approved', message, portal, propertyAddress);
}

export function denialEmailHtml(firstName: string, propertyAddress: string, message?: string): string {
  const portal = getDirectTenantPortalUrl();
  return statusUpdateHtml('', firstName, 'denied', message, portal, propertyAddress);
}

export function waitlistedEmailHtml(firstName: string, propertyAddress: string, message?: string): string {
  const portal = getDirectTenantPortalUrl();
  return statusUpdateHtml('', firstName, 'waitlisted', message, portal, propertyAddress);
}

// ─── Template 4: Payment Confirmed ────────────────────────────────────────────

export interface PaymentConfirmedOpts {
  receiptNumber?: string;
  receiptUrl?: string;
  feeBreakdown?: EmailFeeLine[];
  pendingConsentCount?: number;
  hasAdditionalMembers?: boolean;
}

export function paymentConfirmedHtml(
  firstName: string,
  propertyAddress: string,
  amount?: number | string,
  method?: string,
  ref?: string,
  message?: string,
  phone?: string,
  appId?: string,
  propertyName?: string,
  optsOrCount?: PaymentConfirmedOpts | number,
  _legacyFeePerAdult?: number | string,
  legacyHasCoApplicant = false,
  legacyCoApplicantConsent?: boolean): string {
  const portal = getDirectTenantPortalUrl(appId);
  const feeDisplay = amount != null ? formatMoney(amount) : '—';
  const opts: PaymentConfirmedOpts = (optsOrCount && typeof optsOrCount === 'object')
    ? optsOrCount
    : {
        hasAdditionalMembers: legacyHasCoApplicant,
        pendingConsentCount: (legacyHasCoApplicant && legacyCoApplicantConsent !== true) ? 1 : 0,
      };
  const consentPending = opts.pendingConsentCount !== undefined
    ? opts.pendingConsentCount > 0
    : Boolean(opts.hasAdditionalMembers);
  const safeFirstName = escapeHtml(firstName);
  const safeAppId = escapeHtml(appId);
  const safeProperty = escapeHtml(propertyName || propertyAddress);
  const safePortal = escapeHtml(portal);
  const breakdownHtml = Array.isArray(opts.feeBreakdown) && opts.feeBreakdown.length > 0
    ? `<div style="margin-top:10px;padding-top:8px;border-top:1px solid #e5e7eb;">${opts.feeBreakdown.map((item) => `<div class="financial-row" style="font-size:12px;"><span class="f-label">${escapeHtml(item.name || '')} (${escapeHtml(item.role_label || '')})</span><span class="f-value">$${Number(item.fee ?? 0).toFixed(2)}</span></div>`).join('')}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Payment Confirmed — Choice Properties</title>
  <style>${EMAIL_BASE_CSS}</style>
</head>
<body>
<div class="email-wrapper">
  ${buildEmailHeader('Application Fee Confirmed', appId)}
  <div class="status-line status-paid">&#x2713; &nbsp; ${consentPending ? 'Payment Received — Waiting for Additional Member Authorization' : 'Payment Received — Application Now Under Review'}</div>
  <div class="email-body">
    <p class="greeting">Dear ${safeFirstName},</p>
    <p class="intro-text">${consentPending
      ? 'We are pleased to confirm that your application fee has been received and successfully recorded. Review will begin after all additional co-applicants, guarantors, or co-signers complete their separate link.'
      : 'We are pleased to confirm that your application fee has been received and successfully recorded. Your application is now active and has been placed in our review queue. Thank you for completing this step promptly.'}</p>

    <div class="section">
      <div class="section-label">Payment Confirmation</div>
      <div class="callout green">
        <h4>&#x2713; Payment Successfully Received</h4>
        ${opts.receiptNumber ? `<div class="financial-row"><span class="f-label">Official Receipt</span><span class="f-value">${escapeHtml(opts.receiptNumber)}</span></div>` : (appId ? `<div class="financial-row"><span class="f-label">Receipt ID</span><span class="f-value">${safeAppId}-PMT</span></div>` : '')}
        ${appId ? `<div class="financial-row"><span class="f-label">Application ID</span><span class="f-value">${safeAppId}</span></div>` : ''}
        <div class="financial-row"><span class="f-label">Applicant</span><span class="f-value">${safeFirstName}</span></div>
        ${propertyAddress || propertyName ? `<div class="financial-row"><span class="f-label">Property</span><span class="f-value">${safeProperty}</span></div>` : ''}
        <div class="financial-row"><span class="f-label">Amount Paid</span><span class="f-value">${feeDisplay}</span></div>
        <div class="financial-row"><span class="f-label">Payment Date</span><span class="f-value">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
        ${method ? `<div class="financial-row"><span class="f-label">Payment Method</span><span class="f-value">${escapeHtml(method)}</span></div>` : ''}
        ${ref ? `<div class="financial-row"><span class="f-label">Reference / Note</span><span class="f-value">${escapeHtml(ref)}</span></div>` : ''}
        <div class="financial-row"><span class="f-label">Status</span><span class="f-value" style="color:#059669;">${consentPending ? 'Waiting for additional member authorization' : 'Under Review'}</span></div>
        ${breakdownHtml}
      </div>
      ${opts.receiptUrl ? `<p style="margin-top:10px;font-size:13px;"><a href="${escapeHtml(opts.receiptUrl)}" style="color:#1a5276;font-weight:700;">Download Official PDF Receipt &rarr;</a></p>` : ''}
    </div>

    ${message ? `<div class="callout"><p>${escapeHtml(message)}</p></div>` : ''}

    <div class="section">
      <div class="section-label">What Happens Next</div>
      <ul class="steps-list">
        <li><span class="step-num">1</span><span><strong>${consentPending ? 'Additional adult authorization' : 'Active Review'}</strong> — ${consentPending ? 'The additional adult must submit their separate screening authorization before review can begin.' : 'Your complete application is now being reviewed by our leasing team. Applications are typically processed within 24–48 hours of payment confirmation.'}</span></li>
        <li><span class="step-num">2</span><span><strong>Background &amp; Income Verification</strong> — We will conduct standard verification procedures as part of our review process.</span></li>
        <li><span class="step-num">3</span><span><strong>Decision Notification</strong> — You will receive an email once a decision has been made.${phone ? ` Our team may also reach out via text at <strong>${escapeHtml(phone)}</strong> if additional information is needed.` : ''}</span></li>
      </ul>
    </div>

    <div class="callout">
      <h4>A Note on Our Review Process</h4>
      <p>We conduct every review with care and fairness. Applicants who remain responsive and provide complete information are often processed more quickly. There is nothing further required from you at this time.</p>
    </div>

    <div class="cta-wrap">
      <a href="${safePortal}" class="cta-btn">Track My Application</a>
    </div>

    ${CONTACT_ROW}

    <div class="email-closing">
      <p class="closing-text">We appreciate your patience as we complete our review. Should you have any questions in the interim, please do not hesitate to contact our leasing team.</p>
      <div class="sign-off">Choice Properties Leasing Team</div>
      <div class="sign-company">choiceproperties404@gmail.com</div>
    </div>
  </div>
  ${EMAIL_FOOTER}
</div>
</body>
</html>`;
}

// ─── Template 5: Holding Fee Request ──────────────────────────────────────────

export function holdingFeeRequestHtml(
  firstName: string,
  propertyAddress: string,
  feeAmount?: number | string,
  dueDate?: string,
  message?: string,
  appId?: string,
  _applicantPaymentMethods?: string[]): string {
  const portal = getDirectTenantPortalUrl(appId);
  const deadlineText = dueDate ? new Date(dueDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : '48 hours from this email';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Action Required — Holding Fee</title>
  <style>${EMAIL_BASE_CSS}</style>
</head>
<body>
<div class="email-wrapper">
  ${buildEmailHeader('Holding Fee Request', appId)}
  <div class="status-line status-lease">&#x1F3E0; &nbsp; Action Required — Reserve Your Unit</div>
  <div class="email-body">
    <p class="greeting">Dear ${firstName},</p>
    <p class="intro-text">Congratulations — your application for <strong>${propertyAddress}</strong> has been conditionally approved. To formally reserve this unit and remove it from active availability, a holding fee is required.</p>

    <div class="callout amber">
      <h4>&#x23F0; Time-Sensitive — Reserve Within ${deadlineText}</h4>
      <p>Without a holding fee on file, this property remains available to other approved applicants on a <strong>first-completion basis</strong>. This fee fully secures your unit while your lease is being finalized. <strong>This fee is credited in full toward your move-in costs — it is not an additional charge.</strong></p>
    </div>

    <div class="callout">
      <h4>Why We Require a Holding Fee</h4>
      <p style="font-size:13px;color:#555;line-height:1.65;">Approval qualifies you to move forward, but it does not by itself remove the unit from the market. A holding fee is the formal step that takes the property off availability so no other approved applicant can claim it ahead of you. It protects the time we both invest in preparing your lease, and it is the cleanest way to confirm mutual commitment before signing.</p>
    </div>

    ${feeAmount != null ? `
    <div class="section">
      <div class="section-label">Holding Fee Details</div>
      <div class="callout">
        <div class="financial-row"><span class="f-label">Holding Fee Amount</span><span class="f-value">${formatMoney(feeAmount)}</span></div>
        <div class="financial-row"><span class="f-label">Due By</span><span class="f-value">${deadlineText}</span></div>
        <div class="financial-row"><span class="f-label">Applied Toward</span><span class="f-value">Move-In Balance (credited in full)</span></div>
      </div>
    </div>
    ` : ''}

    <div class="section">
      <div class="section-label">How to Pay</div>
      <div class="callout">
        <h4>A Leasing Team Member Will Provide Payment Instructions</h4>
        <p>Our leasing team will follow up shortly via email or text to confirm your holding deposit payment instructions and issue your reservation receipt once posted.</p>
      </div>
    </div>

    ${message ? `<div class="callout"><p>${message}</p></div>` : ''}

    <div class="section">
      <div class="section-label">After Payment is Confirmed</div>
      <ul class="steps-list">
        <li><span class="step-num">1</span><span>Our team confirms receipt and records your payment — you will receive an email confirmation.</span></li>
        <li><span class="step-num">2</span><span>Your unit is formally reserved and removed from active availability.</span></li>
        <li><span class="step-num">3</span><span>Our team prepares your lease agreement for electronic signature.</span></li>
      </ul>
    </div>

    <div class="callout amber">
      <h4>Refund &amp; Forfeiture Summary</h4>
      <p style="margin-bottom:8px;"><strong>Fully credited:</strong> the holding deposit is applied 100% toward your move-in costs once the lease is executed.</p>
      <p style="margin-bottom:8px;"><strong>May be refunded:</strong> if the property becomes unavailable through no fault of yours, or materially differs from how it was advertised — see Section 9 of the <a href="${POLICY_BASE_URL}/policies.html#s9" style="color:#1a5276;">Policy Framework</a>.</p>
      <p style="margin-bottom:0;"><strong>May be forfeited:</strong> if you withdraw, fail to sign the lease in time, or change your mind — see the <a href="${POLICY_BASE_URL}/holding-deposit-policy.html" style="color:#1a5276;">Holding Deposit Policy</a>.</p>
    </div>

    <div class="cta-wrap">
      <a href="${portal}" class="cta-btn">View My Application</a>
    </div>

    ${CONTACT_ROW}

    <div class="email-closing">
      <p class="closing-text">Please act promptly to secure your unit. Our team is here to answer any questions you may have about this step.</p>
      <div class="sign-off">Choice Properties Leasing Team</div>
      <div class="sign-company">choiceproperties404@gmail.com</div>
    </div>
  </div>
  ${EMAIL_FOOTER}
</div>
</body>
</html>`;
}

// ─── Template 6: Holding Fee Received ─────────────────────────────────────────

export function holdingFeeReceivedHtml(
  firstName: string,
  propertyAddress: string,
  portalUrl: string,
  message?: string,
  feeAmount?: number | string,
  remainingBalance?: number | string,
  appId?: string,
  receiptUrl?: string,
  receiptNumber?: string): string {
  const portal = appId ? getDirectTenantPortalUrl(appId) : (portalUrl || getDirectTenantPortalUrl());

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Holding Fee Received — Choice Properties</title>
  <style>${EMAIL_BASE_CSS}</style>
</head>
<body>
<div class="email-wrapper">
  ${buildEmailHeader('Holding Fee Received — Unit Reserved', appId)}
  <div class="status-line status-approved">&#x2713; &nbsp; Holding Fee Confirmed — Your Unit is Reserved</div>
  <div class="email-body">
    <p class="greeting">Dear ${firstName},</p>
    <p class="intro-text">We have received your holding fee for <strong>${propertyAddress}</strong>. Your unit is now formally reserved and has been removed from active availability. Thank you for acting promptly.</p>

    <div class="callout green">
      <h4>&#x2713; Holding Fee Confirmed — Unit Secured</h4>
      ${receiptNumber ? `<div class="financial-row"><span class="f-label">Official Receipt</span><span class="f-value">${escapeHtml(receiptNumber)}</span></div>` : ''}
      ${feeAmount != null ? `<div class="financial-row"><span class="f-label">Amount Received</span><span class="f-value">${formatMoney(feeAmount)}</span></div>` : ''}
      <div class="financial-row"><span class="f-label">Applied Toward</span><span class="f-value">Move-In Balance (credited in full)</span></div>
      ${remainingBalance != null ? `<div class="financial-row"><span class="f-label">Remaining Move-In Balance</span><span class="f-value">${formatMoney(remainingBalance)}</span></div>` : ''}
      <div class="financial-row"><span class="f-label">Unit Status</span><span class="f-value" style="color:#059669;">Reserved</span></div>
    </div>
    ${receiptUrl ? `<p style="margin-top:10px;font-size:13px;"><a href="${escapeHtml(receiptUrl)}" style="color:#1a5276;font-weight:700;">Download Official PDF Receipt &rarr;</a></p>` : ''}

    ${message ? `<div class="callout"><p>${message}</p></div>` : ''}

    <div class="callout amber">
      <h4>Refund &amp; Forfeiture Summary</h4>
      <p style="margin-bottom:8px;"><strong>Fully credited:</strong> the holding deposit you just paid will be applied 100% toward your move-in costs once the lease is executed.</p>
      <p style="margin-bottom:8px;"><strong>May be refunded:</strong> if the property becomes unavailable through no fault of yours, or materially differs from how it was advertised — see Section 9 of the <a href="${POLICY_BASE_URL}/policies.html#s9" style="color:#1a5276;">Policy Framework</a>.</p>
      <p style="margin-bottom:0;"><strong>May be forfeited:</strong> if you withdraw, fail to sign the lease in time, or change your mind before signing — see the <a href="${POLICY_BASE_URL}/holding-deposit-policy.html" style="color:#1a5276;">Holding Deposit Policy</a>.</p>
    </div>

    <div class="section">
      <div class="section-label">What Happens Next</div>
      <ul class="steps-list">
        <li><span class="step-num">1</span><span><strong>Lease Agreement</strong> — Your lease agreement will be prepared and sent to you shortly for electronic signature.</span></li>
        <li><span class="step-num">2</span><span><strong>Remaining Move-In Payment</strong> — Once your lease is signed, the remaining move-in balance will be due before key handoff.</span></li>
        <li><span class="step-num">3</span><span><strong>Move-In Coordination</strong> — Our team will contact you to confirm your move-in date and key pickup details.</span></li>
      </ul>
    </div>

    <div class="cta-wrap">
      <a href="${portal}" class="cta-btn">View My Application</a>
    </div>

    ${CONTACT_ROW}

    <div class="email-closing">
      <p class="closing-text">We look forward to welcoming you as a Choice Properties resident.</p>
      <div class="sign-off">Choice Properties Leasing Team</div>
      <div class="sign-company">choiceproperties404@gmail.com</div>
    </div>
  </div>
  ${EMAIL_FOOTER}
</div>
</body>
</html>`;
}

// ─── Template 7: Lease Ready to Sign ──────────────────────────────────────────

export function signingEmailHtml(
  firstName: string,
  propertyAddress: string,
  signingUrl: string,
  appId: string,
  leaseData?: { term?: string; startDate?: string; endDate?: string; rent?: string | number; deposit?: string | number; moveInCosts?: string | number; propertyState?: string }): string {
  const eSignText = getESignText(leaseData?.propertyState || 'MI');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your Lease Agreement is Ready — Choice Properties</title>
  <style>${EMAIL_BASE_CSS}</style>
</head>
<body>
<div class="email-wrapper">
  ${buildEmailHeader('Your Lease Agreement is Ready', appId)}
  <div class="status-line status-lease">&#x1F4CB; &nbsp; Action Required — Please Review and Sign Within 48 Hours</div>
  <div class="email-body">
    <p class="greeting">Dear ${firstName},</p>
    <p class="intro-text">We are pleased to inform you that your lease agreement for <strong>${propertyAddress}</strong> has been prepared and is now ready for your review and electronic signature. Please read the agreement carefully in its entirety before signing.</p>

    ${leaseData ? `
    <div class="section">
      <div class="section-label">Lease Summary</div>
      <table class="info-table">
        <tr><td>Property</td><td><strong>${propertyAddress}</strong></td></tr>
        ${leaseData.term ? `<tr><td>Lease Term</td><td>${leaseData.term}</td></tr>` : ''}
        ${leaseData.startDate ? `<tr><td>Lease Start Date</td><td>${leaseData.startDate}</td></tr>` : ''}
        ${leaseData.endDate ? `<tr><td>Lease End Date</td><td>${leaseData.endDate}</td></tr>` : ''}
        ${leaseData.rent ? `<tr><td>Monthly Rent</td><td>${formatMoney(leaseData.rent)}</td></tr>` : ''}
        ${leaseData.deposit ? `<tr><td>Security Deposit</td><td>${formatMoney(leaseData.deposit)}</td></tr>` : ''}
        ${leaseData.moveInCosts ? `<tr><td>Total Due at Move-In</td><td><strong>${formatMoney(leaseData.moveInCosts)}</strong></td></tr>` : ''}
      </table>
    </div>
    ` : ''}

    <div class="callout amber">
      <h4>&#x23F0; 48-Hour Signing Window</h4>
      <p>To secure your unit, your lease must be signed within <strong>48 hours</strong> of receiving this email. Units are confirmed on a first-completed basis. If you require additional time, please contact our team immediately.</p>
    </div>

    <div class="callout amber">
      <h4>Holding Deposit — Refund &amp; Forfeiture Reminder</h4>
      <p style="margin-bottom:8px;"><strong>Fully credited:</strong> once you sign, your holding deposit is applied 100% toward your move-in costs.</p>
      <p style="margin-bottom:8px;"><strong>May be refunded:</strong> if the property becomes unavailable through no fault of yours, or materially differs from how it was advertised — see Section 9 of the <a href="${POLICY_BASE_URL}/policies.html#s9" style="color:#1a5276;">Policy Framework</a>.</p>
      <p style="margin-bottom:0;"><strong>May be forfeited:</strong> if you do not sign within the 48-hour window above, withdraw, or change your mind before signing — see the <a href="${POLICY_BASE_URL}/holding-deposit-policy.html" style="color:#1a5276;">Holding Deposit Policy</a>.</p>
    </div>

    <div class="cta-wrap">
      <a href="${signingUrl}" class="cta-btn">Review &amp; Sign My Lease</a>
      <div class="cta-note">Or copy this link: ${signingUrl}</div>
    </div>

    <div class="section">
      <div class="section-label">What to Expect When You Sign</div>
      <ul class="steps-list">
        <li><span class="step-num">1</span><span><strong>Review the Full Agreement</strong> — Read every section carefully. The lease outlines your rights, responsibilities, and all financial obligations.</span></li>
        <li><span class="step-num">2</span><span><strong>Confirm Checkboxes</strong> — You will be asked to confirm your agreement to specific terms before signing.</span></li>
        <li><span class="step-num">3</span><span><strong>Sign Electronically</strong> — Enter your full legal name as your electronic signature. This is legally binding under the ${eSignText}.</span></li>
        <li><span class="step-num">4</span><span><strong>Receive Confirmation</strong> — You will receive an immediate email confirmation once your signature is recorded.</span></li>
      </ul>
    </div>

    <p style="color:#718096;font-size:13px;margin:0 0 8px;">Application ID: <strong>${appId}</strong></p>
    <p style="color:#718096;font-size:13px;">This signing link is unique to you. Do not share it.</p>

    ${CONTACT_ROW}

    <div class="email-closing">
      <p class="closing-text">If you have any questions about the lease terms prior to signing, please contact our leasing team. We are available to clarify any aspect of the agreement.</p>
      <div class="sign-off">Choice Properties Leasing Team</div>
      <div class="sign-company">choiceproperties404@gmail.com</div>
    </div>
  </div>
  ${EMAIL_FOOTER}
</div>
</body>
</html>`;
}

// ─── Template 8: Lease Signed (Tenant Confirmation) ───────────────────────────

export function signedConfirmHtml(
  firstName: string,
  propertyAddress: string,
  appId: string,
  leaseData?: { startDate?: string; endDate?: string; rent?: string | number; moveInCost?: string | number; signature?: string }): string {
  const portal = getDirectTenantPortalUrl(appId);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Lease Signed — Welcome to Choice Properties</title>
  <style>${EMAIL_BASE_CSS}</style>
</head>
<body>
<div class="email-wrapper">
  ${buildEmailHeader('Welcome to Choice Properties', appId)}
  <div class="status-line status-lease">&#x270D; &nbsp; Signature Received — Awaiting Management Countersignature</div>
  <div class="email-body">
    <p class="greeting">Dear ${firstName},</p>
    <p class="intro-text">Your electronic signature for the lease at <strong>${propertyAddress}</strong> has been successfully recorded. Your lease is now pending management countersignature. Once management signs, both parties will receive a fully executed copy and your tenancy will be officially confirmed.</p>

    <div class="callout" style="border-color:#1e40af;">
      <h4>&#x270D; Signature Recorded — Next: Management Countersignature</h4>
      <div class="financial-row"><span class="f-label">Property</span><span class="f-value">${propertyAddress}</span></div>
      ${leaseData?.startDate ? `<div class="financial-row"><span class="f-label">Move-In Date</span><span class="f-value">${leaseData.startDate}</span></div>` : ''}
      ${leaseData?.endDate ? `<div class="financial-row"><span class="f-label">Lease End Date</span><span class="f-value">${leaseData.endDate}</span></div>` : ''}
      ${leaseData?.rent ? `<div class="financial-row"><span class="f-label">Monthly Rent</span><span class="f-value">${formatMoney(leaseData.rent)}</span></div>` : ''}
      ${leaseData?.moveInCost ? `<div class="financial-row"><span class="f-label">Move-In Total Due</span><span class="f-value">${formatMoney(leaseData.moveInCost)}</span></div>` : ''}
      <div class="financial-row"><span class="f-label">Application ID</span><span class="f-value">${appId}</span></div>
    </div>

    <div class="section">
      <div class="section-label">What Happens Next</div>
      <ul class="steps-list">
        <li><span class="step-num">1</span><span><strong>Management Countersignature</strong> — Our team will countersign your lease. This typically happens within 1–2 business days. You will receive a confirmation email once complete.</span></li>
        <li><span class="step-num">2</span><span><strong>Fully Executed Copy</strong> — Once both parties have signed, you will receive a final copy of the fully executed lease agreement for your records.</span></li>
        <li><span class="step-num">3</span><span><strong>Move-In Coordination</strong> — Our team will then contact you to finalize your move-in date, payment, and key handoff.</span></li>
      </ul>
    </div>

    <div class="callout amber">
      <h4>Please Note</h4>
      <p>Your lease is not legally binding until management has countersigned. Please do not make any moving arrangements until you receive the "Lease Fully Executed" confirmation email.</p>
    </div>

    <div class="cta-wrap">
      <a href="${portal}" class="cta-btn">View My Tenant Portal</a>
    </div>

    ${CONTACT_ROW}

    <div class="email-closing">
      <p class="closing-text">We appreciate your patience during this final step. Our team will process your countersignature promptly. If you have any questions in the meantime, please don't hesitate to reach out.</p>
      <div class="sign-off">Choice Properties Leasing Team</div>
      <div class="sign-company">choiceproperties404@gmail.com</div>
    </div>
  </div>
  ${EMAIL_FOOTER}
</div>
</body>
</html>`;
}

// ─── Template 9: Lease Fully Executed (Management Countersigned) ───────────────

export function leaseFullyExecutedHtml(
  firstName: string,
  propertyAddress: string,
  portalUrl: string,
  appId?: string,
  leaseData?: { startDate?: string; endDate?: string; rent?: string | number; deposit?: string | number; moveInCost?: string | number }): string {
  const portal = appId ? getDirectTenantPortalUrl(appId) : (portalUrl || getDirectTenantPortalUrl());

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Lease Fully Executed — Choice Properties</title>
  <style>${EMAIL_BASE_CSS}</style>
</head>
<body>
<div class="email-wrapper">
  ${buildEmailHeader('Your Lease Has Been Fully Executed', appId)}
  <div class="status-line status-approved">&#x2713; &nbsp; Both Parties Have Signed — Your Tenancy is Official</div>
  <div class="email-body">
    <p class="greeting">Dear ${firstName},</p>
    <p class="intro-text">Congratulations! Your lease for <strong>${propertyAddress}</strong> has been fully executed — both you and management have signed. Your tenancy is now officially confirmed. You may download your fully executed lease from your tenant portal.</p>

    <div class="callout green">
      <h4>&#x2713; Lease Fully Executed — Tenancy Confirmed</h4>
      <div class="financial-row"><span class="f-label">Property</span><span class="f-value">${propertyAddress}</span></div>
      ${leaseData?.startDate ? `<div class="financial-row"><span class="f-label">Lease Start Date</span><span class="f-value">${leaseData.startDate}</span></div>` : ''}
      ${leaseData?.endDate ? `<div class="financial-row"><span class="f-label">Lease End Date</span><span class="f-value">${leaseData.endDate}</span></div>` : ''}
      ${leaseData?.rent ? `<div class="financial-row"><span class="f-label">Monthly Rent</span><span class="f-value">${formatMoney(leaseData.rent)}</span></div>` : ''}
      ${leaseData?.deposit ? `<div class="financial-row"><span class="f-label">Security Deposit</span><span class="f-value">${formatMoney(leaseData.deposit)}</span></div>` : ''}
      ${leaseData?.moveInCost ? `<div class="financial-row"><span class="f-label">Move-In Total Due</span><span class="f-value"><strong>${formatMoney(leaseData.moveInCost)}</strong></span></div>` : ''}
      ${appId ? `<div class="financial-row"><span class="f-label">Application ID</span><span class="f-value">${appId}</span></div>` : ''}
      <p style="margin-top:12px;font-size:13px;color:#444444;">Your lease is legally binding. Please retain this email and your lease document for your records.</p>
    </div>

    <div class="section">
      <div class="section-label">What Happens Next</div>
      <ul class="steps-list">
        <li><span class="step-num">1</span><span><strong>Move-In Payment</strong> — Our team will contact you to coordinate your move-in payment${leaseData?.moveInCost ? ` of <strong>${formatMoney(leaseData.moveInCost)}</strong>` : ''}. This must be received in full before key handoff.</span></li>
        <li><span class="step-num">2</span><span><strong>Move-In Coordination</strong> — Our team will finalize your move-in date, time, and key handoff logistics with you directly.</span></li>
        <li><span class="step-num">3</span><span><strong>Download Your Lease</strong> — Your fully executed lease is available in your tenant portal. Save a copy for your records.</span></li>
      </ul>
    </div>

    <div class="cta-wrap">
      <a href="${portal}" class="cta-btn">Go to Tenant Portal</a>
    </div>

    ${CONTACT_ROW}

    <div class="email-closing">
      <p class="closing-text">We look forward to welcoming you to your new home. Our team is here to ensure a smooth and enjoyable move-in experience.</p>
      <div class="sign-off">Choice Properties Leasing Team</div>
      <div class="sign-company">choiceproperties404@gmail.com</div>
    </div>
  </div>
  ${EMAIL_FOOTER}
</div>
</body>
</html>`;
}

// ─── Template 10: Move-In Confirmed ───────────────────────────────────────────

export function moveinEmailHtml(
  firstName: string,
  propertyAddress: string,
  moveInDate?: string,
  message?: string,
  appId?: string): string {
  const portal = getDirectTenantPortalUrl(appId);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Move-In Confirmed — Choice Properties</title>
  <style>${EMAIL_BASE_CSS}</style>
</head>
<body>
<div class="email-wrapper">
  ${buildEmailHeader('Move-In Confirmed', appId)}
  <div class="status-line status-approved">&#x1F3E0; &nbsp; Your Move-In Date is Confirmed</div>
  <div class="email-body">
    <p class="greeting">Dear ${firstName},</p>
    <p class="intro-text">We are excited to confirm your upcoming move-in to <strong>${propertyAddress}</strong>. Everything is in order and we look forward to handing you your keys.</p>

    ${moveInDate ? `
    <div class="callout green">
      <h4>&#x2713; Move-In Confirmed</h4>
      <div class="financial-row"><span class="f-label">Move-In Date</span><span class="f-value">${moveInDate}</span></div>
      <div class="financial-row"><span class="f-label">Property</span><span class="f-value">${propertyAddress}</span></div>
    </div>
    ` : ''}

    ${message ? `<div class="callout"><p>${message}</p></div>` : ''}

    <div class="callout">
      <h4>Holding Deposit — Now Credited</h4>
      <p style="margin-bottom:8px;"><strong>Fully credited:</strong> as of move-in, the holding deposit you paid earlier has been applied 100% toward your move-in costs — it was not an additional charge.</p>
      <p style="margin-bottom:0;">The refund and forfeiture terms that applied prior to move-in are governed by Section 9 of the <a href="${POLICY_BASE_URL}/policies.html#s9" style="color:#1a5276;">Policy Framework</a> and the <a href="${POLICY_BASE_URL}/holding-deposit-policy.html" style="color:#1a5276;">Holding Deposit Policy</a>. From move-in forward, your security deposit and rent obligations are governed by your signed lease.</p>
    </div>

    <div class="cta-wrap">
      <a href="${portal}" class="cta-btn">View Tenant Portal</a>
    </div>

    ${CONTACT_ROW}

    <div class="email-closing">
      <p class="closing-text">We are thrilled to welcome you to your new home. If you have any questions before your move-in, please don't hesitate to reach out.</p>
      <div class="sign-off">Choice Properties Leasing Team</div>
      <div class="sign-company">choiceproperties404@gmail.com</div>
    </div>
  </div>
  ${EMAIL_FOOTER}
</div>
</body>
</html>`;
}

// ─── Template 11: Move-In Preparation Guide ───────────────────────────────────

export function moveInPrepHtml(
  firstName: string,
  propertyAddress: string,
  message?: string,
  appId?: string,
  leaseData?: { rent?: string | number; deposit?: string | number; moveInCost?: string | number; startDate?: string }): string {
  const portal = getDirectTenantPortalUrl(appId);
  const contactEmail = getContactEmail();
  const moveInTotal = leaseData?.moveInCost || (leaseData?.rent && leaseData?.deposit ? Number(leaseData.rent) + Number(leaseData.deposit) : null);
  const startDate = leaseData?.startDate ? new Date(leaseData.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'As agreed';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Move-In Preparation Guide — Choice Properties</title>
  <style>${EMAIL_BASE_CSS}</style>
</head>
<body>
<div class="email-wrapper">
  ${buildEmailHeader('Your Move-In Preparation Guide', appId)}
  <div class="status-line status-approved">&#x1F3E0; &nbsp; Your Lease is Signed — Here's How to Prepare</div>
  <div class="email-body">
    <p class="greeting">Dear ${firstName},</p>
    <p class="intro-text">Congratulations on signing your lease! This guide covers everything you need to do before your move-in date${leaseData?.startDate ? ` of <strong>${startDate}</strong>` : ''}.</p>

    ${moveInTotal ? `
    <div class="callout amber">
      <h4>Move-In Payment Due Before Key Handoff</h4>
      <p>
        ${leaseData?.rent ? `<strong>First Month's Rent:</strong> ${formatMoney(leaseData.rent)}<br>` : ''}
        ${leaseData?.deposit ? `<strong>Security Deposit:</strong> ${formatMoney(leaseData.deposit)}<br>` : ''}
        <strong>Total Due:</strong> ${formatMoney(moveInTotal)}<br><br>
        Our team will contact you to arrange payment. <strong>Do not send money before speaking with us directly.</strong>
      </p>
    </div>
    ` : ''}

    ${message ? `<div class="callout"><p>${message}</p></div>` : ''}

    <div class="section">
      <div class="section-label">What to Bring on Move-In Day</div>
      <ul class="steps-list">
        <li><span class="step-num">1</span><span><strong>Government-Issued Photo ID</strong> — Required for all adults 18+ who will reside in the unit.</span></li>
        <li><span class="step-num">2</span><span><strong>Move-In Payment</strong> — Full move-in amount in the agreed payment form. Our team will confirm the method in advance.</span></li>
        <li><span class="step-num">3</span><span><strong>Renter's Insurance Proof</strong> — A current binder or declaration page. Your policy must be in effect before key handoff.</span></li>
      </ul>
    </div>

    <div class="section">
      <div class="section-label">Before You Move In</div>
      <ul class="steps-list">
        <li><span class="step-num">A</span><span><strong>Set Up Utilities</strong> — Electric, gas, water, and internet accounts should be transferred or opened in your name on or before your lease start date.</span></li>
        <li><span class="step-num">B</span><span><strong>Obtain Renter's Insurance</strong> — Your lease requires you to maintain renter's insurance for the full lease term. Most policies cost $10–$20/month.</span></li>
        <li><span class="step-num">C</span><span><strong>Update Your Address</strong> — File a change of address with USPS at usps.com/move and notify your bank, employer, and other services.</span></li>
        <li><span class="step-num">D</span><span><strong>Review Parking &amp; Rules</strong> — Parking assignments and community rules are outlined in your lease. Please review before your move-in day.</span></li>
      </ul>
    </div>

    <div class="callout">
      <h4>Maintenance &amp; Emergency Contact</h4>
      <p>For maintenance requests or questions, contact us by text at <strong>707-706-3137</strong> or email <strong>${contactEmail}</strong>. For property emergencies (water, electrical, structural), text us immediately.</p>
    </div>

    <div class="cta-wrap">
      <a href="${portal}" class="cta-btn">View My Tenant Portal</a>
    </div>

    <div class="email-closing">
      <p class="closing-text">We're thrilled to welcome you to your new home. Our team is here to help make your move-in smooth and stress-free.</p>
      <div class="sign-off">Choice Properties Leasing Team</div>
      <div class="sign-company">choiceproperties404@gmail.com</div>
    </div>
  </div>
  ${EMAIL_FOOTER}
</div>
</body>
</html>`;
}

// ─── Template 12: Lease Signing Reminder ──────────────────────────────────────

export function leaseSigningReminderHtml(
  firstName: string,
  propertyAddress: string,
  portalUrl: string,
  message?: string,
  appId?: string,
  signingUrl?: string): string {
  const portal = appId ? getDirectTenantPortalUrl(appId) : (portalUrl || getDirectTenantPortalUrl());
  const actionUrl = signingUrl || portal;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Reminder — Sign Your Lease</title>
  <style>${EMAIL_BASE_CSS}</style>
</head>
<body>
<div class="email-wrapper">
  ${buildEmailHeader('Lease Signing Reminder', appId)}
  <div class="status-line" style="color:#c2410c;">&#x23F3; &nbsp; Action Required — Your Lease Awaits Your Signature</div>
  <div class="email-body">
    <p class="greeting">Dear ${firstName},</p>
    <p class="intro-text">This is a friendly reminder that your lease agreement for <strong>${propertyAddress}</strong> is still awaiting your electronic signature. Unit availability is time-sensitive — to protect your reservation, please sign at your earliest convenience.</p>

    <div class="callout" style="border-color:#f97316;">
      <h4 style="color:#c2410c;">Please Sign Within 48 Hours</h4>
      <p>If your lease remains unsigned, the unit may be offered to other applicants on our waiting list. If you have questions or concerns about any clause, please reach out to our team before the deadline.</p>
    </div>

    ${message ? `<div class="callout"><p>${message}</p></div>` : ''}

    <div class="cta-wrap">
      <a href="${actionUrl}" class="cta-btn">Sign My Lease Now &#x2192;</a>
      ${signingUrl ? `<div class="cta-note">Or copy this link: ${signingUrl}</div>` : ''}
    </div>

    ${CONTACT_ROW}

    <div class="email-closing">
      <p class="closing-text">We're excited to have you as a resident and look forward to getting your home ready. Please don't hesitate to reach out if you have any questions before signing.</p>
      <div class="sign-off">Choice Properties Leasing Team</div>
      <div class="sign-company">choiceproperties404@gmail.com</div>
    </div>
  </div>
  ${EMAIL_FOOTER}
</div>
</body>
</html>`;
}

// ─── Template 13: Lease Expiry Alert (Admin Internal) ─────────────────────────

export function leaseExpiryAlertHtml(
  firstName: string,
  propertyAddress: string,
  leaseEndDate: string,
  appId: string,
  tenantEmail: string,
  tenantPhone?: string): string {
  const adminUrl = getAdminUrl();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Lease Unsigned — Admin Alert</title>
  <style>${EMAIL_BASE_CSS}</style>
</head>
<body>
<div class="email-wrapper">
  ${buildEmailHeader('Lease Unsigned — 48h Alert', appId)}
  <div class="status-line status-denied">&#x26A0; &nbsp; Tenant Has Not Signed — 48 Hours Elapsed</div>
  <div class="email-body">
    <p class="intro-text">The lease agreement for Application <strong>${appId}</strong> has not been signed within 48 hours of delivery. Immediate follow-up is recommended to protect unit availability.</p>

    <div class="callout red">
      <h4>Applicant Contact Information</h4>
      <p>
        <strong>Name:</strong> ${firstName}<br>
        <strong>Email:</strong> ${tenantEmail}<br>
        ${tenantPhone ? `<strong>Phone:</strong> ${tenantPhone}<br>` : ''}
        <strong>Property:</strong> ${propertyAddress}<br>
        <strong>Lease End Date:</strong> ${formatDate(leaseEndDate)}
      </p>
    </div>

    <div class="section">
      <div class="section-label">Suggested Actions</div>
      <ul class="steps-list">
        <li><span class="step-num">1</span><span>Contact the applicant by text${tenantPhone ? ` at <strong>${tenantPhone}</strong>` : ''} to confirm they received the lease and address any questions.</span></li>
        <li><span class="step-num">2</span><span>If no response within 24 hours, evaluate whether the unit should be re-listed.</span></li>
        <li><span class="step-num">3</span><span>If cancelling, update the application status in the admin panel and notify the applicant.</span></li>
      </ul>
    </div>

    <div class="cta-wrap">
      <a href="${adminUrl}" class="cta-btn">View in Admin Panel &#x2192;</a>
    </div>

    <div class="contact-row">This alert was generated automatically by the Choice Properties rental system. Application ID: <strong>${appId}</strong></div>
  </div>
  ${EMAIL_FOOTER}
</div>
</body>
</html>`;
}

// ─── Template 14: Admin Review Summary (Holding Fee Received) ─────────────────

export function adminReviewSummaryHtml(
  firstName: string,
  lastName: string,
  email: string,
  phone: string,
  propertyAddress: string,
  appId: string,
  feeReceived?: number | string,
  appData?: Record<string, unknown>): string {
  const adminUrl = getAdminUrl('/admin/leases.html');
  const now = new Date().toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const row = (label: string, value: unknown) => value
    ? `<tr><td style="padding:8px 10px;font-size:13px;color:#555555;width:42%;border-bottom:1px solid #f0f0f0;">${label}</td><td style="padding:8px 10px;font-size:13px;color:#1a1a1a;font-weight:500;border-bottom:1px solid #f0f0f0;">${value}</td></tr>`
    : '';

  const section = (title: string) =>
    `<tr><td colspan="2" style="padding:10px 10px 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#888888;background:#f8f8f8;">${title}</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Review Summary — ${appId}</title>
  <style>${EMAIL_BASE_CSS}</style>
</head>
<body>
<div class="email-wrapper">
  ${buildEmailHeader('Fee Confirmed — Action Required', appId)}
  <div class="status-line status-approved">&#x2713; &nbsp; Fee Confirmed — Generate Lease Document</div>
  <div class="email-body">
    <p class="intro-text">The holding fee for Application <strong>${appId}</strong> has been confirmed. Please log in to the admin panel and generate the lease document for this applicant.</p>

    <div class="callout green">
      <h4>&#x2713; Holding Fee Received — Lease Generation Required</h4>
      <div class="financial-row"><span class="f-label">Applicant</span><span class="f-value">${firstName} ${lastName}</span></div>
      <div class="financial-row"><span class="f-label">Property</span><span class="f-value">${propertyAddress}</span></div>
      ${feeReceived != null ? `<div class="financial-row"><span class="f-label">Holding Fee Received</span><span class="f-value">${formatMoney(feeReceived)}</span></div>` : ''}
      <div class="financial-row"><span class="f-label">Received At</span><span class="f-value">${now}</span></div>
    </div>

    ${appData ? `
    <div class="section">
      <div class="section-label">Applicant Summary</div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e0e0e0;border-radius:4px;overflow:hidden;">
        <tbody>
          ${section('Contact')}
          ${row('Full Name', `${firstName} ${lastName}`)}
          ${row('Email', email)}
          ${row('Phone', phone)}
          ${section('Property')}
          ${row('Property Address', propertyAddress)}
          ${row('Monthly Rent', appData['monthly_rent'] ? formatMoney(String(appData['monthly_rent'])) : null)}
          ${row('Requested Move-In', appData['requested_move_in_date'])}
          ${section('Employment & Household')}
          ${row('Employment Status', appData['employment_status'])}
          ${row('Employer', appData['employer'])}
          ${row('Primary Monthly Income', appData['monthly_income'] ? '$' + Number(String(appData['monthly_income']).replace(/[^0-9.]/g, '') || 0).toLocaleString() + '/mo' : null)}
          ${row('Household Income (Occupants Only)', (appData['household_monthly_income'] || appData['combined_monthly_income']) ? '$' + Number(appData['household_monthly_income'] ?? appData['combined_monthly_income']).toLocaleString() + '/mo' : null)}
          ${Number(appData['guarantor_monthly_income'] || 0) > 0 ? row('Guarantor Financial Support (Separate)', '$' + Number(appData['guarantor_monthly_income']).toLocaleString() + '/mo') : ''}
          ${Number(appData['co_signer_monthly_income'] || 0) > 0 ? row('Co-Signer Financial Support (Separate)', '$' + Number(appData['co_signer_monthly_income']).toLocaleString() + '/mo') : ''}
          ${Number(appData['total_financial_support'] || 0) > 0 ? row('Total Financial Support Available', '$' + Number(appData['total_financial_support']).toLocaleString() + '/mo') : ''}
          ${Array.isArray(appData['_co_applicants']) && (appData['_co_applicants'] as Array<Record<string, unknown>>).length > 0
            ? section(`Additional Household &amp; Financial Members (${(appData['_co_applicants'] as Array<Record<string, unknown>>).length})`) +
              (appData['_co_applicants'] as Array<Record<string, unknown>>).map((ca, idx) =>
                row(`Member #${idx + 2} (${escapeHtml(ca.role || 'Co-Applicant')})`,
                  `${escapeHtml(ca.first_name || '')} ${escapeHtml(ca.last_name || '')} (${escapeHtml(ca.email || '—')})${ca.monthly_income ? ' — $' + Number(String(ca.monthly_income).replace(/[^0-9.]/g, '') || 0).toLocaleString() + '/mo' : ''}`
                )
              ).join('')
            : ''}
        </tbody>
      </table>
    </div>
    ` : `
    <div class="section">
      <div class="section-label">Applicant Details</div>
      <table class="info-table">
        <tr><td>Name</td><td>${firstName} ${lastName}</td></tr>
        <tr><td>Email</td><td>${email}</td></tr>
        <tr><td>Phone</td><td>${phone || '—'}</td></tr>
        <tr><td>Property</td><td>${propertyAddress}</td></tr>
        <tr><td>App ID</td><td><strong>${appId}</strong></td></tr>
      </table>
    </div>
    `}

    <p style="color:#1a1a1a;font-size:14px;font-weight:600;margin:16px 0;">Recommended next action: Generate the lease document for this applicant in the Lease Pipeline.</p>

    <div class="cta-wrap">
      <a href="${adminUrl}" class="cta-btn">Go to Lease Pipeline &#x2192;</a>
    </div>

    <div class="contact-row">This summary was generated automatically when the holding fee was confirmed. Application ID: <strong>${appId}</strong></div>
  </div>
  ${EMAIL_FOOTER}
</div>
</body>
</html>`;
}

// ─── Phase 3 — Co-Applicant / Guarantor / Co-Signer Lease Invite ─────────────

export function coApplicantInviteHtml(
  coFirstName: string,
  primaryName: string,
  propertyAddress: string,
  signingUrl: string,
  appId: string,
  signerRoleLabel = 'Co-Applicant'): string {
  const safeRole = escapeHtml(signerRoleLabel || 'Co-Applicant');
  const isGuarantor = /guarantor/i.test(signerRoleLabel);
  const isCoSigner = /co-?signer/i.test(signerRoleLabel);
  const roleSentence = isGuarantor
    ? 'listed you as a non-occupying guarantor. The lease package cannot be finalized by management until you complete your signature.'
    : isCoSigner
      ? 'listed you as a co-signer. The lease package cannot be finalized by management until you complete your signature.'
      : 'listed you as a co-applicant. By signing, you will be jointly and severally liable for all obligations under the lease alongside the primary applicant.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your ${safeRole} Lease is Ready to Sign — Choice Properties</title>
  <style>${EMAIL_BASE_CSS}</style>
</head>
<body>
<div class="email-wrapper">
  ${buildEmailHeader(`Your ${safeRole} Signature is Requested`, appId)}
  <div class="status-line status-lease">&#x270D; &nbsp; Action Required — ${safeRole} Signature Needed</div>
  <div class="email-body">
    <p class="greeting">Dear ${escapeHtml(coFirstName)},</p>
    <p class="intro-text"><strong>${escapeHtml(primaryName)}</strong> has signed the lease for <strong>${escapeHtml(propertyAddress)}</strong> as the primary applicant and ${roleSentence}</p>

    <div class="callout amber">
      <h4>&#x23F0; Please Sign Within 48 Hours</h4>
      <p>To keep the application on schedule, please complete your signature within <strong>48 hours</strong>. If you require additional time or have questions, please contact our team.</p>
    </div>

    <div class="cta-wrap">
      <a href="${escapeHtml(signingUrl)}" class="cta-btn">Review &amp; Sign as ${safeRole}</a>
      <div class="cta-note">Or copy this link: ${escapeHtml(signingUrl)}</div>
    </div>

    <div class="section">
      <div class="section-label">What to Expect</div>
      <ul class="steps-list">
        <li><span class="step-num">1</span><span><strong>Review the Full Lease</strong> — Including the signature already recorded by the primary applicant.</span></li>
        <li><span class="step-num">2</span><span><strong>Confirm Your Identity</strong> — You will enter the email address you were contacted at on this message.</span></li>
        <li><span class="step-num">3</span><span><strong>Sign Electronically</strong> — Type your full legal name. This is legally binding under the federal E-SIGN Act and applicable state law.</span></li>
        <li><span class="step-num">4</span><span><strong>Management Countersignature</strong> — Once all required parties sign, management will countersign and send the executed copy.</span></li>
      </ul>
    </div>

    <p style="color:#718096;font-size:13px;">This signing link is unique to you. Do not share it.</p>

    ${CONTACT_ROW}

    <div class="email-closing">
      <p class="closing-text">If you did not expect this email, or believe you were listed in error, please contact us immediately and do <strong>not</strong> sign.</p>
      <div class="sign-off">Choice Properties Leasing Team</div>
      <div class="sign-company">choiceproperties404@gmail.com</div>
    </div>
  </div>
  ${EMAIL_FOOTER}
</div>
</body>
</html>`;
}

// ─── Phase 3 — Co-Applicant / Guarantor / Co-Signer Signed Confirmation ───────

export function coApplicantSignedHtml(
  coFirstName: string,
  propertyAddress: string,
  appId: string,
  signerRoleLabel = 'Co-Applicant'): string {
  const safeRole = escapeHtml(signerRoleLabel || 'Co-Applicant');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${safeRole} Signature Received — Choice Properties</title>
  <style>${EMAIL_BASE_CSS}</style>
</head>
<body>
<div class="email-wrapper">
  ${buildEmailHeader('Your Signature Has Been Recorded', appId)}
  <div class="status-line status-paid">&#x2705; &nbsp; ${safeRole} Signature Received</div>
  <div class="email-body">
    <p class="greeting">Dear ${escapeHtml(coFirstName)},</p>
    <p class="intro-text">Thank you. Your electronic signature on the lease package for <strong>${escapeHtml(propertyAddress)}</strong> has been successfully recorded as <strong>${safeRole}</strong>. The lease will advance to management for final countersignature once all required signatures are on file.</p>

    <div class="callout green">
      <h4>What Happens Next</h4>
      <p style="margin-bottom:8px;">Management will countersign the lease, typically within 1-2 business days. Once countersigned, all parties will receive a copy of the fully executed lease.</p>
      <p style="margin-bottom:0;">No further action is required from you at this time.</p>
    </div>

    ${CONTACT_ROW}

    <div class="email-closing">
      <div class="sign-off">Choice Properties Leasing Team</div>
      <div class="sign-company">choiceproperties404@gmail.com</div>
    </div>
  </div>
  ${EMAIL_FOOTER}
</div>
</body>
</html>`;
}

// ─── Phase 4 — Lease Amendment Request ──────────────────────────────────────

export function amendmentRequestHtml(
  firstName: string,
  propertyAddress: string,
  amendmentTitle: string,
  signingUrl: string,
  appId: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Lease Amendment Ready to Sign — Choice Properties</title>
  <style>${EMAIL_BASE_CSS}</style>
</head>
<body>
<div class="email-wrapper">
  ${buildEmailHeader('Lease Amendment Ready', appId)}
  <div class="status-line status-lease">&#x1F4DD; &nbsp; Action Required — Amendment Signature Needed</div>
  <div class="email-body">
    <p class="greeting">Dear ${firstName},</p>
    <p class="intro-text">Management has prepared an amendment to your existing lease for <strong>${propertyAddress}</strong>. This is a separate document that will be added to your file once signed; it does not replace your original lease.</p>

    <div class="callout" style="border-color:#1e40af;">
      <h4>${amendmentTitle}</h4>
      <p>Please review the full text of the amendment carefully before signing. If anything is unclear, contact our team before proceeding.</p>
    </div>

    <div class="cta-wrap">
      <a href="${signingUrl}" class="cta-btn">Review &amp; Sign Amendment</a>
      <div class="cta-note">Or copy this link: ${signingUrl}</div>
    </div>

    <div class="callout amber">
      <h4>You Are Not Required to Sign</h4>
      <p>If you do not agree with the proposed amendment, you may decline by simply not signing, or by replying to this email with your concerns. Your existing lease remains in effect either way.</p>
    </div>

    <p style="color:#718096;font-size:13px;">This signing link is unique to you. Do not share it.</p>

    ${CONTACT_ROW}

    <div class="email-closing">
      <div class="sign-off">Choice Properties Leasing Team</div>
      <div class="sign-company">choiceproperties404@gmail.com</div>
    </div>
  </div>
  ${EMAIL_FOOTER}
</div>
</body>
</html>`;
}

// ─── Phase 4 — Amendment Signed Confirmation ────────────────────────────────

export function amendmentSignedHtml(
  firstName: string,
  propertyAddress: string,
  amendmentTitle: string,
  appId: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Amendment Signed — Choice Properties</title>
  <style>${EMAIL_BASE_CSS}</style>
</head>
<body>
<div class="email-wrapper">
  ${buildEmailHeader('Amendment Signed', appId)}
  <div class="status-line status-paid">&#x2705; &nbsp; Amendment Recorded — Added to Your Lease File</div>
  <div class="email-body">
    <p class="greeting">Dear ${firstName},</p>
    <p class="intro-text">Your signature on the following amendment has been recorded and the document is now part of your lease file for <strong>${propertyAddress}</strong>:</p>

    <div class="callout green">
      <h4>${amendmentTitle}</h4>
      <p>A copy of the signed amendment is available in your tenant portal. Please retain this email for your records.</p>
    </div>

    ${CONTACT_ROW}

    <div class="email-closing">
      <div class="sign-off">Choice Properties Leasing Team</div>
      <div class="sign-company">choiceproperties404@gmail.com</div>
    </div>
  </div>
  ${EMAIL_FOOTER}
</div>
</body>
</html>`;
}

// ─── Phase 4 — Lease Renewal Nudge ──────────────────────────────────────────

export function renewalNudgeHtml(
  firstName: string,
  propertyAddress: string,
  leaseEndDate: string,
  daysRemaining: number,
  appId: string): string {
  const friendlyEnd = formatDate(leaseEndDate);
  const urgencyTone = daysRemaining <= 30 ? 'amber' : '';
  const urgencyHeader = daysRemaining <= 30
    ? `&#x23F0; Less Than ${daysRemaining} Days Remaining`
    : `Lease Renewal Window Open`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Lease Renewal Coming Up — Choice Properties</title>
  <style>${EMAIL_BASE_CSS}</style>
</head>
<body>
<div class="email-wrapper">
  ${buildEmailHeader('Lease Renewal Coming Up', appId)}
  <div class="status-line status-lease">&#x1F4C5; &nbsp; ${daysRemaining} Days Until Lease Ends</div>
  <div class="email-body">
    <p class="greeting">Dear ${firstName},</p>
    <p class="intro-text">A friendly reminder that your lease for <strong>${propertyAddress}</strong> is scheduled to end on <strong>${friendlyEnd}</strong> &mdash; that is approximately <strong>${daysRemaining} days from today</strong>.</p>

    <div class="callout ${urgencyTone}">
      <h4>${urgencyHeader}</h4>
      <p style="margin-bottom:8px;">Please let us know your plans so we can either prepare a renewal lease or coordinate move-out logistics with you.</p>
      <p style="margin-bottom:0;">Reply to this email or text us at <strong>707-706-3137</strong> to begin the conversation.</p>
    </div>

    <div class="section">
      <div class="section-label">Your Options</div>
      <ul class="steps-list">
        <li><span class="step-num">1</span><span><strong>Renew Your Lease</strong> &mdash; We will prepare an updated lease for your review and signature, typically reflecting current market rent for the property.</span></li>
        <li><span class="step-num">2</span><span><strong>Move Out</strong> &mdash; Standard notice requirements apply per your current lease. We will coordinate the move-out inspection and security deposit return.</span></li>
        <li><span class="step-num">3</span><span><strong>Month-to-Month</strong> &mdash; Where permitted by local law and the property owner, we may be able to convert your tenancy to month-to-month.</span></li>
      </ul>
    </div>

    ${CONTACT_ROW}

    <div class="email-closing">
      <p class="closing-text">If you have already been in touch with our team about your renewal, please disregard this automated reminder.</p>
      <div class="sign-off">Choice Properties Leasing Team</div>
      <div class="sign-company">choiceproperties404@gmail.com</div>
    </div>
  </div>
  ${EMAIL_FOOTER}
</div>
</body>
</html>`;
}

// ─── Phase 11 — Rent Increase Notice (tenant-facing) ────────────────────────

export function rentIncreaseNoticeHtml(
  tenantName: string,
  propertyAddress: string,
  currentRent: number,
  newRent: number,
  effectiveDate: string,
  noticeDaysRequired: number,
  isLargeIncrease: boolean,
  downloadUrl: string,
  portalUrl: string,
  appId: string): string {
  const fmt = (n: number) => '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const friendlyDate = new Date(effectiveDate + 'T00:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
  const pct = currentRent > 0 ? ((newRent - currentRent) / currentRent * 100) : 0;
  const largeNotice = isLargeIncrease
    ? `<div class="callout amber"><h4>Extended Notice Period Applied</h4><p style="margin:0">Because this increase exceeds your state's threshold, the extended ${noticeDaysRequired}-day notice period applies. The effective date above already accounts for this.</p></div>`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Notice of Rent Adjustment - Choice Properties</title>
  <style>${EMAIL_BASE_CSS}</style>
</head>
<body>
<div class="email-wrapper">
  ${buildEmailHeader('Notice of Rent Adjustment', appId)}
  <div class="email-body">
    <p class="greeting">Dear ${tenantName},</p>
    <p class="intro-text">This notice is being provided to inform you of an upcoming adjustment to the monthly rent for <strong>${propertyAddress}</strong>. A formal written notice has been generated and is attached to this email as a PDF for your records.</p>

    <div class="section">
      <div class="section-label">Adjustment Summary</div>
      <table class="info-table">
        <tr><td>Current monthly rent</td><td><strong>${fmt(currentRent)}</strong></td></tr>
        <tr><td>New monthly rent</td><td><strong>${fmt(newRent)}</strong></td></tr>
        <tr><td>Change</td><td><strong>${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%</strong></td></tr>
        <tr><td>Effective date</td><td><strong>${friendlyDate}</strong></td></tr>
        <tr><td>Notice period</td><td>${noticeDaysRequired} days</td></tr>
      </table>
    </div>

    ${largeNotice}

    <div class="cta-wrap">
      <a href="${downloadUrl}" class="cta-btn">Download formal notice (PDF)</a>
      <div class="cta-note">The download link above is valid for 7 days.</div>
    </div>

    <div class="section">
      <div class="section-label">Questions or Concerns</div>
      <p>If you have questions about this adjustment, the underlying rent calculation, or your tenant rights under your state's rent-stabilization rules, please reach out to our team using the contact information below. You can also view this notice at any time from your tenant portal: <a href="${portalUrl}" style="color:#0f172a">${portalUrl}</a>.</p>
    </div>

    ${CONTACT_ROW}

    <div class="email-closing">
      <p class="closing-text">Thank you for your continued tenancy.</p>
      <div class="sign-off">Choice Properties Leasing Team</div>
      <div class="sign-company">choiceproperties404@gmail.com</div>
    </div>
  </div>
  ${EMAIL_FOOTER}
</div>
</body>
</html>`;
}

// ─── Phase 11 — Termination Notice (tenant-facing) ──────────────────────────

export function terminationNoticeHtml(
  tenantName: string,
  propertyAddress: string,
  noticeType: string,
  effectiveDate: string,
  noticeDaysRequired: number,
  noticeStatute: string | null,
  reasonText: string | null,
  downloadUrl: string,
  portalUrl: string,
  appId: string): string {
  const friendlyDate = new Date(effectiveDate + 'T00:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
  const typeLabels: Record<string, string> = {
    mutual: 'Mutual Termination',
    tenant_no_renewal: 'Tenant Non-Renewal',
    landlord_no_renewal: 'Landlord Non-Renewal',
    for_cause: 'For-Cause Termination',
  };
  const typeLabel = typeLabels[noticeType] || 'Lease Termination';
  const reasonBlock = reasonText
    ? `<div class="section"><div class="section-label">Stated Reason</div><p>${reasonText}</p></div>`
    : '';
  const statuteBlock = noticeStatute
    ? `<p style="font-size:13px;color:#64748b;margin-top:12px">Statutory authority: ${noticeStatute}</p>`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Notice of Lease Termination - Choice Properties</title>
  <style>${EMAIL_BASE_CSS}</style>
</head>
<body>
<div class="email-wrapper">
  ${buildEmailHeader('Notice of Lease Termination', appId)}
  <div class="email-body">
    <p class="greeting">Dear ${tenantName},</p>
    <p class="intro-text">A formal notice of termination has been issued for your tenancy at <strong>${propertyAddress}</strong>. The notice has been generated as a PDF and is available via the download link below; please retain a copy for your records.</p>

    <div class="section">
      <div class="section-label">Termination Summary</div>
      <table class="info-table">
        <tr><td>Notice type</td><td><strong>${typeLabel}</strong></td></tr>
        <tr><td>Effective date</td><td><strong>${friendlyDate}</strong></td></tr>
        <tr><td>Statutory notice period</td><td>${noticeDaysRequired} days</td></tr>
      </table>
      ${statuteBlock}
    </div>

    ${reasonBlock}

    <div class="cta-wrap">
      <a href="${downloadUrl}" class="cta-btn">Download formal notice (PDF)</a>
      <div class="cta-note">The download link above is valid for 7 days.</div>
    </div>

    <div class="section">
      <div class="section-label">What Happens Next</div>
      <p>Please review the attached PDF carefully. It contains the legal effective date, your obligations during the notice period, and information about move-out coordination, the move-out inspection, and the security-deposit return process.</p>
      <p>You can revisit this notice at any time from your tenant portal: <a href="${portalUrl}" style="color:#0f172a">${portalUrl}</a>.</p>
    </div>

    ${CONTACT_ROW}

    <div class="email-closing">
      <p class="closing-text">If you have questions about the legal basis for this notice or your rights under your state's tenant-protection statute, please contact our office at the number above.</p>
      <div class="sign-off">Choice Properties Leasing Team</div>
      <div class="sign-company">choiceproperties404@gmail.com</div>
    </div>
  </div>
  ${EMAIL_FOOTER}
</div>
</body>
</html>`;
}

// ─── Phase 09 — Deposit Dispute Filed (admin-facing) ────────────────────────

export function depositDisputeAdminHtml(
  tenantName: string,
  tenantEmail: string,
  propertyAddress: string,
  appId: string,
  accountingId: string,
  disputeText: string,
  isFirstDispute: boolean,
  stateCode: string | null,
  stateReturnDeadline: string | null): string {
  const safeDispute = disputeText
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  const titleText = isFirstDispute ? 'New Deposit Dispute Filed' : 'Deposit Dispute Updated';
  const deadlineRow = stateReturnDeadline
    ? `<tr><td>State return deadline</td><td>${stateReturnDeadline}</td></tr>`
    : '';
  const stateRow = stateCode ? `<tr><td>State</td><td>${stateCode}</td></tr>` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${titleText} - Choice Properties</title>
  <style>${EMAIL_BASE_CSS}</style>
</head>
<body>
<div class="email-wrapper">
  ${buildEmailHeader(titleText, appId)}
  <div class="status-line" style="background:#fef2f2;color:#991b1b;border-color:#fecaca">Action Required - Tenant Has Disputed the Deposit Accounting</div>
  <div class="email-body">
    <p class="greeting">Team,</p>
    <p class="intro-text">${isFirstDispute ? 'A tenant has filed' : 'A tenant has updated'} a formal dispute against the security-deposit accounting on file. The disputed text is included below verbatim and has been persisted to <code>lease_deposit_accountings.tenant_dispute_text</code>.</p>

    <div class="section">
      <div class="section-label">Dispute Details</div>
      <table class="info-table">
        <tr><td>Tenant</td><td><strong>${tenantName}</strong></td></tr>
        <tr><td>Tenant email</td><td>${tenantEmail}</td></tr>
        <tr><td>Property</td><td>${propertyAddress}</td></tr>
        <tr><td>Application ID</td><td><strong>${appId}</strong></td></tr>
        <tr><td>Accounting ID</td><td><code>${accountingId}</code></td></tr>
        ${stateRow}
        ${deadlineRow}
      </table>
    </div>

    <div class="section">
      <div class="section-label">Tenant's Statement</div>
      <div class="callout amber" style="white-space:pre-wrap">${safeDispute}</div>
    </div>

    <div class="callout">
      <h4>Recommended Next Steps</h4>
      <p style="margin-bottom:8px">1. Review the original itemized deductions in the admin dashboard.</p>
      <p style="margin-bottom:8px">2. Respond to the tenant in writing within your state's statutory window${stateReturnDeadline ? ` (deadline on file: <strong>${stateReturnDeadline}</strong>)` : ''}.</p>
      <p style="margin-bottom:0">3. If the dispute is resolved, document the outcome in the accounting record before issuing any partial refund.</p>
    </div>

    <div class="email-closing">
      <div class="sign-off">Choice Properties System</div>
      <div class="sign-company">Automated dispute notification</div>
    </div>
  </div>
  ${EMAIL_FOOTER}
</div>
</body>
</html>`;
}

// ─── Landlord notification templates ─────────────────────────────────────────
// Compact, action-oriented emails sent directly to the property's landlord.

function buildLandlordHeader(title: string, appId?: string): string {
  return `
  <div style="background:#fff;padding:24px 32px 16px;border-bottom:3px solid #1a5276">
    <div style="font-size:18px;font-weight:700;color:#1a1a1a;margin-bottom:2px">Choice Properties</div>
    <div style="font-size:11px;color:#888;margin-bottom:12px">Landlord Notification</div>
    <div style="font-size:18px;font-weight:700;color:#1a1a1a;line-height:1.3">${title}</div>
    ${appId ? `<div style="font-size:11px;color:#888;font-family:monospace;margin-top:4px">Ref: ${appId}</div>` : ''}
  </div>`;
}

const LANDLORD_FOOTER = `
  <div style="background:#f8f8f8;border-top:1px solid #e0e0e0;padding:16px 32px;text-align:center;font-size:12px;color:#888;line-height:1.7">
    Choice Properties &middot; 2265 Livernois, Suite 500, Troy MI 48083<br>
    This notification was sent because you are the registered landlord for this property.
  </div>`;

function landlordWrap(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    * { margin:0;padding:0;box-sizing:border-box; }
    body { background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a; }
    .wrap { max-width:560px;margin:20px auto;background:#fff;border:1px solid #e0e0e0;border-radius:4px;overflow:hidden; }
    .body { padding:28px 32px; }
    .row { display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #f0f0f0;font-size:13px; }
    .row:last-child { border-bottom:none; }
    .lbl { color:#666;font-weight:600;width:40%;padding-right:8px; }
    .val { color:#111;flex:1; }
    .cta { display:inline-block;background:#1a5276;color:#fff !important;text-decoration:none;padding:12px 28px;border-radius:4px;font-size:13px;font-weight:700;margin-top:20px; }
  </style>
</head>
<body>
<div class="wrap">${content}${LANDLORD_FOOTER}</div>
</body>
</html>`;
}

export function landlordNewApplicationHtml(
  landlordName: string,
  applicantFirstName: string,
  applicantLastName: string,
  applicantEmail: string,
  propertyAddress: string,
  appId: string,
  adminUrl: string): string {
  const greeting = landlordName ? `Hi ${landlordName},` : 'Hello,';
  return landlordWrap(`
  ${buildLandlordHeader('New Application Received', appId)}
  <div class="body">
    <p style="font-size:15px;font-weight:600;margin-bottom:16px">${greeting}</p>
    <p style="font-size:13px;color:#444;line-height:1.7;margin-bottom:20px">
      A new rental application has been submitted for your property. Our leasing team will review it and keep you informed of each step.
    </p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;padding:16px;margin-bottom:20px">
      <div class="row"><span class="lbl">Applicant</span><span class="val"><strong>${applicantFirstName} ${applicantLastName}</strong></span></div>
      <div class="row"><span class="lbl">Property</span><span class="val">${propertyAddress}</span></div>
      <div class="row"><span class="lbl">Reference</span><span class="val" style="font-family:monospace">${appId}</span></div>
      <div class="row"><span class="lbl">Status</span><span class="val">Under review</span></div>
    </div>
    <a href="${adminUrl}" class="cta">View in Admin Portal</a>
    <p style="font-size:12px;color:#888;margin-top:16px;line-height:1.6">You will receive another notification once the application is approved or denied. Questions? Contact us at choiceproperties404@gmail.com</p>
  </div>`);
}
export function landlordAppStatusHtml(
  landlordName: string,
  applicantName: string,
  propertyAddress: string,
  status: 'approved' | 'denied' | 'waitlisted',
  appId: string,
  adminUrl: string): string {
  const greeting = landlordName ? `Hi ${landlordName},` : 'Hello,';
  const statusLabel = status === 'approved' ? '✅ Approved' : status === 'denied' ? 'Not Approved' : '⏳ Waitlisted';
  const statusColor = status === 'approved' ? '#166534' : status === 'denied' ? '#991b1b' : '#b45309';
  const detail = status === 'approved'
    ? 'The application has been approved. A lease will be generated and sent to the tenant for signature shortly.'
    : status === 'denied'
    ? 'The application decision is Not Approved. We will notify the applicant by email.'
    : 'The applicant has been placed on the waitlist pending a unit becoming available.';
  return landlordWrap(`
  ${buildLandlordHeader('Application Status Update', appId)}
  <div class="body">
    <p style="font-size:15px;font-weight:600;margin-bottom:16px">${greeting}</p>
    <p style="font-size:13px;color:#444;line-height:1.7;margin-bottom:20px">${detail}</p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;padding:16px;margin-bottom:20px">
      <div class="row"><span class="lbl">Applicant</span><span class="val"><strong>${applicantName}</strong></span></div>
      <div class="row"><span class="lbl">Property</span><span class="val">${propertyAddress}</span></div>
      <div class="row"><span class="lbl">Reference</span><span class="val" style="font-family:monospace">${appId}</span></div>
      <div class="row"><span class="lbl">Decision</span><span class="val"><strong style="color:${statusColor}">${statusLabel}</strong></span></div>
    </div>
    <a href="${adminUrl}" class="cta">View in Admin Portal</a>
  </div>`);
}

export function landlordTenantSignedHtml(
  landlordName: string,
  tenantName: string,
  propertyAddress: string,
  appId: string,
  adminUrl: string): string {
  const greeting = landlordName ? `Hi ${landlordName},` : 'Hello,';
  return landlordWrap(`
  ${buildLandlordHeader('Tenant Has Signed Their Lease', appId)}
  <div class="body">
    <p style="font-size:15px;font-weight:600;margin-bottom:16px">${greeting}</p>
    <p style="font-size:13px;color:#444;line-height:1.7;margin-bottom:20px">
      Your tenant has signed their lease agreement. Our team will countersign shortly, after which the fully-executed lease will be sent to all parties.
    </p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;padding:16px;margin-bottom:20px">
      <div class="row"><span class="lbl">Tenant</span><span class="val"><strong>${tenantName}</strong></span></div>
      <div class="row"><span class="lbl">Property</span><span class="val">${propertyAddress}</span></div>
      <div class="row"><span class="lbl">Reference</span><span class="val" style="font-family:monospace">${appId}</span></div>
      <div class="row"><span class="lbl">Status</span><span class="val"><strong style="color:#1e40af">Pending countersignature</strong></span></div>
    </div>
    <a href="${adminUrl}" class="cta">View in Admin Portal</a>
  </div>`);
}

export function landlordLeaseExecutedHtml(
  landlordName: string,
  tenantName: string,
  propertyAddress: string,
  leaseStart: string | undefined,
  appId: string,
  adminUrl: string): string {
  const greeting = landlordName ? `Hi ${landlordName},` : 'Hello,';
  const startRow = leaseStart
    ? `<div class="row"><span class="lbl">Lease start</span><span class="val">${formatDate(leaseStart)}</span></div>`
    : '';
  return landlordWrap(`
  ${buildLandlordHeader('Lease Fully Executed', appId)}
  <div class="body">
    <p style="font-size:15px;font-weight:600;margin-bottom:16px">${greeting}</p>
    <p style="font-size:13px;color:#444;line-height:1.7;margin-bottom:20px">
      The lease for your property has been fully executed by all parties. A copy of the signed lease has been sent to the tenant. Your tenancy is now active.
    </p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;padding:16px;margin-bottom:20px">
      <div class="row"><span class="lbl">Tenant</span><span class="val"><strong>${tenantName}</strong></span></div>
      <div class="row"><span class="lbl">Property</span><span class="val">${propertyAddress}</span></div>
      <div class="row"><span class="lbl">Reference</span><span class="val" style="font-family:monospace">${appId}</span></div>
      ${startRow}
      <div class="row"><span class="lbl">Status</span><span class="val"><strong style="color:#166534">✅ Active lease</strong></span></div>
    </div>
    <a href="${adminUrl}" class="cta">View in Admin Portal</a>
  </div>`);
}
