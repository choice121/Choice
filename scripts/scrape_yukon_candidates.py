import os
import json
import requests
import pandas as pd
from homeharvest import scrape_property

for path in ['.env', '../.env', 'scraper/.env']:
    if os.path.exists(path):
        with open(path) as f:
            for l in f:
                if '=' in l and not l.startswith('#'):
                    k, v = l.strip().split('=', 1)
                    os.environ[k] = v.strip('"\'')
        break

url = os.environ.get('SUPABASE_URL', 'https://tlfmwetmhthpyrytrcfo.supabase.co')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
headers = {'apikey': key, 'Authorization': f'Bearer {key}'}

# Get all existing property addresses in OK
r = requests.get(f'{url}/rest/v1/properties?state=eq.OK&select=address', headers=headers)
existing_addrs = {row['address'].strip().lower() for row in r.json() if row.get('address')}

print(f"Loaded {len(existing_addrs)} existing OK property addresses in Supabase.")

df = scrape_property(location='Yukon, OK', listing_type='for_rent', past_days=180)
print(f"Total scraped from HomeHarvest: {len(df)}")

candidates = []
for idx, r in df.iterrows():
    addr = str(r.get('street', '')).strip()
    if not addr or addr.lower() in existing_addrs:
        continue
    
    # Check alt_photos / primary_photo
    photos = []
    if r.get('primary_photo') and str(r.get('primary_photo')) != 'nan':
        photos.append(str(r.get('primary_photo')).strip())
    alt = r.get('alt_photos')
    if isinstance(alt, list):
        photos.extend([str(p).strip() for p in alt if p and str(p) != 'nan'])
    elif isinstance(alt, str) and str(alt) != 'nan':
        if alt.startswith('['):
            try:
                photos.extend(json.loads(alt))
            except:
                pass
        else:
            # Comma-separated list of URLs
            urls = [u.strip() for u in alt.split(',') if u.strip().startswith('http')]
            photos.extend(urls)
    
    # deduplicate photos
    clean_photos = []
    for p in photos:
        if p and p not in clean_photos:
            clean_photos.append(p)
            
    desc = str(r.get('text', '')) if not pd.isna(r.get('text')) else ''
    style = str(r.get('style', '')) if not pd.isna(r.get('style')) else ''
    price = r.get('list_price')
    beds = r.get('beds')
    baths = r.get('full_baths')
    sqft = r.get('sqft')
    zip_code = r.get('zip_code')
    
    if len(clean_photos) < 6:
        continue
        
    is_townhome = any(k in desc.lower() for k in ['townhome', 'townhouse', 'duplex', 'half duplex', 'attached', 'condo']) or 'TOWNHOUSE' in style.upper()
    
    def to_int(val, default):
        if pd.isna(val): return default
        try: return int(float(val))
        except: return default

    def to_float(val, default):
        if pd.isna(val): return default
        try: return float(val)
        except: return default

    candidates.append({
        'address': addr,
        'city': str(r.get('city', 'Yukon')) if not pd.isna(r.get('city')) else 'Yukon',
        'state': str(r.get('state', 'OK')) if not pd.isna(r.get('state')) else 'OK',
        'zip': str(zip_code) if not pd.isna(zip_code) else '73099',
        'beds': to_int(beds, 3),
        'baths': to_float(baths, 2.0),
        'sqft': to_int(sqft, 1400),
        'rent': to_int(price, 1500),
        'photos_count': len(clean_photos),
        'photos': clean_photos,
        'is_townhome': is_townhome,
        'style': style,
        'desc_preview': desc[:140].replace('\n', ' '),
        'full_desc': desc,
        'lat': to_float(r.get('latitude'), None),
        'lng': to_float(r.get('longitude'), None),
        'year_built': to_int(r.get('year_built'), None),
        'property_url': str(r.get('property_url', '')) if not pd.isna(r.get('property_url')) else '',
    })

print(f"Total candidates with >= 6 photos and not in DB: {len(candidates)}")
townhomes = [c for c in candidates if c['is_townhome']]
houses = [c for c in candidates if not c['is_townhome']]
print(f"Townhomes/Duplexes found: {len(townhomes)}")
print(f"Single Family Houses found: {len(houses)}")

print("\n--- TOWNHOMES CANDIDATES ---")
for idx, th in enumerate(townhomes):
    print(f"[{idx+1}] {th['address']}, {th['city']}, {th['state']} {th['zip']} | Beds:{th['beds']} Baths:{th['baths']} Sqft:{th['sqft']} Rent:${th['rent']} Photos:{th['photos_count']}")
    print(f"    Preview: {th['desc_preview']}")

print("\n--- HOUSES CANDIDATES ---")
for idx, h in enumerate(houses):
    print(f"[{idx+1}] {h['address']}, {h['city']}, {h['state']} {h['zip']} | Beds:{h['beds']} Baths:{h['baths']} Sqft:{h['sqft']} Rent:${h['rent']} Photos:{h['photos_count']}")
    print(f"    Preview: {h['desc_preview']}")

with open('scripts/yukon_candidates.json', 'w') as f:
    json.dump({'townhomes': townhomes, 'houses': houses}, f, indent=2)
print("\nSaved candidates to scripts/yukon_candidates.json")
