const fs = require('fs');
let key;
const envFile = fs.readFileSync('.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
    if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
        key = line.split('=')[1].trim().replace(/^"|"$/g, '');
    }
}
fetch(`https://tlfmwetmhthpyrytrcfo.supabase.co/rest/v1/properties?id=eq.bb49df41-21f7-4d86-acf2-3804d65b0d28`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
}).then(r => r.json()).then(d => console.log(d));
