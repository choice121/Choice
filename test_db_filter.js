const fs = require('fs');

async function run() {
  const SUPABASE_URL = "https://tlfmwetmhthpyrytrcfo.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE";

  const url = `${SUPABASE_URL}/rest/v1/properties?city=eq.Columbus&bedrooms=in.(2,3)&monthly_rent=gte.1000&monthly_rent=lte.1400&select=id,address,city,state,zip,monthly_rent,bedrooms,bathrooms,property_type,status`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  const data = await res.json();
  
  const houses = data.filter(p => {
    const pt = (p.property_type || '').toLowerCase();
    return pt.includes('house') && !pt.includes('townhouse') || pt.includes('single_family') || pt.includes('single family');
  });

  let counter = 1;
  for (const house of houses) {
    if(house.status !== 'active') continue;
    const formattedRent = house.monthly_rent.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    console.log(`${counter}. ${house.address}, ${house.city}, ${house.state} ${house.zip} ($${formattedRent}/mo | ${house.bedrooms} Bed / ${house.bathrooms} Bath) — https://choice-properties-site.pages.dev/property.html?id=${house.id}`);
    
    // Add a blank line between entries as per rule 3 example format? 
    // The rule shows:
    // 1. ...
    //
    // 2. ...
    console.log();
    
    if (counter >= 10) break;
    counter++;
  }
}
run();
