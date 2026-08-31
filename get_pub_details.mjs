const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE';

async function main() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/properties?city=eq.Birmingham&select=id,address,city,state,zip,monthly_rent,bedrooms,bathrooms&order=created_at.desc`, {
        headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY }
    });
    const json = await res.json();
    json.forEach((p, i) => {
        // filter out old ones if any, but we just need the newly generated uuids
        if (p.id.length > 20) {
           console.log(`- ${p.address}, ${p.city}, ${p.state} ${p.zip} ($${p.monthly_rent}/mo | ${p.bedrooms} Bed / ${p.bathrooms} Bath) — https://choice-properties-site.pages.dev/property.html?id=${p.id}`);
        }
    });
}
main();
