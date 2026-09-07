import os
import json
import requests
import pandas as pd
from homeharvest import scrape_property
import re

url = 'https://tlfmwetmhthpyrytrcfo.supabase.co'
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
if not key:
    if os.path.exists('.env.local'):
        with open('.env.local') as f:
            for l in f:
                if l.startswith('SUPABASE_SERVICE_ROLE_KEY='):
                    key = l.split('=')[1].strip().strip('"')
headers = {'apikey': key, 'Authorization': f'Bearer {key}'}

r = requests.get(f'{url}/rest/v1/properties?state=eq.IN&select=address', headers=headers)
existing_addrs = {row['address'].strip().lower() for row in r.json() if row.get('address')}

loc = 'Indianapolis, IN'
all_candidates = []

df = scrape_property(location=loc, listing_type='for_rent', past_days=500)

for idx, r in df.iterrows():
    addr = str(r.get('street', '')).strip()
    if not addr or addr.lower() in existing_addrs:
        continue
        
    photos = []
    if not pd.isna(r.get('primary_photo')) and str(r.get('primary_photo')).strip() != '':
        photos.append(str(r.get('primary_photo')).strip())
        
    alt = r.get('alt_photos')
    if not pd.isna(alt):
        if isinstance(alt, list):
            photos.extend([str(p).strip() for p in alt if p and str(p) != 'nan'])
        elif isinstance(alt, str) and str(alt) != 'nan':
            if alt.startswith('['):
                try:
                    photos.extend(json.loads(alt))
                except:
                    pass
            else:
                urls = [u.strip() for u in alt.split(',') if u.strip().startswith('http')]
                photos.extend(urls)
                
    clean_photos = []
    for p in photos:
        if p and p not in clean_photos:
            clean_photos.append(p)
            
    if len(clean_photos) < 6:
        continue
        
    desc = str(r.get('text', '')) if not pd.isna(r.get('text')) else ''
    style = str(r.get('style', '')) if not pd.isna(r.get('style')) else ''
    price = r.get('list_price')
    beds = r.get('beds')
    baths = r.get('full_baths')
    sqft = r.get('sqft')
    zip_code = r.get('zip_code')
    year_built = r.get('year_built')
    
    is_townhome = any(k in desc.lower() for k in ['townhome', 'townhouse']) or 'TOWNHOUSE' in style.upper()
    if any(k in desc.lower() for k in ['apartment', 'multi-family', 'multiplex', 'condo', 'duplex']) and not is_townhome:
        continue
        
    def to_int(val, default):
        if pd.isna(val): return default
        try: return int(float(val))
        except: return default
    def to_float(val, default):
        if pd.isna(val): return default
        try: return float(val)
        except: return default

    beds_val = to_int(beds, 0)
    baths_val = to_float(baths, 0)
    rent_val = to_int(price, 0)
    
    if beds_val != 2:
        continue
    if baths_val != 2:
        continue
    
    # Ignore properties without valid rent
    if rent_val == 0:
        continue

    desc_lower = desc.lower()
    score = 0
    if 'new' in desc_lower or 'newly built' in desc_lower: score += 2
    if 'renovated' in desc_lower or 'updated' in desc_lower or 'modern' in desc_lower: score += 2
    if 'granite' in desc_lower or 'quartz' in desc_lower: score += 1
    if 'stainless' in desc_lower: score += 1
    if 'hardwood' in desc_lower or 'lvp' in desc_lower or 'plank' in desc_lower: score += 1
    
    all_candidates.append({
        'address': addr,
        'city': str(r.get('city', 'Indianapolis')) if not pd.isna(r.get('city')) else 'Indianapolis',
        'state': str(r.get('state', 'IN')) if not pd.isna(r.get('state')) else 'IN',
        'zip': str(zip_code) if not pd.isna(zip_code) else '',
        'beds': beds_val,
        'baths': baths_val,
        'sqft': to_int(sqft, None),
        'rent': rent_val,
        'photos_count': len(clean_photos),
        'photos': clean_photos,
        'is_townhome': is_townhome,
        'style': style,
        'score': score,
        'desc_preview': desc[:140].replace('\n', ' '),
        'full_desc': desc,
        'lat': to_float(r.get('latitude'), None),
        'lng': to_float(r.get('longitude'), None),
        'year_built': to_int(year_built, None),
        'property_url': str(r.get('property_url', '')) if not pd.isna(r.get('property_url')) else '',
    })

print(f"Total 2BD/2BA candidates matching base criteria: {len(all_candidates)}")

seen = set()
unique_candidates = []
for c in all_candidates:
    if c['address'] not in seen:
        seen.add(c['address'])
        unique_candidates.append(c)

# First group: inside 1400-1600 (Target)
target_candidates = [c for c in unique_candidates if 1400 <= c['rent'] <= 1600]
target_candidates = sorted(target_candidates, key=lambda x: x['score'], reverse=True)

# Second group: outside target, sorted by distance from 1500 (middle of target)
other_candidates = [c for c in unique_candidates if not (1400 <= c['rent'] <= 1600)]
other_candidates = sorted(other_candidates, key=lambda x: (abs(x['rent'] - 1500), -x['score']))

final_list = (target_candidates + other_candidates)[:15]

print(f"Selected: {len(final_list)} (Needed 15)")

with open('scripts/indianapolis_selected.json', 'w') as f:
    json.dump({'properties': final_list}, f, indent=2)
print("Saved candidates to scripts/indianapolis_selected.json")
