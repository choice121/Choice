#!/usr/bin/env python3
"""
cincinnati_oh_3br_batch.py — Cincinnati, OH 3-Bedroom Rental Batch
===================================================================
Target markets  : Cincinnati, OH (and immediate Cincinnati enclaves/suburbs)
Property types  : Single-family homes (SINGLE_FAMILY), Townhouses (TOWNHOMES)
                  Strictly NO apartments, condos, duplexes, or multi-family
Bedrooms        : Exactly 3
Bathrooms       : Minimum 1.5 (1.5, 2.0, 2.5, 3.0)
Scraped range   : $800–$2,200 / month
Target rent     : Approximately $1,550 / month
Published cap   : $1,600 / month (strict absolute maximum)
Application fee : $50 always
Security deposit: 1x rent in DB, stripped from descriptions
Photos          : Minimum 6 clean photos uploaded to ImageKit
Target          : Up to 15 qualifying properties (11 fully verified candidates)

Usage:
  python3 scraper/cincinnati_oh_3br_batch.py
  python3 scraper/cincinnati_oh_3br_batch.py --dry-run
"""

import argparse
import json
import os
import sys
from typing import Dict, List, Optional, Set, Tuple

# Ensure scraper package is on path
_DIR = os.path.dirname(os.path.abspath(__file__))
if _DIR not in sys.path:
    sys.path.insert(0, _DIR)

from pipeline import PipelineOrchestrator, BatchCriteria
from enrichment import (
    validate_for_publish,
    strip_security_deposit_from_description,
    clean_description,
    enforce_price_consistency,
    normalize_application_fee_in_description,
    append_apply_cta,
    filter_record_photos,
)

# ---------------------------------------------------------------------------
# Batch constants & verified properties
# ---------------------------------------------------------------------------

BATCH_NAME = "Cincinnati, OH — 3BR"
TARGET_LOCATIONS = ["Cincinnati, OH"]
ALLOWED_TYPES = {"SINGLE_FAMILY", "TOWNHOMES"}

BEDS_EXACT = 3
BATHS_MIN = 1.5
BATHS_MAX = 3.0
RENT_MIN = 800
RENT_MAX = 2200
RENT_FLOOR = 1400
RENT_CAP = 1600

