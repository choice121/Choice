-- Phase 14 — Supabase database advisor remediations.
--
-- Addresses:
--   • 4  security_definer_view             (flip to security_invoker=true)
--   • 11 function_search_path_mutable      (set search_path = public, pg_temp)
--   • 5  rls_enabled_no_policy             (add explicit deny-all baseline)
--   • Reduce anon attack surface on SECURITY DEFINER admin / trigger fns
--
-- NOT addressed in this migration (intentional trade-offs):
--   • public_bucket_allows_listing on profile-photos / property-photos —
--     these MUST stay public=true so unauthenticated visitors can see
--     property images on the marketplace listings. Lowering to private
--     would break the public site.
--   • Auth-side warnings (auth_otp_long_expiry, leaked password
--     protection) are flipped via the Supabase Auth admin API at deploy
--     time, not via SQL migrations.

-- =====================================================================
-- 1. SECURITY DEFINER views → security_invoker = true
-- =====================================================================
-- Without security_invoker, these views run as the view owner (postgres)
-- and bypass RLS on the underlying tables. With security_invoker=true,
-- the view runs as the calling user and respects RLS, so PostgREST
-- exposure of these views can no longer leak data across tenants.

alter view public.lease_money_summary       set (security_invoker = true);
alter view public.landlords_public          set (security_invoker = true);
alter view public.lease_renewals_due        set (security_invoker = true);
alter view public.lease_signing_tokens_admin set (security_invoker = true);

-- =====================================================================
-- 2. function_search_path_mutable — pin search_path on every function
-- =====================================================================
-- Without an explicit search_path, a malicious user with CREATE on a
-- writeable schema could inject objects (table, function, type) that
-- the function resolves before public.*. Pinning prevents that.

alter function public.property_photos_set_updated_at()
  set search_path = public, pg_temp;

alter function public.leases_set_updated_at()
  set search_path = public, pg_temp;

alter function public._leases_set_updated_at()
  set search_path = public, pg_temp;

alter function public.update_lease_template_updated_at()
  set search_path = public, pg_temp;

alter function public.lease_addenda_library_touch_updated_at()
  set search_path = public, pg_temp;

alter function public.purge_old_logs()
  set search_path = public, pg_temp;

alter function public.lease_inspections_touch_updated_at()
  set search_path = public, pg_temp;

alter function public.lease_inspections_recount_photos()
  set search_path = public, pg_temp;

alter function public.lease_deposit_accountings_touch_updated_at()
  set search_path = public, pg_temp;

alter function public.lease_deposit_deductions_touch_updated_at()
  set search_path = public, pg_temp;

alter function public.validate_lease_financials(
  p_state_code text,
  p_monthly_rent numeric,
  p_security_deposit numeric,
  p_pet_deposit numeric,
  p_last_month_rent numeric,
  p_cleaning_fee numeric,
  p_cleaning_refundable boolean
) set search_path = public, pg_temp;

-- =====================================================================
-- 3. rls_enabled_no_policy — add deny-all baseline
-- =====================================================================
-- These tables already had RLS enabled but no policy, which means anon
-- and authenticated already cannot read them. The linter still warns
-- because it cannot prove that's intentional. Adding an explicit
-- deny-all policy makes the intent visible and silences the warning.
-- service_role bypasses RLS via BYPASSRLS, so backend access is
-- unchanged.

do $$
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname='public' and c.relname='_migration_history') then
    if not exists (select 1 from pg_policy where polname='_migration_history_deny_all'
                   and polrelid = 'public._migration_history'::regclass) then
      execute 'create policy _migration_history_deny_all on public._migration_history for all to anon, authenticated using (false) with check (false)';
    end if;
  end if;

  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname='public' and c.relname='draft_applications') then
    if not exists (select 1 from pg_policy where polname='draft_applications_deny_all'
                   and polrelid = 'public.draft_applications'::regclass) then
      -- draft_applications is written and read exclusively by the
      -- save-draft / receive-application edge functions using the
      -- service-role key. No client-side direct access is needed.
      execute 'create policy draft_applications_deny_all on public.draft_applications for all to anon, authenticated using (false) with check (false)';
    end if;
  end if;
end$$;

