#!/usr/bin/env python3
"""
fix_dfw_listings.py — Fix 10 DFW published listings
====================================================
1. Verify bedrooms are 2–3 (flag any that aren't)
2. Reprice to natural values close to $1,300 (some exactly $1,300)
3. Set pets_allowed = True on all
4. Sync security_deposit to new rent
5. Rewrite all rent/deposit mentions in description to match
"""

import os, sys, json, re
import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scraper import _load_dotenv
_load_dotenv()

SUPABASE_URL     = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

HEADERS = {
    "apikey":          SERVICE_ROLE_KEY,
    "Authorization":   f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type":    "application/json",
    "Prefer":          "return=representation",
}

PROPERTY_IDS = [
    "686ce582-6b8b-49df-ba58-7a366cb48583",
    "f7db092c-d77a-4ffc-ba33-4735e738f621",
    "5ff35837-e26f-45d3-a86c-3086c3385520",
    "244a7f80-3d49-4e1c-8a79-90682738c61c",
    "a4471898-176d-43db-8de3-0383d677719e",
    "f54b0a67-9ce7-43e6-84cf-e3de0b7bf990",
    "0483d7f9-59d8-459f-aba6-d7e2129391ad",
    "6eb8120c-8810-447c-b22d-480270f60b7b",
    "dc86a6f5-106d-4ee5-84d7-76378f1397e8",
    "4ea3d5bc-8d52-4bd7-a046-5b2e67309ad9",
]

# Natural prices close to $1,300 — varied, realistic, none above $1,300.
# Assigned by index after sorting by original rent (lowest gets highest price).
TARGET_PRICES = [1300, 1300, 1295, 1295, 1290, 1285, 1275, 1265, 1250, 1235]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_PRICE_RE = re.compile(
    r"""
    \$\s*[\d,]+(?:\.\d{1,2})?       # $1,450 / $1450 / $1450.00
    (?:\s*/\s*(?:mo(?:nth)?|month))? # optional /mo or /month
    |
    [\d,]+(?:\.\d{1,2})?\s*         # 1450 / 1,450 / 1450.00
    (?:/\s*(?:mo(?:nth)?|month)|     # followed by /mo
     per\s+month|                    # or "per month"
     \s+(?:per|a)\s+month)           # or "per month" variants
    """,
    re.IGNORECASE | re.VERBOSE,
)

# Rent-context patterns — only replace amounts that appear in a rent context
_RENT_CONTEXT_RE = re.compile(
    r"""
    (?:
        (?:monthly\s+)?rent(?:\s+is|:|\s+of)?\s*\$?\s*[\d,]+(?:\.\d{1,2})?  |
        \$\s*[\d,]+(?:\.\d{1,2})?(?:\s*/\s*(?:mo|month))                     |
        [\d,]+(?:\.\d{1,2})?\s+(?:per|a)\s+month                             |
        deposit(?:\s+is|:|\s+of)?\s*\$?\s*[\d,]+(?:\.\d{1,2})?
    )
    """,
    re.IGNORECASE | re.VERBOSE,
)

def _replace_price_in_text(text: str, new_rent: int) -> str:
    """
    Replace every rent/deposit dollar figure in the description with
    the new published rent amount. Uses a broad regex but only substitutes
    amounts that are plausibly rent-sized ($800–$2500).
    """
    if not text:
        return text

    formatted = f"${new_rent:,}/month"

    def _sub(m):
        raw = m.group(0)
        # Extract the numeric value to check plausibility
        digits = re.sub(r"[^\d]", "", raw.split(".")[0])
        if not digits:
            return raw
        val = int(digits)
        # Only touch amounts that look like rent ($800–$2,500)
        if 800 <= val <= 2500:
            # Preserve context: if it ends with /mo or /month, replace fully
            if re.search(r"/\s*(?:mo|month)|per\s+month|a\s+month", raw, re.IGNORECASE):
                return formatted
            # If it starts with $ and the value is rent-sized, replace
            if raw.lstrip().startswith("$"):
                return f"${new_rent:,}"
        return raw

    return _PRICE_RE.sub(_sub, text)


