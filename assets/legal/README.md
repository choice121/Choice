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

## `epa-lead-pamphlet-2020.pdf` — REQUIRED for pre-1978 housing

**What:** EPA / HUD / CPSC pamphlet *"Protect Your Family From Lead in
Your Home"* (EPA-747-K-12-001, 2020 edition, English).

**Why we need it:** 42 U.S.C. §4852d and 24 C.F.R. §35.92(b)(1) require
every lessor of pre-1978 housing to **deliver this exact pamphlet** to
the tenant before the lease takes effect. The lease addendum
(`federal/lead-paint`) already contains the federally-required
disclosure language verbatim, so the lease itself is compliant; this PDF
is the companion deliverable that satisfies the separate
"information-pamphlet" prong of the rule.

**Sourcing it:**
The EPA periodically restructures the URL for this document. As of the
last verified link audit:

  1. EPA landing page (always current):
     <https://www.epa.gov/lead/real-estate-disclosure>
     — follow the link labelled *"Protect Your Family from Lead in Your
     Home"* (color, portrait, 508-compliant). Save the resulting PDF
     into this directory as `epa-lead-pamphlet-2020.pdf`.

  2. Search-engine fallback: query
     `Protect Your Family From Lead In Your Home site:epa.gov filetype:pdf`.

  3. As a last resort (DO NOT use a third-party copy without verifying
     it is the EPA-issued document) the EPA's National Service Center
     for Environmental Publications carries it under document ID
     `EPA-747-K-12-001`: <https://www.epa.gov/nscep>.

**Verification:** the file MUST start with the bytes `%PDF-`, be at
least ~1.5 MB, and the first interior page should bear the EPA / HUD /
CPSC logos and the title *"Protect Your Family From Lead in Your Home"*.
A separate Spanish edition exists (EPA-747-K-12-002, *"Proteja a su
familia del plomo en su casa"*) — adding it as
`epa-lead-pamphlet-2020-es.pdf` is encouraged but not currently wired
into the addenda library.

**What happens if you don't drop it in:** every issued lease for a
pre-1978 property will print `(see https://www.epa.gov/lead/real-estate-disclosure
for the official pamphlet)` after the lead-paint disclosure block, and
your operations team must hand-deliver or email the pamphlet to the
tenant separately. Tracked as agent_issue **#EPA-PAMPHLET**.
