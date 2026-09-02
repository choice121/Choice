import { useEffect, useState, useMemo } from 'react'
import { useProperties } from '../hooks/useProperties'
import { useSavedProperties } from '../hooks/useSavedProperties'

export interface PropertyCardData {
  id: string
  title: string
  address: string
  city: string
  rent_monthly: number
  beds: number | null
  baths: number | null
  sqft: number | null
  status: string
  photo_url: string | null
}

interface PropertyListProps {
  limit?: number
  onPropertySelect?: (id: string) => void
  initialCity?: string
}

export function PropertyList({ limit = 36, onPropertySelect, initialCity = 'all' }: PropertyListProps) {
  const { savedIds, toggleSaved, error: savedError, refetch: refetchSaved } = useSavedProperties()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCity, setSelectedCity] = useState(initialCity)
  const [selectedBeds, setSelectedBeds] = useState<string>('all')
  const [maxRent, setMaxRent] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const perPage = Math.min(limit, 24)
  const { properties, loading, error, refetch, total, total_pages: totalPages } = useProperties({
    q: searchTerm.trim() || undefined,
    city: selectedCity !== 'all' ? selectedCity : undefined,
    beds: selectedBeds === '4+' ? 4 : selectedBeds !== 'all' ? selectedBeds : undefined,
    max_rent: maxRent !== 'all' ? maxRent : undefined,
    page: currentPage,
    per_page: perPage,
  })

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedCity, selectedBeds, maxRent])

  // Extract distinct cities for quick filter pills
  const availableCities = useMemo(() => {
    const citySet = new Set<string>()
    properties.forEach((p) => {
      if (p.city && p.city.trim()) {
        citySet.add(p.city.trim())
      }
    })
    return Array.from(citySet).sort()
  }, [properties])

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedCity('all')
    setSelectedBeds('all')
    setMaxRent('all')
    setCurrentPage(1)
  }

  return (
    <div id="property-list-section" className="space-y-6">
      {/* Search & Filter Controls */}
      <div id="property-filters-card" className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 sm:p-6 shadow-xl">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Text Search */}
          <div>
            <label htmlFor="property-search-input" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Search Properties
            </label>
            <div className="relative">
              <input
                id="property-search-input"
                type="text"
                placeholder="Search city, address, or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* City Select */}
          <div>
            <label htmlFor="property-city-select" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              City / Metro
            </label>
            <select
              id="property-city-select"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            >
               <option value="all">All Cities ({total})</option>
              {availableCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          {/* Bedrooms Select */}
          <div>
            <label htmlFor="property-beds-select" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Bedrooms
            </label>
            <select
              id="property-beds-select"
              value={selectedBeds}
              onChange={(e) => setSelectedBeds(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            >
              <option value="all">Any Bedrooms</option>
              <option value="1">1 Bedroom</option>
              <option value="2">2 Bedrooms</option>
              <option value="3">3 Bedrooms</option>
              <option value="4+">4+ Bedrooms</option>
            </select>
          </div>

          {/* Max Rent Select */}
          <div>
            <label htmlFor="property-rent-select" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Max Monthly Rent
            </label>
            <select
              id="property-rent-select"
              value={maxRent}
              onChange={(e) => setMaxRent(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            >
              <option value="all">Any Price</option>
              <option value="1200">Up to $1,200/mo</option>
              <option value="1500">Up to $1,500/mo</option>
              <option value="1800">Up to $1,800/mo</option>
              <option value="2200">Up to $2,200/mo</option>
              <option value="3000">Up to $3,000/mo</option>
            </select>
          </div>
        </div>

        {/* Quick City Pills */}
        {availableCities.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-800/80 pt-4">
            <span className="text-xs text-slate-400 font-medium">Popular:</span>
            <button
              type="button"
              onClick={() => setSelectedCity('all')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition whitespace-nowrap ${
                selectedCity === 'all'
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              All
            </button>
            {availableCities.slice(0, 7).map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => setSelectedCity(city)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition whitespace-nowrap ${
                  selectedCity === city
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {city}
              </button>
            ))}
          </div>
        )}
      </div>

      {savedError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" role="alert">
          <span>Saved homes could not be synchronized. Your local saves are still shown.</span>
          <button type="button" onClick={() => void refetchSaved()} className="font-semibold text-amber-300 underline hover:text-amber-100">
            Retry
          </button>
        </div>
      )}

      {/* Results Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-white">Available Homes</h2>
          <span className="rounded-full bg-cyan-950 border border-cyan-800 px-2.5 py-0.5 text-xs font-medium text-cyan-300">
            {total} {total === 1 ? 'listing' : 'listings'}
          </span>
        </div>

        {(searchTerm || selectedCity !== 'all' || selectedBeds !== 'all' || maxRent !== 'all') && (
          <button
            id="clear-filters-btn"
            type="button"
            onClick={clearFilters}
            className="text-xs font-medium text-cyan-400 hover:text-cyan-300 underline self-start sm:self-auto"
          >
            Reset all filters
          </button>
        )}
      </div>

      {/* Loading Skeletons */}
      {loading && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
              <div className="aspect-[16/10] bg-slate-800" />
              <div className="p-5 space-y-3">
                <div className="h-6 w-3/4 rounded bg-slate-800" />
                <div className="h-4 w-1/2 rounded bg-slate-800" />
                <div className="h-5 w-1/3 rounded bg-slate-800 pt-2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div id="property-error-state" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-8 text-rose-200 text-center">
          <p className="text-base font-semibold">Unable to load active listings</p>
          <p className="mt-2 text-sm text-rose-300/80">{error}</p>
          <button
            id="retry-fetch-btn"
            type="button"
            onClick={() => refetch()}
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-rose-600/30 border border-rose-500/50 px-4 py-2 text-sm font-medium hover:bg-rose-600/50 transition min-h-[44px]"
          >
            Retry Loading Listings
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && properties.length === 0 && (
        <div id="property-empty-state" className="rounded-2xl border border-slate-800 bg-slate-900/60 p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-slate-400 mb-4">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-white">No properties match your filters</h3>
          <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
            Try adjusting your search keywords, bedroom requirements, or city selection to see more homes.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-slate-800 border border-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 transition min-h-[44px]"
          >
            Show All Available Properties
          </button>
        </div>
      )}

      {/* Property Cards Grid */}
      {!loading && !error && properties.length > 0 && (
        <div id="properties-grid" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => (
            <article
              key={property.id}
              id={`property-card-${property.id}`}
              className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 shadow-md transition-all duration-200 hover:-translate-y-1 hover:border-cyan-500/50 hover:shadow-xl hover:shadow-cyan-950/20"
            >
              {/* Photo & badges */}
              <div
                className="relative aspect-[16/10] overflow-hidden bg-slate-950 cursor-pointer"
                onClick={() => onPropertySelect?.(property.id)}
              >
                {property.photo_url ? (
                  <img
                    src={window.CONFIG?.img ? window.CONFIG.img(property.photo_url, "card") : property.photo_url}
                    alt={property.title || 'Property photo'}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center p-4 text-center">
                    <svg className="h-8 w-8 text-slate-600 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs text-slate-500">Photo coming soon</span>
                  </div>
                )}

                <button onClick={(e) => { e.stopPropagation(); toggleSaved(property.id); }} className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md border ${savedIds.has(property.id) ? 'bg-rose-500/20 border-rose-500/50 text-rose-500' : 'bg-slate-900/50 border-white/20 text-white'} hover:scale-110 transition z-10`}><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill={savedIds.has(property.id) ? "currentColor" : "none"} stroke="currentColor"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg></button>
                {/* Badges overlay */}
                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-slate-950/80 backdrop-blur-sm border border-slate-700/60 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 whitespace-nowrap">
                    ● {property.status}
                  </span>
                  <span className="rounded-full bg-emerald-950/80 backdrop-blur-sm border border-emerald-700/60 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300 whitespace-nowrap">
                    🐾 Pet Friendly
                  </span>
                </div>

                {/* Price tag pill */}
                <div className="absolute bottom-3 right-3 rounded-xl bg-slate-950/90 backdrop-blur-sm border border-slate-700 px-3 py-1 shadow-lg">
                  <span className="text-base font-bold text-white">${property.rent_monthly.toLocaleString()}</span>
                  <span className="text-xs text-slate-400">/mo</span>
                </div>
              </div>

              {/* Content Body */}
              <div className="flex flex-1 flex-col p-5">
                <h3
                  onClick={() => onPropertySelect?.(property.id)}
                  className="font-bold text-white text-base leading-snug line-clamp-1 group-hover:text-cyan-300 transition cursor-pointer"
                >
                  {property.title || property.address}
                </h3>

                <p className="mt-1 text-xs text-slate-400 line-clamp-1">
                  {property.address}, {property.city}
                </p>

                {/* Property Specs Chips */}
                <div className="mt-4 grid grid-cols-3 gap-2 border-y border-slate-800/80 py-3 text-center">
                  <div>
                    <span className="block text-xs font-semibold text-white">
                      {property.beds == null ? '—' : property.beds}
                    </span>
                    <span className="block text-[10px] uppercase text-slate-400">Beds</span>
                  </div>
                  <div className="border-x border-slate-800">
                    <span className="block text-xs font-semibold text-white">
                      {property.baths == null ? '—' : property.baths}
                    </span>
                    <span className="block text-[10px] uppercase text-slate-400">Baths</span>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-white">
                      {property.sqft == null ? '—' : property.sqft.toLocaleString()}
                    </span>
                    <span className="block text-[10px] uppercase text-slate-400">Sq Ft</span>
                  </div>
                </div>

                {/* Transparency Guarantee */}
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Deposit: 1x rent</span>
                  <span className="font-medium text-cyan-400">$50 App Fee</span>
                </div>

                {/* Buttons */}
                <div className="mt-5 grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onPropertySelect?.(property.id)}
                    className="flex items-center justify-center rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-700 hover:border-slate-600 min-h-[44px] whitespace-nowrap"
                  >
                    View Details
                  </button>
                  <a
                    href={`/apply/?id=${encodeURIComponent(property.id)}&rent=${encodeURIComponent(String(property.rent_monthly))}&addr=${encodeURIComponent(property.address)}&city=${encodeURIComponent(property.city)}`}
                    className="flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-2.5 text-xs font-semibold text-white shadow-md shadow-cyan-950/40 transition hover:brightness-110 min-h-[44px] whitespace-nowrap"
                  >
                    Apply Now
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && !error && totalPages > 1 && (
        <nav className="flex items-center justify-center gap-3 pt-2" aria-label="Listings pagination">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-slate-400">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </nav>
      )}
    </div>
  )
}
