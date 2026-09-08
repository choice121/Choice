#!/usr/bin/env python3
"""
Comprehensive Audit & Verification Script for Columbus, OH (ZIP 43229) Full Enrichment

Checks:
1. Supabase live data for all 10 properties.
2. 100% alignment between property structured attributes and description content.
3. Strict compliance with AGENTS.md Rule 13 (zero security deposit mentions in description).
4. Strict compliance with AGENTS.md Rule 14 (zero lease term mentions in description and DB).
5. Application fee is $50.
6. Pets allowed is True (dogs & cats).
7. Photo count >= 6 all hosted on ImageKit.
8. Status is 'active'.
"""

import json
import urllib.request
import re
import sys

with open(".env.local") as f:
    env = dict(line.strip().split("=", 1) for line in f if "=" in line and not line.startswith("#"))

SUPABASE_URL = env["SUPABASE_URL"]
SUPABASE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"]

def fetch_property(prop_id):
    url = f"{SUPABASE_URL}/rest/v1/properties?id=eq.{prop_id}&select=*,property_photos(*)"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        return data[0] if data else None

def main():
    with open("published_columbus_43229_results.json") as f:
        target_list = json.load(f)

    print("================================================================================")
    print("AUDITING FULL ENRICHMENT FOR COLUMBUS, OH 43229 PROPERTIES")
    print("================================================================================")

    all_passed = True
    audit_results = []

    for idx, t in enumerate(target_list, start=1):
        prop_id = t["id"]
        p = fetch_property(prop_id)
        if not p:
            print(f"[{idx}] ✗ FAILED: Property {prop_id} not found in Supabase!")
            all_passed = False
            continue

        addr = p["address"]
        rent = p["monthly_rent"]
        deposit = p["security_deposit"]
        app_fee = p["application_fee"]
        beds = p["bedrooms"]
        baths = p["total_bathrooms"]
        sqft = p["square_footage"]
        gar = p["garage_spaces"]
        has_base = p["has_basement"]
        has_ac = p["has_central_air"]
        nbr = p["neighborhood"]
        loc_ctx = p["location_context"]
        flooring = p.get("flooring") or []
        appliances = p.get("appliances") or []
        amenities = p.get("amenities") or []
        desc = p.get("description") or ""
        photos = p.get("property_photos") or []
        ik_photos = [ph for ph in photos if "ik.imagekit.io" in ph.get("url", "")]

        issues = []

        # 1. Financial check
        if deposit != rent:
            issues.append(f"Security deposit (${deposit}) != monthly rent (${rent}) in DB")
        if app_fee != 50:
            issues.append(f"Application fee is ${app_fee}, expected 50")
        if not (1800 <= rent <= 2000):
            issues.append(f"Rent ${rent} not in $1,800–$2,000 range")

        # 2. AGENTS.md Rule 13: NO security deposit in description
        if "security deposit" in desc.lower():
            issues.append("Security deposit explicitly mentioned in description (Rule 13 violation)")
        # Check general deposit phrases in desc (excluding pet deposit)
        clean_desc_check = desc.lower().replace("pet deposit", "")
        if "deposit" in clean_desc_check:
            issues.append("Non-pet deposit mention found in description (Rule 13 violation)")

        # 3. AGENTS.md Rule 14: NO lease terms in description or DB
        if p.get("lease_terms") is not None:
            issues.append(f"lease_terms in DB is not None: {p.get('lease_terms')}")
        if p.get("minimum_lease_months") is not None:
            issues.append(f"minimum_lease_months in DB is not None: {p.get('minimum_lease_months')}")
        if any(term in desc.lower() for term in ["lease term", "12-month", "12 month", "1-year", "1 year", "one-year", "one year"]):
            issues.append("Lease term mentioned in description (Rule 14 violation)")

        # 4. Description content matches DB attributes
        if f"${rent:,}" not in desc:
            issues.append(f"Rent ${rent:,} not stated accurately in description")
        if f"{sqft:,}" not in desc:
            issues.append(f"Sqft {sqft:,} not stated accurately in description")
        if f"{beds} generous bedrooms" not in desc and f"{beds} bedrooms" not in desc:
            issues.append(f"Bedrooms ({beds}) not accurately stated in description")
        if nbr not in desc:
            issues.append(f"Neighborhood '{nbr}' not found in description")
        if f"attached {gar}-car garage" not in desc:
            issues.append(f"Garage capacity ({gar}-car) not matched in description")
        if has_base and "basement" not in desc.lower():
            issues.append("Basement is True in DB but missing from description")
        if not has_base and "basement" in desc.lower():
            issues.append("Basement is False in DB but mentioned in description")

        # 5. Enrichment fields completeness
        if not nbr:
            issues.append("neighborhood is missing/empty in DB")
        if not loc_ctx:
            issues.append("location_context is missing/empty in DB")
        if not flooring:
            issues.append("flooring array is empty in DB")
        if not appliances:
            issues.append("appliances array is empty in DB")
        if not amenities or len(amenities) < 8:
            issues.append(f"amenities array has only {len(amenities)} items")
        if not p.get("pets_allowed"):
            issues.append("pets_allowed is False")
        if p.get("smoking_allowed"):
            issues.append("smoking_allowed is True")
        if len(ik_photos) < 6:
            issues.append(f"ImageKit photos count ({len(ik_photos)}) < 6")
        if p.get("status") != "active":
            issues.append(f"Status is '{p.get('status')}', expected 'active'")

        if issues:
            all_passed = False
            print(f"[{idx}] ✗ {addr} FAILED with {len(issues)} issues:")
            for iss in issues:
                print(f"    - {iss}")
        else:
            print(f"[{idx}] ✓ {addr} PASSED (Rent: ${rent}, {beds}bd/{baths}ba, {sqft} sqft, {len(ik_photos)} IK photos, Desc: {len(desc)} chars)")
            audit_results.append({
                "address": addr,
                "rent": rent,
                "beds": beds,
                "baths": baths,
                "sqft": sqft,
                "neighborhood": nbr,
                "garage_spaces": gar,
                "has_basement": has_base,
                "photos_count": len(ik_photos),
                "url": f"https://choice-properties-site.pages.dev/property.html?id={prop_id}"
            })

    print("\n--------------------------------------------------------------------------------")
    if all_passed:
        print("ALL 10 PROPERTIES 100% VERIFIED & FULLY ENRICHED!")
    else:
        print("SOME PROPERTIES FAILED AUDIT CHECKS.")
        sys.exit(1)

if __name__ == "__main__":
    main()
