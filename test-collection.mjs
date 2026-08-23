const supabaseUrl = 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE';

async function run() {
  const propsRes = await fetch(`${supabaseUrl}/rest/v1/properties?status=eq.active&select=id&limit=10`, {
    headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
  });
  const props = await propsRes.json();
  const ids = props.map(p => p.id);
  
  const insertRes = await fetch(`${supabaseUrl}/rest/v1/client_collections`, {
    method: 'POST',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      client_name: 'Verification Test (10 Properties)',
      property_ids: ids
    })
  });
  const insertData = await insertRes.json();
  console.log("MATCH_ID=" + insertData[0].id);
}
run();
