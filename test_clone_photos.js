async function run() {
  const SUPABASE_URL = "https://tlfmwetmhthpyrytrcfo.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE";
  
  const targetId = "0b12ac7f-e316-4d60-8e09-9e362ca73f48";
  
  const res = await fetch(`${SUPABASE_URL}/rest/v1/property_photos?property_id=eq.${targetId}`, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
  const photos = await res.json();
  
  if (photos.length > 0) {
    const photo = photos[0];
    delete photo.id;
    // we need a new fake property for the FK
    const newId = "prop-" + Math.random().toString(16).substr(2, 8);
    const pRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${targetId}`, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
    const p = (await pRes.json())[0];
    p.id = newId; delete p.search_tsv;
    await fetch(`${SUPABASE_URL}/rest/v1/properties`, { method: 'POST', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
    
    photo.property_id = newId;
    
    const photoRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(photo)
    });
    console.log("Photo clone status:", photoRes.status, await photoRes.text());
    
    await fetch(`${SUPABASE_URL}/rest/v1/property_photos?property_id=eq.${newId}`, { method: 'DELETE', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
    await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${newId}`, { method: 'DELETE', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
  }
}
run();
