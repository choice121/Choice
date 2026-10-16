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
  requests both returned HTTP 401.
- Replaying the function's exact Places parameters with the key from the
  production browser config returned HTTP 400. The provider identified
  `healthcare.clinic` as unsupported. Each other configured category returned
  HTTP 200 independently. Replacing that category with Geoapify's supported
  `healthcare` umbrella returned HTTP 200 with nearby-place results, including
  healthcare subcategories such as `healthcare.clinic_or_praxis`. The function
  and category normalizer were updated to use and accept that supported
  category, then deployed in commit `140a25b`.
- The tested property's location-cache query succeeded but returned no row.
  No successful snapshot has been verified, so customer-facing nearby results
  and map markers remain unverified.
- The Geoapify key present in the production browser config was tested against
  autocomplete, Places, and reverse geocoding from a server request without a
  `Referer`; all three returned HTTP 200. This does not establish that this is
  the same value configured as the Supabase Edge Function secret.
- A private-placement request without a share token returned HTTP 404 as
  intended. A valid share-token request was not tested.

The unsupported category explained the Places HTTP 400 and has been corrected
in production. A post-deployment request still returned HTTP 502 from the Edge
Function, with both provider requests returning HTTP 401. The deployed Edge
Function's Geoapify credential or its provider-side restrictions remain
unresolved. The Supabase CLI is not
available in the verification environment, and secret values were not read or
printed; inspect the `GEOAPIFY_API_KEY` secret configuration in Supabase using
an authorized secret-management interface. Do not print the value, send it in
chat, or spoof a browser `Referer` to bypass a restriction.

## Deployment and verification

Migration `20261015000002_property_location_intelligence.sql` and the
`property-location` Edge Function deployment completed successfully in the
Supabase workflow for the location fix (`140a25b`). The Cloudflare enforcement
and Pages build/deployment workflows also completed successfully for that
commit. The property page and its JavaScript asset are served by production,
but an interactive browser test could not be run in the verification
environment (no browser or Playwright installation is available).

After the Supabase secret issue is resolved, request location data for an
active property with stored coordinates, confirm a snapshot and cache record
are created, and verify the nearby places, attribution, and map markers on the
property details page. Then test a private-placement listing with a valid share
token as well as without one.
