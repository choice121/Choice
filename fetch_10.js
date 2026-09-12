const fs = require('fs');
async function run() {
  const SUPABASE_URL = "https://tlfmwetmhthpyrytrcfo.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE";
  
  const ids = [
    "2009bdfd-016e-43c5-a1cd-6d43043a93a3",
    "26febe5b-ef75-480a-9ff1-b9422aa56e3e",
    "PROP-B3F4F1CD",
    "PROP-09B6CBF4",
    "PROP-1738B099",
    "83b9bf7a-a174-49ce-8309-2e79d71bae7a",
    "0b12ac7f-e316-4d60-8e09-9e362ca73f48",
    "cf79b604-a004-4ca6-8b1a-7de2f1ab7cd3",
    "3e474851-b13d-4c72-b6b1-4bc8934174c8",
    "743ecfdf-0500-463d-a88e-502ee54dfb27"
  ];
  
  const url = `${SUPABASE_URL}/rest/v1/properties?id=in.(${ids.join(',')})`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  
  const data = await res.json();
  fs.writeFileSync('props.json', JSON.stringify(data, null, 2));
  console.log(`Fetched ${data.length} properties.`);
}
run();
