# AI Handoff: Choice-Managed Rentals

**Status:** Paused at user request on 2026-10-28. The next AI should continue from the current worktree, verify the state described below, and finish the remaining product changes. Do not deploy or perform database writes as part of resuming this handoff.

## Operating Model

Choice Properties management manages the rental experience end to end. Management reviews applications, makes and communicates decisions, manages listings, coordinates leasing, and supports residents. Do not reintroduce an external-landlord decision, notification, or public signup workflow. Preserve internal records and staff tooling unless a specific workflow is proven obsolete and can be safely retired.

Keep the work focused on app behavior, renter and staff experience, data quality, performance, and communication consistency. Do not broaden this task into platform/service integration work.

## Changes Applied So Far

Verify these against the current diff before continuing; this repo had a heavily modified worktree before the audit began.

- Fixed advanced bedroom filtering by separating minimum-bedroom state from exact-bedroom state; made filter clearing tolerate removed controls.
- Added a live city index and city/state query handling to the listings experience; added redirects for legacy `/listings/` paths and updated city-card links.
- Removed pet filters and pet/qualification disclosures from the primary public listing card and property-page render paths.
- Fixed the application fee display to `$50`; changed the income indicator from a pass/fail qualification judgment to a neutral estimate for management review.
- Removed the direct landlord application-notification job from `supabase/functions/receive-application/index.ts`; applicant confirmation and Choice management notifications remain.
- Redirected legacy `/landlord/...` page requests to management sign-in in `functions/_middleware.js`.
- Updated portions of Terms, application policy, FAQ, how-to-apply, application form, credit-policy copy, homepage, management/about navigation, staff approval copy, and tenant status copy to reflect Choice Properties management.
- User edits already present included updated shared navigation/footer and cache-version changes. Preserve them.

## Known Worktree Constraint

The workspace had 66 modified files before implementation began. It now contains those existing edits plus audit changes. Do not reset, checkout, or broadly reformat files. Inspect `git diff` for each file before editing it. The homepage (`index.html`) had a repeated-block patch-context problem during the work; an assistant reported restoring the hero/search block from `HEAD`, but the next AI must inspect that block and verify its form control IDs and markup before touching the homepage again.

## Remaining Work, In Order

1. **Verify the browse path.** Check city-index rendering and the `/listings/` redirects in the actual static-site routing behavior. Verify city/state filters, browser back/forward, query persistence, clear-all behavior, and the admin-mode listing branch. Run `node --check` on `js/listings.js`, `js/cp-api.js`, and `js/card-builder.js`. Add focused regression coverage if practical.
2. **Finish public listing cleanup.** Check both `js/property.js` and the duplicate `app/applet/js/property.js` for pet, minimum-credit, minimum-income, availability, lease-term, or move-in data rendered to renters. Confirm no pet selector or stale pet state remains in `listings.html`/`js/listings.js`.
3. **Finish the management model sweep.** Search customer-facing pages, terms, privacy/fair-housing copy, approval/status emails, tenant portal, lease workflow, and any remaining staff message templates for external-landlord decision or notification language. Keep former/current landlord references in an applicant's rental history; those are not property-management actors.
4. **Reconcile the fee/credit policy.** Fee is fixed at $50. There is no confirmed automatic application-credit issuance/redemption feature in the app. Make every linked policy and confirmation state explicitly match that; do not describe credits as an entitlement unless the full workflow is implemented and tested. Check the `application-credit-policy.html` title, metadata, body, and all links because the old URL is retained for compatibility.
5. **Resolve data-quality findings.** The read-only public snapshot showed 115 active listings, all with required address/spec/rent fields and photos; 3,825 photos had no duplicate order or hero-order mismatch. It also found 11 description matches for pet-language patterns, two for lease/qualification patterns, seven exact duplicate descriptions, property-type spelling/case variants, and none of 115 titles matching the documented address-only format. These are aggregate flags; manually inspect records before editing any source text. Do not rewrite authentic descriptions or alter live records without an explicit, reviewed data-change plan.
6. **Finish homepage and positioning cleanup.** Remove unsupported claims (landlord verification, landlord ratings, exact application duration/review SLA, nationwide coverage/volume) unless supported by current facts. Keep the search form and its IDs intact. The audited snapshot was 115 active listings across 23 city/state markets, five states, and 40 ZIP codes; these counts are a snapshot, not permanent marketing copy.
7. **Retire obsolete public routes deliberately.** Public navigation now routes away from landlord signup, and the legacy portal route is redirected. Verify old landlord agreement links, `how-it-works.html`, login links, and app-copied nav/footer behavior. Do not delete the underlying landlord/account data model as part of copy cleanup.
8. **Improve validation.** The repo's `npm run lint` is currently a no-op that prints success. Existing Playwright coverage does not exercise browse → apply → application tracking → decision → lease signing. Add focused behavioral tests and replace the no-op check when scope allows.

## Validation Performed

- Live public listing diagnostics were read-only and aggregate-only; no database rows were changed.
- `get_errors` reported no errors in the edited `receive-application` function, middleware, Terms, application policy, FAQ, how-to-apply, and application form markup.
- `node --check` passed for the application script after fee/context repair and after changing the income indicator. The listing/card/property scripts also passed syntax checks at intermediate points; rerun all checks after resuming because later edits continued.
- No complete build or end-to-end browser journey was run. Do not treat the feature work as finished until these are tested.

## First Actions for the Next AI

1. Read this handoff and inspect `git status --short` plus targeted diffs for files to be changed.
2. Check the current edits in `index.html`, `js/listings.js`, `js/cp-api.js`, `js/property.js`, `apply/index.html`, and `apply/js/script.js`; confirm no malformed repeated blocks or stale strings.
3. Run focused syntax/markup checks, then continue with the remaining checklist above. Keep the user informed before edits and do not deploy.
