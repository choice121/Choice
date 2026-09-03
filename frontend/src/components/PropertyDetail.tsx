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
    <div className="mt-12 pt-12 border-t border-slate-200">
      <div className="mb-6 space-y-1">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Also Available</span>
        <h2 className="text-2xl font-bold  text-slate-900 font-display">More in <em className="not-italic text-slate-500">{city}</em></h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {similar.map(p => (
          <Link key={p.id} to={`/property?id=${p.id}`} className="group flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-slate-300 shadow-sm hover:shadow-md transition-all">
            <div className="aspect-[4/3] bg-slate-100 overflow-hidden relative">
              <img 
                src={p.photo_url ? (window.CONFIG?.img ? window.CONFIG.img(p.photo_url, 'card') : p.photo_url) : '/assets/placeholder-property.jpg'} 
                alt={p.title || 'Property'} 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <div className="p-4 flex flex-col flex-1">
              <div className="text-lg font-bold text-slate-900 flex items-baseline gap-1">
                ${p.rent_monthly.toLocaleString()} <span className="text-xs font-semibold uppercase text-slate-500">/mo</span>
              </div>
              <h3 className="text-sm font-bold text-slate-700 mt-1 truncate">{p.title || 'Rental'}</h3>
              <p className="text-xs font-medium text-slate-500 mt-1">
                {[p.beds != null ? `${p.beds} bed` : '', p.baths != null ? `${p.baths} bath` : ''].filter(Boolean).join(' · ')}
              </p>
              <p className="text-[11px] font-medium text-slate-400 mt-0.5 truncate">{p.address}, {p.city}</p>
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
          <div className="h-6 w-32 rounded-lg bg-slate-100" />
          <div className="h-10 w-2/3 rounded-xl bg-slate-100" />
          <div className="aspect-[16/9] max-h-[500px] w-full rounded-2xl bg-slate-100" />
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="h-40 rounded-2xl bg-slate-100" />
            <div className="h-40 rounded-2xl bg-slate-100" />
            <div className="h-40 rounded-2xl bg-slate-100" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !property) {
    return (
      <div id="property-error-container" className="mx-auto max-w-4xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-rose-900 shadow-sm">
          <h2 className="text-xl font-bold">Property Not Available</h2>
          <p className="mt-2 text-sm text-rose-700">{error || 'This listing could not be found or has been leased.'}</p>
          <div className="mt-6 flex justify-center gap-4">
            <Link
              id="back-to-listings-btn"
              to="/listings"
              className="inline-flex items-center justify-center rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition min-h-[44px]"
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
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition"
        >
          <span aria-hidden="true">←</span> Back to Available Homes
        </Link>
        <span className="text-xs font-medium text-slate-400">Listing ID: {property.id.slice(0, 8)}</span>
      </div>

        {savedError && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">
            <span>Saved homes could not be synchronized. Your local saves are still shown.</span>
            <button type="button" onClick={() => void refetchSaved()} className="font-semibold text-amber-900 underline hover:text-amber-700">
              Retry
            </button>
          </div>
        )}

      {/* Title & Header Section */}
      <div id="property-header-card" className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white border border-slate-200 shadow-sm px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zillow-green-dark">
              ● {property.status}
            </span>
            <span className="rounded-full bg-white border border-slate-200 shadow-sm px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
              🐾 Pet Friendly
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
              {property.city}, {property.state}
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            {property.title || property.address}
          </h1>

          <p className="text-sm sm:text-base font-medium text-slate-500 flex items-center gap-1.5">
            <svg className="h-4 w-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {property.address}, {property.city}, {property.state} {property.zip}
          </p>
        </div>

        {/* Rent Highlight Box */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 text-left md:text-right shrink-0 shadow-sm">
          <span className="block text-xs uppercase font-bold tracking-wider text-slate-500">Monthly Rent</span>
          <div className="flex items-baseline md:justify-end gap-1 mt-0.5">
            <span className="text-3xl font-extrabold  text-slate-900 font-display">${property.rent_monthly.toLocaleString()}</span>
            <span className="text-sm font-semibold uppercase text-slate-500">/mo</span>
          </div>
          <p className="text-[11px] font-semibold text-zillow-green-dark mt-1 uppercase tracking-wider">1x Rent Deposit • $50 App Fee</p>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left 2 Cols: Photos, Specs, Description, Amenities */}
        <div className="lg:col-span-2 space-y-8">
          {/* Gallery Section */}
          <div id="property-gallery-container" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm relative">
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
                className="p-3 rounded-full backdrop-blur-md shadow-sm border bg-white/90 border-slate-200 text-slate-600 hover:text-slate-900 hover:scale-110 transition"
                aria-label="Share property"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>
              <button onClick={() => toggleSaved(property.id)} className={`p-3 rounded-full backdrop-blur-md shadow-sm border ${savedIds.has(property.id) ? 'bg-rose-50 border-rose-200 text-rose-500' : 'bg-white/90 border-slate-200 text-slate-600 hover:text-slate-900'} hover:scale-110 transition`} aria-label="Save property">
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
                  className="relative aspect-[16/10] overflow-hidden rounded-xl bg-slate-100 w-full hover:opacity-95 transition"
                  aria-label="View fullscreen gallery"
                >
                  <img
                    id="hero-gallery-image"
                    src={window.CONFIG?.img ? window.CONFIG.img(property.photos[selectedPhoto]?.url, 'gallery') : property.photos[selectedPhoto]?.url}
                    alt={`${property.title} photo ${selectedPhoto + 1}`}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute bottom-3 right-3 rounded-lg bg-white/90 backdrop-blur-sm border border-slate-200 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-700 shadow-sm">
                    Photo {selectedPhoto + 1} of {property.photos.length}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/10 transition-colors">
                    <svg className="h-10 w-10 text-white opacity-0 hover:opacity-100 drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        className={`overflow-hidden rounded-lg border-2 transition aspect-square bg-slate-100 ${
                          selectedPhoto === index
                            ? 'border-slate-900 ring-2 ring-slate-900/10'
                            : 'border-transparent opacity-70 hover:opacity-100 hover:border-slate-300'
                        }`}
                      >
                        <img src={window.CONFIG?.img ? window.CONFIG.img(photo.url, 'thumb') : photo.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-xl bg-slate-50 border border-slate-100 text-slate-500">
                <p className="text-sm font-medium">No photos currently uploaded for this property.</p>
              </div>
            )}
          </div>

          {/* Key Specs Row */}
          <div id="property-specs-grid" className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">Bedrooms</span>
              <span className="mt-1 block text-2xl font-extrabold text-slate-900 font-display">{property.beds ?? '—'}</span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">Bathrooms</span>
              <span className="mt-1 block text-2xl font-extrabold text-slate-900 font-display">{property.baths ?? '—'}</span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">Square Feet</span>
              <span className="mt-1 block text-2xl font-extrabold text-slate-900 font-display">
                {property.sqft == null ? '—' : property.sqft.toLocaleString()}
              </span>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center shadow-sm">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-zillow-green-dark">Pet Policy</span>
              <span className="mt-1 block text-lg font-extrabold text-zillow-green-dark">Pets Welcome</span>
            </div>
          </div>

          {/* Description */}
          {property.description && (
            <div id="property-description-card" className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-4 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 font-display">About This Rental</h2>
              <div className="text-slate-600 leading-relaxed whitespace-pre-line text-sm sm:text-base space-y-3 font-medium">
                {property.description}
              </div>
            </div>
          )}

          {/* Map Section */}
          <PropertyMap lat={property.lat} lng={property.lng} address={property.address} title={property.title} monthly_rent={property.rent_monthly} />

          {/* Verified Lease Terms */}
          <div id="property-terms-card" className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-5 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 font-display">Transparent Lease Terms</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Monthly Rent</span>
                <p className="text-xl font-extrabold text-slate-900">${property.rent_monthly.toLocaleString()}</p>
                <p className="text-[11px] font-medium text-slate-500">Due on the 1st of each month</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Security Deposit</span>
                <p className="text-xl font-extrabold text-slate-900">${property.rent_monthly.toLocaleString()}</p>
                <p className="text-[11px] font-bold text-zillow-green-dark">Guaranteed 1x monthly rent</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Application Fee</span>
                <p className="text-xl font-extrabold text-slate-900">$50</p>
                <p className="text-[11px] font-medium text-slate-500">Per adult applicant (covers background & screening)</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Pet Policy</span>
                <p className="text-xl font-extrabold text-zillow-green-dark">100% Pet Friendly</p>
                <div className="text-[11px] font-medium text-slate-500 space-y-1 mt-1">
                  <p>{property.pet_types_allowed || 'Dogs and cats welcome'}</p>
                  {property.pet_weight_limit != null && <p>Weight limit: {property.pet_weight_limit} lbs</p>}
                  {property.pet_deposit != null && <p>Pet deposit: ${property.pet_deposit}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Property Facts & Requirements */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Property Facts */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-4 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 font-display">Property Facts</h2>
              <ul className="space-y-3 text-sm text-slate-600 font-medium">
                {property.property_type && (
                  <li className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">Type</span>
                    <span className="font-bold text-slate-900 text-right capitalize">{property.property_type.toLowerCase().replace('_', ' ')}</span>
                  </li>
                )}
                {property.year_built != null && (
                  <li className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">Year Built</span>
                    <span className="font-bold text-slate-900 text-right">{property.year_built}</span>
                  </li>
                )}
                {property.lot_size_sqft != null && (
                  <li className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">Lot Size</span>
                    <span className="font-bold text-slate-900 text-right">{property.lot_size_sqft.toLocaleString()} sqft</span>
                  </li>
                )}
                {property.has_basement != null && (
                  <li className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">Basement</span>
                    <span className="font-bold text-slate-900 text-right">{property.has_basement ? 'Yes' : 'No'}</span>
                  </li>
                )}
                {property.has_central_air != null && (
                  <li className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">Central Air</span>
                    <span className="font-bold text-slate-900 text-right">{property.has_central_air ? 'Yes' : 'No'}</span>
                  </li>
                )}
                {property.heating_type && (
                  <li className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">Heating</span>
                    <span className="font-bold text-slate-900 text-right">{property.heating_type}</span>
                  </li>
                )}
                {property.cooling_type && (
                  <li className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">Cooling</span>
                    <span className="font-bold text-slate-900 text-right">{property.cooling_type}</span>
                  </li>
                )}
                {property.parking && (
                  <li className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">Parking</span>
                    <span className="font-bold text-slate-900 text-right">
                      {property.parking}
                      {property.parking_spaces != null && ` (${property.parking_spaces} spaces)`}
                    </span>
                  </li>
                )}
                {property.laundry_type && (
                  <li className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">Laundry</span>
                    <span className="font-bold text-slate-900 text-right">{property.laundry_type}</span>
                  </li>
                )}
                {property.flooring && (
                  <li className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500">Flooring</span>
                    <span className="font-bold text-slate-900 text-right">{property.flooring}</span>
                  </li>
                )}
              </ul>
            </div>

            {/* Renter Requirements */}
            {(property.minimum_credit_score != null || property.minimum_income_multiplier != null) && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-4 shadow-sm">
                <h2 className="text-xl font-bold text-slate-900 font-display">Renter Requirements</h2>
                <ul className="space-y-3 text-sm text-slate-600 font-medium">
                  {property.minimum_credit_score != null && (
                     <li className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="text-slate-500">Minimum Credit Score</span>
                      <span className="font-extrabold text-slate-900">{property.minimum_credit_score}</span>
                    </li>
                  )}
                  {property.minimum_income_multiplier != null && (
                    <li className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="text-slate-500">Income to Rent Ratio</span>
                      <span className="font-extrabold text-slate-900">{property.minimum_income_multiplier}x</span>
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>

          {/* Amenities & Features */}
          <div id="property-amenities-card" className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-4 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 font-display">Amenities & Features</h2>
            
            {(!property.amenities?.length && !property.appliances?.length && !property.utilities_included) ? (
              <p className="text-sm font-medium text-slate-500 italic">No specific amenities listed.</p>
            ) : (
              <div className="space-y-6">
                {property.amenities && property.amenities.length > 0 && (
                  <div>
                    <h3 className="text-[11px] font-bold uppercase text-slate-500 mb-3 tracking-wider">Property Amenities</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm font-semibold text-slate-700">
                      {property.amenities.map((item, i) => (
                        <div key={i} className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white border border-slate-200 text-slate-900 text-xs shadow-sm">✓</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {property.appliances && property.appliances.length > 0 && (
                  <div>
                    <h3 className="text-[11px] font-bold uppercase text-slate-500 mb-3 tracking-wider">Appliances Included</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm font-semibold text-slate-700">
                      {property.appliances.map((item, i) => (
                        <div key={i} className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white border border-slate-200 text-slate-900 text-xs shadow-sm">✓</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {property.utilities_included && (
                  <div>
                    <h3 className="text-[11px] font-bold uppercase text-slate-500 mb-3 tracking-wider">Utilities Included</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm font-semibold text-slate-700">
                      <div className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white border border-slate-200 text-slate-900 text-xs shadow-sm">✓</span>
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
            <div className="rounded-2xl border border-slate-200 bg-white p-5 flex items-center gap-4 shadow-sm">
              {property.landlord.avatar_url ? (
                <img src={property.landlord.avatar_url} alt={property.landlord.contact_name} className="h-14 w-14 rounded-full object-cover border border-slate-200" />
              ) : (
                <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center text-lg font-bold text-slate-400 border border-slate-200">
                  {property.landlord.contact_name?.[0] || property.landlord.business_name?.[0] || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-slate-900 font-bold truncate">{property.landlord.business_name || property.landlord.contact_name}</h3>
                  {property.landlord.verified && (
                    <svg className="h-4 w-4 text-zillow-green-dark shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                {property.landlord.tagline && (
                  <p className="text-xs text-slate-500 font-medium truncate mt-0.5">{property.landlord.tagline}</p>
                )}
              </div>
            </div>
          )}

          {/* Apply CTA Card */}
          <div id="property-apply-cta-card" className="sticky top-24 self-start pb-4 max-h-[calc(100vh-6rem)] overflow-y-auto no-scrollbar rounded-2xl border border-slate-200 bg-white p-6 shadow-md space-y-5">
            <div className="space-y-1">
              <span className="text-[11px] uppercase font-bold tracking-wider text-slate-500">Ready to make this home?</span>
              <h3 className="text-2xl font-extrabold  text-slate-900 font-display">Apply in 10 Minutes</h3>
            </div>

            <p className="text-sm font-medium text-slate-600 leading-relaxed">
              Submit your verified online application now. Our leasing team reviews completed applications in 24 to 48 hours.
            </p>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2.5 text-xs text-slate-600 font-medium">
              {property.available_date && (
                <div className="flex justify-between border-b border-slate-200 pb-2 mb-2">
                  <span>Available From</span>
                  <span className="font-bold text-slate-900">{new Date(property.available_date + 'T00:00:00').toLocaleDateString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Monthly Rent</span>
                <span className="font-bold text-slate-900">${property.rent_monthly.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Security Deposit</span>
                <span className="font-bold text-slate-900">${(property.security_deposit || property.rent_monthly).toLocaleString()}</span>
              </div>
              {property.last_months_rent != null && property.last_months_rent > 0 && (
                <div className="flex justify-between">
                  <span>Last Month's Rent</span>
                  <span className="font-bold text-slate-900">${property.last_months_rent.toLocaleString()}</span>
                </div>
              )}
              {property.admin_fee != null && property.admin_fee > 0 && (
                <div className="flex justify-between border-t border-slate-200 pt-2.5 mt-1">
                  <span>Admin / Move-in Fee</span>
                  <span className="font-bold text-slate-900">${property.admin_fee.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-2.5 mt-1">
                <span>Application Fee</span>
                <span className="font-bold text-slate-900">${property.application_fee ?? 50}.00</span>
              </div>
              {property.move_in_special && (
                <div className="flex justify-between border-t border-slate-200 pt-2.5 mt-1 text-zillow-green-dark">
                  <span>Move-in Special</span>
                  <span className="font-bold text-right max-w-[60%]">{property.move_in_special}</span>
                </div>
              )}
            </div>

            <Link
              id="apply-now-btn"
              to={applyUrl}
              className="flex w-full min-h-[48px] items-center justify-center rounded-xl bg-zillow-blue px-6 py-3.5 text-center text-sm font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-zillow-blue-dark"
            >
              Start Online Application →
            </Link>

            <p className="text-center text-[11px] font-semibold text-slate-500">
              🔒 SSL Encrypted • Fast 24-48h Landlord Review
            </p>

            {/* Assistance Box */}
            <div className="border-t border-slate-100 pt-5 space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Have Questions About This Property?</h4>
              <p className="text-xs font-medium text-slate-600 leading-relaxed">
                Our leasing coordinator is available to answer any questions regarding move-in dates or requirements.
              </p>
              <div className="text-xs font-semibold text-slate-700 space-y-1 pt-2 mb-2">
                <p>Call: <a href="tel:7077063137" className="text-slate-900 underline hover:text-slate-600">707-706-3137</a></p>
                <p>Email: <a href="mailto:support@choiceproperties.com" className="text-slate-900 underline hover:text-slate-600">support@choiceproperties.com</a></p>
              </div>
            </div>

            {/* Inquiry Form */}
            <div id="inquiry-form-section" className="pt-2">
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
