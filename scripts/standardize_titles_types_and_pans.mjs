/**
 * Choice Properties — Comprehensive Database & Pipeline Standardization Engine
 * ==============================================================================
 * Enforces AGENTS.md rules across live active properties and pipeline staging:
 * 1. Title Fidelity (Rule 6C): Strips synthetic template titles (e.g. "3BR DUPLEX in Fort Worth")
 *    and converts to authentic address / source title.
 * 2. Architectural Classification (Rule 6B): Normalizes property types to standard uppercase enums
 *    (SINGLE_FAMILY, DUPLEX, TOWNHOUSE, CONDO, APARTMENT).
 * 3. Zero Bathroom Truncation (Rule 6A): Fixes truncated half-baths (1.5, 2.5, 3.5).
 * 4. Original Description Anchor (Rule 5): Populates original_description if null to preserve ground truth.
 * 5. Description Security Deposit Stripping (Rule 2 & 14): Removes security deposit phrases and artifacts.
 */

import { CREDENTIALS_CONFIG } from '../credentials-config.mjs';

const SUPABASE_URL = CREDENTIALS_CONFIG.SUPABASE_URL;
const SUPABASE_KEY = CREDENTIALS_CONFIG.SUPABASE_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Supabase credentials missing.');
  process.exit(1);
}

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal'
};

const pipelineHeaders = {
  ...headers,
  'Accept-Profile': 'pipeline',
  'Content-Profile': 'pipeline'
};

const SYNTHETIC_TITLE_REGEX = /^\d+BR\s+(?:SINGLE|APARTMENT|HOUSE|TOWNHOME|CONDO|DUPLEX|Rental|TOWNHOMES)/i;

