-- Migration: Add tenant + landlord RLS SELECT/UPDATE policies to applications
  -- Applied live: 2026-04-20  (schema was missing these; only "Admins full access" existed)
  --
  -- Tenants can read their own applications via user_id OR email match
  CREATE POLICY IF NOT EXISTS "applications_tenant_select" ON applications
    FOR SELECT
    TO authenticated
    USING (
      applicant_user_id = auth.uid()
      OR lower(email) = lower(auth.email())
    );

  -- Tenants can update (e.g. withdraw) only their own claimed applications
  CREATE POLICY IF NOT EXISTS "applications_tenant_update" ON applications
    FOR UPDATE
    TO authenticated
    USING (applicant_user_id = auth.uid())
    WITH CHECK (applicant_user_id = auth.uid());

  -- Landlords can read applications tied to their property listings
  CREATE POLICY IF NOT EXISTS "applications_landlord_select" ON applications
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM landlords l
        WHERE l.user_id = auth.uid()
          AND l.id = applications.landlord_id
      )
    );
  