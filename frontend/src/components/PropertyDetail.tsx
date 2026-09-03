import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPropertyById, type PropertyData } from '../utils/supabase'
import { useProperties } from '../hooks/useProperties'
import { useSavedProperties } from '../hooks/useSavedProperties'
import { InquiryForm } from './InquiryForm'
import { PropertyMap } from './PropertyMap'
import { Lightbox } from './Lightbox'
import { MobileApplyBar } from './MobileApplyBar'

interface PropertyDetailProps {
  propertyId: string
}

function SimilarProperties({ currentId, city, currentRent }: { currentId: string, city: string, currentRent: number }) {
  const { properties, loading } = useProperties({ city, per_page: 8 })
  
  if (loading) return null
  
  // Filter out the current property and sort by closest rent
  const similar = properties
    .filter(p => p.id !== currentId)
    .sort((a, b) => Math.abs((a.rent_monthly || 0) - currentRent) - Math.abs((b.rent_monthly || 0) - currentRent))
    .slice(0, 4)

  if (similar.length === 0) return null

  return (
    <div className="mt-12 pt-12 border-t border-slate-800/80">
      <div className="mb-6 space-y-1">
        <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Also Available</span>
        <h2 className="text-2xl font-bold text-white">More in <em className="not-italic text-slate-300">{city}</em></h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {similar.map(p => (
          <Link key={p.id} to={`/property?id=${p.id}`} className="group flex flex-col rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden hover:border-cyan-500 transition-colors">
            <div className="aspect-[4/3] bg-slate-950 overflow-hidden relative">
              <img 
                src={p.photo_url ? (window.CONFIG?.img ? window.CONFIG.img(p.photo_url, 'card') : p.photo_url) : '/assets/placeholder-property.jpg'} 
                alt={p.title || 'Property'} 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            </div>
            <div className="p-4 flex flex-col flex-1">
              <div className="text-lg font-bold text-white flex items-baseline gap-1">
                ${p.rent_monthly.toLocaleString()} <span className="text-xs font-medium text-slate-400">/mo</span>
              </div>
              <h3 className="text-sm font-semibold text-slate-200 mt-1 truncate">{p.title || 'Rental'}</h3>
              <p className="text-xs text-slate-400 mt-1">
                {[p.beds != null ? `${p.beds} bed` : '', p.baths != null ? `${p.baths} bath` : ''].filter(Boolean).join(' · ')}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">{p.address}, {p.city}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export function PropertyDetail({ propertyId }: PropertyDetailProps) {
  const { savedIds, toggleSaved, error: savedError, refetch: refetchSaved } = useSavedProperties()
  const [property, setProperty] = useState<PropertyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState(0)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)

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
          const data = result.data as PropertyData
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

  const applyUrl = `/apply?id=${encodeURIComponent(property.id)}&pn=${encodeURIComponent(property.title || property.address)}&addr=${encodeURIComponent(property.address)}&city=${encodeURIComponent(property.city)}&state=${encodeURIComponent(property.state)}&zip=${encodeURIComponent(property.zip)}&rent=${encodeURIComponent(String(property.rent_monthly))}&beds=${encodeURIComponent(String(property.beds ?? ''))}&baths=${encodeURIComponent(String(property.baths ?? ''))}&deposit=${encodeURIComponent(String(property.rent_monthly))}&fee=50&source=${encodeURIComponent(`/property?id=${property.id}`)}`

  return (
    <div id="property-detail-view" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 mb-24 md:mb-0">
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
            <div className="absolute top-8 right-8 flex gap-2 z-10">
              <button 
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: property.title || property.address, url: window.location.href })
                  } else {
                    navigator.clipboard.writeText(window.location.href)
                    alert('Link copied to clipboard!')
                  }
                }} 
                className="p-3 rounded-full backdrop-blur-md border bg-slate-900/50 border-white/20 text-white hover:scale-110 transition"
                aria-label="Share property"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>
              <button onClick={() => toggleSaved(property.id)} className={`p-3 rounded-full backdrop-blur-md border ${savedIds.has(property.id) ? 'bg-rose-500/20 border-rose-500/50 text-rose-500' : 'bg-slate-900/50 border-white/20 text-white'} hover:scale-110 transition`} aria-label="Save property">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill={savedIds.has(property.id) ? "currentColor" : "none"} stroke="currentColor">
                  <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            {property.photos.length > 0 ? (
              <div className="space-y-4">
                {/* Main Active Photo */}
                <button 
                  type="button" 
                  onClick={() => setIsLightboxOpen(true)}
                  className="relative aspect-[16/10] overflow-hidden rounded-xl bg-slate-950 w-full hover:opacity-95 transition"
                  aria-label="View fullscreen gallery"
                >
                  <img
                    id="hero-gallery-image"
                    src={window.CONFIG?.img ? window.CONFIG.img(property.photos[selectedPhoto]?.url, 'gallery') : property.photos[selectedPhoto]?.url}
                    alt={`${property.title} photo ${selectedPhoto + 1}`}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute bottom-3 right-3 rounded-lg bg-slate-950/80 backdrop-blur-sm border border-slate-700/80 px-3 py-1 text-xs font-medium text-slate-200">
                    Photo {selectedPhoto + 1} of {property.photos.length}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-colors">
                    <svg className="h-10 w-10 text-white opacity-0 hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  </div>
                </button>

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

          {/* Map Section */}
          <PropertyMap lat={property.lat} lng={property.lng} address={property.address} title={property.title} monthly_rent={property.rent_monthly} />

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

          {/* Property Facts & Requirements */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Property Facts */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8 space-y-4">
              <h2 className="text-xl font-bold text-white">Property Facts</h2>
              <ul className="space-y-3 text-sm text-slate-300">
                {property.property_type && (
                  <li className="flex justify-between border-b border-slate-800/60 pb-2">
                    <span className="text-slate-400">Type</span>
                    <span className="font-medium text-white text-right capitalize">{property.property_type.toLowerCase().replace('_', ' ')}</span>
                  </li>
                )}
                {property.year_built != null && (
                  <li className="flex justify-between border-b border-slate-800/60 pb-2">
                    <span className="text-slate-400">Year Built</span>
                    <span className="font-medium text-white text-right">{property.year_built}</span>
                  </li>
                )}
                {property.heating_type && (
                  <li className="flex justify-between border-b border-slate-800/60 pb-2">
                    <span className="text-slate-400">Heating</span>
                    <span className="font-medium text-white text-right">{property.heating_type}</span>
                  </li>
                )}
                {property.cooling_type && (
                  <li className="flex justify-between border-b border-slate-800/60 pb-2">
                    <span className="text-slate-400">Cooling</span>
                    <span className="font-medium text-white text-right">{property.cooling_type}</span>
                  </li>
                )}
                {property.parking && (
                  <li className="flex justify-between border-b border-slate-800/60 pb-2">
                    <span className="text-slate-400">Parking</span>
                    <span className="font-medium text-white text-right">{property.parking}</span>
                  </li>
                )}
                {property.laundry_type && (
                  <li className="flex justify-between border-b border-slate-800/60 pb-2">
                    <span className="text-slate-400">Laundry</span>
                    <span className="font-medium text-white text-right">{property.laundry_type}</span>
                  </li>
                )}
                {property.flooring && (
                  <li className="flex justify-between border-b border-slate-800/60 pb-2">
                    <span className="text-slate-400">Flooring</span>
                    <span className="font-medium text-white text-right">{property.flooring}</span>
                  </li>
                )}
              </ul>
            </div>

            {/* Renter Requirements */}
            {(property.minimum_credit_score != null || property.minimum_income_multiplier != null) && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8 space-y-4">
                <h2 className="text-xl font-bold text-white">Renter Requirements</h2>
                <ul className="space-y-3 text-sm text-slate-300">
                  {property.minimum_credit_score != null && (
                    <li className="flex justify-between border-b border-slate-800/60 pb-2">
                      <span className="text-slate-400">Minimum Credit Score</span>
                      <span className="font-bold text-cyan-400">{property.minimum_credit_score}</span>
                    </li>
                  )}
                  {property.minimum_income_multiplier != null && (
                    <li className="flex justify-between border-b border-slate-800/60 pb-2">
                      <span className="text-slate-400">Income to Rent Ratio</span>
                      <span className="font-bold text-cyan-400">{property.minimum_income_multiplier}x</span>
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>

          {/* Amenities & Features */}
          <div id="property-amenities-card" className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8 space-y-4">
            <h2 className="text-xl font-bold text-white">Amenities & Features</h2>
            
            {(!property.amenities?.length && !property.appliances?.length && !property.utilities_included) ? (
              <p className="text-sm text-slate-400 italic">No specific amenities listed.</p>
            ) : (
              <div className="space-y-6">
                {property.amenities && property.amenities.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold uppercase text-slate-400 mb-3 tracking-wider">Property Amenities</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-300">
                      {property.amenities.map((item, i) => (
                        <div key={i} className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-400 text-xs">✓</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {property.appliances && property.appliances.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold uppercase text-slate-400 mb-3 tracking-wider">Appliances Included</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-300">
                      {property.appliances.map((item, i) => (
                        <div key={i} className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400 text-xs">✓</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {property.utilities_included && (
                  <div>
                    <h3 className="text-sm font-semibold uppercase text-slate-400 mb-3 tracking-wider">Utilities Included</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-300">
                      <div className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-blue-400 text-xs">✓</span>
                        <span>{property.utilities_included}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: Apply CTA & Help */}
        <aside className="space-y-6">
          {/* Landlord Details */}
          {property.landlord && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 flex items-center gap-4 shadow-lg">
              {property.landlord.avatar_url ? (
                <img src={property.landlord.avatar_url} alt={property.landlord.contact_name} className="h-14 w-14 rounded-full object-cover border-2 border-slate-700" />
              ) : (
                <div className="h-14 w-14 rounded-full bg-slate-800 flex items-center justify-center text-lg font-bold text-slate-300 border-2 border-slate-700">
                  {property.landlord.contact_name?.[0] || property.landlord.business_name?.[0] || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-bold truncate">{property.landlord.business_name || property.landlord.contact_name}</h3>
                  {property.landlord.verified && (
                    <svg className="h-4 w-4 text-cyan-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                {property.landlord.tagline && (
                  <p className="text-xs text-slate-400 truncate mt-0.5">{property.landlord.tagline}</p>
                )}
              </div>
            </div>
          )}

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
              {property.available_date && (
                <div className="flex justify-between border-b border-slate-850 pb-1.5 mb-1.5">
                  <span>Available From</span>
                  <span className="font-semibold text-white">{new Date(property.available_date + 'T00:00:00').toLocaleDateString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Monthly Rent</span>
                <span className="font-semibold text-white">${property.rent_monthly.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Security Deposit</span>
                <span className="font-semibold text-white">${(property.security_deposit || property.rent_monthly).toLocaleString()}</span>
              </div>
              {property.last_months_rent != null && property.last_months_rent > 0 && (
                <div className="flex justify-between">
                  <span>Last Month's Rent</span>
                  <span className="font-semibold text-white">${property.last_months_rent.toLocaleString()}</span>
                </div>
              )}
              {property.admin_fee != null && property.admin_fee > 0 && (
                <div className="flex justify-between border-t border-slate-850 pt-1.5">
                  <span>Admin / Move-in Fee</span>
                  <span className="font-semibold text-white">${property.admin_fee.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-850 pt-1.5">
                <span>Application Fee</span>
                <span className="font-semibold text-cyan-400">${property.application_fee ?? 50}.00</span>
              </div>
              {property.move_in_special && (
                <div className="flex justify-between border-t border-slate-850 pt-1.5 text-emerald-400">
                  <span>Move-in Special</span>
                  <span className="font-semibold text-right max-w-[60%]">{property.move_in_special}</span>
                </div>
              )}
            </div>

            <Link
              id="apply-now-btn"
              to={applyUrl}
              className="flex w-full min-h-[48px] items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 via-teal-400 to-blue-600 px-6 py-3.5 text-center text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-cyan-900/40 transition hover:brightness-110"
            >
              Start Online Application →
            </Link>

            <p className="text-center text-[11px] text-slate-400">
              🔒 SSL Encrypted • Fast 24-48h Landlord Review
            </p>

            {/* Assistance Box */}
            <div className="border-t border-slate-800 pt-4 space-y-2">
              <h4 className="text-xs font-semibold uppercase text-slate-300">Have Questions About This Property?</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Our leasing coordinator is available to answer any questions regarding move-in dates or requirements.
              </p>
              <div className="text-xs text-slate-300 space-y-1 pt-1 mb-2">
                <p>Call: <a href="tel:7077063137" className="text-cyan-400 hover:underline">707-706-3137</a></p>
                <p>Email: <a href="mailto:support@choiceproperties.com" className="text-cyan-400 hover:underline">support@choiceproperties.com</a></p>
              </div>
            </div>

            {/* Inquiry Form */}
            <div id="inquiry-form-section">
              <InquiryForm propertyId={property.id} />
            </div>
          </div>
        </aside>
      </div>

      {/* Similar Listings */}
      <SimilarProperties currentId={property.id} city={property.city} currentRent={property.rent_monthly} />

      {/* Lightbox */}
      <Lightbox
        photos={property.photos}
        currentIndex={selectedPhoto}
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        onNavigate={setSelectedPhoto}
      />

      {/* Mobile Sticky Apply Bar */}
      <MobileApplyBar 
        rent={property.rent_monthly} 
        applyUrl={applyUrl} 
        onMessageClick={() => {
          document.getElementById('inquiry-form-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }} 
      />
    </div>
  )
}
