# MIGRATION.md — Choice Properties: GAS → Supabase Migration
## Living Project Guide — Read This First

---

> **FOR ANY AI BEGINNING WORK ON THIS PROJECT:**
> Before writing a single line of code, you MUST read:
> 1. This file (`MIGRATION.md`) — the project context and phase tracker
> 2. `MIGRATION_SCHEMA.sql` — the authoritative SQL for all tables and policies
> 3. `MIGRATION_PATTERNS.md` — every coding convention you must follow
>
> These files exist precisely because multiple AIs across multiple platforms
> and sessions are working on this project. Contradictory decisions and
> lost context are the two failure modes this documentation prevents.
> Do not trust your own assumptions — trust these files.

---

## THE GITHUB COMMIT RULE — Non-Negotiable

**Every AI working on this project must follow this rule without exception:**

1. **After every successful fix or completed feature** — commit and push to `choice121/Choice` on GitHub before moving to the next task. Do not batch multiple fixes into one push. One fix = one push.

2. **After completing any phase** — update the Phase Tracker in this file (Section 4) to mark the phase as Complete, then push the updated `MIGRATION.md` to GitHub before starting the next phase.

3. **If a fix fails** — do not push. Fix it first, verify it works, then push.

4. **How to push via GitHub API** (use this pattern from any platform):
   ```
   PUT https://api.github.com/repos/choice121/Choice/contents/{path}
   Authorization: Bearer YOUR_GITHUB_PAT_HERE
   Body: { "message": "commit message", "content": "<base64 encoded file>", "sha": "<current file sha>" }
   ```
   To get the current SHA (required for updates):
   ```
   GET https://api.github.com/repos/choice121/Choice/contents/{path}
   Authorization: Bearer YOUR_GITHUB_PAT_HERE
   ```
   > **Token:** Replace `YOUR_GITHUB_PAT_HERE` with the actual GitHub Personal Access Token.
   > The token belongs to the `choice121` account. Ask the project owner for the current
   > token value — it is not stored in this file for security reasons.

5. **Commit message format:**
   ```
   [Phase X] Short description of what was done
   Examples:
     [Phase 0] Run SETUP.sql — applications table verified in Supabase
     [Phase 1] Wire admin/applications.html to live Supabase table
     [Phase 1] Add serve.js /generate-lease pdfkit endpoint
     [Phase 1] Complete — all admin pages live, e-signing working
   ```

6. **After pushing, state the commit explicitly** in your response:
   > "Pushed to GitHub: [Phase 1] Wire admin/applications.html to live Supabase table"

This rule exists because multiple AIs on multiple platforms share this codebase. If you do not push after each fix, the next AI starts from stale code and undoes your work.

---

## 1. Project Overview

**Choice Properties** is a rental property marketplace with three components:

| Component | URL | Tech | Status |
|-----------|-----|------|--------|
| Main site / admin panel | choice-properties-site.pages.dev | Static HTML/CSS/JS + Supabase + Node.js (port 5000) | Live |
| External application form | apply-choice-properties.pages.dev | Static HTML/CSS/JS, posts to GAS | Live |
| GAS backend | Google Apps Script | Google Sheets as DB, admin UI via GAS HTML | Live — being replaced |

**The migration goal:** Replace the GAS/Google Sheets pipeline with a native Supabase system embedded in the existing admin panel — while keeping GAS fully operational until the new system is confirmed working.

---

## 2. What Was Found in the Actual Code

### 2a. Live Supabase Schema (as of April 2026)

Tables currently live in Supabase (confirmed via PostgREST introspection):
- `admin_roles` — admin user IDs
- `landlords` — landlord profiles linked to `auth.users`
- `properties` — property listings linked to landlords
- `inquiries` — tenant contact inquiries
- `messages` — in-thread messages per application (app_id references)
- `email_logs` — email send audit trail
- `saved_properties` — tenant saved listings
- `admin_actions` — admin audit log
- `rate_limit_log` — rate limiting
- `pipeline_properties`, `pipeline_scrape_runs`, `pipeline_enrichment_log` — property pipeline

**Critical finding:** The `applications` table is defined in SETUP.sql but is NOT yet present in the live Supabase database. The `co_applicants` table and lease/signing columns are all embedded in the SETUP.sql design but have not been applied to the live project yet.

### 2b. SETUP.sql Contains Far More Than the Plan Assumes

