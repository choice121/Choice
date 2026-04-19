# Choice Properties — Backend Fixes & GAS Parity Plan

---

## ══════════════════════════════════════════════════════════
## STOP — ANY AI WORKING ON THIS PROJECT MUST READ THIS ENTIRE FILE FIRST
## ══════════════════════════════════════════════════════════
##
## THIS FILE IS THE SINGLE SOURCE OF TRUTH FOR ALL PENDING FIXES.
## IT LIVES IN THE GITHUB REPO. IT IS ALWAYS IN SYNC WITH THE CODE.
##
## MANDATORY RULES — NO EXCEPTIONS:
##
## 1. READ this entire file before writing a single line of code.
## 2. WORK ONLY ONE PHASE AT A TIME. Complete it fully. Then STOP.
## 3. MARK the phase IN PROGRESS before you start writing code.
## 4. MARK the phase DONE (with files changed) before pushing.
## 5. PUSH to GitHub. Then STOP and WAIT for the owner to confirm
##    before moving to the next phase. Do not self-authorize.
## 6. NEVER mark a phase DONE without the code change verified.
## 7. NEVER skip phases or combine phases without owner approval.
## 8. IF you are unsure which phase to work on, read the STATUS
##    column — the first TODO phase is the one you work on.
##
## The owner (choice121) must explicitly say "proceed to Phase X"
## or "go ahead" before you start any new phase. No assumed consent.
##
## ══════════════════════════════════════════════════════════

---

## Context & Background

This project is a **static HTML/CSS/JS website** deployed on **Cloudflare Pages**.
The backend is **Supabase only** — PostgreSQL, Auth, Storage, and Edge Functions.
There is no application server. All backend logic lives in Supabase Edge Functions.

The original backend was **Google Apps Script (GAS)**. The Supabase backend was built
to replace it. A full audit comparing GAS against the Supabase system revealed the
gaps documented below. Every fix in this file closes a gap between GAS and Supabase
so that admins and applicants get an identical (or better) experience.

**GAS reference source:** `Apply_choice_properties/backend/code.gs`
(GAS `doPost` was renamed to `doPost_DISABLED` — GAS is no longer active in production)

**Architecture rule:** All backend fixes go into Supabase Edge Functions.
No Express server, no serve.js logic, no Replit-specific code reaches GitHub.
See `.agents/instructions.md` for the full rule set.

---

## Phase Status Overview

| Phase | Description | Status |
|---|---|---|
| Phase 1 | Expand `send-email` Edge Function to all 9 email types | `DONE` |
| Phase 2 | Fix email template content gaps (denial language + dual admin alert) | `TODO` |
| Phase 3 | Add email identity verification to lease signing | `TODO` |
| Phase 4 | Add Mark As Refunded admin action + auto admin review summary email | `TODO` |
| Phase 5 | Add management countersign endpoint + admin UI | `TODO` |
| Phase 6 | Add dry-run lease preview | `TODO` |
| Phase 7 | Tenant portal — show holding fee & payment status | `TODO` |
| Phase 8 | Document upload flow | `TODO` |

---

## PHASE 1 — Expand `send-email` Edge Function to All 9 Email Types

**Status:** `TODO`
**Priority:** 🔴 Critical — 6 of 9 email types currently fail silently in production
**Files to change:**
- `supabase/functions/send-email/index.ts`
- `supabase/functions/_shared/email.ts`

### What GAS did

GAS had a complete email dispatch system. Every admin action triggered the correct
fully-styled HTML email. The full list of admin-triggered email types in GAS:

| GAS Function | Type Sent | To |
|---|---|---|
| `sendApprovalEmail` | `approved` | Applicant |
| `sendDenialEmail` | `denied` | Applicant |
| `sendHoldingFeeRequestEmail` | `holding_fee_request` | Applicant |
| `sendHoldingFeeReceivedEmail` | `holding_fee_received` | Applicant |
| `sendPaymentConfirmedEmail` | `payment_confirmed` | Applicant |
| `sendMoveInPrepEmail` | `move_in_prep` | Applicant |
| `sendLeaseSigningReminderEmail` | `lease_signing_reminder` | Applicant |
| `sendLeaseExpiryAlertEmail` | `lease_expiry_alert` | Both admin emails |
| `sendMoveInConfirmedEmail` | `movein_confirmed` | Applicant |

### What the current `send-email` Edge Function does

