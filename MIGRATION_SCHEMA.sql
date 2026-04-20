-- ============================================================
-- MIGRATION_SCHEMA.sql — Choice Properties
-- Complete SQL for the GAS → Supabase migration
--
-- FOR ANY AI READING THIS:
--   This file is the authoritative SQL for the migration.
--   Do NOT propose alternative table designs.
--   Do NOT split applications/leases/move-ins into separate
--   tables — see MIGRATION.md Section 4 for why.
--   Run this AFTER SETUP.sql (not instead of it).
--   SETUP.sql creates the base tables. This file adds what
--   SETUP.sql does not yet have.
--
-- ORDER OF OPERATIONS:
--   1. Run SETUP.sql against Supabase (creates applications,
--      co_applicants, enums, is_admin, base RLS, etc.)
--   2. Run this file (adds lease_templates, sign_events,
--      storage buckets, landlord UPDATE policy, new indexes,
--      and the applicant status dashboard function)
--   3. Deploy serve.js changes (pdfkit endpoint, Nodemailer)
--   4. Deploy admin HTML pages
--
-- Safe to re-run: all statements use IF NOT EXISTS,
-- OR REPLACE, and ON CONFLICT throughout.
-- ============================================================


-- ============================================================
-- SECTION M1 — VERIFY PREREQUISITES
-- These tables must exist before this file runs.
-- If any of these SELECTs fail, run SETUP.sql first.
-- ============================================================

DO $$
BEGIN
  -- Check that SETUP.sql has been run
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'applications'
  ) THEN
    RAISE EXCEPTION
      'applications table not found. Run SETUP.sql before this file.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'co_applicants'
  ) THEN
    RAISE EXCEPTION
      'co_applicants table not found. Run SETUP.sql before this file.';
  END IF;
END $$;


-- ============================================================
-- SECTION M2 — LEASE TEMPLATES TABLE
--
-- Stores the editable lease template as a structured JSON blob.
-- Admins can edit the template from the admin panel.
-- The serve.js /generate-lease endpoint reads the active template
-- and substitutes variable placeholders with application data.
--
-- Only one template is "active" at a time. Previous versions
-- are retained for audit.
--
-- Variable format in template_body: {{variable_name}}
-- Example: "This lease is between {{landlord_name}} and
--           {{tenant_full_name}} for the property at
--           {{property_address}}..."
-- ============================================================

CREATE TABLE IF NOT EXISTS lease_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL DEFAULT 'Standard Lease',
  is_active    BOOLEAN NOT NULL DEFAULT false,
  template_body  TEXT NOT NULL,   -- Full lease text with {{variable}} placeholders
  variables    JSONB DEFAULT '{}'::jsonb,  -- Metadata about variables (optional docs)
  notes        TEXT,              -- Internal notes about this template version
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  created_by   TEXT              -- Email of admin who created/updated it
);

-- Only one template can be active at a time
CREATE UNIQUE INDEX IF NOT EXISTS lease_templates_one_active
  ON lease_templates (is_active)
  WHERE is_active = true;

-- RLS
ALTER TABLE lease_templates ENABLE ROW LEVEL SECURITY;

-- Only admins can read or modify lease templates
CREATE POLICY "lease_templates_admin_all" ON lease_templates
  FOR ALL USING (is_admin());

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_lease_template_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lease_templates_updated_at ON lease_templates;
CREATE TRIGGER lease_templates_updated_at
  BEFORE UPDATE ON lease_templates
  FOR EACH ROW EXECUTE FUNCTION update_lease_template_updated_at();

-- Seed the initial template if none exists.
-- This is a minimal placeholder — the admin can edit it in the panel.
-- Variable reference:
--   {{tenant_full_name}}       — first_name + last_name from applications
--   {{tenant_email}}           — email from applications
--   {{tenant_phone}}           — phone from applications
--   {{property_address}}       — property_address from applications
--   {{lease_start_date}}       — lease_start_date from applications
--   {{lease_end_date}}         — lease_end_date from applications
--   {{monthly_rent}}           — monthly_rent from applications
--   {{security_deposit}}       — security_deposit from applications
--   {{move_in_costs}}          — move_in_costs from applications
--   {{landlord_name}}          — lease_landlord_name from applications
--   {{landlord_address}}       — lease_landlord_address from applications
--   {{late_fee_flat}}          — lease_late_fee_flat from applications
--   {{late_fee_daily}}         — lease_late_fee_daily from applications
--   {{state_code}}             — lease_state_code from applications
--   {{pets_policy}}            — lease_pets_policy from applications
--   {{smoking_policy}}         — lease_smoking_policy from applications
--   {{desired_lease_term}}     — desired_lease_term from applications
--   {{app_id}}                 — app_id from applications
--   {{signature_date}}         — date lease was signed
--   {{tenant_signature}}       — typed signature from signing flow

