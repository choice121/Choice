# Property location enrichment

The property details page can load a location snapshot from the Supabase
`property-location` Edge Function. The function uses the listing's stored
coordinates to retrieve nearby points of interest and an approximate
neighborhood label.

## Information shown

- Nearby schools, parks, shopping, healthcare, and public-transport locations
  within five kilometers.
- An approximate neighborhood, city, and county label from reverse geocoding,
  when available.
- Approximate straight-line distances to nearby places. These are not walking,
  driving, or transit travel distances.
- Provider attribution and the time the location snapshot was retrieved.

The location data supplements the listing; it does not change the verified
property address or other listing facts. Nearby schools are not presented as
school assignments or as having a particular rating or quality. A missing
nearby result is not proof that the place does not exist, and the feature does
not provide a Walk Score.

## Loading and caching

The property page requests location data when the location section is opened.
Successful snapshots are cached in `public.property_location_intelligence` for
14 days; partial snapshots are cached for six hours. If an expired snapshot
cannot be refreshed, the function can return it marked as stale. Nearby place
results are limited to four per category and 16 overall.

The function uses coordinates stored with the property. It serves active
listings and allows private-placement listings only when the request includes
a valid share token for that property.

## Provider request and current rollout

The function makes separate Geoapify Places and reverse-geocoding requests.
The Places request uses the documented GET endpoint with a five-kilometer
circle filter, proximity bias, the supported categories, and a maximum of 100
results. Returned places are normalized and their distances are calculated
before the snapshot is cached.

The current `property-location` function is deployed. Latest verification on
2026-10-16 used the production site and one active listing with stored
coordinates:

- The public listing lookup succeeded, but the deployed function returned
  HTTP 502 (`location_provider_unavailable`); its Places and reverse-geocoding
  requests both returned HTTP 401 before the Supabase Edge Function secret was
  updated.
- Replaying the function's exact Places parameters with the key from the
  production browser config returned HTTP 400. The provider identified
  `healthcare.clinic` as unsupported. Each other configured category returned
  HTTP 200 independently. Replacing that category with Geoapify's supported
  `healthcare` umbrella returned HTTP 200 with nearby-place results, including
  healthcare subcategories such as `healthcare.clinic_or_praxis`. The function
  and category normalizer were updated to use and accept that supported
  category, then deployed in commit `140a25b`.
- After the new `GEOAPIFY_API_KEY` was saved in Supabase, the deployed function
  returned HTTP 200 with `status: "ok"`, 12 nearby places, and `stale: false`.
  A service-authorized cache check confirmed one snapshot row for the tested
  listing.
- The Geoapify key present in the production browser config was tested against
  autocomplete, Places, and reverse geocoding from a server request without a
  `Referer`; all three returned HTTP 200. This does not establish that this is
  the same value configured as the Supabase Edge Function secret.
- A private-placement request without a share token returned HTTP 404 as
  intended. A valid share-token request was not tested.

The unsupported category explained the Places HTTP 400 and has been corrected
in production. Updating the Supabase Edge Function secret resolved the
provider 401s. Secret values were not read or printed. Keep the server-side
Supabase secret separate from the key injected into public browser config for
address autocomplete.

## Deployment and verification

Migration `20261015000002_property_location_intelligence.sql` and the
`property-location` Edge Function deployment completed successfully in the
Supabase workflow for the location fix (`140a25b`). The Cloudflare enforcement
and Pages build/deployment workflows also completed successfully for that
commit. The property page and its JavaScript asset are served by production.
The function response and cache were verified end to end. A local-source
Playwright test now passes using Chromium and an active geocoded listing: it
checks nearby-place content, Geoapify attribution, straight-line distance text,
nearby map markers, visible OpenStreetMap attribution, fully loaded map tiles,
and browser page errors, and saves a map screenshot. Production map behavior
still needs verification after the current map changes deploy. A
private-placement request without a share token returned HTTP 404; a valid
share-token request remains untested.

Remaining verification: rerun the visual test against production after deploy,
then test a private-placement listing with a valid share token in addition to
the already verified no-token denial.
