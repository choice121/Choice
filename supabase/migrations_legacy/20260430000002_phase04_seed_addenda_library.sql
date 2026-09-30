-- Lease Phase 04 — Seed addenda library (21 statute-derived templates)
  -- Federal (2) + Common multi-jurisdictional (5) + State-specific (14)
  -- All marked legal_review_status = 'statute_derived' (not yet attorney-reviewed).

  BEGIN;

  INSERT INTO public.lease_addenda_library
    (slug, title, jurisdiction, applies_when, body, attached_pdf_path, signature_required, initials_required, citation, source_url, legal_review_status, is_active)
  VALUES
    ('federal/lead-paint', 'Federal Lead-Based Paint Disclosure', 'federal', '{"property_built_before":1978}'::jsonb, 'LEAD WARNING STATEMENT

  Housing built before 1978 may contain lead-based paint. Lead from paint, paint chips, and dust can pose health hazards if not managed properly. Lead exposure is especially harmful to young children and pregnant women. Before renting pre-1978 housing, lessors must disclose the presence of known lead-based paint and/or lead-based paint hazards in the dwelling. Lessees must also receive a federally approved pamphlet on lead poisoning prevention.

  LESSOR''S DISCLOSURE (initial each statement)

  (a) Presence of lead-based paint and/or lead-based paint hazards (check (i) or (ii) below):
      (i)  ___ Known lead-based paint and/or lead-based paint hazards are present in the housing (explain).
      (ii) ___ Lessor has no knowledge of lead-based paint and/or lead-based paint hazards in the housing.

  (b) Records and reports available to the lessor (check (i) or (ii) below):
      (i)  ___ Lessor has provided the lessee with all available records and reports pertaining to lead-based paint and/or lead-based paint hazards in the housing (list documents below).
      (ii) ___ Lessor has no reports or records pertaining to lead-based paint and/or lead-based paint hazards in the housing.

  LESSEE''S ACKNOWLEDGMENT (initial each statement)

  (c) ___ Lessee has received copies of all information listed above.
  (d) ___ Lessee has received the pamphlet "Protect Your Family from Lead in Your Home" (EPA, HUD, and CPSC, 2020 ed.).

  AGENT''S ACKNOWLEDGMENT (initial)

  (e) ___ Agent has informed the lessor of the lessor''s obligations under 42 U.S.C. §4852d and is aware of his/her responsibility to ensure compliance.

  CERTIFICATION OF ACCURACY

  The following parties have reviewed the information above and certify, to the best of their knowledge, that the information they have provided is true and accurate.

  Property: {{property_address}}
  Tenant:   {{tenant_full_name}}
  Date:     {{lease_start_date}}', 'assets/legal/epa-lead-pamphlet-2020.pdf', true, true, '42 U.S.C. §4852d; 24 C.F.R. Part 35 Subpart H; 40 C.F.R. Part 745 Subpart F', 'https://www.epa.gov/lead/real-estate-disclosure', 'statute_derived', true),
  ('federal/megans-law', 'Sex Offender Registry Notification', 'federal', '{}'::jsonb, 'SEX OFFENDER REGISTRY NOTIFICATION

  Notice: Pursuant to federal law and applicable state law, information about specified registered sex offenders is made available to the public via the National Sex Offender Public Website maintained by the United States Department of Justice at https://www.nsopw.gov/. Depending on the offender''s criminal history, this information will include the offender''s name, address, date of birth, photograph, and crime of conviction. Many states maintain their own searchable registries in addition to the federal site. Tenant is encouraged to obtain information about registered sex offenders before signing this lease.

  The Landlord makes NO representation or warranty about the presence or absence of registered sex offenders in the vicinity of the property. Tenant acknowledges receipt of this notice.

  Property: {{property_address}}
  Tenant:   {{tenant_full_name}}', NULL, true, false, '34 U.S.C. §20901 et seq. (Sex Offender Registration and Notification Act, formerly 42 U.S.C. §14071); state Megan''s Law statutes', 'https://www.nsopw.gov/', 'statute_derived', true),
  ('common/mold', 'Mold Disclosure & Tenant Acknowledgment', 'common', '{}'::jsonb, 'MOLD DISCLOSURE AND TENANT ACKNOWLEDGMENT

  Mold spores are present everywhere in the environment and can grow on virtually any surface where moisture is present. To minimize the potential for mold growth, Tenant agrees to:

    1. Maintain proper ventilation in the unit, including using exhaust fans in bathrooms during and after showering and in the kitchen during cooking.
    2. Promptly notify Landlord, in writing, of any of the following:
       (a) any visible evidence of mold or mildew that Tenant cannot remove with a household cleaner;
       (b) any water leak, water damage, condensation, or excessive humidity;
       (c) any malfunction of HVAC, plumbing, or appliances that may contribute to moisture problems.
    3. Keep the unit clean and free from accumulations of dirt, garbage, or organic matter that can support mold growth.
    4. Avoid blocking HVAC vents and cold air returns.

  Landlord, to the best of Landlord''s knowledge, is not aware of any current mold problem at the property as of the lease commencement date. Tenant acknowledges that Landlord cannot guarantee a mold-free environment and that Tenant''s compliance with the above is essential to mold prevention.

  Property: {{property_address}}
  Tenant:   {{tenant_full_name}}', NULL, true, false, 'Industry-standard disclosure; CA Civ. §1941.7, FL Stat. §83.51, and similar implied warranty-of-habitability obligations', 'https://www.epa.gov/mold', 'statute_derived', true),
  ('common/bedbug', 'Bedbug Disclosure', 'common', '{}'::jsonb, 'BEDBUG DISCLOSURE

  Bedbugs (Cimex lectularius) are nocturnal insects that feed on human blood. They do not transmit disease but their bites can cause allergic reactions and significant disruption.

  LANDLORD''S DISCLOSURE
  Landlord, to the best of Landlord''s knowledge, represents that as of the lease commencement date the unit is free of bedbug infestation, and:
    ( ) The premises has no known history of bedbug infestation.
    ( ) The premises was treated for bedbugs on (date) ___________ by (vendor) ___________ and has been clear since.

  TENANT''S OBLIGATIONS
  Tenant agrees to:
    1. Inspect any used furniture, mattresses, or bedding before bringing them into the unit.
    2. Promptly notify Landlord, in writing, of any signs of bedbugs (live insects, blood spots on linens, dark fecal spots, shed skins, or unexplained bites).
    3. Cooperate fully with any Landlord-arranged inspection or pest-control treatment, including preparing the unit per the pest-control vendor''s instructions.

  Property: {{property_address}}
  Tenant:   {{tenant_full_name}}', NULL, true, false, 'NY MDL §27-2018.1, CA Civ. §1954.603, AZ R.S. §33-1319, ME 14 §6021-A and similar', 'https://www.epa.gov/bedbugs', 'statute_derived', true),
  ('common/smoke-co', 'Smoke & Carbon Monoxide Detector Acknowledgment', 'common', '{}'::jsonb, 'SMOKE AND CARBON MONOXIDE DETECTOR ACKNOWLEDGMENT

  Tenant acknowledges that, on the date of move-in, the rental unit is equipped with operational smoke detector(s) and (if the unit contains a fuel-burning appliance, attached garage, or shares a wall/floor/ceiling with such) carbon monoxide detector(s), all in proper working order.

  TENANT''S RESPONSIBILITIES
    1. Test each detector at least monthly using the test button.
    2. Replace batteries as needed (Tenant''s expense unless detector is hardwired).
    3. NEVER disable, remove, or tamper with any detector.
    4. Promptly notify Landlord, in writing, of any malfunctioning detector so it can be repaired or replaced.

  Failure to maintain operational detectors may constitute a material breach of this lease and may also violate local fire and building codes.

  Property: {{property_address}}
  Tenant:   {{tenant_full_name}}', NULL, true, false, 'State and local building codes; NFPA 72; CO alarm statutes (most states)', 'https://www.usfa.fema.gov/prevention/home-fires/install-test-smoke-alarms/', 'statute_derived', true),
  ('common/move-in-inventory', 'Move-In Inventory & Condition Form', 'common', '{"state_requires_move_in_inventory":true}'::jsonb, 'MOVE-IN INVENTORY AND CONDITION FORM

  Within five (5) days of taking possession, Tenant shall complete a written inventory and condition checklist documenting the condition of each room and any pre-existing damage, and return a signed copy to Landlord. The completed checklist will be used at move-out to determine which (if any) damages are chargeable to Tenant.

  Tenant is strongly encouraged to:
    1. Photograph or video-record all rooms, fixtures, appliances, walls, floors, and any pre-existing damage at move-in.
    2. Time-stamp all photos/videos.
    3. Retain copies independently of Landlord.

  Failure to submit the inventory within five (5) days creates a presumption that the unit was delivered in good, clean, and undamaged condition.

  (NOTE: Phase 08 of this system will provide an in-app photo inventory workflow.)

  Property: {{property_address}}
  Tenant:   {{tenant_full_name}}', NULL, true, false, 'CA Civ. §1950.5(f), GA O.C.G.A. §44-7-33, KY KRS §383.580, MD RP §8-203.1, MA Ch.186 §15B, NH RSA 540-A:6, NJ A.3956, VA §55.1-1214, WA RCW 59.18.260', 'https://www.hud.gov/topics/rental_assistance/tenantrights', 'statute_derived', true),
  ('common/pet-addendum', 'Pet Addendum', 'common', '{"requires_pets":true}'::jsonb, 'PET ADDENDUM

  This Pet Addendum supplements the Lease and applies only if Tenant keeps a pet on the premises with Landlord''s written consent. Service and emotional-support animals are NOT pets and are governed by the federal Fair Housing Act, not by this addendum.

  PERMITTED PET(S) (filled in at signing if applicable):
    Type / Breed / Weight / Name: ____________________________

  TENANT''S OBLIGATIONS
    1. Pay any pet deposit and/or monthly pet rent set forth in the Lease.
    2. Keep the pet under control at all times. Dogs must be on a leash in all common areas.
    3. Promptly remove and dispose of all pet waste from the property and common areas.
    4. Prevent excessive noise, odors, or damage caused by the pet.
    5. Carry renter''s insurance with liability coverage that includes the pet, where required by Landlord.
    6. Be solely liable for any injury or damage caused by the pet to persons or property.

  VIOLATIONS
  Repeated complaints, evidence of damage beyond normal wear, or any aggressive behavior may result in Landlord''s revocation of pet permission and/or termination of the Lease.

  Property: {{property_address}}
  Tenant:   {{tenant_full_name}}', NULL, true, false, 'Contractual addendum; subject to Fair Housing Act protections for assistance animals (42 U.S.C. §3604(f)(3)(B); 24 C.F.R. §100.204)', 'https://www.hud.gov/program_offices/fair_housing_equal_opp/assistance_animals', 'statute_derived', true),
  ('ca/bedbug', 'California Bedbug Disclosure', 'CA', '{}'::jsonb, 'CALIFORNIA BEDBUG DISCLOSURE (Civ. Code §1954.603)

  INFORMATION ABOUT BEDBUGS

  Bedbug Appearance: Bedbugs have six legs. Adult bedbugs have flat bodies about 1/4 of an inch in length. Their color can vary from red and brown to copper colored. Young bedbugs are very small. Their bodies are about 1/16 of an inch in length. They have almost no color. When a bedbug feeds, its body swells, may lengthen, and becomes bright red, sometimes making it appear to be a different insect. Bedbugs do not fly. They can either crawl or be carried from place to place on objects, people, or animals. Bedbugs can be hard to find and identify because they are tiny and try to stay hidden.

  Life Cycle and Reproduction: An average bedbug lives for about 10-11 months. Female bedbugs lay one to five eggs per day and 200 to 500 eggs per lifetime. Eggs hatch in about 10 days. Bedbugs grow to full adulthood in about 21 days.

  Bedbug Bites: Bedbugs feed on human blood. They are usually active during nighttime and bite people while they are sleeping. The bites are painless. Their saliva can cause an allergic reaction in some people, with itching and red welts.

  Common Signs and Symptoms of a Possible Bedbug Infestation:
    - Small red to reddish brown fecal spots on mattresses, box springs, bed frames, mattresses, linens, upholstery, or walls.
    - Molted bedbug skins, white sticky eggs, or empty eggshells.
    - Very heavily infested areas may have a characteristically sweet odor.
    - Red, itchy bite marks, especially on the legs, arms, and other body parts exposed while sleeping.

  For more information, contact your local health department or the California Department of Public Health.

  PROHIBITION ON RETALIATION: Civ. Code §1942.5 prohibits retaliation by a landlord against a tenant for reporting a bedbug infestation.

  DISCLOSURE OF INFESTATION HISTORY:
  A landlord shall not show, rent, or lease to a prospective tenant any vacant dwelling unit that the landlord knows has a current bedbug infestation. Landlord, to the best of Landlord''s knowledge, certifies that the unit is free of any current bedbug infestation as of the lease commencement date.

  Property: {{property_address}}
  Tenant:   {{tenant_full_name}}', NULL, true, false, 'Cal. Civ. Code §1954.603', 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1954.603&lawCode=CIV', 'statute_derived', true),
  ('ca/megans-law', 'California Megan''s Law Notice', 'CA', '{}'::jsonb, 'CALIFORNIA MEGAN''S LAW NOTICE (Civ. Code §2079.10a)

  Notice: Pursuant to Section 290.46 of the Penal Code, information about specified registered sex offenders is made available to the public via an Internet Web site maintained by the Department of Justice at www.meganslaw.ca.gov. Depending on an offender''s criminal history, this information will include either the address at which the offender resides or the community of residence and ZIP Code in which he or she resides.

  Property: {{property_address}}
  Tenant:   {{tenant_full_name}}', NULL, true, false, 'Cal. Civ. Code §2079.10a', 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=2079.10A&lawCode=CIV', 'statute_derived', true),
  ('ca/flood', 'California Flood Hazard Disclosure', 'CA', '{}'::jsonb, 'CALIFORNIA FLOOD HAZARD DISCLOSURE (Gov. Code §8589.45)

  Landlord hereby notifies Tenant that the property may be located in (check any that apply, to the best of Landlord''s actual knowledge):

    ( ) A FEMA-designated Special Flood Hazard Area (Zone "A" or "V");
    ( ) An area of potential flooding shown on a dam-failure inundation map pursuant to Gov. Code §8589.5.

  If neither box is checked, Landlord has no actual knowledge that the property is located in such an area, but Landlord makes no warranty and Tenant is encouraged to consult FEMA''s flood map service center at https://msc.fema.gov/ before signing.

  ADVISEMENTS:
    1. The Landlord''s insurance does NOT cover the loss of Tenant''s personal property due to flood.
    2. Tenant is advised to obtain renter''s insurance and a separate flood insurance policy from the National Flood Insurance Program (https://www.floodsmart.gov/) or a private carrier.
    3. Even one inch of floodwater can cause more than $25,000 in damage.

  Property: {{property_address}}
  Tenant:   {{tenant_full_name}}', NULL, true, false, 'Cal. Gov. Code §8589.45 (AB 1747, effective July 1, 2018)', 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=8589.45&lawCode=GOV', 'statute_derived', true),
  ('fl/radon', 'Florida Radon Gas Disclosure', 'FL', '{}'::jsonb, 'FLORIDA RADON GAS DISCLOSURE (F.S. §404.056(5))

  RADON GAS: Radon is a naturally occurring radioactive gas that, when it has accumulated in a building in sufficient quantities, may present health risks to persons who are exposed to it over time. Levels of radon that exceed federal and state guidelines have been found in buildings in Florida. Additional information regarding radon and radon testing may be obtained from your county health department.

  Property: {{property_address}}
  Tenant:   {{tenant_full_name}}', NULL, true, false, 'Fla. Stat. §404.056(5)', 'http://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&Search_String=&URL=0400-0499/0404/Sections/0404.056.html', 'statute_derived', true),
  ('fl/security-deposit-bank', 'Florida Security Deposit Bank Notice', 'FL', '{}'::jsonb, 'FLORIDA SECURITY DEPOSIT NOTICE (F.S. §83.49(2)–(3))

  YOUR LEASE REQUIRES PAYMENT OF CERTAIN DEPOSITS. THE LANDLORD MAY TRANSFER ADVANCE RENTS TO THE LANDLORD''S ACCOUNT AS THEY ARE DUE AND WITHOUT NOTICE. WHEN YOU MOVE OUT, YOU MUST GIVE THE LANDLORD YOUR NEW ADDRESS SO THAT THE LANDLORD CAN SEND YOU NOTICES REGARDING YOUR DEPOSIT. THE LANDLORD MUST MAIL YOU NOTICE, WITHIN 30 DAYS AFTER YOU MOVE OUT, OF THE LANDLORD''S INTENT TO IMPOSE A CLAIM AGAINST THE DEPOSIT. IF YOU DO NOT REPLY TO THE LANDLORD STATING YOUR OBJECTION TO THE CLAIM WITHIN 15 DAYS AFTER RECEIPT OF THE LANDLORD''S NOTICE, THE LANDLORD WILL COLLECT THE CLAIM AND MUST MAIL YOU THE REMAINING DEPOSIT, IF ANY.

  IF THE LANDLORD FAILS TO TIMELY MAIL YOU NOTICE, THE LANDLORD MUST RETURN THE DEPOSIT BUT MAY LATER FILE A LAWSUIT AGAINST YOU FOR DAMAGES. IF YOU FAIL TO TIMELY OBJECT TO A CLAIM, THE LANDLORD MAY COLLECT FROM THE DEPOSIT, BUT YOU MAY LATER FILE A LAWSUIT CLAIMING A REFUND.

  YOU SHOULD ATTEMPT TO INFORMALLY RESOLVE ANY DISPUTE BEFORE FILING A LAWSUIT. GENERALLY, THE PARTY IN WHOSE FAVOR A JUDGMENT IS RENDERED WILL BE AWARDED COSTS AND ATTORNEY FEES PAYABLE BY THE LOSING PARTY.

  THIS DISCLOSURE IS BASIC. PLEASE REFER TO PART II OF CHAPTER 83, FLORIDA STATUTES, TO DETERMINE YOUR LEGAL RIGHTS AND OBLIGATIONS.

  DEPOSIT HOLDING:
  Landlord shall hold Tenant''s security deposit in (check one):
    ( ) A separate non-interest-bearing account in a Florida banking institution;
    ( ) A separate interest-bearing account in a Florida banking institution (Tenant entitled to 75% of interest or 5% per annum simple, at Landlord''s election);
    ( ) Posting of a surety bond with the clerk of the circuit court (Landlord pays Tenant 5% per annum simple interest).

  Bank / location: ______________________________

  Property: {{property_address}}
  Tenant:   {{tenant_full_name}}', NULL, true, false, 'Fla. Stat. §83.49(2)–(3)', 'http://www.leg.state.fl.us/Statutes/index.cfm?App_mode=Display_Statute&URL=0000-0099/0083/Sections/0083.49.html', 'statute_derived', true),
  ('ny/window-guard', 'NYC Window Guard Notice', 'NY', '{}'::jsonb, 'NEW YORK CITY WINDOW GUARD NOTICE

  WINDOW GUARDS REQUIRED

  LEASE NOTICE TO TENANT

  You are required by law to have window guards installed if a child 10 years of age or younger lives in your apartment.

  Your landlord is required by law to install window guards in your apartment:
    - if a child 10 years of age or younger lives in your apartment, OR
    - if you ask the landlord to install window guards at any time (you need not give a reason).

  It is a violation of law to refuse, interfere with installation, or remove window guards where required.

  CHECK ONE:
    ( ) CHILDREN 10 YEARS OF AGE OR YOUNGER LIVE IN MY APARTMENT.
    ( ) NO CHILDREN 10 YEARS OF AGE OR YOUNGER LIVE IN MY APARTMENT.
    ( ) I WANT WINDOW GUARDS EVEN THOUGH I HAVE NO CHILDREN 10 YEARS OF AGE OR YOUNGER.

  For further information, call the New York City Department of Health and Mental Hygiene Window Falls Prevention Program at 311 or visit nyc.gov/health.

  Property: {{property_address}}
  Tenant:   {{tenant_full_name}}', NULL, true, false, 'NYC Health Code §131.15; 24 RCNY §12-10', 'https://www.nyc.gov/site/doh/health/health-topics/window-falls.page', 'statute_derived', true),
  ('ny/lead-pamphlet', 'NYC Lead-Based Paint Hazard Notice', 'NY', '{"property_built_before":1960}'::jsonb, 'NEW YORK CITY LEAD-BASED PAINT HAZARD NOTICE (Local Law 1 of 2004)

  If a child of applicable age (under six years of age) resides or routinely spends 10+ hours per week in this dwelling unit, the owner is required by Local Law 1 of 2004 to inspect for and remediate lead-based paint hazards.

  NOTICE TO TENANT — Please complete and return:

    ( ) A child UNDER SIX YEARS OF AGE resides in the unit.
    ( ) NO child under six years of age resides in the unit.
    ( ) A child under six years of age routinely spends 10+ hours per week in the unit.

  I acknowledge receipt of the NYC Department of Health and Mental Hygiene pamphlet "Preventing Lead Poisoning in Children."

  Tenant must notify Landlord in writing within 60 days if a child under six begins residing in or routinely spending 10+ hours per week in the unit.

  Property: {{property_address}}
  Tenant:   {{tenant_full_name}}', NULL, true, false, 'NYC Local Law 1 of 2004 (Childhood Lead Poisoning Prevention Act); NYC Admin Code §27-2056', 'https://www.nyc.gov/site/hpd/services-and-information/lead-based-paint.page', 'statute_derived', true),
  ('ny/sprinkler', 'New York Sprinkler Disclosure', 'NY', '{}'::jsonb, 'NEW YORK SPRINKLER DISCLOSURE (RPL §231-a)

  Notice required by RPL §231-a:

    ( ) The dwelling unit IS equipped with a maintained, operative automatic sprinkler system.
        Last date of sprinkler-system maintenance / inspection: ______________
    ( ) The dwelling unit IS NOT equipped with a maintained, operative automatic sprinkler system.

  "Automatic sprinkler system" has the meaning ascribed to it by Section 155.4 of the New York State Uniform Fire Prevention and Building Code.

  Property: {{property_address}}
  Tenant:   {{tenant_full_name}}', NULL, true, false, 'N.Y. Real Property Law §231-a', 'https://www.nysenate.gov/legislation/laws/RPP/231-A', 'statute_derived', true),
  ('ny/bedbug', 'NYC Bedbug Annual Report (DHCR Form NYC-BB)', 'NY', '{}'::jsonb, 'NEW YORK CITY BEDBUG DISCLOSURE (Admin Code §27-2018.1)

  The owner of this multiple dwelling is required by law to provide each tenant signing a vacancy lease with the property''s bedbug infestation history for the previous year, in the form prescribed by the NYS Division of Housing and Community Renewal (Form NYC-BB).

  BEDBUG INFESTATION HISTORY (check one):

    ( ) During the past year, the building has experienced NO bedbug infestation history.
    ( ) During the past year, the building has experienced bedbug infestation history as follows:
          - Building floor(s) affected: ______________
          - Apartment unit(s) affected: ______________
          - Was infestation eradicated?  ( ) Yes  ( ) No

  Property: {{property_address}}
  Tenant:   {{tenant_full_name}}', NULL, true, false, 'NYC Admin Code §27-2018.1; 9 NYCRR §2173', 'https://hcr.ny.gov/system/files/documents/2021/06/nycbedbugdisclosureform.pdf', 'statute_derived', true),
  ('il/rlto', 'Chicago Residential Landlord and Tenant Ordinance Summary', 'IL', '{}'::jsonb, 'CHICAGO RESIDENTIAL LANDLORD AND TENANT ORDINANCE — REQUIRED SUMMARY

  This summary is attached pursuant to Chicago Municipal Code §5-12-170. It applies if the rental unit is located within the City of Chicago.

  WHAT THE LANDLORD MUST DO:
    - Comply with all building, housing, health, and safety codes.
    - Maintain the unit in a fit and habitable condition.
    - Make all necessary repairs.
    - Provide the tenant a written receipt for security deposits and pay 0.01%–0.06% interest annually depending on the year.
    - Hold security deposits in a federally insured Illinois account separate from the landlord''s assets.
    - Return the security deposit (or itemize damages) within 45 days of move-out.
    - Provide a written notice and 30 days to remedy before terminating for non-rent breaches.

  WHAT THE TENANT MUST DO:
    - Pay rent and any utility bills on time.
    - Keep the unit safe and clean.
    - Use all electrical, plumbing, sanitary, heating, ventilating, air-conditioning, and other facilities and appliances reasonably.
    - Promptly notify the landlord of defects.
    - Refrain from disturbing other tenants.

  TENANT REMEDIES (selected): If the landlord fails to maintain the unit, the tenant may, after proper written notice, withhold rent in proportion to the diminished value of the unit, or repair-and-deduct (limited to lesser of $500 or one-half of monthly rent), or terminate the lease.

  THE FULL ORDINANCE IS AVAILABLE AT THE CITY OF CHICAGO DEPARTMENT OF HOUSING AND ON THE CHICAGO MUNICIPAL CODE WEBSITE.

  Property: {{property_address}}
  Tenant:   {{tenant_full_name}}', NULL, true, false, 'Chicago Municipal Code §5-12 (RLTO); §5-12-170 (summary attachment requirement)', 'https://www.chicago.gov/city/en/depts/doh/provdrs/landlords/svcs/rlto.html', 'statute_derived', true),
  ('tx/parking', 'Texas Parking & Towing Rules', 'TX', '{}'::jsonb, 'TEXAS PARKING AND TOWING RULES (Prop. Code §92.0131)

  This addendum sets forth the parking and towing rules applicable to the leased premises.

  PARKING RULES:
    1. Tenant is assigned (or permitted) parking space(s): ______________
    2. Each vehicle on the property must be currently registered, insured, and operable.
    3. No commercial vehicles, recreational vehicles, trailers, or boats may be parked on the property without Landlord''s prior written consent.
    4. Vehicle repair (other than minor maintenance such as adding fluids) is prohibited on the property.

  TOWING:
    Vehicles in violation of these rules, or parked in unauthorized areas (fire lanes, no-parking zones, other tenants'' assigned spaces, etc.), may be towed at the vehicle owner''s expense without further notice in accordance with Texas Occupations Code Ch. 2308.

    Towing company designated by Landlord: ______________
    Tenant may obtain information about a towed vehicle by calling: ______________

  Property: {{property_address}}
  Tenant:   {{tenant_full_name}}', NULL, true, false, 'Tex. Prop. Code §92.0131', 'https://statutes.capitol.texas.gov/Docs/PR/htm/PR.92.htm#92.0131', 'statute_derived', true),
  ('tx/smoke-detector', 'Texas Smoke Detector Acknowledgment', 'TX', '{}'::jsonb, 'TEXAS SMOKE-ALARM DISCLOSURE (Prop. Code Subchapter F)

  CERTIFICATION: At the commencement of this Lease, Landlord certifies that the rental unit is equipped with smoke alarms in proper working condition that comply with Subchapter F of Chapter 92, Texas Property Code.

  TENANT''S RIGHTS AND DUTIES:
    1. Tenant shall not disconnect or intentionally damage a smoke alarm or remove the battery without simultaneously installing a working battery.
    2. Tenant may request, in writing, that Landlord:
         (a) Inspect a smoke alarm believed to be malfunctioning, and
         (b) Repair or replace any malfunctioning smoke alarm.
    3. Tenant may request, in writing, the installation, inspection, or repair of a smoke alarm powered by battery, AC current, or other power source as required by local ordinance.
    4. Tenant must give Landlord reasonable time to perform requested work.

  LIABILITY: A landlord who fails to install, inspect, or repair a smoke alarm as required by Subchapter F is liable to the tenant for actual damages, statutory penalties, court costs, and attorney''s fees.

  Property: {{property_address}}
  Tenant:   {{tenant_full_name}}', NULL, true, false, 'Tex. Prop. Code §92.251–§92.262', 'https://statutes.capitol.texas.gov/Docs/PR/htm/PR.92.htm#F', 'statute_derived', true),
  ('nj/truth-in-renting', 'New Jersey Truth in Renting Statement', 'NJ', '{}'::jsonb, 'NEW JERSEY TRUTH IN RENTING STATEMENT (N.J.S.A. §46:8-44 et seq.)

  Pursuant to the Truth in Renting Act, every landlord of residential property containing two or more rental units (other than owner-occupied properties of three units or fewer, or seasonal use properties) must distribute to each tenant the "Truth in Renting" statement issued by the New Jersey Department of Community Affairs.

  ACKNOWLEDGMENT: Tenant acknowledges receipt of the most current version of the New Jersey Department of Community Affairs "Truth in Renting" booklet, which describes the rights and responsibilities of residential tenants and landlords in the State of New Jersey, in either English or Spanish per Tenant''s preference.

  The statement is also available online at https://www.nj.gov/dca/divisions/codes/publications/pdf_lti/t_i_r.pdf and at any local public library.

  Property: {{property_address}}
  Tenant:   {{tenant_full_name}}', NULL, true, false, 'N.J.S.A. §46:8-44 to §46:8-50 (Truth in Renting Act)', 'https://www.nj.gov/dca/divisions/codes/publications/pdf_lti/t_i_r.pdf', 'statute_derived', true),
  ('or/just-cause', 'Oregon Just-Cause Eviction Notice (SB 608)', 'OR', '{}'::jsonb, 'OREGON JUST-CAUSE TERMINATION NOTICE (ORS §90.427)

  Pursuant to ORS §90.427, after the first year of occupancy, a landlord may not terminate this tenancy without "qualifying landlord reason for termination" or "tenant cause." Qualifying landlord reasons include:

    (A) The landlord intends to demolish the dwelling unit or convert it to a non-residential use within a reasonable time.
    (B) The landlord intends to undertake repairs or renovations to the dwelling unit within a reasonable time and the dwelling unit will be unsafe or unfit for occupancy.
    (C) The landlord intends for the landlord or a member of the landlord''s immediate family to occupy the dwelling unit as a primary residence and there are no other comparable units available for occupancy at the same location.
    (D) The landlord has accepted an offer to purchase the dwelling unit from a person who intends in good faith to occupy the dwelling unit as the buyer''s primary residence.

  Where the tenancy is terminated for a qualifying landlord reason, the landlord must:
    - Give at least 90 days written notice;
    - Pay the tenant relocation assistance equal to one (1) month''s rent (waived for landlords owning four or fewer dwelling units, with required disclosure).

  STATEWIDE RENT INCREASE LIMIT: ORS §90.323 caps annual rent increases at 7% plus the September CPI-W (US City Average), recalculated annually by the Oregon Department of Administrative Services. Increases in excess of this cap are unlawful and unenforceable.

  Property: {{property_address}}
  Tenant:   {{tenant_full_name}}', NULL, true, false, 'ORS §90.427 (as amended by 2019 Or. Laws Ch. 1, "SB 608")', 'https://oregon.public.law/statutes/ors_90.427', 'statute_derived', true)
  ON CONFLICT (slug) DO UPDATE SET
    title               = EXCLUDED.title,
    jurisdiction        = EXCLUDED.jurisdiction,
    applies_when        = EXCLUDED.applies_when,
    body                = EXCLUDED.body,
    attached_pdf_path   = EXCLUDED.attached_pdf_path,
    signature_required  = EXCLUDED.signature_required,
    initials_required   = EXCLUDED.initials_required,
    citation            = EXCLUDED.citation,
    source_url          = EXCLUDED.source_url,
    legal_review_status = EXCLUDED.legal_review_status,
    is_active           = EXCLUDED.is_active,
    updated_at          = now();

  INSERT INTO public._migration_history (filename, applied_at)
  VALUES ('20260430000002_phase04_seed_addenda_library.sql', now())
  ON CONFLICT (filename) DO NOTHING;

  COMMIT;
  