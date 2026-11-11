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

for pid in ["PP-22E7981C", "PP-B9678771", "PP-38CD979B"]:
    conn.request('GET', f'/rest/v1/pipeline_properties?id=eq.{pid}&select=*', headers=headers)
    resp = conn.getresponse()
    raw = resp.read().decode()
    p = json.loads(raw)[0]
    print(f"\n=================== {pid} ===================")
    print("Address:", p.get("address"), p.get("city"), p.get("state"), p.get("zip"))
    print("Rent:", p.get("monthly_rent"), "Bed/Bath:", p.get("bedrooms"), p.get("bathrooms"))
    print("Full Description:\n", p.get("description"))
    print("\nAmenities:\n", p.get("amenities"))
    print("\nRaw data keys:", list((p.get("raw_data") or {}).keys()))
