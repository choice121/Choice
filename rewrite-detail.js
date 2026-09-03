const fs = require('fs');

let content = fs.readFileSync('frontend/src/components/PropertyDetail.tsx', 'utf8');

// 1. Add 'font-display' to headings and prices globally.
content = content.replace(/className="(text-[234]xl.*?font-[a-z]+.*?)text-slate-900"/g, 'className="$1 text-slate-900 font-display"');
content = content.replace(/className="text-xl font-bold text-slate-900"/g, 'className="text-xl font-bold text-slate-900 font-display"');
content = content.replace(/className="mt-1 block text-2xl font-extrabold text-slate-900"/g, 'className="mt-1 block text-2xl font-extrabold text-slate-900 font-display"');

// Fix sticky sidebar overlaying footer
content = content.replace(/className="sticky top-24 rounded-2xl/g, 'className="sticky top-24 self-start pb-4 max-h-[calc(100vh-6rem)] overflow-y-auto no-scrollbar rounded-2xl');

const returnBlockRegex = /return \(\s*<div id="property-detail-view"[\s\S]*?\n\s*\)\s*\}\s*$/m;
const match = content.match(returnBlockRegex);

if (match) {
  let oldReturn = match[0];
  
  // Replace Breadcrumb and Header with Mobile order and layout
  let newReturn = oldReturn.replace(
    /<div id="property-detail-view".*?>[\s\S]*?\{\/\* Right Sidebar: Apply CTA & Help \*\/\}/,
    `<div id="property-detail-view" className="mx-auto max-w-7xl px-4 py-4 sm:py-8 sm:px-6 lg:px-8 mb-24 md:mb-0">
      <div className="flex flex-col">
        {/* Mobile Gallery (Bleed) */}
        <div className="order-1 sm:hidden -mx-4 mb-4 flex overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden">
          {property.photos.length > 0 ? property.photos.map((photo, index) => (
            <div key={index} className="w-full shrink-0 snap-center aspect-[4/3] relative" onClick={() => { setSelectedPhoto(index); setIsLightboxOpen(true); }}>
              <img src={window.CONFIG?.img ? window.CONFIG.img(photo.url, 'gallery') : photo.url} className="w-full h-full object-cover" />
              <div className="absolute bottom-3 right-3 rounded-md bg-black/60 px-2 py-0.5 text-xs font-bold text-white tracking-wider backdrop-blur-sm">
                {index + 1} / {property.photos.length}
              </div>
            </div>
          )) : (
            <div className="w-full aspect-[4/3] bg-slate-100 flex items-center justify-center text-slate-400">No photos available</div>
          )}
        </div>

        {/* Header & Breadcrumbs */}
        <div className="order-2 sm:order-1 mb-6 sm:mb-8 space-y-4">
          <div className="flex items-center justify-between">
            <Link id="breadcrumb-back-link" to="/listings" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to search
            </Link>
            <div className="flex items-center gap-3">
              <button onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: property.title || property.address, url: window.location.href }).catch(() => {})
                } else {
                  navigator.clipboard.writeText(window.location.href)
                }
              }} className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                <span className="hidden sm:inline">Share</span>
              </button>
              <button onClick={() => toggleSaved(property.id)} className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill={savedIds.has(property.id) ? "currentColor" : "none"} stroke="currentColor">
                  <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                </svg>
                <span className="hidden sm:inline">{savedIds.has(property.id) ? 'Saved' : 'Save'}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1 sm:space-y-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-display leading-tight">
                {property.title || property.address}
              </h1>
              <p className="text-base sm:text-lg font-medium text-slate-500">
                {property.address}, {property.city}, {property.state} {property.zip}
              </p>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 font-display">\${property.rent_monthly.toLocaleString()}</span>
              <span className="font-bold text-slate-500 uppercase tracking-wider text-sm">/mo</span>
            </div>
          </div>
        </div>

        {/* Mobile Inline Specs */}
        <div className="order-3 sm:hidden flex flex-wrap items-center gap-x-3 gap-y-2 text-slate-700 py-3 mb-6 border-y border-slate-200 text-sm font-bold font-display">
          <span className="flex items-center gap-1.5"><i className="fas fa-bed text-slate-400"></i> {property.beds ?? '—'} Beds</span>
          <span className="text-slate-300">•</span>
          <span className="flex items-center gap-1.5"><i className="fas fa-bath text-slate-400"></i> {property.baths ?? '—'} Baths</span>
          <span className="text-slate-300">•</span>
          <span className="flex items-center gap-1.5"><i className="fas fa-ruler-combined text-slate-400"></i> {property.sqft == null ? '—' : property.sqft.toLocaleString()} sqft</span>
          <span className="text-slate-300">•</span>
          <span className="flex items-center gap-1.5 text-zillow-green-dark"><i className="fas fa-paw"></i> Pets OK</span>
        </div>

        {/* Main Content Grid */}
        <div className="order-4 grid grid-cols-1 gap-10 lg:grid-cols-3 relative items-start">
          <div className="space-y-8 lg:col-span-2">
            
            {/* Desktop Gallery */}
            <div className="hidden sm:block">
              {property.photos.length > 0 ? (
                <div className="space-y-4">
                  <button type="button" onClick={() => setIsLightboxOpen(true)} className="relative aspect-[16/10] overflow-hidden rounded-xl bg-slate-100 w-full hover:opacity-95 transition" aria-label="View fullscreen gallery">
                    <img src={window.CONFIG?.img ? window.CONFIG.img(property.photos[selectedPhoto]?.url, 'gallery') : property.photos[selectedPhoto]?.url} className="h-full w-full object-cover" />
                    <div className="absolute bottom-3 right-3 rounded-lg bg-white/90 backdrop-blur-sm border border-slate-200 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-700 shadow-sm">
                      Photo {selectedPhoto + 1} of {property.photos.length}
                    </div>
                  </button>
                  {property.photos.length > 1 && (
                    <div id="photo-thumbnails-strip" className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                      {property.photos.map((photo, index) => (
                        <button key={index} type="button" onClick={() => setSelectedPhoto(index)} className={\`overflow-hidden rounded-lg border-2 transition aspect-square bg-slate-100 \${selectedPhoto === index ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-transparent opacity-70 hover:opacity-100 hover:border-slate-300'}\`}>
                          <img src={window.CONFIG?.img ? window.CONFIG.img(photo.url, 'thumb') : photo.url} className="h-full w-full object-cover" loading="lazy" />
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

            {/* Desktop Specs Grid */}
            <div id="property-specs-grid" className="hidden sm:grid grid-cols-4 gap-4">
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
                <span className="mt-1 block text-2xl font-extrabold text-slate-900 font-display">{property.sqft == null ? '—' : property.sqft.toLocaleString()}</span>
              </div>
              <div className="rounded-2xl border border-zillow-green bg-emerald-50 p-4 text-center shadow-sm">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-zillow-green-dark">Pet Policy</span>
                <span className="mt-1 block text-lg font-extrabold text-zillow-green-dark font-display">Pets Welcome</span>
              </div>
            </div>
            
            {/* Right Sidebar: Apply CTA & Help */}
`
  );
  
  // Also we need to close the outer flex column wrapper before SimilarProperties
  newReturn = newReturn.replace(
    /\{\/\* Similar Listings \*\/\}/,
    `  </div>\n      </div>\n      {/* Similar Listings */}`
  );

  content = content.replace(oldReturn, newReturn);
  
  fs.writeFileSync('frontend/src/components/PropertyDetail.tsx', content);
}
