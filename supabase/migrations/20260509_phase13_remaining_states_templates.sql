-- ============================================================
-- Phase 13 — Seed statute-derived lease templates for remaining 41 jurisdictions
-- (AK AL AR AZ CO CT DC DE HI IA ID IN KS KY LA MA MD ME MN MO MS MT
--  ND NE NH NJ NM NV OK OR RI SC SD TN UT VA VT WA WI WV WY)
--
-- Each template follows the Phase 03 structure:
--   • is_active = true (one active template per state_code)
--   • legal_review_status = 'statute_derived'
--   • Deterministic UUID with prefix f130
--   • All state-specific statutory numbers are cited inline
--
-- Idempotent: deactivates any other active templates per state first,
-- then upserts by deterministic UUID via ON CONFLICT (id) DO UPDATE.
-- ============================================================

BEGIN;

-- 1. Deactivate any non-Phase-13 active templates in our 41 target states
UPDATE public.lease_templates
   SET is_active = false,
       updated_at = NOW()
 WHERE state_code IN (
   'AK','AL','AR','AZ','CO','CT','DC','DE','HI','IA','ID','IN',
   'KS','KY','LA','MA','MD','ME','MN','MO','MS','MT','ND','NE',
   'NH','NJ','NM','NV','OK','OR','RI','SC','SD','TN','UT','VA',
   'VT','WA','WI','WV','WY'
 )
   AND is_active = true
   AND id NOT IN (
   'f1300001-0000-4000-8000-000000000001','f1300002-0000-4000-8000-000000000002',
   'f1300003-0000-4000-8000-000000000003','f1300004-0000-4000-8000-000000000004',
   'f1300005-0000-4000-8000-000000000005','f1300006-0000-4000-8000-000000000006',
   'f1300007-0000-4000-8000-000000000007','f1300008-0000-4000-8000-000000000008',
   'f1300009-0000-4000-8000-000000000009','f1300010-0000-4000-8000-000000000010',
   'f1300011-0000-4000-8000-000000000011','f1300012-0000-4000-8000-000000000012',
   'f1300013-0000-4000-8000-000000000013','f1300014-0000-4000-8000-000000000014',
   'f1300015-0000-4000-8000-000000000015','f1300016-0000-4000-8000-000000000016',
   'f1300017-0000-4000-8000-000000000017','f1300018-0000-4000-8000-000000000018',
   'f1300019-0000-4000-8000-000000000019','f1300020-0000-4000-8000-000000000020',
   'f1300021-0000-4000-8000-000000000021','f1300022-0000-4000-8000-000000000022',
   'f1300023-0000-4000-8000-000000000023','f1300024-0000-4000-8000-000000000024',
   'f1300025-0000-4000-8000-000000000025','f1300026-0000-4000-8000-000000000026',
   'f1300027-0000-4000-8000-000000000027','f1300028-0000-4000-8000-000000000028',
   'f1300029-0000-4000-8000-000000000029','f1300030-0000-4000-8000-000000000030',
   'f1300031-0000-4000-8000-000000000031','f1300032-0000-4000-8000-000000000032',
   'f1300033-0000-4000-8000-000000000033','f1300034-0000-4000-8000-000000000034',
   'f1300035-0000-4000-8000-000000000035','f1300036-0000-4000-8000-000000000036',
   'f1300037-0000-4000-8000-000000000037','f1300038-0000-4000-8000-000000000038',
   'f1300039-0000-4000-8000-000000000039','f1300040-0000-4000-8000-000000000040',
   'f1300041-0000-4000-8000-000000000041'
 );

-- ═══════════════════════════════════════════════════════════════
-- 01 — ALASKA
-- AS 34.03.070 (deposit ≤ 2× monthly rent unless rent > $2 k/mo; return
--   14 days if no deductions, 30 days if deductions taken).
-- AS 34.03.310 (24-hour entry notice; emergency exempt).
-- AS 09.45.105 (7-day pay-or-quit; 10-day other breach).
-- https://www.akleg.gov/basis/statutes.asp#34
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300001-0000-4000-8000-000000000001',
  $n$Phase 13 — Alaska Standard Residential Lease$n$,
  'AK',
  $body$ALASKA RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of Alaska.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, the tenancy converts to month-to-month unless either party gives at least 30 days' written notice, per AS 34.03.290.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month, payable to Landlord at the address above or by any electronic method Landlord designates in writing.

----------------------------------------------------------

4. LATE FEES

Alaska does not impose a statutory cap on late fees; however, fees must be a reasonable estimate of actual damages. If a late fee applies under this lease, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day for each additional day rent remains unpaid. Per AS 34.03.070.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession of the Premises. The maximum deposit is two (2) times the monthly rent (waived if monthly rent exceeds $2,000), per AS 34.03.070. The deposit shall be returned within 14 days of lease termination if no deductions are taken, or within 30 days if itemized deductions are required, per AS 34.03.070(g).

Landlord shall hold the deposit in a separate account per AS 34.03.070(d) and provide an itemized written accounting for any deductions.

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities including electricity, heating fuel, water, sewer, internet, and trash collection, unless otherwise agreed in writing.

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

Tenant shall keep the Premises in a clean and sanitary condition and promptly notify Landlord in writing of any needed repairs. Landlord shall maintain the Premises in a habitable condition as required by AS 34.03.100.

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations, additions, or improvements to the Premises without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, maintenance, or showing to prospective tenants or buyers, per AS 34.03.310. No notice is required in cases of emergency or abandonment.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet the Premises or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

15. HOLDOVER

If Tenant holds over after the lease term with Landlord's acquiescence, the tenancy becomes month-to-month. Landlord may treat unauthorized holdover as trespass per AS 09.45.105.

----------------------------------------------------------

16. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Notice period for non-payment: 7 days. Notice period for other breach: 10 days. Procedures per AS 09.45.105 et seq.

----------------------------------------------------------

17. GOVERNING LAW

This Agreement is governed by the laws of the State of Alaska, including the Alaska Uniform Residential Landlord and Tenant Act (AS 34.03.010 et seq.) and AS 09.45 (summary process / eviction).

----------------------------------------------------------

18. ENTIRE AGREEMENT

This Agreement, together with any addenda signed by both parties, constitutes the entire understanding. It may only be modified by a written instrument signed by both parties. If any provision is held unenforceable, the remaining provisions remain in effect.

----------------------------------------------------------

19. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Alaska law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"AK"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 02 — ALABAMA
-- Ala. Code §35-9A-201 (deposit ≤ 1× monthly rent; return 60 days).
-- §35-9A-303 (entry 2 days notice).
-- §35-9A-421 (7-day pay-or-quit; 14-day other breach).
-- https://alisondb.legislature.state.al.us/alison/codeofalabama/1975/coatoc.htm
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300002-0000-4000-8000-000000000002',
  $n$Phase 13 — Alabama Standard Residential Lease$n$,
  'AL',
  $body$ALABAMA RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of Alabama.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy shall be at the court's discretion per Alabama Code §35-9A-161.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month, payable to Landlord at the address above or by any electronic method Landlord designates in writing.

----------------------------------------------------------

4. LATE FEES

Alabama does not impose a statutory late-fee cap; fees must represent a reasonable estimate of actual damages. If a late fee applies, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day thereafter. Per Ala. Code §35-9A-161.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Maximum deposit is one (1) month's rent, per Ala. Code §35-9A-201. The deposit shall be returned within 60 days of lease termination, less lawful deductions itemized in writing per §35-9A-201(e).

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and sanitary and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition per Ala. Code §35-9A-204.

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations to the Premises without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 48 hours' advance notice for inspection, repairs, or showing, per Ala. Code §35-9A-303. No notice is required in emergencies.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

15. HOLDOVER

Holdover tenancy is governed by court discretion per Ala. Code §35-9A-161.

----------------------------------------------------------

16. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 7 days. Other breach notice: 14 days. Procedures per Ala. Code §35-9A-421.

----------------------------------------------------------

17. GOVERNING LAW

This Agreement is governed by the laws of the State of Alabama, including the Uniform Residential Landlord and Tenant Act (Ala. Code §35-9A-101 et seq.).

----------------------------------------------------------

18. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

19. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Alabama law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"AL"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 03 — ARKANSAS
-- Ark. Code §18-16-303 et seq. (deposit cap 2×; return 60 days).
-- §18-16-101 (entry 24 h).
-- §18-60-304 (3-day nonpayment; 14-day other breach).
-- NOTE: AR does NOT codify an implied warranty of habitability.
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300003-0000-4000-8000-000000000003',
  $n$Phase 13 — Arkansas Standard Residential Lease$n$,
  'AR',
  $body$ARKANSAS RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of Arkansas.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy shall be at the court's discretion per Arkansas law.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

Arkansas has no statutory late-fee cap. If a late fee applies, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day thereafter.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Maximum deposit is two (2) months' rent, per Ark. Code §18-16-303. The deposit shall be returned within 60 days of lease termination, with a written itemization of any deductions per §18-16-305.

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord of needed repairs. Arkansas does not codify an implied warranty of habitability; Landlord's maintenance obligations are governed by express lease terms and applicable codes.

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with reasonable advance notice (24 hours customary). No notice is required in emergencies. Per Ark. Code §18-16-101.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

15. HOLDOVER

Holdover tenancy is governed by court discretion per Ark. Code §18-60-301.

----------------------------------------------------------

16. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 3 days. Other breach notice: 14 days. Procedures per Ark. Code §18-60-304 et seq.

----------------------------------------------------------

17. GOVERNING LAW

This Agreement is governed by the laws of the State of Arkansas, including Ark. Code §18-16 et seq. (Landlord–Tenant) and §18-60 (Unlawful Detainer).

----------------------------------------------------------

18. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

19. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Arkansas law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"AR"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 04 — ARIZONA
-- A.R.S. §33-1321 (deposit ≤ 1.5× monthly rent; return 14 BUSINESS days).
-- §33-1343 (entry 2 days notice).
-- §33-1368 (5-day pay-or-quit; 10-day other breach).
-- §33-1319 (bedbug disclosure — see addendum az/bedbug-disclosure).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300004-0000-4000-8000-000000000004',
  $n$Phase 13 — Arizona Standard Residential Lease$n$,
  'AZ',
  $body$ARIZONA RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of Arizona.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy shall be at the court's discretion per A.R.S. §33-1375.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

Arizona has no statutory late-fee cap; fees must be a reasonable estimate of actual damages. If a late fee applies, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day thereafter. Per A.R.S. §33-1414.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Maximum deposit is one and one-half (1.5) months' rent, per A.R.S. §33-1321(A). The deposit shall be returned within 14 BUSINESS DAYS of lease termination, with an itemized written statement of deductions per §33-1321(D).

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations, including all HOA rules if applicable.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition per A.R.S. §33-1324.

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 2 days' advance notice for inspection, repairs, or showing, per A.R.S. §33-1343. No notice is required in emergencies.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

