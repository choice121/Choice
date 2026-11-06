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

ids = ["PP-A699C0EE", "PP-D5BE91FA", "PP-0342A513", "PP-AF083F86"]
for pid in ids:
    conn.request('GET', f'/rest/v1/pipeline_properties?id=eq.{pid}&select=*', headers=headers)
    resp = conn.getresponse()
    p = json.loads(resp.read().decode())[0]
    print(f"\n=================== {pid} | {p.get('address')} ===================")
    print("Rent:", p.get("monthly_rent"), "Bed/Bath:", p.get("bedrooms"), p.get("bathrooms"), "Sqft:", p.get("square_footage"))
    print("Amenities:", p.get("amenities"))
    print("Appliances:", p.get("appliances"))
    print("Full Description:\n", p.get("description"))