The SETUP.sql (the canonical schema file in the main repo) already defines:
- A complete `applications` table with ~80 columns covering applicant data, lease terms, signing tokens, move-in status, payment status — all consolidated into one table
- A `co_applicants` table for co-applicant details (separated out in a later iteration to avoid NULL padding)
- `lease_status` enum: `none | sent | signed | awaiting_co_sign | co_signed | voided | expired`
- `movein_status` enum: `pending | scheduled | confirmed | completed`
- `payment_status` enum: `unpaid | paid | waived | refunded`
- `application_status` enum: `pending | under_review | approved | denied | withdrawn | waitlisted`
- Lease fields on `applications`: `lease_start_date`, `lease_end_date`, `monthly_rent`, `security_deposit`, `move_in_costs`, `lease_notes`, `lease_late_fee_flat`, `lease_late_fee_daily`, `lease_expiry_date`, `lease_state_code`, `lease_landlord_name`, `lease_landlord_address`, `lease_pets_policy`, `lease_smoking_policy`, `lease_pdf_url`
- Signing fields on `applications`: `tenant_signature`, `tenant_sign_token`, `signature_timestamp`, `lease_ip_address`, `co_applicant_signature`, `co_applicant_signature_timestamp`, `co_applicant_lease_token`
- Move-in fields on `applications`: `move_in_status`, `move_in_date_actual`, `move_in_notes`, `move_in_confirmed_by`
- RLS policies covering admin, landlord, and applicant access

**The SETUP.sql design is the authoritative schema design, not the migration plan's proposed 5-table breakdown.** The tables `leases`, `lease_signatures`, `move_ins`, and `application_payments` as separate entities are proposed in the plan but NOT in SETUP.sql. See Section 4 for the reconciliation decision.

### 2c. GAS Backend — What It Actually Does

The GAS `code.gs` file:
- Receives `multipart/form-data` POST submissions from the apply form
- Validates a honeypot field, CSRF nonce
- Routes on `_action` field for: lease signing, admin OTP auth, admin password login, save resume progress, send resume email
- Stores applications as rows in Google Sheets (`Applications` sheet)
- Generates a PDF lease and stores it in Google Drive
- Sends bilingual (EN/ES) emails via `GmailApp.sendEmail()`
- Has a complete admin panel rendered as GAS HTML with stats cards (pending, under review, approved, denied, lease sent, lease signed)
- Exposes admin actions: approve, deny, shortlist, generate lease, send lease, confirm move-in

The GAS admin dashboard shows these stat cards: Total, Pending Payment, Under Review, Approved, Denied, Lease Sent, Lease Signed.
The GAS admin renders application cards with full detail expand, action buttons per application.

**Key GAS limitation found:** GAS stores everything as flat rows in a Google Sheet. There is no relational structure. Lease PDFs go to Google Drive. Document uploads go to Google Drive. The migration replaces all of this with Supabase Storage and Supabase tables.

### 2d. Application Form Fields — Complete List

The apply form (`index.html` + `script.js` in Apply_choice_properties) collects:

**Property Context (hidden, from URL params):**
- Property ID, Property Name, Property Address, Property City, Property State, Property Zip
- Listed Rent, Security Deposit, Application Fee, Bedrooms, Bathrooms
- Available Date, Lease Terms, Min Lease Months, Pets Allowed, Pet Types Allowed, Pet Weight Limit, Pet Deposit
- Smoking Allowed, Utilities Included, Parking, Parking Fee, Garage Spaces, EV Charging
- Laundry Type, Heating Type, Cooling Type, Last Months Rent, Admin Fee, Move-in Special

**Section 1 — Applicant Identity:**
- Application ID, Requested Move-in Date, Desired Lease Term
- First Name, Last Name, Email, Phone, DOB, SSN

**Co-Applicant (conditional):**
- Has Co-Applicant, Additional Person Role (co-applicant/guarantor)
- Co-Applicant First/Last Name, Email, Phone, DOB, SSN
- Co-Applicant Employer, Job Title, Monthly Income, Employment Duration
- Co-Applicant Consent

**Section 2 — Residence & Household:**
- Current Address, Residency Duration, Current Rent Amount, Reason for Leaving
- Current Landlord Name, Landlord Phone
- Total Occupants, Additional Occupants (names)
- Has Pets (yes/no), Pet Details (if yes)
- Has Vehicle (yes/no), Vehicle Make, Model, Year, License Plate
- Ever Evicted (yes/no), Smoker (yes/no)

