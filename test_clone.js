async function run() {
  const SUPABASE_URL = "https://tlfmwetmhthpyrytrcfo.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE";
  
  const targetId = "0b12ac7f-e316-4d60-8e09-9e362ca73f48";
  
  // fetch prop
  const res = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${targetId}`, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
  const props = await res.json();
  const p = props[0];
  
  // modify
  const newId = "prop-" + Math.random().toString(16).substr(2, 8);
  p.id = newId;
  p.monthly_rent = 1050;
  p.security_deposit = 1050;
  
  delete p.search_tsv;
  
  const postRes = await fetch(`${SUPABASE_URL}/rest/v1/properties`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(p)
  });
  
  console.log("Clone status:", postRes.status, await postRes.text());
  
  if (postRes.status < 300) {
    await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${newId}`, {
      method: 'DELETE',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
  }
}
run();
