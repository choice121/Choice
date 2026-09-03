import { Link } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'

export function HoldingDepositPolicyPage() {
  return (
    <div id="holding-deposit-policy-container" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      <Navbar />

      <main className="flex-1">
        {/* Header */}
        <section className="border-b border-slate-200/80 bg-gradient-to-b from-slate-100 to-slate-950 px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl space-y-4">
            <nav className="flex items-center gap-2 text-xs font-medium text-slate-500" aria-label="Breadcrumb">
              <Link to="/" className="hover:text-[#006AFF]">Home</Link>
              <span>›</span>
              <Link to="/policies" className="hover:text-[#006AFF]">Policies</Link>
              <span>›</span>
              <span className="text-slate-700" aria-current="page">Holding Deposit Policy</span>
            </nav>

            <div className="inline-flex items-center gap-2 rounded-full border border-[#006AFF]/30 bg-[#006AFF]/10 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-[#006AFF]">
              Reservation Terms
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Holding Deposit Policy
            </h1>
            <p className="text-sm sm:text-base text-slate-600">
              How holding deposits work to reserve an approved rental property prior to full lease signing.
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
              <h2 className="text-xl font-bold text-slate-900">1. Purpose of a Holding Deposit</h2>
              <p>
                Once an applicant is approved for tenancy, a holding deposit may be requested to formally reserve the rental property and temporarily withdraw the listing from the open market while final lease agreements are executed.
              </p>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">2. Full Credit Toward Move-In Costs</h2>
              <p>
                A holding deposit is <strong className="text-slate-900">not an additional charge or fee</strong>. Upon execution of the lease, 100% of the holding deposit is directly credited toward the tenant's first month's rent or standard 1× security deposit.
              </p>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">3. Refund Conditions</h2>
              <p>
                Holding deposits are handled under the following statutory guidelines:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-slate-600">
                <li>
                  <strong className="text-slate-900">Landlord Failure to Deliver:</strong> If the property owner is unable to deliver possession of the designated property on the agreed date or if material undisclosed habitability defects exist, 100% of the holding deposit is promptly refunded to the applicant.
                </li>
                <li>
                  <strong className="text-slate-900">Applicant Cancellation:</strong> If an approved applicant decides not to execute the lease after the property has been held off-market, reasonable documented out-of-pocket marketing and administrative costs incurred during the holding window may be deducted in accordance with applicable state law.
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">4. Timing of Lease Execution</h2>
              <p>
                Approved applicants typically have 48 hours following delivery of the digital lease agreement to review, sign electronically, and coordinate final move-in balances.
              </p>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs text-slate-500 pt-4 border-t border-slate-850">
            <Link to="/rental-application-policy" className="hover:text-[#006AFF] flex items-center gap-1">
              ← Rental Application Policy
            </Link>
            <Link to="/policies" className="hover:text-[#006AFF] flex items-center gap-1">
              Policy Framework Overview →
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
