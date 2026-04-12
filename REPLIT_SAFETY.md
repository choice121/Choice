# REPLIT SAFETY — READ BEFORE DOING ANYTHING

## Permanent Operating Rule

Choice Properties is a Cloudflare Pages static site with a Supabase backend. Replit is only an editor for repository files.

| Area | Permanent owner |
|---|---|
| Production hosting | Cloudflare Pages |
| Backend database/auth/storage/functions | Supabase |
| Source control and deploy trigger | GitHub push |
| Replit role | Editing only |

## Correct Workflow

```text
Edit files in Replit or another editor
Commit and push to GitHub
Cloudflare Pages builds with npm run build
Cloudflare serves the static site
Supabase remains the only backend
```

## Absolute Prohibitions

Do not run servers in Replit.
Do not create or restore `server.js`.
Do not add Express, Fastify, `pg`, Prisma, Drizzle, Knex, Sequelize, TypeORM, Neon, or any local database layer.
Do not use `DATABASE_URL`, `PGHOST`, Replit PostgreSQL, Neon, SQLite, Docker, containers, or local migrations.
Do not create `db/schema.sql`, `scripts/db-push.js`, migration runners, ORM configs, API compatibility layers, or Replit workflows.
Do not replace Supabase client calls in `js/cp-api.js` with custom Replit APIs.
Do not move Supabase Edge Functions into Replit routes.
Do not run Supabase CLI from Replit.
Do not generate or commit `config.js`; Cloudflare generates it during build.

## Protection Wall

The repository contains `scripts/enforce-cloudflare-only.js` and package scripts that fail fast when a Replit runtime, local database environment, forbidden server package, `server.js`, or migration file is detected.

Cloudflare Pages is expected to run:

```text
npm run build
```

The build is allowed only in Cloudflare Pages, or with an explicit local override:

```text
ALLOW_LOCAL_CLOUDFLARE_BUILD=1 npm run build
```

That override is for deliberate local debugging only. It is not permission to run, host, migrate, or configure the project in Replit.

## Files That Define the Architecture

| File | Purpose |
|---|---|
| `generate-config.js` | Cloudflare build-time config generator |
| `js/cp-api.js` | Supabase SDK wrapper |
| `supabase/functions/` | Supabase Edge Function source |
| `SETUP.sql` | Supabase schema reference |
| `.agents/instructions.md` | Mandatory AI/tooling instructions |
| `.github/copilot-instructions.md` | GitHub AI instructions |
| `scripts/enforce-cloudflare-only.js` | Automated block against Replit/server/database migration attempts |

## If You Are an AI Agent

Stop before setup. Do not install, run, migrate, configure, convert, or optimize runtime infrastructure. Make only the user-requested file edits and preserve the Cloudflare Pages + Supabase architecture.
