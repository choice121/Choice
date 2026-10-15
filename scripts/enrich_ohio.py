#!/usr/bin/env python3
import sys
import os
import json
import re

sys.path.insert(0, './scraper')
from enrichment import (
    clean_description, normalize_allcaps_description,
    strip_external_application_instructions, replace_owner_manager_references,
    strip_third_party_branding, strip_corporate_fees, normalize_hvac,
    rule_based_enrich, enforce_price_consistency,
    normalize_application_fee_in_description, append_apply_cta,
    validate_for_publish, is_watermarked
)

CLEAN_DESCRIPTIONS = {
    "PP-9C66EDE7": (
        "Recently renovated 3 Bed / 2 Bath House in The Incline District conveniently located near dining and entertainment, "
        "including Prima Vista Italian restaurant, the Incline House, and Bloc Coffee.\n\n"
        "This home features: new flooring, roof, and windows; fresh paint; new kitchen with granite countertops and stainless steel appliances; "
        "decorative fireplace; new bathrooms; off-street driveway parking, and more!\n\n"
        "Pets are welcome.\n\n"
        "Application Fee: $50.\n\n"
        "Apply now through Choice Properties to schedule a priority viewing and secure your new home."
    ),
    "PP-2B64CC74": (
        "Welcome home to this spacious 3 bedroom, 2.5 bath bi-level nestled in quiet streets of Westwood. "
        "The living room opens onto a spacious back deck. Primary bedroom features a private bathroom. "
        "Finished lower level includes a half bath and full laundry room. Features a large 2-car garage.\n\n"
        "Pets are welcome.\n\n"
        "Application Fee: $50.\n\n"
        "Your next home is waiting. Submit your application at Choice Properties to get started."
    ),
    "PP-F04492C1": (
        "Beautifully maintained 2-bedroom, 2.5-bathroom townhome in desirable Mason, ready for immediate move-in!\n\n"
        "Newly updated with quartz kitchen countertops, luxury vinyl plank flooring, fresh interior paint, and more. "
        "The bright and inviting main floor offers comfortable living and entertaining space, while upstairs features two spacious bedrooms "
        "and 2.5 bathrooms for added convenience.\n\n"
        "A versatile loft/study provides flexible space for a home office, additional living, and additional storage. "
        "Live conveniently near central Mason — close to shops, Mason schools, and I-71 — while enjoying the quiet, parklike surroundings "
        "of Pebble Creek and its amenities, including the lake, community pool, and private patio overlooking a wooded backdrop.\n\n"
        "Owner pays HOA fees; tenant responsible for utilities. Minimum 1-year lease. Pets are welcome.\n\n"
        "Application Fee: $50.\n\n"
        "Ready to make this your new home? Submit your rental application today at Choice Properties."
    ),
    "PP-8315D631": (
        "Welcome to your new haven in Maineville! This inviting 2-bedroom, 2-bathroom home offers comfortable living and ultimate convenience, "
        "perfect for those seeking a practical yet charming space.\n\n"
        "Special move-in incentive: $300 off first month's rent!\n\n"
        "Features:\n"
        "- Central AC: Consistent indoor comfort with central air conditioning.\n"
        "- Garage Parking: Park with ease and security in a garage space.\n"
        "- Stove/Oven: Built-in stove and oven combination.\n"
        "- Refrigerator: Full-size refrigerator.\n"
        "- Dishwasher: Time-saving built-in dishwasher.\n"
        "- Washer and Dryer: In-unit laundry convenience.\n"
        "- Water Heater & Softener: Improved water quality throughout the home.\n"
        "- Community Amenities: Clubhouse, swimming pool, fitness room, basketball/tennis/pickleball courts, and more.\n\n"
        "Rental Terms:\n"
        "- Security Deposit: equivalent to one month's rent ($1,800)\n"
        "- 12-month lease minimum\n"
        "- Pets are welcome\n"
        "- Application Fee: $50.\n\n"
        "Don't wait on a great home. Apply now at Choice Properties and secure this listing today."
    ),
    "PP-AE9B1436": (
        "Great location in the 'Lofts at Wetherington'! Enjoy all West Chester has to offer in this 2 BD / 2 BA condo with garage, "
        "across the street from the Liberty Center Mall.\n\n"
        "Beautiful 2nd floor unit with a relaxing private deck facing the water and fountain. The unit has a secured entrance, high cathedral ceilings, "
        "fresh neutral paint, and deep crown molding in all rooms for an elegant finish. Includes a garage and reserved parking space. "
        "Trash and water are included in the rent.\n\n"
        "Minimum 1-year lease. Pets are welcome.\n\n"
        "Application Fee: $50.\n\n"
        "Ready to make this your new home? Submit your rental application today at Choice Properties."
    ),
    "PP-C1EB419E": (
        "This charming 2-bedroom, 1-bathroom single family home in Mason, OH offers 875 sq ft of comfortable living space and is available for rent at $2,278/month.\n\n"
        "Features include a bright layout, spacious yard, central heating and cooling, and convenient access to top-rated Mason schools, shopping, and dining.\n\n"
        "Minimum 12-month lease. Pets are welcome.\n\n"
        "Application Fee: $50.\n\n"
        "Interested? Apply today through Choice Properties — applications are reviewed promptly."
    ),
    "PP-DBA8BE2C": (
        "Move-in ready 2 bedroom, 1.5 bath condo for lease in the Mason School District! This home features a spacious living room with a gas fireplace, "
        "a private walk-out patio with backyard, a bonus loft room upstairs, two bedrooms with abundant closet space, an attached 1-car garage, and more! "
        "Conveniently located near shopping, dining, and Kings Island, with close access to the community pool.\n\n"
        "Rent is $1,990/month with a minimum one-year lease. Security deposit equals one month's rent ($1,990). HOA fee paid by landlord. "
        "Utilities not included in rent. Attached 1-car garage plus street parking.\n\n"
        "Pets are welcome.\n\n"
        "Application Fee: $50.\n\n"
        "Don't wait on a great home. Apply now at Choice Properties and secure this listing today."
    ),
}

