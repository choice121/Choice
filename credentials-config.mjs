/**
 * Server-side credentials configuration.
 *
 * Only the public project URL is safe to commit. Secret values must be
 * supplied by the local shell or CI environment and are never bundled into
 * the public site.
 */
const env = typeof process !== 'undefined' ? process.env : {};

export const CREDENTIALS_CONFIG = {
  SUPABASE_URL: "https://tlfmwetmhthpyrytrcfo.supabase.co",
  SUPABASE_API_KEY: env.SUPABASE_SERVICE_ROLE_KEY || "",
  WRITE_SECRET: env.CREDENTIALS_WRITE_SECRET || "",
  STORE_CREDENTIALS_FUNCTION: "store-credentials",
};