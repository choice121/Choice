async function run() {
  const SUPABASE_URL = "https://tlfmwetmhthpyrytrcfo.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE";
  
  const targetId = "0b12ac7f-e316-4d60-8e09-9e362ca73f48";
  const newId = "prop-a1b2c3d4";
  
  const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${targetId}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ id: newId })
  });
  
  console.log("Patch status:", patchRes.status, await patchRes.text());
  
  // revert
  if (patchRes.status < 300) {
    const revertRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${newId}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id: targetId })
    });
    console.log("Revert status:", revertRes.status);
  }
}
run();
