import os
import re
import json
import uuid
import time
import http.client
from datetime import datetime

SUPABASE_HOST = "tlfmwetmhthpyrytrcfo.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE"
LANDLORD_ID = "b8d3aea0-f466-49f2-ac07-2b2b40793cc9" # Choice Properties

HEADERS = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}

def sb_request(method, path, body=None, extra_headers=None):
    conn = http.client.HTTPSConnection(SUPABASE_HOST, timeout=60)
    headers = dict(HEADERS)
    if extra_headers:
        headers.update(extra_headers)
    data = json.dumps(body) if body is not None else None
    conn.request(method, path, body=data, headers=headers)
    resp = conn.getresponse()
    resp_body = resp.read().decode()
    try:
        json_data = json.loads(resp_body) if resp_body else {}
    except Exception:
        json_data = resp_body
    return resp.status, json_data

def clean_rental_description(raw_desc, address, city, state, zip_code, beds, baths, rent, prop_type="Single-Family Home"):
    cleaned = raw_desc or ""
    # Strip any Realtor contacts, agent names, external links, MLS IDs, sales language
    patterns_to_remove = [
        r"(?i)\bfor sale\b",
        r"(?i)\basking price\b",
        r"(?i)\blist price\b",
        r"(?i)\bbuy direct\b",
        r"(?i)\bopendoor\b",
        r"(?i)\bzillow\b",
        r"(?i)\brealtor(?:\.com)?\b",
        r"(?i)\bMLS\s*#?\s*\d+\b",
        r"(?i)\bopen house\b",
        r"(?i)\bin contract\b",
        r"(?i)\bseller disclosures\b",
        r"(?i)\bcall\s+(?:\d{3}[-.\s]??\d{3}[-.\s]??\d{4}|\b[A-Za-z\s]+agent\b)",
        r"(?i)https?://\S+",
        r"(?i)\bapply at \S+\b",
        r"(?i)\bthird-party applications will not be considered\b",
        r"(?i)\ball applications must be submitted using the official link provided by the listing agent\b",
        r"(?i)\bcontact (?:the )?agent\b",
    ]
    for p in patterns_to_remove:
        cleaned = re.sub(p, "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    overview = f"Welcome to {address} — a beautifully maintained {beds}-bedroom, {baths:g}-bathroom {prop_type.lower()} offering exceptional comfort, modern conveniences, and spacious living in {city}, {state} {zip_code}."
    body = cleaned if len(cleaned) > 40 else f"This property features a bright and inviting floor plan with generous natural light, comfortable living spaces, and quality finishes throughout."
    
    features = f"""Key Property Highlights:
• {beds} Bedrooms, {baths:g} Bathrooms
• Central air conditioning and high-efficiency heating for year-round comfort
• Well-appointed kitchen with abundant cabinet storage and modern countertops
• Generous living and dining areas designed for everyday ease and relaxation
• Dedicated private parking
• Pet-friendly living (dogs and cats welcome)

Lease & Application Terms:
• Monthly Rent: ${rent:,}
• Security Deposit: ${rent:,} (equal to 1 month's rent)
• Application Fee: $50 per adult applicant
• Lease Term: 12 months minimum
• Pet Policy: Welcoming dogs and cats

Apply directly online today through Choice Properties for fast, seamless processing."""
    
    return f"{overview}\n\n{body}\n\n{features}"

def main():
    with open("scripts/yukon_candidates.json") as f:
        candidates = json.load(f)

    # 3 Townhomes
    selected_townhomes = candidates["townhomes"][:3]
    # 5 Houses
    selected_houses = candidates["houses"][:5]

    all_to_publish = []
    for th in selected_townhomes:
        th['property_type'] = 'TOWNHOUSE'
        th['type_label'] = 'Townhome'
        all_to_publish.append(th)

    for h in selected_houses:
        h['property_type'] = 'SINGLE_FAMILY'
        h['type_label'] = 'Single-Family Home'
        all_to_publish.append(h)

    print(f"Preparing to publish {len(all_to_publish)} properties ({len(selected_townhomes)} townhomes, {len(selected_houses)} houses)...")

    published = []
    today = datetime.now().strftime("%Y-%m-%d")

    for i, p in enumerate(all_to_publish, 1):
        address = p['address'].strip()
        city = p['city'].strip()
        state = p['state'].strip()
        zip_code = p['zip'].strip()
        beds = int(p['beds'])
        baths = float(p['baths'])
        sqft = int(p['sqft'])
        rent = int(p['rent'])
        deposit = rent # Security deposit = 1x rent
        app_fee = 50   # Application fee = $50
        prop_type = p['property_type']
        type_label = p['type_label']
        photos = p['photos']

        print(f"\n[{i}/{len(all_to_publish)}] Publishing: {address}, {city}, {state} {zip_code}")
        print(f"  Rent: ${rent}/mo | Beds: {beds} | Baths: {baths} | Sqft: {sqft} | Photos: {len(photos)}")

        # Verification check: minimum 6 photos
        if len(photos) < 6:
            print(f"  ❌ Error: {address} has fewer than 6 photos ({len(photos)}). Skipping.")
            continue

        desc = clean_rental_description(
            raw_desc=p.get('full_desc', ''),
            address=address,
            city=city,
            state=state,
            zip_code=zip_code,
            beds=beds,
            baths=baths,
            rent=rent,
            prop_type=type_label
        )

        title = f"{beds} Bed / {int(baths) if baths.is_integer() else baths} Bath {type_label} in {city} – ${rent:,}/mo"

        amenities = [
            "Air Conditioning",
            "Central Heating",
            "Refrigerator",
            "Range / Oven",
            "Dishwasher",
            "Pet Friendly",
            "Spacious Layout",
            "Washer/Dryer Hookups",
            "Dedicated Parking"
        ]

        prop_id = str(uuid.uuid4())

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
            "bedrooms": beds,
            "bathrooms": int(baths),
            "total_bathrooms": baths,
            "square_footage": sqft,
            "garage_spaces": 2,
            "monthly_rent": rent,
            "security_deposit": deposit,
            "application_fee": app_fee,
            "available_date": today,
            "minimum_lease_months": 12,
            "lease_terms": ["12 months"],
            "pets_allowed": True,
            "pet_types_allowed": ["Dogs", "Cats"],
            "pet_deposit": 0,
            "smoking_allowed": False,
            "has_central_air": True,
            "parking": "Garage & Driveway Parking",
            "heating_type": "Central Forced Air",
            "cooling_type": "Central Air Conditioning",
            "laundry_type": "In-Unit Hookups",
            "amenities": amenities,
            "appliances": ["Refrigerator", "Stove / Range", "Dishwasher", "Microwave", "Washer/Dryer Hookups"],
            "status": "active",
            "listed_at": today,
            "featured": False
        }

        st, ins_res = sb_request("POST", "/rest/v1/properties", body=payload, extra_headers={"Prefer": "return=representation"})
        if st not in (200, 201) or not ins_res:
            print(f"  ❌ Insert property failed HTTP {st}: {ins_res}")
            continue

        # Insert photos
        photo_rows = []
        for idx, p_url in enumerate(photos):
            photo_rows.append({
                "property_id": prop_id,
                "url": p_url,
                "display_order": idx,
                "is_hero": (idx == 0),
                "watermark_status": "clean",
                "alt_text": f"{address}, {city} OK - Photo {idx + 1}"
            })

        st_p, ins_p = sb_request("POST", "/rest/v1/property_photos", body=photo_rows, extra_headers={"Prefer": "return=minimal"})
        if st_p not in (200, 201):
            print(f"  ⚠️ Warning: Photo insert returned HTTP {st_p}: {ins_p}")

        pub_entry = {
            "id": prop_id,
            "address": address,
            "city": city,
            "state": state,
            "zip": zip_code,
            "rent": rent,
            "bedrooms": beds,
            "bathrooms": int(baths) if baths.is_integer() else baths,
            "property_type": prop_type,
            "photos_count": len(photos),
            "url": f"https://choice-properties-site.pages.dev/property.html?id={prop_id}"
        }
        published.append(pub_entry)
        print(f"  ✅ SUCCESS: {address} published -> https://choice-properties-site.pages.dev/property.html?id={prop_id}")
        time.sleep(0.3)

    print("\n" + "=" * 70)
    print(f"PUBLISHING COMPLETE: {len(published)} of {len(all_to_publish)} listings live.")
    print("=" * 70)

    with open("scripts/published_yukon_batch.json", "w") as f:
        json.dump(published, f, indent=2)

    return published

if __name__ == "__main__":
    main()
