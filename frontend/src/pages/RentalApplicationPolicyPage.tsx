import { Link } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'

export function RentalApplicationPolicyPage() {
  return (
    <div id="rental-policy-page-container" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
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
              <span className="text-slate-700" aria-current="page">Rental Application Policy</span>
            </nav>

            <div className="inline-flex items-center gap-2 rounded-full border border-[#006AFF]/30 bg-[#006AFF]/10 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-[#006AFF]">
              Screening Guidelines
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Rental Application Policy
            </h1>
            <p className="text-sm sm:text-base text-slate-600">
              Detailed breakdown of screening procedures, qualification criteria, fee coverage, and applicant timelines.
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
              <h2 className="text-xl font-bold text-slate-900">1. Overview &amp; Process</h2>
              <p>
                This policy outlines the standard terms governing rental applications submitted through the Choice Properties marketplace. Our objective is to ensure every prospective tenant receives an efficient, transparent, and fair review.
              </p>
              <ol className="list-decimal pl-6 space-y-2 text-slate-600 mt-2">
                <li><strong className="text-slate-900">Online Application:</strong> Submit your basic applicant details and documents. No fee is charged at initial submission.</li>
                <li><strong className="text-slate-900">Payment Coordination:</strong> Our leasing desk contacts you within 24 hours to securely coordinate payment of the standard $50 screening fee.</li>
                <li><strong className="text-slate-900">Active Screening Review:</strong> Verified background, eviction history, and credit reports are processed within 24 to 72 hours.</li>
                <li><strong className="text-slate-900">Approval &amp; Selection:</strong> Qualified applicants receive approval notice and digital lease documents.</li>
                <li><strong className="text-slate-900">Move-In Coordination:</strong> Standard 1× rent security deposit is paid and keys are scheduled.</li>
              </ol>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">2. Application Fee Structure</h2>
              <p>
                The screening fee for all Choice Properties listings is standardized at <strong className="text-[#006AFF]">$50.00</strong> per adult applicant (18 years and older). This fee directly covers out-of-pocket costs incurred for consumer credit reporting, criminal record databases, eviction records, and verification overhead.
              </p>
              <p>
                <strong className="text-slate-900">Non-Refundability:</strong> Once the screening fee has been authorized and the third-party screening check initiated, the fee is non-refundable. If an application is denied or another applicant is selected first, applicants are eligible for reapplication credits valid for 45 days.
              </p>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">3. Qualification Standards</h2>
              <ul className="list-disc pl-6 space-y-2 text-slate-600">
                <li><strong className="text-slate-900">Income:</strong> Verifiable gross monthly household income should equal or exceed approximately 3× the monthly rent.</li>
                <li><strong className="text-slate-900">Rental History:</strong> Positive prior tenancy references free from unresolved utility defaults or disruptive lease breaches.</li>
                <li><strong className="text-slate-900">Credit Profile:</strong> Consistent repayment history evaluated in aggregate. Medical debt or disputed student loan balances do not automatically disqualify applicants.</li>
                <li><strong className="text-slate-900">Background Check:</strong> Criminal history reviewed in strict compliance with HUD guidelines and applicable local fair chance housing ordinances.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">4. Security Deposit Policy</h2>
              <p>
                Choice Properties enforces a standard security deposit equal to exactly <strong className="text-[#00AD71]">1× monthly rent</strong> for qualified tenants across all properties. Deposits are held in compliant escrow accounts and returned following move-out inspection in accordance with state statutory deadlines.
              </p>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">5. Equal Opportunity Statement</h2>
              <p>
                Every application is processed objectively without regard to race, color, religion, sex, disability, familial status, national origin, or any state-protected class.
              </p>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs text-slate-500 pt-4 border-t border-slate-850">
            <Link to="/policies" className="hover:text-[#006AFF] flex items-center gap-1">
              ← Back to Policies
            </Link>
            <Link to="/holding-deposit-policy" className="hover:text-[#006AFF] flex items-center gap-1">
              View Holding Deposit Policy →
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
