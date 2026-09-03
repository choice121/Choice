import http.client
import json

conn = http.client.HTTPSConnection('tlfmwetmhthpyrytrcfo.supabase.co', timeout=30)
headers = {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE',
    'Accept': 'application/json',
}
conn.request('GET', '/rest/v1/properties?select=*&limit=30', headers=headers)
resp = conn.getresponse()
data = json.loads(resp.read().decode())

if not data:
    print("No data")
    exit()

keys = list(data[0].keys())
print("Available columns:", ", ".join(keys))

fields = ['pets_allowed', 'amenities', 'parking', 'property_type', 'utilities_included', 'features', 'has_central_air', 'cooling_features', 'heating_features', 'location_features', 'has_w_d', 'bathrooms', 'bedrooms', 'monthly_rent', 'rent_monthly', 'city']

print("\nSample values:")
for f in fields:
    print(f"\n--- {f} ---")
    if f in keys:
        values = [d[f] for d in data if d.get(f) is not None]
        print(f"Populated in {len(values)}/{len(data)} records.")
        if values:
            print(f"Type: {type(values[0]).__name__}")
            print(f"Sample (up to 5): {values[:5]}")
    else:
        print("NOT FOUND IN SCHEMA")
