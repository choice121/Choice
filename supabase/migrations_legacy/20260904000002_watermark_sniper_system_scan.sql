-- ============================================================
-- Choice Properties — Watermark Sniper Catalog & System Scanner
-- Date: 2026-09-04
-- ============================================================

-- 1. Partial index on watermark_status for instant lookups of flagged photos
CREATE INDEX IF NOT EXISTS idx_property_photos_watermark_status
  ON public.property_photos(watermark_status)
  WHERE watermark_status IN ('branding', 'watermark', 'flagged');

-- 2. Fast catalog retrieval for Watermark Sniper (replaces heavy client-side join)
DROP FUNCTION IF EXISTS public.get_watermark_sniper_catalog(integer,integer,text,text);

CREATE OR REPLACE FUNCTION public.get_watermark_sniper_catalog(
  p_limit int DEFAULT 2000,
  p_offset int DEFAULT 0,
  p_city text DEFAULT NULL,
  p_search text DEFAULT NULL
)
RETURNS TABLE (
  id text,
  title text,
  address text,
  city text,
  state text,
  zip text,
  status text,
  landlord_id uuid,
  created_at timestamptz,
  photo_id uuid,
  photo_url text,
  photo_file_id text,
  cover_url text,
  has_flagged_photo boolean,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH filtered AS (
    SELECT 
      p.id,
      p.title,
      p.address,
      p.city,
      p.state,
      p.zip,
      p.status::text as status_txt,
      p.landlord_id,
      p.created_at,
      count(*) OVER() as full_count
    FROM public.properties p
    WHERE 
      (p_city IS NULL OR p_city = '' OR p.city ILIKE p_city)
      AND (
        p_search IS NULL OR p_search = '' OR 
        p.address ILIKE '%' || p_search || '%' OR
        p.title ILIKE '%' || p_search || '%' OR
        p.city ILIKE '%' || p_search || '%' OR
        p.id ILIKE '%' || p_search || '%'
      )
    ORDER BY p.created_at DESC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT 
    f.id,
    f.title,
    f.address,
    f.city,
    f.state,
    f.zip,
    f.status_txt AS status,
    f.landlord_id,
    f.created_at,
    ph.id AS photo_id,
    ph.url AS photo_url,
    ph.file_id AS photo_file_id,
    cov.url AS cover_url,
    COALESCE(fl.has_flagged, false) AS has_flagged_photo,
    f.full_count AS total_count
  FROM filtered f
  LEFT JOIN LATERAL (
    SELECT pph.id, pph.url, pph.file_id
    FROM public.property_photos pph
    WHERE pph.property_id = f.id
    ORDER BY 
      CASE WHEN pph.display_order = 0 THEN 99 ELSE pph.display_order END ASC,
      pph.display_order ASC
    LIMIT 1
  ) ph ON true
  LEFT JOIN LATERAL (
    SELECT pph.url
    FROM public.property_photos pph
    WHERE pph.property_id = f.id
    ORDER BY pph.display_order ASC
    LIMIT 1
  ) cov ON true
  LEFT JOIN LATERAL (
    SELECT EXISTS (
      SELECT 1 FROM public.property_photos pph
      WHERE pph.property_id = f.id
        AND pph.watermark_status IN ('branding', 'watermark', 'flagged')
    ) AS has_flagged
  ) fl ON true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_watermark_sniper_catalog(int, int, text, text) TO anon, authenticated, service_role;

-- 3. System-wide scan function for detecting policy violations (watermarks, competitor logos, insufficient photos)
CREATE OR REPLACE FUNCTION public.scan_watermark_sniper_system()
RETURNS TABLE (
  property_id text,
  address text,
  city text,
  state text,
  zip text,
  status text,
  flag_reason text,
  photo_count bigint,
  flagged_photo_count bigint,
  flagged_photo_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH flagged_photos AS (
    SELECT 
      ph.property_id,
      count(*) AS f_count,
      min(ph.url) AS sample_url
    FROM public.property_photos ph
    WHERE ph.watermark_status IN ('branding', 'watermark', 'flagged')
    GROUP BY ph.property_id
  ),
  prop_stats AS (
    SELECT 
      ph.property_id,
      count(*) AS total_photos
    FROM public.property_photos ph
    GROUP BY ph.property_id
  )
  SELECT 
    p.id AS property_id,
    p.address,
    p.city,
    p.state,
    p.zip,
    p.status::text,
    'Competitor watermark or branding detected'::text AS flag_reason,
    COALESCE(ps.total_photos, 0) AS photo_count,
    COALESCE(fp.f_count, 0) AS flagged_photo_count,
    fp.sample_url AS flagged_photo_url
  FROM flagged_photos fp
  JOIN public.properties p ON p.id = fp.property_id
  LEFT JOIN prop_stats ps ON ps.property_id = p.id

  UNION ALL

  SELECT 
    p.id AS property_id,
    p.address,
    p.city,
    p.state,
    p.zip,
    p.status::text,
    'Insufficient photos (< 6 photos policy violation)'::text AS flag_reason,
    COALESCE(ps.total_photos, 0) AS photo_count,
    0::bigint AS flagged_photo_count,
    NULL::text AS flagged_photo_url
  FROM public.properties p
  JOIN prop_stats ps ON ps.property_id = p.id
  WHERE ps.total_photos < 6
    AND p.id NOT IN (SELECT fp2.property_id FROM flagged_photos fp2)

  ORDER BY flagged_photo_count DESC, address ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.scan_watermark_sniper_system() TO anon, authenticated, service_role;