-- pipeline.* tables — internal scraper data, never read from the client.
do $$
begin
  if to_regnamespace('pipeline') is not null then
    if exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
               where n.nspname='pipeline' and c.relname='pipeline_properties') then
      if not exists (select 1 from pg_policy where polname='pipeline_properties_deny_all'
                     and polrelid = 'pipeline.pipeline_properties'::regclass) then
        execute 'create policy pipeline_properties_deny_all on pipeline.pipeline_properties for all to anon, authenticated using (false) with check (false)';
      end if;
    end if;
    if exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
               where n.nspname='pipeline' and c.relname='pipeline_enrichment_log') then
      if not exists (select 1 from pg_policy where polname='pipeline_enrichment_log_deny_all'
                     and polrelid = 'pipeline.pipeline_enrichment_log'::regclass) then
        execute 'create policy pipeline_enrichment_log_deny_all on pipeline.pipeline_enrichment_log for all to anon, authenticated using (false) with check (false)';
      end if;
    end if;
    if exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
               where n.nspname='pipeline' and c.relname='pipeline_scrape_runs') then
      if not exists (select 1 from pg_policy where polname='pipeline_scrape_runs_deny_all'
                     and polrelid = 'pipeline.pipeline_scrape_runs'::regclass) then
        execute 'create policy pipeline_scrape_runs_deny_all on pipeline.pipeline_scrape_runs for all to anon, authenticated using (false) with check (false)';
      end if;
    end if;
  end if;
end$$;

-- =====================================================================
-- 4. Reduce anon attack surface on SECURITY DEFINER functions
-- =====================================================================
-- Two groups:
--   (a) Trigger-only functions — invoked only by the row trigger that
--       owns them; never by PostgREST. Safe to revoke from public roles.
--   (b) Admin / service-role-only functions — invoked only from edge
--       functions using the service-role key, or via authenticated admin
--       sessions. Should not be callable by anon.
--
-- We deliberately leave EXECUTE for anon on legitimately public RPCs
-- (sign_lease, sign_lease_co_applicant, sign_lease_amendment,
-- claim_application, lookup_lease_by_qr_token, get_apps_by_email,
-- report_client_error, increment_counter, current_confirmed_email,
-- is_admin) so the public site keeps working.

-- (a) Trigger-only functions
revoke execute on function public.property_photos_set_updated_at()         from public, anon, authenticated;
revoke execute on function public.leases_set_updated_at()                  from public, anon, authenticated;
revoke execute on function public._leases_set_updated_at()                 from public, anon, authenticated;
revoke execute on function public.update_lease_template_updated_at()       from public, anon, authenticated;
revoke execute on function public.lease_addenda_library_touch_updated_at() from public, anon, authenticated;
revoke execute on function public.lease_inspections_touch_updated_at()     from public, anon, authenticated;
revoke execute on function public.lease_inspections_recount_photos()       from public, anon, authenticated;
revoke execute on function public.lease_deposit_accountings_touch_updated_at() from public, anon, authenticated;
revoke execute on function public.lease_deposit_deductions_touch_updated_at() from public, anon, authenticated;

-- lease_template_partials_touch_updated_at and state_lease_law_touch_updated_at
-- if they exist (created by later migrations)
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('lease_template_partials_touch_updated_at','state_lease_law_touch_updated_at')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end$$;

-- (b) Admin / service-role-only functions
revoke execute on function public.purge_old_logs()                         from public, anon, authenticated;
revoke execute on function public.admin_list_landlords(integer, integer)   from public, anon;
revoke execute on function public.dashboard_pulse()                        from public, anon;
revoke execute on function public.publish_lease_template(uuid, text)       from public, anon, authenticated;
revoke execute on function public.snapshot_lease_template_for_app(uuid, text) from public, anon, authenticated;
revoke execute on function public.generate_lease_tokens(uuid)              from public, anon;
revoke execute on function public.record_lease_pdf_integrity(uuid, text, text, integer, jsonb, text, integer)
                                                                            from public, anon;
revoke execute on function public.record_lease_pdf_version(uuid, text, text, integer, jsonb, text, integer, text, text)
                                                                            from public, anon;

-- validate_lease_financials is a pure helper used by triggers / admin UI —
-- not needed by anon.
revoke execute on function public.validate_lease_financials(text, numeric, numeric, numeric, numeric, numeric, boolean)
                                                                            from public, anon;
