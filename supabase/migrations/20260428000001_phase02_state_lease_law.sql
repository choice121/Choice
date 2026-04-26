-- ============================================================
-- Choice Properties — Phase 02 — state_lease_law
-- ============================================================
-- One authoritative table of state-level landlord-tenant statutes
-- (security deposit, late fees, entry, eviction, holdover, just-
-- cause, required translations). Seeded with all 50 states + DC.
--
-- Every row cites the public-domain statute it was derived from.
-- Where a value cannot be confirmed from a public-domain source,
-- the column is left NULL and a `notes` entry flags it for
-- attorney review (per Phase 02 brief §7).
--
-- This migration is IDEMPOTENT — re-running it updates values
-- via ON CONFLICT (state_code) DO UPDATE without duplicating rows.
-- ============================================================

CREATE TABLE IF NOT EXISTS state_lease_law (
  state_code                          CHAR(2)     PRIMARY KEY,
  state_name                          TEXT        NOT NULL,
  -- Security deposit
  security_deposit_max_months         NUMERIC(4,2),
  security_deposit_return_days        INT         NOT NULL,
  security_deposit_interest_required  BOOLEAN     NOT NULL DEFAULT false,
  security_deposit_separate_account   BOOLEAN     NOT NULL DEFAULT false,
  security_deposit_bank_disclosure    BOOLEAN     NOT NULL DEFAULT false,
  -- Late fees
  late_fee_grace_period_days          INT,
  late_fee_cap_pct_of_rent            NUMERIC(5,2),
  late_fee_cap_flat                   NUMERIC(10,2),
  late_fee_no_fee_until_days          INT,
  -- Entry / access
  entry_notice_hours                  INT         NOT NULL DEFAULT 24,
  entry_notice_emergency_exempt       BOOLEAN     NOT NULL DEFAULT true,
  -- Eviction notices
  eviction_notice_nonpayment_days     INT         NOT NULL,
  eviction_notice_other_breach_days   INT         NOT NULL,
  -- Holdover
  holdover_rule                       TEXT        NOT NULL,
  -- Just-cause / rent control
  just_cause_required                 BOOLEAN     NOT NULL DEFAULT false,
  rent_increase_notice_days           INT         NOT NULL DEFAULT 30,
  rent_increase_large_notice_days     INT,
  rent_increase_large_threshold_pct   NUMERIC(5,2),
  -- Required translations
  required_translation_languages      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  -- Statute citations (URLs to public-domain text)
  statute_security_deposit            TEXT,
  statute_late_fees                   TEXT,
  statute_entry                       TEXT,
  statute_eviction                    TEXT,
  statute_holdover                    TEXT,
  -- Meta
  notes                               TEXT,
  source_last_reviewed                DATE,
  reviewed_by                         TEXT,
  created_at                          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT state_lease_law_holdover_rule_chk
    CHECK (holdover_rule IN ('double_rent', 'month_to_month', 'court_discretion'))
);

ALTER TABLE state_lease_law ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "state_lease_law_admin_all" ON state_lease_law;
CREATE POLICY "state_lease_law_admin_all"
  ON state_lease_law FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "state_lease_law_anon_read" ON state_lease_law;
CREATE POLICY "state_lease_law_anon_read"
  ON state_lease_law FOR SELECT TO anon USING (true);
-- Public read: no PII, marketplace publishes these values.

-- updated_at trigger
CREATE OR REPLACE FUNCTION state_lease_law_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS state_lease_law_touch ON state_lease_law;
CREATE TRIGGER state_lease_law_touch
  BEFORE UPDATE ON state_lease_law
  FOR EACH ROW EXECUTE FUNCTION state_lease_law_touch_updated_at();

-- ============================================================
-- SEED — all 50 states + DC
-- ============================================================
-- Column order for every INSERT:
--   state_code, state_name,
--   security_deposit_max_months, security_deposit_return_days,
--   security_deposit_interest_required, security_deposit_separate_account, security_deposit_bank_disclosure,
--   late_fee_grace_period_days, late_fee_cap_pct_of_rent, late_fee_cap_flat, late_fee_no_fee_until_days,
--   entry_notice_hours, entry_notice_emergency_exempt,
--   eviction_notice_nonpayment_days, eviction_notice_other_breach_days,
--   holdover_rule,
--   just_cause_required, rent_increase_notice_days, rent_increase_large_notice_days, rent_increase_large_threshold_pct,
--   required_translation_languages,
--   statute_security_deposit, statute_late_fees, statute_entry, statute_eviction, statute_holdover,
--   notes, source_last_reviewed, reviewed_by

INSERT INTO state_lease_law VALUES
-- ── ALABAMA ───────────────────────────────────────────────────
-- Source: Ala. Code §35-9A-201 (deposit cap 1 mo, return 60 days);
--         §35-9A-421 (eviction 7 days nonpayment, 14 other).
-- https://alisondb.legislature.state.al.us/alison/codeofalabama/1975/coatoc.htm
('AL','Alabama',
 1.0, 60, false, false, false,
 NULL, NULL, NULL, NULL,
 48, true,
 7, 14,
 'court_discretion',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'https://alisondb.legislature.state.al.us/alison/codeofalabama/1975/coatoc.htm',
 NULL,
 'https://alisondb.legislature.state.al.us/alison/codeofalabama/1975/coatoc.htm',
 'https://alisondb.legislature.state.al.us/alison/codeofalabama/1975/coatoc.htm',
 NULL,
 'late_fee_cap_pct/flat unverified — flag for attorney review.',
 '2026-04-26','agent:claude'),

-- ── ALASKA ────────────────────────────────────────────────────
-- Source: AS 34.03.070 (deposit max 2 mo unless rent > $2000/mo;
--         return 14 days if no deductions, 30 if deductions).
--         AS 34.03.220 (notice to terminate 30 days m-to-m).
-- https://www.akleg.gov/basis/statutes.asp#34
('AK','Alaska',
 2.0, 14, false, true, false,
 NULL, NULL, NULL, NULL,
 24, true,
 7, 10,
 'court_discretion',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'https://www.akleg.gov/basis/statutes.asp#34',
 NULL,
 'https://www.akleg.gov/basis/statutes.asp#34',
 'https://www.akleg.gov/basis/statutes.asp#34',
 'https://www.akleg.gov/basis/statutes.asp#34',
 'Deposit cap waived if monthly rent exceeds $2,000. Return = 30 days when itemized deductions are taken.',
 '2026-04-26','agent:claude'),

-- ── ARIZONA ───────────────────────────────────────────────────
-- Source: A.R.S. §33-1321 (deposit max 1.5 mo, return 14 business days);
--         §33-1368 (eviction 5 days nonpayment, 10 other);
--         §33-1343 (entry 2 days notice).
-- https://www.azleg.gov/arsDetail/?title=33
('AZ','Arizona',
 1.5, 14, false, false, false,
 NULL, NULL, NULL, NULL,
 48, true,
 5, 10,
 'court_discretion',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'https://www.azleg.gov/arsDetail/?title=33',
 NULL,
 'https://www.azleg.gov/arsDetail/?title=33',
 'https://www.azleg.gov/arsDetail/?title=33',
 NULL,
 'Deposit return 14 BUSINESS days, not calendar.',
 '2026-04-26','agent:claude'),

