const fs = require('fs');
async function run() {
  const SUPABASE_URL = "https://tlfmwetmhthpyrytrcfo.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE";
  
  // Just query to see what ID format exists for rent <= 1100
  const url = `${SUPABASE_URL}/rest/v1/properties?monthly_rent=lte.1100&limit=5&select=id,monthly_rent`;
  const res = await fetch(url, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
  console.log("Existing <= 1100 IDs:", await res.json());
}
run();
