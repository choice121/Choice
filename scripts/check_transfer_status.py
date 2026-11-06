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

conn.request('GET', '/rest/v1/pipeline_properties?select=id,address,image_transfer_status,status&limit=10', headers=headers)
resp = conn.getresponse()
items = json.loads(resp.read().decode())
for p in items:
    print(p)
