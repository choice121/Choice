# `assets/legal/` — externally-authored legal disclosure assets

  Files in this directory are referenced by the addenda library
  (`lease_addenda_library.attached_pdf_path`) and embedded after the
  addendum text in lease PDFs by `supabase/functions/_shared/pdf.ts`.

  The render pipeline is **graceful**: when an `attached_pdf_path` row
  points to a file that 404s at fetch time, the lease still issues with a
  "see [source_url] for the official pamphlet" footer in place of the
  embedded asset. So a missing file here will never block lease issuance,
  but it does mean operators need to deliver the pamphlet to tenants via a
  different channel (paper handout, email attachment, etc.).

  ---

  ## `epa-lead-pamphlet-2026.pdf` — REQUIRED for pre-1978 housing

  **What:** EPA / HUD / CPSC pamphlet *"Protect Your Family From Lead in
  Your Home"*, **2026 edition** (English). The EPA refreshed this
  publication in February 2026; this is the version currently linked from
  <https://www.epa.gov/lead/protect-your-family-lead-your-home-english>.

  **Why we need it:** 42 U.S.C. §4852d and 24 C.F.R. §35.92(b)(1) require
  every lessor of pre-1978 housing to **deliver this exact pamphlet** to
  the tenant before the lease takes effect. The lease addendum
  (`federal/lead-paint`) already contains the federally-required
  disclosure language verbatim, so the lease itself is compliant; this PDF
  is the companion deliverable that satisfies the separate
  "information-pamphlet" prong of the rule.

  **Source of this file:**
  Downloaded from the EPA on 2026-04-27:

    `https://www.epa.gov/system/files/documents/2026-02/protectyourfamily_pamphlet_2026_3.pdf`

  The EPA landing page (always current) is
  <https://www.epa.gov/lead/protect-your-family-lead-your-home-english>.
  When the EPA next refreshes the pamphlet, drop the new file in here as
  `epa-lead-pamphlet-<year>.pdf` and update
  `lease_addenda_library.attached_pdf_path` for slug
  `federal/lead-paint` via a migration.

  **Verification rules** (any replacement file MUST satisfy):
    - First 5 bytes must be `%PDF-`
    - Size must be at least ~1 MB (current file: 1.34 MB)
    - First interior page bears the EPA / HUD / CPSC logos and the title
      *"Protect Your Family From Lead in Your Home"*

  **Spanish edition** (EPA-747-K-12-002, *"Proteja a su familia del plomo
  en su casa"*) — encouraged but not currently wired into the addenda
  library. As of this audit the EPA has not yet published a 2026 Spanish
  refresh; revisit when they do.

  **What happens if this file is missing:** the lease still issues, but
  the lead-paint disclosure block prints a footer
  `(see https://www.epa.gov/lead/protect-your-family-lead-your-home-english
  for the official pamphlet)` in place of the embedded PDF, and your
  operations team must hand-deliver or email the pamphlet to the tenant
  separately.
  