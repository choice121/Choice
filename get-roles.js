import { CREDENTIALS_CONFIG } from "./credentials-config.mjs";
async function check() {
  const res = await fetch(`${CREDENTIALS_CONFIG.SUPABASE_URL}/rest/v1/auth.users?select=*`, {
    headers: {
      'apikey': CREDENTIALS_CONFIG.SUPABASE_API_KEY,
      'Authorization': `Bearer ${CREDENTIALS_CONFIG.SUPABASE_API_KEY}`
    }
  });
  console.log(res.status);
}
check();