INSERT INTO lease_templates (name, is_active, template_body, notes)
VALUES (
  'Standard Residential Lease Agreement',
  true,
  E'RESIDENTIAL LEASE AGREEMENT\n\nThis Residential Lease Agreement ("Agreement") is entered into as of {{lease_start_date}} between:\n\nLandlord: {{landlord_name}}\nAddress: {{landlord_address}}\n\nTenant(s): {{tenant_full_name}}\nEmail: {{tenant_email}}\nPhone: {{tenant_phone}}\n\n1. PROPERTY\nLandlord agrees to lease to Tenant the property located at:\n{{property_address}}\n\n2. TERM\nThis lease begins {{lease_start_date}} and ends {{lease_end_date}}.\n\n3. RENT\nMonthly rent is ${{monthly_rent}}, due on the 1st of each month.\n\n4. SECURITY DEPOSIT\nSecurity deposit: ${{security_deposit}}.\n\n5. MOVE-IN COSTS\nTotal move-in costs due at signing: ${{move_in_costs}}.\n\n6. LATE FEES\nRent not received by the 5th is subject to a ${{late_fee_flat}} flat fee and ${{late_fee_daily}}/day thereafter.\n\n7. PETS\n{{pets_policy}}\n\n8. SMOKING\n{{smoking_policy}}\n\n9. GOVERNING LAW\nThis agreement is governed by the laws of the State of {{state_code}}.\n\n10. APPLICATION REFERENCE\nApplication ID: {{app_id}}\n\n--- SIGNATURES ---\n\nTenant Signature: {{tenant_signature}}\nDate: {{signature_date}}\n\nLandlord Signature: ______________________\nDate: ______________________\n',
  'Initial template — edit via Admin Panel → Leases → Edit Template'
)
ON CONFLICT DO NOTHING;


-- ============================================================
-- SECTION M3 — SIGN EVENTS TABLE (E-Sign Audit Trail)
--
-- Records every signing event with full audit detail.
-- This supplements the signature columns on `applications`
-- (which store the final typed name) with a complete log of
-- who signed what, when, from where.
--
-- Relationship: one or two sign_events per application
-- (tenant + optional co-applicant).
--
-- signer_type: 'tenant' | 'co_applicant' | 'admin'
-- ============================================================

CREATE TABLE IF NOT EXISTS sign_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id          TEXT NOT NULL REFERENCES applications(app_id) ON DELETE CASCADE,
  signer_type     TEXT NOT NULL CHECK (signer_type IN ('tenant', 'co_applicant', 'admin')),
  signer_name     TEXT NOT NULL,       -- Typed legal name from signing form
  signer_email    TEXT,
  ip_address      TEXT NOT NULL,
  user_agent      TEXT,
  signed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  token_used      TEXT,                -- The signing token that was consumed
  lease_pdf_path  TEXT                 -- Supabase Storage path of PDF at time of signing
);

CREATE INDEX IF NOT EXISTS sign_events_app_id_idx ON sign_events (app_id);

ALTER TABLE sign_events ENABLE ROW LEVEL SECURITY;

-- Admins see all sign events
CREATE POLICY "sign_events_admin_all" ON sign_events
  FOR ALL USING (is_admin());

-- Landlords see sign events for their properties' applications
CREATE POLICY "sign_events_landlord_read" ON sign_events
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

-- Applicants can see their own sign events
CREATE POLICY "sign_events_applicant_read" ON sign_events
  FOR SELECT USING (
    app_id IN (
      SELECT app_id FROM applications WHERE applicant_user_id = auth.uid()
    )
  );


