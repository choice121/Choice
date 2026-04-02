# Choice Properties

## STATIC SITE — No backend server required

This repository contains a **pure static frontend** deployed via Cloudflare Pages. There is no application server, no Node.js runtime server, no Python server, and no Docker configuration in this codebase.

All server-side logic runs on fully hosted third-party platforms:

- **Cloudflare Pages** — serves the static HTML / CSS / JS
- **Supabase Edge Functions** — handles all API logic (10 Deno functions deployed to Supabase's cloud)
- **Supabase PostgreSQL** — database with Row Level Security on all tables
- **Google Apps Script** — email relay (deployed separately to Google's platform)
- **ImageKit.io** — property photo CDN
- **Geoapify** — address autocomplete API

## Architecture

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for a full breakdown of every component, all Edge Functions, database tables, the security model, and an explicit list of what does **not** exist in this repository.

## Deployment

- **Cloudflare Pages root directory:** `/` (repository root)
- **Build command:** `node generate-config.js`
- **Build output directory:** `.`

No npm packages are installed at runtime. The build step uses only Node.js built-in modules.

## Uptime Monitoring (L-05)

Set up free uptime monitoring via [UptimeRobot](https://uptimerobot.com) to get alerted immediately if the site or health endpoint goes down.

### Setup Steps

1. Create a free account at [uptimerobot.com](https://uptimerobot.com) (free tier: 50 monitors, 5-minute check interval).

2. Add two **HTTP(s)** monitors:

   | Monitor Name            | URL                                          | Check Interval |
   |-------------------------|----------------------------------------------|----------------|
   | Choice Properties — Home | `https://your-domain.com/`                   | 5 minutes      |
   | Choice Properties — Health | `https://your-domain.com/health.html`      | 5 minutes      |

3. For each monitor, configure **Alert Contacts** with your admin email so you receive an email when a monitor goes down and when it recovers.

4. Optionally add a **Status Page** in UptimeRobot (free) and link it from your admin dashboard so the team can check status at a glance.

### What to Monitor

- **`/`** — confirms Cloudflare Pages is serving the site
- **`/health.html`** — static page purpose-built for uptime checks; if this returns non-200 the CDN itself is down

### Notes

- Supabase Edge Functions have their own uptime dashboard at [app.supabase.com](https://app.supabase.com) → your project → Edge Functions.
- GAS (Google Apps Script) email relay does **not** have a public health endpoint. Monitor email delivery by reviewing the Email Logs page in the admin panel regularly, or set up a daily cron alert via UptimeRobot's "Keyword" monitor type pointed at a GAS-triggered status page if desired.
- Replace `your-domain.com` with your actual Cloudflare Pages domain before setting up monitors.
