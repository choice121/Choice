const fs = require('fs');
let key;
const envFile = fs.readFileSync('.env.local', 'utf-8');
for (const line of envFile.split('\n')) {
    if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
        key = line.split('=')[1].trim().replace(/^"|"$/g, '');
    }
}
fetch(`https://tlfmwetmhthpyrytrcfo.supabase.co/rest/v1/properties`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
}).then(r => r.json()).then(d => {
    console.log(d.length);
    console.log("Missing addresses:", [
        "5414 Princess St", "5521 Jesse Harper Dr", "812 Silver Ct", 
        "9128 Lowfalls Ln", "3125 Ophelia Aly", "7117 Millie Fae Aly"
    ].map(a => d.find(p => p.address === a) ? "Found: " + a : "Missing: " + a));
});
