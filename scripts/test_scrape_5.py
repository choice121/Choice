import urllib.request
import re
import json

req = urllib.request.Request(
    'https://www.opendoor.com/sitemaps/listings.xml',
    headers={'User-Agent': 'Mozilla/5.0'}
)
with urllib.request.urlopen(req, timeout=20) as resp:
    xml_data = resp.read().decode('utf-8')

oh_urls = re.findall(r'<loc>(https://www\.opendoor\.com/properties/[^<]*-OH-\d{5}/[^<]*)</loc>', xml_data, re.IGNORECASE)
print(f'Total OH Opendoor URLs: {len(oh_urls)}')

scraped = []
for u in oh_urls[:5]:
    try:
        r = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(r, timeout=10) as resp:
            html = resp.read().decode('utf-8')
        scripts = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
        for s in scripts:
            if '"property":' in s and 'props' in s:
                data = json.loads(s)
                p = data.get('props', {}).get('pageProps', {}).get('property', {})
                if p:
                    scraped.append({
                        'address': p.get('street'),
                        'city': p.get('city'),
                        'state': p.get('state'),
                        'zip': p.get('zip'),
                        'price': p.get('listPrice'),
                        'beds': p.get('bedrooms'),
                        'baths': p.get('bathrooms'),
                        'sqft': p.get('sqFtTotalLiving'),
                        'photos': len(p.get('photosXl') or p.get('photos') or [])
                    })
                break
    except Exception as e:
        print(f'Error on {u}: {e}')

print(f'Successfully scraped {len(scraped)}/5 test properties:')
for s in scraped:
    print(f" - {s['address']}, {s['city']}, {s['state']} {s['zip']} | ${s['price']} | {s['beds']}bd/{s['baths']}ba | {s['photos']} photos")
