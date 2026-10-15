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

# 1. Fetch all published properties in Kansas City
conn_pub = http.client.HTTPSConnection('tlfmwetmhthpyrytrcfo.supabase.co', timeout=30)
conn_pub.request('GET', '/rest/v1/properties?city=ilike.*Kansas*&select=*&order=created_at.asc', headers=headers)
resp_pub = conn_pub.getresponse()
raw_pub = resp_pub.read().decode()
try:
    pub_props = json.loads(raw_pub)
except Exception as e:
    print("Pub json parse error:", e, raw_pub)
    pub_props = []

if isinstance(pub_props, list):
    print(f"=== CURRENT PUBLISHED KANSAS CITY PROPERTIES ({len(pub_props)}) ===")
    for idx, p in enumerate(pub_props, 1):
        photos_cnt = len(p.get('photos') or [])
        print(f"{idx}. ID: {p.get('id')} | Address: {p.get('address')}, {p.get('city')}, {p.get('state')} {p.get('zip')} | Rent: ${p.get('monthly_rent')} | Beds: {p.get('bedrooms')} | Baths: {p.get('bathrooms')} | Status: {p.get('status')} | Photos: {photos_cnt} | Title: {p.get('title')}")
else:
    print("Pub props error response:", pub_props)


# 2. Fetch all pipeline properties in Kansas City
pipeline_headers = dict(headers)
pipeline_headers['Accept-Profile'] = 'pipeline'
pipeline_headers['Content-Profile'] = 'pipeline'

conn = http.client.HTTPSConnection('tlfmwetmhthpyrytrcfo.supabase.co', timeout=30)
conn.request('GET', '/rest/v1/pipeline_properties?city=ilike.*Kansas*&select=*&order=monthly_rent.asc', headers=pipeline_headers)
resp = conn.getresponse()
raw = resp.read().decode()
pipe_props = json.loads(raw)

print(f"\n=== TOTAL KANSAS CITY PIPELINE PROPERTIES ({len(pipe_props)}) ===")
for idx, p in enumerate(pipe_props, 1):
    photos_cnt = len(p.get('photos') or [])
    print(f"{idx}. ID: {p.get('id')} | Address: {p.get('address')}, {p.get('city')}, {p.get('state')} {p.get('zip')} | Rent: ${p.get('monthly_rent')} | Beds: {p.get('bedrooms')} | Baths: {p.get('bathrooms')} | Status: {p.get('status')} | Photos: {photos_cnt} | Source: {p.get('source')} | Title: {p.get('title')}")

