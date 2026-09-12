#!/usr/bin/env python3
import sys
import argparse
from pipeline import PipelineOrchestrator, BatchCriteria

class EvictionPipelineOrchestrator(PipelineOrchestrator):
    def _step3_filter(self, records, criteria):
        records, dropped = super()._step3_filter(records, criteria)
        
        # Sort so that records mentioning "eviction" are at the top
        def has_eviction_keyword(rec):
            desc = (rec.get("property_description") or "").lower()
            amen = " ".join(rec.get("amenities") or []).lower()
            text = desc + " " + amen
            if "eviction" in text:
                if "no eviction" in text or "evictions not" in text or "no prior eviction" in text:
                    return -1 # bad
                return 1 # good
            return 0
            
        records.sort(key=lambda r: (has_eviction_keyword(r), r.get("data_quality_score", 0)), reverse=True)
        return records, dropped

def compute_rent(original_rent, seen_rents=None):
    if original_rent is None:
        return None, None
    rent = float(original_rent)
    if rent < 1000 or rent > 1100:
        return None, None
    return int(round(rent)), rent

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    criteria = BatchCriteria(
        batch_name="Columbus Eviction Batch",
        locations=["Columbus, OH"],
        beds_min=2,
        beds_max=3,
        rent_min=1000,
        rent_max=1100,
        rent_cap=1100,
        allowed_types={"SINGLE_FAMILY", "APARTMENT"},
        target=15,
        past_days=120,
        limit=200,
        min_score=30,
        pricing_fn=compute_rent
    )

    orch = EvictionPipelineOrchestrator(verbose=True)
    orch.run(criteria, dry_run=args.dry_run)

if __name__ == "__main__":
    main()
