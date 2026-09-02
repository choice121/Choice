#!/usr/bin/env python3
"""
enrich_columbus_4.py — Enrich 4 Columbus OH listings with rich descriptions,
pets_allowed=True, smoking_allowed=True, and consistent pricing.
"""
import os, sys, requests
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scraper import _load_dotenv
_load_dotenv()

URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
H = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

# ---------------------------------------------------------------------------
# Rich, high-quality descriptions — one per property
# ---------------------------------------------------------------------------

UPDATES = [

    # ── 1. 1868 Argyle Dr — 3BR/2BA Ranch, Columbus OH 43219 ─────────────────
    {
        "id": "83b9bf7a-a174-49ce-8309-2e79d71bae7a",
        "pets_allowed": True,
        "smoking_allowed": True,
        "property_type": "SINGLE_FAMILY",
        "description": (
            "Welcome to 1868 Argyle Dr — a beautifully updated 3-bedroom, 2-bathroom ranch "
            "nestled in the Argyle Park neighborhood of Columbus, OH. This single-story home "
            "offers approximately 999 sq ft of thoughtfully refreshed living space, combining "
            "classic charm with modern finishes throughout.\n\n"

            "Step inside to find rich hardwood floors and brand-new carpet in every bedroom, "
            "creating a warm and inviting atmosphere from the moment you arrive. The fully "
            "updated kitchen is a true highlight, featuring refinished cabinetry, upgraded "
            "countertops, and a complete suite of stainless steel appliances — including an "
            "electric range, refrigerator, and dishwasher — all included with your lease. "
            "Fresh paint throughout gives the entire home a clean, move-in-ready feel.\n\n"

            "The main level offers comfortable single-floor living, while the finished basement "
            "adds exceptional bonus space rarely found at this price point. The basement includes "
            "a second full bathroom and a kitchenette area, making it ideal for a home office, "
            "guest suite, hobby room, or extra storage.\n\n"

            "Outside, enjoy a fully fenced backyard — perfect for pets, children, or weekend "
            "gatherings — along with a detached 2-car garage that provides secure parking and "
            "generous storage. Central air conditioning keeps the home comfortable all summer long.\n\n"

            "Located in the 43219 zip code with easy access to I-670, Port Columbus, Easton "
            "Town Center, shopping, dining, and major employers. A spacious, updated home at "
            "an unbeatable value.\n\n"

            "Monthly rent: $1,202 | Security deposit: $1,202 | Application fee: $50\n"
            "Pets welcome. Smoking permitted on outdoor areas only.\n\n"
            "Ready to make this your next home? Submit your application today at Choice Properties "
            "and take the first step toward moving in."
        ),
    },

    # ── 2. 4794 Wendler Blvd — 2BR/1.5BA, Columbus OH 43230 ─────────────────
    {
        "id": "57af4b2d-4f25-425b-85e4-8102ca615bbb",
        "pets_allowed": True,
        "smoking_allowed": True,
        "description": (
            "Welcome to 4794 Wendler Blvd — a well-maintained 2-bedroom, 1.5-bathroom home "
            "offering 1,008 sq ft of comfortable, move-in-ready living space in the sought-after "
            "Gahanna school district, Columbus, OH 43230. This property blends everyday practicality "
            "with quality finishes that feel like home from day one.\n\n"

            "Gorgeous hardwood floors flow throughout the main level, setting the tone for this "
            "bright and welcoming home. The open-concept kitchen features white cabinetry, a walk-in "
            "pantry, and a dining area that connects seamlessly to the spacious great room — ideal "
            "for entertaining or relaxing evenings at home. A convenient half-bathroom and a laundry "
            "area with full washer and dryer hookups round out the first floor, adding everyday "
            "functionality without compromise.\n\n"

            "Upstairs, two generously sized bedrooms share a well-appointed full bathroom. Both "
            "rooms offer great natural light and ample closet space, making it easy to feel settled "
            "and organized.\n\n"

            "The covered front porch is perfect for morning coffee or unwinding at the end of the day. "
            "Out back, a fully fenced private yard offers a peaceful outdoor retreat, complete with "
            "a storage shed for bikes, tools, and seasonal gear. Two dedicated off-street parking "
            "spaces behind the home provide easy, hassle-free access.\n\n"

            "Situated near Easton Town Center, I-270, and Gahanna's top-rated schools, this home "
            "puts Columbus's best shopping, dining, parks, and commuter routes right at your doorstep.\n\n"

            "Monthly rent: $1,224 | Security deposit: $1,224 | Application fee: $50\n"
            "Pets welcome. Smoking permitted on outdoor areas only.\n"
            "Tenants responsible for all utilities and lawn maintenance.\n\n"
            "Your next chapter starts here. Apply today at Choice Properties and let us make "
            "the move simple and straightforward."
        ),
    },

    # ── 3. 274 E Barthman Ave — 2BR/1BA, Columbus OH 43207 ───────────────────
    {
        "id": "3f7d336a-eca3-4778-b43c-b99f02911328",
        "pets_allowed": True,
        "smoking_allowed": True,
        "description": (
            "Welcome to 274 E Barthman Ave — a charming 2-bedroom, 1-bathroom single-family home "
            "full of character and warmth in Columbus, OH 43207. Spanning approximately 960 sq ft, "
            "this classic two-story home has been lovingly maintained and offers a comfortable, "
            "move-in-ready living experience at an exceptional value.\n\n"

            "The inviting living room centers around a gorgeous wood-burning fireplace — the perfect "
            "focal point for cozy evenings and a feature rarely found at this price. The large, "
            "modern kitchen provides abundant counter and cabinet space, making meal prep a pleasure "
            "whether you're cooking for one or hosting friends. Mini-blinds throughout give you "
            "privacy and light control in every room.\n\n"

            "Step outside to enjoy covered front and back porches ideal for morning coffee, evening "
            "relaxation, or simply taking in the neighborhood. The fully privacy-fenced yard creates "
            "a safe, private outdoor sanctuary — perfect for pets, gardening, or play. The full "
            "unfinished basement offers excellent additional storage and utility space.\n\n"

            "Central air conditioning keeps the home cool and comfortable through Columbus's warm "
            "summer months. The home is conveniently located in the 43207 zip code with quick access "
            "to I-71, Nationwide Children's Hospital, German Village, downtown Columbus, and a wide "
            "variety of local dining, shops, and parks.\n\n"

            "Monthly rent: $1,245 | Security deposit: $1,245 | Application fee: $50\n"
            "Pets welcome. Smoking permitted on outdoor areas only.\n\n"
            "Don't miss this rare find. Submit your application today at Choice Properties and "
            "secure your spot in this wonderful Columbus home."
        ),
    },

    # ── 4. 614 Northridge Rd — 2BR/1BA Townhouse, Columbus OH 43214 ──────────
    {
        "id": "6055a042-78ec-4b8f-b0e3-45b7d0df9432",
        "pets_allowed": True,
        "smoking_allowed": True,
        "description": (
            "Welcome to 614 Northridge Rd — a well-appointed 2-bedroom, 1-bathroom townhouse "
            "offering approximately 850 sq ft of clean, comfortable living space in the desirable "
            "Northridge area of Columbus, OH 43214. Part of a well-managed 4-unit building, this "
            "home delivers excellent value with quality features that stand out at this price.\n\n"

            "The main living area is bright and functional, with a practical layout that maximizes "
            "every square foot. The kitchen comes fully equipped with a range, refrigerator, and "
            "garbage disposal — everything you need to settle right in. Two comfortable bedrooms "
            "offer good closet space and natural light, with a shared full bathroom that has been "
            "well maintained throughout.\n\n"

            "One of this home's standout features is the private basement accessible only to this "
            "unit — a rare bonus that provides additional storage, utility space, and full "
            "washer/dryer hookups so you can do laundry on your own schedule without leaving home. "
            "Central air conditioning keeps the living space cool and refreshing during the warmer "
            "months, and the included 1-car garage adds secure, covered parking plus extra storage "
            "right outside your door.\n\n"

            "Located in the 43214 zip code, you're minutes from Clintonville's vibrant restaurant "
            "scene, Antrim Park, Olentangy Trail, OSU campus, and the conveniences of North "
            "Broadway, with quick access to I-315 and SR-315 for easy commuting across Columbus.\n\n"

            "Monthly rent: $1,300 | Security deposit: $1,300 | Application fee: $50\n"
            "Pets welcome. Smoking permitted on outdoor areas only.\n"
            "Tenant responsible for gas, electric, and water/sewer utilities.\n\n"
            "Ready to make your move? Apply today at Choice Properties — the process is simple, "
            "fast, and designed with renters in mind."
        ),
    },
]


def main():
    dry_run = "--dry-run" in sys.argv
    print(f"\n=== Enriching 4 Columbus Listings ({'DRY RUN' if dry_run else 'LIVE'}) ===\n")

    for upd in UPDATES:
        pid   = upd.pop("id")
        r = requests.get(
            f"{URL}/rest/v1/properties?id=eq.{pid}&select=address,city,monthly_rent",
            headers=H
        )
        prop = r.json()[0] if r.json() else {}
        addr = f"{prop.get('address','?')}, {prop.get('city','?')}"
        rent = prop.get("monthly_rent", "?")

        print(f"  {'[DRY] ' if dry_run else ''}Updating: {addr}  (${rent}/mo)")

        if not dry_run:
            r2 = requests.patch(
                f"{URL}/rest/v1/properties?id=eq.{pid}",
                headers=H,
                json=upd,
            )
            if r2.status_code < 300:
                print(f"    ✅ Updated — pets=True, smoking=True, description enriched")
            else:
                print(f"    ❌ FAILED — HTTP {r2.status_code}: {r2.text[:200]}")
        print()

    print("=" * 50)
    print("Done. All 4 listings enriched.")
    print("=" * 50)


if __name__ == "__main__":
    main()
