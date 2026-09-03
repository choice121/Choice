import type { PropertyData } from '../utils/supabase';

interface PropertyCardProps {
  property: PropertyData;
  isSaved?: boolean;
  onToggleSave?: (id: string) => void;
  onPropertySelect?: (id: string) => void;
}

export function PropertyCard({ property, isSaved = false, onToggleSave, onPropertySelect }: PropertyCardProps) {
  return (
    <article
      id={`property-card-${property.id}`}
      className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md"
    >
      {/* Photo & badges */}
      <div
        className="relative aspect-[4/3] overflow-hidden bg-slate-100 cursor-pointer"
        onClick={() => onPropertySelect?.(property.id)}
      >
        {property.photo_url ? (
          <img
            src={window.CONFIG?.img ? window.CONFIG.img(property.photo_url, "card") : property.photo_url}
            alt={property.title || 'Property photo'}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-4 text-center">
            <svg className="h-8 w-8 text-slate-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs text-slate-500">Photo coming soon</span>
          </div>
        )}

        {onToggleSave && (
          <button type="button" aria-label={isSaved ? `Remove ${property.title || property.address} from saved homes` : `Save ${property.title || property.address}`} aria-pressed={isSaved} onClick={(e) => { e.stopPropagation(); onToggleSave(property.id); }} className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md shadow-sm border ${isSaved ? 'bg-rose-50 border-rose-200 text-rose-500' : 'bg-white/90 border-slate-200 text-slate-400 hover:text-slate-900'} hover:scale-110 transition z-10`}><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill={isSaved ? "currentColor" : "none"} stroke="currentColor"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg></button>
        )}
        
        {/* Badges overlay */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-white/95 shadow-sm border border-slate-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zillow-green-dark whitespace-nowrap">
            ● {property.status}
          </span>
        </div>
      </div>

      {/* Content Body */}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex justify-between items-start mb-1">
          <h3
            onClick={() => onPropertySelect?.(property.id)}
            className="font-bold text-slate-900 text-lg font-display leading-snug line-clamp-1 group-hover:text-zillow-green-dark transition cursor-pointer"
          >
            {property.title || property.address}
          </h3>
        </div>

        <p className="text-xs text-slate-500 line-clamp-1 font-medium">
          {property.address}, {property.city}
        </p>
        
        <div className="mt-3 flex items-baseline gap-1">
          <span className="text-xl font-extrabold text-slate-900 font-display">${property.rent_monthly.toLocaleString()}</span>
          <span className="text-xs font-semibold text-slate-500 uppercase">/mo</span>
        </div>

        {/* Property Specs Chips */}
        <div className="mt-4 grid grid-cols-3 gap-2 border-y border-slate-100 py-3 text-center bg-slate-50 rounded-lg">
          <div>
            <span className="block text-sm font-bold text-slate-900">
              {property.beds == null ? '—' : property.beds}
            </span>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Beds</span>
          </div>
          <div className="border-x border-slate-200">
            <span className="block text-sm font-bold text-slate-900">
              {property.baths == null ? '—' : property.baths}
            </span>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Baths</span>
          </div>
          <div>
            <span className="block text-sm font-bold text-slate-900">
              {property.sqft == null ? '—' : property.sqft.toLocaleString()}
            </span>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Sq Ft</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-5 grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => onPropertySelect?.(property.id)}
            className="flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 min-h-[44px] whitespace-nowrap"
          >
            Details
          </button>
          <a
            href={`/apply/?id=${encodeURIComponent(property.id)}&rent=${encodeURIComponent(String(property.rent_monthly))}&addr=${encodeURIComponent(property.address)}&city=${encodeURIComponent(property.city)}`}
            className="flex items-center justify-center rounded-xl bg-zillow-blue px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zillow-blue-dark min-h-[44px] whitespace-nowrap"
          >
            Apply Now
          </a>
        </div>
      </div>
    </article>
  );
}
