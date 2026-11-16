# Dynamic Application Form Fields — Full Scan & Implementation Plan

## 1. Full Codebase Scan Findings

A complete read-only scan across the primary rental application, co-applicant inline cards, co-applicant private self-completion link, review summary, backend ingestion, and admin application viewer revealed the following gaps:

1. **Primary Step 2 (`Current Housing Status`) Has Zero Dynamic Logic**
   - Selecting **Own (No Mortgage)**, **Own (With Mortgage)**, **Living with Family / Friends**, or **Other** leaves the form locked on rental fields.
   - **Current Rent/Mortgage Amount**, **Reason for leaving**, **Current Landlord/Property Manager Name**, and **Landlord/Property Manager Phone** stay visible, static, and strictly required regardless of housing situation.
2. **Primary Step 2 (`Previous Residence < 24 Months`) Assumes Previous Rental**
   - Checking or triggering the under-24-month prior residence card unconditionally requires **Previous Landlord Name** and **Previous Landlord Phone**, with no prior housing type option if the applicant previously owned a home or lived with family.
3. **Primary Step 3 (`Employment Status`) Partial Logic Has UX & Validation Gaps**
   - While employer/supervisor fields already toggle by employment status, switching a label via text replacement drops/desyncs the visual required asterisk class on labels.
   - Selecting **Unemployed**, **Retired**, or **Student** still shows generic **Gross Monthly Income** ("Before taxes and deductions") with required numeric entry and no tailored source hint or clear `$0` / reserves / assistance guidance.
4. **Step 4 (`Co-Applicant / Guarantor / Co-Signer` Method A Cards) Are Static**
   - **Employment Status** inside additional member cards has no change listener: selecting `Self-employed`, `Student`, `Retired`, or `Unemployed` still displays employer, job title, and duration unchanged.
   - Occupying **Co-Applicant** cards lack a **Housing Status** selector and unconditionally ask for **Current Landlord / Manager** and **Landlord Phone**.
   - **Guarantor / Co-Signer** cards have a **Housing Status** dropdown, but it does not reveal/adapt relevant payment, lender, or living-arrangement details.
5. **Co-Applicant Private Self-Completion Link (`Method B`) Is Completely Static**
   - **Housing Status** is only shown to Guarantors/Co-Signers (not occupying Co-Applicants) and has no change handler; occupying Co-Applicants always see **Current Monthly Rent**, **Current Landlord / Property Name**, and **Landlord Phone**.
   - **Employment / Income Status** (`Employed Full-Time`, `Employed Part-Time`, `Self-Employed`, `Retired / Pension`, `Student`, `Fixed Income / Benefits`, `Other Income Source`) has no change handler and always displays generic employer, work address, job title, start date, and time with employer.
6. **Review Summary, Language Switch, Backend & Admin Display Sync**
   - Summary labels currently display raw field names (such as `Current Rent Amount` or `Current Landlord Name`) even when collected for a mortgage or family host, and primary `housing_status` is stored on the applicant record but not yet surfaced alongside the primary Residence History view in the Admin panel.

---

## 2. Dynamic Field Architecture & State Flow

```
  [ User Selection / Draft Restore / Language Toggle (EN <-> ES) ]
                                 |
        +------------------------+------------------------+
        v                        v                        v
  Step 2: Housing         Step 3: Employment       Step 4 & Method B:
  & Prior Residence       & Income Controller      Per-Member Controllers
        |                        |                        |
        +---> Clear hidden values & stale validation <----+
        +---> Sync labels, placeholders, hints & required (*)
        +---> Update Review Summary & Remaining Required Counter
                                 |
                                 v
        [ Backend Ingestion + Applicant Profile + Admin View ]
```

Whenever a user changes a selector, switches between English and Spanish, toggles "Same address as primary", or reloads a saved draft, a single deterministic UI-sync controller per section will:
- Show only the fields relevant to the selected option (hiding non-applicable inputs cleanly).
- Clear hidden field values and reset any error highlights so hidden fields can never block step navigation or pollute the submission payload.
- Update labels, helper hints, placeholders, and the CSS required indicator (`*`) in both English and Spanish.

---

## 3. Option-by-Option Field Behavior Plan

### A. Step 2 — Current Housing Status (`#section2`)

