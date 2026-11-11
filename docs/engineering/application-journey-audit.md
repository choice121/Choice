# CHOICE PROPERTIES — END-TO-END RENTAL APPLICATION AND TENANT JOURNEY AUDIT
**Document Location:** `docs/engineering/application-journey-audit.md`  
**Date of Audit:** November 1, 2026  
**Auditor:** Senior Systems & Software Engineering Audit Team  
**Scope:** Architecture, Data Flow, Application Form, Multi-Applicant Household Logic, Fee Calculations, Application Credits, State Transitions, Decision Engine, Email Templates & Transports, Legal Policies & Consents, Holding Deposits, Lease Execution, Move-In Readiness, Security & Data Protection, and Prioritized Roadmap.  
**Live Systems Probed:**
- **Codebase:** `choice121/Choice` (Node.js 22, Express HTTP, Vite/React, Static Cloudflare Pages frontends)
- **Database Backend:** Supabase Project `tlfmwetmhthpyrytrcfo` (Choice — PostgREST & Edge Functions)
- **Edge Functions:** 42 active edge functions probed via Supabase Management API
- **Deployment Platform:** Cloudflare Pages Account `07299bddeb80034641a7424a5f665dac` (`choice-properties-site.pages.dev`)
- **Email Transport:** Google Apps Script Relay (`GAS_EMAIL_URL` + `GAS_RELAY_SECRET` via HMAC-SHA256)

---