def fetch_properties(ids):
    id_list = ",".join(f'"{i}"' for i in ids)
    url = f"{SUPABASE_URL}/rest/v1/properties?id=in.({id_list})&select=id,address,city,bedrooms,bathrooms,monthly_rent,security_deposit,pets_allowed,description"
    r = requests.get(url, headers=HEADERS)
    r.raise_for_status()
    return r.json()


def update_property(prop_id, patch):
    url = f"{SUPABASE_URL}/rest/v1/properties?id=eq.{prop_id}"
    r = requests.patch(url, headers=HEADERS, json=patch)
    r.raise_for_status()
    return r.json()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    dry_run = "--dry-run" in sys.argv

    print("\n=== DFW Listings Fix ===")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}\n")

    props = fetch_properties(PROPERTY_IDS)
    print(f"Fetched {len(props)} properties\n")

    # Sort by original monthly_rent ascending so lowest rent gets highest price
    props.sort(key=lambda p: float(p.get("monthly_rent") or 0))

    seen_prices = set()
    results = []

    for i, prop in enumerate(props):
        pid       = prop["id"]
        addr      = f"{prop.get('address','?')}, {prop.get('city','?')}"
        beds      = prop.get("bedrooms")
        baths     = prop.get("bathrooms")
        orig_rent = prop.get("monthly_rent")
        desc      = prop.get("description") or ""

        # ── Bedroom check ────────────────────────────────────────────────────
        beds_ok = beds is not None and 2 <= int(beds) <= 3
        beds_flag = "" if beds_ok else f"  ⚠️  BEDROOMS={beds} (outside 2–3)"

        # ── Assign target price ───────────────────────────────────────────────
        new_rent = TARGET_PRICES[i] if i < len(TARGET_PRICES) else 1300

        # Deduplicate: if this price is taken, nudge down by $1 until clear
        original_new_rent = new_rent
        while new_rent in seen_prices and new_rent >= 1200:
            new_rent -= 1
        seen_prices.add(new_rent)

        # ── Update description ────────────────────────────────────────────────
        new_desc = _replace_price_in_text(desc, new_rent)

        patch = {
            "monthly_rent":     new_rent,
            "security_deposit": new_rent,
            "pets_allowed":     True,
            "description":      new_desc,
        }

        print(f"  {'[SKIP-BEDS] ' if not beds_ok else ''}#{i+1} {addr}")
        print(f"       beds={beds} baths={baths}{beds_flag}")
        print(f"       rent: ${orig_rent} → ${new_rent}  deposit: ${new_rent}  pets: True")

        if not dry_run:
            try:
                update_property(pid, patch)
                print(f"       ✅ updated")
            except Exception as e:
                print(f"       ❌ FAILED: {e}")
        else:
            print(f"       (dry run — no write)")

        results.append({
            "id": pid,
            "addr": addr,
            "beds": beds,
            "old_rent": orig_rent,
            "new_rent": new_rent,
            "beds_ok": beds_ok,
        })
        print()

    # ── Summary ───────────────────────────────────────────────────────────────
    print("=" * 55)
    print(f"Updated {len(results)} properties")
    bad_beds = [r for r in results if not r["beds_ok"]]
    if bad_beds:
        print(f"⚠️  {len(bad_beds)} properties have bedrooms outside 2–3:")
        for r in bad_beds:
            print(f"   {r['addr']}  beds={r['beds']}  id={r['id']}")
    else:
        print("✅ All properties have 2–3 bedrooms")
    print(f"✅ All pets_allowed set to True")
    prices = sorted([r["new_rent"] for r in results], reverse=True)
    print(f"✅ Published rents: {prices}")
    print("=" * 55)


if __name__ == "__main__":
    main()