15. HOLDOVER

Holdover tenancy is governed by A.R.S. §33-1375.

----------------------------------------------------------

16. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 5 days. Other breach notice: 10 days. Procedures per A.R.S. §33-1368 and §12-1171 et seq.

----------------------------------------------------------

17. BEDBUG DISCLOSURE

Per A.R.S. §33-1319, Landlord discloses the following regarding known bedbug infestation history at the Premises. A separate Bedbug Disclosure Addendum is attached to this Agreement.

----------------------------------------------------------

18. GOVERNING LAW

This Agreement is governed by the laws of the State of Arizona, including the Arizona Residential Landlord and Tenant Act (A.R.S. §33-1301 et seq.).

----------------------------------------------------------

19. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

20. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

21. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Arizona law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"AZ"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 05 — COLORADO
-- C.R.S. §38-12-102 et seq. (no deposit cap; return 30 days / 60 if lease says).
-- HB21-1173: late fee = greater of $50 or 5% of past-due; no fee until 7 days late.
-- §13-40-104 (10-day demand for nonpayment).
-- C.R.S. §38-12-502 (warranty of habitability — landmark).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300005-0000-4000-8000-000000000005',
  $n$Phase 13 — Colorado Standard Residential Lease$n$,
  'CO',
  $body$COLORADO RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of Colorado.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy shall be at the court's discretion per C.R.S. §38-12-202.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

Per HB21-1173 (C.R.S. §38-12-105), no late fee may be imposed until rent is 7 or more days past due. The late fee is the GREATER of $50.00 or 5% of the overdue amount. Tenant shall receive at least 7 days to cure before a late fee is charged. If a late fee applies, the amount is {{late_fee_flat}} (verified as ≥ $50 or 5% of overdue rent as required by law).

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Colorado imposes no statutory cap on the deposit amount, per C.R.S. §38-12-102. The deposit shall be returned within 30 days of lease termination (up to 60 days if the lease so provides), with an itemized written statement of deductions per §38-12-103.

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition per C.R.S. §38-12-502 (Colorado Warranty of Habitability Act). Tenant may not waive the warranty of habitability.

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, or showing, per C.R.S. §38-12-1-102. No notice is required in emergencies.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

15. HOLDOVER

Holdover tenancy is governed by C.R.S. §38-12-202.

----------------------------------------------------------

16. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 10 days. Other breach notice: 10 days. Procedures per C.R.S. §13-40-104.

----------------------------------------------------------

17. RENT INCREASE NOTICE

Landlord shall provide at least 60 days' written notice before any rent increase, per C.R.S. §38-12-701 (HB23-1095, effective 2024).

----------------------------------------------------------

18. GOVERNING LAW

This Agreement is governed by the laws of the State of Colorado, including C.R.S. §38-12 et seq. (Security Deposits, Warranty of Habitability), C.R.S. §13-40 (Forcible Entry and Detainer), and HB21-1173 (Late Fees).

----------------------------------------------------------

19. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

20. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

21. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Colorado law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"CO"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 06 — CONNECTICUT
-- C.G.S. §47a-21 (deposit ≤ 2× monthly rent; ≤ 1× if tenant age ≥ 62;
--   return 30 days; deposit interest required at Banking Commissioner rate).
-- §47a-15a (9-day grace; late fee ≤ $5/day or 5% whichever less).
-- §47a-23 (3-day notice nonpayment; 15-day other breach).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300006-0000-4000-8000-000000000006',
  $n$Phase 13 — Connecticut Standard Residential Lease$n$,
  'CT',
  $body$CONNECTICUT RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of Connecticut.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy shall be at the court's discretion per C.G.S. §47a-3c.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

Per C.G.S. §47a-15a, no late fee may be charged until rent is more than 9 days past due. The late fee shall not exceed $5.00 per day or 5% of the past-due amount, whichever is less. If a late fee applies, the amount is {{late_fee_flat}}.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Maximum deposit is two (2) months' rent (or one (1) month's rent if Tenant is 62 years of age or older), per C.G.S. §47a-21(b). The deposit shall be returned within 30 days of lease termination (or within 15 days of Tenant providing a forwarding address, whichever is later), per §47a-21(d).

DEPOSIT INTEREST: Landlord shall pay annual interest on the deposit at the rate set by the Banking Commissioner, credited at the end of each year of the tenancy, per §47a-21(i). A Deposit Interest Addendum is attached to this Agreement.

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition per C.G.S. §47a-7.

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with reasonable advance notice (at least 24 hours) for inspection, repairs, or showing, per C.G.S. §47a-16. No notice is required in emergencies.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

15. HOLDOVER

Holdover tenancy is governed by C.G.S. §47a-3c.

----------------------------------------------------------

16. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 3 days. Other breach notice: 15 days. Procedures per C.G.S. §47a-23 et seq.

----------------------------------------------------------

17. GOVERNING LAW

This Agreement is governed by the laws of the State of Connecticut, including C.G.S. §47a-1 et seq. (Landlord–Tenant, including §47a-21 Security Deposits and §47a-15a Late Fees).

----------------------------------------------------------

18. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

19. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Connecticut law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"CT"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 07 — DISTRICT OF COLUMBIA
-- D.C. Code §42-3502.02 et seq. (Rental Housing Act — just-cause required
--   for buildings with ≥5 units or any building not owner-occupied ≤4 units).
-- §42-3201 (deposit ≤ 1× monthly rent; return 45 days).
-- §42-3505.01 (30-day notice for nonpayment; Tenant has right to cure).
-- Strict lead-paint requirements: DC Department of Energy & Environment.
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300007-0000-4000-8000-000000000007',
  $n$Phase 13 — District of Columbia Standard Residential Lease$n$,
  'DC',
  $body$DISTRICT OF COLUMBIA RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the District of Columbia.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy converts to month-to-month unless either party gives 30 days' written notice, per D.C. Code §42-3202.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

DC does not impose a statutory late-fee cap; however, fees must be reasonable. If a late fee applies, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day thereafter.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Maximum deposit is one (1) month's rent, per D.C. Code §42-3502.17. The deposit shall be returned within 45 days of lease termination, with an itemized written statement of deductions per §42-3502.17.

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable federal, DC, and local laws, ordinances, and regulations.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition per D.C. Code §42-3501.01 et seq. and the DC Housing Code.

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, or showing, per D.C. Code §42-3505.81. No notice is required in emergencies.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

15. JUST-CAUSE TERMINATION

Per the Rental Housing Act (D.C. Code §42-3505.01), Landlord may only terminate this tenancy for good cause, which includes: nonpayment of rent, violation of a material lease term, damage to the unit, criminal activity on the premises, or other causes enumerated by statute. Landlord may not terminate a tenancy in retaliation or for a discriminatory reason.

----------------------------------------------------------

16. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 30 days (with right to cure). Other breach notice: 30 days. Procedures per D.C. Code §42-3505.01 et seq.

----------------------------------------------------------

17. LEAD-BASED PAINT

Per DC law and regulations (20 DCMR §§800 et seq.), Landlord discloses any known lead-based paint or lead-based paint hazards and provides the DC Department of Energy & Environment (DOEE) disclosure form. Properties built before 1978: a separate federally required disclosure addendum is attached.

----------------------------------------------------------

18. GOVERNING LAW

This Agreement is governed by the laws of the District of Columbia, including the Rental Housing Act of 1985 (D.C. Law 6-10, D.C. Code §42-3501.01 et seq.) and D.C. Code §42-3201 et seq. (Deposits).

----------------------------------------------------------

19. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

20. LEAD-BASED PAINT DISCLOSURE (FEDERAL)

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

21. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable DC law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"DC"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 08 — DELAWARE
-- 25 Del. C. §5514 (deposit ≤ 1× monthly rent for term ≥ 1 yr; no cap m-to-m;
--   return 20 days; separate account required).
-- §5501 (late fee max 5% after 5-day grace).
-- §5501 (entry 48 h notice).
-- §5501 (5-day nonpayment; 7-day other breach).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300008-0000-4000-8000-000000000008',
  $n$Phase 13 — Delaware Standard Residential Lease$n$,
  'DE',
  $body$DELAWARE RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of Delaware.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy shall be at the court's discretion per 25 Del. C. §5107.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

Per 25 Del. C. §5501, no late fee may be charged until rent is more than 5 days past due. The late fee shall not exceed 5% of the monthly rent. If a late fee applies, the amount is {{late_fee_flat}}.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Maximum deposit for leases of one year or longer is one (1) month's rent, per 25 Del. C. §5514(a). The deposit shall be held in a separate account per §5514(c). The deposit shall be returned within 20 days of lease termination, with an itemized written statement of deductions per §5514(e).

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition per 25 Del. C. §5303.

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 48 hours' advance notice for inspection, repairs, or showing, per 25 Del. C. §5509. No notice is required in emergencies.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

15. HOLDOVER

Holdover tenancy is governed by 25 Del. C. §5107.

----------------------------------------------------------

16. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 5 days. Other breach notice: 7 days. Procedures per 25 Del. C. §5701 et seq.

----------------------------------------------------------

17. GOVERNING LAW

This Agreement is governed by the laws of the State of Delaware, including 25 Del. C. §§5101–5907 (Residential Landlord–Tenant Code).

----------------------------------------------------------

18. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

19. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Delaware law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"DE"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 09 — HAWAII
-- HRS §521-44 (deposit ≤ 1× monthly rent; return 14 days).
-- §521-53 (entry 48 h notice; emergency exempt).
-- §521-71 (5-day pay-or-quit; 10-day other breach).
-- §521-21 (rent increase notice 45 days m-to-m).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300009-0000-4000-8000-000000000009',
  $n$Phase 13 — Hawaii Standard Residential Lease$n$,
  'HI',
  $body$HAWAII RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of Hawaii.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy shall be at the court's discretion per HRS §521-71(c).

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

Hawaii has no statutory late-fee cap; fees must be a reasonable estimate of actual damages. If a late fee applies, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day thereafter.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Maximum deposit is one (1) month's rent, per HRS §521-44(b). The deposit shall be returned within 14 days of lease termination, with an itemized written statement of deductions per §521-44(c).

NOTE: Pet deposits are subject to special rules under HRS §521-44(g). A separate pet deposit addendum applies if pets are permitted.

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition per HRS §521-42.

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 48 hours' advance notice for inspection, repairs, or showing, per HRS §521-53. No notice is required in emergencies.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

