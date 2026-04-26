# PHASE 05 — Token & Signing Security Hardening + E-SIGN Consent

**Status:** `TODO`
**Depends on:** Phase 01 (`DONE`)
**Blocks:** —

---

## 1. Goal

Harden the token-based signing flow and add the E-SIGN consumer-consent step that federal law (15 USC §7001(c)) requires before any electronic signature is legally enforceable. Add token expiry, single-use enforcement, rate-limiting, and admin revoke/reissue.

## 2. Why

Today: tokens are generated with no expiry visible in schema, no single-use enforcement we can confirm, no rate limit on `sign-lease` attempts, no admin "revoke" button. And the law actually requires an explicit consumer consent step *before* the first electronic record is delivered. We do not currently capture that consent — it's a real enforceability gap.

## 3. Scope — IN

### 3.1 Token hardening
- Add `lease_signing_tokens` table (or columns on `applications`) with: `token TEXT PK`, `app_id`, `signer_role` (`tenant` | `co_applicant`), `created_at`, `expires_at` (default `created_at + 30 days`), `used_at`, `revoked_at`, `revoke_reason`.
- Modify `sign-lease` and `sign-lease-co-applicant` to:
  - Reject if token expired.
  - Reject if `used_at IS NOT NULL`.
  - Reject if `revoked_at IS NOT NULL`.
  - Set `used_at = now()` atomically on success (DB-side; SELECT...FOR UPDATE or RPC).
- Admin UI: "Revoke link" + "Resend link" buttons in `/admin/lease-detail.html` per signer.
- Resend creates a NEW token row, revokes any prior unused token for that signer, and re-emails.

### 3.2 Rate limiting
- Audit `_shared/rate-limit.ts` — confirm what it does. Wire it into `sign-lease`, `sign-lease-co-applicant`, `sign-amendment` with the limit: 5 attempts per token per hour, 20 per IP per hour.

### 3.3 E-SIGN consumer consent (15 USC §7001(c))
- New table `esign_consents (id uuid PK, app_id, signer_role, consented_at, ip_address, user_agent, hardware_software_disclosure_version, withdrawal_acknowledged BOOLEAN, paper_copy_acknowledged BOOLEAN)`.
- New `_shared/esign-consent.ts` exporting `CURRENT_DISCLOSURE_VERSION = '2026-04-v1'` and `getDisclosureText(): string` (the exact wording shown to consumers).
- Required disclosure content per E-SIGN §101(c):
  1. Tenant has the right to receive the records on paper instead of electronic. How to request paper copy + any fee.
  2. Tenant may withdraw consent. How.
  3. Whether consent applies only to this transaction or to a category of transactions.
  4. Hardware/software requirements: "modern browser (Chrome/Safari/Firefox/Edge updated within last 12 months), PDF viewer capability, valid email address."
  5. How to update tenant contact info.
- New page `/lease-sign-consent.html` (or step within `lease-sign.html` before the document is shown):
  - Display the disclosure text.
  - Two checkboxes: "I confirm my hardware/software meets the stated requirements" + "I consent to receive lease records electronically."
  - On submit, write to `esign_consents`, then redirect/advance to the document view.
  - Tenant cannot view the lease body until consent is recorded.
- Existing tenant-portal lease-sign behavior: load → consent step → preview lease → consent flow stays sticky (don't re-prompt within 30 days for same signer/email).

### 3.4 Token-bound IP option
- Optional flag in admin: "lock signing link to first-use IP." If on, the first successful signature attempt records the IP and subsequent attempts from a different IP are rejected with a clear message + admin notification.

## 4. Scope — OUT

- KYC / ID verification — explicitly off-roadmap (master §6).
- Two-factor / SMS OTP. (Not a paid service to add SMS via Twilio.)

## 5. Files to CREATE / MODIFY

```
CREATE: supabase/migrations/20260501_phase05_token_hardening.sql
CREATE: supabase/migrations/20260501_phase05_esign_consents.sql
CREATE: supabase/functions/_shared/esign-consent.ts
MODIFY: supabase/functions/sign-lease/index.ts
MODIFY: supabase/functions/sign-lease-co-applicant/index.ts
MODIFY: supabase/functions/sign-amendment/index.ts
MODIFY: supabase/functions/generate-lease/index.ts          (token issue with expiry)
MODIFY: supabase/functions/_shared/rate-limit.ts            (verify wired)
MODIFY: lease-sign.html                                      (consent step)
MODIFY: js/tenant/lease-sign.js
MODIFY: admin/lease-detail.html                              (revoke/resend buttons)
MODIFY: js/admin/lease-detail.js
```

## 6. SQL highlights

```sql
CREATE TABLE IF NOT EXISTS lease_signing_tokens (
  token            TEXT PRIMARY KEY,
  app_id           TEXT NOT NULL REFERENCES applications(app_id) ON DELETE CASCADE,
  signer_role      TEXT NOT NULL CHECK (signer_role IN ('tenant','co_applicant','witness')),
  signer_email     TEXT NOT NULL,
  ip_locked_to     INET,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  used_at          TIMESTAMPTZ,
  revoked_at       TIMESTAMPTZ,
  revoked_by       TEXT,
  revoke_reason    TEXT
);
CREATE INDEX IF NOT EXISTS idx_signing_tokens_app ON lease_signing_tokens(app_id);

CREATE TABLE IF NOT EXISTS esign_consents (
  id                                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id                              TEXT NOT NULL REFERENCES applications(app_id),
  signer_email                        TEXT NOT NULL,
  signer_role                         TEXT NOT NULL,
  disclosure_version                  TEXT NOT NULL,
  ip_address                          INET,
  user_agent                          TEXT,
  hardware_software_acknowledged      BOOLEAN NOT NULL,
  consent_given                       BOOLEAN NOT NULL,
  paper_copy_right_acknowledged       BOOLEAN NOT NULL,
  withdrawal_right_acknowledged       BOOLEAN NOT NULL,
  consented_at                        TIMESTAMPTZ NOT NULL DEFAULT now(),
  withdrawn_at                        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_esign_consents_app ON esign_consents(app_id);
```

(Both tables: enable RLS, admin-all + service-role-write policies. No anon access.)

## 7. Acceptance criteria

- [ ] Tokens expire after 30 days; expired token attempt returns 410 Gone + clear message.
- [ ] A token used once cannot be used again — second attempt returns 410.
- [ ] Admin can revoke an unused token from `/admin/lease-detail.html`. Revoked tokens reject with 410.
- [ ] Admin can resend a signing link; new token issued, old one auto-revoked.
- [ ] Rate-limit module rejects after 5 attempts/hour/token + 20/hour/IP.
- [ ] Tenant lease-sign flow: cannot view lease body until E-SIGN consent recorded. Consent row written to `esign_consents`.
- [ ] Consent flow asks for hardware/software ack + paper-copy right ack + withdrawal right ack as separate checkboxes.
- [ ] Disclosure version recorded — bumping `CURRENT_DISCLOSURE_VERSION` in code re-prompts consent on next visit.

## 8. Push & Stop

- [ ] Master row 05 = `DONE`.
- [ ] Commit: `Lease Phase 05 — token hardening + E-SIGN consent`.
- [ ] STOP.
