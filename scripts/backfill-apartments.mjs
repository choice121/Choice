// Backfill script for existing apartment properties
import fetch from 'node-fetch';

const SUPABASE_URL = 'https://tlfmwetmhthpyrytrcfo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxODMwMjQsImV4cCI6MjA5MDc1OTAyNH0.sqjt9_oMKDoorA8Tzed1hlkH5zEQGZvFskAG3Qr9CFw';

const KNOWN_BUILDINGS = {
  '3500 W Colorado Blvd': { building_name: 'Emblem Ravine', is_multi_unit: true, floors: 3 },
  '2522 Fort Worth Ave': { building_name: 'Aventine at Kessler Park', is_multi_unit: true, floors: 3 },
  '17501 Dallas Pkwy': { building_name: 'Bent Tree Lofts', is_multi_unit: true, floors: 4 },
  '4931 Live Oak St': { building_name: 'The Flynn at Live Oak', is_multi_unit: true, floors: 4 },
  '7425 La Vista Dr': { building_name: 'Lakewood Flats', is_multi_unit: true, floors: 3 },
  '2013 Jackson St': { building_name: 'The Parc on Jackson', is_multi_unit: true, floors: 5 },
  '2275 Hawes Ave': { building_name: 'Lantower West Love', is_multi_unit: true, floors: 4 },
  '18081 Midway Rd': { building_name: "Hunter's Hill Apartments", is_multi_unit: true, floors: 2 },
  '4750 Haverwood Ln': { building_name: 'Stone Ridge Apartments', is_multi_unit: true, floors: 3 },
  '2501 Webb Chapel Ext': { building_name: 'The Waverly Apartments', is_multi_unit: true, floors: 2 },
  '2425 W Dublin Granville Rd': { building_name: 'District at Linworth', is_multi_unit: true, floors: 3 },
  '1300 E Ayers St': { building_name: 'Jubilee Residences', is_multi_unit: true, floors: 2 },
  '1903 Education Way': { building_name: 'Teagarden Estates', is_multi_unit: true, floors: 2 }
};

async function inspectAndBackfill() {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/properties?select=id,address,city,state,property_type,description,unit_number,unit_floor,building_name,is_multi_unit,floors&property_type=eq.APARTMENT&limit=100`, { headers });
  const rows = await res.json();
  console.log(`Fetched ${rows.length} APARTMENT rows.`);

  let updatedCount = 0;

  for (const r of rows) {
    let patch = {};
    const cleanAddr = r.address.replace(/,\s*[A-Z]{2}.*$/, '').trim();
    
    // Check known building list
    for (const [key, bData] of Object.entries(KNOWN_BUILDINGS)) {
      if (cleanAddr.includes(key) || r.address.includes(key)) {
        patch.building_name = bData.building_name;
        patch.is_multi_unit = bData.is_multi_unit;
        if (!r.floors && bData.floors) patch.floors = bData.floors;
        break;
      }
    }

    // Extract unit number from address if not present
    if (!r.unit_number) {
      const uMatch = r.address.match(/(?:Apt|Unit|Suite|#)\s*([A-Za-z0-9-]+)/i);
      if (uMatch) {
        patch.unit_number = uMatch[1];
      }
    }

    // If unit number has a floor indication (e.g. 208 -> Floor 2, 3S -> Floor 3)
    if (!r.unit_floor) {
      const targetUnit = patch.unit_number || r.unit_number;
      if (targetUnit) {
        if (/^[1-9]\d{2}$/.test(targetUnit)) {
          patch.unit_floor = `Floor ${targetUnit[0]}`;
        } else if (/^[1-9][A-Z]$/i.test(targetUnit)) {
          patch.unit_floor = `Floor ${targetUnit[0]}`;
        }
      }
    }

    // If the apartment has multiple units or is in a complex, ensure is_multi_unit = true
    if (patch.building_name && patch.is_multi_unit === undefined && !r.is_multi_unit) {
      patch.is_multi_unit = true;
    }

    if (Object.keys(patch).length > 0) {
      console.log(`Patching ${r.id} (${r.address}):`, patch);
      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${r.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(patch)
      });
      if (patchRes.ok) {
        updatedCount++;
      } else {
        const err = await patchRes.text();
        console.error(`Failed to patch ${r.id}:`, err);
      }
    }
  }

  console.log(`Backfill finished. Successfully updated ${updatedCount} apartments.`);
}

inspectAndBackfill().catch(console.error);
