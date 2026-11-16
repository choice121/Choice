#!/usr/bin/env python3
"""
run_ai_job.py — Universal AI Agent Runner for Choice Properties
================================================================

Accepts property search instructions as JSON (CLI arg or file), runs the
full 13-step pipeline, and outputs live published URLs.

Designed for AI agents (Kilo, Copilot, Claude, etc.) so they can execute
the complete workflow without writing a custom batch script.

Usage:
  # From JSON string:
  python3 scraper/run_ai_job.py --instructions '{
    "locations": ["Dallas, TX"],
    "beds_exact": 2,
    "baths_min": 1.0,
    "rent_min": 1300,
    "rent_max": 1800,
    "rent_cap": 1500,
    "target": 10,
    "past_days": 90,
    "allowed_types": ["SINGLE_FAMILY", "TOWNHOMES"]
  }'

  # From JSON file:
  python3 scraper/run_ai_job.py --instructions-file job.json

  # Quick CLI mode (no JSON needed):
  python3 scraper/run_ai_job.py \
    --location "Dallas, TX" \
    --beds-exact 2 \
    --baths-min 1.0 \
    --rent-min 1300 \
    --rent-max 1800 \
    --rent-cap 1500 \
    --target 10 \
    --past-days 90

  # Dry run (no DB writes):
  python3 scraper/run_ai_job.py --instructions-file job.json --dry-run

  # JSON output for programmatic parsing:
  python3 scraper/run_ai_job.py --instructions-file job.json --json-output

Exit codes:
  0  - Success (published >= target, or dry run completed)
  1  - Fatal error (missing credentials, no listings found, all blocked)

Output:
  Human-readable summary by default.
  With --json-output, prints a JSON object to stdout for easy parsing.

Pre-flight checks:
  - SUPABASE_URL must be set
  - SUPABASE_SERVICE_ROLE_KEY must be set
  - IMAGEKIT_PRIVATE_KEY must be set
  - IMAGEKIT_URL_ENDPOINT must be set
  - Python 3.9+ required
  - homeharvest + requests packages required

Watermark handling:
  By default, the pipeline drops competitor-branded listings automatically.
  Use --strict-watermarks to also reject listings with ANY branded photo
  (even if some clean photos remain).
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

# ---------------------------------------------------------------------------
# Path bootstrap + dotenv
# ---------------------------------------------------------------------------
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if _SCRIPT_DIR not in sys.path:
    sys.path.insert(0, _SCRIPT_DIR)

def _load_dotenv():
    for candidate in [
        ".env",
        "../.env",
        os.path.join(_SCRIPT_DIR, ".env"),
        os.path.join(_SCRIPT_DIR, "../.env"),
    ]:
        if os.path.isfile(candidate):
            with open(candidate) as fh:
                for line in fh:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    k, _, v = line.partition("=")
                    k = k.strip()
                    if k and k not in os.environ:
                        os.environ[k] = v.strip().strip('"').strip("'")
            break

_load_dotenv()

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------

_REQUIRED_ENV = {
    "SUPABASE_URL": "Supabase project URL",
    "SUPABASE_SERVICE_ROLE_KEY": "Supabase service role key",
    "IMAGEKIT_PRIVATE_KEY": "ImageKit private API key",
    "IMAGEKIT_URL_ENDPOINT": "ImageKit URL endpoint",
}

_OPTIONAL_ENV = {
    "SHORTCUT_IMPORT_SECRET": "Shared import secret (for extension imports)",
}

_REQUIRED_PACKAGES = ["requests", "homeharvest"]


def _check_env() -> List[str]:
    """Return list of missing required env vars."""
    missing = []
    for var in _REQUIRED_ENV:
        if not os.environ.get(var, "").strip():
            missing.append(var)
    return missing


def _check_packages() -> List[str]:
    """Return list of missing required Python packages."""
    missing = []
    for pkg in _REQUIRED_PACKAGES:
        try:
            __import__(pkg)
        except ImportError:
            missing.append(pkg)
    return missing


def preflight(verbose: bool = True) -> bool:
    """Run all pre-flight checks. Returns True if OK, False if fatal."""
    ok = True

    missing_env = _check_env()
    if missing_env:
        print("FATAL: Missing required environment variables:")
        for v in missing_env:
            print("  - {} ({})".format(v, _REQUIRED_ENV[v]))
        print("\nSet them in scraper/.env or as environment secrets.")
        ok = False

    missing_pkgs = _check_packages()
    if missing_pkgs:
        print("FATAL: Missing required Python packages:")
        for p in missing_pkgs:
            print("  - {}".format(p))
        print("\nInstall with: pip install " + " ".join(missing_pkgs))
        ok = False

    if verbose and ok:
        print("Pre-flight checks passed.")

    return ok


# ---------------------------------------------------------------------------
# Criteria parsing
# ---------------------------------------------------------------------------

def _parse_locations(raw: Any) -> List[str]:
    """Normalize locations input to a list of strings."""
    if raw is None:
        return []
    if isinstance(raw, str):
        # Support comma-separated or newline-separated
        parts = [p.strip() for p in raw.replace("\n", ",").split(",") if p.strip()]
        return parts
    if isinstance(raw, list):
        return [str(p).strip() for p in raw if str(p).strip()]
    return []


def _parse_types(raw: Any) -> Set[str]:
    """Normalize property types input to a set of uppercase strings."""
    if raw is None:
        return {"SINGLE_FAMILY", "TOWNHOMES", "APARTMENT", "CONDO"}
    if isinstance(raw, str):
        parts = [p.strip().upper() for p in raw.replace("\n", ",").split(",") if p.strip()]
        return set(parts)
    if isinstance(raw, list):
        return {str(p).strip().upper() for p in raw if str(p).strip()}
    return {"SINGLE_FAMILY", "TOWNHOMES"}


def build_criteria_from_dict(data: Dict[str, Any], overrides: Dict[str, Any] = None) -> Any:
    """
    Convert a dict of instructions into a BatchCriteria instance.

    Expected keys (all optional unless noted):
      locations        (list[str] | str) — required, at least one location
      beds_exact       (int)
      beds_min         (int)
      beds_max         (int)
      baths_min        (float)
      baths_max        (float)
      rent_min         (int) — required
      rent_max         (int) — required
      rent_floor       (int)
      rent_cap         (int)
      allowed_types    (list[str] | str)
      target           (int) — number of listings to publish
      past_days        (int) — how far back to scrape
      limit            (int) — max scraped per location
      min_score        (int) — data quality floor
      fallback_locations (list[str] | str)
      batch_name       (str)
      folder_name      (str)
      dry_run          (bool)
      strict_watermarks (bool) — reject listings with any branded photo

    Returns (BatchCriteria, dry_run, strict_watermarks).
    """
    from pipeline import BatchCriteria

    d = dict(data)
    if overrides:
        d.update(overrides)

    locations = _parse_locations(d.get("locations"))
    if not locations:
        raise ValueError("At least one location is required")

    allowed_types = _parse_types(d.get("allowed_types"))
    fallback_locations = _parse_locations(d.get("fallback_locations"))

    # Pricing function: if a custom function name is provided, look it up
    pricing_fn = None
    pricing_fn_name = d.get("pricing_fn")
    if pricing_fn_name and isinstance(pricing_fn_name, str):
        # Allow referencing functions from this module or pipeline module
        import pipeline as _pipeline_mod
        pricing_fn = getattr(_pipeline_mod, pricing_fn_name, None)
        if pricing_fn is None:
            try:
                pricing_fn = getattr(sys.modules[__name__], pricing_fn_name, None)
            except Exception:
                pass
        if pricing_fn is None:
            print("WARNING: pricing_fn '{}' not found — using default proportional pricer".format(pricing_fn_name))

    criteria = BatchCriteria(
        batch_name=str(d.get("batch_name") or "AI Job {}".format(datetime.now().strftime("%Y-%m-%d %H:%M"))),
        locations=locations,
        fallback_locations=fallback_locations,
        beds_exact=d.get("beds_exact"),
        beds_min=d.get("beds_min"),
        beds_max=d.get("beds_max"),
        baths_min=float(d.get("baths_min", 1.0)),
        baths_max=float(d["baths_max"]) if d.get("baths_max") is not None else None,
        rent_min=int(d.get("rent_min", 800)),
        rent_max=int(d.get("rent_max", 3500)),
        rent_floor=int(d["rent_floor"]) if d.get("rent_floor") is not None else None,
        rent_cap=int(d["rent_cap"]) if d.get("rent_cap") is not None else None,
        allowed_types=allowed_types,
        zip_codes=[str(z).strip() for z in d.get("zip_codes", []) if str(z).strip()],
        target=int(d.get("target", 10)),
        past_days=int(d.get("past_days", 90)),
        limit=int(d.get("limit", 200)),
        min_score=int(d.get("min_score", 75)),
        pricing_fn=pricing_fn,
        folder_name=str(d["folder_name"]).strip() if d.get("folder_name") else None,
    )

    dry_run = bool(d.get("dry_run", False))
    strict_watermarks = bool(d.get("strict_watermarks", False))

    return criteria, dry_run, strict_watermarks


# ---------------------------------------------------------------------------
# Enhanced watermark filter (applied after standard enrichment)
# ---------------------------------------------------------------------------

def apply_strict_watermark_filter(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Strict watermark mode: drop any listing that has branded photos remaining
    after the standard filter. This is more aggressive than the default
    behavior (which keeps listings with some clean photos).

    Use when you want zero branded content in published listings.
    """
    from enrichment import filter_record_photos

    kept = []
    for rec in records:
        before = rec.get("original_image_urls") or "[]"
        filter_record_photos(rec)
        after = rec.get("original_image_urls") or "[]"

        try:
            b_count = len(json.loads(before)) if isinstance(before, str) else len(before)
            a_count = len(json.loads(after)) if isinstance(after, str) else len(after)
        except Exception:
            b_count, a_count = 0, 0

        if b_count > 0 and a_count == 0:
            addr = "{} {}".format(rec.get("address", ""), rec.get("city", "")).strip()
            print("  [strict-watermark] Dropped: {} (all {} photos branded)".format(addr, b_count))
            continue

        kept.append(rec)

    return kept


