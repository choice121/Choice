import fs from 'fs';
const props = JSON.parse(fs.readFileSync('scripts/detailed_19_properties.json', 'utf8'));
props.forEach(p => {
  console.log('------------------------------------------------------------');
  console.log('#' + p.index + ' | ' + p.address + ', ' + p.city + ', ' + p.state + ' ' + p.zip);
  console.log('Rent: $' + p.monthly_rent + ' | Beds: ' + p.bedrooms + ' | Baths: ' + p.bathrooms + ' (half: ' + p.half_bathrooms + ') | Sqft: ' + p.square_footage);
  console.log('Year: ' + p.year_built + ' | Lot: ' + p.lot_size_sqft + ' | Type: ' + p.property_type);
  console.log('Garage: ' + p.garage_spaces + ' | Parking: ' + p.parking + ' | Laundry: ' + p.laundry_type);
  console.log('Appliances: ' + p.appliances);
  console.log('Amenities: ' + p.amenities);
  console.log('Photos: ' + p.photo_count);
  console.log('Desc preview: ' + p.original_description.replace(/\s+/g, ' ').slice(0, 250));
});
