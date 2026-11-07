-- ============================================================
-- Migration: 20261107000001_property_search_performance_indexes.sql
-- Description: Composite partial indexes for high-frequency public listings queries
-- ============================================================

-- Fast lookup for state-level browsing with price range filter
CREATE INDEX IF NOT EXISTS idx_properties_active_state_rent
  ON public.properties (state, monthly_rent)
  WHERE status = 'active';

-- Fast lookup for city-level browsing with bedroom filters
CREATE INDEX IF NOT EXISTS idx_properties_active_city_beds
  ON public.properties (city, bedrooms)
  WHERE status = 'active';

-- Fast sorting for default "Newest" sort order
CREATE INDEX IF NOT EXISTS idx_properties_active_created_desc
  ON public.properties (created_at DESC)
  WHERE status = 'active';

-- Fast sorting for "Price: Low to High" sort order
CREATE INDEX IF NOT EXISTS idx_properties_active_rent_asc
  ON public.properties (monthly_rent ASC)
  WHERE status = 'active';

-- Fast filtering by property classification (single_family, apartment, etc.)
CREATE INDEX IF NOT EXISTS idx_properties_active_type
  ON public.properties (property_type)
  WHERE status = 'active';
