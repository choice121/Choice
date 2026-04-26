# Phase B — Indexing & Query Performance

**Status:** Not started
**Risk:** Low
**Impact:** Medium (latency + cost; not visible to users today at 772 rows but matters at 5k+)
**Depends on:** Nothing (Phase A optional — Phase B can run first)
**Blocks:** Phase H performance budget

---

## Goal

Add the missing indexes that the public listings page and the map view
actually query against. Get every common query path on an Index Scan
or Bitmap Index Scan, never on a Seq Scan over `properties`.

## Why now

Existing indexes are:

```
idx_properties_status               (status)
idx_properties_status_avail         (status, available_date)
idx_properties_status_beds          (status, bedrooms)
idx_properties_status_rent          (status, monthly_rent)
idx_properties_status_type          (status, property_type)
idx_properties_landlord_id          (landlord_id)
idx_properties_search_gin           (search_tsv) — GIN
```

Missing for queries we actually run:

| Query | Where it lives | Currently |
|---|---|---|
| Filter by state | listings.js → `.eq('state', X)` | Seq Scan |
| Filter by city | listings.js → `.ilike('city', '%X%')` | Seq Scan |
| Filter by zip | listings.js → `.eq('zip', X)` | Seq Scan |
| Sort by newest | listings.js default sort | Seq Scan + Sort |
| Map bbox query | listings.js map view → `.gte('lat',Y1).lte('lat',Y2).gte('lng',X1).lte('lng',X2)` | Seq Scan |
| Pets-only filter | filter chip | Seq Scan |

## Files touched

| Layer | File | Change |
|---|---|---|
| DB | `supabase/migrations/<DATE>_phaseB01_property_indexes.sql` (new) | Add the indexes below |
| DB | (same migration) | `ANALYZE properties;` at end so the planner picks them up |

## Migration content (sketch)

```sql
-- Geo: BRIN is cheap and works for bounding boxes when rows are inserted in roughly geo order;
-- use GiST if rows are random-ordered or if BRIN EXPLAINs are slow.
CREATE INDEX IF NOT EXISTS idx_properties_lat_lng
  ON properties USING gist (point(lng, lat))
  WHERE status = 'active';

-- Common filter facets. Partial index on active so the index stays small.
CREATE INDEX IF NOT EXISTS idx_properties_active_state
  ON properties (state) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_properties_active_city
  ON properties (lower(city)) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_properties_active_zip
  ON properties (zip) WHERE status = 'active';

-- Default "newest" sort
CREATE INDEX IF NOT EXISTS idx_properties_active_created
  ON properties (created_at DESC) WHERE status = 'active';

-- Pets boolean (boolean indexes only worth it as partial)
CREATE INDEX IF NOT EXISTS idx_properties_active_pets
  ON properties (pets_allowed) WHERE status = 'active' AND pets_allowed = true;

ANALYZE properties;
```

## Acceptance criteria

- [ ] All of the EXPLAIN tests below show **Index Scan / Bitmap Index Scan**, not Seq Scan.
- [ ] No new sequential scans introduced in the slow-query log.
- [ ] No regression on existing index-served queries (re-run the existing `idx_properties_status_*` EXPLAINs as a baseline).
- [ ] `pg_stat_user_indexes` `idx_scan` count climbs for each new index after a few hours of traffic.

## Verification commands

```sql
-- Each of these should NOT show "Seq Scan on properties"
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM properties
  WHERE status='active' AND state='TX' LIMIT 24;

EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM properties
  WHERE status='active' AND lower(city)='atlanta' LIMIT 24;

EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM properties
  WHERE status='active'
  ORDER BY created_at DESC LIMIT 24;

EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM properties
  WHERE status='active' AND pets_allowed=true LIMIT 24;

-- Geo bbox (Atlanta ~ish)
EXPLAIN (ANALYZE, BUFFERS) SELECT id,lat,lng FROM properties
  WHERE status='active'
    AND lat BETWEEN 33.6 AND 34.0
    AND lng BETWEEN -84.6 AND -84.2;

-- Index usage check (after some traffic)
SELECT relname, indexrelname, idx_scan
  FROM pg_stat_user_indexes
 WHERE relname='properties'
 ORDER BY idx_scan DESC;
```

## Rollback

```sql
DROP INDEX IF EXISTS idx_properties_lat_lng;
DROP INDEX IF EXISTS idx_properties_active_state;
DROP INDEX IF EXISTS idx_properties_active_city;
DROP INDEX IF EXISTS idx_properties_active_zip;
DROP INDEX IF EXISTS idx_properties_active_created;
DROP INDEX IF EXISTS idx_properties_active_pets;
```

Indexes are pure performance — drop is instant and zero‑risk.

## Estimated complexity

- 1 migration file, ~30 lines
- ~30 minutes including EXPLAIN verification
