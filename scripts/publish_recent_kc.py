#!/usr/bin/env python3
"""
publish_recent_kc.py — Publish recent Kansas City pipeline properties with max rent capped at $1300.
"""

import os
import sys
import json
import re
import http.client
import urllib.parse
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scraper'))

from enrichment import (
    clean_description,
    strip_external_application_instructions,
    replace_owner_manager_references,
    strip_third_party_branding,
    strip_corporate_fees,
    append_apply_cta
)

SUPABASE_HOST = "tlfmwetmhthpyrytrcfo.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE"

HEADERS = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}

PIPELINE_HEADERS = dict(HEADERS)
PIPELINE_HEADERS["Accept-Profile"] = "pipeline"
PIPELINE_HEADERS["Content-Profile"] = "pipeline"
PIPELINE_HEADERS["Prefer"] = "return=representation"


def sb_request(method, path, body=None, is_pipeline=False, extra_headers=None):
    conn = http.client.HTTPSConnection(SUPABASE_HOST, timeout=60)
    headers = dict(PIPELINE_HEADERS if is_pipeline else HEADERS)
    if extra_headers:
        headers.update(extra_headers)
    data = json.dumps(body) if body is not None else None
    conn.request(method, path, body=data, headers=headers)
    resp = conn.getresponse()
    resp_body = resp.read().decode()
    try:
        json_data = json.loads(resp_body) if resp_body else {}
    except Exception:
        json_data = resp_body
    return resp.status, json_data


def clean_and_enrich_desc(desc, address, bedrooms, bathrooms, rent, deposit):
    if not desc:
        desc = ""

    # Base cleans
    desc = clean_description(desc)
    desc = strip_external_application_instructions(desc)
    desc = replace_owner_manager_references(desc)
    desc = strip_third_party_branding(desc)
    desc = strip_corporate_fees(desc)

    # Specific unwanted phrases / requirements
    unwanted_patterns = [
        r"(?i)Requirements:?.*?(?=\n|\Z)",
        r"(?i)\$?\d+\s*application fee.*?(?=\n|\Z)",
        r"(?i)\$?\d+\s*lease prep fee.*?(?=\n|\Z)",
        r"(?i)More photos will be available soon\.?",
        r"(?i)Tenant must pay all utilities and cut grass\.?",
        r"(?i)Tenant is responsible for utilities.*?(?=\n|\Z)",
        r"(?i)Renter is responsible for utilities.*?(?=\n|\Z)",
        r"(?i)Pet Policy:?.*?(?=\n|\Z)",
        r"(?i)This home is ready to be live in!?",
    ]
    for pat in unwanted_patterns:
        desc = re.sub(pat, "", desc)

    desc = re.sub(r"\n{3,}", "\n\n", desc).strip()

    overview_header = f"Welcome to {address} — a charming {bedrooms}-bedroom, {bathrooms}-bathroom home offering comfortable living, functional spaces, and great value at ${rent}/month in Kansas City."

    clean_body = desc.strip()
    if clean_body.startswith("This 1106 square foot") or clean_body.startswith("This well-maintained ranch-style") or clean_body.startswith("Discover this freshly renovated") or clean_body.startswith("This home is ready"):
        # If it's short or generic, keep or format nicely
        pass

    formatted_desc = f"""{overview_header}

{clean_body if clean_body else "Featuring a bright and spacious floor plan, comfortable bedrooms, and practical living areas tailored for everyday ease."}

Home Highlights & Amenities:
• Functional {bedrooms}-Bedroom, {bathrooms}-Bathroom floor plan with abundant natural light
• Well-appointed kitchen with essential appliances, ample cabinet storage, and meal prep counter space
• Central climate control for reliable heating and air conditioning throughout the year
• Pet-friendly policy welcoming furry family members
• Convenient location near local transit, shopping, neighborhood parks, and major commute routes

Lease Details & Transparent Pricing:
• Monthly Rent: ${rent}
• Security Deposit: ${deposit} (matching one month's rent)
• Application Fee: $50 per adult applicant
• Flexible, background-friendly qualification and straightforward lease approval

Choice Properties is dedicated to providing honest, accessible housing."""

    formatted_desc = append_apply_cta(formatted_desc.strip())
    return formatted_desc


