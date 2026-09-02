import { useParams, useSearchParams, Link } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { PropertyDetail } from '../components/PropertyDetail'

export function PropertyDetailPage() {
  const { id: pathPropertyId } = useParams()
  const [searchParams] = useSearchParams()
  const propertyId = pathPropertyId || searchParams.get('id')

  return (
    <div id="property-detail-page-container" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      <Navbar />

      <main className="flex-1">
        {!propertyId ? (
          <div className="mx-auto max-w-4xl px-4 py-16 text-center">
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-8 text-rose-200 max-w-md mx-auto">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 mb-3">
                ✕
              </div>
              <p className="text-lg font-semibold">No Property Specified</p>
              <p className="mt-2 text-sm text-rose-300/80">Please select a rental property from our listings.</p>
              <Link
                to="/listings"
                className="mt-5 inline-flex items-center justify-center rounded-xl bg-slate-800 border border-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 transition min-h-[44px]"
              >
                Browse All Properties
              </Link>
            </div>
          </div>
        ) : (
          <PropertyDetail propertyId={propertyId} />
        )}
      </main>

      <Footer />
    </div>
  )
}
