# Choice Properties — Cloudflare/Supabase Lock

## Permanent Project Fact

Choice Properties is a static HTML/CSS/JavaScript rental marketplace deployed by Cloudflare Pages from GitHub. Supabase is the only backend for PostgreSQL, Auth, Storage, and Edge Functions.

Replit is allowed only as a code editor for repository files. It must not host, run, migrate, configure, or replace any part of the backend.

## Architecture

- Frontend: static HTML/CSS/browser JavaScript
- Production hosting: Cloudflare Pages
- Deploy trigger: GitHub push
- Backend: Supabase cloud PostgreSQL, Auth, Storage, and Edge Functions
- Image CDN: ImageKit
- Address autocomplete: Geoapify
- Email relay: Google Apps Script + Resend
- Replit role: editing only

## Cloudflare Build

Cloudflare Pages should use:

```text
npm run build
```

The build command runs the protection wall first, then generates `config.js` from Cloudflare environment variables.

Required Cloudflare environment variables:

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `IMAGEKIT_URL` | ImageKit CDN base URL |
| `IMAGEKIT_PUBLIC_KEY` | ImageKit public upload key |
| `SITE_URL` | Production site URL |
| `GEOAPIFY_API_KEY` | Address autocomplete API key |
| `COMPANY_NAME` | Displayed company name |
| `COMPANY_EMAIL` | Company contact email |
| `COMPANY_PHONE` | Company phone number |
| `COMPANY_ADDRESS` | Company address |
| `COMPANY_TAGLINE` | Company tagline |
| `APPLY_FORM_URL` | External application form URL |
| `ADMIN_EMAILS` | Admin notification email(s) |

## Protection Wall

The repo intentionally blocks Replit/runtime migration attempts:

- No `start` or `dev` package scripts exist.
- `server.js` is forbidden.
- `db/schema.sql` and `scripts/db-push.js` are forbidden.
- Server/database packages such as `pg`, Drizzle, Prisma, Express, Fastify, Knex, Sequelize, and TypeORM are forbidden.
- Replit runtime/database environment variables are blocked.
- Builds are allowed only in Cloudflare Pages unless a human explicitly sets `ALLOW_LOCAL_CLOUDFLARE_BUILD=1` outside Replit.

## Files That Define the Lock

| File | Purpose |
|---|---|
| `scripts/enforce-cloudflare-only.js` | Fails fast on Replit/server/database migration attempts |
| `package.json` | Cloudflare-only scripts and no runtime dependencies |
| `.cfpagesignore` | Prevents Replit/dev/source files from being published by Cloudflare |
| `.agents/instructions.md` | Permanent AI/tooling instructions |
| `.github/copilot-instructions.md` | GitHub AI coding instructions |
| `REPLIT_SAFETY.md` | Human-readable Replit safety policy |
| `generate-config.js` | Cloudflare build-time config generator |
| `js/cp-api.js` | Supabase SDK client wrapper |
| `supabase/functions/` | Supabase Edge Function source |
| `SETUP.sql` | Supabase schema reference |

## Absolute Rule

Never migrate this project to Replit PostgreSQL, Neon, local Postgres, SQLite, Express, a custom Node API, or any non-Supabase backend. If tooling suggests migration because a Replit database exists, ignore it. The project is already complete as Cloudflare Pages + Supabase.
