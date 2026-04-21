# Choice Properties

Nationwide rental marketplace. **Deployed exclusively to Cloudflare Pages.**
This Replit workspace is used **only for editing code** — no Replit workflow,
no local dev server, no deployment from here. The build/deploy pipeline lives
in `deploy.sh` / `.github/workflows/` and targets Cloudflare.

## Stack

- **Frontend**: static HTML + vanilla JS + CSS, served by Cloudflare Pages.
- **Backend**: Supabase (Postgres 17, Auth, Storage, Edge Functions).
- **Email relay**: Google Apps Script (`GAS-EMAIL-RELAY.gs`) + Resend.
- **Image CDN**: ImageKit.

## Layout

```
/                  Public marketing pages + listings
/admin/            Admin dashboard (12 pages)
/landlord/         Landlord dashboard (9 pages)
/tenant/           Tenant portal
/apply/            Public application wizard
/css/              Stylesheets (see below)
/js/               Shared JS (see below)
/components/       Reusable nav + footer fragments
/supabase/         Edge functions + migrations + config.toml
/scripts/          Build scripts
```

## CSS load order (matters)

1. `main.css` — site-wide tokens & marketing pages
2. `admin.css` *or* `landlord.css` — dashboard chrome
3. **`dashboard-system.css`** — shared design tokens & `.ds-*` primitives
   (Phase 1 unification — opt-in by class)
4. `mobile.css` — mobile-first responsive layer (must be last)

## JS modules

- `cp-api.js` — Supabase client + Auth/Apps/Inquiries/etc data layer (ES module)
- **`cp-ui.js`** — `CP.UI.toast / empty / skeleton / badge / safeAvatar / fmtDate / fmtMoney / esc`
  Loaded as classic `<script defer>` BEFORE `cp-api.js` on every dashboard page.
- `components.js` — nav/footer loader, mobile drawer
- `card-builder.js`, `imagekit.js`, `supabase.min.js` — feature/vendor

## Recent work (2026-04-21 — dashboard hardening pass)

### Security (Supabase migration `20260421000002_security_hardening.sql`)
- Enabled RLS on `pipeline_properties`, `pipeline_enrichment_log`,
  `pipeline_scrape_runs`, `draft_applications`, `_migration_history`
  (these were readable via anon key — now denied to anon/auth, edge
  functions still access them via service_role).
- Added explicit `deny_all_anon` policy on `rate_limit_log`.
- Pinned `search_path = public, pg_temp` on 8 functions to prevent
  search-path hijack: `generate_lease_tokens`, `sign_lease_tenant`,
  `generate_property_id`, `increment_counter`, `is_admin`,
  `set_updated_at`, `trg_saves_count`, `immutable_array_to_text`.
- Result: Supabase security advisor — **0 ERROR-level findings** remaining.

### Dashboards
- `admin/dashboard.html` sidebar was hijacked (only one broken
  Watermark Review link). Restored full nav.
- "Watermark Review" link in 12 admin pages was pointing to
  `dashboard.html` — fixed to `watermark-review.html`.
- Wired `dashboard-system.css` + `cp-ui.js` into all 21 dashboard pages.

### New shared primitives — use these going forward
- **CSS**: `.ds-card`, `.ds-btn`, `.ds-input`, `.ds-badge--{success,warning,danger,info,purple,neutral}`,
  `.ds-table` (auto card-mode on phones), `.ds-skeleton`, `.ds-empty`, `.ds-sheet`
- **JS**: `CP.UI.toast(msg, {type:'success'|'error'|'warning'})`,
  `CP.UI.empty(el, {icon, title, sub, cta})`,
  `CP.UI.skeleton(el, rows)`,
  `CP.UI.badge(status)`, `CP.UI.safeAvatar(name)`,
  `CP.UI.fmtDate / fmtMoney / fmtPhone / esc`

### Mobile (Phase 2 in `mobile.css`)
- Tables wrapped with `.ds-table` collapse to card view ≤768px
  (use `data-label="Field"` on each `<td>` for the field label).
- `.ds-sheet` pattern for bottom-sheet modals on phones.
- Stats grid → 2-col on ≤540px.

## Known follow-ups (not yet done)

- Migrate per-page inline `statusBadge()` helpers to `CP.UI.badge()`.
- Convert tenant portal's inline `<style>` block + local `getSB()` to
  use `cp-api.js` like everywhere else.
- Add `data-label` attributes to existing admin tables so Phase 2
  card-mode kicks in.
- Set up a Supabase preview branch so future migrations don't hit prod first.

## DO NOT

- Do not configure a Replit workflow. The user has explicitly said this
  workspace is for editing only; the app runs on Cloudflare Pages.
- Do not run `npm start` / `node serve.js` here — `preinstall` enforces
  Cloudflare-only.
