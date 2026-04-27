# Choice Properties — Replit workspace notes

## What this repository is

Choice Properties is a static frontend (HTML / CSS / JS) for a nationwide
rental property marketplace. All backend logic lives in **Supabase Edge
Functions** and **Supabase Postgres**; email is relayed via a Google Apps
Script; photos are on **ImageKit.io**; address autocomplete is **Geoapify**.

The original repo was authored to deploy exclusively to **Cloudflare Pages**.
This Replit workspace runs the same static site locally for development and
preview using a tiny Node.js static file server (`serve.js`).

## Replit setup

- **Workflow**: `Start application` runs `node serve.js` and serves the site
  on `0.0.0.0:5000` (the only port the Replit webview proxies).
- **Server**: `serve.js` is a zero-dependency Node static file server. It
  resolves `/` to `/index.html`, supports clean URLs by appending `.html`,
  and falls back to `404.html`.
- **Deployment**: Configured as a **static** Replit deployment with
  `publicDir = "."` — Replit serves the repo's static files directly with
  TLS and a `.replit.app` URL (or custom domain). No build step is needed.
- **Backend**: Supabase remains the only backend. Nothing in Replit talks
  to Supabase server-side; the browser calls Supabase Edge Functions
  directly using anon keys baked into the page.

## Notes about the original Cloudflare-only enforcement

`scripts/enforce-cloudflare-only.js` is wired as the npm `preinstall` hook
and will fail loudly inside Replit. We don't run `npm install` here because
there are zero npm dependencies — `serve.js` uses only Node built-ins. If
you ever need to add a dependency, you'll need to bypass that script
(`npm install --ignore-scripts`) or remove the hook.

## Architecture references

- `ARCHITECTURE.md` — full system architecture
- `.agents/AI_RULES.md` — original agent rules (written for the
  Cloudflare-only deployment context)
- `supabase/functions/` — edge function source
- `supabase/migrations/` — database migrations

## Required runtime configuration

The frontend reads its Supabase project URL and anon key from values
embedded by `generate-config.js` at Cloudflare build time. In Replit dev
the static files include whatever was last committed; if you need to point
at a different Supabase project locally, regenerate the config or edit
`js/cp-api.js` directly.
