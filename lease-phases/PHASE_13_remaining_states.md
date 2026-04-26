# PHASE 13 — Remaining 40 States Templates Rollout

**Status:** `TODO`
**Depends on:** Phase 02, 03, 04 (`DONE`)
**Blocks:** —

---

## 1. Goal

Seed `lease_template_versions` with statute-derived templates for the **other 40 states + DC** (everything except CA, TX, FL, NY, IL, OH, GA, NC, PA, MI which were done in Phase 03). Add the corresponding state-specific addenda to `lease_addenda_library`. After this phase, the system genuinely covers all 50 states + DC.

## 2. Why

A nationwide marketplace cannot ship "we support 10 states." Phase 03 proved the architecture; this phase scales coverage.

## 3. Scope — IN

For each of the remaining 41 jurisdictions:

1. Confirm `state_lease_law` row exists and is fully populated (from Phase 02). If anything is `NULL` and unverified, this phase must populate it from public statute references — cite each in SQL comments.
2. Insert one base lease template into `lease_template_versions` (and `lease_templates` row marking it active). Body uses Phase 01 templating syntax + Phase 02 metadata bindings + standard partials.
3. Add any state-specific disclosure addenda to `lease_addenda_library` (each with `jurisdiction = '<state>'`, `legal_review_status = 'statute_derived'`).
4. (Optional, if budget exists) Spanish version of each template — defer if not budgeted; English-only acceptable for v1.

## 4. State checklist (40 + DC)

```
AK, AL, AR, AZ, CO, CT, DC, DE, HI, IA, ID, IN, KS, KY, LA, MA, MD, ME, MN,
MO, MS, MT, ND, NE, NH, NJ, NM, NV, OK, OR, RI, SC, SD, TN, UT, VA, VT, WA,
WI, WV, WY
```

(Verify count = 41 before claiming complete.)

## 5. Per-state notable variations (research before seeding)

Notable items to capture in template body or as addenda:

- **MA**: separate last-month and security deposits, statement-of-condition within 10 days, deposit interest required.
- **NJ**: Truth-in-Renting statement, deposit interest, no entry without notice except emergency.
- **OR**: SB-608 just-cause termination, statewide rent control formula, security deposit cap = none but accounting strict.
- **WA**: 14-day notice for non-payment, mandatory move-in checklist, "habitability" standards.
- **VA**: 45-day deposit return, mandatory move-in inspection within 5 days.
- **CT**: deposit max 2× monthly rent (1× for tenants 62+), interest required.
- **DC**: 45-day deposit return, lead-paint very strict, just-cause for some buildings.
- **HI**: separate cleaning fee handling, pet deposit special rules.
- **MD**: deposit max 2× monthly, deposit interest required, written receipt mandatory.
- **MN**: 21-day deposit return, late-fee cap 8%/month.
- **AZ**: bedbug disclosure required.
- **NM**: deposit max 1× for leases <1 year.
- **NV**: deposit max 3× monthly rent.
- **ME**: deposit max 2× monthly, return 21/30 days written/at-will.
- **NH**: deposit max 1× for some buildings, separate account required.
- **VT**: 14-day notice, deposit interest required.
- **DE**: deposit max 1× annual rent / 12 (≈1× month), 20-day return.
- **AL**: deposit max 1× monthly rent, 60-day return.
- **AR**: 60-day return, no statutory deposit cap.
- **WV**: 60-day return, no cap, written notice required.
- **KY**: move-in checklist mandatory, 30-day return.
- **TN**: 30-day return, written inventory required.
- **MS**: 45-day return, no cap.
- **LA**: notarization sometimes required for >1 year leases.
- **OK**: 30-day return, no cap, but written demand required.
- **MO**: 30-day return, deposit max 2× monthly, written itemization.
- **IA**: deposit max 2× monthly, 30-day return.
- **KS**: deposit max 1× unfurnished / 1.5× furnished + .5 pet, 30-day return.
- **NE**: deposit max 1× monthly, 14-day return.
- **MT**: 10-day or 30-day return depending on cleaning.
- **ND**: deposit max 1× / 2× pets, 30-day return.
- **SD**: 14-day return, no cap.
- **WY**: 30-day return, no cap.
- **ID**: 21/30-day return, no cap.
- **UT**: 30-day return, deposit nonrefundable allowed if disclosed.
- **CO**: 30-day default / 60-day max return, "warranty of habitability" landmark.
- **WI**: 21-day return, written check-in/check-out required.
- **MN**: 21-day return + interest, 8%/month late-fee cap.
- **NM**: deposit max 1× / 2×, 30-day return.
- **AK**: deposit max 2× monthly (≤ $2k unfurnished), 14/30-day return.
- **RI**: 20-day return, no cap.
- **SC**: 30-day return, no cap.
- **CT**: 30-day return, interest required.

(This list is a starting point. The seeding AI must verify each from the actual statute and cite the URL in the migration comment.)

## 6. Files to CREATE / MODIFY

```
CREATE: supabase/migrations/20260509_phase13_remaining_states_law.sql       (any missing state_lease_law fields)
CREATE: supabase/migrations/20260509_phase13_remaining_states_templates.sql
CREATE: supabase/migrations/20260509_phase13_remaining_states_addenda.sql
```

## 7. Acceptance criteria

- [ ] `SELECT COUNT(*) FROM state_lease_law` returns 51.
- [ ] Every row has every column populated (no NULLs except optional `notes`, `attorney_reviewer`, etc.).
- [ ] `SELECT COUNT(DISTINCT state_code) FROM lease_template_versions WHERE is_active = true` returns at least 51 (one per jurisdiction).
- [ ] Generating a lease for any state produces a PDF with the right state's law applied, addenda attached, and disclaimer included.
- [ ] No template body contains a hardcoded state name or statute citation that contradicts its `state_code`.
- [ ] Every template's `legal_review_status = 'statute_derived'` (none yet `attorney_reviewed`).

## 8. Push & Stop

- [ ] Master row 13 = `DONE`. Commit: `Lease Phase 13 — remaining 40 states templates rollout`. STOP.
- [ ] Post-completion: ping owner that all 13 phases are done and the system is ready for owner-driven attorney-review batches.
