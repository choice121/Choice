-- ============================================================
-- MIGRATION: property_photos RPC helpers (Phase 3b foundation)
-- Date: 2026-04-22
-- Purpose: Server-side helpers for inserting / deleting / reordering
--          photos in the new property_photos table. Used by the
--          imagekit-upload and imagekit-delete edge functions and
--          by the landlord portal once cut over.
--
-- All helpers respect existing RLS via SECURITY INVOKER and an
-- explicit ownership check on the parent property.
-- ============================================================

BEGIN;

-- ── add_property_photo ────────────────────────────────────────
-- Inserts a photo row at the next available display_order for the
-- given property and returns the new row id. Caller must own the
-- property (or be an admin).
CREATE OR REPLACE FUNCTION add_property_photo(
  p_property_id  TEXT,
  p_url          TEXT,
  p_file_id      TEXT,
  p_alt_text     TEXT DEFAULT NULL,
  p_caption      TEXT DEFAULT NULL,
  p_width        INT  DEFAULT NULL,
  p_height       INT  DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_owner    BOOLEAN;
  v_admin    BOOLEAN := is_admin();
  v_order    INT;
  v_new_id   UUID;
BEGIN
  IF p_property_id IS NULL OR p_url IS NULL THEN
    RAISE EXCEPTION 'property_id and url are required';
  END IF;

  -- Ownership / admin check
  SELECT EXISTS (
    SELECT 1
      FROM properties p
      JOIN landlords  l ON l.id = p.landlord_id
     WHERE p.id = p_property_id
       AND l.user_id = auth.uid()
  ) INTO v_owner;

  IF NOT (v_owner OR v_admin) THEN
    RAISE EXCEPTION 'Forbidden: not the owner of property %', p_property_id;
  END IF;

  -- Next free display_order
  SELECT COALESCE(MAX(display_order), -1) + 1
    INTO v_order
    FROM property_photos
   WHERE property_id = p_property_id;

  INSERT INTO property_photos (
    property_id, url, file_id, display_order,
    alt_text, caption, width, height, watermark_status
  ) VALUES (
    p_property_id, p_url, NULLIF(p_file_id, ''), v_order,
    p_alt_text, p_caption, p_width, p_height, 'applied'
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END $$;

GRANT EXECUTE ON FUNCTION add_property_photo(TEXT, TEXT, TEXT, TEXT, TEXT, INT, INT)
  TO authenticated;

-- ── delete_property_photo_by_file_id ──────────────────────────
-- Removes the photo row identified by file_id, then re-packs the
-- display_order so there are no gaps. Returns true if a row was
-- removed. Caller must own the parent property (or be an admin).
CREATE OR REPLACE FUNCTION delete_property_photo_by_file_id(
  p_file_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_pid    TEXT;
  v_owner  BOOLEAN;
  v_admin  BOOLEAN := is_admin();
BEGIN
  IF p_file_id IS NULL OR p_file_id = '' THEN
    RETURN FALSE;
  END IF;

  SELECT property_id INTO v_pid
    FROM property_photos
   WHERE file_id = p_file_id
   LIMIT 1;

  IF v_pid IS NULL THEN
    RETURN FALSE; -- already gone
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM properties p
      JOIN landlords  l ON l.id = p.landlord_id
     WHERE p.id = v_pid
       AND l.user_id = auth.uid()
  ) INTO v_owner;

  IF NOT (v_owner OR v_admin) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  DELETE FROM property_photos WHERE file_id = p_file_id;

  -- Re-pack display_order to remove gaps.
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY display_order) - 1 AS new_order
      FROM property_photos
     WHERE property_id = v_pid
  )
  UPDATE property_photos pp
     SET display_order = ranked.new_order
    FROM ranked
   WHERE pp.id = ranked.id
     AND pp.display_order IS DISTINCT FROM ranked.new_order;

  RETURN TRUE;
END $$;

GRANT EXECUTE ON FUNCTION delete_property_photo_by_file_id(TEXT) TO authenticated;

-- ── reorder_property_photos ───────────────────────────────────
-- Replaces the display order for a property using an ordered array
-- of file_ids (index 0 → display_order 0, etc.). Any photos not in
-- the array keep their relative order at the end. Caller must own
-- the parent property (or be an admin).
CREATE OR REPLACE FUNCTION reorder_property_photos(
  p_property_id TEXT,
  p_file_ids    TEXT[]
) RETURNS INT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_owner   BOOLEAN;
  v_admin   BOOLEAN := is_admin();
  v_count   INT     := 0;
  v_id      TEXT;
  v_order   INT     := 0;
BEGIN
  IF p_property_id IS NULL OR p_file_ids IS NULL THEN
    RAISE EXCEPTION 'property_id and file_ids are required';
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM properties p
      JOIN landlords  l ON l.id = p.landlord_id
     WHERE p.id = p_property_id
       AND l.user_id = auth.uid()
  ) INTO v_owner;

  IF NOT (v_owner OR v_admin) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  FOREACH v_id IN ARRAY p_file_ids LOOP
    UPDATE property_photos
       SET display_order = v_order
     WHERE property_id = p_property_id
       AND file_id     = v_id;
    IF FOUND THEN v_count := v_count + 1; END IF;
    v_order := v_order + 1;
  END LOOP;

  -- Push any unreferenced photos to the end (keeping their relative order).
  WITH tail AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY display_order) - 1 + v_order AS new_order
      FROM property_photos
     WHERE property_id = p_property_id
       AND (file_id IS NULL OR NOT (file_id = ANY (p_file_ids)))
  )
  UPDATE property_photos pp
     SET display_order = tail.new_order
    FROM tail
   WHERE pp.id = tail.id;

  RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION reorder_property_photos(TEXT, TEXT[]) TO authenticated;

COMMIT;
