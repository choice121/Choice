-- ============================================================
-- Choice Properties — On-Demand Apify Scraping Only (No Scheduled/Automated Runs)
-- Updates scraping_providers metadata and removes any scheduled scraping jobs.
-- ============================================================

UPDATE public.scraping_providers
SET
  display_name = 'Apify On-Demand Zillow Scraper',
  config_json = COALESCE(config_json, '{}'::jsonb)
    || '{"execution_mode":"on_demand_only","scheduled_scraping":false}'::jsonb,
  updated_at = NOW()
WHERE provider_key = 'apify';

UPDATE public.policy_rules
SET
  description = 'Default on-demand scraping provider key (operator-triggered only; zero scheduled scraping).'
WHERE rule_key = 'default_scraping_provider';

DO $$
DECLARE
  v_job RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    FOR v_job IN
      SELECT jobid
      FROM cron.job
      WHERE jobname ILIKE '%scrap%'
         OR command ILIKE '%apify%'
    LOOP
      PERFORM cron.unschedule(v_job.jobid);
    END LOOP;
  END IF;
END $$;