**Section 3 — Employment:**
- Employment Status, Employer, Job Title, Employment Duration
- Supervisor Name, Supervisor Phone, Monthly Income, Other Income

**Section 4 — References & Emergency Contact:**
- Reference 1: Name, Phone, Relationship
- Reference 2: Name, Phone, Relationship
- Emergency Contact: Name, Phone, Relationship

**Section 5 — Payment & Preferences:**
- Primary Payment Method (+ Other), Alternative Payment Method (+ Other)
- Third Choice Payment Method (+ Other)
- Preferred Language (en/es), Preferred Contact Method, Preferred Time, Preferred Time Specific

**Section 6 — Background & Consent:**
- Has Bankruptcy (yes/no), Bankruptcy Explanation (if yes)
- Has Criminal History (yes/no), Criminal History Explanation (if yes)
- Government ID Type, Government ID Number
- Consent to Terms
- Document uploads (PDF/image files)

**All of these fields ARE covered by the existing `applications` + `co_applicants` table definitions in SETUP.sql.** No fields would be lost.

### 2e. Existing Admin Pages Structure

The admin panel (`/admin/`) is static HTML pages using:
- `CP.sb()` — the lazy Supabase singleton (from `cp-api.js`)
- Auth check at page load: `CP.Auth.getUser()` + check against `admin_roles`
- Sidebar navigation with named pages
- Inline `<style>` for page-specific CSS using CSS variables (`--surface2`, `--text`, `--muted`, etc.)
- All data loaded on page load via `CP.sb()...from()...select()` calls
- Action buttons trigger inline JS functions calling Supabase

Existing admin pages: `dashboard.html`, `applications.html`, `leases.html`, `move-ins.html`, `messages.html`, `landlords.html`, `listings.html`, `email-logs.html`, `audit-log.html`, `watermark-review.html`

**These pages already exist as placeholders or partial implementations.** The migration task is to populate them with live Supabase data and real admin actions.

---

## 3. The Migration Plan (Revised Based on Actual Code)

### The Core Issue with the Original 5-Table Plan

The original plan proposed: `applications`, `leases`, `lease_signatures`, `move_ins`, `application_payments` as five separate new tables.

The actual SETUP.sql — the authoritative schema file already committed to the main repo — takes a **consolidated approach**: all lease, signing, move-in, and payment data lives as columns on the `applications` table, with `co_applicants` as the only satellite table.

**Decision: Follow SETUP.sql, not the migration plan's 5-table proposal.**

Rationale:
1. SETUP.sql is already well-thought-out and represents evolved design decisions (see the migration notes and issue references within it)
2. A separate `leases` table would create a join for the most common admin operation (view application + its lease)
3. The GAS admin panel treats applications and their lease status as one unit — keeping them together preserves this mental model
4. The `lease_signatures` audit trail is partially served by `lease_ip_address`, `signature_timestamp`, `tenant_signature` on `applications`; a separate audit table is an enhancement for later

**What IS still needed (not yet in SETUP.sql):**
- A `lease_templates` table or JSON config to store the editable lease template
- A `sign_events` or `signature_log` table for the full e-sign audit trail (typed name, IP, user-agent, timestamp per signing event) — this is distinct from just storing the signature on the application row
- A `move_ins` standalone table (currently move-in data is columns on `applications` — this works for MVP but may warrant extraction later)
- Supabase Storage buckets: `lease-pdfs`, `application-docs` (may already exist — see section 15 of SETUP.sql)

---

## 4. Phase Tracker

| Phase | Name | Status |
|-------|------|--------|
| Phase 0 | Apply SETUP.sql to live database | **Pending confirmation** — SETUP.sql must be manually run in Supabase SQL Editor before Phase 1 pages will work |
| Phase 1 | Build native system in admin panel (GAS untouched) | **IN PROGRESS** — admin pages built (applications, leases, move-ins, dashboard, cp-api.js), serve.js endpoints added (generate-lease, get-lease, sign-lease, send-email, download-lease), lease-sign.html built. Last updated: 2026-04-18 |
| Phase 2 | Cutover (change apply form endpoint) | NOT STARTED |
| Phase 3 | Archive GAS | NOT STARTED |

### Phase 0 — Apply SETUP.sql (Prerequisite)

The `applications` table does not exist in the live Supabase project. **Before any Phase 1 code can be written or tested, SETUP.sql must be run against the live Supabase project.**

