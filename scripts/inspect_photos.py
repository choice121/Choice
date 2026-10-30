import urllib.request
import re
import json

sample_url = 'https://rentprogress.com/property-details/3187-andy-ter/columbus/oh/43223/1008555'
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

req = urllib.request.Request(sample_url, headers=headers)
with urllib.request.urlopen(req, timeout=15) as resp:
    html = resp.read().decode('utf-8')

# Search for photos in HTML
photo_urls = re.findall(r'https://photos\.rentprogress\.com/WebPhotos/[^\s"\'<>]+(?:-lg|-orig|-xl|-md|-sm)?\.(?:jpg|jpeg|png|webp)', html)
print(f'Total photo matches found: {len(photo_urls)}')
unique_photos = list(dict.fromkeys(photo_urls))
for p in unique_photos[:15]:
    print(' ', p)

# Search for property description in HTML
desc_match = re.search(r'<div[^>]*class="[^"]*property-description[^"]*"[^>]*>(.*?)</div>', html, re.DOTALL | re.IGNORECASE)
if desc_match:
    print('\nProperty description snippet:', desc_match.group(1)[:300])
else:
    # Look for paragraph with description
    paragraphs = re.findall(r'<p[^>]*>(.*?)</p>', html, re.DOTALL)
    for p in paragraphs:
        if len(p) > 100:
            print('\nLong paragraph snippet:', p[:200])
            break
