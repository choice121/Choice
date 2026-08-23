import { CREDENTIALS_CONFIG } from './credentials-config.mjs';
const url = CREDENTIALS_CONFIG.SUPABASE_URL + '/rest/v1/properties?status=eq.active&id=in.(2d90abf9-9677-492e-aa1a-0e0804ad1c4e,35ef2606-6a78-40fa-89b9-e3d118c990b3)&select=id,status';
const key = CREDENTIALS_CONFIG.SUPABASE_API_KEY;
fetch(url, { headers: { apikey: key, Authorization: 'Bearer ' + key }}).then(r=>r.json()).then(console.log);
