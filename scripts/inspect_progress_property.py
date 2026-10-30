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

# Check json-ld schema
scripts = re.findall(r'<script[^>]*type=[\'"]application/ld\+json[\'"][^>]*>(.*?)</script>', html, re.DOTALL)
print('JSON-LD count:', len(scripts))
for s in scripts:
    data = json.loads(s)
    print(json.dumps(data, indent=2)[:1500])

# Check images and gallery in html
images = re.findall(r'https://[^\s"\'<>]+\.(?:jpg|jpeg|png|webp)', html)
clean_imgs = [img for img in set(images) if 'cdn' in img or 'image' in img or 'photos' in img or 'rentprogress' in img or 's3' in img]
print(f'\nExtracted images ({len(clean_imgs)}):')
for img in list(clean_imgs)[:10]:
    print(' ', img)
