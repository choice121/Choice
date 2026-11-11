import fs from 'fs';
const data = JSON.parse(fs.readFileSync('scripts/today_unique_payloads.json', 'utf8'));
data.forEach((item, i) => {
  const p = item.payload;
  console.log(`[${i+1}] ${p.address}, ${p.city}, ${p.state} ${p.zip} | rent: $${p.monthly_rent} | ${p.bedrooms}bd/${p.bathrooms}ba | sqft: ${p.square_footage} | zpid: ${p.source_listing_id || p.zpid}`);
});
