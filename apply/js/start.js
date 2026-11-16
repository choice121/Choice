(function () {
  'use strict';

  var STR = {
    en: {
      langLabel: 'Español',
      heroEyebrow: 'Application Guide',
      heroTitle: 'What to Expect Before You Apply',
      heroSubtitle: 'Review our transparent fees, payment options, and screening guidelines before beginning your rental application. Your progress saves automatically as you move through each section.',
      propCardHeading: 'Applying For',
      fallbackPropTitle: 'Choice Properties Rental Application',
      browseListings: 'Browse Listings',
      backToProperty: 'Back to Property Listing',
      trackApp: 'Already Applied? Track Status',
      noPropTitle: 'No specific property selected yet',
      noPropDesc: 'We recommend choosing a listing first so your rent, lease terms, and property address carry over automatically — or you can enter the property address directly on Step 1.',
      roadmapTitle: 'How the Application Process Works',
      step1Title: 'Complete Your Application',
      step1Body: 'Estimated time: 15–20 minutes across 6 organized sections. Your answers save automatically in your browser while you complete the form.',
      step2Title: 'Transparent Per-Adult Fee',
      step2Body: '$50.00 per screened adult (18+), including occupying co-applicants, guarantors, and co-signers — subject to state fee limits where applicable.',
      step3Title: 'Flexible Payment Checkout',
      step3Body: 'Immediately after submitting, complete your fee by Debit/Credit Card where active, or via supported alternative methods: Cash App, PayPal, Apple Pay, or Venmo.',
      step4Title: 'Review & Resident Portal',
      step4Body: 'Underwriting begins once fee payment is confirmed (typically 24–48 hours). Track updates and upload additional files anytime in your Tenant Portal.',
      feesTitle: 'Fee & Household Rules',
      prepTitle: 'What Helpful Details to Have Ready',
      privacyHeading: 'How Your Information Is Protected',
      privacyBody: 'All data is transmitted over HTTPS. We collect only the last 4 digits of your Social Security Number (never full 9-digit SSNs) or an accepted alternative government ID, and uploaded documents are stored in private access-controlled buckets (never cached as unencrypted browser drafts). Read our <a href="/privacy.html" target="_blank" rel="noopener">Privacy Policy</a> and <a href="/rental-application-policy.html" target="_blank" rel="noopener">Rental Application Policy</a>.',
      continueBtnLabel: 'I Understand — Continue to Application',
      ctaNote: 'Average completion time: 15–20 minutes · Drafts auto-save in your browser'
    },
    es: {
      langLabel: 'English',
      heroEyebrow: 'Guía de Solicitud',
      heroTitle: 'Qué Esperar Antes de Solicitar',
      heroSubtitle: 'Revise nuestras tarifas transparentes, opciones de pago y requisitos de evaluación antes de comenzar su solicitud de alquiler. Su progreso se guarda automáticamente.',
      propCardHeading: 'Propiedad Seleccionada',
      fallbackPropTitle: 'Solicitud de Alquiler — Choice Properties',
      browseListings: 'Ver Propiedades',
      backToProperty: 'Volver a la Propiedad',
      trackApp: '¿Ya Solicitó? Ver Estado',
      noPropTitle: 'Aún no hay una propiedad seleccionada',
      noPropDesc: 'Recomendamos elegir una propiedad primero para que la renta, el plazo y la dirección se completen automáticamente — o puede ingresar la dirección en el Paso 1.',
      roadmapTitle: 'Cómo Funciona el Proceso de Solicitud',
      step1Title: 'Complete Su Solicitud',
      step1Body: 'Tiempo estimado: 15–20 minutos en 6 secciones organizadas. Sus respuestas se guardan automáticamente en su navegador.',
      step2Title: 'Tarifa Transparente por Adulto',
      step2Body: '$50.00 por cada adulto evaluado (18+), incluyendo co-solicitantes ocupantes, garantes y co-firmantes (sujeto a límites estatales).',
      step3Title: 'Opciones de Pago Flexibles',
      step3Body: 'Inmediatamente después de enviar, complete su tarifa con tarjeta de débito/crédito cuando esté disponible, o por Cash App, PayPal, Apple Pay o Venmo.',
      step4Title: 'Revisión y Portal del Inquilino',
      step4Body: 'La evaluación comienza al confirmar el pago (normalmente 24–72 horas). Siga su estado y suba documentos en cualquier momento desde su portal.',
      feesTitle: 'Reglas de Tarifas y Hogar',
      prepTitle: 'Detalles Útiles para Tener a Mano',
      privacyHeading: 'Cómo Protegemos Su Información',
      privacyBody: 'Todos los datos se transmiten por HTTPS. Solo solicitamos los últimos 4 dígitos de su Número de Seguro Social (nunca el SSN completo de 9 dígitos) o una identificación oficial alternativa, y sus documentos se guardan en carpetas privadas con control de acceso (nunca como archivos sin cifrar en borradores locales). Consulte nuestra <a href="/privacy.html" target="_blank" rel="noopener">Política de Privacidad</a>.',
      continueBtnLabel: 'Entendido — Continuar a la Solicitud',
      ctaNote: 'Tiempo promedio: 15–20 minutos · El borrador se guarda automáticamente'
    }
  };

  function readContext() {
    var params = new URLSearchParams(window.location.search);
    var stored = null;
    try {
      var raw = sessionStorage.getItem('cp_property_context');
      if (raw) stored = JSON.parse(raw);
    } catch (_) {}

    var id = params.get('id') || (stored && stored.id) || '';
    var title = params.get('pn') || params.get('addr') || (stored && (stored.title || stored.address)) || '';
    var city = params.get('city') || (stored && stored.city) || '';
    var state = params.get('state') || (stored && stored.state) || '';
    var zip = params.get('zip') || (stored && stored.zip) || '';
    var rent = params.get('rent') || (stored && stored.monthly_rent) || '';
    var fee = params.get('fee') || (stored && stored.application_fee != null ? String(stored.application_fee) : '50');
    var beds = params.get('beds') || (stored && stored.bedrooms) || '';
    var baths = params.get('baths') || (stored && stored.bathrooms) || '';
    var source = params.get('source') || '';

    return {
      params: params,
      id: id,
      title: title,
      cityStateZip: [city, state].filter(Boolean).join(', ') + (zip ? ' ' + zip : ''),
      rent: rent,
      fee: fee,
      beds: beds,
      baths: baths,
      source: source
    };
  }

  function buildTargetUrl(ctx, lang) {
    var nextParams = new URLSearchParams(ctx.params.toString());
    nextParams.set('ack', '1');
    if (lang === 'es') {
      nextParams.set('lang', 'es');
    } else if (!ctx.params.has('lang')) {
      nextParams.delete('lang');
    }
    var hash = window.location.hash || '';
    return '/apply/index.html?' + nextParams.toString() + hash;
  }

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el && val != null) el.textContent = val;
  }

  function applyLanguage(lang, ctx) {
    var s = STR[lang] || STR.en;
    document.documentElement.lang = lang;
    setText('startLangLabel', s.langLabel);
    setText('heroEyebrow', s.heroEyebrow);
    setText('heroTitle', s.heroTitle);
    setText('heroSubtitle', s.heroSubtitle);
    setText('propCardHeading', s.propCardHeading);
    setText('trackAppLabel', s.trackApp);
    setText('noPropTitle', s.noPropTitle);
    setText('noPropDesc', s.noPropDesc);
    setText('roadmapTitle', s.roadmapTitle);
    setText('step1Title', s.step1Title);
    setText('step1Body', s.step1Body);
    setText('step2Title', s.step2Title);
    setText('step2Body', s.step2Body);
    setText('step3Title', s.step3Title);
    setText('step3Body', s.step3Body);
    setText('step4Title', s.step4Title);
    setText('step4Body', s.step4Body);
    setText('feesTitle', s.feesTitle);
    setText('prepTitle', s.prepTitle);
    setText('privacyHeading', s.privacyHeading);
    var pBody = document.getElementById('privacyBody');
    if (pBody) pBody.innerHTML = s.privacyBody;
    setText('continueBtnLabel', s.continueBtnLabel);
    var ctaNoteSpan = document.querySelector('#ctaNote span');
    if (ctaNoteSpan) ctaNoteSpan.textContent = s.ctaNote;

    if (!ctx.title) setText('propTitle', s.fallbackPropTitle);
    var backLabel = document.getElementById('backToListingLabel');
    if (backLabel) {
      backLabel.textContent = ctx.source ? s.backToProperty : s.browseListings;
    }
    var secondaryBtn = document.getElementById('secondaryBrowseBtn');
    if (secondaryBtn) {
      secondaryBtn.textContent = ctx.source ? s.backToProperty : s.browseListings;
      secondaryBtn.href = ctx.source || '/listings.html';
    }
    var continueBtn = document.getElementById('continueApplyBtn');
    if (continueBtn) {
      continueBtn.href = buildTargetUrl(ctx, lang);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var ctx = readContext();
    var initialLang = (ctx.params.get('lang') || '').toLowerCase().startsWith('es') ? 'es' : 'en';

    var propTitleEl = document.getElementById('propTitle');
    if (propTitleEl && ctx.title) {
      propTitleEl.textContent = ctx.title;
    }

    var metaEl = document.getElementById('propMeta');
    if (metaEl) {
      var chips = [];
      if (ctx.cityStateZip.trim()) chips.push(ctx.cityStateZip.trim());
      if (ctx.rent) chips.push('$' + Number(String(ctx.rent).replace(/[^0-9.]/g, '') || 0).toLocaleString() + '/mo');
      if (ctx.beds || ctx.baths) {
        var spec = [ctx.beds ? ctx.beds + ' Bed' : '', ctx.baths ? ctx.baths + ' Bath' : ''].filter(Boolean).join(' · ');
        if (spec) chips.push(spec);
      }
      var feeNum = Number(ctx.fee);
      chips.push(Number.isFinite(feeNum) && feeNum >= 0 ? ('$' + feeNum + ' / adult fee') : '$50 / adult fee');

      metaEl.innerHTML = chips.map(function (c) {
        var span = document.createElement('span');
        span.className = 'meta-chip';
        span.textContent = c;
        return span.outerHTML;
      }).join('');
    }

    var backLink = document.getElementById('backToListingLink');
    if (backLink && ctx.source) {
      backLink.href = ctx.source;
    }

    var noPropAlert = document.getElementById('noPropAlert');
    if (noPropAlert && !ctx.id && !ctx.title) {
      noPropAlert.style.display = 'flex';
    }

    var currentLang = initialLang;
    applyLanguage(currentLang, ctx);

    var langBtn = document.getElementById('startLangToggle');
    if (langBtn) {
      langBtn.addEventListener('click', function () {
        currentLang = currentLang === 'en' ? 'es' : 'en';
        applyLanguage(currentLang, ctx);
      });
    }
  });
})();