function cleanDescription(desc) {
  if (!desc) return null;
  let d = String(desc);
  // Strip security deposit mentions and broken residual bullets
  d = d.replace(/(?:•\s*)?Security\s+Deposit:[^\n•]+/gi, '');
  d = d.replace(/(?:•\s*)?Deposit:[^\n•]+/gi, '');
  d = d.replace(/•\s*:\s*\$[0-9,]+[^\n•]*/gi, '');
  d = d.replace(/:\s*\$[0-9,]+\s*\([^)]*deposit[^)]*\)/gi, '');
  d = d.replace(/:\s*\$[0-9,]+\s*\(equal\s+to\s+1\s+month's\s+rent\)/gi, '');
  d = d.replace(/:\s*\$[0-9,]+\s*\(Equal\s+to\s+1\s+month's\s+rent\)/gi, '');
  // Strip available dates and move-in mentions
  d = d.replace(/(?:•\s*)?(?:Available\s+date|Move-?in\s+date):[^\n•]+/gi, '');
  d = d.replace(/(?:is\s+)?(?:very\s+clean\s+and\s+)?move-?in\s+ready(?:\s+and\s+available\s+now)?/gi, '');
  d = d.replace(/(?:is\s+)?available\s+(?:for\s+rent\s+|for\s+lease\s+)?(?:now|immediately|today)/gi, '');
  d = d.replace(/(?:is\s+)?available\s+(?:for\s+rent\s+)?on\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?/gi, '');
  // Clean empty bullets or duplicate blank lines
  d = d.replace(/•\s*\n/g, '\n').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
  return d;
}

function resolveAuthenticTitle(p) {
  const t = (p.title || '').trim();
  if (t && !SYNTHETIC_TITLE_REGEX.test(t) && t.length > 5) {
    return t; // Already authentic source title
  }
  const street = (p.address || '').trim();
  const city = (p.city || '').trim();
  const state = (p.state || '').trim();
  const zip = (p.zip || '').trim();
  if (street && city && state) {
    return `${street}, ${city}, ${state}${zip ? ' ' + zip : ''}`;
  }
  if (street && city) {
    return `${street}, ${city}`;
  }
  return street || t;
}

function normalizePropertyType(currType, desc, title) {
  let t = (currType || '').trim();
  const lowerDesc = ((desc || '') + ' ' + (title || '')).toLowerCase();

  // Rule 6B classification check
  if (lowerDesc.includes('1/2 duplex') || lowerDesc.includes('half duplex') || lowerDesc.includes('half-duplex') || lowerDesc.includes('duplex') || lowerDesc.includes('side-by-side')) {
    return 'DUPLEX';
  }
  if (lowerDesc.includes('townhouse') || lowerDesc.includes('townhome') || lowerDesc.includes('rowhouse')) {
    return 'TOWNHOUSE';
  }
  if (lowerDesc.includes('condo') || lowerDesc.includes('condominium')) {
    if (!lowerDesc.includes('single family') && !lowerDesc.includes('detached')) {
      return 'CONDO';
    }
  }

  // Enum normalization
  const norm = t.toUpperCase().replace(/[\s-]+/g, '_');
  if (norm === 'CONDOS') return 'CONDO';
  if (norm === 'TOWNHOMES') return 'TOWNHOUSE';
  if (norm === 'HOUSE') return 'SINGLE_FAMILY';
  if (norm === 'APARTMENTS') return 'APARTMENT';
  if (['SINGLE_FAMILY', 'DUPLEX', 'TOWNHOUSE', 'CONDO', 'APARTMENT', 'MULTI_FAMILY', 'MOBILE', 'LAND', 'FARM'].includes(norm)) {
    return norm;
  }
  return t || 'SINGLE_FAMILY';
}

async function fetchAll(url, extraHeaders = {}) {
  let items = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const res = await fetch(`${url}&offset=${page * pageSize}&limit=${pageSize}`, {
      headers: { ...headers, ...extraHeaders }
    });
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    items = items.concat(batch);
    if (batch.length < pageSize) break;
    page++;
  }
  return items;
}

async function run() {
  console.log('🚀 Starting Comprehensive Database & Pipeline Audit and Standardization...');

  // 1. Audit and Standardize public.properties
  console.log('🔍 Fetching all active public properties...');
  const activeProps = await fetchAll(`${SUPABASE_URL}/rest/v1/properties?status=eq.active&select=id,title,address,city,state,zip,property_type,bedrooms,bathrooms,half_bathrooms,total_bathrooms,virtual_tour_url,description,original_description&order=id.asc`);
  console.log(`✓ Fetched ${activeProps.length} active properties.`);

  // Known truncated bathroom mappings
  const bathOverrides = {
    '080ad86c-c79f-48ec-908f-227325f4ec17': { bathrooms: 3.5, half_bathrooms: 1, total_bathrooms: 3.5 }, // 8109 Valley Farms Trl: 3 full + 1 half
    '0c339b9d-4c55-46b9-bcaa-b4730f691df5': { bathrooms: 2.5, half_bathrooms: 1, total_bathrooms: 2.5 }, // 10440 Wilson Glen Dr: 2 full + 1 half
    '140a6be2-c41a-457a-973a-98f1cbed1d97': { bathrooms: 2.5, half_bathrooms: 1, total_bathrooms: 2.5 }, // 4932 Lewiston Dr: 2 full suites + 1 half
    '74357b89-d56a-4337-a5b4-5c226d4bffda': { bathrooms: 2.5, half_bathrooms: 1, total_bathrooms: 2.5 }, // 13001 Deep Wood Creek Dr: 2 full + 1 powder
    '7e909554-ca17-45af-b7cf-903966903072': { bathrooms: 2.5, half_bathrooms: 1, total_bathrooms: 2.5 }, // 19 Savannah Pl: 2 full + 1 half
    'b88d80ed-a89d-450c-aaf0-5b9b233b619d': { bathrooms: 2.5, half_bathrooms: 1, total_bathrooms: 2.5 }, // 105 Duke St: 2.5 baths
    'ce13dd6e-383c-46c7-81d8-a6107b4a3fd0': { bathrooms: 2.5, half_bathrooms: 1, total_bathrooms: 2.5 }, // 3201 Lois Arlene Cir: 2 ensuite + half bath
    'dec6ec68-0035-47f5-aac5-3122a7f3f00d': { bathrooms: 1.5, half_bathrooms: 1, total_bathrooms: 1.5 }, // 7109 Rockcliff Ct: 1.5 baths
    'f9e94261-6e5c-4dc2-8c57-810e5988ee50': { bathrooms: 2.5, half_bathrooms: 1, total_bathrooms: 2.5 }, // 11819 Red Oak Way: 2 ensuite + half bath
    'ff491888-20f8-4f34-a70a-5cb4482e1548': { bathrooms: 2.5, half_bathrooms: 1, total_bathrooms: 2.5 }, // 2137 Bellefontaine St: 2 full + half bath
  };

  let propTitleUpdated = 0;
  let propTypeUpdated = 0;
  let propBathUpdated = 0;
  let propDescUpdated = 0;
  let propOrigDescAnchor = 0;

  for (const p of activeProps) {
    const patch = {};
    const authenticTitle = resolveAuthenticTitle(p);
    if (authenticTitle !== p.title) {
      patch.title = authenticTitle;
      propTitleUpdated++;
    }

    const normType = normalizePropertyType(p.property_type, p.description, p.title);
    if (normType !== p.property_type) {
      patch.property_type = normType;
      propTypeUpdated++;
    }

    if (bathOverrides[p.id]) {
      Object.assign(patch, bathOverrides[p.id]);
      propBathUpdated++;
    }

    if (p.original_description === null && p.description) {
      patch.original_description = p.description;
      propOrigDescAnchor++;
    }

    const cleanedDesc = cleanDescription(p.description);
    if (cleanedDesc && cleanedDesc !== p.description) {
      patch.description = cleanedDesc;
      propDescUpdated++;
    }

    if (Object.keys(patch).length > 0) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${p.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(patch)
      });
      if (!res.ok) {
        console.error(`Failed to patch property ${p.id}:`, await res.text());
      }
    }
  }

  console.log(`✅ Public Properties Standardized:`);
  console.log(`   - Titles updated from synthetic to authentic: ${propTitleUpdated}`);
  console.log(`   - Property types normalized: ${propTypeUpdated}`);
  console.log(`   - Truncated bathrooms corrected to fractional: ${propBathUpdated}`);
  console.log(`   - Descriptions cleaned of deposit artifacts: ${propDescUpdated}`);
  console.log(`   - Original descriptions anchored: ${propOrigDescAnchor}`);

  // 2. Audit and Standardize pipeline.pipeline_properties
  console.log('\n🔍 Fetching all pipeline properties...');
  const pipelineProps = await fetchAll(
    `${SUPABASE_URL}/rest/v1/pipeline_properties?select=id,title,address,city,state,zip,property_type,bathrooms,half_bathrooms,total_bathrooms,description,original_description`,
    { 'Accept-Profile': 'pipeline' }
  );
  console.log(`✓ Fetched ${pipelineProps.length} pipeline properties.`);

  let pipeTitleUpdated = 0;
  let pipeTypeUpdated = 0;
  let pipeOrigDescAnchor = 0;

  for (const p of pipelineProps) {
    const patch = {};
    const authenticTitle = resolveAuthenticTitle(p);
    if (authenticTitle !== p.title) {
      patch.title = authenticTitle;
      pipeTitleUpdated++;
    }

    const normType = normalizePropertyType(p.property_type, p.description, p.title);
    if (normType !== p.property_type) {
      patch.property_type = normType;
      pipeTypeUpdated++;
    }

    if (p.original_description === null && p.description) {
      patch.original_description = p.description;
      pipeOrigDescAnchor++;
    }

    if (Object.keys(patch).length > 0) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?id=eq.${p.id}`, {
        method: 'PATCH',
        headers: pipelineHeaders,
        body: JSON.stringify(patch)
      });
      if (!res.ok) {
        console.error(`Failed to patch pipeline property ${p.id}:`, await res.text());
      }
    }
  }

  console.log(`✅ Pipeline Properties Standardized:`);
  console.log(`   - Titles updated from synthetic to authentic: ${pipeTitleUpdated}`);
  console.log(`   - Property types normalized: ${pipeTypeUpdated}`);
  console.log(`   - Original descriptions anchored: ${pipeOrigDescAnchor}`);

  console.log('\n🎉 Comprehensive Audit and Standardization complete!');
}

run().catch(err => {
  console.error('Fatal error during execution:', err);
  process.exit(1);
});
