// ============================================================
// Choice Properties — Email i18n strings
// supabase/functions/_shared/i18n.ts
//
// Phase: bilingual (EN / ES) email pipeline foundation.
//
// Each transactional template imports the `t(locale, key)` helper
// to resolve user-facing strings. Adding a new locale = drop another
// dictionary into LOCALES and the templates pick it up automatically.
//
// Placeholder syntax: {name}, {appId}, etc. Substitution is done via
// the second arg of t() and is HTML-safe (caller is responsible for
// escaping interpolated user content before passing it in).
// ============================================================

export type Locale = 'en' | 'es';

export const SUPPORTED_LOCALES: Locale[] = ['en', 'es'];

/**
 * Normalize an arbitrary value to a supported Locale, defaulting to 'en'.
 * Accepts ISO short codes ('en', 'es'), region tags ('en-US', 'es-MX'),
 * and case variations.
 */
export function resolveLocale(input: unknown): Locale {
  if (!input || typeof input !== 'string') return 'en';
  const tag = input.toLowerCase().split(/[-_]/)[0];
  return (SUPPORTED_LOCALES as string[]).includes(tag) ? (tag as Locale) : 'en';
}

type Dict = Record<string, string>;

const STRINGS: Record<Locale, Dict> = {
  en: {
    // Common chrome
    'common.brand':                'Choice Properties',
    'common.tagline':              'Nationwide Rental Marketplace',
    'common.questions':            'Questions?',
    'common.contact_text':         'Text:',
    'common.greeting':             'Dear {name},',
    'common.signoff_team':         'Choice Properties Leasing Team',
    'common.signoff_system':       'Choice Properties System',
    'common.reference':            'Reference: {appId}',
    'common.cta_or_visit':         'Or visit:',

    // Footer
    'footer.address_line1':        '2265 Livernois, Suite 500 · Troy, MI 48083',
    'footer.address_line2':        '707-706-3137 (Text Only) · support@choiceproperties.com',
    'footer.tagline':              'Your trust is our standard.',
    'footer.policies':             'Policy Framework',
    'footer.terms':                'Terms',
    'footer.privacy':              'Privacy',
    'footer.fair_housing':         'Fair Housing',
    'footer.changelog':            'Changelog',
    'footer.transactional_notice':
      'You are receiving this transactional email because you submitted an application or signed a lease through Choice Properties. This is not a marketing message.',
    'footer.sms':
      '<strong>SMS:</strong> Reply HELP for help, STOP to opt out. Msg & data rates may apply. SMS opt-out does not affect application emails.',

    // Application confirmation
    'app_conf.title':              'Application Successfully Received',
    'app_conf.subject':            'Application Received — Choice Properties',
    'app_conf.status':             '⏳   Awaiting Application Fee · Review Pending',
    'app_conf.intro':
      'Thank you for choosing Choice Properties. We have successfully received your rental application and your file is now in our system. This confirmation serves as your official acknowledgment that your submission has been recorded.',
    'app_conf.summary':            'Application Summary',
    'app_conf.application_id':     'Application ID',
    'app_conf.applicant_name':     'Applicant Name',
    'app_conf.property':           'Property of Interest',
    'app_conf.move_in':            'Requested Move-In',
    'app_conf.lease_term':         'Lease Term',
    'app_conf.email_on_file':      'Email on File',
    'app_conf.phone_on_file':      'Phone on File',
    'app_conf.fee_section':        'Application Fee & Payment',
    'app_conf.fee_heading':        'Application Fee — {fee}',
    'app_conf.fee_body':
      'A member of our leasing team will contact you within 24 hours via text{phoneSuffix} to coordinate your application fee. Your application will not be reviewed until payment is received and confirmed.',
    'app_conf.next_section':       'What Happens Next',
    'app_conf.step1':              'Payment Arrangement — Our leasing team will contact you within 24 hours to coordinate your application fee via your preferred payment method.',
    'app_conf.step2':              'Payment Confirmation — Once your fee is received and confirmed, you will receive an email notification and your application will advance to the review stage.',
    'app_conf.step3':              'Application Review — Our team will conduct a thorough review within 24–72 hours of payment confirmation. Applicants who complete steps promptly are often prioritized.',
    'app_conf.step4':              'Decision Notification — You will be notified of our decision via email. If approved, our leasing team will prepare your lease agreement for signature.',
    'app_conf.save_id_heading':    'Important — Save Your Application ID',
    'app_conf.save_id_body':
      'Your application ID is <strong>{appId}</strong>. Please save this reference number. You will use it to track your application status and access your tenant portal at any time.',
    'app_conf.cta':                'Track My Application',
    'app_conf.closing':
      'Should you have any questions prior to hearing from our team, please do not hesitate to reach out. We are committed to making this process as clear and straightforward as possible.',

    // Signing page UI — Phase 12
    'sign_page.title':              'Sign Your Lease — Choice Properties',
    'sign_page.header_sub':         'Lease Signing Portal',
    'sign_page.loading':            'Loading your lease\u2026',
    'sign_page.loading_wait':       'Please wait a moment.',
    'sign_page.err_no_token_title': 'No Signing Token',
    'sign_page.err_no_token_body':  'This page requires a valid signing link from your email.',
    'sign_page.err_conn_title':     'Connection Error',
    'sign_page.err_conn_body':      'Could not connect to the signing server. Please try again.',
    'sign_page.err_expired_title':  'Link Expired or Invalid',
    'sign_page.err_already_title':  'Already Signed',
    'sign_page.success_title':      'Lease Signed Successfully',
    'sign_page.success_body':       'Thank you! Your signature has been recorded and a confirmation email is on its way to you.',
    'sign_page.success_view':       '\u21e9 View & Download',
    'sign_page.atag_heading':       'Your Lease at a Glance',
    'sign_page.atag_monthly_rent':  'Monthly Rent',
    'sign_page.atag_property':      'Property',
    'sign_page.atag_lease_term':    'Lease Term',
    'sign_page.atag_term_to':       'to',
    'sign_page.atag_deposit':       'Security Deposit',
    'sign_page.atag_notice':        'Written notice required to end the tenancy — check the lease for the exact number of days.',
    'sign_page.atag_late':          'A late fee may apply if rent is not received by the due date — see the full lease for details.',
    'sign_page.atag_pets':          'All pets must be pre-approved in writing — check the addenda for the pet policy.',
    'sign_page.card_subhead':       'Application ID:',
    'sign_page.card_review':        'Please review carefully before signing.',
    'sign_page.signer_primary':     'You are signing as the <strong>primary applicant</strong>',
    'sign_page.signer_coapp':       'You are signing as the <strong>co-applicant</strong>. The primary applicant has already signed.',
    'sign_page.signer_amend':       'You are signing a <strong>lease amendment</strong>. Your existing lease remains in effect.',
    'sign_page.label_tenant':       'Tenant',
    'sign_page.label_property':     'Property',
    'sign_page.label_start':        'Lease Start',
    'sign_page.label_end':          'Lease End',
    'sign_page.label_rent':         'Monthly Rent',
    'sign_page.label_deposit':      'Security Deposit',
    'sign_page.label_for_tenant':   'For Tenant',
    'sign_page.scroll_hint':        'Scroll to review full lease',
    'sign_page.amend_notice':       'Amendment to your existing lease',
    'sign_page.addenda_intro':      '<strong>Required disclosures and addenda.</strong> The following documents form an integral part of your lease and are required by federal, state, or local law. <strong>Please review each one and check the acknowledgment box</strong> before signing the lease below.',
    'sign_page.addenda_all_acked':  '\u2713 All {n} addenda acknowledged',
    'sign_page.addenda_progress':   '{done} of {n} addenda acknowledged',
    'sign_page.ack_label':          'I have read and agree to this addendum ({title}).',
    'sign_page.sign_title':         'Sign Your Lease',
    'sign_page.sign_title_coapp':   'Sign as Co-Applicant',
    'sign_page.sign_title_amend':   'Sign Amendment',
    'sign_page.sign_help':          'Type your full legal name as your electronic signature, optionally draw your signature below, then check the agreement box.',
    'sign_page.sign_help_coapp':    'By signing you become jointly and severally liable for the lease alongside the primary applicant.',
    'sign_page.sign_help_amend':    'Type your full legal name to sign this amendment. Your original lease is unaffected.',
    'sign_page.email_label':        'Your Email Address (the one we contacted you at)',
    'sign_page.name_label':         'Full Legal Name (as it appears on your ID)',
    'sign_page.name_placeholder':   'e.g. Jane Marie Doe',
    'sign_page.sig_preview_empty':  'Your signature will appear here',
    'sign_page.draw_label':         'Draw your signature (optional)',
    'sign_page.draw_hint':          'For added verification \u00b7 the typed name above is what is legally binding',
    'sign_page.pad_clear':          'Clear drawing',
    'sign_page.agree_label':        'I have read and agree to all terms and conditions of this lease agreement and to each of the required addenda above. I understand this constitutes a legally binding electronic signature under the federal E-SIGN Act.',
    'sign_page.btn_sign':           'Sign Lease Agreement',
    'sign_page.btn_sign_coapp':     'Sign as Co-Applicant',
    'sign_page.btn_sign_amend':     'Sign Amendment',
    'sign_page.btn_submitting':     'Submitting\u2026',
    'sign_page.err_conn':           'Connection error. Please try again.',
    'sign_page.btn_consent_text':   'I Consent \u2014 Continue to the Document',
    'sign_page.consent_submitting': 'Submitting\u2026',
  },

  es: {
    // Common chrome
    'common.brand':                'Choice Properties',
    'common.tagline':              'Mercado Nacional de Alquileres',
    'common.questions':            '¿Preguntas?',
    'common.contact_text':         'Texto:',
    'common.greeting':             'Estimado/a {name}:',
    'common.signoff_team':         'Equipo de Arrendamiento de Choice Properties',
    'common.signoff_system':       'Sistema de Choice Properties',
    'common.reference':            'Referencia: {appId}',
    'common.cta_or_visit':         'O visite:',

    // Footer
    'footer.address_line1':        '2265 Livernois, Suite 500 · Troy, MI 48083',
    'footer.address_line2':        '707-706-3137 (Solo Texto) · support@choiceproperties.com',
    'footer.tagline':              'Su confianza es nuestro estándar.',
    'footer.policies':             'Marco de Políticas',
    'footer.terms':                'Términos',
    'footer.privacy':              'Privacidad',
    'footer.fair_housing':         'Vivienda Justa',
    'footer.changelog':            'Historial de Cambios',
    'footer.transactional_notice':
      'Está recibiendo este correo transaccional porque envió una solicitud o firmó un contrato a través de Choice Properties. Este no es un mensaje de marketing.',
    'footer.sms':
      '<strong>SMS:</strong> Responda HELP para ayuda, STOP para cancelar. Pueden aplicar cargos por mensaje y datos. Cancelar SMS no afecta los correos de su solicitud.',

    // Application confirmation
    'app_conf.title':              'Solicitud Recibida con Éxito',
    'app_conf.subject':            'Solicitud Recibida — Choice Properties',
    'app_conf.status':             '⏳   Esperando Tarifa de Solicitud · Revisión Pendiente',
    'app_conf.intro':
      'Gracias por elegir Choice Properties. Hemos recibido con éxito su solicitud de alquiler y su expediente está ahora en nuestro sistema. Esta confirmación sirve como acuse de recibo oficial de que su envío ha sido registrado.',
    'app_conf.summary':            'Resumen de la Solicitud',
    'app_conf.application_id':     'ID de la Solicitud',
    'app_conf.applicant_name':     'Nombre del Solicitante',
    'app_conf.property':           'Propiedad de Interés',
    'app_conf.move_in':            'Fecha de Mudanza Solicitada',
    'app_conf.lease_term':         'Plazo del Contrato',
    'app_conf.email_on_file':      'Correo en Archivo',
    'app_conf.phone_on_file':      'Teléfono en Archivo',
    'app_conf.fee_section':        'Tarifa de Solicitud y Pago',
    'app_conf.fee_heading':        'Tarifa de Solicitud — {fee}',
    'app_conf.fee_body':
      'Un miembro de nuestro equipo de arrendamiento se comunicará con usted en un plazo de 24 horas por mensaje de texto{phoneSuffix} para coordinar el pago de la tarifa de solicitud. Su solicitud no será revisada hasta que el pago sea recibido y confirmado.',
    'app_conf.next_section':       'Qué Sigue',
    'app_conf.step1':              'Coordinación del Pago — Nuestro equipo se comunicará con usted en 24 horas para coordinar la tarifa con su método de pago preferido.',
    'app_conf.step2':              'Confirmación del Pago — Una vez recibido y confirmado el pago, recibirá un correo y su solicitud avanzará a la etapa de revisión.',
    'app_conf.step3':              'Revisión de la Solicitud — Nuestro equipo realizará una revisión exhaustiva en un plazo de 24 a 72 horas tras la confirmación del pago. Quienes completen los pasos rápidamente suelen tener prioridad.',
    'app_conf.step4':              'Notificación de Decisión — Le notificaremos nuestra decisión por correo. Si es aprobada, nuestro equipo preparará su contrato para la firma.',
    'app_conf.save_id_heading':    'Importante — Guarde el ID de su Solicitud',
    'app_conf.save_id_body':
      'El ID de su solicitud es <strong>{appId}</strong>. Por favor guarde este número de referencia. Lo usará para dar seguimiento al estado de su solicitud y acceder a su portal de inquilino en cualquier momento.',
    'app_conf.cta':                'Seguir mi Solicitud',
    'app_conf.closing':
      'Si tiene preguntas antes de que nuestro equipo se comunique con usted, no dude en escribirnos. Estamos comprometidos a hacer este proceso lo más claro y sencillo posible.',

    // Signing page UI — Phase 12
    'sign_page.title':              'Firme Su Contrato — Choice Properties',
    'sign_page.header_sub':         'Portal de Firma de Contrato',
    'sign_page.loading':            'Cargando su contrato\u2026',
    'sign_page.loading_wait':       'Por favor espere un momento.',
    'sign_page.err_no_token_title': 'Sin Token de Firma',
    'sign_page.err_no_token_body':  'Esta página requiere un enlace de firma válido de su correo electrónico.',
    'sign_page.err_conn_title':     'Error de Conexión',
    'sign_page.err_conn_body':      'No se pudo conectar al servidor de firmas. Por favor intente de nuevo.',
    'sign_page.err_expired_title':  'Enlace Vencido o No Válido',
    'sign_page.err_already_title':  'Ya Firmado',
    'sign_page.success_title':      'Contrato Firmado Exitosamente',
    'sign_page.success_body':       '¡Gracias! Su firma ha sido registrada y un correo de confirmación está en camino.',
    'sign_page.success_view':       '\u21e9 Ver y Descargar',
    'sign_page.atag_heading':       'Resumen de Su Contrato',
    'sign_page.atag_monthly_rent':  'Renta Mensual',
    'sign_page.atag_property':      'Propiedad',
    'sign_page.atag_lease_term':    'Período de Arrendamiento',
    'sign_page.atag_term_to':       'hasta',
    'sign_page.atag_deposit':       'Depósito de Seguridad',
    'sign_page.atag_notice':        'Se requiere aviso por escrito para terminar el arrendamiento — consulte el contrato para el número exacto de días.',
    'sign_page.atag_late':          'Puede aplicarse un cargo por mora si la renta no se recibe en la fecha de vencimiento — consulte el contrato completo.',
    'sign_page.atag_pets':          'Toda mascota debe ser pre-aprobada por escrito — consulte los adendos para la política de mascotas.',
    'sign_page.card_subhead':       'ID de Solicitud:',
    'sign_page.card_review':        'Por favor revise cuidadosamente antes de firmar.',
    'sign_page.signer_primary':     'Usted está firmando como <strong>solicitante principal</strong>',
    'sign_page.signer_coapp':       'Usted está firmando como <strong>co-solicitante</strong>. El solicitante principal ya firmó.',
    'sign_page.signer_amend':       'Usted está firmando una <strong>enmienda al contrato</strong>. Su contrato vigente permanece en efecto.',
    'sign_page.label_tenant':       'Inquilino',
    'sign_page.label_property':     'Propiedad',
    'sign_page.label_start':        'Inicio del Contrato',
    'sign_page.label_end':          'Fin del Contrato',
    'sign_page.label_rent':         'Renta Mensual',
    'sign_page.label_deposit':      'Depósito de Seguridad',
    'sign_page.label_for_tenant':   'Para Inquilino',
    'sign_page.scroll_hint':        'Desplácese para revisar el contrato completo',
    'sign_page.amend_notice':       'Enmienda a su contrato vigente',
    'sign_page.addenda_intro':      '<strong>Divulgaciones y adendos requeridos.</strong> Los siguientes documentos forman parte integral de su contrato y son requeridos por ley federal, estatal o local. <strong>Por favor revise cada uno y marque la casilla de reconocimiento</strong> antes de firmar el contrato abajo.',
    'sign_page.addenda_all_acked':  '\u2713 Los {n} adendos reconocidos',
    'sign_page.addenda_progress':   '{done} de {n} adendos reconocidos',
    'sign_page.ack_label':          'He leído y acepto este adendo ({title}).',
    'sign_page.sign_title':         'Firme Su Contrato',
    'sign_page.sign_title_coapp':   'Firmar como Co-Solicitante',
    'sign_page.sign_title_amend':   'Firmar Enmienda',
    'sign_page.sign_help':          'Escriba su nombre legal completo como firma electrónica, opcionalmente dibuje su firma abajo, luego marque la casilla de acuerdo.',
    'sign_page.sign_help_coapp':    'Al firmar, usted se convierte en solidariamente responsable del contrato junto con el solicitante principal.',
    'sign_page.sign_help_amend':    'Escriba su nombre legal completo para firmar esta enmienda. Su contrato original no se ve afectado.',
    'sign_page.email_label':        'Su Correo Electrónico (el que usamos para contactarle)',
    'sign_page.name_label':         'Nombre Legal Completo (como aparece en su identificación)',
    'sign_page.name_placeholder':   'p. ej. Jane Marie Doe',
    'sign_page.sig_preview_empty':  'Su firma aparecerá aquí',
    'sign_page.draw_label':         'Dibuje su firma (opcional)',
    'sign_page.draw_hint':          'Para verificación adicional \u00b7 el nombre escrito arriba es el que tiene validez legal',
    'sign_page.pad_clear':          'Borrar dibujo',
    'sign_page.agree_label':        'He leído y acepto todos los términos y condiciones de este contrato de arrendamiento y de cada uno de los adendos requeridos arriba. Entiendo que esto constituye una firma electrónica legalmente vinculante bajo la Ley Federal E-SIGN.',
    'sign_page.btn_sign':           'Firmar Contrato de Arrendamiento',
    'sign_page.btn_sign_coapp':     'Firmar como Co-Solicitante',
    'sign_page.btn_sign_amend':     'Firmar Enmienda',
    'sign_page.btn_submitting':     'Enviando\u2026',
    'sign_page.err_conn':           'Error de conexión. Por favor intente de nuevo.',
    'sign_page.btn_consent_text':   'Doy Mi Consentimiento \u2014 Continuar al Documento',
    'sign_page.consent_submitting': 'Enviando\u2026',
  },
};

/**
 * Resolve a translation, with English fallback for missing keys.
 * Substitutes {placeholder} tokens from the optional vars map.
 *
 * Caller is responsible for HTML-escaping any user-supplied values
 * before passing them in — `t()` does NOT escape (so HTML strings
 * inside the dictionary keep working, e.g. footer.sms).
 */
export function t(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const dict = STRINGS[locale] || STRINGS.en;
  const raw  = dict[key] ?? STRINGS.en[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_m, k) => (vars[k] != null ? String(vars[k]) : ''));
}

/**
 * Convenience: resolve a locale and return a curried t() bound to it.
 */
export function translator(input: unknown): (key: string, vars?: Record<string, string | number>) => string {
  const loc = resolveLocale(input);
  return (key, vars) => t(loc, key, vars);
}