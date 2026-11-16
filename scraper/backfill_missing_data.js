const fs = require('fs');
const https = require('https');

const SUPABASE_URL = "https://tlfmwetmhthpyrytrcfo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE4MzAyNCwiZXhwIjoyMDkwNzU5MDI0fQ.oO9N8LslPcDjQrzZWiUoTkOlDBqUVHBiVhRSGLC-EPE";

const HEADERS_DB = {
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`,
    "Accept-Profile": "pipeline",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
};

const HEADERS_WEB = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
};

async function fetchRecords() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_properties?select=id,source,source_url,description,heating_type,cooling_type,year_built,parking,pets_allowed&limit=1000`, { headers: HEADERS_DB });
    let data = await res.json();
    if (!Array.isArray(data)) {
        console.error("Error from Supabase:", data);
        return [];
    }
    return data.filter(d => !d.heating_type || !d.cooling_type || !d.year_built || !d.parking || d.pets_allowed === null);
}

function extractFromText(text) {
    if (!text) return {};
    const lower = text.toLowerCase();
    const res = {};

    let m = lower.match(/(?:built in|year built|built)[:\s-]*(\d{4})/);
    if (m && parseInt(m[1]) >= 1800 && parseInt(m[1]) <= 2030) res.year_built = parseInt(m[1]);

    m = lower.match(/(central heat|forced air|gas heat|electric heat|baseboard)/);
    if (m) {
        res.heating_type = m[1].replace(/\b\w/g, l => l.toUpperCase());
    }

    if (/(central air|central ac|central a\/c|hvac)/.test(lower)) res.cooling_type = 'Central Air';
    else if (lower.includes('window unit')) res.cooling_type = 'Window Units';

    m = lower.match(/(\d+)\s*(?:car|space)\s*garage/);
    if (m) res.parking = `${m[1]} Car Garage`;
    else if (lower.includes('garage')) res.parking = 'Garage';
    else if (lower.includes('off-street') || lower.includes('off street')) res.parking = 'Off-Street Parking';

    if (/(no pets|pets not allowed|no dogs|no cats)/.test(lower)) res.pets_allowed = false;
    else if (/(pet friendly|pets allowed|cats ok|dogs ok|pets ok)/.test(lower)) res.pets_allowed = true;

    return res;
}

function extractFromHtml(html, source) {
    const res = extractFromText(html);
    if (source === 'zillow') {
        let m = html.match(/"yearBuilt":(\d{4})/);
        if (m && parseInt(m[1]) >= 1800 && parseInt(m[1]) <= 2030) res.year_built = parseInt(m[1]);

        m = html.match(/"Heating"]\},"values":\["([^"]+)"/);
        if (m) res.heating_type = m[1];

        m = html.match(/"Cooling"]\},"values":\["([^"]+)"/);
        if (m) res.cooling_type = m[1];

        m = html.match(/"Parking"]\},"values":\["([^"]+)"/);
        if (m) res.parking = m[1];
    } else if (source === 'realtor') {
        let m = html.match(/"year_built":(\d{4})/);
        if (m && parseInt(m[1]) >= 1800 && parseInt(m[1]) <= 2030) res.year_built = parseInt(m[1]);
    }
    return res;
}

async function main() {
    const records = await fetchRecords();
    console.log(`Found ${records.length} records needing backfill.`);

    let updatedCount = 0;
    for (let i = 0; i < records.length; i++) {
        const rec = records[i];
        console.log(`[${i + 1}/${records.length}] Analyzing ${rec.source_url || 'No URL'}`);

        const updates = extractFromText(rec.description || '');

        const needed = ['year_built', 'heating_type', 'cooling_type', 'parking', 'pets_allowed'];
        const missingAny = needed.some(k => rec[k] === null && updates[k] === undefined);

        if (missingAny && rec.source_url) {
            try {
                const ac = new AbortController();
                const timeout = setTimeout(() => ac.abort(), 8000);
                const r = await fetch(rec.source_url, { headers: HEADERS_WEB, signal: ac.signal });
                clearTimeout(timeout);
                if (r.ok) {
                    const html = await r.text();
                    const htmlUpdates = extractFromHtml(html, rec.source);
                    for (const [k, v] of Object.entries(htmlUpdates)) {
                        if (updates[k] === undefined) updates[k] = v;
                    }
                }
            } catch (e) {
                // ignore
            }
        }

        const finalUpdates = {};
        for (const [k, v] of Object.entries(updates)) {
            if (rec[k] === null) {
                finalUpdates[k] = v;
            }
        }

        if (Object.keys(finalUpdates).length > 0) {
            console.log(`   => Found new data:`, finalUpdates);
            
            // Note: Since the pipeline schema isn't exposed directly on the REST API due to 
            // the PostgREST configuration in this project, we must update it by calling an RPC
            // function, or patching the public.properties table if it's already published.
            // For this quick backfill, we will use the admin update RPC if available.
            const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pipeline_save`, {
                method: 'POST',
                headers: { ...HEADERS_DB },
                body: JSON.stringify({ p_id: rec.id, p_patch: finalUpdates })
            });
            if (patchRes.ok) {
                updatedCount++;
            } else {
                console.log(`   => Update failed:`, await patchRes.text());
            }
        } else {
            console.log(`   => No new data found.`);
        }
    }

    console.log(`Finished! Successfully backfilled ${updatedCount} records.`);
}

main().catch(console.error);
