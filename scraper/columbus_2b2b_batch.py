#!/usr/bin/env python3
"""
columbus_2b2b_batch.py — Columbus, OH 2-Bath Rental Batch (Choice Properties)
=============================================================================
Target Location  : Search only within Columbus, OH
Property Types   : Single-family houses, Townhomes / townhouses only
Bedrooms         : 2-bedroom or 3-bedroom
Bathrooms        : Exactly 2 bathrooms (2.0)
Source Pricing   : Prioritize ~$1,300–$1,600/month
Published Rent   : Maximum $1,200/month (varied between $1,050 and $1,200)
Security Deposit : Strictly equals published rent
Application Fee  : $50
Available Date   : Immediate / near-term
Pet Policy       : Pet friendly
Photos           : Minimum 6 authentic, non-watermarked photos
Target Count     : 15 qualifying listings

Usage:
  python3 scraper/columbus_2b2b_batch.py --dry-run
  python3 scraper/columbus_2b2b_batch.py --target 15
"""

import argparse
import json
import os
import sys
from typing import Optional, Set

# Ensure scraper package is in python path
sys.path.insert(0, os.path.abspath("scraper"))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pipeline import PipelineOrchestrator, BatchCriteria

COLUMBUS_ZIPS = [
    "43201", "43202", "43203", "43204", "43205", "43206", "43207",
    "43209", "43211", "43212", "43213", "43214", "43215", "43219",
    "43220", "43221", "43222", "43223", "43224", "43227", "43228",
    "43229", "43230", "43231", "43232", "43235"
]

ALLOWED_TYPES = {"SINGLE_FAMILY", "TOWNHOMES"}
BEDS_MIN = 2
BEDS_MAX = 3
BATHS_MIN = 2.0
BATHS_MAX = 2.0
RENT_MIN = 1000
RENT_MAX = 3500
RENT_FLOOR = 1050
RENT_CAP = 1200


def compute_columbus_2b2b_rent(
    original_rent,
    seen_rents: Optional[Set[int]] = None,
):
    """
    Computes a market-attractive, credible published rent <= $1,200/month
    with realistic price variation ($1,050–$1,200).
    Enforces that security deposit strictly equals published rent.
    """
    if original_rent is None:
        return None, None
    rent = float(original_rent)
    if rent < RENT_MIN or rent > RENT_MAX:
        return None, None

    # Map source rent into the $1,075 – $1,200 range
    if rent <= 1200:
        # If source is already <= $1,200, apply slight reduction or keep
        published = min(rent - 25, 1175)
    elif rent <= 1350:
        # Source $1,201 - $1,350 -> $1,100 - $1,150
        ratio = (rent - 1201) / max(1, 1350 - 1201)
        published = 1100 + ratio * (1150 - 1100)
    elif rent <= 1600:
        # Source $1,351 - $1,600 -> $1,150 - $1,195
        ratio = (rent - 1351) / max(1, 1600 - 1351)
        published = 1150 + ratio * (1195 - 1150)
    elif rent <= 2000:
        # Source $1,601 - $2,000 -> $1,175 - $1,200
        ratio = (rent - 1601) / max(1, 2000 - 1601)
        published = 1175 + ratio * (1200 - 1175)
    else:
        # Higher source rent -> $1,195 - $1,200
        published = 1195

    # Round to nearest $5 for natural-looking pricing
    published = round(published / 5) * 5
    published = max(RENT_FLOOR, min(int(published), RENT_CAP))

    # Realistic price variation nudge across the batch
    if seen_rents is not None:
        for nudge in (0, 5, -5, 10, -10, 15, -15, 20, -20, 25, -25):
            candidate = published + nudge
            if RENT_FLOOR <= candidate <= RENT_CAP and candidate not in seen_rents:
                published = candidate
                break

    return int(published), rent


def main():
    parser = argparse.ArgumentParser(description="Columbus, OH 2-bath rental batch")
    parser.add_argument("--dry-run", action="store_true", help="Stop before any DB writes")
    parser.add_argument("--target", type=int, default=15, help="Number of listings to publish")
    parser.add_argument("--past-days", type=int, default=180)
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--min-score", type=int, default=30)
    parser.add_argument("--use-cached-candidates", action="store_true", help="Use freshly scraped candidates file if available")
    args = parser.parse_args()

    criteria = BatchCriteria(
        batch_name="Columbus, OH 2B2B Batch",
        locations=["Columbus, OH"],
        zip_codes=COLUMBUS_ZIPS,
        beds_min=BEDS_MIN,
        beds_max=BEDS_MAX,
        baths_min=BATHS_MIN,
        baths_max=BATHS_MAX,
        rent_min=RENT_MIN,
        rent_max=RENT_MAX,
        rent_floor=RENT_FLOOR,
        rent_cap=RENT_CAP,
        allowed_types=ALLOWED_TYPES,
        target=args.target,
        past_days=args.past_days,
        limit=args.limit,
        min_score=args.min_score,
        pricing_fn=compute_columbus_2b2b_rent,
    )

    orchestrator = PipelineOrchestrator(verbose=True)

    # If we already scraped candidates file in this run, load them to avoid redundant network hits
    candidates_file = "scripts/columbus_available_2b2b.json"
    if args.use_cached_candidates and os.path.exists(candidates_file):
        print(f"Loading {candidates_file}...")
        with open(candidates_file) as f:
            records = json.load(f)
        result = orchestrator.run_records(records, criteria=criteria, dry_run=args.dry_run)
    else:
        result = orchestrator.run(criteria, dry_run=args.dry_run)

    print("\n" + "=" * 65)
    print(f"Result: {result.published} published, {len(result.errors)} errors")
    for u in result.published_urls:
        print(f"  Published URL: {u}")
    print("=" * 65)

    if result.errors and result.published == 0 and not args.dry_run:
        sys.exit(1)


if __name__ == "__main__":
    main()
