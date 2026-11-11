import fs from 'fs';

const data = JSON.parse(fs.readFileSync('scripts/charlotte_new_raw.json', 'utf8'));
console.log('Total items in charlotte_new_raw:', data.length);

data.forEach((d, idx) => {
  console.log(`[${idx+1}] ${d.address}, ${d.city}, ${d.state} ${d.zip} | $${d.monthly_rent} | ${d.bedrooms} bed / ${d.bathrooms} bath | Type: ${d.property_type}`);
});
