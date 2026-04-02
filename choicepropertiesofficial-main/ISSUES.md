# Choice Properties — Issue Registry

> **How to use this file:**
> Every issue has a stable ID (I-001, I-002, …) that never changes.
> Statuses: `OPEN` · `IN PROGRESS` · `RESOLVED` · `DEFERRED` · `WONT FIX`
> Severities: `CRITICAL` · `HIGH` · `MEDIUM` · `LOW`
> After each session, resolved issues are updated in-place and new issues are appended.

---

## 🟢 Active Issues — Session 027 Complete

**No open issues.** All 6 issues from the Session 027 photo upload audit (I-062–I-067) have been resolved.

---

## Summary Snapshot
| Status | Count |
|---|---|
| OPEN | 0 |
| IN PROGRESS | 0 |
| RESOLVED | 67 |
| DEFERRED | 0 |
| WONT FIX | 1 |
| **Total** | **69** |

*Last updated: Session 027 — 2026-03-31 (all 6 issues I-062–I-067 resolved)*

### Open Issues by Priority
*No open issues. All 69 tracked issues resolved or won't-fixed as of Session 027.*

**Won't Fix (owner decision):**
| DF-002 | — | No admin workflow to verify fee payment before review — WONT FIX (intentional offline payment process) |

**Session 020 — Resolved:**
| I-037 | 🟠 HIGH | `window.confirm()` used for duplicate address check — ✅ RESOLVED |
| I-038 | 🟠 HIGH | Negative numbers accepted for rent, sqft, deposit — ✅ RESOLVED |
| I-039 | 🟡 MEDIUM | Description has no maximum length enforced — ✅ RESOLVED |
| I-040 | 🟠 HIGH | Duplicate address check runs after photos uploaded — ✅ RESOLVED |
| I-041 | 🟡 MEDIUM | Available date accepts past dates — ✅ RESOLVED |
| I-042 | 🟡 MEDIUM | Draft restore banner does not warn photos not saved — ✅ RESOLVED |
| I-044 | 🟠 HIGH | Government ID number stored in plaintext — ✅ RESOLVED |
| I-045 | 🟠 HIGH | Application fee resolved from stale client-side data — ✅ RESOLVED |
| I-046 | 🟠 HIGH | `alert()` used in document upload — banned API — ✅ RESOLVED |
| I-047 | 🟡 MEDIUM | Free-text fields have no maxlength — ✅ RESOLVED |
| I-048 | 🔵 LOW | Income-to-rent ratio display — remove from form — ✅ RESOLVED |
| I-049 | 🟡 MEDIUM | Contact method shows optional but validation requires it — ✅ RESOLVED |

**Previously resolved (audit trail):**
| I-014 | 🟠 HIGH | Draft autosave does not save or restore checkbox state — ✅ RESOLVED |
| I-015 | 🟠 HIGH | Photos never deleted from ImageKit (storage leak) — ✅ RESOLVED |
| I-016 | 🟠 HIGH | Photo uploads are sequential — slow on mobile — ✅ RESOLVED |
| I-018 | 🟠 HIGH | `applications_count` and `saves_count` always zero (no triggers) — ✅ RESOLVED |
| I-019 | 🟡 MEDIUM | Geocoding race condition — lat/lng may be null at submit — ✅ RESOLVED |
| I-020 | 🟡 MEDIUM | Duplicate listing check is client-side only — ✅ RESOLVED (documented) |
| I-021 | 🟡 MEDIUM | "Preview as Tenant" shows no photos — ✅ RESOLVED |
| I-023 | 🟡 MEDIUM | State dropdown defaults to Michigan for all users — ✅ RESOLVED |
| I-024 | 🟡 MEDIUM | Full-text search excludes description and amenities — ✅ RESOLVED |
| I-025 | 🟡 MEDIUM | No photo reordering on new listing form — ✅ RESOLVED |
| I-026 | 🔵 LOW | `Properties.create()` unused — parallel insert paths — ✅ RESOLVED (documented) |
| I-027 | 🔵 LOW | Submit button not disabled immediately (double-submit window) — ✅ RESOLVED |
| I-028 | 🔵 LOW | `fileId` from ImageKit silently discarded — ✅ RESOLVED |

---

## Group A — Quick Wins

### I-001 · `showToast()` duplicated across 6 landlord pages
- **Status:** ✅ RESOLVED
- **Severity:** MEDIUM
- **Resolved in session:** 002
- **Resolution notes:** Removed all 6 local `showToast()` definitions and replaced all call sites with `CP.UI.toast()`.

---

### I-002 · Edge Functions duplicate CORS headers and auth boilerplate
- **Status:** ✅ RESOLVED
- **Severity:** MEDIUM
- **Category:** Code Duplication / Backend Maintainability
- **Affected files:** All 10 `supabase/functions/*/index.ts`
- **Description:** Every Edge Function independently defined its CORS headers, JWT extraction logic, Supabase client initialization, and utility functions. Supabase Edge Functions support a `_shared/` folder for shared imports.
- **Impact:** Updating CORS policy required 10 separate file edits. A missed file created an inconsistent security posture.
- **Resolved in session:** 003
- **Resolution notes:** Created `supabase/functions/_shared/cors.ts` (cors headers + corsResponse), `_shared/auth.ts` (requireAuth + requireAdmin), and `_shared/utils.ts` (escHtml, getClientIp, jsonResponse). Updated all 10 functions to import from shared modules. Zero inline duplication remains.

---

## Group B — JavaScript Architecture

### I-003 · `apply.js` is a 3,204-line god file
- **Status:** ✅ RESOLVED
- **Severity:** HIGH
- **Category:** Code Organization / Maintainability
- **Affected files:**
  - `js/apply.js`
- **Description:** The `RentalApplication` class handles form rendering, multi-step navigation, field validation, translation strings (700+ lines), file uploads, payment UI, geolocation/autocomplete, SSN masking, co-applicant conditionals, submission, retry logic, duplicate detection, and progress saving — all in one file.
- **Impact:** Editing one feature requires navigating 3,000+ lines. AI sessions frequently hit context limits trying to work with this file.
- **Fix plan:** Split into focused modules: `apply-core.js`, `apply-validation.js`, `apply-translations.js`, `apply-submit.js`, `apply-files.js`.
- **Resolved in session:** 009
- **Resolution notes:** Split into 5 companion modules: apply-translations.js, apply-validation.js, apply-files.js, apply-submit.js, apply-property.js. apply.js reduced from 3,204 → 1,365 lines.

---

### I-004 · `cp-api.js` runs dual-mode (ES module + global window namespace)
- **Status:** ✅ RESOLVED
- **Severity:** HIGH
- **Category:** Architecture / Fragility
- **Affected files:**
  - `js/cp-api.js`
- **Description:** `cp-api.js` used ES module `export` statements but also manually attached everything to `window.CP` for non-module pages. Caused a real production outage in March 2026.
- **Impact:** Adding a new function required threading it through both systems. Easy to miss a path silently.
- **Resolved in session:** 004
- **Resolution notes:** All functions (`buildApplyURL`, `incrementCounter`, `getSession`, `getLandlordProfile`, `requireAuth`, `signIn`, `signUp`, `signOut`, `resetPassword`, `updateNav`) are now defined once as plain functions and registered in `window.CP` as the single source of truth. ES `export` statements at the bottom are thin re-exports with no logic of their own. Adding a new function now requires editing exactly one place. Admin pages and `apply.js` continue to use `window.CP` unchanged — no page edits required.

---

## Group C — Data Layer

### I-005 · `applications` table has 116 columns (wide flat table)
- **Status:** ✅ RESOLVED
- **Severity:** HIGH
- **Category:** Database Architecture / Scalability
- **Affected files:**
  - `SETUP.sql`
  - `supabase/functions/process-application/index.ts`
  - `supabase/functions/generate-lease/index.ts`
  - `supabase/functions/sign-lease/index.ts`
- **Description:** All application data lived in one flat table. Co-applicant columns (15+) were NULL for ~80%+ of rows. Lease columns (20+) are NULL until the lease stage.
- **Impact:** Adding any new field required `ALTER TABLE` on the busiest table. Co-applicant and lease data have distinct lifecycles that are better modeled as separate tables.
- **Fix plan:** Extract co-applicant fields into `co_applicants` table; evaluate extracting lease fields into `leases` table. Requires careful migration with data backfill.
- **Resolved in session:** 010
- **Resolution notes:** Created `co_applicants` table with 14 extracted columns and a UNIQUE constraint on `app_id` (one-to-one with applications). Idempotent data migration and column-drop blocks added to SETUP.sql. Updated `get_application_status()`, `get_lease_financials()`, `admin_application_view`, and `process-application` Edge Function. The 4 lease-signing columns (`co_applicant_signature`, `co_applicant_signature_timestamp`, `co_applicant_lease_token`, `has_co_applicant`) remain on `applications` as they are tightly coupled to the `sign_lease_co_applicant()` DB function. Lease column extraction (I-005b) remains a future candidate.

