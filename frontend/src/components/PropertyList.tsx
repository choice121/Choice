import { useEffect, useState, useMemo } from 'react'
import { useProperties } from '../hooks/useProperties'
import { useSavedProperties } from '../hooks/useSavedProperties'
import { PropertyCard } from './PropertyCard'

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
  
  // Advanced filters state
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [selectedType, setSelectedType] = useState<string>('All')
  const [minBaths, setMinBaths] = useState<string>('Any')
  const [petsAllowed, setPetsAllowed] = useState(false)
  const [hasAC, setHasAC] = useState(false)

  const perPage = Math.min(limit, 24)
  const { properties, loading, error, refetch, total, total_pages: totalPages } = useProperties({
    q: searchTerm.trim() || undefined,
    city: selectedCity !== 'all' ? selectedCity : undefined,
    beds: selectedBeds === '4+' ? 4 : selectedBeds !== 'all' ? selectedBeds : undefined,
    max_rent: maxRent !== 'all' ? maxRent : undefined,
    property_type: selectedType !== 'All' ? selectedType : undefined,
    min_baths: minBaths !== 'Any' ? parseInt(minBaths) : undefined,
    pets_allowed: petsAllowed ? true : undefined,
    has_ac: hasAC ? true : undefined,
    page: currentPage,
    per_page: perPage,
  })

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedCity, selectedBeds, maxRent, selectedType, minBaths, petsAllowed, hasAC])

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
    setSelectedType('All')
    setMinBaths('Any')
    setPetsAllowed(false)
    setHasAC(false)
    setCurrentPage(1)
  }

  const hasActiveAdvancedFilters = selectedType !== 'All' || minBaths !== 'Any' || petsAllowed || hasAC;

  return (
    <div id="property-list-section" className="space-y-6">
      {/* Search & Filter Controls */}
      <div id="property-filters-card" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Text Search */}
          <div>
            <label htmlFor="property-search-input" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Search Properties
            </label>
            <div className="relative">
              <input
                id="property-search-input"
                type="text"
                placeholder="Search city, address, or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 transition"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* City Select */}
          <div>
            <label htmlFor="property-city-select" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              City / Metro
            </label>
            <select
              id="property-city-select"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 transition"
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
            <label htmlFor="property-beds-select" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Bedrooms
            </label>
            <select
              id="property-beds-select"
              value={selectedBeds}
              onChange={(e) => setSelectedBeds(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 transition"
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
            <label htmlFor="property-rent-select" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Max Monthly Rent
            </label>
            <select
              id="property-rent-select"
              value={maxRent}
              onChange={(e) => setMaxRent(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 transition"
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

        {/* Advanced Filters Toggle */}
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition flex items-center gap-2"
          >
            <i className={`fa-solid fa-chevron-${showAdvanced ? 'up' : 'down'}`}></i>
            Advanced Filters
            {hasActiveAdvancedFilters && (
              <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-600">
                <i className="fa-solid fa-check"></i>
              </span>
            )}
          </button>
          <button
            onClick={clearFilters}
            className="text-sm font-medium text-slate-500 hover:text-slate-900 transition"
          >
            Reset All
          </button>
        </div>

        {/* Advanced Filters Panel */}
        {showAdvanced && (
          <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Property Type */}
            <div>
              <label htmlFor="property-type-select" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Property Type
              </label>
              <select
                id="property-type-select"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 transition"
              >
                <option value="All">All Types</option>
                <option value="House">House</option>
                <option value="Apartment">Apartment</option>
                <option value="Townhouse">Townhouse</option>
              </select>
            </div>

            {/* Bathrooms */}
            <div>
              <label htmlFor="property-baths-select" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Bathrooms
              </label>
              <select
                id="property-baths-select"
                value={minBaths}
                onChange={(e) => setMinBaths(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 transition"
              >
                <option value="Any">Any</option>
                <option value="1">1+ Baths</option>
                <option value="2">2+ Baths</option>
                <option value="3">3+ Baths</option>
              </select>
            </div>

            {/* Toggles */}
            <div className="flex flex-col gap-3 justify-center sm:col-span-2 lg:col-span-2 pt-2 sm:pt-6">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`relative flex h-5 w-9 items-center rounded-full transition-colors ${petsAllowed ? 'bg-slate-900' : 'bg-slate-200'}`}>
                  <input type="checkbox" className="peer sr-only" checked={petsAllowed} onChange={(e) => setPetsAllowed(e.target.checked)} />
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${petsAllowed ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
                <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition">Pet Friendly</span>
              </label>
              
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`relative flex h-5 w-9 items-center rounded-full transition-colors ${hasAC ? 'bg-slate-900' : 'bg-slate-200'}`}>
                  <input type="checkbox" className="peer sr-only" checked={hasAC} onChange={(e) => setHasAC(e.target.checked)} />
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${hasAC ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
                <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition">Air Conditioning</span>
              </label>
            </div>
          </div>
        )}

        {/* Quick City Pills */}
        {availableCities.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Popular:</span>
            <button
              type="button"
              onClick={() => setSelectedCity('all')}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition whitespace-nowrap ${
                selectedCity === 'all'
                  ? 'bg-zillow-blue text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All
            </button>
            {availableCities.slice(0, 7).map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => setSelectedCity(city)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition whitespace-nowrap ${
                  selectedCity === city
                    ? 'bg-zillow-blue text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {city}
              </button>
            ))}
          </div>
        )}
      </div>

      {savedError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">
          <span>Saved homes could not be synchronized. Your local saves are still shown.</span>
          <button type="button" onClick={() => void refetchSaved()} className="font-semibold text-amber-900 underline hover:text-amber-700">
            Retry
          </button>
        </div>
      )}

      {/* Results Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-slate-900">Available Homes</h2>
          <span className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
            {total} {total === 1 ? 'listing' : 'listings'}
          </span>
        </div>

        {(searchTerm || selectedCity !== 'all' || selectedBeds !== 'all' || maxRent !== 'all') && (
          <button
            id="clear-filters-btn"
            type="button"
            onClick={clearFilters}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 underline self-start sm:self-auto"
          >
            Reset all filters
          </button>
        )}
      </div>

      {/* Loading Skeletons */}
      {loading && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <div className="aspect-[4/3] bg-slate-100" />
              <div className="p-5 space-y-3">
                <div className="h-6 w-3/4 rounded-md bg-slate-100" />
                <div className="h-4 w-1/2 rounded-md bg-slate-100" />
                <div className="h-5 w-1/3 rounded-md bg-slate-100 pt-2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div id="property-error-state" className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-rose-900 text-center">
          <p className="text-base font-bold">Unable to load active listings</p>
          <p className="mt-2 text-sm text-rose-700">{error}</p>
          <button
            id="retry-fetch-btn"
            type="button"
            onClick={() => refetch()}
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-white border border-rose-200 px-4 py-2 text-sm font-semibold hover:bg-rose-50 transition min-h-[44px]"
          >
            Retry Loading Listings
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && properties.length === 0 && (
        <div id="property-empty-state" className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 mb-4">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-900">No properties match your filters</h3>
          <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            Try adjusting your search keywords, bedroom requirements, or city selection to see more homes.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-zillow-blue px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-zillow-blue-dark transition min-h-[44px]"
          >
            Show All Available Properties
          </button>
        </div>
      )}

      {/* Property Cards Grid */}
      {!loading && !error && properties.length > 0 && (
        <div id="properties-grid" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              isSaved={savedIds.has(property.id)}
              onToggleSave={toggleSaved}
              onPropertySelect={onPropertySelect}
            />
          ))}
        </div>
      )}

      {!loading && !error && totalPages > 1 && (
        <nav className="flex items-center justify-center gap-3 pt-6 pb-2" aria-label="Listings pagination">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            className="rounded-xl border border-slate-200 bg-white shadow-sm px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm font-medium text-slate-500">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            className="rounded-xl border border-slate-200 bg-white shadow-sm px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </nav>
      )}
    </div>
  )
}
