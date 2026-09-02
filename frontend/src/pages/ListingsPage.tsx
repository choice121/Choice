import { useNavigate } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { PropertyList } from '../components/PropertyList'

export function ListingsPage() {
  const navigate = useNavigate()

  return (
    <div id="homepage-container" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section id="hero-banner-section" className="relative overflow-hidden border-b border-slate-850 bg-gradient-to-b from-slate-900/90 via-slate-950 to-slate-950 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-3 py-1 text-xs font-semibold text-cyan-300">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                Live Nationwide Inventory
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl leading-tight">
                Find Your Next Home <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-blue-500">Without the Hassle</span>
              </h1>

              <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
                Browse verified rental homes across the United States. Transparent pricing, guaranteed 1x monthly rent deposit, and a flat $50 application fee on every property.
              </p>

              {/* Guarantees Badges */}
              <div className="pt-2 flex flex-wrap gap-2.5 sm:gap-4 text-xs font-medium text-slate-300">
                <span className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1.5 whitespace-nowrap">
                  <span className="text-emerald-400">✓</span> 100% Pet Friendly
                </span>
                <span className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1.5 whitespace-nowrap">
                  <span className="text-cyan-400">✓</span> Standard $50 Application Fee
                </span>
                <span className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1.5 whitespace-nowrap">
                  <span className="text-blue-400">✓</span> 1x Monthly Rent Security Deposit
                </span>
                <span className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1.5 whitespace-nowrap">
                  <span className="text-amber-400">✓</span> Verified Genuine Photos
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
        <section id="how-choice-works-section" className="border-t border-slate-900 bg-slate-900/40 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-2xl font-bold text-white sm:text-3xl">How Renting with Choice Works</h2>
              <p className="mt-2 text-sm text-slate-400">Simple, predictable, and protected from start to keys in hand.</p>
            </div>

            <div className="grid gap-8 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-6 space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 font-bold text-base border border-cyan-500/20">
                  1
                </div>
                <h3 className="text-lg font-semibold text-white">Browse Real Listings</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Every home features genuine photographs, clear specifications, and upfront monthly rent amounts with zero bait-and-switch fees.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-6 space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 font-bold text-base border border-blue-500/20">
                  2
                </div>
                <h3 className="text-lg font-semibold text-white">Apply in 10 Minutes</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Complete our secure online intake. Upload your verification documents safely and track your application review in real time.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-6 space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 font-bold text-base border border-emerald-500/20">
                  3
                </div>
                <h3 className="text-lg font-semibold text-white">Guaranteed Terms</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
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
