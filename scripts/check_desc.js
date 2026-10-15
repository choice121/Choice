const fs = require('fs');
let key;
const envFile = fs.readFileSync('.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
    if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
        key = line.split('=')[1].trim().replace(/^"|"$/g, '');
    }
}
fetch(`https://tlfmwetmhthpyrytrcfo.supabase.co/rest/v1/properties?id=eq.f42ca76d-4d17-4ba9-910b-2d82ccaf1746`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
}).then(r => r.json()).then(d => {
    console.log(d[0].description);
});
