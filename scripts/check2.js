const fs = require('fs');
let key;
const envFile = fs.readFileSync('.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
    if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
        key = line.split('=')[1].trim().replace(/^"|"$/g, '');
    }
}
fetch(`https://tlfmwetmhthpyrytrcfo.supabase.co/rest/v1/properties?select=id,address,city`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
}).then(r => r.json()).then(d => {
    console.log(d.filter(x => x.city.includes("Charlotte")));
});
