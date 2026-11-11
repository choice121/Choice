import https from 'https';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE';

const HEADERS = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json'
};

function formatProfessionalTitle(propertyType, city, state, sqft, yearBuilt) {
  const typeNames = {
    'SINGLE_FAMILY': 'Single-Family Home',
    'TOWNHOUSE': 'Townhome',
    'DUPLEX': 'Duplex',
    'APARTMENT': 'Apartment Unit'
  };
  const tName = typeNames[(propertyType || '').toUpperCase()] || 'Residence';
  const cityName = city || 'Property';
  return `${cityName} ${tName}`;
}

async function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqOptions = {
      hostname: u.hostname,
      port: 443,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function run() {
  console.log('Fetching properties...');
  const props = await fetchJson(`${SUPABASE_URL}/rest/v1/properties?select=id,property_type,city,state,square_footage,year_built`, { headers: HEADERS });
  if (Array.isArray(props)) {
    for (const p of props) {
      const newTitle = formatProfessionalTitle(p.property_type, p.city, p.state, p.square_footage, p.year_built);
      await fetchJson(`${SUPABASE_URL}/rest/v1/properties?id=eq.${p.id}`, {
        method: 'PATCH',
        headers: { ...HEADERS, 'Prefer': 'return=minimal' },
        body: { title: newTitle }
      });
      console.log(`Updated property ${p.id} -> ${newTitle}`);
    }
  }

  console.log('Fetching pipeline properties...');
  const pipelineProps = await fetchJson(`${SUPABASE_URL}/rest/v1/pipeline_properties?select=id,property_type,city,state,square_footage,year_built`, { headers: { ...HEADERS, 'Content-Profile': 'pipeline' } });
  if (Array.isArray(pipelineProps)) {
    for (const p of pipelineProps) {
      const newTitle = formatProfessionalTitle(p.property_type, p.city, p.state, p.square_footage, p.year_built);
      await fetchJson(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${p.id}`, {
        method: 'PATCH',
        headers: { ...HEADERS, 'Content-Profile': 'pipeline', 'Prefer': 'return=minimal' },
        body: { title: newTitle }
      });
      console.log(`Updated pipeline property ${p.id} -> ${newTitle}`);
    }
  }
  console.log('Done updating all property titles to Option 2 format!');
}

run().catch(console.error);