# Verified property descriptions crafted strictly from MLS facts
VERIFIED_DESCRIPTIONS = {
    "1121 Winfield Ave": (
        "Updated three-bedroom single-family residence offering 1,862 square feet of living space on Winfield Avenue. "
        "The interior features a clean contemporary atmosphere with whole-home air conditioning and modern fixtures. "
        "The kitchen comes equipped with a refrigerator and ample cabinet storage. "
        "With one full bathroom and an additional half bath, the layout provides practical everyday functionality. "
        "Dogs and cats are welcome in this pet-friendly home. "
        "Monthly rent is $1,550 with a standard $50 application fee per adult."
    ),
    "1274 Ross Ave": (
        "Classic two-story home in Cincinnati featuring 1,752 square feet with three bedrooms and 1.5 bathrooms. "
        "Original hardwood flooring runs throughout the main living areas, adding warmth and character. "
        "The eat-in kitchen includes an oven/range and refrigerator, leading directly to a private rear yard suitable for outdoor relaxation. "
        "On-street parking is available directly in front of the property. "
        "Pets are welcome. "
        "Monthly rent is $1,560 with a $50 application fee per adult."
    ),
    "5109 Montgomery Rd": (
        "Move-in ready single-family home in Norwood featuring three bedrooms, two full bathrooms, and 1,504 square feet of versatile space. "
        "The interior has been refreshed with new flooring, fresh neutral paint, and tall ceilings that maximize natural light. "
        "An open kitchen provides an oven/range, dishwasher, and refrigerator, with a rear exit opening onto a backyard and dedicated off-street parking. "
        "A finished third-floor bonus space offers flexible utility for a home office, recreation, or storage. "
        "Pets are warmly welcomed. "
        "Monthly rent is $1,400 with a $50 application fee per adult."
    ),
    "280 Genoma Dr": (
        "Single-level residence in Cincinnati providing 1,269 square feet of refreshed living space. "
        "Recent renovations include new luxury vinyl plank flooring installed throughout the main common rooms for durable everyday living. "
        "The floor plan contains three bedrooms and two full bathrooms, complemented by central heating and air conditioning. "
        "Convenient residential driveway access and pet-friendly accommodations for both dogs and cats. "
        "Monthly rent is $1,585 with a $50 application fee per adult."
    ),
    "15 Bertus St": (
        "Well-appointed single-family home in Saint Bernard with three bedrooms and two full bathrooms across 1,520 square feet. "
        "The kitchen features updated cabinetry, granite countertops, and stainless steel appliances. "
        "An in-unit washer and dryer are included for laundry convenience. "
        "Located within walking distance of local neighborhood schools, this home offers easy access to central transit routes. "
        "Pet-friendly living with dogs and cats accepted. "
        "Monthly rent is $1,580 with a $50 application fee per adult."
    ),
    "249 Earnshaw Ave": (
        "Remodeled multi-level home in historic Mt. Auburn featuring three bedrooms, two full bathrooms, and 1,700 square feet. "
        "The layout separates living and sleeping quarters across distinct levels for optimal privacy. "
        "Situated within easy walking distance of Christ Hospital, local academies, and minutes from the University of Cincinnati campus. "
        "Modernized bathrooms and updated interior finishes throughout. "
        "Pets of all sizes are welcome. "
        "Monthly rent is $1,600 with a $50 application fee per adult."
    ),
    "3617 Norwich Ave": (
        "Three-bedroom single-family property in Avondale providing 1,613 square feet with 2.5 bathrooms. "
        "The main floor incorporates a convenient powder room alongside comfortable living and dining spaces. "
        "A modern kitchen setup includes a full refrigerator, generous counter space, and updated cabinetry. "
        "Equipped with central cooling and heating systems throughout. "
        "Fully pet-friendly for dog and cat owners. "
        "Monthly rent is $1,565 with a $50 application fee per adult."
    ),
    "1216 Regent Ave": (
        "Generous 1,800 square foot traditional home in Bond Hill with three bedrooms and two full bathrooms. "
        "The main level features high ceilings, a sprawling living room centered around a decorative fireplace mantel, and a formal dining room designed for family meals. "
        "Upstairs bedrooms provide excellent closet storage and natural lighting. "
        "A private driveway offers off-street vehicle parking. "
        "Pet-friendly policy welcoming household pets. "
        "Monthly rent is $1,590 with a $50 application fee per adult."
    ),
    "4795 Prosperity Pl": (
        "Professionally updated single-family house in the North Overlook neighborhood offering 1,315 square feet on a single level. "
        "The home features three bedrooms, two full bathrooms, and whole-home air conditioning. "
        "The kitchen includes a refrigerator, modern countertops, and bright cabinetry. "
        "Low-maintenance flooring and updated bathroom fixtures complete the interior. "
        "Pets are welcome. "
        "Monthly rent is $1,545 with a $50 application fee per adult."
    ),
    "11540 Fitchburg Ln": (
        "Spacious 1,608 square foot single-family home in Forest Park featuring three bedrooms and 1.5 bathrooms. "
        "The property features a multi-level architectural layout with distinct living and dining zones, central heating and cooling, and an attached garage with private driveway parking. "
        "A substantial grass yard offers private outdoor space. "
        "Pet-friendly accommodation for dogs and cats. "
        "Monthly rent is $1,575 with a $50 application fee per adult."
    ),
    "8921 Cherry St": (
        "Fully modernized single-family home in Blue Ash featuring three bedrooms and two full bathrooms across 1,165 square feet. "
        "The bright interior offers contemporary finishes, whole-home air conditioning, and energy-efficient fixtures. "
        "The kitchen is equipped with a refrigerator, electric range, and updated cabinets. "
        "Convenient suburban setting close to local parks, community amenities, and dining. "
        "Pet-friendly for both dogs and cats. "
        "Monthly rent is $1,550 with a $50 application fee per adult."
    ),
}

# ---------------------------------------------------------------------------
# Pricing function
# ---------------------------------------------------------------------------

PUBLISHED_RENTS = {
    "1121 Winfield Ave": 1550,
    "1274 Ross Ave": 1560,
    "5109 Montgomery Rd": 1400,
    "280 Genoma Dr": 1585,
    "15 Bertus St": 1580,
    "249 Earnshaw Ave": 1600,
    "3617 Norwich Ave": 1565,
    "1216 Regent Ave": 1590,
    "4795 Prosperity Pl": 1545,
    "11540 Fitchburg Ln": 1575,
    "8921 Cherry St": 1550,
}


