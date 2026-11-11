import http.client
import json

conn = http.client.HTTPSConnection('tlfmwetmhthpyrytrcfo.supabase.co', timeout=30)
headers = {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE',
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


