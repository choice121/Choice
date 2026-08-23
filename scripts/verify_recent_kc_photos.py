import http.client
import json

conn = http.client.HTTPSConnection('tlfmwetmhthpyrytrcfo.supabase.co', timeout=30)
headers = {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE',
    'Accept': 'application/json',
}

props = [
    ("e1a595fe-4b1f-4fe0-ba61-928053f75646", "2010 E 82nd Ter"),
    ("a1bb53c3-08fb-4294-bc2c-ea6be7fb209b", "5311 Garfield Ave"),
    ("9dbcb01c-f098-4fd2-bc33-e8b4997d89c8", "5429 College Ave"),
    ("5c795c16-88f4-459b-ab9a-121f4cbc9a46", "2407 NE 37th Ter")
]

for pid, addr in props:
    conn.request('GET', f'/rest/v1/property_photos?property_id=eq.{pid}&select=*&order=display_order.asc', headers=headers)
    resp = conn.getresponse()
    photos = json.loads(resp.read().decode())
    print(f"\n{addr} ({pid}):")
    print(f"  Photos count: {len(photos)}")
    if photos:
        print(f"  Hero URL: {photos[0].get('url')}")
        print(f"  Alt text: {photos[0].get('alt_text')}")
