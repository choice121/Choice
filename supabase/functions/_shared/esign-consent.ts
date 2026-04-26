// Choice Properties -- Phase 05 -- E-SIGN Act consumer consent disclosure
//
// 15 USC Sec 7001(c) requires three specific consumer-disclosure points
// before any electronic record may take the place of a paper original:
//
//   1. The hardware/software requirements to access electronic records
//   2. The right to receive a paper copy
//   3. The right to withdraw consent (and the procedure to do so)
//
// We ask the signer to acknowledge each of those three points individually
// (three separate checkboxes) before they can view the lease body.  The
// version string below is bumped whenever the disclosure text materially
// changes, which forces every signer to re-acknowledge the new version.

export const ESIGN_DISCLOSURE_VERSION = '2026-04-v1';

export interface ESignDisclosure {
  version:               string;
  intro:                 string;
  hardware_software:     string;
  paper_copy_right:      string;
  withdrawal_right:      string;
  paper_copy_procedure:  string;
  withdrawal_procedure:  string;
  contact_email:         string;
  contact_phone:         string;
}

export const ESIGN_DISCLOSURE: ESignDisclosure = {
  version: ESIGN_DISCLOSURE_VERSION,

  intro:
    'Federal law (the E-SIGN Act, 15 USC Sec 7001) requires Choice Properties ' +
    'to obtain your explicit consent before we can substitute an electronic ' +
    'lease for a paper one. Please review the three points below carefully ' +
    'and check each box to confirm you understand and agree.',

  hardware_software:
    'I confirm that I have access to a device with a modern web browser ' +
    '(such as Chrome, Safari, Firefox, or Edge), an internet connection, ' +
    'and an email account, and that I am able to view and save PDF documents. ' +
    'These are the system requirements I need to access this lease and any ' +
    'future lease-related electronic records from Choice Properties.',

  paper_copy_right:
    'I understand that I have the right to receive this lease (and any ' +
    'amendment, addendum, or related notice) on paper. I may request a ' +
    'paper copy at any time -- before or after I sign -- by contacting ' +
    'Choice Properties at the email or phone number below. There is no fee ' +
    'for the first paper copy.',

  withdrawal_right:
    'I understand that I have the right to withdraw my consent to receive ' +
    'records electronically. Withdrawal does not invalidate any record ' +
    'previously delivered or signed electronically; it applies only to ' +
    'future records. To withdraw consent, contact Choice Properties at the ' +
    'email or phone number below and state that you wish to withdraw E-SIGN ' +
    'consent. We will switch you to paper delivery within 5 business days.',

  paper_copy_procedure:
    'Email support@choiceproperties.com or call 707-706-3137 with your ' +
    'application reference number.',

  withdrawal_procedure:
    'Email support@choiceproperties.com or call 707-706-3137 stating ' +
    'your intent to withdraw E-SIGN consent.',

  contact_email: 'support@choiceproperties.com',
  contact_phone: '707-706-3137',
};
