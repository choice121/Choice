import urllib.request
import json

with open(".env.local") as f:
    env = dict(line.strip().split("=", 1) for line in f if "=" in line and not line.startswith("#"))

url = env.get("SUPABASE_URL")
key = env.get("SUPABASE_SERVICE_ROLE_KEY")

req = urllib.request.Request(
    f"{url}/rest/v1/properties?zip=eq.43229&bedrooms=eq.3&select=id,address,city,zip,monthly_rent,security_deposit,bedrooms,bathrooms,total_bathrooms,property_type,description,amenities,appliances,status,created_at",
    headers={"apikey": key, "Authorization": f"Bearer {key}"}
)
with urllib.request.urlopen(req) as r:
    props = json.loads(r.read().decode("utf-8"))

print(f"Total 3-bed properties in 43229: {len(props)}")
qualifying = []
for p in props:
    prop_id = p["id"]
    baths = p.get("total_bathrooms") or p.get("bathrooms")
    rent = p.get("monthly_rent")
    preq = urllib.request.Request(
        f"{url}/rest/v1/property_photos?property_id=eq.{prop_id}&select=id,url",
        headers={"apikey": key, "Authorization": f"Bearer {key}"}
    )
    with urllib.request.urlopen(preq) as pr:
        photos = json.loads(pr.read().decode("utf-8"))
    
    addr = p["address"]
    bed = p.get("bedrooms")
    dep = p.get("security_deposit")
    print(f"\nAddress: {addr}")
    print(f"  ID: {prop_id}")
    print(f"  Beds: {bed}, Baths: {baths}")
    print(f"  Rent: ${rent}, Deposit: ${dep}")
    print(f"  Photos: {len(photos)}")
    if photos:
        print(f"  First photo: {photos[0]['url'][:70]}...")
    
    # Check criteria: 3 beds, 2 or 2.5 baths, rent 1800-2000, >=6 photos
    if baths in (2, 2.0, 2.5) and 1800 <= rent <= 2000 and len(photos) >= 6:
        qualifying.append(p)

print(f"\n==========================================")
print(f">>> Currently qualifying properties: {len(qualifying)}")
for q in qualifying:
    tb = q.get("total_bathrooms") or q["bathrooms"]
    print(f"  - {q['address']} (${q['monthly_rent']}/mo | {q['bedrooms']}b/{tb}ba) -> {q['id']}")
