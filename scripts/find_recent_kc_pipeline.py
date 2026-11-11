import http.client
import json
from datetime import datetime, timezone, timedelta

conn = http.client.HTTPSConnection('tlfmwetmhthpyrytrcfo.supabase.co', timeout=30)
headers = {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE',
    'Accept': 'application/json',
    'Accept-Profile': 'pipeline',
    'Content-Profile': 'pipeline'
}

# Fetch pipeline properties ordered by scraped_at or created_at desc
conn.request('GET', '/rest/v1/pipeline_properties?select=id,address,city,state,zip,monthly_rent,bedrooms,bathrooms,status,scraped_at,source&order=scraped_at.desc&limit=30', headers=headers)
resp = conn.getresponse()
items = json.loads(resp.read().decode())

print(f"Top 30 most recent pipeline properties (by scraped_at):")
for i, p in enumerate(items, 1):
    print(f"{i}. ID: {p.get('id')} | {p.get('address')}, {p.get('city')}, {p.get('state')} | Rent: ${p.get('monthly_rent')} | Status: {p.get('status')} | Scraped: {p.get('scraped_at')} | Source: {p.get('source')}")
