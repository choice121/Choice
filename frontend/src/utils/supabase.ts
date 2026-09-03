/**
 * Typed adapter for the public data contracts established by js/cp-api.js.
 * The legacy CP namespace remains the source of truth; the direct Supabase
 * queries below are only a bootstrap fallback for pages that load without it.
 */

export type PropertyFilters = {
  q?: string
  type?: string
  property_type?: string
  city?: string
  state?: string
  beds?: number | string
  min_beds?: number | string
  min_baths?: number | string
  pets_allowed?: boolean
  has_ac?: boolean
  min_rent?: number | string
  max_rent?: number | string
  sort?: string
  page?: number
  per_page?: number
}

export type PropertyPhoto = {
  id?: string
  file_id?: string | null
  url: string
  display_order: number
  is_hero: boolean
}

export type PropertyLandlord = {
  id?: string
  user_id?: string
  contact_name?: string
  business_name?: string
  avatar_url?: string
  verified?: boolean
  tagline?: string
}

export type PropertyData = {
  id: string
  title: string
  address: string
  city: string
  state: string
  zip: string
  rent_monthly: number
  beds: number | null
  baths: number | null
  sqft: number | null
  description?: string
  property_type?: string | null
  parking?: string | null
  pets_allowed?: boolean | null
  available_date?: string | null
  utilities_included?: string | null
  lat?: number | null
  lng?: number | null
  status: string
  pet_friendly: boolean
  application_fee: number
  security_deposit: number
  photo_url: string | null
  photos: PropertyPhoto[]
  photo_urls: string[]
  photo_file_ids: Array<string | null>
  landlord?: PropertyLandlord | null
  amenities?: string[]
  appliances?: string[]
  heating_type?: string | null
  cooling_type?: string | null
  laundry_type?: string | null
  flooring?: string | null
  year_built?: number | null
  last_months_rent?: number | null
  admin_fee?: number | null
  move_in_special?: string | null
  minimum_income_multiplier?: number | null
  minimum_credit_score?: number | null
  neighborhood?: string | null
  parking_spaces?: number | null
  lot_size_sqft?: number | null
  smoking_allowed?: boolean | null
  has_basement?: boolean | null
  has_central_air?: boolean | null
  pet_deposit?: number | null
  pet_types_allowed?: string | null
  pet_weight_limit?: number | null
  pet_details?: string | null
}

