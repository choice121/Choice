#!/usr/bin/env python3
"""birmingham_al_batch.py — Birmingham, AL Rental Batch"""
import argparse, sys
from typing import Optional, Set
from pipeline import PipelineOrchestrator, BatchCriteria

TARGET_LOCATIONS   = ["Birmingham, AL"]
FALLBACK_LOCATIONS = []
ALLOWED_TYPES      = {"APARTMENT", "CONDOS", "TOWNHOMES"}

def compute_birmingham_rent(original_rent, seen_rents: Optional[Set[int]] = None):
    if original_rent is None:
        return None, None
    rent = float(original_rent)
    
    if rent < 1000 or rent > 1500:
        return None, None
        
    # Proportional reduction to $900 - $1000
    ratio = (rent - 1000) / (1500 - 1000)
    published = int(900 + ratio * (1000 - 900))
    published = round(published / 5) * 5
    
    if seen_rents:
        for nudge in (0, 5, -5, 10, -10):
            c = published + nudge
            if 900 <= c <= 1000 and c not in seen_rents:
                published = c
                break
                
    return published, rent

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run",   action="store_true")
    ap.add_argument("--target",    type=int, default=15)
    ap.add_argument("--past-days", type=int, default=90)
    ap.add_argument("--limit",     type=int, default=200)
    ap.add_argument("--min-score", type=int, default=40)
    args = ap.parse_args()

    criteria = BatchCriteria(
        batch_name="Birmingham, AL",
        locations=TARGET_LOCATIONS,
        fallback_locations=FALLBACK_LOCATIONS,
        beds_exact=1,
        baths_min=1.0,
        rent_min=1000,
        rent_max=1500,
        rent_floor=900,
        rent_cap=1000,
        allowed_types=ALLOWED_TYPES,
        target=args.target,
        past_days=args.past_days,
        limit=args.limit,
        min_score=args.min_score,
        pricing_fn=compute_birmingham_rent,
    )

    result = PipelineOrchestrator(verbose=True).run(criteria, dry_run=args.dry_run)
    if result.errors:
        sys.exit(1)

if __name__ == "__main__":
    main()
