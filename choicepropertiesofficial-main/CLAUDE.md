# Choice Properties — Claude Instructions
# Recognized by: Claude Projects, Claude.ai, and Anthropic's Claude API tool use
# Full rule set: .agents/instructions.md

## Read This Before Any Action

This is a **pure static website**. It has no server, no local database, and no runtime dependencies.

**Deployment pipeline:** Replit (edit only) → GitHub → Cloudflare Pages → Live site

## Non-Negotiable Rules

| Rule | Reason |
|---|---|
| DO NOT run `npm install` | No runtime packages exist or are needed |
| DO NOT start any server | There is no server to run |
| DO NOT create `config.js` | Generated at Cloudflare build time; committing it breaks deployment |
| DO NOT use `DATABASE_URL` or any `PG*` variable | Replit ghost variables; completely irrelevant to this project |
| DO NOT install any ORM | Backend is Supabase cloud, not a local database |
| DO NOT modify `generate-config.js`, `_headers`, `SETUP.sql`, `js/cp-api.js`, `js/apply*.js` | Protected files |

## What You Can Do

- Edit `.html`, `.css`, and `.js` files in the frontend
- Edit Supabase Edge Functions in `supabase/functions/` (Deno TypeScript)
- Read any file in the project

## Architecture

All server-side logic runs on Supabase's cloud (Edge Functions + PostgreSQL). The frontend is vanilla JS with no build framework. `config.js` is generated at deploy time from environment variables set in the Cloudflare Pages dashboard.

Full details: `.agents/instructions.md` and `ARCHITECTURE.md`
