# Credentials Setup — Centralized Configuration

## Overview

This guide explains how project credentials and secrets are configured and shared across Choice Properties services, development workflows, and deployment tools.

**Credentials managed:**
- ✅ Supabase Project URL
- ✅ Supabase Anon Key
- ✅ Supabase Service Role Key
- ✅ Supabase API Token
- ✅ GitHub Personal Access Token
- ✅ Brevo API Key

## Seamless Collaboration Model

The repository is configured for frictionless developer onboarding:

- **Loading credentials:** The `credentials_config` table in Supabase allows any authenticated developer or pipeline process to run `npm run load-credentials` to instantly populate `.env.local` — no manual hunting, no friction.
- **Updating credentials:** Gated by the project write secret defined in `credentials-config.mjs` (repo root). Authorized team members can easily store or update shared credentials.
- **Continuous Integration:** Fork pull requests automatically validate and run test suites via GitHub Actions.

## First-Time Setup & Credential Updates

To store or update the shared credentials, use the setup utility:

### Step 1: Open the Setup Form

```bash
npm run setup-credentials
```

This starts a local helper server and opens `http://localhost:3000/setup-credentials.html` in your browser.

### Step 2: Enter Project Credentials

The setup utility accepts:
1. **Supabase Project URL** — Settings → API → Project URL
2. **Supabase Anon Key** — Settings → API → Anon public key
3. **Supabase Service Role Key** — Settings → API → Service role key
4. **Supabase API Token** — Settings → API → Personal Access Token
5. **GitHub Personal Access Token** — GitHub Developer Settings → Personal Access Tokens
6. **Brevo API Key** — Brevo Dashboard → SMTP & API → API Keys
7. **Write Secret** — Found in `credentials-config.mjs`

### Step 3: Submit

Click "Store Credentials Securely". The form transmits the credentials with the write secret to the `store-credentials` Edge Function, which writes to `credentials_config`.

### Step 4: Close the Form

Press `Ctrl+C` in your terminal to stop the setup server.

## Using Credentials After Setup

### For Any Developer or Tool

```bash
npm run load-credentials
```

This **automatically**:
1. Connects to Supabase using the project endpoint and anon key
2. Fetches stored credentials from `credentials_config`
3. Populates `.env.local` with all configuration values
4. Ready to run immediately

### Direct CLI Storage (Headless / CI)

```bash
SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_API_TOKEN=... GITHUB_API_TOKEN=... npm run setup-direct
```

## Architecture

```
Supabase Database
├── public.credentials_config
│   ├── SUPABASE_URL
│   ├── SUPABASE_ANON_KEY
│   ├── SUPABASE_SERVICE_ROLE_KEY
│   └── WRITE_SECRET
│
├── Edge Function: store-credentials
│   └── Validates WRITE_SECRET → updates credentials_config
│
└── RLS Policies
    ├── Select access
    └── Service_role write access
```

## Related Files

| File | Purpose |
|---|---|
| `credentials-config.mjs` | Central project configuration helper |
| `setup-credentials.html` | Credentials setup web interface |
| `scripts/open-setup.mjs` | Setup form local server |
| `scripts/setup-credentials.mjs` | Load credentials script |
| `setup-direct.mjs` | Direct CLI credential storage script |
| `supabase/functions/store-credentials/index.ts` | Backend storage endpoint |
| `CONTRIBUTING.md` | Developer onboarding guide |

## Troubleshooting

### `npm run load-credentials` fails
- Verify network connectivity to Supabase.
- Confirm `.env.local` is present in `.gitignore`.

### Store fails with 403
- Ensure the `write_secret` matches the current `WRITE_SECRET` in `credentials-config.mjs`.