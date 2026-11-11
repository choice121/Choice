import fs from 'fs';

const items = JSON.parse(fs.readFileSync('scripts/charlotte_full_payloads.json', 'utf8'));

console.log('--- Inspecting Charlotte 1-bed/studio properties ---');
items.forEach((item, i) => {
  const p = item.payload;
  const photos = Array.isArray(p.original_image_urls) ? p.original_image_urls : JSON.parse(p.original_image_urls || '[]');
  console.log(`\n[${i+1}] ${p.address}, ${p.city}, ${p.state} ${p.zip}`);
  console.log(`Rent: $${p.monthly_rent} | Beds: ${p.bedrooms} | Baths: ${p.bathrooms} (half: ${p.half_bathrooms}) | Sqft: ${p.square_footage}`);
  console.log(`Type: ${p.property_type} | Year: ${p.year_built} | Lot: ${p.lot_size_sqft}`);
  console.log(`Parking: ${p.parking} | Garage: ${p.garage_spaces} | Laundry: ${p.laundry_type}`);
  console.log(`Appliances: ${JSON.stringify(p.appliances)}`);
  console.log(`Amenities: ${JSON.stringify(p.amenities)}`);
  console.log(`Photos (${photos.length}): ${photos.slice(0, 2).map(ph => typeof ph === 'string' ? ph : ph.url).join(', ')}`);
  console.log(`Desc: ${(p.original_description || p.description || '').replace(/\s+/g, ' ').slice(0, 200)}...`);
});
