# CHOICE PROPERTIES — AGENT INSTRUCTIONS

## Permanent Architecture

This repository is a static HTML/CSS/JavaScript website deployed **exclusively by Cloudflare Pages** from GitHub. Supabase is the only backend for PostgreSQL, Auth, Storage, and Edge Functions. No other hosting platform is used or permitted. Replit is fully removed from this project.

## Absolute Prohibitions

1. Do not introduce `.replit`, `replit.nix`, `replit.md`, or any Replit-specific file. Replit is fully removed from this project.
2. Do not create, restore, or commit `server.js` — there is no local server.
3. Do not run `npm install` — there are no runtime dependencies. The `preinstall` guard will block it.
4. Do not run `npm start`, `npm run dev`, port checks, health checks, or local preview servers.
5. Do not create Express, Fastify, or any Node.js backend routes or compatibility API layers.
6. Do not add `pg`, `postgres`, Prisma, Drizzle, Knex, Sequelize, TypeORM, Neon, SQLite, or any database package.
7. Do not use `DATABASE_URL`, `PGHOST`, or any local database credentials — the database is Supabase cloud.
8. Do not run migrations, `db:push`, ORM generation, Supabase CLI, or database setup commands locally.
9. Do not create `db/schema.sql`, migration runners, ORM configs, Docker files, or runtime setup files.
10. Do not move Supabase Edge Functions into local Node server routes.
11. Do not replace Supabase SDK calls in `js/cp-api.js` with any custom API layer.
12. Do not generate or commit `config.js` — it is generated only by Cloudflare Pages during build.

## Allowed Work

1. Edit static HTML files.
2. Edit CSS files.
3. Edit browser JavaScript files while preserving Supabase SDK usage.
4. Edit Supabase Edge Function source without running or deploying it from Replit.
5. Edit documentation and policy files.
6. Answer architecture questions.
7. Make user-requested repository changes that preserve Cloudflare Pages + Supabase only.

## Deployment Pipeline

```text
Repository edit
GitHub push
Cloudflare Pages runs npm run build
Cloudflare publishes static files
Supabase remains the only backend
```

## Enforcement

The package scripts call `scripts/enforce-cloudflare-only.js`. It blocks Replit runtime execution, local database variables, forbidden server/database packages, `server.js`, and migration files. If the guard fails, stop and undo the change that triggered it.

## External Application Form

Tenant applications are handled by the separate application system at `https://apply-choice-properties.pages.dev`. Do not reconnect legacy internal application pages to the user-facing flow. The integration point is `buildApplyURL(property)` in `js/cp-api.js`.
