import { CREDENTIALS_CONFIG } from './credentials-config.mjs';
const url = CREDENTIALS_CONFIG.SUPABASE_URL + '/rest/v1/client_collections?select=*';
const key = CREDENTIALS_CONFIG.SUPABASE_API_KEY;
fetch(url, { headers: { apikey: key, Authorization: 'Bearer ' + key }}).then(r=>r.json()).then(console.log);
