import { Link } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'

export function HowItWorksPage() {
  return (
    <div id="how-it-works-page-container" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section id="how-it-works-hero" className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-b from-slate-100 via-slate-950 to-slate-950 px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-4xl text-center space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-zillow-blue/30 bg-zillow-blue/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-zillow-blue">
              For Landlords &amp; Property Managers
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
              List Your Property.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-zillow-blue to-emerald-400">
                Connect with Verified Tenants.
              </span>
            </h1>
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Completely free to list. No recurring subscription fees. Complete background checks, digital leases, and qualified placement support.
            </p>
            <div className="pt-4 flex flex-wrap justify-center gap-4">
              <a
                href="/landlord/register.html"
                id="hero-register-landlord-btn"
                className="inline-flex items-center justify-center rounded-xl bg-zillow-blue px-6 py-3.5 text-sm font-bold text-white shadow-lg  transition hover:bg-zillow-blue-dark min-h-[44px]"
              >
                Register as Landlord
              </a>
              <a
                href="/landlord/login.html"
                id="hero-login-landlord-btn"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 min-h-[44px]"
              >
                Landlord Portal Login
              </a>
            </div>
          </div>
        </section>

        {/* Steps for Landlords */}
        <section id="landlord-steps-section" className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">A Seamless Landlord Workflow</h2>
            <p className="text-sm sm:text-base text-slate-500">Everything from marketing to move-in coordinated through your dashboard.</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zillow-blue/10 border border-zillow-blue/30 text-base font-bold text-zillow-blue">
                  01
                </span>
                <span className="text-xs uppercase font-semibold text-slate-500">Free Setup</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">Create Account</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Register in less than two minutes. No credit card required, no recurring monthly listing subscriptions.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zillow-blue/10 border border-zillow-blue/30 text-base font-bold text-zillow-blue">
                  02
                </span>
                <span className="text-xs uppercase font-semibold text-slate-500">Fast Listing</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">List Your Property</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Upload verified high-resolution photographs, specify bedroom count, rent amount, and amenities in minutes.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zillow-blue/10 border border-zillow-blue/30 text-base font-bold text-zillow-blue">
                  03
                </span>
                <span className="text-xs uppercase font-semibold text-slate-500">Screening</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">Screened Applicants</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Receive completed applications with verified credit reports, proof of income, and background checks.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zillow-green/10 border border-zillow-green/30 text-base font-bold text-zillow-green-dark">
                  04
                </span>
                <span className="text-xs uppercase font-semibold text-slate-500">Leasing</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">Select &amp; Sign</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Approve your ideal tenant with one click. Digital lease signing and move-in schedules are fully coordinated.
              </p>
            </div>
          </div>

          {/* Benefits Grid */}
          <div id="landlord-benefits-card" className="rounded-2xl border border-slate-200 bg-white/90 p-8 space-y-6">
            <h3 className="text-2xl font-bold text-slate-900">Why Property Owners Trust Choice Properties</h3>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zillow-blue/10 text-zillow-blue font-bold text-sm">✓</span>
                <h4 className="text-base font-bold text-slate-900">Zero Subscription Fees</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  List as many properties as you want without monthly platform retainers or arbitrary listing expiration fees.
                </p>
              </div>

              <div className="space-y-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zillow-blue/10 text-zillow-blue font-bold text-sm">✓</span>
                <h4 className="text-base font-bold text-slate-900">Comprehensive Screening</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Every applicant undergoes standardized identity verification, credit screening, eviction database checks, and income audits.
                </p>
              </div>

              <div className="space-y-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zillow-blue/10 text-zillow-blue font-bold text-sm">✓</span>
                <h4 className="text-base font-bold text-slate-900">Standard 1× Rent Security</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Our standard security deposit formula provides robust financial protection while keeping homes accessible to qualified tenants.
                </p>
              </div>

              <div className="space-y-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zillow-blue/10 text-zillow-blue font-bold text-sm">✓</span>
                <h4 className="text-base font-bold text-slate-900">Dedicated Support Coordinator</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Our team answers the phone and assists with applicant inquiries, scheduling, and onboarding every step of the way.
                </p>
              </div>

              <div className="space-y-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zillow-blue/10 text-zillow-blue font-bold text-sm">✓</span>
                <h4 className="text-base font-bold text-slate-900">Digital Lease Management</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Built-in compliant e-signatures and centralized lease tracking keep your records orderly and legally sound.
                </p>
              </div>

              <div className="space-y-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zillow-blue/10 text-zillow-blue font-bold text-sm">✓</span>
                <h4 className="text-base font-bold text-slate-900">Equal Housing Compliance</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Standardized applicant qualification protocols ensure strict adherence to federal and state Fair Housing regulations.
                </p>
              </div>
            </div>
          </div>

          {/* Bottom CTA */}
          <div id="landlord-bottom-cta" className="rounded-2xl border border-zillow-blue/30 bg-gradient-to-r from-slate-100 via-white to-zillow-blue/5 p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <h3 className="text-2xl font-bold text-slate-900">Ready to fill your vacancies faster?</h3>
              <p className="text-sm text-slate-600 max-w-lg">
                Join our growing network of verified landlords and property managers across the United States.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <a
                href="/landlord/register.html"
                id="cta-landlord-register-bottom"
                className="inline-flex items-center justify-center rounded-xl bg-zillow-blue px-6 py-3.5 text-sm font-bold text-white shadow-lg  transition hover:bg-zillow-blue-dark min-h-[44px]"
              >
                Create Free Account →
              </a>
              <Link
                to="/listings"
                id="cta-view-marketplace"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-slate-100 px-6 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-700 hover:text-slate-900 min-h-[44px]"
              >
                View Marketplace
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
