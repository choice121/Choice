# Supabase Data Audits

Read-only SQL queries used to surface data quality issues without mutating
anything. Run each block in the Supabase SQL editor and review the results
before requesting a fix script.

## Files

- **`data_audit.sql`** — Phase I audit: duplicate listings, missing
  `security_deposit` / `application_fee`, pet-policy mismatches, orphaned
  applications, stalled paid applications, legacy "Under Review" labels.

## Workflow

1. Open Supabase Dashboard → SQL Editor.
2. Paste one block from `data_audit.sql` at a time. Review the rows.
3. Send the rows you want corrected back to the agent — the agent will draft
   targeted `UPDATE` / `DELETE` statements scoped to the IDs you confirm,
   for you to review and run.
4. Never run mutations from this file. It is intentionally read-only.

## Canonical wording reminder

After fixing data, ensure new listings and applications use the canonical
copy defined in:

- `js/cp-copy.js` (client surfaces)
- `supabase/functions/_shared/copy.ts` (Edge Functions)
- `GAS-EMAIL-RELAY.gs` (`COPY` block at top — outbound email)

The platform's single, consistent flow is:
**Apply → Payment → Review → Approval → Reservation → Lease → Move-In**
