// Choice Properties — Canonical UX Copy (server-side mirror)
// -----------------------------------------------------------
// Mirror of js/cp-copy.js. Edits here MUST be reflected in:
//   - js/cp-copy.js
//   - GAS-EMAIL-RELAY.gs (COPY block at top of file)
//
// Single platform flow everywhere:
//   Apply -> Payment -> Review -> Approval -> Reservation -> Lease -> Move-In

export type Lang = 'en' | 'es';

export const COPY_EN = {
  // Fee & payment
  feeStatement:
    'A $50 application fee is required after submission. Our team will contact you to securely complete payment before your application is reviewed.',
  feeReinforcement: 'Applications are only activated after payment is completed.',

  // Review timing
  reviewTime:
    'Applications are typically processed within 24 to 72 hours after payment is completed.',
  reviewBehavior:
    'Faster decisions are often made for applicants who complete all steps promptly, provide accurate information, and remain responsive.',
  reviewPriority:
    'Applicants who act quickly are often prioritized in the review process.',

  // Status framing
  statusActiveReview: 'In Active Review',
  statusActiveReviewDesc: 'Your application is being evaluated for selection.',
  submissionConfirm:
    'Your application is now being evaluated for qualification. Payment is the next step to activate review.',
  activelyProcessing: 'Your application is actively being processed.',
  activeQueue: 'Your application is currently in the active review queue.',

  // Competition / urgency
  demandNotice:
    'Due to demand, multiple applications may be reviewed for the same property.',
  promptUrgency:
    'Completing steps promptly helps improve your chances of securing the property.',
  payQueueNotice:
    'Applicants who complete payment quickly are placed earlier in the review queue.',
  delayWarning: 'Delayed actions may affect processing priority.',

  // Holding fee
  holdingDefinition:
    'The holding fee temporarily reserves the property and removes it from active availability while your lease is being finalized.',
  holdingNoHoldRisk:
    'Without a holding fee, the property remains available to other approved applicants.',
  holdingUrgency:
    'Holding requests are time-sensitive and typically must be completed within 24 to 48 hours.',
  holdingTrust:
    'This fee is fully credited toward your move-in costs and is not an additional charge.',

  // Approval (opportunity-window)
  selectedHeadline: 'You have been selected based on your application.',
  selectionTimeSensitive: 'This selection is time-sensitive.',
  selectionNextStep: 'To secure this unit, complete the next steps promptly.',
  firstCompletion:
    'Units are offered on a first-completion basis among approved applicants.',

  // Lease
  leaseFinalStage:
    'You are now entering the final stage of securing your approved unit.',
  leaseFirstCompleted:
    'Units are confirmed on a first-completed basis until fully executed.',
  leaseWindow:
    'Please complete your lease within 48 hours to maintain your reservation.',

  // Marketing
  coverageClaim:
    'Expanding nationwide with active listings in select markets.',
  processClaim: 'A clear, structured process with transparent steps.',

  // Identity
  supportEmail: 'support@choiceproperties.com',
  supportPhone: '707-706-3137',
} as const;

export const COPY_ES: typeof COPY_EN = {
  feeStatement:
    'Se requiere un cargo de solicitud de $50 después de enviar su solicitud. Nuestro equipo lo contactará para completar el pago de forma segura antes de revisar su solicitud.',
  feeReinforcement: 'Las solicitudes solo se activan después de completar el pago.',

  reviewTime:
    'Las solicitudes generalmente se procesan dentro de 24 a 72 horas después de completar el pago.',
  reviewBehavior:
    'Las decisiones más rápidas suelen tomarse para quienes completan todos los pasos con prontitud, brindan información precisa y responden a tiempo.',
  reviewPriority:
    'Los solicitantes que actúan rápidamente suelen tener prioridad en el proceso de revisión.',

  statusActiveReview: 'En Revisión Activa',
  statusActiveReviewDesc: 'Su solicitud está siendo evaluada para selección.',
  submissionConfirm:
    'Su solicitud ahora está siendo evaluada para calificación. El siguiente paso es el pago para activar la revisión.',
  activelyProcessing: 'Su solicitud está siendo procesada activamente.',
  activeQueue: 'Su solicitud está actualmente en la cola de revisión activa.',

  demandNotice:
    'Debido a la demanda, pueden revisarse varias solicitudes para la misma propiedad.',
  promptUrgency:
    'Completar los pasos con prontitud ayuda a mejorar sus posibilidades de asegurar la propiedad.',
  payQueueNotice:
    'Los solicitantes que completan el pago rápidamente se colocan antes en la cola de revisión.',
  delayWarning: 'Las demoras pueden afectar la prioridad de procesamiento.',

  holdingDefinition:
    'El cargo de reserva retiene temporalmente la propiedad y la retira de la disponibilidad activa mientras se finaliza su contrato.',
  holdingNoHoldRisk:
    'Sin un cargo de reserva, la propiedad permanece disponible para otros solicitantes aprobados.',
  holdingUrgency:
    'Las solicitudes de reserva son sensibles al tiempo y normalmente deben completarse dentro de 24 a 48 horas.',
  holdingTrust:
    'Este cargo se acredita en su totalidad a sus costos de entrada y no es un cargo adicional.',

  selectedHeadline: 'Ha sido seleccionado/a según su solicitud.',
  selectionTimeSensitive: 'Esta selección es sensible al tiempo.',
  selectionNextStep: 'Para asegurar esta unidad, complete los siguientes pasos con prontitud.',
  firstCompletion:
    'Las unidades se ofrecen por orden de finalización entre los solicitantes aprobados.',

  leaseFinalStage:
    'Ahora está entrando en la etapa final para asegurar su unidad aprobada.',
  leaseFirstCompleted:
    'Las unidades se confirman por orden de finalización hasta que se ejecuten por completo.',
  leaseWindow:
    'Por favor complete su contrato dentro de 48 horas para mantener su reserva.',

  coverageClaim:
    'En expansión nacional con propiedades activas en mercados seleccionados.',
  processClaim: 'Un proceso claro y estructurado con pasos transparentes.',

  supportEmail: 'support@choiceproperties.com',
  supportPhone: '707-706-3137',
};

export function copy(key: keyof typeof COPY_EN, lang: Lang = 'en'): string {
  const L = lang === 'es' ? COPY_ES : COPY_EN;
  return L[key] ?? COPY_EN[key] ?? '';
}
