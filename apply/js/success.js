(function () {
  'use strict';

  var COPY = {
    en: {
      langBtn: 'Español',
      heading: 'Application Submitted',
      subtitle: 'Saved securely — confirmation sent to your email.',
      subtitleNoEmail: 'Your rental application has been saved securely.',
      refLabel: 'Application Reference',
      copy: 'Copy',
      copied: 'Copied',
      feeLabel: 'Application Fee',
      feeWaived: '$0.00 (Waived)',
      preferred: 'Preferred:',
      timelineFee: function (channels) {
        var via = channels ? (' via ' + channels) : '';
        return 'Someone from our team will contact you shortly' + via + ' to coordinate your fee and begin your review.';
      },
      timelineFree: 'Your application is in review. Someone from our team will contact you shortly with an update.',
      portalCta: 'Open Tenant Portal',
      browseListings: 'Browse Listings',
      viewListing: 'View Listing',
      docsUploaded: function (ok, total) {
        return ok + '/' + total + ' supporting document(s) attached';
      },
      invitedNote: function (n) {
        return n + ' private co-applicant invite link(s) dispatched';
      }
    },
    es: {
      langBtn: 'English',
      heading: 'Solicitud Enviada',
      subtitle: 'Guardada de forma segura — confirmación enviada a su correo.',
      subtitleNoEmail: 'Su solicitud de alquiler ha sido guardada de forma segura.',
      refLabel: 'Referencia de Solicitud',
      copy: 'Copiar',
      copied: 'Copiado',
      feeLabel: 'Tarifa de Solicitud',
      feeWaived: '$0.00 (Exenta)',
      preferred: 'Preferido:',
      timelineFee: function (channels) {
        var via = channels ? (' por ' + channels) : '';
        return 'Alguien de nuestro equipo se comunicará con usted en breve' + via + ' para coordinar su tarifa e iniciar su revisión.';
      },
      timelineFree: 'Su solicitud está en revisión. Alguien de nuestro equipo se comunicará con usted en breve con una actualización.',
      portalCta: 'Abrir Portal del Inquilino',
      browseListings: 'Ver Propiedades',
      viewListing: 'Ver Anuncio',
      docsUploaded: function (ok, total) {
        return ok + '/' + total + ' documento(s) de respaldo adjuntos';
      },
      invitedNote: function (n) {
        return n + ' enlace(s) privado(s) de co-solicitante enviado(s)';
      }
    }
  };

  function safeParse(raw) {
    try { return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
  }

  function loadContext() {
    var params = new URLSearchParams(window.location.search);
    var summary = null;
    try {
      summary = safeParse(sessionStorage.getItem('lastSuccessSummary'));
    } catch (_) {}

    var appId = (
      params.get('app_id') ||
      params.get('id') ||
      (summary && summary.appId) ||
      sessionStorage.getItem('lastSuccessAppId') ||
      sessionStorage.getItem('pendingPortalAppId') ||
      ''
    ).trim();

    var email = (params.get('email') || (summary && summary.email) || '').trim();
    var trackUrl = (summary && summary.trackUrl) || '';
    if (!trackUrl) {
      trackUrl = appId
        ? '/tenant/portal.html?app_id=' + encodeURIComponent(appId) + (email ? '&email=' + encodeURIComponent(email) : '')
        : '/tenant/portal.html';
    }

    var lang = ((params.get('lang') || (summary && summary.lang) || 'en')).toLowerCase().startsWith('es') ? 'es' : 'en';

    return {
      appId: appId || 'CP-SUBMITTED',
      hasRealId: Boolean(appId),
      email: email,
      trackUrl: trackUrl,
      propertyAddress: (summary && summary.propertyAddress) || '',
      sourceUrl: (summary && summary.sourceUrl) || '',
      totalFeeDue: summary && typeof summary.totalFeeDue === 'number' ? summary.totalFeeDue : 50,
      paymentPrefs: Array.isArray(summary && summary.paymentPrefs) ? summary.paymentPrefs.filter(Boolean) : [],
      contactMethods: Array.isArray(summary && summary.contactMethods) ? summary.contactMethods.filter(Boolean) : [],
      docSummary: (summary && summary.docSummary) || null,
      invitedCount: (summary && Number(summary.invitedCount)) || 0,
      lang: lang
    };
  }

  function clearAppDraftAndReceiptKeys() {
    try {
      sessionStorage.removeItem('lastSuccessAppId');
      sessionStorage.removeItem('lastSuccessPortalUrl');
      sessionStorage.removeItem('lastSuccessSummary');
    } catch (_) {}
  }

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function render(ctx) {
    var t = COPY[ctx.lang] || COPY.en;
    document.documentElement.lang = ctx.lang;

    setText('successLangText', t.langBtn);
    setText('successHeading', t.heading);
    setText('successSubtitle', ctx.email ? t.subtitle : t.subtitleNoEmail);
    setText('referenceLabel', t.refLabel);
    setText('referenceCode', ctx.appId);
    setText('copyRefText', t.copy);
    setText('feeLabel', t.feeLabel);
    setText('prefsCaption', t.preferred);
    setText('portalCtaText', t.portalCta);
    setText('browseListingsText', t.browseListings);
    setText('backToListingText', t.viewListing);

    var propPill = document.getElementById('propertyPill');
    var propAddrEl = document.getElementById('propertyAddressText');
    if (propPill && propAddrEl) {
      if (ctx.propertyAddress) {
        propAddrEl.textContent = ctx.propertyAddress;
        propPill.hidden = false;
      } else {
        propPill.hidden = true;
      }
    }

    var feeAmountEl = document.getElementById('feeAmount');
    if (feeAmountEl) {
      feeAmountEl.textContent = ctx.totalFeeDue > 0
        ? '$' + Number(ctx.totalFeeDue).toFixed(2)
        : t.feeWaived;
    }

    var prefsRow = document.getElementById('prefsRow');
    var prefsChips = document.getElementById('prefsChips');
    if (prefsRow && prefsChips) {
      prefsChips.replaceChildren();
      if (ctx.paymentPrefs.length > 0 && ctx.totalFeeDue > 0) {
        ctx.paymentPrefs.slice(0, 3).forEach(function (pref, idx) {
          var chip = document.createElement('span');
          chip.className = 'pref-chip' + (idx === 0 ? ' pref-chip--primary' : '');
          chip.textContent = (idx + 1) + '. ' + pref;
          prefsChips.appendChild(chip);
        });
        prefsRow.hidden = false;
      } else {
        prefsRow.hidden = true;
      }
    }

    var nextStepEl = document.getElementById('nextStepSummary');
    if (nextStepEl) {
      var channels = ctx.contactMethods.slice(0, 2).join(' / ');
      nextStepEl.textContent = ctx.totalFeeDue > 0 ? t.timelineFee(channels) : t.timelineFree;
    }

    var extraNoteRow = document.getElementById('extraNoteRow');
    var extraNoteText = document.getElementById('extraNoteText');
    if (extraNoteRow && extraNoteText) {
      var notes = [];
      if (ctx.docSummary && ctx.docSummary.total > 0) {
        notes.push(t.docsUploaded(ctx.docSummary.uploadedCount || 0, ctx.docSummary.total));
      }
      if (ctx.invitedCount > 0) {
        notes.push(t.invitedNote(ctx.invitedCount));
      }
      if (notes.length > 0) {
        extraNoteText.textContent = notes.join(' · ');
        extraNoteRow.hidden = false;
      } else {
        extraNoteRow.hidden = true;
      }
    }

    var portalCta = document.getElementById('portalCta');
    if (portalCta) portalCta.href = ctx.trackUrl;

    var backLink = document.getElementById('backToListingLink');
    var backSep = document.getElementById('backToListingSep');
    if (backLink && backSep) {
      if (ctx.sourceUrl) {
        backLink.href = ctx.sourceUrl;
        backLink.hidden = false;
        backSep.hidden = false;
      } else {
        backLink.hidden = true;
        backSep.hidden = true;
      }
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var ctx = loadContext();
    render(ctx);

    var copyBtn = document.getElementById('copyRefBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var code = ctx.appId;
        var done = function () {
          var t = COPY[ctx.lang] || COPY.en;
          copyBtn.classList.add('copied');
          setText('copyRefText', t.copied);
          setTimeout(function () {
            copyBtn.classList.remove('copied');
            setText('copyRefText', t.copy);
          }, 1800);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(code).then(done).catch(function () {
            var ta = document.createElement('textarea');
            ta.value = code;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); } catch (_) {}
            document.body.removeChild(ta);
            done();
          });
        } else {
          done();
        }
      });
    }

    var langBtn = document.getElementById('successLangToggle');
    if (langBtn) {
      langBtn.addEventListener('click', function () {
        ctx.lang = ctx.lang === 'en' ? 'es' : 'en';
        render(ctx);
      });
    }

    var browseLink = document.getElementById('browseListingsLink');
    if (browseLink) {
      browseLink.addEventListener('click', clearAppDraftAndReceiptKeys);
    }

    var backLink = document.getElementById('backToListingLink');
    if (backLink) {
      backLink.addEventListener('click', clearAppDraftAndReceiptKeys);
    }
  });
})();
