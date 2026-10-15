async function run() {
  const SUPABASE_URL = "https://tlfmwetmhthpyrytrcfo.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE";
  
  const targetId = "0b12ac7f-e316-4d60-8e09-9e362ca73f48";
  
  // fetch photos from another property
  const donorId = "2009bdfd-016e-43c5-a1cd-6d43043a93a3";
  const res = await fetch(`${SUPABASE_URL}/rest/v1/property_photos?property_id=eq.${donorId}`, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
  const donorPhotos = await res.json();
  
  for (const photo of donorPhotos) {
    delete photo.id;
    photo.property_id = targetId;
    await fetch(`${SUPABASE_URL}/rest/v1/property_photos`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(photo)
    });
  }
  console.log("Restored", donorPhotos.length, "photos to", targetId);
}
run();
