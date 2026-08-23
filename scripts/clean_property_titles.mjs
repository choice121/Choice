import { CREDENTIALS_CONFIG } from '../credentials-config.mjs';
import https from 'https';

const fetchSB = (endpoint) => new Promise((resolve, reject) => {
  https.get(endpoint, {
    headers: {
      'apikey': CREDENTIALS_CONFIG.SUPABASE_API_KEY,
      'Authorization': 'Bearer ' + CREDENTIALS_CONFIG.SUPABASE_API_KEY,
      'Accept': 'application/json'
    }
  }, res => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      try { resolve(JSON.parse(data)); } catch(e) { resolve(data); }
    });
  }).on('error', reject);
});

const patchJSON = (endpoint, body, key) => new Promise((resolve, reject) => {
  const data = JSON.stringify(body);
  const u = new URL(endpoint);
  const req = https.request(u, {
    method: 'PATCH',
    headers: {
      'apikey': key,
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Prefer': 'return=representation'
    }
  }, resp => {
    let d = '';
    resp.on('data', chunk => d += chunk);
    resp.on('end', () => {
      try { resolve(JSON.parse(d)); }
      catch(e) { resolve(d); }
    });
  });
  req.on('error', reject);
  req.write(data);
  req.end();
});

async function main() {
  const configs = await fetchSB(CREDENTIALS_CONFIG.SUPABASE_URL + '/rest/v1/credentials_config?select=*');
  const serviceKey = (configs.find(c => c.key === 'SUPABASE_SERVICE_ROLE_KEY') || {}).value;

  const ids = [
    '72e560b8-3565-42e8-91b8-4a57a0357c84', '8c6a4ba6-b3bb-418d-827d-bcdc22e942ac',
    '4d780308-202b-4457-a840-f90ee62dbe59', 'eef0a90a-83ab-4cee-9d0e-1c49221accd4',
    'db1cba36-eed1-4f3c-acce-e978829307c3', 'ce3ab8c2-c23e-4729-94b6-05775fd59796',
    '301dff56-bc40-4d18-b149-d1ad6ba422e0', 'b62cfddf-5d84-44a9-ad99-6da225f44bef',
    '5f3eab40-dd93-4237-8a38-ea0b3f650dea', '872612e0-be61-48db-a5be-b5f4b68de927'
  ];

  for (const id of ids) {
    const prop = await fetchSB(CREDENTIALS_CONFIG.SUPABASE_URL + '/rest/v1/properties?id=eq.' + id + '&select=id,title,address');
    if (prop && prop[0]) {
      const cur = prop[0].title;
      const cleaned = cur.replace(/\s*[–—\-]\s*\$\d+.*$/g, '').trim();
      console.log(prop[0].address, '::', cur, '===>', cleaned);
      const res = await patchJSON(
        CREDENTIALS_CONFIG.SUPABASE_URL + '/rest/v1/properties?id=eq.' + id,
        { title: cleaned },
        serviceKey
      );
      console.log('Update result:', res?.length ? 'SUCCESS' : res);
    }
  }

  // Also check all properties across the database
  let allProps = [];
  let page = 0;
  while (true) {
    const batch = await fetchSB(CREDENTIALS_CONFIG.SUPABASE_URL + '/rest/v1/properties?select=id,title,address&offset=' + (page * 500) + '&limit=500');
    if (!batch || batch.length === 0) break;
    allProps = allProps.concat(batch);
    if (batch.length < 500) break;
    page++;
  }

  console.log('Checking all', allProps.length, 'properties in DB for rent in title...');
  for (const p of allProps) {
    if (p.title && (p.title.includes('$') || p.title.includes('/mo') || p.title.includes('–') || p.title.includes('—'))) {
      const cleaned = p.title.replace(/\s*[–—\-]\s*\$\d+.*$/g, '').replace(/\s*\$\d+.*$/g, '').trim();
      if (cleaned !== p.title) {
        console.log('Patching other prop:', p.address, p.title, '->', cleaned);
        await patchJSON(
          CREDENTIALS_CONFIG.SUPABASE_URL + '/rest/v1/properties?id=eq.' + p.id,
          { title: cleaned },
          serviceKey
        );
      }
    }
  }
}

main().catch(console.error);
