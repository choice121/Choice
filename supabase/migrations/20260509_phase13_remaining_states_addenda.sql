-- ============================================================
-- Phase 13 — State-specific addenda for remaining 41 jurisdictions
--
-- Adds addenda required or strongly recommended by each state's statutes.
-- Federal and common addenda (lead-paint, bedbug, mold, etc.) are already
-- in Phase 04 and apply globally — only STATE-SPECIFIC ones are added here.
--
-- Slugs follow the convention: <state_or_federal>/<short-slug>
-- All entries: legal_review_status = 'statute_derived', is_active = true.
--
-- Idempotent: INSERT … ON CONFLICT (slug) DO UPDATE.
-- ============================================================

BEGIN;

-- ── NEW JERSEY: Truth-in-Renting Statement ─────────────────────
-- N.J.S.A. §46:8-45; N.J.A.C. 5:10-1.1 et seq.
-- Landlord must provide the DCA's "Truth in Renting" pamphlet to tenants.
INSERT INTO public.lease_addenda_library
  (slug, title, jurisdiction, applies_when, body, attached_pdf_path,
   signature_required, initials_required, citation, source_url,
   legal_review_status, is_active)
VALUES
  ('nj/truth-in-renting',
   'New Jersey Truth-in-Renting Statement',
   'NJ',
   '{}'::jsonb,
   $body$NEW JERSEY TRUTH-IN-RENTING STATEMENT

Pursuant to N.J.S.A. §46:8-45 and regulations of the New Jersey Department of Community Affairs (N.J.A.C. 5:10-1.1 et seq.), Landlord is required to provide Tenant with a copy of the "Truth in Renting" statement prepared by the New Jersey Department of Community Affairs before a residential lease is signed.

TENANT ACKNOWLEDGMENT

Tenant acknowledges receipt of the "Truth in Renting" statement. This statement summarizes the rights and responsibilities of both landlords and tenants under New Jersey law, including:
  • Rights and obligations regarding the security deposit
  • Landlord's duty to maintain the premises in habitable condition
  • Tenant's right to an itemized accounting of security deposit deductions
  • Rules governing late fees and lease renewal
  • Anti-Eviction Act protections (N.J.S.A. §2A:18-61.1 et seq.)
  • Protections against retaliatory eviction and rent increases
  • Tenant's right to organize

The full text of the "Truth in Renting" statement is available from the New Jersey Department of Community Affairs at:
https://www.nj.gov/dca/divisions/codes/publications/pdf_lti/tir.pdf

Property: {{property_address}}
Tenant:   {{tenant_full_name}}
Date:     {{lease_start_date}}$body$,
   NULL, true, false,
   'N.J.S.A. §46:8-45; N.J.A.C. 5:10-1.1 et seq.',
   'https://www.nj.gov/dca/divisions/codes/publications/pdf_lti/tir.pdf',
   'statute_derived', true)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body,
  citation = EXCLUDED.citation, source_url = EXCLUDED.source_url,
  is_active = true, legal_review_status = EXCLUDED.legal_review_status;

-- ── OREGON: SB 608 Just-Cause Termination Notice ───────────────
-- ORS §90.427 (2019 SB 608): after 1 year, just-cause required.
INSERT INTO public.lease_addenda_library
  (slug, title, jurisdiction, applies_when, body, attached_pdf_path,
   signature_required, initials_required, citation, source_url,
   legal_review_status, is_active)
