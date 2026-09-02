import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPropertyById } from '../utils/supabase'
import { useSavedProperties } from '../hooks/useSavedProperties'

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
  const { savedIds, toggleSaved, error: savedError, refetch: refetchSaved } = useSavedProperties()
  const [property, setProperty] = useState<PropertyDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState(0)

  useEffect(() => {
    let mounted = true

    const fetchProperty = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await getPropertyById(propertyId)
        if (!mounted) return

        if (result.error) {
          setError(result.error)
        } else if (result.data) {
          const data = result.data as PropertyDetailData
          // Enforce business rules:
          // Application fee always $50, pet friendly always true, security deposit 1x monthly rent
          data.application_fee = 50
          data.pet_friendly = true
          data.security_deposit = data.rent_monthly
          setProperty(data)
          setSelectedPhoto(0)
        } else {
          setError('Property not found')
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch property')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    if (propertyId) {
      fetchProperty()
    }

    return () => {
      mounted = false
    }
  }, [propertyId])

  if (loading) {
    return (
      <div id="property-loading-container" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-6">
          <div className="h-6 w-32 rounded-lg bg-slate-800" />
          <div className="h-10 w-2/3 rounded-xl bg-slate-800" />
          <div className="aspect-[16/9] max-h-[500px] w-full rounded-2xl bg-slate-900" />
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="h-40 rounded-2xl bg-slate-900" />
            <div className="h-40 rounded-2xl bg-slate-900" />
            <div className="h-40 rounded-2xl bg-slate-900" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !property) {
    return (
      <div id="property-error-container" className="mx-auto max-w-4xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-8 text-rose-200">
          <h2 className="text-xl font-bold">Property Not Available</h2>
          <p className="mt-2 text-sm text-rose-300/80">{error || 'This listing could not be found or has been leased.'}</p>
          <div className="mt-6 flex justify-center gap-4">
            <Link
              id="back-to-listings-btn"
              to="/listings"
              className="inline-flex items-center justify-center rounded-xl bg-slate-850 border border-slate-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition min-h-[44px]"
            >
              ← Back to All Listings
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const applyUrl = `/apply/?id=${encodeURIComponent(property.id)}&pn=${encodeURIComponent(property.title || property.address)}&addr=${encodeURIComponent(property.address)}&city=${encodeURIComponent(property.city)}&state=${encodeURIComponent(property.state)}&zip=${encodeURIComponent(property.zip)}&rent=${encodeURIComponent(String(property.rent_monthly))}&beds=${encodeURIComponent(String(property.beds ?? ''))}&baths=${encodeURIComponent(String(property.baths ?? ''))}&deposit=${encodeURIComponent(String(property.rent_monthly))}&fee=50&source=${encodeURIComponent(`/property?id=${property.id}`)}`

  return (
    <div id="property-detail-view" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          id="breadcrumb-back-link"
          to="/listings"
          className="inline-flex items-center gap-2 text-sm font-medium text-cyan-400 hover:text-cyan-300 transition"
        >
          <span aria-hidden="true">←</span> Back to Available Homes
        </Link>
        <span className="text-xs text-slate-400">Listing ID: {property.id.slice(0, 8)}</span>
      </div>

        {savedError && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" role="alert">
            <span>Saved homes could not be synchronized. Your local saves are still shown.</span>
            <button type="button" onClick={() => void refetchSaved()} className="font-semibold text-amber-300 underline hover:text-amber-100">
              Retry
            </button>
          </div>
        )}

      {/* Title & Header Section */}
      <div id="property-header-card" className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-950 border border-emerald-700/60 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
              ● {property.status}
            </span>
            <span className="rounded-full bg-cyan-950 border border-cyan-700/60 px-2.5 py-0.5 text-xs font-semibold text-cyan-300">
              🐾 Pet Friendly
            </span>
            <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300">
              {property.city}, {property.state}
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            {property.title || property.address}
          </h1>

          <p className="text-sm sm:text-base text-slate-300 flex items-center gap-1.5">
            <svg className="h-4 w-4 text-cyan-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {property.address}, {property.city}, {property.state} {property.zip}
          </p>
        </div>

        {/* Rent Highlight Box */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 sm:p-5 text-left md:text-right shrink-0">
          <span className="block text-xs uppercase font-medium text-slate-400">Monthly Rent</span>
          <div className="flex items-baseline md:justify-end gap-1">
            <span className="text-3xl font-extrabold text-white">${property.rent_monthly.toLocaleString()}</span>
            <span className="text-sm text-slate-400">/mo</span>
          </div>
          <p className="text-[11px] text-emerald-400 mt-0.5">1x Rent Deposit • $50 App Fee</p>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left 2 Cols: Photos, Specs, Description, Amenities */}
        <div className="lg:col-span-2 space-y-8">
          {/* Gallery Section */}
          <div id="property-gallery-container" className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 sm:p-6 shadow-xl relative">
            <button onClick={() => toggleSaved(property.id)} className={`absolute top-8 right-8 p-3 rounded-full backdrop-blur-md border ${savedIds.has(property.id) ? 'bg-rose-500/20 border-rose-500/50 text-rose-500' : 'bg-slate-900/50 border-white/20 text-white'} hover:scale-110 transition z-10`}><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill={savedIds.has(property.id) ? "currentColor" : "none"} stroke="currentColor"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg></button>
            {property.photos.length > 0 ? (
              <div className="space-y-4">
                {/* Main Active Photo */}
                <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-slate-950">
                  <img
                    id="hero-gallery-image"
                    src={window.CONFIG?.img ? window.CONFIG.img(property.photos[selectedPhoto]?.url, 'gallery') : property.photos[selectedPhoto]?.url}
                    alt={`${property.title} photo ${selectedPhoto + 1}`}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute bottom-3 right-3 rounded-lg bg-slate-950/80 backdrop-blur-sm border border-slate-700/80 px-3 py-1 text-xs font-medium text-slate-200">
                    Photo {selectedPhoto + 1} of {property.photos.length}
                  </div>
                </div>

                {/* Thumbnails row */}
                {property.photos.length > 1 && (
                  <div id="photo-thumbnails-strip" className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                    {property.photos.map((photo, index) => (
                      <button
                        key={`${photo.url}-${index}`}
                        id={`thumbnail-btn-${index}`}
                        type="button"
                        onClick={() => setSelectedPhoto(index)}
                        aria-label={`View photo ${index + 1}`}
                        className={`overflow-hidden rounded-lg border-2 transition aspect-square bg-slate-950 ${
                          selectedPhoto === index
                            ? 'border-cyan-400 ring-2 ring-cyan-400/20'
                            : 'border-slate-800 opacity-70 hover:opacity-100 hover:border-slate-600'
                        }`}
                      >
                        <img src={window.CONFIG?.img ? window.CONFIG.img(photo.url, 'thumb') : photo.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-xl bg-slate-950 text-slate-500">
                <p className="text-sm">No photos currently uploaded for this property.</p>
              </div>
            )}
          </div>

          {/* Key Specs Row */}
          <div id="property-specs-grid" className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-center">
              <span className="block text-xs uppercase tracking-wider text-slate-400">Bedrooms</span>
              <span className="mt-1 block text-2xl font-bold text-white">{property.beds ?? '—'}</span>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-center">
              <span className="block text-xs uppercase tracking-wider text-slate-400">Bathrooms</span>
              <span className="mt-1 block text-2xl font-bold text-white">{property.baths ?? '—'}</span>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-center">
              <span className="block text-xs uppercase tracking-wider text-slate-400">Square Feet</span>
              <span className="mt-1 block text-2xl font-bold text-white">
                {property.sqft == null ? '—' : property.sqft.toLocaleString()}
              </span>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-center">
              <span className="block text-xs uppercase tracking-wider text-slate-400">Pet Policy</span>
              <span className="mt-1 block text-lg font-bold text-emerald-400">Pets Welcome</span>
            </div>
          </div>

          {/* Description */}
          {property.description && (
            <div id="property-description-card" className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8 space-y-4">
              <h2 className="text-xl font-bold text-white">About This Rental</h2>
              <div className="text-slate-300 leading-relaxed whitespace-pre-line text-sm sm:text-base space-y-3">
                {property.description}
              </div>
            </div>
          )}

          {/* Verified Lease Terms */}
          <div id="property-terms-card" className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8 space-y-5">
            <h2 className="text-xl font-bold text-white">Transparent Lease Terms</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800/80 bg-slate-950 p-4 space-y-1">
                <span className="text-xs text-slate-400">Monthly Rent</span>
                <p className="text-xl font-bold text-white">${property.rent_monthly.toLocaleString()}</p>
                <p className="text-[11px] text-slate-500">Due on the 1st of each month</p>
              </div>

              <div className="rounded-xl border border-slate-800/80 bg-slate-950 p-4 space-y-1">
                <span className="text-xs text-slate-400">Security Deposit</span>
                <p className="text-xl font-bold text-white">${property.rent_monthly.toLocaleString()}</p>
                <p className="text-[11px] text-emerald-400">Guaranteed 1x monthly rent</p>
              </div>

              <div className="rounded-xl border border-slate-800/80 bg-slate-950 p-4 space-y-1">
                <span className="text-xs text-slate-400">Application Fee</span>
                <p className="text-xl font-bold text-white">$50</p>
                <p className="text-[11px] text-slate-500">Per adult applicant (covers background & screening)</p>
              </div>

              <div className="rounded-xl border border-slate-800/80 bg-slate-950 p-4 space-y-1">
                <span className="text-xs text-slate-400">Pet Policy</span>
                <p className="text-xl font-bold text-emerald-400">100% Pet Friendly</p>
                <p className="text-[11px] text-slate-500">Dogs and cats welcome</p>
              </div>
            </div>
          </div>

          {/* Amenities & Features (Strictly no smoking policy per guidelines) */}
          <div id="property-amenities-card" className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8 space-y-4">
            <h2 className="text-xl font-bold text-white">Features & Highlights</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-300">
              <div className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400 text-xs">✓</span>
                Pet Friendly (All Breeds Subject to Prior Notice)
              </div>
              <div className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-400 text-xs">✓</span>
                Central Air Conditioning & Heating
              </div>
              <div className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-400 text-xs">✓</span>
                In-Unit or Hookup Laundry Connections
              </div>
              <div className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-400 text-xs">✓</span>
                Off-Street Parking / Garage Included
              </div>
              <div className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-400 text-xs">✓</span>
                Standard 12-Month Lease Agreement
              </div>
              <div className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-400 text-xs">✓</span>
                Digital Maintenance Requests & Online Pay
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Apply CTA & Help */}
        <aside className="space-y-6">
          {/* Apply CTA Card */}
          <div id="property-apply-cta-card" className="sticky top-24 rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-slate-900 to-slate-950 p-6 shadow-2xl shadow-cyan-950/30 space-y-5">
            <div className="space-y-1">
              <span className="text-xs uppercase font-bold tracking-wider text-cyan-400">Ready to make this home?</span>
              <h3 className="text-xl font-bold text-white">Apply in 10 Minutes</h3>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              Submit your verified online application now. Our leasing team reviews completed applications in 24 to 48 hours.
            </p>

            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 space-y-2 text-xs text-slate-300">
              <div className="flex justify-between">
                <span>Monthly Rent</span>
                <span className="font-semibold text-white">${property.rent_monthly.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Security Deposit</span>
                <span className="font-semibold text-white">${property.rent_monthly.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-slate-850 pt-1.5">
                <span>Application Fee</span>
                <span className="font-semibold text-cyan-400">$50.00</span>
              </div>
            </div>

            <a
              id="apply-now-btn"
              href={applyUrl}
              className="flex w-full min-h-[48px] items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 via-teal-400 to-blue-600 px-6 py-3.5 text-center text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-cyan-900/40 transition hover:brightness-110"
            >
              Start Online Application →
            </a>

            <p className="text-center text-[11px] text-slate-400">
              🔒 SSL Encrypted • Fast 24-48h Landlord Review
            </p>

            {/* Assistance Box */}
            <div className="border-t border-slate-800 pt-4 space-y-2">
              <h4 className="text-xs font-semibold uppercase text-slate-300">Have Questions About This Property?</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Our leasing coordinator is available to answer any questions regarding move-in dates or requirements.
              </p>
              <div className="text-xs text-slate-300 space-y-1 pt-1">
                <p>Call: <a href="tel:7077063137" className="text-cyan-400 hover:underline">707-706-3137</a></p>
                <p>Email: <a href="mailto:support@choiceproperties.com" className="text-cyan-400 hover:underline">support@choiceproperties.com</a></p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