Steps:
1. Open Supabase Dashboard → SQL Editor
2. Paste SETUP.sql in full
3. Run it (safe to re-run — uses `IF NOT EXISTS`, `OR REPLACE`, `ON CONFLICT`)
4. Verify `applications`, `co_applicants` tables appear
5. Verify storage buckets exist (section 15 of SETUP.sql)
6. Verify RLS policies are applied

### Phase 1 — Build in Parallel (GAS Untouched)

**What to build:**
1. **`/admin/applications.html`** — Full application list and detail view pulling from `applications` table. Status badges, filter by status, expand detail panel, admin actions (approve/deny/shortlist/mark-under-review) with `admin_notes`. Landlord view scoped by RLS.
2. **`/admin/leases.html`** — Lease management: generate lease (calls `/generate-lease` endpoint on serve.js which uses pdfkit), send signing email, track signing status, view/download PDF from Supabase Storage.
3. **`/admin/move-ins.html`** — Move-in management: confirm move-in, set move-in date, update move-in status.
4. **`serve.js` endpoint** — Add `/generate-lease` POST endpoint that accepts lease data JSON, generates PDF using pdfkit, uploads to Supabase Storage, updates `applications.lease_pdf_url`.
5. **Lease template** — A JS/JSON structure (`/lease-template.js` or `/admin/js/lease-template.js`) with all clause variables.
6. **E-signing pages** — A new public page `/lease-sign.html` (or served via serve.js) for tenant signing flow.
7. **Email sending** — Gmail SMTP via Nodemailer in serve.js for: signing invitations, approval/denial notices, move-in confirmations.
8. **`/admin/dashboard.html`** — Wire up stat cards (pending, under review, approved, denied, lease sent, lease signed, move-in) from live `applications` table.

**What must NOT be touched during Phase 1:**
- The GAS `code.gs` file or its deployed URL
- The apply form's `BACKEND_URL` setting (must keep pointing to GAS)
- Any existing Supabase RLS policies on `properties`, `landlords`, `inquiries`
- Any existing live admin pages that are already working

### Phase 2 — Cutover

1. Export all GAS data from Google Sheets as CSV
2. Import into `applications` table (field mapping guide needed — see MIGRATION_PATTERNS.md)
3. Change `BACKEND_URL` in apply form's `config.js` / Cloudflare env to point to a new Supabase Edge Function (or serve.js endpoint) instead of GAS
4. Test one real application end-to-end through new system
5. GAS remains live but in read-only archive mode

### Phase 3 — Archive

- GAS admin panel links removed from main site admin sidebar
- GAS deployment left live permanently as read-only historical record
- Email archive accessible from GAS dashboard; no new data flows there

---

## 5. Key Decisions Made (and Why)

| Decision | Rationale |
|----------|-----------|
| Consolidated schema (SETUP.sql design) over 5-table proposal | SETUP.sql is more evolved; avoids joins on the most common admin operation; matches GAS mental model |
| pdfkit for PDF generation | Free, runs on existing Node.js server (serve.js), no external service dependency, no API keys |
| Gmail SMTP via Nodemailer | ~500/day free, no third-party service, configured via env vars already present in serve.js pattern |
| Self-hosted e-signing | No cost, no vendor lock-in, legally valid electronic signature in most US jurisdictions |
| All admin decisions are manual | Admins and landlords make all approve/deny/shortlist decisions — no automation |
| serve.js stays as pure static server + new endpoints | Do not convert to Express — serve.js is a minimal `http.createServer` — add endpoints as route handlers following existing pattern |
| Phase 0 must run first | Nothing in Phase 1 can work without the applications table existing |

---

## 6. Build Order for Phase 1

This order respects dependencies:

1. **Phase 0** — Run SETUP.sql against live Supabase (prerequisite for everything)
2. **Lease template structure** — Define the JS template first (needed before PDF generation)
3. **serve.js lease PDF endpoint** — Add `/generate-lease` handler using pdfkit
4. **`/admin/applications.html`** — Wire to live `applications` table; add manual action buttons (approve/deny/shortlist/under-review); add admin_notes field; add landlord-scoped view
5. **`/admin/dashboard.html`** — Wire stat cards using same `applications` table queries
6. **E-sign page** (`/lease-sign.html`) — Public-facing page for tenants to sign
7. **`/admin/leases.html`** — Generate, send, track leases; download PDF
8. **`/admin/move-ins.html`** — Confirm move-ins, update status
9. **Email wiring** — Add Nodemailer SMTP to serve.js for all notification types
10. **Landlord portal** — Add applications section to landlord portal pages, scoped by RLS

