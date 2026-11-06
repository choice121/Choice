import os
import http.client
import json

conn = http.client.HTTPSConnection('tlfmwetmhthpyrytrcfo.supabase.co', timeout=30)
headers = {
    'apikey': os.environ['SUPABASE_SERVICE_ROLE_KEY'],
    'Authorization': f"Bearer {os.environ['SUPABASE_SERVICE_ROLE_KEY']}",
    'Accept': 'application/json',
    'Accept-Profile': 'pipeline',
    'Content-Profile': 'pipeline'
}

for pid in ["PP-12DFE359", "PP-22E7981C", "PP-B9678771"]:
    conn.request('GET', f'/rest/v1/pipeline_properties?id=eq.{pid}&select=*', headers=headers)
    resp = conn.getresponse()
    raw = resp.read().decode()
    items = json.loads(raw)
    if items:
        p = items[0]
        print(f"\n--- {pid} ---")
        print("photos:", p.get("photos"))
        print("image_transfer_status:", p.get("image_transfer_status"))
        print("original_image_urls type/len:", type(p.get("original_image_urls")), len(p.get("original_image_urls") or []))