---

### I-006 · Inconsistent API return shapes in `cp-api.js`
- **Status:** ✅ RESOLVED
- **Severity:** MEDIUM
- **Category:** API Design / Developer Experience
- **Affected files:**
  - `js/cp-api.js`
  - All consumer pages
- **Description:** Direct Supabase calls return `{ data, error }`. Edge Function calls return `{ success, error }`. Some methods throw. Pages check inconsistently.
- **Impact:** Every new page feature requires checking which pattern the specific API method uses. Bugs from shape mismatches are silent.
- **Fix plan:** Normalize all `cp-api.js` methods to return `{ ok: boolean, data: any, error: string | null }`.
- **Resolved in session:** 008
- **Resolution notes:** Added `_ok()` helper; rewrote `callEdgeFunction` to never throw and unwrap Edge Function envelopes; normalized all 23 public methods across Applications, Properties, Inquiries, Landlords, EmailLogs, ApplicantAuth. Updated 8 consumer files to use `res.ok` / `res.data` patterns.

---

## Group D — Frontend Structure

### I-007 · Nav and footer HTML fully duplicated across 12+ public pages
- **Status:** ✅ RESOLVED
- **Severity:** MEDIUM
- **Category:** Code Duplication / Maintainability
- **Affected files:**
  - `index.html`, `listings.html`, `about.html`, `faq.html`, `how-it-works.html`, `how-to-apply.html`, `property.html`, `privacy.html`, `terms.html`, `404.html`, `apply.html`, `health.html`
- **Description:** Every public page contains a full copy of the nav and footer. Nav has already drifted slightly between pages (`class="nav scrolled"` vs `class="nav"`).
- **Impact:** Changing a nav link or footer content requires editing 12+ files.
- **Fix plan:** Create `components/nav.html` and `components/footer.html`. Use a `fetch()`-based HTML include loader in a shared `components.js`.
- **Resolved in session:** 011
- **Resolution notes:** Created `components/nav.html` and `components/footer.html` as single sources of truth. `js/components.js` fetches both in parallel, injects into `#site-nav` / `#site-footer` placeholders, sets active nav links by pathname, wires the mobile drawer canonically (including Escape key and aria-expanded), hydrates CONFIG email/phone, and calls `CP.updateNav()` once cp-api loads. All 10 public pages updated. Four pages (`how-it-works.html`, `privacy.html`, `terms.html`, `404.html`) now correctly load `cp-api.js`, fixing the previously-broken auth link on those pages. Baked-in `nav scrolled` class drift on `listings.html` corrected.

---

### I-008 · Listings page uses client-side filtering over full dataset
- **Status:** ✅ RESOLVED
- **Severity:** MEDIUM
- **Category:** Performance / Scalability
- **Affected files:**
  - `listings.html`
  - `js/cp-api.js`
  - `css/listings.css`
- **Description:** Search filters operated on the client after all active listings were fetched. No pagination, no URL-based filter state.
- **Impact:** Won't scale as listings grow. Filters can't be bookmarked or shared.
- **Fix plan:** Push filter logic into server-side query parameters. Add URL query string sync. Add pagination.
- **Resolved in session:** 012
- **Resolution notes:** Added `CP.Properties.getListings(filters)` to `cp-api.js` — handles all filter types (text search via ilike, property type, exact/min beds, min baths, min/max rent, pets/parking/available-now pills), all 4 sort options, and pagination via Supabase `.range()` + exact count. Rewrote `listings.html` JS block: state lives in URL (`?q=&type=&beds=&maxrent=&sort=&page=`), `readURL()` / `pushURL()` / `syncControls()` keep URL and UI controls in sync, `popstate` listener makes back/forward navigation work. `renderPagination()` builds a smart page bar (first/last/current ±1 with ellipsis). Page size is 24. Added `<div id="paginationBar">` to HTML. Added pagination CSS to `listings.css`. Zero client-side filtering remains.

---

### I-009 · Lease template HTML hardcoded inside Edge Functions
- **Status:** ✅ RESOLVED
- **Severity:** LOW
- **Category:** Maintainability / Separation of Concerns
- **Affected files:**
  - `supabase/functions/sign-lease/index.ts`
  - `supabase/functions/generate-lease/index.ts`
- **Description:** Both functions contain hundreds of lines of inline HTML for building the lease PDF. Changing lease language requires a full Edge Function redeployment.
- **Fix plan:** Extract lease HTML template into `_shared/lease-template.ts`.
- **Resolved in session:** —
- **Resolution notes:** —

---

### I-010 · No consistent loading/empty-state pattern across pages
- **Status:** ✅ RESOLVED
- **Severity:** LOW
- **Category:** UX Consistency / Mobile Experience
- **Affected files:**
  - All admin and landlord pages
- **Description:** Each page implements loading states ad-hoc. No shared skeleton component, no consistent empty-state, no error boundary pattern.
- **Fix plan:** Add `UI.skeletonRows(n)`, `UI.emptyState(message, icon)`, and `UI.errorState(message)` helpers to `cp-api.js`.
- **Resolved in session:** 013
- **Resolution notes:** Added three helpers to the `UI` object in `cp-api.js`: `skeletonRows(rows, cols)` for shimmer placeholder rows, `emptyState(message, icon, cols)` for zero-results states (table and div modes), and `errorState(message, cols)` for fetch-failure states. Added shimmer animation CSS (`.sk-row`, `.sk-cell`, `@keyframes cp-shimmer`) and state CSS (`.cp-empty-state`, `.cp-error-state`) to both `admin.css` (→ v3) and `landlord.css` (→ v3). Wired into 7 admin pages and 3 landlord pages. All prior ad-hoc inline loading strings, spinner markup, and hardcoded empty-state HTML replaced.

---

*End of issue registry. Append new issues below this line with the next available ID.*

---

## Group E — QA Sweep Findings (Session 014)

### I-011 · `process-application` mixes inline and shared CORS headers
- **Status:** ✅ RESOLVED
- **Severity:** LOW
- **Category:** Code Consistency
- **Affected files:**
  - `supabase/functions/process-application/index.ts`
- **Description:** This function imports `corsResponse` from `_shared/cors.ts` (used for the OPTIONS preflight) but also defines its own inline `corsHeaders` object on line 9, which it uses for all non-2xx error responses. The values are identical so there is no functional bug, but it's an I-002 leftover that wasn't fully cleaned.
- **Fix plan:** Remove the inline `corsHeaders` constant. Import `cors` from `_shared/cors.ts` alongside `corsResponse`. Replace all `{ ...corsHeaders, 'Content-Type': 'application/json' }` spreads with `{ ...cors, 'Content-Type': 'application/json' }`.
- **Resolved in session:** 014
- **Resolution notes:** Added `cors` to the existing `_shared/cors.ts` import. Removed the 3-line inline `corsHeaders` constant. Replaced all 5 spread sites with `{ ...cors, … }`. I-002 is now fully clean across all 10 Edge Functions.

---

## Group F — Property Upload/Posting System Audit (Session 016)

> Full audit of the property upload/posting system performed in Session 016.
> Covers new-listing.html, edit-listing.html, imagekit.js, imagekit-upload Edge Function,
> cp-api.js (Properties + filters), listings.html, property.html, and SETUP.sql.
> No files were changed during this audit — all issues are OPEN at session start.

---

### I-012 · `fileBase64` vs `fileData` field name mismatch — photo uploads completely broken
- **Status:** ✅ RESOLVED
- **Severity:** CRITICAL
- **Category:** Bug — Integration Mismatch
- **Affected files:**
  - `js/imagekit.js` (line 89)
  - `supabase/functions/imagekit-upload/index.ts` (line 38)
- **Description:** `imagekit.js` sends the base64 image payload under the key `fileBase64`. The `imagekit-upload` Edge Function destructures `{ fileData, fileName, folder }` — so `fileData` is always `undefined`. The function returns `{ success: false, error: 'fileData and fileName required' }` on every upload attempt.
- **Impact:** ALL photo uploads fail — both on new listing creation and on edit. No property can be listed with photos.
- **Fix plan:** In `imagekit.js` line 89, rename `fileBase64:` to `fileData:`. One-line fix. No Edge Function changes needed.
- **Resolved in session:** 016
- **Resolution notes:** Renamed `fileBase64:` to `fileData:` on line 89 of `js/imagekit.js`. The Edge Function already used `fileData` correctly — only the client-side key name was wrong. One character change; no other files affected.

