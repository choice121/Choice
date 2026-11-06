import os
import http.client
import json

conn = http.client.HTTPSConnection('tlfmwetmhthpyrytrcfo.supabase.co', timeout=30)
headers = {
    'apikey': os.environ['SUPABASE_SERVICE_ROLE_KEY'],
    'Authorization': f"Bearer {os.environ['SUPABASE_SERVICE_ROLE_KEY']}",
    'Accept': 'application/json'
}

# 1. Check current public properties
conn.request('GET', '/rest/v1/properties?select=*&order=created_at.asc', headers=headers)
resp = conn.getresponse()
raw = resp.read().decode()
try:
    props = json.loads(raw)
except Exception as e:
    print("Error parsing json:", e, raw)
    props = []

if isinstance(props, list):
    print(f'=== CURRENT PUBLIC PROPERTIES ({len(props)}) ===')
    for i, p in enumerate(props, 1):
        print(f"{i}. ID: {p.get('id')} | {p.get('address')}, {p.get('city')}, {p.get('state')} | Rent: ${p.get('monthly_rent')} | Status: {p.get('status')} | Created: {p.get('created_at')}")
else:
    print("Props response was not a list:", props)

# 2. Check pipeline properties in Kansas City / MO / KS
pipeline_headers = dict(headers)
pipeline_headers['Accept-Profile'] = 'pipeline'
pipeline_headers['Content-Profile'] = 'pipeline'

conn2 = http.client.HTTPSConnection('tlfmwetmhthpyrytrcfo.supabase.co', timeout=30)
conn2.request('GET', '/rest/v1/pipeline_properties?or=(state.eq.MO,state.eq.KS,city.ilike.*Kansas*)&select=*&order=monthly_rent.asc', headers=pipeline_headers)
resp2 = conn2.getresponse()
raw2 = resp2.read().decode()
try:
    pipe_props = json.loads(raw2)
except Exception as e:
    print("Error parsing pipe json:", e, raw2)
    pipe_props = []

if isinstance(pipe_props, list):
    print(f'\n=== ALL PIPELINE PROPERTIES IN MO / KS / KANSAS CITY ({len(pipe_props)}) ===')
    for i, p in enumerate(pipe_props, 1):
        photos_cnt = len(p.get('photos') or [])
        print(f"{i}. ID: {p.get('id')} | {p.get('address')}, {p.get('city')}, {p.get('state')} {p.get('zip')} | Rent: ${p.get('monthly_rent')} | {p.get('bedrooms')}bd/{p.get('bathrooms')}ba | {photos_cnt} photos | Status: {p.get('status')} | Source: {p.get('source')}")
else:
    print("Pipeline response was not a list:", pipe_props)

