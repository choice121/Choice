-- Migration 20261112000003: Republish Independent Batch Instances
-- Enables independent publishing instances for the same physical property across multiple batches.
-- Adds batch_id to public.properties and ensures parent_property_id indexing for physical property lineage.

ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS batch_id TEXT;
CREATE INDEX IF NOT EXISTS idx_properties_batch_id ON public.properties(batch_id);

-- Ensure parent_property_id index exists for physical property identity lookups
CREATE INDEX IF NOT EXISTS idx_properties_parent_id ON public.properties(parent_property_id);

-- Add index on (address, city, state) for fast physical property resolution
CREATE INDEX IF NOT EXISTS idx_properties_norm_address ON public.properties(lower(trim(address)), lower(trim(city)), upper(trim(state)));
