-- Fix: infinite recursion in RLS policies caused by circular cross-table EXISTS subqueries.
-- applications_tenant_select → checked co_applicants
-- co_applicants_applicant_read → checked applications back
-- This caused every authenticated SELECT on applications to fail with
-- "infinite recursion detected in policy for relation applications".
--
-- Fix: remove the cross-table EXISTS subqueries.
-- - applications_tenant_select: co_applicant_email column on applications already
--   covers co-applicant access without needing to JOIN co_applicants.
-- - co_applicants_applicant_read: only allow co-applicants to read their own row
--   by email; primary applicants access co-applicant data through SECURITY DEFINER
--   RPCs and service-role edge functions, which bypass RLS.

DROP POLICY IF EXISTS "applications_tenant_select" ON applications;
CREATE POLICY "applications_tenant_select" ON applications
  FOR SELECT
  TO authenticated
  USING (
    applicant_user_id = auth.uid()
    OR lower(email) = lower(auth.email())
    OR lower(co_applicant_email) = lower(auth.email())
  );

DROP POLICY IF EXISTS "co_applicants_applicant_read" ON co_applicants;
CREATE POLICY "co_applicants_applicant_read" ON co_applicants
  FOR SELECT
  TO authenticated
  USING (
    lower(email) = lower(auth.email())
  );
