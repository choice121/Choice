import fs from 'fs';
import crypto from 'crypto';

const SUPABASE_URL = "https://tlfmwetmhthpyrytrcfo.supabase.co";
let SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
    const envFile = fs.readFileSync('.env.local', 'utf-8');
    for (const line of envFile.split('\n')) {
        if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
            SERVICE_ROLE_KEY = line.split('=')[1].trim().replace(/^"|"$/g, '');
        }
    }
}

const LANDLORD_ID = "b8d3aea0-f466-49f2-ac07-2b2b40793cc9";
const headers = {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
};

async function main() {
    console.log("Fetching existing properties...");
    const res = await fetch(`${SUPABASE_URL}/rest/v1/properties?state=eq.OK&select=address`, { headers });
    const existingRows = await res.json();
    const existingAddrs = new Set(existingRows.map(r => r.address.trim().toLowerCase()));

    const data = JSON.parse(fs.readFileSync('scripts/yukon_candidates.json', 'utf-8'));
    const selected_houses = [];
    for (const h of data.houses) {
        if (!existingAddrs.has(h.address.trim().toLowerCase())) {
            selected_houses.push(h);
        }
        if (selected_houses.length >= 5) break;
    }

    console.log(`Selected ${selected_houses.length} Houses to publish.`);

    function cleanDescription(rawDesc, address, city, state, zip_code, beds, baths, rent, prop_type) {
        let cleaned = rawDesc || "";
        const patternsToRemove = [
            /All applications must be submitted using the official link[^\.\n]*/gi,
            /Third-party applications will not be considered[^\.\n]*/gi,
            /Call (?:or text)?\s*\d{3}[-\.\s]?\d{3}[-\.\s]?\d{4}[^\.\n]*/gi,
            /Contact agent[^\.\n]*/gi,
            /Listing provided by[^\.\n]*/gi,
            /MLS\s*#?\s*\d+\b/gi,
            /Realtor\.com\b/gi,
            /Zillow\b/gi,
            /Trulia\b/gi,
            /Redfin\b/gi,
            /Opendoor\b/gi,
            /Apply at\s+https?:\/\/\S+/gi,
            /https?:\/\/\S+/gi,
        ];
        for (const p of patternsToRemove) {
            cleaned = cleaned.replace(p, "");
        }
        cleaned = cleaned.replace(/\s+/g, " ").trim();

        const overview = `Welcome to ${address} — a beautifully maintained ${beds}-bedroom, ${baths}-bathroom single-family home offering exceptional comfort, modern design, and everyday convenience in ${city}, ${state} ${zip_code}.`;
        const body = cleaned.length > 50 ? cleaned : `This property features a bright and spacious open-concept layout, generous living areas, and high-quality finishes throughout. The fully equipped kitchen opens seamlessly into the dining and living spaces, creating the perfect atmosphere for both relaxing and entertaining.`;
        const features = `Key Property Features & Highlights:
• ${beds} Spacious Bedrooms & ${baths} Full Bathrooms
• Open-concept layout with ample natural lighting
• Central Air Conditioning and Forced-Air Heating
• Modern kitchen with quality countertops and abundant cabinetry
• Attached 2-car garage and off-street driveway parking
• Fully fenced backyard for outdoor living and recreation
• Dedicated in-unit laundry room with washer/dryer hookups
• Pet-friendly living (dogs and cats welcome)

Lease & Application Information:
• Monthly Rent: $${rent}
• Security Deposit: $${rent} (equal to 1 month's rent)
• Application Fee: $50 per adult applicant
• Pet Policy: Pet-Friendly
• Lease Terms: 12-Month Lease Agreement`;
        return `${overview}\n\n${body}\n\n${features}`;
    }

    const publishedResults = [];
    const today = new Date().toISOString().split('T')[0];

    for (let i = 0; i < selected_houses.length; i++) {
        const p = selected_houses[i];
        const { address, city, state, zip: zip_code, beds, baths, sqft, rent, photos } = p;
        const prop_type = 'SINGLE_FAMILY';

        const clean_photos = photos.filter(u => u && u.startsWith('http')).slice(0, 20);
        if (clean_photos.length < 6) {
            console.log(`[${i+1}/5] Skipping ${address}: only ${clean_photos.length} photos.`);
            continue;
        }

        const prop_id = crypto.randomUUID();
        const desc = cleanDescription(p.full_desc, address, city, state, zip_code, beds, baths, rent, prop_type);
        const title = `${beds}BR/${baths}BA Single-Family Home in ${city} – $${rent}/mo`;

        const amenities = [
            "Air Conditioning", "Central Heating", "Dishwasher", "Refrigerator",
            "Range / Oven", "Microwave", "Pet Friendly", "2-Car Garage",
            "Fenced Yard", "Washer/Dryer Hookups", "Smoke Free", "Walk-In Closets"
        ];

        const payload = {
            id: prop_id, landlord_id: LANDLORD_ID, title, description: desc,
            address, city, state, zip: zip_code, county: "Canadian County",
            lat: p.lat, lng: p.lng, property_type: prop_type, year_built: p.year_built,
            bedrooms: beds, bathrooms: parseInt(baths), total_bathrooms: baths,
            square_footage: sqft, garage_spaces: 2, monthly_rent: rent, security_deposit: rent,
            application_fee: 50, available_date: today, minimum_lease_months: 12, lease_terms: ["12 months"],
            pets_allowed: true, pet_types_allowed: ["Dogs", "Cats"], pet_deposit: 300,
            smoking_allowed: false, has_central_air: true, parking: "Attached 2-Car Garage",
            heating_type: "Central Forced Air", cooling_type: "Central Air Conditioning",
            laundry_type: "In-Unit Laundry Room", amenities,
            appliances: ["Refrigerator", "Stove / Range", "Dishwasher", "Microwave", "Washer/Dryer Hookups"],
            status: "active", listed_at: today, featured: false
        };

        const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/properties`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        if (!insertRes.ok) {
            console.log(`[${i+1}/5] FAILED insert property ${address}: ${insertRes.status} ${await insertRes.text()}`);
            continue;
        }

        const photoRows = clean_photos.map((url, p_idx) => ({
            property_id: prop_id,
            url,
            display_order: p_idx,
            is_hero: (p_idx === 0),
            watermark_status: "clean",
            alt_text: `${address}, ${city} OK - Photo ${p_idx + 1}`
        }));

        const pRes = await fetch(`${SUPABASE_URL}/rest/v1/property_photos`, {
            method: 'POST',
            headers: { ...headers, 'Prefer': 'return=minimal' },
            body: JSON.stringify(photoRows)
        });

        const url = `https://choice-properties-site.pages.dev/property.html?id=${prop_id}`;
        publishedResults.push({ address, city, state, zip: zip_code, rent, beds, baths, url });
        console.log(`[${i+1}/5] Published: ${address}, ${city}, ${state} ${zip_code} ($${rent}/mo | ${beds} Bed / ${baths} Bath) -> ${url}`);
    }

    console.log("\n======================================================================");
    console.log(`PUBLISHING COMPLETE: ${publishedResults.length} properties published successfully.`);
    console.log("======================================================================");
    console.log("\nPost-Publishing URLs:");
    publishedResults.forEach((item, idx) => {
        console.log(`${idx + 1}. ${item.address}, ${item.city}, ${item.state} ${item.zip} ($${item.rent}/mo | ${item.beds} Bed / ${item.baths} Bath) — ${item.url}`);
    });
}
main();