15. HOLDOVER

Holdover tenancy is governed by HRS §521-71(c).

----------------------------------------------------------

16. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 5 days. Other breach notice: 10 days. Procedures per HRS §521-71 and §666-1 et seq.

----------------------------------------------------------

17. GOVERNING LAW

This Agreement is governed by the laws of the State of Hawaii, including HRS Chapter 521 (Residential Landlord–Tenant Code) and HRS Chapter 666 (Summary Possession).

----------------------------------------------------------

18. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

19. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Hawaii law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"HI"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 10 — IOWA
-- Iowa Code §562A.12 (deposit ≤ 2× monthly rent; return 30 days).
-- §562A.19 (entry 24 h notice).
-- §562A.27 (3-day pay-or-quit; 7-day other breach).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300010-0000-4000-8000-000000000010',
  $n$Phase 13 — Iowa Standard Residential Lease$n$,
  'IA',
  $body$IOWA RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of Iowa.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy converts to month-to-month per Iowa Code §562A.9.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

Iowa has no statutory late-fee cap; fees must be a reasonable estimate of actual damages. If a late fee applies, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day thereafter.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Maximum deposit is two (2) months' rent, per Iowa Code §562A.12(1). The deposit shall be returned within 30 days of lease termination, with an itemized written statement of deductions per §562A.12(3).

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition per Iowa Code §562A.15.

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, or showing, per Iowa Code §562A.19. No notice is required in emergencies.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

15. HOLDOVER

Holdover tenancy converts to month-to-month per Iowa Code §562A.9.

----------------------------------------------------------

16. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 3 days. Other breach notice: 7 days. Procedures per Iowa Code §562A.27 and §648 (Forcible Entry and Detainer).

----------------------------------------------------------

17. GOVERNING LAW

This Agreement is governed by the laws of the State of Iowa, including Iowa Code Chapter 562A (Uniform Residential Landlord and Tenant Law) and Chapter 648 (Forcible Entry and Detainer).

----------------------------------------------------------

18. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

19. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Iowa law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"IA"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 11 — IDAHO
-- Idaho Code §6-321 (no deposit cap; return 21 days standard, 30 if lease).
-- §6-205 (entry reasonable notice / 24 h customary).
-- §6-303 (3-day nonpayment; no other-breach statutory period).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300011-0000-4000-8000-000000000011',
  $n$Phase 13 — Idaho Standard Residential Lease$n$,
  'ID',
  $body$IDAHO RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of Idaho.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy shall be at the court's discretion per Idaho Code §6-301 et seq.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

Idaho has no statutory late-fee cap; fees must be a reasonable estimate of actual damages. If a late fee applies, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day thereafter.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Idaho imposes no statutory cap on the deposit amount. The deposit shall be returned within 21 days of lease termination (30 days if the lease so provides), with an itemized written statement of deductions per Idaho Code §6-321.

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition as required by applicable housing codes.

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with reasonable advance notice (at least 24 hours) for inspection, repairs, or showing. No notice is required in emergencies.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

15. HOLDOVER

Holdover tenancy is governed by Idaho Code §6-301 et seq.

----------------------------------------------------------

16. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 3 days. Procedures per Idaho Code §6-303 (Unlawful Detainer).

----------------------------------------------------------

17. GOVERNING LAW

This Agreement is governed by the laws of the State of Idaho, including Idaho Code §6-301 et seq. (Unlawful Detainer) and §6-321 (Security Deposits).

----------------------------------------------------------

18. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

19. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Idaho law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"ID"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 12 — INDIANA
-- Ind. Code §32-31-3-9 (no deposit cap; return 45 days).
-- §32-31-5-6 (entry 24 h notice; emergency exempt).
-- §32-31-1-8 (10-day pay-or-quit; no specific other-breach period).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300012-0000-4000-8000-000000000012',
  $n$Phase 13 — Indiana Standard Residential Lease$n$,
  'IN',
  $body$INDIANA RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of Indiana.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy shall be at the court's discretion per Ind. Code §32-31-1-8.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

Indiana has no statutory late-fee cap; fees must be a reasonable estimate of actual damages. If a late fee applies, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day thereafter.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Indiana imposes no statutory cap on the deposit amount. The deposit shall be returned within 45 days of lease termination, with an itemized written statement of deductions per Ind. Code §32-31-3-12.

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition as required by applicable housing codes and Ind. Code §32-31-8-5.

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, or showing, per Ind. Code §32-31-5-6. No notice is required in emergencies.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

15. HOLDOVER

Holdover tenancy is governed by Ind. Code §32-31-1-8.

----------------------------------------------------------

16. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 10 days. Procedures per Ind. Code §32-30-3 (Ejectment) and §33-29-2 (Small Claims).

----------------------------------------------------------

17. GOVERNING LAW

This Agreement is governed by the laws of the State of Indiana, including Ind. Code §32-31 (Landlord–Tenant) and §32-31-3 (Security Deposits).

----------------------------------------------------------

18. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

19. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Indiana law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"IN"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 13 — KANSAS
-- K.S.A. §58-2550 (deposit: unfurnished ≤ 1× monthly rent; furnished ≤ 1.5×;
--   with pets: additional 0.5×; return 30 days).
-- §58-2557 (entry 24 h notice).
-- §58-2564 (3-day pay-or-quit; 30-day other breach).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300013-0000-4000-8000-000000000013',
  $n$Phase 13 — Kansas Standard Residential Lease$n$,
  'KS',
  $body$KANSAS RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of Kansas.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy shall be at the court's discretion per K.S.A. §58-2501.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

Kansas has no statutory late-fee cap; fees must be a reasonable estimate of actual damages. If a late fee applies, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day thereafter.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Per K.S.A. §58-2550: deposit maximum is one (1) month's rent for unfurnished units, one and one-half (1.5) months' rent for furnished units. An additional half-month's rent may be charged as a pet deposit. The deposit shall be returned within 30 days of lease termination, with an itemized written statement of deductions per §58-2550(b).

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition per K.S.A. §58-2553.

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, or showing, per K.S.A. §58-2557. No notice is required in emergencies.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

15. HOLDOVER

Holdover tenancy is governed by K.S.A. §58-2501.

----------------------------------------------------------

16. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 3 days. Other breach notice: 30 days. Procedures per K.S.A. §58-2564 and §61-3801 et seq.

----------------------------------------------------------

17. GOVERNING LAW

This Agreement is governed by the laws of the State of Kansas, including K.S.A. §58-2540 et seq. (Residential Landlord and Tenant Act) and K.S.A. §58-2550 (Security Deposits).

----------------------------------------------------------

18. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

19. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Kansas law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"KS"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 14 — KENTUCKY
-- KRS §383.580 (no deposit cap; return 30 days; move-in checklist mandatory).
-- §383.615 (entry 24 h notice; emergency exempt).
-- §383.660 (7-day pay-or-quit; 14-day other breach).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300014-0000-4000-8000-000000000014',
  $n$Phase 13 — Kentucky Standard Residential Lease$n$,
  'KY',
  $body$KENTUCKY RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the Commonwealth of Kentucky.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy shall be at the court's discretion per KRS §383.695.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

Kentucky has no statutory late-fee cap; fees must be a reasonable estimate of actual damages. If a late fee applies, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day thereafter.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Kentucky imposes no statutory cap on the deposit amount. The deposit shall be returned within 30 days of lease termination, with an itemized written statement of deductions per KRS §383.580.

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition per KRS §383.595.

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, or showing, per KRS §383.615. No notice is required in emergencies.

----------------------------------------------------------

14. MOVE-IN INSPECTION CHECKLIST

Per KRS §383.580, Landlord shall provide Tenant with a written move-in checklist describing the condition of the Premises at commencement. Both parties shall sign the checklist, which shall be used as the baseline for assessing damage deductions at move-out. A Move-In Condition Report is attached to this Agreement.

----------------------------------------------------------

15. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

16. HOLDOVER

Holdover tenancy is governed by KRS §383.695.

----------------------------------------------------------

17. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 7 days. Other breach notice: 14 days. Procedures per KRS §383.660 and §383.665.

----------------------------------------------------------

18. GOVERNING LAW

This Agreement is governed by the laws of the Commonwealth of Kentucky, including KRS §383.505 et seq. (Uniform Residential Landlord and Tenant Act) and KRS §383.580 (Security Deposits and Condition Report).

----------------------------------------------------------

19. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

20. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

21. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Kentucky law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"KY"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 15 — LOUISIANA
-- La. R.S. §9:3251 (deposit: no statutory cap; return 1 month after termination).
-- La. Civ. Code Art. 2668–2729 (lease governed by Civil Code, not common-law).
-- §9:3261 (entry — no specific notice statute; 24 h customary by contract).
-- §9:3251 (5-day pay-or-quit; eviction via Rule to Show Cause).
-- NOTE: Leases > 1 year must be in writing and notarized per La. Civ. Code Art. 2681.
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300015-0000-4000-8000-000000000015',
  $n$Phase 13 — Louisiana Standard Residential Lease$n$,
  'LA',
  $body$LOUISIANA RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of Louisiana.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy governed by the Louisiana Civil Code. Upon expiration, unless either party provides written notice, the tenancy converts to month-to-month per La. Civ. Code Art. 2727.

NOTE: Under Louisiana Civil Code Art. 2681, a lease for a term exceeding one year must be in writing and notarized to be enforceable against third parties. Electronic signing fulfills the written-lease requirement; notarization may be separately required for lease terms exceeding one year.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

Louisiana has no statutory late-fee cap. If a late fee applies, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day thereafter.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Louisiana imposes no statutory cap on the deposit amount. The deposit shall be returned within 30 days of lease termination, with an itemized written statement of deductions, per La. R.S. §9:3251 et seq.

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises as required by La. Civ. Code Art. 2693–2695 (warranty against vices and defects).

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord, per La. Civ. Code Art. 2724.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, or showing. No notice is required in emergencies.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord, per La. Civ. Code Art. 2713.

----------------------------------------------------------

15. HOLDOVER

Holdover tenancy converts to month-to-month per La. Civ. Code Art. 2727. Landlord may seek eviction via Rule to Show Cause per La. C.C.P. Art. 4731.

----------------------------------------------------------

16. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 5 days. Eviction proceedings per La. C.C.P. Art. 4701 et seq. (Eviction of Tenants).

----------------------------------------------------------

17. GOVERNING LAW

This Agreement is governed by the laws of the State of Louisiana, including Louisiana Civil Code Art. 2668–2729 (Lease) and La. R.S. §9:3251 et seq. (Security Deposits).

----------------------------------------------------------

18. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

19. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Louisiana law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"LA"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 16 — MASSACHUSETTS
-- G.L. c. 186 §15B (security deposit: no cap; return 30 days + interest;
--   separate statement of condition within 10 days; last-month deposit separate).
-- c. 186 §§1–28 (landlord–tenant framework).
-- c. 239 §2A (14-day notice nonpayment; 30-day other breach).
-- G.L. c. 186 §§13–14A (entry — no statutory notice hours; 24 h customary).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300016-0000-4000-8000-000000000016',
  $n$Phase 13 — Massachusetts Standard Residential Lease$n$,
  'MA',
  $body$MASSACHUSETTS RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the Commonwealth of Massachusetts.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy shall be at the court's discretion per G.L. c. 186 §13.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

Massachusetts does not impose a statutory cap on late fees, but courts may find excessive fees unconscionable. If a late fee applies, the amount is {{late_fee_flat}}, assessed after a reasonable grace period.

----------------------------------------------------------

5. SECURITY DEPOSIT AND LAST MONTH'S RENT

SECURITY DEPOSIT: Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Massachusetts imposes no statutory cap on the deposit amount, per G.L. c. 186 §15B. The deposit shall be held in a separate interest-bearing account (bank name and account number to be disclosed in writing to Tenant within 30 days) and returned within 30 days of lease termination, with itemized deductions and accrued interest.

LAST MONTH'S RENT: If collected, last month's rent of {{last_month_rent_amount}} is also due prior to possession. Last month's rent must be held in a separate account and interest paid thereon at the savings bank rate, per G.L. c. 186 §15B(2)(a).

----------------------------------------------------------

6. STATEMENT OF CONDITION

Per G.L. c. 186 §15B(2)(c), within 10 days of the commencement of this tenancy, Landlord shall provide Tenant with a written statement of condition describing the present condition of the Premises. Tenant may note disagreements within 15 days of receipt. The condition statement is attached to this Agreement.

----------------------------------------------------------

7. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

8. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

9. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

10. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

11. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

12. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition in compliance with the State Sanitary Code (105 CMR 410) and G.L. c. 111 §§127A–127L.

----------------------------------------------------------

13. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

14. ACCESS BY LANDLORD

Landlord may enter the Premises with reasonable advance notice (at least 24 hours) for inspection, repairs, or showing. No notice is required in emergencies per G.L. c. 186 §§13–14A.

----------------------------------------------------------

15. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

16. HOLDOVER

Holdover tenancy is governed by G.L. c. 186 §13.

----------------------------------------------------------

17. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 14 days. Other breach notice: 30 days. Procedures per G.L. c. 239 §2A (Summary Process for Possession).

----------------------------------------------------------

18. GOVERNING LAW

This Agreement is governed by the laws of the Commonwealth of Massachusetts, including G.L. c. 186 (Estates for Years and at Will), G.L. c. 239 (Summary Process), and the State Sanitary Code (105 CMR 410).

----------------------------------------------------------

19. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

20. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d and Massachusetts Lead Law (G.L. c. 111 §197A). Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home" and the MA Lead Law Notification.

----------------------------------------------------------

21. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Massachusetts law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"MA"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 17 — MARYLAND
-- Md. Code, Real Property §8-203 (deposit ≤ 2× monthly rent; return 45 days;
--   interest required at passbook savings rate; written receipt mandatory).
-- §8-211 (entry 24 h notice).
-- §8-401 (5-day pay-or-quit; 30-day other breach).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300017-0000-4000-8000-000000000017',
  $n$Phase 13 — Maryland Standard Residential Lease$n$,
  'MD',
  $body$MARYLAND RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of Maryland.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy shall be at the court's discretion per Md. Code, Real Property §8-402.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

Maryland has no statutory late-fee cap for residential leases; fees must be a reasonable estimate of actual damages. If a late fee applies, the amount is {{late_fee_flat}}.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Maximum deposit is two (2) months' rent, per Md. Code, Real Property §8-203(b). Landlord shall provide a written receipt for the deposit within 30 days, including the name and address of the financial institution and account number where the deposit is held, per §8-203(d). The deposit shall be returned within 45 days of lease termination, with itemized deductions and accrued interest at the passbook savings rate, per §8-203(e).

A separate Deposit Interest Addendum is attached to this Agreement.

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition per Md. Code, Real Property §8-211.

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, or showing, per Md. Code, Real Property §8-211. No notice is required in emergencies.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

15. HOLDOVER

Holdover tenancy is governed by Md. Code, Real Property §8-402.

----------------------------------------------------------

16. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 5 days. Other breach notice: 30 days. Procedures per Md. Code, Real Property §8-401 and District Court rules.

----------------------------------------------------------

17. GOVERNING LAW

This Agreement is governed by the laws of the State of Maryland, including Md. Code, Real Property §§8-101 et seq. (Landlord–Tenant) and §8-203 (Security Deposits).

----------------------------------------------------------

18. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

19. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d and Md. Code, Environment §§6-801 et seq. (Lead Poisoning Prevention). Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home" and the Maryland "Notice of Tenant Rights" under the Maryland Lead Law.

----------------------------------------------------------

20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Maryland law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"MD"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 18 — MAINE
-- 14 M.R.S. §6031 (deposit ≤ 2× monthly rent; return 21 days after
--   written termination notice, 30 days if tenancy at will).
-- §6025 (entry 24 h notice; emergency exempt).
-- §6002 (7-day pay-or-quit; 30-day other breach).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300018-0000-4000-8000-000000000018',
  $n$Phase 13 — Maine Standard Residential Lease$n$,
  'ME',
  $body$MAINE RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of Maine.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy shall be at the court's discretion per 14 M.R.S. §6001.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

Maine has no statutory late-fee cap; fees must be a reasonable estimate of actual damages. If a late fee applies, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day thereafter.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Maximum deposit is two (2) months' rent, per 14 M.R.S. §6031(1). The deposit shall be returned within 21 days of written notice of termination (30 days for a tenancy at will), with an itemized written statement of deductions per §6033.

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition per 14 M.R.S. §6021 (warranty of habitability) and applicable housing codes.

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, or showing, per 14 M.R.S. §6025. No notice is required in emergencies.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

15. HOLDOVER

Holdover tenancy is governed by 14 M.R.S. §6001.

----------------------------------------------------------

16. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 7 days. Other breach notice: 30 days. Procedures per 14 M.R.S. §6002 and §6001.

----------------------------------------------------------

17. GOVERNING LAW

This Agreement is governed by the laws of the State of Maine, including 14 M.R.S. Chapter 710 (Landlord and Tenant) and §6031 et seq. (Security Deposits).

----------------------------------------------------------

18. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

19. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d and 14 M.R.S. §6021-A (Maine Bedbug and Lead-Paint Disclosure). Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Maine law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"ME"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 19 — MINNESOTA
-- Minn. Stat. §504B.178 (no deposit cap; return 21 days with interest;
--   deposit interest at rate of bank passbook savings accounts).
-- §504B.177 (late fee cap: 8% of monthly rent per month; no fee before 5 days).
-- §504B.211 (entry 24 h notice; emergency exempt).
-- §504B.285 (14-day pay-or-quit; 14-day other breach).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300019-0000-4000-8000-000000000019',
  $n$Phase 13 — Minnesota Standard Residential Lease$n$,
  'MN',
  $body$MINNESOTA RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of Minnesota.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy shall be at the court's discretion per Minn. Stat. §504B.285.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

