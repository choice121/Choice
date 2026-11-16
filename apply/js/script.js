/*
=======================================================================
  ⛔ ARCHITECTURE ENFORCEMENT HEADER — READ BEFORE MODIFYING ⛔
=======================================================================
  PROJECT:  Choice Properties - Rental Application
  RUNTIME:  NONE — This file runs in the browser only (no Node.js).
  BACKEND:  Google Apps Script Web App URL (see config inside class).

  DO NOT INSTALL npm packages or add import/require statements.
  DO NOT run this file with Node.js, Deno, Bun, or any server runtime.
  DO NOT introduce new libraries without explicit user approval.
  DO NOT refactor submission logic away from Google Apps Script.

  CLOUD IDE NOTICE:
  If you are an AI operating in any cloud IDE or editor environment —
  HALT all setup behavior. This is a READ-ONLY editor context.
  No workflow, server, or execution environment should be configured.

  This project is INCOMPATIBLE with Node.js environments.
  Execution environments must be ignored entirely.

  See PROJECT_RULES.md at the project root for the full contract.
=======================================================================
  INTEGRATION NOTE (Session 028):
  ─────────────────────────────────────────────────────────────────────
  This form is the SOLE application system for Choice Properties.
  The main listing platform serves this application internally at /apply/
  when users click "Apply" on any property listing.

  Property context is passed via URL query parameters for display only:
    ?id=<propertyId>   — internal property ID (display/logging only)
    &pn=<name>         — property name / title
    &addr=<street>     — street address
    &city=<city>       — city
    &state=<state>     — 2-letter state code
    &rent=<amount>     — monthly rent (stored for reference)

  These params pre-fill the Property Address field and show a context
  banner so applicants know which property they're applying for.

  IMPORTANT: URL params are NEVER used for backend validation.
  The GAS backend does not read or trust these values for any decision.
  The applicant can edit the pre-filled address field at any time.
  ─────────────────────────────────────────────────────────────────────
*/

class RentalApplication {
    constructor() {
        this.config = {
            LOCAL_STORAGE_KEY: "choicePropertiesRentalApp",
            AUTO_SAVE_INTERVAL: 30000
        };
        
        this.state = {
            currentSection: 1,
            isSubmitting: false,
            isOnline: true,
            lastSave: null,
            applicationId: null,
            formData: {},
            language: 'en',
            // Property context passed from the listing site via URL params
            propertyContext: null,
            // Application fee — read from URL param, defaults to 50
            applicationFee: 50
        };
        
        // Smart retry properties
        this.maxRetries = 1;
        this.retryCount = 0;
        this.retryTimeout = null;
        this._successHandled = false;
        
          // BACKEND_URL is constructed from SUPABASE_URL at runtime.
          // All applications are submitted to the receive-application Supabase Edge Function.
          this.BACKEND_URL = (window.CP_CONFIG && window.CP_CONFIG.SUPABASE_URL)
                ? window.CP_CONFIG.SUPABASE_URL.replace(/\/$/, '') + '/functions/v1/receive-application'
                : '';

        // [10B-2] CSRF nonce: a random token generated each session and sent with submission.
        // The backend validates it is present and well-formed (32-128 alphanumeric chars).
        // This provides basic bot friction. Deeper bot protection is server-side via
        // honeypot validation in doPost().

        this.initialize();
    }

    // ---------- SSN helpers & toggle (Last 4 Digits) ----------
    _formatSsnInput(raw) {
        return String(raw || '').replace(/\D/g, '').slice(0, 4);
    }

    _getPrimarySsnMode() {
        const checked = document.querySelector('input[name="SSN Mode"]:checked');
        const val = checked ? String(checked.value || '').trim().toLowerCase() : 'last4';
        return val === 'alternative_id' ? 'alternative_id' : 'last4';
    }

    _validateLast4SsnValue(raw) {
        const digits = String(raw || '').replace(/\D/g, '');
        if (!digits) {
            return {
                ok: false,
                error: this.state.language === 'es'
                    ? 'Por favor ingrese los últimos 4 dígitos de su SSN.'
                    : 'Please enter the last 4 digits of your SSN.'
            };
        }
        if (digits.length !== 4 || digits === '0000') {
            return {
                ok: false,
                error: this.state.language === 'es'
                    ? 'Ingrese 4 dígitos válidos del SSN.'
                    : 'Please enter 4 valid SSN digits.'
            };
        }
        return { ok: true, digits, last4: digits, masked: `•••-••-${digits}` };
    }

    _validateSsnByMode(raw, mode = 'last4') {
        const m = mode === 'alternative_id' ? 'alternative_id' : 'last4';
        if (m === 'alternative_id') return { ok: true, digits: '', last4: '', masked: 'Alt Gov ID' };
        return this._validateLast4SsnValue(raw);
    }

    _syncPrimarySsnModeUi() {
        const mode = this._getPrimarySsnMode();
        const lang = this.state.language || 'en';
        const ssnGroup = document.getElementById('ssnInputGroup');
        const ssnEl = document.getElementById('ssn');
        const ssnLbl = document.getElementById('ssnLabelEl');
        const ssnHint = document.getElementById('ssnHintEl');
        const govTypeEl = document.getElementById('governmentIdType');
        const govNumEl = document.getElementById('governmentIdNumber');
        const govTypeLbl = document.getElementById('govIdTypeLabelEl');
        const govNumLbl = document.getElementById('govIdNumberLabelEl');

        document.querySelectorAll('input[name="SSN Mode"]').forEach(r => {
            const card = r.closest('.method-option-card');
            if (card) card.classList.toggle('active', r.checked);
        });

        if (mode === 'alternative_id') {
            if (ssnGroup) ssnGroup.style.display = 'none';
            if (ssnEl) {
                ssnEl.removeAttribute('required');
                ssnEl.value = '';
                ssnEl.classList.remove('is-invalid', 'is-valid');
                this.clearError(ssnEl);
            }
            if (govTypeEl) govTypeEl.setAttribute('required', 'required');
            if (govNumEl) govNumEl.setAttribute('required', 'required');
            if (govTypeLbl) {
                govTypeLbl.classList.add('required');
                govTypeLbl.textContent = lang === 'es' ? 'Tipo de Identificación Oficial (Requerido)' : 'Government ID Type (Required)';
            }
            if (govNumLbl) {
                govNumLbl.classList.add('required');
                govNumLbl.textContent = lang === 'es' ? 'Número de Identificación / ITIN / Pasaporte (Requerido)' : 'Government ID / ITIN / Passport Number (Required)';
            }
        } else {
            if (ssnGroup) ssnGroup.style.display = '';
            if (ssnEl) {
                ssnEl.setAttribute('required', 'required');
                ssnEl.maxLength = 4;
                ssnEl.placeholder = '1234';
                const digits = String(ssnEl.value || '').replace(/\D/g, '');
                if (digits.length > 4) ssnEl.value = digits.slice(-4);
            }
            if (ssnLbl) {
                ssnLbl.textContent = lang === 'es'
                    ? 'Número de Seguro Social (Últimos 4 Dígitos)'
                    : 'Social Security Number (Last 4 Digits)';
            }
            if (ssnHint) {
                const icon = this._icon('fas fa-lock');
                const msg = lang === 'es'
                    ? 'Últimos 4 dígitos únicamente (XXXX) — nunca se guardan en borradores del navegador o servidor'
                    : 'Last 4 digits only (XXXX) — never stored in browser or server drafts';
                ssnHint.replaceChildren(icon, document.createTextNode(' ' + msg));
            }
            if (govTypeEl) { govTypeEl.removeAttribute('required'); this.clearError(govTypeEl); govTypeEl.classList.remove('is-invalid'); }
            if (govNumEl) { govNumEl.removeAttribute('required'); this.clearError(govNumEl); govNumEl.classList.remove('is-invalid'); }
            if (govTypeLbl) {
                govTypeLbl.classList.remove('required');
                govTypeLbl.textContent = lang === 'es' ? 'Tipo de Identificación Oficial (Opcional)' : 'Government ID Type (Optional)';
            }
            if (govNumLbl) {
                govNumLbl.classList.remove('required');
                govNumLbl.textContent = lang === 'es' ? 'Número de Identificación Oficial (Opcional)' : 'Government ID Number (Optional)';
            }
        }
    }

    _attachSsnToggle(ssnInput, toggleId) {
        if (!ssnInput) return;
        const container = ssnInput.parentElement;
        if (!container) return;
        let toggle = container.querySelector('.ssn-toggle');
        if (!toggle) {
            toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'ssn-toggle';
            toggle.setAttribute('aria-label', 'Show or hide SSN');
            if (toggleId) toggle.id = toggleId;
            this._setIconOnly(toggle, 'fas fa-eye');
            container.appendChild(toggle);
        }
        ssnInput.type = 'password';
        if (!toggle.dataset.bound) {
            toggle.dataset.bound = '1';
            toggle.addEventListener('click', () => {
                if (ssnInput.type === 'password') {
                    ssnInput.type = 'text';
                    this._setIconOnly(toggle, 'fas fa-eye-slash');
                } else {
                    ssnInput.type = 'password';
                    this._setIconOnly(toggle, 'fas fa-eye');
                }
            });
        }
    }

    setupSSNToggle() {
        const primarySsn = document.getElementById('ssn');
        if (primarySsn) this._attachSsnToggle(primarySsn, 'ssnToggle');
    }

    _icon(className) {
        const icon = document.createElement('i');
        icon.className = className;
        return icon;
    }

    _setIconOnly(el, iconClass) {
        el.replaceChildren(this._icon(iconClass));
    }

    _setIconText(el, iconClass, text) {
        const icon = this._icon(iconClass);
        el.replaceChildren(icon, document.createTextNode(' ' + String(text || '')));
    }

    _safeHtml(value) {
        return { __safeHtml: true, value: String(value || '') };
    }

    _html(strings, ...values) {
        return strings.reduce((out, str, i) => {
            const value = values[i];
            const safeValue = value && value.__safeHtml ? value.value : this._escHtml(value == null ? '' : value);
            return out + str + (i < values.length ? safeValue : '');
        }, '');
    }

    _setTrustedHtml(el, html) {
        const template = document.createElement('template');
        template['innerHTML'] = String(html || '');
        el.replaceChildren(template.content.cloneNode(true));
    }

    _decodeHtmlText(text) {
        return String(text || '')
            .replace(/&nbsp;/g, '\u00a0')
            .replace(/&copy;/g, '©')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
    }

    _setSafeMarkup(el, html) {
        el.replaceChildren();
        const src = String(html || '');
        const tokenRe = /<(strong|a)\b([^>]*)>(.*?)<\/\1>|&nbsp;|&copy;/gi;
        let last = 0;
        let match;
        const appendText = (value) => {
            if (value) el.appendChild(document.createTextNode(this._decodeHtmlText(value)));
        };
        while ((match = tokenRe.exec(src)) !== null) {
            appendText(src.slice(last, match.index));
            if (match[0] === '&nbsp;') {
                el.appendChild(document.createTextNode('\u00a0'));
            } else if (match[0] === '&copy;') {
                el.appendChild(document.createTextNode('©'));
            } else if (match[1].toLowerCase() === 'strong') {
                const strong = document.createElement('strong');
                strong.textContent = this._decodeHtmlText(match[3]);
                el.appendChild(strong);
            } else {
                const hrefMatch = match[2].match(/\bhref=["']([^"']+)["']/i);
                const href = hrefMatch ? hrefMatch[1] : '';
                const a = document.createElement('a');
                a.textContent = this._decodeHtmlText(match[3]);
                a.href = href.startsWith('/') ? href : '/';
                a.target = '_blank';
                a.rel = 'noopener';
                a.style.color = 'var(--primary)';
                el.appendChild(a);
            }
            last = tokenRe.lastIndex;
        }
        appendText(src.slice(last));
    }

    // ---------- Event listeners ----------
    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.matches('.btn-next') || e.target.closest('.btn-next')) {
                const section = this.getCurrentSection();
                this.nextSection(section);
            }
            if (e.target.matches('.btn-prev') || e.target.closest('.btn-prev')) {
                const section = this.getCurrentSection();
                this.previousSection(section);
            }
            const stepTrigger = e.target.closest('.progress-step.clickable-step');
            if (stepTrigger) {
                const stepNum = parseInt(stepTrigger.dataset.step || '', 10);
                if (stepNum >= 1 && stepNum < this.getCurrentSection()) {
                    this.goToSection(stepNum);
                }
            }
        });
        document.addEventListener('input', this.debounce(() => {
            this.saveProgress();
        }, 1000));
        const form = document.getElementById('rentalApplication');
        if (form) {
            form.addEventListener('submit', (e) => {
                this.handleFormSubmit(e);
            });
        }
    }

    // ---------- Initialization ----------
    initialize() {
        // Pre-entry informational gate: redirect arrivals without ack=1 / resume / _dev / active submission receipt
        try {
            const qs = new URLSearchParams(window.location.search);
            const hasAck = qs.get('ack') === '1';
            const hasResume = Boolean(qs.get('resume'));
            const hasDev = qs.get('_dev') === '1';
            const hasSuccess = Boolean(sessionStorage.getItem('lastSuccessAppId'));
            const onStart = /\/start\.html$/i.test(window.location.pathname);
            if (!onStart && !hasAck && !hasResume && !hasDev && !hasSuccess) {
                const target = '/apply/start.html' + window.location.search + window.location.hash;
                window.location.replace(target);
                return;
            }
        } catch (_) {}

        // Generate and store a CSRF nonce for the session — required by the backend
        this._csrfToken = this.generateCsrfNonce();
        sessionStorage.setItem('_cp_csrf', this._csrfToken);
        this.setupEventListeners();
        this.setupOfflineDetection();
        this.setupRealTimeValidation();
        this.setupSSNToggle();
        this.setupCoApplicantsRepeater();
        this.setupFileUploads();
        this.setupConditionalFields();
        this.setupCharacterCounters();
        // [L4 fix] If URL has a server-side resume token, restore from backend; else use localStorage
        const _resumeParam = new URLSearchParams(window.location.search).get('resume');
        if (_resumeParam && _resumeParam !== '1') {
            this._restoreFromServer(_resumeParam);
        } else {
            this.restoreSavedProgress();
        }
        // Re-run conditional field syncs after draft restore
        if (this._syncHousingStatusUi) {
            const _hEl = document.getElementById('housingStatus');
            if (_hEl) this._syncHousingStatusUi(_hEl.value);
        }
        if (this._syncPriorHousingStatusUi) {
            const _phEl = document.getElementById('previousHousingStatus');
            if (_phEl) this._syncPriorHousingStatusUi(_phEl.value);
        }
        if (this._toggleEmployerSection) {
            const _empEl = document.getElementById('employmentStatus');
            if (_empEl) this._toggleEmployerSection(_empEl.value);
        }
        if (this._syncTotalOccupantsUi) this._syncTotalOccupantsUi();
        if (this._syncPriorResidenceVisibility) this._syncPriorResidenceVisibility();
        if (this._syncDisclosureExplanations) this._syncDisclosureExplanations();
        this._syncPrimarySsnModeUi();
        this.setupGeoapify();
        this.setupInputFormatting();
        this.setupIncomeRatioDisplay();
        this._readApplicationFee();
        this.setupLanguageToggle();
        this.setupSaveResume();
        this.setupCreditLookup();

        this._autoSaveTimer = setInterval(() => this.saveProgress(), this.config.AUTO_SAVE_INTERVAL);

        // Initialise fields-remaining hint for the first section
        setTimeout(() => this.updateFieldsRemainingHint(1), 50);

        // ── Read URL params from listing site and pre-fill form ──
        this._prefillFromURL();
        
        const savedAppId = sessionStorage.getItem('lastSuccessAppId');
        if (savedAppId) {
            document.getElementById('rentalApplication').style.display = 'none';
            const rb = document.getElementById('resumeBanner');
            if (rb) rb.remove();
            let savedExtra = null;
            try {
                const rawExtra = sessionStorage.getItem('lastSuccessExtra_' + savedAppId);
                if (rawExtra) savedExtra = JSON.parse(rawExtra);
            } catch (_) {}
            this.showSuccessState(savedAppId, sessionStorage.getItem('lastSuccessPortalUrl') || '', savedExtra);
        }
        
        this.setupDevTools();
        console.log('Rental Application Manager Initialized');
    }

    setupDevTools() {
        const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
        const isDevParam  = new URLSearchParams(window.location.search).get('_dev') === '1';

        // Always wire the long-press trigger — invisible to users, works in production
        this._wireLongPressDevTrigger();

        // Auto-activate immediately if on localhost or ?_dev=1
        if (isLocalhost || isDevParam) this._activateDevTools(false);
    }

    // ── Long-press the header logo for 600 ms to activate dev mode ────────
    _wireLongPressDevTrigger() {
        const logo = document.getElementById('cp-logo-link');
        if (!logo) return;
        let timer    = null;
        let activated = false;

        const start = () => {
            activated = false;
            timer = setTimeout(() => {
                activated = true;
                timer = null;
                this._activateDevTools(true);
            }, 600);
        };

        const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };

        logo.addEventListener('mousedown',   start);
        logo.addEventListener('touchstart',  start,  { passive: true });
        ['mouseup', 'mouseleave', 'touchend', 'touchcancel']
            .forEach(ev => logo.addEventListener(ev, cancel));

        // Prevent navigation when the long-press just fired
        logo.addEventListener('click', (e) => { if (activated) { activated = false; e.preventDefault(); } });
    }

    // ── Inject the dev button + optional toast ────────────────────────────
    _activateDevTools(showToast = false) {
        if (this._devActive) return;
        this._devActive = true;

        if (document.getElementById('devTestBar') || document.getElementById('devTestFillBtn')) return;

        // Floating dev toolbar with both "Fill Step" and "Fill All" buttons
        const container = document.createElement('div');
        container.id = 'devTestBar';
        container.style.cssText = 'position:fixed;bottom:70px;right:16px;z-index:99998;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end;';

        const button = document.createElement('button');
        button.id    = 'devTestFillBtn';
        button.type  = 'button';
        button.title = 'Fill current step with test data';
        button.textContent = '⚡ Fill Step';
        button.style.cssText = 'background:#f39c12;color:#fff;border:none;border-radius:24px;padding:9px 16px;font-size:12.5px;font-weight:700;cursor:pointer;box-shadow:0 3px 12px rgba(0,0,0,.25);';
        button.addEventListener('click', () => this._devFillTestData());

        const btnAll = document.createElement('button');
        btnAll.id    = 'devTestFillAllBtn';
        btnAll.type  = 'button';
        btnAll.title = 'Fill all 6 steps and jump straight to review';
        btnAll.textContent = '🚀 Fill All (Instant)';
        btnAll.style.cssText = 'background:#8e44ad;color:#fff;border:none;border-radius:24px;padding:9px 16px;font-size:12.5px;font-weight:700;cursor:pointer;box-shadow:0 3px 12px rgba(0,0,0,.25);';
        btnAll.addEventListener('click', () => this._devFillAll());

        container.appendChild(button);
        container.appendChild(btnAll);
        document.body.appendChild(container);

        if (showToast) {
            const t = document.createElement('div');
            t.textContent = '🛠 Dev mode activated';
            t.style.cssText = 'position:fixed;top:72px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#fff;padding:8px 20px;border-radius:20px;font-size:13px;font-weight:600;z-index:99999;pointer-events:none;transition:opacity .4s';
            document.body.appendChild(t);
            setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 2200);
        }
    }


    // ─────────────────────────────────────────────────────────────────────
    // APPLICATION FEE — read from URL param before translations are built.
    // Standard per-adult screening fee is $50 (waived only via application credit).
    // ─────────────────────────────────────────────────────────────────────
    _readApplicationFee() {
        try {
            const p      = new URLSearchParams(window.location.search);
            const rawFee = p.get('fee');
            const fee = (rawFee !== null && !isNaN(parseFloat(rawFee)) && parseFloat(rawFee) >= 0)
                ? (parseFloat(rawFee) === 0 ? 50 : parseFloat(rawFee))
                : 50; // Choice Properties standard: $50 per qualifying screening
            this.state.applicationFee = fee;
            this._updateTotalFeeDisplay();
        } catch (e) { console.warn('[CP App] Non-critical error in _readApplicationFee:', e); }
    }

    // ─────────────────────────────────────────────────────────────────────
    // URL PRE-FILL — reads context passed by the main listing platform.
    // Params: id, pn (name), addr, city, state, rent
    // All values are display-only. Backend never uses or validates these.
    // ─────────────────────────────────────────────────────────────────────
    _prefillFromURL() {
        try {
            const p     = new URLSearchParams(window.location.search);
            const id    = p.get('id')    || '';
            const name  = p.get('pn')   || '';
            const addr  = p.get('addr') || '';
            const city  = p.get('city') || '';
            const state = p.get('state') || '';
            const rent  = p.get('rent') || '';
            const shareToken = new URLSearchParams(window.location.hash.slice(1)).get('share') || p.get('share') || (function(){ try { return sessionStorage.getItem('cp_active_share_token') || ''; } catch(_){ return ''; } })() || '';
            if (shareToken) {
              try { sessionStorage.setItem('cp_active_share_token', shareToken); } catch (_) {}
            }

            // Nothing useful in the URL — show manual-entry prompt and return
            if (!id && !name && !addr && !city) { this._showNoContextPrompt(); return; }

            // Store context on instance for later use (success page, etc.)
            this.state.propertyContext = { id, name, addr, city, state, rent, shareToken };

            // Populate hidden inputs so FormData serialises them automatically
            const setHidden = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
            setHidden('hiddenPropertyId',    id);
            setHidden('hiddenPropertyName',  name);
            setHidden('hiddenPropertyCity',  city);
            setHidden('hiddenPropertyState', state);
            setHidden('hiddenListedRent',    rent);
              // Additional property context params
              const zip        = p.get('zip')         || '';
              const deposit    = p.get('deposit')     || '';
              const fee        = p.get('fee')         || '';
              const beds       = p.get('beds')        || '';
              const baths      = p.get('baths')       || '';
              const avail      = p.get('avail')       || '';
              const terms      = p.get('terms') || p.get('term') || ''; // support both param names
              const minMonths  = p.get('min_months')  || '';
              const pets       = p.get('pets')        || '';
              const petTypes   = p.get('pet_types')   || '';
              const petWeight  = p.get('pet_weight')  || '';
              const petDeposit = p.get('pet_deposit') || '';
              const petDetails = p.get('pet_details') || '';
              const smoking    = p.get('smoking')     || '';
              const utilities  = p.get('utilities')   || '';
              const parking    = p.get('parking')     || '';
              const parkingFee     = p.get('parking_fee')     || '';
              const garageSpaces  = p.get('garage_spaces')   || '';
              const evCharging    = p.get('ev_charging')     || '';
              const laundryType   = p.get('laundry_type')    || '';
              const heatingType   = p.get('heating_type')    || '';
              const coolingType   = p.get('cooling_type')    || '';
              const lastMonthsRent = p.get('last_months_rent') || '';
              const adminFee      = p.get('admin_fee')       || '';
              const moveInSpecial = p.get('move_in_special')  || '';

              setHidden('hiddenPropertyZip',     zip);
              setHidden('hiddenPropertyAddress', addr);
              setHidden('hiddenSecurityDeposit', deposit);
              setHidden('hiddenApplicationFee',  fee);
              setHidden('hiddenBedrooms',        beds);
              setHidden('hiddenBathrooms',       baths);
              setHidden('hiddenAvailableDate',   avail);
              // Enforce available date as minimum move-in date so users can't
              // select a date before the property is actually available
              if (avail) {
                  const moveInField = document.getElementById('requestedMoveIn');
                  if (moveInField) moveInField.min = avail;
              }
              setHidden('hiddenLeaseTerms',      terms);
              setHidden('hiddenMinLeaseMonths',  minMonths);
              // Populate "Desired Lease Term" dropdown with allowed options from URL params,
              // and enforce min_months by filtering out terms shorter than the minimum.
                if (terms) {
                    const termsList = terms.split('|').map(t => t.trim()).filter(Boolean);
                    const leaseSelect = document.getElementById('desiredLeaseTerm');
                    if (leaseSelect && termsList.length) {
                        // Parse minimum months constraint
                        const minMonthsNum = minMonths ? parseInt(minMonths, 10) : 0;
                        // Helper: extract numeric month count from a term string like "6 months", "12 months"
                        const termToMonths = (term) => {
                            const mtm = /month.to.month/i.test(term);
                            if (mtm) return 1; // month-to-month is shortest
                            const m = term.match(/(\d+)/);
                            return m ? parseInt(m[1], 10) : 999;
                        };
                        // Filter out terms below the minimum if min_months is specified
                        const allowedTerms = minMonthsNum > 0
                            ? termsList.filter(t => termToMonths(t) >= minMonthsNum)
                            : termsList;
                        // If min_months filters out ALL terms, show a warning and use the full list as fallback
                        // rather than silently showing options that violate the property's requirements.
                        let finalTerms = allowedTerms;
                        if (allowedTerms.length === 0) {
                            finalTerms = termsList; // show all — operator data inconsistency
                            console.warn('[CP] All lease terms filtered by min_months=' + minMonthsNum + '. Showing full list as fallback. Check property data.');
                            // Add a visible hint to the lease term field
                            const _leaseHint = leaseSelect.closest('.form-group');
                            if (_leaseHint && !_leaseHint.querySelector('.lease-min-hint')) {
                                const _lh = document.createElement('div');
                                _lh.className = 'lease-min-hint field-hint';
                                _lh.style.color = '#e65100';
                                const _tLease = this.getTranslations();
                                const pre = document.createElement('span');
                                pre.setAttribute('data-i18n', 'minLeaseHintPre');
                                pre.textContent = _tLease.minLeaseHintPre || 'Minimum lease term:';
                                const post = document.createElement('span');
                                post.setAttribute('data-i18n', 'minLeaseHintPost');
                                post.textContent = _tLease.minLeaseHintPost || 'months. Please select a qualifying term.';
                                _lh.replaceChildren(this._icon('fas fa-info-circle'), document.createTextNode(' '), pre, document.createTextNode(' ' + minMonthsNum + ' '), post);
                                _leaseHint.appendChild(_lh);
                            }
                        }
                        // Remove all options except the placeholder
                        while (leaseSelect.options.length > 1) leaseSelect.remove(1);
                        finalTerms.forEach(term => {
                            const opt = document.createElement('option');
                            opt.value = term;
                            opt.textContent = term;
                            leaseSelect.appendChild(opt);
                        });
                        // Auto-select when only one term is available (no manual choice needed)
                        if (finalTerms.length === 1) {
                            leaseSelect.value = finalTerms[0];
                            leaseSelect.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }
                } else if (minMonths) {
                    // No explicit terms list but min_months is set — filter the default dropdown options
                    const minMonthsNum = parseInt(minMonths, 10);
                    const leaseSelect = document.getElementById('desiredLeaseTerm');
                    if (leaseSelect && minMonthsNum > 0) {
                        Array.from(leaseSelect.options).forEach(opt => {
                            if (!opt.value) return; // keep placeholder
                            const mtm = /month.to.month/i.test(opt.value);
                            if (mtm) { opt.style.display = 'none'; opt.disabled = true; return; }
                            const m = opt.value.match(/(\d+)/);
                            const optMonths = m ? parseInt(m[1], 10) : 999;
                            if (optMonths < minMonthsNum) { opt.style.display = 'none'; opt.disabled = true; }
                        });
                    }
                }
              // 9C-2: store source URL so success screen can link back to the original listing
              // SECURITY: only accept same-origin absolute URLs or root-relative paths.
              // Rejects javascript:, data:, vbscript:, protocol-relative (//evil.com), and cross-origin.
              const source = p.get('source') || '';
              if (source) {
                  let safeSource = '';
                  try {
                      const trimmed = String(source).trim();
                      if (trimmed && !trimmed.startsWith('//') && !/^[a-z]+:/i.test(trimmed.split('?')[0])) {
                          // Root-relative path like /listings.html or /property?id=...
                          if (trimmed.startsWith('/')) safeSource = trimmed;
                      } else if (trimmed) {
                          const u = new URL(trimmed, window.location.origin);
                          if ((u.protocol === 'http:' || u.protocol === 'https:') && u.origin === window.location.origin) {
                              safeSource = u.pathname + u.search + u.hash;
                          }
                      }
                  } catch (_) { /* invalid URL — drop it */ }
                  if (safeSource) this.state.sourceUrl = safeSource;
              }

              setHidden('hiddenPetsAllowed',     pets);
              setHidden('hiddenPetTypes',        petTypes);
              setHidden('hiddenPetWeightLimit',  petWeight);
              setHidden('hiddenPetDeposit',      petDeposit);
              setHidden('hiddenPetDetails',      petDetails);
              setHidden('hiddenSmokingAllowed',  smoking);
              // Pet and smoking questions are left flexible — applicants may answer Yes or No regardless of property policy.


              setHidden('hiddenUtilities',       utilities);
              setHidden('hiddenParking',         parking);
              setHidden('hiddenParkingFee',      parkingFee);
              setHidden('hiddenGarageSpaces',    garageSpaces);
              setHidden('hiddenEvCharging',      evCharging);
              setHidden('hiddenLaundryType',     laundryType);
              setHidden('hiddenHeatingType',     heatingType);
              setHidden('hiddenCoolingType',     coolingType);
              setHidden('hiddenLastMonthsRent',  lastMonthsRent);
              setHidden('hiddenAdminFee',        adminFee);
              setHidden('hiddenMoveInSpecial',   moveInSpecial);

            // Build a formatted address string for the property address field
            const streetParts = [addr, city, state].filter(Boolean);
            const formattedAddr = streetParts.length
                ? streetParts.join(', ')
                : name; // fallback: use property name if no address parts

            // Pre-fill the property address field (Step 1) — URL params always take priority
            const addrField = document.getElementById('propertyAddress');
            if (addrField && formattedAddr) {
                addrField.value = formattedAddr;
                addrField.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // Show the property context banner (with extended listing details)
            this._showPropertyBanner({ id, name, addr, city, state, rent, beds, baths, deposit, avail, terms, lastMonthsRent, adminFee, moveInSpecial, laundryType, heatingType, coolingType, garageSpaces, evCharging, parkingFee });

            // Pre-populate the pet policy hint so it is ready when the user selects "Yes" for pets
            this._applyPetPolicyHint();
            this._updateTotalFeeDisplay();
            if (this._updateIncomeRatio) this._updateIncomeRatio();

        } catch (err) {
            // Silent — never break the form over a missing URL param
            console.warn('_prefillFromURL error (non-fatal):', err);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // PROPERTY CONTEXT BANNER — shown between header and progress bar.
    // Lets applicants confirm they're applying for the right property.
    // ─────────────────────────────────────────────────────────────────────
    _showPropertyBanner({ id, name, addr, city, state, rent, beds, baths, deposit, avail, terms, lastMonthsRent, adminFee, moveInSpecial, laundryType, heatingType, coolingType, garageSpaces, evCharging, parkingFee }) {
        if (!name && !addr && !city) return;

        const displayName = name || 'Selected Property';
        const locationParts = [city, state].filter(Boolean).map(s => this._escHtml(s));
        const locationLine = locationParts.length ? locationParts.join(', ') : '';
        const rentLine = rent
            ? '$' + parseFloat(rent).toLocaleString('en-US') + '/mo'
            : '';

        const metaParts = [locationLine, rentLine].filter(Boolean);
        const metaLine = metaParts.join(' &nbsp;·&nbsp; ');

        // Build listing detail chips (beds / baths / deposit / available / lease terms)
        const chips = [];
        if (beds)    chips.push('<span class="pcb-chip"><i class="fas fa-bed"></i> ' + this._escHtml(beds) + ' Bed</span>');
        if (baths)   chips.push('<span class="pcb-chip"><i class="fas fa-bath"></i> ' + this._escHtml(baths) + ' Bath</span>');
        if (deposit) chips.push('<span class="pcb-chip"><i class="fas fa-dollar-sign"></i> $' + parseFloat(deposit).toLocaleString('en-US') + ' Deposit</span>');
        if (avail)   chips.push('<span class="pcb-chip"><i class="fas fa-calendar-check"></i> Avail ' + this._escHtml(avail) + '</span>');
        if (terms) {
            const termsList = terms.split('|').map(function(t) { return t.trim(); }).filter(Boolean);
            if (termsList.length) {
                const termsLabel = termsList.map(function(t) {
                    return t.replace(/(\d+)\s*months?/i, '$1-mo');
                }).join(', ');
                chips.push('<span class="pcb-chip"><i class="fas fa-file-contract"></i> ' + this._escHtml(termsLabel) + '</span>');
            }
        }
        if (lastMonthsRent) chips.push('<span class="pcb-chip"><i class="fas fa-calendar-alt"></i> $' + parseFloat(lastMonthsRent).toLocaleString('en-US') + ' Last Mo. Rent</span>');
        if (adminFee)       chips.push('<span class="pcb-chip"><i class="fas fa-receipt"></i> $' + parseFloat(adminFee).toLocaleString('en-US') + ' Admin Fee</span>');
        if (moveInSpecial)  chips.push('<span class="pcb-chip pcb-chip-promo"><i class="fas fa-tag"></i> ' + this._escHtml(moveInSpecial) + '</span>');
        if (laundryType)    chips.push('<span class="pcb-chip"><i class="fas fa-shirt"></i> ' + this._escHtml(laundryType) + '</span>');
        if (heatingType)    chips.push('<span class="pcb-chip"><i class="fas fa-fire"></i> ' + this._escHtml(heatingType) + '</span>');
        if (coolingType)    chips.push('<span class="pcb-chip"><i class="fas fa-snowflake"></i> ' + this._escHtml(coolingType) + '</span>');
        if (garageSpaces)   chips.push('<span class="pcb-chip"><i class="fas fa-car-side"></i> ' + this._escHtml(garageSpaces) + ' Space(s)</span>');
        if (evCharging && evCharging !== 'none') chips.push('<span class="pcb-chip"><i class="fas fa-charging-station"></i> EV: ' + this._escHtml(evCharging) + '</span>');
        if (parkingFee)     chips.push('<span class="pcb-chip"><i class="fas fa-dollar-sign"></i> $' + parseFloat(parkingFee).toLocaleString('en-US') + '/mo Parking</span>');
        const chipsHtml = chips.length ? '<div class="pcb-chips">' + chips.join('') + '</div>' : '';

        // Back-to-listing link — only shown when a property ID was passed
        const backLinkHtml = id
            ? '<a href="' + this._escHtml((window.CP_CONFIG && window.CP_CONFIG.LISTING_SITE_URL ? window.CP_CONFIG.LISTING_SITE_URL : 'https://choice-properties-site.pages.dev') + '/property.html?id=' + encodeURIComponent(id)) + '" class="pcb-back-link" target="_blank" rel="noopener">' +
                  '<i class="fas fa-arrow-left"></i> <span data-i18n="viewListing">View listing</span>' +
              '</a>'
            : '';

        const banner = document.createElement('div');
        banner.id = 'propertyContextBanner';
        banner.className = 'property-context-banner';
        banner.setAttribute('role', 'note');
        banner.setAttribute('aria-label', 'Property you are applying for');
        this._setTrustedHtml(banner, this._html`
            <div class="pcb-inner">
                <div class="pcb-left">
                    <div class="pcb-icon"><i class="fas fa-home"></i></div>
                    <div class="pcb-text">
                        <div class="pcb-label" data-i18n="applyingFor">Applying for</div>
                        <div class="pcb-name">${displayName}</div>
                        ${this._safeHtml(metaLine ? '<div class="pcb-meta">' + metaLine + '</div>' : '')}
                        ${this._safeHtml(chipsHtml)}
                    </div>
                </div>
                <div class="pcb-right">
                    <div class="pcb-managed">
                        <i class="fas fa-shield-alt"></i>
                        <span><span data-i18n="managedBy">Managed by</span> <strong>Choice Properties</strong></span>
                    </div>
                    ${this._safeHtml(backLinkHtml)}
                </div>
            </div>
        `);

        // Insert before the progress bar
        const progressContainer = document.querySelector('.progress-container');
        if (progressContainer && progressContainer.parentNode) {
            progressContainer.parentNode.insertBefore(banner, progressContainer);
        } else {
            const container = document.querySelector('.container');
            if (container) container.insertBefore(banner, container.firstChild);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // NO-CONTEXT PROMPT — shown when the form is opened without URL params.
    // Guides the applicant to manually enter the property address on Step 1.
    // ─────────────────────────────────────────────────────────────────────
    _showNoContextPrompt() {
        const banner = document.createElement('div');
        banner.id = 'noContextBanner';
        banner.className = 'no-context-banner';
        banner.setAttribute('role', 'note');
        banner.setAttribute('aria-label', 'Property address required');
        const tNc = this.getTranslations();
        const listingSiteUrl = (window.CP_CONFIG && window.CP_CONFIG.LISTING_SITE_URL ? window.CP_CONFIG.LISTING_SITE_URL : 'https://choice-properties-site.pages.dev') + '/listings.html';
        this._setTrustedHtml(banner, this._html`
            <div class="ncb-inner">
                <div class="ncb-icon"><i class="fas fa-map-marker-alt"></i></div>
                <div class="ncb-text">
                    <div class="ncb-title" data-i18n="noContextTitle">${tNc.noContextTitle}</div>
                    <div class="ncb-sub" data-i18n="noContextSub">${tNc.noContextSub}</div>
                    <a href="${listingSiteUrl}" class="ncb-browse-link" data-i18n="browseListings">
                        <i class="fas fa-search"></i>Browse Available Listings
                    </a>
                </div>
            </div>
        `);

        const progressContainer = document.querySelector('.progress-container');
        if (progressContainer && progressContainer.parentNode) {
            progressContainer.parentNode.insertBefore(banner, progressContainer);
        } else {
            const container = document.querySelector('.container');
            if (container) container.insertBefore(banner, container.firstChild);
        }

        // Softly highlight the property address field when it is visible
        const addrField = document.getElementById('propertyAddress');
        if (addrField) {
            addrField.style.borderColor = '#c9a04a';
            addrField.style.boxShadow   = '0 0 0 3px rgba(201,160,74,0.18)';
            addrField.addEventListener('input', function onInput() {
                addrField.style.borderColor = '';
                addrField.style.boxShadow   = '';
                addrField.removeEventListener('input', onInput);
            }, { once: true });
        }
    }

    // Simple HTML escaper used in the property banner
    _escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ─────────────────────────────────────────────────────────────────────
    // PET POLICY HINT — reads pet_types and pet_weight URL params and
    // shows an informational banner inside the pet details section so the
    // applicant knows exactly what this property allows before they type.
    // Called when the user selects "Yes" for pets, and also after prefill.
    // ─────────────────────────────────────────────────────────────────────
    _applyPetPolicyHint() {
        try {
            const p = new URLSearchParams(window.location.search);
            const petTypes  = p.get('pet_types')   || '';
            const petWeight = p.get('pet_weight')  || '';
            const hintBox   = document.getElementById('petPolicyHint');
            const hintText  = document.getElementById('petPolicyHintText');
            const petArea   = document.getElementById('petDetails');
            if (!hintBox || !hintText) return;

            const parts = [];
            if (petTypes)  parts.push({ label: 'Allowed pet types: ', value: petTypes });
            if (petWeight) parts.push({ label: 'Max weight: ', value: petWeight + ' lbs' });

            if (parts.length) {
                hintText.replaceChildren();
                parts.forEach((part, index) => {
                    if (index > 0) hintText.appendChild(document.createTextNode(' \u00a0·\u00a0 '));
                    hintText.appendChild(document.createTextNode(part.label));
                    const strong = document.createElement('strong');
                    strong.textContent = part.value;
                    hintText.appendChild(strong);
                });
                hintText.appendChild(document.createTextNode('. Please describe your pet(s) accordingly.'));
                hintBox.style.display = 'block';
                // Update textarea placeholder to be more specific
                if (petArea) {
                    const typesLabel = petTypes ? petTypes : 'type';
                    const weightLabel = petWeight ? ', under ' + petWeight + ' lbs' : '';
                    petArea.placeholder = 'e.g., Labrador mix' + weightLabel + ' — include type, breed, weight';
                }
            } else {
                hintBox.style.display = 'none';
            }
        } catch (e) { /* non-fatal */ }
    }

    // ─────────────────────────────────────────────────────────────────────
    // PET DETAILS VALIDATION — called from validateStep(2) when Has Pets=Yes.
    // Warns (not hard-blocks) if the pet weight limit param is set and the
    // user's description doesn't appear to include a numeric weight at all.
    // ─────────────────────────────────────────────────────────────────────
    _validatePetDetails() {
        const petField = document.getElementById('petDetails');
        const errEl    = document.getElementById('petDetailsError');
        if (!petField || !errEl) return true;
        const val = petField.value.trim();
        if (!val) {
            errEl.textContent = 'Please describe your pet(s) — type, breed, and weight.';
            errEl.style.display = 'block';
            petField.classList.add('is-invalid');
            return false;
        }
        // Check weight limit if param present
        const p = new URLSearchParams(window.location.search);
        const petWeight = p.get('pet_weight');
        if (petWeight) {
            const limit = parseFloat(petWeight);
            if (!isNaN(limit)) {
                // Look for any number in the description that could be a weight
                const nums = val.match(/\d+(\.\d+)?/g);
                if (nums) {
                    const maxInDesc = Math.max(...nums.map(Number));
                    if (maxInDesc > limit) {
                        errEl.textContent = 'This property has a ' + limit + ' lb pet weight limit. Please confirm your pet meets this requirement.';
                        errEl.style.display = 'block';
                        petField.classList.add('is-invalid');
                        return false;
                    }
                }
            }
        }
        errEl.style.display = 'none';
        petField.classList.remove('is-invalid');
        return true;
    }



    setupOfflineDetection() {
        window.addEventListener('online', () => {
            this.setState({ isOnline: true });
        });
        window.addEventListener('offline', () => {
            this.setState({ isOnline: false });
        });
        this.setState({ isOnline: navigator.onLine });
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.updateUIState();
    }

    updateUIState() {
        const offlineIndicator = document.getElementById('offlineIndicator');
        if (offlineIndicator) {
            offlineIndicator.style.display = this.state.isOnline ? 'none' : 'block';
        }
        const submitBtn = document.getElementById('mainSubmitBtn');
        if (submitBtn) {
            submitBtn.disabled = !this.state.isOnline;
            submitBtn.title = this.state.isOnline ? '' : 'You are offline';
        }
    }

    // ---------- Geoapify ----------
    setupGeoapify() {
        const apiKey = (window.CP_CONFIG && window.CP_CONFIG.GEOAPIFY_API_KEY) || '';
          if (!apiKey) {
              console.warn('[CP] GEOAPIFY_API_KEY not configured — address autocomplete disabled');
              return;
          }
        const fields = ['propertyAddress', 'currentAddress', 'previousAddress', 'employerAddress'];
        fields.forEach(id => {
            const input = document.getElementById(id);
            if (!input) return;
            // Wrap in a relative-positioned container for dropdown positioning
            // Use the existing form-group as the anchor if possible, else create a wrapper
            let container = input.closest('.form-group');
            if (!container) {
                container = document.createElement('div');
                container.style.position = 'relative';
                input.parentNode.insertBefore(container, input);
                container.appendChild(input);
            } else {
                // Ensure the form-group has relative positioning
                container.style.position = 'relative';
            }
            const dropdown = document.createElement('div');
            dropdown.className = 'autocomplete-dropdown';
            container.appendChild(dropdown);
            input.addEventListener('input', this.debounce(async (e) => {
                const text = e.target.value;
                if (text.length < 3) {
                    dropdown.style.display = 'none';
                    return;
                }
                try {
                    const response = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(text)}&apiKey=${apiKey}`);
                    const data = await response.json();
                    if (data.features && data.features.length > 0) {
                        dropdown.replaceChildren();
                        data.features.forEach(feature => {
                            const item = document.createElement('div');
                            item.textContent = feature.properties.formatted;
                            item.addEventListener('click', () => {
                                input.value = feature.properties.formatted;
                                dropdown.style.display = 'none';
                                this.saveProgress();
                            });
                            dropdown.appendChild(item);
                        });
                        dropdown.style.display = 'block';
                    } else {
                        dropdown.style.display = 'none';
                    }
                } catch (err) {
                    console.error('Geocoding error:', err);
                }
            }, 300));
            document.addEventListener('click', (e) => {
                if (!container.contains(e.target)) dropdown.style.display = 'none';
            });
        });
    }

    // ---------- Input formatting (phone w/ cursor-preservation, SSN mode) ----------
    setupInputFormatting() {
        const formatUsPhoneWithCursor = (el) => {
            const raw = el.value;
            const selStart = typeof el.selectionStart === 'number' ? el.selectionStart : raw.length;
            const digitsBeforeCursor = raw.slice(0, selStart).replace(/\D/g, '').length;
            const digits = raw.replace(/\D/g, '').slice(0, 10);
            const m = digits.match(/(\d{0,3})(\d{0,3})(\d{0,4})/);
            const formatted = !m[2] ? m[1] : '(' + m[1] + ') ' + m[2] + (m[3] ? '-' + m[3] : '');
            if (raw !== formatted) {
                el.value = formatted;
                if (document.activeElement === el && typeof el.setSelectionRange === 'function') {
                    let pos = 0;
                    let seen = 0;
                    while (pos < formatted.length && seen < digitsBeforeCursor) {
                        if (/\d/.test(formatted[pos])) seen++;
                        pos++;
                    }
                    el.setSelectionRange(pos, pos);
                }
            }
        };

        const formatPhoneEl = (el) => {
            if (!el || el.dataset.phoneBound) return;
            el.dataset.phoneBound = '1';
            el.addEventListener('input', () => {
                formatUsPhoneWithCursor(el);
            });
        };
        this._formatPhoneEl = formatPhoneEl;
        ['phone', 'secondaryPhone', 'landlordPhone', 'previousLandlordPhone', 'supervisorPhone', 'ref1Phone', 'ref2Phone', 'emergencyPhone'].forEach(id => {
            formatPhoneEl(document.getElementById(id));
        });

        const ssnEl = document.getElementById('ssn');
        if (ssnEl) {
            ssnEl.addEventListener('input', (e) => {
                const mode = this._getPrimarySsnMode();
                e.target.value = String(e.target.value || '').replace(/\D/g, '').slice(0, 4);
                if (this._validateSsnByMode(e.target.value, mode).ok) {
                    this.clearError(ssnEl);
                    ssnEl.classList.add('is-valid');
                    ssnEl.classList.remove('is-invalid');
                }
            });
            ssnEl.addEventListener('blur', () => this.validateField(ssnEl));
        }
    }

    // ---------- Shared Canonical Role, Financial & Fee Rules (mirrors _shared/application-rules.ts) ----------
    _normalizeApplicantType(raw, isPrimary = false) {
        if (isPrimary) return 'primary';
        const val = String(raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
        if (val === 'primary' || val === 'primary_applicant') return 'primary';
        if (val.includes('guarantor')) return 'guarantor';
        if (val.includes('co_signer') || val.includes('cosigner') || val === 'signer') return 'co_signer';
        return 'co_applicant';
    }

    _normalizeSubmissionMethod(raw) {
        const val = String(raw || '').trim().toLowerCase();
        if (val === 'invited' || val === 'invite' || val === 'method_b' || val === 'private_link' || val === 'self_complete') {
            return 'invited';
        }
        return 'primary_completed';
    }

    _isOccupyingRole(applicantType) {
        return applicantType === 'primary' || applicantType === 'co_applicant';
    }

    _getRoleDisplayLabel(applicantType, lang) {
        const l = lang || this.state.language || 'en';
        if (l === 'es') {
            if (applicantType === 'primary') return 'Solicitante Principal';
            if (applicantType === 'guarantor') return 'Garante (No Ocupante)';
            if (applicantType === 'co_signer') return 'Co-Firmante (Apoyo Financiero)';
            return 'Co-Solicitante (Adulto Ocupante)';
        }
        if (applicantType === 'primary') return 'Primary Applicant';
        if (applicantType === 'guarantor') return 'Guarantor (Non-Occupying)';
        if (applicantType === 'co_signer') return 'Co-Signer (Financial Support)';
        return 'Co-Applicant (Occupying Adult)';
    }

    _getShortRoleLabel(applicantType, lang) {
        const l = lang || this.state.language || 'en';
        if (l === 'es') {
            if (applicantType === 'primary') return 'Principal';
            if (applicantType === 'guarantor') return 'Garante';
            if (applicantType === 'co_signer') return 'Co-Firmante';
            return 'Co-Solicitante';
        }
        if (applicantType === 'primary') return 'Primary';
        if (applicantType === 'guarantor') return 'Guarantor';
        if (applicantType === 'co_signer') return 'Co-Signer';
        return 'Co-Applicant';
    }

    _getJurisdictionFeeNote(stateCode, lang) {
        const code = String(stateCode || '').trim().toUpperCase().slice(0, 2);
        const l = lang || this.state.language || 'en';
        const enNotes = {
            NY: 'New York notice: Statutory tenant screening fee cap ($20 per applicant under NY Real Property Law § 238-a) may apply based on property location; coordinator verifies final compliant amount prior to collection.',
            VT: 'Vermont notice: Vermont prohibits charging tenants application screening fees (9 V.S.A. § 4456a); coordinator waives or adjusts fee prior to screening.',
            MA: 'Massachusetts notice: Direct landlord-collected application fees are restricted under M.G.L. c. 186 § 15B unless collected by a licensed broker; coordinator confirms eligibility before billing.',
            CA: 'California notice: Screening fees are capped at actual out-of-pocket screening/processing costs up to the statutory CPI-adjusted maximum (Cal. Civ. Code § 1950.6), with itemized receipt provided upon confirmation.',
            WA: 'Washington notice: Tenant screening disclosures include consumer reporting agency details and itemized receipt prior to billing (RCW 59.18.257).',
            MN: 'Minnesota notice: Screening fees cover actual verification costs and are refundable if screening is not run (Minn. Stat. § 504B.173).',
            CO: 'Colorado notice: Portable screening report rights apply under C.R.S. § 38-12-904; fees are only billed if no qualifying portable report is provided.',
            OR: 'Oregon notice: Screening charges cover actual third-party report/processing costs with itemized receipt protections (ORS 90.295).',
            IL: 'Illinois notice: Cook County / Chicago Just Housing & reusable screening rules may adjust fee collection prior to screening.',
            MD: 'Maryland notice: Screening fee portions exceeding $25 actual verification costs are subject to statutory return requirements (Md. Code, Real Prop. § 8-213).',
        };
        const esNotes = {
            NY: 'Aviso de Nueva York: El límite legal ($20 por solicitante bajo NY Real Property Law § 238-a) puede aplicar según la ubicación; el coordinador verificará el monto final antes del cobro.',
            VT: 'Aviso de Vermont: La ley estatal prohíbe tarifas de evaluación al inquilino (9 V.S.A. § 4456a); el coordinador ajustará o exonerará la tarifa antes de evaluar.',
            MA: 'Aviso de Massachusetts: Las tarifas cobradas directamente por propietarios están restringidas bajo M.G.L. c. 186 § 15B; el coordinador confirmará la elegibilidad antes de cobrar.',
            CA: 'Aviso de California: Las tarifas están limitadas al costo real de verificación hasta el máximo legal (Cal. Civ. Code § 1950.6) con recibo detallado.',
            WA: 'Aviso de Washington: Incluye divulgación de agencia de crédito y recibo detallado antes del cobro (RCW 59.18.257).',
            MN: 'Aviso de Minnesota: Cubren costos reales y son reembolsables si no se realiza la evaluación (Minn. Stat. § 504B.173).',
            CO: 'Aviso de Colorado: Aplican derechos de informe portátil bajo C.R.S. § 38-12-904.',
            OR: 'Aviso de Oregon: Sujeto a protecciones de recibo detallado de costos reales (ORS 90.295).',
            IL: 'Aviso de Illinois: Reglas locales como Just Housing del Condado de Cook pueden ajustar el cobro.',
            MD: 'Aviso de Maryland: Montos que excedan $25 en costos reales están sujetos a devolución legal (Md. Code, Real Prop. § 8-213).',
        };
        return (l === 'es' ? esNotes[code] : enNotes[code]) || null;
    }

    _parseMoney(val) {
        if (typeof val === 'number') return Number.isFinite(val) && val > 0 ? val : 0;
        const cleaned = String(val ?? '').replace(/[^0-9.]/g, '');
        if (!cleaned) return 0;
        const num = parseFloat(cleaned);
        return Number.isFinite(num) && num > 0 ? num : 0;
    }

    _syncPaymentMethodUi(clearHiddenOther = false) {
        const groups = [
            { selectId: 'primaryPaymentMethod', groupId: 'primaryPaymentOtherGroup', inputId: 'primaryPaymentOther' },
            { selectId: 'alternativePaymentMethod', groupId: 'alternativePaymentOtherGroup', inputId: 'alternativePaymentOther' },
            { selectId: 'thirdChoicePaymentMethod', groupId: 'thirdChoicePaymentOtherGroup', inputId: 'thirdChoicePaymentOther' },
        ];
        const chosen = [];
        groups.forEach(({ selectId, groupId, inputId }) => {
            const selEl = document.getElementById(selectId);
            const grpEl = document.getElementById(groupId);
            const inpEl = document.getElementById(inputId);
            const val = selEl ? selEl.value.trim() : '';
            if (val && val !== 'Other') chosen.push(val);
            if (grpEl && inpEl) {
                const isOther = val === 'Other';
                grpEl.style.display = isOther ? 'block' : 'none';
                inpEl.required = isOther;
                if (!isOther) {
                    inpEl.classList.remove('is-invalid');
                    const errEl = grpEl.querySelector('.error-message');
                    if (errEl) errEl.style.display = 'none';
                    if (clearHiddenOther) inpEl.value = '';
                }
            }
        });
        const dupWarn = document.getElementById('paymentDuplicateWarning');
        if (dupWarn) {
            const hasDup = new Set(chosen).size < chosen.length;
            dupWarn.style.display = hasDup ? 'flex' : 'none';
        }
    }

    _calculateHouseholdFee(coListOverride) {
        const lang = this.state.language || 'en';
        const perPersonFee = this.state.applicationFee > 0 ? this.state.applicationFee : 50;
        const creditApplied = !!(document.getElementById('applyCreditCheckbox')?.checked && this.state.availableCredit?.has_credit);
        const coList = Array.isArray(coListOverride)
            ? coListOverride
            : (this._collectCoApplicants ? this._collectCoApplicants() : []);

        const pFirst = document.getElementById('firstName')?.value?.trim() || '';
        const pLast = document.getElementById('lastName')?.value?.trim() || '';
        const primaryName = [pFirst, pLast].filter(Boolean).join(' ') || this._getShortRoleLabel('primary', lang);

        const stateCode = document.getElementById('hiddenPropertyState')?.value?.trim()
            || this.state.propertyContext?.state
            || '';

        const items = [{
            applicant_index: 0,
            name: primaryName,
            applicant_type: 'primary',
            role_label: this._getRoleDisplayLabel('primary', lang),
            submission_method: 'primary_completed',
            is_occupant: true,
            standard_fee: perPersonFee,
            fee: creditApplied ? 0 : perPersonFee,
            included_free: false,
            note: creditApplied
                ? (lang === 'es' ? 'Solicitante principal (Cubierto por crédito)' : 'Primary applicant (Waived via credit)')
                : (lang === 'es' ? 'Tarifa de evaluación del solicitante principal' : 'Primary applicant screening fee'),
        }];

        let coApplicantCount = 0;
        let guarantorCount = 0;
        let coSignerCount = 0;
        let occupyingAdultCount = 1;
        let standardFee = perPersonFee;

        coList.forEach((ca, idx) => {
            const type = this._normalizeApplicantType(ca.applicant_type || ca.role, false);
            const method = this._normalizeSubmissionMethod(ca.submission_method);
            const name = [ca.first_name, ca.last_name].filter(Boolean).join(' ') || this._getShortRoleLabel(type, lang);
            let itemStd = perPersonFee;
            let includedFree = false;
            let note = '';

            if (type === 'co_applicant') {
                coApplicantCount += 1;
                occupyingAdultCount += 1;
                note = lang === 'es'
                    ? 'Evaluación de co-solicitante ocupante ($50)'
                    : 'Occupying co-applicant screening ($50)';
            } else if (type === 'guarantor') {
                guarantorCount += 1;
                note = lang === 'es' ? 'Evaluación financiera de garante' : 'Guarantor financial screening';
            } else {
                coSignerCount += 1;
                note = lang === 'es' ? 'Evaluación financiera de co-firmante' : 'Co-signer financial screening';
            }

            standardFee += itemStd;
            const fee = creditApplied ? 0 : itemStd;
            if (creditApplied && itemStd > 0) {
                note = lang === 'es' ? `${note} (Cubierto por crédito)` : `${note} (Waived via credit)`;
            }

            items.push({
                applicant_index: idx + 1,
                name,
                applicant_type: type,
                role_label: this._getRoleDisplayLabel(type, lang),
                submission_method: method,
                is_occupant: this._isOccupyingRole(type),
                standard_fee: itemStd,
                fee,
                included_free: includedFree,
                note,
            });
        });

        const totalFee = creditApplied ? 0 : standardFee;
        const paidScreeningCount = items.filter(i => i.fee > 0).length;

        return {
            perPersonFee,
            standardFee,
            totalFee,
            initialAmountDue: totalFee,
            primaryShareFee: totalFee,
            householdPaymentMode: 'centralized',
            creditApplied,
            paidScreeningCount,
            occupyingAdultCount,
            coApplicantCount,
            guarantorCount,
            coSignerCount,
            additionalCount: coList.length,
            screenedAdultCount: 1 + coList.length,
            feeBreakdown: items,
            jurisdictionFeeNote: this._getJurisdictionFeeNote(stateCode, lang),
        };
    }

    _calculateHouseholdFinancials(coListOverride) {
        const p = new URLSearchParams(window.location.search);
        const rent = this._parseMoney(p.get('rent') || document.getElementById('hiddenListedRent')?.value || '0');
        const primaryIncome = this._parseMoney(document.getElementById('monthlyIncome')?.value)
            + this._parseMoney(document.getElementById('otherIncome')?.value);

        const coList = Array.isArray(coListOverride)
            ? coListOverride
            : (this._collectCoApplicants ? this._collectCoApplicants() : []);

        let coApplicantIncome = 0;
        let guarantorIncome = 0;
        let coSignerIncome = 0;
        let occupyingAdultCount = 1;
        let coApplicantCount = 0;
        let guarantorCount = 0;
        let coSignerCount = 0;
        let pendingInvitedIncomeCount = 0;

        coList.forEach(ca => {
            const type = this._normalizeApplicantType(ca.applicant_type || ca.role, false);
            const method = this._normalizeSubmissionMethod(ca.submission_method);
            const amt = method === 'invited'
                ? 0
                : (this._parseMoney(ca.monthly_income) + this._parseMoney(ca.other_income));
            if (method === 'invited') pendingInvitedIncomeCount += 1;

            if (type === 'co_applicant') {
                occupyingAdultCount += 1;
                coApplicantCount += 1;
                coApplicantIncome += amt;
            } else if (type === 'guarantor') {
                guarantorCount += 1;
                guarantorIncome += amt;
            } else {
                coSignerCount += 1;
                coSignerIncome += amt;
            }
        });

        const householdMonthlyIncome = primaryIncome + coApplicantIncome;
        const totalFinancialSupport = householdMonthlyIncome + guarantorIncome + coSignerIncome;

        return {
            primaryMonthlyIncome: primaryIncome,
            coApplicantMonthlyIncome: coApplicantIncome,
            householdMonthlyIncome,
            guarantorMonthlyIncome: guarantorIncome,
            coSignerMonthlyIncome: coSignerIncome,
            totalFinancialSupport,
            occupyingAdultCount,
            coApplicantCount,
            guarantorCount,
            coSignerCount,
            pendingInvitedIncomeCount,
            listedRent: rent > 0 ? rent : null,
        };
    }

    // ---------- Income-to-Rent Ratio Display (Removed per user request) ----------
    setupIncomeRatioDisplay() {
        // Removed
    }

    // ---------- Real-time validation ----------
    setupRealTimeValidation() {
        const form = document.getElementById('rentalApplication');
        if (!form) return;
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            const refresh = () => {
                // Only validate if the field has been touched (has a value or is losing focus)
                if (input.value.trim() || input.checked) this.validateField(input);
                const activeSection = this.getCurrentSection();
                this.updateFieldsRemainingHint(activeSection);
            };
            input.addEventListener('input', refresh);
            input.addEventListener('change', refresh);
            input.addEventListener('blur', () => {
                this.validateField(input);
                const activeSection = this.getCurrentSection();
                this.updateFieldsRemainingHint(activeSection);
            });
        });
    }

    // ---------- Validation logic ----------
    validateField(field) {
        let isValid = true;
        let errorMessage = 'Required';
        if (field.id === 'ssn' || field.classList.contains('co-ssn-input')) {
            const card = field.closest('.co-applicant-card');
            const mode = card
                ? (card.querySelector('.co-ssn-mode-select')?.value || 'last4')
                : this._getPrimarySsnMode();
            const check = this._validateSsnByMode(field.value, mode);
            if (!check.ok) {
                isValid = false;
                errorMessage = check.error;
            }
        } else if (field.id === 'dob' || field.classList.contains('co-dob-input')) {
            const birthDate = this._parseLocalDate(field.value);
            const now = new Date();
            const todayY = now.getFullYear();
            const todayM = now.getMonth() + 1;
            const todayD = now.getDate();
            if (!field.value) {
                isValid = false;
                errorMessage = this.state.language === 'en' ? 'Please enter date of birth.' : 'Por favor ingrese fecha de nacimiento.';
            } else if (!birthDate) {
                isValid = false;
                errorMessage = this.state.language === 'en' ? 'Please enter a valid date of birth (18+ required).' : 'Por favor ingrese una fecha válida (18+ requerido).';
            } else {
                const bY = birthDate.getFullYear();
                const bM = birthDate.getMonth() + 1;
                const bD = birthDate.getDate();
                let age = todayY - bY;
                if (todayM < bM || (todayM === bM && todayD < bD)) age--;
                if (age < 18) {
                    isValid = false;
                    errorMessage = this.state.language === 'en' ? 'Applicants must be at least 18 years old.' : 'Los solicitantes deben tener al menos 18 años.';
                }
            }
        } else if (field.id === 'requestedMoveIn') {
            const moveInDate = this._parseLocalDate(field.value);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (!field.value) {
                isValid = false;
                errorMessage = this.state.language === 'en' ? 'Please select a move-in date.' : 'Por favor seleccione una fecha de mudanza.';
            } else if (!moveInDate || moveInDate < today) {
                isValid = false;
                errorMessage = this.state.language === 'en' ? 'Move-in date cannot be in the past.' : 'La fecha de mudanza no puede ser en el pasado.';
            } else {
                // Also validate against property availability date if set
                const availInput = document.getElementById('hiddenAvailableDate');
                const availVal = availInput ? availInput.value : '';
                if (availVal) {
                    const availDate = this._parseLocalDate(availVal);
                    if (availDate && moveInDate < availDate) {
                        isValid = false;
                        errorMessage = this.state.language === 'en'
                            ? `This property is not available until ${availVal}. Please select a date on or after that date.`
                            : `Esta propiedad no estará disponible hasta ${availVal}. Por favor seleccione una fecha en o después de esa fecha.`;
                    }
                }
            }
        } else if (field.hasAttribute('required')) {
            if (field.type === 'checkbox') {
                isValid = field.checked;
            } else if (!field.value.trim()) {
                isValid = false;
            }
            if (!isValid) {
                errorMessage = this.state.language === 'en' ? 'Required' : 'Campo obligatorio';
            }
        }
        if (isValid && field.value.trim()) {
            // Numeric validation for income fields
            if (field.id === 'monthlyIncome' || field.id === 'otherIncome' || field.id === 'coMonthlyIncome') {
                const numVal = field.value.replace(/[$,\s]/g, '');
                if (numVal !== '' && (isNaN(parseFloat(numVal)) || parseFloat(numVal) < 0)) {
                    isValid = false;
                    errorMessage = this.state.language === 'en'
                        ? 'Please enter a valid dollar amount (numbers only).'
                        : 'Por favor ingrese un monto válido (solo números).';
                }
            }
            if (field.type === 'email') {
                const email = field.value.trim();
                if (!email.includes('@')) {
                    isValid = false;
                    errorMessage = this.state.language === 'en' ? 'Email must include an @ symbol.' : 'El correo debe incluir un símbolo @.';
                } else {
                    const parts = email.split('@');
                    if (!parts[1] || !parts[1].includes('.')) {
                        isValid = false;
                        errorMessage = this.state.language === 'en' ? 'Add a valid domain (e.g., gmail.com).' : 'Agregue un dominio válido (ej. gmail.com).';
                    } else {
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        isValid = emailRegex.test(email);
                        if (!isValid) {
                            errorMessage = this.state.language === 'en' ? 'Enter a valid email (example: name@email.com).' : 'Ingrese un correo válido (ejemplo: nombre@email.com).';
                        }
                    }
                }
            } else if (field.type === 'tel') {
                const phoneDigits = field.value.replace(/\D/g, '');
                isValid = phoneDigits.length >= 10;
                if (!isValid) {
                    errorMessage = this.state.language === 'es' ? 'Teléfono inválido' : 'Invalid phone';
                }
            }
        }
        if (isValid) {
            this.clearError(field);
            field.classList.add('is-valid');
            field.classList.remove('is-invalid');
        } else {
            this.showError(field, errorMessage);
            field.classList.add('is-invalid');
            field.classList.remove('is-valid');
            field.classList.add('shake');
            setTimeout(() => field.classList.remove('shake'), 400);
        }
        return isValid;
    }

    showError(field, message) {
        field.classList.add('error');
        const errorMsg = field.closest('.form-group')?.querySelector('.error-message');
        if (errorMsg) {
            errorMsg.textContent = message;
            errorMsg.style.display = 'block';
        }
    }

    clearError(field) {
        field.classList.remove('error');
        const errorMsg = field.closest('.form-group')?.querySelector('.error-message');
        if (errorMsg) {
            errorMsg.style.display = 'none';
        }
    }

    // ---------- Section navigation ----------
    getCurrentSection() {
        const activeSection = document.querySelector('.form-section.active');
        return activeSection ? parseInt(activeSection.id.replace('section', '')) : 1;
    }

    nextSection(currentSection) {
        if (!this.validateStep(currentSection)) return;
        if (currentSection === 4) {
            this._syncCoApplicantsJson();
            this._updateOccupantsCountSync();
        }
        this.hideSection(currentSection);
        this._slideDir = 'forward';
        const next = currentSection + 1;
        this.showSection(next);
        this.updateProgressBar();
        if (next === 3 && this._updateIncomeRatio) this._updateIncomeRatio();
        if (next === 4) {
            this._updateTotalFeeDisplay();
            if (this._updateIncomeRatio) this._updateIncomeRatio();
        }
        if (next === 6) {
            this._syncCoApplicantsJson();
            if (typeof this._rerenderUploadedFiles === 'function') this._rerenderUploadedFiles();
            this._updateTotalFeeDisplay();
            this._checkApplicationCredit();
            this.generateApplicationSummary();
        }
    }

    previousSection(currentSection) {
        if (currentSection > 1) {
            this.hideSection(currentSection);
            this._slideDir = 'back';
            this.showSection(currentSection - 1);
            this.updateProgressBar();
        }
    }

    hideSection(sectionNumber) {
        const section = document.getElementById(`section${sectionNumber}`);
        if (section) section.classList.remove('active', 'slide-back');
    }

    showSection(sectionNumber) {
        const section = document.getElementById(`section${sectionNumber}`);
        if (section) {
            section.classList.remove('slide-back');
            if (this._slideDir === 'back') section.classList.add('slide-back');
            this._slideDir = null;
            section.classList.add('active');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            this.updateFieldsRemainingHint(sectionNumber);
            this._updateStartOverBtn(sectionNumber);
        }
    }

    // ---------- Start Over ----------
    _updateStartOverBtn(sectionNumber) {
        const btn = document.getElementById('startOverBtn');
        if (!btn) return;
        btn.classList.toggle('visible', sectionNumber > 1);
    }

    _openClearSheet() {
        document.getElementById('clearFormOverlay').classList.add('open');
        document.getElementById('clearFormSheet').classList.add('open');
    }

    _closeClearSheet() {
        document.getElementById('clearFormOverlay').classList.remove('open');
        document.getElementById('clearFormSheet').classList.remove('open');
    }

    _clearForm() {
        try { localStorage.removeItem(this.config.LOCAL_STORAGE_KEY); } catch(e) {}
        location.reload();
    }

    // ---------- Fields-remaining hint on Next button ----------
    updateFieldsRemainingHint(sectionNumber) {
        const section = document.getElementById(`section${sectionNumber}`);
        if (!section) return;
        const nextBtn = section.querySelector('.btn-next');
        if (!nextBtn) return;

        let hint = nextBtn.parentElement.querySelector('.btn-hint');
        if (!hint) {
            hint = document.createElement('span');
            hint.className = 'btn-hint';
            nextBtn.parentElement.appendChild(hint);
        }

        const inputs = section.querySelectorAll('input[required], select[required], textarea[required]');
        let emptyCount = 0;
        inputs.forEach(input => {
            if (input.type !== 'hidden' && !input.offsetParent) return;
            if (input.type === 'checkbox') {
                if (!input.checked) emptyCount++;
            } else if (!input.value.trim()) {
                emptyCount++;
            }
        });

        if (emptyCount > 0) {
            hint.textContent = emptyCount === 1
                ? '1 required field still needs to be filled'
                : `${emptyCount} required fields still need to be filled`;
            hint.classList.add('has-remaining');
        } else {
            hint.textContent = '';
            hint.classList.remove('has-remaining');
        }
    }

    updateProgressBar() {
        const currentSection = this.getCurrentSection();
        const progress = ((currentSection - 1) / 5) * 100;
        const progressFill = document.getElementById('progressFill');
        if (progressFill) progressFill.style.width = `${progress}%`;
        const progressContainer = document.querySelector('.progress-container');
        const t = this.getTranslations();
        const stepNames = [t.step1Label, t.step2Label, t.step3Label, t.step4Label, t.step5Label, t.step6Label];
        const progressText = `${t.stepPrefix} ${currentSection} ${t.stepOf} 6: ${stepNames[currentSection-1]}`;
        if (progressContainer) progressContainer.setAttribute('data-progress-text', progressText);
        for (let i = 1; i <= 6; i++) {
            const step = document.getElementById(`step${i}`);
            if (step) {
                step.classList.remove('active', 'completed', 'clickable-step');
                step.removeAttribute('role');
                step.removeAttribute('tabindex');
                if (i < currentSection) {
                    step.classList.add('completed', 'clickable-step');
                    step.setAttribute('role', 'button');
                    step.setAttribute('tabindex', '0');
                }
                if (i === currentSection) step.classList.add('active');
            }
        }
    }

    // ---------- Step validation ----------
    validateStep(stepNumber) {
        const section = document.getElementById(`section${stepNumber}`);
        if (!section) return true;
        if (stepNumber === 2 && this._syncPriorResidenceVisibility) this._syncPriorResidenceVisibility();
        if (stepNumber === 5) {
            this._syncPrimarySsnModeUi();
            if (this._syncDisclosureExplanations) this._syncDisclosureExplanations();
            if (this._syncPaymentMethodUi) this._syncPaymentMethodUi(false);
        }
        const inputs = section.querySelectorAll('input, select, textarea');
        let isStepValid = true;
        let firstInvalidField = null;
        inputs.forEach(input => {
            // Skip inputs inside hidden containers
            if (input.type !== 'hidden' && !input.offsetParent) return;
            if (input.hasAttribute('required')) {
                if (!this.validateField(input)) {
                    isStepValid = false;
                    if (!firstInvalidField) firstInvalidField = input;
                }
            } else if (input.value && input.value.trim() && (input.type === 'tel' || input.type === 'email')) {
                if (!this.validateField(input)) {
                    isStepValid = false;
                    if (!firstInvalidField) firstInvalidField = input;
                }
            }
        });
        if (stepNumber === 1) {
            // Block progression if no property ID — visitor opened /apply/ directly
            const hiddenPropId = document.getElementById('hiddenPropertyId');
            if (!hiddenPropId || !hiddenPropId.value.trim()) {
                const existingErr = document.getElementById('noPropIdError');
                if (!existingErr) {
                    const errBanner = document.createElement('div');
                    errBanner.id = 'noPropIdError';
                    errBanner.className = 'no-context-banner';
                    errBanner.setAttribute('role', 'alert');
                    const listingUrl = (window.CP_CONFIG && window.CP_CONFIG.LISTING_SITE_URL
                        ? window.CP_CONFIG.LISTING_SITE_URL
                        : 'https://choice-properties-site.pages.dev') + '/listings.html';
                    this._setTrustedHtml(errBanner, this._html`<div class="ncb-inner" style="border:2px solid #e65100">
                        <div class="ncb-icon"><i class="fas fa-exclamation-triangle" style="color:#e65100"></i></div>
                        <div class="ncb-text">
                        <div class="ncb-title" style="color:#e65100">No property selected</div>
                        <div class="ncb-sub">Please choose a property from our listings before applying. Applications must be linked to an available property.</div>
                        <a href="${listingUrl}" class="ncb-browse-link"><i class="fas fa-search"></i> Browse Available Listings</a>
                        </div></div>`);
                    const progressContainer = document.querySelector('.progress-container');
                    if (progressContainer && progressContainer.parentNode) {
                        progressContainer.parentNode.insertBefore(errBanner, progressContainer);
                    }
                    errBanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                isStepValid = false;
            }
        }
        if (stepNumber === 4) {
            const hasCoApplicant = document.getElementById('hasCoApplicant');
            const coSection = document.getElementById('coApplicantSection');
            if (hasCoApplicant && hasCoApplicant.checked && coSection && coSection.style.display !== 'none') {
                const cards = coSection.querySelectorAll('.co-applicant-card');
                const primaryEmailVal = (document.getElementById('email')?.value || '').trim().toLowerCase();
                const seenEmails = new Set(primaryEmailVal ? [primaryEmailVal] : []);

                cards.forEach((card) => {
                    this._syncCardFieldVisibility(card);
                    const reqEls = card.querySelectorAll('input[required], select[required], textarea[required]');
                    reqEls.forEach((el) => {
                        if (el.type !== 'hidden' && !el.offsetParent) return;
                        if (!this.validateField(el)) {
                            isStepValid = false;
                            if (!firstInvalidField) firstInvalidField = el;
                        }
                    });

                    const emailEl = card.querySelector('.co-email-input');
                    if (emailEl && emailEl.value.trim()) {
                        const em = emailEl.value.trim().toLowerCase();
                        if (seenEmails.has(em)) {
                            const dupMsg = this.state.language === 'es'
                                ? 'Cada solicitante debe tener un correo electrónico único.'
                                : 'Each applicant must have a unique email address.';
                            this.showError(emailEl, dupMsg);
                            emailEl.classList.add('is-invalid');
                            isStepValid = false;
                            if (!firstInvalidField) firstInvalidField = emailEl;
                        } else {
                            seenEmails.add(em);
                        }
                    }

                    const consentEl = card.querySelector('.co-consent-input');
                    if (consentEl && !consentEl.checked) {
                        const cardMethod = this._normalizeSubmissionMethod(card.querySelector('.co-method-radio:checked')?.value);
                        const consentErr = cardMethod === 'invited'
                            ? (this.state.language === 'en' ? 'You must confirm adding this individual to send their private link.' : 'Debe confirmar la inclusión de esta persona para enviar su enlace privado.')
                            : (this.state.language === 'en' ? 'You must authorize screening on behalf of this individual.' : 'Debe autorizar la evaluación en nombre de esta persona.');
                        this.showError(consentEl, consentErr);
                        consentEl.classList.add('is-invalid');
                        isStepValid = false;
                        if (!firstInvalidField) firstInvalidField = consentEl;
                    }
                });
                this._syncCoApplicantsJson();
            }
        }
        if (stepNumber === 5) {
            // Validate "Preferred Contact Method" — at least one checkbox required
            const _contactChecked = section.querySelectorAll('input[name="Preferred Contact Method"]:checked');
            const _contactErrEl   = document.getElementById('contactMethodError');
            if (_contactChecked.length === 0) {
                const _firstContact = section.querySelector('input[name="Preferred Contact Method"]');
                const _contactMsg   = this.state.language === 'en'
                    ? 'Please select at least one contact method'
                    : 'Por favor seleccione al menos un método de contacto';
                if (_contactErrEl) { _contactErrEl.textContent = _contactMsg; _contactErrEl.style.display = 'block'; }
                if (_firstContact) { _firstContact.classList.add('is-invalid'); }
                isStepValid = false;
                if (!firstInvalidField) firstInvalidField = _firstContact || _contactErrEl;
            } else {
                if (_contactErrEl) _contactErrEl.style.display = 'none';
                section.querySelectorAll('input[name="Preferred Contact Method"]').forEach(cb => cb.classList.remove('is-invalid'));
            }

            // Validate "Preferred Time" — at least one checkbox required
            const _timeChecked = section.querySelectorAll('input[name="Preferred Time"]:checked');
            const _timeErrEl   = document.getElementById('preferredTimeError');
            if (_timeChecked.length === 0) {
                const _firstTime = section.querySelector('input[name="Preferred Time"]');
                const _timeMsg   = this.state.language === 'en'
                    ? 'Please select at least one availability window'
                    : 'Por favor seleccione al menos una ventana de disponibilidad';
                if (_timeErrEl) { _timeErrEl.textContent = _timeMsg; _timeErrEl.style.display = 'block'; }
                if (_firstTime) { _firstTime.classList.add('is-invalid'); }
                isStepValid = false;
                if (!firstInvalidField) firstInvalidField = _firstTime || _timeErrEl;
            } else {
                if (_timeErrEl) _timeErrEl.style.display = 'none';
                section.querySelectorAll('input[name="Preferred Time"]').forEach(cb => cb.classList.remove('is-invalid'));
            }
        }
        // Step 2: validate pet details when user has pets
        if (stepNumber === 2) {
            const petsYes = document.getElementById('petsYes');
            if (petsYes && petsYes.checked) {
                if (!this._validatePetDetails()) {
                    isStepValid = false;
                    const petField = document.getElementById('petDetails');
                    if (!firstInvalidField) firstInvalidField = petField;
                }
            }
        }
        if (!isStepValid && firstInvalidField) this.scrollToInvalidField(firstInvalidField);
        return isStepValid;
    }

    scrollToInvalidField(field) {
        const scrollTarget = field.closest('.form-group') || field;
        scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
        field.classList.add('shake', 'highlight-field');
        setTimeout(() => field.focus(), 100);
        setTimeout(() => field.classList.remove('shake', 'highlight-field'), 2000);
    }

    // ---------- Conditional fields ----------
    setupConditionalFields() {
        const petsRadio = document.getElementsByName('Has Pets');
        const petGroup = document.getElementById('petDetailsGroup');
        if (petsRadio && petGroup) {
            petsRadio.forEach(r => r.addEventListener('change', (e) => {
                const show = e.target.value === 'Yes';
                petGroup.style.display = show ? 'block' : 'none';
                // When showing the pet section, populate the policy hint from URL params
                if (show) this._applyPetPolicyHint();
            }));
        }
        const hasCoApplicantCheck = document.getElementById('hasCoApplicant');
        const coApplicantSection = document.getElementById('coApplicantSection');
        if (hasCoApplicantCheck && coApplicantSection) {
            hasCoApplicantCheck.addEventListener('change', (e) => {
                coApplicantSection.style.display = e.target.checked ? 'block' : 'none';
                if (e.target.checked) {
                    const container = document.getElementById('coApplicantsContainer');
                    if (container && container.children.length === 0) {
                        this._addCoApplicantCard({});
                    }
                } else {
                    const container = document.getElementById('coApplicantsContainer');
                    if (container) container.replaceChildren();
                }
                this._syncCoApplicantsJson();
                this._updateTotalFeeDisplay();
                this._updateOccupantsCountSync();
                if (this._updateIncomeRatio) this._updateIncomeRatio();
            });
        }
        ['primaryPaymentMethod', 'alternativePaymentMethod', 'thirdChoicePaymentMethod'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => {
                    this._syncPaymentMethodUi(true);
                    this.saveProgress();
                });
            }
        });
        this._syncPaymentMethodUi(false);
        const vehicleYes = document.getElementById('vehicleYes');
        const vehicleNo = document.getElementById('vehicleNo');
        const vehicleDetails = document.getElementById('vehicleDetailsSection');
        if (vehicleYes && vehicleNo && vehicleDetails) {
            const toggleVehicle = () => {
                vehicleDetails.style.display = vehicleYes.checked ? 'block' : 'none';
            };
            vehicleYes.addEventListener('change', toggleVehicle);
            vehicleNo.addEventListener('change', toggleVehicle);
        }

        // ── Prior residence (< 24 months) detection + manual toggle ──
        const resDurEl = document.getElementById('residencyStart');
        const less24Cb = document.getElementById('lessThan2YearsToggle');
        const priorSection = document.getElementById('priorResidenceSection');
        const prevHousingEl = document.getElementById('previousHousingStatus');

        const parseDurationUnder24Months = (rawText) => {
            const val = String(rawText || '').trim().toLowerCase();
            if (!val) return false;
            let totalMonths = 0;
            let matched = false;
            const yrMatch = val.match(/(\d+(?:\.\d+)?)\s*(?:y|yr|yrs|year|years|año|años)/i);
            const moMatch = val.match(/(\d+(?:\.\d+)?)\s*(?:m|mo|mos|month|months|mes|meses)/i);
            const wkMatch = val.match(/(\d+(?:\.\d+)?)\s*(?:w|wk|wks|week|weeks|semana|semanas)/i);
            if (yrMatch) { totalMonths += parseFloat(yrMatch[1]) * 12; matched = true; }
            if (moMatch) { totalMonths += parseFloat(moMatch[1]); matched = true; }
            if (wkMatch) { totalMonths += parseFloat(wkMatch[1]) / 4.3; matched = true; }
            if (!matched && /^\d+$/.test(val)) {
                totalMonths = parseInt(val, 10);
                matched = true;
            }
            return matched ? totalMonths < 24 : false;
        };

        const setFieldState = (id, { visible = true, required = false, labelEn = null, labelEs = null, placeholderEn = null, placeholderEs = null, hintEl = null, hintEn = '', hintEs = '', clearWhenHidden = true, containerEl = null } = {}) => {
            const lang = this.state.language || 'en';
            const el = document.getElementById(id);
            if (!el) return;
            const wrap = containerEl || el.closest('.form-col') || el.closest('.form-group');
            const lbl = document.querySelector(`label[for="${id}"]`);
            if (!visible) {
                el.removeAttribute('required');
                if (clearWhenHidden) el.value = '';
                el.classList.remove('is-invalid', 'is-valid', 'error');
                this.clearError(el);
                if (lbl) lbl.classList.remove('required');
                if (hintEl) { hintEl.textContent = ''; hintEl.style.display = 'none'; }
                if (wrap) wrap.style.display = 'none';
                return;
            }
            if (wrap) wrap.style.display = '';
            if (required) el.setAttribute('required', 'required');
            else el.removeAttribute('required');
            if (lbl) {
                lbl.classList.toggle('required', Boolean(required));
                if (labelEn) lbl.textContent = lang === 'es' ? (labelEs || labelEn) : labelEn;
            }
            if (placeholderEn !== null && el.placeholder !== undefined) {
                el.placeholder = lang === 'es' ? (placeholderEs || placeholderEn) : placeholderEn;
            }
            if (hintEl) {
                const hText = lang === 'es' ? (hintEs || hintEn) : hintEn;
                hintEl.textContent = hText;
                hintEl.style.display = hText ? 'block' : 'none';
            }
            el.classList.remove('is-invalid');
            this.clearError(el);
        };

        // ── Step 2: Previous Housing Status dynamic sync ──
        const syncPriorHousingStatusUi = (rawStatus) => {
            const showPrior = priorSection && priorSection.style.display !== 'none';
            if (!showPrior) {
                ['previousHousingStatus', 'previousAddress', 'previousResidencyDuration', 'previousLandlordName', 'previousLandlordPhone'].forEach(id => {
                    const el = document.getElementById(id);
                    if (!el) return;
                    el.removeAttribute('required');
                    el.classList.remove('is-invalid');
                    this.clearError(el);
                });
                return;
            }
            const status = String(rawStatus || (prevHousingEl ? prevHousingEl.value : '') || '').trim();
            const priorRow = document.getElementById('priorLandlordRow');
            setFieldState('previousHousingStatus', { visible: true, required: true, labelEn: 'Previous Housing Status', labelEs: 'Situación de Vivienda Anterior' });
            setFieldState('previousAddress', { visible: true, required: true, labelEn: 'Previous Street Address', labelEs: 'Dirección Anterior' });
            setFieldState('previousResidencyDuration', { visible: true, required: true, labelEn: 'Duration at Previous Address', labelEs: 'Duración en la Dirección Anterior' });

            if (status === 'Own' || status === 'Mortgage') {
                if (priorRow) priorRow.style.display = 'none';
                setFieldState('previousLandlordName', { visible: false, containerEl: document.getElementById('previousLandlordNameCol') });
                setFieldState('previousLandlordPhone', { visible: false, containerEl: document.getElementById('previousLandlordPhoneCol') });
                const pExt = document.getElementById('previousLandlordPhoneExt');
                if (pExt) pExt.value = '';
            } else if (status === 'Living with Family' || status === 'Other') {
                if (priorRow) priorRow.style.display = '';
                setFieldState('previousLandlordName', {
                    visible: true,
                    required: false,
                    labelEn: status === 'Living with Family' ? 'Previous Host / Family Member Name (Optional)' : 'Previous Property Contact Name (Optional)',
                    labelEs: status === 'Living with Family' ? 'Nombre del Anfitrión / Familiar Anterior (Opcional)' : 'Contacto de Vivienda Anterior (Opcional)',
                    containerEl: document.getElementById('previousLandlordNameCol'),
                });
                setFieldState('previousLandlordPhone', {
                    visible: true,
                    required: false,
                    labelEn: status === 'Living with Family' ? 'Previous Host Phone (Optional)' : 'Previous Contact Phone (Optional)',
                    labelEs: status === 'Living with Family' ? 'Teléfono del Anfitrión Anterior (Opcional)' : 'Teléfono del Contacto Anterior (Opcional)',
                    containerEl: document.getElementById('previousLandlordPhoneCol'),
                });
            } else {
                if (priorRow) priorRow.style.display = '';
                setFieldState('previousLandlordName', {
                    visible: true,
                    required: true,
                    labelEn: 'Previous Landlord / Manager Name',
                    labelEs: 'Propietario / Administrador Anterior',
                    containerEl: document.getElementById('previousLandlordNameCol'),
                });
                setFieldState('previousLandlordPhone', {
                    visible: true,
                    required: true,
                    labelEn: 'Previous Landlord Phone',
                    labelEs: 'Teléfono del Propietario Anterior',
                    containerEl: document.getElementById('previousLandlordPhoneCol'),
                });
            }
        };
        this._syncPriorHousingStatusUi = syncPriorHousingStatusUi;
        if (prevHousingEl) {
            prevHousingEl.addEventListener('change', () => {
                syncPriorHousingStatusUi(prevHousingEl.value);
                this.updateFieldsRemainingHint(2);
            });
        }

        const syncPriorResidenceVisibility = () => {
            if (!priorSection) return;
            const under24 = resDurEl ? parseDurationUnder24Months(resDurEl.value) : false;
            if (less24Cb && under24 && !less24Cb.dataset.manualUnchecked) {
                less24Cb.checked = true;
            }
            const showPrior = Boolean((less24Cb && less24Cb.checked) || under24);
            priorSection.style.display = showPrior ? 'block' : 'none';
            syncPriorHousingStatusUi(prevHousingEl ? prevHousingEl.value : '');
            this.updateFieldsRemainingHint(2);
        };
        this._syncPriorResidenceVisibility = syncPriorResidenceVisibility;
        if (resDurEl) {
            resDurEl.addEventListener('input', syncPriorResidenceVisibility);
            resDurEl.addEventListener('blur', syncPriorResidenceVisibility);
        }
        if (less24Cb) {
            less24Cb.addEventListener('change', () => {
                less24Cb.dataset.manualUnchecked = less24Cb.checked ? '' : '1';
                syncPriorResidenceVisibility();
            });
        }
        syncPriorResidenceVisibility();

        // ── Step 2: Current Housing Status dynamic sync ──
        const housingStatusEl = document.getElementById('housingStatus');
        const syncHousingStatusUi = (rawStatus) => {
            const status = String(rawStatus !== undefined ? rawStatus : (housingStatusEl ? housingStatusEl.value : '') || '').trim();
            const rentCol = document.getElementById('rentAmountCol');
            const rentHint = document.getElementById('rentAmountHint');
            const reasonGrp = document.getElementById('reasonLeavingGroup');
            const reasonHint = document.getElementById('reasonLeavingHint');
            const llRow = document.getElementById('currentLandlordRow');
            const llNameCol = document.getElementById('landlordNameCol');
            const llPhoneCol = document.getElementById('landlordPhoneCol');
            const llExtEl = document.getElementById('landlordPhoneExt');

            if (status === 'Own') {
                setFieldState('rentAmount', { visible: false, hintEl: rentHint, containerEl: rentCol });
                setFieldState('reasonLeaving', {
                    visible: true,
                    required: false,
                    labelEn: 'Reason for moving / selling or relocating (Optional)',
                    labelEs: 'Motivo de mudanza / venta o reubicación (Opcional)',
                    placeholderEn: 'e.g., Selling home, relocating closer to work, downsizing',
                    placeholderEs: 'ej., Venta de vivienda, traslado laboral o cambio de residencia',
                    hintEl: reasonHint,
                    hintEn: 'No landlord or monthly mortgage/rent payment required for homes owned free and clear.',
                    hintEs: 'No se requiere propietario ni pago mensual de renta/hipoteca si es dueño sin hipoteca.',
                    containerEl: reasonGrp,
                });
                if (llRow) llRow.style.display = 'none';
                setFieldState('landlordName', { visible: false, containerEl: llNameCol });
                setFieldState('landlordPhone', { visible: false, containerEl: llPhoneCol });
                if (llExtEl) llExtEl.value = '';
            } else if (status === 'Mortgage') {
                setFieldState('rentAmount', {
                    visible: true,
                    required: true,
                    labelEn: 'Current Monthly Mortgage Payment',
                    labelEs: 'Pago Mensual Actual de Hipoteca',
                    placeholderEn: '$',
                    placeholderEs: '$',
                    hintEl: rentHint,
                    hintEn: 'Approximate monthly PITI or mortgage payment.',
                    hintEs: 'Pago mensual aproximado de su hipoteca actual.',
                    containerEl: rentCol,
                });
                setFieldState('reasonLeaving', {
                    visible: true,
                    required: false,
                    labelEn: 'Reason for moving / relocating (Optional)',
                    labelEs: 'Motivo de mudanza / reubicación (Opcional)',
                    placeholderEn: 'e.g., Selling home, renting out current residence, relocating',
                    placeholderEs: 'ej., Venta o renta de su propiedad actual, traslado',
                    hintEl: reasonHint,
                    containerEl: reasonGrp,
                });
                if (llRow) llRow.style.display = '';
                setFieldState('landlordName', {
                    visible: true,
                    required: false,
                    labelEn: 'Mortgage Lender / Servicer Name (Optional)',
                    labelEs: 'Banco / Administrador de Hipoteca (Opcional)',
                    placeholderEn: 'e.g., Chase, Rocket Mortgage (optional)',
                    placeholderEs: 'ej., Banco o entidad financiera (opcional)',
                    containerEl: llNameCol,
                });
                setFieldState('landlordPhone', {
                    visible: true,
                    required: false,
                    labelEn: 'Lender / Servicer Phone (Optional)',
                    labelEs: 'Teléfono del Banco / Entidad (Opcional)',
                    containerEl: llPhoneCol,
                });
            } else if (status === 'Living with Family') {
                setFieldState('rentAmount', {
                    visible: true,
                    required: false,
                    labelEn: 'Monthly Housing Contribution ($0 if none)',
                    labelEs: 'Aporte Mensual de Vivienda ($0 si no paga)',
                    placeholderEn: '$0 or monthly contribution',
                    placeholderEs: '$0 o aporte mensual',
                    hintEl: rentHint,
                    hintEn: 'Leave blank or enter $0 if you do not pay monthly housing costs.',
                    hintEs: 'Deje en blanco o ingrese $0 si no realiza pago mensual.',
                    containerEl: rentCol,
                });
                setFieldState('reasonLeaving', {
                    visible: true,
                    required: true,
                    labelEn: 'Reason for moving',
                    labelEs: 'Motivo de mudanza',
                    placeholderEn: 'e.g., Moving into my own place / relocating for work',
                    placeholderEs: 'ej., Independizarme o traslado cercano al trabajo',
                    hintEl: reasonHint,
                    containerEl: reasonGrp,
                });
                if (llRow) llRow.style.display = '';
                setFieldState('landlordName', {
                    visible: true,
                    required: false,
                    labelEn: 'Host / Family Member Name (Optional)',
                    labelEs: 'Nombre del Anfitrión / Familiar (Opcional)',
                    placeholderEn: 'Person you currently live with (optional)',
                    placeholderEs: 'Familiar o persona con quien reside (opcional)',
                    containerEl: llNameCol,
                });
                setFieldState('landlordPhone', {
                    visible: true,
                    required: false,
                    labelEn: 'Host / Family Member Phone (Optional)',
                    labelEs: 'Teléfono del Anfitrión / Familiar (Opcional)',
                    containerEl: llPhoneCol,
                });
            } else if (status === 'Other') {
                setFieldState('rentAmount', {
                    visible: true,
                    required: false,
                    labelEn: 'Monthly Housing Cost (Optional)',
                    labelEs: 'Costo Mensual de Vivienda (Opcional)',
                    placeholderEn: '$0 or monthly amount',
                    placeholderEs: '$0 o monto mensual',
                    hintEl: rentHint,
                    containerEl: rentCol,
                });
                setFieldState('reasonLeaving', {
                    visible: true,
                    required: true,
                    labelEn: 'Describe Current Housing & Reason for Moving',
                    labelEs: 'Describa su Vivienda Actual y Motivo de Mudanza',
                    placeholderEn: 'e.g., Corporate housing, short-term stay, military housing',
                    placeholderEs: 'ej., Vivienda temporal, vivienda corporativa o militar',
                    hintEl: reasonHint,
                    containerEl: reasonGrp,
                });
                if (llRow) llRow.style.display = '';
                setFieldState('landlordName', {
                    visible: true,
                    required: false,
                    labelEn: 'Property Contact / Manager Name (Optional)',
                    labelEs: 'Contacto / Administrador (Opcional)',
                    placeholderEn: 'Optional verification contact',
                    placeholderEs: 'Contacto de referencia opcional',
                    containerEl: llNameCol,
                });
                setFieldState('landlordPhone', {
                    visible: true,
                    required: false,
                    labelEn: 'Contact Phone (Optional)',
                    labelEs: 'Teléfono de Contacto (Opcional)',
                    containerEl: llPhoneCol,
                });
            } else {
                // Default / 'Rent'
                setFieldState('rentAmount', {
                    visible: true,
                    required: true,
                    labelEn: 'Current Monthly Rent',
                    labelEs: 'Renta Mensual Actual',
                    placeholderEn: '$',
                    placeholderEs: '$',
                    hintEl: rentHint,
                    containerEl: rentCol,
                });
                setFieldState('reasonLeaving', {
                    visible: true,
                    required: true,
                    labelEn: 'Reason for leaving',
                    labelEs: 'Motivo de Desocupación',
                    placeholderEn: '',
                    placeholderEs: '',
                    hintEl: reasonHint,
                    containerEl: reasonGrp,
                });
                if (llRow) llRow.style.display = '';
                setFieldState('landlordName', {
                    visible: true,
                    required: true,
                    labelEn: 'Current Landlord / Property Manager Name',
                    labelEs: 'Propietario / Administrador Actual',
                    placeholderEn: '',
                    placeholderEs: '',
                    containerEl: llNameCol,
                });
                setFieldState('landlordPhone', {
                    visible: true,
                    required: true,
                    labelEn: 'Landlord / Property Manager Phone',
                    labelEs: 'Teléfono del Propietario / Administrador',
                    containerEl: llPhoneCol,
                });
            }

            // Refresh co-applicant cards synced to Primary's address
            const coContainer = document.getElementById('coApplicantsContainer');
            if (coContainer) {
                Array.from(coContainer.children).forEach(card => {
                    if (card.querySelector('.co-same-address')?.checked) {
                        this._syncCardFieldVisibility(card);
                    }
                });
                this._syncCoApplicantsJson();
            }
            this.updateFieldsRemainingHint(2);
        };
        this._syncHousingStatusUi = syncHousingStatusUi;
        if (housingStatusEl) {
            housingStatusEl.addEventListener('change', () => syncHousingStatusUi(housingStatusEl.value));
            syncHousingStatusUi(housingStatusEl.value);
        }

        // ── Step 2: Occupant names helper sync ──
        const syncTotalOccupantsUi = () => {
            const totalOccEl = document.getElementById('totalOccupants');
            const namesEl = document.getElementById('occupantNames');
            const namesHint = document.getElementById('occupantNamesHint');
            if (!totalOccEl || !namesEl) return;
            const count = parseInt(totalOccEl.value || '1', 10) || 1;
            const lang = this.state.language || 'en';
            if (namesHint) {
                if (count <= 1) {
                    namesHint.textContent = lang === 'es'
                        ? 'Deje en blanco si vivirá solo en la propiedad.'
                        : 'Leave blank if you are the sole occupant.';
                    namesHint.style.display = 'block';
                } else {
                    namesHint.textContent = lang === 'es'
                        ? `Incluya los nombres y edades de los ${count - 1} ocupante(s) adicional(es) (adultos y menores).`
                        : `List the names, ages, and relationships of the ${count - 1} other occupant(s) (adults and children).`;
                    namesHint.style.display = 'block';
                }
            }
        };
        this._syncTotalOccupantsUi = syncTotalOccupantsUi;
        const totalOccInput = document.getElementById('totalOccupants');
        if (totalOccInput) {
            totalOccInput.addEventListener('input', syncTotalOccupantsUi);
            totalOccInput.addEventListener('change', syncTotalOccupantsUi);
            syncTotalOccupantsUi();
        }

        // ── SSN Verification Mode & Disclosure Explanations (Step 5) ──
        document.querySelectorAll('input[name="SSN Mode"]').forEach(r => {
            r.addEventListener('change', () => {
                this._syncPrimarySsnModeUi();
                this.updateFieldsRemainingHint(this.getCurrentSection());
            });
        });
        this._syncPrimarySsnModeUi();

        const syncDisclosureExplanations = () => {
            const bYes = document.getElementById('bankruptcyYes');
            const bGrp = document.getElementById('bankruptcyExplanationGroup');
            const bTxt = document.getElementById('bankruptcyExplanation');
            if (bGrp && bTxt) {
                const showB = Boolean(bYes && bYes.checked);
                bGrp.style.display = showB ? 'block' : 'none';
                if (showB) bTxt.setAttribute('required', 'required');
                else { bTxt.removeAttribute('required'); this.clearError(bTxt); bTxt.classList.remove('is-invalid'); }
            }
            const cYes = document.getElementById('criminalYes');
            const cGrp = document.getElementById('criminalExplanationGroup');
            const cTxt = document.getElementById('criminalExplanation');
            if (cGrp && cTxt) {
                const showC = Boolean(cYes && cYes.checked);
                cGrp.style.display = showC ? 'block' : 'none';
                if (showC) cTxt.setAttribute('required', 'required');
                else { cTxt.removeAttribute('required'); this.clearError(cTxt); cTxt.classList.remove('is-invalid'); }
            }
        };
        this._syncDisclosureExplanations = syncDisclosureExplanations;
        document.querySelectorAll('input[name="Has Bankruptcy"], input[name="Has Criminal History"]').forEach(r => {
            r.addEventListener('change', syncDisclosureExplanations);
        });
        syncDisclosureExplanations();

        // ── Employment status: conditionally show/label/require employer & income fields ──
        const toggleEmployerSection = (status) => {
            const lang = this.state.language || 'en';
            const getLabel = (id) => document.querySelector(`label[for="${id}"]`);
            const rowsSeen = new Set();

            const showField = (id, required, labelEn, labelEs) => {
                const el = document.getElementById(id);
                if (!el) return;
                if (required) el.setAttribute('required', 'required');
                else el.removeAttribute('required');
                el.classList.remove('is-invalid');
                this.clearError(el);
                const lbl = getLabel(id);
                if (lbl) {
                    lbl.classList.toggle('required', Boolean(required));
                    if (labelEn) lbl.textContent = lang === 'es' ? labelEs : labelEn;
                }
                const col = el.closest('.form-col') || el.closest('.form-group');
                if (col && !rowsSeen.has(col)) { col.style.display = ''; rowsSeen.add(col); }
            };

            const hideField = (id) => {
                const el = document.getElementById(id);
                if (!el) return;
                el.removeAttribute('required');
                el.value = '';
                el.classList.remove('is-invalid', 'is-valid', 'error');
                this.clearError(el);
                const lbl = getLabel(id);
                if (lbl) lbl.classList.remove('required');
                const col = el.closest('.form-col') || el.closest('.form-group');
                if (col && !rowsSeen.has(col)) { col.style.display = 'none'; rowsSeen.add(col); }
            };

            const empAddrGrp = document.getElementById('employerAddressGroup');
            const supPhoneGrp = document.getElementById('supervisorPhoneGroup');
            const incomeEl = document.getElementById('monthlyIncome');
            const incomeLbl = getLabel('monthlyIncome');
            const incomeHintEl = document.getElementById('incomeHintEl');
            const otherHintEl = document.getElementById('otherIncomeHintEl');

            if (status === 'Unemployed') {
                hideField('employer');
                hideField('employerAddress');
                if (empAddrGrp) empAddrGrp.style.display = 'none';
                hideField('jobTitle');
                hideField('employmentStartDate');
                hideField('employmentDuration');
                hideField('supervisorName');
                hideField('supervisorPhone');
                const supExt = document.getElementById('supervisorPhoneExt');
                if (supExt) supExt.value = '';
                if (supPhoneGrp) supPhoneGrp.style.display = 'none';
                if (incomeLbl) {
                    incomeLbl.classList.add('required');
                    incomeLbl.textContent = lang === 'es'
                        ? 'Ingreso Mensual por Asistencia / Desempleo / Ahorros ($0 si ninguno)'
                        : 'Monthly Assistance / Unemployment / Savings Draw ($0 if none)';
                }
                if (incomeEl) incomeEl.placeholder = '0';
                if (incomeHintEl) {
                    incomeHintEl.textContent = lang === 'es'
                        ? 'Ingrese 0 si depende de ahorros, co-solicitante o garante.'
                        : 'Enter 0 if relying on savings, co-applicant, or guarantor.';
                }
                if (otherHintEl) {
                    otherHintEl.textContent = lang === 'es'
                        ? 'Beneficios por desempleo, ahorros, pensión alimenticia o ayuda familiar.'
                        : 'Unemployment benefits, savings, child support, or family assistance.';
                }
            } else if (status === 'Retired') {
                showField('employer', false, 'Primary Retirement / Pension Source (Optional)', 'Fuente de Jubilación / Pensión (Opcional)');
                showField('employerAddress', false, 'Former Employer / Agency Address (Optional)', 'Dirección de Ex Empleador / Agencia (Opcional)');
                if (empAddrGrp) empAddrGrp.style.display = '';
                showField('jobTitle', false, 'Former Job Title (Optional)', 'Cargo Anterior (Opcional)');
                showField('employmentStartDate', false, 'Retirement Start Date (Optional)', 'Fecha de Retiro (Opcional)');
                showField('employmentDuration', false, 'Years Retired / Duration (Optional)', 'Años Retirado (Opcional)');
                hideField('supervisorName');
                hideField('supervisorPhone');
                if (supPhoneGrp) supPhoneGrp.style.display = 'none';
                if (incomeLbl) {
                    incomeLbl.classList.add('required');
                    incomeLbl.textContent = lang === 'es'
                        ? 'Ingreso Mensual de Jubilación / Pensión / Beneficios'
                        : 'Monthly Retirement / Pension / Benefit Income';
                }
                if (incomeEl) incomeEl.placeholder = lang === 'es' ? 'ej. 2800' : 'e.g. 2800';
                if (incomeHintEl) {
                    incomeHintEl.textContent = lang === 'es'
                        ? 'Seguro Social, pensión, anualidad o retiro de inversión.'
                        : 'Social Security, pension, annuity, or retirement draw.';
                }
                if (otherHintEl) {
                    otherHintEl.textContent = lang === 'es'
                        ? 'Ahorros, dividendos, ingresos por alquiler u otros beneficios.'
                        : 'Investments, savings draw, disability, or additional benefits.';
                }
            } else if (status === 'Student') {
                showField('employer', false, 'School / Institution Name (Optional)', 'Escuela / Institución (Opcional)');
                showField('employerAddress', false, 'Institution Address (Optional)', 'Dirección de la Institución (Opcional)');
                if (empAddrGrp) empAddrGrp.style.display = '';
                showField('jobTitle', false, 'Program / Field of Study (Optional)', 'Programa / Campo de Estudio (Opcional)');
                showField('employmentStartDate', false, 'Enrollment Start Date (Optional)', 'Fecha de Inicio (Opcional)');
                showField('employmentDuration', false, 'Years at Institution (Optional)', 'Años en la institución (Opcional)');
                hideField('supervisorName');
                hideField('supervisorPhone');
                if (supPhoneGrp) supPhoneGrp.style.display = 'none';
                if (incomeLbl) {
                    incomeLbl.classList.add('required');
                    incomeLbl.textContent = lang === 'es'
                        ? 'Ingreso Mensual / Ayuda Financiera / Apoyo'
                        : 'Monthly Income / Financial Aid / Support';
                }
                if (incomeEl) incomeEl.placeholder = lang === 'es' ? 'ej. 1200 o 0' : 'e.g. 1200 or 0';
                if (incomeHintEl) {
                    incomeHintEl.textContent = lang === 'es'
                        ? 'Ingrese $0 si cuenta con respaldo familiar, beca o garante.'
                        : 'Enter $0 if supported by savings, family assistance, or a guarantor.';
                }
                if (otherHintEl) {
                    otherHintEl.textContent = lang === 'es'
                        ? 'Becas, estipendios, ayuda estudiantil o apoyo familiar.'
                        : 'Grants, scholarships, stipend, or family support.';
                }
            } else if (status === 'Self-employed') {
                showField('employer', true, 'Business / Trade Name', 'Nombre del Negocio');
                showField('employerAddress', false, 'Business Address (Optional)', 'Dirección del Negocio (Opcional)');
                if (empAddrGrp) empAddrGrp.style.display = '';
                showField('jobTitle', true, 'Your Role / Occupation', 'Su Rol / Cargo');
                showField('employmentStartDate', false, 'Business Start Date (Optional)', 'Fecha de Inicio (Opcional)');
                showField('employmentDuration', true, 'How long in business?', '¿Cuánto tiempo en el negocio?');
                hideField('supervisorName');
                hideField('supervisorPhone');
                if (supPhoneGrp) supPhoneGrp.style.display = 'none';
                if (incomeLbl) {
                    incomeLbl.classList.add('required');
                    incomeLbl.textContent = lang === 'es'
                        ? 'Ingreso Bruto Mensual del Negocio'
                        : 'Gross Monthly Business Income';
                }
                if (incomeEl) incomeEl.placeholder = lang === 'es' ? 'ej. 4500' : 'e.g. 4500';
                if (incomeHintEl) {
                    incomeHintEl.textContent = lang === 'es'
                        ? 'Ingreso mensual bruto promedio antes de impuestos.'
                        : 'Average monthly gross business income before taxes.';
                }
                if (otherHintEl) {
                    otherHintEl.textContent = lang === 'es'
                        ? 'Fuentes adicionales (trabajo independiente, rentas, inversiones).'
                        : 'Supplemental sources (side contracts, investments, support).';
                }
            } else {
                showField('employer', true, 'Employer', 'Empleador');
                showField('employerAddress', false, 'Employer / Business Address (Optional)', 'Dirección del Empleador (Opcional)');
                if (empAddrGrp) empAddrGrp.style.display = '';
                showField('jobTitle', true, 'Job Title', 'Puesto');
                showField('employmentStartDate', false, 'Start Date (Optional)', 'Fecha de Inicio (Opcional)');
                showField('employmentDuration', true, 'How long at this job?', '¿Cuánto tiempo en este trabajo?');
                showField('supervisorName', true, 'Supervisor Name', 'Nombre del supervisor');
                showField('supervisorPhone', true, 'Supervisor Phone', 'Teléfono del supervisor');
                if (supPhoneGrp) supPhoneGrp.style.display = '';
                if (incomeLbl) {
                    incomeLbl.classList.add('required');
                    incomeLbl.textContent = lang === 'es' ? 'Ingreso Mensual Bruto' : 'Gross Monthly Income';
                }
                if (incomeEl) incomeEl.placeholder = lang === 'es' ? 'ej. 3500' : 'e.g. 3500';
                if (incomeHintEl) {
                    incomeHintEl.textContent = lang === 'es' ? 'Antes de impuestos y deducciones' : 'Before taxes and deductions';
                }
                if (otherHintEl) {
                    otherHintEl.textContent = lang === 'es'
                        ? 'Fuentes suplementarias (ej., discapacidad, pensión)'
                        : 'Child support, disability, etc.';
                }
            }
            this.updateFieldsRemainingHint(3);
        };

        const empStatusEl = document.getElementById('employmentStatus');
        if (empStatusEl) {
            empStatusEl.addEventListener('change', () => toggleEmployerSection(empStatusEl.value));
            toggleEmployerSection(empStatusEl.value);
        }
        this._toggleEmployerSection = toggleEmployerSection;
    }

    async _compressImageFile(file) {
        if (!file || !/^image\/(jpeg|jpg|png|webp)$/i.test(file.type || '')) return file;
        if (file.size <= 600 * 1024) return file;
        return new Promise((resolve) => {
            const img = new Image();
            const objUrl = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(objUrl);
                try {
                    const maxDim = 1800;
                    let { width, height } = img;
                    if (width > maxDim || height > maxDim) {
                        const scale = Math.min(maxDim / width, maxDim / height);
                        width = Math.round(width * scale);
                        height = Math.round(height * scale);
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) { resolve(file); return; }
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob((blob) => {
                        if (!blob || blob.size >= file.size) { resolve(file); return; }
                        const cleanName = (file.name || 'photo').replace(/\.(png|webp|jpeg|jpg)$/i, '') + '.jpg';
                        resolve(new File([blob], cleanName, { type: 'image/jpeg' }));
                    }, 'image/jpeg', 0.82);
                } catch (_) {
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

    async _uploadQueuedDocumentsAfterSubmit(appId, portalUploadToken) {
        const files = Array.isArray(this._uploadedFiles) ? this._uploadedFiles : [];
        if (!files.length) return { total: 0, uploadedCount: 0, failedNames: [] };
        const supaUrl = (window.CP_CONFIG && window.CP_CONFIG.SUPABASE_URL) ? window.CP_CONFIG.SUPABASE_URL.replace(/\/$/, '') : '';
        const anonKey = (window.CP_CONFIG && window.CP_CONFIG.SUPABASE_ANON_KEY) || '';
        if (!supaUrl || !anonKey || !portalUploadToken || !appId) {
            return { total: files.length, uploadedCount: 0, failedNames: files.map(f => f.name) };
        }
        const endpoint = supaUrl + '/functions/v1/request-upload-url';
        let uploadedCount = 0;
        const failedNames = [];
        for (const f of files) {
            try {
                const reqRes = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': anonKey,
                    },
                    body: JSON.stringify({
                        app_id: appId,
                        portal_upload_token: portalUploadToken,
                        file_name: f.name,
                        file_type: f.type || 'application/octet-stream',
                        doc_type: f._docType || 'applicant_upload',
                        doc_side: f._docSide || null,
                        applicant_index: typeof f._applicantIndex === 'number' ? f._applicantIndex : 0,
                    }),
                });
                const reqJson = await reqRes.json().catch(() => null);
                if (!reqRes.ok || !reqJson || !reqJson.signed_url || !reqJson.document_id) {
                    failedNames.push(f.name);
                    continue;
                }
                const putRes = await fetch(reqJson.signed_url, {
                    method: 'PUT',
                    headers: { 'Content-Type': f.type || 'application/octet-stream' },
                    body: f,
                });
                if (!putRes.ok) {
                    failedNames.push(f.name);
                    continue;
                }
                await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': anonKey,
                    },
                    body: JSON.stringify({
                        action: 'mark_uploaded',
                        document_id: reqJson.document_id,
                        portal_upload_token: portalUploadToken,
                        file_size: f.size,
                    }),
                }).catch(() => {});
                uploadedCount++;
            } catch (_) {
                failedNames.push(f.name);
            }
        }
        return { total: files.length, uploadedCount, failedNames };
    }

    setupFileUploads() {
        this._uploadedFiles = [];
        const grid = document.getElementById('docSlotsGrid');
        if (!grid) return;

        const MAX_SIZE  = 10 * 1024 * 1024; // 10 MB raw/compressed file via signed URL
        const MAX_FILES = 12;

        const SLOTS = [
            {
                key: 'gov_id_front',
                docType: 'government_id',
                docSide: 'front',
                icon: 'fas fa-id-card',
                titleEn: 'Government ID — Front',
                titleEs: 'Identificación Oficial — Frente',
                hintEn: "Driver's license, state ID, or passport photo page",
                hintEs: 'Licencia de conducir, ID estatal o pasaporte',
                multi: false,
            },
            {
                key: 'gov_id_back',
                docType: 'government_id',
                docSide: 'back',
                icon: 'fas fa-id-card-clip',
                titleEn: 'Government ID — Back',
                titleEs: 'Identificación Oficial — Reverso',
                hintEn: 'Back of driver’s license or state ID (if applicable)',
                hintEs: 'Reverso de la licencia o ID estatal (si aplica)',
                multi: false,
            },
            {
                key: 'pay_stub',
                docType: 'pay_stub',
                docSide: null,
                icon: 'fas fa-file-invoice-dollar',
                titleEn: 'Pay Stubs / Proof of Income',
                titleEs: 'Talones de Pago / Comprobante',
                hintEn: 'Last 2–3 recent pay stubs or income offer letters',
                hintEs: 'Últimos 2–3 recibos recientes o comprobante de ingresos',
                multi: true,
            },
            {
                key: 'bank_statement',
                docType: 'bank_statement',
                docSide: null,
                icon: 'fas fa-building-columns',
                titleEn: 'Bank Statements',
                titleEs: 'Estados de Cuenta Bancarios',
                hintEn: 'Most recent 1–2 monthly bank statement PDFs/screenshots',
                hintEs: 'Últimos 1–2 estados de cuenta bancarios mensuales',
                multi: true,
            },
            {
                key: 'guarantor_support',
                docType: 'guarantor_support',
                docSide: null,
                icon: 'fas fa-handshake',
                titleEn: 'Guarantor / Co-Signer Support',
                titleEs: 'Respaldo de Garante / Co-Firmante',
                hintEn: 'Income or reserve proof if applying with a supporter',
                hintEs: 'Comprobante financiero del garante o co-firmante',
                multi: true,
            },
            {
                key: 'other',
                docType: 'applicant_upload',
                docSide: null,
                icon: 'fas fa-folder-plus',
                titleEn: 'Other Supporting Docs',
                titleEs: 'Otros Documentos de Apoyo',
                hintEn: 'Tax return, benefit letter, ITIN notice, etc.',
                hintEs: 'Declaración de impuestos, carta de beneficios, etc.',
                multi: true,
            },
        ];

        const updateMeter = () => {
            const meter   = document.getElementById('uploadMeter');
            const countEl = document.getElementById('uploadMeterCount');
            const ofEl    = document.getElementById('uploadMeterOfText');
            const usedEl  = document.getElementById('uploadMeterUsed');
            const barEl   = document.getElementById('uploadMeterBar');
            if (!meter) return;
            const lang  = this.state.language || 'en';
            const count = this._uploadedFiles.length;
            const totalMb = this._uploadedFiles.reduce((s, f) => s + (f.size || 0), 0) / (1024 * 1024);
            const pct = Math.min(100, Math.round((count / MAX_FILES) * 100));
            if (countEl) countEl.textContent = String(count);
            if (ofEl) ofEl.textContent = lang === 'es' ? `de ${MAX_FILES} archivos listos` : `of ${MAX_FILES} files ready`;
            if (usedEl) usedEl.textContent = totalMb.toFixed(2);
            if (barEl) {
                barEl.style.width = pct + '%';
                barEl.style.background = pct >= 90 ? '#f59e0b' : 'var(--secondary)';
            }
            meter.style.display = count > 0 ? 'block' : 'none';
        };

        const showUploadErr = (msg) => {
            const ue = document.getElementById('uploadError');
            if (ue) {
                ue.textContent = msg;
                ue.style.display = 'block';
                setTimeout(() => { ue.style.display = 'none'; }, 5500);
            }
        };

        const addSlotFiles = async (slot, rawFiles, applicantIndex) => {
            const lang = this.state.language || 'en';
            for (const origFile of Array.from(rawFiles || [])) {
                const isAllowed = /\.(pdf|jpe?g|png|webp)$/i.test(origFile.name) || /^(application\/pdf|image\/(jpeg|jpg|png|webp))$/i.test(origFile.type || '');
                if (!isAllowed) {
                    showUploadErr(lang === 'es'
                        ? `"${origFile.name}" no es un archivo válido (acepta PDF, JPG, PNG, WebP).`
                        : `"${origFile.name}" is not a supported format (PDF, JPG, PNG, WebP accepted).`);
                    continue;
                }
                if (origFile.size > MAX_SIZE) {
                    showUploadErr(lang === 'es'
                        ? `"${origFile.name}" supera el límite de 10 MB.`
                        : `"${origFile.name}" exceeds the 10 MB per-file limit.`);
                    continue;
                }
                if (!slot.multi) {
                    this._uploadedFiles = this._uploadedFiles.filter(f => f._slotKey !== slot.key || f._applicantIndex !== applicantIndex);
                }
                if (this._uploadedFiles.length >= MAX_FILES) {
                    showUploadErr(lang === 'es' ? `Máximo de ${MAX_FILES} archivos permitidos.` : `Maximum of ${MAX_FILES} files permitted.`);
                    break;
                }
                const compressed = await this._compressImageFile(origFile);
                compressed._slotKey = slot.key;
                compressed._docType = slot.docType;
                compressed._docSide = slot.docSide;
                compressed._applicantIndex = applicantIndex;
                if (/^image\//i.test(compressed.type || '') || /\.(jpe?g|png|webp)$/i.test(compressed.name)) {
                    const reader = new FileReader();
                    reader.onload = (ev) => { compressed._dataUrl = ev.target.result; renderSlots(); };
                    reader.readAsDataURL(compressed);
                }
                this._uploadedFiles.push(compressed);
            }
            renderSlots();
        };

        const renderSlots = () => {
            const lang = this.state.language || 'en';
            const coList = this._collectCoApplicants ? this._collectCoApplicants() : [];
            const pName = [(document.getElementById('firstName')?.value || '').trim(), (document.getElementById('lastName')?.value || '').trim()].filter(Boolean).join(' ');

            const buildApplicantOptions = (selectEl, selectedIdx) => {
                const optP = document.createElement('option');
                optP.value = '0';
                optP.textContent = (lang === 'es' ? 'Para: ' : 'For: ') + (pName || this._getShortRoleLabel('primary', lang));
                selectEl.appendChild(optP);
                coList.forEach((ca, idx) => {
                    const opt = document.createElement('option');
                    opt.value = String(idx + 1);
                    const type = this._normalizeApplicantType(ca.applicant_type || ca.role, false);
                    const cName = [ca.first_name, ca.last_name].filter(Boolean).join(' ') || `${this._getShortRoleLabel(type, lang)} #${idx + 2}`;
                    opt.textContent = `${lang === 'es' ? 'Para' : 'For'}: ${cName}`;
                    selectEl.appendChild(opt);
                });
                selectEl.value = String(selectedIdx || 0);
            };

            const cards = SLOTS.map(slot => {
                const slotFiles = this._uploadedFiles.map((f, idx) => ({ f, idx })).filter(x => x.f._slotKey === slot.key);
                const card = document.createElement('div');
                card.className = 'doc-slot-card' + (slotFiles.length ? ' has-file' : '');

                const head = document.createElement('div');
                head.className = 'doc-slot-header';
                const titleSpan = document.createElement('span');
                titleSpan.className = 'doc-slot-title';
                titleSpan.appendChild(this._icon(slot.icon));
                titleSpan.appendChild(document.createTextNode(' ' + (lang === 'es' ? slot.titleEs : slot.titleEn)));
                const badge = document.createElement('span');
                badge.className = 'doc-slot-badge' + (slotFiles.length ? ' attached' : '');
                badge.textContent = slotFiles.length
                    ? (lang === 'es' ? `${slotFiles.length} listo(s)` : `${slotFiles.length} attached`)
                    : (lang === 'es' ? 'Opcional' : 'Optional');
                head.append(titleSpan, badge);

                const hint = document.createElement('div');
                hint.className = 'doc-slot-hint';
                hint.textContent = lang === 'es' ? slot.hintEs : slot.hintEn;

                const appSel = document.createElement('select');
                appSel.className = 'doc-slot-applicant-select';
                appSel.setAttribute('aria-label', 'Assign document to applicant');
                buildApplicantOptions(appSel, slot._selectedApplicant || 0);
                appSel.addEventListener('change', () => {
                    slot._selectedApplicant = parseInt(appSel.value, 10) || 0;
                });

                const actions = document.createElement('div');
                actions.className = 'doc-slot-actions';

                const fileInp = document.createElement('input');
                fileInp.type = 'file';
                fileInp.accept = '.pdf,.jpg,.jpeg,.png,.webp,image/*,application/pdf';
                fileInp.multiple = slot.multi;
                fileInp.style.display = 'none';
                fileInp.addEventListener('change', async () => {
                    await addSlotFiles(slot, fileInp.files, parseInt(appSel.value, 10) || 0);
                    fileInp.value = '';
                });

                const camInp = document.createElement('input');
                camInp.type = 'file';
                camInp.accept = 'image/*';
                camInp.setAttribute('capture', 'environment');
                camInp.style.display = 'none';
                camInp.addEventListener('change', async () => {
                    await addSlotFiles(slot, camInp.files, parseInt(appSel.value, 10) || 0);
                    camInp.value = '';
                });

                const browseBtn = document.createElement('button');
                browseBtn.type = 'button';
                browseBtn.className = 'doc-slot-btn';
                browseBtn.appendChild(this._icon('fas fa-folder-open'));
                browseBtn.appendChild(document.createTextNode(' ' + (slotFiles.length && !slot.multi ? (lang === 'es' ? 'Reemplazar' : 'Replace') : (lang === 'es' ? 'Elegir Archivo' : 'Browse File'))));
                browseBtn.addEventListener('click', () => fileInp.click());

                const camBtn = document.createElement('button');
                camBtn.type = 'button';
                camBtn.className = 'doc-slot-btn doc-slot-btn--camera';
                camBtn.appendChild(this._icon('fas fa-camera'));
                camBtn.appendChild(document.createTextNode(' ' + (lang === 'es' ? 'Cámara' : 'Take Photo')));
                camBtn.addEventListener('click', () => camInp.click());

                actions.append(fileInp, camInp, browseBtn, camBtn);

                const fileListWrap = document.createElement('div');
                fileListWrap.className = 'doc-slot-files';
                slotFiles.forEach(({ f, idx }) => {
                    const row = document.createElement('div');
                    row.className = 'doc-slot-file-row';
                    if (f._dataUrl) {
                        const img = document.createElement('img');
                        img.src = f._dataUrl;
                        img.alt = f.name;
                        img.className = 'doc-slot-thumb';
                        row.appendChild(img);
                    } else {
                        const pdfBadge = document.createElement('span');
                        pdfBadge.className = 'doc-slot-thumb-pdf';
                        pdfBadge.appendChild(this._icon('fas fa-file-pdf'));
                        row.appendChild(pdfBadge);
                    }
                    const meta = document.createElement('div');
                    meta.className = 'doc-slot-file-meta';
                    const nm = document.createElement('div');
                    nm.className = 'doc-slot-file-name';
                    nm.textContent = f.name;
                    const kb = document.createElement('div');
                    kb.className = 'doc-slot-file-size';
                    kb.textContent = `${(f.size / 1024).toFixed(0)} KB`;
                    meta.append(nm, kb);

                    const rmBtn = document.createElement('button');
                    rmBtn.type = 'button';
                    rmBtn.className = 'upload-remove-btn';
                    rmBtn.setAttribute('aria-label', 'Remove ' + f.name);
                    rmBtn.replaceChildren(this._icon('fas fa-xmark'));
                    rmBtn.addEventListener('click', () => {
                        this._uploadedFiles.splice(idx, 1);
                        renderSlots();
                    });

                    row.append(meta, rmBtn);
                    fileListWrap.appendChild(row);
                });

                card.append(head, hint, appSel, actions, fileListWrap);
                return card;
            });

            grid.replaceChildren(...cards);
            updateMeter();
        };

        renderSlots();
        this._rerenderUploadedFiles = () => { renderSlots(); updateMeter(); };
    }

    // ---------- Save & Resume Later ----------
    setupSaveResume() {
        // Inject the modal HTML once
        if (!document.getElementById('saveResumeModal')) {
            const modal = document.createElement('div');
            modal.id = 'saveResumeModal';
            modal.className = 'save-resume-modal';
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-label', 'Save progress and resume later');
            this._setTrustedHtml(modal, `
                <div class="save-resume-card">
                    <h3><i class="fas fa-bookmark" style="color:var(--secondary);margin-right:8px;"></i><span data-i18n="saveResumeLater">Save &amp; Resume Later</span></h3>
                    <p data-i18n="saveResumeDesc">Enter your email and we'll send you a link to resume your application exactly where you left off.</p>
                    <p style="font-size:12px;color:#27ae60;margin:4px 0 0;"><i class="fas fa-check-circle"></i> Your progress is saved for 7 days. The link works on any device or browser.</p>
                    <div class="form-group">
                        <input type="email" id="resumeEmailInput" placeholder="your@email.com" autocomplete="email" />
                    </div>
                    <div class="save-resume-actions">
                        <button class="btn-send-link" id="sendResumeLinkBtn">
                            <i class="fas fa-paper-plane"></i> <span data-i18n="sendLink">Send Link</span>
                        </button>
                        <button class="btn-cancel-resume" id="cancelResumeBtn" data-i18n="cancel">Cancel</button>
                    </div>
                    <div class="save-resume-success" id="saveResumeSuccess">
                        <i class="fas fa-check-circle"></i> <span data-i18n="linkSent">Link sent! Check your inbox.</span>
                    </div>
                </div>`);
            document.body.appendChild(modal);
        }

        // Inject "Save & Resume" bar below each step's nav buttons
        document.querySelectorAll('.form-section').forEach(section => {
            if (section.querySelector('.save-resume-bar')) return;
            const bar = document.createElement('div');
            bar.className = 'save-resume-bar';
            this._setTrustedHtml(bar, `<button type="button" class="btn-save-resume save-resume-trigger">
                <i class="fas fa-bookmark"></i> <span data-i18n="saveResumeLater">Save &amp; Resume Later</span>
            </button>`);
            section.appendChild(bar);
        });

        // Open modal
        document.addEventListener('click', (e) => {
            if (e.target.matches('.save-resume-trigger') || e.target.closest('.save-resume-trigger')) {
                const emailField = document.getElementById('rentalApplication')?.querySelector('#email');
                const prefill = emailField ? emailField.value.trim() : '';
                const input = document.getElementById('resumeEmailInput');
                if (input && prefill && !input.value) input.value = prefill;
                document.getElementById('saveResumeModal').classList.add('open');
                const successEl = document.getElementById('saveResumeSuccess');
                if (successEl) successEl.classList.remove('show');
                if (input) input.focus();
            }
        });

        // Close modal
        document.getElementById('cancelResumeBtn')?.addEventListener('click', () => {
            document.getElementById('saveResumeModal').classList.remove('open');
        });
        document.getElementById('saveResumeModal')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
        });

        // Send link
        document.getElementById('sendResumeLinkBtn')?.addEventListener('click', async () => {
              const emailInput = document.getElementById('resumeEmailInput');
              const sendBtn = document.getElementById('sendResumeLinkBtn');
              const email = emailInput ? emailInput.value.trim() : '';
              if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                  emailInput.style.borderColor = '#e74c3c';
                  emailInput.focus();
                  return;
              }
              emailInput.style.borderColor = '';

              // Generate a unique token for this draft
              const token = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

              // Collect sanitized progress snapshot — NEVER store SSN or Government ID numbers in drafts
              this._syncCoApplicantsJson();
              await this.saveProgress();
              const rawData = this._buildSanitizedDraftPayload();
              const _urlP = new URLSearchParams(window.location.search);
              const propertyFingerprint = _urlP.get('id') || _urlP.get('addr') || '';
              rawData._documents = await this._collectDocumentsForDraft();

              // Build resume URL — includes the token so any device can retrieve the draft
              const currentParams = new URLSearchParams(window.location.search);
              currentParams.set('resume', token);
              const resumeUrl = window.location.origin + window.location.pathname + '?' + currentParams.toString();

              // Show loading state
              if (sendBtn) { sendBtn.disabled = true; this._setIconText(sendBtn, 'fas fa-spinner fa-spin', 'Sending…'); }

              // POST draft to backend — stores it in Supabase and sends the email
              let emailSent = false;
              try {
                  const backendBase = (window.CP_CONFIG && window.CP_CONFIG.SUPABASE_URL)
                      ? window.CP_CONFIG.SUPABASE_URL.replace(/\/$/, '') + '/functions/v1/save-draft'
                      : '';
                  if (backendBase) {
                      const res = await fetch(backendBase, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                              token,
                              email,
                              // resume_url is built server-side from the token (never trusted from client)
                              send_email: true,
                              data: rawData,
                              property_fingerprint: propertyFingerprint,
                          }),
                      });
                      if (res.ok) emailSent = true;
                  }
              } catch (err) {
                  console.warn('[CP App] save-draft request failed (non-fatal):', err);
              }

              if (sendBtn) { sendBtn.disabled = false; this._setIconText(sendBtn, 'fas fa-paper-plane', 'Send Link'); }

              const successEl = document.getElementById('saveResumeSuccess');
              if (successEl) {
                  this._setIconText(successEl, 'fas fa-check-circle', emailSent ? 'Link sent! Check your inbox.' : 'Progress saved on this device.');
                  successEl.classList.add('show');
              }
              setTimeout(() => {
                  document.getElementById('saveResumeModal').classList.remove('open');
                  if (successEl) successEl.classList.remove('show');
              }, 2800);
          });
    }

    setupCharacterCounters() {
        const textareas = document.querySelectorAll('textarea');
        textareas.forEach(textarea => {
            if (!textarea.hasAttribute('maxlength')) {
                textarea.setAttribute('maxlength', '500');
            }
            const parent = textarea.parentElement;
            const counter = document.createElement('div');
            counter.className = 'character-count';
            counter.style.fontSize = '11px';
            counter.style.textAlign = 'right';
            counter.style.color = '#7f8c8d';
            parent.appendChild(counter);
            const updateCounter = () => {
                const len = textarea.value.length;
                const max = textarea.getAttribute('maxlength');
                const tC = this.getTranslations();
                counter.textContent = `${len}/${max} ${tC.charCount}`;
            };
            textarea.addEventListener('input', updateCounter);
            updateCounter();
        });
    }

    // Show a compact inline banner above the form — used for friendly resume-link & draft-restored messages.
    _showResumeBanner(message, tone) {
        try {
            const existing = document.getElementById('resumeBanner');
            if (existing) existing.remove();
            const bg = tone === 'warn' ? '#fef3c7' : (tone === 'error' ? '#fee2e2' : '#dbeafe');
            const fg = tone === 'warn' ? '#92400e' : (tone === 'error' ? '#991b1b' : '#1e3a8a');
            const banner = document.createElement('div');
            banner.id = 'resumeBanner';
            banner.className = 'resume-banner' + (tone === 'warn' ? ' resume-banner--warn' : (tone === 'error' ? ' resume-banner--error' : ''));
            banner.setAttribute('role', 'status');
            banner.style.cssText = `position:relative;background:${bg};color:${fg};padding:12px 14px;font-size:13.5px;line-height:1.45;border-radius:12px;margin:0 0 16px;display:flex;gap:10px;align-items:flex-start;`;
            const icon = document.createElement('i');
            icon.className = (tone === 'error' ? 'fas fa-circle-exclamation' : 'fas fa-circle-info') + ' resume-banner-icon';
            icon.style.cssText = 'flex-shrink:0;margin-top:2px;';
            const text = document.createElement('div');
            text.className = 'resume-banner-text';
            text.style.cssText = 'flex:1 1 auto;min-width:0;';
            text.textContent = message;
            const close = document.createElement('button');
            close.type = 'button';
            close.className = 'resume-banner-close';
            close.setAttribute('aria-label', 'Dismiss');
            close.textContent = '×';
            close.style.cssText = `width:28px;min-width:28px;height:28px;flex-shrink:0;background:transparent;border:none;color:${fg};font-size:20px;cursor:pointer;line-height:1;padding:0;margin:-2px -4px 0 0;display:inline-flex;align-items:center;justify-content:center;`;
            close.addEventListener('click', () => banner.remove());
            banner.replaceChildren(icon, text, close);

            const form = document.getElementById('rentalApplication');
            const progressContainer = document.querySelector('.progress-container');
            const container = document.querySelector('.container');
            if (form && form.parentNode) {
                form.parentNode.insertBefore(banner, form);
            } else if (progressContainer && progressContainer.parentNode) {
                progressContainer.parentNode.insertBefore(banner, progressContainer.nextSibling);
            } else if (container) {
                container.insertBefore(banner, container.firstChild);
            } else {
                document.body.insertBefore(banner, document.body.firstChild);
            }
        } catch (_) { /* non-fatal */ }
    }


    // Restores saved progress using the resume token.
    // Fetches from the Supabase save-draft backend (cross-device), then falls
    // back to localStorage if the server is unreachable or the draft has expired.
    async _restoreFromServer(token) {
        let serverData = null;
        let tokenStatus = 'unknown'; // 'ok' | 'expired' | 'unreachable' | 'unknown'
        try {
            const backendBase = (window.CP_CONFIG && window.CP_CONFIG.SUPABASE_URL)
                ? window.CP_CONFIG.SUPABASE_URL.replace(/\/$/, '') + '/functions/v1/save-draft'
                : '';
            if (backendBase && token) {
                const res = await fetch(backendBase + '?token=' + encodeURIComponent(token));
                if (res.ok) {
                    const json = await res.json();
                    if (json.found && json.data && typeof json.data === 'object') {
                        serverData = json.data;
                        tokenStatus = 'ok';

                        // Show expiry warning if fewer than 24 hours remain.
                        const msRemaining = typeof json.ms_remaining === 'number' ? json.ms_remaining : null;
                        if (msRemaining !== null && msRemaining < 24 * 60 * 60 * 1000) {
                            const hoursLeft = Math.floor(msRemaining / (60 * 60 * 1000));
                            const minutesLeft = Math.floor((msRemaining % (60 * 60 * 1000)) / 60000);
                            const timeLabel = hoursLeft > 0
                                ? `${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}${minutesLeft > 0 ? ` ${minutesLeft} min` : ''}`
                                : `${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}`;
                            this._showResumeBanner(
                                `⚠️ Your saved draft expires in ${timeLabel}. Submit your application today to avoid losing your progress.`,
                                'warn'
                            );
                        }
                    } else {
                        tokenStatus = 'expired';
                    }
                } else if (res.status === 404 || res.status === 410) {
                    tokenStatus = 'expired';
                } else {
                    tokenStatus = 'unreachable';
                }
            }
        } catch (err) {
            tokenStatus = 'unreachable';
            console.warn('[CP App] Draft restore from server failed (falling back to localStorage):', err);
        }

        // Surface a friendly message when the resume link can't load the draft.
        if (!serverData) {
            const hasLocal = (() => {
                try { return !!localStorage.getItem('rentalApplicationDraft'); } catch (_) { return false; }
            })();
            if (tokenStatus === 'expired' && !hasLocal) {
                this._showResumeBanner('This save-and-resume link has expired (links are valid for 7 days). You can start a new application below — your information is not lost if it was on the same device.', 'warn');
            } else if (tokenStatus === 'unreachable' && !hasLocal) {
                this._showResumeBanner('We could not reach the server to load your saved progress. Check your connection and refresh, or start a new application below.', 'error');
            } else if (tokenStatus === 'expired' && hasLocal) {
                this._showResumeBanner('Your save-and-resume link has expired, but we found a saved draft on this device and have restored it.', 'info');
            }
        }

        if (serverData) {
            try {
                this._applyRestoredDraftData(serverData);
                try {
                    const sanitizedMirror = this._sanitizeObjectForStorage(serverData);
                    localStorage.setItem(this.config.LOCAL_STORAGE_KEY, JSON.stringify(sanitizedMirror));
                } catch(e) {}
            } catch (e) {
                console.warn('[CP App] Error applying server draft data:', e);
                this.restoreSavedProgress();
            }
        } else {
            this.restoreSavedProgress();
        }
    }

    _sanitizeObjectForStorage(rawObj) {
        const clone = { ...(rawObj || {}) };
        ['SSN', 'Application ID', 'Co-Applicant SSN', 'Government ID Number', 'Co-Applicant Government ID Number'].forEach(k => delete clone[k]);
        if (typeof clone._coApplicantsJson === 'string' && clone._coApplicantsJson.trim()) {
            try {
                const parsed = JSON.parse(clone._coApplicantsJson);
                if (Array.isArray(parsed)) {
                    const scrubbed = parsed.map(item => {
                        if (!item || typeof item !== 'object') return item;
                        const copy = { ...item };
                        delete copy.ssn;
                        delete copy.government_id_number;
                        return copy;
                    });
                    clone._coApplicantsJson = JSON.stringify(scrubbed);
                }
            } catch (_) {
                clone._coApplicantsJson = '[]';
            }
        }
        return clone;
    }

    _buildSanitizedDraftPayload() {
        this._syncCoApplicantsJson();
        const data = this._sanitizeObjectForStorage(this.getAllFormData());
        data._last_updated = new Date().toISOString();
        data._language = this.state.language || 'en';
        data._currentStep = this.getCurrentSection();
        const _urlP = new URLSearchParams(window.location.search);
        data._propertyFingerprint = _urlP.get('id') || _urlP.get('addr') || '';
        return data;
    }

    _applyRestoredDraftData(data) {
        const SKIP = new Set(['Application ID', 'SSN', 'Co-Applicant SSN', 'Government ID Number', '_last_updated', '_language', '_currentStep', '_propertyFingerprint', '_documents', '_coApplicantsJson']);
        const form = document.getElementById('rentalApplication');
        if (!form) return;

        Object.keys(data).forEach(key => {
            if (SKIP.has(key)) return;
            const value = data[key];
            if (value === undefined || value === null) return;
            const escaped = key.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            const els = form.querySelectorAll(`[name="${escaped}"]`);
            if (!els.length) return;
            const firstEl = els[0];
            if (firstEl.type === 'radio') {
                els.forEach(el => { if (el.value === value) el.checked = true; });
            } else if (firstEl.type === 'checkbox') {
                if (Array.isArray(value)) {
                    els.forEach(el => { el.checked = value.includes(el.value); });
                } else {
                    els.forEach(el => { el.checked = (el.value === value); });
                }
            } else {
                firstEl.value = value;
            }
        });

        // Rehydrate multi-applicant repeater if present
        if (typeof data._coApplicantsJson === 'string' && data._coApplicantsJson.trim()) {
            try {
                const list = JSON.parse(data._coApplicantsJson);
                if (Array.isArray(list) && list.length > 0) {
                    const cb = document.getElementById('hasCoApplicant');
                    const coSection = document.getElementById('coApplicantSection');
                    if (cb) cb.checked = true;
                    if (coSection) coSection.style.display = 'block';
                    this._hydrateCoApplicantsFromArray(list);
                }
            } catch (_) {}
        }

        if (data._language) this.state.language = data._language;
        if (data._currentStep && data._currentStep > 1) {
            const stepNum = parseInt(data._currentStep, 10);
            if (stepNum >= 1 && stepNum <= 6) {
                setTimeout(() => {
                    document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
                    const targetSection = document.getElementById('section' + stepNum);
                    if (targetSection) {
                        targetSection.classList.add('active');
                        this.updateProgressBar();
                        this._updateStartOverBtn(stepNum);
                        if (stepNum === 6) {
                            this._updateTotalFeeDisplay();
                            this._checkApplicationCredit();
                            this.generateApplicationSummary();
                        }
                    }
                }, 10);
            }
        }
        this._restoreDocumentsFromDraft(data._documents);
        if (typeof this._rerenderUploadedFiles === 'function') this._rerenderUploadedFiles();
        if (typeof this._syncPrimarySsnModeUi === 'function') this._syncPrimarySsnModeUi();
        if (typeof this._syncHousingStatusUi === 'function') {
            this._syncHousingStatusUi(document.getElementById('housingStatus')?.value || '');
        }
        if (typeof this._syncPriorResidenceVisibility === 'function') this._syncPriorResidenceVisibility();
        if (typeof this._syncPriorHousingStatusUi === 'function') {
            this._syncPriorHousingStatusUi(document.getElementById('previousHousingStatus')?.value || '');
        }
        if (typeof this._toggleEmployerSection === 'function') {
            this._toggleEmployerSection(document.getElementById('employmentStatus')?.value || '');
        }
        if (typeof this._syncTotalOccupantsUi === 'function') this._syncTotalOccupantsUi();
        if (typeof this._syncDisclosureExplanations === 'function') this._syncDisclosureExplanations();
        if (typeof this._syncPaymentMethodUi === 'function') this._syncPaymentMethodUi(false);
        this._updateTotalFeeDisplay();
        if (this._updateIncomeRatio) this._updateIncomeRatio();
        // Security reminder on draft restore if any basic applicant info was restored
        if (data['First Name'] || data['Email']) {
            this._showResumeBanner('Draft restored. For your security, SSNs and Government ID numbers are never stored in browser or server drafts — please re-enter SSNs before submitting.', 'info');
        }
    }

    restoreSavedProgress() {
        const saved = (() => { try { return localStorage.getItem(this.config.LOCAL_STORAGE_KEY); } catch(e) { return null; } })();
        if (saved) {
            try {
                const data = JSON.parse(saved);
                const _curP = new URLSearchParams(window.location.search);
                const _curFingerprint = _curP.get('id') || _curP.get('addr') || '';
                const _savedFingerprint = data._propertyFingerprint || '';
                if (_curFingerprint && _savedFingerprint && _curFingerprint !== _savedFingerprint) {
                    try { localStorage.removeItem(this.config.LOCAL_STORAGE_KEY); } catch(e) {}
                    return;
                }
                this._applyRestoredDraftData(data);
            } catch (e) { console.warn('[CP App] Non-critical error in restoreSavedProgress:', e); }
        }
    }

    async _encodeFileForDraft(file) {
        if (!file) return null;
        try {
            const buf = await file.arrayBuffer();
            const bytes = new Uint8Array(buf);
            let bin = '';
            const CHUNK = 0x8000;
            for (let i = 0; i < bytes.length; i += CHUNK) {
                bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
            }
            return {
                name: file.name,
                type: file.type || 'application/octet-stream',
                size: file.size,
                applicantIndex: typeof file._applicantIndex === 'number' ? file._applicantIndex : 0,
                docType: file._docType || 'government_id',
                base64: btoa(bin),
            };
        } catch (e) {
            console.warn('[CP App] Failed to encode draft document:', file?.name, e);
            return null;
        }
    }

    async _collectDocumentsForDraft() {
        // Binary file blobs are intentionally never stored in browser localStorage or save-draft payloads.
        return [];
    }

    _restoreDocumentsFromDraft(docs) {
        if (!Array.isArray(docs) || docs.length === 0) return;
        if (!this._uploadedFiles) this._uploadedFiles = [];
        for (const d of docs) {
            if (!d || typeof d.base64 !== 'string' || !d.name) continue;
            try {
                const bin = atob(d.base64);
                const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                const file = new File([bytes], d.name, {
                    type: d.type || 'application/octet-stream',
                });
                file._applicantIndex = typeof d.applicantIndex === 'number' ? d.applicantIndex : 0;
                file._docType = d.docType || 'government_id';
                if (!this._uploadedFiles.some(f => f.name === file.name)) {
                    this._uploadedFiles.push(file);
                }
            } catch (e) {
                console.warn('[CP App] Failed to decode draft document:', d.name, e);
            }
        }
        if (typeof this._rerenderUploadedFiles === 'function') {
            this._rerenderUploadedFiles();
        }
    }

    async saveProgress() {
        const data = this._buildSanitizedDraftPayload();
        try {
            data._documents = await this._collectDocumentsForDraft();
        } catch (_) {
            data._documents = [];
        }
        try { localStorage.setItem(this.config.LOCAL_STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
        this._flashAutoSave();
    }

    _flashAutoSave() {
        const indicator = document.getElementById('autoSaveIndicator');
        if (!indicator) return;
        clearTimeout(this._autoSaveFlashTimer);
        indicator.classList.add('visible');
        this._autoSaveFlashTimer = setTimeout(() => {
            indicator.classList.remove('visible');
        }, 2200);
    }

    getAllFormData() {
          const form = document.getElementById('rentalApplication');
          const formData = new FormData(form);
          const data = {};
          // [L1 fix] Collect duplicate keys (multi-checkboxes like Preferred Contact Method / Preferred Time) into arrays
          formData.forEach((value, key) => {
              if (Object.prototype.hasOwnProperty.call(data, key)) {
                  if (!Array.isArray(data[key])) data[key] = [data[key]];
                  data[key].push(value);
              } else {
                  data[key] = value;
              }
          });
          return data;
      }

    debounce(func, wait) {
        let timeout;
        return function() {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, arguments), wait);
        };
    }

    _parseLocalDate(dateStr) {
        if (!dateStr) return null;
        const parts = dateStr.split('-');
        if (parts.length !== 3) return null;
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return isNaN(d.getTime()) ? null : d;
    }

    // ---------- Language toggle ----------
    setupLanguageToggle() {
        const fee     = this.state.applicationFee;
        const freeApp = fee <= 0; // zero-fee: no payment step needed
        const translations = {
            en: {
                langText: 'Español',
                logoText: 'Choice Properties',
                tagline: 'Professional Property Management',
                confidentialStamp: 'CONFIDENTIAL & SECURE',
                trustIndicator: 'Your information is encrypted and protected',
                timeEstimate: 'Estimated time: 15–20 minutes',
                step1Label: 'Property & Applicant',
                step2Label: 'Residency & Occupancy',
                step3Label: 'Employment & Income',
                step4Label: 'Household & Co-Applicants',
                step5Label: 'Identity, Disclosures & Contacts',
                step6Label: 'Documents, Review & Submit',
                stepPrefix: 'Step',
                stepOf: 'of',
                processing: 'Processing',
                validating: 'Validating',
                submitting: 'Submitting',
                complete: 'Complete',
                submittingTitle: 'Submitting Application',
                submissionMessage: 'Do not close this window. Processing may take a few moments.',
                successTitle: 'Application Submitted',
                successText: 'Your rental application has been saved securely.',
                appId: 'Application Reference',
                clickToCopy: 'Copy Reference',
                immediateNextSteps: 'Next Steps',
                paymentRequiredTitle: freeApp ? 'No Application Fee Due' : 'Fee Coordination Within 24 Hours',
                paymentRequiredDesc: freeApp
                    ? 'Your application fee is waived. Your application is moving directly into screening review.'
                    : 'Your application is saved. Within 24 hours, our leasing team will contact you via your preferred method using your selected payment preference(s) to arrange the application fee.',
                completePaymentTitle: freeApp ? 'Application Submitted' : 'Payment & Screening Review',
                completePaymentDesc: freeApp
                    ? 'No fee payment is required. Screening reviews typically conclude within 24 to 48 hours.'
                    : 'Once your fee payment is confirmed, your application enters active screening — typically completed within 24 to 48 hours.',
                reviewBeginsTitle: 'Track Status Anytime',
                reviewBeginsDesc: 'Track your application status, selected payment preferences, and uploaded documents anytime using your Application ID in the Tenant Portal.',
                importantNote: 'Next Step:',
                paymentUrgentText: freeApp
                    ? 'No application fee is due for this submission. Open your Tenant Portal anytime to track review progress.'
                    : `No payment is charged online yet. Within 24 hours, our team will contact you to arrange your $${fee} application fee using your selected payment preference(s).`,
                yourPreferences: 'Contact & Payment Preferences',
                contactMethod: 'Contact Method:',
                bestTimes: 'Preferred Hours:',
                selectedPayPrefs: 'Selected Payment Preferences',
                primaryPayShort: '1st Choice (Primary)',
                altPayShort: '2nd Choice (Alternative)',
                thirdPayShort: '3rd Choice (Backup)',
                preferenceNote: 'These preferences will be used for post-submission fee coordination and updates.',
                questions: 'For assistance, contact',
                helpText: 'support or call 707-706-3137.',
                spamWarning: '📧 A confirmation has been sent to the email address provided. If not received within a few minutes, check your <strong>spam or junk folder</strong>.',
                trackStatus: 'Open Tenant Portal',
                browseListings: 'Browse Available Listings',
                newApplication: 'Submit New Application',
                reapplicationPolicyTitle: 'Reapplication Protection',
                reapplicationPolicyText: 'If denied after payment, applicants receive application credits covering the fee on a future application for 30 days. See our Application Credit Policy.',
                step1YouSubmit: '1. Application Submitted',
                step1Desc: 'Complete and submit this application in full.',
                step2PaymentArranged: freeApp ? '2. Application Received' : '2. Fee Coordination',
                step2Desc: freeApp ? 'No fee required. Application enters review immediately.' : 'Our team contacts you within 24 hours via your preferred method to coordinate payment.',
                step3ReviewBegins: '3. Screening & Review',
                step3Desc: freeApp ? 'Typically completed within 24–48 hours.' : 'Typically completed within 24–48 hours of fee confirmation.',
                propertyHeader: 'Property Confirmation & Primary Applicant',
                propertyInfo: 'Property Information',
                propertyAddressLabel: 'Property Address Applying For',
                propertyAddressPlaceholder: 'Street address, city, state, zip',
                errAddress: 'Property address is required.',
                moveInLabel: 'Requested Move-in Date',
                errRequired: 'Required',
                leaseTermLabel: 'Desired Lease Term',
                selectTerm: 'Select term...',
                months6: '6 Months',
                months12: '12 Months',
                months18: '18 Months',
                months24: '24 Months',
                monthToMonth: 'Month-to-month',
                primaryApplicantInfo: 'Primary Applicant Information',
                firstNameLabel: 'First Name',
                middleNameLabel: 'Middle Name (Optional)',
                lastNameLabel: 'Last Name',
                emailLabel: 'Email Address',
                emailPlaceholder: 'email@example.com',
                emailHint: 'Used for application confirmations, credit lookup, and portal updates.',
                errEmail: 'Invalid format',
                phoneLabel: 'Phone Number',
                phonePlaceholder: '(555) 000-0000',
                phoneHint: 'Used for application-related contact and fee coordination. You may receive text messages about your application — see SMS consent on the final step.',
                secondaryPhoneLabel: 'Secondary Phone (Optional)',
                secondaryPhoneHint: 'Optional backup number (work or alternate mobile).',
                errPhone: 'Invalid format',
                dobLabel: 'Date of Birth (18+)',
                householdStepHeader: 'Household Members & Financial Supporters',
                 householdStepIntro: 'Every adult (18+) who will reside at the property or act as a guarantor/co-signer must be listed here ($50 per adult applicant, co-applicant, guarantor, or co-signer). If you are applying alone, simply confirm below and continue.',
                identityDisclosuresHeader: 'Identity, Disclosures & Contacts',
                identityVerificationHeading: 'Identity Verification',
                ssnModeLabel: 'Select Verification Method',
                ssnModeLast4Title: 'Last 4 Digits of SSN (Recommended)',
                ssnModeLast4Desc: 'Enter only the last 4 digits of your Social Security Number (XXXX) for identity verification.',
                ssnModeAltTitle: 'Alternative Verification (No SSN)',
                ssnModeAltDesc: 'Use ITIN, Passport, Driver\'s License, or Visa documentation instead of an SSN.',
                ssnLabel: 'Social Security Number (Last 4 Digits)',
                ssnHint: 'Last 4 digits only (XXXX) — never stored in browser or server drafts',
                ssnPlaceholder: '1234',
                govIdTypeLabel: 'Government ID Type (Optional)',
                govIdNumberLabel: 'Government ID Number (Optional)',
                coApplicantCheckbox: 'Include additional adult applicant(s), guarantor(s), or co-signer(s)',
                coApplicantSectionHint: 'Add all adults (18+) who will reside in the home or provide financial support ($50 application fee per person). For each person, choose whether you enter their details & authorize screening on their behalf now (Method A — no private link sent to them) or send them a private email link to finish their own details & consent (Method B).',
                addAnotherApplicant: 'Add Another Co-Applicant / Guarantor / Co-Signer',
                coApplicantInfo: 'Additional Household Member / Supporter',
                coRoleLabel: 'Role Classification',
                roleCoApplicant: 'Co-Applicant (Occupying Adult)',
                roleGuarantor: 'Guarantor (Non-Occupying Financial Support)',
                roleCoSigner: 'Co-Signer (Financial Support)',
                coMethodLabel: 'Information Submission Method',
                methodATitle: 'Method A: Primary enters & authorizes now',
                methodADesc: 'You complete their details and authorize screening on their behalf right here — no private link or involvement required from them.',
                methodBTitle: 'Method B: Send private self-complete link',
                methodBDesc: 'Enter only Name, Email, Phone & Role. They complete sensitive details & upload docs privately.',
                coFirstNameLabel: 'First Name',
                coLastNameLabel: 'Last Name',
                coEmailLabel: 'Email Address',
                coPhoneLabel: 'Phone Number',
                coDobLabel: 'Date of Birth (18+)',
                coSsnLabel: 'SSN (Last 4 Digits)',
                employmentIncome: 'Employment & Income',
                coEmployerLabel: 'Employer / Business',
                coJobTitleLabel: 'Position / Job Title',
                coMonthlyIncomeLabel: 'Gross Monthly Income ($)',
                coMonthlyIncomePlaceholder: 'e.g., 4000',
                coEmploymentDurationLabel: 'Duration of Employment',
                coEmploymentDurationPlaceholder: 'e.g., 2 years',
                coConsentLabelMethodA: 'I certify that I have this person’s explicit permission and legal authority to submit their personal, SSN, and financial details, and I directly authorize Choice Properties and its consumer reporting agencies to conduct credit, background, eviction, and income screening checks on their behalf (no private link or action from them is required).',
                coConsentLabelMethodB: 'I confirm this person has agreed to be added to this rental application and understand they will receive a private link to complete their details and sign their own screening consent.',
                coConsentLabel: 'I certify that I have this person’s explicit permission and legal authority to submit their personal, SSN, and financial details, and I directly authorize Choice Properties and its consumer reporting agencies to conduct credit, background, eviction, and income screening checks on their behalf (no private link or action from them is required).',
                contactPrefsHeader: 'Contact Preferences',
                prefContactMethod: 'Preferred Contact Method',
                contactMethodText: 'SMS / Text',
                contactMethodEmail: 'Email',
                contactMethodHint: 'Select one or both.',
                availabilityLabel: 'Preferred Contact Hours',
                weekdays: 'Weekdays',
                timeMorning: 'Morning (8:00 AM – 11:00 AM)',
                timeMidday: 'Midday (11:00 AM – 2:00 PM)',
                timeAfternoon: 'Afternoon (2:00 PM – 5:00 PM)',
                eveningsWeekends: 'Evenings & Weekends',
                timeEarlyEvening: 'Early Evening (5:00 PM – 8:00 PM)',
                timeLateEvening: 'Late Evening (8:00 PM – 10:00 PM)',
                timeWeekend: 'Weekend',
                flexible: 'Flexible',
                timeAnytime: 'No preference',
                additionalNotesLabel: 'Additional Notes (Optional)',
                additionalNotesPlaceholder: 'e.g., Available after 7:00 PM, unavailable Wednesdays',
                preferencesNote: '',
                nextStep: 'Continue',
                prevStep: 'Back',
                editSection: 'Edit',
                residencyHeader: 'Residency History & Occupancy',
                currentResidence: 'Current Residence',
                currentAddressLabel: 'Current Address',
                currentAddressPlaceholder: 'Street, Unit #, City, State, Zip',
                residencyStartLabel: 'Duration at Current Address',
                residencyStartPlaceholder: 'e.g., 2 years 3 months',
                rentAmountLabel: 'Current Monthly Rent / Mortgage',
                rentAmountPlaceholder: '$',
                reasonLeavingLabel: 'Reason for Vacating',
                landlordNameLabel: 'Current Landlord / Property Manager',
                landlordPhoneLabel: 'Landlord / Property Manager Phone',
                occupantsPets: 'Occupants & Pets',
                totalOccupantsLabel: 'Total Number of Occupants (including children)',
                occupantNamesLabel: 'Names and Ages of Additional Occupants',
                occupantNamesPlaceholder: 'Name, age, relationship (e.g., Jane Doe, 7, daughter)',
                hasPetsLabel: 'Pets',
                yes: 'Yes',
                no: 'No',
                petDetailsLabel: 'Pet Description (type, breed, weight)',
                petDetailsPlaceholder: 'Provide details for each pet.',
                vehicleInfo: 'Vehicle Information',
                hasVehicleLabel: 'Vehicle',
                vehicleMakeLabel: 'Make',
                vehicleModelLabel: 'Model',
                vehicleYearLabel: 'Year',
                vehicleYearPlaceholder: 'e.g., 2020',
                vehiclePlateLabel: 'License Plate (Optional)',
                employmentHeader: 'Employment & Income Information',
                currentEmployment: 'Employment Details',
                employmentStatusLabel: 'Employment Status',
                selectStatus: 'Select status...',
                fullTime: 'Full-Time',
                partTime: 'Part-Time',
                selfEmployed: 'Self-Employed',
                student: 'Student',
                retired: 'Retired',
                unemployed: 'Unemployed',
                employerLabel: 'Employer',
                jobTitleLabel: 'Position / Title',
                employmentDurationLabel: 'Duration of Employment',
                employmentDurationPlaceholder: 'e.g., 3 years',
                supervisorNameLabel: 'Direct Supervisor',
                supervisorPhoneLabel: 'Supervisor Contact Number',
                incomeVerification: 'Income Verification',
                monthlyIncomeLabel: 'Gross Monthly Income',
                monthlyIncomePlaceholder: 'e.g., 3500',
                incomeHint: 'Pre-tax gross income',
                otherIncomeLabel: 'Supplemental Monthly Income (Optional)',
                otherIncomePlaceholder: '$',
                otherIncomeHint: 'Supplemental sources (e.g., disability, support payments)',
                financialHeader: 'References & Emergency Contact',
                personalReferences: 'Personal References',
                referencesHint: 'Provide two references who are not family members.',
                ref1NameLabel: 'Reference 1 — Full Name',
                ref1PhoneLabel: 'Reference 1 — Phone',
                ref2NameLabel: 'Reference 2 — Full Name (Optional)',
                ref2PhoneLabel: 'Reference 2 — Phone (Optional)',
                emergencyInfo: 'Emergency Contact',
                emergencyNameLabel: 'Emergency Contact Name',
                emergencyPhoneLabel: 'Emergency Contact Phone',
                emergencyRelationshipLabel: 'Relationship to Applicant',
                emergencyRelationshipPlaceholder: 'e.g., Spouse, Parent, Sibling',
                additionalInfo: 'Disclosure Questions',
                evictedLabel: 'Prior Eviction History',
                smokerLabel: 'Tobacco / Smoking Use',
                paymentHeader: 'Contact & Availability',
                housingStatusLabel: 'Current Housing Status',
                previousHousingStatusLabel: 'Previous Housing Status',
                selectHousingStatus: 'Select status...',
                housingRent: 'Rent',
                housingOwn: 'Own (No Mortgage)',
                housingMortgage: 'Own (With Mortgage)',
                housingFamily: 'Living with Family / Friends',
                housingOther: 'Other',
                lessThan2YearsLabel: 'Lived here less than 24 months (add prior address)',
                priorResidenceTitle: 'Previous Residence (Required when less than 24 months at current address)',
                previousAddressLabel: 'Previous Street Address',
                previousDurationLabel: 'Duration at Previous Address',
                previousLandlordLabel: 'Previous Landlord / Manager Name',
                previousLandlordPhoneLabel: 'Previous Landlord Phone',
                employerAddressLabel: 'Employer / Business Address (Optional)',
                employerAddressPlaceholder: 'Street, City, State, Zip',
                employmentStartDateLabel: 'Start Date (Optional)',
                bankruptcyLabel: 'Any bankruptcy filings in the past 7 years?',
                criminalLabel: 'Any felony or relevant criminal history?',
                bankruptcyExplainLabel: 'Bankruptcy Explanation & Discharge Status',
                criminalExplainLabel: 'Criminal History Explanation & Date',
                preferencesNote: '',
                paymentPrefsHeader: 'Application Fee Payment Preferences',
                paymentPrefsIntro: 'Select your preferred payment method(s) for the application fee below. We do not charge a card on this form — once submitted, our leasing team will contact you within 24 hours to coordinate fee payment safely using your chosen method.',
                paymentPrefsImportant: 'Application fee is $50 per adult applicant, co-applicant, guarantor, or co-signer.',
                paymentPrimaryBadge: 'Required — 1st Choice',
                paymentPrimaryTitle: 'Primary Payment Method',
                paymentPrimarySub: 'Choose the payment app or method you prefer to use first.',
                primaryPayLabel: 'Preferred Primary Payment Method',
                selectPayOption: 'Select a payment method...',
                selectPayOptionOptional: 'None / Optional...',
                payOptionOther: 'Other (please specify)',
                paymentOtherSpecifyLabel: 'Please specify payment method',
                paymentAltBadge: 'Optional — 2nd Choice',
                paymentAltTitle: 'Alternative / Backup Payment Method',
                paymentAltSub: 'Helpful if your primary app has transfer limits or temporary issues.',
                altPayLabel: 'Secondary Payment Method (Optional)',
                paymentThirdBadge: 'Optional — 3rd Choice',
                paymentThirdTitle: 'Third Choice Payment Method',
                paymentThirdSub: 'Provide one more backup option if needed.',
                thirdPayLabel: 'Third Choice Payment Method (Optional)',
                paymentDupWarn: 'You selected the same payment method more than once. Consider picking a different backup method in case one option is unavailable.',
                paymentReminderTitle: 'No Payment Charged Now',
                paymentReminderDesc: 'You will not be asked for card or bank credentials on this form. Within 24 hours of submission, our team reaches out via your preferred contact method to arrange fee payment.',
                reviewHeader: 'Documents, Review & Submit',
                feeTitle: 'Application Fee: $50.00',
                feeDesc: 'Required before screening begins ($50 per adult applicant, co-applicant, guarantor, or co-signer). Within 24 hours of submitting, our team will contact you via your preferred method to coordinate payment.',
                reapplicationPolicyTextShort: 'If denied after payment, you receive application credits covering the fee on a future application for 30 days.',
                summaryPropertyApplicant: 'Property & Primary Applicant',
                summaryCoApplicant: 'Household Members & Supporters',
                summaryResidency: 'Residency History',
                summaryOccupancy: 'Occupants, Pets & Vehicles',
                summaryEmployment: 'Employment & Income',
                summaryFinancial: 'Identity, Disclosures, References & Emergency',
                summaryPayment: 'Contact & Payment Preferences',
                uploadTitle: 'Supporting Documents',
                uploadOptional: '(Optional Now — Upload Here or Later in Portal)',
                uploadDesc: 'Attach photos or PDFs below to speed up screening, or submit now and upload anytime in the Tenant Portal without losing your place. <strong>Accepted:</strong> PDF, JPG, PNG, WebP · Up to 10 MB per file (camera photos are automatically compressed). Stored privately via HTTPS in Choice Properties Storage — see our <a href="/privacy.html" target="_blank" rel="noopener" style="color:var(--primary);">Privacy Policy</a>.',
                trustLine: 'Application data is encrypted in transit via HTTPS; only the last 4 digits of SSN are collected (never full 9-digit SSNs).',
                feeAcknowledge: 'I acknowledge the application fee policy and consent to my personal information being reviewed by Choice Properties staff and the property owner solely for rental application screening. The application fee is <strong>non-refundable once payment has been completed</strong>, except as provided in the <a href="/application-credit-policy.html" target="_blank" rel="noopener" style="color:var(--primary);">Application Credit Policy</a>.',
                agreeTermsPrivacy: 'I have read and agree to the <a href="/terms.html" target="_blank" rel="noopener" style="color:var(--primary);">Terms of Service</a> (including the <strong>binding arbitration clause</strong> and <strong>class action waiver</strong> in Sections 18–19), the <a href="/privacy.html" target="_blank" rel="noopener" style="color:var(--primary);">Privacy Policy</a>, and the <a href="/policies.html" target="_blank" rel="noopener" style="color:var(--primary);">Complete Policy &amp; Legal Framework</a>. I confirm I am at least 18 years of age and have legal capacity to enter into this agreement.',
                smsConsent: 'I expressly consent to receive transactional SMS messages from Choice Properties at the mobile number provided, regarding application status, payment confirmations, lease execution, and move-in scheduling. Message frequency varies. <strong>Message and data rates may apply.</strong> Reply HELP for assistance, STOP to opt out at any time. SMS consent is not a condition of application — leave unchecked to receive communications by email only.',
                footerCopyright: '&copy; 2026 Choice Properties. All rights reserved.',
                startOver: 'Start Over',
                startOverTitle: 'Discard Application?',
                startOverDesc: 'All entered information will be permanently cleared. You will be returned to Step 1.',
                keepInfo: 'Continue Application',
                yesStartOver: 'Discard & Restart',
                minLeaseHintPre: 'Minimum lease term:',
                minLeaseHintPost: 'months. Please select a qualifying term.'
            },
            es: {
                langText: 'English',
                logoText: 'Choice Properties',
                tagline: 'Soluciones Profesionales de Administración de Propiedades',
                confidentialStamp: 'CONFIDENCIAL & SEGURO',
                trustIndicator: 'Su información está encriptada y protegida',
                timeEstimate: 'Tiempo estimado: 15-20 minutos',
                step1Label: 'Propiedad y Solicitante',
                step2Label: 'Residencia y Ocupación',
                step3Label: 'Empleo e Ingresos',
                step4Label: 'Hogar y Co-Solicitantes',
                step5Label: 'Identidad, Divulgaciones y Contactos',
                step6Label: 'Documentos, Revisión y Envío',
                stepPrefix: 'Paso',
                stepOf: 'de',
                processing: 'Procesando',
                validating: 'Validando',
                submitting: 'Enviando',
                complete: 'Completo',
                submittingTitle: 'Enviando su Solicitud',
                submissionMessage: 'Por favor no cierre esta ventana. Puede tomar unos momentos...',
                successTitle: 'Solicitud Enviada',
                successText: 'Su solicitud de arrendamiento se ha guardado de forma segura.',
                appId: 'Referencia de Solicitud',
                clickToCopy: 'Copiar Referencia',
                immediateNextSteps: 'Próximos Pasos',
                paymentRequiredTitle: freeApp ? 'Sin Tarifa Pendiente' : 'Coordinación de Tarifa en 24 Horas',
                paymentRequiredDesc: freeApp
                    ? 'Su tarifa de solicitud ha sido exonerada. Su solicitud entra directamente a revisión.'
                    : 'Su solicitud se ha guardado. Dentro de 24 horas, nuestro equipo se comunicará por su método preferido usando sus preferencias de pago seleccionadas.',
                completePaymentTitle: freeApp ? 'Solicitud Enviada' : 'Pago y Revisión de Solicitud',
                completePaymentDesc: freeApp
                    ? 'No se requiere pago. La revisión suele completarse en 24 a 48 horas.'
                    : 'Una vez confirmado su pago, su solicitud entra en evaluación activa — normalmente completada en 24 a 48 horas.',
                reviewBeginsTitle: 'Consulte su Estado en Línea',
                reviewBeginsDesc: 'Consulte el estado de su solicitud, preferencias de pago y documentos en cualquier momento usando su Referencia en el Portal del Inquilino.',
                importantNote: 'Siguiente Paso:',
                paymentUrgentText: freeApp
                    ? 'No hay saldo pendiente para esta solicitud. Puede abrir su Portal del Inquilino en cualquier momento.'
                    : `No se realiza ningún cobro en línea ahora. Dentro de 24 horas nuestro equipo le contactará para coordinar la tarifa de $${fee} con su método de pago elegido.`,
                yourPreferences: 'Preferencias de Contacto y Pago',
                contactMethod: 'Método de Contacto:',
                bestTimes: 'Horario Preferido:',
                selectedPayPrefs: 'Métodos de Pago Seleccionados',
                primaryPayShort: '1.ª Opción (Principal)',
                altPayShort: '2.ª Opción (Alternativo)',
                thirdPayShort: '3.ª Opción (Respaldo)',
                preferenceNote: 'Estas preferencias se usarán para coordinar el pago y actualizaciones de su solicitud.',
                questions: 'Para asistencia, contacte',
                helpText: 'soporte o llame al 707-706-3137.',
                spamWarning: '📧 Se ha enviado una confirmación al correo electrónico proporcionado. Si no lo recibe en unos minutos, revise su carpeta de <strong>spam o correo no deseado</strong>.',
                trackStatus: 'Abrir Portal del Inquilino',
                browseListings: 'Explorar Propiedades Disponibles',
                newApplication: 'Enviar Nueva Solicitud',
                reapplicationPolicyTitle: 'Protección de Reaplicación',
                reapplicationPolicyText: 'En caso de denegación tras el pago, recibirá créditos aplicables a otra solicitud durante 30 días. Consulte nuestra Política de Crédito de Solicitud.',
                step1YouSubmit: '1. Solicitud Enviada',
                step1Desc: 'Complete y envíe esta solicitud en su totalidad.',
                step2PaymentArranged: freeApp ? '2. Solicitud Recibida' : '2. Coordinación de Tarifa',
                step2Desc: freeApp ? 'Sin tarifa. La solicitud entra en revisión de inmediato.' : 'Nuestro equipo se comunicará dentro de 24 horas para coordinar el pago.',
                step3ReviewBegins: '3. Verificación y Revisión',
                step3Desc: freeApp ? 'Generalmente concluye en 24–48 horas.' : 'Generalmente concluye en 24–48 horas tras la confirmación del pago.',
                propertyHeader: 'Confirmación de Propiedad y Solicitante Principal',
                propertyInfo: 'Información de la Propiedad',
                propertyAddressLabel: 'Dirección de la Propiedad',
                propertyAddressPlaceholder: 'Calle, ciudad, estado, código postal',
                errAddress: 'La dirección de la propiedad es obligatoria.',
                moveInLabel: 'Fecha de Mudanza Solicitada',
                errRequired: 'Obligatorio',
                leaseTermLabel: 'Plazo de Arrendamiento Deseado',
                selectTerm: 'Seleccionar plazo...',
                months6: '6 Meses',
                months12: '12 Meses',
                months18: '18 Meses',
                months24: '24 Meses',
                monthToMonth: 'Mes a mes',
                primaryApplicantInfo: 'Solicitante Principal',
                firstNameLabel: 'Nombre',
                middleNameLabel: 'Segundo Nombre (Opcional)',
                lastNameLabel: 'Apellido',
                emailLabel: 'Correo Electrónico',
                emailPlaceholder: 'email@ejemplo.com',
                emailHint: 'Usado para confirmaciones, consulta de créditos y actualizaciones del portal.',
                errEmail: 'Formato inválido',
                phoneLabel: 'Número de Teléfono',
                phonePlaceholder: '(555) 000-0000',
                phoneHint: 'Usado para contacto relacionado con la solicitud y coordinación de tarifas. Puede recibir mensajes de texto sobre su solicitud — consulte el consentimiento de SMS en el paso final.',
                secondaryPhoneLabel: 'Teléfono Secundario (Opcional)',
                secondaryPhoneHint: 'Número de respaldo opcional (trabajo o móvil alterno).',
                errPhone: 'Formato inválido',
                dobLabel: 'Fecha de Nacimiento (18+)',
                householdStepHeader: 'Miembros del Hogar y Respaldos Financieros',
                householdStepIntro: 'Todo adulto (18+) que resida en la vivienda o actúe como garante/co-firmante debe incluirse aquí ($50 Solicitante Principal; el 1.er Co-Solicitante ocupante es $0 Gratis; $50 por cada Co-Solicitante adicional, Garante o Co-Firmante). Si aplica solo, continúe.',
                identityDisclosuresHeader: 'Identidad, Divulgaciones y Contactos',
                identityVerificationHeading: 'Verificación de Identidad',
                ssnModeLabel: 'Seleccione Método de Verificación',
                ssnModeLast4Title: 'Últimos 4 Dígitos del SSN (Recomendado)',
                ssnModeLast4Desc: 'Ingrese solo los últimos 4 dígitos de su Número de Seguro Social (XXXX) para verificar su identidad.',
                ssnModeAltTitle: 'Verificación Alternativa (Sin SSN)',
                ssnModeAltDesc: 'Use ITIN, Pasaporte, Licencia o Visa en lugar de SSN.',
                ssnLabel: 'Número de Seguro Social (Últimos 4 Dígitos)',
                ssnHint: 'Últimos 4 dígitos únicamente (XXXX) — nunca se guardan en borradores del navegador o servidor',
                ssnPlaceholder: '1234',
                govIdTypeLabel: 'Tipo de Identificación Oficial (Opcional)',
                govIdNumberLabel: 'Número de Identificación Oficial (Opcional)',
                coApplicantCheckbox: 'Incluir co-solicitante(s), garante(s) o co-firmante(s) adultos adicionales',
                coApplicantSectionHint: 'Agregue a todos los adultos (18+) que residirán en la vivienda (Co-Solicitantes — el 1.er Co-Solicitante ocupante es $0 Gratis) o brindarán respaldo financiero (Garantes / Co-Firmantes — $50 cada uno). Para cada persona, elija si ingresa sus datos y autoriza la evaluación en su nombre ahora (Método A — sin enviar enlace privado) o si le envía un enlace privado por correo para completar sus propios datos y consentimiento (Método B).',
                addAnotherApplicant: 'Agregar Otro Co-Solicitante / Garante / Co-Firmante',
                coApplicantInfo: 'Miembro Adicional / Respaldo Financiero',
                coRoleLabel: 'Clasificación de Rol',
                roleCoApplicant: 'Co-Solicitante (Adulto Ocupante)',
                roleGuarantor: 'Garante (Apoyo Financiero No Ocupante)',
                roleCoSigner: 'Co-Firmante (Apoyo Financiero)',
                coMethodLabel: 'Método de Envío de Información',
                methodATitle: 'Método A: El principal ingresa y autoriza ahora',
                methodADesc: 'Usted completa sus datos y autoriza la evaluación en su nombre aquí mismo — no se enviará enlace privado ni deberán intervenir.',
                methodBTitle: 'Método B: Enviar enlace privado para autocompletar',
                methodBDesc: 'Ingrese solo Nombre, Correo, Teléfono y Rol. Ellos completan datos sensibles y documentos en privado.',
                coFirstNameLabel: 'Nombre',
                coLastNameLabel: 'Apellido',
                coEmailLabel: 'Correo Electrónico',
                coPhoneLabel: 'Teléfono',
                coDobLabel: 'Fecha de Nacimiento (18+)',
                coSsnLabel: 'SSN (Últimos 4 Dígitos)',
                employmentIncome: 'Empleo e Ingresos',
                coEmployerLabel: 'Empleador / Negocio',
                coJobTitleLabel: 'Puesto / Cargo',
                coMonthlyIncomeLabel: 'Ingreso Mensual Bruto ($)',
                coMonthlyIncomePlaceholder: 'ej., 4000',
                coEmploymentDurationLabel: 'Tiempo en el empleo',
                coEmploymentDurationPlaceholder: 'ej., 2 años',
                coConsentLabelMethodA: 'Certifico que cuento con el permiso expreso y la autoridad legal de esta persona para enviar sus datos personales, SSN e ingresos, y autorizo directamente a Choice Properties y a sus agencias de informes al consumidor a realizar verificaciones de crédito, antecedentes, desalojos e ingresos en su nombre (sin requerir enlace privado ni acción de su parte).',
                coConsentLabelMethodB: 'Confirmo que esta persona aceptó ser incluida en esta solicitud y entiendo que recibirá un enlace privado para completar sus datos y autorizar su propia verificación.',
                coConsentLabel: 'Certifico que cuento con el permiso expreso y la autoridad legal de esta persona para enviar sus datos personales, SSN e ingresos, y autorizo directamente a Choice Properties y a sus agencias de informes al consumidor a realizar verificaciones de crédito, antecedentes, desalojos e ingresos en su nombre (sin requerir enlace privado ni acción de su parte).',
                contactPrefsHeader: 'Preferencias de Contacto',
                prefContactMethod: 'Método de Contacto Preferido',
                contactMethodText: 'SMS / Texto',
                contactMethodEmail: 'Correo Electrónico',
                contactMethodHint: 'Seleccione uno o ambos.',
                availabilityLabel: 'Horario de Contacto Preferido',
                weekdays: 'Días de semana',
                timeMorning: 'Mañana (8am-11am)',
                timeMidday: 'Mediodía (11am-2pm)',
                timeAfternoon: 'Tarde (2pm-5pm)',
                eveningsWeekends: 'Tardes y Fines de Semana',
                timeEarlyEvening: 'Temprano en la tarde (5pm-8pm)',
                timeLateEvening: 'Tarde noche (8pm-10pm)',
                timeWeekend: 'Fin de semana',
                flexible: 'Flexible',
                timeAnytime: 'Sin preferencia',
                additionalNotesLabel: 'Notas Adicionales (Opcional)',
                additionalNotesPlaceholder: 'ej., Disponible después de las 7:00 PM, no disponible los miércoles',
                preferencesNote: '',
                nextStep: 'Continuar',
                prevStep: 'Atrás',
                editSection: 'Editar',
                residencyHeader: 'Historial de Residencia y Ocupación',
                currentResidence: 'Residencia Actual',
                currentAddressLabel: 'Dirección Actual',
                currentAddressPlaceholder: 'Calle, Número, Ciudad, Estado, Código Postal',
                residencyStartLabel: 'Duración en la Dirección Actual',
                residencyStartPlaceholder: 'ej., 2 años 3 meses',
                rentAmountLabel: 'Renta / Hipoteca Mensual Actual',
                rentAmountPlaceholder: '$',
                reasonLeavingLabel: 'Motivo de Desocupación',
                landlordNameLabel: 'Propietario / Administrador Actual',
                landlordPhoneLabel: 'Teléfono del Propietario / Administrador',
                occupantsPets: 'Ocupantes y Mascotas',
                totalOccupantsLabel: 'Número Total de Ocupantes (incluyendo niños)',
                occupantNamesLabel: 'Nombres y Edades de Ocupantes Adicionales',
                occupantNamesPlaceholder: 'Nombre, edad, relación (ej., Juan Pérez, 7, hijo)',
                hasPetsLabel: 'Mascotas',
                yes: 'Sí',
                no: 'No',
                petDetailsLabel: 'Descripción de Mascotas (tipo, raza, peso)',
                petDetailsPlaceholder: 'Proporcione detalles de cada mascota.',
                vehicleInfo: 'Información del Vehículo',
                hasVehicleLabel: 'Vehículo',
                vehicleMakeLabel: 'Marca',
                vehicleModelLabel: 'Modelo',
                vehicleYearLabel: 'Año',
                vehicleYearPlaceholder: 'ej., 2020',
                vehiclePlateLabel: 'Placa (Opcional)',
                employmentHeader: 'Información de Empleo e Ingresos',
                currentEmployment: 'Detalles de Empleo',
                employmentStatusLabel: 'Estado de Empleo',
                selectStatus: 'Seleccionar estado...',
                fullTime: 'Tiempo completo',
                partTime: 'Medio tiempo',
                selfEmployed: 'Trabajador independiente',
                student: 'Estudiante',
                retired: 'Jubilado',
                unemployed: 'Desempleado',
                employerLabel: 'Empleador',
                jobTitleLabel: 'Puesto',
                employmentDurationLabel: 'Duración del Empleo',
                employmentDurationPlaceholder: 'ej., 3 años',
                supervisorNameLabel: 'Supervisor Directo',
                supervisorPhoneLabel: 'Número de Contacto del Supervisor',
                incomeVerification: 'Verificación de Ingresos',
                monthlyIncomeLabel: 'Ingreso Mensual Bruto',
                monthlyIncomePlaceholder: '$',
                incomeHint: 'Ingreso bruto antes de impuestos',
                otherIncomeLabel: 'Ingresos Suplementarios Mensuales (Opcional)',
                otherIncomePlaceholder: '$',
                otherIncomeHint: 'Fuentes suplementarias (ej., discapacidad, pensión)',
                financialHeader: 'Referencias y Contacto de Emergencia',
                personalReferences: 'Referencias Personales',
                referencesHint: 'Proporcione dos referencias que no sean familiares.',
                ref1NameLabel: 'Nombre de Referencia 1',
                ref1PhoneLabel: 'Teléfono de Referencia 1',
                ref2NameLabel: 'Nombre de Referencia 2 (Opcional)',
                ref2PhoneLabel: 'Teléfono de Referencia 2 (Opcional)',
                emergencyInfo: 'Contacto de Emergencia',
                emergencyNameLabel: 'Nombre de Contacto de Emergencia',
                emergencyPhoneLabel: 'Teléfono de Contacto de Emergencia',
                emergencyRelationshipLabel: 'Relación con el Solicitante',
                emergencyRelationshipPlaceholder: 'ej., Cónyuge, Padre, Hermano/a',
                additionalInfo: 'Preguntas de Divulgación',
                evictedLabel: 'Historial de Desalojo',
                smokerLabel: 'Uso de Tabaco / Cigarrillos',
                paymentHeader: 'Contacto y Disponibilidad',
                housingStatusLabel: 'Situación de Vivienda Actual',
                previousHousingStatusLabel: 'Situación de Vivienda Anterior',
                selectHousingStatus: 'Seleccionar estado...',
                housingRent: 'Renta',
                housingOwn: 'Propietario (Sin Hipoteca)',
                housingMortgage: 'Propietario (Con Hipoteca)',
                housingFamily: 'Vive con Familia / Amigos',
                housingOther: 'Otro',
                lessThan2YearsLabel: 'Menos de 24 meses aquí (agregar dirección anterior)',
                priorResidenceTitle: 'Residencia Anterior (Obligatoria si tiene menos de 24 meses en la actual)',
                previousAddressLabel: 'Dirección Anterior',
                previousDurationLabel: 'Duración en la Dirección Anterior',
                previousLandlordLabel: 'Propietario / Administrador Anterior',
                previousLandlordPhoneLabel: 'Teléfono del Propietario Anterior',
                employerAddressLabel: 'Dirección del Empleador / Negocio (Opcional)',
                employerAddressPlaceholder: 'Calle, Ciudad, Estado, Código Postal',
                employmentStartDateLabel: 'Fecha de Inicio (Opcional)',
                bankruptcyLabel: '¿Declaraciones de bancarrota en los últimos 7 años?',
                criminalLabel: '¿Antecedentes penales o delitos graves relevantes?',
                bankruptcyExplainLabel: 'Explicación de Bancarrota y Estado de Resolución',
                criminalExplainLabel: 'Explicación de Antecedentes y Fecha',
                preferencesNote: '',
                paymentPrefsHeader: 'Preferencias de Pago de Tarifa',
                paymentPrefsIntro: 'Seleccione sus métodos de pago preferidos a continuación. No solicitamos ni cobramos tarjetas en este formulario — al enviarlo, nuestro equipo le contactará dentro de 24 horas para coordinar el pago de forma segura.',
                paymentPrefsImportant: 'La tarifa de solicitud es de $50 por cada solicitante adulto, co-solicitante, garante o co-firmante.',
                paymentPrimaryBadge: 'Requerido — 1.ª Opción',
                paymentPrimaryTitle: 'Método de Pago Principal',
                paymentPrimarySub: 'Elija la aplicación o método de pago que prefiere usar primero.',
                primaryPayLabel: 'Método de Pago Principal Preferido',
                selectPayOption: 'Seleccionar método de pago...',
                selectPayOptionOptional: 'Ninguno / Opcional...',
                payOptionOther: 'Otro (por favor especifique)',
                paymentOtherSpecifyLabel: 'Por favor especifique el método de pago',
                paymentAltBadge: 'Opcional — 2.ª Opción',
                paymentAltTitle: 'Método de Pago Alternativo',
                paymentAltSub: 'Útil si su aplicación principal tiene límites o inconvenientes temporales.',
                altPayLabel: 'Método de Pago Secundario (Opcional)',
                paymentThirdBadge: 'Opcional — 3.ª Opción',
                paymentThirdTitle: 'Tercera Opción de Pago',
                paymentThirdSub: 'Agregue otra opción de respaldo si lo desea.',
                thirdPayLabel: 'Tercer Método de Pago (Opcional)',
                paymentDupWarn: 'Seleccionó el mismo método de pago más de una vez. Considere elegir un método de respaldo distinto.',
                paymentReminderTitle: 'Sin Cobro en Este Formulario',
                paymentReminderDesc: 'No se le pedirán datos de tarjeta ni banco en este formulario. Dentro de 24 horas de enviarlo, nuestro equipo se comunicará por su método preferido para coordinar el pago.',
                reviewHeader: 'Documentos, Revisión y Envío',
                feeTitle: 'Tarifa de Solicitud: $50.00',
                feeDesc: 'Requerida antes de iniciar la verificación ($50 por cada solicitante adulto, co-solicitante, garante o co-firmante). Dentro de 24 horas tras enviar, nuestro equipo le contactará para coordinar el pago.',
                reapplicationPolicyTextShort: 'Si es denegado tras el pago, recibe créditos para cubrir la tarifa de futuras solicitudes por 30 días.',
                summaryPropertyApplicant: 'Propiedad y Solicitante Principal',
                summaryCoApplicant: 'Miembros del Hogar y Respaldos',
                summaryResidency: 'Historial de Residencia',
                summaryOccupancy: 'Ocupantes, Mascotas y Vehículos',
                summaryEmployment: 'Empleo e Ingresos',
                summaryFinancial: 'Identidad, Divulgaciones, Referencias y Emergencia',
                summaryPayment: 'Preferencias de Contacto y Pago',
                uploadTitle: 'Documentos de Apoyo',
                uploadOptional: '(Opcional Ahora — Súbalos Aquí o Luego en el Portal)',
                uploadDesc: 'Adjunte fotos o PDFs para agilizar la revisión, o envíe ahora y súbalos luego en el Portal del Inquilino. <strong>Aceptados:</strong> PDF, JPG, PNG, WebP · Hasta 10 MB por archivo. Almacenado de forma privada vía HTTPS en Choice Properties Storage — vea nuestra <a href="/privacy.html" target="_blank" rel="noopener" style="color:var(--primary);">Política de Privacidad</a>.',
                trustLine: 'Los datos de la solicitud se encriptan en tránsito vía HTTPS; solo solicitamos los últimos 4 dígitos del SSN (nunca el SSN completo de 9 dígitos).',
                feeAcknowledge: 'Reconozco la política de tarifas de solicitud y autorizo que mi información personal sea revisada por Choice Properties y el propietario únicamente para la verificación. La tarifa de solicitud es <strong>no reembolsable una vez completado el pago</strong>, excepto según la <a href="/application-credit-policy.html" target="_blank" rel="noopener" style="color:var(--primary);">Política de Crédito de Solicitud</a>.',
                agreeTermsPrivacy: 'He leído y acepto los <a href="/terms.html" target="_blank" rel="noopener" style="color:var(--primary);">Términos del Servicio</a> (incluyendo la <strong>cláusula de arbitraje vinculante</strong> y la <strong>renuncia a demanda colectiva</strong> en las Secciones 18–19), la <a href="/privacy.html" target="_blank" rel="noopener" style="color:var(--primary);">Política de Privacidad</a> y el <a href="/policies.html" target="_blank" rel="noopener" style="color:var(--primary);">Marco Completo de Políticas y Legal</a>. Confirmo que tengo al menos 18 años de edad y la capacidad legal para celebrar este acuerdo.',
                smsConsent: 'Doy mi consentimiento expreso para recibir mensajes SMS transaccionales de Choice Properties al número móvil proporcionado, relacionados con el estado de la solicitud, confirmaciones de pago, ejecución del contrato y programación de mudanza. La frecuencia de los mensajes varía. <strong>Pueden aplicar tarifas de mensajes y datos.</strong> Responda HELP para asistencia, STOP para cancelar en cualquier momento. El consentimiento de SMS no es condición de la solicitud — deje sin marcar para recibir comunicaciones únicamente por correo electrónico.',
                footerCopyright: '&copy; 2026 Choice Properties. Todos los derechos reservados.',
                startOver: 'Empezar de Nuevo',
                startOverTitle: '¿Descartar Solicitud?',
                startOverDesc: 'Toda la información ingresada se eliminará permanentemente. Será redirigido al Paso 1.',
                keepInfo: 'Continuar Solicitud',
                yesStartOver: 'Descartar y Reiniciar',
                minLeaseHintPre: 'Plazo mínimo de arrendamiento:',
                minLeaseHintPost: 'meses. Por favor seleccione un plazo que cumpla con el requisito.'
            }
        };

        this.translations = translations;
        const _savedLang = (() => {
            try {
                const _s = localStorage.getItem(this.config.LOCAL_STORAGE_KEY);
                return (_s ? (JSON.parse(_s)._language || 'en') : 'en');
            } catch (_e) { return 'en'; }
        })();
        this.state.language = _savedLang;
        const btn = document.getElementById('langToggle');
        const text = document.getElementById('langText');

        const applyLanguageToDom = (lang) => {
            const t = translations[lang] || translations.en;
            if (text) text.textContent = t.langText;
            const HTML_KEYS = new Set(['spamWarning', 'uploadDesc', 'uploadHint', 'feeAcknowledge', 'agreeTermsPrivacy', 'smsConsent', 'footerCopyright']);
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (t[key] !== undefined) {
                    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                        if (el.placeholder !== undefined) el.placeholder = t[key];
                    } else if (el.tagName === 'OPTION') {
                        el.textContent = t[key];
                    } else if (HTML_KEYS.has(key)) {
                        this._setSafeMarkup(el, t[key]);
                    } else {
                        el.textContent = t[key];
                    }
                }
            });
            document.documentElement.setAttribute('lang', lang);
            document.title = t.pageTitle;

            document.querySelectorAll('.btn-next').forEach(b => {
                const span = b.querySelector('[data-i18n="nextStep"]') || b.querySelector('span');
                if (span) span.textContent = t.nextStep;
            });
            document.querySelectorAll('.btn-prev').forEach(b => {
                const span = b.querySelector('[data-i18n="prevStep"]') || b.querySelector('span');
                if (span) span.textContent = t.prevStep;
            });

            this.updateProgressBar();
            this._refreshAllCoApplicantCardsLanguage();
            if (typeof this._syncPrimarySsnModeUi === 'function') this._syncPrimarySsnModeUi();
            if (typeof this._syncPaymentMethodUi === 'function') this._syncPaymentMethodUi(false);
            this._updateTotalFeeDisplay();
            this._updateOccupantsCountSync();
            if (this._updateIncomeRatio) this._updateIncomeRatio();
            if (typeof this._rerenderUploadedFiles === 'function') this._rerenderUploadedFiles();

            if (this.getCurrentSection() === 6) {
                this.generateApplicationSummary();
            }

            try {
                const hEl = document.getElementById('housingStatus');
                if (hEl && this._syncHousingStatusUi) this._syncHousingStatusUi(hEl.value);
                const phEl = document.getElementById('previousHousingStatus');
                if (phEl && this._syncPriorHousingStatusUi) this._syncPriorHousingStatusUi(phEl.value);
                if (this._syncTotalOccupantsUi) this._syncTotalOccupantsUi();
                const empEl = document.getElementById('employmentStatus');
                if (empEl && this._toggleEmployerSection) {
                    this._toggleEmployerSection(empEl.value);
                }
            } catch (_e) { /* Non-fatal */ }
        };

        if (btn && text) {
            btn.addEventListener('click', () => {
                this.state.language = this.state.language === 'en' ? 'es' : 'en';
                applyLanguageToDom(this.state.language);
                this.saveProgress();
            });
        }

        if (_savedLang === 'es') {
            applyLanguageToDom('es');
        } else {
            this._updateTotalFeeDisplay();
            this._updateOccupantsCountSync();
        }
    }

    // ---------- NEW: Distinguish error types ----------
    isTransientError(error) {
        if (error.isTransient) return true;
        const msg = error.message || error.toString();
        return msg.includes('network') || 
               msg.includes('timeout') || 
               msg.includes('Failed to fetch') ||
               msg.includes('ECONNREFUSED') ||
               msg.includes('Internet') ||
               msg.includes('offline') ||
               msg.includes('conexión') ||
               msg.includes('conexion');
    }

    // ---------- MODIFIED: showSubmissionError with auto-retry ----------
    showSubmissionError(error, isTransient = false) {
        const msgEl = document.getElementById('submissionMessage');
        const progressDiv = document.getElementById('submissionProgress');
        const statusArea = document.getElementById('statusArea');
        const spinner = document.getElementById('submissionSpinner');
        if (!msgEl || !progressDiv || !statusArea) return;

        const t = this.getTranslations();
        let errorMessage = error.message || error.toString();

        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout);
            this.retryTimeout = null;
        }

        // Auto-retry logic
        if (isTransient && this.retryCount < this.maxRetries) {
            const delay = Math.pow(2, this.retryCount) * 1000; // 2,4,8 seconds
            this.retryCount++;
            
            msgEl.textContent = `${errorMessage} – ${t.retry} ${t.retryIn} ${delay/1000}s (${t.retryAttempt} ${this.retryCount}/${this.maxRetries})`;
            statusArea.classList.add('error');
            if (spinner) {
                spinner.className = 'fas fa-spinner fa-pulse';
                spinner.style.color = '#e74c3c';
            }

            this.retryTimeout = setTimeout(() => {
                this.retryTimeout = null;
                statusArea.classList.remove('error');
                if (spinner) {
                    spinner.className = 'fas fa-spinner fa-pulse';
                    spinner.style.color = '';
                }
                this.updateSubmissionProgress(1, t.processing);
                this.handleFormSubmit(new Event('submit'), true);
            }, delay);
            return;
        }

        // Permanent error or max retries reached
        // If we exhausted auto-retries on a transient (network) error AND the
        // background verify is still running, show a neutral "checking" state
        // instead of the scary error screen. The verify will call
        // handleSubmissionSuccess() if it finds the record, or will call
        // _showFinalNetworkError() after all attempts are exhausted.
        if (isTransient && this.retryCount >= this.maxRetries && this._verifyStarted) {
            msgEl.textContent = t.verifyingSubmission || 'Checking your submission status\u2026 Please wait.';
            statusArea.classList.remove('error');
            if (spinner) {
                spinner.className = 'fas fa-spinner fa-pulse';
                spinner.style.color = '#3498db';
            }
            return; // Don't show retry button yet — verify is still running
        }

        const finalMessage = (isTransient && this.retryCount >= this.maxRetries)
            ? (t.networkExhausted || t.serverError)
            : errorMessage;
        msgEl.textContent = finalMessage;
        statusArea.classList.add('error');
        if (spinner) {
            spinner.className = 'fas fa-exclamation-circle';
            spinner.style.color = '#e74c3c';
        }

        const currentStep = this.getCurrentSubmissionStep();
        if (currentStep) {
            const stepItem = document.getElementById(`stepItem${currentStep}`);
            if (stepItem) stepItem.classList.add('error');
        }

        let retryBtn = document.getElementById('submissionRetryBtn');
        if (!retryBtn) {
            retryBtn = document.createElement('button');
            retryBtn.id = 'submissionRetryBtn';
            retryBtn.className = 'btn-retry';
            this._setIconText(retryBtn, 'fas fa-redo-alt', t.retry);
            progressDiv.appendChild(retryBtn);
        }
        retryBtn.style.display = 'inline-flex';

        const newBtn = retryBtn.cloneNode(true);
        retryBtn.parentNode.replaceChild(newBtn, retryBtn);
        newBtn.addEventListener('click', () => {
            newBtn.style.display = 'none';
            const closeBtnEl = document.getElementById('submissionCloseBtn');
            if (closeBtnEl) closeBtnEl.style.display = 'none';
            statusArea.classList.remove('error');
            if (spinner) {
                spinner.className = 'fas fa-spinner fa-pulse';
                spinner.style.color = '';
            }
            if (currentStep) {
                const stepItem = document.getElementById(`stepItem${currentStep}`);
                if (stepItem) stepItem.classList.remove('error');
            }
            this.retryCount = 0;
            this._verifyStarted = false;
            this._successHandled = false;
            this.updateSubmissionProgress(1, t.processing);
            this.handleFormSubmit(new Event('submit'));
        });

        this._ensureSubmissionCloseBtn(progressDiv, t);
    }

    // ---------- _ensureSubmissionCloseBtn ----------
    // Adds (or shows) a Close button next to the Retry button so the user is
    // never stuck inside the submission overlay when an error appears.
    _ensureSubmissionCloseBtn(progressDiv, t) {
        if (!progressDiv) return;
        let closeBtn = document.getElementById('submissionCloseBtn');
        if (!closeBtn) {
            closeBtn = document.createElement('button');
            closeBtn.id = 'submissionCloseBtn';
            closeBtn.className = 'btn-close-error';
            closeBtn.type = 'button';
            closeBtn.setAttribute('aria-label', (t && t.close) || 'Close');
            progressDiv.appendChild(closeBtn);
        }
        this._setIconText(closeBtn, 'fas fa-times', (t && t.close) || 'Close');
        closeBtn.style.display = 'inline-flex';

        const fresh = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(fresh, closeBtn);
        fresh.addEventListener('click', () => {
            if (this.retryTimeout) {
                clearTimeout(this.retryTimeout);
                this.retryTimeout = null;
            }
            const statusArea = document.getElementById('statusArea');
            const spinner = document.getElementById('submissionSpinner');
            const retryBtn = document.getElementById('submissionRetryBtn');
            if (statusArea) statusArea.classList.remove('error');
            if (spinner) { spinner.className = 'fas fa-spinner fa-pulse'; spinner.style.color = ''; }
            if (retryBtn) retryBtn.style.display = 'none';
            for (let i = 1; i <= 4; i++) {
                const stepItem = document.getElementById(`stepItem${i}`);
                if (stepItem) stepItem.classList.remove('error');
            }
            fresh.style.display = 'none';
            this.hideSubmissionProgress();
            this.isSubmitting = false;
        });
    }

    getCurrentSubmissionStep() {
        for (let i = 1; i <= 4; i++) {
            const seg = document.getElementById(`progressSegment${i}`);
            if (seg && seg.classList.contains('active')) return i;
        }
        return null;
    }

    // ---------- updateSubmissionProgress ----------
    updateSubmissionProgress(step, customMessage) {
        const t = this.getTranslations();
        const messages = {
            1: t.processing,
            2: t.validating,
            3: t.submitting,
            4: t.complete
        };
        const msg = messages[step] || customMessage || '';
        const msgEl = document.getElementById('submissionMessage');
        if (msgEl) msgEl.textContent = msg;

        for (let i = 1; i <= 4; i++) {
            const seg = document.getElementById(`progressSegment${i}`);
            const stepItem = document.getElementById(`stepItem${i}`);
            if (seg) {
                seg.classList.remove('completed', 'active');
                if (i < step) seg.classList.add('completed');
                else if (i === step) seg.classList.add('active');
            }
            if (stepItem) {
                stepItem.classList.remove('completed', 'active', 'error');
                if (i < step) stepItem.classList.add('completed');
                else if (i === step) stepItem.classList.add('active');
            }
        }

        const spinner = document.getElementById('submissionSpinner');
        if (step === 4 && spinner) {
            spinner.className = 'fas fa-check-circle';
            spinner.style.color = '#27ae60';
        } else if (spinner) {
            spinner.className = 'fas fa-spinner fa-pulse';
            spinner.style.color = '';
        }
    }


    // Generates a 64-character hex nonce used as a bot-friction CSRF token.
    // The backend validates format only (32-128 alphanumeric chars); this satisfies that requirement.
    generateCsrfNonce() {
        try {
            const arr = new Uint8Array(32);
            window.crypto.getRandomValues(arr);
            return Array.from(arr, b => ('0' + b.toString(16)).slice(-2)).join('');
        } catch (_) {
            // Fallback for browsers without crypto API (extremely rare)
            let n = '';
            const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
            for (let i = 0; i < 40; i++) n += chars.charAt(Math.floor(Math.random() * chars.length));
            return n;
        }
    }
    isSupabaseBackend() {
        return true;
    }

    // ---------- MODIFIED: handleFormSubmit with retry reset ----------
    async handleFormSubmit(e, isRetry = false) {
        e.preventDefault();
        const t = this.getTranslations();

        // ── Duplicate submission guard ──────────────────────────────
        // Block if already mid-submission
        if (this.state.isSubmitting) return;
          if (!this.BACKEND_URL) {
              this.showSubmissionError(new Error('The application system is temporarily unavailable. Please try again or call 707-706-3137.'), false);
              return;
          }
          if (!(window.CP_CONFIG && window.CP_CONFIG.SUPABASE_ANON_KEY)) {
              this.showSubmissionError(new Error('The application system is missing a required security key. Please call 707-706-3137 so we can help you submit.'), false);
              return;
          }
        // Block if this session already produced a successful appId
        if (sessionStorage.getItem('lastSuccessAppId')) {
            const existingId = sessionStorage.getItem('lastSuccessAppId');
            this.showSuccessState(existingId);
            const form = document.getElementById('rentalApplication');
            if (form) form.style.display = 'none';
            return;
        }
        // ────────────────────────────────────────────────────────────

        if (!isRetry) {
            this.retryCount = 0;
            this._verifyStarted = false;
            this._successHandled = false;
        }
        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout);
            this.retryTimeout = null;
        }

        if (!navigator.onLine) {
            const t = this.getTranslations();
            this.showSubmissionError(new Error(t.offlineError), false);
            const submitBtn = document.getElementById('mainSubmitBtn');
            if (submitBtn) {
                submitBtn.classList.remove('loading');
                submitBtn.disabled = false;
            }
            this.setState({ isSubmitting: false });
            return;
        }

        const certify = document.getElementById('certifyCorrect');
        const authorize = document.getElementById('authorizeVerify');
        const feeAck = document.getElementById('feeAcknowledge');
        const agreeTP = document.getElementById('agreeTermsPrivacy');
        const smsConsent = document.getElementById('smsConsent');
        // Capture consent metadata before any validation gates
        try {
            const tsEl = document.getElementById('hiddenConsentTimestamp');
            if (tsEl) tsEl.value = new Date().toISOString();
            const smsEl = document.getElementById('hiddenSmsConsent');
            if (smsEl) smsEl.value = (smsConsent && smsConsent.checked) ? 'yes' : 'no';
            const termsEl = document.getElementById('hiddenTermsConsent');
            if (termsEl) termsEl.value = (agreeTP && agreeTP.checked) ? 'yes' : 'no';
        } catch (_) { /* non-blocking */ }
        const allDeclarations = [certify, authorize, feeAck, agreeTP].filter(Boolean);
        if (allDeclarations.some(cb => !cb.checked)) {
            // Show inline error instead of alert — scroll to first unchecked declaration
              const _firstUnchecked = allDeclarations.find(cb => !cb.checked);
              const _declErr = document.getElementById('declarationError');
              const _declMsg = t.pleaseAgreeDeclarations || 'Please check all required declarations before submitting.';
              if (_declErr) { _declErr.textContent = _declMsg; _declErr.style.display = 'block'; }
              if (_firstUnchecked) {
                  const _scrollTarget = _firstUnchecked.closest('.custom-checkbox') || _firstUnchecked;
                  _scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  _firstUnchecked.classList.add('shake');
                  setTimeout(() => _firstUnchecked.classList.remove('shake'), 600);
              }
            const submitBtn = document.getElementById('mainSubmitBtn');
            if (submitBtn) {
                submitBtn.classList.remove('loading');
                submitBtn.disabled = false;
            }
            this.setState({ isSubmitting: false });
            return;
        }
        // Clear any prior declaration error when all boxes are checked
          const _declErrEl = document.getElementById('declarationError');
          if (_declErrEl) _declErrEl.style.display = 'none';

        if (!isRetry) {
            for (let i = 1; i <= 5; i++) {
                if (!this.validateStep(i)) {
                    this.showSection(i);
                    this.updateProgressBar();
                    return;
                }
            }
        }

        const submitBtn = document.getElementById('mainSubmitBtn');
        if (submitBtn) {
            submitBtn.classList.add('loading');
            submitBtn.disabled = true;
        }

        this.setState({ isSubmitting: true });
        this.showSubmissionProgress();

        try {
            this.updateSubmissionProgress(1, t.processing);

            this._syncCoApplicantsJson();
            const form = document.getElementById('rentalApplication');
            const formData = new FormData(form);
            const shareToken = this.state.propertyContext?.shareToken || '';
            if (/^[A-Za-z0-9_-]{43}$/.test(shareToken)) {
                formData.set('_share_token', shareToken);
            }

            // Explicit credit flag ('true' only when checkbox visible & checked)
            const creditCb = document.getElementById('applyCreditCheckbox');
            if (creditCb && creditCb.checked && this.state.availableCredit?.has_credit) {
                formData.set('apply_credit', 'true');
            } else {
                formData.delete('apply_credit');
            }

            try {
                const submissionUuid = (window.crypto && typeof crypto.randomUUID === 'function')
                    ? crypto.randomUUID()
                    : ('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                        const r = Math.random()*16|0, v = c==='x'?r:(r&0x3|0x8); return v.toString(16);
                      }));
                formData.set('submission_uuid', submissionUuid);
            } catch (_) { /* non-fatal */ }

            // Documents are uploaded directly via signed URLs immediately after application creation
            // so attachments never block or exceed payload size limits.
            this.updateSubmissionProgress(2, t.validating);

            // M4: Attach CSRF token to submission
            formData.append('_cp_csrf', this._csrfToken || sessionStorage.getItem('_cp_csrf') || '');

            let response;
            const _fetchController = new AbortController();
            const _fetchTimer = setTimeout(() => _fetchController.abort(), 120000);
            const _anonKey = (window.CP_CONFIG && window.CP_CONFIG.SUPABASE_ANON_KEY) || '';
            try {
                response = await fetch(this.BACKEND_URL, {
                    method: 'POST',
                    body: formData,
                    signal: _fetchController.signal,
                    headers: {
                        'Accept': 'application/json',
                        ..._anonKey ? { 'apikey': _anonKey, 'Authorization': 'Bearer ' + _anonKey } : {}
                    }
                });
            } catch (networkErr) {
                const netErr = new Error(t.networkError);
                netErr.isTransient = true;
                throw netErr;
            } finally {
                clearTimeout(_fetchTimer);
            }

            let result;
            try {
                const rawText = await response.text();
                result = JSON.parse(rawText);
            } catch (parseErr) {
                throw new Error(response.ok ? t.serverError : 'The application system returned an unexpected response. Please call 707-706-3137 if this continues.');
            }
            if (!response.ok) {
                const serverMessage = result && result.error ? result.error : '';
                if (response.status === 401 || response.status === 403) {
                    throw new Error('The application system is not accepting submissions because of a configuration issue. Please call 707-706-3137 so we can help you submit.');
                }
                if (response.status === 422 && serverMessage) {
                    throw new Error(serverMessage);
                }
                throw new Error(serverMessage || t.serverError);
            }

            if (result.success) {
                this.updateSubmissionProgress(3, t.submitting);
                let docUploadSummary = null;
                if (this._uploadedFiles && this._uploadedFiles.length > 0 && result.portal_upload_token) {
                    docUploadSummary = await this._uploadQueuedDocumentsAfterSubmit(result.appId, result.portal_upload_token);
                }
                this.updateSubmissionProgress(4, t.complete);
                await this.delay(400);
                this.handleSubmissionSuccess(result.appId, result.portal_login_url, {
                    primaryApplicantId: result.primary_applicant_id || null,
                    portalUploadToken: result.portal_upload_token || null,
                    docUploadSummary,
                });
            } else {
                const errMsg = result.error || '';
                if (errMsg.includes('already have an active application')) {
                    const refMatch = errMsg.match(/Ref:\s*([A-Z0-9\-]+)/i);
                    const extractedId = result.existingAppId || result.appId || (refMatch && refMatch[1]) || '';
                    this.updateSubmissionProgress(3, t.submitting);
                    await this.delay(300);
                    this.updateSubmissionProgress(4, t.complete);
                    await this.delay(300);
                    this.handleSubmissionSuccess(extractedId, result.portal_login_url, {
                        primaryApplicantId: result.primary_applicant_id || null,
                    });
                    return;
                }
                throw new Error(errMsg || 'Submission failed');
            }

        } catch (error) {
            console.error('Submission error:', error);
            const submitBtn = document.getElementById('mainSubmitBtn');
            if (submitBtn) {
                submitBtn.classList.remove('loading');
                submitBtn.disabled = false;
            }
            this.setState({ isSubmitting: false });

            const isTransient = this.isTransientError(error);
            this.showSubmissionError(error, isTransient);

            // After the FIRST network/transient error, check in the background
            // whether the Edge Function already saved the application.
            // _verifyStarted ensures we only launch one background check per attempt.
            if (isTransient && this.retryCount >= 1 && this.BACKEND_URL && !this._verifyStarted) {
                this._verifyStarted = true;
                this._autoVerifySubmission();
            }
        }
    }

    // ---------- _autoVerifySubmission ----------
    // Called in the background after the first network/transient error.
    // Polls the receive-application Edge Function every 3 s for up to 60 s
    // to confirm whether the submission was already saved.
    async _autoVerifySubmission() {
        try {
            const emailEl = document.getElementById('email');
            const email = emailEl ? emailEl.value.trim() : '';
            if (!email || !email.includes('@') || !this.BACKEND_URL) {
                this._verifyStarted = false;
                this._showFinalNetworkError();
                return;
            }

            const isSupabase = this.isSupabaseBackend();
            const INITIAL_DELAY = isSupabase ? 3000 : 20000;
            const MAX_ATTEMPTS = isSupabase ? 20 : 14;
            const POLL_INTERVAL = isSupabase ? 3000 : 5000;
            await this.delay(INITIAL_DELAY);

            const verify = new URL(this.BACKEND_URL);
            verify.searchParams.set('path', 'checkRecentSubmission');
            verify.searchParams.set('email', email);
            const verifyUrl = verify.toString();

            for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
                if (attempt > 0) await this.delay(POLL_INTERVAL);

                // If the POST response already showed success, stop polling
                if (this._successHandled) { this._verifyStarted = false; return; }

                // Abort individual requests after 12 s so a hung request
                // doesn't eat the whole poll slot
                const ctrl = new AbortController();
                const timer = setTimeout(() => ctrl.abort(), 12000);
                const _vAnonKey = (window.CP_CONFIG && window.CP_CONFIG.SUPABASE_ANON_KEY) || '';
                try {
                    const resp = await fetch(verifyUrl, {
                        signal: ctrl.signal,
                        headers: _vAnonKey ? { 'apikey': _vAnonKey, 'Authorization': 'Bearer ' + _vAnonKey } : {}
                    });
                    clearTimeout(timer);
                    if (!resp.ok) continue;
                    let data;
                    try { data = JSON.parse(await resp.text()); } catch (_) { continue; }
                    if (data && data.found && data.appId) {
                        console.log('[CP] Auto-verify: confirmed — App ID:', data.appId);
                        if (this.retryTimeout) { clearTimeout(this.retryTimeout); this.retryTimeout = null; }
                        this._verifyStarted = false;
                        this.handleSubmissionSuccess(data.appId, data.portal_login_url);
                        return;
                    }
                } catch (_netErr) {
                    clearTimeout(timer);
                    // Network error on this attempt — keep trying
                }
            }

            // All attempts exhausted without finding the submission
            this._verifyStarted = false;
            this._showFinalNetworkError();
        } catch (e) {
            this._verifyStarted = false;
            this._showFinalNetworkError();
        }
    }

    // ---------- _showFinalNetworkError ----------
    // Called by _autoVerifySubmission after all verify attempts are exhausted.
    // At this point the user has been waiting a while — show the friendly
    // "may have been received" message with the manual Retry button.
    _showFinalNetworkError() {
        const t = this.getTranslations();
        const msgEl = document.getElementById('submissionMessage');
        const statusArea = document.getElementById('statusArea');
        const spinner = document.getElementById('submissionSpinner');
        const progressDiv = document.getElementById('submissionProgress');
        if (!msgEl || !progressDiv) return;

        msgEl.textContent = t.networkExhausted || t.serverError;
        if (statusArea) statusArea.classList.add('error');
        if (spinner) { spinner.className = 'fas fa-exclamation-circle'; spinner.style.color = '#e74c3c'; }

        let retryBtn = document.getElementById('submissionRetryBtn');
        if (!retryBtn) {
            retryBtn = document.createElement('button');
            retryBtn.id = 'submissionRetryBtn';
            retryBtn.className = 'btn-retry';
            progressDiv.appendChild(retryBtn);
        }
        this._setIconText(retryBtn, 'fas fa-redo-alt', t.retry);
        retryBtn.style.display = 'inline-flex';

        const newBtn = retryBtn.cloneNode(true);
        retryBtn.parentNode.replaceChild(newBtn, retryBtn);
        newBtn.addEventListener('click', () => {
            newBtn.style.display = 'none';
            const closeBtnEl = document.getElementById('submissionCloseBtn');
            if (closeBtnEl) closeBtnEl.style.display = 'none';
            if (statusArea) statusArea.classList.remove('error');
            if (spinner) { spinner.className = 'fas fa-spinner fa-pulse'; spinner.style.color = ''; }
            this.retryCount = 0;
            this._verifyStarted = false;
            this._successHandled = false;
            const translations = this.getTranslations();
            this.updateSubmissionProgress(1, translations.processing);
            this.handleFormSubmit(new Event('submit'));
        });

        this._ensureSubmissionCloseBtn(progressDiv, t);
    }

    // ---------- MODIFIED: show/hide progress with backdrop ----------
    showSubmissionProgress() {
        const progress = document.getElementById('submissionProgress');
        const backdrop = document.getElementById('modalBackdrop');
        const form = document.getElementById('rentalApplication');
        if (progress) progress.style.display = 'block';
        if (backdrop) backdrop.style.display = 'block';
        if (form) form.style.display = 'none';
    }

    hideSubmissionProgress() {
        const progress = document.getElementById('submissionProgress');
        const backdrop = document.getElementById('modalBackdrop');
        const form = document.getElementById('rentalApplication');
        if (progress) progress.style.display = 'none';
        if (backdrop) backdrop.style.display = 'none';
        if (form) form.style.display = 'block';
    }

    // ---------- handleSubmissionSuccess ----------
    handleSubmissionSuccess(appId, portalLoginUrl, extra = null) {
        // Guard against being called twice (POST response + verify both succeed)
        if (this._successHandled) return;
        this._successHandled = true;
        this.hideSubmissionProgress();
        const form = document.getElementById('rentalApplication');
        if (form) form.style.display = 'none';
        const backdrop = document.getElementById('modalBackdrop');
        if (backdrop) backdrop.style.display = 'none';

        try {
            if (portalLoginUrl && /^https?:\/\//i.test(portalLoginUrl)) {
                sessionStorage.setItem('lastSuccessPortalUrl', portalLoginUrl);
            } else {
                sessionStorage.removeItem('lastSuccessPortalUrl');
            }
            if (extra && typeof extra === 'object') {
                sessionStorage.setItem('lastSuccessExtra_' + appId, JSON.stringify(extra));
            }
        } catch (_) { /* storage disabled — fall back to legacy login URL */ }

        this.showSuccessState(appId, portalLoginUrl, extra);
        this.clearSavedProgress();
        sessionStorage.setItem('lastSuccessAppId', appId);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ---------- showSuccessState ----------
    showSuccessState(appId, portalLoginUrl, extra = null) {
        const successState = document.getElementById('successState');
        if (!successState) return;

        const t = this.getTranslations();
        const lang = this.state.language || 'en';

        const getSelectedCheckboxValues = (name) => {
            const checkboxes = document.querySelectorAll(`input[name="${name}"]:checked`);
            return Array.from(checkboxes).map(cb => cb.value);
        };

        const contactMethods = getSelectedCheckboxValues('Preferred Contact Method');
        const contactMethodsDisplay = contactMethods.length > 0 ? contactMethods.join(', ') : t.notSpecified;

        const contactTimes = getSelectedCheckboxValues('Preferred Time');
        const contactTimesDisplay = contactTimes.length > 0 ? contactTimes.join(', ') : t.notSpecified;

        const readSelectLabel = (selId, otherId) => {
            const val = document.getElementById(selId)?.value?.trim() || '';
            if (!val) return '';
            if (val === 'Other') {
                const otherVal = document.getElementById(otherId)?.value?.trim() || '';
                return otherVal ? `Other: ${otherVal}` : 'Other';
            }
            return val;
        };
        const primaryPayPref = readSelectLabel('primaryPaymentMethod', 'primaryPaymentOther') || (t.notSpecified || 'Not specified');
        const altPayPref = readSelectLabel('alternativePaymentMethod', 'alternativePaymentOther');
        const thirdPayPref = readSelectLabel('thirdChoicePaymentMethod', 'thirdChoicePaymentOther');

        const email = document.getElementById('email')?.value?.trim() || '';
        const propertyAddressInput = document.getElementById('propertyAddress')?.value?.trim() || '';

        let savedPortalUrl = '';
        try { savedPortalUrl = sessionStorage.getItem('lastSuccessPortalUrl') || ''; } catch (_) {}
        const candidateUrl = (portalLoginUrl && !/tenant\/login\.html|\/auth\/v1\/verify/i.test(portalLoginUrl))
            ? portalLoginUrl
            : (savedPortalUrl && !/tenant\/login\.html|\/auth\/v1\/verify/i.test(savedPortalUrl) ? savedPortalUrl : '');
        const trackUrl = candidateUrl
            || ('/tenant/portal.html?app_id=' + encodeURIComponent(appId) + (email ? '&email=' + encodeURIComponent(email) : ''));
        try {
            sessionStorage.setItem('pendingPortalAppId', appId);
            localStorage.removeItem('cpLastSubmittedApplication');
        } catch (_) {}

        const feeSummary = this._calculateHouseholdFee();
        const coListSuccess = this._collectCoApplicants ? this._collectCoApplicants() : [];
        const invitedMembers = coListSuccess.filter(c => this._normalizeSubmissionMethod(c.submission_method) === 'invited');
        const methodAMembers = coListSuccess.filter(c => this._normalizeSubmissionMethod(c.submission_method) !== 'invited');

        const totalFeeDue = feeSummary.totalFee;
        const requiresFeeCoordination = totalFeeDue > 0;

        const ctx = this.state.propertyContext;
        const resolvedPropertyAddress = propertyAddressInput || (ctx && (ctx.name || [ctx.city, ctx.state].filter(Boolean).join(', '))) || 'Selected Rental Property';

        const feeAmtDisplay = totalFeeDue > 0 ? '$' + Number(totalFeeDue).toFixed(2) : '$0.00 (Waived)';
        const methodANoticeHtml = methodAMembers.length > 0
            ? `<div style="margin:12px 0;padding:12px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:0.9rem;color:#14532d;line-height:1.5;">
                <i class="fas fa-check-circle" style="margin-right:6px;"></i>
                <strong>${lang === 'es' ? 'Miembros autorizados por el solicitante principal (Método A):' : 'Household Screening Authorized on Behalf (Method A):'}</strong>
                ${methodAMembers.map(m => `${this._escHtml([m.first_name, m.last_name].filter(Boolean).join(' '))}`).join(', ')}
                — ${lang === 'es' ? 'no se requiere enlace privado ni acción adicional de su parte.' : 'no private link or separate action is required from them.'}
               </div>`
            : '';
        const invitedNoticeHtml = invitedMembers.length > 0
            ? `<div style="margin:12px 0;padding:12px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;font-size:0.9rem;color:#1e3a8a;line-height:1.5;">
                <i class="fas fa-envelope-open-text" style="margin-right:6px;"></i>
                <strong>${lang === 'es' ? 'Enlaces privados enviados (Método B):' : 'Private Self-Complete Links Dispatched (Method B):'}</strong>
                ${invitedMembers.map(m => `${this._escHtml([m.first_name, m.last_name].filter(Boolean).join(' '))} (${this._escHtml(m.email)})`).join(', ')}
                — ${lang === 'es' ? 'completar sus datos mediante el enlace no genera registros duplicados.' : 'completing their info via email does not create any duplicate application.'}
               </div>`
            : '';

        const propertyLine = (ctx && (ctx.name || ctx.city)) || propertyAddressInput
            ? '<div class="success-property-line"><i class="fas fa-home"></i><span>' +
              this._escHtml(resolvedPropertyAddress) +
              '</span></div>'
            : '';

        const backLink = this.state.sourceUrl
            ? '<a href="' + this._escHtml(this.state.sourceUrl) + '" style="display:inline-block;margin-top:8px;font-size:0.9rem;color:#1a5276;text-decoration:none;">← Back to this listing</a>'
            : '';

        const feeBreakdownLines = (feeSummary.feeBreakdown || []).map(item => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #e2e8f0;font-size:0.88rem;color:#1e293b;">
                <span>${this._escHtml(item.name)} <span style="color:#64748b;">(${this._escHtml(item.role_label)})</span>${item.included_free ? ` <span style="display:inline-block;margin-left:6px;padding:1px 7px;border-radius:10px;background:#dcfce7;color:#166534;font-size:11px;font-weight:700;">${lang === 'es' ? 'GRATIS' : 'FREE'}</span>` : ''}</span>
                <strong style="font-variant-numeric:tabular-nums;">${item.included_free ? '$0.00' : ('$' + Number(item.fee || 0).toFixed(2))}</strong>
            </div>
        `).join('');

        const docSummary = extra && extra.docUploadSummary;
        let docUploadNoticeHtml = '';
        if (docSummary && docSummary.total > 0) {
            if (docSummary.failedNames && docSummary.failedNames.length > 0) {
                const failedList = docSummary.failedNames.map(n => this._escHtml(n)).join(', ');
                docUploadNoticeHtml = `<div style="margin:12px 0;padding:12px 14px;background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;font-size:0.88rem;color:#92400e;line-height:1.5;">
                    <i class="fas fa-exclamation-triangle" style="margin-right:6px;"></i>
                    <strong>${lang === 'es' ? 'Carga parcial de documentos:' : 'Partial Document Upload:'}</strong>
                    ${docSummary.uploadedCount}/${docSummary.total} ${lang === 'es' ? 'archivo(s) subidos. Por favor suba los faltantes en su Portal de Inquilino:' : 'file(s) uploaded. Please retry remaining file(s) inside your Tenant Portal:'} ${failedList}
                </div>`;
            } else {
                docUploadNoticeHtml = `<div style="margin:12px 0;padding:12px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:0.88rem;color:#14532d;line-height:1.5;">
                    <i class="fas fa-cloud-upload-alt" style="margin-right:6px;"></i>
                    <strong>${lang === 'es' ? 'Documentos adjuntos recibidos:' : 'Supporting Documents Received:'}</strong>
                    ${docSummary.uploadedCount}/${docSummary.total} ${lang === 'es' ? 'archivo(s) almacenados de forma segura en Choice Properties.' : 'file(s) encrypted & stored in Choice Properties Storage.'}
                </div>`;
            }
        }

        const payPills = [
            `<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:20px;background:#0d2137;color:#fff;font-size:13px;font-weight:700;">1. ${this._escHtml(primaryPayPref)}</span>`,
            altPayPref ? `<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:20px;background:#e2e8f0;color:#1e293b;font-size:13px;font-weight:600;">2. ${this._escHtml(altPayPref)}</span>` : '',
            thirdPayPref ? `<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:20px;background:#f1f5f9;color:#475569;font-size:13px;font-weight:600;">3. ${this._escHtml(thirdPayPref)}</span>` : '',
        ].filter(Boolean).join('');

        successState.style.display = 'block';
        this._setTrustedHtml(successState, this._html`
            <div class="success-card">
                <div class="success-header">
                    <i class="fas fa-check-circle"></i>
                    <h2>${t.successTitle}</h2>
                    <p class="success-subtitle">${t.successText}</p>
                    ${this._safeHtml(propertyLine)}
                    ${this._safeHtml(backLink)}
                </div>

                <div class="id-section">
                    <div class="id-label">${t.appId}</div>
                    <div class="id-number" id="successAppId">${appId}</div>
                    <button class="copy-btn" type="button">
                        <i class="fas fa-copy"></i> ${t.clickToCopy}
                    </button>
                    <p style="font-size:12px;color:#64748b;margin:8px 0 0;"><i class="fas fa-info-circle"></i> Save this reference number — it links your payment and application status.</p>
                </div>

                ${requiresFeeCoordination ? this._html`
                <div class="urgent-notice" style="background:#eff6ff;border:1px solid #93c5fd;color:#0f172a;margin-top:16px;">
                    <i class="fas fa-wallet" style="color:#2563eb;"></i>
                    <div style="flex:1;">
                        <p style="margin:0 0 6px;"><strong>${t.importantNote}</strong> ${t.paymentUrgentText}</p>
                        <div style="margin-top:8px;">
                            ${this._safeHtml(feeBreakdownLines)}
                            <div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;font-size:0.95rem;color:#0f172a;">
                                <strong>${lang === 'es' ? 'Tarifa Total del Hogar' : 'Household Application Fee'}</strong>
                                <strong style="font-size:1.1rem;font-variant-numeric:tabular-nums;color:#0d2137;">${feeAmtDisplay}</strong>
                            </div>
                        </div>
                        <div style="margin-top:12px;padding-top:10px;border-top:1px solid #bfdbfe;">
                            <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#1e3a8a;margin-bottom:8px;">${t.selectedPayPrefs || 'Selected Payment Preferences'}</div>
                            <div style="display:flex;flex-wrap:wrap;gap:8px;">${this._safeHtml(payPills)}</div>
                        </div>
                    </div>
                </div>
                ` : this._html`
                <div class="urgent-notice" style="background:#f0fdf4;border:1px solid #bbf7d0;color:#14532d;margin-top:16px;">
                    <i class="fas fa-check-circle" style="color:#16a34a;"></i>
                    <p><strong>${t.importantNote}</strong> ${t.paymentUrgentText}</p>
                </div>
                `}

                ${this._safeHtml(docUploadNoticeHtml)}

                <div class="divider"></div>

                <div class="next-steps-box">
                    <h3><i class="fas fa-shield-alt"></i> ${t.immediateNextSteps}</h3>

                    <div class="step-row">
                        <div class="step-number">1</div>
                        <div class="step-content">
                            <strong>${t.paymentRequiredTitle}</strong>
                            <p>${t.paymentRequiredDesc}</p>
                        </div>
                    </div>

                    <div class="step-row">
                        <div class="step-number">2</div>
                        <div class="step-content">
                            <strong>${t.completePaymentTitle}</strong>
                            <p>${t.completePaymentDesc}</p>
                        </div>
                    </div>

                    <div class="step-row">
                        <div class="step-number">3</div>
                        <div class="step-content">
                            <strong>${t.reviewBeginsTitle}</strong>
                            <p>${t.reviewBeginsDesc}</p>
                        </div>
                    </div>
                </div>

                ${this._safeHtml(methodANoticeHtml)}
                ${this._safeHtml(invitedNoticeHtml)}

                <div class="preference-summary">
                    <h4><i class="fas fa-phone-alt"></i> ${t.yourPreferences}</h4>
                    <div class="preference-grid">
                        <div class="pref-item">
                            <span class="pref-label">${t.contactMethod}</span>
                            <span class="pref-value">${contactMethodsDisplay}</span>
                        </div>
                        <div class="pref-item">
                            <span class="pref-label">${t.bestTimes}</span>
                            <span class="pref-value">${contactTimesDisplay}</span>
                        </div>
                        <div class="pref-item">
                            <span class="pref-label">${t.primaryPayShort || '1st Choice Payment'}:</span>
                            <span class="pref-value">${primaryPayPref}</span>
                        </div>
                        ${altPayPref ? this._html`
                        <div class="pref-item">
                            <span class="pref-label">${t.altPayShort || '2nd Choice Payment'}:</span>
                            <span class="pref-value">${altPayPref}</span>
                        </div>` : ''}
                        ${thirdPayPref ? this._html`
                        <div class="pref-item">
                            <span class="pref-label">${t.thirdPayShort || '3rd Choice Payment'}:</span>
                            <span class="pref-value">${thirdPayPref}</span>
                        </div>` : ''}
                    </div>
                    <p class="pref-note">${t.preferenceNote}</p>
                </div>

                <div class="policy-box">
                    <i class="fas fa-gem"></i>
                    <div>
                        <strong>${t.reapplicationPolicyTitle}</strong>
                        <p>${t.reapplicationPolicyText}</p>
                    </div>
                </div>

                <div class="action-buttons">
                    <a href="${trackUrl}" class="btn-track">
                        <i class="fas fa-folder-open"></i> ${t.trackStatus}
                    </a>
                    <a href="/listings.html" class="btn-new" style="text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:8px;">
                        <i class="fas fa-home"></i> ${t.browseListings}
                    </a>
                </div>

                <div class="spam-warning-notice" style="background:#fff8e1;border:1px solid #ffe082;border-radius:10px;padding:14px 16px;margin:16px 0;font-size:13.5px;color:#5d4037;line-height:1.5;">
                    ${this._safeHtml(t.spamWarning)}
                </div>

                <div class="help-line">
                    ${t.questions} <strong>707-706-3137</strong> — ${t.helpText}
                </div>
            </div>
        `);

        const copyButton = successState.querySelector('.copy-btn');
        sessionStorage.setItem('lastSuccessAppId', appId);
        sessionStorage.setItem('pendingPortalAppId', appId);
        if (copyButton) copyButton.addEventListener('click', () => window.copyAppId());

        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (this._redirectInterval) {
            clearInterval(this._redirectInterval);
            this._redirectInterval = null;
        }
    }

    getTranslations() {
        if (!this.translations) return {};
        return this.translations[this.state.language] || this.translations['en'];
    }

    clearSavedProgress() {
        try { localStorage.removeItem(this.config.LOCAL_STORAGE_KEY); } catch (e) {}
        if (this._autoSaveTimer) {
            clearInterval(this._autoSaveTimer);
            this._autoSaveTimer = null;
        }
    }

    // ================================================================
    // MULTI-APPLICANT REPEATER & APPLICATION CREDIT METHODS
    // ================================================================
    setupCoApplicantsRepeater() {
        const addBtn = document.getElementById('addCoApplicantBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this._addCoApplicantCard({});
                this._syncCoApplicantsJson();
                this._updateTotalFeeDisplay();
                this._updateOccupantsCountSync();
                if (this._updateIncomeRatio) this._updateIncomeRatio();
                this.saveProgress();
            });
        }
    }

    _getRoleHelperText(applicantType, lang) {
        const l = lang || this.state.language || 'en';
        if (l === 'es') {
            if (applicantType === 'guarantor') {
                return 'Garante (No Ocupante): Respalda financieramente el arrendamiento sin vivir en la propiedad. Se recopilan datos financieros y de vivienda actual, omitiendo historial de desalojo o preguntas de ocupante. Tarifa: $50.';
            }
            if (applicantType === 'co_signer') {
                return 'Co-Firmante (Apoyo Financiero): Respalda financieramente la solicitud con clasificación separada de los ocupantes adultos. Se evalúa solvencia financiera e historial sin inflar el conteo de ocupantes. Tarifa: $50.';
            }
            return 'Co-Solicitante (Adulto Ocupante): Residirá en la vivienda y su ingreso cuenta en el ingreso del hogar. Su 1.er co-solicitante ocupante es $0 (Gratis); cada adulto adicional es $50.';
        }
        if (applicantType === 'guarantor') {
            return 'Guarantor (Non-Occupying Financial Support): Guarantees rent obligations without living at the unit. Does not count toward household occupancy or household income; collects housing status & financial ability (no tenant-occupancy questions). Screening fee: $50.';
        }
        if (applicantType === 'co_signer') {
            return 'Co-Signer (Financial Support): Provides separate financial backing for the application without inflating household occupant count or occupant income. Classified distinctly from occupying co-applicants and guarantors. Screening fee: $50.';
        }
        return 'Co-Applicant (Occupying Adult): Adult (18+) who will reside at the property. Counts toward household occupancy & combined household income. Your 1st occupying Co-Applicant is $0 (Free); each additional Co-Applicant is $50.';
    }

    _syncCardFieldVisibility(card) {
        if (!card) return;
        const lang = this.state.language || 'en';
        const roleVal = card.querySelector('.co-role-select')?.value || 'Co-Applicant';
        const applicantType = this._normalizeApplicantType(roleVal, false);
        const methodRadio = card.querySelector('.co-method-radio:checked');
        const method = this._normalizeSubmissionMethod(methodRadio ? methodRadio.value : 'primary_completed');

        // Update method card active styling
        card.querySelectorAll('.method-option-card').forEach(lbl => {
            const inp = lbl.querySelector('.co-method-radio');
            lbl.classList.toggle('active', Boolean(inp && inp.checked));
        });

        // Update card badges & role helper
        const roleBadge = card.querySelector('.co-card-badge');
        if (roleBadge) {
            roleBadge.textContent = this._getShortRoleLabel(applicantType, lang);
            roleBadge.classList.remove('co-card-badge--guarantor', 'co-card-badge--cosigner');
            if (applicantType === 'guarantor') roleBadge.classList.add('co-card-badge--guarantor');
            if (applicantType === 'co_signer') roleBadge.classList.add('co-card-badge--cosigner');
        }
        const methodBadge = card.querySelector('.co-badge-method');
        if (methodBadge) {
            methodBadge.classList.toggle('co-badge-method--invited', method === 'invited');
            methodBadge.textContent = method === 'invited'
                ? (lang === 'es' ? 'Método B · Enlace Privado' : 'Method B · Private Link')
                : (lang === 'es' ? 'Método A · Autorizado por Principal' : 'Method A · Authorized by Primary');
        }
        const t = this.getTranslations();
        const consentTextEl = card.querySelector('.co-consent-text');
        if (consentTextEl) {
            consentTextEl.textContent = method === 'invited'
                ? (t.coConsentLabelMethodB || 'I confirm this person has agreed to be added to this rental application and understand they will receive a private link to complete their details and sign their own screening consent.')
                : (t.coConsentLabelMethodA || 'I certify that I have this person’s explicit permission and legal authority to submit their personal, SSN, and financial details, and I directly authorize Choice Properties and its consumer reporting agencies to conduct credit, background, eviction, and income screening checks on their behalf (no private link or action from them is required).');
        }
        const helperEl = card.querySelector('.co-role-helper');
        if (helperEl) helperEl.textContent = this._getRoleHelperText(applicantType, lang);

        const sameAddrLabelSpan = card.querySelector('.co-same-address-text');
        if (sameAddrLabelSpan) {
            const pHousing = document.getElementById('housingStatus')?.value || 'Rent';
            const sameRent = !pHousing || pHousing === 'Rent';
            sameAddrLabelSpan.textContent = lang === 'es'
                ? (sameRent
                    ? 'Misma dirección actual y arrendador que el Solicitante Principal (Paso 2)'
                    : 'Misma dirección y situación de vivienda actual que el Solicitante Principal (Paso 2)')
                : (sameRent
                    ? 'Same current address & landlord as Primary Applicant (filled in Step 2)'
                    : 'Same current address & housing arrangement as Primary Applicant (filled in Step 2)');
        }

        const methodAOnly = card.querySelector('.co-method-a-only');
        const methodBNotice = card.querySelector('.co-method-b-notice');
        const dobInput = card.querySelector('.co-dob-input');
        const ssnModeSelect = card.querySelector('.co-ssn-mode-select');
        const ssnGroup = card.querySelector('.co-ssn-group');
        const ssnInput = card.querySelector('.co-ssn-input');
        const ssnLabel = card.querySelector('.co-lbl-ssn');
        const govIdType = card.querySelector('.co-gov-id-type');
        const govIdNum = card.querySelector('.co-gov-id-number');
        const occResWrap = card.querySelector('.co-occupant-residency-wrap');
        const suppHousingWrap = card.querySelector('.co-supporter-housing-wrap');
        const disclosuresWrap = card.querySelector('.co-occupant-disclosures-wrap');
        const sameAddrCb = card.querySelector('.co-same-address');
        const occResFields = card.querySelector('.co-residency-fields');

        if (method === 'invited') {
            if (methodAOnly) methodAOnly.style.display = 'none';
            if (methodBNotice) methodBNotice.style.display = 'flex';
            if (dobInput) { dobInput.removeAttribute('required'); this.clearError(dobInput); }
            if (ssnInput) { ssnInput.removeAttribute('required'); this.clearError(ssnInput); }
            if (govIdType) { govIdType.removeAttribute('required'); this.clearError(govIdType); }
            if (govIdNum) { govIdNum.removeAttribute('required'); this.clearError(govIdNum); }
        } else {
            if (methodAOnly) methodAOnly.style.display = '';
            if (methodBNotice) methodBNotice.style.display = 'none';
            if (dobInput) dobInput.setAttribute('required', 'required');

            const ssnMode = ssnModeSelect ? ssnModeSelect.value : 'last4';
            if (ssnMode === 'alternative_id') {
                if (ssnGroup) ssnGroup.style.display = 'none';
                if (ssnInput) {
                    ssnInput.removeAttribute('required');
                    ssnInput.value = '';
                    this.clearError(ssnInput);
                }
                if (govIdType) govIdType.setAttribute('required', 'required');
                if (govIdNum) govIdNum.setAttribute('required', 'required');
            } else {
                if (ssnGroup) ssnGroup.style.display = '';
                if (ssnInput) {
                    ssnInput.setAttribute('required', 'required');
                    ssnInput.maxLength = 4;
                    ssnInput.placeholder = '1234';
                    const digits = String(ssnInput.value || '').replace(/\D/g, '');
                    if (digits.length > 4) ssnInput.value = digits.slice(-4);
                    if (ssnLabel) ssnLabel.textContent = (this.getTranslations().coSsnLabel || (lang === 'es' ? 'SSN (Últimos 4 Dígitos)' : 'SSN (Last 4 Digits)'));
                }
                if (govIdType) { govIdType.removeAttribute('required'); this.clearError(govIdType); }
                if (govIdNum) { govIdNum.removeAttribute('required'); this.clearError(govIdNum); }
            }

            const isOccupant = applicantType === 'co_applicant';
            if (occResWrap) occResWrap.style.display = isOccupant ? '' : 'none';
            if (suppHousingWrap) suppHousingWrap.style.display = isOccupant ? 'none' : '';
            if (disclosuresWrap) disclosuresWrap.style.display = isOccupant ? '' : 'none';
            if (occResFields && sameAddrCb) {
                occResFields.style.display = sameAddrCb.checked ? 'none' : '';
            }
            this._syncCoHousingUi(card);
            this._syncCoEmploymentUi(card);
        }
    }

    _syncCoHousingUi(card) {
        if (!card) return;
        const lang = this.state.language || 'en';
        const roleVal = card.querySelector('.co-role-select')?.value || 'Co-Applicant';
        const isOccupant = this._normalizeApplicantType(roleVal, false) === 'co_applicant';

        if (isOccupant) {
            const sameAddr = !!card.querySelector('.co-same-address')?.checked;
            const status = sameAddr ? '' : String(card.querySelector('.co-occ-housing-status')?.value || 'Rent').trim();
            const llRow = card.querySelector('.co-occ-landlord-row');
            const llNameLbl = card.querySelector('.co-occ-lbl-landlord-name');
            const llPhoneLbl = card.querySelector('.co-occ-lbl-landlord-phone');
            const llNameInput = card.querySelector('.co-landlord-name');
            const llPhoneInput = card.querySelector('.co-landlord-phone');

            if (sameAddr || status === 'Own') {
                if (llRow) llRow.style.display = 'none';
                if (!sameAddr && status === 'Own') {
                    if (llNameInput) llNameInput.value = '';
                    if (llPhoneInput) llPhoneInput.value = '';
                }
            } else if (status === 'Mortgage') {
                if (llRow) llRow.style.display = '';
                if (llNameLbl) llNameLbl.textContent = lang === 'es' ? 'Banco / Administrador de Hipoteca (Opcional)' : 'Mortgage Lender / Servicer (Optional)';
                if (llPhoneLbl) llPhoneLbl.textContent = lang === 'es' ? 'Teléfono del Banco / Entidad (Opcional)' : 'Lender / Servicer Phone (Optional)';
                if (llNameInput) llNameInput.placeholder = lang === 'es' ? 'Opcional' : 'Optional';
            } else if (status === 'Living with Family' || status === 'Family') {
                if (llRow) llRow.style.display = '';
                if (llNameLbl) llNameLbl.textContent = lang === 'es' ? 'Nombre del Anfitrión / Familiar (Opcional)' : 'Host / Family Member Name (Optional)';
                if (llPhoneLbl) llPhoneLbl.textContent = lang === 'es' ? 'Teléfono del Anfitrión (Opcional)' : 'Host / Family Phone (Optional)';
                if (llNameInput) llNameInput.placeholder = lang === 'es' ? 'Persona con quien reside (opcional)' : 'Person they live with (optional)';
            } else if (status === 'Other') {
                if (llRow) llRow.style.display = '';
                if (llNameLbl) llNameLbl.textContent = lang === 'es' ? 'Contacto de Propiedad (Opcional)' : 'Property Contact (Optional)';
                if (llPhoneLbl) llPhoneLbl.textContent = lang === 'es' ? 'Teléfono de Contacto (Opcional)' : 'Contact Phone (Optional)';
                if (llNameInput) llNameInput.placeholder = '';
            } else {
                if (llRow) llRow.style.display = '';
                if (llNameLbl) llNameLbl.textContent = lang === 'es' ? 'Arrendador / Administrador Actual' : 'Current Landlord / Manager';
                if (llPhoneLbl) llPhoneLbl.textContent = lang === 'es' ? 'Teléfono del Arrendador' : 'Landlord Phone';
                if (llNameInput) llNameInput.placeholder = '';
            }
        } else {
            const supStatus = String(card.querySelector('.co-housing-status')?.value || '').trim();
            const notesInput = card.querySelector('.co-financial-notes');
            const notesLbl = card.querySelector('.co-lbl-financial-notes');
            if (notesLbl) {
                notesLbl.textContent = lang === 'es' ? 'Notas de Respaldo Financiero (Opcional)' : 'Financial Support Notes (Optional)';
            }
            if (notesInput) {
                if (supStatus === 'Own') {
                    notesInput.placeholder = lang === 'es'
                        ? 'ej., Propiedad pagada, ahorros líquidos, alcance del respaldo'
                        : 'e.g., Paid-off home equity, liquid reserves, rental backing scope';
                } else if (supStatus === 'Mortgage') {
                    notesInput.placeholder = lang === 'es'
                        ? 'ej., Pago hipotecario actual, reservas líquidas, relación'
                        : 'e.g., Current mortgage payment, liquid reserves, relationship';
                } else if (supStatus === 'Rent') {
                    notesInput.placeholder = lang === 'es'
                        ? 'ej., Renta mensual actual, ahorros disponibles, relación'
                        : 'e.g., Current monthly rent, savings available, relationship';
                } else if (supStatus === 'Living with Family' || supStatus === 'Family' || supStatus === 'Other') {
                    notesInput.placeholder = lang === 'es'
                        ? 'ej., Arreglo de vivienda, reservas líquidas, respaldo mensual'
                        : 'e.g., Living arrangement, liquid reserves, monthly support scope';
                } else {
                    notesInput.placeholder = lang === 'es'
                        ? 'ej., Ahorros, cobertura de renta mensual, relación'
                        : 'e.g., Liquid reserves, rental backing scope, relationship';
                }
            }
        }
    }

    _syncCoEmploymentUi(card) {
        if (!card) return;
        const lang = this.state.language || 'en';
        const status = String(card.querySelector('.co-employment-status')?.value || 'Full-time').trim();

        const empCol = card.querySelector('.co-employer-col');
        const jobCol = card.querySelector('.co-job-title-col');
        const durCol = card.querySelector('.co-emp-dur-col');
        const empRow2 = card.querySelector('.co-emp-row-2');

        const empInput = card.querySelector('.co-employer');
        const jobInput = card.querySelector('.co-job-title');
        const durInput = card.querySelector('.co-employment-duration');
        const incInput = card.querySelector('.co-monthly-income');

        const empLbl = card.querySelector('.co-lbl-employer');
        const jobLbl = card.querySelector('.co-lbl-job-title');
        const durLbl = card.querySelector('.co-lbl-emp-dur');
        const incLbl = card.querySelector('.co-lbl-monthly-income');
        const otherLbl = card.querySelector('.co-lbl-other-income');

        if (otherLbl) {
            otherLbl.textContent = lang === 'es' ? 'Ingreso Suplementario Mensual ($)' : 'Supplemental Monthly Income ($)';
        }

        if (status === 'Unemployed') {
            if (empCol) empCol.style.display = 'none';
            if (jobCol) jobCol.style.display = 'none';
            if (durCol) durCol.style.display = 'none';
            if (empRow2) empRow2.style.display = 'none';
            if (empInput) empInput.value = '';
            if (jobInput) jobInput.value = '';
            if (durInput) durInput.value = '';
            if (incLbl) {
                incLbl.textContent = lang === 'es'
                    ? 'Asistencia / Desempleo / Ahorros ($0 si ninguno)'
                    : 'Monthly Assistance / Savings Draw ($0 if none)';
            }
            if (incInput) incInput.placeholder = '0';
        } else if (status === 'Retired') {
            if (empCol) empCol.style.display = '';
            if (jobCol) jobCol.style.display = '';
            if (durCol) durCol.style.display = '';
            if (empRow2) empRow2.style.display = '';
            if (empLbl) empLbl.textContent = lang === 'es' ? 'Fuente de Jubilación / Pensión (Opcional)' : 'Retirement / Pension Source (Optional)';
            if (jobLbl) jobLbl.textContent = lang === 'es' ? 'Cargo Anterior (Opcional)' : 'Former Role / Title (Optional)';
            if (durLbl) durLbl.textContent = lang === 'es' ? 'Años Retirado (Opcional)' : 'Years Retired (Optional)';
            if (incLbl) incLbl.textContent = lang === 'es' ? 'Ingreso Mensual de Pensión / Beneficios ($)' : 'Monthly Pension / Benefit Income ($)';
            if (incInput) incInput.placeholder = lang === 'es' ? 'ej., 2800' : 'e.g., 2800';
        } else if (status === 'Student') {
            if (empCol) empCol.style.display = '';
            if (jobCol) jobCol.style.display = '';
            if (durCol) durCol.style.display = '';
            if (empRow2) empRow2.style.display = '';
            if (empLbl) empLbl.textContent = lang === 'es' ? 'Escuela / Institución (Opcional)' : 'School / Institution (Optional)';
            if (jobLbl) jobLbl.textContent = lang === 'es' ? 'Programa / Estudio (Opcional)' : 'Program / Study Field (Optional)';
            if (durLbl) durLbl.textContent = lang === 'es' ? 'Años en Institución (Opcional)' : 'Years at Institution (Optional)';
            if (incLbl) incLbl.textContent = lang === 'es' ? 'Ingreso / Ayuda / Apoyo Mensual ($0 si ninguno)' : 'Monthly Income / Aid / Support ($0 if none)';
            if (incInput) incInput.placeholder = lang === 'es' ? 'ej., 1200 o 0' : 'e.g., 1200 or 0';
        } else if (status === 'Self-employed') {
            if (empCol) empCol.style.display = '';
            if (jobCol) jobCol.style.display = '';
            if (durCol) durCol.style.display = '';
            if (empRow2) empRow2.style.display = '';
            if (empLbl) empLbl.textContent = lang === 'es' ? 'Nombre del Negocio' : 'Business / Trade Name';
            if (jobLbl) jobLbl.textContent = lang === 'es' ? 'Rol / Ocupación' : 'Role / Occupation';
            if (durLbl) durLbl.textContent = lang === 'es' ? 'Tiempo en el Negocio' : 'Time in Business';
            if (incLbl) incLbl.textContent = lang === 'es' ? 'Ingreso Bruto Mensual del Negocio ($)' : 'Gross Monthly Business Income ($)';
            if (incInput) incInput.placeholder = lang === 'es' ? 'ej., 4500' : 'e.g., 4500';
        } else {
            if (empCol) empCol.style.display = '';
            if (jobCol) jobCol.style.display = '';
            if (durCol) durCol.style.display = '';
            if (empRow2) empRow2.style.display = '';
            if (empLbl) empLbl.textContent = lang === 'es' ? 'Empleador / Negocio' : 'Employer / Business';
            if (jobLbl) jobLbl.textContent = lang === 'es' ? 'Puesto / Cargo' : 'Position / Job Title';
            if (durLbl) durLbl.textContent = lang === 'es' ? 'Tiempo en el empleo' : 'Duration of Employment';
            if (incLbl) incLbl.textContent = lang === 'es' ? 'Ingreso Mensual Bruto ($)' : 'Gross Monthly Income ($)';
            if (incInput) incInput.placeholder = lang === 'es' ? 'ej., 4000' : 'e.g., 4000';
        }
    }

    _refreshCoApplicantCardLanguage(card) {
        if (!card) return;
        const lang = this.state.language || 'en';
        const t = this.getTranslations();
        const roleSelect = card.querySelector('.co-role-select');
        if (roleSelect && roleSelect.options.length >= 3) {
            roleSelect.options[0].textContent = t.roleCoApplicant || 'Co-Applicant (Occupying Adult)';
            roleSelect.options[1].textContent = t.roleGuarantor || 'Guarantor (Non-Occupying Financial Support)';
            roleSelect.options[2].textContent = t.roleCoSigner || 'Co-Signer (Financial Support)';
        }
        const setTxt = (sel, txt) => { const el = card.querySelector(sel); if (el && txt) el.textContent = txt; };
        setTxt('.co-lbl-role', t.coRoleLabel);
        setTxt('.co-lbl-method', t.coMethodLabel);
        setTxt('.co-method-a-title', t.methodATitle);
        setTxt('.co-method-a-desc', t.methodADesc);
        setTxt('.co-method-b-title', t.methodBTitle);
        setTxt('.co-method-b-desc', t.methodBDesc);
        setTxt('.co-lbl-first', t.coFirstNameLabel);
        setTxt('.co-lbl-last', t.coLastNameLabel);
        setTxt('.co-lbl-email', t.coEmailLabel);
        setTxt('.co-lbl-phone', t.coPhoneLabel);
        setTxt('.co-lbl-dob', t.coDobLabel);
        setTxt('.co-lbl-ssn', t.coSsnLabel);
        setTxt('.co-residency-heading', lang === 'es' ? 'Historial Residencial y Arrendador' : 'Residential & Landlord History');
        setTxt('.co-supporter-heading', lang === 'es' ? 'Residencia y Capacidad Financiera del Respaldo' : 'Supporter Residential & Financial Standing');
        setTxt('.co-emp-heading', lang === 'es' ? 'Empleo e Ingresos' : 'Employment & Income');
        setTxt('.co-disclosures-heading', lang === 'es' ? 'Divulgaciones de Ocupante' : 'Occupant Disclosures');
        setTxt('.co-lbl-occ-address', lang === 'es' ? 'Dirección Actual' : 'Current Address');
        setTxt('.co-lbl-occ-duration', lang === 'es' ? 'Tiempo en Dirección Actual' : 'Time at Current Address');
        setTxt('.co-lbl-occ-housing-status', lang === 'es' ? 'Situación de Vivienda' : 'Housing Status');
        setTxt('.co-lbl-supporter-address', lang === 'es' ? 'Dirección Residencial Actual' : 'Current Residential Address');
        setTxt('.co-lbl-housing-status', lang === 'es' ? 'Situación de Vivienda' : 'Housing Status');
        setTxt('.co-lbl-emp-status', lang === 'es' ? 'Estado de Empleo' : 'Employment Status');
        const syncHousingOpt = (sel) => {
            if (!sel || sel.options.length < 5) return;
            const opts = Array.from(sel.options);
            opts.forEach(o => {
                if (o.value === '') o.textContent = lang === 'es' ? 'Seleccionar...' : 'Select housing status...';
                else if (o.value === 'Rent') o.textContent = t.housingRent || 'Rent';
                else if (o.value === 'Own') o.textContent = t.housingOwn || 'Own (No Mortgage)';
                else if (o.value === 'Mortgage') o.textContent = t.housingMortgage || 'Own (With Mortgage)';
                else if (o.value === 'Living with Family' || o.value === 'Family') o.textContent = t.housingFamily || 'Living with Family / Friends';
                else if (o.value === 'Other') o.textContent = t.housingOther || 'Other';
            });
        };
        syncHousingOpt(card.querySelector('.co-occ-housing-status'));
        syncHousingOpt(card.querySelector('.co-housing-status'));

        const method = this._normalizeSubmissionMethod(card.querySelector('.co-method-radio:checked')?.value);
        setTxt('.co-consent-text', method === 'invited' ? (t.coConsentLabelMethodB || t.coConsentLabel) : (t.coConsentLabelMethodA || t.coConsentLabel));
        const ssnModeSel = card.querySelector('.co-ssn-mode-select');
        if (ssnModeSel && ssnModeSel.options.length >= 2) {
            ssnModeSel.options[0].textContent = lang === 'es' ? 'Últimos 4 dígitos del SSN (Estándar)' : 'Last 4 Digits of SSN (Standard)';
            ssnModeSel.options[1].textContent = lang === 'es' ? 'Sin SSN — Usar ID oficial / Pasaporte / ITIN' : 'No SSN — Use Gov ID / Passport / ITIN';
        }
        const methodBText = card.querySelector('.co-method-b-text');
        if (methodBText) {
            methodBText.textContent = lang === 'es'
                ? 'Después de enviar la solicitud, esta persona recibirá un enlace privado seguro para ingresar su fecha de nacimiento, los últimos 4 dígitos de su SSN, historial/solvencia, cargar sus documentos de respaldo y firmar su consentimiento de evaluación — sin crear solicitudes duplicadas.'
                : 'After submission, this person will receive a private secure link to enter their own DOB, last 4 digits of SSN, financial details, upload supporting documents, and sign their screening consent — without creating a duplicate application.';
        }
        this._syncCardFieldVisibility(card);
    }

    _refreshAllCoApplicantCardsLanguage() {
        const container = document.getElementById('coApplicantsContainer');
        if (!container) return;
        this._renumberCoApplicantCards();
        Array.from(container.children).forEach(card => this._refreshCoApplicantCardLanguage(card));
    }

    _addCoApplicantCard(initial = {}) {
        const container = document.getElementById('coApplicantsContainer');
        if (!container) return null;
        const lang = this.state.language || 'en';
        const t = this.getTranslations();
        const idx = container.children.length;
        const num = idx + 1;

        const applicantType = this._normalizeApplicantType(initial.applicant_type || initial.role, false);
        const roleVal = applicantType === 'guarantor' ? 'Guarantor' : (applicantType === 'co_signer' ? 'Co-Signer' : 'Co-Applicant');
        const methodVal = this._normalizeSubmissionMethod(initial.submission_method);
        const sameAddrChecked = initial.same_address === true;
        const uid = `${Date.now()}_${idx}_${Math.floor(Math.random() * 1000)}`;
        const methodName = `co_method_${uid}`;
        const evName = `co_evicted_${uid}`;
        const smName = `co_smoker_${uid}`;

        const card = document.createElement('div');
        card.className = 'co-applicant-card';
        card.dataset.coIdx = String(idx);

        this._setTrustedHtml(card, this._html`
            <div class="co-card-top">
                <div class="co-card-title">
                    <i class="fas fa-user-check"></i>
                    <span class="co-card-heading">${lang === 'es' ? `Miembro Adicional #${num}` : `Household Member #${num}`}</span>
                    <div class="co-badges-row">
                        <span class="co-card-badge">${this._getShortRoleLabel(applicantType, lang)}</span>
                        <span class="co-badge-method"></span>
                    </div>
                </div>
                <button type="button" class="btn-remove-co"><i class="fas fa-trash-alt"></i> ${lang === 'es' ? 'Eliminar' : 'Remove'}</button>
            </div>

            <div class="form-group">
                <label class="required co-lbl-role">${t.coRoleLabel || 'Role Classification'}</label>
                <select class="co-role-select" required>
                    <option value="Co-Applicant" ${roleVal === 'Co-Applicant' ? 'selected' : ''}>${t.roleCoApplicant || 'Co-Applicant (Occupying Adult)'}</option>
                    <option value="Guarantor" ${roleVal === 'Guarantor' ? 'selected' : ''}>${t.roleGuarantor || 'Guarantor (Non-Occupying Financial Support)'}</option>
                    <option value="Co-Signer" ${roleVal === 'Co-Signer' ? 'selected' : ''}>${t.roleCoSigner || 'Co-Signer (Financial Support)'}</option>
                </select>
                <div class="role-helper-banner co-role-helper"></div>
            </div>

            <div class="form-group">
                <label class="required co-lbl-method">${t.coMethodLabel || 'Information Submission Method'}</label>
                <div class="method-selector-grid">
                    <label class="method-option-card ${methodVal === 'primary_completed' ? 'active' : ''}">
                        <input type="radio" class="co-method-radio" name="${methodName}" value="primary_completed" ${methodVal === 'primary_completed' ? 'checked' : ''}>
                        <div class="method-option-body">
                            <div class="method-option-title co-method-a-title">${t.methodATitle || 'Method A: Primary enters & authorizes now'}</div>
                            <div class="method-option-desc co-method-a-desc">${t.methodADesc || 'You complete their details and authorize screening on their behalf right here — no private link or involvement required from them.'}</div>
                        </div>
                    </label>
                    <label class="method-option-card ${methodVal === 'invited' ? 'active' : ''}">
                        <input type="radio" class="co-method-radio" name="${methodName}" value="invited" ${methodVal === 'invited' ? 'checked' : ''}>
                        <div class="method-option-body">
                            <div class="method-option-title co-method-b-title">${t.methodBTitle || 'Method B: Send private self-complete link'}</div>
                            <div class="method-option-desc co-method-b-desc">${t.methodBDesc || 'Enter only Name, Email, Phone & Role. They complete sensitive details & upload docs privately.'}</div>
                        </div>
                    </label>
                </div>
            </div>

            <div class="form-row">
                <div class="form-col"><div class="form-group">
                    <label class="required co-lbl-first">${t.coFirstNameLabel || 'First Name'}</label>
                    <input type="text" class="co-first-name" required value="${initial.first_name || ''}">
                    <div class="error-message"></div>
                </div></div>
                <div class="form-col"><div class="form-group">
                    <label class="required co-lbl-last">${t.coLastNameLabel || 'Last Name'}</label>
                    <input type="text" class="co-last-name" required value="${initial.last_name || ''}">
                    <div class="error-message"></div>
                </div></div>
            </div>

            <div class="form-row">
                <div class="form-col"><div class="form-group">
                    <label class="required co-lbl-email">${t.coEmailLabel || 'Email Address'}</label>
                    <input type="email" class="co-email-input" required placeholder="unique@example.com" value="${initial.email || ''}">
                    <div class="error-message"></div>
                </div></div>
                <div class="form-col"><div class="form-group">
                    <label class="required co-lbl-phone">${t.coPhoneLabel || 'Phone Number'}</label>
                    <input type="tel" class="co-phone-input" required inputmode="tel" placeholder="(555) 000-0000" value="${initial.phone || ''}">
                    <div class="error-message"></div>
                </div></div>
            </div>

            <div class="method-b-notice co-method-b-notice" style="display:none;">
                <i class="fas fa-envelope-open-text"></i>
                <div class="co-method-b-text">${lang === 'es'
                    ? 'Después de enviar la solicitud, esta persona recibirá un enlace privado seguro para ingresar su fecha de nacimiento, los últimos 4 dígitos de su SSN, historial/solvencia, cargar sus documentos de respaldo y firmar su consentimiento de evaluación — sin crear solicitudes duplicadas.'
                    : 'After submission, this person will receive a private secure link to enter their own DOB, last 4 digits of SSN, financial details, upload supporting documents, and sign their screening consent — without creating a duplicate application.'}</div>
            </div>

            <div class="co-method-a-only">
                <div class="form-row">
                    <div class="form-col"><div class="form-group">
                        <label class="required co-lbl-dob">${t.coDobLabel || 'Date of Birth (18+)'}</label>
                        <input type="date" class="co-dob-input" required value="${initial.dob || ''}">
                        <div class="error-message"></div>
                    </div></div>
                    <div class="form-col"><div class="form-group">
                        <label class="co-lbl-ssn-mode">${lang === 'es' ? 'Verificación de Identidad / SSN' : 'SSN / Verification Option'}</label>
                        <select class="co-ssn-mode-select">
                            <option value="last4" ${initial.ssn_mode !== 'alternative_id' ? 'selected' : ''}>${lang === 'es' ? 'Últimos 4 dígitos del SSN (Estándar)' : 'Last 4 Digits of SSN (Standard)'}</option>
                            <option value="alternative_id" ${initial.ssn_mode === 'alternative_id' ? 'selected' : ''}>${lang === 'es' ? 'Sin SSN — Usar ID oficial / Pasaporte / ITIN' : 'No SSN — Use Gov ID / Passport / ITIN'}</option>
                        </select>
                    </div></div>
                </div>

                <div class="form-group co-ssn-group">
                    <label class="required co-lbl-ssn">${t.coSsnLabel || 'SSN (Last 4 Digits)'}</label>
                    <div class="ssn-container">
                        <input type="password" class="co-ssn-input" required maxlength="4" inputmode="numeric" placeholder="1234" autocomplete="off" value="${initial.ssn ? String(initial.ssn).replace(/\D/g, '').slice(-4) : ''}">
                    </div>
                    <div class="error-message"></div>
                </div>

                <div class="form-row">
                    <div class="form-col"><div class="form-group">
                        <label>${lang === 'es' ? 'Tipo de Identificación Oficial (Opcional)' : 'Government ID Type (Optional / Alt ID)'}</label>
                        <select class="co-gov-id-type">
                            <option value="">${lang === 'es' ? 'Seleccionar tipo...' : 'Select ID type...'}</option>
                            <option value="Driver's License" ${initial.government_id_type === "Driver's License" ? 'selected' : ''}>Driver's License</option>
                            <option value="State ID" ${initial.government_id_type === 'State ID' ? 'selected' : ''}>State ID</option>
                            <option value="U.S. Passport" ${initial.government_id_type === 'U.S. Passport' ? 'selected' : ''}>U.S. Passport</option>
                            <option value="Foreign Passport / Visa" ${initial.government_id_type === 'Foreign Passport / Visa' ? 'selected' : ''}>Foreign Passport / Visa</option>
                            <option value="ITIN Letter" ${initial.government_id_type === 'ITIN Letter' ? 'selected' : ''}>ITIN Letter</option>
                            <option value="Military ID" ${initial.government_id_type === 'Military ID' ? 'selected' : ''}>Military ID</option>
                        </select>
                        <div class="error-message"></div>
                    </div></div>
                    <div class="form-col"><div class="form-group">
                        <label>${lang === 'es' ? 'Número de Identificación (Opcional)' : 'Government ID Number (Optional / Alt ID)'}</label>
                        <input type="text" class="co-gov-id-number" placeholder="${lang === 'es' ? 'No se guarda en borradores' : 'Not stored in drafts'}" autocomplete="off" value="">
                        <div class="error-message"></div>
                    </div></div>
                </div>

                <div class="co-occupant-residency-wrap">
                    <div class="co-sub-heading co-residency-heading">${lang === 'es' ? 'Historial Residencial y Arrendador' : 'Residential & Landlord History'}</div>
                    <div class="form-group" style="margin-bottom:10px;">
                        <label style="display:flex;align-items:center;gap:8px;font-weight:500;cursor:pointer;">
                            <input type="checkbox" class="co-same-address" ${sameAddrChecked ? 'checked' : ''}>
                            <span class="co-same-address-text">${lang === 'es' ? 'Misma dirección actual y arrendador que el Solicitante Principal (Paso 2)' : 'Same current address & landlord as Primary Applicant (filled in Step 2)'}</span>
                        </label>
                    </div>
                    <div class="co-residency-fields" style="${sameAddrChecked ? 'display:none;' : ''}">
                        <div class="form-group">
                            <label class="co-lbl-occ-housing-status">${lang === 'es' ? 'Situación de Vivienda' : 'Housing Status'}</label>
                            <select class="co-occ-housing-status">
                                <option value="Rent" ${(!initial.housing_status || initial.housing_status === 'Rent') ? 'selected' : ''}>${t.housingRent || 'Rent'}</option>
                                <option value="Own" ${initial.housing_status === 'Own' ? 'selected' : ''}>${t.housingOwn || 'Own (No Mortgage)'}</option>
                                <option value="Mortgage" ${initial.housing_status === 'Mortgage' ? 'selected' : ''}>${t.housingMortgage || 'Own (With Mortgage)'}</option>
                                <option value="Living with Family" ${(initial.housing_status === 'Living with Family' || initial.housing_status === 'Family') ? 'selected' : ''}>${t.housingFamily || 'Living with Family / Friends'}</option>
                                <option value="Other" ${initial.housing_status === 'Other' ? 'selected' : ''}>${t.housingOther || 'Other'}</option>
                            </select>
                        </div>
                        <div class="form-row">
                            <div class="form-col"><div class="form-group">
                                <label class="co-lbl-occ-address">${lang === 'es' ? 'Dirección Actual' : 'Current Address'}</label>
                                <input type="text" class="co-current-address" placeholder="Street, City, State, Zip" value="${initial.current_address || ''}">
                            </div></div>
                            <div class="form-col"><div class="form-group">
                                <label class="co-lbl-occ-duration">${lang === 'es' ? 'Tiempo en Dirección Actual' : 'Time at Current Address'}</label>
                                <input type="text" class="co-residency-duration" placeholder="e.g., 2 years" value="${initial.residency_duration || ''}">
                            </div></div>
                        </div>
                        <div class="form-row co-occ-landlord-row">
                            <div class="form-col co-occ-landlord-name-col"><div class="form-group">
                                <label class="co-occ-lbl-landlord-name">${lang === 'es' ? 'Arrendador / Administrador Actual' : 'Current Landlord / Manager'}</label>
                                <input type="text" class="co-landlord-name" value="${initial.current_landlord_name || ''}">
                            </div></div>
                            <div class="form-col co-occ-landlord-phone-col"><div class="form-group">
                                <label class="co-occ-lbl-landlord-phone">${lang === 'es' ? 'Teléfono del Arrendador' : 'Landlord Phone'}</label>
                                <input type="tel" class="co-landlord-phone" inputmode="tel" value="${initial.landlord_phone || ''}">
                            </div></div>
                        </div>
                    </div>
                </div>

                <div class="co-supporter-housing-wrap" style="display:none;">
                    <div class="co-sub-heading co-supporter-heading">${lang === 'es' ? 'Residencia y Capacidad Financiera del Respaldo' : 'Supporter Residential & Financial Standing'}</div>
                    <div class="form-row">
                        <div class="form-col"><div class="form-group">
                            <label class="co-lbl-supporter-address">${lang === 'es' ? 'Dirección Residencial Actual' : 'Current Residential Address'}</label>
                            <input type="text" class="co-supporter-address" placeholder="Street, City, State, Zip" value="${initial.current_address || ''}">
                        </div></div>
                        <div class="form-col"><div class="form-group">
                            <label class="co-lbl-housing-status">${lang === 'es' ? 'Situación de Vivienda' : 'Housing Status'}</label>
                            <select class="co-housing-status">
                                <option value="">${lang === 'es' ? 'Seleccionar...' : 'Select housing status...'}</option>
                                <option value="Own" ${initial.housing_status === 'Own' ? 'selected' : ''}>${t.housingOwn || (lang === 'es' ? 'Propietario (Sin Hipoteca)' : 'Own (No Mortgage)')}</option>
                                <option value="Mortgage" ${initial.housing_status === 'Mortgage' ? 'selected' : ''}>${t.housingMortgage || (lang === 'es' ? 'Propietario (Con Hipoteca)' : 'Own (With Mortgage)')}</option>
                                <option value="Rent" ${initial.housing_status === 'Rent' ? 'selected' : ''}>${t.housingRent || (lang === 'es' ? 'Renta' : 'Rent')}</option>
                                <option value="Living with Family" ${(initial.housing_status === 'Living with Family' || initial.housing_status === 'Family') ? 'selected' : ''}>${t.housingFamily || (lang === 'es' ? 'Vive con Familia / Amigos' : 'Living with Family / Friends')}</option>
                                <option value="Other" ${initial.housing_status === 'Other' ? 'selected' : ''}>${t.housingOther || (lang === 'es' ? 'Otro' : 'Other')}</option>
                            </select>
                        </div></div>
                    </div>
                    <div class="form-group">
                        <label class="co-lbl-financial-notes">${lang === 'es' ? 'Notas de Respaldo Financiero (Opcional)' : 'Financial Support Notes (Optional)'}</label>
                        <input type="text" class="co-financial-notes" placeholder="${lang === 'es' ? 'ej., Ahorros, cobertura de renta mensual, relación' : 'e.g., Liquid reserves, rental backing scope, relationship'}" value="${initial.financial_support_notes || ''}">
                    </div>
                </div>

                <div class="co-sub-heading co-emp-heading">${lang === 'es' ? 'Empleo e Ingresos' : 'Employment & Income'}</div>
                <div class="form-row">
                    <div class="form-col co-emp-status-col"><div class="form-group">
                        <label class="co-lbl-emp-status">${lang === 'es' ? 'Estado de Empleo' : 'Employment Status'}</label>
                        <select class="co-employment-status">
                            <option value="Full-time" ${initial.employment_status === 'Full-time' || !initial.employment_status ? 'selected' : ''}>Full-time</option>
                            <option value="Part-time" ${initial.employment_status === 'Part-time' ? 'selected' : ''}>Part-time</option>
                            <option value="Self-employed" ${initial.employment_status === 'Self-employed' ? 'selected' : ''}>Self-employed</option>
                            <option value="Student" ${initial.employment_status === 'Student' ? 'selected' : ''}>Student</option>
                            <option value="Retired" ${initial.employment_status === 'Retired' ? 'selected' : ''}>Retired</option>
                            <option value="Unemployed" ${initial.employment_status === 'Unemployed' ? 'selected' : ''}>Unemployed</option>
                        </select>
                    </div></div>
                    <div class="form-col co-employer-col"><div class="form-group">
                        <label class="co-lbl-employer">${t.coEmployerLabel || 'Employer / Business'}</label>
                        <input type="text" class="co-employer" value="${initial.employer || ''}">
                    </div></div>
                </div>
                <div class="form-row co-emp-row-2">
                    <div class="form-col co-job-title-col"><div class="form-group">
                        <label class="co-lbl-job-title">${t.coJobTitleLabel || 'Position / Job Title'}</label>
                        <input type="text" class="co-job-title" value="${initial.job_title || ''}">
                    </div></div>
                    <div class="form-col co-emp-dur-col"><div class="form-group">
                        <label class="co-lbl-emp-dur">${t.coEmploymentDurationLabel || 'Duration of Employment'}</label>
                        <input type="text" class="co-employment-duration" placeholder="e.g., 3 years" value="${initial.employment_duration || ''}">
                    </div></div>
                </div>
                <div class="form-row co-income-row">
                    <div class="form-col co-income-col"><div class="form-group">
                        <label class="co-lbl-monthly-income">${t.coMonthlyIncomeLabel || 'Gross Monthly Income ($)'}</label>
                        <input type="text" class="co-monthly-income" inputmode="decimal" placeholder="e.g., 4000" value="${initial.monthly_income || ''}">
                    </div></div>
                    <div class="form-col co-other-income-col"><div class="form-group">
                        <label class="co-lbl-other-income">${lang === 'es' ? 'Ingreso Suplementario Mensual ($)' : 'Supplemental Monthly Income ($)'}</label>
                        <input type="text" class="co-other-income" inputmode="decimal" placeholder="${lang === 'es' ? 'Opcional' : 'Optional'}" value="${initial.other_income || ''}">
                    </div></div>
                </div>

                <div class="co-occupant-disclosures-wrap">
                    <div class="co-sub-heading co-disclosures-heading">${lang === 'es' ? 'Divulgaciones de Ocupante' : 'Occupant Disclosures'}</div>
                    <div class="form-row">
                        <div class="form-col"><div class="form-group">
                            <label>${lang === 'es' ? '¿Desalojo previo?' : 'Ever Evicted?'}</label>
                            <div class="checkbox-group">
                                <div class="checkbox-item"><input type="radio" class="co-evicted" name="${evName}" value="Yes" ${initial.ever_evicted ? 'checked' : ''}><label>${lang === 'es' ? 'Sí' : 'Yes'}</label></div>
                                <div class="checkbox-item"><input type="radio" class="co-evicted" name="${evName}" value="No" ${!initial.ever_evicted ? 'checked' : ''}><label>No</label></div>
                            </div>
                        </div></div>
                        <div class="form-col"><div class="form-group">
                            <label>${lang === 'es' ? '¿Fuma?' : 'Smoker?'}</label>
                            <div class="checkbox-group">
                                <div class="checkbox-item"><input type="radio" class="co-smoker" name="${smName}" value="Yes" ${initial.smoker ? 'checked' : ''}><label>${lang === 'es' ? 'Sí' : 'Yes'}</label></div>
                                <div class="checkbox-item"><input type="radio" class="co-smoker" name="${smName}" value="No" ${!initial.smoker ? 'checked' : ''}><label>No</label></div>
                            </div>
                        </div></div>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-col"><div class="form-group">
                        <label>${lang === 'es' ? 'Referencia (Opcional)' : 'Reference Name (Optional)'}</label>
                        <input type="text" class="co-ref1-name" value="${initial.reference_1_name || ''}">
                    </div></div>
                    <div class="form-col"><div class="form-group">
                        <label>${lang === 'es' ? 'Teléfono de Referencia (Opcional)' : 'Reference Phone (Optional)'}</label>
                        <input type="tel" class="co-ref1-phone" inputmode="tel" value="${initial.reference_1_phone || ''}">
                    </div></div>
                </div>
            </div>

            <div class="form-group" style="margin-top:10px;">
                <div class="custom-checkbox">
                    <input type="checkbox" class="co-consent-input" required ${initial.screening_consent ? 'checked' : ''}>
                    <label class="co-consent-text">${methodVal === 'invited' ? (t.coConsentLabelMethodB || 'I confirm this person has agreed to be added to this rental application and understand they will receive a private link to complete their details and sign their own screening consent.') : (t.coConsentLabelMethodA || t.coConsentLabel || 'I certify that I have this person’s explicit permission and legal authority to submit their personal, SSN, and financial details, and I directly authorize Choice Properties and its consumer reporting agencies to conduct credit, background, eviction, and income screening checks on their behalf (no private link or action from them is required).')}</label>
                </div>
                <div class="error-message"></div>
            </div>
        `);

        // Attach eye toggle & formatting + SSN mode switch
        const ssnInput = card.querySelector('.co-ssn-input');
        const ssnModeSelect = card.querySelector('.co-ssn-mode-select');
        this._attachSsnToggle(ssnInput);
        if (ssnModeSelect) {
            ssnModeSelect.addEventListener('change', () => {
                this._syncCardFieldVisibility(card);
                this._syncCoApplicantsJson();
                this.updateFieldsRemainingHint(4);
                this.saveProgress();
            });
        }
        if (ssnInput) {
            ssnInput.addEventListener('input', (e) => {
                const mode = ssnModeSelect ? ssnModeSelect.value : 'last4';
                e.target.value = String(e.target.value || '').replace(/\D/g, '').slice(0, 4);
                if (this._validateSsnByMode(e.target.value, mode).ok) {
                    this.clearError(ssnInput);
                    ssnInput.classList.add('is-valid');
                    ssnInput.classList.remove('is-invalid');
                }
            });
            ssnInput.addEventListener('blur', () => {
                const method = this._normalizeSubmissionMethod(card.querySelector('.co-method-radio:checked')?.value);
                const mode = ssnModeSelect ? ssnModeSelect.value : 'last4';
                if (method === 'primary_completed' && mode !== 'alternative_id') this.validateField(ssnInput);
            });
        }

        card.querySelectorAll('input[type="tel"]').forEach(telEl => {
            if (this._formatPhoneEl) this._formatPhoneEl(telEl);
        });

        const roleSelect = card.querySelector('.co-role-select');
        if (roleSelect) {
            roleSelect.addEventListener('change', () => {
                this._syncCardFieldVisibility(card);
                this._syncCoApplicantsJson();
                this._updateTotalFeeDisplay();
                this._updateOccupantsCountSync();
                if (this._updateIncomeRatio) this._updateIncomeRatio();
                this.updateFieldsRemainingHint(1);
                this.saveProgress();
            });
        }

        card.querySelectorAll('.co-method-radio').forEach(r => {
            r.addEventListener('change', () => {
                this._syncCardFieldVisibility(card);
                this._syncCoApplicantsJson();
                this._updateTotalFeeDisplay();
                if (this._updateIncomeRatio) this._updateIncomeRatio();
                this.updateFieldsRemainingHint(1);
                this.saveProgress();
            });
        });

        const sameAddrCb = card.querySelector('.co-same-address');
        if (sameAddrCb) {
            sameAddrCb.addEventListener('change', () => {
                this._syncCardFieldVisibility(card);
                this._syncCoApplicantsJson();
            });
        }

        const occHousingSel = card.querySelector('.co-occ-housing-status');
        if (occHousingSel) {
            occHousingSel.addEventListener('change', () => {
                this._syncCoHousingUi(card);
                this._syncCoApplicantsJson();
            });
        }

        const supHousingSel = card.querySelector('.co-housing-status');
        if (supHousingSel) {
            supHousingSel.addEventListener('change', () => {
                this._syncCoHousingUi(card);
                this._syncCoApplicantsJson();
            });
        }

        const empStatusSel = card.querySelector('.co-employment-status');
        if (empStatusSel) {
            empStatusSel.addEventListener('change', () => {
                this._syncCoEmploymentUi(card);
                this._syncCoApplicantsJson();
            });
        }

        card.querySelectorAll('input, select').forEach(inp => {
            inp.addEventListener('input', () => {
                this._syncCoApplicantsJson();
                this._updateTotalFeeDisplay();
                if (this._updateIncomeRatio) this._updateIncomeRatio();
            });
            inp.addEventListener('change', () => {
                this._syncCoApplicantsJson();
                this._updateTotalFeeDisplay();
                if (this._updateIncomeRatio) this._updateIncomeRatio();
            });
            inp.addEventListener('blur', () => {
                if (inp.hasAttribute('required') && inp.offsetParent) this.validateField(inp);
            });
        });

        const removeBtn = card.querySelector('.btn-remove-co');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                card.remove();
                this._renumberCoApplicantCards();
                if (container.children.length === 0) {
                    const cb = document.getElementById('hasCoApplicant');
                    const coSec = document.getElementById('coApplicantSection');
                    if (cb) cb.checked = false;
                    if (coSec) coSec.style.display = 'none';
                }
                this._syncCoApplicantsJson();
                this._updateTotalFeeDisplay();
                this._updateOccupantsCountSync();
                if (this._updateIncomeRatio) this._updateIncomeRatio();
                this.updateFieldsRemainingHint(1);
                this.saveProgress();
            });
        }

        container.appendChild(card);
        this._syncCardFieldVisibility(card);
        this._renumberCoApplicantCards();
        this._syncCoApplicantsJson();
        this._updateTotalFeeDisplay();
        this._updateOccupantsCountSync();
        return card;
    }

    _renumberCoApplicantCards() {
        const container = document.getElementById('coApplicantsContainer');
        if (!container) return;
        const lang = this.state.language || 'en';
        Array.from(container.children).forEach((card, i) => {
            card.dataset.coIdx = String(i);
            const heading = card.querySelector('.co-card-heading');
            if (heading) heading.textContent = lang === 'es' ? `Miembro Adicional #${i + 1}` : `Household Member #${i + 1}`;
        });
    }

    _hydrateCoApplicantsFromArray(arr) {
        const container = document.getElementById('coApplicantsContainer');
        if (!container || !Array.isArray(arr)) return;
        container.replaceChildren();
        arr.forEach(item => this._addCoApplicantCard(item));
        this._syncCoApplicantsJson();
        this._updateOccupantsCountSync();
    }

    _collectCoApplicants() {
        const hasCo = document.getElementById('hasCoApplicant');
        const container = document.getElementById('coApplicantsContainer');
        if (!hasCo || !hasCo.checked || !container) return [];
        const pHousingStatus = document.getElementById('housingStatus')?.value?.trim() || '';
        const pAddr = document.getElementById('currentAddress')?.value?.trim() || '';
        const pDur = document.getElementById('residencyStart')?.value?.trim() || '';
        const pLlName = document.getElementById('landlordName')?.value?.trim() || '';
        const pLlPhone = document.getElementById('landlordPhone')?.value?.trim() || '';

        return Array.from(container.querySelectorAll('.co-applicant-card')).map(card => {
            const roleVal = card.querySelector('.co-role-select')?.value || 'Co-Applicant';
            const applicantType = this._normalizeApplicantType(roleVal, false);
            const isOccupant = this._isOccupyingRole(applicantType);
            const methodRadio = card.querySelector('.co-method-radio:checked');
            const submissionMethod = this._normalizeSubmissionMethod(methodRadio ? methodRadio.value : 'primary_completed');
            const isInvited = submissionMethod === 'invited';

            const sameAddr = isOccupant && !isInvited && !!card.querySelector('.co-same-address')?.checked;
            const evRadio = card.querySelector('.co-evicted:checked');
            const smRadio = card.querySelector('.co-smoker:checked');

            const currentAddress = isInvited
                ? ''
                : (isOccupant
                    ? (sameAddr ? pAddr : (card.querySelector('.co-current-address')?.value?.trim() || ''))
                    : (card.querySelector('.co-supporter-address')?.value?.trim() || ''));

            const coSsnMode = isInvited ? '' : (card.querySelector('.co-ssn-mode-select')?.value || 'last4');
            const housingStatusVal = isInvited
                ? ''
                : (isOccupant
                    ? (sameAddr ? pHousingStatus : (card.querySelector('.co-occ-housing-status')?.value || ''))
                    : (card.querySelector('.co-housing-status')?.value || ''));

            return {
                role: roleVal,
                applicant_type: applicantType,
                submission_method: submissionMethod,
                info_completed: !isInvited,
                is_occupant: isOccupant,
                first_name: card.querySelector('.co-first-name')?.value?.trim() || '',
                last_name: card.querySelector('.co-last-name')?.value?.trim() || '',
                email: card.querySelector('.co-email-input')?.value?.trim() || '',
                phone: card.querySelector('.co-phone-input')?.value?.trim() || '',
                dob: isInvited ? '' : (card.querySelector('.co-dob-input')?.value || ''),
                ssn_mode: coSsnMode,
                ssn: (isInvited || coSsnMode === 'alternative_id') ? '' : (card.querySelector('.co-ssn-input')?.value?.trim() || ''),
                government_id_type: isInvited ? '' : (card.querySelector('.co-gov-id-type')?.value || ''),
                government_id_number: isInvited ? '' : (card.querySelector('.co-gov-id-number')?.value?.trim() || ''),
                same_address: sameAddr,
                current_address: currentAddress,
                residency_duration: (!isInvited && isOccupant) ? (sameAddr ? pDur : (card.querySelector('.co-residency-duration')?.value?.trim() || '')) : '',
                current_landlord_name: (!isInvited && isOccupant) ? (sameAddr ? pLlName : (card.querySelector('.co-landlord-name')?.value?.trim() || '')) : '',
                landlord_phone: (!isInvited && isOccupant) ? (sameAddr ? pLlPhone : (card.querySelector('.co-landlord-phone')?.value?.trim() || '')) : '',
                housing_status: housingStatusVal,
                financial_support_notes: (!isInvited && !isOccupant) ? (card.querySelector('.co-financial-notes')?.value?.trim() || '') : '',
                employment_status: isInvited ? '' : (card.querySelector('.co-employment-status')?.value || 'Full-time'),
                employer: isInvited ? '' : (card.querySelector('.co-employer')?.value?.trim() || ''),
                job_title: isInvited ? '' : (card.querySelector('.co-job-title')?.value?.trim() || ''),
                employment_duration: isInvited ? '' : (card.querySelector('.co-employment-duration')?.value?.trim() || ''),
                monthly_income: isInvited ? '' : (card.querySelector('.co-monthly-income')?.value?.trim() || ''),
                other_income: isInvited ? '' : (card.querySelector('.co-other-income')?.value?.trim() || ''),
                ever_evicted: (!isInvited && isOccupant) ? (evRadio?.value === 'Yes') : false,
                smoker: (!isInvited && isOccupant) ? (smRadio?.value === 'Yes') : false,
                reference_1_name: isInvited ? '' : (card.querySelector('.co-ref1-name')?.value?.trim() || ''),
                reference_1_phone: isInvited ? '' : (card.querySelector('.co-ref1-phone')?.value?.trim() || ''),
                screening_consent: !!card.querySelector('.co-consent-input')?.checked,
            };
        });
    }

    _syncCoApplicantsJson() {
        const hidden = document.getElementById('coApplicantsJson');
        if (!hidden) return;
        const list = this._collectCoApplicants();
        hidden.value = JSON.stringify(list);
    }

    _updateOccupantsCountSync() {
        const totalOccEl = document.getElementById('totalOccupants');
        const hintEl = document.getElementById('occupantsHelperHint');
        const lang = this.state.language || 'en';
        const coList = this._collectCoApplicants ? this._collectCoApplicants() : [];
        let occupyingAdults = 1;
        let supporterCount = 0;
        coList.forEach(ca => {
            const type = this._normalizeApplicantType(ca.applicant_type || ca.role, false);
            if (this._isOccupyingRole(type)) occupyingAdults += 1;
            else supporterCount += 1;
        });

        if (totalOccEl) {
            if (!totalOccEl.dataset.occListenerAttached) {
                totalOccEl.dataset.occListenerAttached = '1';
                totalOccEl.addEventListener('input', () => {
                    const minOcc = parseInt(totalOccEl.min || '1', 10);
                    const typed = parseInt(totalOccEl.value || '0', 10);
                    totalOccEl.dataset.userEdited = (!isNaN(typed) && typed > minOcc) ? '1' : '';
                });
            }
            const prevAuto = parseInt(totalOccEl.dataset.lastAutoOcc || '1', 10);
            totalOccEl.min = String(occupyingAdults);
            const curVal = parseInt(totalOccEl.value || '1', 10);
            if (isNaN(curVal) || curVal < occupyingAdults || totalOccEl.dataset.userEdited !== '1' || curVal === prevAuto) {
                totalOccEl.value = String(occupyingAdults);
                totalOccEl.dataset.userEdited = '';
            }
            totalOccEl.dataset.lastAutoOcc = String(occupyingAdults);
        }
        if (hintEl) {
            if (supporterCount > 0) {
                hintEl.textContent = lang === 'es'
                    ? `Adultos ocupantes incluidos: ${occupyingAdults}. No cuente a los ${supporterCount} garante(s)/co-firmante(s) no ocupantes en este total.`
                    : `Adult occupants included: ${occupyingAdults}. Do not include your ${supporterCount} non-occupying guarantor/co-signer supporter(s) in Total Occupants.`;
            } else {
                hintEl.textContent = lang === 'es'
                    ? `Incluye ${occupyingAdults} adulto(s) ocupante(s) más dependientes/menores.`
                    : `Includes ${occupyingAdults} adult occupant(s) plus any minors/dependents.`;
            }
        }
    }

    setupCreditLookup() {
        const emailEl = document.getElementById('email');
        const creditCb = document.getElementById('applyCreditCheckbox');
        if (emailEl) {
            emailEl.addEventListener('blur', () => this._checkApplicationCredit());
            emailEl.addEventListener('input', this.debounce(() => this._checkApplicationCredit(), 800));
        }
        if (creditCb) {
            creditCb.addEventListener('change', () => {
                this._updateTotalFeeDisplay();
                if (this.getCurrentSection() === 6) this.generateApplicationSummary();
            });
        }
    }

    async _checkApplicationCredit() {
        const emailEl = document.getElementById('email');
        const noticeEl = document.getElementById('creditNotice');
        const textEl = document.getElementById('creditNoticeText');
        const cbEl = document.getElementById('applyCreditCheckbox');
        const email = (emailEl?.value || '').trim().toLowerCase();

        if (!email || !email.includes('@') || !window.CP_CONFIG?.SUPABASE_URL || !window.CP_CONFIG?.SUPABASE_ANON_KEY) {
            this.state.availableCredit = null;
            if (noticeEl) noticeEl.style.display = 'none';
            if (cbEl) cbEl.checked = false;
            this._updateTotalFeeDisplay();
            return;
        }

        try {
            const url = window.CP_CONFIG.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/check_available_application_credit';
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': window.CP_CONFIG.SUPABASE_ANON_KEY,
                    'Authorization': 'Bearer ' + window.CP_CONFIG.SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({ p_email: email }),
            });
            if (!res.ok) return;
            const data = await res.json();
            if (data && data.has_credit && Number(data.remaining_credits) > 0) {
                this.state.availableCredit = data;
                if (noticeEl) noticeEl.style.display = 'flex';
                if (textEl) {
                    const expStr = data.expires_at ? new Date(data.expires_at).toLocaleDateString() : '';
                    textEl.textContent = `You have ${data.remaining_credits} of ${data.total_credits || 2} reapplication credit(s) remaining (from ${data.original_app_id || 'prior application'}${expStr ? `, expires ${expStr}` : ''}).`;
                }
                if (cbEl && !cbEl.dataset.userTouched) {
                    cbEl.checked = true;
                    cbEl.addEventListener('click', () => { cbEl.dataset.userTouched = '1'; }, { once: true });
                }
            } else {
                this.state.availableCredit = null;
                if (noticeEl) noticeEl.style.display = 'none';
                if (cbEl) cbEl.checked = false;
            }
        } catch (err) {
            console.warn('[CP] Credit check non-fatal:', err);
        }
        this._updateTotalFeeDisplay();
    }

    _updateTotalFeeDisplay() {
        const lang = this.state.language || 'en';
        const feeSummary = this._calculateHouseholdFee();
        const total = feeSummary.totalFee;
        const creditApplied = feeSummary.creditApplied;

        const feeTitle = document.querySelector('[data-i18n="feeTitle"]');
        const feeAmount = document.querySelector('.fee-amount');
        const feeDesc = document.getElementById('feeBreakdownDesc');
        const breakdownEl = document.getElementById('feeBreakdownContainer');
        const jurEl = document.getElementById('jurisdictionFeeNotice');
        const step1Preview = document.getElementById('step1FeePreview');

        if (feeTitle) {
            if (lang === 'es') {
                feeTitle.textContent = creditApplied
                    ? 'Tarifa de Solicitud: $0.00 (Crédito Aplicado)'
                    : `Tarifa de Evaluación del Hogar: $${total.toFixed(2)}`;
            } else {
                feeTitle.textContent = creditApplied
                    ? 'Application Fee: $0.00 (Credit Applied)'
                    : `Household Application Fee: $${total.toFixed(2)}`;
            }
        }
        if (feeAmount) {
            feeAmount.textContent = `$${total.toFixed(0)}`;
            feeAmount.style.display = '';
        }
        if (feeDesc) {
            if (creditApplied) {
                feeDesc.textContent = lang === 'es'
                    ? 'Su crédito de reaplicación está seleccionado — no se cobrará tarifa por esta solicitud.'
                    : 'Your reapplication credit is selected — no application fee will be charged for this submission.';
            } else if (feeSummary.additionalCount > 0) {
                feeDesc.textContent = lang === 'es'
                    ? 'Desglose del hogar: $50 Solicitante Principal; el 1.er Co-Solicitante ocupante es $0 (Gratis); $50 por cada Co-Solicitante adicional, Garante o Co-Firmante. Nuestro equipo coordinará el pago dentro de 24 horas.'
                    : 'Household schedule: $50 Primary Applicant; 1st occupying Co-Applicant is $0 (Free); $50 each additional Co-Applicant, Guarantor, or Co-Signer. Our team will coordinate payment within 24 hours via your preferred method.';
            } else {
                feeDesc.textContent = lang === 'es'
                    ? 'Requerida antes de iniciar la verificación ($50.00). Dentro de 24 horas tras enviar, nuestro equipo le contactará para coordinar el pago con su método elegido.'
                    : 'Required before screening begins ($50.00). Within 24 hours of submitting, our team will contact you via your preferred method to coordinate payment.';
            }
        }

        if (breakdownEl) {
            const rowsHtml = feeSummary.feeBreakdown.map(item => {
                const freeBadge = item.included_free
                    ? `<span class="fee-badge-free">${lang === 'es' ? 'INCLUIDO / GRATIS' : 'INCLUDED / FREE'}</span>`
                    : '';
                return this._html`<div class="fee-breakdown-row">
                    <div class="fee-breakdown-row-left">
                        <strong>${item.name}</strong>
                        <span>(${item.role_label})</span>
                        ${this._safeHtml(freeBadge)}
                    </div>
                    <strong>$${item.fee.toFixed(0)}</strong>
                </div>`;
            }).join('');
            this._setTrustedHtml(breakdownEl, rowsHtml);
        }

        if (jurEl) {
            if (feeSummary.jurisdictionFeeNote) {
                jurEl.style.display = 'block';
                jurEl.textContent = feeSummary.jurisdictionFeeNote;
            } else {
                jurEl.style.display = 'none';
                jurEl.textContent = '';
            }
        }

        if (step1Preview) {
            const lines = feeSummary.feeBreakdown.map(item => {
                const freePill = item.included_free
                    ? ` <span class="fee-badge-free">${lang === 'es' ? 'INCLUIDO / GRATIS' : 'INCLUDED / FREE'}</span>`
                    : '';
                return this._html`<div class="fee-breakdown-row" style="background:#f8fafc;">
                    <div class="fee-breakdown-row-left">
                        <span>${item.name} — ${item.role_label}</span>${this._safeHtml(freePill)}
                    </div>
                    <strong>$${item.fee.toFixed(0)}</strong>
                </div>`;
            }).join('');
            const jurLine = feeSummary.jurisdictionFeeNote
                ? this._html`<div class="jurisdiction-fee-notice" style="margin-top:8px;">${feeSummary.jurisdictionFeeNote}</div>`
                : '';
            const policyHint = lang === 'es'
                ? 'Tarifa del hogar: $50 Principal; 1.er Co-Solicitante ocupante $0 (Gratis); $50 cada Co-Solicitante adicional, Garante o Co-Firmante.'
                : 'Household policy: $50 Primary Applicant; 1st occupying Co-Applicant $0 (Free); $50 each additional Co-Applicant, Guarantor, or Co-Signer.';
            const pillText = `${lang === 'es' ? 'Total' : 'Total'}: $${total.toFixed(0)}`;
            this._setTrustedHtml(step1Preview, this._html`
                <div class="step1-fee-preview-head">
                    <span><i class="fas fa-receipt" style="color:var(--secondary);margin-right:6px;"></i>${lang === 'es' ? 'Desglose de Tarifa de Evaluación' : 'Screening Fee Breakdown'}</span>
                    <span class="step1-fee-total-pill">${pillText}</span>
                </div>
                <div style="font-size:12px;color:#475569;margin-bottom:8px;">${policyHint}</div>
                <div style="display:flex;flex-direction:column;gap:4px;">${this._safeHtml(lines)}</div>
                ${this._safeHtml(jurLine)}
            `);
        }
    }

    generateApplicationSummary() {
        const summaryContainer = document.getElementById('applicationSummary');
        const finBox = document.getElementById('householdFinancialStrengthBox');
        if (!summaryContainer) return;

        this._syncCoApplicantsJson();
        this._updateTotalFeeDisplay();
        const lang = this.state.language || 'en';
        const data = this.getAllFormData();
        Object.keys(data).forEach(key => {
            if (Array.isArray(data[key])) {
                data[key] = data[key].join(', ');
            }
        });

        const t = this.getTranslations();
        const ssnMode = this._getPrimarySsnMode();
        const ssnRaw = (document.getElementById('ssn')?.value || '').replace(/\D/g, '');
        let maskedPrimarySsn;
        if (ssnMode === 'alternative_id') {
            maskedPrimarySsn = lang === 'es' ? 'Identificación oficial alternativa' : 'Alternative Gov ID (No SSN)';
        } else {
            maskedPrimarySsn = ssnRaw.length >= 4
                ? `•••-••-${ssnRaw.slice(-4)}`
                : (lang === 'es' ? 'No proporcionado' : 'Not provided');
        }

        const fin = this._calculateHouseholdFinancials();
        if (finBox) {
            finBox.style.display = 'block';
            const rentText = lang === 'es' ? 'Ingreso combinado de ocupantes' : 'Occupants only (guarantors excluded)';
            const supportRatioText = lang === 'es' ? 'Ocupantes + garantes/co-firmantes' : 'Household + guarantor/co-signer';

            finBox.innerHTML = '';
            this._setTrustedHtml(finBox, this._html`
                <h4><i class="fas fa-balance-scale" style="color:var(--secondary);"></i> ${lang === 'es' ? 'Solidez Financiera y Ocupación del Hogar' : 'Household Financial Strength & Occupancy'}</h4>
                <div class="financial-metrics-grid">
                    <div class="financial-metric-tile">
                        <div class="financial-metric-label">${lang === 'es' ? 'Solicitante Principal' : 'Primary Applicant Income'}</div>
                        <div class="financial-metric-val">$${fin.primaryMonthlyIncome.toLocaleString('en-US')}/mo</div>
                        <div class="financial-metric-sub">${lang === 'es' ? 'Adulto ocupante #1' : 'Occupying adult #1'}</div>
                    </div>
                    <div class="financial-metric-tile">
                        <div class="financial-metric-label">${lang === 'es' ? 'Co-Solicitantes Ocupantes' : 'Occupying Co-Applicant Income'}</div>
                        <div class="financial-metric-val">$${fin.coApplicantMonthlyIncome.toLocaleString('en-US')}/mo</div>
                        <div class="financial-metric-sub">${fin.coApplicantCount} ${lang === 'es' ? 'co-solicitante(s) ocupante(s)' : 'occupying co-applicant(s)'}</div>
                    </div>
                    <div class="financial-metric-tile financial-metric-tile--highlight">
                        <div class="financial-metric-label">${lang === 'es' ? 'Ingreso del Hogar (Solo Ocupantes)' : 'Household Income (Occupants Only)'}</div>
                        <div class="financial-metric-val">$${fin.householdMonthlyIncome.toLocaleString('en-US')}/mo</div>
                        <div class="financial-metric-sub">${fin.occupyingAdultCount} ${lang === 'es' ? 'adultos ocupantes' : 'occupying adults'} · ${rentText}</div>
                    </div>
                    <div class="financial-metric-tile financial-metric-tile--support">
                        <div class="financial-metric-label">${lang === 'es' ? 'Apoyo de Garante(s) (Separado)' : 'Guarantor Support (Non-Occupying)'}</div>
                        <div class="financial-metric-val">$${fin.guarantorMonthlyIncome.toLocaleString('en-US')}/mo</div>
                        <div class="financial-metric-sub">${fin.guarantorCount} ${lang === 'es' ? 'garante(s) — no infla ocupantes' : 'guarantor(s) — excluded from occupancy'}</div>
                    </div>
                    <div class="financial-metric-tile financial-metric-tile--support">
                        <div class="financial-metric-label">${lang === 'es' ? 'Apoyo de Co-Firmante(s) (Separado)' : 'Co-Signer Support (Separate)'}</div>
                        <div class="financial-metric-val">$${fin.coSignerMonthlyIncome.toLocaleString('en-US')}/mo</div>
                        <div class="financial-metric-sub">${fin.coSignerCount} ${lang === 'es' ? 'co-firmante(s)' : 'co-signer(s)'}</div>
                    </div>
                    <div class="financial-metric-tile">
                        <div class="financial-metric-label">${lang === 'es' ? 'Respaldo Financiero Total' : 'Total Financial Support Available'}</div>
                        <div class="financial-metric-val">$${fin.totalFinancialSupport.toLocaleString('en-US')}/mo</div>
                        <div class="financial-metric-sub">${supportRatioText}</div>
                    </div>
                </div>
            `);
        }

        const groups = [
            { id: 1, name: t.summaryPropertyApplicant, fields: [
                'Property Address', 'Requested Move-in Date', 'Desired Lease Term',
                'First Name', 'Middle Name', 'Last Name', 'Email',
                'Phone', 'Secondary Phone', 'DOB'
            ]},
            { id: 2, name: t.summaryResidency, fields: [
                'Housing Status', 'Current Address', 'Residency Duration', 'Current Rent Amount',
                'Reason for leaving', 'Current Landlord Name', 'Landlord Phone', 'Landlord Phone Ext',
                'Previous Housing Status', 'Previous Address', 'Previous Residency Duration', 'Previous Landlord Name', 'Previous Landlord Phone'
            ]},
            { id: 2, name: t.summaryOccupancy, fields: [
                'Total Occupants', 'Additional Occupants', 'Has Pets', 'Pet Details',
                'Has Vehicle', 'Vehicle Make', 'Vehicle Model', 'Vehicle Year', 'Vehicle License Plate'
            ]},
            { id: 3, name: t.summaryEmployment, fields: [
                'Employment Status', 'Employer', 'Employer Address', 'Job Title',
                'Employment Start Date', 'Employment Duration',
                'Supervisor Name', 'Supervisor Phone', 'Monthly Income', 'Other Income'
            ]},
            { id: 5, name: t.summaryFinancial, fields: [
                'SSN Mode', 'SSN', 'Government ID Type',
                'Ever Evicted', 'Smoker', 'Has Bankruptcy', 'Bankruptcy Explanation',
                'Has Criminal History', 'Criminal History Explanation',
                'Reference 1 Name', 'Reference 1 Phone', 'Reference 1 Relationship',
                'Reference 2 Name', 'Reference 2 Phone', 'Reference 2 Relationship',
                'Emergency Contact Name', 'Emergency Contact Phone', 'Emergency Contact Relationship'
            ]},
            { id: 5, name: t.summaryPayment, fields: [
                'Preferred Contact Method', 'Preferred Time', 'Preferred Time Specific',
                'Primary Payment Method', 'Primary Payment Method Other',
                'Alternative Payment Method', 'Alternative Payment Method Other',
                'Third Choice Payment Method', 'Third Choice Payment Method Other'
            ]}
        ];

        const curHousing = String(data['Housing Status'] || '').trim();
        const prevHousing = String(data['Previous Housing Status'] || '').trim();
        const empStatusVal = String(data['Employment Status'] || '').trim();

        const dynamicLabelMap = {};
        if (curHousing === 'Mortgage') {
            dynamicLabelMap['Current Rent Amount'] = lang === 'es' ? 'Pago Mensual de Hipoteca' : 'Current Monthly Mortgage Payment';
            dynamicLabelMap['Current Landlord Name'] = lang === 'es' ? 'Banco / Administrador de Hipoteca' : 'Mortgage Lender / Servicer';
            dynamicLabelMap['Landlord Phone'] = lang === 'es' ? 'Teléfono del Banco / Entidad' : 'Lender / Servicer Phone';
        } else if (curHousing === 'Living with Family') {
            dynamicLabelMap['Current Rent Amount'] = lang === 'es' ? 'Aporte Mensual de Vivienda' : 'Monthly Housing Contribution';
            dynamicLabelMap['Current Landlord Name'] = lang === 'es' ? 'Anfitrión / Familiar' : 'Host / Family Member';
            dynamicLabelMap['Landlord Phone'] = lang === 'es' ? 'Teléfono del Anfitrión' : 'Host Phone';
        } else if (curHousing === 'Other') {
            dynamicLabelMap['Current Rent Amount'] = lang === 'es' ? 'Costo Mensual de Vivienda' : 'Monthly Housing Cost';
            dynamicLabelMap['Current Landlord Name'] = lang === 'es' ? 'Contacto de Propiedad' : 'Property Contact';
            dynamicLabelMap['Landlord Phone'] = lang === 'es' ? 'Teléfono de Contacto' : 'Contact Phone';
        }
        if (curHousing === 'Own' || curHousing === 'Mortgage') {
            dynamicLabelMap['Reason for leaving'] = lang === 'es' ? 'Motivo de Mudanza' : 'Reason for Moving';
        }
        if (prevHousing === 'Living with Family') {
            dynamicLabelMap['Previous Landlord Name'] = lang === 'es' ? 'Anfitrión / Familiar Anterior' : 'Previous Host / Family Member';
            dynamicLabelMap['Previous Landlord Phone'] = lang === 'es' ? 'Teléfono del Anfitrión Anterior' : 'Previous Host Phone';
        } else if (prevHousing === 'Other') {
            dynamicLabelMap['Previous Landlord Name'] = lang === 'es' ? 'Contacto Anterior' : 'Previous Property Contact';
            dynamicLabelMap['Previous Landlord Phone'] = lang === 'es' ? 'Teléfono Anterior' : 'Previous Contact Phone';
        }
        if (empStatusVal === 'Self-employed') {
            dynamicLabelMap['Employer'] = lang === 'es' ? 'Nombre del Negocio' : 'Business / Trade Name';
            dynamicLabelMap['Employer Address'] = lang === 'es' ? 'Dirección del Negocio' : 'Business Address';
            dynamicLabelMap['Job Title'] = lang === 'es' ? 'Rol / Ocupación' : 'Role / Occupation';
            dynamicLabelMap['Employment Start Date'] = lang === 'es' ? 'Inicio del Negocio' : 'Business Start Date';
            dynamicLabelMap['Employment Duration'] = lang === 'es' ? 'Tiempo en el Negocio' : 'Time in Business';
            dynamicLabelMap['Monthly Income'] = lang === 'es' ? 'Ingreso Bruto del Negocio' : 'Gross Monthly Business Income';
        } else if (empStatusVal === 'Retired') {
            dynamicLabelMap['Employer'] = lang === 'es' ? 'Fuente de Jubilación / Pensión' : 'Retirement / Pension Source';
            dynamicLabelMap['Employer Address'] = lang === 'es' ? 'Dirección de Ex Empleador / Agencia' : 'Former Employer / Agency Address';
            dynamicLabelMap['Job Title'] = lang === 'es' ? 'Cargo Anterior' : 'Former Job Title';
            dynamicLabelMap['Employment Start Date'] = lang === 'es' ? 'Fecha de Retiro' : 'Retirement Start Date';
            dynamicLabelMap['Employment Duration'] = lang === 'es' ? 'Años Retirado' : 'Years Retired';
            dynamicLabelMap['Monthly Income'] = lang === 'es' ? 'Ingreso Mensual de Jubilación' : 'Monthly Retirement / Benefit Income';
        } else if (empStatusVal === 'Student') {
            dynamicLabelMap['Employer'] = lang === 'es' ? 'Escuela / Institución' : 'School / Institution Name';
            dynamicLabelMap['Employer Address'] = lang === 'es' ? 'Dirección de la Institución' : 'Institution Address';
            dynamicLabelMap['Job Title'] = lang === 'es' ? 'Programa / Campo de Estudio' : 'Program / Field of Study';
            dynamicLabelMap['Employment Start Date'] = lang === 'es' ? 'Fecha de Inicio' : 'Enrollment Start Date';
            dynamicLabelMap['Employment Duration'] = lang === 'es' ? 'Años en la Institución' : 'Years at Institution';
            dynamicLabelMap['Monthly Income'] = lang === 'es' ? 'Ingreso / Ayuda / Apoyo Mensual' : 'Monthly Income / Aid / Support';
        } else if (empStatusVal === 'Unemployed') {
            dynamicLabelMap['Monthly Income'] = lang === 'es' ? 'Asistencia / Desempleo / Ahorros' : 'Monthly Assistance / Savings Draw';
        }

        const ssnModeDisplayMap = {
            last4: lang === 'es' ? 'Últimos 4 dígitos del SSN' : 'Last 4 Digits of SSN',
            alternative_id: lang === 'es' ? 'Identificación oficial alternativa' : 'Alternative Gov ID (No SSN)',
            full: lang === 'es' ? 'Últimos 4 dígitos del SSN' : 'Last 4 Digits of SSN',
        };

        let summaryHtml = '';
        groups.forEach(group => {
            let groupFieldsHtml = '';
            group.fields.forEach(field => {
                let value = data[field];
                if (field === 'SSN') value = maskedPrimarySsn;
                if (field === 'SSN Mode' && value) value = ssnModeDisplayMap[value] || value;
                if (value !== undefined && value !== null && String(value).trim() !== '') {
                    const displayLabel = dynamicLabelMap[field] || field;
                    groupFieldsHtml += this._html`
                        <div class="summary-item">
                            <div class="summary-label">${displayLabel}</div>
                            <div class="summary-value">${value}</div>
                        </div>`;
                }
            });

            if (groupFieldsHtml) {
                summaryHtml += this._html`
                    <div class="summary-group" data-section-id="${group.id}" role="button" tabindex="0" aria-label="Edit ${group.name}" title="Tap to edit this section">
                        <div class="summary-header">
                            <span>${group.name}</span>
                            <span class="summary-edit-btn" aria-hidden="true">
                                <i class="fas fa-pencil-alt"></i> ${t.editSection}
                            </span>
                        </div>
                        <div class="summary-content">
                            ${this._safeHtml(groupFieldsHtml)}
                        </div>
                    </div>`;
            }
        });

        // Dynamic Household Members / Supporters summary group
        const coList = this._collectCoApplicants();
        if (coList.length > 0) {
            const feeCalc = this._calculateHouseholdFee(coList);
            const feeMap = new Map((feeCalc.feeBreakdown || []).map(f => [f.applicant_index, f]));
            let coHtml = '';
            coList.forEach((ca, idx) => {
                const type = this._normalizeApplicantType(ca.applicant_type || ca.role, false);
                const method = this._normalizeSubmissionMethod(ca.submission_method);
                const feeItem = feeMap.get(idx + 1);
                const feeLabel = feeItem
                    ? (feeItem.included_free ? (lang === 'es' ? '$0 (Gratis)' : '$0 (Free)') : `$${feeItem.fee.toFixed(0)}`)
                    : '$50';
                const methodLabel = method === 'invited'
                    ? (lang === 'es' ? 'Método B — Enlace privado (pendiente de completar)' : 'Method B — Private self-complete link (pending)')
                    : (lang === 'es' ? 'Método A — Completado y autorizado por el solicitante principal (sin enlace privado)' : 'Method A — Completed & authorized by primary applicant (no private link required)');
                const caDigits = String(ca.ssn || '').replace(/\D/g, '');
                let caMasked;
                if (method === 'invited') {
                    caMasked = lang === 'es' ? 'Completado vía enlace privado' : 'Completed via private link';
                } else if (ca.ssn_mode === 'alternative_id') {
                    caMasked = ca.government_id_type ? `Alt ID (${ca.government_id_type})` : 'Alternative Gov ID';
                } else {
                    caMasked = caDigits.length >= 4 ? `•••-••-${caDigits.slice(-4)}` : 'Pending';
                }
                const caHasIncome = ca.monthly_income !== '' && ca.monthly_income !== null && ca.monthly_income !== undefined;
                const detailLine = method === 'invited'
                    ? (lang === 'es' ? 'Ingresos y verificación se enviarán por enlace privado' : 'Financial details & documents will be submitted via private link')
                    : [
                        ca.employer || ca.employment_status || '—',
                        caHasIncome ? `$${ca.monthly_income}/mo` : '',
                        ca.housing_status ? `Housing: ${ca.housing_status}` : ''
                      ].filter(Boolean).join(' · ');

                coHtml += this._html`
                    <div class="summary-item">
                        <div class="summary-label">#${idx + 2} · ${this._getRoleDisplayLabel(type, lang)}</div>
                        <div class="summary-value">${[ca.first_name, ca.last_name].filter(Boolean).join(' ')} — ${ca.email} · <strong>${feeLabel}</strong></div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">${lang === 'es' ? 'Método' : 'Submission'}</div>
                        <div class="summary-value">${methodLabel}</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">${method === 'invited' ? 'DOB / SSN' : 'DOB / SSN / Fin.'}</div>
                        <div class="summary-value">${method === 'invited' ? caMasked : `${ca.dob || '—'} · ${caMasked} · ${detailLine}`}</div>
                    </div>`;
            });
            summaryHtml += this._html`
                <div class="summary-group" data-section-id="4" role="button" tabindex="0" aria-label="Edit Additional Applicants" title="Tap to edit">
                    <div class="summary-header">
                        <span>${t.summaryCoApplicant || 'Additional Household Members'} (${coList.length})</span>
                        <span class="summary-edit-btn" aria-hidden="true">
                            <i class="fas fa-pencil-alt"></i> ${t.editSection}
                        </span>
                    </div>
                    <div class="summary-content">
                        ${this._safeHtml(coHtml)}
                    </div>
                </div>`;
        }

        this._setTrustedHtml(summaryContainer, summaryHtml);
        summaryContainer.querySelectorAll('.summary-group[data-section-id]').forEach(groupEl => {
            const sectionId = parseInt(groupEl.dataset.sectionId, 10);
            if (!sectionId) return;
            groupEl.addEventListener('click', () => this.goToSection(sectionId));
            groupEl.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.goToSection(sectionId);
                }
            });
        });
    }

    // ================================================================
    // DEV / TEST — Fill helpers
    // ================================================================
    _generateValidTestSsn(seedOffset = 0) {
        const n = 1001 + (Math.floor(Math.random() * 7999) + seedOffset) % 7999;
        return String(n).padStart(4, '0');
    }

    _devFillAll() {
        const pick = arr => arr[Math.floor(Math.random() * arr.length)];
        const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

        const firstNames = ['James', 'Alicia', 'Marcus', 'Priya', 'Derek', 'Fatima', 'Carlos', 'Mei', 'Jordan', 'Aisha'];
        const lastNames  = ['Williams', 'Nguyen', 'Thompson', 'Patel', 'Robinson', 'Johnson', 'Garcia', 'Lee', 'Davis', 'Wilson'];
        const streets    = ['Oak Street', 'Maple Avenue', 'Vine Court', 'Hillcrest Drive', 'Lakeview Blvd', 'Elm Way', 'Summit Road'];
        const cities     = ['Detroit, MI', 'Troy, MI', 'Sterling Heights, MI', 'Warren, MI', 'Dearborn, MI'];
        const employers  = ['Stellantis', 'Ford Motor Company', 'Trinity Health', 'DTE Energy', 'Ally Financial', 'Wayne County Govt', 'Amazon Fulfillment'];
        const titles     = ['Project Manager', 'Software Engineer', 'Registered Nurse', 'Operations Analyst', 'Account Executive', 'Financial Advisor'];
        const supNames   = ['Sandra Kim', 'Robert Owens', 'Lisa Tran', 'Kevin Morris', 'Angela Brown'];
        const landlords  = ['Jim Harrington', 'Patricia Moss', 'David Chen', 'Sunrise Property Mgmt', 'Metro Rentals LLC'];
        const makes      = ['Toyota', 'Honda', 'Ford', 'Chevrolet', 'Nissan'];
        const models     = ['Camry', 'Accord', 'F-150', 'Malibu', 'Altima'];

        const fn = pick(firstNames);
        const ln = pick(lastNames);
        const fn2 = pick(firstNames.filter(n => n !== fn));
        const ln2 = pick(lastNames.filter(n => n !== ln));
        const city = pick(cities);
        const employer = pick(employers);
        const income = rand(3200, 8500);
        const rent = rand(1100, 2200);
        const apt = rand(1, 4);
        const unit = rand(100, 999);
        const plate = String.fromCharCode(65 + rand(0,25)) + String.fromCharCode(65 + rand(0,25)) + rand(10, 99) + String.fromCharCode(65 + rand(0,25)) + String.fromCharCode(65 + rand(0,25));
        const yrs = rand(2, 5);
        const mos = rand(0, 11);
        const empYrs = rand(1, 6);
        const dob = `${rand(1975, 1999)}-${String(rand(1,12)).padStart(2,'0')}-${String(rand(1,28)).padStart(2,'0')}`;
        const ssn = this._generateValidTestSsn(rand(1, 150));

        const moveIn = new Date();
        moveIn.setDate(moveIn.getDate() + rand(20, 60));
        const pad = n => String(n).padStart(2, '0');
        const moveInStr = `${moveIn.getFullYear()}-${pad(moveIn.getMonth()+1)}-${pad(moveIn.getDate())}`;

        const d   = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
        const chk = (id, c) => { const el = document.getElementById(id); if (el) el.checked = c; };
        const sel = (id, v) => { const el = document.getElementById(id); if (el) { el.value = v; el.dispatchEvent(new Event('change')); } };
        const fire = id => { const el = document.getElementById(id); if (el) { el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); } };

        // ── Step 1 (Section A) ──
        if (!document.getElementById('propertyAddress').value) {
            d('propertyAddress', `${rand(100, 9999)} ${pick(streets)}, ${city} ${rand(48000, 48399)}`);
        }
        d('requestedMoveIn', moveInStr);
        sel('desiredLeaseTerm', pick(['12 months', '12 months', '6 months', '24 months']));
        d('firstName', fn);
        d('lastName', ln);
        d('email', `${fn.toLowerCase()}.${ln.toLowerCase()}${rand(10,99)}@testmail.example`);
        d('dob', dob);
        d('phone', `(${rand(313,989)}) ${rand(200,999)}-${rand(1000,9999)}`);

        // ── Step 2 (Section B) ──
        sel('housingStatus', 'Rent');
        d('currentAddress', `${rand(100,9999)} ${pick(streets)}, Apt ${apt}${unit}, ${city} ${rand(48000,48399)}`);
        d('residencyStart', `${yrs} year${yrs !== 1 ? 's' : ''} ${mos > 0 ? mos + ' month' + (mos !== 1 ? 's' : '') : ''}`.trim());
        fire('residencyStart');
        d('rentAmount', String(rent));
        d('landlordName', pick(landlords));
        d('landlordPhone', `(${rand(248,586)}) ${rand(200,999)}-${rand(1000,9999)}`);
        const rl = document.getElementById('reasonLeaving');
        if (rl) rl.value = pick([
            'Relocating for a new job opportunity.',
            'Looking for a larger space for my family.',
            'Seeking a quieter neighborhood.',
            'Landlord is selling the property.',
        ]);
        d('totalOccupants', String(rand(1, 3)));
        chk('petsNo', true);
        const vToggle = document.querySelector('input[name="Has Vehicle"][value="Yes"]');
        if (vToggle) { vToggle.checked = true; vToggle.dispatchEvent(new Event('change')); }
        setTimeout(() => {
            d('vehicleMake', pick(makes));
            d('vehicleModel', pick(models));
            d('vehicleYear', String(rand(2015, 2024)));
            d('vehiclePlate', plate);
        }, 80);

        // ── Step 3 (Section C) ──
        sel('employmentStatus', 'Full-time');
        d('employer', employer);
        d('employerAddress', `${rand(100, 9999)} Commerce Dr, ${city} ${rand(48000, 48399)}`);
        d('jobTitle', pick(titles));
        d('employmentStartDate', `${new Date().getFullYear() - empYrs}-03-01`);
        d('employmentDuration', `${empYrs} year${empYrs !== 1 ? 's' : ''}`);
        d('supervisorName', pick(supNames));
        d('supervisorPhone', `(${rand(248,586)}) ${rand(200,999)}-${rand(1000,9999)}`);
        d('monthlyIncome', String(income));
        fire('monthlyIncome');

        // ── Step 5 (Section E: Identity, Disclosures, References & Contact Prefs) ──
        chk('ssnModeLast4', true);
        fire('ssnModeLast4');
        d('ssn', ssn);
        sel('governmentIdType', "Driver's License");
        d('governmentIdNumber', `DL-${rand(100000, 999999)}`);
        chk('evictedNo', true);
        chk('smokeNo', true);
        chk('bankruptcyNo', true);
        fire('bankruptcyNo');
        chk('criminalNo', true);
        fire('criminalNo');
        d('ref1Name', pick(firstNames) + ' ' + pick(lastNames));
        d('ref1Phone', `(${rand(313,586)}) ${rand(200,999)}-${rand(1000,9999)}`);
        d('ref1Relationship', pick(['Former Landlord', 'Employer', 'Coworker', 'Friend']));
        d('ref2Name', pick(firstNames) + ' ' + pick(lastNames));
        d('ref2Phone', `(${rand(313,586)}) ${rand(200,999)}-${rand(1000,9999)}`);
        d('ref2Relationship', pick(['Coworker', 'Family Friend', 'Neighbor', 'Employer']));
        d('emergencyName', fn2 + ' ' + ln2);
        d('emergencyPhone', `(${rand(313,734)}) ${rand(200,999)}-${rand(1000,9999)}`);
        d('emergencyRelationship', pick(['Sibling', 'Parent', 'Spouse', 'Friend']));
        chk('contactMethodEmail', true);
        chk('timeMorning', true);
        chk('timeAfternoon', true);
        sel('primaryPaymentMethod', 'Zelle');
        sel('alternativePaymentMethod', 'Venmo');

        setTimeout(() => {
            this.goToSection(6);
            setTimeout(() => {
                chk('certifyCorrect', true);
                chk('authorizeVerify', true);
                chk('feeAcknowledge', true);
                chk('agreeTermsPrivacy', true);
                chk('smsConsent', true);
                this._updateTotalFeeDisplay();
                this.generateApplicationSummary();

                const toast = document.createElement('div');
                toast.textContent = '\u26A1 All steps filled with random test data';
                toast.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#8e44ad;color:#fff;padding:10px 22px;border-radius:50px;font-size:14px;font-weight:700;z-index:99999;box-shadow:0 4px 14px rgba(0,0,0,0.3);pointer-events:none;';
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 3000);
            }, 120);
        }, 200);
    }

    _devFillTestData() {
        this._devFillStep(this.getCurrentSection());
    }

    _devFillStep(step) {
        const d   = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
        const chk = (id, c) => { const el = document.getElementById(id); if (el) el.checked = c; };
        const sel = (id, v) => { const el = document.getElementById(id); if (el) { el.value = v; el.dispatchEvent(new Event('change')); } };
        const fire = id => { const el = document.getElementById(id); if (el) el.dispatchEvent(new Event('input')); };

        switch (step) {
            case 1: {
                const moveIn = new Date();
                moveIn.setDate(moveIn.getDate() + 33);
                const pad = n => String(n).padStart(2, '0');
                const moveInStr = `${moveIn.getFullYear()}-${pad(moveIn.getMonth()+1)}-${pad(moveIn.getDate())}`;
                if (!document.getElementById('propertyAddress').value) {
                    d('propertyAddress', '742 Vineyard Court, Napa, CA 94558');
                }
                d('requestedMoveIn', moveInStr);
                sel('desiredLeaseTerm', '12 months');
                d('firstName', 'Maria');
                d('lastName', 'Rodriguez');
                d('email', 'maria.test@example.com');
                d('dob', '1990-06-15');
                d('phone', '(707) 555-1234');
                break;
            }
            case 2: {
                sel('housingStatus', 'Rent');
                d('currentAddress', '456 Oak Street, Apt 3B, Napa, CA 94559');
                d('residencyStart', '2 years 4 months');
                fire('residencyStart');
                d('rentAmount', '1800');
                d('landlordName', 'John Peterson');
                d('landlordPhone', '(707) 555-9876');
                const rl = document.getElementById('reasonLeaving');
                if (rl) rl.value = 'Looking for a larger space closer to work. Great experience with current landlord.';
                d('totalOccupants', '2');
                chk('petsNo', true);
                const vToggle = document.querySelector('input[name="Has Vehicle"][value="Yes"]');
                if (vToggle) { vToggle.checked = true; vToggle.dispatchEvent(new Event('change')); }
                d('vehicleMake', 'Toyota');
                d('vehicleModel', 'Camry');
                d('vehicleYear', '2021');
                d('vehiclePlate', '7ABC123');
                break;
            }
            case 3: {
                sel('employmentStatus', 'Full-time');
                d('employer', 'Napa Valley Winery LLC');
                d('employerAddress', '900 Soscol Ave, Napa, CA 94559');
                d('jobTitle', 'Marketing Manager');
                d('employmentStartDate', '2022-04-01');
                d('employmentDuration', '4 years');
                d('supervisorName', 'David Chen');
                d('supervisorPhone', '(707) 555-5432');
                d('monthlyIncome', '5500');
                fire('monthlyIncome');
                break;
            }
            case 4: {
                this._syncCoApplicantsJson();
                this._updateTotalFeeDisplay();
                break;
            }
            case 5: {
                chk('ssnModeLast4', true);
                fire('ssnModeLast4');
                d('ssn', this._generateValidTestSsn(42));
                sel('governmentIdType', "Driver's License");
                d('governmentIdNumber', 'DL-882914');
                chk('evictedNo', true);
                chk('smokeNo', true);
                chk('bankruptcyNo', true);
                chk('criminalNo', true);
                d('ref1Name', 'Sarah Johnson');
                d('ref1Phone', '(707) 555-2222');
                d('ref1Relationship', 'Former Landlord');
                d('ref2Name', 'Michael Torres');
                d('ref2Phone', '(707) 555-3333');
                d('ref2Relationship', 'Employer');
                d('emergencyName', 'Carlos Rodriguez');
                d('emergencyPhone', '(707) 555-4444');
                d('emergencyRelationship', 'Brother');
                chk('contactMethodEmail', true);
                chk('timeMorning', true);
                chk('timeAfternoon', true);
                sel('primaryPaymentMethod', 'Zelle');
                sel('alternativePaymentMethod', 'Venmo');
                break;
            }
            case 6: {
                chk('certifyCorrect', true);
                chk('authorizeVerify', true);
                chk('feeAcknowledge', true);
                chk('agreeTermsPrivacy', true);
                chk('smsConsent', true);
                this._updateTotalFeeDisplay();
                this.generateApplicationSummary();
                break;
            }
        }

        const toast = document.createElement('div');
        toast.textContent = `\uD83E\uDDEA Step ${step} filled`;
        toast.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#2ecc71;color:#fff;padding:10px 20px;border-radius:50px;font-size:14px;font-weight:700;z-index:99999;box-shadow:0 4px 14px rgba(0,0,0,0.25);pointer-events:none;';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2200);
    }

    goToSection(sectionNumber) {
        const current = this.getCurrentSection();
        this.hideSection(current);
        this._slideDir = sectionNumber >= current ? 'forward' : 'back';
        this.showSection(sectionNumber);
        this.updateProgressBar();
        if (sectionNumber === 3 && this._updateIncomeRatio) this._updateIncomeRatio();
        if (sectionNumber === 4) {
            this._updateTotalFeeDisplay();
            if (this._updateIncomeRatio) this._updateIncomeRatio();
        }
        if (sectionNumber === 6) {
            this._syncCoApplicantsJson();
            if (typeof this._rerenderUploadedFiles === 'function') this._rerenderUploadedFiles();
            this._updateTotalFeeDisplay();
            this._checkApplicationCredit();
            this.generateApplicationSummary();
        }
    }

}

// ---------- Global copy function (single authoritative definition) ----------
// Used by success-card copy buttons.
// The duplicate definition that existed in index.html has been removed.
window.copyAppId = function() {
    const el = document.getElementById('successAppId');
    if (!el) return;
    const appId = el.innerText.trim();
    if (!appId) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(appId).then(() => {
            const btn = document.querySelector('.copy-btn');
            if (btn) {
                const original = Array.from(btn.childNodes).map(node => node.cloneNode(true));
                const tCopy = (window.app && window.app.getTranslations) ? window.app.getTranslations() : {};
                const icon = document.createElement('i');
                icon.className = 'fas fa-check';
                btn.replaceChildren(icon, document.createTextNode(' ' + (tCopy.copied || 'Copied!')));
                setTimeout(() => { btn.replaceChildren(...original.map(node => node.cloneNode(true))); }, 2000);
            }
        }).catch(() => {
            // Clipboard API blocked — fall back to prompt
            window.prompt('Copy your Application ID:', appId);
        });
    } else {
        window.prompt('Copy your Application ID:', appId);
    }
};

// ============================================================
// Initialize app
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    window.app = new RentalApplication();
    const s1 = document.getElementById('section1');
    if (s1) s1.classList.add('active');

    // ── Dev / utility button listeners (replaces inline onclick — CSP safe) ──
    const startOverBtn   = document.getElementById('startOverBtn');
    const clearOverlay   = document.getElementById('clearFormOverlay');
    const clearCancel    = document.getElementById('clearFormCancel');
    const clearConfirm   = document.getElementById('clearFormConfirm');

    if (startOverBtn) startOverBtn.addEventListener('click', () => window.app._openClearSheet());
    if (clearOverlay) clearOverlay.addEventListener('click', () => window.app._closeClearSheet());
    if (clearCancel)  clearCancel.addEventListener('click',  () => window.app._closeClearSheet());
    if (clearConfirm) clearConfirm.addEventListener('click', () => window.app._clearForm());
});
