import { useNavigate } from 'react-router-dom'
import { PropertyList } from '../components/PropertyList'

export function ListingsPage() {
  const navigate = useNavigate()

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-[28px] border border-slate-800 bg-slate-900/75 p-6 shadow-lg">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
            Property listings • modern redesign
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Available properties
          </h1>
          <p className="mt-2 text-slate-300">Browse and apply for rental properties in your area.</p>
        </header>

        <PropertyList
          limit={24}
          onPropertySelect={(id) => navigate(`/property?id=${encodeURIComponent(id)}`)}
        />
      </div>
    </main>
  )
}
