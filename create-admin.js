import { CREDENTIALS_CONFIG } from "./credentials-config.mjs";
async function create() {
  const email = "admin@choiceproperties.dev";
  const password = "ChoiceAdmin2026!";
  const res = await fetch(`${CREDENTIALS_CONFIG.SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': CREDENTIALS_CONFIG.SUPABASE_API_KEY,
      'Authorization': `Bearer ${CREDENTIALS_CONFIG.SUPABASE_API_KEY}`
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'admin' }
    })
  });
  const data = await res.json();
  console.log(data);
}
create();