| Selected Housing Status | Monthly Payment Field | Moving Reason Field | Contact Name Field | Contact Phone Field |
| :--- | :--- | :--- | :--- | :--- |
| **Select status...** *(default)* | Shown (standard default until chosen) | Shown | Shown | Shown |
| **Rent** | **Current Monthly Rent** (Required) | **Reason for leaving** (Required) | **Current Landlord / Property Manager Name** (Required) | **Landlord / Property Manager Phone** (Required) |
| **Own (No Mortgage)** | **Hidden** *(or cleared — no monthly rent/mortgage)* | **Reason for moving / selling or relocating** (Optional) | **Hidden** *(no landlord)* | **Hidden** *(no landlord phone)* |
| **Own (With Mortgage)** | **Current Monthly Mortgage Payment** (Required) | **Reason for moving / relocating** (Optional) | **Mortgage Lender / Servicer Name** (Optional) | **Lender / Servicer Phone** (Optional) |
| **Living with Family / Friends** | **Monthly Housing Contribution ($0 if none)** (Optional) | **Reason for moving** (Required) | **Host / Family Member Name** (Optional) | **Host / Family Member Phone** (Optional) |
| **Other** | **Monthly Housing Cost (Optional)** | **Describe Current Housing & Reason for Moving** (Required) | **Property Contact / Manager Name (Optional)** | **Contact Phone (Optional)** |

- Notice: When switching back and forth between options, any hidden inputs have `required` removed and validation errors cleared immediately, and the bottom **"required fields remaining"** counter recalculates live.
- On the **Step 6 Review Summary**, field labels dynamically match what the applicant actually answered (for example, showing *Monthly Mortgage Payment* or *Host / Family Member* instead of *Current Landlord Name* when non-rent is selected).

### B. Step 2 — Previous Residence (< 24 Months) & Occupancy

- Add a **Previous Housing Status** selector inside the conditional Previous Residence card (`Rent`, `Own (No Mortgage)`, `Own (With Mortgage)`, `Living with Family / Friends`, `Other`, defaulting cleanly).
- Dynamically adapt **Previous Landlord / Manager Name** and **Previous Landlord Phone**:
  - **Rent**: Required landlord/manager name & phone.
  - **Own (With Mortgage) / Own (No Mortgage)**: Hide landlord fields (optional lender/reference not forced).
  - **Living with Family / Friends / Other**: Relabel to **Previous Host / Contact Name (Optional)** and **Contact Phone (Optional)**.
- **Additional Occupants Names**: When `Total Occupants` is `1`, keep the additional occupants textarea clearly marked optional or softly de-emphasized; when `Total Occupants > 1`, remind the user to list the other occupants.

### C. Step 3 — Employment & Income (`#section3`)

| Selected Employment Status | Employer / Source Field | Address & Role / Title | Start Date & Duration | Supervisor Name & Phone | Monthly Income & Hint |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Full-time / Part-time** | **Employer** (Required) | **Employer Address** (Optional), **Job Title** (Required) | **Start Date** (Optional), **How long at this job?** (Required) | **Supervisor Name & Phone** (Required) | **Gross Monthly Income** (Required; pre-tax wages) |
| **Self-employed** | **Business / Trade Name** (Required) | **Business Address** (Optional), **Your Role / Occupation** (Required) | **Start Date** (Optional), **How long in business?** (Required) | **Hidden** *(self-employed has no supervisor)* | **Gross Monthly Business Income** (Required; average monthly gross/draw) |
| **Student** | **School / Institution Name** (Optional) | **Institution Address** (Optional), **Program / Field of Study** (Optional) | **Start Date** (Optional), **Years at Institution** (Optional) | **Hidden** | **Monthly Income / Financial Aid / Support** (Required, `$0` allowed if supported by savings/guarantor) |
| **Retired** | **Primary Retirement / Pension Source** (Optional, e.g., Social Security, Pension) | **Former Employer / Agency** (Optional), **Former Title** (Optional) | **Retirement / Start Date** (Optional), **Years Retired** (Optional) | **Hidden** | **Monthly Retirement / Pension / Benefit Income** (Required) |
| **Unemployed** | **Hidden** | **Hidden** | **Hidden** | **Hidden** | **Monthly Assistance / Unemployment / Savings Draw ($0 if none)** (Required, `$0` explicitly permitted with clear helper hint for guarantor/savings) |

- Synchronize the CSS `.required` class on `<label>` elements every time a field toggles between required and optional so the red `*` indicator always matches validation rules.
- Update the **Additional Monthly Income** helper hint when `Unemployed`, `Retired`, or `Student` is active (highlighting unemployment benefits, Social Security, pension, scholarships, or family support).

### D. Step 4 — Additional Household Members & Supporters (Method A Inline Cards)

