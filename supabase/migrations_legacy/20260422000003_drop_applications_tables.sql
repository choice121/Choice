-- ============================================================
-- MIGRATION: Drop legacy applications/co_applicants tables and helpers
-- Date: 2026-04-22
-- Decision: All rental applications are processed exclusively through
--           the external GAS pipeline at apply-choice-properties.pages.dev.
--           The Supabase `applications` table is no longer authoritative
--           and is safe to remove.
--
-- This migration is the numbered/promoted version of the standalone
-- MIGRATION_drop_applications_tables.sql script. Once applied, that
-- root-level script can be deleted.
--
-- BEFORE RUNNING (one-time, in Supabase SQL editor):
--   1. Verify the row count is zero or pre-export anything you keep:
--        SELECT COUNT(*) FROM applications;
--   2. Confirm decommissioned edge functions are removed from the
--      Supabase Dashboard. The active set is:
--        send-inquiry, send-message, imagekit-upload, imagekit-delete,
--        send-email, send-magic-link, generate-lease, get-lease,
--        download-lease, sign-lease, countersign, save-draft,
--        receive-application, request-upload-url
-- ============================================================

BEGIN;

-- 1. Drop application-specific stored functions
DROP FUNCTION IF EXISTS get_application_status(TEXT, TEXT)         CASCADE;
DROP FUNCTION IF EXISTS get_lease_financials(TEXT, TEXT)            CASCADE;
DROP FUNCTION IF EXISTS sign_lease(TEXT, TEXT, TEXT)                CASCADE;
DROP FUNCTION IF EXISTS sign_lease_co_applicant(TEXT, TEXT, TEXT)   CASCADE;
DROP FUNCTION IF EXISTS submit_tenant_reply(TEXT, TEXT, TEXT)       CASCADE;
DROP FUNCTION IF EXISTS get_my_applications()                       CASCADE;
DROP FUNCTION IF EXISTS claim_application(TEXT, TEXT)               CASCADE;
DROP FUNCTION IF EXISTS get_apps_by_email(TEXT)                     CASCADE;
DROP FUNCTION IF EXISTS get_app_id_by_email(TEXT)                   CASCADE;
DROP FUNCTION IF EXISTS mark_expired_leases()                       CASCADE;
DROP FUNCTION IF EXISTS generate_app_id()                           CASCADE;
DROP FUNCTION IF EXISTS trg_applications_count()                    CASCADE;

-- 2. Drop the admin view (depends on applications table)
DROP VIEW IF EXISTS admin_application_view CASCADE;

-- 3. Drop co_applicants (FK to applications)
DROP TABLE IF EXISTS co_applicants CASCADE;

-- 4. Drop the applications table.
--    CASCADE removes any FK-referencing rows in messages (tenant reply
--    threads). If you still use messages for non-application landlord
--    messaging, first run:
--      ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_app_id_fkey;
--    then replace CASCADE with a plain DROP.
DROP TABLE IF EXISTS applications CASCADE;

-- 5. Verification (commented out — uncomment if you want loud output)
-- DO $$
-- DECLARE
--   tbl_count INT;
--   fn_count  INT;
-- BEGIN
--   SELECT COUNT(*) INTO tbl_count
--     FROM information_schema.tables
--    WHERE table_schema = 'public'
--      AND table_name IN ('applications','co_applicants');
--   SELECT COUNT(*) INTO fn_count
--     FROM information_schema.routines
--    WHERE routine_schema = 'public'
--      AND routine_name IN (
--        'get_application_status','get_lease_financials','sign_lease',
--        'sign_lease_co_applicant','submit_tenant_reply','get_my_applications',
--        'claim_application','get_apps_by_email','get_app_id_by_email',
--        'mark_expired_leases','generate_app_id','trg_applications_count');
--   RAISE NOTICE 'Remaining tables: %, remaining functions: %', tbl_count, fn_count;
-- END $$;

COMMIT;
