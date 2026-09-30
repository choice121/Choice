CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "pipeline";


ALTER SCHEMA "pipeline" OWNER TO "postgres";


COMMENT ON SCHEMA "pipeline" IS 'Internal data-ingest tables. Service-role only — never granted to anon or authenticated.';



CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."account_type" AS ENUM (
    'landlord',
    'property_owner',
    'realtor',
    'brokerage',
    'agency',
    'llc',
    'property_management'
);


ALTER TYPE "public"."account_type" OWNER TO "postgres";


CREATE TYPE "public"."application_status" AS ENUM (
    'pending',
    'under_review',
    'approved',
    'denied',
    'withdrawn',
    'waitlisted',
    'archived'
);


ALTER TYPE "public"."application_status" OWNER TO "postgres";


CREATE TYPE "public"."lease_status" AS ENUM (
    'none',
    'sent',
    'signed',
    'awaiting_co_sign',
    'co_signed',
    'voided',
    'expired'
);


ALTER TYPE "public"."lease_status" OWNER TO "postgres";


CREATE TYPE "public"."message_sender" AS ENUM (
    'admin',
    'tenant',
    'landlord'
);


ALTER TYPE "public"."message_sender" OWNER TO "postgres";


CREATE TYPE "public"."movein_status" AS ENUM (
    'pending',
    'scheduled',
    'confirmed',
    'completed'
);


ALTER TYPE "public"."movein_status" OWNER TO "postgres";


