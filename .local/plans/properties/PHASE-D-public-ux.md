# Phase D — Public View UX Polish

**Status:** Not started
**Risk:** Low
**Impact:** Medium
**Depends on:** Nothing
**Blocks:** Nothing

---

## Goal

Fix the visible UX bugs on the live site, make the saved-property list
device-portable, and pre-fetch the property page on card hover so the
detail view feels instant.

## Bugs to fix (caught in the live screenshot)

1. **"All Listings" heading is clipped behind the sticky filter bar.**
   The filter bar sits at `position: sticky; top: 0`, so when the user
   scrolls to the listings section, the heading lands underneath it.
2. **Hero search input truncates the placeholder** (`"City, zip code,
   or neig…"`). The input wrapper is too narrow on the breakpoints
   between ~640 px and ~900 px.
3. **Badge stack ordering** — the card builder picks one of `Featured
   > Verified > Available Now > Avail. <date>` but on cards with both a
   verified landlord AND a near-future availability date, the
   "Available Now" badge wins (because `availNow = !p.available_date ||
   ...`). That's misleading. Final order should be:
   `Featured > Verified > Avail. <date> (if future) > Available Now`.
4. **Saved properties** are stored only in `localStorage`. Users
   logging in across devices lose their list.

## Files touched

| Layer | File | Change |
|---|---|---|
| CSS | `css/cp-marketing.css` (rule for `.listings-heading` / `#listings`) | `scroll-margin-top: 96px;` and add a top padding before the heading to clear the sticky filter bar |
| CSS | `css/cp-marketing.css` (`.mv2-search-row .sf-text`, `.mv2-search-field--text input`) | Increase min-width on the text field at 640–900 px breakpoints; allow placeholder to shorten via `@media` swap |
| HTML | `listings.html` (the search input) | Add `data-placeholder-short="City or zip"` attribute so JS can swap on small screens |
| JS | `js/listings.js` | Read `data-placeholder-short` and swap when `matchMedia('(max-width:899px)').matches` |
| JS | `js/card-builder.js` lines ~95-115 (badge selection) | Reorder priority; verify the Available date is in the future before picking it |
| DB | `supabase/migrations/<DATE>_phaseD01_saved_properties.sql` (new) | New table `saved_properties (user_id uuid, property_id text, saved_at timestamptz default now(), primary key (user_id, property_id))`. RLS: user can read/write own. |
| JS | `js/cp-api.js` `SavedProperties` API | Wire to the new table; keep `localStorage` as a fallback for unauthenticated users; on login, merge the local list into the table once. |
| JS | `js/listings.js`, `js/property.js` | Use the new `SavedProperties` API, no other change. |
| JS | `js/card-builder.js` (or new `js/card-prefetch.js`) | On card mouseenter (desktop) or visible-for-2s (mobile), insert `<link rel="prefetch" href="<property URL>">` once per card |

## Acceptance criteria

- [ ] Scrolling the listings page never clips the "All Listings" heading.
- [ ] The hero search placeholder is fully visible on all breakpoints from 360 px to 1920 px.
- [ ] Card badge for a property with `verified=true, available_date='2026-06-01'` shows "Avail. Jun 1", not "Available Now".
- [ ] Save a property while logged out → log in → property is in the synced list.
- [ ] Save on phone → open laptop logged in as same user → property is there.
- [ ] Click on a property card after 1.5s of hover → page is already cached (visible in DevTools network panel as `(prefetch cache)`).

## Verification

```bash
# CSS regression — make sure scroll-margin-top is in the bundle
grep -nE "scroll-margin-top.*96|#listings\s*{[^}]*scroll-margin-top" css/cp-marketing.css

# JS regression — badge ordering
grep -n "availNow\|badge-avail-date\|badge-available" js/card-builder.js

# Saved table exists with RLS on
psql -c "SELECT relname, relrowsecurity FROM pg_class WHERE relname='saved_properties';"
```

## Rollback

- CSS / JS changes: standard `git revert <commit>`.
- `saved_properties` table: leave in place even on rollback; the
  fallback to `localStorage` still works. Or drop with `DROP TABLE IF
  EXISTS saved_properties` if the table itself caused a problem.

## Estimated complexity

- ~4 CSS rules
- ~30 lines of JS
- 1 small migration (~25 lines including RLS)
- ~3 hours total
