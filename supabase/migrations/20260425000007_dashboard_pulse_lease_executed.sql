-- 20260425000007 — dashboard_pulse: add lease_executed counter
--
-- Bug
-- ---
-- The lease_counts CTE counts only `sent` and `signed` lease_status values.
-- Once a lease is fully countersigned (`co_signed`), the application falls
-- into a counter gap and the admin dashboard shows it as neither pending,
-- nor sent, nor signed — making executed leases invisible.
--
-- Fix
-- ---
-- Add a lease_executed counter for `lease_status = 'co_signed'`. We keep
-- the existing buckets unchanged so other admin widgets that read those
-- fields continue to work.

CREATE OR REPLACE FUNCTION public.dashboard_pulse(
  range_start  TIMESTAMPTZ DEFAULT NULL,
  recent_limit INTEGER     DEFAULT 8
)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH
    apps_in_range AS (
      SELECT status, lease_status, move_in_status, payment_status, created_at
      FROM applications
      WHERE range_start IS NULL OR created_at >= range_start
    ),
    apps_all AS (
      SELECT status, lease_status, move_in_status, payment_status, created_at
      FROM applications
    ),
    app_counts AS (
      SELECT
        COUNT(*)                                                           AS total,
        COUNT(*) FILTER (WHERE status = 'pending')                         AS pending,
        COUNT(*) FILTER (WHERE status = 'approved')                        AS approved,
        COUNT(*) FILTER (WHERE status = 'denied')                          AS denied,
        COUNT(*) FILTER (WHERE status = 'waitlisted')                      AS waitlisted,
        COUNT(*) FILTER (WHERE status = 'approved'
                          AND (payment_status IS NULL
                               OR payment_status = 'unpaid'))              AS unpaid_approved
      FROM apps_in_range
    ),
    month_count AS (
      SELECT COUNT(*) AS this_month
      FROM apps_all
      WHERE created_at >= date_trunc('month', now())
    ),
    lease_counts AS (
      SELECT
        COUNT(*) FILTER (WHERE lease_status IS NULL
                          OR lease_status = 'none')                        AS lease_pending,
        COUNT(*) FILTER (WHERE lease_status = 'sent')                      AS lease_sent,
        COUNT(*) FILTER (WHERE lease_status = 'signed'
                          OR lease_status = 'awaiting_co_sign')            AS lease_signed,
        COUNT(*) FILTER (WHERE lease_status = 'co_signed')                 AS lease_executed
      FROM apps_all
    ),
    movein_counts AS (
      SELECT
        COUNT(*) FILTER (WHERE move_in_status = 'pending')                 AS movein_pending,
        COUNT(*) FILTER (WHERE move_in_status = 'confirmed')               AS movein_confirmed
      FROM apps_all
    ),
    listing_counts AS (
      SELECT COUNT(*) FILTER (WHERE status = 'active') AS active_listings
      FROM properties
    ),
    failed_emails AS (
      SELECT COUNT(*) AS failed_emails_48h
      FROM email_logs
      WHERE status = 'failed'
        AND created_at >= now() - interval '48 hours'
    ),
    recent AS (
      SELECT
        id, app_id, first_name, last_name, email,
        status, payment_status, lease_status, move_in_status,
        property_address, created_at
      FROM applications
      ORDER BY created_at DESC
      LIMIT GREATEST(1, LEAST(COALESCE(recent_limit, 8), 50))
    )
  SELECT json_build_object(
    'counts', (
         (SELECT row_to_json(app_counts)     FROM app_counts)::jsonb
      || (SELECT row_to_json(month_count)    FROM month_count)::jsonb
      || (SELECT row_to_json(lease_counts)   FROM lease_counts)::jsonb
      || (SELECT row_to_json(movein_counts)  FROM movein_counts)::jsonb
      || (SELECT row_to_json(listing_counts) FROM listing_counts)::jsonb
      || (SELECT row_to_json(failed_emails)  FROM failed_emails)::jsonb
    ),
    'recent',      (SELECT COALESCE(json_agg(r ORDER BY r.created_at DESC), '[]'::json) FROM recent r),
    'range_start', range_start,
    'generated_at', now()
  );
$function$;
