-- ============================================================
-- MIGRATION: Phase 3c — drop legacy photo arrays + sync triggers
-- Date: 2026-04-22
-- Purpose: Final step of the property_photos rollout. After Phase 3b
--          cut the writers (landlord/edit-listing.html and the
--          imagekit-* edge functions) over to property_photos as the
--          source of truth, this migration:
--            1. Drops the bidirectional sync triggers introduced in
--               Phase 3a (MIGRATION_property_photos.sql).
--            2. Drops the legacy photo_urls and photo_file_ids columns
--               on properties.
--
-- ⚠️  PRE-FLIGHT CHECKLIST — run all of these before applying:
--   ☐ Phase 3a migration is applied (property_photos table exists)
--   ☐ Phase 3b edge function deploys are live for ≥7 days with no
--     errors in the imagekit-upload / imagekit-delete logs
--   ☐ Every reader in the frontend has been moved off
--     `properties.photo_urls` / `properties.photo_file_ids`. Grep
--     should return ZERO matches for those identifiers under
--     listings.html, property.html, landlord/, admin/, js/.
--   ☐ A SELECT on `properties` joined to `property_photos` returns
--     at least the same number of photos as the legacy arrays:
--
--        SELECT p.id,
--               COALESCE(array_length(p.photo_urls, 1), 0) AS legacy_n,
--               (SELECT COUNT(*) FROM property_photos pp
--                 WHERE pp.property_id = p.id)             AS new_n
--          FROM properties p
--         WHERE COALESCE(array_length(p.photo_urls, 1), 0)
--               <> (SELECT COUNT(*) FROM property_photos pp
--                    WHERE pp.property_id = p.id);
--
--     The above query MUST return 0 rows.
--
-- This migration is intentionally separate from Phase 3b so it can be
-- held back until the cutover has soaked in production.
-- ============================================================

BEGIN;

-- 1. Drop the sync triggers (they reference the columns we are about to drop).
DROP TRIGGER IF EXISTS property_photos_sync_arrays_aiud ON property_photos;
DROP TRIGGER IF EXISTS properties_sync_photo_table_aiu  ON properties;

DROP FUNCTION IF EXISTS property_photos_sync_arrays();
DROP FUNCTION IF EXISTS properties_sync_photo_table();

-- 2. Drop the legacy columns.
ALTER TABLE properties DROP COLUMN IF EXISTS photo_urls;
ALTER TABLE properties DROP COLUMN IF EXISTS photo_file_ids;

-- 3. Optional: tighten the property_photos table now that it's authoritative.
--    Comment out if you want to keep current laxness.
--    ALTER TABLE property_photos ALTER COLUMN file_id SET NOT NULL;

COMMIT;

-- ============================================================
-- ROLLBACK HINT
-- If you must roll back urgently:
--   ALTER TABLE properties ADD COLUMN photo_urls     TEXT[] DEFAULT '{}';
--   ALTER TABLE properties ADD COLUMN photo_file_ids TEXT[] DEFAULT '{}';
--   UPDATE properties p
--      SET photo_urls = COALESCE((
--            SELECT array_agg(url ORDER BY display_order)
--              FROM property_photos WHERE property_id = p.id), '{}'),
--          photo_file_ids = COALESCE((
--            SELECT array_agg(file_id ORDER BY display_order)
--              FROM property_photos WHERE property_id = p.id), '{}');
-- Then re-apply MIGRATION_property_photos.sql to restore the triggers.
-- ============================================================