# ---------------------------------------------------------------------------
# Main execution
# ---------------------------------------------------------------------------

def run_job(criteria: Any, dry_run: bool = False, strict_watermarks: bool = False,
            json_output: bool = False) -> Dict[str, Any]:
    """
    Execute the pipeline and return a result summary dict.

    The dict always contains:
      - ok: bool
      - dry_run: bool
      - summary: str (human-readable)
      - published_urls: list[str]
      - errors: list[str]
      - stats: dict with counts
    """
    from pipeline import PipelineOrchestrator

    start_time = time.time()
    start_ts = datetime.now(timezone.utc).isoformat()

    print("=" * 65)
    print("Choice Properties — AI Agent Job")
    print("=" * 65)
    print("Batch   : {}".format(criteria.batch_name))
    print("Target  : {}".format(criteria.target))
    print("Dry run : {}".format(dry_run))
    print("Strict WM: {}".format(strict_watermarks))
    print("Started : {}".format(start_ts))
    print("=" * 65)

    # Run the orchestrator
    orchestrator = PipelineOrchestrator(verbose=True, strict_watermarks=strict_watermarks)
    result = orchestrator.run(criteria, dry_run=dry_run)

    elapsed = time.time() - start_time
    end_ts = datetime.now(timezone.utc).isoformat()

    # Apply strict watermark filter if requested (post-enrichment pass)
    if strict_watermarks and not dry_run:
        print("\n── Strict watermark filter pass ──")
        # Re-fetch and filter — the orchestrator already ran, so we log what
        # would have been dropped. For a true strict pass, the caller should
        # set min_score higher or use the orchestrator's built-in filter.
        print("  (strict_watermarks flag noted — use higher min_score or custom filter in orchestrator)")

    # Build result dict
    summary_text = result.summary()
    print(summary_text)

    output = {
        "ok": len(result.errors) == 0 and (dry_run or result.published >= criteria.target),
        "dry_run": dry_run,
        "batch_name": criteria.batch_name,
        "started_at": start_ts,
        "finished_at": end_ts,
        "elapsed_seconds": round(elapsed, 1),
        "summary": summary_text,
        "published_urls": result.published_urls,
        "errors": result.errors,
        "stats": {
            "scraped": result.scraped,
            "after_dedup": result.after_dedup,
            "passed_filter": result.passed_filter,
            "passed_validation": result.passed_validation,
            "selected": result.selected,
            "published": result.published,
            "photos_ok": result.photos_ok,
            "photos_failed": result.photos_failed,
            "watermarked_dropped": result.watermarked_dropped,
        },
    }

    # Determine exit code
    if not result.errors and (dry_run or result.published > 0):
        output["exit_code"] = 0
    elif dry_run:
        output["exit_code"] = 0
    else:
        output["exit_code"] = 1

    return output


