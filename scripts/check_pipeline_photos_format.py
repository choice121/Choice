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

conn.request('GET', '/rest/v1/pipeline_properties?photos=not.is.null&select=id,address,photos,image_transfer_status&limit=5', headers=headers)
resp = conn.getresponse()
raw = resp.read().decode()
try:
    items = json.loads(raw)
except Exception as e:
    print("Error:", e, raw)
    items = []

if isinstance(items, list):
    print(f"Properties with photos not null: {len(items)}")
    for p in items:
        print(p.get("id"), p.get("address"), "transfer_status:", p.get("image_transfer_status"))
        print("photos sample:", json.dumps(p.get("photos"))[:200])
else:
    print("Items response:", items)

