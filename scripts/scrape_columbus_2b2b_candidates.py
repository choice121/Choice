#!/usr/bin/env python3
"""
scrape_columbus_2b2b_candidates.py
Scrapes Realtor.com across all Columbus, OH ZIP codes to find:
- Location: Columbus, OH
- Types: SINGLE_FAMILY, TOWNHOMES only
- Bedrooms: 2 or 3 only
- Bathrooms: exactly 2 bathrooms (2.0)
- Authentic photos: >= 6
- Source rent: prioritized around $1,300–$1,600 / month
"""

import sys
import os
import json
import time

sys.path.insert(0, os.path.abspath("scraper"))
from homeharvest import scrape_property
from scraper import _map_realtor_property, _enrich_realtor_batch

COLUMBUS_ZIPS = [
    "43201", "43202", "43203", "43204", "43205", "43206", "43207",
    "43209", "43211", "43212", "43213", "43214", "43215", "43219",
    "43220", "43221", "43222", "43223", "43224", "43227", "43228",
    "43229", "43230", "43231", "43232", "43235"
]

all_candidates = []
seen_addresses = set()

print(f"Starting scrape across {len(COLUMBUS_ZIPS)} Columbus ZIP codes...")

for i, zip_code in enumerate(COLUMBUS_ZIPS, 1):
    loc_str = f"{zip_code}, OH"
    print(f"[{i}/{len(COLUMBUS_ZIPS)}] Scraping {loc_str}...")
    try:
        props = scrape_property(
            location=loc_str,
            listing_type="for_rent",
            past_days=180,
            return_type="pydantic",
            limit=100,
            beds_min=2,
            beds_max=3,
            extra_property_data=True,
        )
        print(f"   Returned {len(props)} raw listings")
        for p in props:
            desc = getattr(p, "description", None)
            style_obj = getattr(desc, "style", None) if desc else None
            style_str = style_obj.value if hasattr(style_obj, "value") else str(style_obj or "")
            style_upper = style_str.upper()

            # Rule: Only SINGLE_FAMILY and TOWNHOMES
            if style_upper not in ("SINGLE_FAMILY", "TOWNHOMES"):
                continue

            mapped = _map_realtor_property(p)
            if not mapped:
                continue

            city = (mapped.get("city") or "").strip()
            # Rule: Columbus only
            if "columbus" not in city.lower():
                continue

            addr = (mapped.get("address") or "").strip()
            if not addr:
                continue
            addr_key = addr.lower()
            if addr_key in seen_addresses:
                continue

            beds = mapped.get("bedrooms")
            if beds not in (2, 3):
                continue

            baths = mapped.get("total_bathrooms") or mapped.get("bathrooms")
            # Rule: EXACTLY 2 bathrooms (2.0)
            if baths not in (2, 2.0):
                continue

            photos = []
            try:
                photos = json.loads(mapped.get("original_image_urls") or "[]")
            except Exception:
                pass

            # Rule: At least 6 photos
            if len(photos) < 6:
                continue

            seen_addresses.add(addr_key)
            all_candidates.append(mapped)
            rent = mapped.get("monthly_rent")
            print(f"   ✓ MATCH ({len(all_candidates)}): {addr}, {city} {mapped.get('zip')} | {style_upper} | {beds}bd/{baths}ba | ${rent}/mo | {len(photos)} photos")

    except Exception as e:
        print(f"   Error in {loc_str}: {e}")
    time.sleep(0.5)

print(f"\nTotal qualifying candidates found: {len(all_candidates)}")

# Now enrich candidate batch with detail pages to ensure complete amenities/appliances/text
print("Enriching batch with detail pages...")
try:
    all_candidates = _enrich_realtor_batch(all_candidates, verbose=True)
except Exception as e:
    print(f"Enrichment warning: {e}")

out_path = "scripts/columbus_scraped_2b2b_candidates.json"
with open(out_path, "w") as f:
    json.dump(all_candidates, f, indent=2)

print(f"Saved {len(all_candidates)} candidates to {out_path}")