---

### I-013 · Parking filter pill always returns zero results
- **Status:** ✅ RESOLVED
- **Severity:** CRITICAL
- **Category:** Bug — Type Mismatch
- **Affected files:**
  - `js/cp-api.js` (line 222)
- **Description:** `getListings()` applies the Parking filter pill as `.eq('parking', true)`. The `parking` column is `TEXT` (values: `"Street"`, `"1 car garage"`, `"None"`, `null`). Comparing a TEXT column to a boolean always returns zero rows in PostgreSQL.
- **Impact:** The "Parking" filter pill on listings.html returns 0 results for every search, silently.
- **Fix plan:** Replace `.eq('parking', true)` with `.not('parking', 'is', null).neq('parking', '').neq('parking', 'None')` — this matches any property that has a non-empty, non-"None" parking value.
- **Resolved in session:** 016
- **Resolution notes:** Replaced `.eq('parking', true)` with `.not('parking', 'is', null).neq('parking', '').neq('parking', 'None')` in `cp-api.js`. Now correctly matches any property with a real parking option (Street, 1 car garage, 2 car garage, Driveway, Parking lot) while excluding null and "None" values.

---

### I-014 · Draft autosave does not save or restore checkbox state
- **Status:** ✅ RESOLVED
- **Severity:** HIGH
- **Category:** Bug — Data Loss
- **Affected files:**
  - `landlord/new-listing.html` (`autosaveDraft()` and `applyDraftToForm()`)
- **Description:** `autosaveDraft()` saves only text input and select values to `sessionStorage`. The utilities checkboxes (`#utilitiesGroup`), amenities checkboxes (`#amenitiesGroup`), and lease terms checkboxes (`#step2 .checkbox-group`) trigger `autosaveDraft` on change, but none of their checked values are written to the draft object. `applyDraftToForm()` similarly has no logic to restore any checkbox state. Only `petsAllowed` (radio) is saved and restored.
- **Impact:** A landlord who starts filling the form, navigates away, and resumes via the "Resume Draft" banner will silently lose all utility, amenity, and lease term selections.
- **Resolved in session:** 016 (I-014 fix pass)
- **Resolution notes:** In `autosaveDraft()`, added three array captures: `leaseTerms` (`#step2 .checkbox-group input:checked`), `utilities` (`#utilitiesGroup input:checked`), and `amenities` (`#amenitiesGroup input:checked`). In `applyDraftToForm()`, added three corresponding restore loops — each iterates over the group's checkboxes and sets `.checked = true` where the value is present in the saved array. Guards prevent partial restoration if the array is empty or missing (e.g. for drafts saved before this fix).

---

### I-015 · Photos uploaded to ImageKit are never deleted (storage leak)
- **Status:** ✅ RESOLVED
- **Severity:** HIGH
- **Category:** Resource Leak / Missing Feature
- **Affected files:**
  - `supabase/functions/imagekit-delete/index.ts` (new)
  - `js/imagekit.js` — `deleteFromImageKit()` helper added
  - `landlord/edit-listing.html` — post-save diff + full-listing-delete paths wired
- **Description:** When a landlord removed a photo, the URL was spliced from `currentPhotoUrls` and saved to the DB but the CDN file was never deleted. When a listing was deleted entirely, all CDN files remained permanently.
- **Resolved in session:** 016 (fix pass)
- **Resolution notes:** Created `supabase/functions/imagekit-delete/index.ts` — authenticates the caller, verifies the `fileId` belongs to a property owned by that landlord (admin bypass), calls `DELETE https://api.imagekit.io/v1/files/{fileId}`, treats 404 as success (idempotent). Added `deleteFromImageKit()` to `js/imagekit.js` as a thin fetch wrapper. Wired two call sites in `edit-listing.html`: (1) post-save: diffs `originalPhotoFileIds` vs `finalPhotoFileIds` and fires deletes for removed fileIds; (2) listing delete: fires deletes for all `currentPhotoFileIds` after the DB row is gone. Both paths are fire-and-forget — CDN failure never blocks the UI. Legacy photos with null fileIds are silently skipped. Prerequisite I-028 (storing fileIds) was resolved in the same session.

---

### I-016 · Photo uploads are sequential — severe performance issue on mobile
- **Status:** ✅ RESOLVED
- **Severity:** HIGH
- **Category:** Performance
- **Affected files:**
  - `js/imagekit.js` — `uploadMultipleToImageKit` rewritten
  - `landlord/new-listing.html` — progress text updated
  - `landlord/edit-listing.html` — progress text updated
- **Description:** `uploadMultipleToImageKit()` used a `for...of` loop with `await` — each photo waited for the previous to finish. 20 photos at ~1s each = 20+ seconds of blocking upload on mobile.
- **Resolved in session:** 016 (fix pass)
- **Resolution notes:** Rewrote `uploadMultipleToImageKit()` with a 3-concurrent worker-pool pattern using `Promise.all`. Workers claim file indices atomically (JS single-threaded, no mutex needed). Result order is preserved — `results[i]` always corresponds to `files[i]`. Aggregate progress sums per-file progress arrays and divides by file count, remaining accurate across concurrent uploads. Concurrency capped at 3 to stay well inside ImageKit rate limits while reducing wall-clock time ~3x. Progress text in both callers updated from "Uploading photo N of M…" (meaningless with concurrency) to "Uploading photos… (N of M done)" using a local `doneCount` incremented when `pct === 100`.

---

### I-017 · File size limit inconsistency: UI says 10MB, code allows 20MB
- **Status:** ✅ RESOLVED
- **Severity:** HIGH
- **Category:** UX / Documentation Mismatch
- **Affected files:**
  - `landlord/new-listing.html` (line ~363 — dropzone hint text)
  - `js/imagekit.js` (line 62 — 20MB throw)
- **Description:** The photo dropzone tells users "JPG, PNG, WEBP up to 10MB each." The `imagekit.js` client-side validation throws only at 20MB. The UI hint is incorrect — users uploading 12–19MB files will succeed despite the documented limit. If the limit is ever tightened in code, the UI will be correct by coincidence.
- **Fix plan:** Align both to the same value. Recommended: 10MB (safer for CDN delivery and mobile upload speed). Update `imagekit.js` throw threshold and the dropzone hint to both say 10MB.
- **Resolved in session:** 016
- **Resolution notes:** Updated `imagekit.js` throw threshold from 20MB to 10MB. The `new-listing.html` dropzone hint already read "up to 10MB each" — no change needed there. `edit-listing.html` had no size hint. Both form and code now consistently enforce 10MB.

---

### I-018 · `applications_count` and `saves_count` are permanently zero
- **Status:** ✅ RESOLVED
- **Severity:** HIGH
- **Category:** Bug — Missing Triggers
- **Affected files:**
  - `SETUP.sql` (no triggers for these columns)
- **Description:** `properties.applications_count` and `properties.saves_count` are declared with `DEFAULT 0` and are never updated. There are no DB triggers on `applications` or `saved_properties` to increment/decrement them. The `increment_counter()` RPC is explicitly restricted to `views_count` only. The landlord dashboard and admin listings page display these columns as meaningful stats.
- **Impact:** Every property shows 0 applications and 0 saves in the dashboard regardless of real activity. Landlords cannot assess listing performance.
- **Resolved in session:** 016 (fix pass)
- **Resolution notes:** Added `trg_applications_count()` (AFTER INSERT on `applications` → increments `applications_count`, guards against NULL `property_id`) and `trg_saves_count()` (AFTER INSERT OR DELETE on `saved_properties` → increments/decrements `saves_count`, floored at 0 on decrement). Both trigger functions and their `CREATE TRIGGER` + `DROP TRIGGER IF EXISTS` wrappers added to `SETUP.sql` section 10, idempotent on re-run. Backfill of historical data not included — counters will be accurate from this deployment forward.

---

### I-019 · Geocoding is a race condition — `lat`/`lng` may be null at submit
- **Status:** ✅ RESOLVED
- **Severity:** MEDIUM
- **Category:** Bug — Race Condition
- **Affected files:**
  - `landlord/new-listing.html` (`geocodeAddress`, `goTo`, `submitListing`)
- **Description:** `geocodeAddress()` fires when the landlord advances from Step 1 to Step 2. It stores a promise in `_geocodePromise` and resolves `geocodedLat`/`geocodedLng` asynchronously. At submit, the code awaits `_geocodePromise` — but only if it exists. If the landlord changes the address after Step 1, or navigates quickly such that the promise is already stale, coordinates may be null.
- **Resolved in session:** 016 (multi-fix pass)
- **Resolution notes:** `geocodeAddress()` now resets `geocodedLat`/`geocodedLng` to null at the start of every call — stale coords from a previous address can no longer persist if a new geocode fails. Added debounced (800ms) `input` listeners on `address`, `city`, `zip` and a `change` listener on `state` so geocoding re-fires on any address field edit, not just step navigation. Removed the `geocodeAddress()` call from `goTo()` as it is now redundant. `submitListing()` already awaits `_geocodePromise` unconditionally, so the freshest result is always used at submit time.

