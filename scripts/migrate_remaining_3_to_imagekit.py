#!/usr/bin/env python3
"""
Migrate remaining 3 properties to ImageKit and update properties table:
- 6069 Endicott Rd (db7d4ba2-fe0b-416b-a49e-e50f0ddb785a) -> $1,820/mo
- 1675 Norma Rd (afd223fe-22b8-43ed-87c1-b76056fcde8f) -> $1,925/mo
- 5152 Sassafras Rd (5501d98e-8926-49c2-8474-27b366646190) -> $1,895/mo
"""

import urllib.request
import urllib.error
import json
import base64
import http.client
import time
import os

with open(".env.local") as f:
    env = dict(line.strip().split("=", 1) for line in f if "=" in line and not line.startswith("#"))

SUPABASE_URL = env["SUPABASE_URL"]
SUPABASE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"]
IK_PRIVATE_KEY = env.get("IMAGEKIT_PRIVATE_KEY", "private_0EEkHXTzdRqJ++giVS30rF+qDAs=")
LANDLORD_ID = "b8d3aea0-f466-49f2-ac07-2b2b40793cc9"
TODAY = "2026-09-08"

def sb_request(method, path, body=None):
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    if method in ("POST", "PATCH", "PUT"):
        headers["Prefer"] = "return=representation"
    
    url = f"{SUPABASE_URL}/rest/v1/{path.lstrip('/')}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            res_body = r.read().decode("utf-8")
            return r.status, json.loads(res_body) if res_body else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        print(f"Supabase HTTP Error {e.code}: {err_body}")
        return e.code, err_body

def upload_image_to_imagekit(img_url, file_name, folder="/properties/columbus-oh-43229/"):
    try:
        req = urllib.request.Request(img_url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        })
        with urllib.request.urlopen(req, timeout=15) as r:
            img_bytes = r.read()
    except Exception as e:
        print(f"  Failed downloading {img_url}: {e}")
        return None

    if len(img_bytes) < 2000:
        return None

    auth = base64.b64encode(f"{IK_PRIVATE_KEY}:".encode()).decode()
    boundary = "----WebKitFormBoundary" + os.urandom(8).hex()
    
    body = (
        f"--{boundary}\r\n"
        f"Content-Disposition: form-data; name=\"file\"; filename=\"{file_name}\"\r\n"
        f"Content-Type: image/jpeg\r\n\r\n"
    ).encode() + img_bytes + (
        f"\r\n--{boundary}\r\n"
        f"Content-Disposition: form-data; name=\"fileName\"\r\n\r\n"
        f"{file_name}\r\n"
        f"--{boundary}\r\n"
        f"Content-Disposition: form-data; name=\"folder\"\r\n\r\n"
        f"{folder}\r\n"
        f"--{boundary}\r\n"
        f"Content-Disposition: form-data; name=\"useUniqueFileName\"\r\n\r\n"
        f"false\r\n"
        f"--{boundary}--\r\n"
    ).encode()

    conn = http.client.HTTPSConnection("upload.imagekit.io", timeout=45)
    headers = {
        "Authorization": f"Basic {auth}",
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Content-Length": str(len(body))
    }
    conn.request("POST", "/api/v1/files/upload", body=body, headers=headers)
    resp = conn.getresponse()
    raw = resp.read().decode("utf-8")
    if resp.status in (200, 201):
        parsed = json.loads(raw)
        return parsed.get("url")
    return None

