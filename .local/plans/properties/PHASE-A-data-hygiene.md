# Phase A — Data Hygiene & Schema Hardening

**Status:** Not started
**Risk:** Low
**Impact:** High (improves card consistency, removes silent admin bug, reduces footguns for future agents)
**Depends on:** Nothing
**Blocks:** Phase F (admin chips), Phase B (indexes go on the same columns)

---

## Goal

Eliminate the schema ambiguity around bathroom counts, fix the admin
chip ↔ enum mismatch that returns no results, backfill what we can in
existing rows, and remove the four duplicate-address groups.

## Why now

Three columns describe bathrooms (`bathrooms`, `total_bathrooms`,
`half_bathrooms`) and the card builder reads only `bathrooms`. Any
landlord-side write that updates only `total_bathrooms` is invisible.
The admin filter chips reference statuses (`rented`, `inactive`,
`maintenance`) that **do not exist** in the `property_status` enum, so
those tabs return zero rows silently. Both are footguns for the next
agent.

## Files touched

| Layer | File | Change |
|---|---|---|
| DB | `supabase/migrations/<DATE>_phaseA01_consolidate_bathrooms.sql` (new) | Backfill `bathrooms = COALESCE(bathrooms, total_bathrooms, half_bathrooms/2.0)`; drop redundant columns; add `CHECK (bathrooms >= 0 AND bathrooms <= 20)` |
| DB | `supabase/migrations/<DATE>_phaseA02_status_enum_audit.sql` (new) | `SELECT DISTINCT unnest(enum_range(NULL::property_status))` is captured in a comment block; if `rented`/`inactive`/`maintenance` are needed, `ALTER TYPE … ADD VALUE` them, otherwise update admin chips in Phase F |
| DB | `supabase/migrations/<DATE>_phaseA03_dedupe_addresses.sql` (new) | Find the 4 duplicate `(address, city, state)` groups and either merge (preserve highest‑views row) or flag with a `duplicate_of` column |
| Code | `js/card-builder.js` line ~110 | If we keep both `bathrooms` and `half_bathrooms`, render `2.5 ba` not `2 ba` when half exists |
| Code | `js/property.js` lines around the spec row render | Same — show `total_bathrooms` if both columns exist after migration |
| Admin | `admin/properties.html` chips | Removed in this phase OR replaced in Phase F — pick one |
| Doc | `replit.md` | Add a "Schema canonicals" subsection: bathroom count is `total_bathrooms` (or `bathrooms` — finalize during this phase) |

## Acceptance criteria

- [ ] Single canonical bathrooms column. Card and detail page both show the same number for the same property.
- [ ] No active property has `bedrooms IS NULL` or `bathrooms IS NULL` after backfill from raw description (use a regex on description: `\b(\d+)\s*(?:bed|br)\b` and `\b(\d+(?:\.\d+)?)\s*(?:bath|ba)\b`). Anything still null gets `status` flipped to `draft` with a `data_completeness_blocker` reason recorded.
- [ ] All four duplicate-address groups are reduced to one row each. Photos from merged rows are reassigned via `UPDATE property_photos SET property_id = winner_id WHERE property_id IN (loser_ids)`.
- [ ] Admin properties page shows non-zero counts for every chip OR the broken chips are removed.
- [ ] `replit.md` "Schema canonicals" section exists.

## Verification commands

```sql
-- 1. Canonicals: every active row has both bedrooms + bathrooms
SELECT COUNT(*) FROM properties
 WHERE status='active' AND (bedrooms IS NULL OR bathrooms IS NULL);
-- expected: 0

-- 2. No more triplet — only the canonical column remains
SELECT column_name FROM information_schema.columns
 WHERE table_name='properties' AND column_name LIKE '%bath%';
-- expected: 1 row only

-- 3. Duplicate addresses gone
SELECT COUNT(*) FROM (
  SELECT lower(trim(address))||'|'||lower(trim(city))||'|'||state AS k
  FROM properties GROUP BY 1 HAVING COUNT(*)>1
) t;
-- expected: 0

-- 4. Photo reassignment was clean — no orphans
SELECT COUNT(*) FROM property_photos pp
LEFT JOIN properties p ON p.id=pp.property_id
WHERE p.id IS NULL;
-- expected: 0
```

## Rollback

Each migration in this phase is `IF EXISTS` / `IF NOT EXISTS` guarded.
To roll back the bathrooms consolidation:

```sql
ALTER TABLE properties ADD COLUMN IF NOT EXISTS half_bathrooms integer;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS total_bathrooms numeric;
-- Then re-derive from a backup snapshot (Supabase auto-backups daily).
```

The dedupe migration **must** snapshot the loser rows into a
`properties_archive_phaseA` table before deletion; rollback is `INSERT
INTO properties SELECT * FROM properties_archive_phaseA`.

## Estimated complexity

- 3 migrations, ~150 lines of SQL total
- 2 small JS edits (~5 lines each)
- 1 `replit.md` section
- ~2 hours of work for an experienced agent
