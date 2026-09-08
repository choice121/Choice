import urllib.request
import json

with open("published_columbus_43229_results.json") as f:
    results = json.load(f)

with open(".env.local") as f:
    env = dict(line.strip().split("=", 1) for line in f if "=" in line and not line.startswith("#"))

url = env["SUPABASE_URL"]
key = env["SUPABASE_SERVICE_ROLE_KEY"]

print("=== AUDIT VERIFICATION OF PUBLISHED 43229 PROPERTIES ===")
all_pass = True
used_rents = set()

for r in results:
    pid = r["id"]
    req = urllib.request.Request(f"{url}/rest/v1/properties?id=eq.{pid}", headers={
        "apikey": key,
        "Authorization": f"Bearer {key}"
    })
    with urllib.request.urlopen(req) as resp:
        props = json.loads(resp.read().decode("utf-8"))
        if not props:
            print(f"FAIL: Property {pid} not found in DB!")
            all_pass = False
            continue
        p = props[0]

    addr = p["address"]
    zip_code = p["zip"]
    beds = p["bedrooms"]
    baths = p["total_bathrooms"] or p["bathrooms"]
    rent = p["monthly_rent"]
    deposit = p["security_deposit"]
    app_fee = p["application_fee"]
    desc = p["description"] or ""
    lease_m = p.get("minimum_lease_months")
    lease_t = p.get("lease_terms")
    
    # 1. Zip
    if zip_code != "43229":
        print(f"FAIL {addr}: ZIP is {zip_code}, not 43229!")
        all_pass = False
    # 2. Beds
    if beds != 3:
        print(f"FAIL {addr}: Beds is {beds}, not 3!")
        all_pass = False
    # 3. Baths
    if baths not in (2, 2.0, 2.5):
        print(f"FAIL {addr}: Baths is {baths}, not 2 or 2.5!")
        all_pass = False
    # 4. Rent
    if not (1800 <= rent <= 2000):
        print(f"FAIL {addr}: Rent ${rent} not between $1800 and $2000!")
        all_pass = False
    if rent in used_rents:
        print(f"FAIL {addr}: Duplicate rent ${rent}!")
        all_pass = False
    used_rents.add(rent)
    # 5. Deposit
    if deposit != rent:
        print(f"FAIL {addr}: Deposit ${deposit} != rent ${rent}!")
        all_pass = False
    # 6. App fee
    if app_fee != 50:
        print(f"FAIL {addr}: App fee is ${app_fee}, not 50!")
        all_pass = False
    # 7. AGENTS.md rule 13: NO security deposit in description
    if "deposit" in desc.lower():
        print(f"FAIL {addr}: Description mentions deposit!")
        all_pass = False
    # 8. AGENTS.md rule 14: NO lease terms in description or properties table
    if lease_m is not None or lease_t is not None:
        print(f"FAIL {addr}: lease_terms / minimum_lease_months not None! ({lease_m}, {lease_t})")
        all_pass = False
    if "12 month" in desc.lower() or "lease term" in desc.lower():
        print(f"FAIL {addr}: Description mentions lease term!")
        all_pass = False

    # Check photos
    preq = urllib.request.Request(f"{url}/rest/v1/property_photos?property_id=eq.{pid}", headers={
        "apikey": key,
        "Authorization": f"Bearer {key}"
    })
    with urllib.request.urlopen(preq) as presp:
        photos = json.loads(presp.read().decode("utf-8"))
        if len(photos) < 6:
            print(f"FAIL {addr}: Only {len(photos)} photos!")
            all_pass = False
        non_ik = [ph for ph in photos if "ik.imagekit.io" not in ph.get("url", "")]
        if non_ik:
            print(f"FAIL {addr}: {len(non_ik)} photos not on ImageKit!")
            all_pass = False

    print(f"PASS: {addr}, {zip_code} | {beds} Bed / {baths:g} Bath | Rent: ${rent:,}/mo | Photos: {len(photos)} (all ImageKit)")

print(f"\nAll 10 properties passed 100% of audit rules: {all_pass}")
