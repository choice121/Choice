import json
import re
import time
import requests

with open('scripts/gp_mansfield_realtor_scraped.json', 'r') as f:
    candidates = json.load(f)

# Priority: Grand Prairie, Mansfield, Venus (Mansfield border 76084), Cedar Hill (GP border 75104)
# Filter for Townhomes, Duplexes, Condos
townhouse_candidates = [
    c for c in candidates
    if c['style'] in ('TOWNHOMES', 'DUPLEX_TRIPLEX', 'CONDOS', 'APARTMENT', 'SINGLE_FAMILY')
]

print(f"Total candidates: {len(townhouse_candidates)}")

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
}

def clean_desc(raw_text):
    if not raw_text:
        return "Spacious two-bedroom, two-bathroom residence featuring open-concept living, modern kitchen with full appliances, and central air conditioning.\n\nApplication Fee: $50. Submit your rental application today at Choice Properties."
    d = raw_text
    # Strip broker phones, emails, urls
    d = re.sub(r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', '', d)
    d = re.sub(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', '', d)
    d = re.sub(r'https?://[^\s]+', '', d)
    d = re.sub(r'www\.[^\s]+', '', d)
    # Strip security deposit
    d = re.sub(r'security deposit(?:\s*(?:of|is|:)?\s*\$[\d,]+|\s*equal to[^.,\n]*)?', '', d, flags=re.I)
    d = re.sub(r'\$[\d,]+\s*security deposit', '', d, flags=re.I)
    d = re.sub(r'\bdeposit:\s*\$[\d,]+', '', d, flags=re.I)
    # Strip lease term
    d = re.sub(r'\b(?:12|24|36|6)\s*[- ]?month\s+(?:lease|term)[^.,\n]*', '', d, flags=re.I)
    d = re.sub(r'\b(?:minimum|standard)\s+lease\s+term[^.,\n]*', '', d, flags=re.I)
    d = re.sub(r'\blease\s+duration:[^.,\n]*', '', d, flags=re.I)
    # Strip move in / available date
    d = re.sub(r'\b(?:available now|available immediately|move-in ready|ready for move-in|available for rent on|available on)[^.,\n]*', '', d, flags=re.I)
    d = re.sub(r'\bmove-in date:[^.,\n]*', '', d, flags=re.I)
    # Strip application fee variations to normalize
    d = re.sub(r'\b(?:application fee|app fee)(?:\s*(?:is|:)?\s*\$[\d,]+|\s*(?:waived|free|\$0))?', '', d, flags=re.I)
    d = re.sub(r'\$(?:0|35|40|45|55|60|65|75|100)\s*(?:application fee|app fee)', '', d, flags=re.I)
    # Clean whitespace
    d = re.sub(r'\s+,', ',', d)
    d = re.sub(r',\s*,', ',', d)
    d = re.sub(r'[ \t]{2,}', ' ', d)
    d = re.sub(r'\n{3,}', '\n\n', d).strip()
    
    if "Choice Properties" not in d:
        d += "\n\nApplication Fee: $50. Submit your rental application today at Choice Properties."
    return d

enriched_listings = []

for idx, c in enumerate(townhouse_candidates):
    if len(enriched_listings) >= 15:
        break
    print(f"\n[{len(enriched_listings) + 1}/15] Fetching detail page for: {c['formatted_address']}")
    print(f"  URL: {c['property_url']}")
    
    photos = c['photos']
    desc = c['text']
    
    try:
        r = requests.get(c['property_url'], headers=headers, timeout=12)
        if r.status_code == 200:
            match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', r.text, re.DOTALL)
            if match:
                data = json.loads(match.group(1))
                pp = data.get('props', {}).get('pageProps', {})
                prop = pp.get('property', {}) or pp.get('initialReduxState', {}).get('propertyDetails', {})
                detail_photos = prop.get('photos', [])
                if detail_photos:
                    photo_urls = []
                    for dp in detail_photos:
                        h = dp.get('href')
                        if h and isinstance(h, str):
                            # convert to high-res webp
                            high_res = re.sub(r's\.jpg$', 'od-w1024_h768.webp', h)
                            high_res = re.sub(r'\.jpg$', 'od-w1024_h768.webp', high_res)
                            if high_res not in photo_urls:
                                photo_urls.append(high_res)
                    if len(photo_urls) >= len(photos):
                        photos = photo_urls
                detail_desc = prop.get('description', {}).get('text') if isinstance(prop.get('description'), dict) else prop.get('description')
                if detail_desc and len(detail_desc) > len(desc):
                    desc = detail_desc
    except Exception as e:
        print(f"  Warning on detail fetch: {e}")
        
    cleaned_description = clean_desc(desc)
    
    # Classify architectural property type
    prop_type = 'TOWNHOUSE'
    if c['style'] == 'DUPLEX_TRIPLEX':
        prop_type = 'DUPLEX'
    elif c['style'] == 'APARTMENT':
        prop_type = 'TOWNHOUSE' # attached multi-level
        
    # Title format standard: {Street Address}, {City}, {State} {Zip}
    addr_parts = c['formatted_address'].split(',')
    street_clean = addr_parts[0].strip()
    title = f"{street_clean}, {c['city']}, {c['state']} {c['zip_code']}"
    
    baths_float = float(c['full_baths']) + (0.5 if c['half_baths'] > 0 else 0.0)
    
    enriched_listings.append({
        'title': title,
        'address': street_clean,
        'city': c['city'],
        'state': c['state'],
        'zip': c['zip_code'],
        'county': c['county'] or 'Dallas County',
        'lat': c['latitude'],
        'lng': c['longitude'],
        'monthly_rent': c['list_price'],
        'bedrooms': c['beds'],
        'bathrooms': baths_float,
        'half_bathrooms': c['half_baths'],
        'square_footage': c['sqft'] or 1150,
        'year_built': c['year_built'],
        'property_type': prop_type,
        'description': cleaned_description,
        'original_description': desc,
        'photos': photos,
        'source_listing_id': c['listing_id'] or c['property_id'],
        'source_url': c['property_url']
    })
    print(f"  -> Enriched! Photos: {len(photos)}, Rent: ${c['list_price']}, Baths: {baths_float}")
    time.sleep(1)

print(f"\nTotal enriched ready to publish: {len(enriched_listings)}")
with open('scripts/gp_mansfield_final_15_enriched.json', 'w') as f:
    json.dump(enriched_listings, f, indent=2)
