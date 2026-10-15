#!/usr/bin/env python3
import urllib.request
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

def sb_request(method, path, body=None):
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    url = f"{SUPABASE_URL}/rest/v1/{path.lstrip('/')}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as r:
        b = r.read().decode("utf-8")
        return r.status, json.loads(b) if b else {}

def upload_image_to_imagekit(img_url, file_name, folder="/properties/columbus-oh-43229/"):
    try:
        req = urllib.request.Request(img_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            img_bytes = r.read()
    except Exception as e:
        print(f"  Download error: {e}")
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
        return json.loads(raw).get("url")
    return None

# 1. FIX 1675 Norma Rd (afd223fe-22b8-43ed-87c1-b76056fcde8f)
norma_id = "afd223fe-22b8-43ed-87c1-b76056fcde8f"
print("Fixing 1675 Norma Rd photos in DB...")
sb_request("DELETE", f"property_photos?property_id=eq.{norma_id}")
norma_photos = []
for i in range(11):
    u = f"https://ik.imagekit.io/21rg7lvzo/properties/columbus-oh-43229/columbus_43229_afd223fe_{i:02d}.jpg"
    norma_photos.append({
        "property_id": norma_id,
        "url": u,
        "display_order": i,
        "is_hero": (i == 0),
        "watermark_status": "clean",
        "alt_text": f"1675 Norma Rd, Columbus, OH 43229 - Photo {i + 1}"
    })
sb_request("POST", "property_photos", body=norma_photos)
print(f"Inserted {len(norma_photos)} ImageKit photos for 1675 Norma Rd.")

# 2. FIX 5152 Sassafras Rd (5501d98e-8926-49c2-8474-27b366646190)
sassafras_id = "5501d98e-8926-49c2-8474-27b366646190"
print("\nFetching current photos for 5152 Sassafras Rd...")
_, cur_photos = sb_request("GET", f"property_photos?property_id=eq.{sassafras_id}&select=id,url")
source_urls = [p["url"] for p in cur_photos]
print(f"Found {len(source_urls)} source photos for Sassafras Rd")

sassafras_uploaded = []
for idx, s_url in enumerate(source_urls):
    fn = f"columbus_43229_5501d98e_{idx:02d}.jpg"
    ik_url = upload_image_to_imagekit(s_url, fn)
    if ik_url:
        sassafras_uploaded.append(ik_url)
        print(f"  [Photo {idx+1}/{len(source_urls)}] Uploaded: {ik_url}")
    time.sleep(0.15)

if len(sassafras_uploaded) >= 6:
    sb_request("DELETE", f"property_photos?property_id=eq.{sassafras_id}")
    new_rows = []
    for idx, u in enumerate(sassafras_uploaded):
        new_rows.append({
            "property_id": sassafras_id,
            "url": u,
            "display_order": idx,
            "is_hero": (idx == 0),
            "watermark_status": "clean",
            "alt_text": f"5152 Sassafras Rd, Columbus, OH 43229 - Photo {idx + 1}"
        })
    sb_request("POST", "property_photos", body=new_rows)
    print(f"Inserted {len(new_rows)} ImageKit photos for 5152 Sassafras Rd.")

# Update property record for Sassafras Rd
s_desc = """Welcome home to 5152 Sassafras Rd, an exceptional single-family residence situated in the welcoming Forest Park West neighborhood of Columbus, OH 43229. Thoughtfully designed for modern family living, this charming home combines generous living spaces, quality interior finishes, and a serene community setting.

At the heart of the home, the fully updated kitchen is equipped with expansive countertops, beautiful cabinetry, and high-efficiency modern appliances, making meal preparation and family gatherings effortless and enjoyable. The bright, flowing floor plan connects smoothly to the comfortable living and dining areas, illuminated by abundant natural light.

The residence offers 3 well-proportioned bedrooms and 2.5 updated bathrooms, providing plenty of privacy and comfort for the entire family.

Downstairs, a spacious full basement provides abundant storage capacity, a dedicated laundry area, and versatile space for a playroom, workshop, or home fitness studio. Outside, enjoy a private yard perfect for children to play, weekend barbecues, and relaxing in the fresh air.

Key Home Features:
• Extensive 1,918 sq ft floor plan with full basement
• 3 generously sized bedrooms and 2.5 bathrooms
• Updated family kitchen with center island and premium appliances
• Attached 2-car garage with direct home entry
• Tree-lined private backyard with patio
• Central heating and air conditioning in quiet neighborhood

Neighborhood & Location:
Conveniently situated in North Columbus with rapid access to I-71, I-270, Sharon Woods Metro Park, Polaris Fashion Place, and local schools, dining, and neighborhood shopping centers.

Application & Requirements:
• Monthly Rent: $1,895
• Application Fee: $50 per adult applicant
• Pet Policy: Pet-friendly living (welcoming dogs and cats)
• Income Requirement: Gross household income 2.5x–3x monthly rent
• Verification: Standard background and credit check

Apply online today through Choice Properties for rapid application processing and move-in scheduling."""

payload = {
    "title": "3 Bed / 2.5 Bath Single-Family Home in Columbus, OH",
    "description": s_desc,
    "monthly_rent": 1895,
    "security_deposit": 1895,
    "application_fee": 50,
    "available_date": "2026-09-08",
    "minimum_lease_months": None,
    "lease_terms": None,
    "pets_allowed": True,
    "pet_types_allowed": ["Dogs", "Cats"],
    "smoking_allowed": False,
    "has_central_air": True,
    "has_basement": True,
    "status": "active",
    "featured": True,
    "listed_at": "2026-09-08",
    "total_bathrooms": 2.5
}
sb_request("PATCH", f"properties?id=eq.{sassafras_id}", body=payload)
print("Updated 5152 Sassafras Rd properties row successfully!")
