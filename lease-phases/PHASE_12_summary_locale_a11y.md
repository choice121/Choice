# PHASE 12 — Plain-Language Summary + Spanish Locale + Accessibility

**Status:** `TODO`
**Depends on:** Phase 01, 03 (`DONE`)
**Blocks:** —

---

## 1. Goal

Three quality-of-experience upgrades wrapped into one phase:
1. **Plain-language summary cover page** auto-generated and prepended to every lease PDF.
2. **Spanish locale** for the entire tenant signing flow + lease body translation for all top-10 templates.
3. **WCAG 2.1 AA pass** on `lease-sign.html` and the new pages from Phases 06/08.

## 2. Why

- A 1-page "lease at a glance" drastically reduces tenant questions, deposit disputes, and abandoned signings.
- CA Civ. §1632 *requires* a Spanish translation when the lease is negotiated in Spanish (also Chinese, Tagalog, Vietnamese, Korean for CA — Spanish chosen as v1 for broadest reach).
- Accessibility isn't optional — fair-housing rules in NYC, Chicago, and many states require accessible electronic interfaces.

## 3. Scope — IN

### 3.1 Plain-language summary cover page
- Generated as page 1 of every lease PDF (BEFORE the legal body).
- Content blocks (auto-pulled from lease record):
  - "What you're renting": property address + property type.
  - "When": lease start → end. Term length in months.
  - "How much": monthly rent. Total move-in (itemized).
  - "What's included / not included": utilities matrix summarized.
  - "Pets": yes/no + per-pet fees.
  - "Late rent": grace period + fee structure (per state).
  - "Deposit return": state-specific window + how it works.
  - "If you want to leave": termination notice period (per state).
  - "Important attachments": list of attached addenda by title.
- Visually distinct from the legal body: larger type, color-banded sections, no legalese.
- Footer: "This summary is for convenience only. The legal text on the following pages controls. See disclaimer."

### 3.2 Spanish locale
- New i18n module already exists (`_shared/i18n.ts`) — extend it.
- Locale files at `js/i18n/en.json` and `js/i18n/es.json`.
- Spanish translation covers:
  - All UI strings on `lease-sign.html`, `lease-sign-consent.html` (Phase 05), `tenant/portal.html`, `verify-lease.html` (Phase 06), `tenant/inspection.html` (Phase 08).
  - Spanish-translated templates in `lease_template_versions` for the top 10 states (insert second template per state with `lang='es'`).
  - Spanish disclosures partial set: `common/disclaimer/es`, `federal/lead-paint/es`, etc.
- Locale toggle on every tenant-facing page; auto-detect from browser `Accept-Language` first visit.
- Tenant chosen locale stored in `applicants.preferred_locale` (new column).
- Lease generation respects `applicant.preferred_locale` when picking the Spanish vs English template.

### 3.3 Accessibility
- `lease-sign.html` and Phase 06/08 pages: WCAG 2.1 AA compliant.
- Specifically:
  - Signature pad: keyboard alternative ("Type signature only" mode disabled-by-default; show "Skip drawing" link with focus ring).
  - All form fields: visible labels, `aria-describedby` for help text + errors.
  - Color contrast >= 4.5:1 (audit via WebAIM contrast checker; document scores in PR).
  - All buttons: visible focus indicators, minimum 44×44px tap target.
  - PDF preview: include `aria-label="Lease document preview, scroll to read"`.
  - Skip-to-content link on every page (already mentioned in REPLIT.md M-7).
  - All images: `alt` text. Decorative images: `alt=""`.
  - Form submit errors: announced via `role="alert"` and live region.
  - All icons must also have text labels (not icon-only buttons).

## 4. Scope — OUT

- Other languages (Chinese, Tagalog, Vietnamese, Korean) — required by CA but defer to a future phase or per-customer demand. Spanish chosen as the highest-leverage v1.
- Voice-controlled signing. Future.
- ASL video tour. Future.

## 5. Files to CREATE / MODIFY

```
CREATE: supabase/functions/_shared/lease-summary.ts
CREATE: js/i18n/en.json
CREATE: js/i18n/es.json
CREATE: supabase/migrations/20260508_phase12_locale_columns.sql
CREATE: lease_template_versions Spanish seeds (10 templates)
CREATE: lease_template_partials Spanish seeds (disclaimer + addenda)
MODIFY: supabase/functions/_shared/pdf.ts                  (prepend summary page)
MODIFY: supabase/functions/_shared/i18n.ts                  (load locales)
MODIFY: lease-sign.html                                     (locale toggle + a11y)
MODIFY: js/tenant/lease-sign.js
MODIFY: tenant/portal.html, tenant/inspection.html, verify-lease.html
MODIFY: applicants table: ADD preferred_locale TEXT DEFAULT 'en'
```

## 6. Translation source

- For UI strings: write Spanish translations directly. They're short and reviewable. No machine translation in production runtime.
- For lease templates: derive Spanish from the seeded English templates (Phase 03) and from public-domain CA Civ. §1632-mandated bilingual rental agreement examples published by California DRE / state housing departments. Cite source URLs in seed file comments.
- Mark Spanish templates with `legal_review_status='statute_derived'` and a notes field flagging they need bilingual attorney review when budget allows.

## 7. Acceptance criteria

- [ ] Every newly generated lease PDF has a 1-page summary as page 1.
- [ ] Tenant can switch UI to Spanish and the entire signing flow renders in Spanish.
- [ ] Spanish lease body is the one rendered when applicant `preferred_locale='es'`.
- [ ] `lease-sign.html` passes axe-core (open-source) accessibility scan with zero errors.
- [ ] Lighthouse Accessibility score >= 95 on `lease-sign.html`, `verify-lease.html`, `tenant/inspection.html`.
- [ ] Skip-to-content link present and focusable.
- [ ] All buttons have keyboard focus rings.

## 8. Push & Stop

- [ ] Master row 12 = `DONE`. Commit: `Lease Phase 12 — summary + Spanish locale + a11y`. STOP.