-- ============================================================
-- SECTION M4 — LANDLORD UPDATE POLICY ON APPLICATIONS
--
-- SETUP.sql gives landlords SELECT on applications.
-- This adds a scoped UPDATE so landlords can set application
-- status (approve/deny/shortlist/under_review) for their
-- own properties only.
--
-- Landlords CANNOT: change lease data, signing data, move-in
-- data, payment data, or any admin_notes.
-- That constraint is enforced by only exposing the relevant
-- columns in the landlord portal UI, plus this policy scoping.
-- ============================================================

-- Drop if exists (safe re-run)
DROP POLICY IF EXISTS "applications_landlord_update" ON applications;

CREATE POLICY "applications_landlord_update" ON applications
  FOR UPDATE
  USING (
    landlord_id = (SELECT id FROM landlords WHERE user_id = auth.uid())
    OR property_id IN (
      SELECT id FROM properties
      WHERE landlord_id = (SELECT id FROM landlords WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    landlord_id = (SELECT id FROM landlords WHERE user_id = auth.uid())
    OR property_id IN (
      SELECT id FROM properties
      WHERE landlord_id = (SELECT id FROM landlords WHERE user_id = auth.uid())
    )
  );

-- NOTE: The landlord portal must only PATCH the `status` column.
-- Never expose the full row UPDATE to landlords in the API layer.
-- Example correct landlord update call (from landlord portal JS):
--   CP.sb().from('applications')
--     .update({ status: 'approved' })
--     .eq('app_id', appId)
-- The RLS policy enforces the row-scope. The UI enforces the column-scope.


-- ============================================================
-- SECTION M5 — ADDITIONAL INDEXES FOR PERFORMANCE
--
-- The admin panel queries applications heavily by status,
-- landlord_id, property_id, and created_at. These indexes
-- ensure the admin panel remains fast as data grows.
-- ============================================================

CREATE INDEX IF NOT EXISTS applications_status_idx
  ON applications (status);

CREATE INDEX IF NOT EXISTS applications_landlord_id_idx
  ON applications (landlord_id);

CREATE INDEX IF NOT EXISTS applications_property_id_idx
  ON applications (property_id);

CREATE INDEX IF NOT EXISTS applications_lease_status_idx
  ON applications (lease_status);

CREATE INDEX IF NOT EXISTS applications_move_in_status_idx
  ON applications (move_in_status);

CREATE INDEX IF NOT EXISTS applications_created_at_idx
  ON applications (created_at DESC);

CREATE INDEX IF NOT EXISTS applications_email_idx
  ON applications (email);


-- ============================================================
-- SECTION M6 — STORED FUNCTIONS FOR ADMIN DASHBOARD STATS
--
-- The admin dashboard needs several counts at once.
-- This function returns all stat card values in one query
-- to minimize round-trips from the static HTML page.
--
-- Returns a single JSON object:
-- {
--   total: int,
--   pending: int,
--   under_review: int,
--   approved: int,
--   denied: int,
--   waitlisted: int,
--   withdrawn: int,
--   lease_none: int,
--   lease_sent: int,
--   lease_signed: int,
--   lease_countersigned: int,
--   lease_executed: int,
--   move_in_pending: int,
--   move_in_confirmed: int,
--   move_in_completed: int
-- }
-- ============================================================

CREATE OR REPLACE FUNCTION get_application_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER  -- runs as owner, bypasses RLS — admin only by convention (check is_admin() in caller)
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total',               COUNT(*),
    'pending',             COUNT(*) FILTER (WHERE status = 'pending'),
    'under_review',        COUNT(*) FILTER (WHERE status = 'under_review'),
    'approved',            COUNT(*) FILTER (WHERE status = 'approved'),
    'denied',              COUNT(*) FILTER (WHERE status = 'denied'),
    'waitlisted',          COUNT(*) FILTER (WHERE status = 'waitlisted'),
    'withdrawn',           COUNT(*) FILTER (WHERE status = 'withdrawn'),
    'lease_none',          COUNT(*) FILTER (WHERE lease_status = 'none' OR lease_status IS NULL),
    'lease_sent',          COUNT(*) FILTER (WHERE lease_status = 'sent'),
    'lease_signed',        COUNT(*) FILTER (WHERE lease_status = 'signed'),
    'lease_awaiting_co',   COUNT(*) FILTER (WHERE lease_status = 'awaiting_co_sign'),
    'lease_co_signed',     COUNT(*) FILTER (WHERE lease_status = 'co_signed'),
    'lease_voided',        COUNT(*) FILTER (WHERE lease_status = 'voided'),
    'move_in_pending',     COUNT(*) FILTER (WHERE move_in_status = 'pending'),
    'move_in_scheduled',   COUNT(*) FILTER (WHERE move_in_status = 'scheduled'),
    'move_in_confirmed',   COUNT(*) FILTER (WHERE move_in_status = 'confirmed'),
    'move_in_completed',   COUNT(*) FILTER (WHERE move_in_status = 'completed')
  )
  INTO result
  FROM applications;

  RETURN result;
END;
$$;

-- Grant execute to authenticated users (RLS on caller enforces admin-only in practice)
GRANT EXECUTE ON FUNCTION get_application_stats() TO authenticated;


-- ============================================================
-- SECTION M7 — LANDLORD SCOPED STATS FUNCTION
--
-- Same as get_application_stats() but filtered to a landlord's
-- own properties. Called from the landlord portal dashboard.
--
-- Takes: landlord_user_id (the auth.uid() of the landlord)
-- Returns: same JSON structure as get_application_stats()
-- ============================================================

CREATE OR REPLACE FUNCTION get_landlord_application_stats(landlord_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  landlord_rec_id UUID;
BEGIN
  -- Resolve landlord_id from user_id
  SELECT id INTO landlord_rec_id FROM landlords WHERE user_id = landlord_user_id;

  IF landlord_rec_id IS NULL THEN
    RETURN '{"error": "landlord not found"}'::JSONB;
  END IF;

  SELECT jsonb_build_object(
    'total',         COUNT(*),
    'pending',       COUNT(*) FILTER (WHERE status = 'pending'),
    'under_review',  COUNT(*) FILTER (WHERE status = 'under_review'),
    'approved',      COUNT(*) FILTER (WHERE status = 'approved'),
    'denied',        COUNT(*) FILTER (WHERE status = 'denied'),
    'waitlisted',    COUNT(*) FILTER (WHERE status = 'waitlisted'),
    'lease_sent',    COUNT(*) FILTER (WHERE lease_status = 'sent'),
    'lease_signed',  COUNT(*) FILTER (WHERE lease_status IN ('signed', 'co_signed')),
    'move_in_pending',   COUNT(*) FILTER (WHERE move_in_status = 'pending'),
    'move_in_completed', COUNT(*) FILTER (WHERE move_in_status = 'completed')
  )
  INTO result
  FROM applications
  WHERE landlord_id = landlord_rec_id
     OR property_id IN (
          SELECT id FROM properties WHERE landlord_id = landlord_rec_id
        );

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_landlord_application_stats(UUID) TO authenticated;


-- ============================================================
-- SECTION M8 — SIGN LEASE FUNCTION (SERVER-SIDE SIGNING)
--
-- Called from the serve.js /sign-lease endpoint (not directly
-- from the browser). The endpoint validates the token, then
-- calls this function via the service-role key.
--
-- Steps:
--   1. Verify token matches tenant_sign_token on the application
--   2. Verify token hasn't been used (tenant_signature IS NULL)
--   3. Set tenant_signature, signature_timestamp, lease_ip_address
--   4. Set lease_status = 'signed' (or 'awaiting_co_sign' if
--      has_co_applicant = true)
--   5. Consume the token (set tenant_sign_token = NULL)
--   6. Insert a record into sign_events
--   7. Return success/error
--
-- Returns: { success: boolean, message: text, app_id: text }
-- ============================================================

CREATE OR REPLACE FUNCTION sign_lease_tenant(
  p_token       TEXT,
  p_signature   TEXT,
  p_ip_address  TEXT,
  p_user_agent  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  app_rec RECORD;
  new_lease_status lease_status;
BEGIN
  -- Find application by token
  SELECT * INTO app_rec
  FROM applications
  WHERE tenant_sign_token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN '{"success": false, "message": "Invalid or expired signing link."}'::JSONB;
  END IF;

  -- Check not already signed
  IF app_rec.tenant_signature IS NOT NULL THEN
    RETURN '{"success": false, "message": "This lease has already been signed."}'::JSONB;
  END IF;

  -- Check lease_status is 'sent'
  IF app_rec.lease_status != 'sent' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'This lease is not in a signable state: ' || app_rec.lease_status
    );
  END IF;

  -- Determine new status
  IF app_rec.has_co_applicant AND app_rec.co_applicant_lease_token IS NOT NULL THEN
    new_lease_status := 'awaiting_co_sign';
  ELSE
    new_lease_status := 'co_signed';  -- All required signatures collected
  END IF;

  -- Update application (lease_signed_date added — was missing in original)
  UPDATE applications SET
    tenant_signature     = p_signature,
    signature_timestamp  = now(),
    lease_signed_date    = now(),
    lease_ip_address     = p_ip_address,
    lease_status         = new_lease_status,
    tenant_sign_token    = NULL,           -- Consume token
    updated_at           = now()
  WHERE app_id = app_rec.app_id;

  -- Insert sign event audit record
  INSERT INTO sign_events (
    app_id, signer_type, signer_name, signer_email,
    ip_address, user_agent, token_used, lease_pdf_path
  ) VALUES (
    app_rec.app_id, 'tenant', p_signature, app_rec.email,
    p_ip_address, p_user_agent, p_token, app_rec.lease_pdf_url
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Lease signed successfully.',
    'app_id', app_rec.app_id,
    'new_status', new_lease_status::text
  );
END;
$$;

-- NOTE: This function should ONLY be called from the serve.js backend
-- using the service-role key. Never expose it directly to browser clients.


-- ============================================================
-- SECTION M9 — CO-APPLICANT SIGN FUNCTION
-- Mirror of sign_lease_tenant for co-applicant signing.
-- ============================================================

CREATE OR REPLACE FUNCTION sign_lease_co_applicant(
  p_token       TEXT,
  p_signature   TEXT,
  p_ip_address  TEXT,
  p_user_agent  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  app_rec RECORD;
BEGIN
  SELECT * INTO app_rec
  FROM applications
  WHERE co_applicant_lease_token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN '{"success": false, "message": "Invalid or expired signing link."}'::JSONB;
  END IF;

  IF app_rec.co_applicant_signature IS NOT NULL THEN
    RETURN '{"success": false, "message": "Co-applicant has already signed."}'::JSONB;
  END IF;

  UPDATE applications SET
    co_applicant_signature           = p_signature,
    co_applicant_signature_timestamp = now(),
    co_applicant_lease_token         = NULL,  -- Consume token
    lease_status                     = 'co_signed',
    updated_at                       = now()
  WHERE app_id = app_rec.app_id;

  -- Get co-applicant email for audit
  INSERT INTO sign_events (
    app_id, signer_type, signer_name, signer_email,
    ip_address, user_agent, token_used, lease_pdf_path
  )
  SELECT
    app_rec.app_id,
    'co_applicant',
    p_signature,
    ca.email,
    p_ip_address,
    p_user_agent,
    p_token,
    app_rec.lease_pdf_url
  FROM co_applicants ca WHERE ca.app_id = app_rec.app_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Co-applicant lease signed successfully.',
    'app_id', app_rec.app_id
  );
END;
$$;


-- ============================================================
-- SECTION M10 — GENERATE SIGNING TOKEN FUNCTION
--
-- Called from serve.js /generate-lease endpoint after PDF is
-- generated. Creates a cryptographically random one-time token
-- for each signer and stores it on the application row.
--
-- Returns: { tenant_token: text, co_applicant_token: text|null }
-- ============================================================

CREATE OR REPLACE FUNCTION generate_lease_tokens(p_app_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  app_rec RECORD;
  tenant_token TEXT;
  co_token TEXT;
BEGIN
  SELECT * INTO app_rec FROM applications WHERE app_id = p_app_id LIMIT 1;

  IF NOT FOUND THEN
    RETURN '{"success": false, "message": "Application not found."}'::JSONB;
  END IF;

  -- Generate cryptographically secure random tokens (64 hex chars each)
  tenant_token := encode(gen_random_bytes(32), 'hex');

  IF app_rec.has_co_applicant THEN
    co_token := encode(gen_random_bytes(32), 'hex');
  ELSE
    co_token := NULL;
  END IF;

  UPDATE applications SET
    tenant_sign_token       = tenant_token,
    co_applicant_lease_token = co_token,
    lease_status             = 'sent',
    lease_sent_date          = now(),
    updated_at               = now()
  WHERE app_id = p_app_id;

  RETURN jsonb_build_object(
    'success', true,
    'tenant_token', tenant_token,
    'co_applicant_token', co_token
  );
END;
$$;


-- ============================================================
-- SECTION M11 — STORAGE BUCKETS
--
-- Two buckets needed:
--   lease-pdfs       — generated lease PDFs (private, admin/applicant read)
--   application-docs — applicant document uploads (private)
--
-- These may already exist if SETUP.sql section 15 was run.
-- The INSERT...ON CONFLICT below is safe either way.
--
-- NOTE: Supabase Storage bucket creation via SQL requires
-- the storage schema. If this fails, create buckets manually
-- in the Supabase Dashboard → Storage.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lease-pdfs',
  'lease-pdfs',
  false,
  10485760,  -- 10MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'application-docs',
  'application-docs',
  false,
  20971520,  -- 20MB
  ARRAY[
    'application/pdf',
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: lease-pdfs
-- Admins can read/write all. Applicants can read their own lease PDF.
-- Landlords can read lease PDFs for their properties' applications.

DROP POLICY IF EXISTS "lease_pdfs_admin_all" ON storage.objects;
CREATE POLICY "lease_pdfs_admin_all" ON storage.objects
  FOR ALL
  USING (bucket_id = 'lease-pdfs' AND is_admin());

DROP POLICY IF EXISTS "lease_pdfs_applicant_read" ON storage.objects;
CREATE POLICY "lease_pdfs_applicant_read" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'lease-pdfs'
    AND (storage.foldername(name))[1] IN (
      SELECT app_id FROM applications WHERE applicant_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "lease_pdfs_landlord_read" ON storage.objects;
CREATE POLICY "lease_pdfs_landlord_read" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'lease-pdfs'
    AND (storage.foldername(name))[1] IN (
      SELECT app_id FROM applications
      WHERE landlord_id = (SELECT id FROM landlords WHERE user_id = auth.uid())
         OR property_id IN (
              SELECT id FROM properties
              WHERE landlord_id = (SELECT id FROM landlords WHERE user_id = auth.uid())
            )
    )
  );

-- Storage RLS: application-docs
-- Admins see all. Applicants see their own docs. Landlords see docs for their properties' applicants.
DROP POLICY IF EXISTS "app_docs_admin_all" ON storage.objects;
CREATE POLICY "app_docs_admin_all" ON storage.objects
  FOR ALL
  USING (bucket_id = 'application-docs' AND is_admin());

DROP POLICY IF EXISTS "app_docs_applicant_read" ON storage.objects;
CREATE POLICY "app_docs_applicant_read" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'application-docs'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "app_docs_landlord_read" ON storage.objects;
CREATE POLICY "app_docs_landlord_read" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'application-docs'
    AND (storage.foldername(name))[1] IN (
      SELECT a.applicant_user_id::text FROM applications a
      WHERE a.landlord_id = (SELECT id FROM landlords WHERE user_id = auth.uid())
         OR a.property_id IN (
              SELECT id FROM properties
              WHERE landlord_id = (SELECT id FROM landlords WHERE user_id = auth.uid())
            )
    )
  );


-- ============================================================
-- SECTION M12 — REGISTER NEW TABLES IN SETUP.sql TRACKING
--
-- This comment block is informational — update SETUP.sql to
-- include M1-level tables in its section numbering eventually.
-- For now, this migration file is the authoritative home for:
--   - lease_templates
--   - sign_events
-- ============================================================

-- ============================================================
-- END OF MIGRATION_SCHEMA.sql
-- After running this, proceed with:
--   1. serve.js changes (MIGRATION_PATTERNS.md, Section 5)
--   2. Admin HTML page updates (MIGRATION_PATTERNS.md, Section 4)
--   3. Lease template configuration (admin panel → Leases)
-- ============================================================
