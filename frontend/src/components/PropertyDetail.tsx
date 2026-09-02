import { useEffect, useState } from 'react'
import { getPropertyById } from '../utils/supabase'

export interface PropertyDetailData {
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
  description: string
  status: string
  pet_friendly: boolean
  application_fee: number
  security_deposit: number
  photos: Array<{
    url: string
    display_order: number
    is_hero: boolean
  }>
}

interface PropertyDetailProps {
  propertyId: string
}

export function PropertyDetail({ propertyId }: PropertyDetailProps) {
  const [property, setProperty] = useState<PropertyDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState(0)

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        const result = await getPropertyById(propertyId)
        if (result.error) {
          setError(result.error)
        } else if (result.data) {
          setProperty(result.data as PropertyDetailData)
          setSelectedPhoto(0)
        } else {
          setError('Property not found')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch property')
      } finally {
        setLoading(false)
      }
    }

    if (propertyId) {
      fetchProperty()
    }
  }, [propertyId])

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-64 rounded-2xl border border-slate-800 bg-slate-900" />
          <div className="h-8 w-3/4 rounded-xl bg-slate-800" />
          <div className="h-4 w-1/2 rounded-xl bg-slate-800" />
        </div>
      </div>
    )
  }

  if (error || !property) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
          <p className="text-sm font-semibold">Error loading property</p>
          <p className="mt-2">{error || 'Property not found'}</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 rounded-[28px] border border-slate-800 bg-slate-900/75 p-6 shadow-lg">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
            Property detail • modern redesign
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {property.title}
          </h1>
          <p className="mt-2 text-slate-300">{property.address}</p>
        </div>

        {/* Main content */}
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Property gallery */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
              {property.photos.length > 0 ? (
                <>
                  <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
                    <img
                      src={property.photos[selectedPhoto]?.url}
                      alt={`${property.title} photo ${selectedPhoto + 1}`}
                      className="aspect-video w-full object-cover"
                    />
                  </div>
                  {property.photos.length > 1 && (
                    <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
                      {property.photos.map((photo, index) => (
                        <button
                          key={`${photo.url}-${index}`}
                          type="button"
                          onClick={() => setSelectedPhoto(index)}
                          aria-label={`View photo ${index + 1}`}
                          aria-pressed={selectedPhoto === index}
                          className={`overflow-hidden rounded-lg border-2 transition ${
                            selectedPhoto === index ? 'border-cyan-400' : 'border-slate-800 hover:border-slate-600'
                          }`}
                        >
                          <img src={photo.url} alt="" className="aspect-square w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex aspect-video items-center justify-center rounded-xl border border-slate-800 bg-slate-950">
                  <div className="text-center">
                    <p className="text-slate-400">Photos coming soon</p>
                    <p className="mt-2 text-sm text-slate-500">Contact us for more details about this home.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            {property.description && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <h2 className="text-xl font-semibold text-white">About this property</h2>
                <p className="mt-4 text-slate-300 leading-relaxed">{property.description}</p>
              </div>
            )}

            {/* Key details */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-semibold text-white">Property specs</h2>
              <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-center">
                  <p className="text-sm text-slate-400">Bedrooms</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{property.beds ?? '—'}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-center">
                  <p className="text-sm text-slate-400">Bathrooms</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{property.baths ?? '—'}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-center">
                  <p className="text-sm text-slate-400">Square feet</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {property.sqft == null ? '—' : property.sqft.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-center">
                  <p className="text-sm text-slate-400">Status</p>
                  <p className="mt-2 text-xl font-semibold text-emerald-300">{property.status}</p>
                </div>
              </div>
            </div>

            {/* Rental terms */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-semibold text-white">Rental terms</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-sm text-slate-400">Monthly rent</p>
                  <p className="mt-2 text-3xl font-semibold text-white">${property.rent_monthly.toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-sm text-slate-400">Application fee</p>
                  <p className="mt-2 text-2xl font-semibold text-white">${property.application_fee}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-sm text-slate-400">Security deposit</p>
                  <p className="mt-2 text-2xl font-semibold text-white">${property.security_deposit.toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-sm text-slate-400">Pet friendly</p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-300">
                    {property.pet_friendly ? 'Yes' : 'No'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* CTA */}
            <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-6">
              <h3 className="text-lg font-semibold text-white">Ready to apply?</h3>
              <p className="mt-3 text-sm text-slate-300">
                Start your rental application now. The process takes about 10 minutes.
              </p>
              <a
                href={`/apply/?id=${encodeURIComponent(property.id)}&pn=${encodeURIComponent(property.title)}&addr=${encodeURIComponent(property.address)}&city=${encodeURIComponent(property.city)}&state=${encodeURIComponent(property.state)}&zip=${encodeURIComponent(property.zip)}&rent=${encodeURIComponent(String(property.rent_monthly))}&beds=${encodeURIComponent(String(property.beds ?? ''))}&baths=${encodeURIComponent(String(property.baths ?? ''))}&deposit=${encodeURIComponent(String(property.security_deposit))}&fee=${encodeURIComponent(String(property.application_fee))}&source=${encodeURIComponent(`/property?id=${property.id}`)}`}
                className="mt-5 block w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 text-center font-semibold text-white shadow-lg shadow-cyan-900/30 transition hover:brightness-110"
              >
                Start application
              </a>
            </div>

            {/* Location info */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h3 className="text-lg font-semibold text-white">Location</h3>
              <div className="mt-4 space-y-2 text-sm text-slate-300">
                <p>{property.address}</p>
                <p>
                  {property.city}, {property.state} {property.zip}
                </p>
              </div>
              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4 text-center text-sm text-slate-400">
                Map placeholder
              </div>
            </div>

            {/* Amenities */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h3 className="text-lg font-semibold text-white">Amenities</h3>
              <ul className="mt-4 space-y-2 text-sm text-slate-300">
                <li className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] text-emerald-300">
                    ✓
                  </span>
                  Pet friendly
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
