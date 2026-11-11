import os
import http.client
import json
from datetime import datetime, timezone, timedelta

conn = http.client.HTTPSConnection('tlfmwetmhthpyrytrcfo.supabase.co', timeout=30)
headers = {
    'apikey': os.environ['SUPABASE_SERVICE_ROLE_KEY'],
    'Authorization': f"Bearer {os.environ['SUPABASE_SERVICE_ROLE_KEY']}",
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