Per Minn. Stat. §504B.177, no late fee may be charged until rent is more than 5 days past due. The late fee shall not exceed 8% of the overdue rent per month. If a late fee applies, the amount is {{late_fee_flat}} (verified as ≤ 8% of monthly rent of {{monthly_rent}}).

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Minnesota imposes no statutory cap on the deposit amount. The deposit shall be returned, with accrued interest, within 21 days of lease termination (or within 5 days of Tenant's vacation of the premises if Landlord has actual notice of fire or casualty), with an itemized written statement of deductions, per Minn. Stat. §504B.178.

A Minnesota Deposit Interest Disclosure is attached to this Agreement.

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition per Minn. Stat. §504B.161 (covenant of habitability).

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, or showing, per Minn. Stat. §504B.211. No notice is required in emergencies.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

15. HOLDOVER

Holdover tenancy is governed by Minn. Stat. §504B.285.

----------------------------------------------------------

16. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 14 days. Other breach notice: 14 days. Eviction (Unlawful Detainer) proceedings per Minn. Stat. §504B.285 et seq.

----------------------------------------------------------

17. GOVERNING LAW

This Agreement is governed by the laws of the State of Minnesota, including Minn. Stat. Chapter 504B (Landlord and Tenant) and §504B.177 (Late Fees) and §504B.178 (Security Deposits and Interest).

----------------------------------------------------------

18. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

19. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Minnesota law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"MN"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 20 — MISSOURI
-- Mo. Rev. Stat. §535.300 (deposit ≤ 2× monthly rent; return 30 days;
--   itemized written statement required).
-- §441.233 (entry 24 h notice; emergency exempt).
-- §535.010 (5-day pay-or-quit; no specific other-breach period).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300020-0000-4000-8000-000000000020',
  $n$Phase 13 — Missouri Standard Residential Lease$n$,
  'MO',
  $body$MISSOURI RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of Missouri.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy shall be at the court's discretion per Mo. Rev. Stat. §441.060.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

Missouri has no statutory late-fee cap; fees must be a reasonable estimate of actual damages. If a late fee applies, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day thereafter.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Maximum deposit is two (2) months' rent, per Mo. Rev. Stat. §535.300(1). The deposit shall be returned within 30 days of lease termination, with an itemized written statement of deductions per §535.300(2).

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition as required by applicable housing codes.

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, or showing, per Mo. Rev. Stat. §441.233. No notice is required in emergencies.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

15. HOLDOVER

Holdover tenancy is governed by Mo. Rev. Stat. §441.060.

----------------------------------------------------------

16. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 5 days. Procedures per Mo. Rev. Stat. §535.010 et seq. (Unlawful Detainer).

----------------------------------------------------------

17. GOVERNING LAW

This Agreement is governed by the laws of the State of Missouri, including Mo. Rev. Stat. §§441 and §535 (Landlord–Tenant and Unlawful Detainer) and §535.300 (Security Deposits).

----------------------------------------------------------

18. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

19. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Missouri law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"MO"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 21 — MISSISSIPPI
-- Miss. Code §89-8-21 (no deposit cap; return 45 days).
-- §89-8-13 (entry reasonable notice / 24 h customary).
-- §89-7-27 (3-day pay-or-quit; no specific other-breach period).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300021-0000-4000-8000-000000000021',
  $n$Phase 13 — Mississippi Standard Residential Lease$n$,
  'MS',
  $body$MISSISSIPPI RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of Mississippi.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy shall be at the court's discretion per Miss. Code §89-7-1.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

Mississippi has no statutory late-fee cap; fees must be a reasonable estimate of actual damages. If a late fee applies, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day thereafter.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Mississippi imposes no statutory cap on the deposit amount. The deposit shall be returned within 45 days of lease termination, with an itemized written statement of deductions, per Miss. Code §89-8-21.

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition per Miss. Code §89-8-23.

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with reasonable advance notice (at least 24 hours) for inspection, repairs, or showing. No notice is required in emergencies.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

15. HOLDOVER

Holdover tenancy is governed by Miss. Code §89-7-1.

----------------------------------------------------------

16. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 3 days. Procedures per Miss. Code §89-7-27 (Unlawful Entry and Detainer).

----------------------------------------------------------

17. GOVERNING LAW

This Agreement is governed by the laws of the State of Mississippi, including Miss. Code §89-8-1 et seq. (Residential Landlord and Tenant Act) and §89-7-1 (Unlawful Entry and Detainer).

----------------------------------------------------------

18. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

19. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Mississippi law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"MS"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 22 — MONTANA
-- Mont. Code §70-25-201 (no deposit cap; return 10 days if no deductions,
--   30 days if itemized deductions claimed).
-- §70-24-312 (entry 24 h notice; emergency exempt).
-- §70-24-422 (3-day pay-or-quit; 14-day other breach).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300022-0000-4000-8000-000000000022',
  $n$Phase 13 — Montana Standard Residential Lease$n$,
  'MT',
  $body$MONTANA RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of Montana.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy shall be at the court's discretion per Mont. Code §70-24-441.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

Montana has no statutory late-fee cap; fees must be a reasonable estimate of actual damages. If a late fee applies, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day thereafter.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Montana imposes no statutory cap on the deposit amount. The deposit shall be returned within 10 days if no deductions are taken, or within 30 days with an itemized written statement if deductions are claimed, per Mont. Code §70-25-202.

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition per Mont. Code §70-24-303.

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, or showing, per Mont. Code §70-24-312. No notice is required in emergencies.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

15. HOLDOVER

Holdover tenancy is governed by Mont. Code §70-24-441.

----------------------------------------------------------

16. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 3 days. Other breach notice: 14 days. Procedures per Mont. Code §70-24-422 and §70-27 (Unlawful Detainer).

----------------------------------------------------------

17. GOVERNING LAW

This Agreement is governed by the laws of the State of Montana, including Mont. Code §70-24 (Residential Landlord and Tenant Act) and §70-25 (Security Deposits).

----------------------------------------------------------

18. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

19. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Montana law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"MT"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 23 — NORTH DAKOTA
-- N.D.C.C. §47-16-07.1 (deposit ≤ 1× monthly rent; ≤ 2× with pets;
--   return 30 days).
-- §47-16-07.3 (entry 24 h notice; emergency exempt).
-- §47-32-01 (3-day pay-or-quit; no specific other-breach period).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300023-0000-4000-8000-000000000023',
  $n$Phase 13 — North Dakota Standard Residential Lease$n$,
  'ND',
  $body$NORTH DAKOTA RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of North Dakota.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy shall be at the court's discretion per N.D.C.C. §47-16-15.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

North Dakota has no statutory late-fee cap; fees must be a reasonable estimate of actual damages. If a late fee applies, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day thereafter.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Maximum deposit is one (1) month's rent (two (2) months' rent if pets are permitted), per N.D.C.C. §47-16-07.1. The deposit shall be returned within 30 days of lease termination, with an itemized written statement of deductions per §47-16-07.2.

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition as required by applicable codes.

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, or showing, per N.D.C.C. §47-16-07.3. No notice is required in emergencies.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

15. HOLDOVER

Holdover tenancy is governed by N.D.C.C. §47-16-15.

----------------------------------------------------------

16. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 3 days. Procedures per N.D.C.C. §47-32 (Forcible Entry and Detainer).

----------------------------------------------------------

17. GOVERNING LAW

This Agreement is governed by the laws of the State of North Dakota, including N.D.C.C. §47-16 (Lease of Real Property) and §47-32 (Forcible Entry and Detainer).

----------------------------------------------------------

18. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

19. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable North Dakota law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"ND"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 24 — NEBRASKA
-- Neb. Rev. Stat. §76-1416 (deposit ≤ 1× monthly rent; return 14 days).
-- §76-1423 (entry 24 h notice; emergency exempt).
-- §76-1431 (7-day pay-or-quit; 30-day other breach).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300024-0000-4000-8000-000000000024',
  $n$Phase 13 — Nebraska Standard Residential Lease$n$,
  'NE',
  $body$NEBRASKA RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of Nebraska.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy shall be at the court's discretion per Neb. Rev. Stat. §76-1437.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

Nebraska has no statutory late-fee cap; fees must be a reasonable estimate of actual damages. If a late fee applies, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day thereafter.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Maximum deposit is one (1) month's rent, per Neb. Rev. Stat. §76-1416(1). The deposit shall be returned within 14 days of lease termination, with an itemized written statement of deductions per §76-1416(2).

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition per Neb. Rev. Stat. §76-1419.

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, or showing, per Neb. Rev. Stat. §76-1423. No notice is required in emergencies.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

15. HOLDOVER

Holdover tenancy is governed by Neb. Rev. Stat. §76-1437.

----------------------------------------------------------

16. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 7 days. Other breach notice: 30 days. Procedures per Neb. Rev. Stat. §76-1431 and §24-517 (County Court).

----------------------------------------------------------

17. GOVERNING LAW

This Agreement is governed by the laws of the State of Nebraska, including Neb. Rev. Stat. §76-1401 et seq. (Residential Landlord and Tenant Act) and §76-1416 (Security Deposits).

----------------------------------------------------------

18. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

19. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Nebraska law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"NE"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 25 — NEW HAMPSHIRE
-- RSA 540-A:6 (deposit: no cap generally; ≤ 1× monthly rent if landlord
--   owns > 6 units; return 30 days; separate account required).
-- RSA 540-A:3 (entry 24 h notice; emergency exempt).
-- RSA 540:2 (7-day pay-or-quit; 30-day other breach).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300025-0000-4000-8000-000000000025',
  $n$Phase 13 — New Hampshire Standard Residential Lease$n$,
  'NH',
  $body$NEW HAMPSHIRE RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of New Hampshire.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy shall be at the court's discretion per RSA 540:1-a.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

New Hampshire has no statutory late-fee cap; fees must be a reasonable estimate of actual damages. If a late fee applies, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day thereafter.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. For landlords owning more than 6 rental units, the deposit is limited to one (1) month's rent, per RSA 540-A:6(I). The deposit shall be held in a separate account and returned within 30 days of lease termination, with an itemized written statement of deductions per RSA 540-A:7.

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition per RSA 540:13-d.

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, or showing, per RSA 540-A:3. No notice is required in emergencies.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

15. HOLDOVER

Holdover tenancy is governed by RSA 540:1-a.

----------------------------------------------------------

16. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 7 days. Other breach notice: 30 days. Procedures per RSA 540:2 and RSA 540:13.

----------------------------------------------------------

17. GOVERNING LAW

This Agreement is governed by the laws of the State of New Hampshire, including RSA Chapter 540 (Actions Against Tenants) and RSA 540-A (Prohibited Practices and Security Deposits).

----------------------------------------------------------

18. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

19. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable New Hampshire law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"NH"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 26 — NEW JERSEY
-- N.J.S.A. §46:8-19 (deposit ≤ 1.5× monthly rent; return 30 days;
--   interest required at bank's longest-term CD rate or money-market rate).
-- §46:8-21.2 (entry reasonable notice / 24 h customary).
-- §2A:18-61.2 (just-cause required for all tenancies with > 2 units OR
--   owner-occupied ≤ 2 units if occupied > 2 years).
-- Truth-in-Renting: Landlord must provide the NJ DCA pamphlet to all tenants.
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300026-0000-4000-8000-000000000026',
  $n$Phase 13 — New Jersey Standard Residential Lease$n$,
  'NJ',
  $body$NEW JERSEY RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of New Jersey.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy converts to month-to-month unless either party provides proper notice, per N.J.S.A. §2A:18-56.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

New Jersey has no specific statutory late-fee cap; fees must be a reasonable estimate of actual damages. If a late fee applies, the amount is {{late_fee_flat}}, assessed after a reasonable grace period. Per N.J.S.A. §2A:42-6.1.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Maximum deposit is one and one-half (1.5) months' rent, per N.J.S.A. §46:8-21.2. The deposit shall accrue annual interest at the money-market or longest-term CD rate (Tenant may elect to receive interest annually or credit it against rent in the final period) per §46:8-19(d). The deposit shall be returned within 30 days of lease termination (5 days if termination due to fire, flood, or condemnation), with an itemized written statement of deductions.

A New Jersey Deposit Interest Addendum is attached to this Agreement.

----------------------------------------------------------

6. TRUTH-IN-RENTING STATEMENT

Per N.J.S.A. §46:8-45 and N.J.A.C. 5:10-1.1 et seq., Landlord is required to provide Tenant with the "Truth in Renting" statement published by the New Jersey Department of Community Affairs. Tenant acknowledges receipt of this statement, which is attached as an addendum.

----------------------------------------------------------

7. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

8. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

9. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

10. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

11. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

12. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition per N.J.S.A. §2A:42-85 et seq. (warranty of habitability).

----------------------------------------------------------

13. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

14. ACCESS BY LANDLORD

Landlord may enter the Premises with reasonable advance notice (at least 24 hours) for inspection, repairs, or showing. No notice is required in emergencies, per N.J.S.A. §2A:42-10.10.

----------------------------------------------------------

15. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

16. JUST-CAUSE EVICTION

Per N.J.S.A. §2A:18-61.1 (Anti-Eviction Act), Landlord may only terminate this tenancy for specified good causes, including: nonpayment of rent, habitual late payment, lease violations, disorderly conduct, property damage, or other causes enumerated by statute.

----------------------------------------------------------

17. HOLDOVER

Holdover tenancy converts to month-to-month per N.J.S.A. §2A:18-56.

----------------------------------------------------------

18. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 3 days. Procedures per N.J.S.A. §2A:18-53 et seq. (Summary Dispossess Proceedings).

----------------------------------------------------------

19. GOVERNING LAW

This Agreement is governed by the laws of the State of New Jersey, including N.J.S.A. §46:8-1 et seq. (Landlord–Tenant), §2A:18-53 et seq. (Dispossess), and §2A:18-61.1 (Anti-Eviction Act).

----------------------------------------------------------

20. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

21. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

22. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable New Jersey law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"NJ"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 27 — NEW MEXICO
-- N.M.S.A. §47-8-18 (deposit: ≤ 1× monthly rent for leases < 1 year;
--   ≤ 2× with pets; return 30 days).
-- §47-8-24 (entry 24 h notice; emergency exempt).
-- §47-8-33 (3-day pay-or-quit; 7-day other breach).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300027-0000-4000-8000-000000000027',
  $n$Phase 13 — New Mexico Standard Residential Lease$n$,
  'NM',
  $body$NEW MEXICO RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of New Mexico.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy shall be at the court's discretion per N.M.S.A. §47-8-37.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

New Mexico has no statutory late-fee cap; fees must be a reasonable estimate of actual damages. If a late fee applies, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day thereafter.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. For leases less than one year, maximum deposit is one (1) month's rent; with pets, an additional one (1) month's rent may be charged as a pet deposit, per N.M.S.A. §47-8-18(B). The deposit shall be returned within 30 days of lease termination, with an itemized written statement of deductions per §47-8-18(D).

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition per N.M.S.A. §47-8-20.

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, or showing, per N.M.S.A. §47-8-24. No notice is required in emergencies.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

15. HOLDOVER

Holdover tenancy is governed by N.M.S.A. §47-8-37.

----------------------------------------------------------

16. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 3 days. Other breach notice: 7 days. Procedures per N.M.S.A. §47-8-33 and §35-10-1 et seq.

----------------------------------------------------------

17. GOVERNING LAW

This Agreement is governed by the laws of the State of New Mexico, including N.M.S.A. §47-8-1 et seq. (Uniform Owner-Resident Relations Act) and §47-8-18 (Security Deposits).

----------------------------------------------------------

18. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

19. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable New Mexico law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"NM"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 28 — NEVADA
-- NRS §118A.242 (deposit ≤ 3× monthly rent; return 30 days).
-- NRS §118A.330 (entry 24 h notice; emergency exempt).
-- NRS §40.253 (7-day pay-or-quit; 5-day other breach).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300028-0000-4000-8000-000000000028',
  $n$Phase 13 — Nevada Standard Residential Lease$n$,
  'NV',
  $body$NEVADA RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of Nevada.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy converts to month-to-month per NRS §118A.470.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

Nevada has no statutory cap on late fees; fees must be a reasonable estimate of actual damages. If a late fee applies, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day thereafter.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Maximum deposit is three (3) months' rent, per NRS §118A.242(1). The deposit shall be returned within 30 days of lease termination, with an itemized written statement of deductions per §118A.242(4).

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition per NRS §118A.290.

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, or showing, per NRS §118A.330. No notice is required in emergencies.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

15. HOLDOVER

Holdover tenancy converts to month-to-month per NRS §118A.470.

----------------------------------------------------------

16. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 7 days. Other breach notice: 5 days. Procedures per NRS §40.253 and §40.2512 (Summary Eviction).

----------------------------------------------------------

17. GOVERNING LAW

This Agreement is governed by the laws of the State of Nevada, including NRS Chapter 118A (Landlord and Tenant — Dwellings) and NRS §118A.242 (Security Deposits).

----------------------------------------------------------

18. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

19. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Nevada law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"NV"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 29 — OKLAHOMA
-- 41 O.S. §115 (no deposit cap; return 30 days; written demand required).
-- §128 (entry 24 h notice; emergency exempt).
-- §131 (5-day pay-or-quit; 15-day other breach).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300029-0000-4000-8000-000000000029',
  $n$Phase 13 — Oklahoma Standard Residential Lease$n$,
  'OK',
  $body$OKLAHOMA RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of Oklahoma.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy shall be at the court's discretion per 41 O.S. §7.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

Oklahoma has no statutory late-fee cap; fees must be a reasonable estimate of actual damages. If a late fee applies, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day thereafter.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Oklahoma imposes no statutory cap on the deposit amount. The deposit shall be returned within 30 days of lease termination after Tenant provides a written demand for its return and a forwarding address, with an itemized written statement of deductions, per 41 O.S. §115.

NOTE: Tenant must provide a written demand for return of the deposit to trigger the 30-day return deadline under 41 O.S. §115.

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition per 41 O.S. §118.

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, or showing, per 41 O.S. §128. No notice is required in emergencies.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

15. HOLDOVER

Holdover tenancy is governed by 41 O.S. §7.

----------------------------------------------------------

16. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 5 days. Other breach notice: 15 days. Procedures per 41 O.S. §131 and §132 (Forcible Entry and Detainer).

----------------------------------------------------------

17. GOVERNING LAW

This Agreement is governed by the laws of the State of Oklahoma, including 41 O.S. §101 et seq. (Landlord and Tenant Act) and §115 (Security Deposits).

----------------------------------------------------------

18. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

19. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Oklahoma law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"OK"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 30 — OREGON
-- ORS §90.300 (no deposit cap; return 31 days).
-- SB 608 (2019) codified at ORS §90.427: just-cause required statewide
--   after 1 year of occupancy; in first year Landlord may terminate
--   without cause with 30-day notice.
-- ORS §90.262 (late fee: 5% after 4-day grace).
-- ORS §90.322 (entry 24 h notice; emergency exempt).
-- ORS §90.394 (72-hour notice for nonpayment; 30-day other breach).
-- Rent control: annual rent increase limited to CPI + 7% (ORS §90.323).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300030-0000-4000-8000-000000000030',
  $n$Phase 13 — Oregon Standard Residential Lease$n$,
  'OR',
  $body$OREGON RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of Oregon.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy converts to month-to-month per ORS §90.301.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

Per ORS §90.262, no late fee may be charged until rent is more than 4 days past due. The late fee shall not exceed 5% of the outstanding monthly rent. If a late fee applies, the amount is {{late_fee_flat}} (verified as ≤ 5% of monthly rent {{monthly_rent}}).

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Oregon imposes no statutory cap on the deposit amount. The deposit shall be returned within 31 days of lease termination, with an itemized written statement of deductions per ORS §90.300(7).

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition per ORS §90.320.

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, or showing, per ORS §90.322. No notice is required in emergencies.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

15. JUST-CAUSE TERMINATION (SB 608 / ORS §90.427)

After one year of occupancy, Landlord may only terminate this tenancy for one of the following just-cause reasons:
(a) Nonpayment of rent (72-hour notice);
(b) Violation of a lease term Tenant fails to correct within 30 days of written notice;
(c) Landlord's intent to make substantial repairs or renovations requiring vacancy (90-day notice with relocation assistance equal to 1 month's rent);
(d) Landlord's or immediate family member's intent to occupy the unit (90-day notice with relocation assistance);
(e) Demolition or conversion of the property (120-day notice with relocation assistance).

During the FIRST year of occupancy, Landlord may terminate without cause with 30 days' written notice (or 60 days if at end of fixed term).

----------------------------------------------------------

16. RENT INCREASE LIMIT (ORS §90.323)

Annual rent increases for units covered by ORS §90.323 are limited to the greater of 7% or 7% plus the Consumer Price Index (CPI). Landlord shall provide at least 90 days' written notice before any rent increase, per ORS §90.600.

----------------------------------------------------------

17. HOLDOVER

Holdover tenancy converts to month-to-month per ORS §90.301.

----------------------------------------------------------

18. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 72 hours. Other breach notice: 30 days. Procedures per ORS §90.394 and §105.135 (Forcible Entry and Detainer).

----------------------------------------------------------

19. GOVERNING LAW

This Agreement is governed by the laws of the State of Oregon, including ORS Chapter 90 (Residential Landlord and Tenant Act), ORS §90.262 (Late Fees), ORS §90.300 (Security Deposits), and ORS §90.427 (Just-Cause Termination — SB 608, 2019).

----------------------------------------------------------

20. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

21. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

22. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Oregon law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"OR"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 31 — RHODE ISLAND
-- R.I. Gen. Laws §34-18-19 (no deposit cap; return 20 days).
-- §34-18-26 (entry 24 h notice; emergency exempt).
-- §34-18-35 (5-day pay-or-quit; 20-day other breach).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300031-0000-4000-8000-000000000031',
  $n$Phase 13 — Rhode Island Standard Residential Lease$n$,
  'RI',
  $body$RHODE ISLAND RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of Rhode Island.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy shall be at the court's discretion per R.I. Gen. Laws §34-18-37.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

Rhode Island has no statutory late-fee cap; fees must be a reasonable estimate of actual damages. If a late fee applies, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day thereafter.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Rhode Island imposes no statutory cap on the deposit amount. The deposit shall be returned within 20 days of lease termination, with an itemized written statement of deductions per R.I. Gen. Laws §34-18-19(b).

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition per R.I. Gen. Laws §34-18-22.

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, or showing, per R.I. Gen. Laws §34-18-26. No notice is required in emergencies.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

15. HOLDOVER

Holdover tenancy is governed by R.I. Gen. Laws §34-18-37.

----------------------------------------------------------

16. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 5 days. Other breach notice: 20 days. Procedures per R.I. Gen. Laws §34-18-35 and §34-19 (Forcible Entry and Detainer).

----------------------------------------------------------

17. GOVERNING LAW

This Agreement is governed by the laws of the State of Rhode Island, including R.I. Gen. Laws §34-18-1 et seq. (Residential Landlord and Tenant Act) and §34-18-19 (Security Deposits).

----------------------------------------------------------

18. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

19. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d and R.I. Gen. Laws §42-128.1 (Lead Poisoning Prevention). Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Rhode Island law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"RI"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 32 — SOUTH CAROLINA
-- S.C. Code §27-40-410 (no deposit cap; return 30 days).
-- §27-40-530 (entry 24 h notice; emergency exempt).
-- §27-40-710 (5-day pay-or-quit; 14-day other breach).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300032-0000-4000-8000-000000000032',
  $n$Phase 13 — South Carolina Standard Residential Lease$n$,
  'SC',
  $body$SOUTH CAROLINA RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of South Carolina.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy shall be at the court's discretion per S.C. Code §27-40-770.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

South Carolina has no statutory late-fee cap; fees must be a reasonable estimate of actual damages. If a late fee applies, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day thereafter.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. South Carolina imposes no statutory cap on the deposit amount. The deposit shall be returned within 30 days of lease termination, with an itemized written statement of deductions per S.C. Code §27-40-410(b).

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition per S.C. Code §27-40-440.

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, or showing, per S.C. Code §27-40-530. No notice is required in emergencies.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

15. HOLDOVER

Holdover tenancy is governed by S.C. Code §27-40-770.

----------------------------------------------------------

16. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 5 days. Other breach notice: 14 days. Procedures per S.C. Code §27-40-710 and §27-37 (Ejectment).

----------------------------------------------------------

17. GOVERNING LAW

This Agreement is governed by the laws of the State of South Carolina, including S.C. Code §27-40-10 et seq. (Residential Landlord and Tenant Act) and §27-40-410 (Security Deposits).

----------------------------------------------------------

18. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

19. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable South Carolina law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"SC"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 33 — SOUTH DAKOTA
-- S.D.C.L. §43-32-6.1 (deposit ≤ 1× monthly rent; return 14 days).
-- §43-32-9 (entry reasonable notice / 24 h customary).
-- §21-16-2 (3-day pay-or-quit; no specific other-breach period).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300033-0000-4000-8000-000000000033',
  $n$Phase 13 — South Dakota Standard Residential Lease$n$,
  'SD',
  $body$SOUTH DAKOTA RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of South Dakota.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy shall be at the court's discretion per S.D.C.L. §43-32-14.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

South Dakota has no statutory late-fee cap; fees must be a reasonable estimate of actual damages. If a late fee applies, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day thereafter.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Maximum deposit is one (1) month's rent, per S.D.C.L. §43-32-6.1. The deposit shall be returned within 14 days of lease termination, with an itemized written statement of deductions.

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition as required by applicable codes.

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with reasonable advance notice (at least 24 hours) for inspection, repairs, or showing, per S.D.C.L. §43-32-9. No notice is required in emergencies.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

15. HOLDOVER

Holdover tenancy is governed by S.D.C.L. §43-32-14.

----------------------------------------------------------

16. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 3 days. Procedures per S.D.C.L. §21-16-2 (Forcible Entry and Detainer).

----------------------------------------------------------

17. GOVERNING LAW

This Agreement is governed by the laws of the State of South Dakota, including S.D.C.L. §43-32 (Landlord and Tenant) and §21-16 (Forcible Entry and Detainer).

----------------------------------------------------------

18. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

19. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable South Dakota law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"SD"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 34 — TENNESSEE
-- Tenn. Code §66-28-301 (no deposit cap; return 30 days; written
--   inventory required at move-in).
-- §66-28-403 (entry 24 h notice; emergency exempt).
-- §66-28-505 (14-day pay-or-quit; 30-day other breach).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300034-0000-4000-8000-000000000034',
  $n$Phase 13 — Tennessee Standard Residential Lease$n$,
  'TN',
  $body$TENNESSEE RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of Tennessee.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy shall be at the court's discretion per Tenn. Code §66-28-512.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

Tennessee has no statutory late-fee cap; fees must be a reasonable estimate of actual damages. If a late fee applies, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day thereafter.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Tennessee imposes no statutory cap on the deposit amount. The deposit shall be returned within 30 days of lease termination, with an itemized written statement of deductions per Tenn. Code §66-28-301(g).

----------------------------------------------------------

6. WRITTEN MOVE-IN INVENTORY

Per Tenn. Code §66-28-301, Landlord shall provide Tenant with a written itemized inventory describing the condition of the Premises at commencement. Both parties shall sign and date the inventory. This inventory shall serve as the baseline for assessing damage at move-out. A Move-In Inventory Addendum is attached to this Agreement.

----------------------------------------------------------

7. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

8. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

9. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

10. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

11. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

12. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition per Tenn. Code §66-28-304.

----------------------------------------------------------

13. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

14. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, or showing, per Tenn. Code §66-28-403. No notice is required in emergencies.

----------------------------------------------------------

15. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

16. HOLDOVER

Holdover tenancy is governed by Tenn. Code §66-28-512.

----------------------------------------------------------

17. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 14 days. Other breach notice: 30 days. Procedures per Tenn. Code §66-28-505 and §29-18 (Forcible Entry and Detainer).

----------------------------------------------------------

18. GOVERNING LAW

This Agreement is governed by the laws of the State of Tennessee, including Tenn. Code §66-28-101 et seq. (Uniform Residential Landlord and Tenant Act) and §66-28-301 (Security Deposits).

----------------------------------------------------------

19. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

20. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

21. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Tennessee law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"TN"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 35 — UTAH
-- Utah Code §57-17-3 (no deposit cap; return 30 days;
--   nonrefundable portions MUST be disclosed in writing).
-- §57-22-4 (entry 24 h notice; emergency exempt).
-- §78B-6-802 (3-day pay-or-quit; no specific other-breach period).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300035-0000-4000-8000-000000000035',
  $n$Phase 13 — Utah Standard Residential Lease$n$,
  'UT',
  $body$UTAH RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of Utah.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy shall be at the court's discretion per Utah Code §78B-6-802.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

Utah has no statutory late-fee cap; fees must be a reasonable estimate of actual damages. If a late fee applies, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day thereafter.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Utah imposes no statutory cap on the deposit amount. The deposit shall be returned within 30 days of lease termination, with an itemized written statement of deductions per Utah Code §57-17-3.

NONREFUNDABLE PORTIONS: The following portions of the deposit, if any, are expressly designated as nonrefundable (Utah Code §57-17-3(2)(b) requires written disclosure): {{nonrefundable_fee_description}}.

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition per Utah Code §57-22-3.

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, or showing, per Utah Code §57-22-4. No notice is required in emergencies.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

15. HOLDOVER

Holdover tenancy is governed by Utah Code §78B-6-802.

----------------------------------------------------------

16. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 3 days. Procedures per Utah Code §78B-6-802 et seq. (Unlawful Detainer).

----------------------------------------------------------

17. GOVERNING LAW

This Agreement is governed by the laws of the State of Utah, including Utah Code §57-17 (Security Deposits), §57-22 (Residential Landlord–Tenant Act), and §78B-6-801 et seq. (Unlawful Detainer).

----------------------------------------------------------

18. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

19. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Utah law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"UT"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 36 — VIRGINIA
-- Va. Code §55.1-1226 (deposit ≤ 2× monthly rent; return 45 days;
--   mandatory move-in inspection within 5 days).
-- §55.1-1229 (entry 24 h notice; emergency exempt).
-- §55.1-1245 (5-day pay-or-quit; 30-day other breach).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300036-0000-4000-8000-000000000036',
  $n$Phase 13 — Virginia Standard Residential Lease$n$,
  'VA',
  $body$VIRGINIA RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the Commonwealth of Virginia.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy shall be at the court's discretion per Va. Code §55.1-1253.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

Virginia does not impose a statutory cap on late fees; fees must be a reasonable estimate of actual damages. If a late fee applies, the amount is {{late_fee_flat}}, assessed after a reasonable grace period.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Maximum deposit is two (2) months' rent, per Va. Code §55.1-1226(A). The deposit shall be returned within 45 days of lease termination or 45 days of the date of Tenant's forwarding address, whichever is later, with an itemized written statement of deductions per §55.1-1226(B).

----------------------------------------------------------

6. MOVE-IN INSPECTION

Per Va. Code §55.1-1214, within 5 business days of the commencement of this tenancy, Landlord shall conduct a move-in inspection of the Premises. Both parties may be present for the inspection. A written inspection report describing the condition of the Premises shall be signed by both parties. A Move-In Inspection Report is attached to this Agreement.

----------------------------------------------------------

7. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

8. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

9. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

10. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

11. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

12. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition per Va. Code §55.1-1220.

----------------------------------------------------------

13. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

14. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, or showing, per Va. Code §55.1-1229. No notice is required in emergencies.

----------------------------------------------------------

15. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

16. HOLDOVER

Holdover tenancy is governed by Va. Code §55.1-1253.

----------------------------------------------------------

17. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 5 days. Other breach notice: 30 days. Procedures per Va. Code §55.1-1245 and §8.01-126 (Unlawful Detainer).

----------------------------------------------------------

18. GOVERNING LAW

This Agreement is governed by the laws of the Commonwealth of Virginia, including Va. Code §55.1-1200 et seq. (Virginia Residential Landlord and Tenant Act) and §55.1-1226 (Security Deposits).

----------------------------------------------------------

19. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

20. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

21. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Virginia law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"VA"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 37 — VERMONT
-- 9 V.S.A. §4461 (no deposit cap; return 14 days with interest).
-- §4460 (entry 48 h notice; emergency exempt).
-- §4467 (14-day pay-or-quit; 30-day other breach).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300037-0000-4000-8000-000000000037',
  $n$Phase 13 — Vermont Standard Residential Lease$n$,
  'VT',
  $body$VERMONT RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of Vermont.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy converts to month-to-month unless either party gives 60 days' written notice, per 9 V.S.A. §4467(a).

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

Vermont has no statutory late-fee cap; fees must be a reasonable estimate of actual damages. If a late fee applies, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day thereafter.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Vermont imposes no statutory cap on the deposit amount. The deposit shall be returned within 14 days of lease termination, with accrued interest and an itemized written statement of deductions per 9 V.S.A. §4461.

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition per 9 V.S.A. §4457.

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 48 hours' advance notice for inspection, repairs, or showing, per 9 V.S.A. §4460. No notice is required in emergencies.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

15. HOLDOVER

Holdover tenancy converts to month-to-month per 9 V.S.A. §4467(a).

----------------------------------------------------------

16. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 14 days. Other breach notice: 30 days. Procedures per 9 V.S.A. §4467 and 12 V.S.A. §4853a (Ejectment / Unlawful Detainer).

----------------------------------------------------------

17. GOVERNING LAW

This Agreement is governed by the laws of the State of Vermont, including 9 V.S.A. §§4451–4471 (Rental of Residential Property) and §4461 (Security Deposits).

----------------------------------------------------------

18. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

19. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Vermont law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"VT"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 38 — WASHINGTON
-- RCW §59.18.270 (no deposit cap; return 21 days; mandatory move-in
--   checklist per RCW §59.18.260).
-- RCW §59.18.060 (entry 2 days notice; emergency exempt).
-- RCW §59.18.375 (14-day notice for nonpayment; 10-day other breach).
-- Rent increase notice: 60 days for any increase per RCW §59.18.140 (2022 SB 5160).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300038-0000-4000-8000-000000000038',
  $n$Phase 13 — Washington Standard Residential Lease$n$,
  'WA',
  $body$WASHINGTON STATE RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of Washington.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy converts to month-to-month per RCW §59.18.220.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

Washington has no statutory late-fee cap for residential leases; fees must be a reasonable estimate of actual damages. If a late fee applies, the amount is {{late_fee_flat}}, assessed after a reasonable grace period.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Washington imposes no statutory cap on the deposit amount. The deposit shall be returned within 21 days of the end of the rental period, with an itemized written statement of deductions per RCW §59.18.270.

