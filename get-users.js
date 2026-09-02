import { CREDENTIALS_CONFIG } from "./credentials-config.mjs";
async function check() {
  const res = await fetch(`${CREDENTIALS_CONFIG.SUPABASE_URL}/auth/v1/admin/users`, {
    headers: {
      'apikey': CREDENTIALS_CONFIG.SUPABASE_API_KEY,
      'Authorization': `Bearer ${CREDENTIALS_CONFIG.SUPABASE_API_KEY}`
    }
  });
  const data = await res.json();
  console.log(data.users.map(u => u.email));
}
check();
