import urllib.request
import re
import json

sample_url = 'https://rentprogress.com/property-details/3187-andy-ter/columbus/oh/43223/1008555'
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5'
}

req = urllib.request.Request(sample_url, headers=headers)
try:
    with urllib.request.urlopen(req, timeout=15) as resp:
        html = resp.read().decode('utf-8')
    print('HTML length:', len(html))
    
    # Check for __NEXT_DATA__ or json-ld or initial state scripts
    scripts = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
    print('Script tags count:', len(scripts))
    for i, s in enumerate(scripts):
        if '__NEXT_DATA__' in s or 'property' in s.lower() or 'price' in s.lower():
            print(f'Script {i} len {len(s)} snippet: {s[:250]}...\n')
except Exception as e:
    print('Error loading URL:', e)
