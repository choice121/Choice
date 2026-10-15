import re
import json
import time
import base64
import random
import requests
from curl_cffi import requests as cffi_requests

SUPABASE_URL = "https://tlfmwetmhthpyrytrcfo.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE"
IK_PRIVATE_KEY = "private_0EEkHXTzdRqJ++giVS30rF+qDAs="
IK_UPLOAD_URL = "https://upload.imagekit.io/api/v1/files/upload"

PROPERTIES = [
    {"prop_id": "prop-0e836f1c", "address": "293 N Burgess Ave", "zpid": 33850600},
    {"prop_id": "prop-beb8c409", "address": "1868 Argyle Dr", "zpid": 33920455}
]

def make_session():
    session = cffi_requests.Session(impersonate="chrome120")
    return session

def warm_zillow(session):
    session.get("https://www.zillow.com/", timeout=15)
    time.sleep(1)

def extract_photos_from_next_data(data):
    photos = []
    try:
        props = data.get("props", {}).get("pageProps", {}).get("componentProps", {})
        gdp = props.get("gdpClientCache", "")
        if gdp:
            gdp = json.loads(gdp)
            for k, v in gdp.items():
                if "property" in v:
                    imgs = v["property"].get("originalPhotos", [])
                    if imgs:
                        for im in imgs:
                            u = im.get("url") or im.get("mixedSources", {}).get("jpeg", [])[-1].get("url")
                            if u and u not in photos:
                                photos.append(u)
    except:
        pass
    return photos

def get_zillow_photos(session, zpid, address):
    url = f"https://www.zillow.com/homes/{zpid}_zpid/"
    print(f"  Fetching: {url}")
    try:
        resp = session.get(url, timeout=20)
        if resp.status_code == 403:
            print("  403 Forbidden")
            return []
        html = resp.text
        match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.DOTALL)
        if match:
            data = json.loads(match.group(1))
            photos = extract_photos_from_next_data(data)
            if photos:
                return photos
        
        found = re.findall(r'https://photos\.zillowstatic\.com/fp/[a-zA-Z0-9_-]+-p_[a-z]\.jpg', html)
        found.extend(re.findall(r'https://photos\.zillowstatic\.com/fp/[a-zA-Z0-9_-]+\.jpg', html))
        return list(dict.fromkeys(found))
    except Exception as e:
        print(e)
        return []

def download_image(url):
    try:
        r = requests.get(url, timeout=20)
        if r.status_code == 200:
            return r.content, "jpg"
    except:
        pass
    return None, None

def upload_to_imagekit(image_bytes, filename, folder):
    auth = base64.b64encode((IK_PRIVATE_KEY + ":").encode()).decode()
    resp = requests.post(
        IK_UPLOAD_URL,
        headers={"Authorization": f"Basic {auth}"},
        files={"file": (filename, image_bytes, "image/jpeg")},
        data={"fileName": filename, "folder": folder, "useUniqueFileName": "false"}
    )
    if resp.status_code == 200:
        d = resp.json()
        return d.get("url"), d.get("fileId")
    return None, None

def main():
    session = make_session()
    warm_zillow(session)
    for prop in PROPERTIES:
        prop_id, zpid, address = prop["prop_id"], prop["zpid"], prop["address"]
        print(f"Processing {address}")
        
        # 1. Fetch Zillow photos
        urls = get_zillow_photos(session, zpid, address)
        if not urls:
            print("No photos found.")
            continue
        
        urls = urls[:15]
        print(f"Found {len(urls)} photos")
        
        # 2. Upload
        folder = f"properties/{prop_id.lower()}"
        uploaded = []
        for j, url in enumerate(urls):
            img_bytes, ext = download_image(url)
            if img_bytes:
                ik_url, file_id = upload_to_imagekit(img_bytes, f"photo_{j+1:02d}.jpg", folder)
                if ik_url:
                    uploaded.append({"url": ik_url, "file_id": file_id})
                    print(f"Uploaded {j+1}")
        
        if not uploaded:
            continue
            
        # 3. Delete old
        requests.delete(f"{SUPABASE_URL}/rest/v1/property_photos?property_id=eq.{prop_id}", headers={
            "apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"
        })
        
        # 4. Insert new
        new_rows = []
        for order, photo in enumerate(uploaded):
            new_rows.append({
                "property_id": prop_id,
                "url": photo["url"],
                "file_id": photo["file_id"],
                "display_order": order,
                "alt_text": f"{address} — photo {order + 1}",
                "watermark_status": "pending",
                "is_hero": order == 0
            })
            
        r = requests.post(f"{SUPABASE_URL}/rest/v1/property_photos", json=new_rows, headers={
            "apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json", "Prefer": "return=representation"
        })
        print(f"Insert DB: {r.status_code}")
        
        # 5. Reactivate property
        requests.patch(f"{SUPABASE_URL}/rest/v1/properties?id=eq.{prop_id}", json={"status": "active"}, headers={
            "apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}", "Content-Type": "application/json"
        })

main()
