const { createClient } = require('@supabase/supabase-js');
const { readFileSync } = require('fs');

const env = readFileSync('.env.example', 'utf-8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key) acc[key] = val.join('=');
  return acc;
}, {});

// Generate config will have real values if available
require('./generate-config.js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .limit(20);
    
  if (error) {
    console.error(error);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log("No data");
    return;
  }
  
  const keys = Object.keys(data[0]);
  console.log("Available columns:", keys.join(', '));
  
  console.log("\nSample values for potential filters:");
  const fields = ['pets_allowed', 'amenities', 'parking', 'property_type', 'utilities_included', 'features', 'has_central_air', 'cooling_features', 'heating_features', 'location_features', 'has_w_d'];
  
  fields.forEach(f => {
    if (keys.includes(f)) {
      const values = data.map(d => d[f]).filter(v => v !== null && v !== undefined);
      console.log(`\n--- ${f} ---`);
      console.log(`Type: ${values.length ? typeof values[0] : 'unknown'}`);
      if (values.length > 0 && Array.isArray(values[0])) console.log(`Is Array: true`);
      console.log(`Sample (up to 5):`, values.slice(0, 5));
      console.log(`Populated in ${values.length}/${data.length} records.`);
    } else {
      console.log(`\n--- ${f} ---`);
      console.log(`NOT FOUND IN SCHEMA`);
    }
  });
}

check();
