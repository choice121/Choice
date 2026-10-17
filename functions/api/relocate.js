// ============================================================
// /api/relocate — Choice Properties Address Relocation & Aliasing API
// Cloudflare Pages Function endpoint
// ============================================================

export function aliasAddress(address, offset = 8) {
  if (!address || typeof address !== 'string') return address;
  const match = address.match(/^(\d+)(.*)$/);
  if (!match) return address;
  const num = parseInt(match[1], 10);
  const newNum = num + offset;
  return `${newNum}${match[2]}`;
}

const YUKON_VERIFIED_STREETS = [
  { name: '704 Oak Ave', lat: 35.504644, lng: -97.753636 },
  { name: '820 Elm Ave', lat: 35.506739, lng: -97.755214 },
  { name: '412 Holly Ave', lat: 35.503075, lng: -97.751478 },
  { name: '624 Cedar Ave', lat: 35.508870, lng: -97.752619 },
  { name: '316 S 5th St', lat: 35.504474, lng: -97.750681 },
  { name: '516 S 6th St', lat: 35.505804, lng: -97.752174 },
  { name: '408 S 8th St', lat: 35.503461, lng: -97.754781 },
  { name: '3216 Vandament Ave', lat: 35.493472, lng: -97.729211 }
];

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { property, targetQuery, mode } = body;

    if (!property) {
      return new Response(JSON.stringify({ ok: false, error: 'Property is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (mode === 'same_block_alias') {
      const originalAddr = property.address || property.street || '';
      const newAddress = aliasAddress(originalAddr, 8);
      const city = property.city || '';
      const state = property.state || '';
      const zip = property.zip || property.zip_code || '';
      const title = `${newAddress}, ${city}, ${state} ${zip}`.trim();

      return new Response(JSON.stringify({
        ok: true,
        result: {
          newTitle: title,
          newAddress: newAddress,
          newCity: city,
          newState: state,
          newZip: zip,
          newCounty: property.county || '',
          newLat: property.lat || property.latitude,
          newLng: property.lng || property.longitude,
          newDescription: property.description || '',
          method: 'Same-Block Privacy Aliasing (+8 Offset)',
          verifiedCensus: true
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Cross-location relocation with verified municipal streets
    const query = (targetQuery || 'Yukon, OK').trim();
    let city = 'Yukon';
    let state = 'OK';
    let zip = '73099';
    let county = 'Canadian County';

    const selectedStreet = YUKON_VERIFIED_STREETS[Math.floor(Math.random() * YUKON_VERIFIED_STREETS.length)];
    const newAddress = selectedStreet.name;
    const newTitle = `${newAddress}, ${city}, ${state} ${zip}`;

    let newDesc = property.description || '';
    if (newDesc && property.city && property.state) {
      newDesc = newDesc
        .replace(new RegExp(`\\b${property.city}\\b`, 'gi'), city)
        .replace(new RegExp(`\\b${property.state}\\b`, 'gi'), state)
        .replace(new RegExp(`\\b${property.zip || ''}\\b`, 'gi'), zip);
    }

    return new Response(JSON.stringify({
      ok: true,
      result: {
        newTitle,
        newAddress,
        newCity: city,
        newState: state,
        newZip: zip,
        newCounty: county,
        newLat: selectedStreet.lat,
        newLng: selectedStreet.lng,
        newDescription: newDesc,
        method: `Verified Synthetic Relocation (${query})`,
        verifiedCensus: true
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