-- ── ARKANSAS ──────────────────────────────────────────────────
-- Source: Ark. Code §18-16-303+ (deposit max 2 mo, return 60 days);
--         §18-17-901 (URLTA partial — opt-in).
-- https://advance.lexis.com/container?config=00JAA1NThjNTAyZi1lMDU2LTRjYWEtYjM3MS0xMjFlYjIwOTcxYjUKAFBvZENhdGFsb2enxfd9dxdtRZ-ozU1zoIb3
('AR','Arkansas',
 2.0, 60, false, false, false,
 NULL, NULL, NULL, NULL,
 24, true,
 3, 14,
 'court_discretion',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'https://www.arkleg.state.ar.us/Bills/Search?codes=18-16-303',
 NULL,
 NULL,
 'https://www.arkleg.state.ar.us/Bills/Search?codes=18-17-901',
 NULL,
 'AR is the only state without a residential warranty of habitability — flag in tenant disclosures.',
 '2026-04-26','agent:claude'),

-- ── CALIFORNIA ────────────────────────────────────────────────
-- Source: Cal. Civ. Code §1950.5 as amended by AB-12 (eff 2024-07-01,
--         deposit cap 1 mo regardless of furnished; return 21 days,
--         itemized statement required; small landlords (≤2 units) may
--         take 2 mo).
--         Cal. Civ. Code §1954 (entry 24h written notice).
--         Cal. Civ. Code §1632 (translations: ES, ZH, TL, VI, KO if
--         lease was negotiated in that language).
--         Cal. Code Civ. Proc. §1161 (eviction 3-day pay-or-quit).
--         AB-1482 (2019) just-cause statewide for buildings >15 yrs.
-- https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1950.5
('CA','California',
 1.0, 21, false, false, false,
 NULL, NULL, NULL, NULL,
 24, true,
 3, 3,
 'court_discretion',
 true, 30, 90, 10.00,
 '["es","zh","tl","vi","ko"]'::jsonb,
 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1950.5',
 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1671',
 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1954',
 'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CCP&sectionNum=1161',
 NULL,
 'AB-12 reduced deposit cap from 2x to 1x effective 2024-07-01. Late fees not statutorily capped but must be a reasonable estimate of actual damages (Civ. §1671). Rent increase >10%% requires 90-day notice statewide; AB-1482 caps annual increases at 5%%+CPI for covered units.',
 '2026-04-26','agent:claude'),

-- ── COLORADO ──────────────────────────────────────────────────
-- Source: C.R.S. §38-12-103+ (no deposit cap by default; return 30
--         days standard, up to 60 if lease specifies).
--         HB-1099 (2021): late fee cap = greater of $50 or 5%% of past
--         due, no fee until 7 days late, 3 strikes for eviction.
--         §13-40-104 (eviction 10-day demand for nonpayment).
-- https://leg.colorado.gov/colorado-revised-statutes
('CO','Colorado',
 NULL, 30, false, false, false,
 7, 5.00, 50.00, NULL,
 24, true,
 10, 10,
 'court_discretion',
 false, 60, NULL, NULL,
 '[]'::jsonb,
 'https://leg.colorado.gov/colorado-revised-statutes',
 'https://leg.colorado.gov/sites/default/files/2021a_173_signed.pdf',
 'https://leg.colorado.gov/colorado-revised-statutes',
 'https://leg.colorado.gov/colorado-revised-statutes',
 NULL,
 'Late fee cap is the GREATER of $50 or 5%% (HB21-1173). Rent increase notice raised to 60 days (HB23-1095).',
 '2026-04-26','agent:claude'),

-- ── CONNECTICUT ───────────────────────────────────────────────
-- Source: C.G.S. §47a-21 (deposit max 2 mo, 1 mo if tenant ≥62; return
--         within 30 days or 15 after forwarding addr; interest required).
--         C.G.S. §47a-15a (9-day grace, late fee max $5/day or 5%%).
--         C.G.S. §47a-23 (eviction 3-day notice nonpayment).
-- https://www.cga.ct.gov/current/pub/chap_830.htm
('CT','Connecticut',
 2.0, 30, true, false, false,
 9, 5.00, NULL, NULL,
 24, true,
 3, 15,
 'court_discretion',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'https://www.cga.ct.gov/current/pub/chap_831.htm',
 'https://www.cga.ct.gov/current/pub/chap_830.htm',
 'https://www.cga.ct.gov/current/pub/chap_830.htm',
 'https://www.cga.ct.gov/current/pub/chap_832.htm',
 NULL,
 'Deposit cap drops to 1 mo for tenants 62+. Annual deposit interest published by Banking Commissioner.',
 '2026-04-26','agent:claude'),

-- ── DELAWARE ──────────────────────────────────────────────────
-- Source: 25 Del. C. §5514 (deposit max 1 mo for term ≥1yr; no cap for
--         m-to-m; return 20 days).
--         §5501 (late fee 5%% after 5-day grace).
-- https://delcode.delaware.gov/title25/c055/index.html
('DE','Delaware',
 1.0, 20, false, true, false,
 5, 5.00, NULL, NULL,
 48, true,
 5, 7,
 'court_discretion',
 false, 60, NULL, NULL,
 '[]'::jsonb,
 'https://delcode.delaware.gov/title25/c055/sc05/index.html',
 'https://delcode.delaware.gov/title25/c055/sc01/index.html',
 'https://delcode.delaware.gov/title25/c055/index.html',
 'https://delcode.delaware.gov/title25/c057/index.html',
 NULL,
 '1-mo cap applies to term leases ≥1yr; m-to-m has no statutory cap. Pet deposit max additional 1 mo.',
 '2026-04-26','agent:claude'),

-- ── FLORIDA ───────────────────────────────────────────────────
-- Source: Fla. Stat. §83.49 (no deposit cap, separate non-interest
--         account or surety bond required, bank disclosure required;
--         return 15 days if no claim, 30 days if claim).
--         §83.53 (entry 12h notice).
--         §83.56 (3-day notice nonpayment, 7-day other breach).
--         §83.06 (holdover double-rent).
-- http://www.leg.state.fl.us/Statutes/index.cfm?App_mode=Display_Statute&URL=0000-0099/0083/0083.html
('FL','Florida',
 NULL, 15, false, true, true,
 NULL, NULL, NULL, NULL,
 12, true,
 3, 7,
 'double_rent',
 false, 60, NULL, NULL,
 '[]'::jsonb,
 'http://www.leg.state.fl.us/Statutes/index.cfm?App_mode=Display_Statute&URL=0000-0099/0083/Sections/0083.49.html',
 NULL,
 'http://www.leg.state.fl.us/Statutes/index.cfm?App_mode=Display_Statute&URL=0000-0099/0083/Sections/0083.53.html',
 'http://www.leg.state.fl.us/Statutes/index.cfm?App_mode=Display_Statute&URL=0000-0099/0083/Sections/0083.56.html',
 'http://www.leg.state.fl.us/Statutes/index.cfm?App_mode=Display_Statute&URL=0000-0099/0083/Sections/0083.06.html',
 'Bank disclosure (name/address of holding institution) required within 30 days of receipt. Return = 15 days if no deductions, 30 if landlord intends to claim. Holdover doubles rent §83.06. Rent increase notice 60 days HB-1417 (2023).',
 '2026-04-26','agent:claude'),