def compute_cincinnati_3br_rent(
    original_rent: float,
    seen_rents: Optional[Set[int]] = None,
) -> Tuple[Optional[int], Optional[float]]:
    """Pricing calculation respecting customer preference ($1,550) and cap ($1,600)."""
    if original_rent is None:
        return None, None
    orig_int = int(round(float(original_rent)))
    table = {
        1636: 1550,  # 1121 Winfield Ave
        1675: 1560,  # 1274 Ross Ave
        1400: 1400,  # 5109 Montgomery Rd
        1900: 1585,  # 280 Genoma Dr
        1895: 1590,  # 1216 Regent Ave
        1950: 1600,  # 249 Earnshaw Ave
        1597: 1565,  # 3617 Norwich Ave
        1647: 1545,  # 4795 Prosperity Pl
        1795: 1575,  # 11540 Fitchburg Ln
        1668: 1555,  # 8921 Cherry St
    }
    if orig_int in table:
        pub = table[orig_int]
    else:
        ratio = (float(original_rent) - 1500) / 500.0
        pub = int(round(1550 + ratio * 45))
        pub = round(pub / 5) * 5

    pub = max(RENT_FLOOR, min(pub, RENT_CAP))

    if seen_rents is not None and pub in seen_rents:
        for nudge in (5, -5, 10, -10, 15, -15):
            cand = pub + nudge
            if RENT_FLOOR <= cand <= RENT_CAP and cand not in seen_rents:
                pub = cand
                break

    return pub, float(original_rent)


def prepare_candidate_records() -> List[Dict]:
    """Load the 11 verified candidates, format for pipeline, and apply descriptions."""
    verified_path = os.path.join(_DIR, "..", "cincinnati_11_verified_full.json")
    if not os.path.exists(verified_path):
        raise FileNotFoundError("cincinnati_11_verified_full.json not found")

    with open(verified_path) as f:
        verified_items = json.load(f)

    records = []
    for item in verified_items:
        rec = item["mapped_record"]
        addr = rec.get("address", "").strip()

        # Find matching description
        matched_desc = None
        for k, d in VERIFIED_DESCRIPTIONS.items():
            if k.lower() in addr.lower():
                matched_desc = d
                break

        if not matched_desc:
            matched_desc = rec.get("description") or ""

        # Initialize with original source price so pricing_fn can compute final published rent
        source_price = item.get("source_price", 1550)
        rec["monthly_rent"] = int(round(float(source_price)))
        rec["security_deposit"] = rec["monthly_rent"]

        # Clean description
        desc_cleaned = clean_description(matched_desc)
        final_desc = append_apply_cta(desc_cleaned)
        rec["description"] = final_desc

        # Standardize application fee and pets
        rec["application_fee"] = 50
        rec["pets_allowed"] = True
        rec["status"] = "scraped"
        rec["source_status"] = "available"

        records.append(rec)

    return records


# ---------------------------------------------------------------------------
# Main Runner
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Cincinnati, OH 3-Bedroom Rental Batch")
    parser.add_argument("--dry-run", action="store_true", help="Perform verification without writing to DB")
    parser.add_argument("--target", type=int, default=15, help="Maximum number of listings to publish")
    args = parser.parse_args()

    print("\n" + "=" * 65)
    print("Choice Properties — Cincinnati, OH 3BR Batch Execution")
    print("=" * 65)

    records = prepare_candidate_records()
    print(f"Loaded {len(records)} fully-verified candidate records.")

    criteria = BatchCriteria(
        batch_name=BATCH_NAME,
        locations=TARGET_LOCATIONS,
        beds_exact=BEDS_EXACT,
        baths_min=BATHS_MIN,
        baths_max=BATHS_MAX,
        rent_min=RENT_MIN,
        rent_max=RENT_MAX,
        rent_floor=RENT_FLOOR,
        rent_cap=RENT_CAP,
        allowed_types=ALLOWED_TYPES,
        target=min(args.target, len(records)),
        pricing_fn=compute_cincinnati_3br_rent,
    )

    orchestrator = PipelineOrchestrator(verbose=True)
    result = orchestrator.run_records(records, criteria=criteria, dry_run=args.dry_run)

    print("\n" + "=" * 65)
    print("Execution Summary:")
    print(f"Published Count: {result.published}")
    print(f"Errors Encountered: {len(result.errors)}")
    if result.errors:
        for err in result.errors:
            print(f" - {err}")
    print("=" * 65)

    if not args.dry_run and result.published > 0:
        print("\nMandatory Output Listing URLs:")
        for idx, (rec, url) in enumerate(zip(records[:result.published], result.published_urls), 1):
            addr = rec.get("address", "")
            city = rec.get("city", "")
            state = rec.get("state", "OH")
            zip_code = rec.get("zip_code") or rec.get("zip") or ""
            rent = rec.get("monthly_rent", "")
            beds = rec.get("bedrooms", 3)
            baths = rec.get("bathrooms", 1.5)
            # Format: {n}. {Address}, {City}, {State} {Zip} (${Rent}/mo | {Beds} Bed / {Baths} Bath) — {url}
            baths_str = f"{int(baths)}" if float(baths).is_integer() else f"{baths}"
            print(f"{idx}. {addr}, {city}, {state} {zip_code} (${rent:,}/mo | {beds} Bed / {baths_str} Bath) — {url}")


if __name__ == "__main__":
    main()
