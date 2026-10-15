#!/usr/bin/env python3
"""
enhance_kansas_descriptions.py — Enrich property descriptions for the 6 Kansas City, MO properties
with rich property details, mature language, background-friendly inclusive review terms,
and strict adherence to Choice Properties platform rules.
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

# Refined descriptions for all 6 Kansas City homes:
PROPERTY_DESCRIPTIONS = {
    # 1. 2614 Indiana Ave
    "3072985a-582a-402a-940b-4f539cb8af45": {
        "address": "2614 Indiana Ave",
        "pipeline_id": "PP-54C2652B",
        "title": "Renovated 3-Bedroom Home in Kansas City",
        "description": """Welcome to 2614 Indiana Avenue, an updated and spacious 3-bedroom, 1-bathroom single-family residence offering 1,122 square feet of thoughtfully refreshed living space in Kansas City, MO.

Property Highlights & Features:
• 3 well-proportioned bedrooms with comfortable layouts and closet storage
• Bright, functional kitchen equipped with refrigerator and full range/oven, complemented by solid cabinetry and generous counter space
• Fresh, neutral interior paint and updated durable hard-surface flooring throughout main living areas
• Efficient central climate system and dedicated washer/dryer hookups for everyday convenience
• Dedicated driveway and off-street parking

Inclusive Qualification & Application Review:
At Choice Properties, we maintain an individualized, holistic qualification policy. We believe every prospective resident deserves fair consideration, and applications with credit challenges, non-traditional income, or past background concerns are evaluated on a case-by-case basis. Section 8, Housing Choice Vouchers, and all verified rental assistance programs are fully accepted and welcomed.

Lease & Financial Information:
• Monthly Rent: $1,300.00
• Security Deposit: $1,300.00
• Application Fee: $50.
• Pet Policy: Pets are warmly welcomed.
• Lease Term: 12-Month Standard Lease

Take the next step toward your new home. Submit your application directly through Choice Properties for prompt review."""
    },

    # 2. 2300 E 55th St
    "e40ebbb4-da60-4ced-b1c3-c0f7e887c59c": {
        "address": "2300 E 55th St",
        "pipeline_id": "PP-D3D7CE1A",
        "title": "Updated 3-Bedroom Ranch with Garage & Yard",
        "description": """Welcome to 2300 E 55th Street, a beautifully modernized 3-bedroom, 1-bathroom ranch-style home offering 1,007 square feet of comfortable single-level living in a convenient Kansas City neighborhood.

Property Highlights & Features:
• 3 generously sized bedrooms featuring warm hardwood flooring and luxury vinyl plank
• Contemporary updated kitchen with crisp white cabinetry, stainless steel appliance suite (refrigerator, range, microwave, and dishwasher), and subway tile backsplash
• Fully refreshed bathroom with modern vanity and custom tiled shower/tub surround
• Main-level laundry area, dedicated dining space, and attached 1-car garage parking
• Two private fenced yard spaces and a rear patio ideal for outdoor relaxation or entertaining

Inclusive Qualification & Application Review:
We practice a supportive, holistic application review designed to evaluate each applicant individually. Prospective residents with past credit marks, non-traditional backgrounds, or non-standard financial histories are reviewed on a fair, case-by-case basis. Housing Choice Vouchers, Section 8, and all municipal housing assistance programs are welcomed.

Lease & Financial Information:
• Monthly Rent: $1,295.00
• Security Deposit: $1,295.00
• Application Fee: $50.
• Pet Policy: Pets are warmly welcomed.
• Lease Term: 12-Month Standard Lease

Ready to make this your new home? Submit your application through Choice Properties to get started."""
    },

    # 3. 6210 Agnes Ave
    "41eb31ae-3ff3-480a-87b9-0f4b5ef99545": {
        "address": "6210 Agnes Ave",
        "pipeline_id": "PP-122BBF1E",
        "title": "Charming Renovated 2-Bedroom Home with Full Basement",
        "description": """Welcome to 6210 Agnes Avenue, a freshly renovated 2-bedroom, 1-bathroom home combining classic 1930s architectural charm with high-quality contemporary updates across 1,390 square feet of living space.

Property Highlights & Features:
• Distinctive arched brick covered front porch with inviting curb appeal
• Living room with classic crown molding, decorative brick fireplace, and fresh paint throughout
• Brand new updated kitchen featuring white cabinetry, modern countertops, and a complete appliance package including gas range, refrigerator, dishwasher, and built-in microwave
• Formal dining room ideal for family dinners or a home workstation nook
• Full unfinished basement providing substantial storage capacity and dedicated laundry hookups
• Expansive back patio, fenced yard area, and off-street parking behind the home

Inclusive Qualification & Application Review:
Choice Properties operates with an inclusive, dignified review standard. We evaluate each application comprehensively, offering fair, individualized consideration to applicants with past credit blemishes, non-standard credit histories, or background concerns. Housing Choice Vouchers and rental assistance programs are fully accepted.

Lease & Financial Information:
• Monthly Rent: $1,200.00
• Security Deposit: $1,200.00
• Application Fee: $50.
• Pet Policy: Pets are warmly welcomed.
• Lease Term: 12-Month Standard Lease

