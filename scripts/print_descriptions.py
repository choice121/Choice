import urllib.request, json

with open(".env.local") as f:
    env = dict(line.strip().split("=", 1) for line in f if "=" in line and not line.startswith("#"))
url = env["SUPABASE_URL"]
key = env["SUPABASE_SERVICE_ROLE_KEY"]

with open("published_columbus_43229_results.json") as f:
    results = json.load(f)

for r in results:
    pid = r["id"]
    req = urllib.request.Request(f"{url}/rest/v1/properties?id=eq.{pid}", headers={
        "apikey": key, "Authorization": f"Bearer {key}"
    })
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))[0]
        addr = data["address"]
        base = data.get("has_basement")
        gar = data.get("garage_spaces")
        park = data.get("parking")
        rent = data.get("monthly_rent")
        beds = data.get("bedrooms")
        baths = data.get("total_bathrooms")
        sqft = data.get("square_footage")
        desc = data.get("description") or ""
        print("==================================================")
        print(f"{addr} | DB: Rent=${rent}, Beds={beds}, Baths={baths}, Sqft={sqft}, Basement={base}, Garage={gar}")
        print("--- DESCRIPTION ---")
        print(desc)
