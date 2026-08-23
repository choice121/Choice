#!/usr/bin/env python3
"""
publish_kansas_city_batch.py — Clean, enrich, and publish Kansas City, MO pipeline properties < $1350.
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
    apply_enrichment_pipeline,
    validate_for_publish,
    is_watermarked,
    watermark_reason,
    clean_description,
    strip_external_application_instructions,
    replace_owner_manager_references,
    strip_third_party_branding,
    strip_corporate_fees,
    normalize_application_fee_in_description,
    enforce_price_consistency,
    append_apply_cta,
    rule_based_enrich,
    filter_record_photos,
    _rescore,
)

SUPABASE_HOST = "tlfmwetmhthpyrytrcfo.supabase.co"
SUPABASE_URL = f"https://{SUPABASE_HOST}"
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


def sb_request(method, path, body=None, is_pipeline=False):
    conn = http.client.HTTPSConnection(SUPABASE_HOST, timeout=30)
    headers = PIPELINE_HEADERS if is_pipeline else HEADERS
    data = json.dumps(body) if body is not None else None
    conn.request(method, path, body=data, headers=headers)
    resp = conn.getresponse()
    resp_body = resp.read().decode()
    try:
        json_data = json.loads(resp_body) if resp_body else {}
    except Exception:
        json_data = resp_body
    return resp.status, json_data


def clean_kansas_city_description(desc, monthly_rent, deposit):
    """
    Perform rigorous deep cleaning of description text according to Choice Properties rules.
    """
    if not desc:
        desc = ""

    # 1. Clean description using standard enrichment cleaners
    desc = clean_description(desc)
    desc = strip_external_application_instructions(desc)
    desc = replace_owner_manager_references(desc)
    desc = strip_third_party_branding(desc)
    desc = strip_corporate_fees(desc)

    # 2. Specific external portal and broker cleanup
    patterns_to_remove = [
        r"(?i)For more properties like this visit Affordable Housing\.?",
        r"(?i)Schedule your tour or apply today:?.*$",
        r"(?i)Shockwave Properties",
        r"(?i)\$150 Admin fee",
        r"(?i)Admin fee:?\s*\$?\d+",
        r"(?i)Minimum \d+ months lease requirement",
        r"(?i)Pet Deposit \$?\d+ non-refundable",
        r"(?i)Pet rent monthly \$?\d+",
        r"(?i)Both For more properties.*$",
        r"(?i)Apply today and\s*$",
    ]
    for pat in patterns_to_remove:
        desc = re.sub(pat, "", desc)

    # 3. Clean up any fragmented sentences or broken endings
    desc = re.sub(r"Adjacent living areas are filled with natural light and showcase updated flooring and freshly pa\s*",
                  "Adjacent living areas are filled with natural light and showcase updated flooring and freshly painted walls. ", desc)
    desc = re.sub(r"Both\s*\.?\s*$", "", desc)

    # 4. Standard normalize app fee & rent consistency
    desc = normalize_application_fee_in_description(desc)
    desc = enforce_price_consistency(desc, monthly_rent)

    # 5. Collapse excessive whitespace
    desc = re.sub(r"\n{3,}", "\n\n", desc).strip()

    # 6. Apply CTA
    desc = append_apply_cta(desc)
    return desc


def main():
    print("Fetching Kansas City, MO properties < 1350 from pipeline...")
    status, records = sb_request(
        "GET",
        "/rest/v1/pipeline_properties?state=eq.MO&city=eq.Kansas%20City&monthly_rent=lt.1350&status=neq.archived&select=*",
        is_pipeline=True
    )
    
    if status != 200 or not isinstance(records, list):
        print(f"Error fetching pipeline records: {status} {records}")
        sys.exit(1)

    print(f"Found {len(records)} candidate properties in Kansas City, MO < $1350:")
    for r in records:
        print(f"  - [{r.get('id')}] {r.get('address')} (Rent: ${r.get('monthly_rent')}, Status: {r.get('status')})")

    results = []

    for rec in records:
        pipeline_id = rec["id"]
        address = rec.get("address", "")
        orig_rent = rec.get("monthly_rent")
        print(f"\n=======================================================")
        print(f"Processing: {address} ({pipeline_id})")
        print(f"Original rent: ${orig_rent}")

        # Pricing rule:
        # If rent is from 1300 to 1390, reduce/set to 1300
        new_rent = orig_rent
        if 1300 <= orig_rent <= 1390:
            new_rent = 1300
        
        deposit = new_rent
        app_fee = 50
        pets_allowed = True

        rec["monthly_rent"] = new_rent
        rec["security_deposit"] = deposit
        rec["application_fee"] = app_fee
        rec["pets_allowed"] = pets_allowed

        print(f"New pricing: Rent=${new_rent}, Deposit=${deposit}, AppFee=${app_fee}, PetsAllowed={pets_allowed}")

        # Check watermarks
        if is_watermarked(rec):
            reason = watermark_reason(rec)
            print(f"  WARNING: Watermark detected ({reason})")

        # Enrich features & amenities
        rule_based_enrich(rec)
        filter_record_photos(rec)

        # Clean description
        clean_desc = clean_kansas_city_description(rec.get("description", ""), new_rent, deposit)
        rec["description"] = clean_desc

        # Validate for publish
        ok, failures = validate_for_publish(rec)
        print(f"Pre-publish validation: {'PASSED' if ok else 'FAILED'}")
        if not ok:
            print(f"  Validation failures: {failures}")
            continue

        # Step 1: Update pipeline_properties
        patch_body = {
            "monthly_rent": new_rent,
            "security_deposit": deposit,
            "application_fee": app_fee,
            "pets_allowed": pets_allowed,
            "description": clean_desc,
            "amenities": rec.get("amenities"),
            "data_quality_score": 85,
        }
        st, patch_res = sb_request(
            "PATCH",
            f"/rest/v1/pipeline_properties?id=eq.{pipeline_id}",
            body=patch_body,
            is_pipeline=True
        )
        print(f"1. Updated pipeline record: HTTP {st}")

        # Step 2: Publish via pipeline_publish RPC
        st, rpc_res = sb_request(
            "POST",
            "/rest/v1/rpc/pipeline_publish",
            body={"p_id": pipeline_id, "p_landlord_id": None},
            is_pipeline=False
        )
        print(f"2. pipeline_publish RPC: HTTP {st} -> {rpc_res}")
        if isinstance(rpc_res, list) and len(rpc_res) > 0:
            rpc_res = rpc_res[0]
        
        choice_id = (rpc_res.get("choice_property_id") or rpc_res.get("property_id") if isinstance(rpc_res, dict) else None)
        if not choice_id:
            print(f"  ERROR: Could not get choice_property_id from RPC response!")
            continue

        print(f"   Published with Choice Property ID: {choice_id}")

        # Step 3: Activate property in public.properties
        st, act_res = sb_request(
            "PATCH",
            f"/rest/v1/properties?id=eq.{urllib.parse.quote(choice_id)}",
            body={"status": "active", "pets_allowed": True, "application_fee": 50},
            is_pipeline=False
        )
        print(f"3. Activated property: HTTP {st}")

        # Step 4: Import photos via edge function
        print(f"4. Triggering photo transfer to ImageKit...")
        st, img_res = sb_request(
            "POST",
            "/functions/v1/import-pipeline-photos",
            body={"pipeline_id": pipeline_id, "property_id": choice_id},
            is_pipeline=False
        )
        print(f"   Photo transfer response: HTTP {st} -> {img_res}")

        # URL format:
        site_url = f"https://choice-properties-site.pages.dev/property?id={choice_id}"
        results.append({
            "pipeline_id": pipeline_id,
            "choice_id": choice_id,
            "address": address,
            "city": rec.get("city"),
            "state": rec.get("state"),
            "zip": rec.get("zip"),
            "bedrooms": rec.get("bedrooms"),
            "bathrooms": rec.get("bathrooms"),
            "rent": new_rent,
            "url": site_url
        })
        time.sleep(1)

    print("\n" + "=" * 70)
    print(f"SUCCESSFULLY PROCESSED AND PUBLISHED {len(results)} PROPERTIES:")
    print("=" * 70)
    for res in results:
        print(f"• {res['address']}, {res['city']}, {res['state']} {res['zip']}")
        print(f"  Bedrooms: {res['bedrooms']} | Bathrooms: {res['bathrooms']} | Rent: ${res['rent']}/mo")
        print(f"  URL: {res['url']}\n")


if __name__ == "__main__":
    main()
