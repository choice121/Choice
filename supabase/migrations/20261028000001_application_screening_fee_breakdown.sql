ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS application_fee_per_adult numeric,
  ADD COLUMN IF NOT EXISTS screened_adult_count smallint,
  ADD COLUMN IF NOT EXISTS co_applicant_role text,
  ADD COLUMN IF NOT EXISTS co_applicant_consent boolean,
  ADD COLUMN IF NOT EXISTS co_applicant_consent_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS co_applicant_consent_version text,
  ADD COLUMN IF NOT EXISTS co_applicant_employer text,
  ADD COLUMN IF NOT EXISTS co_applicant_job_title text,
  ADD COLUMN IF NOT EXISTS co_applicant_monthly_income numeric,
  ADD COLUMN IF NOT EXISTS co_applicant_employment_duration text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'applications_screened_adult_count_positive'
      AND conrelid = 'public.applications'::regclass
  ) THEN
    ALTER TABLE public.applications
      ADD CONSTRAINT applications_screened_adult_count_positive
      CHECK (screened_adult_count IS NULL OR screened_adult_count >= 1);
  END IF;
END
$$;
