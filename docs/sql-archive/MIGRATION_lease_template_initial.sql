-- ============================================================
  -- MIGRATION: Insert Michigan Standard Residential Lease Template
  -- Applied: 2026-04-18T06:29:31.795Z
  -- Fixes: CRITICAL BLOCKER — lease_templates table was empty, 
  --        causing generate-lease to fail for all applications.
  -- ============================================================

  -- Insert the active lease template
  -- Uses dollar-quoting to safely handle apostrophes and special characters
  INSERT INTO lease_templates (name, is_active, template_body, variables, notes, created_by)
  VALUES (
    'Michigan Standard Residential Lease',
    true,
    $tmpl$MICHIGAN RESIDENTIAL LEASE AGREEMENT

  This Residential Lease Agreement ("Agreement") is entered into as of the date signed below, between:

  LANDLORD: {{landlord_name}}
  LANDLORD ADDRESS: {{landlord_address}}

  TENANT: {{tenant_full_name}}
  EMAIL: {{tenant_email}}
  PHONE: {{tenant_phone}}
  APPLICATION ID: {{app_id}}

  ----------------------------------------------------------

  1. PREMISES

  Landlord agrees to rent to Tenant the property located at:

  {{property_address}}

  (the Premises), to be used solely as a private residential dwelling.

  ----------------------------------------------------------

  2. LEASE TERM

  The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Holdover tenancy following expiration shall be treated as month-to-month at Landlord sole discretion.

  ----------------------------------------------------------

  3. RENT

  Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

  ----------------------------------------------------------

  4. LATE FEES

  If rent is not received by the 5th day of the month, a late fee of {{late_fee_flat}} will be charged, plus {{late_fee_daily}} per day for each additional day rent remains unpaid.

  ----------------------------------------------------------

  5. SECURITY DEPOSIT

  Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession of the Premises. This deposit is held per the Michigan Security Deposit Law (MCL 554.601 et seq.) and will be returned within 30 days of lease end, less lawful deductions.

  ----------------------------------------------------------

  6. MOVE-IN COSTS

  Total move-in costs due prior to possession: {{move_in_costs}}.

  ----------------------------------------------------------

  7. UTILITIES AND SERVICES

  Tenant is responsible for all utilities including electricity, gas, water, internet, and trash, unless otherwise agreed in writing.

  ----------------------------------------------------------

  8. USE OF PREMISES

  Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws and ordinances.

  ----------------------------------------------------------

  9. PETS POLICY

  {{pets_policy}}

  ----------------------------------------------------------

  10. SMOKING POLICY

  {{smoking_policy}}

  ----------------------------------------------------------

  11. MAINTENANCE AND REPAIRS

  Tenant shall maintain the Premises in a clean condition and promptly notify Landlord of needed repairs. Tenant is responsible for damages beyond normal wear and tear.

  ----------------------------------------------------------

  12. ALTERATIONS

  Tenant shall not make alterations to the Premises without prior written consent from Landlord.

  ----------------------------------------------------------

  13. ACCESS

  Landlord may enter the Premises with 24 hours advance notice for inspection, repairs, or showing. Emergency access is permitted without notice.

  ----------------------------------------------------------

  14. SUBLETTING AND ASSIGNMENT

  Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

  ----------------------------------------------------------

  15. HOLDOVER

  If Tenant remains after lease expiration without Landlord written consent, Tenant is liable for double rent per month plus all damages.

  ----------------------------------------------------------

  16. DEFAULT AND EVICTION

  Failure to pay rent or violation of any term may result in eviction per Michigan law. 7-day notice for non-payment; 30-day notice for other violations per MCL 554.134.

  ----------------------------------------------------------

  17. GOVERNING LAW

  This Agreement is governed by the laws of the State of {{state_code}}, including the Michigan Truth in Renting Act (MCL 554.631) and the Michigan Security Deposit Law (MCL 554.601).

  ----------------------------------------------------------

  18. ENTIRE AGREEMENT

  This Agreement is the entire understanding between the parties and may only be modified in writing signed by both parties.

  ----------------------------------------------------------

  19. LEAD PAINT DISCLOSURE

  If the Premises was built before 1978, Landlord discloses any known lead-based paint hazards per federal law (42 U.S.C. 4852d).

  ----------------------------------------------------------

  20. TENANT ACKNOWLEDGMENT

  By signing electronically, Tenant confirms they have read and agree to all terms. Electronic signature is legally binding per applicable law. Tenant certifies they are at least 18 years old.

  ----------------------------------------------------------

  LANDLORD SIGNATURE:

  _______________________________
  {{landlord_name}}
  Date: _________________________$tmpl$,
    '["tenant_full_name","tenant_email","tenant_phone","property_address","lease_start_date","lease_end_date","monthly_rent","security_deposit","move_in_costs","landlord_name","landlord_address","late_fee_flat","late_fee_daily","state_code","pets_policy","smoking_policy","app_id"]'::jsonb,
    'Comprehensive Michigan Residential Lease. Covers all required MI statutory disclosures. Created by QA automated migration.',
    'system'
  )
  ON CONFLICT DO NOTHING;

  -- Verify the template was inserted
  SELECT id, name, is_active, LENGTH(template_body) as body_length, created_at 
  FROM lease_templates 
  WHERE is_active = true;
  