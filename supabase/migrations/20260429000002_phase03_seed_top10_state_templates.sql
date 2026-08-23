-- ─────────────────────────────────────────────────────────────────────
  -- Phase 03 — Seed 10 statute-derived multi-state lease templates
  --
  -- Top 10 US states by Choice Properties target geography:
  --   CA, TX, FL, NY, IL, OH, GA, NC, PA, MI
  --
  -- Each template:
  --   • is is_active=true for its state (per-state unique-active index)
  --   • includes the {% include "common/disclaimer" %} partial at the top
  --   • references the actual state's statute citations (security deposit,
  --     entry notice hours, eviction notice days, holdover rule, governing law)
  --     from public.state_lease_law (Phase 02 source of truth)
  --   • is legal_review_status='statute_derived' until an attorney signs off
  --
  -- Idempotency:
  --   1. Deactivate any other active template per state that we don't own
  --      (so the unique active-per-state index doesn't conflict).
  --   2. Upsert each seed by its deterministic UUID.
  --
  -- Brief: lease-phases/PHASE_03_multi_state_templates.md  §7 "Top-10 seeds"
  -- ─────────────────────────────────────────────────────────────────────

  BEGIN;

  -- 1. Deactivate any non-Phase-03 active templates in our 10 target states
  --    so the per-state unique active index won't conflict with our upsert.
  UPDATE public.lease_templates
     SET is_active = false,
         updated_at = NOW()
   WHERE state_code IN ('CA', 'TX', 'FL', 'NY', 'IL', 'OH', 'GA', 'NC', 'PA', 'MI')
     AND is_active = true
     AND id NOT IN ('21c409eb-9417-4605-bb7e-64397b309c8f', 'dc1772e7-4931-4e6f-8c70-24a3197856b8', '75405095-31f3-4024-be1e-3a76933513b4', '963e2513-80dc-4c07-a487-afd0175c838a', '35a52222-f605-44d7-b570-a9e253dafb66', 'e844dc4f-e39d-4a2e-8235-0d75b5512f41', 'bbfa07a0-45d3-45fa-86f0-512b97156f4d', 'e00e7b2f-d9b5-4908-b346-809f983ced58', 'bd20f8ea-aed9-43ec-bbb7-ff82505f636c', 'bd0bb505-e716-4458-b703-2af812a1f1ab');

  -- 2. Upsert each seed template by its fixed UUID.
  
  INSERT INTO public.lease_templates (
    id, name, state_code, template_body, is_active,
    legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
    variables, created_at, updated_at
  ) VALUES (
    '21c409eb-9417-4605-bb7e-64397b309c8f',
    $body$Phase 03 — California Standard Residential Lease$body$,
    'CA',
    $body$CALIFORNIA RESIDENTIAL LEASE AGREEMENT

  {% include "common/disclaimer" %}

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

    (the "Premises"), to be used solely as a private residential dwelling in the State of California.

    ----------------------------------------------------------

    2. LEASE TERM

    The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Holdover tenancy shall be at the court's discretion under California Code of Civil Procedure §1161.

    ----------------------------------------------------------

    3. RENT

    Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month, payable to Landlord at the address specified above or by any electronic method Landlord designates in writing.

    ----------------------------------------------------------

    4. LATE FEES

    Late fees must be a reasonable estimate of actual damages and shall not constitute a penalty. If a late fee applies under this lease, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day for each additional day rent remains unpaid.

    ----------------------------------------------------------

    5. SECURITY DEPOSIT

    Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession of the Premises. 1 month's rent (unfurnished). Per California Civil Code §1950.5. The deposit shall be returned within 21 days of lease termination, less lawful deductions for unpaid rent, damages beyond ordinary wear and tear, and other charges allowed by Cal. Civ. Code §1950.5.

    ----------------------------------------------------------

    6. MOVE-IN COSTS

    Total move-in costs due prior to possession: {{move_in_costs}}.

    ----------------------------------------------------------

    7. UTILITIES AND SERVICES

    Tenant is responsible for all utilities including electricity, gas, water, sewer, internet, and trash collection, unless otherwise agreed in writing as part of this Agreement.

    ----------------------------------------------------------

    8. USE OF PREMISES

    Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable federal, state, and local laws, ordinances, and regulations.

    ----------------------------------------------------------

    9. PETS POLICY

    {{pets_policy}}

    ----------------------------------------------------------

    10. SMOKING POLICY

    {{smoking_policy}}

    ----------------------------------------------------------

    11. MAINTENANCE AND REPAIRS

    Tenant shall keep the Premises in a clean and sanitary condition and shall promptly notify Landlord in writing of any needed repairs. Tenant is responsible for damages caused by Tenant, Tenant's guests, or invitees beyond ordinary wear and tear. Landlord shall be responsible for maintaining the Premises in habitable condition as required by California law.

    ----------------------------------------------------------

    12. ALTERATIONS

    Tenant shall not make any alterations, additions, or improvements to the Premises (including painting, installing fixtures, or changing locks) without prior written consent from Landlord.

    ----------------------------------------------------------

    13. ACCESS BY LANDLORD

    Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, maintenance, or to show the Premises to prospective tenants or buyers, per Cal. Civ. Code §1954. No notice is required in cases of emergency, abandonment, or court order.

    ----------------------------------------------------------

    14. SUBLETTING AND ASSIGNMENT

    Tenant shall not sublet the Premises or assign this Agreement, in whole or in part, without prior written consent from Landlord, which shall not be unreasonably withheld.

    ----------------------------------------------------------

    15. HOLDOVER

    Holdover tenancy shall be at the court's discretion under California Code of Civil Procedure §1161.

    ----------------------------------------------------------

    16. DEFAULT AND EVICTION

    Failure to pay rent or breach of any material term of this Agreement may result in termination and eviction in accordance with California law. The notice period for non-payment of rent is 3 day(s). The notice period for other lease violations is 3 day(s). All eviction procedures shall comply with Cal. Civ. Proc. Code §1161.

    ----------------------------------------------------------

    17. GOVERNING LAW

    This Agreement is governed by the laws of the State of California, including the California Civil Code §§1940–1954.05 (Hiring of Real Property), §§1946–1947.7 (Termination), §§1950.5–1951.4 (Security Deposits), and the Tenant Protection Act of 2019 (AB-1482) where applicable.

    ----------------------------------------------------------

    18. ENTIRE AGREEMENT

    This Agreement, together with any addenda signed by both parties, constitutes the entire understanding between Landlord and Tenant. It may only be modified by a written instrument signed by both parties. If any provision of this Agreement is held to be unenforceable, the remaining provisions shall remain in full force and effect.

    ----------------------------------------------------------

    19. LEAD-BASED PAINT DISCLOSURE

    If the Premises was constructed before 1978, Landlord discloses any known lead-based paint or lead-based paint hazards in compliance with the federal Residential Lead-Based Paint Hazard Reduction Act (42 U.S.C. §4852d) and Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home".

    ----------------------------------------------------------

    20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

    By signing electronically, Tenant confirms that Tenant has read and understands all terms of this Agreement and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable California law. Tenant certifies that Tenant is at least 18 years old and has the legal capacity to enter into this Agreement.
  
    ----------------------------------------------------------

    21. TRANSLATION OF LEASE (CA Civ. Code §1632)

    If this lease was negotiated primarily in Spanish, Chinese, Tagalog, Vietnamese, or Korean, Tenant is entitled to a translated copy of this lease in that language prior to signing.
  
    ----------------------------------------------------------

    22. JUST CAUSE TERMINATION (CA Civ. Code §1946.2 / AB-1482)

    After 12 months of occupancy, Landlord may only terminate this tenancy for "just cause" as defined in California Civil Code §1946.2. Just cause includes non-payment of rent, breach of material lease term, criminal activity, and certain no-fault grounds requiring relocation assistance.
  
    ----------------------------------------------------------

    LANDLORD SIGNATURE:

    _______________________________
    {{landlord_name}}
    Date: _________________________
  $body$,
    true,
    'statute_derived',
    NULL, NULL, NULL,
    '{"state_code": "CA"}'::jsonb,
    NOW(), NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    name                 = EXCLUDED.name,
    state_code           = EXCLUDED.state_code,
    template_body        = EXCLUDED.template_body,
    is_active            = true,
    legal_review_status  = EXCLUDED.legal_review_status,
    variables            = EXCLUDED.variables,
    updated_at           = NOW();
  

  INSERT INTO public.lease_templates (
    id, name, state_code, template_body, is_active,
    legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
    variables, created_at, updated_at
  ) VALUES (
    'dc1772e7-4931-4e6f-8c70-24a3197856b8',
    $body$Phase 03 — Texas Standard Residential Lease$body$,
    'TX',
    $body$TEXAS RESIDENTIAL LEASE AGREEMENT

  {% include "common/disclaimer" %}

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

    (the "Premises"), to be used solely as a private residential dwelling in the State of Texas.

    ----------------------------------------------------------

    2. LEASE TERM

    The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Holdover tenancy shall be at Landlord's sole discretion and may be treated as month-to-month or as trespass per Texas Property Code §24.002.

    ----------------------------------------------------------

    3. RENT

    Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month, payable to Landlord at the address specified above or by any electronic method Landlord designates in writing.

    ----------------------------------------------------------

    4. LATE FEES

    Late fees may be charged after a 2-day grace period. Late fees must be reasonable per Texas Property Code §92.019, generally not exceeding 12% of monthly rent for properties with ≤4 units (10% for larger). If a late fee applies under this lease, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day for each additional day rent remains unpaid.

    ----------------------------------------------------------

    5. SECURITY DEPOSIT

    Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession of the Premises. No statutory cap. Per Texas Property Code §92.101 et seq. The deposit shall be returned within 30 days of lease termination, less lawful deductions for unpaid rent, damages beyond ordinary wear and tear, and other charges allowed by Tex. Prop. Code §92.103.

    ----------------------------------------------------------

    6. MOVE-IN COSTS

    Total move-in costs due prior to possession: {{move_in_costs}}.

    ----------------------------------------------------------

    7. UTILITIES AND SERVICES

    Tenant is responsible for all utilities including electricity, gas, water, sewer, internet, and trash collection, unless otherwise agreed in writing as part of this Agreement.

    ----------------------------------------------------------

    8. USE OF PREMISES

    Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable federal, state, and local laws, ordinances, and regulations.

    ----------------------------------------------------------

    9. PETS POLICY

    {{pets_policy}}

    ----------------------------------------------------------

    10. SMOKING POLICY

    {{smoking_policy}}

    ----------------------------------------------------------

    11. MAINTENANCE AND REPAIRS

    Tenant shall keep the Premises in a clean and sanitary condition and shall promptly notify Landlord in writing of any needed repairs. Tenant is responsible for damages caused by Tenant, Tenant's guests, or invitees beyond ordinary wear and tear. Landlord shall be responsible for maintaining the Premises in habitable condition as required by Texas law.

    ----------------------------------------------------------

    12. ALTERATIONS

    Tenant shall not make any alterations, additions, or improvements to the Premises (including painting, installing fixtures, or changing locks) without prior written consent from Landlord.

    ----------------------------------------------------------

    13. ACCESS BY LANDLORD

    Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, maintenance, or to show the Premises to prospective tenants or buyers, per Texas common law (no specific statutory hours). No notice is required in cases of emergency, abandonment, or court order.

    ----------------------------------------------------------

    14. SUBLETTING AND ASSIGNMENT

    Tenant shall not sublet the Premises or assign this Agreement, in whole or in part, without prior written consent from Landlord, which shall not be unreasonably withheld.

    ----------------------------------------------------------

    15. HOLDOVER

    Holdover tenancy shall be at Landlord's sole discretion and may be treated as month-to-month or as trespass per Texas Property Code §24.002.

    ----------------------------------------------------------

    16. DEFAULT AND EVICTION

    Failure to pay rent or breach of any material term of this Agreement may result in termination and eviction in accordance with Texas law. The notice period for non-payment of rent is 3 day(s). The notice period for other lease violations is 30 day(s). All eviction procedures shall comply with Tex. Prop. Code §24.005.

    ----------------------------------------------------------

    17. GOVERNING LAW

    This Agreement is governed by the laws of the State of Texas, including the Texas Property Code Chapter 92 (Residential Tenancies) and Chapter 24 (Forcible Entry and Detainer).

    ----------------------------------------------------------

    18. ENTIRE AGREEMENT

    This Agreement, together with any addenda signed by both parties, constitutes the entire understanding between Landlord and Tenant. It may only be modified by a written instrument signed by both parties. If any provision of this Agreement is held to be unenforceable, the remaining provisions shall remain in full force and effect.

    ----------------------------------------------------------

    19. LEAD-BASED PAINT DISCLOSURE

    If the Premises was constructed before 1978, Landlord discloses any known lead-based paint or lead-based paint hazards in compliance with the federal Residential Lead-Based Paint Hazard Reduction Act (42 U.S.C. §4852d) and Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home".

    ----------------------------------------------------------

    20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

    By signing electronically, Tenant confirms that Tenant has read and understands all terms of this Agreement and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Texas law. Tenant certifies that Tenant is at least 18 years old and has the legal capacity to enter into this Agreement.
  
    ----------------------------------------------------------

    21. PARKING ADDENDUM (Texas Property Code §92.0131)

    If the Premises is part of a multi-unit complex with assigned or controlled parking, Landlord shall provide tenant with the parking rules in writing.
  
    ----------------------------------------------------------

    LANDLORD SIGNATURE:

    _______________________________
    {{landlord_name}}
    Date: _________________________
  $body$,
    true,
    'statute_derived',
    NULL, NULL, NULL,
    '{"state_code": "TX"}'::jsonb,
    NOW(), NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    name                 = EXCLUDED.name,
    state_code           = EXCLUDED.state_code,
    template_body        = EXCLUDED.template_body,
    is_active            = true,
    legal_review_status  = EXCLUDED.legal_review_status,
    variables            = EXCLUDED.variables,
    updated_at           = NOW();
  

  INSERT INTO public.lease_templates (
    id, name, state_code, template_body, is_active,
    legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
    variables, created_at, updated_at
  ) VALUES (
    '75405095-31f3-4024-be1e-3a76933513b4',
    $body$Phase 03 — Florida Standard Residential Lease$body$,
    'FL',
    $body$FLORIDA RESIDENTIAL LEASE AGREEMENT

  {% include "common/disclaimer" %}

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

    (the "Premises"), to be used solely as a private residential dwelling in the State of Florida.

    ----------------------------------------------------------

    2. LEASE TERM

    The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. A tenant who continues to occupy the Premises after lease expiration without Landlord consent shall be liable for double the amount of rent due during the holdover period, per Florida Statutes §83.58.

    ----------------------------------------------------------

    3. RENT

    Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month, payable to Landlord at the address specified above or by any electronic method Landlord designates in writing.

    ----------------------------------------------------------

    4. LATE FEES

    Late fees may be assessed per the lease but must be reasonable. Florida law does not impose a statutory cap. If a late fee applies under this lease, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day for each additional day rent remains unpaid.

    ----------------------------------------------------------

    5. SECURITY DEPOSIT

    Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession of the Premises. No statutory cap. Held under Florida Statutes §83.49. The deposit shall be returned within 15 days of lease termination, less lawful deductions for unpaid rent, damages beyond ordinary wear and tear, and other charges allowed by Fla. Stat. §83.49.

    ----------------------------------------------------------

    6. MOVE-IN COSTS

    Total move-in costs due prior to possession: {{move_in_costs}}.

    ----------------------------------------------------------

    7. UTILITIES AND SERVICES

    Tenant is responsible for all utilities including electricity, gas, water, sewer, internet, and trash collection, unless otherwise agreed in writing as part of this Agreement.

    ----------------------------------------------------------

    8. USE OF PREMISES

    Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable federal, state, and local laws, ordinances, and regulations.

    ----------------------------------------------------------

    9. PETS POLICY

    {{pets_policy}}

    ----------------------------------------------------------

    10. SMOKING POLICY

    {{smoking_policy}}

    ----------------------------------------------------------

    11. MAINTENANCE AND REPAIRS

    Tenant shall keep the Premises in a clean and sanitary condition and shall promptly notify Landlord in writing of any needed repairs. Tenant is responsible for damages caused by Tenant, Tenant's guests, or invitees beyond ordinary wear and tear. Landlord shall be responsible for maintaining the Premises in habitable condition as required by Florida law.

    ----------------------------------------------------------

    12. ALTERATIONS

    Tenant shall not make any alterations, additions, or improvements to the Premises (including painting, installing fixtures, or changing locks) without prior written consent from Landlord.

    ----------------------------------------------------------

    13. ACCESS BY LANDLORD

    Landlord may enter the Premises with at least 12 hours' advance notice for inspection, repairs, maintenance, or to show the Premises to prospective tenants or buyers, per Fla. Stat. §83.53. No notice is required in cases of emergency, abandonment, or court order.

    ----------------------------------------------------------

    14. SUBLETTING AND ASSIGNMENT

    Tenant shall not sublet the Premises or assign this Agreement, in whole or in part, without prior written consent from Landlord, which shall not be unreasonably withheld.

    ----------------------------------------------------------

    15. HOLDOVER

    A tenant who continues to occupy the Premises after lease expiration without Landlord consent shall be liable for double the amount of rent due during the holdover period, per Florida Statutes §83.58.

    ----------------------------------------------------------

    16. DEFAULT AND EVICTION

    Failure to pay rent or breach of any material term of this Agreement may result in termination and eviction in accordance with Florida law. The notice period for non-payment of rent is 3 day(s). The notice period for other lease violations is 7 day(s). All eviction procedures shall comply with Fla. Stat. §83.56.

    ----------------------------------------------------------

    17. GOVERNING LAW

    This Agreement is governed by the laws of the State of Florida, including the Florida Residential Landlord and Tenant Act, Fla. Stat. §§83.40–83.683.

    ----------------------------------------------------------

    18. ENTIRE AGREEMENT

    This Agreement, together with any addenda signed by both parties, constitutes the entire understanding between Landlord and Tenant. It may only be modified by a written instrument signed by both parties. If any provision of this Agreement is held to be unenforceable, the remaining provisions shall remain in full force and effect.

    ----------------------------------------------------------

    19. LEAD-BASED PAINT DISCLOSURE

    If the Premises was constructed before 1978, Landlord discloses any known lead-based paint or lead-based paint hazards in compliance with the federal Residential Lead-Based Paint Hazard Reduction Act (42 U.S.C. §4852d) and Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home".

    ----------------------------------------------------------

    20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

    By signing electronically, Tenant confirms that Tenant has read and understands all terms of this Agreement and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Florida law. Tenant certifies that Tenant is at least 18 years old and has the legal capacity to enter into this Agreement.
  
    ----------------------------------------------------------

    21. RADON GAS DISCLOSURE (Fla. Stat. §404.056)

    Radon is a naturally occurring radioactive gas that, when accumulated in a building in sufficient quantities, may present health risks. Additional information regarding radon and radon testing may be obtained from your county health department.
  
    ----------------------------------------------------------

    LANDLORD SIGNATURE:

    _______________________________
    {{landlord_name}}
    Date: _________________________
  $body$,
    true,
    'statute_derived',
    NULL, NULL, NULL,
    '{"state_code": "FL"}'::jsonb,
    NOW(), NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    name                 = EXCLUDED.name,
    state_code           = EXCLUDED.state_code,
    template_body        = EXCLUDED.template_body,
    is_active            = true,
    legal_review_status  = EXCLUDED.legal_review_status,
    variables            = EXCLUDED.variables,
    updated_at           = NOW();
  

  INSERT INTO public.lease_templates (
    id, name, state_code, template_body, is_active,
    legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
    variables, created_at, updated_at
  ) VALUES (
    '963e2513-80dc-4c07-a487-afd0175c838a',
    $body$Phase 03 — New York Standard Residential Lease$body$,
    'NY',
    $body$NEW YORK RESIDENTIAL LEASE AGREEMENT

  {% include "common/disclaimer" %}

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

    (the "Premises"), to be used solely as a private residential dwelling in the State of New York.

    ----------------------------------------------------------

    2. LEASE TERM

    The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Holdover proceedings shall follow the procedures of N.Y. Real Property Actions and Proceedings Law §711.

    ----------------------------------------------------------

    3. RENT

    Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month, payable to Landlord at the address specified above or by any electronic method Landlord designates in writing.

    ----------------------------------------------------------

    4. LATE FEES

    Late fees may not be charged until rent is at least 5 days past due, and may not exceed the lesser of 5% of monthly rent or $50, per N.Y. Real Property Law §238-a. If a late fee applies under this lease, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day for each additional day rent remains unpaid.

    ----------------------------------------------------------

    5. SECURITY DEPOSIT

    Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession of the Premises. Maximum 1 month's rent. Per N.Y. General Obligations Law §7-108 (Housing Stability and Tenant Protection Act of 2019). The deposit shall be returned within 14 days of lease termination, less lawful deductions for unpaid rent, damages beyond ordinary wear and tear, and other charges allowed by N.Y. Gen. Oblig. Law §7-108.

    ----------------------------------------------------------

    6. MOVE-IN COSTS

    Total move-in costs due prior to possession: {{move_in_costs}}.

    ----------------------------------------------------------

    7. UTILITIES AND SERVICES

    Tenant is responsible for all utilities including electricity, gas, water, sewer, internet, and trash collection, unless otherwise agreed in writing as part of this Agreement.

    ----------------------------------------------------------

    8. USE OF PREMISES

    Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable federal, state, and local laws, ordinances, and regulations.

    ----------------------------------------------------------

    9. PETS POLICY

    {{pets_policy}}

    ----------------------------------------------------------

    10. SMOKING POLICY

    {{smoking_policy}}

    ----------------------------------------------------------

    11. MAINTENANCE AND REPAIRS

    Tenant shall keep the Premises in a clean and sanitary condition and shall promptly notify Landlord in writing of any needed repairs. Tenant is responsible for damages caused by Tenant, Tenant's guests, or invitees beyond ordinary wear and tear. Landlord shall be responsible for maintaining the Premises in habitable condition as required by New York law.

    ----------------------------------------------------------

    12. ALTERATIONS

    Tenant shall not make any alterations, additions, or improvements to the Premises (including painting, installing fixtures, or changing locks) without prior written consent from Landlord.

    ----------------------------------------------------------

    13. ACCESS BY LANDLORD

    Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, maintenance, or to show the Premises to prospective tenants or buyers, per New York common law (24 hours customary). No notice is required in cases of emergency, abandonment, or court order.

    ----------------------------------------------------------

    14. SUBLETTING AND ASSIGNMENT

    Tenant shall not sublet the Premises or assign this Agreement, in whole or in part, without prior written consent from Landlord, which shall not be unreasonably withheld.

    ----------------------------------------------------------

    15. HOLDOVER

    Holdover proceedings shall follow the procedures of N.Y. Real Property Actions and Proceedings Law §711.

    ----------------------------------------------------------

    16. DEFAULT AND EVICTION

    Failure to pay rent or breach of any material term of this Agreement may result in termination and eviction in accordance with New York law. The notice period for non-payment of rent is 14 day(s). The notice period for other lease violations is 30 day(s). All eviction procedures shall comply with N.Y. RPAPL §711.

    ----------------------------------------------------------

    17. GOVERNING LAW

    This Agreement is governed by the laws of the State of New York, including the N.Y. Real Property Law, N.Y. Real Property Actions and Proceedings Law (RPAPL), and the Housing Stability and Tenant Protection Act of 2019.

    ----------------------------------------------------------

    18. ENTIRE AGREEMENT

    This Agreement, together with any addenda signed by both parties, constitutes the entire understanding between Landlord and Tenant. It may only be modified by a written instrument signed by both parties. If any provision of this Agreement is held to be unenforceable, the remaining provisions shall remain in full force and effect.

    ----------------------------------------------------------

    19. LEAD-BASED PAINT DISCLOSURE

    If the Premises was constructed before 1978, Landlord discloses any known lead-based paint or lead-based paint hazards in compliance with the federal Residential Lead-Based Paint Hazard Reduction Act (42 U.S.C. §4852d) and Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home".

    ----------------------------------------------------------

    20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

    By signing electronically, Tenant confirms that Tenant has read and understands all terms of this Agreement and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable New York law. Tenant certifies that Tenant is at least 18 years old and has the legal capacity to enter into this Agreement.
  
    ----------------------------------------------------------

    21. WINDOW GUARDS NOTICE (NYC Admin Code §17-123)

    If the Premises is in New York City and a child age 10 or under resides at the Premises, Landlord is required by law to install window guards. Tenant must notify Landlord in writing if such a child resides or will reside at the Premises.
  
    ----------------------------------------------------------

    22. HSTPA RIGHTS (Housing Stability and Tenant Protection Act of 2019)

    Tenant's rights under New York's Housing Stability and Tenant Protection Act of 2019 are preserved and may not be waived by any provision of this lease. This includes limits on late fees, security deposits, and grounds for non-renewal.
  
    ----------------------------------------------------------

    LANDLORD SIGNATURE:

    _______________________________
    {{landlord_name}}
    Date: _________________________
  $body$,
    true,
    'statute_derived',
    NULL, NULL, NULL,
    '{"state_code": "NY"}'::jsonb,
    NOW(), NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    name                 = EXCLUDED.name,
    state_code           = EXCLUDED.state_code,
    template_body        = EXCLUDED.template_body,
    is_active            = true,
    legal_review_status  = EXCLUDED.legal_review_status,
    variables            = EXCLUDED.variables,
    updated_at           = NOW();
  

  INSERT INTO public.lease_templates (
    id, name, state_code, template_body, is_active,
    legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
    variables, created_at, updated_at
  ) VALUES (
    '35a52222-f605-44d7-b570-a9e253dafb66',
    $body$Phase 03 — Illinois Standard Residential Lease$body$,
    'IL',
    $body$ILLINOIS RESIDENTIAL LEASE AGREEMENT

  {% include "common/disclaimer" %}

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

    (the "Premises"), to be used solely as a private residential dwelling in the State of Illinois.

    ----------------------------------------------------------

    2. LEASE TERM

    The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Holdover tenancy shall be at the court's discretion under 735 ILCS 5/9-202.

    ----------------------------------------------------------

    3. RENT

    Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month, payable to Landlord at the address specified above or by any electronic method Landlord designates in writing.

    ----------------------------------------------------------

    4. LATE FEES

    Late fees in non-Chicago Illinois rentals are governed by the lease but must be reasonable. Chicago Residential Landlord and Tenant Ordinance (RLTO) caps late fees at $10/month for the first $500 of rent plus 5% of rent above $500. If a late fee applies under this lease, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day for each additional day rent remains unpaid.

    ----------------------------------------------------------

    5. SECURITY DEPOSIT

    Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession of the Premises. No statewide statutory cap (some municipalities including Chicago impose limits). Per 765 ILCS 710 (Security Deposit Return Act) and 765 ILCS 715 (Security Deposit Interest Act). The deposit shall be returned within 30 days of lease termination, less lawful deductions for unpaid rent, damages beyond ordinary wear and tear, and other charges allowed by 765 ILCS 710/1.

    ----------------------------------------------------------

    6. MOVE-IN COSTS

    Total move-in costs due prior to possession: {{move_in_costs}}.

    ----------------------------------------------------------

    7. UTILITIES AND SERVICES

    Tenant is responsible for all utilities including electricity, gas, water, sewer, internet, and trash collection, unless otherwise agreed in writing as part of this Agreement.

    ----------------------------------------------------------

    8. USE OF PREMISES

    Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable federal, state, and local laws, ordinances, and regulations.

    ----------------------------------------------------------

    9. PETS POLICY

    {{pets_policy}}

    ----------------------------------------------------------

    10. SMOKING POLICY

    {{smoking_policy}}

    ----------------------------------------------------------

    11. MAINTENANCE AND REPAIRS

    Tenant shall keep the Premises in a clean and sanitary condition and shall promptly notify Landlord in writing of any needed repairs. Tenant is responsible for damages caused by Tenant, Tenant's guests, or invitees beyond ordinary wear and tear. Landlord shall be responsible for maintaining the Premises in habitable condition as required by Illinois law.

    ----------------------------------------------------------

    12. ALTERATIONS

    Tenant shall not make any alterations, additions, or improvements to the Premises (including painting, installing fixtures, or changing locks) without prior written consent from Landlord.

    ----------------------------------------------------------

    13. ACCESS BY LANDLORD

    Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, maintenance, or to show the Premises to prospective tenants or buyers, per Illinois common law (Chicago RLTO §5-12-050 codifies 24 hours). No notice is required in cases of emergency, abandonment, or court order.

    ----------------------------------------------------------

    14. SUBLETTING AND ASSIGNMENT

    Tenant shall not sublet the Premises or assign this Agreement, in whole or in part, without prior written consent from Landlord, which shall not be unreasonably withheld.

    ----------------------------------------------------------

    15. HOLDOVER

    Holdover tenancy shall be at the court's discretion under 735 ILCS 5/9-202.

    ----------------------------------------------------------

    16. DEFAULT AND EVICTION

    Failure to pay rent or breach of any material term of this Agreement may result in termination and eviction in accordance with Illinois law. The notice period for non-payment of rent is 5 day(s). The notice period for other lease violations is 10 day(s). All eviction procedures shall comply with 735 ILCS 5/9-209.

    ----------------------------------------------------------

    17. GOVERNING LAW

    This Agreement is governed by the laws of the State of Illinois, including the Illinois Security Deposit Return Act (765 ILCS 710), Security Deposit Interest Act (765 ILCS 715), and the Forcible Entry and Detainer Act (735 ILCS 5/Art. IX).

    ----------------------------------------------------------

    18. ENTIRE AGREEMENT

    This Agreement, together with any addenda signed by both parties, constitutes the entire understanding between Landlord and Tenant. It may only be modified by a written instrument signed by both parties. If any provision of this Agreement is held to be unenforceable, the remaining provisions shall remain in full force and effect.

    ----------------------------------------------------------

    19. LEAD-BASED PAINT DISCLOSURE

    If the Premises was constructed before 1978, Landlord discloses any known lead-based paint or lead-based paint hazards in compliance with the federal Residential Lead-Based Paint Hazard Reduction Act (42 U.S.C. §4852d) and Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home".

    ----------------------------------------------------------

    20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

    By signing electronically, Tenant confirms that Tenant has read and understands all terms of this Agreement and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Illinois law. Tenant certifies that Tenant is at least 18 years old and has the legal capacity to enter into this Agreement.
  
    ----------------------------------------------------------

    21. RADON DISCLOSURE (Illinois Radon Awareness Act, 420 ILCS 46/)

    Tenant has the right to test for radon at Tenant's own expense. Landlord must disclose any known radon hazards and provide the IEMA pamphlet "Radon Guide for Tenants".
  
    ----------------------------------------------------------

    LANDLORD SIGNATURE:

    _______________________________
    {{landlord_name}}
    Date: _________________________
  $body$,
    true,
    'statute_derived',
    NULL, NULL, NULL,
    '{"state_code": "IL"}'::jsonb,
    NOW(), NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    name                 = EXCLUDED.name,
    state_code           = EXCLUDED.state_code,
    template_body        = EXCLUDED.template_body,
    is_active            = true,
    legal_review_status  = EXCLUDED.legal_review_status,
    variables            = EXCLUDED.variables,
    updated_at           = NOW();
  

  INSERT INTO public.lease_templates (
    id, name, state_code, template_body, is_active,
    legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
    variables, created_at, updated_at
  ) VALUES (
    'e844dc4f-e39d-4a2e-8235-0d75b5512f41',
    $body$Phase 03 — Ohio Standard Residential Lease$body$,
    'OH',
    $body$OHIO RESIDENTIAL LEASE AGREEMENT

  {% include "common/disclaimer" %}

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

    (the "Premises"), to be used solely as a private residential dwelling in the State of Ohio.

    ----------------------------------------------------------

    2. LEASE TERM

    The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Holdover tenancy shall be at the court's discretion under Ohio Revised Code §1923.

    ----------------------------------------------------------

    3. RENT

    Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month, payable to Landlord at the address specified above or by any electronic method Landlord designates in writing.

    ----------------------------------------------------------

    4. LATE FEES

    Late fees are governed by the lease and must be reasonable; Ohio law does not impose a statutory cap. If a late fee applies under this lease, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day for each additional day rent remains unpaid.

    ----------------------------------------------------------

    5. SECURITY DEPOSIT

    Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession of the Premises. No statutory cap. Held under Ohio Revised Code §5321.16. The deposit shall be returned within 30 days of lease termination, less lawful deductions for unpaid rent, damages beyond ordinary wear and tear, and other charges allowed by Ohio Rev. Code §5321.16.

    ----------------------------------------------------------

    6. MOVE-IN COSTS

    Total move-in costs due prior to possession: {{move_in_costs}}.

    ----------------------------------------------------------

    7. UTILITIES AND SERVICES

    Tenant is responsible for all utilities including electricity, gas, water, sewer, internet, and trash collection, unless otherwise agreed in writing as part of this Agreement.

    ----------------------------------------------------------

    8. USE OF PREMISES

    Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable federal, state, and local laws, ordinances, and regulations.

    ----------------------------------------------------------

    9. PETS POLICY

    {{pets_policy}}

    ----------------------------------------------------------

    10. SMOKING POLICY

    {{smoking_policy}}

    ----------------------------------------------------------

    11. MAINTENANCE AND REPAIRS

    Tenant shall keep the Premises in a clean and sanitary condition and shall promptly notify Landlord in writing of any needed repairs. Tenant is responsible for damages caused by Tenant, Tenant's guests, or invitees beyond ordinary wear and tear. Landlord shall be responsible for maintaining the Premises in habitable condition as required by Ohio law.

    ----------------------------------------------------------

    12. ALTERATIONS

    Tenant shall not make any alterations, additions, or improvements to the Premises (including painting, installing fixtures, or changing locks) without prior written consent from Landlord.

    ----------------------------------------------------------

    13. ACCESS BY LANDLORD

    Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, maintenance, or to show the Premises to prospective tenants or buyers, per Ohio Rev. Code §5321.04(A)(8). No notice is required in cases of emergency, abandonment, or court order.

    ----------------------------------------------------------

    14. SUBLETTING AND ASSIGNMENT

    Tenant shall not sublet the Premises or assign this Agreement, in whole or in part, without prior written consent from Landlord, which shall not be unreasonably withheld.

    ----------------------------------------------------------

    15. HOLDOVER

    Holdover tenancy shall be at the court's discretion under Ohio Revised Code §1923.

    ----------------------------------------------------------

    16. DEFAULT AND EVICTION

    Failure to pay rent or breach of any material term of this Agreement may result in termination and eviction in accordance with Ohio law. The notice period for non-payment of rent is 3 day(s). The notice period for other lease violations is 30 day(s). All eviction procedures shall comply with Ohio Rev. Code §1923.04.

    ----------------------------------------------------------

    17. GOVERNING LAW

    This Agreement is governed by the laws of the State of Ohio, including the Ohio Landlords and Tenants Act, Ohio Rev. Code Chapter 5321, and Forcible Entry and Detainer, Ohio Rev. Code Chapter 1923.

    ----------------------------------------------------------

    18. ENTIRE AGREEMENT

    This Agreement, together with any addenda signed by both parties, constitutes the entire understanding between Landlord and Tenant. It may only be modified by a written instrument signed by both parties. If any provision of this Agreement is held to be unenforceable, the remaining provisions shall remain in full force and effect.

    ----------------------------------------------------------

    19. LEAD-BASED PAINT DISCLOSURE

    If the Premises was constructed before 1978, Landlord discloses any known lead-based paint or lead-based paint hazards in compliance with the federal Residential Lead-Based Paint Hazard Reduction Act (42 U.S.C. §4852d) and Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home".

    ----------------------------------------------------------

    20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

    By signing electronically, Tenant confirms that Tenant has read and understands all terms of this Agreement and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Ohio law. Tenant certifies that Tenant is at least 18 years old and has the legal capacity to enter into this Agreement.
  
    ----------------------------------------------------------

    LANDLORD SIGNATURE:

    _______________________________
    {{landlord_name}}
    Date: _________________________
  $body$,
    true,
    'statute_derived',
    NULL, NULL, NULL,
    '{"state_code": "OH"}'::jsonb,
    NOW(), NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    name                 = EXCLUDED.name,
    state_code           = EXCLUDED.state_code,
    template_body        = EXCLUDED.template_body,
    is_active            = true,
    legal_review_status  = EXCLUDED.legal_review_status,
    variables            = EXCLUDED.variables,
    updated_at           = NOW();
  

  INSERT INTO public.lease_templates (
    id, name, state_code, template_body, is_active,
    legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
    variables, created_at, updated_at
  ) VALUES (
    'bbfa07a0-45d3-45fa-86f0-512b97156f4d',
    $body$Phase 03 — Georgia Standard Residential Lease$body$,
    'GA',
    $body$GEORGIA RESIDENTIAL LEASE AGREEMENT

  {% include "common/disclaimer" %}

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

    (the "Premises"), to be used solely as a private residential dwelling in the State of Georgia.

    ----------------------------------------------------------

    2. LEASE TERM

    The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. A tenant holding over after lease expiration becomes a tenant at sufferance and may be removed via dispossessory proceedings under O.C.G.A. §44-7-50.

    ----------------------------------------------------------

    3. RENT

    Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month, payable to Landlord at the address specified above or by any electronic method Landlord designates in writing.

    ----------------------------------------------------------

    4. LATE FEES

    Late fees are governed by the lease and must be reasonable. Georgia does not impose a statutory cap or required grace period for residential leases. If a late fee applies under this lease, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day for each additional day rent remains unpaid.

    ----------------------------------------------------------

    5. SECURITY DEPOSIT

    Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession of the Premises. No statutory cap. Per O.C.G.A. §44-7-30 et seq. Landlords with more than 10 rental units must place deposits in an escrow account. The deposit shall be returned within 30 days of lease termination, less lawful deductions for unpaid rent, damages beyond ordinary wear and tear, and other charges allowed by O.C.G.A. §44-7-34.

    ----------------------------------------------------------

    6. MOVE-IN COSTS

    Total move-in costs due prior to possession: {{move_in_costs}}.

    ----------------------------------------------------------

    7. UTILITIES AND SERVICES

    Tenant is responsible for all utilities including electricity, gas, water, sewer, internet, and trash collection, unless otherwise agreed in writing as part of this Agreement.

    ----------------------------------------------------------

    8. USE OF PREMISES

    Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable federal, state, and local laws, ordinances, and regulations.

    ----------------------------------------------------------

    9. PETS POLICY

    {{pets_policy}}

    ----------------------------------------------------------

    10. SMOKING POLICY

    {{smoking_policy}}

    ----------------------------------------------------------

    11. MAINTENANCE AND REPAIRS

    Tenant shall keep the Premises in a clean and sanitary condition and shall promptly notify Landlord in writing of any needed repairs. Tenant is responsible for damages caused by Tenant, Tenant's guests, or invitees beyond ordinary wear and tear. Landlord shall be responsible for maintaining the Premises in habitable condition as required by Georgia law.

    ----------------------------------------------------------

    12. ALTERATIONS

    Tenant shall not make any alterations, additions, or improvements to the Premises (including painting, installing fixtures, or changing locks) without prior written consent from Landlord.

    ----------------------------------------------------------

    13. ACCESS BY LANDLORD

    Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, maintenance, or to show the Premises to prospective tenants or buyers, per Georgia common law (no specific statutory hours). No notice is required in cases of emergency, abandonment, or court order.

    ----------------------------------------------------------

    14. SUBLETTING AND ASSIGNMENT

    Tenant shall not sublet the Premises or assign this Agreement, in whole or in part, without prior written consent from Landlord, which shall not be unreasonably withheld.

    ----------------------------------------------------------

    15. HOLDOVER

    A tenant holding over after lease expiration becomes a tenant at sufferance and may be removed via dispossessory proceedings under O.C.G.A. §44-7-50.

    ----------------------------------------------------------

    16. DEFAULT AND EVICTION

    Failure to pay rent or breach of any material term of this Agreement may result in termination and eviction in accordance with Georgia law. The notice period for non-payment of rent is 3 day(s). The notice period for other lease violations is 60 day(s). All eviction procedures shall comply with O.C.G.A. §44-7-50.

    ----------------------------------------------------------

    17. GOVERNING LAW

    This Agreement is governed by the laws of the State of Georgia, including the Georgia Landlord-Tenant Act, O.C.G.A. Title 44, Chapter 7.

    ----------------------------------------------------------

    18. ENTIRE AGREEMENT

    This Agreement, together with any addenda signed by both parties, constitutes the entire understanding between Landlord and Tenant. It may only be modified by a written instrument signed by both parties. If any provision of this Agreement is held to be unenforceable, the remaining provisions shall remain in full force and effect.

    ----------------------------------------------------------

    19. LEAD-BASED PAINT DISCLOSURE

    If the Premises was constructed before 1978, Landlord discloses any known lead-based paint or lead-based paint hazards in compliance with the federal Residential Lead-Based Paint Hazard Reduction Act (42 U.S.C. §4852d) and Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home".

    ----------------------------------------------------------

    20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

    By signing electronically, Tenant confirms that Tenant has read and understands all terms of this Agreement and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Georgia law. Tenant certifies that Tenant is at least 18 years old and has the legal capacity to enter into this Agreement.
  
    ----------------------------------------------------------

    LANDLORD SIGNATURE:

    _______________________________
    {{landlord_name}}
    Date: _________________________
  $body$,
    true,
    'statute_derived',
    NULL, NULL, NULL,
    '{"state_code": "GA"}'::jsonb,
    NOW(), NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    name                 = EXCLUDED.name,
    state_code           = EXCLUDED.state_code,
    template_body        = EXCLUDED.template_body,
    is_active            = true,
    legal_review_status  = EXCLUDED.legal_review_status,
    variables            = EXCLUDED.variables,
    updated_at           = NOW();
  

  INSERT INTO public.lease_templates (
    id, name, state_code, template_body, is_active,
    legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
    variables, created_at, updated_at
  ) VALUES (
    'e00e7b2f-d9b5-4908-b346-809f983ced58',
    $body$Phase 03 — North Carolina Standard Residential Lease$body$,
    'NC',
    $body$NORTH CAROLINA RESIDENTIAL LEASE AGREEMENT

  {% include "common/disclaimer" %}

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

    (the "Premises"), to be used solely as a private residential dwelling in the State of North Carolina.

    ----------------------------------------------------------

    2. LEASE TERM

    The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Holdover tenancy shall be at the court's discretion under N.C.G.S. Chapter 42, Article 3.

    ----------------------------------------------------------

    3. RENT

    Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month, payable to Landlord at the address specified above or by any electronic method Landlord designates in writing.

    ----------------------------------------------------------

    4. LATE FEES

    Late fees may not exceed the greater of $15 or 5% of monthly rent, and may not be charged until rent is at least 5 days past due, per N.C.G.S. §42-46. If a late fee applies under this lease, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day for each additional day rent remains unpaid.

    ----------------------------------------------------------

    5. SECURITY DEPOSIT

    Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession of the Premises. For month-to-month: max 1.5× monthly rent. For longer terms: max 2× monthly rent. Per N.C.G.S. §42-51 (Tenant Security Deposit Act). The deposit shall be returned within 30 days of lease termination, less lawful deductions for unpaid rent, damages beyond ordinary wear and tear, and other charges allowed by N.C.G.S. §42-52.

    ----------------------------------------------------------

    6. MOVE-IN COSTS

    Total move-in costs due prior to possession: {{move_in_costs}}.

    ----------------------------------------------------------

    7. UTILITIES AND SERVICES

    Tenant is responsible for all utilities including electricity, gas, water, sewer, internet, and trash collection, unless otherwise agreed in writing as part of this Agreement.

    ----------------------------------------------------------

    8. USE OF PREMISES

    Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable federal, state, and local laws, ordinances, and regulations.

    ----------------------------------------------------------

    9. PETS POLICY

    {{pets_policy}}

    ----------------------------------------------------------

    10. SMOKING POLICY

    {{smoking_policy}}

    ----------------------------------------------------------

    11. MAINTENANCE AND REPAIRS

    Tenant shall keep the Premises in a clean and sanitary condition and shall promptly notify Landlord in writing of any needed repairs. Tenant is responsible for damages caused by Tenant, Tenant's guests, or invitees beyond ordinary wear and tear. Landlord shall be responsible for maintaining the Premises in habitable condition as required by North Carolina law.

    ----------------------------------------------------------

    12. ALTERATIONS

    Tenant shall not make any alterations, additions, or improvements to the Premises (including painting, installing fixtures, or changing locks) without prior written consent from Landlord.

    ----------------------------------------------------------

    13. ACCESS BY LANDLORD

    Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, maintenance, or to show the Premises to prospective tenants or buyers, per North Carolina common law (no specific statutory hours). No notice is required in cases of emergency, abandonment, or court order.

    ----------------------------------------------------------

    14. SUBLETTING AND ASSIGNMENT

    Tenant shall not sublet the Premises or assign this Agreement, in whole or in part, without prior written consent from Landlord, which shall not be unreasonably withheld.

    ----------------------------------------------------------

    15. HOLDOVER

    Holdover tenancy shall be at the court's discretion under N.C.G.S. Chapter 42, Article 3.

    ----------------------------------------------------------

    16. DEFAULT AND EVICTION

    Failure to pay rent or breach of any material term of this Agreement may result in termination and eviction in accordance with North Carolina law. The notice period for non-payment of rent is 10 day(s). The notice period for other lease violations is 30 day(s). All eviction procedures shall comply with N.C.G.S. §42-3 / §42-26.

    ----------------------------------------------------------

    17. GOVERNING LAW

    This Agreement is governed by the laws of the State of North Carolina, including the North Carolina Residential Rental Agreements Act (Chapter 42, Article 5) and the Tenant Security Deposit Act (Chapter 42, Article 6).

    ----------------------------------------------------------

    18. ENTIRE AGREEMENT

    This Agreement, together with any addenda signed by both parties, constitutes the entire understanding between Landlord and Tenant. It may only be modified by a written instrument signed by both parties. If any provision of this Agreement is held to be unenforceable, the remaining provisions shall remain in full force and effect.

    ----------------------------------------------------------

    19. LEAD-BASED PAINT DISCLOSURE

    If the Premises was constructed before 1978, Landlord discloses any known lead-based paint or lead-based paint hazards in compliance with the federal Residential Lead-Based Paint Hazard Reduction Act (42 U.S.C. §4852d) and Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home".

    ----------------------------------------------------------

    20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

    By signing electronically, Tenant confirms that Tenant has read and understands all terms of this Agreement and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable North Carolina law. Tenant certifies that Tenant is at least 18 years old and has the legal capacity to enter into this Agreement.
  
    ----------------------------------------------------------

    LANDLORD SIGNATURE:

    _______________________________
    {{landlord_name}}
    Date: _________________________
  $body$,
    true,
    'statute_derived',
    NULL, NULL, NULL,
    '{"state_code": "NC"}'::jsonb,
    NOW(), NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    name                 = EXCLUDED.name,
    state_code           = EXCLUDED.state_code,
    template_body        = EXCLUDED.template_body,
    is_active            = true,
    legal_review_status  = EXCLUDED.legal_review_status,
    variables            = EXCLUDED.variables,
    updated_at           = NOW();
  

  INSERT INTO public.lease_templates (
    id, name, state_code, template_body, is_active,
    legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
    variables, created_at, updated_at
  ) VALUES (
    'bd20f8ea-aed9-43ec-bbb7-ff82505f636c',
    $body$Phase 03 — Pennsylvania Standard Residential Lease$body$,
    'PA',
    $body$PENNSYLVANIA RESIDENTIAL LEASE AGREEMENT

  {% include "common/disclaimer" %}

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

    (the "Premises"), to be used solely as a private residential dwelling in the State of Pennsylvania.

    ----------------------------------------------------------

    2. LEASE TERM

    The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Holdover tenancy shall be at the court's discretion under the Pennsylvania Landlord and Tenant Act of 1951.

    ----------------------------------------------------------

    3. RENT

    Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month, payable to Landlord at the address specified above or by any electronic method Landlord designates in writing.

    ----------------------------------------------------------

    4. LATE FEES

    Late fees are governed by the lease and must be reasonable; Pennsylvania does not impose a statutory cap on residential lease late fees. If a late fee applies under this lease, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day for each additional day rent remains unpaid.

    ----------------------------------------------------------

    5. SECURITY DEPOSIT

    Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession of the Premises. First year: max 2× monthly rent. After first year: max 1× monthly rent. Per 68 P.S. §250.511a-b. The deposit shall be returned within 30 days of lease termination, less lawful deductions for unpaid rent, damages beyond ordinary wear and tear, and other charges allowed by 68 P.S. §250.512.

    ----------------------------------------------------------

    6. MOVE-IN COSTS

    Total move-in costs due prior to possession: {{move_in_costs}}.

    ----------------------------------------------------------

    7. UTILITIES AND SERVICES

    Tenant is responsible for all utilities including electricity, gas, water, sewer, internet, and trash collection, unless otherwise agreed in writing as part of this Agreement.

    ----------------------------------------------------------

    8. USE OF PREMISES

    Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable federal, state, and local laws, ordinances, and regulations.

    ----------------------------------------------------------

    9. PETS POLICY

    {{pets_policy}}

    ----------------------------------------------------------

    10. SMOKING POLICY

    {{smoking_policy}}

    ----------------------------------------------------------

    11. MAINTENANCE AND REPAIRS

    Tenant shall keep the Premises in a clean and sanitary condition and shall promptly notify Landlord in writing of any needed repairs. Tenant is responsible for damages caused by Tenant, Tenant's guests, or invitees beyond ordinary wear and tear. Landlord shall be responsible for maintaining the Premises in habitable condition as required by Pennsylvania law.

    ----------------------------------------------------------

    12. ALTERATIONS

    Tenant shall not make any alterations, additions, or improvements to the Premises (including painting, installing fixtures, or changing locks) without prior written consent from Landlord.

    ----------------------------------------------------------

    13. ACCESS BY LANDLORD

    Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, maintenance, or to show the Premises to prospective tenants or buyers, per Pennsylvania common law (no specific statutory hours). No notice is required in cases of emergency, abandonment, or court order.

    ----------------------------------------------------------

    14. SUBLETTING AND ASSIGNMENT

    Tenant shall not sublet the Premises or assign this Agreement, in whole or in part, without prior written consent from Landlord, which shall not be unreasonably withheld.

    ----------------------------------------------------------

    15. HOLDOVER

    Holdover tenancy shall be at the court's discretion under the Pennsylvania Landlord and Tenant Act of 1951.

    ----------------------------------------------------------

    16. DEFAULT AND EVICTION

    Failure to pay rent or breach of any material term of this Agreement may result in termination and eviction in accordance with Pennsylvania law. The notice period for non-payment of rent is 10 day(s). The notice period for other lease violations is 15 day(s). All eviction procedures shall comply with 68 P.S. §250.501.

    ----------------------------------------------------------

    17. GOVERNING LAW

    This Agreement is governed by the laws of the State of Pennsylvania, including the Pennsylvania Landlord and Tenant Act of 1951, 68 P.S. §250.101 et seq.

    ----------------------------------------------------------

    18. ENTIRE AGREEMENT

    This Agreement, together with any addenda signed by both parties, constitutes the entire understanding between Landlord and Tenant. It may only be modified by a written instrument signed by both parties. If any provision of this Agreement is held to be unenforceable, the remaining provisions shall remain in full force and effect.

    ----------------------------------------------------------

    19. LEAD-BASED PAINT DISCLOSURE

    If the Premises was constructed before 1978, Landlord discloses any known lead-based paint or lead-based paint hazards in compliance with the federal Residential Lead-Based Paint Hazard Reduction Act (42 U.S.C. §4852d) and Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home".

    ----------------------------------------------------------

    20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

    By signing electronically, Tenant confirms that Tenant has read and understands all terms of this Agreement and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Pennsylvania law. Tenant certifies that Tenant is at least 18 years old and has the legal capacity to enter into this Agreement.
  
    ----------------------------------------------------------

    LANDLORD SIGNATURE:

    _______________________________
    {{landlord_name}}
    Date: _________________________
  $body$,
    true,
    'statute_derived',
    NULL, NULL, NULL,
    '{"state_code": "PA"}'::jsonb,
    NOW(), NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    name                 = EXCLUDED.name,
    state_code           = EXCLUDED.state_code,
    template_body        = EXCLUDED.template_body,
    is_active            = true,
    legal_review_status  = EXCLUDED.legal_review_status,
    variables            = EXCLUDED.variables,
    updated_at           = NOW();
  

  INSERT INTO public.lease_templates (
    id, name, state_code, template_body, is_active,
    legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
    variables, created_at, updated_at
  ) VALUES (
    'bd0bb505-e716-4458-b703-2af812a1f1ab',
    $body$Phase 03 — Michigan Standard Residential Lease$body$,
    'MI',
    $body$MICHIGAN RESIDENTIAL LEASE AGREEMENT

  {% include "common/disclaimer" %}

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

    (the "Premises"), to be used solely as a private residential dwelling in the State of Michigan.

    ----------------------------------------------------------

    2. LEASE TERM

    The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. A tenant who remains after lease expiration without Landlord written consent shall be liable for double rent per month plus all damages, per Michigan common law.

    ----------------------------------------------------------

    3. RENT

    Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month, payable to Landlord at the address specified above or by any electronic method Landlord designates in writing.

    ----------------------------------------------------------

    4. LATE FEES

    Late fees are governed by the lease and must be reasonable; Michigan does not impose a statutory cap. If a late fee applies under this lease, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day for each additional day rent remains unpaid.

    ----------------------------------------------------------

    5. SECURITY DEPOSIT

    Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession of the Premises. Maximum 1.5× monthly rent. Per Michigan Security Deposit Law (MCL 554.601 et seq.). The deposit shall be returned within 30 days of lease termination, less lawful deductions for unpaid rent, damages beyond ordinary wear and tear, and other charges allowed by MCL 554.609.

    ----------------------------------------------------------

    6. MOVE-IN COSTS

    Total move-in costs due prior to possession: {{move_in_costs}}.

    ----------------------------------------------------------

    7. UTILITIES AND SERVICES

    Tenant is responsible for all utilities including electricity, gas, water, sewer, internet, and trash collection, unless otherwise agreed in writing as part of this Agreement.

    ----------------------------------------------------------

    8. USE OF PREMISES

    Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable federal, state, and local laws, ordinances, and regulations.

    ----------------------------------------------------------

    9. PETS POLICY

    {{pets_policy}}

    ----------------------------------------------------------

    10. SMOKING POLICY

    {{smoking_policy}}

    ----------------------------------------------------------

    11. MAINTENANCE AND REPAIRS

    Tenant shall keep the Premises in a clean and sanitary condition and shall promptly notify Landlord in writing of any needed repairs. Tenant is responsible for damages caused by Tenant, Tenant's guests, or invitees beyond ordinary wear and tear. Landlord shall be responsible for maintaining the Premises in habitable condition as required by Michigan law.

    ----------------------------------------------------------

    12. ALTERATIONS

    Tenant shall not make any alterations, additions, or improvements to the Premises (including painting, installing fixtures, or changing locks) without prior written consent from Landlord.

    ----------------------------------------------------------

    13. ACCESS BY LANDLORD

    Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, maintenance, or to show the Premises to prospective tenants or buyers, per Michigan common law (24 hours customary). No notice is required in cases of emergency, abandonment, or court order.

    ----------------------------------------------------------

    14. SUBLETTING AND ASSIGNMENT

    Tenant shall not sublet the Premises or assign this Agreement, in whole or in part, without prior written consent from Landlord, which shall not be unreasonably withheld.

    ----------------------------------------------------------

    15. HOLDOVER

    A tenant who remains after lease expiration without Landlord written consent shall be liable for double rent per month plus all damages, per Michigan common law.

    ----------------------------------------------------------

    16. DEFAULT AND EVICTION

    Failure to pay rent or breach of any material term of this Agreement may result in termination and eviction in accordance with Michigan law. The notice period for non-payment of rent is 7 day(s). The notice period for other lease violations is 30 day(s). All eviction procedures shall comply with MCL 554.134 / MCL 600.5714.

    ----------------------------------------------------------

    17. GOVERNING LAW

    This Agreement is governed by the laws of the State of Michigan, including the Michigan Truth in Renting Act (MCL 554.631 et seq.) and the Michigan Security Deposit Law (MCL 554.601 et seq.).

    ----------------------------------------------------------

    18. ENTIRE AGREEMENT

    This Agreement, together with any addenda signed by both parties, constitutes the entire understanding between Landlord and Tenant. It may only be modified by a written instrument signed by both parties. If any provision of this Agreement is held to be unenforceable, the remaining provisions shall remain in full force and effect.

    ----------------------------------------------------------

    19. LEAD-BASED PAINT DISCLOSURE

    If the Premises was constructed before 1978, Landlord discloses any known lead-based paint or lead-based paint hazards in compliance with the federal Residential Lead-Based Paint Hazard Reduction Act (42 U.S.C. §4852d) and Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home".

    ----------------------------------------------------------

    20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

    By signing electronically, Tenant confirms that Tenant has read and understands all terms of this Agreement and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Michigan law. Tenant certifies that Tenant is at least 18 years old and has the legal capacity to enter into this Agreement.
  
    ----------------------------------------------------------

    LANDLORD SIGNATURE:

    _______________________________
    {{landlord_name}}
    Date: _________________________
  $body$,
    true,
    'statute_derived',
    NULL, NULL, NULL,
    '{"state_code": "MI"}'::jsonb,
    NOW(), NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    name                 = EXCLUDED.name,
    state_code           = EXCLUDED.state_code,
    template_body        = EXCLUDED.template_body,
    is_active            = true,
    legal_review_status  = EXCLUDED.legal_review_status,
    variables            = EXCLUDED.variables,
    updated_at           = NOW();
  
  COMMIT;
  