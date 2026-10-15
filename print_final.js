const fs = require('fs');
async function run() {
  const SUPABASE_URL = "https://tlfmwetmhthpyrytrcfo.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE";
  
  const getHeaders = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` };
  
  const addresses = [
    "48 S Richardson Ave",
    "1245 Sandlin Ave",
    "3451 Clarkston Ave",
    "151 S Eureka Ave",
    "293 N Burgess Ave",
    "1868 Argyle Dr",
    "1256 E 15th Ave",
    "5950 Brady Dr",
    "4365 Glenmawr Ave",
    "3067 Neil Ave"
  ];
  
  const url = `${SUPABASE_URL}/rest/v1/properties?address=in.(${addresses.map(a => `"${a}"`).join(',')})&select=id,address,city,state,zip,monthly_rent,bedrooms,bathrooms`;
  const res = await fetch(url, { headers: getHeaders });
  let data = await res.json();
  
  // Sort them exactly as they were in the original list
  data.sort((a, b) => addresses.indexOf(a.address) - addresses.indexOf(b.address));
  
  data.forEach((p, index) => {
    const formattedRent = p.monthly_rent.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    console.log(`${index + 1}. ${p.address}, ${p.city}, ${p.state} ${p.zip} ($${formattedRent}/mo | ${p.bedrooms} Bed / ${p.bathrooms} Bath) — https://choice-properties-site.pages.dev/property.html?id=${p.id}\n`);
  });
}
run();
