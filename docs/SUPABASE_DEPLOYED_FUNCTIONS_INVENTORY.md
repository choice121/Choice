# Choice Properties — Supabase Deployed Edge Functions Inventory

> **Supabase Project:** `tlfmwetmhthpyrytrcfo` (`us-east-1`)  
> **Total Deployed Edge Functions:** `60` (`27` git-tracked in `supabase/functions/` + `33` live-deployed via CLI/Studio)  
> **Updated:** `2026-11-21` (Phase 3 Registry Synchronization)

---

## 1. Deployment & `verify_jwt` Policy

1. `.github/workflows/supabase-deploy.yml` parses (`deno cache --no-check`) and deploys every directory inside `supabase/functions/*/` individually whenever changes touch `supabase/functions/**`, `supabase/migrations/**`, `supabase/config.toml`, or the workflow itself.
2. Because `.github/workflows/supabase-deploy.yml` deploys individually, **`supabase/config.toml` explicitly specifies `verify_jwt = true | false` for all 27 git-tracked Edge Functions**, preventing any unlisted function from defaulting unexpectedly to `verify_jwt = true`.
3. Live-only functions not stored inside `supabase/functions/` remain undisturbed and active in Supabase during git-triggered CI deployments.
4. `confirm-card-payment` remains intentionally omitted from `supabase/functions/` (verified by `scripts/test-manual-payment-workflow.mjs`).

---

## 2. Git-Tracked Edge Functions (`27` — Declared in `supabase/config.toml`)

| Function Slug | Live Version | `verify_jwt` (`config.toml` & Live) | Primary Role |
|---|---:|:---:|---|
| `check-unsigned-leases` | v10 | `false` | Lease signing reminder / check job |
| `cleanup-expired-drafts` | v38 | `false` | Expired application draft cleanup |
| `confirm-co-applicant-screening` | v18 | `false` | Co-applicant consent & screening confirmation |
| `countersign` | v134 | `true` | Admin/landlord lease countersignature |
| `download-payment-receipt` | v17 | `false` | Receipt HTML/PDF retrieval |
| `generate-lease` | v137 | `true` | Lease generation & signing link creation |
| `get-lease` | v98 | `false` | Tenant/co-applicant lease fetch via signing token |
| `get-tenant-portal-app` | v20 | `false` | Tenant portal application & summary loader |
| `import-from-url` | v95 | `false` | Admin single-URL listing importer (`admin/pipeline.html`) |
| `issue-payment-receipt` | v17 | `false` | Manual payment receipt issuer |
| `nudge-expiring-drafts` | v48 | `false` | Draft reminder mailer |
| `pipeline-recovery` | v9 | `false` | Stage 1/2 24h recovery archive listing & restore (`admin/pipeline.html`) |
| `private-placement-registry` | v1 | `false` | Permanent Private-Placement Registry batch lookup & audited expired-link replacement |
| `property-location` | v27 | `false` | Cached Geoapify nearby places & neighborhood lookup (`js/property.js`) |
| `property-share` | v48 | `false` | Private-placement share link creation, token resolution & list |
| `purge-expired-pipeline-recovery` | v8 | `false` | Stage 2 permanent deletion of >24h recovery rows + raw storage blobs (hourly GitHub Actions cron) |
| `receive-application` | v158 | `false` | Tenant rental application intake (`apply/`) |
| `receive-pipeline-import` | v120 | `false` | Manual Chrome/Orion extension intake (`save`, `list_folders`, `create_folder`, `check_listing`) |
| `request-upload-url` | v82 | `false` | Signed upload URL generator for applicant/inspection media |
| `resend-signing-link` | v96 | `true` | Resend tenant/co-applicant lease signing invite |
| `reveal-applicant-ssn` | v5 | `true` | Admin audited SSN reveal (`admin/applications.html`) |
| `save-draft` | v94 | `false` | Application draft persistence (`apply/`) |
| `send-co-applicant-consent` | v19 | `false` | Dispatch co-applicant screening invite |
| `send-email` | v132 | `true` | Central email relay wrapper (`GAS_EMAIL_URL`) |
| `send-message` | v96 | `false` | Admin/tenant/landlord messaging endpoint |
| `sign-lease` | v141 | `false` | Primary tenant lease e-signature |
| `sign-lease-co-applicant` | v118 | `false` | Co-applicant lease e-signature |

---

## 3. Live-Only Deployed Edge Functions (`33` — Managed Externally / Active Runtime)

| Function Slug | Live Version | `verify_jwt` | Active Caller(s) / Status |
|---|---:|:---:|---|
| `backfill-pdf-integrity` | v68 | `true` | Maintenance/admin backfill utility |
| `check-renewals` | v93 | `false` | Lease renewal checker |
| `confirm-card-payment` | v2 | `true` | Retired card payment endpoint (intentionally excluded from `supabase/functions/` per `test-manual-payment-workflow.mjs`) |
| `create-amendment` | v104 | `true` | `js/admin/lease-detail.js` |
| `download-lease` | v76 | `true` | `js/admin/leases.js`, `js/tenant/portal.js` |
| `extension-diagnostics` | v10 | `false` | Extension diagnostics helper |
| `extract-listing-ai` | v9 | `false` | AI extraction helper |
| `generate-deposit-letter` | v77 | `true` | `js/admin/deposit-accounting.js` |
| `generate-renewal` | v64 | `true` | `js/admin/lease-detail.js` |
| `generate-rent-increase-letter` | v87 | `true` | `js/admin/lease-detail.js` |
| `generate-termination-notice` | v87 | `true` | `js/admin/lease-detail.js` |
| `get-amendment` | v71 | `false` | `js/tenant/lease-sign.js` |
| `imagekit-delete` | v84 | `false` | `js/admin/property-detail.js` (archive photo cleanup) |
| `imagekit-upload` | v81 | `false` | `health.html`, ImageKit upload workflow |
| `imagekit-watermark` | v34 | `true` | `js/admin/property-detail.js` |
| `import-pipeline-photos` | v65 | `false` | `chrome-extension/background.js`, `.pages-orion/background.js` |
| `pipeline-media` | v2 | `false` | Pipeline media helper |
| `pipeline-photo-upload` | v16 | `false` | `chrome-extension/content.js` |
| `property-hierarchy` | v3 | `false` | Property hierarchy helper |
| `property-media` | v16 | `false` | Property media helper |
| `property-units` | v6 | `false` | Multi-unit property helper |
| `proxy-image` | v35 | `false` | `js/admin/pipeline.js` |
| `record-esign-consent` | v67 | `false` | `js/tenant/lease-sign.js` |
| `record-inspection` | v65 | `true` | `js/admin/inspections.js`, `js/landlord/inspection-review.js` |
| `revoke-signing-token` | v60 | `true` | `js/admin/lease-detail.js` |
| `run-migration` | v15 | `true` | One-off migration runner |
| `send-inquiry` | v103 | `false` | Public inquiry form & `health.html` |
| `send-magic-link` | v82 | `false` | `js/tenant/login.js` |
| `sign-amendment` | v107 | `true` | `js/tenant/lease-sign.js` |
| `store-credentials` | v18 | `false` | `credentials-config.mjs` setup tool |
| `submit-deposit-dispute` | v81 | `true` | `js/tenant/deposit.js` |
| `verify-lease` | v71 | `false` | `js/verify-lease.js` |
| `zillow-gallery-reference` | v4 | `false` | Zillow gallery reference helper |
