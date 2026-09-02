import { useProperties } from '../hooks/useProperties'

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
}

interface PropertyListProps {
  limit?: number
  onPropertySelect?: (id: string) => void
}

export function PropertyList({ limit = 12, onPropertySelect }: PropertyListProps) {
  const { properties, loading, error, refetch } = useProperties(limit)

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-2xl border border-slate-800 bg-slate-900 h-64" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
        <p className="font-semibold">Failed to load properties</p>
        <p className="mt-2 text-sm">{error}</p>
        <button
          onClick={() => refetch()}
          className="mt-4 rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm font-medium hover:bg-rose-500/20"
        >
          Try again
        </button>
      </div>
    )
  }

  if (properties.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-12 text-center">
        <p className="text-slate-400">No properties available</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {properties.map((property) => (
        <button
          key={property.id}
          onClick={() => onPropertySelect?.(property.id)}
          className="group rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left transition hover:border-cyan-500/40 hover:bg-slate-800"
        >
          {/* Thumbnail placeholder */}
          <div className="mb-3 aspect-video rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-center group-hover:border-cyan-500/20">
            <p className="text-xs text-slate-500">Photo</p>
          </div>

          <h3 className="font-semibold text-white line-clamp-2 group-hover:text-cyan-200">{property.title}</h3>

          <div className="mt-2 space-y-1 text-sm text-slate-400">
            <p className="line-clamp-1">{property.address}</p>
             <p>{property.city}</p>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3">
            <div>
              <p className="text-xs text-slate-500">Monthly rent</p>
              <p className="text-lg font-semibold text-white">${property.rent_monthly.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 mb-1">
                 {property.beds == null ? '—' : `${property.beds}bd`} / {property.baths == null ? '—' : `${property.baths}ba`}
              </p>
               <p className="text-xs text-slate-400">{property.sqft == null ? '—' : `${property.sqft.toLocaleString()} sqft`}</p>
            </div>
          </div>

          <div className="mt-3 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-center text-[10px] font-semibold uppercase text-emerald-300">
            {property.status}
          </div>
        </button>
      ))}
    </div>
  )
}
