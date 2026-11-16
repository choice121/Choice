(function () {
  'use strict';

  const STR = {
    en: {
      skip: 'Skip to main content',
      headerSub: 'Household Application & Screening Authorization',
      langToggle: 'Español',
      loadingTitle: 'Verifying your private application link…',
      loadingSub: 'Please wait a moment while we retrieve your household application details.',
      goPortal: 'Go to Tenant Portal →',
      needFresh: 'Need a fresh link? Contact Choice Properties at 707-706-3137 (Text Only) or ask the primary applicant.',
      successTitle: 'Details & Consent Recorded',
      successTitleMethodA: 'Screening Consent Confirmed',
      successSub: 'Thank you! Your information and authorization have been recorded for this household application. No duplicate application was created.',
      successSubMethodA: 'Thank you! Your authorization has been recorded for this household application. Our team can now proceed with screening.',
      signInPortal: 'Open Tenant Portal →',
      questionsLine: 'Questions? Call or text 707-706-3137.',
      lblName: 'Your Name',
      lblEmail: 'Email Address',
      lblProperty: 'Property',
      lblPrimary: 'Primary Applicant',
      lblAppId: 'Application ID',
      lblExpires: 'Link Expires',
      formTitleMethodA: 'Screening Authorization',
      formTitleMethodB: 'Complete Your Portion & Authorize Screening',
      formSubMethodA: 'Review the details provided for your screening and confirm authorization below.',
      formSubMethodB: 'Complete your missing personal, residential, and income details privately, upload supporting documents if needed, and authorize screening.',
      roleLabels: {
        co_applicant: 'Co-Applicant (Occupying Adult)',
        guarantor: 'Guarantor (Non-Occupying Financial Support)',
        co_signer: 'Co-Signer',
      },
      roleBanners: {
        co_applicant: 'You are applying as an adult co-applicant who will reside in the home. Please confirm your residential, income, and screening details below.',
        guarantor: 'You are participating as a non-occupying Guarantor providing financial support for this household. We only collect your residential address, housing status, income, and screening consent—no tenant-occupancy questions are required.',
        co_signer: 'You are participating as a Co-Signer for this household application. Complete your residential, housing status, income, and screening authorization below.',
      },
      methodATitle: 'Details Submitted On Your Behalf',
      methodASub: 'The primary applicant provided your initial profile details below. Review them before authorizing screening.',
      methodBTitle: 'Complete Your Confidential Information',
      methodBSub: 'Complete your required details privately below. Your Social Security Number is encrypted and never shared with other household members.',
      fPhone: 'Phone Number',
      fDob: 'Date of Birth',
      fDobHint: 'Must be at least 18 years of age.',
      fSsnMode: 'Identity Verification Method',
      ssnModeLast4: 'Last 4 Digits of SSN',
      ssnModeLast4Desc: 'Standard identity verification',
      ssnModeAlt: 'No SSN — Alternative ID',
      ssnModeAltDesc: 'Passport / ITIN / Gov ID',
      fSsn: 'Social Security Number (Last 4 Digits)',
      fSsnLast4: 'Social Security Number (Last 4 Digits)',
      fSsnHint: 'Last 4 digits only (XXXX) — encrypted in transit and never shared with other household members.',
      fSsnHintLast4: 'Last 4 digits only (XXXX) — encrypted in transit and never shared with other household members.',
      fIdType: 'Government ID Type (Optional)',
      fIdTypeReq: 'Government ID Type',
      fIdNum: 'Government ID Number (Optional)',
      fIdNumReq: 'Government ID Number',
      fAddress: 'Current Residential Address',
      fHousingStatus: 'Current Housing Status',
      optSelectHousing: 'Select housing status…',
      optHousingRent: 'Rent',
      optHousingOwn: 'Own (No Mortgage)',
      optHousingMortgage: 'Own (With Mortgage)',
      optHousingFamily: 'Living with Family / Friends',
      optHousingOther: 'Other',
      fPrevHousingStatus: 'Previous Housing Status',
      fResDuration: 'Time at Current Address',
      fCurrentRent: 'Current Monthly Rent',
      fLandlordName: 'Current Landlord / Property Name',
      fLandlordPhone: 'Landlord Phone',
      fReasonLeaving: 'Reason for Moving',
      fPriorTitle: 'Previous Residence (If Less Than 24 Months at Current Address)',
      fPrevAddress: 'Previous Street Address',
      fPrevDuration: 'Time at Previous Address',
      fPrevLandlordName: 'Previous Landlord Name',
      fPrevLandlordPhone: 'Previous Landlord Phone',
      fEmpStatus: 'Employment / Income Status',
      fEmployer: 'Employer or Income Source',
      fEmployerAddress: 'Employer / Work Address',
      fJobTitle: 'Job Title / Occupation',
      fEmpStartDate: 'Employment Start Date',
      fEmpDuration: 'Time with Employer',
      fMonthlyIncome: 'Monthly Gross Income ($)',
      fOtherIncome: 'Additional Monthly Income ($)',
      fSupportNotes: 'Financial Support Notes (Optional)',
      fEvicted: 'Any prior evictions?',
      fSmoker: 'Do you smoke?',
      fBankruptcy: 'Any bankruptcy filings in the past 7 years?',
      fCriminal: 'Any felony or relevant criminal history?',
      fBankruptcyExplain: 'Bankruptcy Explanation & Discharge Status',
      fCriminalExplain: 'Criminal History Explanation & Date',
      optYes: 'Yes',
      optNo: 'No',
      docsTitle: 'Supporting Documents',
      docsSubMethodB: 'Upload front & back of your government photo ID and proof of income or financial support (PDF, JPG, PNG, or WEBP).',
      docsSubMethodA: 'Optional: Upload additional supporting documents (ID front/back, pay stubs, or proof of financial support) directly to your profile.',
      btnUploadDoc: 'Upload Document',
      uploading: 'Compressing & uploading…',
      uploadOk: 'Document uploaded and attached to your profile.',
      fcraTitle: 'Authorization & Disclosure (FCRA Compliance)',
      fcraOccupantP1: 'By checking the boxes below and confirming consent, you authorize Choice Properties and its designated consumer reporting agencies to obtain and verify consumer reports, credit history, rental and eviction history, employment and income verification, and public background records in connection with your rental application.',
      fcraSupporterP1: 'By checking the boxes below and confirming consent, you authorize Choice Properties and its designated consumer reporting agencies to obtain and verify consumer reports, credit history, employment and income verification, and public background records to evaluate your financial support for this rental application.',
      fcraP2: 'You certify that all information provided on your portion of the application is true, accurate, and complete. Knowingly providing false or misleading information is grounds for denial or lease termination.',
      chk1Title: '1. Identity & Application Accuracy',
      chk2Title: '2. Background & Credit Screening Consent',
      chk2Occupant: 'I authorize Choice Properties to perform credit, background, eviction, and landlord/employer reference checks for this rental application and to communicate status updates electronically.',
      chk2Supporter: 'I authorize Choice Properties to perform credit, background, and income/employment verification checks for my role on this rental application and to communicate status updates electronically.',
      btnSubmitMethodA: 'Confirm Screening Consent',
      btnSubmitMethodB: 'Submit My Details & Confirm Consent',
      submitting: 'Submitting & Recording Consent…',
      errMissingToken: 'Missing Consent Link',
      errMissingTokenDesc: 'This page requires a valid private link from your email or SMS.',
      errInvalidDob: 'Please enter a valid Date of Birth (you must be at least 18 years old).',
      errMissingSsn: 'Please enter the valid last 4 digits of your Social Security Number.',
      errMissingLast4: 'Please enter the valid last 4 digits of your Social Security Number.',
      errMissingAltId: 'Please select a Government ID Type and enter your ID Number.',
      errMissingAddress: 'Please enter your current residential address.',
      errMissingHousing: 'Please select your current housing status.',
      errMissingEmp: 'Please select your employment or income status.',
      errMissingIncome: 'Please enter your monthly gross income.',
      errMissingBankruptcyExplain: 'Please provide a brief bankruptcy explanation and discharge status.',
      errMissingCriminalExplain: 'Please provide a brief criminal history explanation and date.',
      ssnOnFilePrefix: 'SSN securely on file (•••-••-',
      show: 'Show',
      hide: 'Hide',
      summaryDob: 'Date of Birth',
      summarySsn: 'SSN Status',
      summaryAddress: 'Residential Address',
      summaryHousing: 'Housing Status',
      summaryEmp: 'Employment / Income',
      summaryMonthly: 'Monthly Gross Income',
      summaryOther: 'Additional Income',
      summaryLandlord: 'Current Landlord',
      providedOnFile: 'Encrypted on file',
    },
    es: {
      skip: 'Ir al contenido principal',
      headerSub: 'Solicitud del Hogar y Autorización de Verificación',
      langToggle: 'English',
      loadingTitle: 'Verificando su enlace privado…',
      loadingSub: 'Espere un momento mientras recuperamos los detalles de su solicitud.',
      goPortal: 'Ir al Portal del Inquilino →',
      needFresh: '¿Necesita un enlace nuevo? Comuníquese con Choice Properties al 707-706-3137 (Solo Texto) o pídalo al solicitante principal.',
      successTitle: 'Datos y Consentimiento Registrados',
      successTitleMethodA: 'Consentimiento de Verificación Confirmado',
      successSub: '¡Gracias! Su información y autorización fueron registradas en la solicitud del hogar. No se creó ninguna solicitud duplicada.',
      successSubMethodA: '¡Gracias! Su autorización ha sido registrada. Nuestro equipo ahora puede continuar con la evaluación.',
      signInPortal: 'Abrir Portal del Inquilino →',
      questionsLine: '¿Preguntas? Llame o envíe texto al 707-706-3137.',
      lblName: 'Su Nombre',
      lblEmail: 'Correo Electrónico',
      lblProperty: 'Propiedad',
      lblPrimary: 'Solicitante Principal',
      lblAppId: 'ID de Solicitud',
      lblExpires: 'El Enlace Expira',
      formTitleMethodA: 'Autorización de Verificación',
      formTitleMethodB: 'Complete Su Parte y Autorice la Verificación',
      formSubMethodA: 'Revise los datos enviados en su nombre y confirme su autorización abajo.',
      formSubMethodB: 'Complete sus datos personales, de residencia e ingresos de forma privada, suba documentos si lo necesita y autorice la verificación.',
      roleLabels: {
        co_applicant: 'Co-Solicitante (Adulto Ocupante)',
        guarantor: 'Garante (Respaldo Financiero No Ocupante)',
        co_signer: 'Co-Firmante',
      },
      roleBanners: {
        co_applicant: 'Participa como co-solicitante adulto que residirá en la vivienda. Confirme sus datos de residencia, ingresos y autorización abajo.',
        guarantor: 'Participa como Garante no ocupante brindando respaldo financiero. Solo solicitamos su dirección residencial, situación de vivienda, ingresos y autorización—sin preguntas de ocupación.',
        co_signer: 'Participa como Co-Firmante en esta solicitud. Complete su dirección residencial, situación de vivienda, ingresos y autorización abajo.',
      },
      methodATitle: 'Datos Enviados en Su Nombre',
      methodASub: 'El solicitante principal proporcionó estos datos iniciales. Revíselos antes de autorizar la verificación.',
      methodBTitle: 'Complete Su Información Confidencial',
      methodBSub: 'Complete los campos requeridos en privado. Su Número de Seguro Social está cifrado y nunca se comparte con otros miembros del hogar.',
      fPhone: 'Teléfono',
      fDob: 'Fecha de Nacimiento',
      fDobHint: 'Debe tener al menos 18 años de edad.',
      fSsnMode: 'Método de Verificación de Identidad',
      ssnModeLast4: 'Últimos 4 Dígitos del SSN',
      ssnModeLast4Desc: 'Verificación estándar de identidad',
      ssnModeAlt: 'Sin SSN — ID Alternativa',
      ssnModeAltDesc: 'Pasaporte / ITIN / Licencia',
      fSsn: 'Número de Seguro Social (Últimos 4 Dígitos)',
      fSsnLast4: 'Número de Seguro Social (Últimos 4 Dígitos)',
      fSsnHint: 'Últimos 4 dígitos únicamente (XXXX) — cifrado en tránsito y nunca compartido con otros miembros.',
      fSsnHintLast4: 'Últimos 4 dígitos únicamente (XXXX) — cifrado en tránsito y nunca compartido con otros miembros.',
      fIdType: 'Tipo de Identificación Oficial (Opcional)',
      fIdTypeReq: 'Tipo de Identificación Oficial',
      fIdNum: 'Número de Identificación (Opcional)',
      fIdNumReq: 'Número de Identificación Oficial',
      fAddress: 'Dirección Residencial Actual',
      fHousingStatus: 'Situación Actual de Vivienda',
      optSelectHousing: 'Seleccionar situación…',
      optHousingRent: 'Renta',
      optHousingOwn: 'Propietario (Sin Hipoteca)',
      optHousingMortgage: 'Propietario (Con Hipoteca)',
      optHousingFamily: 'Vive con Familia / Amigos',
      optHousingOther: 'Otro',
      fPrevHousingStatus: 'Situación de Vivienda Anterior',
      fResDuration: 'Tiempo en la Dirección Actual',
      fCurrentRent: 'Renta Mensual Actual',
      fLandlordName: 'Arrendador o Propiedad Actual',
      fLandlordPhone: 'Teléfono del Arrendador',
      fReasonLeaving: 'Motivo de Mudanza',
      fPriorTitle: 'Residencia Anterior (Si Tiene Menos de 24 Meses Aquí)',
      fPrevAddress: 'Dirección Anterior',
      fPrevDuration: 'Tiempo en la Dirección Anterior',
      fPrevLandlordName: 'Arrendador Anterior',
      fPrevLandlordPhone: 'Teléfono del Arrendador Anterior',
      fEmpStatus: 'Situación Laboral / Ingresos',
      fEmployer: 'Empleador o Fuente de Ingresos',
      fEmployerAddress: 'Dirección del Empleador / Trabajo',
      fJobTitle: 'Puesto u Ocupación',
      fEmpStartDate: 'Fecha de Inicio de Empleo',
      fEmpDuration: 'Antigüedad Laboral',
      fMonthlyIncome: 'Ingreso Bruto Mensual ($)',
      fOtherIncome: 'Ingresos Mensuales Adicionales ($)',
      fSupportNotes: 'Notas de Respaldo Financiero (Opcional)',
      fEvicted: '¿Desalojos previos?',
      fSmoker: '¿Fuma?',
      fBankruptcy: '¿Bancarrota en los últimos 7 años?',
      fCriminal: '¿Delitos graves o antecedentes penales relevantes?',
      fBankruptcyExplain: 'Explicación de Bancarrota y Estado Actual',
      fCriminalExplain: 'Explicación de Antecedentes y Fecha',
      optYes: 'Sí',
      optNo: 'No',
      docsTitle: 'Documentos de Respaldo',
      docsSubMethodB: 'Suba el frente y reverso de su identificación oficial y comprobante de ingresos o respaldo financiero (PDF, JPG, PNG o WEBP).',
      docsSubMethodA: 'Opcional: Suba documentos adicionales (frente/reverso de ID, recibos de pago o respaldo financiero) directamente a su perfil.',
      btnUploadDoc: 'Subir Documento',
      uploading: 'Comprimiendo y subiendo…',
      uploadOk: 'Documento subido y adjuntado a su perfil.',
      fcraTitle: 'Autorización y Divulgación (Cumplimiento FCRA)',
      fcraOccupantP1: 'Al marcar las casillas y confirmar, autoriza a Choice Properties y a sus agencias de informes a verificar su historial crediticio, historial de alquiler y desalojos, empleo, ingresos y antecedentes públicos para esta solicitud.',
      fcraSupporterP1: 'Al marcar las casillas y confirmar, autoriza a Choice Properties y a sus agencias de informes a verificar su historial crediticio, empleo, ingresos y antecedentes públicos para evaluar su respaldo financiero en esta solicitud.',
      fcraP2: 'Certifica que toda la información proporcionada es verídica, precisa y completa. Proporcionar información falsa es motivo de rechazo o terminación.',
      chk1Title: '1. Identidad y Exactitud de la Solicitud',
      chk2Title: '2. Consentimiento de Verificación de Crédito y Antecedentes',
      chk2Occupant: 'Autorizo a Choice Properties a realizar verificaciones de crédito, antecedentes, desalojos y referencias de arrendador/empleador y enviar actualizaciones electrónicas.',
      chk2Supporter: 'Autorizo a Choice Properties a realizar verificaciones de crédito, antecedentes e ingresos para mi rol en esta solicitud y enviar actualizaciones electrónicas.',
      btnSubmitMethodA: 'Confirmar Consentimiento',
      btnSubmitMethodB: 'Enviar Mis Datos y Confirmar Consentimiento',
      submitting: 'Enviando y Registrando Consentimiento…',
      errMissingToken: 'Enlace Faltante',
      errMissingTokenDesc: 'Esta página requiere un enlace privado válido de su correo o SMS.',
      errInvalidDob: 'Ingrese una Fecha de Nacimiento válida (debe tener al menos 18 años).',
      errMissingSsn: 'Ingrese los últimos 4 dígitos válidos de su SSN.',
      errMissingLast4: 'Ingrese los últimos 4 dígitos válidos de su SSN.',
      errMissingAltId: 'Seleccione el tipo e ingrese el número de su identificación oficial alternativa.',
      errMissingAddress: 'Ingrese su dirección residencial actual.',
      errMissingHousing: 'Seleccione su situación actual de vivienda.',
      errMissingEmp: 'Seleccione su situación laboral o de ingresos.',
      errMissingIncome: 'Ingrese su ingreso bruto mensual.',
      errMissingBankruptcyExplain: 'Por favor brinde una breve explicación de la bancarrota.',
      errMissingCriminalExplain: 'Por favor brinde una breve explicación de los antecedentes.',
      ssnOnFilePrefix: 'SSN cifrado registrado (•••-••-',
      show: 'Ver',
      hide: 'Ocultar',
      summaryDob: 'Fecha de Nacimiento',
      summarySsn: 'Estado de SSN',
      summaryAddress: 'Dirección Residencial',
      summaryHousing: 'Situación de Vivienda',
      summaryEmp: 'Situación Laboral',
      summaryMonthly: 'Ingreso Bruto Mensual',
      summaryOther: 'Ingresos Adicionales',
      summaryLandlord: 'Arrendador Actual',
      providedOnFile: 'Cifrado en archivo',
    },
  };

  let currentLang = 'en';
  let pageData = null;
  let uploadedDocs = [];
  let isMethodB = false;
  let applicantRole = 'co_applicant';
  let baseUrl = '';
  let anonKey = '';
  let consentToken = '';

  function normalizeRole(raw) {
    const s = String(raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (s === 'guarantor') return 'guarantor';
    if (s === 'co_signer' || s === 'cosigner') return 'co_signer';
    return 'co_applicant';
  }

  function t(key) {
    return (STR[currentLang] && STR[currentLang][key]) || STR.en[key] || '';
  }

  function getToken() {
    const searchToken = new URLSearchParams(location.search).get('token');
    if (searchToken && searchToken.trim()) return searchToken.trim();
    const rawHash = (location.hash || '').replace(/^#/, '');
    if (rawHash) {
      const hashToken = new URLSearchParams(rawHash).get('token');
      if (hashToken && hashToken.trim()) return hashToken.trim();
    }
    return '';
  }

  function showState(state) {
    ['loading', 'error', 'success', 'form'].forEach((s) => {
      const el = document.getElementById('state-' + s);
      if (el) el.style.display = s === state ? '' : 'none';
    });
  }

  function fmtDate(d) {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleString(currentLang === 'es' ? 'es-US' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return String(d);
    }
  }

  function showError(title, msg) {
    const titleEl = document.getElementById('err-title');
    const msgEl = document.getElementById('err-message');
    if (titleEl && title) titleEl.textContent = title;
    if (msgEl && msg) msgEl.textContent = msg;
    showState('error');
  }

  function ageInYears(dobStr) {
    if (!dobStr) return null;
    const dob = new Date(dobStr);
    if (Number.isNaN(dob.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
    return age;
  }

  function validateSsnDigits(raw) {
    const digits = String(raw || '').replace(/\D/g, '');
    if (digits.length !== 9) return null;
    if (/^(\d)\1{8}$/.test(digits)) return null;
    const area = digits.slice(0, 3);
    const group = digits.slice(3, 5);
    const serial = digits.slice(5, 9);
    if (area === '000' || area === '666' || Number(area) >= 900 || group === '00' || serial === '0000') {
      return null;
    }
    return digits;
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  const DOC_SLOTS = [
    { key: 'gov_id_front', docType: 'government_id', side: 'front', title: 'Government ID (Front)', titleEs: 'ID Oficial (Frente)', sub: 'Photo side of license/passport', subEs: 'Frente de licencia/pasaporte', capture: 'environment' },
    { key: 'gov_id_back', docType: 'government_id', side: 'back', title: 'Government ID (Back)', titleEs: 'ID Oficial (Reverso)', sub: 'Barcode / back side', subEs: 'Reverso / código', capture: 'environment' },
    { key: 'pay_stub', docType: 'pay_stub', side: null, title: 'Recent Pay Stub(s)', titleEs: 'Recibos de Pago', sub: 'Last 30–60 days', subEs: 'Últimos 30–60 días', capture: '' },
    { key: 'bank_statement', docType: 'bank_statement', side: null, title: 'Bank Statement', titleEs: 'Estado de Cuenta', sub: 'Most recent statement', subEs: 'Estado de cuenta reciente', capture: '' },
    { key: 'guarantor_support', docType: 'guarantor_support', side: null, title: 'Proof of Income / Support', titleEs: 'Comprobante de Apoyo / Ingresos', sub: 'Tax return, benefit letter, or reserves', subEs: 'Declaración fiscal o reservas', capture: '' },
    { key: 'other', docType: 'applicant_upload', side: null, title: 'Other Supporting Document', titleEs: 'Otro Documento', sub: 'PDF, JPG, PNG, or WEBP', subEs: 'PDF, JPG, PNG o WEBP', capture: '' },
  ];

  function getSelectedSsnMode() {
    const checked = document.querySelector('input[name="mb-ssn-mode"]:checked');
    return checked && checked.value === 'alternative_id' ? 'alternative_id' : 'last4';
  }

  function syncSsnModeUi() {
    const mode = getSelectedSsnMode();
    document.querySelectorAll('.ssn-mode-pill').forEach((lbl) => {
      const inp = lbl.querySelector('input[type="radio"]');
      lbl.classList.toggle('active', Boolean(inp && inp.checked));
    });
    const ssnGroup = document.getElementById('mb-ssn-group');
    const ssnInput = document.getElementById('mb-ssn');
    const ssnLabelSpan = document.querySelector('#mb-ssn-label span[data-i18n]');
    const ssnHintEl = document.getElementById('mb-ssn-hint');
    const idTypeLabel = document.getElementById('mb-id-type-label');
    const idTypeStar = document.getElementById('mb-id-type-star');
    const idNumLabel = document.getElementById('mb-id-num-label');
    const idNumStar = document.getElementById('mb-id-num-star');

    if (pageData && pageData.has_ssn) {
      if (ssnGroup) ssnGroup.style.display = '';
      if (idTypeStar) idTypeStar.style.display = 'none';
      if (idNumStar) idNumStar.style.display = 'none';
      return;
    }

    if (mode === 'alternative_id') {
      if (ssnGroup) ssnGroup.style.display = 'none';
      if (ssnInput) ssnInput.value = '';
      if (idTypeLabel) idTypeLabel.textContent = t('fIdTypeReq');
      if (idTypeStar) idTypeStar.style.display = 'inline';
      if (idNumLabel) idNumLabel.textContent = t('fIdNumReq');
      if (idNumStar) idNumStar.style.display = 'inline';
    } else {
      if (ssnGroup) ssnGroup.style.display = '';
      if (idTypeLabel) idTypeLabel.textContent = t('fIdType');
      if (idTypeStar) idTypeStar.style.display = 'none';
      if (idNumLabel) idNumLabel.textContent = t('fIdNum');
      if (idNumStar) idNumStar.style.display = 'none';
      if (ssnInput) {
        ssnInput.maxLength = 4;
        ssnInput.placeholder = '1234';
        const d = String(ssnInput.value || '').replace(/\D/g, '');
        if (d.length > 4) ssnInput.value = d.slice(-4);
        if (ssnLabelSpan) ssnLabelSpan.textContent = t('fSsnLast4');
        if (ssnHintEl) ssnHintEl.textContent = t('fSsnHintLast4');
      }
    }
  }

  function syncDisclosureExplanations() {
    const bankYes = document.querySelector('input[name="mb-has-bankruptcy"][value="yes"]')?.checked;
    const crimYes = document.querySelector('input[name="mb-has-criminal"][value="yes"]')?.checked;
    const bankWrap = document.getElementById('mb-bankruptcy-explain-group');
    const crimWrap = document.getElementById('mb-criminal-explain-group');
    if (bankWrap) bankWrap.style.display = bankYes ? '' : 'none';
    if (crimWrap) crimWrap.style.display = crimYes ? '' : 'none';
  }

  function syncMbHousingStatusUi() {
    const isSupporter = applicantRole === 'guarantor' || applicantRole === 'co_signer';
    const statusEl = document.getElementById('mb-housing-status');
    const status = String(statusEl?.value || '').trim();
    const isEs = currentLang === 'es';

    if (isSupporter) {
      const notesEl = document.getElementById('mb-support-notes');
      if (notesEl) {
        if (status === 'Own') {
          notesEl.placeholder = isEs
            ? 'Opcional: patrimonio de vivienda propia, ahorros líquidos o alcance del respaldo…'
            : 'Optional details on home equity, liquid reserves, or how you are supporting this household…';
        } else if (status === 'Mortgage') {
          notesEl.placeholder = isEs
            ? 'Opcional: pago hipotecario actual, ahorros líquidos o alcance del respaldo…'
            : 'Optional details on current mortgage obligation, reserves, or how you are supporting this household…';
        } else if (status === 'Rent') {
          notesEl.placeholder = isEs
            ? 'Opcional: renta mensual actual, ahorros o alcance del respaldo…'
            : 'Optional details on current monthly rent, reserves, or how you are supporting this household…';
        } else {
          notesEl.placeholder = isEs
            ? 'Opcional: detalles sobre ahorros, bienes o respaldo financiero para este hogar…'
            : 'Optional details on savings, assets, or how you are supporting this household…';
        }
      }
      return;
    }

    const rentGrp = document.getElementById('mb-rent-group');
    const rentLbl = document.getElementById('mb-rent-label');
    const rentInput = document.getElementById('mb-current-rent');
    const rentHint = document.getElementById('mb-rent-hint');
    const llNameGrp = document.getElementById('mb-landlord-name-group');
    const llNameLbl = document.getElementById('mb-landlord-name-label');
    const llPhoneGrp = document.getElementById('mb-landlord-phone-group');
    const llPhoneLbl = document.getElementById('mb-landlord-phone-label');
    const reasonLbl = document.getElementById('mb-reason-leaving-label');
    const reasonHint = document.getElementById('mb-reason-hint');
    const llNameInput = document.getElementById('mb-landlord-name');
    const llPhoneInput = document.getElementById('mb-landlord-phone');

    if (status === 'Own') {
      if (rentGrp) rentGrp.style.display = 'none';
      if (rentInput) rentInput.value = '';
      if (llNameGrp) llNameGrp.style.display = 'none';
      if (llNameInput) llNameInput.value = '';
      if (llPhoneGrp) llPhoneGrp.style.display = 'none';
      if (llPhoneInput) llPhoneInput.value = '';
      if (reasonLbl) reasonLbl.textContent = isEs ? 'Motivo de mudanza / reubicación (Opcional)' : 'Reason for Moving / Relocating (Optional)';
      if (reasonHint) {
        reasonHint.textContent = isEs
          ? 'No se requiere arrendador ni pago mensual para viviendas propias sin hipoteca.'
          : 'No landlord or monthly housing payment required for homes owned free and clear.';
        reasonHint.style.display = 'block';
      }
    } else if (status === 'Mortgage') {
      if (rentGrp) rentGrp.style.display = '';
      if (rentLbl) rentLbl.textContent = isEs ? 'Pago Mensual Actual de Hipoteca' : 'Current Monthly Mortgage Payment';
      if (rentHint) {
        rentHint.textContent = isEs ? 'Pago mensual aproximado de hipoteca.' : 'Approximate monthly mortgage payment.';
        rentHint.style.display = 'block';
      }
      if (llNameGrp) llNameGrp.style.display = '';
      if (llNameLbl) llNameLbl.textContent = isEs ? 'Banco / Administrador de Hipoteca (Opcional)' : 'Mortgage Lender / Servicer (Optional)';
      if (llPhoneGrp) llPhoneGrp.style.display = '';
      if (llPhoneLbl) llPhoneLbl.textContent = isEs ? 'Teléfono del Banco / Entidad (Opcional)' : 'Lender / Servicer Phone (Optional)';
      if (reasonLbl) reasonLbl.textContent = isEs ? 'Motivo de mudanza (Opcional)' : 'Reason for Moving (Optional)';
      if (reasonHint) { reasonHint.textContent = ''; reasonHint.style.display = 'none'; }
    } else if (status === 'Living with Family' || status === 'Family') {
      if (rentGrp) rentGrp.style.display = '';
      if (rentLbl) rentLbl.textContent = isEs ? 'Aporte Mensual de Vivienda ($0 si no paga)' : 'Monthly Housing Contribution ($0 if none)';
      if (rentHint) {
        rentHint.textContent = isEs ? 'Deje en blanco o ingrese $0 si no paga renta.' : 'Leave blank or enter $0 if you do not pay monthly housing costs.';
        rentHint.style.display = 'block';
      }
      if (llNameGrp) llNameGrp.style.display = '';
      if (llNameLbl) llNameLbl.textContent = isEs ? 'Nombre del Anfitrión / Familiar (Opcional)' : 'Host / Family Member Name (Optional)';
      if (llPhoneGrp) llPhoneGrp.style.display = '';
      if (llPhoneLbl) llPhoneLbl.textContent = isEs ? 'Teléfono del Anfitrión (Opcional)' : 'Host / Family Phone (Optional)';
      if (reasonLbl) reasonLbl.textContent = isEs ? 'Motivo de mudanza' : 'Reason for Moving';
      if (reasonHint) { reasonHint.textContent = ''; reasonHint.style.display = 'none'; }
    } else if (status === 'Other') {
      if (rentGrp) rentGrp.style.display = '';
      if (rentLbl) rentLbl.textContent = isEs ? 'Costo Mensual de Vivienda (Opcional)' : 'Monthly Housing Cost (Optional)';
      if (rentHint) { rentHint.textContent = ''; rentHint.style.display = 'none'; }
      if (llNameGrp) llNameGrp.style.display = '';
      if (llNameLbl) llNameLbl.textContent = isEs ? 'Contacto de Propiedad (Opcional)' : 'Property Contact Name (Optional)';
      if (llPhoneGrp) llPhoneGrp.style.display = '';
      if (llPhoneLbl) llPhoneLbl.textContent = isEs ? 'Teléfono de Contacto (Opcional)' : 'Contact Phone (Optional)';
      if (reasonLbl) reasonLbl.textContent = isEs ? 'Describa su Vivienda Actual y Motivo' : 'Describe Current Housing & Reason for Moving';
      if (reasonHint) { reasonHint.textContent = ''; reasonHint.style.display = 'none'; }
    } else {
      if (rentGrp) rentGrp.style.display = '';
      if (rentLbl) rentLbl.textContent = t('fCurrentRent');
      if (rentHint) { rentHint.textContent = ''; rentHint.style.display = 'none'; }
      if (llNameGrp) llNameGrp.style.display = '';
      if (llNameLbl) llNameLbl.textContent = t('fLandlordName');
      if (llPhoneGrp) llPhoneGrp.style.display = '';
      if (llPhoneLbl) llPhoneLbl.textContent = t('fLandlordPhone');
      if (reasonLbl) reasonLbl.textContent = t('fReasonLeaving');
      if (reasonHint) { reasonHint.textContent = ''; reasonHint.style.display = 'none'; }
    }
  }

  function syncMbPriorHousingUi() {
    const isSupporter = applicantRole === 'guarantor' || applicantRole === 'co_signer';
    if (isSupporter) return;
    const prevStatus = String(document.getElementById('mb-prev-housing-status')?.value || '').trim();
    const isEs = currentLang === 'es';
    const llNameGrp = document.getElementById('mb-prev-landlord-name-group');
    const llPhoneGrp = document.getElementById('mb-prev-landlord-phone-group');
    const llNameLbl = document.getElementById('mb-prev-landlord-name-label');
    const llPhoneLbl = document.getElementById('mb-prev-landlord-phone-label');
    const llNameInput = document.getElementById('mb-prev-landlord-name');
    const llPhoneInput = document.getElementById('mb-prev-landlord-phone');

    if (prevStatus === 'Own' || prevStatus === 'Mortgage') {
      if (llNameGrp) llNameGrp.style.display = 'none';
      if (llPhoneGrp) llPhoneGrp.style.display = 'none';
      if (llNameInput) llNameInput.value = '';
      if (llPhoneInput) llPhoneInput.value = '';
    } else if (prevStatus === 'Living with Family' || prevStatus === 'Family' || prevStatus === 'Other') {
      if (llNameGrp) llNameGrp.style.display = '';
      if (llPhoneGrp) llPhoneGrp.style.display = '';
      if (llNameLbl) llNameLbl.textContent = prevStatus === 'Other'
        ? (isEs ? 'Contacto de Propiedad Anterior (Opcional)' : 'Previous Property Contact (Optional)')
        : (isEs ? 'Anfitrión / Familiar Anterior (Opcional)' : 'Previous Host / Family Name (Optional)');
      if (llPhoneLbl) llPhoneLbl.textContent = prevStatus === 'Other'
        ? (isEs ? 'Teléfono de Contacto Anterior (Opcional)' : 'Previous Contact Phone (Optional)')
        : (isEs ? 'Teléfono del Anfitrión Anterior (Opcional)' : 'Previous Host Phone (Optional)');
    } else {
      if (llNameGrp) llNameGrp.style.display = '';
      if (llPhoneGrp) llPhoneGrp.style.display = '';
      if (llNameLbl) llNameLbl.textContent = t('fPrevLandlordName');
      if (llPhoneLbl) llPhoneLbl.textContent = t('fPrevLandlordPhone');
    }
  }

  function syncMbEmploymentStatusUi() {
    const status = String(document.getElementById('mb-emp-status')?.value || '').trim();
    const isEs = currentLang === 'es';
    const show = (id, visible) => {
      const el = document.getElementById(id);
      if (el) el.style.display = visible ? '' : 'none';
    };
    const clear = (id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    };
    const setLbl = (id, enTxt, esTxt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = isEs ? esTxt : enTxt;
    };
    const incInput = document.getElementById('mb-monthly-income');
    const incHint = document.getElementById('mb-income-hint');
    const otherHint = document.getElementById('mb-other-income-hint');

    if (status === 'Unemployed') {
      show('mb-employer-group', false); clear('mb-employer');
      show('mb-employer-address-group', false); clear('mb-employer-address');
      show('mb-job-title-group', false); clear('mb-job-title');
      show('mb-emp-start-date-group', false); clear('mb-emp-start-date');
      show('mb-emp-duration-group', false); clear('mb-emp-duration');
      setLbl('mb-monthly-income-label', 'Monthly Assistance / Unemployment / Savings ($0 if none)', 'Ingreso Mensual por Asistencia / Desempleo / Ahorros ($0 si ninguno)');
      if (incInput) incInput.placeholder = '0';
      if (incHint) {
        incHint.textContent = isEs ? 'Ingrese 0 si depende de ahorros u otro miembro del hogar.' : 'Enter 0 if relying on savings or another household member.';
        incHint.style.display = 'block';
      }
      if (otherHint) {
        otherHint.textContent = isEs ? 'Beneficios por desempleo, ahorros o ayuda familiar.' : 'Unemployment benefits, savings draw, or family support.';
        otherHint.style.display = 'block';
      }
    } else if (status === 'Retired') {
      show('mb-employer-group', true);
      show('mb-employer-address-group', true);
      show('mb-job-title-group', true);
      show('mb-emp-start-date-group', true);
      show('mb-emp-duration-group', true);
      setLbl('mb-employer-label', 'Retirement / Pension Source (Optional)', 'Fuente de Jubilación / Pensión (Opcional)');
      setLbl('mb-employer-address-label', 'Former Employer / Agency Address (Optional)', 'Dirección de Ex Empleador / Agencia (Opcional)');
      setLbl('mb-job-title-label', 'Former Job Title (Optional)', 'Cargo Anterior (Opcional)');
      setLbl('mb-emp-start-date-label', 'Retirement Start Date (Optional)', 'Fecha de Retiro (Opcional)');
      setLbl('mb-emp-duration-label', 'Years Retired (Optional)', 'Años Retirado (Opcional)');
      setLbl('mb-monthly-income-label', 'Monthly Retirement / Pension / Benefit Income ($)', 'Ingreso Mensual de Jubilación / Pensión ($)');
      if (incInput) incInput.placeholder = '2800';
      if (incHint) { incHint.textContent = isEs ? 'Seguro Social, pensión o retiro.' : 'Social Security, pension, or retirement draw.'; incHint.style.display = 'block'; }
      if (otherHint) { otherHint.style.display = 'none'; }
    } else if (status === 'Student') {
      show('mb-employer-group', true);
      show('mb-employer-address-group', true);
      show('mb-job-title-group', true);
      show('mb-emp-start-date-group', true);
      show('mb-emp-duration-group', true);
      setLbl('mb-employer-label', 'School / Institution Name (Optional)', 'Escuela / Institución (Opcional)');
      setLbl('mb-employer-address-label', 'Institution Address (Optional)', 'Dirección de la Institución (Opcional)');
      setLbl('mb-job-title-label', 'Program / Field of Study (Optional)', 'Programa / Campo de Estudio (Opcional)');
      setLbl('mb-emp-start-date-label', 'Enrollment Start Date (Optional)', 'Fecha de Inicio (Opcional)');
      setLbl('mb-emp-duration-label', 'Years at Institution (Optional)', 'Años en la Institución (Opcional)');
      setLbl('mb-monthly-income-label', 'Monthly Income / Aid / Support ($0 if none)', 'Ingreso / Ayuda / Apoyo Mensual ($0 si ninguno)');
      if (incInput) incInput.placeholder = '0';
      if (incHint) { incHint.textContent = isEs ? 'Ingrese 0 si cuenta con beca o respaldo familiar.' : 'Enter 0 if supported by scholarships, savings, or family.'; incHint.style.display = 'block'; }
      if (otherHint) { otherHint.style.display = 'none'; }
    } else if (status === 'Self-Employed') {
      show('mb-employer-group', true);
      show('mb-employer-address-group', true);
      show('mb-job-title-group', true);
      show('mb-emp-start-date-group', true);
      show('mb-emp-duration-group', true);
      setLbl('mb-employer-label', 'Business / Trade Name', 'Nombre del Negocio');
      setLbl('mb-employer-address-label', 'Business Address (Optional)', 'Dirección del Negocio (Opcional)');
      setLbl('mb-job-title-label', 'Your Role / Occupation', 'Su Rol / Ocupación');
      setLbl('mb-emp-start-date-label', 'Business Start Date (Optional)', 'Fecha de Inicio del Negocio (Opcional)');
      setLbl('mb-emp-duration-label', 'Time in Business', 'Tiempo en el Negocio');
      setLbl('mb-monthly-income-label', 'Gross Monthly Business Income ($)', 'Ingreso Bruto Mensual del Negocio ($)');
      if (incInput) incInput.placeholder = '4500';
      if (incHint) { incHint.style.display = 'none'; }
      if (otherHint) { otherHint.style.display = 'none'; }
    } else if (status === 'Fixed Income / Benefits' || status === 'Other') {
      show('mb-employer-group', true);
      show('mb-employer-address-group', true);
      show('mb-job-title-group', true);
      show('mb-emp-start-date-group', true);
      show('mb-emp-duration-group', true);
      setLbl('mb-employer-label', 'Income / Benefit Source (Optional)', 'Fuente de Ingreso / Beneficio (Opcional)');
      setLbl('mb-employer-address-label', 'Source / Agency Address (Optional)', 'Dirección de la Fuente / Agencia (Opcional)');
      setLbl('mb-job-title-label', 'Benefit / Income Type (Optional)', 'Tipo de Beneficio o Ingreso (Opcional)');
      setLbl('mb-emp-start-date-label', 'Benefit Start Date (Optional)', 'Fecha de Inicio (Opcional)');
      setLbl('mb-emp-duration-label', 'Duration Receiving Income (Optional)', 'Tiempo Recibiendo el Ingreso (Opcional)');
      setLbl('mb-monthly-income-label', 'Monthly Gross Income ($)', 'Ingreso Bruto Mensual ($)');
      if (incInput) incInput.placeholder = '2500';
      if (incHint) { incHint.style.display = 'none'; }
      if (otherHint) { otherHint.style.display = 'none'; }
    } else {
      show('mb-employer-group', true);
      show('mb-employer-address-group', true);
      show('mb-job-title-group', true);
      show('mb-emp-start-date-group', true);
      show('mb-emp-duration-group', true);
      setLbl('mb-employer-label', t('fEmployer'), t('fEmployer'));
      setLbl('mb-employer-address-label', t('fEmployerAddress'), t('fEmployerAddress'));
      setLbl('mb-job-title-label', t('fJobTitle'), t('fJobTitle'));
      setLbl('mb-emp-start-date-label', t('fEmpStartDate'), t('fEmpStartDate'));
      setLbl('mb-emp-duration-label', t('fEmpDuration'), t('fEmpDuration'));
      setLbl('mb-monthly-income-label', t('fMonthlyIncome'), t('fMonthlyIncome'));
      if (incInput) incInput.placeholder = '5000';
      if (incHint) { incHint.style.display = 'none'; }
      if (otherHint) { otherHint.style.display = 'none'; }
    }
  }

  async function compressImageFile(file) {
    if (!file || !/^image\/(jpeg|jpg|png|webp)$/i.test(file.type) || file.size < 350 * 1024) {
      return file;
    }
    return new Promise((resolve) => {
      const img = new Image();
      const objUrl = URL.createObjectURL(file);
      img.onload = () => {
        try {
          const maxDim = 1800;
          let w = img.naturalWidth || img.width;
          let h = img.naturalHeight || img.height;
          if (!w || !h) { URL.revokeObjectURL(objUrl); return resolve(file); }
          if (w > maxDim || h > maxDim) {
            if (w >= h) { h = Math.round(h * (maxDim / w)); w = maxDim; }
            else { w = Math.round(w * (maxDim / h)); h = maxDim; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { URL.revokeObjectURL(objUrl); return resolve(file); }
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob((blob) => {
            URL.revokeObjectURL(objUrl);
            if (!blob || blob.size >= file.size) return resolve(file);
            const cleanName = (file.name || 'upload').replace(/\.[^.]+$/, '') + '.jpg';
            resolve(new File([blob], cleanName, { type: 'image/jpeg' }));
          }, 'image/jpeg', 0.84);
        } catch {
          URL.revokeObjectURL(objUrl);
          resolve(file);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objUrl);
        resolve(file);
      };
      img.src = objUrl;
    });
  }

  function renderDocsList() {
    const ul = document.getElementById('doc-uploaded-list');
    if (ul) {
      if (!uploadedDocs.length) {
        ul.innerHTML = '';
      } else {
        ul.innerHTML = uploadedDocs.map((d) => {
          const name = escapeHtml(d.original_file_name || d.name || 'Document');
          const sideTag = (d.metadata && d.metadata.doc_side) || d.doc_side ? ` · ${(d.metadata && d.metadata.doc_side) || d.doc_side}` : '';
          const kind = escapeHtml(String(d.doc_type || '').replace(/_/g, ' ') + sideTag);
          const thumbHtml = d.previewUrl
            ? `<img src="${escapeHtml(d.previewUrl)}" alt="" class="doc-slot-thumb">`
            : '';
          return `<li class="doc-item"><div style="display:flex;align-items:center;gap:10px;min-width:0;">${thumbHtml}<span class="doc-item-name">${name} <small style="color:var(--muted);font-weight:500">(${kind})</small></span></div><span class="doc-item-badge">✓</span></li>`;
        }).join('');
      }
    }

    const grid = document.getElementById('doc-slots-grid');
    if (grid) {
      grid.innerHTML = '';
      DOC_SLOTS.forEach((slot) => {
        const matched = uploadedDocs.filter((d) => {
          const dSide = (d.metadata && d.metadata.doc_side) || d.doc_side || null;
          if (slot.side) return d.doc_type === slot.docType && dSide === slot.side;
          return d.doc_type === slot.docType && !dSide;
        });
        const card = document.createElement('div');
        card.className = 'doc-slot-card' + (matched.length ? ' is-filled' : '');
        const label = currentLang === 'es' ? slot.titleEs : slot.title;
        const sub = currentLang === 'es' ? slot.subEs : slot.sub;
        const btnLabel = matched.length
          ? (currentLang === 'es' ? 'Reemplazar / Agregar otro' : 'Replace / Add Another')
          : (slot.capture
              ? (currentLang === 'es' ? 'Tomar Foto / Subir' : 'Take Photo / Upload')
              : (currentLang === 'es' ? 'Elegir Archivo' : 'Choose File'));
        card.innerHTML = `
          <div class="doc-slot-head">
            <span class="doc-slot-title">${escapeHtml(label)}</span>
            ${matched.length ? `<span class="doc-item-badge">✓ ${matched.length}</span>` : ''}
          </div>
          <div class="doc-slot-sub">${matched.length ? escapeHtml(matched[0].original_file_name || 'Uploaded') : escapeHtml(sub)}</div>
          <button type="button" class="btn-upload" data-slot-key="${slot.key}">${escapeHtml(btnLabel)}</button>
        `;
        grid.appendChild(card);
      });
    }
  }

  function renderMethodASummary(profile) {
    const grid = document.getElementById('method-a-grid');
    if (!grid) return;
    const p = profile || {};
    const items = [
      { l: t('summaryDob'), v: p.dob || '—' },
      { l: t('summarySsn'), v: pageData && pageData.has_ssn ? `${t('providedOnFile')} (•••-••-${pageData.ssn_last4 || '****'})` : '—' },
      { l: t('summaryAddress'), v: p.current_address || '—' },
    ];
    if (applicantRole === 'guarantor' || applicantRole === 'co_signer') {
      if (p.housing_status) items.push({ l: t('summaryHousing'), v: p.housing_status });
    } else if (p.current_landlord_name) {
      items.push({ l: t('summaryLandlord'), v: p.current_landlord_name });
    }
    items.push({ l: t('summaryEmp'), v: [p.employment_status, p.employer].filter(Boolean).join(' — ') || '—' });
    if (p.monthly_income) items.push({ l: t('summaryMonthly'), v: '$' + Number(String(p.monthly_income).replace(/[^0-9.]/g, '') || 0).toLocaleString() });
    if (p.other_income && Number(String(p.other_income).replace(/[^0-9.]/g, '')) > 0) {
      items.push({ l: t('summaryOther'), v: '$' + Number(String(p.other_income).replace(/[^0-9.]/g, '')).toLocaleString() });
    }

    grid.innerHTML = items.map((it) =>
      `<div class="info-item"><span class="info-label">${escapeHtml(it.l)}</span><span class="info-val">${escapeHtml(it.v)}</span></div>`
    ).join('');
  }

  function applyTranslations() {
    document.documentElement.lang = currentLang;
    const langBtnLabel = document.getElementById('lang-toggle-label');
    if (langBtnLabel) langBtnLabel.textContent = t('langToggle');

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const k = el.getAttribute('data-i18n');
      if (k && t(k)) el.textContent = t(k);
    });

    if (!pageData) return;

    const pill = document.getElementById('applicant-role-pill');
    const banner = document.getElementById('role-banner');
    const roleDict = STR[currentLang].roleLabels;
    const bannerDict = STR[currentLang].roleBanners;
    if (pill) {
      pill.textContent = roleDict[applicantRole] || roleDict.co_applicant;
      pill.className = 'role-pill' + (applicantRole === 'guarantor' ? ' role-pill--guarantor' : applicantRole === 'co_signer' ? ' role-pill--cosigner' : '');
    }
    if (banner) {
      banner.textContent = bannerDict[applicantRole] || bannerDict.co_applicant;
      banner.className = 'role-banner' + (applicantRole === 'guarantor' ? ' role-banner--guarantor' : applicantRole === 'co_signer' ? ' role-banner--cosigner' : '');
    }

    const titleEl = document.getElementById('form-main-title');
    const subEl = document.getElementById('form-main-sub');
    if (titleEl) titleEl.textContent = isMethodB ? t('formTitleMethodB') : t('formTitleMethodA');
    if (subEl) subEl.textContent = isMethodB ? t('formSubMethodB') : t('formSubMethodA');

    const docsSub = document.getElementById('docs-sub');
    if (docsSub) docsSub.textContent = isMethodB ? t('docsSubMethodB') : t('docsSubMethodA');

    const isSupporter = applicantRole === 'guarantor' || applicantRole === 'co_signer';
    const fcraP1 = document.getElementById('fcra-p1');
    const chk2Desc = document.getElementById('chk2-desc');
    if (fcraP1) fcraP1.textContent = isSupporter ? t('fcraSupporterP1') : t('fcraOccupantP1');
    if (chk2Desc) chk2Desc.textContent = isSupporter ? t('chk2Supporter') : t('chk2Occupant');

    const chk1Desc = document.getElementById('chk1-desc');
    const applicantName = pageData.applicant_name || 'Applicant';
    if (chk1Desc) {
      if (currentLang === 'es') {
        chk1Desc.innerHTML = `Confirmo que soy <strong id="chk-applicant-name">${escapeHtml(applicantName)}</strong> y que la información personal, residencial, laboral y financiera enviada bajo mi nombre es correcta.`;
      } else {
        chk1Desc.innerHTML = `I confirm that I am <strong id="chk-applicant-name">${escapeHtml(applicantName)}</strong> and that the personal, residential, employment, and financial details submitted under my name are accurate.`;
      }
    }

    const btn = document.getElementById('btn-confirm-consent');
    if (btn && !btn.dataset.submitting) {
      btn.textContent = isMethodB ? t('btnSubmitMethodB') : t('btnSubmitMethodA');
    }

    const ssnToggle = document.getElementById('mb-ssn-toggle');
    const ssnInput = document.getElementById('mb-ssn');
    if (ssnToggle && ssnInput) {
      ssnToggle.textContent = ssnInput.type === 'text' ? t('hide') : t('show');
    }

    const ssnOnFile = document.getElementById('mb-ssn-onfile-text');
    if (ssnOnFile && pageData.has_ssn) {
      ssnOnFile.textContent = `${t('ssnOnFilePrefix')}${pageData.ssn_last4 || '****'})`;
    }

    const infoExp = document.getElementById('info-expires');
    if (infoExp && pageData.expires_at) infoExp.textContent = fmtDate(pageData.expires_at);

    syncSsnModeUi();
    syncMbHousingStatusUi();
    syncMbPriorHousingUi();
    syncMbEmploymentStatusUi();
    renderDocsList();
    if (!isMethodB) renderMethodASummary(pageData.profile);
  }

  function applyRoleFieldGating() {
    const isSupporter = applicantRole === 'guarantor' || applicantRole === 'co_signer';
    document.querySelectorAll('.mb-occupant-only').forEach((el) => {
      el.style.display = isSupporter ? 'none' : '';
    });
    document.querySelectorAll('.mb-supporter-only').forEach((el) => {
      el.style.display = isSupporter ? '' : 'none';
    });
    syncDisclosureExplanations();
    syncMbHousingStatusUi();
    syncMbPriorHousingUi();
    syncMbEmploymentStatusUi();
  }

  function prefillMethodB(profile) {
    const p = profile || {};
    const setVal = (id, v) => {
      const el = document.getElementById(id);
      if (el && v !== undefined && v !== null) el.value = String(v);
    };
    const normalizedHousing = p.housing_status === 'Family' ? 'Living with Family' : p.housing_status;
    setVal('mb-phone', p.phone);
    setVal('mb-dob', p.dob);
    setVal('mb-id-type', p.government_id_type);
    setVal('mb-id-number', p.government_id_number);
    setVal('mb-address', p.current_address);
    setVal('mb-housing-status', normalizedHousing);
    setVal('mb-residency-duration', p.residency_duration);
    setVal('mb-current-rent', p.current_rent_amount);
    setVal('mb-landlord-name', p.current_landlord_name);
    setVal('mb-landlord-phone', p.landlord_phone);
    setVal('mb-reason-leaving', p.reason_for_leaving);
    setVal('mb-prev-address', p.previous_address);
    setVal('mb-prev-res-duration', p.previous_residency_duration);
    setVal('mb-prev-landlord-name', p.previous_landlord_name);
    setVal('mb-prev-landlord-phone', p.previous_landlord_phone);
    setVal('mb-emp-status', p.employment_status);
    setVal('mb-employer', p.employer);
    setVal('mb-employer-address', p.employer_address);
    setVal('mb-job-title', p.job_title);
    setVal('mb-emp-start-date', p.employment_start_date);
    setVal('mb-emp-duration', p.employment_duration);
    setVal('mb-monthly-income', p.monthly_income);
    setVal('mb-other-income', p.other_income);
    setVal('mb-support-notes', p.financial_support_notes);
    setVal('mb-bankruptcy-explain', p.bankruptcy_explanation);
    setVal('mb-criminal-explain', p.criminal_history_explanation);

    const evictedVal = p.ever_evicted ? 'yes' : 'no';
    const evictedRadio = document.querySelector(`input[name="mb-ever-evicted"][value="${evictedVal}"]`);
    if (evictedRadio) evictedRadio.checked = true;

    const smokerVal = p.smoker ? 'yes' : 'no';
    const smokerRadio = document.querySelector(`input[name="mb-smoker"][value="${smokerVal}"]`);
    if (smokerRadio) smokerRadio.checked = true;

    const bankVal = p.has_bankruptcy ? 'yes' : 'no';
    const bankRadio = document.querySelector(`input[name="mb-has-bankruptcy"][value="${bankVal}"]`);
    if (bankRadio) bankRadio.checked = true;

    const crimVal = p.has_criminal_history ? 'yes' : 'no';
    const crimRadio = document.querySelector(`input[name="mb-has-criminal"][value="${crimVal}"]`);
    if (crimRadio) crimRadio.checked = true;

    syncDisclosureExplanations();
    syncMbHousingStatusUi();
    syncMbPriorHousingUi();
    syncMbEmploymentStatusUi();

    if (pageData && pageData.has_ssn) {
      document.getElementById('mb-ssn-onfile').style.display = 'flex';
      document.getElementById('mb-ssn-input-wrap').style.display = 'none';
      const star = document.getElementById('mb-ssn-star');
      if (star) star.style.display = 'none';
      const modeGroup = document.getElementById('mb-ssn-mode-group');
      if (modeGroup) modeGroup.style.display = 'none';
    }
  }

  function clearInvalidMarks() {
    document.querySelectorAll('.input-invalid').forEach((el) => el.classList.remove('input-invalid'));
  }

  function collectAndValidateMethodB() {
    clearInvalidMarks();
    const val = (id) => (document.getElementById(id)?.value || '').trim();
    const markBad = (id, msg) => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.add('input-invalid');
        el.focus();
      }
      return msg;
    };

    const dob = val('mb-dob');
    const age = ageInYears(dob);
    if (!dob || age === null || age < 18 || age > 120) {
      return { error: markBad('mb-dob', t('errInvalidDob')) };
    }

    const ssnMode = getSelectedSsnMode();
    let ssnDigits = '';
    if (!(pageData && pageData.has_ssn)) {
      if (ssnMode === 'alternative_id') {
        if (!val('mb-id-type') || !val('mb-id-number')) {
          return { error: markBad(!val('mb-id-type') ? 'mb-id-type' : 'mb-id-number', t('errMissingAltId')) };
        }
      } else {
        const d4 = val('mb-ssn').replace(/\D/g, '');
        if (d4.length !== 4 || d4 === '0000') {
          return { error: markBad('mb-ssn', t('errMissingLast4')) };
        }
        ssnDigits = d4;
      }
    }

    const address = val('mb-address');
    if (!address) {
      return { error: markBad('mb-address', t('errMissingAddress')) };
    }

    const isSupporter = applicantRole === 'guarantor' || applicantRole === 'co_signer';
    const housingStatus = val('mb-housing-status');
    if (!housingStatus) {
      return { error: markBad('mb-housing-status', t('errMissingHousing')) };
    }

    const empStatus = val('mb-emp-status');
    if (!empStatus) {
      return { error: markBad('mb-emp-status', t('errMissingEmp')) };
    }

    const monthlyIncome = val('mb-monthly-income');
    if (monthlyIncome === '' || Number.isNaN(Number(monthlyIncome)) || Number(monthlyIncome) < 0) {
      return { error: markBad('mb-monthly-income', t('errMissingIncome')) };
    }

    const hasBankruptcy = !isSupporter && document.querySelector('input[name="mb-has-bankruptcy"]:checked')?.value === 'yes';
    const hasCriminal = !isSupporter && document.querySelector('input[name="mb-has-criminal"]:checked')?.value === 'yes';
    if (hasBankruptcy && !val('mb-bankruptcy-explain')) {
      return { error: markBad('mb-bankruptcy-explain', t('errMissingBankruptcyExplain')) };
    }
    if (hasCriminal && !val('mb-criminal-explain')) {
      return { error: markBad('mb-criminal-explain', t('errMissingCriminalExplain')) };
    }

    const profile = {
      phone: val('mb-phone'),
      dob,
      ssn_mode: ssnMode,
      government_id_type: val('mb-id-type'),
      government_id_number: val('mb-id-number'),
      current_address: address,
      housing_status: housingStatus,
      employment_status: empStatus,
      employer: val('mb-employer'),
      employer_address: val('mb-employer-address'),
      job_title: val('mb-job-title'),
      employment_start_date: val('mb-emp-start-date'),
      employment_duration: val('mb-emp-duration'),
      monthly_income: monthlyIncome,
      other_income: val('mb-other-income'),
    };
    if (ssnDigits) profile.ssn = ssnDigits;

    if (isSupporter) {
      profile.financial_support_notes = val('mb-support-notes');
    } else {
      profile.residency_duration = val('mb-residency-duration');
      profile.current_rent_amount = val('mb-current-rent');
      profile.current_landlord_name = val('mb-landlord-name');
      profile.landlord_phone = val('mb-landlord-phone');
      profile.reason_for_leaving = val('mb-reason-leaving');
      profile.previous_address = val('mb-prev-address');
      profile.previous_residency_duration = val('mb-prev-res-duration');
      profile.previous_landlord_name = val('mb-prev-landlord-name');
      profile.previous_landlord_phone = val('mb-prev-landlord-phone');
      profile.ever_evicted = document.querySelector('input[name="mb-ever-evicted"]:checked')?.value === 'yes';
      profile.smoker = document.querySelector('input[name="mb-smoker"]:checked')?.value === 'yes';
      profile.has_bankruptcy = hasBankruptcy;
      if (hasBankruptcy) profile.bankruptcy_explanation = val('mb-bankruptcy-explain');
      profile.has_criminal_history = hasCriminal;
      if (hasCriminal) profile.criminal_history_explanation = val('mb-criminal-explain');
    }

    return { profile };
  }

  function bindUploader() {
    const grid = document.getElementById('doc-slots-grid');
    const fileInput = document.getElementById('doc-file-input');
    const statusEl = document.getElementById('doc-upload-status');
    if (!grid || !fileInput) return;

    let activeSlot = DOC_SLOTS[0];
    renderDocsList();

    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-slot-key]');
      if (!btn || btn.disabled) return;
      const found = DOC_SLOTS.find(s => s.key === btn.dataset.slotKey);
      if (!found) return;
      activeSlot = found;
      if (found.capture) fileInput.setAttribute('capture', found.capture);
      else fileInput.removeAttribute('capture');
      fileInput.value = '';
      fileInput.click();
    });

    fileInput.addEventListener('change', async () => {
      const rawFile = fileInput.files && fileInput.files[0];
      if (!rawFile) return;

      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if (!allowed.includes(rawFile.type)) {
        statusEl.className = 'upload-status upload-status--err';
        statusEl.textContent = 'Unsupported file type. Please upload PDF, JPG, PNG, or WEBP.';
        return;
      }
      if (rawFile.size > 15 * 1024 * 1024) {
        statusEl.className = 'upload-status upload-status--err';
        statusEl.textContent = 'File exceeds 15 MB raw size limit.';
        return;
      }

      grid.querySelectorAll('button').forEach(b => { b.disabled = true; });
      statusEl.className = 'upload-status';
      statusEl.textContent = t('uploading');

      try {
        const file = await compressImageFile(rawFile);
        const slot = activeSlot || DOC_SLOTS[5];
        const reqResp = await fetch(`${baseUrl}/request-upload-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: anonKey },
          body: JSON.stringify({
            consent_token: consentToken,
            file_name: file.name,
            file_type: file.type,
            doc_type: slot.docType,
            ...(slot.side ? { doc_side: slot.side } : {}),
          }),
        });
        const reqJson = await reqResp.json().catch(() => ({}));
        if (!reqResp.ok || !reqJson.signed_url) {
          throw new Error(reqJson.error || 'Could not initialize document upload.');
        }

        const putResp = await fetch(reqJson.signed_url, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });
        if (!putResp.ok) {
          throw new Error('Storage upload failed. Please try again.');
        }

        const markResp = await fetch(`${baseUrl}/request-upload-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: anonKey },
          body: JSON.stringify({
            action: 'mark_uploaded',
            document_id: reqJson.document_id,
            consent_token: consentToken,
            file_size: file.size,
          }),
        });
        if (!markResp.ok) {
          throw new Error('Could not finalize uploaded document.');
        }

        const previewUrl = /^image\//.test(file.type) ? URL.createObjectURL(file) : '';
        uploadedDocs.unshift({
          id: reqJson.document_id,
          original_file_name: file.name,
          doc_type: slot.docType,
          doc_side: slot.side || null,
          previewUrl,
        });
        renderDocsList();
        statusEl.className = 'upload-status upload-status--ok';
        statusEl.textContent = t('uploadOk');
      } catch (err) {
        statusEl.className = 'upload-status upload-status--err';
        statusEl.textContent = err.message || 'Upload failed.';
      } finally {
        grid.querySelectorAll('button').forEach(b => { b.disabled = false; });
      }
    });
  }

  async function init() {
    const langParam = new URLSearchParams(location.search).get('lang');
    if (langParam && langParam.toLowerCase().startsWith('es')) currentLang = 'es';

    const langBtn = document.getElementById('lang-toggle-btn');
    if (langBtn) {
      langBtn.addEventListener('click', () => {
        currentLang = currentLang === 'en' ? 'es' : 'en';
        applyTranslations();
      });
    }

    consentToken = getToken();
    if (!consentToken) {
      applyTranslations();
      showError(t('errMissingToken'), t('errMissingTokenDesc'));
      return;
    }

    baseUrl = typeof CONFIG !== 'undefined' && CONFIG.SUPABASE_URL
      ? CONFIG.SUPABASE_URL.replace(/\/$/, '') + '/functions/v1'
      : '';
    anonKey = typeof CONFIG !== 'undefined' ? (CONFIG.SUPABASE_ANON_KEY || '') : '';
    if (!baseUrl || !anonKey) {
      showError('Configuration Error', 'Unable to reach Choice Properties services. Please refresh and try again.');
      return;
    }

    let resp, data;
    try {
      resp = await fetch(`${baseUrl}/confirm-co-applicant-screening?token=${encodeURIComponent(consentToken)}`, {
        method: 'GET',
        headers: { apikey: anonKey },
      });
      data = await resp.json();
    } catch {
      showError('Connection Error', 'Could not connect to the verification server. Please check your connection and try again.');
      return;
    }

    if (!resp.ok || !data || !data.valid) {
      showError(
        'Consent Link Invalid or Expired',
        (data && data.error) || 'This link has expired, was revoked, or has already been confirmed.'
      );
      return;
    }

    pageData = data;
    if (!langParam && data.preferred_language === 'es') currentLang = 'es';

    applicantRole = normalizeRole(data.applicant_type || data.applicant_role);
    isMethodB = data.submission_method === 'invited' || data.info_completed === false;
    uploadedDocs = Array.isArray(data.documents) ? data.documents.slice() : [];

    const appId = data.app_id || '—';

    function renderSuccessScreen(payload, fallbackAppId) {
      const finalAppId = (payload && payload.app_id) || fallbackAppId;
      const successTitle = document.getElementById('success-title');
      const successMsg = document.getElementById('success-message');
      const portalLink = document.getElementById('success-portal-link');

      if (successTitle) {
        successTitle.textContent = isMethodB ? t('successTitle') : t('successTitleMethodA');
      }
      if (successMsg) {
        const subText = isMethodB ? t('successSub') : t('successSubMethodA');
        successMsg.innerHTML = `${escapeHtml(subText)} <strong id="success-app-id">${escapeHtml(finalAppId)}</strong>`;
      }
      if (portalLink && finalAppId !== '—') {
        const applicantIdParam = (payload && payload.applicant_id || data.applicant_id || '').trim();
        portalLink.href = '/tenant/portal.html?app_id=' + encodeURIComponent(finalAppId)
          + (applicantIdParam ? '&applicant_id=' + encodeURIComponent(applicantIdParam) : '')
          + (data.applicant_email ? '&email=' + encodeURIComponent(data.applicant_email) : '');
        try { sessionStorage.setItem('pendingPortalAppId', finalAppId); } catch (_) {}
      }
      showState('success');
    }

    document.getElementById('info-applicant-name').textContent = data.applicant_name || 'Applicant';
    document.getElementById('info-applicant-email').textContent = data.applicant_email || '—';
    document.getElementById('info-property').textContent = data.property_address || '—';
    document.getElementById('info-primary-name').textContent = data.primary_name || '—';
    document.getElementById('info-app-id').textContent = appId;
    document.getElementById('info-expires').textContent = fmtDate(data.expires_at);

    document.getElementById('method-b-section').style.display = isMethodB ? '' : 'none';
    document.getElementById('method-a-summary-block').style.display = isMethodB ? 'none' : '';

    if (isMethodB) {
      applyRoleFieldGating();
      prefillMethodB(data.profile);
    } else {
      renderMethodASummary(data.profile);
    }
    renderDocsList();

    const ssnInput = document.getElementById('mb-ssn');
    const ssnToggle = document.getElementById('mb-ssn-toggle');
    if (ssnInput && ssnToggle) {
      ssnInput.addEventListener('input', () => {
        ssnInput.value = ssnInput.value.replace(/\D/g, '').slice(0, 4);
      });
      ssnToggle.addEventListener('click', () => {
        ssnInput.type = ssnInput.type === 'password' ? 'text' : 'password';
        ssnToggle.textContent = ssnInput.type === 'text' ? t('hide') : t('show');
      });
    }

    document.querySelectorAll('input[name="mb-ssn-mode"]').forEach((r) => {
      r.addEventListener('change', syncSsnModeUi);
    });
    document.querySelectorAll('input[name="mb-has-bankruptcy"], input[name="mb-has-criminal"]').forEach((r) => {
      r.addEventListener('change', syncDisclosureExplanations);
    });
    document.getElementById('mb-housing-status')?.addEventListener('change', syncMbHousingStatusUi);
    document.getElementById('mb-prev-housing-status')?.addEventListener('change', syncMbPriorHousingUi);
    document.getElementById('mb-emp-status')?.addEventListener('change', syncMbEmploymentStatusUi);

    bindUploader();

    const chk1 = document.getElementById('chk-identity');
    const chk2 = document.getElementById('chk-screening');
    const btn = document.getElementById('btn-confirm-consent');
    const errEl = document.getElementById('consent-error');

    function syncBtn() {
      [chk1, chk2].forEach((c) => {
        const card = c.closest('.consent-check-card');
        if (card) card.classList.toggle('checked', c.checked);
      });
      const ready = chk1.checked && chk2.checked;
      btn.disabled = !ready;
      btn.setAttribute('aria-disabled', String(!ready));
    }

    chk1.addEventListener('change', syncBtn);
    chk2.addEventListener('change', syncBtn);
    syncBtn();
    applyTranslations();

    btn.addEventListener('click', async () => {
      if (!chk1.checked || !chk2.checked) return;
      errEl.style.display = 'none';

      let profilePayload = undefined;
      if (isMethodB) {
        const check = collectAndValidateMethodB();
        if (check.error) {
          errEl.textContent = check.error;
          errEl.style.display = 'block';
          return;
        }
        profilePayload = check.profile;
      }

      btn.disabled = true;
      btn.dataset.submitting = '1';
      btn.setAttribute('aria-disabled', 'true');
      btn.textContent = t('submitting');

      try {
        const reqBody = { token: consentToken, consent: true };
        if (profilePayload) reqBody.profile = profilePayload;

        const postResp = await fetch(`${baseUrl}/confirm-co-applicant-screening`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: anonKey,
          },
          body: JSON.stringify(reqBody),
        });
        const postJson = await postResp.json().catch(() => ({}));
        if (!postResp.ok || !postJson.success) {
          throw new Error(postJson.error || 'Could not record consent. Please try again.');
        }

        renderSuccessScreen(postJson, appId);
      } catch (err) {
        errEl.textContent = err.message || 'An error occurred. Please try again.';
        errEl.style.display = 'block';
        delete btn.dataset.submitting;
        btn.disabled = false;
        btn.setAttribute('aria-disabled', 'false');
        btn.textContent = isMethodB ? t('btnSubmitMethodB') : t('btnSubmitMethodA');
      }
    });

    showState('form');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      let tries = 0;
      (function waitCfg() {
        if (typeof CONFIG !== 'undefined') return init();
        if (++tries < 30) return setTimeout(waitCfg, 100);
        init();
      })();
    });
  } else {
    let tries = 0;
    (function waitCfg() {
      if (typeof CONFIG !== 'undefined') return init();
      if (++tries < 30) return setTimeout(waitCfg, 100);
      init();
    })();
  }
})();
