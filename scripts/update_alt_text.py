import http.client
import json
import urllib.parse

conn = http.client.HTTPSConnection('tlfmwetmhthpyrytrcfo.supabase.co', timeout=30)
headers = {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE',
    'Content-Type': 'application/json',
    'Accept': 'application/json'
}

props = [
    {"id": "242fc8dd-b96e-46e1-8b16-24a208b09cc9", "address": "3639 Agnes Ave, Kansas City, MO"},
    {"id": "627344dc-6ccb-4fa8-92e6-c7f8fdbd69a9", "address": "1515 N 75th Dr, Kansas City, KS"}
]

for p in props:
    conn.request('GET', f'/rest/v1/property_photos?property_id=eq.{p["id"]}&select=id,display_order&order=display_order.asc', headers=headers)
    resp = conn.getresponse()
    photos = json.loads(resp.read().decode())
    print(f"Updating alt text for {len(photos)} photos on {p['address']}")
    for i, ph in enumerate(photos):
        alt = f"{p['address']} - Photo {i+1}"
        patch_body = json.dumps({"alt_text": alt, "is_hero": (i == 0), "watermark_status": "clean"})
        conn.request('PATCH', f'/rest/v1/property_photos?id=eq.{ph["id"]}', body=patch_body, headers=headers)
        r = conn.getresponse()
        r.read()

print("Alt text updated successfully.")
