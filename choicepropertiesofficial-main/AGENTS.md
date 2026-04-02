# Choice Properties — Agent Instructions
# Recognized by: OpenAI Codex, ChatGPT Code Interpreter, and agent frameworks that scan for AGENTS.md
# Full rule set: .agents/instructions.md

## STOP — Read Before Taking Any Action

This is a STATIC WEBSITE deployed via Cloudflare Pages. It is NOT a Node.js app, Python app, or any server-based application.

## Absolute Prohibitions

- DO NOT run `npm install` — there are no runtime dependencies
- DO NOT run `npm start` or start any server
- DO NOT create `config.js` — generated at Cloudflare build time only; committing it leaks secrets and breaks deployment
- DO NOT use DATABASE_URL, PGHOST, or any Postgres variable — Replit injects these automatically; they must be ignored
- DO NOT install any ORM (Drizzle, Prisma, Sequelize, etc.)
- DO NOT run any database migration command
- DO NOT modify protected files: generate-config.js, _headers, SETUP.sql, js/cp-api.js, js/apply*.js

## Only Permitted Actions

- Edit static HTML, CSS, and frontend JS files
- Edit Supabase Edge Functions in supabase/functions/ (Deno TypeScript)

## The Only Valid Deployment Path

```
Edit in Replit → Push to GitHub → Cloudflare Pages auto-deploys
```

Full instructions: .agents/instructions.md
