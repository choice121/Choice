import { Link } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'

export function FairHousingPage() {
  return (
    <div id="fair-housing-page-container" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      <Navbar />

      <main className="flex-1">
        {/* Header */}
        <section className="border-b border-slate-200/80 bg-gradient-to-b from-slate-100 to-slate-950 px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl space-y-4">
            <nav className="flex items-center gap-2 text-xs font-medium text-slate-500" aria-label="Breadcrumb">
              <Link to="/" className="hover:text-zillow-blue">Home</Link>
              <span>›</span>
              <Link to="/policies" className="hover:text-zillow-blue">Policies</Link>
              <span>›</span>
              <span className="text-slate-700" aria-current="page">Fair Housing Policy</span>
            </nav>

            <div className="inline-flex items-center gap-2 rounded-full border border-zillow-blue/30 bg-zillow-blue/10 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-zillow-blue">
              Equal Opportunity Policy
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Fair Housing Policy
            </h1>
            <p className="text-sm sm:text-base text-slate-600">
              Our absolute commitment to fair, equal, and non-discriminatory housing practices.
            </p>
            <p className="text-xs text-slate-500">
              Effective Date: April 22, 2026 • Version 2.0
            </p>
          </div>
        </section>

        {/* Policy Body */}
        <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
          <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 sm:p-8 space-y-6 leading-relaxed text-sm sm:text-base text-slate-600">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">1. Our Commitment</h2>
              <p>
                Choice Properties is strictly committed to fair housing and equal opportunity for all people. We do not and will not tolerate discrimination in any form on our platform or in any leasing procedures conducted by affiliated property owners.
              </p>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">2. Federal Fair Housing Act Compliance</h2>
              <p>
                The federal Fair Housing Act (42 U.S.C. §§ 3601–3619) prohibits discrimination in the sale, rental, or financing of housing based on:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-slate-600">
                <li><strong className="text-slate-900">Race</strong></li>
                <li><strong className="text-slate-900">Color</strong></li>
                <li><strong className="text-slate-900">National Origin</strong></li>
                <li><strong className="text-slate-900">Religion</strong></li>
                <li><strong className="text-slate-900">Sex</strong> (including gender identity and sexual orientation)</li>
                <li><strong className="text-slate-900">Familial Status</strong> (including families with children under 18 and pregnant individuals)</li>
                <li><strong className="text-slate-900">Disability</strong> (physical or mental impairments)</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">3. State and Local Law Protections</h2>
              <p>
                In addition to federal protections, many states and local municipalities provide further statutory protections, including prohibitions against discrimination based on lawful source of income (such as housing vouchers and Section 8), age, marital status, military status, and ancestry. Every landlord and property manager operating on Choice Properties is required to strictly observe all applicable local protections.
              </p>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">4. Prohibited Actions on Choice Properties</h2>
              <p>
                Choice Properties prohibits any user, landlord, or agent from:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-slate-600">
                <li>Publishing listings or descriptions containing discriminatory language or preferences</li>
                <li>Filtering, sorting, or prioritizing applications based on protected demographic characteristics</li>
                <li>Refusing to rent or negotiating terms in bad faith based on a protected category</li>
                <li>Refusing reasonable accommodations or modifications for individuals with disabilities</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">5. Reporting Violations</h2>
              <p>
                If you believe you have experienced unlawful discrimination on Choice Properties, please report it immediately to our compliance desk at <a href="mailto:support@choiceproperties.com" className="text-zillow-blue hover:underline">support@choiceproperties.com</a> or call <a href="tel:7077063137" className="text-zillow-blue hover:underline">707-706-3137</a>. You may also file an official complaint with the U.S. Department of Housing and Urban Development (HUD) at <a href="https://www.hud.gov/fairhousing" target="_blank" rel="noopener noreferrer" className="text-zillow-blue hover:underline">hud.gov/fairhousing</a>.
              </p>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs text-slate-500 pt-4 border-t border-slate-850">
            <Link to="/policies" className="hover:text-zillow-blue flex items-center gap-1">
              ← Back to Complete Policy Framework
            </Link>
            <Link to="/rental-application-policy" className="hover:text-zillow-blue flex items-center gap-1">
              View Rental Application Policy →
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
