import { CREDENTIALS_CONFIG } from './credentials-config.mjs';
const url = CREDENTIALS_CONFIG.SUPABASE_URL + '/rest/v1/client_collections?id=eq.7958b02a-9f0a-4830-a1fa-162d7c559831';
const key = CREDENTIALS_CONFIG.SUPABASE_API_KEY;
fetch(url, { headers: { apikey: key, Authorization: 'Bearer ' + key }}).then(r=>r.json()).then(console.log);
