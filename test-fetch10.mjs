import { CREDENTIALS_CONFIG } from './credentials-config.mjs';
const url = CREDENTIALS_CONFIG.SUPABASE_URL + '/rest/v1/properties?select=id,status&id=in.(2d90abf9-9677-492e-aa1a-0e0804ad1c4e,35ef2606-6a78-40fa-89b9-e3d118c990b3,877a411a-d336-414e-8f49-4234c39ced4e,a9383722-db43-4f43-a288-8c4f46e8cdd6,dbe648b5-e43a-48a1-b927-d246e075ee74,8666d982-8c1c-4651-873a-fd7e74e5f192,547767fd-f252-4483-88d9-d413030fab21,0eceb7b3-c210-40f1-8b4e-aabd128e4fc3,8aa9e8c7-6598-4f8a-ba00-982478eeb179,2fa7db45-54e3-4f5e-85d3-cef969db1d35)&status=eq.active';
const key = CREDENTIALS_CONFIG.SUPABASE_API_KEY;
fetch(url, { headers: { apikey: key, Authorization: 'Bearer ' + key }}).then(r=>r.json()).then(console.log);
