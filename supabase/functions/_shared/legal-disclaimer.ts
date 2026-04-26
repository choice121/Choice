// Choice Properties — Shared: legal-disclaimer.ts
//
// Phase 01 — single source of truth for the standardized non-attorney-review
// disclaimer that every generated lease document MUST contain.
//
// Rationale (master plan §5.4): templates and addenda are statute-derived,
// not individually attorney-reviewed for every jurisdiction. Federal and
// state UPL (unauthorized practice of law) rules require us to be explicit
// that we are not a law firm and do not provide legal advice. This text is
// referenced as the partial 'common/disclaimer' in lease_template_partials
// (seeded by 20260427000001_phase01_template_partials.sql) and is also
// directly importable by edge functions when they need to inject the text
// without going through the templating engine.
//
// If this wording changes, BUMP DISCLAIMER_VERSION so audit-cert pages and
// E-SIGN consent records correctly reflect which version was shown to a
// signer at signing time.

export const DISCLAIMER_VERSION = '2026-04-v1';

export const STANDARD_DISCLAIMER =
  'This document is statute-derived and has not been individually ' +
  'attorney-reviewed for every jurisdiction. Choice Properties is not ' +
  'a law firm and does not provide legal advice. Tenants and landlords ' +
  'are encouraged to consult a licensed attorney in their state before signing.';

/**
 * Disclaimer formatted as a standalone block for direct PDF inclusion when
 * the engine isn't being used (e.g. legacy callers). The wrapping line
 * lets the wrapText helper render it without ambiguity.
 */
export function disclaimerBlock(): string {
  return '\n\n--- IMPORTANT ---\n' + STANDARD_DISCLAIMER + '\n';
}
