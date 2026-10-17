# Brevo (Bravo) Transactional Email Integration

## Overview

Choice Properties uses **Brevo** (formerly Sendinblue) as the intended primary transactional email service. The current shared sender still falls back to Google Apps Script (GAS) when the Brevo key is missing or a Brevo API call fails. A successful standalone Brevo test does not prove that a deployed Supabase Edge Function is configured to use Brevo.

- **Free Tier Capacity**: 300 emails/day (plenty for inquiries, portal logins, and lease status notices).
- **Protocol**: Direct REST API v3 via HTTPS (`POST https://api.brevo.com/v3/smtp/email`).
- **Fallback**: `sendEmail()` falls back to GAS if Brevo is not configured or a Brevo send fails, when both GAS secrets are configured.

## Production Status

The project is configured with `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, and `BREVO_SENDER_NAME` as Supabase Edge Function secrets and environment variables, using the verified sender `choicepropertyofficial1@gmail.com`. Google Apps Script (GAS) remains configured as an automated fallback. Brevo credentials can be configured via Supabase Edge Function secrets or through the credentials configuration tools.

---

## Configuration & Environment Variables

| Variable | Required | Description | Example |
|---|---|---|---|
| `BREVO_API_KEY` | Yes | Brevo REST API v3 key (starts with `xkeysib-`) | `xkeysib-9393bd...qRY9` |
| `BREVO_SENDER_EMAIL` | Yes | Verified sender email in Brevo | `choicepropertyofficial1@gmail.com` |
| `BREVO_SENDER_NAME` | Optional | Outgoing sender display name (defaults to "Choice Properties") | `Choice Properties` |
| `GAS_EMAIL_URL` | Optional | Legacy Google Apps Script Web App URL (fallback) | `https://script.google.com/macros/s/.../exec` |
| `GAS_RELAY_SECRET` | Optional | HMAC-SHA256 signature secret for GAS relay | `...` |

Use a sender address on a domain you control, such as `notifications@choiceproperties.com`, after verifying the domain in Brevo and configuring its SPF and DKIM records. Keep a monitored `Reply-To` address. A consumer `@gmail.com` address is not an ideal production sender because you cannot align that domain's SPF/DKIM with your own Brevo account.

> ⚠️ **Important Key Distinction (`xkeysib-` vs `xsmtpsib-`)**:
> - **REST API Key (`xkeysib-...`)**: Located in Brevo &rarr; **SMTP & API** &rarr; **API Keys** tab. This is required for HTTPS edge dispatch.
> - **SMTP Key (`xsmtpsib-...`)**: Located under the **SMTP** tab. This is for direct SMTP socket connections to `smtp-relay.brevo.com:587`.

---

## How It Works in Code

### 1. Unified Sender (`supabase/functions/_shared/send-email.ts`)
All serverless edge functions route emails through `sendEmail()`:

```typescript
import { sendEmail } from '../_shared/send-email.ts';

await sendEmail({
  to: 'tenant@example.com',
  toName: 'John Doe',
  subject: 'Your Application Has Been Approved — 5914 Wilkes Dr',
  html: '<p>HTML body content...</p>',
  // Optional: built-in template rendering
  // template: 'inquiry_reply',
  // data: { ... }
});
```

### 2. Built-in Templates
The unified sender includes responsive, branded Choice Properties HTML templates:
- `inquiry_reply` — Bilingual (EN/ES) confirmation sent to prospective tenants submitting an inquiry.
- `new_inquiry` — Notification sent to landlords/admins with tenant contact details and message.
- `new_message_tenant` — Alert with direct dashboard reply button when leasing team messages a tenant.
- `new_message_landlord` — Alert with landlord portal link when tenant sends a message.
- `app_id_recovery` — Reference ID recovery sent to applicant.
- `raw_html` — Arbitrary custom HTML emails (used by magic link sign-in, payment receipts, etc.).

### 3. Edge Functions Using Brevo
- `receive-application` — application confirmation, admin notification, and landlord notification; logs the selected provider in `public.email_logs`.
- `send-email` — Status updates (approved, denied, waitlisted, lease signing reminders, move-in preps, payment confirmations).
- `send-inquiry` — Public listing inquiry forms (`cp-api.js Inquiries.submit()`).
- `send-message` — Two-way messaging between tenants and landlords.
- `send-magic-link` — Passwordless authentication into the Tenant Portal (`auth/callback.html`).
- `generate-rent-increase-letter` — Formal rent increase notifications.

---

## Verification & Testing

### Test CLI Script
You can test sending a real email through Brevo at any time:

```bash
# Using values already saved in .env.local
node scripts/test-brevo.mjs your-email@example.com

# Explicitly passing API key and sender email
node scripts/test-brevo.mjs your-email@example.com "xkeysib-..." "choicepropertyofficial1@gmail.com"
```

### Local Dev Server Test Endpoint
When running the development server (`npm run dev`), test via HTTP:

```bash
curl -s http://127.0.0.1:3000/api/test-brevo
```

### System Health Dashboard
Open `/health.html` in your browser. Under the **Email Health** card:
- Displays whether Brevo or GAS relay is currently delivering emails based on live rows in `public.email_logs`.
- Logs show status (`sent` or `failed`), provider (`brevo` or `gas`), recipient, and timestamp.

### Verify the Real Application Path

1. The Brevo runtime credentials can be configured directly in Supabase or in `.env.local`:

   ```bash
   supabase secrets set BREVO_API_KEY='YOUR_BREVO_REST_API_KEY' BREVO_SENDER_EMAIL='notifications@choiceproperties.com' BREVO_SENDER_NAME='Choice Properties' --project-ref tlfmwetmhthpyrytrcfo
   ```

2. Submit a test application using an address you control.
3. Check `public.email_logs` for the new `application_confirmation` row to confirm `status = 'sent'` and `provider = 'brevo'`.
4. Confirm the message appears in Brevo's transactional email logs.
5. If the app log still says `gas`, verify the configured secret name is exactly `BREVO_API_KEY` and that `receive-application` is deployed with the shared `send-email.ts` code.

---

## How to Update or Rotate Brevo Credentials

1. **In Brevo**:
   - Go to **SMTP & API** &rarr; **API Keys**.
   - Generate a new key and copy it.
2. **In Local / Staging (`.env.local`)**:
   ```env
   BREVO_API_KEY="xkeysib-new-key"
   BREVO_SENDER_EMAIL="choicepropertyofficial1@gmail.com"
   BREVO_SENDER_NAME="Choice Properties"
   ```
3. **In Supabase Edge Functions**:
   ```bash
   supabase secrets set BREVO_API_KEY="xkeysib-new-key" BREVO_SENDER_EMAIL="choicepropertyofficial1@gmail.com"
   ```
4. **Via Setup UI**:
   - Or use `/setup-credentials.html` to update the Brevo API key across shared configuration.
