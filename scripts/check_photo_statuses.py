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

for pid in ["PP-12DFE359", "PP-54C2652B", "PP-22E7981C"]:
    conn.request('GET', f'/rest/v1/pipeline_properties?id=eq.{pid}&select=id,address,status,photo_import_status,photo_upload_status,photo_cleanup_status', headers=headers)
    resp = conn.getresponse()
    items = json.loads(resp.read().decode())
    print(items)
