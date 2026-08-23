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

# Clear choice_property_id
conn.request('PATCH', '/rest/v1/pipeline_properties?id=eq.PP-22E7981C', body=json.dumps({"choice_property_id": None, "status": "ready"}), headers=headers)
resp = conn.getresponse()
print("Patch status:", resp.status)
resp.read()

# Try pipeline_publish RPC
headers_pub = dict(headers)
del headers_pub['Accept-Profile']
del headers_pub['Content-Profile']
conn2 = http.client.HTTPSConnection('tlfmwetmhthpyrytrcfo.supabase.co', timeout=30)
conn2.request('POST', '/rest/v1/rpc/pipeline_publish', body=json.dumps({"p_id": "PP-22E7981C", "p_landlord_id": None}), headers=headers_pub)
resp2 = conn2.getresponse()
print("RPC status:", resp2.status)
print("RPC body:", resp2.read().decode())

