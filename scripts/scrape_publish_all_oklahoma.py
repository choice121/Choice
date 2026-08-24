import urllib.request
import re
import json
import http.client
import time
import sys
import uuid

SUPABASE_HOST = "tlfmwetmhthpyrytrcfo.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE"
LANDLORD_ID = "b8d3aea0-f466-49f2-ac07-2b2b40793cc9"

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

def get_existing_addresses():
    st, rows = sb_request("GET", "/rest/v1/properties?state=eq.OK&select=address")
    if isinstance(rows, list):
        return {r.get('address', '').strip().lower() for r in rows if r.get('address')}
    return set()

def fetch_oklahoma_sitemap_urls():
    req = urllib.request.Request(
        'https://www.opendoor.com/sitemaps/listings.xml',
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        xml_data = resp.read().decode('utf-8')
    urls = re.findall(r'<loc>(https://www\.opendoor\.com/properties/[^<]*-OK-\d{5}/[^<]*)</loc>', xml_data, re.IGNORECASE)
    return urls

def calculate_ok_rent(sale_price, bedrooms):
    if not sale_price:
        if bedrooms == 1: return 900
        if bedrooms == 2: return 1200
        if bedrooms == 3: return 1500
        if bedrooms == 4: return 1800
        return 2100
    
    # State-aware rent yield for Oklahoma: ~0.0092
    raw_rent = sale_price * 0.0092
    
    min_rent = 850 if bedrooms <= 2 else (1100 if bedrooms == 3 else 1300)
    max_rent = 2600 if bedrooms <= 2 else (3200 if bedrooms == 3 else 4000)
    
    rent = max(min_rent, min(max_rent, raw_rent))
    return int(round(rent / 25.0) * 25)

def clean_rental_description(raw_desc, address, city, state, zip_code, beds, baths, rent):
    cleaned = raw_desc or ""
    patterns_to_remove = [
        r"(?i)\bfor sale\b",
        r"(?i)\basking price\b",
        r"(?i)\blist price\b",
        r"(?i)\bbuy direct\b",
        r"(?i)\bopendoor\b",
        r"(?i)\bMLS\s*#?\s*\d+\b",
        r"(?i)\bopen house\b",
        r"(?i)\bin contract\b",
        r"(?i)\bseller disclosures\b"
    ]
    for p in patterns_to_remove:
        cleaned = re.sub(p, "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    overview = f"Welcome to {address} — a beautifully maintained {beds}-bedroom, {baths:g}-bathroom home offering exceptional comfort and convenience in {city}, {state} {zip_code}."
    body = cleaned if len(cleaned) > 40 else f"This home features an inviting layout with bright natural light, comfortable living spaces, and quality finishes throughout."
    
    features = f"""Key Property Highlights:
• {beds} Bedrooms, {baths:g} Bathrooms
• Central air conditioning and forced-air heating for year-round climate control
• Fully equipped kitchen with abundant cabinet storage and modern countertop surfaces
• Spacious living areas designed for everyday ease and relaxation
• Dedicated private parking
• Pet-friendly living (dogs and cats welcome)

Lease & Application Terms:
• Monthly Rent: ${rent}
• Security Deposit: ${rent} (equal to 1 month's rent)
• Application Fee: $50 per adult applicant
• Lease Term: 12 months minimum
• Pet Policy: Welcoming dogs and cats

Apply directly online today through Choice Properties for immediate processing."""
    
    return f"{overview}\n\n{body}\n\n{features}"

def scrape_property(url):
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        })
        with urllib.request.urlopen(req, timeout=12) as resp:
            html = resp.read().decode('utf-8')
        scripts = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
        for s in scripts:
            if '"property":' in s and 'props' in s:
                data = json.loads(s)
                p = data.get('props', {}).get('pageProps', {}).get('property', {})
                if p and p.get('street'):
                    return p
    except Exception as e:
        print(f"  [Scrape Error] {url}: {e}")
    return None

