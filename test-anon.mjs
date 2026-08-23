import { CREDENTIALS_CONFIG } from './credentials-config.mjs';
const url = CREDENTIALS_CONFIG.SUPABASE_URL + '/rest/v1/client_collections?select=*';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsZm13ZXRtaHRocHlyeXRyY2ZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxODMwMjQsImV4cCI6MjA5MDc1OTAyNH0.Q8-LUNB4wU_OIt8c73HjUjE5F4_Q3X_oX3T_s_5ZlZ4';
fetch(url, { headers: { apikey: key, Authorization: 'Bearer ' + key }}).then(r=>r.json()).then(console.log);
