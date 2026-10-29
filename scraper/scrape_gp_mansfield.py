from homeharvest import scrape_property
import pandas as pd
import json

locations = [
    'Grand Prairie, TX',
    'Mansfield, TX',
    '75050',
    '75051',
    '75052',
    '75054',
    '76063',
    '76084',
    '76002',
    '76018',
    '75104'
]

all_dfs = []
for loc in locations:
    print(f"Scraping: {loc}...")
    try:
        df = scrape_property(location=loc, listing_type='for_rent', past_days=180)
        print(f"  Found {len(df)} listings")
        all_dfs.append(df)
    except Exception as e:
        print(f"  Error scraping {loc}: {e}")

combined = pd.concat(all_dfs, ignore_index=True)
combined = combined.drop_duplicates(subset=['property_id'])
print(f"\nTotal unique properties: {len(combined)}")

# Filter 2 beds, full baths >= 2, list_price 1600 - 1800
filtered = combined[
    (combined['beds'] == 2) &
    (combined['list_price'] >= 1600) &
    (combined['list_price'] <= 1800) &
    (combined['full_baths'] >= 2)
]

print(f"Matching 2b 2b in $1600-$1800: {len(filtered)}")

results = []
for idx, row in filtered.iterrows():
    alt_p = row['alt_photos']
    if pd.isna(alt_p) or alt_p is None:
        alt_p = []
    elif isinstance(alt_p, str):
        try:
            alt_p = json.loads(alt_p)
        except Exception:
            alt_p = [alt_p]
    elif not isinstance(alt_p, list):
        alt_p = []
    
    primary = row['primary_photo']
    all_photos = []
    if pd.notna(primary) and isinstance(primary, str) and primary.strip():
        all_photos.append(primary.strip())
    for p in alt_p:
        if pd.notna(p) and isinstance(p, str) and p.strip() and p.strip() not in all_photos:
            all_photos.append(p.strip())
            
    results.append({
        'property_id': str(row['property_id']),
        'listing_id': str(row['listing_id']),
        'property_url': str(row['property_url']),
        'formatted_address': str(row['formatted_address']),
        'street': str(row['street'] or '') if pd.notna(row['street']) else '',
        'unit': str(row['unit'] or '') if pd.notna(row['unit']) else '',
        'city': str(row['city']),
        'state': str(row['state']),
        'zip_code': str(row['zip_code']),
        'county': str(row['county']) if pd.notna(row['county']) else '',
        'style': str(row['style']),
        'list_price': int(row['list_price']),
        'beds': int(row['beds']),
        'full_baths': int(row['full_baths']),
        'half_baths': int(row['half_baths']) if pd.notna(row['half_baths']) else 0,
        'sqft': int(row['sqft']) if pd.notna(row['sqft']) else None,
        'year_built': int(row['year_built']) if pd.notna(row['year_built']) else None,
        'latitude': float(row['latitude']) if pd.notna(row['latitude']) else None,
        'longitude': float(row['longitude']) if pd.notna(row['longitude']) else None,
        'text': str(row['text']) if pd.notna(row['text']) else '',
        'photos': all_photos
    })

print(f"Collected {len(results)} structured candidates")
with open('scripts/gp_mansfield_realtor_scraped.json', 'w') as f:
    json.dump(results, f, indent=2)

for i, r in enumerate(results, 1):
    print(f"{i}. {r['formatted_address']} | ${r['list_price']}/mo | {r['beds']}b/{r['full_baths']}ba | {r['style']} | {len(r['photos'])} photos")
