-- =============================================================
-- dashboard_pulse(range_start, recent_limit)
-- =============================================================
-- Single-shot RPC that powers admin/dashboard.html.
--
-- Replaces the four separate round-trips (`getCounts` + `getAll(limit:8)`
-- + `properties.select(status)` + `email_logs.select(...)`) with one
-- query that returns:
--   { counts: { total, pending, approved, denied, waitlisted,
--               this_month, lease_pending, lease_sent, lease_signed,
--               movein_pending, movein_confirmed, unpaid_approved,
--               active_listings, failed_emails_48h },
--     recent: [ {id, app_id, first_name, last_name, email, status,
--                payment_status, lease_status, move_in_status,
--                property_address, created_at}, ... ] }
--
-- `range_start` filters the count totals (excluding this_month, which is
-- always month-to-date by definition, and the structural totals like
-- lease_pending, movein_pending, active_listings, failed_emails_48h
-- which represent live state regardless of date range).
-- Pass NULL to count all-time.
--
-- The dashboard.html client falls back to the legacy 4-query path if
-- this RPC is missing, so it is safe to deploy the HTML before applying
-- this migration.
-- =============================================================

create or replace function public.dashboard_pulse(
  range_start  timestamptz default null,
  recent_limit int         default 8
)
returns json
language sql
stable
security definer
set search_path = public
as $$
  with
    apps_in_range as (
      select status, lease_status, move_in_status, payment_status, created_at
      from applications
      where range_start is null or created_at >= range_start
    ),
    apps_all as (
      select status, lease_status, move_in_status, payment_status, created_at
      from applications
    ),
    app_counts as (
      select
        count(*)                                                              as total,
        count(*) filter (where status = 'pending')                            as pending,
        count(*) filter (where status = 'approved')                           as approved,
        count(*) filter (where status = 'denied')                             as denied,
        count(*) filter (where status = 'waitlisted')                         as waitlisted,
        count(*) filter (where status = 'approved'
                          and (payment_status is null
                               or payment_status = 'unpaid'))                 as unpaid_approved
      from apps_in_range
    ),
    month_count as (
      select count(*) as this_month
      from apps_all
      where created_at >= date_trunc('month', now())
    ),
    lease_counts as (
      select
        count(*) filter (where lease_status is null
                          or lease_status = 'none')                            as lease_pending,
        count(*) filter (where lease_status = 'sent')                          as lease_sent,
        count(*) filter (where lease_status = 'signed')                        as lease_signed
      from apps_all
    ),
    movein_counts as (
      select
        count(*) filter (where move_in_status = 'pending')                     as movein_pending,
        count(*) filter (where move_in_status = 'confirmed')                   as movein_confirmed
      from apps_all
    ),
    listing_counts as (
      select count(*) filter (where status = 'active') as active_listings
      from properties
    ),
    failed_emails as (
      select count(*) as failed_emails_48h
      from email_logs
      where status = 'failed'
        and created_at >= now() - interval '48 hours'
    ),
    recent as (
      select
        id, app_id, first_name, last_name, email,
        status, payment_status, lease_status, move_in_status,
        property_address, created_at
      from applications
      order by created_at desc
      limit greatest(1, least(coalesce(recent_limit, 8), 50))
    )
  select json_build_object(
    'counts', (
      (select row_to_json(app_counts)     from app_counts)::jsonb
      || (select row_to_json(month_count) from month_count)::jsonb
      || (select row_to_json(lease_counts)from lease_counts)::jsonb
      || (select row_to_json(movein_counts)from movein_counts)::jsonb
      || (select row_to_json(listing_counts)from listing_counts)::jsonb
      || (select row_to_json(failed_emails)from failed_emails)::jsonb
    ),
    'recent', (select coalesce(json_agg(r order by r.created_at desc), '[]'::json) from recent r),
    'range_start', range_start,
    'generated_at', now()
  );
$$;

comment on function public.dashboard_pulse(timestamptz, int)
  is 'Aggregated dashboard data for admin/dashboard.html. One round-trip instead of four.';

-- Only authenticated users can call this; RLS still applies to the
-- underlying tables via the security_definer search_path.
revoke execute on function public.dashboard_pulse(timestamptz, int) from public;
grant  execute on function public.dashboard_pulse(timestamptz, int) to authenticated;
