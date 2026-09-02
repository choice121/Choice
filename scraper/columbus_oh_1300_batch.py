#!/usr/bin/env python3
"""
columbus_oh_1300_batch.py — Columbus, OH Rental Batch ($1,300 cap)
===================================================================
Target markets  : Columbus, OH metro area
Property types  : Townhouses (TOWNHOMES) — priority; Houses (SINGLE_FAMILY)
                  NO Apartments, Condos, Duplexes
Bedrooms        : 2–3
Bathrooms       : 1–2 (min 1.0, max 2.0)
Rent range      : $1,300–$1,600 / month (scraped); max published $1,300

Pricing tiers (this batch only):
  ≤ $1,300          -> publish at original advertised rent (as-is)
  $1,301–$1,390     -> reduce to exactly $1,300
  $1,391–$1,600     -> proportional reduction → $1,200–$1,300 (natural variation)

Security deposit   = published rent (applied automatically by pipeline)
All price mentions in description updated to match published rent.

All platform rules (watermark detection, ImageKit upload, enrichment,
fee normalization, duplicate detection, final validation) are enforced
automatically by PipelineOrchestrator.

Usage:
  python3 scraper/columbus_oh_1300_batch.py
  python3 scraper/columbus_oh_1300_batch.py --dry-run
  python3 scraper/columbus_oh_1300_batch.py --target 10 --past-days 90
"""

import argparse
import sys
from typing import Optional, Set

from pipeline import PipelineOrchestrator, BatchCriteria

# ---------------------------------------------------------------------------
# Batch constants
# ---------------------------------------------------------------------------
TARGET_LOCATIONS = [
    "Columbus, OH",
    "Dublin, OH",
    "Westerville, OH",
    "Hilliard, OH",
    "Grove City, OH",
]

FALLBACK_LOCATIONS = [
    "Gahanna, OH",
    "New Albany, OH",
    "Reynoldsburg, OH",
    "Worthington, OH",
    "Pickerington, OH",
    "Upper Arlington, OH",
    "Bexley, OH",
    "Whitehall, OH",
    "Canal Winchester, OH",
    "Delaware, OH",
    "Heath, OH",
    "Lancaster, OH",
    "Newark, OH",
    "Pataskala, OH",
]

ZIP_CODES = [
    # Columbus core
    "43201", "43202", "43203", "43204", "43205", "43206",
    "43207", "43209", "43210", "43211", "43212", "43213",
    "43214", "43215", "43219", "43220", "43221", "43222",
    "43223", "43224", "43227", "43228", "43229", "43230",
    "43231", "43232", "43235",
    # Dublin / Hilliard / Grove City / Westerville
    "43016", "43017", "43026", "43054", "43082", "43123",
]

ALLOWED_TYPES = {"SINGLE_FAMILY", "TOWNHOMES"}   # no apartments/condos
BEDS_MIN      = 2
BEDS_MAX      = 3
BATHS_MIN     = 1.0
BATHS_MAX     = 2.0
RENT_MIN      = 1300
RENT_MAX      = 1600
RENT_FLOOR    = 1200   # lowest we'll publish (for high end of scraped range)
RENT_CAP      = 1300   # hard ceiling — never publish above $1,300


# ---------------------------------------------------------------------------
# Pricing function (batch-specific)
# ---------------------------------------------------------------------------

def compute_columbus_1300_rent(
    original_rent,
    seen_rents: Optional[Set[int]] = None,
):
    """
    Tiered pricing for Columbus OH $1,300-cap batch.

    Tier 1  ≤ $1,300          -> publish as-is (preserve original rent)
    Tier 2  $1,301–$1,390     -> reduce to exactly $1,300
    Tier 3  $1,391–$1,600     -> proportional reduction → $1,200–$1,300

    Principles (per brief):
      - Never publish above $1,300.
      - Don't publish every property at exactly $1,300 unless forced by tier 2.
      - Keep prices natural-looking: $1,300, $1,295, $1,275, $1,250, $1,200.
      - Security deposit synced to published rent by pipeline automatically.

    Returns (published_rent_int, original_rent_float) or (None, None) to reject.
    """
    if original_rent is None:
        return None, None
    rent = float(original_rent)
    if rent < RENT_MIN or rent > RENT_MAX:
        return None, None

    if rent <= 1300:
        # Tier 1: publish at original rent
        published = int(round(rent))

    elif rent <= 1390:
        # Tier 2: slightly over budget — reduce to exactly $1,300
        published = 1300

    else:
        # Tier 3: proportional reduction from $1,391–$1,600 → $1,200–$1,299
        # $1,391 maps to ~$1,299; $1,600 maps to ~$1,200
        ratio     = (rent - 1391) / (1600 - 1391)
        published = 1299 - ratio * (1299 - RENT_FLOOR)
        # Round to nearest dollar for natural-looking prices
        published = round(published)
        published = max(RENT_FLOOR, min(int(published), RENT_CAP))

    # Uniqueness nudge — avoid duplicate published rents in this batch
    if seen_rents is not None and published in seen_rents:
        for nudge in (-1, 1, -2, 2, -3, 3, -5, 5, -10, 10, -15, 15, -20, 20):
            candidate = published + nudge
            if RENT_FLOOR <= candidate <= RENT_CAP and candidate not in seen_rents:
                published = candidate
                break

    return int(published), rent


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description="Columbus, OH rental batch — $1,300 cap")
    ap.add_argument("--dry-run",   action="store_true", help="Stop before any DB writes")
    ap.add_argument("--target",    type=int, default=10, help="Number of listings to publish")
    ap.add_argument("--past-days", type=int, default=90)
    ap.add_argument("--limit",     type=int, default=200, help="Max scraped per location")
    ap.add_argument("--min-score", type=int, default=40,  help="Data quality floor")
    args = ap.parse_args()

    criteria = BatchCriteria(
        batch_name="Columbus, OH ($1,300 cap)",
        locations=TARGET_LOCATIONS,
        zip_codes=ZIP_CODES,
        fallback_locations=FALLBACK_LOCATIONS,
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
        pricing_fn=compute_columbus_1300_rent,
    )

    orchestrator = PipelineOrchestrator(verbose=True)
    result = orchestrator.run(criteria, dry_run=args.dry_run)

    if result.errors and result.published == 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