When the primary applicant completes details directly on behalf of a Co-Applicant, Guarantor, or Co-Signer:
- **Occupying Co-Applicant Housing**:
  - When **"Same current address as Primary Applicant"** is checked, adapt the label dynamically when Primary isn't renting (avoid saying "same landlord" if Primary owns or lives with family), and inherit Primary's `housing_status` alongside address/duration.
  - When unchecked, include a **Current Housing Status** selector on the card that dynamically shows/hides Landlord Name & Phone (required only for `Rent`, optional Host for `Living with Family`, hidden for `Own`).
- **Non-Occupying Guarantor / Co-Signer Housing**:
  - Wire `.co-housing-status` so selecting `Rent` reveals optional/relevant landlord or monthly housing obligation info if helpful, while `Own` / `Mortgage` / `Family` adapts cleanly without rental jargon.
- **Per-Card Employment Status (`.co-employment-status`)**:
  - Attach a live per-card controller mirroring Step 3:
    - `Unemployed`: hides Employer, Job Title, and Employment Duration; adapts Monthly Income placeholder/label to allow `$0`.
    - `Retired`: changes Employer to **Retirement / Pension Source (Optional)**, hides/adapts Job Title to **Former Title (Optional)**.
    - `Student`: changes Employer to **School / Institution (Optional)** and Job Title to **Program / Field of Study (Optional)**.
    - `Self-employed`: changes Employer to **Business Name (Required)**, Job Title to **Role / Occupation (Required)**.
    - `Full-time` / `Part-time`: standard Employer, Job Title, and Duration.

### E. Co-Applicant Self-Completion Portal (Method B Private Link)

Update the private self-completion flow for both English and Spanish:
- **Housing Status for All Invited Roles**:
  - Expose **Current Housing Status** for occupying Co-Applicants as well as Guarantors/Co-Signers (`Rent`, `Own (No Mortgage)`, `Own (With Mortgage)`, `Living with Family / Friends`, `Other`).
  - Dynamically update/hide **Current Monthly Payment**, **Current Landlord / Host / Lender Name**, **Contact Phone**, and **Reason for Moving** based on the selected housing status (and only clear/hide tenant-occupancy fields for non-occupying supporters).
- **Employment / Income Status Controller**:
  - Wire **Employment / Income Status** (`Employed Full-Time`, `Employed Part-Time`, `Self-Employed`, `Retired / Pension`, `Student`, `Fixed Income / Benefits`, `Other Income Source`) to dynamically adapt **Employer or Income Source**, **Work Address**, **Job Title / Occupation**, **Start Date**, **Time with Employer**, and **Monthly Gross Income ($)** so retired/fixed-income/student applicants aren't confronted with mismatched "Employer / Job Title / Supervisor" prompts.

### F. Backend Persistence, Admin View & Staged Updates

- **Backend Ingestion & Self-Completion**:
  - Persist `housing_status` and `previous_housing_status` cleanly in applicant records (and primary metadata where supported), and ensure validation never rejects legitimate `$0` monthly income for `Unemployed` / `Student` or omitted landlord details for homeowners.
- **Admin Application Detail View**:
  - Display **Housing Status** inside the Residence History section for primary applicants and co-applicants (not only supporters), and label rent/mortgage/host details contextually when viewed by admins.
- **Included Verification & Deployment (With Staged Last-4 SSN Updates)**:
  - The previously implemented **Last-4 SSN conversion** across the application form, co-applicant flow, public guides, admin panel, and Edge Functions is currently staged locally on disk.
  - After your approval of this plan and implementation of the dynamic form logic, we will run end-to-end syntax, build, and lint checks, commit and push all updates to GitHub, deploy the Supabase Edge Functions, and verify Cloudflare Pages live readiness.

---

## 4. Verification Plan (Post-Approval Execution)

1. **Automated Syntax, Build & Lint Checks**: Run JavaScript syntax validation on all modified client scripts plus the full project build and linter.
2. **Interactive Matrix Verification**: Verify every option in Step 2 Housing Status, Previous Residence Housing Status, Step 3 Employment Status, Step 4 Co-Applicant Method A cards, and Method B self-completion link in both English and Spanish, confirming:
   - Hidden fields have `required` stripped and never block Next-Step navigation.
   - Switching options preserves valid state, updates red `*` labels, and updates the Step 6 Review Summary accurately.
   - Draft save & reload restores the exact selected housing/employment options and matching dynamic field visibility.
3. **Repository & Cloud Deployment**: Push cleanly to the connected GitHub repository, deploy updated Supabase Edge Functions, and verify Cloudflare Pages build status.