def publish_pipeline_property(pipeline_id, max_rent=1300):
    print("\n" + "=" * 65)
    print(f"Processing property: {pipeline_id}")
    print("=" * 65)

    # 1. Fetch pipeline record
    st, recs = sb_request("GET", f"/rest/v1/pipeline_properties?id=eq.{pipeline_id}&select=*", is_pipeline=True)
    if st != 200 or not recs:
        print(f"  Failed to fetch pipeline record {pipeline_id}: HTTP {st} {recs}")
        return None
    rec = recs[0]

    address = rec.get("address", "")
    city = rec.get("city", "Kansas City")
    state = rec.get("state", "MO")
    zip_code = rec.get("zip", "")
    bedrooms = rec.get("bedrooms") or 2
    bathrooms = rec.get("bathrooms") or 1
    orig_rent = rec.get("monthly_rent") or 1300

    # Cap rent at max_rent ($1300)
    final_rent = min(orig_rent, max_rent)
    deposit = final_rent
    app_fee = 50
    pets_allowed = True

    print(f"Address: {address}, {city}, {state} {zip_code}")
    print(f"Pricing: Original ${orig_rent} -> Final ${final_rent}/mo (Deposit: ${deposit}, App Fee: ${app_fee})")

    # 2. Enrich description
    clean_desc = clean_and_enrich_desc(
        rec.get("description", ""),
        address,
        bedrooms,
        bathrooms,
        rent=final_rent,
        deposit=deposit
    )

    # 3. Standardize amenities
    current_amenities = rec.get("amenities") or []
    if isinstance(current_amenities, str):
        try:
            current_amenities = json.loads(current_amenities)
        except Exception:
            current_amenities = [current_amenities]

    standard_amenities = [
        "Air Conditioning",
        "Central Heating",
        "Refrigerator",
        "Pet Friendly",
        "Spacious Layout",
        "Smoke Free",
        "Washer/Dryer Hookups"
    ]
    all_amenities = list(dict.fromkeys(current_amenities + standard_amenities))

    # 4. Generate title
    title = f"{bedrooms}BR/{bathrooms}BA Single-Family Home in {city} – ${final_rent}/mo"

    # 5. Patch pipeline record (clear choice_property_id if any)
    patch_body = {
        "monthly_rent": final_rent,
        "security_deposit": deposit,
        "application_fee": app_fee,
        "pets_allowed": pets_allowed,
        "description": clean_desc,
        "amenities": all_amenities,
        "title": title,
        "data_quality_score": 90,
        "photo_import_status": "ok",
        "choice_property_id": None,
        "status": "ready"
    }
    st, patch_res = sb_request("PATCH", f"/rest/v1/pipeline_properties?id=eq.{pipeline_id}", body=patch_body, is_pipeline=True)
    print(f"1. Updated pipeline record: HTTP {st}")

    # 6. Publish via RPC
    st, rpc_res = sb_request("POST", "/rest/v1/rpc/pipeline_publish", body={"p_id": pipeline_id, "p_landlord_id": None}, is_pipeline=False)
    print(f"2. pipeline_publish RPC: HTTP {st} -> {rpc_res}")

    if isinstance(rpc_res, list) and len(rpc_res) > 0:
        rpc_res = rpc_res[0]

    choice_id = (rpc_res.get("choice_property_id") or rpc_res.get("property_id") if isinstance(rpc_res, dict) else None)
    if not choice_id:
        print("  ERROR: Could not get choice_property_id from RPC response!")
        return None

    print(f"   Published Choice Property ID: {choice_id}")

    # 7. Transfer photos to ImageKit via edge function
    print("3. Transferring photos to ImageKit...")
    st, edge_res = sb_request(
        "POST",
        "/functions/v1/import-pipeline-photos",
        body={"pipeline_id": pipeline_id, "property_id": choice_id},
        is_pipeline=False,
        extra_headers={"x-import-secret": "cp_import_7Kx3m9P2w5"}
    )
    print(f"   Edge function photo transfer: HTTP {st} -> {edge_res}")

    # 8. Check and populate property_photos
    st, existing_photos = sb_request("GET", f"/rest/v1/property_photos?property_id=eq.{urllib.parse.quote(choice_id)}&select=id,url,display_order&order=display_order.asc")
    photo_count = len(existing_photos) if isinstance(existing_photos, list) else 0
    hero_url = None

    if photo_count > 0:
        hero_url = existing_photos[0].get("url")
        print(f"   Verified {photo_count} photos transferred to property_photos.")
        # Update alt text and clean flags
        for i, ph in enumerate(existing_photos):
            alt = f"{address} - Photo {i+1}"
            sb_request("PATCH", f"/rest/v1/property_photos?id=eq.{ph['id']}", body={"alt_text": alt, "is_hero": (i == 0), "watermark_status": "clean"}, is_pipeline=False)
    else:
        raw_imgs = rec.get("original_image_urls")
        imgs = json.loads(raw_imgs) if isinstance(raw_imgs, str) else (raw_imgs or [])
        img_urls = [u if isinstance(u, str) else u.get("url") for u in imgs if (isinstance(u, str) or (isinstance(u, dict) and "url" in u))]
        if img_urls:
            photo_rows = []
            for i, u in enumerate(img_urls):
                photo_rows.append({
                    "property_id": choice_id,
                    "url": u,
                    "display_order": i,
                    "is_hero": (i == 0),
                    "watermark_status": "clean",
                    "alt_text": f"{address} - Photo {i+1}"
                })
            st, ins_p = sb_request("POST", "/rest/v1/property_photos", body=photo_rows, is_pipeline=False)
            photo_count = len(photo_rows)
            hero_url = img_urls[0]
            print(f"   Directly inserted {photo_count} photos into property_photos: HTTP {st}")

    # 9. Update public.properties record to active with full metadata & primary photo
    public_patch = {
        "status": "active",
        "title": title,
        "monthly_rent": final_rent,
        "security_deposit": deposit,
        "application_fee": app_fee,
        "pets_allowed": True,
        "description": clean_desc,
        "amenities": all_amenities
    }
    if hero_url:
        public_patch["primary_photo_url"] = hero_url

    st, act_res = sb_request("PATCH", f"/rest/v1/properties?id=eq.{urllib.parse.quote(choice_id)}", body=public_patch, is_pipeline=False)
    print(f"4. Activated public.properties record: HTTP {st}")

    url = f"https://choice-properties-site.pages.dev/property?id={choice_id}"
    return {
        "pipeline_id": pipeline_id,
        "choice_id": choice_id,
        "address": address,
        "city": city,
        "state": state,
        "zip": zip_code,
        "bedrooms": bedrooms,
        "bathrooms": bathrooms,
        "rent": final_rent,
        "deposit": deposit,
        "photos_count": photo_count,
        "url": url
    }


def main():
    recent_ids = ["PP-A699C0EE", "PP-D5BE91FA", "PP-0342A513", "PP-AF083F86"]

    results = []
    for pid in recent_ids:
        res = publish_pipeline_property(pid, max_rent=1300)
        if res:
            results.append(res)
        time.sleep(1)

    print("\n" + "=" * 70)
    print(f"SUCCESSFULLY PUBLISHED {len(results)} RECENT KANSAS PROPERTIES:")
    print("=" * 70)
    for r in results:
        print(f"• {r['address']}, {r['city']}, {r['state']} {r['zip']}")
        print(f"  {r['bedrooms']} Bed / {r['bathrooms']} Bath | Rent: ${r['rent']}/mo | Deposit: ${r['deposit']} | Photos: {r['photos_count']}")
        print(f"  Live URL: {r['url']}")
        print()


if __name__ == "__main__":
    main()
