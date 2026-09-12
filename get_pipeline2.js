async function run() {
  const SUPABASE_URL = "https://tlfmwetmhthpyrytrcfo.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE";
  
  const addrs = ["293 N Burgess Ave", "1868 Argyle Dr"];
  const res = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?address=in.("${addrs.join('","')}")`, { 
      headers: { 
          'apikey': SUPABASE_KEY, 
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Accept-Profile': 'pipeline'
      } 
  });
  
  if (res.status >= 300) { console.log(res.status, await res.text()); return; }
  
  const data = await res.json();
  data.forEach(d => {
     console.log('Address:', d.address, 'ZPID:', d.zpid);
     console.log('Photos:', d.photos ? d.photos.length : 0);
     if (d.photos && d.photos.length > 0) {
         console.log('Sample photo:', d.photos[0]);
     }
  });
}
run();
