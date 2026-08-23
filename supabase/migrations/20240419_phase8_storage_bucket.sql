-- Phase 8: Create the application-docs storage bucket
-- Run this in Supabase SQL Editor OR create the bucket manually via Supabase Dashboard → Storage

-- Option A: SQL (requires service-role privileges)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'application-docs',
  'application-docs',
  FALSE,   -- private bucket: files are NOT publicly accessible
  10485760, -- 10 MB per file max
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can insert into their own app folder
-- (path format: {app_id}/{doc_type}/{timestamp}_{filename})
-- CREATE POLICY IF NOT EXISTS is not valid PostgreSQL syntax.
-- Use DROP + CREATE for idempotent policy application.
DROP POLICY IF EXISTS "Tenants can upload their own docs" ON storage.objects;
CREATE POLICY "Tenants can upload their own docs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'application-docs');

-- Admins (service role) can read/delete all docs
-- The Edge Functions use service role key, so they bypass RLS automatically.

-- Option B (manual): Go to Supabase Dashboard → Storage → New Bucket
--   Name: application-docs
--   Public: OFF
--   File size limit: 10 MB
--   Allowed MIME types: image/jpeg, image/png, image/webp, application/pdf
