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
        print("-----------------------------------------")
        addr = data["address"]
        rent = data["monthly_rent"]
        beds = data["bedrooms"]
        baths = data["total_bathrooms"]
        sqft = data["square_footage"]
        gar = data.get("garage_spaces")
        park = data.get("parking")
        base = data.get("has_basement")
        ac = data.get("has_central_air")
        nbr = data.get("neighborhood")
        app = data.get("appliances")
        flr = data.get("flooring")
        amen = data.get("amenities")
        desc_len = len(data.get("description") or "")
        desc = data.get("description") or ""
        print(f"{addr} ({pid})")
        print(f"  Rent: ${rent} | Beds: {beds} | Baths: {baths} | Sqft: {sqft}")
        print(f"  Garage: {gar} | Parking: {park}")
        print(f"  Basement: {base} | AC: {ac}")
        print(f"  Neighborhood: {nbr}")
        print(f"  Appliances: {app}")
        print(f"  Flooring: {flr}")
        print(f"  Amenities count: {len(amen or [])}")
        print(f"  Desc length: {desc_len}")
        print(f"  Desc snippet: {desc[:120]}...")
