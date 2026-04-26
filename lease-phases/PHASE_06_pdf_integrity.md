# PHASE 06 — PDF Integrity (SHA-256 + Audit Certificate Page)

**Status:** `TODO`
**Depends on:** Phase 01 (`DONE`), Phase 05 (`DONE`)
**Blocks:** —

---

## 1. Goal

Hash every PDF version with SHA-256, store the hash, and append a tamper-evident "Certificate of Completion" page to every executed lease showing the full audit trail (signers, IPs, timestamps, document hash, QR-code verification link).

## 2. Why

Right now `lease_pdf_versions` records the file but nothing proves the file you download today is the same file that was signed. Storing a SHA-256 + appending an audit certificate gets us to DocuSign-equivalent tamper-evidence — without paying DocuSign.

## 3. Scope — IN

- Add `sha256` (TEXT, 64 char hex), `certificate_appended` (BOOLEAN), `qr_verify_token` (TEXT) columns to `lease_pdf_versions`.
- Modify the upload path in `generate-lease`, `sign-lease`, `sign-lease-co-applicant`, `countersign`, `sign-amendment` to:
  1. Compute SHA-256 of the bytes.
  2. Save it on the `lease_pdf_versions` row.
  3. Generate a unique `qr_verify_token` (random 22-char URL-safe) for the executed (final-event) PDF only.
- Append a "Certificate of Completion" page to the PDF whenever the event is one of `tenant_signed`, `co_signed`, `countersigned`, `amended`, `renewed`. The cert page contains:
  - Document title, application ID, lease state, version number.
  - Signers table: name, role, email, ip_address, user_agent (truncated), signed_at.
  - PDF SHA-256 (the hash of the bytes *up to but not including* the cert page itself — so include hash with caveat that it covers the document body).
  - Generation timestamp + edge function version.
  - Audit log of E-SIGN consent IDs from `esign_consents` for each signer.
  - QR code linking to public verification URL `${SITE_URL}/verify-lease.html?t=${qr_verify_token}`.
  - Footer: "This certificate is generated and bound to the lease document by Choice Properties. Any modification of the lease body invalidates the document body hash."
- New public page `verify-lease.html`:
  - Reads `?t=` from query string.
  - Calls `verify-lease` edge function.
  - Shows: hash match (yes/no), signers + roles, signed dates, executed status, link to download PDF (if requester has access).
  - This page is INTENTIONALLY public for verification purposes but reveals only signer first names + last initials + state — never email/phone/address.
- New edge function `verify-lease`:
  - Public endpoint (no auth).
  - Looks up `qr_verify_token` → returns the safe public summary above + computes hash of stored PDF and compares with stored `sha256`.
  - If mismatch, return `{ tampered: true }` and log to `admin_actions`.

## 4. Scope — OUT

- AATL-trusted PKI signature (Adobe Sign, GlobalSign, etc.) — those are paid.
- RFC-3161 timestamp authority (TSA) — also paid for production-grade.
- Blockchain notarization. Not free at scale.

## 5. Files to CREATE / MODIFY

```
CREATE: supabase/migrations/20260502_phase06_pdf_integrity.sql
CREATE: supabase/functions/_shared/audit-certificate.ts        (PDF cert page renderer)
CREATE: supabase/functions/_shared/qr-code.ts                  (small QR encoder, public-domain)
CREATE: supabase/functions/verify-lease/index.ts
CREATE: verify-lease.html
CREATE: js/verify-lease.js
MODIFY: supabase/functions/_shared/pdf.ts                       (call audit-certificate appender)
MODIFY: supabase/functions/_shared/lease-render.ts              (compute/store hash on every record)
MODIFY: supabase/functions/generate-lease/index.ts
MODIFY: supabase/functions/sign-lease/index.ts
MODIFY: supabase/functions/sign-lease-co-applicant/index.ts
MODIFY: supabase/functions/countersign/index.ts
MODIFY: supabase/functions/sign-amendment/index.ts
```

## 6. SHA-256 in Deno

```ts
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
```

## 7. QR-code generation

Use a public-domain QR encoder ported to TS — for example, write a minimal QR-Code Model 2 / Version 5-L encoder inline (~300 lines), or vendor a permissive-licensed snippet (MIT/BSD/CC0). Do NOT add a paid or rate-limited QR API. Output as a pdf-lib drawSvgPath or as raw module-grid drawn with pdf-lib rectangles.

Acceptable libraries to vendor (verify license before commit):
- Project Nayuki QR Code generator (MIT).

## 8. Audit certificate layout

Single page (or two if many signers), 8.5×11", margins 0.5". Sections in order:

```
                    CERTIFICATE OF COMPLETION
                ─────────────────────────────────
Document:             Choice Properties Residential Lease
Application ID:       app_2026_AbCd1234
State:                CA  · Template version 7  · PDF version 4
Document SHA-256:     7f8e... (full 64 chars in fixed-width font)
Generated:            April 27, 2026 02:15 PM PDT  · edge:lease-render v1.6

SIGNERS
─────────────────────────────────────────────────────────
Tenant         Jane M. Doe          jane@…       198.51.100.7   2026-04-22 14:03 PDT
Co-Applicant   John A. Doe          john@…       198.51.100.7   2026-04-22 18:41 PDT
Management     Choice Properties    sherry@…     203.0.113.42   2026-04-23 09:12 PDT

E-SIGN CONSENTS
─────────────────────────────────────────────────────────
tenant         disclosure v 2026-04-v1   consented 2026-04-22 14:01
co_applicant   disclosure v 2026-04-v1   consented 2026-04-22 18:39

VERIFY THIS DOCUMENT
─────────────────────────────────────────────────────────
[QR code]     https://choice-properties-site.pages.dev/verify-lease.html?t=…
              Or scan to confirm signers + hash match.

This certificate is generated by Choice Properties and bound to the lease
document above. Any modification to the lease body invalidates the
document body hash. This is not legal advice; see disclaimer in lease body.
```

## 9. Acceptance criteria

- [ ] Every new PDF version row has `sha256` populated (not null).
- [ ] Every signing/countersign/amendment event PDF has a Certificate of Completion as the last page.
- [ ] Re-uploading the same bytes produces the same SHA — verify with a duplicate-version test.
- [ ] `verify-lease.html` with a valid `t=` token shows signer summary and "Hash matches: ✓".
- [ ] If the stored PDF bytes are altered out-of-band, `verify-lease` reports tampered.
- [ ] QR code in cert page scans to the verify URL on a real phone.
- [ ] No new paid dependencies added.

## 10. Push & Stop

- [ ] Master row 06 = `DONE`.
- [ ] Commit: `Lease Phase 06 — PDF integrity + audit certificate`.
- [ ] STOP.
