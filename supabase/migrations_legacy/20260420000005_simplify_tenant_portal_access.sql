CREATE TABLE IF NOT EXISTS co_applicants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id TEXT NOT NULL REFERENCES applications(app_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  dob TEXT,
  ssn TEXT,
  role TEXT,
  employer TEXT,
  job_title TEXT,
  monthly_income TEXT,
  employment_duration TEXT,
  employment_status TEXT,
  consent BOOLEAN DEFAULT false,
  CONSTRAINT co_applicants_app_id_unique UNIQUE (app_id)
);

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS additional_person_role TEXT,
  ADD COLUMN IF NOT EXISTS co_applicant_first_name TEXT,
  ADD COLUMN IF NOT EXISTS co_applicant_last_name TEXT,
  ADD COLUMN IF NOT EXISTS co_applicant_email TEXT,
  ADD COLUMN IF NOT EXISTS co_applicant_phone TEXT,
  ADD COLUMN IF NOT EXISTS co_applicant_dob TEXT,
  ADD COLUMN IF NOT EXISTS co_applicant_ssn TEXT,
  ADD COLUMN IF NOT EXISTS co_applicant_employer TEXT,
  ADD COLUMN IF NOT EXISTS co_applicant_job_title TEXT,
  ADD COLUMN IF NOT EXISTS co_applicant_monthly_income TEXT,
  ADD COLUMN IF NOT EXISTS co_applicant_employment_duration TEXT,
  ADD COLUMN IF NOT EXISTS co_applicant_employment_status TEXT,
  ADD COLUMN IF NOT EXISTS co_applicant_consent BOOLEAN DEFAULT false;

INSERT INTO co_applicants (app_id, first_name, last_name, email, phone)
SELECT app_id, co_applicant_first_name, co_applicant_last_name, co_applicant_email, co_applicant_phone
FROM applications
WHERE co_applicant_email IS NOT NULL
ON CONFLICT (app_id) DO UPDATE SET
  first_name = COALESCE(EXCLUDED.first_name, co_applicants.first_name),
  last_name = COALESCE(EXCLUDED.last_name, co_applicants.last_name),
  email = COALESCE(EXCLUDED.email, co_applicants.email),
  phone = COALESCE(EXCLUDED.phone, co_applicants.phone);

ALTER TABLE co_applicants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "applications_tenant_select" ON applications;
CREATE POLICY "applications_tenant_select" ON applications
  FOR SELECT
  TO authenticated
  USING (
    applicant_user_id = auth.uid()
    OR lower(email) = lower(auth.email())
    OR lower(co_applicant_email) = lower(auth.email())
    OR EXISTS (
      SELECT 1 FROM co_applicants c
      WHERE c.app_id = applications.app_id
        AND lower(c.email) = lower(auth.email())
    )
  );

DROP POLICY IF EXISTS "applications_tenant_update" ON applications;
CREATE POLICY "applications_tenant_update" ON applications
  FOR UPDATE
  TO authenticated
  USING (
    applicant_user_id = auth.uid()
    OR lower(email) = lower(auth.email())
  )
  WITH CHECK (
    applicant_user_id = auth.uid()
    OR lower(email) = lower(auth.email())
  );

DROP POLICY IF EXISTS "co_applicants_applicant_read" ON co_applicants;
CREATE POLICY "co_applicants_applicant_read" ON co_applicants
  FOR SELECT
  TO authenticated
  USING (
    lower(email) = lower(auth.email())
    OR EXISTS (
      SELECT 1 FROM applications a
      WHERE a.app_id = co_applicants.app_id
        AND (
          a.applicant_user_id = auth.uid()
          OR lower(a.email) = lower(auth.email())
          OR lower(a.co_applicant_email) = lower(auth.email())
        )
    )
  );

