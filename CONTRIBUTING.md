# Contributing to Choice Properties

Welcome! Contributions are welcome, but access to project infrastructure and credentials is restricted to authorized maintainers.

## Secure Setup

1. Copy `.env.example` to an ignored local `.env.local` file and fill only the values needed for your task.
2. Never commit, log, or share service-role keys, API tokens, passwords, or private API keys. The old shared credential table and browser setup flow are retired.
3. Use a Supabase service-role key only in trusted backend/operator environments; browser code must use the anon/publishable key with RLS.
4. Treat credentials found in repository history as compromised and rotate them with their provider. See [credential rotation guidance](docs/CREDENTIALS_SETUP.md).

## Getting Started

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/Choice
cd Choice

# Install dependencies
npm install

# Build the static site
npm run build
```

## Quick Commands

| Command | What it does |
|---|---|
| `npm run build` | Builds the site (generates config) |
| `npm run dev` | Starts local dev server |

## Auto-Merge of Fork PRs

To let fork PRs auto-merge into main, the **repo owner** must:
1. Go to Settings → Secrets and variables → Actions.
2. Add a repository secret `AUTO_MERGE_ENABLED` = `true`.

Once enabled, any PR from a fork (that doesn't touch protected paths like `supabase/migrations/`, `apply/`) will auto-merge via squash after CI passes.

## File Layout Overview

| Path | Purpose |
|---|---|
| `credentials-config.js` | Shared public config + write secret (committed) |
| `scraper/` | Python scraping pipeline (main tool) |
| `supabase/functions/` | Edge Functions |
| `supabase/migrations/` | Database migrations |
| `chrome-extension/` | Browser extension |
| `admin/` | Admin panel HTML |
| `docs/` | Documentation |

## Need Help?

Read `docs/CREDENTIALS_SETUP.md` for the full credential setup guide, or `docs/AI_COMMANDS.md` for AI-assistable pipeline commands.

Happy building!