/**
 * Choice Properties — Card-First Payment Portal Controller
 * Strict security:
 *   - Never transmits raw card numbers or CVV/CVC in network payloads or logs.
 *   - Never stores raw card numbers or CVV/CVC in localStorage or sessionStorage.
 *   - Tokenizes card input locally and clears raw credentials from DOM immediately.
 */

(function () {
    'use strict';

    const RECOMMENDED_FAILURE_MESSAGE =
        'Card payment could not be completed at this time due to card network gateway verification limitations. Your card was not charged. Please select an available alternative payment method below to complete your fee.';

    const PAYMENT_STATES = {
        REQUIRED: 'Payment Required',
        METHOD_SELECTED: 'Payment Method Selected',
        AWAITING: 'Awaiting Payment',
        SUBMITTED_FOR_VERIFICATION: 'Payment Submitted for Verification',
        CONFIRMED: 'Payment Confirmed',
        UNSUCCESSFUL: 'Payment Unsuccessful',
        CANCELLED: 'Payment Cancelled',
        ASSISTANCE: 'Payment Assistance Required',
    };

    const state = {
        appId: '',
        applicantId: '',
        token: '',
        config: null,
        session: null,
        selectedMethod: null,
        lastRenderedMethod: null,
        viewMode: 'auto', // 'auto' | 'card' | 'unavailable' | 'alt_grid' | 'alt_instructions' | 'verify_pending' | 'cancelled' | 'failure' | 'assistance' | 'confirmed'
        isProcessing: false,
        summaryExpandedMobile: false,
    };

    const LAST_SUBMITTED_KEY = 'cpLastSubmittedApplication';
    const LAST_SUBMITTED_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

    const $ = (id) => document.getElementById(id);

    function normalizeAppId(raw) {
        const trimmed = String(raw || '').trim();
        if (!trimmed) return '';
        return /^cp-/i.test(trimmed) ? trimmed.toUpperCase() : trimmed;
    }

    function readLastSubmittedApp() {
        try {
            const raw = localStorage.getItem(LAST_SUBMITTED_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || !parsed.app_id) return null;
            const age = Date.now() - new Date(parsed.saved_at || 0).getTime();
            if (Number.isFinite(age) && age > LAST_SUBMITTED_MAX_AGE_MS) {
                localStorage.removeItem(LAST_SUBMITTED_KEY);
                return null;
            }
            return parsed;
        } catch (_) {
            return null;
        }
    }

    function saveLastSubmittedApp(meta) {
        try {
            if (!meta || !meta.app_id) return;
            localStorage.setItem(LAST_SUBMITTED_KEY, JSON.stringify({
                app_id: normalizeAppId(meta.app_id),
                applicant_id: meta.applicant_id || null,
                property_address: meta.property_address || '',
                applicant_name: meta.applicant_name || '',
                amount_due_now: Number(meta.amount_due_now ?? 0),
                saved_at: new Date().toISOString(),
            }));
        } catch (_) {}
    }

    function clearLastSubmittedApp(appId) {
        try {
            const existing = readLastSubmittedApp();
            if (!existing) return;
            if (!appId || normalizeAppId(existing.app_id) === normalizeAppId(appId)) {
                localStorage.removeItem(LAST_SUBMITTED_KEY);
            }
        } catch (_) {}
    }

    function formatCurrency(amount) {
        const num = Number(amount || 0);
        return '$' + (Number.isFinite(num) ? num.toFixed(2) : '0.00');
    }

    function formatDate(iso) {
        if (!iso) return 'Just submitted';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return 'Just submitted';
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function detectCardBrand(digits) {
        if (!digits) return 'Card';
        if (/^4/.test(digits)) return 'Visa';
        if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
        if (/^3[47]/.test(digits)) return 'American Express';
        if (/^(6011|65|64[4-9])/.test(digits)) return 'Discover';
        return 'Card';
    }

    function updateBrandChips(brand) {
        const badges = $('cardNetworkBadges');
        if (!badges) return;
        badges.querySelectorAll('.network-chip').forEach((chip) => {
            chip.classList.toggle('is-active', chip.dataset.brand === brand);
        });
        const cvvHint = $('cvvHintBadge');
        const cvvInput = $('cardCvvInput');
        if (cvvHint) {
            cvvHint.textContent = brand === 'American Express' ? '4 digits' : '3 digits';
        }
        if (cvvInput) {
            cvvInput.placeholder = brand === 'American Express' ? '1234' : '123';
        }
    }

    function formatCardNumberDisplay(value) {
        const digits = String(value || '').replace(/\D/g, '').slice(0, 19);
        const brand = detectCardBrand(digits);
        if (brand === 'American Express') {
            return digits.slice(0, 15).replace(/^(\d{0,4})(\d{0,6})(\d{0,5}).*/, (_, a, b, c) =>
                [a, b, c].filter(Boolean).join(' ')
            );
        }
        return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    }

    function formatExpiryDisplay(value) {
        const digits = String(value || '').replace(/\D/g, '').slice(0, 4);
        if (digits.length >= 3) {
            return digits.slice(0, 2) + ' / ' + digits.slice(2);
        }
        return digits;
    }

    function passesLuhn(digits) {
        if (!digits || digits.length < 13 || digits.length > 19) return false;
        let sum = 0;
        let alt = false;
        for (let i = digits.length - 1; i >= 0; i--) {
            let n = parseInt(digits.charAt(i), 10);
            if (alt) {
                n *= 2;
                if (n > 9) n -= 9;
            }
            sum += n;
            alt = !alt;
        }
        return sum % 10 === 0;
    }

    function parseExpiry(raw) {
        const digits = String(raw || '').replace(/\D/g, '');
        if (digits.length !== 4) return null;
        const month = parseInt(digits.slice(0, 2), 10);
        const year = 2000 + parseInt(digits.slice(2, 4), 10);
        if (month < 1 || month > 12) return null;
        const now = new Date();
        const curYear = now.getFullYear();
        const curMonth = now.getMonth() + 1;
        if (year < curYear || (year === curYear && month < curMonth)) {
            return { month, year, expired: true };
        }
        return { month, year, expired: false };
    }

    function setFieldError(inputEl, errorEl, msg) {
        if (errorEl) {
            errorEl.textContent = msg || '';
            errorEl.classList.toggle('visible', Boolean(msg));
        }
        if (inputEl) {
            inputEl.setAttribute('aria-invalid', msg ? 'true' : 'false');
            if (msg) inputEl.classList.remove('is-field-valid');
        }
    }

    function setFieldValid(inputEl, isValid) {
        if (!inputEl) return;
        inputEl.classList.toggle('is-field-valid', Boolean(isValid));
    }

    function clearAllFieldErrors() {
        setFieldError($('cardholderName'), $('errCardholder'), '');
        setFieldError($('cardNumberInput'), $('errCardNumber'), '');
        setFieldError($('cardExpiryInput'), $('errCardExpiry'), '');
        setFieldError($('cardCvvInput'), $('errCardCvv'), '');
        setFieldError($('billingZipInput'), $('errBillingZip'), '');
        const genErr = $('formGeneralError');
        if (genErr) {
            genErr.textContent = '';
            genErr.classList.remove('visible');
        }
    }

    function wipeCardInputs() {
        const num = $('cardNumberInput');
        const exp = $('cardExpiryInput');
        const cvv = $('cardCvvInput');
        if (num) {
            num.value = '';
            num.classList.remove('is-field-valid');
        }
        if (exp) {
            exp.value = '';
            exp.classList.remove('is-field-valid');
        }
        if (cvv) {
            cvv.value = '';
            cvv.classList.remove('is-field-valid');
        }
        if ($('detectedCardBrand')) $('detectedCardBrand').textContent = 'Card';
        updateBrandChips('Card');
    }

    function readSessionStorageHandoff(appId) {
        try {
            const raw = sessionStorage.getItem('cpPaymentHandoff_' + appId);
            return raw ? JSON.parse(raw) : null;
        } catch (_) {
            return null;
        }
    }

    function normalizeStateLabel(rawState, paymentStatus) {
        const paySt = String(paymentStatus || '').toLowerCase();
        if (paySt === 'paid' || paySt === 'waived') return PAYMENT_STATES.CONFIRMED;
        const lower = String(rawState || '').trim().toLowerCase();
        if (lower === 'payment successful' || lower === 'payment confirmed') return PAYMENT_STATES.CONFIRMED;
        if (lower === 'payment failed' || lower === 'payment unsuccessful') return PAYMENT_STATES.UNSUCCESSFUL;
        if (lower === 'payment submitted for verification') return PAYMENT_STATES.SUBMITTED_FOR_VERIFICATION;
        if (lower === 'payment method selected') return PAYMENT_STATES.METHOD_SELECTED;
        if (lower === 'payment cancelled' || lower === 'payment canceled') return PAYMENT_STATES.CANCELLED;
        if (lower === 'payment assistance required') return PAYMENT_STATES.ASSISTANCE;
        if (lower === 'awaiting payment' || lower === 'payment processing') return PAYMENT_STATES.AWAITING;
        if (lower === 'payment required' || lower === 'application submitted' || lower === 'application started') return PAYMENT_STATES.REQUIRED;
        return PAYMENT_STATES.REQUIRED;
    }

    function statusClassForState(paymentState) {
        switch (normalizeStateLabel(paymentState)) {
            case PAYMENT_STATES.CONFIRMED: return 'status-text--success';
            case PAYMENT_STATES.METHOD_SELECTED: return 'status-text--method';
            case PAYMENT_STATES.SUBMITTED_FOR_VERIFICATION: return 'status-text--verify';
            case PAYMENT_STATES.UNSUCCESSFUL: return 'status-text--failed';
            case PAYMENT_STATES.CANCELLED: return 'status-text--cancelled';
            case PAYMENT_STATES.ASSISTANCE: return 'status-text--assistance';
            case PAYMENT_STATES.AWAITING: return 'status-text--awaiting';
            default: return 'status-text--required';
        }
    }

    function statusPillClassForState(paymentState) {
        switch (normalizeStateLabel(paymentState)) {
            case PAYMENT_STATES.CONFIRMED: return 'status-pill--success';
            case PAYMENT_STATES.METHOD_SELECTED: return 'status-pill--method';
            case PAYMENT_STATES.SUBMITTED_FOR_VERIFICATION: return 'status-pill--verify';
            case PAYMENT_STATES.UNSUCCESSFUL: return 'status-pill--failed';
            case PAYMENT_STATES.CANCELLED: return 'status-pill--cancelled';
            case PAYMENT_STATES.ASSISTANCE: return 'status-pill--assistance';
            case PAYMENT_STATES.AWAITING: return 'status-pill--awaiting';
            default: return 'status-pill--required';
        }
    }

    function bannerStyleForState(paymentState) {
        switch (normalizeStateLabel(paymentState)) {
            case PAYMENT_STATES.CONFIRMED:
                return {
                    cls: 'pay-status-banner--success',
                    copy: 'Your application fee has been confirmed and your rental application is active for screening.',
                };
            case PAYMENT_STATES.SUBMITTED_FOR_VERIFICATION:
                return {
                    cls: 'pay-status-banner--verify',
                    copy: 'External payment submitted for Leasing Desk verification. Fee remains unpaid until confirmed.',
                };
            case PAYMENT_STATES.METHOD_SELECTED:
                return {
                    cls: 'pay-status-banner--method',
                    copy: 'Payment method selected. Complete your external transfer using the steps below and submit your reference.',
                };
            case PAYMENT_STATES.AWAITING:
                return {
                    cls: 'pay-status-banner--awaiting',
                    copy: 'Online card checkout could not be completed. Select an available alternative payment method below to finish your fee.',
                };
            case PAYMENT_STATES.UNSUCCESSFUL:
                return {
                    cls: 'pay-status-banner--failed',
                    copy: 'Your prior payment attempt could not be completed. Select a payment option below — your application remains saved.',
                };
            case PAYMENT_STATES.CANCELLED:
                return {
                    cls: 'pay-status-banner--cancelled',
                    copy: 'Payment selection was cancelled. No charge was made and your application remains saved whenever you resume.',
                };
            case PAYMENT_STATES.ASSISTANCE:
                return {
                    cls: 'pay-status-banner--awaiting',
                    copy: 'Payment assistance requested with our Leasing Desk. Your application remains active.',
                };
            default:
                return {
                    cls: 'pay-status-banner--required',
                    copy: 'Application fee payment is required to complete screening. Choose an available payment method below.',
                };
        }
    }

    function syncStatusIndicators(paymentState) {
        const displayState = String(paymentState || '') === 'Payment Processing'
            ? 'Payment Processing'
            : normalizeStateLabel(paymentState, state.session?.payment_status);

        const statusEl = $('summaryStatusLabel');
        if (statusEl) {
            statusEl.textContent = displayState;
            statusEl.className = 'status-text ' + statusClassForState(displayState);
        }
        const mobileStatus = $('mobileSummaryStatus');
        if (mobileStatus) {
            mobileStatus.textContent = displayState;
            mobileStatus.className = 'status-pill ' + statusPillClassForState(displayState);
        }
        const banner = $('paymentStatusBanner');
        const bannerTitle = $('bannerStatusTitle');
        const bannerCopy = $('bannerStatusCopy');
        if (banner && bannerTitle && bannerCopy) {
            const meta = bannerStyleForState(displayState);
            banner.className = 'pay-status-banner ' + meta.cls;
            bannerTitle.textContent = displayState;
            bannerCopy.textContent = meta.copy;
        }
    }

    function setMobileSummaryExpanded(expanded) {
        state.summaryExpandedMobile = expanded;
        const col = $('paySummaryColumn');
        const toggle = $('mobileSummaryToggleBtn');
        if (col) col.classList.toggle('is-collapsed-mobile', !expanded);
        if (toggle) {
            toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            const labelSpan = toggle.querySelector('span');
            if (labelSpan) labelSpan.textContent = expanded ? 'Hide details' : 'Fee details';
        }
    }

    function getBrandSvgMarkup(methodId) {
        switch (methodId) {
            case 'cash_app':
                return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.6 6.6V5h-2.1v1.4c-2.2.3-3.7 1.6-3.7 3.5 0 2.1 1.6 3.1 4.1 3.7 1.8.4 2.4.9 2.4 1.8 0 1-.9 1.6-2.3 1.6-1.4 0-2.6-.5-3.4-1.3l-1.3 1.6c1 .9 2.4 1.5 4 1.7V20h2.1v-1.3c2.4-.3 3.9-1.7 3.9-3.6 0-2.1-1.4-3.1-4.1-3.7-1.9-.4-2.4-.9-2.4-1.7 0-.9.8-1.5 2-1.5 1.2 0 2.2.4 3 1.1l1.3-1.5c-.9-.8-2-1.2-3.5-1.4z"/></svg>';
            case 'paypal':
                return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8.3 19.5H5.5a.6.6 0 0 1-.6-.7l2-12.7A.9.9 0 0 1 7.8 5.3h5.3c3 0 4.9 1.5 4.4 4.3-.4 2.7-2.4 4.3-5.3 4.3H9.9l-.8 5a.8.8 0 0 1-.8.6zm2.5-7.6h1.6c1.6 0 2.7-.8 3-2.3.2-1.3-.5-2.1-2-2.1H9.7l-.9 4.4h2z"/></svg>';
            case 'apple_pay':
                return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.2 12.7c0-2 1.6-3 1.7-3.1-.9-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.3 2-1.4 2.5-.4 6.1 1 8.1.7 1 1.5 2.1 2.5 2 1 0 1.4-.7 2.6-.7s1.5.7 2.6.7c1.1 0 1.8-1 2.5-2 .8-1.1 1.1-2.2 1.1-2.3 0-.1-2.2-.9-2.2-3zM14.1 6.6c.6-.7 1-1.7.9-2.6-.8 0-1.9.6-2.5 1.3-.5.6-1 1.6-.8 2.6.9.1 1.8-.5 2.4-1.3z"/></svg>';
            case 'venmo':
                return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.3 5.2c.6 1 .9 2 .9 3.3 0 4.1-3.5 9.4-6.3 13.1H7.7L5.6 6l4.6-.4 1.1 8.8c1.1-1.8 2.4-4.6 2.4-6.5 0-1.2-.2-2-.6-2.7l5.2-.5z"/></svg>';
            default:
                return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="9"/></svg>';
        }
    }

    function getConfiguredAlternativeMethods() {
        const list = state.config && Array.isArray(state.config.alternativeMethods)
            ? state.config.alternativeMethods
            : [];
        return list;
    }

    function findAltMethod(methodId) {
        if (!methodId) return null;
        return getConfiguredAlternativeMethods().find((m) => m.id === String(methodId).toLowerCase()) || null;
    }

    function hideAllCheckoutPanels() {
        const ids = [
            'processingOverlay',
            'cardUnavailablePanel',
            'altPaymentPanel',
            'verificationPendingPanel',
            'cancelledPanel',
            'failurePanel',
            'assistancePanel',
            'successPanel',
            'checkoutFormSection',
        ];
        ids.forEach((id) => {
            const el = $(id);
            if (el) el.style.display = 'none';
        });
    }

    async function copyTextWithFeedback(text, btnEl, defaultLabel) {
        const val = String(text || '').trim();
        if (!val) return;
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(val);
            } else {
                const ta = document.createElement('textarea');
                ta.value = val;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            if (btnEl) {
                btnEl.textContent = 'Copied';
                setTimeout(() => { btnEl.textContent = defaultLabel; }, 1600);
            }
        } catch (_) {}
    }

    function renderAlternativeMethodGrid() {
        const grid = $('altMethodGrid');
        if (!grid) return;
        grid.replaceChildren();

        const methods = getConfiguredAlternativeMethods();
        if (methods.length === 0) {
            const emptyMsg = document.createElement('p');
            emptyMsg.className = 'feedback-body';
            emptyMsg.textContent = 'No alternative payment methods are configured at this time. Please contact our Leasing Desk at 707-706-3137 for assistance.';
            grid.appendChild(emptyMsg);
            return;
        }

        methods.forEach((m) => {
            const isAvailable = Boolean(m.available && m.configured);
            const isSelected = Boolean(state.selectedMethod === m.id);

            const card = document.createElement('div');
            card.setAttribute('role', 'listitem');
            card.className = 'alt-method-card ' + (isAvailable ? 'is-available' : 'is-disabled') + (isSelected ? ' is-selected' : '');
            card.dataset.methodId = m.id;

            const top = document.createElement('div');
            top.className = 'alt-method-top';

            const brand = document.createElement('div');
            brand.className = 'alt-method-brand';

            const icon = document.createElement('span');
            icon.className = 'alt-method-icon alt-icon--' + m.id;
            icon.innerHTML = getBrandSvgMarkup(m.id);

            const titles = document.createElement('div');
            const nameEl = document.createElement('div');
            nameEl.className = 'alt-method-name';
            nameEl.textContent = m.name;

            const taglineEl = document.createElement('div');
            taglineEl.className = 'alt-method-tagline';
            taglineEl.textContent = m.tagline || '';

            titles.appendChild(nameEl);
            titles.appendChild(taglineEl);
            brand.appendChild(icon);
            brand.appendChild(titles);

            const badge = document.createElement('span');
            badge.className = 'alt-method-badge ' + (isAvailable ? 'alt-method-badge--ready' : 'alt-method-badge--unconfigured');
            if (!isAvailable) {
                badge.textContent = 'Not Configured';
            } else if (m.arrangement === 'direct_instructions') {
                badge.textContent = 'Direct Instructions';
            } else {
                badge.textContent = 'Coordinator-Assisted';
            }

            top.appendChild(brand);
            top.appendChild(badge);

            const desc = document.createElement('p');
            desc.className = 'alt-method-desc';
            desc.textContent = isAvailable
                ? (m.description || '')
                : (m.unavailableReason || `${m.name} is not currently configured for this checkout.`);

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'alt-method-btn';
            btn.disabled = !isAvailable;
            btn.dataset.selectMethod = m.id;
            btn.textContent = isAvailable
                ? (isSelected ? `Continue with ${m.name}` : `Select ${m.name}`)
                : `${m.name} Unavailable`;

            if (isAvailable) {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleSelectAlternativeMethod(m.id);
                });
                card.addEventListener('click', () => handleSelectAlternativeMethod(m.id));
            }

            card.appendChild(top);
            card.appendChild(desc);
            card.appendChild(btn);
            grid.appendChild(card);
        });
    }

    function getAlternativeInputSpecs(methodId) {
        switch (methodId) {
            case 'cash_app':
                return {
                    senderLabel: 'Your Cash App $Cashtag or Sender Name',
                    senderPlaceholder: 'e.g., $yourcashtag or Jordan Rivera',
                    senderError: 'Enter your Cash App $Cashtag or sender name.',
                    refLabel: 'Cash App Transaction / Receipt ID',
                    refPlaceholder: 'e.g., #A1B2C3D4 or transfer confirmation ID',
                    refError: 'Enter your Cash App transaction or confirmation ID.',
                };
            case 'paypal':
                return {
                    senderLabel: 'Your PayPal Email or @Username',
                    senderPlaceholder: 'e.g., name@example.com or @username',
                    senderError: 'Enter the PayPal email or @username used for your payment.',
                    refLabel: 'PayPal Transaction ID',
                    refPlaceholder: 'e.g., 1AB23456CD789012E',
                    refError: 'Enter your PayPal transaction ID.',
                };
            case 'venmo':
                return {
                    senderLabel: 'Your Venmo @Username or Account Name',
                    senderPlaceholder: 'e.g., @your-venmo or Jordan Rivera',
                    senderError: 'Enter your Venmo @username or account name.',
                    refLabel: 'Venmo Payment / Transaction ID',
                    refPlaceholder: 'e.g., 394810294810 or confirmation #',
                    refError: 'Enter your Venmo payment or confirmation ID.',
                };
            case 'apple_pay':
                return {
                    senderLabel: 'Apple Pay Sender Name or Phone / Email',
                    senderPlaceholder: 'e.g., Jordan Rivera or 555-123-4567',
                    senderError: 'Enter the sender name, phone, or email used for Apple Pay.',
                    refLabel: 'Apple Pay Confirmation / Reference ID',
                    refPlaceholder: 'e.g., transfer confirmation #',
                    refError: 'Enter your Apple Pay confirmation or reference ID.',
                };
            default:
                return {
                    senderLabel: 'Sender Handle / Account Name',
                    senderPlaceholder: 'e.g., $yourtag, @username, or payer name',
                    senderError: 'Enter the sender handle or account name used for this payment.',
                    refLabel: 'Transaction / Confirmation Reference',
                    refPlaceholder: 'e.g., transfer ID, confirmation #, or receipt code',
                    refError: 'Enter your transaction or confirmation reference.',
                };
        }
    }

    function renderAlternativeInstructions(methodObj) {
        if (!methodObj || !methodObj.available || !methodObj.configured) {
            state.viewMode = 'alt_grid';
            renderActiveView();
            return;
        }
        const session = state.session || {};
        const appId = session.app_id || state.appId || '—';
        const amountDue = Number(session.amount_due_now ?? session.application_fee ?? 0);
        const specs = getAlternativeInputSpecs(methodObj.id);

        const iconWrap = $('altInstIconWrap');
        if (iconWrap) {
            iconWrap.className = 'alt-inst-icon-wrap alt-icon--' + methodObj.id;
            iconWrap.innerHTML = getBrandSvgMarkup(methodObj.id);
        }
        if ($('altInstTitle')) $('altInstTitle').textContent = methodObj.name;
        if ($('altInstModeBadge')) $('altInstModeBadge').textContent = methodObj.instructions?.modeLabel || 'External Payment';
        if ($('altInstExternalNotice')) {
            $('altInstExternalNotice').textContent =
                (methodObj.instructions?.externalNotice || `${methodObj.name} must be completed externally outside Choice Properties.`)
                + ' Submitting your transfer reference below sets status to Payment Submitted for Verification — never confirmed until verified.';
        }
        if ($('altInstAppId')) $('altInstAppId').textContent = appId;
        if ($('altInstAmountDue')) $('altInstAmountDue').textContent = formatCurrency(amountDue);
        if ($('extFormMethodHeading')) $('extFormMethodHeading').textContent = methodObj.name;
        if ($('extFormMethodName')) $('extFormMethodName').textContent = methodObj.name;
        if ($('extSenderHandleLabel')) $('extSenderHandleLabel').textContent = specs.senderLabel;
        if ($('extSenderHandleInput')) $('extSenderHandleInput').placeholder = specs.senderPlaceholder;
        if ($('extReferenceLabel')) $('extReferenceLabel').textContent = specs.refLabel;
        if ($('extReferenceInput')) $('extReferenceInput').placeholder = specs.refPlaceholder;

        const stateBadge = $('selectedMethodStateBadge');
        if (stateBadge) {
            stateBadge.textContent = PAYMENT_STATES.METHOD_SELECTED;
            stateBadge.className = 'status-pill status-pill--method';
        }

        const directBox = $('altDirectHandleBox');
        const coordBox = $('altCoordinatorBox');
        if (methodObj.arrangement === 'direct_instructions' && methodObj.instructions?.recipientHandle) {
            if (directBox) directBox.style.display = 'block';
            if (coordBox) coordBox.style.display = 'none';
            if ($('altDirectHandleValue')) $('altDirectHandleValue').textContent = methodObj.instructions.recipientHandle;
            const linkEl = $('altDirectLaunchLink');
            if (linkEl) {
                if (methodObj.instructions.paymentUrl) {
                    linkEl.href = methodObj.instructions.paymentUrl;
                    linkEl.style.display = 'inline-flex';
                } else {
                    linkEl.style.display = 'none';
                }
            }
        } else {
            if (directBox) directBox.style.display = 'none';
            if (coordBox) coordBox.style.display = 'block';
            const phone = methodObj.instructions?.coordinatorPhone || methodObj.coordinatorPhone || '707-706-3137';
            const email = methodObj.instructions?.coordinatorEmail || methodObj.coordinatorEmail || 'choiceproperties404@gmail.com';
            if ($('altCoordPhoneLink')) {
                $('altCoordPhoneLink').textContent = phone;
                $('altCoordPhoneLink').href = 'tel:' + phone.replace(/\D/g, '');
            }
            if ($('altCoordEmailLink')) {
                $('altCoordEmailLink').textContent = email;
                $('altCoordEmailLink').href = 'mailto:' + email;
            }
            if ($('altCoordTemplateText')) {
                $('altCoordTemplateText').textContent =
                    `Hi Choice Properties Leasing Desk, I would like to pay my ${formatCurrency(amountDue)} screening fee via ${methodObj.name} for Application ${appId}. Please share the active ${methodObj.name} handle.`;
            }
        }

        const stepsList = $('altInstStepsList');
        if (stepsList) {
            stepsList.replaceChildren();
            const steps = Array.isArray(methodObj.instructions?.steps) ? methodObj.instructions.steps : [];
            steps.forEach((stepText) => {
                const li = document.createElement('li');
                li.textContent = stepText;
                stepsList.appendChild(li);
            });
        }

        if (state.lastRenderedMethod !== methodObj.id) {
            if ($('extSenderHandleInput')) {
                $('extSenderHandleInput').value = '';
                $('extSenderHandleInput').classList.remove('is-field-valid');
            }
            if ($('extReferenceInput')) {
                $('extReferenceInput').value = '';
                $('extReferenceInput').classList.remove('is-field-valid');
            }
            if ($('extNoteInput')) $('extNoteInput').value = '';
            if ($('extConfirmCheckbox')) $('extConfirmCheckbox').checked = false;
            state.lastRenderedMethod = methodObj.id;
        }

        setFieldError($('extSenderHandleInput'), $('errExtSenderHandle'), '');
        setFieldError($('extReferenceInput'), $('errExtReference'), '');
        const errEl = $('extVerifyError');
        if (errEl) {
            errEl.textContent = '';
            errEl.classList.remove('visible');
        }
    }

    function configureCardCheckoutView() {
        const cardForm = $('cardPaymentForm');
        const unavailOption = $('cardUnavailableOptionView');
        const subtitle = $('cardCheckoutSubtitle');

        // Always render the complete credit card payment interface first so the applicant can
        // enter card details and experience real-time validation & checkout verification.
        if (cardForm) cardForm.style.display = 'block';
        if (unavailOption) unavailOption.style.display = 'none';
        if (subtitle) subtitle.textContent = 'Encrypted & tokenized checkout';

        const amountDueNow = Number(state.session?.amount_due_now ?? state.session?.application_fee ?? 0);
        if ($('continueWithCardBtnText')) {
            $('continueWithCardBtnText').textContent = amountDueNow > 0
                ? `Continue with Debit or Credit Card (${formatCurrency(amountDueNow)})`
                : 'Confirm Application Fee ($0.00)';
        }
    }

    function renderActiveView() {
        const session = state.session;
        if (!session) return;

        hideAllCheckoutPanels();

        const appId = session.app_id || state.appId;
        const amountDueNow = Number(session.amount_due_now ?? session.application_fee ?? 0);
        const paymentState = normalizeStateLabel(session.application_payment_state, session.payment_status);
        const hhSummary = session.household_payment_summary;
        const isIndividualMode = session.household_payment_mode === 'individual';

        const isPaid = session.payment_status === 'paid' || paymentState === PAYMENT_STATES.CONFIRMED;
        const isWaived = session.payment_status === 'waived' || (!isPaid && amountDueNow === 0);

        if (isPaid || isWaived || amountDueNow === 0) {
            clearLastSubmittedApp(appId);
            syncStatusIndicators(PAYMENT_STATES.CONFIRMED);
            $('successPanel').style.display = 'block';
            $('successHeadline').textContent = isWaived
                ? 'Application Fee Waived ($0.00)'
                : 'Payment Confirmed';

            const remainingMembers = Number(hhSummary?.unpaid_members_count || 0);
            if (isWaived) {
                $('successSubcopy').textContent = 'Your application fee is waived under an eligible credit. Your application is now in active screening review.';
            } else if (isIndividualMode && remainingMembers > 0) {
                $('successSubcopy').textContent = `Your ${formatCurrency(session.payment_amount ?? 50)} screening fee share is confirmed. ${remainingMembers} remaining household member(s) will complete their own $50.00 payment share to finalize full household screening.`;
            } else {
                $('successSubcopy').textContent = 'Your payment has been verified and confirmed. Your rental application is now active for screening review.';
            }

            const paidVal = session.payment_status === 'paid'
                ? Number(session.payment_amount ?? (isIndividualMode ? 50 : session.application_fee ?? 50))
                : amountDueNow;
            $('receiptAppId').textContent = appId;
            $('receiptTxRef').textContent = session.payment_transaction_ref || (amountDueNow === 0 ? 'WAIVED-CREDIT' : 'CONFIRMED');
            const cardSummary = session.payment_card_last4
                ? `${session.payment_card_brand || 'Card'} •••• ${session.payment_card_last4}`
                : (session.payment_method_confirmed || (amountDueNow === 0 ? 'Fee Waived' : 'Confirmed Payment'));
            $('receiptCardLabel').textContent = cardSummary;
            $('receiptAmountPaid').textContent = formatCurrency(paidVal);
            return;
        }

        let targetView = state.viewMode;
        if (targetView === 'auto') {
            if (paymentState === PAYMENT_STATES.ASSISTANCE || session.payment_assistance_required) {
                targetView = 'assistance';
            } else if (paymentState === PAYMENT_STATES.SUBMITTED_FOR_VERIFICATION) {
                targetView = 'verify_pending';
            } else if (paymentState === PAYMENT_STATES.CANCELLED) {
                targetView = 'cancelled';
            } else if (paymentState === PAYMENT_STATES.METHOD_SELECTED && state.selectedMethod && findAltMethod(state.selectedMethod)?.available) {
                targetView = 'alt_instructions';
            } else if (paymentState === PAYMENT_STATES.UNSUCCESSFUL) {
                targetView = 'failure';
            } else {
                targetView = 'card';
            }
        }

        if (targetView === 'assistance') {
            syncStatusIndicators(PAYMENT_STATES.ASSISTANCE);
            $('assistancePanel').style.display = 'block';
            $('assistRefEcho').textContent = appId;
            return;
        }

        if (targetView === 'verify_pending') {
            syncStatusIndicators(PAYMENT_STATES.SUBMITTED_FOR_VERIFICATION);
            $('verificationPendingPanel').style.display = 'block';
            const mObj = findAltMethod(session.selected_payment_method || session.payment_provider || state.selectedMethod);
            if ($('verifyAppIdEcho')) $('verifyAppIdEcho').textContent = appId;
            if ($('verifyMethodEcho')) $('verifyMethodEcho').textContent = mObj?.name || session.selected_payment_method || 'Alternative Payment';
            if ($('verifyRefEcho')) $('verifyRefEcho').textContent = session.external_payment_reference || session.payment_transaction_ref || 'Submitted';
            if ($('verifySubmittedAtEcho')) $('verifySubmittedAtEcho').textContent = session.payment_submitted_at ? formatDate(session.payment_submitted_at) : 'Just submitted';
            if ($('verifyAmountEcho')) $('verifyAmountEcho').textContent = formatCurrency(amountDueNow);
            return;
        }

        if (targetView === 'cancelled') {
            syncStatusIndicators(PAYMENT_STATES.CANCELLED);
            $('cancelledPanel').style.display = 'block';
            if ($('cancelAppIdEcho')) $('cancelAppIdEcho').textContent = appId;
            if ($('cancelAmountEcho')) $('cancelAmountEcho').textContent = formatCurrency(amountDueNow);
            return;
        }

        if (targetView === 'unavailable') {
            syncStatusIndicators(PAYMENT_STATES.AWAITING);
            const unavailPanel = $('cardUnavailablePanel');
            unavailPanel.style.display = 'block';
            if ($('unavailableAppIdEcho')) $('unavailableAppIdEcho').textContent = appId;
            if ($('unavailableAmountEcho')) $('unavailableAmountEcho').textContent = formatCurrency(amountDueNow);
            if ($('cardUnavailableReasonText')) {
                $('cardUnavailableReasonText').textContent =
                    state.config?.cardProcessing?.reason
                    || 'Your card payment could not be completed because online debit and credit card checkout is currently disabled on this portal. This is a checkout configuration notice — not a bank decline or an issue with your card. No charge was made, and your submitted application and balance remain saved.';
            }
            // Automatically guide the applicant directly into selecting an alternative payment method below.
            $('altPaymentPanel').style.display = 'block';
            $('altMethodGridView').style.display = 'block';
            $('altInstructionsView').style.display = 'none';
            if ($('backToCardOverviewBtn')) {
                $('backToCardOverviewBtn').style.display = 'inline-flex';
            }
            renderAlternativeMethodGrid();
            try {
                unavailPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } catch (_) {}
            return;
        }

        if (targetView === 'alt_grid') {
            syncStatusIndicators(paymentState === PAYMENT_STATES.UNSUCCESSFUL ? PAYMENT_STATES.UNSUCCESSFUL : PAYMENT_STATES.AWAITING);
            $('altPaymentPanel').style.display = 'block';
            $('altMethodGridView').style.display = 'block';
            $('altInstructionsView').style.display = 'none';
            if ($('backToCardOverviewBtn')) {
                $('backToCardOverviewBtn').style.display = 'inline-flex';
            }
            renderAlternativeMethodGrid();
            return;
        }

        if (targetView === 'alt_instructions') {
            const methodObj = findAltMethod(state.selectedMethod || session.selected_payment_method);
            if (!methodObj || !methodObj.available) {
                state.viewMode = 'alt_grid';
                renderActiveView();
                return;
            }
            syncStatusIndicators(PAYMENT_STATES.METHOD_SELECTED);
            $('altPaymentPanel').style.display = 'block';
            $('altMethodGridView').style.display = 'none';
            $('altInstructionsView').style.display = 'block';
            renderAlternativeInstructions(methodObj);
            return;
        }

        if (targetView === 'failure') {
            syncStatusIndicators(PAYMENT_STATES.UNSUCCESSFUL);
            $('failurePanel').style.display = 'block';
            $('failureMessageText').textContent = session.payment_failure_reason || RECOMMENDED_FAILURE_MESSAGE;
            $('failureAppIdEcho').textContent = appId;
            return;
        }

        // Default: card option / checkout view
        syncStatusIndicators(paymentState);
        configureCardCheckoutView();
        $('checkoutFormSection').style.display = 'block';
    }

    function renderSession(session) {
        state.session = session;
        if (session.selected_payment_method) {
            state.selectedMethod = session.selected_payment_method;
        }

        $('payLoadingState').style.display = 'none';
        $('payLookupState').style.display = 'none';
        $('payWorkspace').style.display = 'grid';

        const appId = session.app_id || state.appId;
        state.appId = appId;
        $('summaryAppId').textContent = appId;
        $('summaryApplicantName').textContent = session.applicant_name || 'Applicant';
        $('summaryPropertyAddress').textContent = session.property_address || 'Selected Rental Property';
        $('summarySubmittedAt').textContent = formatDate(session.submitted_at);

        const mobileStrip = $('mobileSummaryStrip');
        if (mobileStrip) {
            mobileStrip.style.display = 'block';
            if ($('mobileSummaryRef')) $('mobileSummaryRef').textContent = appId;
            if ($('mobileSummaryProp')) $('mobileSummaryProp').textContent = session.property_address || 'Selected Rental Property';
        }
        setMobileSummaryExpanded(state.summaryExpandedMobile);

        const defaultPortalUrl = '/tenant/portal.html?app_id=' + encodeURIComponent(appId)
            + (session.applicant_id ? '&applicant_id=' + encodeURIComponent(session.applicant_id) : '');
        const portalUrl = (session.portal_login_url && !/tenant\/login\.html|\/auth\/v1\/verify/i.test(session.portal_login_url))
            ? session.portal_login_url
            : defaultPortalUrl;
        try { sessionStorage.setItem('pendingPortalAppId', appId); } catch (_) {}
        if ($('headerPortalLink')) $('headerPortalLink').href = portalUrl;
        if ($('assistPortalLink')) $('assistPortalLink').href = portalUrl;
        if ($('successPortalBtn')) $('successPortalBtn').href = portalUrl;
        if ($('verifyPortalBtn')) $('verifyPortalBtn').href = portalUrl;
        if ($('cancelledPortalBtn')) $('cancelledPortalBtn').href = portalUrl;

        if ($('successReceiptBtn')) {
            const rUrl = session.receipt_id
                ? '/receipt.html?receipt_id=' + encodeURIComponent(session.receipt_id)
                : ('/receipt.html?app_id=' + encodeURIComponent(appId) + '&type=application_fee'
                    + (session.applicant_id ? '&applicant_id=' + encodeURIComponent(session.applicant_id) : ''));
            const tokenHash = session.receipt_access_token
                ? '#rt=' + encodeURIComponent(session.receipt_access_token)
                : '';
            $('successReceiptBtn').href = rUrl + tokenHash;
        }

        const isIndividualMode = session.household_payment_mode === 'individual';
        const membersList = Array.isArray(session.applicants) ? session.applicants : [];
        const arrangementRow = $('summaryArrangementRow');
        const arrangementBadge = $('summaryArrangementBadge');
        if (arrangementRow && arrangementBadge) {
            if (membersList.length > 1 || isIndividualMode) {
                arrangementRow.style.display = 'flex';
                arrangementBadge.innerHTML = '';
                const pill = document.createElement('span');
                pill.className = 'arrangement-pill';
                pill.textContent = isIndividualMode ? 'Option B · Individual Shares' : 'Option A · Centralized';
                arrangementBadge.appendChild(pill);
            } else {
                arrangementRow.style.display = 'none';
            }
        }

        const memberById = new Map();
        const memberByIdx = new Map();
        membersList.forEach((m) => {
            if (m.id) memberById.set(String(m.id), m);
            if (m.applicant_index != null) memberByIdx.set(Number(m.applicant_index), m);
        });

        const breakdownEl = $('feeBreakdownList');
        const rows = Array.isArray(session.fee_breakdown) && session.fee_breakdown.length > 0
            ? session.fee_breakdown
            : [{
                name: session.applicant_name || 'Primary Applicant',
                role_label: 'Primary Applicant',
                fee: Number(session.application_fee ?? 50),
                included_free: Number(session.application_fee ?? 50) === 0,
            }];

        breakdownEl.replaceChildren();
        rows.forEach((item, idx) => {
            const row = document.createElement('div');
            row.className = 'fee-line';

            const memberObj = (item.applicant_id && memberById.get(String(item.applicant_id)))
                || memberByIdx.get(item.applicant_index ?? idx)
                || null;
            const isTargetMember = Boolean(
                isIndividualMode && memberObj && session.applicant_id && String(memberObj.id) === String(session.applicant_id)
            );
            const mPaid = memberObj && ['paid', 'waived'].includes(String(memberObj.payment_status || '').toLowerCase());

            const left = document.createElement('div');
            const nameSpan = document.createElement('span');
            nameSpan.className = 'fee-line-name';
            nameSpan.textContent = item.name || 'Applicant';

            if (isIndividualMode && memberObj) {
                const statusPill = document.createElement('span');
                if (mPaid) {
                    statusPill.className = 'member-status-pill member-status-pill--paid';
                    statusPill.textContent = 'Paid';
                } else if (isTargetMember) {
                    statusPill.className = 'member-status-pill member-status-pill--current';
                    statusPill.textContent = 'Your Share';
                } else {
                    statusPill.className = 'member-status-pill member-status-pill--due';
                    statusPill.textContent = 'Unpaid';
                }
                nameSpan.appendChild(statusPill);
            }

            const roleSpan = document.createElement('span');
            roleSpan.className = 'fee-line-role';
            roleSpan.textContent = item.role_label || item.applicant_type || 'Screening';

            left.appendChild(nameSpan);
            left.appendChild(roleSpan);

            const amtSpan = document.createElement('span');
            amtSpan.className = 'fee-line-amount tabular-nums';
            amtSpan.textContent = formatCurrency(item.fee);

            row.appendChild(left);
            row.appendChild(amtSpan);
            breakdownEl.appendChild(row);
        });

        const hhSummary = session.household_payment_summary;
        const progressBox = $('householdProgressBox');
        if (progressBox && isIndividualMode && hhSummary && Number(hhSummary.total_members_count) > 1) {
            progressBox.style.display = 'block';
            const totalHh = Number(hhSummary.total_fee || session.application_fee || 0);
            const collectedHh = Number(hhSummary.total_collected || 0);
            const pct = totalHh > 0 ? Math.min(100, Math.round((collectedHh / totalHh) * 100)) : 0;
            $('householdProgressText').textContent = `${formatCurrency(collectedHh)} / ${formatCurrency(totalHh)} (${hhSummary.paid_members_count}/${hhSummary.total_members_count} Paid)`;
            $('householdProgressFill').style.width = `${pct}%`;
        } else if (progressBox) {
            progressBox.style.display = 'none';
        }

        const amountDueNow = Number(session.amount_due_now ?? session.application_fee ?? 0);
        if ($('summaryTotalLabel')) {
            $('summaryTotalLabel').textContent = isIndividualMode && membersList.length > 1
                ? 'Your Share Due Now'
                : 'Total Amount Due';
        }
        $('summaryTotalDue').textContent = formatCurrency(amountDueNow);
        if ($('mobileSummaryTotal')) $('mobileSummaryTotal').textContent = formatCurrency(amountDueNow);

        if ($('cardholderName') && !$('cardholderName').value && session.applicant_name && session.applicant_name !== 'Applicant') {
            $('cardholderName').value = session.applicant_name;
            setFieldValid($('cardholderName'), session.applicant_name.trim().length >= 2);
        }

        if ($('submitPayBtnText')) {
            $('submitPayBtnText').textContent = amountDueNow > 0
                ? `Pay ${formatCurrency(amountDueNow)} Now`
                : 'Confirm Application Fee ($0.00)';
        }

        const isAlreadySettled = session.payment_status === 'paid' || session.payment_status === 'waived' || amountDueNow === 0;
        if (!isAlreadySettled) {
            saveLastSubmittedApp({
                app_id: appId,
                applicant_id: session.applicant_id || state.applicantId || null,
                property_address: session.property_address,
                applicant_name: session.applicant_name,
                amount_due_now: amountDueNow,
            });
        }

        renderActiveView();
    }

    async function fetchJsonWithStatus(url, options) {
        try {
            const res = await fetch(url, options);
            const data = await res.json().catch(() => null);
            return { ok: res.ok, status: res.status, data, networkError: false };
        } catch (_) {
            return { ok: false, status: 0, data: null, networkError: true };
        }
    }

    function showLookupPanel({ title, message, appId, allowRetry }) {
        $('payLoadingState').style.display = 'none';
        $('payWorkspace').style.display = 'none';
        if ($('mobileSummaryStrip')) $('mobileSummaryStrip').style.display = 'none';
        $('payLookupState').style.display = 'block';
        if ($('lookupTitle') && title) $('lookupTitle').textContent = title;
        if ($('lookupMessage') && message) $('lookupMessage').textContent = message;
        if ($('lookupAppIdInput') && appId) $('lookupAppIdInput').value = appId;
        if ($('lookupRetryBtn')) $('lookupRetryBtn').style.display = allowRetry ? 'inline-flex' : 'none';
    }

    async function loadPaymentPortal() {
        $('payLoadingState').style.display = 'grid';
        $('payLookupState').style.display = 'none';
        $('payWorkspace').style.display = 'none';

        const params = new URLSearchParams(window.location.search);
        let appId = normalizeAppId(params.get('app_id') || params.get('appId') || '');
        let applicantId = (params.get('applicant_id') || params.get('applicantId') || '').trim();
        const token = (params.get('token') || '').trim();

        if (!appId) {
            let rememberedId = '';
            try { rememberedId = normalizeAppId(sessionStorage.getItem('lastSuccessAppId') || ''); } catch (_) {}
            const lastSubmitted = readLastSubmittedApp();
            if (!rememberedId && lastSubmitted?.app_id) {
                rememberedId = normalizeAppId(lastSubmitted.app_id);
                if (!applicantId && lastSubmitted.applicant_id) {
                    applicantId = String(lastSubmitted.applicant_id).trim();
                }
            }
            if (rememberedId) {
                appId = rememberedId;
                try {
                    const nextUrl = new URL(window.location.href);
                    nextUrl.searchParams.set('app_id', appId);
                    if (applicantId) nextUrl.searchParams.set('applicant_id', applicantId);
                    window.history.replaceState(null, '', nextUrl.pathname + nextUrl.search);
                } catch (_) {}
            }
        }

        state.appId = appId;
        state.applicantId = applicantId;
        state.token = token;
        state.viewMode = 'auto';

        if (!appId) {
            const cfgRes = await fetchJsonWithStatus('/api/payments/config');
            state.config = (cfgRes.ok && cfgRes.data)
                ? cfgRes.data
                : { mode: 'alternative_workflow', cardProcessing: { available: false }, alternativeMethods: [] };
            showLookupPanel({
                title: 'Find Your Application',
                message: 'Enter your Application Reference ID (found in your confirmation screen or email) to load your application fee balance.',
                appId: '',
                allowRetry: false,
            });
            return;
        }

        const sesUrl = '/api/payments/session?app_id=' + encodeURIComponent(appId)
            + (applicantId ? '&applicant_id=' + encodeURIComponent(applicantId) : '');

        const [cfgRes, sesRes] = await Promise.all([
            fetchJsonWithStatus('/api/payments/config'),
            fetchJsonWithStatus(sesUrl),
        ]);

        state.config = (cfgRes.ok && cfgRes.data)
            ? cfgRes.data
            : { mode: 'alternative_workflow', cardProcessing: { available: false }, alternativeMethods: [] };

        let session = (sesRes.ok && sesRes.data?.session) ? sesRes.data.session : null;
        if (session?.applicant_id && !state.applicantId) {
            state.applicantId = String(session.applicant_id);
        }

        if (!session) {
            const handoff = readSessionStorageHandoff(appId);
            if (handoff) {
                const regRes = await fetchJsonWithStatus('/api/payments/session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(handoff),
                });
                if (regRes.ok && regRes.data?.session) {
                    session = regRes.data.session;
                } else if (sesRes.status === 404) {
                    session = handoff;
                }
            }
        }

        if (!session) {
            const isServiceIssue = sesRes.networkError || sesRes.status >= 500 || sesRes.status === 0;
            if (isServiceIssue) {
                showLookupPanel({
                    title: 'Temporary Connection Issue',
                    message: `We couldn't reach our payment service right now to load application "${appId}". Your application remains saved — please tap Retry below or check back in a moment.`,
                    appId,
                    allowRetry: true,
                });
            } else {
                showLookupPanel({
                    title: 'Find Your Application',
                    message: `We couldn't find application reference "${appId}". Verify your Application Reference Number below or contact support at 707-706-3137.`,
                    appId,
                    allowRetry: false,
                });
            }
            return;
        }

        renderSession(session);
    }

    function updateProcessingStage(stepIndex) {
        const steps = document.querySelectorAll('#processingSteps .proc-step');
        steps.forEach((el, idx) => {
            el.classList.toggle('is-done', idx < stepIndex);
            el.classList.toggle('is-active', idx === stepIndex);
        });
    }

    function setProcessingState(processing, fallbackState) {
        state.isProcessing = processing;
        const btn = $('submitPayBtn');
        const label = $('submitPayBtnText');
        const checkoutSection = $('checkoutFormSection');
        const overlay = $('processingOverlay');

        if (btn) btn.disabled = processing;
        if (processing) {
            if (label) label.textContent = 'Processing Payment...';
            if (checkoutSection) checkoutSection.style.display = 'none';
            if (overlay) overlay.style.display = 'block';
            updateProcessingStage(0);
            syncStatusIndicators('Payment Processing');
        } else {
            if (overlay) overlay.style.display = 'none';
            if (state.session) {
                const totalDue = Number(state.session.amount_due_now ?? state.session.application_fee ?? 0);
                if (label) label.textContent = totalDue > 0 ? `Pay ${formatCurrency(totalDue)} Now` : 'Confirm ($0.00)';
            }
            if (fallbackState) {
                syncStatusIndicators(fallbackState);
            }
        }
    }

    async function runProcessingAnimation(requestPromise) {
        const stageDelays = [450, 550, 650, 450];
        let step = 0;
        const progressPromise = (async () => {
            for (const ms of stageDelays) {
                updateProcessingStage(step);
                await new Promise((r) => setTimeout(r, ms));
                step += 1;
            }
            updateProcessingStage(4);
        })();

        const [apiResult] = await Promise.all([requestPromise, progressPromise]);
        return apiResult;
    }

    /**
     * Client-side card tokenizer (used strictly when a live card processor IS configured).
     */
    function tokenizeCardInputs() {
        clearAllFieldErrors();
        let valid = true;

        const cardholder = ($('cardholderName')?.value || '').trim();
        if (cardholder.length < 2) {
            setFieldError($('cardholderName'), $('errCardholder'), 'Enter the cardholder name shown on your card.');
            valid = false;
        }

        const rawDigits = ($('cardNumberInput')?.value || '').replace(/\D/g, '');
        if (!passesLuhn(rawDigits)) {
            setFieldError($('cardNumberInput'), $('errCardNumber'), 'Enter a valid 13–19 digit debit or credit card number.');
            valid = false;
        }

        const parsedExp = parseExpiry($('cardExpiryInput')?.value || '');
        if (!parsedExp) {
            setFieldError($('cardExpiryInput'), $('errCardExpiry'), 'Enter a valid expiration date (MM/YY).');
            valid = false;
        } else if (parsedExp.expired) {
            setFieldError($('cardExpiryInput'), $('errCardExpiry'), 'This card appears to be expired. Check the expiration date.');
            valid = false;
        }

        const cvvDigits = ($('cardCvvInput')?.value || '').replace(/\D/g, '');
        const brand = detectCardBrand(rawDigits);
        const expectedCvvLen = brand === 'American Express' ? 4 : 3;
        if (cvvDigits.length < 3 || cvvDigits.length > 4 || (brand === 'American Express' && cvvDigits.length !== 4)) {
            setFieldError($('cardCvvInput'), $('errCardCvv'), `Enter the ${expectedCvvLen}-digit security code.`);
            valid = false;
        }

        const billingZip = ($('billingZipInput')?.value || '').trim();
        if (billingZip && !/^[A-Za-z0-9\s-]{3,10}$/.test(billingZip)) {
            setFieldError($('billingZipInput'), $('errBillingZip'), 'Enter a valid billing postal code.');
            valid = false;
        }

        if (!valid) return null;

        const last4 = rawDigits.slice(-4);
        const isUnverifiedTestSuffix = ['0002', '0341', '9995', '0069'].includes(last4);
        const randSuffix = Math.random().toString(36).slice(2, 10);
        const token = isUnverifiedTestSuffix
            ? `tok_decline_${last4}_${randSuffix}`
            : `tok_card_${last4}_${randSuffix}`;

        return {
            cardholder_name: cardholder,
            payment_token: token,
            card_meta: {
                brand,
                last4,
                exp_month: parsedExp.month,
                exp_year: parsedExp.year,
                ...(billingZip ? { postal_code: billingZip } : {}),
            },
        };
    }

    async function handleContinueWithCardUnavailable() {
        if (!state.appId) return;
        const btn = $('continueWithCardBtn');
        if (btn) btn.disabled = true;

        try {
            const res = await fetchJsonWithStatus('/api/payments/select-method', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    app_id: state.appId,
                    ...(state.applicantId ? { applicant_id: state.applicantId } : {}),
                    method: 'card',
                }),
            });

            if (res.data?.alternativeMethods && state.config) {
                state.config.alternativeMethods = res.data.alternativeMethods;
            }
            if (res.status === 503 || res.data?.card_unavailable || res.data?.code === 'card_processing_unavailable') {
                if (state.config?.cardProcessing) {
                    state.config.cardProcessing.available = false;
                    if (res.data?.message) state.config.cardProcessing.reason = res.data.message;
                }
                state.viewMode = 'unavailable';
                if (res.data?.session) {
                    renderSession(res.data.session);
                } else {
                    renderActiveView();
                }
                return;
            }
            if (res.data?.session) {
                state.viewMode = 'card';
                renderSession(res.data.session);
            }
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    async function handleSelectAlternativeMethod(methodId) {
        if (!state.appId || !methodId) return;
        const buttons = document.querySelectorAll('.alt-method-btn');
        buttons.forEach((b) => { b.disabled = true; });

        try {
            const res = await fetchJsonWithStatus('/api/payments/select-method', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    app_id: state.appId,
                    ...(state.applicantId ? { applicant_id: state.applicantId } : {}),
                    method: methodId,
                }),
            });

            if (res.ok && res.data?.session) {
                state.selectedMethod = methodId;
                state.viewMode = 'alt_instructions';
                renderSession(res.data.session);
            } else {
                const mObj = findAltMethod(methodId);
                if (mObj && mObj.available) {
                    state.selectedMethod = methodId;
                    state.viewMode = 'alt_instructions';
                    renderActiveView();
                }
            }
        } finally {
            renderAlternativeMethodGrid();
        }
    }

    async function handleExternalVerificationSubmit(e) {
        e.preventDefault();
        if (!state.appId || !state.selectedMethod) return;

        const errEl = $('extVerifyError');
        const senderInput = $('extSenderHandleInput');
        const refInput = $('extReferenceInput');
        const specs = getAlternativeInputSpecs(state.selectedMethod);

        setFieldError(senderInput, $('errExtSenderHandle'), '');
        setFieldError(refInput, $('errExtReference'), '');
        if (errEl) {
            errEl.textContent = '';
            errEl.classList.remove('visible');
        }

        const confirmed = Boolean($('extConfirmCheckbox')?.checked);
        const externalRef = (refInput?.value || '').trim();
        const senderHandle = (senderInput?.value || '').trim();
        const note = ($('extNoteInput')?.value || '').trim();

        let hasFieldError = false;
        if (senderHandle.length < 2) {
            setFieldError(senderInput, $('errExtSenderHandle'), specs.senderError);
            hasFieldError = true;
        }
        if (externalRef.length < 3) {
            setFieldError(refInput, $('errExtReference'), specs.refError);
            hasFieldError = true;
        }
        if (hasFieldError) {
            if (senderHandle.length < 2) senderInput?.focus();
            else refInput?.focus();
            return;
        }

        if (!confirmed) {
            if (errEl) {
                errEl.textContent = 'Please check the confirmation box verifying you completed the external payment before submitting for review.';
                errEl.classList.add('visible');
            }
            return;
        }

        const submitBtn = $('submitExternalVerifyBtn');
        const submitLabel = $('submitExternalVerifyText');
        if (submitBtn) submitBtn.disabled = true;
        if (submitLabel) submitLabel.textContent = 'Submitting for Verification...';

        try {
            const res = await fetchJsonWithStatus('/api/payments/submit-external', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    app_id: state.appId,
                    ...(state.applicantId ? { applicant_id: state.applicantId } : {}),
                    method: state.selectedMethod,
                    external_reference: externalRef,
                    payer_handle: senderHandle,
                    payer_name: state.session?.applicant_name || '',
                    note,
                    confirmed_external: true,
                }),
            });

            if (res.ok && res.data?.session) {
                state.viewMode = 'verify_pending';
                renderSession(res.data.session);
            } else if (errEl) {
                errEl.textContent = res.data?.error || 'Could not submit external verification details. Please try again.';
                errEl.classList.add('visible');
            }
        } finally {
            if (submitBtn) submitBtn.disabled = false;
            if (submitLabel) submitLabel.textContent = 'Submit Payment for Verification';
        }
    }

    async function handleCancelPayment() {
        if (!state.appId) return;
        const res = await fetchJsonWithStatus('/api/payments/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                app_id: state.appId,
                ...(state.applicantId ? { applicant_id: state.applicantId } : {}),
                reason: 'Applicant cancelled checkout before completing payment.',
            }),
        });
        state.viewMode = 'cancelled';
        if (res.ok && res.data?.session) {
            renderSession(res.data.session);
        } else {
            renderActiveView();
        }
    }

    async function handlePaymentSubmit(e) {
        e.preventDefault();
        if (state.isProcessing || !state.session) return;

        clearAllFieldErrors();
        const tokenized = tokenizeCardInputs();
        if (!tokenized) return;

        const processPayload = {
            app_id: state.appId,
            ...(state.applicantId ? { applicant_id: state.applicantId } : {}),
            ...(state.token ? { token: state.token } : {}),
            ...tokenized,
        };

        wipeCardInputs();
        setProcessingState(true);

        try {
            const fetchPromise = fetch('/api/payments/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(processPayload),
            }).then(async (res) => ({
                ok: res.ok,
                status: res.status,
                data: await res.json().catch(() => ({})),
            }));

            const { ok, status, data } = await runProcessingAnimation(fetchPromise);

            if (status === 503 || data?.card_unavailable || data?.code === 'card_processing_unavailable') {
                setProcessingState(false, PAYMENT_STATES.AWAITING);
                if (state.config?.cardProcessing) {
                    state.config.cardProcessing.available = false;
                    if (data?.message) state.config.cardProcessing.reason = data.message;
                }
                if (data?.alternativeMethods && state.config) {
                    state.config.alternativeMethods = data.alternativeMethods;
                }
                state.viewMode = 'unavailable';
                if (data.session) {
                    renderSession(data.session);
                } else {
                    renderActiveView();
                }
                return;
            }

            if (data.session) {
                setProcessingState(false);
                state.viewMode = 'auto';
                renderSession(data.session);
            } else if (status === 402) {
                setProcessingState(false, PAYMENT_STATES.UNSUCCESSFUL);
                state.viewMode = 'failure';
                renderActiveView();
                $('failureMessageText').textContent = data.message || RECOMMENDED_FAILURE_MESSAGE;
                $('failureAppIdEcho').textContent = state.appId;
            } else if (!ok) {
                setProcessingState(false, state.session?.application_payment_state || PAYMENT_STATES.REQUIRED);
                $('checkoutFormSection').style.display = 'block';
                const genErr = $('formGeneralError');
                if (genErr) {
                    genErr.textContent = data.error || data.message || 'A temporary service issue interrupted your payment request. Your card was not charged — please try again.';
                    genErr.classList.add('visible');
                }
            } else {
                setProcessingState(false, state.session?.application_payment_state || PAYMENT_STATES.REQUIRED);
                $('checkoutFormSection').style.display = 'block';
            }
        } catch (_) {
            setProcessingState(false, state.session?.application_payment_state || PAYMENT_STATES.REQUIRED);
            $('checkoutFormSection').style.display = 'block';
            const genErr = $('formGeneralError');
            if (genErr) {
                genErr.textContent = 'A temporary network issue interrupted your connection. Your application remains saved — please try again.';
                genErr.classList.add('visible');
            }
        }
    }

    async function requestPaymentAssistance() {
        if (!state.appId) return;
        try {
            const res = await fetch('/api/payments/assistance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    app_id: state.appId,
                    ...(state.applicantId ? { applicant_id: state.applicantId } : {}),
                    note: 'Applicant requested payment support from the payment checkout page.',
                }),
            });
            const data = await res.json();
            if (data.session) {
                state.viewMode = 'assistance';
                renderSession(data.session);
            }
        } catch (_) {
            state.viewMode = 'assistance';
            renderActiveView();
        }
    }

    function wireUiEvents() {
        const mobileToggle = $('mobileSummaryToggleBtn');
        if (mobileToggle) {
            mobileToggle.addEventListener('click', () => {
                setMobileSummaryExpanded(!state.summaryExpandedMobile);
            });
        }

        const cardNumInput = $('cardNumberInput');
        if (cardNumInput) {
            cardNumInput.addEventListener('input', (e) => {
                const formatted = formatCardNumberDisplay(e.target.value);
                e.target.value = formatted;
                const digits = formatted.replace(/\D/g, '');
                const brand = detectCardBrand(digits);
                if ($('detectedCardBrand')) $('detectedCardBrand').textContent = brand;
                updateBrandChips(brand);
                setFieldError(cardNumInput, $('errCardNumber'), '');
                const targetLen = brand === 'American Express' ? 15 : 16;
                const isComplete = digits.length >= targetLen && passesLuhn(digits);
                setFieldValid(cardNumInput, isComplete);
                if (isComplete && digits.length === targetLen) {
                    $('cardExpiryInput')?.focus();
                }
            });
            cardNumInput.addEventListener('blur', () => {
                const digits = cardNumInput.value.replace(/\D/g, '');
                if (digits.length > 0 && !passesLuhn(digits)) {
                    setFieldError(cardNumInput, $('errCardNumber'), 'Enter a valid 13–19 digit debit or credit card number.');
                }
            });
        }

        const expInput = $('cardExpiryInput');
        if (expInput) {
            expInput.addEventListener('input', (e) => {
                e.target.value = formatExpiryDisplay(e.target.value);
                const digits = e.target.value.replace(/\D/g, '');
                if (digits.length >= 2) {
                    const monthNum = parseInt(digits.slice(0, 2), 10);
                    if (monthNum < 1 || monthNum > 12) {
                        setFieldError(expInput, $('errCardExpiry'), 'Enter a valid expiration month (01–12).');
                        setFieldValid(expInput, false);
                        return;
                    }
                }
                setFieldError(expInput, $('errCardExpiry'), '');
                const parsed = parseExpiry(e.target.value);
                if (parsed && parsed.expired) {
                    setFieldError(expInput, $('errCardExpiry'), 'This card appears to be expired.');
                    setFieldValid(expInput, false);
                    return;
                }
                const isValidExp = Boolean(parsed && !parsed.expired);
                setFieldValid(expInput, isValidExp);
                if (isValidExp) {
                    $('cardCvvInput')?.focus();
                }
            });
            expInput.addEventListener('blur', () => {
                const raw = expInput.value.replace(/\D/g, '');
                if (raw.length > 0) {
                    const parsed = parseExpiry(expInput.value);
                    if (!parsed) {
                        setFieldError(expInput, $('errCardExpiry'), 'Enter a valid expiration date (MM/YY).');
                    } else if (parsed.expired) {
                        setFieldError(expInput, $('errCardExpiry'), 'This card appears to be expired.');
                    }
                }
            });
        }

        const cvvInput = $('cardCvvInput');
        if (cvvInput) {
            cvvInput.addEventListener('input', (e) => {
                const brand = detectCardBrand(($('cardNumberInput')?.value || '').replace(/\D/g, ''));
                const maxLen = brand === 'American Express' ? 4 : 3;
                e.target.value = e.target.value.replace(/\D/g, '').slice(0, maxLen);
                setFieldError(cvvInput, $('errCardCvv'), '');
                const isValidCvv = e.target.value.length === maxLen || (brand === 'Card' && e.target.value.length >= 3);
                setFieldValid(cvvInput, isValidCvv);
                if (e.target.value.length === maxLen && brand !== 'Card') {
                    $('billingZipInput')?.focus();
                }
            });
            cvvInput.addEventListener('blur', () => {
                const digits = cvvInput.value.replace(/\D/g, '');
                const brand = detectCardBrand(($('cardNumberInput')?.value || '').replace(/\D/g, ''));
                const expectedLen = brand === 'American Express' ? 4 : 3;
                if (digits.length > 0 && (digits.length < 3 || (brand === 'American Express' && digits.length !== 4))) {
                    setFieldError(cvvInput, $('errCardCvv'), `Enter the ${expectedLen}-digit security code.`);
                }
            });
        }

        const zipInput = $('billingZipInput');
        if (zipInput) {
            zipInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/[^A-Za-z0-9\s-]/g, '').slice(0, 10);
                setFieldError(zipInput, $('errBillingZip'), '');
                setFieldValid(zipInput, /^[A-Za-z0-9\s-]{5,10}$/.test(zipInput.value.trim()));
            });
            zipInput.addEventListener('blur', () => {
                const val = zipInput.value.trim();
                if (val && !/^[A-Za-z0-9\s-]{3,10}$/.test(val)) {
                    setFieldError(zipInput, $('errBillingZip'), 'Enter a valid billing postal code.');
                }
            });
        }

        const holderInput = $('cardholderName');
        if (holderInput) {
            holderInput.addEventListener('input', () => {
                setFieldError(holderInput, $('errCardholder'), '');
                setFieldValid(holderInput, holderInput.value.trim().length >= 2);
            });
            holderInput.addEventListener('blur', () => {
                const val = holderInput.value.trim();
                if (val.length > 0 && val.length < 2) {
                    setFieldError(holderInput, $('errCardholder'), 'Enter the cardholder name shown on your card.');
                }
            });
        }

        const payForm = $('cardPaymentForm');
        if (payForm) payForm.addEventListener('submit', handlePaymentSubmit);

        const continueWithCardBtn = $('continueWithCardBtn');
        if (continueWithCardBtn) continueWithCardBtn.addEventListener('click', handleContinueWithCardUnavailable);

        const switchQuickBtn = $('switchToAlternativesQuickBtn');
        if (switchQuickBtn) {
            switchQuickBtn.addEventListener('click', () => {
                state.viewMode = 'alt_grid';
                renderActiveView();
            });
        }

        const switchFooterBtn = $('switchToAltFooterBtn');
        if (switchFooterBtn) {
            switchFooterBtn.addEventListener('click', () => {
                state.viewMode = 'alt_grid';
                renderActiveView();
            });
        }

        const proceedToAltBtn = $('proceedToAlternativesBtn');
        if (proceedToAltBtn) {
            proceedToAltBtn.addEventListener('click', () => {
                const altPanel = $('altPaymentPanel');
                if (altPanel && altPanel.style.display !== 'none') {
                    try {
                        altPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    } catch (_) {}
                    const firstMethodBtn = altPanel.querySelector('.alt-method-btn:not(:disabled)');
                    if (firstMethodBtn) firstMethodBtn.focus();
                } else {
                    state.viewMode = 'alt_grid';
                    renderActiveView();
                }
            });
        }

        const backToCardBtn = $('backToCardOverviewBtn');
        if (backToCardBtn) {
            backToCardBtn.addEventListener('click', () => {
                state.viewMode = 'card';
                renderActiveView();
            });
        }

        const returnToAltGridBtn = $('returnToAltGridBtn');
        if (returnToAltGridBtn) {
            returnToAltGridBtn.addEventListener('click', () => {
                state.viewMode = 'alt_grid';
                renderActiveView();
            });
        }

        const copyAppRefBtn = $('copyAppRefBtn');
        if (copyAppRefBtn) {
            copyAppRefBtn.addEventListener('click', () => {
                copyTextWithFeedback($('altInstAppId')?.textContent || state.appId, copyAppRefBtn, 'Copy');
            });
        }

        const copyDirectHandleBtn = $('copyDirectHandleBtn');
        if (copyDirectHandleBtn) {
            copyDirectHandleBtn.addEventListener('click', () => {
                copyTextWithFeedback($('altDirectHandleValue')?.textContent || '', copyDirectHandleBtn, 'Copy Handle');
            });
        }

        const copyCoordBtn = $('copyCoordTemplateBtn');
        if (copyCoordBtn) {
            copyCoordBtn.addEventListener('click', () => {
                copyTextWithFeedback($('altCoordTemplateText')?.textContent || '', copyCoordBtn, 'Copy Message');
            });
        }

        const extSenderInput = $('extSenderHandleInput');
        if (extSenderInput) {
            extSenderInput.addEventListener('input', () => {
                setFieldError(extSenderInput, $('errExtSenderHandle'), '');
                setFieldValid(extSenderInput, extSenderInput.value.trim().length >= 2);
            });
        }
        const extRefInput = $('extReferenceInput');
        if (extRefInput) {
            extRefInput.addEventListener('input', () => {
                setFieldError(extRefInput, $('errExtReference'), '');
                setFieldValid(extRefInput, extRefInput.value.trim().length >= 3);
            });
        }
        const extConfirmCb = $('extConfirmCheckbox');
        if (extConfirmCb) {
            extConfirmCb.addEventListener('change', () => {
                const errEl = $('extVerifyError');
                if (errEl && extConfirmCb.checked) {
                    errEl.textContent = '';
                    errEl.classList.remove('visible');
                }
            });
        }

        const extForm = $('externalVerifyForm');
        if (extForm) extForm.addEventListener('submit', handleExternalVerificationSubmit);

        const cancelBtns = [
            $('cancelFromUnavailableBtn'),
            $('cancelFromAltGridBtn'),
            $('cancelFromInstructionsBtn'),
        ];
        cancelBtns.forEach((btn) => {
            if (btn) btn.addEventListener('click', handleCancelPayment);
        });

        const changeFromVerifyBtn = $('changeMethodFromVerifyBtn');
        if (changeFromVerifyBtn) {
            changeFromVerifyBtn.addEventListener('click', () => {
                state.viewMode = 'alt_grid';
                renderActiveView();
            });
        }

        const resumeBtn = $('resumePaymentBtn');
        if (resumeBtn) {
            resumeBtn.addEventListener('click', () => {
                state.viewMode = 'alt_grid';
                renderActiveView();
            });
        }

        const switchAltFromFailureBtn = $('switchToAltFromFailureBtn');
        if (switchAltFromFailureBtn) {
            switchAltFromFailureBtn.addEventListener('click', () => {
                state.viewMode = 'alt_grid';
                renderActiveView();
            });
        }

        const lookupForm = $('lookupForm');
        if (lookupForm) {
            lookupForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const ref = normalizeAppId($('lookupAppIdInput')?.value || '');
                if (!ref) return;
                const nextUrl = new URL(window.location.href);
                nextUrl.searchParams.set('app_id', ref);
                window.location.assign(nextUrl.toString());
            });
        }

        const lookupRetryBtn = $('lookupRetryBtn');
        if (lookupRetryBtn) {
            lookupRetryBtn.addEventListener('click', () => {
                loadPaymentPortal();
            });
        }

        const tryAnotherBtn = $('tryAnotherCardBtn');
        if (tryAnotherBtn) {
            tryAnotherBtn.addEventListener('click', () => {
                wipeCardInputs();
                clearAllFieldErrors();
                state.viewMode = 'card';
                renderActiveView();
                if ($('cardNumberInput')) {
                    $('cardNumberInput').focus();
                }
            });
        }

        const supportBtn = $('contactSupportBtn');
        if (supportBtn) supportBtn.addEventListener('click', requestPaymentAssistance);

        const needHelpBtn = $('needHelpInlineBtn');
        if (needHelpBtn) needHelpBtn.addEventListener('click', requestPaymentAssistance);

        const helpAltGridBtn = $('helpFromAltGridBtn');
        if (helpAltGridBtn) helpAltGridBtn.addEventListener('click', requestPaymentAssistance);

        const retryFromAssist = $('retryFromAssistanceBtn');
        if (retryFromAssist) {
            retryFromAssist.addEventListener('click', () => {
                wipeCardInputs();
                clearAllFieldErrors();
                state.viewMode = state.config?.cardProcessing?.available ? 'card' : 'alt_grid';
                renderActiveView();
            });
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        wireUiEvents();
        loadPaymentPortal();
    });
})();
