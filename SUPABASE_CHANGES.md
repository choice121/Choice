# Supabase Changes Log

All Supabase-side changes performed directly via the Management API or CLI are documented here.
This file lives in the GitHub repo per project policy.

---

## 2026-04-19 — 11-Issue Code Scan Fixes

### Edge Functions Deployed
- **receive-application** — redeployed with three code fixes:
  - Fix #1: Now imports `sendEmail` from `_shared/send-email.ts` (triple-provider fallback: Resend → GAS relay → Gmail). Previously used the basic single-provider version.
  - Fix #2: SSN is now masked to `XXX-XX-XXXX` before database storage. No plaintext SSNs stored.
  - Fix #3: Applicant email is normalized to lowercase before being stored. Fixes case mismatch with tenant portal login lookup.

### Auth Accounts Configured
- **Tenant test account**: `choiceproperties404@gmail.com` — confirmed, password set to `TempQA!Pass2026`
- **Admin account**: `aerinmoran3@gmail.com` — confirmed, password set to `TempQA!Pass2026`, `admin_roles` row already existed

### Test Application Submitted
- Application **CP-20260419-WMDINY155** submitted via `receive-application` Edge Function (not created manually)
- Tenant: Marcus Thompson
- Property: 2746 Indigo Hills Ct, Jacksonville, FL 32221 (PROP-AJEH3KTF)
- Email stored as: `choiceproperties404@gmail.com` (lowercase)
- Status: pending

---

## GitHub Actions — Auto-Deploy Setup

A `.github/workflows/supabase-deploy.yml` workflow was added.
It automatically deploys all Edge Functions to Supabase when any file inside `supabase/functions/` changes on the `main` branch.

**Required GitHub Actions secrets** (set under Settings → Secrets → Actions):
| Secret Name | Value |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Your Supabase Personal Access Token (sbp_...) |
| `SUPABASE_PROJECT_REF` | `tlfmwetmhthpyrytrcfo` |

> Note: `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` are NOT yet set as GitHub secrets.
> Add them in the GitHub repo Settings → Secrets → Actions so future pushes auto-deploy functions.
> All other secrets (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY) are already configured.

---

## Schema Notes

- `management_cosigned`, `management_cosigned_by`, `management_cosigned_at` columns **confirmed to exist** in the `applications` table.
  - Issue #5 (scan) was a false alarm — both `management_signed` and `management_cosigned` column sets are intentional and present in production.
- `admin_actions` table confirmed to exist and accept `tenant_withdraw` action type from tenant portal.
