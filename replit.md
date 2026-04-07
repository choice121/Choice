# Choice Properties — Replit Setup

## Overview

Choice Properties is a nationwide rental marketplace — a static HTML/CSS/JS site with a Supabase cloud backend.

## Architecture

- **Frontend**: Static HTML/CSS/JS site (no frontend framework/bundler)
- **Backend**: Supabase cloud (PostgreSQL + Auth + Storage + Edge Functions)
- **Image CDN**: ImageKit
- **Address autocomplete**: Geoapify
- **Email relay**: GAS (Google Apps Script) + Resend

## How It Runs on Replit

A lightweight Node.js server (`server.js`) serves the static files and dynamically generates `config.js` from environment variables. No npm packages are required — only built-in Node.js modules are used.

```
node server.js   → listens on port 5000
```

The server:
1. Generates `/config.js` on every request from environment variables
2. Serves all static files (HTML, CSS, JS, images, fonts) from the project root
3. Handles directory index resolution and `.html` extension inference
4. Redirects browser-auto-requested icons (`/favicon.ico`, `/apple-touch-icon.png`) to `/assets/favicon.svg`

## Environment Variables

All non-sensitive configuration is stored as Replit environment variables (shared). The Supabase anon key is stored as a Replit secret.

| Variable | Purpose | Storage |
|---|---|---|
| `SUPABASE_URL` | Supabase project URL | Env var |
| `SUPABASE_ANON_KEY` | Supabase anonymous key (public JWT) | Replit Secret |
| `IMAGEKIT_URL` | ImageKit CDN base URL | Env var |
| `IMAGEKIT_PUBLIC_KEY` | ImageKit public upload key | Env var |
| `GEOAPIFY_API_KEY` | Address autocomplete API key | Env var |
| `COMPANY_NAME` | Displayed company name | Env var |
| `COMPANY_EMAIL` | Company contact email | Env var |
| `COMPANY_PHONE` | Company phone number | Env var |
| `COMPANY_ADDRESS` | Company address | Env var |
| `COMPANY_TAGLINE` | Company tagline | Env var |
| `SITE_URL` | Canonical site URL | Env var |
| `APPLY_FORM_URL` | External apply form base URL | Env var |
| `ADMIN_EMAILS` | Admin notification email(s) | Env var |
| `PORT` | Server port (default: 5000) | Env var |

## Key Files

| File | Purpose |
|---|---|
| `server.js` | Node.js static file server (Replit entry point) |
| `generate-config.js` | Cloudflare Pages build script (not used on Replit) |
| `js/cp-api.js` | Shared API client — wraps Supabase calls |
| `supabase/functions/` | Supabase Edge Functions (deployed via Supabase CLI, not run on Replit) |
| `SETUP.sql` | Database schema (applied in Supabase dashboard) |
| `webfonts/` | Font Awesome webfont files |

## Site Pages

- `/` — Homepage with property search
- `/listings.html` — Browse available properties
- `/property.html?id=...` — Individual property page
- `/admin/login.html` — Admin portal login
- `/admin/dashboard.html` — Admin dashboard (login-protected)
- `/landlord/login.html` — Landlord portal login
- `/landlord/dashboard.html` — Landlord dashboard (login-protected)

## Supabase Edge Functions

The backend logic lives in `supabase/functions/`. These are deployed to Supabase directly (not run on Replit). They handle:
- `generate-lease` — lease generation
- `sign-lease` — tenant e-signatures
- `update-status` — application status updates
- `send-message` / `send-inquiry` — messaging
- `imagekit-upload` / `imagekit-delete` — photo management
- `mark-paid` / `mark-movein` — move-in tracking
- `get-application-status` — public status lookup
- `process-application` — rental application submission

## Application System

All rental applications are handled by the **external application system** at `https://apply-choice-properties.pages.dev`. "Apply Now" buttons redirect there with property details pre-filled as URL params.
