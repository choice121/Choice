import { CREDENTIALS_CONFIG } from './credentials-config.mjs';
const url = CREDENTIALS_CONFIG.SUPABASE_URL + '/rest/v1/properties?select=*,landlords(verified),property_photos(url,display_order)&id=in.(2d90abf9-9677-492e-aa1a-0e0804ad1c4e)&status=eq.active';
const key = CREDENTIALS_CONFIG.SUPABASE_API_KEY; // The one from config.js
fetch(url, { headers: { apikey: key, Authorization: 'Bearer ' + key }}).then(r=>r.json()).then(console.log);
