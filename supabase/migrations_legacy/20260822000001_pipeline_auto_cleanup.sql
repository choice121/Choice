-- Auto-cleanup RPC for pipeline records
-- Archiving old, failed, or published pipeline records to reduce UI clutter.

CREATE OR REPLACE FUNCTION pipeline_cleanup_orphans()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Auto-archive published listings after 30 days
  UPDATE choice_properties_pipeline
  SET status = 'archived'
  WHERE status = 'published'
    AND published_at < NOW() - INTERVAL '30 days';

  -- 2. Auto-archive failed listings older than 7 days
  UPDATE choice_properties_pipeline
  SET status = 'archived'
  WHERE status = 'failed'
    AND created_at < NOW() - INTERVAL '7 days';

  -- 3. Reap zero-photo listings older than 3 days
  UPDATE choice_properties_pipeline
  SET status = 'archived'
  WHERE status = 'scraped'
    AND original_image_urls = '[]'
    AND created_at < NOW() - INTERVAL '3 days';

  -- 4. Clean up completely orphaned records (no property, no photos) that are stuck
  UPDATE choice_properties_pipeline
  SET status = 'archived'
  WHERE status IN ('scraped', 'pending', 'error')
    AND choice_property_id IS NULL
    AND original_image_urls = '[]'
    AND created_at < NOW() - INTERVAL '7 days';
END;
$$;

-- Note: In a production environment, you would schedule this function using pg_cron,
-- e.g., SELECT cron.schedule('0 0 * * *', $$SELECT pipeline_cleanup_orphans()$$);
