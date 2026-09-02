#!/usr/bin/env python3
"""
dfw_batch.py — Dallas–Fort Worth Rental Batch
==============================================
Target markets  : Arlington, TX · Grand Prairie, TX · Fort Worth, TX · Dallas, TX
Property types  : Houses (SINGLE_FAMILY), Townhouses (TOWNHOMES)
                  NO Apartments, Condos, Duplexes
Bedrooms        : 2+ (min 2)
Rent range      : $1,400–$1,600 / month (scraped)
Price rule      : Proportional reduction → published rent ≤ $1,300
                  Smallest reasonable reduction; prices vary naturally.
                  Security deposit = published rent.

Pricing map (approximate):
  $1,400 scraped → ~$1,299 published
  $1,450 scraped → ~$1,285 published
  $1,500 scraped → ~$1,270 published
  $1,550 scraped → ~$1,255 published
  $1,600 scraped → ~$1,235 published

Platform rules (applied automatically by the pipeline):
  - Watermark detection + rejection (text and visual)
  - ImageKit-only image hosting (min 6 photos per listing)
  - Description cleaned — no competitor branding or agent language
  - "Choice Properties" replaces property manager / owner references
  - Application fee normalized to $50
  - Security deposit synced to published rent
  - All price mentions in description updated to match published values
  - Duplicate detection (address + source_id)
  - Pre-publish validation gate

See scraper/pipeline.py and scraper/PLATFORM_RULES.md for full rule set.

Usage:
  python3 scraper/dfw_batch.py
  python3 scraper/dfw_batch.py --dry-run
  python3 scraper/dfw_batch.py --target 10 --past-days 90
"""

import argparse
import sys
from typing import Optional, Set

from pipeline import PipelineOrchestrator, BatchCriteria

# ---------------------------------------------------------------------------
# Batch constants
# ---------------------------------------------------------------------------
TARGET_LOCATIONS = [
    "Arlington, TX",
    "Grand Prairie, TX",
    "Fort Worth, TX",
    "Dallas, TX",
]

FALLBACK_LOCATIONS = [
    "Irving, TX",
    "Garland, TX",
    "Mesquite, TX",
    "Euless, TX",
    "Hurst, TX",
    "Bedford, TX",
    "North Richland Hills, TX",
    "Mansfield, TX",
    "Duncanville, TX",
    "DeSoto, TX",
    "Cedar Hill, TX",
    "Lancaster, TX",
]

# ZIP-level scraping for broader inventory coverage across DFW
ZIP_CODES = [
    # Arlington
    "76001", "76002", "76006", "76010", "76011", "76012",
    "76013", "76014", "76015", "76016", "76017", "76018",
    # Grand Prairie
    "75050", "75051", "75052", "75054",
    # Fort Worth (central and south)
    "76104", "76105", "76106", "76107", "76108", "76109",
    "76110", "76111", "76112", "76114", "76115", "76116",
    "76119", "76120", "76123", "76132", "76133", "76134",
    "76135", "76137", "76140",
    # Dallas (south and west)
    "75203", "75208", "75211", "75212", "75215", "75216",
    "75217", "75224", "75228", "75232", "75233", "75236",
    "75237", "75241",
]

ALLOWED_TYPES = {"SINGLE_FAMILY", "TOWNHOMES"}
BEDS_MIN      = 2
BATHS_MIN     = 1.0
RENT_MIN      = 1400
RENT_MAX      = 1600
RENT_FLOOR    = 1235   # lowest we'll publish ($1,235 for a $1,600 original)
RENT_CAP      = 1299   # ceiling — brief says ≤ $1,300; use 1299 max


# ---------------------------------------------------------------------------
# Pricing function (batch-specific)
# ---------------------------------------------------------------------------

def compute_dfw_rent(
    original_rent,
    seen_rents: Optional[Set[int]] = None,
):
    """
    Proportional reduction for the DFW market.

    Maps [$1,400 – $1,600] scraped → [$1,235 – $1,299] published.

    Principles (per brief):
      - Never publish above $1,300 (hard cap = $1,299).
      - Apply the smallest reasonable reduction (proportional).
      - Published prices vary naturally — no flat $1,300 for everything.
      - Security deposit is set to the published rent by the pipeline automatically.

    Uses a $1 uniqueness nudge (not $5) so prices come out like
    $1,299, $1,295, $1,289, $1,275, $1,250, $1,235 rather than
    multiples of $5.

    Returns (published_rent_int, original_rent_float) or (None, None) to reject.
    """
    if original_rent is None:
        return None, None
    rent = float(original_rent)
    if rent < RENT_MIN or rent > RENT_MAX:
        return None, None

    # Proportional map: [1400, 1600] → [1299, 1235]
    # Higher scraped rent → lower published rent.
    ratio     = (rent - RENT_MIN) / (RENT_MAX - RENT_MIN)        # 0.0 at $1,400; 1.0 at $1,600
    published = RENT_CAP - ratio * (RENT_CAP - RENT_FLOOR)       # descends 1299→1235

    # Round to nearest dollar (not $5) for natural-looking prices
    published = round(published)
    published = max(RENT_FLOOR, min(int(published), RENT_CAP))

    # Uniqueness nudge — prefer a price not already used in this batch
    if seen_rents is not None:
        for nudge in (0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5,
                      -6, 6, -7, 7, -8, 8, -9, 9, -10, 10):
            candidate = published + nudge
            if RENT_FLOOR <= candidate <= RENT_CAP and candidate not in seen_rents:
                published = candidate
                break

    return int(published), rent


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description="Dallas–Fort Worth TX rental batch")
    ap.add_argument("--dry-run",   action="store_true", help="Stop before any DB writes")
    ap.add_argument("--target",    type=int, default=10, help="Number of listings to publish")
    ap.add_argument("--past-days", type=int, default=90)
    ap.add_argument("--limit",     type=int, default=200, help="Max scraped per location")
    ap.add_argument("--min-score", type=int, default=40,  help="Data quality floor")
    args = ap.parse_args()

    criteria = BatchCriteria(
        batch_name="Dallas–Fort Worth, TX",
        locations=TARGET_LOCATIONS,
        zip_codes=ZIP_CODES,
        fallback_locations=FALLBACK_LOCATIONS,
        beds_min=BEDS_MIN,
        baths_min=BATHS_MIN,
        rent_min=RENT_MIN,
        rent_max=RENT_MAX,
        rent_floor=RENT_FLOOR,
        rent_cap=RENT_CAP,
        allowed_types=ALLOWED_TYPES,
        target=args.target,
        past_days=args.past_days,
        limit=args.limit,
        min_score=args.min_score,
        pricing_fn=compute_dfw_rent,
    )

    orchestrator = PipelineOrchestrator(verbose=True)
    result = orchestrator.run(criteria, dry_run=args.dry_run)

    if result.errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
