import http.client
import json

conn = http.client.HTTPSConnection('tlfmwetmhthpyrytrcfo.supabase.co', timeout=30)
headers = {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE',
    'Accept': 'application/json',
}

def query(filter_str=""):
    conn.request('GET', f'/rest/v1/properties?select=id,pets_allowed,amenities,parking,property_type,utilities_included,has_central_air,cooling_type,heating_type,laundry_type&limit=200{filter_str}', headers=headers)
    return json.loads(conn.getresponse().read().decode())

data = query()
print(f"Total rows fetched: {len(data)}")

def analyze(data, f):
    values = [d[f] for d in data if d.get(f) is not None]
    print(f"\n--- {f} ---")
    print(f"Populated in {len(values)}/{len(data)} records.")
    if values:
        print(f"Type: {type(values[0]).__name__}")
        # count occurrences of list items if list, else string occurrences
        if isinstance(values[0], list):
            flat = [item for sublist in values for item in sublist]
            from collections import Counter
            print(f"Sample items: {Counter(flat).most_common(5)}")
        else:
            from collections import Counter
            print(f"Sample items: {Counter(values).most_common(5)}")

for f in ['pets_allowed', 'amenities', 'parking', 'property_type', 'has_central_air', 'cooling_type', 'heating_type', 'laundry_type', 'utilities_included']:
    analyze(data, f)
