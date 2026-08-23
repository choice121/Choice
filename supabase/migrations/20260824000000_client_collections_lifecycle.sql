ALTER TABLE public.client_collections
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + interval '14 days');

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Add a nightly cron job to clean up expired collections
SELECT cron.schedule(
  'cleanup_expired_client_collections',
  '0 2 * * *', -- Run at 2:00 AM every day
  $$
    DELETE FROM public.client_collections WHERE expires_at < NOW();
  $$
);
