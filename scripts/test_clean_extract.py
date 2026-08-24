import urllib.request
import re
import json

sample_url = 'https://rentprogress.com/property-details/3187-andy-ter/columbus/oh/43223/1008555'
headers = {'User-Agent': 'Mozilla/5.0'}

req = urllib.request.Request(sample_url, headers=headers)
with urllib.request.urlopen(req, timeout=15) as resp:
    html = resp.read().decode('utf-8')

# Search for photos
photo_matches = re.findall(r'https://photos\.rentprogress\.com/WebPhotos/[^\s"\'<>]+(?:-lg|-orig|-xl)\.jpg', html)
clean_photos = []
for p in photo_matches:
    if p not in clean_photos:
        clean_photos.append(p)

print('Clean high-res photos count:', len(clean_photos))
for p in clean_photos[:5]:
    print(' ', p)

# Extract JSON-LD
json_ld_matches = re.findall(r'<script[^>]*type=[\'"]application/ld\+json[\'"][^>]*>(.*?)</script>', html, re.DOTALL)
for raw_json in json_ld_matches:
    raw_json = raw_json.strip()
    if 'RealEstateListing' in raw_json:
        data = json.loads(raw_json)
        graph = data.get('@graph', [data])
        for item in graph:
            if item.get('@type') == 'RealEstateListing':
                about = item.get('about', {})
                address = about.get('address', {})
                geo = about.get('geo', {})
                floor = about.get('floorSize', {})
                offers = item.get('offers', {})
                print('\nExtracted Property Details:')
                print('Address:', address.get('streetAddress'))
                print('City/State/Zip:', address.get('addressLocality'), address.get('addressRegion'), address.get('postalCode'))
                print('Lat/Lng:', geo.get('latitude'), geo.get('longitude'))
                print('Beds/Baths:', about.get('numberOfBedrooms'), about.get('numberOfBathroomsTotal'))
                print('Sqft:', floor.get('value'))
                print('Rent:', offers.get('price'))
