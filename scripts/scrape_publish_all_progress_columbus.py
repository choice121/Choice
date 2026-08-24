import urllib.request
import re
import json
import http.client
import time
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

SUPABASE_HOST = "tlfmwetmhthpyrytrcfo.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE"
LANDLORD_ID = "b8d3aea0-f466-49f2-ac07-2b2b40793cc9"

HEADERS = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}

COLUMBUS_METRO_CITIES = {
    "columbus", "canal winchester", "galloway", "grove city", "reynoldsburg",
    "blacklick", "delaware", "hilliard", "pickerington", "groveport",
    "pataskala", "dublin", "orient", "westerville", "marysville",
    "lewis center", "etna", "gahanna", "lithopolis", "lockbourne",
    "powell", "sunbury", "plain city", "commercial point", "johnstown",
    "new albany", "bexley", "upper arlington", "grandview heights", "worthington"
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
    st, rows = sb_request("GET", "/rest/v1/properties?state=eq.OH&select=address")
    if isinstance(rows, list):
        return {r.get('address', '').strip().lower() for r in rows if r.get('address')}
    return set()

def fetch_progress_metro_urls():
    headers = {'User-Agent': 'Mozilla/5.0'}
    req = urllib.request.Request('https://rentprogress.com/sitemap.oh.xml', headers=headers)
    with urllib.request.urlopen(req, timeout=20) as r:
        xml = r.read().decode('utf-8')

    urls = re.findall(r'<loc>(https://rentprogress\.com/property-details/[^<]+)</loc>', xml)
    metro_urls = []
    for u in urls:
        parts = u.split('/')
        if len(parts) >= 6:
            city_slug = parts[5].replace('-', ' ').lower()
            if city_slug in COLUMBUS_METRO_CITIES:
                metro_urls.append(u)
    return metro_urls

def clean_rental_description(address, city, state, zip_code, beds, baths, rent, sqft):
    overview = f"Welcome to {address} — a beautifully maintained {beds}-bedroom, {baths:g}-bathroom home offering {sqft:,} sq ft of exceptional comfort and living space in {city}, {state} {zip_code}."
    body = f"This home features an inviting layout with bright natural light, comfortable living spaces, and quality finishes throughout the home."
    features = f"""Key Property Highlights:
• {beds} Bedrooms, {baths:g} Bathrooms ({sqft:,} Sq Ft)
• Central air conditioning and forced-air heating for year-round climate control
• Fully equipped kitchen with abundant cabinet storage and modern countertop surfaces
• Spacious living areas designed for everyday ease and relaxation
• Dedicated private parking / attached garage
• Pet-friendly living (dogs and cats welcome)

Lease & Application Terms:
• Monthly Rent: ${rent:,}
• Security Deposit: ${rent:,} (equal to 1 month's rent)
• Application Fee: $50 per adult applicant
• Lease Term: 12 months minimum
• Pet Policy: Welcoming dogs and cats

Apply directly online today through Choice Properties for immediate processing."""
    return f"{overview}\n\n{body}\n\n{features}"

def scrape_progress_property(url):
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode('utf-8')
        
        # 1. High-res photos
        photo_matches = re.findall(r'https://photos\.rentprogress\.com/WebPhotos/[^\s"\'<>]+(?:-lg|-orig|-xl)\.jpg', html)
        clean_photos = []
        for p in photo_matches:
            if p not in clean_photos:
                clean_photos.append(p)
        
        # 2. Extract JSON-LD
        json_ld_matches = re.findall(r'<script[^>]*type=[\'"]application/ld\+json[\'"][^>]*>(.*?)</script>', html, re.DOTALL)
        for raw_json in json_ld_matches:
            raw_json = raw_json.strip()
            if 'RealEstateListing' in raw_json:
                try:
                    data = json.loads(raw_json)
                    graph = data.get('@graph', [data])
                    for item in graph:
                        if item.get('@type') == 'RealEstateListing':
                            about = item.get('about', {})
                            address_obj = about.get('address', {})
                            geo = about.get('geo', {})
                            floor = about.get('floorSize', {})
                            offers = item.get('offers', {})
                            
                            street = address_obj.get('streetAddress', '').strip()
                            city = address_obj.get('addressLocality', '').strip()
                            state = address_obj.get('addressRegion', 'OH').strip().upper()
                            zip_code = str(address_obj.get('postalCode', '')).strip()
                            
                            beds = int(about.get('numberOfBedrooms') or 3)
                            baths = float(about.get('numberOfBathroomsTotal') or 2.0)
                            sqft = int(float(floor.get('value') or 1500))
                            
                            raw_price = offers.get('price')
                            rent = int(round(float(raw_price))) if raw_price else 1850
                            
                            lat = float(geo.get('latitude')) if geo.get('latitude') else None
                            lng = float(geo.get('longitude')) if geo.get('longitude') else None
                            
                            return {
                                "street": street,
                                "city": city,
                                "state": state,
                                "zip": zip_code,
                                "beds": beds,
                                "baths": baths,
                                "sqft": sqft,
                                "rent": rent,
                                "lat": lat,
                                "lng": lng,
                                "photos": clean_photos
                            }
                except Exception as e:
                    pass
    except Exception as e:
        pass
    return None

def process_property(u, existing_addrs, lock, today):
    p = scrape_progress_property(u)
    if not p:
        return None, "scrape_failed"
    
    address = p.get('street', '').strip()
    city = p.get('city', '').strip()
    state = p.get('state', 'OH').strip().upper()
    zip_code = p.get('zip', '').strip()
    
    if not address or not city:
        return None, "missing_fields"
    
    with lock:
        if address.lower() in existing_addrs:
            return None, "already_exists"
        existing_addrs.add(address.lower())
        
    photos = p.get('photos', [])
    if len(photos) < 6:
        return None, "insufficient_photos"
        
    beds = p['beds']
    baths = p['baths']
    sqft = p['sqft']
    rent = p['rent']
    deposit = rent
    app_fee = 50
    
    prop_id = str(uuid.uuid4())
    title = f"{beds}BR/{baths:g}BA Single-Family Home in {city} – ${rent:,}/mo"
    desc = clean_rental_description(address, city, state, zip_code, beds, baths, rent, sqft)
    
    amenities = [
        "Air Conditioning",
        "Central Heating",
        "Refrigerator",
        "Range / Oven",
        "Pet Friendly",
        "Spacious Layout",
        "Smoke Free",
        "Washer/Dryer Hookups",
        "Dedicated Parking / Garage"
    ]
    
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
        "lat": p['lat'],
        "lng": p['lng'],
        "property_type": "SINGLE_FAMILY",
        "bedrooms": beds,
        "bathrooms": int(baths),
        "total_bathrooms": baths,
        "square_footage": sqft,
        "garage_spaces": 1,
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
        return None, f"insert_failed_{st}"
        
    photo_rows = []
    for idx, p_url in enumerate(photos):
        photo_rows.append({
            "property_id": prop_id,
            "url": p_url,
            "display_order": idx,
            "is_hero": (idx == 0),
            "watermark_status": "clean",
            "alt_text": f"{address}, {city} OH - Photo {idx + 1}"
        })
        
    sb_request("POST", "/rest/v1/property_photos", body=photo_rows, extra_headers={"Prefer": "return=minimal"})
    
    pub_info = {
        "id": prop_id,
        "address": address,
        "city": city,
        "state": state,
        "zip": zip_code,
        "rent": rent,
        "bedrooms": beds,
        "bathrooms": baths,
        "photos_count": len(photos),
        "url": f"https://choice-properties-site.pages.dev/property.html?id={prop_id}"
    }
    return pub_info, "published"

def main():
    print("=" * 70)
    print("CHOICE PROPERTIES — FULL GREATER COLUMBUS METRO PROGRESS PIPELINE")
    print("=" * 70)
    
    existing_addrs = get_existing_addresses()
    print(f"Found {len(existing_addrs)} existing Ohio properties in DB.")
    
    urls = fetch_progress_metro_urls()
    print(f"Discovered {len(urls)} Greater Columbus Metro properties on Progress Residential.")
    
    lock = threading.Lock()
    today = "2026-08-23"
    published = []
    skipped = 0
    failed = 0
    
    start_time = time.time()
    
    with ThreadPoolExecutor(max_workers=8) as executor:
        future_to_url = {executor.submit(process_property, u, existing_addrs, lock, today): u for u in urls}
        
        for i, future in enumerate(as_completed(future_to_url), 1):
            u = future_to_url[future]
            try:
                res, status = future.result()
                if status == "published" and res:
                    published.append(res)
                    print(f"[{i}/{len(urls)}] PUBLISHED: {res['address']}, {res['city']} OH (${res['rent']:,}/mo | {res['photos_count']} photos) -> ID: {res['id']}")
                elif status == "already_exists":
                    skipped += 1
                    print(f"[{i}/{len(urls)}] Skipped (already in DB): {u.split('/')[-5]}")
                else:
                    failed += 1
                    print(f"[{i}/{len(urls)}] Failed ({status}): {u.split('/')[-5]}")
            except Exception as exc:
                failed += 1
                print(f"[{i}/{len(urls)}] Exception: {exc}")
                
            if i % 25 == 0:
                with open("published_progress_columbus.json", "w") as f:
                    json.dump(published, f, indent=2)
                    
    elapsed = time.time() - start_time
    print("\n" + "=" * 70)
    print(f"PIPELINE COMPLETED in {elapsed:.1f}s: {len(published)} Published, {skipped} Skipped, {failed} Failed.")
    print("=" * 70)
    
    with open("published_progress_columbus.json", "w") as f:
        json.dump(published, f, indent=2)
        
    return published

if __name__ == "__main__":
    main()
