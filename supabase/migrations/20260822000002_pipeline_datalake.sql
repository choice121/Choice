-- =========================================================================================
-- Migration: Create Data Lake Storage for Pipeline
-- =========================================================================================

-- 1. Create the storage bucket for raw JSON payloads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('pipeline-raw-payloads', 'pipeline-raw-payloads', false, 10485760, ARRAY['application/json'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Restrict access to service_role only (private bucket)
CREATE POLICY "Give service role access to pipeline-raw-payloads" ON storage.objects
  FOR ALL USING (bucket_id = 'pipeline-raw-payloads' AND (auth.role() = 'service_role' OR auth.role() = 'postgres'));

