-- Description enrichment metadata and audit trail (compliant)
ALTER TABLE pipeline.pipeline_properties
  ADD COLUMN IF NOT EXISTS original_description text,
  ADD COLUMN IF NOT EXISTS description_enrichment_meta jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS enrichment_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS enrichment_version text,
  ADD COLUMN IF NOT EXISTS needs_review boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS original_monthly_rent numeric,
  ADD COLUMN IF NOT EXISTS last_enriched_hash text,
  ADD COLUMN IF NOT EXISTS enriched_at timestamptz;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS description_enrichment_meta jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS description_cleaned_at timestamptz;

CREATE TABLE IF NOT EXISTS public.description_enrichment_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id text,
  property_id text,
  original_hash text,
  cleaned_hash text,
  changes jsonb,
  reasons jsonb,
  confidence numeric,
  ruleset_version text,
  model text,
  triggered_by text,
  latency_ms int,
  cost_cents numeric,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_desc_enrich_audit_pipeline_id ON public.description_enrichment_audit(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_desc_enrich_audit_property_id ON public.description_enrichment_audit(property_id);