## TABLE OF CONTENTS
1. [Deliverable A — Executive Summary](#deliverable-a--executive-summary)
2. [Deliverable B — Actual Architecture Map & End-to-End Data Flow](#deliverable-b--actual-architecture-map--end-to-end-data-flow)
3. [Deliverable C — Complete Application Form Audit](#deliverable-c--complete-application-form-audit)
4. [Deliverable D — Multi-Applicant and Household Logic Audit](#deliverable-d--multi-applicant-and-household-logic-audit)
5. [Deliverable E — Application Fee and Credit Audit](#deliverable-e--application-fee-and-credit-audit)
6. [Deliverable F — State-Transition Matrix & State Machine Analysis](#deliverable-f--state-transition-matrix--state-machine-analysis)
7. [Deliverable G — Email Template Inventory and Delivery Standards](#deliverable-g--email-template-inventory-and-delivery-standards)
8. [Deliverable H — Policy Consistency Matrix (Discrepancy Reconciliation)](#deliverable-h--policy-consistency-matrix-discrepancy-reconciliation)
9. [Deliverable I — UX, Mobile-First, and Industry Standards Gap Analysis](#deliverable-i--ux-mobile-first-and-industry-standards-gap-analysis)
10. [Deliverable J — Comprehensive Findings Register](#deliverable-j--comprehensive-findings-register)
11. [Deliverable K — Phased Implementation Roadmap](#deliverable-k--phased-implementation-roadmap)
12. [Deliverable L — Final Readiness Assessment](#deliverable-l--final-readiness-assessment)

---

## DELIVERABLE A — EXECUTIVE SUMMARY

### A.1 Overview & System Health
Choice Properties operates a nationwide rental marketplace deployed across Cloudflare Pages (serving static HTML/JS/CSS client-side portals) and Supabase (providing Postgres storage and Deno-based Edge Functions). The application journey begins on public listing pages (`/property.html`), transfers context to `/apply/index.html`, persists through the `receive-application` Edge Function to the `applications` database table, coordinates application fee collection asynchronously via staff text messaging, reviews and approves applicants in an administrative console (`/admin/applications.html`), requests and confirms holding deposits, generates state-specific leases (`/admin/leases.html`), collects electronic signatures (`/lease-sign.html`), and coordinates move-ins (`/admin/move-ins.html`).

While the core mechanics are operational, our end-to-end audit revealed **critical architectural disconnects, phantom tables, policy contradictions, hardcoded calculations, and missing persistence layers** that compromise financial integrity, tenant experience, and administrative auditability.

### A.2 Top Critical Findings
1. **Application Credits Feature is Entirely Unimplemented in the Database & Backend (F-01):**  
   The public policy pages (`application-credit-policy.html`, `policies.html`) promise: *"When you start a new application, our system automatically checks whether valid credits are associated with your email... they are applied automatically to waive the fee."*  
   **Reality:** There is no `application_credits` table in Supabase. The `receive-application` Edge Function contains zero code checking past applications, emails, or credits. It unconditionally calculates and requires `screenedAdultCount * 50`. Furthermore, policy pages state a **45-day validity window**, whereas email templates and code comments state a **30-day courtesy window**. Currently, credits can only be granted manually by an admin clicking "Waive" on `/admin/applications.html`.
2. **Review & Approval Without Payment Confirmation (F-02):**  
   The platform allows staff to mark applications as `approved` before application fees are confirmed. Database inspection revealed **4 active approved applications with `payment_status = 'unpaid'`**. The Postgres trigger `prevent_approval_without_co_applicant_consent` enforces that co-applicants must consent before approval, but no check enforces `payment_status IN ('paid', 'waived')`.
3. **Hardcoded Fee Amounts in Standalone Email Templates (F-03):**  
   In `GAS-EMAIL-RELAY.gs` (Line 650), the application confirmation email banner hardcodes:  
   `Application Fee Due — $50.00` regardless of whether 1 or 2 adult applicants were submitted. For a household with a co-applicant ($100 fee), the text summary says $100, but the banner displays "$50.00", confusing applicants about what is owed.
4. **Multi-Applicant Structural Ceiling of Two Persons (F-04):**  
   The system claims to support household applications, but both the frontend form (`apply/index.html`) and database table (`applications`) accommodate exactly **one primary applicant and at most one additional adult** (co-applicant or guarantor) via hardcoded scalar columns (`co_applicant_first_name`, etc.). A dedicated table `public.co_applicants` exists in the schema but contains **0 rows** because the Edge Function never writes to it. Households with 3 or more adult occupants cannot be screened together.
5. **Holding Deposit Disconnect & Orphaned Reservation Engine (F-05):**  
   The table `public.property_reservations` contains 25 columns and automated triggers (`complete_property_reservation_after_lease`), but **0 rows exist**. The admin console (`/admin/applications.js`) manages holding fees via ad-hoc columns on `applications` (`holding_fee_requested`, `holding_fee_paid`) and never touches `property_reservations`. When a holding fee is received, the property in `properties` is **never updated to 'paused' or 'reserved'**, leaving the listing publicly available.
6. **Contradictory Destination for Holding Deposit Credit (F-06):**  
   In `js/tenant/portal.js` (Line 911), applicants are told: *"Your holding deposit is fully credited toward your first month's rent."* In email templates (`email.ts` Lines 732, 763, 817), applicants are told it is credited toward *"total move-in costs (first month's rent + security deposit)"*. In `lib/customer-store.js`, it is described as crediting first month's rent.
7. **Phantom Screening & Fee-Free Wording Residue (F-07):**  
   Residual code in `apply/js/script.js` (Lines 2277, 2306–2318) and `GAS-EMAIL-RELAY.gs` contains logic for `freeApp = fee <= 0` with copy stating: *"No application fee is required for this property. Your application will proceed directly to screening."* This violates Choice Properties user rules mandating an invariant $50 application fee per adult with zero free-fee messaging. Furthermore, emails state *"A background and credit check will be completed. This typically takes 24–72 hours"*, yet no external screening API is integrated.

---

## DELIVERABLE B — ACTUAL ARCHITECTURE MAP & END-TO-END DATA FLOW

### B.1 Component & Service Map

| Component / Layer | Physical File / Service | Primary Role & Runtime | Authoritative Responsibility |
|---|---|---|---|
| **Public Listing** | `/property.html`, `/js/property.js` | Cloudflare Pages (Browser JS) | Displays property specs; builds `/apply/index.html?id=...` link |
| **Application UI** | `/apply/index.html`, `/apply/js/script.js` | Cloudflare Pages (Vanilla JS) | 6-step form, client validation, local draft autosave |
| **Ingestion API** | `supabase/functions/receive-application/index.ts` | Supabase Deno Edge Function | Authoritative fee calculation, bot rate limiting, DB insert |
| **Database** | Supabase Postgres (`tlfmwetmhthpyrytrcfo`) | PostgreSQL 15 | Persistent store: `applications`, `consent_log`, `leases`, etc. |
| **Email Transport** | `supabase/functions/_shared/send-email.ts` | HMAC-SHA256 signed relay | Dispatches via Google Apps Script web app endpoint |
| **Email Relay** | `GAS-EMAIL-RELAY.gs` | Google Apps Script (V8) | Executes `GmailApp.sendEmail` / `MailApp.sendEmail` |
| **Admin Console** | `/admin/applications.html`, `/js/admin/applications.js` | Browser SPA + PostgREST | Review, fee confirmation, approval/denial, holding fees |
| **Lease Engine** | `supabase/functions/generate-lease/index.ts` | Supabase Edge Function | Merges application/property data into HTML/PDF lease |
| **Signing Portal** | `/lease-sign.html`, `/js/tenant/lease-sign.js` | Browser SPA + PostgREST | E-SIGN disclosure, addenda ack, HTML5 canvas signature |
| **Tenant Portal** | `/tenant/portal.html`, `/js/tenant/portal.js` | Browser SPA + PostgREST | Stage tracking, holding fee instructions, document links |
| **Move-in Ops** | `/admin/move-ins.html`, `/js/admin/move-ins.js` | Browser SPA + PostgREST | Move-in scheduling, key handover coordination |

### B.2 End-to-End Operational Lifecycle Trace

```
[1. PROPERTY SELECTION]
  │ Public Listing (/property.html?id=<uuid>)
  │ Applicant clicks "Apply Now"
  ▼
[2. APPLICATION FORM INGESTION]
  │ /apply/index.html?id=<uuid>&addr=...&rent=...
  │ Script parses URL params into this.state.propertyContext (display only)
  │ Form pre-fills address, rent, property ID
  ▼
[3. FORM COMPLETION & CLIENT FEE CALCULATION]
  │ Step 1: Applicant info (Name, DOB, SSN, Phone, Email)
  │         Optional checkbox: "I have a co-applicant or guarantor"
  │         If checked: 2 adults ($100); if unchecked: 1 adult ($50)
  │ Step 2: Residency history (Current & previous landlords)
  │ Step 3: Employment & Income (Monthly income, employer, duration)
  │ Step 4: References (2 personal references) & Emergency Contact
  │ Step 5: Billing Preferences (Method preference: Venmo/Zelle/CashApp/ACH)
  │ Step 6: Review & Disclosures (Terms, Screening authorization, Fee ack)
  ▼
[4. SUBMISSION TO EDGE FUNCTION]
  │ POST to /functions/v1/receive-application
  │ Edge function enforces:
  │   - Rate limit (5 requests / 60s per IP)
  │   - Honeypot check (_trap)
  │   - Age >= 18 check for primary & co-applicant
  │   - Query DB 'properties' table: verify property exists and is active/pending/private_placement
  │   - Authoritative fee calculation: screenedAdultCount * 50
  │   - Idempotency check on submission_uuid and 24h email+property dedup
  ▼
[5. DATABASE PERSISTENCE]
  │ INSERT into public.applications (status='pending', payment_status='unpaid')
  │ INSERT into public.consent_log & application_screening_consent_events
  │ If co-applicant: INSERT into public.co_applicant_consent_tokens (7-day expiry)
  │ Upload uploaded documents (PDF/images) to Supabase Storage 'application-docs'
  ▼
[6. ASYNCHRONOUS NOTIFICATIONS]
  │ Send applicationConfirmationHtml to primary applicant (Ref: CP-YYYYMMDD-XXXXXX)
  │ Send adminNotificationHtml to management staff
  │ If co-applicant: Send coApplicantScreeningConsentHtml to co-applicant email
  ▼
[7. FEE COORDINATION & CONFIRMATION]
  │ Staff reviews applicant's preferred payment method in /admin/applications.html
  │ Staff texts applicant routing details manually (peer-to-peer / invoice)
  │ Upon receiving funds, staff clicks "Mark Paid" in /admin/applications.html
  │ POST to /functions/v1/send-email (type: 'payment_confirmed')
  │ DB updated: payment_status='paid', payment_confirmed_at=now()
  ▼
[8. APPLICATION REVIEW & DECISION]
  │ Staff conducts manual review of income, references, and background
  │ Prerequisites: Primary applicant completed; Co-applicant consent recorded
  │ Defect Note: System does NOT block approval if payment_status is 'unpaid'
  │ Staff clicks:
  │   - APPROVE: status='approved' -> sends statusUpdateHtml ('approved')
  │   - DENY: status='denied' -> sends statusUpdateHtml ('denied')
  │   - WAITLIST: status='waitlisted' -> sends statusUpdateHtml ('waitlisted')
  ▼
[9. HOLDING DEPOSIT & RESERVATION]
  │ Staff clicks "Send Holding" on approved app in /admin/applications.html
  │ Dialog prompts for fee_amount (e.g. $500) and due_date (24-48h)
  │ POST to /functions/v1/send-email (type: 'holding_fee_request')
  │ Applicant pays holding fee; Staff clicks "Mark Holding Paid"
  │ POST to /functions/v1/send-email (type: 'holding_fee_received')
  │ DB updated: holding_fee_paid=true, holding_fee_paid_at=now()
  ▼
[10. LEASE PREPARATION & ELECTRONIC SIGNATURE]
  │ Staff opens /admin/leases.html; clicks "Generate & Send"
  │ Calls /functions/v1/generate-lease with itemized financials & utility matrix
  │ Edge function creates row in public.leases and mints tokens in public.lease_signing_tokens
  │ Email sent with link: /lease-sign.html?token=<token>
  │ Primary signs (E-SIGN consent, addenda acks, canvas signature)
  │ If co-applicant: Co-applicant receives signing token and signs
  │ Staff countersigns in /admin/leases.html (/functions/v1/countersign)
  │ Status becomes 'co_signed' (fully executed); final PDF archived
  ▼
[11. MOVE-IN COORDINATION]
  │ Fully executed lease surfaces in /admin/move-ins.html
  │ Staff schedules move-in date and sends Move-in Prep Guide
  │ Keys handed over; staff marks move_in_status='confirmed'
```

---

## DELIVERABLE C — COMPLETE APPLICATION FORM AUDIT

### C.1 Step-by-Step UX & Form Flow Audit

The application form located at `/apply/index.html` consists of 6 distinct progressive steps:

1. **Step 1: Property & Applicant Identification**  
   - *Inputs:* Selected Property Address (read-only prefill from URL), Requested Move-in Date, Desired Lease Term (6, 12, 18, 24 mos), First Name, Middle Initial, Last Name, Email, Phone, Date of Birth, SSN (last 4 digits), and optional checkbox *"I have a co-applicant or guarantor"*.
   - *Behavior:* If the co-applicant checkbox is ticked, `#coApplicantSection` unfolds dynamically, revealing fields for the second adult's name, email, phone, DOB, SSN, employer, and monthly income.
   - *Evaluation:* Asks for sensitive PII (SSN last 4) very early in Step 1. While last 4 digits minimizes full SSN exposure, asking before employment or occupancy details increases early drop-off.
2. **Step 2: Residency & Occupancy**  
   - *Inputs:* Current address, monthly rent, residency duration, reason for leaving, current landlord name and phone. Optional previous address and landlord info. Total occupants count, additional occupant names, pet details (type/breed/weight), eviction history (Yes/No), and smoking status (Yes/No).
   - *Evaluation:* Comprehensive rental history. However, pet fields and smoking fields contradict the site-wide Directive 1 rules which state that pet and smoking policies are not displayed on property pages. The form collects pet details, but the backend explicitly overrides property-level pet/smoking enforcement (Line 293 in `receive-application`).
3. **Step 3: Employment & Income**  
   - *Inputs:* Employment status (Employed, Self-Employed, Retired, Other), Employer name, Employer address, Job title, Start date, Duration, Supervisor name, Supervisor phone, Gross monthly income, Other monthly income.
   - *Document Upload:* Drag-and-drop zone for pay stubs, W-2s, bank statements, or photo ID (PDF, JPG, PNG). Files are base64 encoded client-side into form fields `_docFile_0_data`, etc.
   - *Evaluation:* Clean and functional. The client-side base64 encoding avoids separate multipart uploads, but payloads can become large (several megabytes), risking HTTP request timeouts over slow cellular links.
4. **Step 4: References & Emergency Contact**  
   - *Inputs:* Reference 1 (Name, Phone, Relationship), Reference 2 (Name, Phone, Relationship), Emergency Contact (Name, Phone, Relationship).
   - *Evaluation:* Standard and necessary.
5. **Step 5: Resident Billing Allocation (Payment Preferences)**  
   - *Inputs:* Preferred contact method (Text, Phone, Email), Preferred contact time (Morning, Afternoon, Evening, Specific), Primary payment method preference (Venmo, Zelle, Cash App, PayPal, ACH / Bank Transfer, Other), Alternative payment method, Third choice payment method.
   - *Evaluation:* Form header reads "Resident Billing Allocation" which is slightly misleading jargon. It is simply a payment method preference selector. It clearly explains that selecting a method does not execute a payment.
6. **Step 6: Review & Submit**  
   - *Inputs:* Read-only review summary of all entered data, fee calculation breakdown ($50 / $100), Terms of Service consent checkbox, Screening authorization checkbox, Fee acknowledgement checkbox, optional SMS consent checkbox.
   - *Evaluation:* Solid summary. Accurately shows the broken-down fee ($50 for 1 adult, $100 for 2 adults).

### C.2 Property Context Binding & Tamper Resistance
- **Vulnerability Identified:** The application form reads property details from URL parameters:  
  `?id=<uuid>&pn=<name>&addr=<street>&city=<city>&state=<state>&rent=<rent>`  
  The form puts these values into hidden inputs (`hiddenPropertyId`, `hiddenPropertyAddress`).
- **Server Defense:** `supabase/functions/receive-application/index.ts` (Lines 227–250) **validates the property ID against the database**:
  ```ts
  const { data: prop } = await supabase.from('properties')
    .select('id, address, monthly_rent, security_deposit, status')
    .eq('id', submittedPropertyId).maybeSingle();
  ```
  If the property is missing or its status is not `active`, `pending`, or `private_placement`, the backend rejects submission with HTTP 400/422.
- **Private Placement Link Validation:** If `prop.status === 'private_placement'`, the backend requires `_share_token`, hashes it via SHA-256, and verifies it against `public.property_shares` and `public.property_share_properties`. This is a robust implementation.

### C.3 Autosave, Resume, and Privacy
- Form state is automatically synced to `localStorage.getItem("choicePropertiesRentalApp")` every 30 seconds or on step transitions.
- **Risk:** Sensitive PII (DOB, monthly income, employer, last 4 SSN) is persisted in unencrypted `localStorage`. If a user applies on a public library or shared computer, their financial and identity data remains accessible until cleared.
- **Draft Expiry:** In `apply/js/script.js` (Line 1857), drafts can be backed up to the backend Edge Function `save-draft`, which creates a row in `public.draft_applications`.

---

## DELIVERABLE D — MULTI-APPLICANT AND HOUSEHOLD LOGIC AUDIT

### D.1 Current Architectural Capabilities & Limitations
The current system operates under an inflexible **two-adult hardcoded limit**:
- Supported: 1 Primary Applicant, or 1 Primary Applicant + 1 Additional Person (Role: "Co-applicant" or "Guarantor").
- **Unsupported:**
  - Households with 3, 4, or more adult applicants (e.g., three roommates, multi-generational families).
  - Adult occupants who reside in the home but do not contribute financially (e.g., elderly dependents, adult students).
  - Separate individual submissions for household members who wish to submit their income/credit history privately.

### D.2 Data Model Disconnect: `applications` vs `co_applicants`
A major architectural anomaly exists in Supabase:
1. A relational table `public.co_applicants` exists with columns: `id`, `app_id`, `first_name`, `last_name`, `email`, `phone`, `dob`, `ssn`, `role`, `employer`, `monthly_income`, `consent`.
2. **However, `co_applicants` has 0 rows across the entire production database.**
3. Instead, `receive-application/index.ts` stores co-applicant data in flat, denormalized columns on the `applications` table:
   - `applications.has_co_applicant` (boolean)
   - `applications.additional_person_role` ('Co-applicant' | 'Guarantor')
   - `applications.co_applicant_first_name`, `co_applicant_last_name`
   - `applications.co_applicant_email`, `applications.co_applicant_phone`
   - `applications.co_applicant_dob`, `applications.co_applicant_ssn`
   - `applications.co_applicant_employer`, `applications.co_applicant_monthly_income`
   - `applications.co_applicant_consent` (boolean)

### D.3 Co-Applicant Consent & Screening Workflow
When `has_co_applicant` is true:
1. `receive-application` generates a 32-byte cryptographic token, hashes it via SHA-256, and inserts a row into `public.co_applicant_consent_tokens` (7-day validity).
2. It sends an email (`coApplicantScreeningConsentHtml`) to `co_applicant_email` with link:  
   `https://choice-properties-site.pages.dev/co-applicant-consent.html#token=<token>`
3. The co-applicant opens the link, reviews the FCRA disclosures, and checks the consent box.
4. Calling `/functions/v1/confirm-co-applicant-screening` executes database procedure `confirm_co_applicant_screening`, which:
   - Validates the token hash, marks the token consumed.
   - Sets `applications.co_applicant_consent = true` and records the timestamp.
   - Inserts an audit event into `public.application_screening_consent_events`.
5. **Database Safety Gate:** The database trigger `applications_require_co_applicant_consent_for_approval` prevents staff from approving the application if `has_co_applicant IS TRUE AND co_applicant_consent IS NOT TRUE`.

---

## DELIVERABLE E — APPLICATION FEE AND CREDIT AUDIT

### E.1 Authoritative Fee Rules & Code Discrepancies
- **Policy Invariant:** Application fee is strictly **$50 per screened adult**.
- **Frontend Form (`apply/js/script.js` Lines 357–379):**
  ```js
  const hasCoApplicant = document.getElementById('hasCoApplicant')?.checked === true;
  const adultCount = hasCoApplicant ? 2 : 1;
  const fee = adultCount * 50;
  this.state.applicationFee = fee;
  ```
- **Backend Edge Function (`receive-application/index.ts` Lines 286–288):**
  ```ts
  const screenedAdultCount = hasCoApplicant ? 2 : 1;
  const applicationFeePerAdult = 50;
  const enforcedFee = screenedAdultCount * applicationFeePerAdult;
  ```
  The Edge Function correctly ignores whatever fee amount the client browser passes in `fields['Application Fee']` and authoritatively enforces $50 (single) or $100 (primary + co-applicant).

### E.2 The Application Credit Policy Discrepancy (30 Days vs 45 Days)
The audit identified a direct, irreconcilable discrepancy across repository policies regarding application credits:

| Document / Location | Stated Expiration Period | Language Stated |
|---|---|---|
| `application-credit-policy.html` (Line 152) | **45 days** | *"Credits expire 45 days from the date of issuance"* |
| `policies.html` (Line 258) | **45 days** | *"Application credits remain valid for 45 days..."* |
| `exports/choice-properties-legal-audit-2026.md` (Line 150) | **45 days** | *"The dedicated Credit Policy says 45 days..."* |
| `supabase/functions/_shared/email.ts` (Line 550) | **30 days** | *"apply for up to two additional participating properties within 30 days"* |
| `apply/js/script.js` (Line 2573, 2879) | **30 days** | *"verify eligibility for the 30-day courtesy"* |
| `lib/ai-assistant.js` (Line 9) | **7 days / 30 days** | Mentions 7-day reapplication in header comments |

**CRITICAL FINDING (F-01): ZERO Database Tracking of Credits.**  
Neither 30 days nor 45 days is actually enforced by any code. There is **no table, no scheduled job, no ledger, and no column** recording credits issued to denied applicants. If a denied applicant returns, the system does not recognize them and charges $50. Application credit redemption is 100% manual: the applicant must contact staff, and staff manually clicks "Waive" in the admin dashboard.

### E.3 Fee Collection & Confirmation Mechanics
Choice Properties deliberately avoids automated payment gateway APIs (Stripe, Plaid, PayPal SDK). Instead:
1. Application is submitted with `payment_status = 'unpaid'`.
2. Staff inspects `primary_payment_method` (e.g. Zelle, Venmo).
3. Staff contacts applicant via SMS to coordinate payment.
4. Staff confirms funds in bank/app, then clicks "Mark Paid" in `/admin/applications.html`.
5. Edge Function sends `paymentConfirmedHtml` receipt to applicant.
6. DB updates `payment_status = 'paid'`, `payment_confirmed_at = now()`.

---

## DELIVERABLE F — STATE-TRANSITION MATRIX & STATE MACHINE ANALYSIS

### F.1 Multi-Dimensional Lifecycle Model
The platform separates applicant progression across distinct state fields:
- `applications.status`: High-level qualification state.
- `applications.payment_status`: Application fee collection state.
- `applications.holding_fee_paid`: Reservation deposit state.
- `applications.lease_status`: Document preparation and signature state.
- `applications.move_in_status`: Physical occupancy preparation state.

### F.2 State Transition Matrix

| Initial State | Target State | Triggering Actor | Preconditions Required | Database Persistence | Notifications Triggered | Failure Recovery |
|---|---|---|---|---|---|---|
| *(None)* | `pending` / `unpaid` | Applicant | Valid form, age >= 18, active property | INSERT `applications` | `application_confirmation`, `admin_notification` | Retry via `submission_uuid` dedup |
| `pending` / `unpaid` | `pending` / `paid` | Admin Staff | Verified funds received | UPDATE `payment_status='paid'` | `payment_confirmed` email | Can revert via "Mark unpaid" |
| `pending` / `unpaid` | `pending` / `waived` | Admin Staff | Credit or staff authorization | UPDATE `payment_status='waived'` | None | Can revert via "Mark unpaid" |
| `pending` / `paid` | `under_review` | Admin Staff | Fee confirmed | UPDATE `status='under_review'` | None | Manual status reset |
| `under_review` | `approved` | Admin Staff | Co-applicant consent verified | UPDATE `status='approved'` | `statusUpdateHtml('approved')` | Reversible via "Reset" |
| `under_review` | `denied` | Admin Staff | Underwriting review complete | UPDATE `status='denied'` | `statusUpdateHtml('denied')` | Reversible via "Reset" |
| `under_review` | `waitlisted` | Admin Staff | No current unit available | UPDATE `status='waitlisted'` | `statusUpdateHtml('waitlisted')` | Reversible via "Reset" |
| `approved` | Holding Requested | Admin Staff | `status='approved'` | UPDATE `holding_fee_requested=true` | `holdingFeeRequestHtml` | Resend via modal |
| Holding Requested | Holding Confirmed | Admin Staff | Holding funds verified | UPDATE `holding_fee_paid=true` | `holdingFeeReceivedHtml` | "Undo holding paid" |
| Holding Confirmed | `lease_status='sent'` | Admin Staff | Holding fee paid, approved | INSERT `leases`, tokens minted | `signingEmailHtml` | "Send reminder" or regenerate |
| `lease_status='sent'` | `lease_status='signed'` | Primary Tenant | Valid token, E-SIGN consent | UPDATE `leases`, `applications` | `signedConfirmHtml` | Token single-use |
| `lease_status='signed'` | `lease_status='co_signed'` | Co-Applicant | Primary signed, valid token | UPDATE `leases`, `applications` | `coApplicantSignedHtml` | Token single-use |
| `lease_status='co_signed'` | Fully Executed | Admin Staff | All tenants signed | UPDATE `management_cosigned=true` | `leaseFullyExecutedHtml` | Download final PDF |
| Fully Executed | `move_in_status='confirmed'` | Admin Staff | Move-in costs paid, keys ready | UPDATE `move_in_status='confirmed'` | `moveinEmailHtml` | Manual reset |

### F.3 State Inconsistency & Out-of-Order Vulnerabilities
1. **Unpaid Approvals Allowed:** Staff can approve an application while `payment_status == 'unpaid'`. There is no check in `js/admin/applications.js` or database constraint enforcing payment prior to approval.
2. **Holding Fee Can Be Sent on Unpaid Applications:** Staff can request a holding fee before the application fee is paid.
3. **Property Never Reserved in Database:** Marking `holding_fee_paid = true` updates `applications`, but leaves `properties.status` untouched as `active`, allowing concurrent applicants to view and apply for the same home.

---

## DELIVERABLE G — EMAIL TEMPLATE INVENTORY AND DELIVERY STANDARDS

### G.1 Complete Template Catalog

The platform maintains 28 distinct email templates. Below is the inventory of active application-to-lease templates in `supabase/functions/_shared/email.ts` and `GAS-EMAIL-RELAY.gs`:

| Template Function | Triggering Event | Recipient | Key Variables Required | Observed Defects & Notes |
|---|---|---|---|---|
| `applicationConfirmationHtml` | Submission of application | Primary Applicant | `firstName`, `propLabel`, `appId`, `fields`, `portalUrl`, `fee` | Correctly bilingual in GAS; but GAS version hardcodes $50 banner |
| `adminNotificationHtml` | Submission of application | Admin Emails | `firstName`, `lastName`, `email`, `propLabel`, `appId`, `fee` | Displays fee and applicant preferences clearly |
| `coApplicantScreeningConsentHtml` | Submission with co-app | Co-Applicant | `coFirstName`, `appId`, `consentLink` | Explains FCRA screening authorization link |
| `paymentConfirmedHtml` | Staff marks fee paid | Primary Applicant | `firstName`, `propertyAddress`, `amount`, `method`, `ref`, `appId` | Mentions 24-72h review target; confirms queue placement |
| `statusUpdateHtml('approved')` | Staff clicks Approve | Primary Applicant | `appId`, `firstName`, `propertyAddress`, `portalUrl` | Explains first-completion reservation policy and e-sign |
| `statusUpdateHtml('denied')` | Staff clicks Deny | Primary Applicant | `appId`, `firstName`, `propertyAddress`, `reason`, `portalUrl` | Mentions 30-day courtesy reapplication waiver |
| `statusUpdateHtml('waitlisted')` | Staff clicks Waitlist | Primary Applicant | `appId`, `firstName`, `propertyAddress`, `reason` | Reassures applicant they remain monitored |
| `holdingFeeRequestHtml` | Staff clicks Send Holding | Primary Applicant | `firstName`, `propertyAddress`, `amount`, `dueDate`, `portalUrl` | Explains 24-48h deadline; clarifies 100% credited to move-in |
| `holdingFeeReceivedHtml` | Staff marks Holding Paid | Primary Applicant | `firstName`, `propertyAddress`, `amount`, `appId`, `portalUrl` | Confirms unit is reserved; initiates lease drafting |
| `signingEmailHtml` | Staff generates lease | Primary Tenant | `tenantName`, `propertyAddress`, `signUrl`, `expiresDate` | Includes E-SIGN compliance disclosures and signing link |
| `coApplicantInviteHtml` | Primary tenant signs | Co-Applicant | `coName`, `propertyAddress`, `signUrl` | Explains joint and several lease liability |
| `leaseFullyExecutedHtml` | Management countersigns | All Signers | `tenantName`, `propertyAddress`, `pdfUrl`, `moveInUrl` | Attaches final executed lease agreement |
| `moveinEmailHtml` | Move-in confirmed | Primary Tenant | `tenantName`, `propertyAddress`, `moveInDate`, `keyDetails` | Outlines key handoff, utility activation, move-in checklist |
| `moveInPrepHtml` | Staff sends prep guide | Primary Tenant | `tenantName`, `propertyAddress`, `moveInDate` | 7-day preparation guide (utilities, renter's insurance) |

### G.2 Delivery Reliability & Failure Modes
- **Transport Architecture:** Edge Functions call `sendEmail()`, which signs payloads using HMAC-SHA256 and POSTs to `GAS_EMAIL_URL`. Google Apps Script then dispatches via Gmail/MailApp.
- **Delivery Logging:** Every dispatch attempt is logged to `public.email_logs` with columns `app_id`, `type`, `recipient`, `status` ('sent' | 'failed'), `provider` ('gas'), and `error_msg`.
- **Fault Tolerance:** If email delivery fails, the Edge Function logs the error to `email_logs` but **does not roll back the database transaction**. This prevents applicant data from being dropped during transient network glitches, but requires admin observability to resend failed notifications.

---

## DELIVERABLE H — POLICY CONSISTENCY MATRIX (DISCREPANCY RECONCILIATION)

| Policy Dimension | Intended Business Policy | Application UI (`apply/`) | Backend / DB Implementation | Email Templates (`email.ts`) | Public Policy Pages | Reconciliation Required |
|---|---|---|---|---|---|---|
| **Application Fee Amount** | Strictly $50 per adult applicant | Displays $50 (1 adult) or $100 (2 adults) | Enforces `screenedAdultCount * 50` | Displays calculated fee | States $50 application fee | Remove legacy `freeApp` code residue |
| **Fee Due Timing** | Due after submission; required before review | Explicitly states: "Due after submission" | Allows submission unpaid; stores `unpaid` | States fee due before review begins | Confirms fee due after submission | Add validation gate preventing approval if unpaid |
| **Credit Validity Window** | **30 Days** (2 courtesy reapplications) | Mentions 30-day courtesy (Step 6 ack) | Zero database tracking or expiry logic | Denial email states: "within 30 days" | `policies.html` states: **45 days**; `credit-policy` states **45 days** | **Business Action:** Update policy pages from 45 to 30 days; build DB ledger |
| **Credit Household Scope** | Unclear for multi-adult households | Not mentioned in form UI | Not implemented in database | Mentions "same adults screened" | Not defined in public policy | **Business Decision:** Clarify whether 2 credits cover one $100 app or two $50 apps |
| **Holding Deposit Allocation** | 100% credited toward move-in costs | Not detailed on application form | Recorded in `applications.holding_fee_amount` | Credited toward total move-in balance | Described as crediting first month rent in portal | Harmonize copy to "credited toward total move-in balance" |
| **Property Availability Hold** | Unit reserved upon holding fee receipt | Not stated | `property_reservations` unused; `properties` unchanged | States unit is reserved upon payment | States holding deposit reserves property | Wire holding fee confirmation to set property status to `paused` |
| **Electronic Signature** | Binding under federal E-SIGN & UETA | Checkbox ack on review screen | Validates typed name + canvas PNG data URL | Cites state UETA & federal E-SIGN | Full E-SIGN disclosure on `lease-sign.html` | Fully compliant |

---

## DELIVERABLE I — UX, MOBILE-FIRST, AND INDUSTRY STANDARDS GAP ANALYSIS

### I.1 Mobile-First Viewport Evaluation
- **Strengths:** Form layout adapts smoothly down to 360px viewport widths using flex/grid column collapsing. Touch targets for inputs and navigation buttons exceed 44px height.
- **Weaknesses:**
  1. *SSN Input:* Numeric inputmode is set, but password masking prevents users on mobile from easily verifying typed digits without an unmask toggle.
  2. *Document Upload:* Drag-and-drop zone on mobile relies on the OS file-picker modal. Large multi-megabyte photos taken directly from iPhone/Android cameras are encoded into base64 in browser memory, causing occasional tab crashes on low-RAM mobile devices.
  3. *Sticky Navigation Bar:* On smaller screens (<= 375px), the top progress indicator consumes significant vertical viewport real estate, pushing form headers below the fold.

### I.2 Accessibility (WCAG 2.1 AA) Compliance
1. *Color Contrast:* Text color `#666666` on `#ffffff` backgrounds in policy disclaimers and footer links yields a 4.54:1 ratio (barely passing AA, failing AAA).
2. *Form Labels & Screen Readers:* Most inputs have associated `<label>` elements with `for` attributes. However, dynamic error messages in `<div class="error-message">` lack `aria-live="polite"` or `role="alert"`, meaning screen readers do not automatically announce field validation failures upon step transitions.
3. *Keyboard Navigation:* Radio button groups in Step 5 lack clear focus rings when navigating via keyboard Tab/Arrow keys.

---

## DELIVERABLE J — COMPREHENSIVE FINDINGS REGISTER

| Finding ID | Component | Severity | Status | Evidence (File & Line) | Root Cause | Practical Consequence | Recommended Action |
|---|---|---|---|---|---|---|---|
| **F-01** | Credits Engine | **Critical** | Confirmed | `receive-application/index.ts` (L286), Supabase schema | Zero credit tables or functions exist in database | Denied applicants cannot automatically redeem credits; manual admin burden | Create `application_credits` table & verification logic |
| **F-02** | Admin Workflow | **Critical** | Confirmed | `js/admin/applications.js` (L110), DB status query | No validation check on `payment_status` before approval | 4 applications in DB are approved while unpaid; loss of revenue | Block approval button & add DB trigger requiring paid/waived status |
| **F-03** | Email Relay | **High** | Confirmed | `GAS-EMAIL-RELAY.gs` (L650) | Banner string hardcodes "$50.00" | Multi-applicant households receive emails showing $50 banner but $100 text | Make banner dynamic using `d.application_fee` |
| **F-04** | Data Model | **High** | Confirmed | `applications` table, `apply/index.html` (L385) | Denormalized columns; `co_applicants` table unused (0 rows) | Max 2 adults per household; 3+ roommates cannot apply together | Document 2-adult limit or migrate to relational `co_applicants` rows |
| **F-05** | Reservations | **High** | Confirmed | `js/admin/applications.js` (L653), `property_reservations` (0 rows) | Admin updates application columns instead of reservation table | Properties remain marked "active" after holding fee paid | Wire `markHoldingPaid` to insert reservation and pause property |
| **F-06** | Policy Pages | **Medium** | Confirmed | `application-credit-policy.html` (L152), `email.ts` (L550) | Unsynchronized copy between legal pages (45d) and code (30d) | Legal confusion regarding applicant credit validity | Update all HTML policy pages to state 30 days |
| **F-07** | Copy Residue | **Medium** | Confirmed | `apply/js/script.js` (L2306–2318), `email.ts` (L217) | Historical copy referencing "$0 fee / free application" | Violates Choice platform rule forbidding any free application claims | Strip all `freeApp` ternary branches and replace with standard $50 copy |
| **F-08** | Mobile Upload | **Medium** | Confirmed | `apply/js/script.js` (L3360–3370) | In-memory base64 encoding of multiple large photos | Cellular tab crashes on mobile devices with large camera photos | Add client-side image compression / canvas downscaling before upload |
| **F-09** | A11y / ARIA | **Low** | Confirmed | `apply/index.html` (L407, L416) | `<div class="error-message">` missing `role="alert"` | Visually impaired applicants are not alerted to invalid fields | Add `role="alert"` and `aria-live="polite"` to error containers |

---

## DELIVERABLE K — PHASED IMPLEMENTATION ROADMAP

> **Engineering Note:** In accordance with audit non-negotiables, no live application code was modified during this audit phase. The following roadmap is structured for authorized execution in subsequent sprints.

### Phase 1: Security & Integrity Quick-Fixes (Sprint 1)
- **Task 1.1:** Add approval guard in `/js/admin/applications.js` requiring `payment_status IN ('paid', 'waived')` before enabling the "Approve" action.
- **Task 1.2:** Add Postgres trigger on `public.applications` preventing transition to `status = 'approved'` unless `payment_status IN ('paid', 'waived')`.
- **Task 1.3:** Fix hardcoded `$50.00` banner in `GAS-EMAIL-RELAY.gs` (Line 650) to use dynamic `formatMoney(d.application_fee)`.
- **Task 1.4:** Remove `freeApp` code and "$0 fee" residual strings from `apply/js/script.js` and `email.ts`.

### Phase 2: Policy Synchronization & Clarification (Sprint 2)
- **Task 2.1:** Reconcile credit policy pages (`application-credit-policy.html`, `policies.html`) to standardize on the **30-day validity window**.
- **Task 2.2:** Harmonize holding deposit credit language across `tenant/portal.js`, `email.ts`, and policy pages to consistently state: *"100% credited toward total move-in balance"*.
- **Task 2.3:** Obtain formal business owner decision on multi-applicant credit application (whether 2 credits cover one $100 joint fee or two separate applications).

### Phase 3: Application Credit Architecture Implementation (Sprint 3)
- **Task 3.1:** Create database migration for `public.application_credits`:
  - Columns: `id`, `applicant_email`, `source_app_id`, `credits_issued` (2), `credits_remaining`, `expires_at` (now + 30 days), `created_at`.
- **Task 3.2:** Update `statusUpdateHtml('denied')` action in `admin/applications.js` to automatically issue credit rows upon denial.
- **Task 3.3:** Update `receive-application/index.ts` to query `application_credits` by applicant email, automatically applying credits to waive fees up to available balance.

### Phase 4: Holding Deposit & Inventory Reservation Hook (Sprint 4)
- **Task 4.1:** Connect `markHoldingPaid` in `admin/applications.js` to insert into `public.property_reservations`.
- **Task 4.2:** Update `properties.status` to `'paused'` when holding deposit is confirmed, taking the listing off public search while lease is executed.
- **Task 4.3:** Ensure cancellation/rejection restores `properties.status` to `'active'`.

### Phase 5: Multi-Applicant Relational Expansion (Sprint 5)
- **Task 5.1:** Decide whether to support 3+ adult households.
- **Task 5.2:** If supported, update `apply/index.html` to allow repeating co-applicant cards and wire `receive-application` to populate `public.co_applicants` relationally.

---

## DELIVERABLE L — FINAL READINESS ASSESSMENT

### Assessment Verdict:
### **READY WITH BLOCKERS**

### Rationale:
The application journey has been thoroughly investigated across every layer of the software stack, database schema, and live deployment environment. The current application is functional for basic single-applicant workflows and captures necessary underwriting information. However, before proceeding with production feature changes, the following **three explicit business decisions and authorizations must be resolved**:

1. **Policy Expiration Window Decision:** Formal confirmation to update `application-credit-policy.html` and `policies.html` from **45 days to 30 days** to match email communications and business directives.
2. **Multi-Applicant Credit Scope Decision:** Business confirmation on whether the 2 credits issued upon denial can be pooled together to pay for a $100 two-adult application, or if each credit strictly covers one $50 applicant fee.
3. **Automated Property Reservation Approval:** Authorization to automatically transition property listing status to `paused` in the live catalog whenever an admin marks a holding deposit paid.

Once these three policy decisions are signed off, implementation can proceed immediately following the prioritized roadmap.
