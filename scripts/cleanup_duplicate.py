import os
import http.client
import json

conn = http.client.HTTPSConnection('tlfmwetmhthpyrytrcfo.supabase.co', timeout=30)
headers = {
    'apikey': os.environ['SUPABASE_SERVICE_ROLE_KEY'],
    'Authorization': f"Bearer {os.environ['SUPABASE_SERVICE_ROLE_KEY']}",
    'Accept': 'application/json',
}

dup_id = "fddd5956-87b9-4d70-b272-d86a70727929"
conn.request('DELETE', f'/rest/v1/property_photos?property_id=eq.{dup_id}', headers=headers)
r1 = conn.getresponse()
print("Delete dup photos:", r1.status)
r1.read()

conn.request('DELETE', f'/rest/v1/properties?id=eq.{dup_id}', headers=headers)
r2 = conn.getresponse()
print("Delete dup property:", r2.status)
r2.read()