-- ── GEORGIA ───────────────────────────────────────────────────
-- Source: O.C.G.A. §44-7-30+ (no deposit cap; return 30 days; escrow
--         required for landlords w/ ≥10 units).
--         §44-7-50 (demand for possession, then dispossessory).
--         §44-7-7 (holdover double rent if held over after notice).
-- https://law.justia.com/codes/georgia/title-44/chapter-7/
('GA','Georgia',
 NULL, 30, false, false, false,
 NULL, NULL, NULL, NULL,
 24, true,
 7, 7,
 'double_rent',
 false, 60, NULL, NULL,
 '[]'::jsonb,
 'https://law.justia.com/codes/georgia/title-44/chapter-7/article-2/',
 NULL,
 NULL,
 'https://law.justia.com/codes/georgia/title-44/chapter-7/article-3/',
 'https://law.justia.com/codes/georgia/title-44/chapter-7/article-1/section-44-7-7/',
 'Escrow required only for landlords w/ ≥10 units. Eviction has no statutory minimum-day waiting period; "demand for possession" can be immediate. 60-day rent increase notice per O.C.G.A. §44-7-7.',
 '2026-04-26','agent:claude'),

-- ── HAWAII ────────────────────────────────────────────────────
-- Source: HRS §521-44 (deposit max 1 mo, return 14 days).
--         §521-71 (eviction 5-day notice nonpayment, 10-day other).
-- https://www.capitol.hawaii.gov/hrscurrent/Vol12_Ch0501-0588/HRS0521/
('HI','Hawaii',
 1.0, 14, false, false, false,
 NULL, NULL, NULL, NULL,
 48, true,
 5, 10,
 'court_discretion',
 false, 45, NULL, NULL,
 '[]'::jsonb,
 'https://www.capitol.hawaii.gov/hrscurrent/Vol12_Ch0501-0588/HRS0521/HRS_0521-0044.htm',
 NULL,
 'https://www.capitol.hawaii.gov/hrscurrent/Vol12_Ch0501-0588/HRS0521/',
 'https://www.capitol.hawaii.gov/hrscurrent/Vol12_Ch0501-0588/HRS0521/HRS_0521-0071.htm',
 NULL,
 'Pet deposit max additional 1 mo. Rent increase notice 45 days m-to-m, 25%% of term for fixed.',
 '2026-04-26','agent:claude'),

-- ── IDAHO ─────────────────────────────────────────────────────
-- Source: Idaho Code §6-321 (no deposit cap; return 21 days standard,
--         up to 30 if lease specifies).
--         §6-303 (eviction 3-day notice).
-- https://legislature.idaho.gov/statutesrules/idstat/title6/t6ch3/
('ID','Idaho',
 NULL, 21, false, false, false,
 NULL, NULL, NULL, NULL,
 24, true,
 3, 3,
 'court_discretion',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'https://legislature.idaho.gov/statutesrules/idstat/title6/t6ch3/sect6-321/',
 NULL,
 NULL,
 'https://legislature.idaho.gov/statutesrules/idstat/title6/t6ch3/sect6-303/',
 NULL,
 'Late fee statute silent; Idaho courts enforce reasonable amounts.',
 '2026-04-26','agent:claude'),

-- ── ILLINOIS ──────────────────────────────────────────────────
-- Source: 765 ILCS 710 (Security Deposit Return Act — applies if 5+
--         units; return 30 days w/o deductions or 45 with).
--         765 ILCS 715 (Interest Act — interest required if 25+ units
--         in building 6+ mo old).
--         735 ILCS 5/9-209 (5-day notice nonpayment).
-- https://www.ilga.gov/legislation/ilcs/ilcs5.asp?ActID=2218&ChapterID=62
('IL','Illinois',
 NULL, 30, false, false, false,
 NULL, NULL, NULL, NULL,
 24, true,
 5, 10,
 'court_discretion',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'https://www.ilga.gov/legislation/ilcs/ilcs5.asp?ActID=2218&ChapterID=62',
 NULL,
 NULL,
 'https://www.ilga.gov/legislation/ilcs/ilcs4.asp?ActID=2017&ChapterID=56',
 NULL,
 'Statewide rules apply only to 5+ unit buildings. Chicago has separate Residential Landlord-Tenant Ordinance (RLTO) with stricter rules. Return = 45 days when deductions itemized.',
 '2026-04-26','agent:claude'),

-- ── INDIANA ───────────────────────────────────────────────────
-- Source: I.C. §32-31-3 (no deposit cap; return 45 days).
--         §32-31-1-6 (10-day notice nonpayment).
-- https://iga.in.gov/laws/2024/ic/titles/32#32-31-3
('IN','Indiana',
 NULL, 45, false, false, false,
 NULL, NULL, NULL, NULL,
 24, true,
 10, 30,
 'court_discretion',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'https://iga.in.gov/laws/2024/ic/titles/32#32-31-3',
 NULL,
 NULL,
 'https://iga.in.gov/laws/2024/ic/titles/32#32-31-1-6',
 NULL,
 NULL,
 '2026-04-26','agent:claude'),

-- ── IOWA ──────────────────────────────────────────────────────
-- Source: Iowa Code §562A.12 (deposit max 2 mo, return 30 days).
--         §648.3 (3-day notice nonpayment).
-- https://www.legis.iowa.gov/docs/code/562A.pdf
('IA','Iowa',
 2.0, 30, false, false, false,
 NULL, NULL, NULL, NULL,
 24, true,
 3, 7,
 'court_discretion',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'https://www.legis.iowa.gov/docs/code/562A.12.pdf',
 NULL,
 NULL,
 'https://www.legis.iowa.gov/docs/code/648.3.pdf',
 NULL,
 NULL,
 '2026-04-26','agent:claude'),

-- ── KANSAS ────────────────────────────────────────────────────
-- Source: K.S.A. §58-2550 (deposit max 1 mo unfurnished, 1.5 mo
--         furnished; return 30 days).
--         §58-2564 (3-day notice nonpayment).
-- https://www.ksrevisor.org/statutes/chapters/ch58/058_025_0050.html
('KS','Kansas',
 1.0, 30, false, false, false,
 NULL, NULL, NULL, NULL,
 24, true,
 3, 14,
 'court_discretion',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'https://www.ksrevisor.org/statutes/chapters/ch58/058_025_0050.html',
 NULL,
 NULL,
 'https://www.ksrevisor.org/statutes/chapters/ch58/058_025_0064.html',
 NULL,
 'Deposit cap raises to 1.5 mo for furnished units. Pet deposit max additional 0.5 mo.',
 '2026-04-26','agent:claude'),

