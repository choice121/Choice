# PHASE 04 — State-Required Disclosures Library + Auto-Attach

**Status:** `TODO`
**Depends on:** Phase 01, 02, 03 (all `DONE`)
**Blocks:** —

---

## 1. Goal

Build a library of required-disclosure addenda (lead-paint, mold, bedbug, radon, Megan's Law, etc.) and have `generate-lease` auto-attach the correct ones based on the lease's state, the property's age (lead applies <1978), and the property type. Refuse to generate if a state-required disclosure is missing.

## 2. Why

Required disclosures are *legally* required. Today the MI template just mentions lead in a clause but doesn't actually attach the EPA pamphlet or capture the separate signature. Federal lead-paint alone exposes a landlord to $19,500/violation. State-specific disclosures (CA bedbug, FL radon, NY allergen-hazard, etc.) carry similar penalties.

## 3. Scope — IN

- New table `lease_addenda_library` (template-source for addenda).
- New table `lease_addenda_attached` (per-application: which addenda attached, signed timestamps, hash).
- Seed library with the disclosures listed in §7.
- Modify `generate-lease`:
  1. Compute required addenda set: federal lead (if year_built<1978), state base set (per `state_lease_law.required_disclosures` or a join table), property-type set.
  2. For each, pull body from `lease_addenda_library`, render through templating engine, append as separate pages in the PDF (each addendum starts on a new page with its title block).
  3. Insert one `lease_addenda_attached` row per addendum.
  4. If any required addendum is not in the library yet (e.g. state X needs Y but Y not seeded), refuse with `400 "Cannot generate lease: state X requires addendum 'Y' which is not in the addenda library."`.
- Modify `sign-lease`: tenant signature applies to lease + all attached addenda. Capture per-addendum acknowledgment row in `lease_addenda_attached`.
- Lead-paint specifically: include the EPA "Protect Your Family From Lead in Your Home" pamphlet. Bundle as a public-domain PDF asset under `assets/legal/epa-lead-pamphlet-2020.pdf` and reference its presence in the addendum text. (Pamphlet PDF is public domain — `https://www.epa.gov/lead/protect-your-family-lead-your-home-english`.)

## 4. Scope — OUT

- Property-photos integration with year_built. Assume `properties.year_built` exists or add it as a nullable column with a comment that Phase 04 doesn't populate it.
- Custom addenda per landlord. Library only for now.

## 5. Files to CREATE / MODIFY

```
CREATE: supabase/migrations/20260430_phase04_addenda_library.sql
CREATE: supabase/migrations/20260430_phase04_seed_addenda.sql
CREATE: assets/legal/epa-lead-pamphlet-2020.pdf       (download from EPA, public domain)
CREATE: assets/legal/epa-lead-pamphlet-spanish-2020.pdf
MODIFY: supabase/functions/generate-lease/index.ts
MODIFY: supabase/functions/_shared/pdf.ts             (page-break helper for addenda)
MODIFY: supabase/functions/sign-lease/index.ts        (record per-addendum ack)
MODIFY: lease-sign.html                                (show addenda list + per-section ack)
MODIFY: js/tenant/lease-sign.js
```

## 6. `lease_addenda_library` schema

```sql
CREATE TABLE IF NOT EXISTS lease_addenda_library (
  slug                TEXT PRIMARY KEY,            -- 'federal/lead-paint', 'ca/bedbug', etc.
  title               TEXT NOT NULL,               -- 'Federal Lead-Based Paint Disclosure'
  jurisdiction        TEXT NOT NULL,               -- 'federal' | 'CA' | 'NY' | etc.
  applies_when        JSONB NOT NULL,              -- {"property_built_before":1978} or {"property_type":["sfh","mfr"]} etc.
  body                TEXT NOT NULL,               -- templating-engine source
  attached_pdf_path   TEXT,                        -- e.g. 'assets/legal/epa-lead-pamphlet-2020.pdf' (optional embed)
  signature_required  BOOLEAN NOT NULL DEFAULT true,
  initials_required   BOOLEAN NOT NULL DEFAULT false,
  citation            TEXT NOT NULL,               -- statute or regulation reference
  source_url          TEXT NOT NULL,
  legal_review_status TEXT NOT NULL DEFAULT 'statute_derived',
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE lease_addenda_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "addenda_library_admin_all" ON lease_addenda_library FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid()));
CREATE POLICY "addenda_library_anon_read" ON lease_addenda_library FOR SELECT TO anon USING (is_active);
```

## 7. Seed addenda (minimum)

| Slug                          | Title                                  | Citation                                  |
| ----------------------------- | -------------------------------------- | ----------------------------------------- |
| `federal/lead-paint`          | Federal Lead-Based Paint Disclosure    | 42 USC §4852d; 24 CFR §35                |
| `federal/megans-law`          | Sex Offender Registry Notification     | 42 USC §14071 (state-specific specifics) |
| `common/mold`                 | Mold Disclosure & Tenant Acknowledgment| Industry standard                         |
| `common/bedbug`               | Bedbug Disclosure                       | NY/CA/AZ/ME require                      |
| `common/smoke-co`             | Smoke & CO Detector Acknowledgment     | State-specific (most states)              |
| `common/move-in-inventory`    | Move-In Inventory & Condition Form     | CA, GA, KY, MD, MA, NH, NJ, VA, WA req'd |
| `common/pet-addendum`         | Pet Addendum                            | Conditional on pet policy                 |
| `ca/bedbug`                   | California Bedbug Disclosure           | Civ. §1954.603                           |
| `ca/megans-law`               | California Megan's Law Notice          | Civ. §2079.10a                           |
| `ca/flood`                    | California Flood Disclosure            | Civ. §1102.17                            |
| `fl/radon`                    | Florida Radon Gas Disclosure           | F.S. §404.056(5)                         |
| `fl/security-deposit-bank`    | Florida Security Deposit Bank Notice   | F.S. §83.49(2)                           |
| `ny/window-guard`             | NYC Window Guard Notice                | NYC HC §131.15                           |
| `ny/lead-pamphlet`            | NYC Lead Pamphlet                      | Local Law 1                               |
| `ny/sprinkler`                | NY Sprinkler Disclosure                 | NY RPL §231-a                            |
| `ny/bedbug`                   | NY Bedbug Annual Report                 | NYC Admin Code 27-2018.1                 |
| `il/rlto`                     | Chicago RLTO Summary                    | Chicago Municipal Code 5-12               |
| `tx/parking`                  | TX Parking Rules                        | Tex. Prop. §92.0131                      |
| `tx/smoke-detector`           | TX Smoke Detector Cert                  | Tex. Prop. §92.255                       |
| `nj/truth-in-renting`         | NJ Truth in Renting Statement           | NJSA 46:8-44                             |
| `or/just-cause`               | OR SB-608 Just-Cause Notice             | ORS 90.427                               |

(Add more in Phase 13 as new states are seeded. This minimum unblocks the top 10 + federal compliance.)

## 8. Auto-attach logic (pseudocode)

```ts
async function selectRequiredAddenda(supabase, app, property): Promise<AddendumRow[]> {
  const law = await getStateLaw(supabase, app.lease_state_code);
  const required = new Set<string>();

  // Federal
  if ((property?.year_built ?? 9999) < 1978) required.add('federal/lead-paint');
  required.add('federal/megans-law');

  // State base set — query: WHERE jurisdiction = app.lease_state_code AND is_active = true
  const stateAddenda = await supabase.from('lease_addenda_library')
    .select('slug').eq('jurisdiction', app.lease_state_code).eq('is_active', true);
  for (const r of stateAddenda.data ?? []) required.add(r.slug);

  // Common conditional
  if (app.has_pets || app.lease_pets_policy?.toLowerCase().includes('allowed')) required.add('common/pet-addendum');
  required.add('common/mold');
  required.add('common/smoke-co');
  if (law.security_deposit_separate_account) required.add(`${law.state_code.toLowerCase()}/security-deposit-bank`);

  // Resolve to rows
  return await supabase.from('lease_addenda_library').select('*').in('slug', [...required]);
}
```

## 9. PDF rendering

- After the main lease body + signature block, every required addendum is appended starting on a NEW page.
- Each addendum page header: addendum title, citation, "ADDENDUM #N of M".
- If `signature_required = true`, addendum has its own signature line + initials field.
- If `attached_pdf_path` is set, embed that PDF (use `pdf-lib` `copyPages`) after the addendum text. Lead-paint pamphlet attaches this way.

## 10. Acceptance criteria

- [ ] 21 seeded addenda rows in `lease_addenda_library`.
- [ ] EPA lead pamphlet PDFs (English + Spanish) committed under `assets/legal/`.
- [ ] Generating a CA lease auto-attaches: federal lead (if pre-1978), federal megans-law, common/mold, common/smoke-co, common/pet-addendum (if pets), ca/bedbug, ca/megans-law, ca/flood.
- [ ] Generating a FL lease auto-attaches FL radon + FL security-deposit-bank.
- [ ] If a required state addendum is missing from the library, generate-lease refuses with the specified error.
- [ ] Per-addendum acknowledgments captured in `lease_addenda_attached` after signing.
- [ ] Tenant lease-sign UI shows addenda list with per-section "I have read and agree" checkboxes.

## 11. Push & Stop

- [ ] Master row 04 = `DONE`.
- [ ] Commit: `Lease Phase 04 — state-required disclosures library`.
- [ ] STOP.
