import http.client
import json

conn = http.client.HTTPSConnection('tlfmwetmhthpyrytrcfo.supabase.co', timeout=30)
headers = {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE',
    'Accept': 'application/json',
}

def query(filter_str=""):
    conn.request('GET', f'/rest/v1/properties?select=property_type,laundry_type,cooling_type,heating_type&limit=2000{filter_str}', headers=headers)
    return json.loads(conn.getresponse().read().decode())

data = query()
print(f"Total rows fetched: {len(data)}")

def distinct_values(data, f):
    values = set([d[f] for d in data if d.get(f) is not None])
    print(f"\n--- Distinct {f} ---")
    for v in values:
        print(f" - {v}")

for f in ['property_type', 'laundry_type', 'cooling_type', 'heating_type']:
    distinct_values(data, f)
