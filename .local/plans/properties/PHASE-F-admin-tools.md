# Phase F — Admin & Landlord Tools

**Status:** Not started
**Risk:** Low
**Impact:** Medium (operational efficiency; not user-visible on the public site)
**Depends on:** Phase A (recommended — fixes the enum mismatch root cause first)
**Blocks:** Nothing

---

## Goal

Make day-to-day property management painless for staff and landlords:

1. **Fix the silent admin enum bug** — the chips on
   `admin/properties.html` reference `rented`, `inactive`,
   `maintenance` which are not values in `property_status`. Each of
   those tabs returns zero rows.
2. **Property quality score** in the admin grid so staff see at a
   glance which listings need attention.
3. **Bulk edit** — multi-select rows, change status / set featured /
   archive in one operation.
4. **Activity timeline** per property — views, applications, saves,
   inspections, edits.

## Files touched

| Layer | File | Change |
|---|---|---|
| DB | `supabase/migrations/<DATE>_phaseF01_status_enum_align.sql` (new) | Either `ALTER TYPE property_status ADD VALUE IF NOT EXISTS 'rented'/'inactive'/'maintenance'` (if business wants them) or remove the chips — pick one in this phase, document in Decision Log. |
| DB | `supabase/migrations/<DATE>_phaseF02_property_activity.sql` (new) | New `property_activity (id bigserial, property_id text, actor_id uuid, kind text, payload jsonb, at timestamptz default now())` with RLS so admin reads all, landlord reads own |
| DB | (same) | Triggers on `properties` UPDATE → log to `property_activity`. Same on `applications`, `saved_properties`, `lease_inspections`. |
| DB | (same) | A view `property_quality (property_id, score int 0-100, missing text[])` that computes the score from: photo count, has_geo, has_sqft, has_amenities, has_appliances, description length, has_security_deposit, has_available_date. |
| Admin | `admin/properties.html` | Replace the 4 hard-coded chips with chips driven by the actual enum values. Add a "Quality" column. Add a "Bulk actions" toolbar that appears when ≥1 row is selected. |
| Admin | `js/admin/properties.js` | Wire bulk select, bulk-status update via a single RPC `admin_bulk_update_property_status(ids text[], new_status property_status)`. |
| Admin | `admin/property-detail.html` (new or expand existing) | Activity timeline rendered from `property_activity`. |

## Acceptance criteria

- [ ] Every chip on the admin properties page returns a non-zero count for at least one realistic test fixture.
- [ ] Quality column shows a score 0–100 with a tooltip listing what's missing.
- [ ] Selecting 5 rows + clicking "Archive" updates all 5 in one round trip and logs 5 entries to `property_activity`.
- [ ] Activity timeline on a property shows the last 30 days of events.

## Verification

```sql
-- Enum is consistent with the chips
SELECT unnest(enum_range(NULL::property_status)) AS s;

-- Quality score smoke
SELECT * FROM property_quality
ORDER BY score ASC LIMIT 10;

-- Activity logging works
INSERT INTO properties (id, ...) VALUES (...);  -- causes a 'created' row
SELECT * FROM property_activity WHERE property_id = '...' ORDER BY at DESC;
```

## Rollback

- Revert the migration to remove enum values (only safe if no rows
  reference the new values).
- Drop `property_activity` and `property_quality` (no consumers outside
  the admin page).

## Estimated complexity

- 2 migrations (~80 lines + ~120 lines)
- 1 admin HTML overhaul (~80 lines)
- 1 admin JS overhaul (~150 lines)
- ~1 day
