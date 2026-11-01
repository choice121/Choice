import fs from 'fs';

const rawData = JSON.parse(fs.readFileSync('scripts/today_unique_payloads.json', 'utf8'));

const detailed = rawData.map((item, idx) => {
  const p = item.payload;
  let photos = [];
  try {
    photos = Array.isArray(p.original_image_urls) ? p.original_image_urls : JSON.parse(p.original_image_urls || '[]');
  } catch(e) {
    photos = [];
  }
  return {
    index: idx + 1,
    file: item.fileName,
    zpid: p.source_listing_id || p.zpid,
    title: p.title,
    address: p.address,
    city: p.city,
    state: p.state,
    zip: p.zip,
    county: p.county || 'Oklahoma County', // Edmond OK is primarily Oklahoma County (or Canadian/Logan)
    lat: p.lat,
    lng: p.lng,
    monthly_rent: p.monthly_rent || p.price,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    half_bathrooms: p.half_bathrooms,
    square_footage: p.square_footage,
    year_built: p.year_built,
    lot_size_sqft: p.lot_size_sqft,
    property_type: p.property_type,
    garage_spaces: p.garage_spaces,
    parking: p.parking,
    laundry_type: p.laundry_type,
    heating_type: p.heating_type,
    cooling_type: p.cooling_type,
    has_central_air: p.has_central_air,
    has_basement: p.has_basement,
    appliances: p.appliances,
    amenities: p.amenities,
    flooring: p.flooring,
    photo_count: photos.length,
    photos: photos.map(ph => typeof ph === 'string' ? ph : ph.url),
    source_url: p.source_url,
    original_description: p.original_description || p.description || ''
  };
});

fs.writeFileSync('scripts/detailed_19_properties.json', JSON.stringify(detailed, null, 2));
console.log('Saved scripts/detailed_19_properties.json');
