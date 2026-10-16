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

The latest source change updates the Places request to this documented GET
format. A live request against an active listing previously received HTTP 400
from Places and HTTP 401 from reverse geocoding. The updated function could not
be deployed during that check because the deployment environment could not
resolve the npm registry while bundling. Therefore, the live endpoint has not
yet been verified with the updated request implementation.

## Deployment checklist

1. Confirm migration `20261015000002_property_location_intelligence.sql` is
   applied to the target Supabase project.
2. Deploy the `property-location` Edge Function from this repository.
3. Request location data for an active property with stored coordinates.
4. Confirm the endpoint returns the snapshot and a corresponding cache record
   is created; then verify the nearby places and map markers on the property
   details page.
