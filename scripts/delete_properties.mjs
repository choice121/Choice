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
    'Content-Type': 'application/json'
};

const idsToDelete = [
    "bb49df41-21f7-4d86-acf2-3804d65b0d28", // 5414 Princess St
    "3680f889-9134-4276-bf6f-30057afb0cf8", // 5521 Jesse Harper Dr
    "f2ce68ab-befa-4833-8bb1-865e66c9af47", // 812 Silver Ct
    "885dab00-1096-4d73-9a87-4e03e080893c", // 9128 Lowfalls Ln
    "40973c67-c220-4157-82fe-5a0568a018bc", // 3125 Ophelia Aly
    "8139df1d-09d6-4b79-a7b5-2bb657e0580a"  // 7117 Millie Fae Aly
];

async function main() {
    for (const id of idsToDelete) {
        // First delete photos to avoid FK constraint issues if any (though usually cascading)
        await fetch(`${SUPABASE_URL}/rest/v1/property_photos?property_id=eq.${id}`, {
            method: 'DELETE',
            headers
        });
        
        // Then delete the property
        const response = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${id}`, {
            method: 'DELETE',
            headers
        });
        
        if (response.ok) {
            console.log(`Successfully deleted property ${id}`);
        } else {
            console.error(`Failed to delete property ${id}:`, response.status, await response.text());
        }
    }
}

main();
