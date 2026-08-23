# Base44 Dev Environment

## What this is
Choice Properties — a static rental marketplace site (Cloudflare Pages in prod) plus a Python scraper pipeline. The preview serves the static site only.

## Running the site
- `docker compose -f docker-compose.base44.yml up -d` — serves the static site on port 3000.
- The server is `serve.js`: a zero-dependency Node static file server (built-in `http`/`fs`/`path` only). No `npm install` or build step needed to view the site.
- Binds `0.0.0.0:3000`, serves files from the repo root, falls back to `404.html`.
- Live edits to HTML/CSS/JS appear on browser refresh (no file watcher / HMR — call `reload_preview` after edits if you want the iframe to refresh automatically).

## What is NOT in the preview
- The Python scraper (`scraper/`) needs `scraper/.env` (Supabase + ImageKit + Google credentials) to run scraping jobs. It is not part of the served site and is not wired into compose.
- Cloudflare Pages functions (`functions/`) and Supabase edge functions are not run locally; the site calls the live Cloudflare/Supabase endpoints.

## No external secrets required to boot
The static site needs no credentials to display. Scraper credentials are out of scope for the preview.
