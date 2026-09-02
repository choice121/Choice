#!/usr/bin/env python3
"""
enrich_columbus_descriptions_v2.py
Update 4 Columbus listings with richer descriptions that include
fast/flexible application messaging — each framed differently.
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
}

UPDATES = [

    # ── 1. 1868 Argyle Dr — 3BR/2BA Ranch, $1,202/mo
    # Angle: "We look at the full picture, not just a number"
    {
        "id": "83b9bf7a-a174-49ce-8309-2e79d71bae7a",
        "description": (
            "Welcome to 1868 Argyle Dr — a beautifully updated 3-bedroom, 2-bathroom ranch "
            "nestled in the Argyle Park neighborhood of Columbus, OH 43219. This single-story home "
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
            "Town Center, shopping, dining, and major employers.\n\n"

            "We believe your story matters more than a single number. Choice Properties reviews "
            "every application holistically — taking into account your income, rental history, "
            "and current situation rather than relying solely on a credit score. If you've had "
            "a setback in the past but are in a stable place today, we encourage you to apply. "
            "Our team moves quickly, and most applicants receive a decision within 24–48 hours.\n\n"

            "Monthly rent: $1,202 | Security deposit: $1,202 | Application fee: $50\n"
            "Pets welcome. Smoking permitted on outdoor areas only.\n\n"
            "Ready to make this your next home? Submit your application today at Choice Properties "
            "and take the first step toward moving in."
        ),
    },

    # ── 2. 4794 Wendler Blvd — 2BR/1.5BA, $1,224/mo
    # Angle: "Life moves fast — so does our approval process"
    {
        "id": "57af4b2d-4f25-425b-85e4-8102ca615bbb",
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

            "We know that when you find the right home, waiting isn't an option. That's why our "
            "application process is built for speed — straightforward paperwork, no unnecessary "
            "back-and-forth, and fast decisions so you can plan your move with confidence. We also "
            "work with a range of financial situations, including applicants who are self-employed, "
            "work gig or contract jobs, or have non-traditional income sources. If your income "
            "covers the rent and you're ready to be a reliable tenant, we want to hear from you.\n\n"

            "Monthly rent: $1,224 | Security deposit: $1,224 | Application fee: $50\n"
            "Pets welcome. Smoking permitted on outdoor areas only.\n"
            "Tenants responsible for all utilities and lawn maintenance.\n\n"
            "Your next chapter starts here. Apply today at Choice Properties and let us make "
            "the move simple and straightforward."
        ),
    },

    # ── 3. 274 E Barthman Ave — 2BR/1BA, $1,245/mo
    # Angle: "A fresh start deserves a real opportunity"
    {
        "id": "3f7d336a-eca3-4778-b43c-b99f02911328",
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
            "basement offers excellent additional storage and utility space.\n\n"

            "Central air conditioning keeps the home cool and comfortable through Columbus's warm "
            "summer months. Conveniently located with quick access to I-71, Nationwide Children's "
            "Hospital, German Village, downtown Columbus, and a wide variety of local dining, "
            "shops, and parks.\n\n"

            "A fresh start deserves a real opportunity — and that's exactly what Choice Properties "
            "is built on. We don't automatically disqualify applicants based on past evictions, "
            "prior credit challenges, or gaps in rental history. Each application receives "
            "individual attention from our leasing team, and we take the time to understand your "
            "current circumstances. If you're employed, your income is steady, and you're committed "
            "to being a responsible tenant, submit your application — you may be surprised.\n\n"

            "Monthly rent: $1,245 | Security deposit: $1,245 | Application fee: $50\n"
            "Pets welcome. Smoking permitted on outdoor areas only.\n\n"
            "Don't talk yourself out of it. Submit your application today at Choice Properties "
            "and let us take it from there."
        ),
    },

    # ── 4. 614 Northridge Rd — 2BR/1BA Townhouse, $1,300/mo
    # Angle: "No runaround, no long waits — just a clear answer"
    {
        "id": "6055a042-78ec-4b8f-b0e3-45b7d0df9432",
        "description": (
            "Welcome to 614 Northridge Rd — a well-appointed 2-bedroom, 1-bathroom townhouse "
            "offering approximately 850 sq ft of clean, comfortable living space in the desirable "
            "Northridge area of Columbus, OH 43214. Part of a well-managed 4-unit building, this "
            "home delivers excellent value with quality features that stand out at this price.\n\n"

            "The main living area is bright and functional, with a practical layout that maximizes "
            "every square foot. The kitchen comes fully equipped with a range, refrigerator, and "
            "garbage disposal — everything you need to settle right in. Two comfortable bedrooms "
            "offer good closet space and natural light, with a shared full bathroom that is well "
            "maintained and move-in ready.\n\n"

            "One of this home's standout features is the private basement accessible only to this "
            "unit — a rare bonus that provides additional storage, utility space, and full "
            "washer/dryer hookups so you can do laundry on your own schedule without leaving home. "
            "Central air conditioning keeps the living space cool and refreshing during the warmer "
            "months, and the included 1-car garage adds secure, covered parking plus extra storage "
            "right outside your door.\n\n"

            "Located in the 43214 zip code, you're minutes from Clintonville's vibrant restaurant "
            "scene, Antrim Park, Olentangy Trail, OSU campus, and the conveniences of North "
            "Broadway, with quick access to I-315 and SR-315 for easy commuting across Columbus.\n\n"

            "At Choice Properties, we keep the application process transparent and to the point — "
            "no runaround, no unexplained delays, and no wondering where you stand. Once you "
            "submit, our team reviews your application promptly and gives you a clear answer fast. "
            "We understand that life doesn't always go in a straight line, and we evaluate each "
            "applicant on where they are now — not just where they've been. Applicants re-entering "
            "the rental market, rebuilding after a hardship, or working through non-standard income "
            "situations are welcome to apply.\n\n"

            "Monthly rent: $1,300 | Security deposit: $1,300 | Application fee: $50\n"
            "Pets welcome. Smoking permitted on outdoor areas only.\n"
            "Tenant responsible for gas, electric, and water/sewer utilities.\n\n"
            "Ready to make your move? Apply today at Choice Properties — the process is "
            "honest, efficient, and built around you."
        ),
    },
]


def main():
    dry_run = "--dry-run" in sys.argv
    print(f"\n=== Updating Descriptions ({'DRY RUN' if dry_run else 'LIVE'}) ===\n")

    for upd in UPDATES:
        pid  = upd.pop("id")
        r0   = requests.get(
            f"{URL}/rest/v1/properties?id=eq.{pid}&select=address,city,monthly_rent",
            headers=H
        )
        prop = r0.json()[0] if r0.json() else {}
        addr = f"{prop.get('address','?')}, {prop.get('city','?')}"
        print(f"  Updating: {addr}")

        if not dry_run:
            r2 = requests.patch(
                f"{URL}/rest/v1/properties?id=eq.{pid}",
                headers=H,
                json=upd,
            )
            if r2.status_code < 300:
                print(f"    ✅ Description updated")
            else:
                print(f"    ❌ FAILED — {r2.status_code}: {r2.text[:200]}")
        else:
            preview = upd["description"][:120].replace("\n", " ")
            print(f"    [DRY] preview: {preview}...")
        print()

    print("=" * 50)
    print("Done.")


if __name__ == "__main__":
    main()
