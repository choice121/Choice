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

const missingAddresses = [
    "5414 Princess St", "5521 Jesse Harper Dr", "812 Silver Ct", 
    "9128 Lowfalls Ln", "3125 Ophelia Aly", "7117 Millie Fae Aly"
];

const knownIds = {
    "5414 Princess St": "bb49df41-21f7-4d86-acf2-3804d65b0d28",
    "5521 Jesse Harper Dr": "3680f889-9134-4276-bf6f-30057afb0cf8",
    "812 Silver Ct": "f2ce68ab-befa-4833-8bb1-865e66c9af47",
    "9128 Lowfalls Ln": "885dab00-1096-4d73-9a87-4e03e080893c",
    "3125 Ophelia Aly": "40973c67-c220-4157-82fe-5a0568a018bc",
    "7117 Millie Fae Aly": "8139df1d-09d6-4b79-a7b5-2bb657e0580a"
};

async function main() {
    const rawData = JSON.parse(fs.readFileSync('scripts/charlotte_selected.json', 'utf-8'));
    const allScraped = [...(rawData.houses || []), ...(rawData.townhomes || [])];
    
    for (const addr of missingAddresses) {
        const p = allScraped.find(s => s.address === addr);
        if (!p) {
            console.log("Not in JSON:", addr);
            continue;
        }
        
        const prop_id = knownIds[addr] || crypto.randomUUID();
        const prop_type = p.is_townhome ? 'TOWNHOMES' : 'SINGLE_FAMILY';
        const type_str = p.is_townhome ? 'townhome' : 'single-family home';
        const beds = p.beds;
        const baths = p.baths;
        const rent = p.rent;
        const sqft = p.sqft;
        const city = p.city;
        const state = p.state;
        const zip_code = p.zip;
        const today = new Date().toISOString().split('T')[0];
        
        const desc = `Welcome to your new home! This beautifully maintained ${beds}-bedroom, ${baths}-bathroom ${type_str} offers exceptional comfort, modern design, and everyday convenience in ${city}, ${state}.

Experience comfortable living in this beautifully designed home. Featuring a bright open-concept layout, generous living areas, and high-quality finishes throughout. The fully equipped kitchen opens seamlessly into the dining and living spaces, creating the perfect atmosphere for both relaxing and entertaining.

Key Property Features & Highlights:
• ${beds} Spacious Bedrooms & ${baths} Bathrooms
• Central Air Conditioning & Heating
• Modern Kitchen Cabinetry & Storage
• Pet-Friendly Environment
• Luxury Plank Flooring Throughout
• Private Fenced-in Backyard
• Attached Garage Parking

Lease & Application Information:
• Monthly Rent: $${rent}
• Security Deposit: $${rent} (Equal to 1 month's rent)
• Application Fee: $50 per adult applicant
• Pet Policy: Pet-Friendly (Cats & Dogs Welcome)
• Lease Terms: 12-Month Minimum`;

        const title = `${beds}BR/${baths}BA ${type_str === 'townhome' ? 'Townhome' : 'Single-Family Home'} in ${city} – $${rent}/mo`;

        const payload = {
            id: prop_id, landlord_id: LANDLORD_ID, title, description: desc,
            address: addr, city, state, zip: zip_code, county: "Mecklenburg County",
            lat: p.lat, lng: p.lng, property_type: prop_type, year_built: p.year_built,
            bedrooms: beds, bathrooms: parseInt(baths), total_bathrooms: baths,
            square_footage: sqft, garage_spaces: 1, monthly_rent: rent, security_deposit: rent,
            application_fee: 50, available_date: today, minimum_lease_months: 12, lease_terms: ["12 months"],
            pets_allowed: true, pet_types_allowed: ["Dogs", "Cats"], pet_deposit: 300,
            smoking_allowed: false, has_central_air: true, parking: "Garage/Driveway",
            heating_type: "Central Forced Air", cooling_type: "Central Air Conditioning",
            laundry_type: "In-Unit Laundry Room", amenities: ["Air Conditioning", "Central Heating", "Pet Friendly"],
            appliances: ["Refrigerator", "Stove / Range", "Dishwasher"],
            status: "active", listed_at: today, featured: false
        };

        const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/properties`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });
        
        if (insertRes.ok) {
            console.log("Republished & enriched:", addr);
            
            // Re-insert photos
            const clean_photos = p.photos.filter(u => u && u.startsWith('http')).slice(0, 20);
            const photoRows = clean_photos.map((url, p_idx) => ({
                property_id: prop_id,
                url,
                display_order: p_idx,
                is_hero: (p_idx === 0),
                watermark_status: "clean",
                alt_text: `${addr}, ${city} NC - Photo ${p_idx + 1}`
            }));
            
            await fetch(`${SUPABASE_URL}/rest/v1/property_photos`, {
                method: 'POST',
                headers: { ...headers, 'Prefer': 'return=minimal' },
                body: JSON.stringify(photoRows)
            });
        } else {
            console.error("Failed to republish:", addr, await insertRes.text());
        }
    }
}
main();
