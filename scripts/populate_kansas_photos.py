#!/usr/bin/env python3
"""
populate_kansas_photos.py — Insert photos into property_photos for the 6 published Kansas City properties.
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
}

PIPELINE_HEADERS = dict(HEADERS)
PIPELINE_HEADERS["Accept-Profile"] = "pipeline"
PIPELINE_HEADERS["Content-Profile"] = "pipeline"

def sb_req(method, path, body=None, is_pipeline=False):
    conn = http.client.HTTPSConnection(SUPABASE_HOST, timeout=30)
    headers = PIPELINE_HEADERS if is_pipeline else HEADERS
    data = json.dumps(body) if body is not None else None
    conn.request(method, path, body=data, headers=headers)
    resp = conn.getresponse()
    body_data = resp.read().decode()
    try:
        return resp.status, json.loads(body_data) if body_data else {}
    except Exception:
        return resp.status, body_data


def main():
    # Target 6 pipeline IDs
    pipeline_ids = [
        "PP-12DFE359",
        "PP-C5254774",
        "PP-A011ED40",
        "PP-54C2652B",
        "PP-122BBF1E",
        "PP-D3D7CE1A"
    ]

    status, recs = sb_req(
        "GET",
        f"/rest/v1/pipeline_properties?id=in.({','.join(pipeline_ids)})&select=*",
        is_pipeline=True
    )
    if status != 200:
        print(f"Error fetching pipeline records: {status} {recs}")
        sys.exit(1)

    for rec in recs:
        pid = rec["id"]
        prop_id = rec.get("choice_property_id")
        addr = rec.get("address", "")
        print(f"\n==========================================")
        print(f"Processing photos for {addr} (Pipeline: {pid}, Property: {prop_id})")

        if not prop_id:
            print("  ERROR: Missing choice_property_id!")
            continue

        raw_imgs = rec.get("original_image_urls")
        imgs = json.loads(raw_imgs) if isinstance(raw_imgs, str) else (raw_imgs or [])
        img_urls = []
        for item in imgs:
            if isinstance(item, str):
                img_urls.append(item)
            elif isinstance(item, dict) and "url" in item:
                img_urls.append(item["url"])

        print(f"  Found {len(img_urls)} source photos.")

        # Check existing photos
        st, existing = sb_req("GET", f"/rest/v1/property_photos?property_id=eq.{urllib.parse.quote(prop_id)}&select=id")
        if isinstance(existing, list) and len(existing) > 0:
            print(f"  Property already has {len(existing)} photos in property_photos.")
            continue

        # Insert photo rows
        photo_rows = []
        for i, u in enumerate(img_urls):
            photo_rows.append({
                "property_id": prop_id,
                "url": u,
                "display_order": i,
                "is_hero": (i == 0),
                "watermark_status": "pending",
                "alt_text": f"{addr} - photo {i+1}"
            })

        if photo_rows:
            st, insert_res = sb_req(
                "POST",
                "/rest/v1/property_photos",
                body=photo_rows,
                is_pipeline=False
            )
            print(f"  Inserted {len(photo_rows)} photo rows -> HTTP {st}")
        else:
            print("  No photos to insert.")

    print("\nPhoto insertion check complete!")

if __name__ == "__main__":
    main()
