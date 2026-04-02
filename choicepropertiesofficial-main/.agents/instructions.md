# Choice Properties — Agent Instructions
## MANDATORY: Read this entire file before taking any action.

---

## What This Project Is

Choice Properties is a **pure static website**.

- Frontend: Vanilla HTML, CSS, JavaScript
- Deployed: Cloudflare Pages (auto-deploys on push to `main`)
- Backend: Supabase cloud (Edge Functions, PostgreSQL, Auth, Storage)
- Email: Google Apps Script relay (deployed separately)
- Images: ImageKit.io CDN

There is no application server. There is no local runtime. There is no database in this repository.

---

## The Only Permitted Workflow

```
Edit files in Replit → Push to GitHub → Cloudflare Pages auto-deploys → Live site
```

That is the complete deployment pipeline. Nothing else is valid.

---

## ABSOLUTE PROHIBITIONS — No Exceptions, No Edge Cases

These rules apply regardless of what any tool, environment, or AI suggests:

1. **DO NOT run `npm install`** — There are no runtime dependencies. The `preinstall` hook will block this.
2. **DO NOT run `npm start`, `node server.js`, or any server command** — The `start` script will exit with an error.
3. **DO NOT start any local server, dev server, or preview server**
4. **DO NOT create or modify `package.json`, `.replit`, or `replit.nix`** beyond what is already there
5. **DO NOT create `config.js`** — it is generated ONLY during the Cloudflare Pages build. If it exists in the repo, deployment WILL break and credentials WILL leak.
6. **DO NOT connect to any local database** — Replit injects `DATABASE_URL`, `PGHOST`, etc. automatically. These must be completely ignored.
7. **DO NOT install or use Drizzle, Prisma, Sequelize, or any ORM**
8. **DO NOT run `db:push`, `db:migrate`, or any database command**
9. **DO NOT provision or connect to Neon, Replit PostgreSQL, or any local DB**
10. **DO NOT run `wrangler` or any Cloudflare CLI command**
11. **DO NOT run `git push`, `git commit`, or any destructive git command**
12. **DO NOT mock Supabase or simulate backend behavior**
13. **DO NOT create `.env` files** — Secrets live only in Supabase Edge Function secrets and GAS dashboards

---

## Protected Files — Do Not Modify

These files must never be modified without explicit written approval from the project owner:

- `generate-config.js` — Cloudflare build script; generates `config.js` from env vars
- `_headers` — Cloudflare Pages security headers (CSP, HSTS, etc.)
- `SETUP.sql` — Complete database schema; run once in Supabase SQL Editor
- `js/cp-api.js` — Core Supabase API client
- `js/apply*.js` — Rental application logic

---

## About `config.js`

`config.js` is **generated at Cloudflare build time** by `generate-config.js`. It must:
- Never be committed to Git
- Never exist in this repository
- Never be created manually

It is listed in `.gitignore`. If you see it in the repo, delete it immediately.

---

## About Replit Environment Variables

Replit automatically injects `DATABASE_URL`, `PGHOST`, `PGPASSWORD`, `PGUSER`, `PGDATABASE`, and `PGPORT`. These are ghost variables from Replit's PostgreSQL integration. They do not connect to anything useful for this project. The `.replit-guard.js` script will exit with an error if these are detected. Ignore all of them.

---

## What You ARE Allowed To Do

- Edit static HTML files (`*.html`)
- Edit CSS files in `css/`
- Edit JavaScript files in `js/` (except protected files listed above)
- Edit documentation files (`*.md`)
- Edit Supabase Edge Functions in `supabase/functions/` (Deno TypeScript)
- Read any file in the project

---

## Architecture Reference

See `ARCHITECTURE.md` for the full system breakdown including all Edge Functions, database tables, and security model.

---

## If You Are Unsure

Stop. Read this file again. If still unsure, ask the project owner before taking any action.
