CREATE TABLE IF NOT EXISTS application_documents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id              TEXT NOT NULL REFERENCES applications(app_id) ON DELETE CASCADE,
  application_id      UUID REFERENCES applications(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  bucket              TEXT NOT NULL DEFAULT 'application-docs',
  storage_path        TEXT NOT NULL UNIQUE,
  original_file_name  TEXT,
  mime_type           TEXT,
  doc_type            TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending_upload',
  uploaded_by_email   TEXT,
  metadata            JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE application_documents ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE r RECORD; BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'application_documents'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

CREATE POLICY "application_documents_admin_all" ON application_documents
  FOR ALL USING (is_admin());

CREATE POLICY "application_documents_landlord_read" ON application_documents
  FOR SELECT USING (
    app_id IN (
      SELECT app_id FROM applications
      WHERE landlord_id = (SELECT id FROM landlords WHERE user_id = auth.uid())
         OR property_id IN (
              SELECT id FROM properties
              WHERE landlord_id = (SELECT id FROM landlords WHERE user_id = auth.uid())
            )
    )
  );

CREATE POLICY "application_documents_applicant_read" ON application_documents
  FOR SELECT USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON application_documents TO authenticated;

CREATE INDEX IF NOT EXISTS idx_application_documents_app_id  ON application_documents(app_id);
CREATE INDEX IF NOT EXISTS idx_application_documents_user_id ON application_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_application_documents_status  ON application_documents(status);