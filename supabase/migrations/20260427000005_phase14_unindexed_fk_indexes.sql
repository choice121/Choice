-- 20260427000005_phase14_unindexed_fk_indexes.sql
-- Phase 14: add btree indexes covering 7 foreign-key columns flagged by the
-- Supabase performance advisor (`unindexed_foreign_keys`). Without these,
-- every JOIN through the FK and every CASCADE on parent delete sequentially
-- scans the child table.
--
-- Tables touched: applications (3), lease_pdf_versions (2), saved_properties (2).
-- Each statement is idempotent (IF NOT EXISTS) so re-applying is a no-op.
-- Regular CREATE INDEX (not CONCURRENTLY) is fine here — these tables are
-- small at the current scale and the migration runs in a transaction.

CREATE INDEX IF NOT EXISTS idx_applications_applicant_user_id
  ON public.applications (applicant_user_id);

CREATE INDEX IF NOT EXISTS idx_applications_landlord_id
  ON public.applications (landlord_id);

CREATE INDEX IF NOT EXISTS idx_applications_property_id
  ON public.applications (property_id);

CREATE INDEX IF NOT EXISTS idx_lease_pdf_versions_amendment_id
  ON public.lease_pdf_versions (amendment_id);

CREATE INDEX IF NOT EXISTS idx_lease_pdf_versions_template_version_id
  ON public.lease_pdf_versions (template_version_id);

CREATE INDEX IF NOT EXISTS idx_saved_properties_property_id
  ON public.saved_properties (property_id);

CREATE INDEX IF NOT EXISTS idx_saved_properties_user_id
  ON public.saved_properties (user_id);
