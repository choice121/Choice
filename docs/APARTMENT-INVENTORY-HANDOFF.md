# Apartment Inventory Implementation Handoff

## Purpose and current state

Continue the production-grade, community-first apartment inventory work across the Choice website, Supabase, Property Pipeline, and browser extension. This handoff records the current checkout as it exists now; it is **not** a completion or production-readiness claim.

The user explicitly requested that the current local changes be committed and pushed so another AI can continue. Both repositories were on `main`, and both local branches matched `origin/main` before the work was committed. The changes are now pushed:

- Choice: `e85d67bdfb8561e7a01d517a2fb81eb0e7d821fc`
- Property Pipeline: `559b4a52e03a4a871b5f56f560bb63e580e283b6`

The implementation remains incomplete and its latest edits have not passed the full checks. The push triggered production workflows; see the verified deployment results below. Do not describe the feature as fully implemented or end-to-end verified.

The user's target workflow is:

1. Capture one apartment community and its source metadata.
2. Review and distinguish rentable units from floor-plan layouts.
3. Persist reviewed units, floor plans, buildings, floors, and unit media without inventing missing facts.
4. Publish one community parent, not a separate public listing for every unit.
5. Show a clearly labeled community starting rent/range and the exact rent for a selected unit.
6. Allow an application for an authorized real unit with server-side validation.
7. Keep private placements inaccessible except through a valid, unexpired, unrevoked share.
8. Verify the whole flow with automated tests, live smoke checks, and an installed extension on a Zillow detail page.

The architecture and original audit are described in the approved session plan at `/home/codespace/.copilot/session-state/552db588-db95-49a0-af79-c10d98768988/plan.md`. That file is outside this repository; this handoff is intended to let work continue without relying on it.

## Changes present in this handoff

### Choice website repository

Changes are staged/being prepared in [Choice](../), including:

- Two new migrations:
  - `supabase/migrations/20261106000004_pipeline_publish_apartment_inventory.sql`
  - `supabase/migrations/20261106000005_apartment_inventory_model.sql`
- Edge Function/shared code for pipeline record normalization, private-share inventory resolution, and application unit validation.
- Community inventory retrieval/rendering in `js/cp-api.js`, `js/property.js`, and `property.html`.
- Admin pipeline review changes and extension extraction/test changes.
- Extension package/version metadata and generated archives. The listed version is `52.7.9`.
- A newly generated `deno.lock` from local Deno validation. It is included in the Choice commit; confirm whether the repository intends to keep this lockfile or remove it in a follow-up.

### Property Pipeline repository

Changes are present in `/workspaces/property-pipeline`, including:

- Publisher review/confirmation flow in `backend/routers/publisher.py` and `frontend/src/components/PublishButton.jsx`.
- A substantial publisher-service change in `backend/services/publisher_service.py` intended to normalize reviewed units/plans, persist building/floor relationships and unit photos, and handle rollback/error cases.
- Related publisher tests and frontend API changes.

The user's push request covers both repositories. Each repository needs its own commit and push. Check the final `git status` and push result for each independently.

## Important production observations

These observations came from read-only inspection of the linked Supabase project `Choice` (`tlfmwetmhthpyrytrcfo`):

- Production already contains `public.property_buildings`, `public.property_floors`, `public.property_units`, and `public.property_media`.
- `property_units` stores unit photos in JSONB column `unit_photos` (not `photo_urls`) and has explicit `building_id` and `floor_id` relationships. Composite foreign keys enforce that related rows belong to the same parent property.
- Building and floor tables have their own schema and relationships; writing only labels onto a unit does not populate these normalized relationships.
- `property_units` uses UUID IDs and references `properties`. `property_floors` requires a building. The new publisher changes attempt to upsert building/floor rows and then link units; verify real constraints and returned IDs.
- Production had RLS enabled on these inventory tables. Before the new migration, inspection found no client grants; the existing policies/grants must be reviewed together. Private-placement inventory must only be returned through the validated share resolver, not made public by broad grants or policies.
- The pre-existing `pipeline_publish` RPC signature was `pipeline_publish(p_id text, p_landlord_id uuid, p_status text)`. The existing status and publisher behavior must remain private by default.
- Before the push, remote migration history showed both `20261106000004` and `20261106000005` pending. The push-triggered workflow subsequently applied both (HTTP 201) and recorded them as applied.
- The push-triggered workflow deployed all Edge Functions. Its Deno step was a syntax/parse check, not a type-check.
- No production privacy or application smoke checks have been performed.

