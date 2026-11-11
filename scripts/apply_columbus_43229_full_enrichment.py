#!/usr/bin/env python3
"""
Apply Full Enrichment to Columbus, OH (ZIP 43229) Top 10 Properties in Supabase

Ensures:
- Rich, highly descriptive listing descriptions (~2,800 characters each).
- Complete harmony and 100% match between the description text and the database fields.
- AGENTS.md Rule 13: NO mentions of security deposit in listing description.
- AGENTS.md Rule 14: NO mentions of lease terms or minimum lease duration in description or properties table.
- Enriched structured fields: neighborhood, location_context, county, parking, garage_spaces,
  has_basement, has_central_air, heating_type, cooling_type, laundry_type, flooring, appliances,
  amenities, pets_allowed, pet_types_allowed, pet_deposit, pet_details, application_fee=50,
  security_deposit=monthly_rent, minimum_income_multiplier=2.5.
"""

import json
import urllib.request
import urllib.error
import sys

# Load Supabase credentials
with open(".env.local") as f:
    env = dict(line.strip().split("=", 1) for line in f if "=" in line and not line.startswith("#"))

SUPABASE_URL = env["SUPABASE_URL"]
SUPABASE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"]

from test_enrichment_data import PROPERTIES_ENRICHMENT_DATA, build_rich_harmonized_description

def patch_supabase_property(prop_id, payload):
    url = f"{SUPABASE_URL}/rest/v1/properties?id=eq.{prop_id}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Prefer": "return=representation"
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="PATCH")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, json.loads(body) if body else []
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8")
        print(f"HTTP Error {e.code} for property {prop_id}: {err}")
        return e.code, err
    except Exception as ex:
        print(f"Exception for property {prop_id}: {ex}")
        return 500, str(ex)

def main():
    print("================================================================================")
    print("Applying Full Enrichment to Columbus, OH 43229 Top 10 Properties")
    print("================================================================================")

    success_count = 0
    for idx, p in enumerate(PROPERTIES_ENRICHMENT_DATA, start=1):
        prop_id = p["id"]
        addr = p["address"]
        desc = build_rich_harmonized_description(p)
        title = f"{p['bedrooms']} Bed / {p['total_bathrooms']:g} Bath Single-Family Home in Columbus, OH"

        payload = {
            "title": title,
            "description": desc,
            "neighborhood": p["neighborhood"],
            "location_context": p["location_context"],
            "county": p["county"],
            "monthly_rent": p["monthly_rent"],
            "security_deposit": p["security_deposit"],
            "application_fee": p["application_fee"],
            "bedrooms": p["bedrooms"],
            "bathrooms": p["bathrooms"],
            "half_bathrooms": p["half_bathrooms"],
            "total_bathrooms": p["total_bathrooms"],
            "square_footage": p["square_footage"],
            "garage_spaces": p["garage_spaces"],
            "parking": p["parking"],
            "has_basement": p["has_basement"],
            "has_central_air": p["has_central_air"],
            "heating_type": p["heating_type"],
            "cooling_type": p["cooling_type"],
            "laundry_type": p["laundry_type"],
            "flooring": p["flooring"],
            "appliances": p["appliances"],
            "amenities": p["amenities"],
            "pets_allowed": True,
            "pet_types_allowed": ["Dogs", "Cats"],
            "pet_deposit": 300,
            "pet_details": "Pet friendly: dogs and cats welcome with standard $300 pet deposit.",
            "smoking_allowed": False,
            "lease_terms": None,
            "minimum_lease_months": None,
            "minimum_income_multiplier": 2.5,
            "minimum_credit_score": 580,
            "showing_instructions": "Contact Choice Properties or submit an application online to schedule a private showing.",
            "status": "active"
        }

        print(f"[{idx}/10] Updating {addr} ({prop_id})...")
        status, res = patch_supabase_property(prop_id, payload)
        if status in (200, 204) and (isinstance(res, list) and len(res) > 0 or status == 204):
            print(f"  ✓ Success! Updated {addr} (Rent: ${p['monthly_rent']}, Beds: {p['bedrooms']}, Baths: {p['total_bathrooms']}, Sqft: {p['square_footage']}, Desc length: {len(desc)} chars)")
            success_count += 1
        else:
            print(f"  ✗ Failed to update {addr}: Status {status}, Response: {res}")

    print(f"\nCompleted: {success_count}/10 properties fully enriched.")
    if success_count != len(PROPERTIES_ENRICHMENT_DATA):
        sys.exit(1)

if __name__ == "__main__":
    main()