CREATE TYPE "public"."payment_status" AS ENUM (
    'unpaid',
    'paid',
    'waived',
    'refunded'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";


CREATE TYPE "public"."property_status" AS ENUM (
    'draft',
    'active',
    'paused',
    'rented',
    'archived',
    'inactive',
    'maintenance'
);


ALTER TYPE "public"."property_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_leases_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."_leases_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_property_photo"("p_property_id" "text", "p_url" "text", "p_file_id" "text", "p_alt_text" "text" DEFAULT NULL::"text", "p_caption" "text" DEFAULT NULL::"text", "p_width" integer DEFAULT NULL::integer, "p_height" integer DEFAULT NULL::integer, "p_display_order" integer DEFAULT NULL::integer, "p_is_hero" boolean DEFAULT false) RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_owner           BOOLEAN;
  v_admin           BOOLEAN := is_admin();
  v_is_service_role BOOLEAN;
  v_order           INT;
  v_new_id         UUID;
BEGIN
  IF p_property_id IS NULL OR p_url IS NULL THEN
    RAISE EXCEPTION 'property_id and url are required';
  END IF;

  -- Edge functions and batch jobs use the service-role key. In that context
  -- auth.uid() is NULL and current_role is service_role, so the normal
  -- browser ownership check must be bypassed.
  v_is_service_role := (auth.uid() IS NULL AND current_role = 'service_role');

  IF NOT v_is_service_role THEN
    SELECT EXISTS (
      SELECT 1
        FROM properties p
        JOIN landlords  l ON l.id = p.landlord_id
       WHERE p.id = p_property_id
         AND l.user_id = auth.uid()
    ) INTO v_owner;

    IF NOT (v_owner OR v_admin) THEN
      RAISE EXCEPTION 'Forbidden: not the owner of property %', p_property_id;
    END IF;
  END IF;

  IF p_display_order IS NOT NULL THEN
    v_order := p_display_order;
  ELSE
    SELECT COALESCE(MAX(display_order), -1) + 1
      INTO v_order
      FROM property_photos
     WHERE property_id = p_property_id;
  END IF;

  INSERT INTO property_photos (
    property_id, url, file_id, display_order, is_hero,
    alt_text, caption, width, height, watermark_status
  ) VALUES (
    p_property_id, p_url, NULLIF(p_file_id, ''), v_order, p_is_hero,
    p_alt_text, p_caption, p_width, p_height, 'pending'
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END $$;


ALTER FUNCTION "public"."add_property_photo"("p_property_id" "text", "p_url" "text", "p_file_id" "text", "p_alt_text" "text", "p_caption" "text", "p_width" integer, "p_height" integer, "p_display_order" integer, "p_is_hero" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_landlords"("p_page" integer DEFAULT 0, "p_per_page" integer DEFAULT 50) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  rows  jsonb;
  total bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden — admin only' USING ERRCODE = '42501';
  END IF;
  SELECT count(*)::bigint INTO total FROM public.landlords;
  SELECT COALESCE(jsonb_agg(l), '[]'::jsonb) INTO rows
  FROM (
    SELECT *
    FROM public.landlords
    ORDER BY created_at DESC
    LIMIT GREATEST(p_per_page, 0)
    OFFSET GREATEST(p_page, 0) * GREATEST(p_per_page, 0)
  ) l;
  RETURN jsonb_build_object('rows', rows, 'total', total);
END;
$$;


ALTER FUNCTION "public"."admin_list_landlords"("p_page" integer, "p_per_page" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_source_identity_contract"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pipeline'
    AS $$
DECLARE
  v_source TEXT := lower(coalesce(NEW.source, ''));
  v_strategy TEXT := 'UNKNOWN_REVIEW';
  v_type TEXT := 'UNKNOWN';
  v_profile_type TEXT := NULL;
  v_profile_name TEXT := NULL;
  v_profile_key TEXT := NULL;
  v_profile_image TEXT := NULL;
  v_profile_url TEXT := NULL;
  v_profile_id UUID := NULL;
BEGIN
  IF v_source IN ('progress', 'progress-residential') THEN
    v_source := 'progress_residential';
  ELSIF v_source IN ('invitation', 'invitation-homes', 'invitation homes') THEN
    v_source := 'invitation_homes';
  ELSIF v_source IN ('main-street-renewal', 'main street renewal', 'mainstreetrenewal') THEN
    v_source := 'main_street_renewal';
  ELSIF v_source IN ('cjrealestate', 'cj', 'cj properties', 'cj realty') THEN
    v_source := 'cj_real_estate';
  END IF;
  NEW.source := v_source;

  IF v_source = 'opendoor' THEN
    -- Explicit special-case invariant: no poster, agent, landlord, or
    -- profile is ever inferred for Opendoor at this stage.
    NEW.source_type := 'SPECIAL_CASE';
    NEW.identity_strategy := 'NO_IDENTITY';
    NEW.identity_status := 'unavailable';
    NEW.source_profile_id := NULL;
    NEW.source_profile_type := NULL;
    NEW.source_profile_name := NULL;
    NEW.source_profile_image_url := NULL;
    NEW.source_profile_url := NULL;
    NEW.agent_name := NULL;
    NEW.agent_image_url := NULL;
    NEW.agent_profile_url := NULL;
    NEW.poster_landlord_id := NULL;
    RETURN NEW;
  END IF;

  IF v_source IN ('progress_residential', 'invitation_homes', 'main_street_renewal', 'cj_real_estate') THEN
    v_type := 'DIRECT_PROPERTY_COMPANY';
    v_strategy := 'COMPANY_SOURCE';
    v_profile_type := 'company';
    v_profile_name := coalesce(
      nullif(trim(NEW.source_profile_name), ''),
      nullif(trim(NEW.broker_name), ''),
      CASE v_source
        WHEN 'progress_residential' THEN 'Progress Residential'
        WHEN 'invitation_homes' THEN 'Invitation Homes'
        WHEN 'main_street_renewal' THEN 'Main Street Renewal'
        WHEN 'cj_real_estate' THEN 'CJ Real Estate'
      END
    );
    NEW.agent_name := NULL;
    NEW.agent_image_url := NULL;
    NEW.agent_profile_url := NULL;
    NEW.poster_landlord_id := NULL;
  ELSIF v_source IN ('zillow', 'realtor') OR
        nullif(trim(NEW.agent_name), '') IS NOT NULL OR
        nullif(trim(NEW.agent_profile_url), '') IS NOT NULL THEN
    v_type := 'AGENT_PLATFORM';
    v_strategy := 'AGENT_POSTER';
    v_profile_type := 'agent';
    v_profile_name := nullif(trim(NEW.agent_name), '');
  ELSIF v_source IN ('apartments', 'redfin') THEN
    v_type := 'AGGREGATOR';
    v_strategy := 'UNKNOWN_REVIEW';
  END IF;

  NEW.source_type := coalesce(NEW.source_type, v_type);
  NEW.identity_strategy := coalesce(NEW.identity_strategy, v_strategy);
  NEW.source_profile_type := coalesce(NEW.source_profile_type, v_profile_type);
  NEW.source_profile_name := coalesce(NEW.source_profile_name, v_profile_name);
  NEW.identity_status := coalesce(
    NEW.identity_status,
    CASE
      WHEN v_profile_name IS NOT NULL THEN 'confirmed'
      WHEN v_strategy = 'UNKNOWN_REVIEW' THEN 'review'
      ELSE 'unavailable'
    END
  );

  IF NEW.identity_strategy IN ('AGENT_POSTER', 'COMPANY_SOURCE')
     AND nullif(trim(NEW.source_profile_name), '') IS NOT NULL THEN
    v_profile_key := md5(
      v_source || '|' || lower(trim(NEW.source_profile_type)) || '|' ||
      lower(trim(NEW.source_profile_name)) || '|' ||
      lower(coalesce(trim(NEW.broker_name), ''))
    );
    v_profile_image := nullif(trim(NEW.source_profile_image_url), '');
    v_profile_url := nullif(trim(NEW.source_profile_url), '');

    INSERT INTO public.source_profiles (
      source, profile_key, profile_type, display_name, image_url, profile_url,
      last_seen_at, updated_at
    ) VALUES (
      v_source, v_profile_key, NEW.source_profile_type, NEW.source_profile_name,
      v_profile_image, v_profile_url, now(), now()
    )
    ON CONFLICT (source, profile_key) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      image_url = coalesce(EXCLUDED.image_url, public.source_profiles.image_url),
      profile_url = coalesce(EXCLUDED.profile_url, public.source_profiles.profile_url),
      last_seen_at = now(),
      updated_at = now()
    RETURNING id INTO v_profile_id;

    IF v_profile_id IS NULL THEN
      SELECT id INTO v_profile_id
      FROM public.source_profiles
      WHERE source = v_source AND profile_key = v_profile_key;
    END IF;
    NEW.source_profile_id := v_profile_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."apply_source_identity_contract"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_application"("p_app_id" "text", "p_email" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
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


ALTER FUNCTION "public"."claim_application"("p_app_id" "text", "p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_signing_token"("p_token" "text", "p_request_ip" "inet" DEFAULT NULL::"inet") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE public.lease_signing_tokens
     SET used_at      = now(),
         ip_locked_to = COALESCE(ip_locked_to, p_request_ip)
   WHERE token       = p_token
     AND used_at     IS NULL
     AND revoked_at  IS NULL
     AND expires_at >= now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END;
$$;


ALTER FUNCTION "public"."consume_signing_token"("p_token" "text", "p_request_ip" "inet") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_confirmed_email"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
  SELECT lower(u.email)
  FROM auth.users u
  WHERE u.id = auth.uid()
    AND u.email_confirmed_at IS NOT NULL
$$;


ALTER FUNCTION "public"."current_confirmed_email"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."current_confirmed_email"() IS 'Returns lower(email) of the caller IFF their inbox is confirmed. Used by tenant-portal policies/RPCs to block account-takeover via unverified signup.';



CREATE OR REPLACE FUNCTION "public"."dashboard_pulse"("range_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "recent_limit" integer DEFAULT 8) RETURNS json
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with
    apps_in_range as (
      select status, lease_status, move_in_status, payment_status, created_at
      from applications
      where status <> 'archived'
        and (range_start is null or created_at >= range_start)
    ),
    apps_all as (
      select status, lease_status, move_in_status, payment_status, created_at
      from applications
      where status <> 'archived'
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
        count(*) filter (where lease_status = 'signed'
                          or lease_status = 'awaiting_co_sign')                as lease_signed,
        count(*) filter (where lease_status = 'co_signed')                     as lease_executed
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
      where status <> 'archived'
      order by created_at desc
      limit greatest(1, least(coalesce(recent_limit, 8), 50))
    )
  select json_build_object(
    'counts', (
      (select row_to_json(app_counts)       from app_counts)::jsonb
      || (select row_to_json(month_count)   from month_count)::jsonb
      || (select row_to_json(lease_counts)  from lease_counts)::jsonb
      || (select row_to_json(movein_counts) from movein_counts)::jsonb
      || (select row_to_json(listing_counts)from listing_counts)::jsonb
      || (select row_to_json(failed_emails) from failed_emails)::jsonb
    ),
    'recent', (select coalesce(json_agg(r order by r.created_at desc), '[]'::json) from recent r),
    'range_start', range_start,
    'generated_at', now()
  );
$$;


ALTER FUNCTION "public"."dashboard_pulse"("range_start" timestamp with time zone, "recent_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."dashboard_pulse"("range_start" timestamp with time zone, "recent_limit" integer) IS 'Aggregated dashboard data for admin/dashboard.html. Excludes archived applications from all counts and recent feed.';



CREATE OR REPLACE FUNCTION "public"."delete_properties_cascade"("p_ids" "text"[]) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pipeline', 'pg_temp'
    AS $_$
DECLARE
  v_deleted int := 0;
  v_clean_ids text[];
  v_uuid_ids uuid[];
  v_file_ids text[];
  v_actually_deleted text[];
BEGIN
  IF p_ids IS NULL OR array_length(p_ids, 1) = 0 THEN
    RETURN json_build_object('ok', true, 'deleted', 0, 'deleted_ids', ARRAY[]::text[], 'file_ids', ARRAY[]::text[]);
  END IF;

  -- Deduplicate and trim input IDs
  SELECT array_agg(DISTINCT trim(elem))
    INTO v_clean_ids
    FROM unnest(p_ids) elem
   WHERE elem IS NOT NULL AND trim(elem) <> '';

  IF v_clean_ids IS NULL OR array_length(v_clean_ids, 1) = 0 THEN
    RETURN json_build_object('ok', true, 'deleted', 0, 'deleted_ids', ARRAY[]::text[], 'file_ids', ARRAY[]::text[]);
  END IF;

  -- Extract valid UUIDs for tables that use UUID[] (e.g. client_collections)
  SELECT array_agg(DISTINCT elem::uuid)
    INTO v_uuid_ids
    FROM unnest(v_clean_ids) elem
   WHERE elem ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  -- Collect ImageKit file_ids for remote cleanup before deleting photos
  SELECT array_agg(DISTINCT file_id)
    INTO v_file_ids
    FROM public.property_photos
   WHERE property_id = ANY(v_clean_ids)
     AND file_id IS NOT NULL AND trim(file_id) <> '';

  -- 1. Delete associated property photos
  DELETE FROM public.property_photos
   WHERE property_id = ANY(v_clean_ids);

  -- 2. Delete saved properties links
  DELETE FROM public.saved_properties
   WHERE property_id = ANY(v_clean_ids);

  -- 3. Delete inquiries
  DELETE FROM public.inquiries
   WHERE property_id = ANY(v_clean_ids);

  -- 4. Unlink applications referencing these properties
  UPDATE public.applications
     SET property_id = NULL
   WHERE property_id = ANY(v_clean_ids);

  -- 5. Delete location notifications referencing these properties
  BEGIN
    DELETE FROM public.location_notifications
     WHERE property_id = ANY(v_clean_ids);
  EXCEPTION WHEN OTHERS THEN
    -- ignore if table doesn't exist
  END;

  -- 6. Unlink from client_collections (which uses UUID[])
  IF v_uuid_ids IS NOT NULL AND array_length(v_uuid_ids, 1) > 0 THEN
    BEGIN
      UPDATE public.client_collections
         SET property_ids = ARRAY(
           SELECT unnest(property_ids)
           EXCEPT
           SELECT unnest(v_uuid_ids)
         )
       WHERE property_ids && v_uuid_ids;
    EXCEPTION WHEN OTHERS THEN
      -- ignore if table doesn't exist
    END;
  END IF;

  -- 7. Nullify choice_property_id on pipeline properties if present
  BEGIN
    UPDATE pipeline.pipeline_properties
       SET choice_property_id = NULL
     WHERE choice_property_id = ANY(v_clean_ids);
  EXCEPTION WHEN OTHERS THEN
    -- ignore if schema or table differences exist
  END;

  -- 8. Delete the properties themselves and capture exactly which IDs were deleted
  WITH del AS (
    DELETE FROM public.properties
     WHERE id = ANY(v_clean_ids)
    RETURNING id
  )
  SELECT array_agg(id) INTO v_actually_deleted FROM del;

  v_deleted := COALESCE(array_length(v_actually_deleted, 1), 0);

  RETURN json_build_object(
    'ok', true,
    'deleted', v_deleted,
    'deleted_ids', COALESCE(v_actually_deleted, ARRAY[]::text[]),
    'file_ids', COALESCE(v_file_ids, ARRAY[]::text[])
  );
END;
$_$;


ALTER FUNCTION "public"."delete_properties_cascade"("p_ids" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_property_cascade"("p_id" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pipeline', 'pg_temp'
    AS $$
BEGIN
  IF p_id IS NULL OR trim(p_id) = '' THEN
    RETURN json_build_object('ok', true, 'deleted', 0, 'deleted_ids', ARRAY[]::text[], 'file_ids', ARRAY[]::text[]);
  END IF;
  RETURN public.delete_properties_cascade(ARRAY[trim(p_id)]);
END;
$$;


ALTER FUNCTION "public"."delete_property_cascade"("p_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_property_photo_by_file_id"("p_file_id" "text") RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_pid             TEXT;
  v_owner           BOOLEAN;
  v_admin           BOOLEAN := is_admin();
  v_is_service_role BOOLEAN;
BEGIN
  IF p_file_id IS NULL OR p_file_id = '' THEN
    RETURN FALSE;
  END IF;

  SELECT property_id INTO v_pid
    FROM property_photos
   WHERE file_id = p_file_id
   LIMIT 1;

  IF v_pid IS NULL THEN
    RETURN FALSE;
  END IF;

  v_is_service_role := (auth.uid() IS NULL AND current_role = 'service_role');

  IF NOT v_is_service_role THEN
    SELECT EXISTS (
      SELECT 1
        FROM properties p
        JOIN landlords  l ON l.id = p.landlord_id
       WHERE p.id = v_pid
         AND l.user_id = auth.uid()
    ) INTO v_owner;

    IF NOT (v_owner OR v_admin) THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
  END IF;

  DELETE FROM property_photos WHERE file_id = p_file_id;

  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY display_order) - 1 AS new_order
      FROM property_photos
     WHERE property_id = v_pid
  )
  UPDATE property_photos pp
     SET display_order = ranked.new_order,
         is_hero       = (ranked.new_order = 0)
    FROM ranked
   WHERE pp.id = ranked.id
     AND (pp.display_order IS DISTINCT FROM ranked.new_order
          OR pp.is_hero    IS DISTINCT FROM (ranked.new_order = 0));

  RETURN TRUE;
END $$;


ALTER FUNCTION "public"."delete_property_photo_by_file_id"("p_file_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_lease_tokens"("p_app_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
  DECLARE
    app_rec      RECORD;
    tenant_token TEXT;
    co_token     TEXT;
    v_co_email   TEXT;
    v_attempts   INT;
  BEGIN
    SELECT * INTO app_rec FROM public.applications WHERE app_id = p_app_id LIMIT 1;
    IF NOT FOUND THEN
      RETURN '{"success": false, "message": "Application not found."}'::JSONB;
    END IF;

    UPDATE public.lease_signing_tokens
       SET revoked_at    = now(),
           revoke_reason = COALESCE(revoke_reason, 'lease_regenerated')
     WHERE app_id      = p_app_id
       AND signer_role IN ('tenant','co_applicant')
       AND used_at    IS NULL
       AND revoked_at IS NULL;

    IF app_rec.has_co_applicant THEN
      SELECT email INTO v_co_email FROM public.co_applicants WHERE app_id = p_app_id LIMIT 1;
    END IF;

    v_attempts := 0;
    LOOP
      v_attempts := v_attempts + 1;
      tenant_token := encode(extensions.gen_random_bytes(32), 'hex');
      BEGIN
        INSERT INTO public.lease_signing_tokens (token, app_id, signer_role, signer_email)
        VALUES (tenant_token, p_app_id, 'tenant', COALESCE(app_rec.email, ''));
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        IF v_attempts >= 5 THEN
          RAISE EXCEPTION 'generate_lease_tokens: tenant token collided 5x' USING ERRCODE = 'P0001';
        END IF;
      END;
    END LOOP;

    IF app_rec.has_co_applicant THEN
      v_attempts := 0;
      LOOP
        v_attempts := v_attempts + 1;
        co_token := encode(extensions.gen_random_bytes(32), 'hex');
        BEGIN
          INSERT INTO public.lease_signing_tokens (token, app_id, signer_role, signer_email)
          VALUES (co_token, p_app_id, 'co_applicant', COALESCE(v_co_email, app_rec.email, ''));
          EXIT;
        EXCEPTION WHEN unique_violation THEN
          IF v_attempts >= 5 THEN
            RAISE EXCEPTION 'generate_lease_tokens: co-applicant token collided 5x' USING ERRCODE = 'P0001';
          END IF;
        END;
      END LOOP;
    ELSE
      co_token := NULL;
    END IF;

    UPDATE public.applications SET
      tenant_sign_token        = tenant_token,
      co_applicant_lease_token = co_token,
      lease_status             = 'sent',
      lease_sent_date          = now(),
      updated_at               = now()
    WHERE app_id = p_app_id;

    RETURN jsonb_build_object(
      'success',           true,
      'tenant_token',      tenant_token,
      'co_applicant_token', co_token
    );
  END;
  $$;


ALTER FUNCTION "public"."generate_lease_tokens"("p_app_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_property_id"() RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  v_id    TEXT := 'PROP-';
  v_i     INT;
  v_bytes BYTEA;
BEGIN
  v_bytes := gen_random_bytes(8);
  FOR v_i IN 0..7 LOOP
    v_id := v_id || substr(v_chars, (get_byte(v_bytes, v_i) % 36) + 1, 1);
  END LOOP;
  IF EXISTS (SELECT 1 FROM properties WHERE id = v_id) THEN
    RETURN generate_property_id();
  END IF;
  RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."generate_property_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_apps_by_email"("p_email" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
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


ALTER FUNCTION "public"."get_apps_by_email"("p_email" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."client_collections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_name" "text" NOT NULL,
    "property_ids" "uuid"[] NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '14 days'::interval)
);

ALTER TABLE ONLY "public"."client_collections" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_collections" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_client_collection"("collection_id" "uuid") RETURNS SETOF "public"."client_collections"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ SELECT * FROM public.client_collections WHERE id = collection_id; $$;


ALTER FUNCTION "public"."get_client_collection"("collection_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_applications"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
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


ALTER FUNCTION "public"."get_my_applications"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."landlords" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "account_type" "public"."account_type" DEFAULT 'landlord'::"public"."account_type" NOT NULL,
    "contact_name" "text",
    "business_name" "text",
    "email" "text",
    "phone" "text",
    "address" "text",
    "city" "text",
    "state" "text",
    "zip" "text",
    "avatar_url" "text",
    "tagline" "text",
    "bio" "text",
    "website" "text",
    "license_number" "text",
    "license_state" "text",
    "years_experience" integer,
    "specialties" "text"[],
    "social_facebook" "text",
    "social_instagram" "text",
    "social_linkedin" "text",
    "verified" boolean DEFAULT false,
    "plan" "text" DEFAULT 'free'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."landlords" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_landlord_profile"() RETURNS "public"."landlords"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result public.landlords;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO result
  FROM public.landlords
  WHERE user_id = auth.uid()
  LIMIT 1;
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_my_landlord_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_landlord_profile_stats"("p_landlord_id" "uuid") RETURNS TABLE("total_views" bigint, "total_applications" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    COALESCE((
      SELECT SUM(COALESCE(p.views_count, 0))::bigint
      FROM public.properties AS p
      WHERE p.landlord_id = p_landlord_id
        AND p.status = 'active'
    ), 0)::bigint AS total_views,
    COALESCE((
      SELECT COUNT(*)::bigint
      FROM public.applications AS a
      JOIN public.properties AS p ON p.id = a.property_id
      WHERE p.landlord_id = p_landlord_id
        AND p.status = 'active'
    ), 0)::bigint AS total_applications;
$$;


ALTER FUNCTION "public"."get_public_landlord_profile_stats"("p_landlord_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_public_landlord_profile_stats"("p_landlord_id" "uuid") IS 'Returns aggregate views and application counts for active listings only; never exposes application records.';



CREATE OR REPLACE FUNCTION "public"."get_watermark_sniper_catalog"("p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0, "p_state" "text" DEFAULT NULL::"text", "p_city" "text" DEFAULT NULL::"text", "p_property_type" "text" DEFAULT NULL::"text", "p_date_filter" "text" DEFAULT NULL::"text", "p_date_from" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_date_to" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_photo_status" "text" DEFAULT NULL::"text", "p_search" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "text", "title" "text", "address" "text", "city" "text", "state" "text", "zip" "text", "property_type" "text", "monthly_rent" integer, "status" "text", "landlord_id" "uuid", "created_at" timestamp with time zone, "photo_count" bigint, "photo_id" "uuid", "photo_url" "text", "photo_file_id" "text", "cover_url" "text", "has_flagged_photo" boolean, "total_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  WITH photo_summary AS (
    SELECT 
      ph.property_id,
      count(*)::bigint as p_count,
      bool_or(ph.watermark_status IN ('branding', 'watermark', 'flagged')) as p_has_flagged
    FROM public.property_photos ph
    GROUP BY ph.property_id
  ),
  filtered AS (
    SELECT 
      p.id,
      p.title,
      p.address,
      p.city,
      p.state,
      p.zip,
      p.property_type,
      p.monthly_rent,
      p.status::text as status_txt,
      p.landlord_id,
      p.created_at,
      COALESCE(ps.p_count, 0::bigint) as p_photo_count,
      COALESCE(ps.p_has_flagged, false) as p_has_flagged,
      count(*) OVER() as full_count
    FROM public.properties p
    LEFT JOIN photo_summary ps ON ps.property_id = p.id
    WHERE 
      (p_state IS NULL OR p_state = '' OR p_state = 'all' OR p.state ILIKE p_state)
      AND (p_city IS NULL OR p_city = '' OR p_city = 'all' OR p.city ILIKE p_city)
      AND (
        p_property_type IS NULL OR p_property_type = '' OR p_property_type = 'all' 
        OR p.property_type ILIKE '%' || p_property_type || '%'
      )
      AND (
        CASE 
          WHEN p_date_filter = '24h' OR p_date_filter = 'today' THEN p.created_at >= (NOW() - INTERVAL '24 hours')
          WHEN p_date_filter = '7d' THEN p.created_at >= (NOW() - INTERVAL '7 days')
          WHEN p_date_filter = '30d' THEN p.created_at >= (NOW() - INTERVAL '30 days')
          WHEN p_date_from IS NOT NULL AND p_date_to IS NOT NULL THEN p.created_at >= p_date_from AND p.created_at <= p_date_to
          WHEN p_date_from IS NOT NULL THEN p.created_at >= p_date_from
          WHEN p_date_to IS NOT NULL THEN p.created_at <= p_date_to
          ELSE TRUE
        END
      )
      AND (
        CASE
          WHEN p_photo_status = 'zero_photos' THEN COALESCE(ps.p_count, 0) = 0
          WHEN p_photo_status = 'under_6_photos' THEN COALESCE(ps.p_count, 0) > 0 AND COALESCE(ps.p_count, 0) < 6
          WHEN p_photo_status = 'with_photos' THEN COALESCE(ps.p_count, 0) > 0
          WHEN p_photo_status = 'flagged_only' THEN COALESCE(ps.p_has_flagged, false) = true
          ELSE TRUE
        END
      )
      AND (
        p_search IS NULL OR trim(p_search) = '' OR 
        p.address ILIKE '%' || trim(p_search) || '%' OR
        p.title ILIKE '%' || trim(p_search) || '%' OR
        p.city ILIKE '%' || trim(p_search) || '%' OR
        p.zip ILIKE '%' || trim(p_search) || '%' OR
        p.id ILIKE '%' || trim(p_search) || '%'
      )
    ORDER BY p.created_at DESC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT 
    f.id,
    f.title,
    f.address,
    f.city,
    f.state,
    f.zip,
    f.property_type,
    f.monthly_rent,
    f.status_txt AS status,
    f.landlord_id,
    f.created_at,
    f.p_photo_count AS photo_count,
    ph.id AS photo_id,
    ph.url AS photo_url,
    ph.file_id AS photo_file_id,
    cov.url AS cover_url,
    f.p_has_flagged AS has_flagged_photo,
    f.full_count AS total_count
  FROM filtered f
  LEFT JOIN LATERAL (
    SELECT pph.id, pph.url, pph.file_id
    FROM public.property_photos pph
    WHERE pph.property_id = f.id
    ORDER BY 
      CASE WHEN pph.display_order = 0 THEN 99 ELSE pph.display_order END ASC,
      pph.display_order ASC
    LIMIT 1
  ) ph ON true
  LEFT JOIN LATERAL (
    SELECT pph.url
    FROM public.property_photos pph
    WHERE pph.property_id = f.id
    ORDER BY pph.display_order ASC
    LIMIT 1
  ) cov ON true
  ORDER BY f.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_watermark_sniper_catalog"("p_limit" integer, "p_offset" integer, "p_state" "text", "p_city" "text", "p_property_type" "text", "p_date_filter" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_photo_status" "text", "p_search" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_watermark_sniper_filter_options"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_res json;
BEGIN
  SELECT json_build_object(
    'states', (
      SELECT coalesce(json_agg(s ORDER BY s), '[]'::json)
      FROM (SELECT DISTINCT state as s FROM public.properties WHERE state IS NOT NULL AND trim(state) <> '') q
    ),
    'cities_by_state', (
      SELECT coalesce(json_object_agg(state, cities), '{}'::json)
      FROM (
        SELECT state, json_agg(DISTINCT city ORDER BY city) as cities
        FROM public.properties
        WHERE state IS NOT NULL AND trim(state) <> '' AND city IS NOT NULL AND trim(city) <> ''
        GROUP BY state
      ) cs
    ),
    'all_cities', (
      SELECT coalesce(json_agg(c ORDER BY c), '[]'::json)
      FROM (SELECT DISTINCT city as c FROM public.properties WHERE city IS NOT NULL AND trim(city) <> '') q
    ),
    'property_types', (
      SELECT coalesce(json_agg(pt ORDER BY pt), '[]'::json)
      FROM (SELECT DISTINCT property_type as pt FROM public.properties WHERE property_type IS NOT NULL AND trim(property_type) <> '') q
    ),
    'total_properties', (SELECT count(*) FROM public.properties),
    'zero_photos_count', (
      SELECT count(*) 
      FROM public.properties p 
      WHERE NOT EXISTS (SELECT 1 FROM public.property_photos ph WHERE ph.property_id = p.id)
    ),
    'under_6_photos_count', (
      SELECT count(*) 
      FROM (
        SELECT p.id, count(ph.id) as cnt
        FROM public.properties p
        JOIN public.property_photos ph ON ph.property_id = p.id
        GROUP BY p.id
        HAVING count(ph.id) < 6
      ) sub
    ),
    'flagged_photos_count', (
      SELECT count(DISTINCT p.id)
      FROM public.properties p
      JOIN public.property_photos ph ON ph.property_id = p.id
      WHERE ph.watermark_status IN ('branding', 'watermark', 'flagged')
    )
  ) INTO v_res;
  RETURN v_res;
END;
$$;


ALTER FUNCTION "public"."get_watermark_sniper_filter_options"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_recent_esign_consent"("p_app_id" "text", "p_email" "text", "p_version" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.esign_consents
    WHERE app_id              = p_app_id
      AND lower(signer_email) = lower(p_email)
      AND disclosure_version  = p_version
      AND withdrawn_at        IS NULL
      AND consent_given       = true
      AND consented_at       >  now() - INTERVAL '30 days'
  );
$$;


ALTER FUNCTION "public"."has_recent_esign_consent"("p_app_id" "text", "p_email" "text", "p_version" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."immutable_array_to_text"("arr" "text"[], "sep" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT array_to_string(arr, sep)
$$;


ALTER FUNCTION "public"."immutable_array_to_text"("arr" "text"[], "sep" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_counter"("p_table" "text", "p_id" "text", "p_column" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF p_table != 'properties' OR p_column != 'views_count' THEN
    RAISE EXCEPTION 'Invalid counter target';
  END IF;
  UPDATE properties
    SET views_count = COALESCE(views_count, 0) + 1
    WHERE id = p_id;
END;
$$;


ALTER FUNCTION "public"."increment_counter"("p_table" "text", "p_id" "text", "p_column" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid());
END;
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lease_addenda_library_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  BEGIN NEW.updated_at := now(); RETURN NEW; END $$;


ALTER FUNCTION "public"."lease_addenda_library_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lease_deposit_accountings_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END$$;


ALTER FUNCTION "public"."lease_deposit_accountings_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lease_deposit_deductions_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END$$;


ALTER FUNCTION "public"."lease_deposit_deductions_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lease_inspections_recount_photos"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE target_id UUID;
BEGIN
  target_id := COALESCE(NEW.inspection_id, OLD.inspection_id);
  UPDATE public.lease_inspections
     SET photos_count = (SELECT count(*) FROM public.lease_inspection_photos WHERE inspection_id = target_id),
         updated_at   = now()
   WHERE id = target_id;
  RETURN NULL;
END$$;


ALTER FUNCTION "public"."lease_inspections_recount_photos"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lease_inspections_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END$$;


ALTER FUNCTION "public"."lease_inspections_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lease_template_partials_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."lease_template_partials_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leases_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."leases_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lookup_lease_by_qr_token"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_pv       RECORD;
  v_app      RECORD;
  v_signers  JSONB := '[]'::jsonb;
  v_consents JSONB;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('found', false, 'error', 'Invalid token');
  END IF;

  SELECT * INTO v_pv
    FROM public.lease_pdf_versions
   WHERE qr_verify_token = p_token
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false, 'error', 'Token not recognized');
  END IF;

  SELECT app_id, lease_state_code, lease_status,
         lease_start_date, lease_end_date,
         tenant_signature, co_applicant_signature, management_signed,
         signature_timestamp, co_applicant_signature_timestamp, management_signed_at,
         first_name, last_name,
         co_applicant_first_name, co_applicant_last_name,
         management_signer_name
    INTO v_app
    FROM public.applications
   WHERE app_id = v_pv.app_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false, 'error', 'Application not found');
  END IF;

  -- Tenant signer
  IF v_app.tenant_signature IS NOT NULL THEN
    v_signers := v_signers || jsonb_build_array(jsonb_build_object(
      'role',         'tenant',
      'display_name', trim(coalesce(v_app.first_name, '') || ' ' ||
                           CASE WHEN v_app.last_name IS NOT NULL AND length(v_app.last_name) > 0
                                THEN upper(left(v_app.last_name, 1)) || '.'
                                ELSE '' END),
      'signed_at',    v_app.signature_timestamp
    ));
  END IF;

  -- Co-applicant signer
  IF v_app.co_applicant_signature IS NOT NULL THEN
    v_signers := v_signers || jsonb_build_array(jsonb_build_object(
      'role',         'co_applicant',
      'display_name', trim(coalesce(v_app.co_applicant_first_name, '') || ' ' ||
                           CASE WHEN v_app.co_applicant_last_name IS NOT NULL AND length(v_app.co_applicant_last_name) > 0
                                THEN upper(left(v_app.co_applicant_last_name, 1)) || '.'
                                ELSE '' END),
      'signed_at',    v_app.co_applicant_signature_timestamp
    ));
  END IF;

  -- Management signer
  IF v_app.management_signed IS TRUE THEN
    v_signers := v_signers || jsonb_build_array(jsonb_build_object(
      'role',         'management',
      'display_name', coalesce(v_app.management_signer_name, 'Choice Properties'),
      'signed_at',    v_app.management_signed_at
    ));
  END IF;

  -- E-SIGN consent counts by role (no PII -- counts only)
  SELECT COALESCE(jsonb_object_agg(signer_role, cnt), '{}'::jsonb)
    INTO v_consents
    FROM (
      SELECT signer_role, count(*)::int AS cnt
        FROM public.esign_consents
       WHERE app_id        = v_pv.app_id
         AND consent_given = true
         AND withdrawn_at  IS NULL
       GROUP BY signer_role
    ) s;

  RETURN jsonb_build_object(
    'found',                  true,
    'state_code',             v_app.lease_state_code,
    'lease_status',           v_app.lease_status,
    'lease_start_date',       v_app.lease_start_date,
    'lease_end_date',         v_app.lease_end_date,
    'pdf_version',            v_pv.version_number,
    'event',                  v_pv.event,
    'sha256',                 v_pv.sha256,
    'certificate_appended',   v_pv.certificate_appended,
    'storage_path',           v_pv.storage_path,
    'created_at',             v_pv.created_at,
    'signers',                v_signers,
    'esign_consents_by_role', v_consents
  );
END;
$$;


ALTER FUNCTION "public"."lookup_lease_by_qr_token"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lookup_signer_for_token"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_app          RECORD;
  v_token_meta   public.lease_signing_tokens%ROWTYPE;
  v_signer_type  TEXT;
  v_signer_email TEXT;
  v_signer_name  TEXT;
  v_already      BOOLEAN := false;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing token');
  END IF;

  SELECT * INTO v_token_meta FROM public.lease_signing_tokens WHERE token = p_token;

  -- Try tenant token
  SELECT app_id, email, first_name, last_name, lease_status, tenant_signature, has_co_applicant
    INTO v_app
    FROM public.applications
   WHERE tenant_sign_token = p_token
   LIMIT 1;

  IF FOUND THEN
    v_signer_type  := 'tenant';
    v_signer_email := v_app.email;
    v_signer_name  := COALESCE(v_app.first_name,'') || ' ' || COALESCE(v_app.last_name,'');
    v_already      := v_app.tenant_signature IS NOT NULL;
  ELSE
    SELECT a.app_id, ca.email, ca.first_name, ca.last_name, a.lease_status,
           a.co_applicant_signature, a.has_co_applicant
      INTO v_app
      FROM public.applications a
      LEFT JOIN public.co_applicants ca ON ca.app_id = a.app_id
     WHERE a.co_applicant_lease_token = p_token
     LIMIT 1;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired signing link');
    END IF;

    v_signer_type  := 'co_applicant';
    v_signer_email := v_app.email;
    v_signer_name  := COALESCE(v_app.first_name,'') || ' ' || COALESCE(v_app.last_name,'');
    v_already      := v_app.co_applicant_signature IS NOT NULL;
  END IF;

  -- Phase 05 -- surface registry status
  IF v_token_meta.token IS NOT NULL THEN
    IF v_token_meta.revoked_at IS NOT NULL THEN
      RETURN jsonb_build_object('success', false,
        'error', COALESCE('Signing link revoked: ' || v_token_meta.revoke_reason,
                          'Signing link has been revoked.'));
    END IF;
    IF v_token_meta.expires_at < now() THEN
      RETURN jsonb_build_object('success', false,
        'error', 'Signing link expired on ' || to_char(v_token_meta.expires_at, 'Mon DD, YYYY')
                 || '. Please contact us for a fresh link.');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success',        true,
    'app_id',         v_app.app_id,
    'signer_type',    v_signer_type,
    'signer_email',   v_signer_email,
    'signer_name',    btrim(v_signer_name),
    'lease_status',   v_app.lease_status,
    'already_signed', v_already,
    'expires_at',     v_token_meta.expires_at
  );
END;
$$;


ALTER FUNCTION "public"."lookup_signer_for_token"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_properties"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) RETURNS TABLE("id" "text", "address" "text", "city" "text", "state" "text", "similarity" double precision)
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    properties.id,
    properties.address,
    properties.city,
    properties.state,
    1 - (properties.embedding <=> query_embedding) AS similarity
  FROM properties
  WHERE properties.status = 'active'
    AND 1 - (properties.embedding <=> query_embedding) > match_threshold
  ORDER BY properties.embedding <=> query_embedding
  LIMIT match_count;
$$;


ALTER FUNCTION "public"."match_properties"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pipeline_archive"("p_id" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pipeline'
    AS $$
BEGIN
  UPDATE pipeline.pipeline_properties
  SET status = 'archived', updated_at = now()
  WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Not found');
  END IF;
  RETURN json_build_object('ok', true);
END;
$$;


ALTER FUNCTION "public"."pipeline_archive"("p_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pipeline_bulk_delete"("p_ids" json) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pipeline'
    AS $$
DECLARE
  ids text[];
  cnt int := 0;
BEGIN
  IF p_ids IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'No ids provided');
  END IF;
  SELECT array_agg(elem::text) INTO ids
  FROM json_array_elements_text(p_ids) elem;
  IF ids IS NULL OR array_length(ids,1) = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'No ids provided');
  END IF;
  DELETE FROM pipeline.pipeline_properties WHERE id = ANY(ids) RETURNING id INTO ids;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  RETURN json_build_object('ok', true, 'deleted', cnt);
END;
$$;


ALTER FUNCTION "public"."pipeline_bulk_delete"("p_ids" json) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pipeline_cleanup_orphans"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- 1. Auto-archive published listings after 30 days
  UPDATE choice_properties_pipeline
  SET status = 'archived'
  WHERE status = 'published'
    AND published_at < NOW() - INTERVAL '30 days';

  -- 2. Auto-archive failed listings older than 7 days
  UPDATE choice_properties_pipeline
  SET status = 'archived'
  WHERE status = 'failed'
    AND created_at < NOW() - INTERVAL '7 days';

  -- 3. Reap zero-photo listings older than 3 days
  UPDATE choice_properties_pipeline
  SET status = 'archived'
  WHERE status = 'scraped'
    AND original_image_urls = '[]'
    AND created_at < NOW() - INTERVAL '3 days';

  -- 4. Clean up completely orphaned records (no property, no photos) that are stuck
  UPDATE choice_properties_pipeline
  SET status = 'archived'
  WHERE status IN ('scraped', 'pending', 'error')
    AND choice_property_id IS NULL
    AND original_image_urls = '[]'
    AND created_at < NOW() - INTERVAL '7 days';
END;
$$;


ALTER FUNCTION "public"."pipeline_cleanup_orphans"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pipeline_cleanup_staged"("p_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pipeline'
    AS $$
BEGIN
  UPDATE pipeline.pipeline_properties
  SET status = 'failed', updated_at = now()
  WHERE id = p_id;
END;
$$;


ALTER FUNCTION "public"."pipeline_cleanup_staged"("p_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pipeline_count"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pipeline'
    AS $$
DECLARE result json;
BEGIN
  SELECT json_object_agg(status, cnt)
  INTO result
  FROM (
    SELECT status, COUNT(*) AS cnt
    FROM pipeline.pipeline_properties
    GROUP BY status
  ) s;
  RETURN COALESCE(result, '{}'::json);
END;
$$;


ALTER FUNCTION "public"."pipeline_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pipeline_delete"("p_id" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pipeline'
    AS $$
DECLARE cnt int := 0;
BEGIN
  DELETE FROM pipeline.pipeline_properties WHERE id = p_id;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  IF cnt = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'Not found');
  END IF;
  RETURN json_build_object('ok', true, 'deleted', cnt);
END;
$$;


ALTER FUNCTION "public"."pipeline_delete"("p_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pipeline_fetch_staged_ids"("p_source_ids" "text"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pipeline'
    AS $$
DECLARE
  result_rows jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'source_listing_id', source_listing_id,
      'id', id,
      'choice_property_id', choice_property_id
    )
  )
  INTO result_rows
  FROM pipeline.pipeline_properties
  WHERE source_listing_id = ANY(p_source_ids);

  RETURN COALESCE(result_rows, '[]'::jsonb);
END;
$$;


ALTER FUNCTION "public"."pipeline_fetch_staged_ids"("p_source_ids" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pipeline_folder_add_property"("p_property_id" "text", "p_folder_name" "text" DEFAULT NULL::"text", "p_folder_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pipeline'
    AS $$
DECLARE
  v_folder_id uuid;
  v_serial    int;
  v_exists    boolean;
BEGIN
  -- Resolve folder by name or ID
  IF p_folder_id IS NULL AND p_folder_name IS NOT NULL THEN
    SELECT id INTO v_folder_id
    FROM pipeline.pipeline_folders
    WHERE name = initcap(trim(regexp_replace(p_folder_name, '\s+', ' ', 'g')));
    IF NOT FOUND THEN
      RETURN json_build_object('ok', false, 'error', 'Folder not found: ' || p_folder_name);
    END IF;
  ELSIF p_folder_id IS NOT NULL THEN
    v_folder_id := p_folder_id;
  ELSE
    RETURN json_build_object('ok', false, 'error', 'Either folder_name or folder_id is required');
  END IF;

  -- Check property exists
  SELECT EXISTS(SELECT 1 FROM pipeline.pipeline_properties WHERE id = p_property_id)
  INTO v_exists;
  IF NOT v_exists THEN
    RETURN json_build_object('ok', false, 'error', 'Property not found');
  END IF;

  -- Auto-assign serial: count existing + 1
  SELECT COALESCE(MAX(folder_serial), 0) + 1
  INTO v_serial
  FROM pipeline.pipeline_properties
  WHERE folder_id = v_folder_id;

  UPDATE pipeline.pipeline_properties
  SET folder_id = v_folder_id,
      folder_serial = v_serial,
      updated_at = now()
  WHERE id = p_property_id;

  RETURN json_build_object('ok', true, 'folder_id', v_folder_id, 'serial', v_serial);
END;
$$;


ALTER FUNCTION "public"."pipeline_folder_add_property"("p_property_id" "text", "p_folder_name" "text", "p_folder_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pipeline_folder_create"("p_name" "text", "p_description" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pipeline'
    AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Normalize name: trim, collapse spaces, title-case
  p_name := initcap(trim(regexp_replace(p_name, '\s+', ' ', 'g')));
  IF p_name = '' THEN
    RETURN json_build_object('ok', false, 'error', 'Folder name is required');
  END IF;

  -- Check for existing folder with same name
  SELECT id INTO v_id FROM pipeline.pipeline_folders WHERE name = p_name;
  IF FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Folder already exists', 'id', v_id);
  END IF;

  INSERT INTO pipeline.pipeline_folders (name, description)
  VALUES (p_name, p_description)
  RETURNING id INTO v_id;

  RETURN json_build_object('ok', true, 'id', v_id, 'name', p_name);
END;
$$;


ALTER FUNCTION "public"."pipeline_folder_create"("p_name" "text", "p_description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pipeline_folder_create"("p_name" "text", "p_description" "text" DEFAULT NULL::"text", "p_color" "text" DEFAULT '#6366f1'::"text", "p_icon" "text" DEFAULT '📁'::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pipeline'
    AS $$
DECLARE
  v_id uuid;
BEGIN
  p_name := initcap(trim(regexp_replace(p_name, '\s+', ' ', 'g')));
  IF p_name = '' THEN
    RETURN json_build_object('ok', false, 'error', 'Folder name is required');
  END IF;

  SELECT id INTO v_id FROM pipeline.pipeline_folders WHERE name = p_name;
  IF FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Folder already exists', 'id', v_id);
  END IF;

  INSERT INTO pipeline.pipeline_folders (name, description, color, icon)
  VALUES (p_name, p_description, COALESCE(p_color, '#6366f1'), COALESCE(p_icon, '📁'))
  RETURNING id INTO v_id;

  RETURN json_build_object('ok', true, 'id', v_id, 'name', p_name, 'color', p_color, 'icon', p_icon);
END;
$$;


ALTER FUNCTION "public"."pipeline_folder_create"("p_name" "text", "p_description" "text", "p_color" "text", "p_icon" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pipeline_folder_delete"("p_folder_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pipeline'
    AS $$
DECLARE
  v_name text;
  v_archived int;
BEGIN
  SELECT name INTO v_name FROM pipeline.pipeline_folders WHERE id = p_folder_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Folder not found');
  END IF;

  -- Archive all non-published properties in the folder
  UPDATE pipeline.pipeline_properties
  SET status = 'archived',
      folder_id = NULL,
      folder_serial = NULL,
      updated_at = now()
  WHERE folder_id = p_folder_id
    AND status NOT IN ('published', 'archived');

  GET DIAGNOSTICS v_archived = ROW_COUNT;

  -- For published properties, just remove folder assignment
  UPDATE pipeline.pipeline_properties
  SET folder_id = NULL,
      folder_serial = NULL,
      updated_at = now()
  WHERE folder_id = p_folder_id;

  DELETE FROM pipeline.pipeline_folders WHERE id = p_folder_id;

  RETURN json_build_object(
    'ok', true,
    'name', v_name,
    'archived', v_archived
  );
END;
$$;


ALTER FUNCTION "public"."pipeline_folder_delete"("p_folder_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pipeline_folder_list"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pipeline'
    AS $$
DECLARE result json;
BEGIN
  SELECT json_agg(row_to_json(t))
  INTO result
  FROM (
    SELECT
      f.id, f.name, f.description, f.created_at,
      COUNT(p.id) AS property_count,
      COUNT(p.id) FILTER (WHERE p.status = 'published') AS published_count,
      COUNT(p.id) FILTER (WHERE p.status = 'archived') AS archived_count
    FROM pipeline.pipeline_folders f
    LEFT JOIN pipeline.pipeline_properties p ON p.folder_id = f.id
    GROUP BY f.id, f.name, f.description, f.created_at
    ORDER BY f.created_at DESC
  ) t;
  RETURN COALESCE(result, '[]'::json);
END;
$$;


ALTER FUNCTION "public"."pipeline_folder_list"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pipeline_folder_properties"("p_folder_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pipeline'
    AS $$
DECLARE result json;
BEGIN
  SELECT json_agg(row_to_json(t))
  INTO result
  FROM (
    SELECT
      id, status, title, address, city, state, zip,
      bedrooms, bathrooms, square_footage, monthly_rent,
      property_type, year_built, unit_number,
      description, original_description, showing_instructions,
      pets_allowed, smoking_allowed, parking,
      minimum_lease_months, security_deposit, application_fee,
      garage_spaces, available_date, virtual_tour_url,
      has_basement, has_central_air,
      data_quality_score, missing_fields, edited_fields,
      original_image_urls, source_url, source, agent_name,
      poster_landlord_id, choice_property_id,
      scraped_at, updated_at, published_at,
      neighborhood, county, location_context,
      folder_id, folder_serial,
      photo_import_status, photo_upload_status
    FROM pipeline.pipeline_properties
    WHERE folder_id = p_folder_id
    ORDER BY folder_serial ASC
  ) t;
  RETURN COALESCE(result, '[]'::json);
END;
$$;


ALTER FUNCTION "public"."pipeline_folder_properties"("p_folder_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pipeline_folder_publish"("p_folder_id" "uuid", "p_property_ids" "text"[] DEFAULT NULL::"text"[]) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pipeline'
    AS $$
DECLARE
  v_pub_count int := 0;
  v_fail_count int := 0;
  v_errors text[] := '{}';
  v_rec RECORD;
  v_result json;
BEGIN
  FOR v_rec IN
    SELECT id FROM pipeline.pipeline_properties
    WHERE folder_id = p_folder_id
      AND status NOT IN ('published', 'archived')
      AND (p_property_ids IS NULL OR id = ANY(p_property_ids))
    ORDER BY folder_serial
  LOOP
    -- Call the existing pipeline_publish RPC for each property
    SELECT result INTO v_result
    FROM public.pipeline_publish(v_rec.id, NULL);

    IF (v_result->>'ok')::boolean THEN
      v_pub_count := v_pub_count + 1;
    ELSE
      v_fail_count := v_fail_count + 1;
      v_errors := array_append(v_errors, v_rec.id || ': ' || COALESCE(v_result->>'error', 'unknown'));
    END IF;
  END LOOP;

  RETURN json_build_object(
    'ok', true,
    'published', v_pub_count,
    'failed', v_fail_count,
    'errors', to_json(v_errors)
  );
END;
$$;


ALTER FUNCTION "public"."pipeline_folder_publish"("p_folder_id" "uuid", "p_property_ids" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pipeline_folder_remove_property"("p_property_id" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pipeline'
    AS $$
BEGIN
  UPDATE pipeline.pipeline_properties
  SET folder_id = NULL,
      folder_serial = NULL,
      updated_at = now()
  WHERE id = p_property_id;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Property not found');
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;


ALTER FUNCTION "public"."pipeline_folder_remove_property"("p_property_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pipeline_folder_rename"("p_folder_id" "uuid", "p_new_name" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pipeline'
    AS $$
BEGIN
  p_new_name := initcap(trim(regexp_replace(p_new_name, '\s+', ' ', 'g')));
  IF p_new_name = '' THEN
    RETURN json_build_object('ok', false, 'error', 'Folder name is required');
  END IF;

  UPDATE pipeline.pipeline_folders
  SET name = p_new_name, updated_at = now()
  WHERE id = p_folder_id;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Folder not found');
  END IF;

  RETURN json_build_object('ok', true, 'name', p_new_name);
END;
$$;


ALTER FUNCTION "public"."pipeline_folder_rename"("p_folder_id" "uuid", "p_new_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pipeline_folder_rename"("p_folder_id" "uuid", "p_new_name" "text", "p_color" "text" DEFAULT NULL::"text", "p_icon" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pipeline'
    AS $$
BEGIN
  p_new_name := initcap(trim(regexp_replace(p_new_name, '\s+', ' ', 'g')));
  IF p_new_name = '' THEN
    RETURN json_build_object('ok', false, 'error', 'Folder name is required');
  END IF;

  UPDATE pipeline.pipeline_folders
  SET name = p_new_name,
      color = COALESCE(p_color, color),
      icon = COALESCE(p_icon, icon),
      updated_at = now()
  WHERE id = p_folder_id;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Folder not found');
  END IF;

  RETURN json_build_object('ok', true, 'name', p_new_name);
END;
$$;


ALTER FUNCTION "public"."pipeline_folder_rename"("p_folder_id" "uuid", "p_new_name" "text", "p_color" "text", "p_icon" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pipeline_folder_stats"("p_folder_name" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pipeline'
    AS $$
DECLARE result json;
BEGIN
  SELECT json_build_object(
    'name', f.name,
    'description', f.description,
    'total', COUNT(p.id),
    'published', COUNT(p.id) FILTER (WHERE p.status = 'published'),
    'scraped', COUNT(p.id) FILTER (WHERE p.status = 'scraped'),
    'edited', COUNT(p.id) FILTER (WHERE p.status = 'edited'),
    'archived', COUNT(p.id) FILTER (WHERE p.status = 'archived'),
    'properties', COALESCE(json_agg(json_build_object(
      'serial', p.folder_serial,
      'id', p.id,
      'address', p.address,
      'city', p.city,
      'rent', p.monthly_rent,
      'status', p.status
    ) ORDER BY p.folder_serial), '[]'::json)
  )
  INTO result
  FROM pipeline.pipeline_folders f
  LEFT JOIN pipeline.pipeline_properties p ON p.folder_id = f.id
  WHERE f.name = initcap(trim(regexp_replace(p_folder_name, '\s+', ' ', 'g')))
  GROUP BY f.name, f.description;

  IF result IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Folder not found: ' || p_folder_name);
  END IF;

  RETURN json_build_object('ok', true, 'folder', result);
END;
$$;


ALTER FUNCTION "public"."pipeline_folder_stats"("p_folder_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pipeline_list"("p_status" "text" DEFAULT 'scraped'::"text", "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pipeline'
    AS $$
DECLARE result json;
BEGIN
  SELECT json_agg(row_to_json(t))
  INTO result
  FROM (
    SELECT
      p.id, p.status, p.title, p.address, p.city, p.state, p.zip,
      p.bedrooms, p.bathrooms, p.square_footage, p.monthly_rent,
      p.property_type, p.year_built, p.unit_number,
      p.description, p.original_description, p.showing_instructions,
      p.pets_allowed, p.smoking_allowed, p.parking,
      p.minimum_lease_months, p.security_deposit, p.application_fee,
      p.garage_spaces, p.available_date, p.virtual_tour_url,
      p.has_basement, p.has_central_air,
      p.data_quality_score, p.missing_fields, p.edited_fields,
      p.original_image_urls, p.source_url, p.source, p.agent_name,
      p.broker_name, p.agent_image_url, p.agent_profile_url,
      p.poster_landlord_id, p.choice_property_id,
      p.source_type, p.identity_strategy, p.identity_status,
      p.source_profile_id, p.source_profile_type, p.source_profile_name,
      p.source_profile_image_url, p.source_profile_url,
      p.scraped_at, p.updated_at, p.published_at,
      p.neighborhood, p.county, p.location_context,
      p.listed_at, p.source_last_updated_at, p.imported_at,
      p.source_status, p.last_verified_at, p.lat, p.lng
    FROM pipeline.pipeline_properties p
    WHERE (p_status = 'all' OR p.status = p_status)
    ORDER BY COALESCE(p.listed_at, p.imported_at, p.scraped_at::timestamptz) DESC NULLS LAST
    LIMIT p_limit OFFSET p_offset
  ) t;
  RETURN COALESCE(result, '[]'::json);
END;
$$;


ALTER FUNCTION "public"."pipeline_list"("p_status" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pipeline_patch_staged"("p_id" "text", "p_monthly_rent" integer, "p_security_deposit" integer, "p_description" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pipeline'
    AS $$
BEGIN
  UPDATE pipeline.pipeline_properties
  SET
    monthly_rent     = p_monthly_rent,
    security_deposit = p_security_deposit,
    description      = p_description,
    application_fee  = 50,
    updated_at       = now()
  WHERE id = p_id;
END;
$$;


ALTER FUNCTION "public"."pipeline_patch_staged"("p_id" "text", "p_monthly_rent" integer, "p_security_deposit" integer, "p_description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pipeline_photo_gallery"("p_id" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pipeline'
    AS $$
DECLARE result json;
BEGIN
  SELECT json_build_object(
    'id', p.id,
    'title', p.title,
    'address', p.address,
    'city', p.city,
    'state', p.state,
    'zip', p.zip,
    'monthly_rent', p.monthly_rent,
    'bedrooms', p.bedrooms,
    'bathrooms', p.bathrooms,
    'square_footage', p.square_footage,
    'property_type', p.property_type,
    'description', p.description,
    'photos', COALESCE(p.original_image_urls::json, '[]'::json),
    'photo_import_status', p.photo_import_status,
    'source', p.source,
    'source_url', p.source_url
  )
  INTO result
  FROM pipeline.pipeline_properties p
  WHERE p.id = p_id;

  IF result IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Property not found');
  END IF;

  RETURN json_build_object('ok', true, 'property', result);
END;
$$;


ALTER FUNCTION "public"."pipeline_photo_gallery"("p_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pipeline_publish"("p_id" "text", "p_landlord_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pipeline'
    AS $_$
DECLARE
  p pipeline.pipeline_properties%ROWTYPE;
  new_id text;
  v_avail date;
  v_listed date;
  v_imported_at timestamptz;
BEGIN
  SELECT * INTO p FROM pipeline.pipeline_properties WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Listing not found in pipeline');
  END IF;

  IF p.title IS NULL OR p.address IS NULL OR p.city IS NULL
     OR p.state IS NULL OR p.zip IS NULL OR p.monthly_rent IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Missing required fields: title, address, city, state, zip, monthly_rent');
  END IF;

  new_id := gen_random_uuid()::text;
  v_avail := CASE WHEN p.available_date IS NOT NULL
    AND p.available_date ~ '^\d{4}-\d{2}-\d{2}$'
    THEN p.available_date::date ELSE CURRENT_DATE END;
  v_listed := COALESCE(p.listed_at::date, p.scraped_at::date, CURRENT_DATE);
  v_imported_at := COALESCE(p.imported_at, p.scraped_at::timestamptz, now());

  INSERT INTO public.properties (
    id, landlord_id, status,
    title, description, showing_instructions,
    address, city, state, zip, county, neighborhood,
    lat, lng, property_type, year_built, floors,
    unit_number, total_units,
    bedrooms, bathrooms, half_bathrooms, square_footage,
    lot_size_sqft, garage_spaces,
    monthly_rent, security_deposit, last_months_rent,
    application_fee, pet_deposit, admin_fee, move_in_special,
    available_date, minimum_lease_months, lease_terms,
    pets_allowed, pet_details, pet_weight_limit, smoking_allowed,
    parking, parking_fee,
    amenities, appliances, utilities_included,
    heating_type, cooling_type, laundry_type,
    location_context, virtual_tour_url, has_basement, has_central_air,
    listed_at, source_last_updated_at, imported_at, source_status, last_verified_at,
    source, source_url, source_listing_id,
    source_type, identity_strategy, identity_status, source_profile_id,
    source_profile_type, source_profile_name, source_profile_image_url,
    source_profile_url, agent_name, agent_image_url, agent_profile_url
  ) VALUES (
    new_id, COALESCE(p_landlord_id, p.poster_landlord_id::uuid), 'active',
    p.title, p.description, p.showing_instructions,
    p.address, p.city, p.state, p.zip, p.county, p.neighborhood,
    p.lat, p.lng, p.property_type, p.year_built, p.floors,
    p.unit_number, p.total_units,
    p.bedrooms, p.bathrooms, p.half_bathrooms, p.square_footage,
    p.lot_size_sqft, p.garage_spaces,
    p.monthly_rent, COALESCE(p.security_deposit, p.monthly_rent), p.last_months_rent,
    50, p.pet_deposit, p.admin_fee, p.move_in_special,
    v_avail, NULL, NULL,
    true, p.pet_details, p.pet_weight_limit, false,
    p.parking, p.parking_fee,
    CASE WHEN p.amenities IS NOT NULL AND p.amenities NOT IN ('', '[]')
      THEN p.amenities::jsonb ELSE NULL END,
    CASE WHEN p.appliances IS NOT NULL AND p.appliances NOT IN ('', '[]')
      THEN p.appliances::jsonb ELSE NULL END,
    CASE WHEN p.utilities_included IS NOT NULL AND p.utilities_included NOT IN ('', '[]')
      THEN p.utilities_included::jsonb ELSE NULL END,
    p.heating_type, p.cooling_type, p.laundry_type,
    p.location_context, p.virtual_tour_url, COALESCE(p.has_basement, false),
    COALESCE(p.has_central_air, false),
    v_listed, p.source_last_updated_at, v_imported_at,
    COALESCE(p.source_status, 'available'), p.last_verified_at,
    p.source, p.source_url, p.source_listing_id,
    p.source_type, p.identity_strategy, p.identity_status, p.source_profile_id,
    p.source_profile_type, p.source_profile_name, p.source_profile_image_url,
    p.source_profile_url, p.agent_name, p.agent_image_url, p.agent_profile_url
  );

  UPDATE pipeline.pipeline_properties
  SET status = 'published',
      choice_property_id = new_id,
      imported_at = COALESCE(imported_at, now()),
      published_at = now()::text,
      updated_at = now()
  WHERE id = p_id;

  RETURN json_build_object('ok', true, 'choice_property_id', new_id);
END;
$_$;


ALTER FUNCTION "public"."pipeline_publish"("p_id" "text", "p_landlord_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pipeline_publish_and_delete"("p_id" "text", "p_landlord_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pipeline'
    AS $$
DECLARE
  v_res json;
BEGIN
  v_res := public.pipeline_publish(p_id, p_landlord_id);
  IF (v_res->>'ok')::boolean = true THEN
    DELETE FROM pipeline.pipeline_properties WHERE id = p_id;
  END IF;
  RETURN v_res;
END;
$$;


ALTER FUNCTION "public"."pipeline_publish_and_delete"("p_id" "text", "p_landlord_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pipeline_restore"("p_payload" "jsonb") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pipeline'
    AS $$
DECLARE
  v_id text;
BEGIN
  v_id = p_payload->>'id';
  IF v_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Missing id');
  END IF;

  INSERT INTO pipeline.pipeline_properties (
    id, status, title, address, city, state, zip,
    bedrooms, bathrooms, square_footage, monthly_rent,
    property_type, year_built, unit_number,
    description, showing_instructions,
    pets_allowed, smoking_allowed, parking,
    minimum_lease_months, security_deposit, application_fee,
    garage_spaces, available_date, virtual_tour_url,
    has_basement, has_central_air,
    data_quality_score, missing_fields, edited_fields,
    original_image_urls, source_url, source, agent_name,
    poster_landlord_id, choice_property_id,
    scraped_at, updated_at, published_at,
    neighborhood, county, location_context
  ) VALUES (
    v_id,
    COALESCE(p_payload->>'status', 'scraped'),
    p_payload->>'title', p_payload->>'address', p_payload->>'city', p_payload->>'state', p_payload->>'zip',
    (p_payload->>'bedrooms')::int, (p_payload->>'bathrooms')::float, (p_payload->>'square_footage')::int, (p_payload->>'monthly_rent')::int,
    p_payload->>'property_type', (p_payload->>'year_built')::int, p_payload->>'unit_number',
    p_payload->>'description', p_payload->>'showing_instructions',
    (p_payload->>'pets_allowed')::boolean, (p_payload->>'smoking_allowed')::boolean, p_payload->>'parking',
    (p_payload->>'minimum_lease_months')::int, (p_payload->>'security_deposit')::int, (p_payload->>'application_fee')::int,
    (p_payload->>'garage_spaces')::int, p_payload->>'available_date', p_payload->>'virtual_tour_url',
    (p_payload->>'has_basement')::boolean, (p_payload->>'has_central_air')::boolean,
    COALESCE((p_payload->>'data_quality_score')::int, 0), p_payload->>'missing_fields', p_payload->>'edited_fields',
    p_payload->>'original_image_urls', p_payload->>'source_url', p_payload->>'source', p_payload->>'agent_name',
    p_payload->>'poster_landlord_id', NULL,
    COALESCE(p_payload->>'scraped_at', now()::text), now()::text, NULL,
    p_payload->>'neighborhood', p_payload->>'county', p_payload->>'location_context'
  )
  ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    updated_at = now();

  RETURN json_build_object('ok', true, 'id', v_id);
END;
$$;


ALTER FUNCTION "public"."pipeline_restore"("p_payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pipeline_save"("p_id" "text", "p_patch" "jsonb") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pipeline'
    AS $$
DECLARE
  v_existing pipeline.pipeline_properties%ROWTYPE;
  v_edited   text;
BEGIN
  SELECT * INTO v_existing FROM pipeline.pipeline_properties WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Not found');
  END IF;

  SELECT array_to_json(array_agg(DISTINCT e))::text
  INTO v_edited
  FROM (
    SELECT jsonb_array_elements_text(COALESCE(v_existing.edited_fields::jsonb, '[]'::jsonb)) AS e
    UNION
    SELECT key FROM jsonb_each_text(p_patch)
  ) t(e);

  UPDATE pipeline.pipeline_properties SET
    title                = COALESCE(p_patch->>'title',                title),
    address              = COALESCE(p_patch->>'address',              address),
    city                 = COALESCE(p_patch->>'city',                 city),
    state                = COALESCE(p_patch->>'state',                state),
    zip                  = COALESCE(p_patch->>'zip',                  zip),
    county               = COALESCE(p_patch->>'county',               county),
    neighborhood         = COALESCE(p_patch->>'neighborhood',         neighborhood),
    bedrooms             = COALESCE((p_patch->>'bedrooms')::int,      bedrooms),
    bathrooms            = COALESCE((p_patch->>'bathrooms')::float,   bathrooms),
    square_footage       = COALESCE((p_patch->>'square_footage')::int,square_footage),
    monthly_rent         = COALESCE((p_patch->>'monthly_rent')::int,  monthly_rent),
    security_deposit     = COALESCE((p_patch->>'security_deposit')::int, security_deposit),
    application_fee      = COALESCE((p_patch->>'application_fee')::int,  application_fee),
    property_type        = COALESCE(p_patch->>'property_type',        property_type),
    description          = COALESCE(p_patch->>'description',          description),
    original_description = COALESCE(p_patch->>'original_description', original_description),
    showing_instructions = COALESCE(p_patch->>'showing_instructions', showing_instructions),
    move_in_special      = COALESCE(p_patch->>'move_in_special',      move_in_special),
    available_date       = COALESCE(p_patch->>'available_date',       available_date),
    pets_allowed         = COALESCE((p_patch->>'pets_allowed')::boolean,   pets_allowed),
    smoking_allowed      = COALESCE((p_patch->>'smoking_allowed')::boolean,smoking_allowed),
    minimum_lease_months = COALESCE((p_patch->>'minimum_lease_months')::int, minimum_lease_months),
    garage_spaces        = COALESCE((p_patch->>'garage_spaces')::int, garage_spaces),
    virtual_tour_url     = COALESCE(p_patch->>'virtual_tour_url',     virtual_tour_url),
    has_basement         = COALESCE((p_patch->>'has_basement')::boolean,   has_basement),
    has_central_air      = COALESCE((p_patch->>'has_central_air')::boolean,has_central_air),
    poster_landlord_id   = COALESCE(p_patch->>'poster_landlord_id',   poster_landlord_id),
    location_context     = COALESCE(p_patch->>'location_context',     location_context),
    edited_fields        = COALESCE(v_edited, '[]'),
    status               = CASE WHEN status = 'scraped' THEN 'edited' ELSE status END,
    updated_at           = now()
  WHERE id = p_id;

  RETURN json_build_object('ok', true);
END;
$$;


ALTER FUNCTION "public"."pipeline_save"("p_id" "text", "p_patch" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pipeline_stage_batch"("p_records" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pipeline'
    AS $$
DECLARE
  rec         jsonb;
  result_rows jsonb := '[]'::jsonb;
  new_id      text;
  existing_id text;
BEGIN
  FOR rec IN SELECT * FROM jsonb_array_elements(p_records)
  LOOP
    -- Check if a record with this source_listing_id already exists
    SELECT id INTO existing_id
    FROM pipeline.pipeline_properties
    WHERE source_listing_id = (rec->>'source_listing_id')
    LIMIT 1;

    IF existing_id IS NOT NULL THEN
      result_rows := result_rows || jsonb_build_object(
        'source_listing_id', rec->>'source_listing_id',
        'id', existing_id
      );
    ELSE
      -- Generate a new text ID (UUID format, matching existing row IDs)
      new_id := gen_random_uuid()::text;

      INSERT INTO pipeline.pipeline_properties (
        id,
        source,
        source_listing_id,
        source_url,
        source_status,
        status,
        title,
        address,
        unit_number,
        city,
        state,
        zip,
        county,
        neighborhood,
        location_context,
        lat,
        lng,
        bedrooms,
        bathrooms,
        half_bathrooms,
        square_footage,
        year_built,
        property_type,
        monthly_rent,
        security_deposit,
        application_fee,
        description,
        showing_instructions,
        available_date,
        parking,
        garage_spaces,
        pets_allowed,
        smoking_allowed,
        minimum_lease_months,
        move_in_special,
        amenities,
        appliances,
        heating_type,
        cooling_type,
        laundry_type,
        has_basement,
        has_central_air,
        virtual_tour_url,
        original_image_urls,
        data_quality_score,
        missing_fields,
        agent_name,
        poster_landlord_id,
        scraped_at,
        updated_at
      )
      VALUES (
        new_id,
        COALESCE(rec->>'source', 'homeharvest'),
        rec->>'source_listing_id',
        rec->>'source_url',
        COALESCE(rec->>'source_status', 'available'),
        COALESCE(rec->>'status', 'scraped'),
        rec->>'title',
        rec->>'address',
        rec->>'unit_number',
        rec->>'city',
        rec->>'state',
        rec->>'zip',
        rec->>'county',
        rec->>'neighborhood',
        rec->>'location_context',
        NULLIF(rec->>'lat',  '')::double precision,
        NULLIF(rec->>'lng', '')::double precision,
        NULLIF(rec->>'bedrooms',  '')::int,
        NULLIF(rec->>'bathrooms', '')::double precision,
        NULLIF(rec->>'half_bathrooms', '')::int,
        NULLIF(rec->>'square_footage', '')::int,
        NULLIF(rec->>'year_built', '')::int,
        rec->>'property_type',
        NULLIF(rec->>'monthly_rent', '')::int,
        NULLIF(rec->>'security_deposit', '')::int,
        COALESCE(NULLIF(rec->>'application_fee', '')::int, 50),
        rec->>'description',
        rec->>'showing_instructions',
        rec->>'available_date',
        rec->>'parking',
        NULLIF(rec->>'garage_spaces', '')::int,
        NULLIF(rec->>'pets_allowed', '')::boolean,
        NULLIF(rec->>'smoking_allowed', '')::boolean,
        NULLIF(rec->>'minimum_lease_months', '')::int,
        rec->>'move_in_special',
        -- amenities/appliances stored as text (JSON string or comma list)
        CASE WHEN rec->'amenities' IS NOT NULL AND jsonb_typeof(rec->'amenities') = 'array'
             THEN rec->>'amenities'
             ELSE rec->>'amenities' END,
        CASE WHEN rec->'appliances' IS NOT NULL AND jsonb_typeof(rec->'appliances') = 'array'
             THEN rec->>'appliances'
             ELSE rec->>'appliances' END,
        rec->>'heating_type',
        rec->>'cooling_type',
        COALESCE(rec->>'laundry_type', rec->>'laundry'),
        NULLIF(rec->>'has_basement', '')::boolean,
        NULLIF(rec->>'has_central_air', '')::boolean,
        rec->>'virtual_tour_url',
        -- original_image_urls: accept list or JSON string
        CASE WHEN rec->'original_image_urls' IS NOT NULL
                  AND jsonb_typeof(rec->'original_image_urls') = 'array'
             THEN rec->>'original_image_urls'
             ELSE rec->>'original_image_urls' END,
        NULLIF(rec->>'data_quality_score', '')::int,
        rec->>'missing_fields',
        rec->>'agent_name',
        rec->>'poster_landlord_id',
        COALESCE(NULLIF(rec->>'scraped_at', '')::timestamptz, now()),
        now()
      );

      result_rows := result_rows || jsonb_build_object(
        'source_listing_id', rec->>'source_listing_id',
        'id', new_id
      );
    END IF;
  END LOOP;

  RETURN result_rows;
END;
$$;


ALTER FUNCTION "public"."pipeline_stage_batch"("p_records" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pipeline_stats"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pipeline'
    AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'scraped',   COALESCE(SUM(CASE WHEN status = 'scraped'   THEN 1 ELSE 0 END), 0),
    'edited',    COALESCE(SUM(CASE WHEN status = 'edited'    THEN 1 ELSE 0 END), 0),
    'published', COALESCE(SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END), 0),
    'archived',  COALESCE(SUM(CASE WHEN status = 'archived'  THEN 1 ELSE 0 END), 0),
    'total',     COUNT(*)
  ) INTO result
  FROM pipeline.pipeline_properties;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."pipeline_stats"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."pipeline_stats"() IS 'Returns scrape pipeline property counts grouped by status. SECURITY DEFINER — accesses private pipeline schema. Admin dashboard only.';



CREATE OR REPLACE FUNCTION "public"."pipeline_unarchive"("p_id" "text", "p_status" "text" DEFAULT 'scraped'::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pipeline'
    AS $$
BEGIN
  UPDATE pipeline.pipeline_properties
  SET status = p_status, updated_at = now()
  WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Not found');
  END IF;
  RETURN json_build_object('ok', true);
END;
$$;


ALTER FUNCTION "public"."pipeline_unarchive"("p_id" "text", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pipeline_unpublish"("p_id" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pipeline'
    AS $$
BEGIN
  UPDATE pipeline.pipeline_properties
  SET status = 'edited',
      choice_property_id = NULL,
      published_at = NULL,
      updated_at = now()
  WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Not found');
  END IF;
  RETURN json_build_object('ok', true);
END;
$$;


ALTER FUNCTION "public"."pipeline_unpublish"("p_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."property_mark_verified"("p_property_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_now TIMESTAMPTZ := NOW();
BEGIN
  UPDATE public.properties
  SET last_verified_at = v_now,
      updated_at       = v_now
  WHERE id = p_property_id;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Property not found');
  END IF;

  RETURN json_build_object('ok', true, 'last_verified_at', v_now);
END;
$$;


ALTER FUNCTION "public"."property_mark_verified"("p_property_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."property_photos_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."property_photos_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."publish_lease_template"("p_template_id" "uuid", "p_name" "text", "p_template_body" "text", "p_variables" "jsonb" DEFAULT '{}'::"jsonb", "p_notes" "text" DEFAULT NULL::"text", "p_make_active" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor   TEXT := COALESCE(auth.jwt()->>'email', 'system');
  v_is_admin BOOLEAN;
  v_next    INT;
  v_version_id UUID;
  v_template_id UUID := p_template_id;
BEGIN
  SELECT is_admin() INTO v_is_admin;
  IF NOT COALESCE(v_is_admin, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  IF p_template_body IS NULL OR btrim(p_template_body) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Template body is required');
  END IF;

  -- Upsert the editable template row
  IF v_template_id IS NULL THEN
    INSERT INTO lease_templates (name, is_active, template_body, variables, notes, created_by)
    VALUES (COALESCE(p_name,'Untitled Template'), p_make_active, p_template_body,
            COALESCE(p_variables, '{}'::jsonb), p_notes, v_actor)
    RETURNING id INTO v_template_id;
  ELSE
    UPDATE lease_templates SET
      name          = COALESCE(p_name, name),
      template_body = p_template_body,
      variables     = COALESCE(p_variables, variables),
      notes         = COALESCE(p_notes, notes),
      is_active     = COALESCE(p_make_active, is_active),
      updated_at    = now()
    WHERE id = v_template_id;
  END IF;

  -- Compute next version number for this template
  SELECT COALESCE(MAX(version_number), 0) + 1
    INTO v_next
    FROM lease_template_versions
   WHERE template_id = v_template_id;

  INSERT INTO lease_template_versions (
    template_id, version_number, name, template_body, variables, notes, published_by
  )
  SELECT v_template_id, v_next, t.name, t.template_body, t.variables, t.notes, v_actor
    FROM lease_templates t WHERE t.id = v_template_id
  RETURNING id INTO v_version_id;

  RETURN jsonb_build_object(
    'success',         true,
    'template_id',     v_template_id,
    'version_id',      v_version_id,
    'version_number',  v_next
  );
END;
$$;


ALTER FUNCTION "public"."publish_lease_template"("p_template_id" "uuid", "p_name" "text", "p_template_body" "text", "p_variables" "jsonb", "p_notes" "text", "p_make_active" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purge_old_logs"() RETURNS TABLE("table_name" "text", "rows_deleted" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  n bigint;
BEGIN
  DELETE FROM rate_limit_log WHERE created_at < now() - interval '7 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  table_name := 'rate_limit_log'; rows_deleted := n; RETURN NEXT;

  DELETE FROM bot_attempts WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  table_name := 'bot_attempts'; rows_deleted := n; RETURN NEXT;

  -- Drafts older than 30 days (well past the 7-day resume window)
  DELETE FROM draft_applications WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  table_name := 'draft_applications'; rows_deleted := n; RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."purge_old_logs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purge_orphaned_lease_pdfs"("p_dry_run" boolean DEFAULT true) RETURNS TABLE("storage_path" "text", "bytes" bigint, "created_at" timestamp with time zone, "action" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'storage', 'pg_temp'
    AS $$
declare
  v_orphan record;
begin
  for v_orphan in
    select
      o.id,
      o.name as storage_path,
      coalesce((o.metadata->>'size')::bigint, 0) as bytes,
      o.created_at
    from storage.objects o
    where o.bucket_id = 'lease-pdfs'
      and not exists (
        select 1
        from public.lease_pdf_versions v
        where v.storage_path = o.name
      )
    order by o.created_at asc
  loop
    storage_path := v_orphan.storage_path;
    bytes        := v_orphan.bytes;
    created_at   := v_orphan.created_at;

    if p_dry_run then
      action := 'would_delete';
    else
      delete from storage.objects where id = v_orphan.id;
      action := 'deleted';
    end if;

    return next;
  end loop;

  return;
end;
$$;


ALTER FUNCTION "public"."purge_orphaned_lease_pdfs"("p_dry_run" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."purge_orphaned_lease_pdfs"("p_dry_run" boolean) IS 'Phase 14: list (dry-run) or delete lease-pdfs storage objects with no matching lease_pdf_versions row. Service-role / admin only.';



CREATE OR REPLACE FUNCTION "public"."purge_resolved_agent_issues"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH d AS (
    DELETE FROM public.agent_issues
    WHERE status = 'resolved'
      AND resolved_at IS NOT NULL
      AND resolved_at < now() - interval '30 days'
    RETURNING 1
  )
  SELECT count(*) INTO deleted_count FROM d;
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."purge_resolved_agent_issues"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_lease_pdf_integrity"("p_app_id" "text", "p_version_number" integer, "p_sha256" "text", "p_certificate_appended" boolean DEFAULT false, "p_qr_verify_token" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
DECLARE
  v_id UUID;
BEGIN
  IF p_sha256 IS NULL OR p_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'PDF_INTEGRITY_BAD_HASH'
      USING DETAIL = 'sha256 must be a 64-character lowercase hex string';
  END IF;

  -- Optional: reject already-seen tokens (UNIQUE index will also catch this).
  IF p_qr_verify_token IS NOT NULL THEN
    IF length(p_qr_verify_token) < 16 OR length(p_qr_verify_token) > 64 THEN
      RAISE EXCEPTION 'PDF_INTEGRITY_BAD_TOKEN'
        USING DETAIL = 'qr_verify_token must be 16-64 chars';
    END IF;
  END IF;

  UPDATE public.lease_pdf_versions
     SET sha256                = p_sha256,
         certificate_appended  = COALESCE(p_certificate_appended, false),
         qr_verify_token       = COALESCE(p_qr_verify_token, qr_verify_token)
   WHERE app_id          = p_app_id
     AND version_number  = p_version_number
   RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'PDF_INTEGRITY_NOT_FOUND'
      USING DETAIL = format('No lease_pdf_versions row for app_id=%s version=%s',
                            p_app_id, p_version_number);
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$_$;


ALTER FUNCTION "public"."record_lease_pdf_integrity"("p_app_id" "text", "p_version_number" integer, "p_sha256" "text", "p_certificate_appended" boolean, "p_qr_verify_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_lease_pdf_version"("p_app_id" "text", "p_event" "text", "p_storage_path" "text", "p_size_bytes" integer DEFAULT NULL::integer, "p_template_version_id" "uuid" DEFAULT NULL::"uuid", "p_amendment_id" "uuid" DEFAULT NULL::"uuid", "p_created_by" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_next INT;
  v_id   UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM applications WHERE app_id = p_app_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Application not found');
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next
    FROM lease_pdf_versions WHERE app_id = p_app_id;

  INSERT INTO lease_pdf_versions (
    app_id, version_number, event, storage_path, size_bytes,
    template_version_id, amendment_id, created_by
  ) VALUES (
    p_app_id, v_next, p_event, p_storage_path, p_size_bytes,
    p_template_version_id, p_amendment_id, p_created_by
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'success',        true,
    'id',             v_id,
    'version_number', v_next
  );
END;
$$;


ALTER FUNCTION "public"."record_lease_pdf_version"("p_app_id" "text", "p_event" "text", "p_storage_path" "text", "p_size_bytes" integer, "p_template_version_id" "uuid", "p_amendment_id" "uuid", "p_created_by" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."register_signing_token"("p_token" "text", "p_app_id" "text", "p_role" "text", "p_email" "text", "p_amendment_id" "uuid" DEFAULT NULL::"uuid", "p_ttl_days" integer DEFAULT 30) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.lease_signing_tokens (
    token, app_id, signer_role, signer_email, amendment_id, created_at, expires_at
  ) VALUES (
    p_token, p_app_id, p_role, COALESCE(p_email, ''), p_amendment_id,
    now(), now() + make_interval(days => p_ttl_days)
  )
  ON CONFLICT (token) DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."register_signing_token"("p_token" "text", "p_app_id" "text", "p_role" "text", "p_email" "text", "p_amendment_id" "uuid", "p_ttl_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reissue_signing_token"("p_app_id" "text", "p_role" "text", "p_by" "text", "p_amendment_id" "uuid" DEFAULT NULL::"uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  v_email TEXT;
  v_new   TEXT;
BEGIN
  IF p_role NOT IN ('tenant','co_applicant','amendment') THEN
    RAISE EXCEPTION 'Invalid signer role: %', p_role;
  END IF;

  IF p_role = 'tenant' THEN
    SELECT email INTO v_email FROM public.applications WHERE app_id = p_app_id;
  ELSIF p_role = 'co_applicant' THEN
    SELECT ca.email INTO v_email FROM public.co_applicants ca WHERE ca.app_id = p_app_id LIMIT 1;
  ELSE
    SELECT a.email INTO v_email FROM public.applications a WHERE a.app_id = p_app_id;
  END IF;

  -- Revoke any active tokens for the same (app_id, role[, amendment_id])
  UPDATE public.lease_signing_tokens
     SET revoked_at    = now(),
         revoked_by    = p_by,
         revoke_reason = 'reissued'
   WHERE app_id      = p_app_id
     AND signer_role = p_role
     AND COALESCE(amendment_id::text, '') = COALESCE(p_amendment_id::text, '')
     AND used_at    IS NULL
     AND revoked_at IS NULL;

  -- Mint new
  v_new := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO public.lease_signing_tokens (token, app_id, signer_role, signer_email, amendment_id)
  VALUES (v_new, p_app_id, p_role, COALESCE(v_email, ''), p_amendment_id);

  -- Replace the live token column
  IF p_role = 'tenant' THEN
    UPDATE public.applications
       SET tenant_sign_token = v_new,
           lease_sent_date   = COALESCE(lease_sent_date, now()),
           updated_at        = now()
     WHERE app_id = p_app_id;
  ELSIF p_role = 'co_applicant' THEN
    UPDATE public.applications
       SET co_applicant_lease_token = v_new,
           updated_at               = now()
     WHERE app_id = p_app_id;
  ELSE
    UPDATE public.lease_amendments
       SET signing_token = v_new,
           sent_at       = COALESCE(sent_at, now()),
           updated_at    = now()
     WHERE id = p_amendment_id;
  END IF;

  RETURN v_new;
END;
$$;


ALTER FUNCTION "public"."reissue_signing_token"("p_app_id" "text", "p_role" "text", "p_by" "text", "p_amendment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reorder_property_photos"("p_property_id" "text", "p_file_ids" "text"[]) RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_owner           BOOLEAN;
  v_admin           BOOLEAN := is_admin();
  v_is_service_role BOOLEAN;
  v_count           INT     := 0;
  v_id              TEXT;
  v_order           INT     := 0;
BEGIN
  IF p_property_id IS NULL OR p_file_ids IS NULL THEN
    RAISE EXCEPTION 'property_id and file_ids are required';
  END IF;

  v_is_service_role := (auth.uid() IS NULL AND current_role = 'service_role');

  IF NOT v_is_service_role THEN
    SELECT EXISTS (
      SELECT 1
        FROM properties p
        JOIN landlords  l ON l.id = p.landlord_id
       WHERE p.id = p_property_id
         AND l.user_id = auth.uid()
    ) INTO v_owner;

    IF NOT (v_owner OR v_admin) THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
  END IF;

  FOREACH v_id IN ARRAY p_file_ids LOOP
    UPDATE property_photos
       SET display_order = v_order,
           is_hero       = (v_order = 0)
     WHERE property_id = p_property_id
       AND file_id     = v_id;
    IF FOUND THEN v_count := v_count + 1; END IF;
    v_order := v_order + 1;
  END LOOP;

  WITH tail AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY display_order) - 1 + v_order AS new_order
      FROM property_photos
     WHERE property_id = p_property_id
       AND (file_id IS NULL OR NOT (file_id = ANY (p_file_ids)))
  )
  UPDATE property_photos pp
     SET display_order = tail.new_order,
         is_hero       = false
    FROM tail
   WHERE pp.id = tail.id;

  RETURN v_count;
END $$;


ALTER FUNCTION "public"."reorder_property_photos"("p_property_id" "text", "p_file_ids" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."report_client_error"("p_fingerprint" "text", "p_message" "text", "p_stack" "text", "p_page_path" "text", "p_user_agent" "text", "p_browser_lang" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_recent_hits INTEGER;
BEGIN
  p_fingerprint  := substr(coalesce(p_fingerprint,  ''), 1, 64);
  p_message      := substr(coalesce(p_message,      ''), 1, 1000);
  p_stack        := substr(coalesce(p_stack,        ''), 1, 4000);
  p_page_path    := substr(coalesce(p_page_path,    ''), 1, 256);
  p_user_agent   := substr(coalesce(p_user_agent,   ''), 1, 256);
  p_browser_lang := substr(coalesce(p_browser_lang, ''), 1, 32);

  IF length(p_fingerprint) = 0 OR length(p_message) = 0 THEN
    RETURN;
  END IF;

  SELECT hit_count INTO v_recent_hits
    FROM public.client_errors
    WHERE fingerprint = p_fingerprint
      AND last_seen_at > NOW() - INTERVAL '1 minute';

  IF v_recent_hits IS NOT NULL AND v_recent_hits > 60 THEN
    RETURN;  -- silently drop runaway errors
  END IF;

  INSERT INTO public.client_errors AS ce
    (fingerprint, message, stack, page_path, user_agent, browser_lang)
  VALUES
    (p_fingerprint, p_message, p_stack, p_page_path, p_user_agent, p_browser_lang)
  ON CONFLICT (fingerprint) DO UPDATE
    SET hit_count    = ce.hit_count + 1,
        last_seen_at = NOW(),
        message      = EXCLUDED.message,
        stack        = EXCLUDED.stack,
        page_path    = EXCLUDED.page_path;
END;
$$;


ALTER FUNCTION "public"."report_client_error"("p_fingerprint" "text", "p_message" "text", "p_stack" "text", "p_page_path" "text", "p_user_agent" "text", "p_browser_lang" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_signing_token"("p_token" "text", "p_by" "text", "p_reason" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE public.lease_signing_tokens
     SET revoked_at    = now(),
         revoked_by    = p_by,
         revoke_reason = p_reason
   WHERE token      = p_token
     AND used_at    IS NULL
     AND revoked_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count = 1 THEN
    UPDATE public.applications     SET tenant_sign_token        = NULL WHERE tenant_sign_token        = p_token;
    UPDATE public.applications     SET co_applicant_lease_token = NULL WHERE co_applicant_lease_token = p_token;
    UPDATE public.lease_amendments SET signing_token            = NULL WHERE signing_token            = p_token;
  END IF;

  RETURN v_count = 1;
END;
$$;


ALTER FUNCTION "public"."revoke_signing_token"("p_token" "text", "p_by" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."scan_watermark_sniper_system"() RETURNS TABLE("property_id" "text", "address" "text", "city" "text", "state" "text", "zip" "text", "status" "text", "flag_reason" "text", "photo_count" bigint, "flagged_photo_count" bigint, "flagged_photo_url" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  WITH flagged_photos AS (
    SELECT 
      ph.property_id,
      count(*) AS f_count,
      min(ph.url) AS sample_url
    FROM public.property_photos ph
    WHERE ph.watermark_status IN ('branding', 'watermark', 'flagged')
    GROUP BY ph.property_id
  ),
  prop_stats AS (
    SELECT 
      ph.property_id,
      count(*) AS total_photos
    FROM public.property_photos ph
    GROUP BY ph.property_id
  )
  SELECT 
    p.id AS property_id,
    p.address,
    p.city,
    p.state,
    p.zip,
    p.status::text,
    'Competitor watermark or branding detected'::text AS flag_reason,
    COALESCE(ps.total_photos, 0) AS photo_count,
    COALESCE(fp.f_count, 0) AS flagged_photo_count,
    fp.sample_url AS flagged_photo_url
  FROM flagged_photos fp
  JOIN public.properties p ON p.id = fp.property_id
  LEFT JOIN prop_stats ps ON ps.property_id = p.id

  UNION ALL

  SELECT 
    p.id AS property_id,
    p.address,
    p.city,
    p.state,
    p.zip,
    p.status::text,
    'Insufficient photos (< 6 photos policy violation)'::text AS flag_reason,
    COALESCE(ps.total_photos, 0) AS photo_count,
    0::bigint AS flagged_photo_count,
    NULL::text AS flagged_photo_url
  FROM public.properties p
  JOIN prop_stats ps ON ps.property_id = p.id
  WHERE ps.total_photos < 6
    AND p.id NOT IN (SELECT fp2.property_id FROM flagged_photos fp2)

  ORDER BY flagged_photo_count DESC, address ASC;
END;
$$;


ALTER FUNCTION "public"."scan_watermark_sniper_system"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sign_lease"("p_app_id" "text", "p_signature" "text", "p_ip" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RAISE NOTICE
    'sign_lease(app_id, signature, ip) is deprecated. '
    'Call the sign-lease Edge Function with a tenant_sign_token instead, '
    'which routes through sign_lease_tenant().';

  RETURN json_build_object(
    'success', false,
    'error',   'sign_lease() has been deprecated. Use the sign-lease Edge Function with a signing token.'
  );
END;
$$;


ALTER FUNCTION "public"."sign_lease"("p_app_id" "text", "p_signature" "text", "p_ip" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sign_lease"("p_app_id" "text", "p_signature" "text", "p_ip" "text") IS 'DEPRECATED. Use sign_lease_tenant(token, signature, ip, ua) via the sign-lease Edge Function.';



CREATE OR REPLACE FUNCTION "public"."sign_lease_amendment"("p_token" "text", "p_signature" "text", "p_ip_address" "text", "p_user_agent" "text", "p_signature_image" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_amend  RECORD;
  v_app    RECORD;
BEGIN
  SELECT * INTO v_amend FROM lease_amendments WHERE signing_token = p_token LIMIT 1;
  IF NOT FOUND THEN
    RETURN '{"success": false, "message": "Invalid or expired amendment link."}'::JSONB;
  END IF;
  IF v_amend.status = 'voided' THEN
    RETURN '{"success": false, "message": "This amendment has been voided."}'::JSONB;
  END IF;
  IF v_amend.tenant_signature IS NOT NULL THEN
    RETURN '{"success": false, "message": "This amendment has already been signed."}'::JSONB;
  END IF;

  UPDATE lease_amendments SET
    tenant_signature       = p_signature,
    tenant_signature_image = p_signature_image,
    signed_at              = now(),
    signer_ip              = p_ip_address,
    signer_user_agent      = p_user_agent,
    status                 = 'signed',
    signing_token          = NULL,
    updated_at             = now()
  WHERE id = v_amend.id;

  SELECT app_id, email INTO v_app FROM applications WHERE app_id = v_amend.app_id LIMIT 1;

  INSERT INTO sign_events (
    app_id, signer_type, signer_name, signer_email,
    ip_address, user_agent, token_used, lease_pdf_path, signature_image
  ) VALUES (
    v_amend.app_id, 'tenant', p_signature, v_app.email,
    p_ip_address, p_user_agent, p_token, v_amend.pdf_path, p_signature_image
  );

  RETURN jsonb_build_object('success', true, 'amendment_id', v_amend.id, 'app_id', v_amend.app_id);
END;
$$;


ALTER FUNCTION "public"."sign_lease_amendment"("p_token" "text", "p_signature" "text", "p_ip_address" "text", "p_user_agent" "text", "p_signature_image" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sign_lease_co_applicant"("p_token" "text", "p_signature" "text", "p_ip_address" "text", "p_user_agent" "text", "p_signature_image" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  app_rec     RECORD;
  v_co_email  TEXT;
  v_unused    public.lease_signing_tokens%ROWTYPE;
  v_consumed  BOOLEAN;
  v_ip        INET;
BEGIN
  BEGIN v_ip := NULLIF(p_ip_address,'')::INET; EXCEPTION WHEN others THEN v_ip := NULL; END;

  v_unused := public.validate_signing_token(p_token, 'co_applicant', v_ip);

  SELECT * INTO app_rec FROM public.applications WHERE co_applicant_lease_token = p_token LIMIT 1;
  IF NOT FOUND THEN
    RETURN '{"success": false, "message": "Invalid or expired signing link."}'::JSONB;
  END IF;
  IF NOT app_rec.has_co_applicant THEN
    RETURN '{"success": false, "message": "No co-applicant on this application."}'::JSONB;
  END IF;
  IF app_rec.co_applicant_signature IS NOT NULL THEN
    RETURN '{"success": false, "message": "Co-applicant has already signed."}'::JSONB;
  END IF;
  IF app_rec.tenant_signature IS NULL THEN
    RETURN '{"success": false, "message": "The primary applicant must sign first."}'::JSONB;
  END IF;

  v_consumed := public.consume_signing_token(p_token, v_ip);
  IF NOT v_consumed THEN
    RETURN '{"success": false, "message": "Signing link is no longer usable. Please request a fresh link."}'::JSONB;
  END IF;

  UPDATE public.applications SET
    co_applicant_signature           = p_signature,
    co_applicant_signature_image     = p_signature_image,
    co_applicant_signature_timestamp = now(),
    co_applicant_lease_token         = NULL,
    lease_ip_address                 = COALESCE(NULLIF(p_ip_address, ''), lease_ip_address),
    lease_status                     = 'co_signed',
    updated_at                       = now()
  WHERE app_id = app_rec.app_id;

  SELECT email INTO v_co_email FROM public.co_applicants WHERE app_id = app_rec.app_id LIMIT 1;

  INSERT INTO public.sign_events (
    app_id, signer_type, signer_name, signer_email,
    ip_address, user_agent, token_used, lease_pdf_path, signature_image
  ) VALUES (
    app_rec.app_id, 'co_applicant', p_signature, v_co_email,
    p_ip_address, p_user_agent, p_token, app_rec.lease_pdf_url, p_signature_image
  );

  RETURN jsonb_build_object('success', true, 'app_id', app_rec.app_id);
END;
$$;


ALTER FUNCTION "public"."sign_lease_co_applicant"("p_token" "text", "p_signature" "text", "p_ip_address" "text", "p_user_agent" "text", "p_signature_image" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sign_lease_co_applicant"("p_token" "text", "p_signature" "text", "p_ip_address" "text", "p_user_agent" "text", "p_signature_image" "text") IS 'Co-applicant lease signing. Called by the sign-lease-co-applicant Edge Function after token + email-identity checks. Sets lease_status = ''co_signed''.';



CREATE OR REPLACE FUNCTION "public"."sign_lease_tenant"("p_token" "text", "p_signature" "text", "p_ip_address" "text", "p_user_agent" "text", "p_signature_image" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  app_rec          RECORD;
  v_unused         public.lease_signing_tokens%ROWTYPE;
  v_consumed       BOOLEAN;
  new_lease_status lease_status;
  v_ip             INET;
BEGIN
  BEGIN v_ip := NULLIF(p_ip_address,'')::INET; EXCEPTION WHEN others THEN v_ip := NULL; END;

  -- Token gating (raises on invalid/expired/revoked/used/wrong-role/IP-mismatch)
  v_unused := public.validate_signing_token(p_token, 'tenant', v_ip);

  SELECT * INTO app_rec FROM public.applications WHERE tenant_sign_token = p_token LIMIT 1;
  IF NOT FOUND THEN
    RETURN '{"success": false, "message": "Invalid or expired signing link."}'::JSONB;
  END IF;
  IF app_rec.tenant_signature IS NOT NULL THEN
    RETURN '{"success": false, "message": "This lease has already been signed."}'::JSONB;
  END IF;
  IF app_rec.lease_status NOT IN ('sent') THEN
    RETURN jsonb_build_object('success', false,
      'message', 'This lease is not in a signable state: ' || app_rec.lease_status);
  END IF;

  v_consumed := public.consume_signing_token(p_token, v_ip);
  IF NOT v_consumed THEN
    RETURN '{"success": false, "message": "Signing link is no longer usable. Please request a fresh link."}'::JSONB;
  END IF;

  IF app_rec.has_co_applicant AND app_rec.co_applicant_lease_token IS NOT NULL THEN
    new_lease_status := 'awaiting_co_sign';
  ELSE
    new_lease_status := 'signed';
  END IF;

  UPDATE public.applications SET
    tenant_signature        = p_signature,
    tenant_signature_image  = p_signature_image,
    signature_timestamp     = now(),
    lease_signed_date       = now(),
    lease_ip_address        = p_ip_address,
    lease_status            = new_lease_status,
    tenant_sign_token       = NULL,
    updated_at              = now()
  WHERE app_id = app_rec.app_id;

  INSERT INTO public.sign_events (
    app_id, signer_type, signer_name, signer_email,
    ip_address, user_agent, token_used, lease_pdf_path, signature_image
  ) VALUES (
    app_rec.app_id, 'tenant', p_signature, app_rec.email,
    p_ip_address, p_user_agent, p_token, app_rec.lease_pdf_url, p_signature_image
  );

  RETURN jsonb_build_object('success', true, 'app_id', app_rec.app_id);
END;
$$;


ALTER FUNCTION "public"."sign_lease_tenant"("p_token" "text", "p_signature" "text", "p_ip_address" "text", "p_user_agent" "text", "p_signature_image" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sign_lease_tenant"("p_token" "text", "p_signature" "text", "p_ip_address" "text", "p_user_agent" "text", "p_signature_image" "text") IS 'Canonical primary-applicant lease signing. Called by the sign-lease Edge Function after token + email-identity checks. Sets lease_status = ''awaiting_co_sign'' when has_co_applicant + co_token present, otherwise ''signed''.';



CREATE OR REPLACE FUNCTION "public"."snapshot_lease_template_for_app"("p_app_id" "text", "p_template_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_template_id UUID := p_template_id;
  v_version     RECORD;
  v_actor       TEXT := COALESCE(auth.jwt()->>'email', 'system');
  v_next        INT;
BEGIN
  -- Resolve template id: explicit param wins, otherwise pick the
  -- most recently updated active template.
  IF v_template_id IS NULL THEN
    SELECT id INTO v_template_id
      FROM lease_templates
     WHERE is_active = true
     ORDER BY updated_at DESC
     LIMIT 1;
  END IF;

  IF v_template_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active lease template configured');
  END IF;

  -- Pick latest published version, or auto-publish v1 if none exists yet
  SELECT * INTO v_version
    FROM lease_template_versions
   WHERE template_id = v_template_id
   ORDER BY version_number DESC
   LIMIT 1;

  IF NOT FOUND THEN
    SELECT COALESCE(MAX(version_number), 0) + 1
      INTO v_next
      FROM lease_template_versions
     WHERE template_id = v_template_id;

    INSERT INTO lease_template_versions (
      template_id, version_number, name, template_body, variables, notes, published_by
    )
    SELECT v_template_id, v_next, t.name, t.template_body, t.variables, t.notes, v_actor
      FROM lease_templates t WHERE t.id = v_template_id
    RETURNING * INTO v_version;
  END IF;

  UPDATE applications
     SET lease_template_version_id = v_version.id,
         updated_at = now()
   WHERE app_id = p_app_id;

  RETURN jsonb_build_object(
    'success',        true,
    'template_id',    v_template_id,
    'version_id',     v_version.id,
    'version_number', v_version.version_number,
    'name',           v_version.name
  );
END;
$$;


ALTER FUNCTION "public"."snapshot_lease_template_for_app"("p_app_id" "text", "p_template_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."state_lease_law_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."state_lease_law_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tenant_portal_state"("p_app_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
DECLARE
  v_email text;
  v_app   record;
  v_amendments jsonb;
BEGIN
  v_email := public.current_confirmed_email();
  IF v_email IS NULL THEN
    -- Caller has not confirmed their email — refuse.
    RETURN NULL;
  END IF;

  -- The portal is reachable by both the primary applicant AND any
  -- co-applicant on the same application, so we check both columns.
  SELECT a.*
    INTO v_app
  FROM public.applications a
  WHERE a.id::text = p_app_id
    AND (
      lower(a.email) = v_email
      OR lower(COALESCE(a.co_applicant_email, '')) = v_email
    )
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id',           la.id,
           'created_at',   la.created_at,
           'effective_at', la.effective_at,
           'reason',       la.reason,
           'status',       la.status,
           'tenant_signed_at', la.tenant_signed_at,
           'landlord_signed_at', la.landlord_signed_at
         ) ORDER BY la.created_at DESC), '[]'::jsonb)
    INTO v_amendments
  FROM public.lease_amendments la
  WHERE la.application_id = v_app.id;

  RETURN jsonb_build_object(
    'application_id',     v_app.id,
    'status',             v_app.status,
    'property_id',        v_app.property_id,
    'lease_executed_at',  v_app.lease_executed_at,
    'amendments',         v_amendments
  );
END
$$;


ALTER FUNCTION "public"."tenant_portal_state"("p_app_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."tenant_portal_state"("p_app_id" "text") IS 'C-3 hardened: requires authenticated AND email_confirmed_at IS NOT NULL before returning any application data.';



CREATE OR REPLACE FUNCTION "public"."tg_amendment_register_token"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_email text;
BEGIN
  -- Only act when signing_token is set to a non-null value.
  IF NEW.signing_token IS NULL THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, only act if the token actually changed (don't re-fire
  -- on every unrelated column update).
  IF TG_OP = 'UPDATE' AND OLD.signing_token IS NOT DISTINCT FROM NEW.signing_token THEN
    RETURN NEW;
  END IF;

  -- Resolve the tenant email from the parent application. If we can't
  -- find one, leave the explicit edge-function call (or reissue RPC)
  -- to handle registration -- a missing application is a different bug.
  SELECT email INTO v_email
    FROM public.applications
   WHERE app_id = NEW.app_id
   LIMIT 1;

  IF v_email IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.lease_signing_tokens (
    token, app_id, signer_role, signer_email, amendment_id,
    created_at, expires_at
  ) VALUES (
    NEW.signing_token, NEW.app_id, 'amendment', v_email, NEW.id,
    now(), now() + INTERVAL '30 days'
  )
  ON CONFLICT (token) DO NOTHING;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."tg_amendment_register_token"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."tg_amendment_register_token"() IS 'Safety net: auto-registers lease_amendments.signing_token in lease_signing_tokens whenever the column is set to a non-null value. Idempotent. The explicit register_signing_token() call in the create-amendment edge function still runs first; this trigger guarantees registration even if a future code path forgets.';



CREATE OR REPLACE FUNCTION "public"."tg_application_register_token"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_co_email text;
BEGIN
  -- ── tenant_sign_token ────────────────────────────────────────────
  IF NEW.tenant_sign_token IS NOT NULL
     AND (TG_OP = 'INSERT'
          OR OLD.tenant_sign_token IS DISTINCT FROM NEW.tenant_sign_token)
  THEN
    INSERT INTO public.lease_signing_tokens (
      token, app_id, signer_role, signer_email, amendment_id,
      created_at, expires_at
    ) VALUES (
      NEW.tenant_sign_token, NEW.app_id, 'tenant',
      COALESCE(NEW.email, ''), NULL,
      now(), now() + INTERVAL '30 days'
    )
    ON CONFLICT (token) DO NOTHING;
  END IF;

  -- ── co_applicant_lease_token ─────────────────────────────────────
  IF NEW.co_applicant_lease_token IS NOT NULL
     AND (TG_OP = 'INSERT'
          OR OLD.co_applicant_lease_token IS DISTINCT FROM NEW.co_applicant_lease_token)
  THEN
    -- Co-applicant email lives in the co_applicants table; first one wins.
    SELECT ca.email INTO v_co_email
      FROM public.co_applicants ca
     WHERE ca.app_id = NEW.app_id
     LIMIT 1;

    INSERT INTO public.lease_signing_tokens (
      token, app_id, signer_role, signer_email, amendment_id,
      created_at, expires_at
    ) VALUES (
      NEW.co_applicant_lease_token, NEW.app_id, 'co_applicant',
      COALESCE(v_co_email, ''), NULL,
      now(), now() + INTERVAL '30 days'
    )
    ON CONFLICT (token) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."tg_application_register_token"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."tg_application_register_token"() IS 'Safety net: auto-registers applications.tenant_sign_token and applications.co_applicant_lease_token in lease_signing_tokens whenever set. Idempotent. Existing explicit register_signing_token() calls in the edge functions still run first; this trigger guarantees registration even if a future code path forgets.';



CREATE OR REPLACE FUNCTION "public"."trg_saves_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE properties
       SET saves_count = COALESCE(saves_count, 0) + 1
     WHERE id = NEW.property_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE properties
       SET saves_count = GREATEST(COALESCE(saves_count, 0) - 1, 0)
     WHERE id = OLD.property_id;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."trg_saves_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_lease_template_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;


ALTER FUNCTION "public"."update_lease_template_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_my_landlord_profile"("payload" "jsonb") RETURNS "public"."landlords"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  result public.landlords;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  UPDATE public.landlords SET
    contact_name     = CASE WHEN payload ? 'contact_name'     THEN payload->>'contact_name'     ELSE contact_name     END,
    business_name    = CASE WHEN payload ? 'business_name'    THEN payload->>'business_name'    ELSE business_name    END,
    tagline          = CASE WHEN payload ? 'tagline'          THEN payload->>'tagline'          ELSE tagline          END,
    bio              = CASE WHEN payload ? 'bio'              THEN payload->>'bio'              ELSE bio              END,
    license_number   = CASE WHEN payload ? 'license_number'   THEN payload->>'license_number'   ELSE license_number   END,
    years_experience = CASE WHEN payload ? 'years_experience' THEN NULLIF(payload->>'years_experience','')::int ELSE years_experience END,
    specialties      = CASE WHEN payload ? 'specialties'      THEN ARRAY(SELECT jsonb_array_elements_text(payload->'specialties')) ELSE specialties END,
    phone            = CASE WHEN payload ? 'phone'            THEN payload->>'phone'            ELSE phone            END,
    address          = CASE WHEN payload ? 'address'          THEN payload->>'address'          ELSE address          END,
    website          = CASE WHEN payload ? 'website'          THEN payload->>'website'          ELSE website          END,
    social_facebook  = CASE WHEN payload ? 'social_facebook'  THEN payload->>'social_facebook'  ELSE social_facebook  END,
    social_instagram = CASE WHEN payload ? 'social_instagram' THEN payload->>'social_instagram' ELSE social_instagram END,
    social_linkedin  = CASE WHEN payload ? 'social_linkedin'  THEN payload->>'social_linkedin'  ELSE social_linkedin  END,
    avatar_url       = CASE WHEN payload ? 'avatar_url'       THEN payload->>'avatar_url'       ELSE avatar_url       END,
    account_type     = CASE
      WHEN payload ? 'account_type'
       AND (payload->>'account_type') IN ('landlord','realtor','property_manager','agent')
      THEN payload->>'account_type'
      ELSE account_type
    END
  WHERE user_id = uid
  RETURNING * INTO result;

  IF result.id IS NULL THEN
    RAISE EXCEPTION 'No landlord row for current user' USING ERRCODE = '02000';
  END IF;
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."update_my_landlord_profile"("payload" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_lease_financials"("p_state_code" "text", "p_monthly_rent" numeric, "p_security_deposit" numeric, "p_pet_deposit" numeric, "p_last_month_rent" numeric, "p_cleaning_fee" numeric, "p_cleaning_refundable" boolean) RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
DECLARE
  v_law           RECORD;
  v_combined_dep  NUMERIC;
  v_state         TEXT;
BEGIN
  v_state := UPPER(COALESCE(p_state_code, ''));
  IF v_state = '' OR p_monthly_rent IS NULL OR p_monthly_rent <= 0 THEN
    RETURN NULL; -- nothing to validate
  END IF;

  SELECT * INTO v_law FROM state_lease_law WHERE state_code = v_state;
  IF NOT FOUND THEN
    RETURN NULL; -- unknown state, fall back to permissive
  END IF;

  v_combined_dep := COALESCE(p_security_deposit, 0) + COALESCE(p_pet_deposit, 0);

  -- Security deposit cap (months of rent)
  IF v_law.security_deposit_max_months IS NOT NULL
     AND v_combined_dep > v_law.security_deposit_max_months * p_monthly_rent THEN
    RETURN format(
      '%s security deposit cap exceeded: combined deposits of $%s exceed %s month(s) of rent ($%s).',
      v_state,
      to_char(v_combined_dep, 'FM999,999,990.00'),
      v_law.security_deposit_max_months::TEXT,
      to_char(v_law.security_deposit_max_months * p_monthly_rent, 'FM999,999,990.00')
    );
  END IF;

  -- NY/MA combined last-month + security cap (where last_month_rent is held
  -- pre-paid it counts toward the deposit cap).
  IF v_state IN ('NY','MA')
     AND v_law.security_deposit_max_months IS NOT NULL
     AND COALESCE(p_last_month_rent, 0) + COALESCE(p_security_deposit, 0)
       > v_law.security_deposit_max_months * p_monthly_rent THEN
    RETURN format(
      '%s combined cap exceeded: last-month rent + security deposit ($%s) exceed %s month(s) of rent ($%s).',
      v_state,
      to_char(COALESCE(p_last_month_rent, 0) + COALESCE(p_security_deposit, 0), 'FM999,999,990.00'),
      v_law.security_deposit_max_months::TEXT,
      to_char(v_law.security_deposit_max_months * p_monthly_rent, 'FM999,999,990.00')
    );
  END IF;

  -- Cleaning fee refundability for states that prohibit non-refundable cleaning fees.
  IF p_cleaning_fee IS NOT NULL AND p_cleaning_fee > 0
     AND COALESCE(p_cleaning_refundable, true) = false
     AND v_state IN ('CA','MD') THEN
    RETURN format(
      '%s prohibits non-refundable cleaning fees. Mark the cleaning fee refundable or remove it.',
      v_state
    );
  END IF;

  RETURN NULL;
END;
$_$;


ALTER FUNCTION "public"."validate_lease_financials"("p_state_code" "text", "p_monthly_rent" numeric, "p_security_deposit" numeric, "p_pet_deposit" numeric, "p_last_month_rent" numeric, "p_cleaning_fee" numeric, "p_cleaning_refundable" boolean) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lease_signing_tokens" (
    "token" "text" NOT NULL,
    "app_id" "text" NOT NULL,
    "signer_role" "text" NOT NULL,
    "signer_email" "text" NOT NULL,
    "amendment_id" "uuid",
    "ip_locked_to" "inet",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '30 days'::interval) NOT NULL,
    "used_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "revoked_by" "text",
    "revoke_reason" "text",
    "lease_id" "uuid",
    CONSTRAINT "lease_signing_tokens_signer_role_check" CHECK (("signer_role" = ANY (ARRAY['tenant'::"text", 'co_applicant'::"text", 'amendment'::"text"])))
);


ALTER TABLE "public"."lease_signing_tokens" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_signing_token"("p_token" "text", "p_role" "text" DEFAULT NULL::"text", "p_request_ip" "inet" DEFAULT NULL::"inet") RETURNS "public"."lease_signing_tokens"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
  v_row public.lease_signing_tokens%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.lease_signing_tokens WHERE token = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      MESSAGE = 'TOKEN_NOT_FOUND',
      DETAIL  = 'This signing link is not recognized.',
      ERRCODE = 'P0001';
  END IF;

  IF p_role IS NOT NULL AND v_row.signer_role <> p_role THEN
    RAISE EXCEPTION USING
      MESSAGE = 'TOKEN_WRONG_ROLE',
      DETAIL  = 'This signing link belongs to a different signer.',
      ERRCODE = 'P0001';
  END IF;

  IF v_row.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION USING
      MESSAGE = 'TOKEN_REVOKED',
      DETAIL  = COALESCE('This signing link was revoked: ' || v_row.revoke_reason,
                         'This signing link has been revoked.'),
      ERRCODE = 'P0001';
  END IF;

  IF v_row.used_at IS NOT NULL THEN
    RAISE EXCEPTION USING
      MESSAGE = 'TOKEN_ALREADY_USED',
      DETAIL  = 'This signing link has already been used.',
      ERRCODE = 'P0001';
  END IF;

  IF v_row.expires_at < now() THEN
    RAISE EXCEPTION USING
      MESSAGE = 'TOKEN_EXPIRED',
      DETAIL  = 'This signing link expired on ' || to_char(v_row.expires_at, 'Mon DD, YYYY')
                || '. Please contact us for a fresh link.',
      ERRCODE = 'P0001';
  END IF;

  IF v_row.ip_locked_to IS NOT NULL
     AND p_request_ip IS NOT NULL
     AND v_row.ip_locked_to <> p_request_ip THEN
    RAISE EXCEPTION USING
      MESSAGE = 'TOKEN_IP_MISMATCH',
      DETAIL  = 'This signing link can only be used from the original network.',
      ERRCODE = 'P0001';
  END IF;

  RETURN v_row;
END;
$$;


ALTER FUNCTION "public"."validate_signing_token"("p_token" "text", "p_role" "text", "p_request_ip" "inet") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "pipeline"."pipeline_enrichment_log" (
    "id" bigint NOT NULL,
    "property_id" "text" NOT NULL,
    "field" "text" NOT NULL,
    "method" "text" NOT NULL,
    "ai_value" "text",
    "human_value" "text",
    "was_overridden" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "pipeline"."pipeline_enrichment_log" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "pipeline"."pipeline_enrichment_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "pipeline"."pipeline_enrichment_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "pipeline"."pipeline_enrichment_log_id_seq" OWNED BY "pipeline"."pipeline_enrichment_log"."id";



CREATE TABLE IF NOT EXISTS "pipeline"."pipeline_folders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "color" "text" DEFAULT '#6366f1'::"text",
    "icon" "text" DEFAULT '📁'::"text"
);


ALTER TABLE "pipeline"."pipeline_folders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "pipeline"."pipeline_properties" (
    "id" "text" NOT NULL,
    "source" "text" NOT NULL,
    "source_url" "text",
    "source_listing_id" "text",
    "status" "text" DEFAULT 'scraped'::"text",
    "title" "text",
    "address" "text",
    "city" "text",
    "state" "text",
    "zip" "text",
    "county" "text",
    "lat" double precision,
    "lng" double precision,
    "bedrooms" integer,
    "bathrooms" double precision,
    "half_bathrooms" integer,
    "square_footage" integer,
    "lot_size_sqft" integer,
    "monthly_rent" integer,
    "property_type" "text",
    "year_built" integer,
    "floors" integer,
    "unit_number" "text",
    "total_units" integer,
    "description" "text",
    "showing_instructions" "text",
    "available_date" "text",
    "parking" "text",
    "garage_spaces" integer,
    "pets_allowed" boolean,
    "pet_types_allowed" "text",
    "pet_weight_limit" integer,
    "pet_details" "text",
    "smoking_allowed" boolean,
    "lease_terms" "text",
    "minimum_lease_months" integer,
    "security_deposit" integer,
    "last_months_rent" integer,
    "application_fee" integer,
    "pet_deposit" integer,
    "admin_fee" integer,
    "move_in_special" "text",
    "parking_fee" integer,
    "amenities" "text",
    "appliances" "text",
    "utilities_included" "text",
    "flooring" "text",
    "heating_type" "text",
    "cooling_type" "text",
    "laundry_type" "text",
    "total_bathrooms" double precision,
    "has_basement" boolean,
    "has_central_air" boolean,
    "virtual_tour_url" "text",
    "original_image_urls" "text",
    "local_image_paths" "text" DEFAULT '[]'::"text",
    "original_data" "text",
    "edited_fields" "text" DEFAULT '[]'::"text",
    "data_quality_score" integer,
    "missing_fields" "text" DEFAULT '[]'::"text",
    "inferred_features" "text" DEFAULT '[]'::"text",
    "published_at" "text",
    "choice_property_id" "text",
    "scraped_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "agent_name" "text",
    "broker_name" "text",
    "neighborhood" "text",
    "tax_value" integer,
    "hoa_fee" integer,
    "agent_image_url" "text",
    "poster_landlord_id" "text",
    "location_context" "text",
    "listed_at" "date",
    "source_status" "text" DEFAULT 'available'::"text" NOT NULL,
    "last_verified_at" timestamp with time zone,
    "photo_import_status" "text",
    "last_photo_import_error" "text",
    "last_photo_import_at" timestamp with time zone,
    "folder_id" "uuid",
    "folder_serial" integer,
    "photo_cleanup_status" "text" DEFAULT 'none'::"text",
    "photo_upload_status" "text" DEFAULT 'none'::"text",
    "quality_score_detail" "jsonb",
    "ai_features" "jsonb" DEFAULT '[]'::"jsonb",
    "embedding" "public"."vector"(384),
    "building_name" "text",
    "is_multi_unit" boolean DEFAULT false,
    "price_range" "text",
    "parent_property_id" "text",
    "original_description" "text",
    "source_last_updated_at" timestamp with time zone,
    "imported_at" timestamp with time zone,
    "source_type" "text",
    "identity_strategy" "text",
    "identity_status" "text" DEFAULT 'review'::"text",
    "source_profile_id" "uuid",
    "source_profile_type" "text",
    "source_profile_name" "text",
    "source_profile_image_url" "text",
    "source_profile_url" "text",
    "agent_profile_url" "text",
    CONSTRAINT "pipeline_properties_photo_cleanup_status_check" CHECK (("photo_cleanup_status" = ANY (ARRAY['none'::"text", 'pending'::"text", 'cleaned'::"text", 'failed'::"text"]))),
    CONSTRAINT "pipeline_properties_photo_upload_status_check" CHECK (("photo_upload_status" = ANY (ARRAY['none'::"text", 'uploading'::"text", 'complete'::"text", 'failed'::"text"])))
);


ALTER TABLE "pipeline"."pipeline_properties" OWNER TO "postgres";


COMMENT ON COLUMN "pipeline"."pipeline_properties"."photo_import_status" IS 'null = not attempted yet; ok = >=1 photo confirmed on ImageKit; failed = transfer attempted but produced zero photos.';



COMMENT ON COLUMN "pipeline"."pipeline_properties"."last_photo_import_error" IS 'Human-readable reason for the most recent failed photo transfer attempt (for admin visibility + retry).';



COMMENT ON COLUMN "pipeline"."pipeline_properties"."quality_score_detail" IS 'Detailed breakdown of data quality score by field group. Shows which fields are filled vs missing, helping admins understand why a listing has a particular score.';



CREATE TABLE IF NOT EXISTS "pipeline"."pipeline_scrape_runs" (
    "id" bigint NOT NULL,
    "source" "text" NOT NULL,
    "location" "text" NOT NULL,
    "count_total" integer DEFAULT 0,
    "count_new" integer DEFAULT 0,
    "avg_score" double precision,
    "error_message" "text",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone DEFAULT "now"(),
    "count_duplicate" integer DEFAULT 0 NOT NULL,
    "count_watermarked" integer DEFAULT 0 NOT NULL,
    "count_validation_rejected" integer DEFAULT 0 NOT NULL,
    "count_image_failed" integer DEFAULT 0 NOT NULL,
    "meta_json" "text",
    "idempotency_key" "text",
    "partial" boolean DEFAULT false NOT NULL
);


ALTER TABLE "pipeline"."pipeline_scrape_runs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "pipeline"."pipeline_scrape_runs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "pipeline"."pipeline_scrape_runs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "pipeline"."pipeline_scrape_runs_id_seq" OWNED BY "pipeline"."pipeline_scrape_runs"."id";



CREATE TABLE IF NOT EXISTS "public"."_migration_history" (
    "filename" "text" NOT NULL,
    "applied_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."_migration_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "text" NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."admin_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_issues" (
    "id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "severity" "text" DEFAULT 'medium'::"text" NOT NULL,
    "component" "text" DEFAULT 'general'::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "created_by" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "resolved_by" "text",
    "resolution_note" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "kind" "text",
    "detector" "text",
    "evidence" "jsonb",
    "fingerprint" "text",
    "auto_fix_attempts" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "agent_issues_description_check" CHECK (("length"("description") <= 8000)),
    CONSTRAINT "agent_issues_resolved_consistency" CHECK (((("status" = 'resolved'::"text") AND ("resolved_at" IS NOT NULL)) OR (("status" = 'open'::"text") AND ("resolved_at" IS NULL)))),
    CONSTRAINT "agent_issues_severity_check" CHECK (("severity" = ANY (ARRAY['critical'::"text", 'high'::"text", 'medium'::"text", 'low'::"text", 'info'::"text"]))),
    CONSTRAINT "agent_issues_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'resolved'::"text"]))),
    CONSTRAINT "agent_issues_title_check" CHECK ((("length"("title") >= 3) AND ("length"("title") <= 200)))
);


ALTER TABLE "public"."agent_issues" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."agent_issues_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."agent_issues_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."agent_issues_id_seq" OWNED BY "public"."agent_issues"."id";



CREATE TABLE IF NOT EXISTS "public"."application_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "app_id" "text" NOT NULL,
    "application_id" "uuid",
    "user_id" "uuid",
    "bucket" "text" DEFAULT 'application-docs'::"text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "original_file_name" "text",
    "mime_type" "text",
    "doc_type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending_upload'::"text" NOT NULL,
    "uploaded_by_email" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."application_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "app_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "status" "public"."application_status" DEFAULT 'pending'::"public"."application_status",
    "payment_status" "public"."payment_status" DEFAULT 'unpaid'::"public"."payment_status",
    "payment_date" timestamp with time zone,
    "admin_notes" "text",
    "application_fee" integer DEFAULT 0,
    "property_id" "text",
    "landlord_id" "uuid",
    "property_address" "text",
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "dob" "text",
    "ssn" "text",
    "requested_move_in_date" "text",
    "desired_lease_term" "text",
    "current_address" "text",
    "residency_duration" "text",
    "current_rent_amount" "text",
    "reason_for_leaving" "text",
    "current_landlord_name" "text",
    "landlord_phone" "text",
    "previous_address" "text",
    "previous_residency_duration" "text",
    "previous_landlord_name" "text",
    "previous_landlord_phone" "text",
    "employment_status" "text",
    "employer" "text",
    "employer_address" "text",
    "job_title" "text",
    "employment_duration" "text",
    "employment_start_date" "text",
    "supervisor_name" "text",
    "supervisor_phone" "text",
    "monthly_income" "text",
    "other_income" "text",
    "has_bankruptcy" boolean DEFAULT false,
    "bankruptcy_explanation" "text",
    "has_criminal_history" boolean DEFAULT false,
    "criminal_history_explanation" "text",
    "government_id_type" "text",
    "government_id_number" "text",
    "reference_1_name" "text",
    "reference_1_phone" "text",
    "reference_2_name" "text",
    "reference_2_phone" "text",
    "emergency_contact_name" "text",
    "emergency_contact_phone" "text",
    "emergency_contact_relationship" "text",
    "primary_payment_method" "text",
    "primary_payment_method_other" "text",
    "alternative_payment_method" "text",
    "alternative_payment_method_other" "text",
    "third_choice_payment_method" "text",
    "third_choice_payment_method_other" "text",
    "has_pets" boolean DEFAULT false,
    "pet_details" "text",
    "total_occupants" "text",
    "additional_occupants" "text",
    "ever_evicted" boolean DEFAULT false,
    "smoker" boolean DEFAULT false,
    "preferred_language" "text" DEFAULT 'en'::"text",
    "preferred_contact_method" "text",
    "preferred_time" "text",
    "preferred_time_specific" "text",
    "vehicle_make" "text",
    "vehicle_model" "text",
    "vehicle_year" "text",
    "vehicle_license_plate" "text",
    "has_co_applicant" boolean DEFAULT false,
    "additional_person_role" "text",
    "co_applicant_first_name" "text",
    "co_applicant_last_name" "text",
    "co_applicant_email" "text",
    "co_applicant_phone" "text",
    "co_applicant_dob" "text",
    "co_applicant_ssn" "text",
    "co_applicant_employer" "text",
    "co_applicant_job_title" "text",
    "co_applicant_monthly_income" "text",
    "co_applicant_employment_duration" "text",
    "co_applicant_employment_status" "text",
    "co_applicant_consent" boolean DEFAULT false,
    "applicant_user_id" "uuid",
    "landlord_email" "text",
    "document_url" "text",
    "document_urls" "jsonb" DEFAULT '[]'::"jsonb",
    "lease_status" "public"."lease_status" DEFAULT 'none'::"public"."lease_status",
    "lease_sent_date" timestamp with time zone,
    "lease_signed_date" timestamp with time zone,
    "lease_start_date" "date",
    "lease_end_date" "date",
    "monthly_rent" numeric(10,2),
    "security_deposit" numeric(10,2),
    "move_in_costs" numeric(10,2),
    "lease_notes" "text",
    "lease_late_fee_flat" numeric(10,2) DEFAULT 50,
    "lease_late_fee_daily" numeric(10,2) DEFAULT 10,
    "lease_expiry_date" timestamp with time zone,
    "lease_state_code" "text",
    "lease_landlord_name" "text",
    "lease_landlord_address" "text",
    "lease_pets_policy" "text",
    "lease_smoking_policy" "text",
    "lease_compliance_snapshot" "text",
    "lease_pdf_url" "text",
    "tenant_signature" "text",
    "tenant_sign_token" "text",
    "signature_timestamp" timestamp with time zone,
    "lease_ip_address" "text",
    "co_applicant_signature" "text",
    "co_applicant_signature_timestamp" timestamp with time zone,
    "co_applicant_lease_token" "text",
    "move_in_status" "public"."movein_status",
    "move_in_date_actual" "date",
    "move_in_notes" "text",
    "move_in_confirmed_by" "text",
    "reference_1_relationship" "text",
    "reference_2_relationship" "text",
    "submission_uuid" "uuid",
    "terms_consent" boolean,
    "sms_consent" boolean DEFAULT false,
    "consent_timestamp" timestamp with time zone,
    "consent_version" "text",
    "holding_fee_requested" boolean DEFAULT false,
    "holding_fee_requested_at" timestamp with time zone,
    "holding_fee_amount" numeric(10,2),
    "holding_fee_due_date" "date",
    "holding_fee_paid" boolean DEFAULT false,
    "holding_fee_paid_at" timestamp with time zone,
    "payment_confirmed_at" timestamp with time zone,
    "payment_amount_collected" numeric(10,2),
    "payment_method_confirmed" "text",
    "payment_transaction_ref" "text",
    "payment_amount_recorded" numeric(10,2),
    "payment_method_recorded" "text",
    "payment_notes" "text",
    "tenant_signature_image" "text",
    "co_applicant_signature_image" "text",
    "lease_template_version_id" "uuid",
    "management_signed" boolean DEFAULT false,
    "management_signer_name" "text",
    "management_signed_at" timestamp with time zone,
    "management_notes" "text",
    "management_cosigned" boolean DEFAULT false,
    "management_cosigned_by" "text",
    "management_cosigned_at" timestamp with time zone,
    "first_month_rent" numeric(10,2),
    "last_month_rent" numeric(10,2),
    "pet_deposit" numeric(10,2),
    "pet_rent" numeric(10,2),
    "admin_fee" numeric(10,2),
    "key_deposit" numeric(10,2),
    "parking_fee" numeric(10,2),
    "cleaning_fee" numeric(10,2),
    "cleaning_fee_refundable" boolean,
    "rent_due_day_of_month" integer DEFAULT 1 NOT NULL,
    "rent_proration_method" "text" DEFAULT 'daily'::"text" NOT NULL,
    "prorated_first_month" numeric(10,2),
    "utility_responsibilities" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "move_out_date_actual" "date",
    "current_lease_id" "uuid",
    "negotiation_language" "text" DEFAULT 'en'::"text" NOT NULL,
    CONSTRAINT "applications_negotiation_language_check" CHECK (("negotiation_language" = ANY (ARRAY['en'::"text", 'es'::"text"]))),
    CONSTRAINT "applications_proration_method_chk" CHECK (("rent_proration_method" = ANY (ARRAY['daily'::"text", '30day'::"text", 'none'::"text"]))),
    CONSTRAINT "applications_rent_due_day_chk" CHECK ((("rent_due_day_of_month" >= 1) AND ("rent_due_day_of_month" <= 28))),
    CONSTRAINT "applications_utility_responsibilities_chk" CHECK (("jsonb_typeof"("utility_responsibilities") = 'object'::"text"))
);

ALTER TABLE ONLY "public"."applications" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."applications" OWNER TO "postgres";


COMMENT ON COLUMN "public"."applications"."lease_status" IS 'DEPRECATED (Phase 10) — see leases.lease_status. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."lease_sent_date" IS 'DEPRECATED (Phase 10) — see leases.lease_sent_date. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."lease_signed_date" IS 'DEPRECATED (Phase 10) — see leases.lease_signed_date. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."lease_start_date" IS 'DEPRECATED (Phase 10) — see leases.lease_start_date. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."lease_end_date" IS 'DEPRECATED (Phase 10) — see leases.lease_end_date. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."monthly_rent" IS 'DEPRECATED (Phase 10) — see leases.monthly_rent. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."security_deposit" IS 'DEPRECATED (Phase 10) — see leases.security_deposit. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."move_in_costs" IS 'DEPRECATED (Phase 10) — see leases.move_in_costs. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."lease_notes" IS 'DEPRECATED (Phase 10) — see leases.lease_notes. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."lease_late_fee_flat" IS 'DEPRECATED (Phase 10) — see leases.lease_late_fee_flat. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."lease_late_fee_daily" IS 'DEPRECATED (Phase 10) — see leases.lease_late_fee_daily. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."lease_expiry_date" IS 'DEPRECATED (Phase 10) — see leases.lease_expiry_date. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."lease_state_code" IS 'DEPRECATED (Phase 10) — see leases.lease_state_code. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."lease_landlord_name" IS 'DEPRECATED (Phase 10) — see leases.lease_landlord_name. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."lease_landlord_address" IS 'DEPRECATED (Phase 10) — see leases.lease_landlord_address. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."lease_pets_policy" IS 'DEPRECATED (Phase 10) — see leases.lease_pets_policy. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."lease_smoking_policy" IS 'DEPRECATED (Phase 10) — see leases.lease_smoking_policy. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."lease_compliance_snapshot" IS 'DEPRECATED (Phase 10) — see leases.lease_compliance_snapshot. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."lease_pdf_url" IS 'DEPRECATED (Phase 10) — see leases.lease_pdf_url. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."tenant_signature" IS 'DEPRECATED (Phase 10) — see leases.tenant_signature. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."tenant_sign_token" IS 'DEPRECATED (Phase 10) — see leases.tenant_sign_token. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."signature_timestamp" IS 'DEPRECATED (Phase 10) — see leases.signature_timestamp. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."lease_ip_address" IS 'DEPRECATED (Phase 10) — see leases.lease_ip_address. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."co_applicant_signature" IS 'DEPRECATED (Phase 10) — see leases.co_applicant_signature. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."co_applicant_signature_timestamp" IS 'DEPRECATED (Phase 10) — see leases.co_applicant_signature_timestamp. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."co_applicant_lease_token" IS 'DEPRECATED (Phase 10) — see leases.co_applicant_lease_token. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."tenant_signature_image" IS 'DEPRECATED (Phase 10) — see leases.tenant_signature_image. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."co_applicant_signature_image" IS 'DEPRECATED (Phase 10) — see leases.co_applicant_signature_image. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."lease_template_version_id" IS 'DEPRECATED (Phase 10) — see leases.lease_template_version_id. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."management_signed" IS 'DEPRECATED (Phase 10) — see leases.management_signed. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."management_signer_name" IS 'DEPRECATED (Phase 10) — see leases.management_signer_name. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."management_signed_at" IS 'DEPRECATED (Phase 10) — see leases.management_signed_at. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."management_notes" IS 'DEPRECATED (Phase 10) — see leases.management_notes. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."management_cosigned" IS 'DEPRECATED (Phase 10) — see leases.management_cosigned. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."management_cosigned_by" IS 'DEPRECATED (Phase 10) — see leases.management_cosigned_by. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."management_cosigned_at" IS 'DEPRECATED (Phase 10) — see leases.management_cosigned_at. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."first_month_rent" IS 'DEPRECATED (Phase 10) — see leases.first_month_rent. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."last_month_rent" IS 'DEPRECATED (Phase 10) — see leases.last_month_rent. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."pet_deposit" IS 'DEPRECATED (Phase 10) — see leases.pet_deposit. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."pet_rent" IS 'DEPRECATED (Phase 10) — see leases.pet_rent. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."admin_fee" IS 'DEPRECATED (Phase 10) — see leases.admin_fee. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."key_deposit" IS 'DEPRECATED (Phase 10) — see leases.key_deposit. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."parking_fee" IS 'DEPRECATED (Phase 10) — see leases.parking_fee. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."cleaning_fee" IS 'DEPRECATED (Phase 10) — see leases.cleaning_fee. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."cleaning_fee_refundable" IS 'DEPRECATED (Phase 10) — see leases.cleaning_fee_refundable. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."rent_due_day_of_month" IS 'Day of month rent is due (1-28). Stored on the application after lease generation.';



COMMENT ON COLUMN "public"."applications"."rent_proration_method" IS 'First-month proration method: daily | 30day | none.';



COMMENT ON COLUMN "public"."applications"."prorated_first_month" IS 'DEPRECATED (Phase 10) — see leases.prorated_first_month. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."utility_responsibilities" IS 'DEPRECATED (Phase 10) — see leases.utility_responsibilities. Will be removed in Phase 14.';



COMMENT ON COLUMN "public"."applications"."current_lease_id" IS 'Phase 10: pointer to the application''s currently-active lease (most-recent non-terminated row in leases). Updated by generate-lease and renewal flows. Nullable when no lease has been generated yet.';



COMMENT ON COLUMN "public"."applications"."negotiation_language" IS 'Language in which the tenancy was negotiated. CA Civ. Code §1632 requires a written lease in Spanish when the tenancy was negotiated in Spanish. Also supports ''es'' for practical demand across all states. Default ''en''.';



CREATE TABLE IF NOT EXISTS "public"."bot_attempts" (
    "id" bigint NOT NULL,
    "ip" "inet",
    "user_agent" "text",
    "endpoint" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "payload_hash" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bot_attempts" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."bot_attempts_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."bot_attempts_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."bot_attempts_id_seq" OWNED BY "public"."bot_attempts"."id";



CREATE TABLE IF NOT EXISTS "public"."client_errors" (
    "id" bigint NOT NULL,
    "fingerprint" "text" NOT NULL,
    "message" "text" NOT NULL,
    "stack" "text",
    "page_path" "text",
    "user_agent" "text",
    "browser_lang" "text",
    "hit_count" integer DEFAULT 1 NOT NULL,
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."client_errors" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."client_errors_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."client_errors_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."client_errors_id_seq" OWNED BY "public"."client_errors"."id";



CREATE TABLE IF NOT EXISTS "public"."co_applicants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "app_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "first_name" "text",
    "last_name" "text",
    "email" "text",
    "phone" "text",
    "dob" "text",
    "ssn" "text",
    "role" "text",
    "employer" "text",
    "job_title" "text",
    "monthly_income" "text",
    "employment_duration" "text",
    "employment_status" "text",
    "consent" boolean DEFAULT false
);


ALTER TABLE "public"."co_applicants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."consent_log" (
    "id" bigint NOT NULL,
    "app_id" "text",
    "submission_uuid" "uuid",
    "email" "text" NOT NULL,
    "consent_version" "text" NOT NULL,
    "terms_consent" boolean NOT NULL,
    "sms_consent" boolean DEFAULT false NOT NULL,
    "ip" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."consent_log" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."consent_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."consent_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."consent_log_id_seq" OWNED BY "public"."consent_log"."id";



CREATE TABLE IF NOT EXISTS "public"."credentials_config" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "is_secret" boolean DEFAULT false,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "valid_key" CHECK (("key" = ANY (ARRAY['SUPABASE_URL'::"text", 'SUPABASE_ANON_KEY'::"text", 'SUPABASE_SERVICE_ROLE_KEY'::"text", 'SUPABASE_API_TOKEN'::"text", 'GITHUB_API_TOKEN'::"text"])))
);


ALTER TABLE "public"."credentials_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."credentials_config" IS 'Stores shared configuration credentials for Choice project. Publicly readable for open collaboration.';



CREATE TABLE IF NOT EXISTS "public"."draft_applications" (
    "token" "text" NOT NULL,
    "email" "text" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "property_fingerprint" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "nudge_sent_at" timestamp with time zone
);


ALTER TABLE "public"."draft_applications" OWNER TO "postgres";


COMMENT ON COLUMN "public"."draft_applications"."nudge_sent_at" IS 'Timestamp when the expiry-warning nudge email was sent. NULL = not yet sent.';



CREATE TABLE IF NOT EXISTS "public"."email_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "type" "text" NOT NULL,
    "recipient" "text" NOT NULL,
    "status" "text" NOT NULL,
    "app_id" "text",
    "error_msg" "text",
    "provider" "text"
);


ALTER TABLE "public"."email_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."esign_consents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "app_id" "text" NOT NULL,
    "signer_email" "text" NOT NULL,
    "signer_role" "text" NOT NULL,
    "disclosure_version" "text" NOT NULL,
    "ip_address" "inet",
    "user_agent" "text",
    "hardware_software_acknowledged" boolean DEFAULT false NOT NULL,
    "paper_copy_right_acknowledged" boolean DEFAULT false NOT NULL,
    "withdrawal_right_acknowledged" boolean DEFAULT false NOT NULL,
    "consent_given" boolean DEFAULT false NOT NULL,
    "consented_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "withdrawn_at" timestamp with time zone,
    "lease_id" "uuid",
    CONSTRAINT "esign_consents_signer_role_check" CHECK (("signer_role" = ANY (ARRAY['tenant'::"text", 'co_applicant'::"text", 'amendment'::"text"])))
);


ALTER TABLE "public"."esign_consents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inquiries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "text",
    "tenant_name" "text" NOT NULL,
    "tenant_email" "text" NOT NULL,
    "tenant_phone" "text",
    "message" "text",
    "read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chk_message_len" CHECK ((("message" IS NULL) OR ("char_length"("message") <= 4000)))
);


ALTER TABLE "public"."inquiries" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."landlords_public" AS
 SELECT "id",
    "user_id",
    "contact_name",
    "business_name",
    "avatar_url",
    "verified",
    "tagline",
    "account_type",
    "website",
    "bio",
    "specialties",
    "years_experience",
    "created_at",
    "social_facebook",
    "social_instagram",
    "social_linkedin"
   FROM "public"."landlords";


ALTER VIEW "public"."landlords_public" OWNER TO "postgres";


COMMENT ON VIEW "public"."landlords_public" IS 'Public profile allow-list. Excludes email, phone, address, license number, and billing data; do not replace with a direct landlords table query.';



CREATE TABLE IF NOT EXISTS "public"."lease_addenda_attached" (
    "id" bigint NOT NULL,
    "app_id" "text" NOT NULL,
    "application_pk" bigint,
    "addendum_slug" "text" NOT NULL,
    "addendum_title" "text" NOT NULL,
    "addendum_jurisdiction" "text" NOT NULL,
    "addendum_citation" "text" NOT NULL,
    "rendered_body" "text" NOT NULL,
    "attached_pdf_path" "text",
    "signature_required" boolean DEFAULT true NOT NULL,
    "initials_required" boolean DEFAULT false NOT NULL,
    "attached_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "acknowledged_by" "text",
    "acknowledged_role" "text",
    "acknowledged_at" timestamp with time zone,
    "acknowledged_ip" "text",
    "acknowledged_user_agent" "text",
    "signature_text" "text",
    "initials_text" "text",
    "lease_id" "uuid",
    CONSTRAINT "lease_addenda_attached_acknowledged_role_check" CHECK (("acknowledged_role" = ANY (ARRAY['tenant'::"text", 'co_applicant'::"text", 'management'::"text"])))
);


ALTER TABLE "public"."lease_addenda_attached" OWNER TO "postgres";


COMMENT ON TABLE "public"."lease_addenda_attached" IS 'Phase 04: per-application record of which addenda were attached to a generated lease, with denormalized snapshots and per-addendum acknowledgment.';



COMMENT ON COLUMN "public"."lease_addenda_attached"."rendered_body" IS 'Snapshot of the addendum body AFTER template rendering at attach time. Frozen for audit.';



COMMENT ON COLUMN "public"."lease_addenda_attached"."lease_id" IS 'Phase 10: FK to leases.id. Nullable during the transition; chunk 2 backfills from app_id, chunks 3-4 wire new attach-flow to populate it.';



CREATE SEQUENCE IF NOT EXISTS "public"."lease_addenda_attached_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."lease_addenda_attached_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."lease_addenda_attached_id_seq" OWNED BY "public"."lease_addenda_attached"."id";



CREATE TABLE IF NOT EXISTS "public"."lease_addenda_library" (
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "jurisdiction" "text" NOT NULL,
    "applies_when" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "body" "text" NOT NULL,
    "attached_pdf_path" "text",
    "signature_required" boolean DEFAULT true NOT NULL,
    "initials_required" boolean DEFAULT false NOT NULL,
    "citation" "text" NOT NULL,
    "source_url" "text" NOT NULL,
    "legal_review_status" "text" DEFAULT 'statute_derived'::"text" NOT NULL,
    "attorney_reviewed" boolean DEFAULT false NOT NULL,
    "attorney_reviewer" "text",
    "attorney_reviewed_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lease_addenda_library_jurisdiction_format" CHECK ((("jurisdiction" = 'federal'::"text") OR ("jurisdiction" = 'common'::"text") OR ("jurisdiction" ~ '^[A-Z]{2}$'::"text"))),
    CONSTRAINT "lease_addenda_library_legal_review_status_check" CHECK (("legal_review_status" = ANY (ARRAY['statute_derived'::"text", 'attorney_reviewed'::"text", 'admin_draft'::"text", 'deprecated'::"text"]))),
    CONSTRAINT "lease_addenda_library_slug_format" CHECK (("slug" ~ '^[a-z]{2,8}/[a-z0-9-]{2,64}$'::"text"))
);


ALTER TABLE "public"."lease_addenda_library" OWNER TO "postgres";


COMMENT ON TABLE "public"."lease_addenda_library" IS 'Phase 04: library of disclosure addenda. One row per addendum template (e.g. federal/lead-paint, ca/bedbug). The body uses the Phase 01 templating engine.';



COMMENT ON COLUMN "public"."lease_addenda_library"."jurisdiction" IS 'federal | common | <2-letter state code>. Drives auto-attach by lease state.';



COMMENT ON COLUMN "public"."lease_addenda_library"."applies_when" IS 'JSON predicate evaluated by generate-lease. Recognized keys: property_built_before (int year), property_type (array of strings), requires_pets (bool), state_security_deposit_separate_account (bool).';



COMMENT ON COLUMN "public"."lease_addenda_library"."attached_pdf_path" IS 'Optional path to a PDF asset to embed after the addendum text (e.g. assets/legal/epa-lead-pamphlet-2020.pdf).';



CREATE TABLE IF NOT EXISTS "public"."lease_amendments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "app_id" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "signing_token" "text",
    "tenant_signature" "text",
    "tenant_signature_image" "text",
    "signed_at" timestamp with time zone,
    "signer_ip" "text",
    "signer_user_agent" "text",
    "pdf_path" "text",
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "lease_id" "uuid",
    CONSTRAINT "lease_amendments_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'sent'::"text", 'signed'::"text", 'voided'::"text"])))
);


ALTER TABLE "public"."lease_amendments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lease_deposit_accountings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "app_id" "uuid" NOT NULL,
    "lease_termination_id" "uuid",
    "total_deposit_held" numeric(10,2) DEFAULT 0 NOT NULL,
    "amount_withheld" numeric(10,2) DEFAULT 0 NOT NULL,
    "refund_owed_to_tenant" numeric(10,2) DEFAULT 0 NOT NULL,
    "interest_accrued" numeric(10,2) DEFAULT 0 NOT NULL,
    "state_code_snapshot" "text",
    "state_return_days_snapshot" integer,
    "move_out_date_snapshot" "date",
    "state_return_deadline" "date",
    "late_generated" boolean DEFAULT false NOT NULL,
    "letter_pdf_path" "text",
    "letter_pdf_sha256" "text",
    "letter_pdf_bytes" integer,
    "generated_at" timestamp with time zone,
    "generated_by" "uuid",
    "sent_at" timestamp with time zone,
    "sent_to_email" "text",
    "tenant_disputed_at" timestamp with time zone,
    "tenant_dispute_text" "text",
    "admin_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "lease_id" "uuid",
    CONSTRAINT "lease_deposit_accountings_money_nonneg" CHECK ((("total_deposit_held" >= (0)::numeric) AND ("amount_withheld" >= (0)::numeric) AND ("refund_owed_to_tenant" >= (0)::numeric) AND ("interest_accrued" >= (0)::numeric))),
    CONSTRAINT "lease_deposit_accountings_return_days_chk" CHECK ((("state_return_days_snapshot" IS NULL) OR (("state_return_days_snapshot" >= 1) AND ("state_return_days_snapshot" <= 120)))),
    CONSTRAINT "lease_deposit_accountings_sha256_chk" CHECK ((("letter_pdf_sha256" IS NULL) OR ("letter_pdf_sha256" ~ '^[0-9a-f]{64}$'::"text"))),
    CONSTRAINT "lease_deposit_accountings_state_code_chk" CHECK ((("state_code_snapshot" IS NULL) OR ("state_code_snapshot" ~ '^[A-Z]{2}$'::"text")))
);


ALTER TABLE "public"."lease_deposit_accountings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lease_deposit_deductions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "accounting_id" "uuid" NOT NULL,
    "app_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "inspection_id" "uuid",
    "supporting_photo_paths" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "receipt_paths" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lease_deposit_deductions_amount_nonneg" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "lease_deposit_deductions_category_chk" CHECK (("category" = ANY (ARRAY['rent_arrears'::"text", 'cleaning'::"text", 'damages'::"text", 'unpaid_utilities'::"text", 'early_termination'::"text", 'other'::"text"]))),
    CONSTRAINT "lease_deposit_deductions_description_nonempty" CHECK (("length"("btrim"("description")) > 0))
);


ALTER TABLE "public"."lease_deposit_deductions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lease_inspection_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "inspection_id" "uuid" NOT NULL,
    "app_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "room_key" "text" NOT NULL,
    "item_key" "text",
    "caption" "text",
    "taken_at_exif" timestamp with time zone,
    "uploaded_by" "text",
    "byte_size" integer,
    "width" integer,
    "height" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "lease_id" "uuid",
    CONSTRAINT "lease_inspection_photos_uploader_chk" CHECK ((("uploaded_by" IS NULL) OR ("uploaded_by" = ANY (ARRAY['tenant'::"text", 'landlord'::"text", 'admin'::"text"]))))
);


ALTER TABLE "public"."lease_inspection_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lease_inspections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "app_id" "uuid" NOT NULL,
    "inspection_type" "text" NOT NULL,
    "scheduled_for" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "completed_by_role" "text",
    "tenant_signed_at" timestamp with time zone,
    "landlord_signed_at" timestamp with time zone,
    "tenant_sig_image" "text",
    "landlord_sig_image" "text",
    "rooms" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "notes" "text",
    "photos_count" integer DEFAULT 0 NOT NULL,
    "pdf_storage_path" "text",
    "pdf_sha256" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "lease_id" "uuid",
    CONSTRAINT "lease_inspections_pdf_sha256_chk" CHECK ((("pdf_sha256" IS NULL) OR ("pdf_sha256" ~ '^[0-9a-f]{64}$'::"text"))),
    CONSTRAINT "lease_inspections_role_chk" CHECK ((("completed_by_role" IS NULL) OR ("completed_by_role" = ANY (ARRAY['tenant'::"text", 'landlord'::"text", 'joint'::"text"])))),
    CONSTRAINT "lease_inspections_type_chk" CHECK (("inspection_type" = ANY (ARRAY['move_in'::"text", 'mid_term'::"text", 'move_out'::"text"])))
);


ALTER TABLE "public"."lease_inspections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lease_lifecycle_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lease_id" "uuid" NOT NULL,
    "doc_type" "text" NOT NULL,
    "notice_type" "text",
    "effective_date" "date" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "generated_by" "text",
    "state_code" character(2) NOT NULL,
    "state_notice_days_required" integer,
    "storage_path" "text",
    "sha256" "text",
    "metadata" "jsonb",
    "delivered_at" timestamp with time zone,
    "delivery_method" "text",
    CONSTRAINT "lease_lifecycle_documents_doc_type_check" CHECK (("doc_type" = ANY (ARRAY['renewal_lease'::"text", 'termination_notice'::"text", 'rent_increase_letter'::"text", 'm2m_conversion'::"text"])))
);


ALTER TABLE "public"."lease_lifecycle_documents" OWNER TO "postgres";


COMMENT ON TABLE "public"."lease_lifecycle_documents" IS 'Phase 11: one row per generated lifecycle document (renewal, termination notice, rent increase letter).';



CREATE OR REPLACE VIEW "public"."lease_money_summary" WITH ("security_invoker"='true') AS
 SELECT "id" AS "application_id",
    "app_id",
    "monthly_rent",
    "first_month_rent",
    "last_month_rent",
    "security_deposit",
    "pet_deposit",
    "pet_rent",
    "admin_fee",
    "key_deposit",
    "parking_fee",
    "cleaning_fee",
    "cleaning_fee_refundable",
    "prorated_first_month",
    "move_in_costs" AS "legacy_move_in_costs",
    (("first_month_rent" IS NOT NULL) OR ("last_month_rent" IS NOT NULL) OR ("pet_deposit" IS NOT NULL) OR ("admin_fee" IS NOT NULL) OR ("key_deposit" IS NOT NULL) OR ("parking_fee" IS NOT NULL) OR ("cleaning_fee" IS NOT NULL) OR ("prorated_first_month" IS NOT NULL)) AS "has_itemized",
    COALESCE(NULLIF((((((((COALESCE("prorated_first_month", "first_month_rent", "monthly_rent", (0)::numeric) + COALESCE("last_month_rent", (0)::numeric)) + COALESCE("security_deposit", (0)::numeric)) + COALESCE("pet_deposit", (0)::numeric)) + COALESCE("admin_fee", (0)::numeric)) + COALESCE("key_deposit", (0)::numeric)) + COALESCE("parking_fee", (0)::numeric)) + COALESCE("cleaning_fee", (0)::numeric)), (0)::numeric), "move_in_costs", (0)::numeric) AS "computed_move_in_total",
    ((COALESCE("monthly_rent", (0)::numeric) + COALESCE("pet_rent", (0)::numeric)) + COALESCE("parking_fee", (0)::numeric)) AS "estimated_monthly_total"
   FROM "public"."applications" "a";


ALTER VIEW "public"."lease_money_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lease_pdf_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "app_id" "text" NOT NULL,
    "version_number" integer NOT NULL,
    "event" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "size_bytes" integer,
    "template_version_id" "uuid",
    "amendment_id" "uuid",
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sha256" "text",
    "certificate_appended" boolean DEFAULT false NOT NULL,
    "qr_verify_token" "text",
    "legacy_pre_phase06" boolean DEFAULT false NOT NULL,
    "lease_id" "uuid",
    CONSTRAINT "lease_pdf_versions_event_check" CHECK (("event" = ANY (ARRAY['pre_sign'::"text", 'tenant_signed'::"text", 'co_signed'::"text", 'countersigned'::"text", 'amended'::"text", 'renewed'::"text", 'manual'::"text", 'inspection_movein'::"text", 'inspection_midterm'::"text", 'inspection_moveout'::"text", 'deposit_accounting'::"text"]))),
    CONSTRAINT "lease_pdf_versions_integrity_present" CHECK ((("sha256" IS NOT NULL) OR ("legacy_pre_phase06" = true) OR ("storage_path" = ''::"text"))),
    CONSTRAINT "lease_pdf_versions_sha256_format_chk" CHECK ((("sha256" IS NULL) OR ("sha256" ~ '^[0-9a-f]{64}$'::"text")))
);


ALTER TABLE "public"."lease_pdf_versions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."lease_pdf_versions"."legacy_pre_phase06" IS 'TRUE for rows generated before Phase 06 PDF integrity wiring (cc6fafc). These rows have no audit certificate page and no qr_verify_token. sha256 may be backfilled by the backfill-pdf-integrity edge function, but the row remains flagged legacy so audits distinguish it from a natively-Phase-06 PDF that was signed with a real certificate page.';



COMMENT ON COLUMN "public"."lease_pdf_versions"."lease_id" IS 'Phase 10: FK to leases.id. Nullable during the transition; chunk 2 backfills from app_id, chunks 3-4 make new generators populate it.';



CREATE OR REPLACE VIEW "public"."lease_renewals_due" WITH ("security_invoker"='true') AS
 SELECT "app_id",
    "first_name",
    "last_name",
    "email",
    "property_address",
    "lease_start_date",
    "lease_end_date",
    "monthly_rent",
    ("lease_end_date" - CURRENT_DATE) AS "days_until_end",
    (EXISTS ( SELECT 1
           FROM "public"."admin_actions" "aa"
          WHERE (("aa"."target_type" = 'application'::"text") AND ("aa"."target_id" = "a"."app_id") AND ("aa"."action" = 'lease_renewal_nudge_sent'::"text") AND ("aa"."created_at" > ("now"() - '14 days'::interval))))) AS "recently_nudged"
   FROM "public"."applications" "a"
  WHERE (("lease_status" = ANY (ARRAY['co_signed'::"public"."lease_status", 'signed'::"public"."lease_status"])) AND ("management_cosigned" = true) AND ("lease_end_date" IS NOT NULL) AND ((("lease_end_date" - CURRENT_DATE) >= 0) AND (("lease_end_date" - CURRENT_DATE) <= 70)));


ALTER VIEW "public"."lease_renewals_due" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."lease_signing_tokens_admin" WITH ("security_invoker"='true') AS
 SELECT "token",
    "app_id",
    "lease_id",
    "signer_role",
    "signer_email",
    "amendment_id",
    "created_at",
    "expires_at",
    "used_at",
    "revoked_at",
    "revoked_by",
    "revoke_reason",
    "ip_locked_to",
        CASE
            WHEN ("used_at" IS NOT NULL) THEN 'used'::"text"
            WHEN ("revoked_at" IS NOT NULL) THEN 'revoked'::"text"
            WHEN ("expires_at" < "now"()) THEN 'expired'::"text"
            ELSE 'active'::"text"
        END AS "status"
   FROM "public"."lease_signing_tokens" "t";


ALTER VIEW "public"."lease_signing_tokens_admin" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lease_template_partials" (
    "slug" "text" NOT NULL,
    "body" "text" NOT NULL,
    "description" "text",
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "locale" "text" DEFAULT 'en'::"text" NOT NULL,
    CONSTRAINT "lease_template_partials_locale_chk" CHECK ((("char_length"("locale") >= 2) AND ("char_length"("locale") <= 8)))
);


ALTER TABLE "public"."lease_template_partials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lease_template_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "version_number" integer NOT NULL,
    "name" "text" NOT NULL,
    "template_body" "text" NOT NULL,
    "variables" "jsonb" DEFAULT '{}'::"jsonb",
    "notes" "text",
    "published_by" "text",
    "published_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "state_code" character(2) NOT NULL,
    "legal_review_status" "text" DEFAULT 'statute_derived'::"text" NOT NULL,
    "attorney_reviewer" "text",
    "attorney_review_date" "date",
    "locale" "text" DEFAULT 'en'::"text" NOT NULL,
    CONSTRAINT "lease_template_versions_legal_review_status_chk" CHECK (("legal_review_status" = ANY (ARRAY['statute_derived'::"text", 'attorney_reviewed'::"text", 'outdated'::"text"])))
);


ALTER TABLE "public"."lease_template_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lease_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" DEFAULT 'Standard Lease'::"text" NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "template_body" "text" NOT NULL,
    "variables" "jsonb" DEFAULT '{}'::"jsonb",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "text",
    "state_code" character(2) NOT NULL,
    "legal_review_status" "text" DEFAULT 'statute_derived'::"text" NOT NULL,
    "attorney_reviewer" "text",
    "attorney_review_date" "date",
    "attorney_bar_number" "text",
    "locale" "text" DEFAULT 'en'::"text" NOT NULL,
    CONSTRAINT "lease_templates_legal_review_status_chk" CHECK (("legal_review_status" = ANY (ARRAY['statute_derived'::"text", 'attorney_reviewed'::"text", 'outdated'::"text"])))
);


ALTER TABLE "public"."lease_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "application_id" "uuid",
    "app_id" "text",
    "parent_lease_id" "uuid",
    "listing_id" "text",
    "landlord_id" "uuid",
    "property_address" "text",
    "lease_state_code" "text",
    "lease_start_date" "date",
    "lease_end_date" "date",
    "monthly_rent" numeric(10,2),
    "security_deposit" numeric(10,2),
    "move_in_costs" numeric(10,2),
    "first_month_rent" numeric(10,2),
    "last_month_rent" numeric(10,2),
    "pet_deposit" numeric(10,2),
    "pet_rent" numeric(10,2),
    "admin_fee" numeric(10,2),
    "key_deposit" numeric(10,2),
    "parking_fee" numeric(10,2),
    "cleaning_fee" numeric(10,2),
    "cleaning_fee_refundable" boolean,
    "rent_due_day_of_month" integer,
    "rent_proration_method" "text",
    "prorated_first_month" numeric(10,2),
    "utility_responsibilities" "jsonb",
    "lease_landlord_name" "text",
    "lease_landlord_address" "text",
    "lease_late_fee_flat" numeric(10,2),
    "lease_late_fee_daily" numeric(10,2),
    "lease_pets_policy" "text",
    "lease_smoking_policy" "text",
    "lease_compliance_snapshot" "text",
    "lease_notes" "text",
    "lease_template_version_id" "uuid",
    "lease_pdf_url" "text",
    "tenant_signature" "text",
    "tenant_signature_image" "text",
    "signature_timestamp" timestamp with time zone,
    "lease_ip_address" "text",
    "co_applicant_signature" "text",
    "co_applicant_signature_image" "text",
    "co_applicant_signature_timestamp" timestamp with time zone,
    "management_signed" boolean DEFAULT false,
    "management_signer_name" "text",
    "management_signed_at" timestamp with time zone,
    "management_notes" "text",
    "management_cosigned" boolean DEFAULT false,
    "management_cosigned_by" "text",
    "management_cosigned_at" timestamp with time zone,
    "lease_status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "lease_sent_date" timestamp with time zone,
    "lease_signed_date" timestamp with time zone,
    "executed_at" timestamp with time zone,
    "terminated_at" timestamp with time zone,
    "termination_reason" "text",
    "renewed_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "cancellation_reason" "text",
    "lease_expiry_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "text",
    CONSTRAINT "leases_rent_due_day_of_month_check" CHECK ((("rent_due_day_of_month" >= 1) AND ("rent_due_day_of_month" <= 28))),
    CONSTRAINT "leases_status_check" CHECK (("lease_status" = ANY (ARRAY['draft'::"text", 'sent'::"text", 'partially_signed'::"text", 'fully_signed'::"text", 'active'::"text", 'expiring'::"text", 'expired'::"text", 'terminated'::"text", 'renewed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."leases" OWNER TO "postgres";


COMMENT ON TABLE "public"."leases" IS 'Phase 10: leases lifted out of applications. One application can spawn many leases (renewals, replacements). All lease ops should be keyed by leases.id; applications.lease_* columns are deprecated and slated for removal in Phase 14.';



COMMENT ON COLUMN "public"."leases"."app_id" IS 'Human-readable application id (matches applications.app_id). Denormalized for log/email/legacy continuity. Authoritative join is leases.application_id → applications.id.';



COMMENT ON COLUMN "public"."leases"."parent_lease_id" IS 'Phase 11: FK to the prior lease this row renews/replaces. NULL for original leases.';



COMMENT ON COLUMN "public"."leases"."lease_status" IS 'Lifecycle state: draft → sent → partially_signed → fully_signed → active → (expiring | expired | terminated | renewed | cancelled).';



CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "app_id" "text" NOT NULL,
    "sender" "public"."message_sender" NOT NULL,
    "sender_name" "text",
    "message" "text" NOT NULL,
    "read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."open_issues" AS
 SELECT "id",
    "title",
    "description",
    "severity",
    "component",
    "created_at",
    "created_by",
    "metadata"
   FROM "public"."agent_issues"
  WHERE ("status" = 'open'::"text")
  ORDER BY
        CASE "severity"
            WHEN 'critical'::"text" THEN 0
            WHEN 'high'::"text" THEN 1
            WHEN 'medium'::"text" THEN 2
            WHEN 'low'::"text" THEN 3
            ELSE 4
        END, "created_at" DESC;


ALTER VIEW "public"."open_issues" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."properties" (
    "id" "text" NOT NULL,
    "landlord_id" "uuid",
    "status" "public"."property_status" DEFAULT 'draft'::"public"."property_status",
    "title" "text" NOT NULL,
    "description" "text",
    "showing_instructions" "text",
    "address" "text" NOT NULL,
    "city" "text" NOT NULL,
    "state" "text" NOT NULL,
    "zip" "text" NOT NULL,
    "county" "text",
    "lat" double precision,
    "lng" double precision,
    "property_type" "text",
    "year_built" integer,
    "floors" integer,
    "unit_number" "text",
    "total_units" integer,
    "bedrooms" integer,
    "bathrooms" double precision,
    "half_bathrooms" integer,
    "square_footage" integer,
    "lot_size_sqft" integer,
    "garage_spaces" integer,
    "monthly_rent" integer NOT NULL,
    "security_deposit" integer,
    "last_months_rent" integer,
    "application_fee" integer DEFAULT 0,
    "pet_deposit" integer,
    "admin_fee" integer,
    "move_in_special" "text",
    "available_date" "date",
    "lease_terms" "text"[],
    "minimum_lease_months" integer,
    "pets_allowed" boolean DEFAULT false,
    "pet_types_allowed" "text"[],
    "pet_weight_limit" integer,
    "pet_details" "text",
    "smoking_allowed" boolean DEFAULT false,
    "utilities_included" "text"[],
    "parking" "text",
    "parking_fee" integer,
    "amenities" "text"[],
    "appliances" "text"[],
    "flooring" "text"[],
    "heating_type" "text",
    "cooling_type" "text",
    "laundry_type" "text",
    "virtual_tour_url" "text",
    "views_count" integer DEFAULT 0,
    "applications_count" integer DEFAULT 0,
    "saves_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "search_tsv" "tsvector" GENERATED ALWAYS AS ("to_tsvector"('"english"'::"regconfig", ((((((((((((COALESCE("title", ''::"text") || ' '::"text") || COALESCE("city", ''::"text")) || ' '::"text") || COALESCE("state", ''::"text")) || ' '::"text") || COALESCE("address", ''::"text")) || ' '::"text") || COALESCE("description", ''::"text")) || ' '::"text") || COALESCE("property_type", ''::"text")) || ' '::"text") || "public"."immutable_array_to_text"(COALESCE("amenities", '{}'::"text"[]), ' '::"text")))) STORED,
    "has_central_air" boolean,
    "total_bathrooms" numeric,
    "has_basement" boolean,
    "location_context" "text",
    "neighborhood" "text",
    "minimum_income_multiplier" numeric(4,1) DEFAULT NULL::numeric,
    "minimum_credit_score" integer,
    "admin_notes" "text",
    "featured" boolean DEFAULT false NOT NULL,
    "listed_at" "date",
    "source_status" "text",
    "last_verified_at" timestamp with time zone,
    "ai_features" "jsonb" DEFAULT '[]'::"jsonb",
    "embedding" "public"."vector"(384),
    "building_name" "text",
    "is_multi_unit" boolean DEFAULT false,
    "price_range" "text",
    "parent_property_id" "text",
    "source_last_updated_at" timestamp with time zone,
    "imported_at" timestamp with time zone,
    "source" "text",
    "source_url" "text",
    "source_listing_id" "text",
    "agent_name" "text",
    "agent_image_url" "text",
    "source_type" "text",
    "identity_strategy" "text",
    "identity_status" "text" DEFAULT 'review'::"text",
    "source_profile_id" "uuid",
    "source_profile_type" "text",
    "source_profile_name" "text",
    "source_profile_image_url" "text",
    "source_profile_url" "text",
    "agent_profile_url" "text",
    CONSTRAINT "chk_description_len" CHECK ((("description" IS NULL) OR ("char_length"("description") <= 5000))),
    CONSTRAINT "chk_showing_instructions_len" CHECK ((("showing_instructions" IS NULL) OR ("char_length"("showing_instructions") <= 2000))),
    CONSTRAINT "chk_title_len" CHECK ((("title" IS NULL) OR ("char_length"("title") <= 200))),
    CONSTRAINT "properties_monthly_rent_check" CHECK (("monthly_rent" > 0))
);


ALTER TABLE "public"."properties" OWNER TO "postgres";


COMMENT ON COLUMN "public"."properties"."county" IS 'County the property is located in (e.g. Los Angeles County).';



COMMENT ON COLUMN "public"."properties"."has_central_air" IS 'True if the property has central air conditioning.';



COMMENT ON COLUMN "public"."properties"."has_basement" IS 'True if the property has a basement.';



COMMENT ON COLUMN "public"."properties"."location_context" IS 'Free-form location notes shown to prospective tenants.';



COMMENT ON COLUMN "public"."properties"."neighborhood" IS 'Neighborhood name (e.g. Silver Lake, Midtown).';



COMMENT ON COLUMN "public"."properties"."minimum_income_multiplier" IS 'Required gross monthly income as a multiple of monthly rent (e.g. 3 = 3× rent). Null means no requirement.';



COMMENT ON COLUMN "public"."properties"."minimum_credit_score" IS 'Minimum acceptable credit score for applicants. Null means no minimum.';



COMMENT ON COLUMN "public"."properties"."admin_notes" IS 'Internal admin-only memo. Never exposed to landlords or tenants.';



COMMENT ON COLUMN "public"."properties"."featured" IS 'When true the property is promoted/featured on the public listing page.';



CREATE TABLE IF NOT EXISTS "public"."property_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "text" NOT NULL,
    "url" "text" NOT NULL,
    "file_id" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    "alt_text" "text",
    "caption" "text",
    "watermark_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "width" integer,
    "height" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_hero" boolean DEFAULT false NOT NULL,
    "perceptual_hash" "text",
    CONSTRAINT "property_photos_watermark_status_check" CHECK (("watermark_status" = ANY (ARRAY['pending'::"text", 'applied'::"text", 'skipped'::"text", 'failed'::"text", 'watermark'::"text", 'branding'::"text", 'unscanned'::"text", 'clean'::"text"])))
);


ALTER TABLE "public"."property_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."property_units" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "text" NOT NULL,
    "unit_number" "text" NOT NULL,
    "bedrooms" numeric(3,1),
    "bathrooms" numeric(3,1),
    "square_footage" integer,
    "monthly_rent" integer NOT NULL,
    "security_deposit" integer,
    "available_date" "date",
    "status" "text" DEFAULT 'active'::"text",
    "floor_plan_name" "text",
    "floor_plan_image_url" "text",
    "unit_photos" "jsonb" DEFAULT '[]'::"jsonb",
    "amenities" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."property_units" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."public_landlord_profiles" WITH ("security_invoker"='on') AS
 SELECT "id",
    "account_type",
    "business_name",
    "contact_name",
    "avatar_url",
    "tagline",
    "bio",
    "website",
    "license_number",
    "license_state",
    "years_experience",
    "specialties",
    "social_facebook",
    "social_instagram",
    "social_linkedin",
    "verified",
    "created_at"
   FROM "public"."landlords";


ALTER VIEW "public"."public_landlord_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_limit_log" (
    "id" bigint NOT NULL,
    "ip" "text" NOT NULL,
    "endpoint" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rate_limit_log" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."rate_limit_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."rate_limit_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."rate_limit_log_id_seq" OWNED BY "public"."rate_limit_log"."id";



CREATE TABLE IF NOT EXISTS "public"."saved_properties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "property_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."saved_properties" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sign_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "app_id" "text" NOT NULL,
    "signer_type" "text" NOT NULL,
    "signer_name" "text" NOT NULL,
    "signer_email" "text",
    "ip_address" "text" NOT NULL,
    "user_agent" "text",
    "signed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "token_used" "text",
    "lease_pdf_path" "text",
    "signature_image" "text",
    CONSTRAINT "sign_events_signer_type_check" CHECK (("signer_type" = ANY (ARRAY['tenant'::"text", 'co_applicant'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."sign_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."source_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source" "text" NOT NULL,
    "profile_key" "text" NOT NULL,
    "profile_type" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "image_url" "text",
    "profile_url" "text",
    "website_url" "text",
    "description" "text",
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "source_profiles_profile_type_check" CHECK (("profile_type" = ANY (ARRAY['agent'::"text", 'company'::"text"])))
);


ALTER TABLE "public"."source_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."state_lease_law" (
    "state_code" character(2) NOT NULL,
    "state_name" "text" NOT NULL,
    "security_deposit_max_months" numeric(4,2),
    "security_deposit_return_days" integer NOT NULL,
    "security_deposit_interest_required" boolean DEFAULT false NOT NULL,
    "security_deposit_separate_account" boolean DEFAULT false NOT NULL,
    "security_deposit_bank_disclosure" boolean DEFAULT false NOT NULL,
    "late_fee_grace_period_days" integer,
    "late_fee_cap_pct_of_rent" numeric(5,2),
    "late_fee_cap_flat" numeric(10,2),
    "late_fee_no_fee_until_days" integer,
    "entry_notice_hours" integer DEFAULT 24 NOT NULL,
    "entry_notice_emergency_exempt" boolean DEFAULT true NOT NULL,
    "eviction_notice_nonpayment_days" integer NOT NULL,
    "eviction_notice_other_breach_days" integer NOT NULL,
    "holdover_rule" "text" NOT NULL,
    "just_cause_required" boolean DEFAULT false NOT NULL,
    "rent_increase_notice_days" integer DEFAULT 30 NOT NULL,
    "rent_increase_large_notice_days" integer,
    "rent_increase_large_threshold_pct" numeric(5,2),
    "required_translation_languages" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "statute_security_deposit" "text",
    "statute_late_fees" "text",
    "statute_entry" "text",
    "statute_eviction" "text",
    "statute_holdover" "text",
    "notes" "text",
    "source_last_reviewed" "date",
    "reviewed_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "state_lease_law_holdover_rule_chk" CHECK (("holdover_rule" = ANY (ARRAY['double_rent'::"text", 'month_to_month'::"text", 'court_discretion'::"text"])))
);


ALTER TABLE "public"."state_lease_law" OWNER TO "postgres";


ALTER TABLE ONLY "pipeline"."pipeline_enrichment_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"pipeline"."pipeline_enrichment_log_id_seq"'::"regclass");



ALTER TABLE ONLY "pipeline"."pipeline_scrape_runs" ALTER COLUMN "id" SET DEFAULT "nextval"('"pipeline"."pipeline_scrape_runs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."agent_issues" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."agent_issues_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."bot_attempts" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."bot_attempts_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."client_errors" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."client_errors_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."consent_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."consent_log_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."lease_addenda_attached" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."lease_addenda_attached_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."rate_limit_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."rate_limit_log_id_seq"'::"regclass");



ALTER TABLE ONLY "pipeline"."pipeline_enrichment_log"
    ADD CONSTRAINT "pipeline_enrichment_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "pipeline"."pipeline_folders"
    ADD CONSTRAINT "pipeline_folders_name_key" UNIQUE ("name");



ALTER TABLE ONLY "pipeline"."pipeline_folders"
    ADD CONSTRAINT "pipeline_folders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "pipeline"."pipeline_properties"
    ADD CONSTRAINT "pipeline_properties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "pipeline"."pipeline_properties"
    ADD CONSTRAINT "pipeline_properties_source_listing_id_key" UNIQUE ("source_listing_id");



ALTER TABLE ONLY "pipeline"."pipeline_scrape_runs"
    ADD CONSTRAINT "pipeline_scrape_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."_migration_history"
    ADD CONSTRAINT "_migration_history_pkey" PRIMARY KEY ("filename");



ALTER TABLE ONLY "public"."admin_actions"
    ADD CONSTRAINT "admin_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_roles"
    ADD CONSTRAINT "admin_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_roles"
    ADD CONSTRAINT "admin_roles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."agent_issues"
    ADD CONSTRAINT "agent_issues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."application_documents"
    ADD CONSTRAINT "application_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."application_documents"
    ADD CONSTRAINT "application_documents_storage_path_key" UNIQUE ("storage_path");



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_app_id_key" UNIQUE ("app_id");



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bot_attempts"
    ADD CONSTRAINT "bot_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_collections"
    ADD CONSTRAINT "client_collections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_errors"
    ADD CONSTRAINT "client_errors_fingerprint_uniq" UNIQUE ("fingerprint");



ALTER TABLE ONLY "public"."client_errors"
    ADD CONSTRAINT "client_errors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."co_applicants"
    ADD CONSTRAINT "co_applicants_app_id_unique" UNIQUE ("app_id");



ALTER TABLE ONLY "public"."co_applicants"
    ADD CONSTRAINT "co_applicants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."consent_log"
    ADD CONSTRAINT "consent_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credentials_config"
    ADD CONSTRAINT "credentials_config_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."draft_applications"
    ADD CONSTRAINT "draft_applications_pkey" PRIMARY KEY ("token");



ALTER TABLE ONLY "public"."email_logs"
    ADD CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."esign_consents"
    ADD CONSTRAINT "esign_consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inquiries"
    ADD CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."landlords"
    ADD CONSTRAINT "landlords_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."landlords"
    ADD CONSTRAINT "landlords_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."lease_addenda_attached"
    ADD CONSTRAINT "lease_addenda_attached_app_slug_unique" UNIQUE ("app_id", "addendum_slug");



ALTER TABLE ONLY "public"."lease_addenda_attached"
    ADD CONSTRAINT "lease_addenda_attached_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lease_addenda_library"
    ADD CONSTRAINT "lease_addenda_library_pkey" PRIMARY KEY ("slug");



ALTER TABLE ONLY "public"."lease_amendments"
    ADD CONSTRAINT "lease_amendments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lease_amendments"
    ADD CONSTRAINT "lease_amendments_signing_token_key" UNIQUE ("signing_token");



ALTER TABLE ONLY "public"."lease_deposit_accountings"
    ADD CONSTRAINT "lease_deposit_accountings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lease_deposit_deductions"
    ADD CONSTRAINT "lease_deposit_deductions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lease_inspection_photos"
    ADD CONSTRAINT "lease_inspection_photos_inspection_id_storage_path_key" UNIQUE ("inspection_id", "storage_path");



ALTER TABLE ONLY "public"."lease_inspection_photos"
    ADD CONSTRAINT "lease_inspection_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lease_inspections"
    ADD CONSTRAINT "lease_inspections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lease_lifecycle_documents"
    ADD CONSTRAINT "lease_lifecycle_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lease_pdf_versions"
    ADD CONSTRAINT "lease_pdf_versions_app_id_version_number_key" UNIQUE ("app_id", "version_number");



ALTER TABLE ONLY "public"."lease_pdf_versions"
    ADD CONSTRAINT "lease_pdf_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lease_signing_tokens"
    ADD CONSTRAINT "lease_signing_tokens_pkey" PRIMARY KEY ("token");



ALTER TABLE ONLY "public"."lease_template_partials"
    ADD CONSTRAINT "lease_template_partials_pkey" PRIMARY KEY ("slug", "locale");



ALTER TABLE ONLY "public"."lease_template_versions"
    ADD CONSTRAINT "lease_template_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lease_template_versions"
    ADD CONSTRAINT "lease_template_versions_template_id_version_number_key" UNIQUE ("template_id", "version_number");



ALTER TABLE ONLY "public"."lease_templates"
    ADD CONSTRAINT "lease_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leases"
    ADD CONSTRAINT "leases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_photos"
    ADD CONSTRAINT "property_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_photos"
    ADD CONSTRAINT "property_photos_property_id_display_order_key" UNIQUE ("property_id", "display_order");



ALTER TABLE ONLY "public"."property_units"
    ADD CONSTRAINT "property_units_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_limit_log"
    ADD CONSTRAINT "rate_limit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_properties"
    ADD CONSTRAINT "saved_properties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sign_events"
    ADD CONSTRAINT "sign_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."source_profiles"
    ADD CONSTRAINT "source_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."source_profiles"
    ADD CONSTRAINT "source_profiles_source_profile_key_key" UNIQUE ("source", "profile_key");



ALTER TABLE ONLY "public"."state_lease_law"
    ADD CONSTRAINT "state_lease_law_pkey" PRIMARY KEY ("state_code");



CREATE INDEX "idx_pipeline_enrichment_log_property_id" ON "pipeline"."pipeline_enrichment_log" USING "btree" ("property_id");



CREATE INDEX "idx_pipeline_properties_folder" ON "pipeline"."pipeline_properties" USING "btree" ("folder_id", "folder_serial");



CREATE INDEX "idx_pipeline_properties_source_listing_id" ON "pipeline"."pipeline_properties" USING "btree" ("source_listing_id");



CREATE INDEX "idx_pipeline_properties_status" ON "pipeline"."pipeline_properties" USING "btree" ("status");



CREATE INDEX "idx_scrape_runs_completed" ON "pipeline"."pipeline_scrape_runs" USING "btree" ("completed_at" DESC);



CREATE INDEX "idx_scrape_runs_source" ON "pipeline"."pipeline_scrape_runs" USING "btree" ("source");



CREATE INDEX "pipeline_properties_identity_idx" ON "pipeline"."pipeline_properties" USING "btree" ("source", "identity_strategy", "source_profile_id");



CREATE INDEX "admin_actions_created_at" ON "public"."admin_actions" USING "btree" ("created_at" DESC);



CREATE INDEX "admin_actions_user_id" ON "public"."admin_actions" USING "btree" ("user_id");



CREATE UNIQUE INDEX "agent_issues_fingerprint_uniq" ON "public"."agent_issues" USING "btree" ("fingerprint") WHERE ("fingerprint" IS NOT NULL);



CREATE INDEX "agent_issues_kind_status_idx" ON "public"."agent_issues" USING "btree" ("kind", "status");



CREATE INDEX "agent_issues_resolved_at_idx" ON "public"."agent_issues" USING "btree" ("resolved_at") WHERE ("status" = 'resolved'::"text");



CREATE INDEX "agent_issues_status_idx" ON "public"."agent_issues" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "applications_current_lease_id_idx" ON "public"."applications" USING "btree" ("current_lease_id");



CREATE INDEX "applications_lease_template_version_idx" ON "public"."applications" USING "btree" ("lease_template_version_id");



CREATE UNIQUE INDEX "applications_submission_uuid_uq" ON "public"."applications" USING "btree" ("submission_uuid");



CREATE INDEX "bot_attempts_created_idx" ON "public"."bot_attempts" USING "btree" ("created_at" DESC);



CREATE INDEX "bot_attempts_ip_idx" ON "public"."bot_attempts" USING "btree" ("ip");



CREATE INDEX "client_errors_hit_count_idx" ON "public"."client_errors" USING "btree" ("hit_count" DESC);



CREATE INDEX "client_errors_last_seen_idx" ON "public"."client_errors" USING "btree" ("last_seen_at" DESC);



CREATE INDEX "consent_log_app_id_idx" ON "public"."consent_log" USING "btree" ("app_id");



CREATE INDEX "consent_log_created_idx" ON "public"."consent_log" USING "btree" ("created_at" DESC);



CREATE INDEX "consent_log_email_idx" ON "public"."consent_log" USING "btree" ("lower"("email"));



CREATE INDEX "draft_applications_created_at_idx" ON "public"."draft_applications" USING "btree" ("created_at");



CREATE INDEX "draft_applications_email_idx" ON "public"."draft_applications" USING "btree" ("email");



CREATE INDEX "draft_applications_token_idx" ON "public"."draft_applications" USING "btree" ("token");



CREATE INDEX "esign_consents_lease_id_idx" ON "public"."esign_consents" USING "btree" ("lease_id");



CREATE INDEX "idx_application_documents_app_id" ON "public"."application_documents" USING "btree" ("app_id");



CREATE INDEX "idx_application_documents_status" ON "public"."application_documents" USING "btree" ("status");



CREATE INDEX "idx_application_documents_user_id" ON "public"."application_documents" USING "btree" ("user_id");



CREATE INDEX "idx_applications_applicant_user_id" ON "public"."applications" USING "btree" ("applicant_user_id");



CREATE INDEX "idx_applications_landlord_id" ON "public"."applications" USING "btree" ("landlord_id");



CREATE INDEX "idx_applications_management_signed" ON "public"."applications" USING "btree" ("management_signed");



CREATE INDEX "idx_applications_move_out_date_actual" ON "public"."applications" USING "btree" ("move_out_date_actual") WHERE ("move_out_date_actual" IS NOT NULL);



CREATE INDEX "idx_applications_property_id" ON "public"."applications" USING "btree" ("property_id");



CREATE INDEX "idx_credentials_config_key" ON "public"."credentials_config" USING "btree" ("key");



CREATE INDEX "idx_draft_applications_nudge" ON "public"."draft_applications" USING "btree" ("created_at", "nudge_sent_at") WHERE ("nudge_sent_at" IS NULL);



CREATE INDEX "idx_email_logs_app_id" ON "public"."email_logs" USING "btree" ("app_id");



CREATE INDEX "idx_esign_consents_active" ON "public"."esign_consents" USING "btree" ("app_id", "lower"("signer_email"), "disclosure_version") WHERE (("withdrawn_at" IS NULL) AND ("consent_given" = true));



CREATE INDEX "idx_esign_consents_app" ON "public"."esign_consents" USING "btree" ("app_id");



CREATE INDEX "idx_esign_consents_email_version" ON "public"."esign_consents" USING "btree" ("lower"("signer_email"), "disclosure_version");



CREATE INDEX "idx_inquiries_property_id" ON "public"."inquiries" USING "btree" ("property_id");



CREATE INDEX "idx_lease_deposit_accountings_app_id" ON "public"."lease_deposit_accountings" USING "btree" ("app_id");



CREATE INDEX "idx_lease_deposit_accountings_deadline" ON "public"."lease_deposit_accountings" USING "btree" ("state_return_deadline") WHERE ("state_return_deadline" IS NOT NULL);



CREATE INDEX "idx_lease_deposit_accountings_generated_at" ON "public"."lease_deposit_accountings" USING "btree" ("generated_at" DESC NULLS LAST);



CREATE INDEX "idx_lease_deposit_deductions_accounting" ON "public"."lease_deposit_deductions" USING "btree" ("accounting_id");



CREATE INDEX "idx_lease_deposit_deductions_app" ON "public"."lease_deposit_deductions" USING "btree" ("app_id");



CREATE INDEX "idx_lease_deposit_deductions_inspection" ON "public"."lease_deposit_deductions" USING "btree" ("inspection_id") WHERE ("inspection_id" IS NOT NULL);



CREATE INDEX "idx_lease_inspection_photos_app_room" ON "public"."lease_inspection_photos" USING "btree" ("app_id", "room_key");



CREATE INDEX "idx_lease_inspection_photos_inspection" ON "public"."lease_inspection_photos" USING "btree" ("inspection_id");



CREATE INDEX "idx_lease_inspections_app_id" ON "public"."lease_inspections" USING "btree" ("app_id");



CREATE INDEX "idx_lease_inspections_app_type" ON "public"."lease_inspections" USING "btree" ("app_id", "inspection_type");



CREATE INDEX "idx_lease_inspections_completed" ON "public"."lease_inspections" USING "btree" ("completed_at");



CREATE INDEX "idx_lease_pdf_versions_amendment_id" ON "public"."lease_pdf_versions" USING "btree" ("amendment_id");



CREATE INDEX "idx_lease_pdf_versions_legacy_pending" ON "public"."lease_pdf_versions" USING "btree" ("created_at") WHERE (("legacy_pre_phase06" = true) AND ("sha256" IS NULL));



CREATE INDEX "idx_lease_pdf_versions_template_version_id" ON "public"."lease_pdf_versions" USING "btree" ("template_version_id");



CREATE INDEX "idx_lease_template_versions_state_code" ON "public"."lease_template_versions" USING "btree" ("state_code");



CREATE UNIQUE INDEX "idx_lease_templates_active_per_state_locale" ON "public"."lease_templates" USING "btree" ("state_code", "locale") WHERE ("is_active" = true);



CREATE INDEX "idx_messages_app_id" ON "public"."messages" USING "btree" ("app_id");



CREATE INDEX "idx_properties_address_city" ON "public"."properties" USING "btree" ("address", "city");



CREATE INDEX "idx_properties_city" ON "public"."properties" USING "btree" ("city");



CREATE INDEX "idx_properties_created_at" ON "public"."properties" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_properties_featured" ON "public"."properties" USING "btree" ("featured") WHERE ("featured" = true);



CREATE INDEX "idx_properties_landlord_id" ON "public"."properties" USING "btree" ("landlord_id");



CREATE INDEX "idx_properties_parent_id" ON "public"."properties" USING "btree" ("parent_property_id");



CREATE INDEX "idx_properties_property_type" ON "public"."properties" USING "btree" ("property_type");



CREATE INDEX "idx_properties_search_gin" ON "public"."properties" USING "gin" ("search_tsv");



CREATE INDEX "idx_properties_state" ON "public"."properties" USING "btree" ("state");



CREATE INDEX "idx_properties_status" ON "public"."properties" USING "btree" ("status");



CREATE INDEX "idx_properties_status_avail" ON "public"."properties" USING "btree" ("status", "available_date");



CREATE INDEX "idx_properties_status_beds" ON "public"."properties" USING "btree" ("status", "bedrooms");



CREATE INDEX "idx_properties_status_rent" ON "public"."properties" USING "btree" ("status", "monthly_rent");



CREATE INDEX "idx_properties_status_type" ON "public"."properties" USING "btree" ("status", "property_type");



CREATE INDEX "idx_property_photos_file_id" ON "public"."property_photos" USING "btree" ("file_id") WHERE ("file_id" IS NOT NULL);



CREATE INDEX "idx_property_photos_property_order" ON "public"."property_photos" USING "btree" ("property_id", "display_order");



CREATE INDEX "idx_property_photos_watermark_status" ON "public"."property_photos" USING "btree" ("watermark_status") WHERE ("watermark_status" = ANY (ARRAY['branding'::"text", 'watermark'::"text", 'flagged'::"text"]));



CREATE INDEX "idx_property_units_property_id" ON "public"."property_units" USING "btree" ("property_id");



CREATE INDEX "idx_saved_properties_property_id" ON "public"."saved_properties" USING "btree" ("property_id");



CREATE INDEX "idx_saved_properties_user_id" ON "public"."saved_properties" USING "btree" ("user_id");



CREATE INDEX "idx_signing_tokens_active" ON "public"."lease_signing_tokens" USING "btree" ("app_id", "signer_role") WHERE (("used_at" IS NULL) AND ("revoked_at" IS NULL));



CREATE INDEX "idx_signing_tokens_amendment" ON "public"."lease_signing_tokens" USING "btree" ("amendment_id");



CREATE INDEX "idx_signing_tokens_app" ON "public"."lease_signing_tokens" USING "btree" ("app_id");



CREATE INDEX "idx_signing_tokens_email" ON "public"."lease_signing_tokens" USING "btree" ("lower"("signer_email"));



CREATE INDEX "lease_addenda_attached_app_id_idx" ON "public"."lease_addenda_attached" USING "btree" ("app_id");



CREATE INDEX "lease_addenda_attached_application_pk_idx" ON "public"."lease_addenda_attached" USING "btree" ("application_pk") WHERE ("application_pk" IS NOT NULL);



CREATE INDEX "lease_addenda_attached_lease_id_idx" ON "public"."lease_addenda_attached" USING "btree" ("lease_id");



CREATE INDEX "lease_addenda_attached_slug_idx" ON "public"."lease_addenda_attached" USING "btree" ("addendum_slug");



CREATE INDEX "lease_addenda_library_active_idx" ON "public"."lease_addenda_library" USING "btree" ("is_active") WHERE "is_active";



CREATE INDEX "lease_addenda_library_jurisdiction_active_idx" ON "public"."lease_addenda_library" USING "btree" ("jurisdiction", "is_active");



CREATE INDEX "lease_amendments_app_idx" ON "public"."lease_amendments" USING "btree" ("app_id", "created_at" DESC);



CREATE INDEX "lease_amendments_lease_id_idx" ON "public"."lease_amendments" USING "btree" ("lease_id");



CREATE INDEX "lease_amendments_token_idx" ON "public"."lease_amendments" USING "btree" ("signing_token") WHERE ("signing_token" IS NOT NULL);



CREATE INDEX "lease_deposit_accountings_lease_id_idx" ON "public"."lease_deposit_accountings" USING "btree" ("lease_id");



CREATE INDEX "lease_inspection_photos_lease_id_idx" ON "public"."lease_inspection_photos" USING "btree" ("lease_id");



CREATE INDEX "lease_inspections_lease_id_idx" ON "public"."lease_inspections" USING "btree" ("lease_id");



CREATE INDEX "lease_lifecycle_documents_doc_type_idx" ON "public"."lease_lifecycle_documents" USING "btree" ("doc_type");



CREATE INDEX "lease_lifecycle_documents_effective_date_idx" ON "public"."lease_lifecycle_documents" USING "btree" ("effective_date");



CREATE INDEX "lease_lifecycle_documents_lease_id_idx" ON "public"."lease_lifecycle_documents" USING "btree" ("lease_id");



CREATE INDEX "lease_pdf_versions_app_idx" ON "public"."lease_pdf_versions" USING "btree" ("app_id", "version_number" DESC);



CREATE INDEX "lease_pdf_versions_lease_id_idx" ON "public"."lease_pdf_versions" USING "btree" ("lease_id");



CREATE UNIQUE INDEX "lease_pdf_versions_qr_verify_token_uq" ON "public"."lease_pdf_versions" USING "btree" ("qr_verify_token") WHERE ("qr_verify_token" IS NOT NULL);



CREATE INDEX "lease_pdf_versions_sha256_idx" ON "public"."lease_pdf_versions" USING "btree" ("sha256") WHERE ("sha256" IS NOT NULL);



CREATE INDEX "lease_signing_tokens_lease_id_idx" ON "public"."lease_signing_tokens" USING "btree" ("lease_id");



CREATE INDEX "lease_template_versions_template_idx" ON "public"."lease_template_versions" USING "btree" ("template_id", "version_number" DESC);



CREATE UNIQUE INDEX "leases_active_per_app_idx" ON "public"."leases" USING "btree" ("application_id") WHERE ("lease_status" = ANY (ARRAY['draft'::"text", 'sent'::"text", 'partially_signed'::"text", 'fully_signed'::"text", 'active'::"text", 'expiring'::"text"]));



CREATE INDEX "leases_app_id_idx" ON "public"."leases" USING "btree" ("app_id");



CREATE INDEX "leases_application_id_idx" ON "public"."leases" USING "btree" ("application_id");



CREATE INDEX "leases_landlord_id_idx" ON "public"."leases" USING "btree" ("landlord_id");



CREATE INDEX "leases_lease_end_date_idx" ON "public"."leases" USING "btree" ("lease_end_date");



CREATE INDEX "leases_lease_status_idx" ON "public"."leases" USING "btree" ("lease_status");



CREATE INDEX "leases_parent_lease_id_idx" ON "public"."leases" USING "btree" ("parent_lease_id");



CREATE INDEX "properties_identity_idx" ON "public"."properties" USING "btree" ("source", "identity_strategy", "source_profile_id");



CREATE INDEX "rate_limit_log_lookup" ON "public"."rate_limit_log" USING "btree" ("ip", "endpoint", "created_at");



CREATE INDEX "source_profiles_source_key_idx" ON "public"."source_profiles" USING "btree" ("source", "profile_key");



CREATE UNIQUE INDEX "uq_lease_deposit_accountings_app_no_termination" ON "public"."lease_deposit_accountings" USING "btree" ("app_id") WHERE ("lease_termination_id" IS NULL);



CREATE UNIQUE INDEX "uq_lease_deposit_accountings_app_termination" ON "public"."lease_deposit_accountings" USING "btree" ("app_id", "lease_termination_id") WHERE ("lease_termination_id" IS NOT NULL);



CREATE OR REPLACE TRIGGER "pipeline_source_identity_contract" BEFORE INSERT OR UPDATE OF "source", "agent_name", "broker_name", "source_profile_name", "source_profile_image_url", "source_profile_url", "poster_landlord_id" ON "pipeline"."pipeline_properties" FOR EACH ROW EXECUTE FUNCTION "public"."apply_source_identity_contract"();



CREATE OR REPLACE TRIGGER "applications_register_token" AFTER INSERT OR UPDATE OF "tenant_sign_token", "co_applicant_lease_token" ON "public"."applications" FOR EACH ROW EXECUTE FUNCTION "public"."tg_application_register_token"();



CREATE OR REPLACE TRIGGER "landlords_updated_at" BEFORE UPDATE ON "public"."landlords" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "lease_addenda_library_touch" BEFORE UPDATE ON "public"."lease_addenda_library" FOR EACH ROW EXECUTE FUNCTION "public"."lease_addenda_library_touch_updated_at"();



CREATE OR REPLACE TRIGGER "lease_amendments_register_token" AFTER INSERT OR UPDATE OF "signing_token" ON "public"."lease_amendments" FOR EACH ROW EXECUTE FUNCTION "public"."tg_amendment_register_token"();



CREATE OR REPLACE TRIGGER "lease_amendments_updated_at" BEFORE UPDATE ON "public"."lease_amendments" FOR EACH ROW EXECUTE FUNCTION "public"."update_lease_template_updated_at"();



CREATE OR REPLACE TRIGGER "lease_deposit_accountings_touch" BEFORE UPDATE ON "public"."lease_deposit_accountings" FOR EACH ROW EXECUTE FUNCTION "public"."lease_deposit_accountings_touch_updated_at"();



CREATE OR REPLACE TRIGGER "lease_deposit_deductions_touch" BEFORE UPDATE ON "public"."lease_deposit_deductions" FOR EACH ROW EXECUTE FUNCTION "public"."lease_deposit_deductions_touch_updated_at"();



CREATE OR REPLACE TRIGGER "lease_inspection_photos_recount_ins" AFTER INSERT OR DELETE ON "public"."lease_inspection_photos" FOR EACH ROW EXECUTE FUNCTION "public"."lease_inspections_recount_photos"();



CREATE OR REPLACE TRIGGER "lease_inspections_touch" BEFORE UPDATE ON "public"."lease_inspections" FOR EACH ROW EXECUTE FUNCTION "public"."lease_inspections_touch_updated_at"();



CREATE OR REPLACE TRIGGER "lease_template_partials_touch" BEFORE UPDATE ON "public"."lease_template_partials" FOR EACH ROW EXECUTE FUNCTION "public"."lease_template_partials_touch_updated_at"();



CREATE OR REPLACE TRIGGER "leases_set_updated_at" BEFORE UPDATE ON "public"."leases" FOR EACH ROW EXECUTE FUNCTION "public"."_leases_set_updated_at"();



CREATE OR REPLACE TRIGGER "properties_updated_at" BEFORE UPDATE ON "public"."properties" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "property_photos_updated_at" BEFORE UPDATE ON "public"."property_photos" FOR EACH ROW EXECUTE FUNCTION "public"."property_photos_set_updated_at"();



CREATE OR REPLACE TRIGGER "saves_count_trigger" AFTER INSERT OR DELETE ON "public"."saved_properties" FOR EACH ROW EXECUTE FUNCTION "public"."trg_saves_count"();



CREATE OR REPLACE TRIGGER "state_lease_law_touch" BEFORE UPDATE ON "public"."state_lease_law" FOR EACH ROW EXECUTE FUNCTION "public"."state_lease_law_touch_updated_at"();



ALTER TABLE ONLY "pipeline"."pipeline_enrichment_log"
    ADD CONSTRAINT "pipeline_enrichment_log_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "pipeline"."pipeline_properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "pipeline"."pipeline_properties"
    ADD CONSTRAINT "pipeline_properties_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "pipeline"."pipeline_folders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "pipeline"."pipeline_properties"
    ADD CONSTRAINT "pipeline_properties_source_profile_id_fkey" FOREIGN KEY ("source_profile_id") REFERENCES "public"."source_profiles"("id");



ALTER TABLE ONLY "public"."admin_actions"
    ADD CONSTRAINT "admin_actions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_roles"
    ADD CONSTRAINT "admin_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."application_documents"
    ADD CONSTRAINT "application_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_applicant_user_id_fkey" FOREIGN KEY ("applicant_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_current_lease_id_fkey" FOREIGN KEY ("current_lease_id") REFERENCES "public"."leases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_landlord_id_fkey" FOREIGN KEY ("landlord_id") REFERENCES "public"."landlords"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."applications"
    ADD CONSTRAINT "applications_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_collections"
    ADD CONSTRAINT "client_collections_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."co_applicants"
    ADD CONSTRAINT "co_applicants_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."applications"("app_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."esign_consents"
    ADD CONSTRAINT "esign_consents_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."applications"("app_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."esign_consents"
    ADD CONSTRAINT "esign_consents_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inquiries"
    ADD CONSTRAINT "inquiries_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."landlords"
    ADD CONSTRAINT "landlords_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lease_addenda_attached"
    ADD CONSTRAINT "lease_addenda_attached_addendum_slug_fkey" FOREIGN KEY ("addendum_slug") REFERENCES "public"."lease_addenda_library"("slug") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."lease_addenda_attached"
    ADD CONSTRAINT "lease_addenda_attached_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lease_amendments"
    ADD CONSTRAINT "lease_amendments_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."applications"("app_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lease_amendments"
    ADD CONSTRAINT "lease_amendments_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lease_deposit_accountings"
    ADD CONSTRAINT "lease_deposit_accountings_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."applications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lease_deposit_accountings"
    ADD CONSTRAINT "lease_deposit_accountings_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lease_deposit_deductions"
    ADD CONSTRAINT "lease_deposit_deductions_accounting_id_fkey" FOREIGN KEY ("accounting_id") REFERENCES "public"."lease_deposit_accountings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lease_deposit_deductions"
    ADD CONSTRAINT "lease_deposit_deductions_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."applications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lease_deposit_deductions"
    ADD CONSTRAINT "lease_deposit_deductions_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "public"."lease_inspections"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lease_inspection_photos"
    ADD CONSTRAINT "lease_inspection_photos_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."applications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lease_inspection_photos"
    ADD CONSTRAINT "lease_inspection_photos_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "public"."lease_inspections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lease_inspections"
    ADD CONSTRAINT "lease_inspections_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."applications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lease_inspections"
    ADD CONSTRAINT "lease_inspections_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lease_lifecycle_documents"
    ADD CONSTRAINT "lease_lifecycle_documents_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lease_pdf_versions"
    ADD CONSTRAINT "lease_pdf_versions_amendment_id_fkey" FOREIGN KEY ("amendment_id") REFERENCES "public"."lease_amendments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lease_pdf_versions"
    ADD CONSTRAINT "lease_pdf_versions_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."applications"("app_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lease_pdf_versions"
    ADD CONSTRAINT "lease_pdf_versions_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lease_pdf_versions"
    ADD CONSTRAINT "lease_pdf_versions_template_version_id_fkey" FOREIGN KEY ("template_version_id") REFERENCES "public"."lease_template_versions"("id");



ALTER TABLE ONLY "public"."lease_signing_tokens"
    ADD CONSTRAINT "lease_signing_tokens_amendment_id_fkey" FOREIGN KEY ("amendment_id") REFERENCES "public"."lease_amendments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lease_signing_tokens"
    ADD CONSTRAINT "lease_signing_tokens_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."applications"("app_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lease_signing_tokens"
    ADD CONSTRAINT "lease_signing_tokens_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lease_template_versions"
    ADD CONSTRAINT "lease_template_versions_state_code_fk" FOREIGN KEY ("state_code") REFERENCES "public"."state_lease_law"("state_code") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."lease_template_versions"
    ADD CONSTRAINT "lease_template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."lease_templates"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."lease_templates"
    ADD CONSTRAINT "lease_templates_state_code_fk" FOREIGN KEY ("state_code") REFERENCES "public"."state_lease_law"("state_code") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."leases"
    ADD CONSTRAINT "leases_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leases"
    ADD CONSTRAINT "leases_parent_lease_id_fkey" FOREIGN KEY ("parent_lease_id") REFERENCES "public"."leases"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."applications"("app_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_landlord_id_fkey" FOREIGN KEY ("landlord_id") REFERENCES "public"."landlords"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_parent_property_id_fkey" FOREIGN KEY ("parent_property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_source_profile_id_fkey" FOREIGN KEY ("source_profile_id") REFERENCES "public"."source_profiles"("id");



ALTER TABLE ONLY "public"."property_photos"
    ADD CONSTRAINT "property_photos_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."property_units"
    ADD CONSTRAINT "property_units_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_properties"
    ADD CONSTRAINT "saved_properties_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_properties"
    ADD CONSTRAINT "saved_properties_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "pipeline"."pipeline_enrichment_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pipeline_enrichment_log_deny_all" ON "pipeline"."pipeline_enrichment_log" TO "authenticated", "anon" USING (false) WITH CHECK (false);



ALTER TABLE "pipeline"."pipeline_properties" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pipeline_properties_deny_all" ON "pipeline"."pipeline_properties" TO "authenticated", "anon" USING (false) WITH CHECK (false);



ALTER TABLE "pipeline"."pipeline_scrape_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pipeline_scrape_runs_deny_all" ON "pipeline"."pipeline_scrape_runs" TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "Admins can manage client collections" ON "public"."client_collections" TO "authenticated" USING ((("auth"."uid"() IS NOT NULL) AND ("auth"."uid"() IN ( SELECT "landlords"."user_id"
   FROM "public"."landlords"
  WHERE ("landlords"."verified" = true))))) WITH CHECK ((("auth"."uid"() IS NOT NULL) AND ("auth"."uid"() IN ( SELECT "landlords"."user_id"
   FROM "public"."landlords"
  WHERE ("landlords"."verified" = true)))));



CREATE POLICY "Admins manage lease_templates" ON "public"."lease_templates" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins read sign_events" ON "public"."sign_events" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Authenticated users manage property units" ON "public"."property_units" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Public read access" ON "public"."credentials_config" FOR SELECT USING (true);



CREATE POLICY "Public read property units" ON "public"."property_units" FOR SELECT USING (true);



CREATE POLICY "Service role manages property units" ON "public"."property_units" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role write access" ON "public"."credentials_config" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."_migration_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "_migration_history_deny_all" ON "public"."_migration_history" TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "addenda_attached_admin_all" ON "public"."lease_addenda_attached" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_roles" "ar"
  WHERE ("ar"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_roles" "ar"
  WHERE ("ar"."user_id" = "auth"."uid"()))));



CREATE POLICY "addenda_library_admin_all" ON "public"."lease_addenda_library" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_roles" "ar"
  WHERE ("ar"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_roles" "ar"
  WHERE ("ar"."user_id" = "auth"."uid"()))));



CREATE POLICY "addenda_library_anon_read" ON "public"."lease_addenda_library" FOR SELECT TO "anon" USING ("is_active");



CREATE POLICY "addenda_library_auth_read" ON "public"."lease_addenda_library" FOR SELECT TO "authenticated" USING ("is_active");



ALTER TABLE "public"."admin_actions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_actions_insert" ON "public"."admin_actions" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_roles"
  WHERE ("admin_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "admin_actions_select" ON "public"."admin_actions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."admin_roles"
  WHERE ("admin_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "admin_all_lifecycle_docs" ON "public"."lease_lifecycle_documents" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_roles" "ar"
  WHERE ("ar"."user_id" = "auth"."uid"()))));



CREATE POLICY "admin_read_client_errors" ON "public"."client_errors" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_roles" "ar"
  WHERE ("ar"."user_id" = "auth"."uid"()))));



CREATE POLICY "admin_read_esign_consents" ON "public"."esign_consents" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_roles"
  WHERE ("admin_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "admin_read_signing_tokens" ON "public"."lease_signing_tokens" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_roles"
  WHERE ("admin_roles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."admin_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_roles_self_read" ON "public"."admin_roles" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."agent_issues" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agent_issues_service_only" ON "public"."agent_issues" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."application_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "application_documents_admin_all" ON "public"."application_documents" USING ("public"."is_admin"());



CREATE POLICY "application_documents_applicant_read" ON "public"."application_documents" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."applications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "applications_admin_all" ON "public"."applications" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "applications_landlord_select" ON "public"."applications" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."landlords" "l"
  WHERE (("l"."user_id" = "auth"."uid"()) AND ("l"."id" = "applications"."landlord_id")))));



CREATE POLICY "applications_tenant_select" ON "public"."applications" FOR SELECT TO "authenticated" USING ((("applicant_user_id" = "auth"."uid"()) OR ("lower"("email") = "lower"("auth"."email"())) OR ("lower"("co_applicant_email") = "lower"("auth"."email"()))));



CREATE POLICY "applications_tenant_update" ON "public"."applications" FOR UPDATE TO "authenticated" USING ((("applicant_user_id" = "auth"."uid"()) OR ("lower"("email") = "lower"("auth"."email"())))) WITH CHECK ((("applicant_user_id" = "auth"."uid"()) OR ("lower"("email") = "lower"("auth"."email"()))));



ALTER TABLE "public"."bot_attempts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bot_attempts_admin_read" ON "public"."bot_attempts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."admin_roles"
  WHERE ("admin_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "bot_attempts_no_client_write" ON "public"."bot_attempts" TO "authenticated", "anon" USING (false) WITH CHECK (false);



ALTER TABLE "public"."client_collections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_errors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."co_applicants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "co_applicants_applicant_read" ON "public"."co_applicants" FOR SELECT TO "authenticated" USING ((("lower"("email") = "lower"("auth"."email"())) OR (EXISTS ( SELECT 1
   FROM "public"."applications" "a"
  WHERE (("a"."app_id" = "co_applicants"."app_id") AND (("a"."applicant_user_id" = "auth"."uid"()) OR ("lower"("a"."email") = "lower"("auth"."email"())) OR ("lower"("a"."co_applicant_email") = "lower"("auth"."email"()))))))));



ALTER TABLE "public"."consent_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "consent_log_admin_read" ON "public"."consent_log" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."admin_roles"
  WHERE ("admin_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "consent_log_no_client_write" ON "public"."consent_log" TO "authenticated", "anon" USING (false) WITH CHECK (false);



ALTER TABLE "public"."credentials_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "deny_all_anon" ON "public"."rate_limit_log" TO "authenticated", "anon" USING (false) WITH CHECK (false);



CREATE POLICY "deny_all_anon_clienterrors" ON "public"."client_errors" TO "anon" USING (false) WITH CHECK (false);



CREATE POLICY "deny_all_auth_clienterrors" ON "public"."client_errors" TO "authenticated" USING (false) WITH CHECK (false);



ALTER TABLE "public"."draft_applications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "draft_applications_deny_all" ON "public"."draft_applications" TO "authenticated", "anon" USING (false) WITH CHECK (false);



ALTER TABLE "public"."email_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "email_logs_admin_all" ON "public"."email_logs" USING ("public"."is_admin"());



ALTER TABLE "public"."esign_consents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inquiries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inquiries_admin_all" ON "public"."inquiries" USING ("public"."is_admin"());



CREATE POLICY "inquiries_landlord_read" ON "public"."inquiries" FOR SELECT USING (("property_id" IN ( SELECT "properties"."id"
   FROM "public"."properties"
  WHERE ("properties"."landlord_id" = ( SELECT "landlords"."id"
           FROM "public"."landlords"
          WHERE ("landlords"."user_id" = "auth"."uid"()))))));



CREATE POLICY "inquiries_landlord_update" ON "public"."inquiries" FOR UPDATE USING (("property_id" IN ( SELECT "properties"."id"
   FROM "public"."properties"
  WHERE ("properties"."landlord_id" = ( SELECT "landlords"."id"
           FROM "public"."landlords"
          WHERE ("landlords"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."landlords" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "landlords_admin_all" ON "public"."landlords" USING ("public"."is_admin"());



CREATE POLICY "landlords_anon_safe_read" ON "public"."landlords" FOR SELECT TO "anon" USING (true);



CREATE POLICY "landlords_auth_read" ON "public"."landlords" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "landlords_own_write" ON "public"."landlords" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."lease_addenda_attached" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lease_addenda_library" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lease_amendments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lease_amendments_admin_all" ON "public"."lease_amendments" USING ("public"."is_admin"());



CREATE POLICY "lease_amendments_applicant_read" ON "public"."lease_amendments" FOR SELECT USING (("app_id" IN ( SELECT "applications"."app_id"
   FROM "public"."applications"
  WHERE ("applications"."applicant_user_id" = "auth"."uid"()))));



ALTER TABLE "public"."lease_deposit_accountings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lease_deposit_accountings_admin_all" ON "public"."lease_deposit_accountings" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_roles"
  WHERE ("admin_roles"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_roles"
  WHERE ("admin_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "lease_deposit_accountings_anon_no_read" ON "public"."lease_deposit_accountings" FOR SELECT TO "anon" USING (false);



CREATE POLICY "lease_deposit_accountings_landlord_read" ON "public"."lease_deposit_accountings" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."applications" "a"
     JOIN "public"."properties" "p" ON (("p"."id" = "a"."property_id")))
  WHERE (("a"."id" = "lease_deposit_accountings"."app_id") AND ("p"."landlord_id" = "auth"."uid"())))));



CREATE POLICY "lease_deposit_accountings_tenant_read" ON "public"."lease_deposit_accountings" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."applications" "a"
  WHERE (("a"."id" = "lease_deposit_accountings"."app_id") AND ("lower"("a"."email") = "lower"(COALESCE("auth"."email"(), ''::"text")))))));



ALTER TABLE "public"."lease_deposit_deductions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lease_deposit_deductions_admin_all" ON "public"."lease_deposit_deductions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_roles"
  WHERE ("admin_roles"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_roles"
  WHERE ("admin_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "lease_deposit_deductions_anon_no_read" ON "public"."lease_deposit_deductions" FOR SELECT TO "anon" USING (false);



CREATE POLICY "lease_deposit_deductions_landlord_read" ON "public"."lease_deposit_deductions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."applications" "a"
     JOIN "public"."properties" "p" ON (("p"."id" = "a"."property_id")))
  WHERE (("a"."id" = "lease_deposit_deductions"."app_id") AND ("p"."landlord_id" = "auth"."uid"())))));



CREATE POLICY "lease_deposit_deductions_tenant_read" ON "public"."lease_deposit_deductions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."applications" "a"
  WHERE (("a"."id" = "lease_deposit_deductions"."app_id") AND ("lower"("a"."email") = "lower"(COALESCE("auth"."email"(), ''::"text")))))));



ALTER TABLE "public"."lease_inspection_photos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lease_inspection_photos_admin_all" ON "public"."lease_inspection_photos" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_roles"
  WHERE ("admin_roles"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_roles"
  WHERE ("admin_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "lease_inspection_photos_anon_no_read" ON "public"."lease_inspection_photos" FOR SELECT TO "anon" USING (false);



CREATE POLICY "lease_inspection_photos_landlord_read" ON "public"."lease_inspection_photos" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."applications" "a"
     JOIN "public"."properties" "p" ON (("p"."id" = "a"."property_id")))
  WHERE (("a"."id" = "lease_inspection_photos"."app_id") AND ("p"."landlord_id" = "auth"."uid"())))));



CREATE POLICY "lease_inspection_photos_tenant_rw" ON "public"."lease_inspection_photos" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."applications" "a"
  WHERE (("a"."id" = "lease_inspection_photos"."app_id") AND ("lower"("a"."email") = "lower"(COALESCE("auth"."email"(), ''::"text"))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."applications" "a"
  WHERE (("a"."id" = "lease_inspection_photos"."app_id") AND ("lower"("a"."email") = "lower"(COALESCE("auth"."email"(), ''::"text")))))));



ALTER TABLE "public"."lease_inspections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lease_inspections_admin_all" ON "public"."lease_inspections" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_roles"
  WHERE ("admin_roles"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_roles"
  WHERE ("admin_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "lease_inspections_anon_no_read" ON "public"."lease_inspections" FOR SELECT TO "anon" USING (false);



CREATE POLICY "lease_inspections_landlord_read" ON "public"."lease_inspections" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."applications" "a"
     JOIN "public"."properties" "p" ON (("p"."id" = "a"."property_id")))
  WHERE (("a"."id" = "lease_inspections"."app_id") AND ("p"."landlord_id" = "auth"."uid"())))));



CREATE POLICY "lease_inspections_tenant_rw" ON "public"."lease_inspections" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."applications" "a"
  WHERE (("a"."id" = "lease_inspections"."app_id") AND ("lower"("a"."email") = "lower"(COALESCE("auth"."email"(), ''::"text"))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."applications" "a"
  WHERE (("a"."id" = "lease_inspections"."app_id") AND ("lower"("a"."email") = "lower"(COALESCE("auth"."email"(), ''::"text")))))));



ALTER TABLE "public"."lease_lifecycle_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lease_pdf_versions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lease_pdf_versions_admin_all" ON "public"."lease_pdf_versions" USING ("public"."is_admin"());



CREATE POLICY "lease_pdf_versions_applicant_read" ON "public"."lease_pdf_versions" FOR SELECT USING (("app_id" IN ( SELECT "applications"."app_id"
   FROM "public"."applications"
  WHERE ("applications"."applicant_user_id" = "auth"."uid"()))));



ALTER TABLE "public"."lease_signing_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lease_template_partials" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lease_template_partials_admin_all" ON "public"."lease_template_partials" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_roles"
  WHERE ("admin_roles"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_roles"
  WHERE ("admin_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "lease_template_partials_anon_no_read" ON "public"."lease_template_partials" FOR SELECT TO "anon" USING (false);



ALTER TABLE "public"."lease_template_versions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lease_template_versions_admin_all" ON "public"."lease_template_versions" USING ("public"."is_admin"());



CREATE POLICY "lease_template_versions_applicant_read" ON "public"."lease_template_versions" FOR SELECT USING (("id" IN ( SELECT "applications"."lease_template_version_id"
   FROM "public"."applications"
  WHERE (("applications"."applicant_user_id" = "auth"."uid"()) AND ("applications"."lease_template_version_id" IS NOT NULL)))));



ALTER TABLE "public"."lease_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leases_admin_all" ON "public"."leases" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_roles" "r"
  WHERE ("r"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_roles" "r"
  WHERE ("r"."user_id" = "auth"."uid"()))));



CREATE POLICY "leases_landlord_select" ON "public"."leases" FOR SELECT TO "authenticated" USING ((("landlord_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."applications" "a"
  WHERE (("a"."id" = "leases"."application_id") AND ("a"."landlord_id" = "auth"."uid"()))))));



CREATE POLICY "leases_tenant_select" ON "public"."leases" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."applications" "a"
  WHERE (("a"."id" = "leases"."application_id") AND ("lower"("a"."email") = "lower"("public"."current_confirmed_email"()))))));



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_admin_all" ON "public"."messages" USING ("public"."is_admin"());



ALTER TABLE "public"."properties" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "properties_admin_all" ON "public"."properties" USING ("public"."is_admin"());



CREATE POLICY "properties_landlord_read" ON "public"."properties" FOR SELECT USING (("landlord_id" = ( SELECT "landlords"."id"
   FROM "public"."landlords"
  WHERE ("landlords"."user_id" = "auth"."uid"()))));



CREATE POLICY "properties_landlord_write" ON "public"."properties" USING (("landlord_id" = ( SELECT "landlords"."id"
   FROM "public"."landlords"
  WHERE ("landlords"."user_id" = "auth"."uid"())))) WITH CHECK (("landlord_id" = ( SELECT "landlords"."id"
   FROM "public"."landlords"
  WHERE ("landlords"."user_id" = "auth"."uid"()))));



CREATE POLICY "properties_public_read" ON "public"."properties" FOR SELECT USING (("status" = 'active'::"public"."property_status"));



ALTER TABLE "public"."property_photos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "property_photos_admin_all" ON "public"."property_photos" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "property_photos_anon_read" ON "public"."property_photos" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."properties" "p"
  WHERE (("p"."id" = "property_photos"."property_id") AND ("p"."status" = 'active'::"public"."property_status")))));



CREATE POLICY "property_photos_auth_read" ON "public"."property_photos" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."properties" "p"
  WHERE (("p"."id" = "property_photos"."property_id") AND (("p"."status" = 'active'::"public"."property_status") OR ("p"."landlord_id" = ( SELECT "landlords"."id"
           FROM "public"."landlords"
          WHERE ("landlords"."user_id" = "auth"."uid"()))) OR ( SELECT "public"."is_admin"() AS "is_admin"))))));



CREATE POLICY "property_photos_landlord_write" ON "public"."property_photos" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."properties" "p"
  WHERE (("p"."id" = "property_photos"."property_id") AND (("p"."landlord_id" = ( SELECT "landlords"."id"
           FROM "public"."landlords"
          WHERE ("landlords"."user_id" = "auth"."uid"()))) OR ( SELECT "public"."is_admin"() AS "is_admin")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."properties" "p"
  WHERE (("p"."id" = "property_photos"."property_id") AND (("p"."landlord_id" = ( SELECT "landlords"."id"
           FROM "public"."landlords"
          WHERE ("landlords"."user_id" = "auth"."uid"()))) OR ( SELECT "public"."is_admin"() AS "is_admin"))))));



CREATE POLICY "property_photos_public_read" ON "public"."property_photos" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."properties" "p"
  WHERE (("p"."id" = "property_photos"."property_id") AND ("p"."status" = 'active'::"public"."property_status")))));



ALTER TABLE "public"."property_units" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rate_limit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."saved_properties" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "saved_properties_admin_all" ON "public"."saved_properties" USING ("public"."is_admin"());



CREATE POLICY "saved_properties_delete_own" ON "public"."saved_properties" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "saved_properties_insert_own" ON "public"."saved_properties" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "saved_properties_select_own" ON "public"."saved_properties" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "service_role_all_esign_consents" ON "public"."esign_consents" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all_signing_tokens" ON "public"."lease_signing_tokens" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."sign_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."source_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "source_profiles_public_read" ON "public"."source_profiles" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."state_lease_law" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "state_lease_law_admin_all" ON "public"."state_lease_law" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_roles"
  WHERE ("admin_roles"."user_id" = "auth"."uid"())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_roles"
  WHERE ("admin_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "state_lease_law_anon_read" ON "public"."state_lease_law" FOR SELECT TO "anon" USING (true);



CREATE POLICY "tenant_portal_select" ON "public"."applications" FOR SELECT TO "authenticated" USING ((("lower"("email") = "public"."current_confirmed_email"()) OR ("lower"(COALESCE("co_applicant_email", ''::"text")) = "public"."current_confirmed_email"())));



COMMENT ON POLICY "tenant_portal_select" ON "public"."applications" IS 'C-3: tenants see their own applications only when they have a confirmed inbox.';



CREATE POLICY "tenant_read_own_lifecycle_docs" ON "public"."lease_lifecycle_documents" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."leases" "l"
     JOIN "public"."applications" "a" ON (("a"."app_id" = "l"."app_id")))
  WHERE (("l"."id" = "lease_lifecycle_documents"."lease_id") AND ("a"."email" = (( SELECT "users"."email"
           FROM "auth"."users"
          WHERE ("users"."id" = "auth"."uid"())))::"text")))));



GRANT USAGE ON SCHEMA "pipeline" TO "service_role";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."_leases_set_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_leases_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."add_property_photo"("p_property_id" "text", "p_url" "text", "p_file_id" "text", "p_alt_text" "text", "p_caption" "text", "p_width" integer, "p_height" integer, "p_display_order" integer, "p_is_hero" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."add_property_photo"("p_property_id" "text", "p_url" "text", "p_file_id" "text", "p_alt_text" "text", "p_caption" "text", "p_width" integer, "p_height" integer, "p_display_order" integer, "p_is_hero" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_property_photo"("p_property_id" "text", "p_url" "text", "p_file_id" "text", "p_alt_text" "text", "p_caption" "text", "p_width" integer, "p_height" integer, "p_display_order" integer, "p_is_hero" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_list_landlords"("p_page" integer, "p_per_page" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_list_landlords"("p_page" integer, "p_per_page" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_list_landlords"("p_page" integer, "p_per_page" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_source_identity_contract"() TO "anon";
GRANT ALL ON FUNCTION "public"."apply_source_identity_contract"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_source_identity_contract"() TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_application"("p_app_id" "text", "p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_application"("p_app_id" "text", "p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_application"("p_app_id" "text", "p_email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."consume_signing_token"("p_token" "text", "p_request_ip" "inet") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consume_signing_token"("p_token" "text", "p_request_ip" "inet") TO "authenticated";
GRANT ALL ON FUNCTION "public"."consume_signing_token"("p_token" "text", "p_request_ip" "inet") TO "service_role";



REVOKE ALL ON FUNCTION "public"."current_confirmed_email"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_confirmed_email"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_confirmed_email"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_confirmed_email"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."dashboard_pulse"("range_start" timestamp with time zone, "recent_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."dashboard_pulse"("range_start" timestamp with time zone, "recent_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dashboard_pulse"("range_start" timestamp with time zone, "recent_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_properties_cascade"("p_ids" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_properties_cascade"("p_ids" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_properties_cascade"("p_ids" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_properties_cascade"("p_ids" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_property_cascade"("p_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_property_cascade"("p_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_property_cascade"("p_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_property_cascade"("p_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_property_photo_by_file_id"("p_file_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_property_photo_by_file_id"("p_file_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_property_photo_by_file_id"("p_file_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."generate_lease_tokens"("p_app_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."generate_lease_tokens"("p_app_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_property_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_property_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_property_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_apps_by_email"("p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_apps_by_email"("p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_apps_by_email"("p_email" "text") TO "service_role";



GRANT ALL ON TABLE "public"."client_collections" TO "authenticated";
GRANT ALL ON TABLE "public"."client_collections" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_client_collection"("collection_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_client_collection"("collection_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_client_collection"("collection_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_applications"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_applications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_applications"() TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."landlords" TO "anon";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."landlords" TO "authenticated";
GRANT ALL ON TABLE "public"."landlords" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."landlords" TO "anon";
GRANT SELECT("id") ON TABLE "public"."landlords" TO "authenticated";



GRANT SELECT("user_id") ON TABLE "public"."landlords" TO "anon";
GRANT SELECT("user_id") ON TABLE "public"."landlords" TO "authenticated";



GRANT SELECT("contact_name") ON TABLE "public"."landlords" TO "anon";
GRANT SELECT("contact_name") ON TABLE "public"."landlords" TO "authenticated";



GRANT SELECT("business_name") ON TABLE "public"."landlords" TO "anon";
GRANT SELECT("business_name") ON TABLE "public"."landlords" TO "authenticated";



GRANT SELECT("avatar_url") ON TABLE "public"."landlords" TO "anon";
GRANT SELECT("avatar_url") ON TABLE "public"."landlords" TO "authenticated";



GRANT SELECT("tagline") ON TABLE "public"."landlords" TO "anon";
GRANT SELECT("tagline") ON TABLE "public"."landlords" TO "authenticated";



GRANT SELECT("verified") ON TABLE "public"."landlords" TO "anon";
GRANT SELECT("verified") ON TABLE "public"."landlords" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_my_landlord_profile"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_landlord_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_landlord_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_landlord_profile"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_public_landlord_profile_stats"("p_landlord_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_public_landlord_profile_stats"("p_landlord_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_landlord_profile_stats"("p_landlord_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_landlord_profile_stats"("p_landlord_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_watermark_sniper_catalog"("p_limit" integer, "p_offset" integer, "p_state" "text", "p_city" "text", "p_property_type" "text", "p_date_filter" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_photo_status" "text", "p_search" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_watermark_sniper_catalog"("p_limit" integer, "p_offset" integer, "p_state" "text", "p_city" "text", "p_property_type" "text", "p_date_filter" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_photo_status" "text", "p_search" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_watermark_sniper_catalog"("p_limit" integer, "p_offset" integer, "p_state" "text", "p_city" "text", "p_property_type" "text", "p_date_filter" "text", "p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone, "p_photo_status" "text", "p_search" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_watermark_sniper_filter_options"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_watermark_sniper_filter_options"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_watermark_sniper_filter_options"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_recent_esign_consent"("p_app_id" "text", "p_email" "text", "p_version" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_recent_esign_consent"("p_app_id" "text", "p_email" "text", "p_version" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_recent_esign_consent"("p_app_id" "text", "p_email" "text", "p_version" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."immutable_array_to_text"("arr" "text"[], "sep" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."immutable_array_to_text"("arr" "text"[], "sep" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."immutable_array_to_text"("arr" "text"[], "sep" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_counter"("p_table" "text", "p_id" "text", "p_column" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_counter"("p_table" "text", "p_id" "text", "p_column" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_counter"("p_table" "text", "p_id" "text", "p_column" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."lease_addenda_library_touch_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lease_addenda_library_touch_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."lease_deposit_accountings_touch_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lease_deposit_accountings_touch_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."lease_deposit_deductions_touch_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lease_deposit_deductions_touch_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."lease_inspections_recount_photos"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lease_inspections_recount_photos"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."lease_inspections_touch_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lease_inspections_touch_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."lease_template_partials_touch_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lease_template_partials_touch_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."leases_set_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."leases_set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."lookup_lease_by_qr_token"("p_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lookup_lease_by_qr_token"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."lookup_lease_by_qr_token"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lookup_lease_by_qr_token"("p_token" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."lookup_signer_for_token"("p_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lookup_signer_for_token"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lookup_signer_for_token"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."match_properties"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_properties"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_properties"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."pipeline_archive"("p_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pipeline_archive"("p_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pipeline_archive"("p_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pipeline_archive"("p_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."pipeline_bulk_delete"("p_ids" json) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pipeline_bulk_delete"("p_ids" json) TO "anon";
GRANT ALL ON FUNCTION "public"."pipeline_bulk_delete"("p_ids" json) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pipeline_bulk_delete"("p_ids" json) TO "service_role";



GRANT ALL ON FUNCTION "public"."pipeline_cleanup_orphans"() TO "anon";
GRANT ALL ON FUNCTION "public"."pipeline_cleanup_orphans"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."pipeline_cleanup_orphans"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."pipeline_cleanup_staged"("p_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pipeline_cleanup_staged"("p_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pipeline_cleanup_staged"("p_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pipeline_cleanup_staged"("p_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."pipeline_count"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pipeline_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."pipeline_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."pipeline_count"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."pipeline_delete"("p_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pipeline_delete"("p_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pipeline_delete"("p_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pipeline_delete"("p_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."pipeline_fetch_staged_ids"("p_source_ids" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pipeline_fetch_staged_ids"("p_source_ids" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."pipeline_fetch_staged_ids"("p_source_ids" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pipeline_fetch_staged_ids"("p_source_ids" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."pipeline_folder_add_property"("p_property_id" "text", "p_folder_name" "text", "p_folder_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pipeline_folder_add_property"("p_property_id" "text", "p_folder_name" "text", "p_folder_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."pipeline_folder_add_property"("p_property_id" "text", "p_folder_name" "text", "p_folder_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pipeline_folder_add_property"("p_property_id" "text", "p_folder_name" "text", "p_folder_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."pipeline_folder_create"("p_name" "text", "p_description" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pipeline_folder_create"("p_name" "text", "p_description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pipeline_folder_create"("p_name" "text", "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pipeline_folder_create"("p_name" "text", "p_description" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."pipeline_folder_create"("p_name" "text", "p_description" "text", "p_color" "text", "p_icon" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pipeline_folder_create"("p_name" "text", "p_description" "text", "p_color" "text", "p_icon" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pipeline_folder_create"("p_name" "text", "p_description" "text", "p_color" "text", "p_icon" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pipeline_folder_create"("p_name" "text", "p_description" "text", "p_color" "text", "p_icon" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."pipeline_folder_delete"("p_folder_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pipeline_folder_delete"("p_folder_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."pipeline_folder_delete"("p_folder_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pipeline_folder_delete"("p_folder_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."pipeline_folder_list"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pipeline_folder_list"() TO "anon";
GRANT ALL ON FUNCTION "public"."pipeline_folder_list"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."pipeline_folder_list"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."pipeline_folder_properties"("p_folder_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pipeline_folder_properties"("p_folder_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."pipeline_folder_properties"("p_folder_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pipeline_folder_properties"("p_folder_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."pipeline_folder_publish"("p_folder_id" "uuid", "p_property_ids" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pipeline_folder_publish"("p_folder_id" "uuid", "p_property_ids" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."pipeline_folder_publish"("p_folder_id" "uuid", "p_property_ids" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pipeline_folder_publish"("p_folder_id" "uuid", "p_property_ids" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."pipeline_folder_remove_property"("p_property_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pipeline_folder_remove_property"("p_property_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pipeline_folder_remove_property"("p_property_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pipeline_folder_remove_property"("p_property_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."pipeline_folder_rename"("p_folder_id" "uuid", "p_new_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pipeline_folder_rename"("p_folder_id" "uuid", "p_new_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pipeline_folder_rename"("p_folder_id" "uuid", "p_new_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pipeline_folder_rename"("p_folder_id" "uuid", "p_new_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."pipeline_folder_rename"("p_folder_id" "uuid", "p_new_name" "text", "p_color" "text", "p_icon" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pipeline_folder_rename"("p_folder_id" "uuid", "p_new_name" "text", "p_color" "text", "p_icon" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pipeline_folder_rename"("p_folder_id" "uuid", "p_new_name" "text", "p_color" "text", "p_icon" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pipeline_folder_rename"("p_folder_id" "uuid", "p_new_name" "text", "p_color" "text", "p_icon" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."pipeline_folder_stats"("p_folder_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pipeline_folder_stats"("p_folder_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pipeline_folder_stats"("p_folder_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pipeline_folder_stats"("p_folder_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."pipeline_list"("p_status" "text", "p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pipeline_list"("p_status" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."pipeline_list"("p_status" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pipeline_list"("p_status" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."pipeline_patch_staged"("p_id" "text", "p_monthly_rent" integer, "p_security_deposit" integer, "p_description" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pipeline_patch_staged"("p_id" "text", "p_monthly_rent" integer, "p_security_deposit" integer, "p_description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pipeline_patch_staged"("p_id" "text", "p_monthly_rent" integer, "p_security_deposit" integer, "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pipeline_patch_staged"("p_id" "text", "p_monthly_rent" integer, "p_security_deposit" integer, "p_description" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."pipeline_photo_gallery"("p_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pipeline_photo_gallery"("p_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pipeline_photo_gallery"("p_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pipeline_photo_gallery"("p_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."pipeline_publish"("p_id" "text", "p_landlord_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pipeline_publish"("p_id" "text", "p_landlord_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."pipeline_publish"("p_id" "text", "p_landlord_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pipeline_publish"("p_id" "text", "p_landlord_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."pipeline_publish_and_delete"("p_id" "text", "p_landlord_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pipeline_publish_and_delete"("p_id" "text", "p_landlord_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."pipeline_publish_and_delete"("p_id" "text", "p_landlord_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pipeline_publish_and_delete"("p_id" "text", "p_landlord_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."pipeline_restore"("p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pipeline_restore"("p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."pipeline_restore"("p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pipeline_restore"("p_payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."pipeline_save"("p_id" "text", "p_patch" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pipeline_save"("p_id" "text", "p_patch" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."pipeline_save"("p_id" "text", "p_patch" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pipeline_save"("p_id" "text", "p_patch" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."pipeline_stage_batch"("p_records" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pipeline_stage_batch"("p_records" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."pipeline_stage_batch"("p_records" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pipeline_stage_batch"("p_records" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."pipeline_stats"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pipeline_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."pipeline_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."pipeline_stats"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."pipeline_unarchive"("p_id" "text", "p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pipeline_unarchive"("p_id" "text", "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pipeline_unarchive"("p_id" "text", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pipeline_unarchive"("p_id" "text", "p_status" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."pipeline_unpublish"("p_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pipeline_unpublish"("p_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pipeline_unpublish"("p_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pipeline_unpublish"("p_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."property_mark_verified"("p_property_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."property_mark_verified"("p_property_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."property_mark_verified"("p_property_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."property_mark_verified"("p_property_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."property_photos_set_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."property_photos_set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."publish_lease_template"("p_template_id" "uuid", "p_name" "text", "p_template_body" "text", "p_variables" "jsonb", "p_notes" "text", "p_make_active" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."publish_lease_template"("p_template_id" "uuid", "p_name" "text", "p_template_body" "text", "p_variables" "jsonb", "p_notes" "text", "p_make_active" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."purge_old_logs"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."purge_old_logs"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."purge_orphaned_lease_pdfs"("p_dry_run" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."purge_orphaned_lease_pdfs"("p_dry_run" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."purge_resolved_agent_issues"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."purge_resolved_agent_issues"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_lease_pdf_integrity"("p_app_id" "text", "p_version_number" integer, "p_sha256" "text", "p_certificate_appended" boolean, "p_qr_verify_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_lease_pdf_integrity"("p_app_id" "text", "p_version_number" integer, "p_sha256" "text", "p_certificate_appended" boolean, "p_qr_verify_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_lease_pdf_integrity"("p_app_id" "text", "p_version_number" integer, "p_sha256" "text", "p_certificate_appended" boolean, "p_qr_verify_token" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_lease_pdf_version"("p_app_id" "text", "p_event" "text", "p_storage_path" "text", "p_size_bytes" integer, "p_template_version_id" "uuid", "p_amendment_id" "uuid", "p_created_by" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_lease_pdf_version"("p_app_id" "text", "p_event" "text", "p_storage_path" "text", "p_size_bytes" integer, "p_template_version_id" "uuid", "p_amendment_id" "uuid", "p_created_by" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_lease_pdf_version"("p_app_id" "text", "p_event" "text", "p_storage_path" "text", "p_size_bytes" integer, "p_template_version_id" "uuid", "p_amendment_id" "uuid", "p_created_by" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."register_signing_token"("p_token" "text", "p_app_id" "text", "p_role" "text", "p_email" "text", "p_amendment_id" "uuid", "p_ttl_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."register_signing_token"("p_token" "text", "p_app_id" "text", "p_role" "text", "p_email" "text", "p_amendment_id" "uuid", "p_ttl_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."register_signing_token"("p_token" "text", "p_app_id" "text", "p_role" "text", "p_email" "text", "p_amendment_id" "uuid", "p_ttl_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."reissue_signing_token"("p_app_id" "text", "p_role" "text", "p_by" "text", "p_amendment_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reissue_signing_token"("p_app_id" "text", "p_role" "text", "p_by" "text", "p_amendment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reissue_signing_token"("p_app_id" "text", "p_role" "text", "p_by" "text", "p_amendment_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."reorder_property_photos"("p_property_id" "text", "p_file_ids" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."reorder_property_photos"("p_property_id" "text", "p_file_ids" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_property_photos"("p_property_id" "text", "p_file_ids" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."report_client_error"("p_fingerprint" "text", "p_message" "text", "p_stack" "text", "p_page_path" "text", "p_user_agent" "text", "p_browser_lang" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."report_client_error"("p_fingerprint" "text", "p_message" "text", "p_stack" "text", "p_page_path" "text", "p_user_agent" "text", "p_browser_lang" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."report_client_error"("p_fingerprint" "text", "p_message" "text", "p_stack" "text", "p_page_path" "text", "p_user_agent" "text", "p_browser_lang" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."report_client_error"("p_fingerprint" "text", "p_message" "text", "p_stack" "text", "p_page_path" "text", "p_user_agent" "text", "p_browser_lang" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."revoke_signing_token"("p_token" "text", "p_by" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."revoke_signing_token"("p_token" "text", "p_by" "text", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_signing_token"("p_token" "text", "p_by" "text", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."scan_watermark_sniper_system"() TO "anon";
GRANT ALL ON FUNCTION "public"."scan_watermark_sniper_system"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."scan_watermark_sniper_system"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sign_lease"("p_app_id" "text", "p_signature" "text", "p_ip" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."sign_lease"("p_app_id" "text", "p_signature" "text", "p_ip" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sign_lease"("p_app_id" "text", "p_signature" "text", "p_ip" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sign_lease_amendment"("p_token" "text", "p_signature" "text", "p_ip_address" "text", "p_user_agent" "text", "p_signature_image" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."sign_lease_amendment"("p_token" "text", "p_signature" "text", "p_ip_address" "text", "p_user_agent" "text", "p_signature_image" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sign_lease_amendment"("p_token" "text", "p_signature" "text", "p_ip_address" "text", "p_user_agent" "text", "p_signature_image" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sign_lease_co_applicant"("p_token" "text", "p_signature" "text", "p_ip_address" "text", "p_user_agent" "text", "p_signature_image" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."sign_lease_co_applicant"("p_token" "text", "p_signature" "text", "p_ip_address" "text", "p_user_agent" "text", "p_signature_image" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sign_lease_co_applicant"("p_token" "text", "p_signature" "text", "p_ip_address" "text", "p_user_agent" "text", "p_signature_image" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sign_lease_tenant"("p_token" "text", "p_signature" "text", "p_ip_address" "text", "p_user_agent" "text", "p_signature_image" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."sign_lease_tenant"("p_token" "text", "p_signature" "text", "p_ip_address" "text", "p_user_agent" "text", "p_signature_image" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sign_lease_tenant"("p_token" "text", "p_signature" "text", "p_ip_address" "text", "p_user_agent" "text", "p_signature_image" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."snapshot_lease_template_for_app"("p_app_id" "text", "p_template_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."snapshot_lease_template_for_app"("p_app_id" "text", "p_template_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."state_lease_law_touch_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."state_lease_law_touch_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."tenant_portal_state"("p_app_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."tenant_portal_state"("p_app_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."tenant_portal_state"("p_app_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."tenant_portal_state"("p_app_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."tg_amendment_register_token"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_amendment_register_token"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_amendment_register_token"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tg_application_register_token"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_application_register_token"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_application_register_token"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_saves_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_saves_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_saves_count"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_lease_template_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_lease_template_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_my_landlord_profile"("payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_my_landlord_profile"("payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_my_landlord_profile"("payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_my_landlord_profile"("payload" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_lease_financials"("p_state_code" "text", "p_monthly_rent" numeric, "p_security_deposit" numeric, "p_pet_deposit" numeric, "p_last_month_rent" numeric, "p_cleaning_fee" numeric, "p_cleaning_refundable" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_lease_financials"("p_state_code" "text", "p_monthly_rent" numeric, "p_security_deposit" numeric, "p_pet_deposit" numeric, "p_last_month_rent" numeric, "p_cleaning_fee" numeric, "p_cleaning_refundable" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_lease_financials"("p_state_code" "text", "p_monthly_rent" numeric, "p_security_deposit" numeric, "p_pet_deposit" numeric, "p_last_month_rent" numeric, "p_cleaning_fee" numeric, "p_cleaning_refundable" boolean) TO "service_role";



GRANT ALL ON TABLE "public"."lease_signing_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."lease_signing_tokens" TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_signing_token"("p_token" "text", "p_role" "text", "p_request_ip" "inet") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_signing_token"("p_token" "text", "p_role" "text", "p_request_ip" "inet") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_signing_token"("p_token" "text", "p_role" "text", "p_request_ip" "inet") TO "service_role";



GRANT ALL ON TABLE "pipeline"."pipeline_enrichment_log" TO "service_role";



GRANT ALL ON SEQUENCE "pipeline"."pipeline_enrichment_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "pipeline"."pipeline_enrichment_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "pipeline"."pipeline_enrichment_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "pipeline"."pipeline_properties" TO "service_role";



GRANT ALL ON TABLE "pipeline"."pipeline_scrape_runs" TO "service_role";



GRANT ALL ON SEQUENCE "pipeline"."pipeline_scrape_runs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "pipeline"."pipeline_scrape_runs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "pipeline"."pipeline_scrape_runs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."_migration_history" TO "anon";
GRANT ALL ON TABLE "public"."_migration_history" TO "authenticated";
GRANT ALL ON TABLE "public"."_migration_history" TO "service_role";



GRANT ALL ON TABLE "public"."admin_actions" TO "anon";
GRANT ALL ON TABLE "public"."admin_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_actions" TO "service_role";



GRANT ALL ON TABLE "public"."admin_roles" TO "anon";
GRANT ALL ON TABLE "public"."admin_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_roles" TO "service_role";



GRANT ALL ON TABLE "public"."agent_issues" TO "service_role";



GRANT ALL ON SEQUENCE "public"."agent_issues_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."agent_issues_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."agent_issues_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."application_documents" TO "anon";
GRANT ALL ON TABLE "public"."application_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."application_documents" TO "service_role";



GRANT ALL ON TABLE "public"."applications" TO "authenticated";
GRANT ALL ON TABLE "public"."applications" TO "service_role";



GRANT ALL ON TABLE "public"."bot_attempts" TO "anon";
GRANT ALL ON TABLE "public"."bot_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."bot_attempts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."bot_attempts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."bot_attempts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."bot_attempts_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."client_errors" TO "anon";
GRANT ALL ON TABLE "public"."client_errors" TO "authenticated";
GRANT ALL ON TABLE "public"."client_errors" TO "service_role";



GRANT ALL ON SEQUENCE "public"."client_errors_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."client_errors_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."client_errors_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."co_applicants" TO "anon";
GRANT ALL ON TABLE "public"."co_applicants" TO "authenticated";
GRANT ALL ON TABLE "public"."co_applicants" TO "service_role";



GRANT ALL ON TABLE "public"."consent_log" TO "anon";
GRANT ALL ON TABLE "public"."consent_log" TO "authenticated";
GRANT ALL ON TABLE "public"."consent_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."consent_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."consent_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."consent_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."credentials_config" TO "anon";
GRANT ALL ON TABLE "public"."credentials_config" TO "authenticated";
GRANT ALL ON TABLE "public"."credentials_config" TO "service_role";



GRANT ALL ON TABLE "public"."draft_applications" TO "anon";
GRANT ALL ON TABLE "public"."draft_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."draft_applications" TO "service_role";



GRANT ALL ON TABLE "public"."email_logs" TO "anon";
GRANT ALL ON TABLE "public"."email_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."email_logs" TO "service_role";



GRANT ALL ON TABLE "public"."esign_consents" TO "authenticated";
GRANT ALL ON TABLE "public"."esign_consents" TO "service_role";



GRANT ALL ON TABLE "public"."inquiries" TO "anon";
GRANT ALL ON TABLE "public"."inquiries" TO "authenticated";
GRANT ALL ON TABLE "public"."inquiries" TO "service_role";



GRANT ALL ON TABLE "public"."landlords_public" TO "anon";
GRANT ALL ON TABLE "public"."landlords_public" TO "authenticated";
GRANT ALL ON TABLE "public"."landlords_public" TO "service_role";



GRANT ALL ON TABLE "public"."lease_addenda_attached" TO "anon";
GRANT ALL ON TABLE "public"."lease_addenda_attached" TO "authenticated";
GRANT ALL ON TABLE "public"."lease_addenda_attached" TO "service_role";



GRANT ALL ON SEQUENCE "public"."lease_addenda_attached_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."lease_addenda_attached_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."lease_addenda_attached_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."lease_addenda_library" TO "anon";
GRANT ALL ON TABLE "public"."lease_addenda_library" TO "authenticated";
GRANT ALL ON TABLE "public"."lease_addenda_library" TO "service_role";



GRANT ALL ON TABLE "public"."lease_amendments" TO "anon";
GRANT ALL ON TABLE "public"."lease_amendments" TO "authenticated";
GRANT ALL ON TABLE "public"."lease_amendments" TO "service_role";



GRANT ALL ON TABLE "public"."lease_deposit_accountings" TO "anon";
GRANT ALL ON TABLE "public"."lease_deposit_accountings" TO "authenticated";
GRANT ALL ON TABLE "public"."lease_deposit_accountings" TO "service_role";



GRANT ALL ON TABLE "public"."lease_deposit_deductions" TO "anon";
GRANT ALL ON TABLE "public"."lease_deposit_deductions" TO "authenticated";
GRANT ALL ON TABLE "public"."lease_deposit_deductions" TO "service_role";



GRANT ALL ON TABLE "public"."lease_inspection_photos" TO "anon";
GRANT ALL ON TABLE "public"."lease_inspection_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."lease_inspection_photos" TO "service_role";



GRANT ALL ON TABLE "public"."lease_inspections" TO "anon";
GRANT ALL ON TABLE "public"."lease_inspections" TO "authenticated";
GRANT ALL ON TABLE "public"."lease_inspections" TO "service_role";



GRANT ALL ON TABLE "public"."lease_lifecycle_documents" TO "anon";
GRANT ALL ON TABLE "public"."lease_lifecycle_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."lease_lifecycle_documents" TO "service_role";



GRANT ALL ON TABLE "public"."lease_money_summary" TO "anon";
GRANT ALL ON TABLE "public"."lease_money_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."lease_money_summary" TO "service_role";



GRANT ALL ON TABLE "public"."lease_pdf_versions" TO "anon";
GRANT ALL ON TABLE "public"."lease_pdf_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."lease_pdf_versions" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."lease_renewals_due" TO "anon";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."lease_renewals_due" TO "authenticated";
GRANT ALL ON TABLE "public"."lease_renewals_due" TO "service_role";



GRANT ALL ON TABLE "public"."lease_signing_tokens_admin" TO "anon";
GRANT ALL ON TABLE "public"."lease_signing_tokens_admin" TO "authenticated";
GRANT ALL ON TABLE "public"."lease_signing_tokens_admin" TO "service_role";



GRANT ALL ON TABLE "public"."lease_template_partials" TO "anon";
GRANT ALL ON TABLE "public"."lease_template_partials" TO "authenticated";
GRANT ALL ON TABLE "public"."lease_template_partials" TO "service_role";



GRANT ALL ON TABLE "public"."lease_template_versions" TO "anon";
GRANT ALL ON TABLE "public"."lease_template_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."lease_template_versions" TO "service_role";



GRANT ALL ON TABLE "public"."lease_templates" TO "anon";
GRANT ALL ON TABLE "public"."lease_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."lease_templates" TO "service_role";



GRANT ALL ON TABLE "public"."leases" TO "anon";
GRANT ALL ON TABLE "public"."leases" TO "authenticated";
GRANT ALL ON TABLE "public"."leases" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."open_issues" TO "service_role";



GRANT ALL ON TABLE "public"."properties" TO "anon";
GRANT ALL ON TABLE "public"."properties" TO "authenticated";
GRANT ALL ON TABLE "public"."properties" TO "service_role";



GRANT UPDATE("admin_notes") ON TABLE "public"."properties" TO "authenticated";



GRANT UPDATE("featured") ON TABLE "public"."properties" TO "authenticated";



GRANT ALL ON TABLE "public"."property_photos" TO "anon";
GRANT ALL ON TABLE "public"."property_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."property_photos" TO "service_role";



GRANT ALL ON TABLE "public"."property_units" TO "anon";
GRANT ALL ON TABLE "public"."property_units" TO "authenticated";
GRANT ALL ON TABLE "public"."property_units" TO "service_role";



GRANT ALL ON TABLE "public"."public_landlord_profiles" TO "anon";
GRANT ALL ON TABLE "public"."public_landlord_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."public_landlord_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limit_log" TO "anon";
GRANT ALL ON TABLE "public"."rate_limit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_limit_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."rate_limit_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."rate_limit_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."rate_limit_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."saved_properties" TO "anon";
GRANT ALL ON TABLE "public"."saved_properties" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_properties" TO "service_role";



GRANT ALL ON TABLE "public"."sign_events" TO "anon";
GRANT ALL ON TABLE "public"."sign_events" TO "authenticated";
GRANT ALL ON TABLE "public"."sign_events" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."source_profiles" TO "anon";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."source_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."source_profiles" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."source_profiles" TO "anon";
GRANT SELECT("id") ON TABLE "public"."source_profiles" TO "authenticated";



GRANT SELECT("source") ON TABLE "public"."source_profiles" TO "anon";
GRANT SELECT("source") ON TABLE "public"."source_profiles" TO "authenticated";



GRANT SELECT("profile_type") ON TABLE "public"."source_profiles" TO "anon";
GRANT SELECT("profile_type") ON TABLE "public"."source_profiles" TO "authenticated";



GRANT SELECT("display_name") ON TABLE "public"."source_profiles" TO "anon";
GRANT SELECT("display_name") ON TABLE "public"."source_profiles" TO "authenticated";



GRANT SELECT("image_url") ON TABLE "public"."source_profiles" TO "anon";
GRANT SELECT("image_url") ON TABLE "public"."source_profiles" TO "authenticated";



GRANT SELECT("profile_url") ON TABLE "public"."source_profiles" TO "anon";
GRANT SELECT("profile_url") ON TABLE "public"."source_profiles" TO "authenticated";



GRANT SELECT("website_url") ON TABLE "public"."source_profiles" TO "anon";
GRANT SELECT("website_url") ON TABLE "public"."source_profiles" TO "authenticated";



GRANT SELECT("description") ON TABLE "public"."source_profiles" TO "anon";
GRANT SELECT("description") ON TABLE "public"."source_profiles" TO "authenticated";



GRANT SELECT("first_seen_at") ON TABLE "public"."source_profiles" TO "anon";
GRANT SELECT("first_seen_at") ON TABLE "public"."source_profiles" TO "authenticated";



GRANT SELECT("last_seen_at") ON TABLE "public"."source_profiles" TO "anon";
GRANT SELECT("last_seen_at") ON TABLE "public"."source_profiles" TO "authenticated";



GRANT ALL ON TABLE "public"."state_lease_law" TO "anon";
GRANT ALL ON TABLE "public"."state_lease_law" TO "authenticated";
GRANT ALL ON TABLE "public"."state_lease_law" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