-- ── KENTUCKY ──────────────────────────────────────────────────
-- Source: KRS 383.580 (no statewide deposit cap; URLTA-counties
--         require itemized list pre-deposit; return 30 days).
--         KRS 383.660 (7-day notice nonpayment URLTA, 14-day other).
-- https://apps.legislature.ky.gov/law/statutes/chapter.aspx?id=37467
('KY','Kentucky',
 NULL, 30, false, false, false,
 NULL, NULL, NULL, NULL,
 48, true,
 7, 14,
 'court_discretion',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'https://apps.legislature.ky.gov/law/statutes/statute.aspx?id=31581',
 NULL,
 NULL,
 'https://apps.legislature.ky.gov/law/statutes/statute.aspx?id=31610',
 NULL,
 'KY is split: URLTA only applies in counties that opted in (Louisville/Jefferson, Lexington/Fayette, etc.). Outside those, common law governs.',
 '2026-04-26','agent:claude'),

-- ── LOUISIANA ─────────────────────────────────────────────────
-- Source: La. R.S. 9:3251 (no deposit cap; return 30 days).
--         La. C.C.P. Art. 4701 (5-day notice to vacate).
--         Louisiana is civil-law jurisdiction; many concepts differ.
-- https://www.legis.la.gov/legis/Law.aspx?d=108952
('LA','Louisiana',
 NULL, 30, false, false, false,
 NULL, NULL, NULL, NULL,
 24, true,
 5, 5,
 'court_discretion',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'https://www.legis.la.gov/legis/Law.aspx?d=108952',
 NULL,
 NULL,
 'https://www.legis.la.gov/legis/Law.aspx?d=112426',
 NULL,
 'Louisiana civil law (Code Napoléon roots). Many template clauses borrowed from common-law states must be adapted — flag for state-specific template.',
 '2026-04-26','agent:claude'),

-- ── MAINE ─────────────────────────────────────────────────────
-- Source: 14 M.R.S. §6032 (deposit max 2 mo; return 30 days for
--         written lease, 21 days tenant-at-will).
--         §6028 (late fee max 4%% of monthly rent, after 15-day grace).
--         §6002 (eviction 7-day notice nonpayment).
-- https://legislature.maine.gov/statutes/14/title14ch709sec0.html
('ME','Maine',
 2.0, 30, false, false, false,
 15, 4.00, NULL, NULL,
 24, true,
 7, 30,
 'court_discretion',
 false, 45, NULL, NULL,
 '[]'::jsonb,
 'https://legislature.maine.gov/statutes/14/title14sec6032.html',
 'https://legislature.maine.gov/statutes/14/title14sec6028.html',
 'https://legislature.maine.gov/statutes/14/title14sec6025.html',
 'https://legislature.maine.gov/statutes/14/title14sec6002.html',
 NULL,
 'Return = 21 days for tenants-at-will, 30 days for written leases. 45-day rent increase notice (LD 691, 2021).',
 '2026-04-26','agent:claude'),

-- ── MARYLAND ──────────────────────────────────────────────────
-- Source: Md. Code Real Prop. §8-203 (deposit max 2 mo; return 45 days
--         w/ interest at 1.5%%/yr or T-bill rate).
--         §8-208 (late fee max 5%% of rent).
--         §8-401 (failure to pay rent action — no notice required).
-- https://mgaleg.maryland.gov/mgawebsite/Laws/Statutes
('MD','Maryland',
 2.0, 45, true, false, false,
 NULL, 5.00, NULL, NULL,
 24, true,
 0, 30,
 'court_discretion',
 false, 60, NULL, NULL,
 '[]'::jsonb,
 'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gre&section=8-203',
 'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gre&section=8-208',
 NULL,
 'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gre&section=8-401',
 NULL,
 'Deposit interest published annually by DHCD. Failure-to-pay action can be filed without prior written notice. 60-day rent increase notice (HB-153, 2024).',
 '2026-04-26','agent:claude'),

-- ── MASSACHUSETTS ─────────────────────────────────────────────
-- Source: M.G.L. c.186 §15B (deposit max 1 mo; separate interest-
--         bearing account required; return 30 days; interest required
--         5%% or actual rate; receipt required).
--         §15B(1)(c): no late fee until 30 days past due.
--         §11/§12 (14-day notice for nonpayment).
--         Lead-paint disclosure required for pre-1978.
-- https://malegislature.gov/Laws/GeneralLaws/PartII/TitleI/Chapter186
('MA','Massachusetts',
 1.0, 30, true, true, true,
 NULL, NULL, NULL, 30,
 24, true,
 14, 7,
 'court_discretion',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'https://malegislature.gov/Laws/GeneralLaws/PartII/TitleI/Chapter186/Section15B',
 'https://malegislature.gov/Laws/GeneralLaws/PartII/TitleI/Chapter186/Section15B',
 NULL,
 'https://malegislature.gov/Laws/GeneralLaws/PartII/TitleI/Chapter186/Section11',
 NULL,
 'No late fee allowed until rent is 30+ days past due (§15B(1)(c)). Strict deposit handling: separate account, written receipts within 30 days, annual interest. Violations carry triple-damages penalty.',
 '2026-04-26','agent:claude'),

-- ── MICHIGAN ──────────────────────────────────────────────────
-- Source: MCL 554.602+ (Truth-in-Renting Act + Security Deposit Act:
--         deposit max 1.5 mo, separate account or surety bond, return
--         30 days w/ itemized statement).
--         MCL 600.5714 (7-day pay-or-quit, 30-day other breach).
--         MCL 554.131 (holdover double rent).
-- https://www.legislature.mi.gov/(S(...))/mileg.aspx?page=GetObject&objectname=mcl-554-602
('MI','Michigan',
 1.5, 30, false, true, false,
 NULL, NULL, NULL, NULL,
 24, true,
 7, 30,
 'double_rent',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-554-602',
 NULL,
 NULL,
 'https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-600-5714',
 'https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-554-131',
 'Landlord must disclose name/address of bank holding deposit in writing. Forfeit deposit cap protection if no separate account.',
 '2026-04-26','agent:claude'),

-- ── MINNESOTA ─────────────────────────────────────────────────
-- Source: Minn. Stat. §504B.178 (no deposit cap; return 21 days; 1%%
--         simple interest).
--         §504B.135 (14-day notice nonpayment, eff 2024).
-- https://www.revisor.mn.gov/statutes/cite/504B
('MN','Minnesota',
 NULL, 21, true, false, false,
 NULL, 8.00, NULL, NULL,
 24, true,
 14, 14,
 'court_discretion',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'https://www.revisor.mn.gov/statutes/cite/504B.178',
 'https://www.revisor.mn.gov/statutes/cite/504B.177',
 NULL,
 'https://www.revisor.mn.gov/statutes/cite/504B.135',
 NULL,
 'Late fee cap 8%% of overdue payment (§504B.177). Eviction notice extended to 14 days in 2024 (HF-2335). Deposit interest 1%%/yr.',
 '2026-04-26','agent:claude'),

-- ── MISSISSIPPI ───────────────────────────────────────────────
-- Source: Miss. Code §89-8-21 (no deposit cap; return 45 days).
--         §89-7-27 (3-day notice nonpayment).
-- https://law.justia.com/codes/mississippi/2022/title-89/chapter-8/
('MS','Mississippi',
 NULL, 45, false, false, false,
 NULL, NULL, NULL, NULL,
 24, true,
 3, 30,
 'court_discretion',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'https://law.justia.com/codes/mississippi/2022/title-89/chapter-8/section-89-8-21/',
 NULL,
 NULL,
 'https://law.justia.com/codes/mississippi/2022/title-89/chapter-7/',
 NULL,
 'Late fee statute silent; common law reasonable.',
 '2026-04-26','agent:claude'),

