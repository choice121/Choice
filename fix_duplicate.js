async function run() {
  const SUPABASE_URL = "https://tlfmwetmhthpyrytrcfo.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE";
  
  const headers = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };
  
  // Mark the un-enriched, non-conforming original ID as inactive/archived
  const duplicateId = "14c68ec5-8cb3-4097-837f-238272dae4bd";
  
  const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${duplicateId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'archived' })
  });
  
  console.log("Archive status:", patchRes.status);
}
run();