Only handles 3 types: `approved`, `denied`, `movein_confirmed`.
All other types fall through to a generic fallback with no specific template.
The admin panel calls this Edge Function in production — so 6 types silently fail.

### What to build

Expand `supabase/functions/send-email/index.ts` to handle all 9 types with the same
fully-styled HTML templates that are currently in `serve.js` `handleSendEmail()`.
The function already has the GAS email relay wired — just add the missing branches.

**Full template requirements per type:**

#### `holding_fee_request`
- Subject: `Holding Fee Request — Choice Properties`
- Header color: `#7c3aed`
- Body must include: applicant name, property address, fee amount (`fee_amount` from body or `app.holding_fee_amount`), due date (`due_date` from body or `app.holding_fee_due_date`), payment methods (Zelle, Venmo, Cashier's Check), phone 707-706-3137
- DB side-effect: update `applications` set `holding_fee_requested = true`, `holding_fee_requested_at = now()`, `holding_fee_amount` (if provided), `holding_fee_due_date` (if provided), `updated_at = now()`
- Sends to: applicant email (`app.email`)

#### `holding_fee_received`
- Subject: `Holding Fee Received — Choice Properties`
- Header color: `#16a34a`
- Body must include: applicant name, property address, confirmation that unit is reserved, link to tenant portal (`https://choice-properties-site.pages.dev/tenant/portal.html`)
- DB side-effect: update `applications` set `holding_fee_paid = true`, `holding_fee_paid_at = now()`, `updated_at = now()`
- Sends to: applicant email (`app.email`)

#### `payment_confirmed`
- Subject: `Payment Confirmed — Choice Properties`
- Header color: `#16a34a`
- Body must include: applicant name, property address, payment details table (amount `amount_collected`, method `payment_method`, reference `transaction_ref`)
- DB side-effect: update `applications` set `payment_method_confirmed`, `payment_transaction_ref`, `payment_amount_collected`, `payment_confirmed_at = now()`, `updated_at = now()`
- Sends to: applicant email (`app.email`)

#### `move_in_prep`
- Subject: `Your Move-In Preparation Guide — Choice Properties`
- Header color: `#2563eb`
- Body must include: applicant name, property address, checklist of pre-move items (utilities, renter's insurance, USPS address update, confirm move-in date), move-in day items (photo ID, renter's insurance proof, inspection checklist, keys/parking), phone 707-706-3137
- DB side-effect: none
- Sends to: applicant email (`app.email`)

#### `lease_signing_reminder`
- Subject: `Reminder: Please Sign Your Lease — Choice Properties`
- Header color: `#d97706`
- Body must include: applicant name, property address, link to tenant portal, instruction to call 707-706-3137 with questions before signing
- DB side-effect: none
- Sends to: applicant email (`app.email`)

#### `lease_expiry_alert`
- Subject: `Lease Expiry Alert — {property address}`
- Header color: `#dc2626`
- Body must include: applicant name, property address, lease end date (formatted as full date e.g. "Monday, June 30, 2025"), app_id, tenant email
- DB side-effect: none
- Sends to: **BOTH** admin emails — `choicepropertyofficial1@gmail.com` AND `choicepropertygroup@hotmail.com`
- This is an admin-only email — do NOT send to the applicant

**Shared requirements for all templates:**
- Footer on every email: `Choice Properties · choicepropertygroup@hotmail.com · 707-706-3137`
- Support optional `message` field in the request body — if present, render it in a styled aside block
- Money formatting: `$X,XXX.XX` (two decimal places, comma separator)
- Date formatting: full weekday + month + day + year (e.g. "Monday, April 21, 2025")
- All sends should be logged to `email_logs` table with `app_id`, `email_type`, `recipient`, `status`, `sent_at`

**Admin email routing note:**
- All applicant-facing emails send to `app.email` only
- `lease_expiry_alert` sends to both hardcoded admin emails
- All admin actions should also be logged to `admin_actions` table with `app_id`, `action`, `actor` (from auth), `created_at`

**Request body shape the Edge Function must accept:**

```json
{
  "app_id": "CP-XXXXXX",
  "type": "holding_fee_request",
  "message": "Optional admin note to include in the email",
  "fee_amount": 500,
  "due_date": "2025-05-01",
  "payment_method": "Zelle",
  "transaction_ref": "TXN-ABC123",
  "amount_collected": 1500
}
```

**Auth:** Admin JWT required (same as current implementation — verify via Supabase Auth).

### Acceptance Criteria

- [ ] All 9 email types return HTTP 200 when called with a valid `app_id` and `type`
- [ ] Each email arrives with the correct subject line and styled HTML body
- [ ] DB side-effects for `holding_fee_request`, `holding_fee_received`, `payment_confirmed` are applied correctly
- [ ] `lease_expiry_alert` sends to both admin emails, not the applicant
- [ ] All sends are logged to `email_logs`
- [ ] Admin actions are logged to `admin_actions`
- [ ] Calling with an unsupported `type` returns HTTP 400 with a clear error message
- [ ] Calling without auth returns HTTP 401

### Commit Message Convention
`[FIX-1] Expand send-email Edge Function to all 9 email types`

---

## PHASE 2 — Fix Email Template Content Gaps

**Status:** `TODO`
**Priority:** 🟠 Important — applicants receive incomplete or incorrect information
**Files to change:**
- `supabase/functions/send-email/index.ts` (denial template + lease-signed alert)
- `supabase/functions/sign-lease/index.ts` (admin alert recipient)

### Issue 2A — Denial Email Missing 30-Day Reapplication Language

**What GAS did:**
GAS's denial email included this specific language (paraphrased):
> "You are welcome to reapply for a different property after 30 days. We encourage you to continue your housing search."

This language is legally and practically important — it sets expectations, prevents
applicants from spamming reapplications, and matches the application credit policy
documented in `application-credit-policy.html`.

**What the current `denied` template says:**
> "After careful review, we are unable to move forward at this time."
> "We appreciate your interest and wish you the best in your housing search."

The reapplication guidance and the 30-day window are completely absent.

**Fix required:**
Add this paragraph to the `denied` email template after the main denial text:

```
You are welcome to apply for a different available property after 30 days.
Please visit our listings at choice-properties-site.pages.dev to see current availability.
We appreciate your interest and hope to work with you in the future.
```

The 30-day window must be explicit. The link to the listings page must be included.

---

### Issue 2B — Lease Signed Admin Alert Only Goes to One Email Address

**What GAS did:**
When a lease was signed, GAS called `sendLeaseSignedAdminAlert()` which sent to
**both** admin addresses:
- `choicepropertyofficial1@gmail.com`
- `choicepropertygroup@hotmail.com`

**What `sign-lease` Edge Function currently does:**
Reads `ADMIN_EMAIL` environment variable (a single address) and sends only to that one.
One admin will never see that a lease was signed.

**Fix required:**
In `supabase/functions/sign-lease/index.ts`, replace the single `ADMIN_EMAIL` lookup
with the same dual-address pattern used in `receive-application/index.ts`:

```typescript
const adminEmails = ['choicepropertyofficial1@gmail.com', 'choicepropertygroup@hotmail.com'];
for (const adminEmail of adminEmails) {
  await sendAdminAlert(adminEmail, subject, html);
}
```

Do not use env vars for these two addresses — they are hardcoded constants in GAS
and should remain hardcoded constants here for consistency.

### Acceptance Criteria

- [ ] Denial email body contains explicit 30-day reapplication language with a link to the listings page
- [ ] When a lease is signed, both `choicepropertyofficial1@gmail.com` and `choicepropertygroup@hotmail.com` receive the admin alert
- [ ] No other email behavior is changed

### Commit Message Convention
`[FIX-2] Denial email reapplication language + both admin emails on lease signed`

---

## PHASE 3 — Add Email Identity Verification to Lease Signing

**Status:** `TODO`
**Priority:** 🔴 Critical (security) — anyone with a signing link can sign without identity check
**Files to change:**
- `supabase/functions/sign-lease/index.ts`
- `lease-sign.html`

### What GAS did

GAS's `signLease()` function required the applicant to enter their email address
on the signing page. Before recording the signature, it cross-checked the submitted
email against the email stored in the application record. If they didn't match, the
signature was rejected. This ensures only the named applicant can execute the lease.

```javascript
// GAS equivalent logic:
if (submittedEmail.toLowerCase() !== app.email.toLowerCase()) {
  return { success: false, error: 'Email does not match our records.' };
}
```

GAS also enforced a minimum signature length of 5 characters.

### What `sign-lease` Edge Function currently does

Accepts:
- `token` — the signing token from the URL
- `signature` — the typed name

No email is required. No identity check. No minimum length validation.
Anyone who obtains the signing link can legally execute the lease as the applicant.

### Fix Required

**In `supabase/functions/sign-lease/index.ts`:**

1. Add `applicant_email` to the accepted request body fields
2. After loading the application record by token, check:
   ```typescript
   if (!body.applicant_email || body.applicant_email.trim().toLowerCase() !== app.email.toLowerCase()) {
     return new Response(JSON.stringify({ error: 'Email address does not match our records.' }), { status: 403 });
   }
   ```
3. Add signature minimum length check:
   ```typescript
   if (!body.signature || body.signature.trim().length < 5) {
     return new Response(JSON.stringify({ error: 'Signature must be at least 5 characters.' }), { status: 400 });
   }
   ```

**In `lease-sign.html`:**

Add an email input field to the signing form:
```html
<label for="signerEmail">Your Email Address (to verify your identity)</label>
<input type="email" id="signerEmail" name="signerEmail" required
  placeholder="Enter the email you used to apply">
```

Include `applicant_email: document.getElementById('signerEmail').value` in the
fetch body sent to the `sign-lease` Edge Function.

Show a clear, user-friendly error if the email doesn't match:
> "The email you entered doesn't match our records. Please use the same email address you applied with."

### Acceptance Criteria

- [ ] Signing form has an email input field before the signature field
- [ ] Submitting with an email that doesn't match the application returns HTTP 403 with clear error message shown to user
- [ ] Submitting with a signature shorter than 5 characters returns HTTP 400 with clear error message shown to user
- [ ] Submitting with the correct email and valid signature succeeds as before
- [ ] Error messages are shown inline on the page, not as raw JSON

### Commit Message Convention
`[FIX-3] Add email identity verification and signature length check to lease signing`

---

## PHASE 4 — Mark As Refunded + Auto Admin Review Summary Email

**Status:** `TODO`
**Priority:** 🟠 Important — admin workflow gap
**Files to change:**
- `admin/applications.html`
- `supabase/functions/send-email/index.ts` (add admin review summary type — internal only)

### Issue 4A — Mark As Refunded Admin Action Is Missing

**What GAS did:**
GAS had a `markAsRefunded(appId)` function in the admin panel. When called, it:
1. Set `payment_status = 'refunded'` on the application record
2. Logged the action with timestamp and admin name to the audit sheet
3. Optionally sent a refund confirmation to the applicant (when the admin chose to)

**What the current admin panel does:**
No refund action exists. There is no button, no endpoint, and no DB column for refund status.

**Fix required:**

Check if `applications` table has `payment_status` column. If not, add via SQL:
```sql
ALTER TABLE applications ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending';
```

Add a "Mark as Refunded" button in `admin/applications.html` in the admin action row
for approved applications that have `payment_status = 'paid'`:
- Clicking opens a confirmation modal: "Are you sure you want to mark this payment as refunded?"
- On confirm: direct Supabase JS update → `{ payment_status: 'refunded', refunded_at: new Date().toISOString() }`
- Log to `admin_actions`: `{ app_id, action: 'mark_refunded', actor: adminUser.email, created_at: now }`
- Show success toast in the admin UI

No Edge Function needed — this is a direct Supabase JS call from the admin page.

---

### Issue 4B — Admin Review Summary Email Is Missing

**What GAS did:**
When an admin called `markHoldingFeePaid(appId)`, GAS automatically sent an internal
review summary email **to both admin addresses** containing the full application details:

- Applicant name, email, phone
- Property address
- Application ID
- Holding fee amount received
- Current application status
- Recommended next action: "Generate lease document"

This email served as an internal prompt/reminder for the admin to move forward with the lease.

**What the current system does:**
The `holding_fee_received` email type sends a confirmation to the applicant only.
No internal admin summary is sent. Admins receive no notification or prompt.

**Fix required:**

Inside the `holding_fee_received` handler in `send-email/index.ts` (after Phase 1 is done),
after sending the tenant confirmation email, also send a second email to both admin addresses:

Subject: `Holding Fee Received — Action Required: Generate Lease for {applicant name}`

Body must include:
- Applicant: `{first_name} {last_name}`
- Email: `{app.email}`
- Phone: `{app.phone}`
- Property: `{app.property_address}`
- App ID: `{app.app_id}`
- Holding fee received: `{formatted amount}`
- Received at: `{current timestamp}`
- Recommended next action: "Log in to the admin panel and generate the lease document for this applicant."
- Link to admin panel: `https://choice-properties-site.pages.dev/admin/applications.html`

This email is sent automatically as a side-effect of the `holding_fee_received` type.
No new API endpoint is needed — it runs inside the existing email handler.

### Acceptance Criteria

- [ ] "Mark as Refunded" button is visible on applicable application records in the admin panel
- [ ] Clicking it triggers a confirmation modal before any change
- [ ] After confirmation, `payment_status` updates to `'refunded'` and `refunded_at` is set
- [ ] Action is logged to `admin_actions`
- [ ] When `holding_fee_received` email is sent, both admin addresses automatically receive the review summary email
- [ ] The summary email contains all application details listed above
- [ ] The summary is not visible to the applicant

### Commit Message Convention
`[FIX-4] Mark as refunded admin action + auto admin review summary on holding fee received`

---

## PHASE 5 — Management Countersign

**Status:** `TODO`
**Priority:** 🟠 Important — lease is not legally bilateral without management signature
**Files to change:**
- `supabase/functions/` — new `countersign` Edge Function
- `admin/leases.html`
- `MIGRATION_new_columns.sql` or a new migration SQL file

### What GAS did

GAS had `managementCountersign(appId, signerName, notes)`. When called from the admin panel:
1. Recorded `management_signed = true`, `management_signer_name`, `management_signed_at`, `management_notes` in the sheet
2. Re-generated the lease PDF with the management signature block appended at the bottom
3. Updated the application status to `lease_executed` (fully executed by both parties)
4. Sent a "Lease Fully Executed" confirmation email to the applicant

**What the current system does:**
No countersign endpoint exists anywhere. The lease is considered signed when only the
applicant signs. Management signature is not recorded. Lease is not bilateral.

### Fix Required

**Step 1 — Database columns (run in Supabase SQL Editor):**
```sql
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS management_signed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS management_signer_name text,
  ADD COLUMN IF NOT EXISTS management_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS management_notes text,
  ADD COLUMN IF NOT EXISTS lease_status text DEFAULT 'pending';
```

**Step 2 — New Edge Function: `supabase/functions/countersign/index.ts`**

Request body:
```json
{
  "app_id": "CP-XXXXXX",
  "signer_name": "Jane Smith",
  "notes": "Optional internal notes"
}
```

The function must:
1. Verify admin JWT (same pattern as `send-email`)
2. Load the application by `app_id`
3. Verify the applicant has already signed (`tenant_signed = true`) — reject if not
4. Update `applications`: `management_signed = true`, `management_signer_name`, `management_signed_at = now()`, `management_notes`, `lease_status = 'executed'`, `updated_at = now()`
5. Re-generate the lease PDF with the management signature block at the bottom (see `generate-lease` for PDF generation pattern)
6. Upload the updated PDF to Supabase Storage, overwriting the previous version
7. Send "Lease Fully Executed" email to applicant:
   - Subject: `Your Lease Has Been Fully Executed — Choice Properties`
   - Header color: `#16a34a`
   - Body: confirmation that both parties have signed, property address, link to download in tenant portal
8. Log to `admin_actions`: `{ app_id, action: 'management_countersign', actor: signer_name, created_at: now }`

**Step 3 — Admin UI in `admin/leases.html`:**

For every lease where `tenant_signed = true` AND `management_signed = false`:
- Show a "Countersign" button
- Clicking opens a modal with:
  - "Signer Name" text input (pre-filled with current admin's name)
  - "Internal Notes" textarea (optional)
  - "Sign as Management" confirm button

**Management signature block to append to the PDF:**
```
MANAGEMENT SIGNATURE
──────────────────────────────
Signed by:  {signer_name}
Date:       {management_signed_at formatted as full date}
Notes:      {management_notes if provided}
On behalf of: Choice Properties
```

### Acceptance Criteria

- [ ] New `countersign` Edge Function deploys without errors
- [ ] Calling without admin JWT returns HTTP 401
- [ ] Calling when applicant has not yet signed returns HTTP 400 with clear error
- [ ] On success: DB is updated, PDF is re-uploaded, applicant receives confirmation email
- [ ] "Countersign" button appears in `admin/leases.html` for tenant-signed, management-unsigned leases
- [ ] Modal collects signer name and optional notes before submission
- [ ] After countersign, the button disappears and a "Fully Executed" badge appears on that record
- [ ] Action is logged to `admin_actions`

### Commit Message Convention
`[FIX-5] Management countersign Edge Function + admin leases UI`

---

## PHASE 6 — Dry-Run Lease Preview

**Status:** `TODO`
**Priority:** 🟡 Nice to have — prevents sending wrong lease documents
**Files to change:**
- `supabase/functions/generate-lease/index.ts`
- `admin/applications.html`

### What GAS did

GAS had a two-step lease generation flow:
1. Admin clicked "Preview Lease" → GAS generated the PDF and returned a temporary URL for the admin to review in a new tab. Nothing was saved. No email was sent.
2. Admin reviewed the PDF, then clicked "Confirm & Send" → GAS saved the PDF and emailed the signing link to the applicant.

This prevented admins from accidentally sending the wrong lease document to applicants.

**What the current system does:**
`generate-lease` Edge Function generates the PDF, saves it to Supabase Storage, updates
the application record, and emails the signing link to the applicant — all in one step.
There is no preview or confirmation step.

### Fix Required

**In `supabase/functions/generate-lease/index.ts`:**

Add `dry_run` boolean field to the request body:
```json
{ "app_id": "CP-XXXXXX", "dry_run": true }
```

When `dry_run = true`:
1. Generate the PDF exactly as normal
2. Upload to a temporary path in Supabase Storage: `leases/preview/{app_id}_preview.pdf`
3. Generate a signed URL for the preview (60 minute expiry)
4. Return `{ preview_url: "...", dry_run: true }` — do NOT update the application record, do NOT set lease status, do NOT send any email to the applicant
5. Log to `admin_actions`: `{ app_id, action: 'lease_preview_generated', actor, created_at }`

When `dry_run = false` (or omitted — normal behavior):
1. Proceed exactly as today — generate, save, update DB, email applicant

**In `admin/applications.html`:**

Replace the current single "Generate Lease" button with a two-step flow:

Step 1: "Preview Lease" button → calls `generate-lease` with `dry_run: true` → opens the returned `preview_url` in a new tab
Step 2: A "Confirm & Send" button appears after the preview → calls `generate-lease` with `dry_run: false` → proceeds as normal

The "Confirm & Send" button should only appear after a successful dry-run response.

### Acceptance Criteria

- [ ] Calling `generate-lease` with `dry_run: true` returns a signed preview URL without touching any application data or sending emails
- [ ] The preview PDF is identical to the final PDF
- [ ] Calling with `dry_run: false` behaves exactly as the current implementation
- [ ] Admin UI shows "Preview Lease" first, then "Confirm & Send" appears after preview
- [ ] Preview URL is time-limited (60 minutes)
- [ ] Dry-run action is logged to `admin_actions`

### Commit Message Convention
`[FIX-6] Add dry-run lease preview to generate-lease Edge Function + admin UI`

---

## PHASE 7 — Tenant Portal Holding Fee & Payment Status

**Status:** `TODO`
**Priority:** 🟠 Important — tenants have no visibility into their financial status
**Files to change:**
- `tenant/portal.html`

### What GAS did

GAS's tenant dashboard (`?path=dashboard`) showed:
- Holding fee status: whether it was requested, how much, the due date, whether it was received
- Payment status: method used, amount collected, transaction reference, confirmation date
- All of this came directly from the applicant's application record

**What the current tenant portal shows:**
Application status, lease status, signing link, move-in date. Holding fee and payment
status are not confirmed to be displayed. They are in the DB but may not be rendered.

### Fix Required

In `tenant/portal.html`, in the application status section, add a financial status block
that reads directly from the Supabase `applications` record for the logged-in applicant.

**Holding fee block** — show when `holding_fee_requested = true`:
```
Holding Fee
  Amount Due:  $X,XXX.XX
  Due By:      Monday, May 1, 2025
  Status:      Received ✓  (if holding_fee_paid = true)
               Pending payment  (if holding_fee_paid = false)
```

**Payment block** — show when `payment_confirmed_at` is not null:
```
Payment Confirmed
  Amount:      $X,XXX.XX
  Method:      Zelle
  Reference:   TXN-ABC123
  Confirmed:   April 20, 2025
```

Both blocks should be hidden (CSS `display: none`) when the relevant data is absent.
Use the same styling pattern as the rest of `tenant/portal.html`.

Read directly from the Supabase JS client using the authenticated session.
No new Edge Function needed.

**DB columns to read:**
- `holding_fee_requested` (boolean)
- `holding_fee_amount` (numeric)
- `holding_fee_due_date` (date)
- `holding_fee_paid` (boolean)
- `holding_fee_paid_at` (timestamptz)
- `payment_confirmed_at` (timestamptz)
- `payment_amount_collected` (numeric)
- `payment_method_confirmed` (text)
- `payment_transaction_ref` (text)

Verify these columns exist in the `applications` table before reading.
If any column is missing, add it via a SQL migration note in the PR description.

### Acceptance Criteria

- [ ] Holding fee section appears in the tenant portal when a holding fee has been requested
- [ ] Holding fee shows amount, due date, and paid/pending status correctly
- [ ] Payment section appears when payment has been confirmed
- [ ] Payment shows amount, method, and reference number correctly
- [ ] Sections are hidden (not just empty) when data is absent
- [ ] No new Edge Functions required — direct Supabase JS reads only

### Commit Message Convention
`[FIX-7] Tenant portal — holding fee and payment status visibility`

---

## PHASE 8 — Document Upload Flow

**Status:** `TODO`
**Priority:** 🟡 Nice to have — GAS collected documents at application time
**Files to change:**
- `tenant/portal.html` (post-approval document upload UI)
- New Edge Function: `supabase/functions/request-upload-url/index.ts`
- Supabase Storage bucket: `application-docs` (may need to be created)

### What GAS did

The GAS application form allowed applicants to upload their government-issued photo ID
and any supporting documents (pay stubs, bank statements, etc.) directly in the apply
form. Files were uploaded to Google Drive with the application.

### What the current system does

The `receive-application` Edge Function handles form submission but has no file upload
handling. Applicants cannot submit any documents — the field in the form (if present)
silently drops the file.

### Architecture Decision (confirmed by owner)

Rather than adding file uploads to the initial application form, collect documents
**after approval** in the tenant portal. This is cleaner — documents are only needed
once the applicant is approved and moving toward lease signing.

### Fix Required

**Step 1 — New Edge Function: `supabase/functions/request-upload-url/index.ts`**

Generates a signed upload URL for Supabase Storage. Applicant must be authenticated.

Request body:
```json
{ "app_id": "CP-XXXXXX", "file_name": "government_id.jpg", "file_type": "image/jpeg", "doc_type": "government_id" }
```

The function:
1. Verifies the applicant is authenticated and is the owner of `app_id`
2. Generates a Supabase Storage signed upload URL for: `application-docs/{app_id}/{doc_type}/{file_name}`
3. Returns the signed upload URL + storage path
4. Logs the upload request to `admin_actions`

The browser then uploads directly to Supabase Storage using the signed URL (no Edge Function involved in the actual upload).

**Step 2 — Tenant portal document upload UI in `tenant/portal.html`**

Show a "Documents" section when application status is `approved` or later.

Document types to accept:
- Government-issued photo ID (required)
- Proof of income / pay stubs (optional)
- Bank statements (optional)
- Other supporting documents (optional)

Each document type has:
- Upload button → calls `request-upload-url` Edge Function → receives signed URL → uploads file directly to Supabase Storage
- Status indicator: Not uploaded / Uploaded ✓
- View/replace option if already uploaded

**Step 3 — Admin side (view only) in `admin/applications.html`**

In the application detail view, show a "Documents" section listing uploaded files
with direct download links (using Supabase Storage admin access).

**Supabase Storage bucket requirements:**
- Bucket name: `application-docs`
- Privacy: Private (all files private, served only via signed URLs)
- RLS: Only the owning applicant can upload; only admins can read

### Acceptance Criteria

- [ ] Approved applicants see a document upload section in the tenant portal
- [ ] Each document type has an upload button and status indicator
- [ ] Files upload directly to Supabase Storage (not through an Edge Function)
- [ ] Uploaded files are visible to admins in `admin/applications.html`
- [ ] Unauthenticated users cannot access or generate upload URLs
- [ ] Applicants cannot access other applicants' documents

### Commit Message Convention
`[FIX-8] Post-approval document upload via Supabase Storage + tenant portal UI`

---

## Reference — GAS vs Supabase Full Comparison

This section documents every GAS function and its Supabase equivalent status.
Use this to verify nothing was missed.

### Email Functions

| GAS Function | Supabase Equivalent | Status |
|---|---|---|
| `sendApprovalEmail` | `send-email` type `approved` | ✅ Working |
| `sendDenialEmail` | `send-email` type `denied` | ⚠️ Missing 30-day reapplication language — Phase 2 |
| `sendHoldingFeeRequestEmail` | `send-email` type `holding_fee_request` | ❌ Missing from Edge Function — Phase 1 |
| `sendHoldingFeeReceivedEmail` | `send-email` type `holding_fee_received` | ❌ Missing from Edge Function — Phase 1 |
| `sendAdminReviewSummaryEmail` | Auto-sent inside `holding_fee_received` | ❌ Not implemented — Phase 4 |
| `sendPaymentConfirmedEmail` | `send-email` type `payment_confirmed` | ❌ Missing from Edge Function — Phase 1 |
| `sendMoveInPrepEmail` | `send-email` type `move_in_prep` | ❌ Missing from Edge Function — Phase 1 |
| `sendLeaseSigningReminderEmail` | `send-email` type `lease_signing_reminder` | ❌ Missing from Edge Function — Phase 1 |
| `sendLeaseExpiryAlertEmail` | `send-email` type `lease_expiry_alert` | ❌ Missing from Edge Function — Phase 1 |
| `sendMoveInConfirmedEmail` | `send-email` type `movein_confirmed` | ✅ Working |
| `sendLeaseSignedTenantEmail` | Inside `sign-lease` Edge Function | ✅ Working |
| `sendLeaseSignedAdminAlert` | Inside `sign-lease` Edge Function | ⚠️ Only sends to one admin — Phase 2 |

### Admin Action Functions

| GAS Function | Supabase Equivalent | Status |
|---|---|---|
| `approveApplication` | Direct Supabase JS + `send-email approved` | ✅ Working |
| `denyApplication` | Direct Supabase JS + `send-email denied` | ⚠️ Email content gap — Phase 2 |
| `markUnderReview` | Direct Supabase JS status update | ✅ Working |
| `markContacted` | Direct Supabase JS update | ✅ Working |
| `requestHoldingFee` | `send-email holding_fee_request` (missing) + direct DB | ❌ Phase 1 |
| `markHoldingFeePaid` | `send-email holding_fee_received` (missing) | ❌ Phase 1 + Phase 4 |
| `dryRunLease` | `generate-lease?dry_run=true` | ❌ Not implemented — Phase 6 |
| `generateLease` | `generate-lease` Edge Function | ✅ Working |
| `managementCountersign` | None | ❌ Not implemented — Phase 5 |
| `markAsPaid` | `send-email payment_confirmed` (missing) | ❌ Phase 1 |
| `markAsRefunded` | None | ❌ Not implemented — Phase 4 |
| `sendSigningReminder` | `send-email lease_signing_reminder` (missing) | ❌ Phase 1 |
| `sendLeaseExpiryAlert` | `send-email lease_expiry_alert` (missing) | ❌ Phase 1 |
| `sendMoveInPrepGuide` | `send-email move_in_prep` (missing) | ❌ Phase 1 |
| `confirmMoveIn` | `send-email movein_confirmed` | ✅ Working |
| `withdrawApplication` | Tenant portal direct Supabase JS | ✅ Working |

### Applicant-Facing Functions

| GAS Function | Supabase Equivalent | Status |
|---|---|---|
| `doPost` (application intake) | `receive-application` Edge Function | ✅ Working |
| Policy consent validation | `receive-application` | ✅ Working |
| Duplicate detection | `receive-application` checkRecentSubmission | ✅ Working |
| SSN masking | `receive-application` | ✅ Working |
| File upload (gov ID, docs) | None | ❌ Not implemented — Phase 8 |
| `signLease` | `sign-lease` Edge Function | ⚠️ Missing identity check — Phase 3 |
| `signLease` email verification | None | ❌ Missing — Phase 3 |
| `signLease` signature min length | None | ❌ Missing — Phase 3 |
| Dashboard — application status | Tenant portal | ✅ Working |
| Dashboard — lease status + link | Tenant portal | ✅ Working |
| Dashboard — download signed lease | Tenant portal | ✅ Working |
| Dashboard — holding fee status | Tenant portal | ❓ Not confirmed — Phase 7 |
| Dashboard — payment status | Tenant portal | ❓ Not confirmed — Phase 7 |
| Application credits (reapply) | None | ⚠️ Partial — policy page exists, no enforcement |

---

## Change Log

| Date | Phase | Who | What |
|---|---|---|---|
| 2026-04-19 | — | Initial audit | Full GAS vs Supabase comparison documented. All 8 phases defined. |
| 2026-04-19 | Phase 1 | Replit Agent | Expanded `send-email` Edge Function to all 9 email types. Files changed: `supabase/functions/send-email/index.ts`, `supabase/functions/_shared/email.ts` |

*Update this table after every phase completion. Include the GitHub commit hash.*

---

*Last updated: April 19, 2026*
*Audited by: Replit Agent — full GAS source comparison*
*Next action: Owner approves Phase 1 → AI implements Phase 1 → stops and waits*
