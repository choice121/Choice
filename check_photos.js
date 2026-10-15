async function run() {
  const SUPABASE_URL = "https://tlfmwetmhthpyrytrcfo.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE";
  const getHeaders = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` };
  
  const targetId = "prop-0e836f1c";
  
  const res = await fetch(`${SUPABASE_URL}/rest/v1/property_photos?property_id=eq.${targetId}`, { headers: getHeaders });
  const data = await res.json();
  console.log(`Photos for ${targetId}:`, data.length);
  if (data.length > 0) {
      console.log(data[0]);
  }
}
run();
