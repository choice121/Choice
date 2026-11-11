import os
import http.client
import json

conn = http.client.HTTPSConnection('tlfmwetmhthpyrytrcfo.supabase.co', timeout=30)
headers = {
    'apikey': os.environ['SUPABASE_SERVICE_ROLE_KEY'],
    'Authorization': f"Bearer {os.environ['SUPABASE_SERVICE_ROLE_KEY']}",
    'Accept': 'application/json',
    'Accept-Profile': 'public',
    'Content-Profile': 'public'
}

# Fetch Kansas City properties from public.properties
conn.request('GET', '/rest/v1/properties?city=ilike.*Kansas*&select=*&order=created_at.asc', headers=headers)
resp = conn.getresponse()
raw = resp.read().decode()
print("HTTP status:", resp.status)
try:
    items = json.loads(raw)
except Exception as e:
    print("Error:", e, raw)
    items = []

if isinstance(items, list):
    print(f"=== CURRENT KANSAS CITY PROPERTIES IN PUBLIC.PROPERTIES ({len(items)}) ===")
    for i, p in enumerate(items, 1):
        print(f"#{i} ID: {p.get('id')} | Address: {p.get('address')}, {p.get('city')}, {p.get('state')} {p.get('zip')} | Rent: ${p.get('monthly_rent')} | Deposit: ${p.get('security_deposit')} | AppFee: ${p.get('application_fee')} | Beds: {p.get('bedrooms')} | Baths: {p.get('bathrooms')} | Status: {p.get('status')} | Created: {p.get('created_at')} | Title: {p.get('title')}")
else:
    print("Non-list response:", items)

