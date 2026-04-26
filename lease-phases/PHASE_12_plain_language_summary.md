# Phase 12 — Plain-Language Summary + Spanish Locale + WCAG 2.1 AA

## Objective

Every tenant who opens the signing page should immediately understand the key
terms of their lease in plain language, in their negotiation language (EN or
ES), and through an interface that meets WCAG 2.1 AA accessibility standards.

---

## Scope (do not add to, do not skip)

### 12.1  Plain-language "at-a-glance" cover in the signing page UI

A new `#atag-section` panel is injected above the info-grid when `showState('form')` fires.
It presents, in simple language:
- Monthly rent (large, prominent)
- Property address
- Lease term (start → end)
- Security deposit
- Three plain-English bullet notices ("You must give X days' notice to end the tenancy", "Late fees apply after X days", "Pets: …")

The panel renders in the current locale (`_locale`).  The server already
returns all required fields in `json.app`.

### 12.2  Plain-language cover page in the PDF (page 1)

`_shared/plain-summary.ts` — new module.
`buildPlainLanguageSummaryBytes(app, locale)` — creates a one-page PDF that
summarises the lease key terms in plain English (or Spanish).

`_shared/lease-render.ts` — `finalizeAndStorePdf` accepts a new optional arg
`includeSummary?: boolean` (default `true`).  When true, after the main PDF
(+ optional cert) is built, `prependSummaryPage()` merges the summary page
in as page 1.

`generate-lease/index.ts` is NOT changed; it calls `finalizeAndStorePdf` with
the existing args and the default `includeSummary = true` picks up the feature
automatically.

### 12.3  Spanish UI for the signing page

CA Civil Code §1632 requires a Spanish translation of any lease negotiated
primarily in Spanish.  Practical demand extends this to OR and nationwide
Spanish-speaking applicants.

**Locale detection order** (first match wins):
1. `?lang=es` URL query param.
2. `app.negotiation_language === 'es'` in the server response.
3. Default: `'en'`.

`js/tenant/lease-sign.js` — adds:
- `const SIGN_UI = { en: {…}, es: {…} }` dictionary of all user-facing strings.
- `let _locale = 'en'` module variable.
- `function T(key, vars = {})` — returns `SIGN_UI[_locale][key]` with `{placeholder}` substitution, EN fallback.
- `detectLocale(app)` — sets `_locale` and `document.documentElement.lang`.
- All dynamic strings in signer banners, sign section labels, error messages,
  and button text use `T()`.

`_shared/i18n.ts` — extend with `sign_page.*` keys in both EN and ES.

### 12.4  WCAG 2.1 AA accessibility pass on lease-sign.html

Requirements (all verifiable by axe DevTools or Lighthouse):

| Category            | Fix |
|---------------------|-----|
| Skip navigation     | `<a href="#main-content" class="skip-link">Skip to main content</a>` as first child of body; `#main-content` on `.container` |
| Form labels         | All `<input>` elements have an associated `<label for="…">` or `aria-label` |
| Error association   | `aria-describedby` on each input linking to its error `<div>` |
| Required fields     | `aria-required="true"` on mandatory inputs |
| Live error regions  | `role="alert"` + `aria-live="assertive"` on all `.error-msg` divs |
| Focus ring          | `.skip-link:focus` and all interactive elements show 3 px outline |
| Canvas alternative  | `<canvas>` has `aria-label` + `role="img"` |
| Language            | `<html lang>` is updated to `"es"` when Spanish locale is active |

---

## Migration

`supabase/migrations/20260508_phase12_negotiation_language.sql`

Adds `negotiation_language TEXT DEFAULT 'en'` to `applications` (CA Civ. §1632
and practical demand for multi-language tenants).  Column is nullable-safe;
existing rows remain `'en'`.

---

## Acceptance Criteria

- [x] `?lang=es` on the signing URL renders the full UI in Spanish.
- [x] `app.negotiation_language = 'es'` (set by admin or application flow) is detected and the UI localises automatically without a URL param.
- [x] The plain-language at-a-glance section appears above the info-grid for every lease signing session.
- [x] Every generated lease PDF has a plain-language cover page as page 1.
- [x] All WCAG 2.1 AA items in §12.4 are addressed.
- [x] `negotiation_language` column exists in `applications`.
- [x] `LEASE_IMPLEMENTATION.md` Phase 12 = DONE.

---

## Files Changed

- `lease-phases/PHASE_12_plain_language_summary.md` (this file)
- `supabase/migrations/20260508_phase12_negotiation_language.sql`
- `supabase/functions/_shared/plain-summary.ts` (new)
- `supabase/functions/_shared/i18n.ts` (extend with sign_page.* keys)
- `supabase/functions/_shared/lease-render.ts` (wire prependSummaryPage)
- `lease-sign.html` (WCAG 2.1 AA fixes)
- `js/tenant/lease-sign.js` (i18n framework + Spanish UI + at-a-glance panel)
- `LEASE_IMPLEMENTATION.md` (Phase 12 → DONE)

---

## Completion Notes

Phase 12 implemented in full:

- **Plain-language at-a-glance panel** — rendered by JS into `#atag-section` injected before `#info-grid` on every signing session.  Shows rent, property, term, deposit, and three plain-English notices. Fully bilingual (EN/ES).
- **PDF cover page** — `_shared/plain-summary.ts` builds a single-page PDFDocument; `prependSummaryPage()` merges it into every finalized PDF as page 1 via pdf-lib copy-pages.  Wire-up is in `finalizeAndStorePdf` (default on).
- **Spanish locale** — `T()` + `SIGN_UI` dictionary replaces all hardcoded strings in the signing flow. Locale is detected from `?lang=es` URL param or `app.negotiation_language` from the server.
- **WCAG 2.1 AA** — skip link, `aria-label`/`aria-describedby`/`aria-required` on all inputs, `role="alert"` on error divs, canvas `role="img"`, `html[lang]` updated dynamically.

Completed: 2026-05-08 | agent:claude
