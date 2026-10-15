import os
import json
import pandas as pd
from homeharvest import scrape_property

print("Scraping Albuquerque, NM 3-bedroom rentals up to $1500...")
df = scrape_property(
    location='Albuquerque, NM',
    listing_type='for_rent',
    beds_min=3,
    beds_max=3,
    price_max=1500,
    radius=20
)

df['beds_num'] = pd.to_numeric(df['beds'], errors='coerce')
df['price_num'] = pd.to_numeric(df['list_price'], errors='coerce')
valid = df[(df['beds_num'] == 3) & (df['price_num'] <= 1500) & (df['price_num'] >= 600)].copy()

print(f"Total valid 3b ($600-$1500) count: {len(valid)}")

items = []
seen_addrs = set()

for idx, r in valid.iterrows():
    street = str(r.get('street', '')).strip()
    if not street or street == 'nan':
        continue
    unit = str(r.get('unit', '')).strip() if str(r.get('unit', '')) != 'nan' else ''
    full_addr = f"{street} {unit}".strip()
    
    # Extract photos
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
            photos.extend([u.strip() for u in alt.split(',') if u.strip().startswith('http')])
            
    clean_photos = []
    for p in photos:
        if p and p not in clean_photos:
            clean_photos.append(p)
            
    if len(clean_photos) == 0:
        continue
        
    full_key = f"{full_addr}_{r.get('zip_code')}"
    if full_key in seen_addrs:
        continue
    seen_addrs.add(full_key)
    
    half_b = 0
    if not pd.isna(r.get('half_baths')):
        try:
            half_b = float(r.get('half_baths'))
        except:
            half_b = 0
    full_b = 1.0
    if not pd.isna(r.get('full_baths')):
        try:
            full_b = float(r.get('full_baths'))
        except:
            full_b = 1.0
    total_baths = full_b + (0.5 * half_b)
    
    item = {
        'street': street,
        'unit': unit,
        'full_addr': full_addr,
        'city': str(r.get('city', 'Albuquerque')),
        'state': str(r.get('state', 'NM')),
        'zip_code': str(r.get('zip_code', '87102')),
        'beds': int(r.get('beds_num')),
        'full_baths': full_b,
        'half_baths': half_b,
        'total_baths': total_baths,
        'list_price': int(r.get('price_num')),
        'sqft': int(r.get('sqft')) if not pd.isna(r.get('sqft')) else None,
        'year_built': int(r.get('year_built')) if not pd.isna(r.get('year_built')) else None,
        'style': str(r.get('style', '')),
        'latitude': float(r.get('latitude')) if not pd.isna(r.get('latitude')) else None,
        'longitude': float(r.get('longitude')) if not pd.isna(r.get('longitude')) else None,
        'photos_count': len(clean_photos),
        'photos': clean_photos,
        'text': str(r.get('text', '')) if not pd.isna(r.get('text')) else '',
        'property_url': str(r.get('property_url', '')) if not pd.isna(r.get('property_url')) else ''
    }
    items.append(item)

print(f"\nUnique Deduplicated Properties with Photos: {len(items)}")
for i, it in enumerate(items):
    print(f"[{i+1}] {it['full_addr']} | {it['city']}, {it['state']} {it['zip_code']} | Beds: {it['beds']} | Baths: {it['total_baths']} | Price: ${it['list_price']} | Sqft: {it['sqft']} | Photos: {it['photos_count']} | Style: {it['style']}")

with open('scripts/albuquerque_candidates.json', 'w') as f:
    json.dump(items, f, indent=2)
print("Saved candidates to scripts/albuquerque_candidates.json")
