# PHASE 09 — Security Deposit Accounting + Deduction Letter Generator

**Status:** `TODO`
**Depends on:** Phase 02, 07, 08 (all `DONE`)
**Blocks:** —

---

## 1. Goal

At lease termination, generate a state-compliant itemized security deposit deduction letter and refund accounting, enforce the per-state return window from `state_lease_law`, and produce a signed PDF the tenant can dispute.

## 2. Why

States impose hard windows (14–60 days) and itemization requirements at move-out. Failing to comply can forfeit the entire deposit and trigger 2–3× penalty (treble damages in MA, MD, NJ). This phase makes compliance automatic.

## 3. Scope — IN

- New table `lease_deposit_accountings`:
  ```
  id UUID PK, app_id, lease_termination_id (Phase 11 fk; nullable for now),
  total_deposit_held NUMERIC(10,2),
  refund_owed_to_tenant NUMERIC(10,2),
  amount_withheld NUMERIC(10,2),
  state_return_deadline DATE,
  letter_pdf_path TEXT, letter_pdf_sha256 TEXT,
  generated_at, generated_by, sent_at, tenant_disputed_at, tenant_dispute_text,
  created_at, updated_at
  ```
- New table `lease_deposit_deductions`:
  ```
  id UUID PK, accounting_id FK, category TEXT (rent_arrears|cleaning|damages|unpaid_utilities|other),
  description TEXT, amount NUMERIC(10,2), supporting_photo_paths TEXT[], inspection_id FK NULL
  ```
- Admin UI `/admin/deposit-accounting.html`:
  - For each terminated lease: shows deposit components (Phase 07 split), proposes deductions linked to move-out inspection items rated `damaged` (Phase 08).
  - Admin enters per-deduction $ + description.
  - Auto-computes refund owed.
  - Auto-computes return deadline = move-out date + `state_lease_law.security_deposit_return_days` for the state.
  - Shows red banner if today > deadline.
- New edge function `generate-deposit-letter`:
  - Renders state-specific letter using templating engine + `state_lease_law` rules + Phase 04 partials.
  - Includes itemized table, photos (embedded from inspection bucket), tenant dispute instructions.
  - Stores PDF in `lease-pdfs` bucket + `lease_pdf_versions` with event `'deposit_accounting'`.
  - Hashes (Phase 06).
  - Emails tenant with PDF link.
- Tenant portal: deposit accounting visible at `/tenant/deposit.html` with "Dispute" button → records to `tenant_dispute_text`.

## 4. Scope — OUT

- Actually disbursing the refund (no payment integration).
- Small-claims filing automation.

## 5. Files to CREATE / MODIFY

```
CREATE: supabase/migrations/20260505_phase09_deposit_accounting.sql
CREATE: supabase/functions/generate-deposit-letter/index.ts
CREATE: supabase/functions/_shared/deposit-letter-render.ts
CREATE: admin/deposit-accounting.html
CREATE: js/admin/deposit-accounting.js
CREATE: tenant/deposit.html
CREATE: js/tenant/deposit.js
CREATE: lease_template_partials seeds: deposit-letter/{state_code}  (one per top-10 state)
```

## 6. Per-state letter requirements (minimum content)

- CA Civ. §1950.5(g): receipts for any deduction >$125; explanation of charges.
- MA Ch. 186 §15B: itemized list of damages, sworn under penalty of perjury, sent within 30 days.
- NJ Truth-in-Renting: itemized + interest accounting.
- TX Prop. §92.103: itemized within 30 days of surrender.
- FL §83.49(3): notice of intention to impose claim within 30 days; tenant has 15 days to object.

Each top-10 state's letter partial captures these specifics. Other states use a generic partial that pulls from `state_lease_law.security_deposit_return_days` + `notes`.

## 7. Acceptance criteria

- [ ] Admin can produce a deposit-accounting PDF for any terminated lease in <5 min.
- [ ] CA letter contains receipts requirement language for deductions >$125.
- [ ] FL letter contains "notice of intention to impose claim" language and 15-day objection notice.
- [ ] Return deadline computed per state and shown in admin dashboard.
- [ ] If admin generates letter past the deadline, system shows warning + records `late_generated` flag.
- [ ] Tenant can dispute via portal; dispute text captured.

## 8. Push & Stop

- [ ] Master row 09 = `DONE`. Commit: `Lease Phase 09 — deposit accounting + letter generator`. STOP.