def enrich_ohio_property(p):
    pid = p.get('id')
    if pid == 'PP-C1EB419E' and (p.get('monthly_rent') == 227800 or not p.get('monthly_rent')):
        p['monthly_rent'] = 2278

    rent = p.get('monthly_rent')
    if rent and rent > 0:
        p['security_deposit'] = rent

    p['application_fee'] = 50
    p['pets_allowed'] = True
    p['smoking_allowed'] = False
    p['minimum_lease_months'] = 12

    # City Title Casing
    if p.get('city'):
        p['city'] = p['city'].title()

    if pid in CLEAN_DESCRIPTIONS:
        p['description'] = CLEAN_DESCRIPTIONS[pid]
    else:
        # Fallback to automated pipeline
        desc = p.get('description') or ''
        desc = clean_description(desc)
        desc = normalize_allcaps_description(desc)
        desc = strip_external_application_instructions(desc)
        desc = replace_owner_manager_references(desc)
        desc = strip_third_party_branding(desc)
        desc = strip_corporate_fees(desc)
        p['description'] = desc
        rule_based_enrich(p)
        if p.get('description'):
            p['description'] = enforce_price_consistency(p['description'], p['monthly_rent'])
            p['description'] = normalize_application_fee_in_description(p['description'])
            p['description'] = append_apply_cta(p['description'])

    normalize_hvac(p)

    # Standardize parking if missing
    if not p.get('parking'):
        if pid == 'PP-F04492C1':
            p['parking'] = 'Attached garage'
        elif pid == 'PP-8315D631':
            p['parking'] = 'Garage'
        elif pid == 'PP-AE9B1436':
            p['parking'] = 'Garage + Reserved Space'
        elif pid == 'PP-C1EB419E':
            p['parking'] = 'Driveway'

    # Title cleanup
    beds = p.get('bedrooms')
    ptype = (p.get('property_type') or 'Home').replace('_', ' ').title()
    city = p.get('city') or ''
    p['title'] = f"{beds}BR {ptype} in {city}"
    if p.get('parking') and 'garage' in p['parking'].lower():
        p['title'] += " w/ Garage"

    return p

if __name__ == '__main__':
    records = json.loads(sys.stdin.read())
    results = []
    for rec in records:
        enriched = enrich_ohio_property(rec)
        ok, failures = validate_for_publish(enriched)
        results.append({'record': enriched, 'valid': ok, 'failures': failures})
    print(json.dumps(results))
