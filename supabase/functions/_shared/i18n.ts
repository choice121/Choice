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
