import { useNavigate } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { PropertyList } from '../components/PropertyList'

export function ListingsPage() {
  const navigate = useNavigate()

  return (
    <div id="homepage-container" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section id="hero-banner-section" className="relative overflow-hidden bg-white border-b border-slate-200 py-16 sm:py-24">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=2000')] bg-cover bg-center opacity-5"></div>
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-[#00AD71] animate-pulse" />
                Live Nationwide Inventory
              </div>

              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl leading-[1.15]">
                Find Your Next Home <span className="text-slate-500 block sm:inline">Without the Hassle.</span>
              </h1>

              <p className="text-lg text-slate-600 leading-relaxed max-w-2xl font-medium">
                Browse verified rental homes across the United States. Transparent pricing, guaranteed 1x monthly rent deposit, and a flat $50 application fee on every property.
              </p>

              {/* Guarantees Badges */}
              <div className="pt-4 flex flex-wrap gap-2.5 sm:gap-3 text-xs font-semibold text-slate-700">
                <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm whitespace-nowrap">
                  <span className="text-[#00AD71]">✓</span> 100% Pet Friendly
                </span>
                <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm whitespace-nowrap">
                  <span className="text-slate-900">✓</span> Standard $50 Application Fee
                </span>
                <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm whitespace-nowrap">
                  <span className="text-slate-900">✓</span> 1x Monthly Rent Deposit
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Listings Section */}
        <section id="available-listings-section" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
          <PropertyList
            limit={48}
            onPropertySelect={(id) => navigate(`/property?id=${encodeURIComponent(id)}`)}
          />
        </section>

        {/* Value Prop / Process Section */}
        <section id="how-choice-works-section" className="border-t border-slate-200 bg-white py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">How Renting Works</h2>
              <p className="mt-4 text-base text-slate-600">Simple, predictable, and protected from start to keys in hand.</p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 space-y-4 hover:shadow-md transition-shadow">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#006AFF] text-white font-bold text-lg shadow-sm">
                  1
                </div>
                <h3 className="text-xl font-bold text-slate-900">Browse Real Listings</h3>
                <p className="text-slate-600 leading-relaxed">
                  Every home features genuine photographs, clear specifications, and upfront monthly rent amounts with zero bait-and-switch fees.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 space-y-4 hover:shadow-md transition-shadow">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#006AFF] text-white font-bold text-lg shadow-sm">
                  2
                </div>
                <h3 className="text-xl font-bold text-slate-900">Apply in 10 Minutes</h3>
                <p className="text-slate-600 leading-relaxed">
                  Complete our secure online intake. Upload your verification documents safely and track your application review in real time.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 space-y-4 hover:shadow-md transition-shadow">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#006AFF] text-white font-bold text-lg shadow-sm">
                  3
                </div>
                <h3 className="text-xl font-bold text-slate-900">Guaranteed Terms</h3>
                <p className="text-slate-600 leading-relaxed">
                  Security deposit is always 1x monthly rent. Sign your standard digital lease and receive keys directly through landlord coordination.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