export type PropertyQueryResult = {
  rows: PropertyData[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

type LegacyPropertyRow = Record<string, any>

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

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizePhotos(row: LegacyPropertyRow): PropertyPhoto[] {
  if (Array.isArray(row.property_photos)) {
    return row.property_photos
      .filter((photo: LegacyPropertyRow) => photo?.url)
      .sort((a: LegacyPropertyRow, b: LegacyPropertyRow) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .map((photo: LegacyPropertyRow) => ({
        id: photo.id ? String(photo.id) : undefined,
        file_id: photo.file_id ? String(photo.file_id) : null,
        url: String(photo.url),
        display_order: numberOrNull(photo.display_order) ?? 0,
        is_hero: Boolean(photo.is_hero),
      }))
  }

  return (Array.isArray(row.photo_urls) ? row.photo_urls : [])
    .filter(Boolean)
    .map((url: unknown, index: number) => ({
      url: String(url),
      display_order: index,
      is_hero: index === 0,
    }))
}

export function normalizeProperty(row: LegacyPropertyRow): PropertyData {
  const rent = numberOrNull(row.monthly_rent ?? row.rent_monthly) ?? 0
  const photos = normalizePhotos(row)

  return {
    id: String(row.id),
    title: String(row.title || ''),
    address: String(row.address || ''),
    city: String(row.city || ''),
    state: String(row.state || ''),
    zip: String(row.zip || ''),
    rent_monthly: rent,
    beds: numberOrNull(row.bedrooms ?? row.beds),
    baths: numberOrNull(row.bathrooms ?? row.baths),
    sqft: numberOrNull(row.square_footage ?? row.sqft),
    description: String(row.description || ''),
    property_type: row.property_type ?? null,
    parking: row.parking ?? null,
    pets_allowed: row.pets_allowed ?? null,
    available_date: row.available_date ?? null,
    utilities_included: row.utilities_included ?? null,
    lat: numberOrNull(row.lat),
    lng: numberOrNull(row.lng),
    status: String(row.status || 'active'),
    pet_friendly: true,
    application_fee: 50,
    security_deposit: rent,
    photo_url: photos[0]?.url || null,
    photos,
    photo_urls: photos.map((photo) => photo.url),
    photo_file_ids: photos.map((photo) => photo.file_id ?? null),
    landlord: row.landlords || row.landlord || null,
    amenities: Array.isArray(row.amenities) ? row.amenities : [],
    appliances: Array.isArray(row.appliances) ? row.appliances : [],
    heating_type: row.heating_type ?? null,
    cooling_type: row.cooling_type ?? null,
    laundry_type: row.laundry_type ?? null,
    flooring: row.flooring ?? null,
    year_built: numberOrNull(row.year_built),
    last_months_rent: numberOrNull(row.last_months_rent),
    admin_fee: numberOrNull(row.admin_fee),
    move_in_special: row.move_in_special ?? null,
    minimum_income_multiplier: numberOrNull(row.minimum_income_multiplier),
    minimum_credit_score: numberOrNull(row.minimum_credit_score),
    neighborhood: row.neighborhood ?? null,
    parking_spaces: numberOrNull(row.parking_spaces),
    lot_size_sqft: numberOrNull(row.lot_size_sqft),
    smoking_allowed: row.smoking_allowed ?? null,
    has_basement: row.has_basement ?? null,
    has_central_air: row.has_central_air ?? null,
    pet_deposit: numberOrNull(row.pet_deposit),
    pet_types_allowed: row.pet_types_allowed ?? null,
    pet_weight_limit: numberOrNull(row.pet_weight_limit),
    pet_details: row.pet_details ?? null,
  }
}

function normalizeQueryResult(payload: LegacyPropertyRow, filters: PropertyFilters): PropertyQueryResult {
  const rows = Array.isArray(payload?.rows) ? payload.rows : []
  const perPage = Number(payload?.per_page ?? filters.per_page ?? 24) || 24
  const page = Number(payload?.page ?? filters.page ?? 1) || 1
  const total = Number(payload?.total ?? rows.length) || 0

  return {
    rows: rows.map(normalizeProperty),
    total,
    page,
    per_page: perPage,
    total_pages: Number(payload?.total_pages ?? Math.ceil(total / perPage)) || 0,
  }
}

/**
 * Fetch public listings through the established CP.Properties contract.
 * Accepting a number preserves the original hook's limit-only call shape.
 */
export async function getProperties(filtersOrLimit: PropertyFilters | number = {}) {
  const filters: PropertyFilters = typeof filtersOrLimit === 'number'
    ? { per_page: filtersOrLimit }
    : filtersOrLimit

  try {
    const legacyProperties = window.CP?.Properties
    if (legacyProperties?.getListings) {
      const result = await legacyProperties.getListings({
        ...filters,
        page: Math.max(1, filters.page ?? 1),
        per_page: filters.per_page ?? 24,
      })
      if (!result?.ok) {
        return { ok: false, data: null, error: result?.error || 'Failed to fetch properties' }
      }
      return { ok: true, data: normalizeQueryResult(result.data, filters), error: null }
    }

    const client = getSupabaseClient()
    const perPage = filters.per_page ?? 24
    const page = Math.max(1, filters.page ?? 1)
    let query = client
      .from('properties')
      .select('*, landlords(contact_name, business_name, avatar_url, verified), property_photos(url, file_id, display_order, is_hero)', { count: 'exact' })
      .eq('status', 'active')
      .order('listed_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (filters.q?.trim()) query = query.ilike('title', `%${filters.q.trim()}%`)
    if (filters.city) query = query.ilike('city', filters.city)
    if (filters.state) query = query.eq('state', filters.state)
    if (filters.beds !== undefined && filters.beds !== '') {
      const beds = Number(filters.beds)
      query = beds >= 4 ? query.gte('bedrooms', 4) : query.eq('bedrooms', beds)
    }
    if (filters.min_rent !== undefined && filters.min_rent !== '') query = query.gte('monthly_rent', Number(filters.min_rent))
    if (filters.max_rent !== undefined && filters.max_rent !== '') query = query.lte('monthly_rent', Number(filters.max_rent))

    if (filters.min_baths !== undefined && filters.min_baths !== '') {
      query = query.gte('bathrooms', Number(filters.min_baths))
    }
    if (filters.pets_allowed) {
      query = query.eq('pets_allowed', true)
    }
    if (filters.has_ac) {
      query = query.or('has_central_air.eq.true,cooling_type.ilike.%air%')
    }
    if (filters.property_type && filters.property_type !== 'All') {
      const type = filters.property_type
      let validTypes: string[] = []
      if (type === 'House') {
        validTypes = ['House', 'house', 'SINGLE_FAMILY', 'single_family', 'Single Family']
      } else if (type === 'Apartment') {
        validTypes = ['APARTMENT', 'Apartment', 'apartment']
      } else if (type === 'Townhouse') {
        validTypes = ['TOWNHOMES', 'Townhouse', 'townhouse', 'DUPLEX', 'Duplex', 'duplex']
      }
      if (validTypes.length > 0) {
        query = query.in('property_type', validTypes)
      }
    }

    const from = (page - 1) * perPage
    const { data, error, count } = await query.range(from, from + perPage - 1)
    if (error) return { ok: false, data: null, error: error.message }

    const total = count ?? 0
    return {
      ok: true,
      data: {
        rows: (data || []).map(normalizeProperty),
        total,
        page,
        per_page: perPage,
        total_pages: Math.ceil(total / perPage),
      },
      error: null,
    }
  } catch (e) {
    return { ok: false, data: null, error: String(e) }
  }
}

/**
 * Fetch a single property by ID through the established CP.Properties contract.
 */
export async function getPropertyById(id: string) {
  try {
    const legacyProperties = window.CP?.Properties
    if (legacyProperties?.getOne) {
      const result = await legacyProperties.getOne(id)
      if (!result?.ok) return { ok: false, data: null, error: result?.error || 'Failed to fetch property' }
      return { ok: true, data: result.data ? normalizeProperty(result.data) : null, error: null }
    }

    const client = getSupabaseClient()
    const { data, error } = await client
      .from('properties')
      .select('*, landlords(id, user_id, contact_name, business_name, avatar_url, verified, tagline), property_photos(url, display_order, is_hero)')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      return { ok: false, data: null, error: error.message }
    }

    return { ok: true, data: data ? normalizeProperty(data) : null, error: null }
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
      Auth?: {
        getUser(): Promise<{ id: string; email?: string } | null>
        getSession(): Promise<any>
      }
      Properties?: {
        getListings(filters?: PropertyFilters): Promise<any>
        getOne(id: string): Promise<any>
      }
    }
    CONFIG: {
      SUPABASE_URL: string
      SUPABASE_ANON_KEY: string
      img?: (url: string, preset?: string) => string
      srcset?: (url: string, preset1x: string, preset2x: string) => string
    }
  }
}