VALUES
  ('or/sb608-just-cause',
   'Oregon SB 608 Just-Cause Termination Disclosure',
   'OR',
   '{}'::jsonb,
   $body$OREGON JUST-CAUSE TERMINATION DISCLOSURE (SB 608 / ORS §90.427)

NOTICE TO TENANT

Under Oregon Senate Bill 608 (2019), codified at ORS §90.427, after a tenant has occupied a dwelling unit for one (1) year or more, a landlord may only terminate the tenancy for one of the following "just cause" reasons:

NO-FAULT JUST CAUSES (require relocation assistance):
  1. Landlord or immediate family member will occupy the unit (90-day notice; 1 month's rent relocation assistance required).
  2. Landlord is demolishing or substantially repairing the unit (120-day notice; 1 month's rent relocation assistance required).
  3. Conversion to non-residential use (120-day notice; 1 month's rent relocation assistance required).
  4. Sale of single-family home with intent to have buyer occupy (90-day notice; 1 month's rent relocation assistance required).

FOR-CAUSE JUST CAUSES (no relocation assistance):
  5. Nonpayment of rent (72-hour notice).
  6. Material violation of the lease Tenant fails to cure within 30 days.
  7. Materially damaging the property.
  8. Nuisance or drug-related activity.
  9. Failure to comply with a court order.

FIRST YEAR EXCEPTION: During the FIRST year of occupancy, Landlord may terminate this tenancy without cause by giving 30 days' written notice (or at least as many days as remain in the rental period, whichever is greater).

RENT INCREASE LIMITATION: Annual rent increases are limited by ORS §90.323 to the greater of 7% or 7% above the CPI (for units covered by the statute). Landlord will provide at least 90 days' advance written notice of any rent increase per ORS §90.600.

Tenant acknowledges receipt of this disclosure.

Property: {{property_address}}
Tenant:   {{tenant_full_name}}
Date:     {{lease_start_date}}$body$,
   NULL, true, false,
   'ORS §90.427 (SB 608, 2019); ORS §90.323 (rent control); ORS §90.600',
   'https://www.oregonlegislature.gov/bills_laws/ors/ors090.html',
   'statute_derived', true)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body,
  citation = EXCLUDED.citation, source_url = EXCLUDED.source_url,
  is_active = true, legal_review_status = EXCLUDED.legal_review_status;

-- ── WASHINGTON: Move-In Condition Checklist ─────────────────────
-- RCW §59.18.260 mandates a written checklist at lease commencement.
INSERT INTO public.lease_addenda_library
  (slug, title, jurisdiction, applies_when, body, attached_pdf_path,
   signature_required, initials_required, citation, source_url,
   legal_review_status, is_active)
VALUES
  ('wa/move-in-checklist',
   'Washington Move-In Condition Checklist (RCW §59.18.260)',
   'WA',
   '{}'::jsonb,
   $body$WASHINGTON STATE MOVE-IN CONDITION CHECKLIST

Pursuant to RCW §59.18.260, this checklist documents the condition of the Premises at the commencement of the tenancy. Both Landlord and Tenant shall complete, sign, and retain a copy.

Property: {{property_address}}
Tenant:   {{tenant_full_name}}
Move-In Date: {{lease_start_date}}

INSTRUCTIONS: For each area, mark the condition as: GOOD / FAIR / POOR / N/A. Note any existing damage in the "Comments" column. Tenant may add additional notes within 5 days of receipt.

LIVING AREAS
  Walls: _____________  Floors: _____________  Ceiling: _____________
  Windows: _____________  Doors: _____________  Lighting: _____________
  Comments: _______________________________________________

KITCHEN
  Walls: _____________  Floors: _____________  Ceiling: _____________
  Refrigerator: _____________  Stove/Range: _____________  Dishwasher: _____________
  Cabinets: _____________  Sink/Faucet: _____________
  Comments: _______________________________________________

BATHROOM(S)
  Walls: _____________  Floors: _____________  Ceiling: _____________
  Toilet: _____________  Tub/Shower: _____________  Sink/Faucet: _____________
  Vanity: _____________  Exhaust Fan: _____________
  Comments: _______________________________________________

BEDROOM(S)
  Walls: _____________  Floors: _____________  Ceiling: _____________
  Windows: _____________  Closets: _____________  Doors: _____________
  Comments: _______________________________________________

EXTERIOR / COMMON AREAS
  Entry: _____________  Garage/Parking: _____________  Yard: _____________
  Comments: _______________________________________________

UTILITIES / SYSTEMS
  Heating: _____________  A/C: _____________  Water Heater: _____________
  Electrical: _____________  Plumbing: _____________  Smoke Detectors: _____________
  Carbon Monoxide Detectors: _____________
  Comments: _______________________________________________

KEYS / ACCESS ITEMS PROVIDED
  Number of keys: _____  Garage openers: _____  Mailbox keys: _____
  Other: _______________

Landlord certifies the above accurately represents the condition of the Premises on the date listed.
Tenant acknowledges review of the above and may add written comments within 5 days.

Landlord Signature: _______________________  Date: __________
Tenant Signature:   _______________________  Date: __________$body$,
   NULL, true, false,
   'RCW §59.18.260; RCW §59.18.270',
   'https://app.leg.wa.gov/rcw/default.aspx?cite=59.18.260',
   'statute_derived', true)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body,
  citation = EXCLUDED.citation, source_url = EXCLUDED.source_url,
  is_active = true, legal_review_status = EXCLUDED.legal_review_status;

-- ── MASSACHUSETTS: Statement of Condition ──────────────────────
-- G.L. c. 186 §15B(2)(c): statement within 10 days of tenancy commencement.
INSERT INTO public.lease_addenda_library
  (slug, title, jurisdiction, applies_when, body, attached_pdf_path,
   signature_required, initials_required, citation, source_url,
   legal_review_status, is_active)
VALUES
  ('ma/condition-statement',
   'Massachusetts Statement of Condition (G.L. c. 186 §15B)',
   'MA',
   '{}'::jsonb,
   $body$MASSACHUSETTS STATEMENT OF CONDITION

Pursuant to G.L. c. 186 §15B(2)(c), Landlord must provide this written statement of the condition of the Premises to Tenant within 10 days of the beginning of the tenancy. Tenant may note any disagreement in writing within 15 days of receipt.

Property: {{property_address}}
Tenant:   {{tenant_full_name}}
Move-In Date: {{lease_start_date}}

LANDLORD'S STATEMENT OF CONDITION

Landlord certifies, to the best of Landlord's knowledge, that the Premises is in the following condition at the commencement of the tenancy:

GENERAL CONDITION: ( ) Excellent  ( ) Good  ( ) Fair  ( ) Needs Repair

SPECIFIC DEFECTS OR CONDITIONS TO DISCLOSE (list all known defects):
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________
(Attach additional sheets if necessary.)

APPLIANCES (check if included and working):
  Refrigerator: ( ) Y ( ) N  Stove/Oven: ( ) Y ( ) N  Dishwasher: ( ) Y ( ) N
  Washer: ( ) Y ( ) N  Dryer: ( ) Y ( ) N  Garbage Disposal: ( ) Y ( ) N

UTILITIES:
  Heat type: ___________________  Included in rent: ( ) Y ( ) N
  Hot water: ( ) Working  Electric: ( ) Working  Plumbing: ( ) Working

TENANT'S RIGHT TO RESPOND

Tenant has 15 days from the date of receipt to provide written comments noting any disagreement with the above statement. Failure to respond does not constitute waiver of any claim that the Premises was in a different condition at move-in.

Per G.L. c. 186 §15B(2)(c), this statement and any Tenant response shall be used as the baseline for determining deductions from the security deposit at the end of the tenancy.

Landlord Signature: _______________________  Date: __________
Date Delivered to Tenant: __________

TENANT'S WRITTEN RESPONSE (if any, within 15 days):
_______________________________________________
_______________________________________________
Tenant Signature: _______________________  Date: __________$body$,
   NULL, true, false,
   'G.L. c. 186 §15B(2)(c) (Massachusetts)',
   'https://www.mass.gov/info-details/massachusetts-law-about-landlord-and-tenant',
   'statute_derived', true)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body,
  citation = EXCLUDED.citation, source_url = EXCLUDED.source_url,
  is_active = true, legal_review_status = EXCLUDED.legal_review_status;

-- ── CONNECTICUT: Security Deposit Interest Addendum ────────────
-- C.G.S. §47a-21(i): annual interest on deposit at Banking Commissioner rate.
INSERT INTO public.lease_addenda_library
  (slug, title, jurisdiction, applies_when, body, attached_pdf_path,
   signature_required, initials_required, citation, source_url,
   legal_review_status, is_active)
VALUES
  ('ct/deposit-interest',
   'Connecticut Security Deposit Interest Addendum',
   'CT',
   '{}'::jsonb,
   $body$CONNECTICUT SECURITY DEPOSIT INTEREST ADDENDUM

Pursuant to C.G.S. §47a-21(i), Landlord is required to pay annual interest on the security deposit at the rate established by the Banking Commissioner of Connecticut.

SECURITY DEPOSIT DETAILS

Property: {{property_address}}
Tenant:   {{tenant_full_name}}
Security Deposit Amount: {{security_deposit}}
Deposit Received Date: {{lease_start_date}}

INTEREST TERMS

  1. The security deposit will accrue interest at the rate announced each year by the Connecticut Banking Commissioner.
  2. Interest shall be credited (or paid to Tenant) at the end of each 12-month period of the tenancy, or upon termination of the tenancy, whichever occurs first.
  3. Landlord may credit accrued interest against the last month's rent if Tenant so requests in writing.
  4. Upon lease termination, Landlord shall return the deposit plus any unpaid accrued interest (less lawful deductions) within 30 days, or within 15 days after Tenant provides a forwarding address, whichever is later.

DEPOSIT CAP NOTICE

  • Tenants UNDER 62 years of age: maximum deposit is two (2) months' rent.
  • Tenants 62 years of age or OLDER: maximum deposit is one (1) month's rent per C.G.S. §47a-21(b).

Landlord Signature: _______________________  Date: __________
Tenant Signature:   _______________________  Date: __________$body$,
   NULL, true, false,
   'C.G.S. §47a-21(b) and (i) (Connecticut)',
   'https://www.cga.ct.gov/current/pub/chap_831.htm',
   'statute_derived', true)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body,
  citation = EXCLUDED.citation, source_url = EXCLUDED.source_url,
  is_active = true, legal_review_status = EXCLUDED.legal_review_status;

-- ── MARYLAND: Security Deposit Interest & Receipt ──────────────
-- Md. Code, Real Property §8-203(d): written receipt required within 30 days;
-- interest at passbook savings rate.
INSERT INTO public.lease_addenda_library
  (slug, title, jurisdiction, applies_when, body, attached_pdf_path,
   signature_required, initials_required, citation, source_url,
   legal_review_status, is_active)
VALUES
  ('md/deposit-interest',
   'Maryland Security Deposit Receipt and Interest Addendum',
   'MD',
   '{}'::jsonb,
   $body$MARYLAND SECURITY DEPOSIT RECEIPT AND INTEREST ADDENDUM

Pursuant to Md. Code, Real Property §8-203, this addendum confirms receipt of the security deposit and provides the required disclosure of deposit account information.

DEPOSIT RECEIPT

Property: {{property_address}}
Tenant:   {{tenant_full_name}}
Security Deposit Amount: ${{security_deposit}}
Date Received: {{lease_start_date}}

FINANCIAL INSTITUTION WHERE DEPOSIT IS HELD

  Name of Institution: ________________________________________
  Address: __________________________________________________
  Account Number (last 4 digits only): ________________________

Landlord shall provide the complete bank name and address in writing within 30 days of receiving the deposit, per §8-203(d).

INTEREST TERMS

  1. The security deposit shall earn interest at the passbook savings account rate of the financial institution holding the deposit.
  2. Interest shall accrue from the date of deposit and be paid to Tenant upon return of the deposit.
  3. The deposit, plus accrued interest less lawful deductions, shall be returned within 45 days of lease termination, with an itemized written statement.

DEPOSIT CAP NOTICE

Maximum deposit is two (2) months' rent, per Md. Code, Real Property §8-203(b).

Landlord Signature: _______________________  Date: __________
Tenant Signature:   _______________________  Date: __________$body$,
   NULL, true, false,
   'Md. Code, Real Property §8-203 (Maryland)',
   'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=Rp&section=8-203',
   'statute_derived', true)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body,
  citation = EXCLUDED.citation, source_url = EXCLUDED.source_url,
  is_active = true, legal_review_status = EXCLUDED.legal_review_status;

-- ── MINNESOTA: Security Deposit Interest Disclosure ────────────
-- Minn. Stat. §504B.178: interest required; cap 8%/mo late fee.
INSERT INTO public.lease_addenda_library
  (slug, title, jurisdiction, applies_when, body, attached_pdf_path,
   signature_required, initials_required, citation, source_url,
   legal_review_status, is_active)
VALUES
  ('mn/deposit-interest',
   'Minnesota Security Deposit Interest Disclosure',
   'MN',
   '{}'::jsonb,
   $body$MINNESOTA SECURITY DEPOSIT INTEREST DISCLOSURE

Pursuant to Minn. Stat. §504B.178, Landlord is required to pay interest on the security deposit.

DEPOSIT DETAILS

Property: {{property_address}}
Tenant:   {{tenant_full_name}}
Security Deposit Amount: ${{security_deposit}}
Date Received: {{lease_start_date}}

INTEREST TERMS

  1. The security deposit shall earn interest at the rate of the bank's current interest-bearing savings account or money market account rate.
  2. Interest accrues from the first day of the month following the date the deposit was received.
  3. Upon termination, Landlord shall return the deposit plus accrued interest (less lawful deductions) within 21 days.
  4. If termination is due to fire or casualty and Landlord has actual knowledge of Tenant's departure, the 21-day period is reduced to 5 days.

LATE FEE CAP NOTICE

Per Minn. Stat. §504B.177, no late fee may be charged until rent is more than 5 days past due, and the total late fee may not exceed 8% of the past-due monthly rent.

Landlord Signature: _______________________  Date: __________
Tenant Signature:   _______________________  Date: __________$body$,
   NULL, true, false,
   'Minn. Stat. §504B.178 (security deposit interest); §504B.177 (late fee cap)',
   'https://www.revisor.mn.gov/statutes/cite/504B.178',
   'statute_derived', true)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body,
  citation = EXCLUDED.citation, source_url = EXCLUDED.source_url,
  is_active = true, legal_review_status = EXCLUDED.legal_review_status;

-- ── VERMONT: Security Deposit Interest Disclosure ──────────────
-- 9 V.S.A. §4461: interest on deposit; return 14 days.
INSERT INTO public.lease_addenda_library
  (slug, title, jurisdiction, applies_when, body, attached_pdf_path,
   signature_required, initials_required, citation, source_url,
   legal_review_status, is_active)
VALUES
  ('vt/deposit-interest',
   'Vermont Security Deposit Interest Disclosure',
   'VT',
   '{}'::jsonb,
   $body$VERMONT SECURITY DEPOSIT INTEREST DISCLOSURE

Pursuant to 9 V.S.A. §4461, Landlord must pay interest on the security deposit.

DEPOSIT DETAILS

Property: {{property_address}}
Tenant:   {{tenant_full_name}}
Security Deposit Amount: ${{security_deposit}}
Date Received: {{lease_start_date}}

INTEREST TERMS

  1. The security deposit shall earn interest at a rate equal to the interest rate on a standard interest-bearing savings account.
  2. Upon termination, Landlord shall return the deposit plus accrued interest (less lawful deductions) within 14 days.
  3. A written statement itemizing any deductions shall accompany the return of the deposit.

Landlord Signature: _______________________  Date: __________
Tenant Signature:   _______________________  Date: __________$body$,
   NULL, true, false,
   '9 V.S.A. §4461 (Vermont)',
   'https://legislature.vermont.gov/statutes/section/09/137/04461',
   'statute_derived', true)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body,
  citation = EXCLUDED.citation, source_url = EXCLUDED.source_url,
  is_active = true, legal_review_status = EXCLUDED.legal_review_status;

-- ── NEW JERSEY: Security Deposit Interest Addendum ─────────────
-- N.J.S.A. §46:8-19(d): interest at money-market or CD rate.
INSERT INTO public.lease_addenda_library
  (slug, title, jurisdiction, applies_when, body, attached_pdf_path,
   signature_required, initials_required, citation, source_url,
   legal_review_status, is_active)
VALUES
  ('nj/deposit-interest',
   'New Jersey Security Deposit Interest Addendum',
   'NJ',
   '{}'::jsonb,
   $body$NEW JERSEY SECURITY DEPOSIT INTEREST ADDENDUM

Pursuant to N.J.S.A. §46:8-19(d), Landlord must invest the security deposit in an interest-bearing account and pay interest to Tenant.

DEPOSIT DETAILS

Property: {{property_address}}
Tenant:   {{tenant_full_name}}
Security Deposit Amount: ${{security_deposit}}
Deposit Cap: 1.5 × monthly rent per N.J.S.A. §46:8-21.2

FINANCIAL INSTITUTION AND ACCOUNT TYPE

  Name of Institution: ________________________________________
  Account Type: ( ) Money Market  ( ) Highest Rate CD  ( ) Other Interest-Bearing
  Account Number (partial): ___________________________________

Landlord shall disclose the name of the institution and account details to Tenant in writing within 30 days of receipt.

INTEREST OPTIONS

Tenant may elect one of the following (check one):
  ( ) Credit interest against the final month's rent each year.
  ( ) Receive interest payment directly each year.
  ( ) Defer interest to lease termination.

RETURN OF DEPOSIT

The deposit plus accrued interest, less lawful itemized deductions, shall be returned within:
  • 30 days of lease termination, or
  • 5 days if the rental unit is destroyed by fire, flood, condemnation, or similar casualty.

Landlord Signature: _______________________  Date: __________
Tenant Signature:   _______________________  Date: __________$body$,
   NULL, true, false,
   'N.J.S.A. §46:8-19 and §46:8-21.2 (New Jersey)',
   'https://njleg.state.nj.us/Bills/2021/A3000/2556_I1.HTM',
   'statute_derived', true)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body,
  citation = EXCLUDED.citation, source_url = EXCLUDED.source_url,
  is_active = true, legal_review_status = EXCLUDED.legal_review_status;

-- ── DISTRICT OF COLUMBIA: Just-Cause Eviction Disclosure ───────
-- D.C. Code §42-3505.01 (Rental Housing Act — just-cause for most tenancies).
INSERT INTO public.lease_addenda_library
  (slug, title, jurisdiction, applies_when, body, attached_pdf_path,
   signature_required, initials_required, citation, source_url,
   legal_review_status, is_active)
VALUES
  ('dc/just-cause',
   'District of Columbia Just-Cause Eviction Disclosure',
   'DC',
   '{}'::jsonb,
   $body$DISTRICT OF COLUMBIA JUST-CAUSE EVICTION DISCLOSURE

Pursuant to the Rental Housing Act of 1985 (D.C. Code §42-3505.01), Landlord may only terminate this tenancy for one of the following just-cause reasons:

PERMITTED GROUNDS FOR EVICTION

  1. NONPAYMENT OF RENT: Tenant fails to pay rent within 30 days of a written demand. Tenant has the right to cure during this period.
  2. LEASE VIOLATION: Tenant violates a substantial obligation of the lease and fails to cure within 30 days of written notice.
  3. NUISANCE OR CRIMINAL ACTIVITY: Tenant engages in illegal activity or creates a nuisance on the premises.
  4. UNAUTHORIZED PERSON: Tenant allows an unauthorized person to occupy the premises for more than 15 consecutive days without Landlord's prior written consent.
  5. DAMAGE TO PROPERTY: Tenant willfully destroys or damages the rental unit.
  6. OWNER OCCUPANCY: Landlord (or immediate family member) intends to occupy the unit, with at least 90 days' written notice and relocation assistance.
  7. SALE: Landlord sells the property and buyer intends to occupy.
  8. DEMOLITION OR REHABILITATION: Landlord intends to demolish or substantially rehabilitate the building.

PROHIBITED GROUNDS

Landlord may NOT terminate this tenancy because of:
  • Tenant's exercise of any legal right (e.g., complaining to housing authorities).
  • Retaliatory motive.
  • Discrimination based on any protected class under D.C. law.

TENANT RIGHTS

Tenant has the right to organize with other tenants, receive notices in a language you understand (D.C. Code §42-3505.07), and seek assistance from the D.C. Office of the Tenant Advocate (202-719-6560 | ota.dc.gov).

Property: {{property_address}}
Tenant:   {{tenant_full_name}}
Date:     {{lease_start_date}}$body$,
   NULL, true, false,
   'D.C. Code §42-3505.01 et seq. (Rental Housing Act of 1985)',
   'https://code.dccouncil.gov/us/dc/council/code/titles/42/chapters/35/',
   'statute_derived', true)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body,
  citation = EXCLUDED.citation, source_url = EXCLUDED.source_url,
  is_active = true, legal_review_status = EXCLUDED.legal_review_status;

-- ── VIRGINIA: Move-In Inspection Report ────────────────────────
-- Va. Code §55.1-1214: mandatory within 5 business days of commencement.
INSERT INTO public.lease_addenda_library
  (slug, title, jurisdiction, applies_when, body, attached_pdf_path,
   signature_required, initials_required, citation, source_url,
   legal_review_status, is_active)
VALUES
  ('va/move-in-inspection',
   'Virginia Move-In Inspection Report (Va. Code §55.1-1214)',
   'VA',
   '{}'::jsonb,
   $body$VIRGINIA MOVE-IN INSPECTION REPORT

Pursuant to Va. Code §55.1-1214, this inspection report documents the condition of the rental unit at the commencement of the tenancy. Landlord shall conduct this inspection within 5 business days of the beginning of the lease term. Tenant may be present.

Property: {{property_address}}
Tenant:   {{tenant_full_name}}
Inspection Date: ______________________ (must be within 5 business days of {{lease_start_date}})

CONDITION RATINGS: E = Excellent | G = Good | F = Fair | P = Poor | N/A = Not Applicable

LIVING AREAS
  Walls: ____  Floors: ____  Ceiling: ____  Windows: ____  Blinds/Curtains: ____
  Doors/Locks: ____  Light Fixtures: ____
  Notes: _______________________________________________

KITCHEN
  Walls: ____  Floors: ____  Ceiling: ____
  Refrigerator: ____  Stove/Range: ____  Oven: ____  Dishwasher: ____
  Microwave: ____  Cabinets: ____  Countertops: ____  Sink/Faucet: ____
  Notes: _______________________________________________

BATHROOM(S)
  Walls: ____  Floors: ____  Ceiling: ____
  Toilet: ____  Tub/Shower: ____  Sink: ____  Vanity: ____  Exhaust Fan: ____
  Notes: _______________________________________________

BEDROOM(S)
  Walls: ____  Floors: ____  Ceiling: ____  Windows: ____  Closets: ____
  Notes: _______________________________________________

UTILITY SYSTEMS
  Heating/HVAC: ____  A/C: ____  Water Heater: ____
  Electrical Panel: ____  Smoke Detectors: ____  CO Detectors: ____
  Notes: _______________________________________________

EXTERIOR / OTHER
  Entry/Porch: ____  Garage/Parking: ____  Yard/Landscaping: ____
  Notes: _______________________________________________

ITEMS INCLUDED WITH UNIT
  Keys provided: _____  Garage remotes: _____  Mailbox key: _____
  Other items: _______________________________________________

Both parties acknowledge this report accurately reflects the condition of the Premises at the start of the tenancy.

Landlord Signature: _______________________  Date: __________
Tenant Signature:   _______________________  Date: __________$body$,
   NULL, true, false,
   'Va. Code §55.1-1214 (Virginia Residential Landlord and Tenant Act)',
   'https://law.lis.virginia.gov/vacode/title55.1/chapter12/',
   'statute_derived', true)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body,
  citation = EXCLUDED.citation, source_url = EXCLUDED.source_url,
  is_active = true, legal_review_status = EXCLUDED.legal_review_status;

-- ── KENTUCKY: Move-In Condition Report ─────────────────────────
-- KRS §383.580: written move-in checklist mandatory.
INSERT INTO public.lease_addenda_library
  (slug, title, jurisdiction, applies_when, body, attached_pdf_path,
   signature_required, initials_required, citation, source_url,
   legal_review_status, is_active)
VALUES
  ('ky/move-in-checklist',
   'Kentucky Move-In Condition Report (KRS §383.580)',
   'KY',
   '{}'::jsonb,
   $body$KENTUCKY MOVE-IN CONDITION REPORT

Pursuant to KRS §383.580, Landlord shall provide Tenant with a written statement describing the condition of the Premises at the commencement of the tenancy. Both parties shall sign and date this report, which will be used to determine deductions from the security deposit at move-out.

Property: {{property_address}}
Tenant:   {{tenant_full_name}}
Move-In Date: {{lease_start_date}}

CONDITION RATINGS: G = Good | F = Fair | P = Poor | N/A = Not Applicable

LIVING ROOM/DINING ROOM
  Walls: ____  Floors: ____  Ceiling: ____  Windows: ____  Doors: ____
  Notes: _______________________________________________

KITCHEN
  Walls: ____  Floors: ____  Ceiling: ____
  Refrigerator: ____  Stove: ____  Dishwasher: ____  Sink: ____  Cabinets: ____
  Notes: _______________________________________________

BATHROOM(S)
  Walls: ____  Floors: ____  Ceiling: ____  Toilet: ____  Tub/Shower: ____  Sink: ____
  Notes: _______________________________________________

BEDROOM(S)
  Walls: ____  Floors: ____  Ceiling: ____  Windows: ____  Closet: ____
  Notes: _______________________________________________

SYSTEMS
  Heating: ____  A/C: ____  Plumbing: ____  Electrical: ____
  Smoke/CO Detectors: ____
  Notes: _______________________________________________

KEYS: Number provided: _______

Landlord Signature: _______________________  Date: __________
Tenant Signature:   _______________________  Date: __________$body$,
   NULL, true, false,
   'KRS §383.580 (Kentucky Uniform Residential Landlord and Tenant Act)',
   'https://apps.legislature.ky.gov/law/statutes/chapter.aspx?id=38862',
   'statute_derived', true)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body,
  citation = EXCLUDED.citation, source_url = EXCLUDED.source_url,
  is_active = true, legal_review_status = EXCLUDED.legal_review_status;

-- ── TENNESSEE: Move-In Inventory Addendum ──────────────────────
-- Tenn. Code §66-28-301: written itemized inventory required.
INSERT INTO public.lease_addenda_library
  (slug, title, jurisdiction, applies_when, body, attached_pdf_path,
   signature_required, initials_required, citation, source_url,
   legal_review_status, is_active)
VALUES
  ('tn/move-in-inventory',
   'Tennessee Move-In Inventory and Condition Report (Tenn. Code §66-28-301)',
   'TN',
   '{}'::jsonb,
   $body$TENNESSEE MOVE-IN INVENTORY AND CONDITION REPORT

Pursuant to Tenn. Code §66-28-301, Landlord shall provide Tenant with a written itemized inventory describing the condition and any defects or damages of the Premises at the commencement of the tenancy. Both parties shall sign and date this inventory.

Property: {{property_address}}
Tenant:   {{tenant_full_name}}
Move-In Date: {{lease_start_date}}

INVENTORY ITEMS (check each and note condition):

STRUCTURAL / COMMON
  Walls: ( ) OK  Comments: ____________________________________
  Floors: ( ) OK  Comments: ____________________________________
  Ceilings: ( ) OK  Comments: ____________________________________
  Windows/Screens: ( ) OK  Comments: _____________________________
  Doors/Locks: ( ) OK  Comments: ________________________________
  Smoke Detectors: ( ) Working  CO Detectors: ( ) Working

KITCHEN
  Refrigerator: ( ) OK  Comments: ________________________________
  Stove/Range: ( ) OK  Comments: ________________________________
  Oven: ( ) OK  Comments: _______________________________________
  Dishwasher: ( ) OK  Comments: __________________________________
  Sink/Faucet: ( ) OK  Comments: _________________________________
  Cabinets/Counters: ( ) OK  Comments: ___________________________

BATHROOM(S)
  Toilet: ( ) OK  Comments: _____________________________________
  Tub/Shower: ( ) OK  Comments: __________________________________
  Sink/Faucet: ( ) OK  Comments: ________________________________
  Exhaust Fan: ( ) OK  Comments: _________________________________

BEDROOMS (list each by number)
  Bedroom 1: Walls ( ) OK  Floors ( ) OK  Closet ( ) OK  Comments: __________
  Bedroom 2: Walls ( ) OK  Floors ( ) OK  Closet ( ) OK  Comments: __________
  Bedroom 3: Walls ( ) OK  Floors ( ) OK  Closet ( ) OK  Comments: __________

UTILITIES / SYSTEMS
  Heating: ( ) OK  A/C: ( ) OK  Water Heater: ( ) OK  Electrical: ( ) OK

EXTERIOR
  Entry/Porch: ( ) OK  Garage/Parking: ( ) OK  Yard: ( ) OK
  Comments: _______________________________________________

KEYS PROVIDED: ____  Garage Openers: ____  Other: ________________

Both parties agree this inventory accurately reflects the condition and contents of the Premises at the start of the tenancy and will be referenced to assess damages at move-out.

Landlord Signature: _______________________  Date: __________
Tenant Signature:   _______________________  Date: __________$body$,
   NULL, true, false,
   'Tenn. Code §66-28-301 (Uniform Residential Landlord and Tenant Act)',
   'https://www.tn.gov/commerce/regboards/landlord-tenant-act.html',
   'statute_derived', true)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body,
  citation = EXCLUDED.citation, source_url = EXCLUDED.source_url,
  is_active = true, legal_review_status = EXCLUDED.legal_review_status;

-- ── WISCONSIN: Check-In / Check-Out Report ─────────────────────
-- Wis. Stat. §704.085; Wis. Admin. Code ATCP §134.06.
INSERT INTO public.lease_addenda_library
  (slug, title, jurisdiction, applies_when, body, attached_pdf_path,
   signature_required, initials_required, citation, source_url,
   legal_review_status, is_active)
VALUES
  ('wi/check-in-report',
   'Wisconsin Check-In / Check-Out Condition Report (Wis. Stat. §704.085)',
   'WI',
   '{}'::jsonb,
   $body$WISCONSIN CHECK-IN / CHECK-OUT CONDITION REPORT

Pursuant to Wis. Stat. §704.085 and Wis. Admin. Code ATCP §134.06, Landlord must provide Tenant with a check-in report within 7 days of commencement of the tenancy. Tenant has 7 days from receipt to add comments.

Property: {{property_address}}
Tenant:   {{tenant_full_name}}

─── MOVE-IN SECTION ────────────────────────────────────────────

Move-In Date: {{lease_start_date}}
Report Provided by Landlord: _______________________ Date: _____

Condition at Check-In (E = Excellent, G = Good, F = Fair, P = Poor, NA = N/A):

LIVING AREAS: Walls___ Floors___ Ceiling___ Windows___ Doors___ Fixtures___
KITCHEN: Walls___ Floors___ Fridge___ Stove___ Dishwasher___ Sink___ Cabinets___
BATHROOM(S): Walls___ Floors___ Toilet___ Tub/Shower___ Sink___ Fan___
BEDROOM(S): Walls___ Floors___ Windows___ Closets___ Doors___
SYSTEMS: Heating___ A/C___ Plumbing___ Electrical___ Smoke Detect.___
EXTERIOR: Entry___ Garage___ Yard___

CHECK-IN NOTES (Landlord): ______________________________________________

TENANT'S RESPONSE (within 7 days of receipt):
Tenant agrees with the above report: ( ) Yes  ( ) No
Tenant's additional comments: __________________________________________

Landlord Signature: _______________________  Date: __________
Date Report Delivered to Tenant: ________________
Tenant Signature (Move-In): _________________  Date: __________

─── MOVE-OUT SECTION ───────────────────────────────────────────

Move-Out Date: _______________________

Condition at Check-Out (E = Excellent, G = Good, F = Fair, P = Poor, NA = N/A):

LIVING AREAS: Walls___ Floors___ Ceiling___ Windows___ Doors___ Fixtures___
KITCHEN: Walls___ Floors___ Fridge___ Stove___ Dishwasher___ Sink___ Cabinets___
BATHROOM(S): Walls___ Floors___ Toilet___ Tub/Shower___ Sink___ Fan___
BEDROOM(S): Walls___ Floors___ Windows___ Closets___ Doors___
SYSTEMS: Heating___ A/C___ Plumbing___ Electrical___ Smoke Detect.___
EXTERIOR: Entry___ Garage___ Yard___

CHECK-OUT NOTES AND ITEMIZED DAMAGE CLAIM (Landlord):
_______________________________________________

KEYS RETURNED: ____  Garage Openers: ____

Landlord Signature (Move-Out): _____________  Date: __________
Tenant Signature (Move-Out): _______________  Date: __________$body$,
   NULL, true, false,
   'Wis. Stat. §704.085; Wis. Admin. Code ATCP §134.06',
   'https://docs.legis.wisconsin.gov/statutes/statutes/704/085',
   'statute_derived', true)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body,
  citation = EXCLUDED.citation, source_url = EXCLUDED.source_url,
  is_active = true, legal_review_status = EXCLUDED.legal_review_status;

-- ── COLORADO: Late Fee Disclosure (HB21-1173) ──────────────────
-- C.R.S. §38-12-105: fee = greater of $50 or 5%; no fee until 7 days late.
INSERT INTO public.lease_addenda_library
  (slug, title, jurisdiction, applies_when, body, attached_pdf_path,
   signature_required, initials_required, citation, source_url,
   legal_review_status, is_active)
VALUES
  ('co/late-fee-disclosure',
   'Colorado Late Fee Disclosure (HB21-1173 / C.R.S. §38-12-105)',
   'CO',
   '{}'::jsonb,
   $body$COLORADO LATE FEE DISCLOSURE

Pursuant to Colorado HB21-1173 (2021), codified at C.R.S. §38-12-105, the following late fee rules apply to this lease:

LATE FEE RULES

  1. NO LATE FEE DURING GRACE PERIOD: Landlord may not charge a late fee until rent is 7 or more calendar days past due.
  2. LATE FEE CAP: The maximum late fee is the GREATER of:
       (a) $50.00, or
       (b) 5% of the overdue rent amount.
  3. SINGLE FEE: Only one late fee may be charged per late payment period. No compounding or daily accumulation beyond the statutory cap is permitted.
  4. TRANSPARENCY: This disclosure is provided at or before the signing of this lease to ensure Tenant is aware of these statutory protections.

LATE FEE UNDER THIS LEASE

  Monthly Rent: ${{monthly_rent}}
  Grace Period: 7 days from due date
  Late Fee (if applicable): ${{late_fee_flat}} (Landlord certifies this is ≥ $50 or ≥ 5% of overdue rent as required by law)

Tenant acknowledges receipt of this disclosure.

Property: {{property_address}}
Tenant:   {{tenant_full_name}}
Date:     {{lease_start_date}}$body$,
   NULL, true, false,
   'C.R.S. §38-12-105; HB21-1173 (Colorado, effective 2021)',
   'https://leg.colorado.gov/sites/default/files/2021a_173_signed.pdf',
   'statute_derived', true)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body,
  citation = EXCLUDED.citation, source_url = EXCLUDED.source_url,
  is_active = true, legal_review_status = EXCLUDED.legal_review_status;

-- ── ALASKA: Deposit Special Rules Disclosure ───────────────────
-- AS 34.03.070: cap waived if monthly rent > $2,000; return 14/30 days.
INSERT INTO public.lease_addenda_library
  (slug, title, jurisdiction, applies_when, body, attached_pdf_path,
   signature_required, initials_required, citation, source_url,
   legal_review_status, is_active)
VALUES
  ('ak/deposit-disclosure',
   'Alaska Security Deposit Rules Disclosure (AS 34.03.070)',
   'AK',
   '{}'::jsonb,
   $body$ALASKA SECURITY DEPOSIT RULES DISCLOSURE

Pursuant to AS 34.03.070, the following rules apply to the security deposit for this tenancy:

DEPOSIT CAP

  • If monthly rent is $2,000.00 or LESS: maximum security deposit is TWO (2) months' rent.
  • If monthly rent EXCEEDS $2,000.00: there is NO statutory cap on the security deposit.
  • Monthly Rent under this Lease: ${{monthly_rent}}
  • Security Deposit Amount: ${{security_deposit}}

RETURN TIMELINE

  • If NO deductions are taken: deposit must be returned within 14 days of Tenant's move-out.
  • If itemized deductions ARE claimed: deposit (or remaining balance) must be returned within 30 days, accompanied by a written itemized statement.

SEPARATE ACCOUNT

  Landlord shall hold the security deposit in a separate bank account, per AS 34.03.070(d). Landlord shall provide the account details in writing upon Tenant's request.

DEDUCTIONS

  Allowable deductions include unpaid rent, damages beyond ordinary wear and tear, and other charges expressly authorized by the lease or by statute.

Property: {{property_address}}
Tenant:   {{tenant_full_name}}
Date:     {{lease_start_date}}$body$,
   NULL, true, false,
   'AS 34.03.070 (Alaska Uniform Residential Landlord and Tenant Act)',
   'https://www.akleg.gov/basis/statutes.asp#34.03.070',
   'statute_derived', true)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body,
  citation = EXCLUDED.citation, source_url = EXCLUDED.source_url,
  is_active = true, legal_review_status = EXCLUDED.legal_review_status;

-- ── NEVADA: Deposit Cap Disclosure ─────────────────────────────
-- NRS §118A.242: cap 3× monthly rent; 30-day return.
INSERT INTO public.lease_addenda_library
  (slug, title, jurisdiction, applies_when, body, attached_pdf_path,
   signature_required, initials_required, citation, source_url,
   legal_review_status, is_active)
VALUES
  ('nv/deposit-cap',
   'Nevada Security Deposit Cap Disclosure (NRS §118A.242)',
   'NV',
   '{}'::jsonb,
   $body$NEVADA SECURITY DEPOSIT CAP DISCLOSURE

Pursuant to NRS §118A.242, Landlord discloses the following regarding the security deposit:

DEPOSIT CAP

  • Maximum allowable security deposit: THREE (3) months' rent.
  • Monthly Rent under this Lease: ${{monthly_rent}}
  • Maximum Allowable Deposit: ${{monthly_rent}} × 3 = [calculated at signing]
  • Security Deposit Collected: ${{security_deposit}}

RETURN TIMELINE

  • Landlord must return the security deposit within 30 days of the termination of the lease or Tenant's surrender of the premises, whichever is later.
  • An itemized written statement of deductions must accompany any partial return.

ALLOWABLE DEDUCTIONS

  Landlord may deduct for: unpaid rent; damages beyond ordinary wear and tear; costs of cleaning required to restore the unit to its condition at the commencement of the tenancy; and other charges expressly authorized by the lease.

Tenant acknowledges receipt of this disclosure.

Property: {{property_address}}
Tenant:   {{tenant_full_name}}
Date:     {{lease_start_date}}$body$,
   NULL, true, false,
   'NRS §118A.242 (Nevada)',
   'https://www.leg.state.nv.us/nrs/NRS-118A.html',
   'statute_derived', true)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body,
  citation = EXCLUDED.citation, source_url = EXCLUDED.source_url,
  is_active = true, legal_review_status = EXCLUDED.legal_review_status;

-- ── OKLAHOMA: Written Demand for Deposit Return Notice ─────────
-- 41 O.S. §115: Tenant must provide written demand to trigger 30-day deadline.
INSERT INTO public.lease_addenda_library
  (slug, title, jurisdiction, applies_when, body, attached_pdf_path,
   signature_required, initials_required, citation, source_url,
   legal_review_status, is_active)
VALUES
  ('ok/deposit-demand-notice',
   'Oklahoma Security Deposit Written Demand Notice (41 O.S. §115)',
   'OK',
   '{}'::jsonb,
   $body$OKLAHOMA SECURITY DEPOSIT WRITTEN DEMAND NOTICE

IMPORTANT NOTICE TO TENANT

Under 41 O.S. §115, Landlord is required to return your security deposit within 30 days ONLY AFTER you provide:
  (a) A written demand for return of the deposit, AND
  (b) Your forwarding address.

If you do not provide a written demand and forwarding address, the 30-day clock does not start, and Landlord is not required to return the deposit.

HOW TO SUBMIT YOUR DEMAND

At the end of your tenancy, send a written letter to Landlord at the address below requesting return of your security deposit, and include your new mailing address.

Landlord's Address for Demands: {{landlord_address}}

This notice is provided to ensure Tenant is informed of this important procedural requirement under Oklahoma law.

Property: {{property_address}}
Tenant:   {{tenant_full_name}}
Date:     {{lease_start_date}}

Tenant acknowledges receipt and understanding of this notice.

Tenant Signature: _______________________  Date: __________$body$,
   NULL, true, false,
   '41 O.S. §115 (Oklahoma Landlord and Tenant Act)',
   'https://www.oscn.net/applications/oscn/DeliverDocument.asp?CiteID=145781',
   'statute_derived', true)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body,
  citation = EXCLUDED.citation, source_url = EXCLUDED.source_url,
  is_active = true, legal_review_status = EXCLUDED.legal_review_status;

-- ── UTAH: Nonrefundable Fee Disclosure ─────────────────────────
-- Utah Code §57-17-3(2)(b): nonrefundable portions must be disclosed.
INSERT INTO public.lease_addenda_library
  (slug, title, jurisdiction, applies_when, body, attached_pdf_path,
   signature_required, initials_required, citation, source_url,
   legal_review_status, is_active)
VALUES
  ('ut/nonrefundable-fee',
   'Utah Nonrefundable Fee Disclosure (Utah Code §57-17-3)',
   'UT',
   '{}'::jsonb,
   $body$UTAH NONREFUNDABLE FEE DISCLOSURE

Pursuant to Utah Code §57-17-3(2)(b), any portion of the security deposit designated as nonrefundable must be expressly disclosed in writing at the time of the lease signing. Unless a fee is specifically identified below as nonrefundable, Landlord may not retain it as nonrefundable.

NONREFUNDABLE FEES UNDER THIS LEASE (if any):

  [ ] Cleaning Fee: $____________ — Purpose: ____________________
  [ ] Pet Fee:      $____________ — Purpose: ____________________
  [ ] Other Fee:    $____________ — Purpose: ____________________

If no box is checked above, all deposit amounts are fully refundable (subject only to lawful deductions for unpaid rent and damages beyond ordinary wear and tear).

REFUNDABLE DEPOSIT: ${{security_deposit}}

Landlord shall return the refundable deposit within 30 days of lease termination, with an itemized written statement of any deductions, per Utah Code §57-17-3(1).

Tenant acknowledges receipt and understanding of this disclosure.

Property: {{property_address}}
Tenant:   {{tenant_full_name}}
Date:     {{lease_start_date}}

Tenant Signature: _______________________  Date: __________
Landlord Signature: _____________________  Date: __________$body$,
   NULL, true, false,
   'Utah Code §57-17-3(2)(b)',
   'https://le.utah.gov/xcode/Title57/Chapter17/57-17.html',
   'statute_derived', true)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body,
  citation = EXCLUDED.citation, source_url = EXCLUDED.source_url,
  is_active = true, legal_review_status = EXCLUDED.legal_review_status;

-- ── LOUISIANA: Notarization Notice for Long-Term Leases ────────
-- La. Civ. Code Art. 2681: leases > 1 year must be notarized to be
-- enforceable against third parties.
INSERT INTO public.lease_addenda_library
  (slug, title, jurisdiction, applies_when, body, attached_pdf_path,
   signature_required, initials_required, citation, source_url,
   legal_review_status, is_active)
VALUES
  ('la/notarization-notice',
   'Louisiana Notarization Notice for Leases Exceeding One Year',
   'LA',
   '{"lease_term_exceeds_one_year": true}'::jsonb,
   $body$LOUISIANA NOTARIZATION NOTICE

NOTICE REGARDING LEASES EXCEEDING ONE YEAR

Pursuant to Louisiana Civil Code Article 2681, a lease for a term exceeding one (1) year must be in writing AND notarized (acknowledged before a notary public) in order to be:
  • Enforceable against third parties (e.g., future property purchasers, creditors), and
  • Recorded with the parish clerk of court to provide public notice.

This lease is for a term of: {{lease_start_date}} to {{lease_end_date}}.

If this lease exceeds one year in duration, Landlord and Tenant should have their signatures acknowledged before a notary public to protect their rights against third parties.

Electronic signatures alone satisfy the written-lease requirement between the parties, but NOTARIZATION is separately required for the lease to be fully enforceable against third parties under Louisiana law.

Tenant acknowledges receipt and understanding of this notice.

Property: {{property_address}}
Tenant:   {{tenant_full_name}}
Date:     {{lease_start_date}}

Tenant Signature: _______________________  Date: __________$body$,
   NULL, true, false,
   'La. Civ. Code Art. 2681 (Louisiana Civil Code — Lease)',
   'https://www.legis.la.gov/legis/Law.aspx?d=108368',
   'statute_derived', true)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, body = EXCLUDED.body,
  citation = EXCLUDED.citation, source_url = EXCLUDED.source_url,
  is_active = true, legal_review_status = EXCLUDED.legal_review_status;

COMMIT;
