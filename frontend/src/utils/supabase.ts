/**
 * Supabase integration bridge for React components.
 * Accesses window.supabase (loaded via parent HTML) and CONFIG.
 * This module does NOT duplicate Supabase initialization—it reuses the existing
 * global client to preserve session, auth state, and storage contracts.
 */

let _fallbackClient: any = null

export function getSupabaseClient() {
  if (typeof window === 'undefined') {
    throw new Error('Supabase client only available in browser')
  }

  // Reuse the lazy singleton initialized by cp-api.js if available
  if (window.CP?.sb) {
    return window.CP.sb()
  }

  if (_fallbackClient) {
    return _fallbackClient
  }

  if (typeof window.CONFIG !== 'undefined' && window.CONFIG?.SUPABASE_URL && window.supabase) {
    _fallbackClient = window.supabase.createClient(window.CONFIG.SUPABASE_URL, window.CONFIG.SUPABASE_ANON_KEY)
    return _fallbackClient
  }

  throw new Error('Supabase client not initialized. Ensure config.js and supabase.min.js are loaded.')
}

/**
 * Type-safe wrapper around window.supabase to access properties table.
 */
export async function getProperties(limit = 40) {
  try {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from('properties')
      .select('id, title, address, city, state, zip, monthly_rent, bedrooms, bathrooms, square_footage, status, pets_allowed, application_fee, security_deposit, property_photos(url, display_order, is_hero)')
      .eq('status', 'active')
      .order('listed_at', { ascending: false })
      .limit(limit)

    if (error) {
      return { ok: false, data: null, error: error.message }
    }

    const properties = (data || []).map((property: any) => {
      const rent = Number(property.monthly_rent) || 0
      return {
        id: property.id,
        title: property.title,
        address: property.address,
        city: property.city,
        state: property.state || '',
        zip: property.zip || '',
        rent_monthly: rent,
        beds: property.bedrooms == null ? null : Number(property.bedrooms),
        baths: property.bathrooms == null ? null : Number(property.bathrooms),
        sqft: property.square_footage == null ? null : Number(property.square_footage),
        status: property.status || 'active',
        pet_friendly: true, // Always pet-friendly per Choice Properties rules
        application_fee: 50, // Always $50 per Choice Properties rules
        security_deposit: rent, // Always 1x monthly rent
        photo_url: Array.isArray(property.property_photos)
          ? property.property_photos
              .filter((photo: any) => photo?.url)
              .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))[0]?.url || null
          : null,
      }
    })

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

    const rent = Number(data.monthly_rent) || 0

    return {
      ok: true,
      data: {
        id: data.id,
        title: data.title,
        address: data.address,
        city: data.city,
        state: data.state || '',
        zip: data.zip || '',
        rent_monthly: rent,
        beds: data.bedrooms == null ? null : Number(data.bedrooms),
        baths: data.bathrooms == null ? null : Number(data.bathrooms),
        sqft: data.square_footage == null ? null : Number(data.square_footage),
        description: data.description || '',
        status: data.status || 'active',
        pet_friendly: true, // Always pet-friendly per rules
        application_fee: 50, // Always $50 per rules
        security_deposit: rent, // Always 1x monthly rent
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
    CP?: {
      sb: () => any
    }
    CONFIG: {
      SUPABASE_URL: string
      SUPABASE_ANON_KEY: string
    }
  }
}
