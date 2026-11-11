# GAS Email Setup and Deliverability

## Current transport

Supabase Edge Functions send transactional mail through the Google Apps Script web app in `GAS-EMAIL-RELAY.gs`. Requests are HMAC-signed; Apps Script sends through the Google account that owns the deployment with `GmailApp`, then `MailApp` as a fallback.

Required Supabase Edge Function secrets:

- `GAS_EMAIL_URL`: deployed Apps Script Web App URL ending in `/exec`.
- `GAS_RELAY_SECRET`: same high-entropy value as the Apps Script `RELAY_SECRET` Script Property.

Deploy the script as a Web App that executes as the owner and accepts requests. After changing the script, deploy a new version and make sure the Web App deployment points to it. Keep `GAS_RELAY_SECRET` server-side; never put it in browser code or a public page.

Configure the two values in Supabase Edge Function Secrets. The active shared sender is GAS-only; do not restore Brevo keys through the credentials form. Historical `provider=brevo` rows in `email_logs` remain audit history, not evidence that the current code uses Brevo.

The deployed `store-credentials` function source is not currently tracked in this repository. The setup form no longer submits Brevo fields, but the deployed endpoint may still accept legacy Brevo payload fields until its source is brought under version control and redeployed. Those fields are not active sender configuration; the Brevo Edge Function secrets have been removed.

## Sender identity without a custom domain

`choice-properties-site.pages.dev` is a Cloudflare Pages hostname, not a domain Choice controls for email. You cannot publish SPF, DKIM, or DMARC records for it. Do not use an address such as `leasing@choice-properties-site.pages.dev` or claim that the Pages host is an authenticated sender domain.

Without a custom domain, the practical option is to send from the real Google account that owns the Apps Script deployment, with a consistent display name such as `Choice Properties`. Google's authentication applies to the actual Gmail sender, not the Pages subdomain. Keep replies on a monitored address at that same account. The relay only sets `Reply-To` when the sender and reply address share a domain.

This can work for low-volume, expected transactional messages, but offers less brand alignment and deliverability control than a verified domain you own. There is no `pages.dev` DNS workaround for that limitation.

## Why messages may land in spam

Common factors are weak sender-recipient history, a new or inconsistent sender, complaints, hard bounces, sudden volume spikes, duplicate retries, and message content that resembles bulk mail. Mismatched sender/Reply-To identities, excessive links, URL shorteners, misleading urgency, and an HTML body without a useful plain-text equivalent can also hurt placement. A `pages.dev` URL may be valid, but it does not authenticate the Gmail sender or prove that Choice owns the email domain.

GAS is a transport, not an inbox-placement guarantee. Apps Script and Gmail quotas vary by account and can change; check the current quota for the account that owns the deployment. Quota exhaustion or Google abuse controls can delay or block delivery.

## Recommended practices while staying on GAS

1. Use one dedicated, established Google account for the relay. Keep its recovery and two-step verification current; send from its real address.
2. Limit this sender to transactional mail recipients expect after an application, inquiry, payment, or account event. Do not use it for cold outreach or bulk marketing.
3. Keep volume steady and within current Apps Script recipient limits. Use bounded retries with backoff for transient failures, and do not retry permanent bounces or invalid addresses.
4. Validate recipients, suppress repeated hard bounces, honor opt-outs where applicable, and deduplicate application-triggered messages.
5. Keep subjects factual and specific; use concise copy, a useful plain-text alternative, and only necessary links. Avoid shorteners and false urgency.
6. Use consistent Choice pages and avoid unrelated tracking domains. Never put share tokens or other bearer values in query strings, subjects, or logs.
7. Test controlled messages to Gmail, Outlook, and Yahoo. Record inbox versus spam placement, inspect Apps Script execution history, and compare results with `email_logs`.
8. Treat HTTP success from the relay as acceptance by Apps Script, not proof of inbox delivery. Check delivery/bounce signals separately where available.

Without a domain you control, custom SPF/DKIM/DMARC alignment for a Choice-owned sender and Google Postmaster Tools for that domain are unavailable. If branded inbox placement becomes a business requirement, acquire a domain and authenticate it; there is no reliable Pages-subdomain substitute.

## Verification checklist

- Confirm `GAS_EMAIL_URL` and `GAS_RELAY_SECRET` are configured in Supabase Edge Function Secrets without exposing values.
- Confirm Apps Script Script Property `RELAY_SECRET` matches the Supabase value.
- Deploy the Apps Script version and check its execution history.
- Send a controlled test transaction to an address you own; do not create a test application with someone else's data.
- Confirm the new `email_logs` row says `provider=gas`, `status=sent`; check the recipient inbox and spam folder separately.
- Review recent failures and Google quota before raising sending volume.
