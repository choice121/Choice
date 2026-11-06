import os
import http.client
import json

conn = http.client.HTTPSConnection('tlfmwetmhthpyrytrcfo.supabase.co', timeout=30)
headers = {
    'apikey': os.environ['SUPABASE_SERVICE_ROLE_KEY'],
    'Authorization': f"Bearer {os.environ['SUPABASE_SERVICE_ROLE_KEY']}",
    'Accept': 'application/json',
}

conn.request('GET', '/rest/v1/properties?id=eq.242fc8dd-b96e-46e1-8b16-24a208b09cc9&select=*', headers=headers)
resp = conn.getresponse()
items = json.loads(resp.read().decode())
print("Public property record:")
if items:
    for k, v in items[0].items():
        print(f"  {k}: {str(v)[:80]}")
