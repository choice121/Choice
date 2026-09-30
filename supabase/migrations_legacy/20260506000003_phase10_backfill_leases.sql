-- Lease Phase 10 (chunk 1/5) — one-time backfill
--
-- For every application that already produced a lease PDF, materialize
-- one leases row carrying the existing snapshot, then propagate the new
-- leases.id back to every dependent child row (PDF versions, addenda,
-- signing tokens, amendments, inspections, e-sign consents, deposit
-- accountings) so the new lease_id columns aren't NULL on day 1.
--
-- Idempotent: re-running this migration is a no-op (UPSERT-style logic
-- via NOT EXISTS guards) — important because GitHub Actions retries the
-- migration when it fails.

DO $$
DECLARE
  app RECORD;
  new_lease_id UUID;
BEGIN
  FOR app IN
    SELECT * FROM public.applications
    WHERE lease_pdf_url IS NOT NULL
       OR lease_status   IS NOT NULL
       OR lease_template_version_id IS NOT NULL
  LOOP
    -- Skip if a lease already exists for this application
    SELECT id INTO new_lease_id
    FROM public.leases
    WHERE application_id = app.id
    LIMIT 1;

    IF new_lease_id IS NULL THEN
      INSERT INTO public.leases (
        application_id, app_id, listing_id, landlord_id, property_address,
        lease_state_code, lease_start_date, lease_end_date,
        monthly_rent, security_deposit, move_in_costs,
        first_month_rent, last_month_rent, pet_deposit, pet_rent,
        admin_fee, key_deposit, parking_fee, cleaning_fee, cleaning_fee_refundable,
        rent_due_day_of_month, rent_proration_method, prorated_first_month,
        utility_responsibilities,
        lease_landlord_name, lease_landlord_address,
        lease_late_fee_flat, lease_late_fee_daily,
        lease_pets_policy, lease_smoking_policy, lease_compliance_snapshot,
        lease_notes, lease_template_version_id, lease_pdf_url,
        tenant_signature, tenant_signature_image, signature_timestamp,
        lease_ip_address,
        co_applicant_signature, co_applicant_signature_image, co_applicant_signature_timestamp,
        management_signed, management_signer_name, management_signed_at, management_notes,
        management_cosigned, management_cosigned_by, management_cosigned_at,
        lease_status, lease_sent_date, lease_signed_date, lease_expiry_date,
        executed_at, created_at, updated_at, created_by
      ) VALUES (
        app.id, app.app_id, app.property_id, app.landlord_id, app.property_address,
        app.lease_state_code, app.lease_start_date, app.lease_end_date,
        app.monthly_rent, app.security_deposit, app.move_in_costs,
        app.first_month_rent, app.last_month_rent, app.pet_deposit, app.pet_rent,
        app.admin_fee, app.key_deposit, app.parking_fee, app.cleaning_fee, app.cleaning_fee_refundable,
        app.rent_due_day_of_month, app.rent_proration_method, app.prorated_first_month,
        app.utility_responsibilities,
        app.lease_landlord_name, app.lease_landlord_address,
        app.lease_late_fee_flat, app.lease_late_fee_daily,
        app.lease_pets_policy, app.lease_smoking_policy, app.lease_compliance_snapshot,
        app.lease_notes, app.lease_template_version_id, app.lease_pdf_url,
        app.tenant_signature, app.tenant_signature_image, app.signature_timestamp,
        app.lease_ip_address,
        app.co_applicant_signature, app.co_applicant_signature_image, app.co_applicant_signature_timestamp,
        COALESCE(app.management_signed, false), app.management_signer_name, app.management_signed_at, app.management_notes,
        COALESCE(app.management_cosigned, false), app.management_cosigned_by, app.management_cosigned_at,
        -- Map legacy applications.lease_status enum to the new
        -- Phase-10 lifecycle vocabulary. Legacy values:
        --   none, sent, signed, awaiting_co_sign, co_signed, voided, expired
        -- New vocabulary:
        --   draft, sent, partially_signed, fully_signed, active,
        --   expiring, expired, terminated, renewed, cancelled
        CASE
          WHEN app.lease_status IS NULL                        THEN 'draft'
          WHEN app.lease_status::text = 'none'                 THEN 'draft'
          WHEN app.lease_status::text = 'sent'                 THEN 'sent'
          WHEN app.lease_status::text = 'awaiting_co_sign'     THEN 'partially_signed'
          -- 'signed' = tenant signed; if landlord also countersigned, treat as active
          WHEN app.lease_status::text = 'signed' AND COALESCE(app.management_cosigned, app.management_signed, false) THEN 'active'
          WHEN app.lease_status::text = 'signed'               THEN 'partially_signed'
          -- 'co_signed' = both tenant signers complete; active iff landlord also countersigned
          WHEN app.lease_status::text = 'co_signed' AND COALESCE(app.management_cosigned, app.management_signed, false) THEN 'active'
          WHEN app.lease_status::text = 'co_signed'            THEN 'fully_signed'
          WHEN app.lease_status::text = 'voided'               THEN 'cancelled'
          WHEN app.lease_status::text = 'expired'              THEN 'expired'
          ELSE 'draft'
        END,
        app.lease_sent_date, app.lease_signed_date, app.lease_expiry_date,
        CASE WHEN app.management_cosigned_at IS NOT NULL THEN app.management_cosigned_at
             WHEN app.management_signed_at  IS NOT NULL THEN app.management_signed_at
             ELSE NULL END,
        COALESCE(app.created_at, now()),
        COALESCE(app.updated_at, now()),
        'phase10_backfill'
      )
      RETURNING id INTO new_lease_id;
    END IF;

    -- Propagate to applications.current_lease_id (idempotent)
    UPDATE public.applications
       SET current_lease_id = new_lease_id
     WHERE id = app.id
       AND (current_lease_id IS NULL OR current_lease_id <> new_lease_id);

    -- Backfill child tables that key on TEXT app_id
    UPDATE public.lease_pdf_versions      SET lease_id = new_lease_id
      WHERE app_id = app.app_id        AND lease_id IS NULL;
    UPDATE public.lease_addenda_attached  SET lease_id = new_lease_id
      WHERE app_id = app.app_id        AND lease_id IS NULL;
    UPDATE public.lease_signing_tokens    SET lease_id = new_lease_id
      WHERE app_id = app.app_id        AND lease_id IS NULL;
    UPDATE public.lease_signing_tokens_admin SET lease_id = new_lease_id
      WHERE app_id = app.app_id        AND lease_id IS NULL;
    UPDATE public.lease_amendments        SET lease_id = new_lease_id
      WHERE app_id = app.app_id        AND lease_id IS NULL;
    UPDATE public.esign_consents          SET lease_id = new_lease_id
      WHERE app_id = app.app_id        AND lease_id IS NULL;

    -- Backfill child tables that key on UUID app_id (= applications.id)
    UPDATE public.lease_inspections       SET lease_id = new_lease_id
      WHERE app_id = app.id            AND lease_id IS NULL;
    UPDATE public.lease_inspection_photos SET lease_id = new_lease_id
      WHERE app_id = app.id            AND lease_id IS NULL;
    UPDATE public.lease_deposit_accountings SET lease_id = new_lease_id
      WHERE app_id = app.id            AND lease_id IS NULL;
  END LOOP;
END$$;

-- Audit trail in admin_actions so the backfill is reconstructable later
INSERT INTO public.admin_actions (action, target_type, target_id, metadata)
SELECT 'phase10_backfill_lease',
       'lease',
       l.id::text,
       jsonb_build_object(
         'lease_id',        l.id,
         'application_id',  l.application_id,
         'app_id',          l.app_id,
         'lease_status',    l.lease_status,
         'backfilled_at',   now()
       )
FROM public.leases l
WHERE l.created_by = 'phase10_backfill'
  AND NOT EXISTS (
    SELECT 1 FROM public.admin_actions aa
    WHERE aa.action = 'phase10_backfill_lease'
      AND aa.target_id = l.id::text
  );
