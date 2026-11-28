-- ============================================================================
-- Allow Multi-Folder & Multi-Batch Private Placement Reuse
-- ============================================================================
-- Updates idx_pipeline_batch_source_listing to scope uniqueness by
--   COALESCE(batch_id, folder_id::text, '__manual_inbox__')
-- so one property can appear in different batches or regular folders with
-- completely independent staging rows and enrichments.
-- ============================================================================

DROP INDEX IF EXISTS pipeline.idx_pipeline_batch_source_listing;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_batch_source_listing
  ON pipeline.pipeline_properties (
    COALESCE(batch_id, folder_id::text, '__manual_inbox__'),
    COALESCE(source, 'zillow'),
    source_listing_id
  )
  WHERE source_listing_id IS NOT NULL;
