-- ============================================================
-- MIGRATION: property_photos — dedicated photo table (phase 3a)
-- Date: 2026-04-22
-- Purpose: Replace the parallel `properties.photo_urls TEXT[]` and
--          `properties.photo_file_ids TEXT[]` arrays with a proper
--          `property_photos` table that supports per-photo metadata
--          (display order, alt text, caption, watermark status,
--          dimensions) without losing array length invariants.
--
-- Strategy (zero-downtime, two-phase rollout):
--   Phase 3a (this file)  — create the new table, backfill from the
--     existing arrays, install triggers that keep the legacy arrays
--     in sync with the new table. Both representations exist
--     simultaneously. Application code is unchanged.
--   Phase 3b (later)      — migrate edge functions and UI to read /
--     write `property_photos` directly.
--   Phase 3c (final)      — drop the legacy arrays + sync triggers
--     in a follow-up migration.
--
-- Safety: idempotent. Wrapped in a single transaction. If any step
--         fails the migration aborts and nothing is committed.
-- ============================================================

BEGIN;

-- ── 1. Table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS property_photos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id      TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  url              TEXT NOT NULL,
  file_id          TEXT,
  display_order    INT  NOT NULL DEFAULT 0,
  alt_text         TEXT,
  caption          TEXT,
  watermark_status TEXT NOT NULL DEFAULT 'pending'
                   CHECK (watermark_status IN ('pending','applied','skipped','failed')),
  width            INT,
  height           INT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id, display_order)
);

CREATE INDEX IF NOT EXISTS idx_property_photos_property_order
  ON property_photos (property_id, display_order);

CREATE INDEX IF NOT EXISTS idx_property_photos_file_id
  ON property_photos (file_id) WHERE file_id IS NOT NULL;

-- ── 2. updated_at trigger ───────────────────────────────────
CREATE OR REPLACE FUNCTION property_photos_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS property_photos_updated_at ON property_photos;
CREATE TRIGGER property_photos_updated_at
  BEFORE UPDATE ON property_photos
  FOR EACH ROW EXECUTE FUNCTION property_photos_set_updated_at();

-- ── 3. RLS — mirror properties policies ─────────────────────
ALTER TABLE property_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "property_photos_public_read"     ON property_photos;
DROP POLICY IF EXISTS "property_photos_admin_all"       ON property_photos;
DROP POLICY IF EXISTS "property_photos_landlord_write"  ON property_photos;

-- Public read: any photo whose parent property is publicly visible.
CREATE POLICY "property_photos_public_read" ON property_photos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = property_photos.property_id
        AND p.status = 'published'
    )
  );

-- Admin full access.
CREATE POLICY "property_photos_admin_all" ON property_photos
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Landlord can manage photos for their own properties.
CREATE POLICY "property_photos_landlord_write" ON property_photos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN landlords l ON l.id = p.landlord_id
      WHERE p.id = property_photos.property_id
        AND l.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN landlords l ON l.id = p.landlord_id
      WHERE p.id = property_photos.property_id
        AND l.user_id = auth.uid()
    )
  );

-- ── 4. Backfill from existing arrays ────────────────────────
-- Only insert rows for (property_id, display_order) pairs that don't
-- already exist, so re-running this migration is safe.
INSERT INTO property_photos (property_id, url, file_id, display_order, watermark_status)
SELECT
  p.id,
  url,
  COALESCE(NULLIF(p.photo_file_ids[ord], ''), NULL),
  ord - 1,
  'applied'
FROM properties p
CROSS JOIN LATERAL unnest(p.photo_urls) WITH ORDINALITY AS u(url, ord)
WHERE p.photo_urls IS NOT NULL
  AND array_length(p.photo_urls, 1) > 0
ON CONFLICT (property_id, display_order) DO NOTHING;

DO $$
DECLARE
  backfilled INT;
  property_count INT;
BEGIN
  SELECT COUNT(*) INTO backfilled FROM property_photos;
  SELECT COUNT(DISTINCT property_id) INTO property_count FROM property_photos;
  RAISE NOTICE 'BACKFILL: % photo rows across % properties', backfilled, property_count;
END $$;

-- ── 5. Sync triggers (legacy arrays mirror new table) ───────
-- Until Phase 3b ships, application code still reads/writes the
-- legacy arrays. These triggers keep them in lockstep with the new
-- table whenever either side changes, in either direction.
--
-- Direction A: property_photos changes → rebuild arrays on properties
CREATE OR REPLACE FUNCTION property_photos_sync_arrays()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pid TEXT := COALESCE(NEW.property_id, OLD.property_id);
BEGIN
  UPDATE properties
     SET photo_urls = COALESCE((
           SELECT array_agg(url ORDER BY display_order)
           FROM property_photos
           WHERE property_id = pid
         ), ARRAY[]::TEXT[]),
         photo_file_ids = COALESCE((
           SELECT array_agg(file_id ORDER BY display_order)
           FROM property_photos
           WHERE property_id = pid
         ), ARRAY[]::TEXT[])
   WHERE id = pid;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS property_photos_sync_arrays_aiud ON property_photos;
