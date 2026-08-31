# Choice Properties Project Guide

Choice Properties is a static rental marketplace deployed to Cloudflare Pages.
Supabase is the only backend and system of record. The repository does not use
Replit hosting, a local database, or a Node API server in production.

## Main components

- Root HTML, CSS, and browser JavaScript: the production website.
- `supabase/functions/`: Deno Edge Functions for authenticated or privileged operations.
- `scraper/`: Python ingestion, enrichment, validation, and publishing pipeline.
- `admin/`: administrative pages for review and operations.
- `chrome-extension/` and `.pages-orion/`: manual listing-import clients.
- `frontend/`: an experimental React migration shell; it is not the production entry point.

## Local setup

Use Node.js 18 or newer. Install the root dependencies with the package manager
already used by the project, then provide the build variables in your shell:

```powershell
$env:SUPABASE_URL = "https://tlfmwetmhthpyrytrcfo.supabase.co"
$env:SUPABASE_ANON_KEY = "<Supabase anon/public key>"
$env:IMAGEKIT_URL = "<ImageKit URL>"
$env:IMAGEKIT_PUBLIC_KEY = "<ImageKit public key>"
$env:SITE_URL = "https://choice-properties-site.pages.dev"
$env:GEOAPIFY_API_KEY = "<optional Geoapify key>"
npm run build
```

Required website build variables are `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`IMAGEKIT_URL`, `IMAGEKIT_PUBLIC_KEY`, and `SITE_URL`. `GEOAPIFY_API_KEY` is
optional and only enables address autocomplete.

The build generates ignored `config.js` files and copies the static site into
`dist/`. Never commit generated config files or any private key.

For local preview after a build:

```powershell
npm run dev
```

The server listens on port 3000 and serves the generated site. The production
site does not use this server.

## Deployment

Push `main` to GitHub. Cloudflare Pages builds from the repository using:

```text
Build command: npm run build
Output directory: dist
Node version: 20
```

Configure the website variables in Cloudflare Pages project settings. Configure
the same public build variables as GitHub Actions repository secrets if CI build
validation is enabled. Scraper-only secrets must never be added to the frontend
build environment.

Supabase Edge Functions are deployed separately through the Supabase CLI or the
Supabase dashboard. Cloudflare Pages deployment does not deploy Edge Functions.

## Security boundaries

- Frontend code may use only the Supabase anon/public key.
- `SUPABASE_SERVICE_ROLE_KEY`, `IMAGEKIT_PRIVATE_KEY`, and AI provider keys are
  server-side or scraper secrets only.
- Do not alter the private `pipeline` schema.
- Do not restore removed `photo_urls` or `photo_file_ids` columns.
- Do not add Express, database drivers, ORM packages, or Node API routes.

## Validation checklist

```powershell
npm run build
npm run lint
git status --short
```

Then verify the deployed home page, listings, property detail page, application
flow, admin login, Edge Functions, and ImageKit photos. Run scraper dry-runs
before any live publishing job.