----------------------------------------------------------

6. MOVE-IN CHECKLIST

Per RCW §59.18.260, upon commencement of this tenancy, Landlord shall provide Tenant with a written checklist or statement describing the condition of the Premises and any furnished appliances. Both parties shall sign and date the checklist. A Move-In Condition Checklist is attached to this Agreement as a required addendum.

Tenant's failure to return the signed checklist within the time allowed does not relieve Landlord's obligation to return the deposit per RCW §59.18.270.

----------------------------------------------------------

7. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

8. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

9. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

10. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

11. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

12. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition per RCW §59.18.060.

----------------------------------------------------------

13. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

14. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 2 days' advance notice for inspection, repairs, or showing, per RCW §59.18.150(6). No notice is required in emergencies.

----------------------------------------------------------

15. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

16. HOLDOVER

Holdover tenancy converts to month-to-month per RCW §59.18.220.

----------------------------------------------------------

17. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 14 days. Other breach notice: 10 days. Procedures per RCW §59.18.375 and RCW §59.12 (Unlawful Detainer).

----------------------------------------------------------

18. RENT INCREASE NOTICE

Landlord shall provide at least 60 days' written notice before any rent increase, per RCW §59.18.140 (as amended by 2022 SB 5160).

----------------------------------------------------------

19. GOVERNING LAW

This Agreement is governed by the laws of the State of Washington, including RCW Chapter 59.18 (Residential Landlord–Tenant Act), RCW §59.18.260–270 (Move-In Checklist and Deposits), and RCW §59.12 (Unlawful Detainer).

----------------------------------------------------------

20. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

21. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

22. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Washington law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"WA"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 39 — WISCONSIN
-- Wis. Stat. §704.28 (no deposit cap; return 21 days; written check-in
--   and check-out required per §704.085).
-- §704.05 (entry 12 h notice; emergency exempt).
-- §799.40 (5-day pay-or-quit; 14-day other breach).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300039-0000-4000-8000-000000000039',
  $n$Phase 13 — Wisconsin Standard Residential Lease$n$,
  'WI',
  $body$WISCONSIN RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of Wisconsin.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy shall be at the court's discretion per Wis. Stat. §704.25.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

Wisconsin has no statutory late-fee cap; fees must be a reasonable estimate of actual damages. If a late fee applies, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day thereafter.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Wisconsin imposes no statutory cap on the deposit amount. The deposit shall be returned within 21 days of the end of the tenancy, with an itemized written statement of deductions per Wis. Stat. §704.28.

----------------------------------------------------------

6. CHECK-IN REPORT

Per Wis. Stat. §704.085 and Wis. Admin. Code §ATCP 134.06, Landlord shall provide Tenant with a written check-in report describing the condition of the Premises within 7 days after the commencement of the tenancy. Tenant shall have 7 days to add written comments. At the end of the tenancy, a check-out inspection shall be conducted. A Check-In/Check-Out Report is attached to this Agreement.

----------------------------------------------------------

7. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

8. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

9. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

10. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

11. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

12. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition per Wis. Stat. §704.07.

----------------------------------------------------------

13. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

14. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 12 hours' advance notice for inspection, repairs, or showing, per Wis. Stat. §704.05(2). No notice is required in emergencies.

----------------------------------------------------------

15. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

16. HOLDOVER

Holdover tenancy is governed by Wis. Stat. §704.25.

----------------------------------------------------------

17. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 5 days. Other breach notice: 14 days. Procedures per Wis. Stat. §799.40 and §704.17 (Notice Requirements).

----------------------------------------------------------

18. GOVERNING LAW

This Agreement is governed by the laws of the State of Wisconsin, including Wis. Stat. Chapter 704 (Landlord and Tenant), §704.28 (Security Deposits), §704.085 (Check-In Reports), and Wis. Admin. Code ATCP Ch. 134 (Residential Rental Practices).

----------------------------------------------------------

19. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

20. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

21. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Wisconsin law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"WI"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 40 — WEST VIRGINIA
-- W. Va. Code §37-6A-1 et seq. (West Virginia Landlord-Tenant Act, 2021;
--   no deposit cap; return 60 days with written notice required).
-- §37-6A-3 (entry 24 h notice; emergency exempt).
-- §55-3A-1 (10-day pay-or-quit; no specific other-breach period).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300040-0000-4000-8000-000000000040',
  $n$Phase 13 — West Virginia Standard Residential Lease$n$,
  'WV',
  $body$WEST VIRGINIA RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of West Virginia.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy shall be at the court's discretion per W. Va. Code §55-3A-1.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

West Virginia has no statutory late-fee cap; fees must be a reasonable estimate of actual damages. If a late fee applies, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day thereafter.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. West Virginia imposes no statutory cap on the deposit amount. The deposit shall be returned within 60 days of lease termination, following written notice from Tenant of the forwarding address, with an itemized written statement of deductions per W. Va. Code §37-6A-2.

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition per W. Va. Code §37-6A-4.

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, or showing, per W. Va. Code §37-6A-3. No notice is required in emergencies.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

15. HOLDOVER

Holdover tenancy is governed by W. Va. Code §55-3A-1 and applicable common law.

----------------------------------------------------------

16. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 10 days. Procedures per W. Va. Code §55-3A-1 et seq. (Forcible Entry and Detainer).

----------------------------------------------------------

17. GOVERNING LAW

This Agreement is governed by the laws of the State of West Virginia, including W. Va. Code §37-6A-1 et seq. (West Virginia Landlord–Tenant Act of 2021) and §55-3A (Forcible Entry and Detainer).

----------------------------------------------------------

18. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

19. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable West Virginia law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"WV"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

-- ═══════════════════════════════════════════════════════════════
-- 41 — WYOMING
-- Wyo. Stat. §1-21-1207 (no deposit cap; return 30 days; written notice
--   to tenant at move-out required).
-- §1-21-1205 (entry 24 h notice; emergency exempt).
-- §1-21-1002 (3-day pay-or-quit; no specific other-breach period).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.lease_templates (
  id, name, state_code, template_body, is_active,
  legal_review_status, attorney_reviewer, attorney_review_date, attorney_bar_number,
  variables, created_at, updated_at
) VALUES (
  'f1300041-0000-4000-8000-000000000041',
  $n$Phase 13 — Wyoming Standard Residential Lease$n$,
  'WY',
  $body$WYOMING RESIDENTIAL LEASE AGREEMENT

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

(the "Premises"), to be used solely as a private residential dwelling in the State of Wyoming.

----------------------------------------------------------

2. LEASE TERM

The lease term shall begin on {{lease_start_date}} and end on {{lease_end_date}}. This is a fixed-term tenancy. Upon expiration, holdover tenancy shall be at the court's discretion per Wyo. Stat. §1-21-1003.

----------------------------------------------------------

3. RENT

Tenant agrees to pay a monthly rent of {{monthly_rent}}, due on or before the 1st day of each calendar month.

----------------------------------------------------------

4. LATE FEES

Wyoming has no statutory late-fee cap; fees must be a reasonable estimate of actual damages. If a late fee applies, the amount is {{late_fee_flat}}, plus {{late_fee_daily}} per day thereafter.

----------------------------------------------------------

5. SECURITY DEPOSIT

Tenant shall pay a security deposit of {{security_deposit}} prior to taking possession. Wyoming imposes no statutory cap on the deposit amount. The deposit shall be returned within 30 days of lease termination, with an itemized written statement of deductions and written notice to Tenant, per Wyo. Stat. §1-21-1207.

----------------------------------------------------------

6. MOVE-IN COSTS

Total move-in costs due prior to possession: {{move_in_costs}}.

----------------------------------------------------------

7. UTILITIES AND SERVICES

Tenant is responsible for all utilities unless otherwise agreed in writing.

----------------------------------------------------------

8. USE OF PREMISES

Tenant shall use the Premises only as a private residential dwelling, in compliance with all applicable laws, ordinances, and regulations.

----------------------------------------------------------

9. PETS POLICY

{{pets_policy}}

----------------------------------------------------------

10. SMOKING POLICY

{{smoking_policy}}

----------------------------------------------------------

11. MAINTENANCE AND REPAIRS

Tenant shall keep the Premises clean and promptly notify Landlord in writing of needed repairs. Landlord shall maintain the Premises in habitable condition as required by applicable housing codes.

----------------------------------------------------------

12. ALTERATIONS

Tenant shall not make any alterations without prior written consent from Landlord.

----------------------------------------------------------

13. ACCESS BY LANDLORD

Landlord may enter the Premises with at least 24 hours' advance notice for inspection, repairs, or showing, per Wyo. Stat. §1-21-1205. No notice is required in emergencies.

----------------------------------------------------------

14. SUBLETTING AND ASSIGNMENT

Tenant shall not sublet or assign this Agreement without prior written consent from Landlord.

----------------------------------------------------------

15. HOLDOVER

Holdover tenancy is governed by Wyo. Stat. §1-21-1003.

----------------------------------------------------------

16. DEFAULT AND EVICTION

Failure to pay rent or breach of any material term may result in termination and eviction. Non-payment notice: 3 days. Procedures per Wyo. Stat. §1-21-1002 et seq. (Forcible Entry and Detainer).

----------------------------------------------------------

17. GOVERNING LAW

This Agreement is governed by the laws of the State of Wyoming, including Wyo. Stat. §1-21-1201 et seq. (Residential Rental Property Act) and §1-21-1207 (Security Deposits).

----------------------------------------------------------

18. ENTIRE AGREEMENT

This Agreement and any signed addenda constitute the entire understanding. Modifications require a written instrument signed by both parties.

----------------------------------------------------------

19. LEAD-BASED PAINT DISCLOSURE

If the Premises was constructed before 1978, Landlord discloses any known lead-based paint hazards per 42 U.S.C. §4852d. Tenant acknowledges receipt of the EPA pamphlet "Protect Your Family From Lead in Your Home."

----------------------------------------------------------

20. TENANT ACKNOWLEDGMENT AND ELECTRONIC SIGNATURE

By signing electronically, Tenant confirms having read and understood all terms and agrees to be bound by them. Tenant's electronic signature is legally binding under the federal E-SIGN Act (15 U.S.C. §7001 et seq.) and applicable Wyoming law.

LANDLORD SIGNATURE:

_______________________________
{{landlord_name}}
Date: _________________________
$body$,
  true, 'statute_derived', NULL, NULL, NULL,
  '{"state_code":"WY"}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, state_code = EXCLUDED.state_code,
  template_body = EXCLUDED.template_body, is_active = true,
  legal_review_status = EXCLUDED.legal_review_status,
  variables = EXCLUDED.variables, updated_at = NOW();

COMMIT;
