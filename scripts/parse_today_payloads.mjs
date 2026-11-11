import fs from 'fs';

const data = JSON.parse(fs.readFileSync('scripts/today_unique_payloads.json', 'utf8'));
console.log('Total unique properties loaded:', data.length);

data.forEach((item, i) => {
  const p = item.payload;
  const photos = Array.isArray(p.original_image_urls) 
    ? p.original_image_urls 
    : (typeof p.original_image_urls === 'string' ? JSON.parse(p.original_image_urls || '[]') : []);
  console.log(`\n--- Property #${i + 1} ---`);
  console.log(`File: ${item.fileName}`);
  console.log(`Title: ${p.title}`);
  console.log(`Address: ${p.address}, ${p.city}, ${p.state} ${p.zip}`);
  console.log(`ZPID / Listing ID: ${p.source_listing_id || p.zpid}`);
  console.log(`Rent: $${p.monthly_rent || p.price}`);
  console.log(`Beds: ${p.bedrooms} | Baths: ${p.bathrooms} (half: ${p.half_bathrooms}) | Sqft: ${p.square_footage}`);
  console.log(`Property Type: ${p.property_type} | Year Built: ${p.year_built} | Lot: ${p.lot_size_sqft}`);
  console.log(`Garage / Parking: spaces=${p.garage_spaces}, parking=${p.parking}`);
  console.log(`Laundry: ${p.laundry_type} | Cooling: ${p.cooling_type} | Heating: ${p.heating_type}`);
  console.log(`Appliances: ${JSON.stringify(p.appliances)}`);
  console.log(`Amenities: ${JSON.stringify(p.amenities)}`);
  console.log(`Photos (${photos.length}): ${photos.slice(0, 2).map(img => typeof img === 'string' ? img : img.url).join(', ')}`);
  console.log(`Source URL: ${p.source_url}`);
  console.log(`Description preview: ${(p.original_description || p.description || '').slice(0, 150)}...`);
});