The pipeline schema is owned by the separate Property Pipeline project. Do not alter, drop, move, or expose any object in the `pipeline` schema, and do not change the service-role access model.

## Known gaps and risks that must be resolved

### 1. Latest edits are unverified

Do not treat earlier successful checks as covering the latest changes. The last known successful checks happened before the newest building/floor persistence and extractor changes. In particular:

- `backend/tests/test_publisher_service.py` likely still expects `photo_urls`, while production uses `unit_photos`.
- Its fake Supabase client may not support the new `upsert(...).select(...).execute()` sequence.
- Verify both direct publish and existing-record sync create/link building and floor rows, persist `unit_photos`, preserve existing/manual records, remove internal helper fields from public payloads, and handle partial failures safely.
- Confirm every publisher entry point uses the same visibility default and does not accidentally expose a private placement.
- Review the migration SQL for compatibility, idempotency, exact types/constraints, foreign keys, RPC behavior, permissions, and RLS. The migrations have not been parsed/applied against production.
- The newest Zillow unit-gallery extractor reads structured unit objects. It does not establish coverage for all rendered DOM/gallery patterns or prove that extracted images are actually unit-specific.

### 2. Extension packaging is stale relative to latest source edits

Extension files were edited after the last known successful sync. The current metadata/changelog show v52.7.9, but do not assume checked-in zip files contain the latest extractor/content code. Because extension files changed, the repository's mandatory version/sync workflow must be completed before shipping:

```bash
node scripts/sync-and-bump-extension.mjs
```

Confirm the script updates the version, Chromium/Orion variants, metadata, update feed, archives, changelog, and required extractor tests. Do not manually claim the packaged extension matches source until checked.

### 3. Deployment and verification state after push

