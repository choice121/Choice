-- ─────────────────────────────────────────────────────────────────────
-- Phase 09 chunk 3/5 — per-state security-deposit letter body partials
--
-- Seeds 10 rows in lease_template_partials with slugs of the form
-- 'deposit-letter/{STATE}'. The chunk-2 PDF renderer
-- (_shared/deposit-letter-render.ts) already looks these up — when a
-- state-specific partial is present it overrides the embedded
-- GENERIC_BODY fallback, otherwise the generic text is used.
--
-- Each body uses the Liquid-subset template-engine.ts variables already
-- supplied by generate-deposit-letter/index.ts:
--   {{tenant_name}} {{landlord_name}} {{property_address}}
--   {{state_code}} {{statute}} {{return_days}} {{return_deadline_long}}
--   {{move_in_date_long}} {{move_out_date_long}}
--   {{total_deposit_held}} {{amount_withheld}}
--   {{refund_owed_to_tenant}} {{interest_accrued}}
--   {{generated_date_long}}
--
-- The dispute-instructions language (state-specific objection windows,
-- damages multipliers, etc.) is appended by the renderer's own
-- DISPUTE_TEXT lookup on the final page — these partials carry only the
-- letter BODY (the cover-page-2 text). Both layers are versioned via
-- this migration so we can audit any law changes.
--
-- States covered (chosen to match _shared/deposit-letter-render.ts
-- DISPUTE_TEXT and the Phase 03 top-10 lease template seed): CA, FL,
-- MA, NJ, TX, NY, IL, GA, OH, MI.
--
-- All rows use ON CONFLICT (slug) DO UPDATE so this migration is
-- idempotent and safe to re-run after wording revisions.
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO lease_template_partials (slug, body, description, created_by) VALUES
(
  'deposit-letter/CA',
  E'Dear {{tenant_name}},\n\n' ||
  E'This itemized statement is provided pursuant to California Civil Code section 1950.5 for the residential premises located at {{property_address}}.\n\n' ||
  E'Lease term:  {{move_in_date_long}} through {{move_out_date_long}}.\n\n' ||
  E'Total security deposit held by landlord:    {{total_deposit_held}}\n' ||
  E'Total deductions itemized below:            {{amount_withheld}}\n' ||
  E'                                            -------------\n' ||
  E'NET REFUND OWED TO TENANT:                  {{refund_owed_to_tenant}}\n\n' ||
  E'Per California Civil Code section 1950.5(g), the landlord must furnish this itemized statement and return any unused portion of the security deposit within TWENTY-ONE (21) calendar days after the tenant has vacated the premises. The deadline for this letter and the refund (if any) is {{return_deadline_long}}.\n\n' ||
  E'For any single deduction exceeding $125.00 for repairs or cleaning, the landlord is required to provide copies of receipts, invoices, or written estimates from the person performing the work. Receipts and supporting evidence are attached to this letter where applicable, and additional copies are available on written request to the landlord at the address shown above.\n\n' ||
  E'Each deduction is itemized on the following pages along with photo evidence where available. Please review the deductions and the dispute instructions on the final page.\n\n' ||
  E'Sincerely,\n{{landlord_name}}',
  'Phase 09: California Civ. Code Sec.1950.5 security-deposit accounting letter body. Includes mandatory $125 receipts disclosure.',
  'system'
),
(
  'deposit-letter/FL',
  E'NOTICE OF INTENTION TO IMPOSE CLAIM ON SECURITY DEPOSIT\n\n' ||
  E'Dear {{tenant_name}},\n\n' ||
  E'This notice is given to you pursuant to Florida Statute section 83.49(3) as the landlord''s written notice of intention to impose a claim on the security deposit held for the residential premises located at {{property_address}}.\n\n' ||
  E'Lease term:  {{move_in_date_long}} through {{move_out_date_long}}.\n\n' ||
  E'Total security deposit held by landlord:    {{total_deposit_held}}\n' ||
  E'Total deductions claimed (itemized below):  {{amount_withheld}}\n' ||
  E'                                            -------------\n' ||
  E'NET REFUND OWED TO TENANT:                  {{refund_owed_to_tenant}}\n\n' ||
  E'You are hereby notified that you have FIFTEEN (15) DAYS from the date you receive this notice to object in writing to the landlord''s claim. If you do not object within those 15 days, the landlord will be authorized to deduct the amounts itemized below from the security deposit and forward any remaining balance to you. Any objection must be sent in writing by certified mail to the landlord at the address shown above.\n\n' ||
  E'Per Florida Statute section 83.49(3)(a), the landlord must give this notice within thirty (30) days of the date the tenant vacated the premises. The statutory deadline applicable to this accounting is {{return_deadline_long}}.\n\n' ||
  E'Each deduction is itemized on the following pages along with photo evidence where available. Please review the deductions and the dispute instructions on the final page.\n\n' ||
  E'Sincerely,\n{{landlord_name}}',
  'Phase 09: Florida Stat. Sec.83.49(3) security-deposit notice-of-intention letter body. Includes mandatory 15-day objection notice.',
  'system'
),
(
  'deposit-letter/MA',
  E'Dear {{tenant_name}},\n\n' ||
  E'This itemized statement of damages is provided pursuant to Massachusetts General Laws chapter 186 section 15B for the residential premises located at {{property_address}}.\n\n' ||
  E'Lease term:  {{move_in_date_long}} through {{move_out_date_long}}.\n\n' ||
  E'Total security deposit held by landlord:    {{total_deposit_held}}\n' ||
  E'Total deductions itemized below:            {{amount_withheld}}\n' ||
  E'Interest required by Sec.15B(3)(b):           {{interest_accrued}}\n' ||
  E'                                            -------------\n' ||
  E'NET REFUND OWED TO TENANT:                  {{refund_owed_to_tenant}}\n\n' ||
  E'Per M.G.L. chapter 186 section 15B(4), the landlord must return any unused portion of the security deposit, together with interest accrued at the rate required by law, within THIRTY (30) DAYS of lease termination. The deadline applicable to this accounting is {{return_deadline_long}}.\n\n' ||
  E'This itemized list of damages is sworn to under the pains and penalties of perjury as required by M.G.L. chapter 186 section 15B(4)(iii). Each deduction listed is supported by written evidence (estimates, invoices, or photographs) attached to this letter or available on request.\n\n' ||
  E'Each deduction is itemized on the following pages. Please review the deductions and the dispute instructions on the final page. If the landlord fails to comply with the statute you may be entitled to recover three (3) times the amount wrongfully withheld plus interest, court costs, and reasonable attorneys'' fees.\n\n' ||
  E'Sincerely,\n{{landlord_name}}',
  'Phase 09: Massachusetts G.L. ch.186 Sec.15B security-deposit letter body. Includes mandatory sworn-under-perjury language and interest disclosure.',
  'system'
),
(
  'deposit-letter/NJ',
  E'Dear {{tenant_name}},\n\n' ||
  E'This itemized statement is provided pursuant to the New Jersey Rent Security Deposit Act, N.J.S.A. 46:8-19 et seq., for the residential premises located at {{property_address}}.\n\n' ||
  E'Lease term:  {{move_in_date_long}} through {{move_out_date_long}}.\n\n' ||
  E'Total security deposit held by landlord:    {{total_deposit_held}}\n' ||
  E'Total deductions itemized below:            {{amount_withheld}}\n' ||
  E'Interest accrued (N.J.S.A. 46:8-19(b)):       {{interest_accrued}}\n' ||
  E'                                            -------------\n' ||
  E'NET REFUND OWED TO TENANT:                  {{refund_owed_to_tenant}}\n\n' ||
  E'Per N.J.S.A. 46:8-21.1, the landlord must return any unused portion of the security deposit, together with the tenant''s share of interest earned on the deposit, within THIRTY (30) DAYS of the date the tenant vacated the premises. The deadline applicable to this accounting is {{return_deadline_long}}.\n\n' ||
  E'Each deduction is itemized on the following pages along with photo evidence where available. Please review the deductions and the dispute instructions on the final page. The Truth-in-Renting Act provides that wrongful retention of the deposit may result in liability for double the amount withheld plus court costs and reasonable attorneys'' fees.\n\n' ||
  E'Sincerely,\n{{landlord_name}}',
  'Phase 09: New Jersey N.J.S.A. 46:8-19 et seq. security-deposit letter body. Includes mandatory interest disclosure.',
  'system'
),
(
  'deposit-letter/TX',
  E'Dear {{tenant_name}},\n\n' ||
  E'This written description and itemized list of deductions is provided pursuant to Texas Property Code sections 92.103 through 92.109 for the residential premises located at {{property_address}}.\n\n' ||
  E'Lease term:  {{move_in_date_long}} through {{move_out_date_long}}.\n\n' ||
  E'Total security deposit held by landlord:    {{total_deposit_held}}\n' ||
  E'Total deductions itemized below:            {{amount_withheld}}\n' ||
  E'                                            -------------\n' ||
  E'NET REFUND OWED TO TENANT:                  {{refund_owed_to_tenant}}\n\n' ||
  E'Per Texas Property Code section 92.103, the landlord must refund the security deposit, less any amounts lawfully deducted, no later than THIRTY (30) DAYS after the date the tenant surrenders the premises and provides a forwarding address. The deadline applicable to this accounting is {{return_deadline_long}}.\n\n' ||
  E'The deductions itemized below are claimed in good faith for actual damages or charges for which the tenant is legally liable under the lease or as a result of breaching the lease. Normal wear and tear is not deducted.\n\n' ||
  E'Each deduction is itemized on the following pages along with photo evidence where available. Please review the deductions and the dispute instructions on the final page. Per Texas Property Code section 92.109, if the landlord retains all or part of the deposit in bad faith, the tenant may recover three times the amount wrongfully withheld plus $100 and reasonable attorneys'' fees.\n\n' ||
  E'Sincerely,\n{{landlord_name}}',
  'Phase 09: Texas Property Code Sec.92.103-109 security-deposit letter body. Includes mandatory good-faith and normal-wear-and-tear language.',
  'system'
),
(
  'deposit-letter/NY',
  E'Dear {{tenant_name}},\n\n' ||
  E'This itemized statement is provided pursuant to New York General Obligations Law section 7-108 for the residential premises located at {{property_address}}.\n\n' ||
  E'Lease term:  {{move_in_date_long}} through {{move_out_date_long}}.\n\n' ||
  E'Total security deposit held by landlord:    {{total_deposit_held}}\n' ||
  E'Total deductions itemized below:            {{amount_withheld}}\n' ||
  E'Interest accrued (where required by law):  {{interest_accrued}}\n' ||
  E'                                            -------------\n' ||
  E'NET REFUND OWED TO TENANT:                  {{refund_owed_to_tenant}}\n\n' ||
  E'Per N.Y. General Obligations Law section 7-108(1-a)(e), the landlord must return any unused portion of the security deposit and provide an itemized statement of any amounts withheld within FOURTEEN (14) DAYS of the tenant vacating the premises. The deadline applicable to this accounting is {{return_deadline_long}}.\n\n' ||
  E'Prior to the tenant vacating, the tenant had the right to request an inspection of the premises and to be present at that inspection. Each deduction listed below was identified during such inspection or during the move-out condition assessment.\n\n' ||
  E'Each deduction is itemized on the following pages along with photo evidence where available. Please review the deductions and the dispute instructions on the final page. Failure to comply with section 7-108 may forfeit the landlord''s right to retain any portion of the deposit.\n\n' ||
  E'Sincerely,\n{{landlord_name}}',
  'Phase 09: New York G.O.L. Sec.7-108 security-deposit letter body. References tenant inspection right and 14-day return window.',
  'system'
),
(
  'deposit-letter/IL',
  E'Dear {{tenant_name}},\n\n' ||
  E'This itemized statement is provided pursuant to the Illinois Security Deposit Return Act, 765 ILCS 710, for the residential premises located at {{property_address}}.\n\n' ||
  E'Lease term:  {{move_in_date_long}} through {{move_out_date_long}}.\n\n' ||
  E'Total security deposit held by landlord:    {{total_deposit_held}}\n' ||
  E'Total deductions itemized below:            {{amount_withheld}}\n' ||
  E'                                            -------------\n' ||
  E'NET REFUND OWED TO TENANT:                  {{refund_owed_to_tenant}}\n\n' ||
  E'Per 765 ILCS 710/1, the landlord must furnish this itemized statement of damages and return any balance due within THIRTY (30) DAYS of the date the tenant vacated the premises. The deadline applicable to this accounting is {{return_deadline_long}}.\n\n' ||
  E'For each deduction representing repairs or cleaning, paid receipts, invoices, or estimates are attached to this letter where applicable, or available on request to the landlord at the address shown above.\n\n' ||
  E'Each deduction is itemized on the following pages along with photo evidence where available. Please review the deductions and the dispute instructions on the final page. If the landlord fails to comply with the Act you may be entitled to damages equal to two (2) times the amount of the deposit plus court costs and reasonable attorneys'' fees.\n\n' ||
  E'Sincerely,\n{{landlord_name}}',
  'Phase 09: Illinois 765 ILCS 710 Security Deposit Return Act letter body. References mandatory paid-receipts disclosure.',
  'system'
),
(
  'deposit-letter/GA',
  E'Dear {{tenant_name}},\n\n' ||
  E'This itemized statement is provided pursuant to O.C.G.A. sections 44-7-34 and 44-7-35 for the residential premises located at {{property_address}}.\n\n' ||
  E'Lease term:  {{move_in_date_long}} through {{move_out_date_long}}.\n\n' ||
  E'Total security deposit held by landlord:    {{total_deposit_held}}\n' ||
  E'Total deductions itemized below:            {{amount_withheld}}\n' ||
  E'                                            -------------\n' ||
  E'NET REFUND OWED TO TENANT:                  {{refund_owed_to_tenant}}\n\n' ||
  E'Per O.C.G.A. section 44-7-34, the landlord must furnish this written list of damages claimed and return any balance due within THIRTY (30) DAYS of the date the tenant vacated the premises. The deadline applicable to this accounting is {{return_deadline_long}}.\n\n' ||
  E'Each deduction listed below is for actual damage to the premises or unpaid amounts owing under the lease. Normal wear and tear is not deducted.\n\n' ||
  E'Each deduction is itemized on the following pages along with photo evidence where available. Please review the deductions and the dispute instructions on the final page. If the landlord wrongfully withholds any portion of the deposit you may be entitled to three times the amount wrongfully withheld.\n\n' ||
  E'Sincerely,\n{{landlord_name}}',
  'Phase 09: Georgia O.C.G.A. Sec.44-7-34/35 security-deposit letter body.',
  'system'
),
(
  'deposit-letter/OH',
  E'Dear {{tenant_name}},\n\n' ||
  E'This itemized statement is provided pursuant to Ohio Revised Code section 5321.16 for the residential premises located at {{property_address}}.\n\n' ||
  E'Lease term:  {{move_in_date_long}} through {{move_out_date_long}}.\n\n' ||
  E'Total security deposit held by landlord:    {{total_deposit_held}}\n' ||
  E'Total deductions itemized below:            {{amount_withheld}}\n' ||
  E'Interest accrued (where required by law):  {{interest_accrued}}\n' ||
  E'                                            -------------\n' ||
  E'NET REFUND OWED TO TENANT:                  {{refund_owed_to_tenant}}\n\n' ||
  E'Per Ohio Revised Code section 5321.16(B), the landlord must furnish this itemized statement and return any balance due within THIRTY (30) DAYS of lease termination and delivery of possession. The deadline applicable to this accounting is {{return_deadline_long}}.\n\n' ||
  E'Each deduction listed below is for actual damages caused by the tenant or for past-due rent or other charges owing under the lease.\n\n' ||
  E'Each deduction is itemized on the following pages along with photo evidence where available. Please review the deductions and the dispute instructions on the final page. If the landlord wrongfully withholds any portion of the deposit you may recover damages equal to the amount wrongfully withheld plus reasonable attorneys'' fees.\n\n' ||
  E'Sincerely,\n{{landlord_name}}',
  'Phase 09: Ohio Revised Code Sec.5321.16 security-deposit letter body.',
  'system'
),
(
  'deposit-letter/MI',
  E'Dear {{tenant_name}},\n\n' ||
  E'This itemized statement is provided pursuant to the Michigan Security Deposits Act, MCL section 554.601 et seq., for the residential premises located at {{property_address}}.\n\n' ||
  E'Lease term:  {{move_in_date_long}} through {{move_out_date_long}}.\n\n' ||
  E'Total security deposit held by landlord:    {{total_deposit_held}}\n' ||
  E'Total deductions itemized below:            {{amount_withheld}}\n' ||
  E'                                            -------------\n' ||
  E'NET REFUND OWED TO TENANT:                  {{refund_owed_to_tenant}}\n\n' ||
  E'Per MCL section 554.609, the landlord must mail this itemized list of damages claimed and any unused portion of the deposit within THIRTY (30) DAYS of lease termination. The deadline applicable to this accounting is {{return_deadline_long}}.\n\n' ||
  E'You have SEVEN (7) DAYS from the date you receive this list to respond in writing if you disagree with any of the damages claimed. Failure to respond within seven days may waive certain rights you have to dispute these damages. Any response should be sent in writing to the landlord at the address shown above.\n\n' ||
  E'Each deduction is itemized on the following pages along with photo evidence where available. Please review the deductions and the dispute instructions on the final page.\n\n' ||
  E'Sincerely,\n{{landlord_name}}',
  'Phase 09: Michigan Security Deposits Act (MCL Sec.554.601 et seq.) security-deposit letter body. Includes mandatory 7-day tenant response notice.',
  'system'
)
ON CONFLICT (slug) DO UPDATE
  SET body         = EXCLUDED.body,
      description  = EXCLUDED.description,
      updated_at   = now();