---

### I-020 · Duplicate listing detection is client-side only and bypassable
- **Status:** ✅ RESOLVED (documented)
- **Severity:** MEDIUM
- **Category:** Missing Server-Side Enforcement
- **Affected files:**
  - `landlord/new-listing.html` (duplicate check block)
- **Description:** The duplicate address check is an intentional soft guard — the landlord can dismiss the `window.confirm()` and proceed. No server-side constraint exists.
- **Resolved in session:** 016 (multi-fix pass)
- **Resolution notes:** Added a code comment in `new-listing.html` documenting that this is an intentional soft guard, not a hard enforcement. Comment includes the partial unique index SQL to add if stricter enforcement is desired in future: `CREATE UNIQUE INDEX ON properties (landlord_id, lower(address), lower(city)) WHERE status != 'archived'`.

---

### I-021 · "Preview as Tenant" shows no photos
- **Status:** ✅ RESOLVED
- **Severity:** MEDIUM
- **Category:** UX Bug
- **Affected files:**
  - `landlord/new-listing.html` (`previewBtn` click handler)
- **Description:** The preview data object passed to `sessionStorage` hardcoded `photo_urls: []`.
- **Resolved in session:** 016 (multi-fix pass)
- **Resolution notes:** Replaced `photo_urls: []` with `pendingFiles.map(f => URL.createObjectURL(f))`. This generates temporary browser blob URLs for each pending file so `property.html?preview=true` can display real photos. Blob URLs are tab-scoped and cleaned up automatically when the tab closes — no `revokeObjectURL` is needed for this use case.

---

### I-022 · Draft stored in `sessionStorage` — lost on tab close
- **Status:** ✅ RESOLVED
- **Severity:** MEDIUM
- **Category:** UX / Data Loss
- **Affected files:**
  - `landlord/new-listing.html` (all `sessionStorage` draft calls)
- **Description:** The autosave draft used `sessionStorage`, which is cleared when the browser tab is closed. The resume banner claimed the draft was saved for 7 days (checked via a `savedAt` timestamp), but `sessionStorage` would be empty on any new tab or browser restart — the 7-day check was irrelevant because the data wouldn't exist at all.
- **Impact:** A landlord who spends 20 minutes filling a form, closes the tab accidentally, and returns the next day finds no draft. The "7 days" messaging was misleading.
- **Fix plan:** Switch all draft `sessionStorage` calls to `localStorage`. The 7-day expiry logic already exists and is correct — only the storage medium needs to change.
- **Resolved in session:** 016
- **Resolution notes:** Replaced all 8 draft key references (`cp_draft_s1`, `cp_draft_propid`) from `sessionStorage` to `localStorage` in `new-listing.html`. The preview key (`cp_listing_preview`) intentionally remains in `sessionStorage` — it is consumed by `property.html?preview=true` opened in a new tab from the same session and should not persist across sessions. The 7-day expiry logic was already correct and required no changes.

---

### I-023 · State dropdown defaults to Michigan for all users
- **Status:** ✅ RESOLVED
- **Severity:** MEDIUM
- **Category:** UX Bug
- **Affected files:**
  - `landlord/new-listing.html` (state select)
- **Description:** The state dropdown had `selected` on the Michigan option. `edit-listing.html` was unaffected (uses dynamic `sel()` helper).
- **Resolved in session:** 016 (multi-fix pass)
- **Resolution notes:** Removed `selected` attribute from the Michigan `<option>`. The blank `<option value="">Select State</option>` was already present as the first option and now correctly defaults.

---

### I-024 · Full-text search index (`search_tsv`) too narrow — excludes description and amenities
- **Status:** ✅ RESOLVED
- **Severity:** MEDIUM
- **Category:** Search Quality
- **Affected files:**
  - `SETUP.sql` (search_tsv generated column definition)
- **Description:** `search_tsv` indexed only `title`, `city`, `state`, and `address`. Searches for amenities, property type, or description terms returned no results.
- **Resolved in session:** 016 (multi-fix pass)
- **Resolution notes:** Extended the `GENERATED ALWAYS AS` expression to include `description`, `property_type`, and `array_to_string(amenities, ' ')`. Used `DROP COLUMN IF EXISTS` + `ADD COLUMN` (not `ALTER COLUMN SET EXPRESSION`) for Postgres 15 compatibility. GIN index recreated with `CREATE INDEX IF NOT EXISTS`.

---

### I-025 · No photo reordering on the new listing form
- **Status:** ✅ RESOLVED
- **Severity:** MEDIUM
- **Category:** UX Gap
- **Affected files:**
  - `landlord/new-listing.html` (photo step)
  - `css/landlord.css` (new photo action button styles)
- **Description:** `new-listing.html` had no way to set the cover photo before submission.
- **Resolved in session:** 016 (multi-fix pass)
- **Resolution notes:** Replaced `addPhotoPreview()` with a full `renderPhotoGrid()` function backed by a parallel `pendingPreviews[]` array (data URLs, same order as `pendingFiles[]`). The first item shows a "Cover" badge; all others show a ⭐ set-as-cover button that splices the file and preview to index 0 and re-renders. All items show a ✕ remove button. Added `.photo-action-bar`, `.photo-action-btn`, `.new-cover-btn`, `.new-delete-btn`, `.new-cover-label`, and `.photo-preview-item.is-cover` CSS to `landlord.css` — matching the edit-listing visual style.

---

### I-026 · `Properties.create()` in cp-api.js is unused — parallel insert paths exist
- **Status:** ✅ RESOLVED (documented)
- **Severity:** LOW
- **Category:** Code Consistency / Maintainability
- **Affected files:**
  - `js/cp-api.js` (`Properties.create`)
- **Description:** `new-listing.html` bypasses `Properties.create()` and inserts directly to avoid a two-step ID generation + insert race during retries.
- **Resolved in session:** 016 (multi-fix pass)
- **Resolution notes:** Added a code comment above `Properties.create()` explaining the divergence, noting which file to update in parallel if the payload shape changes, and suggesting a future unification path (accept an optional pre-generated id param).

---

### I-027 · Submit button not disabled immediately — double-submit window exists
- **Status:** ✅ RESOLVED
- **Severity:** LOW
- **Category:** UX Bug
- **Affected files:**
  - `landlord/new-listing.html` (`submitListing`)
- **Description:** The submit button was disabled after async work had already begun, leaving a brief window for a second click.
- **Resolved in session:** 016 (multi-fix pass)
- **Resolution notes:** `btn.disabled = true` was already the first statement in `submitListing()` — confirmed via code review that no async work precedes it. Added an explicit `// I-027` comment confirming the placement is intentional.

---

### I-028 · `fileId` returned from ImageKit upload is silently discarded
- **Status:** ✅ RESOLVED
- **Severity:** LOW
- **Category:** Data Model Gap (root cause of I-015)
- **Affected files:**
  - `js/imagekit.js` — `uploadToImageKit` and `uploadMultipleToImageKit`
  - `landlord/new-listing.html` — photo upload caller
  - `landlord/edit-listing.html` — photo upload caller + state management
  - `SETUP.sql` — `properties` table schema
- **Description:** The `imagekit-upload` Edge Function returns `{ success: true, url, fileId }`. `imagekit.js` returned only `data.url` to callers. The `fileId` was silently lost, making CDN deletion impossible.
- **Resolved in session:** 016 (fix pass)
- **Resolution notes:** `uploadToImageKit()` now returns `{ url, fileId }` instead of a bare string. `uploadMultipleToImageKit()` now returns `{ url, fileId }[]`. Added `photo_file_ids TEXT[]` column to `properties` table (schema + idempotent `ALTER TABLE IF NOT EXISTS` migration). Both callers updated: `new-listing.html` collects fileIds into a parallel array and passes `photo_file_ids` to the DB insert; `edit-listing.html` tracks `currentPhotoFileIds` in lock-step with `currentPhotoUrls` through remove/reorder/save operations. Legacy listings with no fileIds will have `null` entries in the array — `photo_file_ids` may be shorter than `photo_urls` for pre-fix rows. I-015 (actual CDN deletion) remains open and can now be implemented.

---

## Group G — Launch Readiness (Session 017 Audit)

> Full-platform launch readiness audit performed in Session 017.
> No code was changed during this audit — all issues below are OPEN at session start.
> Fix order and implementation details are in `.agents/instructions.md` under "LAUNCH FIX BACKLOG".