CREATE OR REPLACE FUNCTION get_my_applications()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_auth_email TEXT := auth.email();
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  RETURN json_build_object(
    'success', true,
    'applications', (
      SELECT COALESCE(
        json_agg(json_build_object(
          'app_id',           a.app_id,
          'status',           a.status,
          'payment_status',   a.payment_status,
          'lease_status',     a.lease_status,
          'property_address', a.property_address,
          'created_at',       a.created_at,
          'first_name',       a.first_name,
          'last_name',        a.last_name,
          'monthly_rent',     a.monthly_rent,
          'lease_start_date', a.lease_start_date,
          'move_in_status',   a.move_in_status,
          'application_fee',  a.application_fee,
          'email',            a.email,
          'access_role',      CASE
            WHEN a.applicant_user_id = v_uid OR lower(a.email) = lower(v_auth_email) THEN 'primary'
            ELSE 'co_applicant'
          END
        ) ORDER BY a.created_at DESC),
        '[]'::json
      )
      FROM applications a
      WHERE a.applicant_user_id = v_uid
         OR lower(a.email) = lower(v_auth_email)
         OR lower(a.co_applicant_email) = lower(v_auth_email)
         OR EXISTS (
           SELECT 1 FROM co_applicants c
           WHERE c.app_id = a.app_id
             AND lower(c.email) = lower(v_auth_email)
         )
    )
  );
END;
$$;
GRANT EXECUTE ON FUNCTION get_my_applications() TO authenticated;

CREATE OR REPLACE FUNCTION claim_application(p_app_id TEXT, p_email TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_auth_email TEXT := auth.email();
  v_app applications%ROWTYPE;
  v_is_primary BOOLEAN := false;
  v_is_co_applicant BOOLEAN := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF v_auth_email IS NULL OR lower(v_auth_email) <> lower(COALESCE(p_email, '')) THEN
    RETURN json_build_object('success', false, 'error', 'Email does not match signed-in account');
  END IF;

  SELECT * INTO v_app FROM applications WHERE app_id = p_app_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Application not found');
  END IF;

  v_is_primary := lower(COALESCE(v_app.email, '')) = lower(v_auth_email);
  v_is_co_applicant := lower(COALESCE(v_app.co_applicant_email, '')) = lower(v_auth_email)
    OR EXISTS (
      SELECT 1 FROM co_applicants c
      WHERE c.app_id = p_app_id
        AND lower(c.email) = lower(v_auth_email)
    );

  IF NOT v_is_primary AND NOT v_is_co_applicant THEN
    RETURN json_build_object('success', false, 'error', 'Email does not match application');
  END IF;

  IF v_is_co_applicant AND NOT v_is_primary THEN
    RETURN json_build_object('success', true, 'co_applicant', true);
  END IF;

  IF v_app.applicant_user_id IS NULL THEN
    UPDATE applications SET applicant_user_id = v_uid WHERE app_id = p_app_id;
    RETURN json_build_object('success', true, 'claimed', true);
  END IF;

  IF v_app.applicant_user_id = v_uid THEN
    RETURN json_build_object('success', true, 'already_claimed', true);
  END IF;

  RETURN json_build_object('success', true, 'primary_email_match', true, 'already_linked', true);
END;
$$;
GRANT EXECUTE ON FUNCTION claim_application(TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION get_apps_by_email(p_email TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_auth_email TEXT := auth.email();
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF v_auth_email IS NULL OR lower(v_auth_email) <> lower(COALESCE(p_email, '')) THEN
    RETURN json_build_object('success', false, 'error', 'Email does not match signed-in account');
  END IF;

  RETURN (
    SELECT COALESCE(json_agg(row_to_json(r) ORDER BY r.created_at DESC), '[]'::json)
    FROM (
      SELECT DISTINCT a.app_id,
             a.property_address,
             a.created_at::date AS created_at
      FROM applications a
      WHERE lower(a.email) = lower(v_auth_email)
         OR lower(a.co_applicant_email) = lower(v_auth_email)
         OR EXISTS (
           SELECT 1 FROM co_applicants c
           WHERE c.app_id = a.app_id
             AND lower(c.email) = lower(v_auth_email)
         )
    ) r
  );
END;
$$;
GRANT EXECUTE ON FUNCTION get_apps_by_email(TEXT) TO authenticated;