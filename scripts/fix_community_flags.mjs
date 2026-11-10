/**
 * fix_community_flags.mjs
 * Run: node --env-file=.env.local scripts/fix_community_flags.mjs
 *
 * Clears community-related flags (is_multi_unit, community_starting_rent, price_range)
 * for all properties that are NOT true community/apartment-complex buildings.
 *
 * A property is treated as a true community ONLY when:
 *   - total_units > 1, OR
 *   - is_multi_unit = true AND total_units > 1
 *
 * Any single-unit listing (apartment, single_family, duplex, townhouse, condo, etc.)
 * that has stale community flags will be corrected so the UI stops showing
 * "From $X/mo", community inventory, and community-spec ranges.
 *
 * Usage:
 *   SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... node scripts/fix_community_flags.mjs
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY env var is required');

const HEADERS = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

async function sbFetch(path, method = 'GET', body = null) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

// Fetch all properties that have any community flag set
async function fetchFlaggedProperties() {
  // We use OR to get any property that has stale community data
  const path = `/rest/v1/properties?select=id,title,address,city,state,property_type,is_multi_unit,total_units,community_starting_rent,price_range,monthly_rent&or=(is_multi_unit.eq.true,community_starting_rent.not.is.null,price_range.not.is.null)&limit=1000`;
  return await sbFetch(path);
}

function isTrueCommunity(prop) {
  // A true community must have multiple units confirmed
  const units = Number(prop.total_units);
  return prop.is_multi_unit === true && units > 1;
}

async function main() {
  console.log('🔍 Fetching properties with community flags...');
  const props = await fetchFlaggedProperties();
  if (!props || props.length === 0) {
    console.log('✅ No flagged properties found. All clean!');
    return;
  }

  console.log(`Found ${props.length} properties with community flags.`);

  const toFix = props.filter(p => !isTrueCommunity(p));
  const trueCommunities = props.filter(p => isTrueCommunity(p));

  console.log(`\n✅ True communities (keeping flags): ${trueCommunities.length}`);
  trueCommunities.forEach(p => console.log(`   - ${p.address}, ${p.city}, ${p.state} | type=${p.property_type} | units=${p.total_units}`));

  console.log(`\n🛠  Fixing ${toFix.length} single-unit properties with stale community flags:`);
  toFix.forEach(p => console.log(`   - ${p.address}, ${p.city}, ${p.state} | type=${p.property_type} | is_multi_unit=${p.is_multi_unit} | community_starting_rent=${p.community_starting_rent} | price_range=${p.price_range}`));

  if (toFix.length === 0) {
    console.log('Nothing to fix.');
    return;
  }

  let fixed = 0;
  let errors = 0;

  for (const prop of toFix) {
    try {
      const patch = {
        is_multi_unit: false,
        community_starting_rent: null,
        price_range: null,
      };

      // If community_starting_rent was set but monthly_rent is null, copy it over
      if (prop.community_starting_rent != null && !prop.monthly_rent) {
        patch.monthly_rent = prop.community_starting_rent;
        console.log(`   📋 Copying community_starting_rent → monthly_rent for ${prop.address}`);
      }

      await sbFetch(
        `/rest/v1/properties?id=eq.${prop.id}`,
        'PATCH',
        patch,
      );
      console.log(`   ✅ Fixed: ${prop.address}, ${prop.city}, ${prop.state}`);
      fixed++;
    } catch (err) {
      console.error(`   ❌ Error fixing ${prop.id} (${prop.address}):`, err.message);
      errors++;
    }
  }

  console.log(`\n🎉 Done. Fixed: ${fixed} | Errors: ${errors}`);

  // Also fix pipeline properties
  console.log('\n🔍 Checking pipeline_properties...');
  try {
    const pipelinePath = `/rest/v1/pipeline_properties?select=id,address,city,state,property_type,is_multi_unit,total_units,community_starting_rent,price_range,monthly_rent&or=(is_multi_unit.eq.true,community_starting_rent.not.is.null,price_range.not.is.null)&limit=1000`;
    const pipelineProps = await sbFetch(pipelinePath);
    if (!pipelineProps || pipelineProps.length === 0) {
      console.log('✅ No flagged pipeline properties found.');
      return;
    }

    const pipelineToFix = pipelineProps.filter(p => !isTrueCommunity(p));
    console.log(`🛠  Fixing ${pipelineToFix.length} pipeline properties with stale community flags...`);

    let pFixed = 0;
    for (const prop of pipelineToFix) {
      try {
        const patch = {
          is_multi_unit: false,
          community_starting_rent: null,
          price_range: null,
        };
        if (prop.community_starting_rent != null && !prop.monthly_rent) {
          patch.monthly_rent = prop.community_starting_rent;
        }
        await sbFetch(`/rest/v1/pipeline_properties?id=eq.${prop.id}`, 'PATCH', patch);
        pFixed++;
      } catch (err) {
        console.error(`   ❌ Pipeline fix error for ${prop.id}:`, err.message);
      }
    }
    console.log(`✅ Pipeline: Fixed ${pFixed} / ${pipelineToFix.length}`);
  } catch (pipelineErr) {
    console.warn('⚠️  Could not fix pipeline_properties (table may not exist):', pipelineErr.message);
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
