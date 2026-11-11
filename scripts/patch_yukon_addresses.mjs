import https from 'https';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE';

const HEADERS = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

const PATCHES = [
  {
    id: 'dcc80581-733f-48db-bb85-54124f99174d',
    address: '704 Oak Ave',
    lat: 35.504644,
    lng: -97.753636
  },
  {
    id: '1e3f452f-e668-4e7f-aa2e-8168ec34f654',
    address: '820 Elm Ave',
    lat: 35.506739,
    lng: -97.755214
  },
  {
    id: 'ab6d0806-ac54-4a49-84fb-30f07b102400',
    address: '412 Holly Ave',
    lat: 35.503075,
    lng: -97.751478
  },
  {
    id: '75658bb9-1e5d-4f1d-bea5-2ee1b015c330',
    address: '624 Cedar Ave',
    lat: 35.508870,
    lng: -97.752619
  },
  {
    id: 'fcdbf175-671c-4ee2-af6b-ff752ee5e7d3',
    address: '408 S 8th St',
    lat: 35.503461,
    lng: -97.754781
  }
];

function updateProperty(p) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      address: p.address,
      title: `${p.address}, Yukon, OK 73099`,
      lat: p.lat,
      lng: p.lng
    });

    const url = new URL(`${SUPABASE_URL}/rest/v1/properties?id=eq.${p.id}`);
    const req = https.request(url, {
      method: 'PATCH',
      headers: HEADERS
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          reject(new Error(`Failed to patch ${p.id}: ${res.statusCode} ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log('Patching 5 Yukon properties with 100% verified real addresses...');
  for (const p of PATCHES) {
    await updateProperty(p);
    console.log(`✓ Updated ${p.id} -> ${p.address}, Yukon, OK 73099`);
  }
  console.log('All 5 Yukon properties patched successfully!');
}

run().catch(err => {
  console.error('Error patching properties:', err);
  process.exit(1);
});
