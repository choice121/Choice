/**
 * geocode-properties.mjs
 * Sourced from official US Census Bureau Geocoder API (with OpenStreetMap fallback).
 * Geocodes properties that have missing coordinates so that Leaflet maps,
 * distance calculators, and neighborhood intelligence reflect real-life rooftop coordinates.
 */
import { CREDENTIALS_CONFIG } from '../credentials-config.mjs';

const url = CREDENTIALS_CONFIG.SUPABASE_URL;
const key = CREDENTIALS_CONFIG.SUPABASE_API_KEY;
const headers = {
  'apikey': key,
  'Authorization': 'Bearer ' + key,
  'Content-Type': 'application/json'
};

async function geocodeAddress(address, city, state, zip) {
  const cleanAddr = (address || '').replace(/#.*$/, '').replace(/apt\.?.*$/i, '').replace(/unit.*$/i, '').trim();
  const q = `${cleanAddr}, ${city || ''}, ${state || ''} ${zip || ''}`.trim();
  
  // 1. Primary: US Census Bureau Geocoder (Rooftop/Street benchmark)
  try {
    const censusUrl = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(q)}&benchmark=Public_AR_Current&format=json`;
    const res = await fetch(censusUrl);
    const data = await res.json();
    const match = data.result?.addressMatches?.[0];
    if (match && match.coordinates) {
      return {
        lat: parseFloat(match.coordinates.y.toFixed(6)),
        lng: parseFloat(match.coordinates.x.toFixed(6)),
        source: 'US_Census'
      };
    }
  } catch (err) {
    // Census lookup error, fall through
  }

  // 2. Secondary fallback: OpenStreetMap Nominatim
  try {
    const osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
    const res = await fetch(osmUrl, {
      headers: { 'User-Agent': 'ChoicePropertiesGeocodeAuditor/1.0' }
    });
    const data = await res.json();
    if (data && data[0]) {
      return {
        lat: parseFloat(parseFloat(data[0].lat).toFixed(6)),
        lng: parseFloat(parseFloat(data[0].lon).toFixed(6)),
        source: 'OpenStreetMap'
      };
    }
  } catch (err) {
    // OSM lookup error
  }

  // 3. Tertiary: City + State centroid fallback if exact address isn't in street map packs
  try {
    const cityQ = `${city || ''}, ${state || ''} ${zip || ''}`.trim();
    const osmCityUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityQ)}&format=json&limit=1`;
    const res = await fetch(osmCityUrl, {
      headers: { 'User-Agent': 'ChoicePropertiesGeocodeAuditor/1.0' }
    });
    const data = await res.json();
    if (data && data[0]) {
      return {
        lat: parseFloat(parseFloat(data[0].lat).toFixed(6)),
        lng: parseFloat(parseFloat(data[0].lon).toFixed(6)),
        source: 'CityCentroid'
      };
    }
  } catch (err) {}

  return null;
}

async function main() {
  console.log('Fetching active properties with missing coordinates...');
  const res = await fetch(`${url}/rest/v1/properties?select=id,address,city,state,zip,county&status=eq.active&lat=is.null`, {
    headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
  });
  const unlocated = await res.json();
  console.log(`Found ${unlocated.length} active properties needing geocoding.`);

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < unlocated.length; i++) {
    const p = unlocated[i];
    process.stdout.write(`[${i+1}/${unlocated.length}] Geocoding ${p.address}, ${p.city}, ${p.state}... `);
    const coords = await geocodeAddress(p.address, p.city, p.state, p.zip);

    if (coords) {
      const patchRes = await fetch(`${url}/rest/v1/properties?id=eq.${p.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          lat: coords.lat,
          lng: coords.lng
        })
      });

      if (patchRes.ok) {
        console.log(`✔ [${coords.source}] ${coords.lat}, ${coords.lng}`);
        updated++;
      } else {
        console.log(`✖ PATCH failed: ${patchRes.status}`);
        failed++;
      }
    } else {
      console.log(`✖ Not found in external geocoders`);
      failed++;
    }

    // Rate-limit pause
    await new Promise(r => setTimeout(r, 250));
  }

  console.log(`\nGeocoding complete! Updated: ${updated}, Failed: ${failed}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
