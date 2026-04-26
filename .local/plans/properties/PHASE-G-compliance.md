# Phase G — Compliance, Trust & Fair Housing

**Status:** Not started
**Risk:** Medium (fair-housing rules are state-by-state; an automated tool that misses something exposes the platform)
**Impact:** High (trust-and-safety lever; reduces real legal risk)
**Depends on:** Phase A (data model), Phase E (photo provenance)
**Blocks:** Nothing

---

## Goal

1. **Fair-housing language scan** on every listing description before
   publish. Flags protected-class violations
   (race/color/religion/national origin/sex/disability/familial status,
   plus any state-added protections).
2. **"Verified by Choice" badge** that is wired to an actual,
   per-property audit trail (currently the `landlords.verified` boolean
   exists but isn't backed by a checklist on the property itself).
3. **Per-state legal disclosures** surfaced on the public property
   page. The data already exists in the lease-template state-law
   migrations (`20260428000001_phase02_state_lease_law.sql`); it's not
   yet exposed to the public marketing surface.

## Files touched

| Layer | File | Change |
|---|---|---|
| Edge fn | `supabase/functions/_shared/fair-housing.ts` (new) | `scanForFairHousingViolations(text, state)` — uses an LLM with a strict prompt against an internal list of disallowed phrases ("no kids", "ideal for singles", "Christian community", etc.) and the state-specific protected classes. Returns `{ flagged: true, phrases: [...], severity: 'block'|'warn' }`. |
| Edge fn | `supabase/functions/save-listing/index.ts` (or wherever publish happens) | On status transition `draft → active`, run the scan. `severity:block` returns 4xx with the offending phrases. `severity:warn` lets the publish through but flags the row. |
| DB | `supabase/migrations/<DATE>_phaseG01_compliance_flags.sql` (new) | Add `properties.compliance_flags jsonb` and an audit table `compliance_scan_log (property_id, scanned_at, result jsonb)`. |
| DB | `supabase/migrations/<DATE>_phaseG02_verified_checklist.sql` (new) | New `landlord_verifications (landlord_id, doc_type, doc_url, verified_at, verified_by uuid)` with RLS so only admin writes. The `verified` boolean on `landlords` becomes a derived view. |
| HTML | `property.html` + `js/property.js` | New disclosure box near the "Apply" CTA: "By <state>'s law, <one-sentence summary>. Full lease law: <link>." Pulled from `state_lease_law` table created in Phase 02. |
| HTML | `property.html` | "Verified by Choice" badge with a small popover listing the verifications on file (ID verified ✓, Business license on file ✓, etc.) |
| Admin | `admin/properties.html` | New "Compliance" chip showing properties with flagged descriptions or stale verifications. |

## Acceptance criteria

- [ ] Publishing a draft with the description "Perfect for a Christian family with no pets" returns a 4xx with `phrases: ["Christian", "family"]`.
- [ ] Publishing a clean description succeeds and the row has `compliance_flags = {scan: 'pass', at: '2026-...'}`.
- [ ] The "Verified by Choice" badge on a public property page only renders when the corresponding landlord has at least 2 entries in `landlord_verifications`.
- [ ] Property pages for properties in CA, NY, TX, FL, GA, OR, WA, MA, IL, OH show a state-specific disclosure block sourced from `state_lease_law`.

## Verification

```sql
-- Scan log populated
SELECT property_id, result->>'severity' FROM compliance_scan_log
ORDER BY scanned_at DESC LIMIT 5;

-- Verifications gate the badge
SELECT l.id, COUNT(v.*) FROM landlords l
LEFT JOIN landlord_verifications v ON v.landlord_id = l.id
GROUP BY l.id;
```

```bash
# Public page surfaces state law
curl -s "https://choice-properties-site.pages.dev/rent/ca/sf/.../" \
  | grep -A2 "California law"
```

## Rollback

- Disable the publish gate by feature-flag (`COMPLIANCE_SCAN_ENABLED`).
- Compliance flags column is a tag — leave in place; it's additive.
- Verified badge: revert the Pages Function or HTML change.

## Estimated complexity

- 2 migrations (~70 lines + ~50 lines)
- 1 shared TS module (~150 lines, the prompt is most of it)
- 1 Edge fn update
- 1 HTML disclosure block
- 1 admin chip
- ~2 days; iteration on the LLM prompt is the long pole
