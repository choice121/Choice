import http.client
import json

conn = http.client.HTTPSConnection('tlfmwetmhthpyrytrcfo.supabase.co', timeout=30)
headers = {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE',
    'Accept': 'application/json',
    'Accept-Profile': 'pipeline',
    'Content-Profile': 'pipeline'
}

ids = ["PP-A699C0EE", "PP-D5BE91FA", "PP-0342A513", "PP-AF083F86"]
for pid in ids:
    conn.request('GET', f'/rest/v1/pipeline_properties?id=eq.{pid}&select=*', headers=headers)
    resp = conn.getresponse()
    p = json.loads(resp.read().decode())[0]
    print(f"\n=================== {pid} | {p.get('address')} ===================")
    print("Rent:", p.get("monthly_rent"), "Bed/Bath:", p.get("bedrooms"), p.get("bathrooms"), "Sqft:", p.get("square_footage"))
    print("Amenities:", p.get("amenities"))
    print("Appliances:", p.get("appliances"))
    print("Full Description:\n", p.get("description"))
