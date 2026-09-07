import os
import json
import requests
import pandas as pd
from homeharvest import scrape_property
import re

url = 'https://tlfmwetmhthpyrytrcfo.supabase.co'
key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE'
headers = {'apikey': key, 'Authorization': f'Bearer {key}'}

r = requests.get(f'{url}/rest/v1/properties?state=eq.NC&select=address', headers=headers)
existing_addrs = {row['address'].strip().lower() for row in r.json() if row.get('address')}
print(f"Loaded {len(existing_addrs)} existing NC property addresses.")

locations = ['Charlotte, NC', 'Huntersville, NC']
all_candidates = []

for loc in locations:
    df = scrape_property(location=loc, listing_type='for_rent', past_days=180)
    print(f"Total scraped from {loc}: {len(df)}")
    
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
        
        if not (3 <= beds_val <= 4):
            continue
        if not (1 <= baths_val <= 3):
            continue
        if not (1600 <= rent_val <= 2000):
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
            'city': str(r.get('city', 'Charlotte')) if not pd.isna(r.get('city')) else 'Charlotte',
            'state': str(r.get('state', 'NC')) if not pd.isna(r.get('state')) else 'NC',
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

print(f"Total candidates matching criteria: {len(all_candidates)}")
townhomes = sorted([c for c in all_candidates if c['is_townhome']], key=lambda x: x['score'], reverse=True)
houses = sorted([c for c in all_candidates if not c['is_townhome']], key=lambda x: x['score'], reverse=True)

# Filter unique addresses to avoid duplicates from overlapping searches
seen = set()
unique_townhomes = []
for th in townhomes:
    if th['address'] not in seen:
        seen.add(th['address'])
        unique_townhomes.append(th)
        
unique_houses = []
for h in houses:
    if h['address'] not in seen:
        seen.add(h['address'])
        unique_houses.append(h)

selected_houses = unique_houses[:8]
selected_townhomes = unique_townhomes[:7]

print(f"Selected Houses: {len(selected_houses)} (Needed 8)")
print(f"Selected Townhomes: {len(selected_townhomes)} (Needed 7)")

with open('scripts/charlotte_selected.json', 'w') as f:
    json.dump({'townhomes': selected_townhomes, 'houses': selected_houses}, f, indent=2)
print("Saved candidates to scripts/charlotte_selected.json")
