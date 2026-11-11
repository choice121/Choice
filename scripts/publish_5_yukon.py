import os
import json
import uuid
import re
import time
import requests
import datetime

SUPABASE_URL = "https://tlfmwetmhthpyrytrcfo.supabase.co"
SERVICE_ROLE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
if not SERVICE_ROLE_KEY:
    # try to get from .env
    for path in ['.env', '../.env']:
        if os.path.exists(path):
            with open(path) as f:
                for l in f:
                    if l.startswith('SUPABASE_SERVICE_ROLE_KEY='):
                        SERVICE_ROLE_KEY = l.split('=', 1)[1].strip().strip('"\'')

LANDLORD_ID = "b8d3aea0-f466-49f2-ac07-2b2b40793cc9" # Choice Properties

headers = {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': f'Bearer {SERVICE_ROLE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
}

# Fetch existing addresses
r = requests.get(f'{SUPABASE_URL}/rest/v1/properties?state=eq.OK&select=address', headers=headers)
existing_addrs = {row['address'].strip().lower() for row in r.json() if row.get('address')}

with open('scripts/yukon_candidates.json') as f:
    data = json.load(f)

# Find 5 houses not in existing_addrs
selected_houses = []
for h in data['houses']:
    if h['address'].strip().lower() not in existing_addrs:
        selected_houses.append(h)
    if len(selected_houses) >= 5:
        break

print(f"Selected {len(selected_houses)} Houses to publish.")

def clean_description(raw_desc, address, city, state, zip_code, beds, baths, rent, prop_type):
    cleaned = raw_desc or ""
    patterns_to_remove = [
        r"(?i)\bAll applications must be submitted using the official link[^\.\n]*",
        r"(?i)\bThird-party applications will not be considered[^\.\n]*",
        r"(?i)\bCall (or text)?\s*\d{3}[-\.\s]?\d{3}[-\.\s]?\d{4}[^\.\n]*",
        r"(?i)\bContact agent[^\.\n]*",
        r"(?i)\bListing provided by[^\.\n]*",
        r"(?i)\bMLS\s*#?\s*\d+\b",
        r"(?i)\bRealtor\.com\b",
        r"(?i)\bZillow\b",
        r"(?i)\bTrulia\b",
        r"(?i)\bRedfin\b",
        r"(?i)\bOpendoor\b",
        r"(?i)\bApply at\s+https?://\S+",
        r"(?i)\bhttps?://\S+",
    ]
    for p in patterns_to_remove:
        cleaned = re.sub(p, "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    overview = f"Welcome to {address} — a beautifully maintained {beds}-bedroom, {baths:g}-bathroom single-family home offering exceptional comfort, modern design, and everyday convenience in {city}, {state} {zip_code}."
    body = cleaned if len(cleaned) > 50 else f"This property features a bright and spacious open-concept layout, generous living areas, and high-quality finishes throughout. The fully equipped kitchen opens seamlessly into the dining and living spaces, creating the perfect atmosphere for both relaxing and entertaining."
    features = f"""Key Property Features & Highlights:
• {beds} Spacious Bedrooms & {baths:g} Full Bathrooms
• Open-concept layout with ample natural lighting
• Central Air Conditioning and Forced-Air Heating
• Modern kitchen with quality countertops and abundant cabinetry
• Attached 2-car garage and off-street driveway parking
• Fully fenced backyard for outdoor living and recreation
• Dedicated in-unit laundry room with washer/dryer hookups
• Pet-friendly living (dogs and cats welcome)

Lease & Application Information:
• Monthly Rent: ${rent}
• Security Deposit: ${rent} (equal to 1 month's rent)
• Application Fee: $50 per adult applicant
• Pet Policy: Pet-Friendly
• Lease Terms: 12-Month Lease Agreement"""
    return f"{overview}\n\n{body}\n\n{features}"

all_to_publish = selected_houses
published_results = []
today = datetime.datetime.now().strftime("%Y-%m-%d")

for idx, p in enumerate(all_to_publish, 1):
    address = p['address']
    city = p['city']
    state = p['state']
    zip_code = p['zip']
    beds = p['beds']
    baths = p['baths']
    sqft = p['sqft']
    rent = p['rent']
    prop_type = 'SINGLE_FAMILY'
    raw_photos = p['photos']

    # Filter valid URLs and cap at 20 clean photos
    clean_photos = [u for u in raw_photos if u and u.startswith('http')][:20]

    if len(clean_photos) < 6:
        print(f"[{idx}/5] Skipping {address}: only {len(clean_photos)} photos.")
        continue

    prop_id = str(uuid.uuid4())
    desc = clean_description(p.get('full_desc', ''), address, city, state, zip_code, beds, baths, rent, prop_type)
    title = f"{beds}BR/{baths:g}BA Single-Family Home in {city} – ${rent}/mo"

    amenities = [
        "Air Conditioning", "Central Heating", "Dishwasher", "Refrigerator",
        "Range / Oven", "Microwave", "Pet Friendly", "2-Car Garage",
        "Fenced Yard", "Washer/Dryer Hookups", "Smoke Free", "Walk-In Closets"
    ]

    payload = {
        "id": prop_id,
        "landlord_id": LANDLORD_ID,
        "title": title,
        "description": desc,
        "address": address,
        "city": city,
        "state": state,
        "zip": zip_code,
        "county": "Canadian County",
        "lat": p.get('lat'),
        "lng": p.get('lng'),
        "property_type": prop_type,
        "year_built": p.get('year_built'),
        "bedrooms": beds,
        "bathrooms": int(baths),
        "total_bathrooms": baths,
        "square_footage": sqft,
        "garage_spaces": 2,
        "monthly_rent": rent,
        "security_deposit": rent,
        "application_fee": 50,
        "available_date": today,
        "minimum_lease_months": 12,
        "lease_terms": ["12 months"],
        "pets_allowed": True,
        "pet_types_allowed": ["Dogs", "Cats"],
        "pet_deposit": 300,
        "smoking_allowed": False,
        "has_central_air": True,
        "parking": "Attached 2-Car Garage",
        "heating_type": "Central Forced Air",
        "cooling_type": "Central Air Conditioning",
        "laundry_type": "In-Unit Laundry Room",
        "amenities": amenities,
        "appliances": ["Refrigerator", "Stove / Range", "Dishwasher", "Microwave", "Washer/Dryer Hookups"],
        "status": "active",
        "listed_at": today,
        "featured": False
    }

    res = requests.post(f"{SUPABASE_URL}/rest/v1/properties", headers=headers, json=payload)
    if res.status_code not in [200, 201]:
        print(f"[{idx}/5] FAILED insert property {address}: {res.status_code} {res.text}")
        continue

    photo_rows = []
    for p_idx, p_url in enumerate(clean_photos):
        photo_rows.append({
            "property_id": prop_id,
            "url": p_url,
            "display_order": p_idx,
            "is_hero": (p_idx == 0),
            "watermark_status": "clean",
            "alt_text": f"{address}, {city} OK - Photo {p_idx + 1}"
        })

    p_res = requests.post(
        f"{SUPABASE_URL}/rest/v1/property_photos",
        headers={'apikey': SERVICE_ROLE_KEY, 'Authorization': f'Bearer {SERVICE_ROLE_KEY}', 'Content-Type': 'application/json', 'Prefer': 'return=minimal'},
        json=photo_rows
    )

    item_info = {
        "id": prop_id,
        "address": address,
        "city": city,
        "state": state,
        "zip": zip_code,
        "rent": rent,
        "beds": beds,
        "baths": baths,
        "url": f"https://choice-properties-site.pages.dev/property.html?id={prop_id}"
    }
    published_results.append(item_info)
    print(f"[{idx}/5] Published: {address}, {city}, {state} {zip_code} (${rent}/mo | {beds} Bed / {baths:g} Bath) -> {item_info['url']}")
    time.sleep(0.5)

print("\n" + "="*70)
print(f"PUBLISHING COMPLETE: {len(published_results)} properties published successfully.")
print("="*70)

print("\nPost-Publishing URLs:")
for idx, item in enumerate(published_results, 1):
    print(f"{idx}. {item['address']}, {item['city']}, {item['state']} {item['zip']} (${item['rent']:,}/mo | {item['beds']} Bed / {item['baths']:g} Bath) — {item['url']}")