---

## 7. Applicant Status Checking & Dashboard

The GAS system has a tenant-facing dashboard at `?path=dashboard&id=<appId>` that shows the applicant their application status. The migration must replicate this:

**Tenant-facing status page** (`/apply/status.html` or a page on the main site):
- Applicant authenticates via Supabase Auth (email OTP — already enabled per SETUP.sql comments)
- `applications_applicant_read` RLS policy already in SETUP.sql allows `applicant_user_id = auth.uid()` to read their own application
- Page shows: application status badge, payment status, lease status, move-in status, any admin messages
- If lease is in `sent` state: show "Sign Your Lease" button → links to `/lease-sign.html?token=<tenant_sign_token>`
- The `messages` table (already exists in live DB) handles back-and-forth communication between admin/tenant

**This is a Phase 1 deliverable** — it must exist before Phase 2 cutover so tenants have a place to check status on the new system.

---

## 8. Landlord Access — Requirements

Landlords must see ONLY applications for their own properties. RLS in SETUP.sql already enforces this via:

```sql
CREATE POLICY "applications_landlord_read" ON applications
  FOR SELECT USING (
    landlord_id = (SELECT id FROM landlords WHERE user_id = auth.uid())
    OR property_id IN (
      SELECT id FROM properties
      WHERE landlord_id = (SELECT id FROM landlords WHERE user_id = auth.uid())
    )
  );
```

The landlord portal (`/landlord/` directory) already exists. Phase 1 must add:
- Application list scoped to landlord's properties
- Full applicant detail view
- Approve / Shortlist / Decline buttons (write back to `status` field — but the landlord needs UPDATE permission)
- Lease status visibility (read-only for landlords)
- Move-in status visibility (read-only for landlords)

**Note:** SETUP.sql does NOT include a landlord UPDATE policy on `applications`. This must be added to allow landlords to set `status = 'approved' | 'denied' | 'waitlisted'`. The admin still controls lease generation and move-in confirmation. Define the landlord's allowed update scope carefully.

---

## 9. Security Concerns

1. **SSN data** — applications.ssn stores only last-4 digits (masked by Edge Function). Never expose full SSN through any new endpoint.
2. **lease_sign_token** — One-time signing token must be invalidated after use (set to NULL or a used flag after signing).
3. **pdfkit endpoint** — The `/generate-lease` endpoint in serve.js must be admin-only (verify Supabase session server-side before generating).
4. **Document uploads** — Supabase Storage bucket `application-docs` must have RLS restricting access to admin, the owning applicant, and the relevant landlord.
5. **CORS** — The new serve.js endpoints will be called from admin pages on the same origin — no CORS issues expected. The lease signing page calls serve.js from a different origin — CORS headers needed.

---

## 10. Phase 2 Cutover Risks

1. **GAS field name mapping vs. Supabase column names** — GAS uses "Title Case with spaces" keys; Supabase uses `snake_case`. The import script must map these precisely.
2. **Missing property_id linkage** — GAS applications may not have a valid `property_id` that matches a Supabase property ID (GAS stores the ID from URL params, which could be stale or edited). A manual reconciliation step may be needed.
3. **SSN data** — GAS stores masked SSN (last 4). Do not re-mask during import.
4. **Document URLs** — GAS stores Google Drive URLs. These are inaccessible to Supabase Storage. Import should store these Drive URLs in a `legacy_doc_url` column (add it to applications as part of Phase 2 prep).
5. **Timing** — During cutover, a window exists where the old URL is disabled and the new URL is not yet tested. Use a feature flag (env var in Cloudflare Pages) to flip atomically.
6. **Duplicate applications** — Applications submitted during the cutover window could be missed if the GAS URL is shut down before the new endpoint is live. Keep GAS running as fallback for 48 hours after cutover.

---

## 11. Reference Contacts

- Company: Choice Properties
- Email: choicepropertygroup@hotmail.com
- Phone: 707-706-3137 (TEXT ONLY)
- Address: 2265 Livernois, Suite 500, Troy, MI 48083
- GitHub: choice121
- Supabase Project URL: https://tlfmwetmhthpyrytrcfo.supabase.co
- Apply form: https://apply-choice-properties.pages.dev
- Main site: https://choice-properties-site.pages.dev
- GAS backend URL: stored in `CP_CONFIG.BACKEND_URL` in apply form's config.js