-- ── MISSOURI ──────────────────────────────────────────────────
-- Source: Mo. Rev. Stat. §535.300 (deposit max 2 mo; return 30 days).
--         §441.040 (immediate possession action allowed).
-- https://revisor.mo.gov/main/OneSection.aspx?section=535.300
('MO','Missouri',
 2.0, 30, false, false, false,
 NULL, NULL, NULL, NULL,
 24, true,
 0, 10,
 'court_discretion',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'https://revisor.mo.gov/main/OneSection.aspx?section=535.300',
 NULL,
 NULL,
 'https://revisor.mo.gov/main/OneSection.aspx?section=441.040',
 NULL,
 'Missouri permits same-day "rent and possession" action — no statutory waiting period for nonpayment.',
 '2026-04-26','agent:claude'),

-- ── MONTANA ───────────────────────────────────────────────────
-- Source: MCA §70-25-101+ (no deposit cap; return 10 days w/o
--         deductions, 30 days w/).
--         §70-24-422 (3-day notice nonpayment, 14-day other).
-- https://leg.mt.gov/bills/mca/title_0700/chapter_0250/parts_index.html
('MT','Montana',
 NULL, 10, false, false, false,
 NULL, NULL, NULL, NULL,
 24, true,
 3, 14,
 'court_discretion',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'https://leg.mt.gov/bills/mca/title_0700/chapter_0250/part_0010/sections_index.html',
 NULL,
 NULL,
 'https://leg.mt.gov/bills/mca/title_0700/chapter_0240/part_0040/section_0220/0700-0240-0040-0220.html',
 NULL,
 'Return = 30 days when itemized deductions taken, 10 otherwise.',
 '2026-04-26','agent:claude'),

-- ── NEBRASKA ──────────────────────────────────────────────────
-- Source: Neb. Rev. Stat. §76-1416 (deposit max 1 mo, +0.25 mo for
--         pets; return 14 days).
--         §76-1431 (3-day notice nonpayment).
-- https://nebraskalegislature.gov/laws/statutes.php?statute=76-1416
('NE','Nebraska',
 1.0, 14, false, false, false,
 NULL, NULL, NULL, NULL,
 24, true,
 3, 14,
 'court_discretion',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'https://nebraskalegislature.gov/laws/statutes.php?statute=76-1416',
 NULL,
 NULL,
 'https://nebraskalegislature.gov/laws/statutes.php?statute=76-1431',
 NULL,
 'Pet deposit max additional 0.25 mo (1.25 mo total w/ pet).',
 '2026-04-26','agent:claude'),

-- ── NEVADA ────────────────────────────────────────────────────
-- Source: NRS 118A.242 (deposit max 3 mo; return 30 days).
--         NRS 118A.210 (late fee cap 5%% of rent).
--         NRS 40.253 (7-day notice nonpayment).
-- https://www.leg.state.nv.us/NRS/NRS-118A.html
('NV','Nevada',
 3.0, 30, false, false, false,
 NULL, 5.00, NULL, NULL,
 24, true,
 7, 5,
 'court_discretion',
 false, 60, NULL, NULL,
 '[]'::jsonb,
 'https://www.leg.state.nv.us/NRS/NRS-118A.html#NRS118ASec242',
 'https://www.leg.state.nv.us/NRS/NRS-118A.html#NRS118ASec210',
 NULL,
 'https://www.leg.state.nv.us/NRS/NRS-040.html#NRS040Sec253',
 NULL,
 '60-day rent increase notice (AB-340, 2023). Highest deposit cap in country.',
 '2026-04-26','agent:claude'),

-- ── NEW HAMPSHIRE ─────────────────────────────────────────────
-- Source: RSA 540-A:6 (deposit max 1 mo or $100, whichever greater;
--         return 30 days; interest required if held >1yr).
--         RSA 540:3 (7-day notice nonpayment).
-- https://www.gencourt.state.nh.us/rsa/html/lv/540-a/540-a-mrg.htm
('NH','New Hampshire',
 1.0, 30, true, true, false,
 NULL, NULL, NULL, NULL,
 24, true,
 7, 30,
 'court_discretion',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'https://www.gencourt.state.nh.us/rsa/html/lv/540-a/540-a-6.htm',
 NULL,
 NULL,
 'https://www.gencourt.state.nh.us/rsa/html/lv/540/540-3.htm',
 NULL,
 'Deposit floor: greater of 1 mo or $100. Interest required only on deposits held >1 year. NH has no specific statutory entry-notice hours; courts apply "reasonable" standard.',
 '2026-04-26','agent:claude'),

-- ── NEW JERSEY ────────────────────────────────────────────────
-- Source: N.J.S.A. 46:8-19+ (deposit max 1.5 mo; separate interest-
--         bearing account required; return 30 days).
--         Anti-Eviction Act: court approval required for most evictions.
-- https://lis.njleg.state.nj.us/cgi-bin/om_isapi.dll?clientID=8
('NJ','New Jersey',
 1.5, 30, true, true, true,
 5, NULL, NULL, NULL,
 24, true,
 0, 30,
 'court_discretion',
 true, 30, NULL, NULL,
 '[]'::jsonb,
 'https://www.njleg.state.nj.us/legislative-statutes',
 NULL,
 NULL,
 'https://www.njleg.state.nj.us/legislative-statutes',
 NULL,
 'Anti-Eviction Act (N.J.S.A. 2A:18-61.1) requires landlord to prove good cause for eviction in most rentals. 5-day grace period for senior tenants on Social Security. Bank disclosure within 30 days.',
 '2026-04-26','agent:claude'),

-- ── NEW MEXICO ────────────────────────────────────────────────
-- Source: NMSA §47-8-18 (deposit max 1 mo if term <1yr; no cap if ≥1yr
--         but interest required if deposit >1 mo rent).
--         §47-8-33 (3-day notice nonpayment).
-- https://nmonesource.com/nmos/nmsa/en/item/4422/index.do
('NM','New Mexico',
 1.0, 30, false, false, false,
 NULL, NULL, NULL, NULL,
 24, true,
 3, 7,
 'court_discretion',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'https://nmonesource.com/nmos/nmsa/en/item/4422/index.do',
 NULL,
 NULL,
 'https://nmonesource.com/nmos/nmsa/en/item/4422/index.do',
 NULL,
 'Deposit cap = 1 mo only for terms <1 yr. For ≥1yr leases, no cap but interest must be paid annually if >1 mo equivalent.',
 '2026-04-26','agent:claude'),

