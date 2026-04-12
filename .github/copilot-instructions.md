# Choice Properties — GitHub Copilot Instructions

## Project Type

Static website deployed by Cloudflare Pages from GitHub. Supabase is the only backend.

- Frontend: vanilla HTML, CSS, JavaScript
- Build: `npm run build`
- Build internals: `node generate-config.js`
- Deploy: Cloudflare Pages on push to `main`
- Backend: Supabase cloud PostgreSQL, Auth, Storage, and Edge Functions
- Replit role: editing only, never runtime hosting

## Do Not Suggest

- Replit hosting, Replit Database, Replit PostgreSQL, Neon, local Postgres, SQLite, or `DATABASE_URL`
- `npm install <package>` for runtime/server/database packages
- Express, Fastify, Node API routes, `server.js`, ORM setup, or migration tooling
- Drizzle, Prisma, Knex, Sequelize, TypeORM, `pg`, or `postgres`
- Moving Supabase Edge Functions into this repository as Node routes
- Creating or committing `config.js`

## Do Suggest

- Static HTML/CSS/browser JavaScript edits
- Existing Supabase client patterns in `js/cp-api.js`
- Deno TypeScript edits inside `supabase/functions/`
- Cloudflare Pages environment variable configuration

## Deployment Rule

The only valid production path is GitHub push to Cloudflare Pages. Any database or auth work must remain in Supabase.