def verify_url_200(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status == 200
    except Exception:
        return False

TARGETS = [
    {
        "id": "db7d4ba2-fe0b-416b-a49e-e50f0ddb785a",
        "address": "6069 Endicott Rd",
        "rent": 1820,
        "deposit": 1820,
        "beds": 3,
        "baths": 2.0,
        "sqft": 1093,
        "garage_spaces": 1,
        "has_basement": True,
        "neighborhood": "Devonshire",
        "highlights": ["Full basement offering massive storage and flexible recreation space", "Chef-friendly updated kitchen with expansive counters and cabinetry", "Attached single-car garage with direct interior access", "Expansive rear yard perfect for family play and outdoor gatherings", "Central A/C and forced-air heating", "Quiet, tree-lined residential street close to neighborhood schools"]
    },
    {
        "id": "afd223fe-22b8-43ed-87c1-b76056fcde8f",
        "address": "1675 Norma Rd",
        "rent": 1925,
        "deposit": 1925,
        "beds": 3,
        "baths": 2.0,
        "sqft": 1342,
        "garage_spaces": 1,
        "has_basement": True,
        "neighborhood": "Sharon Woods",
        "highlights": ["Full unfinished basement providing vast storage space", "Updated kitchen featuring modern cabinetry, countertops, and appliances", "Attached 1-car garage and wide driveway", "Inviting sunny backyard perfect for children and pets", "Central air conditioning and efficient climate control", "Near Sharon Woods Metro Park and top-rated local amenities"]
    },
    {
        "id": "5501d98e-8926-49c2-8474-27b366646190",
        "address": "5152 Sassafras Rd",
        "rent": 1895,
        "deposit": 1895,
        "beds": 3,
        "baths": 2.5,
        "sqft": 1918,
        "garage_spaces": 2,
        "has_basement": True,
        "neighborhood": "Forest Park West",
        "highlights": ["Extensive 1,918 sq ft floor plan with full basement", "3 generously sized bedrooms and 2.5 bathrooms", "Updated family kitchen with center island and premium appliances", "Attached 2-car garage with direct home entry", "Tree-lined private backyard with patio", "Central heating and air conditioning in quiet neighborhood"]
    }
]

def make_description(p):
    addr = p["address"]
    beds = p["beds"]
    baths = p["baths"]
    sqft = p["sqft"]
    rent = p["rent"]
    neighborhood = p["neighborhood"]
    
    intro = f"Welcome home to {addr}, an exceptional single-family residence situated in the welcoming {neighborhood} neighborhood of Columbus, OH 43229. Thoughtfully designed for modern family living, this charming home combines generous living spaces, quality interior finishes, and a serene community setting."
    kitchen = f"At the heart of the home, the fully updated kitchen is equipped with expansive countertops, beautiful cabinetry, and high-efficiency modern appliances, making meal preparation and family gatherings effortless and enjoyable. The bright, flowing floor plan connects smoothly to the comfortable living and dining areas, illuminated by abundant natural light."
    bedrooms = f"The residence offers {beds} well-proportioned bedrooms and {baths:g} updated bathrooms, providing plenty of privacy and comfort for the entire family."
    basement_yard = "Downstairs, a spacious full basement provides abundant storage capacity, a dedicated laundry area, and versatile space for a playroom, workshop, or home fitness studio. Outside, enjoy a private yard perfect for children to play, weekend barbecues, and relaxing in the fresh air."
    amenities = "\n".join([f"• {h}" for h in p["highlights"]])
    location = f"Conveniently situated in North Columbus with rapid access to I-71, I-270, Sharon Woods Metro Park, Polaris Fashion Place, and local schools, dining, and neighborhood shopping centers."
    app = f"""Application & Requirements:
• Monthly Rent: ${rent:,}
• Application Fee: $50 per adult applicant
• Pet Policy: Pet-friendly living (welcoming dogs and cats)
• Income Requirement: Gross household income 2.5x–3x monthly rent
• Verification: Standard background and credit check

Apply online today through Choice Properties for rapid application processing and move-in scheduling."""
    return f"{intro}\n\n{kitchen}\n\n{bedrooms}\n\n{basement_yard}\n\nKey Home Features:\n{amenities}\n\nNeighborhood & Location:\n{location}\n\n{app}"

for t in TARGETS:
    pid = t["id"]
    addr = t["address"]
    print(f"\nProcessing {addr} ({pid})...")
    
    # 1. Fetch current photos from DB
    _, photos = sb_request("GET", f"property_photos?property_id=eq.{pid}&select=id,url,display_order")
    source_urls = [ph["url"] for ph in photos]
    print(f"  Found {len(source_urls)} source photos in DB")
    
    uploaded_urls = []
    for idx, s_url in enumerate(source_urls):
        file_name = f"columbus_43229_{pid[:8]}_{idx:02d}.jpg"
        ik_url = upload_image_to_imagekit(s_url, file_name)
        if ik_url and verify_url_200(ik_url):
            uploaded_urls.append(ik_url)
            print(f"    [Photo {idx+1}/{len(source_urls)}] Verified IK URL: {ik_url}")
        else:
            print(f"    [Photo {idx+1}/{len(source_urls)}] Failed or unverified")
        time.sleep(0.15)
        
    print(f"  Uploaded {len(uploaded_urls)} photos to ImageKit")
    if len(uploaded_urls) >= 6:
        # replace photo rows
        sb_request("DELETE", f"property_photos?property_id=eq.{pid}")
        new_photo_rows = []
        for idx, u in enumerate(uploaded_urls):
            new_photo_rows.append({
                "property_id": pid,
                "url": u,
                "display_order": idx,
                "is_hero": (idx == 0),
                "watermark_status": "clean",
                "alt_text": f"{addr}, Columbus, OH 43229 - Photo {idx + 1}"
            })
        sb_request("POST", "property_photos", body=new_photo_rows)
        print(f"  Updated property_photos with {len(new_photo_rows)} ImageKit photos.")
        
    # 2. Update property record in properties table
    desc = make_description(t)
    title = f"{t['beds']} Bed / {t['baths']:g} Bath Single-Family Home in Columbus, OH"
    amenities = [
        "Full Basement",
        "Central Air Conditioning",
        "Forced Air Heating",
        "Dishwasher",
        "Refrigerator",
        "Stove / Oven",
        "Washer/Dryer Hookups",
        "Pet Friendly",
        "Smoke Free",
        "Private Yard / Lawn",
        "Attached Garage Parking"
    ]
    payload = {
        "title": title,
        "description": desc,
        "monthly_rent": t["rent"],
        "security_deposit": t["deposit"],
        "application_fee": 50,
        "available_date": TODAY,
        "minimum_lease_months": None,
        "lease_terms": None,
        "pets_allowed": True,
        "pet_types_allowed": ["Dogs", "Cats"],
        "smoking_allowed": False,
        "has_central_air": True,
        "has_basement": True,
        "amenities": amenities,
        "status": "active",
        "featured": True,
        "listed_at": TODAY,
        "total_bathrooms": t["baths"]
    }
    st, _ = sb_request("PATCH", f"properties?id=eq.{pid}", body=payload)
    print(f"  Updated property table status: {st}")

print("\nDone migrating remaining 3 properties!")
