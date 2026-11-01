import { CREDENTIALS_CONFIG } from '../credentials-config.mjs';

async function main() {
  const headers = {
    'apikey': CREDENTIALS_CONFIG.SUPABASE_API_KEY,
    'Authorization': 'Bearer ' + CREDENTIALS_CONFIG.SUPABASE_API_KEY,
    'Accept-Profile': 'pipeline',
    'Content-Profile': 'pipeline'
  };

  const pRes = await fetch(CREDENTIALS_CONFIG.SUPABASE_URL + '/rest/v1/pipeline_properties?select=*&order=scraped_at.desc', { headers });
  const pData = await pRes.json();

  console.log(`Analyzing ${pData.length} pipeline properties...\n`);

  for (let i = 0; i < pData.length; i++) {
    const p = pData[i];
    let photos = [];
    try { photos = typeof p.original_image_urls === 'string' ? JSON.parse(p.original_image_urls) : (p.original_image_urls || []); } catch {}
    
    console.log(`=== [${i+1}] ${p.id}: ${p.address}, ${p.city}, ${p.state} ${p.zip} ===`);
    console.log(`Rent: $${p.monthly_rent} | Beds: ${p.bedrooms} | Baths: ${p.bathrooms} (half: ${p.half_bathrooms}) | Sqft: ${p.square_footage}`);
    console.log(`Year: ${p.year_built} | Lot: ${p.lot_size_sqft} | Garage: ${p.garage_spaces} | Parking: ${p.parking}`);
    console.log(`Laundry: ${p.laundry_type} | Cooling: ${p.cooling_type} | Heating: ${p.heating_type}`);
    console.log(`Photos: ${photos.length}`);
    console.log(`Raw Desc:\n${p.original_description || p.description}\n`);
    console.log('------------------------------------------------------------\n');
  }
}

main().catch(console.error);
