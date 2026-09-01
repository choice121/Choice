/**
 * Supabase integration bridge for React components.
 * Accesses window.supabase (loaded via parent HTML) and CONFIG.
 * This module does NOT duplicate Supabase initialization—it reuses the existing
 * global client to preserve session, auth state, and storage contracts.
 */

export function getSupabaseClient() {
  if (typeof window === 'undefined') {
    throw new Error('Supabase client only available in browser')
  }

  if (!window.supabase) {
    throw new Error('Supabase SDK not loaded. Ensure supabase.min.js is loaded in parent HTML.')
  }

  if (typeof window.CONFIG === 'undefined' || !window.CONFIG.SUPABASE_URL) {
    throw new Error('CONFIG not ready. Ensure config.js is loaded in parent HTML.')
  }

  // Return the existing global Supabase client (initialized in cp-api.js)
  return window.supabase
}

/**
 * Type-safe wrapper around window.supabase to access properties table.
 */
export async function getProperties(limit = 10) {
  try {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from('properties')
      .select('id, title, address, city, rent_monthly, beds, baths, sqft, status')
      .limit(limit)

    if (error) {
      return { ok: false, data: null, error: error.message }
    }

    return { ok: true, data: data || [], error: null }
  } catch (e) {
    return { ok: false, data: null, error: String(e) }
  }
}

/**
 * Fetch a single property by ID.
 */
export async function getPropertyById(id: string) {
  try {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from('properties')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      return { ok: false, data: null, error: error.message }
    }

    return { ok: true, data: data || null, error: null }
  } catch (e) {
    return { ok: false, data: null, error: String(e) }
  }
}

/**
 * Declare globals so TypeScript knows about window.supabase and window.CONFIG.
 * These are injected by the parent HTML via defer scripts.
 */
declare global {
  interface Window {
    supabase: any
    CONFIG: {
      SUPABASE_URL: string
      SUPABASE_ANON_KEY: string
    }
  }
}
