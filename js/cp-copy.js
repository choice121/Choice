/**
 * Choice Properties — Canonical UX Copy
 * --------------------------------------
 * Single source of truth for applicant-facing wording across the site.
 * Server-side mirror lives in supabase/functions/_shared/i18n.ts and
 * GAS-EMAIL-RELAY.gs (COPY block at top of file).
 *
 * The platform follows this exact flow everywhere:
 *   Apply -> Payment -> Review -> Approval -> Reservation -> Lease -> Move-In
 *
 * Do not edit copy in individual pages — update here, mirror to the
 * server-side files, and reference these strings from the page.
 */
(function (root) {
  'use strict';

  var EN = {
    // ── Fee & payment ─────────────────────────────────────────────────────
    feeStatement:
      'A $50 application fee is required after submission. Our team will contact you to securely complete payment before your application is reviewed.',
    feeReinforcement: 'Applications are only activated after payment is completed.',

    // ── Review timing ─────────────────────────────────────────────────────
    reviewTime:
      'Most application reviews are completed within 24 to 72 hours after fee confirmation. Timing can vary; this is an estimate, not a guaranteed decision time.',
    reviewBehavior:
      'Complete and accurate information can help avoid follow-up requests. Review order is not based on who pays or responds fastest.',
    reviewPriority:
      'Paying or responding faster does not provide application review priority or guarantee approval.',

    // ── Status framing (replaces "under review") ──────────────────────────
    statusActiveReview: 'In Active Review',
    statusActiveReviewDesc: 'Your application is being evaluated for selection.',
    submissionConfirm:
      'Your application is now being evaluated for qualification. Payment is the next step to activate review.',
    activelyProcessing: 'Your application is actively being processed.',
    activeQueue: 'Your application is currently in the active review queue.',

    // ── Competition / urgency (subtle) ────────────────────────────────────
    demandNotice:
      'Due to demand, multiple applications may be reviewed for the same property.',
    promptUrgency:
      'Complete requested steps when you can; timing does not guarantee a review advantage or outcome.',
    payQueueNotice:
      'Payment activates review when required. Payment speed does not determine review priority.',
    delayWarning: 'Review timing may vary while information is verified or when application volume is high.',

    // ── Holding fee ───────────────────────────────────────────────────────
    holdingDefinition:
      'The holding fee temporarily reserves the property and removes it from active availability while your lease is being finalized.',
    holdingNoHoldRisk:
      'Without a holding fee, the property remains available to other approved applicants.',
    holdingUrgency:
      'Holding requests are time-sensitive and typically must be completed within 24 to 48 hours.',
    holdingTrust:
      'This fee is fully credited toward your move-in costs and is not an additional charge.',

    // ── Approval (opportunity-window) ─────────────────────────────────────
    selectedHeadline: 'You have been selected based on your application.',
    selectionTimeSensitive: 'This selection is time-sensitive.',
    selectionNextStep: 'To secure this unit, complete the next steps promptly.',
    firstCompletion:
      'Units are offered on a first-completion basis among approved applicants.',

    // ── Lease (finalization) ──────────────────────────────────────────────
    leaseFinalStage:
      'You are now entering the final stage of securing your approved unit.',
    leaseFirstCompleted:
      'Units are confirmed on a first-completed basis until fully executed.',
    leaseWindow:
      'Please complete your lease within 48 hours to maintain your reservation.',

    // ── Marketing claims (truthful framing) ───────────────────────────────
    coverageClaim:
      'Expanding nationwide with active listings in select markets.',
    processClaim: 'A clear, structured process with transparent steps.',

    // ── Identity ──────────────────────────────────────────────────────────
    supportEmail: 'support@choiceproperties.com',
    supportPhone: '707-706-3137',
  };

  var ES = {
    feeStatement:
      'Se requiere un cargo de solicitud de $50 después de enviar su solicitud. Nuestro equipo lo contactará para completar el pago de forma segura antes de revisar su solicitud.',
    feeReinforcement: 'Las solicitudes solo se activan después de completar el pago.',

    reviewTime:
      'La mayoría de las revisiones se completa en 24 a 72 horas después de confirmar la tarifa. El tiempo puede variar; es una estimación, no un plazo garantizado.',
    reviewBehavior:
      'La información completa y precisa puede evitar solicitudes de seguimiento. El orden de revisión no depende de quién paga o responde más rápido.',
    reviewPriority:
      'Pagar o responder más rápido no da prioridad en la revisión ni garantiza la aprobación.',

    statusActiveReview: 'En Revisión Activa',
    statusActiveReviewDesc: 'Su solicitud está siendo evaluada para selección.',
    submissionConfirm:
      'Su solicitud ahora está siendo evaluada para calificación. El siguiente paso es el pago para activar la revisión.',
    activelyProcessing: 'Su solicitud está siendo procesada activamente.',
    activeQueue: 'Su solicitud está actualmente en la cola de revisión activa.',

    demandNotice:
      'Debido a la demanda, pueden revisarse varias solicitudes para la misma propiedad.',
    promptUrgency:
      'Complete los pasos solicitados cuando pueda; la rapidez no garantiza ventaja ni resultado.',
    payQueueNotice:
      'El pago activa la revisión cuando se requiere. La rapidez del pago no determina la prioridad.',
    delayWarning: 'El tiempo puede variar mientras se verifica la información o cuando hay muchas solicitudes.',

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

  function get(key, lang) {
    var L = (lang === 'es') ? ES : EN;
    return (L[key] !== undefined) ? L[key] : (EN[key] || '');
  }

  root.CP_COPY = {
    en: EN,
    es: ES,
    get: get,
  };
})(typeof window !== 'undefined' ? window : this);
