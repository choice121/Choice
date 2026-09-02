#!/usr/bin/env python3
"""
dfw_replace_one.py — Remove 4-bed listing and publish 1 replacement (2–3 beds)
"""
import os, sys, requests
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scraper import _load_dotenv
_load_dotenv()

from pipeline import PipelineOrchestrator, BatchCriteria

SUPABASE_URL     = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
HEADERS = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

BAD_ID = "6eb8120c-8810-447c-b22d-480270f60b7b"  # 9661 Limestone Dr — 4 beds

def deactivate(prop_id):
    r = requests.patch(
        f"{SUPABASE_URL}/rest/v1/properties?id=eq.{prop_id}",
        headers=HEADERS,
        json={"status": "inactive"},
    )
    r.raise_for_status()
    print(f"✅ Deactivated {prop_id}")

def compute_dfw_rent(original_rent, seen_rents=None):
    if original_rent is None:
        return None, None
    rent = float(original_rent)
    if rent < 1400 or rent > 1600:
        return None, None
    # Map to $1,270–$1,299 range (slot between existing prices)
    from typing import Optional, Set
    ratio     = (rent - 1400) / (1600 - 1400)
    published = 1299 - ratio * (1299 - 1270)
    published = round(published)
    published = max(1270, min(int(published), 1299))
    if seen_rents:
        for nudge in (0, -1, 1, -2, 2, -3, 3, -5, 5, -7, 7, -10, 10):
            c = published + nudge
            if 1270 <= c <= 1299 and c not in seen_rents:
                published = c
                break
    return int(published), rent

def main():
    # 1. Deactivate the 4-bed listing
    print(f"\nDeactivating 4-bed listing {BAD_ID} ...")
    deactivate(BAD_ID)

    # 2. Scrape 1 replacement: 2–3 bed house/townhouse in DFW, $1,400–$1,600
    print("\nScraping 1 replacement listing ...\n")
    criteria = BatchCriteria(
        batch_name="Dallas–Fort Worth, TX (replacement)",
        locations=["Dallas, TX", "Fort Worth, TX", "Arlington, TX", "Grand Prairie, TX"],
        fallback_locations=["Irving, TX", "Garland, TX", "Mesquite, TX"],
        beds_min=2,
        beds_max=3,
        baths_min=1.0,
        rent_min=1400,
        rent_max=1600,
        rent_floor=1270,
        rent_cap=1299,
        allowed_types={"SINGLE_FAMILY", "TOWNHOMES"},
        target=1,
        past_days=90,
        limit=150,
        min_score=40,
        pricing_fn=compute_dfw_rent,
    )
    result = PipelineOrchestrator(verbose=True).run(criteria, dry_run=False)
    if result.published_urls:
        print(f"\n✅ Replacement published: {result.published_urls[0]}")
    else:
        print("\n⚠️  No replacement found in this run — try running dfw_batch.py again")

if __name__ == "__main__":
    main()