- The [Supabase deployment workflow](https://github.com/choice121/Choice/actions/runs/42179929240) completed successfully. It parsed all functions, deployed each function, and applied/recorded migrations `20261106000004_pipeline_publish_apartment_inventory.sql` and `20261106000005_apartment_inventory_model.sql`.
- The [Cloudflare-Only Enforcement workflow](https://github.com/choice121/Choice/actions/runs/42179929308) failed. Its extension extractor test step reported **56 passed, 1 failed**. The failing case was “Zillow unit galleries stay scoped to their source unit and retain explicit building and floor facts”; the actual output omitted expected per-unit source/building/floor/photo facts (`undefined`).
- The separate [pages build and deployment workflow](https://github.com/choice121/Choice/actions/runs/42179927824) succeeded and the repository Pages API reports `https://choice121.github.io/Choice/` in legacy mode. This is not evidence that the required Cloudflare Pages deployment succeeded. Verify the canonical Cloudflare site and its served revision; resolve the unexpected GitHub Pages configuration/deployment in accordance with the Cloudflare-only deployment rule.
- No current public/private or application flow has been verified against production. A successful deployment workflow does not prove the schema, RLS, share, or application behavior is correct.
- No Zillow test has been performed with the installed extension.
- CDN photo URLs are directly accessible to anyone who already knows them; UI overlays or hidden links do not make photo bytes private.

## Mandatory behavior and security invariants

- `pipeline_publish` and all pipeline publication paths default to `private_placement`. `active` requires the user's explicit public-release instruction; “publish,” “approve,” “live,” or creating a share is not by itself authorization to make a listing public.
- A property is public (`active`) or private (`private_placement`), never both.
- Public browse, details, maps, related listings, photos, and media must not reveal non-active properties. Private parent inventory can be returned only after validating the share token, expiry, revocation, and parent membership.
- A valid share for a parent may return only that parent's eligible inventory nested under the parent; it must not create standalone browse listings or permit guessed-ID access.
- Do not allow direct anonymous table access or a public `SECURITY DEFINER` function to bypass the validated resolver.
- Preserve the existing `public.properties` and `public.property_photos` column names/types expected by the pipeline publisher. Do not restore removed `photo_urls`/`photo_file_ids` columns on `properties`.
- Keep unit media in `property_units.unit_photos` or the supported relationship model, not an invented production column.
- Do not infer a floor from a unit number or a rent from a parent/community value. Preserve unknown prices as unknown.
- Clearly distinguish community starting rent (“From”), a floor plan's starting price, and an exact rentable-unit rent.
- Keep original source photo order. Do not combine listing/gallery photos with floor-plan imagery or unverified photos of unrelated units.
- Maintain the project's prohibited listing-content rules: no lease term, smoking, pet, availability/move-in, deposit, or prohibited third-party content in public descriptions/UI. Preserve the required $50 application fee policy.

## Recommended continuation sequence

1. **Reconcile the deployed state first.** Confirm both pushed commits, query remote migration history/schema, and verify deployed function versions. Do not reapply migrations `20261106000004` or `20261106000005`; they were applied by the successful workflow.
2. **Resolve the failing extractor regression before another release.** Reproduce the GitHub failure in `.pages-orion/test-extractors.js` and `chrome-extension/test-extractors.js`; verify why unit `A101` lost its source ID, building/floor fields, and photo collection. Run the required extension sync/version workflow after fixing any extension source.
3. **Finish source-level review of the publisher and already-applied migration.** Trace direct publish, bulk/folder publish, and sync paths. Confirm normalized building/floor rows, IDs, unit photos, floor plans, source ordering, visibility, rollback semantics, and RLS/grants. Do not make a follow-up migration until remote state and data impact are understood.
4. **Repair/add focused tests.** Update publisher fakes/expectations for `unit_photos` and hierarchy upserts. Cover idempotent publish/sync, missing/duplicate source IDs, multi-building/floor relationships, unit-vs-plan classification, photos, partial failure, and private-by-default behavior.
5. **Run required validations.** At minimum:
   - Choice static-site build (`npm run build`).
   - Extension sync/version script above and its complete extractor suite.
   - Targeted `pipeline-record` tests and Deno type-check for modified Edge Functions.
   - Targeted Property Pipeline publisher tests.
   - `git diff --check` in both repositories.
6. **Review `deno.lock`.** It was generated by local Deno use and included in the Choice commit. Confirm whether it belongs in the repository based on existing Deno lockfile policy and project configuration; remove it in a follow-up if it is not intended.
7. **Verify live privacy and functionality immediately:** active-only inventory, private-share membership/expiry/revocation, unit media, application unit-parent validation, status defaults, and no direct-ID/privacy bypass.
8. **Resolve canonical deployment routing.** Confirm the Cloudflare Pages deployment for the pushed commit and address the legacy GitHub Pages workflow/configuration; do not claim Cloudflare is live based on the `github.io` deployment.
9. **Run the actual browser test** with the installed extension on a Zillow property detail page. Compare source gallery count/order and per-unit images against the extension capture and the Choice page. Record exact gaps rather than inferring success from a fixture.
10. **Report only verified outcomes.** Separate local tests, remote migration/function deployment, Cloudflare vs GitHub Pages state, live smoke results, and the still-manual Zillow test.

## Available tools and authorization context

At handoff, Deno 2.9.8, PostgreSQL client 16, Supabase CLI 3.0.0, GitHub CLI, and `gh` authentication were available. Supabase was linked to the Choice project and read-only production inspection worked. Do not print, copy, or commit credentials. The user previously said not to rotate/retire credentials; this handoff does not authorize exposing them.

The user authorized committing/pushing the current local changes and had previously requested migration/function deployment. The push-triggered workflows did deploy all Edge Functions and apply the two pending migrations. The user also said not to rotate/retire credentials. Never expose credentials. The latest workflow state is documented above; verify the canonical Cloudflare deployment before claiming it is live.
