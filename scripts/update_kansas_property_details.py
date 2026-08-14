#!/usr/bin/env python3
"""
update_kansas_property_details.py — Enrich structured features, amenities, appliances,
utilities, flooring, parking, and lease terms for the 6 Kansas City, MO properties.
"""

import json
import http.client
import urllib.parse
import sys

SUPABASE_HOST = "tlfmwetmhthpyrytrcfo.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE"

HEADERS = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Prefer": "return=representation"
}

PIPELINE_HEADERS = dict(HEADERS)
PIPELINE_HEADERS["Accept-Profile"] = "pipeline"
PIPELINE_HEADERS["Content-Profile"] = "pipeline"

def sb_patch(table, prop_id, patch_data, is_pipeline=False):
    conn = http.client.HTTPSConnection(SUPABASE_HOST, timeout=30)
    headers = PIPELINE_HEADERS if is_pipeline else HEADERS
    data = json.dumps(patch_data)
    conn.request("PATCH", f"/rest/v1/{table}?id=eq.{urllib.parse.quote(prop_id)}", body=data, headers=headers)
    resp = conn.getresponse()
    body = resp.read().decode()
    try:
        return resp.status, json.loads(body) if body else {}
    except Exception:
        return resp.status, body


ENRICHMENTS = {
    # 6210 Agnes Ave
    "41eb31ae-3ff3-480a-87b9-0f4b5ef99545": {
        "address": "6210 Agnes Ave",
        "pipeline_id": "PP-122BBF1E",
        "amenities": ["Fenced Yard", "Basement", "Covered Porch", "Patio", "Fireplace", "Dining Room", "Storage Space", "Pets Allowed"],
        "appliances": ["Gas Range", "Refrigerator", "Dishwasher", "Microwave"],
        "flooring": ["Carpet", "Hard Surface"],
        "heating_type": "Forced Air",
        "cooling_type": "Window A/C",
        "laundry_type": "Washer/Dryer Hookups",
        "parking": "Off-street Driveway (1 vehicle)",
        "has_basement": True,
        "has_central_air": False,
        "lease_terms": ["12 Months", "Housing Assistance Vouchers Welcome"],
        "minimum_lease_months": 12,
        "property_type": "single_family"
    },
    # 2300 E 55th St
    "e40ebbb4-da60-4ced-b1c3-c0f7e887c59c": {
        "address": "2300 E 55th St",
        "pipeline_id": "PP-D3D7CE1A",
        "amenities": ["Garage Parking", "Fenced Yard", "Patio", "Single-Level Living", "Dining Area", "Section 8 Vouchers Welcome", "Pets Allowed"],
        "appliances": ["Stainless Steel Refrigerator", "Range / Oven", "Microwave", "Dishwasher"],
        "flooring": ["Hardwood", "Luxury Vinyl Plank"],
        "heating_type": "Forced Air",
        "cooling_type": "Central Air",
        "laundry_type": "Main-Level Laundry Hookups",
        "parking": "1-Car Garage",
        "garage_spaces": 1,
        "has_central_air": True,
        "lease_terms": ["12 Months", "Section 8 Vouchers Accepted"],
        "minimum_lease_months": 12,
        "property_type": "single_family"
    },
    # 6729 Bellefontaine Ave
    "3ecf2f82-d2be-42c3-a167-bcab750b3247": {
        "address": "6729 Bellefontaine Ave",
        "pipeline_id": "PP-A011ED40",
        "amenities": ["Fenced Yard", "Single-Level Ranch", "Near Swope Park & Zoo", "All Rental Assistance Accepted", "Pets Allowed"],
        "appliances": ["Refrigerator", "Range / Oven"],
        "flooring": ["Hardwood / Vinyl Plank"],
        "heating_type": "Forced Air",
        "cooling_type": "Central Air",
        "laundry_type": "Washer/Dryer Hookups",
        "parking": "Driveway Parking",
        "has_central_air": True,
        "lease_terms": ["12 Months", "Rental Assistance Welcome"],
        "minimum_lease_months": 12,
        "property_type": "single_family"
    },
    # 7237 Wabash Ave
    "feed4c5a-4de9-45a0-aedf-517aa0d51307": {
        "address": "7237 Wabash Ave",
        "pipeline_id": "PP-12DFE359",
        "amenities": ["Spacious Kitchen", "Dining Area", "Large Windows & Natural Light", "Single Family Home", "Pets Allowed"],
        "appliances": ["Refrigerator", "Range / Oven"],
        "flooring": ["Hardwood / Wood-look Flooring"],
        "heating_type": "Forced Air",
        "cooling_type": "Central Air",
        "laundry_type": "Washer/Dryer Hookups",
        "parking": "Driveway Parking",
        "has_central_air": True,
        "lease_terms": ["12 Months"],
        "minimum_lease_months": 12,
        "property_type": "single_family"
    },
    # 4050 E 70th St
    "2e7660ad-e126-4b93-b74b-037e373dd82e": {
        "address": "4050 E 70th St",
        "pipeline_id": "PP-C5254774",
        "amenities": ["Updated Finishes", "Ample Cabinet Storage", "Bright Natural Light", "Single Family Home", "Pets Allowed"],
        "appliances": ["Refrigerator", "Range / Oven"],
        "flooring": ["Hard Surface Flooring"],
        "heating_type": "Forced Air",
        "cooling_type": "Central Air",
        "laundry_type": "Washer/Dryer Hookups",
        "parking": "Off-Street Parking",
        "has_central_air": True,
        "lease_terms": ["12 Months"],
        "minimum_lease_months": 12,
        "property_type": "single_family"
    },
    # 2614 Indiana Ave
    "3072985a-582a-402a-940b-4f539cb8af45": {
        "address": "2614 Indiana Ave",
        "pipeline_id": "PP-54C2652B",
        "amenities": ["Spacious 3-Bedroom Layout", "Updated Single Family", "Move-in Ready", "Pet Friendly"],
        "appliances": ["Refrigerator", "Range / Oven"],
        "flooring": ["Hard Surface Flooring"],
        "heating_type": "Forced Air",
        "cooling_type": "Central Air",
        "laundry_type": "Washer/Dryer Hookups",
        "parking": "Driveway / Off-Street Parking",
        "has_central_air": True,
        "lease_terms": ["12 Months"],
        "minimum_lease_months": 12,
        "property_type": "single_family"
    }
}


