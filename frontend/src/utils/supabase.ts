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
      .select('id, title, address, city, monthly_rent, bedrooms, bathrooms, square_footage, status')
      .eq('status', 'active')
      .order('listed_at', { ascending: false })
      .limit(limit)

    if (error) {
      return { ok: false, data: null, error: error.message }
    }

    const properties = (data || []).map((property: any) => ({
      id: property.id,
      title: property.title,
      address: property.address,
      city: property.city,
      rent_monthly: Number(property.monthly_rent) || 0,
      beds: property.bedrooms == null ? null : Number(property.bedrooms),
      baths: property.bathrooms == null ? null : Number(property.bathrooms),
      sqft: property.square_footage == null ? null : Number(property.square_footage),
      status: property.status || 'active',
    }))

    return { ok: true, data: properties, error: null }
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
      .select(
        'id, title, address, city, state, zip, monthly_rent, bedrooms, bathrooms, square_footage, description, status, pets_allowed, application_fee, security_deposit, property_photos(url, display_order, is_hero)'
      )
      .eq('id', id)
      .maybeSingle()

    if (error) {
      return { ok: false, data: null, error: error.message }
    }

    if (!data) return { ok: true, data: null, error: null }

    const photos = Array.isArray(data.property_photos)
      ? data.property_photos
          .filter((photo: any) => photo?.url)
          .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
          .map((photo: any) => ({
            url: photo.url,
            display_order: photo.display_order ?? 0,
            is_hero: Boolean(photo.is_hero),
          }))
      : []

    return {
      ok: true,
      data: {
        id: data.id,
        title: data.title,
        address: data.address,
        city: data.city,
        state: data.state,
        zip: data.zip,
        rent_monthly: Number(data.monthly_rent) || 0,
        beds: data.bedrooms == null ? null : Number(data.bedrooms),
        baths: data.bathrooms == null ? null : Number(data.bathrooms),
        sqft: data.square_footage == null ? null : Number(data.square_footage),
        description: data.description || '',
        status: data.status || 'active',
        pet_friendly: Boolean(data.pets_allowed),
        application_fee: Number(data.application_fee) || 0,
        security_deposit: Number(data.security_deposit) || 0,
        photos,
      },
      error: null,
    }
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