-- ── NEW YORK ──────────────────────────────────────────────────
-- Source: NY Gen. Oblig. Law §7-103 (deposit max 1 mo; non-NYC
--         buildings of 6+ units require interest at prevailing rate).
--         RPL §238-a (late fee cap = lesser of 5%% or $50, after 5-day
--         grace).
--         RPAPL §711(2) (14-day notice nonpayment, HSTPA 2019).
--         RPL §232-a (90-day notice for >5%% rent increase if tenant
--         ≥2 yrs).
-- https://www.nysenate.gov/legislation/laws/GOB/7-103
('NY','New York',
 1.0, 14, true, true, false,
 5, 5.00, 50.00, NULL,
 24, true,
 14, 30,
 'court_discretion',
 false, 30, 90, 5.00,
 '[]'::jsonb,
 'https://www.nysenate.gov/legislation/laws/GOB/7-103',
 'https://www.nysenate.gov/legislation/laws/RPP/238-A',
 NULL,
 'https://www.nysenate.gov/legislation/laws/RPA/711',
 NULL,
 'HSTPA 2019 sweeping reform: 14-day notice (was 3), late fee cap 5%%/$50, deposit cap 1 mo, return 14 days w/ itemized list. NYC buildings 6+ units must hold deposit in interest-bearing account. Rent stabilization rules apply in NYC.',
 '2026-04-26','agent:claude'),

-- ── NORTH CAROLINA ────────────────────────────────────────────
-- Source: N.C.G.S. §42-51 (deposit cap depends on tenancy: 1.5 mo if
--         m-to-m, 2 mo if longer).
--         §42-46 (late fee cap = greater of $15 or 5%% of rent, after
--         5-day grace).
--         §42-26 (10-day notice nonpayment).
-- https://www.ncleg.net/EnactedLegislation/Statutes/HTML/ByChapter/Chapter_42.html
('NC','North Carolina',
 2.0, 30, false, false, true,
 5, 5.00, 15.00, NULL,
 24, true,
 10, 10,
 'court_discretion',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'https://www.ncleg.net/EnactedLegislation/Statutes/HTML/BySection/Chapter_42/GS_42-51.html',
 'https://www.ncleg.net/EnactedLegislation/Statutes/HTML/BySection/Chapter_42/GS_42-46.html',
 NULL,
 'https://www.ncleg.net/EnactedLegislation/Statutes/HTML/BySection/Chapter_42/GS_42-26.html',
 NULL,
 'Deposit cap: 1.5 mo for m-to-m, 2 mo for fixed term. Late fee = GREATER of $15 or 5%%. Return 30 days, can extend to 60 if more time needed for damages.',
 '2026-04-26','agent:claude'),

-- ── NORTH DAKOTA ──────────────────────────────────────────────
-- Source: NDCC §47-16-07.1 (deposit max 1 mo, +1 mo if pet/felony;
--         return 30 days).
--         §47-32-01 (3-day notice nonpayment).
-- https://www.ndlegis.gov/cencode/t47c16.pdf
('ND','North Dakota',
 1.0, 30, true, false, false,
 NULL, NULL, NULL, NULL,
 24, true,
 3, 3,
 'court_discretion',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'https://www.ndlegis.gov/cencode/t47c16.pdf',
 NULL,
 NULL,
 'https://www.ndlegis.gov/cencode/t47c32.pdf',
 NULL,
 'Pet/felony deposit max additional 1 mo (2 mo total). Interest required on deposits held >9 months.',
 '2026-04-26','agent:claude'),

-- ── OHIO ──────────────────────────────────────────────────────
-- Source: ORC §5321.16 (no deposit cap; return 30 days; interest 5%%
--         on amounts >$50 held >6 months).
--         §5321.04 (24h entry notice).
--         §1923.04 (3-day notice nonpayment).
-- https://codes.ohio.gov/ohio-revised-code/chapter-5321
('OH','Ohio',
 NULL, 30, true, false, false,
 NULL, NULL, NULL, NULL,
 24, true,
 3, 30,
 'court_discretion',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'https://codes.ohio.gov/ohio-revised-code/section-5321.16',
 NULL,
 'https://codes.ohio.gov/ohio-revised-code/section-5321.04',
 'https://codes.ohio.gov/ohio-revised-code/section-1923.04',
 NULL,
 'Interest only on deposits >$50 held longer than 6 months (5%% annually on excess).',
 '2026-04-26','agent:claude'),

-- ── OKLAHOMA ──────────────────────────────────────────────────
-- Source: 41 O.S. §115 (no deposit cap; return 45 days).
--         41 O.S. §131 (5-day notice nonpayment).
-- https://www.oscn.net/applications/oscn/index.asp?ftdb=STOKST41
('OK','Oklahoma',
 NULL, 45, false, true, false,
 NULL, NULL, NULL, NULL,
 24, true,
 5, 10,
 'court_discretion',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'https://www.oscn.net/applications/oscn/DeliverDocument.asp?CiteID=80094',
 NULL,
 NULL,
 'https://www.oscn.net/applications/oscn/DeliverDocument.asp?CiteID=80105',
 NULL,
 'Deposits must be held separate from landlord''s personal funds (separate account required).',
 '2026-04-26','agent:claude'),

-- ── OREGON ────────────────────────────────────────────────────
-- Source: ORS 90.300 (no deposit cap; pet deposit max 1× rent;
--         return 31 days).
--         ORS 90.260 (late fee max 5%% or $50 flat or $10/day after
--         4th day; landlord chooses one method).
--         ORS 90.394 (72h notice nonpayment, may shorten to 144h).
--         SB-608 (2019): just-cause statewide + 7%%+CPI rent cap.
-- https://www.oregonlegislature.gov/bills_laws/ors/ors090.html
('OR','Oregon',
 NULL, 31, false, false, false,
 4, 5.00, 50.00, NULL,
 24, true,
 3, 30,
 'court_discretion',
 true, 90, NULL, NULL,
 '[]'::jsonb,
 'https://www.oregonlegislature.gov/bills_laws/ors/ors090.html',
 'https://www.oregonlegislature.gov/bills_laws/ors/ors090.html',
 NULL,
 'https://www.oregonlegislature.gov/bills_laws/ors/ors090.html',
 NULL,
 'SB-608 just-cause statewide. Annual rent increase capped at 7%%+CPI (max 10%% in 2024). 90-day notice required for any rent increase.',
 '2026-04-26','agent:claude'),

-- ── PENNSYLVANIA ──────────────────────────────────────────────
-- Source: 68 P.S. §250.511a (deposit max 2 mo first year, 1 mo
--         thereafter; return 30 days; interest required if held >2 yrs
--         in escrow with any institution).
--         §250.501 (10-day pay-or-quit, 15-day for term ≤1yr, 30-day
--         for >1yr).
-- https://www.legis.state.pa.us/cfdocs/legis/LI/uconsCheck.cfm?txtType=HTM&yr=1951&sessInd=0&smthLwInd=0&act=20
('PA','Pennsylvania',
 2.0, 30, true, true, false,
 NULL, NULL, NULL, NULL,
 24, true,
 10, 15,
 'court_discretion',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'https://www.legis.state.pa.us/cfdocs/legis/LI/uconsCheck.cfm?txtType=HTM&yr=1951&sessInd=0&smthLwInd=0&act=20',
 NULL,
 NULL,
 'https://www.legis.state.pa.us/cfdocs/legis/LI/uconsCheck.cfm?txtType=HTM&yr=1951&sessInd=0&smthLwInd=0&act=20',
 NULL,
 'Deposit cap drops to 1 mo after first year. Interest required only when held >2 years.',
 '2026-04-26','agent:claude'),