CREATE TRIGGER property_photos_sync_arrays_aiud
  AFTER INSERT OR UPDATE OR DELETE ON property_photos
  FOR EACH ROW EXECUTE FUNCTION property_photos_sync_arrays();

-- Direction B: properties.photo_urls/photo_file_ids changes → rebuild table
-- This handles the existing UI code that still writes the arrays directly.
CREATE OR REPLACE FUNCTION properties_sync_photo_table()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  guard TEXT := current_setting('app.suppress_photo_sync', true);
BEGIN
  -- Avoid recursion when the sister trigger (Direction A) updates the arrays.
  IF guard = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.photo_urls IS NOT DISTINCT FROM OLD.photo_urls
                       AND NEW.photo_file_ids IS NOT DISTINCT FROM OLD.photo_file_ids THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('app.suppress_photo_sync', 'on', true);

  DELETE FROM property_photos WHERE property_id = NEW.id;

  IF NEW.photo_urls IS NOT NULL AND array_length(NEW.photo_urls, 1) > 0 THEN
    INSERT INTO property_photos (property_id, url, file_id, display_order, watermark_status)
    SELECT NEW.id,
           url,
           COALESCE(NULLIF(NEW.photo_file_ids[ord], ''), NULL),
           ord - 1,
           'applied'
    FROM unnest(NEW.photo_urls) WITH ORDINALITY AS u(url, ord);
  END IF;

  PERFORM set_config('app.suppress_photo_sync', 'off', true);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS properties_sync_photo_table_aiu ON properties;
CREATE TRIGGER properties_sync_photo_table_aiu
  AFTER INSERT OR UPDATE OF photo_urls, photo_file_ids ON properties
  FOR EACH ROW EXECUTE FUNCTION properties_sync_photo_table();

-- Suppress the reverse trigger while Direction A is running. We use a
-- session-local GUC because Postgres doesn't support disabling a
-- single trigger inside another trigger cleanly.
CREATE OR REPLACE FUNCTION property_photos_sync_arrays()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pid TEXT := COALESCE(NEW.property_id, OLD.property_id);
BEGIN
  PERFORM set_config('app.suppress_photo_sync', 'on', true);
  UPDATE properties
     SET photo_urls = COALESCE((
           SELECT array_agg(url ORDER BY display_order)
           FROM property_photos
           WHERE property_id = pid
         ), ARRAY[]::TEXT[]),
         photo_file_ids = COALESCE((
           SELECT array_agg(file_id ORDER BY display_order)
           FROM property_photos
           WHERE property_id = pid
         ), ARRAY[]::TEXT[])
   WHERE id = pid;
  PERFORM set_config('app.suppress_photo_sync', 'off', true);
  RETURN NULL;
END $$;

-- ── 6. Verification ─────────────────────────────────────────
DO $$
DECLARE
  missing_count INT;
BEGIN
  -- Every URL in properties.photo_urls should now exist in property_photos.
  SELECT COUNT(*) INTO missing_count
  FROM (
    SELECT p.id AS pid, url, ord - 1 AS ord
    FROM properties p
    CROSS JOIN LATERAL unnest(p.photo_urls) WITH ORDINALITY AS u(url, ord)
    WHERE p.photo_urls IS NOT NULL
  ) src
  LEFT JOIN property_photos pp
    ON pp.property_id = src.pid AND pp.display_order = src.ord
  WHERE pp.id IS NULL;

  IF missing_count = 0 THEN
    RAISE NOTICE 'VERIFICATION: ✓ All legacy photos backfilled into property_photos';
  ELSE
    RAISE EXCEPTION 'VERIFICATION FAILED: % photos missing from property_photos', missing_count;
  END IF;
END $$;

COMMIT;

-- ============================================================
-- AFTER RUNNING:
--   • property_photos contains one row per existing photo.
--   • Updates to either representation flow through to the other.
--   • No application code change is required for Phase 3a.
--
-- NEXT (Phase 3b):
--   • Update supabase/functions/imagekit-upload to insert into
--     property_photos directly with display_order = next_index.
--   • Update supabase/functions/imagekit-delete to delete the
--     matching row from property_photos (current code filters by
--     properties.photo_file_ids).
--   • Update landlord/new-listing.html, landlord/edit-listing.html,
--     landlord/dashboard.html, landlord/profile.html,
--     admin/properties.html, listings.html, property.html, and
--     js/card-builder.js to read property.photos[] (a join), or to
--     call a `get_property_photos(property_id)` RPC.
--
-- FINAL (Phase 3c):
--   • Drop both sync triggers.
--   • Drop columns properties.photo_urls and properties.photo_file_ids.
-- ============================================================
