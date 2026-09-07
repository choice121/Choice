import fs from 'fs';

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

const headers = {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
};

const propertiesToUpdate = [
    "2719 Capitol Dr", "5414 Princess St", "7109 Rockcliff Ct", "6428 Whitewater Dr",
    "5521 Jesse Harper Dr", "10440 Wilson Glen Dr", "812 Silver Ct", "7024 Capstan Ter",
    "12571 Bluestem Ln", "2830 Hosta Dr", "9128 Lowfalls Ln", "3125 Ophelia Aly",
    "9342 Mallard Mills Dr", "7117 Millie Fae Aly"
];

function cleanOriginalText(text) {
    let t = text || "";
    
    // Remove promotional all caps sentences (like ONE MONTH FREE RENT...)
    t = t.replace(/[A-Z0-9\s!-\/\$\%]{20,}(?:\!|\.|$)/g, " ");
    
    const patterns = [
        /All applications must be submitted[^\.\n]*/gi,
        /Third-party applications[^\.\n]*/gi,
        /Call\s*(?:or text)?\s*\d+[-\.\s]?\d+[-\.\s]?\d+[^\.\n]*/gi,
        /Contact agent[^\.\n]*/gi,
        /Listing provided by[^\.\n]*/gi,
        /MLS\s*#?\s*\d+\b/gi,
        /Realtor\.com\b/gi,
        /Zillow\b/gi,
        /Trulia\b/gi,
        /Redfin\b/gi,
        /Opendoor\b/gi,
        /TurboTenant\b/gi,
        /Apartments\.com\b/gi,
        /schedule a tour[^\.\n]*/gi,
        /open house[^\.\n]*/gi,
        /viewing[^\.\n]*/gi,
        /Apply (?:at|online)[^\.\n]*/gi,
        /https?:\/\/\S+/gi,
        /NOT AVAILABLE FOR HOUSING VOUCHERS[^\.\n]*/gi,
        /Section 8[^\.\n]*/gi,
        /Renter pays all utilities[^\.\n]*/gi,
        /tenant responsible for[^\.\n]*/gi,
        /Application fee[^\.\n]*/gi,
        /Deposit[^\.\n]*/gi,
        /Pet (?:fee|deposit|rent)[^\.\n]*/gi,
        /Qualifications:[^\.\n]*/gi,
        /Requirements:[^\.\n]*/gi,
        /Income must be[^\.\n]*/gi,
        /Credit score[^\.\n]*/gi,
        /Background check[^\.\n]*/gi,
        /Eviction[^\.\n]*/gi
    ];
    
    for (let p of patterns) {
        t = t.replace(p, "");
    }
    
    // Cleanup double spaces, weird punctuation at start
    t = t.replace(/\s+/g, " ").trim();
    t = t.replace(/^[!,\.\- ]+/, "");
    
    return t;
}

function extractFeatures(text) {
    const features = [];
    const t = text.toLowerCase();
    
    if (t.includes('granite') || t.includes('quartz')) features.push("Premium Granite or Quartz Countertops");
    if (t.includes('stainless')) features.push("Sleek Stainless Steel Appliances");
    if (t.includes('hardwood') || t.includes('lvp') || t.includes('vinyl plank')) features.push("Luxury Plank Flooring Throughout");
    if (t.includes('fenced')) features.push("Private Fenced-in Backyard");
    if (t.includes('garage')) features.push("Attached Garage Parking");
    if (t.includes('washer') || t.includes('dryer')) features.push("In-Unit Washer & Dryer Connections");
    if (t.includes('walk-in closet') || t.includes('walk in closet')) features.push("Spacious Walk-In Closets");
    if (t.includes('patio') || t.includes('deck')) features.push("Outdoor Patio / Deck Area");
    if (t.includes('island')) features.push("Kitchen Island with Breakfast Bar");
    if (t.includes('pantry')) features.push("Walk-in Kitchen Pantry");
    if (t.includes('vaulted')) features.push("Vaulted or High Ceilings");
    if (t.includes('natural light')) features.push("Abundant Natural Lighting");
    if (t.includes('renovated') || t.includes('updated')) features.push("Recently Renovated / Updated Finishes");
    
    return features;
}

async function main() {
    const rawData = JSON.parse(fs.readFileSync('scripts/charlotte_selected.json', 'utf-8'));
    const allScraped = [...(rawData.houses || []), ...(rawData.townhomes || [])];
    
    for (const address of propertiesToUpdate) {
        const scraped = allScraped.find(s => s.address.toLowerCase().includes(address.toLowerCase()));
        if (!scraped) {
            console.log("Could not find scraped data for:", address);
            continue;
        }
        
        const res = await fetch(`${SUPABASE_URL}/rest/v1/properties?address=eq.${encodeURIComponent(address)}`, {
            headers
        });
        
        if (!res.ok) {
            console.log("Failed API req:", address, await res.text());
            continue;
        }
        
        const rows = await res.json();
        if (!rows || rows.length === 0) {
            console.log("Could not find DB record for:", address);
            continue;
        }
        
        const dbProp = rows[0];
        
        let cleanedBody = cleanOriginalText(scraped.full_desc);
        if (cleanedBody.length < 50) {
            cleanedBody = "Experience comfortable living in this beautifully designed home. Featuring a bright open-concept layout, generous living areas, and high-quality finishes throughout. The fully equipped kitchen opens seamlessly into the dining and living spaces, creating the perfect atmosphere for both relaxing and entertaining.";
        }
        
        const extractedFeatures = extractFeatures(scraped.full_desc);
        const defaultFeatures = [
            `${dbProp.bedrooms} Spacious Bedrooms & ${dbProp.total_bathrooms} Bathrooms`,
            "Central Air Conditioning & Heating",
            "Modern Kitchen Cabinetry & Storage",
            "Pet-Friendly Environment"
        ];
        
        // Merge and deduplicate
        const mergedFeatures = [...new Set([...defaultFeatures, ...extractedFeatures])];
        
        const type_str = scraped.is_townhome ? "townhome" : "single-family home";
        
        const newDesc = `Welcome to your new home! This beautifully maintained ${dbProp.bedrooms}-bedroom, ${dbProp.total_bathrooms}-bathroom ${type_str} offers exceptional comfort, modern design, and everyday convenience in ${dbProp.city}, ${dbProp.state}.

${cleanedBody}

Key Property Features & Highlights:
${mergedFeatures.map(f => `• ${f}`).join('\n')}

Lease & Application Information:
• Monthly Rent: $${dbProp.monthly_rent}
• Security Deposit: $${dbProp.monthly_rent} (Equal to 1 month's rent)
• Application Fee: $50 per adult applicant
• Pet Policy: Pet-Friendly (Cats & Dogs Welcome)
• Lease Terms: 12-Month Minimum`;

        // Update in DB
        const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${dbProp.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ description: newDesc })
        });
        
        if (updateRes.ok) {
            console.log("Successfully enriched:", address);
        } else {
            console.error("Failed to enrich:", address, await updateRes.text());
        }
    }
}
main();
