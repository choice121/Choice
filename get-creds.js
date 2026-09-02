import { CREDENTIALS_CONFIG } from "./credentials-config.mjs";
async function get() {
  const res = await fetch(`${CREDENTIALS_CONFIG.SUPABASE_URL}/rest/v1/credentials_config?select=*`, {
    headers: {
      'apikey': CREDENTIALS_CONFIG.SUPABASE_API_KEY,
      'Authorization': `Bearer ${CREDENTIALS_CONFIG.SUPABASE_API_KEY}`
    }
  });
  const data = await res.json();
  console.log(data);
}
get();