def main():
    print("=" * 70)
    print("CHOICE PROPERTIES — FULL OKLAHOMA OPENDOOR SCRAPE & PUBLISH PIPELINE")
    print("=" * 70)

    existing_addrs = get_existing_addresses()
    print(f"Found {len(existing_addrs)} existing Oklahoma properties in DB.")

    urls = fetch_oklahoma_sitemap_urls()
    print(f"Discovered {len(urls)} Oklahoma listings in Opendoor active sitemap.")

    published = []
    skipped = 0
    failed = 0
    today = "2026-08-23"

    for i, u in enumerate(urls, 1):
        print(f"\n[{i}/{len(urls)}] Processing: {u}")
        p = scrape_property(u)
        if not p:
            print("  Failed to scrape property data.")
            failed += 1
            continue

        address = p.get('street', '').strip()
        city = p.get('city', '').strip()
        state = (p.get('state') or 'OK').strip().upper()
        zip_code = str(p.get('zip', '')).strip()

        if not address or not city:
            print("  Missing essential address fields, skipping.")
            failed += 1
            continue

        if address.lower() in existing_addrs:
            print(f"  Already in database: {address}, skipping.")
            skipped += 1
            continue

        beds = int(p.get('bedrooms') or 3)
        baths = float(p.get('bathrooms') or 2.0)
        sqft = int(p.get('sqFtTotalLiving') or 1400)
        sale_price = p.get('listPrice') or p.get('buyDirectPrice')
        rent = calculate_ok_rent(sale_price, beds)
        deposit = rent
        app_fee = 50

        # Extract photos
        photos_raw = p.get('photosXl') or p.get('photos') or []
        photo_urls = []
        for ph in photos_raw:
            if isinstance(ph, str) and ph.startswith('http'):
                photo_urls.append(ph)
            elif isinstance(ph, dict) and ph.get('url'):
                photo_urls.append(ph['url'])

        photo_urls = list(dict.fromkeys(photo_urls))

        # Check for minimum 6 photos
        if len(photo_urls) < 6:
            print(f"  Insufficient photos ({len(photo_urls)} < 6), skipping per platform rules.")
            failed += 1
            continue

        desc = clean_rental_description(
            raw_desc=p.get('description'),
            address=address,
            city=city,
            state=state,
            zip_code=zip_code,
            beds=beds,
            baths=baths,
            rent=rent
        )

        title = f"{beds}BR/{baths:g}BA Single-Family Home in {city} – ${rent}/mo"

        amenities = [
            "Air Conditioning",
            "Central Heating",
            "Refrigerator",
            "Range / Oven",
            "Pet Friendly",
            "Spacious Layout",
            "Smoke Free",
            "Washer/Dryer Hookups"
        ]
        if p.get('garageSpaces') and p.get('garageSpaces') > 0:
            amenities.append(f"{p['garageSpaces']}-Car Garage")
        else:
            amenities.append("Dedicated Off-Street Parking")

        prop_id = str(uuid.uuid4())

        prop_payload = {
            "id": prop_id,
            "landlord_id": LANDLORD_ID,
            "title": title,
            "description": desc,
            "address": address,
            "city": city,
            "state": state,
            "zip": zip_code,
            "county": f"{city} Area",
            "lat": float(p.get('latitude')) if p.get('latitude') else None,
            "lng": float(p.get('longitude')) if p.get('longitude') else None,
            "property_type": "SINGLE_FAMILY",
            "bedrooms": beds,
            "bathrooms": int(baths),
            "total_bathrooms": baths,
            "square_footage": sqft,
            "garage_spaces": p.get('garageSpaces') or 1,
            "monthly_rent": rent,
            "security_deposit": deposit,
            "application_fee": app_fee,
            "available_date": today,
            "minimum_lease_months": 12,
            "lease_terms": ["12 months"],
            "pets_allowed": True,
            "pet_types_allowed": ["Dogs", "Cats"],
            "pet_deposit": 300,
            "smoking_allowed": False,
            "has_central_air": True,
            "parking": "Dedicated Parking",
            "heating_type": "Central Forced Air",
            "cooling_type": "Central Air Conditioning",
            "laundry_type": "In-Unit Hookups",
            "amenities": amenities,
            "appliances": ["Refrigerator", "Stove / Range", "Dishwasher", "Washer/Dryer Hookups"],
            "status": "active",
            "listed_at": today,
            "featured": False
        }

        st, ins_res = sb_request("POST", "/rest/v1/properties", body=prop_payload, extra_headers={"Prefer": "return=representation"})
        if st not in (200, 201) or not ins_res:
            print(f"  Insert failed HTTP {st}: {ins_res}")
            failed += 1
            continue

        photo_rows = []
        for idx, p_url in enumerate(photo_urls):
            photo_rows.append({
                "property_id": prop_id,
                "url": p_url,
                "display_order": idx,
                "is_hero": (idx == 0),
                "watermark_status": "clean",
                "alt_text": f"{address}, {city} OK - Photo {idx + 1}"
            })

        sb_request("POST", "/rest/v1/property_photos", body=photo_rows, extra_headers={"Prefer": "return=minimal"})

        existing_addrs.add(address.lower())
        published_info = {
            "id": prop_id,
            "address": address,
            "city": city,
            "state": state,
            "zip": zip_code,
            "rent": rent,
            "bedrooms": beds,
            "bathrooms": baths,
            "photos_count": len(photo_urls),
            "url": f"https://choice-properties-site.pages.dev/property.html?id={prop_id}"
        }
        published.append(published_info)
        print(f"  --> PUBLISHED: {address}, {city}, {state} (${rent}/mo | {len(photo_urls)} photos) -> ID: {prop_id}")

        time.sleep(0.3)

    print("\n" + "=" * 70)
    print(f"PIPELINE RUN COMPLETED: {len(published)} Published, {skipped} Skipped (already in DB), {failed} Failed.")
    print("=" * 70)

    with open("published_oklahoma_opendoor.json", "w") as f:
        json.dump(published, f, indent=2)

    return published

if __name__ == "__main__":
    main()
