# Phase H — Performance & Reliability

**Status:** Not started
**Risk:** Low
**Impact:** Medium (latency + reliability)
**Depends on:** Phase B (indexes), Phase C (Pages Functions for property pages)
**Blocks:** Nothing

---

## Goal

1. **Edge-cache property detail pages** at Cloudflare with
   `stale-while-revalidate` — first load < 800ms TTFB anywhere in the
   world.
2. **Idempotent counters** — `views_count`, `applications_count`,
   `saves_count` updates today are last-write-wins and can drift.
   Convert to triggers so they're authoritative.
3. **Photo CDN error monitoring** — alert when ImageKit error rate
   crosses a threshold.
4. **Lighthouse budget in CI** — block any PR that regresses LCP, CLS,
   or TBT beyond the budget.

## Files touched

| Layer | File | Change |
|---|---|---|
| Pages Function | `functions/rent/[state]/[city]/[slug].js` (created in Phase C) | Add `Cache-Control: public, max-age=300, s-maxage=600, stale-while-revalidate=86400`. Set `Cloudflare-CDN-Cache-Control` for tiered cache. Vary on `Accept-Encoding`. Bust on property update via `purge_cache` Worker hook. |
| Pages Function | `functions/_middleware.js` | Add a `Cache-Tag` header on property pages: `Cache-Tag: property:<id>`. Use Cloudflare's purge-by-tag API on update. |
| DB | `supabase/migrations/<DATE>_phaseH01_counters_idempotent.sql` (new) | Replace the call sites that do `UPDATE properties SET views_count = views_count + 1` with an INSERT into `property_view_events (property_id, viewer_session, at)` with a UNIQUE on `(property_id, viewer_session, date_trunc('hour', at))`. A trigger maintains `properties.views_count = (SELECT COUNT(*) FROM property_view_events WHERE property_id = NEW.property_id)`. |
| Edge fn | `supabase/functions/property-cache-purge/index.ts` (new) | Webhook listener — on `properties` UPDATE/DELETE, call Cloudflare's purge-by-tag API with `property:<id>` and `sitemap-properties.xml`. |
| Monitoring | `supabase/functions/photo-cdn-monitor/index.ts` (new) | Scheduled function: sample 20 photos from `property_photos` per minute, fetch with `HEAD`, count non-2xx, store in `cdn_health_log`. Alert via the existing `send-email` function if error rate > 1%. |
| CI | `.github/workflows/lighthouse.yml` (new) | Run Lighthouse CI on the 3 hottest URLs (`/`, `/listings.html`, a sample `/rent/...` page). Budget: LCP < 2.5s, CLS < 0.1, TBT < 200ms. Fail PR if regressed. |

## Cache-Control policy

| Resource | `Cache-Control` (browser) | `s-maxage` (CDN) | `stale-while-revalidate` |
|---|---|---|---|
| `/` (homepage) | 0, must-revalidate | 60 | 86400 |
| `/listings.html` (no filters) | 0, must-revalidate | 60 | 3600 |
| `/listings.html?…` (filtered) | 0, must-revalidate | 0 | 0 (don't cache, results vary by user-applied filter) |
| `/rent/<state>/<city>/<slug>/` | max-age=300 | 600 | 86400 |
| `/sitemap-properties.xml` | max-age=3600 | 3600 | 86400 |
| Static `/css/*`, `/js/*` | max-age=31536000, immutable | 31536000 | n/a (already versioned by `?v=__BUILD_VERSION__`) |
| Photos via ImageKit | governed by ImageKit, not us | n/a | n/a |

## Acceptance criteria

- [ ] Repeat `curl -w "%{time_starttime}\n"` against a `/rent/...` URL from 3 different regions returns < 200ms after first warm-up.
- [ ] Updating a property in the admin invalidates only that property's cache key (verifiable via `cache-status: HIT` → `MISS` → `HIT` cycle).
- [ ] `views_count` matches `(SELECT COUNT(*) FROM property_view_events WHERE property_id = X)` for a sample of 20 properties.
- [ ] CDN health log shows < 1% error rate over the last 24 hours.
- [ ] Lighthouse CI is green on the latest commit and the budget file is checked into `.github/`.

## Verification

```bash
# Edge cache hit verification
curl -sI "https://choice-properties-site.pages.dev/rent/tn/knoxville/.../" | grep -i cf-cache-status
# 1st request: MISS
curl -sI "https://choice-properties-site.pages.dev/rent/tn/knoxville/.../" | grep -i cf-cache-status
# 2nd request: HIT

# Counters
psql -c "SELECT id, views_count, (SELECT COUNT(*) FROM property_view_events WHERE property_id = properties.id) AS real FROM properties LIMIT 10;"

# Photo CDN health
psql -c "SELECT date_trunc('hour', at), AVG(CASE WHEN status >= 400 THEN 1.0 ELSE 0.0 END) FROM cdn_health_log WHERE at > NOW() - interval '1 day' GROUP BY 1 ORDER BY 1;"
```

## Rollback

- Cache headers: revert the Pages Function. Cloudflare evicts in ≤60s.
- Counter triggers: drop the trigger; restore direct `UPDATE` call sites.
- Lighthouse CI: delete the workflow file.

## Estimated complexity

- 1 migration (~120 lines for the events table + triggers + RLS)
- 2 new Edge functions (~80 lines each)
- 1 Pages Function header tweak
- 1 GitHub Action
- ~1 day, plus tuning the Lighthouse budget over a week
