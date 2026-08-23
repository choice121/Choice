-- =============================================================================
-- CHOICE PROPERTIES — DATA AUDIT (READ-ONLY)
-- Phase I of the wording/data alignment pass.
-- Run these queries in the Supabase SQL editor against your project.
-- NONE of these statements mutate data — they only surface issues.
-- After you review the output, send the rows you want fixed and I will
-- prepare scoped UPDATE statements for your approval.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. DUPLICATE LISTINGS
-- Same address+city+state appears more than once. Common causes:
--   • Test listings re-imported
--   • Same property re-listed without retiring the prior row
--   • Whitespace/case variations
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  lower(trim(address))    AS norm_address,
  lower(trim(city))       AS norm_city,
  upper(trim(state))      AS norm_state,
  count(*)                AS duplicate_count,
  array_agg(id ORDER BY created_at)            AS listing_ids,
  array_agg(status ORDER BY created_at)        AS statuses,
  array_agg(monthly_rent ORDER BY created_at)  AS monthly_rents,
  array_agg(created_at ORDER BY created_at)    AS created_dates
FROM properties
WHERE address IS NOT NULL AND city IS NOT NULL AND state IS NOT NULL
GROUP BY norm_address, norm_city, norm_state
HAVING count(*) > 1
ORDER BY duplicate_count DESC, norm_state, norm_city;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ACTIVE LISTINGS MISSING SECURITY DEPOSIT
-- Listings without a security_deposit value will render "—" in the apply card
-- and break the move-in cost breakdown in the lease email.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  id,
  title,
  address || ', ' || city || ', ' || state AS full_address,
  monthly_rent,
  security_deposit,
  status,
  created_at
FROM properties
WHERE status = 'active'
  AND (security_deposit IS NULL OR security_deposit = 0)
ORDER BY created_at DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ACTIVE LISTINGS MISSING APPLICATION FEE
-- A NULL application_fee renders ambiguously. Should be either a number
-- or explicitly 0 (treated as "Free" by the property page).
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  id,
  title,
  address || ', ' || city || ', ' || state AS full_address,
  application_fee,
  status,
  created_at
FROM properties
WHERE status = 'active'
  AND application_fee IS NULL
ORDER BY created_at DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. PET POLICY MISMATCHES
-- Description text mentions "pets" / "no pets" / "$X per pet" but the
-- structured pet fields are blank or contradict.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  id,
  title,
  pets_allowed,
  pet_deposit,
  pet_policy,
  -- description fragments most likely to indicate a pet rule
  CASE
    WHEN description ILIKE '%no pets%'              THEN 'desc says: NO PETS'
    WHEN description ~* 'pets?\s*allowed'           THEN 'desc says: PETS ALLOWED'
    WHEN description ~* '\$\s*[0-9]+\s*(per|/|each).{0,20}pet'  THEN 'desc mentions PET FEE'
    WHEN description ILIKE '%puts allowed%'         THEN 'desc says: PUTS ALLOWED (typo for PETS)'
    ELSE NULL
  END AS desc_signal
FROM properties
WHERE status = 'active'
  AND (
    description ILIKE '%pet%'
    OR description ILIKE '%puts allowed%'
  )
  AND (
    -- structured field disagrees with or is silent about description
    pets_allowed IS NULL
    OR (pets_allowed = false AND description ~* 'pets?\s*allowed')
    OR (pets_allowed = true  AND description ILIKE '%no pets%')
  )
ORDER BY created_at DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. STATUS CONSISTENCY — ORPHANED APPLICATIONS
-- Applications still in 'pending' / 'paid' state for closed listings.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  a.id            AS application_id,
  a.application_id AS public_app_id,
  a.applicant_name,
  a.status        AS application_status,
  a.payment_status,
  p.id            AS property_id,
  p.title         AS property_title,
  p.status        AS property_status,
  a.created_at
FROM applications a
LEFT JOIN properties p ON p.id = a.property_id
WHERE a.status IN ('pending', 'in_review')
  AND (p.status IS NULL OR p.status IN ('rented', 'inactive', 'archived'))
ORDER BY a.created_at DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. PAID APPLICATIONS WITHOUT A REVIEW DECISION FOR > 5 DAYS
-- Surfaces applications that have stalled past the canonical 24–72h window.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  id,
  application_id   AS public_app_id,
  applicant_name,
  email,
  status,
  payment_status,
  payment_received_at,
  created_at,
  EXTRACT(EPOCH FROM (now() - payment_received_at)) / 3600 AS hours_since_payment
FROM applications
WHERE payment_status = 'paid'
  AND status IN ('pending', 'in_review')
  AND payment_received_at < now() - interval '5 days'
ORDER BY payment_received_at ASC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. LEGACY STATUS LABELS
-- If your DB has any free-text status fields lingering with old wording.
-- Adjust the table/column names if your schema differs.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT id, status, payment_status, lease_status, move_in_status, created_at
FROM applications
WHERE status::text ILIKE '%under review%'
   OR payment_status::text ILIKE '%under review%'
ORDER BY created_at DESC;

-- =============================================================================
-- END OF AUDIT. No DELETE / UPDATE / INSERT statements were executed.
-- Send the result rows back to the agent to prepare scoped fix scripts.
-- =============================================================================
