const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

export const CREDENTIALS_CONFIG = {
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://tlfmwetmhthpyrytrcfo.supabase.co',
  SUPABASE_API_KEY: serviceRoleKey,
};