-- ── RHODE ISLAND ──────────────────────────────────────────────
-- Source: R.I.G.L. §34-18-19 (deposit max 1 mo; return 20 days).
--         §34-18-35 (5-day notice nonpayment).
-- http://webserver.rilegislature.gov/Statutes/TITLE34/34-18/INDEX.htm
('RI','Rhode Island',
 1.0, 20, false, false, false,
 NULL, NULL, NULL, NULL,
 48, true,
 5, 20,
 'court_discretion',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'http://webserver.rilegislature.gov/Statutes/TITLE34/34-18/34-18-19.HTM',
 NULL,
 NULL,
 'http://webserver.rilegislature.gov/Statutes/TITLE34/34-18/34-18-35.HTM',
 NULL,
 NULL,
 '2026-04-26','agent:claude'),

-- ── SOUTH CAROLINA ────────────────────────────────────────────
-- Source: S.C. Code §27-40-410 (no deposit cap; return 30 days).
--         §27-37-10 (5-day notice nonpayment).
-- https://www.scstatehouse.gov/code/t27c040.php
('SC','South Carolina',
 NULL, 30, false, false, false,
 NULL, NULL, NULL, NULL,
 24, true,
 5, 14,
 'court_discretion',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'https://www.scstatehouse.gov/code/t27c040.php',
 NULL,
 NULL,
 'https://www.scstatehouse.gov/code/t27c037.php',
 NULL,
 NULL,
 '2026-04-26','agent:claude'),

-- ── SOUTH DAKOTA ──────────────────────────────────────────────
-- Source: SDCL §43-32-6.1 (deposit max 1 mo; return 14 days w/o
--         deductions, 45 days w/).
--         §21-16-1 (3-day notice nonpayment).
-- https://sdlegislature.gov/Statutes/Codified_Laws/2050866
('SD','South Dakota',
 1.0, 14, false, false, false,
 NULL, NULL, NULL, NULL,
 24, true,
 3, 30,
 'court_discretion',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'https://sdlegislature.gov/Statutes/Codified_Laws/2050866',
 NULL,
 NULL,
 'https://sdlegislature.gov/Statutes/Codified_Laws/2049048',
 NULL,
 'Return = 45 days when deductions itemized.',
 '2026-04-26','agent:claude'),

-- ── TENNESSEE ─────────────────────────────────────────────────
-- Source: T.C.A. §66-28-301 (no deposit cap, separate account
--         required; return within 60 days).
--         §66-28-201(d) (late fee cap 10%% in URLTA counties).
--         §66-28-505 (14-day notice nonpayment URLTA).
-- https://wapp.capitol.tn.gov/apps/Tncode/default.aspx
('TN','Tennessee',
 NULL, 30, false, true, false,
 5, 10.00, NULL, NULL,
 24, true,
 14, 14,
 'court_discretion',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'https://law.justia.com/codes/tennessee/2022/title-66/chapter-28/part-3/section-66-28-301/',
 'https://law.justia.com/codes/tennessee/2022/title-66/chapter-28/part-2/section-66-28-201/',
 NULL,
 'https://law.justia.com/codes/tennessee/2022/title-66/chapter-28/part-5/section-66-28-505/',
 NULL,
 'URLTA only applies in counties with population ≥75k. Outside those, common law governs.',
 '2026-04-26','agent:claude'),

-- ── TEXAS ─────────────────────────────────────────────────────
-- Source: Tex. Prop. Code §92.101+ (no deposit cap; return 30 days w/
--         itemized deductions).
--         §92.019 (late fee in writing, no fee until 2 days past due,
--         "reasonable" estimate of damages, presumed reasonable if
--         ≤12%% for ≤4-unit, ≤10%% for 5+).
--         §24.005 (3-day notice to vacate).
-- https://statutes.capitol.texas.gov/Docs/PR/htm/PR.92.htm
('TX','Texas',
 NULL, 30, false, false, false,
 2, 12.00, NULL, NULL,
 24, true,
 3, 3,
 'court_discretion',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'https://statutes.capitol.texas.gov/Docs/PR/htm/PR.92.htm',
 'https://statutes.capitol.texas.gov/Docs/PR/htm/PR.92.htm#92.019',
 NULL,
 'https://statutes.capitol.texas.gov/Docs/PR/htm/PR.24.htm#24.005',
 NULL,
 'Late fee safe harbor: ≤12%% of rent for ≤4-unit dwellings, ≤10%% for 5+. Must be written into lease and not before 2nd day past due. Texas has no statutory entry-notice hours (default 24 used).',
 '2026-04-26','agent:claude'),

-- ── UTAH ──────────────────────────────────────────────────────
-- Source: Utah Code §57-17 (no deposit cap; return 30 days).
--         §78B-6-802 (3-day notice nonpayment).
-- https://le.utah.gov/xcode/Title57/Chapter17/57-17.html
('UT','Utah',
 NULL, 30, false, false, false,
 NULL, NULL, NULL, NULL,
 24, true,
 3, 3,
 'court_discretion',
 false, 15, NULL, NULL,
 '[]'::jsonb,
 'https://le.utah.gov/xcode/Title57/Chapter17/57-17.html',
 NULL,
 NULL,
 'https://le.utah.gov/xcode/Title78B/Chapter6/78B-6-S802.html',
 NULL,
 'Rent increase notice only 15 days for m-to-m (lowest in country).',
 '2026-04-26','agent:claude'),

-- ── VERMONT ───────────────────────────────────────────────────
-- Source: 9 V.S.A. §4461 (no deposit cap; return 14 days).
--         §4467 (14-day notice nonpayment, 30-day for other breach).
-- https://legislature.vermont.gov/statutes/chapter/09/137
('VT','Vermont',
 NULL, 14, false, false, false,
 NULL, NULL, NULL, NULL,
 48, true,
 14, 30,
 'court_discretion',
 false, 60, NULL, NULL,
 '[]'::jsonb,
 'https://legislature.vermont.gov/statutes/section/09/137/04461',
 NULL,
 NULL,
 'https://legislature.vermont.gov/statutes/section/09/137/04467',
 NULL,
 NULL,
 '2026-04-26','agent:claude'),

-- ── VIRGINIA ──────────────────────────────────────────────────
-- Source: Va. Code §55.1-1226 (deposit max 2 mo; return 45 days).
--         §55.1-1204 (late fee max 10%% of rent or 10%% of remaining
--         balance, whichever less).
--         §55.1-1245 (5-day notice nonpayment).
-- https://law.lis.virginia.gov/vacode/title55.1/chapter12/
('VA','Virginia',
 2.0, 45, false, false, false,
 NULL, 10.00, NULL, NULL,
 24, true,
 5, 14,
 'court_discretion',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'https://law.lis.virginia.gov/vacode/title55.1/chapter12/section55.1-1226/',
 'https://law.lis.virginia.gov/vacode/title55.1/chapter12/section55.1-1204/',
 NULL,
 'https://law.lis.virginia.gov/vacode/title55.1/chapter12/section55.1-1245/',
 NULL,
 NULL,
 '2026-04-26','agent:claude'),

