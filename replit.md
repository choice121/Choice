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

## Environment Variables

Set in Replit's environment (already configured):

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key (public) |
| `IMAGEKIT_URL` | ImageKit CDN base URL |
| `IMAGEKIT_PUBLIC_KEY` | ImageKit public upload key |
| `GEOAPIFY_API_KEY` | Address autocomplete API key |
| `COMPANY_NAME` | Displayed company name |
| `COMPANY_EMAIL` | Company contact email |
| `COMPANY_PHONE` | Company phone number |
| `COMPANY_ADDRESS` | Company address |
| `SITE_URL` | Canonical site URL |
| `APPLY_FORM_URL` | External apply form base URL (e.g. `https://apply-choice-properties.pages.dev`). Apply Now buttons redirect here with property data as URL params. All applications are handled by this external system. |
| `PORT` | Server port (default: 5000) |

## Key Files

| File | Purpose |
|---|---|
| `server.js` | Node.js static file server (Replit entry point) |
| `generate-config.js` | Cloudflare Pages build script (not used on Replit) |
| `js/cp-api.js` | Shared API client — wraps Supabase calls |
| `supabase/functions/` | Supabase Edge Functions (deployed via Supabase CLI) |
| `SETUP.sql` | Database schema (applied in Supabase dashboard) |
| `webfonts/` | Font Awesome webfont files |

## Application System

All rental applications are handled by the **external application system** at `https://apply-choice-properties.pages.dev` (Google Apps Script / Google Sheets backend). "Apply Now" buttons across the site redirect there with property details pre-filled as URL params.

The internal application form (`apply.html`, `apply/` pages, apply JS files) has been retired and removed. Redirects in `_redirects` send any old bookmarks or email links to the external form automatically.

## Supabase Edge Functions

The backend logic lives in `supabase/functions/`. These are deployed to Supabase directly (not run on Replit). They handle:
- `generate-lease` — lease generation
- `sign-lease` — tenant e-signatures
- `update-status` — application status updates
- `send-message` / `send-inquiry` — messaging
- `imagekit-upload` / `imagekit-delete` — photo management
- `mark-paid` / `mark-movein` — move-in tracking
- `get-application-status` — public status lookup

## Site Pages

- `/` — Homepage with property search
- `/listings.html` — Browse available properties
- `/property.html?id=...` — Individual property page
- `/admin/` — Admin portal (login-protected)
- `/landlord/` — Landlord portal (login-protected)
