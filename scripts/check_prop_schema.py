import os
import http.client
import json

conn = http.client.HTTPSConnection('tlfmwetmhthpyrytrcfo.supabase.co', timeout=30)
headers = {
    'apikey': os.environ['SUPABASE_SERVICE_ROLE_KEY'],
    'Authorization': f"Bearer {os.environ['SUPABASE_SERVICE_ROLE_KEY']}",
    'Accept': 'application/json',
}

conn.request('GET', '/rest/v1/properties?id=eq.e1a595fe-4b1f-4fe0-ba61-928053f75646&select=*', headers=headers)
resp = conn.getresponse()
print("Get prop status:", resp.status)
data = json.loads(resp.read().decode())
if data:
    for k, v in data[0].items():
        print(f"  {k}: {repr(v)[:80]}")