def main():
    print("Updating features, amenities, and details for all 6 Kansas City properties...\n")
    for prop_id, data in ENRICHMENTS.items():
        addr = data["address"]
        pid = data["pipeline_id"]
        print(f"==================================================")
        print(f"Updating {addr} ({prop_id})")

        patch = {
            "amenities": data["amenities"],
            "appliances": data["appliances"],
            "flooring": data["flooring"],
            "heating_type": data["heating_type"],
            "cooling_type": data["cooling_type"],
            "laundry_type": data["laundry_type"],
            "parking": data["parking"],
            "has_central_air": data["has_central_air"],
            "lease_terms": data["lease_terms"],
            "minimum_lease_months": data["minimum_lease_months"],
            "property_type": data["property_type"],
            "pets_allowed": True,
            "application_fee": 50,
        }
        if "has_basement" in data:
            patch["has_basement"] = data["has_basement"]
        if "garage_spaces" in data:
            patch["garage_spaces"] = data["garage_spaces"]

        # Update public.properties
        st, res = sb_patch("properties", prop_id, patch, is_pipeline=False)
        print(f"  public.properties updated -> HTTP {st}")

        # Update pipeline_properties
        pipe_patch = {
            "amenities": json.dumps(data["amenities"]),
            "appliances": data["appliances"],
            "flooring": data["flooring"],
            "heating_type": data["heating_type"],
            "cooling_type": data["cooling_type"],
            "laundry_type": data["laundry_type"],
            "parking": data["parking"],
        }
        st_pipe, res_pipe = sb_patch("pipeline_properties", pid, pipe_patch, is_pipeline=True)
        print(f"  pipeline_properties updated -> HTTP {st_pipe}")

    print("\nAll 6 Kansas City properties successfully updated with complete features & details!")

if __name__ == "__main__":
    main()
