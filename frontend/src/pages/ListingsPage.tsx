import { Link, useNavigate } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { PropertyList } from '../components/PropertyList'

export function ListingsPage() {
  const navigate = useNavigate()

  return (
    <div id="homepage-container" className="cp-listings-page min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section id="hero-banner-section" className="cp-listings-hero relative overflow-hidden bg-white border-b border-slate-200">
          <div className="cp-listings-hero-art absolute inset-0 bg-[url('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=2000')] bg-cover bg-center"></div>
          <div className="cp-listings-hero-shade absolute inset-0"></div>
          <div className="cp-listings-hero-content relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl space-y-6">
              <div className="cp-eyebrow inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-zillow-green animate-pulse" />
                Live Nationwide Inventory
              </div>

              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl leading-[1.15]">
                Find a home that <span>fits your life.</span>
              </h1>

              <p className="cp-listings-hero-copy text-lg text-slate-600 leading-relaxed max-w-2xl font-medium">
                Browse verified rental homes with clear pricing, genuine photos, and a straightforward application process from search to move-in.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <a href="#available-listings-section" className="inline-flex min-h-[46px] items-center justify-center rounded-xl bg-zillow-blue px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/20 transition hover:bg-zillow-blue-dark">
                  Explore available homes
                </a>
                <Link to="/how-it-works" className="inline-flex min-h-[46px] items-center justify-center rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/20">
                  See how it works <span aria-hidden="true" className="ml-2">→</span>
                </Link>
              </div>

              <div className="cp-guarantees flex flex-wrap gap-2.5 sm:gap-3 text-xs font-semibold text-slate-700">
                <span className="cp-guarantee flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm whitespace-nowrap">
                  <strong>✓</strong> Transparent pricing
                </span>
                <span className="cp-guarantee flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm whitespace-nowrap">
                  <strong>✓</strong> Standard $50 application
                </span>
                <span className="cp-guarantee flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm whitespace-nowrap">
                  <strong>✓</strong> 1× monthly rent deposit
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Listings Section */}
        <section id="available-listings-section" className="cp-listings-section mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
          <PropertyList
            limit={48}
            onPropertySelect={(id) => navigate(`/property?id=${encodeURIComponent(id)}`)}
          />
        </section>

        {/* Value Prop / Process Section */}
        <section id="how-choice-works-section" className="cp-process-section border-t border-slate-200 bg-white py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="cp-section-heading text-3xl font-bold text-slate-900 tracking-tight">A clearer path to your next home</h2>
              <p className="cp-section-copy mt-4 text-base text-slate-600">Simple, predictable, and protected from search to keys in hand.</p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              <div className="cp-process-card rounded-2xl border border-slate-200 bg-slate-50 p-8 space-y-4 hover:shadow-md transition-shadow">
                <div className="cp-process-number flex h-12 w-12 items-center justify-center rounded-xl bg-zillow-blue text-white font-bold text-lg shadow-sm">
                  1
                </div>
                <h3 className="text-xl font-bold text-slate-900">Browse Real Listings</h3>
                <p className="text-slate-600 leading-relaxed">
                  Every home features genuine photographs, clear specifications, and upfront monthly rent amounts with zero bait-and-switch fees.
                </p>
              </div>

              <div className="cp-process-card rounded-2xl border border-slate-200 bg-slate-50 p-8 space-y-4 hover:shadow-md transition-shadow">
                <div className="cp-process-number flex h-12 w-12 items-center justify-center rounded-xl bg-zillow-blue text-white font-bold text-lg shadow-sm">
                  2
                </div>
                <h3 className="text-xl font-bold text-slate-900">Apply in 10 Minutes</h3>
                <p className="text-slate-600 leading-relaxed">
                  Complete our secure online intake. Upload your verification documents safely and track your application review in real time.
                </p>
              </div>

              <div className="cp-process-card rounded-2xl border border-slate-200 bg-slate-50 p-8 space-y-4 hover:shadow-md transition-shadow">
                <div className="cp-process-number flex h-12 w-12 items-center justify-center rounded-xl bg-zillow-blue text-white font-bold text-lg shadow-sm">
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
