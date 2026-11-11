# Dev Collaboration & Canonical Deployment (Non-Production)

This project is set up for normal AI/dev collaboration in a **non-production** environment with minimal manual permission friction.

## Canonical paths
- **Hosting/CDN**: Cloudflare Pages is the canonical deployment path (static site + `_redirects`/`_headers`). GitHub Pages is not used.
- **Backend/Data**: Supabase is the canonical backend (database, auth, storage, edge functions). Use a **dev Supabase project** for non-production work.
- **CI**: GitHub Actions workflows in `.github/workflows/` handle Cloudflare-only enforcement, Supabase deploys/migrations (when secrets are configured), and checks.

## Repo access (GitHub) — requires org/admin action
AI/dev workflows need these permissions on the GitHub repo (cannot be granted from code):
- **Read** access to repo contents, workflows, and issues/PRs as needed.
- **Write** access for dev branches/PRs (or use forks + PRs if preferred).
- **Actions**: ability to run workflows if CI validation is needed.
- **Secrets** (only for maintainers/CI): configure required secrets in GitHub repo/environment settings; do **not** commit secrets.

## Cloudflare Pages — canonical deployment
- Connect the GitHub repo to Cloudflare Pages (or use existing project).
- Build command: `npm run build` (or as configured in CF Pages).
- Output directory: `dist` (verify in CF Pages settings).
- Set environment variables in CF Pages for non-production/preview as needed (never commit).
- Remove/disable any legacy GitHub Pages site if it exists (done in GitHub repo settings).

## Supabase dev project — linking & access
1. Create or use a **separate dev Supabase project** (not production).
2. Link locally (developer machine/CI with credentials):
   ```bash
   npx supabase login
   npx supabase link --project-ref <DEV_PROJECT_REF>
   ```
3. Apply migrations/functions to dev via CI (`supabase-deploy.yml`) or locally:
   ```bash
   npx supabase db push
   npx supabase functions deploy
   ```
4. Use dev project URL/anon key in local `.env`/environment (never commit). Service role keys must remain server-side/secret.

## Local dev workflow (no unnecessary manual steps)
```bash
npm install
npm run dev   # or npm start (uses AIS_BUILD=true node serve.js as configured)
```
- Static assets, admin dashboard, extensions, and pipeline scripts live in this repo.
- Extension packages: `npm run bump-extension` / `npm run validate-extension` as needed.
- Pipeline (Python): see `scraper/README.md` and `AI_AGENT_GUIDE.md`; use dev credentials in environment.

## Admin dashboard, backend, pipeline accessibility
- **Admin dashboard**: static pages under `/admin/*` (served by Cloudflare Pages; auth/RLS enforced by Supabase).
- **Backend**: Supabase edge functions in `supabase/functions/` and DB in `supabase/migrations/`.
- **Pipeline**: `scraper/` (Python) and pipeline admin UI; stage/publish flows use Supabase RPCs with appropriate roles.
- For AI/dev automation, use **non-production** credentials and least-privilege roles; never hardcode or commit secrets.

## Security notes
- Do not commit `config.js` (generated at build time), `.env` secrets, or service role keys.
- `config.js` is gitignored except where intentionally committed for specific extension configs noted in `.gitignore`.
- RLS and `verify_jwt` settings in `supabase/config.toml` must be respected; `supabase-deploy.yml` deploys per-function.
