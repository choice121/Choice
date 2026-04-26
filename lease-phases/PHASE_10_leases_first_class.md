# PHASE 10 — Leases as First-Class Entity (Refactor)

**Status:** `TODO`
**Depends on:** All prior phases (01–09) `DONE`
**Blocks:** Phase 11

---

## 1. Goal

Lift `leases` out of `applications` into its own first-class table. One application can spawn many leases over time (renewals, replacements after roommate changes, term changes). All edge functions migrate to operate on a lease by id, with `app_id` retained as a back-pointer for history.

## 2. Why

Today, `applications` carries lease fields (`lease_start_date`, `lease_end_date`, `monthly_rent`, `lease_pdf_url`, `lease_template_version_id`, etc.). When you renew, you either overwrite those — losing the prior lease — or hack around it. Modeling leases properly unblocks renewals, mid-term roommate changes, and clean termination.

## 3. Scope — IN

- New `leases` table with all lease-specific fields migrated from `applications`:
  ```
  id UUID PK, app_id, listing_id, state_code,
  lease_start_date, lease_end_date, monthly_rent, security_deposit, ...all itemized financials...,
  utility_responsibilities JSONB,
  lease_template_version_id, lease_pdf_url, lease_pdf_versions backref,
  lease_status (draft|sent|partially_signed|fully_signed|active|expiring|expired|terminated|renewed|cancelled),
  parent_lease_id (UUID null; when this is a renewal of another lease),
  created_at, updated_at, executed_at, terminated_at, termination_reason
  ```
- Backfill script (one-time migration): for each `applications` row with `lease_pdf_url IS NOT NULL`, create one `leases` row.
- Update `lease_pdf_versions`: add `lease_id` FK alongside `app_id`. Backfill.
- Update `lease_template_versions` snapshot table: add `lease_id` FK. Backfill.
- Update `lease_addenda_attached`: add `lease_id`.
- Update all edge functions to take `lease_id` as primary identifier:
  - `generate-lease`: takes `app_id` (creates new lease) OR `lease_id` (re-generates an existing lease).
  - `sign-lease`, `sign-lease-co-applicant`, `countersign`, `create-amendment`, `sign-amendment`, `get-lease`, `download-lease`, `verify-lease`: all keyed by `lease_id`. Token rows reference `lease_id`.
- Update admin pages: `/admin/leases.html`, `/admin/lease-detail.html` operate on lease ids.
- Update tenant portal: `/tenant/portal.html` lists all leases for the tenant (current + historical).
- Update RLS policies on storage to check `lease_id`-based ownership.

## 4. Scope — OUT

- Removing the lease columns from `applications` — keep them as deprecated for a release. Mark in column comments: `'DEPRECATED — see leases.<col>; will be removed in Phase 14.'`.

## 5. Files to CREATE / MODIFY

```
CREATE: supabase/migrations/20260506_phase10_leases_table.sql
CREATE: supabase/migrations/20260506_phase10_backfill_leases.sql
MODIFY: supabase/functions/_shared/lease-render.ts
MODIFY: supabase/functions/generate-lease/index.ts
MODIFY: supabase/functions/sign-lease/index.ts
MODIFY: supabase/functions/sign-lease-co-applicant/index.ts
MODIFY: supabase/functions/countersign/index.ts
MODIFY: supabase/functions/get-lease/index.ts
MODIFY: supabase/functions/download-lease/index.ts
MODIFY: supabase/functions/verify-lease/index.ts        (Phase 06)
MODIFY: supabase/functions/create-amendment/index.ts
MODIFY: supabase/functions/sign-amendment/index.ts
MODIFY: admin/leases.html, admin/lease-detail.html
MODIFY: js/admin/leases.js, js/admin/lease-detail.js
MODIFY: tenant/portal.html
MODIFY: js/tenant/portal.js
MODIFY: lease-sign.html
MODIFY: js/tenant/lease-sign.js
```

## 6. Backfill rules

- One application with `lease_pdf_url IS NOT NULL` → one lease row.
- Application with `lease_status IN ('draft',NULL)` and no PDF → no lease row yet (will be created on first generate).
- All historical `lease_pdf_versions` rows backfilled with the matching `lease_id`.
- Snapshot template versions backfilled.

## 7. Acceptance criteria

- [ ] Every executed historical lease maps to exactly one `leases` row.
- [ ] Tenant portal shows the historical lease + can download its PDF + cert.
- [ ] Admin can create a renewal lease that links via `parent_lease_id` to the prior lease.
- [ ] All edge functions take `lease_id`. `app_id` remains as fallback for old client code (sets a deprecation header).
- [ ] No lease data visible cross-tenant after refactor.

## 8. Push & Stop

- [ ] Master row 10 = `DONE`. Commit: `Lease Phase 10 — leases first-class refactor`. STOP.
