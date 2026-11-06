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

conn.request('GET', '/rest/v1/pipeline_properties?limit=1', headers=headers)
resp = conn.getresponse()
items = json.loads(resp.read().decode())
print("Keys in pipeline_properties:")
if items and isinstance(items, list):
    print(list(items[0].keys()))
else:
    print(items)
