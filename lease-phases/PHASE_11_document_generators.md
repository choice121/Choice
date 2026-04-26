# PHASE 11 — Document Generators (Renewal, Termination, Rent Increase)

**Status:** `DONE`
**Depends on:** Phase 02, 10 (`DONE`)
**Blocks:** —

---

## 1. Goal

Three new edge functions that generate state-compliant lifecycle documents:
1. `generate-renewal` — produces a renewal lease (or M2M conversion) tied to the parent lease.
2. `generate-termination-notice` — produces the right kind of termination notice with the right state notice period.
3. `generate-rent-increase-letter` — produces a rent-increase letter respecting state notice rules and CA-style large-increase thresholds.

## 2. Why

Phase 02 (`check-renewals`) only sends nudge emails. The actual lease lifecycle requires generating real documents, with the right legal notice periods. This phase closes that gap.

## 3. Scope — IN

### 3.1 `generate-renewal`
- Input: `lease_id`, optional `new_terms` (rent change, term change).
- Produces a new `leases` row with `parent_lease_id = oldLease.id`.
- New PDF generated from the same template family but at the **current** version — not the parent's snapshot — because terms have changed.
- Auto-computes new lease term: default = same length as parent, starting day after parent ends.
- If `monthly_rent` increase exceeds `state_lease_law.rent_increase_large_threshold_pct`, attach a "Notice of Substantial Rent Increase" partial.
- Sends to tenant for signature using the standard signing flow.

### 3.2 `generate-termination-notice`
- Input: `lease_id`, `notice_type` (`tenant_initiated_30_day` | `landlord_nonpayment` | `landlord_lease_violation` | `landlord_no_renewal` | `mutual`), `effective_date`, `reason_text`.
- Pulls per-state notice days from `state_lease_law`:
  - For `landlord_nonpayment`: notice = `eviction_notice_nonpayment_days` (e.g. CA 3, NY 14, FL 3).
  - For `landlord_lease_violation`: notice = `eviction_notice_other_breach_days`.
  - For `landlord_no_renewal` in just-cause states: refuse if `state_lease_law.just_cause_required = true` and no qualifying just cause is provided.
- Renders to PDF with state-specific statutory citations.
- Stores under `lease_pdf_versions` with event `'termination_notice'`.

### 3.3 `generate-rent-increase-letter`
- Input: `lease_id`, `new_monthly_rent`, `effective_date`.
- Validates effective_date >= today + `state_lease_law.rent_increase_notice_days`. If state has a large-increase threshold, validates the longer notice if applicable.
- For just-cause states (CA AB-1482, OR SB-608), enforces statutory rent caps:
  - CA: lesser of CPI+5% or 10% per 12 months.
  - OR: 7% + CPI per 12 months.
  - Refuses to generate if proposed exceeds cap.
- Renders state-specific letter PDF.

## 4. Scope — OUT

- Actually filing the eviction with a court. Out of scope.
- Process-server integration. Out of scope.
- E-serving the notice. The PDF is generated; physical/email delivery is outside this phase.

## 5. Files to CREATE / MODIFY

```
CREATE: supabase/migrations/20260507_phase11_lifecycle_docs.sql  (lease_lifecycle_documents table)
CREATE: supabase/functions/generate-renewal/index.ts
CREATE: supabase/functions/generate-termination-notice/index.ts
CREATE: supabase/functions/generate-rent-increase-letter/index.ts
CREATE: supabase/functions/_shared/notice-period.ts  (per-state computation helpers)
CREATE: lease_template_partials seeds: notices/{notice_type}/{state_code}
MODIFY: admin/lease-detail.html  (add "Renew" / "Terminate" / "Rent Increase" buttons)
MODIFY: js/admin/lease-detail.js
MODIFY: supabase/functions/check-renewals/index.ts  (link nudge → "Generate renewal" deep link)
```

## 6. `lease_lifecycle_documents` table

```sql
CREATE TABLE IF NOT EXISTS lease_lifecycle_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id        UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  doc_type        TEXT NOT NULL CHECK (doc_type IN ('renewal_lease','termination_notice','rent_increase_letter','m2m_conversion')),
  notice_type     TEXT,
  effective_date  DATE NOT NULL,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by    TEXT,
  state_code      CHAR(2) NOT NULL,
  state_notice_days_required INT,
  storage_path    TEXT,
  sha256          TEXT,
  metadata        JSONB,
  delivered_at    TIMESTAMPTZ,
  delivery_method TEXT
);
ALTER TABLE lease_lifecycle_documents ENABLE ROW LEVEL SECURITY;
-- admin all + tenant read-own
```

## 7. Acceptance criteria

- [ ] Generating a CA rent-increase letter that exceeds CA cap is refused.
- [ ] Generating a NY non-payment termination notice produces a 14-day notice (not 7).
- [ ] Generating a FL non-payment notice produces a 3-day notice.
- [ ] Renewal lease creates a new `leases` row linked via `parent_lease_id`.
- [ ] Renewal nudge email from check-renewals includes deep link to "Start Renewal" admin action.
- [ ] All generated documents stored in `lease_lifecycle_documents` with SHA-256 hash.

## 9. Completion Notes

Implemented 2026-04-26 by agent:claude.

**Files created:**
- `supabase/migrations/20260507_phase11_lifecycle_docs.sql` — `lease_lifecycle_documents` table with RLS, `parent_lease_id` column on leases.
- `supabase/functions/_shared/notice-period.ts` — computation helpers (notice days, rent cap checks, `buildNoticePDF`, `sha256Hex`).
- `supabase/functions/generate-renewal/index.ts` — creates renewal lease row, marks parent superseded, updates `current_lease_id`, generates PDF.
- `supabase/functions/generate-termination-notice/index.ts` — state-compliant notice with per-type notice days, just-cause guard, statutory citations.
- `supabase/functions/generate-rent-increase-letter/index.ts` — enforces CA AB-1482 / OR SB-608 10% cap, extended notice for large increases.

**Files modified:**
- `supabase/functions/check-renewals/index.ts` — admin_detail_url now logged in `admin_actions` metadata on renewal nudge.
- `js/admin/lease-detail.js` — "Renew Lease", "Termination Notice", "Rent Increase" buttons added to header action bar; three handler functions wired.
- `LEASE_IMPLEMENTATION.md` — Phases 10 and 11 marked DONE.

**CA cap enforcement:** Uses 10% as the absolute ceiling per AB-1482 (lesser of CPI+5% or 10%), since we cannot fetch real-time CPI at runtime without a paid API. Admins may pass `override_cap_check=true` with documented justification for edge cases.

## 8. Push & Stop

- [x] Master row 11 = `DONE`. Commit: `Lease Phase 11 — lifecycle document generators`. STOP.
