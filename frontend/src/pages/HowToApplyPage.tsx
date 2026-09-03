import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'

export function HowToApplyPage() {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})

  const toggleCheck = (id: string) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const checklist = [
    { id: 'item-id', label: 'Government-Issued Photo ID', detail: "Valid driver's license, state ID, or passport (clear photo required)." },
    { id: 'item-income', label: 'Proof of Verifiable Income', detail: 'Last 2–3 pay stubs, recent bank statements, or official employment offer letter demonstrating ~3× monthly rent.' },
    { id: 'item-employment', label: 'Employment Information', detail: 'Employer company name, supervisor contact number, job title, and duration of current employment.' },
    { id: 'item-rental', label: 'Rental History & Landlord Contacts', detail: 'Current and previous residential addresses with contact details for prior landlords or property managers.' },
    { id: 'item-ssn', label: 'Social Security Number (SSN)', detail: 'Required securely for consumer background and credit checks conducted in compliance with the FCRA.' },
    { id: 'item-references', label: 'Personal or Professional References', detail: 'Names and active phone numbers of 2 references who can confirm character and reliability.' },
  ]

  const checkedCount = Object.values(checkedItems).filter(Boolean).length

  return (
    <div id="how-to-apply-page-container" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section id="how-to-apply-hero" className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-b from-slate-100 via-slate-950 to-slate-950 px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-4xl text-center space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#00AD71]/30 bg-[#00AD71]/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-[#00AD71]">
              Renter Guide &amp; Process
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
              Apply Online in <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#006AFF] to-emerald-400">15 Minutes</span>
            </h1>
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Our streamlined online application is fast, secure, and 100% mobile-friendly. No printing, no faxing, and completely transparent fees.
            </p>
          </div>
        </section>

        {/* Steps Section */}
        <section id="application-steps-section" className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">How the Rental Process Works</h2>
            <p className="text-sm sm:text-base text-slate-500">From browsing to key handover in 4 simple stages.</p>
          </div>

          <div id="steps-grid" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Step 1 */}
            <div id="step-card-1" className="relative rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-md transition hover:border-slate-300 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#006AFF]/10 border border-[#006AFF]/30 text-base font-bold text-[#006AFF]">
                  01
                </span>
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Step 1</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">Find Your Home</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Explore verified listings across major metro areas. Filter by price, bedrooms, and amenities with guaranteed 100% pet friendliness.
              </p>
            </div>

            {/* Step 2 */}
            <div id="step-card-2" className="relative rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-md transition hover:border-slate-300 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#006AFF]/10 border border-[#006AFF]/30 text-base font-bold text-[#006AFF]">
                  02
                </span>
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Step 2</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">Submit Intake</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Click "Start Online Application" on any property. Enter your contact details, employment history, and upload supporting documents.
              </p>
            </div>

            {/* Step 3 */}
            <div id="step-card-3" className="relative rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-md transition hover:border-slate-300 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#006AFF]/10 border border-[#006AFF]/30 text-base font-bold text-[#006AFF]">
                  03
                </span>
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Step 3</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">Screening Review</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Our leasing team contacts you within 24 hours to securely coordinate the standard $50 application screening fee. Review completes in 24–72 hours.
              </p>
            </div>

            {/* Step 4 */}
            <div id="step-card-4" className="relative rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-md transition hover:border-slate-300 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00AD71]/10 border border-[#00AD71]/30 text-base font-bold text-[#00AD71]">
                  04
                </span>
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">Step 4</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">Sign &amp; Move In</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Review and execute your standardized digital lease with simple e-signatures. Pay your 1× monthly rent deposit and schedule key pickup.
              </p>
            </div>
          </div>

          {/* Interactive Document Preparation Checklist */}
          <div id="interactive-checklist-card" className="rounded-2xl border border-slate-200 bg-white/90 p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <h3 className="text-xl font-bold text-slate-900">What You'll Need to Apply</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Gather these items before starting your online application for the fastest decision.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-slate-100/80 px-4 py-2 text-xs font-semibold text-[#006AFF]">
                <span>{checkedCount} of {checklist.length} items ready</span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {checklist.map((item) => {
                const isChecked = Boolean(checkedItems[item.id])
                return (
                  <button
                    key={item.id}
                    id={item.id}
                    type="button"
                    onClick={() => toggleCheck(item.id)}
                    className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
                      isChecked
                        ? 'border-[#00AD71]/40 bg-[#00AD71]/10'
                        : 'border-slate-200 bg-slate-50/60 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border mt-0.5 text-xs font-bold transition ${
                        isChecked
                          ? 'border-[#00AD71] bg-[#00AD71] text-slate-950'
                          : 'border-slate-300 bg-white text-transparent'
                      }`}
                    >
                      ✓
                    </div>
                    <div>
                      <span className={`block text-sm font-bold ${isChecked ? 'text-[#00AD71]' : 'text-slate-900'}`}>
                        {item.label}
                      </span>
                      <span className="block text-xs text-slate-500 mt-1 leading-relaxed">
                        {item.detail}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Pricing & Fee Transparency Section */}
          <div id="fee-transparency-card" className="grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 space-y-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-[#006AFF]">Screening Fee</span>
              <div className="text-3xl font-extrabold text-slate-900">$50.00</div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Strictly fixed for all listings. Covers third-party credit, eviction, and criminal verification. Nothing is billed at initial form submit.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 space-y-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-[#00AD71]">Security Deposit</span>
              <div className="text-3xl font-extrabold text-slate-900">1× Monthly Rent</div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Standardized security deposit across every property. No artificial double or triple deposit demands for qualified renters.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 space-y-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-[#006AFF]">Pet Guarantee</span>
              <div className="text-3xl font-extrabold text-slate-900">100% Pet Friendly</div>
              <p className="text-xs text-slate-600 leading-relaxed">
                We believe pets are family. All Choice Properties listings accommodate dogs and cats with transparent guidelines and no surprise exclusions.
              </p>
            </div>
          </div>

          {/* Action CTA Banner */}
          <div id="how-to-apply-cta-banner" className="rounded-2xl border border-[#006AFF]/30 bg-gradient-to-r from-slate-100 via-white to-[#006AFF]/5 p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <h3 className="text-2xl font-bold text-slate-900">Ready to find your next home?</h3>
              <p className="text-sm text-slate-600 max-w-lg">
                Browse our real-time inventory of verified properties with high-resolution photos and transparent rates.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <Link
                to="/listings"
                id="cta-browse-available-homes"
                className="inline-flex items-center justify-center rounded-xl bg-[#006AFF] px-6 py-3.5 text-sm font-bold text-white shadow-lg  transition hover:bg-[#0058D6] min-h-[44px]"
              >
                Browse Listings →
              </Link>
              <a
                href="/tenant/portal.html"
                target="_blank"
                rel="noopener noreferrer"
                id="cta-track-existing-application"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-slate-100 px-6 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-700 hover:text-slate-900 min-h-[44px]"
              >
                Track Existing Application
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