---

### I-029 · sitemap.xml and robots.txt contain YOUR-DOMAIN.com placeholder
- **Status:** ✅ RESOLVED
- **Severity:** LAUNCH BLOCKER
- **Category:** Configuration / SEO
- **Affected files:** `sitemap.xml`, `robots.txt`, `generate-config.js`
- **Description:** Both files contain the literal string `YOUR-DOMAIN.com` as placeholder URLs. Google will index the wrong domain. Bots will see the placeholder. The Sitemap declaration in `robots.txt` also points to the wrong domain.
- **Fix plan:** Add `SITE_URL` env var to `generate-config.js`. At build time, read `sitemap.xml` and `robots.txt`, replace all occurrences of `YOUR-DOMAIN.com` with the real domain, and write the files back. Emit a warning (not a hard failure) if `SITE_URL` is not set.
- **Resolved in session:** 018
- **Resolution notes:** Added `SITE_URL` env var to `generate-config.js`. At build time, both `sitemap.xml` and `robots.txt` are read and all occurrences of `YOUR-DOMAIN.com` replaced with the real domain. Emits a warning (not a hard failure) if `SITE_URL` is not set.

---

### I-030 · og:url hardcoded to staging domain on 7 pages
- **Status:** ✅ RESOLVED
- **Severity:** LAUNCH BLOCKER
- **Category:** SEO / Social Sharing
- **Affected files:** `js/components.js`
- **Description:** `index.html`, `listings.html`, `about.html`, `faq.html`, `how-it-works.html`, `how-to-apply.html`, and `apply.html` all have `og:url` hardcoded to `https://choice-properties.pages.dev/...`. When users share links on social media, the preview card shows the staging URL. `property.html` is unaffected — it already sets `#ogUrl` dynamically.
- **Fix plan:** In `js/components.js`, after component injection, add one line: `document.querySelector('meta[property="og:url"]')?.setAttribute('content', location.href)`. Covers all 7 pages in one place without touching individual HTML files.
- **Resolved in session:** 018
- **Resolution notes:** Added one line to `js/components.js` immediately after component HTML injection: `document.querySelector('meta[property="og:url"]')?.setAttribute('content', location.href)`. Covers all 7 affected pages. `property.html` unaffected — it already manages `#ogUrl` dynamically.

---

### I-031 · Build command incomplete — generate-config.js never runs on Cloudflare Pages
- **Status:** ✅ RESOLVED
- **Severity:** LAUNCH BLOCKER
- **Category:** Deployment / Build Configuration
- **Affected files:** `package.json`
- **Description:** `package.json` build script is `"node generate-config.js"`. Cloudflare Pages runs this command on deploy — but `build.js` (the CSS concatenation step) is never called. More critically, if Cloudflare Pages is configured to run `npm run build`, it currently runs only `generate-config.js` and skips `build.js`. The correct command is `node generate-config.js && node build.js`.
- **Fix plan:** Change `"build": "node generate-config.js"` to `"build": "node generate-config.js && node build.js"` in `package.json`.
- **Resolved in session:** 018
- **Resolution notes:** Changed `"build"` script in `package.json` from `"node generate-config.js"` to `"node generate-config.js && node build.js"`. Both generators now run in order on every Cloudflare Pages deploy.

---

### I-032 · gallery_2x and strip presets missing from generated config
- **Status:** ✅ RESOLVED
- **Severity:** LAUNCH BLOCKER
- **Category:** Bug — Configuration Gap
- **Affected files:** `generate-config.js`
- **Description:** `config.example.js` defines `gallery_2x` (`tr:w-2400,q-85,f-webp`) and `strip` (`tr:w-80,h-60,c-maintain_ratio,q-70,f-webp`) in the ImageKit transforms object. `generate-config.js` omits both. `property.html` uses `CONFIG.img(url, 'gallery_2x')` for retina srcset and `CONFIG.img(url, 'strip')` for the thumbnail strip. On production, both calls silently fall back to the `gallery` transform (no error thrown, just wrong transform applied).
- **Fix plan:** Add the two missing presets to the `transforms` object inside the `CONFIG.img` template string in `generate-config.js`. Copy exact values from `config.example.js`.
- **Resolved in session:** 018
- **Resolution notes:** Added `gallery_2x: 'tr:w-2400,q-85,f-webp'` and `strip: 'tr:w-80,h-60,c-maintain_ratio,q-70,f-webp'` to the `transforms` object inside `CONFIG.img` in `generate-config.js`. Values copied exactly from `config.example.js`.

---

### I-033 · Homepage shows blank section when zero listings exist
- **Status:** ✅ RESOLVED
- **Severity:** LAUNCH BLOCKER
- **Category:** UX / First Impression
- **Affected files:** `index.html`
- **Description:** `loadFeaturedListings()` returns silently when the DB returns no listings (`!props || !props.length`). The Featured Listings section stays hidden. A new tenant arriving on launch day before any listings are seeded sees a blank section with no explanation. An empty marketplace destroys first-impression trust.
- **Fix plan:** When `props` is empty, render a warm empty-state message inside `#featuredGrid` (heading, subtext, icon) and still call `section.style.display = ''` so the section is visible. Use existing CSS tokens only.
- **Resolved in session:** 018
- **Resolution notes:** In `loadFeaturedListings()` in `index.html`, replaced the silent `return` when `!props.length` with an empty-state block rendered into `#featuredGrid`. Shows a house emoji, "Listings Coming Soon" heading, warm subtext, and a "Browse All Listings" CTA. Section becomes visible (`display:''`). Uses only CSS tokens — no hardcoded colours.

---

### I-034 · COMPANY_EMAIL has no fallback — blank mailto links if env var missing
- **Status:** ✅ RESOLVED
- **Severity:** MEDIUM
- **Category:** Configuration / UX
- **Affected files:** `generate-config.js`
- **Description:** If `COMPANY_EMAIL` is not set in the environment, nav and footer render a blank `mailto:` link. No visual error — just a broken email link.
- **Fix plan:** Change `process.env.COMPANY_EMAIL || ''` to `process.env.COMPANY_EMAIL || 'hello@choiceproperties.com'` in `generate-config.js`.
- **Resolved in session:** 018
- **Resolution notes:** Changed `process.env.COMPANY_EMAIL || ''` to `process.env.COMPANY_EMAIL || 'hello@choiceproperties.com'` in `generate-config.js`. Nav and footer mailto links now always have a valid fallback address.

---

### I-035 · property.html shows blank page when ?id= param is missing
- **Status:** ✅ RESOLVED
- **Severity:** MEDIUM
- **Category:** UX / Error Handling
- **Affected files:** `property.html`
- **Description:** Navigating directly to `property.html` with no `?id=` parameter (e.g. bookmarking the base URL, a malformed link, or a search engine crawl) renders a blank page with no error message or redirect. Real users almost never hit this path, but it looks broken if they do.
- **Fix plan:** At the top of the `DOMContentLoaded` handler in `property.html`, check for the `id` param. If missing or empty, call `CP.UI.toast('Property not found.', 'error')` and redirect to `/listings.html`.
- **Resolved in session:** 018
- **Resolution notes:** Replaced the silent `/index.html` redirect with a `CP.UI.toast('Property not found.', 'error')` call (with an 800ms delay before redirect so the toast is visible), then redirects to `/listings.html`. Falls back to an immediate redirect if `CP.UI` is not yet available.

---

### I-036 · DASHBOARD_URL secret undocumented in SETUP.md
- **Status:** ✅ RESOLVED
- **Severity:** LOW
- **Category:** Documentation Gap
- **Affected files:** `SETUP.md`
- **Description:** The `generate-lease` and `sign-lease` Edge Functions use `Deno.env.get('DASHBOARD_URL')` to build the signing link sent to tenants. This secret lives correctly in Supabase — but `SETUP.md` does not list it in the Supabase Secrets section. A developer following the setup guide would deploy, send a lease, and get a broken signing link with no idea why.
- **Fix plan:** Add `DASHBOARD_URL` to the Supabase Secrets list in `SETUP.md` with a clear description.
- **Resolved in session:** 018
- **Resolution notes:** Expanded the `DASHBOARD_URL` row in the Supabase Secrets table with a full description of its role in lease signing. Added a prominent ⚠️ callout block immediately below the table warning that missing this value will produce broken tenant signing links.

---

### DF-002 · No admin workflow to verify fee payment before application review
- **Status:** WONT FIX
- **Severity:** —
- **Category:** Payment Flow
- **Affected files:** `admin/applications.html`, `mark-paid` Edge Function
- **Description:** Application status can be moved to "under review" without any record of the application fee being collected. There is no fee-verified step in the admin workflow.
- **Owner decision:** The offline/manual payment process is intentional. This issue must not be reopened. See PAYMENT FLOW — OWNER-PROTECTED section in `.agents/instructions.md` for full context.
- **Resolved in session:** N/A
- **Resolution notes:** WONT FIX by owner decision. Never reopen.

