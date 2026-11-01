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
  console.log(`Fetched ${pData.length} records from pipeline.pipeline_properties\n`);

  pData.forEach((p, i) => {
    let photos = [];
    try {
      photos = typeof p.original_image_urls === 'string' ? JSON.parse(p.original_image_urls) : (p.original_image_urls || []);
    } catch {}
    let orig = {};
    try {
      orig = typeof p.original_data === 'string' ? JSON.parse(p.original_data) : (p.original_data || {});
    } catch {}
    
    console.log(`[${i+1}] ${p.id}`);
    console.log(`    Address:  ${p.address}, ${p.city}, ${p.state} ${p.zip}`);
    console.log(`    Title:    ${p.title}`);
    console.log(`    Specs:    $${p.monthly_rent}/mo | ${p.bedrooms} bd | ${p.bathrooms} ba (half: ${p.half_bathrooms}) | ${p.square_footage} sqft`);
    console.log(`    Type:     ${p.property_type} | Year: ${p.year_built} | Lot: ${p.lot_size_sqft} | Garage: ${p.garage_spaces} | Parking: ${p.parking}`);
    console.log(`    Laundry:  ${p.laundry_type} | Cooling: ${p.cooling_type} | Heating: ${p.heating_type}`);
    console.log(`    Photos:   ${photos.length} photos`);
    console.log(`    Desc:     ${(p.description || '').slice(0, 100)}...`);
    console.log('');
  });
}

main().catch(console.error);