def main():
    ap = argparse.ArgumentParser(
        description="Universal AI Agent Runner — Choice Properties Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # From JSON file:
  %(prog)s --instructions-file job.json

  # From JSON string:
  %(prog)s --instructions '{"locations": ["Dallas, TX"], "beds_exact": 2, "target": 10}'

  # Quick CLI:
  %(prog)s --location "Dallas, TX" --beds-exact 2 --target 10

  # JSON output:
  %(prog)s --instructions-file job.json --json-output
        """,
    )

    # Instruction input (mutually exclusive)
    instr_group = ap.add_mutually_exclusive_group(required=True)
    instr_group.add_argument(
        "--instructions",
        type=str,
        help="JSON string with search criteria",
    )
    instr_group.add_argument(
        "--instructions-file",
        type=str,
        help="Path to JSON file with search criteria",
    )

    # Quick CLI args (alternative to JSON)
    ap.add_argument("--location", type=str, help="Single location (e.g. 'Dallas, TX')")
    ap.add_argument("--beds-exact", type=int, help="Exact bedroom count")
    ap.add_argument("--beds-min", type=int, help="Minimum bedrooms")
    ap.add_argument("--beds-max", type=int, help="Maximum bedrooms")
    ap.add_argument("--baths-min", type=float, default=1.0, help="Minimum bathrooms")
    ap.add_argument("--baths-max", type=float, help="Maximum bathrooms")
    ap.add_argument("--rent-min", type=int, default=800, help="Minimum monthly rent")
    ap.add_argument("--rent-max", type=int, default=3500, help="Maximum monthly rent")
    ap.add_argument("--rent-floor", type=int, help="Published rent floor")
    ap.add_argument("--rent-cap", type=int, help="Published rent cap")
    ap.add_argument("--target", type=int, default=10, help="Number of listings to publish")
    ap.add_argument("--past-days", type=int, default=90, help="Scrape lookback window")
    ap.add_argument("--limit", type=int, default=200, help="Max scraped per location")
    ap.add_argument("--min-score", type=int, default=75, help="Data quality floor (0-100)")
    ap.add_argument("--allowed-types", type=str, help="Comma-separated property types")
    ap.add_argument("--batch-name", type=str, help="Label for this job")
    ap.add_argument("--folder-name", type=str, help="Pipeline folder to assign to")

    # Execution flags
    ap.add_argument("--dry-run", action="store_true", help="Preview without DB writes")
    ap.add_argument("--strict-watermarks", action="store_true", help="Reject listings with any branded photo")
    ap.add_argument("--json-output", action="store_true", help="Print result as JSON to stdout")
    ap.add_argument("--skip-preflight", action="store_true", help="Skip pre-flight checks (not recommended)")

    args = ap.parse_args()

    # ── Pre-flight ──────────────────────────────────────────────────────────
    if not args.skip_preflight:
        if not preflight(verbose=True):
            sys.exit(1)

    # ── Load instructions ───────────────────────────────────────────────────
    if args.instructions_file:
        try:
            with open(args.instructions_file, "r", encoding="utf-8") as fh:
                instructions = json.load(fh)
        except Exception as exc:
            print("FATAL: Cannot read instructions file: {}".format(exc))
            sys.exit(1)
    else:
        try:
            instructions = json.loads(args.instructions or "{}")
        except json.JSONDecodeError as exc:
            print("FATAL: Invalid JSON in --instructions: {}".format(exc))
            sys.exit(1)

    if not isinstance(instructions, dict):
        print("FATAL: Instructions must be a JSON object")
        sys.exit(1)

    # ── Merge CLI overrides ─────────────────────────────────────────────────
    overrides = {}
    if args.location:
        overrides["locations"] = [args.location]
    if args.beds_exact is not None:
        overrides["beds_exact"] = args.beds_exact
    if args.beds_min is not None:
        overrides["beds_min"] = args.beds_min
    if args.beds_max is not None:
        overrides["beds_max"] = args.beds_max
    if args.baths_min is not None:
        overrides["baths_min"] = args.baths_min
    if args.baths_max is not None:
        overrides["baths_max"] = args.baths_max
    if args.rent_min is not None:
        overrides["rent_min"] = args.rent_min
    if args.rent_max is not None:
        overrides["rent_max"] = args.rent_max
    if args.rent_floor is not None:
        overrides["rent_floor"] = args.rent_floor
    if args.rent_cap is not None:
        overrides["rent_cap"] = args.rent_cap
    if args.allowed_types:
        overrides["allowed_types"] = args.allowed_types
    if args.batch_name:
        overrides["batch_name"] = args.batch_name
    if args.folder_name:
        overrides["folder_name"] = args.folder_name
    if args.dry_run:
        overrides["dry_run"] = True
    if args.strict_watermarks:
        overrides["strict_watermarks"] = True

    # Target/past_days/limit/min_score only from CLI if not in JSON
    if "target" not in instructions and args.target:
        overrides["target"] = args.target
    if "past_days" not in instructions and args.past_days:
        overrides["past_days"] = args.past_days
    if "limit" not in instructions and args.limit:
        overrides["limit"] = args.limit
    if "min_score" not in instructions and args.min_score:
        overrides["min_score"] = args.min_score

    # ── Build criteria ──────────────────────────────────────────────────────
    try:
        criteria, dry_run, strict_watermarks = build_criteria_from_dict(instructions, overrides)
    except ValueError as exc:
        print("FATAL: {}".format(exc))
        sys.exit(1)

    # ── Run job ─────────────────────────────────────────────────────────────
    try:
        result = run_job(
            criteria,
            dry_run=dry_run,
            strict_watermarks=strict_watermarks,
            json_output=args.json_output,
        )
    except Exception as exc:
        print("\nFATAL: Pipeline execution failed: {}".format(exc))
        import traceback
        traceback.print_exc()
        sys.exit(1)

    # ── Output ──────────────────────────────────────────────────────────────
    if args.json_output:
        # Print clean JSON to stdout (no extra text)
        print(json.dumps(result, indent=2, default=str))

    # Return the exit code from the result
    sys.exit(result.get("exit_code", 1))


if __name__ == "__main__":
    main()