---

## Session 020 — New Issues Identified (Scan: 2026-03-28)

> The following issues were identified during a deep audit of the property listing creation form
> (`landlord/new-listing.html`) and the rental application form (`apply.html` + companions).
> Issues are categorised by target form and severity.

---

### I-037 · [LISTING FORM] `window.confirm()` used for duplicate address check
- **Status:** OPEN
- **Severity:** HIGH
- **Category:** Bug — Banned API
- **Affected files:** `landlord/new-listing.html` (inline `<script>`, `submitListing()`)
- **Description:** The duplicate address detection check in `submitListing()` calls `window.confirm()` to ask the landlord whether to proceed. `window.confirm()` is banned by project rules (see `.agents/instructions.md` — "Never use `alert()`, `confirm()`, or `prompt()`"). On mobile browsers, `confirm()` may be blocked entirely or suppressed by the browser. A landlord with a duplicate address is silently unable to submit.
- **Fix plan:** Replace `window.confirm(...)` with `await CP.UI.cpConfirm(...)`. The dialog text and logic remain identical. The `submitListing()` function is already `async`, so no structural change is required. The duplicate check runs before photo uploads (see I-040), so this fix should be implemented together with I-040.
- **Planned session:** 020

---

### I-038 · [LISTING FORM] Negative numbers accepted for rent, sqft, deposit
- **Status:** OPEN
- **Severity:** HIGH
- **Category:** Bug — Validation Gap
- **Affected files:** `landlord/new-listing.html` (Step 2 inputs)
- **Description:** `rent`, `sqft`, and `deposit` number inputs have no `min` attribute. A landlord can type `-500` for rent. `validate2()` only checks `parseInt(v('rent')) < 1` for rent, so rent=0 is blocked but negatives are not caught. `sqft` and `deposit` have no validation at all. These values write directly to the database.
- **Fix plan:** Add `min="1"` to the `#rent` input. Add `min="0"` to `#sqft`, `#deposit`, and `#appFee` inputs in the HTML. Add server-side `CHECK (monthly_rent > 0)` constraint to the `properties` table in `SETUP.sql`. No JS validation changes required — the `min` attribute is sufficient for the client side.
- **Planned session:** 020

---

### I-039 · [LISTING FORM] Description has no maximum length enforced
- **Status:** OPEN
- **Severity:** MEDIUM
- **Category:** Bug — Validation Gap
- **Affected files:** `landlord/new-listing.html` (Step 5 textarea)
- **Description:** The description textarea has a visible `(0 / 2000 characters)` counter but no `maxlength` attribute and no maximum enforced in `validate5()`. A landlord can paste unlimited text. The DB column is `TEXT` with no limit. A very large description could cause display issues on the property detail page.
- **Fix plan:** Add `maxlength="2000"` to the `#description` textarea. In `validate5()`, add a check: `if (v('description').length > 2000) return err('Description must be 2000 characters or less.')`. The counter already exists and is wired — no JS changes needed beyond the validation check.
- **Planned session:** 020

---

### I-040 · [LISTING FORM] Duplicate address check runs after photos are uploaded
- **Status:** OPEN
- **Severity:** HIGH
- **Category:** Bug — Logic Order
- **Affected files:** `landlord/new-listing.html` (inline `<script>`, `submitListing()`)
- **Description:** In `submitListing()`, the current execution order is: (1) generate propId, (2) upload all photos to ImageKit, (3) check for duplicate address. If the landlord cancels the duplicate confirmation, the photos already uploaded to ImageKit are orphaned on the CDN with no corresponding DB record and no fileIds stored anywhere to delete them later. The duplicate check must run before any uploads begin.
- **Fix plan:** Move the duplicate address Supabase query to run immediately after propId resolution (step 0b), before the photo upload block. No other logic changes — just reorder the operations within `submitListing()`.
- **Planned session:** 020

---

### I-041 · [LISTING FORM] Available date accepts past dates
- **Status:** OPEN
- **Severity:** MEDIUM
- **Category:** Bug — Validation Gap
- **Affected files:** `landlord/new-listing.html` (Step 2 `#availDate` input)
- **Description:** The available date input has no `min` attribute. Landlords can select dates in the past. There is no validation for this in `validate2()`. A listing with a past available date is misleading to applicants.
- **Fix plan:** In the page's init JS, set `document.getElementById('availDate').min = new Date().toISOString().split('T')[0]` on page load. No validation function change required — the browser's native `min` enforcement is sufficient for this field since it is not required.
- **Planned session:** 020

---

### I-042 · [LISTING FORM] Draft restore banner does not warn that photos are not saved
- **Status:** OPEN
- **Severity:** MEDIUM
- **Category:** UX Gap
- **Affected files:** `landlord/new-listing.html` (draft resume banner)
- **Description:** The draft auto-save system saves all text fields to `localStorage`. Photos (`pendingFiles[]` and `pendingPreviews[]`) cannot be saved to `localStorage` and are not persisted. When a landlord resumes a draft, all text fields restore correctly but the photo grid is empty. The draft banner gives no indication of this — the landlord may believe their photos were saved.
- **Fix plan:** Add a note to the draft resume banner text: append `" Photos are not saved in drafts and will need to be re-uploaded."` to the banner description text. This is a single string change in the banner HTML template. No JS logic changes.
- **Planned session:** 020

---

### I-043 · [APPLICATION FORM] Uploaded documents silently discarded — never sent to server
- **Status:** ✅ RESOLVED
- **Severity:** CRITICAL
- **Category:** Bug — Data Loss
- **Affected files:** `js/apply-files.js`, `js/apply-submit.js`, `supabase/functions/process-application/index.ts`, `SETUP.sql`
- **Description:** Step 4 of the application form (Documents & Verification) presents three upload zones: Photo ID, Proof of Income, and Additional Document. `apply-files.js` stores selected files in `this._uploadedDocs` (a class property on the `RentalApplication` instance). At submission time, `apply-submit.js` built the POST payload using `new FormData(form)` — which only serialises standard `<input>`, `<select>`, and `<textarea>` elements. `this._uploadedDocs` was never read at submission time. The files were completely ignored. The Edge Function received `document_url: null` unconditionally. Applicants believed they had submitted their documents. They had not.
- **Resolved in session:** 022
- **Resolution notes:**
  - Added `uploadDocumentsToStorage()` method to `apply-submit.js`. Before the main Edge Function POST, it resolves the applicant's OTP auth session, then uploads each `File` in `this._uploadedDocs` to the `application-docs` Supabase Storage bucket at path `{user_id}/{doc_type}_{timestamp}.{ext}` — matching the existing RLS policy (`application_docs_upload_own`). Returns an array of storage paths. On partial failure, successfully uploaded paths are still returned and a warning toast is shown — the application is not aborted. Gracefully skips (with console warning) if the applicant is not authenticated.
  - Wired `uploadDocumentsToStorage()` into `handleFormSubmit()` immediately after the JSON payload is built. The returned paths are added to `jsonPayload.document_urls` (array). Progress overlay updated to show "Uploading documents…" with per-file feedback during Step 1.
  - Auth header in the main Edge Function POST is now the applicant's real JWT when available (not always the anon key), enabling server-side user linking.
  - Updated `process-application/index.ts` to read `formData.document_urls` and store it on the application record as `document_urls: Array.isArray(formData.document_urls) ? formData.document_urls : []`.
  - Added `document_urls JSONB DEFAULT '[]'::jsonb` column to the `applications` table in both the `CREATE TABLE` definition and as an idempotent `ALTER TABLE … ADD COLUMN IF NOT EXISTS` migration at the end of `SETUP.sql`. Legacy `document_url TEXT` column retained for backward compatibility.

---

