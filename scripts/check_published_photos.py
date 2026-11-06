import os
import http.client
import json

conn = http.client.HTTPSConnection('tlfmwetmhthpyrytrcfo.supabase.co', timeout=30)
headers = {
    'apikey': os.environ['SUPABASE_SERVICE_ROLE_KEY'],
    'Authorization': f"Bearer {os.environ['SUPABASE_SERVICE_ROLE_KEY']}",
    'Accept': 'application/json',
}

for pid in ["242fc8dd-b96e-46e1-8b16-24a208b09cc9", "627344dc-6ccb-4fa8-92e6-c7f8fdbd69a9"]:
    conn.request('GET', f'/rest/v1/property_photos?property_id=eq.{pid}&select=*&order=display_order.asc', headers=headers)
    resp = conn.getresponse()
    photos = json.loads(resp.read().decode())
    print(f"\nProperty {pid} photos count: {len(photos)}")
    if photos:
        print("  Hero photo:", photos[0].get("url"))
        print("  Alt text:", photos[0].get("alt_text"))
