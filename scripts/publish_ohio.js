#!/usr/bin/env node

const { spawn } = require('child_process');

const SUPABASE_URL = 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE';

const HEADERS = {
  'apikey': KEY,
  'Authorization': 'Bearer ' + KEY,
  'Content-Type': 'application/json'
};

function slugSeg(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function buildCanonicalUrl(p) {
  const id = String(p.id).toLowerCase();
  const state = String(p.state || 'oh').toLowerCase().slice(0, 2);
  const city = slugSeg(p.city);
  const beds = (p.bedrooms == null) ? 'home' : (Number(p.bedrooms) === 0 ? 'studio' : Number(p.bedrooms) + 'br');
  const rawType = String(p.property_type || '').toLowerCase().replace(/[\s_]+/g, '-');
  const typeMap = {
    'single-family': 'house', 'single_family': 'house',
    'townhomes': 'townhouse', 'townhome': 'townhouse',
    'condos': 'condo', 'apartment': 'apartment', 'house': 'house',
    'condo': 'condo', 'townhouse': 'townhouse', 'duplex': 'duplex',
    'studio': 'studio', 'multi-family': 'multi-family', 'mobile-home': 'mobile-home'
  };
  const type = typeMap[rawType] || rawType || 'home';
  return `/rent/${state}/${city}/${beds}-${type}-${id}/`;
}

async function main() {
  console.log('Fetching scraped Ohio properties from pipeline...');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pipeline_list`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ p_status: 'scraped', p_limit: 100, p_offset: 0 })
  });

  const list = await res.json();
  const ohio = list.filter(p => (p.state || '').toUpperCase() === 'OH');
  console.log(`Found ${ohio.length} scraped Ohio properties to enrich and publish.`);

  if (ohio.length === 0) {
    console.log('No scraped Ohio properties found in pipeline.');
    return;
  }

  // 1. Run Python enrichment pipeline
  console.log('\nRunning enrichment pipeline...');
  const py = spawn('python3', ['./scripts/enrich_ohio.py']);
  let stdout = '', stderr = '';
  py.stdout.on('data', d => stdout += d);
  py.stderr.on('data', d => stderr += d);
  py.stdin.write(JSON.stringify(ohio));
  py.stdin.end();

  const enrichedResults = await new Promise((resolve, reject) => {
    py.on('close', code => {
      if (code !== 0) reject(new Error(`Enrichment failed: ${stderr}`));
      else resolve(JSON.parse(stdout));
    });
  });

  const publishedProperties = [];

  for (const item of enrichedResults) {
    const p = item.record;
    console.log('\n======================================================');
    console.log(`Processing ${p.id}: ${p.address}, ${p.city}, ${p.state} ${p.zip}`);
    console.log(`Validation result: valid=${item.valid}, failures=${JSON.stringify(item.failures)}`);

    if (!item.valid) {
      console.error(`ERROR: Property ${p.id} failed validation:`, item.failures);
      continue;
    }

    // Step A: Save enriched patch to pipeline
    console.log('Saving enriched fields to pipeline...');
    const patch = {
      title: p.title,
      description: p.description,
      monthly_rent: p.monthly_rent,
      security_deposit: p.security_deposit,
      application_fee: p.application_fee,
      pets_allowed: p.pets_allowed,
      smoking_allowed: p.smoking_allowed,
      minimum_lease_months: p.minimum_lease_months,
      parking: p.parking,
      city: p.city,
      state: p.state
    };

    const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pipeline_save`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ p_id: p.id, p_patch: patch })
    });
    const saveData = await saveRes.json();
    if (!saveData.ok) {
      console.error(`Failed to save pipeline record for ${p.id}:`, saveData);
      continue;
    }

    // Step B: Publish via pipeline_publish RPC
    console.log('Calling pipeline_publish RPC...');
    const pubRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pipeline_publish`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ p_id: p.id, p_landlord_id: null })
    });
    const pubData = await pubRes.json();
    if (!pubData.ok || !pubData.choice_property_id) {
      console.error(`Publish RPC failed for ${p.id}:`, pubData);
      continue;
    }

    const choiceId = pubData.choice_property_id;
    console.log(`Published! choice_property_id = ${choiceId}`);

    // Step C: Activate in public.properties (status = active)
    console.log('Activating listing in public.properties...');
    const actRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${encodeURIComponent(choiceId)}`, {
      method: 'PATCH',
      headers: HEADERS,
      body: JSON.stringify({ status: 'active' })
    });
    if (!actRes.ok) {
      console.warn('Warning: Activating status returned', actRes.status);
    }

    // Step D: Insert photos into public.property_photos
    let rawImages = [];
    try {
      rawImages = typeof p.original_image_urls === 'string' ? JSON.parse(p.original_image_urls) : p.original_image_urls;
    } catch (e) {
      rawImages = [];
    }

    if (rawImages && rawImages.length > 0) {
      console.log(`Inserting ${rawImages.length} ImageKit photos into property_photos...`);
      const photoRows = rawImages.map((img, idx) => {
        const url = typeof img === 'string' ? img : img.url;
        const fileId = (typeof img === 'object' && img.fileId) ? img.fileId : null;
        const width = (typeof img === 'object' && img.width) ? img.width : null;
        const height = (typeof img === 'object' && img.height) ? img.height : null;
        return {
          property_id: choiceId,
          url: url,
          file_id: fileId,
          width: width,
          height: height,
          display_order: idx,
          is_hero: idx === 0,
          watermark_status: 'pending',
          alt_text: `${p.address}, ${p.city} OH - Photo ${idx + 1}`
        };
      });

      const photoRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos`, {
        method: 'POST',
        headers: { ...HEADERS, 'Prefer': 'return=minimal' },
        body: JSON.stringify(photoRows)
      });
      if (!photoRes.ok) {
        console.warn('Warning: Photo insertion returned', photoRes.status, await photoRes.text());
      } else {
        console.log(`Successfully inserted ${photoRows.length} photos.`);
      }
    }

    const canonicalPath = buildCanonicalUrl({ ...p, id: choiceId });
    const directUrl = `/property.html?id=${choiceId}`;
    const liveInfo = {
      pipelineId: p.id,
      choicePropertyId: choiceId,
      title: p.title,
      address: `${p.address}, ${p.city}, ${p.state} ${p.zip}`,
      monthlyRent: p.monthly_rent,
      deposit: p.security_deposit,
      appFee: p.application_fee,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      parking: p.parking,
      photoCount: rawImages.length,
      canonicalUrl: `https://choice-properties-site.pages.dev${canonicalPath}`,
      directUrl: `https://choice-properties-site.pages.dev${directUrl}`,
      localUrl: `http://localhost:3000${directUrl}`,
      canonicalPath: canonicalPath
    };

    publishedProperties.push(liveInfo);
  }

  console.log('\n======================================================');
  console.log(`ALL DONE! Successfully published ${publishedProperties.length} Ohio properties.`);
  console.log('======================================================\n');
  console.log(JSON.stringify(publishedProperties, null, 2));
}

main().catch(err => {
  console.error('Fatal error in publish_ohio:', err);
  process.exit(1);
});
