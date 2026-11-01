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

# Fetch all scraped after 16:25 UTC
conn.request('GET', '/rest/v1/pipeline_properties?scraped_at=gte.2026-08-14T16:25:00.000Z&select=*&order=scraped_at.desc', headers=headers)
resp = conn.getresponse()
items = json.loads(resp.read().decode())

print(f"Total properties scraped in the last window: {len(items)}")
for p in items:
    print(f"\n========================================================")
    print(f"ID: {p.get('id')} | Status: {p.get('status')}")
    print(f"Address: {p.get('address')}, {p.get('city')}, {p.get('state')} {p.get('zip')}")
    print(f"Rent: ${p.get('monthly_rent')} | Beds: {p.get('bedrooms')} | Baths: {p.get('bathrooms')} | Sqft: {p.get('square_footage')}")
    raw_imgs = p.get('original_image_urls')
    imgs = json.loads(raw_imgs) if isinstance(raw_imgs, str) else (raw_imgs or [])
    print(f"Photos count: {len(imgs)}")
    print(f"Description preview: {(p.get('description') or '')[:200]}...")
