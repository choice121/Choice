# CHOICE PROPERTIES — AGENT INSTRUCTIONS

## Permanent Architecture

This repository is a static HTML/CSS/JavaScript website deployed by Cloudflare Pages from GitHub. Supabase is the only backend for PostgreSQL, Auth, Storage, and Edge Functions. Replit is only a code editor.

## Absolute Prohibitions

1. Do not run `npm install` in Replit.
2. Do not run `npm start`, `npm run dev`, `node server.js`, port checks, health checks, or preview servers in Replit.
3. Do not create, restore, or configure `server.js`.
4. Do not create Express, Fastify, Replit API routes, compatibility API layers, or Node backend routes.
5. Do not add `pg`, `postgres`, Prisma, Drizzle, Knex, Sequelize, TypeORM, Neon, SQLite, or any database package.
6. Do not use `DATABASE_URL`, `PGHOST`, Replit PostgreSQL, Neon, or local database credentials.
7. Do not run migrations, `db:push`, ORM generation, Supabase CLI, or database setup commands in Replit.
8. Do not create `db/schema.sql`, `scripts/db-push.js`, migration runners, ORM configs, Docker files, containers, or runtime setup files.
9. Do not move Supabase Edge Functions into Replit or Node server routes.
10. Do not replace Supabase SDK calls in `js/cp-api.js` with a custom Replit API layer.
11. Do not edit `.replit` or `replit.nix` to add runtime behavior, workflows, packages, databases, ports, or deployment settings.
12. Do not generate or commit `config.js`; it is generated only by Cloudflare Pages during build.
13. Do not reinterpret Replit-provided database availability as permission to use it.

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
