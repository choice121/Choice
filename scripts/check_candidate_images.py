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

ids = ["PP-22E7981C", "PP-B9678771", "PP-38CD979B", "PP-43A471D3", "PP-2D86AF71", "PP-28D9AE64", "PP-60665706"]

for pid in ids:
    conn.request('GET', f'/rest/v1/pipeline_properties?id=eq.{pid}&select=*', headers=headers)
    resp = conn.getresponse()
    raw = resp.read().decode()
    items = json.loads(raw)
    if items:
        p = items[0]
        raw_imgs = p.get('original_image_urls')
        imgs = json.loads(raw_imgs) if isinstance(raw_imgs, str) else (raw_imgs or [])
        print(f"\n==========================================")
        print(f"ID: {p.get('id')} | {p.get('address')}, {p.get('city')}, {p.get('state')} {p.get('zip')}")
        print(f"Rent: ${p.get('monthly_rent')} | Beds: {p.get('bedrooms')} | Baths: {p.get('bathrooms')}")
        print(f"Original image URLs count: {len(imgs)}")
        if imgs:
            first_url = imgs[0] if isinstance(imgs[0], str) else imgs[0].get('url')
            print(f"Sample image URL: {first_url}")
        print(f"Description length: {len(p.get('description') or '')}")
        print(f"Description preview: {(p.get('description') or '')[:300]}...")