### I-044 · [APPLICATION FORM] Government ID number stored in plaintext
- **Status:** OPEN
- **Severity:** HIGH
- **Category:** Security — PII Storage
- **Affected files:** `supabase/functions/process-application/index.ts`
- **Description:** The `government_id_number` field (driver's license number, passport number, or state ID number) is passed from the form directly into the database record with no masking, encryption, or truncation. SSN is correctly masked server-side to last-4 digits, but government ID number receives no equivalent treatment. Driver's license numbers are regulated PII in many US states and should not be stored in plaintext in a database column accessible via Supabase RLS queries.
- **Fix plan:** In `process-application/index.ts`, apply a masking function to `government_id_number` before storing: keep only the last 4 characters, prefix with `***-`. Example: `DL-123456789` → `***-6789`. Add a parallel `government_id_type` field (already stored, no change) so the reviewer knows what kind of ID was provided. Update the `maskGovernmentId()` helper function directly adjacent to the existing `maskSSN()` function for consistency.
- **Planned session:** 020

---

### I-045 · [APPLICATION FORM] Application fee resolved from stale client-side property data
- **Status:** OPEN
- **Severity:** HIGH
- **Category:** Bug — Data Integrity
- **Affected files:** `js/apply-submit.js`, `supabase/functions/process-application/index.ts`
- **Description:** At submission, `handleFormSubmit()` resolves the application fee from `this._properties[selectedPropId].application_fee` — a value cached in memory when the property dropdown loaded or the locked card's background fetch completed. If the landlord changes the application fee between the time the applicant opened the form and when they submitted (potentially hours later), the submitted fee is the old cached value. The Edge Function trusts this client-supplied value (`parseInt(formData.application_fee) || 0`) and writes it directly to the DB without re-fetching from the properties table.
- **Fix plan:** In `process-application/index.ts`, when `record.property_id` is known, fetch the current `application_fee` from the `properties` table (the query already happens to resolve `landlord_id`) and use that server-fetched value instead of the client-supplied one. Discard `formData.application_fee` entirely when a `property_id` is present. Keep the client-supplied fallback only for the edge case where no `property_id` is provided (direct form submissions without a linked property).
- **Planned session:** 020

---

### I-046 · [APPLICATION FORM] `alert()` used in document upload validation — banned API
- **Status:** OPEN
- **Severity:** HIGH
- **Category:** Bug — Banned API
- **Affected files:** `apply.html` (inline `<script>`, DOMContentLoaded handler), `js/apply-files.js`
- **Description:** The document upload zone validation in both `apply.html`'s inline script and `apply-files.js` uses `alert()` for file type and size errors (`alert('Only JPG, PNG, or PDF files are accepted.')` and `alert('File must be 10 MB or smaller.')`). `alert()` is banned by project rules. On some mobile browsers it is suppressed. On others it blocks the UI thread.
- **Fix plan:** Replace all `alert()` calls in both files with `CP.UI.toast(message, 'error')`. In `apply.html`'s inline script, `CP.UI` is available after `cp-api.js` loads (which is deferred). Guard with `window.CP?.UI?.toast(...) || console.error(...)` as a fallback for any timing edge case. In `apply-files.js`, `CP.UI` is available at the time `processFile()` runs (the form is fully initialised by then).
- **Planned session:** 020

---

### I-047 · [APPLICATION FORM] Free-text fields have no maxlength — unbounded input accepted
- **Status:** OPEN
- **Severity:** MEDIUM
- **Category:** Security / Validation Gap
- **Affected files:** `apply.html`
- **Description:** Multiple free-text `<input>` fields on the application form have no `maxlength` attribute: `firstName`, `lastName`, `currentAddress`, `employer`, `supervisorName`, `emergencyName`, `ref1Name`, `ref2Name`, and others. The Edge Function performs no server-side length validation on any field. A bot or automated tool can POST megabytes of text per field.
- **Fix plan:** Add `maxlength` attributes to all free-text inputs in `apply.html`. Reasonable limits: names → 100, addresses → 200, employer/job title → 150, phone (already gated by tel type) → 20, text areas that already have `maxlength` → leave as-is. No server-side changes required for this phase — the `maxlength` HTML attribute prevents the payload from being built with oversized values through the normal form flow.
- **Planned session:** 020

---

### I-048 · [APPLICATION FORM] Income-to-rent ratio display removed
- **Status:** OPEN
- **Severity:** LOW
- **Category:** UX — Feature Removal
- **Affected files:** `apply.html`, `js/apply.js` (or companion module that computes the ratio)
- **Description:** The income-to-rent ratio calculator (`#incomeRatioResult`, `#ratioDisplay`) is displayed on Step 3 (Employment & Income) when the applicant enters their income. Owner decision: remove this feature entirely from the applicant-facing form. The ratio is informational-only and adds no value to the applicant; any screening decision belongs on the admin/landlord side.
- **Fix plan:** Remove the `#incomeRatioResult` div and its contents from `apply.html`. Remove or comment out any JS that computes and renders the ratio (search for `ratioDisplay`, `_updateRatio`, `incomeRatioResult` across all apply JS files). Do not remove income fields themselves — only the ratio display widget.
- **Planned session:** 020

---

### I-049 · [APPLICATION FORM] Contact method preference shows as optional but is required
- **Status:** OPEN
- **Severity:** MEDIUM
- **Category:** UX Gap — Label Mismatch
- **Affected files:** `apply.html` (Step 6 contact preferences section)
- **Description:** The "Preferred Contact Method" checkbox group (Text Message / Email) has no required indicator (`*`) on its label, and the hint text says "You can select both methods" — implying the field is optional. However, `validateStep(6)` enforces that at least one option is checked and blocks advancement if none is selected. The UX signals optional; the validation enforces required. Applicants who skip it get a jarring error.
- **Fix plan:** Add a `<span class="required-star">*</span>` (or equivalent CSS class used elsewhere in the form) to the "Preferred Contact Method" label in `apply.html`. Change the hint text from "You can select both methods" to "Select at least one (you can select both)". No JS changes required.
- **Planned session:** 020


---

## Session 022 — Resolved

| I-043 | 🔴 CRITICAL | Documents silently discarded — never sent to server | Application | ✅ RESOLVED |

---

## Session 021 — Resolved

| I-050 | 🔴 CRITICAL (composite) | Photo upload overhaul — 7 sub-issues fixed | new-listing, imagekit.js | ✅ RESOLVED |

### Sub-issues

| ID | Sev | Title | Status |
|---|---|---|---|
| I-050a | 🔴 | Canvas compression — fixes 6 MB Supabase body cap causing silent failures on phone photos > 4.5 MB | ✅ RESOLVED |
| I-050b | 🟠 | XHR real upload progress — bar no longer freezes at 50% for 25 seconds | ✅ RESOLVED |
| I-050c | 🔴 | Per-file error isolation — one bad photo no longer aborts entire batch | ✅ RESOLVED |
| I-050d | 🔴 | HEIC rejection at selection time — iPhone default format rejected with actionable guidance | ✅ RESOLVED |
| I-050e | 🟠 | Photo deduplication in new-listing — same file selected twice no longer double-uploads | ✅ RESOLVED |
| I-050f | 🟡 | File size badge on thumbnails — immediate feedback at selection not submit | ✅ RESOLVED |
| I-050g | 🟠 | Preview blob URL fix — data URLs used instead of blob: URLs (iOS Safari cross-tab) | ✅ RESOLVED |
| I-050h | 🟡 | Dropzone hint text — formats listed, iPhone HEIC guidance added inline | ✅ RESOLVED |

---

## Session 027 — Photo Upload Deep Audit

### I-062 · ImageKit receives data URI instead of raw base64 — every upload fails
- **Priority:** 🔴 CRITICAL
- **Area:** Edge Functions / `supabase/functions/imagekit-upload/index.ts`
- **Status:** ✅ RESOLVED
- **Root cause:** `fileToBase64()` in `imagekit.js` returns a full data URI (`data:image/jpeg;base64,/9j/...`). The Edge Function was forwarding this string directly to ImageKit's upload API as the `file` FormData field. ImageKit's API expects **raw base64 only** — the `data:...;base64,` prefix causes it to treat the value as a URL to fetch (which fails) or reject the payload entirely. This silently broke every single photo upload regardless of whether env vars were correctly set.
- **Fix:** Added a one-line strip in the Edge Function before building FormData: `const base64Raw = fileData.includes(',') ? fileData.split(',')[1] : fileData`. Applied before `formData.append('file', ...)`.

---

### I-063 · `compressImage()` falls back to raw file silently — large files hit body cap with no error
- **Priority:** 🔴 CRITICAL
- **Area:** Client / `js/imagekit.js`
- **Status:** ✅ RESOLVED
- **Root cause:** When `createImageBitmap()` fails (older iOS, memory pressure, some PNG variants), `compressImage()` silently returned the original uncompressed file. A 10 MB iPhone photo then gets base64-encoded (+33% = ~13 MB payload), exceeding either the Supabase 6 MB body limit or the Edge Function's 20 MB cap. The error surfaced as a generic network failure with no hint about file size.
- **Fix:** Added a 4 MB size gate in the `catch` block. If the raw file exceeds 4 MB and cannot be compressed, a clear user-facing error is thrown: `"${file.name}" could not be compressed and is too large to upload uncompressed (X.X MB). Please reduce the photo size or use a different image.`

---

### I-064 · `getAccessToken()` signs user out on network failure — loses session and form state
- **Priority:** 🟠 HIGH
- **Area:** Client / `js/cp-api.js`
- **Status:** ✅ RESOLVED
- **Root cause:** `refreshSession()` can throw on network error OR return `{ error }` on auth rejection. The original code treated both the same: if no token was obtained for any reason, it called `auth.signOut()`. On a slow mobile connection where `refreshSession()` timed out (not an auth failure), this signed the landlord out mid-upload, destroyed their session, and redirected them to login — losing the filled form.
- **Fix:** Introduced a `refreshFailed` flag set only when the server actually returns an auth error (not when the call throws). `signOut()` is now only called when `refreshFailed === true`, never on a network throw.

---

### I-065 · `sb()` initialization has no guard — cryptic silent crash if supabase/CONFIG not ready
- **Priority:** 🟠 HIGH
- **Area:** Client / `js/cp-api.js`
- **Status:** ✅ RESOLVED
- **Root cause:** `cp-api.js` is loaded as `type="module"` which defers execution, but `defer` scripts and ES modules do not guarantee strict execution order relative to each other across all browsers (particularly mobile Safari and older Chromium WebViews). If `sb()` was called before `window.supabase` or `CONFIG` was available, it threw `Cannot read properties of undefined` — a cryptic crash that silently killed the entire auth and upload pipeline with no user-visible error.
- **Fix:** Added explicit guards in `sb()`: if `window.supabase` or `CONFIG` is not yet defined, a clear diagnostic error is thrown with an actionable message identifying which dependency is missing. Surfaces the root cause immediately in DevTools instead of a confusing downstream failure.

---

### I-066 · XHR upload timeout set to 120 s — double the Supabase Edge Function 60 s wall clock limit
- **Priority:** 🟡 MEDIUM
- **Area:** Client / `js/imagekit.js`
- **Status:** ✅ RESOLVED
- **Root cause:** `xhr.timeout` was set to 120,000 ms (2 minutes). Supabase Edge Functions hard-terminate after 60 seconds. The XHR `ontimeout` handler therefore never fires — instead the connection is reset by Supabase's infrastructure, which triggers `onerror` with "Network error — check your connection." Users saw a misleading connectivity error when the real issue was a slow upload exceeding the server's limit.
- **Fix:** `xhr.timeout` reduced to 55,000 ms (55 seconds), which fires cleanly before Supabase cuts the wire. `ontimeout` now correctly surfaces "Upload timed out — your connection may be slow. Please try again."

---

### I-067 · `propId` persistence across page reloads — audit finding (already implemented)
- **Priority:** 🟡 MEDIUM
- **Area:** Client / `landlord/new-listing.html`
- **Status:** ✅ RESOLVED (pre-existing — confirmed during audit)
- **Notes:** During the Session 027 audit, `propId` lifecycle was reviewed. It is already correctly persisted to `localStorage('cp_draft_propid')` at generation time and restored at the top of `submitListing()` before any photo upload begins. Orphaned photos on retry are prevented. No code change required — documented here for completeness.

---

## Session 024 — Security / Performance / SEO Audit

### I-051 · `sitemap.xml` ships with `YOUR-DOMAIN.com` placeholder — production SEO broken
- **Priority:** 🔴 CRITICAL
- **Area:** Build / SEO
- **Status:** ✅ RESOLVED
- **Fix:** `SITE_URL` added to the `required` array in `generate-config.js`. Build now exits with code 1 if `SITE_URL` is not set, with an actionable error message. The soft `console.warn` fallback removed. Set `SITE_URL` in Cloudflare Pages dashboard to unblock.

### I-052 · CSP `unsafe-inline` in `script-src` nullifies XSS protection
- **Priority:** 🟠 HIGH
- **Area:** Security / `generate-config.js` / `_headers`
- **Status:** ✅ RESOLVED
- **Fix:** `generate-config.js` now generates a cryptographic nonce per build (`crypto.randomBytes(16).toString('base64')`), injects `nonce="<value>"` into every inline `<script>` and `<script type="module">` block across all HTML files, and rewrites `_headers` to replace `'unsafe-inline'` in `script-src` with `'nonce-<value>'`. Style `unsafe-inline` retained — removing it would require eliminating all `style=""` attributes across 38+ files (tracked as future hardening).

### I-053 · `config.js` and `components.js` render-blocking on every page
- **Priority:** 🟠 HIGH
- **Area:** Performance / HTML (34 files)
- **Status:** ✅ RESOLVED
- **Fix:** `defer` added to all `<script src="/config.js">` and `<script src="/js/components.js">` tags across all 34 affected HTML files via `sed`. With `defer`, both scripts download in parallel with HTML parsing and execute in order after the document is parsed — eliminating the render-blocking stall on every page load.

### I-054 · Leaflet loaded from `unpkg.com` — no SRI, not in CSP, unaudited CDN
- **Priority:** 🟠 HIGH
- **Area:** Security / Performance / `property.html` / `listings.html`
- **Status:** ✅ RESOLVED
- **Fix:** Leaflet CSS and JS moved from `unpkg.com` to `cdnjs.cloudflare.com` (already in CSP allowlist) with `integrity=` SRI hashes for both files. `unpkg.com` removed from `script-src` and `style-src` in `_headers` CSP.

### I-055 · `imagekit-upload` accepts any file type, any filename, any payload size
- **Priority:** 🟠 HIGH
- **Area:** Security / `supabase/functions/imagekit-upload/index.ts`
- **Status:** ✅ RESOLVED
- **Fix:** Three guards added server-side before forwarding to ImageKit: (1) extension whitelist — only `jpg`, `jpeg`, `png`, `webp` accepted, returns 400 otherwise; (2) filename sanitization — path separators and shell-special chars stripped, double-dots collapsed; (3) base64 payload cap — rejects payloads over 20 MB (≈15 MB decoded) with HTTP 413.

### I-056 · `send-message` stores unbounded message text
- **Priority:** 🟡 MEDIUM
- **Area:** Edge Functions / `supabase/functions/send-message/index.ts`
- **Status:** ✅ RESOLVED
- **Fix:** Added `MAX_MESSAGE_LENGTH = 4000` guard. Returns HTTP 400 if message exceeds 4,000 chars or is not a non-empty string. Validated before DB insert.

### I-057 · In-memory rate limiting resets on every cold start
- **Priority:** 🟡 MEDIUM
- **Area:** Edge Functions / `process-application` / `send-inquiry`
- **Status:** ✅ RESOLVED (documented)
- **Fix:** Added prominent inline comment in both Edge Functions documenting the cold-start caveat and the path to persistent rate limiting (Supabase table or Upstash Redis). Behavior unchanged — meaningful protection against naive abuse, not a hard security boundary.

### I-058 · `apply.html` and auth-gated pages missing OG tags and `noindex`
- **Priority:** 🟡 MEDIUM
- **Area:** SEO / Meta / `apply.html` + `/apply/*` + `/landlord/*` + `/admin/*`
- **Status:** ✅ RESOLVED
- **Fix:** `noindex, nofollow` added to all 6 private landlord portal pages and all 9 admin pages. All `/apply/*` sub-pages already had `noindex`. `apply.html` already had `noindex`. Admin and landlord pages were missing it entirely.

### I-059 · `property.html` JSON-LD incomplete — missing `address`, `RentalAction`, `priceCurrency`
- **Priority:** 🟡 MEDIUM
- **Area:** SEO / `property.html`
- **Status:** ✅ RESOLVED
- **Fix:** JSON-LD block significantly expanded: added `potentialAction` (RentAction linking to apply page), `geo` (lat/lng coordinates), `datePosted`, `numberOfRooms`, `numberOfBathroomsTotal`, `floorSize` (sqft in FTK units), `amenityFeature` array (parking, pets, laundry, AC), and `availability`. Also injected a second `BreadcrumbList` block (Home → Listings → Property). All fields conditionally included — undefined values omitted cleanly.

### I-060 · Homepage and listings page have no JSON-LD structured data
- **Priority:** 🔵 LOW
- **Area:** SEO / `index.html` / `listings.html`
- **Status:** ✅ RESOLVED
- **Fix:** `index.html` — added `WebSite` schema with `SearchAction` (enables Google Sitelinks Searchbox) and `Organization` schema. `listings.html` — added `CollectionPage` schema referencing the parent WebSite. All blocks are static `<script type="application/ld+json">` tags in `<head>`.

### I-061 · `property.html` Leaflet `<script>` missing `defer`
- **Priority:** 🔵 LOW
- **Area:** Performance / `property.html`
- **Status:** ✅ RESOLVED
- **Fix:** Added `defer` to the Leaflet JS `<script>` tag on `property.html`. The map renders well below the fold — no reason to block initial paint of title, price, and photos.
