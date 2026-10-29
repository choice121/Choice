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

conn.request('GET', '/rest/v1/pipeline_properties?id=eq.PP-12DFE359&select=*', headers=headers)
resp = conn.getresponse()
p1 = json.loads(resp.read().decode())[0]

conn.request('GET', '/rest/v1/pipeline_properties?id=eq.PP-22E7981C&select=*', headers=headers)
resp2 = conn.getresponse()
p2 = json.loads(resp2.read().decode())[0]

for k in p1.keys():
    if p1.get(k) != p2.get(k):
        v1 = str(p1.get(k))[:60]
        v2 = str(p2.get(k))[:60]
        print(f"Diff field: {k} -> P1: {v1} | P2: {v2}")