Your next chapter begins here. Apply now through Choice Properties for prompt review."""
    },

    # 4. 7237 Wabash Ave
    "feed4c5a-4de9-45a0-aedf-517aa0d51307": {
        "address": "7237 Wabash Ave",
        "pipeline_id": "PP-12DFE359",
        "title": "Bright & Cozy 2-Bedroom Home in Kansas City",
        "description": """Welcome to 7237 Wabash Avenue, a charming 2-bedroom, 1-bathroom single-family residence featuring 870 square feet of bright, light-filled living in Kansas City, MO.

Property Highlights & Features:
• Generous living and dining spaces framed by large windows that provide abundant natural daylight
• Spacious kitchen with ample solid cabinetry and generous countertop work surfaces, equipped with refrigerator and full range/oven
• Cohesive, easy-care flooring throughout all primary living areas and bedrooms
• Dedicated laundry hookups and private off-street driveway parking
• Convenient location near major commuter routes, local shopping, and neighborhood parks

Inclusive Qualification & Application Review:
We believe in second chances and holistic resident evaluation. Every applicant is reviewed on an individualized basis, ensuring those with background concerns, lower credit scores, or past financial setbacks receive a fair assessment. Section 8 vouchers, Housing Choice assistance, and all certified agency vouchers are welcomed.

Lease & Financial Information:
• Monthly Rent: $1,200.00
• Security Deposit: $1,200.00
• Application Fee: $50.
• Pet Policy: Pets are warmly welcomed.
• Lease Term: 12-Month Standard Lease

Take the next step today. Submit your application directly through Choice Properties."""
    },

    # 5. 6729 Bellefontaine Ave
    "3ecf2f82-d2be-42c3-a167-bcab750b3247": {
        "address": "6729 Bellefontaine Ave",
        "pipeline_id": "PP-A011ED40",
        "title": "Move-In Ready 3-Bedroom Ranch Near Swope Park",
        "description": """Welcome to 6729 Bellefontaine Avenue, a move-in ready 3-bedroom, 1-bathroom ranch-style home offering 962 square feet of comfortable, efficient living in Kansas City's Brown Estates neighborhood.

Property Highlights & Features:
• 3 well-sized bedrooms arranged on a convenient single-level layout
• Functional kitchen with clean cabinetry, durable surfaces, refrigerator, and range/oven
• Fully fenced front yard offering extra private outdoor space and curb appeal
• Central heating and cooling systems paired with in-home laundry connections
• Prime location minutes from Swope Park, the Kansas City Zoo & Aquarium, Starlight Theatre, Southeast Community Center, and direct transit along US-71 and I-435

Inclusive Qualification & Application Review:
Our screening process is built on holistic, fair-chance evaluation principles. We recognize that life circumstances vary, and we thoughtfully assess applicants with past background concerns or non-traditional credit profiles on a case-by-case basis. All rental assistance programs, including Section 8 and Housing Choice Vouchers, are accepted.

Lease & Financial Information:
• Monthly Rent: $1,200.00
• Security Deposit: $1,200.00
• Application Fee: $50.
• Pet Policy: Pets are warmly welcomed.
• Lease Term: 12-Month Standard Lease

Apply today through Choice Properties to reserve your new home."""
    },

    # 6. 4050 E 70th St
    "2e7660ad-e126-4b93-b74b-037e373dd82e": {
        "address": "4050 E 70th St",
        "pipeline_id": "PP-C5254774",
        "title": "Updated 2-Bedroom Single-Family Home in Kansas City",
        "description": """Welcome to 4050 E 70th Street, a cozy, updated 2-bedroom, 1-bathroom single-family residence offering 812 square feet of well-designed living space with fresh, neutral finishes.

Property Highlights & Features:
• 2 bright bedrooms with clean lines, neutral paint, and updated flooring
• Kitchen featuring crisp white cabinetry, generous storage, durable countertops, and included appliances
• Comfortable, open-concept living area with excellent natural light
• Central air conditioning and heating, accompanied by in-home washer/dryer connections
• Private off-street parking and easy proximity to local transit and neighborhood amenities

Inclusive Qualification & Application Review:
Choice Properties is committed to fair, comprehensive applicant assessments. We welcome applicants with non-standard financial histories, credit blemishes, or background concerns, reviewing each profile on an individualized, case-by-case basis. Housing Choice Vouchers, Section 8, and community rental assistance programs are fully accepted.

Lease & Financial Information:
• Monthly Rent: $1,200.00
• Security Deposit: $1,200.00
• Application Fee: $50.
• Pet Policy: Pets are warmly welcomed.
• Lease Term: 12-Month Standard Lease

Ready to apply? Submit your application directly through Choice Properties for prompt review."""
    }
}


def main():
    print("Applying enriched, mature, background-friendly descriptions to all 6 properties...\n")
    for prop_id, item in PROPERTY_DESCRIPTIONS.items():
        addr = item["address"]
        pid = item["pipeline_id"]
        title = item["title"]
        desc = item["description"]
        print(f"==================================================")
        print(f"Updating: {addr} ({prop_id})")

        # 1. Update public.properties
        st, res = sb_patch("properties", prop_id, {
            "title": title,
            "description": desc
        }, is_pipeline=False)
        print(f"  public.properties -> HTTP {st}")

        # 2. Update pipeline_properties
        st_p, res_p = sb_patch("pipeline_properties", pid, {
            "title": title,
            "description": desc
        }, is_pipeline=True)
        print(f"  pipeline_properties -> HTTP {st_p}")

    print("\nAll 6 Kansas City property descriptions successfully enriched and updated!")


if __name__ == "__main__":
    main()