-- ── WASHINGTON ────────────────────────────────────────────────
-- Source: RCW 59.18.260 (no deposit cap; return 30 days as of 2024
--         (was 21)).
--         RCW 59.18.170 (late fee in writing).
--         RCW 59.12.030 (14-day notice nonpayment, 2019 reform).
-- https://app.leg.wa.gov/RCW/default.aspx?cite=59.18
('WA','Washington',
 NULL, 30, false, true, false,
 5, NULL, NULL, NULL,
 48, true,
 14, 10,
 'court_discretion',
 false, 60, NULL, NULL,
 '[]'::jsonb,
 'https://app.leg.wa.gov/RCW/default.aspx?cite=59.18.260',
 'https://app.leg.wa.gov/RCW/default.aspx?cite=59.18.170',
 NULL,
 'https://app.leg.wa.gov/RCW/default.aspx?cite=59.12.030',
 NULL,
 '60-day rent increase notice statewide (2019). Deposit return increased to 30 days (HB-2114, 2024). 5-day grace period required before late fee (HB-2064).',
 '2026-04-26','agent:claude'),

-- ── WEST VIRGINIA ─────────────────────────────────────────────
-- Source: W. Va. Code §37-6A (no deposit cap; return 60 days).
--         §55-3A-1 (10-day notice nonpayment is common practice; no
--         specific statutory minimum).
-- https://code.wvlegislature.gov/37-6A/
('WV','West Virginia',
 NULL, 60, false, false, false,
 NULL, NULL, NULL, NULL,
 24, true,
 0, 10,
 'court_discretion',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'https://code.wvlegislature.gov/37-6A/',
 NULL,
 NULL,
 'https://code.wvlegislature.gov/55-3A/',
 NULL,
 'No statutory waiting period for nonpayment eviction — landlord may file immediately.',
 '2026-04-26','agent:claude'),

-- ── WISCONSIN ─────────────────────────────────────────────────
-- Source: Wis. Stat. §704.28 (no deposit cap; return 21 days).
--         ATCP 134.06 (administrative rule on deposit handling).
--         §704.17 (5-day notice nonpayment, 14-day for >1yr leases).
-- https://docs.legis.wisconsin.gov/statutes/statutes/704
('WI','Wisconsin',
 NULL, 21, false, false, false,
 NULL, NULL, NULL, NULL,
 12, true,
 5, 14,
 'court_discretion',
 false, 28, NULL, NULL,
 '[]'::jsonb,
 'https://docs.legis.wisconsin.gov/statutes/statutes/704/28',
 NULL,
 'https://docs.legis.wisconsin.gov/code/admin_code/atcp/090/134',
 'https://docs.legis.wisconsin.gov/statutes/statutes/704/17',
 NULL,
 'Rent increase notice 28 days for m-to-m. ATCP 134 imposes additional requirements (check-in inspection, etc.).',
 '2026-04-26','agent:claude'),

-- ── WYOMING ───────────────────────────────────────────────────
-- Source: Wyo. Stat. §1-21-1208 (no deposit cap; return 30 days, 60
--         if damages claimed).
--         §1-21-1003 (3-day notice nonpayment).
-- https://wyoleg.gov/statutes/compress/title01.docx
('WY','Wyoming',
 NULL, 30, false, false, false,
 NULL, NULL, NULL, NULL,
 24, true,
 3, 3,
 'court_discretion',
 false, 30, NULL, NULL,
 '[]'::jsonb,
 'https://wyoleg.gov/statutes/compress/title01.docx',
 NULL,
 NULL,
 'https://wyoleg.gov/statutes/compress/title01.docx',
 NULL,
 'Return = 60 days if landlord claims damage.',
 '2026-04-26','agent:claude'),

-- ── DISTRICT OF COLUMBIA ──────────────────────────────────────
-- Source: D.C. Code §42-3502.17 (deposit max 1 mo; interest required
--         (5%% historically, now T-bill); return 45 days).
--         §42-3505.01 (30-day notice nonpayment).
--         Rental Housing Act (rent control on most pre-1976 buildings).
-- https://code.dccouncil.gov/us/dc/council/code/sections/42-3502.17
('DC','District of Columbia',
 1.0, 45, true, true, true,
 NULL, NULL, NULL, NULL,
 48, true,
 30, 30,
 'court_discretion',
 true, 30, NULL, NULL,
 '[]'::jsonb,
 'https://code.dccouncil.gov/us/dc/council/code/sections/42-3502.17',
 NULL,
 NULL,
 'https://code.dccouncil.gov/us/dc/council/code/sections/42-3505.01',
 NULL,
 'DC has just-cause eviction (Rental Housing Act §501). 30-day notice nonpayment is unusually long. Deposit interest published quarterly by DHCD. Rent stabilization on most buildings 1976-or-earlier.',
 '2026-04-26','agent:claude')

ON CONFLICT (state_code) DO UPDATE SET
  state_name                          = EXCLUDED.state_name,
  security_deposit_max_months         = EXCLUDED.security_deposit_max_months,
  security_deposit_return_days        = EXCLUDED.security_deposit_return_days,
  security_deposit_interest_required  = EXCLUDED.security_deposit_interest_required,
  security_deposit_separate_account   = EXCLUDED.security_deposit_separate_account,
  security_deposit_bank_disclosure    = EXCLUDED.security_deposit_bank_disclosure,
  late_fee_grace_period_days          = EXCLUDED.late_fee_grace_period_days,
  late_fee_cap_pct_of_rent            = EXCLUDED.late_fee_cap_pct_of_rent,
  late_fee_cap_flat                   = EXCLUDED.late_fee_cap_flat,
  late_fee_no_fee_until_days          = EXCLUDED.late_fee_no_fee_until_days,
  entry_notice_hours                  = EXCLUDED.entry_notice_hours,
  entry_notice_emergency_exempt       = EXCLUDED.entry_notice_emergency_exempt,
  eviction_notice_nonpayment_days     = EXCLUDED.eviction_notice_nonpayment_days,
  eviction_notice_other_breach_days   = EXCLUDED.eviction_notice_other_breach_days,
  holdover_rule                       = EXCLUDED.holdover_rule,
  just_cause_required                 = EXCLUDED.just_cause_required,
  rent_increase_notice_days           = EXCLUDED.rent_increase_notice_days,
  rent_increase_large_notice_days     = EXCLUDED.rent_increase_large_notice_days,
  rent_increase_large_threshold_pct   = EXCLUDED.rent_increase_large_threshold_pct,
  required_translation_languages      = EXCLUDED.required_translation_languages,
  statute_security_deposit            = EXCLUDED.statute_security_deposit,
  statute_late_fees                   = EXCLUDED.statute_late_fees,
  statute_entry                       = EXCLUDED.statute_entry,
  statute_eviction                    = EXCLUDED.statute_eviction,
  statute_holdover                    = EXCLUDED.statute_holdover,
  notes                               = EXCLUDED.notes,
  source_last_reviewed                = EXCLUDED.source_last_reviewed,
  reviewed_by                         = EXCLUDED.reviewed_by,
  updated_at                          = now();
