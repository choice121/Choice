import { useParams, useSearchParams } from 'react-router-dom'
import { PropertyDetail } from '../components/PropertyDetail'

export function PropertyDetailPage() {
  const { id: pathPropertyId } = useParams()
  const [searchParams] = useSearchParams()
  const propertyId = pathPropertyId || searchParams.get('id')

  if (!propertyId) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
            <p className="font-semibold">Property not found</p>
            <p className="mt-2 text-sm">No property ID specified in the URL.</p>
          </div>
        </div>
      </main>
    )
  }

  return <PropertyDetail propertyId={propertyId} />
}
