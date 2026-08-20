const SUPABASE_URL = 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE';

async function fetchCount(table, schema = 'public') {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
      method: 'HEAD',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Accept': 'application/json',
        'Accept-Profile': schema,
        'Content-Profile': schema,
        'Prefer': 'count=exact'
      }
    });
    const range = res.headers.get('content-range');
    if (range) {
      const parts = range.split('/');
      return parts[1] || '0';
    }
    return res.status;
  } catch (e) {
    return 'Error: ' + e.message;
  }
}

async function scan() {
  console.log('--- SUPABASE LIVE BACKEND AUDIT ---');
  const publicTables = [
    'properties',
    'property_photos',
    'landlords',
    'rental_applications',
    'application_documents',
    'leases',
    'lease_templates',
    'lease_amendments',
    'inspections',
    'inspection_photos',
    'deposit_accounting',
    'credentials_config',
    'inquiries',
    'messages',
    'audit_logs'
  ];

  for (const t of publicTables) {
    const c = await fetchCount(t, 'public');
    console.log(`[public.${t}]: count = ${c}`);
  }

  const pipelineTables = [
    'pipeline_properties',
    'pipeline_folders',
    'pipeline_scrape_runs'
  ];

  for (const t of pipelineTables) {
    const c = await fetchCount(t, 'pipeline');
    console.log(`[pipeline.${t}]: count = ${c}`);
  }

  console.log('--- SCAN COMPLETE ---');
}

scan();
