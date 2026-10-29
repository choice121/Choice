/// <reference lib="deno.ns" />

import {
  adminNotificationHtml,
  applicationConfirmationHtml,
  coApplicantScreeningConsentHtml,
  paymentConfirmedHtml,
  statusUpdateHtml,
} from './email.ts';

function assertIncludes(value: string, expected: string): void {
  if (!value.includes(expected)) throw new Error(`Expected output to include: ${expected}`);
}

function assertExcludes(value: string, unexpected: string): void {
  if (value.includes(unexpected)) throw new Error(`Expected output to exclude: ${unexpected}`);
}

Deno.test('application confirmation calculates $50 and $100 for one or two adults', () => {
  const oneAdult = applicationConfirmationHtml('Alex', '22 Oak St', 'CP-ONE', { 'Has Co-Applicant': 'No' }, undefined, 50);
  const twoAdults = applicationConfirmationHtml('Alex', '22 Oak St', 'CP-TWO', { 'Has Co-Applicant': 'Yes' }, undefined, 100, true);

  assertIncludes(oneAdult, '1 adult applicant × $50 = $50 total');
  assertIncludes(twoAdults, '2 adult applicants × $50 = $100 total');
  assertIncludes(twoAdults, 'separate authorization link was emailed');
});

Deno.test('application and admin emails escape user-supplied HTML', () => {
  const payload = '<img src=x onerror=alert(1)>';
  const application = applicationConfirmationHtml(payload, payload, 'CP-XSS', {
    'Last Name': payload,
    Email: 'person@example.com',
    Phone: payload,
    'Has Co-Applicant': 'No',
  }, undefined, 50);
  const admin = adminNotificationHtml(payload, payload, 'person@example.com', payload, 'CP-XSS', {
    Phone: payload,
    Employer: payload,
    'Employment Status': payload,
    'Has Co-Applicant': 'No',
  }, 50);

  assertIncludes(application, '&lt;img src=x onerror=alert(1)&gt;');
  assertExcludes(application, '<img src=x onerror=alert(1)>');
  assertIncludes(admin, '&lt;img src=x onerror=alert(1)&gt;');
  assertExcludes(admin, '<img src=x onerror=alert(1)>');
  const status = statusUpdateHtml('CP-XSS', payload, 'denied', payload, 'https://example.test', payload);
  assertIncludes(status, '&lt;img src=x onerror=alert(1)&gt;');
  assertExcludes(status, '<img src=x onerror=alert(1)>');
});

Deno.test('consent invitation escapes the link and payment receipt avoids premature review status', () => {
  const consentEmail = coApplicantScreeningConsentHtml('Sam', 'CP-CONSENT', 'https://example.test/#token=<svg>');
  const pendingReceipt = paymentConfirmedHtml('Sam', '22 Oak St', 100, undefined, undefined, undefined, undefined, 'CP-CONSENT', undefined, 2, 50, true, false);

  assertIncludes(consentEmail, '&lt;svg&gt;');
  assertExcludes(consentEmail, '<svg>');
  assertIncludes(pendingReceipt, 'Waiting for Additional Adult Authorization');
  assertIncludes(pendingReceipt, 'Review will begin after the additional adult submits their separate screening authorization.');
  assertExcludes(pendingReceipt, 'Application Now Under Review');
});
